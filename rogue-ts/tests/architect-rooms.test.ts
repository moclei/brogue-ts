/*
 *  architect-rooms.test.ts — Tests for room design functions
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    insertRoomAt,
    designCavern,
    designEntranceRoom,
    designCrossRoom,
    designSymmetricalCrossRoom,
    designSmallRoom,
    designCircularRoom,
    designChunkyRoom,
    directionOfDoorSite,
    chooseRandomDoorSites,
    attachHallwayTo,
    designRandomRoom,
    roomFitsAt,
    attachRooms,
} from "../src/architect/rooms.js";
import { Direction } from "../src/types/enums.js";
import { DCOLS, DROWS, ROOM_TYPE_COUNT } from "../src/types/constants.js";
import { allocGrid, fillGrid, validLocationCount, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import type { DungeonProfile } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Count nonzero cells in a grid */
function countNonzero(grid: Grid): number {
    let count = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j]) count++;
        }
    }
    return count;
}

/** Get bounding box of nonzero cells */
function boundingBox(grid: Grid): { minX: number; maxX: number; minY: number; maxY: number } {
    let minX = DCOLS, maxX = 0, minY = DROWS, maxY = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j]) {
                if (i < minX) minX = i;
                if (i > maxX) maxX = i;
                if (j < minY) minY = j;
                if (j > maxY) maxY = j;
            }
        }
    }
    return { minX, maxX, minY, maxY };
}

// =============================================================================
// insertRoomAt
// =============================================================================

describe("insertRoomAt", () => {
    it("copies a 3x3 room from roomMap into dungeonMap at offset", () => {
        const roomMap = allocGrid();
        const dungeonMap = allocGrid();

        // Create a 3x3 room in roomMap
        for (let i = 5; i <= 7; i++) {
            for (let j = 5; j <= 7; j++) {
                roomMap[i][j] = 1;
            }
        }

        // Insert at offset (10, 10) starting from (5, 5)
        insertRoomAt(dungeonMap, roomMap, 10, 10, 5, 5);

        // Check that the room was copied
        for (let i = 15; i <= 17; i++) {
            for (let j = 15; j <= 17; j++) {
                expect(dungeonMap[i][j]).toBe(1);
            }
        }
        // Check that area outside the room is still 0
        expect(dungeonMap[14][15]).toBe(0);
        expect(dungeonMap[18][15]).toBe(0);
    });
});

// =============================================================================
// Room shape generators
// =============================================================================

describe("designEntranceRoom", () => {
    it("creates a non-empty room grid with the T-shape", () => {
        const grid = allocGrid();
        designEntranceRoom(grid);

        const nonzero = countNonzero(grid);
        // Entrance room is two overlapping rectangles: 8×10 + 20×5
        // The total should be significant
        expect(nonzero).toBeGreaterThan(50);

        // Check it's roughly centered
        const bbox = boundingBox(grid);
        const centerX = Math.floor(DCOLS / 2);
        expect(bbox.minX).toBeLessThan(centerX);
        expect(bbox.maxX).toBeGreaterThan(centerX);
    });
});

describe("designSmallRoom", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("creates a small rectangular room", () => {
        const grid = allocGrid();
        designSmallRoom(grid);

        const nonzero = countNonzero(grid);
        // width: 3-6, height: 2-4, so area: 6-24
        expect(nonzero).toBeGreaterThanOrEqual(6);
        expect(nonzero).toBeLessThanOrEqual(24);
    });

    it("is deterministic with same seed", () => {
        const grid1 = allocGrid();
        const grid2 = allocGrid();

        seedRandomGenerator(99n);
        designSmallRoom(grid1);

        seedRandomGenerator(99n);
        designSmallRoom(grid2);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid1[i][j]).toBe(grid2[i][j]);
            }
        }
    });
});

describe("designSymmetricalCrossRoom", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("creates a cross-shaped room", () => {
        const grid = allocGrid();
        designSymmetricalCrossRoom(grid);

        const nonzero = countNonzero(grid);
        expect(nonzero).toBeGreaterThan(0);

        // Should be roughly centered
        const bbox = boundingBox(grid);
        const centerX = Math.floor(DCOLS / 2);
        const centerY = Math.floor(DROWS / 2);
        expect(bbox.minX).toBeLessThan(centerX);
        expect(bbox.maxX).toBeGreaterThan(centerX);
        expect(bbox.minY).toBeLessThan(centerY);
        expect(bbox.maxY).toBeGreaterThan(centerY);
    });
});

