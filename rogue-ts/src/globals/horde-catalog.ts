/*
 *  horde-catalog.ts — hordeCatalog, ported from GlobalsBrogue.c
 *  brogue-ts
 *
 *  Defines all monster horde types for the standard Brogue variant.
 *  Each entry specifies a horde leader, optional member types with counts,
 *  depth range, spawn frequency, terrain requirements, machine association,
 *  and behavior flags.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { HordeType } from "../types/types.js";
import { MonsterType, TileType, MachineType } from "../types/enums.js";
import { HordeFlag } from "../types/flags.js";

// Shorthand aliases for readability
const MK = MonsterType;
const HF = HordeFlag;
const TT = TileType;
const MT = MachineType;

// Standard depth constants (matching gameConstants)
const DEEPEST_LEVEL = 40;
const AMULET_LEVEL = 26;

/** Helper to create a HordeType with defaults for trailing optional fields. */
function h(
    leaderType: MonsterType,
    numberOfMemberTypes: number,
    memberType: MonsterType[],
    memberCount: ([number, number, number] | [number])[],
    minLevel: number,
    maxLevel: number,
    frequency: number,
    spawnsIn: TileType = TT.NOTHING,
    machine: number = 0,
    flags: number = 0,
): HordeType {
    // Normalize memberCount: [0] shorthand → { lowerBound: 0, upperBound: 0, clumpFactor: 0 }
    const counts = memberCount.map(mc =>
        mc.length === 1
            ? { lowerBound: mc[0], upperBound: 0, clumpFactor: 0 }
            : { lowerBound: mc[0], upperBound: mc[1], clumpFactor: mc[2] },
    );

    return {
        leaderType,
        numberOfMemberTypes,
        memberType,
        memberCount: counts,
        minLevel,
        maxLevel,
        frequency,
        spawnsIn,
        machine,
        flags,
    };
}

/**
 * Horde catalog for the standard Brogue variant.
 * Ported from `hordeCatalog_Brogue[]` in `src/variants/GlobalsBrogue.c`.
 */
