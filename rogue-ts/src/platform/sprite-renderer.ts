/*
 *  sprite-renderer.ts — SpriteRenderer: tile-based cell drawing with tinting
 *  brogue-ts
 *
 *  Layer compositing pipeline via drawCellLayers(). Consumes CellSpriteData
 *  from getCellSpriteData and draws per-layer sprites with configurable
 *  blend modes and tint strength via LAYER_DEFAULTS. The F2 debug panel
 *  overrides these defaults at runtime. VISIBILITY layer is handled
 *  separately as a composite fill (not a sprite draw).
 *  Legacy drawCell() kept as transition fallback.
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
import {
  RenderLayer,
  RENDER_LAYER_COUNT,
  getVisibilityOverlay,
} from "./render-layers.js";
import { spriteDebug } from "./sprite-debug.js";
import type { BlendMode } from "./sprite-debug.js";
import { BITMASK_TO_VARIANT, getConnectionGroupInfo } from "./autotile.js";

/** Brogue 0–100 scale → CSS 0–255 RGB, clamped. */
function c100to255(v: number): number {
  return Math.min(255, Math.max(0, Math.round((v * 255) / 100)));
}

const NEUTRAL_TINT_THRESHOLD = 98;

/** Default cell background for sprite mode — dark near-black instead of game lighting. */
const SPRITE_BG_COLOR = "rgb(10,10,18)";

// ===========================================================================
// Per-layer rendering defaults
// ===========================================================================

/**
 * Permanent per-layer blend and tint settings. Edit this table to change
 * how layers are rendered. The F2 debug panel overrides these at runtime.
 *
 * - `blendMode: "none"` — draw the sprite with no tinting (fast path)
 * - `blendMode: "multiply"` — standard multiply tint from game lighting
 * - Other blend modes: "screen", "overlay", "color-dodge", "color-burn"
 * - `tintAlpha` — 0.0–1.0, strength of the blend fill (1.0 = full)
 */
interface LayerConfig {
  blendMode: BlendMode;
  tintAlpha: number;
}

const LAYER_DEFAULTS: readonly LayerConfig[] = [
  /* TERRAIN    */ { blendMode: "multiply", tintAlpha: 0.8 },
  /* LIQUID     */ { blendMode: "multiply", tintAlpha: 1.0 },
  /* SURFACE    */ { blendMode: "multiply", tintAlpha: 0.2 },
  /* ITEM       */ { blendMode: "none", tintAlpha: 1.0 },
  /* ENTITY     */ { blendMode: "none", tintAlpha: 1.0 },
  /* GAS        */ { blendMode: "none", tintAlpha: 1.0 },
  /* FIRE       */ { blendMode: "none", tintAlpha: 1.0 },
  /* VISIBILITY */ { blendMode: "multiply", tintAlpha: 1.0 },
  /* STATUS     */ { blendMode: "none", tintAlpha: 1.0 },
  /* BOLT       */ { blendMode: "none", tintAlpha: 1.0 },
  /* UI         */ { blendMode: "none", tintAlpha: 1.0 },
];