describe("designCrossRoom", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("creates a non-empty room", () => {
        const grid = allocGrid();
        designCrossRoom(grid);
        expect(countNonzero(grid)).toBeGreaterThan(0);
    });
});

describe("designCircularRoom", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("creates a non-empty circular room", () => {
        const grid = allocGrid();
        designCircularRoom(grid);
        expect(countNonzero(grid)).toBeGreaterThan(0);
    });
});

describe("designChunkyRoom", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("creates a non-empty chunky room", () => {
        const grid = allocGrid();
        designChunkyRoom(grid);
        expect(countNonzero(grid)).toBeGreaterThan(0);
    });
});

describe("designCavern", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("creates a cavern that fills the grid", () => {
        const grid = allocGrid();
        designCavern(grid, 3, 12, 4, 8);

        const nonzero = countNonzero(grid);
        expect(nonzero).toBeGreaterThan(0);
    });

    it("large cavern fills a significant portion", () => {
        const grid = allocGrid();
        designCavern(grid, 50, DCOLS - 2, 20, DROWS - 2);

        const nonzero = countNonzero(grid);
        expect(nonzero).toBeGreaterThan(100);
    });
});

// =============================================================================
// Door site selection
// =============================================================================

describe("directionOfDoorSite", () => {
    it("returns NoDirection for occupied cells", () => {
        const grid = allocGrid();
        grid[10][10] = 1; // occupied
        expect(directionOfDoorSite(grid, 10, 10)).toBe(Direction.NoDirection);
    });

    it("returns the correct direction for a valid door site", () => {
        const grid = allocGrid();
        // Create a room: row of cells at y=10
        for (let x = 5; x <= 15; x++) {
            grid[x][10] = 1;
        }
        // Cell at (10, 9) is above the room — should be a door facing Up
        const dir = directionOfDoorSite(grid, 10, 9);
        expect(dir).toBe(Direction.Up);
    });

    it("returns Up for a door site north of a room cell", () => {
        const grid = allocGrid();
        // Room at (10, 10)
        grid[10][10] = 1;
        grid[11][10] = 1;
        grid[10][11] = 1;
        // Cell (10, 9) is north of room cell (10, 10).
        // oppDir is south → grid[10][10] = 1 ✓, so the door faces Up (outward).
        const dir = directionOfDoorSite(grid, 10, 9);
        expect(dir).toBe(Direction.Up);
    });

    it("returns NoDirection when cell has room on multiple opposite sides", () => {
        const grid = allocGrid();
        // Room cells on both sides of (10, 10) — not a valid door
        grid[10][10] = 0; // the door candidate
        grid[10][9] = 1;  // north
        grid[10][11] = 1; // south
        // For dir=Up: opp is (10, 11)=1 → solutionDir = Up
        // For dir=Down: opp is (10, 9)=1 → already claimed → NoDirection
        expect(directionOfDoorSite(grid, 10, 10)).toBe(Direction.NoDirection);
    });
});

describe("chooseRandomDoorSites", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("returns 4 door site positions for a simple room", () => {
        const grid = allocGrid();
        // Create a 5×5 room in the center
        for (let i = 35; i <= 39; i++) {
            for (let j = 12; j <= 16; j++) {
                grid[i][j] = 1;
            }
        }

        const doorSites = chooseRandomDoorSites(grid);
        expect(doorSites).toHaveLength(4);

        // At least some directions should have valid door sites
        let validCount = 0;
        for (let d = 0; d < 4; d++) {
            if (doorSites[d].x !== -1 && doorSites[d].y !== -1) {
                validCount++;
            }
        }
        expect(validCount).toBeGreaterThan(0);
    });
});

// =============================================================================
// designRandomRoom
// =============================================================================

describe("designRandomRoom", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("generates a room with door sites", () => {
        const grid = allocGrid();
        const frequencies = [10, 10, 10, 10, 10, 5, 0, 0]; // No caverns or entrance rooms

        const doorSites = designRandomRoom(grid, false, frequencies);
        expect(doorSites).not.toBeNull();
        expect(doorSites!).toHaveLength(4);
        expect(countNonzero(grid)).toBeGreaterThan(0);
    });

    it("respects room type weights", () => {
        // If only small room has weight, we should always get a small room
        const frequencies = [0, 0, 100, 0, 0, 0, 0, 0];

        seedRandomGenerator(42n);
        const grid = allocGrid();
        designRandomRoom(grid, false, frequencies);

        const nonzero = countNonzero(grid);
        // Small room: width 3-6, height 2-4, area 6-24
        expect(nonzero).toBeGreaterThanOrEqual(6);
        expect(nonzero).toBeLessThanOrEqual(24);
    });

    it("is deterministic with same seed", () => {
        const frequencies = [10, 10, 10, 10, 10, 0, 0, 0];

        seedRandomGenerator(42n);
        const grid1 = allocGrid();
        designRandomRoom(grid1, false, frequencies);

        seedRandomGenerator(42n);
        const grid2 = allocGrid();
        designRandomRoom(grid2, false, frequencies);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid1[i][j]).toBe(grid2[i][j]);
            }
        }
    });
});

