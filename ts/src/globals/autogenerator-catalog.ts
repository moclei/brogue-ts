/*
 *  autogenerator-catalog.ts — Auto-generator catalog data (Brogue variant)
 *  brogue-ts
 *
 *  Ported from: src/variants/GlobalsBrogue.c autoGeneratorCatalog_Brogue[]
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { AutoGenerator } from "../types/types.js";
import { TileType, DungeonLayer, DungeonFeatureType, MachineType } from "../types/enums.js";

const AMULET_LEVEL = 26;
const DEEPEST_LEVEL = 40;

const {
    NOTHING, FLOOR, WALL, DEEP_WATER, STATUE_INERT, TORCH_WALL,
    GAS_TRAP_POISON, NET_TRAP, ALARM_TRAP, GAS_TRAP_CONFUSION,
    FLAMETHROWER, FLOOD_TRAP,
    GAS_TRAP_POISON_HIDDEN, NET_TRAP_HIDDEN, ALARM_TRAP_HIDDEN,
    TRAP_DOOR_HIDDEN, GAS_TRAP_CONFUSION_HIDDEN, FLAMETHROWER_HIDDEN,
    FLOOD_TRAP_HIDDEN, STEAM_VENT, CRYSTAL_WALL,
    DEWAR_CAUSTIC_GAS, DEWAR_CONFUSION_GAS, DEWAR_PARALYSIS_GAS,
    DEWAR_METHANE_GAS,
} = TileType;

const { Dungeon: DUNGEON } = DungeonLayer;

const {
    DF_GRANITE_COLUMN, DF_CRYSTAL_WALL, DF_LUMINESCENT_FUNGUS,
    DF_GRASS, DF_DEAD_GRASS, DF_BONES, DF_RUBBLE, DF_FOLIAGE,
    DF_FUNGUS_FOREST, DF_BUILD_ALGAE_WELL,
    DF_SUNLIGHT, DF_DARKNESS, DF_CARPET_AREA,
} = DungeonFeatureType;

const {
    ParalysisTrapArea, ParalysisTrapHiddenArea,
    SwampArea, BloodflowerArea, ShrineArea, IdyllArea,
    RemnantArea, DismalArea, BridgeTurretArea, LakePathTurretArea,
    TrickStatueArea, SentinelArea, WormArea,
} = MachineType;

// terrain, layer, DFType, machine, reqDungeon, reqLiquid, minDepth, maxDepth, freq, minIntercept, minSlope, maxNumber
function ag(
    terrain: TileType, layer: DungeonLayer, DFType: DungeonFeatureType | 0,
    machine: MachineType | 0,
    requiredDungeonFoundationType: TileType, requiredLiquidFoundationType: TileType,
    minDepth: number, maxDepth: number, frequency: number,
    minNumberIntercept: number, minNumberSlope: number, maxNumber: number,
): AutoGenerator {
    return {
        terrain, layer, DFType: DFType as DungeonFeatureType, machine,
        requiredDungeonFoundationType, requiredLiquidFoundationType,
        minDepth, maxDepth, frequency,
        minNumberIntercept, minNumberSlope, maxNumber,
    };
}

export const autoGeneratorCatalog: readonly AutoGenerator[] = [
    // index 0: nothing
    ag(NOTHING, 0 as DungeonLayer, 0, 0, NOTHING, NOTHING, 0, 0, 0, 0, 0, 0),

    // Ordinary features of the dungeon
    ag(NOTHING,         0 as DungeonLayer, DF_GRANITE_COLUMN,          0, FLOOR, NOTHING, 1,  DEEPEST_LEVEL,   60,  100,   0,    4),
    ag(NOTHING,         0 as DungeonLayer, DF_CRYSTAL_WALL,            0, WALL,  NOTHING, 14, DEEPEST_LEVEL,   15,  -325,  25,   5),
    ag(NOTHING,         0 as DungeonLayer, DF_LUMINESCENT_FUNGUS,      0, FLOOR, NOTHING, 7,  DEEPEST_LEVEL,   15,  -300,  70,   14),
    ag(NOTHING,         0 as DungeonLayer, DF_GRASS,                   0, FLOOR, NOTHING, 0,  10,              0,   1000,  -80,  10),
    ag(NOTHING,         0 as DungeonLayer, DF_DEAD_GRASS,              0, FLOOR, NOTHING, 4,  9,               0,   -200,  80,   10),
    ag(NOTHING,         0 as DungeonLayer, DF_DEAD_GRASS,              0, FLOOR, NOTHING, 9,  14,              0,   1200,  -80,  10),
    ag(NOTHING,         0 as DungeonLayer, DF_BONES,                   0, FLOOR, NOTHING, 12, DEEPEST_LEVEL-1, 30,  0,     0,    4),
    ag(NOTHING,         0 as DungeonLayer, DF_RUBBLE,                  0, FLOOR, NOTHING, 0,  DEEPEST_LEVEL-1, 30,  0,     0,    4),
    ag(NOTHING,         0 as DungeonLayer, DF_FOLIAGE,                 0, FLOOR, NOTHING, 0,  8,               15,  1000,  -333, 10),
    ag(NOTHING,         0 as DungeonLayer, DF_FUNGUS_FOREST,           0, FLOOR, NOTHING, 13, DEEPEST_LEVEL,   30,  -600,  50,   12),
    ag(NOTHING,         0 as DungeonLayer, DF_BUILD_ALGAE_WELL,        0, FLOOR, DEEP_WATER,10,DEEPEST_LEVEL,  50,  0,     0,    2),
    ag(STATUE_INERT,    DUNGEON,           0,                          0, WALL,  NOTHING, 6,  DEEPEST_LEVEL-1, 5,   -100,  35,   3),
    ag(STATUE_INERT,    DUNGEON,           0,                          0, FLOOR, NOTHING, 10, DEEPEST_LEVEL-1, 50,  0,     0,    3),
    ag(TORCH_WALL,      DUNGEON,           0,                          0, WALL,  NOTHING, 6,  DEEPEST_LEVEL-1, 5,   -200,  70,   12),

    // Pre-revealed traps
    ag(GAS_TRAP_POISON,     DUNGEON, 0, 0, FLOOR, NOTHING, 2, 4,  20, 0, 0, 1),
    ag(NET_TRAP,            DUNGEON, 0, 0, FLOOR, NOTHING, 2, 5,  20, 0, 0, 1),
    ag(NOTHING, 0 as DungeonLayer, 0, ParalysisTrapArea,    FLOOR, NOTHING, 2, 6,  20, 0, 0, 1),
    ag(ALARM_TRAP,          DUNGEON, 0, 0, FLOOR, NOTHING, 4, 7,  20, 0, 0, 1),
    ag(GAS_TRAP_CONFUSION,  DUNGEON, 0, 0, FLOOR, NOTHING, 2, 10, 20, 0, 0, 1),
    ag(FLAMETHROWER,        DUNGEON, 0, 0, FLOOR, NOTHING, 4, 12, 20, 0, 0, 1),
    ag(FLOOD_TRAP,          DUNGEON, 0, 0, FLOOR, NOTHING, 10,14, 20, 0, 0, 1),

    // Hidden traps
    ag(GAS_TRAP_POISON_HIDDEN,     DUNGEON, 0, 0, FLOOR, NOTHING, 5,  DEEPEST_LEVEL-1, 20, 100, 0, 3),
    ag(NET_TRAP_HIDDEN,            DUNGEON, 0, 0, FLOOR, NOTHING, 6,  DEEPEST_LEVEL-1, 20, 100, 0, 3),
    ag(NOTHING, 0 as DungeonLayer, 0, ParalysisTrapHiddenArea,     FLOOR, NOTHING, 7, DEEPEST_LEVEL-1, 20, 100, 0, 3),
    ag(ALARM_TRAP_HIDDEN,          DUNGEON, 0, 0, FLOOR, NOTHING, 8,  DEEPEST_LEVEL-1, 20, 100, 0, 2),
    ag(TRAP_DOOR_HIDDEN,           DUNGEON, 0, 0, FLOOR, NOTHING, 9,  DEEPEST_LEVEL-1, 20, 100, 0, 2),
    ag(GAS_TRAP_CONFUSION_HIDDEN,  DUNGEON, 0, 0, FLOOR, NOTHING, 11, DEEPEST_LEVEL-1, 20, 100, 0, 3),
    ag(FLAMETHROWER_HIDDEN,        DUNGEON, 0, 0, FLOOR, NOTHING, 13, DEEPEST_LEVEL-1, 20, 100, 0, 3),
    ag(FLOOD_TRAP_HIDDEN,          DUNGEON, 0, 0, FLOOR, NOTHING, 15, DEEPEST_LEVEL-1, 20, 100, 0, 3),
    ag(NOTHING, 0 as DungeonLayer, 0, SwampArea,   FLOOR, NOTHING, 1, DEEPEST_LEVEL-1, 30, 0, 0, 2),
    ag(NOTHING, 0 as DungeonLayer, DF_SUNLIGHT,  0, FLOOR, NOTHING, 0, 5,  15, 500,  -150, 10),
    ag(NOTHING, 0 as DungeonLayer, DF_DARKNESS,  0, FLOOR, NOTHING, 1, 15, 15, 500,  -50,  10),
    ag(STEAM_VENT,      DUNGEON, 0, 0, FLOOR, NOTHING, 16, DEEPEST_LEVEL-1, 30, 100, 0, 3),
    ag(CRYSTAL_WALL,    DUNGEON, 0, 0, WALL,  NOTHING, DEEPEST_LEVEL, DEEPEST_LEVEL, 100, 0, 0, 600),

    // Dewars
    ag(DEWAR_CAUSTIC_GAS,    DUNGEON, DF_CARPET_AREA, 0, FLOOR, NOTHING, 8, DEEPEST_LEVEL-1, 2, 0, 0, 2),
    ag(DEWAR_CONFUSION_GAS,  DUNGEON, DF_CARPET_AREA, 0, FLOOR, NOTHING, 8, DEEPEST_LEVEL-1, 2, 0, 0, 2),
    ag(DEWAR_PARALYSIS_GAS,  DUNGEON, DF_CARPET_AREA, 0, FLOOR, NOTHING, 8, DEEPEST_LEVEL-1, 2, 0, 0, 2),
    ag(DEWAR_METHANE_GAS,    DUNGEON, DF_CARPET_AREA, 0, FLOOR, NOTHING, 8, DEEPEST_LEVEL-1, 2, 0, 0, 2),

    // Flavor machines
    ag(NOTHING, 0 as DungeonLayer, DF_LUMINESCENT_FUNGUS, 0, FLOOR, NOTHING, DEEPEST_LEVEL, DEEPEST_LEVEL, 100, 0, 0, 200),
    ag(NOTHING, 0 as DungeonLayer, 0, BloodflowerArea,   FLOOR, NOTHING, 1,  30,             25, 140, -10, 3),
    ag(NOTHING, 0 as DungeonLayer, 0, ShrineArea,        FLOOR, NOTHING, 5,  AMULET_LEVEL,   7,  0,   0,   1),
    ag(NOTHING, 0 as DungeonLayer, 0, IdyllArea,         FLOOR, NOTHING, 1,  5,              15, 0,   0,   1),
    ag(NOTHING, 0 as DungeonLayer, 0, RemnantArea,       FLOOR, NOTHING, 10, DEEPEST_LEVEL,  15, 0,   0,   2),
    ag(NOTHING, 0 as DungeonLayer, 0, DismalArea,        FLOOR, NOTHING, 7,  DEEPEST_LEVEL,  12, 0,   0,   5),
    ag(NOTHING, 0 as DungeonLayer, 0, BridgeTurretArea,  FLOOR, NOTHING, 5,  DEEPEST_LEVEL-1,6,  0,   0,   2),
    ag(NOTHING, 0 as DungeonLayer, 0, LakePathTurretArea,FLOOR, NOTHING, 5,  DEEPEST_LEVEL-1,6,  0,   0,   2),
    ag(NOTHING, 0 as DungeonLayer, 0, TrickStatueArea,   FLOOR, NOTHING, 6,  DEEPEST_LEVEL-1,15, 0,   0,   3),
    ag(NOTHING, 0 as DungeonLayer, 0, SentinelArea,      FLOOR, NOTHING, 12, DEEPEST_LEVEL-1,10, 0,   0,   2),
    ag(NOTHING, 0 as DungeonLayer, 0, WormArea,          FLOOR, NOTHING, 12, DEEPEST_LEVEL-1,12, 0,   0,   3),
];
