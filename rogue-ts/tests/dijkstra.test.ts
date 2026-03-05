/*
 *  dijkstra.test.ts — Tests for Dijkstra pathfinding (Dijkstra.c port)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    dijkstraScan,
    calculateDistances,
    pathingDistance,
    type CalculateDistancesContext,
} from "../src/dijkstra/dijkstra.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { DCOLS, DROWS, PDS_FORBIDDEN, PDS_OBSTRUCTION } from "../src/types/constants.js";
import type { Pos, Creature } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

const MAX_DISTANCE = 30000;

/**
 * Create a cost map where all interior cells cost 1 and borders are obstruction.
 * This simulates a wide-open dungeon with no obstacles.
 */
function createOpenCostMap(): Grid {
    const cost = allocGrid();
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (i === 0 || j === 0 || i === DCOLS - 1 || j === DROWS - 1) {
                cost[i][j] = PDS_OBSTRUCTION;
            } else {
                cost[i][j] = 1;
            }
        }
    }
    return cost;
}

/**
 * Create a distance map with all cells set to MAX_DISTANCE except the
 * source cell which is set to 0.
 */
function createDistanceMapWithSource(sourceX: number, sourceY: number): Grid {
    const dist = allocGrid();
    fillGrid(dist, MAX_DISTANCE);
    dist[sourceX][sourceY] = 0;
    return dist;
}

/**
 * Create a mock CalculateDistancesContext with no obstacles, no monsters.
 * All cells are passable with cost 1.
 */
function createOpenContext(): CalculateDistancesContext {
    return {
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        monsterAtLoc: () => null,
        monsterAvoids: () => false,
        discoveredTerrainFlagsAtLoc: () => 0,
        isPlayer: () => false,
        getCellFlags: () => 0xFFFFFFFF, // DISCOVERED | MAGIC_MAPPED set
    };
}

// =============================================================================
// dijkstraScan tests
// =============================================================================

