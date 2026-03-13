/*
 *  bolt-item-mapping.test.ts — Tests for boltForItem and boltEffectForItem
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import { boltForItem, boltEffectForItem } from "../../src/items/bolt-item-mapping.js";
import type { Item, Bolt, ItemTable } from "../../src/types/types.js";
import { ItemCategory, BoltEffect, DisplayGlyph } from "../../src/types/enums.js";
import { ItemFlag } from "../../src/types/flags.js";
import { itemColor } from "../../src/globals/colors.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { white } from "../../src/globals/colors.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = Array.from({ length: KEY_ID_MAXIMUM }, () => ({
        loc: { x: 0, y: 0 }, machine: 0, disposableHere: false,
    }));
    return {
        category: 0, kind: 0, flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0, charges: 0, enchant1: 0, enchant2: 0,
        timesEnchanted: 0, vorpalEnemy: 0, strengthRequired: 0, quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON, foreColor: itemColor, inventoryColor: white,
        quantity: 1, inventoryLetter: "", inscription: "",
        loc: { x: 0, y: 0 }, keyLoc, originDepth: 1, spawnTurnNumber: 0, lastUsed: [0, 0, 0],
        ...overrides,
    };
}

function makeTable(entries: Array<{ power: number }>): readonly ItemTable[] {
    return entries.map(e => ({
        power: e.power,
        name: "", flavor: "", callTitle: "", frequency: 1, marketValue: 0,
        strengthRequired: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: false, called: false, magicPolarity: 0, magicPolarityRevealed: false,
        description: "",
    }));
}

function makeBoltCatalog(entries: Array<{ boltEffect: BoltEffect }>): readonly Bolt[] {
    return entries.map(e => ({
        boltEffect: e.boltEffect,
        name: "", description: "", flags: 0, pathDF: 0 as const,
        theChar: 0, foreColor: null, backColor: null,
        magnitude: 0, lightFlare: 0, flashColor: null, distance: 0,
        originDF: 0, explosionDF: 0, creatureDF: 0, wallDF: 0, DF: 0,
    }));
}

// Minimal tables: staffTable[0].power = 5, wandTable[0].power = 2
const staffTable = makeTable([{ power: 5 }, { power: 7 }]);
const wandTable = makeTable([{ power: 2 }, { power: 3 }]);
// boltCatalog: index 2 → Teleport, index 5 → Damage
const boltCatalog = makeBoltCatalog([
    { boltEffect: BoltEffect.None },      // 0
    { boltEffect: BoltEffect.None },      // 1
    { boltEffect: BoltEffect.Teleport },  // 2
    { boltEffect: BoltEffect.Slow },      // 3
    { boltEffect: BoltEffect.None },      // 4
    { boltEffect: BoltEffect.Damage },    // 5
    { boltEffect: BoltEffect.None },      // 6
    { boltEffect: BoltEffect.Blinking },  // 7
]);

// =============================================================================
// boltForItem
// =============================================================================

describe("boltForItem", () => {
    it("returns the bolt index from staffTable for a staff item", () => {
        const staff = makeItem({ category: ItemCategory.STAFF, kind: 0 });
        expect(boltForItem(staff, staffTable, wandTable)).toBe(5);
    });

    it("returns the bolt index for the second staff kind", () => {
        const staff = makeItem({ category: ItemCategory.STAFF, kind: 1 });
        expect(boltForItem(staff, staffTable, wandTable)).toBe(7);
    });

    it("returns the bolt index from wandTable for a wand item", () => {
        const wand = makeItem({ category: ItemCategory.WAND, kind: 0 });
        expect(boltForItem(wand, staffTable, wandTable)).toBe(2);
    });

    it("returns the bolt index for the second wand kind", () => {
        const wand = makeItem({ category: ItemCategory.WAND, kind: 1 });
        expect(boltForItem(wand, staffTable, wandTable)).toBe(3);
    });

    it("returns 0 for non-staff/wand items", () => {
        const potion = makeItem({ category: ItemCategory.POTION, kind: 0 });
        expect(boltForItem(potion, staffTable, wandTable)).toBe(0);
        const scroll = makeItem({ category: ItemCategory.SCROLL, kind: 0 });
        expect(boltForItem(scroll, staffTable, wandTable)).toBe(0);
        const weapon = makeItem({ category: ItemCategory.WEAPON, kind: 0 });
        expect(boltForItem(weapon, staffTable, wandTable)).toBe(0);
    });
});

// =============================================================================
// boltEffectForItem
// =============================================================================

describe("boltEffectForItem", () => {
    it("returns the bolt effect for a staff item", () => {
        // staff kind 0 → power 5 → boltCatalog[5].boltEffect = Damage
        const staff = makeItem({ category: ItemCategory.STAFF, kind: 0 });
        expect(boltEffectForItem(staff, boltCatalog, staffTable, wandTable)).toBe(BoltEffect.Damage);
    });

    it("returns the bolt effect for a wand item", () => {
        // wand kind 0 → power 2 → boltCatalog[2].boltEffect = Teleport
        const wand = makeItem({ category: ItemCategory.WAND, kind: 0 });
        expect(boltEffectForItem(wand, boltCatalog, staffTable, wandTable)).toBe(BoltEffect.Teleport);
    });

    it("returns BoltEffect.None for a non-staff/wand item", () => {
        const potion = makeItem({ category: ItemCategory.POTION });
        expect(boltEffectForItem(potion, boltCatalog, staffTable, wandTable)).toBe(BoltEffect.None);
    });

    it("returns BoltEffect.None for an item with no matching table entry", () => {
        // kind 99 is out of range → undefined → None
        const staff = makeItem({ category: ItemCategory.STAFF, kind: 99 });
        expect(boltEffectForItem(staff, boltCatalog, staffTable, wandTable)).toBe(BoltEffect.None);
    });
});
