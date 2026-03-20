/*
 *  sprite-renderer.ts — SpriteRenderer: tile-based cell drawing with tinting
 *  brogue-ts
 *
 *  Extracted from the tile path of plotChar() in browser-renderer.ts.
 *  Draws cells as tinted 16×16 sprites from DawnLike tileset sheets.
 *  Falls back to TextRenderer for unmapped glyphs.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { DisplayGlyph, TileType } from "../types/enums.js";
import type { Renderer, CellRect } from "./renderer.js";
import type { SpriteRef } from "./glyph-sprite-map.js";
import { getBackgroundTileType } from "./glyph-sprite-map.js";
import { TILE_SIZE } from "./tileset-loader.js";
import type { TextRenderer } from "./text-renderer.js";

const DEBUG_LAYERED_DRAW = false;
const DEBUG_SHOW_TERRAIN_UNDER_CREATURE = false;
const DEBUG_SKIP_TILE_CELL_BACK_FILL = false;

/**
 * SpriteRenderer — draws cells as tinted sprites from tileset sheets.
 *
 * Implements the Renderer interface. Each `drawCell` call:
 *   1. Resolves the glyph/tileType to a SpriteRef (tileTypeSpriteMap → spriteMap).
 *   2. If no sprite found, delegates to TextRenderer as fallback.
 *   3. Fills cell background.
 *   4. Draws underlyingTerrain layer if present (creature cells).
 *   5. Draws background tile layer if foreground overlay (e.g. foliage on floor).
 *   6. Draws main/foreground sprite with multiply tint.
 */
export class SpriteRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tiles: Map<string, HTMLImageElement>;
  private readonly spriteMap: Map<DisplayGlyph, SpriteRef>;
  private readonly tileTypeSpriteMap: Map<TileType, SpriteRef>;
  private readonly textRenderer: TextRenderer;

  private readonly tintCanvas: HTMLCanvasElement;
  private readonly tintCtx: CanvasRenderingContext2D;

  constructor(
    ctx: CanvasRenderingContext2D,
    tiles: Map<string, HTMLImageElement>,
    spriteMap: Map<DisplayGlyph, SpriteRef>,
    tileTypeSpriteMap: Map<TileType, SpriteRef>,
    textRenderer: TextRenderer,
  ) {
    this.ctx = ctx;
    this.tiles = tiles;
    this.spriteMap = spriteMap;
    this.tileTypeSpriteMap = tileTypeSpriteMap;
    this.textRenderer = textRenderer;

    this.tintCanvas = document.createElement("canvas");
    this.tintCanvas.width = TILE_SIZE;
    this.tintCanvas.height = TILE_SIZE;
    this.tintCtx = this.tintCanvas.getContext("2d")!;
  }

  /**
   * Resolve a glyph/tileType to a sprite reference.
   * Tries tileTypeSpriteMap first (one-to-one terrain), then spriteMap (glyph-based).
   * Returns undefined when neither map has a match (caller falls back to text).
   */
  resolveSprite(
    tileType: TileType | undefined,
    glyph: DisplayGlyph,
  ): SpriteRef | undefined {
    if (tileType !== undefined) {
      const ref = this.tileTypeSpriteMap.get(tileType);
      if (ref !== undefined) return ref;
    }
    return this.spriteMap.get(glyph);
  }

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
    underlyingTerrain?: TileType,
  ): void {
    const ref = this.resolveSprite(tileType, glyph);
    const img = ref ? this.tiles.get(ref.sheetKey) : undefined;

    if (!img || !ref) {
      this.textRenderer.drawCell(cellRect, glyph, fgR, fgG, fgB, bgR, bgG, bgB);
      return;
    }

    const { x, y, width, height } = cellRect;

    if (DEBUG_SKIP_TILE_CELL_BACK_FILL) {
      this.ctx.clearRect(x, y, width, height);
    } else {
      this.ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
      this.ctx.fillRect(x, y, width, height);
    }

    let drewExtraLayer = false;

    if (underlyingTerrain !== undefined) {
      const terrainRef = this.tileTypeSpriteMap.get(underlyingTerrain);
      const terrainImg = terrainRef ? this.tiles.get(terrainRef.sheetKey) : undefined;
      if (terrainImg && terrainRef) {
        this.drawSpriteTinted(terrainImg, terrainRef, cellRect, fgR, fgG, fgB);
        drewExtraLayer = true;
      }
    }

    const backgroundTileType =
      tileType !== undefined ? getBackgroundTileType(tileType) : undefined;
    if (backgroundTileType !== undefined) {
      const bgRef = this.tileTypeSpriteMap.get(backgroundTileType);
      const bgImg = bgRef ? this.tiles.get(bgRef.sheetKey) : undefined;
      if (bgImg && bgRef) {
        this.drawSpriteTinted(bgImg, bgRef, cellRect, fgR, fgG, fgB);
        drewExtraLayer = true;
      }
    }

    if (DEBUG_LAYERED_DRAW && drewExtraLayer) {
      console.debug("[sprite-renderer] two-layer draw", {
        x,
        y,
        tileType,
        underlyingTerrain,
      });
    }

    const creatureAlpha =
      drewExtraLayer && underlyingTerrain !== undefined ? 0.7 : undefined;
    this.drawSpriteTinted(img, ref, cellRect, fgR, fgG, fgB, creatureAlpha);
  }

  /**
   * Draw a single sprite with multiply tint to the cell.
   *
   * 1. Copy the sprite tile to the offscreen tintCanvas.
   * 2. Fill with foreground color using "multiply" composite (tints the sprite).
   * 3. Restore original alpha mask via "destination-in" (clip to sprite's opaque pixels).
   * 4. Blit tinted result to main canvas at cell position.
   */
  private drawSpriteTinted(
    sourceImg: HTMLImageElement,
    spriteRef: SpriteRef,
    cellRect: CellRect,
    fgR: number,
    fgG: number,
    fgB: number,
    alpha?: number,
  ): void {
    const { tintCtx, tintCanvas, ctx } = this;
    const sx = spriteRef.tileX * TILE_SIZE;
    const sy = spriteRef.tileY * TILE_SIZE;

    tintCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
    tintCtx.drawImage(sourceImg, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);

    tintCtx.save();
    tintCtx.globalCompositeOperation = "multiply";
    tintCtx.fillStyle = `rgb(${fgR},${fgG},${fgB})`;
    tintCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    tintCtx.globalCompositeOperation = "destination-in";
    tintCtx.drawImage(sourceImg, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    tintCtx.restore();

    const useAlpha =
      alpha !== undefined &&
      alpha < 1 &&
      DEBUG_LAYERED_DRAW &&
      DEBUG_SHOW_TERRAIN_UNDER_CREATURE;
    if (useAlpha) ctx.globalAlpha = alpha!;

    ctx.drawImage(
      tintCanvas,
      0, 0, TILE_SIZE, TILE_SIZE,
      cellRect.x, cellRect.y, cellRect.width, cellRect.height,
    );

    if (useAlpha) ctx.globalAlpha = 1;
  }
}
