/*
 *  architect-level-setup.test.ts — Phase 5b: Architect.c top-level orchestrators
 *  brogue-ts
 *
 *  NEEDS-VERIFICATION review for:
 *    refreshWaypoint, setUpWaypoints, placeStairs, initializeLevel,
 *    redesignInterior, abortItemsAndMonsters,
 *    digDungeon, addMachines, runAutogenerators, buildAMachine
 *
 *  All 10 functions reviewed against C source (Architect.c).
 *  Direct tests are added where contexts can be mocked feasibly.
 *  Orchestrators requiring full MachineContext are documented with test.skip
 *  noting that seed-determinism.test.ts + architect-machines.test.ts provide
 *  adequate regression coverage.
 */

import { describe, it, expect } from "vitest";
import {
    refreshWaypoint,
    setUpWaypoints,
    placeStairs,
    initializeLevel,
} from "../src/architect/architect.js";
import { redesignInterior } from "../src/architect/machines.js";
import { TileType, DungeonLayer, CreatureState } from "../src/types/enums.js";
import {
    DCOLS, DROWS, NUMBER_TERRAIN_LAYERS, MAX_WAYPOINT_COUNT,
} from "../src/types/constants.js";
import { TileFlag, TerrainFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag } from "../src/types/flags.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import { PDS_OBSTRUCTION, PDS_FORBIDDEN } from "../src/types/constants.js";
import type { Pcell, CellDisplayBuffer, DungeonProfile, Pos } from "../src/types/types.js";

// =============================================================================
// Shared helpers
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

function makeLevel(opts: Partial<{ upStairsLoc: Pos; downStairsLoc: Pos; playerExitedVia: Pos; visited: boolean }> = {}): {
    upStairsLoc: Pos;
    downStairsLoc: Pos;
    playerExitedVia: Pos;
    visited: boolean;
} {
    return {
        upStairsLoc: opts.upStairsLoc ?? { x: 10, y: 14 },
        downStairsLoc: opts.downStairsLoc ?? { x: 50, y: 14 },
        playerExitedVia: opts.playerExitedVia ?? { x: 0, y: 0 },
        visited: opts.visited ?? false,
    };
}

/** Mock populateGenericCostMap: fill all cells with 1 (all passable). */
function mockPopulateCostMap(costMap: Grid): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            costMap[i][j] = 1;
        }
    }
}

/** Mock getFOVMask: marks the entire grid as visible (for deterministic tests). */
function mockGetFOVMaskAll(grid: Grid, _x: number, _y: number, ..._args: unknown[]): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            grid[i][j] = 1;
        }
    }
}

/** Mock getFOVMask: marks only the exact cell as visible. */
function mockGetFOVMaskSelf(grid: Grid, x: number, y: number, ..._args: unknown[]): void {
    grid[x][y] = 1;
}

// =============================================================================
// Tests: refreshWaypoint
// =============================================================================

describe("refreshWaypoint", () => {
    it("sets origin distance to 0 and fills outward distances", () => {
        // Simple floor pmap — cost map all 1s
        const wpDistance = allocGrid();
        fillGrid(wpDistance, 0);
        const wpCoord: Pos = { x: 20, y: 10 };

        refreshWaypoint(wpDistance, wpCoord, mockPopulateCostMap);

        // Origin must be 0
        expect(wpDistance[20][10]).toBe(0);
        // Adjacent cells should have distance 1 (direct neighbors)
        expect(wpDistance[21][10]).toBe(1);
        expect(wpDistance[19][10]).toBe(1);
        expect(wpDistance[20][11]).toBe(1);
        expect(wpDistance[20][9]).toBe(1);
    });

    it("fills from a different origin", () => {
        const wpDistance = allocGrid();
        fillGrid(wpDistance, 0);
        const wpCoord: Pos = { x: 5, y: 5 };

        refreshWaypoint(wpDistance, wpCoord, mockPopulateCostMap);

        expect(wpDistance[5][5]).toBe(0);
        expect(wpDistance[6][5]).toBe(1);
        // Cell 10 steps away should have distance ~10
        expect(wpDistance[15][5]).toBe(10);
    });

    it("respects PDS_OBSTRUCTION in cost map (walls are impassable)", () => {
        const wpDistance = allocGrid();
        fillGrid(wpDistance, 0);
        const wpCoord: Pos = { x: 20, y: 10 };

        // Cost map that blocks column 25
        function blockedCostMap(costMap: Grid): void {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    costMap[i][j] = (i === 25) ? PDS_OBSTRUCTION : 1;
                }
            }
        }

        refreshWaypoint(wpDistance, wpCoord, blockedCostMap);

        // Column 25 itself — PDS_OBSTRUCTION means impassable
        // Cells past the block (x > 25) should have very high distance
        expect(wpDistance[26][10]).toBeGreaterThan(100);
    });
});

