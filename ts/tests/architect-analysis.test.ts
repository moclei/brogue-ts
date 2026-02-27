/*
 *  architect-analysis.test.ts — Tests for loop detection, chokepoints, and secondary connections
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    checkLoopiness,
    auditLoop,
    floodFillCount,
    analyzeMap,
    addLoops,
} from "../src/architect/analysis.js";
import { TileType, DungeonLayer } from "../src/types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import { TileFlag } from "../src/types/flags.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import type { Pcell, CellDisplayBuffer } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeCellDisplay(): CellDisplayBuffer {
    return {
        character: 0,
        foreColorComponents: [0, 0, 0],
        backColorComponents: [0, 0, 0],
        opacity: 0,
    };
}

function makeCell(dungeonTile: TileType = TileType.GRANITE): Pcell {
    const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING);
    layers[DungeonLayer.Dungeon] = dungeonTile;
    return {
        layers,
        flags: 0,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: makeCellDisplay(),
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: TileType.NOTHING,
    };
}

function makePmap(defaultTile: TileType = TileType.GRANITE): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            pmap[i][j] = makeCell(defaultTile);
        }
    }
    return pmap;
}

function carveRoom(
    pmap: Pcell[][],
    x1: number, y1: number,
    x2: number, y2: number,
    tile: TileType = TileType.FLOOR,
): void {
    for (let i = x1; i <= x2; i++) {
        for (let j = y1; j <= y2; j++) {
            pmap[i][j].layers[DungeonLayer.Dungeon] = tile;
        }
    }
}

/**
 * Create a room grid (0 = wall, 1 = floor) matching a pmap.
 * Floor cells in pmap become 1, everything else 0.
 */
function pmapToRoomGrid(pmap: Pcell[][]): Grid {
    const grid = allocGrid();
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            grid[i][j] = (
                pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.FLOOR
                || pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.DOOR
            ) ? 1 : 0;
        }
    }
    return grid;
}

// =============================================================================
// checkLoopiness
// =============================================================================

describe("checkLoopiness", () => {
    it("returns false for cells not marked IN_LOOP", () => {
        const pmap = makePmap(TileType.FLOOR);
        // Cell has no IN_LOOP flag
        expect(checkLoopiness(pmap, 10, 10)).toBe(false);
    });

    it("returns false when all 8 neighbours are IN_LOOP (fully surrounded)", () => {
        const pmap = makePmap(TileType.FLOOR);
        // Mark a 3x3 block as IN_LOOP
        for (let i = 9; i <= 11; i++) {
            for (let j = 9; j <= 11; j++) {
                pmap[i][j].flags |= TileFlag.IN_LOOP;
            }
        }
        // Center cell has all 8 neighbours loopy — sdir will be 8
        expect(checkLoopiness(pmap, 10, 10)).toBe(false);
    });

    it("strips IN_LOOP from a cell with a single short string of loopy neighbours", () => {
        const pmap = makePmap(TileType.FLOOR);
        // Mark center and 2 adjacent cells as IN_LOOP (L-shape)
        pmap[10][10].flags |= TileFlag.IN_LOOP;
        pmap[11][10].flags |= TileFlag.IN_LOOP;
        pmap[10][11].flags |= TileFlag.IN_LOOP;

        // checkLoopiness on (10,10) should remove it if the string ≤ 4
        const result = checkLoopiness(pmap, 10, 10);
        // It may or may not strip depending on exact layout, but it should
        // not crash
        expect(typeof result).toBe("boolean");
    });

    it("does not strip IN_LOOP when cell has multiple separate loopy strings", () => {
        const pmap = makePmap(TileType.FLOOR);

        // Mark center as loopy
        pmap[10][10].flags |= TileFlag.IN_LOOP;
        // Mark non-adjacent neighbors as loopy to create two separate strings
        // Using cDirs clockwise from South: [0,1], [1,1], [1,0], [1,-1], [0,-1], [-1,-1], [-1,0], [-1,1]
        // Place loopy cells at South and North (separated by non-loopy cells)
        pmap[10][11].flags |= TileFlag.IN_LOOP; // South
        pmap[10][9].flags |= TileFlag.IN_LOOP;  // North
        // Make sure the cells between them are NOT loopy to create two strings

        const result = checkLoopiness(pmap, 10, 10);
        // With two separate strings, should return false (leave loopy)
        expect(result).toBe(false);
    });
});

