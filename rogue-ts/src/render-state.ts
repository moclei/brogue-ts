/*
 *  render-state.ts — Module-level rendering state
 *  Port V2 — rogue-ts
 *
 *  Holds terrainRandomValues and displayDetail, which are used by
 *  getCellAppearance() for per-cell color baking.  Extracted from
 *  lifecycle.ts so io-wiring.ts can build getCellAppearance closures
 *  without importing the full lifecycle module.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { DCOLS, DROWS } from "./types/constants.js";
import { allocGrid } from "./grid/grid.js";
import { cosmeticRandPercent, cosmeticRandRange, clamp } from "./math/rng.js";
import type { Pcell } from "./types/types.js";
import { TileFlag } from "./types/flags.js";

// Per-cell random offsets used by bakeTerrainColors.
// 8 values per cell, pre-rolled at startup — never changes.
export const terrainRandomValues: number[][][] = (() => {
    const t: number[][][] = [];
    for (let i = 0; i < DCOLS; i++) {
        t[i] = [];
        for (let j = 0; j < DROWS; j++) { t[i][j] = new Array(8).fill(0); }
    }
    return t;
})();

// Per-cell lighting detail flags (Dark / Lit / Normal) used by
// the true-color and stealth-range render paths.
export const displayDetail: number[][] = allocGrid();

// =============================================================================
// shuffleTerrainColors — IO.c:966
// =============================================================================

/**
 * Re-roll terrain color offsets for animated tiles (fire, water shimmer, etc.).
 * Called each turn to drive per-cell color variation.
 *
 * C: `shuffleTerrainColors` in IO.c
 */
export function shuffleTerrainColors(percentOfCells: number, resetAll: boolean, pmap?: Pcell[][]): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (resetAll || cosmeticRandPercent(percentOfCells)) {
                // Defect 1 fix: only update cells with dancing terrain colors (IO.c:976).
                // Skip the guard on resetAll (level-init path) since there are no flags yet.
                if (!resetAll && pmap && !(pmap[i][j].flags & TileFlag.TERRAIN_COLORS_DANCING)) {
                    continue;
                }
                // Defect 2 fix: delta update instead of full reset (IO.c:982-983).
                for (let k = 0; k < 8; k++) {
                    terrainRandomValues[i][j][k] = clamp(terrainRandomValues[i][j][k] + cosmeticRandRange(-600, 600), 0, 1000);
                }
            }
        }
    }
}
