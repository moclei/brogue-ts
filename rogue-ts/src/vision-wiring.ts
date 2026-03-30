/*
 *  vision-wiring.ts — buildUpdateVisionFn factory
 *  Port V2 — rogue-ts
 *
 *  Builds a (refreshDisplay: boolean) => void closure that wires the full
 *  updateVision pipeline: LightingContext + CostMapFovContext assembled from
 *  live game state at call time.
 *
 *  Extracted from io-wiring.ts to avoid circular dependencies via
 *  movement-cost-map.ts → monsters.ts → io-wiring.ts.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "./core.js";
import { updateVision as updateVisionFn, updateClairvoyance as updateClairvoyanceFn } from "./time/safety-maps.js";
import type { SafetyMapsContext } from "./time/safety-maps.js";
import {
    updateLighting as updateLightingFn,
    paintLight as paintLightFn,
    backUpLighting as backUpLightingFn,
    restoreLighting as restoreLightingFn,
    createLightBackup,
} from "./light/light.js";
import type { LightingContext } from "./light/light.js";
import {
    updateFieldOfViewDisplay as updateFieldOfViewDisplayFn,
} from "./movement/cost-maps-fov.js";
import type { CostMapFovContext } from "./movement/cost-maps-fov.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import {
    monsterRevealed as monsterRevealedFn,
    monstersAreEnemies as monstersAreEnemiesFn,
} from "./monsters/monster-queries.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    terrainMechFlags as terrainMechFlagsFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
    highestPriorityLayer,
} from "./state/helpers.js";
import { layerWithTMFlag as layerWithTMFlagFn } from "./movement/map-queries.js";
import { storeMemories as storeMemoriesFn } from "./movement/map-queries.js";
import { monsterAvoids as monsterAvoidsFn } from "./monsters/monster-state.js";
import { canPass as canPassFn } from "./monsters/monster-movement.js";
import { itemAtLoc as itemAtLocFn } from "./items/item-inventory.js";
import {
    getCellAppearance,
    refreshDungeonCell as refreshDungeonCellFn,
} from "./io/cell-appearance.js";
import {
    animateFlares as animateFlaresFn,
    type FlareAnimationCallbacks,
} from "./light/flares.js";
import { commitDraws as commitDrawsFn, pauseAndCheckForEvent } from "./platform.js";
import { backgroundMessageColor, itemMessageColor } from "./globals/colors.js";
import { ItemCategory, DungeonLayer } from "./types/enums.js";
import { TileFlag, MonsterBookkeepingFlag } from "./types/flags.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { FP_FACTOR } from "./math/fixpt.js";
import type { Pos, LightSource } from "./types/types.js";

// =============================================================================
// buildUpdateVisionFn
// =============================================================================

/**
 * Returns a `(refreshDisplay: boolean) => void` closure backed by the full
 * updateVision pipeline.
 *
 * Called once per context build; the inner closure captures fresh game state
 * at call time via getGameState().
 */
