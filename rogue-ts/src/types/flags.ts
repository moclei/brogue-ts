/*
 *  flags.ts — Bitfield flag constants from Rogue.h
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

/**
 * Fl(N) — Unsigned 32-bit flag at bit position N.
 * Mirrors the C macro: #define Fl(N) ((unsigned long) 1 << (N))
 */
export function Fl(n: number): number {
    return (1 << n) >>> 0;
}

// ===== tileFlags (cell flags — non-terrain) =====

export const TileFlag = {
    DISCOVERED:                 Fl(0),
    VISIBLE:                    Fl(1),
    HAS_PLAYER:                 Fl(2),
    HAS_MONSTER:                Fl(3),
    HAS_DORMANT_MONSTER:        Fl(4),
    HAS_ITEM:                   Fl(5),
    IN_FIELD_OF_VIEW:           Fl(6),
    WAS_VISIBLE:                Fl(7),
    HAS_STAIRS:                 Fl(8),
    SEARCHED_FROM_HERE:         Fl(9),
    IS_IN_SHADOW:               Fl(10),
    MAGIC_MAPPED:               Fl(11),
    ITEM_DETECTED:              Fl(12),
    CLAIRVOYANT_VISIBLE:        Fl(13),
    WAS_CLAIRVOYANT_VISIBLE:    Fl(14),
    CLAIRVOYANT_DARKENED:       Fl(15),
    CAUGHT_FIRE_THIS_TURN:      Fl(16),
    PRESSURE_PLATE_DEPRESSED:   Fl(17),
    STABLE_MEMORY:              Fl(18),
    KNOWN_TO_BE_TRAP_FREE:      Fl(19),
    IS_IN_PATH:                 Fl(20),
    IN_LOOP:                    Fl(21),
    IS_CHOKEPOINT:              Fl(22),
    IS_GATE_SITE:               Fl(23),
    IS_IN_ROOM_MACHINE:         Fl(24),
    IS_IN_AREA_MACHINE:         Fl(25),
    IS_POWERED:                 Fl(26),
    IMPREGNABLE:                Fl(27),
    TERRAIN_COLORS_DANCING:     Fl(28),
    TELEPATHIC_VISIBLE:         Fl(29),
    WAS_TELEPATHIC_VISIBLE:     Fl(30),
} as const;

// Composite tile flags
export const IS_IN_MACHINE = (TileFlag.IS_IN_ROOM_MACHINE | TileFlag.IS_IN_AREA_MACHINE) >>> 0;

export const PERMANENT_TILE_FLAGS = (
    TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED | TileFlag.ITEM_DETECTED | TileFlag.HAS_ITEM |
    TileFlag.HAS_DORMANT_MONSTER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS |
    TileFlag.SEARCHED_FROM_HERE | TileFlag.PRESSURE_PLATE_DEPRESSED | TileFlag.STABLE_MEMORY |
    TileFlag.KNOWN_TO_BE_TRAP_FREE | TileFlag.IN_LOOP | TileFlag.IS_CHOKEPOINT |
    TileFlag.IS_GATE_SITE | IS_IN_MACHINE | TileFlag.IMPREGNABLE
) >>> 0;

export const ANY_KIND_OF_VISIBLE = (
    TileFlag.VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.TELEPATHIC_VISIBLE
) >>> 0;

// ===== terrainFlagCatalog =====

export const TerrainFlag = {
    T_OBSTRUCTS_PASSABILITY:        Fl(0),
    T_OBSTRUCTS_VISION:             Fl(1),
    T_OBSTRUCTS_ITEMS:              Fl(2),
    T_OBSTRUCTS_SURFACE_EFFECTS:    Fl(3),
    T_OBSTRUCTS_GAS:                Fl(4),
    T_OBSTRUCTS_DIAGONAL_MOVEMENT:  Fl(5),
    T_SPONTANEOUSLY_IGNITES:        Fl(6),
    T_AUTO_DESCENT:                 Fl(7),
    T_LAVA_INSTA_DEATH:             Fl(8),
    T_CAUSES_POISON:                Fl(9),
    T_IS_FLAMMABLE:                 Fl(10),
    T_IS_FIRE:                      Fl(11),
    T_ENTANGLES:                    Fl(12),
    T_IS_DEEP_WATER:                Fl(13),
    T_CAUSES_DAMAGE:                Fl(14),
    T_CAUSES_NAUSEA:                Fl(15),
    T_CAUSES_PARALYSIS:             Fl(16),
    T_CAUSES_CONFUSION:             Fl(17),
    T_CAUSES_HEALING:               Fl(18),
    T_IS_DF_TRAP:                   Fl(19),
    T_CAUSES_EXPLOSIVE_DAMAGE:      Fl(20),
    T_SACRED:                       Fl(21),
} as const;

