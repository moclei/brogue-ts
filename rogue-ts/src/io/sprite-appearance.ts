/*
 *  io/sprite-appearance.ts — getCellSpriteData for the sprite rendering path
 *  Port V2 — rogue-ts
 *
 *  Parallel to getCellAppearance (io/cell-appearance.ts). Reads pmap,
 *  creatures, items, and visibility to produce per-layer sprite data with
 *  per-layer tint colors for the sprite compositing pipeline.
 *
 *  Phase 3a–3b: handles all visibility states (Visible, Remembered,
 *  Clairvoyant, Telepathic, MagicMapped, Omniscience, Shroud), hallucination,
 *  and invisible-monster-in-gas silhouette.
 *  Phase 4a-i: TERRAIN, SURFACE, and bgColor tints are now properly lit
 *  (colorMultiplierFromDungeonLight × bakeTerrainColors) for live-pmap states.
 *  Remembered/MagicMapped cells still use base tileCatalog colors (no lighting).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature, Item } from "../types/types.js";
import { DungeonLayer, StatusEffect } from "../types/enums.js";
import {
    TileFlag, TerrainFlag, MonsterBehaviorFlag, ANY_KIND_OF_VISIBLE,
} from "../types/flags.js";
import {
    classifyVisibility, lookupCreatureAt, buildMonsterQueryCtx,
    VisibilityState,
} from "./cell-queries.js";
import type { CellQueryContext } from "./cell-queries.js";
import {
    RenderLayer, acquireLayerEntry, resetCellSpriteData,
    isFireTileType, isGasTileType, isSurfaceTileType,
} from "../platform/render-layers.js";
import type { CellSpriteData, LayerEntryPool } from "../platform/render-layers.js";
import {
    canSeeMonster, monsterRevealed, monsterHiddenBySubmersion,
} from "../monsters/monster-queries.js";
import { itemAtLoc } from "../items/item-inventory.js";
import { cellHasTerrainFlag } from "../state/helpers.js";
import { randomAnimateMonster, bakeTerrainColors } from "./display.js";
import { colorMultiplierFromDungeonLight, applyColorMultiplier } from "./color.js";
import { cosmeticRandRange, randClump } from "../math/rng.js";
import {
    getHallucinatedItemCategory, getItemCategoryGlyph,
} from "../items/item-generation.js";
import type { ItemRNG } from "../items/item-generation.js";
import { itemColor, basicLightColor } from "../globals/colors.js";

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

/**
 * Module-level dummy Color for baking a single foreColor via bakeTerrainColors
 * (which requires both fore and back params). All zeros → back-side baking
 * is a no-op, and the fore-side vals[0-2,6] bake the target correctly.
 */
const bakeDummyColor: Color = {
    red: 0, green: 0, blue: 0,
    redRand: 0, greenRand: 0, blueRand: 0,
    rand: 0, colorDances: false,
};

// =============================================================================
// Remembered / MagicMapped path
// =============================================================================

/**
 * Populate CellSpriteData from rememberedLayers for cells the player can no
 * longer see. TERRAIN and SURFACE only (no entity, item, gas, fire). For
 * MagicMapped cells, SURFACE is also suppressed (matching getCellAppearance's
 * limited terrain loop for magic-mapped cells). Uses base tileCatalog colors
 * (no lighting).
 */
