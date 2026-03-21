/*
 *  platform/render-layers.test.ts — Unit tests for the layer model
 *  Port V2 — rogue-ts
 */

import { describe, it, expect } from "vitest";
import { TileType } from "../../src/types/enums.js";
import {
    RenderLayer,
    RENDER_LAYER_COUNT,
    VisibilityState,
    isFireTileType,
    isGasTileType,
    isSurfaceTileType,
    isTerrainTileType,
    createCellSpriteData,
    createLayerEntryPool,
    acquireLayerEntry,
    resetCellSpriteData,
    getVisibilityOverlay,
    REMEMBERED_AVERAGE_COLOR,
    REMEMBERED_AVERAGE_WEIGHT,
} from "../../src/platform/render-layers.js";
import {
    memoryColor, clairvoyanceColor, telepathyMultiplier,
    magicMapColor, omniscienceColor, black, memoryOverlay,
} from "../../src/globals/colors.js";

// =============================================================================
// RenderLayer enum
// =============================================================================

describe("RenderLayer", () => {
    it("has 10 values from TERRAIN=0 to UI=9", () => {
        expect(RenderLayer.TERRAIN).toBe(0);
        expect(RenderLayer.SURFACE).toBe(1);
        expect(RenderLayer.ITEM).toBe(2);
        expect(RenderLayer.ENTITY).toBe(3);
        expect(RenderLayer.GAS).toBe(4);
        expect(RenderLayer.FIRE).toBe(5);
        expect(RenderLayer.VISIBILITY).toBe(6);
        expect(RenderLayer.STATUS).toBe(7);
        expect(RenderLayer.BOLT).toBe(8);
        expect(RenderLayer.UI).toBe(9);
    });

    it("RENDER_LAYER_COUNT is 10", () => {
        expect(RENDER_LAYER_COUNT).toBe(10);
    });
});

// =============================================================================
// VisibilityState re-export
// =============================================================================

describe("VisibilityState re-export", () => {
    it("re-exports all values from cell-queries", () => {
        expect(VisibilityState.Visible).toBe(0);
        expect(VisibilityState.Remembered).toBe(1);
        expect(VisibilityState.Clairvoyant).toBe(2);
        expect(VisibilityState.Telepathic).toBe(3);
        expect(VisibilityState.MagicMapped).toBe(4);
        expect(VisibilityState.Omniscience).toBe(5);
        expect(VisibilityState.Shroud).toBe(6);
    });
});

// =============================================================================
// TileType classification — isFireTileType
// =============================================================================

describe("isFireTileType", () => {
    const fireTiles: TileType[] = [
        TileType.PLAIN_FIRE,
        TileType.BRIMSTONE_FIRE,
        TileType.FLAMEDANCER_FIRE,
        TileType.GAS_FIRE,
        TileType.GAS_EXPLOSION,
        TileType.DART_EXPLOSION,
        TileType.ITEM_FIRE,
        TileType.CREATURE_FIRE,
    ];

    it.each(fireTiles)("returns true for fire TileType %i", (t) => {
        expect(isFireTileType(t)).toBe(true);
    });

    it("returns false for gas types", () => {
        expect(isFireTileType(TileType.POISON_GAS)).toBe(false);
        expect(isFireTileType(TileType.STEAM)).toBe(false);
        expect(isFireTileType(TileType.HEALING_CLOUD)).toBe(false);
    });

    it("returns false for surface types", () => {
        expect(isFireTileType(TileType.GRASS)).toBe(false);
        expect(isFireTileType(TileType.FOLIAGE)).toBe(false);
        expect(isFireTileType(TileType.EMBERS)).toBe(false);
    });

    it("returns false for terrain types", () => {
        expect(isFireTileType(TileType.FLOOR)).toBe(false);
        expect(isFireTileType(TileType.WALL)).toBe(false);
        expect(isFireTileType(TileType.DEEP_WATER)).toBe(false);
    });
});

// =============================================================================
// TileType classification — isGasTileType
// =============================================================================

describe("isGasTileType", () => {
    const gasTiles: TileType[] = [
        TileType.POISON_GAS,
        TileType.CONFUSION_GAS,
        TileType.ROT_GAS,
        TileType.STENCH_SMOKE_GAS,
        TileType.PARALYSIS_GAS,
        TileType.METHANE_GAS,
        TileType.STEAM,
        TileType.DARKNESS_CLOUD,
        TileType.HEALING_CLOUD,
    ];

    it.each(gasTiles)("returns true for gas TileType %i", (t) => {
        expect(isGasTileType(t)).toBe(true);
    });

    it("returns false for fire types", () => {
        expect(isGasTileType(TileType.PLAIN_FIRE)).toBe(false);
        expect(isGasTileType(TileType.GAS_FIRE)).toBe(false);
    });

    it("returns false for surface and terrain types", () => {
        expect(isGasTileType(TileType.GRASS)).toBe(false);
        expect(isGasTileType(TileType.FLOOR)).toBe(false);
    });
});

