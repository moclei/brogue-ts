/*
 *  item-generation.test.ts — Tests for item creation and generation
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    initializeItem,
    generateItem,
    makeItemInto,
    pickItemCategory,
    chooseKind,
    getItemCategoryGlyph,
    itemIsThrowingWeapon,
    itemIsHeavyWeapon,
    itemIsPositivelyEnchanted,
    itemMagicPolarity,
    getHallucinatedItemCategory,
    getTableForCategory,
    getKindCountForCategory,
} from "../../src/items/item-generation.js";
import type { ItemGenContext, ItemRNG } from "../../src/items/item-generation.js";
import type { Item, GameConstants, ItemTable } from "../../src/types/types.js";
import { DisplayGlyph, ItemCategory, ALL_ITEMS, WeaponKind, ArmorKind, MonsterType } from "../../src/types/enums.js";
import { ItemFlag } from "../../src/types/flags.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { seedRandomGenerator, randRange, randPercent, randClump } from "../../src/math/rng.js";
import {
    keyTable, foodTable, weaponTable, armorTable, scrollTable, potionTable,
    staffTable, wandTable, ringTable, charmTable,
} from "../../src/globals/item-catalog.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Create a deterministic RNG wrapper for tests. */
function makeRNG(): ItemRNG {
    return {
        randRange,
        randPercent,
        randClump,
    };
}

/** Minimal game constants matching the Brogue variant. */
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

/** Create a standard ItemGenContext for testing. */
function makeCtx(seed: bigint = 12345n): ItemGenContext {
    seedRandomGenerator(seed);
    const rng = makeRNG();
    const gc = makeGameConstants();
    return {
        rng,
        gameConstants: gc,
        depthLevel: 1,
        scrollTable: scrollTable.map((e) => ({ ...e })),
        potionTable: potionTable.map((e) => ({ ...e })),
        depthAccelerator: 1,
        chooseVorpalEnemy: () => MonsterType.MK_RAT,
    };
}

// =============================================================================
// initializeItem
// =============================================================================

describe("initializeItem", () => {
    it("should create an item with default values", () => {
        const item = initializeItem();

        expect(item.category).toBe(0);
        expect(item.kind).toBe(0);
        expect(item.flags).toBe(0);
        expect(item.armor).toBe(0);
        expect(item.charges).toBe(0);
        expect(item.enchant1).toBe(0);
        expect(item.enchant2).toBe(0);
        expect(item.timesEnchanted).toBe(0);
        expect(item.quantity).toBe(1);
        expect(item.quiverNumber).toBe(0);
        expect(item.originDepth).toBe(0);
        expect(item.inventoryLetter).toBe("");
        expect(item.inscription).toBe("");
        expect(item.lastUsed).toEqual([0, 0, 0]);
    });

    it("should initialize keyLoc array with KEY_ID_MAXIMUM entries", () => {
        const item = initializeItem();

        expect(item.keyLoc).toHaveLength(KEY_ID_MAXIMUM);
        for (const kl of item.keyLoc) {
            expect(kl.loc).toEqual({ x: 0, y: 0 });
            expect(kl.machine).toBe(0);
            expect(kl.disposableHere).toBe(false);
        }
    });

    it("should set default colors", () => {
        const item = initializeItem();

        expect(item.foreColor).toBeTruthy();
        expect(item.inventoryColor).toBeTruthy();
    });
});

// =============================================================================
// getItemCategoryGlyph
// =============================================================================

describe("getItemCategoryGlyph", () => {
    it("should return correct glyphs for all categories", () => {
        expect(getItemCategoryGlyph(ItemCategory.FOOD)).toBe(DisplayGlyph.G_FOOD);
        expect(getItemCategoryGlyph(ItemCategory.WEAPON)).toBe(DisplayGlyph.G_WEAPON);
        expect(getItemCategoryGlyph(ItemCategory.ARMOR)).toBe(DisplayGlyph.G_ARMOR);
        expect(getItemCategoryGlyph(ItemCategory.SCROLL)).toBe(DisplayGlyph.G_SCROLL);
        expect(getItemCategoryGlyph(ItemCategory.POTION)).toBe(DisplayGlyph.G_POTION);
        expect(getItemCategoryGlyph(ItemCategory.STAFF)).toBe(DisplayGlyph.G_STAFF);
        expect(getItemCategoryGlyph(ItemCategory.WAND)).toBe(DisplayGlyph.G_WAND);
        expect(getItemCategoryGlyph(ItemCategory.GEM)).toBe(DisplayGlyph.G_GEM);
        expect(getItemCategoryGlyph(ItemCategory.RING)).toBe(DisplayGlyph.G_RING);
        expect(getItemCategoryGlyph(ItemCategory.CHARM)).toBe(DisplayGlyph.G_CHARM);
        expect(getItemCategoryGlyph(ItemCategory.KEY)).toBe(DisplayGlyph.G_KEY);
        expect(getItemCategoryGlyph(ItemCategory.GOLD)).toBe(DisplayGlyph.G_GOLD);
        expect(getItemCategoryGlyph(ItemCategory.AMULET)).toBe(DisplayGlyph.G_AMULET);
    });

    it("should return 0 for unknown category", () => {
        expect(getItemCategoryGlyph(0)).toBe(0);
    });
});