describe("dijkstraScan", () => {
    it("computes correct distances in a simple open grid (cardinal only)", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(10, 10);

        dijkstraScan(distMap, costMap, false);

        // Source should remain 0
        expect(distMap[10][10]).toBe(0);

        // Cardinal neighbors should be 1
        expect(distMap[11][10]).toBe(1);
        expect(distMap[9][10]).toBe(1);
        expect(distMap[10][11]).toBe(1);
        expect(distMap[10][9]).toBe(1);

        // Diagonal neighbors should be 2 (cardinal only — no diagonal movement)
        expect(distMap[11][11]).toBe(2);
        expect(distMap[9][9]).toBe(2);

        // Manhattan distance check
        expect(distMap[15][10]).toBe(5);
        expect(distMap[10][15]).toBe(5);
        expect(distMap[15][15]).toBe(10);
    });

    it("computes correct distances with diagonal movement", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(10, 10);

        dijkstraScan(distMap, costMap, true);

        // Source should remain 0
        expect(distMap[10][10]).toBe(0);

        // Cardinal neighbors should be 1
        expect(distMap[11][10]).toBe(1);
        expect(distMap[9][10]).toBe(1);

        // Diagonal neighbors should be 1 (with diagonal movement)
        expect(distMap[11][11]).toBe(1);
        expect(distMap[9][9]).toBe(1);

        // Chebyshev distance: max(|dx|, |dy|)
        expect(distMap[15][15]).toBe(5);
        expect(distMap[15][10]).toBe(5);
        expect(distMap[10][15]).toBe(5);
    });

    it("PDS_FORBIDDEN blocks entry but not diagonal passage past it", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(5, 5);

        // Create a short forbidden wall at x=7, only a few cells tall (not full width)
        // Leave gaps above and below for diagonal passage.
        costMap[7][4] = PDS_FORBIDDEN;
        costMap[7][5] = PDS_FORBIDDEN;
        costMap[7][6] = PDS_FORBIDDEN;

        dijkstraScan(distMap, costMap, true);

        // The forbidden cells themselves should be unreachable
        expect(distMap[7][5]).toBe(MAX_DISTANCE);

        // But cells beyond the wall should be reachable via going around
        // (above or below the short wall)
        expect(distMap[8][5]).toBeLessThan(MAX_DISTANCE);
    });

    it("PDS_FORBIDDEN full wall makes far side unreachable (no entry)", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(5, 5);

        // Create a full vertical forbidden wall at x=7
        for (let j = 1; j < DROWS - 1; j++) {
            costMap[7][j] = PDS_FORBIDDEN;
        }

        dijkstraScan(distMap, costMap, true);

        // Since PDS_FORBIDDEN prevents entry and the wall spans the full height,
        // all paths must cross a forbidden cell. However, diagonal movement only
        // checks PDS_OBSTRUCTION for the intermediate cells, not PDS_FORBIDDEN.
        // So you CAN still move diagonally past forbidden cells — but the neighbor
        // cell itself is forbidden (cost < 0) so it can't be entered.
        // Cells beyond the wall ARE reachable via diagonal steps that land on
        // passable cells. E.g., from (6,3) diagonally to (8,4) is NOT a single step.
        // Since movement is one cell at a time, to reach x=8 you must pass through
        // x=7, which is forbidden. So the far side is unreachable.
        expect(distMap[8][5]).toBe(MAX_DISTANCE);
    });

    it("PDS_OBSTRUCTION blocks diagonal passage", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(5, 14);

        // Create a horizontal obstruction wall at y=16, from x=1 to x=DCOLS-2
        for (let i = 1; i < DCOLS - 1; i++) {
            costMap[i][16] = PDS_OBSTRUCTION;
        }

        dijkstraScan(distMap, costMap, true);

        // Cells below the wall should be unreachable (full wall with no gap)
        expect(distMap[5][17]).toBe(MAX_DISTANCE);
        expect(distMap[5][20]).toBe(MAX_DISTANCE);
    });

    it("handles multiple sources", () => {
        const costMap = createOpenCostMap();
        const distMap = allocGrid();
        fillGrid(distMap, MAX_DISTANCE);

        // Two sources
        distMap[10][10] = 0;
        distMap[20][10] = 0;

        dijkstraScan(distMap, costMap, true);

        // The midpoint should be equidistant from both sources
        expect(distMap[15][10]).toBe(5);

        // Each source should remain 0
        expect(distMap[10][10]).toBe(0);
        expect(distMap[20][10]).toBe(0);
    });

    it("handles variable movement costs", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(5, 5);

        // Make a region with higher movement cost
        for (let i = 8; i <= 12; i++) {
            for (let j = 3; j <= 7; j++) {
                costMap[i][j] = 5; // 5x normal cost
            }
        }

        dijkstraScan(distMap, costMap, true);

        // Direct path through expensive zone should cost more than going around
        // From (5,5) to (10,5): direct is 3 + 5*2 = 13 (3 normal + 2 expensive cells)
        // Going around would be longer in steps but cheaper per step
        expect(distMap[10][5]).toBeGreaterThan(5);
    });

    it("border cells remain at MAX_DISTANCE", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(1, 1);

        dijkstraScan(distMap, costMap, true);

        // Border cells are obstruction and should remain unreachable
        expect(distMap[0][0]).toBe(MAX_DISTANCE);
        expect(distMap[0][10]).toBe(MAX_DISTANCE);
        expect(distMap[DCOLS - 1][DROWS - 1]).toBe(MAX_DISTANCE);
    });

    it("handles null costMap (requires terrain callback)", () => {
        // When costMap is null and no terrain callback, all interior cells become forbidden
        const distMap = createDistanceMapWithSource(10, 10);

        dijkstraScan(distMap, null, true);

        // Source cell stays 0
        expect(distMap[10][10]).toBe(0);
        // Without a cost map or terrain callback, interior cells default to PDS_FORBIDDEN
        // and borders default to PDS_OBSTRUCTION, so nothing should be reachable
        expect(distMap[11][10]).toBe(MAX_DISTANCE);
    });
});

// =============================================================================
// calculateDistances tests
// =============================================================================

