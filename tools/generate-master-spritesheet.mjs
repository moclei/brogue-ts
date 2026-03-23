#!/usr/bin/env node
/**
 * generate-master-spritesheet.mjs — Build the packed master spritesheet +
 * manifest from current sprite assignments.
 *
 * Usage (from project root):
 *   node tools/generate-master-spritesheet.mjs
 *
 * Outputs:
 *   rogue-ts/assets/tilesets/master-spritesheet.png   (384×240, 24×15 grid of 16×16 tiles)
 *   rogue-ts/assets/tilesets/sprite-manifest.json
 *
 * Grid layout:
 *   Rows 0–8:  TileType slots 0–214 (215 entries, 1 empty cell at 23,8)
 *   Rows 9–14: DisplayGlyph slots 128–258 (131 entries, 13 empty cells)
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const require = createRequire(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../rogue-ts/package.json"),
);
const sharp = require("sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.resolve(__dirname, "../rogue-ts/assets/tilesets");

const TILE_SIZE = 16;
const GRID_W = 24;
const GRID_H = 15;
const SHEET_W = GRID_W * TILE_SIZE; // 384
const SHEET_H = GRID_H * TILE_SIZE; // 240
const GLYPH_GRID_OFFSET = 216; // 24 * 9 — first glyph slot
const GLYPH_ENUM_START = 128; // DisplayGlyph.G_UP_ARROW

// ---------------------------------------------------------------------------
// Source sheet paths (relative to ASSETS)
// ---------------------------------------------------------------------------

const SHEET_PATHS = {
  Floor: "dawnlike/Objects/Floor.png",
  Wall: "dawnlike/Objects/Wall.png",
  Door0: "dawnlike/Objects/Door0.png",
  Door1: "dawnlike/Objects/Door1.png",
  Ground0: "dawnlike/Objects/Ground0.png",
  Player0: "dawnlike/Characters/Player0.png",
  Tile: "dawnlike/Objects/Tile.png",
  Pit1: "dawnlike/Objects/Pit1.png",
  Decor0: "dawnlike/Objects/Decor0.png",
  Effect0: "dawnlike/Objects/Effect0.png",
  Effect1: "dawnlike/Objects/Effect1.png",
  GUI0: "dawnlike/GUI/GUI0.png",
  TheRoguelike: "the-roguelike/the-roguelike.png",
  DD_Full: "DemonicDungeon/No-Background/Full.png",
  DD_Dungeon: "DemonicDungeon/No-Background/Dungeon.png",
  DD_Cave: "DemonicDungeon/No-Background/Cave.png",
  DD_Items: "DemonicDungeon/No-Background/Items.png",
  DD_Interior: "DemonicDungeon/interior/No-Background/Full.png",
  Raven_Icons: "raven/icons_dark.png",
  Raven_Potions: "raven/potions.png",
  Rodent0: "dawnlike/Characters/Rodent0.png",
  Humanoid1: "dawnlike/Characters/Humanoid1.png",
  Quadraped0: "dawnlike/Characters/Quadraped0.png",
};

// ---------------------------------------------------------------------------
// TileType assignments — mirrors buildTileTypeSpriteMap() in glyph-sprite-map.ts
// Key = TileType enum name, value = source sheet + tile coords
// Enum values are sequential starting at NOTHING=0.
// ---------------------------------------------------------------------------

const TILETYPE_NAMES = [
  "NOTHING","GRANITE","FLOOR","FLOOR_FLOODABLE","CARPET","MARBLE_FLOOR",
  "WALL","DOOR","OPEN_DOOR","SECRET_DOOR","LOCKED_DOOR","OPEN_IRON_DOOR_INERT",
  "DOWN_STAIRS","UP_STAIRS","DUNGEON_EXIT","DUNGEON_PORTAL","TORCH_WALL",
  "CRYSTAL_WALL","PORTCULLIS_CLOSED","PORTCULLIS_DORMANT","WOODEN_BARRICADE",
  "PILOT_LIGHT_DORMANT","PILOT_LIGHT","HAUNTED_TORCH_DORMANT",
  "HAUNTED_TORCH_TRANSITIONING","HAUNTED_TORCH","WALL_LEVER_HIDDEN",
  "WALL_LEVER","WALL_LEVER_PULLED","WALL_LEVER_HIDDEN_DORMANT",
  "STATUE_INERT","STATUE_DORMANT","STATUE_CRACKING","STATUE_INSTACRACK",
  "PORTAL","TURRET_DORMANT","WALL_MONSTER_DORMANT","DARK_FLOOR_DORMANT",
  "DARK_FLOOR_DARKENING","DARK_FLOOR","MACHINE_TRIGGER_FLOOR",
  "ALTAR_INERT","ALTAR_KEYHOLE","ALTAR_CAGE_OPEN","ALTAR_CAGE_CLOSED",
  "ALTAR_SWITCH","ALTAR_SWITCH_RETRACTING","ALTAR_CAGE_RETRACTABLE",
  "PEDESTAL","MONSTER_CAGE_OPEN","MONSTER_CAGE_CLOSED","COFFIN_CLOSED",
  "COFFIN_OPEN","GAS_TRAP_POISON_HIDDEN","GAS_TRAP_POISON",
  "TRAP_DOOR_HIDDEN","TRAP_DOOR","GAS_TRAP_PARALYSIS_HIDDEN",
  "GAS_TRAP_PARALYSIS","MACHINE_PARALYSIS_VENT_HIDDEN","MACHINE_PARALYSIS_VENT",
  "GAS_TRAP_CONFUSION_HIDDEN","GAS_TRAP_CONFUSION","FLAMETHROWER_HIDDEN",
  "FLAMETHROWER","FLOOD_TRAP_HIDDEN","FLOOD_TRAP","NET_TRAP_HIDDEN","NET_TRAP",
  "ALARM_TRAP_HIDDEN","ALARM_TRAP","MACHINE_POISON_GAS_VENT_HIDDEN",
  "MACHINE_POISON_GAS_VENT_DORMANT","MACHINE_POISON_GAS_VENT",
  "MACHINE_METHANE_VENT_HIDDEN","MACHINE_METHANE_VENT_DORMANT",
  "MACHINE_METHANE_VENT","STEAM_VENT","MACHINE_PRESSURE_PLATE",
  "MACHINE_PRESSURE_PLATE_USED","MACHINE_GLYPH","MACHINE_GLYPH_INACTIVE",
  "DEWAR_CAUSTIC_GAS","DEWAR_CONFUSION_GAS","DEWAR_PARALYSIS_GAS",
  "DEWAR_METHANE_GAS","DEEP_WATER","SHALLOW_WATER","MUD","CHASM","CHASM_EDGE",
  "MACHINE_COLLAPSE_EDGE_DORMANT","MACHINE_COLLAPSE_EDGE_SPREADING",
  "LAVA","LAVA_RETRACTABLE","LAVA_RETRACTING","SUNLIGHT_POOL","DARKNESS_PATCH",
  "ACTIVE_BRIMSTONE","INERT_BRIMSTONE","OBSIDIAN","BRIDGE","BRIDGE_FALLING",
  "BRIDGE_EDGE","STONE_BRIDGE","MACHINE_FLOOD_WATER_DORMANT",
  "MACHINE_FLOOD_WATER_SPREADING","MACHINE_MUD_DORMANT","ICE_DEEP",
  "ICE_DEEP_MELT","ICE_SHALLOW","ICE_SHALLOW_MELT","HOLE","HOLE_GLOW",
  "HOLE_EDGE","FLOOD_WATER_DEEP","FLOOD_WATER_SHALLOW","GRASS","DEAD_GRASS",
  "GRAY_FUNGUS","LUMINESCENT_FUNGUS","LICHEN","HAY","RED_BLOOD","GREEN_BLOOD",
  "PURPLE_BLOOD","ACID_SPLATTER","VOMIT","URINE","UNICORN_POOP","WORM_BLOOD",
  "ASH","BURNED_CARPET","PUDDLE","BONES","RUBBLE","JUNK","BROKEN_GLASS",
  "ECTOPLASM","EMBERS","SPIDERWEB","NETTING","FOLIAGE","DEAD_FOLIAGE",
  "TRAMPLED_FOLIAGE","FUNGUS_FOREST","TRAMPLED_FUNGUS_FOREST","FORCEFIELD",
  "FORCEFIELD_MELT","SACRED_GLYPH","MANACLE_TL","MANACLE_BR","MANACLE_TR",
  "MANACLE_BL","MANACLE_T","MANACLE_B","MANACLE_L","MANACLE_R","PORTAL_LIGHT",
  "GUARDIAN_GLOW","PLAIN_FIRE","BRIMSTONE_FIRE","FLAMEDANCER_FIRE","GAS_FIRE",
  "GAS_EXPLOSION","DART_EXPLOSION","ITEM_FIRE","CREATURE_FIRE","POISON_GAS",
  "CONFUSION_GAS","ROT_GAS","STENCH_SMOKE_GAS","PARALYSIS_GAS","METHANE_GAS",
  "STEAM","DARKNESS_CLOUD","HEALING_CLOUD","BLOODFLOWER_STALK","BLOODFLOWER_POD",
  "HAVEN_BEDROLL","DEEP_WATER_ALGAE_WELL","DEEP_WATER_ALGAE_1",
  "DEEP_WATER_ALGAE_2","ANCIENT_SPIRIT_VINES","ANCIENT_SPIRIT_GRASS",
  "AMULET_SWITCH","COMMUTATION_ALTAR","COMMUTATION_ALTAR_INERT","PIPE_GLOWING",
  "PIPE_INERT","RESURRECTION_ALTAR","RESURRECTION_ALTAR_INERT",
  "MACHINE_TRIGGER_FLOOR_REPEATING","SACRIFICE_ALTAR_DORMANT","SACRIFICE_ALTAR",
  "SACRIFICE_LAVA","SACRIFICE_CAGE_DORMANT","DEMONIC_STATUE",
  "STATUE_INERT_DOORWAY","STATUE_DORMANT_DOORWAY","CHASM_WITH_HIDDEN_BRIDGE",
  "CHASM_WITH_HIDDEN_BRIDGE_ACTIVE","MACHINE_CHASM_EDGE",
  "RAT_TRAP_WALL_DORMANT","RAT_TRAP_WALL_CRACKING","ELECTRIC_CRYSTAL_OFF",
  "ELECTRIC_CRYSTAL_ON","TURRET_LEVER","WORM_TUNNEL_MARKER_DORMANT",
  "WORM_TUNNEL_MARKER_ACTIVE","WORM_TUNNEL_OUTER_WALL","BRAZIER",
  "MUD_FLOOR","MUD_WALL","MUD_DOORWAY",
];

/** Source sprite assignments from buildTileTypeSpriteMap(). */
const TILETYPE_SOURCES = {
  GRANITE: ["TheRoguelike", 8, 21],
  FLOOR: ["TheRoguelike", 7, 10],
  FLOOR_FLOODABLE: ["TheRoguelike", 17, 10],
  CARPET: ["DD_Interior", 5, 31],
  MARBLE_FLOOR: ["DD_Interior", 9, 43],
  WALL: ["TheRoguelike", 20, 21],
  DOOR: ["TheRoguelike", 16, 22],
  OPEN_DOOR: ["TheRoguelike", 10, 22],
  SECRET_DOOR: ["TheRoguelike", 20, 21],
  LOCKED_DOOR: ["TheRoguelike", 29, 22],
  OPEN_IRON_DOOR_INERT: ["TheRoguelike", 34, 20],
  DOWN_STAIRS: ["DD_Interior", 1, 10],
  UP_STAIRS: ["DD_Interior", 0, 10],
  DUNGEON_EXIT: ["TheRoguelike", 13, 23],
  DUNGEON_PORTAL: ["TheRoguelike", 24, 23],
  TORCH_WALL: ["TheRoguelike", 18, 21],
  CRYSTAL_WALL: ["Wall", 3, 30],
  PORTCULLIS_CLOSED: ["Door0", 0, 2],
  PORTCULLIS_DORMANT: ["Door0", 0, 3],
  WOODEN_BARRICADE: ["TheRoguelike", 41, 22],
  PILOT_LIGHT_DORMANT: ["DD_Dungeon", 2, 18],
  PILOT_LIGHT: ["DD_Dungeon", 0, 18],
  HAUNTED_TORCH_DORMANT: ["DD_Cave", 1, 10],
  HAUNTED_TORCH_TRANSITIONING: ["DD_Cave", 3, 10],
  HAUNTED_TORCH: ["DD_Cave", 3, 9],
  WALL_LEVER_HIDDEN: ["TheRoguelike", 20, 21],
  WALL_LEVER: ["TheRoguelike", 16, 21],
  WALL_LEVER_PULLED: ["TheRoguelike", 16, 21],
  WALL_LEVER_HIDDEN_DORMANT: ["TheRoguelike", 20, 21],
  STATUE_INERT: ["DD_Full", 4, 65],
  STATUE_DORMANT: ["DD_Full", 5, 65],
  STATUE_CRACKING: ["DD_Full", 6, 65],
  STATUE_INSTACRACK: ["DD_Full", 6, 65],
  PORTAL: ["TheRoguelike", 11, 23],
  TURRET_DORMANT: ["TheRoguelike", 4, 21],
  WALL_MONSTER_DORMANT: ["TheRoguelike", 20, 21],
  DARK_FLOOR_DORMANT: ["TheRoguelike", 7, 9],
  DARK_FLOOR_DARKENING: ["TheRoguelike", 8, 9],
  DARK_FLOOR: ["TheRoguelike", 6, 9],
  MACHINE_TRIGGER_FLOOR: ["TheRoguelike", 8, 10],
  ALTAR_INERT: ["TheRoguelike", 41, 25],
  ALTAR_KEYHOLE: ["TheRoguelike", 41, 25],
  ALTAR_CAGE_OPEN: ["Decor0", 0, 21],
  ALTAR_CAGE_CLOSED: ["Decor0", 1, 21],
  ALTAR_SWITCH: ["DD_Full", 0, 24],
  ALTAR_SWITCH_RETRACTING: ["DD_Full", 1, 24],
  ALTAR_CAGE_RETRACTABLE: ["Decor0", 1, 21],
  PEDESTAL: ["Decor0", 0, 21],
  MONSTER_CAGE_OPEN: ["TheRoguelike", 60, 27],
  MONSTER_CAGE_CLOSED: ["TheRoguelike", 62, 27],
  COFFIN_CLOSED: ["TheRoguelike", 84, 23],
  COFFIN_OPEN: ["TheRoguelike", 85, 23],
  GAS_TRAP_POISON: ["Raven_Icons", 3, 64],
  TRAP_DOOR: ["Raven_Icons", 3, 66],
  GAS_TRAP_PARALYSIS: ["Raven_Icons", 3, 62],
  MACHINE_PARALYSIS_VENT: ["Raven_Icons", 9, 33],
  GAS_TRAP_CONFUSION: ["Raven_Icons", 3, 61],
  FLAMETHROWER: ["Raven_Icons", 9, 17],
  FLOOD_TRAP: ["Raven_Icons", 3, 60],
  NET_TRAP: ["Raven_Icons", 3, 67],
  ALARM_TRAP: ["Raven_Icons", 3, 57],
  MACHINE_POISON_GAS_VENT_DORMANT: ["Raven_Icons", 9, 34],
  MACHINE_POISON_GAS_VENT: ["Raven_Icons", 9, 34],
  MACHINE_METHANE_VENT_DORMANT: ["Raven_Icons", 9, 34],
  MACHINE_METHANE_VENT: ["Raven_Icons", 9, 34],
  STEAM_VENT: ["Raven_Icons", 6, 51],
  MACHINE_PRESSURE_PLATE: ["Raven_Icons", 4, 67],
  MACHINE_PRESSURE_PLATE_USED: ["Raven_Icons", 5, 67],
  MACHINE_GLYPH: ["TheRoguelike", 62, 41],
  MACHINE_GLYPH_INACTIVE: ["TheRoguelike", 61, 41],
  DEWAR_CAUSTIC_GAS: ["Raven_Icons", 12, 39],
  DEWAR_CONFUSION_GAS: ["Raven_Icons", 11, 43],
  DEWAR_PARALYSIS_GAS: ["Raven_Icons", 11, 43],
  DEWAR_METHANE_GAS: ["Raven_Icons", 11, 42],
  DEEP_WATER: ["TheRoguelike", 65, 13],
  SHALLOW_WATER: ["TheRoguelike", 4, 13],
  MUD: ["TheRoguelike", 54, 10],
  CHASM: ["GUI0", 2, 14],
  CHASM_EDGE: ["DD_Full", 2, 16],
  MACHINE_COLLAPSE_EDGE_DORMANT: ["DD_Full", 9, 0],
  MACHINE_COLLAPSE_EDGE_SPREADING: ["DD_Full", 9, 1],
  LAVA: ["TheRoguelike", 13, 13],
  LAVA_RETRACTABLE: ["TheRoguelike", 13, 13],
  LAVA_RETRACTING: ["TheRoguelike", 11, 13],
  ACTIVE_BRIMSTONE: ["TheRoguelike", 11, 9],
  INERT_BRIMSTONE: ["TheRoguelike", 8, 9],
  OBSIDIAN: ["TheRoguelike", 24, 9],
  BRIDGE: ["TheRoguelike", 69, 10],
  BRIDGE_FALLING: ["TheRoguelike", 65, 10],
  BRIDGE_EDGE: ["TheRoguelike", 65, 10],
  STONE_BRIDGE: ["TheRoguelike", 66, 10],
  MACHINE_FLOOD_WATER_DORMANT: ["TheRoguelike", 74, 13],
  MACHINE_FLOOD_WATER_SPREADING: ["TheRoguelike", 70, 13],
  MACHINE_MUD_DORMANT: ["TheRoguelike", 68, 13],
  ICE_DEEP: ["TheRoguelike", 69, 13],
  ICE_DEEP_MELT: ["TheRoguelike", 70, 13],
  ICE_SHALLOW: ["TheRoguelike", 71, 13],
  ICE_SHALLOW_MELT: ["TheRoguelike", 72, 13],
  HOLE: ["TheRoguelike", 11, 15],
  HOLE_GLOW: ["TheRoguelike", 24, 15],
  FLOOD_WATER_DEEP: ["TheRoguelike", 65, 13],
  FLOOD_WATER_SHALLOW: ["TheRoguelike", 67, 13],
  GRASS: ["TheRoguelike", 4, 5],
  DEAD_GRASS: ["TheRoguelike", 11, 5],
  GRAY_FUNGUS: ["TheRoguelike", 9, 5],
  LUMINESCENT_FUNGUS: ["TheRoguelike", 6, 5],
  LICHEN: ["TheRoguelike", 10, 5],
  HAY: ["TheRoguelike", 29, 5],
  RED_BLOOD: ["DD_Full", 2, 37],
  GREEN_BLOOD: ["DD_Full", 1, 38],
  PURPLE_BLOOD: ["DD_Full", 1, 37],
  ACID_SPLATTER: ["TheRoguelike", 56, 13],
  VOMIT: ["TheRoguelike", 54, 13],
  URINE: ["TheRoguelike", 19, 9],
  UNICORN_POOP: ["TheRoguelike", 9, 7],
  WORM_BLOOD: ["Ground0", 0, 5],
  ASH: ["TheRoguelike", 9, 9],
  BURNED_CARPET: ["TheRoguelike", 31, 10],
  PUDDLE: ["TheRoguelike", 18, 13],
  BONES: ["TheRoguelike", 9, 27],
  RUBBLE: ["TheRoguelike", 4, 10],
  JUNK: ["Decor0", 0, 2],
  BROKEN_GLASS: ["Decor0", 3, 2],
  ECTOPLASM: ["Ground0", 1, 6],
  EMBERS: ["TheRoguelike", 29, 23],
  SPIDERWEB: ["DD_Full", 0, 13],
  NETTING: ["DD_Full", 22, 18],
  FOLIAGE: ["TheRoguelike", 8, 6],
  DEAD_FOLIAGE: ["TheRoguelike", 11, 6],
  TRAMPLED_FOLIAGE: ["TheRoguelike", 11, 10],
  FUNGUS_FOREST: ["TheRoguelike", 29, 4],
  TRAMPLED_FUNGUS_FOREST: ["TheRoguelike", 29, 9],
  FORCEFIELD: ["TheRoguelike", 101, 22],
  FORCEFIELD_MELT: ["TheRoguelike", 102, 22],
  SACRED_GLYPH: ["Effect1", 7, 23],
  MANACLE_TL: ["Effect1", 6, 20],
  MANACLE_BR: ["Effect1", 2, 20],
  MANACLE_TR: ["Effect1", 7, 20],
  MANACLE_BL: ["Effect1", 3, 20],
  MANACLE_T: ["Effect1", 4, 20],
  MANACLE_B: ["Effect1", 0, 20],
  MANACLE_L: ["Effect1", 5, 20],
  MANACLE_R: ["Effect1", 1, 20],
  PORTAL_LIGHT: ["Door1", 3, 5],
  GUARDIAN_GLOW: ["Effect0", 7, 22],
  PLAIN_FIRE: ["Effect0", 0, 21],
  BRIMSTONE_FIRE: ["Effect0", 0, 21],
  FLAMEDANCER_FIRE: ["Effect0", 1, 21],
  GAS_FIRE: ["Effect0", 0, 21],
  GAS_EXPLOSION: ["Effect0", 0, 23],
  DART_EXPLOSION: ["Effect0", 1, 23],
  ITEM_FIRE: ["Effect0", 0, 21],
  CREATURE_FIRE: ["Effect0", 0, 21],
  POISON_GAS: ["Effect0", 0, 24],
  CONFUSION_GAS: ["Effect0", 0, 24],
  ROT_GAS: ["Effect0", 3, 24],
  STENCH_SMOKE_GAS: ["Effect0", 0, 24],
  PARALYSIS_GAS: ["Effect0", 0, 24],
  METHANE_GAS: ["Effect0", 0, 24],
  STEAM: ["Effect0", 0, 24],
  DARKNESS_CLOUD: ["Effect0", 3, 24],
  HEALING_CLOUD: ["Effect0", 1, 24],
  BLOODFLOWER_STALK: ["TheRoguelike", 98, 3],
  BLOODFLOWER_POD: ["TheRoguelike", 5, 7],
  HAVEN_BEDROLL: ["TheRoguelike", 30, 38],
  DEEP_WATER_ALGAE_WELL: ["TheRoguelike", 5, 13],
  DEEP_WATER_ALGAE_1: ["TheRoguelike", 11, 13],
  DEEP_WATER_ALGAE_2: ["TheRoguelike", 11, 13],
  ANCIENT_SPIRIT_VINES: ["TheRoguelike", 24, 5],
  ANCIENT_SPIRIT_GRASS: ["TheRoguelike", 25, 5],
  AMULET_SWITCH: ["DD_Items", 8, 4],
  COMMUTATION_ALTAR: ["DD_Interior", 7, 12],
  COMMUTATION_ALTAR_INERT: ["DD_Interior", 0, 12],
  PIPE_GLOWING: ["TheRoguelike", 100, 23],
  PIPE_INERT: ["TheRoguelike", 101, 23],
  RESURRECTION_ALTAR: ["TheRoguelike", 101, 25],
  RESURRECTION_ALTAR_INERT: ["TheRoguelike", 101, 25],
  SACRIFICE_ALTAR: ["TheRoguelike", 101, 25],
  SACRIFICE_LAVA: ["TheRoguelike", 13, 13],
  SACRIFICE_CAGE_DORMANT: ["TheRoguelike", 24, 15],
  DEMONIC_STATUE: ["TheRoguelike", 13, 34],
  MUD_FLOOR: ["Floor", 15, 10],
  MUD_WALL: ["Wall", 15, 18],
  MUD_DOORWAY: ["TheRoguelike", 55, 22],
};

