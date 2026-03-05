/*
 *  item-population.test.ts — Tests for level item population
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { populateItems, _testing } from "../../src/items/item-population.js";
import type { PopulateItemsContext, PopulateItemsState } from "../../src/items/item-population.js";
import type { Pos, Item, ItemTable, MeteredItem, GameConstants, Pcell } from "../../src/types/types.js";
import { ItemCategory, ALL_ITEMS, TileType, DungeonLayer, FoodKind, PotionKind, MonsterType } from "../../src/types/enums.js";
import { TerrainFlag, TerrainMechFlag, TileFlag, T_PATHING_BLOCKER } from "../../src/types/flags.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";
import { seedRandomGenerator, randRange, randPercent, randClump } from "../../src/math/rng.js";
import {
    foodTable, potionTable, scrollTable,
    meteredItemsGenerationTable, lumenstoneDistribution,
} from "../../src/globals/item-catalog.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import type { ItemRNG } from "../../src/items/item-generation.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeRNG(): ItemRNG {
    return { randRange, randPercent, randClump };
}

function makeGameConstants(): GameConstants {
    return {
        amuletLevel: 26,
        depthAccelerator: 1,
        deepestLevel: 40,
        numberOfLumenstones: 14,
        extraItemsPerLevel: 0,
        goldAdjustmentStartDepth: 5,
        weaponKillsToAutoID: 20,
        armorDelayToAutoID: 1000,
        ringDelayToAutoID: 1500,
        numberMeteredItems: 30,
        numberCharmKinds: 12,
        numberPotionKinds: 16,
        numberGoodPotionKinds: 8,
        numberScrollKinds: 14,
        numberGoodScrollKinds: 12,
        numberWandKinds: 9,
        numberBoltKinds: 28,
    } as GameConstants;
}

function makeState(depth: number = 5): PopulateItemsState {
    const meteredItems: MeteredItem[] = [];
    for (let i = 0; i < 30; i++) {
        meteredItems.push({
            frequency: meteredItemsGenerationTable[i].initialFrequency,
            numberSpawned: 0,
        });
    }
    return {
        depthLevel: depth,
        depthAccelerator: 1,
        goldGenerated: 0,
        foodSpawned: 0n,
        meteredItems,
    };
}

/** Create a minimal dungeon map for testing. All floor except borders = wall. */
function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            const isWall = i === 0 || i === DCOLS - 1 || j === 0 || j === DROWS - 1;
            pmap[i][j] = {
                layers: [
                    isWall ? TileType.WALL : TileType.FLOOR,
                    TileType.NOTHING,
                    TileType.NOTHING,
                    TileType.NOTHING,
                ],
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: { character: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0], opacity: 0 },
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
    }
    return pmap;
}

