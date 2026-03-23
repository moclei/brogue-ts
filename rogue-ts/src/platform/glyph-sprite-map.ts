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
import { getConnectionGroupInfo, AUTOTILE_VARIANT_COUNT } from "./autotile.js";

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

  m.set(TileType.GRANITE, tile("TheRoguelike", 8, 21));
  m.set(TileType.FLOOR, tile("TheRoguelike", 7, 10));
  m.set(TileType.FLOOR_FLOODABLE, tile("TheRoguelike", 17, 10));
  m.set(TileType.CARPET, tile("DD_Interior", 5, 31));
  m.set(TileType.MARBLE_FLOOR, tile("DD_Interior", 9, 43));
  m.set(TileType.WALL, tile("TheRoguelike", 20, 21));
  m.set(TileType.DOOR, tile("TheRoguelike", 16, 22));
  m.set(TileType.OPEN_DOOR, tile("TheRoguelike", 10, 22));
  m.set(TileType.SECRET_DOOR, tile("TheRoguelike", 20, 21));
  m.set(TileType.LOCKED_DOOR, tile("TheRoguelike", 29, 22));
  m.set(TileType.OPEN_IRON_DOOR_INERT, tile("TheRoguelike", 34, 20));
  m.set(TileType.DOWN_STAIRS, tile("DD_Interior", 1, 10));
  m.set(TileType.UP_STAIRS, tile("DD_Interior", 0, 10));
  m.set(TileType.DUNGEON_EXIT, tile("TheRoguelike", 13, 23));
  m.set(TileType.DUNGEON_PORTAL, tile("TheRoguelike", 24, 23));
  m.set(TileType.TORCH_WALL, tile("TheRoguelike", 18, 21));
  m.set(TileType.CRYSTAL_WALL, tile("Wall", 3, 30));
  m.set(TileType.PORTCULLIS_CLOSED, tile("Door0", 0, 2));
  m.set(TileType.PORTCULLIS_DORMANT, tile("Door0", 0, 3));
  m.set(TileType.WOODEN_BARRICADE, tile("TheRoguelike", 41, 22));
  m.set(TileType.PILOT_LIGHT_DORMANT, tile("DD_Dungeon", 2, 18));
  m.set(TileType.PILOT_LIGHT, tile("DD_Dungeon", 0, 18));
  m.set(TileType.HAUNTED_TORCH_DORMANT, tile("DD_Cave", 1, 10));
  m.set(TileType.HAUNTED_TORCH_TRANSITIONING, tile("DD_Cave", 3, 10));
  m.set(TileType.HAUNTED_TORCH, tile("DD_Cave", 3, 9));
  m.set(TileType.WALL_LEVER_HIDDEN, tile("TheRoguelike", 20, 21));
  m.set(TileType.WALL_LEVER, tile("TheRoguelike", 16, 21));
  m.set(TileType.WALL_LEVER_PULLED, tile("TheRoguelike", 16, 21));
  m.set(TileType.WALL_LEVER_HIDDEN_DORMANT, tile("TheRoguelike", 20, 21));
  m.set(TileType.STATUE_INERT, tile("DD_Full", 4, 65));
  m.set(TileType.STATUE_DORMANT, tile("DD_Full", 5, 65));
  m.set(TileType.STATUE_CRACKING, tile("DD_Full", 6, 65));
  m.set(TileType.STATUE_INSTACRACK, tile("DD_Full", 6, 65));
  m.set(TileType.PORTAL, tile("TheRoguelike", 11, 23));
  m.set(TileType.TURRET_DORMANT, tile("TheRoguelike", 4, 21));
  m.set(TileType.WALL_MONSTER_DORMANT, tile("TheRoguelike", 20, 21));
  m.set(TileType.DARK_FLOOR_DORMANT, tile("TheRoguelike", 7, 9));
  m.set(TileType.DARK_FLOOR_DARKENING, tile("TheRoguelike", 8, 9));
  m.set(TileType.DARK_FLOOR, tile("TheRoguelike", 6, 9));
  m.set(TileType.MACHINE_TRIGGER_FLOOR, tile("TheRoguelike", 8, 10));
  m.set(TileType.ALTAR_INERT, tile("TheRoguelike", 41, 25));
  m.set(TileType.ALTAR_KEYHOLE, tile("TheRoguelike", 41, 25));
  m.set(TileType.ALTAR_CAGE_OPEN, tile("Decor0", 0, 21));
  m.set(TileType.ALTAR_CAGE_CLOSED, tile("Decor0", 1, 21));
  m.set(TileType.ALTAR_SWITCH, tile("DD_Full", 0, 24));
  m.set(TileType.ALTAR_SWITCH_RETRACTING, tile("DD_Full", 1, 24));
  m.set(TileType.ALTAR_CAGE_RETRACTABLE, tile("Decor0", 1, 21));
  m.set(TileType.PEDESTAL, tile("Decor0", 0, 21));
  m.set(TileType.MONSTER_CAGE_OPEN, tile("TheRoguelike", 60, 27));
  m.set(TileType.MONSTER_CAGE_CLOSED, tile("TheRoguelike", 62, 27));
  m.set(TileType.COFFIN_CLOSED, tile("TheRoguelike", 84, 23));
  m.set(TileType.COFFIN_OPEN, tile("TheRoguelike", 85, 23));
  m.set(TileType.GAS_TRAP_POISON, tile("Raven_Icons", 3, 64));
  m.set(TileType.TRAP_DOOR, tile("Raven_Icons", 3, 66));
  m.set(TileType.GAS_TRAP_PARALYSIS, tile("Raven_Icons", 3, 62));
  m.set(TileType.MACHINE_PARALYSIS_VENT, tile("Raven_Icons", 9, 33));
  m.set(TileType.GAS_TRAP_CONFUSION, tile("Raven_Icons", 3, 61));
  m.set(TileType.FLAMETHROWER, tile("Raven_Icons", 9, 17));
  m.set(TileType.FLOOD_TRAP, tile("Raven_Icons", 3, 60));
  m.set(TileType.NET_TRAP, tile("Raven_Icons", 3, 67));
  m.set(TileType.ALARM_TRAP, tile("Raven_Icons", 3, 57));
  m.set(TileType.MACHINE_POISON_GAS_VENT_DORMANT, tile("Raven_Icons", 9, 34));
  m.set(TileType.MACHINE_POISON_GAS_VENT, tile("Raven_Icons", 9, 34));
  m.set(TileType.MACHINE_METHANE_VENT_DORMANT, tile("Raven_Icons", 9, 34));
  m.set(TileType.MACHINE_METHANE_VENT, tile("Raven_Icons", 9, 34));
  m.set(TileType.STEAM_VENT, tile("Raven_Icons", 6, 51));
  m.set(TileType.MACHINE_PRESSURE_PLATE, tile("Raven_Icons", 4, 67));
  m.set(TileType.MACHINE_PRESSURE_PLATE_USED, tile("Raven_Icons", 5, 67));
  m.set(TileType.MACHINE_GLYPH, tile("TheRoguelike", 62, 41));
  m.set(TileType.MACHINE_GLYPH_INACTIVE, tile("TheRoguelike", 61, 41));
  m.set(TileType.DEWAR_CAUSTIC_GAS, tile("Raven_Icons", 12, 39));
  m.set(TileType.DEWAR_CONFUSION_GAS, tile("Raven_Icons", 11, 43));
  m.set(TileType.DEWAR_PARALYSIS_GAS, tile("Raven_Icons", 11, 43));
  m.set(TileType.DEWAR_METHANE_GAS, tile("Raven_Icons", 11, 42));
  m.set(TileType.DEEP_WATER, tile("TheRoguelike", 65, 13));
  m.set(TileType.SHALLOW_WATER, tile("TheRoguelike", 4, 13));
  m.set(TileType.MUD, tile("TheRoguelike", 54, 10));
  m.set(TileType.CHASM, tile("GUI0", 2, 14));
  m.set(TileType.CHASM_EDGE, tile("DD_Full", 2, 16));
  m.set(TileType.MACHINE_COLLAPSE_EDGE_DORMANT, tile("DD_Full", 9));
  m.set(TileType.MACHINE_COLLAPSE_EDGE_SPREADING, tile("DD_Full", 9, 1));
  m.set(TileType.LAVA, tile("TheRoguelike", 13, 13));
  m.set(TileType.LAVA_RETRACTABLE, tile("TheRoguelike", 13, 13));
  m.set(TileType.LAVA_RETRACTING, tile("TheRoguelike", 11, 13));
  m.set(TileType.ACTIVE_BRIMSTONE, tile("TheRoguelike", 11, 9));
  m.set(TileType.INERT_BRIMSTONE, tile("TheRoguelike", 8, 9));
  m.set(TileType.OBSIDIAN, tile("TheRoguelike", 24, 9));
  m.set(TileType.BRIDGE, tile("TheRoguelike", 69, 10));
  m.set(TileType.BRIDGE_FALLING, tile("TheRoguelike", 65, 10));
  m.set(TileType.BRIDGE_EDGE, tile("TheRoguelike", 65, 10));
  m.set(TileType.STONE_BRIDGE, tile("TheRoguelike", 66, 10));
  m.set(TileType.MACHINE_FLOOD_WATER_DORMANT, tile("TheRoguelike", 74, 13));
  m.set(TileType.MACHINE_FLOOD_WATER_SPREADING, tile("TheRoguelike", 70, 13));
  m.set(TileType.MACHINE_MUD_DORMANT, tile("TheRoguelike", 68, 13));
  m.set(TileType.ICE_DEEP, tile("TheRoguelike", 69, 13));
  m.set(TileType.ICE_DEEP_MELT, tile("TheRoguelike", 70, 13));
  m.set(TileType.ICE_SHALLOW, tile("TheRoguelike", 71, 13));
  m.set(TileType.ICE_SHALLOW_MELT, tile("TheRoguelike", 72, 13));
  m.set(TileType.HOLE, tile("TheRoguelike", 11, 15));
  m.set(TileType.HOLE_GLOW, tile("TheRoguelike", 24, 15));
  m.set(TileType.FLOOD_WATER_DEEP, tile("TheRoguelike", 65, 13));
  m.set(TileType.FLOOD_WATER_SHALLOW, tile("TheRoguelike", 67, 13));
  m.set(TileType.GRASS, tile("TheRoguelike", 4, 5));
  m.set(TileType.DEAD_GRASS, tile("TheRoguelike", 11, 5));
  m.set(TileType.GRAY_FUNGUS, tile("TheRoguelike", 9, 5));
  m.set(TileType.LUMINESCENT_FUNGUS, tile("TheRoguelike", 6, 5));
  m.set(TileType.LICHEN, tile("TheRoguelike", 10, 5));
  m.set(TileType.HAY, tile("TheRoguelike", 29, 5));
  m.set(TileType.RED_BLOOD, tile("DD_Full", 2, 37));
  m.set(TileType.GREEN_BLOOD, tile("DD_Full", 1, 38));
  m.set(TileType.PURPLE_BLOOD, tile("DD_Full", 1, 37));
  m.set(TileType.ACID_SPLATTER, tile("TheRoguelike", 56, 13));
  m.set(TileType.VOMIT, tile("TheRoguelike", 54, 13));
  m.set(TileType.URINE, tile("TheRoguelike", 19, 9));
  m.set(TileType.UNICORN_POOP, tile("TheRoguelike", 9, 7));
  m.set(TileType.WORM_BLOOD, tile("Ground0", 0, 5));
  m.set(TileType.ASH, tile("TheRoguelike", 9, 9));
  m.set(TileType.BURNED_CARPET, tile("TheRoguelike", 31, 10));
  m.set(TileType.PUDDLE, tile("TheRoguelike", 18, 13));
  m.set(TileType.BONES, tile("TheRoguelike", 9, 27));
  m.set(TileType.RUBBLE, tile("TheRoguelike", 4, 10));
  m.set(TileType.JUNK, tile("Decor0", 0, 2));
  m.set(TileType.BROKEN_GLASS, tile("Decor0", 3, 2));
  m.set(TileType.ECTOPLASM, tile("Ground0", 1, 6));
  m.set(TileType.EMBERS, tile("TheRoguelike", 29, 23));
  m.set(TileType.SPIDERWEB, tile("DD_Full", 0, 13));
  m.set(TileType.NETTING, tile("DD_Full", 22, 18));
  m.set(TileType.FOLIAGE, tile("TheRoguelike", 8, 6));
  m.set(TileType.DEAD_FOLIAGE, tile("TheRoguelike", 11, 6));
  m.set(TileType.TRAMPLED_FOLIAGE, tile("TheRoguelike", 11, 10));
  m.set(TileType.FUNGUS_FOREST, tile("TheRoguelike", 29, 4));
  m.set(TileType.TRAMPLED_FUNGUS_FOREST, tile("TheRoguelike", 29, 9));
  m.set(TileType.FORCEFIELD, tile("TheRoguelike", 101, 22));
  m.set(TileType.FORCEFIELD_MELT, tile("TheRoguelike", 102, 22));
  m.set(TileType.SACRED_GLYPH, tile("Effect1", 7, 23));
  m.set(TileType.MANACLE_TL, tile("Effect1", 6, 20));
  m.set(TileType.MANACLE_BR, tile("Effect1", 2, 20));
  m.set(TileType.MANACLE_TR, tile("Effect1", 7, 20));
  m.set(TileType.MANACLE_BL, tile("Effect1", 3, 20));
  m.set(TileType.MANACLE_T, tile("Effect1", 4, 20));
  m.set(TileType.MANACLE_B, tile("Effect1", 0, 20));
  m.set(TileType.MANACLE_L, tile("Effect1", 5, 20));
  m.set(TileType.MANACLE_R, tile("Effect1", 1, 20));
  m.set(TileType.PORTAL_LIGHT, tile("Door1", 3, 5));
  m.set(TileType.GUARDIAN_GLOW, tile("Effect0", 7, 22));
  m.set(TileType.PLAIN_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.BRIMSTONE_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.FLAMEDANCER_FIRE, tile("Effect0", 1, 21));
  m.set(TileType.GAS_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.GAS_EXPLOSION, tile("Effect0", 0, 23));
  m.set(TileType.DART_EXPLOSION, tile("Effect0", 1, 23));
  m.set(TileType.ITEM_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.CREATURE_FIRE, tile("Effect0", 0, 21));
  m.set(TileType.POISON_GAS, tile("Effect0", 0, 24));
  m.set(TileType.CONFUSION_GAS, tile("Effect0", 0, 24));
  m.set(TileType.ROT_GAS, tile("Effect0", 3, 24));
  m.set(TileType.STENCH_SMOKE_GAS, tile("Effect0", 0, 24));
  m.set(TileType.PARALYSIS_GAS, tile("Effect0", 0, 24));
  m.set(TileType.METHANE_GAS, tile("Effect0", 0, 24));
  m.set(TileType.STEAM, tile("Effect0", 0, 24));
  m.set(TileType.DARKNESS_CLOUD, tile("Effect0", 3, 24));
  m.set(TileType.HEALING_CLOUD, tile("Effect0", 1, 24));
  m.set(TileType.BLOODFLOWER_STALK, tile("TheRoguelike", 98, 3));
  m.set(TileType.BLOODFLOWER_POD, tile("TheRoguelike", 5, 7));
  m.set(TileType.HAVEN_BEDROLL, tile("TheRoguelike", 30, 38));
  m.set(TileType.DEEP_WATER_ALGAE_WELL, tile("TheRoguelike", 5, 13));
  m.set(TileType.DEEP_WATER_ALGAE_1, tile("TheRoguelike", 11, 13));
  m.set(TileType.DEEP_WATER_ALGAE_2, tile("TheRoguelike", 11, 13));
  m.set(TileType.ANCIENT_SPIRIT_VINES, tile("TheRoguelike", 24, 5));
  m.set(TileType.ANCIENT_SPIRIT_GRASS, tile("TheRoguelike", 25, 5));
  m.set(TileType.AMULET_SWITCH, tile("DD_Items", 8, 4));
  m.set(TileType.COMMUTATION_ALTAR, tile("DD_Interior", 7, 12));
  m.set(TileType.COMMUTATION_ALTAR_INERT, tile("DD_Interior", 0, 12));
  m.set(TileType.PIPE_GLOWING, tile("TheRoguelike", 100, 23));
  m.set(TileType.PIPE_INERT, tile("TheRoguelike", 101, 23));
  m.set(TileType.RESURRECTION_ALTAR, tile("TheRoguelike", 101, 25));
  m.set(TileType.RESURRECTION_ALTAR_INERT, tile("TheRoguelike", 101, 25));
  m.set(TileType.SACRIFICE_ALTAR, tile("TheRoguelike", 101, 25));
  m.set(TileType.SACRIFICE_LAVA, tile("TheRoguelike", 13, 13));
  m.set(TileType.SACRIFICE_CAGE_DORMANT, tile("TheRoguelike", 24, 15));
  m.set(TileType.DEMONIC_STATUE, tile("TheRoguelike", 13, 34));
  m.set(TileType.MUD_FLOOR, tile("Floor", 15, 10));
  m.set(TileType.MUD_WALL, tile("Wall", 15, 18));
  m.set(TileType.MUD_DOORWAY, tile("TheRoguelike", 55, 22));

  return m;
}

