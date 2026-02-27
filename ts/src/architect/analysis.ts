/*
 *  analysis.ts — Loop detection, chokepoint analysis, and secondary connections
 *  brogue-ts
 *
 *  Handles identifying loops and chokepoints in the dungeon layout,
 *  computing the chokepoint map, and adding secondary loop connections
 *  via Dijkstra-based pathing distance.
 *
 *  Ported from: Architect.c lines 57–395
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pcell } from "../types/types.js";
import { DCOLS, DROWS, PDS_OBSTRUCTION } from "../types/constants.js";
import { TerrainMechFlag, TileFlag } from "../types/flags.js";
import { T_PATHING_BLOCKER } from "../types/flags.js";
import { cDirs, nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import { cellHasTerrainFlag, cellHasTMFlag } from "../state/helpers.js";
import {
    allocGrid, freeGrid, fillGrid, copyGrid, findReplaceGrid, type Grid,
} from "../grid/grid.js";
import { fillSequentialList, shuffleList } from "../math/rng.js";
import { dijkstraScan } from "../dijkstra/dijkstra.js";
import { zeroOutGrid } from "./helpers.js";

// =============================================================================
// Loop detection
// =============================================================================

/**
 * Check whether a cell marked IN_LOOP should actually remain loopy.
 *
 * A cell is stripped of IN_LOOP if it has exactly one contiguous string
 * of ≤4 loopy neighbours when scanning clockwise. When a cell is
 * de-looped it recursively re-checks its neighbours.
 *
 * C equivalent: `checkLoopiness(x, y)` in Architect.c line 57
 */
export function checkLoopiness(pmap: Pcell[][], x: number, y: number): boolean {
    if (!(pmap[x][y].flags & TileFlag.IN_LOOP)) {
        return false;
    }

    // Find an unloopy neighbour to start on
    let sdir: number;
    for (sdir = 0; sdir < 8; sdir++) {
        const newX = x + cDirs[sdir][0];
        const newY = y + cDirs[sdir][1];
        if (
            !coordinatesAreInMap(newX, newY)
            || !(pmap[newX][newY].flags & TileFlag.IN_LOOP)
        ) {
            break;
        }
    }

    if (sdir === 8) {
        // No unloopy neighbours — leave cell loopy
        return false;
    }

    // Starting on this unloopy neighbour, work clockwise and count:
    // (a) the number of strings of loopy neighbours
    // (b) the length of the longest such string
    let numStrings = 0;
    let maxStringLength = 0;
    let currentStringLength = 0;
    let inString = false;

    for (let dir = sdir; dir < sdir + 8; dir++) {
        const newX = x + cDirs[dir % 8][0];
        const newY = y + cDirs[dir % 8][1];

        if (
            coordinatesAreInMap(newX, newY)
            && (pmap[newX][newY].flags & TileFlag.IN_LOOP)
        ) {
            currentStringLength++;
            if (!inString) {
                if (numStrings > 0) {
                    return false; // More than one string — leave loopy
                }
                numStrings++;
                inString = true;
            }
        } else if (inString) {
            if (currentStringLength > maxStringLength) {
                maxStringLength = currentStringLength;
            }
            currentStringLength = 0;
            inString = false;
        }
    }

    if (inString && currentStringLength > maxStringLength) {
        maxStringLength = currentStringLength;
    }

    if (numStrings === 1 && maxStringLength <= 4) {
        pmap[x][y].flags &= ~TileFlag.IN_LOOP;

        for (let dir = 0; dir < 8; dir++) {
            const newX = x + cDirs[dir][0];
            const newY = y + cDirs[dir][1];
            if (coordinatesAreInMap(newX, newY)) {
                checkLoopiness(pmap, newX, newY);
            }
        }
        return true;
    } else {
        return false;
    }
}

// =============================================================================
// Loop auditing
// =============================================================================

/**
 * Flood fill from (x, y), marking cells in `grid` that are reachable
 * without crossing IN_LOOP cells. Used to prune extraneous loop markings.
 *
 * C equivalent: `auditLoop(x, y, grid)` in Architect.c line 121
 */
export function auditLoop(
    pmap: Pcell[][],
    x: number,
    y: number,
    grid: Grid,
): void {
    if (
        coordinatesAreInMap(x, y)
        && !grid[x][y]
        && !(pmap[x][y].flags & TileFlag.IN_LOOP)
    ) {
        grid[x][y] = 1;
        for (let dir = 0; dir < 8; dir++) {
            const newX = x + nbDirs[dir][0];
            const newY = y + nbDirs[dir][1];
            if (coordinatesAreInMap(newX, newY)) {
                auditLoop(pmap, newX, newY, grid);
            }
        }
    }
}

