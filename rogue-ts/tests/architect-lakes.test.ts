/*
 *  architect-lakes.test.ts — Tests for lakes, bridges, wall/door finishing
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    finishWalls,
    liquidType,
    fillLake,
    lakeDisruptsPassability,
    designLakes,
    createWreath,
    fillLakes,
    finishDoors,
    buildABridge,
    cleanUpLakeBoundaries,
    removeDiagonalOpenings,
} from "../src/architect/lakes.js";
import { TileType, DungeonLayer } from "../src/types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import { TileFlag } from "../src/types/flags.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import type { Pcell, CellDisplayBuffer, GameConstants } from "../src/types/types.js";

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

/** Default game constants for testing */
const testGameConst: GameConstants = {
    majorVersion: 1,
    minorVersion: 15,
    patchVersion: 1,
    variantName: "brogue",
    versionString: "1.15.1",
    dungeonVersionString: "1.15.1",
    patchVersionPattern: "",
    recordingVersionString: "",
    deepestLevel: 26,
    amuletLevel: 26,
    depthAccelerator: 10,
    minimumAltarLevel: 5,
    minimumLavaLevel: 3,
    minimumBrimstoneLevel: 15,
    mutationsOccurAboveLevel: 4,
    monsterOutOfDepthChance: 0,
    extraItemsPerLevel: 0,
    goldAdjustmentStartDepth: 5,
    machinesPerLevelSuppressionMultiplier: 20,
    machinesPerLevelSuppressionOffset: 20,
    machinesPerLevelIncreaseFactor: 80,
    maxLevelForBonusMachines: 10,
    deepestLevelForMachines: 24,
    playerTransferenceRatio: 10,
    onHitHallucinateDuration: 20,
};

// =============================================================================
// finishWalls
// =============================================================================

