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
