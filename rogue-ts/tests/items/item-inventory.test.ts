/*
 *  item-inventory.test.ts — Tests for item chain management & inventory helpers
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    removeItemFromArray,
    addItemToArray,
    itemAtLoc,
    itemOfPackLetter,
    numberOfItemsInPack,
    numberOfMatchingPackItems,
    inventoryLetterAvailable,
    nextAvailableInventoryCharacter,
    conflateItemCharacteristics,
    stackItems,
    itemWillStackWithPack,
    addItemToPack,
    itemIsSwappable,
    checkForDisenchantment,
    canPickUpItem,
} from "../../src/items/item-inventory.js";
import type { Item, Pos } from "../../src/types/types.js";
import { ItemCategory, CAN_BE_SWAPPED, DisplayGlyph } from "../../src/types/enums.js";
import { ItemFlag } from "../../src/types/flags.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { white, itemColor } from "../../src/globals/colors.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = [];
    for (let i = 0; i < KEY_ID_MAXIMUM; i++) {
        keyLoc.push({ loc: { x: 0, y: 0 }, machine: 0, disposableHere: false });
    }
    return {
        category: 0,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON,
        foreColor: itemColor,
        inventoryColor: white,
        quantity: 1,
        inventoryLetter: "",
        inscription: "",
        loc: { x: 0, y: 0 },
        keyLoc,
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    };
}

// =============================================================================
// removeItemFromArray
// =============================================================================

describe("removeItemFromArray", () => {
    it("should remove an item from the array", () => {
        const item1 = makeItem();
        const item2 = makeItem();
        const chain = [item1, item2];
        expect(removeItemFromArray(item1, chain)).toBe(true);
        expect(chain).toEqual([item2]);
    });

    it("should return false if the item is not in the array", () => {
        const item1 = makeItem();
        const item2 = makeItem();
        expect(removeItemFromArray(item2, [item1])).toBe(false);
    });

    it("should handle an empty array", () => {
        expect(removeItemFromArray(makeItem(), [])).toBe(false);
    });
});

// =============================================================================
// addItemToArray
// =============================================================================

describe("addItemToArray", () => {
    it("should prepend the item to the array", () => {
        const item1 = makeItem({ kind: 1 });
        const item2 = makeItem({ kind: 2 });
        const chain = [item1];
        addItemToArray(item2, chain);
        expect(chain[0]).toBe(item2);
        expect(chain[1]).toBe(item1);
    });

    it("should add to an empty array", () => {
        const item = makeItem();
        const chain: Item[] = [];
        addItemToArray(item, chain);
        expect(chain).toEqual([item]);
    });
});

// =============================================================================
// itemAtLoc
// =============================================================================

describe("itemAtLoc", () => {
    it("should find an item at the given location", () => {
        const item = makeItem({ loc: { x: 5, y: 10 } });
        expect(itemAtLoc({ x: 5, y: 10 }, [item])).toBe(item);
    });

    it("should return null if no item is at the location", () => {
        const item = makeItem({ loc: { x: 5, y: 10 } });
        expect(itemAtLoc({ x: 3, y: 7 }, [item])).toBeNull();
    });

    it("should return null for an empty array", () => {
        expect(itemAtLoc({ x: 0, y: 0 }, [])).toBeNull();
    });

    it("should return the first item if multiple are at the same location", () => {
        const item1 = makeItem({ loc: { x: 5, y: 10 }, kind: 1 });
        const item2 = makeItem({ loc: { x: 5, y: 10 }, kind: 2 });
        expect(itemAtLoc({ x: 5, y: 10 }, [item1, item2])).toBe(item1);
    });
});

// =============================================================================
// itemOfPackLetter
// =============================================================================

describe("itemOfPackLetter", () => {
    it("should find an item by its inventory letter", () => {
        const item = makeItem({ inventoryLetter: "c" });
        expect(itemOfPackLetter("c", [item])).toBe(item);
    });

    it("should return null if no item has that letter", () => {
        const item = makeItem({ inventoryLetter: "a" });
        expect(itemOfPackLetter("b", [item])).toBeNull();
    });
});

// =============================================================================
// numberOfItemsInPack
// =============================================================================

describe("numberOfItemsInPack", () => {
    it("should return 0 for an empty pack", () => {
        expect(numberOfItemsInPack([])).toBe(0);
    });

    it("should count regular items by quantity", () => {
        const potion = makeItem({ category: ItemCategory.POTION, quantity: 3 });
        expect(numberOfItemsInPack([potion])).toBe(3);
    });

    it("should count weapons as 1 regardless of quantity (quiver stacking)", () => {
        const daggers = makeItem({ category: ItemCategory.WEAPON, quantity: 5 });
        expect(numberOfItemsInPack([daggers])).toBe(1);
    });

    it("should count gems as 1 regardless of quantity", () => {
        const gems = makeItem({ category: ItemCategory.GEM, quantity: 3 });
        expect(numberOfItemsInPack([gems])).toBe(1);
    });

    it("should sum multiple items correctly", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, quantity: 5 });
        const scroll = makeItem({ category: ItemCategory.SCROLL, quantity: 2 });
        const food = makeItem({ category: ItemCategory.FOOD, quantity: 1 });
        expect(numberOfItemsInPack([weapon, scroll, food])).toBe(1 + 2 + 1);
    });
});

// =============================================================================
// numberOfMatchingPackItems
// =============================================================================

describe("numberOfMatchingPackItems", () => {
    it("should count items matching the category mask", () => {
        const potion = makeItem({ category: ItemCategory.POTION });
        const scroll = makeItem({ category: ItemCategory.SCROLL });
        const pack = [potion, scroll];
        expect(numberOfMatchingPackItems(pack, ItemCategory.POTION, 0, 0)).toBe(1);
    });

    it("should respect required flags", () => {
        const identified = makeItem({ category: ItemCategory.POTION, flags: ItemFlag.ITEM_IDENTIFIED });
        const unidentified = makeItem({ category: ItemCategory.POTION, flags: 0 });
        expect(numberOfMatchingPackItems(
            [identified, unidentified],
            ItemCategory.POTION,
            ItemFlag.ITEM_IDENTIFIED,
            0,
        )).toBe(1);
    });

    it("should respect forbidden flags", () => {
        const cursed = makeItem({ category: ItemCategory.WEAPON, flags: ItemFlag.ITEM_CURSED });
        const normal = makeItem({ category: ItemCategory.WEAPON, flags: 0 });
        expect(numberOfMatchingPackItems(
            [cursed, normal],
            ItemCategory.WEAPON,
            0,
            ItemFlag.ITEM_CURSED,
        )).toBe(1);
    });

    it("should return 0 for empty pack", () => {
        expect(numberOfMatchingPackItems([], ItemCategory.POTION, 0, 0)).toBe(0);
    });
});

// =============================================================================
// Inventory letters
// =============================================================================

describe("inventoryLetterAvailable", () => {
    it("should return true for an unused letter", () => {
        const pack = [makeItem({ inventoryLetter: "a" })];
        expect(inventoryLetterAvailable("b", pack)).toBe(true);
    });

    it("should return false for a used letter", () => {
        const pack = [makeItem({ inventoryLetter: "a" })];
        expect(inventoryLetterAvailable("a", pack)).toBe(false);
    });

    it("should return false for non-lowercase letters", () => {
        expect(inventoryLetterAvailable("A", [])).toBe(false);
        expect(inventoryLetterAvailable("1", [])).toBe(false);
        expect(inventoryLetterAvailable("", [])).toBe(false);
    });
});

describe("nextAvailableInventoryCharacter", () => {
    it("should return 'a' for an empty pack", () => {
        expect(nextAvailableInventoryCharacter([])).toBe("a");
    });

    it("should skip taken letters", () => {
        const pack = [
            makeItem({ inventoryLetter: "a" }),
            makeItem({ inventoryLetter: "b" }),
        ];
        expect(nextAvailableInventoryCharacter(pack)).toBe("c");
    });

    it("should return empty string when all 26 letters are taken", () => {
        const pack: Item[] = [];
        for (let i = 0; i < 26; i++) {
            pack.push(makeItem({ inventoryLetter: String.fromCharCode("a".charCodeAt(0) + i) }));
        }
        expect(nextAvailableInventoryCharacter(pack)).toBe("");
    });
});

// =============================================================================
// Item stacking
// =============================================================================

describe("conflateItemCharacteristics", () => {
    it("should propagate identification flags from old to new", () => {
        const newItem = makeItem({ flags: 0 });
        const oldItem = makeItem({ flags: ItemFlag.ITEM_IDENTIFIED | ItemFlag.ITEM_MAGIC_DETECTED });
        conflateItemCharacteristics(newItem, oldItem);
        expect(newItem.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
        expect(newItem.flags & ItemFlag.ITEM_MAGIC_DETECTED).toBeTruthy();
    });

    it("should keep the higher enchantment", () => {
        const newItem = makeItem({ enchant1: 2 });
        const oldItem = makeItem({ enchant1: 5 });
        conflateItemCharacteristics(newItem, oldItem);
        expect(newItem.enchant1).toBe(5);
    });

    it("should not downgrade enchantment", () => {
        const newItem = makeItem({ enchant1: 5 });
        const oldItem = makeItem({ enchant1: 2 });
        conflateItemCharacteristics(newItem, oldItem);
        expect(newItem.enchant1).toBe(5);
    });

    it("should keep the lower strength requirement", () => {
        const newItem = makeItem({ strengthRequired: 15 });
        const oldItem = makeItem({ strengthRequired: 12 });
        conflateItemCharacteristics(newItem, oldItem);
        expect(newItem.strengthRequired).toBe(12);
    });

    it("should zero origin depth if items differ", () => {
        const newItem = makeItem({ originDepth: 3 });
        const oldItem = makeItem({ originDepth: 5 });
        conflateItemCharacteristics(newItem, oldItem);
        expect(newItem.originDepth).toBe(0);
    });

    it("should keep origin depth if items match", () => {
        const newItem = makeItem({ originDepth: 3 });
        const oldItem = makeItem({ originDepth: 3 });
        conflateItemCharacteristics(newItem, oldItem);
        expect(newItem.originDepth).toBe(3);
    });
});

describe("stackItems", () => {
    it("should add quantities together", () => {
        const newItem = makeItem({ quantity: 3 });
        const oldItem = makeItem({ quantity: 2 });
        stackItems(newItem, oldItem);
        expect(newItem.quantity).toBe(5);
    });

    it("should conflate characteristics", () => {
        const newItem = makeItem({ quantity: 1, enchant1: 1 });
        const oldItem = makeItem({ quantity: 1, enchant1: 3 });
        stackItems(newItem, oldItem);
        expect(newItem.enchant1).toBe(3);
    });
});

// =============================================================================
// itemWillStackWithPack
// =============================================================================

describe("itemWillStackWithPack", () => {
    it("should return true for a gem from the same origin depth", () => {
        const gem = makeItem({ category: ItemCategory.GEM, originDepth: 5 });
        const packGem = makeItem({ category: ItemCategory.GEM, originDepth: 5 });
        expect(itemWillStackWithPack(gem, [packGem])).toBe(true);
    });

    it("should return false for a gem from a different origin depth", () => {
        const gem = makeItem({ category: ItemCategory.GEM, originDepth: 5 });
        const packGem = makeItem({ category: ItemCategory.GEM, originDepth: 3 });
        expect(itemWillStackWithPack(gem, [packGem])).toBe(false);
    });

    it("should return true for a quivered weapon with matching quiver number", () => {
        const dagger = makeItem({ category: ItemCategory.WEAPON, quiverNumber: 7 });
        const packDagger = makeItem({ category: ItemCategory.WEAPON, quiverNumber: 7 });
        expect(itemWillStackWithPack(dagger, [packDagger])).toBe(true);
    });

    it("should return false for non-quivered items", () => {
        const potion = makeItem({ category: ItemCategory.POTION, quiverNumber: 0 });
        expect(itemWillStackWithPack(potion, [])).toBe(false);
    });

    it("should return false for a quiver number with no pack match", () => {
        const dagger = makeItem({ category: ItemCategory.WEAPON, quiverNumber: 7 });
        const sword = makeItem({ category: ItemCategory.WEAPON, quiverNumber: 3 });
        expect(itemWillStackWithPack(dagger, [sword])).toBe(false);
    });
});

// =============================================================================
// addItemToPack
// =============================================================================

describe("addItemToPack", () => {
    it("should add a new item to an empty pack", () => {
        const pack: Item[] = [];
        const item = makeItem({ category: ItemCategory.WEAPON, inventoryLetter: "a" });
        const result = addItemToPack(item, pack);
        expect(result).toBe(item);
        expect(pack.length).toBe(1);
        expect(pack[0].inventoryLetter).toBe("a");
    });

    it("should stack matching potions", () => {
        const existing = makeItem({ category: ItemCategory.POTION, kind: 2, quantity: 1, inventoryLetter: "a" });
        const pack = [existing];
        const newPotion = makeItem({ category: ItemCategory.POTION, kind: 2, quantity: 3 });
        const result = addItemToPack(newPotion, pack);
        expect(result).toBe(existing);
        expect(existing.quantity).toBe(4);
        expect(pack.length).toBe(1);
    });

    it("should not stack potions of different kinds", () => {
        const existing = makeItem({ category: ItemCategory.POTION, kind: 1, inventoryLetter: "a" });
        const pack = [existing];
        const newPotion = makeItem({ category: ItemCategory.POTION, kind: 2 });
        const result = addItemToPack(newPotion, pack);
        expect(result).toBe(newPotion);
        expect(pack.length).toBe(2);
    });

    it("should stack matching scrolls", () => {
        const existing = makeItem({ category: ItemCategory.SCROLL, kind: 3, quantity: 2, inventoryLetter: "a" });
        const pack = [existing];
        const newScroll = makeItem({ category: ItemCategory.SCROLL, kind: 3, quantity: 1 });
        const result = addItemToPack(newScroll, pack);
        expect(result).toBe(existing);
        expect(existing.quantity).toBe(3);
    });

    it("should stack gems only from the same origin depth", () => {
        const existing = makeItem({ category: ItemCategory.GEM, kind: 0, originDepth: 27, inventoryLetter: "a" });
        const pack = [existing];
        const sameDepthGem = makeItem({ category: ItemCategory.GEM, kind: 0, originDepth: 27 });
        const result = addItemToPack(sameDepthGem, pack);
        expect(result).toBe(existing);
        expect(pack.length).toBe(1);
    });

    it("should not stack gems from different origin depths", () => {
        const existing = makeItem({ category: ItemCategory.GEM, kind: 0, originDepth: 27, inventoryLetter: "a" });
        const pack = [existing];
        const diffDepthGem = makeItem({ category: ItemCategory.GEM, kind: 0, originDepth: 28 });
        const result = addItemToPack(diffDepthGem, pack);
        expect(result).toBe(diffDepthGem);
        expect(pack.length).toBe(2);
    });

    it("should stack quivered weapons with matching quiver number", () => {
        const existing = makeItem({ category: ItemCategory.WEAPON, kind: 5, quiverNumber: 3, quantity: 2, inventoryLetter: "a" });
        const pack = [existing];
        const newDagger = makeItem({ category: ItemCategory.WEAPON, kind: 5, quiverNumber: 3, quantity: 1 });
        const result = addItemToPack(newDagger, pack);
        expect(result).toBe(existing);
        expect(existing.quantity).toBe(3);
    });

    it("should assign an inventory letter if the proposed one is taken", () => {
        const existing = makeItem({ category: ItemCategory.WEAPON, inventoryLetter: "a" });
        const pack = [existing];
        const newItem = makeItem({ category: ItemCategory.ARMOR, inventoryLetter: "a" });
        addItemToPack(newItem, pack);
        expect(newItem.inventoryLetter).toBe("b");
    });

    it("should insert in category-sorted order", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, inventoryLetter: "a" });
        const ring = makeItem({ category: ItemCategory.RING, inventoryLetter: "b" });
        const pack = [weapon, ring];
        // ARMOR category value is between WEAPON and RING
        const armor = makeItem({ category: ItemCategory.ARMOR, inventoryLetter: "c" });
        addItemToPack(armor, pack);
        // Check ordering: WEAPON < ARMOR < RING
        expect(pack[0].category).toBe(ItemCategory.WEAPON);
        expect(pack[1].category).toBe(ItemCategory.ARMOR);
        expect(pack[2].category).toBe(ItemCategory.RING);
    });
});

// =============================================================================
// itemIsSwappable
// =============================================================================

describe("itemIsSwappable", () => {
    it("should return true for equippable items with no quiver", () => {
        expect(itemIsSwappable(makeItem({ category: ItemCategory.WEAPON, quiverNumber: 0 }))).toBe(true);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.ARMOR, quiverNumber: 0 }))).toBe(true);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.RING, quiverNumber: 0 }))).toBe(true);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.STAFF, quiverNumber: 0 }))).toBe(true);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.CHARM, quiverNumber: 0 }))).toBe(true);
    });

    it("should return false for quivered items", () => {
        expect(itemIsSwappable(makeItem({ category: ItemCategory.WEAPON, quiverNumber: 5 }))).toBe(false);
    });

    it("should return false for non-equippable items", () => {
        expect(itemIsSwappable(makeItem({ category: ItemCategory.POTION }))).toBe(false);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.SCROLL }))).toBe(false);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.FOOD }))).toBe(false);
        expect(itemIsSwappable(makeItem({ category: ItemCategory.GOLD }))).toBe(false);
    });
});

// =============================================================================
// checkForDisenchantment
// =============================================================================

describe("checkForDisenchantment", () => {
    it("should remove runic from weapon with negative enchantment and good runic", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_RUNIC | ItemFlag.ITEM_RUNIC_HINTED,
            enchant1: -1,
            enchant2: 2, // good weapon enchant (< NUMBER_GOOD_WEAPON_ENCHANT_KINDS)
        });
        const result = checkForDisenchantment(item, 6, 4);
        expect(result).toBe(true);
        expect(item.enchant2).toBe(0);
        expect(item.flags & ItemFlag.ITEM_RUNIC).toBe(0);
    });

    it("should not remove runic from weapon with positive enchantment", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_RUNIC,
            enchant1: 3,
            enchant2: 2,
        });
        const result = checkForDisenchantment(item, 6, 4);
        expect(result).toBe(false);
        expect(item.flags & ItemFlag.ITEM_RUNIC).toBeTruthy();
    });

    it("should not remove runic from weapon with bad runic type (enchant2 >= good kinds)", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_RUNIC,
            enchant1: -1,
            enchant2: 8, // bad runic kind (>= NUMBER_GOOD_WEAPON_ENCHANT_KINDS)
        });
        const result = checkForDisenchantment(item, 6, 4);
        expect(result).toBe(false);
    });

    it("should remove curse from weapon with non-negative enchantment", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_CURSED,
            enchant1: 0,
        });
        checkForDisenchantment(item, 6, 4);
        expect(item.flags & ItemFlag.ITEM_CURSED).toBe(0);
    });

    it("should keep curse on weapon with negative enchantment", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_CURSED,
            enchant1: -1,
        });
        checkForDisenchantment(item, 6, 4);
        expect(item.flags & ItemFlag.ITEM_CURSED).toBeTruthy();
    });
});

// =============================================================================
// canPickUpItem
// =============================================================================

describe("canPickUpItem", () => {
    it("should allow pickup when pack has room", () => {
        expect(canPickUpItem(makeItem(), [])).toBe(true);
    });

    it("should always allow gold pickup", () => {
        const gold = makeItem({ category: ItemCategory.GOLD });
        // Create a full pack (26 items)
        const pack: Item[] = [];
        for (let i = 0; i < 26; i++) {
            pack.push(makeItem({ category: ItemCategory.ARMOR, quantity: 1, inventoryLetter: String.fromCharCode("a".charCodeAt(0) + i) }));
        }
        expect(canPickUpItem(gold, pack)).toBe(true);
    });

    it("should allow pickup of stackable item even when pack is full", () => {
        const gem = makeItem({ category: ItemCategory.GEM, originDepth: 5 });
        const packGem = makeItem({ category: ItemCategory.GEM, originDepth: 5, quantity: 1 });
        // Fill remaining slots
        const pack: Item[] = [packGem];
        for (let i = 1; i < 26; i++) {
            pack.push(makeItem({ category: ItemCategory.ARMOR, quantity: 1 }));
        }
        expect(canPickUpItem(gem, pack)).toBe(true);
    });

    it("should reject non-gold, non-stackable item when pack is full", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, quiverNumber: 0 });
        const pack: Item[] = [];
        for (let i = 0; i < 26; i++) {
            pack.push(makeItem({ category: ItemCategory.ARMOR, quantity: 1 }));
        }
        expect(canPickUpItem(weapon, pack)).toBe(false);
    });
});
