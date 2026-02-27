/*
 *  monster-class-catalog.ts — monsterClassCatalog, ported from Globals.c
 *  brogue-ts
 */

import type { MonsterClass } from "../types/types.js";
import { MonsterType } from "../types/enums.js";

/**
 * Monster class catalog. Groups related monster types together for
 * horde generation and AI behavior.
 */
export const monsterClassCatalog: readonly MonsterClass[] = [
    { name: "abomination", frequency: 10, maxDepth: -1, memberList: [MonsterType.MK_BOG_MONSTER, MonsterType.MK_UNDERWORM, MonsterType.MK_KRAKEN, MonsterType.MK_TENTACLE_HORROR] },
    { name: "dar",         frequency: 10, maxDepth: 22, memberList: [MonsterType.MK_DAR_BLADEMASTER, MonsterType.MK_DAR_PRIESTESS, MonsterType.MK_DAR_BATTLEMAGE] },
    { name: "animal",      frequency: 10, maxDepth: 10, memberList: [MonsterType.MK_RAT, MonsterType.MK_MONKEY, MonsterType.MK_JACKAL, MonsterType.MK_EEL, MonsterType.MK_TOAD, MonsterType.MK_VAMPIRE_BAT, MonsterType.MK_CENTIPEDE, MonsterType.MK_SPIDER] },
    { name: "goblin",      frequency: 10, maxDepth: 10, memberList: [MonsterType.MK_GOBLIN, MonsterType.MK_GOBLIN_CONJURER, MonsterType.MK_GOBLIN_MYSTIC, MonsterType.MK_GOBLIN_TOTEM, MonsterType.MK_GOBLIN_CHIEFTAN, MonsterType.MK_SPECTRAL_BLADE] },
    { name: "ogre",        frequency: 10, maxDepth: 16, memberList: [MonsterType.MK_OGRE, MonsterType.MK_OGRE_SHAMAN, MonsterType.MK_OGRE_TOTEM] },
    { name: "dragon",      frequency: 10, maxDepth: -1, memberList: [MonsterType.MK_DRAGON] },
    { name: "undead",      frequency: 10, maxDepth: -1, memberList: [MonsterType.MK_ZOMBIE, MonsterType.MK_WRAITH, MonsterType.MK_VAMPIRE, MonsterType.MK_PHANTOM, MonsterType.MK_LICH, MonsterType.MK_REVENANT] },
    { name: "jelly",       frequency: 10, maxDepth: 15, memberList: [MonsterType.MK_PINK_JELLY, MonsterType.MK_BLACK_JELLY, MonsterType.MK_ACID_JELLY] },
    { name: "turret",      frequency: 5,  maxDepth: 18, memberList: [MonsterType.MK_ARROW_TURRET, MonsterType.MK_SPARK_TURRET, MonsterType.MK_DART_TURRET, MonsterType.MK_FLAME_TURRET] },
    { name: "infernal",    frequency: 10, maxDepth: -1, memberList: [MonsterType.MK_FLAMEDANCER, MonsterType.MK_IMP, MonsterType.MK_REVENANT, MonsterType.MK_FURY, MonsterType.MK_PHANTOM, MonsterType.MK_IFRIT] },
    { name: "mage",        frequency: 10, maxDepth: -1, memberList: [MonsterType.MK_GOBLIN_CONJURER, MonsterType.MK_GOBLIN_MYSTIC, MonsterType.MK_OGRE_SHAMAN, MonsterType.MK_DAR_PRIESTESS, MonsterType.MK_DAR_BATTLEMAGE, MonsterType.MK_PIXIE, MonsterType.MK_LICH] },
    { name: "waterborne",  frequency: 10, maxDepth: 17, memberList: [MonsterType.MK_EEL, MonsterType.MK_NAGA, MonsterType.MK_KRAKEN] },
    { name: "airborne",    frequency: 10, maxDepth: 15, memberList: [MonsterType.MK_VAMPIRE_BAT, MonsterType.MK_WILL_O_THE_WISP, MonsterType.MK_PIXIE, MonsterType.MK_PHANTOM, MonsterType.MK_FURY, MonsterType.MK_IFRIT, MonsterType.MK_PHOENIX] },
    { name: "fireborne",   frequency: 10, maxDepth: 12, memberList: [MonsterType.MK_WILL_O_THE_WISP, MonsterType.MK_SALAMANDER, MonsterType.MK_FLAMEDANCER, MonsterType.MK_PHOENIX] },
    { name: "troll",       frequency: 10, maxDepth: 15, memberList: [MonsterType.MK_TROLL] },
];
