/*
 *  tile-effects-env-wiring.ts — Environment-only tile effect builders
 *  Port V2 — rogue-ts
 *
 *  Exports buildExposeTileToFireFn() and buildExposeTileToElectricityFn(),
 *  extracted from tile-effects-wiring.ts to keep that file under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import {
    exposeTileToFire as exposeTileToFireFn,
    exposeTileToElectricity as exposeTileToElectricityFn,
} from "./time/environment.js";
import type { EnvironmentContext } from "./time/environment.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { buildRefreshDungeonCellFn } from "./io-wiring.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "./state/helpers.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { randRange, randPercent, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "./math/rng.js";
import { DCOLS, DROWS } from "./types/constants.js";
import type { Pos } from "./types/types.js";

// =============================================================================
// buildExposeTileToFireFn
// =============================================================================

/**
 * Returns an `exposeTileToFire(x, y, alwaysIgnite)` closure wired to the
 * current game state. Replaces `() => false` stubs in bolt/staff contexts.
 *
 * Builds a minimal EnvironmentContext covering the fields actually read by
 * exposeTileToFire and its internal helper promoteTile.
 */
export function buildExposeTileToFireFn(): (x: number, y: number, alwaysIgnite: boolean) => boolean {
    const { pmap, rogue, monsters, levels } = getGameState();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const cellHasTerrainFlag = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags);

    const spawnFeature = (x: number, y: number, feat: any, v: boolean, o: boolean): void => {
        spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat, v, o);
    };

    let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
    const envCtx = {
        pmap, rogue, tileCatalog, dungeonFeatureCatalog, DCOLS, DROWS, monsters, levels,
        refreshDungeonCell, spawnDungeonFeature: spawnFeature,
        cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        // permanent-defer — tile-exposure bolt path does not recurse into full turn pipeline
        monstersFall: () => {}, updateFloorItems: () => {}, monstersTurn: () => {}, keyOnTileAt: () => null,
        removeCreature: () => false, prependCreature: () => {},
        rand_range: randRange, rand_percent: randPercent,
        max: Math.max, min: Math.min,
        fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
        shuffleList: (list: number[], _len: number) => shuffleListFn(list),
        exposeTileToFire: (x: number, y: number, a: boolean) => exposeToFire(x, y, a),
    } as unknown as EnvironmentContext;
    exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);

    return exposeToFire;
}

// =============================================================================
// buildExposeTileToElectricityFn
// =============================================================================

/**
 * Returns an `exposeTileToElectricity(x, y)` closure wired to the
 * current game state. Replaces `() => false` stubs in bolt/staff contexts.
 *
 * exposeTileToElectricity only needs pmap, tileCatalog, and cellHasTMFlag
 * (plus promoteTile which uses the full EnvironmentContext).
 */
export function buildExposeTileToElectricityFn(): (x: number, y: number) => boolean {
    const { pmap, rogue, monsters, levels } = getGameState();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const cellHasTerrainFlag = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags);

    const spawnFeature = (x: number, y: number, feat: any, v: boolean, o: boolean): void => {
        spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat, v, o);
    };

    let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
    const envCtx = {
        pmap, rogue, tileCatalog, dungeonFeatureCatalog, DCOLS, DROWS, monsters, levels,
        refreshDungeonCell, spawnDungeonFeature: spawnFeature,
        cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        // permanent-defer — tile-exposure bolt path does not recurse into full turn pipeline
        monstersFall: () => {}, updateFloorItems: () => {}, monstersTurn: () => {}, keyOnTileAt: () => null,
        removeCreature: () => false, prependCreature: () => {},
        rand_range: randRange, rand_percent: randPercent,
        max: Math.max, min: Math.min,
        fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
        shuffleList: (list: number[], _len: number) => shuffleListFn(list),
        exposeTileToFire: (x: number, y: number, a: boolean) => exposeToFire(x, y, a),
    } as unknown as EnvironmentContext;
    exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);

    return (x: number, y: number) => exposeTileToElectricityFn(x, y, envCtx);
}
