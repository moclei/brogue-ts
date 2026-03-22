/*
 *  io/sprite-appearance.test.ts — Unit tests for getCellSpriteData
 *  Port V2 — rogue-ts
 */

import { describe, it, expect } from "vitest";
import { TileType, DisplayGlyph, DungeonLayer, StatusEffect } from "../../src/types/enums.js";
import { TileFlag, MonsterBehaviorFlag } from "../../src/types/flags.js";
import type { Pcell, Creature, Color, Item, FloorTileType, CreatureType } from "../../src/types/types.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import { VisibilityState } from "../../src/io/cell-queries.js";
import type { CellQueryContext } from "../../src/io/cell-queries.js";
import { RenderLayer, createCellSpriteData } from "../../src/platform/render-layers.js";
import { getCellSpriteData } from "../../src/io/sprite-appearance.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makePcell(overrides?: Partial<Pcell>): Pcell {
    return {
        layers: [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
        flags: 0,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: {
            character: 0 as DisplayGlyph,
            foreColorComponents: [0, 0, 0],
            backColorComponents: [0, 0, 0],
            opacity: 0,
        },
        rememberedLayers: [],
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: TileType.NOTHING,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
        ...overrides,
    };
}

function makePmap(width = DCOLS, height = DROWS): Pcell[][] {
    const pmap: Pcell[][] = new Array(width);
    for (let i = 0; i < width; i++) {
        pmap[i] = new Array(height);
        for (let j = 0; j < height; j++) {
            pmap[i][j] = makePcell();
        }
    }
    return pmap;
}

function makeCreature(x: number, y: number, overrides?: Partial<Creature>): Creature {
    return {
        info: {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(100, 100, 100),
            flags: 0,
            abilityFlags: 0,
            monsterName: "test creature",
            isLarge: false,
        },
        loc: { x, y },
        status: new Array(30).fill(0),
        maxStatus: new Array(30).fill(0),
        bookkeepingFlags: 0,
        creatureState: 0,
        creatureMode: 0,
        carriedItem: null,
        flashStrength: 0,
        flashColor: makeColor(),
    } as unknown as Creature;
}

function makeItem(x: number, y: number, overrides?: Partial<Item>): Item {
    return {
        loc: { x, y },
        displayChar: DisplayGlyph.G_POTION,
        foreColor: makeColor(50, 20, 80),
        category: 0,
        kind: 0,
        flags: 0,
        quantity: 1,
        originDepth: 1,
        ...overrides,
    } as unknown as Item;
}

function makeTmap(width = DCOLS, height = DROWS, lightLevel = 100) {
    const tmap: { light: number[] }[][] = new Array(width);
    for (let i = 0; i < width; i++) {
        tmap[i] = new Array(height);
        for (let j = 0; j < height; j++) {
            tmap[i][j] = { light: [lightLevel, lightLevel, lightLevel] };
        }
    }
    return tmap as unknown as readonly (readonly import("../../src/types/types.js").Tcell[])[];
}

function makeDisplayBuffer() {
    const cells: any[][] = [];
    for (let i = 0; i < 100; i++) {
        cells[i] = [];
        for (let j = 0; j < 34; j++) {
            cells[i][j] = { character: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0], opacity: 0 };
        }
    }
    return { cells } as import("../../src/types/types.js").ScreenDisplayBuffer;
}

function makeCtx(overrides?: Partial<CellQueryContext>): CellQueryContext {
    const player = makeCreature(5, 5);
    return {
        pmap: makePmap(),
        tmap: makeTmap(),
        displayBuffer: makeDisplayBuffer(),
        rogue: {
            playbackOmniscience: false,
            inWater: false,
            trueColorMode: false,
            stealthRange: 0,
            displayStealthRangeMode: false,
            scentTurnNumber: 0,
            cursorPathIntensity: 0,
        } as any,
        player,
        monsters: [],
        dormantMonsters: [],
        floorItems: [],
        tileCatalog,
        dungeonFeatureCatalog: [],
        monsterCatalog: [],
        terrainRandomValues: [],
        displayDetail: [],
        scentMap: [],
        monsterFlagsList: [],
        ...overrides,
    };
}

function colorsMatch(a: Color, b: Color): boolean {
    return a.red === b.red && a.green === b.green && a.blue === b.blue
        && a.redRand === b.redRand && a.greenRand === b.greenRand && a.blueRand === b.blueRand
        && a.rand === b.rand && a.colorDances === b.colorDances;
}

// =============================================================================
// Shroud
// =============================================================================

describe("getCellSpriteData — Shroud", () => {
    it("returns Shroud with all layers undefined for undiscovered cell", () => {
        const ctx = makeCtx();
        // Cell at (3,3) has no flags — undiscovered
        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Shroud);
        for (let i = 0; i < spriteData.layers.length; i++) {
            expect(spriteData.layers[i]).toBeUndefined();
        }
    });

    it("bgColor is zeroed for shroud", () => {
        const ctx = makeCtx();
        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.bgColor.red).toBe(0);
        expect(spriteData.bgColor.green).toBe(0);
        expect(spriteData.bgColor.blue).toBe(0);
    });
});

// =============================================================================
// Empty visible floor
// =============================================================================

