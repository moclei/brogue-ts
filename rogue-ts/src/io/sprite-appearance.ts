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
 *  Phase 4a-i: TERRAIN, SURFACE, and bgColor tints are properly lit
 *  (colorMultiplierFromDungeonLight × bakeTerrainColors) for live-pmap states.
 *  Phase 4a-ii: ENTITY and ITEM tints lit via lightMultiplierColor. Visibility-
 *  state augmentation (Clairvoyant/Telepathic/Omniscience). Hallucination color
 *  randomization and deep-water tint applied before baking (Visible state only).
 *  Remembered/MagicMapped cells still use base tileCatalog colors (no lighting).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature, Item } from "../types/types.js";
import { DungeonLayer, StatusEffect, TileType } from "../types/enums.js";
import {
    TileFlag, TerrainFlag, TerrainMechFlag, MonsterBehaviorFlag, ANY_KIND_OF_VISIBLE,
} from "../types/flags.js";
import {
    classifyVisibility, lookupCreatureAt, buildMonsterQueryCtx,
    VisibilityState,
} from "./cell-queries.js";
import type { CellQueryContext } from "./cell-queries.js";
import {
    RenderLayer, acquireLayerEntry, resetCellSpriteData,
    isFireTileType, isGasTileType, isSurfaceTileType, isShallowLiquid,
    isChasmTileType,
} from "../platform/render-layers.js";
import type { CellSpriteData, LayerEntryPool } from "../platform/render-layers.js";
import {
    canSeeMonster, monsterRevealed, monsterHiddenBySubmersion,
} from "../monsters/monster-queries.js";
import { itemAtLoc } from "../items/item-inventory.js";
import { cellHasTerrainFlag } from "../state/helpers.js";
import { randomAnimateMonster, bakeTerrainColors } from "./display.js";
import {
    colorMultiplierFromDungeonLight, applyColorMultiplier,
    randomizeColor, applyColorAugment,
} from "./color.js";
import { cosmeticRandRange, randClump } from "../math/rng.js";
import {
    getHallucinatedItemCategory, getItemCategoryGlyph,
} from "../items/item-generation.js";
import type { ItemRNG } from "../items/item-generation.js";
import { itemColor, basicLightColor, deepWaterLightColor } from "../globals/colors.js";
import {
    getConnectionGroupInfo, computeAdjacencyMask,
} from "../platform/autotile.js";
import { coordinatesAreInMap } from "../globals/tables.js";

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
// Autotile neighbor accessor for remembered/magic-mapped cells
// =============================================================================

/**
 * Return the effective TileType at (nx, ny) on the given DungeonLayer, choosing
 * the data source by the neighbor cell's visibility state: live `layers` for
 * visible neighbors, `rememberedLayers` for remembered/magic-mapped neighbors,
 * `undefined` for shroud/OOB (resolved per `oobConnects` by the caller).
 */
