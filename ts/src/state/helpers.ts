/*
 *  helpers.ts — Shared game state helper functions
 *  brogue-ts
 *
 *  These helper functions are used across many modules in the C code
 *  (Architect.c, Dijkstra.c, Movement.c, etc.) but depend on the dungeon
 *  map (pmap) and tile catalog. They accept the relevant state slices as
 *  parameters instead of reading C globals.
 *
 *  Ported from: Globals.c (terrainFlags, terrainMechFlags),
 *               Architect.c (cellHasTerrainFlag, cellHasTMFlag, cellHasTerrainType),
 *               Monsters.c (discoveredTerrainFlagsAtLoc)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pcell, FloorTileType, Pos } from "../types/types.js";
import { DungeonLayer } from "../types/enums.js";
import { NUMBER_TERRAIN_LAYERS } from "../types/constants.js";
import { TerrainMechFlag } from "../types/flags.js";
import { tileCatalog } from "../globals/tile-catalog.js";

// =============================================================================
// Terrain flag queries
// =============================================================================

/**
 * Compute the combined terrain flags for a cell by OR-ing the flags
 * from all terrain layers.
 *
 * C equivalent: `terrainFlags(pos)` in Globals.c
 */
export function terrainFlags(pmap: Pcell[][], pos: Pos): number {
    const cell = pmap[pos.x][pos.y];
    return (
        tileCatalog[cell.layers[DungeonLayer.Dungeon]].flags
        | tileCatalog[cell.layers[DungeonLayer.Liquid]].flags
        | tileCatalog[cell.layers[DungeonLayer.Gas]].flags
        | tileCatalog[cell.layers[DungeonLayer.Surface]].flags
    ) >>> 0;
}

/**
 * Compute the combined terrain mechanical flags for a cell.
 *
 * C equivalent: `terrainMechFlags(pos)` in Globals.c
 */
export function terrainMechFlags(pmap: Pcell[][], pos: Pos): number {
    const cell = pmap[pos.x][pos.y];
    return (
        tileCatalog[cell.layers[DungeonLayer.Dungeon]].mechFlags
        | tileCatalog[cell.layers[DungeonLayer.Liquid]].mechFlags
        | tileCatalog[cell.layers[DungeonLayer.Gas]].mechFlags
        | tileCatalog[cell.layers[DungeonLayer.Surface]].mechFlags
    ) >>> 0;
}

/**
 * Check whether the cell at `pos` has any of the specified terrain flags.
 *
 * C equivalent: `cellHasTerrainFlag(loc, flagMask)` in Architect.c
 */
export function cellHasTerrainFlag(pmap: Pcell[][], pos: Pos, flagMask: number): boolean {
    return (terrainFlags(pmap, pos) & flagMask) !== 0;
}

/**
 * Check whether the cell at `pos` has any of the specified terrain mechanical flags.
 *
 * C equivalent: `cellHasTMFlag(loc, flagMask)` in Architect.c
 */
export function cellHasTMFlag(pmap: Pcell[][], pos: Pos, flagMask: number): boolean {
    return (terrainMechFlags(pmap, pos) & flagMask) !== 0;
}

/**
 * Check whether the cell at `pos` has a specific terrain type on any layer.
 *
 * C equivalent: `cellHasTerrainType(p, terrain)` in Architect.c
 */
export function cellHasTerrainType(pmap: Pcell[][], pos: Pos, terrain: number): boolean {
    const cell = pmap[pos.x][pos.y];
    return (
        cell.layers[DungeonLayer.Dungeon] === terrain
        || cell.layers[DungeonLayer.Liquid] === terrain
        || cell.layers[DungeonLayer.Surface] === terrain
        || cell.layers[DungeonLayer.Gas] === terrain
    );
}

/**
 * Returns the terrain flags that would be revealed if secrets at `pos` were
 * discovered. This is used for pathfinding — monsters can navigate through
 * secret doors because they know what's behind them.
 *
 * C equivalent: `discoveredTerrainFlagsAtLoc(pos)` in Monsters.c
 *
 * The full C implementation walks terrain layers and calls `successorTerrainFlags`
 * for secret layers. For the initial Dijkstra port, we provide a simplified
 * interface — callers inject this function based on their own needs.
 *
 * @param catalog - The tile catalog to look up tile properties
 * @param discoverCallback - For each secret layer, returns the terrain flags
 *   that would be revealed. In the full game this calls successorTerrainFlags.
 */
export function discoveredTerrainFlagsAtLoc(
    pmap: Pcell[][],
    pos: Pos,
    catalog: readonly FloorTileType[],
    successorTerrainFlagsFn: (tileType: number) => number,
): number {
    const cell = pmap[pos.x][pos.y];
    let flags = 0;

    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        if (catalog[cell.layers[layer]].mechFlags & TerrainMechFlag.TM_IS_SECRET) {
            flags |= successorTerrainFlagsFn(cell.layers[layer]);
        }
    }

    return flags >>> 0;
}