/**
 * Build a 47-element variant array from an 8×6 spritesheet grid.
 * Grid is indexed left-to-right, top-to-bottom by variant index.
 */
function autotileVariants(sheetKey: string): SpriteRef[] {
  const variants: SpriteRef[] = [];
  for (let v = 0; v < AUTOTILE_VARIANT_COUNT; v++) {
    variants.push({ sheetKey, tileX: v % 8, tileY: Math.floor(v / 8) });
  }
  return variants;
}

/**
 * Autotile spritesheets keyed by connection group name. When a sheet
 * exists for a group, wall-like TileTypes in that group use its 47
 * variants. Types in AUTOTILE_SKIP keep their own sprite — they
 * participate in the connection group (so neighbors see them as
 * connected) but render with their distinct sprite, not the autotile
 * sheet.
 */
const AUTOTILE_SHEETS: Record<string, string> = {
  WALL: "WallAutotile",
};

const AUTOTILE_SKIP = new Set<TileType>([
  TileType.DOOR,
  TileType.OPEN_DOOR,
  TileType.LOCKED_DOOR,
  TileType.PORTCULLIS_CLOSED,
  TileType.PORTCULLIS_DORMANT,
  TileType.WOODEN_BARRICADE,
  TileType.MUD_DOORWAY,
  TileType.TURRET_DORMANT,
  TileType.OPEN_IRON_DOOR_INERT,
]);

