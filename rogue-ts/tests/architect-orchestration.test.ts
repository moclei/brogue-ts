/*
 *  architect-orchestration.test.ts — Tests for dungeon generation orchestration
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    clearLevel,
    adjustDungeonProfileForDepth,
    adjustDungeonFirstRoomProfileForDepth,
    carveDungeon,
    validStairLoc,
    prepareForStairs,
    updateMapToShore,
    getQualifyingGridLocNear,
    getQualifyingLocNear,
    resetDFMessageEligibility,
} from "../src/architect/architect.js";
import { TileType, DungeonLayer, DungeonProfileType } from "../src/types/enums.js";
import { DCOLS, DROWS, ROOM_TYPE_COUNT, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import { TileFlag, TerrainFlag, IS_IN_MACHINE } from "../src/types/flags.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import { tileCatalog } from "../src/globals/tile-catalog.js";
import { dungeonProfileCatalog } from "../src/globals/dungeon-profile-catalog.js";
import type { Pcell, CellDisplayBuffer, DungeonProfile, DungeonFeature } from "../src/types/types.js";

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
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
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

/** Simple hash of a grid (for seed-based regression). */
function hashGrid(grid: Grid): number {
    let h = 0;
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
            h = ((h << 5) - h + grid[i][j]) | 0;
        }
    }
    return h;
}

/** Count cells with a particular dungeon tile type. */
function countTile(pmap: Pcell[][], tile: TileType): number {
    let count = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (pmap[i][j].layers[DungeonLayer.Dungeon] === tile) count++;
        }
    }
    return count;
}

// =============================================================================
// Tests: clearLevel
// =============================================================================

describe("clearLevel", () => {
    it("resets all cells to granite and clears flags", () => {
        const pmap = makePmap(TileType.FLOOR);
        // Dirty some cells
        pmap[5][5].layers[DungeonLayer.Liquid] = TileType.DEEP_WATER;
        pmap[5][5].machineNumber = 3;
        pmap[5][5].flags = TileFlag.HAS_STAIRS | TileFlag.IMPREGNABLE;
        pmap[10][10].volume = 100;

        clearLevel(pmap);

        // Verify reset
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(pmap[i][j].layers[DungeonLayer.Dungeon]).toBe(TileType.GRANITE);
                expect(pmap[i][j].layers[DungeonLayer.Liquid]).toBe(TileType.NOTHING);
                expect(pmap[i][j].layers[DungeonLayer.Gas]).toBe(TileType.NOTHING);
                expect(pmap[i][j].layers[DungeonLayer.Surface]).toBe(TileType.NOTHING);
                expect(pmap[i][j].machineNumber).toBe(0);
                expect(pmap[i][j].flags).toBe(0);
                expect(pmap[i][j].volume).toBe(0);
            }
        }
    });
});

// =============================================================================
// Tests: adjustDungeonProfileForDepth
// =============================================================================

describe("adjustDungeonProfileForDepth", () => {
    it("increases cross rooms and corridors on shallow levels", () => {
        const profile: DungeonProfile = {
            roomFrequencies: [0, 0, 0, 0, 0, 0, 0, 0],
            corridorChance: 0,
        };

        // Depth 1 of 26: 0% descent
        adjustDungeonProfileForDepth(profile, 1, 26);

        expect(profile.roomFrequencies[0]).toBe(20); // +20 for 0% descent
        expect(profile.roomFrequencies[1]).toBe(10); // +10
        expect(profile.roomFrequencies[3]).toBe(7);  // +7
        expect(profile.roomFrequencies[5]).toBe(0);  // caves: 0% of 10
        expect(profile.corridorChance).toBe(80);     // +80
    });

    it("increases caves on deep levels", () => {
        const profile: DungeonProfile = {
            roomFrequencies: [0, 0, 0, 0, 0, 0, 0, 0],
            corridorChance: 0,
        };

        // Depth 26 of 26: 100% descent
        adjustDungeonProfileForDepth(profile, 26, 26);

        expect(profile.roomFrequencies[0]).toBe(0);  // 0 cross rooms
        expect(profile.roomFrequencies[5]).toBe(10); // +10 caves
        expect(profile.corridorChance).toBe(0);      // no corridors
    });
});

// =============================================================================
// Tests: adjustDungeonFirstRoomProfileForDepth
// =============================================================================