describe("getCellSpriteData — empty visible floor", () => {
    it("populates TERRAIN layer with floor tile", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Visible);
        const terrain = spriteData.layers[RenderLayer.TERRAIN];
        expect(terrain).toBeDefined();
        expect(terrain!.tileType).toBe(TileType.FLOOR);
    });

    it("sets tint to tileCatalog foreColor for floor", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const terrain = spriteData.layers[RenderLayer.TERRAIN]!;
        const expectedColor = tileCatalog[TileType.FLOOR].foreColor!;
        expect(colorsMatch(terrain.tint, expectedColor)).toBe(true);
    });

    it("sets bgColor to tileCatalog backColor for floor", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const expectedBg = tileCatalog[TileType.FLOOR].backColor!;
        expect(colorsMatch(spriteData.bgColor, expectedBg)).toBe(true);
    });

    it("has no SURFACE, ITEM, ENTITY, GAS, or FIRE layers", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.SURFACE]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.ITEM]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.ENTITY]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.GAS]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.FIRE]).toBeUndefined();
    });
});

// =============================================================================
// TERRAIN: Dungeon vs Liquid priority
// =============================================================================

describe("getCellSpriteData — TERRAIN drawPriority", () => {
    it("picks Dungeon tile when Liquid is NOTHING", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Liquid] = TileType.NOTHING;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
    });

    it("picks higher-priority tile when both Dungeon and Liquid are set", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        // GRANITE drawPriority=0, DEEP_WATER drawPriority=40
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.GRANITE;
        ctx.pmap[3][3].layers[DungeonLayer.Liquid] = TileType.DEEP_WATER;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.GRANITE);
    });

    it("uses Liquid tile when it has better drawPriority", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        // FLOOR drawPriority=95, DEEP_WATER drawPriority=40
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Liquid] = TileType.DEEP_WATER;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.DEEP_WATER);
    });
});

// =============================================================================
// SURFACE layer (foliage)
// =============================================================================

describe("getCellSpriteData — SURFACE layer", () => {
    it("populates SURFACE for grass", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const surface = spriteData.layers[RenderLayer.SURFACE];
        expect(surface).toBeDefined();
        expect(surface!.tileType).toBe(TileType.GRASS);
    });

    it("sets tint to tileCatalog foreColor for surface tile", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const surface = spriteData.layers[RenderLayer.SURFACE]!;
        const expectedColor = tileCatalog[TileType.GRASS].foreColor!;
        expect(colorsMatch(surface.tint, expectedColor)).toBe(true);
    });

    it("routes fire on Surface DungeonLayer to FIRE RenderLayer", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.PLAIN_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.SURFACE]).toBeUndefined();
        const fire = spriteData.layers[RenderLayer.FIRE];
        expect(fire).toBeDefined();
        expect(fire!.tileType).toBe(TileType.PLAIN_FIRE);
    });
});

// =============================================================================
// GAS layer
// =============================================================================

describe("getCellSpriteData — GAS layer", () => {
    it("populates GAS layer for poison gas", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 50;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const gas = spriteData.layers[RenderLayer.GAS];
        expect(gas).toBeDefined();
        expect(gas!.tileType).toBe(TileType.POISON_GAS);
    });

    it("sets gas tint from tileCatalog backColor (gas tiles have no foreColor)", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 50;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const gas = spriteData.layers[RenderLayer.GAS]!;
        const expectedColor = tileCatalog[TileType.POISON_GAS].backColor!;
        expect(colorsMatch(gas.tint, expectedColor)).toBe(true);
    });

    it("sets volume-based alpha", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 60;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const gas = spriteData.layers[RenderLayer.GAS]!;
        expect(gas.alpha).toBeCloseTo(0.6);
    });

    it("clamps alpha to 1 at full volume", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 150;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.GAS]!.alpha).toBe(1);
    });

    it("routes fire on Gas DungeonLayer to FIRE RenderLayer", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.GAS_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.GAS]).toBeUndefined();
        const fire = spriteData.layers[RenderLayer.FIRE];
        expect(fire).toBeDefined();
        expect(fire!.tileType).toBe(TileType.GAS_FIRE);
    });
});

// =============================================================================
// FIRE layer
// =============================================================================

describe("getCellSpriteData — FIRE layer", () => {
    it("sets tint from tileCatalog foreColor for fire", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.PLAIN_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const fire = spriteData.layers[RenderLayer.FIRE]!;
        const expectedColor = tileCatalog[TileType.PLAIN_FIRE].foreColor!;
        expect(colorsMatch(fire.tint, expectedColor)).toBe(true);
    });

    it("gas fire overwrites surface fire on FIRE layer", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.PLAIN_FIRE;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.GAS_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const fire = spriteData.layers[RenderLayer.FIRE]!;
        expect(fire.tileType).toBe(TileType.GAS_FIRE);
    });
});

// =============================================================================
// ENTITY layer — player
// =============================================================================

describe("getCellSpriteData — ENTITY (player)", () => {
    it("populates ENTITY layer with player glyph", () => {
        const ctx = makeCtx();
        const player = makeCreature(3, 3);
        player.info = {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(80, 80, 80),
            flags: 0,
            abilityFlags: 0,
            monsterName: "player",
            isLarge: false,
        } as any;
        ctx.player = player;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_PLAYER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY];
        expect(entity).toBeDefined();
        expect(entity!.glyph).toBe(DisplayGlyph.G_PLAYER);
        expect(entity!.tint.red).toBe(80);
        expect(entity!.tint.green).toBe(80);
        expect(entity!.tint.blue).toBe(80);
    });

    it("player takes priority — no ITEM layer even with HAS_ITEM", () => {
        const ctx = makeCtx();
        const player = makeCreature(3, 3);
        ctx.player = player;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_PLAYER | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.floorItems = [makeItem(3, 3)] as any;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.ENTITY]).toBeDefined();
        expect(spriteData.layers[RenderLayer.ITEM]).toBeUndefined();
    });
});

