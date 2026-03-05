/*
 *  architect-helpers.test.ts — Tests for architect helper functions
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    zeroOutGrid,
    copyMap,
    oppositeDirection,
    cellIsPassableOrDoor,
    passableArcCount,
    connectCell,
    levelIsDisconnectedWithBlockingMap,
    randomMatchingLocation,
} from "../src/architect/helpers.js";
import { Direction, TileType, DungeonLayer } from "../src/types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import { TileFlag, IS_IN_MACHINE } from "../src/types/flags.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import { tileCatalog } from "../src/globals/tile-catalog.js";
import type { Pcell, CellDisplayBuffer } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Create a default CellDisplayBuffer for test pmap cells. */
function makeCellDisplay(): CellDisplayBuffer {
    return {
        character: 0,
        foreColorComponents: [0, 0, 0],
        backColorComponents: [0, 0, 0],
        opacity: 0,
    };
}

/** Create a single Pcell with the given dungeon layer tile type. */
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

/** Create a full DCOLS×DROWS pmap initialized to granite. */
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

/**
 * Carve a rectangular room of FLOOR tiles in the pmap.
 * Coordinates are inclusive.
 */
function carveRoom(
    pmap: Pcell[][],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    tile: TileType = TileType.FLOOR,
): void {
    for (let i = x1; i <= x2; i++) {
        for (let j = y1; j <= y2; j++) {
            pmap[i][j].layers[DungeonLayer.Dungeon] = tile;
        }
    }
}

// =============================================================================
// zeroOutGrid
// =============================================================================

describe("zeroOutGrid", () => {
    it("fills all cells with zero", () => {
        const grid = allocGrid();
        fillGrid(grid, 42);
        zeroOutGrid(grid);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid[i][j]).toBe(0);
            }
        }
    });
});

// =============================================================================
// oppositeDirection
// =============================================================================

describe("oppositeDirection", () => {
    it("returns opposite cardinal directions", () => {
        expect(oppositeDirection(Direction.Up)).toBe(Direction.Down);
        expect(oppositeDirection(Direction.Down)).toBe(Direction.Up);
        expect(oppositeDirection(Direction.Left)).toBe(Direction.Right);
        expect(oppositeDirection(Direction.Right)).toBe(Direction.Left);
    });

    it("returns opposite diagonal directions", () => {
        expect(oppositeDirection(Direction.UpRight)).toBe(Direction.DownLeft);
        expect(oppositeDirection(Direction.DownLeft)).toBe(Direction.UpRight);
        expect(oppositeDirection(Direction.UpLeft)).toBe(Direction.DownRight);
        expect(oppositeDirection(Direction.DownRight)).toBe(Direction.UpLeft);
    });

    it("NoDirection maps to NoDirection", () => {
        expect(oppositeDirection(Direction.NoDirection)).toBe(Direction.NoDirection);
    });

    it("is its own inverse for all directions", () => {
        for (let dir = Direction.Up; dir <= Direction.DownRight; dir++) {
            expect(oppositeDirection(oppositeDirection(dir))).toBe(dir);
        }
    });
});

// =============================================================================
// copyMap
// =============================================================================

describe("copyMap", () => {
    it("copies layers, flags, volume, and machineNumber", () => {
        const from = makePmap(TileType.FLOOR);
        const to = makePmap(TileType.GRANITE);

        from[5][5].layers[DungeonLayer.Dungeon] = TileType.WALL;
        from[5][5].layers[DungeonLayer.Liquid] = TileType.NOTHING;
        from[5][5].flags = TileFlag.DISCOVERED | TileFlag.IN_LOOP;
        from[5][5].volume = 77;
        from[5][5].machineNumber = 3;

        copyMap(from, to);

        expect(to[5][5].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
        expect(to[5][5].flags).toBe(from[5][5].flags);
        expect(to[5][5].volume).toBe(77);
        expect(to[5][5].machineNumber).toBe(3);

        // Other cells should also be copied
        expect(to[0][0].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
    });
});

// =============================================================================
// cellIsPassableOrDoor
// =============================================================================

describe("cellIsPassableOrDoor", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        pmap = makePmap(TileType.GRANITE);
    });

    it("returns true for FLOOR tiles (not a pathing blocker)", () => {
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        expect(cellIsPassableOrDoor(pmap, 10, 10)).toBe(true);
    });

    it("returns false for GRANITE walls (pathing blocker)", () => {
        expect(cellIsPassableOrDoor(pmap, 10, 10)).toBe(false);
    });

    it("returns true for SECRET_DOOR (is secret + obstructs passability)", () => {
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.SECRET_DOOR;
        expect(cellIsPassableOrDoor(pmap, 10, 10)).toBe(true);
    });

    it("returns true for LOCKED_DOOR", () => {
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.LOCKED_DOOR;
        expect(cellIsPassableOrDoor(pmap, 10, 10)).toBe(true);
    });
});