export function buildUpdateVisionFn(): (refreshDisplay: boolean) => void {
    return (refreshDisplay: boolean) => {
        const {
            pmap, tmap, rogue, player, monsters, dormantMonsters,
            floorItems, displayBuffer, monsterCatalog,
        } = getGameState();
        const scentMap = getScentMap() ?? [];

        // ── FOV context (shared by LightingContext and getCellAppearance) ─────
        const fovCtx = {
            cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        };

        // ── LightingContext ───────────────────────────────────────────────────
        const lightCtx: LightingContext = {
            ...fovCtx,
            tmap: tmap as ReturnType<typeof getGameState>["tmap"] & { [i: number]: { [j: number]: { light: number[] } } },
            pmap,
            displayDetail: displayDetail as number[][],
            player,
            rogue,
            monsters,
            dormantMonsters,
            lightCatalog,
            tileCatalog,
            mutationCatalog,
            monsterRevealed: (monst) => monsterRevealedFn(monst, player),
        };

        // ── CostMapFovContext (for updateFieldOfViewDisplay) ──────────────────
        const getCellApp = (loc: Pos) => getCellAppearance(
            loc, pmap, tmap, displayBuffer, rogue, player,
            monsters, dormantMonsters, floorItems,
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            terrainRandomValues, displayDetail, scentMap,
        );

        const fovDisplayCtx: CostMapFovContext = {
            pmap,
            tmap,
            player,
            rogue: {
                depthLevel: rogue.depthLevel,
                automationActive: rogue.automationActive,
                playerTurnNumber: rogue.playerTurnNumber,
                xpxpThisTurn: rogue.xpxpThisTurn,
                mapToShore: rogue.mapToShore ?? Array.from({ length: DCOLS }, () => new Array(DROWS).fill(0)),
            },
            tileCatalog: tileCatalog as unknown as CostMapFovContext["tileCatalog"],

            cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
            cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
            terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
            terrainMechFlags: (pos) => terrainMechFlagsFn(pmap, pos),
            discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
                pmap, pos, tileCatalog,
                (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            monsterAvoids: (m, pos) => {
                // Minimal MonsterStateContext for monsterAvoids
                const minCtx = {
                    player, monsters,
                    rng: { randRange: () => 0, randPercent: () => false },
                    queryCtx: {} as never,
                    cellHasTerrainFlag: (loc: Pos, f: number) => cellHasTerrainFlagFn(pmap, loc, f),
                    cellHasTMFlag: (loc: Pos, f: number) => cellHasTMFlagFn(pmap, loc, f),
                    terrainFlags: (loc: Pos) => terrainFlagsFn(pmap, loc),
                    cellFlags: (loc: Pos) => pmap[loc.x][loc.y].flags,
                    isPosInMap: (loc: Pos) => loc.x >= 0 && loc.x < DCOLS && loc.y >= 0 && loc.y < DROWS,
                    downLoc: rogue.downLoc,
                    upLoc: rogue.upLoc,
                    // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
                    monsterAtLoc: (loc: Pos) => monsters.find(
                        m => m.loc.x === loc.x && m.loc.y === loc.y &&
                            !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
                    ) ?? null,
                    waypointCount: 0, maxWaypointCount: 0,
                    closestWaypointIndex: () => -1, closestWaypointIndexTo: () => -1,
                    burnedTerrainFlagsAtLoc: () => 0, discoveredTerrainFlagsAtLoc: () => 0,
                    passableArcCount: () => 0,
                } as never;
                return monsterAvoidsFn(m, pos, minCtx);
            },
            canPass: (mover, blocker) => canPassFn(mover, blocker, player, (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags)),
            distanceBetween: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),

            monsterAtLoc: (loc) =>
                (player.loc.x === loc.x && player.loc.y === loc.y ? player : null),
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (x, y) =>
                !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),

            itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
            itemName: (_item, buf) => { buf[0] = "item"; },

            messageWithColor: () => {},
            refreshDungeonCell: (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer),
            discoverCell: (x, y) => {
                pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            },
            storeMemories: (x, y) => storeMemoriesFn(
                pmap, x, y,
                (pos) => terrainFlagsFn(pmap, pos),
                (pos) => terrainMechFlagsFn(pmap, pos),
                (pm, xi, yi, skipGas) => highestPriorityLayer(pm, xi, yi, skipGas) as DungeonLayer,
            ),
            layerWithTMFlag: (x, y, flag) =>
                layerWithTMFlagFn(pmap, x, y, flag) as DungeonLayer,

            itemMessageColor,
            backgroundMessageColor,
            KEY: ItemCategory.KEY,

            assureCosmeticRNG: () => {},
            restoreRNG: () => {},

            getLocationFlags(x, y, limitToPlayerKnowledge) {
                const cell = pmap[x][y];
                if (limitToPlayerKnowledge && (cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) && !(pmap[x][y].flags & TileFlag.VISIBLE)) {
                    return { tFlags: cell.rememberedTerrainFlags, tmFlags: cell.rememberedTMFlags, cellFlags: cell.rememberedCellFlags };
                }
                return { tFlags: terrainFlagsFn(pmap, { x, y }), tmFlags: terrainMechFlagsFn(pmap, { x, y }), cellFlags: cell.flags };
            },
        };

        // ── SafetyMapsContext ─────────────────────────────────────────────────
        const safetyCtx: SafetyMapsContext = {
            player,
            rogue: {
                clairvoyance: rogue.clairvoyance,
                depthLevel: rogue.depthLevel,
                updatedSafetyMapThisTurn: rogue.updatedSafetyMapThisTurn,
                updatedAllySafetyMapThisTurn: rogue.updatedAllySafetyMapThisTurn,
                updatedMapToSafeTerrainThisTurn: rogue.updatedMapToSafeTerrainThisTurn,
                mapToSafeTerrain: rogue.mapToSafeTerrain ?? null,
                upLoc: rogue.upLoc,
                downLoc: rogue.downLoc,
            },
            monsters,
            dormantMonsters,
            pmap,
            tileCatalog,

            safetyMap: [] as unknown as number[][],
            allySafetyMap: [] as unknown as number[][],

            DCOLS,
            DROWS,
            FP_FACTOR: Number(FP_FACTOR),

            cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
            cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
            coordinatesAreInMap: (x, y) => x >= 0 && x < DCOLS && y >= 0 && y < DROWS,
            pmapAt: (loc) => pmap[loc.x][loc.y],
            discoveredTerrainFlagsAtLoc: (loc) => discoveredTerrainFlagsAtLocFn(
                pmap, loc, tileCatalog,
                (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
            monsterAtLoc: (loc) => monsters.find(
                m => m.loc.x === loc.x && m.loc.y === loc.y &&
                    !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
            ) ?? null,
            monstersAreEnemies: (m1, m2) => monstersAreEnemiesFn(m1, m2, player, (loc, f) => cellHasTerrainFlagFn(pmap, loc, f)),
            monsterRevealed: (monst) => monsterRevealedFn(monst, player),

            zeroOutGrid(grid: number[][]) {
                for (let i = 0; i < DCOLS; i++) {
                    if (!grid[i]) grid[i] = new Array(DROWS).fill(0);
                    else grid[i].fill(0);
                }
            },
            getFOVMask(grid, x, y, radius, oFlags, eFlags, omni) {
                getFOVMaskFn(grid, x, y, BigInt(Math.round(radius)), oFlags, eFlags, omni, fovCtx);
            },
            updateLighting: () => updateLightingFn(lightCtx),
            updateFieldOfViewDisplay: (dancing, refresh) =>
                updateFieldOfViewDisplayFn(dancing, refresh, fovDisplayCtx),
            discoverCell: (x, y) => {
                pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            },
            refreshDungeonCell: (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer),

            allocGrid: () => {
                const g: number[][] = [];
                for (let i = 0; i < DCOLS; i++) g[i] = new Array(DROWS).fill(0);
                return g;
            },
            freeGrid: () => {},
            dijkstraScan: () => {},

            max: Math.max,
            min: Math.min,

            floorItems,
        };

        updateVisionFn(refreshDisplay, safetyCtx);
    };
}

// =============================================================================
// buildUpdateClairvoyanceFn
// =============================================================================

/**
 * Returns a `() => void` closure that runs updateClairvoyance against live
 * game state. Builds only the SafetyMapsContext fields actually read by
 * updateClairvoyance (pmap, rogue.clairvoyance, player.loc, DCOLS/DROWS,
 * max/min, discoverCell).
 */
export function buildUpdateClairvoyanceFn(): () => void {
    return () => {
        const { pmap, rogue, player } = getGameState();
        const ctx = {
            pmap,
            rogue: { clairvoyance: rogue.clairvoyance },
            player,
            DCOLS,
            DROWS,
            max: Math.max,
            min: Math.min,
            discoverCell: (x: number, y: number) => {
                pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            },
        } as unknown as SafetyMapsContext;
        updateClairvoyanceFn(ctx);
    };
}

// =============================================================================
// buildAnimateFlaresFn
// =============================================================================

/**
 * Returns an async closure that animates accumulated flares using the full
 * lighting + display pipeline.
 *
 * Builds a LightingContext from live game state each call, then runs
 * animateFlares with per-frame commitDraws + pauseAndCheckForEvent.
 */
export function buildAnimateFlaresFn(): (flares: any[], count: number) => Promise<void> {
    return async (flares: any[]) => {
        if (!flares || flares.length === 0) return;
        const { pmap, tmap, rogue, player, monsters, dormantMonsters } = getGameState();
        const fovCtx = {
            cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        };
        const lightCtx: LightingContext = {
            ...fovCtx,
            tmap: tmap as ReturnType<typeof getGameState>["tmap"] & { [i: number]: { [j: number]: { light: number[] } } },
            pmap,
            displayDetail: displayDetail as number[][],
            player,
            rogue,
            monsters,
            dormantMonsters,
            lightCatalog,
            tileCatalog,
            mutationCatalog,
            monsterRevealed: (monst) => monsterRevealedFn(monst, player),
        };
        const updateVision = buildUpdateVisionFn();
        const callbacks: FlareAnimationCallbacks = {
            demoteVisibility: () => {
                for (let i = 0; i < DCOLS; i++) for (let j = 0; j < DROWS; j++) {
                    pmap[i][j].flags &= ~TileFlag.WAS_VISIBLE;
                    if (pmap[i][j].flags & TileFlag.VISIBLE) {
                        pmap[i][j].flags &= ~TileFlag.VISIBLE;
                        pmap[i][j].flags |= TileFlag.WAS_VISIBLE;
                    }
                }
            },
            updateFieldOfViewDisplay: (_dancing, refresh) => {
                if (!refresh) return;
                try { updateVision(true); } catch { /* no-op in test context */ }
            },
            pauseAnimation: async (ms) => {
                commitDrawsFn();
                try { return await pauseAndCheckForEvent(ms); } catch { return false; }
            },
        };
        await animateFlaresFn(flares, lightCtx, callbacks);
    };
}

// =============================================================================
// buildBoltLightingFns
// =============================================================================

/**
 * Builds a set of pre-wired bolt lighting functions for use in ZapRenderContext.
 *
 * Called once per zap invocation; the returned closures share a single LightBackup
 * buffer and contexts built from live game state references (pmap/tmap are stable).
 *
 * Implements the C bolt animation lighting pattern from Items.c:4912-4974:
 *   backUpLighting / demoteVisibility / restoreLighting / paintLight /
 *   updateFieldOfViewDisplay / updateVision / updateLighting
 */
export interface BoltLightingFns {
    backUpLighting(): void;
    restoreLighting(): void;
    demoteVisibility(): void;
    paintLight(theLight: LightSource, x: number, y: number): void;
    updateFieldOfViewDisplay(dancing: boolean, refresh: boolean): void;
    updateVision(full: boolean): void;
    updateLighting(): void;
}

export function buildBoltLightingFns(): BoltLightingFns {
    const {
        pmap, tmap, rogue, player, monsters, dormantMonsters,
        floorItems, displayBuffer, monsterCatalog,
    } = getGameState();
    const scentMap = getScentMap() ?? [];

    const lights = createLightBackup();

    const fovCtx = {
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    };

    const lightCtx: LightingContext = {
        ...fovCtx,
        tmap: tmap as ReturnType<typeof getGameState>["tmap"] & { [i: number]: { [j: number]: { light: number[] } } },
        pmap,
        displayDetail: displayDetail as number[][],
        player,
        rogue,
        monsters,
        dormantMonsters,
        lightCatalog,
        tileCatalog,
        mutationCatalog,
        monsterRevealed: (monst) => monsterRevealedFn(monst, player),
    };

    const getCellApp = (loc: Pos) => getCellAppearance(
        loc, pmap, tmap, displayBuffer, rogue, player,
        monsters, dormantMonsters, floorItems,
        tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        terrainRandomValues, displayDetail, scentMap,
    );

    const fovDisplayCtx: CostMapFovContext = {
        pmap,
        tmap,
        player,
        rogue: {
            depthLevel: rogue.depthLevel,
            automationActive: rogue.automationActive,
            playerTurnNumber: rogue.playerTurnNumber,
            xpxpThisTurn: rogue.xpxpThisTurn,
            mapToShore: rogue.mapToShore ?? Array.from({ length: DCOLS }, () => new Array(DROWS).fill(0)),
        },
        tileCatalog: tileCatalog as unknown as CostMapFovContext["tileCatalog"],
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
        cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
        terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
        terrainMechFlags: (pos) => terrainMechFlagsFn(pmap, pos),
        discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
        monsterAvoids: (m, pos) => {
            const minCtx = {
                player, monsters,
                rng: { randRange: () => 0, randPercent: () => false },
                queryCtx: {} as never,
                cellHasTerrainFlag: (loc: Pos, f: number) => cellHasTerrainFlagFn(pmap, loc, f),
                cellHasTMFlag: (loc: Pos, f: number) => cellHasTMFlagFn(pmap, loc, f),
                terrainFlags: (loc: Pos) => terrainFlagsFn(pmap, loc),
                cellFlags: (loc: Pos) => pmap[loc.x][loc.y].flags,
                isPosInMap: (loc: Pos) => loc.x >= 0 && loc.x < DCOLS && loc.y >= 0 && loc.y < DROWS,
                downLoc: rogue.downLoc,
                upLoc: rogue.upLoc,
                // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
                monsterAtLoc: (loc: Pos) => monsters.find(
                    m2 => m2.loc.x === loc.x && m2.loc.y === loc.y &&
                        !(m2.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
                ) ?? null,
                waypointCount: 0, maxWaypointCount: 0,
                closestWaypointIndex: () => -1, closestWaypointIndexTo: () => -1,
                burnedTerrainFlagsAtLoc: () => 0, discoveredTerrainFlagsAtLoc: () => 0,
                passableArcCount: () => 0,
            } as never;
            return monsterAvoidsFn(m, pos, minCtx);
        },
        canPass: (mover, blocker) => canPassFn(mover, blocker, player, (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags)),
        distanceBetween: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
        monsterAtLoc: (loc) =>
            (player.loc.x === loc.x && player.loc.y === loc.y ? player : null),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
        itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
        itemName: (_item, buf) => { buf[0] = "item"; },
        messageWithColor: () => {},
        refreshDungeonCell: (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer),
        discoverCell: (x, y) => {
            pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
            pmap[x][y].flags |= TileFlag.DISCOVERED;
        },
        storeMemories: (x, y) => storeMemoriesFn(
            pmap, x, y,
            (pos) => terrainFlagsFn(pmap, pos),
            (pos) => terrainMechFlagsFn(pmap, pos),
            (pm, xi, yi, skipGas) => highestPriorityLayer(pm, xi, yi, skipGas) as DungeonLayer,
        ),
        layerWithTMFlag: (x, y, flag) =>
            layerWithTMFlagFn(pmap, x, y, flag) as DungeonLayer,
        itemMessageColor,
        backgroundMessageColor,
        KEY: ItemCategory.KEY,
        assureCosmeticRNG: () => {},
        restoreRNG: () => {},
        getLocationFlags(x, y, limitToPlayerKnowledge) {
            const cell = pmap[x][y];
            if (limitToPlayerKnowledge && (cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) && !(pmap[x][y].flags & TileFlag.VISIBLE)) {
                return { tFlags: cell.rememberedTerrainFlags, tmFlags: cell.rememberedTMFlags, cellFlags: cell.rememberedCellFlags };
            }
            return { tFlags: terrainFlagsFn(pmap, { x, y }), tmFlags: terrainMechFlagsFn(pmap, { x, y }), cellFlags: cell.flags };
        },
    };

    return {
        backUpLighting() {
            backUpLightingFn(tmap, lights);
        },
        restoreLighting() {
            restoreLightingFn(tmap, lights);
        },
        demoteVisibility() {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    pmap[i][j].flags &= ~TileFlag.WAS_VISIBLE;
                    if (pmap[i][j].flags & TileFlag.VISIBLE) {
                        pmap[i][j].flags &= ~TileFlag.VISIBLE;
                        pmap[i][j].flags |= TileFlag.WAS_VISIBLE;
                    }
                }
            }
        },
        paintLight(theLight: LightSource, x: number, y: number) {
            paintLightFn(theLight, x, y, false, false, lightCtx);
        },
        updateFieldOfViewDisplay(dancing: boolean, refresh: boolean) {
            updateFieldOfViewDisplayFn(dancing, refresh, fovDisplayCtx);
        },
        updateVision(full: boolean) {
            buildUpdateVisionFn()(full);
        },
        updateLighting() {
            updateLightingFn(lightCtx);
        },
    };
}