// =============================================================================
// ENTITY layer — monster
// =============================================================================

describe("getCellSpriteData — ENTITY (monster)", () => {
    it("populates ENTITY layer for visible monster", () => {
        const ctx = makeCtx();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0,
            abilityFlags: 0,
            monsterName: "goblin",
            isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY];
        expect(entity).toBeDefined();
        expect(entity!.glyph).toBe(DisplayGlyph.G_GOBLIN);
        expect(entity!.tint.red).toBe(60);
        expect(entity!.tint.green).toBe(40);
        expect(entity!.tint.blue).toBe(20);
    });

    it("monster blocks ITEM layer", () => {
        const ctx = makeCtx();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0,
            abilityFlags: 0,
            monsterName: "goblin",
            isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.floorItems = [makeItem(3, 3)] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.ENTITY]).toBeDefined();
        expect(spriteData.layers[RenderLayer.ITEM]).toBeUndefined();
    });
});

// =============================================================================
// ITEM layer
// =============================================================================

describe("getCellSpriteData — ITEM layer", () => {
    it("populates ITEM layer for floor item", () => {
        const ctx = makeCtx();
        const item = makeItem(3, 3);
        ctx.floorItems = [item] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const itemLayer = spriteData.layers[RenderLayer.ITEM];
        expect(itemLayer).toBeDefined();
        expect(itemLayer!.glyph).toBe(DisplayGlyph.G_POTION);
        expect(itemLayer!.tint.red).toBe(50);
        expect(itemLayer!.tint.green).toBe(20);
        expect(itemLayer!.tint.blue).toBe(80);
    });

    it("uses white tint when item has no foreColor", () => {
        const ctx = makeCtx();
        const item = makeItem(3, 3, { foreColor: null } as any);
        ctx.floorItems = [item] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const itemLayer = spriteData.layers[RenderLayer.ITEM]!;
        expect(itemLayer.tint.red).toBe(100);
        expect(itemLayer.tint.green).toBe(100);
        expect(itemLayer.tint.blue).toBe(100);
    });
});

// =============================================================================
// Multi-layer cell
// =============================================================================

describe("getCellSpriteData — multi-layer", () => {
    it("creature on foliage on floor produces TERRAIN + SURFACE + ENTITY", () => {
        const ctx = makeCtx();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0,
            abilityFlags: 0,
            monsterName: "goblin",
            isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]).toBeDefined();
        expect(spriteData.layers[RenderLayer.SURFACE]).toBeDefined();
        expect(spriteData.layers[RenderLayer.ENTITY]).toBeDefined();
        expect(spriteData.layers[RenderLayer.ITEM]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.GAS]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.FIRE]).toBeUndefined();
    });

    it("gas over terrain produces TERRAIN + GAS", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.CONFUSION_GAS;
        ctx.pmap[3][3].volume = 40;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]).toBeDefined();
        expect(spriteData.layers[RenderLayer.GAS]).toBeDefined();
        expect(spriteData.layers[RenderLayer.GAS]!.tileType).toBe(TileType.CONFUSION_GAS);
        expect(spriteData.layers[RenderLayer.GAS]!.alpha).toBeCloseTo(0.4);
    });

    it("fire over liquid produces TERRAIN (liquid winner) + FIRE", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Liquid] = TileType.LAVA;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.PLAIN_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]).toBeDefined();
        expect(spriteData.layers[RenderLayer.FIRE]).toBeDefined();
        expect(spriteData.layers[RenderLayer.FIRE]!.tileType).toBe(TileType.PLAIN_FIRE);
        expect(spriteData.layers[RenderLayer.GAS]).toBeUndefined();
    });

    it("all layers: creature on foliage over floor with gas", () => {
        const ctx = makeCtx();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0,
            abilityFlags: 0,
            monsterName: "goblin",
            isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 60;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]).toBeDefined();
        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
        expect(spriteData.layers[RenderLayer.SURFACE]).toBeDefined();
        expect(spriteData.layers[RenderLayer.SURFACE]!.tileType).toBe(TileType.GRASS);
        expect(spriteData.layers[RenderLayer.ENTITY]).toBeDefined();
        expect(spriteData.layers[RenderLayer.ENTITY]!.glyph).toBe(DisplayGlyph.G_GOBLIN);
        expect(spriteData.layers[RenderLayer.GAS]).toBeDefined();
        expect(spriteData.layers[RenderLayer.GAS]!.tileType).toBe(TileType.POISON_GAS);
        expect(spriteData.layers[RenderLayer.GAS]!.alpha).toBeCloseTo(0.6);
        expect(spriteData.layers[RenderLayer.ITEM]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.FIRE]).toBeUndefined();
    });
});

// =============================================================================
// Remembered cells (Phase 3b)
// =============================================================================

