/*
 *  item-population.ts — Level item population logic
 *  brogue-ts
 *
 *  Ported from: src/brogue/Items.c — populateItems, fillItemSpawnHeatMap,
 *               coolHeatMapAt, getItemSpawnLoc
 *
 *  Generates and places items for a dungeon level. Handles:
 *   - Metered item frequency tracking (enchant scrolls, strength/life potions)
 *   - Food guarantee schedule
 *   - Gold production schedule with self-correction
 *   - Heat-map-biased placement behind secret doors
 *   - Lumenstone/gem generation on post-amulet levels
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, Item, ItemTable, MeteredItem, GameConstants, MeteredItemGenerationTable } from "../types/types.js";
import { ItemCategory, ALL_ITEMS, TileType, FoodKind, PotionKind } from "../types/enums.js";
import { TerrainFlag, TileFlag, T_PATHING_BLOCKER } from "../types/flags.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { foodTable } from "../globals/item-catalog.js";
import { generateItem } from "./item-generation.js";
import type { ItemGenContext, ItemRNG } from "./item-generation.js";

// =============================================================================
// Constants (from C populateItems)
// =============================================================================

/** b^3.05, with b from 0 to 25, for gold schedule */
const POW_GOLD: readonly number[] = Object.freeze([
    0, 1, 8, 28, 68, 135, 236, 378, 568, 813, 1122, 1500, 1956, 2497, 3131,
    3864, 4705, 5660, 6738, 7946, 9292, 10783, 12427, 14232, 16204, 18353,
]);

/** b^1.35 fixed point, with b from 1 to 50, for food schedule */
const POW_FOOD: readonly bigint[] = Object.freeze([
    65536n, 167059n, 288797n, 425854n, 575558n, 736180n, 906488n, 1085553n, 1272645n,
    1467168n, 1668630n, 1876612n, 2090756n, 2310749n, 2536314n, 2767208n, 3003211n,
    3244126n, 3489773n, 3739989n, 3994624n, 4253540n, 4516609n, 4783712n, 5054741n,
    5329591n, 5608167n, 5890379n, 6176141n, 6465373n, 6758000n, 7053950n, 7353155n,
    7655551n, 7961076n, 8269672n, 8581283n, 8895856n, 9213341n, 9533687n, 9856849n,
    10182782n, 10511443n, 10842789n, 11176783n, 11513384n, 11852556n, 12194264n,
    12538472n, 12885148n,
]);

function aggregateGoldLowerBound(d: number): number {
    return POW_GOLD[d] + 320 * d;
}

function aggregateGoldUpperBound(d: number): number {
    return POW_GOLD[d] + 420 * d;
}

// =============================================================================
// DI context for populateItems
// =============================================================================

/**
 * Mutable game state updated during item population.
 */
export interface PopulateItemsState {
    depthLevel: number;
    depthAccelerator: number;
    goldGenerated: number;
    foodSpawned: bigint;
    meteredItems: MeteredItem[];
}

/**
 * Context required for populating items on a level.
 */
export interface PopulateItemsContext {
    state: PopulateItemsState;
    gameConstants: GameConstants;
    rng: ItemRNG;

    /** Immutable original scroll table (for creating working copies). */
    scrollTable: readonly ItemTable[];
    /** Immutable original potion table (for creating working copies). */
    potionTable: readonly ItemTable[];

    /** Metered items generation table (variant-specific). */
    meteredItemsGenerationTable: readonly MeteredItemGenerationTable[];
    /** Lumenstone distribution for post-amulet levels. */
    lumenstoneDistribution: readonly number[];

    // Map queries
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    getCellFlags(x: number, y: number): number;
    getDungeonLayer(x: number, y: number): number;
    setDungeonLayer(x: number, y: number, value: number): void;
    isPassableOrSecretDoor(pos: Pos): boolean;
    passableArcCount(x: number, y: number): number;
    randomMatchingLocation(
        dungeonType: number,
        liquidType: number,
        terrainType: number,
    ): Pos | null;

    // Item placement
    placeItemAt(item: Item, loc: Pos): void;

    // Item generation dependency
    chooseVorpalEnemy(): number;
}

// =============================================================================
// Heat map helpers
// =============================================================================

/**
 * Recursive heat map flood fill from a location.
 * Higher heat values mean the area is behind more doors (especially secret
 * doors), biasing item placement toward well-hidden areas.
 *
 * C equivalent: `fillItemSpawnHeatMap(heatMap, heatLevel, loc)` in Items.c
 */
