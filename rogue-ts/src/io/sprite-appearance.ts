/*
 *  io/sprite-appearance.ts — getCellSpriteData for the sprite rendering path
 *  Port V2 — rogue-ts
 *
 *  Parallel to getCellAppearance (io/cell-appearance.ts). Reads pmap,
 *  creatures, items, and visibility to produce per-layer sprite data with
 *  per-layer tint colors for the sprite compositing pipeline.
 *
 *  Phase 3a: handles Visible and Shroud states. Non-visible states
 *  (Remembered, Clairvoyant, Telepathic, MagicMapped, Omniscience) set
 *  visibilityState but populate no layers — filled in by Phase 3b.
 *  Tint colors are placeholder (base tileCatalog foreColor, no lighting) —
 *  proper lit colors added in Phase 4a.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Item } from "../types/types.js";
import { DungeonLayer } from "../types/enums.js";
import { TileFlag, TerrainFlag } from "../types/flags.js";
import {
    classifyVisibility, lookupCreatureAt, buildMonsterQueryCtx,
    VisibilityState,
} from "./cell-queries.js";
import type { CellQueryContext } from "./cell-queries.js";
import {
    RenderLayer, acquireLayerEntry, resetCellSpriteData,
    isFireTileType, isGasTileType,
} from "../platform/render-layers.js";
import type { CellSpriteData, LayerEntryPool } from "../platform/render-layers.js";
import { canSeeMonster } from "../monsters/monster-queries.js";
import { itemAtLoc } from "../items/item-inventory.js";
import { cellHasTerrainFlag } from "../state/helpers.js";

// =============================================================================
// Color field-by-field copy (avoids allocation)
// =============================================================================

function copyColorTo(dest: Color, src: Color): void {
    dest.red = src.red;
    dest.green = src.green;
    dest.blue = src.blue;
    dest.redRand = src.redRand;
    dest.greenRand = src.greenRand;
    dest.blueRand = src.blueRand;
    dest.rand = src.rand;
    dest.colorDances = src.colorDances;
}

// =============================================================================
// getCellSpriteData
// =============================================================================

/**
 * Compute per-layer sprite data for the dungeon cell at (x, y).
 *
 * Reuses the provided `spriteData` and `pool` objects — the caller must
 * consume the result synchronously before the next cell overwrites it.
 *
 * Returns the same `spriteData` reference for convenience.
 */