// ---------------------------------------------------------------------------
// DisplayGlyph assignments — mirrors buildGlyphSpriteMap()
// G_PLAYER appears twice in source; the later entry (DD_Full) wins.
// ---------------------------------------------------------------------------

const GLYPH_NAMES = [
  "G_UP_ARROW","G_DOWN_ARROW","G_POTION","G_GRASS","G_WALL","G_DEMON",
  "G_OPEN_DOOR","G_GOLD","G_CLOSED_DOOR","G_RUBBLE","G_KEY","G_BOG",
  "G_CHAIN_TOP_LEFT","G_CHAIN_BOTTOM_RIGHT","G_CHAIN_TOP_RIGHT",
  "G_CHAIN_BOTTOM_LEFT","G_CHAIN_TOP","G_CHAIN_BOTTOM","G_CHAIN_LEFT",
  "G_CHAIN_RIGHT","G_FOOD","G_UP_STAIRS","G_VENT","G_DOWN_STAIRS","G_PLAYER",
  "G_BOG_MONSTER","G_CENTAUR","G_DRAGON","G_FLAMEDANCER","G_GOLEM",
  "G_TENTACLE_HORROR","G_IFRIT","G_JELLY","G_KRAKEN","G_LICH","G_NAGA",
  "G_OGRE","G_PHANTOM","G_REVENANT","G_SALAMANDER","G_TROLL","G_UNDERWORM",
  "G_VAMPIRE","G_WRAITH","G_ZOMBIE","G_ARMOR","G_STAFF","G_WEB","G_MOUND",
  "G_BLOAT","G_CENTIPEDE","G_DAR_BLADEMASTER","G_EEL","G_FURY","G_GOBLIN",
  "G_IMP","G_JACKAL","G_KOBOLD","G_MONKEY","G_PIXIE","G_RAT","G_SPIDER",
  "G_TOAD","G_BAT","G_WISP","G_PHOENIX","G_ALTAR","G_LIQUID","G_FLOOR",
  "G_CHASM","G_TRAP","G_FIRE","G_FOLIAGE","G_AMULET","G_SCROLL","G_RING",
  "G_WEAPON","G_TURRET","G_TOTEM","G_GOOD_MAGIC","G_BAD_MAGIC","G_DOORWAY",
  "G_CHARM","G_WALL_TOP","G_DAR_PRIESTESS","G_DAR_BATTLEMAGE","G_GOBLIN_MAGIC",
  "G_GOBLIN_CHIEFTAN","G_OGRE_MAGIC","G_GUARDIAN","G_WINGED_GUARDIAN","G_EGG",
  "G_WARDEN","G_DEWAR","G_ANCIENT_SPIRIT","G_LEVER","G_LEVER_PULLED",
  "G_BLOODWORT_STALK","G_FLOOR_ALT","G_UNICORN","G_GEM","G_WAND","G_GRANITE",
  "G_CARPET","G_CLOSED_IRON_DOOR","G_OPEN_IRON_DOOR","G_TORCH","G_CRYSTAL",
  "G_PORTCULLIS","G_BARRICADE","G_STATUE","G_CRACKED_STATUE","G_CLOSED_CAGE",
  "G_OPEN_CAGE","G_PEDESTAL","G_CLOSED_COFFIN","G_OPEN_COFFIN","G_MAGIC_GLYPH",
  "G_BRIDGE","G_BONES","G_ELECTRIC_CRYSTAL","G_ASHES","G_BEDROLL",
  "G_BLOODWORT_POD","G_VINE","G_NET","G_LICHEN","G_PIPES","G_SAC_ALTAR",
  "G_ORB_ALTAR","G_LEFT_TRIANGLE",
];

