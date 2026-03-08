/*
 *  floor-items.test.ts — Tests for updateFloorItems
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateFloorItems } from "../../src/items/floor-items.js";
import type { UpdateFloorItemsContext } from "../../src/items/floor-items.js";
import type { Item, Pcell, LevelData } from "../../src/types/types.js";
import { ItemCategory, DisplayGlyph } from "../../src/types/enums.js";
import { ItemFlag, TileFlag, TerrainFlag, TerrainMechFlag } from "../../src/types/flags.js";
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

it("updateFloorItems: auto-descent — item on T_AUTO_DESCENT tile falls to next level", () => {
    const item = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 1 }, category: ItemCategory.WEAPON });
    const levels = [makeLevel(), makeLevel(), makeLevel()];
    const pmap = makePmap();
    pmap[1][1].flags |= TileFlag.VISIBLE;
    const ctx = makeCtx({
        floorItems: [item],
        levels,
        pmap,
        rogue: { absoluteTurnNumber: 10, depthLevel: 1 },
        gameConst: { deepestLevel: 26 } as any,
        cellHasTerrainFlag: (_loc, flags) => !!(flags & TerrainFlag.T_AUTO_DESCENT),
    });
    updateFloorItems(ctx);
    // Item removed from current floor and moved to next level
    expect(ctx.floorItems).not.toContain(item);
    expect(levels[1].items).toContain(item);
    expect(ctx.messageWithColor).toHaveBeenCalled();
});

it("updateFloorItems: potion falls on T_AUTO_DESCENT tile and is deleted (not migrated)", () => {
    const potion = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 1 }, category: ItemCategory.POTION });
    const levels = [makeLevel(), makeLevel(), makeLevel()];
    const ctx = makeCtx({
        floorItems: [potion],
        levels,
        rogue: { absoluteTurnNumber: 10, depthLevel: 1 },
        gameConst: { deepestLevel: 26 } as any,
        cellHasTerrainFlag: (_loc, flags) => !!(flags & TerrainFlag.T_AUTO_DESCENT),
    });
    updateFloorItems(ctx);
    expect(ctx.floorItems).not.toContain(potion);
    expect(levels[1].items).not.toContain(potion);
    expect(ctx.deleteItem).toHaveBeenCalledWith(potion);
});

it("updateFloorItems: flammable item on T_IS_FIRE tile is burned", () => {
    const item = makeItem({
        spawnTurnNumber: 0, loc: { x: 1, y: 1 },
        flags: ItemFlag.ITEM_FLAMMABLE,
    });
    const ctx = makeCtx({
        floorItems: [item],
        cellHasTerrainFlag: (_loc, flags) => !!(flags & TerrainFlag.T_IS_FIRE),
    });
    updateFloorItems(ctx);
    expect(ctx.burnItem).toHaveBeenCalledWith(item);
});

it("updateFloorItems: item on T_LAVA_INSTA_DEATH tile is burned (unless it is the amulet)", () => {
    const item = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 1 }, category: ItemCategory.WEAPON });
    const amulet = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 2 }, category: ItemCategory.AMULET });
    const ctx = makeCtx({
        floorItems: [item, amulet],
        cellHasTerrainFlag: (_loc, flags) => !!(flags & TerrainFlag.T_LAVA_INSTA_DEATH),
    });
    updateFloorItems(ctx);
    expect(ctx.burnItem).toHaveBeenCalledWith(item);
    expect(ctx.burnItem).not.toHaveBeenCalledWith(amulet);
});

it("updateFloorItems: item on T_MOVES_ITEMS drifts to adjacent cell", () => {
    const item = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 1 } });
    const pmap = makePmap(5);
    const ctx = makeCtx({
        floorItems: [item],
        pmap,
        // Use T_IS_DEEP_WATER only (T_LAVA_INSTA_DEATH would also trigger the burn check)
        cellHasTerrainFlag: (_loc, flags) => !!(flags & TerrainFlag.T_IS_DEEP_WATER),
        // Return adjacent cell (distance == 1)
        getQualifyingLocNear: () => ({ x: 1, y: 2 }),
    });
    updateFloorItems(ctx);
    expect(item.loc).toEqual({ x: 1, y: 2 });
    expect(ctx.refreshDungeonCell).toHaveBeenCalled();
});

it("updateFloorItems: item does not drift if getQualifyingLocNear returns a non-adjacent cell", () => {
    const item = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 1 } });
    const ctx = makeCtx({
        floorItems: [item],
        cellHasTerrainFlag: (_loc, flags) => !!(flags & (TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_LAVA_INSTA_DEATH)),
        // Return non-adjacent cell (distance > 1)
        getQualifyingLocNear: () => ({ x: 3, y: 3 }),
    });
    updateFloorItems(ctx);
    // Item should not have moved
    expect(item.loc).toEqual({ x: 1, y: 1 });
});

it("updateFloorItems: terrain promotes when TM_PROMOTES_ON_ITEM and item is present", () => {
    const item = makeItem({ spawnTurnNumber: 0, loc: { x: 1, y: 1 } });
    const tileCatalogWithPromotion = new Proxy([] as any[], {
        get(_target, prop) {
            if (prop === "length") return 256;
            return { mechFlags: TerrainMechFlag.TM_PROMOTES_ON_ITEM, flags: 0, drawPriority: 0 };
        },
    });
    const ctx = makeCtx({
        floorItems: [item],
        tileCatalog: tileCatalogWithPromotion,
        cellHasTMFlag: (_loc, flags) => !!(flags & TerrainMechFlag.TM_PROMOTES_ON_ITEM),
    });
    updateFloorItems(ctx);
    expect(ctx.promoteTile).toHaveBeenCalled();
});

it("updateFloorItems: enchant-swap activates when TM_SWAP_ENCHANTS_ACTIVATION and no circuit breakers", () => {
    // C: Items.c:1271 — TM_SWAP_ENCHANTS_ACTIVATION branch
    const item = makeItem({ loc: { x: 1, y: 1 } });
    const activateMachine = vi.fn();
    const swapItemEnchants = vi.fn(() => true);
    const pmap = makePmap();
    pmap[1][1].machineNumber = 7;

    const ctx = makeCtx({
        floorItems: [item],
        pmap,
        cellHasTMFlag: (_loc, flags) => !!(flags & 0x02000000), // TM_SWAP_ENCHANTS_ACTIVATION = Fl(25)
        circuitBreakersPreventActivation: () => false,
        swapItemEnchants,
        activateMachine,
    });
    updateFloorItems(ctx);
    expect(swapItemEnchants).toHaveBeenCalledWith(7);
    expect(activateMachine).toHaveBeenCalledWith(7);
});
