/*
 *  environment.ts — Environment update logic
 *  brogue-ts
 *
 *  Ported from: src/brogue/Time.c
 *  Functions: promoteTile, activateMachine, circuitBreakersPreventActivation,
 *             exposeTileToElectricity, exposeTileToFire, updateVolumetricMedia,
 *             updateYendorWardenTracking, updateEnvironment
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Creature,
    Pos,
    Pcell,
    Item,
    LevelData,
    FloorTileType,
    DungeonFeature,
} from "../types/types.js";
import { DungeonLayer, TileType } from "../types/enums.js";
import {
    Fl,
    TileFlag,
    IS_IN_MACHINE,
    T_PATHING_BLOCKER,
    TerrainFlag,
    TerrainMechFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
} from "../types/flags.js";
import { StatusEffect } from "../types/enums.js";
import { NUMBER_TERRAIN_LAYERS } from "../types/constants.js";

// =============================================================================
// Directions (cardinal: N, E, S, W and diagonals)
// =============================================================================

export const nbDirs: readonly [number, number][] = [
    [0, -1],  // up
    [1, 0],   // right
    [0, 1],   // down
    [-1, 0],  // left
    [-1, -1], // up-left
    [1, -1],  // up-right
    [-1, 1],  // down-left
    [1, 1],   // down-right
];

export const DIRECTION_COUNT = 8;

// =============================================================================
// Context
// =============================================================================

export interface EnvironmentContext {
    player: Creature;
    rogue: {
        depthLevel: number;
        staleLoopMap: boolean;
        yendorWarden: Creature | null;
    };
    monsters: Creature[];
    pmap: Pcell[][];
    levels: LevelData[];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];

    DCOLS: number;
    DROWS: number;

    // Map helpers
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    coordinatesAreInMap(x: number, y: number): boolean;

    // Environment helpers
    refreshDungeonCell(loc: Pos): void;
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;
    monstersFall(): void;
    updateFloorItems(): void;
    monstersTurn(monst: Creature): void;
    keyOnTileAt(loc: Pos): Item | null;

    // Monster helpers
    removeCreature(list: Creature[], monst: Creature): boolean;
    prependCreature(list: Creature[], monst: Creature): void;

    // Math
    rand_range(lower: number, upper: number): number;
    rand_percent(chance: number): boolean;
    max(a: number, b: number): number;
    min(a: number, b: number): number;

    // Shuffle helpers
    fillSequentialList(list: number[], length: number): void;
    shuffleList(list: number[], length: number): void;

    // exposeTileToFire (needed for updateEnvironment)
    exposeTileToFire(x: number, y: number, alwaysIgnite: boolean): boolean;
}

// =============================================================================
// circuitBreakersPreventActivation — from Time.c:1087
// =============================================================================

export function circuitBreakersPreventActivation(
    machineNumber: number,
    ctx: EnvironmentContext,
): boolean {
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (
                ctx.pmap[i][j].machineNumber === machineNumber &&
                ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_IS_CIRCUIT_BREAKER)
            ) {
                return true;
            }
        }
    }
    return false;
}

// =============================================================================
// activateMachine — from Time.c:1032
// =============================================================================

export function activateMachine(
    machineNumber: number,
    ctx: EnvironmentContext,
): void {
    const sCols: number[] = new Array(ctx.DCOLS);
    const sRows: number[] = new Array(ctx.DROWS);

    ctx.fillSequentialList(sCols, ctx.DCOLS);
    ctx.shuffleList(sCols, ctx.DCOLS);
    ctx.fillSequentialList(sRows, ctx.DROWS);
    ctx.shuffleList(sRows, ctx.DROWS);

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            const x = sCols[i];
            const y = sRows[j];
            if (
                (ctx.pmap[x][y].flags & IS_IN_MACHINE) &&
                ctx.pmap[x][y].machineNumber === machineNumber &&
                !(ctx.pmap[x][y].flags & TileFlag.IS_POWERED) &&
                ctx.cellHasTMFlag({ x, y }, TerrainMechFlag.TM_IS_WIRED)
            ) {
                ctx.pmap[x][y].flags |= TileFlag.IS_POWERED;
                for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                    if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].mechFlags & TerrainMechFlag.TM_IS_WIRED) {
                        promoteTile(x, y, layer as DungeonLayer, false, ctx);
                    }
                }
            }
        }
    }

    // Collect and activate monsters belonging to this machine
    const activatedMonsters: Creature[] = [];
    for (const monst of ctx.monsters) {
        if (
            monst.machineHome === machineNumber &&
            monst.spawnDepth === ctx.rogue.depthLevel &&
            (monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION)
        ) {
            activatedMonsters.push(monst);
        }
    }
    for (const monst of activatedMonsters) {
        if (!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)) {
            ctx.monstersTurn(monst);
        }
    }
}

// =============================================================================
// promoteTile — from Time.c:1101
// =============================================================================

export function promoteTile(
    x: number,
    y: number,
    layer: DungeonLayer,
    useFireDF: boolean,
    ctx: EnvironmentContext,
): void {
    const tile = ctx.tileCatalog[ctx.pmap[x][y].layers[layer]];
    const DFType = useFireDF ? tile.fireType : tile.promoteType;

    if (tile.mechFlags & TerrainMechFlag.TM_VANISHES_UPON_PROMOTION) {
        if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flags & T_PATHING_BLOCKER) {
            ctx.rogue.staleLoopMap = true;
        }
        ctx.pmap[x][y].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING);
        if (layer === DungeonLayer.Gas) {
            ctx.pmap[x][y].volume = 0;
        }
        ctx.refreshDungeonCell({ x, y });
    }
    if (DFType) {
        ctx.spawnDungeonFeature(x, y, ctx.dungeonFeatureCatalog[DFType as number], true, false);
    }

    if (
        !useFireDF &&
        (tile.mechFlags & TerrainMechFlag.TM_IS_WIRED) &&
        !(ctx.pmap[x][y].flags & TileFlag.IS_POWERED) &&
        !circuitBreakersPreventActivation(ctx.pmap[x][y].machineNumber, ctx)
    ) {
        ctx.pmap[x][y].flags |= TileFlag.IS_POWERED;
        activateMachine(ctx.pmap[x][y].machineNumber, ctx);

        // Power fades immediately
        for (let i = 0; i < ctx.DCOLS; i++) {
            for (let j = 0; j < ctx.DROWS; j++) {
                ctx.pmap[i][j].flags &= ~TileFlag.IS_POWERED;
            }
        }
    }
}

// =============================================================================
// exposeTileToElectricity — from Time.c:1142
// =============================================================================

export function exposeTileToElectricity(
    x: number,
    y: number,
    ctx: EnvironmentContext,
): boolean {
    if (!ctx.cellHasTMFlag({ x, y }, TerrainMechFlag.TM_PROMOTES_ON_ELECTRICITY)) {
        return false;
    }
    let promotedSomething = false;
    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].mechFlags & TerrainMechFlag.TM_PROMOTES_ON_ELECTRICITY) {
            promoteTile(x, y, layer as DungeonLayer, false, ctx);
            promotedSomething = true;
        }
    }
    return promotedSomething;
}

// =============================================================================
// exposeTileToFire — from Time.c:1158
// =============================================================================

export function exposeTileToFire(
    x: number,
    y: number,
    alwaysIgnite: boolean,
    ctx: EnvironmentContext,
): boolean {
    let ignitionChance = 0;
    let bestExtinguishingPriority = 1000;
    let explosiveNeighborCount = 0;
    let fireIgnited = false;
    let explosivePromotion = false;

    if (
        !ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_IS_FLAMMABLE) ||
        ctx.pmap[x][y].exposedToFire >= 12
    ) {
        return false;
    }

    ctx.pmap[x][y].exposedToFire++;

    // Pick the extinguishing layer with the best priority
    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        if (
            (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].mechFlags & TerrainMechFlag.TM_EXTINGUISHES_FIRE) &&
            ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].drawPriority < bestExtinguishingPriority
        ) {
            bestExtinguishingPriority = ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].drawPriority;
        }
    }

    // Pick the fire type of the most flammable layer
    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        if (
            (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flags & TerrainFlag.T_IS_FLAMMABLE) &&
            (layer === DungeonLayer.Gas ||
                ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].drawPriority <= bestExtinguishingPriority) &&
            ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].chanceToIgnite > ignitionChance
        ) {
            ignitionChance = ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].chanceToIgnite;
        }
    }

    if (alwaysIgnite || (ignitionChance && ctx.rand_percent(ignitionChance))) {
        fireIgnited = true;

        // Count explosive neighbors
        if (ctx.cellHasTMFlag({ x, y }, TerrainMechFlag.TM_EXPLOSIVE_PROMOTE)) {
            explosiveNeighborCount = 0;
            for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                const newX = x + nbDirs[dir][0];
                const newY = y + nbDirs[dir][1];
                if (
                    ctx.coordinatesAreInMap(newX, newY) &&
                    (ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_IS_FIRE | TerrainFlag.T_OBSTRUCTS_GAS) ||
                        ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_EXPLOSIVE_PROMOTE))
                ) {
                    explosiveNeighborCount++;
                }
            }
            if (explosiveNeighborCount >= 8) {
                explosivePromotion = true;
            }
        }

        // Flammable layers are consumed
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flags & TerrainFlag.T_IS_FLAMMABLE) {
                if (layer === DungeonLayer.Gas) {
                    ctx.pmap[x][y].volume = 0;
                }
                promoteTile(x, y, layer as DungeonLayer, !explosivePromotion, ctx);
            }
        }
        ctx.refreshDungeonCell({ x, y });
    }
    return fireIgnited;
}

// =============================================================================
// updateVolumetricMedia — from Time.c:1224 (static)
// =============================================================================

export function updateVolumetricMedia(
    ctx: EnvironmentContext,
): void {
    const newGasVolume: number[][] = [];
    for (let i = 0; i < ctx.DCOLS; i++) {
        newGasVolume[i] = [];
        for (let j = 0; j < ctx.DROWS; j++) {
            newGasVolume[i][j] = 0;
        }
    }

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (!ctx.cellHasTerrainFlag({ x: i, y: j }, TerrainFlag.T_OBSTRUCTS_GAS)) {
                let sum = ctx.pmap[i][j].volume;
                let numSpaces = 1;
                let highestNeighborVolume = ctx.pmap[i][j].volume;
                let gasType = ctx.pmap[i][j].layers[DungeonLayer.Gas];

                for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        ctx.coordinatesAreInMap(newX, newY) &&
                        !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_GAS)
                    ) {
                        sum += ctx.pmap[newX][newY].volume;
                        numSpaces++;
                        if (ctx.pmap[newX][newY].volume > highestNeighborVolume) {
                            highestNeighborVolume = ctx.pmap[newX][newY].volume;
                            gasType = ctx.pmap[newX][newY].layers[DungeonLayer.Gas];
                        }
                    }
                }

                if (ctx.cellHasTerrainFlag({ x: i, y: j }, TerrainFlag.T_AUTO_DESCENT)) {
                    numSpaces++;
                }

                newGasVolume[i][j] += Math.floor(sum / ctx.max(1, numSpaces));
                if (ctx.rand_range(0, numSpaces - 1) < (sum % numSpaces)) {
                    newGasVolume[i][j]++;
                }

                if (ctx.pmap[i][j].layers[DungeonLayer.Gas] !== gasType && newGasVolume[i][j] > 3) {
                    if (ctx.pmap[i][j].layers[DungeonLayer.Gas] !== TileType.NOTHING) {
                        newGasVolume[i][j] = ctx.min(3, newGasVolume[i][j]);
                    }
                    ctx.pmap[i][j].layers[DungeonLayer.Gas] = gasType;
                } else if (ctx.pmap[i][j].layers[DungeonLayer.Gas] && newGasVolume[i][j] < 1) {
                    ctx.pmap[i][j].layers[DungeonLayer.Gas] = TileType.NOTHING;
                    ctx.refreshDungeonCell({ x: i, y: j });
                }

                if (ctx.pmap[i][j].volume > 0) {
                    if (ctx.tileCatalog[ctx.pmap[i][j].layers[DungeonLayer.Gas]].mechFlags & TerrainMechFlag.TM_GAS_DISSIPATES_QUICKLY) {
                        newGasVolume[i][j] -= (ctx.rand_percent(50) ? 1 : 0);
                    } else if (ctx.tileCatalog[ctx.pmap[i][j].layers[DungeonLayer.Gas]].mechFlags & TerrainMechFlag.TM_GAS_DISSIPATES) {
                        newGasVolume[i][j] -= (ctx.rand_percent(20) ? 1 : 0);
                    }
                }
            } else if (ctx.pmap[i][j].volume > 0) {
                // Gas in an obstructing cell disperses to neighbors
                let numSpaces = 0;
                for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        ctx.coordinatesAreInMap(newX, newY) &&
                        !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_GAS)
                    ) {
                        numSpaces++;
                    }
                }
                if (numSpaces > 0) {
                    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                        const newX = i + nbDirs[dir][0];
                        const newY = j + nbDirs[dir][1];
                        if (
                            ctx.coordinatesAreInMap(newX, newY) &&
                            !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_GAS)
                        ) {
                            newGasVolume[newX][newY] += Math.floor(ctx.pmap[i][j].volume / numSpaces);
                            if (Math.floor(ctx.pmap[i][j].volume / numSpaces)) {
                                ctx.pmap[newX][newY].layers[DungeonLayer.Gas] = ctx.pmap[i][j].layers[DungeonLayer.Gas];
                            }
                        }
                    }
                }
                newGasVolume[i][j] = 0;
                ctx.pmap[i][j].layers[DungeonLayer.Gas] = TileType.NOTHING;
            }
        }
    }

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (ctx.pmap[i][j].volume !== newGasVolume[i][j]) {
                ctx.pmap[i][j].volume = newGasVolume[i][j];
                ctx.refreshDungeonCell({ x: i, y: j });
            }
        }
    }
}

// =============================================================================
// updateYendorWardenTracking — from Time.c:1324
// =============================================================================

export function updateYendorWardenTracking(
    ctx: EnvironmentContext,
): void {
    if (!ctx.rogue.yendorWarden) {
        return;
    }
    if (ctx.rogue.yendorWarden.depth === ctx.rogue.depthLevel) {
        return;
    }
    if (!(ctx.rogue.yendorWarden.bookkeepingFlags & MonsterBookkeepingFlag.MB_PREPLACED)) {
        const d = ctx.rogue.yendorWarden.depth - 1;
        ctx.levels[d].mapStorage[ctx.rogue.yendorWarden.loc.x][ctx.rogue.yendorWarden.loc.y].flags &= ~TileFlag.HAS_MONSTER;
    }
    let n = ctx.rogue.yendorWarden.depth - 1;

    // Remove from other level's monster chain
    ctx.removeCreature(ctx.levels[n].monsters, ctx.rogue.yendorWarden);

    if (ctx.rogue.yendorWarden.depth > ctx.rogue.depthLevel) {
        ctx.rogue.yendorWarden.depth = ctx.rogue.depthLevel + 1;
        n = ctx.rogue.yendorWarden.depth - 1;
        ctx.rogue.yendorWarden.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS;
        ctx.rogue.yendorWarden.loc.x = ctx.levels[n].downStairsLoc.x;
        ctx.rogue.yendorWarden.loc.y = ctx.levels[n].downStairsLoc.y;
    } else {
        ctx.rogue.yendorWarden.depth = ctx.rogue.depthLevel - 1;
        n = ctx.rogue.yendorWarden.depth - 1;
        ctx.rogue.yendorWarden.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS;
        ctx.rogue.yendorWarden.loc.x = ctx.levels[n].upStairsLoc.x;
        ctx.rogue.yendorWarden.loc.y = ctx.levels[n].upStairsLoc.y;
    }

    ctx.prependCreature(ctx.levels[ctx.rogue.yendorWarden.depth - 1].monsters, ctx.rogue.yendorWarden);
    ctx.rogue.yendorWarden.bookkeepingFlags |= MonsterBookkeepingFlag.MB_PREPLACED;
    ctx.rogue.yendorWarden.status[StatusEffect.EntersLevelIn] = 50;
}

// =============================================================================
// updateEnvironment — from Time.c:1412
// =============================================================================

export function updateEnvironment(
    ctx: EnvironmentContext,
): void {
    ctx.monstersFall();

    // Reset exposedToFire
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].exposedToFire = 0;
        }
    }

    // Update gases twice if any exist
    let isVolumetricGas = false;
    for (let i = 0; i < ctx.DCOLS && !isVolumetricGas; i++) {
        for (let j = 0; j < ctx.DROWS && !isVolumetricGas; j++) {
            if (ctx.pmap[i][j].layers[DungeonLayer.Gas]) {
                isVolumetricGas = true;
            }
        }
    }
    if (isVolumetricGas) {
        updateVolumetricMedia(ctx);
        updateVolumetricMedia(ctx);
    }

    // Do random tile promotions in two passes
    const promotions: number[][] = [];
    for (let i = 0; i < ctx.DCOLS; i++) {
        promotions[i] = [];
        for (let j = 0; j < ctx.DROWS; j++) {
            promotions[i][j] = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                const tile = ctx.tileCatalog[ctx.pmap[i][j].layers[layer]];
                let promoteChance: number;

                if (tile.promoteChance < 0) {
                    promoteChance = 0;
                    for (let direction = 0; direction < 4; direction++) {
                        const nx = i + nbDirs[direction][0];
                        const ny = j + nbDirs[direction][1];
                        if (
                            ctx.coordinatesAreInMap(nx, ny) &&
                            !ctx.cellHasTerrainFlag({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                            ctx.pmap[nx][ny].layers[layer] !== ctx.pmap[i][j].layers[layer] &&
                            !(ctx.pmap[i][j].flags & TileFlag.CAUGHT_FIRE_THIS_TURN)
                        ) {
                            promoteChance += -1 * tile.promoteChance;
                        }
                    }
                } else {
                    promoteChance = tile.promoteChance;
                }

                if (
                    promoteChance &&
                    !(ctx.pmap[i][j].flags & TileFlag.CAUGHT_FIRE_THIS_TURN) &&
                    ctx.rand_range(0, 10000) < promoteChance
                ) {
                    promotions[i][j] |= Fl(layer);
                }
            }
        }
    }

    // Second pass: do the promotions
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                if (promotions[i][j] & Fl(layer)) {
                    promoteTile(i, j, layer as DungeonLayer, false, ctx);
                }
            }
        }
    }

    // Bookkeeping for fire, pressure plates and key-activated tiles
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].flags &= ~TileFlag.CAUGHT_FIRE_THIS_TURN;

            if (
                !(ctx.pmap[i][j].flags & (TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_ITEM)) &&
                (ctx.pmap[i][j].flags & TileFlag.PRESSURE_PLATE_DEPRESSED)
            ) {
                ctx.pmap[i][j].flags &= ~TileFlag.PRESSURE_PLATE_DEPRESSED;
            }

            if (
                ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_PROMOTES_WITHOUT_KEY) &&
                !ctx.keyOnTileAt({ x: i, y: j })
            ) {
                for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                    if (ctx.tileCatalog[ctx.pmap[i][j].layers[layer]].mechFlags & TerrainMechFlag.TM_PROMOTES_WITHOUT_KEY) {
                        promoteTile(i, j, layer as DungeonLayer, false, ctx);
                    }
                }
            }
        }
    }

    // Update fire
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (
                ctx.cellHasTerrainFlag({ x: i, y: j }, TerrainFlag.T_IS_FIRE) &&
                !(ctx.pmap[i][j].flags & TileFlag.CAUGHT_FIRE_THIS_TURN)
            ) {
                ctx.exposeTileToFire(i, j, false);
                for (let direction = 0; direction < 4; direction++) {
                    const newX = i + nbDirs[direction][0];
                    const newY = j + nbDirs[direction][1];
                    if (ctx.coordinatesAreInMap(newX, newY)) {
                        ctx.exposeTileToFire(newX, newY, false);
                    }
                }
            }
        }
    }

    // Terrain that affects items and vice versa
    ctx.updateFloorItems();
}