const GLYPH_SOURCES = {
  G_GRASS: ["Floor", 13, 13],
  G_WALL: ["Wall", 0, 20],
  G_OPEN_DOOR: ["Door1", 0, 0],
  G_CLOSED_DOOR: ["Door0", 0, 0],
  G_BOG: ["Ground0", 5, 6],
  G_UP_STAIRS: ["Floor", 1, 0],
  G_DOWN_STAIRS: ["Floor", 2, 0],
  G_PLAYER: ["DD_Full", 34, 60],
  G_ARMOR: ["Raven_Icons", 4, 233],
  G_STAFF: ["Raven_Icons", 7, 173],
  G_GOBLIN: ["Player0", 0, 12],
  G_KOBOLD: ["Player0", 0, 14],
  G_MONKEY: ["Humanoid1", 1, 14],
  G_RAT: ["Rodent0", 1, 2],
  G_LIQUID: ["Pit1", 1, 16],
  G_FLOOR: ["Floor", 16, 14],
  G_CHASM: ["Pit1", 1, 22],
  G_SCROLL: ["Raven_Icons", 7, 12],
  G_RING: ["Raven_Icons", 2, 339],
  G_WEAPON: ["Raven_Icons", 8, 142],
  G_DOORWAY: ["Door1", 0, 0],
  G_CHARM: ["Raven_Icons", 1, 336],
  G_WALL_TOP: ["Wall", 2, 19],
  G_FLOOR_ALT: ["Floor", 17, 14],
  G_WAND: ["Raven_Icons", 5, 173],
  G_CLOSED_IRON_DOOR: ["Door0", 1, 0],
  G_OPEN_IRON_DOOR: ["Door1", 1, 0],
  G_JACKAL: ["Quadraped0", 2, 5],
};

