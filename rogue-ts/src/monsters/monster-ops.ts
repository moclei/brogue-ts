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

import type { Creature, Pos } from "../types/types.js";
import type { MonsterOps, MachineCreature } from "../architect/machines.js";
import { MonsterBookkeepingFlag } from "../types/flags.js";
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

    /** Toggle dormancy on a creature (flip MB_IS_DORMANT). */
    toggleMonsterDormancy(creature: Creature): void;
}

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
            return ctx.generateMonster(monsterID, atDepth, summon);
        },

        toggleMonsterDormancy(creature: MachineCreature): void {
            ctx.toggleMonsterDormancy(creature as Creature);
        },

        iterateMachineMonsters(): MachineCreature[] {
            // Return the full monsters list — the caller filters by MB_JUST_SUMMONED
            return ctx.monsters;
        },
    };
}

/**
 * Default implementation of toggleMonsterDormancy.
 * Flips the MB_IS_DORMANT bookkeeping flag on a creature.
 *
 * When a monster becomes dormant, it's set to sleeping state.
 * When it wakes from dormancy, it's set to tracking scent.
 */
export function toggleMonsterDormancy(monst: Creature): void {
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT) {
        // Wake from dormancy
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_IS_DORMANT;
        monst.creatureState = CreatureState.TrackingScent;
    } else {
        // Go dormant
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DORMANT;
        monst.creatureState = CreatureState.Sleeping;
    }
}
