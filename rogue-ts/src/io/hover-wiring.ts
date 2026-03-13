/*
 *  io/hover-wiring.ts — Mouse hover: path highlight + location description
 *  Port V2 — rogue-ts
 *
 *  Implements the normal-gameplay hover handler (B35).  On each
 *  MouseEnteredCell event the handler:
 *    1. Clears the previous IS_IN_PATH highlight.
 *    2. Runs Dijkstra from the cursor position and traces a path from
 *       the player back to the cursor.
 *    3. Highlights each path cell (IS_IN_PATH flag + refreshDungeonCell).
 *    4. Highlights the cursor cell with a white tint (hiliteCell).
 *    5. Prints the location description in the flavor-text area.
 *
 *  C: IO.c (mainInputLoop hover branch, hilitePath, clearCursorPath,
 *           hiliteCell, printLocationDescription),
 *     Movement.c (nextStep, getPlayerPathOnMap).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import {
    clearCursorPath,
    hilitePath,
    hiliteCell,
    getPlayerPathOnMap as getPlayerPathOnMapFn,
    type TargetingContext,
} from "./targeting.js";
import { nextStep as nextStepFn } from "../movement/travel-explore.js";
import type { TravelExploreContext } from "../movement/travel-explore.js";
import { populateCreatureCostMap as populateCreatureCostMapFn } from "../movement/cost-maps-fov.js";
import { buildCostMapFovContext } from "../movement-cost-map.js";
import { dijkstraScan as dijkstraScanFn } from "../dijkstra/dijkstra.js";
import { allocGrid, fillGrid as fillGridFn } from "../grid/grid.js";
import { buildRefreshDungeonCellFn, buildGetCellAppearanceFn } from "../io-wiring.js";
import { buildPrintLocationDescriptionFn } from "./sidebar-wiring.js";
import { applyColorAugment as applyColorAugmentFn, separateColors as separateColorsFn } from "./color.js";
import { mapToWindow as mapToWindowFn, plotCharWithColor as plotCharWithColorFn } from "./display.js";
import { white } from "../globals/colors.js";
import { coordinatesAreInMap, nbDirs } from "../globals/tables.js";
import { terrainFlags as terrainFlagsFn } from "../state/helpers.js";
import { diagonalBlocked as diagonalBlockedFn } from "../combat/combat-math.js";
import { monsterAvoids as monsterAvoidsFn } from "../monsters/monster-state.js";
import { canPass as canPassFn } from "../monsters/monster-movement.js";
import { monstersAreEnemies as monstersAreEnemiesFn } from "../monsters/monster-queries.js";
import { buildMonsterStateContext } from "../monsters.js";
import { TileFlag, TerrainFlag, TerrainMechFlag } from "../types/flags.js";
import type { Creature, Pos, Pcell } from "../types/types.js";

// =============================================================================
// Internal context builders
// =============================================================================

/**
 * Minimal TargetingContext for clearCursorPath / hilitePath:
 * only needs rogue.playbackMode, pmap, and refreshDungeonCell.
 */
function buildPathFlagCtx(
    playbackMode: boolean,
    pmap: Pcell[][],
    refreshDungeonCell: (loc: Pos) => void,
): TargetingContext {
    return {
        rogue: { playbackMode },
        pmap,
        refreshDungeonCell,
    } as unknown as TargetingContext;
}

/**
 * Minimal TargetingContext for getPlayerPathOnMap:
 * needs player + nextStep (bound to a TravelExploreContext subset).
 *
 * Uses the full nextStep from travel-explore to respect terrain knowledge,
 * diagonal blocking, and monster avoidance — same as mainInputLoop in C.
 */
function buildPathTracingCtx(
    player: Creature,
    pmap: Pcell[][],
    monsters: Creature[],
): TargetingContext {
    const terrainFlagCheck = (pos: Pos, flags: number): boolean =>
        !!(terrainFlagsFn(pmap, pos) & flags);

    const monsterAtLoc = (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        return monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
    };

    const monsterStateCtx = buildMonsterStateContext();

    const nextStepCtx = {
        nbDirs,
        coordinatesAreInMap,
        monsterAtLoc,
        monsterAvoids: (m: Creature, loc: Pos) =>
            monsterAvoidsFn(m, loc, monsterStateCtx),
        canPass: (mover: Creature, blocker: Creature) =>
            canPassFn(mover, blocker, player, terrainFlagCheck),
        monstersAreTeammates: (a: Creature, b: Creature) =>
            a.leader === b || b.leader === a,
        monstersAreEnemies: (a: Creature, b: Creature) =>
            monstersAreEnemiesFn(a, b, player, terrainFlagCheck),
        diagonalBlocked: (x1: number, y1: number, x2: number, y2: number, _lim: boolean) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos: Pos) => terrainFlagsFn(pmap, pos)),
        knownToPlayerAsPassableOrSecretDoor(pos: Pos) {
            const cell = pmap[pos.x]?.[pos.y];
            if (!cell) return false;
            if (!(cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))) return false;
            if (cell.rememberedTerrainFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) {
                return !!(cell.rememberedTMFlags & TerrainMechFlag.TM_IS_SECRET);
            }
            return true;
        },
    } as unknown as TravelExploreContext;

    return {
        player,
        nextStep: (map: number[][], at: Pos, monst: Creature | null, pref: boolean) =>
            nextStepFn(map, at, monst, pref, nextStepCtx),
    } as unknown as TargetingContext;
}