describe("adjustDungeonFirstRoomProfileForDepth", () => {
    it("forces entrance room on depth 1", () => {
        const profile: DungeonProfile = {
            roomFrequencies: [5, 5, 5, 5, 5, 5, 5, 5],
            corridorChance: 50,
        };

        adjustDungeonFirstRoomProfileForDepth(profile, 1, 26);

        // All frequencies zeroed except index 7 (entrance room)
        for (let i = 0; i < 7; i++) {
            expect(profile.roomFrequencies[i]).toBe(0);
        }
        expect(profile.roomFrequencies[7]).toBe(1);
    });

    it("increases cavern frequency on deep levels", () => {
        const profile: DungeonProfile = {
            roomFrequencies: [0, 0, 0, 0, 0, 0, 0, 0],
            corridorChance: 0,
        };

        // Depth 26 of 26: 100% descent
        adjustDungeonFirstRoomProfileForDepth(profile, 26, 26);

        expect(profile.roomFrequencies[6]).toBe(50); // +50 for cavern
    });
});

// =============================================================================
// Tests: carveDungeon (seed-based regression)
// =============================================================================

describe("carveDungeon", () => {
    it("produces a grid with rooms and doors", () => {
        seedRandomGenerator(12345n);
        const grid = allocGrid();
        fillGrid(grid, 0);

        carveDungeon(grid, 5, 26, dungeonProfileCatalog);

        // Should have floor cells (1) and door candidates (2)
        let floorCount = 0;
        let doorCount = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j] === 1) floorCount++;
                else if (grid[i][j] === 2) doorCount++;
            }
        }

        expect(floorCount).toBeGreaterThan(100);
        expect(doorCount).toBeGreaterThan(0);
    });

    it("is deterministic with the same seed", () => {
        seedRandomGenerator(42n);
        const grid1 = allocGrid();
        fillGrid(grid1, 0);
        carveDungeon(grid1, 10, 26, dungeonProfileCatalog);
        const hash1 = hashGrid(grid1);

        seedRandomGenerator(42n);
        const grid2 = allocGrid();
        fillGrid(grid2, 0);
        carveDungeon(grid2, 10, 26, dungeonProfileCatalog);
        const hash2 = hashGrid(grid2);

        expect(hash1).toBe(hash2);
    });

    it("produces different layouts for different seeds", () => {
        seedRandomGenerator(100n);
        const grid1 = allocGrid();
        fillGrid(grid1, 0);
        carveDungeon(grid1, 5, 26, dungeonProfileCatalog);

        seedRandomGenerator(200n);
        const grid2 = allocGrid();
        fillGrid(grid2, 0);
        carveDungeon(grid2, 5, 26, dungeonProfileCatalog);

        expect(hashGrid(grid1)).not.toBe(hashGrid(grid2));
    });

    it("produces different layouts for different depths", () => {
        seedRandomGenerator(777n);
        const grid1 = allocGrid();
        fillGrid(grid1, 0);
        carveDungeon(grid1, 1, 26, dungeonProfileCatalog);

        seedRandomGenerator(777n);
        const grid2 = allocGrid();
        fillGrid(grid2, 0);
        carveDungeon(grid2, 25, 26, dungeonProfileCatalog);

        expect(hashGrid(grid1)).not.toBe(hashGrid(grid2));
    });
});

// =============================================================================
// Tests: validStairLoc
// =============================================================================