function rememberedNeighborTile(
    ctx: CellQueryContext,
    nx: number,
    ny: number,
    dungeonLayer: DungeonLayer,
): number | undefined {
    if (!coordinatesAreInMap(nx, ny)) return undefined;
    const nCell = ctx.pmap[nx][ny];
    switch (classifyVisibility(nCell.flags, ctx.rogue.playbackOmniscience)) {
        case VisibilityState.Visible:
        case VisibilityState.Clairvoyant:
        case VisibilityState.Telepathic:
        case VisibilityState.Omniscience:
            return nCell.layers[dungeonLayer];
        case VisibilityState.Remembered:
        case VisibilityState.MagicMapped:
            return nCell.rememberedLayers[dungeonLayer];
        default:
            return undefined;
    }
}

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
    x: number,
    y: number,
    ctx: CellQueryContext,
    cell: { rememberedLayers: readonly number[] },
    spriteData: CellSpriteData,
    pool: LayerEntryPool,
    visState: VisibilityState,
): CellSpriteData {
    const remLayers = cell.rememberedLayers;
    if (!remLayers || remLayers.length === 0) return spriteData;

    // Dungeon → TERRAIN
    const dungeonTile = remLayers[DungeonLayer.Dungeon];
    let effectiveDungeonTile = dungeonTile;
    if (dungeonTile) {
        if (!ctx.rogue.playbackOmniscience
            && (ctx.tileCatalog[dungeonTile].mechFlags & TerrainMechFlag.TM_IS_SECRET)) {
            effectiveDungeonTile = TileType.FLOOR;
        }
        const entry = acquireLayerEntry(pool, RenderLayer.TERRAIN);
        entry.tileType = effectiveDungeonTile;
        const te = ctx.tileCatalog[effectiveDungeonTile];
        if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
        spriteData.layers[RenderLayer.TERRAIN] = entry;
        if (te.backColor) copyColorTo(spriteData.bgColor, te.backColor);

        const groupInfo = getConnectionGroupInfo(effectiveDungeonTile);
        if (groupInfo) {
            entry.adjacencyMask = computeAdjacencyMask(
                x, y, groupInfo.members, groupInfo.oobConnects,
                (nx, ny) => rememberedNeighborTile(ctx, nx, ny, groupInfo.dungeonLayer),
            );
        }
    }

    // Liquid → LIQUID or TERRAIN layer (chasm/priority routing)
    const liquidTile = remLayers[DungeonLayer.Liquid];
    if (liquidTile) {
        const lte = ctx.tileCatalog[liquidTile];

        if (isChasmTileType(liquidTile)) {
            const entry = acquireLayerEntry(pool, RenderLayer.TERRAIN);
            entry.tileType = liquidTile;
            if (lte.foreColor) copyColorTo(entry.tint, lte.foreColor);
            spriteData.layers[RenderLayer.TERRAIN] = entry;
            if (lte.backColor) copyColorTo(spriteData.bgColor, lte.backColor);

            const groupInfo = getConnectionGroupInfo(liquidTile);
            if (groupInfo) {
                entry.adjacencyMask = computeAdjacencyMask(
                    x, y, groupInfo.members, groupInfo.oobConnects,
                    (nx, ny) => rememberedNeighborTile(ctx, nx, ny, groupInfo.dungeonLayer),
                );
            }
        } else if (
            effectiveDungeonTile
            && ctx.tileCatalog[effectiveDungeonTile].drawPriority <= lte.drawPriority
        ) {
            // Suppress — dungeon tile is visually dominant
        } else {
            const entry = acquireLayerEntry(pool, RenderLayer.LIQUID);
            entry.tileType = liquidTile;
            if (lte.foreColor) copyColorTo(entry.tint, lte.foreColor);
            entry.alpha = isShallowLiquid(liquidTile) ? 0.55 : 1;
            spriteData.layers[RenderLayer.LIQUID] = entry;
            if (!dungeonTile && lte.backColor) {
                copyColorTo(spriteData.bgColor, lte.backColor);
            }

            const lGroupInfo = getConnectionGroupInfo(liquidTile);
            if (lGroupInfo) {
                entry.adjacencyMask = computeAdjacencyMask(
                    x, y, lGroupInfo.members, lGroupInfo.oobConnects,
                    (nx, ny) => rememberedNeighborTile(ctx, nx, ny, lGroupInfo.dungeonLayer),
                );
            }
        }
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

    spriteData.inWater = ctx.rogue.inWater;

    // =========================================================================
    // Remembered / MagicMapped: read from rememberedLayers (not live pmap)
    // =========================================================================

    if (visState === VisibilityState.Remembered || visState === VisibilityState.MagicMapped) {
        return populateRememberedLayers(x, y, ctx, cell, spriteData, pool, visState);
    }

    // =========================================================================
    // Live pmap: Visible / Clairvoyant / Telepathic / Omniscience
    // =========================================================================

    // Light multiplier for this cell (matching getCellAppearance lines 192-194).
    // Mutable copy: Clairvoyant/Telepathic/Omniscience augment it in place.
    const lightMultiplierColor: Color = ctx.rogue.trueColorMode
        ? { ...basicLightColor }
        : colorMultiplierFromDungeonLight(x, y, ctx.tmap);

    if (visState === VisibilityState.Clairvoyant
        || visState === VisibilityState.Telepathic
        || visState === VisibilityState.Omniscience) {
        applyColorAugment(lightMultiplierColor, basicLightColor, 100);
    }

    // ---- Emit lighting overlay on VISIBILITY layer ----
    // Instead of multiplying lightMultiplierColor into each layer's tint
    // (which mangles pixel art sprites), carry the lighting as a post-sprite
    // overlay drawn with multiply composite. White (100,100,100) = no change,
    // darker values = ambient darkening, colored values = tinted light.
    {
        const visEntry = acquireLayerEntry(pool, RenderLayer.VISIBILITY);
        copyColorTo(visEntry.tint, lightMultiplierColor);
        spriteData.layers[RenderLayer.VISIBILITY] = visEntry;
    }

    // ---- TERRAIN layer (DungeonLayer.Dungeon) ----

    const dungeonTile = cell.layers[DungeonLayer.Dungeon];
    let effectiveDungeonTile = dungeonTile;
    if (dungeonTile) {
        if (!ctx.rogue.playbackOmniscience
            && (ctx.tileCatalog[dungeonTile].mechFlags & TerrainMechFlag.TM_IS_SECRET)) {
            effectiveDungeonTile = TileType.FLOOR;
        }
        const entry = acquireLayerEntry(pool, RenderLayer.TERRAIN);
        entry.tileType = effectiveDungeonTile;
        const te = ctx.tileCatalog[effectiveDungeonTile];
        if (te.foreColor) copyColorTo(entry.tint, te.foreColor);
        spriteData.layers[RenderLayer.TERRAIN] = entry;
        if (te.backColor) copyColorTo(spriteData.bgColor, te.backColor);

        const tGroupInfo = getConnectionGroupInfo(effectiveDungeonTile);
        if (tGroupInfo) {
            entry.adjacencyMask = computeAdjacencyMask(
                x, y, tGroupInfo.members, tGroupInfo.oobConnects,
                (nx, ny) => coordinatesAreInMap(nx, ny)
                    ? ctx.pmap[nx][ny].layers[tGroupInfo.dungeonLayer]
                    : undefined,
            );
        }
    }

    // ---- LIQUID layer ----

    const liquidTile = cell.layers[DungeonLayer.Liquid];
    if (liquidTile) {
        const lte = ctx.tileCatalog[liquidTile];

        if (isChasmTileType(liquidTile)) {
            // Chasms are placed on DungeonLayer.Liquid by lake generation but
            // are visually opaque terrain — route to TERRAIN, overriding the
            // FLOOR that lake placement puts on DungeonLayer.Dungeon.
            const entry = acquireLayerEntry(pool, RenderLayer.TERRAIN);
            entry.tileType = liquidTile;
            if (lte.foreColor) copyColorTo(entry.tint, lte.foreColor);
            spriteData.layers[RenderLayer.TERRAIN] = entry;
            if (lte.backColor) copyColorTo(spriteData.bgColor, lte.backColor);

            const groupInfo = getConnectionGroupInfo(liquidTile);
            if (groupInfo) {
                entry.adjacencyMask = computeAdjacencyMask(
                    x, y, groupInfo.members, groupInfo.oobConnects,
                    (nx, ny) => coordinatesAreInMap(nx, ny)
                        ? ctx.pmap[nx][ny].layers[groupInfo.dungeonLayer]
                        : undefined,
                );
            }
        } else if (
            effectiveDungeonTile
            && ctx.tileCatalog[effectiveDungeonTile].drawPriority <= lte.drawPriority
        ) {
            // Dungeon tile is visually dominant — suppress liquid rendering.
            // Mirrors C's drawPriority winner-takes-all in getCellAppearance:
            // e.g., WALL (priority 0) suppresses SHALLOW_WATER (priority 55).
        } else {
            const entry = acquireLayerEntry(pool, RenderLayer.LIQUID);
            entry.tileType = liquidTile;
            if (lte.foreColor) copyColorTo(entry.tint, lte.foreColor);
            entry.alpha = isShallowLiquid(liquidTile) ? 0.55 : 1;
            spriteData.layers[RenderLayer.LIQUID] = entry;

            const lGroupInfo = getConnectionGroupInfo(liquidTile);
            if (lGroupInfo) {
                entry.adjacencyMask = computeAdjacencyMask(
                    x, y, lGroupInfo.members, lGroupInfo.oobConnects,
                    (nx, ny) => coordinatesAreInMap(nx, ny)
                        ? ctx.pmap[nx][ny].layers[lGroupInfo.dungeonLayer]
                        : undefined,
                );
            }
            if (!dungeonTile && lte.backColor) {
                copyColorTo(spriteData.bgColor, lte.backColor);
            }
        }
    }

    // =========================================================================
    // SURFACE layer — fire TileTypes split to FIRE RenderLayer.
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
    // Hallucination color randomization (Visible state only)
    // Matches getCellAppearance default/Visible branch: randomize each
    // layer's tint by ±hallAmt%. Applied BEFORE baking.
    // =========================================================================

    if (visState === VisibilityState.Visible
        && ctx.player.status[StatusEffect.Hallucinating]
        && !ctx.rogue.trueColorMode) {
        const hallAmt = Math.trunc(
            40 * ctx.player.status[StatusEffect.Hallucinating] / 300,
        ) + 20;
        for (let i = 0; i < spriteData.layers.length; i++) {
            const entry = spriteData.layers[i];
            if (entry) randomizeColor(entry.tint, hallAmt);
        }
        randomizeColor(spriteData.bgColor, hallAmt);
    }

    // =========================================================================
    // Deep-water tint (Visible state only)
    // Matches getCellAppearance default/Visible branch: multiply all tints
    // by deepWaterLightColor when rogue.inWater is true.
    // =========================================================================

    if (visState === VisibilityState.Visible && ctx.rogue.inWater) {
        for (let i = 0; i < spriteData.layers.length; i++) {
            const entry = spriteData.layers[i];
            if (entry) applyColorMultiplier(entry.tint, deepWaterLightColor);
        }
        applyColorMultiplier(spriteData.bgColor, deepWaterLightColor);
    }

    // =========================================================================
    // Bake terrain colors + colorDances flag propagation
    // Resolves random color components (redRand, greenRand, blueRand, rand)
    // using per-cell terrain random values, matching getCellAppearance line 473.
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

        if (spriteData.layers[RenderLayer.LIQUID]) {
            bakeTerrainColors(
                spriteData.layers[RenderLayer.LIQUID]!.tint,
                bakeDummyColor,
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
        || (spriteData.layers[RenderLayer.LIQUID]?.tint.colorDances ?? false)
        || (spriteData.layers[RenderLayer.SURFACE]?.tint.colorDances ?? false)
        || spriteData.bgColor.colorDances;

    if (dancing) {
        cell.flags |= TileFlag.TERRAIN_COLORS_DANCING;
    } else {
        cell.flags &= ~TileFlag.TERRAIN_COLORS_DANCING;
    }

    return spriteData;
}