// =============================================================================
// Tests: setUpWaypoints
// =============================================================================

describe("setUpWaypoints", () => {
    it("returns at least one waypoint for a floor map", () => {
        seedRandomGenerator(42n);
        const pmap = makePmap(TileType.FLOOR);

        // FOV that covers everything: first waypoint placed covers all cells
        const { wpCoordinates, wpDistance } = setUpWaypoints(
            pmap,
            mockPopulateCostMap,
            mockGetFOVMaskAll,
        );

        // Should place at least one waypoint
        expect(wpCoordinates.length).toBeGreaterThan(0);
        expect(wpDistance.length).toBe(wpCoordinates.length);
    });

    it("respects MAX_WAYPOINT_COUNT upper bound", () => {
        seedRandomGenerator(99n);
        const pmap = makePmap(TileType.FLOOR);

        // FOV that covers only the origin cell: each waypoint covers little, forcing many
        const { wpCoordinates } = setUpWaypoints(
            pmap,
            mockPopulateCostMap,
            mockGetFOVMaskSelf,
        );

        expect(wpCoordinates.length).toBeLessThanOrEqual(MAX_WAYPOINT_COUNT);
    });

    it("returns one distance map per waypoint coordinate", () => {
        seedRandomGenerator(777n);
        const pmap = makePmap(TileType.FLOOR);

        const { wpCoordinates, wpDistance } = setUpWaypoints(
            pmap,
            mockPopulateCostMap,
            mockGetFOVMaskAll,
        );

        expect(wpDistance.length).toBe(wpCoordinates.length);
        // Each distance map has origin=0 at its waypoint
        for (let i = 0; i < wpCoordinates.length; i++) {
            const { x, y } = wpCoordinates[i];
            expect(wpDistance[i][x][y]).toBe(0);
        }
    });
});

// =============================================================================
// Tests: placeStairs
// =============================================================================

describe("placeStairs", () => {
    it("places DUNGEON_EXIT + DOWN_STAIRS on depth 1 with a floor pmap", () => {
        const pmap = makePmap(TileType.FLOOR);
        const levels = [
            makeLevel({ upStairsLoc: { x: 10, y: 14 }, downStairsLoc: { x: 50, y: 14 } }),
            makeLevel({ visited: false }),
        ];

        const result = placeStairs(pmap, levels, 1, 26);

        expect(result).not.toBeNull();
        const { upStairsLoc, downStairsLoc } = result!;

        // Depth 1: up stair = DUNGEON_EXIT
        expect(pmap[upStairsLoc.x][upStairsLoc.y].layers[DungeonLayer.Dungeon])
            .toBe(TileType.DUNGEON_EXIT);
        // Not deepest level: down stair = DOWN_STAIRS
        expect(pmap[downStairsLoc.x][downStairsLoc.y].layers[DungeonLayer.Dungeon])
            .toBe(TileType.DOWN_STAIRS);

        // Both locs marked HAS_STAIRS
        expect(pmap[upStairsLoc.x][upStairsLoc.y].flags & TileFlag.HAS_STAIRS).toBeTruthy();
        expect(pmap[downStairsLoc.x][downStairsLoc.y].flags & TileFlag.HAS_STAIRS).toBeTruthy();
    });

    it("places DUNGEON_PORTAL at deepest level", () => {
        const pmap = makePmap(TileType.FLOOR);
        // Use depthLevel=1, deepestLevel=1 to hit the deepestLevel portal branch
        // with a minimal levels array (n = depthLevel-1 = 0)
        const levels = [
            makeLevel({ upStairsLoc: { x: 10, y: 14 }, downStairsLoc: { x: 50, y: 14 } }),
        ];

        const result = placeStairs(pmap, levels, 1, 1); // depthLevel === deepestLevel

        expect(result).not.toBeNull();
        expect(pmap[result!.downStairsLoc.x][result!.downStairsLoc.y].layers[DungeonLayer.Dungeon])
            .toBe(TileType.DUNGEON_PORTAL);
    });

    it("returns null when the entire pmap is granite (no valid placement)", () => {
        const pmap = makePmap(TileType.GRANITE);
        const levels = [
            makeLevel(),
            makeLevel({ visited: false }),
        ];

        const result = placeStairs(pmap, levels, 1, 26);
        expect(result).toBeNull();
    });

    it("updates levels[n+1].upStairsLoc to match the down stairs location (on unvisited next level)", () => {
        const pmap = makePmap(TileType.FLOOR);
        const levels = [
            makeLevel({ downStairsLoc: { x: 50, y: 14 } }),
            makeLevel({ visited: false, upStairsLoc: { x: 0, y: 0 } }),
        ];

        const result = placeStairs(pmap, levels, 1, 26);

        expect(result).not.toBeNull();
        // The next level's upStairsLoc should be updated to the actual downLoc
        expect(levels[1].upStairsLoc).toEqual(result!.downStairsLoc);
    });
});