// Composite terrain flags
export const T_OBSTRUCTS_SCENT = (
    TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION |
    TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_LAVA_INSTA_DEATH |
    TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_SPONTANEOUSLY_IGNITES
) >>> 0;

export const T_PATHING_BLOCKER = (
    TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DF_TRAP |
    TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_IS_FIRE |
    TerrainFlag.T_SPONTANEOUSLY_IGNITES
) >>> 0;

export const T_DIVIDES_LEVEL = (
    TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DF_TRAP |
    TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DEEP_WATER
) >>> 0;

export const T_LAKE_PATHING_BLOCKER = (
    TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_LAVA_INSTA_DEATH |
    TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_SPONTANEOUSLY_IGNITES
) >>> 0;

export const T_WAYPOINT_BLOCKER = (
    TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DF_TRAP |
    TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_SPONTANEOUSLY_IGNITES
) >>> 0;

export const T_MOVES_ITEMS = (TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_LAVA_INSTA_DEATH) >>> 0;
export const T_CAN_BE_BRIDGED = TerrainFlag.T_AUTO_DESCENT;

export const T_OBSTRUCTS_EVERYTHING = (
    TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION |
    TerrainFlag.T_OBSTRUCTS_ITEMS | TerrainFlag.T_OBSTRUCTS_GAS |
    TerrainFlag.T_OBSTRUCTS_SURFACE_EFFECTS | TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT
) >>> 0;

export const T_HARMFUL_TERRAIN = (
    TerrainFlag.T_CAUSES_POISON | TerrainFlag.T_IS_FIRE | TerrainFlag.T_CAUSES_DAMAGE |
    TerrainFlag.T_CAUSES_PARALYSIS | TerrainFlag.T_CAUSES_CONFUSION |
    TerrainFlag.T_CAUSES_EXPLOSIVE_DAMAGE
) >>> 0;

export const T_RESPIRATION_IMMUNITIES = (
    TerrainFlag.T_CAUSES_DAMAGE | TerrainFlag.T_CAUSES_CONFUSION |
    TerrainFlag.T_CAUSES_PARALYSIS | TerrainFlag.T_CAUSES_NAUSEA
) >>> 0;

// ===== terrainMechanicalFlagCatalog =====

export const TerrainMechFlag = {
    TM_IS_SECRET:                           Fl(0),
    TM_PROMOTES_WITH_KEY:                   Fl(1),
    TM_PROMOTES_WITHOUT_KEY:                Fl(2),
    TM_PROMOTES_ON_CREATURE:                Fl(3),
    TM_PROMOTES_ON_ITEM:                    Fl(4),
    TM_PROMOTES_ON_ITEM_PICKUP:             Fl(5),
    TM_PROMOTES_ON_PLAYER_ENTRY:            Fl(6),
    TM_PROMOTES_ON_SACRIFICE_ENTRY:         Fl(7),
    TM_PROMOTES_ON_ELECTRICITY:             Fl(8),
    TM_ALLOWS_SUBMERGING:                   Fl(9),
    TM_IS_WIRED:                            Fl(10),
    TM_IS_CIRCUIT_BREAKER:                  Fl(11),
    TM_GAS_DISSIPATES:                      Fl(12),
    TM_GAS_DISSIPATES_QUICKLY:              Fl(13),
    TM_EXTINGUISHES_FIRE:                   Fl(14),
    TM_VANISHES_UPON_PROMOTION:             Fl(15),
    TM_REFLECTS_BOLTS:                      Fl(16),
    TM_STAND_IN_TILE:                       Fl(17),
    TM_LIST_IN_SIDEBAR:                     Fl(18),
    TM_VISUALLY_DISTINCT:                   Fl(19),
    TM_BRIGHT_MEMORY:                       Fl(20),
    TM_EXPLOSIVE_PROMOTE:                   Fl(21),
    TM_CONNECTS_LEVEL:                      Fl(22),
    TM_INTERRUPT_EXPLORATION_WHEN_SEEN:     Fl(23),
    TM_INVERT_WHEN_HIGHLIGHTED:             Fl(24),
    TM_SWAP_ENCHANTS_ACTIVATION:            Fl(25),
} as const;

