/*
 *  item-ops.test.ts — Tests for the ItemOps factory bridge
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createItemOps } from "../../src/items/item-ops.js";
import type { ItemOpsContext } from "../../src/items/item-ops.js";
import type { Item, Pcell, GameConstants, ItemTable } from "../../src/types/types.js";
import type { ItemGenContext } from "../../src/items/item-generation.js";
import { initializeItem } from "../../src/items/item-generation.js";
import { ItemCategory, WeaponKind, ArmorKind, TileType, MonsterType, PotionKind } from "../../src/types/enums.js";
import { TileFlag, ItemFlag } from "../../src/types/flags.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS, KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { seedRandomGenerator } from "../../src/math/rng.js";
import { potionTable, scrollTable, weaponTable } from "../../src/globals/item-catalog.js";

// =============================================================================
// Helpers
// =============================================================================

function makeRNG() {
    return {
        randRange: (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1)),
        randPercent: (pct: number) => Math.random() * 100 < pct,
        randClump: (r: { lowerBound: number; upperBound: number; clumpFactor: number }) =>
            r.lowerBound + Math.floor(Math.random() * (r.upperBound - r.lowerBound + 1)),
    };
}

function makeGameConstants(): GameConstants {
    return {
        amuletLevel: 26,
        deepestLevel: 40,
        depthAccelerator: 1,
        numberOfLumenstones: 23,
        machinesPerLevelSuppressionMultiplier: 100,
        machinesPerLevelSuppressionOffset: 0,
        machinesPerLevelIncreaseFactor: 200,
        maxLevelForBonusMachines: 5,
        deepestLevelForMachines: 37,
        numberBlueprints: 0,
        numberAutogenerators: 0,
    };
}

function makeGenCtx(seed: bigint = 12345n): ItemGenContext {
    seedRandomGenerator(seed);
    return {
        rng: makeRNG(),
        gameConstants: makeGameConstants(),
        depthLevel: 5,
        scrollTable: scrollTable.map(e => ({ ...e })),
        potionTable: potionTable.map(e => ({ ...e })),
        depthAccelerator: 1,
        chooseVorpalEnemy: () => MonsterType.MK_RAT,
    };
}

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING);
            layers[0] = TileType.FLOOR;
            pmap[i][j] = {
                layers,
                flags: 0,
                machineNumber: 0,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                rememberedItemCategory: 0,
                rememberedItemKind: 0,
                rememberedItemQuantity: 0,
                rememberedItemFlags: 0,
                volume: 0,
                exposedToFire: 0,
            };
        }
    }
    return pmap;
}

function makeItemOpsCtx(seed: bigint = 12345n): { ctx: ItemOpsContext; pmap: Pcell[][]; floorItems: Item[] } {
    const pmap = makePmap();
    const floorItems: Item[] = [];
    return {
        ctx: {
            genCtx: makeGenCtx(seed),
            pmap,
            floorItems,
        },
        pmap,
        floorItems,
    };
}

// =============================================================================
// createItemOps
// =============================================================================

describe("createItemOps", () => {
    it("generates an item with the given category and kind", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Sword);
        expect(item.category).toBe(ItemCategory.WEAPON);
        expect(item.kind).toBe(WeaponKind.Sword);
    });

    it("generateItem returns a full Item object (not just MachineItem)", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Sword) as Item;
        // Full Item should have fields like enchant1, armor, etc.
        expect(item.enchant1).toBeDefined();
        expect(item.inventoryLetter).toBeDefined();
    });

    it("placeItemAt sets item location", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger) as Item;
        ops.placeItemAt(item, { x: 10, y: 15 });
        expect(item.loc).toEqual({ x: 10, y: 15 });
    });

    it("placeItemAt adds item to floorItems", () => {
        const { ctx, floorItems } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
        expect(floorItems.length).toBe(0);
        ops.placeItemAt(item, { x: 10, y: 15 });
        expect(floorItems.length).toBe(1);
        expect(floorItems[0]).toBe(item);
    });

    it("placeItemAt sets HAS_ITEM flag on pmap", () => {
        const { ctx, pmap } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.ARMOR, ArmorKind.LeatherArmor);
        expect(pmap[10][15].flags & TileFlag.HAS_ITEM).toBe(0);
        ops.placeItemAt(item, { x: 10, y: 15 });
        expect(pmap[10][15].flags & TileFlag.HAS_ITEM).not.toBe(0);
    });

    it("placeItemAt sets ITEM_DETECTED when item is magic-detected", () => {
        const { ctx, pmap } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Sword) as Item;
        item.flags |= ItemFlag.ITEM_MAGIC_DETECTED;
        item.enchant1 = 3; // positive enchantment → has polarity
        ops.placeItemAt(item, { x: 20, y: 10 });
        expect(pmap[20][10].flags & TileFlag.ITEM_DETECTED).not.toBe(0);
    });

    it("placeItemAt does not double-add when called twice", () => {
        const { ctx, floorItems } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
        ops.placeItemAt(item, { x: 10, y: 15 });
        ops.placeItemAt(item, { x: 20, y: 20 }); // re-place same item
        // Should only appear once in floorItems
        expect(floorItems.length).toBe(1);
        expect((floorItems[0] as Item).loc).toEqual({ x: 20, y: 20 });
    });

    it("removeItemFromArray removes item from floor items", () => {
        const { ctx, floorItems } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item1 = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
        const item2 = ops.generateItem(ItemCategory.ARMOR, ArmorKind.LeatherArmor);
        ops.placeItemAt(item1, { x: 5, y: 5 });
        ops.placeItemAt(item2, { x: 10, y: 10 });
        expect(floorItems.length).toBe(2);
        ops.removeItemFromArray(item1, floorItems);
        expect(floorItems.length).toBe(1);
        expect(floorItems[0]).toBe(item2);
    });

    it("deleteItem is a no-op (GC handles cleanup)", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
        // Should not throw
        expect(() => ops.deleteItem(item)).not.toThrow();
    });

    it("itemIsHeavyWeapon returns true for heavy weapons", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        // War hammer (Hammer) has strengthRequired=20 > 15 and is not a throwing weapon
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Hammer);
        expect(ops.itemIsHeavyWeapon(item)).toBe(true);
    });

    it("itemIsHeavyWeapon returns false for light weapons", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
        expect(ops.itemIsHeavyWeapon(item)).toBe(false);
    });

    it("itemIsPositivelyEnchanted checks enchant1", () => {
        const { ctx } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Sword) as Item;
        item.enchant1 = 3;
        expect(ops.itemIsPositivelyEnchanted(item)).toBe(true);
        item.enchant1 = 0;
        expect(ops.itemIsPositivelyEnchanted(item)).toBe(false);
        item.enchant1 = -1;
        expect(ops.itemIsPositivelyEnchanted(item)).toBe(false);
    });

    it("multiple items can be placed and tracked", () => {
        const { ctx, floorItems, pmap } = makeItemOpsCtx();
        const ops = createItemOps(ctx);
        for (let i = 0; i < 5; i++) {
            const item = ops.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
            ops.placeItemAt(item, { x: 10 + i, y: 10 });
        }
        expect(floorItems.length).toBe(5);
        // All cells should have HAS_ITEM
        for (let i = 0; i < 5; i++) {
            expect(pmap[10 + i][10].flags & TileFlag.HAS_ITEM).not.toBe(0);
        }
    });
});