// =============================================================================
// passableArcCount
// =============================================================================

describe("passableArcCount", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        // Start with all granite (impassable)
        pmap = makePmap(TileType.GRANITE);
    });

    it("returns 0 for a cell fully surrounded by walls", () => {
        // Cell at (10,10) surrounded by granite — no transitions
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        expect(passableArcCount(pmap, 10, 10)).toBe(0);
    });

    it("returns 1 for a cell at the end of a dead-end corridor", () => {
        // Create a short dead-end corridor: 3 floor cells in a row
        // (10,10) is the dead end, (11,10) and (12,10) are corridor
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[11][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[12][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        // (10,10) has one passable neighbor to the right, rest are walls
        // Going clockwise: transitions happen entering and leaving the
        // passable arc — so arcCount = 1
        expect(passableArcCount(pmap, 10, 10)).toBe(1);
    });

    it("returns 2 for a cell in the middle of a straight corridor", () => {
        // Horizontal corridor: 5 cells wide at y=10
        for (let x = 8; x <= 12; x++) {
            pmap[x][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        }
        // (10,10) has passable neighbors left and right, but walls above and below
        expect(passableArcCount(pmap, 10, 10)).toBe(2);
    });

    it("returns 0 for a cell fully surrounded by floor (open room)", () => {
        // Create a 5×5 room
        carveRoom(pmap, 8, 8, 12, 12);
        // (10,10) in the center of the room — all neighbors are passable
        expect(passableArcCount(pmap, 10, 10)).toBe(0);
    });
});

// =============================================================================
// connectCell
// =============================================================================

describe("connectCell", () => {
    let pmap: Pcell[][];
    let zoneMap: Grid;

    beforeEach(() => {
        pmap = makePmap(TileType.GRANITE);
        zoneMap = allocGrid();
    });

    it("flood-fills a small room and returns its size", () => {
        // Create a 3×3 room of floor
        carveRoom(pmap, 5, 5, 7, 7);
        const size = connectCell(pmap, 5, 5, 1, null, zoneMap);
        expect(size).toBe(9); // 3×3 = 9

        // All room cells should be labeled 1
        for (let i = 5; i <= 7; i++) {
            for (let j = 5; j <= 7; j++) {
                expect(zoneMap[i][j]).toBe(1);
            }
        }
    });

    it("respects blocking map", () => {
        // Create an L-shaped corridor
        carveRoom(pmap, 5, 5, 10, 5); // horizontal
        carveRoom(pmap, 10, 5, 10, 10); // vertical

        const blockingMap = allocGrid();
        // Block the junction cell
        blockingMap[10][5] = 1;

        const size = connectCell(pmap, 5, 5, 1, blockingMap, zoneMap);
        // Should only fill the horizontal part, minus the blocked cell
        expect(size).toBe(5); // cells (5,5) to (9,5)
    });

    it("does not cross walls", () => {
        // Two separate rooms
        carveRoom(pmap, 2, 2, 4, 4);   // 3×3 room
        carveRoom(pmap, 10, 10, 12, 12); // another 3×3 room

        const size = connectCell(pmap, 2, 2, 1, null, zoneMap);
        expect(size).toBe(9); // only the first room

        // Second room should not be labeled
        expect(zoneMap[10][10]).toBe(0);
    });
});

// =============================================================================
// levelIsDisconnectedWithBlockingMap
// =============================================================================

describe("levelIsDisconnectedWithBlockingMap", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        pmap = makePmap(TileType.GRANITE);
    });

    it("returns 0 when blocking map does not disconnect the level", () => {
        // Create a single connected room
        carveRoom(pmap, 5, 5, 15, 15);
        const blockingMap = allocGrid();
        // Block a corner that won't disconnect anything
        blockingMap[5][5] = 1;

        const result = levelIsDisconnectedWithBlockingMap(pmap, blockingMap, false);
        expect(result).toBe(0);
    });

    it("returns 1 when blocking map disconnects the level (countRegionSize=false)", () => {
        // Create two rooms connected by a 1-cell-wide corridor
        carveRoom(pmap, 3, 3, 7, 7);    // left room (5×5 = 25 cells)
        carveRoom(pmap, 13, 3, 17, 7);   // right room (5×5 = 25 cells)
        carveRoom(pmap, 8, 5, 12, 5);    // corridor connecting them

        const blockingMap = allocGrid();
        // Block the corridor
        for (let x = 8; x <= 12; x++) {
            blockingMap[x][5] = 1;
        }

        const result = levelIsDisconnectedWithBlockingMap(pmap, blockingMap, false);
        expect(result).toBe(1);
    });

    it("returns smallest region size when countRegionSize=true", () => {
        // Create two rooms of different sizes connected by a corridor
        carveRoom(pmap, 3, 3, 5, 5);    // small room (3×3 = 9 cells)
        carveRoom(pmap, 13, 3, 20, 10); // large room (8×8 = 64 cells)
        carveRoom(pmap, 6, 4, 12, 4);   // corridor

        const blockingMap = allocGrid();
        // Block the corridor
        for (let x = 6; x <= 12; x++) {
            blockingMap[x][4] = 1;
        }

        const result = levelIsDisconnectedWithBlockingMap(pmap, blockingMap, true);
        // Should return the size of the smaller region
        expect(result).toBe(9);
    });

    it("returns 0 when there's only one room (no disconnection possible)", () => {
        carveRoom(pmap, 5, 5, 10, 10);
        const blockingMap = allocGrid();
        // Block some cells that don't border the room
        blockingMap[20][20] = 1;

        const result = levelIsDisconnectedWithBlockingMap(pmap, blockingMap, false);
        expect(result).toBe(0);
    });
});