// =============================================================================
// buildHoverHandlerFn — returns (mapX, mapY) => void
// =============================================================================

/**
 * Factory for the hover handler.  Call once; the returned closure reads live
 * game state on each invocation so it always has fresh pmap / player data.
 *
 * C: mainInputLoop hover branch in IO.c (hilitePath / hiliteCell /
 *    printLocationDescription).
 */
export function buildHoverHandlerFn(): (mapX: number, mapY: number) => void {
    const printLocDesc = buildPrintLocationDescriptionFn();

    return (mapX: number, mapY: number) => {
        const { rogue, player, pmap, monsters, displayBuffer } = getGameState();
        const refreshDungeonCell = buildRefreshDungeonCellFn();
        const pathCtx = buildPathFlagCtx(rogue.playbackMode, pmap, refreshDungeonCell);

        // Always clear old path first (mirrors C clearCursorPath at outer-loop top)
        clearCursorPath(pathCtx);

        if (!coordinatesAreInMap(mapX, mapY)) return;

        // ------------------------------------------------------------------
        // Path computation: Dijkstra from cursor to everywhere, trace back
        // from player.loc following the gradient.
        // C: mainInputLoop — populateCreatureCostMap, fillGrid, dijkstraScan,
        //    backupCost trick, getPlayerPathOnMap.
        // ------------------------------------------------------------------
        const costMapFovCtx = buildCostMapFovContext();
        const costMap = allocGrid();
        populateCreatureCostMapFn(costMap, player, costMapFovCtx);

        const distMap = allocGrid();
        fillGridFn(distMap, 30000);
        distMap[mapX][mapY] = 0;

        // Temporarily set cost to 1 so Dijkstra can enter the destination cell
        const backupCost = costMap[mapX][mapY];
        costMap[mapX][mapY] = 1;
        dijkstraScanFn(distMap, costMap, true);
        costMap[mapX][mapY] = backupCost;

        // Trace path from player toward cursor
        const tracingCtx = buildPathTracingCtx(player, pmap, monsters);
        const path: Pos[] = [];
        let steps = getPlayerPathOnMapFn(path, distMap, player.loc, tracingCtx);

        // Add destination (cursor cell) as the final path element, matching C:
        //   path[steps] = pathDestination; steps++;
        path[steps] = { x: mapX, y: mapY };
        steps++;

        // Hilite the path when player is not already at cursor and a valid
        // path exists (player.loc has a finite distance from cursor).
        const atCursor = player.loc.x === mapX && player.loc.y === mapY;
        if (!atCursor && distMap[player.loc.x][player.loc.y] < 30000) {
            hilitePath(path, steps, false, pathCtx);
        }

        // ------------------------------------------------------------------
        // Highlight the cursor cell with a white tint.
        // C: hiliteCell(rogue.cursorLoc.x, rogue.cursorLoc.y, &white, 100, true)
        // ------------------------------------------------------------------
        const hiliteCellCtx = {
            ...pathCtx,
            rogue,
            getCellAppearance: buildGetCellAppearanceFn(),
            applyColorAugment: applyColorAugmentFn,
            separateColors: separateColorsFn,
            plotCharWithColor: (
                g: number,
                wp: { windowX: number; windowY: number },
                fg: unknown,
                bg: unknown,
            ) => plotCharWithColorFn(g as never, wp, fg as never, bg as never, displayBuffer),
            mapToWindow: mapToWindowFn,
        } as unknown as TargetingContext;
        hiliteCell(mapX, mapY, white, 100, true, hiliteCellCtx);

        // ------------------------------------------------------------------
        // Print flavor text description for the hovered cell.
        // C: printLocationDescription(rogue.cursorLoc.x, rogue.cursorLoc.y)
        // ------------------------------------------------------------------
        printLocDesc(mapX, mapY);
    };
}

// =============================================================================
// buildClearHoverPathFn — clear IS_IN_PATH when a non-hover event fires
// =============================================================================

/**
 * Returns a function that clears all IS_IN_PATH highlights.
 * Call from handleKeystroke / handleLeftClick so the hover path does
 * not persist after the player acts.
 *
 * C: clearCursorPath() called at top of each mainInputLoop outer iteration.
 */
export function buildClearHoverPathFn(): () => void {
    return () => {
        const { rogue, pmap } = getGameState();
        const refreshDungeonCell = buildRefreshDungeonCellFn();
        clearCursorPath(buildPathFlagCtx(rogue.playbackMode, pmap, refreshDungeonCell));
    };
}