// =============================================================================
// Flood fill counting (for chokepoint map)
// =============================================================================

/**
 * Flood fill from (startX, startY), counting reachable cells.
 * Cells with passMap value 2 count as 5000 (area machine presence).
 * Cells flagged IS_IN_AREA_MACHINE result in a count of 10000.
 * Returns min(count, 10000).
 *
 * C equivalent: `floodFillCount(results, passMap, startX, startY)` in Architect.c line 140
 */
export function floodFillCount(
    pmap: Pcell[][],
    results: Grid,
    passMap: Grid,
    startX: number,
    startY: number,
): number {
    let count = passMap[startX][startY] === 2 ? 5000 : 1;

    if (pmap[startX][startY].flags & TileFlag.IS_IN_AREA_MACHINE) {
        count = 10000;
    }

    results[startX][startY] = 1;

    for (let dir = 0; dir < 4; dir++) {
        const newX = startX + nbDirs[dir][0];
        const newY = startY + nbDirs[dir][1];
        if (
            coordinatesAreInMap(newX, newY)
            && passMap[newX][newY]
            && !results[newX][newY]
        ) {
            count += floodFillCount(pmap, results, passMap, newX, newY);
        }
    }

    return Math.min(count, 10000);
}

// =============================================================================
// Map analysis (loops + chokepoints)
// =============================================================================

/**
 * Locate all loops and chokepoints in the dungeon map.
 *
 * When `calculateChokeMap` is true, also computes the chokepoint map,
 * which indicates how many cells would become unreachable if each
 * chokepoint were blocked.
 *
 * C equivalent: `analyzeMap(calculateChokeMap)` in Architect.c line 192
 *
 * @param pmap      The dungeon cell grid (mutated: IN_LOOP, IS_CHOKEPOINT, IS_GATE_SITE flags)
 * @param chokeMap  Grid to receive chokepoint values (only used if calculateChokeMap is true)
 * @param calculateChokeMap  Whether to compute the chokepoint map
 */