function makeCtx(
    seed: bigint = 42n,
    depth: number = 5,
): { ctx: PopulateItemsContext; pmap: Pcell[][]; placedItems: Array<{ item: Item; loc: Pos }> } {
    seedRandomGenerator(seed);
    const pmap = makePmap();
    const placedItems: Array<{ item: Item; loc: Pos }> = [];

    const ctx: PopulateItemsContext = {
        state: makeState(depth),
        gameConstants: makeGameConstants(),
        rng: makeRNG(),
        scrollTable,
        potionTable,
        meteredItemsGenerationTable,
        lumenstoneDistribution,
        cellHasTerrainFlag(pos: Pos, flags: number): boolean {
            const cell = pmap[pos.x][pos.y];
            let tFlags = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                tFlags |= tileCatalog[cell.layers[layer]].flags;
            }
            return (tFlags & flags) !== 0;
        },
        getCellFlags(x: number, y: number): number {
            return pmap[x][y].flags;
        },
        getDungeonLayer(x: number, y: number): number {
            return pmap[x][y].layers[DungeonLayer.Dungeon];
        },
        setDungeonLayer(x: number, y: number, value: number): void {
            pmap[x][y].layers[DungeonLayer.Dungeon] = value;
        },
        isPassableOrSecretDoor(pos: Pos): boolean {
            const cell = pmap[pos.x][pos.y];
            let tFlags = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                tFlags |= tileCatalog[cell.layers[layer]].flags;
            }
            if (!(tFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                return true;
            }
            // Check for secret door
            let tmFlags = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                tmFlags |= tileCatalog[cell.layers[layer]].mechFlags;
            }
            return (tmFlags & TerrainMechFlag.TM_IS_SECRET) !== 0;
        },
        passableArcCount(x: number, y: number): number {
            // Simplified: return 0 for non-hallway cells in our test map
            // Count transitions between passable and impassable neighbors
            const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]];
            const cDirs = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
            let arcCount = 0;
            for (let d = 0; d < 8; d++) {
                const prevD = (d + 7) % 8;
                const oldX = x + cDirs[prevD][0];
                const oldY = y + cDirs[prevD][1];
                const newX = x + cDirs[d][0];
                const newY = y + cDirs[d][1];
                const newPassable = newX >= 0 && newX < DCOLS && newY >= 0 && newY < DROWS
                    && !(tileCatalog[pmap[newX][newY].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                const oldPassable = oldX >= 0 && oldX < DCOLS && oldY >= 0 && oldY < DROWS
                    && !(tileCatalog[pmap[oldX][oldY].layers[DungeonLayer.Dungeon]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                if (newPassable !== oldPassable) {
                    arcCount++;
                }
            }
            return Math.floor(arcCount / 2);
        },
        randomMatchingLocation(dungeonType: number, liquidType: number, terrainType: number): Pos | null {
            let attempts = 0;
            let x: number, y: number;
            do {
                x = randRange(0, DCOLS - 1);
                y = randRange(0, DROWS - 1);
                attempts++;
            } while (
                attempts < 500
                && (
                    pmap[x][y].layers[DungeonLayer.Dungeon] !== dungeonType
                    || pmap[x][y].layers[DungeonLayer.Liquid] !== liquidType
                    || (pmap[x][y].flags & (TileFlag.HAS_ITEM | TileFlag.HAS_STAIRS))
                )
            );
            if (attempts >= 500) return null;
            return { x, y };
        },
        placeItemAt(item: Item, loc: Pos): void {
            item.loc = { ...loc };
            pmap[loc.x][loc.y].flags |= TileFlag.HAS_ITEM;
            placedItems.push({ item, loc: { ...loc } });
        },
        chooseVorpalEnemy(): number {
            return MonsterType.MK_RAT;
        },
    };

    return { ctx, pmap, placedItems };
}

// =============================================================================
// Internal heat map helpers
// =============================================================================

describe("heat map helpers", () => {
    describe("coolHeatMapAt", () => {
        it("should zero out the target cell and reduce nearby same-heat cells", () => {
            const heatMap: number[][] = [];
            for (let i = 0; i < DCOLS; i++) {
                heatMap[i] = [];
                for (let j = 0; j < DROWS; j++) {
                    heatMap[i][j] = 100;
                }
            }
            const totalHeat = { value: DCOLS * DROWS * 100 };
            const loc = { x: 10, y: 10 };

            _testing.coolHeatMapAt(heatMap, loc, totalHeat);

            expect(heatMap[10][10]).toBe(0);
            // Nearby cells with same heat should be reduced
            expect(heatMap[11][10]).toBe(10); // max(1, 100/10)
            expect(heatMap[9][10]).toBe(10);
            // totalHeat should be reduced accordingly
            expect(totalHeat.value).toBeLessThan(DCOLS * DROWS * 100);
        });

        it("should be a no-op on a zero-heat cell", () => {
            const heatMap: number[][] = [];
            for (let i = 0; i < DCOLS; i++) {
                heatMap[i] = [];
                for (let j = 0; j < DROWS; j++) {
                    heatMap[i][j] = 0;
                }
            }
            const totalHeat = { value: 0 };
            _testing.coolHeatMapAt(heatMap, { x: 5, y: 5 }, totalHeat);
            expect(totalHeat.value).toBe(0);
        });
    });

    describe("getItemSpawnLoc", () => {
        it("should return null when totalHeat is zero", () => {
            seedRandomGenerator(1n);
            const heatMap: number[][] = [];
            for (let i = 0; i < DCOLS; i++) {
                heatMap[i] = [];
                for (let j = 0; j < DROWS; j++) {
                    heatMap[i][j] = 0;
                }
            }
            const totalHeat = { value: 0 };
            expect(_testing.getItemSpawnLoc(heatMap, totalHeat, makeRNG())).toBeNull();
        });

        it("should return a valid cell when there is heat", () => {
            seedRandomGenerator(42n);
            const heatMap: number[][] = [];
            for (let i = 0; i < DCOLS; i++) {
                heatMap[i] = [];
                for (let j = 0; j < DROWS; j++) {
                    heatMap[i][j] = i === 10 && j === 10 ? 100 : 0;
                }
            }
            const totalHeat = { value: 100 };
            const loc = _testing.getItemSpawnLoc(heatMap, totalHeat, makeRNG());
            expect(loc).toEqual({ x: 10, y: 10 });
        });

        it("should weight toward higher-heat cells", () => {
            const heatMap: number[][] = [];
            for (let i = 0; i < DCOLS; i++) {
                heatMap[i] = [];
                for (let j = 0; j < DROWS; j++) {
                    heatMap[i][j] = 0;
                }
            }
            // Cell A has heat 900, cell B has heat 100
            heatMap[5][5] = 900;
            heatMap[20][20] = 100;
            const totalHeat = { value: 1000 };

            const counts: Record<string, number> = { "5,5": 0, "20,20": 0 };
            for (let s = 0; s < 100; s++) {
                seedRandomGenerator(BigInt(s + 1000));
                const loc = _testing.getItemSpawnLoc(heatMap, totalHeat, makeRNG());
                if (loc) {
                    const key = `${loc.x},${loc.y}`;
                    if (key in counts) counts[key]++;
                }
            }
            // Cell A should be picked much more often than cell B
            expect(counts["5,5"]).toBeGreaterThan(counts["20,20"]);
        });
    });

    describe("gold schedule helpers", () => {
        it("aggregateGoldLowerBound should match known values", () => {
            // At d=0: POW_GOLD[0] + 320*0 = 0
            expect(_testing.aggregateGoldLowerBound(0)).toBe(0);
            // At d=5: POW_GOLD[5] + 320*5 = 135 + 1600 = 1735
            expect(_testing.aggregateGoldLowerBound(5)).toBe(1735);
        });

        it("aggregateGoldUpperBound should be higher than lower bound", () => {
            for (let d = 1; d < 25; d++) {
                expect(_testing.aggregateGoldUpperBound(d)).toBeGreaterThan(
                    _testing.aggregateGoldLowerBound(d),
                );
            }
        });
    });
});

// =============================================================================
// populateItems — main function
// =============================================================================

describe("populateItems", () => {
    it("should place items on the map", () => {
        const { ctx, placedItems } = makeCtx(42n, 5);
        populateItems({ x: 40, y: 14 }, ctx);

        expect(placedItems.length).toBeGreaterThan(0);
    });

    it("should generate both items and gold piles", () => {
        const { ctx, placedItems } = makeCtx(100n, 5);
        populateItems({ x: 40, y: 14 }, ctx);

        const goldItems = placedItems.filter(p => p.item.category === ItemCategory.GOLD);
        const nonGoldItems = placedItems.filter(p => p.item.category !== ItemCategory.GOLD);

        expect(goldItems.length).toBeGreaterThan(0);
        expect(nonGoldItems.length).toBeGreaterThan(0);
    });

    it("should update goldGenerated state", () => {
        const { ctx } = makeCtx(200n, 5);
        expect(ctx.state.goldGenerated).toBe(0);

        populateItems({ x: 40, y: 14 }, ctx);

        expect(ctx.state.goldGenerated).toBeGreaterThan(0);
    });

    it("should track food spawning", () => {
        // At depth 5 with 0 foodSpawned, the food guarantee schedule should
        // force a food item because:
        //   left  = (0 + 1800/3) * 4 * FP_FACTOR ≈ 157M
        //   right = POW_FOOD[4] * 1800 * 45/100 ≈ 466M
        //   left < right → food is guaranteed
        const { ctx } = makeCtx(300n, 5);
        expect(ctx.state.foodSpawned).toBe(0n);

        populateItems({ x: 40, y: 14 }, ctx);

        expect(ctx.state.foodSpawned).toBeGreaterThan(0n);
    });

    it("should generate more items on early levels (bonus items)", () => {
        // Depth 1 gets +2 bonus items, depth 10 does not
        const results: number[] = [];
        for (let depth = 1; depth <= 10; depth++) {
            const { ctx, placedItems } = makeCtx(BigInt(depth * 1000), depth);
            populateItems({ x: 40, y: 14 }, ctx);
            results.push(placedItems.filter(p => p.item.category !== ItemCategory.GOLD).length);
        }
        // Early levels should tend to have more items due to bonuses
        // Depth 1 and 2 get +2, depth 3 and 4 get +1
        // This is a statistical test, so we check the average of early vs late
        const earlyAvg = (results[0] + results[1]) / 2;
        const lateAvg = (results[8] + results[9]) / 2;
        expect(earlyAvg).toBeGreaterThanOrEqual(lateAvg);
    });

    it("should generate lumenstones on post-amulet levels", () => {
        const { ctx, placedItems } = makeCtx(400n, 27); // depth > amuletLevel (26)
        populateItems({ x: 40, y: 14 }, ctx);

        // On post-amulet levels, items should be lumenstones (GEM) or food
        const nonFoodItems = placedItems.filter(
            p => !(p.item.category & ItemCategory.FOOD),
        );
        // Some items should be GEM category (lumenstones)
        const gems = nonFoodItems.filter(p => p.item.category === ItemCategory.GEM);
        expect(gems.length).toBeGreaterThan(0);
    });

    it("should not generate gold on post-amulet levels", () => {
        const { ctx, placedItems } = makeCtx(500n, 27);
        populateItems({ x: 40, y: 14 }, ctx);

        const goldItems = placedItems.filter(p => p.item.category === ItemCategory.GOLD);
        expect(goldItems.length).toBe(0);
    });

    it("should set originDepth on all items", () => {
        const { ctx, placedItems } = makeCtx(600n, 8);
        populateItems({ x: 40, y: 14 }, ctx);

        for (const { item } of placedItems) {
            if (item.category !== ItemCategory.GOLD) {
                expect(item.originDepth).toBe(8);
            }
        }
    });

    it("should update metered items state", () => {
        const { ctx } = makeCtx(700n, 5);
        // Copy initial state for comparison
        const initialFreqs = ctx.state.meteredItems.map(m => m.frequency);
        const initialSpawns = ctx.state.meteredItems.map(m => m.numberSpawned);

        populateItems({ x: 40, y: 14 }, ctx);

        // At least one metered item should have been modified.
        // The enchanting scroll (index 0) has incrementFrequency=30 and
        // decrementFrequency=50, so after increment (60→90) and possibly
        // spawning (90→40), the frequency will have changed.
        let anyFreqChanged = false;
        let anySpawnChanged = false;
        for (let i = 0; i < ctx.state.meteredItems.length; i++) {
            if (ctx.state.meteredItems[i].frequency !== initialFreqs[i]) {
                anyFreqChanged = true;
            }
            if (ctx.state.meteredItems[i].numberSpawned !== initialSpawns[i]) {
                anySpawnChanged = true;
            }
        }
        // Metered items with non-zero incrementFrequency should have changed
        expect(anyFreqChanged).toBe(true);
    });

    it("should place items at valid locations", () => {
        const { ctx, placedItems, pmap } = makeCtx(800n, 5);
        populateItems({ x: 40, y: 14 }, ctx);

        for (const { loc } of placedItems) {
            expect(loc.x).toBeGreaterThanOrEqual(0);
            expect(loc.x).toBeLessThan(DCOLS);
            expect(loc.y).toBeGreaterThanOrEqual(0);
            expect(loc.y).toBeLessThan(DROWS);
            // The cell should be marked as having an item
            expect(pmap[loc.x][loc.y].flags & TileFlag.HAS_ITEM).toBeTruthy();
        }
    });

    it("should be deterministic with same seed", () => {
        const { ctx: ctx1, placedItems: items1 } = makeCtx(999n, 5);
        populateItems({ x: 40, y: 14 }, ctx1);

        const { ctx: ctx2, placedItems: items2 } = makeCtx(999n, 5);
        populateItems({ x: 40, y: 14 }, ctx2);

        expect(items1.length).toBe(items2.length);
        for (let i = 0; i < items1.length; i++) {
            expect(items1[i].item.category).toBe(items2[i].item.category);
            expect(items1[i].item.kind).toBe(items2[i].item.kind);
            expect(items1[i].loc).toEqual(items2[i].loc);
        }
    });

    it("should produce different results with different seeds", () => {
        const { ctx: ctx1, placedItems: items1 } = makeCtx(1111n, 5);
        populateItems({ x: 40, y: 14 }, ctx1);

        const { ctx: ctx2, placedItems: items2 } = makeCtx(2222n, 5);
        populateItems({ x: 40, y: 14 }, ctx2);

        // Items should differ in either count, category, kind, or location
        const sig1 = items1.map(i => `${i.item.category}-${i.item.kind}-${i.loc.x}-${i.loc.y}`).join("|");
        const sig2 = items2.map(i => `${i.item.category}-${i.item.kind}-${i.loc.x}-${i.loc.y}`).join("|");
        expect(sig1).not.toBe(sig2);
    });

    it("should adjust gold piles when below production schedule", () => {
        // At depth 6 (>= goldAdjustmentStartDepth=5) with 0 gold generated,
        // we should get extra gold piles
        const { ctx: ctxLow, placedItems: itemsLow } = makeCtx(1234n, 6);
        ctxLow.state.goldGenerated = 0; // way below schedule
        populateItems({ x: 40, y: 14 }, ctxLow);
        const goldLow = itemsLow.filter(p => p.item.category === ItemCategory.GOLD).length;

        // Compare with a run that's above the gold schedule
        const { ctx: ctxHigh, placedItems: itemsHigh } = makeCtx(1234n, 6);
        ctxHigh.state.goldGenerated = 999999; // way above schedule
        populateItems({ x: 40, y: 14 }, ctxHigh);
        const goldHigh = itemsHigh.filter(p => p.item.category === ItemCategory.GOLD).length;

        // When below schedule, should have more gold piles
        expect(goldLow).toBeGreaterThan(goldHigh);
    });
});