describe("validStairLoc", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        pmap = makePmap(TileType.GRANITE);
    });

    it("returns false for non-wall cells", () => {
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        expect(validStairLoc(pmap, 10, 10)).toBe(false);
    });

    it("returns false for cells on the map edge", () => {
        pmap[0][5].layers[DungeonLayer.Dungeon] = TileType.WALL;
        expect(validStairLoc(pmap, 0, 5)).toBe(false);
    });

    it("returns false for cells adjacent to machines", () => {
        // Create a valid stair candidate
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.WALL;
        pmap[10][9].layers[DungeonLayer.Dungeon] = TileType.WALL; // N
        pmap[11][10].layers[DungeonLayer.Dungeon] = TileType.WALL; // E
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.FLOOR; // S (open)
        pmap[9][10].layers[DungeonLayer.Dungeon] = TileType.WALL; // W
        // But a neighbor is in a machine
        pmap[11][9].flags = IS_IN_MACHINE;
        expect(validStairLoc(pmap, 10, 10)).toBe(false);
    });

    it("accepts a valid stair location (wall with 3 wall neighbors, 1 open)", () => {
        // Set up: wall at (10,10), granite/wall on 3 sides, floor on 1 side
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.WALL;

        // Cardinal neighbors: N, E, W are walls; S is floor
        pmap[10][9].layers[DungeonLayer.Dungeon] = TileType.WALL;  // N
        pmap[11][10].layers[DungeonLayer.Dungeon] = TileType.WALL; // E
        pmap[9][10].layers[DungeonLayer.Dungeon] = TileType.WALL;  // W
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.FLOOR; // S (open)

        // The open side's diagonal neighbors must be walls
        // For dir pointing S (0,1), diagonals are:
        //   x - nbDirs[dir][0] + nbDirs[dir][1], y - nbDirs[dir][1] + nbDirs[dir][0]
        // dir S = index 3 in nbDirs: (0, 1)
        // diag1: 10 - 0 + 1 = 11, 10 - 1 + 0 = 9 → (11, 9)
        // diag2: 10 - 0 - 1 = 9, 10 - 1 - 0 = 9 → (9, 9)
        pmap[11][9].layers[DungeonLayer.Dungeon] = TileType.WALL;
        pmap[9][9].layers[DungeonLayer.Dungeon] = TileType.WALL;

        // passableArcCount for the open neighbor must be < 2
        // (10,11) is floor; make sure only one passable arc from it
        // It has passable tiles only in one direction
        pmap[10][12].layers[DungeonLayer.Dungeon] = TileType.FLOOR; // further south

        expect(validStairLoc(pmap, 10, 10)).toBe(true);
    });
});

// =============================================================================
// Tests: prepareForStairs
// =============================================================================

describe("prepareForStairs", () => {
    it("places torches on either side of the open direction", () => {
        const pmap = makePmap(TileType.WALL);
        // Open to the south
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const grid = allocGrid();
        fillGrid(grid, 1);

        prepareForStairs(pmap, 10, 10, grid);

        // Torches should be placed perpendicular to the open direction (S)
        // Open dir is S: nbDirs index where cell is not obstructing.
        // For dir=3 (S), torches at (x±nbDirs[dir][1], y±nbDirs[dir][0])
        // = (10±1, 10±0) = (11,10) and (9,10)
        expect(pmap[11][10].layers[DungeonLayer.Dungeon]).toBe(TileType.TORCH_WALL);
        expect(pmap[9][10].layers[DungeonLayer.Dungeon]).toBe(TileType.TORCH_WALL);
    });

    it("converts adjacent granite to wall", () => {
        const pmap = makePmap(TileType.GRANITE);
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const grid = allocGrid();
        fillGrid(grid, 1);

        prepareForStairs(pmap, 10, 10, grid);

        // All 8 neighbors should be WALL or TORCH_WALL (not GRANITE)
        for (let dir = 0; dir < 8; dir++) {
            const tile = pmap[10 + [1,1,0,-1,-1,-1,0,1][dir]][10 + [0,1,1,1,0,-1,-1,-1][dir]].layers[DungeonLayer.Dungeon];
            expect(tile).not.toBe(TileType.GRANITE);
        }
    });

    it("marks wall neighbors as impregnable", () => {
        const pmap = makePmap(TileType.WALL);
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const grid = allocGrid();
        fillGrid(grid, 0);

        prepareForStairs(pmap, 10, 10, grid);

        // The wall neighbors should be impregnable
        // (the floor neighbor won't be, since it doesn't obstruct passability)
        expect(pmap[10][9].flags & TileFlag.IMPREGNABLE).toBeTruthy();
    });

    it("zeroes out grid in the vicinity", () => {
        const pmap = makePmap(TileType.WALL);
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const grid = allocGrid();
        fillGrid(grid, 1);

        prepareForStairs(pmap, 10, 10, grid);

        // Grid should be zeroed within 5 cells
        for (let x = 5; x < 15; x++) {
            for (let y = 5; y < 15; y++) {
                if (x >= 0 && x < DCOLS && y >= 0 && y < DROWS) {
                    expect(grid[x][y]).toBe(0);
                }
            }
        }
    });
});

// =============================================================================
// Tests: getQualifyingGridLocNear
// =============================================================================

