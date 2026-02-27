/*
 *  item-helpers.test.ts — Tests for item description helpers and search
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    describedItemBasedOnParameters,
    describedItemName,
    useKeyAt,
    search,
} from "../../src/movement/item-helpers.js";
import type { ItemHelperContext } from "../../src/movement/item-helpers.js";
import { StatusEffect } from "../../src/types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag } from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item, Color } from "../../src/types/types.js";
import { NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

const dummyColor: Color = { red: 0, green: 0, blue: 0, rand: 0, colorDances: false };

function makeItem(overrides: Partial<Item> = {}): Item {
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
        quantity: 1,
        inventoryLetter: "a",
        inventoryColor: dummyColor,
        inscription: "",
        originDepth: 1,
        keyLoc: Array.from({ length: 4 }, () => ({
            loc: { x: 0, y: 0 },
            machine: 0,
            disposableHere: false,
        })),
        ...overrides,
    } as Item;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: { flags: 0, abilityFlags: 0 },
        currentHP: 10,
        bookkeepingFlags: 0,
        creatureState: 0,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
    } as Creature;
}

function makeCell(overrides: Partial<Pcell> = {}): Pcell {
    return {
        layers: [1, 0, 0, 0],
        flags: TileFlag.DISCOVERED,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: 0,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
        ...overrides,
    };
}

function makeCtx(overrides: Partial<ItemHelperContext> = {}): ItemHelperContext {
    const player = makeCreature({ loc: { x: 5, y: 5 } });
    const pmap: Pcell[][] = [];
    for (let x = 0; x < 15; x++) {
        pmap[x] = [];
        for (let y = 0; y < 15; y++) {
            pmap[x][y] = makeCell();
        }
    }

    return {
        pmap,
        player,
        rogue: { playbackOmniscience: false },
        tileCatalog: Array.from({ length: 50 }, () => ({
            flags: 0,
            mechFlags: 0,
            discoverType: 0,
            description: "floor",
        })),
        initializeItem: () => makeItem(),
        itemName: (_item, buf) => { buf[0] = "a test item"; },
        describeHallucinatedItem: (buf) => { buf[0] = "a hallucinated thing"; },
        removeItemFromChain: () => false,
        deleteItem: () => {},
        monsterAtLoc: () => null,
        promoteTile: () => {},
        messageWithColor: () => {},
        itemMessageColor: dummyColor,
        packItems: [],
        floorItems: [],
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        coordinatesAreInMap: (x, y) => x >= 0 && x < 15 && y >= 0 && y < 15,
        playerCanDirectlySee: () => true,
        distanceBetween: (p1, p2) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y),
        discover: () => {},
        randPercent: () => true,
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        ...overrides,
    };
}

// =============================================================================
// describedItemBasedOnParameters
// =============================================================================

describe("describedItemBasedOnParameters", () => {
    it("creates a temp item and fills the buffer with its name", () => {
        const nameSpy = vi.fn((_item: Item, buf: string[]) => {
            buf[0] = "a healing potion";
        });
        const ctx = makeCtx({ itemName: nameSpy });
        const buf: string[] = [""];

        describedItemBasedOnParameters(0x10, 2, 1, 3, buf, ctx);

        expect(nameSpy).toHaveBeenCalled();
        expect(buf[0]).toBe("a healing potion");
    });

    it("sets category, kind, quantity, and originDepth on temp item", () => {
        let capturedItem: Item | null = null;
        const ctx = makeCtx({
            itemName: (item, buf) => {
                capturedItem = item;
                buf[0] = "test";
            },
        });
        const buf: string[] = [""];

        describedItemBasedOnParameters(0x20, 3, 5, 7, buf, ctx);

        expect(capturedItem).not.toBeNull();
        expect(capturedItem!.category).toBe(0x20);
        expect(capturedItem!.kind).toBe(3);
        expect(capturedItem!.quantity).toBe(5);
        expect(capturedItem!.originDepth).toBe(7);
    });
});

// =============================================================================
// describedItemName
// =============================================================================

describe("describedItemName", () => {
    it("uses full description when it fits within maxLength", () => {
        const ctx = makeCtx({
            itemName: (_item, buf, includeDetails) => {
                buf[0] = includeDetails ? "a +3 sword" : "a sword";
            },
        });
        const theItem = makeItem();
        const desc: string[] = [""];

        describedItemName(theItem, desc, 50, ctx);

        expect(desc[0]).toBe("a +3 sword");
    });

    it("falls back to terse description when full is too long", () => {
        const ctx = makeCtx({
            itemName: (_item, buf, includeDetails) => {
                buf[0] = includeDetails ? "a very long detailed item name that exceeds the limit" : "a sword";
            },
        });
        const theItem = makeItem();
        const desc: string[] = [""];

        describedItemName(theItem, desc, 20, ctx);

        expect(desc[0]).toBe("a sword");
    });

    it("uses hallucinated description when player is hallucinating", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Hallucinating] = 5;
        const theItem = makeItem();
        const desc: string[] = [""];

        describedItemName(theItem, desc, 50, ctx);

        expect(desc[0]).toBe("a hallucinated thing");
    });

    it("ignores hallucination when playbackOmniscience is true", () => {
        const ctx = makeCtx({
            itemName: (_item, buf) => { buf[0] = "real item"; },
        });
        ctx.rogue.playbackOmniscience = true;
        ctx.player.status[StatusEffect.Hallucinating] = 5;
        const theItem = makeItem();
        const desc: string[] = [""];

        describedItemName(theItem, desc, 50, ctx);

        expect(desc[0]).toBe("real item");
    });
});

// =============================================================================
// useKeyAt
// =============================================================================

describe("useKeyAt", () => {
    it("promotes terrain with TM_PROMOTES_WITH_KEY", () => {
        const promoteSpy = vi.fn();
        const catalog = Array.from({ length: 50 }, () => ({
            flags: 0,
            mechFlags: 0,
            discoverType: 0,
            description: "floor",
        }));
        catalog[1].mechFlags = TerrainMechFlag.TM_PROMOTES_WITH_KEY;
        catalog[1].description = "a locked door";

        const ctx = makeCtx({
            tileCatalog: catalog,
            promoteTile: promoteSpy,
        });
        const theItem = makeItem();

        useKeyAt(theItem, 5, 5, ctx);

        expect(promoteSpy).toHaveBeenCalledWith(5, 5, 0, false); // layer 0 has tile index 1
    });

    it("disposes key from pack when disposable", () => {
        const removeSpy = vi.fn().mockReturnValue(true);
        const deleteSpy = vi.fn();
        const msgSpy = vi.fn();
        const theItem = makeItem({
            keyLoc: [
                { loc: { x: 5, y: 5 }, machine: 0, disposableHere: true },
                { loc: { x: 0, y: 0 }, machine: 0, disposableHere: false },
                { loc: { x: 0, y: 0 }, machine: 0, disposableHere: false },
                { loc: { x: 0, y: 0 }, machine: 0, disposableHere: false },
            ],
        });
        const ctx = makeCtx({
            removeItemFromChain: removeSpy,
            deleteItem: deleteSpy,
            messageWithColor: msgSpy,
        });

        useKeyAt(theItem, 5, 5, ctx);

        expect(removeSpy).toHaveBeenCalled();
        expect(deleteSpy).toHaveBeenCalled();
        expect(msgSpy).toHaveBeenCalled();
    });

    it("uses 'the' instead of 'a' in terrain name", () => {
        const catalog = Array.from({ length: 50 }, () => ({
            flags: 0,
            mechFlags: 0,
            discoverType: 0,
            description: "floor",
        }));
        catalog[1].mechFlags = TerrainMechFlag.TM_PROMOTES_WITH_KEY;
        catalog[1].description = "a cage";

        let msgText = "";
        const ctx = makeCtx({
            tileCatalog: catalog,
            removeItemFromChain: () => true,
            messageWithColor: (msg) => { msgText = msg; },
        });
        const theItem = makeItem({
            keyLoc: [
                { loc: { x: 5, y: 5 }, machine: 0, disposableHere: true },
                { loc: { x: 0, y: 0 }, machine: 0, disposableHere: false },
                { loc: { x: 0, y: 0 }, machine: 0, disposableHere: false },
                { loc: { x: 0, y: 0 }, machine: 0, disposableHere: false },
            ],
        });

        useKeyAt(theItem, 5, 5, ctx);

        expect(msgText).toContain("the cage");
    });

    it("does not dispose non-disposable key", () => {
        const deleteSpy = vi.fn();
        const ctx = makeCtx({ deleteItem: deleteSpy });
        const theItem = makeItem(); // no disposable keyLoc entries

        useKeyAt(theItem, 5, 5, ctx);

        expect(deleteSpy).not.toHaveBeenCalled();
    });
});

// =============================================================================
// search
// =============================================================================

describe("search", () => {
    it("discovers secrets within search radius", () => {
        const discoverSpy = vi.fn();
        const ctx = makeCtx({
            cellHasTMFlag: (_p, f) => !!(f & TerrainMechFlag.TM_IS_SECRET),
            discover: discoverSpy,
            randPercent: () => true,
        });
        ctx.player.loc = { x: 5, y: 5 };

        const result = search(30, ctx); // radius = 3

        expect(result).toBe(true);
        expect(discoverSpy).toHaveBeenCalled();
    });

    it("returns false when nothing is discovered", () => {
        const ctx = makeCtx({
            cellHasTMFlag: () => false,
        });

        expect(search(30, ctx)).toBe(false);
    });

    it("respects coordinate bounds", () => {
        const discoverSpy = vi.fn();
        const ctx = makeCtx({
            cellHasTMFlag: (_p, f) => !!(f & TerrainMechFlag.TM_IS_SECRET),
            discover: discoverSpy,
            coordinatesAreInMap: (x, y) => x >= 0 && x < 15 && y >= 0 && y < 15,
        });
        ctx.player.loc = { x: 0, y: 0 };

        search(30, ctx); // radius = 3, some cells will be out of bounds

        // Should only discover cells that are in map
        for (const call of discoverSpy.mock.calls) {
            expect(call[0]).toBeGreaterThanOrEqual(0);
            expect(call[1]).toBeGreaterThanOrEqual(0);
        }
    });

    it("marks cells as trap-free when search strength is high enough", () => {
        const ctx = makeCtx({
            cellHasTMFlag: () => false,
        });
        ctx.player.loc = { x: 5, y: 5 };

        search(100, ctx); // 100 - distance*10; for adjacent cells, 100-10=90, not >= 100

        // Cell at (5,5) — distance 0 → percent = 100 → KNOWN_TO_BE_TRAP_FREE
        expect(ctx.pmap[5][5].flags & TileFlag.KNOWN_TO_BE_TRAP_FREE).toBeTruthy();
    });

    it("reduces search chance in obstructing terrain", () => {
        let searchChances: number[] = [];
        const ctx = makeCtx({
            cellHasTerrainFlag: (_p, f) => !!(f & TerrainFlag.T_OBSTRUCTS_PASSABILITY),
            cellHasTMFlag: (_p, f) => !!(f & TerrainMechFlag.TM_IS_SECRET),
            randPercent: (chance) => {
                searchChances.push(chance);
                return false;
            },
        });
        ctx.player.loc = { x: 5, y: 5 };

        search(50, ctx);

        // For adjacent cells with obstructing terrain, percent should be reduced to 2/3
        // e.g. for distance 1: (50 - 10) * 2/3 = 26
        const hasReducedChance = searchChances.some(c => c < 40);
        expect(hasReducedChance).toBe(true);
    });
});
