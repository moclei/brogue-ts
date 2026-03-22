/*
 *  browser-renderer-mode.test.ts — Tests for mode switching in createBrowserConsole
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - Text mode dispatches all cells to textRenderer
 *   - Tiles mode dispatches viewport cells to spriteRenderer, sidebar/message to textRenderer
 *   - Missing spriteRenderer falls back to textRenderer
 *   - setGraphicsMode returns the current mode
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GraphicsMode, DisplayGlyph, TileType } from "../../src/types/enums.js";
import type { SpriteRef } from "../../src/platform/glyph-sprite-map.js";
import type { CellSpriteData } from "../../src/platform/render-layers.js";
import { VisibilityState, createCellSpriteData } from "../../src/platform/render-layers.js";

// ---------------------------------------------------------------------------
// Mock canvas context & DOM stubs (must precede renderer imports)
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
    setTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function createMockCanvas() {
  const ctx = mockCtx();
  const canvas = {
    getContext: () => ctx,
    addEventListener: vi.fn(),
    hasAttribute: vi.fn().mockReturnValue(false),
    setAttribute: vi.fn(),
    getBoundingClientRect: vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 1600,
      height: 544,
    }),
    width: 1600,
    height: 544,
  } as unknown as HTMLCanvasElement;
  return { canvas, ctx };
}

// SpriteRenderer's constructor creates an OffscreenCanvas for tinting.
// browser-renderer.ts calls document.addEventListener for keydown/keyup.
const tintCtx = mockCtx();
vi.stubGlobal("OffscreenCanvas", class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() { return tintCtx; }
});
vi.stubGlobal("document", {
  addEventListener: vi.fn(),
});

// Imports that touch the DOM must come after stubGlobal
import { createBrowserConsole } from "../../src/platform/browser-renderer.js";
import { TextRenderer } from "../../src/platform/text-renderer.js";
import { SpriteRenderer } from "../../src/platform/sprite-renderer.js";

// ---------------------------------------------------------------------------
// Coordinate constants
// ---------------------------------------------------------------------------

// Dungeon viewport: x in [21, 100), y in [3, 32)
const VP_X = 30;
const VP_Y = 10;
const SIDE_X = 5;
const SIDE_Y = 10;
const MSG_X = 30;
const MSG_Y = 1;

const FG_R = 50;
const FG_G = 50;
const FG_B = 50;
const BG_R = 0;
const BG_G = 0;
const BG_B = 0;

function fakeImage(): HTMLImageElement {
  return {} as HTMLImageElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createBrowserConsole mode switching", () => {
  let textRenderer: TextRenderer;
  let spriteRenderer: SpriteRenderer;
  let textDrawCell: ReturnType<typeof vi.spyOn>;
  let spriteDrawCell: ReturnType<typeof vi.spyOn>;

  function buildConsole(opts?: { omitSprite?: boolean }) {
    const { canvas } = createMockCanvas();
    const rendererCtx = mockCtx();
    textRenderer = new TextRenderer(rendererCtx, "monospace", 16);
    textDrawCell = vi.spyOn(textRenderer, "drawCell");

    if (opts?.omitSprite) {
      return createBrowserConsole({ canvas, textRenderer });
    }

    const tiles = new Map<string, HTMLImageElement>();
    tiles.set("Floor", fakeImage());

    const spriteMap = new Map<DisplayGlyph, SpriteRef>();
    spriteMap.set(DisplayGlyph.G_FLOOR, {
      sheetKey: "Floor",
      tileX: 0,
      tileY: 0,
    });

    const tileTypeSpriteMap = new Map<TileType, SpriteRef>();
    tileTypeSpriteMap.set(TileType.FLOOR, {
      sheetKey: "Floor",
      tileX: 0,
      tileY: 0,
    });

    spriteRenderer = new SpriteRenderer(
      rendererCtx,
      tiles,
      spriteMap,
      tileTypeSpriteMap,
      textRenderer,
    );
    spriteDrawCell = vi.spyOn(spriteRenderer, "drawCell");

    return createBrowserConsole({ canvas, textRenderer, spriteRenderer });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches viewport cells to textRenderer in Text mode", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Text);
    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(textDrawCell).toHaveBeenCalledTimes(1);
    expect(spriteDrawCell).not.toHaveBeenCalled();
  });

  it("dispatches viewport cells to spriteRenderer in Tiles mode", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);
    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(spriteDrawCell).toHaveBeenCalledTimes(1);
    expect(textDrawCell).not.toHaveBeenCalled();
  });

  it("dispatches sidebar cells to textRenderer even in Tiles mode", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);
    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      SIDE_X, SIDE_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(textDrawCell).toHaveBeenCalledTimes(1);
    expect(spriteDrawCell).not.toHaveBeenCalled();
  });

  it("dispatches message area cells to textRenderer even in Tiles mode", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);
    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      MSG_X, MSG_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(textDrawCell).toHaveBeenCalledTimes(1);
    expect(spriteDrawCell).not.toHaveBeenCalled();
  });

  it("falls back to textRenderer when spriteRenderer is absent", () => {
    const bc = buildConsole({ omitSprite: true });
    bc.setGraphicsMode(GraphicsMode.Tiles);
    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(textDrawCell).toHaveBeenCalledTimes(1);
  });

  it("setGraphicsMode returns the mode that was set", () => {
    const bc = buildConsole();

    expect(bc.setGraphicsMode(GraphicsMode.Tiles)).toBe(GraphicsMode.Tiles);
    expect(bc.setGraphicsMode(GraphicsMode.Text)).toBe(GraphicsMode.Text);
  });

  // ---- Layer compositing pipeline (Phase 6a) ----

  it("dispatches viewport cells to drawCellLayers when provider is set in Tiles mode", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);

    const { spriteData } = createCellSpriteData();
    const provider = vi.fn().mockReturnValue(spriteData);
    bc.setCellSpriteDataProvider(provider);

    const spriteDrawCellLayers = vi.spyOn(spriteRenderer, "drawCellLayers");

    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
      TileType.FLOOR,
    );

    expect(provider).toHaveBeenCalledTimes(1);
    expect(spriteDrawCellLayers).toHaveBeenCalledTimes(1);
    expect(spriteDrawCell).not.toHaveBeenCalled();
    expect(textDrawCell).not.toHaveBeenCalled();
  });

  it("passes correct dungeon coordinates to provider", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);

    const { spriteData } = createCellSpriteData();
    const provider = vi.fn().mockReturnValue(spriteData);
    bc.setCellSpriteDataProvider(provider);

    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
      TileType.FLOOR,
    );

    // VP_X = 30, STAT_BAR_WIDTH + 1 = 21 → dx = 9
    // VP_Y = 10, MESSAGE_LINES = 3 → dy = 7
    expect(provider).toHaveBeenCalledWith(9, 7);
  });

  it("falls back to drawCell in Tiles mode when provider is not set", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);

    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(spriteDrawCell).toHaveBeenCalledTimes(1);
    expect(textDrawCell).not.toHaveBeenCalled();
  });

  it("falls back to text when tileType is undefined (UI overlay) in Tiles mode with provider", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);

    const { spriteData } = createCellSpriteData();
    const provider = vi.fn().mockReturnValue(spriteData);
    bc.setCellSpriteDataProvider(provider);

    // UI overlay cells (inventory, text boxes) don't set tileType
    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      VP_X, VP_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
      undefined,  // no tileType → UI overlay, not dungeon cell
    );

    expect(provider).not.toHaveBeenCalled();
    // Falls through to drawCell, which falls back to textRenderer for unmapped glyphs
    expect(spriteDrawCell).toHaveBeenCalledTimes(1);
  });

  it("does not call provider for sidebar cells in Tiles mode", () => {
    const bc = buildConsole();
    bc.setGraphicsMode(GraphicsMode.Tiles);

    const { spriteData } = createCellSpriteData();
    const provider = vi.fn().mockReturnValue(spriteData);
    bc.setCellSpriteDataProvider(provider);

    bc.plotChar(
      DisplayGlyph.G_FLOOR,
      SIDE_X, SIDE_Y,
      FG_R, FG_G, FG_B,
      BG_R, BG_G, BG_B,
    );

    expect(provider).not.toHaveBeenCalled();
    expect(textDrawCell).toHaveBeenCalledTimes(1);
  });
});