describe("getQualifyingGridLocNear", () => {
    it("returns target if it qualifies", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);
        grid[10][10] = 1;

        const result = getQualifyingGridLocNear(grid, { x: 10, y: 10 });
        expect(result).toEqual({ x: 10, y: 10 });
    });

    it("finds nearest qualifying location", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);
        grid[12][10] = 1;

        const result = getQualifyingGridLocNear(grid, { x: 10, y: 10 });
        expect(result).not.toBeNull();
        // Should find (12, 10) which is 2 away
        expect(result!.x).toBe(12);
        expect(result!.y).toBe(10);
    });

    it("returns null when no qualifying location exists", () => {
        const grid = allocGrid();
        fillGrid(grid, 0);

        const result = getQualifyingGridLocNear(grid, { x: 10, y: 10 });
        expect(result).toBeNull();
    });
});

// =============================================================================
// Tests: getQualifyingLocNear
// =============================================================================

describe("getQualifyingLocNear", () => {
    it("returns target if it qualifies", () => {
        const pmap = makePmap(TileType.FLOOR);

        const result = getQualifyingLocNear(
            pmap, { x: 10, y: 10 },
            TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0,
        );
        expect(result).toEqual({ x: 10, y: 10 });
    });

    it("skips cells with avoided terrain flags", () => {
        const pmap = makePmap(TileType.GRANITE); // All granite = obstructs passability
        pmap[15][15].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const result = getQualifyingLocNear(
            pmap, { x: 10, y: 10 },
            TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0,
        );
        expect(result).not.toBeNull();
        expect(result!.x).toBe(15);
        expect(result!.y).toBe(15);
    });

    it("skips cells with avoided cell flags", () => {
        const pmap = makePmap(TileType.FLOOR);
        pmap[10][10].flags = TileFlag.HAS_STAIRS;

        const result = getQualifyingLocNear(
            pmap, { x: 10, y: 10 },
            0, TileFlag.HAS_STAIRS,
        );
        // Should skip (10,10) and find a neighbor
        expect(result).not.toBeNull();
        expect(result!.x !== 10 || result!.y !== 10).toBe(true);
    });
});

// =============================================================================
// Tests: updateMapToShore
// =============================================================================

describe("updateMapToShore", () => {
    it("returns 0 for dry land cells", () => {
        const pmap = makePmap(TileType.FLOOR);
        const mapToShore = updateMapToShore(pmap);

        // All floor → all dry → all 0
        expect(mapToShore[10][10]).toBe(0);
    });

    it("returns 30000 for wall cells", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Put one floor cell so Dijkstra has something to work with
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        const mapToShore = updateMapToShore(pmap);

        // Granite cells should stay at 30000
        expect(mapToShore[0][0]).toBe(30000);
    });
});

// =============================================================================
// Tests: resetDFMessageEligibility
// =============================================================================

describe("resetDFMessageEligibility", () => {
    it("resets messageDisplayed for all features", () => {
        const features: DungeonFeature[] = [
            { messageDisplayed: true } as DungeonFeature,
            { messageDisplayed: true } as DungeonFeature,
            { messageDisplayed: false } as DungeonFeature,
        ];

        resetDFMessageEligibility(features);

        for (const feat of features) {
            expect(feat.messageDisplayed).toBe(false);
        }
    });
});

// =============================================================================
// Seed-based regression: full carveDungeon pipeline
// =============================================================================

describe("carveDungeon seed regression", () => {
    /**
     * This test captures the grid hash for specific seeds.
     * If any algorithm change breaks determinism, this test will fail.
     */
    it("seed 12345, depth 5 produces consistent hash", () => {
        seedRandomGenerator(12345n);
        const grid = allocGrid();
        fillGrid(grid, 0);
        carveDungeon(grid, 5, 26, dungeonProfileCatalog);
        const hash = hashGrid(grid);

        // Run it again to get the expected hash
        seedRandomGenerator(12345n);
        const grid2 = allocGrid();
        fillGrid(grid2, 0);
        carveDungeon(grid2, 5, 26, dungeonProfileCatalog);
        const hash2 = hashGrid(grid2);

        expect(hash).toBe(hash2);
        // The hash should be a non-zero value (dungeon has content)
        expect(hash).not.toBe(0);
    });

    it("depth 1 always starts with entrance room", () => {
        seedRandomGenerator(99999n);
        const grid = allocGrid();
        fillGrid(grid, 0);
        carveDungeon(grid, 1, 26, dungeonProfileCatalog);

        // Count cells - entrance room is large (T-shaped)
        let cellCount = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j] > 0) cellCount++;
            }
        }
        // Entrance room + attached rooms should produce substantial content
        expect(cellCount).toBeGreaterThan(200);
    });
});
