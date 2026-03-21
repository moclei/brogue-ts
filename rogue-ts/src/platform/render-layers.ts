/*
 *  platform/render-layers.ts — Layer model for sprite compositing
 *  Port V2 — rogue-ts
 *
 *  Defines the render layer enum, LayerEntry / CellSpriteData interfaces,
 *  object-reuse helpers, and TileType classification functions.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color } from "../types/types.js";
import type { TileType, DisplayGlyph } from "../types/enums.js";
import { TileType as TT } from "../types/enums.js";

export { VisibilityState } from "../io/cell-queries.js";

// =============================================================================
// RenderLayer
// =============================================================================

/**
 * Draw-order index for the sprite compositing pipeline.
 * Layers 0–6 are implemented; 7–9 are placeholders for future initiatives.
 */
export enum RenderLayer {
    TERRAIN    = 0,
    SURFACE    = 1,
    ITEM       = 2,
    ENTITY     = 3,
    GAS        = 4,
    FIRE       = 5,
    VISIBILITY = 6,
    STATUS     = 7,
    BOLT       = 8,
    UI         = 9,
}

export const RENDER_LAYER_COUNT = 10;

// =============================================================================
// LayerEntry
// =============================================================================

/**
 * One layer's sprite data for a single cell. `tileType` and `glyph` are both
 * optional — terrain/surface/gas/fire layers use `tileType`; entity/item
 * layers use `glyph`; both may be set when a TileType sprite map covers the
 * entity (future). The `tint` Color is owned by the pool and overwritten
 * in-place each frame.
 */
export interface LayerEntry {
    tileType?: TileType;
    glyph?: DisplayGlyph;
    tint: Color;
    alpha?: number;
}

// =============================================================================
// CellSpriteData
// =============================================================================

/**
 * Complete sprite data for one dungeon cell. `layers` is a sparse array of
 * length RENDER_LAYER_COUNT indexed by RenderLayer — undefined entries are
 * skipped by the renderer. The single mutable instance is reused across all
 * viewport cells; the caller must consume it synchronously before the next
 * cell overwrites it.
 */
export interface CellSpriteData {
    layers: (LayerEntry | undefined)[];
    bgColor: Color;
    visibilityState: import("../io/cell-queries.js").VisibilityState;
}

// =============================================================================
// Object pool — Color / LayerEntry / CellSpriteData
// =============================================================================

function makeColor(): Color {
    return {
        red: 0, green: 0, blue: 0,
        redRand: 0, greenRand: 0, blueRand: 0,
        rand: 0, colorDances: false,
    };
}

function makeLayerEntry(): LayerEntry {
    return { tileType: undefined, glyph: undefined, tint: makeColor(), alpha: undefined };
}

function resetLayerEntry(e: LayerEntry): void {
    e.tileType = undefined;
    e.glyph = undefined;
    e.tint.red = 0; e.tint.green = 0; e.tint.blue = 0;
    e.tint.redRand = 0; e.tint.greenRand = 0; e.tint.blueRand = 0;
    e.tint.rand = 0; e.tint.colorDances = false;
    e.alpha = undefined;
}

/**
 * Pre-allocated pool of LayerEntry objects. Pool size equals
 * RENDER_LAYER_COUNT so every layer can be filled without allocation.
 */
export interface LayerEntryPool {
    entries: LayerEntry[];
}

export function createLayerEntryPool(): LayerEntryPool {
    const entries: LayerEntry[] = [];
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        entries.push(makeLayerEntry());
    }
    return { entries };
}

/**
 * Acquire a pooled LayerEntry by RenderLayer index. Resets all fields
 * before returning. The caller must populate it before the next cell
 * reclaims the pool.
 */
export function acquireLayerEntry(pool: LayerEntryPool, layer: RenderLayer): LayerEntry {
    const e = pool.entries[layer];
    resetLayerEntry(e);
    return e;
}

/**
 * Create the single mutable CellSpriteData instance reused across all
 * viewport cells. Paired with a LayerEntryPool for zero-allocation
 * per-cell sprite data production.
 */
export function createCellSpriteData(): { spriteData: CellSpriteData; pool: LayerEntryPool } {
    const pool = createLayerEntryPool();
    const layers: (LayerEntry | undefined)[] = new Array(RENDER_LAYER_COUNT).fill(undefined);
    const spriteData: CellSpriteData = {
        layers,
        bgColor: makeColor(),
        visibilityState: 0, // VisibilityState.Visible
    };
    return { spriteData, pool };
}

/**
 * Reset a CellSpriteData for the next cell: clear all layer slots to
 * undefined and zero the bgColor. Does NOT reset individual LayerEntry
 * objects — those are reset on acquire.
 */
export function resetCellSpriteData(data: CellSpriteData): void {
    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        data.layers[i] = undefined;
    }
    const bg = data.bgColor;
    bg.red = 0; bg.green = 0; bg.blue = 0;
    bg.redRand = 0; bg.greenRand = 0; bg.blueRand = 0;
    bg.rand = 0; bg.colorDances = false;
    data.visibilityState = 0;
}

// =============================================================================
// TileType classification
// =============================================================================

/**
 * Fire TileTypes — contiguous range PLAIN_FIRE..CREATURE_FIRE.
 * These appear on DungeonLayer.Surface (via DFs) or DungeonLayer.Gas
 * (when gas ignites). The renderer places them on RenderLayer.FIRE.
 */
export function isFireTileType(t: TileType): boolean {
    return t >= TT.PLAIN_FIRE && t <= TT.CREATURE_FIRE;
}

/**
 * Gas TileTypes — contiguous range POISON_GAS..HEALING_CLOUD.
 * Always on DungeonLayer.Gas. The renderer places them on RenderLayer.GAS
 * with volume-based alpha.
 */
export function isGasTileType(t: TileType): boolean {
    return t >= TT.POISON_GAS && t <= TT.HEALING_CLOUD;
}

/**
 * Surface TileTypes — decorative/debris tiles placed on DungeonLayer.Surface.
 * Main contiguous block GRASS..GUARDIAN_GLOW, plus a few extras placed after
 * the fire/gas block. Excludes fire types (which can also appear on the
 * Surface DungeonLayer but are classified separately).
 */
export function isSurfaceTileType(t: TileType): boolean {
    if (t >= TT.GRASS && t <= TT.GUARDIAN_GLOW) return true;
    switch (t) {
        case TT.BLOODFLOWER_STALK:
        case TT.BLOODFLOWER_POD:
        case TT.HAVEN_BEDROLL:
        case TT.ANCIENT_SPIRIT_VINES:
        case TT.ANCIENT_SPIRIT_GRASS:
            return true;
        default:
            return false;
    }
}

/**
 * Terrain TileTypes — dungeon structure tiles placed on DungeonLayer.Dungeon
 * or DungeonLayer.Liquid. Catch-all: anything that isn't surface, fire, gas,
 * NOTHING, or out of range.
 */
export function isTerrainTileType(t: TileType): boolean {
    if (t <= TT.NOTHING || t >= TT.NUMBER_TILETYPES) return false;
    return !isSurfaceTileType(t) && !isFireTileType(t) && !isGasTileType(t);
}
