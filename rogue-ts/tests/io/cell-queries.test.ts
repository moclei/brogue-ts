/*
 *  io/cell-queries.test.ts — Unit tests for shared cell-query functions
 *  Port V2 — rogue-ts
 */

import { describe, it, expect } from "vitest";
import { TileFlag } from "../../src/types/flags.js";
import { TileType, DisplayGlyph, DungeonLayer, StatusEffect } from "../../src/types/enums.js";
import type { Pcell, Creature, Color } from "../../src/types/types.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import {
    classifyVisibility,
    lookupCreatureAt,
    buildMonsterQueryCtx,
    snapshotCellMemory,
    VisibilityState,
} from "../../src/io/cell-queries.js";

// =============================================================================
// Helpers
// =============================================================================

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

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makeCreature(x: number, y: number, overrides?: Partial<Creature>): Creature {
    return {
        info: {
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(100, 100, 100),
            flags: 0,
            abilityFlags: 0,
            monsterName: "test monster",
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
        ...overrides,
    } as unknown as Creature;
}

// =============================================================================
// classifyVisibility
// =============================================================================

describe("classifyVisibility", () => {
    it("returns Visible when VISIBLE flag is set", () => {
        expect(classifyVisibility(TileFlag.VISIBLE, false)).toBe(VisibilityState.Visible);
    });

    it("VISIBLE takes priority over CLAIRVOYANT_VISIBLE", () => {
        expect(classifyVisibility(TileFlag.VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE, false)).toBe(VisibilityState.Visible);
    });

    it("returns Clairvoyant when only CLAIRVOYANT_VISIBLE is set", () => {
        expect(classifyVisibility(TileFlag.CLAIRVOYANT_VISIBLE, false)).toBe(VisibilityState.Clairvoyant);
    });

    it("CLAIRVOYANT_VISIBLE takes priority over TELEPATHIC_VISIBLE", () => {
        expect(classifyVisibility(TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.TELEPATHIC_VISIBLE, false))
            .toBe(VisibilityState.Clairvoyant);
    });

    it("returns Telepathic when only TELEPATHIC_VISIBLE is set", () => {
        expect(classifyVisibility(TileFlag.TELEPATHIC_VISIBLE, false)).toBe(VisibilityState.Telepathic);
    });

    it("returns MagicMapped when MAGIC_MAPPED but not DISCOVERED", () => {
        expect(classifyVisibility(TileFlag.MAGIC_MAPPED, false)).toBe(VisibilityState.MagicMapped);
    });

    it("returns Remembered for DISCOVERED cell (not visible)", () => {
        expect(classifyVisibility(TileFlag.DISCOVERED, false)).toBe(VisibilityState.Remembered);
    });

    it("returns Remembered for DISCOVERED | MAGIC_MAPPED (not visible)", () => {
        expect(classifyVisibility(TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED, false)).toBe(VisibilityState.Remembered);
    });

    it("returns Visible for DISCOVERED cell during playbackOmniscience", () => {
        expect(classifyVisibility(TileFlag.DISCOVERED, true)).toBe(VisibilityState.Visible);
    });

    it("returns Omniscience for undiscovered cell during playbackOmniscience", () => {
        expect(classifyVisibility(0, true)).toBe(VisibilityState.Omniscience);
    });

    it("returns Shroud for undiscovered cell without omniscience", () => {
        expect(classifyVisibility(0, false)).toBe(VisibilityState.Shroud);
    });

    it("VISIBLE takes priority over DISCOVERED", () => {
        expect(classifyVisibility(TileFlag.VISIBLE | TileFlag.DISCOVERED, false)).toBe(VisibilityState.Visible);
    });

    it("MagicMapped is not affected by playbackOmniscience", () => {
        expect(classifyVisibility(TileFlag.MAGIC_MAPPED, true)).toBe(VisibilityState.MagicMapped);
    });
});

// =============================================================================
// lookupCreatureAt
// =============================================================================

describe("lookupCreatureAt", () => {
    it("returns null when no monster flags are set", () => {
        expect(lookupCreatureAt(5, 5, 0, [], [])).toBeNull();
    });

    it("returns monster from active list when HAS_MONSTER is set", () => {
        const monst = makeCreature(5, 5);
        const result = lookupCreatureAt(5, 5, TileFlag.HAS_MONSTER, [monst], []);
        expect(result).toBe(monst);
    });

    it("returns null when HAS_MONSTER is set but no monster matches location", () => {
        const monst = makeCreature(3, 3);
        const result = lookupCreatureAt(5, 5, TileFlag.HAS_MONSTER, [monst], []);
        expect(result).toBeNull();
    });

    it("returns dormant monster when HAS_DORMANT_MONSTER is set", () => {
        const monst = makeCreature(5, 5);
        const result = lookupCreatureAt(5, 5, TileFlag.HAS_DORMANT_MONSTER, [], [monst]);
        expect(result).toBe(monst);
    });

    it("prefers active monsters over dormant when HAS_MONSTER is set", () => {
        const active = makeCreature(5, 5);
        const dormant = makeCreature(5, 5);
        const result = lookupCreatureAt(5, 5, TileFlag.HAS_MONSTER, [active], [dormant]);
        expect(result).toBe(active);
    });

    it("returns null for dormant when only HAS_MONSTER flag is set and no active match", () => {
        const dormant = makeCreature(5, 5);
        const result = lookupCreatureAt(5, 5, TileFlag.HAS_MONSTER, [], [dormant]);
        expect(result).toBeNull();
    });
});

// =============================================================================
// buildMonsterQueryCtx
// =============================================================================

describe("buildMonsterQueryCtx", () => {
    it("constructs context with correct playbackOmniscience", () => {
        const pmap = makePmap();
        const player = makeCreature(0, 0);
        const ctx = buildMonsterQueryCtx(pmap, player, true);
        expect(ctx.playbackOmniscience).toBe(true);
        expect(ctx.player).toBe(player);
    });

    it("cellHasGas returns true when Gas layer is non-zero", () => {
        const pmap = makePmap();
        pmap[3][3].layers[DungeonLayer.Gas] = TileType.POISON_GAS;
        const player = makeCreature(0, 0);
        const ctx = buildMonsterQueryCtx(pmap, player, false);
        expect(ctx.cellHasGas({ x: 3, y: 3 })).toBe(true);
        expect(ctx.cellHasGas({ x: 1, y: 1 })).toBe(false);
    });

    it("playerCanSee returns true when VISIBLE flag is set", () => {
        const pmap = makePmap();
        pmap[4][4].flags = TileFlag.VISIBLE;
        const player = makeCreature(0, 0);
        const ctx = buildMonsterQueryCtx(pmap, player, false);
        expect(ctx.playerCanSee(4, 4)).toBe(true);
        expect(ctx.playerCanSee(1, 1)).toBe(false);
    });

    it("playerCanDirectlySee returns true when VISIBLE flag is set", () => {
        const pmap = makePmap();
        pmap[4][4].flags = TileFlag.VISIBLE;
        const player = makeCreature(0, 0);
        const ctx = buildMonsterQueryCtx(pmap, player, false);
        expect(ctx.playerCanDirectlySee(4, 4)).toBe(true);
        expect(ctx.playerCanDirectlySee(1, 1)).toBe(false);
    });
});

// =============================================================================
// snapshotCellMemory
// =============================================================================

describe("snapshotCellMemory", () => {
    it("sets STABLE_MEMORY flag", () => {
        const cell = makePcell();
        expect(cell.flags & TileFlag.STABLE_MEMORY).toBe(0);
        snapshotCellMemory(cell, DisplayGlyph.G_FLOOR, makeColor(50, 60, 70), makeColor(10, 20, 30));
        expect(cell.flags & TileFlag.STABLE_MEMORY).not.toBe(0);
    });

    it("stores character in rememberedAppearance", () => {
        const cell = makePcell();
        snapshotCellMemory(cell, DisplayGlyph.G_WALL, makeColor(), makeColor());
        expect(cell.rememberedAppearance.character).toBe(DisplayGlyph.G_WALL);
    });

    it("stores foreColor components", () => {
        const cell = makePcell();
        const fg = makeColor(40, 55, 70);
        snapshotCellMemory(cell, DisplayGlyph.G_FLOOR, fg, makeColor());
        const [r, g, b] = cell.rememberedAppearance.foreColorComponents;
        expect(r).toBeGreaterThan(0);
        expect(g).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(0);
    });

    it("stores backColor components", () => {
        const cell = makePcell();
        const bg = makeColor(10, 20, 30);
        snapshotCellMemory(cell, DisplayGlyph.G_FLOOR, makeColor(), bg);
        const [r, g, b] = cell.rememberedAppearance.backColorComponents;
        expect(r).toBeGreaterThan(0);
        expect(g).toBeGreaterThan(0);
        expect(b).toBeGreaterThan(0);
    });

    it("copies layers into rememberedLayers", () => {
        const cell = makePcell({
            layers: [TileType.FLOOR, TileType.DEEP_WATER, TileType.FOLIAGE, TileType.NOTHING],
        });
        snapshotCellMemory(cell, DisplayGlyph.G_FLOOR, makeColor(), makeColor());
        expect(cell.rememberedLayers).toEqual([TileType.FLOOR, TileType.DEEP_WATER, TileType.FOLIAGE, TileType.NOTHING]);
    });

    it("rememberedLayers is a copy, not a reference", () => {
        const cell = makePcell({
            layers: [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
        });
        snapshotCellMemory(cell, DisplayGlyph.G_FLOOR, makeColor(), makeColor());
        cell.layers[0] = TileType.GRANITE;
        expect(cell.rememberedLayers[0]).toBe(TileType.FLOOR);
    });

    it("preserves existing flags when adding STABLE_MEMORY", () => {
        const cell = makePcell({ flags: TileFlag.DISCOVERED | TileFlag.WAS_VISIBLE });
        snapshotCellMemory(cell, DisplayGlyph.G_FLOOR, makeColor(), makeColor());
        expect(cell.flags & TileFlag.DISCOVERED).not.toBe(0);
        expect(cell.flags & TileFlag.WAS_VISIBLE).not.toBe(0);
        expect(cell.flags & TileFlag.STABLE_MEMORY).not.toBe(0);
    });
});