// =============================================================================
// Tests: initializeLevel
// =============================================================================

describe("initializeLevel", () => {
    it("calls populate callbacks on first visit", () => {
        const pmap = makePmap(TileType.FLOOR);
        const upStairsLoc: Pos = { x: 10, y: 14 };
        const levels = [{ visited: false }];

        let itemsCalled = false;
        let monstersCalled = false;

        initializeLevel(
            pmap,
            upStairsLoc,
            1,
            levels,
            mockGetFOVMaskAll,
            (_upLoc) => { itemsCalled = true; },
            () => { monstersCalled = true; },
        );

        expect(itemsCalled).toBe(true);
        expect(monstersCalled).toBe(true);
    });

    it("does not call populate callbacks on revisit", () => {
        const pmap = makePmap(TileType.FLOOR);
        const upStairsLoc: Pos = { x: 10, y: 14 };
        const levels = [{ visited: true }];

        let itemsCalled = false;
        let monstersCalled = false;

        initializeLevel(
            pmap,
            upStairsLoc,
            1,
            levels,
            mockGetFOVMaskAll,
            () => { itemsCalled = true; },
            () => { monstersCalled = true; },
        );

        expect(itemsCalled).toBe(false);
        expect(monstersCalled).toBe(false);
    });

    it("sets IN_FIELD_OF_VIEW on visible cells (first visit)", () => {
        const pmap = makePmap(TileType.FLOOR);
        const upStairsLoc: Pos = { x: 10, y: 14 };
        const levels = [{ visited: false }];

        initializeLevel(
            pmap,
            upStairsLoc,
            1,
            levels,
            mockGetFOVMaskAll,
        );

        // With mockGetFOVMaskAll, every cell is visible
        let fovCount = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (pmap[i][j].flags & TileFlag.IN_FIELD_OF_VIEW) fovCount++;
            }
        }
        expect(fovCount).toBe(DCOLS * DROWS);
    });

    it("does not set IN_FIELD_OF_VIEW on revisit", () => {
        const pmap = makePmap(TileType.FLOOR);
        const upStairsLoc: Pos = { x: 10, y: 14 };
        const levels = [{ visited: true }];

        initializeLevel(
            pmap,
            upStairsLoc,
            1,
            levels,
            mockGetFOVMaskAll,
        );

        let fovCount = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (pmap[i][j].flags & TileFlag.IN_FIELD_OF_VIEW) fovCount++;
            }
        }
        expect(fovCount).toBe(0);
    });
});

// =============================================================================
// Tests: redesignInterior
// =============================================================================

describe("redesignInterior", () => {
    it("converts the origin cell to FLOOR after room carving", () => {
        seedRandomGenerator(12345n);
        const pmap = makePmap(TileType.GRANITE);

        // Mark a 20×12 region as interior, centered near (40, 14)
        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 30; i < 50; i++) {
            for (let j = 8; j < 20; j++) {
                interior[i][j] = 1;
            }
        }
        const originX = 40;
        const originY = 14;

        const dungeonProfile: DungeonProfile = {
            roomFrequencies: [2, 2, 1, 1, 1, 0, 0, 0],
            corridorChance: 30,
        };

        redesignInterior(pmap, interior, originX, originY, dungeonProfile);

        // The origin is guaranteed to become FLOOR (it starts as grid=1)
        expect(pmap[originX][originY].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
    });

    it("leaves non-interior cells unchanged", () => {
        seedRandomGenerator(99n);
        const pmap = makePmap(TileType.GRANITE);

        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 30; i < 50; i++) {
            for (let j = 8; j < 20; j++) {
                interior[i][j] = 1;
            }
        }

        const dungeonProfile: DungeonProfile = {
            roomFrequencies: [2, 2, 1, 1, 1, 0, 0, 0],
            corridorChance: 30,
        };

        redesignInterior(pmap, interior, 40, 14, dungeonProfile);

        // Non-interior cells stay granite
        expect(pmap[0][0].layers[DungeonLayer.Dungeon]).toBe(TileType.GRANITE);
        expect(pmap[78][28].layers[DungeonLayer.Dungeon]).toBe(TileType.GRANITE);
    });
});

// =============================================================================
// Coverage notes: orchestrators requiring MachineContext/ArchitectContext
// (covered by seed-determinism.test.ts and architect-machines.test.ts)
// =============================================================================

