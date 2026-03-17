/*
 *  io/explore-wiring.ts — exploreKey entry point with no-path message
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c (exploreKey)
 *  Checks for a reachable exploration target BEFORE calling explore(), then
 *  loops (equivalent to C's tail-recursive exploreKey call after explore()).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import {
    explore,
    getExploreMap,
    nextStep,
    adjacentFightingDir,
    type TravelExploreContext,
} from "../movement/travel-explore.js";
import { TileFlag } from "../types/flags.js";
import type { Pos } from "../types/types.js";

// =============================================================================
// exploreKey — IO.c:2313
// =============================================================================

/**
 * Run exploration passes until fully explored, disturbed, or game ends.
 *
 * C: void exploreKey(boolean controlKey) in IO.c:2313
 *
 * Fix (B86): The original TS implementation called explore() first, then
 * checked for a path from the final (frontier) position — which always
 * returns NO_DIRECTION, causing a false "no path" message after the first
 * depth. The correct logic (matching C) is:
 *   1. Check adjacentFightingDir — if fighting, target the enemy tile.
 *   2. Check tooDark — if any adjacent cell is undiscovered, message and return.
 *   3. Follow the explore map to find whether a target exists (from current pos).
 *   4. If no target: message and return.
 *   5. Call explore() to walk toward the target.
 *   6. Loop (C achieves the same via tail-recursion).
 */
export async function exploreKey(
    ctrl: boolean,
    ctx: TravelExploreContext,
    message: (msg: string, flags: number) => void | Promise<void>,
    rogue: { gameHasEnded: boolean },
    _playerLoc: Pos,  // unused; ctx.player.loc is always current
): Promise<void> {
    while (!rogue.gameHasEnded) {
        const playerLoc = ctx.player.loc;

        // C: check adjacentFightingDir first; if fighting, explore toward enemy.
        // explore() handles the fighting case internally, so we just fall through.
        const fightDir = adjacentFightingDir(ctx);
        if (fightDir === -1) {
            // No adjacent fight — check whether any neighbour is undiscovered.
            let tooDark = false;
            for (let dir = 0; dir < 8; dir++) {
                const nx = playerLoc.x + ctx.nbDirs[dir][0];
                const ny = playerLoc.y + ctx.nbDirs[dir][1];
                if (
                    ctx.coordinatesAreInMap(nx, ny) &&
                    !(ctx.pmap[nx][ny].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))
                ) {
                    tooDark = true;
                    break;
                }
            }
            if (tooDark) {
                await message("It's too dark to explore!", 0);
                return;
            }

            // Follow the explore map from the player's current position to
            // determine whether any reachable exploration target exists.
            const map = ctx.allocGrid();
            getExploreMap(map, false, ctx);
            let x = playerLoc.x;
            let y = playerLoc.y;
            let dir: number;
            do {
                dir = nextStep(map, { x, y }, null, false, ctx);
                if (dir !== -1) {
                    x += ctx.nbDirs[dir][0];
                    y += ctx.nbDirs[dir][1];
                }
            } while (dir !== -1);
            ctx.freeGrid(map);

            if (x === playerLoc.x && y === playerLoc.y) {
                await message("I see no path for further exploration.", 0);
                return;
            }
        }

        // Explore until disturbed (or game ends).
        // C then tail-recurses; we loop instead.
        await explore(ctrl ? 1 : 50, ctx);
    }
}