export const TM_PROMOTES_ON_STEP = (TerrainMechFlag.TM_PROMOTES_ON_CREATURE | TerrainMechFlag.TM_PROMOTES_ON_ITEM) >>> 0;

// ===== DFFlags =====

export const DFFlag = {
    DFF_EVACUATE_CREATURES_FIRST:       Fl(0),
    DFF_SUBSEQ_EVERYWHERE:              Fl(1),
    DFF_TREAT_AS_BLOCKING:              Fl(2),
    DFF_PERMIT_BLOCKING:                Fl(3),
    DFF_ACTIVATE_DORMANT_MONSTER:       Fl(4),
    DFF_CLEAR_OTHER_TERRAIN:            Fl(5),
    DFF_BLOCKED_BY_OTHER_LAYERS:        Fl(6),
    DFF_SUPERPRIORITY:                  Fl(7),
    DFF_AGGRAVATES_MONSTERS:            Fl(8),
    DFF_RESURRECT_ALLY:                 Fl(9),
    DFF_CLEAR_LOWER_PRIORITY_TERRAIN:   Fl(10),
} as const;

// ===== boltFlags =====

export const BoltFlag = {
    BF_PASSES_THRU_CREATURES:       Fl(0),
    BF_HALTS_BEFORE_OBSTRUCTION:    Fl(1),
    BF_TARGET_ALLIES:               Fl(2),
    BF_TARGET_ENEMIES:              Fl(3),
    BF_FIERY:                       Fl(4),
    // Fl(5) unused
    BF_NEVER_REFLECTS:              Fl(6),
    BF_NOT_LEARNABLE:               Fl(7),
    BF_NOT_NEGATABLE:               Fl(8),
    BF_ELECTRIC:                    Fl(9),
    BF_DISPLAY_CHAR_ALONG_LENGTH:   Fl(10),
} as const;

// ===== itemFlags =====

export const ItemFlag = {
    ITEM_IDENTIFIED:            Fl(0),
    ITEM_EQUIPPED:              Fl(1),
    ITEM_CURSED:                Fl(2),
    ITEM_PROTECTED:             Fl(3),
    // Fl(4) unused
    ITEM_RUNIC:                 Fl(5),
    ITEM_RUNIC_HINTED:          Fl(6),
    ITEM_RUNIC_IDENTIFIED:      Fl(7),
    ITEM_CAN_BE_IDENTIFIED:     Fl(8),
    ITEM_PREPLACED:             Fl(9),
    ITEM_FLAMMABLE:             Fl(10),
    ITEM_MAGIC_DETECTED:        Fl(11),
    ITEM_MAX_CHARGES_KNOWN:     Fl(12),
    ITEM_IS_KEY:                Fl(13),
    ITEM_ATTACKS_STAGGER:       Fl(14),
    ITEM_ATTACKS_EXTEND:        Fl(15),
    ITEM_ATTACKS_QUICKLY:       Fl(16),
    ITEM_ATTACKS_PENETRATE:     Fl(17),
    ITEM_ATTACKS_ALL_ADJACENT:  Fl(18),
    ITEM_LUNGE_ATTACKS:         Fl(19),
    ITEM_SNEAK_ATTACK_BONUS:    Fl(20),
    ITEM_PASS_ATTACKS:          Fl(21),
    ITEM_KIND_AUTO_ID:          Fl(22),
    ITEM_PLAYER_AVOIDS:         Fl(23),
} as const;

// ===== hordeFlags =====

export const HordeFlag = {
    HORDE_DIES_ON_LEADER_DEATH:     Fl(0),
    HORDE_IS_SUMMONED:              Fl(1),
    HORDE_SUMMONED_AT_DISTANCE:     Fl(2),
    HORDE_LEADER_CAPTIVE:           Fl(3),
    HORDE_NO_PERIODIC_SPAWN:        Fl(4),
    HORDE_ALLIED_WITH_PLAYER:       Fl(5),
    HORDE_MACHINE_BOSS:             Fl(6),
    HORDE_MACHINE_WATER_MONSTER:    Fl(7),
    HORDE_MACHINE_CAPTIVE:          Fl(8),
    HORDE_MACHINE_STATUE:           Fl(9),
    HORDE_MACHINE_TURRET:           Fl(10),
    HORDE_MACHINE_MUD:              Fl(11),
    HORDE_MACHINE_KENNEL:           Fl(12),
    HORDE_VAMPIRE_FODDER:           Fl(13),
    HORDE_MACHINE_LEGENDARY_ALLY:   Fl(14),
    HORDE_NEVER_OOD:                Fl(15),
    HORDE_MACHINE_THIEF:            Fl(16),
    HORDE_MACHINE_GOBLIN_WARREN:    Fl(17),
    HORDE_SACRIFICE_TARGET:         Fl(18),
} as const;