it.skip("coverage: abortItemsAndMonsters is private; tested only via buildAMachine failure paths", () => {
    // DEFER: coverage only; tested via buildAMachine failure paths.
    // C: Architect.c:470 — abortItemsAndMonsters(spawnedItems, spawnedMonsters)
    // machines.ts:1819 — private function, not exported.
    // TS implementation VERIFIED MATCH: iterates items (remove from floorItems/packItems,
    // clear monster carriedItem ref, deleteItem, null slot), then kills each monster.
    // Called when buildAMachine fails; no direct test possible without full MachineContext.
});

it.skip("coverage: buildAMachine is covered by seed-determinism.test.ts (full digDungeon pipeline)", () => {
    // DEFER: covered by seed-determinism.test.ts full digDungeon pipeline.
    // C: Architect.c:984 — buildAMachine(bp, originX, originY, requiredFlags, ...)
    // machines.ts:1162 — ~700-line function.
    // TS implementation has a real port. NEEDS-VERIFICATION: seed-determinism tests
    // exercise this function end-to-end (digDungeon → addMachines → buildAMachine).
    // Direct unit test would require a full MachineContext with ~20 callbacks mocked.
    // Regression risk is mitigated by seed-determinism parity with C.
});

it.skip("coverage: addMachines is covered by seed-determinism.test.ts; note Bullet Brogue variant gap", () => {
    // DEFER: covered by seed-determinism.test.ts.
    // C: Architect.c:1732 — addMachines()
    // machines.ts:1852 — NEAR MATCH.
    // DIVERGENCE (minor, variant-specific): C includes a special Bullet Brogue path
    //   `if (gameVariant == VARIANT_BULLET_BROGUE && depthLevel == 1) { buildAMachine(MT_REWARD_HEAVY_OR_RUNIC_WEAPON, ...) }`
    // TS omits this because VARIANT_BULLET_BROGUE is not implemented.
    // No behavioral impact for standard game. Full machine context required for direct test.
});

it.skip("coverage: runAutogenerators is covered by seed-determinism.test.ts", () => {
    // DEFER: covered by seed-determinism.test.ts.
    // C: Architect.c:1780 — runAutogenerators(buildAreaMachines)
    // machines.ts:1902 — VERIFIED MATCH.
    // Full MachineContext required for direct test; exercised by digDungeon pipeline.
});

it.skip("coverage: digDungeon is covered by seed-determinism.test.ts; note blob global reset gap", () => {
    // DEFER: covered by seed-determinism.test.ts.
    // C: Architect.c:2877 — digDungeon()
    // architect.ts:230 — VERIFIED MATCH structurally.
    // MINOR GAP: C resets `topBlobMinX = topBlobMinY = blobWidth = blobHeight = 0` before carving.
    // TS skips this — these are blob-shape bookkeeping globals used only within room-carving
    // (rooms.ts) and reset at each call, so the omission has no runtime effect.
    // Full ArchitectContext (many callbacks) required for direct test.
});

it("refreshWaypoint marks sleeping/immobile/captive monsters as PDS_FORBIDDEN", () => {
    // C: Architect.c:3019 — sleeping, immobile, or captive monsters are marked
    // PDS_FORBIDDEN so other monsters path around them.
    const wpDistance = allocGrid();
    const wpCoord = { x: 5, y: 5 };

    // Flat cost map: all cells passable (cost = 1)
    const mockPopulateCostMap = (costMap: number[][]) => {
        for (let i = 0; i < DCOLS; i++)
            for (let j = 0; j < DROWS; j++)
                costMap[i][j] = 1;
    };

    const makeMonster = (x: number, y: number, state: CreatureState, infoFlags = 0, bkFlags = 0) => ({
        loc: { x, y },
        creatureState: state,
        info: { flags: infoFlags },
        bookkeepingFlags: bkFlags,
    } as unknown as import("../src/types/types.js").Creature);

    const monsters = [
        makeMonster(2, 2, CreatureState.Sleeping),                                        // sleeping → forbidden
        makeMonster(3, 3, CreatureState.Wandering, MonsterBehaviorFlag.MONST_IMMOBILE),   // immobile → forbidden
        makeMonster(4, 4, CreatureState.Wandering, 0, MonsterBookkeepingFlag.MB_CAPTIVE), // captive → forbidden
        makeMonster(6, 6, CreatureState.Wandering),                                       // normal → not forbidden
    ];

    refreshWaypoint(wpDistance, wpCoord, mockPopulateCostMap, monsters);

    // Sleeping/immobile/captive cells → costMap set to PDS_FORBIDDEN → Dijkstra leaves them at 30000 (unreachable)
    expect(wpDistance[2][2]).toBe(30000);  // sleeping
    expect(wpDistance[3][3]).toBe(30000);  // immobile
    expect(wpDistance[4][4]).toBe(30000);  // captive
    // Normal monster → costMap = 1 → reachable, distance < 30000
    expect(wpDistance[6][6]).toBeLessThan(30000);
});