export function analyzeMap(
    pmap: Pcell[][],
    chokeMap: Grid | null,
    calculateChokeMap: boolean,
): void {
    const grid = allocGrid();
    const passMap = allocGrid();

    // First: find all loops.
    // Mark all non-blocking cells as IN_LOOP; blocking cells lose IN_LOOP.
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (
                cellHasTerrainFlag(pmap, { x: i, y: j }, T_PATHING_BLOCKER)
                && !cellHasTMFlag(pmap, { x: i, y: j }, TerrainMechFlag.TM_IS_SECRET)
            ) {
                pmap[i][j].flags &= ~TileFlag.IN_LOOP;
                passMap[i][j] = 0;
            } else {
                pmap[i][j].flags |= TileFlag.IN_LOOP;
                passMap[i][j] = 1;
            }
        }
    }

    // Iteratively strip cells that don't truly belong to loops
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            checkLoopiness(pmap, i, j);
        }
    }

    // Remove extraneous loop markings: flood fill from (0,0) through
    // non-loopy cells, then remove IN_LOOP from cells that have no
    // neighbouring non-loopy non-flooded cell.
    zeroOutGrid(grid);
    auditLoop(pmap, 0, 0, grid);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (pmap[i][j].flags & TileFlag.IN_LOOP) {
                let designationSurvives = false;
                for (let dir = 0; dir < 8; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(newX, newY)
                        && !grid[newX][newY]
                        && !(pmap[newX][newY].flags & TileFlag.IN_LOOP)
                    ) {
                        designationSurvives = true;
                        break;
                    }
                }
                if (!designationSurvives) {
                    grid[i][j] = 1;
                    pmap[i][j].flags &= ~TileFlag.IN_LOOP;
                }
            }
        }
    }

    // Done finding loops; now flag chokepoints.
    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            pmap[i][j].flags &= ~TileFlag.IS_CHOKEPOINT;
            if (passMap[i][j] && !(pmap[i][j].flags & TileFlag.IN_LOOP)) {
                let localArcCount = 0;
                for (let dir = 0; dir < 8; dir++) {
                    const prevDir = (dir + 7) % 8;
                    const oldX = i + cDirs[prevDir][0];
                    const oldY = j + cDirs[prevDir][1];
                    const newX = i + cDirs[dir][0];
                    const newY = j + cDirs[dir][1];

                    const newPass = coordinatesAreInMap(newX, newY) && passMap[newX][newY] !== 0;
                    const oldPass = coordinatesAreInMap(oldX, oldY) && passMap[oldX][oldY] !== 0;

                    if (newPass !== oldPass) {
                        if (++localArcCount > 2) {
                            if (
                                (!passMap[i - 1][j] && !passMap[i + 1][j])
                                || (!passMap[i][j - 1] && !passMap[i][j + 1])
                            ) {
                                pmap[i][j].flags |= TileFlag.IS_CHOKEPOINT;
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    if (calculateChokeMap && chokeMap) {
        // Create chokepoint map: for each passable tile, record how many
        // tiles would become unreachable if the nearest exit chokepoint
        // were blocked.

        // Start by setting chokepoint values very high, and rope off room machines.
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                chokeMap[i][j] = 30000;
                if (pmap[i][j].flags & TileFlag.IS_IN_ROOM_MACHINE) {
                    passMap[i][j] = 0;
                }
            }
        }

        // Scan for a chokepoint next to an open point.
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (passMap[i][j] && (pmap[i][j].flags & TileFlag.IS_CHOKEPOINT)) {
                    for (let dir = 0; dir < 4; dir++) {
                        const newX = i + nbDirs[dir][0];
                        const newY = j + nbDirs[dir][1];
                        if (
                            coordinatesAreInMap(newX, newY)
                            && passMap[newX][newY]
                            && !(pmap[newX][newY].flags & TileFlag.IS_CHOKEPOINT)
                        ) {
                            // Pretend (i, j) is blocked and flood-fill from (newX, newY).
                            zeroOutGrid(grid);
                            passMap[i][j] = 0;
                            const cellCount = floodFillCount(pmap, grid, passMap, newX, newY);
                            passMap[i][j] = 1;

                            if (cellCount >= 4) {
                                // Update the chokeMap for all flooded cells.
                                for (let i2 = 0; i2 < DCOLS; i2++) {
                                    for (let j2 = 0; j2 < DROWS; j2++) {
                                        if (grid[i2][j2] && cellCount < chokeMap[i2][j2]) {
                                            chokeMap[i2][j2] = cellCount;
                                            pmap[i2][j2].flags &= ~TileFlag.IS_GATE_SITE;
                                        }
                                    }
                                }
                                // The chokepoint itself takes the lesser value too.
                                if (cellCount < chokeMap[i][j]) {
                                    chokeMap[i][j] = cellCount;
                                    pmap[i][j].flags |= TileFlag.IS_GATE_SITE;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    freeGrid(grid);
    freeGrid(passMap);
}

// =============================================================================
// Adding loops (secondary connections)
// =============================================================================

/**
 * Add some loops (secondary door connections) to the otherwise
 * simply-connected network of rooms.
 *
 * Scans wall cells that separate two floor cells horizontally or
 * vertically; if the Dijkstra pathing distance through the existing
 * floor exceeds `minimumPathingDistance`, the wall cell is turned into
 * a door (value 2 in the grid).
 *
 * C equivalent: `addLoops(grid, minimumPathingDistance)` in Architect.c line 340
 *
 * @param pmap  The dungeon cell grid (not mutated here)
 * @param grid  The room grid (0 = wall, 1 = floor). Mutated: door cells become 2.
 * @param minimumPathingDistance  Threshold for adding a loop
 */
export function addLoops(
    grid: Grid,
    minimumPathingDistance: number,
): void {
    const dirCoords: [number, number][] = [[1, 0], [0, 1]];
    const totalCells = DCOLS * DROWS;

    const sCoord = new Array<number>(totalCells);
    fillSequentialList(sCoord);
    shuffleList(sCoord);

    const pathMap = allocGrid();
    const costMap = allocGrid();
    copyGrid(costMap, grid);
    findReplaceGrid(costMap, 0, 0, PDS_OBSTRUCTION);
    findReplaceGrid(costMap, 1, 30000, 1);

    for (let i = 0; i < totalCells; i++) {
        const x = Math.floor(sCoord[i] / DROWS);
        const y = sCoord[i] % DROWS;

        if (!grid[x][y]) {
            for (let d = 0; d <= 1; d++) {
                const newX = x + dirCoords[d][0];
                const oppX = x - dirCoords[d][0];
                const newY = y + dirCoords[d][1];
                const oppY = y - dirCoords[d][1];

                if (
                    coordinatesAreInMap(newX, newY)
                    && coordinatesAreInMap(oppX, oppY)
                    && grid[newX][newY] === 1
                    && grid[oppX][oppY] === 1
                ) {
                    // This wall cell has floor on both sides
                    fillGrid(pathMap, 30000);
                    pathMap[newX][newY] = 0;
                    dijkstraScan(pathMap, costMap, false);

                    if (pathMap[oppX][oppY] > minimumPathingDistance) {
                        // Pathing distance exceeds threshold — add a doorway
                        grid[x][y] = 2;
                        costMap[x][y] = 1;
                        break;
                    }
                }
            }
        }
    }

    freeGrid(pathMap);
    freeGrid(costMap);
}