export const HORDE_MACHINE_ONLY = (
    HordeFlag.HORDE_MACHINE_BOSS | HordeFlag.HORDE_MACHINE_WATER_MONSTER |
    HordeFlag.HORDE_MACHINE_CAPTIVE | HordeFlag.HORDE_MACHINE_STATUE |
    HordeFlag.HORDE_MACHINE_TURRET | HordeFlag.HORDE_MACHINE_MUD |
    HordeFlag.HORDE_MACHINE_KENNEL | HordeFlag.HORDE_VAMPIRE_FODDER |
    HordeFlag.HORDE_MACHINE_LEGENDARY_ALLY | HordeFlag.HORDE_MACHINE_THIEF |
    HordeFlag.HORDE_MACHINE_GOBLIN_WARREN | HordeFlag.HORDE_SACRIFICE_TARGET
) >>> 0;

// ===== monsterBehaviorFlags =====

export const MonsterBehaviorFlag = {
    MONST_INVISIBLE:                Fl(0),
    MONST_INANIMATE:                Fl(1),
    MONST_IMMOBILE:                 Fl(2),
    MONST_CARRY_ITEM_100:           Fl(3),
    MONST_CARRY_ITEM_25:            Fl(4),
    MONST_ALWAYS_HUNTING:           Fl(5),
    MONST_FLEES_NEAR_DEATH:         Fl(6),
    MONST_ATTACKABLE_THRU_WALLS:    Fl(7),
    MONST_DEFEND_DEGRADE_WEAPON:    Fl(8),
    MONST_IMMUNE_TO_WEAPONS:        Fl(9),
    MONST_FLIES:                    Fl(10),
    MONST_FLITS:                    Fl(11),
    MONST_IMMUNE_TO_FIRE:           Fl(12),
    MONST_CAST_SPELLS_SLOWLY:       Fl(13),
    MONST_IMMUNE_TO_WEBS:           Fl(14),
    MONST_REFLECT_50:               Fl(15),
    MONST_NEVER_SLEEPS:             Fl(16),
    MONST_FIERY:                    Fl(17),
    MONST_INVULNERABLE:             Fl(18),
    MONST_IMMUNE_TO_WATER:          Fl(19),
    MONST_RESTRICTED_TO_LIQUID:     Fl(20),
    MONST_SUBMERGES:                Fl(21),
    MONST_MAINTAINS_DISTANCE:       Fl(22),
    MONST_WILL_NOT_USE_STAIRS:      Fl(23),
    MONST_DIES_IF_NEGATED:          Fl(24),
    MONST_MALE:                     Fl(25),
    MONST_FEMALE:                   Fl(26),
    MONST_NOT_LISTED_IN_SIDEBAR:    Fl(27),
    MONST_GETS_TURN_ON_ACTIVATION:  Fl(28),
    MONST_ALWAYS_USE_ABILITY:       Fl(29),
    MONST_NO_POLYMORPH:             Fl(30),
} as const;

export const NEGATABLE_TRAITS = (
    MonsterBehaviorFlag.MONST_INVISIBLE | MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON |
    MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_FLIES |
    MonsterBehaviorFlag.MONST_FLITS | MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE |
    MonsterBehaviorFlag.MONST_REFLECT_50 | MonsterBehaviorFlag.MONST_FIERY |
    MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE
) >>> 0;

export const MONST_TURRET = (
    MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS | MonsterBehaviorFlag.MONST_NEVER_SLEEPS |
    MonsterBehaviorFlag.MONST_IMMOBILE | MonsterBehaviorFlag.MONST_INANIMATE |
    MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS | MonsterBehaviorFlag.MONST_WILL_NOT_USE_STAIRS
) >>> 0;

export const LEARNABLE_BEHAVIORS = (
    MonsterBehaviorFlag.MONST_INVISIBLE | MonsterBehaviorFlag.MONST_FLIES |
    MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE | MonsterBehaviorFlag.MONST_REFLECT_50
) >>> 0;

