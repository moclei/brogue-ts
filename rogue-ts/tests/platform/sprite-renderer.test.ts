/*
 *  sprite-renderer.test.ts — Tests for SpriteRenderer
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - resolveSprite: tileTypeSpriteMap → spriteMap → undefined
 *   - drawCell falls back to TextRenderer when glyph is unmapped
 *   - drawCell draws background fill + sprite for mapped glyphs
 *   - drawCell with underlyingTerrain draws two layers in correct order
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpriteRenderer } from "../../src/platform/sprite-renderer.js";
import { TextRenderer } from "../../src/platform/text-renderer.js";
import { DisplayGlyph, TileType } from "../../src/types/enums.js";
import type { CellRect } from "../../src/platform/renderer.js";
import type { SpriteRef } from "../../src/platform/glyph-sprite-map.js";

// ---------------------------------------------------------------------------
// Mock canvas context — tracks calls but doesn't render
// ---------------------------------------------------------------------------

function mockCtx() {
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

function mockTintCanvas() {
  const tintCtx = mockCtx();
  const canvas = {
    width: 16,
    height: 16,
    getContext: () => tintCtx,
  };
  return { canvas, tintCtx };
}

// Stub document.createElement to return our mock tint canvas
const { canvas: fakeTintCanvas, tintCtx: fakeTintCtx } = mockTintCanvas();
vi.stubGlobal("document", {
  createElement: () => fakeTintCanvas,
});

const CELL: CellRect = { x: 80, y: 48, width: 16, height: 24 };

const REF_FLOOR: SpriteRef = { sheetKey: "Floor", tileX: 15, tileY: 13 };
const REF_WALL: SpriteRef = { sheetKey: "Wall", tileX: 10, tileY: 15 };
const REF_GLYPH: SpriteRef = { sheetKey: "Floor", tileX: 16, tileY: 14 };

function fakeImage(): HTMLImageElement {
  return {} as HTMLImageElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SpriteRenderer", () => {
  let ctx: ReturnType<typeof mockCtx>;
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
});
