/*
 *  monster-path-queries.ts — Line-of-sight path check and dormant monster lookup
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: specifiedPathBetween (2014), dormantMonsterAtLoc (2062)
 *
 *  specifiedPathBetween traces a bolt-geometry line and returns false if
 *  any cell along the path is blocked by the specified terrain or map flags.
 *  dormantMonsterAtLoc scans the dormant monster list for a creature at
 *  the given map cell.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos } from "../types/types.js";
import { TileFlag } from "../types/flags.js";
import { getLineCoordinates } from "../items/bolt-geometry.js";

// =============================================================================
// Contexts
// =============================================================================

/**
 * Context for specifiedPathBetween — cell terrain and map flag queries.
 */
export interface SpecifiedPathContext {
    /** Returns true if the cell at loc has any of the given terrain flags set. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Returns true if pmap cell at loc has any of the given map flags set. */
    cellHasPmapFlags(loc: Pos, flags: number): boolean;
}

/**
 * Context for dormantMonsterAtLoc — dormant monster list and map flag check.
 */
export interface DormantMonsterContext {
    /** The list of dormant (sleeping/inactive) monsters on the current level. */
    dormantMonsters: Creature[];
    /** Returns true if pmap cell at loc has any of the given map flags set. */
    cellHasPmapFlags(loc: Pos, flags: number): boolean;
}

// =============================================================================
// specifiedPathBetween — Monsters.c:2014
// =============================================================================

/**
 * Returns true if the line from (x1,y1) to (x2,y2) passes without hitting
 * any cell that has blockingTerrain terrain flags or blockingFlags map flags.
 *
 * Uses the same fixed-point Bresenham line as the bolt system. Cells are
 * tested in order up to and including the target cell; the function returns
 * true when the target is reached unblocked.
 *
 * C: boolean specifiedPathBetween(short x1, short y1, short x2, short y2,
 *                                  unsigned long blockingTerrain,
 *                                  unsigned long blockingFlags)
 *
 * @param x1              Origin column.
 * @param y1              Origin row.
 * @param x2              Target column.
 * @param y2              Target row.
 * @param blockingTerrain Terrain flags that block the path.
 * @param blockingFlags   Map (pmap) flags that block the path.
 * @param ctx             Map query context.
 * @returns               true if the path is clear, false if blocked.
 */
export function specifiedPathBetween(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    blockingTerrain: number,
    blockingFlags: number,
    ctx: SpecifiedPathContext,
): boolean {
    const coords = getLineCoordinates({ x: x1, y: y1 }, { x: x2, y: y2 });

    for (const { x, y } of coords) {
        if (
            ctx.cellHasTerrainFlag({ x, y }, blockingTerrain) ||
            ctx.cellHasPmapFlags({ x, y }, blockingFlags)
        ) {
            return false;
        }
        if (x === x2 && y === y2) {
            return true;
        }
    }

    // Should be unreachable (mirrors C brogueAssert(false))
    return true;
}

// =============================================================================
// dormantMonsterAtLoc — Monsters.c:2062
// =============================================================================

/**
 * Returns the dormant monster at position p, or null if none.
 *
 * Checks HAS_DORMANT_MONSTER on the pmap cell first; if not set, returns null
 * immediately without scanning the list.
 *
 * C: creature *dormantMonsterAtLoc(pos p)
 *
 * @param p   Map cell to check.
 * @param ctx Dormant monster context.
 * @returns   The dormant creature at p, or null.
 */
export function dormantMonsterAtLoc(
    p: Pos,
    ctx: DormantMonsterContext,
): Creature | null {
    if (!ctx.cellHasPmapFlags(p, TileFlag.HAS_DORMANT_MONSTER)) {
        return null;
    }
    return ctx.dormantMonsters.find(m => m.loc.x === p.x && m.loc.y === p.y) ?? null;
}