/**
 * Build the autotile variant map: for each connectable TileType that has a
 * tileTypeSpriteMap entry, create a 47-element array. If an autotile
 * spritesheet exists for the type's connection group, use distinct
 * per-variant refs from the sheet. Types in AUTOTILE_SKIP get placeholder
 * fills so they keep their own sprite. Remaining types without a sheet
 * also get placeholder fills.
 */
export function buildAutotileVariantMap(
  tileTypeSpriteMap: Map<TileType, SpriteRef>,
): Map<TileType, SpriteRef[]> {
  const map = new Map<TileType, SpriteRef[]>();
  const sheetCache = new Map<string, SpriteRef[]>();
  for (const [tileType, spriteRef] of tileTypeSpriteMap) {
    const groupInfo = getConnectionGroupInfo(tileType);
    if (!groupInfo) continue;
    const sheetKey = AUTOTILE_SHEETS[groupInfo.group];
    if (sheetKey && !AUTOTILE_SKIP.has(tileType)) {
      let variants = sheetCache.get(sheetKey);
      if (!variants) {
        variants = autotileVariants(sheetKey);
        sheetCache.set(sheetKey, variants);
      }
      map.set(tileType, variants);
    } else {
      map.set(tileType, new Array<SpriteRef>(AUTOTILE_VARIANT_COUNT).fill(spriteRef));
    }
  }
  return map;
}