// ---------------------------------------------------------------------------
// Grid position helpers
// ---------------------------------------------------------------------------

function tileTypeGridPos(enumIndex) {
  return { x: enumIndex % GRID_W, y: Math.floor(enumIndex / GRID_W) };
}

function glyphGridPos(enumValue) {
  const slot = GLYPH_GRID_OFFSET + (enumValue - GLYPH_ENUM_START);
  return { x: slot % GRID_W, y: Math.floor(slot / GRID_W) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const composites = [];
  const sheetCache = new Map();

  async function getSheet(key) {
    if (sheetCache.has(key)) return sheetCache.get(key);
    const p = path.join(ASSETS, SHEET_PATHS[key]);
    if (!fs.existsSync(p)) {
      console.warn(`  WARN: sheet not found: ${key} → ${p}`);
      sheetCache.set(key, null);
      return null;
    }
    const buf = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    sheetCache.set(key, buf);
    return buf;
  }

  function extractTile(sheetData, tileX, tileY) {
    const { data, info } = sheetData;
    const channels = info.channels; // 4 (RGBA)
    const rowBytes = info.width * channels;
    const buf = Buffer.alloc(TILE_SIZE * TILE_SIZE * 4);
    const srcStartX = tileX * TILE_SIZE;
    const srcStartY = tileY * TILE_SIZE;
    for (let row = 0; row < TILE_SIZE; row++) {
      const srcOff = (srcStartY + row) * rowBytes + srcStartX * channels;
      const dstOff = row * TILE_SIZE * 4;
      if (srcStartY + row >= info.height || srcStartX >= info.width) continue;
      const copyLen = Math.min(TILE_SIZE * channels, info.width * channels - srcStartX * channels);
      if (copyLen > 0) data.copy(buf, dstOff, srcOff, srcOff + copyLen);
    }
    return buf;
  }

  // Build manifest
  const manifest = { tileSize: TILE_SIZE, gridWidth: GRID_W, gridHeight: GRID_H, tiles: {}, glyphs: {} };

  // TileType entries
  let tileCount = 0;
  for (let i = 0; i < TILETYPE_NAMES.length; i++) {
    const name = TILETYPE_NAMES[i];
    const src = TILETYPE_SOURCES[name];
    if (!src) continue;
    const [sheetKey, tileX, tileY] = src;
    const pos = tileTypeGridPos(i);
    manifest.tiles[name] = { x: pos.x, y: pos.y };

    const sheetData = await getSheet(sheetKey);
    if (!sheetData) continue;
    const tileBuf = extractTile(sheetData, tileX, tileY);
    composites.push({
      input: tileBuf,
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
      left: pos.x * TILE_SIZE,
      top: pos.y * TILE_SIZE,
    });
    tileCount++;
  }

  // DisplayGlyph entries
  let glyphCount = 0;
  for (let i = 0; i < GLYPH_NAMES.length; i++) {
    const name = GLYPH_NAMES[i];
    const src = GLYPH_SOURCES[name];
    if (!src) continue;
    const [sheetKey, tileX, tileY] = src;
    const enumValue = GLYPH_ENUM_START + i;
    const pos = glyphGridPos(enumValue);
    manifest.glyphs[name] = { x: pos.x, y: pos.y };

    const sheetData = await getSheet(sheetKey);
    if (!sheetData) continue;
    const tileBuf = extractTile(sheetData, tileX, tileY);
    composites.push({
      input: tileBuf,
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
      left: pos.x * TILE_SIZE,
      top: pos.y * TILE_SIZE,
    });
    glyphCount++;
  }

  // Write master spritesheet
  const masterSheet = sharp({
    create: {
      width: SHEET_W,
      height: SHEET_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  const pngPath = path.join(ASSETS, "master-spritesheet.png");
  await masterSheet.composite(composites).png().toFile(pngPath);
  console.log(`  ✓ ${pngPath} (${SHEET_W}×${SHEET_H}, ${composites.length} sprites)`);

  // Write manifest
  const manifestPath = path.join(ASSETS, "sprite-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`  ✓ ${manifestPath} (${tileCount} tiles, ${glyphCount} glyphs)`);
}

console.log("Generating master spritesheet...");
main().then(() => console.log("Done.")).catch(e => { console.error(e); process.exit(1); });