export const MONST_NEVER_VORPAL_ENEMY = (
    MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE |
    MonsterBehaviorFlag.MONST_IMMOBILE | MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID |
    MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION | MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE
) >>> 0;

export const MONST_NEVER_MUTATED = (
    MonsterBehaviorFlag.MONST_INVISIBLE | MonsterBehaviorFlag.MONST_INANIMATE |
    MonsterBehaviorFlag.MONST_IMMOBILE | MonsterBehaviorFlag.MONST_INVULNERABLE
) >>> 0;

// ===== monsterAbilityFlags =====

export const MonsterAbilityFlag = {
    MA_HIT_HALLUCINATE:         Fl(0),
    MA_HIT_STEAL_FLEE:          Fl(1),
    MA_HIT_BURN:                Fl(2),
    MA_ENTER_SUMMONS:           Fl(3),
    MA_HIT_DEGRADE_ARMOR:       Fl(4),
    MA_CAST_SUMMON:             Fl(5),
    MA_SEIZES:                  Fl(6),
    MA_POISONS:                 Fl(7),
    MA_DF_ON_DEATH:             Fl(8),
    MA_CLONE_SELF_ON_DEFEND:    Fl(9),
    MA_KAMIKAZE:                Fl(10),
    MA_TRANSFERENCE:            Fl(11),
    MA_CAUSES_WEAKNESS:         Fl(12),
    MA_ATTACKS_PENETRATE:       Fl(13),
    MA_ATTACKS_ALL_ADJACENT:    Fl(14),
    MA_ATTACKS_EXTEND:          Fl(15),
    MA_ATTACKS_STAGGER:         Fl(16),
    MA_AVOID_CORRIDORS:         Fl(17),
    MA_REFLECT_100:             Fl(18),
} as const;

export const SPECIAL_HIT = (
    MonsterAbilityFlag.MA_HIT_HALLUCINATE | MonsterAbilityFlag.MA_HIT_STEAL_FLEE |
    MonsterAbilityFlag.MA_HIT_DEGRADE_ARMOR | MonsterAbilityFlag.MA_POISONS |
    MonsterAbilityFlag.MA_TRANSFERENCE | MonsterAbilityFlag.MA_CAUSES_WEAKNESS |
    MonsterAbilityFlag.MA_HIT_BURN | MonsterAbilityFlag.MA_ATTACKS_STAGGER
) >>> 0;

export const LEARNABLE_ABILITIES = (
    MonsterAbilityFlag.MA_TRANSFERENCE | MonsterAbilityFlag.MA_CAUSES_WEAKNESS
) >>> 0;

export const MA_NON_NEGATABLE_ABILITIES = (
    MonsterAbilityFlag.MA_ATTACKS_PENETRATE | MonsterAbilityFlag.MA_ATTACKS_ALL_ADJACENT |
    MonsterAbilityFlag.MA_ATTACKS_EXTEND | MonsterAbilityFlag.MA_ATTACKS_STAGGER
) >>> 0;

export const MA_NEVER_VORPAL_ENEMY = MonsterAbilityFlag.MA_KAMIKAZE;
export const MA_NEVER_MUTATED = MonsterAbilityFlag.MA_KAMIKAZE;

// ===== monsterBookkeepingFlags =====

export const MonsterBookkeepingFlag = {
    MB_WAS_VISIBLE:             Fl(0),
    MB_TELEPATHICALLY_REVEALED: Fl(1),
    MB_PREPLACED:               Fl(2),
    MB_APPROACHING_UPSTAIRS:    Fl(3),
    MB_APPROACHING_DOWNSTAIRS:  Fl(4),
    MB_APPROACHING_PIT:         Fl(5),
    MB_LEADER:                  Fl(6),
    MB_FOLLOWER:                Fl(7),
    MB_CAPTIVE:                 Fl(8),
    MB_SEIZED:                  Fl(9),
    MB_SEIZING:                 Fl(10),
    MB_SUBMERGED:               Fl(11),
    MB_JUST_SUMMONED:           Fl(12),
    MB_WILL_FLASH:              Fl(13),
    MB_BOUND_TO_LEADER:         Fl(14),
    MB_MARKED_FOR_SACRIFICE:    Fl(15),
    MB_ABSORBING:               Fl(16),
    MB_DOES_NOT_TRACK_LEADER:   Fl(17),
    MB_IS_FALLING:              Fl(18),
    MB_IS_DYING:                Fl(19),
    MB_GIVEN_UP_ON_SCENT:       Fl(20),
    MB_IS_DORMANT:              Fl(21),
    MB_WEAPON_AUTO_ID:          Fl(22),
    MB_ALREADY_SEEN:            Fl(23),
    MB_ADMINISTRATIVE_DEATH:    Fl(24),
    MB_HAS_DIED:                Fl(25),
    MB_DOES_NOT_RESURRECT:      Fl(26),
} as const;

