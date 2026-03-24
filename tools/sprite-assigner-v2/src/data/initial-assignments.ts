import type { SpriteRef } from "../state/assignments.ts";

interface SeedEntry { s: string; x: number; y: number }

function toRef(e: SeedEntry): SpriteRef {
  return { sheet: e.s, x: e.x, y: e.y };
}

const INITIAL_TILETYPE_SEED: Record<string, SeedEntry> = {
  FLOOR:{s:"Floor",x:15,y:13}, CARPET:{s:"Tile",x:3,y:2}, MARBLE_FLOOR:{s:"Tile",x:7,y:2},
  WALL:{s:"Wall",x:10,y:15}, TORCH_WALL:{s:"Wall",x:8,y:18}, GRANITE:{s:"Wall",x:10,y:15},
  GRASS:{s:"Ground0",x:1,y:1}, DEAD_GRASS:{s:"Ground0",x:3,y:1}, FOLIAGE:{s:"Ground0",x:0,y:1},
  DEAD_FOLIAGE:{s:"Ground0",x:2,y:1}, TRAMPLED_FOLIAGE:{s:"Ground0",x:0,y:0},
  BLOODFLOWER_STALK:{s:"Ground0",x:3,y:3}, BLOODFLOWER_POD:{s:"Ground0",x:0,y:3},
  FUNGUS_FOREST:{s:"Ground0",x:0,y:4}, TRAMPLED_FUNGUS_FOREST:{s:"Ground0",x:4,y:0},
  GRAY_FUNGUS:{s:"Ground0",x:4,y:0}, LUMINESCENT_FUNGUS:{s:"Ground0",x:5,y:0},
  LICHEN:{s:"Ground0",x:6,y:0}, HAY:{s:"Ground0",x:7,y:0},
  ANCIENT_SPIRIT_VINES:{s:"Ground0",x:4,y:3}, ANCIENT_SPIRIT_GRASS:{s:"Ground0",x:1,y:1},
  RED_BLOOD:{s:"Ground0",x:0,y:5}, GREEN_BLOOD:{s:"Ground0",x:1,y:5},
  PURPLE_BLOOD:{s:"Ground0",x:0,y:5}, ACID_SPLATTER:{s:"Ground0",x:1,y:5},
  VOMIT:{s:"Ground0",x:4,y:5}, URINE:{s:"Ground0",x:2,y:5}, UNICORN_POOP:{s:"Ground0",x:5,y:5},
  WORM_BLOOD:{s:"Ground0",x:0,y:5}, ASH:{s:"Ground0",x:6,y:5},
  BURNED_CARPET:{s:"Ground0",x:7,y:5}, PUDDLE:{s:"Ground0",x:2,y:6},
  BONES:{s:"Ground0",x:6,y:1}, RUBBLE:{s:"Ground0",x:7,y:1}, JUNK:{s:"Ground0",x:6,y:1},
  BROKEN_GLASS:{s:"Ground0",x:4,y:1}, ECTOPLASM:{s:"Ground0",x:1,y:6},
  EMBERS:{s:"Ground0",x:5,y:5}, SPIDERWEB:{s:"Decor0",x:0,y:20}, NETTING:{s:"Decor0",x:2,y:20},
  FORCEFIELD:{s:"Effect0",x:4,y:21}, FORCEFIELD_MELT:{s:"Effect0",x:3,y:21},
  SACRED_GLYPH:{s:"Effect0",x:4,y:23}, PORTAL_LIGHT:{s:"Effect0",x:5,y:21},
  GUARDIAN_GLOW:{s:"Effect0",x:7,y:22}, HAVEN_BEDROLL:{s:"Decor0",x:0,y:16},
  MANACLE_TL:{s:"Decor0",x:0,y:20}, MANACLE_BR:{s:"Decor0",x:1,y:20},
  MANACLE_TR:{s:"Decor0",x:2,y:20}, MANACLE_BL:{s:"Decor0",x:3,y:20},
  MANACLE_T:{s:"Decor0",x:0,y:20}, MANACLE_B:{s:"Decor0",x:1,y:20},
  MANACLE_L:{s:"Decor0",x:2,y:20}, MANACLE_R:{s:"Decor0",x:3,y:20},
  DEEP_WATER:{s:"Pit1",x:1,y:17}, SHALLOW_WATER:{s:"Pit1",x:2,y:16},
  LAVA:{s:"Pit1",x:1,y:18}, MUD:{s:"Ground0",x:5,y:6},
  FLOOD_WATER_DEEP:{s:"Pit1",x:1,y:29}, FLOOD_WATER_SHALLOW:{s:"Pit1",x:1,y:17},
  CHASM:{s:"Pit1",x:1,y:1}, CHASM_EDGE:{s:"Pit1",x:1,y:2},
  DOOR:{s:"Door0",x:0,y:0}, OPEN_DOOR:{s:"Door0",x:1,y:0}, LOCKED_DOOR:{s:"Door0",x:2,y:0},
  UP_STAIRS:{s:"Tile",x:6,y:3}, DOWN_STAIRS:{s:"Tile",x:7,y:3},
  DUNGEON_EXIT:{s:"Door0",x:5,y:5}, BRIDGE:{s:"Tile",x:0,y:3},
  STONE_BRIDGE:{s:"Tile",x:5,y:2}, STATUE_INERT:{s:"Decor0",x:4,y:20},
  STATUE_DORMANT:{s:"Decor0",x:4,y:20},
  PLAIN_FIRE:{s:"Effect0",x:0,y:21}, BRIMSTONE_FIRE:{s:"Effect0",x:0,y:21},
  FLAMEDANCER_FIRE:{s:"Effect0",x:1,y:21}, GAS_FIRE:{s:"Effect0",x:0,y:21},
  GAS_EXPLOSION:{s:"Effect0",x:0,y:23}, DART_EXPLOSION:{s:"Effect0",x:1,y:23},
  ITEM_FIRE:{s:"Effect0",x:0,y:21}, CREATURE_FIRE:{s:"Effect0",x:0,y:21},
  POISON_GAS:{s:"Effect0",x:0,y:24}, CONFUSION_GAS:{s:"Effect0",x:0,y:24},
  ROT_GAS:{s:"Effect0",x:3,y:24}, STENCH_SMOKE_GAS:{s:"Effect0",x:0,y:24},
  PARALYSIS_GAS:{s:"Effect0",x:0,y:24}, METHANE_GAS:{s:"Effect0",x:0,y:24},
  STEAM:{s:"Effect0",x:0,y:24}, DARKNESS_CLOUD:{s:"Effect0",x:3,y:24},
  HEALING_CLOUD:{s:"Effect0",x:1,y:24},
};

