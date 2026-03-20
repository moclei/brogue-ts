/*
 *  cell-sizing.test.ts — Tests for progressive integer-division cell sizing
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - cellLeftEdge(0) == 0, cellLeftEdge(cols) == canvasWidth (full coverage)
 *   - cellTopEdge(0) == 0, cellTopEdge(rows) == canvasHeight
 *   - All cell widths are either floor(w/cols) or floor(w/cols)+1
 *   - getCellRect returns gap-free, non-overlapping rects
 *   - pixelToCellCoord maps the first pixel of each cell to that cell
 *   - pixelToCellCoord clamps negative coords to (0,0)
 *   - Non-divisible canvas sizes (e.g. 1593×547 for 100×34)
 */

import { describe, it, expect } from "vitest";
import {
  cellLeftEdge,
  cellTopEdge,
  cellRect,
  pixelToCellCoord,
} from "../../src/platform/browser-renderer.js";

const COLS = 100;
const ROWS = 34;

describe("cellLeftEdge / cellTopEdge", () => {
  it("first edge is 0", () => {
    expect(cellLeftEdge(0, 1600, COLS)).toBe(0);
    expect(cellTopEdge(0, 544, ROWS)).toBe(0);
  });

  it("last edge equals canvas dimension (evenly divisible)", () => {
    expect(cellLeftEdge(COLS, 1600, COLS)).toBe(1600);
    expect(cellTopEdge(ROWS, 544, ROWS)).toBe(544);
  });

  it("last edge equals canvas dimension (non-divisible width)", () => {
    expect(cellLeftEdge(COLS, 1593, COLS)).toBe(1593);
    expect(cellTopEdge(ROWS, 547, ROWS)).toBe(547);
  });

  it("edges are monotonically increasing", () => {
    const w = 1593;
    for (let c = 1; c <= COLS; c++) {
      expect(cellLeftEdge(c, w, COLS)).toBeGreaterThan(cellLeftEdge(c - 1, w, COLS));
    }
    const h = 547;
    for (let r = 1; r <= ROWS; r++) {
      expect(cellTopEdge(r, h, ROWS)).toBeGreaterThan(cellTopEdge(r - 1, h, ROWS));
    }
  });
});

describe("cell widths and heights", () => {
  it.each([1600, 1593, 1920, 800, 1001])("widths are floor(w/cols) or floor(w/cols)+1 for w=%i", (w) => {
    const baseW = Math.floor(w / COLS);
    for (let c = 0; c < COLS; c++) {
      const cw = cellLeftEdge(c + 1, w, COLS) - cellLeftEdge(c, w, COLS);
      expect(cw).toBeGreaterThanOrEqual(baseW);
      expect(cw).toBeLessThanOrEqual(baseW + 1);
    }
  });

  it.each([544, 547, 1080, 768, 341])("heights are floor(h/rows) or floor(h/rows)+1 for h=%i", (h) => {
    const baseH = Math.floor(h / ROWS);
    for (let r = 0; r < ROWS; r++) {
      const ch = cellTopEdge(r + 1, h, ROWS) - cellTopEdge(r, h, ROWS);
      expect(ch).toBeGreaterThanOrEqual(baseH);
      expect(ch).toBeLessThanOrEqual(baseH + 1);
    }
  });

  it("sum of all cell widths equals canvas width (1593)", () => {
    const w = 1593;
    let sum = 0;
    for (let c = 0; c < COLS; c++) {
      sum += cellLeftEdge(c + 1, w, COLS) - cellLeftEdge(c, w, COLS);
    }
    expect(sum).toBe(w);
  });

  it("sum of all cell heights equals canvas height (547)", () => {
    const h = 547;
    let sum = 0;
    for (let r = 0; r < ROWS; r++) {
      sum += cellTopEdge(r + 1, h, ROWS) - cellTopEdge(r, h, ROWS);
    }
    expect(sum).toBe(h);
  });
});