// ===== machineFeatureFlags =====

export const MachineFeatureFlag = {
    MF_GENERATE_ITEM:               Fl(0),
    MF_OUTSOURCE_ITEM_TO_MACHINE:   Fl(1),
    MF_BUILD_VESTIBULE:             Fl(2),
    MF_ADOPT_ITEM:                  Fl(3),
    MF_NO_THROWING_WEAPONS:         Fl(4),
    MF_GENERATE_HORDE:              Fl(5),
    MF_BUILD_AT_ORIGIN:             Fl(6),
    // Fl(7) unused
    MF_PERMIT_BLOCKING:             Fl(8),
    MF_TREAT_AS_BLOCKING:           Fl(9),
    MF_NEAR_ORIGIN:                 Fl(10),
    MF_FAR_FROM_ORIGIN:             Fl(11),
    MF_MONSTER_TAKE_ITEM:           Fl(12),
    MF_MONSTER_SLEEPING:            Fl(13),
    MF_MONSTER_FLEEING:             Fl(14),
    MF_EVERYWHERE:                  Fl(15),
    MF_ALTERNATIVE:                 Fl(16),
    MF_ALTERNATIVE_2:               Fl(17),
    MF_REQUIRE_GOOD_RUNIC:          Fl(18),
    MF_MONSTERS_DORMANT:            Fl(19),
    MF_REQUIRE_HEAVY_WEAPON:        Fl(20),
    MF_BUILD_IN_WALLS:              Fl(21),
    MF_BUILD_ANYWHERE_ON_LEVEL:     Fl(22),
    MF_REPEAT_UNTIL_NO_PROGRESS:    Fl(23),
    MF_IMPREGNABLE:                 Fl(24),
    MF_IN_VIEW_OF_ORIGIN:           Fl(25),
    MF_IN_PASSABLE_VIEW_OF_ORIGIN:  Fl(26),
    MF_NOT_IN_HALLWAY:              Fl(27),
    MF_NOT_ON_LEVEL_PERIMETER:      Fl(28),
    MF_SKELETON_KEY:                Fl(29),
    MF_KEY_DISPOSABLE:              Fl(30),
} as const;

// ===== blueprintFlags =====

export const BlueprintFlag = {
    BP_ADOPT_ITEM:              Fl(0),
    BP_VESTIBULE:               Fl(1),
    BP_PURGE_PATHING_BLOCKERS:  Fl(2),
    BP_PURGE_INTERIOR:          Fl(3),
    BP_PURGE_LIQUIDS:           Fl(4),
    BP_SURROUND_WITH_WALLS:     Fl(5),
    BP_IMPREGNABLE:             Fl(6),
    BP_REWARD:                  Fl(7),
    BP_OPEN_INTERIOR:           Fl(8),
    BP_MAXIMIZE_INTERIOR:       Fl(9),
    BP_ROOM:                    Fl(10),
    BP_TREAT_AS_BLOCKING:       Fl(11),
    BP_REQUIRE_BLOCKING:        Fl(12),
    BP_NO_INTERIOR_FLAG:        Fl(13),
    BP_REDESIGN_INTERIOR:       Fl(14),
} as const;

// ===== BUTTON_FLAGS =====

export const ButtonFlag = {
    B_DRAW:                 Fl(0),
    B_ENABLED:              Fl(1),
    B_GRADIENT:             Fl(2),
    B_HOVER_ENABLED:        Fl(3),
    B_WIDE_CLICK_AREA:      Fl(4),
    B_KEYPRESS_HIGHLIGHT:   Fl(5),
} as const;

// ===== messageFlags =====

export const MessageFlag = {
    REQUIRE_ACKNOWLEDGMENT: Fl(0),
    REFRESH_SIDEBAR:        Fl(1),
    FOLDABLE:               Fl(2),
} as const;
