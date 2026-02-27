/*
 *  game-state.ts — GameState container interface
 *  brogue-ts
 *
 *  Replaces the C global mutable state (rogue, player, pmap, tmap, etc.)
 *  with an explicit state container. Functions that need game state accept
 *  it (or a slice of it) as a parameter instead of reading globals.
 *
 *  This file defines the interfaces — construction/initialization will be
 *  handled by the game loop (Phase 3/4).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Tcell, PlayerCharacter, LevelData, Item } from "../types/types.js";
import type { Grid } from "../grid/grid.js";

// =============================================================================
// Map state — the dungeon grid and derived maps
// =============================================================================

/**
 * Dungeon map state: terrain layers, visibility, lighting, and derived maps.
 * Corresponds to C's `pmap`, `tmap`, and the various static distance/safety maps.
 */
export interface MapState {
    /** Permanent cell data: terrain layers, flags, volume. DCOLS×DROWS column-major. */
    pmap: Pcell[][];

    /** Transient cell data: lighting. DCOLS×DROWS column-major. */
    tmap: Tcell[][];

    /** Scent tracking grid. */
    scentMap: Grid;

    /** Safety map — used by monsters to flee toward safe areas. */
    safetyMap: Grid;

    /** Ally safety map — used by allied creatures. */
    allySafetyMap: Grid;

    /** Chokepoint map. */
    chokeMap: Grid;
}

// =============================================================================
// Entity state — creatures and items
// =============================================================================

/**
 * All creature and item data for the current level.
 */
export interface EntityState {
    /** The player creature. */
    player: Creature;

    /** Active monsters on the current level. */
    monsters: Creature[];

    /** Dormant monsters (hidden, not yet activated). */
    dormantMonsters: Creature[];

    /** Items on the dungeon floor. */
    floorItems: Item[];

    /** Items in the player's inventory. */
    packItems: Item[];
}

// =============================================================================
// Full game state
// =============================================================================

/**
 * Complete game state container, replacing C's global variables.
 *
 * Functions that need game state accept this (or a sub-interface) as a
 * parameter. This enables:
 * - Unit testing with mock state
 * - Multiple game instances
 * - Clear, traceable data flow
 */
export interface GameState {
    /** Dungeon map grids and derived maps. */
    map: MapState;

    /** Creatures and items. */
    entities: EntityState;

    /** Global game state (the C `rogue` struct). */
    rogue: PlayerCharacter;

    /** Stored level data for revisiting. */
    levels: LevelData[];

    /** Current dungeon depth. */
    depth: number;
}