/** Config for the legacy drawCell path (no layer model). */
const LEGACY_LAYER_CONFIG: LayerConfig = {
  blendMode: "multiply",
  tintAlpha: 1.0,
};

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
  private tiles: Map<string, HTMLImageElement>;
  private spriteMap: Map<DisplayGlyph, SpriteRef>;
  private tileTypeSpriteMap: Map<TileType, SpriteRef>;
  private readonly textRenderer: TextRenderer;
  private autotileVariantMap?: Map<TileType, SpriteRef[]>;

  private readonly tintCanvas: OffscreenCanvas;
  private readonly tintCtx: OffscreenCanvasRenderingContext2D;

  /** Pre-created ImageBitmaps keyed by "sheetKey:tileX:tileY". */
  private readonly bitmaps = new Map<string, ImageBitmap>();

  /** Reusable Color for drawCell → drawSpriteTinted conversion (0-100 scale). */
  private readonly tmpTint: Color = {
    red: 0,
    green: 0,
    blue: 0,
    redRand: 0,
    greenRand: 0,
    blueRand: 0,
    rand: 0,
    colorDances: false,
  };

  constructor(
    ctx: CanvasRenderingContext2D,
    tiles: Map<string, HTMLImageElement>,
    spriteMap: Map<DisplayGlyph, SpriteRef>,
    tileTypeSpriteMap: Map<TileType, SpriteRef>,
    textRenderer: TextRenderer,
    autotileVariantMap?: Map<TileType, SpriteRef[]>,
  ) {
    this.ctx = ctx;
    this.tiles = tiles;
    this.spriteMap = spriteMap;
    this.tileTypeSpriteMap = tileTypeSpriteMap;
    this.textRenderer = textRenderer;
    this.autotileVariantMap = autotileVariantMap;

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
          ref.tileX * TILE_SIZE,
          ref.tileY * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        ).then((bmp) => {
          this.bitmaps.set(key, bmp);
        }),
      );
    };

    for (const ref of this.tileTypeSpriteMap.values()) schedule(ref);
    for (const ref of this.spriteMap.values()) schedule(ref);
    if (this.autotileVariantMap) {
      for (const variants of this.autotileVariantMap.values()) {
        for (const ref of variants) schedule(ref);
      }
    }
    await Promise.all(tasks);
  }

  /**
   * Hot-reload tileset data: swap tile images + sprite maps, clear old
   * ImageBitmaps, and rebuild the bitmap cache. Called by the HMR handler
   * in bootstrap.ts when the sprite assigner writes new assets to disk.
   */
  async reloadTiles(
    tiles: Map<string, HTMLImageElement>,
    spriteMap: Map<DisplayGlyph, SpriteRef>,
    tileTypeSpriteMap: Map<TileType, SpriteRef>,
    autotileVariantMap?: Map<TileType, SpriteRef[]>,
  ): Promise<void> {
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();

    this.tiles = tiles;
    this.spriteMap = spriteMap;
    this.tileTypeSpriteMap = tileTypeSpriteMap;
    this.autotileVariantMap = autotileVariantMap;

    await this.precreateBitmaps();
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

    this.drawSpriteTinted(ref, cellRect, t, LEGACY_LAYER_CONFIG);
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

    const dbg = spriteDebug.enabled ? spriteDebug : null;
    const bgOver = dbg?.bgColorOverride;
    if (bgOver) {
      ctx.fillStyle = `rgb(${bgOver.r},${bgOver.g},${bgOver.b})`;
    } else {
      ctx.fillStyle = SPRITE_BG_COLOR;
    }
    ctx.fillRect(x, y, width, height);
    const isInspectTarget =
      dbg?.inspectTarget &&
      dbg._renderingX === dbg.inspectTarget.x &&
      dbg._renderingY === dbg.inspectTarget.y;

    for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
      if (dbg && !dbg.layers[i].visible) continue;

      const entry = spriteData.layers[i];
      if (!entry) {
        if (isInspectTarget) dbg!.inspectedLayers[i] = null;
        continue;
      }

      if (isInspectTarget) {
        const inspected: import("./sprite-debug.js").InspectedLayerData = {
          tintR: entry.tint.red,
          tintG: entry.tint.green,
          tintB: entry.tint.blue,
          alpha: entry.alpha,
        };
        if (entry.adjacencyMask !== undefined) {
          inspected.adjacencyMask = entry.adjacencyMask;
          inspected.variantIndex = BITMASK_TO_VARIANT[entry.adjacencyMask];
          if (entry.tileType !== undefined) {
            inspected.connectionGroup = getConnectionGroupInfo(
              entry.tileType,
            )?.group;
          }
        }
        dbg!.inspectedLayers[i] = inspected;
      }

      // VISIBILITY layer: lighting overlay drawn as multiply composite fill,
      // not as a sprite. The tint carries lightMultiplierColor from
      // getCellSpriteData; white (100,100,100) = no darkening.
      if (i === RenderLayer.VISIBILITY) {
        this.applyLightingOverlay(cellRect, entry.tint, dbg?.layers[i] ?? null);
        continue;
      }

      let ref: SpriteRef | undefined;
      if (
        entry.adjacencyMask !== undefined &&
        entry.tileType !== undefined &&
        this.autotileVariantMap
      ) {
        const variantIndex = BITMASK_TO_VARIANT[entry.adjacencyMask];
        ref = this.autotileVariantMap.get(entry.tileType)?.[variantIndex];
      }
      if (!ref) ref = this.resolveSprite(entry.tileType, entry.glyph);
      if (!ref) continue;

      const lo = dbg?.layers[i] ?? null;
      const effectiveAlpha = lo?.alphaOverride ?? entry.alpha;
      const hasAlpha =
        effectiveAlpha !== undefined &&
        effectiveAlpha !== null &&
        effectiveAlpha < 1;
      if (hasAlpha) ctx.globalAlpha = effectiveAlpha;

      this.drawSpriteTinted(ref, cellRect, entry.tint, LAYER_DEFAULTS[i], lo);

      if (hasAlpha) ctx.globalAlpha = 1;
    }

    if (isInspectTarget && dbg!.onInspect) dbg!.onInspect();

    const skipOverlay = dbg && !dbg.visibilityOverlayEnabled;
    const overlay = skipOverlay
      ? null
      : getVisibilityOverlay(spriteData.visibilityState, spriteData.inWater);
    if (overlay) this.applyVisibilityOverlay(cellRect, overlay);

    if (dbg?.showVariantIndices) {
      for (let i = 0; i < RENDER_LAYER_COUNT; i++) {
        const entry = spriteData.layers[i];
        if (entry?.adjacencyMask !== undefined) {
          this.drawVariantLabel(
            cellRect,
            BITMASK_TO_VARIANT[entry.adjacencyMask],
          );
          break;
        }
      }
    }
  }

  // ===========================================================================
  // applyLightingOverlay — per-cell multiply fill from lightMultiplierColor
  // ===========================================================================

  private applyLightingOverlay(
    cellRect: CellRect,
    tint: Readonly<Color>,
    debugOverride: import("./sprite-debug.js").LayerOverride | null = null,
  ): void {
    const r = c100to255(tint.red);
    const g = c100to255(tint.green);
    const b = c100to255(tint.blue);
    if (r >= 255 && g >= 255 && b >= 255) return;

    const { ctx } = this;
    const { x, y, width, height } = cellRect;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    this.applyDeepDiveProps(debugOverride, cellRect);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
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
  // drawVariantLabel — debug overlay showing autotile variant index
  // ===========================================================================

  private drawVariantLabel(cellRect: CellRect, index: number): void {
    const { ctx } = this;
    const fontSize = Math.max(8, Math.floor(cellRect.height * 0.45));
    ctx.save();
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = cellRect.x + cellRect.width / 2;
    const cy = cellRect.y + cellRect.height / 2;
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2.5;
    ctx.strokeText(String(index), cx, cy);
    ctx.fillStyle = "#ff0";
    ctx.fillText(String(index), cx, cy);
    ctx.restore();
  }

  // ===========================================================================
  // drawSpriteTinted — per-layer tinted sprite draw
  // ===========================================================================

  /**
   * Draw a sprite with tint. Tint color is on Brogue 0–100 scale.
   *
   * `config` provides the permanent blend mode and tint alpha from
   * LAYER_DEFAULTS. `debugOverride` (from the F2 panel) wins when set.
   *
   * Fast path: when effective blend mode is "none" or tint ≈ neutral,
   * blit directly (skips offscreen canvas ops).
   */
  private drawSpriteTinted(
    spriteRef: SpriteRef,
    cellRect: CellRect,
    tint: Readonly<Color>,
    config: LayerConfig,
    debugOverride: import("./sprite-debug.js").LayerOverride | null = null,
  ): void {
    const { ctx } = this;
    const bitmap = this.bitmaps.get(bitmapKey(spriteRef));
    const source: CanvasImageSource | undefined =
      bitmap ?? this.tiles.get(spriteRef.sheetKey);
    if (!source) return;

    const sprSx = bitmap ? 0 : spriteRef.tileX * TILE_SIZE;
    const sprSy = bitmap ? 0 : spriteRef.tileY * TILE_SIZE;

    let drawSource: CanvasImageSource = source;
    let drawSx = sprSx,
      drawSy = sprSy;

    const blendMode = debugOverride?.blendMode ?? config.blendMode;

    if (blendMode !== "none") {
      const tintR = debugOverride?.tintOverride
        ? (debugOverride.tintOverride.r * 100) / 255
        : tint.red;
      const tintG = debugOverride?.tintOverride
        ? (debugOverride.tintOverride.g * 100) / 255
        : tint.green;
      const tintB = debugOverride?.tintOverride
        ? (debugOverride.tintOverride.b * 100) / 255
        : tint.blue;

      const neutral =
        tintR >= NEUTRAL_TINT_THRESHOLD &&
        tintG >= NEUTRAL_TINT_THRESHOLD &&
        tintB >= NEUTRAL_TINT_THRESHOLD;

      if (!neutral || debugOverride?.blendMode) {
        const { tintCtx, tintCanvas } = this;

        tintCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
        tintCtx.drawImage(
          source,
          sprSx,
          sprSy,
          TILE_SIZE,
          TILE_SIZE,
          0,
          0,
          TILE_SIZE,
          TILE_SIZE,
        );

        const tintAlpha = debugOverride?.tintOverride?.a ?? config.tintAlpha;
        tintCtx.save();
        tintCtx.globalCompositeOperation = blendMode;
        if (tintAlpha < 1) tintCtx.globalAlpha = tintAlpha;
        tintCtx.fillStyle = `rgb(${c100to255(tintR)},${c100to255(tintG)},${c100to255(tintB)})`;
        tintCtx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
        if (tintAlpha < 1) tintCtx.globalAlpha = 1;

        tintCtx.globalCompositeOperation = "destination-in";
        tintCtx.drawImage(
          source,
          sprSx,
          sprSy,
          TILE_SIZE,
          TILE_SIZE,
          0,
          0,
          TILE_SIZE,
          TILE_SIZE,
        );
        tintCtx.restore();

        drawSource = tintCanvas;
        drawSx = 0;
        drawSy = 0;
      }
    }

    const dd = this.applyDeepDiveOverrides(debugOverride, cellRect);
    ctx.drawImage(
      drawSource,
      drawSx,
      drawSy,
      TILE_SIZE,
      TILE_SIZE,
      cellRect.x,
      cellRect.y,
      cellRect.width,
      cellRect.height,
    );
    if (dd) ctx.restore();
  }

  // ===========================================================================
  // Deep-dive override helpers (Phase 3)
  // ===========================================================================

  /**
   * Set Canvas2D filter, shadow, smoothing, and transform properties on ctx.
   * Does NOT call save/restore — caller is responsible.
   */
  private applyDeepDiveProps(
    lo: import("./sprite-debug.js").LayerOverride | null,
    cellRect: CellRect,
  ): void {
    if (!lo) return;
    const { ctx } = this;
    if (lo.filterOverride !== null) ctx.filter = lo.filterOverride;
    if (lo.shadowBlur !== null) ctx.shadowBlur = lo.shadowBlur;
    if (lo.shadowColor !== null) ctx.shadowColor = lo.shadowColor;
    if (lo.shadowOffsetX !== null) ctx.shadowOffsetX = lo.shadowOffsetX;
    if (lo.shadowOffsetY !== null) ctx.shadowOffsetY = lo.shadowOffsetY;
    if (lo.imageSmoothingOverride !== null) {
      ctx.imageSmoothingEnabled = lo.imageSmoothingOverride;
    }
    if (lo.flipH || lo.rotation !== 0 || lo.scale !== 1) {
      const cx = cellRect.x + cellRect.width / 2;
      const cy = cellRect.y + cellRect.height / 2;
      ctx.translate(cx, cy);
      if (lo.flipH) ctx.scale(-1, 1);
      if (lo.rotation !== 0) ctx.rotate((lo.rotation * Math.PI) / 180);
      if (lo.scale !== 1) ctx.scale(lo.scale, lo.scale);
      ctx.translate(-cx, -cy);
    }
  }

  /** Save context and apply deep-dive overrides. Returns true if ctx.restore() is needed. */
  private applyDeepDiveOverrides(
    lo: import("./sprite-debug.js").LayerOverride | null,
    cellRect: CellRect,
  ): boolean {
    if (!lo) return false;
    const has =
      lo.filterOverride !== null ||
      lo.shadowBlur !== null ||
      lo.shadowColor !== null ||
      lo.imageSmoothingOverride !== null ||
      lo.flipH ||
      lo.rotation !== 0 ||
      lo.scale !== 1;
    if (!has) return false;
    this.ctx.save();
    this.applyDeepDiveProps(lo, cellRect);
    return true;
  }
}
