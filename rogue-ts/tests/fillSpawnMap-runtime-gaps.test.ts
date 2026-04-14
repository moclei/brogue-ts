/*
 *  fillSpawnMap-runtime-gaps.test.ts
 *  Tests for the runtime-only callbacks added in fillSpawnMap and
 *  spawnDungeonFeature: flavorMessage, applyInstantTileEffectsToCreature,
 *  burnItem, aggravateMonsters/DFF_AGGRAVATES_MONSTERS, colorFlash/createFlare,
 *  and feature description message.
 *
 *  All tested in isolation — no game state required.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    fillSpawnMap,
    spawnDungeonFeature,
    type FillSpawnMapRefreshCallbacks,
    type SpawnDungeonFeatureRefreshCallbacks,
} from "../src/architect/machines.js";
import { TileType, DungeonLayer, DungeonFeatureType, LightType } from "../src/types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import { TileFlag, TerrainFlag, DFFlag, ItemFlag } from "../src/types/flags.js";
import { allocGrid, fillGrid } from "../src/grid/grid.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import { tileCatalog } from "../src/globals/tile-catalog.js";
import type { Pcell, CellDisplayBuffer, DungeonFeature, Color } from "../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCellDisplay(): CellDisplayBuffer {
    return {
        character: 0,
        foreColorComponents: [0, 0, 0],
        backColorComponents: [0, 0, 0],
        opacity: 0,
    };
}

function makeCell(dungeonTile: TileType = TileType.FLOOR): Pcell {
    const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING);
    layers[DungeonLayer.Dungeon] = dungeonTile;
    return {
        layers,
        flags: 0,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: makeCellDisplay(),
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: TileType.NOTHING,
    };
}

function makePmap(defaultTile: TileType = TileType.FLOOR): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            pmap[i][j] = makeCell(defaultTile);
        }
    }
    return pmap;
}

function makeColor(): Color {
    return {
        red: 50, green: 50, blue: 50,
        redRand: 0, greenRand: 0, blueRand: 0,
        rand: 0, colorDances: false,
    };
}

function makeFeature(overrides: Partial<DungeonFeature> = {}): DungeonFeature {
    return {
        tile: TileType.FLOOR as number,
        layer: DungeonLayer.Dungeon,
        startProbability: 100,
        probabilityDecrement: 0,
        flags: 0,
        description: "",
        lightFlare: LightType.NO_LIGHT as number,
        flashColor: null,
        effectRadius: 0,
        propagationTerrain: 0 as any,
        subsequentDF: 0 as any,
        messageDisplayed: false,
        ...overrides,
    };
}

// =============================================================================
// fillSpawnMap — refresh=true callbacks
// =============================================================================

describe("fillSpawnMap refresh callbacks", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
    });

    it("calls flavorMessage when player is on the changed cell and not levitating", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        const flavorMessageFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            flavorMessage: flavorMessageFn,
            playerState: { loc: { x: 10, y: 10 }, isLevitating: false },
            tileFlavor: () => "the floor burns beneath your feet",
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.TORCH_WALL,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(flavorMessageFn).toHaveBeenCalledOnce();
        expect(flavorMessageFn).toHaveBeenCalledWith("the floor burns beneath your feet");
    });

    it("does not call flavorMessage when player is levitating", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        const flavorMessageFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            flavorMessage: flavorMessageFn,
            playerState: { loc: { x: 10, y: 10 }, isLevitating: true },
            tileFlavor: () => "test",
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.TORCH_WALL,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(flavorMessageFn).not.toHaveBeenCalled();
    });

    it("does not call flavorMessage when player is not on changed cell", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        const flavorMessageFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            flavorMessage: flavorMessageFn,
            playerState: { loc: { x: 5, y: 5 }, isLevitating: false },
            tileFlavor: () => "test",
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.TORCH_WALL,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(flavorMessageFn).not.toHaveBeenCalled();
    });

    it("does not call flavorMessage when refresh=false", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        const flavorMessageFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            flavorMessage: flavorMessageFn,
            playerState: { loc: { x: 10, y: 10 }, isLevitating: false },
            tileFlavor: () => "test",
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.TORCH_WALL,
            spawnMap, false, false, false,
            undefined, undefined, cb,
        );

        expect(flavorMessageFn).not.toHaveBeenCalled();
    });

    it("calls applyInstantTileEffectsToCreature for monster on newly written cell", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        // Mark cell as having a monster
        pmap[10][10].flags |= TileFlag.HAS_MONSTER;
        const fakeMonster = { loc: { x: 10, y: 10 } };

        const applyFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            applyInstantTileEffectsToCreature: applyFn,
            monsterAtLoc: (loc) => (loc.x === 10 && loc.y === 10 ? fakeMonster : null),
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.TORCH_WALL,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(applyFn).toHaveBeenCalledOnce();
        expect(applyFn).toHaveBeenCalledWith(fakeMonster);
    });

    it("does not call applyInstantTileEffectsToCreature when no monster on cell", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;
        // No HAS_MONSTER or HAS_PLAYER flag

        const applyFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            applyInstantTileEffectsToCreature: applyFn,
            monsterAtLoc: () => null,
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.TORCH_WALL,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(applyFn).not.toHaveBeenCalled();
    });

    it("calls burnItem for flammable item on newly written fire tile", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        // Mark cell as having an item
        pmap[10][10].flags |= TileFlag.HAS_ITEM;
        const fakeItem = { flags: ItemFlag.ITEM_FLAMMABLE, loc: { x: 10, y: 10 } };

        const burnFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            burnItem: burnFn,
            itemAtLoc: (loc) => (loc.x === 10 && loc.y === 10 ? fakeItem : null),
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.PLAIN_FIRE,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(burnFn).toHaveBeenCalledOnce();
        expect(burnFn).toHaveBeenCalledWith(fakeItem);
    });

    it("does not call burnItem for non-flammable item on fire tile", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;

        pmap[10][10].flags |= TileFlag.HAS_ITEM;
        // Item with no ITEM_FLAMMABLE flag
        const fakeItem = { flags: 0, loc: { x: 10, y: 10 } };

        const burnFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            burnItem: burnFn,
            itemAtLoc: () => fakeItem,
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.PLAIN_FIRE,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(burnFn).not.toHaveBeenCalled();
    });

    it("does not call burnItem for fire tile when no item present", () => {
        const spawnMap = allocGrid();
        fillGrid(spawnMap, 0);
        spawnMap[10][10] = 1;
        // No HAS_ITEM flag

        const burnFn = vi.fn();
        const cb: FillSpawnMapRefreshCallbacks = {
            burnItem: burnFn,
            itemAtLoc: () => null,
        };

        fillSpawnMap(
            pmap, tileCatalog,
            DungeonLayer.Surface, TileType.PLAIN_FIRE,
            spawnMap, false, true, false,
            undefined, undefined, cb,
        );

        expect(burnFn).not.toHaveBeenCalled();
    });
});

// =============================================================================
// spawnDungeonFeature — refresh=true callbacks
// =============================================================================

describe("spawnDungeonFeature refresh callbacks", () => {
    let pmap: Pcell[][];
    const emptyFeatureCatalog: DungeonFeature[] = [{
        tile: 0 as any,
        layer: DungeonLayer.Dungeon,
        startProbability: 0,
        probabilityDecrement: 0,
        flags: 0,
        description: "",
        lightFlare: 0 as any,
        flashColor: null,
        effectRadius: 0,
        propagationTerrain: 0 as any,
        subsequentDF: 0 as any,
        messageDisplayed: false,
    }];

    beforeEach(() => {
        seedRandomGenerator(12345n);
        pmap = makePmap();
    });

    it("calls aggravateMonsters when DFF_AGGRAVATES_MONSTERS is set", () => {
        const aggFn = vi.fn();
        const grayColor = makeColor();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            aggravateMonsters: aggFn,
            gray: grayColor,
        };
        const feat = makeFeature({
            tile: 0 as any,
            flags: DFFlag.DFF_AGGRAVATES_MONSTERS,
            effectRadius: 5,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(aggFn).toHaveBeenCalledOnce();
        expect(aggFn).toHaveBeenCalledWith(5, 10, 10, grayColor);
    });

    it("does not call aggravateMonsters when DFF_AGGRAVATES_MONSTERS is not set", () => {
        const aggFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            aggravateMonsters: aggFn,
            gray: makeColor(),
        };
        const feat = makeFeature({
            tile: 0 as any,
            flags: 0,
            effectRadius: 5,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(aggFn).not.toHaveBeenCalled();
    });

    it("does not call aggravateMonsters when gray is not provided", () => {
        const aggFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            aggravateMonsters: aggFn,
            // gray intentionally omitted
        };
        const feat = makeFeature({
            tile: 0 as any,
            flags: DFFlag.DFF_AGGRAVATES_MONSTERS,
            effectRadius: 5,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(aggFn).not.toHaveBeenCalled();
    });

    it("calls colorFlash when refreshCell=true and flashColor/effectRadius set", () => {
        const flashFn = vi.fn();
        const flashColor = makeColor();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            colorFlash: flashFn,
            colorFlashTileFlags: 0x40 | 0x2000, // IN_FIELD_OF_VIEW | CLAIRVOYANT_VISIBLE
        };
        const feat = makeFeature({
            tile: 0 as any,
            flashColor,
            effectRadius: 4,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(flashFn).toHaveBeenCalledOnce();
        expect(flashFn).toHaveBeenCalledWith(flashColor, 0, 0x40 | 0x2000, 4, 4, 10, 10);
    });

    it("does not call colorFlash when refreshCell=false", () => {
        const flashFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            colorFlash: flashFn,
        };
        const feat = makeFeature({
            tile: 0 as any,
            flashColor: makeColor(),
            effectRadius: 4,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, false, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(flashFn).not.toHaveBeenCalled();
    });

    it("calls createFlare when refreshCell=true and lightFlare set", () => {
        const flareFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            createFlare: flareFn,
        };
        const feat = makeFeature({
            tile: 0 as any,
            lightFlare: LightType.SCROLL_LIGHT as number,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(flareFn).toHaveBeenCalledOnce();
        expect(flareFn).toHaveBeenCalledWith(10, 10, LightType.SCROLL_LIGHT);
    });

    it("does not call createFlare when refreshCell=false", () => {
        const flareFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            createFlare: flareFn,
        };
        const feat = makeFeature({
            tile: 0 as any,
            lightFlare: LightType.SCROLL_LIGHT as number,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, false, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(flareFn).not.toHaveBeenCalled();
    });

    it("shows description message before tile placement (C: line 3370)", () => {
        const calls: string[] = [];
        const messageFn = vi.fn((msg: string, _flags: number) => { calls.push(`msg:${msg}`); });
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            message: messageFn,
            playerCanSee: () => true,
        };
        const feat = makeFeature({
            tile: TileType.FLOOR as number,
            description: "the floor shudders!",
            messageDisplayed: false,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(messageFn).toHaveBeenCalledOnce();
        expect(messageFn).toHaveBeenCalledWith("the floor shudders!", 0);
        expect(feat.messageDisplayed).toBe(true);
    });

    it("does not show description message when player cannot see location", () => {
        const messageFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            message: messageFn,
            playerCanSee: () => false,
        };
        const feat = makeFeature({
            tile: 0 as any,
            description: "hidden message",
            messageDisplayed: false,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(messageFn).not.toHaveBeenCalled();
    });

    it("does not show description message when already displayed", () => {
        const messageFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            message: messageFn,
            playerCanSee: () => true,
        };
        const feat = makeFeature({
            tile: 0 as any,
            description: "already shown",
            messageDisplayed: true,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, true, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(messageFn).not.toHaveBeenCalled();
    });

    it("does not show description message when refreshCell=false", () => {
        const messageFn = vi.fn();
        const cb: SpawnDungeonFeatureRefreshCallbacks = {
            message: messageFn,
            playerCanSee: () => true,
        };
        const feat = makeFeature({
            tile: 0 as any,
            description: "no refresh",
            messageDisplayed: false,
        });

        spawnDungeonFeature(
            pmap, tileCatalog, emptyFeatureCatalog,
            10, 10, feat, false, false,
            undefined, undefined, undefined, undefined, cb,
        );

        expect(messageFn).not.toHaveBeenCalled();
    });
});
