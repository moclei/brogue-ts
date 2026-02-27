/*
 *  monster-creation.ts — Monster creation, initialization, and mutation
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: mutateMonster, generateMonster, initializeMonster,
 *             initializeStatus, initializeGender
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, CreatureType, Mutation, Item, GameConstants, Color } from "../types/types.js";
import { INVALID_POS } from "../types/types.js";
import { MonsterType, StatusEffect, CreatureState, CreatureMode, DungeonFeatureType } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterAbilityFlag,
    MonsterBookkeepingFlag,
    MONST_NEVER_MUTATED,
    MA_NEVER_MUTATED,
} from "../types/flags.js";
import { MAX_WAYPOINT_COUNT, NUMBER_MUTATORS, STOMACH_SIZE } from "../types/constants.js";

// ============================================================================
// RNG interface (mirrors ItemRNG pattern)
// ============================================================================

/** Minimal RNG interface for monster creation. */
export interface MonsterRNG {
    randRange(lo: number, hi: number): number;
    randPercent(pct: number): boolean;
}

// ============================================================================
// Context interfaces (DI pattern, following ItemGenContext)
// ============================================================================

/**
 * Context required for monster generation.
 * Bundles the data catalogs and game state needed to create and initialize
 * monsters, avoiding global state access.
 */
export interface MonsterGenContext {
    rng: MonsterRNG;
    gameConstants: GameConstants;
    /** Current depth level. */
    depthLevel: number;
    /** The full monster catalog, indexed by MonsterType. */
    monsterCatalog: readonly CreatureType[];
    /** The full mutation catalog. */
    mutationCatalog: readonly Mutation[];
    /** Queue of items to be given to monsters (pulled from front). */
    monsterItemsHopper: Item[];
    /** Whether items are enabled in this game mode. */
    itemsEnabled: boolean;
    /** Whether the creature is the player (used by initializeStatus). */
    isPlayer?: boolean;
}

// ============================================================================
// Helper: clamp
// ============================================================================

function clamp(val: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, val));
}

// ============================================================================
// initializeStatus
// ============================================================================

/**
 * Sets all status effects to zero, then applies intrinsic status effects
 * based on the creature's flags (fiery, flies, immune to fire, invisible).
 *
 * Ported from initializeStatus() in Monsters.c.
 */
export function initializeStatus(
    monst: Creature,
    isPlayer: boolean = false,
): void {
    const numStatuses = StatusEffect.NumberOfStatusEffects;
    monst.status = new Array(numStatuses).fill(0);
    monst.maxStatus = new Array(numStatuses).fill(0);

    if (monst.info.flags & MonsterBehaviorFlag.MONST_FIERY) {
        monst.status[StatusEffect.Burning] = 1000;
        monst.maxStatus[StatusEffect.Burning] = 1000;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_FLIES) {
        monst.status[StatusEffect.Levitating] = 1000;
        monst.maxStatus[StatusEffect.Levitating] = 1000;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE) {
        monst.status[StatusEffect.ImmuneToFire] = 1000;
        monst.maxStatus[StatusEffect.ImmuneToFire] = 1000;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_INVISIBLE) {
        monst.status[StatusEffect.Invisible] = 1000;
        monst.maxStatus[StatusEffect.Invisible] = 1000;
    }

    monst.status[StatusEffect.Nutrition] = isPlayer ? STOMACH_SIZE : 1000;
    monst.maxStatus[StatusEffect.Nutrition] = isPlayer ? STOMACH_SIZE : 1000;
}

// ============================================================================
// initializeGender
// ============================================================================

/**
 * Randomly resolves gender when a monster has both MONST_MALE and MONST_FEMALE flags.
 * One of the two flags is removed at random, leaving a single gender.
 *
 * Ported from initializeGender() in Monsters.c.
 */
export function initializeGender(monst: Creature, rng: MonsterRNG): void {
    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_MALE) &&
        (monst.info.flags & MonsterBehaviorFlag.MONST_FEMALE)
    ) {
        monst.info.flags &= ~(
            rng.randPercent(50) ? MonsterBehaviorFlag.MONST_MALE : MonsterBehaviorFlag.MONST_FEMALE
        );
    }
}

// ============================================================================
// mutateMonster
// ============================================================================

/**
 * Applies a mutation from the mutation catalog to a monster.
 * Modifies the monster's info (stats, flags) according to the mutation's factors.
 *
 * Ported from mutateMonster() in Monsters.c.
 */
