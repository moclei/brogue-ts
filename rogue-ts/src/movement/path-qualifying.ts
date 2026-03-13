/*
 *  movement/path-qualifying.ts — Pathfinding-based location selection
 *  brogue-ts
 *
 *  Ported from: src/brogue/Grid.c
 *  Functions: getQualifyingPathLocNear
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, Pcell } from "../types/types.js";
import type { Grid } from "../grid/grid.js";
import { allocGrid, freeGrid, fillGrid, findReplaceGrid, randomLeastPositiveLocationInGrid } from "../grid/grid.js";
import { dijkstraScan } from "../dijkstra/dijkstra.js";
import { TerrainFlag } from "../types/flags.js";
import { PDS_FORBIDDEN, PDS_OBSTRUCTION, DCOLS, DROWS } from "../types/constants.js";
import { isPosInMap } from "../globals/tables.js";
import { passableArcCount as passableArcCountFn } from "../architect/helpers.js";

// =============================================================================
// Context
// =============================================================================

/**
 * Minimal context for getQualifyingPathLocNear.
 */
export interface QualifyingPathContext {
    pmap: Pcell[][];
    /** Check if a cell has terrain flags. */
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    /** Get map cell flags (HAS_PLAYER, HAS_MONSTER, etc.). */
    cellFlags(pos: Pos): number;
    /** Fallback: find a qualifying loc near target without pathfinding. */
    getQualifyingLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos | null;
    rng: { randRange(lo: number, hi: number): number };
}

// =============================================================================
// Local helpers (Grid.c:161, Grid.c:183)
// =============================================================================

/**
 * Fills grid cells with `value` wherever terrain flags or map flags match.
 * C: void getTerrainGrid(short **grid, short value, unsigned long terrainFlags, unsigned long mapFlags)
 */
function getTerrainGrid(
    grid: Grid,
    value: number,
    terrainFlags: number,
    mapFlags: number,
    ctx: QualifyingPathContext,
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (
                grid[i][j] !== value &&
                (ctx.cellHasTerrainFlag({ x: i, y: j }, terrainFlags) ||
                    (ctx.pmap[i][j].flags & mapFlags))
            ) {
                grid[i][j] = value;
            }
        }
    }
}

/**
 * Sets grid cells to `value` where the passable arc count is in [minArc, maxArc].
 * C: static void getPassableArcGrid(...)
 */
function getPassableArcGrid(
    grid: Grid,
    minArc: number,
    maxArc: number,
    value: number,
    pmap: Pcell[][],
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j] !== value) {
                const count = passableArcCountFn(pmap, i, j);
                if (count >= minArc && count <= maxArc) {
                    grid[i][j] = value;
                }
            }
        }
    }
}

// =============================================================================
// getQualifyingPathLocNear — from Grid.c:287
// =============================================================================

/**
 * Finds the nearest location to `target` that is path-reachable and meets the
 * terrain/map-flag requirements. Falls back to a ring-search if no path-reachable
 * location exists.
 *
 * C: pos getQualifyingPathLocNear(pos target, boolean hallwaysAllowed,
 *        unsigned long blockingTerrainFlags, unsigned long blockingMapFlags,
 *        unsigned long forbiddenTerrainFlags, unsigned long forbiddenMapFlags,
 *        boolean deterministic)
 */
export function getQualifyingPathLocNear(
    target: Pos,
    hallwaysAllowed: boolean,
    blockingTerrainFlags: number,
    blockingMapFlags: number,
    forbiddenTerrainFlags: number,
    forbiddenMapFlags: number,
    deterministic: boolean,
    ctx: QualifyingPathContext,
): Pos {
    const allForbidden = blockingTerrainFlags | forbiddenTerrainFlags;
    const allForbiddenMap = blockingMapFlags | forbiddenMapFlags;

    // Quick check: if target itself qualifies, return it immediately.
    if (
        !ctx.cellHasTerrainFlag(target, allForbidden) &&
        !(ctx.cellFlags(target) & allForbiddenMap) &&
        (hallwaysAllowed || passableArcCountFn(ctx.pmap, target.x, target.y) <= 1)
    ) {
        return target;
    }

    // Allocate work grids.
    const grid: Grid = allocGrid();
    const costMap: Grid = allocGrid();

    fillGrid(grid, 30000);
    fillGrid(costMap, 1);

    // Block off pathing blockers in the cost map.
    getTerrainGrid(costMap, PDS_FORBIDDEN, blockingTerrainFlags, blockingMapFlags, ctx);
    if (blockingTerrainFlags & (TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT | TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        getTerrainGrid(costMap, PDS_OBSTRUCTION, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT, 0, ctx);
    }

    // Run dijkstra from target.
    grid[target.x][target.y] = 1;
    costMap[target.x][target.y] = 1;
    dijkstraScan(grid, costMap, true);

    // Clear unreachable cells.
    findReplaceGrid(grid, 30000, 30000, 0);

    // Block off forbidden targets (but not pathing blockers already zeroed).
    getTerrainGrid(grid, 0, forbiddenTerrainFlags, forbiddenMapFlags, ctx);

    // Optionally restrict to non-hallway cells.
    if (!hallwaysAllowed) {
        getPassableArcGrid(grid, 2, 10, 0, ctx.pmap);
    }

    // Pick the nearest qualifying cell.
    const retLoc = randomLeastPositiveLocationInGrid(grid, deterministic);

    freeGrid(grid);
    freeGrid(costMap);

    // Return path-based result if valid.
    if (isPosInMap(retLoc)) {
        return retLoc;
    }

    // Fallback: ring-search without pathfinding.
    const fallback = ctx.getQualifyingLocNear(
        target,
        hallwaysAllowed,
        allForbidden,
        allForbiddenMap,
        deterministic,
    );
    return fallback ?? retLoc;
}