// =============================================================================
// TileType classification — isSurfaceTileType
// =============================================================================

describe("isSurfaceTileType", () => {
    it("returns true for main surface block (GRASS..GUARDIAN_GLOW)", () => {
        expect(isSurfaceTileType(TileType.GRASS)).toBe(true);
        expect(isSurfaceTileType(TileType.DEAD_GRASS)).toBe(true);
        expect(isSurfaceTileType(TileType.GRAY_FUNGUS)).toBe(true);
        expect(isSurfaceTileType(TileType.LUMINESCENT_FUNGUS)).toBe(true);
        expect(isSurfaceTileType(TileType.LICHEN)).toBe(true);
        expect(isSurfaceTileType(TileType.HAY)).toBe(true);
        expect(isSurfaceTileType(TileType.RED_BLOOD)).toBe(true);
        expect(isSurfaceTileType(TileType.ASH)).toBe(true);
        expect(isSurfaceTileType(TileType.EMBERS)).toBe(true);
        expect(isSurfaceTileType(TileType.SPIDERWEB)).toBe(true);
        expect(isSurfaceTileType(TileType.NETTING)).toBe(true);
        expect(isSurfaceTileType(TileType.FOLIAGE)).toBe(true);
        expect(isSurfaceTileType(TileType.DEAD_FOLIAGE)).toBe(true);
        expect(isSurfaceTileType(TileType.FUNGUS_FOREST)).toBe(true);
        expect(isSurfaceTileType(TileType.FORCEFIELD)).toBe(true);
        expect(isSurfaceTileType(TileType.SACRED_GLYPH)).toBe(true);
        expect(isSurfaceTileType(TileType.PORTAL_LIGHT)).toBe(true);
        expect(isSurfaceTileType(TileType.GUARDIAN_GLOW)).toBe(true);
    });

    it("returns true for post-gas surface extras", () => {
        expect(isSurfaceTileType(TileType.BLOODFLOWER_STALK)).toBe(true);
        expect(isSurfaceTileType(TileType.BLOODFLOWER_POD)).toBe(true);
        expect(isSurfaceTileType(TileType.HAVEN_BEDROLL)).toBe(true);
        expect(isSurfaceTileType(TileType.ANCIENT_SPIRIT_VINES)).toBe(true);
        expect(isSurfaceTileType(TileType.ANCIENT_SPIRIT_GRASS)).toBe(true);
    });

    it("returns false for fire types (even though placed on Surface DungeonLayer)", () => {
        expect(isSurfaceTileType(TileType.PLAIN_FIRE)).toBe(false);
        expect(isSurfaceTileType(TileType.CREATURE_FIRE)).toBe(false);
    });

    it("returns false for gas types", () => {
        expect(isSurfaceTileType(TileType.POISON_GAS)).toBe(false);
        expect(isSurfaceTileType(TileType.HEALING_CLOUD)).toBe(false);
    });

    it("returns false for terrain types", () => {
        expect(isSurfaceTileType(TileType.FLOOR)).toBe(false);
        expect(isSurfaceTileType(TileType.WALL)).toBe(false);
        expect(isSurfaceTileType(TileType.DEEP_WATER)).toBe(false);
        expect(isSurfaceTileType(TileType.LAVA)).toBe(false);
    });
});

// =============================================================================
// TileType classification — isTerrainTileType
// =============================================================================