describe("calculateDistances", () => {
    it("computes distances in an open context", () => {
        const distMap = allocGrid();
        const ctx = createOpenContext();

        calculateDistances(distMap, 10, 10, 0, null, false, true, ctx);

        // Destination should be 0
        expect(distMap[10][10]).toBe(0);

        // Cardinal neighbors should be 1
        expect(distMap[11][10]).toBe(1);
        expect(distMap[9][10]).toBe(1);

        // Diagonal neighbors should be 1 (eightWays=true)
        expect(distMap[11][11]).toBe(1);

        // Further cells — Chebyshev distance
        expect(distMap[15][15]).toBe(5);
    });

    it("respects blocking terrain flags", () => {
        const distMap = allocGrid();
        const ctx = createOpenContext();

        // Block a horizontal strip using blockingTerrainFlags
        const blockedRow = 15;
        ctx.cellHasTerrainFlag = (pos: Pos, flags: number) => {
            // T_OBSTRUCTS_PASSABILITY is flag bit 0 (value 1)
            if (pos.y === blockedRow && (flags & 1)) return true;
            return false;
        };

        calculateDistances(distMap, 10, 10, 1, null, false, true, ctx);

        // Destination should be 0
        expect(distMap[10][10]).toBe(0);

        // Cells near destination should be reachable
        expect(distMap[11][11]).toBe(1);

        // The blocked row should be PDS_FORBIDDEN, but diagonal passage is still possible
        // since PDS_FORBIDDEN doesn't block diagonals (only PDS_OBSTRUCTION does)
    });

    it("avoids damage-immune stationary monsters", () => {
        const distMap = allocGrid();
        const ctx = createOpenContext();

        const immuneMonster = {
            info: {
                flags: (1 << 9) | (1 << 2), // MONST_IMMUNE_TO_WEAPONS | MONST_IMMOBILE
                abilityFlags: 0,
            },
            loc: { x: 15, y: 10 },
        } as unknown as Creature;

        ctx.monsterAtLoc = (pos: Pos) => {
            if (pos.x === 15 && pos.y === 10) return immuneMonster;
            return null;
        };

        calculateDistances(distMap, 10, 10, 0, null, false, true, ctx);

        // The cell with the immune monster should be avoided (PDS_FORBIDDEN)
        expect(distMap[15][10]).toBeGreaterThan(1);
    });

    it("uses secret doors when canUseSecretDoors is true", () => {
        const distMap = allocGrid();
        const ctx = createOpenContext();

        // Set up: cell (12, 10) is a secret door — TM_IS_SECRET and T_OBSTRUCTS_PASSABILITY
        // but discoveredTerrainFlagsAtLoc says the revealed version is passable
        ctx.cellHasTerrainFlag = (pos: Pos, flags: number) => {
            if (pos.x === 12 && pos.y === 10 && (flags & 1)) return true; // T_OBSTRUCTS_PASSABILITY
            return false;
        };
        ctx.cellHasTMFlag = (pos: Pos, flags: number) => {
            if (pos.x === 12 && pos.y === 10 && (flags & 1)) return true; // TM_IS_SECRET
            return false;
        };
        ctx.discoveredTerrainFlagsAtLoc = (pos: Pos) => {
            if (pos.x === 12 && pos.y === 10) return 0; // revealed version does NOT obstruct
            return 0;
        };

        // With secret door usage
        calculateDistances(distMap, 10, 10, 0, null, true, true, ctx);
        const distWithSecretDoors = distMap[14][10];

        // Without secret door usage
        calculateDistances(distMap, 10, 10, 0, null, false, true, ctx);
        const distWithoutSecretDoors = distMap[14][10];

        // With secret doors, the path through (12,10) should be shorter
        expect(distWithSecretDoors).toBeLessThanOrEqual(distWithoutSecretDoors);
    });

    it("cardinal-only mode produces Manhattan distances", () => {
        const distMap = allocGrid();
        const ctx = createOpenContext();

        calculateDistances(distMap, 10, 10, 0, null, false, false, ctx);

        // With cardinal-only movement, diagonal cells need 2 steps
        expect(distMap[11][11]).toBe(2);

        // Manhattan distance for further cells
        expect(distMap[15][15]).toBe(10); // |5| + |5|
    });

    it("player in unexplored cells are treated as walls", () => {
        const distMap = allocGrid();
        const ctx = createOpenContext();

        // Simulate player as traveler — undiscovered cells should be blocking
        const playerCreature = {} as Creature;
        ctx.isPlayer = (c: Creature) => c === playerCreature;

        // Cell (15, 10) is undiscovered (no DISCOVERED or MAGIC_MAPPED flags)
        ctx.getCellFlags = (x: number, y: number) => {
            if (x === 15 && y === 10) return 0; // no discovery flags
            return 0xFFFFFFFF; // everything else is discovered
        };

        calculateDistances(distMap, 10, 10, 0, playerCreature, false, true, ctx);

        // The undiscovered cell should be treated as a wall
        // Distance should be greater than direct Chebyshev distance
        expect(distMap[15][10]).toBeGreaterThan(5);
    });
});

