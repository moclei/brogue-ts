/*
 *  waypoint-wiring.ts — Shared wiring factory for setUpWaypoints / refreshWaypoint
 *  Port V2 — rogue-ts
 *
 *  Exports:
 *    buildSetUpWaypointsFn() — returns a () => void that calls setUpWaypoints()
 *                              and stores the result on rogue.
 *    buildRefreshWaypointFn() — returns a (index) => void that calls refreshWaypoint()
 *
 *  Used by bolt/staff wiring contexts where waypoints need to be rebuilt
 *  after a conjuration effect (gate ward) or refreshed per-turn.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { setUpWaypoints, refreshWaypoint } from "./architect/architect.js";
import { populateGenericCostMap } from "./movement/cost-maps-fov.js";
import { getFOVMask } from "./light/fov.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import type { CostMapFovContext } from "./movement/cost-maps-fov.js";

// =============================================================================
// buildSetUpWaypointsFn
// =============================================================================

/**
 * Returns a `setUpWaypoints()` closure wired to the current game state.
 * After calling, stores wpDistance and wpCoordinates on rogue.
 *
 * Used in bolt detonation (BE_CONJURATION) and level start.
 */
export function buildSetUpWaypointsFn(): () => void {
    return () => {
        const { pmap, rogue, monsters } = getGameState();

        const fovCtx = {
            cellHasTerrainFlag: (pos: { x: number; y: number }, flags: number) =>
                cellHasTerrainFlagFn(pmap, pos, flags),
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        };

        const costCtx = {
            cellHasTerrainFlag: (pos: { x: number; y: number }, flags: number) =>
                cellHasTerrainFlagFn(pmap, pos, flags),
            cellHasTMFlag: (pos: { x: number; y: number }, flags: number) =>
                cellHasTMFlagFn(pmap, pos, flags),
            discoveredTerrainFlagsAtLoc: (pos: { x: number; y: number }) =>
                discoveredTerrainFlagsAtLocFn(pmap, pos, tileCatalog, (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                }),
        } as unknown as CostMapFovContext;

        const costMapWrap = (costMap: number[][]) => populateGenericCostMap(costMap, costCtx);
        const getFOVMaskWrap = (
            grid: number[][], x: number, y: number, r: bigint,
            ft: number, ff: number, c: boolean,
        ) => getFOVMask(grid, x, y, r, ft, ff, c, fovCtx);

        const result = setUpWaypoints(pmap, costMapWrap, getFOVMaskWrap, monsters);
        rogue.wpDistance = result.wpDistance;
        rogue.wpCoordinates = result.wpCoordinates;
        rogue.wpCount = result.wpCoordinates.length;
    };
}

// =============================================================================
// buildRefreshWaypointFn
// =============================================================================

/**
 * Returns a `refreshWaypoint(index)` closure wired to the current game state.
 *
 * Used in turn processing (playerTurnEnded) to refresh one waypoint per turn.
 */
export function buildRefreshWaypointFn(): (index: number) => void {
    return (index: number) => {
        const { pmap, rogue, monsters } = getGameState();

        const costCtx = {
            cellHasTerrainFlag: (pos: { x: number; y: number }, flags: number) =>
                cellHasTerrainFlagFn(pmap, pos, flags),
            cellHasTMFlag: (pos: { x: number; y: number }, flags: number) =>
                cellHasTMFlagFn(pmap, pos, flags),
            discoveredTerrainFlagsAtLoc: (pos: { x: number; y: number }) =>
                discoveredTerrainFlagsAtLocFn(pmap, pos, tileCatalog, (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                }),
        } as unknown as CostMapFovContext;

        const dist = rogue.wpDistance[index];
        const coord = rogue.wpCoordinates[index];
        if (!dist || !coord) return;
        refreshWaypoint(dist, coord, (cm) => populateGenericCostMap(cm, costCtx), monsters);
    };
}