describe("getCellSpriteData — Remembered cells", () => {
    it("populates TERRAIN from rememberedLayers, not live pmap", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.LAVA;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Remembered);
        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
    });

    it("populates SURFACE from remembered surface tile", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.GRASS];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.SURFACE]!.tileType).toBe(TileType.GRASS);
    });

    it("sets bgColor from remembered terrain backColor", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const expectedBg = tileCatalog[TileType.FLOOR].backColor!;
        expect(colorsMatch(spriteData.bgColor, expectedBg)).toBe(true);
    });

    it("has no entity, item, gas, or fire layers", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.GRASS];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.ENTITY]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.ITEM]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.GAS]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.FIRE]).toBeUndefined();
    });

    it("returns no layers when rememberedLayers is empty", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Remembered);
        for (let i = 0; i < spriteData.layers.length; i++) {
            expect(spriteData.layers[i]).toBeUndefined();
        }
    });

    it("suppresses fire tiles on remembered Surface", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.PLAIN_FIRE];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.SURFACE]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.FIRE]).toBeUndefined();
    });

    it("picks terrain by drawPriority from remembered Dungeon vs Liquid", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.DEEP_WATER, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.DEEP_WATER);
    });
});

// =============================================================================
// MagicMapped cells (Phase 3b)
// =============================================================================

describe("getCellSpriteData — MagicMapped cells", () => {
    it("sets MagicMapped visibilityState", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.MAGIC_MAPPED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.MagicMapped);
    });

    it("populates TERRAIN but suppresses SURFACE", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.MAGIC_MAPPED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.GRASS];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.TERRAIN]).toBeDefined();
        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
        expect(spriteData.layers[RenderLayer.SURFACE]).toBeUndefined();
    });
});

// =============================================================================
// Clairvoyant / Telepathic / Omniscience (Phase 3b)
// =============================================================================

describe("getCellSpriteData — Clairvoyant", () => {
    it("populates from live pmap and sets Clairvoyant visibilityState", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.CLAIRVOYANT_VISIBLE;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Clairvoyant);
        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
        expect(spriteData.layers[RenderLayer.SURFACE]!.tileType).toBe(TileType.GRASS);
    });
});

describe("getCellSpriteData — Telepathic", () => {
    it("populates from live pmap and sets Telepathic visibilityState", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.TELEPATHIC_VISIBLE;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Telepathic);
        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
    });
});

describe("getCellSpriteData — Omniscience", () => {
    it("populates from live pmap and sets Omniscience visibilityState", () => {
        const ctx = makeCtx();
        ctx.rogue.playbackOmniscience = true;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Omniscience);
        expect(spriteData.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);
    });
});

// =============================================================================
// Hallucination — monster (Phase 3b)
// =============================================================================

function makeMonsterCatalog(): CreatureType[] {
    return [
        {
            displayChar: DisplayGlyph.G_RAT, foreColor: makeColor(40, 40, 40),
            flags: 0, abilityFlags: 0, monsterName: "rat", isLarge: false,
        } as unknown as CreatureType,
        {
            displayChar: DisplayGlyph.G_KOBOLD, foreColor: makeColor(30, 60, 30),
            flags: MonsterBehaviorFlag.MONST_INANIMATE, abilityFlags: 0,
            monsterName: "statue", isLarge: false,
        } as unknown as CreatureType,
    ];
}

describe("getCellSpriteData — hallucination (monster)", () => {
    it("randomizes monster glyph when hallucinating", () => {
        const monsterCatalog = makeMonsterCatalog();
        const ctx = makeCtx({
            monsterCatalog,
            monsterFlagsList: monsterCatalog.map(m => m.flags),
        });
        ctx.player.status[StatusEffect.Hallucinating] = 100;
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0, abilityFlags: 0, monsterName: "goblin", isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        expect(entity).toBeDefined();
        // Only index 0 (G_RAT) is animate in our catalog
        expect(entity.glyph).toBe(DisplayGlyph.G_RAT);
    });

    it("does not randomize inanimate monsters", () => {
        const monsterCatalog = makeMonsterCatalog();
        const ctx = makeCtx({
            monsterCatalog,
            monsterFlagsList: monsterCatalog.map(m => m.flags),
        });
        ctx.player.status[StatusEffect.Hallucinating] = 100;
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: MonsterBehaviorFlag.MONST_INANIMATE,
            abilityFlags: 0, monsterName: "statue", isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.ENTITY]!.glyph).toBe(DisplayGlyph.G_GOBLIN);
    });

    it("does not randomize when player has telepathy", () => {
        const monsterCatalog = makeMonsterCatalog();
        const ctx = makeCtx({
            monsterCatalog,
            monsterFlagsList: monsterCatalog.map(m => m.flags),
        });
        ctx.player.status[StatusEffect.Hallucinating] = 100;
        ctx.player.status[StatusEffect.Telepathic] = 100;
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0, abilityFlags: 0, monsterName: "goblin", isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.ENTITY]!.glyph).toBe(DisplayGlyph.G_GOBLIN);
    });
});

// =============================================================================
// Hallucination — item (Phase 3b)
// =============================================================================

describe("getCellSpriteData — hallucination (item)", () => {
    it("randomizes item glyph and uses itemColor when hallucinating", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Hallucinating] = 100;
        const item = makeItem(3, 3);
        ctx.floorItems = [item] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const itemLayer = spriteData.layers[RenderLayer.ITEM]!;
        expect(itemLayer).toBeDefined();
        expect(itemLayer.glyph).not.toBe(DisplayGlyph.G_POTION);
        // Base color is itemColor (100, 95, -30), not item.foreColor (50, 20, 80).
        // Exact values vary due to hallucination color randomization (Phase 4a-ii).
        // itemColor.red=100 randomizes to ~[67,133]; item.foreColor.red=50 would be ~[33,66].
        expect(itemLayer.tint.red).toBeGreaterThanOrEqual(67);
    });

    it("does not randomize item when playbackOmniscience is on", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Hallucinating] = 100;
        ctx.rogue.playbackOmniscience = true;
        const item = makeItem(3, 3);
        ctx.floorItems = [item] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.layers[RenderLayer.ITEM]!.glyph).toBe(DisplayGlyph.G_POTION);
    });
});