export function mutateMonster(
    monst: Creature,
    mutationIndex: number,
    mutationCatalog: readonly Mutation[],
): void {
    monst.mutationIndex = mutationIndex;
    const theMut = mutationCatalog[mutationIndex];

    monst.info.flags |= theMut.monsterFlags;
    monst.info.abilityFlags |= theMut.monsterAbilityFlags;
    monst.info.maxHP = Math.floor(monst.info.maxHP * theMut.healthFactor / 100);
    monst.info.movementSpeed = Math.floor(monst.info.movementSpeed * theMut.moveSpeedFactor / 100);
    monst.info.attackSpeed = Math.floor(monst.info.attackSpeed * theMut.attackSpeedFactor / 100);
    monst.info.defense = Math.floor(monst.info.defense * theMut.defenseFactor / 100);

    if (monst.info.damage.lowerBound > 0) {
        monst.info.damage.lowerBound = Math.floor(
            monst.info.damage.lowerBound * theMut.damageFactor / 100,
        );
        monst.info.damage.lowerBound = Math.max(monst.info.damage.lowerBound, 1);
    }
    if (monst.info.damage.upperBound > 0) {
        monst.info.damage.upperBound = Math.floor(
            monst.info.damage.upperBound * theMut.damageFactor / 100,
        );
        monst.info.damage.upperBound = Math.max(
            monst.info.damage.upperBound,
            (monst.info.abilityFlags & MonsterAbilityFlag.MA_POISONS) ? 2 : 1,
        );
    }
    if (theMut.DFChance >= 0) {
        monst.info.DFChance = theMut.DFChance;
    }
    if (theMut.DFType > 0) {
        monst.info.DFType = theMut.DFType as DungeonFeatureType;
    }
}

// ============================================================================
// initializeMonster
// ============================================================================

/**
 * Prepares a monster for placement on the current level but does not assign
 * a map location. Sets initial properties based on the creatureType (monst.info)
 * from the monster catalog. Expects monst.info to be populated and any mutation
 * already applied. Optionally assigns the monster a carried item.
 *
 * Ported from initializeMonster() in Monsters.c.
 */
