/*
 *  lakes.ts — Lake generation, bridges, wall/door finishing
 *  brogue-ts
 *
 *  Handles lake design and placement, bridge building, wall finishing,
 *  door finishing, and cleanup of lake boundaries and diagonal openings.
 *
 *  Ported from: Architect.c lines 1855–2873
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pcell, GameConstants } from "../types/types.js";
import { TileType, DungeonLayer } from "../types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../types/constants.js";
import {
    TerrainFlag, TerrainMechFlag, TileFlag,
    T_PATHING_BLOCKER, T_LAKE_PATHING_BLOCKER, T_CAN_BE_BRIDGED,
} from "../types/flags.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import {
    cellHasTerrainFlag, cellHasTMFlag, terrainFlags,
} from "../state/helpers.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import {
    allocGrid, freeGrid, fillGrid, createBlobOnGrid, type Grid,
} from "../grid/grid.js";
import { randRange, randPercent, clamp, fillSequentialList, shuffleList } from "../math/rng.js";

// =============================================================================
// Lake boundary cleanup
// =============================================================================

/**
 * Knock down boundaries between similar lakes where possible.
 *
 * Iterates through all cells, and where a wall-like cell separates two
 * identical lake types, replaces it with the lake type.
 *
 * C equivalent: `cleanUpLakeBoundaries()` in Architect.c line 1856
 */
export function cleanUpLakeBoundaries(pmap: Pcell[][]): void {
    let reverse = true;
    let failsafe = 100;
    let madeChange: boolean;

    do {
        madeChange = false;
        reverse = !reverse;
        failsafe--;

        for (
            let i = reverse ? DCOLS - 2 : 1;
            reverse ? i > 0 : i < DCOLS - 1;
            reverse ? i-- : i++
        ) {
            for (
                let j = reverse ? DROWS - 2 : 1;
                reverse ? j > 0 : j < DROWS - 1;
                reverse ? j-- : j++
            ) {
                if (
                    cellHasTerrainFlag(pmap, { x: i, y: j }, T_LAKE_PATHING_BLOCKER | TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    && !cellHasTMFlag(pmap, { x: i, y: j }, TerrainMechFlag.TM_IS_SECRET)
                    && !(pmap[i][j].flags & TileFlag.IMPREGNABLE)
                ) {
                    const subjectFlags = terrainFlags(pmap, { x: i, y: j }) & (T_LAKE_PATHING_BLOCKER | TerrainFlag.T_OBSTRUCTS_PASSABILITY);

                    let x = 0;
                    let y = 0;

                    const leftFlags = terrainFlags(pmap, { x: i - 1, y: j }) & T_LAKE_PATHING_BLOCKER & ~subjectFlags;
                    if (
                        leftFlags
                        && !cellHasTMFlag(pmap, { x: i - 1, y: j }, TerrainMechFlag.TM_IS_SECRET)
                        && !cellHasTMFlag(pmap, { x: i + 1, y: j }, TerrainMechFlag.TM_IS_SECRET)
                        && leftFlags === (terrainFlags(pmap, { x: i + 1, y: j }) & T_LAKE_PATHING_BLOCKER & ~subjectFlags)
                    ) {
                        x = i + 1;
                        y = j;
                    } else {
                        const topFlags = terrainFlags(pmap, { x: i, y: j - 1 }) & T_LAKE_PATHING_BLOCKER & ~subjectFlags;
                        if (
                            topFlags
                            && !cellHasTMFlag(pmap, { x: i, y: j - 1 }, TerrainMechFlag.TM_IS_SECRET)
                            && !cellHasTMFlag(pmap, { x: i, y: j + 1 }, TerrainMechFlag.TM_IS_SECRET)
                            && topFlags === (terrainFlags(pmap, { x: i, y: j + 1 }) & T_LAKE_PATHING_BLOCKER & ~subjectFlags)
                        ) {
                            x = i;
                            y = j + 1;
                        }
                    }

                    if (x) {
                        madeChange = true;
                        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                            pmap[i][j].layers[layer] = pmap[x][y].layers[layer];
                        }
                    }
                }
            }
        }
    } while (madeChange && failsafe > 0);
}