describe("finishWalls", () => {
    it("converts granite adjacent to floor into walls", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Place a floor cell — its granite neighbors should become walls
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        finishWalls(pmap, false);

        // Cardinal neighbors should be WALL
        expect(pmap[9][10].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
        expect(pmap[11][10].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
        expect(pmap[10][9].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
        expect(pmap[10][11].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);

        // Further away should still be granite
        expect(pmap[8][10].layers[DungeonLayer.Dungeon]).toBe(TileType.GRANITE);
    });

    it("converts granite diagonal neighbors to walls when includingDiagonals=true", () => {
        const pmap = makePmap(TileType.GRANITE);
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        finishWalls(pmap, true);

        // Diagonal neighbors should also be WALL
        expect(pmap[9][9].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
        expect(pmap[11][11].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
    });

    it("reverts walls not adjacent to non-obstructing cells back to granite", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Place a lone wall cell surrounded by granite
        pmap[20][20].layers[DungeonLayer.Dungeon] = TileType.WALL;

        finishWalls(pmap, false);

        // Should revert to granite since no floor nearby
        expect(pmap[20][20].layers[DungeonLayer.Dungeon]).toBe(TileType.GRANITE);
    });
});

// =============================================================================
// liquidType
// =============================================================================

describe("liquidType", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("returns water on deepest level", () => {
        const result = liquidType(26, testGameConst);
        expect(result.deep).toBe(TileType.DEEP_WATER);
        expect(result.shallow).toBe(TileType.SHALLOW_WATER);
        expect(result.shallowWidth).toBe(2);
    });

    it("excludes lava on early levels", () => {
        // Level 1 is before minimumLavaLevel (3), so no lava
        seedRandomGenerator(1n);
        const results: TileType[] = [];
        for (let i = 0; i < 50; i++) {
            seedRandomGenerator(BigInt(i * 1000));
            results.push(liquidType(1, testGameConst).deep);
        }
        // Should never get LAVA
        expect(results.includes(TileType.LAVA)).toBe(false);
    });

    it("excludes brimstone before minimum brimstone level", () => {
        seedRandomGenerator(1n);
        const results: TileType[] = [];
        for (let i = 0; i < 50; i++) {
            seedRandomGenerator(BigInt(i * 1000));
            results.push(liquidType(5, testGameConst).deep);
        }
        // Level 5 is before minimumBrimstoneLevel (15), so no brimstone
        expect(results.includes(TileType.INERT_BRIMSTONE)).toBe(false);
    });
});

// =============================================================================
// fillLake
// =============================================================================

describe("fillLake", () => {
    it("fills connected lake cells with liquid", () => {
        const pmap = makePmap(TileType.FLOOR);
        const wreathMap = allocGrid();
        const lakeMap = allocGrid();

        // Create a small lake region
        lakeMap[10][10] = 1;
        lakeMap[11][10] = 1;
        lakeMap[10][11] = 1;

        fillLake(pmap, 10, 10, TileType.DEEP_WATER, 4, wreathMap, lakeMap);

        // All lake cells should now have DEEP_WATER on liquid layer
        expect(pmap[10][10].layers[DungeonLayer.Liquid]).toBe(TileType.DEEP_WATER);
        expect(pmap[11][10].layers[DungeonLayer.Liquid]).toBe(TileType.DEEP_WATER);
        expect(pmap[10][11].layers[DungeonLayer.Liquid]).toBe(TileType.DEEP_WATER);

        // Wreath map should be marked
        expect(wreathMap[10][10]).toBe(1);
        expect(wreathMap[11][10]).toBe(1);
        expect(wreathMap[10][11]).toBe(1);

        // Lake map should be cleared
        expect(lakeMap[10][10]).toBe(0);
        expect(lakeMap[11][10]).toBe(0);
        expect(lakeMap[10][11]).toBe(0);
    });
});

// =============================================================================
// lakeDisruptsPassability
// =============================================================================

describe("lakeDisruptsPassability", () => {
    it("returns false when lake doesn't disconnect the level", () => {
        const pmap = makePmap(TileType.GRANITE);
        carveRoom(pmap, 2, 2, 20, 20);

        const grid = allocGrid();
        const lakeMap = allocGrid();

        // Place a small lake that doesn't cut off any area
        lakeMap[10][10] = 1;
        lakeMap[11][10] = 1;

        const result = lakeDisruptsPassability(pmap, grid, lakeMap, 0, 0);
        expect(result).toBe(false);
    });

    it("returns true when lake would disconnect the level", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Create two rooms connected by a thin corridor
        carveRoom(pmap, 2, 2, 10, 10);
        carveRoom(pmap, 20, 2, 30, 10);
        carveRoom(pmap, 11, 5, 19, 5); // corridor

        const grid = allocGrid();
        const lakeMap = allocGrid();

        // Block the corridor with a lake
        for (let x = 11; x <= 19; x++) {
            lakeMap[x][5] = 1;
        }

        const result = lakeDisruptsPassability(pmap, grid, lakeMap, 0, 0);
        expect(result).toBe(true);
    });
});

// =============================================================================
// designLakes
// =============================================================================

describe("designLakes", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("designs lake locations on a level with open space", () => {
        const pmap = makePmap(TileType.GRANITE);
        carveRoom(pmap, 1, 1, DCOLS - 2, DROWS - 2);

        const lakeMap = allocGrid();
        designLakes(pmap, lakeMap);

        // Should have placed at least some lake cells
        let lakeCount = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (lakeMap[i][j]) lakeCount++;
            }
        }
        expect(lakeCount).toBeGreaterThan(0);
    });

    it("is deterministic with same seed", () => {
        const pmap1 = makePmap(TileType.GRANITE);
        const pmap2 = makePmap(TileType.GRANITE);
        carveRoom(pmap1, 1, 1, DCOLS - 2, DROWS - 2);
        carveRoom(pmap2, 1, 1, DCOLS - 2, DROWS - 2);

        seedRandomGenerator(42n);
        const lakeMap1 = allocGrid();
        designLakes(pmap1, lakeMap1);

        seedRandomGenerator(42n);
        const lakeMap2 = allocGrid();
        designLakes(pmap2, lakeMap2);

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                expect(lakeMap1[i][j]).toBe(lakeMap2[i][j]);
            }
        }
    });
});