const INITIAL_GLYPH_SEED: Record<string, SeedEntry> = {
  G_FLOOR:{s:"Floor",x:16,y:14}, G_FLOOR_ALT:{s:"Floor",x:17,y:14},
  G_WALL:{s:"Wall",x:0,y:20}, G_WALL_TOP:{s:"Wall",x:2,y:19},
  G_GRASS:{s:"Floor",x:13,y:13}, G_BOG:{s:"Ground0",x:5,y:6},
  G_CHASM:{s:"Pit1",x:1,y:22}, G_LIQUID:{s:"Pit1",x:1,y:16},
  G_CLOSED_DOOR:{s:"Door0",x:0,y:0}, G_OPEN_DOOR:{s:"Door1",x:0,y:0},
  G_DOORWAY:{s:"Door1",x:0,y:0}, G_CLOSED_IRON_DOOR:{s:"Door0",x:1,y:0},
  G_OPEN_IRON_DOOR:{s:"Door1",x:1,y:0}, G_UP_STAIRS:{s:"Floor",x:1,y:0},
  G_DOWN_STAIRS:{s:"Floor",x:2,y:0}, G_PLAYER:{s:"Player0",x:0,y:0},
};

export function getInitialTileTypeAssignments(): Record<string, SpriteRef> {
  const out: Record<string, SpriteRef> = {};
  for (const [k, v] of Object.entries(INITIAL_TILETYPE_SEED)) {
    out[k] = toRef(v);
  }
  return out;
}

export function getInitialGlyphAssignments(): Record<string, SpriteRef> {
  const out: Record<string, SpriteRef> = {};
  for (const [k, v] of Object.entries(INITIAL_GLYPH_SEED)) {
    out[k] = toRef(v);
  }
  return out;
}