describe("cellRect", () => {
  it("returns correct rect for cell (0,0)", () => {
    const r = cellRect(0, 0, 1600, 544, COLS, ROWS);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.width).toBe(16); // 1600/100
    expect(r.height).toBe(16); // 544/34
  });

  it("rects tile the canvas with no gaps (non-divisible)", () => {
    const w = 1593;
    const h = 547;

    // Verify horizontal: each row of cells covers [0, w) with no gap/overlap
    for (let c = 0; c < COLS; c++) {
      const r = cellRect(c, 0, w, h, COLS, ROWS);
      if (c === 0) expect(r.x).toBe(0);
      if (c < COLS - 1) {
        const next = cellRect(c + 1, 0, w, h, COLS, ROWS);
        expect(r.x + r.width).toBe(next.x);
      } else {
        expect(r.x + r.width).toBe(w);
      }
    }

    // Verify vertical: each column of cells covers [0, h) with no gap/overlap
    for (let r = 0; r < ROWS; r++) {
      const rect = cellRect(0, r, w, h, COLS, ROWS);
      if (r === 0) expect(rect.y).toBe(0);
      if (r < ROWS - 1) {
        const next = cellRect(0, r + 1, w, h, COLS, ROWS);
        expect(rect.y + rect.height).toBe(next.y);
      } else {
        expect(rect.y + rect.height).toBe(h);
      }
    }
  });

  it("adjacent cells share edges (no gap, no overlap)", () => {
    const w = 1593;
    for (let c = 0; c < COLS - 1; c++) {
      const r1 = cellRect(c, 0, w, 544, COLS, ROWS);
      const r2 = cellRect(c + 1, 0, w, 544, COLS, ROWS);
      expect(r1.x + r1.width).toBe(r2.x);
    }
  });
});

describe("pixelToCellCoord", () => {
  it("maps first pixel of each cell to that cell (evenly divisible)", () => {
    const w = 1600;
    const h = 544;
    for (let c = 0; c < COLS; c++) {
      const px = cellLeftEdge(c, w, COLS);
      expect(pixelToCellCoord(px, 0, w, h, COLS, ROWS).x).toBe(c);
    }
    for (let r = 0; r < ROWS; r++) {
      const py = cellTopEdge(r, h, ROWS);
      expect(pixelToCellCoord(0, py, w, h, COLS, ROWS).y).toBe(r);
    }
  });

  it("maps first pixel of each cell to that cell (non-divisible)", () => {
    const w = 1593;
    const h = 547;
    for (let c = 0; c < COLS; c++) {
      const px = cellLeftEdge(c, w, COLS);
      expect(pixelToCellCoord(px, 0, w, h, COLS, ROWS).x).toBe(c);
    }
    for (let r = 0; r < ROWS; r++) {
      const py = cellTopEdge(r, h, ROWS);
      expect(pixelToCellCoord(0, py, w, h, COLS, ROWS).y).toBe(r);
    }
  });

  it("maps last pixel of each cell to that cell", () => {
    const w = 1593;
    const h = 547;
    for (let c = 0; c < COLS; c++) {
      const lastPx = cellLeftEdge(c + 1, w, COLS) - 1;
      expect(pixelToCellCoord(lastPx, 0, w, h, COLS, ROWS).x).toBe(c);
    }
  });

  it("clamps negative coordinates to (0, 0)", () => {
    const result = pixelToCellCoord(-10, -5, 1600, 544, COLS, ROWS);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it("clamps coordinates beyond canvas to last cell", () => {
    const result = pixelToCellCoord(2000, 1000, 1600, 544, COLS, ROWS);
    expect(result.x).toBe(COLS - 1);
    expect(result.y).toBe(ROWS - 1);
  });

  it("maps pixel at canvas edge to last cell", () => {
    const w = 1593;
    const h = 547;
    const result = pixelToCellCoord(w - 1, h - 1, w, h, COLS, ROWS);
    expect(result.x).toBe(COLS - 1);
    expect(result.y).toBe(ROWS - 1);
  });
});