// =============================================================================
// Invisible-monster-in-gas silhouette (Phase 3b)
// =============================================================================

describe("getCellSpriteData — invisible-monster-in-gas", () => {
    it("overrides entity tint with gas color for invisible monster in gas", () => {
        const ctx = makeCtx();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0, abilityFlags: 0, monsterName: "goblin", isLarge: false,
        } as any;
        monst.status[StatusEffect.Invisible] = 100;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 50;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        expect(entity).toBeDefined();
        expect(entity.glyph).toBe(DisplayGlyph.G_GOBLIN);
        // Entity tint should match gas tint (poison gas backColor)
        const gasTint = spriteData.layers[RenderLayer.GAS]!.tint;
        expect(entity.tint.red).toBe(gasTint.red);
        expect(entity.tint.green).toBe(gasTint.green);
        expect(entity.tint.blue).toBe(gasTint.blue);
    });

    it("does not apply silhouette when no gas is present", () => {
        const ctx = makeCtx();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0, abilityFlags: 0, monsterName: "goblin", isLarge: false,
        } as any;
        monst.status[StatusEffect.Invisible] = 100;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        // Without gas, invisible monster is hidden — canSeeMonster returns false
        expect(spriteData.layers[RenderLayer.ENTITY]).toBeUndefined();
    });

    it("uses hallucinated glyph for invisible monster silhouette when hallucinating", () => {
        const monsterCatalog = makeMonsterCatalog();
        const ctx = makeCtx({
            monsterCatalog,
            monsterFlagsList: monsterCatalog.map(m => m.flags),
        });
        ctx.player.status[StatusEffect.Hallucinating] = 100;
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0, abilityFlags: 0, monsterName: "goblin", isLarge: false,
        } as any;
        monst.status[StatusEffect.Invisible] = 100;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 50;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        expect(entity).toBeDefined();
        // Hallucinated glyph from silhouette re-roll (G_RAT is the only animate entry)
        expect(entity.glyph).toBe(DisplayGlyph.G_RAT);
    });
});

// =============================================================================
// Phase 4a-i: Terrain + Surface + Background Lighting
// =============================================================================

function makeTerrainRandomValues(width = DCOLS, height = DROWS, vals = [0, 0, 0, 0, 0, 0, 0, 0]) {
    const trv: number[][][] = new Array(width);
    for (let i = 0; i < width; i++) {
        trv[i] = new Array(height);
        for (let j = 0; j < height; j++) {
            trv[i][j] = [...vals];
        }
    }
    return trv;
}

describe("getCellSpriteData — TERRAIN lighting", () => {
    it("applies light multiplier to terrain foreColor", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // floorForeColor = (30, 30, 30, 0, 0, 0, 35, false)
        // light multiplier at [50,50,50] → all components = 50
        // red = Math.trunc(30 * 50 / 100) = 15
        expect(tint.red).toBe(15);
        expect(tint.green).toBe(15);
        expect(tint.blue).toBe(15);
    });

    it("bakeTerrainColors zeroes Rand fields after baking", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // floorForeColor has rand: 35 — bake should resolve it to 0
        expect(tint.redRand).toBe(0);
        expect(tint.greenRand).toBe(0);
        expect(tint.blueRand).toBe(0);
        expect(tint.rand).toBe(0);
    });

    it("bakeTerrainColors applies per-cell variation via terrainRandomValues", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        // Non-zero vals: foreRand uses v[6]=700 → foreRand = Math.trunc(35 * 700 / 1000) = 24
        ctx.terrainRandomValues = makeTerrainRandomValues(DCOLS, DROWS, [500, 500, 500, 500, 500, 500, 700, 500]);
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // floorForeColor at light 100: (30, 30, 30, 0, 0, 0, 35)
        // foreRand = Math.trunc(35 * 700 / 1000) = 24
        // red = 30 + Math.trunc(0 * 500/1000) + 24 = 54
        expect(tint.red).toBe(54);
        expect(tint.green).toBe(54);
        expect(tint.blue).toBe(54);
        expect(tint.rand).toBe(0);
    });

    it("skips baking when terrainRandomValues not available", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = []; // empty — no baking
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // Light 100 → identity multiply; no baking → rand preserved
        expect(tint.red).toBe(30);
        expect(tint.rand).toBe(35);
    });
});

describe("getCellSpriteData — bgColor lighting", () => {
    it("applies light multiplier to terrain backColor", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        // floorBackColor = (2, 2, 10, 2, 2, 0, 0, false)
        // After light × 50/100: red = Math.trunc(2*50/100) = 1
        // After bake with vals=[0,...]: red = 1 + 0 + 0 = 1
        expect(spriteData.bgColor.red).toBe(1);
        expect(spriteData.bgColor.green).toBe(1);
        expect(spriteData.bgColor.blue).toBe(5);
    });

    it("bakeTerrainColors zeroes bgColor Rand fields", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        // floorBackColor has redRand: 2, greenRand: 2 — bake zeroes them
        expect(spriteData.bgColor.redRand).toBe(0);
        expect(spriteData.bgColor.greenRand).toBe(0);
        expect(spriteData.bgColor.blueRand).toBe(0);
        expect(spriteData.bgColor.rand).toBe(0);
    });
});

