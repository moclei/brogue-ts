/*
 *  grid.ts — Grid operations ported from Grid.c
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { DCOLS, DROWS } from "../types/constants.js";
import { INVALID_POS, type Pos } from "../types/types.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import { randRange, randPercent } from "../math/rng.js";

// =============================================================================
// Grid allocation
// =============================================================================

/** Grid type: column-major 2D array [x][y], matching C's `short **` layout. */
export type Grid = number[][];

/** Allocate a new grid of size DCOLS × DROWS, initialized to 0. */
export function allocGrid(): Grid {
    const grid: Grid = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        grid[i] = new Array(DROWS).fill(0);
    }
    return grid;
}

/**
 * Free a grid. In TypeScript this is a no-op (GC handles memory),
 * but we keep it for API parity with the C code.
 */
export function freeGrid(_grid: Grid): void {
    // No-op in TypeScript — garbage collector handles this.
}

// =============================================================================
// Basic grid operations
// =============================================================================

/** Copy all values from `from` grid into `to` grid. */
export function copyGrid(to: Grid, from: Grid): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            to[i][j] = from[i][j];
        }
    }
}

/** Fill every cell in the grid with `fillValue`. */
export function fillGrid(grid: Grid, fillValue: number): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            grid[i][j] = fillValue;
        }
    }
}

/**
 * Replace all cells in the grid whose value is between findValueMin and
 * findValueMax (inclusive) with fillValue.
 */
export function findReplaceGrid(
    grid: Grid,
    findValueMin: number,
    findValueMax: number,
    fillValue: number,
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j] >= findValueMin && grid[i][j] <= findValueMax) {
                grid[i][j] = fillValue;
            }
        }
    }
}

// =============================================================================
// Flood fill
// =============================================================================

/**
 * Flood-fills the grid from (x, y) along cells that are within the eligible range.
 * Returns the total count of filled cells.
 */
export function floodFillGrid(
    grid: Grid,
    x: number,
    y: number,
    eligibleValueMin: number,
    eligibleValueMax: number,
    fillValue: number,
): number {
    grid[x][y] = fillValue;
    let fillCount = 1;

    // Iterate through the four cardinal neighbors
    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        if (
            coordinatesAreInMap(newX, newY) &&
            grid[newX][newY] >= eligibleValueMin &&
            grid[newX][newY] <= eligibleValueMax
        ) {
            fillCount += floodFillGrid(grid, newX, newY, eligibleValueMin, eligibleValueMax, fillValue);
        }
    }
    return fillCount;
}

// =============================================================================
// Drawing primitives
// =============================================================================

/** Draw a filled rectangle on the grid. */
export function drawRectangleOnGrid(
    grid: Grid,
    x: number,
    y: number,
    width: number,
    height: number,
    value: number,
): void {
    for (let i = x; i < x + width; i++) {
        for (let j = y; j < y + height; j++) {
            grid[i][j] = value;
        }
    }
}

/** Draw a filled circle on the grid. */
export function drawCircleOnGrid(
    grid: Grid,
    x: number,
    y: number,
    radius: number,
    value: number,
): void {
    for (let i = Math.max(0, x - radius - 1); i < Math.max(DCOLS, x + radius); i++) {
        for (let j = Math.max(0, y - radius - 1); j < Math.max(DROWS, y + radius); j++) {
            if ((i - x) * (i - x) + (j - y) * (j - y) < radius * radius + radius) {
                grid[i][j] = value;
            }
        }
    }
}

// =============================================================================
// Counting & searching
// =============================================================================

/** Count the number of cells in the grid that equal `validValue`. */
export function validLocationCount(grid: Grid, validValue: number): number {
    let count = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j] === validValue) {
                count++;
            }
        }
    }
    return count;
}

/** Find the smallest positive value in the grid. Returns 0 if no positive values exist. */
function leastPositiveValueInGrid(grid: Grid): number {
    let leastPositiveValue = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j] > 0 && (leastPositiveValue === 0 || grid[i][j] < leastPositiveValue)) {
                leastPositiveValue = grid[i][j];
            }
        }
    }
    return leastPositiveValue;
}

/**
 * Choose a random cell from the grid that equals `validValue`.
 * Returns its position, or { x: -1, y: -1 } if no valid locations exist.
 */
export function randomLocationInGrid(grid: Grid, validValue: number): Pos {
    const locationCount = validLocationCount(grid, validValue);
    if (locationCount <= 0) {
        return { x: -1, y: -1 };
    }

    let index = randRange(0, locationCount - 1);
    for (let i = 0; i < DCOLS && index >= 0; i++) {
        for (let j = 0; j < DROWS && index >= 0; j++) {
            if (grid[i][j] === validValue) {
                if (index === 0) {
                    return { x: i, y: j };
                }
                index--;
            }
        }
    }
    return { x: -1, y: -1 };
}

/**
 * Finds the lowest positive value in the grid, then chooses one location
 * with that value either randomly or deterministically (middle element).
 * Returns INVALID_POS if no positive values exist.
 */
export function randomLeastPositiveLocationInGrid(grid: Grid, deterministic: boolean): Pos {
    const targetValue = leastPositiveValueInGrid(grid);
    if (targetValue === 0) {
        return INVALID_POS;
    }

    let locationCount = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j] === targetValue) {
                locationCount++;
            }
        }
    }

    let index: number;
    if (deterministic) {
        index = Math.floor(locationCount / 2);
    } else {
        index = randRange(0, locationCount - 1);
    }

    for (let i = 0; i < DCOLS && index >= 0; i++) {
        for (let j = 0; j < DROWS && index >= 0; j++) {
            if (grid[i][j] === targetValue) {
                if (index === 0) {
                    return { x: i, y: j };
                }
                index--;
            }
        }
    }
    return INVALID_POS;
}

