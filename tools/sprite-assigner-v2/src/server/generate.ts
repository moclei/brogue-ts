import sharp from "sharp";
import path from "path";
import fs from "fs";
import {
  TILE_TYPES,
  DISPLAY_GLYPHS,
  TILE_SIZE,
  MASTER_GRID_W,
  MASTER_GRID_H,
  GLYPH_GRID_OFFSET,
} from "../data/tile-types.ts";

// ---------------------------------------------------------------------------
// Types shared with the client-side assignment state
// ---------------------------------------------------------------------------

export interface SpriteRef {
  sheet: string;
  x: number;
  y: number;
  w?: number;  // tile width in tile counts (integer >= 1); defaults to 1
  h?: number;  // tile height in tile counts (integer >= 1); defaults to 1
}

export interface AutotileGroupConfig {
  sheet: string;
  format: string;
}

export interface SavePayload {
  sheets?: { master: string };
  tiletype: Record<string, SpriteRef>;
  glyph: Record<string, SpriteRef>;
  autotile: Record<string, AutotileGroupConfig>;
}

export interface GenerateResult {
  tileCount: number;
  glyphCount: number;
  /** Filenames of non-16px atlases written (e.g. ["master-32.png"]). */
  extraAtlases: string[];
  /**
   * Merged sheets record to persist in assignments.json.
   * Always contains "master" → "master-spritesheet.png" plus any extra atlases.
   */
  sheetsRecord: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SHEET_W = MASTER_GRID_W * TILE_SIZE;
const SHEET_H = MASTER_GRID_H * TILE_SIZE;

interface SheetData {
  data: Buffer;
  info: { width: number; height: number; channels: number };
}

async function loadSheet(filePath: string): Promise<SheetData | null> {
  if (!fs.existsSync(filePath)) return null;
  const result = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return result as SheetData;
}

function extractTile(sheet: SheetData, tileX: number, tileY: number): Buffer {
  const { data, info } = sheet;
  const channels = info.channels;
  const rowBytes = info.width * channels;
  const buf = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);
  const sx = tileX * TILE_SIZE;
  const sy = tileY * TILE_SIZE;
  for (let row = 0; row < TILE_SIZE; row++) {
    if (sy + row >= info.height || sx >= info.width) continue;
    const srcOff = (sy + row) * rowBytes + sx * channels;
    const dstOff = row * TILE_SIZE * 4;
    const copyLen = Math.min(TILE_SIZE * channels, info.width * channels - sx * channels);
    if (copyLen > 0) data.copy(buf, dstOff, srcOff, srcOff + copyLen);
  }
  return buf;
}

/**
 * Extract a region from a source sheet using pixel-level stride coordinates.
 * Returns a raw RGBA buffer of size (pixelW * pixelH * 4).
 */
function extractRegion(
  sheet: SheetData,
  pixelX: number,
  pixelY: number,
  pixelW: number,
  pixelH: number,
): Buffer {
  const { data, info } = sheet;
  const channels = info.channels;
  const rowBytes = info.width * channels;
  const buf = Buffer.alloc(pixelW * pixelH * 4);
  for (let row = 0; row < pixelH; row++) {
    const srcRow = pixelY + row;
    if (srcRow >= info.height || pixelX >= info.width) continue;
    const srcOff = srcRow * rowBytes + pixelX * channels;
    const dstOff = row * pixelW * 4;
    const copyLen = Math.min(pixelW * channels, (info.width - pixelX) * channels);
    if (copyLen > 0) data.copy(buf, dstOff, srcOff, srcOff + copyLen);
  }
  return buf;
}

/**
 * Compute the output pixel size for a given assignment from a source sheet
 * with a known stride.  w defaults to 1 (one tile wide).
 */
function resolveOutputSize(assignment: SpriteRef, sourceStride: number): number {
  const w = assignment.w ?? 1;
  return w * sourceStride;  // assumes w === h for output size (square output)
}

