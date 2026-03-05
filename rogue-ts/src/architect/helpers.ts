/*
 *  helpers.ts — Architect utility functions
 *  brogue-ts
 *
 *  Core utility functions for the dungeon architect: direction helpers,
 *  passability checks, connectivity analysis, and random cell selection.
 *
 *  Ported from: Architect.c (zeroOutGrid, oppositeDirection,
 *  cellIsPassableOrDoor, passableArcCount, copyMap, connectCell,
 *  levelIsDisconnectedWithBlockingMap, randomMatchingLocation)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pcell, Pos, FloorTileType } from "../types/types.js";
import { Direction, DungeonLayer } from "../types/enums.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { TileFlag, IS_IN_MACHINE, TerrainFlag, TerrainMechFlag, T_PATHING_BLOCKER } from "../types/flags.js";
import { nbDirs, cDirs, coordinatesAreInMap } from "../globals/tables.js";
import { cellHasTerrainFlag, cellHasTMFlag, cellHasTerrainType } from "../state/helpers.js";
import { fillGrid, type Grid } from "../grid/grid.js";
import { randRange } from "../math/rng.js";

// =============================================================================
// Grid utilities
// =============================================================================

/**
 * Zero out a grid (fill every cell with 0).
 *
 * C equivalent: `zeroOutGrid(grid)` in Architect.c line 3073
 *
 * This is a thin wrapper around fillGrid for API parity with the C code.
 */
export function zeroOutGrid(grid: Grid): void {
    fillGrid(grid, 0);
}

/**
 * Deep-copy a pmap (Pcell[][]) grid.
 *
 * C equivalent: `copyMap(from, to)` in Architect.c line 431
 *
 * Unlike copyGrid (which copies number[][]), this copies the full Pcell
 * struct including layers, flags, volume, and machineNumber.
 */
export function copyMap(from: Pcell[][], to: Pcell[][]): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const src = from[i][j];
            const dst = to[i][j];
            // Copy layer array
            for (let layer = 0; layer < src.layers.length; layer++) {
                dst.layers[layer] = src.layers[layer];
            }
            dst.flags = src.flags;
            dst.volume = src.volume;
            dst.machineNumber = src.machineNumber;
            // Note: rememberedAppearance and other UI fields are not copied
            // in the C version either (C does a flat struct copy, but the
            // architect only cares about terrain/flags/volume/machine).
        }
    }
}

// =============================================================================
// Direction helpers
// =============================================================================

/**
 * Returns the direction opposite to the given direction.
 *
 * C equivalent: `oppositeDirection(theDir)` in Architect.c line 3082
 */
export function oppositeDirection(theDir: Direction): Direction {
    switch (theDir) {
        case Direction.Up:        return Direction.Down;
        case Direction.Down:      return Direction.Up;
        case Direction.Left:      return Direction.Right;
        case Direction.Right:     return Direction.Left;
        case Direction.UpRight:   return Direction.DownLeft;
        case Direction.DownLeft:  return Direction.UpRight;
        case Direction.UpLeft:    return Direction.DownRight;
        case Direction.DownRight: return Direction.UpLeft;
        case Direction.NoDirection: return Direction.NoDirection;
        default:                  return Direction.NoDirection;
    }
}

// =============================================================================
// Passability checks
// =============================================================================

/**
 * Check whether a cell is passable or is a door (secret, locked, or
 * level-connecting).
 *
 * A cell is considered passable-or-door if:
 * 1. It doesn't have T_PATHING_BLOCKER, OR
 * 2. It obstructs passability AND is secret / promotes-with-key /
 *    connects-level (i.e. it's a door the player could eventually open).
 *
 * C equivalent: `cellIsPassableOrDoor(x, y)` in Architect.c line 48
 */