// =============================================================================
// randomMatchingLocation
// =============================================================================

describe("randomMatchingLocation", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap(TileType.GRANITE);
    });

    it("returns null when no matching location exists", () => {
        // All cells are granite, looking for FLOOR — should fail
        const result = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);
        expect(result).toBeNull();
    });

    it("finds a floor tile when one exists", () => {
        // Create a big room so there's a good chance of finding it
        carveRoom(pmap, 1, 1, DCOLS - 2, DROWS - 2);
        const result = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);
        expect(result).not.toBeNull();
        expect(result!.x).toBeGreaterThanOrEqual(0);
        expect(result!.x).toBeLessThan(DCOLS);
        expect(result!.y).toBeGreaterThanOrEqual(0);
        expect(result!.y).toBeLessThan(DROWS);
        // Verify the cell actually is FLOOR
        expect(pmap[result!.x][result!.y].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
    });

    it("avoids cells with HAS_PLAYER flag", () => {
        // Only one floor cell, but it has a player
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[10][10].flags |= TileFlag.HAS_PLAYER;
        const result = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);
        expect(result).toBeNull();
    });

    it("avoids cells with HAS_STAIRS flag", () => {
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[10][10].flags |= TileFlag.HAS_STAIRS;
        const result = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);
        expect(result).toBeNull();
    });

    it("avoids cells in machines", () => {
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[10][10].flags |= IS_IN_MACHINE;
        const result = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);
        expect(result).toBeNull();
    });

    it("deterministic with same seed", () => {
        carveRoom(pmap, 1, 1, DCOLS - 2, DROWS - 2);

        seedRandomGenerator(42n);
        const result1 = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);

        seedRandomGenerator(42n);
        const result2 = randomMatchingLocation(pmap, tileCatalog, TileType.FLOOR, -1, -1);

        expect(result1).toEqual(result2);
    });

    it("finds by terrainType across layers", () => {
        // Place a specific terrain on the liquid layer
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        // Use terrainType to match — should match if any layer has it
        // terrainType >= 0 means match on any layer
        const result = randomMatchingLocation(pmap, tileCatalog, -1, -1, TileType.FLOOR);
        // With only one cell as FLOOR and random search, may or may not find it
        // but we test the API doesn't crash
        // For a more reliable test, fill more cells
        carveRoom(pmap, 1, 1, DCOLS - 2, DROWS - 2);
        const result2 = randomMatchingLocation(pmap, tileCatalog, -1, -1, TileType.FLOOR);
        expect(result2).not.toBeNull();
    });
});