// =============================================================================
// roomFitsAt
// =============================================================================

describe("roomFitsAt", () => {
    it("returns true when room fits in empty dungeon", () => {
        const dungeonMap = allocGrid();
        const roomMap = allocGrid();
        roomMap[5][5] = 1;
        roomMap[6][5] = 1;
        roomMap[5][6] = 1;
        roomMap[6][6] = 1;

        // Place it in the middle of the dungeon
        expect(roomFitsAt(dungeonMap, roomMap, 20, 10)).toBe(true);
    });

    it("returns false when room overlaps existing dungeon cell", () => {
        const dungeonMap = allocGrid();
        const roomMap = allocGrid();
        roomMap[5][5] = 1;
        roomMap[6][5] = 1;

        // Put something in the dungeon where the room would go
        dungeonMap[25][15] = 1;

        expect(roomFitsAt(dungeonMap, roomMap, 20, 10)).toBe(false);
    });

    it("returns false when room is adjacent to existing dungeon cell", () => {
        const dungeonMap = allocGrid();
        const roomMap = allocGrid();
        roomMap[5][5] = 1;

        // Place a cell adjacent (not overlapping) to where the room would go
        dungeonMap[24][14] = 1; // would be diagonal to (5+20, 5+10)

        expect(roomFitsAt(dungeonMap, roomMap, 20, 10)).toBe(false);
    });

    it("returns false when room extends off map edge", () => {
        const dungeonMap = allocGrid();
        const roomMap = allocGrid();
        roomMap[5][5] = 1;

        // Offset that pushes room to map edge
        expect(roomFitsAt(dungeonMap, roomMap, DCOLS - 5, DROWS - 5)).toBe(false);
    });
});

// =============================================================================
// attachRooms
// =============================================================================

describe("attachRooms", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("builds rooms onto an existing grid", () => {
        const grid = allocGrid();

        // Start with a small room in the center
        for (let i = 35; i <= 40; i++) {
            for (let j = 12; j <= 16; j++) {
                grid[i][j] = 1;
            }
        }

        const profile: DungeonProfile = {
            roomFrequencies: [10, 10, 30, 10, 10, 0, 0, 0],
            corridorChance: 50,
        };

        attachRooms(grid, profile, 100, 10);

        // Should have more cells than we started with
        const nonzero = countNonzero(grid);
        expect(nonzero).toBeGreaterThan(30); // Started with 30 cells
    });

    it("is deterministic with same seed", () => {
        const profile: DungeonProfile = {
            roomFrequencies: [10, 10, 30, 10, 10, 0, 0, 0],
            corridorChance: 50,
        };

        seedRandomGenerator(42n);
        const grid1 = allocGrid();
        for (let i = 35; i <= 40; i++) {
            for (let j = 12; j <= 16; j++) {
                grid1[i][j] = 1;
            }
        }
        attachRooms(grid1, profile, 50, 5);

        seedRandomGenerator(42n);
        const grid2 = allocGrid();
        for (let i = 35; i <= 40; i++) {
            for (let j = 12; j <= 16; j++) {
                grid2[i][j] = 1;
            }
        }
        attachRooms(grid2, profile, 50, 5);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(grid1[i][j]).toBe(grid2[i][j]);
            }
        }
    });

    it("does not exceed maxRoomCount", () => {
        const grid = allocGrid();
        // Start with a large room to provide many door sites
        for (let i = 10; i <= 60; i++) {
            for (let j = 5; j <= 20; j++) {
                grid[i][j] = 1;
            }
        }

        const profile: DungeonProfile = {
            roomFrequencies: [0, 0, 100, 0, 0, 0, 0, 0], // Only small rooms
            corridorChance: 0,
        };

        const initialCells = countNonzero(grid);
        attachRooms(grid, profile, 1000, 2); // Only allow 2 rooms

        // Should have added at most 2 rooms
        const finalCells = countNonzero(grid);
        // 2 small rooms max: 2 * 24 = 48 cells, plus door sites
        expect(finalCells - initialCells).toBeLessThanOrEqual(100);
    });
});