// =============================================================================
// createWreath
// =============================================================================

describe("createWreath", () => {
    it("creates shallow water wreath around lake cells", () => {
        const pmap = makePmap(TileType.FLOOR);
        const wreathMap = allocGrid();

        // Mark a single lake cell
        wreathMap[10][10] = 1;
        pmap[10][10].layers[DungeonLayer.Liquid] = TileType.DEEP_WATER;

        createWreath(pmap, TileType.SHALLOW_WATER, 2, wreathMap);

        // Adjacent cells should have shallow water
        expect(pmap[9][10].layers[DungeonLayer.Liquid]).toBe(TileType.SHALLOW_WATER);
        expect(pmap[11][10].layers[DungeonLayer.Liquid]).toBe(TileType.SHALLOW_WATER);
        expect(pmap[10][9].layers[DungeonLayer.Liquid]).toBe(TileType.SHALLOW_WATER);
        expect(pmap[10][11].layers[DungeonLayer.Liquid]).toBe(TileType.SHALLOW_WATER);

        // Original lake cell should keep its deep water
        expect(pmap[10][10].layers[DungeonLayer.Liquid]).toBe(TileType.DEEP_WATER);
    });
});

// =============================================================================
// finishDoors
// =============================================================================

describe("finishDoors", () => {
    it("removes orphaned doors (passable on both axes)", () => {
        const pmap = makePmap(TileType.FLOOR);
        // Place a door in open floor — it's orphaned
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.DOOR;

        finishDoors(pmap, 1, 26);

        expect(pmap[10][10].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
    });

    it("keeps valid doors between walls", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Create a corridor with a door
        carveRoom(pmap, 5, 10, 9, 10);  // left corridor
        carveRoom(pmap, 11, 10, 15, 10); // right corridor
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.DOOR;
        // Walls above and below the door
        pmap[10][9].layers[DungeonLayer.Dungeon] = TileType.WALL;
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.WALL;

        finishDoors(pmap, 1, 26);

        // Door should remain (not orphaned, not 3+ blocking neighbors)
        // On depth 1, secretDoorChance = 0, so it stays as DOOR
        expect(pmap[10][10].layers[DungeonLayer.Dungeon]).toBe(TileType.DOOR);
    });

    it("removes doors with 3+ blocking neighbors", () => {
        const pmap = makePmap(TileType.GRANITE);
        // Place a door with 3 blocking walls around it
        pmap[10][10].layers[DungeonLayer.Dungeon] = TileType.DOOR;
        pmap[10][9].layers[DungeonLayer.Dungeon] = TileType.WALL; // north
        pmap[9][10].layers[DungeonLayer.Dungeon] = TileType.WALL; // west
        pmap[10][11].layers[DungeonLayer.Dungeon] = TileType.WALL; // south
        pmap[11][10].layers[DungeonLayer.Dungeon] = TileType.FLOOR; // east

        finishDoors(pmap, 1, 26);

        expect(pmap[10][10].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
    });
});

// =============================================================================
// fillLakes
// =============================================================================

describe("fillLakes", () => {
    beforeEach(() => seedRandomGenerator(12345n));

    it("fills lake regions with liquid and wreath", () => {
        const pmap = makePmap(TileType.FLOOR);
        const lakeMap = allocGrid();

        // Mark some lake cells
        lakeMap[10][10] = 1;
        lakeMap[11][10] = 1;
        lakeMap[12][10] = 1;

        fillLakes(pmap, lakeMap, 5, testGameConst);

        // Lake cells should now have some liquid type
        expect(pmap[10][10].layers[DungeonLayer.Liquid]).not.toBe(TileType.NOTHING);
        expect(pmap[11][10].layers[DungeonLayer.Liquid]).not.toBe(TileType.NOTHING);
        expect(pmap[12][10].layers[DungeonLayer.Liquid]).not.toBe(TileType.NOTHING);
    });
});
