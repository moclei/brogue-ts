/*
 *  item-enchant-swap.test.ts — Tests for enchant-swap machine mechanics
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    enchantLevelKnown,
    effectiveEnchantLevel,
} from "../../src/items/item-inventory.js";
import {
    swapItemToEnchantLevel,
    swapItemEnchants,
} from "../../src/items/item-enchant-swap.js";
import type { SwapItemToEnchantLevelContext, SwapItemEnchantsContext } from "../../src/items/item-enchant-swap.js";
import type { Item, Pcell } from "../../src/types/types.js";
import { ItemCategory, DisplayGlyph } from "../../src/types/enums.js";
import { ItemFlag, TileFlag, TerrainMechFlag } from "../../src/types/flags.js";
import { KEY_ID_MAXIMUM, DCOLS, DROWS } from "../../src/types/constants.js";
import { white, itemColor } from "../../src/globals/colors.js";

// =============================================================================
// Helpers
// =============================================================================

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = Array.from({ length: KEY_ID_MAXIMUM }, () => ({
        loc: { x: 0, y: 0 }, machine: 0, disposableHere: false,
    }));
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
        loc: { x: 1, y: 1 },
        keyLoc,
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    };
}

function makePmap(width = DCOLS, height = DROWS): Pcell[][] {
    const map: Pcell[][] = [];
    for (let x = 0; x < width; x++) {
        map[x] = [];
        for (let y = 0; y < height; y++) {
            map[x][y] = {
                layers: [0, 0, 0, 0],
                flags: 0,
                volume: 0,
                machineNumber: 0,
            } as unknown as Pcell;
        }
    }
    return map;
}

function makeSwapCtx(
    floorItems: Item[],
    pmap: Pcell[][],
    overrides: Partial<SwapItemToEnchantLevelContext> = {},
): SwapItemToEnchantLevelContext {
    return {
        floorItems,
        pmap,
        playerCanSee: () => false,
        removeItemFromChain: (item, chain) => {
            const idx = (chain as Item[]).indexOf(item);
            if (idx >= 0) (chain as Item[]).splice(idx, 1);
        },
        refreshDungeonCell: vi.fn(),
        messageWithColor: vi.fn(),
        itemName: (_item, buf) => { buf[0] = "item"; },
        itemMessageColor: { ...white },
        gameConst: { weaponKillsToAutoID: 20, armorDelayToAutoID: 1000, ringDelayToAutoID: 1500 },
        charmRechargeDelay: (_kind, _enchant) => 100,
        checkForDisenchantment: vi.fn(),
        ...overrides,
    };
}

function makeSwapEnchantsCtx(
    floorItems: Item[],
    pmap: Pcell[][],
    itemAtLoc: (loc: { x: number; y: number }) => Item | null,
    overrides: Partial<SwapItemEnchantsContext> = {},
): SwapItemEnchantsContext {
    return {
        ...makeSwapCtx(floorItems, pmap),
        cellHasTMFlag: () => false,
        itemAtLoc,
        ...overrides,
    };
}

// =============================================================================
// enchantLevelKnown
// =============================================================================

describe("enchantLevelKnown", () => {
    it("returns true for a staff with ITEM_MAX_CHARGES_KNOWN", () => {
        const item = makeItem({
            category: ItemCategory.STAFF,
            flags: ItemFlag.ITEM_MAX_CHARGES_KNOWN,
        });
        expect(enchantLevelKnown(item)).toBe(true);
    });

    it("returns true for a staff with ITEM_IDENTIFIED (no MAX_CHARGES_KNOWN needed)", () => {
        const item = makeItem({
            category: ItemCategory.STAFF,
            flags: ItemFlag.ITEM_IDENTIFIED,
        });
        expect(enchantLevelKnown(item)).toBe(true);
    });

    it("returns true for a non-staff with ITEM_IDENTIFIED", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_IDENTIFIED,
        });
        expect(enchantLevelKnown(item)).toBe(true);
    });

    it("returns false for a staff with no identifying flags", () => {
        const item = makeItem({ category: ItemCategory.STAFF, flags: 0 });
        expect(enchantLevelKnown(item)).toBe(false);
    });

    it("returns false for a weapon with no flags", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, flags: 0 });
        expect(enchantLevelKnown(item)).toBe(false);
    });

    it("returns false for a wand with ITEM_CAN_BE_IDENTIFIED but not ITEM_IDENTIFIED", () => {
        const item = makeItem({
            category: ItemCategory.WAND,
            flags: ItemFlag.ITEM_CAN_BE_IDENTIFIED,
        });
        expect(enchantLevelKnown(item)).toBe(false);
    });
});

// =============================================================================
// effectiveEnchantLevel
// =============================================================================

describe("effectiveEnchantLevel", () => {
    it("returns charges for a wand", () => {
        const item = makeItem({ category: ItemCategory.WAND, charges: 5, enchant1: 2 });
        expect(effectiveEnchantLevel(item)).toBe(5);
    });

    it("returns enchant1 for a staff", () => {
        const item = makeItem({ category: ItemCategory.STAFF, charges: 3, enchant1: 4 });
        expect(effectiveEnchantLevel(item)).toBe(4);
    });

    it("returns enchant1 for a weapon", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, charges: 0, enchant1: 3 });
        expect(effectiveEnchantLevel(item)).toBe(3);
    });

    it("returns enchant1 for armor", () => {
        const item = makeItem({ category: ItemCategory.ARMOR, enchant1: -1 });
        expect(effectiveEnchantLevel(item)).toBe(-1);
    });

    it("returns enchant1 for a ring", () => {
        const item = makeItem({ category: ItemCategory.RING, enchant1: 2 });
        expect(effectiveEnchantLevel(item)).toBe(2);
    });
});

// =============================================================================
// swapItemToEnchantLevel — shatter cases
// =============================================================================

describe("swapItemToEnchantLevel — shatter", () => {
    it("shatters a staff when newEnchant < 2", () => {
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 3, loc: { x: 2, y: 2 } });
        const floorItems = [item];
        const pmap = makePmap();
        pmap[2][2].flags = TileFlag.HAS_ITEM;
        const removeSpy = vi.fn((i: Item, chain: Item[]) => {
            const idx = chain.indexOf(i);
            if (idx >= 0) chain.splice(idx, 1);
        });
        const ctx = makeSwapCtx(floorItems, pmap, {
            removeItemFromChain: removeSpy,
            playerCanSee: () => false,
        });
        swapItemToEnchantLevel(item, 1, false, ctx);
        expect(removeSpy).toHaveBeenCalledWith(item, floorItems);
        expect(floorItems).toHaveLength(0);
    });

    it("shatters a staff with newEnchant=1 (below minimum of 2)", () => {
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 3, loc: { x: 1, y: 1 } });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 1, false, ctx);
        expect(floorItems).toHaveLength(0);
    });

    it("shatters a charm when newEnchant < 1", () => {
        const item = makeItem({ category: ItemCategory.CHARM, enchant1: 2, loc: { x: 1, y: 1 } });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 0, false, ctx);
        expect(floorItems).toHaveLength(0);
    });

    it("shatters a wand when newEnchant < 0", () => {
        const item = makeItem({ category: ItemCategory.WAND, charges: 2, loc: { x: 1, y: 1 } });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, -1, false, ctx);
        expect(floorItems).toHaveLength(0);
    });

    it("does NOT shatter a wand at newEnchant=0 (minimum is -1)", () => {
        const item = makeItem({ category: ItemCategory.WAND, charges: 2, loc: { x: 1, y: 1 } });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 0, false, ctx);
        expect(floorItems).toHaveLength(1);
        expect(item.charges).toBe(0);
    });

    it("calls messageWithColor when shatter and playerCanSee", () => {
        const msgSpy = vi.fn();
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 3, loc: { x: 1, y: 1 } });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap, {
            playerCanSee: () => true,
            messageWithColor: msgSpy,
        });
        swapItemToEnchantLevel(item, 1, false, ctx);
        expect(msgSpy).toHaveBeenCalledOnce();
        expect(msgSpy.mock.calls[0][0]).toContain("shatter");
    });

    it("does not call messageWithColor when shatter but player cannot see", () => {
        const msgSpy = vi.fn();
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 3, loc: { x: 1, y: 1 } });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap, {
            playerCanSee: () => false,
            messageWithColor: msgSpy,
        });
        swapItemToEnchantLevel(item, 1, false, ctx);
        expect(msgSpy).not.toHaveBeenCalled();
    });
});

// =============================================================================
// swapItemToEnchantLevel — enchant update cases
// =============================================================================

describe("swapItemToEnchantLevel — enchant update", () => {
    it("sets enchant1 for a weapon", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, enchant1: 3 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 5, true, ctx);
        expect(item.enchant1).toBe(5);
    });

    it("sets charges for a wand", () => {
        const item = makeItem({ category: ItemCategory.WAND, charges: 3 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 7, true, ctx);
        expect(item.charges).toBe(7);
    });

    it("sets ITEM_IDENTIFIED when enchantmentKnown=true", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, flags: 0, enchant1: 2 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 4, true, ctx);
        expect(item.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
    });

    it("sets ITEM_MAX_CHARGES_KNOWN for staff when enchantmentKnown=true", () => {
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 3, charges: 3 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 4, true, ctx);
        expect(item.flags & ItemFlag.ITEM_MAX_CHARGES_KNOWN).toBeTruthy();
        expect(item.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
    });

    it("clears identification and sets ITEM_CAN_BE_IDENTIFIED when enchantmentKnown=false", () => {
        const item = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 3,
        });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap, {
            gameConst: { weaponKillsToAutoID: 20, armorDelayToAutoID: 1000, ringDelayToAutoID: 1500 },
        });
        swapItemToEnchantLevel(item, 5, false, ctx);
        expect(item.flags & ItemFlag.ITEM_IDENTIFIED).toBe(0);
        expect(item.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED).toBeTruthy();
        expect(item.charges).toBe(20); // weaponKillsToAutoID
    });

    it("sets armorDelayToAutoID charges for armor when enchantmentKnown=false", () => {
        const item = makeItem({ category: ItemCategory.ARMOR, enchant1: 3 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 5, false, ctx);
        expect(item.charges).toBe(1000);
    });

    it("sets ringDelayToAutoID charges for ring when enchantmentKnown=false", () => {
        const item = makeItem({ category: ItemCategory.RING, enchant1: 2 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 4, false, ctx);
        expect(item.charges).toBe(1500);
    });

    it("clamps staff charges to newEnchant if charges exceed it", () => {
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 5, charges: 5 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 3, true, ctx);
        expect(item.enchant1).toBe(3);
        expect(item.charges).toBe(3);
    });

    it("does not clamp staff charges if charges <= newEnchant", () => {
        const item = makeItem({ category: ItemCategory.STAFF, enchant1: 2, charges: 1 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap);
        swapItemToEnchantLevel(item, 4, true, ctx);
        expect(item.enchant1).toBe(4);
        expect(item.charges).toBe(1); // unchanged
    });

    it("calls checkForDisenchantment after updating enchant", () => {
        const disenchantSpy = vi.fn();
        const item = makeItem({ category: ItemCategory.WEAPON, enchant1: 3 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap, { checkForDisenchantment: disenchantSpy });
        swapItemToEnchantLevel(item, 5, true, ctx);
        expect(disenchantSpy).toHaveBeenCalledWith(item);
    });

    it("scales charm recharge progress proportionally", () => {
        // Charm with 50% progress (charges=50 out of delay=100), moving to a
        // new enchant where delay=200. Expected new charges = 50% * 200 = 100.
        const item = makeItem({ category: ItemCategory.CHARM, enchant1: 2, charges: 50 });
        const floorItems = [item];
        const pmap = makePmap();
        const ctx = makeSwapCtx(floorItems, pmap, {
            charmRechargeDelay: (_kind, enchant) => enchant === 2 ? 100 : 200,
        });
        swapItemToEnchantLevel(item, 4, true, ctx);
        expect(item.charges).toBe(100);
    });
});

// =============================================================================
// swapItemEnchants
// =============================================================================

describe("swapItemEnchants", () => {
    it("returns false when no items are on swap-activation cells", () => {
        const pmap = makePmap();
        const ctx = makeSwapEnchantsCtx([], pmap, () => null, {
            cellHasTMFlag: () => false,
        });
        expect(swapItemEnchants(1, ctx)).toBe(false);
    });

    it("returns false when only one swappable item is found", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, enchant1: 3, loc: { x: 1, y: 1 } });
        const pmap = makePmap();
        pmap[1][1].machineNumber = 1;
        const ctx = makeSwapEnchantsCtx([item], pmap, (loc) => {
            if (loc.x === 1 && loc.y === 1) return item;
            return null;
        }, {
            cellHasTMFlag: (loc, flags) =>
                loc.x === 1 && loc.y === 1 &&
                !!(flags & TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION),
        });
        expect(swapItemEnchants(1, ctx)).toBe(false);
    });

    it("returns false when two items have the same enchant level", () => {
        const item1 = makeItem({ category: ItemCategory.WEAPON, enchant1: 3, loc: { x: 1, y: 1 } });
        const item2 = makeItem({ category: ItemCategory.ARMOR, enchant1: 3, loc: { x: 2, y: 1 } });
        const pmap = makePmap();
        pmap[1][1].machineNumber = 1;
        pmap[2][1].machineNumber = 1;
        const ctx = makeSwapEnchantsCtx([item1, item2], pmap, (loc) => {
            if (loc.x === 1 && loc.y === 1) return item1;
            if (loc.x === 2 && loc.y === 1) return item2;
            return null;
        }, {
            cellHasTMFlag: (loc, flags) => {
                const isTile = (loc.x === 1 && loc.y === 1) || (loc.x === 2 && loc.y === 1);
                return isTile && !!(flags & TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION);
            },
        });
        expect(swapItemEnchants(1, ctx)).toBe(false);
    });

    it("swaps enchants between two items with different levels and returns true", () => {
        const item1 = makeItem({
            category: ItemCategory.WEAPON,
            enchant1: 3,
            flags: ItemFlag.ITEM_IDENTIFIED,
            loc: { x: 1, y: 1 },
        });
        const item2 = makeItem({
            category: ItemCategory.ARMOR,
            enchant1: 5,
            flags: ItemFlag.ITEM_IDENTIFIED,
            loc: { x: 2, y: 1 },
        });
        const pmap = makePmap();
        pmap[1][1].machineNumber = 1;
        pmap[2][1].machineNumber = 1;
        const ctx = makeSwapEnchantsCtx([item1, item2], pmap, (loc) => {
            if (loc.x === 1 && loc.y === 1) return item1;
            if (loc.x === 2 && loc.y === 1) return item2;
            return null;
        }, {
            cellHasTMFlag: (loc, flags) => {
                const isTile = (loc.x === 1 && loc.y === 1) || (loc.x === 2 && loc.y === 1);
                return isTile && !!(flags & TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION);
            },
        });
        const result = swapItemEnchants(1, ctx);
        expect(result).toBe(true);
        expect(item1.enchant1).toBe(5);
        expect(item2.enchant1).toBe(3);
    });

    it("ignores items in a different machine number", () => {
        const item1 = makeItem({ category: ItemCategory.WEAPON, enchant1: 3, loc: { x: 1, y: 1 } });
        const item2 = makeItem({ category: ItemCategory.ARMOR, enchant1: 5, loc: { x: 2, y: 1 } });
        const pmap = makePmap();
        pmap[1][1].machineNumber = 2; // different machine
        pmap[2][1].machineNumber = 2;
        const ctx = makeSwapEnchantsCtx([item1, item2], pmap, (loc) => {
            if (loc.x === 1 && loc.y === 1) return item1;
            if (loc.x === 2 && loc.y === 1) return item2;
            return null;
        }, {
            cellHasTMFlag: (loc, flags) => {
                const isTile = (loc.x === 1 && loc.y === 1) || (loc.x === 2 && loc.y === 1);
                return isTile && !!(flags & TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION);
            },
        });
        // Machine number 1 — but items are in machine 2
        expect(swapItemEnchants(1, ctx)).toBe(false);
    });

    it("ignores non-swappable items (quivered weapon)", () => {
        const item1 = makeItem({ category: ItemCategory.WEAPON, enchant1: 3, quiverNumber: 5, loc: { x: 1, y: 1 } });
        const item2 = makeItem({ category: ItemCategory.ARMOR, enchant1: 5, quiverNumber: 0, loc: { x: 2, y: 1 } });
        const pmap = makePmap();
        pmap[1][1].machineNumber = 1;
        pmap[2][1].machineNumber = 1;
        const ctx = makeSwapEnchantsCtx([item1, item2], pmap, (loc) => {
            if (loc.x === 1 && loc.y === 1) return item1;
            if (loc.x === 2 && loc.y === 1) return item2;
            return null;
        }, {
            cellHasTMFlag: (loc, flags) => {
                const isTile = (loc.x === 1 && loc.y === 1) || (loc.x === 2 && loc.y === 1);
                return isTile && !!(flags & TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION);
            },
        });
        // item1 is quivered (non-swappable) — only item2 qualifies, not enough for a swap
        expect(swapItemEnchants(1, ctx)).toBe(false);
    });

    it("swaps a ring and a staff (wands are not swappable via CAN_BE_SWAPPED)", () => {
        // Wands are excluded from CAN_BE_SWAPPED; use ring + staff instead.
        const ring = makeItem({ category: ItemCategory.RING, enchant1: 2, loc: { x: 1, y: 1 } });
        const staff = makeItem({ category: ItemCategory.STAFF, enchant1: 4, charges: 2, loc: { x: 2, y: 1 } });
        const pmap = makePmap();
        pmap[1][1].machineNumber = 1;
        pmap[2][1].machineNumber = 1;
        const ctx = makeSwapEnchantsCtx([ring, staff], pmap, (loc) => {
            if (loc.x === 1 && loc.y === 1) return ring;
            if (loc.x === 2 && loc.y === 1) return staff;
            return null;
        }, {
            cellHasTMFlag: (loc, flags) => {
                const isTile = (loc.x === 1 && loc.y === 1) || (loc.x === 2 && loc.y === 1);
                return isTile && !!(flags & TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION);
            },
        });
        const result = swapItemEnchants(1, ctx);
        expect(result).toBe(true);
        expect(ring.enchant1).toBe(4);
        expect(staff.enchant1).toBe(2);
    });
});
