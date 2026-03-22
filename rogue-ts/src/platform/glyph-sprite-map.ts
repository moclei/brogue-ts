/*
 *  glyph-sprite-map.ts — DisplayGlyph/TileType → DawnLike sprite region for tile rendering
 *  brogue-ts
 *
 *  Two map types:
 *  - DisplayGlyph → SpriteRef: fallback for glyphs without a TileType-specific sprite.
 *  - TileType → SpriteRef: one-to-one terrain/feature sprites (preferred by the renderer).
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
  m.set(TileType.FLOOR, tile("Floor", 15, 13));
  m.set(TileType.CARPET, tile("Tile", 3, 2));
  m.set(TileType.MARBLE_FLOOR, tile("Tile", 7, 2));
  m.set(TileType.WALL, tile("Wall", 10, 15));
  m.set(TileType.TORCH_WALL, tile("Wall", 8, 18));
  m.set(TileType.GRANITE, tile("Wall", 10, 15));

  // Vegetation / terrain variety
  m.set(TileType.GRASS, tile("Ground0", 1, 1));
  m.set(TileType.DEAD_GRASS, tile("Ground0", 3, 1));
  m.set(TileType.FOLIAGE, tile("Ground0", 0, 1));
  m.set(TileType.DEAD_FOLIAGE, tile("Ground0", 2, 1));
  m.set(TileType.TRAMPLED_FOLIAGE, tile("Ground0", 0, 0));
  m.set(TileType.BLOODFLOWER_STALK, tile("Ground0", 3, 3));
  m.set(TileType.BLOODFLOWER_POD, tile("Ground0", 0, 3));
  m.set(TileType.FUNGUS_FOREST, tile("Ground0", 0, 4));
  m.set(TileType.TRAMPLED_FUNGUS_FOREST, tile("Ground0", 4, 0));
  m.set(TileType.GRAY_FUNGUS, tile("Ground0", 4, 0));
  m.set(TileType.LUMINESCENT_FUNGUS, tile("Ground0", 5, 0));
  m.set(TileType.LICHEN, tile("Ground0", 6, 0));
  m.set(TileType.HAY, tile("Ground0", 7, 0));
  m.set(TileType.ANCIENT_SPIRIT_VINES, tile("Ground0", 4, 3));
  m.set(TileType.ANCIENT_SPIRIT_GRASS, tile("Ground0", 1, 1));

  // Surface debris / blood / splatter
  m.set(TileType.RED_BLOOD, tile("Ground0", 0, 5));
  m.set(TileType.GREEN_BLOOD, tile("Ground0", 1, 5));
  m.set(TileType.PURPLE_BLOOD, tile("Ground0", 0, 5));
  m.set(TileType.ACID_SPLATTER, tile("Ground0", 1, 5));
  m.set(TileType.VOMIT, tile("Ground0", 4, 5));
  m.set(TileType.URINE, tile("Ground0", 2, 5));
  m.set(TileType.UNICORN_POOP, tile("Ground0", 5, 5));
  m.set(TileType.WORM_BLOOD, tile("Ground0", 0, 5));
  m.set(TileType.ASH, tile("Ground0", 6, 5));
  m.set(TileType.BURNED_CARPET, tile("Ground0", 7, 5));
  m.set(TileType.PUDDLE, tile("Ground0", 2, 6));
  m.set(TileType.BONES, tile("Ground0", 6, 1));
  m.set(TileType.RUBBLE, tile("Ground0", 7, 1));
  m.set(TileType.JUNK, tile("Ground0", 6, 1));
  m.set(TileType.BROKEN_GLASS, tile("Ground0", 4, 1));
  m.set(TileType.ECTOPLASM, tile("Ground0", 1, 6));
  m.set(TileType.EMBERS, tile("Ground0", 5, 5));

  // Web / netting / cobweb
  m.set(TileType.SPIDERWEB, tile("Decor0", 0, 20));
  m.set(TileType.NETTING, tile("Decor0", 2, 20));

  // Energy / magical surface effects
  m.set(TileType.FORCEFIELD, tile("Effect0", 4, 21));
  m.set(TileType.FORCEFIELD_MELT, tile("Effect0", 3, 21));
  m.set(TileType.SACRED_GLYPH, tile("Effect0", 4, 23));
  m.set(TileType.PORTAL_LIGHT, tile("Effect0", 5, 21));
  m.set(TileType.GUARDIAN_GLOW, tile("Effect0", 7, 22));
  m.set(TileType.HAVEN_BEDROLL, tile("Decor0", 0, 16));

  // Manacles — chain segments at cell borders (placeholder: cobweb corners)
  m.set(TileType.MANACLE_TL, tile("Decor0", 0, 20));
  m.set(TileType.MANACLE_BR, tile("Decor0", 1, 20));
  m.set(TileType.MANACLE_TR, tile("Decor0", 2, 20));
  m.set(TileType.MANACLE_BL, tile("Decor0", 3, 20));
  m.set(TileType.MANACLE_T, tile("Decor0", 0, 20));
  m.set(TileType.MANACLE_B, tile("Decor0", 1, 20));
  m.set(TileType.MANACLE_L, tile("Decor0", 2, 20));
  m.set(TileType.MANACLE_R, tile("Decor0", 3, 20));

  // Liquids — one sprite each (normally share G_LIQUID)
  m.set(TileType.DEEP_WATER, tile("Pit1", 1, 17));
  m.set(TileType.SHALLOW_WATER, tile("Pit1", 2, 16));
  m.set(TileType.LAVA, tile("Pit1", 1, 18));
  m.set(TileType.MUD, tile("Ground0", 5, 6));
  m.set(TileType.FLOOD_WATER_DEEP, tile("Pit1", 1, 29));
  m.set(TileType.FLOOD_WATER_SHALLOW, tile("Pit1", 1, 17));

  // Chasm
  m.set(TileType.CHASM, tile("Pit1", 1, 1));
  m.set(TileType.CHASM_EDGE, tile("Pit1", 1, 2));

  // Doors
  m.set(TileType.DOOR, tile("Door0", 0, 0));
  m.set(TileType.OPEN_DOOR, tile("Door0", 1, 0));
  m.set(TileType.LOCKED_DOOR, tile("Door0", 2, 0));

  // Stairs
  m.set(TileType.UP_STAIRS, tile("Tile", 6, 3));
  m.set(TileType.DOWN_STAIRS, tile("Tile", 7, 3));
  m.set(TileType.DUNGEON_EXIT, tile("Door0", 5, 5));

  // Bridge
  m.set(TileType.BRIDGE, tile("Tile", 0, 3));
  m.set(TileType.STONE_BRIDGE, tile("Tile", 5, 2));

  // Misc Items
  m.set(TileType.STATUE_INERT, tile("Decor0", 4, 20));
  m.set(TileType.STATUE_DORMANT, tile("Decor0", 4, 20));

  // Fire — flame sprites from Effect0, differentiated by per-layer tinting
  m.set(TileType.PLAIN_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.BRIMSTONE_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.FLAMEDANCER_FIRE, tile("Effect0", 1, 21));
  m.set(TileType.GAS_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.GAS_EXPLOSION, tile("Effect0", 0, 23));
  m.set(TileType.DART_EXPLOSION, tile("Effect0", 1, 23));
  m.set(TileType.ITEM_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.CREATURE_FIRE, tile("Effect0", 0, 21));

  // Gas — cloud sprites from Effect0, differentiated by per-layer tinting
  m.set(TileType.POISON_GAS, tile("Effect0", 0, 24));
  m.set(TileType.CONFUSION_GAS, tile("Effect0", 0, 24));
  m.set(TileType.ROT_GAS, tile("Effect0", 3, 24));
  m.set(TileType.STENCH_SMOKE_GAS, tile("Effect0", 0, 24));
  m.set(TileType.PARALYSIS_GAS, tile("Effect0", 0, 24));
  m.set(TileType.METHANE_GAS, tile("Effect0", 0, 24));
  m.set(TileType.STEAM, tile("Effect0", 0, 24));
  m.set(TileType.DARKNESS_CLOUD, tile("Effect0", 3, 24));
  m.set(TileType.HEALING_CLOUD, tile("Effect0", 1, 24));

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
  m.set(DisplayGlyph.G_BOG, tile("Ground0", 5, 6));
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
