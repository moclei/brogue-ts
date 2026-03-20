/*
 *  text-renderer.ts — TextRenderer: fills background + draws Unicode glyphs
 *  brogue-ts
 *
 *  Extracted from the text path of plotChar() in browser-renderer.ts.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { DisplayGlyph } from "../types/enums.js";
import type { Renderer, CellRect } from "./renderer.js";
import { glyphToUnicode } from "./glyph-map.js";

/**
 * TextRenderer — draws cells as colored Unicode glyphs on a filled background.
 *
 * Implements the Renderer interface. Each `drawCell` call:
 *   1. Fills the cell rectangle with the background color.
 *   2. If the glyph is visible (code point > U+0020), draws the character
 *      centered in the cell using the foreground color.
 */
export class TextRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fontFamily: string;

  /** Current font size in CSS pixels. Updated by the console on resize. */
  fontSize: number;

  constructor(
    ctx: CanvasRenderingContext2D,
    fontFamily: string,
    fontSize: number,
  ) {
    this.ctx = ctx;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
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
  ): void {
    const { x, y, width, height } = cellRect;
    const ctx = this.ctx;

    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(x, y, width, height);

    const unicode = glyphToUnicode(glyph);
    if (unicode > 0x20) {
      const ch = String.fromCodePoint(unicode);
      ctx.fillStyle = `rgb(${fgR},${fgG},${fgB})`;
      ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      ctx.fillText(ch, x + width / 2, y + (height - this.fontSize) / 2);
    }
  }
}