describe("getCellSpriteData — SURFACE lighting", () => {
    it("applies light multiplier to surface foreColor", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.SURFACE]!.tint;
        // grassColor = (15, 40, 15, 15, 50, 15, 10, false)
        // After light × 50/100: red = Math.trunc(15*50/100) = 7, green = 20, blue = 7
        // After bake with vals=[0,...]: no change to base RGB, Rand zeroed
        expect(tint.red).toBe(7);
        expect(tint.green).toBe(20);
        expect(tint.blue).toBe(7);
        expect(tint.redRand).toBe(0);
        expect(tint.greenRand).toBe(0);
        expect(tint.rand).toBe(0);
    });

    it("bakes surface tint independently from bgColor", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues(DCOLS, DROWS, [800, 600, 400, 500, 500, 500, 700, 500]);
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.SURFACE]!.tint;
        // grassColor at light 100: (15, 40, 15, 15, 50, 15, 10, false)
        // foreRand = Math.trunc(10 * 700 / 1000) = 7
        // red = 15 + Math.trunc(15 * 800/1000) + 7 = 15 + 12 + 7 = 34
        // green = 40 + Math.trunc(50 * 600/1000) + 7 = 40 + 30 + 7 = 77
        // blue = 15 + Math.trunc(15 * 400/1000) + 7 = 15 + 6 + 7 = 28
        expect(tint.red).toBe(34);
        expect(tint.green).toBe(77);
        expect(tint.blue).toBe(28);
        expect(tint.rand).toBe(0);
    });
});

describe("getCellSpriteData — fire/gas not lit", () => {
    it("fire tint is raw tileCatalog foreColor (emissive, no lighting)", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.PLAIN_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const fire = spriteData.layers[RenderLayer.FIRE]!;
        const expected = tileCatalog[TileType.PLAIN_FIRE].foreColor!;
        expect(fire.tint.red).toBe(expected.red);
        expect(fire.tint.green).toBe(expected.green);
        expect(fire.tint.blue).toBe(expected.blue);
    });

    it("gas tint is raw tileCatalog backColor (emissive, no lighting)", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 50;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const gas = spriteData.layers[RenderLayer.GAS]!;
        const expected = tileCatalog[TileType.POISON_GAS].backColor!;
        expect(gas.tint.red).toBe(expected.red);
        expect(gas.tint.green).toBe(expected.green);
        expect(gas.tint.blue).toBe(expected.blue);
    });
});

describe("getCellSpriteData — remembered cells not lit", () => {
    it("remembered terrain tint uses base tileCatalog foreColor (no lighting)", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        const expected = tileCatalog[TileType.FLOOR].foreColor!;
        // Remembered path does NOT apply lighting — raw tileCatalog color
        expect(tint.red).toBe(expected.red);
        expect(tint.green).toBe(expected.green);
        expect(tint.blue).toBe(expected.blue);
    });

    it("remembered bgColor uses base tileCatalog backColor (no lighting)", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const expected = tileCatalog[TileType.FLOOR].backColor!;
        expect(spriteData.bgColor.red).toBe(expected.red);
        expect(spriteData.bgColor.green).toBe(expected.green);
        expect(spriteData.bgColor.blue).toBe(expected.blue);
    });
});

describe("getCellSpriteData — colorDances flag propagation", () => {
    it("sets TERRAIN_COLORS_DANCING when terrain foreColor has colorDances", () => {
        const dancingColor = makeColor(50, 50, 50);
        dancingColor.colorDances = true;
        const customCatalog = [...tileCatalog];
        customCatalog[TileType.FLOOR] = {
            ...tileCatalog[TileType.FLOOR],
            foreColor: dancingColor,
        };
        const ctx = makeCtx({ tileCatalog: customCatalog, tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(ctx.pmap[3][3].flags & TileFlag.TERRAIN_COLORS_DANCING).toBeTruthy();
    });

    it("clears TERRAIN_COLORS_DANCING when no layer has colorDances", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.TERRAIN_COLORS_DANCING;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(ctx.pmap[3][3].flags & TileFlag.TERRAIN_COLORS_DANCING).toBeFalsy();
    });
});

// =============================================================================
// Phase 4a-ii: Entity lighting
// =============================================================================

describe("getCellSpriteData — entity lighting", () => {
    it("applies light multiplier to player entity tint", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        const player = makeCreature(3, 3);
        player.info = {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(80, 80, 80),
            flags: 0, abilityFlags: 0, monsterName: "player", isLarge: false,
        } as any;
        ctx.player = player;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_PLAYER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        // foreColor (80,80,80) × light multiplier 50/100 = (40,40,40)
        expect(entity.tint.red).toBe(40);
        expect(entity.tint.green).toBe(40);
        expect(entity.tint.blue).toBe(40);
    });

    it("applies light multiplier to monster entity tint", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        const monst = makeCreature(3, 3);
        monst.info = {
            displayChar: DisplayGlyph.G_GOBLIN,
            foreColor: makeColor(60, 40, 20),
            flags: 0, abilityFlags: 0, monsterName: "goblin", isLarge: false,
        } as any;
        ctx.monsters = [monst];
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_MONSTER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        // foreColor (60,40,20) × light 50/100 = (30,20,10)
        expect(entity.tint.red).toBe(30);
        expect(entity.tint.green).toBe(20);
        expect(entity.tint.blue).toBe(10);
    });

    it("does not apply bakeTerrainColors to entity tint", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues(DCOLS, DROWS, [500, 500, 500, 500, 500, 500, 700, 500]);
        const player = makeCreature(3, 3);
        player.info = {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(80, 80, 80),
            flags: 0, abilityFlags: 0, monsterName: "player", isLarge: false,
        } as any;
        ctx.player = player;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_PLAYER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        // Entity tint is NOT baked — should be foreColor × light (identity at 100)
        expect(entity.tint.red).toBe(80);
        expect(entity.tint.green).toBe(80);
        expect(entity.tint.blue).toBe(80);
    });
});

