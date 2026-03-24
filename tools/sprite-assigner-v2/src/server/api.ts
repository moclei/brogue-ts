import type { Plugin } from "vite";
import path from "path";
import fs from "fs";
import { generateMasterSheet, type SavePayload } from "./generate.ts";

/**
 * Vite plugin that adds API middleware for the sprite assigner.
 *
 * Routes:
 *   GET  /api/manifest       — current sprite-manifest.json from disk
 *   GET  /api/sheets/:key    — source sheet PNG by key name
 *   POST /api/save           — generate master sheet + manifest, write to disk
 *
 * Also serves the legacy asset proxy routes from Phase 1:
 *   GET  /tileset-manifest.json   — tileset manifest from old tool dir
 *   GET  /tilesets/<path>         — source sheet PNGs by relative path
 */
export function spriteAssignerApi(repoRoot: string): Plugin {
  const tilesetsDir = path.join(repoRoot, "rogue-ts/assets/tilesets");
  const oldToolDir = path.join(repoRoot, "tools/sprite-assigner");

  function buildSheetPaths(): Map<string, string> {
    const manifestFile = path.join(oldToolDir, "tileset-manifest.json");
    const raw = JSON.parse(fs.readFileSync(manifestFile, "utf-8")) as {
      tilesets: Array<{ sheets: Array<{ key: string; path: string }> }>;
    };
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
      const sheetPaths = buildSheetPaths();

      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();

        // ----- API routes -----

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

        // ----- Legacy asset proxy routes (Phase 1 compatibility) -----

        if (req.url === "/tileset-manifest.json") {
          const file = path.join(oldToolDir, "tileset-manifest.json");
          if (fs.existsSync(file)) {
            res.setHeader("Content-Type", "application/json");
            fs.createReadStream(file).pipe(res);
            return;
          }
        }

        if (req.url.startsWith("/tilesets/")) {
          const relPath = req.url.slice("/tilesets/".length);
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
