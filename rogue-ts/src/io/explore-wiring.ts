/*
 *  io/explore-wiring.ts — exploreKey entry point with no-path message
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c (exploreKey)
 *  Wraps explore() and checks for an unreachable map after completion.
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
    type TravelExploreContext,
} from "../movement/travel-explore.js";
import type { Pos } from "../types/types.js";

// =============================================================================
// exploreKey — IO.c:2313
// =============================================================================

/**
 * Run one exploration pass. If the map becomes fully explored (no direction
 * reachable after explore() returns), show the "no path" message.
 *
 * C: void exploreKey(boolean controlKey) in IO.c
 */
export async function exploreKey(
    ctrl: boolean,
    ctx: TravelExploreContext,
    message: (msg: string, flags: number) => void | Promise<void>,
    rogue: { gameHasEnded: boolean },
    playerLoc: Pos,
): Promise<void> {
    await explore(ctrl ? 1 : 50, ctx);
    if (rogue.gameHasEnded) return;

    const map = ctx.allocGrid();
    getExploreMap(map, false, ctx);
    const noPath = nextStep(map, playerLoc, null, false, ctx) === -1;
    ctx.freeGrid(map);

    if (noPath) {
        await message("I see no path for further exploration.", 0);
    }
}
