/*
 *  cell-renderer.ts — Bridge getCellSpriteData → SpriteRenderer.drawCellLayers
 *  dungeon-cake
 *
 *  Iterates all 79×29 dungeon cells, computes per-cell sprite data via
 *  getCellSpriteData, and draws each cell using the SpriteRenderer's
 *  layer compositing pipeline.
 */

import type { CellQueryContext } from "@game/io/cell-queries.js";
import { getCellSpriteData } from "@game/io/sprite-appearance.js";
import { createCellSpriteData } from "@game/platform/render-layers.js";
import type { SpriteRenderer } from "@game/platform/sprite-renderer.js";
import type { CellRect } from "@game/platform/renderer.js";
import { DCOLS, DROWS } from "@game/types/constants.js";
import { TILE_SIZE } from "@game/platform/tileset-loader.js";

/**
 * Render the full dungeon grid with sprites.
 *
 * @param ctx         Canvas 2D context (for clearing)
 * @param renderer    SpriteRenderer with loaded tilesets
 * @param queryCtx    CellQueryContext from query-context.ts
 * @param zoom        Integer zoom factor (1–4)
 */
export function renderDungeon(
    ctx: CanvasRenderingContext2D,
    renderer: SpriteRenderer,
    queryCtx: CellQueryContext,
    zoom: number,
): void {
    const cellSize = TILE_SIZE * zoom;
    const canvasW = DCOLS * cellSize;
    const canvasH = DROWS * cellSize;

    ctx.clearRect(0, 0, canvasW, canvasH);

    const { spriteData, pool } = createCellSpriteData();
    const cellRect: CellRect = { x: 0, y: 0, width: cellSize, height: cellSize };

    for (let x = 0; x < DCOLS; x++) {
        for (let y = 0; y < DROWS; y++) {
            cellRect.x = x * cellSize;
            cellRect.y = y * cellSize;

            getCellSpriteData(x, y, queryCtx, spriteData, pool);
            renderer.drawCellLayers(cellRect, spriteData);
        }
    }
}