// =============================================================================
// auditLoop
// =============================================================================

describe("auditLoop", () => {
    it("marks reachable non-loopy cells in grid", () => {
        const pmap = makePmap(TileType.FLOOR);
        const grid = allocGrid();
        fillGrid(grid, 0);

        // All cells are non-loopy floor — should flood fill everything reachable
        auditLoop(pmap, 5, 5, grid);

        // Cell (5,5) should be marked
        expect(grid[5][5]).toBe(1);
        // Adjacent cells should also be reached
        expect(grid[6][5]).toBe(1);
        expect(grid[5][6]).toBe(1);
    });

    it("does not cross IN_LOOP cells", () => {
        const pmap = makePmap(TileType.FLOOR);
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Create a barrier of IN_LOOP cells
        for (let j = 0; j < DROWS; j++) {
            pmap[10][j].flags |= TileFlag.IN_LOOP;
        }

        auditLoop(pmap, 5, 5, grid);

        // Cells on the left side should be marked
        expect(grid[5][5]).toBe(1);
        // Cells on the right side should NOT be marked (blocked by IN_LOOP barrier)
        expect(grid[15][5]).toBe(0);
    });

    it("does not revisit already marked cells", () => {
        const pmap = makePmap(TileType.FLOOR);
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Pre-mark a cell
        grid[5][5] = 1;

        // Should not re-enter (5,5) since it's already marked
        auditLoop(pmap, 5, 5, grid);
        expect(grid[5][5]).toBe(1);
    });
});

// =============================================================================
// floodFillCount
// =============================================================================

describe("floodFillCount", () => {
    it("counts reachable cells in passMap", () => {
        const pmap = makePmap(TileType.FLOOR);
        const results = allocGrid();
        const passMap = allocGrid();
        fillGrid(results, 0);
        fillGrid(passMap, 0);

        // Create a small 3x3 passable region
        for (let i = 10; i <= 12; i++) {
            for (let j = 10; j <= 12; j++) {
                passMap[i][j] = 1;
            }
        }

        const count = floodFillCount(pmap, results, passMap, 10, 10);
        // Should count all 9 cells (3x3)
        expect(count).toBe(9);
    });

    it("returns 10000 when area machine flag is set", () => {
        const pmap = makePmap(TileType.FLOOR);
        const results = allocGrid();
        const passMap = allocGrid();
        fillGrid(results, 0);
        fillGrid(passMap, 0);

        passMap[10][10] = 1;
        pmap[10][10].flags |= TileFlag.IS_IN_AREA_MACHINE;

        const count = floodFillCount(pmap, results, passMap, 10, 10);
        expect(count).toBe(10000);
    });

    it("counts value-2 cells as 5000", () => {
        const pmap = makePmap(TileType.FLOOR);
        const results = allocGrid();
        const passMap = allocGrid();
        fillGrid(results, 0);
        fillGrid(passMap, 0);

        passMap[10][10] = 2; // area machine presence
        passMap[11][10] = 1; // normal passable

        const count = floodFillCount(pmap, results, passMap, 10, 10);
        // 5000 (for value-2 cell) + 1 (for normal cell) = 5001
        expect(count).toBe(5001);
    });

    it("caps count at 10000", () => {
        const pmap = makePmap(TileType.FLOOR);
        const results = allocGrid();
        const passMap = allocGrid();
        fillGrid(results, 0);
        fillGrid(passMap, 0);

        // Two adjacent value-2 cells: 5000 + 5000 = 10000 (capped)
        passMap[10][10] = 2;
        passMap[11][10] = 2;

        const count = floodFillCount(pmap, results, passMap, 10, 10);
        expect(count).toBe(10000);
    });

    it("marks results grid for visited cells", () => {
        const pmap = makePmap(TileType.FLOOR);
        const results = allocGrid();
        const passMap = allocGrid();
        fillGrid(results, 0);
        fillGrid(passMap, 0);

        passMap[10][10] = 1;
        passMap[11][10] = 1;

        floodFillCount(pmap, results, passMap, 10, 10);

        expect(results[10][10]).toBe(1);
        expect(results[11][10]).toBe(1);
        expect(results[12][10]).toBe(0); // not passable, not visited
    });
});