// ---------------------------------------------------------------------------
// Types for composite operations
// ---------------------------------------------------------------------------

type Composite = {
  input: Buffer;
  raw: { width: number; height: number; channels: 4 };
  left: number;
  top: number;
};

// ---------------------------------------------------------------------------
// Per-stride atlas generation
// ---------------------------------------------------------------------------

interface HiResEntry {
  name: string;
  ref: SpriteRef;
  outputSize: number;
  sourceStride: number;
}

/**
 * Generate a single hi-res atlas for one output pixel size.
 * Lays out all entries in row-major order with MASTER_GRID_W columns.
 * Returns the manifest entries (col, row per glyph name).
 */
async function generateStrideAtlas(
  entries: HiResEntry[],
  outputSize: number,
  sheetPaths: Map<string, string>,
  outputDir: string,
): Promise<Map<string, { x: number; y: number; w: number; h: number; sheet: string }>> {
  const cache = new Map<string, SheetData | null>();
  const composites: Composite[] = [];
  const manifestEntries = new Map<string, { x: number; y: number; w: number; h: number; sheet: string }>();

  async function getSheet(key: string): Promise<SheetData | null> {
    if (cache.has(key)) return cache.get(key)!;
    const p = sheetPaths.get(key);
    const result = p ? await loadSheet(p) : null;
    cache.set(key, result);
    return result;
  }

  const cols = MASTER_GRID_W;
  const rows = Math.ceil(entries.length / cols);
  const canvasW = cols * outputSize;
  const canvasH = rows * outputSize;
  const sheetKey = `master-${outputSize}`;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const col = i % cols;
    const row = Math.floor(i / cols);

    manifestEntries.set(entry.name, {
      x: col,
      y: row,
      w: outputSize,
      h: outputSize,
      sheet: sheetKey,
    });

    const sheet = await getSheet(entry.ref.sheet);
    if (!sheet) continue;

    const stride = entry.sourceStride;
    const pixelX = entry.ref.x * stride;
    const pixelY = entry.ref.y * stride;
    const pixelW = (entry.ref.w ?? 1) * stride;
    const pixelH = (entry.ref.h ?? 1) * stride;

    composites.push({
      input: extractRegion(sheet, pixelX, pixelY, pixelW, pixelH),
      raw: { width: pixelW, height: pixelH, channels: 4 },
      left: col * outputSize,
      top: row * outputSize,
    });
  }

  const base = sharp({
    create: {
      width: canvasW,
      height: Math.max(canvasH, outputSize),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  await base
    .composite(composites)
    .png()
    .toFile(path.join(outputDir, `${sheetKey}.png`));

  return manifestEntries;
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

/**
 * Generate `master-spritesheet.png` and `sprite-manifest.json` from the
 * given assignments and write them to `outputDir`.
 *
 * Non-16px glyph assignments (those from sheets with stride > 16) are routed
 * to per-stride atlases: `master-{outputSize}.png` (e.g. master-32.png).
 *
 * @param payload        TileType + DisplayGlyph assignments from the UI
 * @param sheetPaths     Map of sheet key → absolute PNG path on disk
 * @param sheetStrides   Map of sheet key → stride in pixels (defaults to TILE_SIZE=16)
 * @param outputDir      Directory to write the output files into
 */
export async function generateMasterSheet(
  payload: SavePayload,
  sheetPaths: Map<string, string>,
  outputDir: string,
  sheetStrides?: Map<string, number>,
): Promise<GenerateResult> {
  const composites: Composite[] = [];
  const cache = new Map<string, SheetData | null>();

  async function getSheet(key: string): Promise<SheetData | null> {
    if (cache.has(key)) return cache.get(key)!;
    const p = sheetPaths.get(key);
    const result = p ? await loadSheet(p) : null;
    cache.set(key, result);
    return result;
  }

  function getStride(sheetKey: string): number {
    return sheetStrides?.get(sheetKey) ?? TILE_SIZE;
  }

  const manifest = {
    tileSize: TILE_SIZE,
    gridWidth: MASTER_GRID_W,
    gridHeight: MASTER_GRID_H,
    tiles: {} as Record<string, { x: number; y: number }>,
    glyphs: {} as Record<string, { x: number; y: number; w?: number; h?: number; sheet?: string }>,
  };

  // TileType entries — grid position determined by enum index
  // TileTypes always use 16px tiles (no stride variants for tile terrain)
  let tileCount = 0;
  for (let i = 0; i < TILE_TYPES.length; i++) {
    const name = TILE_TYPES[i];
    if (!name || name === "NOTHING") continue;
    const ref = payload.tiletype[name];
    if (!ref) continue;

    const pos = { x: i % MASTER_GRID_W, y: Math.floor(i / MASTER_GRID_W) };
    manifest.tiles[name] = pos;

    const sheet = await getSheet(ref.sheet);
    if (!sheet) continue;
    composites.push({
      input: extractTile(sheet, ref.x, ref.y),
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
      left: pos.x * TILE_SIZE,
      top: pos.y * TILE_SIZE,
    });
    tileCount++;
  }

  // DisplayGlyph entries — split by output pixel size
  // 16px → main master sheet; other strides → per-stride atlases
  let glyphCount = 0;
  const hiResGroups = new Map<number, HiResEntry[]>();

  for (let i = 0; i < DISPLAY_GLYPHS.length; i++) {
    const name = DISPLAY_GLYPHS[i];
    if (!name) continue;
    const ref = payload.glyph[name];
    if (!ref) continue;

    const stride = getStride(ref.sheet);
    const outputSize = resolveOutputSize(ref, stride);

    if (outputSize === TILE_SIZE) {
      // Standard 16px path — composite into master spritesheet
      const slot = GLYPH_GRID_OFFSET + i;
      const pos = { x: slot % MASTER_GRID_W, y: Math.floor(slot / MASTER_GRID_W) };
      manifest.glyphs[name] = pos;

      const sheet = await getSheet(ref.sheet);
      if (!sheet) { glyphCount++; continue; }
      composites.push({
        input: extractTile(sheet, ref.x, ref.y),
        raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
        left: pos.x * TILE_SIZE,
        top: pos.y * TILE_SIZE,
      });
      glyphCount++;
    } else {
      // Hi-res path — queue for per-stride atlas
      if (!hiResGroups.has(outputSize)) {
        hiResGroups.set(outputSize, []);
      }
      hiResGroups.get(outputSize)!.push({ name, ref, outputSize, sourceStride: stride });
      glyphCount++;
    }
  }

  // Composite 16px tiles onto a transparent canvas and write master spritesheet
  const base = sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  await base
    .composite(composites)
    .png()
    .toFile(path.join(outputDir, "master-spritesheet.png"));

  // Generate per-stride atlases for hi-res glyph groups
  const extraAtlases: string[] = [];
  const extraSheets: Record<string, string> = {};

  for (const [outputSize, entries] of hiResGroups) {
    const sheetKey = `master-${outputSize}`;
    const atlasEntries = await generateStrideAtlas(
      entries,
      outputSize,
      sheetPaths,
      outputDir,
    );

    for (const [glyphName, entry] of atlasEntries) {
      manifest.glyphs[glyphName] = entry;
    }

    extraAtlases.push(`${sheetKey}.png`);
    extraSheets[sheetKey] = `${sheetKey}.png`;
  }

  // Build the sheets record for assignments.json
  const sheetsRecord: Record<string, string> = {
    master: "master-spritesheet.png",
    ...extraSheets,
  };

  fs.writeFileSync(
    path.join(outputDir, "sprite-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  return { tileCount, glyphCount, extraAtlases, sheetsRecord };
}