function fillItemSpawnHeatMap(
    heatMap: number[][],
    heatLevel: number,
    loc: Pos,
    ctx: PopulateItemsContext,
): void {
    const layer = ctx.getDungeonLayer(loc.x, loc.y);
    if (layer === TileType.DOOR) {
        heatLevel += 10;
    } else if (layer === TileType.SECRET_DOOR) {
        heatLevel += 3000;
    }

    if (heatMap[loc.x][loc.y] > heatLevel) {
        heatMap[loc.x][loc.y] = heatLevel;
    }

    for (let dir = 0; dir < 4; dir++) {
        const nx = loc.x + nbDirs[dir][0];
        const ny = loc.y + nbDirs[dir][1];
        if (
            coordinatesAreInMap(nx, ny)
            && !ctx.cellHasTerrainFlag(
                { x: nx, y: ny },
                TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_AUTO_DESCENT,
            )
            && ctx.isPassableOrSecretDoor({ x: nx, y: ny })
            && heatLevel < heatMap[nx][ny]
        ) {
            fillItemSpawnHeatMap(heatMap, heatLevel, { x: nx, y: ny }, ctx);
        }
    }
}

/**
 * Cool down the heat map at the given location and its surroundings.
 * Prevents multiple items from being placed at the same spot.
 *
 * C equivalent: `coolHeatMapAt(heatMap, loc, totalHeat)` in Items.c
 */
function coolHeatMapAt(
    heatMap: number[][],
    loc: Pos,
    totalHeat: { value: number },
): void {
    const currentHeat = heatMap[loc.x][loc.y];
    if (currentHeat === 0) {
        return;
    }

    totalHeat.value -= heatMap[loc.x][loc.y];
    heatMap[loc.x][loc.y] = 0;

    // Lower the heat near the chosen location
    for (let k = -5; k <= 5; k++) {
        for (let l = -5; l <= 5; l++) {
            if (
                coordinatesAreInMap(loc.x + k, loc.y + l)
                && heatMap[loc.x + k][loc.y + l] === currentHeat
            ) {
                const reducedHeat = Math.max(1, Math.floor(heatMap[loc.x + k][loc.y + l] / 10));
                totalHeat.value -= (heatMap[loc.x + k][loc.y + l] - reducedHeat);
                heatMap[loc.x + k][loc.y + l] = reducedHeat;
            }
        }
    }
}

/**
 * Choose a random location from the heat map, weighted by heat values.
 *
 * C equivalent: `getItemSpawnLoc(heatMap, x, y, totalHeat)` in Items.c
 *
 * @returns The chosen position, or null if totalHeat is zero.
 */
function getItemSpawnLoc(
    heatMap: number[][],
    totalHeat: { value: number },
    rng: ItemRNG,
): Pos | null {
    if (totalHeat.value <= 0) {
        return null;
    }

    let randIndex = rng.randRange(1, totalHeat.value);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const currentHeat = heatMap[i][j];
            if (randIndex <= currentHeat) {
                return { x: i, y: j };
            }
            randIndex -= currentHeat;
        }
    }

    // Should never get here if totalHeat is accurate
    return null;
}

// =============================================================================
// Main population function
// =============================================================================

/**
 * Generates and places items for the level. Must pass the location of the
 * up-stairway on the level.
 *
 * C equivalent: `populateItems(pos upstairs)` in Items.c
 *
 * Side effects:
 *  - Calls ctx.placeItemAt for each generated item
 *  - Updates ctx.state.goldGenerated, ctx.state.foodSpawned
 *  - Updates ctx.state.meteredItems frequencies and spawn counts
 *  - May patch isolated cells to WALL via ctx.setDungeonLayer
 */
