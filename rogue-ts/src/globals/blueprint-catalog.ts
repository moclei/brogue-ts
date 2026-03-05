/*
 *  blueprint-catalog.ts — Blueprint catalog data (Brogue variant)
 *  brogue-ts
 *
 *  Ported from: src/variants/GlobalsBrogue.c blueprintCatalog_Brogue[]
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Blueprint, MachineFeature } from "../types/types.js";
import { TileType, DungeonLayer, DungeonFeatureType, DungeonProfileType, MonsterType, PotionKind, ScrollKind, WeaponKind, KeyKind } from "../types/enums.js";
import { ItemCategory } from "../types/enums.js";
import { ItemFlag, MachineFeatureFlag, BlueprintFlag, HordeFlag } from "../types/flags.js";

const AMULET_LEVEL = 26;
const DEEPEST_LEVEL = 40;

// Shorthand aliases for readability
const BP = BlueprintFlag;
const MF = MachineFeatureFlag;
const HF = HordeFlag;
const IF = ItemFlag;
const IC = ItemCategory;

const T = TileType;
const DL = {
    DUNGEON: DungeonLayer.Dungeon,
    SURFACE: DungeonLayer.Surface,
    LIQUID: DungeonLayer.Liquid,
    GAS: DungeonLayer.Gas,
};
const DF = DungeonFeatureType;
const DP = DungeonProfileType;
const MK = MonsterType;

// Helper to create a MachineFeature with defaults
function mf(
    featureDF: number,
    terrain: number,
    layer: number,
    instanceCountRange: [number, number],
    minimumInstanceCount: number,
    itemCategory: number,
    itemKind: number,
    monsterID: number,
    personalSpace: number,
    hordeFlags: number,
    itemFlags: number,
    flags: number,
): MachineFeature {
    return {
        featureDF: featureDF as DungeonFeatureType,
        terrain: terrain as TileType,
        layer: layer as DungeonLayer,
        instanceCountRange,
        minimumInstanceCount,
        itemCategory,
        itemKind,
        monsterID,
        personalSpace,
        hordeFlags,
        itemFlags,
        flags,
    };
}

// Helper to create a Blueprint
function bp(
    name: string,
    depthRange: [number, number],
    roomSize: [number, number],
    frequency: number,
    featureCount: number,
    dungeonProfileType: number,
    flags: number,
    features: MachineFeature[],
): Blueprint {
    return {
        name,
        depthRange,
        roomSize,
        frequency,
        featureCount,
        dungeonProfileType: dungeonProfileType as DungeonProfileType,
        flags,
        feature: features,
    };
}

export const blueprintCatalog: readonly Blueprint[] = [
    // 0: nothing
    bp("", [0, 0], [0, 0], 0, 0, 0, 0, []),

    // -- REWARD ROOMS --

    // 1: MT_REWARD_MULTI_LIBRARY
    bp("Mixed item library -- can check one item out at a time",
        [1, 12], [30, 50], 30, 6, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
        mf(0, T.ALTAR_CAGE_OPEN,   DL.DUNGEON, [1,1], 1, IC.WAND, -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, T.ALTAR_CAGE_OPEN,   DL.DUNGEON, [3,3], 3, (IC.WEAPON|IC.ARMOR|IC.WAND), -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_NO_THROWING_WEAPONS | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, T.ALTAR_CAGE_OPEN,   DL.DUNGEON, [2,3], 2, (IC.STAFF|IC.RING|IC.CHARM), -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_MAX_CHARGES_KNOWN | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_NO_THROWING_WEAPONS | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [2,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
    ]),

    // 2: MT_REWARD_MONO_LIBRARY
    bp("Single item category library -- can check one item out at a time",
        [1, 12], [30, 50], 15, 5, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
        mf(0, T.ALTAR_CAGE_OPEN,   DL.DUNGEON, [3,4], 3, IC.RING, -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_MAX_CHARGES_KNOWN | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_ALTERNATIVE | MF.MF_IMPREGNABLE)),
        mf(0, T.ALTAR_CAGE_OPEN,   DL.DUNGEON, [4,5], 4, IC.STAFF, -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_MAX_CHARGES_KNOWN | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_ALTERNATIVE | MF.MF_IMPREGNABLE)),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [2,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
    ]),

    // 3: MT_REWARD_CONSUMABLES
    bp("Treasure room -- apothecary or archive (potions or scrolls)",
        [8, AMULET_LEVEL], [20, 40], 20, 6, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, 0,                    0,          [5,7], 2, IC.POTION, -1, 0, 2, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, 0,                    0,          [4,6], 2, IC.SCROLL, -1, 0, 2, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.FUNGUS_FOREST,     DL.SURFACE, [3,4], 0, 0, -1, 0, 2, 0, 0, 0),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [2,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
    ]),

    // 4: MT_REWARD_PEDESTALS_PERMANENT
    bp("Guaranteed good permanent item on a glowing pedestal (runic weapon/armor or 2 staffs)",
        [5, 16], [10, 30], 30, 6, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [2,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
        mf(0, T.PEDESTAL,          DL.DUNGEON, [1,1], 1, IC.WEAPON, -1, 0, 2, 0, IF.ITEM_IDENTIFIED, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_REQUIRE_GOOD_RUNIC | MF.MF_NO_THROWING_WEAPONS | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.PEDESTAL,          DL.DUNGEON, [1,1], 1, IC.ARMOR, -1, 0, 2, 0, IF.ITEM_IDENTIFIED, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_REQUIRE_GOOD_RUNIC | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.PEDESTAL,          DL.DUNGEON, [2,2], 2, IC.STAFF, -1, 0, 2, 0, (IF.ITEM_KIND_AUTO_ID | IF.ITEM_MAX_CHARGES_KNOWN), (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
    ]),

    // 5: MT_REWARD_PEDESTALS_CONSUMABLE
    bp("Guaranteed good consumable item on glowing pedestals (scrolls of enchanting, potion of life)",
        [10, AMULET_LEVEL], [10, 30], 30, 5, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [1,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
        mf(0, T.PEDESTAL,          DL.DUNGEON, [1,1], 1, IC.SCROLL, ScrollKind.Enchanting, 0, 2, 0, IF.ITEM_KIND_AUTO_ID, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.PEDESTAL,          DL.DUNGEON, [1,1], 1, IC.POTION, PotionKind.Life, 0, 2, 0, IF.ITEM_KIND_AUTO_ID, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
    ]),

    // 6: MT_REWARD_COMMUTATION_ALTARS
    bp("Commutation altars",
        [13, AMULET_LEVEL], [10, 30], 50, 4, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [1,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
        mf(DF.DF_MAGIC_PIPING, T.COMMUTATION_ALTAR, DL.DUNGEON, [2,2], 2, 0, -1, 0, 2, 0, 0, MF.MF_TREAT_AS_BLOCKING),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
    ]),

    // 7: MT_REWARD_RESURRECTION_ALTAR
    bp("Resurrection altar",
        [13, AMULET_LEVEL], [10, 30], 30, 4, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_IMPREGNABLE | BP.BP_REWARD), [
        mf(0, T.CARPET,            DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.STATUE_INERT,      DL.DUNGEON, [1,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
        mf(DF.DF_MACHINE_FLOOR_TRIGGER_REPEATING, T.RESURRECTION_ALTAR, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, 0,                    0,          [1,1], 1, 0, 0,  0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
    ]),

    // 8: MT_REWARD_ADOPTED_ITEM
    bp("Outsourced item -- same item possibilities as in the good permanent item reward room (plus charms), but directly adopted by 1-2 key machines.",
        [5, 17], [0, 0], 20, 4, 0,
        (BP.BP_REWARD | BP.BP_NO_INTERIOR_FLAG), [
        mf(0, 0, 0, [1,1], 1, IC.WEAPON, -1, 0, 0, 0, (IF.ITEM_IDENTIFIED | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_REQUIRE_GOOD_RUNIC | MF.MF_NO_THROWING_WEAPONS | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_BUILD_ANYWHERE_ON_LEVEL)),
        mf(0, 0, 0, [1,1], 1, IC.ARMOR, -1, 0, 0, 0, (IF.ITEM_IDENTIFIED | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_REQUIRE_GOOD_RUNIC | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_BUILD_ANYWHERE_ON_LEVEL)),
        mf(0, 0, 0, [2,2], 2, IC.STAFF, -1, 0, 0, 0, (IF.ITEM_KIND_AUTO_ID | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_BUILD_ANYWHERE_ON_LEVEL)),
        mf(0, 0, 0, [1,2], 1, IC.CHARM, -1, 0, 0, 0, (IF.ITEM_KIND_AUTO_ID | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_BUILD_ANYWHERE_ON_LEVEL)),
    ]),

    // 9: MT_REWARD_DUNGEON
    bp("Dungeon -- two allies chained up for the taking",
        [5, AMULET_LEVEL], [30, 80], 12, 5, 0,
        (BP.BP_ROOM | BP.BP_REWARD), [
        mf(0, T.VOMIT, DL.SURFACE, [2,2], 2, 0, -1, 0, 2, (HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE), 0, (MF.MF_GENERATE_HORDE | MF.MF_TREAT_AS_BLOCKING)),
        mf(DF.DF_AMBIENT_BLOOD, T.MANACLE_T, DL.SURFACE, [1,2], 1, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_AMBIENT_BLOOD, T.MANACLE_L, DL.SURFACE, [1,2], 1, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_BONES, 0, 0, [2,3], 1, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_VOMIT, 0, 0, [2,3], 1, 0, -1, 0, 1, 0, 0, 0),
        mf(0, 0, 0, [1,1], 1, 0, 0, 0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
    ]),

    // 10: MT_REWARD_KENNEL
    bp("Kennel -- allies locked in cages in an open room; choose one or two to unlock and take with you.",
        [5, AMULET_LEVEL], [30, 80], 12, 4, 0,
        (BP.BP_ROOM | BP.BP_REWARD), [
        mf(0, T.MONSTER_CAGE_CLOSED, DL.DUNGEON, [3,5], 3, 0, -1, 0, 2, (HF.HORDE_MACHINE_KENNEL | HF.HORDE_LEADER_CAPTIVE), 0, (MF.MF_GENERATE_HORDE | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, 0, 0, [1,2], 1, IC.KEY, KeyKind.Cage, 0, 1, 0, (IF.ITEM_IS_KEY | IF.ITEM_PLAYER_AVOIDS), (MF.MF_PERMIT_BLOCKING | MF.MF_GENERATE_ITEM | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_SKELETON_KEY | MF.MF_KEY_DISPOSABLE)),
        mf(DF.DF_AMBIENT_BLOOD, 0, 0, [3,5], 3, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_BONES, 0, 0, [3,5], 3, 0, -1, 0, 1, 0, 0, 0),
        mf(0, T.TORCH_WALL, DL.DUNGEON, [2,3], 2, 0, 0, 0, 1, 0, 0, MF.MF_BUILD_IN_WALLS),
    ]),

    // 11: MT_REWARD_VAMPIRE_LAIR
    bp("Vampire lair -- allies locked in cages and chained in a hidden room with a vampire in a coffin; vampire has one cage key.",
        [10, AMULET_LEVEL], [50, 80], 5, 4, 0,
        (BP.BP_ROOM | BP.BP_REWARD | BP.BP_SURROUND_WITH_WALLS | BP.BP_PURGE_INTERIOR), [
        mf(DF.DF_AMBIENT_BLOOD, 0, 0, [1,2], 1, 0, -1, 0, 2, (HF.HORDE_MACHINE_CAPTIVE | HF.HORDE_LEADER_CAPTIVE), 0, (MF.MF_GENERATE_HORDE | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_AMBIENT_BLOOD, T.MONSTER_CAGE_CLOSED, DL.DUNGEON, [2,4], 2, 0, -1, 0, 2, (HF.HORDE_VAMPIRE_FODDER | HF.HORDE_LEADER_CAPTIVE), 0, (MF.MF_GENERATE_HORDE | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_TRIGGER_AREA, T.COFFIN_CLOSED, 0, [1,1], 1, IC.KEY, KeyKind.Cage, MK.MK_VAMPIRE, 1, 0, (IF.ITEM_IS_KEY | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_SKELETON_KEY | MF.MF_MONSTER_TAKE_ITEM | MF.MF_MONSTERS_DORMANT | MF.MF_FAR_FROM_ORIGIN | MF.MF_KEY_DISPOSABLE)),
        mf(DF.DF_AMBIENT_BLOOD, T.SECRET_DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
    ]),

    // 12: MT_REWARD_ASTRAL_PORTAL
    bp("Legendary ally -- approach the altar with the crystal key to activate a portal and summon a legendary ally.",
        [8, AMULET_LEVEL], [30, 50], 15, 2, 0,
        (BP.BP_ROOM | BP.BP_REWARD), [
        mf(DF.DF_LUMINESCENT_FUNGUS, T.ALTAR_KEYHOLE, DL.DUNGEON, [1,1], 1, IC.KEY, KeyKind.Portal, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_NOT_IN_HALLWAY | MF.MF_NEAR_ORIGIN | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_KEY_DISPOSABLE)),
        mf(DF.DF_LUMINESCENT_FUNGUS, T.PORTAL, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, HF.HORDE_MACHINE_LEGENDARY_ALLY, 0, (MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_FAR_FROM_ORIGIN)),
    ]),

    // 13: MT_REWARD_GOBLIN_WARREN
    bp("Goblin warren",
        [5, 15], [100, 200], 15, 9, DP.GoblinWarren,
        (BP.BP_ROOM | BP.BP_REWARD | BP.BP_MAXIMIZE_INTERIOR | BP.BP_REDESIGN_INTERIOR), [
        mf(0, T.MUD_FLOOR, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.MUD_DOORWAY, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.MUD_WALL, DL.DUNGEON, [1,1], 100, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_EVERYWHERE)),
        mf(0, T.PEDESTAL, DL.DUNGEON, [1,1], 1, IC.SCROLL, ScrollKind.Enchanting, MK.MK_GOBLIN_CHIEFTAN, 2, 0, IF.ITEM_KIND_AUTO_ID, (MF.MF_GENERATE_ITEM | MF.MF_MONSTER_SLEEPING | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.PEDESTAL, DL.DUNGEON, [1,1], 1, IC.POTION, PotionKind.Life, MK.MK_GOBLIN_CHIEFTAN, 2, 0, IF.ITEM_KIND_AUTO_ID, (MF.MF_GENERATE_ITEM | MF.MF_MONSTER_SLEEPING | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, 0, 0, [5, 8], 5, 0, -1, 0, 2, HF.HORDE_MACHINE_GOBLIN_WARREN, 0, (MF.MF_GENERATE_HORDE | MF.MF_NOT_IN_HALLWAY | MF.MF_MONSTER_SLEEPING)),
        mf(0, 0, 0, [2,3], 2, (IC.WEAPON|IC.ARMOR), -1, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_HAY, 0, 0, [10, 15], 1, 0, -1, 0, 1, 0, 0, MF.MF_NOT_IN_HALLWAY),
        mf(DF.DF_JUNK, 0, 0, [7, 12], 1, 0, -1, 0, 1, 0, 0, MF.MF_NOT_IN_HALLWAY),
    ]),

    // 14: MT_REWARD_SENTINEL_SANCTUARY
    bp("Sentinel sanctuary",
        [10, 23], [100, 200], 15, 10, DP.SentinelSanctuary,
        (BP.BP_ROOM | BP.BP_REWARD | BP.BP_MAXIMIZE_INTERIOR | BP.BP_REDESIGN_INTERIOR), [
        mf(0, T.MARBLE_FLOOR, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.CRYSTAL_WALL, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_EVERYWHERE)),
        mf(0, T.PEDESTAL, DL.DUNGEON, [1,1], 1, IC.SCROLL, ScrollKind.Enchanting, 0, 2, 0, IF.ITEM_KIND_AUTO_ID, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.PEDESTAL, DL.DUNGEON, [1,1], 1, IC.POTION, PotionKind.Life, 0, 2, 0, IF.ITEM_KIND_AUTO_ID, (MF.MF_GENERATE_ITEM | MF.MF_ALTERNATIVE | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [30, 35], 20, 0, -1, 0, 1, 0, 0, MF.MF_PERMIT_BLOCKING),
        mf(0, T.STATUE_INERT, DL.DUNGEON, [3, 5], 3, 0, -1, MK.MK_SENTINEL, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.STATUE_INERT, DL.DUNGEON, [10, 15], 8, 0, -1, MK.MK_SENTINEL, 2, 0, 0, MF.MF_BUILD_IN_WALLS),
        mf(0, 0, 0, [4, 6], 4, 0, -1, MK.MK_GUARDIAN, 1, 0, 0, MF.MF_TREAT_AS_BLOCKING),
        mf(0, 0, 0, [0, 2], 0, 0, -1, MK.MK_WINGED_GUARDIAN, 1, 0, 0, MF.MF_TREAT_AS_BLOCKING),
        mf(0, 0, 0, [2,3], 2, (IC.SCROLL | IC.POTION), -1, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // -- AMULET HOLDER --

    // 15: MT_AMULET_AREA
    bp("Statuary -- key on an altar, area full of statues; take key to cause statues to burst and reveal monsters",
        [10, AMULET_LEVEL], [35, 40], 0, 4, 0,
        (BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR), [
        mf(DF.DF_LUMINESCENT_FUNGUS, T.AMULET_SWITCH, DL.DUNGEON, [1,1], 1, IC.AMULET, -1, 0, 2, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.FUNGUS_FOREST, DL.SURFACE, [2,3], 0, 0, -1, 0, 2, 0, 0, MF.MF_NOT_IN_HALLWAY),
        mf(0, T.STATUE_INSTACRACK, DL.DUNGEON, [1,1], 1, 0, -1, MK.MK_WARDEN_OF_YENDOR, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_MONSTERS_DORMANT | MF.MF_FAR_FROM_ORIGIN | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN | MF.MF_IMPREGNABLE)),
        mf(0, T.TORCH_WALL, DL.DUNGEON, [3,4], 0, 0, 0, 0, 1, 0, 0, MF.MF_BUILD_IN_WALLS),
    ]),

    // -- VESTIBULES --

    // 16: MT_LOCKED_DOOR_VESTIBULE
    bp("Plain locked door, key guarded by an adoptive room",
        [1, AMULET_LEVEL], [1, 1], 100, 1, 0, BP.BP_VESTIBULE, [
        mf(0, T.LOCKED_DOOR, DL.DUNGEON, [1,1], 1, IC.KEY, KeyKind.Door, 0, 1, 0, (IF.ITEM_IS_KEY | IF.ITEM_PLAYER_AVOIDS), (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_GENERATE_ITEM | MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_KEY_DISPOSABLE | MF.MF_IMPREGNABLE)),
    ]),

    // 17: MT_SECRET_DOOR_VESTIBULE
    bp("Plain secret door",
        [2, AMULET_LEVEL], [1, 1], 1, 1, 0, BP.BP_VESTIBULE, [
        mf(0, T.SECRET_DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING)),
    ]),

    // 18: MT_SECRET_LEVER_VESTIBULE
    bp("Lever and either an exploding wall or a portcullis",
        [4, AMULET_LEVEL], [1, 1], 8, 3, 0, BP.BP_VESTIBULE, [
        mf(0, T.WORM_TUNNEL_OUTER_WALL, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_IMPREGNABLE | MF.MF_ALTERNATIVE)),
        mf(0, T.PORTCULLIS_CLOSED, DL.DUNGEON, [1,1], 1, 0, 0, 0, 3, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_IMPREGNABLE | MF.MF_ALTERNATIVE)),
        mf(0, T.WALL_LEVER_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_IMPREGNABLE)),
    ]),

    // 19: MT_FLAMMABLE_BARRICADE_VESTIBULE
    bp("Flammable barricade in the doorway -- burn the wooden barricade to enter",
        [1, 6], [1, 1], 10, 3, 0, BP.BP_VESTIBULE, [
        mf(0, T.WOODEN_BARRICADE, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
        mf(0, 0, 0, [1,1], 1, IC.WEAPON, WeaponKind.IncendiaryDart, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.Incineration, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
    ]),

    // 20: MT_STATUE_SHATTERING_VESTIBULE
    bp("Statue in the doorway -- use a scroll of shattering to enter",
        [1, AMULET_LEVEL], [1, 1], 6, 2, 0, BP.BP_VESTIBULE, [
        mf(0, T.STATUE_INERT_DOORWAY, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
        mf(0, 0, 0, [1,1], 1, IC.SCROLL, ScrollKind.Shattering, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 21: MT_STATUE_MONSTER_VESTIBULE
    bp("Statue in the doorway -- bursts to reveal monster",
        [5, AMULET_LEVEL], [2, 2], 6, 2, 0, BP.BP_VESTIBULE, [
        mf(0, T.STATUE_DORMANT_DOORWAY, DL.DUNGEON, [1, 1], 1, 0, -1, 0, 1, HF.HORDE_MACHINE_STATUE, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_AT_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(0, T.MACHINE_TRIGGER_FLOOR, DL.DUNGEON, [0,0], 1, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
    ]),

    // 22: MT_THROWING_TUTORIAL_VESTIBULE
    bp("Throwing tutorial -- toss an item onto the pressure plate to retract the portcullis",
        [1, 4], [70, 70], 8, 3, 0, BP.BP_VESTIBULE, [
        mf(DF.DF_MEDIUM_HOLE, T.MACHINE_PRESSURE_PLATE, DL.LIQUID, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.PORTCULLIS_CLOSED, DL.DUNGEON, [1,1], 1, 0, 0, 0, 3, 0, 0, (MF.MF_IMPREGNABLE | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(0, T.WORM_TUNNEL_OUTER_WALL, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_IMPREGNABLE | MF.MF_ALTERNATIVE)),
    ]),

    // 23: MT_PIT_TRAPS_VESTIBULE
    bp("Pit traps -- area outside entrance is full of pit traps",
        [1, AMULET_LEVEL], [30, 60], 8, 3, 0,
        (BP.BP_VESTIBULE | BP.BP_OPEN_INTERIOR | BP.BP_NO_INTERIOR_FLAG), [
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(0, T.SECRET_DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_IMPREGNABLE | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(0, T.TRAP_DOOR_HIDDEN, DL.DUNGEON, [60, 60], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
    ]),

    // 24: MT_BECKONING_OBSTACLE_VESTIBULE
    bp("Beckoning obstacle -- a mirrored totem guards the door, and glyph are around the doorway.",
        [5, AMULET_LEVEL], [15, 30], 8, 3, 0,
        (BP.BP_VESTIBULE | BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR), [
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [1,1], 0, 0, -1, 0, 1, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_EVERYWHERE)),
        mf(0, 0, 0, [1,1], 1, 0, -1, MK.MK_MIRRORED_TOTEM, 3, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_IN_VIEW_OF_ORIGIN | MF.MF_BUILD_ANYWHERE_ON_LEVEL)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [3,5], 2, 0, -1, 0, 2, 0, 0, MF.MF_TREAT_AS_BLOCKING),
    ]),

    // 25: MT_GUARDIAN_VESTIBULE
    bp("Guardian obstacle -- a guardian is in the door on a glyph, with other glyphs scattered around.",
        [6, AMULET_LEVEL], [25, 25], 8, 4, 0,
        (BP.BP_VESTIBULE | BP.BP_OPEN_INTERIOR), [
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, 0, MK.MK_GUARDIAN, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_ALTERNATIVE)),
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, 0, MK.MK_WINGED_GUARDIAN, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_ALTERNATIVE)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [10,10], 3, 0, -1, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_NEAR_ORIGIN)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [1,1], 0, 0, -1, 0, 2, 0, 0, (MF.MF_EVERYWHERE | MF.MF_PERMIT_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // -- KEY HOLDERS --
    // Remaining blueprints 26-65 follow same pattern but are very long.
    // For brevity, I'll include the key representative ones and skip disabled entries.
    // Each entry carefully maps C struct fields → TypeScript MachineFeature/Blueprint.

    // 26: MT_KEY_REWARD_LIBRARY
    bp("Nested item library -- can check one item out at a time, and one is a disposable key to another reward room",
        [1, AMULET_LEVEL], [30, 50], 35, 7, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_ADOPT_ITEM | BP.BP_IMPREGNABLE), [
        mf(0, T.CARPET, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.WALL, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE | MF.MF_EVERYWHERE)),
        mf(0, 0, 0, [1,1], 1, 0, 0, 0, 2, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_VESTIBULE)),
        mf(0, T.ALTAR_CAGE_OPEN, DL.DUNGEON, [1,2], 1, (IC.WEAPON|IC.ARMOR|IC.WAND), -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_NO_THROWING_WEAPONS | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, T.ALTAR_CAGE_OPEN, DL.DUNGEON, [1,2], 1, (IC.STAFF|IC.RING|IC.CHARM), -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_KIND_AUTO_ID | IF.ITEM_MAX_CHARGES_KNOWN | IF.ITEM_PLAYER_AVOIDS), (MF.MF_GENERATE_ITEM | MF.MF_NO_THROWING_WEAPONS | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, T.ALTAR_CAGE_OPEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, (IF.ITEM_IS_KEY | IF.ITEM_PLAYER_AVOIDS | IF.ITEM_MAX_CHARGES_KNOWN), (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE)),
        mf(0, T.STATUE_INERT, DL.DUNGEON, [1,3], 0, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
    ]),

    // 27: MT_KEY_SECRET_ROOM
    bp("Secret room -- key on an altar in a secret room",
        [1, AMULET_LEVEL], [15, 100], 1, 2, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM), [
        mf(0, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, IF.ITEM_PLAYER_AVOIDS, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.SECRET_DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
    ]),

    // 28: MT_KEY_THROWING_TUTORIAL_AREA
    bp("Throwing tutorial -- toss an item onto the pressure plate to retract the cage and reveal the key",
        [1, 4], [70, 80], 8, 2, 0, BP.BP_ADOPT_ITEM, [
        mf(0, T.ALTAR_CAGE_RETRACTABLE, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_IMPREGNABLE | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_MEDIUM_HOLE, T.MACHINE_PRESSURE_PLATE, DL.LIQUID, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 29: MT_KEY_RAT_TRAP_ROOM
    bp("Rat trap -- getting the key triggers paralysis vents nearby and also causes rats to burst out of the walls",
        [1, 8], [30, 70], 7, 3, 0,
        (BP.BP_ADOPT_ITEM | BP.BP_ROOM), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.MACHINE_PARALYSIS_VENT_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.RAT_TRAP_WALL_DORMANT, DL.DUNGEON, [10,20], 5, 0, -1, MK.MK_RAT, 1, 0, 0, (MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_NOT_ON_LEVEL_PERIMETER)),
    ]),

    // 30: MT_KEY_FIRE_TRANSPORTATION_ROOM
    bp("Fun with fire -- trigger the fire trap and coax the fire over to the wooden barricade surrounding the altar and key",
        [3, 10], [80, 100], 10, 6, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR), [
        mf(DF.DF_SURROUND_WOODEN_BARRICADE, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.GRASS, DL.SURFACE, [0,0], 0, 0, -1, 0, 0, 0, 0, (MF.MF_EVERYWHERE | MF.MF_ALTERNATIVE)),
        mf(DF.DF_SWAMP, 0, 0, [4,4], 2, 0, -1, 0, 2, 0, 0, (MF.MF_ALTERNATIVE | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.FLAMETHROWER_HIDDEN, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NEAR_ORIGIN)),
        mf(0, T.GAS_TRAP_POISON_HIDDEN, DL.DUNGEON, [3, 3], 1, 0, -1, 0, 5, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_ALTERNATIVE)),
        mf(0, 0, 0, [2,2], 1, IC.POTION, PotionKind.Lichen, 0, 3, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
    ]),

    // 31: MT_KEY_FLOOD_TRAP_ROOM
    bp("Flood room -- key on an altar in a room with pools of eel-infested waters; take key to flood room with shallow water",
        [3, AMULET_LEVEL], [80, 180], 10, 4, 0,
        (BP.BP_ROOM | BP.BP_SURROUND_WITH_WALLS | BP.BP_PURGE_LIQUIDS | BP.BP_PURGE_PATHING_BLOCKERS | BP.BP_ADOPT_ITEM), [
        mf(0, T.FLOOR_FLOODABLE, DL.LIQUID, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 5, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_SPREADABLE_WATER_POOL, 0, 0, [2, 4], 1, 0, -1, 0, 5, HF.HORDE_MACHINE_WATER_MONSTER, 0, MF.MF_GENERATE_HORDE),
        mf(DF.DF_GRASS, T.FOLIAGE, DL.SURFACE, [3, 4], 3, 0, -1, 0, 1, 0, 0, 0),
    ]),

    // 32: MT_KEY_FIRE_TRAP_ROOM
    bp("Fire trap room -- key on an altar, pools of water, fire traps all over the place.",
        [4, AMULET_LEVEL], [80, 180], 6, 5, 0,
        (BP.BP_ROOM | BP.BP_SURROUND_WITH_WALLS | BP.BP_PURGE_LIQUIDS | BP.BP_PURGE_PATHING_BLOCKERS | BP.BP_ADOPT_ITEM), [
        mf(0, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, 0, 0, [1, 1], 1, 0, -1, 0, 4, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.FLAMETHROWER_HIDDEN, DL.DUNGEON, [40, 60], 20, 0, -1, 0, 1, 0, 0, MF.MF_TREAT_AS_BLOCKING),
        mf(DF.DF_DEEP_WATER_POOL, 0, 0, [4, 4], 1, 0, -1, 0, 4, HF.HORDE_MACHINE_WATER_MONSTER, 0, MF.MF_GENERATE_HORDE),
        mf(DF.DF_GRASS, T.FOLIAGE, DL.SURFACE, [3, 4], 3, 0, -1, 0, 1, 0, 0, 0),
    ]),

    // 33: MT_KEY_THIEF_AREA
    bp("Thief area -- empty altar, monster with item, permanently fleeing.",
        [3, AMULET_LEVEL], [15, 20], 10, 2, 0, BP.BP_ADOPT_ITEM, [
        mf(DF.DF_LUMINESCENT_FUNGUS, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, HF.HORDE_MACHINE_THIEF, 0, (MF.MF_ADOPT_ITEM | MF.MF_BUILD_AT_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_GENERATE_HORDE | MF.MF_MONSTER_TAKE_ITEM | MF.MF_MONSTER_FLEEING)),
        mf(0, T.STATUE_INERT, 0, [3, 5], 2, 0, -1, 0, 2, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 34: MT_KEY_COLLAPSING_FLOOR_AREA
    bp("Collapsing floor area -- key on an altar in an area; take key to cause the floor of the area to collapse",
        [1, AMULET_LEVEL], [45, 65], 13, 3, 0,
        (BP.BP_ADOPT_ITEM | BP.BP_TREAT_AS_BLOCKING), [
        mf(0, T.FLOOR_FLOODABLE, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.ALTAR_SWITCH_RETRACTING, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_ADD_MACHINE_COLLAPSE_EDGE_DORMANT, 0, 0, [3, 3], 2, 0, -1, 0, 3, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 35: MT_KEY_PIT_TRAP_ROOM
    bp("Pit traps -- key on an altar, room full of pit traps",
        [1, AMULET_LEVEL], [30, 100], 10, 3, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM), [
        mf(0, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.TRAP_DOOR_HIDDEN, DL.DUNGEON, [30, 40], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(0, T.SECRET_DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
    ]),

    // 36: MT_KEY_LEVITATION_ROOM
    bp("Levitation challenge -- key on an altar, room filled with pit, levitation or lever elsewhere on level, bridge appears when you grab the key/lever.",
        [1, 13], [75, 120], 10, 9, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR | BP.BP_SURROUND_WITH_WALLS), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.TORCH_WALL, DL.DUNGEON, [1,4], 0, 0, 0, 0, 1, 0, 0, MF.MF_BUILD_IN_WALLS),
        mf(0, 0, 0, [1,1], 1, 0, 0, 0, 3, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(DF.DF_ADD_DORMANT_CHASM_HALO, T.CHASM, DL.LIQUID, [120, 120], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(DF.DF_ADD_DORMANT_CHASM_HALO, T.CHASM_WITH_HIDDEN_BRIDGE, DL.LIQUID, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_EVERYWHERE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.Levitation, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, T.WALL_LEVER_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_ALTERNATIVE | MF.MF_IMPREGNABLE)),
    ]),

    // 37: MT_KEY_WEB_CLIMBING_ROOM
    bp("Web climbing -- key on an altar, room filled with pit, spider at altar to shoot webs, bridge appears when you grab the key",
        [7, AMULET_LEVEL], [55, 90], 10, 7, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR | BP.BP_SURROUND_WITH_WALLS), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, MK.MK_SPIDER, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_IN_VIEW_OF_ORIGIN)),
        mf(0, T.TORCH_WALL, DL.DUNGEON, [1,4], 0, 0, 0, 0, 1, 0, 0, MF.MF_BUILD_IN_WALLS),
        mf(0, 0, 0, [1,1], 1, 0, 0, 0, 3, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(DF.DF_ADD_DORMANT_CHASM_HALO, T.CHASM, DL.LIQUID, [120, 120], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(DF.DF_ADD_DORMANT_CHASM_HALO, T.CHASM_WITH_HIDDEN_BRIDGE, DL.LIQUID, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_EVERYWHERE)),
    ]),

    // 38: MT_KEY_LAVA_MOAT_ROOM
    bp("Lava moat room -- key on an altar, room filled with lava, levitation/fire immunity/lever elsewhere on level, lava retracts when you grab the key/lever",
        [3, 13], [75, 120], 7, 7, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, 0, 0, [1,1], 1, 0, 0, 0, 2, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.LAVA, DL.LIQUID, [60,60], 1, 0, 0, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(DF.DF_LAVA_RETRACTABLE, T.LAVA_RETRACTABLE, DL.LIQUID, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_EVERYWHERE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.Levitation, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.FireImmunity, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, T.WALL_LEVER_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_ALTERNATIVE | MF.MF_IMPREGNABLE)),
    ]),

    // 39: MT_KEY_LAVA_MOAT_AREA
    bp("Lava moat area -- key on an altar, surrounded with lava, levitation/fire immunity elsewhere on level, lava retracts when you grab the key",
        [3, 13], [40, 60], 3, 5, 0,
        (BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR | BP.BP_TREAT_AS_BLOCKING), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_BUILD_AT_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.LAVA, DL.LIQUID, [60,60], 1, 0, 0, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(DF.DF_LAVA_RETRACTABLE, T.LAVA_RETRACTABLE, DL.LIQUID, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_EVERYWHERE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.Levitation, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.FireImmunity, 0, 1, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
    ]),

    // 40: MT_KEY_POISON_GAS_TRAP_ROOM
    bp("Poison gas -- key on an altar; take key to cause a caustic gas vent to appear and the door to be blocked; there is a hidden trapdoor or an escape item somewhere inside",
        [4, AMULET_LEVEL], [35, 60], 7, 7, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_ADOPT_ITEM), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.MACHINE_POISON_GAS_VENT_HIDDEN, DL.DUNGEON, [1,2], 1, 0, -1, 0, 2, 0, 0, 0),
        mf(0, T.TRAP_DOOR_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, MF.MF_ALTERNATIVE),
        mf(0, 0, 0, [1,1], 1, IC.SCROLL, ScrollKind.Teleport, 0, 2, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, 0, 0, [1,1], 1, IC.POTION, PotionKind.Descent, 0, 2, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, T.WALL_LEVER_HIDDEN_DORMANT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_IMPREGNABLE)),
        mf(0, T.PORTCULLIS_DORMANT, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING)),
    ]),

    // 41: MT_KEY_EXPLOSIVE_TRAP_ROOM
    bp("Explosive situation -- key on an altar; take key to cause a methane gas vent to appear and a pilot light to ignite",
        [7, AMULET_LEVEL], [80, 90], 10, 5, 0,
        (BP.BP_ROOM | BP.BP_PURGE_LIQUIDS | BP.BP_SURROUND_WITH_WALLS | BP.BP_ADOPT_ITEM), [
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.FLOOR, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.MACHINE_METHANE_VENT_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, MF.MF_NEAR_ORIGIN),
        mf(0, T.PILOT_LIGHT_DORMANT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_BUILD_IN_WALLS)),
    ]),

    // 42: MT_KEY_BURNING_TRAP_ROOM
    bp("Burning grass -- key on an altar; take key to cause pilot light to ignite grass in room",
        [1, 7], [40, 110], 10, 6, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_ADOPT_ITEM | BP.BP_OPEN_INTERIOR), [
        mf(DF.DF_SMALL_DEAD_GRASS, T.ALTAR_SWITCH_RETRACTING, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_FAR_FROM_ORIGIN)),
        mf(DF.DF_DEAD_FOLIAGE, 0, DL.SURFACE, [2,3], 0, 0, -1, 0, 1, 0, 0, 0),
        mf(0, T.FOLIAGE, DL.SURFACE, [1,4], 0, 0, -1, 0, 1, 0, 0, 0),
        mf(0, T.GRASS, DL.SURFACE, [10,25], 0, 0, -1, 0, 1, 0, 0, 0),
        mf(0, T.DEAD_GRASS, DL.SURFACE, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.PILOT_LIGHT_DORMANT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_BUILD_IN_WALLS)),
    ]),

    // 43: MT_KEY_STATUARY_TRAP_AREA
    bp("Statuary -- key on an altar, area full of statues; take key to cause statues to burst and reveal monsters",
        [10, AMULET_LEVEL], [35, 90], 10, 2, 0,
        (BP.BP_ADOPT_ITEM | BP.BP_NO_INTERIOR_FLAG), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.STATUE_DORMANT, DL.DUNGEON, [3,5], 3, 0, -1, 0, 2, HF.HORDE_MACHINE_STATUE, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_FAR_FROM_ORIGIN)),
    ]),

    // 44: MT_KEY_GUARDIAN_WATER_PUZZLE_ROOM
    bp("Guardian water puzzle -- key held by a guardian, flood trap in the room, glyphs scattered. Lure the guardian into the water to have him drop the key.",
        [4, AMULET_LEVEL], [35, 70], 8, 4, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_ADOPT_ITEM), [
        mf(0, 0, 0, [1,1], 1, 0, -1, 0, 2, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, 0, 0, [1,1], 1, 0, -1, MK.MK_GUARDIAN, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_MONSTER_TAKE_ITEM)),
        mf(0, T.FLOOD_TRAP, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [1,1], 4, 0, -1, 0, 2, 0, 0, (MF.MF_EVERYWHERE | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 45: MT_KEY_GUARDIAN_GAUNTLET_ROOM
    bp("Guardian gauntlet -- key in a room full of guardians, glyphs scattered and unavoidable.",
        [6, AMULET_LEVEL], [50, 95], 10, 6, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM), [
        mf(DF.DF_GLYPH_CIRCLE, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 3, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
        mf(0, 0, 0, [3,6], 3, 0, -1, MK.MK_GUARDIAN, 2, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, 0, 0, [1,2], 1, 0, -1, MK.MK_WINGED_GUARDIAN, 2, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_ALTERNATIVE)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [10,15], 10, 0, -1, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [1,1], 0, 0, -1, 0, 2, 0, 0, (MF.MF_EVERYWHERE | MF.MF_PERMIT_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 46: MT_KEY_GUARDIAN_CORRIDOR_ROOM
    bp("Guardian corridor -- key in a small room, with a connecting corridor full of glyphs, one guardian blocking the corridor.",
        [4, AMULET_LEVEL], [85, 100], 5, 7, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR | BP.BP_SURROUND_WITH_WALLS), [
        mf(DF.DF_GLYPH_CIRCLE, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, MK.MK_GUARDIAN, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(DF.DF_GLYPH_CIRCLE, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, MK.MK_WINGED_GUARDIAN, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [3,5], 2, 0, 0, 0, 2, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
        mf(0, 0, 0, [1,1], 1, 0, 0, 0, 3, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.WALL, DL.DUNGEON, [80,80], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [1,1], 1, 0, 0, 0, 1, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_EVERYWHERE)),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN | MF.MF_NOT_IN_HALLWAY | MF.MF_BUILD_ANYWHERE_ON_LEVEL)),
    ]),

    // 47: MT_KEY_SACRIFICE_ROOM
    bp("Sacrifice altar -- lure the chosen monster from elsewhere on the level onto the altar to release the key.",
        [4, AMULET_LEVEL], [20, 60], 12, 6, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_OPEN_INTERIOR | BP.BP_SURROUND_WITH_WALLS), [
        mf(DF.DF_BONES, 0, 0, [3,4], 2, 0, -1, 0, 1, 0, 0, 0),
        mf(0, 0, 0, [1,1], 0, 0, -1, 0, 2, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_EVERYWHERE)),
        mf(DF.DF_TRIGGER_AREA, T.SACRIFICE_ALTAR_DORMANT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.SACRIFICE_CAGE_DORMANT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_NOT_IN_HALLWAY | MF.MF_IMPREGNABLE)),
        mf(0, T.DEMONIC_STATUE, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_NOT_IN_HALLWAY | MF.MF_IMPREGNABLE)),
        mf(0, T.STATUE_INSTACRACK, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, HF.HORDE_SACRIFICE_TARGET, 0, (MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_TREAT_AS_BLOCKING | MF.MF_IMPREGNABLE | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 48: MT_KEY_SUMMONING_CIRCLE_ROOM (DISABLED — frequency 0)
    bp("Summoning circle -- key in a room with an eldritch totem, glyphs unavoidable.",
        [12, AMULET_LEVEL], [50, 100], 0, 2, 0,
        (BP.BP_ROOM | BP.BP_OPEN_INTERIOR | BP.BP_ADOPT_ITEM), [
        mf(DF.DF_GLYPH_CIRCLE, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(DF.DF_GLYPH_CIRCLE, 0, 0, [1,1], 1, 0, -1, MK.MK_ELDRITCH_TOTEM, 3, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 49: MT_KEY_BECKONING_OBSTACLE_ROOM
    bp("Beckoning obstacle -- key surrounded by glyphs in a room with a mirrored totem.",
        [5, AMULET_LEVEL], [60, 100], 10, 4, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_ADOPT_ITEM), [
        mf(DF.DF_GLYPH_CIRCLE, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN | MF.MF_IN_VIEW_OF_ORIGIN)),
        mf(0, 0, 0, [1,1], 1, 0, -1, MK.MK_MIRRORED_TOTEM, 3, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_IN_VIEW_OF_ORIGIN)),
        mf(0, 0, 0, [1,1], 1, 0, -1, 0, 2, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.MACHINE_GLYPH, DL.DUNGEON, [3,5], 2, 0, -1, 0, 2, 0, 0, MF.MF_TREAT_AS_BLOCKING),
    ]),

    // 50: MT_KEY_WORM_TRAP_AREA
    bp("Worms in the walls -- key on altar; take key to cause underworms to burst out of the walls",
        [12, AMULET_LEVEL], [7, 7], 7, 2, 0, BP.BP_ADOPT_ITEM, [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.WALL_MONSTER_DORMANT, DL.DUNGEON, [5,8], 5, 0, -1, MK.MK_UNDERWORM, 1, 0, 0, (MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_NOT_ON_LEVEL_PERIMETER)),
    ]),

    // 51: MT_KEY_MUD_TRAP_ROOM
    bp("Mud pit -- key on an altar, room full of mud, take key to cause bog monsters to spawn in the mud",
        [12, AMULET_LEVEL], [40, 90], 10, 3, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_SURROUND_WITH_WALLS | BP.BP_PURGE_LIQUIDS), [
        mf(DF.DF_SWAMP, 0, 0, [5,5], 0, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_SWAMP, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(DF.DF_MUD_DORMANT, 0, 0, [3,4], 3, 0, -1, 0, 1, HF.HORDE_MACHINE_MUD, 0, (MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT)),
    ]),

    // 52: MT_KEY_ELECTRIC_CRYSTALS_ROOM
    bp("Electric crystals -- key caged on an altar, darkened crystal globes around the room, lightning the globes to release the key.",
        [6, AMULET_LEVEL], [40, 60], 10, 5, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR | BP.BP_PURGE_INTERIOR), [
        mf(0, T.CARPET, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.ELECTRIC_CRYSTAL_OFF, DL.DUNGEON, [3,4], 3, 0, -1, 0, 3, 0, 0, (MF.MF_NOT_IN_HALLWAY | MF.MF_IMPREGNABLE)),
        mf(0, T.SACRED_GLYPH, DL.DUNGEON, [1, 1], 1, 0, -1, 0, 1, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.ALTAR_CAGE_RETRACTABLE, DL.DUNGEON, [1,1], 1, 0, -1, 0, 3, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_IMPREGNABLE | MF.MF_NOT_IN_HALLWAY | MF.MF_FAR_FROM_ORIGIN)),
        mf(0, T.TURRET_LEVER, DL.DUNGEON, [7,9], 4, 0, -1, MK.MK_SPARK_TURRET, 3, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_MONSTERS_DORMANT | MF.MF_IMPREGNABLE)),
    ]),

    // 53: MT_KEY_ZOMBIE_TRAP_ROOM
    bp("Zombie crypt -- key on an altar; coffins scattered around; brazier in the room; take key to cause zombies to burst out of all of the coffins",
        [12, AMULET_LEVEL], [60, 90], 10, 8, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_SURROUND_WITH_WALLS | BP.BP_PURGE_INTERIOR), [
        mf(0, T.DOOR, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(DF.DF_BONES, 0, 0, [3,4], 2, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_ASH, 0, 0, [3,4], 2, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_AMBIENT_BLOOD, 0, 0, [1,2], 1, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_AMBIENT_BLOOD, 0, 0, [1,2], 1, 0, -1, 0, 1, 0, 0, 0),
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.BRAZIER, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.COFFIN_CLOSED, DL.DUNGEON, [6,8], 1, 0, 0, MK.MK_ZOMBIE, 2, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY | MF.MF_MONSTERS_DORMANT)),
    ]),

    // 54: MT_KEY_PHANTOM_TRAP_ROOM
    bp("Haunted house -- key on an altar; take key to cause the room to darken, ectoplasm to cover everything and phantoms to appear",
        [16, AMULET_LEVEL], [45, 150], 10, 4, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.DARK_FLOOR_DORMANT, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.DARK_FLOOR_DORMANT, DL.DUNGEON, [4,5], 4, 0, -1, MK.MK_PHANTOM, 1, 0, 0, MF.MF_MONSTERS_DORMANT),
        mf(0, T.HAUNTED_TORCH_DORMANT, DL.DUNGEON, [5,10], 3, 0, -1, 0, 2, 0, 0, MF.MF_BUILD_IN_WALLS),
    ]),

    // 55: MT_KEY_WORM_TUNNEL_ROOM
    bp("Worm tunnels -- hidden lever causes tunnels to open up revealing worm areas and a key",
        [8, AMULET_LEVEL], [80, 175], 10, 6, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_PURGE_INTERIOR | BP.BP_MAXIMIZE_INTERIOR | BP.BP_SURROUND_WITH_WALLS), [
        mf(0, T.ALTAR_INERT, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, 0, 0, [3,6], 3, 0, -1, MK.MK_UNDERWORM, 1, 0, 0, 0),
        mf(0, T.GRANITE, DL.DUNGEON, [150,150], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(DF.DF_WORM_TUNNEL_MARKER_DORMANT, T.GRANITE, DL.DUNGEON, [0,0], 0, 0, -1, 0, 0, 0, 0, (MF.MF_EVERYWHERE | MF.MF_PERMIT_BLOCKING)),
        mf(DF.DF_TUNNELIZE, T.WORM_TUNNEL_OUTER_WALL, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_PERMIT_BLOCKING)),
        mf(0, T.WALL_LEVER_HIDDEN, DL.DUNGEON, [1,1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_IN_WALLS | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN | MF.MF_BUILD_ANYWHERE_ON_LEVEL | MF.MF_IMPREGNABLE)),
    ]),

    // 56: MT_KEY_TURRET_TRAP_ROOM
    bp("Gauntlet -- key on an altar; take key to cause turrets to emerge",
        [5, 24], [35, 90], 10, 2, 0,
        (BP.BP_ADOPT_ITEM | BP.BP_NO_INTERIOR_FLAG), [
        mf(0, T.ALTAR_SWITCH, DL.DUNGEON, [1,1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_ADOPT_ITEM | MF.MF_NEAR_ORIGIN | MF.MF_NOT_IN_HALLWAY | MF.MF_TREAT_AS_BLOCKING)),
        mf(0, T.TURRET_DORMANT, DL.DUNGEON, [4,6], 4, 0, -1, 0, 2, HF.HORDE_MACHINE_TURRET, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_IN_VIEW_OF_ORIGIN)),
    ]),

    // 57: MT_KEY_BOSS_ROOM
    bp("Boss -- key is held by a boss atop a pile of bones in a secret room. A few fungus patches light up the area.",
        [5, AMULET_LEVEL], [40, 100], 18, 3, 0,
        (BP.BP_ROOM | BP.BP_ADOPT_ITEM | BP.BP_SURROUND_WITH_WALLS | BP.BP_PURGE_LIQUIDS), [
        mf(DF.DF_BONES, T.SECRET_DOOR, DL.DUNGEON, [1,1], 1, 0, 0, 0, 3, 0, 0, (MF.MF_PERMIT_BLOCKING | MF.MF_BUILD_AT_ORIGIN)),
        mf(DF.DF_LUMINESCENT_FUNGUS, T.STATUE_INERT, DL.DUNGEON, [7,7], 0, 0, -1, 0, 2, 0, 0, MF.MF_TREAT_AS_BLOCKING),
        mf(DF.DF_BONES, 0, 0, [1,1], 1, 0, -1, 0, 1, HF.HORDE_MACHINE_BOSS, 0, (MF.MF_ADOPT_ITEM | MF.MF_FAR_FROM_ORIGIN | MF.MF_MONSTER_TAKE_ITEM | MF.MF_GENERATE_HORDE | MF.MF_MONSTER_SLEEPING)),
    ]),

    // -- FLAVOR MACHINES --

    // 58: MT_BLOODFLOWER_AREA
    bp("Bloodwort -- bloodwort stalk, some pods, and surrounding grass",
        [1, DEEPEST_LEVEL], [5, 5], 0, 2, 0, BP.BP_TREAT_AS_BLOCKING, [
        mf(DF.DF_GRASS, T.BLOODFLOWER_STALK, DL.SURFACE, [1, 1], 1, 0, -1, 0, 0, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
        mf(DF.DF_BLOODFLOWER_PODS_GROW_INITIAL, 0, 0, [1, 1], 1, 0, -1, 0, 1, 0, 0, (MF.MF_BUILD_AT_ORIGIN | MF.MF_TREAT_AS_BLOCKING)),
    ]),

    // 59: MT_SHRINE_AREA
    bp("Shrine -- safe haven constructed and abandoned by a past adventurer",
        [1, DEEPEST_LEVEL], [15, 25], 0, 3, 0,
        (BP.BP_ROOM | BP.BP_PURGE_INTERIOR | BP.BP_SURROUND_WITH_WALLS | BP.BP_OPEN_INTERIOR), [
        mf(0, T.SACRED_GLYPH, DL.DUNGEON, [1, 1], 1, 0, -1, 0, 3, 0, 0, MF.MF_BUILD_AT_ORIGIN),
        mf(0, T.HAVEN_BEDROLL, DL.SURFACE, [1, 1], 1, 0, -1, 0, 2, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.BONES, DL.SURFACE, [1, 1], 1, (IC.POTION|IC.SCROLL|IC.WEAPON|IC.ARMOR|IC.RING), -1, 0, 2, 0, 0, (MF.MF_GENERATE_ITEM | MF.MF_TREAT_AS_BLOCKING | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 60: MT_IDYLL_AREA
    bp("Idyll -- ponds and some grass and forest",
        [1, DEEPEST_LEVEL], [80, 120], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(DF.DF_GRASS, T.FOLIAGE, DL.SURFACE, [3, 4], 3, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_DEEP_WATER_POOL, 0, 0, [2, 3], 2, 0, -1, 0, 5, 0, 0, MF.MF_NOT_IN_HALLWAY),
    ]),

    // 61: MT_SWAMP_AREA
    bp("Swamp -- mud, grass and some shallow water",
        [1, DEEPEST_LEVEL], [50, 65], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(DF.DF_SWAMP, 0, 0, [6, 8], 3, 0, -1, 0, 1, 0, 0, 0),
        mf(DF.DF_DEEP_WATER_POOL, 0, 0, [0, 1], 0, 0, -1, 0, 3, 0, 0, (MF.MF_NOT_IN_HALLWAY | MF.MF_TREAT_AS_BLOCKING)),
    ]),

    // 62: MT_CAMP_AREA
    bp("Camp -- hay, junk, urine, vomit",
        [1, DEEPEST_LEVEL], [40, 50], 0, 4, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(DF.DF_HAY, 0, 0, [1, 3], 1, 0, -1, 0, 1, 0, 0, (MF.MF_NOT_IN_HALLWAY | MF.MF_IN_VIEW_OF_ORIGIN)),
        mf(DF.DF_JUNK, 0, 0, [1, 2], 1, 0, -1, 0, 3, 0, 0, (MF.MF_NOT_IN_HALLWAY | MF.MF_IN_VIEW_OF_ORIGIN)),
        mf(DF.DF_URINE, 0, 0, [3, 5], 1, 0, -1, 0, 1, 0, 0, MF.MF_IN_VIEW_OF_ORIGIN),
        mf(DF.DF_VOMIT, 0, 0, [0, 2], 0, 0, -1, 0, 1, 0, 0, MF.MF_IN_VIEW_OF_ORIGIN),
    ]),

    // 63: MT_REMNANT_AREA
    bp("Remnant -- carpet surrounded by ash and with some statues",
        [1, DEEPEST_LEVEL], [80, 120], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(DF.DF_REMNANT, 0, 0, [6, 8], 3, 0, -1, 0, 1, 0, 0, 0),
        mf(0, T.STATUE_INERT, DL.DUNGEON, [3, 5], 2, 0, -1, 0, 1, 0, 0, (MF.MF_NOT_IN_HALLWAY | MF.MF_TREAT_AS_BLOCKING)),
    ]),

    // 64: MT_DISMAL_AREA
    bp("Dismal -- blood, bones, charcoal, some rubble",
        [1, DEEPEST_LEVEL], [60, 70], 0, 3, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(DF.DF_AMBIENT_BLOOD, 0, 0, [5,10], 3, 0, -1, 0, 1, 0, 0, MF.MF_NOT_IN_HALLWAY),
        mf(DF.DF_ASH, 0, 0, [4, 8], 2, 0, -1, 0, 1, 0, 0, MF.MF_NOT_IN_HALLWAY),
        mf(DF.DF_BONES, 0, 0, [3, 5], 2, 0, -1, 0, 1, 0, 0, MF.MF_NOT_IN_HALLWAY),
    ]),

    // 65: MT_BRIDGE_TURRET_AREA
    bp("Chasm catwalk -- narrow bridge over a chasm, possibly under fire from a turret or two",
        [1, DEEPEST_LEVEL-1], [40, 80], 0, 4, 0,
        (BP.BP_REQUIRE_BLOCKING | BP.BP_OPEN_INTERIOR | BP.BP_NO_INTERIOR_FLAG), [
        mf(DF.DF_CHASM_HOLE, 0, 0, [80, 80], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(DF.DF_CATWALK_BRIDGE, 0, 0, [0,0], 0, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
        mf(0, T.MACHINE_TRIGGER_FLOOR, DL.DUNGEON, [0,1], 0, 0, 0, 0, 1, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_PERMIT_BLOCKING)),
        mf(0, T.TURRET_DORMANT, DL.DUNGEON, [1, 2], 1, 0, -1, 0, 2, HF.HORDE_MACHINE_TURRET, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_IN_VIEW_OF_ORIGIN)),
    ]),

    // 66: MT_LAKE_PATH_TURRET_AREA
    bp("Lake walk -- narrow bridge of shallow water through a lake, possibly under fire from a turret or two",
        [1, DEEPEST_LEVEL], [40, 80], 0, 3, 0,
        (BP.BP_REQUIRE_BLOCKING | BP.BP_OPEN_INTERIOR | BP.BP_NO_INTERIOR_FLAG), [
        mf(DF.DF_LAKE_CELL, 0, 0, [80, 80], 1, 0, -1, 0, 1, 0, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_REPEAT_UNTIL_NO_PROGRESS)),
        mf(0, T.MACHINE_TRIGGER_FLOOR, DL.DUNGEON, [0,1], 0, 0, 0, 0, 1, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_PERMIT_BLOCKING)),
        mf(0, T.TURRET_DORMANT, DL.DUNGEON, [1, 2], 1, 0, -1, 0, 2, HF.HORDE_MACHINE_TURRET, 0, (MF.MF_TREAT_AS_BLOCKING | MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_IN_VIEW_OF_ORIGIN)),
    ]),

    // 67: MT_PARALYSIS_TRAP_AREA
    bp("Paralysis trap -- already-revealed pressure plate with a few hidden vents nearby.",
        [1, DEEPEST_LEVEL], [35, 40], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(0, T.GAS_TRAP_PARALYSIS, DL.DUNGEON, [1,2], 1, 0, 0, 0, 3, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.MACHINE_PARALYSIS_VENT_HIDDEN, DL.DUNGEON, [3, 4], 2, 0, 0, 0, 3, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 68: MT_PARALYSIS_TRAP_HIDDEN_AREA
    bp("Paralysis trap -- hidden pressure plate with a few vents nearby.",
        [1, DEEPEST_LEVEL], [35, 40], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(0, T.GAS_TRAP_PARALYSIS_HIDDEN, DL.DUNGEON, [1,2], 1, 0, 0, 0, 3, 0, 0, (MF.MF_NEAR_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
        mf(0, T.MACHINE_PARALYSIS_VENT_HIDDEN, DL.DUNGEON, [3, 4], 2, 0, 0, 0, 3, 0, 0, (MF.MF_FAR_FROM_ORIGIN | MF.MF_NOT_IN_HALLWAY)),
    ]),

    // 69: MT_TRICK_STATUE_AREA
    bp("Statue comes alive -- innocent-looking statue that bursts to reveal a monster when the player approaches",
        [1, DEEPEST_LEVEL], [5, 5], 0, 3, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(0, T.STATUE_DORMANT, DL.DUNGEON, [1, 1], 1, 0, -1, 0, 1, HF.HORDE_MACHINE_STATUE, 0, (MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_AT_ORIGIN | MF.MF_ALTERNATIVE)),
        mf(0, T.STATUE_DORMANT, DL.DUNGEON, [1, 1], 1, 0, -1, 0, 1, HF.HORDE_MACHINE_STATUE, 0, (MF.MF_GENERATE_HORDE | MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_ALTERNATIVE | MF.MF_NOT_ON_LEVEL_PERIMETER)),
        mf(0, T.MACHINE_TRIGGER_FLOOR, DL.DUNGEON, [0,0], 2, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
    ]),

    // 70: MT_WORM_AREA
    bp("Worms in the walls -- step on trigger region to cause underworms to burst out of the walls",
        [1, DEEPEST_LEVEL], [7, 7], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(0, T.WALL_MONSTER_DORMANT, DL.DUNGEON, [1, 3], 1, 0, -1, MK.MK_UNDERWORM, 1, 0, 0, (MF.MF_MONSTERS_DORMANT | MF.MF_BUILD_IN_WALLS | MF.MF_NOT_ON_LEVEL_PERIMETER)),
        mf(0, T.MACHINE_TRIGGER_FLOOR, DL.DUNGEON, [0,0], 2, 0, -1, 0, 0, 0, 0, MF.MF_EVERYWHERE),
    ]),

    // 71: MT_SENTINEL_AREA
    bp("Sentinels",
        [1, DEEPEST_LEVEL], [40, 40], 0, 2, 0, BP.BP_NO_INTERIOR_FLAG, [
        mf(0, T.STATUE_INERT, DL.DUNGEON, [3, 3], 3, 0, -1, MK.MK_SENTINEL, 2, 0, 0, (MF.MF_NOT_IN_HALLWAY | MF.MF_TREAT_AS_BLOCKING | MF.MF_IN_VIEW_OF_ORIGIN)),
        mf(DF.DF_ASH, 0, 0, [2, 3], 0, 0, -1, 0, 0, 0, 0, 0),
    ]),
];