// =============================================================================
// pickItemCategory
// =============================================================================

describe("pickItemCategory", () => {
    it("should return a valid item category bitmask", () => {
        const ctx = makeCtx(42n);
        const category = pickItemCategory(ALL_ITEMS, ctx.rng);

        // Should be a single-bit category
        const validCategories = [
            ItemCategory.GOLD, ItemCategory.SCROLL, ItemCategory.POTION,
            ItemCategory.STAFF, ItemCategory.WAND, ItemCategory.WEAPON,
            ItemCategory.ARMOR, ItemCategory.FOOD, ItemCategory.RING,
            ItemCategory.CHARM,
        ];
        expect(validCategories).toContain(category);
    });

    it("should restrict to the given category mask", () => {
        const ctx = makeCtx(999n);
        // Only allow WEAPON | ARMOR
        const mask = ItemCategory.WEAPON | ItemCategory.ARMOR;
        const category = pickItemCategory(mask, ctx.rng);

        expect(category === ItemCategory.WEAPON || category === ItemCategory.ARMOR).toBe(true);
    });

    it("should return the passed category when it has no frequency (e.g. AMULET)", () => {
        const ctx = makeCtx(1n);
        const category = pickItemCategory(ItemCategory.AMULET, ctx.rng);
        expect(category).toBe(ItemCategory.AMULET);
    });

    it("should be deterministic with same seed", () => {
        const ctx1 = makeCtx(777n);
        const cat1 = pickItemCategory(ALL_ITEMS, ctx1.rng);
        const ctx2 = makeCtx(777n);
        const cat2 = pickItemCategory(ALL_ITEMS, ctx2.rng);
        expect(cat1).toBe(cat2);
    });
});

// =============================================================================
// chooseKind
// =============================================================================

describe("chooseKind", () => {
    it("should return a valid weapon kind", () => {
        const ctx = makeCtx(100n);
        const kind = chooseKind(weaponTable, weaponTable.length, ctx.rng);
        expect(kind).toBeGreaterThanOrEqual(0);
        expect(kind).toBeLessThan(weaponTable.length);
    });

    it("should be deterministic with same seed", () => {
        const ctx1 = makeCtx(200n);
        const kind1 = chooseKind(potionTable, potionTable.length, ctx1.rng);
        const ctx2 = makeCtx(200n);
        const kind2 = chooseKind(potionTable, potionTable.length, ctx2.rng);
        expect(kind1).toBe(kind2);
    });

    it("should respect frequency weights (zero-frequency items are skipped)", () => {
        // Life potion and Strength potion have frequency=0 in the base table
        const ctx = makeCtx(300n);
        const results = new Set<number>();
        for (let i = 0; i < 100; i++) {
            seedRandomGenerator(BigInt(i + 300));
            results.add(chooseKind(potionTable, potionTable.length, ctx.rng));
        }
        // Should never get kind 0 (life) or kind 1 (strength) since their frequency is 0
        expect(results.has(0)).toBe(false);
        expect(results.has(1)).toBe(false);
    });
});

// =============================================================================
// generateItem / makeItemInto
// =============================================================================

