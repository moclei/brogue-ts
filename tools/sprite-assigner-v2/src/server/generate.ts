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
}

export interface SavePayload {
  tiletype: Record<string, SpriteRef>;
  glyph: Record<string, SpriteRef>;
}

export interface GenerateResult {
  tileCount: number;
  glyphCount: number;
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

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

type Composite = {
  input: Buffer;
  raw: { width: number; height: number; channels: 4 };
  left: number;
  top: number;
};

/**
 * Generate `master-spritesheet.png` and `sprite-manifest.json` from the
 * given assignments and write them to `outputDir`.
 *
 * @param payload   TileType + DisplayGlyph assignments from the UI
 * @param sheetPaths  Map of sheet key → absolute PNG path on disk
 * @param outputDir   Directory to write the output files into
 */
export async function generateMasterSheet(
  payload: SavePayload,
  sheetPaths: Map<string, string>,
  outputDir: string,
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

  const manifest = {
    tileSize: TILE_SIZE,
    gridWidth: MASTER_GRID_W,
    gridHeight: MASTER_GRID_H,
    tiles: {} as Record<string, { x: number; y: number }>,
    glyphs: {} as Record<string, { x: number; y: number }>,
  };

  // TileType entries — grid position determined by enum index
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

  // DisplayGlyph entries — offset into the grid after TileType rows
  let glyphCount = 0;
  for (let i = 0; i < DISPLAY_GLYPHS.length; i++) {
    const name = DISPLAY_GLYPHS[i];
    if (!name) continue;
    const ref = payload.glyph[name];
    if (!ref) continue;

    const slot = GLYPH_GRID_OFFSET + i;
    const pos = { x: slot % MASTER_GRID_W, y: Math.floor(slot / MASTER_GRID_W) };
    manifest.glyphs[name] = pos;

    const sheet = await getSheet(ref.sheet);
    if (!sheet) continue;
    composites.push({
      input: extractTile(sheet, ref.x, ref.y),
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
      left: pos.x * TILE_SIZE,
      top: pos.y * TILE_SIZE,
    });
    glyphCount++;
  }

  // Composite onto a transparent canvas and write to disk
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

  fs.writeFileSync(
    path.join(outputDir, "sprite-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  return { tileCount, glyphCount };
}
