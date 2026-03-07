/*
 *  floor-items.test.ts — Tests for updateFloorItems
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateFloorItems } from "../../src/items/floor-items.js";
import type { UpdateFloorItemsContext } from "../../src/items/floor-items.js";
import type { Item, Pcell, LevelData } from "../../src/types/types.js";
import { ItemCategory, DisplayGlyph } from "../../src/types/enums.js";
import { ItemFlag, TileFlag } from "../../src/types/flags.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
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

/** Create a 3×3 pmap of blank cells. */
function makePmap(size = 3): Pcell[][] {
    const map: Pcell[][] = [];
    for (let x = 0; x < size; x++) {
        map[x] = [];
        for (let y = 0; y < size; y++) {
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

/** Minimal tileCatalog: every tile entry has mechFlags = 0. */
const blankTileCatalog = new Proxy([] as any[], {
    get(_target, prop) {
        if (prop === "length") return 256;
        return { mechFlags: 0, flags: 0, drawPriority: 0 };
    },
});

function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
    return {
        visited: false,
        mapStorage: null as any,
        items: [],
        monsters: [],
        dormantMonsters: [],
        scentMap: null,
        levelSeed: BigInt(0),
        upStairsLoc: { x: 0, y: 0 },
        downStairsLoc: { x: 0, y: 0 },
        playerExitedVia: { x: 0, y: 0 },
        awaySince: 0,
        ...overrides,
    };
}

function makeCtx(overrides: Partial<UpdateFloorItemsContext> = {}): UpdateFloorItemsContext {
    const floorItems: Item[] = [];
    const pmap = makePmap();
    const levels = [makeLevel(), makeLevel(), makeLevel()];

    return {
        floorItems,
        pmap,
        rogue: { absoluteTurnNumber: 10, depthLevel: 1 },
        gameConst: { deepestLevel: 26 } as any,
        levels,
        player: { loc: { x: 0, y: 0 } },
        tileCatalog: blankTileCatalog,

        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,

        itemName: (_item, buf) => { buf[0] = "sword"; },
        identifyItemKind: vi.fn(),

        removeItemFromChain: (item, chain) => {
            const idx = (chain as Item[]).indexOf(item);
            if (idx >= 0) (chain as Item[]).splice(idx, 1);
        },
        deleteItem: vi.fn(),
        burnItem: vi.fn(),
        promoteTile: vi.fn(),
        activateMachine: vi.fn(),
        circuitBreakersPreventActivation: () => false,
        swapItemEnchants: () => false,
        getQualifyingLocNear: () => null,

        messageWithColor: vi.fn(),
        discover: vi.fn(),
        refreshDungeonCell: vi.fn(),
        itemMessageColor: { ...white },
        ...overrides,
    };
}

// =============================================================================
// Tests
// =============================================================================

describe("updateFloorItems", () => {
    it("does nothing when floorItems is empty", () => {
        const ctx = makeCtx();
        expect(() => updateFloorItems(ctx)).not.toThrow();
    });

    it("skips items whose spawnTurnNumber is in the future", () => {
        const item = makeItem({ spawnTurnNumber: 20, loc: { x: 1, y: 1 } });
        const ctx = makeCtx();
        ctx.floorItems.push(item);
        ctx.rogue.absoluteTurnNumber = 10; // item spawns on turn 20

        updateFloorItems(ctx);

        // No side effects should have occurred
        expect(ctx.burnItem).not.toHaveBeenCalled();
        expect(ctx.deleteItem).not.toHaveBeenCalled();
        expect(ctx.refreshDungeonCell).not.toHaveBeenCalled();
    });

    it("processes items whose spawnTurnNumber equals absoluteTurnNumber", () => {
        const item = makeItem({ spawnTurnNumber: 10, loc: { x: 1, y: 1 } });
        const ctx = makeCtx();
        ctx.floorItems.push(item);
        ctx.rogue.absoluteTurnNumber = 10;

        // No special terrain — just confirm it runs without errors
        expect(() => updateFloorItems(ctx)).not.toThrow();
    });

    it("auto-identifies an item in the same machine as the player", () => {
        const item = makeItem({
            flags: ItemFlag.ITEM_KIND_AUTO_ID,
            loc: { x: 1, y: 1 },
            spawnTurnNumber: 0,
        });
        const identifyItemKind = vi.fn();
        const ctx = makeCtx({ identifyItemKind });
        ctx.floorItems.push(item);

        // Put item and player in the same machine (machine 3)
        ctx.pmap[1][1].machineNumber = 3;
        ctx.pmap[0][0].machineNumber = 3;
        // player is at (0,0)
        ctx.player = { loc: { x: 0, y: 0 } };

        updateFloorItems(ctx);

        expect(identifyItemKind).toHaveBeenCalledWith(item);
    });

    it("does not auto-identify when item is in a different machine than the player", () => {
        const item = makeItem({
            flags: ItemFlag.ITEM_KIND_AUTO_ID,
            loc: { x: 1, y: 1 },
            spawnTurnNumber: 0,
        });
        const identifyItemKind = vi.fn();
        const ctx = makeCtx({ identifyItemKind });
        ctx.floorItems.push(item);

        ctx.pmap[1][1].machineNumber = 3;
        ctx.pmap[0][0].machineNumber = 5; // different machine
        ctx.player = { loc: { x: 0, y: 0 } };

        updateFloorItems(ctx);

        expect(identifyItemKind).not.toHaveBeenCalled();
    });

    it("does not auto-identify when the item does not have ITEM_KIND_AUTO_ID", () => {
        const item = makeItem({
            flags: 0, // no ITEM_KIND_AUTO_ID
            loc: { x: 1, y: 1 },
            spawnTurnNumber: 0,
        });
        const identifyItemKind = vi.fn();
        const ctx = makeCtx({ identifyItemKind });
        ctx.floorItems.push(item);

        ctx.pmap[1][1].machineNumber = 3;
        ctx.pmap[0][0].machineNumber = 3;
        ctx.player = { loc: { x: 0, y: 0 } };

        updateFloorItems(ctx);

        expect(identifyItemKind).not.toHaveBeenCalled();
    });
});

// =============================================================================
// Stub registry — complex branches with missing dependencies
// =============================================================================

it.skip("updateFloorItems: auto-descent — item on T_AUTO_DESCENT tile falls to next level", () => {
    // C: Items.c:1206 — T_AUTO_DESCENT branch
    // Requires: cellHasTerrainFlag returns T_AUTO_DESCENT, discover, messageWithColor,
    //           removeItemFromChain, deleteItem (for potions), levels array
    // Full integration test blocked on terrain-flag wiring in tests.
});

it.skip("updateFloorItems: potion falls on T_AUTO_DESCENT tile and is deleted (not migrated)", () => {
    // C: Items.c:1222 — category === POTION check in auto-descent
    // Potions are destroyed by the fall rather than migrated to the next level.
});

it.skip("updateFloorItems: flammable item on T_IS_FIRE tile is burned", () => {
    // C: Items.c:1234 — T_IS_FIRE && ITEM_FLAMMABLE branch
    // Requires burnItem() to be fully wired (it internally spawns fire DFs).
});

it.skip("updateFloorItems: item on T_LAVA_INSTA_DEATH tile is burned (unless it is the amulet)", () => {
    // C: Items.c:1235 — T_LAVA_INSTA_DEATH && not AMULET branch
    // Amulet of Yendor is immune to lava destruction.
});

it.skip("updateFloorItems: item on T_MOVES_ITEMS drifts to adjacent cell", () => {
    // C: Items.c:1240 — T_MOVES_ITEMS branch (deep water / lava conveyor)
    // Requires getQualifyingLocNear to return an adjacent cell.
    // Item only moves if distanceBetween == 1 (prevents wall-phasing).
});

it.skip("updateFloorItems: item does not drift if getQualifyingLocNear returns a non-adjacent cell", () => {
    // C: Items.c:1244 — distance check prevents wall phasing
});

it.skip("updateFloorItems: terrain promotes when TM_PROMOTES_ON_ITEM and item is present", () => {
    // C: Items.c:1257 — TM_PROMOTES_ON_ITEM branch
    // Requires tileCatalog entries with mechFlags including TM_PROMOTES_ON_ITEM.
    // promoteTile is called for each matching layer.
});

it.skip("updateFloorItems: enchant-swap activates when TM_SWAP_ENCHANTS_ACTIVATION and no circuit breakers", () => {
    // C: Items.c:1271 — TM_SWAP_ENCHANTS_ACTIVATION branch
    // Requires swapItemEnchants to be implemented (Phase 3b — currently MISSING).
    // When swapItemEnchants returns true and no circuit breakers, activateMachine is called.
});
