/*
 *  item-naming.test.ts — Tests for item naming, identification & flavors
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    isVowelish,
    itemKindName,
    itemRunicName,
    itemName,
    itemKindCount,
    tryGetLastUnidentifiedItemKind,
    magicPolarityRevealedItemKindCount,
    identifyItemKind,
    identify,
    resetItemTableEntry,
    shuffleFlavors,
    itemValue,
    itemIsCarried,
    itemColors,
    itemTitles,
} from "../../src/items/item-naming.js";
import type { ItemNamingContext } from "../../src/items/item-naming.js";
import type { Item, ItemTable, GameConstants } from "../../src/types/types.js";
import {
    ItemCategory,
    FoodKind, PotionKind, ScrollKind, WeaponKind, WeaponEnchant, ArmorKind, ArmorEnchant,
    WandKind, StaffKind, RingKind, CharmKind, DisplayGlyph,
} from "../../src/types/enums.js";
import { ItemFlag } from "../../src/types/flags.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { white, itemColor } from "../../src/globals/colors.js";
import {
    foodTable, weaponTable, armorTable,
    potionTable, scrollTable, ringTable, wandTable, staffTable, charmTable,
    keyTable,
} from "../../src/globals/item-catalog.js";
import { seedRandomGenerator, randRange, randPercent } from "../../src/math/rng.js";

// =============================================================================
// Helpers
// =============================================================================

function makeGC(): GameConstants {
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
        numberGoodWandKinds: 4,
        numberBoltKinds: 28,
    } as GameConstants;
}

function makeNamingCtx(overrides: Partial<ItemNamingContext> = {}): ItemNamingContext {
    return {
        gameConstants: makeGC(),
        depthLevel: 5,
        potionTable,
        scrollTable,
        wandTable,
        staffTable,
        ringTable,
        charmTable,
        ...overrides,
    };
}

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

function withCleanTables(fn: () => void): void {
    // Save identification state and restore after test
    const savedPotions = potionTable.map(t => ({ identified: t.identified, called: t.called, callTitle: t.callTitle }));
    const savedScrolls = scrollTable.map(t => ({ identified: t.identified, called: t.called, callTitle: t.callTitle }));
    const savedStaffs = staffTable.map(t => ({ identified: t.identified, called: t.called, callTitle: t.callTitle }));
    const savedWands = wandTable.map(t => ({ identified: t.identified, called: t.called, callTitle: t.callTitle }));
    const savedRings = ringTable.map(t => ({ identified: t.identified, called: t.called, callTitle: t.callTitle }));
    try {
        fn();
    } finally {
        savedPotions.forEach((s, i) => { potionTable[i].identified = s.identified; potionTable[i].called = s.called; potionTable[i].callTitle = s.callTitle; });
        savedScrolls.forEach((s, i) => { scrollTable[i].identified = s.identified; scrollTable[i].called = s.called; scrollTable[i].callTitle = s.callTitle; });
        savedStaffs.forEach((s, i) => { staffTable[i].identified = s.identified; staffTable[i].called = s.called; staffTable[i].callTitle = s.callTitle; });
        savedWands.forEach((s, i) => { wandTable[i].identified = s.identified; wandTable[i].called = s.called; wandTable[i].callTitle = s.callTitle; });
        savedRings.forEach((s, i) => { ringTable[i].identified = s.identified; ringTable[i].called = s.called; ringTable[i].callTitle = s.callTitle; });
    }
}

// =============================================================================
// isVowelish
// =============================================================================

describe("isVowelish", () => {
    it("returns true for words starting with a vowel", () => {
        expect(isVowelish("apple")).toBe(true);
        expect(isVowelish("orange")).toBe(true);
        expect(isVowelish("emerald")).toBe(true);
        expect(isVowelish("iron")).toBe(true);
        expect(isVowelish("umbrella")).toBe(true);
    });

    it("returns false for consonant-starting words", () => {
        expect(isVowelish("sword")).toBe(false);
        expect(isVowelish("broadsword")).toBe(false);
        expect(isVowelish("mango")).toBe(false);
    });

    it('returns false for "uni..." words', () => {
        expect(isVowelish("unicorn")).toBe(false);
    });

    it('returns false for "eu..." words', () => {
        expect(isVowelish("eucalyptus")).toBe(false);
    });

    it("is case-insensitive", () => {
        expect(isVowelish("Apple")).toBe(true);
        expect(isVowelish("APPLE")).toBe(true);
    });
});

// =============================================================================
// itemKindName
// =============================================================================

describe("itemKindName", () => {
    it("returns the table name for weapons", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, kind: WeaponKind.Broadsword });
        expect(itemKindName(item)).toBe(weaponTable[WeaponKind.Broadsword].name);
    });

    it("returns 'gold pieces' for gold", () => {
        expect(itemKindName(makeItem({ category: ItemCategory.GOLD }))).toBe("gold pieces");
    });

    it("returns 'amulet of yendor' for the amulet", () => {
        expect(itemKindName(makeItem({ category: ItemCategory.AMULET }))).toBe("amulet of yendor");
    });

    it("returns 'lumenstone' for gems", () => {
        expect(itemKindName(makeItem({ category: ItemCategory.GEM }))).toBe("lumenstone");
    });

    it("returns the table name for potions", () => {
        const item = makeItem({ category: ItemCategory.POTION, kind: PotionKind.Life });
        expect(itemKindName(item)).toBe(potionTable[PotionKind.Life].name);
    });
});

// =============================================================================
// itemRunicName
// =============================================================================

describe("itemRunicName", () => {
    it("returns empty string for non-runic items", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, flags: 0 });
        expect(itemRunicName(item)).toBe("");
    });

    it("returns the weapon runic name for runic weapons", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_RUNIC,
            enchant2: WeaponEnchant.Speed,
        });
        expect(itemRunicName(item)).toBe("speed");
    });

    it("returns the armor runic name for runic armor", () => {
        const item = makeItem({
            category: ItemCategory.ARMOR,
            flags: ItemFlag.ITEM_RUNIC,
            enchant2: ArmorEnchant.Absorption,
        });
        expect(itemRunicName(item)).toBe("absorption");
    });
});

// =============================================================================
// itemName
// =============================================================================

describe("itemName", () => {
    const ctx = makeNamingCtx();

    it("names food correctly", () => {
        const ration = makeItem({ category: ItemCategory.FOOD, kind: FoodKind.Ration, quantity: 1 });
        expect(itemName(ration, false, true, ctx)).toBe("some food");
    });

    it("names multiple rations correctly", () => {
        const rations = makeItem({ category: ItemCategory.FOOD, kind: FoodKind.Ration, quantity: 3 });
        expect(itemName(rations, false, true, ctx)).toBe("3 rations of food");
    });

    it("names mangos correctly", () => {
        const mango = makeItem({ category: ItemCategory.FOOD, kind: FoodKind.Fruit, quantity: 1 });
        expect(itemName(mango, false, true, ctx)).toBe("a mango");
    });

    it("names multiple mangos correctly", () => {
        const mangos = makeItem({ category: ItemCategory.FOOD, kind: FoodKind.Fruit, quantity: 2 });
        expect(itemName(mangos, false, true, ctx)).toBe("2 mangos");
    });

    it("names identified weapons with enchantment", () => {
        const sword = makeItem({
            category: ItemCategory.WEAPON,
            kind: WeaponKind.Broadsword,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 3,
            strengthRequired: 17,
        });
        const name = itemName(sword, true, true, ctx);
        expect(name).toContain("+3");
        expect(name).toContain("broadsword");
        expect(name).toContain("<17>");
    });

    it("names unidentified weapons without enchantment", () => {
        const sword = makeItem({
            category: ItemCategory.WEAPON,
            kind: WeaponKind.Broadsword,
            strengthRequired: 17,
        });
        const name = itemName(sword, true, true, ctx);
        expect(name).not.toContain("+");
        expect(name).toContain("broadsword");
        expect(name).toContain("<17>");
    });

    it("names identified armor with defense info", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            kind: ArmorKind.ChainMail,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 2,
            armor: 100, // 100/10 = 10 base armor
            strengthRequired: 15,
        });
        const name = itemName(armor, true, true, ctx);
        expect(name).toContain("+2");
        expect(name).toContain("[12]"); // 10 + 2
        expect(name).toContain("<15>");
    });

    it("names unidentified potions with flavor text", () => {
        withCleanTables(() => {
            potionTable[PotionKind.Life].identified = false;
            potionTable[PotionKind.Life].called = false;
            const potion = makeItem({ category: ItemCategory.POTION, kind: PotionKind.Life });
            const name = itemName(potion, false, true, ctx);
            expect(name).toContain("potion");
            expect(name).not.toContain("life");
        });
    });

    it("names identified potions with real name", () => {
        withCleanTables(() => {
            potionTable[PotionKind.Life].identified = true;
            const potion = makeItem({ category: ItemCategory.POTION, kind: PotionKind.Life });
            const name = itemName(potion, false, true, ctx);
            expect(name).toContain("potion");
            expect(name).toContain("life");
        });
    });

    it("names called scrolls with custom name", () => {
        withCleanTables(() => {
            scrollTable[ScrollKind.Enchanting].identified = false;
            scrollTable[ScrollKind.Enchanting].called = true;
            scrollTable[ScrollKind.Enchanting].callTitle = "magic upgrade";
            const scroll = makeItem({ category: ItemCategory.SCROLL, kind: ScrollKind.Enchanting });
            const name = itemName(scroll, false, true, ctx);
            expect(name).toContain("called magic upgrade");
        });
    });

    it("names unidentified scrolls with flavor title", () => {
        withCleanTables(() => {
            scrollTable[ScrollKind.Enchanting].identified = false;
            scrollTable[ScrollKind.Enchanting].called = false;
            const scroll = makeItem({ category: ItemCategory.SCROLL, kind: ScrollKind.Enchanting });
            const name = itemName(scroll, false, true, ctx);
            expect(name).toContain("entitled");
        });
    });

    it("names wands with charges when identified", () => {
        withCleanTables(() => {
            wandTable[WandKind.Teleport].identified = true;
            const wand = makeItem({
                category: ItemCategory.WAND,
                kind: WandKind.Teleport,
                flags: ItemFlag.ITEM_IDENTIFIED,
                charges: 3,
            });
            const name = itemName(wand, true, true, ctx);
            expect(name).toContain("[3]");
            expect(name).toContain("teleportation");
        });
    });

    it("names staffs with charges/max when identified", () => {
        withCleanTables(() => {
            staffTable[StaffKind.Lightning].identified = true;
            const staff = makeItem({
                category: ItemCategory.STAFF,
                kind: StaffKind.Lightning,
                flags: ItemFlag.ITEM_IDENTIFIED,
                charges: 2,
                enchant1: 5,
            });
            const name = itemName(staff, true, true, ctx);
            expect(name).toContain("[2/5]");
            expect(name).toContain("lightning");
        });
    });

    it("names rings with enchant when identified", () => {
        withCleanTables(() => {
            ringTable[RingKind.Regeneration].identified = true;
            const ring = makeItem({
                category: ItemCategory.RING,
                kind: RingKind.Regeneration,
                flags: ItemFlag.ITEM_IDENTIFIED,
                enchant1: 2,
            });
            const name = itemName(ring, true, true, ctx);
            expect(name).toContain("+2");
            expect(name).toContain("regeneration");
        });
    });

    it("names gold correctly", () => {
        const gold = makeItem({ category: ItemCategory.GOLD, quantity: 50 });
        expect(itemName(gold, false, true, ctx)).toBe("50 gold pieces");
    });

    it("names the Amulet with 'the'", () => {
        const amulet = makeItem({ category: ItemCategory.AMULET });
        expect(itemName(amulet, false, true, ctx)).toBe("the Amulet of Yendor");
    });

    it("names lumenstones with depth", () => {
        const gem = makeItem({ category: ItemCategory.GEM, originDepth: 28 });
        expect(itemName(gem, false, true, ctx)).toBe("a lumenstone from depth 28");
    });

    it("includes inscription when details requested", () => {
        const item = makeItem({
            category: ItemCategory.FOOD,
            kind: FoodKind.Fruit,
            inscription: "tasty!",
        });
        const name = itemName(item, true, false, ctx);
        expect(name).toContain('"tasty!"');
    });

    it("does not include inscription without details", () => {
        const item = makeItem({
            category: ItemCategory.FOOD,
            kind: FoodKind.Fruit,
            inscription: "tasty!",
        });
        const name = itemName(item, false, false, ctx);
        expect(name).not.toContain("tasty!");
    });

    it("uses 'an' for vowel-starting items", () => {
        // "orange" potion flavor would start with vowel
        withCleanTables(() => {
            potionTable[0].identified = false;
            potionTable[0].called = false;
            potionTable[0].flavor = "orange";
            const potion = makeItem({ category: ItemCategory.POTION, kind: 0 });
            const name = itemName(potion, false, true, ctx);
            expect(name).toMatch(/^an /);
        });
    });
});

// =============================================================================
// itemKindCount
// =============================================================================

describe("itemKindCount", () => {
    const gc = makeGC();

    it("returns total kinds for polarity 0", () => {
        expect(itemKindCount(ItemCategory.POTION, 0, gc)).toBe(16);
        expect(itemKindCount(ItemCategory.SCROLL, 0, gc)).toBe(14);
    });

    it("returns good kinds for benevolent polarity", () => {
        expect(itemKindCount(ItemCategory.POTION, 1, gc)).toBe(8);
        expect(itemKindCount(ItemCategory.SCROLL, 1, gc)).toBe(12);
    });

    it("returns bad kinds for malevolent polarity", () => {
        expect(itemKindCount(ItemCategory.POTION, -1, gc)).toBe(8); // 16 - 8
        expect(itemKindCount(ItemCategory.SCROLL, -1, gc)).toBe(2); // 14 - 12
    });

    it("returns -1 for unknown categories", () => {
        expect(itemKindCount(ItemCategory.GOLD, 0, gc)).toBe(-1);
        expect(itemKindCount(ItemCategory.AMULET, 0, gc)).toBe(-1);
    });
});

// =============================================================================
// Identification
// =============================================================================

describe("identifyItemKind", () => {
    const gc = makeGC();

    it("marks the table entry as identified", () => {
        withCleanTables(() => {
            potionTable[PotionKind.Life].identified = false;
            const item = makeItem({ category: ItemCategory.POTION, kind: PotionKind.Life });
            identifyItemKind(item, gc);
            expect(potionTable[PotionKind.Life].identified).toBe(true);
        });
    });

    it("clears ITEM_KIND_AUTO_ID flag", () => {
        withCleanTables(() => {
            const item = makeItem({
                category: ItemCategory.POTION,
                kind: PotionKind.Life,
                flags: ItemFlag.ITEM_KIND_AUTO_ID,
            });
            identifyItemKind(item, gc);
            expect(item.flags & ItemFlag.ITEM_KIND_AUTO_ID).toBe(0);
        });
    });

    it("auto-identifies rings with non-positive enchantment", () => {
        withCleanTables(() => {
            const item = makeItem({
                category: ItemCategory.RING,
                kind: RingKind.Regeneration,
                enchant1: 0,
            });
            identifyItemKind(item, gc);
            expect(item.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
        });
    });
});

describe("identify", () => {
    const gc = makeGC();

    it("sets ITEM_IDENTIFIED and clears ITEM_CAN_BE_IDENTIFIED", () => {
        withCleanTables(() => {
            const item = makeItem({
                category: ItemCategory.POTION,
                kind: PotionKind.Life,
                flags: ItemFlag.ITEM_CAN_BE_IDENTIFIED,
            });
            identify(item, gc);
            expect(item.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
            expect(item.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED).toBe(0);
        });
    });

    it("reveals runic for runic items", () => {
        withCleanTables(() => {
            const item = makeItem({
                category: ItemCategory.WEAPON,
                kind: WeaponKind.Broadsword,
                flags: ItemFlag.ITEM_RUNIC,
                enchant2: WeaponEnchant.Speed,
            });
            identify(item, gc);
            expect(item.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED).toBeTruthy();
            expect(item.flags & ItemFlag.ITEM_RUNIC_HINTED).toBeTruthy();
        });
    });
});

// =============================================================================
// shuffleFlavors
// =============================================================================

describe("shuffleFlavors", () => {
    it("resets all table entries", () => {
        withCleanTables(() => {
            potionTable[0].identified = true;
            potionTable[0].called = true;
            potionTable[0].callTitle = "test";

            seedRandomGenerator(42n);
            shuffleFlavors(makeGC(), randRange, randPercent);

            expect(potionTable[0].identified).toBe(false);
            expect(potionTable[0].called).toBe(false);
            expect(potionTable[0].callTitle).toBe("");
        });
    });

    it("generates scroll titles with phonemes", () => {
        withCleanTables(() => {
            seedRandomGenerator(100n);
            shuffleFlavors(makeGC(), randRange, randPercent);

            // Each title should be non-empty and contain recognizable phonemes
            for (let i = 0; i < 14; i++) {
                expect(itemTitles[i].length).toBeGreaterThan(0);
            }
        });
    });

    it("is deterministic with same seed", () => {
        withCleanTables(() => {
            seedRandomGenerator(42n);
            shuffleFlavors(makeGC(), randRange, randPercent);
            const snapshot1 = { colors: [...itemColors], titles: [...itemTitles] };

            seedRandomGenerator(42n);
            shuffleFlavors(makeGC(), randRange, randPercent);
            const snapshot2 = { colors: [...itemColors], titles: [...itemTitles] };

            expect(snapshot1).toEqual(snapshot2);
        });
    });
});

// =============================================================================
// resetItemTableEntry
// =============================================================================

describe("resetItemTableEntry", () => {
    it("resets all identification fields", () => {
        const entry: ItemTable = {
            name: "test",
            flavor: "flavor",
            callTitle: "called",
            frequency: 10,
            marketValue: 100,
            strengthRequired: 0,
            range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            identified: true,
            called: true,
            magicPolarity: 1,
            magicPolarityRevealed: true,
            power: 0,
        };
        resetItemTableEntry(entry);
        expect(entry.identified).toBe(false);
        expect(entry.called).toBe(false);
        expect(entry.callTitle).toBe("");
        expect(entry.magicPolarityRevealed).toBe(false);
        // Name and flavor should be unchanged
        expect(entry.name).toBe("test");
        expect(entry.flavor).toBe("flavor");
    });
});

// =============================================================================
// itemValue
// =============================================================================

describe("itemValue", () => {
    it("returns 35000 for the Amulet", () => {
        expect(itemValue(makeItem({ category: ItemCategory.AMULET }))).toBe(35000);
    });

    it("returns 5000 * quantity for gems", () => {
        expect(itemValue(makeItem({ category: ItemCategory.GEM, quantity: 3 }))).toBe(15000);
    });

    it("returns 0 for other items", () => {
        expect(itemValue(makeItem({ category: ItemCategory.WEAPON }))).toBe(0);
        expect(itemValue(makeItem({ category: ItemCategory.POTION }))).toBe(0);
    });
});

// =============================================================================
// itemIsCarried
// =============================================================================

describe("itemIsCarried", () => {
    it("returns true if item is in the pack", () => {
        const item = makeItem();
        expect(itemIsCarried(item, [item])).toBe(true);
    });

    it("returns false if item is not in the pack", () => {
        const item = makeItem();
        expect(itemIsCarried(item, [])).toBe(false);
    });
});