function populateRememberedLayers(
    ctx: CellQueryContext,
    cell: { rememberedLayers: readonly number[] },
    spriteData: CellSpriteData,
    pool: LayerEntryPool,
    visState: VisibilityState,
): CellSpriteData {
    const remLayers = cell.rememberedLayers;
    if (!remLayers || remLayers.length === 0) return spriteData;

    let terrainTile = 0;
    let bestDrawPriority = 10000;
    let bgBackColor: Color | undefined;
    let bestBCPriority = 10000;

    for (const layer of [DungeonLayer.Dungeon, DungeonLayer.Liquid]) {
        const t = remLayers[layer];
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
        if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
        spriteData.layers[RenderLayer.TERRAIN] = entry;
    }

    if (bgBackColor) {
        copyColorTo(spriteData.bgColor, bgBackColor);
    }

    if (visState === VisibilityState.Remembered) {
        const surfaceTile = remLayers[DungeonLayer.Surface];
        if (surfaceTile && isSurfaceTileType(surfaceTile)) {
            const entry = acquireLayerEntry(pool, RenderLayer.SURFACE);
            entry.tileType = surfaceTile;
            const te = ctx.tileCatalog[surfaceTile];
            if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
            spriteData.layers[RenderLayer.SURFACE] = entry;
        }
    }

    return spriteData;
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

    // =========================================================================
    // Remembered / MagicMapped: read from rememberedLayers (not live pmap)
    // =========================================================================

    if (visState === VisibilityState.Remembered || visState === VisibilityState.MagicMapped) {
        return populateRememberedLayers(ctx, cell, spriteData, pool, visState);
    }

    // =========================================================================
    // Live pmap: Visible / Clairvoyant / Telepathic / Omniscience
    // =========================================================================

    // Light multiplier for this cell (matching getCellAppearance lines 192-194).
    // Phase 4a-ii will augment this for clairvoyant/telepathic/omniscience.
    const lightMultiplierColor = ctx.rogue.trueColorMode
        ? basicLightColor
        : colorMultiplierFromDungeonLight(x, y, ctx.tmap);

    // ---- TERRAIN layer: winner of Dungeon vs Liquid by drawPriority ----

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
            applyColorMultiplier(entry.tint, lightMultiplierColor);
        }
        spriteData.layers[RenderLayer.TERRAIN] = entry;
    }

    if (bgBackColor) {
        copyColorTo(spriteData.bgColor, bgBackColor);
        applyColorMultiplier(spriteData.bgColor, lightMultiplierColor);
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
            if (te.foreColor) {
                copyColorTo(entry.tint, te.foreColor);
                applyColorMultiplier(entry.tint, lightMultiplierColor);
            }
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
    // ENTITY layer: player or visible monster (hallucination-aware)
    // =========================================================================

    const mqCtx = buildMonsterQueryCtx(ctx.pmap, ctx.player, ctx.rogue.playbackOmniscience);
    const isHallucinating = ctx.player.status[StatusEffect.Hallucinating] > 0
        && !ctx.rogue.playbackOmniscience;
    let monst: Creature | null = null;

    if (cellFlags & TileFlag.HAS_PLAYER) {
        const entry = acquireLayerEntry(pool, RenderLayer.ENTITY);
        entry.glyph = ctx.player.info.displayChar;
        copyColorTo(entry.tint, ctx.player.info.foreColor);
        spriteData.layers[RenderLayer.ENTITY] = entry;
    } else if (cellFlags & TileFlag.HAS_MONSTER) {
        monst = lookupCreatureAt(x, y, cellFlags, ctx.monsters, ctx.dormantMonsters);
        if (monst && canSeeMonster(monst, mqCtx)) {
            const entry = acquireLayerEntry(pool, RenderLayer.ENTITY);
            if (
                isHallucinating
                && !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                && !ctx.player.status[StatusEffect.Telepathic]
            ) {
                const idx = randomAnimateMonster(
                    ctx.monsterFlagsList,
                    MonsterBehaviorFlag.MONST_INANIMATE,
                    MonsterBehaviorFlag.MONST_INVULNERABLE,
                );
                entry.glyph = ctx.monsterCatalog[idx].displayChar;
            } else {
                entry.glyph = monst.info.displayChar;
            }
            copyColorTo(entry.tint, monst.info.foreColor);
            spriteData.layers[RenderLayer.ENTITY] = entry;
        }
    }

    // =========================================================================
    // ITEM layer: floor item when no entity is present (hallucination-aware)
    // =========================================================================

    if (
        !spriteData.layers[RenderLayer.ENTITY]
        && (cellFlags & TileFlag.HAS_ITEM)
        && !cellHasTerrainFlag(ctx.pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_ITEMS)
    ) {
        if (isHallucinating) {
            const rng: ItemRNG = {
                randRange: cosmeticRandRange,
                randPercent: (pct: number) => cosmeticRandRange(0, 99) < pct,
                randClump,
            };
            const entry = acquireLayerEntry(pool, RenderLayer.ITEM);
            entry.glyph = getItemCategoryGlyph(getHallucinatedItemCategory(rng));
            copyColorTo(entry.tint, itemColor);
            spriteData.layers[RenderLayer.ITEM] = entry;
        } else {
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
    }

    // =========================================================================
    // Invisible-monster-in-gas silhouette: entity already populated by
    // canSeeMonster (monsterIsHidden returns false when gas is present).
    // Override the entity tint with the gas layer's color and re-roll the
    // glyph if hallucinating (matching getCellAppearance's second
    // hallucination roll in the gas augment section).
    // =========================================================================

    if (
        spriteData.layers[RenderLayer.ENTITY]
        && spriteData.layers[RenderLayer.GAS]
        && (cellFlags & TileFlag.HAS_MONSTER)
        && monst
        && monst.status[StatusEffect.Invisible]
        && (cellFlags & ANY_KIND_OF_VISIBLE)
        && !monsterRevealed(monst, ctx.player)
        && !monsterHiddenBySubmersion(monst, ctx.player, (p, f) => cellHasTerrainFlag(ctx.pmap, p, f))
    ) {
        const entry = spriteData.layers[RenderLayer.ENTITY]!;
        if (isHallucinating && !ctx.player.status[StatusEffect.Telepathic]) {
            const idx = randomAnimateMonster(
                ctx.monsterFlagsList,
                MonsterBehaviorFlag.MONST_INANIMATE,
                MonsterBehaviorFlag.MONST_INVULNERABLE,
            );
            entry.glyph = ctx.monsterCatalog[idx].displayChar;
        } else {
            entry.glyph = monst.info.displayChar;
        }
        copyColorTo(entry.tint, spriteData.layers[RenderLayer.GAS]!.tint);
    }

    // =========================================================================
    // Bake terrain colors + colorDances flag propagation
    // Resolves random color components (redRand, greenRand, blueRand, rand)
    // using per-cell terrain random values, matching getCellAppearance line 473.
    // Phase 4a-ii will insert hallucination/deep-water tinting before this.
    // =========================================================================

    const terrainVals = ctx.terrainRandomValues[x]?.[y];

    if (terrainVals) {
        if (spriteData.layers[RenderLayer.TERRAIN]) {
            bakeTerrainColors(
                spriteData.layers[RenderLayer.TERRAIN]!.tint,
                spriteData.bgColor,
                terrainVals,
                ctx.rogue.trueColorMode,
            );
        }

        if (spriteData.layers[RenderLayer.SURFACE]) {
            bakeTerrainColors(
                spriteData.layers[RenderLayer.SURFACE]!.tint,
                bakeDummyColor,
                terrainVals,
                ctx.rogue.trueColorMode,
            );
        }
    }

    // colorDances flag propagation (fidelity matrix row 13)
    const dancing =
        (spriteData.layers[RenderLayer.TERRAIN]?.tint.colorDances ?? false)
        || (spriteData.layers[RenderLayer.SURFACE]?.tint.colorDances ?? false)
        || spriteData.bgColor.colorDances;

    if (dancing) {
        cell.flags |= TileFlag.TERRAIN_COLORS_DANCING;
    } else {
        cell.flags &= ~TileFlag.TERRAIN_COLORS_DANCING;
    }

    return spriteData;
}
