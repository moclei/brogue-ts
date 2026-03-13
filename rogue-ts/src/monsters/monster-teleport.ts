/*
 *  monsters/monster-teleport.ts — disentangle + teleport domain functions
 *  Port V2 — rogue-ts
 *
 *  Ported from Monsters.c:1138 (disentangle) and Monsters.c:1146 (teleport).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Fixpt } from "../types/types.js";
import { StatusEffect } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    TerrainFlag,
    TerrainMechFlag,
    T_DIVIDES_LEVEL,
} from "../types/flags.js";
import {
    allocGrid, fillGrid, freeGrid,
    findReplaceGrid, validLocationCount, randomLocationInGrid,
} from "../grid/grid.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { FP_FACTOR } from "../math/fixpt.js";

// =============================================================================
// disentangle — Monsters.c:1138
// =============================================================================

export interface DisentangleContext {
    /** The player creature. */
    player: Creature;
    /** Display a message. */
    message(text: string, flags: number): void;
}

/**
 * Instantly disentangles a creature from webs/nets/seizing status.
 * Displays "you break free!" if the player was stuck.
 *
 * Ported from disentangle() in Monsters.c:1138.
 */
export function disentangle(monst: Creature, ctx: DisentangleContext): void {
    if (monst === ctx.player && monst.status[StatusEffect.Stuck]) {
        ctx.message("you break free!", 0);
    }
    monst.status[StatusEffect.Stuck] = 0;
}

// =============================================================================
// teleport — Monsters.c:1146
// =============================================================================

export interface TeleportContext {
    /** The player (for player-specific side effects). */
    player: Creature;
    /** Disentangle a creature from STATUS_STUCK. */
    disentangle(monst: Creature): void;
    /**
     * Fill a distance map from (x, y) with the given blocking terrain flags.
     * Equivalent to: fillGrid(grid, 0); calculateDistances(grid, x, y, blockFlags, null, true, false).
     */
    calculateDistancesFrom(grid: number[][], x: number, y: number, blockFlags: number): void;
    /** Compute FOV mask centered at (x, y). Visible cells are set to 1. */
    getFOVMaskAt(
        grid: number[][],
        x: number,
        y: number,
        radius: Fixpt,
        forbiddenTerrain: number,
        forbiddenFlags: number,
        cautious: boolean,
    ): void;
    /** Terrain flags that are impassable for this monster type. */
    forbiddenFlagsForMonster(info: Creature["info"]): number;
    /** Terrain flags this monster prefers to avoid. */
    avoidedFlagsForMonster(info: Creature["info"]): number;
    /** Check if a cell has the given terrain flags. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Check if a cell has the given terrain-mechanic flags. */
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    /** Get the pmap cell flags at (x, y). */
    getCellFlags(x: number, y: number): number;
    /** Return true if (loc) is within the map bounds. */
    isPosInMap(loc: Pos): boolean;
    /** Move a creature to a new cell, updating pmap bookkeeping. */
    setMonsterLocation(monst: Creature, loc: Pos): void;
    /** Pick a new wander waypoint for a non-player monster after teleport. */
    chooseNewWanderDestination(monst: Creature): void;
    // ── Map cell flag constants ──
    IS_IN_MACHINE: number;
    HAS_PLAYER: number;
    HAS_MONSTER: number;
    HAS_STAIRS: number;
}

/**
 * Apply terrain/map-flag filtering to a grid.
 * Sets grid[i][j] to `value` where the cell has the given terrainFlags
 * (and the cell is not already `value`) or has any of the given mapFlags.
 *
 * Equivalent to C getTerrainGrid(grid, value, terrainFlags, mapFlags).
 */
function applyTerrainFilter(
    grid: number[][],
    value: number,
    terrainFlags: number,
    mapFlags: number,
    ctx: TeleportContext,
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (
                (grid[i][j] !== value && ctx.cellHasTerrainFlag({ x: i, y: j }, terrainFlags)) ||
                (ctx.getCellFlags(i, j) & mapFlags)
            ) {
                grid[i][j] = value;
            }
        }
    }
}

/**
 * Teleport a creature to `destination`, or to a random valid cell when
 * `destination` is not in the map.
 *
 * The random-destination algorithm:
 *   1. Build a distance map from the monster's position.
 *   2. Discard cells that are too close (distance <= DCOLS/2).
 *   3. Filter out cells with forbidden/avoided terrain and occupied cells.
 *   4. Exclude cells currently visible to the creature.
 *   5. Pick one remaining cell at random.
 *
 * Always calls disentangle on the creature and moves it to the destination.
 * Non-player monsters pick a new wander waypoint after landing.
 *
 * Ported from teleport() in Monsters.c:1146.
 */
export function teleport(
    monst: Creature,
    destination: Pos,
    respectTerrainAvoidancePreferences: boolean,
    ctx: TeleportContext,
): void {
    if (!ctx.isPosInMap(destination)) {
        // Compute what the monster can currently see
        const monstFOV = allocGrid();
        fillGrid(monstFOV, 0);
        ctx.getFOVMaskAt(
            monstFOV,
            monst.loc.x, monst.loc.y,
            BigInt(DCOLS) * FP_FACTOR,
            TerrainFlag.T_OBSTRUCTS_VISION,
            0,
            false,
        );

        // Distance map from monster position, blocking level-dividing terrain
        const grid = allocGrid();
        fillGrid(grid, 0);
        ctx.calculateDistancesFrom(
            grid,
            monst.loc.x, monst.loc.y,
            ctx.forbiddenFlagsForMonster(monst.info) & T_DIVIDES_LEVEL,
        );

        // Discard cells that are too close (within DCOLS/2 steps)
        findReplaceGrid(grid, -30000, Math.trunc(DCOLS / 2), 0);
        // Mark remaining reachable and far-enough cells as valid candidates
        findReplaceGrid(grid, 2, 30000, 1);

        // If no candidates, allow anywhere as a fallback
        if (validLocationCount(grid, 1) < 1) {
            fillGrid(grid, 1);
        }

        const mapFlags = ctx.IS_IN_MACHINE | ctx.HAS_PLAYER | ctx.HAS_MONSTER | ctx.HAS_STAIRS;
        if (respectTerrainAvoidancePreferences) {
            if (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) {
                // Liquid-restricted monsters: only submerging terrain is valid
                fillGrid(grid, 0);
                // getTMGrid equivalent: mark submerging cells as valid
                for (let i = 0; i < DCOLS; i++) {
                    for (let j = 0; j < DROWS; j++) {
                        if (
                            grid[i][j] !== 1 &&
                            ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
                        ) {
                            grid[i][j] = 1;
                        }
                    }
                }
            }
            applyTerrainFilter(grid, 0, ctx.avoidedFlagsForMonster(monst.info), mapFlags, ctx);
        } else {
            applyTerrainFilter(grid, 0, ctx.forbiddenFlagsForMonster(monst.info), mapFlags, ctx);
        }

        // Exclude cells visible to the monster (teleport to out-of-sight location)
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (monstFOV[i][j]) {
                    grid[i][j] = 0;
                }
            }
        }

        destination = randomLocationInGrid(grid, 1);
        freeGrid(grid);
        freeGrid(monstFOV);

        if (!ctx.isPosInMap(destination)) {
            return; // No valid destination found — teleport fails silently
        }
    }

    // Always break free from webs/seizing on teleport
    ctx.disentangle(monst);
    ctx.setMonsterLocation(monst, destination);
    if (monst !== ctx.player) {
        ctx.chooseNewWanderDestination(monst);
    }
}