// =============================================================================
// Cellular automata & blob generation
// =============================================================================

const DIRECTION_COUNT = 8;

/**
 * One round of cellular automata on the grid.
 * birthParameters[n] and survivalParameters[n] are 't' (truthy) or not,
 * indexed by the number of live neighbors (0–8).
 */
function cellularAutomataRound(
    grid: Grid,
    birthParameters: string,
    survivalParameters: string,
): void {
    const buffer2 = allocGrid();
    copyGrid(buffer2, grid);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            let nbCount = 0;
            for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                const newX = i + nbDirs[dir][0];
                const newY = j + nbDirs[dir][1];
                if (coordinatesAreInMap(newX, newY) && buffer2[newX][newY]) {
                    nbCount++;
                }
            }
            if (!buffer2[i][j] && birthParameters[nbCount] === "t") {
                grid[i][j] = 1; // birth
            } else if (buffer2[i][j] && survivalParameters[nbCount] === "t") {
                // survival — keep the value
            } else {
                grid[i][j] = 0; // death
            }
        }
    }

    freeGrid(buffer2);
}

/**
 * Marks a cell as being a member of `fillValue`, then recursively iterates
 * through the rest of the contiguous region. Returns the number of cells filled.
 */
function fillContiguousRegion(grid: Grid, x: number, y: number, fillValue: number): number {
    grid[x][y] = fillValue;
    let numberOfCells = 1;

    // Iterate through the four cardinal neighbors
    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        if (!coordinatesAreInMap(newX, newY)) {
            break;
        }
        if (grid[newX][newY] === 1) {
            numberOfCells += fillContiguousRegion(grid, newX, newY, fillValue);
        }
    }
    return numberOfCells;
}

/** Result of createBlobOnGrid */
export interface BlobResult {
    minX: number;
    minY: number;
    width: number;
    height: number;
}

/**
 * Generates a random blob using cellular automata simulation.
 * Fills the grid with 1s for the blob and 0s elsewhere.
 *
 * @param grid - The grid to fill with the blob
 * @param roundCount - Number of cellular automata rounds
 * @param minBlobWidth / minBlobHeight - Minimum acceptable blob dimensions
 * @param maxBlobWidth / maxBlobHeight - Maximum initial noise dimensions
 * @param percentSeeded - Percentage of initial cells that are alive
 * @param birthParameters - 9-char string, 't' at index n means birth with n neighbors
 * @param survivalParameters - 9-char string, 't' at index n means survive with n neighbors
 * @returns The bounding box of the largest blob
 */
export function createBlobOnGrid(
    grid: Grid,
    roundCount: number,
    minBlobWidth: number,
    minBlobHeight: number,
    maxBlobWidth: number,
    maxBlobHeight: number,
    percentSeeded: number,
    birthParameters: string,
    survivalParameters: string,
): BlobResult {
    let topBlobMinX = 0;
    let topBlobMinY = 0;
    let topBlobMaxX = 0;
    let topBlobMaxY = 0;
    let topBlobNumber = 0;
    let blobWidth = 0;
    let blobHeight = 0;

    // Generate blobs until they satisfy the minimum dimension constraints
    do {
        fillGrid(grid, 0);

        // Fill relevant portion with noise
        for (let i = 0; i < maxBlobWidth; i++) {
            for (let j = 0; j < maxBlobHeight; j++) {
                grid[i][j] = randPercent(percentSeeded) ? 1 : 0;
            }
        }

        // Cellular automata iterations
        for (let k = 0; k < roundCount; k++) {
            cellularAutomataRound(grid, birthParameters, survivalParameters);
        }

        // Measure the result
        let topBlobSize = 0;
        topBlobNumber = 0;
        topBlobMinX = maxBlobWidth;
        topBlobMaxX = 0;
        topBlobMinY = maxBlobHeight;
        topBlobMaxY = 0;

        // Fill each blob with its own number, starting with 2
        let blobNumber = 2;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j] === 1) {
                    const blobSize = fillContiguousRegion(grid, i, j, blobNumber);
                    if (blobSize > topBlobSize) {
                        topBlobSize = blobSize;
                        topBlobNumber = blobNumber;
                    }
                    blobNumber++;
                }
            }
        }

        // Find the top blob's bounding box — max & min x
        for (let i = 0; i < DCOLS; i++) {
            let foundACellThisLine = false;
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j] === topBlobNumber) {
                    foundACellThisLine = true;
                    break;
                }
            }
            if (foundACellThisLine) {
                if (i < topBlobMinX) topBlobMinX = i;
                if (i > topBlobMaxX) topBlobMaxX = i;
            }
        }

        // max & min y
        for (let j = 0; j < DROWS; j++) {
            let foundACellThisLine = false;
            for (let i = 0; i < DCOLS; i++) {
                if (grid[i][j] === topBlobNumber) {
                    foundACellThisLine = true;
                    break;
                }
            }
            if (foundACellThisLine) {
                if (j < topBlobMinY) topBlobMinY = j;
                if (j > topBlobMaxY) topBlobMaxY = j;
            }
        }

        blobWidth = (topBlobMaxX - topBlobMinX) + 1;
        blobHeight = (topBlobMaxY - topBlobMinY) + 1;
    } while (blobWidth < minBlobWidth || blobHeight < minBlobHeight || topBlobNumber === 0);

    // Replace the winning blob with 1s, everything else with 0s
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            grid[i][j] = grid[i][j] === topBlobNumber ? 1 : 0;
        }
    }

    return { minX: topBlobMinX, minY: topBlobMinY, width: blobWidth, height: blobHeight };
}
