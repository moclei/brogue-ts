/*
 *  io/cell-queries.ts — Shared cell-query functions for rendering paths
 *  Port V2 — rogue-ts
 *
 *  Extracted from getCellAppearance() (io/cell-appearance.ts) so both
 *  the ASCII (getCellAppearance) and sprite (getCellSpriteData) paths
 *  use identical logic for visibility classification, creature lookup,
 *  MonsterQueryContext construction, and memory snapshots.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color, Pos, Pcell, Tcell, Creature, Item, PlayerCharacter,
    FloorTileType, DungeonFeature, CreatureType, ScreenDisplayBuffer,
} from "../types/types.js";
import type { TileType, DisplayGlyph } from "../types/enums.js";
import { DungeonLayer } from "../types/enums.js";
import { TileFlag } from "../types/flags.js";
import { cellHasTerrainFlag } from "../state/helpers.js";
import { storeColorComponents } from "./color.js";
import type { MonsterQueryContext } from "../monsters/monster-queries.js";

// =============================================================================
// VisibilityState
// =============================================================================

/**
 * Mutually exclusive visibility classification for a dungeon cell.
 * Drives both post-processing tinting in getCellAppearance and
 * visibility overlays in getCellSpriteData.
 */
export enum VisibilityState {
    Visible = 0,
    Remembered = 1,
    Clairvoyant = 2,
    Telepathic = 3,
    MagicMapped = 4,
    Omniscience = 5,
    Shroud = 6,
}

// =============================================================================
// CellQueryContext
// =============================================================================

/**
 * Bundles all shared closure captures needed by both getCellAppearance
 * and getCellSpriteData. Both closures take the same context object,
 * making the coupling explicit and compiler-enforced.
 */
export interface CellQueryContext {
    pmap: Pcell[][];
    tmap: readonly (readonly Tcell[])[];
    displayBuffer: ScreenDisplayBuffer;
    rogue: PlayerCharacter;
    player: Creature;
    monsters: readonly Creature[];
    dormantMonsters: readonly Creature[];
    floorItems: readonly Item[];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    monsterCatalog: readonly CreatureType[];
    terrainRandomValues: readonly (readonly (readonly number[])[])[];
    displayDetail: readonly (readonly number[])[];
    scentMap: readonly (readonly number[])[];
    /** Pre-computed `monsterCatalog.map(m => m.flags)` — avoids per-cell allocation during hallucination. */
    monsterFlagsList: readonly number[];
}

// =============================================================================
// classifyVisibility
// =============================================================================

/**
 * Classify the visibility state of a cell based on its tile flags.
 *
 * Checked in priority order matching getCellAppearance's post-processing
 * tinting branches. The detected/revealed entity override is handled
 * separately by the caller — this function returns the cell's intrinsic
 * visibility state from flags alone.
 */
export function classifyVisibility(cellFlags: number, playbackOmniscience: boolean): VisibilityState {
    if (cellFlags & TileFlag.VISIBLE) return VisibilityState.Visible;
    if (cellFlags & TileFlag.CLAIRVOYANT_VISIBLE) return VisibilityState.Clairvoyant;
    if (cellFlags & TileFlag.TELEPATHIC_VISIBLE) return VisibilityState.Telepathic;
    if (!(cellFlags & TileFlag.DISCOVERED) && (cellFlags & TileFlag.MAGIC_MAPPED)) return VisibilityState.MagicMapped;
    if (cellFlags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) {
        // During playback omniscience, discovered cells are treated as fully
        // visible (light multiply, no memory tinting) — matches getCellAppearance's
        // fall-through from the remembered branch to the else/visible branch.
        return playbackOmniscience ? VisibilityState.Visible : VisibilityState.Remembered;
    }
    if (playbackOmniscience) return VisibilityState.Omniscience;
    return VisibilityState.Shroud;
}

// =============================================================================
// lookupCreatureAt
// =============================================================================

/**
 * Find the creature occupying cell (x, y), checking active monsters first
 * then dormant monsters based on cell flags.
 */
export function lookupCreatureAt(
    x: number,
    y: number,
    cellFlags: number,
    monsters: readonly Creature[],
    dormantMonsters: readonly Creature[],
): Creature | null {
    if (cellFlags & TileFlag.HAS_MONSTER) {
        return monsters.find(m => m.loc.x === x && m.loc.y === y) ?? null;
    }
    if (cellFlags & TileFlag.HAS_DORMANT_MONSTER) {
        return dormantMonsters.find(m => m.loc.x === x && m.loc.y === y) ?? null;
    }
    return null;
}

// =============================================================================
// buildMonsterQueryCtx
// =============================================================================

/**
 * Build a MonsterQueryContext from game-state slices. Both getCellAppearance
 * and getCellSpriteData use this to construct identically-configured contexts
 * for creature visibility checks (canSeeMonster, monsterIsHidden, etc.).
 */
export function buildMonsterQueryCtx(
    pmap: Pcell[][],
    player: Creature,
    playbackOmniscience: boolean,
): MonsterQueryContext {
    return {
        player,
        cellHasTerrainFlag: (p: Pos, flags: number) => cellHasTerrainFlag(pmap, p, flags),
        cellHasGas: (p: Pos) => pmap[p.x][p.y].layers[DungeonLayer.Gas] !== 0,
        playerCanSee: (cx: number, cy: number) => !!(pmap[cx][cy].flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (cx: number, cy: number) => !!(pmap[cx][cy].flags & TileFlag.VISIBLE),
        playbackOmniscience,
    };
}

// =============================================================================
// snapshotCellMemory
// =============================================================================

/**
 * Snapshot a cell's current appearance for stable-memory recall.
 * Sets the STABLE_MEMORY flag, stores the character and color components
 * into rememberedAppearance, and copies live terrain layers into
 * rememberedLayers for sprite-mode recall.
 *
 * Called from getCellAppearance at the STABLE_MEMORY transition point
 * (when a cell transitions from visible to remembered). The color
 * components are stored PRE-lighting/baking so that the stored values
 * are lighting-independent.
 */
export function snapshotCellMemory(
    cell: Pcell,
    cellChar: DisplayGlyph,
    cellForeColor: Color,
    cellBackColor: Color,
): void {
    cell.flags |= TileFlag.STABLE_MEMORY;
    cell.rememberedAppearance.character = cellChar;
    const fc = storeColorComponents(cellForeColor);
    cell.rememberedAppearance.foreColorComponents[0] = fc[0];
    cell.rememberedAppearance.foreColorComponents[1] = fc[1];
    cell.rememberedAppearance.foreColorComponents[2] = fc[2];
    const bc = storeColorComponents(cellBackColor);
    cell.rememberedAppearance.backColorComponents[0] = bc[0];
    cell.rememberedAppearance.backColorComponents[1] = bc[1];
    cell.rememberedAppearance.backColorComponents[2] = bc[2];
    cell.rememberedLayers = cell.layers.slice() as TileType[];
}
