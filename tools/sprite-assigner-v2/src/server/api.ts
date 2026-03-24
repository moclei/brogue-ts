import type { Plugin } from "vite";
import path from "path";
import fs from "fs";
import { generateMasterSheet, type SavePayload } from "./generate.ts";

interface ManifestSheet { key: string; path: string; category: string }
interface ManifestGroup { id: string; name: string; sheets: ManifestSheet[] }
interface ManifestData { tileSize: number; basePath: string; tilesets: ManifestGroup[] }

/**
 * Vite plugin that adds API middleware for the sprite assigner.
 *
 * Core routes:
 *   GET  /api/manifest           — sprite-manifest.json (output manifest)
 *   GET  /api/assignments        — assignments.json (source refs)
 *   GET  /api/sheets/:key        — source sheet PNG by key name
 *   POST /api/save               — generate master sheet + manifest
 *
 * Sheet management routes:
 *   GET  /api/tileset-manifest   — the tileset registry (groups + sheets)
 *   PUT  /api/tileset-manifest   — overwrite the tileset registry
 *   POST /api/upload-sheet       — upload a PNG into the tilesets dir
 *
 * Asset proxy:
 *   GET  /tilesets/<path>        — source sheet PNGs by relative path
 */
export function spriteAssignerApi(repoRoot: string): Plugin {
  const tilesetsDir = path.join(repoRoot, "rogue-ts/assets/tilesets");
  const toolDir = path.resolve(__dirname, "../..");
  const manifestFile = path.join(toolDir, "tileset-manifest.json");

  function readManifest(): ManifestData {
    return JSON.parse(fs.readFileSync(manifestFile, "utf-8")) as ManifestData;
  }

  function writeManifest(data: ManifestData): void {
    fs.writeFileSync(manifestFile, JSON.stringify(data, null, 2) + "\n");
  }

  function buildSheetPaths(): Map<string, string> {
    const raw = readManifest();
    const map = new Map<string, string>();
    for (const tileset of raw.tilesets) {
      for (const sheet of tileset.sheets) {
        map.set(sheet.key, path.join(tilesetsDir, sheet.path));
      }
    }
    return map;
  }

  return {
    name: "sprite-assigner-api",
    configureServer(server) {
      let sheetPaths = buildSheetPaths();

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        // ----- Core API routes -----

        if (req.url === "/api/manifest" && req.method === "GET") {
          const file = path.join(tilesetsDir, "sprite-manifest.json");
          if (fs.existsSync(file)) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(file).pipe(res);
          } else {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "sprite-manifest.json not found" }));
          }
          return;
        }

        if (req.url === "/api/assignments" && req.method === "GET") {
          const file = path.join(tilesetsDir, "assignments.json");
          if (fs.existsSync(file)) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(file).pipe(res);
          } else {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "assignments.json not found" }));
          }
          return;
        }

        if (req.url.startsWith("/api/sheets/") && req.method === "GET") {
          const key = decodeURIComponent(req.url.slice("/api/sheets/".length));
          const filePath = sheetPaths.get(key);
          if (filePath && fs.existsSync(filePath)) {
            res.setHeader("Content-Type", "image/png");
            fs.createReadStream(filePath).pipe(res);
          } else {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: `Sheet "${key}" not found` }));
          }
          return;
        }

        if (req.url === "/api/save" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            (async () => {
              const payload = JSON.parse(body) as SavePayload;
              const result = await generateMasterSheet(payload, sheetPaths, tilesetsDir);
              fs.writeFileSync(
                path.join(tilesetsDir, "assignments.json"),
                JSON.stringify(payload, null, 2) + "\n",
              );
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, ...result }));
            })().catch((err: unknown) => {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            });
          });
          return;
        }

        // ----- Sheet management routes -----

        if (req.url === "/api/tileset-manifest" && req.method === "GET") {
          res.setHeader("Content-Type", "application/json");
          fs.createReadStream(manifestFile).pipe(res);
          return;
        }

        if (req.url === "/api/tileset-manifest" && req.method === "PUT") {
          let body = "";
          req.on("data", (chunk) => { body += chunk; });
          req.on("end", () => {
            try {
              const data = JSON.parse(body) as ManifestData;
              writeManifest(data);
              sheetPaths = buildSheetPaths();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (err: unknown) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.url === "/api/upload-sheet" && req.method === "POST") {
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => { chunks.push(Buffer.from(chunk)); });
          req.on("end", () => {
            try {
              const raw = Buffer.concat(chunks);
              const boundary = extractBoundary(req.headers["content-type"] ?? "");
              if (!boundary) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Missing multipart boundary" }));
                return;
              }
              const parts = parseMultipart(raw, boundary);
              const filePart = parts.find(p => p.name === "file");
              const metaPart = parts.find(p => p.name === "meta");
              if (!filePart || !metaPart) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Missing file or meta part" }));
                return;
              }
              const meta = JSON.parse(metaPart.data.toString("utf-8")) as {
                groupId: string; key: string; category: string; subpath: string;
              };
              const destPath = path.join(tilesetsDir, meta.subpath);
              fs.mkdirSync(path.dirname(destPath), { recursive: true });
              fs.writeFileSync(destPath, filePart.data);

              const manifest = readManifest();
              const group = manifest.tilesets.find(g => g.id === meta.groupId);
              if (group) {
                group.sheets.push({
                  key: meta.key,
                  path: meta.subpath,
                  category: meta.category,
                });
                writeManifest(manifest);
                sheetPaths = buildSheetPaths();
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, path: meta.subpath }));
            } catch (err: unknown) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          });
          return;
        }

        // ----- Asset proxy -----

        if (req.url === "/tileset-manifest.json") {
          res.setHeader("Content-Type", "application/json");
          fs.createReadStream(manifestFile).pipe(res);
          return;
        }

        if (req.url.startsWith("/tilesets/")) {
          const relPath = decodeURIComponent(req.url.slice("/tilesets/".length));
          const file = path.join(tilesetsDir, relPath);
          if (fs.existsSync(file)) {
            res.setHeader("Content-Type", "image/png");
            fs.createReadStream(file).pipe(res);
            return;
          }
        }

        next();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Minimal multipart/form-data parser (avoids adding a dependency)
// ---------------------------------------------------------------------------

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

interface MultipartPart {
  name: string;
  filename?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const sep = Buffer.from(`--${boundary}`);
  const parts: MultipartPart[] = [];
  let start = indexOf(body, sep, 0);
  if (start === -1) return parts;
  start += sep.length + 2; // skip past \r\n

  while (true) {
    const nextSep = indexOf(body, sep, start);
    if (nextSep === -1) break;
    const partData = body.subarray(start, nextSep - 2); // strip trailing \r\n
    const headerEnd = indexOf(partData, Buffer.from("\r\n\r\n"), 0);
    if (headerEnd === -1) { start = nextSep + sep.length + 2; continue; }
    const headerStr = partData.subarray(0, headerEnd).toString("utf-8");
    const data = partData.subarray(headerEnd + 4);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const fnMatch = headerStr.match(/filename="([^"]+)"/);
    if (nameMatch?.[1]) {
      parts.push({ name: nameMatch[1], filename: fnMatch?.[1] ?? undefined, data });
    }
    start = nextSep + sep.length;
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break; // --
    start += 2; // skip \r\n
  }
  return parts;
}

function indexOf(buf: Buffer, needle: Buffer, from: number): number {
  for (let i = from; i <= buf.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}