export function populateItems(
    upstairs: Pos,
    ctx: PopulateItemsContext,
): void {
    const { state, gameConstants: gc, rng } = ctx;

    let numberOfItems: number;
    let numberOfGoldPiles: number;

    // Create mutable copies of potion/scroll tables.
    // In the C code, the global tables are modified during generation and
    // then restored from copies. Here we work on copies directly, so
    // the originals are never modified.
    const mutablePotionTable: ItemTable[] = ctx.potionTable.map(e => ({ ...e }));
    const mutableScrollTable: ItemTable[] = ctx.scrollTable.map(e => ({ ...e }));

    // ---- Determine number of items and gold piles ----

    if (state.depthLevel > gc.amuletLevel) {
        // Post-amulet: only lumenstones, no gold
        numberOfItems = ctx.lumenstoneDistribution[state.depthLevel - gc.amuletLevel - 1];
        numberOfGoldPiles = 0;
    } else {
        // Add frequency to metered items memory
        for (let i = 0; i < gc.numberMeteredItems; i++) {
            state.meteredItems[i].frequency += ctx.meteredItemsGenerationTable[i].incrementFrequency;
        }

        // Base number of items with random component
        numberOfItems = 3;
        while (rng.randPercent(60)) {
            numberOfItems++;
        }

        // Bonus items on early levels
        if (state.depthLevel <= 2) {
            numberOfItems += 2; // 4 extra items to kickstart your career as a rogue
        } else if (state.depthLevel <= 4) {
            numberOfItems++; // and 2 more here
        }

        numberOfItems += gc.extraItemsPerLevel;

        // Gold pile count
        numberOfGoldPiles = Math.min(
            5,
            Math.floor(state.depthLevel * state.depthAccelerator / 4),
        );
        for (
            let goldBonusProbability = 60;
            rng.randPercent(goldBonusProbability) && numberOfGoldPiles <= 10;
            goldBonusProbability -= 15
        ) {
            numberOfGoldPiles++;
        }

        // Adjust gold if past the adjustment start depth
        if (state.depthLevel >= gc.goldAdjustmentStartDepth) {
            const dIndex = state.depthLevel * state.depthAccelerator - 1;
            if (state.goldGenerated < aggregateGoldLowerBound(dIndex)) {
                numberOfGoldPiles += 2;
            } else if (state.goldGenerated > aggregateGoldUpperBound(dIndex)) {
                numberOfGoldPiles -= 2;
            }
        }
    }

    // ---- Build the item spawn heat map ----

    const itemSpawnHeatMap: number[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        itemSpawnHeatMap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            itemSpawnHeatMap[i][j] = 50000;
        }
    }

    fillItemSpawnHeatMap(itemSpawnHeatMap, 5, upstairs, ctx);

    const totalHeat: { value: number } = { value: 0 };

    const IS_CHOKEPOINT = TileFlag.IS_CHOKEPOINT;
    const IN_LOOP = TileFlag.IN_LOOP;
    const IS_IN_MACHINE = (TileFlag.IS_IN_ROOM_MACHINE | TileFlag.IS_IN_AREA_MACHINE) >>> 0;

    for (let j = 0; j < DROWS; j++) {
        for (let i = 0; i < DCOLS; i++) {
            const pos: Pos = { x: i, y: j };
            if (
                ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_ITEMS | T_PATHING_BLOCKER)
                || (ctx.getCellFlags(i, j) & (IS_CHOKEPOINT | IN_LOOP | IS_IN_MACHINE))
                || ctx.passableArcCount(i, j) > 1
            ) {
                // Not in walls, hallways, quest rooms, loops or chokepoints
                itemSpawnHeatMap[i][j] = 0;
            } else if (itemSpawnHeatMap[i][j] === 50000) {
                itemSpawnHeatMap[i][j] = 0;
                // Failsafe: patch isolated one-cell islands to WALL
                ctx.setDungeonLayer(i, j, TileType.WALL);
            }
            totalHeat.value += itemSpawnHeatMap[i][j];
        }
    }

    // ---- Random depth offset for food/life potion scheduling ----

    let randomDepthOffset = 0;
    if (state.depthLevel > 2) {
        randomDepthOffset = rng.randRange(-1, 1);
        randomDepthOffset += rng.randRange(-1, 1);
    }

    // ---- Generate items ----

    for (let i = 0; i < numberOfItems; i++) {
        let theCategory: number = ALL_ITEMS & ~ItemCategory.GOLD;
        let theKind = -1;

        // Set metered item table frequencies from memory.
        for (let j = 0; j < gc.numberMeteredItems; j++) {
            if (ctx.meteredItemsGenerationTable[j].incrementFrequency !== 0) {
                if (j >= gc.numberScrollKinds) {
                    mutablePotionTable[j - gc.numberScrollKinds].frequency =
                        state.meteredItems[j].frequency;
                } else {
                    mutableScrollTable[j].frequency =
                        state.meteredItems[j].frequency;
                }
            }
        }

        // Adjust the desired item category if necessary.
        const rationPower = BigInt(foodTable[FoodKind.Ration].power);
        const foodLeft = (state.foodSpawned + rationPower / 3n) * 4n * FP_FACTOR;
        const depthIdx = state.depthLevel - 1;
        const foodNeeded =
            (POW_FOOD[depthIdx] + BigInt(randomDepthOffset) * FP_FACTOR)
            * rationPower * 45n / 100n;

        if (foodLeft <= foodNeeded) {
            // Guarantee a certain nutrition minimum
            theCategory = ItemCategory.FOOD;
            if (state.depthLevel > gc.amuletLevel) {
                numberOfItems++; // Food isn't at the expense of lumenstones
            }
        } else if (state.depthLevel > gc.amuletLevel) {
            theCategory = ItemCategory.GEM;
        } else {
            // Check metered item generation thresholds
            for (let j = 0; j < gc.numberMeteredItems; j++) {
                const entry = ctx.meteredItemsGenerationTable[j];
                // Create any metered items that reach generation thresholds
                if (
                    entry.levelScaling !== 0
                    && state.meteredItems[j].numberSpawned * entry.genMultiplier + entry.genIncrement
                        < state.depthLevel * entry.levelScaling + randomDepthOffset
                ) {
                    theCategory = entry.category;
                    theKind = entry.kind;
                    break;
                }
                // Create any metered items that reach hard by-level guarantees
                if (
                    state.depthLevel === entry.levelGuarantee
                    && state.meteredItems[j].numberSpawned < entry.itemNumberGuarantee
                ) {
                    theCategory = entry.category;
                    theKind = entry.kind;
                    break;
                }
            }
        }

        // Build ItemGenContext for generateItem
        const itemGenCtx: ItemGenContext = {
            rng,
            gameConstants: gc,
            depthLevel: state.depthLevel,
            scrollTable: mutableScrollTable,
            potionTable: mutablePotionTable,
            depthAccelerator: state.depthAccelerator,
            chooseVorpalEnemy: ctx.chooseVorpalEnemy,
        };

        // Generate the item
        const theItem = generateItem(theCategory, theKind, itemGenCtx);
        theItem.originDepth = state.depthLevel;

        // Track food spawning
        if (theItem.category & ItemCategory.FOOD) {
            state.foodSpawned += BigInt(foodTable[theItem.kind].power);
        }

        // Choose a placement location
        let itemPlacementLoc: Pos | null = null;

        if (
            (theItem.category & ItemCategory.FOOD)
            || ((theItem.category & ItemCategory.POTION) && theItem.kind === PotionKind.Strength)
        ) {
            // Food and strength potions don't follow the heat map.
            // Place on a random floor tile, not in a hallway.
            let attempts = 0;
            do {
                itemPlacementLoc = ctx.randomMatchingLocation(
                    TileType.FLOOR, TileType.NOTHING, -1,
                );
                attempts++;
            } while (
                itemPlacementLoc !== null
                && ctx.passableArcCount(itemPlacementLoc.x, itemPlacementLoc.y) > 1
                && attempts < 500
            );
        } else {
            itemPlacementLoc = getItemSpawnLoc(itemSpawnHeatMap, totalHeat, rng);
        }

        if (itemPlacementLoc === null) {
            // Fallback — shouldn't normally happen
            continue;
        }

        // Cool off the item spawning heat map at the chosen location
        coolHeatMapAt(itemSpawnHeatMap, itemPlacementLoc, totalHeat);

        // Remove frequency from spawned metered items memory
        for (let j = 0; j < gc.numberMeteredItems; j++) {
            const entry = ctx.meteredItemsGenerationTable[j];
            if (
                (theItem.category & entry.category)
                && theItem.kind === entry.kind
            ) {
                state.meteredItems[j].frequency -= entry.decrementFrequency;
                state.meteredItems[j].numberSpawned++;
            }
        }

        // Place the item
        ctx.placeItemAt(theItem, itemPlacementLoc);
    }

    // ---- Generate gold ----

    for (let i = 0; i < numberOfGoldPiles; i++) {
        const itemGenCtx: ItemGenContext = {
            rng,
            gameConstants: gc,
            depthLevel: state.depthLevel,
            scrollTable: mutableScrollTable,
            potionTable: mutablePotionTable,
            depthAccelerator: state.depthAccelerator,
            chooseVorpalEnemy: ctx.chooseVorpalEnemy,
        };

        const theItem = generateItem(ItemCategory.GOLD, -1, itemGenCtx);
        const itemPlacementLoc = getItemSpawnLoc(itemSpawnHeatMap, totalHeat, rng);
        if (itemPlacementLoc === null) {
            continue;
        }

        coolHeatMapAt(itemSpawnHeatMap, itemPlacementLoc, totalHeat);
        ctx.placeItemAt(theItem, itemPlacementLoc);
        state.goldGenerated += theItem.quantity;
    }
}

// =============================================================================
// Exported heat map helpers (for testing)
// =============================================================================

/** @internal — exported for testing only */
export const _testing = {
    fillItemSpawnHeatMap,
    coolHeatMapAt,
    getItemSpawnLoc,
    POW_GOLD,
    POW_FOOD,
    aggregateGoldLowerBound,
    aggregateGoldUpperBound,
};
