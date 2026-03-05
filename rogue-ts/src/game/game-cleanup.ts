/*
 *  game-cleanup.ts — Resource cleanup, dead monster removal, utility functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/RogueMain.c (lines 930–1044, 1405–1414)
 *  Functions: freeCreature, removeDeadMonsters, freeEverything, unflag
 *
 *  NOTE: TypeScript uses garbage collection, so many C memory management
 *  operations (free, malloc) are unnecessary. These ports focus on the
 *  logical cleanup (nulling references, clearing arrays) rather than
 *  explicit memory deallocation.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Creature,
    GameConstants,
    Item,
    LevelData,
} from "../types/types.js";
// CreatureState not needed in this module
import { MonsterBehaviorFlag, MonsterBookkeepingFlag, MonsterAbilityFlag } from "../types/flags.js";
import { MAX_WAYPOINT_COUNT } from "../types/constants.js";

// =============================================================================
// DI Context
// =============================================================================

/**
 * Minimal rogue state for the cleanup module.
 */
export interface CleanupRogueState {
    mapToShore: number[][] | null;
    mapToSafeTerrain: number[][] | null;
    wpDistance: (number[][] | null)[];
    flares: unknown[];
    featRecord: boolean[];
}

/**
 * Dependency-injection context for the cleanup module.
 */
export interface CleanupContext {
    rogue: CleanupRogueState;
    player: Creature;
    gameConst: GameConstants;

    // -- Level data -----------------------------------------------------------

    levels: LevelData[];
    setLevels(levels: LevelData[]): void;

    // -- Monster/item lists ---------------------------------------------------

    monsters: Creature[];
    dormantMonsters: Creature[];
    floorItems: Item[];
    packItems: Item[];
    monsterItemsHopper: Item[];
    purgatory: Creature[];

    // -- Safety grids ---------------------------------------------------------

    safetyMap: number[][] | null;
    allySafetyMap: number[][] | null;
    chokeMap: number[][] | null;
    scentMap: number[][] | null;
    setSafetyMap(map: number[][] | null): void;
    setAllySafetyMap(map: number[][] | null): void;
    setChokeMap(map: number[][] | null): void;
    setScentMap(map: number[][] | null): void;

    // -- Grid operations ------------------------------------------------------

    freeGrid(grid: number[][]): void;

    // -- Item operations ------------------------------------------------------

    deleteItem(item: Item): void;

    // -- Flare operations -----------------------------------------------------

    deleteAllFlares(): void;
}

// =============================================================================
// freeCreature — clean up creature resources
// =============================================================================

/**
 * Port of C `freeCreature()`.
 *
 * In TS, we null out grid references so the GC can reclaim them.
 * The creature object itself is GC'd when no longer referenced.
 */
export function freeCreature(monst: Creature): void {
    monst.mapToMe = null;
    monst.safetyMap = null;
    monst.carriedItem = null;
    if (monst.carriedMonster) {
        freeCreature(monst.carriedMonster);
        monst.carriedMonster = null;
    }
}

// =============================================================================
// removeDeadMonsters — purge dead creatures from lists
// =============================================================================

/**
 * Port of C `removeDeadMonsters()`.
 *
 * Removes creatures with MB_HAS_DIED from monster/dormant lists.
 * Player allies that can be resurrected are moved to purgatory.
 */
export function removeDeadMonsters(ctx: CleanupContext): void {
    removeDeadMonstersFromList(ctx.monsters, ctx.purgatory, ctx.player);
    removeDeadMonstersFromList(ctx.dormantMonsters, ctx.purgatory, ctx.player);
}

function removeDeadMonstersFromList(
    list: Creature[],
    purgatory: Creature[],
    player: Creature,
): void {
    for (let i = list.length - 1; i >= 0; i--) {
        const decedent = list[i];
        if (decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED) {
            // Remove from list
            list.splice(i, 1);

            // Check if the decedent qualifies for purgatory (future resurrection)
            if (decedent.leader === player
                && !(decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_DOES_NOT_RESURRECT)
                && (!(decedent.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)
                    || (decedent.info.abilityFlags & MonsterAbilityFlag.MA_ENTER_SUMMONS))
                && (decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID)
                && !(decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH)) {
                // Unset flag so purgatory list is iterable
                decedent.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_HAS_DIED;
                purgatory.push(decedent);
            } else {
                freeCreature(decedent);
            }
        }
    }
}

// =============================================================================
// freeEverything — release all game resources
// =============================================================================

/**
 * Port of C `freeEverything()`.
 *
 * Cleans up all game state for a fresh start or exit.
 * In TS, this mostly means clearing arrays and nulling references.
 */
export function freeEverything(ctx: CleanupContext): void {
    const { rogue, gameConst: gc } = ctx;

    // Free global grids
    if (ctx.safetyMap) {
        ctx.freeGrid(ctx.safetyMap);
        ctx.setSafetyMap(null);
    }
    if (ctx.allySafetyMap) {
        ctx.freeGrid(ctx.allySafetyMap);
        ctx.setAllySafetyMap(null);
    }
    if (ctx.chokeMap) {
        ctx.freeGrid(ctx.chokeMap);
        ctx.setChokeMap(null);
    }
    if (rogue.mapToShore) {
        ctx.freeGrid(rogue.mapToShore);
        rogue.mapToShore = null;
    }
    if (rogue.mapToSafeTerrain) {
        ctx.freeGrid(rogue.mapToSafeTerrain);
        rogue.mapToSafeTerrain = null;
    }

    // Free level data
    for (let i = 0; i <= gc.deepestLevel; i++) {
        const level = ctx.levels[i];
        // Free creature lists
        for (const monst of level.monsters) {
            freeCreature(monst);
        }
        level.monsters = [];
        for (const monst of level.dormantMonsters) {
            freeCreature(monst);
        }
        level.dormantMonsters = [];

        // Free items
        for (const item of level.items) {
            ctx.deleteItem(item);
        }
        level.items = [];

        if (level.scentMap) {
            ctx.freeGrid(level.scentMap);
            level.scentMap = null;
        }
    }
    ctx.setScentMap(null);

    // Free purgatory
    for (const monst of ctx.purgatory) {
        freeCreature(monst);
    }
    ctx.purgatory.length = 0;

    // Free floor items
    for (const item of ctx.floorItems) {
        ctx.deleteItem(item);
    }
    ctx.floorItems.length = 0;

    // Free pack items
    for (const item of ctx.packItems) {
        ctx.deleteItem(item);
    }
    ctx.packItems.length = 0;

    // Free monster items hopper
    for (const item of ctx.monsterItemsHopper) {
        ctx.deleteItem(item);
    }
    ctx.monsterItemsHopper.length = 0;

    // Free waypoint grids
    for (let i = 0; i < MAX_WAYPOINT_COUNT; i++) {
        if (rogue.wpDistance[i]) {
            ctx.freeGrid(rogue.wpDistance[i]!);
            rogue.wpDistance[i] = null;
        }
    }

    ctx.deleteAllFlares();
    rogue.flares = [];

    // In C, levels array is freed. In TS, just clear the reference.
    ctx.setLevels([]);

    rogue.featRecord = [];
}

// =============================================================================
// unflag — convert a single-bit flag Fl(n) back to n
// =============================================================================

/**
 * Port of C `unflag()`.
 *
 * Takes a flag of the form Fl(n) = (1 << n) and returns n.
 * Returns -1 if the flag has no single set bit.
 */
export function unflag(flag: number): number {
    for (let i = 0; i < 32; i++) {
        if (flag >>> i === 1) {
            return i;
        }
    }
    return -1;
}
