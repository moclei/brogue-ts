/*
 *  renderer.ts — Renderer interface and CellRect type
 *  brogue-ts
 *
 *  Defines the contract for rendering a single cell on the grid.
 *  Implemented by TextRenderer (text mode) and SpriteRenderer (tile mode).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { DisplayGlyph, TileType } from "../types/enums.js";

/** Pixel rectangle for a single grid cell, computed by the console. */
export interface CellRect {
  /** Pixel X of cell left edge. */
  x: number;
  /** Pixel Y of cell top edge. */
  y: number;
  /** Pixel width (may vary by column with progressive sizing). */
  width: number;
  /** Pixel height (may vary by row with progressive sizing). */
  height: number;
}

/**
 * Renderer — draws a single cell's content (text glyph or sprite).
 *
 * The console computes the CellRect and converts colors to 0-255 before
 * delegating to the active renderer.
 */
export interface Renderer {
  drawCell(
    cellRect: CellRect,
    glyph: DisplayGlyph,
    fgR: number,
    fgG: number,
    fgB: number,
    bgR: number,
    bgG: number,
    bgB: number,
    tileType?: TileType,
  ): void;
}
