/*
 *  monster-ops.ts — Factory for MonsterOps callbacks
 *  brogue-ts
 *
 *  Creates the MonsterOps implementation that wires real monster functions
 *  into the machine building system. This bridges the monsters module
 *  with the architect/machines module.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos } from "../types/types.js";
import type { MonsterOps, MachineCreature } from "../architect/machines.js";
import {
    MonsterBookkeepingFlag,
    TileFlag,
    T_DIVIDES_LEVEL,
    TerrainFlag,
} from "../types/flags.js";
import { CreatureState } from "../types/enums.js";

// =============================================================================
// DI context — external dependencies injected for testability
// =============================================================================

/**
 * Context required to create MonsterOps callbacks.
 * Bundles the game state and dependencies needed for monster operations
 * during machine building.
 */
export interface MonsterOpsContext {
    /** Mutable list of all monsters on the current level. */
    monsters: Creature[];
    /** Mutable list of dormant monsters on the current level. */
    dormantMonsters: Creature[];
    /** Current floor pmap for HAS_MONSTER/HAS_DORMANT_MONSTER bookkeeping. */
    pmap: Pcell[][];

    /** Spawn a horde, returning the leader or null. */
    spawnHorde(
        leaderID: number,
        pos: Pos,
        forbiddenFlags: number,
        requiredFlags: number,
    ): Creature | null;

    /** Find the monster at a given position, or null. */
    monsterAtLoc(pos: Pos): Creature | null;

    /** Kill a creature. */
    killCreature(creature: Creature, quiet: boolean): void;

    /** Generate a single monster by ID. */
    generateMonster(monsterID: number, atDepth: boolean, summon: boolean): Creature | null;

    /** Optional item-drop helper when waking marked-for-sacrifice monsters. */
    makeMonsterDropItem?(creature: Creature): void;
    /** Optional legacy delegating toggle hook (used by existing tests). */
    toggleMonsterDormancy?(creature: Creature): void;
    /** Optional relocation helper if wake target cell is occupied. */
    getQualifyingPathLocNear?(
        target: Pos,
        hallwaysAllowed: boolean,
        blockingTerrainFlags: number,
        blockingMapFlags: number,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;
}

type DormancyContext = Pick<MonsterOpsContext, "monsters" | "dormantMonsters" | "pmap"> &
Partial<Pick<MonsterOpsContext, "getQualifyingPathLocNear" | "makeMonsterDropItem">> & {
    /** C parity: fadeInMonster() is the last step when waking a dormant monster (Monsters.c:4147). */
    fadeInMonster?: (monst: Creature) => void;
};

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a MonsterOps implementation backed by the real monster functions.
 *
 * This is the bridge between the architect's machine building system
 * (which uses the minimal MachineCreature interface) and the full monster
 * module (which works with Creature objects).
 *
 * All MachineCreature parameters are expected to actually be Creature objects
 * at runtime, since they are created by the monster functions.
 */
export function createMonsterOps(ctx: MonsterOpsContext): MonsterOps {
    return {
        spawnHorde(
            leaderID: number,
            pos: Pos,
            forbiddenFlags: number,
            requiredFlags: number,
        ): MachineCreature | null {
            return ctx.spawnHorde(leaderID, pos, forbiddenFlags, requiredFlags);
        },

        monsterAtLoc(pos: Pos): MachineCreature | null {
            return ctx.monsterAtLoc(pos);
        },

        killCreature(creature: MachineCreature, quiet: boolean): void {
            ctx.killCreature(creature as Creature, quiet);
        },

        generateMonster(
            monsterID: number,
            atDepth: boolean,
            summon: boolean,
        ): MachineCreature | null {
            const monst = ctx.generateMonster(monsterID, atDepth, summon);
            // C parity: generateMonster() prepends to the live monster list.
            // Machine-building code relies on immediate membership for MB_JUST_SUMMONED scans.
            if (monst && !ctx.monsters.includes(monst as Creature)) {
                ctx.monsters.unshift(monst as Creature);
            }
            return monst;
        },

        toggleMonsterDormancy(creature: MachineCreature): void {
            if (ctx.toggleMonsterDormancy) {
                ctx.toggleMonsterDormancy(creature as Creature);
            } else {
                toggleMonsterDormancy(creature as Creature, ctx);
            }
        },

        iterateMachineMonsters(): MachineCreature[] {
            // Return the full monsters list — the caller filters by MB_JUST_SUMMONED
            return ctx.monsters;
        },
    };
}

function removeFrom(list: Creature[], monst: Creature): boolean {
    const idx = list.indexOf(monst);
    if (idx < 0) {
        return false;
    }
    list.splice(idx, 1);
    return true;
}

/**
 * C-parity dormancy transition:
 * - Active -> dormant: move `monsters` -> `dormantMonsters`, swap pmap flags.
 * - Dormant -> active: move `dormantMonsters` -> `monsters`, swap pmap flags,
 *   delay first turn, and optionally relocate if occupied.
 */
export function toggleMonsterDormancy(monst: Creature, ctx?: DormancyContext): void {
    // Backward-compatible fallback for call sites/tests that use the old
    // signature and only expect bookkeeping/state flipping.
    if (!ctx) {
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT) {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_IS_DORMANT;
            monst.creatureState = CreatureState.TrackingScent;
        } else {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DORMANT;
            monst.creatureState = CreatureState.Sleeping;
        }
        return;
    }
    if (removeFrom(ctx.dormantMonsters, monst)) {
        // Wake dormant monster: move to active list.
        ctx.monsters.unshift(monst);
        ctx.pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.HAS_DORMANT_MONSTER;

        // If the wake cell is occupied, re-home nearby (C parity behavior).
        const occupied = !!(ctx.pmap[monst.loc.x][monst.loc.y].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER));
        if (occupied && ctx.getQualifyingPathLocNear) {
            const newLoc = ctx.getQualifyingPathLocNear(
                monst.loc,
                true,
                T_DIVIDES_LEVEL,
                TileFlag.HAS_PLAYER,
                TerrainFlag.T_OBSTRUCTS_PASSABILITY,
                TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS,
                false,
            );
            monst.loc = { ...newLoc };
        }

        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_MARKED_FOR_SACRIFICE) {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED;
            if (monst.carriedItem && ctx.makeMonsterDropItem) {
                ctx.makeMonsterDropItem(monst);
            }
        }

        monst.ticksUntilTurn = 200;
        ctx.pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.HAS_MONSTER;
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_IS_DORMANT;
        // C parity: fadeInMonster() is the last step when waking (Monsters.c:4147).
        ctx.fadeInMonster?.(monst);
        return;
    }

    if (removeFrom(ctx.monsters, monst)) {
        // Put active monster into dormancy.
        ctx.dormantMonsters.unshift(monst);
        ctx.pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.HAS_MONSTER;
        ctx.pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.HAS_DORMANT_MONSTER;
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DORMANT;
        if (monst.creatureState === CreatureState.TrackingScent) {
            monst.creatureState = CreatureState.Sleeping;
        }
    }
}