export const hordeCatalog: readonly HordeType[] = [
    // ===== Regular spawns =====
    h(MK.MK_RAT,               0, [],      [[0]],                          1,  5,      150),
    h(MK.MK_KOBOLD,            0, [],      [[0]],                          1,  6,      150),
    h(MK.MK_JACKAL,            0, [],      [[0]],                          1,  3,      100),
    h(MK.MK_JACKAL,            1, [MK.MK_JACKAL],  [[1,3,1]],             3,  7,      50),
    h(MK.MK_EEL,               0, [],      [[0]],                          2,  17,     100,    TT.DEEP_WATER),
    h(MK.MK_MONKEY,            0, [],      [[0]],                          2,  9,      50),
    h(MK.MK_BLOAT,             0, [],      [[0]],                          2,  13,     30),
    h(MK.MK_PIT_BLOAT,         0, [],      [[0]],                          2,  13,     10),
    h(MK.MK_BLOAT,             1, [MK.MK_BLOAT],   [[0,2,1]],             14, 26,     30),
    h(MK.MK_PIT_BLOAT,         1, [MK.MK_PIT_BLOAT], [[0,2,1]],           14, 26,     10),
    h(MK.MK_EXPLOSIVE_BLOAT,   0, [],      [[0]],                          10, 26,     10),
    h(MK.MK_GOBLIN,            0, [],      [[0]],                          3,  10,     100),
    h(MK.MK_GOBLIN_CONJURER,   0, [],      [[0]],                          3,  10,     60),
    h(MK.MK_TOAD,              0, [],      [[0]],                          4,  11,     100),
    h(MK.MK_PINK_JELLY,        0, [],      [[0]],                          4,  13,     100),
    h(MK.MK_GOBLIN_TOTEM,      1, [MK.MK_GOBLIN],  [[2,4,1]],             5,  13,     100,    TT.NOTHING, MT.CampArea, HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_ARROW_TURRET,      0, [],      [[0]],                          5,  13,     100,    TT.WALL,    0,           HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_MONKEY,            1, [MK.MK_MONKEY],  [[2,4,1]],             5,  13,     20),
    h(MK.MK_VAMPIRE_BAT,       0, [],      [[0]],                          6,  13,     30),
    h(MK.MK_VAMPIRE_BAT,       1, [MK.MK_VAMPIRE_BAT], [[1,2,1]],         6,  13,     70,     TT.NOTHING, 0, HF.HORDE_NEVER_OOD),
    h(MK.MK_ACID_MOUND,        0, [],      [[0]],                          6,  13,     100),
    h(MK.MK_GOBLIN,            3, [MK.MK_GOBLIN, MK.MK_GOBLIN_MYSTIC, MK.MK_JACKAL],
                                            [[2,3,1],[1,2,1],[1,2,1]],      6,  12,     40),
    h(MK.MK_GOBLIN_CONJURER,   2, [MK.MK_GOBLIN_CONJURER, MK.MK_GOBLIN_MYSTIC],
                                            [[0,1,1],[1,1,1]],              7,  15,     40),
    h(MK.MK_CENTIPEDE,         0, [],      [[0]],                          7,  14,     100),
    h(MK.MK_BOG_MONSTER,       0, [],      [[0]],                          7,  14,     80,     TT.MUD,     0, HF.HORDE_NEVER_OOD),
    h(MK.MK_OGRE,              0, [],      [[0]],                          7,  13,     100),
    h(MK.MK_EEL,               1, [MK.MK_EEL],     [[2,4,1]],             8,  22,     70,     TT.DEEP_WATER),
    h(MK.MK_ACID_MOUND,        1, [MK.MK_ACID_MOUND], [[2,4,1]],          9,  13,     30),
    h(MK.MK_SPIDER,            0, [],      [[0]],                          9,  16,     100),
    h(MK.MK_DAR_BLADEMASTER,   1, [MK.MK_DAR_BLADEMASTER], [[0,1,1]],     10, 14,     100),
    h(MK.MK_WILL_O_THE_WISP,   0, [],      [[0]],                          10, 17,     100),
    h(MK.MK_WRAITH,            0, [],      [[0]],                          10, 17,     100),
    h(MK.MK_GOBLIN_TOTEM,      4, [MK.MK_GOBLIN_TOTEM, MK.MK_GOBLIN_CONJURER, MK.MK_GOBLIN_MYSTIC, MK.MK_GOBLIN],
                                            [[1,2,1],[1,2,1],[1,2,1],[3,5,1]], 10, 17,  80,    TT.NOTHING, MT.CampArea, HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_SPARK_TURRET,      0, [],      [[0]],                          11, 18,     100,    TT.WALL,    0, HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_ZOMBIE,            0, [],      [[0]],                          11, 18,     100),
    h(MK.MK_TROLL,             0, [],      [[0]],                          12, 19,     100),
    h(MK.MK_OGRE_TOTEM,        1, [MK.MK_OGRE],    [[2,4,1]],             12, 19,     60,     TT.NOTHING, 0, HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_BOG_MONSTER,       1, [MK.MK_BOG_MONSTER], [[2,4,1]],          12, 26,     100,    TT.MUD),
    h(MK.MK_NAGA,              0, [],      [[0]],                          13, 20,     100,    TT.DEEP_WATER),
    h(MK.MK_SALAMANDER,        0, [],      [[0]],                          13, 20,     100,    TT.LAVA),
    h(MK.MK_OGRE_SHAMAN,       1, [MK.MK_OGRE],    [[1,3,1]],             14, 20,     100),
    h(MK.MK_CENTAUR,           1, [MK.MK_CENTAUR],  [[1,1,1]],             14, 21,     100),
    h(MK.MK_ACID_JELLY,        0, [],      [[0]],                          14, 21,     100),
    h(MK.MK_DART_TURRET,       0, [],      [[0]],                          15, 22,     100,    TT.WALL,    0, HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_PIXIE,             0, [],      [[0]],                          14, 21,     80),
    h(MK.MK_FLAME_TURRET,      0, [],      [[0]],                          14, 24,     100,    TT.WALL,    0, HF.HORDE_NO_PERIODIC_SPAWN),
    h(MK.MK_DAR_BLADEMASTER,   2, [MK.MK_DAR_BLADEMASTER, MK.MK_DAR_PRIESTESS],
                                            [[0,1,1],[0,1,1]],              15, 17,     100),
    h(MK.MK_PINK_JELLY,        2, [MK.MK_PINK_JELLY, MK.MK_DAR_PRIESTESS],
                                            [[0,1,1],[1,2,1]],              17, 23,     70),
    h(MK.MK_KRAKEN,            0, [],      [[0]],                          15, 30,     100,    TT.DEEP_WATER),
    h(MK.MK_PHANTOM,           0, [],      [[0]],                          16, 23,     100),
    h(MK.MK_WRAITH,            1, [MK.MK_WRAITH],   [[1,4,1]],             16, 23,     80),
    h(MK.MK_IMP,               0, [],      [[0]],                          17, 24,     100),
    h(MK.MK_DAR_BLADEMASTER,   3, [MK.MK_DAR_BLADEMASTER, MK.MK_DAR_PRIESTESS, MK.MK_DAR_BATTLEMAGE],
                                            [[1,2,1],[1,1,1],[1,1,1]],      18, 25,     100),
    h(MK.MK_FURY,              1, [MK.MK_FURY],     [[2,4,1]],             18, 26,     80),
    h(MK.MK_REVENANT,          0, [],      [[0]],                          19, 27,     100),
    h(MK.MK_GOLEM,             0, [],      [[0]],                          21, 30,     100),
    h(MK.MK_TENTACLE_HORROR,   0, [],      [[0]],                          22, DEEPEST_LEVEL-1, 100),
    h(MK.MK_PHYLACTERY,        0, [],      [[0]],                          22, DEEPEST_LEVEL-1, 100),
    h(MK.MK_DRAGON,            0, [],      [[0]],                          24, DEEPEST_LEVEL-1, 70),
    h(MK.MK_DRAGON,            1, [MK.MK_DRAGON],   [[1,1,1]],             27, DEEPEST_LEVEL-1, 30),
    h(MK.MK_GOLEM,             3, [MK.MK_GOLEM, MK.MK_DAR_PRIESTESS, MK.MK_DAR_BATTLEMAGE],
                                            [[1,2,1],[0,1,1],[0,1,1]],      27, DEEPEST_LEVEL-1, 80),
    h(MK.MK_GOLEM,             1, [MK.MK_GOLEM],    [[5,10,2]],            30, DEEPEST_LEVEL-1, 20),
    h(MK.MK_KRAKEN,            1, [MK.MK_KRAKEN],   [[5,10,2]],            30, DEEPEST_LEVEL-1, 100, TT.DEEP_WATER),
    h(MK.MK_TENTACLE_HORROR,   2, [MK.MK_TENTACLE_HORROR, MK.MK_REVENANT],
                                            [[1,3,1],[2,4,1]],              32, DEEPEST_LEVEL-1, 20),
    h(MK.MK_DRAGON,            1, [MK.MK_DRAGON],   [[3,5,1]],             34, DEEPEST_LEVEL-1, 20),

    // ===== Summons =====
    h(MK.MK_GOBLIN_CONJURER,   1, [MK.MK_SPECTRAL_BLADE], [[3,5,1]],      0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED | HF.HORDE_DIES_ON_LEADER_DEATH),
    h(MK.MK_OGRE_SHAMAN,       1, [MK.MK_OGRE],    [[1,1,1]],             0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED),
    h(MK.MK_VAMPIRE,           1, [MK.MK_VAMPIRE_BAT], [[3,3,1]],          0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED),
    h(MK.MK_LICH,              1, [MK.MK_PHANTOM],  [[2,3,1]],             0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED),
    h(MK.MK_LICH,              1, [MK.MK_FURY],     [[2,3,1]],             0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED),
    h(MK.MK_PHYLACTERY,        1, [MK.MK_LICH],     [[1,1,1]],             0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED),
    h(MK.MK_GOBLIN_CHIEFTAN,   2, [MK.MK_GOBLIN_CONJURER, MK.MK_GOBLIN],
                                            [[1,1,1],[3,4,1]],              0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED | HF.HORDE_SUMMONED_AT_DISTANCE),
    h(MK.MK_PHOENIX_EGG,       1, [MK.MK_PHOENIX],  [[1,1,1]],             0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED),
    h(MK.MK_ELDRITCH_TOTEM,    1, [MK.MK_SPECTRAL_BLADE], [[4,7,1]],       0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED | HF.HORDE_DIES_ON_LEADER_DEATH),
    h(MK.MK_ELDRITCH_TOTEM,    1, [MK.MK_FURY],     [[2,3,1]],             0, 0, 100, TT.NOTHING, 0, HF.HORDE_IS_SUMMONED | HF.HORDE_DIES_ON_LEADER_DEATH),

    // ===== Captives (with captors) =====
    h(MK.MK_MONKEY,            1, [MK.MK_KOBOLD],   [[1,2,1]],             1, 5,  10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_GOBLIN,            1, [MK.MK_GOBLIN],   [[1,2,1]],             3, 7,  10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_OGRE,              1, [MK.MK_GOBLIN],   [[3,5,1]],             4, 10, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_GOBLIN_MYSTIC,     1, [MK.MK_KOBOLD],   [[3,7,1]],             5, 11, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_OGRE,              1, [MK.MK_OGRE],     [[1,2,1]],             8, 15, 20, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_TROLL,             1, [MK.MK_TROLL],    [[1,2,1]],             14, 19, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_CENTAUR,           1, [MK.MK_TROLL],    [[1,2,1]],             12, 19, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_TROLL,             2, [MK.MK_OGRE, MK.MK_OGRE_SHAMAN], [[2,3,1],[0,1,1]], 17, 19, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_DAR_BLADEMASTER,   1, [MK.MK_TROLL],    [[1,2,1]],             12, 19, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_NAGA,              1, [MK.MK_SALAMANDER], [[1,2,1]],            14, 20, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_SALAMANDER,        1, [MK.MK_NAGA],     [[1,2,1]],             13, 20, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_TROLL,             1, [MK.MK_SALAMANDER], [[1,2,1]],            13, 19, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_IMP,               1, [MK.MK_FURY],     [[2,4,1]],             18, 26, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_PIXIE,             1, [MK.MK_IMP],      [[1,2,1]],             14, 21, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_DAR_BLADEMASTER,   1, [MK.MK_FURY],     [[2,4,1]],             18, 26, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_DAR_BLADEMASTER,   1, [MK.MK_IMP],      [[2,3,1]],             18, 26, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_DAR_PRIESTESS,     1, [MK.MK_FURY],     [[2,4,1]],             18, 26, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_DAR_BATTLEMAGE,    1, [MK.MK_IMP],      [[2,3,1]],             18, 26, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_TENTACLE_HORROR,   3, [MK.MK_DAR_BLADEMASTER, MK.MK_DAR_PRIESTESS, MK.MK_DAR_BATTLEMAGE],
                                            [[1,2,1],[1,1,1],[1,1,1]],      20, 26, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),
    h(MK.MK_GOLEM,             3, [MK.MK_DAR_BLADEMASTER, MK.MK_DAR_PRIESTESS, MK.MK_DAR_BATTLEMAGE],
                                            [[1,2,1],[1,1,1],[1,1,1]],      18, 25, 10, TT.NOTHING, 0, HF.HORDE_LEADER_CAPTIVE | HF.HORDE_NEVER_OOD),

    // ===== Bosses =====
    h(MK.MK_GOBLIN_CHIEFTAN,   2, [MK.MK_GOBLIN_MYSTIC, MK.MK_GOBLIN], [[1,1,1],[2,3,1]], 2, 10, 50, TT.NOTHING, 0, HF.HORDE_MACHINE_BOSS),
    h(MK.MK_BLACK_JELLY,       0, [],      [[0]],                          5, 15, 50, TT.NOTHING, 0, HF.HORDE_MACHINE_BOSS),
    h(MK.MK_VAMPIRE,           0, [],      [[0]],                          10, DEEPEST_LEVEL, 50, TT.NOTHING, 0, HF.HORDE_MACHINE_BOSS),
    h(MK.MK_FLAMEDANCER,       0, [],      [[0]],                          10, DEEPEST_LEVEL, 50, TT.NOTHING, 0, HF.HORDE_MACHINE_BOSS),

    // ===== Machine water monsters =====
    h(MK.MK_EEL,               0, [],      [[0]],                          2, 7,  100, TT.DEEP_WATER, 0, HF.HORDE_MACHINE_WATER_MONSTER),
    h(MK.MK_EEL,               1, [MK.MK_EEL],     [[2,4,1]],             5, 15, 100, TT.DEEP_WATER, 0, HF.HORDE_MACHINE_WATER_MONSTER),
    h(MK.MK_KRAKEN,            0, [],      [[0]],                          12, DEEPEST_LEVEL, 100, TT.DEEP_WATER, 0, HF.HORDE_MACHINE_WATER_MONSTER),
    h(MK.MK_KRAKEN,            1, [MK.MK_EEL],     [[1,2,1]],             12, DEEPEST_LEVEL, 80, TT.DEEP_WATER, 0, HF.HORDE_MACHINE_WATER_MONSTER),

    // ===== Dungeon captives — no captors =====
    h(MK.MK_OGRE,              0, [],      [[0]],                          4, 13, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_NAGA,              0, [],      [[0]],                          12, 20, 50, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN_MYSTIC,     0, [],      [[0]],                          2, 8, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_TROLL,             0, [],      [[0]],                          10, 20, 50, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_BLADEMASTER,   0, [],      [[0]],                          8, 16, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_PRIESTESS,     0, [],      [[0]],                          8, 14, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_WRAITH,            0, [],      [[0]],                          11, 20, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOLEM,             0, [],      [[0]],                          17, 23, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_TENTACLE_HORROR,   0, [],      [[0]],                          20, AMULET_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DRAGON,            0, [],      [[0]],                          23, AMULET_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE),

    // ===== Machine statue monsters =====
    h(MK.MK_GOBLIN,            0, [],      [[0]],                          1, 6,  100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_OGRE,              0, [],      [[0]],                          6, 12, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_WRAITH,            0, [],      [[0]],                          10, 17, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_NAGA,              0, [],      [[0]],                          12, 19, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_TROLL,             0, [],      [[0]],                          14, 21, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_GOLEM,             0, [],      [[0]],                          21, 30, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_DRAGON,            0, [],      [[0]],                          29, DEEPEST_LEVEL, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),
    h(MK.MK_TENTACLE_HORROR,   0, [],      [[0]],                          29, DEEPEST_LEVEL, 100, TT.STATUE_DORMANT, 0, HF.HORDE_MACHINE_STATUE),

    // ===== Machine turrets =====
    h(MK.MK_ARROW_TURRET,      0, [],      [[0]],                          5, 13, 100, TT.TURRET_DORMANT, 0, HF.HORDE_MACHINE_TURRET),
    h(MK.MK_SPARK_TURRET,      0, [],      [[0]],                          11, 18, 100, TT.TURRET_DORMANT, 0, HF.HORDE_MACHINE_TURRET),
    h(MK.MK_DART_TURRET,       0, [],      [[0]],                          15, 22, 100, TT.TURRET_DORMANT, 0, HF.HORDE_MACHINE_TURRET),
    h(MK.MK_FLAME_TURRET,      0, [],      [[0]],                          17, 24, 100, TT.TURRET_DORMANT, 0, HF.HORDE_MACHINE_TURRET),

    // ===== Machine mud monsters =====
    h(MK.MK_BOG_MONSTER,       0, [],      [[0]],                          12, 26, 100, TT.MACHINE_MUD_DORMANT, 0, HF.HORDE_MACHINE_MUD),
    h(MK.MK_KRAKEN,            0, [],      [[0]],                          17, 26, 30, TT.MACHINE_MUD_DORMANT, 0, HF.HORDE_MACHINE_MUD),

    // ===== Kennel monsters =====
    h(MK.MK_MONKEY,            0, [],      [[0]],                          1, 5,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN,            0, [],      [[0]],                          1, 8,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN_CONJURER,   0, [],      [[0]],                          2, 9,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN_MYSTIC,     0, [],      [[0]],                          2, 9,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_OGRE,              0, [],      [[0]],                          7, 17, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_TROLL,             0, [],      [[0]],                          12, 21, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_NAGA,              0, [],      [[0]],                          13, 23, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_SALAMANDER,        0, [],      [[0]],                          9, 20, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_IMP,               0, [],      [[0]],                          15, 26, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_PIXIE,             0, [],      [[0]],                          11, 21, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_BLADEMASTER,   0, [],      [[0]],                          9, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_PRIESTESS,     0, [],      [[0]],                          12, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_BATTLEMAGE,    0, [],      [[0]],                          13, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE),

    // ===== Vampire bloodbags =====
    h(MK.MK_MONKEY,            0, [],      [[0]],                          1, 5,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN,            0, [],      [[0]],                          1, 8,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN_CONJURER,   0, [],      [[0]],                          2, 9,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_GOBLIN_MYSTIC,     0, [],      [[0]],                          2, 9,  100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_OGRE,              0, [],      [[0]],                          5, 15, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_TROLL,             0, [],      [[0]],                          10, 19, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_NAGA,              0, [],      [[0]],                          9, 20, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_IMP,               0, [],      [[0]],                          15, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_PIXIE,             0, [],      [[0]],                          11, 21, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_BLADEMASTER,   0, [],      [[0]],                          9, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_PRIESTESS,     0, [],      [[0]],                          12, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),
    h(MK.MK_DAR_BATTLEMAGE,    0, [],      [[0]],                          13, AMULET_LEVEL, 100, TT.MONSTER_CAGE_CLOSED, 0, HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE),

    // ===== Key thieves =====
    h(MK.MK_MONKEY,            0, [],      [[0]],                          1, 14, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_THIEF),
    h(MK.MK_IMP,               0, [],      [[0]],                          15, DEEPEST_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_THIEF),

    // ===== Sacrifice victims =====
    h(MK.MK_MONKEY,            0, [],      [[0]],                          1, 5,  100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_GOBLIN,            0, [],      [[0]],                          3, 10, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_OGRE,              0, [],      [[0]],                          7, 13, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_TROLL,             0, [],      [[0]],                          12, 19, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_WRAITH,            0, [],      [[0]],                          10, 17, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_NAGA,              0, [],      [[0]],                          13, 20, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_DAR_BLADEMASTER,   0, [],      [[0]],                          10, 20, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_GOLEM,             0, [],      [[0]],                          21, DEEPEST_LEVEL, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_REVENANT,          0, [],      [[0]],                          21, DEEPEST_LEVEL, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),
    h(MK.MK_TENTACLE_HORROR,   0, [],      [[0]],                          21, DEEPEST_LEVEL, 100, TT.STATUE_INSTACRACK, 0, HF.HORDE_SACRIFICE_TARGET),

    // ===== Legendary allies =====
    h(MK.MK_UNICORN,           0, [],      [[0]],                          1, DEEPEST_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_LEGENDARY_ALLY | HF.HORDE_ALLIED_WITH_PLAYER),
    h(MK.MK_IFRIT,             0, [],      [[0]],                          1, DEEPEST_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_LEGENDARY_ALLY | HF.HORDE_ALLIED_WITH_PLAYER),
    h(MK.MK_PHOENIX_EGG,       0, [],      [[0]],                          1, DEEPEST_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_LEGENDARY_ALLY | HF.HORDE_ALLIED_WITH_PLAYER),
    h(MK.MK_ANCIENT_SPIRIT,    0, [],      [[0]],                          1, DEEPEST_LEVEL, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_LEGENDARY_ALLY | HF.HORDE_ALLIED_WITH_PLAYER),

    // ===== Goblin warren =====
    h(MK.MK_GOBLIN,            0, [],      [[0]],                          1, 10, 100, TT.NOTHING, 0, HF.HORDE_MACHINE_GOBLIN_WARREN),
    h(MK.MK_GOBLIN_CONJURER,   0, [],      [[0]],                          1, 10, 60, TT.NOTHING, 0, HF.HORDE_MACHINE_GOBLIN_WARREN),
    h(MK.MK_GOBLIN_TOTEM,      1, [MK.MK_GOBLIN],  [[2,4,1]],             5, 13, 100, TT.NOTHING, MT.CampArea, HF.HORDE_MACHINE_GOBLIN_WARREN),
    h(MK.MK_GOBLIN,            3, [MK.MK_GOBLIN, MK.MK_GOBLIN_MYSTIC, MK.MK_JACKAL],
                                            [[2,3,1],[1,2,1],[1,2,1]],      6, 12, 40, TT.NOTHING, 0, HF.HORDE_MACHINE_GOBLIN_WARREN),
    h(MK.MK_GOBLIN_CONJURER,   2, [MK.MK_GOBLIN_CONJURER, MK.MK_GOBLIN_MYSTIC],
                                            [[0,1,1],[1,1,1]],              7, 15, 40, TT.NOTHING, 0, HF.HORDE_MACHINE_GOBLIN_WARREN),
    h(MK.MK_GOBLIN_TOTEM,      4, [MK.MK_GOBLIN_TOTEM, MK.MK_GOBLIN_CONJURER, MK.MK_GOBLIN_MYSTIC, MK.MK_GOBLIN],
                                            [[1,2,1],[1,2,1],[1,2,1],[3,5,1]], 10, 17, 80, TT.NOTHING, MT.CampArea, HF.HORDE_MACHINE_GOBLIN_WARREN),
    h(MK.MK_GOBLIN,            1, [MK.MK_GOBLIN],   [[1,2,1]],             3, 7, 10, TT.NOTHING, 0, HF.HORDE_MACHINE_GOBLIN_WARREN | HF.HORDE_LEADER_CAPTIVE),
];