/**
 * Build the glyph → sprite lookup. Unmapped glyphs return undefined;
 * the renderer draws a fallback (e.g. magenta square).
 */
export function buildGlyphSpriteMap(): Map<DisplayGlyph, SpriteRef> {
  const m = new Map<DisplayGlyph, SpriteRef>();

  // Terrain
  m.set(DisplayGlyph.G_GRASS, tile("Floor", 13, 13));
  m.set(DisplayGlyph.G_WALL, tile("Wall", 0, 20));
  m.set(DisplayGlyph.G_OPEN_DOOR, tile("Door1"));
  m.set(DisplayGlyph.G_CLOSED_DOOR, tile("Door0"));
  m.set(DisplayGlyph.G_BOG, tile("Ground0", 5, 6));
  m.set(DisplayGlyph.G_UP_STAIRS, tile("Floor", 1));
  m.set(DisplayGlyph.G_DOWN_STAIRS, tile("Floor", 2));
  m.set(DisplayGlyph.G_PLAYER, tile("Player0"));
  m.set(DisplayGlyph.G_ARMOR, tile("Raven_Icons", 4, 233));
  m.set(DisplayGlyph.G_STAFF, tile("Raven_Icons", 7, 173));
  m.set(DisplayGlyph.G_GOBLIN, tile("Player0", 0, 12));
  m.set(DisplayGlyph.G_KOBOLD, tile("Player0", 0, 14));
  m.set(DisplayGlyph.G_MONKEY, tile("Humanoid1", 1, 14));
  m.set(DisplayGlyph.G_RAT, tile("Rodent0", 1, 2));
  m.set(DisplayGlyph.G_LIQUID, tile("Pit1", 1, 16));
  m.set(DisplayGlyph.G_FLOOR, tile("Floor", 16, 14));
  m.set(DisplayGlyph.G_CHASM, tile("Pit1", 1, 22));
  m.set(DisplayGlyph.G_SCROLL, tile("Raven_Icons", 7, 12));
  m.set(DisplayGlyph.G_RING, tile("Raven_Icons", 2, 339));
  m.set(DisplayGlyph.G_WEAPON, tile("Raven_Icons", 8, 142));
  m.set(DisplayGlyph.G_DOORWAY, tile("Door1"));
  m.set(DisplayGlyph.G_CHARM, tile("Raven_Icons", 1, 336));
  m.set(DisplayGlyph.G_WALL_TOP, tile("Wall", 2, 19));
  m.set(DisplayGlyph.G_FLOOR_ALT, tile("Floor", 17, 14));
  m.set(DisplayGlyph.G_WAND, tile("Raven_Icons", 5, 173));
  m.set(DisplayGlyph.G_CLOSED_IRON_DOOR, tile("Door0", 1));
  m.set(DisplayGlyph.G_OPEN_IRON_DOOR, tile("Door1", 1));
  m.set(DisplayGlyph.G_JACKAL, tile("Quadraped0", 2, 5));

  // Player
  m.set(DisplayGlyph.G_PLAYER, tile("DD_Full", 34, 60));

  return m;
}
