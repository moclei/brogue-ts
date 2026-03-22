/*
 *  sprite-renderer.ts — SpriteRenderer: tile-based cell drawing with tinting
 *  brogue-ts
 *
 *  Phase 5: layer compositing pipeline via drawCellLayers(). Consumes
 *  CellSpriteData from getCellSpriteData and draws per-layer sprites with
 *  per-layer multiply tinting. Legacy drawCell() kept as transition fallback.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color } from "../types/types.js";
import type { DisplayGlyph, TileType } from "../types/enums.js";
import type { Renderer, CellRect } from "./renderer.js";
import type { SpriteRef } from "./glyph-sprite-map.js";
import { TILE_SIZE } from "./tileset-loader.js";
import type { TextRenderer } from "./text-renderer.js";
import type { CellSpriteData, VisibilityOverlay } from "./render-layers.js";
import { RENDER_LAYER_COUNT, getVisibilityOverlay } from "./render-layers.js";

/** Brogue 0–100 scale → CSS 0–255 RGB, clamped. */
function c100to255(v: number): number {
  return Math.min(255, Math.max(0, Math.round((v * 255) / 100)));
}

const NEUTRAL_TINT_THRESHOLD = 98;

/** True when tint is close enough to neutral that the multiply step is a no-op. */
function isNeutralTint(tint: Readonly<Color>): boolean {
  return tint.red >= NEUTRAL_TINT_THRESHOLD
    && tint.green >= NEUTRAL_TINT_THRESHOLD
    && tint.blue >= NEUTRAL_TINT_THRESHOLD;
}

function bitmapKey(ref: SpriteRef): string {
  return `${ref.sheetKey}:${ref.tileX}:${ref.tileY}`;
}

/**
 * SpriteRenderer — draws cells as tinted sprites from tileset sheets.
 *
 * Implements the Renderer interface via the legacy `drawCell` path.
 * The new `drawCellLayers` path consumes `CellSpriteData` for full
 * layer compositing with per-layer multiply tinting.
 */