export function cellIsPassableOrDoor(pmap: Pcell[][], x: number, y: number): boolean {
    const pos: Pos = { x, y };
    if (!cellHasTerrainFlag(pmap, pos, T_PATHING_BLOCKER)) {
        return true;
    }
    return (
        cellHasTMFlag(pmap, pos,
            TerrainMechFlag.TM_IS_SECRET
            | TerrainMechFlag.TM_PROMOTES_WITH_KEY
            | TerrainMechFlag.TM_CONNECTS_LEVEL
        )
        && cellHasTerrainFlag(pmap, pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    );
}

/**
 * Count passable arcs around a cell.
 *
 * Counts transitions from passable-to-impassable (and vice versa)
 * going clockwise around the cell. The result is divided by 2 to
 * get the number of distinct arcs:
 *   0 = fully surrounded by passable or impassable
 *   1 = adjacent to a wall
 *   2 = in a hallway
 *   3 = center of a T-intersection
 *   4 = intersection of two hallways
 *   ≥5 = should not happen
 *
 * C equivalent: `passableArcCount(x, y)` in Architect.c line 171
 */
export function passableArcCount(pmap: Pcell[][], x: number, y: number): number {
    let arcCount = 0;

    for (let dir = 0; dir < 8; dir++) {
        const prevDir = (dir + 7) % 8;
        const oldX = x + cDirs[prevDir][0];
        const oldY = y + cDirs[prevDir][1];
        const newX = x + cDirs[dir][0];
        const newY = y + cDirs[dir][1];

        // Count every transition from passable to impassable or vice-versa
        const newPassable = coordinatesAreInMap(newX, newY) && cellIsPassableOrDoor(pmap, newX, newY);
        const oldPassable = coordinatesAreInMap(oldX, oldY) && cellIsPassableOrDoor(pmap, oldX, oldY);

        if (newPassable !== oldPassable) {
            arcCount++;
        }
    }

    return Math.floor(arcCount / 2);
}

// =============================================================================
// Connectivity analysis
// =============================================================================

/**
 * Recursive flood fill for connectivity analysis. Marks cells in zoneMap
 * with zoneLabel and returns the size of the connected region.
 *
 * Uses only cardinal directions (first 4 of nbDirs).
 * blockingMap is optional (pass null to skip blocking check).
 *
 * C equivalent: `connectCell(x, y, zoneLabel, blockingMap, zoneMap)`
 * in Architect.c line 3109
 */
export function connectCell(
    pmap: Pcell[][],
    x: number,
    y: number,
    zoneLabel: number,
    blockingMap: Grid | null,
    zoneMap: Grid,
): number {
    zoneMap[x][y] = zoneLabel;
    let size = 1;

    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];

        if (
            coordinatesAreInMap(newX, newY)
            && zoneMap[newX][newY] === 0
            && (blockingMap === null || !blockingMap[newX][newY])
            && cellIsPassableOrDoor(pmap, newX, newY)
        ) {
            size += connectCell(pmap, newX, newY, zoneLabel, blockingMap, zoneMap);
        }
    }

    return size;
}

/**
 * Determine whether a blocking map would disconnect the level into
 * separate passable regions.
 *
 * Algorithm:
 * 1. Create zone maps of connected passable regions that border the
 *    blocking area (with blocking area blocked).
 * 2. Expand zones into the blocking area (without changing zone sizes).
 * 3. If two or more zones now touch, the blocking map would disconnect
 *    the level.
 *
 * Returns:
 * - 0 if no disconnection
 * - The size of the smallest touching region if countRegionSize is true
 * - 1 if countRegionSize is false and disconnection detected
 *
 * C equivalent: `levelIsDisconnectedWithBlockingMap(blockingMap, countRegionSize)`
 * in Architect.c line 3137
 */