export function initializeMonster(
    monst: Creature,
    itemPossible: boolean,
    ctx: MonsterGenContext,
): void {
    const { rng, gameConstants: gc, depthLevel } = ctx;

    monst.loc = { x: 0, y: 0 };
    monst.depth = depthLevel;
    monst.bookkeepingFlags = 0;
    monst.mapToMe = null;
    monst.safetyMap = null;
    monst.leader = null;
    monst.carriedMonster = null;

    monst.creatureState =
        (monst.info.flags & MonsterBehaviorFlag.MONST_NEVER_SLEEPS) || rng.randPercent(25)
            ? CreatureState.TrackingScent
            : CreatureState.Sleeping;
    monst.creatureMode = CreatureMode.Normal;
    monst.currentHP = monst.info.maxHP;
    monst.spawnDepth = depthLevel;
    monst.ticksUntilTurn = monst.info.movementSpeed;
    // turnsUntilRegen is tracked as thousandths to prevent rounding errors
    monst.turnsUntilRegen = monst.info.turnsBetweenRegen * 1000;
    monst.regenPerTurn = 0;
    monst.movementSpeed = monst.info.movementSpeed;
    monst.attackSpeed = monst.info.attackSpeed;
    monst.turnsSpentStationary = 0;
    monst.xpxp = 0;
    monst.machineHome = 0;
    monst.newPowerCount = 0;
    monst.totalPowerCount = 0;
    monst.targetCorpseLoc = { ...INVALID_POS };
    monst.lastSeenPlayerAt = { ...INVALID_POS };
    monst.targetWaypointIndex = -1;
    monst.waypointAlreadyVisited = [];
    for (let i = 0; i < MAX_WAYPOINT_COUNT; i++) {
        monst.waypointAlreadyVisited[i] = rng.randRange(0, 1) === 1;
    }

    // Determine item chance
    let itemChance: number;
    if (monst.info.flags & MonsterBehaviorFlag.MONST_CARRY_ITEM_100) {
        itemChance = 100;
    } else if (monst.info.flags & MonsterBehaviorFlag.MONST_CARRY_ITEM_25) {
        itemChance = 25;
    } else {
        itemChance = 0;
    }

    if (
        ctx.itemsEnabled &&
        itemPossible &&
        depthLevel <= gc.amuletLevel &&
        ctx.monsterItemsHopper.length > 0 &&
        rng.randPercent(itemChance)
    ) {
        const item = ctx.monsterItemsHopper.shift()!;
        item.originDepth = depthLevel;
        monst.carriedItem = item;
    } else {
        monst.carriedItem = null;
    }

    initializeGender(monst, rng);

    if (
        !(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ||
        (monst.info.abilityFlags & MonsterAbilityFlag.MA_ENTER_SUMMONS)
    ) {
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID;
    }
}

// ============================================================================
// createCreature — factory for a blank Creature value
// ============================================================================

/** Default/transparent color for flash. */
const noColor: Color = { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };

/**
 * Creates a blank Creature with all fields initialized to default values.
 * The caller must set `info` (from the monster catalog) and then call
 * initializeStatus + initializeMonster.
 */
export function createCreature(): Creature {
    return {
        info: null as unknown as CreatureType, // must be set by caller
        loc: { x: 0, y: 0 },
        depth: 0,
        currentHP: 0,
        turnsUntilRegen: 0,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: CreatureState.Sleeping,
        creatureMode: CreatureMode.Normal,
        mutationIndex: -1,
        wasNegated: false,
        targetWaypointIndex: -1,
        waypointAlreadyVisited: new Array(MAX_WAYPOINT_COUNT).fill(false),
        lastSeenPlayerAt: { ...INVALID_POS },
        targetCorpseLoc: { ...INVALID_POS },
        targetCorpseName: "",
        absorptionFlags: 0,
        absorbBehavior: false,
        absorptionBolt: 0,
        corpseAbsorptionCounter: 0,
        mapToMe: null,
        safetyMap: null,
        ticksUntilTurn: 0,
        movementSpeed: 0,
        attackSpeed: 0,
        previousHealthPoints: 0,
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { ...noColor },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        bookkeepingFlags: 0,
        spawnDepth: 0,
        machineHome: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        leader: null,
        carriedMonster: null,
        carriedItem: null,
    };
}

// ============================================================================
// generateMonster
// ============================================================================

// 1.17^x * 10, with x from 1 to 13 (pre-computed for deep mutation chances)
const POW_DEEP_MUTATION = [11, 13, 16, 18, 21, 25, 30, 35, 41, 48, 56, 65, 76];

/**
 * Creates a new Creature of the given type. Handles mutation roll,
 * status initialization, and monster initialization.
 *
 * Unlike the C version, the creature is NOT prepended to any global list;
 * the caller is responsible for adding it to the level's monster array.
 *
 * Ported from generateMonster() in Monsters.c.
 *
 * @param monsterID - The MonsterType enum value for the creature to generate.
 * @param itemPossible - Whether the creature can receive a carried item.
 * @param mutationPossible - Whether the creature can be mutated.
 * @param ctx - The monster generation context with catalogs, RNG, and state.
 * @returns A fully initialized Creature (not yet placed on the map).
 */
export function generateMonster(
    monsterID: MonsterType,
    itemPossible: boolean,
    mutationPossible: boolean,
    ctx: MonsterGenContext,
): Creature {
    const { rng, gameConstants: gc, depthLevel, monsterCatalog: catalog, mutationCatalog: mutations } = ctx;

    const monst = createCreature();

    // Deep copy the info from the catalog so each creature has its own mutable copy
    const catalogEntry = catalog[monsterID];
    monst.info = {
        ...catalogEntry,
        damage: { ...catalogEntry.damage },
        foreColor: { ...catalogEntry.foreColor },
        bolts: [...catalogEntry.bolts],
    };

    initializeStatus(monst, ctx.isPlayer ?? false);

    monst.mutationIndex = -1;
    if (
        mutationPossible &&
        !(monst.info.flags & MONST_NEVER_MUTATED) &&
        !(monst.info.abilityFlags & MA_NEVER_MUTATED) &&
        depthLevel > gc.mutationsOccurAboveLevel
    ) {
        let mutationChance: number;

        if (depthLevel <= gc.amuletLevel) {
            mutationChance = clamp(
                (depthLevel - gc.mutationsOccurAboveLevel) * gc.depthAccelerator,
                1,
                10,
            );
        } else {
            const index = Math.min(
                (depthLevel - gc.amuletLevel) * gc.depthAccelerator,
                12,
            );
            mutationChance = Math.min(POW_DEEP_MUTATION[index], 75);
        }

        if (rng.randPercent(mutationChance)) {
            const mutationAttempt = rng.randRange(0, NUMBER_MUTATORS - 1);
            if (
                !(monst.info.flags & mutations[mutationAttempt].forbiddenFlags) &&
                !(monst.info.abilityFlags & mutations[mutationAttempt].forbiddenAbilityFlags)
            ) {
                mutateMonster(monst, mutationAttempt, mutations);
            }
        }
    }

    // Note: Unlike C, we do NOT prepend to a global list here.
    // The caller adds the creature to the appropriate array.
    initializeMonster(monst, itemPossible, ctx);

    return monst;
}
