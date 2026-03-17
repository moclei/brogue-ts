/*
 *  glyph-sprite-map.ts — DisplayGlyph → DawnLike sprite region for tile rendering
 *  Pixel-art smoke test — Initiative: initiatives/pixel-art-smoke-test
 *
 *  Why DisplayGlyph, not TileType?
 *  - TileType = game logic (DEEP_WATER, SHALLOW_WATER, FLOOR, etc.): what the cell *is*.
 *  - DisplayGlyph = what gets *drawn*: the small set of symbols in each display buffer cell.
 *  - The tile catalog (tile-catalog.ts) maps TileType → displayChar (DisplayGlyph). Many
 *    TileTypes share one DisplayGlyph (e.g. DEEP_WATER and lava both use G_LIQUID; colors
 *    differ). So we only map DisplayGlyphs to sprites here.
 *
 *  Each entry is a 16×16 tile index (tileX, tileY) within a sheet. Unmapped
 *  glyphs are drawn as text in the viewport (see browser-renderer).
 *
 *  How the tile grid works:
 *  - Each PNG (e.g. Floor.png) is a grid of 16×16 pixel tiles.
 *  - tileX = column index (0 = left), tileY = row index (0 = top).
 *  - tile("Floor")        → top-left tile (0, 0).
 *  - tile("Floor", 1, 0) → one tile to the right (column 1, row 0).
 *  - tile("Floor", 0, 1) → one tile down (column 0, row 1).
 *  To pick a sprite: open the PNG, count 16px columns and rows from the top-left;
 *  use that (column, row) as (tileX, tileY).
 */

import { DisplayGlyph, TileType } from "../types/enums.js";

export interface SpriteRef {
  sheetKey: string;
  tileX: number;
  tileY: number;
}

/** Build a sprite reference. Args are (sheet, column, row) — column first, then row. Default (0, 0) = top-left. */
function tile(sheetKey: string, tileX = 0, tileY = 0): SpriteRef {
  return { sheetKey, tileX, tileY };
}

/**
 * Build the TileType → sprite lookup for one-to-one terrain/feature sprites.
 * Unmapped TileTypes fall back to the DisplayGlyph-based sprite in the renderer.
 * Uses same DawnLike sheets as buildGlyphSpriteMap; pick distinct (tileX, tileY) per TileType.
 */
export function buildTileTypeSpriteMap(): Map<TileType, SpriteRef> {
  const m = new Map<TileType, SpriteRef>();

  // Floors and walls (match glyph map so fallback looks same when not overridden)
  m.set(TileType.FLOOR, tile("Floor", 16, 14));
  m.set(TileType.FLOOR_FLOODABLE, tile("Floor", 17, 14));
  m.set(TileType.CARPET, tile("Floor", 17, 14));
  m.set(TileType.MARBLE_FLOOR, tile("Floor", 16, 15));
  m.set(TileType.WALL, tile("Wall", 0, 20));
  m.set(TileType.GRANITE, tile("Wall", 1, 20));

  // Liquids — one sprite each (normally share G_LIQUID)
  m.set(TileType.DEEP_WATER, tile("Pit1", 1, 16));
  m.set(TileType.SHALLOW_WATER, tile("Pit1", 2, 16));
  m.set(TileType.LAVA, tile("Pit1", 1, 18));
  m.set(TileType.LAVA_RETRACTABLE, tile("Pit1", 1, 18));
  m.set(TileType.LAVA_RETRACTING, tile("Pit1", 2, 18));
  m.set(TileType.MUD, tile("Ground0", 8, 0));
  m.set(TileType.FLOOD_WATER_DEEP, tile("Pit1", 1, 16));
  m.set(TileType.FLOOD_WATER_SHALLOW, tile("Pit1", 2, 16));

  // Chasm
  m.set(TileType.CHASM, tile("Pit1", 1, 22));
  m.set(TileType.CHASM_EDGE, tile("Pit1", 0, 22));

  // Doors
  m.set(TileType.DOOR, tile("Door0"));
  m.set(TileType.OPEN_DOOR, tile("Door1"));
  m.set(TileType.SECRET_DOOR, tile("Door0"));
  m.set(TileType.LOCKED_DOOR, tile("Door0", 1, 0));
  m.set(TileType.OPEN_IRON_DOOR_INERT, tile("Door1", 1, 0));

  // Stairs
  m.set(TileType.UP_STAIRS, tile("Floor", 1, 0));
  m.set(TileType.DOWN_STAIRS, tile("Floor", 2, 0));

  // Vegetation / terrain variety
  m.set(TileType.GRASS, tile("Floor", 13, 13));
  m.set(TileType.FOLIAGE, tile("Floor", 14, 13));
  m.set(TileType.DEAD_FOLIAGE, tile("Floor", 15, 13));

  // Bridge
  m.set(TileType.BRIDGE, tile("Floor", 18, 14));
  m.set(TileType.STONE_BRIDGE, tile("Floor", 18, 15));

  return m;
}

/**
 * Build the glyph → sprite lookup. Unmapped glyphs return undefined;
 * the renderer draws a fallback (e.g. magenta square).
 */
export function buildGlyphSpriteMap(): Map<DisplayGlyph, SpriteRef> {
  const m = new Map<DisplayGlyph, SpriteRef>();

  // Terrain
  m.set(DisplayGlyph.G_FLOOR, tile("Floor", 16, 14));
  m.set(DisplayGlyph.G_FLOOR_ALT, tile("Floor", 17, 14));
  m.set(DisplayGlyph.G_WALL, tile("Wall", 0, 20));
  m.set(DisplayGlyph.G_WALL_TOP, tile("Wall", 2, 19));
  m.set(DisplayGlyph.G_GRASS, tile("Floor", 13, 13));
  m.set(DisplayGlyph.G_BOG, tile("Ground0", 8, 0));
  m.set(DisplayGlyph.G_CHASM, tile("Pit1", 1, 22));
  m.set(DisplayGlyph.G_LIQUID, tile("Pit1", 1, 16));

  // Doors
  m.set(DisplayGlyph.G_CLOSED_DOOR, tile("Door0"));
  m.set(DisplayGlyph.G_OPEN_DOOR, tile("Door1"));
  m.set(DisplayGlyph.G_DOORWAY, tile("Door1"));
  m.set(DisplayGlyph.G_CLOSED_IRON_DOOR, tile("Door0", 1, 0));
  m.set(DisplayGlyph.G_OPEN_IRON_DOOR, tile("Door1", 1, 0));

  // Stairs (use Floor variant or Ground — DawnLike may have dedicated tile)
  m.set(DisplayGlyph.G_UP_STAIRS, tile("Floor", 1, 0));
  m.set(DisplayGlyph.G_DOWN_STAIRS, tile("Floor", 2, 0));

  // Player
  m.set(DisplayGlyph.G_PLAYER, tile("Player0"));

  return m;
}