export function levelIsDisconnectedWithBlockingMap(
    pmap: Pcell[][],
    blockingMap: Grid,
    countRegionSize: boolean,
): number {
    const zoneMap: Grid = [];
    for (let i = 0; i < DCOLS; i++) {
        zoneMap[i] = new Array(DROWS).fill(0);
    }

    let zoneCount = 0;
    let smallestQualifyingZoneSize = 10000;
    const zoneSizes: number[] = new Array(200).fill(0);

    // Phase 1: Map out zones with the blocking area blocked.
    // Only seed zones from passable cells that border the blocking area.
    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            if (cellIsPassableOrDoor(pmap, i, j) && zoneMap[i][j] === 0 && !blockingMap[i][j]) {
                for (let dir = 0; dir < 4; dir++) {
                    if (blockingMap[i + nbDirs[dir][0]][j + nbDirs[dir][1]]) {
                        zoneCount++;
                        zoneSizes[zoneCount - 1] = connectCell(pmap, i, j, zoneCount, blockingMap, zoneMap);
                        break;
                    }
                }
            }
        }
    }

    // Phase 2: Expand zones into the blocking area (without tracking sizes).
    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            if (blockingMap[i][j] && zoneMap[i][j] === 0 && cellIsPassableOrDoor(pmap, i, j)) {
                for (let dir = 0; dir < 4; dir++) {
                    const borderingZone = zoneMap[i + nbDirs[dir][0]][j + nbDirs[dir][1]];
                    if (borderingZone !== 0) {
                        connectCell(pmap, i, j, borderingZone, null, zoneMap);
                        break;
                    }
                }
            }
        }
    }

    // Phase 3: Check if any two different zones are now adjacent.
    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            if (zoneMap[i][j] !== 0) {
                for (let dir = 0; dir < 4; dir++) {
                    const borderingZone = zoneMap[i + nbDirs[dir][0]][j + nbDirs[dir][1]];
                    if (zoneMap[i][j] !== borderingZone && borderingZone !== 0) {
                        if (!countRegionSize) {
                            return 1; // true — disconnected
                        }
                        smallestQualifyingZoneSize = Math.min(
                            smallestQualifyingZoneSize,
                            zoneSizes[zoneMap[i][j] - 1],
                        );
                        smallestQualifyingZoneSize = Math.min(
                            smallestQualifyingZoneSize,
                            zoneSizes[borderingZone - 1],
                        );
                        break;
                    }
                }
            }
        }
    }

    return smallestQualifyingZoneSize < 10000 ? smallestQualifyingZoneSize : 0;
}

// =============================================================================
// Random cell selection
// =============================================================================

/**
 * Find a random cell with no creatures, items, or stairs, matching the
 * specified terrain criteria.
 *
 * A dungeonType/liquidType of -1 matches any tile on that layer.
 * A terrainType of -1 means match by dungeon+liquid layer instead.
 *
 * C equivalent: `randomMatchingLocation(loc, dungeonType, liquidType, terrainType)`
 * in Architect.c line 3822
 *
 * @returns The matching position, or null if no match found after 500 attempts.
 */
export function randomMatchingLocation(
    pmap: Pcell[][],
    tileCatalog: readonly FloorTileType[],
    dungeonType: number,
    liquidType: number,
    terrainType: number,
): Pos | null {
    let failsafeCount = 0;
    let x: number;
    let y: number;

    do {
        failsafeCount++;
        x = randRange(0, DCOLS - 1);
        y = randRange(0, DROWS - 1);
    } while (
        failsafeCount < 500
        && (
            // If terrainType is specified, the cell must have it on some layer
            (terrainType >= 0 && !cellHasTerrainType(pmap, { x, y }, terrainType))
            // If terrainType is not specified, match by dungeon+liquid layer
            || (
                (
                    (dungeonType >= 0 && pmap[x][y].layers[DungeonLayer.Dungeon] !== dungeonType)
                    || (liquidType >= 0 && pmap[x][y].layers[DungeonLayer.Liquid] !== liquidType)
                )
                && terrainType < 0
            )
            // Must not have player, monster, stairs, item, or be in a machine
            || (pmap[x][y].flags & (
                TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER
                | TileFlag.HAS_STAIRS | TileFlag.HAS_ITEM | IS_IN_MACHINE
            ))
            // If matching by layer (terrainType < 0) and the dungeon tile doesn't
            // obstruct items, the cell must not obstruct items either
            || (
                terrainType < 0
                && !(tileCatalog[dungeonType].flags & TerrainFlag.T_OBSTRUCTS_ITEMS)
                && cellHasTerrainFlag(pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_ITEMS)
            )
        )
    );

    if (failsafeCount >= 500) {
        return null;
    }

    return { x, y };
}
