/*
 *  io/sprite-appearance.test.ts — Unit tests for getCellSpriteData
 *  Port V2 — rogue-ts
 */

import { describe, it, expect } from "vitest";
import { TileType, DisplayGlyph, DungeonLayer } from "../../src/types/enums.js";
import { TileFlag } from "../../src/types/flags.js";
import type { Pcell, Creature, Color, Item, FloorTileType } from "../../src/types/types.js";
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

function makeTmap(width = DCOLS, height = DROWS) {
    const tmap: { light: number[] }[][] = new Array(width);
    for (let i = 0; i < width; i++) {
        tmap[i] = new Array(height);
        for (let j = 0; j < height; j++) {
            tmap[i][j] = { light: [0, 0, 0] };
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
});

// =============================================================================
// Non-visible states (Phase 3b stubs)
// =============================================================================

describe("getCellSpriteData — non-visible states (Phase 3b stubs)", () => {
    it("sets Remembered visibilityState but no layers", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Remembered);
        for (let i = 0; i < spriteData.layers.length; i++) {
            expect(spriteData.layers[i]).toBeUndefined();
        }
    });

    it("sets Clairvoyant visibilityState but no layers", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.CLAIRVOYANT_VISIBLE;

        const { spriteData, pool } = createCellSpriteData();
        getCellSpriteData(3, 3, ctx, spriteData, pool);

        expect(spriteData.visibilityState).toBe(VisibilityState.Clairvoyant);
        for (let i = 0; i < spriteData.layers.length; i++) {
            expect(spriteData.layers[i]).toBeUndefined();
        }
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
