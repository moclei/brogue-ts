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

// B86 debug: set to true to dump explore-map diagnostics when "no path" fires
const DEBUG_EXPLORE = false;

function debugExploreMap(
    map: number[][],
    playerLoc: Pos,
    ctx: TravelExploreContext,
): void {
    const { x, y } = playerLoc;
    const depth = ctx.rogue.depthLevel;
    const playerDist = map[x][y];

    // Count goal cells (distance < 30000 means Dijkstra reached them)
    let goalCount = 0;
    let reachedCount = 0;
    for (let i = 0; i < map.length; i++) {
        for (let j = 0; j < map[i].length; j++) {
            if (map[i][j] < 0) goalCount++;
            if (map[i][j] < 30000) reachedCount++;
        }
    }

    console.group(`[B86 explore debug] depth=${depth} playerLoc=(${x},${y}) dist=${playerDist} goals=${goalCount} reachedCells=${reachedCount}`);

    for (let dir = 0; dir < 8; dir++) {
        const nx = x + ctx.nbDirs[dir][0];
        const ny = y + ctx.nbDirs[dir][1];
        if (!ctx.coordinatesAreInMap(nx, ny)) {
            console.log(`  dir=${dir} (${nx},${ny}) OUT_OF_MAP`);
            continue;
        }
        const neighborDist = map[nx][ny];
        const score = playerDist - neighborDist;
        const known = ctx.knownToPlayerAsPassableOrSecretDoor({ x: nx, y: ny });
        const diagBlocked = ctx.diagonalBlocked(x, y, nx, ny, true);
        const wouldStep = score > 0 && known && !diagBlocked;
        console.log(
            `  dir=${dir} (${nx},${ny}) dist=${neighborDist} score=${score} known=${known} diagBlocked=${diagBlocked} → ${wouldStep ? 'WOULD STEP' : 'blocked'}`,
        );
    }

    // Also log upLoc and downLoc distances
    const upDist = map[ctx.rogue.upLoc.x]?.[ctx.rogue.upLoc.y];
    const downDist = map[ctx.rogue.downLoc.x]?.[ctx.rogue.downLoc.y];
    console.log(`  upLoc=(${ctx.rogue.upLoc.x},${ctx.rogue.upLoc.y}) dist=${upDist}`);
    console.log(`  downLoc=(${ctx.rogue.downLoc.x},${ctx.rogue.downLoc.y}) dist=${downDist}`);
    console.groupEnd();
}

export async function exploreKey(
    ctrl: boolean,
    ctx: TravelExploreContext,
    message: (msg: string, flags: number) => void | Promise<void>,
    _rogue: { gameHasEnded: boolean },
    _playerLoc: Pos,  // unused; was stale after first player move in original
): Promise<void> {
    const fightDir = adjacentFightingDir(ctx);
    if (fightDir === -1) {
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

        const noPath = x === playerLoc.x && y === playerLoc.y;
        if (DEBUG_EXPLORE && noPath) {
            debugExploreMap(map, playerLoc, ctx);
        }
        ctx.freeGrid(map);

        if (noPath) {
            await message("I see no path for further exploration.", 0);
            return;
        }
    }

    await explore(ctrl ? 1 : 50, ctx);
}