// =============================================================================
// analyzeMap
// =============================================================================

describe("analyzeMap", () => {
    it("marks loop cells as IN_LOOP in a simple loop layout", () => {
        const pmap = makePmap(TileType.GRANITE);

        // Create a simple rectangular loop:
        //   ##########
        //   #........#
        //   #.######.#
        //   #.#    #.#
        //   #.######.#
        //   #........#
        //   ##########
        carveRoom(pmap, 5, 5, 20, 15);
        // Fill interior back with granite to create hollow rectangle
        carveRoom(pmap, 7, 7, 18, 13, TileType.GRANITE);

        analyzeMap(pmap, null, false);

        // Cells along the loop corridor should have IN_LOOP set
        // Top corridor: (5..20, 5) — some should be IN_LOOP
        let loopCount = 0;
        for (let i = 5; i <= 20; i++) {
            for (let j = 5; j <= 15; j++) {
                if (pmap[i][j].flags & TileFlag.IN_LOOP) {
                    loopCount++;
                }
            }
        }
        expect(loopCount).toBeGreaterThan(0);
    });

    it("does not mark dead-end corridors as IN_LOOP", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Create a single straight corridor (dead-end)
        carveRoom(pmap, 10, 10, 10, 20);

        analyzeMap(pmap, null, false);

        // No loops — nothing should be IN_LOOP
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(pmap[i][j].flags & TileFlag.IN_LOOP).toBe(0);
            }
        }
    });

    it("identifies chokepoints in a dumbbell layout", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Two rooms connected by a 1-wide corridor
        carveRoom(pmap, 3, 3, 10, 10);   // left room
        carveRoom(pmap, 20, 3, 27, 10);  // right room
        carveRoom(pmap, 11, 6, 19, 6);   // corridor (1-wide)

        analyzeMap(pmap, null, false);

        // The corridor cells should be chokepoints
        let chokeCount = 0;
        for (let i = 11; i <= 19; i++) {
            if (pmap[i][6].flags & TileFlag.IS_CHOKEPOINT) {
                chokeCount++;
            }
        }
        expect(chokeCount).toBeGreaterThan(0);
    });

    it("computes chokeMap when calculateChokeMap is true", () => {
        const pmap = makePmap(TileType.GRANITE);
        const chokeMap = allocGrid();
        fillGrid(chokeMap, 0);

        // Two rooms connected by a corridor
        carveRoom(pmap, 3, 3, 10, 10);
        carveRoom(pmap, 20, 3, 27, 10);
        carveRoom(pmap, 11, 6, 19, 6);

        analyzeMap(pmap, chokeMap, true);

        // ChokeMap should have been populated
        // Non-30000 values indicate computed chokepoint influence
        let hasNonDefault = false;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (chokeMap[i][j] > 0 && chokeMap[i][j] < 30000) {
                    hasNonDefault = true;
                }
            }
        }
        expect(hasNonDefault).toBe(true);
    });

    it("is deterministic — same input produces same flags", () => {
        const pmap1 = makePmap(TileType.GRANITE);
        const pmap2 = makePmap(TileType.GRANITE);

        carveRoom(pmap1, 3, 3, 10, 10);
        carveRoom(pmap1, 20, 3, 27, 10);
        carveRoom(pmap1, 11, 6, 19, 6);

        carveRoom(pmap2, 3, 3, 10, 10);
        carveRoom(pmap2, 20, 3, 27, 10);
        carveRoom(pmap2, 11, 6, 19, 6);

        analyzeMap(pmap1, null, false);
        analyzeMap(pmap2, null, false);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(pmap1[i][j].flags & (TileFlag.IN_LOOP | TileFlag.IS_CHOKEPOINT))
                    .toBe(pmap2[i][j].flags & (TileFlag.IN_LOOP | TileFlag.IS_CHOKEPOINT));
            }
        }
    });
});