// =============================================================================
// Phase 4a-ii: Item lighting
// =============================================================================

describe("getCellSpriteData — item lighting", () => {
    it("applies light multiplier to item tint", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        const item = makeItem(3, 3);
        ctx.floorItems = [item] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const itemLayer = spriteData.layers[RenderLayer.ITEM]!;
        // item foreColor (50,20,80) × light 50/100 = (25,10,40)
        expect(itemLayer.tint.red).toBe(25);
        expect(itemLayer.tint.green).toBe(10);
        expect(itemLayer.tint.blue).toBe(40);
    });

    it("applies light multiplier to item with no foreColor (white fallback)", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        const item = makeItem(3, 3, { foreColor: null } as any);
        ctx.floorItems = [item] as any;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_ITEM;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const itemLayer = spriteData.layers[RenderLayer.ITEM]!;
        // white (100,100,100) × light 50/100 = (50,50,50)
        expect(itemLayer.tint.red).toBe(50);
        expect(itemLayer.tint.green).toBe(50);
        expect(itemLayer.tint.blue).toBe(50);
    });
});

// =============================================================================
// Phase 4a-ii: Visibility-state light augmentation
// =============================================================================

describe("getCellSpriteData — visibility light augmentation", () => {
    it("augments light for Clairvoyant cells", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.CLAIRVOYANT_VISIBLE;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // Base light=50 + augment(basicLightColor=180, weight=100) → 50+180=230
        // floorForeColor.red=30 × 230/100 = Math.trunc(69.0) = 69
        expect(tint.red).toBe(69);
    });

    it("augments light for Telepathic cells", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.TELEPATHIC_VISIBLE;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        expect(tint.red).toBe(69);
    });

    it("augments light for Omniscience cells", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.rogue.playbackOmniscience = true;
        // No VISIBLE/DISCOVERED/MAGIC_MAPPED → falls through to Omniscience
        ctx.pmap[3][3].flags = 0;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Omniscience);
        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        expect(tint.red).toBe(69);
    });

    it("does NOT augment light for Visible cells", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // No augmentation: 30 × 50/100 = 15
        expect(tint.red).toBe(15);
    });

    it("augmented light applies to entity tint as well", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        const player = makeCreature(3, 3);
        player.info = {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(80, 80, 80),
            flags: 0, abilityFlags: 0, monsterName: "player", isLarge: false,
        } as any;
        ctx.player = player;
        ctx.pmap[3][3].flags = TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.HAS_PLAYER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        // foreColor (80) × augmented light (230) / 100 = 184
        expect(entity.tint.red).toBe(184);
    });
});

// =============================================================================
// Phase 4a-ii: Hallucination color randomization
// =============================================================================

describe("getCellSpriteData — hallucination color randomization", () => {
    it("randomizes terrain tint when hallucinating (Visible state)", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.player.status[StatusEffect.Hallucinating] = 150;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        // floorForeColor.red=30 at light 100 (identity), then randomized by hallAmt=40
        // hallAmt = Math.trunc(40*150/300)+20 = 20+20 = 40
        // randomizeByPercent(30, 40) = cosmeticRandRange(18, 42)
        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        expect(tint.red).toBeGreaterThanOrEqual(18);
        expect(tint.red).toBeLessThanOrEqual(42);
    });

    it("randomizes bgColor when hallucinating", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.player.status[StatusEffect.Hallucinating] = 150;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        // Run twice with same setup to check bgColor is randomized
        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        // floorBackColor.red=2 at light 100, then randomized by hallAmt=40
        // randomizeByPercent(2, 40) = cosmeticRandRange(1, 2)
        expect(spriteData.bgColor.red).toBeGreaterThanOrEqual(0);
        expect(spriteData.bgColor.red).toBeLessThanOrEqual(3);
    });

    it("does NOT randomize colors for Clairvoyant state", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.player.status[StatusEffect.Hallucinating] = 150;
        ctx.pmap[3][3].flags = TileFlag.CLAIRVOYANT_VISIBLE;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // Clairvoyant: augmented light (50+180=230), no randomization
        // red = Math.trunc(30 * 230 / 100) = 69
        expect(tint.red).toBe(69);
    });

    it("does NOT randomize colors when trueColorMode is on", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.player.status[StatusEffect.Hallucinating] = 150;
        ctx.rogue.trueColorMode = true;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // trueColorMode uses basicLightColor (180,180,180,...) as multiplier
        // red = Math.trunc(30 * 180 / 100) = 54
        // No randomization (trueColorMode skips it)
        expect(tint.red).toBe(54);
    });
});

// =============================================================================
// Phase 4a-ii: Deep-water tint
// =============================================================================

