/*
 *  grid.test.ts — Tests for grid operations (Grid.c port)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    allocGrid,
    freeGrid,
    copyGrid,
    fillGrid,
    findReplaceGrid,
    floodFillGrid,
    drawRectangleOnGrid,
    drawCircleOnGrid,
    validLocationCount,
    randomLocationInGrid,
    randomLeastPositiveLocationInGrid,
    createBlobOnGrid,
    type Grid,
} from "../src/grid/grid.js";
import { DCOLS, DROWS } from "../src/types/constants.js";
import { seedRandomGenerator } from "../src/math/rng.js";

describe("Grid allocation", () => {
    it("allocGrid creates a DCOLS×DROWS grid initialized to 0", () => {
        const grid = allocGrid();
        expect(grid.length).toBe(DCOLS);
        expect(grid[0].length).toBe(DROWS);

        // Check a few cells
        expect(grid[0][0]).toBe(0);
        expect(grid[DCOLS - 1][DROWS - 1]).toBe(0);
        expect(grid[50][17]).toBe(0);
    });

    it("freeGrid does not throw", () => {
        const grid = allocGrid();
        expect(() => freeGrid(grid)).not.toThrow();
    });
});

describe("Basic grid operations", () => {
    let grid: Grid;

    beforeEach(() => {
        grid = allocGrid();
    });

    it("fillGrid fills all cells with the given value", () => {
        fillGrid(grid, 42);
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid[i][j]).toBe(42);
            }
        }
    });

    it("copyGrid copies all values from one grid to another", () => {
        fillGrid(grid, 7);
        grid[10][20] = 99;

        const dest = allocGrid();
        copyGrid(dest, grid);

        expect(dest[10][20]).toBe(99);
        expect(dest[0][0]).toBe(7);
        expect(dest[DCOLS - 1][DROWS - 1]).toBe(7);
    });

    it("findReplaceGrid replaces values in range", () => {
        fillGrid(grid, 0);
        grid[5][5] = 3;
        grid[10][10] = 7;
        grid[15][15] = 12;

        findReplaceGrid(grid, 3, 10, 99);

        expect(grid[5][5]).toBe(99);
        expect(grid[10][10]).toBe(99);
        expect(grid[15][15]).toBe(12); // outside range, unchanged
        expect(grid[0][0]).toBe(0); // outside range, unchanged
    });
});

describe("Flood fill", () => {
    it("floodFillGrid fills contiguous region", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Create a small region of 1s
        grid[5][5] = 1;
        grid[6][5] = 1;
        grid[7][5] = 1;
        grid[7][6] = 1;

        const count = floodFillGrid(grid, 5, 5, 1, 1, 2);
        expect(count).toBe(4);
        expect(grid[5][5]).toBe(2);
        expect(grid[6][5]).toBe(2);
        expect(grid[7][5]).toBe(2);
        expect(grid[7][6]).toBe(2);
    });

    it("floodFillGrid does not cross gaps", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Two disconnected regions
        grid[5][5] = 1;
        grid[5][6] = 1;
        grid[10][10] = 1;

        const count = floodFillGrid(grid, 5, 5, 1, 1, 2);
        expect(count).toBe(2);
        expect(grid[10][10]).toBe(1); // not reached
    });
});

describe("Drawing primitives", () => {
    it("drawRectangleOnGrid fills a rectangle", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        drawRectangleOnGrid(grid, 10, 5, 3, 4, 1);

        expect(grid[10][5]).toBe(1);
        expect(grid[12][8]).toBe(1);
        expect(grid[9][5]).toBe(0);  // outside
        expect(grid[13][5]).toBe(0); // outside
        expect(grid[10][4]).toBe(0); // outside
        expect(grid[10][9]).toBe(0); // outside
    });

    it("drawCircleOnGrid fills an approximate circle", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        drawCircleOnGrid(grid, 20, 15, 3, 1);

        // Center should be 1
        expect(grid[20][15]).toBe(1);
        // At the edge
        expect(grid[20][12]).toBe(1); // within radius
    });
});

describe("Counting & searching", () => {
    it("validLocationCount counts matching cells", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);
        grid[1][1] = 5;
        grid[2][2] = 5;
        grid[3][3] = 5;
        grid[4][4] = 3;

        expect(validLocationCount(grid, 5)).toBe(3);
        expect(validLocationCount(grid, 3)).toBe(1);
        expect(validLocationCount(grid, 99)).toBe(0);
    });

    it("randomLocationInGrid returns a valid location", () => {
        seedRandomGenerator(12345n);
        const grid = allocGrid();
        fillGrid(grid, 0);
        grid[10][10] = 1;
        grid[20][20] = 1;
        grid[30][15] = 1;

        const pos = randomLocationInGrid(grid, 1);
        expect(pos.x).not.toBe(-1);
        expect(pos.y).not.toBe(-1);
        expect(grid[pos.x][pos.y]).toBe(1);
    });

    it("randomLocationInGrid returns -1, -1 when no valid locations", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        const pos = randomLocationInGrid(grid, 1);
        expect(pos.x).toBe(-1);
        expect(pos.y).toBe(-1);
    });

    it("randomLeastPositiveLocationInGrid finds the smallest positive value", () => {
        seedRandomGenerator(54321n);
        const grid = allocGrid();
        fillGrid(grid, 0);
        grid[5][5] = 3;
        grid[10][10] = 1;
        grid[15][15] = 2;

        const pos = randomLeastPositiveLocationInGrid(grid, false);
        expect(pos.x).toBe(10);
        expect(pos.y).toBe(10);
    });

    it("randomLeastPositiveLocationInGrid returns INVALID_POS when no positive values", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        const pos = randomLeastPositiveLocationInGrid(grid, false);
        expect(pos.x).toBe(-1);
        expect(pos.y).toBe(-1);
    });
});

describe("Blob generation", () => {
    it("createBlobOnGrid produces a blob within bounds", () => {
        seedRandomGenerator(42n);
        const grid = allocGrid();

        const result = createBlobOnGrid(
            grid,
            5,       // roundCount
            4, 4,    // minBlobWidth, minBlobHeight
            20, 20,  // maxBlobWidth, maxBlobHeight
            55,      // percentSeeded
            "ffffffttt",  // birthParameters
            "ffffttttt",  // survivalParameters
        );

        expect(result.width).toBeGreaterThanOrEqual(4);
        expect(result.height).toBeGreaterThanOrEqual(4);
        expect(result.minX).toBeGreaterThanOrEqual(0);
        expect(result.minY).toBeGreaterThanOrEqual(0);
        expect(result.minX + result.width).toBeLessThanOrEqual(DCOLS);
        expect(result.minY + result.height).toBeLessThanOrEqual(DROWS);

        // Verify that the grid contains 1s within the bounding box
        let foundOne = false;
        for (let i = result.minX; i < result.minX + result.width; i++) {
            for (let j = result.minY; j < result.minY + result.height; j++) {
                if (grid[i][j] === 1) foundOne = true;
            }
        }
        expect(foundOne).toBe(true);
    });

    it("createBlobOnGrid is deterministic with the same seed", () => {
        seedRandomGenerator(42n);
        const grid1 = allocGrid();
        const result1 = createBlobOnGrid(grid1, 5, 4, 4, 20, 20, 55, "ffffffttt", "ffffttttt");

        seedRandomGenerator(42n);
        const grid2 = allocGrid();
        const result2 = createBlobOnGrid(grid2, 5, 4, 4, 20, 20, 55, "ffffffttt", "ffffttttt");

        expect(result1).toEqual(result2);
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid1[i][j]).toBe(grid2[i][j]);
            }
        }
    });
});
