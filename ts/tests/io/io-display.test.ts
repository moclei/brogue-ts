/*
 *  io-display.test.ts — Tests for io-display.ts (display buffer operations)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { seedRandomGenerator } from "../../src/math/rng.js";
import { COLS, ROWS, STAT_BAR_WIDTH, MESSAGE_LINES } from "../../src/types/constants.js";
import type { Color, CellDisplayBuffer, ScreenDisplayBuffer } from "../../src/types/types.js";
import type { DisplayGlyph } from "../../src/types/enums.js";
import {
    createCellDisplayBuffer,
    createScreenDisplayBuffer,
    clearDisplayBuffer,
    copyDisplayBuffer,
    saveDisplayBuffer,
    restoreDisplayBuffer,
    overlayDisplayBuffer,
    plotCharToBuffer,
    locIsInWindow,
    mapToWindow,
    windowToMap,
    mapToWindowX,
    mapToWindowY,
    windowToMapX,
    windowToMapY,
} from "../../src/io/io-display.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(
    red = 0, green = 0, blue = 0,
    redRand = 0, greenRand = 0, blueRand = 0,
    rand = 0, colorDances = false,
): Color {
    return { red, green, blue, redRand, greenRand, blueRand, rand, colorDances };
}

// =============================================================================
// createCellDisplayBuffer
// =============================================================================

describe("createCellDisplayBuffer", () => {
    it("creates a blank cell with space character", () => {
        const cell = createCellDisplayBuffer();
        expect(cell.character).toBe(32); // space
        expect(cell.foreColorComponents).toEqual([0, 0, 0]);
        expect(cell.backColorComponents).toEqual([0, 0, 0]);
        expect(cell.opacity).toBe(0);
    });
});

// =============================================================================
// createScreenDisplayBuffer
// =============================================================================

describe("createScreenDisplayBuffer", () => {
    it("creates a COLS×ROWS buffer", () => {
        const buf = createScreenDisplayBuffer();
        expect(buf.cells.length).toBe(COLS);
        expect(buf.cells[0].length).toBe(ROWS);
    });

    it("all cells are blank", () => {
        const buf = createScreenDisplayBuffer();
        for (let i = 0; i < COLS; i++) {
            for (let j = 0; j < ROWS; j++) {
                expect(buf.cells[i][j].character).toBe(32);
                expect(buf.cells[i][j].opacity).toBe(0);
            }
        }
    });
});

// =============================================================================
// clearDisplayBuffer
// =============================================================================

describe("clearDisplayBuffer", () => {
    it("resets all cells to blank", () => {
        const buf = createScreenDisplayBuffer();
        // Dirty some cells
        buf.cells[5][5].character = 65 as DisplayGlyph;
        buf.cells[5][5].foreColorComponents = [100, 50, 25];
        buf.cells[5][5].backColorComponents = [10, 20, 30];
        buf.cells[5][5].opacity = 80;

        clearDisplayBuffer(buf);
        expect(buf.cells[5][5].character).toBe(32);
        expect(buf.cells[5][5].foreColorComponents).toEqual([0, 0, 0]);
        expect(buf.cells[5][5].backColorComponents).toEqual([0, 0, 0]);
        expect(buf.cells[5][5].opacity).toBe(0);
    });
});

// =============================================================================
// copyDisplayBuffer
// =============================================================================

describe("copyDisplayBuffer", () => {
    it("copies all cell data from source to destination", () => {
        const src = createScreenDisplayBuffer();
        src.cells[10][10].character = 88 as DisplayGlyph;
        src.cells[10][10].foreColorComponents = [50, 60, 70];
        src.cells[10][10].backColorComponents = [10, 20, 30];
        src.cells[10][10].opacity = 95;

        const dst = createScreenDisplayBuffer();
        copyDisplayBuffer(dst, src);

        expect(dst.cells[10][10].character).toBe(88);
        expect(dst.cells[10][10].foreColorComponents).toEqual([50, 60, 70]);
        expect(dst.cells[10][10].backColorComponents).toEqual([10, 20, 30]);
        expect(dst.cells[10][10].opacity).toBe(95);
    });

    it("creates independent copy (modifying source doesn't affect dest)", () => {
        const src = createScreenDisplayBuffer();
        src.cells[0][0].character = 65 as DisplayGlyph;

        const dst = createScreenDisplayBuffer();
        copyDisplayBuffer(dst, src);

        src.cells[0][0].character = 66 as DisplayGlyph;
        expect(dst.cells[0][0].character).toBe(65);
    });
});

// =============================================================================
// saveDisplayBuffer / restoreDisplayBuffer
// =============================================================================

describe("saveDisplayBuffer / restoreDisplayBuffer", () => {
    it("round-trips buffer state", () => {
        const buf = createScreenDisplayBuffer();
        buf.cells[20][15].character = 42 as DisplayGlyph;
        buf.cells[20][15].foreColorComponents = [80, 40, 20];

        const saved = saveDisplayBuffer(buf);

        // Modify the original
        clearDisplayBuffer(buf);
        expect(buf.cells[20][15].character).toBe(32);

        // Restore
        restoreDisplayBuffer(buf, saved);
        expect(buf.cells[20][15].character).toBe(42);
        expect(buf.cells[20][15].foreColorComponents).toEqual([80, 40, 20]);
    });
});

// =============================================================================
// overlayDisplayBuffer
// =============================================================================

describe("overlayDisplayBuffer", () => {
    it("skips cells with opacity 0", () => {
        const base = createScreenDisplayBuffer();
        const overlay = createScreenDisplayBuffer();
        // No opacity set → no results
        const results = overlayDisplayBuffer(base, overlay);
        expect(results.length).toBe(0);
    });

    it("composites cells with opacity > 0", () => {
        const base = createScreenDisplayBuffer();
        base.cells[5][5].character = 65 as DisplayGlyph;
        base.cells[5][5].foreColorComponents = [100, 0, 0];
        base.cells[5][5].backColorComponents = [0, 0, 0];

        const overlay = createScreenDisplayBuffer();
        overlay.cells[5][5].character = 66 as DisplayGlyph;
        overlay.cells[5][5].foreColorComponents = [0, 100, 0];
        overlay.cells[5][5].backColorComponents = [50, 50, 50];
        overlay.cells[5][5].opacity = 100;

        const results = overlayDisplayBuffer(base, overlay);
        expect(results.length).toBe(1);
        expect(results[0].x).toBe(5);
        expect(results[0].y).toBe(5);
        expect(results[0].character).toBe(66);
    });

    it("uses base character when overlay cell is space", () => {
        const base = createScreenDisplayBuffer();
        base.cells[5][5].character = 65 as DisplayGlyph;
        base.cells[5][5].foreColorComponents = [100, 0, 0];

        const overlay = createScreenDisplayBuffer();
        overlay.cells[5][5].character = 32 as DisplayGlyph; // space
        overlay.cells[5][5].backColorComponents = [0, 100, 0];
        overlay.cells[5][5].opacity = 50;

        const results = overlayDisplayBuffer(base, overlay);
        expect(results[0].character).toBe(65); // takes from base
    });
});

// =============================================================================
// plotCharToBuffer
// =============================================================================

describe("plotCharToBuffer", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("writes character and color components to the buffer cell", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(50, 60, 70);
        const back = makeColor(10, 20, 30);

        plotCharToBuffer(65 as DisplayGlyph, 10, 10, fore, back, buf);

        expect(buf.cells[10][10].character).toBe(65);
        expect(buf.cells[10][10].foreColorComponents[0]).toBe(50);
        expect(buf.cells[10][10].foreColorComponents[1]).toBe(60);
        expect(buf.cells[10][10].foreColorComponents[2]).toBe(70);
        expect(buf.cells[10][10].backColorComponents[0]).toBe(10);
        expect(buf.cells[10][10].backColorComponents[1]).toBe(20);
        expect(buf.cells[10][10].backColorComponents[2]).toBe(30);
    });

    it("applies random color components", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(50, 50, 50, 20, 20, 20, 10);
        const back = makeColor(10, 10, 10);

        plotCharToBuffer(65 as DisplayGlyph, 10, 10, fore, back, buf);

        // With random components, the values should be >= base
        expect(buf.cells[10][10].foreColorComponents[0]).toBeGreaterThanOrEqual(50);
    });

    it("does nothing for out-of-bounds coordinates", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(50, 50, 50);
        const back = makeColor(10, 10, 10);

        plotCharToBuffer(65 as DisplayGlyph, -1, 0, fore, back, buf);
        plotCharToBuffer(65 as DisplayGlyph, COLS, 0, fore, back, buf);
        // Should not throw
    });
});

// =============================================================================
// Coordinate conversion
// =============================================================================

describe("coordinate conversion", () => {
    describe("mapToWindow / windowToMap", () => {
        it("round-trips map → window → map", () => {
            const pos = { x: 10, y: 15 };
            const wpos = mapToWindow(pos);
            const back = windowToMap(wpos);
            expect(back.x).toBe(pos.x);
            expect(back.y).toBe(pos.y);
        });

        it("applies correct offsets", () => {
            const wpos = mapToWindow({ x: 0, y: 0 });
            expect(wpos.windowX).toBe(STAT_BAR_WIDTH + 1);
            expect(wpos.windowY).toBe(MESSAGE_LINES);
        });
    });

    describe("mapToWindowX / mapToWindowY", () => {
        it("adds STAT_BAR_WIDTH + 1 to x", () => {
            expect(mapToWindowX(0)).toBe(STAT_BAR_WIDTH + 1);
            expect(mapToWindowX(10)).toBe(10 + STAT_BAR_WIDTH + 1);
        });

        it("adds MESSAGE_LINES to y", () => {
            expect(mapToWindowY(0)).toBe(MESSAGE_LINES);
            expect(mapToWindowY(5)).toBe(5 + MESSAGE_LINES);
        });
    });

    describe("windowToMapX / windowToMapY", () => {
        it("inverse of mapToWindowX", () => {
            expect(windowToMapX(mapToWindowX(10))).toBe(10);
        });

        it("inverse of mapToWindowY", () => {
            expect(windowToMapY(mapToWindowY(5))).toBe(5);
        });
    });

    describe("locIsInWindow", () => {
        it("returns true for valid window coordinates", () => {
            expect(locIsInWindow({ windowX: 0, windowY: 0 })).toBe(true);
            expect(locIsInWindow({ windowX: COLS - 1, windowY: ROWS - 1 })).toBe(true);
        });

        it("returns false for out-of-bounds coordinates", () => {
            expect(locIsInWindow({ windowX: -1, windowY: 0 })).toBe(false);
            expect(locIsInWindow({ windowX: COLS, windowY: 0 })).toBe(false);
            expect(locIsInWindow({ windowX: 0, windowY: -1 })).toBe(false);
            expect(locIsInWindow({ windowX: 0, windowY: ROWS })).toBe(false);
        });
    });
});