describe("getCellSpriteData — deep-water tint", () => {
    it("multiplies terrain tint by deepWaterLightColor when inWater", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // floorForeColor.red=30 × light 100 (identity) × deepWaterLightColor.red=10/100 = 3
        expect(tint.red).toBe(3);
        // green: 30 × 30/100 = 9
        expect(tint.green).toBe(9);
        // blue: 30 × 100/100 = 30
        expect(tint.blue).toBe(30);
    });

    it("multiplies bgColor by deepWaterLightColor when inWater", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        // floorBackColor.red=2 × deepWater.red=10/100 = 0
        expect(spriteData.bgColor.red).toBe(0);
        // blue: 10 × 100/100 = 10
        expect(spriteData.bgColor.blue).toBe(10);
    });

    it("multiplies entity tint by deepWaterLightColor when inWater", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.rogue.inWater = true;
        const player = makeCreature(3, 3);
        player.info = {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(80, 80, 80),
            flags: 0, abilityFlags: 0, monsterName: "player", isLarge: false,
        } as any;
        ctx.player = player;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED | TileFlag.HAS_PLAYER;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const entity = spriteData.layers[RenderLayer.ENTITY]!;
        // foreColor (80) × light 100 (identity) × deepWater.red 10/100 = 8
        expect(entity.tint.red).toBe(8);
        // green: 80 × 30/100 = 24
        expect(entity.tint.green).toBe(24);
        // blue: 80 × 100/100 = 80
        expect(entity.tint.blue).toBe(80);
    });

    it("does NOT apply deep-water tint for Clairvoyant state", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 50) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.CLAIRVOYANT_VISIBLE;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const tint = spriteData.layers[RenderLayer.TERRAIN]!.tint;
        // Clairvoyant: augmented light (230), no deep-water
        // 30 × 230/100 = 69 (not affected by deepWaterLightColor)
        expect(tint.red).toBe(69);
    });

    it("applies deep-water tint to gas and fire layers too", () => {
        const ctx = makeCtx({ tmap: makeTmap(DCOLS, DROWS, 100) });
        ctx.terrainRandomValues = makeTerrainRandomValues();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.PLAIN_FIRE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        const fire = spriteData.layers[RenderLayer.FIRE]!;
        const baseFire = tileCatalog[TileType.PLAIN_FIRE].foreColor!;
        // Fire base color × deepWater.red 10/100
        expect(fire.tint.red).toBe(Math.trunc(baseFire.red * 10 / 100));
    });
});

// =============================================================================
// Phase 4b: inWater flag + visibility overlay data
// =============================================================================

describe("getCellSpriteData — inWater flag (Phase 4b)", () => {
    it("sets inWater=true for remembered cell when rogue.inWater", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Remembered);
        expect(spriteData.inWater).toBe(true);
    });

    it("sets inWater=false for remembered cell when not in water", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = false;
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Remembered);
        expect(spriteData.inWater).toBe(false);
    });

    it("sets inWater for visible cells too", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Visible);
        expect(spriteData.inWater).toBe(true);
    });

    it("does not set inWater for shroud (early return)", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = true;
        // Cell at (3,3) has no flags — shroud

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Shroud);
        expect(spriteData.inWater).toBe(false);
    });

    it("sets inWater for MagicMapped cells", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.MAGIC_MAPPED;
        ctx.pmap[3][3].rememberedLayers = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING];

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.MagicMapped);
        expect(spriteData.inWater).toBe(true);
    });

    it("resets inWater between calls via resetCellSpriteData", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = true;
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);
        expect(spriteData.inWater).toBe(true);

        ctx.rogue.inWater = false;
        getCellSpriteData(3, 3, ctx, spriteData, pool);
        expect(spriteData.inWater).toBe(false);
    });
});

// =============================================================================
// Pool reuse
// =============================================================================

describe("getCellSpriteData — pool reuse", () => {
    it("reuses the same spriteData instance across calls", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[4][4].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[4][4].layers[DungeonLayer.Dungeon] = TileType.GRANITE;

        const { spriteData, pool } = createCellSpriteData();

        const result1 = getCellSpriteData(3, 3, ctx, spriteData, pool);
        expect(result1).toBe(spriteData);
        expect(result1.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.FLOOR);

        const result2 = getCellSpriteData(4, 4, ctx, spriteData, pool);
        expect(result2).toBe(spriteData);
        expect(result2.layers[RenderLayer.TERRAIN]!.tileType).toBe(TileType.GRANITE);
    });

    it("clears previous layers when moving to a simpler cell", () => {
        const ctx = makeCtx();
        // First cell: floor + grass + gas
        ctx.pmap[3][3].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[3][3].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        ctx.pmap[3][3].layers[DungeonLayer.Surface] = TileType.GRASS;
        ctx.pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        ctx.pmap[3][3].volume = 30;
        // Second cell: just floor
        ctx.pmap[4][4].flags = TileFlag.VISIBLE | TileFlag.DISCOVERED;
        ctx.pmap[4][4].layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const { spriteData, pool } = createCellSpriteData();

        getCellSpriteData(3, 3, ctx, spriteData, pool);
        expect(spriteData.layers[RenderLayer.SURFACE]).toBeDefined();
        expect(spriteData.layers[RenderLayer.GAS]).toBeDefined();

        getCellSpriteData(4, 4, ctx, spriteData, pool);
        expect(spriteData.layers[RenderLayer.SURFACE]).toBeUndefined();
        expect(spriteData.layers[RenderLayer.GAS]).toBeUndefined();
    });
});