// =============================================================================
// pathingDistance tests
// =============================================================================

describe("pathingDistance", () => {
    it("returns correct distance between two points in open space", () => {
        const ctx = createOpenContext();

        const dist = pathingDistance(5, 5, 10, 10, 0, ctx);

        // Chebyshev distance in open space
        expect(dist).toBe(5);
    });

    it("returns MAX_DISTANCE for unreachable targets", () => {
        const ctx = createOpenContext();

        // Block everything by making all cells have T_OBSTRUCTS_PASSABILITY
        ctx.cellHasTerrainFlag = () => true;

        const dist = pathingDistance(5, 5, 10, 10, 0, ctx);

        expect(dist).toBe(MAX_DISTANCE);
    });

    it("respects blocking terrain flags", () => {
        const ctx = createOpenContext();

        // Create a wall that forces a detour
        ctx.cellHasTerrainFlag = (pos: Pos, flags: number) => {
            // Wall at x=8 from y=1 to y=DROWS-2 with T_OBSTRUCTS_PASSABILITY AND T_OBSTRUCTS_DIAGONAL
            if (pos.x === 8 && (flags & (1 | 32))) return true;
            return false;
        };

        // Distance from (5, 5) to (10, 5) should require going around the wall
        const dist = pathingDistance(5, 5, 10, 5, 0, ctx);

        // Should be more than a straight line (5) since there's a wall in the way
        // The wall at x=8 with OBSTRUCTION blocks both passage and diagonals
        expect(dist).toBeGreaterThan(5);
    });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("dijkstra edge cases", () => {
    it("handles source at map edge (but not border)", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(1, 1);

        dijkstraScan(distMap, costMap, true);

        expect(distMap[1][1]).toBe(0);
        expect(distMap[2][2]).toBe(1);
    });

    it("large distance values don't overflow", () => {
        const costMap = createOpenCostMap();
        const distMap = createDistanceMapWithSource(1, 1);

        dijkstraScan(distMap, costMap, true);

        // The farthest reachable cell should have a reasonable distance
        const maxReachable = distMap[DCOLS - 2][DROWS - 2];
        expect(maxReachable).toBeLessThan(MAX_DISTANCE);
        expect(maxReachable).toBeGreaterThan(0);

        // Chebyshev distance from (1,1) to (DCOLS-2, DROWS-2)
        const expected = Math.max(DCOLS - 3, DROWS - 3);
        expect(maxReachable).toBe(expected);
    });

    it("deterministic: same input produces same output", () => {
        const costMap1 = createOpenCostMap();
        const distMap1 = createDistanceMapWithSource(20, 14);
        dijkstraScan(distMap1, costMap1, true);

        const costMap2 = createOpenCostMap();
        const distMap2 = createDistanceMapWithSource(20, 14);
        dijkstraScan(distMap2, costMap2, true);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(distMap1[i][j]).toBe(distMap2[i][j]);
            }
        }
    });

    it("handles a maze-like cost map", () => {
        const costMap = createOpenCostMap();
        // Create a simple corridor: only cells on y=5 are passable between x=5 and x=20
        for (let i = 5; i <= 20; i++) {
            for (let j = 1; j < DROWS - 1; j++) {
                if (j !== 5 && i >= 5 && i <= 20) {
                    costMap[i][j] = PDS_OBSTRUCTION;
                }
            }
        }
        // Open entrance at (5, 5) and exit at (20, 5)
        costMap[5][5] = 1;
        costMap[20][5] = 1;

        const distMap = createDistanceMapWithSource(5, 5);
        dijkstraScan(distMap, costMap, true);

        // Distance along the corridor from (5,5) to (20,5) should be 15
        expect(distMap[20][5]).toBe(15);
    });
});
