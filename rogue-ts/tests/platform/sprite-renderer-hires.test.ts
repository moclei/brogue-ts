/*
 *  sprite-renderer-hires.test.ts — Phase 2 pixel-art variable-res tests
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - Hi-res SpriteRef causes createImageBitmap to be called with srcW/srcH dims
 *   - Standard SpriteRef causes createImageBitmap to be called with TILE_SIZE dims
 *   - bitmapKey uniqueness: hi-res ref at same (sheetKey, tileX, tileY) as
 *     standard ref produces a different key (no cache collision)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpriteRenderer } from "../../src/platform/sprite-renderer.js";
import { TextRenderer } from "../../src/platform/text-renderer.js";
import { DisplayGlyph, TileType } from "../../src/types/enums.js";
import type { SpriteRef } from "../../src/platform/glyph-sprite-map.js";
import { TILE_SIZE } from "../../src/platform/tileset-loader.js";

// ---------------------------------------------------------------------------
// Mock globals
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

const fakeTintCtx = mockCtx();
vi.stubGlobal("OffscreenCanvas", class MockOffscreenCanvas {
  width: number;
  height: number;
  constructor(w: number, h: number) { this.width = w; this.height = h; }
  getContext() { return fakeTintCtx; }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeImage(): HTMLImageElement {
  return {} as HTMLImageElement;
}

function fakeBitmap(): ImageBitmap {
  return { close: vi.fn(), width: 16, height: 16 } as unknown as ImageBitmap;
}

function makeRenderer(
  spriteMap: Map<DisplayGlyph, SpriteRef>,
  tileTypeSpriteMap: Map<TileType, SpriteRef>,
  tiles: Map<string, HTMLImageElement>,
): SpriteRenderer {
  const ctx = mockCtx();
  const textRenderer = new TextRenderer(ctx, "monospace", 14);
  return new SpriteRenderer(ctx, tiles, spriteMap, tileTypeSpriteMap, textRenderer);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SpriteRenderer — hi-res variable-res (Phase 2)", () => {
  let tiles: Map<string, HTMLImageElement>;
  let spriteMap: Map<DisplayGlyph, SpriteRef>;
  let tileTypeSpriteMap: Map<TileType, SpriteRef>;

  beforeEach(() => {
    vi.clearAllMocks();
    tiles = new Map<string, HTMLImageElement>();
    tiles.set("Floor", fakeImage());
    spriteMap = new Map<DisplayGlyph, SpriteRef>();
    tileTypeSpriteMap = new Map<TileType, SpriteRef>();
  });

  // ---- createImageBitmap dimensions ----

  describe("precreateBitmaps — createImageBitmap dimensions", () => {
    it("calls createImageBitmap with srcW=32, srcH=32 for a hi-res SpriteRef", async () => {
      const hiResRef: SpriteRef = {
        sheetKey: "Floor",
        tileX: 2,
        tileY: 3,
        srcW: 32,
        srcH: 32,
      };
      tileTypeSpriteMap.set(TileType.FLOOR, hiResRef);

      const capturedCalls: unknown[][] = [];
      vi.stubGlobal("createImageBitmap", (...args: unknown[]) => {
        capturedCalls.push(args);
        return Promise.resolve(fakeBitmap());
      });

      const renderer = makeRenderer(spriteMap, tileTypeSpriteMap, tiles);
      await renderer.precreateBitmaps();

      expect(capturedCalls).toHaveLength(1);
      // createImageBitmap(img, sx, sy, sw, sh)
      const [, sx, sy, sw, sh] = capturedCalls[0] as [unknown, number, number, number, number];
      expect(sw).toBe(32);
      expect(sh).toBe(32);
      // source x/y still based on tileX * TILE_SIZE, tileY * TILE_SIZE
      expect(sx).toBe(hiResRef.tileX * TILE_SIZE);
      expect(sy).toBe(hiResRef.tileY * TILE_SIZE);
    });

    it("calls createImageBitmap with TILE_SIZE dimensions when srcW/srcH are absent", async () => {
      const standardRef: SpriteRef = {
        sheetKey: "Floor",
        tileX: 5,
        tileY: 7,
      };
      tileTypeSpriteMap.set(TileType.FLOOR, standardRef);

      const capturedCalls: unknown[][] = [];
      vi.stubGlobal("createImageBitmap", (...args: unknown[]) => {
        capturedCalls.push(args);
        return Promise.resolve(fakeBitmap());
      });

      const renderer = makeRenderer(spriteMap, tileTypeSpriteMap, tiles);
      await renderer.precreateBitmaps();

      expect(capturedCalls).toHaveLength(1);
      const [, , , sw, sh] = capturedCalls[0] as [unknown, number, number, number, number];
      expect(sw).toBe(TILE_SIZE);
      expect(sh).toBe(TILE_SIZE);
    });
  });

  // ---- bitmapKey uniqueness ----

  describe("bitmapKey uniqueness", () => {
    it("produces different bitmap keys for hi-res and standard refs at same (sheetKey, tileX, tileY)", async () => {
      const sharedCoords = { sheetKey: "Floor", tileX: 4, tileY: 6 };
      const standardRef: SpriteRef = { ...sharedCoords };
      const hiResRef: SpriteRef = { ...sharedCoords, srcW: 32, srcH: 32 };

      // Track distinct keys used in createImageBitmap calls via the bitmap stored
      const storedKeys: string[] = [];
      let callCount = 0;

      vi.stubGlobal("createImageBitmap", (_img: unknown, _sx: unknown, _sy: unknown, sw: unknown, sh: unknown) => {
        callCount++;
        // Distinguish by dimensions
        const dimSuffix = sw !== TILE_SIZE || sh !== TILE_SIZE ? `:${sw}x${sh}` : "";
        storedKeys.push(`${sharedCoords.sheetKey}:${sharedCoords.tileX}:${sharedCoords.tileY}${dimSuffix}`);
        return Promise.resolve(fakeBitmap());
      });

      // Register both refs in different maps so both get scheduled
      tileTypeSpriteMap.set(TileType.FLOOR, standardRef);
      spriteMap.set(DisplayGlyph.G_FLOOR, hiResRef);

      const renderer = makeRenderer(spriteMap, tileTypeSpriteMap, tiles);
      await renderer.precreateBitmaps();

      // Both refs must have been processed (not deduplicated as the same key)
      expect(callCount).toBe(2);

      // Keys must differ
      expect(storedKeys[0]).not.toBe(storedKeys[1]);

      // Standard ref key has no suffix
      const standardKey = storedKeys.find((k) => !k.includes("x"));
      const hiResKey = storedKeys.find((k) => k.includes("x"));
      expect(standardKey).toBeDefined();
      expect(hiResKey).toBeDefined();
      expect(standardKey).toBe("Floor:4:6");
      expect(hiResKey).toBe("Floor:4:6:32x32");
    });

    it("deduplicates identical hi-res refs (same key = single createImageBitmap call)", async () => {
      const hiResRef: SpriteRef = {
        sheetKey: "Floor",
        tileX: 1,
        tileY: 1,
        srcW: 32,
        srcH: 32,
      };
      // Register the same hi-res ref in both maps
      tileTypeSpriteMap.set(TileType.FLOOR, hiResRef);
      spriteMap.set(DisplayGlyph.G_FLOOR, hiResRef);

      let callCount = 0;
      vi.stubGlobal("createImageBitmap", () => {
        callCount++;
        return Promise.resolve(fakeBitmap());
      });

      const renderer = makeRenderer(spriteMap, tileTypeSpriteMap, tiles);
      await renderer.precreateBitmaps();

      expect(callCount).toBe(1);
    });
  });
});