describe("isTerrainTileType", () => {
    it("returns true for dungeon structure tiles", () => {
        expect(isTerrainTileType(TileType.GRANITE)).toBe(true);
        expect(isTerrainTileType(TileType.FLOOR)).toBe(true);
        expect(isTerrainTileType(TileType.WALL)).toBe(true);
        expect(isTerrainTileType(TileType.DOOR)).toBe(true);
        expect(isTerrainTileType(TileType.OPEN_DOOR)).toBe(true);
        expect(isTerrainTileType(TileType.DOWN_STAIRS)).toBe(true);
        expect(isTerrainTileType(TileType.UP_STAIRS)).toBe(true);
        expect(isTerrainTileType(TileType.TORCH_WALL)).toBe(true);
        expect(isTerrainTileType(TileType.CRYSTAL_WALL)).toBe(true);
    });

    it("returns true for liquid tiles", () => {
        expect(isTerrainTileType(TileType.DEEP_WATER)).toBe(true);
        expect(isTerrainTileType(TileType.SHALLOW_WATER)).toBe(true);
        expect(isTerrainTileType(TileType.LAVA)).toBe(true);
        expect(isTerrainTileType(TileType.MUD)).toBe(true);
        expect(isTerrainTileType(TileType.CHASM)).toBe(true);
        expect(isTerrainTileType(TileType.ICE_DEEP)).toBe(true);
    });

    it("returns true for trap tiles (Dungeon layer)", () => {
        expect(isTerrainTileType(TileType.GAS_TRAP_POISON)).toBe(true);
        expect(isTerrainTileType(TileType.TRAP_DOOR)).toBe(true);
        expect(isTerrainTileType(TileType.FLAMETHROWER)).toBe(true);
    });

    it("returns true for machine/altar tiles", () => {
        expect(isTerrainTileType(TileType.ALTAR_INERT)).toBe(true);
        expect(isTerrainTileType(TileType.PEDESTAL)).toBe(true);
        expect(isTerrainTileType(TileType.MACHINE_GLYPH)).toBe(true);
    });

    it("returns true for post-gas terrain tiles", () => {
        expect(isTerrainTileType(TileType.AMULET_SWITCH)).toBe(true);
        expect(isTerrainTileType(TileType.COMMUTATION_ALTAR)).toBe(true);
        expect(isTerrainTileType(TileType.RESURRECTION_ALTAR)).toBe(true);
        expect(isTerrainTileType(TileType.BRAZIER)).toBe(true);
        expect(isTerrainTileType(TileType.MUD_FLOOR)).toBe(true);
        expect(isTerrainTileType(TileType.MUD_WALL)).toBe(true);
    });

    it("returns false for NOTHING", () => {
        expect(isTerrainTileType(TileType.NOTHING)).toBe(false);
    });

    it("returns false for NUMBER_TILETYPES", () => {
        expect(isTerrainTileType(TileType.NUMBER_TILETYPES)).toBe(false);
    });

    it("returns false for surface, fire, and gas types", () => {
        expect(isTerrainTileType(TileType.GRASS)).toBe(false);
        expect(isTerrainTileType(TileType.PLAIN_FIRE)).toBe(false);
        expect(isTerrainTileType(TileType.POISON_GAS)).toBe(false);
    });
});

// =============================================================================
// Exhaustive classification — every TileType classified exactly once
// =============================================================================

describe("exhaustive TileType classification", () => {
    it("every valid TileType is exactly one of: terrain, surface, fire, gas", () => {
        for (let t = TileType.GRANITE; t < TileType.NUMBER_TILETYPES; t++) {
            const categories = [
                isTerrainTileType(t),
                isSurfaceTileType(t),
                isFireTileType(t),
                isGasTileType(t),
            ];
            const count = categories.filter(Boolean).length;
            expect(count).toBe(1);
        }
    });

    it("NOTHING is classified as none of the four", () => {
        expect(isTerrainTileType(TileType.NOTHING)).toBe(false);
        expect(isSurfaceTileType(TileType.NOTHING)).toBe(false);
        expect(isFireTileType(TileType.NOTHING)).toBe(false);
        expect(isGasTileType(TileType.NOTHING)).toBe(false);
    });
});

// =============================================================================
// createCellSpriteData + pool
// =============================================================================

describe("createCellSpriteData", () => {
    it("creates a CellSpriteData with RENDER_LAYER_COUNT undefined layers", () => {
        const { spriteData } = createCellSpriteData();
        expect(spriteData.layers.length).toBe(RENDER_LAYER_COUNT);
        for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
            expect(spriteData.layers[i]).toBeUndefined();
        }
    });

    it("bgColor starts zeroed", () => {
        const { spriteData } = createCellSpriteData();
        expect(spriteData.bgColor.red).toBe(0);
        expect(spriteData.bgColor.green).toBe(0);
        expect(spriteData.bgColor.blue).toBe(0);
    });

    it("visibilityState starts as Visible (0)", () => {
        const { spriteData } = createCellSpriteData();
        expect(spriteData.visibilityState).toBe(0);
    });
});

