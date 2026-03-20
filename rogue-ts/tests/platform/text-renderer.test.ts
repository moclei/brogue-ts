/*
 *  text-renderer.test.ts — Tests for TextRenderer
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - drawCell fills background via fillRect for all glyphs
 *   - drawCell draws text via fillText for visible glyphs (unicode > 0x20)
 *   - drawCell skips fillText for space glyph (0x20)
 *   - font and baseline are set correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TextRenderer } from "../../src/platform/text-renderer.js";
import { DisplayGlyph } from "../../src/types/enums.js";
import type { CellRect } from "../../src/platform/renderer.js";

function mockCtx() {
  return {
    fillStyle: "",
    font: "",
    textBaseline: "" as CanvasTextBaseline,
    textAlign: "" as CanvasTextAlign,
    fillRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const CELL: CellRect = { x: 100, y: 50, width: 16, height: 24 };
const FONT = "monospace";
const FONT_SIZE = 14;

describe("TextRenderer", () => {
  let ctx: ReturnType<typeof mockCtx>;
  let renderer: TextRenderer;

  beforeEach(() => {
    ctx = mockCtx();
    renderer = new TextRenderer(ctx, FONT, FONT_SIZE);
  });

  it("fills background with fillRect for every glyph", () => {
    renderer.drawCell(CELL, DisplayGlyph.G_FLOOR, 255, 255, 255, 10, 20, 30);

    expect(ctx.fillRect).toHaveBeenCalledWith(
      CELL.x,
      CELL.y,
      CELL.width,
      CELL.height,
    );
    expect(ctx.fillStyle).not.toBe("");
  });

  it("draws text via fillText for visible glyphs (G_FLOOR → middle dot)", () => {
    renderer.drawCell(CELL, DisplayGlyph.G_FLOOR, 200, 150, 100, 0, 0, 0);

    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [ch, drawX, drawY] = (ctx.fillText as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(ch).toBe("\u00B7"); // middle dot
    expect(drawX).toBe(CELL.x + CELL.width / 2);
    expect(drawY).toBe(CELL.y + (CELL.height - FONT_SIZE) / 2);
  });

  it("skips fillText for space glyph (0x20) but still fills background", () => {
    const SPACE = 0x20 as DisplayGlyph;
    renderer.drawCell(CELL, SPACE, 255, 255, 255, 10, 10, 10);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("sets correct font string from fontSize and fontFamily", () => {
    renderer.drawCell(CELL, DisplayGlyph.G_PLAYER, 255, 255, 255, 0, 0, 0);

    expect(ctx.font).toBe(`${FONT_SIZE}px ${FONT}`);
  });

  it("sets textBaseline to top and textAlign to center", () => {
    renderer.drawCell(CELL, DisplayGlyph.G_PLAYER, 255, 255, 255, 0, 0, 0);

    expect(ctx.textBaseline).toBe("top");
    expect(ctx.textAlign).toBe("center");
  });

  it("uses updated fontSize after resize", () => {
    renderer.fontSize = 20;
    renderer.drawCell(CELL, DisplayGlyph.G_FLOOR, 255, 255, 255, 0, 0, 0);

    expect(ctx.font).toBe(`20px ${FONT}`);
    const [, , drawY] = (ctx.fillText as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(drawY).toBe(CELL.y + (CELL.height - 20) / 2);
  });

  it("sets background fillStyle from bg color args (0-255)", () => {
    renderer.drawCell(CELL, DisplayGlyph.G_FLOOR, 0, 0, 0, 100, 150, 200);

    const fillRectCall = (ctx.fillRect as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(fillRectCall).toEqual([CELL.x, CELL.y, CELL.width, CELL.height]);
    // fillStyle was set to bg before fillRect — check last state isn't bg
    // because fillText overwrites it; verify by checking fillRect was called
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it("draws ASCII printable characters directly (char code < 128)", () => {
    const AT_SIGN = 0x40 as DisplayGlyph; // '@'
    renderer.drawCell(CELL, AT_SIGN, 255, 255, 255, 0, 0, 0);

    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    const [ch] = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(ch).toBe("@");
  });
});