export class SpriteRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tiles: Map<string, HTMLImageElement>;
  private readonly spriteMap: Map<DisplayGlyph, SpriteRef>;
  private readonly tileTypeSpriteMap: Map<TileType, SpriteRef>;
  private readonly textRenderer: TextRenderer;

  private readonly tintCanvas: OffscreenCanvas;
  private readonly tintCtx: OffscreenCanvasRenderingContext2D;

  /** Pre-created ImageBitmaps keyed by "sheetKey:tileX:tileY". */
  private readonly bitmaps = new Map<string, ImageBitmap>();

  /** Reusable Color for drawCell → drawSpriteTinted conversion (0-100 scale). */
  private readonly tmpTint: Color = {
    red: 0, green: 0, blue: 0,
    redRand: 0, greenRand: 0, blueRand: 0,
    rand: 0, colorDances: false,
  };

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

    this.tintCanvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    this.tintCtx = this.tintCanvas.getContext("2d")!;
  }

  // ===========================================================================
  // ImageBitmap pre-creation
  // ===========================================================================

  /**
   * Pre-create ImageBitmaps for every mapped sprite, eliminating per-frame
   * sub-region extraction overhead. Async because createImageBitmap returns
   * a Promise. Safe to skip — drawSpriteTinted falls back to HTMLImageElement.
   */
  async precreateBitmaps(): Promise<void> {
    if (typeof createImageBitmap === "undefined") return;

    const seen = new Set<string>();
    const tasks: Promise<void>[] = [];

    const schedule = (ref: SpriteRef) => {
      const key = bitmapKey(ref);
      if (seen.has(key)) return;
      seen.add(key);
      const img = this.tiles.get(ref.sheetKey);
      if (!img) return;
      tasks.push(
        createImageBitmap(
          img,
          ref.tileX * TILE_SIZE, ref.tileY * TILE_SIZE,
          TILE_SIZE, TILE_SIZE,
        ).then(bmp => { this.bitmaps.set(key, bmp); }),
      );
    };

    for (const ref of this.tileTypeSpriteMap.values()) schedule(ref);
    for (const ref of this.spriteMap.values()) schedule(ref);
    await Promise.all(tasks);
  }

  // ===========================================================================
  // resolveSprite
  // ===========================================================================

  /**
   * Resolve a tileType/glyph to a sprite reference.
   * Tries tileTypeSpriteMap first, then spriteMap. Both parameters are
   * optional to support LayerEntry which may set only one.
   */
  resolveSprite(
    tileType?: TileType,
    glyph?: DisplayGlyph,
  ): SpriteRef | undefined {
    if (tileType !== undefined) {
      const ref = this.tileTypeSpriteMap.get(tileType);
      if (ref !== undefined) return ref;
    }
    if (glyph !== undefined) {
      return this.spriteMap.get(glyph);
    }
    return undefined;
  }

  // ===========================================================================
  // drawCell — legacy fallback (pre-layer model)
  // ===========================================================================

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
  ): void {
    const ref = this.resolveSprite(tileType, glyph);
    const img = ref ? this.tiles.get(ref.sheetKey) : undefined;

    if (!img || !ref) {
      this.textRenderer.drawCell(cellRect, glyph, fgR, fgG, fgB, bgR, bgG, bgB);
      return;
    }

    const { x, y, width, height } = cellRect;
    this.ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    this.ctx.fillRect(x, y, width, height);

    const t = this.tmpTint;
    t.red = (fgR * 100) / 255;
    t.green = (fgG * 100) / 255;
    t.blue = (fgB * 100) / 255;

    this.drawSpriteTinted(ref, cellRect, t);
  }

  // ===========================================================================
  // drawCellLayers — layer compositing pipeline
  // ===========================================================================

  /**
   * Draw a cell from CellSpriteData produced by getCellSpriteData.
   *
   * 1. Fill background with spriteData.bgColor.
   * 2. Iterate layers[] by index, skip undefined, resolve + draw each sprite
   *    with per-layer multiply tint. Gas layers use volume-based globalAlpha.
   * 3. Apply visibility overlay (multiply or dark fill) per visibilityState.
   */
  drawCellLayers(cellRect: CellRect, spriteData: CellSpriteData): void {
    const { ctx } = this;
    const { x, y, width, height } = cellRect;

    const bg = spriteData.bgColor;
    ctx.fillStyle = `rgb(${c100to255(bg.red)},${c100to255(bg.green)},${c100to255(bg.blue)})`;
    ctx.fillRect(x, y, width, height);

    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
      const entry = spriteData.layers[i];
      if (!entry) continue;

      const ref = this.resolveSprite(entry.tileType, entry.glyph);
      if (!ref) continue;

      const hasAlpha = entry.alpha !== undefined && entry.alpha < 1;
      if (hasAlpha) ctx.globalAlpha = entry.alpha!;

      this.drawSpriteTinted(ref, cellRect, entry.tint);

      if (hasAlpha) ctx.globalAlpha = 1;
    }

    const overlay = getVisibilityOverlay(
      spriteData.visibilityState, spriteData.inWater,
    );
    if (overlay) this.applyVisibilityOverlay(cellRect, overlay);
  }

  // ===========================================================================
  // applyVisibilityOverlay
  // ===========================================================================

  private applyVisibilityOverlay(
    cellRect: CellRect,
    overlay: VisibilityOverlay,
  ): void {
    const { ctx } = this;
    const { x, y, width, height } = cellRect;

    ctx.save();
    ctx.globalCompositeOperation = overlay.composite;
    if (overlay.alpha !== undefined) ctx.globalAlpha = overlay.alpha;
    const c = overlay.color;
    ctx.fillStyle = `rgb(${c100to255(c.red)},${c100to255(c.green)},${c100to255(c.blue)})`;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  // ===========================================================================
  // drawSpriteTinted — per-layer tinted sprite draw
  // ===========================================================================

  /**
   * Draw a sprite with multiply tint. Tint is on Brogue 0–100 scale.
   *
   * Fast path: when tint components are ≈ 100, skip the offscreen canvas
   * multiply and blit the sprite directly (saves 4 of 5 canvas ops).
   *
   * Full path: copy sprite → multiply fill → destination-in → blit.
   */
  private drawSpriteTinted(
    spriteRef: SpriteRef,
    cellRect: CellRect,
    tint: Readonly<Color>,
  ): void {
    const { ctx } = this;
    const bitmap = this.bitmaps.get(bitmapKey(spriteRef));
    const source: CanvasImageSource | undefined =
      bitmap ?? this.tiles.get(spriteRef.sheetKey);
    if (!source) return;

    const sprSx = bitmap ? 0 : spriteRef.tileX * TILE_SIZE;
    const sprSy = bitmap ? 0 : spriteRef.tileY * TILE_SIZE;

    if (isNeutralTint(tint)) {
      ctx.drawImage(
        source, sprSx, sprSy, TILE_SIZE, TILE_SIZE,
        cellRect.x, cellRect.y, cellRect.width, cellRect.height,
      );
      return;
    }

    const { tintCtx, tintCanvas } = this;

    tintCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
    tintCtx.drawImage(
      source, sprSx, sprSy, TILE_SIZE, TILE_SIZE,
      0, 0, TILE_SIZE, TILE_SIZE,
    );

    tintCtx.save();
    tintCtx.globalCompositeOperation = "multiply";
    tintCtx.fillStyle =
      `rgb(${c100to255(tint.red)},${c100to255(tint.green)},${c100to255(tint.blue)})`;
    tintCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    tintCtx.globalCompositeOperation = "destination-in";
    tintCtx.drawImage(
      source, sprSx, sprSy, TILE_SIZE, TILE_SIZE,
      0, 0, TILE_SIZE, TILE_SIZE,
    );
    tintCtx.restore();

    ctx.drawImage(
      tintCanvas, 0, 0, TILE_SIZE, TILE_SIZE,
      cellRect.x, cellRect.y, cellRect.width, cellRect.height,
    );
  }
}