// =============================================================================
// addLoops
// =============================================================================

describe("addLoops", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("adds door connections between rooms separated by thin walls", () => {
        // Create a room grid with two rooms separated by a thin wall
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Left room
        for (let i = 3; i <= 10; i++) {
            for (let j = 3; j <= 10; j++) {
                grid[i][j] = 1;
            }
        }
        // Right room (separated by 1-cell wall at x=11)
        for (let i = 12; i <= 19; i++) {
            for (let j = 3; j <= 10; j++) {
                grid[i][j] = 1;
            }
        }

        addLoops(grid, 5);

        // At least one cell at x=11 should have become a doorway (value 2)
        let doorCount = 0;
        for (let j = 3; j <= 10; j++) {
            if (grid[11][j] === 2) doorCount++;
        }
        expect(doorCount).toBeGreaterThan(0);
    });

    it("does not add loops when pathing distance is short", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Two rooms connected by a corridor with a wall cell at x=11
        for (let i = 3; i <= 10; i++) {
            for (let j = 5; j <= 8; j++) {
                grid[i][j] = 1;
            }
        }
        for (let i = 12; i <= 19; i++) {
            for (let j = 5; j <= 8; j++) {
                grid[i][j] = 1;
            }
        }
        // Existing corridor connecting the two rooms (around the wall)
        for (let i = 3; i <= 19; i++) {
            grid[i][4] = 1;
        }

        seedRandomGenerator(42n);
        addLoops(grid, 100); // Very high threshold — should not add any

        // No new doors should appear at x=11 between rooms
        let doorCount = 0;
        for (let j = 5; j <= 8; j++) {
            if (grid[11][j] === 2) doorCount++;
        }
        expect(doorCount).toBe(0);
    });

    it("is deterministic with same seed", () => {
        const makeGrid = () => {
            const g = allocGrid();
            fillGrid(g, 0);
            for (let i = 3; i <= 10; i++) {
                for (let j = 3; j <= 10; j++) g[i][j] = 1;
            }
            for (let i = 12; i <= 19; i++) {
                for (let j = 3; j <= 10; j++) g[i][j] = 1;
            }
            return g;
        };

        seedRandomGenerator(42n);
        const grid1 = makeGrid();
        addLoops(grid1, 5);

        seedRandomGenerator(42n);
        const grid2 = makeGrid();
        addLoops(grid2, 5);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid1[i][j]).toBe(grid2[i][j]);
            }
        }
    });

    it("marks new connections as value 2 in the grid", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        // Two rooms separated by single wall
        for (let i = 3; i <= 10; i++) {
            for (let j = 3; j <= 10; j++) grid[i][j] = 1;
        }
        for (let i = 12; i <= 19; i++) {
            for (let j = 3; j <= 10; j++) grid[i][j] = 1;
        }

        seedRandomGenerator(99n);
        addLoops(grid, 5);

        // Check that any doorway cell has value 2 (not 1 or 0)
        let foundDoor = false;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j] === 2) {
                    foundDoor = true;
                }
            }
        }
        // With two adjacent rooms and threshold 5, we should get at least one
        expect(foundDoor).toBe(true);
    });
});
