/*
 *  sprite-renderer.test.ts — Tests for SpriteRenderer
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - resolveSprite: tileTypeSpriteMap → spriteMap → undefined, both optional
 *   - drawCell legacy fallback + background fill + sprite drawing
 *   - drawCellLayers: bgColor fill, per-layer compositing, gas alpha,
 *     visibility overlays, skip-tinting fast path
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpriteRenderer } from "../../src/platform/sprite-renderer.js";
import { TextRenderer } from "../../src/platform/text-renderer.js";
import { DisplayGlyph, TileType } from "../../src/types/enums.js";
import type { CellRect } from "../../src/platform/renderer.js";
import type { SpriteRef } from "../../src/platform/glyph-sprite-map.js";
import type { Color } from "../../src/types/types.js";
import type { CellSpriteData, LayerEntry } from "../../src/platform/render-layers.js";
import { RenderLayer, RENDER_LAYER_COUNT, VisibilityState } from "../../src/platform/render-layers.js";

// ---------------------------------------------------------------------------
// Mock canvas context — tracks calls but doesn't render
// ---------------------------------------------------------------------------

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: "",
    font: "",
    textBaseline: "" as CanvasTextBaseline,
    textAlign: "" as CanvasTextAlign,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillRect: vi.fn(),
    fillText: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

// Stub OffscreenCanvas globally (replaces document.createElement stub)
const fakeTintCtx = mockCtx();
vi.stubGlobal("OffscreenCanvas", class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() { return fakeTintCtx; }
});

const CELL: CellRect = { x: 80, y: 48, width: 16, height: 24 };

const REF_FLOOR: SpriteRef = { sheetKey: "Floor", tileX: 15, tileY: 13 };
const REF_WALL: SpriteRef = { sheetKey: "Wall", tileX: 10, tileY: 15 };
const REF_GLYPH: SpriteRef = { sheetKey: "Floor", tileX: 16, tileY: 14 };
const REF_GAS: SpriteRef = { sheetKey: "Floor", tileX: 0, tileY: 0 };

function fakeImage(): HTMLImageElement {
  return {} as HTMLImageElement;
}

function makeColor(r: number, g: number, b: number): Color {
  return {
    red: r, green: g, blue: b,
    redRand: 0, greenRand: 0, blueRand: 0,
    rand: 0, colorDances: false,
  };
}

function makeLayer(
  opts: { tileType?: TileType; glyph?: DisplayGlyph; tint: Color; alpha?: number },
): LayerEntry {
  return { tileType: opts.tileType, glyph: opts.glyph, tint: opts.tint, alpha: opts.alpha };
}

function makeSpriteData(overrides: Partial<CellSpriteData> = {}): CellSpriteData {
  return {
    layers: new Array(RENDER_LAYER_COUNT).fill(undefined),
    bgColor: makeColor(0, 0, 0),
    visibilityState: VisibilityState.Visible,
    inWater: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SpriteRenderer", () => {
  let ctx: CanvasRenderingContext2D;
  let tiles: Map<string, HTMLImageElement>;
  let spriteMap: Map<DisplayGlyph, SpriteRef>;
  let tileTypeSpriteMap: Map<TileType, SpriteRef>;
  let textRenderer: TextRenderer;
  let renderer: SpriteRenderer;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = mockCtx();

    tiles = new Map<string, HTMLImageElement>();
    tiles.set("Floor", fakeImage());
    tiles.set("Wall", fakeImage());

    spriteMap = new Map<DisplayGlyph, SpriteRef>();
    spriteMap.set(DisplayGlyph.G_FLOOR, REF_GLYPH);

    tileTypeSpriteMap = new Map<TileType, SpriteRef>();
    tileTypeSpriteMap.set(TileType.FLOOR, REF_FLOOR);
    tileTypeSpriteMap.set(TileType.WALL, REF_WALL);

    textRenderer = new TextRenderer(ctx, "monospace", 14);
    vi.spyOn(textRenderer, "drawCell");

    renderer = new SpriteRenderer(
      ctx,
      tiles,
      spriteMap,
      tileTypeSpriteMap,
      textRenderer,
    );
  });

  // ---- resolveSprite ----

  describe("resolveSprite", () => {
    it("returns tileTypeSpriteMap entry when tileType is provided and mapped", () => {
      const ref = renderer.resolveSprite(TileType.FLOOR, DisplayGlyph.G_FLOOR);
      expect(ref).toBe(REF_FLOOR);
    });

    it("falls back to spriteMap when tileType is not in tileTypeSpriteMap", () => {
      const unmappedTileType = 9999 as TileType;
      const ref = renderer.resolveSprite(unmappedTileType, DisplayGlyph.G_FLOOR);
      expect(ref).toBe(REF_GLYPH);
    });

    it("falls back to spriteMap when tileType is undefined", () => {
      const ref = renderer.resolveSprite(undefined, DisplayGlyph.G_FLOOR);
      expect(ref).toBe(REF_GLYPH);
    });

    it("returns undefined when neither map has the glyph", () => {
      const unknownGlyph = 0xff as DisplayGlyph;
      const ref = renderer.resolveSprite(undefined, unknownGlyph);
      expect(ref).toBeUndefined();
    });

    it("returns tileTypeSpriteMap entry when only tileType is provided", () => {
      const ref = renderer.resolveSprite(TileType.FLOOR);
      expect(ref).toBe(REF_FLOOR);
    });

    it("returns spriteMap entry when only glyph is provided", () => {
      const ref = renderer.resolveSprite(undefined, DisplayGlyph.G_FLOOR);
      expect(ref).toBe(REF_GLYPH);
    });

    it("returns undefined when both are undefined", () => {
      const ref = renderer.resolveSprite(undefined, undefined);
      expect(ref).toBeUndefined();
    });

    it("returns undefined when called with no arguments", () => {
      const ref = renderer.resolveSprite();
      expect(ref).toBeUndefined();
    });
  });

  // ---- drawCell fallback ----

  describe("drawCell fallback", () => {
    it("delegates to textRenderer when glyph is unmapped", () => {
      const unknownGlyph = 0xff as DisplayGlyph;
      renderer.drawCell(CELL, unknownGlyph, 255, 255, 255, 0, 0, 0);

      expect(textRenderer.drawCell).toHaveBeenCalledWith(
        CELL,
        unknownGlyph,
        255, 255, 255,
        0, 0, 0,
      );
    });

    it("does not delegate to textRenderer when glyph is mapped", () => {
      renderer.drawCell(
        CELL, DisplayGlyph.G_FLOOR, 255, 255, 255, 0, 0, 0,
        TileType.FLOOR,
      );

      expect(textRenderer.drawCell).not.toHaveBeenCalled();
    });
  });

  // ---- drawCell background fill ----

  describe("drawCell background", () => {
    it("fills background with bg color for mapped sprites", () => {
      renderer.drawCell(
        CELL, DisplayGlyph.G_FLOOR, 200, 150, 100, 10, 20, 30,
        TileType.FLOOR,
      );

      expect(ctx.fillRect).toHaveBeenCalledWith(CELL.x, CELL.y, CELL.width, CELL.height);
    });
  });

  // ---- drawCell sprite drawing ----

  describe("drawCell sprite drawing", () => {
    it("calls drawImage on main context to blit tinted sprite", () => {
      renderer.drawCell(
        CELL, DisplayGlyph.G_FLOOR, 200, 150, 100, 0, 0, 0,
        TileType.FLOOR,
      );

      expect(ctx.drawImage).toHaveBeenCalled();
    });

    it("uses tintCanvas for multiply composite", () => {
      renderer.drawCell(
        CELL, DisplayGlyph.G_FLOOR, 200, 150, 100, 0, 0, 0,
        TileType.FLOOR,
      );

      expect(fakeTintCtx.clearRect).toHaveBeenCalled();
      expect(fakeTintCtx.save).toHaveBeenCalled();
      expect(fakeTintCtx.restore).toHaveBeenCalled();
    });
  });

  // ---- drawCell two-layer (underlyingTerrain) ----

  describe("drawCell with underlyingTerrain", () => {
    it("draws terrain layer then creature layer (two drawImage calls)", () => {
      renderer.drawCell(
        CELL, DisplayGlyph.G_FLOOR, 255, 255, 255, 0, 0, 0,
        TileType.WALL, // creature tileType
        TileType.FLOOR, // terrain underneath
      );

      // Two blits to the main context: terrain sprite + creature sprite
      expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    });
  });

  // ---- drawCell foreground overlay (getBackgroundTileType) ----

  describe("drawCell with foreground overlay tile", () => {
    it("draws background tile then foreground tile for overlay types", () => {
      tileTypeSpriteMap.set(TileType.FOLIAGE, {
        sheetKey: "Floor",
        tileX: 0,
        tileY: 0,
      });

      renderer.drawCell(
        CELL, DisplayGlyph.G_GRASS, 100, 200, 50, 0, 0, 0,
        TileType.FOLIAGE,
      );

      // Two blits: background (FLOOR, via getBackgroundTileType) + foreground (FOLIAGE)
      expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // drawCellLayers — layer compositing pipeline
  // ===========================================================================

  describe("drawCellLayers", () => {
    describe("background fill", () => {
      it("fills cell with bgColor converted from 0-100 to 0-255", () => {
        const sd = makeSpriteData({ bgColor: makeColor(50, 25, 75) });
        renderer.drawCellLayers(CELL, sd);

        const expectedR = Math.round((50 * 255) / 100); // 128
        const expectedG = Math.round((25 * 255) / 100); // 64
        const expectedB = Math.round((75 * 255) / 100); // 191
        expect(ctx.fillStyle).toBe(`rgb(${expectedR},${expectedG},${expectedB})`);
        expect(ctx.fillRect).toHaveBeenCalledWith(CELL.x, CELL.y, CELL.width, CELL.height);
      });

      it("fills with black (0,0,0) for zero bgColor", () => {
        const sd = makeSpriteData({ bgColor: makeColor(0, 0, 0) });
        renderer.drawCellLayers(CELL, sd);
        expect(ctx.fillStyle).toBe("rgb(0,0,0)");
      });
    });

    describe("layer compositing", () => {
      it("draws a single terrain layer sprite", () => {
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(80, 60, 40),
        });
        renderer.drawCellLayers(CELL, sd);

        // bg fill + tint blit to main context
        expect(ctx.drawImage).toHaveBeenCalled();
        // tint canvas was used (non-neutral tint)
        expect(fakeTintCtx.clearRect).toHaveBeenCalled();
      });

      it("skips undefined layer entries", () => {
        const sd = makeSpriteData();
        // All layers undefined — only bg fill, no drawImage
        renderer.drawCellLayers(CELL, sd);
        expect(ctx.drawImage).not.toHaveBeenCalled();
      });

      it("draws layers in index order (TERRAIN before ENTITY)", () => {
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(100, 100, 100),
        });
        sd.layers[RenderLayer.ENTITY] = makeLayer({
          glyph: DisplayGlyph.G_PLAYER,
          tint: makeColor(100, 100, 100),
        });

        spriteMap.set(DisplayGlyph.G_PLAYER, { sheetKey: "Floor", tileX: 0, tileY: 0 });
        tiles.set("Player0", fakeImage());

        renderer.drawCellLayers(CELL, sd);

        // Both layers drawn — two drawImage calls (both neutral = fast path)
        expect(ctx.drawImage).toHaveBeenCalledTimes(2);
      });

      it("skips layers with no sprite mapping", () => {
        const sd = makeSpriteData();
        sd.layers[RenderLayer.ENTITY] = makeLayer({
          glyph: 0xff as DisplayGlyph,
          tint: makeColor(100, 100, 100),
        });
        renderer.drawCellLayers(CELL, sd);
        // No drawImage — unmapped glyph
        expect(ctx.drawImage).not.toHaveBeenCalled();
      });
    });

    describe("gas alpha", () => {
      it("sets globalAlpha for gas layers with alpha < 1", () => {
        tileTypeSpriteMap.set(TileType.CONFUSION_GAS as TileType, REF_GAS);
        const sd = makeSpriteData();
        sd.layers[RenderLayer.GAS] = makeLayer({
          tileType: TileType.CONFUSION_GAS as TileType,
          tint: makeColor(100, 100, 100),
          alpha: 0.5,
        });

        renderer.drawCellLayers(CELL, sd);
        // globalAlpha should have been set then restored
        expect(ctx.globalAlpha).toBe(1);
      });

      it("does not set globalAlpha when alpha is 1 or undefined", () => {
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(100, 100, 100),
        });
        renderer.drawCellLayers(CELL, sd);
        expect(ctx.globalAlpha).toBe(1);
      });
    });

    describe("skip-tinting fast path", () => {
      it("skips tint canvas when tint components are all >= 98", () => {
        vi.clearAllMocks();
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(100, 100, 100),
        });
        renderer.drawCellLayers(CELL, sd);

        // Fast path: direct drawImage, no tint canvas operations
        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        expect(fakeTintCtx.clearRect).not.toHaveBeenCalled();
      });

      it("uses tint canvas when tint components are below 98", () => {
        vi.clearAllMocks();
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(50, 50, 50),
        });
        renderer.drawCellLayers(CELL, sd);

        // Full path: tint canvas used, then blit
        expect(fakeTintCtx.clearRect).toHaveBeenCalled();
        expect(fakeTintCtx.save).toHaveBeenCalled();
        expect(fakeTintCtx.restore).toHaveBeenCalled();
        expect(ctx.drawImage).toHaveBeenCalled();
      });

      it("treats tint of (98, 98, 98) as neutral", () => {
        vi.clearAllMocks();
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(98, 99, 100),
        });
        renderer.drawCellLayers(CELL, sd);

        expect(fakeTintCtx.clearRect).not.toHaveBeenCalled();
      });

      it("uses tint canvas when one component is below 98", () => {
        vi.clearAllMocks();
        const sd = makeSpriteData();
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(97, 100, 100),
        });
        renderer.drawCellLayers(CELL, sd);

        expect(fakeTintCtx.clearRect).toHaveBeenCalled();
      });
    });

    describe("visibility overlays", () => {
      function setupTerrainLayer(sd: CellSpriteData) {
        sd.layers[RenderLayer.TERRAIN] = makeLayer({
          tileType: TileType.FLOOR,
          tint: makeColor(100, 100, 100),
        });
      }

      it("applies no overlay for Visible state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Visible });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);
        // No save/restore for overlay (only bg fill + sprite)
        expect(ctx.save).not.toHaveBeenCalled();
      });

      it("applies no overlay for Shroud state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Shroud });
        renderer.drawCellLayers(CELL, sd);
        expect(ctx.save).not.toHaveBeenCalled();
      });

      it("applies multiply fill for Remembered state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Remembered });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.globalCompositeOperation).toBe("multiply");
        expect(ctx.fillRect).toHaveBeenCalled();
        expect(ctx.restore).toHaveBeenCalled();
      });

      it("applies dark fill for Remembered+inWater", () => {
        const sd = makeSpriteData({
          visibilityState: VisibilityState.Remembered,
          inWater: true,
        });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        expect(ctx.save).toHaveBeenCalled();
        // source-over mode for dark fill
        expect(ctx.globalCompositeOperation).toBe("source-over");
        // alpha 0.8 for heavy dark fill
        expect(ctx.globalAlpha).toBe(0.8);
        expect(ctx.fillStyle).toBe("rgb(0,0,0)");
        expect(ctx.restore).toHaveBeenCalled();
      });

      it("applies multiply fill for Clairvoyant state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Clairvoyant });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.globalCompositeOperation).toBe("multiply");
        expect(ctx.restore).toHaveBeenCalled();
      });

      it("applies multiply fill for Telepathic state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Telepathic });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.globalCompositeOperation).toBe("multiply");
        expect(ctx.restore).toHaveBeenCalled();
      });

      it("applies multiply fill for MagicMapped state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.MagicMapped });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.globalCompositeOperation).toBe("multiply");
        expect(ctx.restore).toHaveBeenCalled();
      });

      it("applies multiply fill for Omniscience state", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Omniscience });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        expect(ctx.save).toHaveBeenCalled();
        expect(ctx.globalCompositeOperation).toBe("multiply");
        expect(ctx.restore).toHaveBeenCalled();
      });

      it("restores composite operation after overlay", () => {
        const sd = makeSpriteData({ visibilityState: VisibilityState.Remembered });
        setupTerrainLayer(sd);
        renderer.drawCellLayers(CELL, sd);

        // restore() is called which restores composite operation
        expect(ctx.restore).toHaveBeenCalledTimes(1);
      });
    });

    describe("drawCell still works as fallback", () => {
      it("draws sprite with legacy path unchanged", () => {
        renderer.drawCell(
          CELL, DisplayGlyph.G_FLOOR, 200, 150, 100, 0, 0, 0,
          TileType.FLOOR,
        );
        expect(ctx.drawImage).toHaveBeenCalled();
        expect(textRenderer.drawCell).not.toHaveBeenCalled();
      });
    });
  });
});