describe("generateItem", () => {
    it("should generate a food item when FOOD category specified", () => {
        const ctx = makeCtx(500n);
        const item = generateItem(ItemCategory.FOOD, -1, ctx);

        expect(item.category).toBe(ItemCategory.FOOD);
        expect(item.kind).toBeGreaterThanOrEqual(0);
        expect(item.kind).toBeLessThan(foodTable.length);
        expect(item.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
        expect(item.displayChar).toBe(DisplayGlyph.G_FOOD);
    });

    it("should generate a weapon with correct properties", () => {
        const ctx = makeCtx(600n);
        const item = generateItem(ItemCategory.WEAPON, WeaponKind.Sword, ctx);

        expect(item.category).toBe(ItemCategory.WEAPON);
        expect(item.kind).toBe(WeaponKind.Sword);
        expect(item.damage.lowerBound).toBe(7);
        expect(item.damage.upperBound).toBe(9);
        expect(item.strengthRequired).toBe(14);
        expect(item.charges).toBe(20); // weaponKillsToAutoID
        expect(item.displayChar).toBe(DisplayGlyph.G_WEAPON);
    });

    it("should set dagger sneak attack bonus flag", () => {
        const ctx = makeCtx(700n);
        const item = generateItem(ItemCategory.WEAPON, WeaponKind.Dagger, ctx);

        expect(item.flags & ItemFlag.ITEM_SNEAK_ATTACK_BONUS).toBeTruthy();
    });

    it("should set stagger flag for mace and hammer", () => {
        const ctx1 = makeCtx(800n);
        const mace = generateItem(ItemCategory.WEAPON, WeaponKind.Mace, ctx1);
        expect(mace.flags & ItemFlag.ITEM_ATTACKS_STAGGER).toBeTruthy();

        const ctx2 = makeCtx(801n);
        const hammer = generateItem(ItemCategory.WEAPON, WeaponKind.Hammer, ctx2);
        expect(hammer.flags & ItemFlag.ITEM_ATTACKS_STAGGER).toBeTruthy();
    });

    it("should generate throwing weapons with quantity > 1", () => {
        const ctx = makeCtx(900n);
        const darts = generateItem(ItemCategory.WEAPON, WeaponKind.Dart, ctx);

        expect(darts.quantity).toBeGreaterThanOrEqual(5);
        expect(darts.quantity).toBeLessThanOrEqual(18);
        expect(darts.quiverNumber).toBeGreaterThan(0);
        expect(darts.flags & ItemFlag.ITEM_CURSED).toBeFalsy();
        expect(darts.flags & ItemFlag.ITEM_RUNIC).toBeFalsy();
        expect(darts.enchant1).toBe(0);
    });

    it("should generate armor with correct range", () => {
        const ctx = makeCtx(1000n);
        const armor = generateItem(ItemCategory.ARMOR, ArmorKind.LeatherArmor, ctx);

        expect(armor.category).toBe(ItemCategory.ARMOR);
        expect(armor.kind).toBe(ArmorKind.LeatherArmor);
        expect(armor.armor).toBe(30); // leather armor has {30,30,0} — no variance
        expect(armor.strengthRequired).toBe(10);
        expect(armor.charges).toBe(1000); // armorDelayToAutoID
    });

    it("should set ITEM_FLAMMABLE for scrolls", () => {
        const ctx = makeCtx(1100n);
        const scroll = generateItem(ItemCategory.SCROLL, 1, ctx);

        expect(scroll.category).toBe(ItemCategory.SCROLL);
        expect(scroll.flags & ItemFlag.ITEM_FLAMMABLE).toBeTruthy();
    });

    it("should generate staff with charges between 2 and many", () => {
        const ctx = makeCtx(1200n);
        const staff = generateItem(ItemCategory.STAFF, 0, ctx);

        expect(staff.category).toBe(ItemCategory.STAFF);
        expect(staff.charges).toBeGreaterThanOrEqual(2);
        expect(staff.enchant1).toBe(staff.charges);
    });

    it("should generate wand with charges from table range", () => {
        const ctx = makeCtx(1300n);
        const wand = generateItem(ItemCategory.WAND, 0, ctx);

        expect(wand.category).toBe(ItemCategory.WAND);
        expect(wand.charges).toBeGreaterThanOrEqual(wandTable[0].range.lowerBound);
        expect(wand.charges).toBeLessThanOrEqual(wandTable[0].range.upperBound);
    });

    it("should generate ring with enchantment from table range", () => {
        const ctx = makeCtx(1400n);
        const ring = generateItem(ItemCategory.RING, 0, ctx);

        expect(ring.category).toBe(ItemCategory.RING);
        // Enchant can be positive or negative (cursed)
        expect(Math.abs(ring.enchant1)).toBeGreaterThanOrEqual(1);
        expect(ring.charges).toBe(1500); // ringDelayToAutoID
    });

    it("should generate charm with ITEM_IDENTIFIED flag", () => {
        const ctx = makeCtx(1500n);
        const charm = generateItem(ItemCategory.CHARM, 0, ctx);

        expect(charm.category).toBe(ItemCategory.CHARM);
        expect(charm.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
        expect(charm.charges).toBe(0); // charms start ready
        expect(charm.enchant1).toBeGreaterThanOrEqual(1);
    });

    it("should generate gold with positive quantity based on depth", () => {
        const ctx = makeCtx(1600n);
        const gold = generateItem(ItemCategory.GOLD, -1, ctx);

        expect(gold.category).toBe(ItemCategory.GOLD);
        expect(gold.quantity).toBeGreaterThan(0);
    });

    it("should set ITEM_IDENTIFIED for amulet, gem, and key", () => {
        const ctx1 = makeCtx(1700n);
        const amulet = generateItem(ItemCategory.AMULET, -1, ctx1);
        expect(amulet.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();

        const ctx2 = makeCtx(1701n);
        const gem = generateItem(ItemCategory.GEM, -1, ctx2);
        expect(gem.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();

        const ctx3 = makeCtx(1702n);
        const key = generateItem(ItemCategory.KEY, 0, ctx3);
        expect(key.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
    });

    it("should set ITEM_CAN_BE_IDENTIFIED for unidentified items", () => {
        const ctx = makeCtx(1800n);
        const staff = generateItem(ItemCategory.STAFF, 0, ctx);

        expect(staff.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED).toBeTruthy();
        expect(staff.flags & ItemFlag.ITEM_IDENTIFIED).toBeFalsy();
    });
});

// =============================================================================
// Seed-based determinism
// =============================================================================

describe("deterministic generation", () => {
    it("should produce identical items from same seed", () => {
        const seed = 42424242n;
        const ctx1 = makeCtx(seed);
        const item1 = generateItem(ItemCategory.WEAPON, -1, ctx1);

        const ctx2 = makeCtx(seed);
        const item2 = generateItem(ItemCategory.WEAPON, -1, ctx2);

        expect(item1.kind).toBe(item2.kind);
        expect(item1.enchant1).toBe(item2.enchant1);
        expect(item1.enchant2).toBe(item2.enchant2);
        expect(item1.flags).toBe(item2.flags);
        expect(item1.damage).toEqual(item2.damage);
    });

    it("should produce different items from different seeds", () => {
        const results = new Set<string>();
        for (let seed = 1n; seed <= 50n; seed++) {
            const ctx = makeCtx(seed * 12345n);
            const item = generateItem(ALL_ITEMS & ~ItemCategory.GOLD, -1, ctx);
            results.add(`${item.category}-${item.kind}`);
        }
        // With 50 different seeds, we should get variety
        expect(results.size).toBeGreaterThan(3);
    });
});

// =============================================================================
// Item classification helpers
// =============================================================================

describe("itemIsThrowingWeapon", () => {
    it("should return true for darts, javelins, and incendiary darts", () => {
        const ctx = makeCtx(2000n);
        const dart = generateItem(ItemCategory.WEAPON, WeaponKind.Dart, ctx);
        expect(itemIsThrowingWeapon(dart)).toBe(true);

        const ctx2 = makeCtx(2001n);
        const jav = generateItem(ItemCategory.WEAPON, WeaponKind.Javelin, ctx2);
        expect(itemIsThrowingWeapon(jav)).toBe(true);

        const ctx3 = makeCtx(2002n);
        const inc = generateItem(ItemCategory.WEAPON, WeaponKind.IncendiaryDart, ctx3);
        expect(itemIsThrowingWeapon(inc)).toBe(true);
    });

    it("should return false for non-throwing weapons", () => {
        const ctx = makeCtx(2100n);
        const sword = generateItem(ItemCategory.WEAPON, WeaponKind.Sword, ctx);
        expect(itemIsThrowingWeapon(sword)).toBe(false);
    });

    it("should return false for non-weapon items", () => {
        const ctx = makeCtx(2200n);
        const food = generateItem(ItemCategory.FOOD, -1, ctx);
        expect(itemIsThrowingWeapon(food)).toBe(false);
    });
});

describe("itemIsHeavyWeapon", () => {
    it("should return true for heavy weapons (strength > 15)", () => {
        const ctx = makeCtx(2300n);
        const broadsword = generateItem(ItemCategory.WEAPON, WeaponKind.Broadsword, ctx);
        expect(itemIsHeavyWeapon(broadsword)).toBe(true); // str 19
    });

    it("should return false for light weapons", () => {
        const ctx = makeCtx(2400n);
        const dagger = generateItem(ItemCategory.WEAPON, WeaponKind.Dagger, ctx);
        expect(itemIsHeavyWeapon(dagger)).toBe(false); // str 12
    });

    it("should return false for throwing weapons even if strong", () => {
        const ctx = makeCtx(2500n);
        const javelin = generateItem(ItemCategory.WEAPON, WeaponKind.Javelin, ctx);
        expect(itemIsHeavyWeapon(javelin)).toBe(false);
    });
});

describe("itemIsPositivelyEnchanted", () => {
    it("should return true for positive enchantment", () => {
        const item = initializeItem();
        item.enchant1 = 3;
        expect(itemIsPositivelyEnchanted(item)).toBe(true);
    });

    it("should return false for zero or negative enchantment", () => {
        const item = initializeItem();
        item.enchant1 = 0;
        expect(itemIsPositivelyEnchanted(item)).toBe(false);
        item.enchant1 = -2;
        expect(itemIsPositivelyEnchanted(item)).toBe(false);
    });
});

describe("itemMagicPolarity", () => {
    it("should return polarity from table for potions and scrolls", () => {
        const ctx = makeCtx(2600n);
        // Potion of life has polarity 1
        const life = generateItem(ItemCategory.POTION, 0, ctx);
        expect(itemMagicPolarity(life)).toBe(1);
    });

    it("should return polarity based on enchantment for weapons", () => {
        const item = initializeItem();
        item.category = ItemCategory.WEAPON;
        item.kind = 0;
        item.enchant1 = 2;
        expect(itemMagicPolarity(item)).toBe(1);

        item.enchant1 = -1;
        expect(itemMagicPolarity(item)).toBe(-1);

        item.enchant1 = 0;
        expect(itemMagicPolarity(item)).toBe(0);
    });
});

// =============================================================================
// getTableForCategory / getKindCountForCategory
// =============================================================================

describe("getTableForCategory", () => {
    it("should return correct tables for all item categories", () => {
        expect(getTableForCategory(ItemCategory.FOOD)).toBe(foodTable);
        expect(getTableForCategory(ItemCategory.WEAPON)).toBe(weaponTable);
        expect(getTableForCategory(ItemCategory.ARMOR)).toBe(armorTable);
        expect(getTableForCategory(ItemCategory.STAFF)).toBe(staffTable);
        expect(getTableForCategory(ItemCategory.RING)).toBe(ringTable);
        expect(getTableForCategory(ItemCategory.KEY)).toBe(keyTable);
    });

    it("should use context-provided mutable tables for scroll/potion", () => {
        const mutableScrolls = scrollTable.map((e) => ({ ...e }));
        const mutablePotions = potionTable.map((e) => ({ ...e }));

        expect(getTableForCategory(ItemCategory.SCROLL, {
            scrollTable: mutableScrolls,
        })).toBe(mutableScrolls);

        expect(getTableForCategory(ItemCategory.POTION, {
            potionTable: mutablePotions,
        })).toBe(mutablePotions);
    });

    it("should return null for categories without tables", () => {
        expect(getTableForCategory(ItemCategory.GOLD)).toBeNull();
        expect(getTableForCategory(ItemCategory.AMULET)).toBeNull();
        expect(getTableForCategory(ItemCategory.GEM)).toBeNull();
    });
});

describe("getKindCountForCategory", () => {
    const gc = makeGameConstants();

    it("should return correct counts", () => {
        expect(getKindCountForCategory(ItemCategory.FOOD, gc)).toBe(2);
        expect(getKindCountForCategory(ItemCategory.WEAPON, gc)).toBe(weaponTable.length);
        expect(getKindCountForCategory(ItemCategory.ARMOR, gc)).toBe(armorTable.length);
        expect(getKindCountForCategory(ItemCategory.SCROLL, gc)).toBe(14);
        expect(getKindCountForCategory(ItemCategory.POTION, gc)).toBe(16);
        expect(getKindCountForCategory(ItemCategory.STAFF, gc)).toBe(staffTable.length);
        expect(getKindCountForCategory(ItemCategory.WAND, gc)).toBe(9);
        expect(getKindCountForCategory(ItemCategory.RING, gc)).toBe(ringTable.length);
        expect(getKindCountForCategory(ItemCategory.CHARM, gc)).toBe(12);
        expect(getKindCountForCategory(ItemCategory.KEY, gc)).toBe(3);
    });
});

// =============================================================================
// getHallucinatedItemCategory
// =============================================================================

describe("getHallucinatedItemCategory", () => {
    it("should return a valid category", () => {
        const ctx = makeCtx(3000n);
        const category = getHallucinatedItemCategory(ctx.rng);

        const validCategories = [
            ItemCategory.FOOD, ItemCategory.WEAPON, ItemCategory.ARMOR,
            ItemCategory.POTION, ItemCategory.SCROLL, ItemCategory.STAFF,
            ItemCategory.WAND, ItemCategory.RING, ItemCategory.CHARM,
            ItemCategory.GOLD,
        ];
        expect(validCategories).toContain(category);
    });
});