// =============================================================================
// Diagonal opening removal
// =============================================================================

/**
 * Remove diagonal-only openings between passable cells.
 *
 * Finds 2×2 squares where two diagonally-opposite cells are passable
 * and the other two obstruct both passability and diagonal movement,
 * then fixes by copying terrain from one passable cell to one wall cell.
 *
 * C equivalent: `removeDiagonalOpenings()` in Architect.c line 1913
 */
export function removeDiagonalOpenings(pmap: Pcell[][]): void {
    let diagonalCornerRemoved: boolean;

    do {
        diagonalCornerRemoved = false;
        for (let i = 0; i < DCOLS - 1; i++) {
            for (let j = 0; j < DROWS - 1; j++) {
                for (let k = 0; k <= 1; k++) {
                    if (
                        !(tileCatalog[pmap[i + k][j].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        && (tileCatalog[pmap[i + (1 - k)][j].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        && (tileCatalog[pmap[i + (1 - k)][j].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                        && (tileCatalog[pmap[i + k][j + 1].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        && (tileCatalog[pmap[i + k][j + 1].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                        && !(tileCatalog[pmap[i + (1 - k)][j + 1].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    ) {
                        let x1: number;
                        let y1: number;

                        if (randPercent(50)) {
                            x1 = i + (1 - k);
                            y1 = j;
                        } else {
                            x1 = i + k;
                            y1 = j + 1;
                        }
                        const x2Src = (y1 === j) ? (i + k) : (i + (1 - k));

                        if (
                            !(pmap[x1][y1].flags & TileFlag.HAS_MONSTER)
                            && pmap[x1][y1].machineNumber === 0
                        ) {
                            diagonalCornerRemoved = true;
                            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                                pmap[x1][y1].layers[layer] = pmap[x2Src][y1].layers[layer];
                            }
                        }
                    }
                }
            }
        }
    } while (diagonalCornerRemoved);
}

// =============================================================================
// Wall finishing
// =============================================================================

/**
 * Convert granite cells adjacent to non-obstructing cells into walls,
 * and convert wall cells not adjacent to any non-obstructing cells back
 * to granite.
 *
 * C equivalent: `finishWalls(includingDiagonals)` in Architect.c line 2480
 */
export function finishWalls(pmap: Pcell[][], includingDiagonals: boolean): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.GRANITE) {
                let foundExposure = false;
                const maxDir = includingDiagonals ? 8 : 4;
                for (let dir = 0; dir < maxDir && !foundExposure; dir++) {
                    const x1 = i + nbDirs[dir][0];
                    const y1 = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(x1, y1)
                        && (
                            !cellHasTerrainFlag(pmap, { x: x1, y: y1 }, TerrainFlag.T_OBSTRUCTS_VISION)
                            || !cellHasTerrainFlag(pmap, { x: x1, y: y1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        )
                    ) {
                        pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.WALL;
                        foundExposure = true;
                    }
                }
            } else if (pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.WALL) {
                let foundExposure = false;
                const maxDir = includingDiagonals ? 8 : 4;
                for (let dir = 0; dir < maxDir && !foundExposure; dir++) {
                    const x1 = i + nbDirs[dir][0];
                    const y1 = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(x1, y1)
                        && (
                            !cellHasTerrainFlag(pmap, { x: x1, y: y1 }, TerrainFlag.T_OBSTRUCTS_VISION)
                            || !cellHasTerrainFlag(pmap, { x: x1, y: y1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        )
                    ) {
                        foundExposure = true;
                    }
                }
                if (!foundExposure) {
                    pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.GRANITE;
                }
            }
        }
    }
}

// =============================================================================
// Liquid type selection
// =============================================================================

/** Result of liquidType selection */
export interface LiquidTypeResult {
    deep: TileType;
    shallow: TileType;
    shallowWidth: number;
}

/**
 * Choose a liquid type based on dungeon depth.
 *
 * C equivalent: `liquidType(deep, shallow, shallowWidth)` in Architect.c line 2518
 */
export function liquidType(
    depthLevel: number,
    gameConst: GameConstants,
): LiquidTypeResult {
    const randMin = depthLevel < gameConst.minimumLavaLevel ? 1 : 0;
    const randMax = depthLevel < gameConst.minimumBrimstoneLevel ? 2 : 3;
    let rand = randRange(randMin, randMax);

    if (depthLevel === gameConst.deepestLevel) {
        rand = 1;
    }

    switch (rand) {
        case 0:
            return { deep: TileType.LAVA, shallow: TileType.NOTHING, shallowWidth: 0 };
        case 1:
            return { deep: TileType.DEEP_WATER, shallow: TileType.SHALLOW_WATER, shallowWidth: 2 };
        case 2:
            return { deep: TileType.CHASM, shallow: TileType.CHASM_EDGE, shallowWidth: 1 };
        case 3:
            return { deep: TileType.INERT_BRIMSTONE, shallow: TileType.OBSIDIAN, shallowWidth: 2 };
        default:
            return { deep: TileType.DEEP_WATER, shallow: TileType.SHALLOW_WATER, shallowWidth: 2 };
    }
}

// =============================================================================
// Lake filling
// =============================================================================

/**
 * Fill a lake marked in unfilledLakeMap with the specified liquid type,
 * scanning outward to reach neighboring lake cells within scanWidth.
 *
 * C equivalent: `fillLake(x, y, liquid, scanWidth, wreathMap, unfilledLakeMap)`
 * in Architect.c line 2554
 */
export function fillLake(
    pmap: Pcell[][],
    x: number,
    y: number,
    liquid: TileType,
    scanWidth: number,
    wreathMap: Grid,
    unfilledLakeMap: Grid,
): void {
    for (let i = x - scanWidth; i <= x + scanWidth; i++) {
        for (let j = y - scanWidth; j <= y + scanWidth; j++) {
            if (coordinatesAreInMap(i, j) && unfilledLakeMap[i][j]) {
                unfilledLakeMap[i][j] = 0;
                pmap[i][j].layers[DungeonLayer.Liquid] = liquid;
                wreathMap[i][j] = 1;
                fillLake(pmap, i, j, liquid, scanWidth, wreathMap, unfilledLakeMap);
            }
        }
    }
}

/**
 * Flood fill for lake passability testing.
 *
 * C equivalent: `lakeFloodFill(x, y, floodMap, grid, lakeMap, ...)` in Architect.c line 2569
 */
export function lakeFloodFill(
    pmap: Pcell[][],
    x: number,
    y: number,
    floodMap: Grid,
    grid: Grid,
    lakeMap: Grid,
    dungeonToGridX: number,
    dungeonToGridY: number,
): void {
    floodMap[x][y] = 1;

    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];

        if (
            coordinatesAreInMap(newX, newY)
            && !floodMap[newX][newY]
            && (
                !cellHasTerrainFlag(pmap, { x: newX, y: newY }, T_PATHING_BLOCKER)
                || cellHasTMFlag(pmap, { x: newX, y: newY }, TerrainMechFlag.TM_CONNECTS_LEVEL)
            )
            && !lakeMap[newX][newY]
            && (
                !coordinatesAreInMap(newX + dungeonToGridX, newY + dungeonToGridY)
                || !grid[newX + dungeonToGridX][newY + dungeonToGridY]
            )
        ) {
            lakeFloodFill(pmap, newX, newY, floodMap, grid, lakeMap, dungeonToGridX, dungeonToGridY);
        }
    }
}

/**
 * Check whether placing a lake would disconnect passable regions of the level.
 *
 * C equivalent: `lakeDisruptsPassability(grid, lakeMap, ...)` in Architect.c line 2588
 */
export function lakeDisruptsPassability(
    pmap: Pcell[][],
    grid: Grid,
    lakeMap: Grid,
    dungeonToGridX: number,
    dungeonToGridY: number,
): boolean {
    const floodMap = allocGrid();
    fillGrid(floodMap, 0);

    // Find starting location for flood fill
    let startX = -1;
    let startY = -1;
    for (let i = 0; i < DCOLS && startX === -1; i++) {
        for (let j = 0; j < DROWS && startX === -1; j++) {
            if (
                !cellHasTerrainFlag(pmap, { x: i, y: j }, T_PATHING_BLOCKER)
                && !lakeMap[i][j]
                && (
                    !coordinatesAreInMap(i + dungeonToGridX, j + dungeonToGridY)
                    || !grid[i + dungeonToGridX][j + dungeonToGridY]
                )
            ) {
                startX = i;
                startY = j;
            }
        }
    }

    if (startX === -1) {
        freeGrid(floodMap);
        return true; // No passable cells at all — effectively disconnected
    }

    lakeFloodFill(pmap, startX, startY, floodMap, grid, lakeMap, dungeonToGridX, dungeonToGridY);

    // Check for unreached dry tiles
    let result = false;
    for (let i = 0; i < DCOLS && !result; i++) {
        for (let j = 0; j < DROWS && !result; j++) {
            if (
                !cellHasTerrainFlag(pmap, { x: i, y: j }, T_PATHING_BLOCKER)
                && !lakeMap[i][j]
                && !floodMap[i][j]
                && (
                    !coordinatesAreInMap(i + dungeonToGridX, j + dungeonToGridY)
                    || !grid[i + dungeonToGridX][j + dungeonToGridY]
                )
            ) {
                result = true;
            }
        }
    }

    freeGrid(floodMap);
    return result;
}

// =============================================================================
// Lake design
// =============================================================================

/**
 * Design lake locations on the level by generating blob shapes and
 * attempting to place them without disrupting passability.
 *
 * C equivalent: `designLakes(lakeMap)` in Architect.c line 2638
 */
export function designLakes(pmap: Pcell[][], lakeMap: Grid): void {
    const grid = allocGrid();
    fillGrid(lakeMap, 0);

    for (let lakeMaxHeight = 15, lakeMaxWidth = 30; lakeMaxHeight >= 10; lakeMaxHeight--, lakeMaxWidth -= 2) {
        fillGrid(grid, 0);
        const blob = createBlobOnGrid(
            grid, 5, 4, 4, lakeMaxWidth, lakeMaxHeight, 55, "ffffftttt", "ffffttttt",
        );

        for (let k = 0; k < 20; k++) {
            // Propose a position for the lake
            const x = randRange(1 - blob.minX, DCOLS - blob.width - blob.minX - 2);
            const y = randRange(1 - blob.minY, DROWS - blob.height - blob.minY - 2);

            if (!lakeDisruptsPassability(pmap, grid, lakeMap, -x, -y)) {
                // Copy lake into lakeMap and set dungeon to FLOOR
                for (let i = 0; i < blob.width; i++) {
                    for (let j = 0; j < blob.height; j++) {
                        if (grid[i + blob.minX][j + blob.minY]) {
                            lakeMap[i + blob.minX + x][j + blob.minY + y] = 1;
                            pmap[i + blob.minX + x][j + blob.minY + y].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
                        }
                    }
                }
                break;
            }
        }
    }
    freeGrid(grid);
}

/**
 * Create a wreath of shallow liquid around marked lake cells.
 *
 * C equivalent: `createWreath(shallowLiquid, wreathWidth, wreathMap)`
 * in Architect.c line 2689
 */
export function createWreath(
    pmap: Pcell[][],
    shallowLiquid: TileType,
    wreathWidth: number,
    wreathMap: Grid,
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (wreathMap[i][j]) {
                for (let k = i - wreathWidth; k <= i + wreathWidth; k++) {
                    for (let l = j - wreathWidth; l <= j + wreathWidth; l++) {
                        if (
                            coordinatesAreInMap(k, l)
                            && pmap[k][l].layers[DungeonLayer.Liquid] === TileType.NOTHING
                            && (i - k) * (i - k) + (j - l) * (j - l) <= wreathWidth * wreathWidth
                        ) {
                            pmap[k][l].layers[DungeonLayer.Liquid] = shallowLiquid;
                            if (pmap[k][l].layers[DungeonLayer.Dungeon] === TileType.DOOR) {
                                pmap[k][l].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Fill all lake regions in lakeMap with appropriate liquid types and wreaths.
 *
 * C equivalent: `fillLakes(lakeMap)` in Architect.c line 2710
 */
export function fillLakes(
    pmap: Pcell[][],
    lakeMap: Grid,
    depthLevel: number,
    gameConst: GameConstants,
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (lakeMap[i][j]) {
                const lt = liquidType(depthLevel, gameConst);
                const wreathMap = allocGrid();
                fillGrid(wreathMap, 0);
                fillLake(pmap, i, j, lt.deep, 4, wreathMap, lakeMap);
                createWreath(pmap, lt.shallow, lt.shallowWidth, wreathMap);
                freeGrid(wreathMap);
            }
        }
    }
}

// =============================================================================
// Door finishing
// =============================================================================

/**
 * Process doors: remove orphaned doors (passable on all four sides,
 * or three+ blocking neighbors), and convert some to secret doors.
 *
 * C equivalent: `finishDoors()` in Architect.c line 2733
 */
export function finishDoors(
    pmap: Pcell[][],
    depthLevel: number,
    amuletLevel: number,
): void {
    const secretDoorChance = clamp(Math.floor((depthLevel - 1) * 67 / (amuletLevel - 1)), 0, 67);

    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            if (
                pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.DOOR
                && pmap[i][j].machineNumber === 0
            ) {
                const leftOrRight =
                    !cellHasTerrainFlag(pmap, { x: i + 1, y: j }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    || !cellHasTerrainFlag(pmap, { x: i - 1, y: j }, TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                const topOrBottom =
                    !cellHasTerrainFlag(pmap, { x: i, y: j + 1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    || !cellHasTerrainFlag(pmap, { x: i, y: j - 1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY);

                if (leftOrRight && topOrBottom) {
                    // Orphaned door — passable on both axes
                    pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
                } else {
                    const blockingCount =
                        (cellHasTerrainFlag(pmap, { x: i + 1, y: j }, T_PATHING_BLOCKER) ? 1 : 0)
                        + (cellHasTerrainFlag(pmap, { x: i - 1, y: j }, T_PATHING_BLOCKER) ? 1 : 0)
                        + (cellHasTerrainFlag(pmap, { x: i, y: j + 1 }, T_PATHING_BLOCKER) ? 1 : 0)
                        + (cellHasTerrainFlag(pmap, { x: i, y: j - 1 }, T_PATHING_BLOCKER) ? 1 : 0);

                    if (blockingCount >= 3) {
                        pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
                    } else if (randPercent(secretDoorChance)) {
                        pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.SECRET_DOOR;
                    }
                }
            }
        }
    }
}

// =============================================================================
// Bridge building
// =============================================================================

/** Context for bridge building — provides depth and pathing distance */
export interface BuildBridgeContext {
    depthLevel: number;
    depthAccelerator: number;
    /** pathingDistance function (from Dijkstra module) */
    pathingDistance: (x1: number, y1: number, x2: number, y2: number, blockingFlags: number) => number;
}

/**
 * Attempt to build a single bridge across a chasm or similar gap.
 * Searches for horizontal and vertical bridge opportunities.
 *
 * C equivalent: `buildABridge()` in Architect.c line 2786
 *
 * @returns true if a bridge was built, false otherwise
 */
export function buildABridge(pmap: Pcell[][], ctx: BuildBridgeContext): boolean {
    const bridgeRatioX = Math.floor(100 + (100 + 100 * ctx.depthLevel * ctx.depthAccelerator / 9) * randRange(10, 20) / 10);
    const bridgeRatioY = Math.floor(100 + (400 + 100 * ctx.depthLevel * ctx.depthAccelerator / 18) * randRange(10, 20) / 10);

    const nCols = new Array(DCOLS);
    fillSequentialList(nCols);
    shuffleList(nCols);
    const nRows = new Array(DROWS);
    fillSequentialList(nRows);
    shuffleList(nRows);

    for (let i2 = 1; i2 < DCOLS - 1; i2++) {
        const i = nCols[i2];
        for (let j2 = 1; j2 < DROWS - 1; j2++) {
            const j = nRows[j2];
            if (
                !cellHasTerrainFlag(pmap, { x: i, y: j }, T_CAN_BE_BRIDGED | T_PATHING_BLOCKER)
                && !pmap[i][j].machineNumber
            ) {
                // Try horizontal bridge
                let foundExposure = false;
                let k: number;
                for (
                    k = i + 1;
                    k < DCOLS
                    && !pmap[k][j].machineNumber
                    && cellHasTerrainFlag(pmap, { x: k, y: j }, T_CAN_BE_BRIDGED)
                    && !cellHasTMFlag(pmap, { x: k, y: j }, TerrainMechFlag.TM_IS_SECRET)
                    && !cellHasTerrainFlag(pmap, { x: k, y: j }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    && cellHasTerrainFlag(pmap, { x: k, y: j - 1 }, T_CAN_BE_BRIDGED | TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    && cellHasTerrainFlag(pmap, { x: k, y: j + 1 }, T_CAN_BE_BRIDGED | TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                    k++
                ) {
                    if (
                        !cellHasTerrainFlag(pmap, { x: k, y: j - 1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        && !cellHasTerrainFlag(pmap, { x: k, y: j + 1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    ) {
                        foundExposure = true;
                    }
                }

                if (
                    k < DCOLS
                    && (k - i > 3)
                    && foundExposure
                    && !cellHasTerrainFlag(pmap, { x: k, y: j }, T_PATHING_BLOCKER | T_CAN_BE_BRIDGED)
                    && !pmap[k][j].machineNumber
                    && 100 * ctx.pathingDistance(i, j, k, j, T_PATHING_BLOCKER) / (k - i) > bridgeRatioX
                ) {
                    for (let l = i + 1; l < k; l++) {
                        pmap[l][j].layers[DungeonLayer.Liquid] = TileType.BRIDGE;
                    }
                    pmap[i][j].layers[DungeonLayer.Surface] = TileType.BRIDGE_EDGE;
                    pmap[k][j].layers[DungeonLayer.Surface] = TileType.BRIDGE_EDGE;
                    return true;
                }

                // Try vertical bridge
                foundExposure = false;
                for (
                    k = j + 1;
                    k < DROWS
                    && !pmap[i][k].machineNumber
                    && cellHasTerrainFlag(pmap, { x: i, y: k }, T_CAN_BE_BRIDGED)
                    && !cellHasTMFlag(pmap, { x: i, y: k }, TerrainMechFlag.TM_IS_SECRET)
                    && !cellHasTerrainFlag(pmap, { x: i, y: k }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    && cellHasTerrainFlag(pmap, { x: i - 1, y: k }, T_CAN_BE_BRIDGED | TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    && cellHasTerrainFlag(pmap, { x: i + 1, y: k }, T_CAN_BE_BRIDGED | TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                    k++
                ) {
                    if (
                        !cellHasTerrainFlag(pmap, { x: i - 1, y: k }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        && !cellHasTerrainFlag(pmap, { x: i + 1, y: k }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    ) {
                        foundExposure = true;
                    }
                }

                if (
                    k < DROWS
                    && (k - j > 3)
                    && foundExposure
                    && !cellHasTerrainFlag(pmap, { x: i, y: k }, T_PATHING_BLOCKER | T_CAN_BE_BRIDGED)
                    && !pmap[i][k].machineNumber
                    && 100 * ctx.pathingDistance(i, j, i, k, T_PATHING_BLOCKER) / (k - j) > bridgeRatioY
                ) {
                    for (let l = j + 1; l < k; l++) {
                        pmap[i][l].layers[DungeonLayer.Liquid] = TileType.BRIDGE;
                    }
                    pmap[i][j].layers[DungeonLayer.Surface] = TileType.BRIDGE_EDGE;
                    pmap[i][k].layers[DungeonLayer.Surface] = TileType.BRIDGE_EDGE;
                    return true;
                }
            }
        }
    }
    return false;
}