describe("LayerEntryPool", () => {
    it("pool has RENDER_LAYER_COUNT entries", () => {
        const pool = createLayerEntryPool();
        expect(pool.entries.length).toBe(RENDER_LAYER_COUNT);
    });

    it("acquireLayerEntry returns a reset entry", () => {
        const pool = createLayerEntryPool();
        const entry = acquireLayerEntry(pool, RenderLayer.TERRAIN);
        expect(entry.tileType).toBeUndefined();
        expect(entry.glyph).toBeUndefined();
        expect(entry.tint.red).toBe(0);
        expect(entry.alpha).toBeUndefined();
    });

    it("acquireLayerEntry resets previously-modified entries", () => {
        const pool = createLayerEntryPool();
        const entry = acquireLayerEntry(pool, RenderLayer.ENTITY);
        entry.tint.red = 100;
        entry.tint.green = 50;
        entry.glyph = 42;
        entry.alpha = 0.5;

        const reset = acquireLayerEntry(pool, RenderLayer.ENTITY);
        expect(reset).toBe(entry); // same object
        expect(reset.tint.red).toBe(0);
        expect(reset.tint.green).toBe(0);
        expect(reset.glyph).toBeUndefined();
        expect(reset.alpha).toBeUndefined();
    });
});

describe("resetCellSpriteData", () => {
    it("clears all layers and zeroes bgColor", () => {
        const { spriteData, pool } = createCellSpriteData();
        spriteData.layers[RenderLayer.TERRAIN] = acquireLayerEntry(pool, RenderLayer.TERRAIN);
        spriteData.layers[RenderLayer.ENTITY] = acquireLayerEntry(pool, RenderLayer.ENTITY);
        spriteData.bgColor.red = 50;
        spriteData.visibilityState = 2;

        resetCellSpriteData(spriteData);

        for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
            expect(spriteData.layers[i]).toBeUndefined();
        }
        expect(spriteData.bgColor.red).toBe(0);
        expect(spriteData.visibilityState).toBe(0);
    });

    it("resets inWater to false", () => {
        const { spriteData } = createCellSpriteData();
        spriteData.inWater = true;

        resetCellSpriteData(spriteData);

        expect(spriteData.inWater).toBe(false);
    });
});

// =============================================================================
// Phase 4b: Visibility overlay configuration
// =============================================================================

describe("getVisibilityOverlay", () => {
    it("returns null for Visible", () => {
        expect(getVisibilityOverlay(VisibilityState.Visible, false)).toBeNull();
    });

    it("returns null for Shroud", () => {
        expect(getVisibilityOverlay(VisibilityState.Shroud, false)).toBeNull();
    });

    it("returns memoryColor multiply for Remembered (not in water)", () => {
        const overlay = getVisibilityOverlay(VisibilityState.Remembered, false);
        expect(overlay).not.toBeNull();
        expect(overlay!.composite).toBe("multiply");
        expect(overlay!.color).toBe(memoryColor);
        expect(overlay!.alpha).toBeUndefined();
    });

    it("returns dark fill for Remembered (in water)", () => {
        const overlay = getVisibilityOverlay(VisibilityState.Remembered, true);
        expect(overlay).not.toBeNull();
        expect(overlay!.composite).toBe("source-over");
        expect(overlay!.color).toBe(black);
        expect(overlay!.alpha).toBe(0.8);
    });

    it("returns clairvoyanceColor multiply for Clairvoyant", () => {
        const overlay = getVisibilityOverlay(VisibilityState.Clairvoyant, false);
        expect(overlay).not.toBeNull();
        expect(overlay!.composite).toBe("multiply");
        expect(overlay!.color).toBe(clairvoyanceColor);
    });

    it("returns telepathyMultiplier multiply for Telepathic", () => {
        const overlay = getVisibilityOverlay(VisibilityState.Telepathic, false);
        expect(overlay).not.toBeNull();
        expect(overlay!.composite).toBe("multiply");
        expect(overlay!.color).toBe(telepathyMultiplier);
    });

    it("returns magicMapColor multiply for MagicMapped", () => {
        const overlay = getVisibilityOverlay(VisibilityState.MagicMapped, false);
        expect(overlay).not.toBeNull();
        expect(overlay!.composite).toBe("multiply");
        expect(overlay!.color).toBe(magicMapColor);
    });

    it("returns omniscienceColor multiply for Omniscience", () => {
        const overlay = getVisibilityOverlay(VisibilityState.Omniscience, false);
        expect(overlay).not.toBeNull();
        expect(overlay!.composite).toBe("multiply");
        expect(overlay!.color).toBe(omniscienceColor);
    });

    it("returns pre-allocated objects (no per-call allocation)", () => {
        const a = getVisibilityOverlay(VisibilityState.Clairvoyant, false);
        const b = getVisibilityOverlay(VisibilityState.Clairvoyant, false);
        expect(a).toBe(b);
    });
});

describe("REMEMBERED_AVERAGE constants", () => {
    it("exports memoryOverlay as REMEMBERED_AVERAGE_COLOR", () => {
        expect(REMEMBERED_AVERAGE_COLOR).toBe(memoryOverlay);
    });

    it("exports weight 25 matching getCellAppearance", () => {
        expect(REMEMBERED_AVERAGE_WEIGHT).toBe(25);
    });
});
