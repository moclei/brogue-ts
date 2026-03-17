/*
 *  io/explore-wiring.ts — exploreKey entry point with no-path message
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c (exploreKey)
 *  Checks for a reachable exploration target BEFORE calling explore().
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
import type { Pos } from "../types/types.js";

// =============================================================================
// exploreKey — IO.c:2313
// =============================================================================

/**
 * Run one exploration pass. Shows "no path" if no exploration target exists
 * from the player's current position BEFORE starting exploration.
 *
 * C: void exploreKey(boolean controlKey) in IO.c:2313
 *
 * Fix (B86): The original TS implementation called explore() first, then
 * checked nextStep with a stale playerLoc reference (ctx.player.loc is
 * replaced, not mutated, during movement). The correct order (matching C)
 * is to verify a reachable target exists BEFORE calling explore(), using
 * the current player position.
 *
 * Note: C recurses after explore() to find the next target; TS does not
 * loop — the player presses 'x' again to continue exploring, matching the
 * effective UX since C's proposeOrConfirmLocation also requires another press.
 */
export async function exploreKey(
    ctrl: boolean,
    ctx: TravelExploreContext,
    message: (msg: string, flags: number) => void | Promise<void>,
    _rogue: { gameHasEnded: boolean },
    _playerLoc: Pos,  // unused; was stale after first player move in original
): Promise<void> {
    // C: adjacentFightingDir check — if fighting, skip the path check and
    // let explore() handle the combat directly.
    const fightDir = adjacentFightingDir(ctx);
    if (fightDir === -1) {
        // Follow the explore map from the player's CURRENT position to
        // determine whether any reachable exploration target exists.
        // This mirrors C IO.c:2340-2354, evaluated BEFORE calling explore().
        const playerLoc = ctx.player.loc;
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

    await explore(ctrl ? 1 : 50, ctx);
}
