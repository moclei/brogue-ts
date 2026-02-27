/*
 *  io-appearance.test.ts — Tests for io-appearance.ts (rendering primitives)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { seedRandomGenerator } from "../../src/math/rng.js";
import { COLS, ROWS } from "../../src/types/constants.js";
import { DisplayGlyph } from "../../src/types/enums.js";
import type { Color } from "../../src/types/types.js";
import {
    glyphIsWallish,
    bakeTerrainColors,
    terrainColorsDancing,
    plotCharWithColor,
    highlightScreenCell,
    blackOutScreen,
    colorOverDungeon,
    randomAnimateMonster,
} from "../../src/io/io-appearance.js";
import { createScreenDisplayBuffer, mapToWindow } from "../../src/io/io-display.js";

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
// glyphIsWallish
// =============================================================================

describe("glyphIsWallish", () => {
    it("returns true for wall-like glyphs", () => {
        expect(glyphIsWallish(DisplayGlyph.G_WALL)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_OPEN_DOOR)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_CLOSED_DOOR)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_UP_STAIRS)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_DOORWAY)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_WALL_TOP)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_LEVER)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_LEVER_PULLED)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_CLOSED_IRON_DOOR)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_OPEN_IRON_DOOR)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_TURRET)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_GRANITE)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_TORCH)).toBe(true);
        expect(glyphIsWallish(DisplayGlyph.G_PORTCULLIS)).toBe(true);
    });

    it("returns false for non-wall glyphs", () => {
        expect(glyphIsWallish(DisplayGlyph.G_PLAYER)).toBe(false);
        expect(glyphIsWallish(DisplayGlyph.G_FOOD)).toBe(false);
        expect(glyphIsWallish(DisplayGlyph.G_POTION)).toBe(false);
        expect(glyphIsWallish(DisplayGlyph.G_DOWN_STAIRS)).toBe(false);
        expect(glyphIsWallish(DisplayGlyph.G_GRASS)).toBe(false);
    });
});

// =============================================================================
// bakeTerrainColors
// =============================================================================

describe("bakeTerrainColors", () => {
    it("applies terrain random values to color channels", () => {
        const fore = makeColor(50, 50, 50, 20, 30, 40, 10);
        const back = makeColor(10, 10, 10, 5, 5, 5, 5);
        // vals[0..2] scale foreRedRand, foreGreenRand, foreBlueRand
        // vals[3..5] scale backRedRand, backGreenRand, backBlueRand
        // vals[6] scales fore.rand, vals[7] scales back.rand
        const vals = [500, 500, 500, 500, 500, 500, 500, 500];

        bakeTerrainColors(fore, back, vals, false);

        // fore.red = 50 + 20*500/1000 + 10*500/1000 = 50 + 10 + 5 = 65
        expect(fore.red).toBe(65);
        expect(fore.green).toBe(70); // 50 + 30*500/1000 + 5 = 50 + 15 + 5 = 70
        expect(fore.blue).toBe(75);  // 50 + 40*500/1000 + 5 = 50 + 20 + 5 = 75
        expect(fore.redRand).toBe(0);
        expect(fore.greenRand).toBe(0);
        expect(fore.blueRand).toBe(0);
        expect(fore.rand).toBe(0);
    });

    it("uses neutral values (500) in trueColorMode", () => {
        const fore = makeColor(50, 50, 50, 20, 20, 20, 10);
        const back = makeColor(10, 10, 10, 5, 5, 5, 5);
        const vals = [0, 0, 0, 0, 0, 0, 0, 0]; // these should be ignored

        bakeTerrainColors(fore, back, vals, true);

        // neutralColors = [500, 500, 500, 500, 500, 500, 0, 0]
        // foreRand = trunc(10 * 0 / 1000) = 0  (neutral[6] = 0)
        // fore.red = 50 + trunc(20 * 500 / 1000) + 0 = 50 + 10 = 60
        expect(fore.red).toBe(60);
        expect(fore.green).toBe(60);
        expect(fore.blue).toBe(60);
        // backRand = trunc(5 * 0 / 1000) = 0  (neutral[7] = 0)
        // back.red = 10 + trunc(5 * 500 / 1000) + 0 = 10 + 2 = 12
        expect(back.red).toBe(12);
    });

    it("zeroes all random fields after baking", () => {
        const fore = makeColor(0, 0, 0, 50, 50, 50, 50, true);
        const back = makeColor(0, 0, 0, 50, 50, 50, 50, false);
        bakeTerrainColors(fore, back, [500, 500, 500, 500, 500, 500, 500, 500], false);

        expect(fore.redRand).toBe(0);
        expect(fore.greenRand).toBe(0);
        expect(fore.blueRand).toBe(0);
        expect(fore.rand).toBe(0);
        expect(back.redRand).toBe(0);
        expect(back.greenRand).toBe(0);
        expect(back.blueRand).toBe(0);
        expect(back.rand).toBe(0);
    });
});

// =============================================================================
// terrainColorsDancing
// =============================================================================

describe("terrainColorsDancing", () => {
    it("returns true if either color dances", () => {
        expect(terrainColorsDancing(makeColor(0, 0, 0, 0, 0, 0, 0, true), makeColor())).toBe(true);
        expect(terrainColorsDancing(makeColor(), makeColor(0, 0, 0, 0, 0, 0, 0, true))).toBe(true);
    });

    it("returns false if neither color dances", () => {
        expect(terrainColorsDancing(makeColor(), makeColor())).toBe(false);
    });
});

// =============================================================================
// plotCharWithColor
// =============================================================================

describe("plotCharWithColor", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("writes character and clamped colors to the display buffer", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(80, 40, 20);
        const back = makeColor(10, 5, 2);

        const result = plotCharWithColor(65 as DisplayGlyph, { windowX: 10, windowY: 10 }, fore, back, buf);
        expect(result).toBe(true);
        expect(buf.cells[10][10].character).toBe(65);
        expect(buf.cells[10][10].foreColorComponents[0]).toBe(80);
        expect(buf.cells[10][10].foreColorComponents[1]).toBe(40);
        expect(buf.cells[10][10].foreColorComponents[2]).toBe(20);
        expect(buf.cells[10][10].backColorComponents[0]).toBe(10);
        expect(buf.cells[10][10].backColorComponents[1]).toBe(5);
        expect(buf.cells[10][10].backColorComponents[2]).toBe(2);
    });

    it("returns false for out-of-bounds positions", () => {
        const buf = createScreenDisplayBuffer();
        const c = makeColor(50, 50, 50);
        expect(plotCharWithColor(65 as DisplayGlyph, { windowX: -1, windowY: 0 }, c, c, buf)).toBe(false);
        expect(plotCharWithColor(65 as DisplayGlyph, { windowX: COLS, windowY: 0 }, c, c, buf)).toBe(false);
    });

    it("collapses to space when fore and back colors are identical", () => {
        const buf = createScreenDisplayBuffer();
        const c = makeColor(50, 50, 50);
        plotCharWithColor(65 as DisplayGlyph, { windowX: 5, windowY: 5 }, c, c, buf);
        expect(buf.cells[5][5].character).toBe(32); // space
    });

    it("keeps character when fore and back differ", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(100, 0, 0);
        const back = makeColor(0, 0, 0);
        plotCharWithColor(65 as DisplayGlyph, { windowX: 5, windowY: 5 }, fore, back, buf);
        expect(buf.cells[5][5].character).toBe(65);
    });

    it("clamps color values to [0, 100]", () => {
        const buf = createScreenDisplayBuffer();
        const fore = makeColor(200, -50, 50);
        const back = makeColor(0, 0, 0);
        plotCharWithColor(65 as DisplayGlyph, { windowX: 5, windowY: 5 }, fore, back, buf);
        expect(buf.cells[5][5].foreColorComponents[0]).toBe(100);
        expect(buf.cells[5][5].foreColorComponents[1]).toBe(0);
        expect(buf.cells[5][5].foreColorComponents[2]).toBe(50);
    });
});

// =============================================================================
// highlightScreenCell
// =============================================================================

describe("highlightScreenCell", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("augments fore and back colors by highlight * strength", () => {
        const buf = createScreenDisplayBuffer();
        buf.cells[10][10].foreColorComponents = [50, 50, 50];
        buf.cells[10][10].backColorComponents = [20, 20, 20];

        const highlight = makeColor(100, 0, 0); // red highlight
        highlightScreenCell(10, 10, highlight, 50, buf);

        // Fore: 50 + 100*50/100 = 100, clamped to 100
        expect(buf.cells[10][10].foreColorComponents[0]).toBe(100);
        // Back: 20 + 100*50/100 = 70
        expect(buf.cells[10][10].backColorComponents[0]).toBe(70);
        // Green channel unchanged: 50 + 0*50/100 = 50
        expect(buf.cells[10][10].foreColorComponents[1]).toBe(50);
    });
});

// =============================================================================
// blackOutScreen
// =============================================================================

describe("blackOutScreen", () => {
    it("fills entire screen with blank black cells", () => {
        const buf = createScreenDisplayBuffer();
        // Dirty some cells
        buf.cells[50][20].character = 65 as DisplayGlyph;
        buf.cells[50][20].foreColorComponents = [100, 100, 100];

        blackOutScreen(buf);

        expect(buf.cells[50][20].character).toBe(32);
        expect(buf.cells[50][20].foreColorComponents).toEqual([0, 0, 0]);
        expect(buf.cells[50][20].backColorComponents).toEqual([0, 0, 0]);
    });

    it("affects all cells", () => {
        const buf = createScreenDisplayBuffer();
        for (let i = 0; i < COLS; i++) {
            buf.cells[i][0].foreColorComponents = [100, 100, 100];
        }
        blackOutScreen(buf);
        for (let i = 0; i < COLS; i++) {
            expect(buf.cells[i][0].foreColorComponents).toEqual([0, 0, 0]);
        }
    });
});

// =============================================================================
// colorOverDungeon
// =============================================================================

describe("colorOverDungeon", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("fills the dungeon area with the given color", () => {
        const buf = createScreenDisplayBuffer();
        const color = makeColor(100, 50, 25);

        colorOverDungeon(color, 5, 5, buf);

        // Check a cell in the dungeon area — mapToWindow({0,0}) = {21, 3}
        const wpos = mapToWindow({ x: 0, y: 0 });
        expect(buf.cells[wpos.windowX][wpos.windowY].foreColorComponents[0]).toBe(100);
        expect(buf.cells[wpos.windowX][wpos.windowY].backColorComponents[0]).toBe(100);
    });
});

// =============================================================================
// randomAnimateMonster
// =============================================================================

describe("randomAnimateMonster", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    const MONST_INANIMATE = 1;
    const MONST_INVULNERABLE = 2;

    it("returns index of an animate, vulnerable monster", () => {
        // flags: [inanimate, normal, invulnerable, normal, both]
        const flags = [MONST_INANIMATE, 0, MONST_INVULNERABLE, 0, MONST_INANIMATE | MONST_INVULNERABLE];
        const result = randomAnimateMonster(flags, MONST_INANIMATE, MONST_INVULNERABLE);
        // Only indices 1 and 3 are valid
        expect([1, 3]).toContain(result);
    });

    it("returns 0 for empty catalog", () => {
        expect(randomAnimateMonster([], MONST_INANIMATE, MONST_INVULNERABLE)).toBe(0);
    });

    it("returns 0 when all monsters are excluded", () => {
        const flags = [MONST_INANIMATE, MONST_INVULNERABLE, MONST_INANIMATE | MONST_INVULNERABLE];
        expect(randomAnimateMonster(flags, MONST_INANIMATE, MONST_INVULNERABLE)).toBe(0);
    });
});
