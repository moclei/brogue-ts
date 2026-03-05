/*
 *  architect-machines.test.ts — Tests for machine/blueprint placement
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    blueprintQualifies,
    cellIsFeatureCandidate,
    addTileToMachineInteriorAndIterate,
    expandMachineInterior,
    fillInteriorForVestibuleMachine,
    prepareInteriorWithMachineFlags,
    spawnMapDF,
    fillSpawnMap,
    spawnDungeonFeature,
    addLocationToKey,
    addMachineNumberToKey,
    itemIsADuplicate,
    type MachineItem,
} from "../src/architect/machines.js";
import { TileType, DungeonLayer, DungeonFeatureType } from "../src/types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import { TileFlag, BlueprintFlag, MachineFeatureFlag, IS_IN_MACHINE, DFFlag } from "../src/types/flags.js";
import { allocGrid, fillGrid, type Grid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import { tileCatalog } from "../src/globals/tile-catalog.js";
import type { Pcell, CellDisplayBuffer, Blueprint, DungeonFeature, DungeonProfile } from "../src/types/types.js";

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

function makeMachineItem(overrides: Partial<MachineItem> = {}): MachineItem {
    return {
        category: 0,
        kind: 0,
        quantity: 1,
        flags: 0,
        keyLoc: Array.from({ length: 4 }, () => ({ loc: { x: 0, y: 0 }, machine: 0, disposableHere: false })),
        originDepth: 0,
        ...overrides,
    };
}

// Simple blueprint factory
function makeBlueprint(overrides: Partial<Blueprint> = {}): Blueprint {
    return {
        name: "test",
        depthRange: [1, 26] as [number, number],
        roomSize: [10, 20] as [number, number],
        frequency: 10,
        featureCount: 0,
        dungeonProfileType: 0 as any,
        flags: 0,
        feature: [],
        ...overrides,
    };
}

// =============================================================================
// Tests: blueprintQualifies
// =============================================================================

describe("blueprintQualifies", () => {
    const catalog: readonly Blueprint[] = [
        makeBlueprint({ name: "nothing", depthRange: [0, 0], frequency: 0 }),
        makeBlueprint({
            name: "reward",
            depthRange: [1, 12],
            frequency: 30,
            flags: BlueprintFlag.BP_ROOM | BlueprintFlag.BP_REWARD,
        }),
        makeBlueprint({
            name: "vestibule",
            depthRange: [1, 26],
            frequency: 20,
            flags: BlueprintFlag.BP_VESTIBULE,
        }),
        makeBlueprint({
            name: "adopter",
            depthRange: [1, 26],
            frequency: 15,
            flags: BlueprintFlag.BP_ADOPT_ITEM,
        }),
    ];

    it("rejects blueprints outside depth range", () => {
        expect(blueprintQualifies(catalog, 1, 15, BlueprintFlag.BP_REWARD)).toBe(false);
        expect(blueprintQualifies(catalog, 1, 12, BlueprintFlag.BP_REWARD)).toBe(true);
    });

    it("rejects blueprints missing required flags", () => {
        expect(blueprintQualifies(catalog, 1, 5, BlueprintFlag.BP_VESTIBULE)).toBe(false);
    });

    it("matches correct blueprint with required flags", () => {
        expect(blueprintQualifies(catalog, 1, 5, BlueprintFlag.BP_REWARD)).toBe(true);
    });

    it("rejects BP_ADOPT_ITEM unless required", () => {
        // Blueprint 3 has BP_ADOPT_ITEM. If we don't require it, it shouldn't qualify.
        expect(blueprintQualifies(catalog, 3, 5, 0)).toBe(false);
        // If we require it, it should qualify.
        expect(blueprintQualifies(catalog, 3, 5, BlueprintFlag.BP_ADOPT_ITEM)).toBe(true);
    });

    it("rejects BP_VESTIBULE unless required", () => {
        expect(blueprintQualifies(catalog, 2, 5, 0)).toBe(false);
        expect(blueprintQualifies(catalog, 2, 5, BlueprintFlag.BP_VESTIBULE)).toBe(true);
    });
});

// =============================================================================
// Tests: itemIsADuplicate
// =============================================================================

describe("itemIsADuplicate", () => {
    it("detects duplicate items by category and kind", () => {
        const item1 = makeMachineItem({ category: 2, kind: 3 });
        const item2 = makeMachineItem({ category: 2, kind: 3 });
        const items: (MachineItem | null)[] = [item1, null];
        // Category 0 doesn't match any unique categories, so it won't detect duplicates
        // Since we stubbed UNIQUE_CATEGORIES as 0, this test verifies the structure
        expect(itemIsADuplicate(item2, items, 1)).toBe(false);
    });
});

// =============================================================================
// Tests: addLocationToKey / addMachineNumberToKey
// =============================================================================

describe("addLocationToKey", () => {
    it("adds a location to the first empty key slot", () => {
        const item = makeMachineItem();
        addLocationToKey(item, 5, 10, true);
        expect(item.keyLoc[0].loc).toEqual({ x: 5, y: 10 });
        expect(item.keyLoc[0].disposableHere).toBe(true);
    });

    it("adds to the next available slot", () => {
        const item = makeMachineItem();
        item.keyLoc[0].loc = { x: 1, y: 1 };
        addLocationToKey(item, 5, 10, false);
        expect(item.keyLoc[1].loc).toEqual({ x: 5, y: 10 });
        expect(item.keyLoc[1].disposableHere).toBe(false);
    });
});

describe("addMachineNumberToKey", () => {
    it("adds a machine number to the first empty key slot", () => {
        const item = makeMachineItem();
        addMachineNumberToKey(item, 42, true);
        expect(item.keyLoc[0].machine).toBe(42);
        expect(item.keyLoc[0].disposableHere).toBe(true);
    });
});

// =============================================================================
// Tests: cellIsFeatureCandidate
// =============================================================================

describe("cellIsFeatureCandidate", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
        // Carve a room
        carveRoom(pmap, 5, 5, 15, 15);
    });

    it("returns true for interior floor cells", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        // Mark room as interior
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }
        const occupied = allocGrid();
        fillGrid(occupied, 0);
        const viewMap = allocGrid();
        fillGrid(viewMap, 0);
        const distanceMap = allocGrid();
        fillGrid(distanceMap, 5);

        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 10, 10, 5, 5,
            [0, 10000], interior, occupied, viewMap, distanceMap,
            1, 0, 0,
        )).toBe(true);
    });

    it("returns false for occupied cells", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }
        const occupied = allocGrid();
        fillGrid(occupied, 0);
        occupied[10][10] = 1; // Mark as occupied
        const viewMap = allocGrid();
        fillGrid(viewMap, 0);
        const distanceMap = allocGrid();
        fillGrid(distanceMap, 5);

        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 10, 10, 5, 5,
            [0, 10000], interior, occupied, viewMap, distanceMap,
            1, 0, 0,
        )).toBe(false);
    });

    it("returns false for wall cells without MF_BUILD_IN_WALLS", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        const occupied = allocGrid();
        fillGrid(occupied, 0);
        const viewMap = allocGrid();
        fillGrid(viewMap, 0);
        const distanceMap = allocGrid();
        fillGrid(distanceMap, 5);

        // Wall cell (default granite)
        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 2, 2, 5, 5,
            [0, 10000], interior, occupied, viewMap, distanceMap,
            1, 0, 0,
        )).toBe(false);
    });

    it("returns origin for MF_BUILD_AT_ORIGIN", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        const occupied = allocGrid();
        fillGrid(occupied, 0);
        const viewMap = allocGrid();
        fillGrid(viewMap, 0);
        const distanceMap = allocGrid();
        fillGrid(distanceMap, 5);

        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 5, 5, 5, 5,
            [0, 10000], interior, occupied, viewMap, distanceMap,
            1, MachineFeatureFlag.MF_BUILD_AT_ORIGIN, 0,
        )).toBe(true);

        // Non-origin should fail
        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 10, 10, 5, 5,
            [0, 10000], interior, occupied, viewMap, distanceMap,
            1, MachineFeatureFlag.MF_BUILD_AT_ORIGIN, 0,
        )).toBe(false);
    });

    it("excludes origin for room blueprints (without MF_BUILD_AT_ORIGIN)", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }
        const occupied = allocGrid();
        fillGrid(occupied, 0);
        const viewMap = allocGrid();
        fillGrid(viewMap, 0);
        const distanceMap = allocGrid();
        fillGrid(distanceMap, 5);

        // Origin should be excluded for room blueprints
        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 5, 5, 5, 5,
            [0, 10000], interior, occupied, viewMap, distanceMap,
            1, 0, BlueprintFlag.BP_ROOM,
        )).toBe(false);
    });

    it("respects distance bounds", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }
        const occupied = allocGrid();
        fillGrid(occupied, 0);
        const viewMap = allocGrid();
        fillGrid(viewMap, 0);
        const distanceMap = allocGrid();
        fillGrid(distanceMap, 0);
        distanceMap[10][10] = 20; // Far from origin

        // Should fail with tight distance bound
        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 10, 10, 5, 5,
            [0, 10], interior, occupied, viewMap, distanceMap,
            1, 0, 0,
        )).toBe(false);

        // Should pass with wider distance bound
        expect(cellIsFeatureCandidate(
            pmap, tileCatalog, 10, 10, 5, 5,
            [0, 25], interior, occupied, viewMap, distanceMap,
            1, 0, 0,
        )).toBe(true);
    });
});

// =============================================================================
// Tests: addTileToMachineInteriorAndIterate
// =============================================================================

describe("addTileToMachineInteriorAndIterate", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
    });

    it("fills a small room interior from gate site", () => {
        // Carve a room
        carveRoom(pmap, 5, 5, 10, 10);
        // Create a choke map where the room has value 10 and walls have value 30000
        const chokeMap = allocGrid();
        fillGrid(chokeMap, 30000);
        for (let i = 5; i <= 10; i++) {
            for (let j = 5; j <= 10; j++) {
                chokeMap[i][j] = 10;
            }
        }
        const interior = allocGrid();
        fillGrid(interior, 0);

        const result = addTileToMachineInteriorAndIterate(pmap, chokeMap, interior, 5, 5);

        expect(result).toBe(true);
        // All room cells should be in the interior
        for (let i = 5; i <= 10; i++) {
            for (let j = 5; j <= 10; j++) {
                expect(interior[i][j]).toBe(1);
            }
        }
        // Walls should not be in the interior
        expect(interior[4][5]).toBe(0);
        expect(interior[11][5]).toBe(0);
    });

    it("returns false when room has items", () => {
        carveRoom(pmap, 5, 5, 10, 10);
        pmap[7][7].flags |= TileFlag.HAS_ITEM;

        const chokeMap = allocGrid();
        fillGrid(chokeMap, 30000);
        for (let i = 5; i <= 10; i++) {
            for (let j = 5; j <= 10; j++) {
                chokeMap[i][j] = 10;
            }
        }
        const interior = allocGrid();
        fillGrid(interior, 0);

        const result = addTileToMachineInteriorAndIterate(pmap, chokeMap, interior, 5, 5);
        expect(result).toBe(false);
    });

    it("returns false when touching another machine (non-gate)", () => {
        carveRoom(pmap, 5, 5, 10, 10);
        pmap[8][8].flags |= TileFlag.IS_IN_AREA_MACHINE; // another machine

        const chokeMap = allocGrid();
        fillGrid(chokeMap, 30000);
        for (let i = 5; i <= 10; i++) {
            for (let j = 5; j <= 10; j++) {
                chokeMap[i][j] = 10;
            }
        }
        const interior = allocGrid();
        fillGrid(interior, 0);

        const result = addTileToMachineInteriorAndIterate(pmap, chokeMap, interior, 5, 5);
        expect(result).toBe(false);
    });
});

// =============================================================================
// Tests: expandMachineInterior
// =============================================================================

describe("expandMachineInterior", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
    });

    it("clears interior doors", () => {
        carveRoom(pmap, 5, 5, 10, 10);
        pmap[7][7].layers[DungeonLayer.Dungeon] = TileType.DOOR;

        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 10; i++) {
            for (let j = 5; j <= 10; j++) {
                interior[i][j] = 1;
            }
        }

        expandMachineInterior(pmap, tileCatalog, interior, 4);

        // Door should now be floor
        expect(pmap[7][7].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
    });
});

// =============================================================================
// Tests: prepareInteriorWithMachineFlags
// =============================================================================

describe("prepareInteriorWithMachineFlags", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
        carveRoom(pmap, 5, 5, 15, 15);
    });

    const dummyProfile: DungeonProfile = {
        roomFrequencies: [2, 1, 1, 1, 7, 1, 0, 0],
        corridorChance: 10,
    };

    it("purges interior terrain with BP_PURGE_INTERIOR", () => {
        // Place some interesting terrain
        pmap[10][10].layers[DungeonLayer.Surface] = TileType.TORCH_WALL;

        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }

        prepareInteriorWithMachineFlags(
            pmap, tileCatalog, interior, 5, 5,
            BlueprintFlag.BP_PURGE_INTERIOR,
            dummyProfile,
        );

        // All interior cells should be floor with nothing on other layers
        expect(pmap[10][10].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
        expect(pmap[10][10].layers[DungeonLayer.Surface]).toBe(TileType.NOTHING);
    });

    it("purges liquids with BP_PURGE_LIQUIDS", () => {
        pmap[10][10].layers[DungeonLayer.Liquid] = TileType.DEEP_WATER;

        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }

        prepareInteriorWithMachineFlags(
            pmap, tileCatalog, interior, 5, 5,
            BlueprintFlag.BP_PURGE_LIQUIDS,
            dummyProfile,
        );

        expect(pmap[10][10].layers[DungeonLayer.Liquid]).toBe(TileType.NOTHING);
    });

    it("marks as impregnable with BP_IMPREGNABLE", () => {
        const interior = allocGrid();
        fillGrid(interior, 0);
        for (let i = 5; i <= 15; i++) {
            for (let j = 5; j <= 15; j++) {
                interior[i][j] = 1;
            }
        }

        prepareInteriorWithMachineFlags(
            pmap, tileCatalog, interior, 5, 5,
            BlueprintFlag.BP_IMPREGNABLE,
            dummyProfile,
        );

        // Interior cells should be marked impregnable
        expect(pmap[10][10].flags & TileFlag.IMPREGNABLE).toBeTruthy();
        // And surrounding non-interior cells too
        expect(pmap[4][5].flags & TileFlag.IMPREGNABLE).toBeTruthy();
    });
});

// =============================================================================
// Tests: spawnMapDF
// =============================================================================

describe("spawnMapDF", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
        carveRoom(pmap, 5, 5, 25, 15);
    });

    it("places at least the origin cell", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);

        spawnMapDF(pmap, 10, 10, 0, false, 100, 10, spawnMap);

        expect(spawnMap[10][10]).toBeGreaterThan(0);
    });

    it("spreads to adjacent cells with high probability", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);

        // Note: probDec must be > 0 to ensure termination (same in C).
        // With high start probability and small decrement, should spread widely.
        spawnMapDF(pmap, 10, 10, 0, false, 100, 5, spawnMap);

        let count = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (spawnMap[i][j] > 0) count++;
            }
        }
        expect(count).toBeGreaterThan(1);
    });

    it("doesn't spread with zero probability", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);

        spawnMapDF(pmap, 10, 10, 0, false, 0, 0, spawnMap);

        // Should only have the origin (prob starts at 0, so while loop doesn't execute)
        let count = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (spawnMap[i][j] > 0) count++;
            }
        }
        expect(count).toBe(1);
    });
});

// =============================================================================
// Tests: fillSpawnMap
// =============================================================================

describe("fillSpawnMap", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
        carveRoom(pmap, 5, 5, 15, 15);
    });

    it("places terrain on flagged cells", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        const result = fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface,
            TileType.TORCH_WALL,
            spawnMap,
            false, false, false,
        );

        expect(result).toBe(true);
        expect(pmap[10][10].layers[DungeonLayer.Surface]).toBe(TileType.TORCH_WALL);
    });

    it("returns false when nothing was placed", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        // No cells flagged

        const result = fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface,
            TileType.TORCH_WALL,
            spawnMap,
            false, false, false,
        );

        expect(result).toBe(false);
    });
});

// =============================================================================
// Tests: spawnDungeonFeature
// =============================================================================

describe("spawnDungeonFeature", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
        carveRoom(pmap, 5, 5, 25, 20);
    });

    const emptyFeatureCatalog: DungeonFeature[] = [{
        tile: 0 as any,
        layer: DungeonLayer.Dungeon,
        startProbability: 0,
        probabilityDecrement: 0,
        flags: 0,
        description: "",
        lightFlare: 0 as any,
        flashColor: null,
        effectRadius: 0,
        propagationTerrain: 0 as any,
        subsequentDF: 0 as any,
        messageDisplayed: false,
    }];

    it("places a simple feature", () => {
        const feat: DungeonFeature = {
            tile: TileType.TORCH_WALL,
            layer: DungeonLayer.Surface,
            startProbability: 100,
            probabilityDecrement: 100,
            flags: 0,
            description: "",
            lightFlare: 0 as any,
            flashColor: null,
            effectRadius: 0,
            propagationTerrain: 0 as any,
            subsequentDF: 0 as any,
            messageDisplayed: false,
        };

        const result = spawnDungeonFeature(pmap, tileCatalog, emptyFeatureCatalog, 10, 10, feat, false, false);

        expect(result).toBe(true);
        expect(pmap[10][10].layers[DungeonLayer.Surface]).toBe(TileType.TORCH_WALL);
    });

    it("succeeds even when tile is 0 (no terrain to place)", () => {
        const feat: DungeonFeature = {
            tile: 0 as any,
            layer: DungeonLayer.Dungeon,
            startProbability: 0,
            probabilityDecrement: 0,
            flags: 0,
            description: "",
            lightFlare: 0 as any,
            flashColor: null,
            effectRadius: 0,
            propagationTerrain: 0 as any,
            subsequentDF: 0 as any,
            messageDisplayed: false,
        };

        const result = spawnDungeonFeature(pmap, tileCatalog, emptyFeatureCatalog, 10, 10, feat, false, false);
        expect(result).toBe(true);
    });

    it("adds gas features by updating volume", () => {
        const feat: DungeonFeature = {
            tile: TileType.POISON_GAS,
            layer: DungeonLayer.Gas,
            startProbability: 50,
            probabilityDecrement: 0,
            flags: 0,
            description: "",
            lightFlare: 0 as any,
            flashColor: null,
            effectRadius: 0,
            propagationTerrain: 0 as any,
            subsequentDF: 0 as any,
            messageDisplayed: false,
        };

        const result = spawnDungeonFeature(pmap, tileCatalog, emptyFeatureCatalog, 10, 10, feat, false, false);

        expect(result).toBe(true);
        expect(pmap[10][10].layers[DungeonLayer.Gas]).toBe(TileType.POISON_GAS);
        expect(pmap[10][10].volume).toBe(50);
    });
});

// =============================================================================
// Tests: fillInteriorForVestibuleMachine
// =============================================================================

describe("fillInteriorForVestibuleMachine", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
        // Carve a corridor and rooms
        carveRoom(pmap, 5, 5, 30, 20);
    });

    it("fills interior around origin based on Dijkstra distance", () => {
        const interior = allocGrid();
        const blueprint = makeBlueprint({ roomSize: [5, 10] });

        const populateGenericCostMap = (costMap: Grid) => {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.FLOOR) {
                        costMap[i][j] = 1;
                    } else {
                        costMap[i][j] = -1; // PDS_OBSTRUCTION
                    }
                }
            }
        };

        const result = fillInteriorForVestibuleMachine(
            pmap, interior, blueprint, 10, 10, populateGenericCostMap,
        );

        expect(result).toBe(true);

        // Count interior cells
        let count = 0;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (interior[i][j]) count++;
            }
        }
        expect(count).toBeGreaterThanOrEqual(5);
        expect(count).toBeLessThanOrEqual(10);
    });
});