export function getCellSpriteData(
    x: number,
    y: number,
    ctx: CellQueryContext,
    spriteData: CellSpriteData,
    pool: LayerEntryPool,
): CellSpriteData {
    resetCellSpriteData(spriteData);

    const cell = ctx.pmap[x][y];
    const cellFlags = cell.flags;
    const visState = classifyVisibility(cellFlags, ctx.rogue.playbackOmniscience);
    spriteData.visibilityState = visState;

    if (visState === VisibilityState.Shroud) {
        return spriteData;
    }

    if (visState !== VisibilityState.Visible) {
        // Phase 3b: non-visible states (Remembered, Clairvoyant, etc.)
        return spriteData;
    }

    // =========================================================================
    // TERRAIN layer: winner of Dungeon vs Liquid by drawPriority
    // =========================================================================

    let terrainTile = 0;  // TileType.NOTHING
    let bestDrawPriority = 10000;
    let bgBackColor: Color | undefined;
    let bestBCPriority = 10000;

    for (const layer of [DungeonLayer.Dungeon, DungeonLayer.Liquid]) {
        const t = cell.layers[layer];
        if (!t) continue;
        const te = ctx.tileCatalog[t];
        if (te.drawPriority < bestDrawPriority) {
            terrainTile = t;
            bestDrawPriority = te.drawPriority;
        }
        if (te.drawPriority < bestBCPriority && te.backColor) {
            bgBackColor = te.backColor;
            bestBCPriority = te.drawPriority;
        }
    }

    if (terrainTile) {
        const entry = acquireLayerEntry(pool, RenderLayer.TERRAIN);
        entry.tileType = terrainTile;
        const te = ctx.tileCatalog[terrainTile];
        if (te.foreColor) {
            copyColorTo(entry.tint, te.foreColor);
        }
        spriteData.layers[RenderLayer.TERRAIN] = entry;
    }

    if (bgBackColor) {
        copyColorTo(spriteData.bgColor, bgBackColor);
    }

    // =========================================================================
    // SURFACE layer — fire TileTypes split to FIRE RenderLayer
    // =========================================================================

    const surfaceTile = cell.layers[DungeonLayer.Surface];
    if (surfaceTile) {
        if (isFireTileType(surfaceTile)) {
            const entry = acquireLayerEntry(pool, RenderLayer.FIRE);
            entry.tileType = surfaceTile;
            const te = ctx.tileCatalog[surfaceTile];
            if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
            spriteData.layers[RenderLayer.FIRE] = entry;
        } else {
            const entry = acquireLayerEntry(pool, RenderLayer.SURFACE);
            entry.tileType = surfaceTile;
            const te = ctx.tileCatalog[surfaceTile];
            if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
            spriteData.layers[RenderLayer.SURFACE] = entry;
        }
    }

    // =========================================================================
    // GAS / FIRE from DungeonLayer.Gas
    // =========================================================================

    const gasTile = cell.layers[DungeonLayer.Gas];
    if (gasTile) {
        if (isFireTileType(gasTile)) {
            const entry = acquireLayerEntry(pool, RenderLayer.FIRE);
            entry.tileType = gasTile;
            const te = ctx.tileCatalog[gasTile];
            if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
            spriteData.layers[RenderLayer.FIRE] = entry;
        } else if (isGasTileType(gasTile)) {
            const entry = acquireLayerEntry(pool, RenderLayer.GAS);
            entry.tileType = gasTile;
            const te = ctx.tileCatalog[gasTile];
            // Gas tiles use backColor (foreColor is undefined for all gas types)
            if (te.backColor) copyColorTo(entry.tint, te.backColor);
            else if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
            entry.alpha = Math.min(1, cell.volume / 100);
            spriteData.layers[RenderLayer.GAS] = entry;
        }
    }

    // =========================================================================
    // ENTITY layer: player or visible monster
    // =========================================================================

    const mqCtx = buildMonsterQueryCtx(ctx.pmap, ctx.player, ctx.rogue.playbackOmniscience);

    if (cellFlags & TileFlag.HAS_PLAYER) {
        const entry = acquireLayerEntry(pool, RenderLayer.ENTITY);
        entry.glyph = ctx.player.info.displayChar;
        copyColorTo(entry.tint, ctx.player.info.foreColor);
        spriteData.layers[RenderLayer.ENTITY] = entry;
    } else if (cellFlags & TileFlag.HAS_MONSTER) {
        const monst = lookupCreatureAt(x, y, cellFlags, ctx.monsters, ctx.dormantMonsters);
        if (monst && canSeeMonster(monst, mqCtx)) {
            const entry = acquireLayerEntry(pool, RenderLayer.ENTITY);
            entry.glyph = monst.info.displayChar;
            copyColorTo(entry.tint, monst.info.foreColor);
            spriteData.layers[RenderLayer.ENTITY] = entry;
        }
    }

    // =========================================================================
    // ITEM layer: floor item when no entity is present
    // =========================================================================

    if (
        !spriteData.layers[RenderLayer.ENTITY]
        && (cellFlags & TileFlag.HAS_ITEM)
        && !cellHasTerrainFlag(ctx.pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_ITEMS)
    ) {
        const item = itemAtLoc({ x, y }, ctx.floorItems as Item[]);
        if (item) {
            const entry = acquireLayerEntry(pool, RenderLayer.ITEM);
            entry.glyph = item.displayChar;
            if (item.foreColor) {
                copyColorTo(entry.tint, item.foreColor);
            } else {
                entry.tint.red = 100;
                entry.tint.green = 100;
                entry.tint.blue = 100;
            }
            spriteData.layers[RenderLayer.ITEM] = entry;
        }
    }

    return spriteData;
}
