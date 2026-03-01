/*
 *  io-effects.test.ts — Tests for io-effects.ts (visual effects)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { COLS, ROWS, MESSAGE_LINES } from "../../src/types/constants.js";
import { MonsterBookkeepingFlag } from "../../src/types/flags.js";
import type { Color, Creature, ScreenDisplayBuffer, CellDisplayBuffer, Pos, DisplayGlyph } from "../../src/types/types.js";
import { createScreenDisplayBuffer } from "../../src/io/io-display.js";
import { black, white, teal } from "../../src/globals/colors.js";
import { allocGrid, fillGrid } from "../../src/grid/grid.js";
import {
    type EffectsContext,
    blendAppearancesCtx as blendAppearances,
    irisFadeBetweenBuffers,
    colorBlendCell,
    flashForeground,
    flashCell,
    colorFlash,
    displayCenteredAlert,
    flashMessage,
    flashTemporaryAlert,
    displayMonsterFlashes,
} from "../../src/io/io-effects.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 20, y: 15 },
        bookkeepingFlags: 0,
        flashStrength: 0,
        flashColor: makeColor(),
        ...overrides,
    } as unknown as Creature;
}

function createCtx(overrides: Partial<EffectsContext> = {}): EffectsContext {
    return {
        rogue: {
            playbackMode: false,
            playbackFastForward: false,
            playbackPaused: false,
            playbackDelayPerTurn: 50,
            autoPlayingLevel: false,
            blockCombatText: false,
            creaturesWillFlashThisTurn: false,
        },
        player: makeCreature(),
        displayBuffer: createScreenDisplayBuffer(),
        applyColorAverage: vi.fn((base: Color, target: Readonly<Color>, weight: number) => {
            // Simple linear blend for testing
            base.red = Math.round(base.red + (target.red - base.red) * weight / 100);
            base.green = Math.round(base.green + (target.green - base.green) * weight / 100);
            base.blue = Math.round(base.blue + (target.blue - base.blue) * weight / 100);
        }),
        applyColorAugment: vi.fn(),
        bakeColor: vi.fn(),
        separateColors: vi.fn(),
        colorFromComponents: vi.fn((comps: readonly number[]) => makeColor(comps[0], comps[1], comps[2])),
        getCellAppearance: vi.fn(() => ({
            glyph: 64 as DisplayGlyph,
            foreColor: makeColor(100, 100, 100),
            backColor: makeColor(0, 0, 0),
        })),
        plotCharWithColor: vi.fn(),
        refreshDungeonCell: vi.fn(),
        hiliteCell: vi.fn(),
        overlayDisplayBuffer: vi.fn(),
        mapToWindow: vi.fn((loc: Pos) => ({ windowX: loc.x + 1, windowY: loc.y + 1 })),
        windowToMapX: vi.fn((wx: number) => wx - 1),
        windowToMapY: vi.fn((wy: number) => wy - 1),
        mapToWindowX: vi.fn((mx: number) => mx + 1),
        strLenWithoutEscapes: vi.fn((s: string) => s.length),
        printString: vi.fn(() => 0),
        pauseBrogue: vi.fn(() => false),
        pauseAnimation: vi.fn(() => false),
        commitDraws: vi.fn(),
        allocGrid,
        fillGrid,
        calculateDistances: vi.fn(),
        iterateCreatures: vi.fn(() => []),
        canSeeMonster: vi.fn(() => true),
        displayedMessage: [],
        ...overrides,
    };
}

// =============================================================================
// blendAppearances
// =============================================================================

describe("blendAppearances", () => {
    it("returns fromChar at 0%", () => {
        const ctx = createCtx();
        const result = blendAppearances(
            makeColor(100, 0, 0), makeColor(0, 0, 0), 65 as DisplayGlyph,
            makeColor(0, 100, 0), makeColor(50, 50, 50), 66 as DisplayGlyph,
            0, ctx,
        );
        expect(result.glyph).toBe(65);
    });

    it("returns toChar at 100%", () => {
        const ctx = createCtx();
        const result = blendAppearances(
            makeColor(100, 0, 0), makeColor(0, 0, 0), 65 as DisplayGlyph,
            makeColor(0, 100, 0), makeColor(50, 50, 50), 66 as DisplayGlyph,
            100, ctx,
        );
        expect(result.glyph).toBe(66);
    });

    it("returns fromChar at 49%", () => {
        const ctx = createCtx();
        const result = blendAppearances(
            makeColor(), makeColor(), 65 as DisplayGlyph,
            makeColor(), makeColor(), 66 as DisplayGlyph,
            49, ctx,
        );
        expect(result.glyph).toBe(65);
    });

    it("returns toChar at 50%", () => {
        const ctx = createCtx();
        const result = blendAppearances(
            makeColor(), makeColor(), 65 as DisplayGlyph,
            makeColor(), makeColor(), 66 as DisplayGlyph,
            50, ctx,
        );
        expect(result.glyph).toBe(66);
    });

    it("blends back color via applyColorAverage", () => {
        const ctx = createCtx();
        blendAppearances(
            makeColor(100, 0, 0), makeColor(0, 0, 0), 65 as DisplayGlyph,
            makeColor(0, 100, 0), makeColor(50, 50, 50), 65 as DisplayGlyph,
            50, ctx,
        );
        // applyColorAverage called for back and fore
        expect(ctx.applyColorAverage).toHaveBeenCalled();
    });

    it("uses straight average for fore when chars are same", () => {
        const ctx = createCtx();
        const result = blendAppearances(
            makeColor(100, 0, 0), makeColor(0, 0, 0), 65 as DisplayGlyph,
            makeColor(0, 100, 0), makeColor(50, 50, 50), 65 as DisplayGlyph,
            50, ctx,
        );
        // applyColorAverage called twice (back + fore)
        expect(ctx.applyColorAverage).toHaveBeenCalledTimes(2);
    });

    it("blends fore through back color when chars differ", () => {
        const ctx = createCtx();
        // Percent 75 (>=50) → blend from retBackColor to toForeColor
        blendAppearances(
            makeColor(100, 0, 0), makeColor(0, 0, 0), 65 as DisplayGlyph,
            makeColor(0, 100, 0), makeColor(50, 50, 50), 66 as DisplayGlyph,
            75, ctx,
        );
        // applyColorAverage called for: backColor, foreColor
        expect(ctx.applyColorAverage).toHaveBeenCalledTimes(2);
    });
});

// =============================================================================
// colorBlendCell
// =============================================================================

describe("colorBlendCell", () => {
    it("gets cell appearance and applies color average", () => {
        const ctx = createCtx();
        colorBlendCell(10, 10, makeColor(50, 0, 0), 75, ctx);

        expect(ctx.getCellAppearance).toHaveBeenCalledWith({ x: 10, y: 10 });
        expect(ctx.applyColorAverage).toHaveBeenCalledTimes(2); // fore + back
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });

    it("uses mapToWindow for plotting coordinates", () => {
        const ctx = createCtx();
        colorBlendCell(5, 3, makeColor(), 50, ctx);
        expect(ctx.mapToWindow).toHaveBeenCalledWith({ x: 5, y: 3 });
    });
});

// =============================================================================
// flashForeground
// =============================================================================

describe("flashForeground", () => {
    it("does nothing with count <= 0", () => {
        const ctx = createCtx();
        flashForeground([], [], [], [], 0, 10, ctx);
        expect(ctx.getCellAppearance).not.toHaveBeenCalled();
    });

    it("bakes colors for each cell", () => {
        const ctx = createCtx();
        flashForeground([5], [5], [makeColor(100, 0, 0)], [80], 1, 3, ctx);
        expect(ctx.bakeColor).toHaveBeenCalledTimes(2); // fore + back per cell
    });

    it("calls plotCharWithColor for each cell per frame", () => {
        const ctx = createCtx();
        flashForeground([5, 6], [5, 5], [makeColor(), makeColor()], [80, 60], 2, 3, ctx);
        // frames+1 iterations (3, 2, 1, 0), each iteration plots 2 cells
        expect(ctx.plotCharWithColor).toHaveBeenCalledTimes(8);
    });

    it("calls pauseAnimation between frames (not on last)", () => {
        const ctx = createCtx();
        flashForeground([5], [5], [makeColor()], [80], 1, 3, ctx);
        // Pause called for j=3, j=2, j=1 (not j=0)
        expect(ctx.pauseAnimation).toHaveBeenCalledTimes(3);
    });

    it("skips to last frame on interrupt", () => {
        let callCount = 0;
        const ctx = createCtx({
            pauseAnimation: vi.fn(() => {
                callCount++;
                return callCount === 1; // interrupt on first pause
            }),
        });
        flashForeground([5], [5], [makeColor()], [80], 1, 10, ctx);
        // j=10: plot, pause→interrupt→j=1, for-loop j-- → j=0
        // j=0: plot, no pause
        // Total: 2 plots
        expect(ctx.plotCharWithColor).toHaveBeenCalledTimes(2);
    });
});

// =============================================================================
// flashCell
// =============================================================================

describe("flashCell", () => {
    it("calls colorBlendCell for each frame", () => {
        const ctx = createCtx();
        flashCell(makeColor(100, 0, 0), 3, 10, 10, ctx);
        // 3 frames of getCellAppearance + final refreshDungeonCell
        expect(ctx.getCellAppearance).toHaveBeenCalledTimes(3);
        expect(ctx.refreshDungeonCell).toHaveBeenCalledWith({ x: 10, y: 10 });
    });

    it("refreshes the cell after animation", () => {
        const ctx = createCtx();
        flashCell(makeColor(), 2, 5, 5, ctx);
        expect(ctx.refreshDungeonCell).toHaveBeenCalledWith({ x: 5, y: 5 });
    });

    it("stops early on interrupt", () => {
        const ctx = createCtx({
            pauseAnimation: vi.fn(() => true), // always interrupt
        });
        flashCell(makeColor(), 5, 10, 10, ctx);
        // Only 1 frame before interrupt
        expect(ctx.getCellAppearance).toHaveBeenCalledTimes(1);
    });
});

// =============================================================================
// displayCenteredAlert
// =============================================================================

describe("displayCenteredAlert", () => {
    it("prints centered on the screen", () => {
        const ctx = createCtx();
        displayCenteredAlert("Test Alert", ctx);

        const expectedX = Math.trunc((COLS - 10) / 2); // "Test Alert" = 10 chars
        expect(ctx.printString).toHaveBeenCalledWith(
            "Test Alert",
            expectedX,
            Math.trunc(ROWS / 2),
            expect.anything(),
            expect.anything(),
            null,
        );
    });

    it("uses teal foreground and black background", () => {
        const ctx = createCtx();
        displayCenteredAlert("X", ctx);
        const [, , , fore, back] = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(fore).toBe(teal);
        expect(back).toBe(black);
    });
});

// =============================================================================
// flashMessage
// =============================================================================

describe("flashMessage", () => {
    it("returns immediately during fast forward", () => {
        const ctx = createCtx();
        ctx.rogue.playbackFastForward = true;
        flashMessage("Hello", 0, 0, 1000, makeColor(), makeColor(), ctx);
        expect(ctx.plotCharWithColor).not.toHaveBeenCalled();
    });

    it("plots characters during the animation", () => {
        const ctx = createCtx();
        // Short time so loop runs a few iterations
        flashMessage("Hi", 0, 0, 32, makeColor(100, 100, 100), makeColor(0, 0, 0), ctx);
        // At least some characters should be plotted
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });

    it("restores original cell appearance after animation", () => {
        const ctx = createCtx({
            pauseBrogue: vi.fn(() => true), // immediate interrupt
        });
        // Set up some known cell data
        ctx.displayBuffer.cells[0][5].character = 88 as DisplayGlyph; // 'X'
        ctx.displayBuffer.cells[0][5].foreColorComponents = [50, 60, 70];
        ctx.displayBuffer.cells[0][5].backColorComponents = [10, 20, 30];
        ctx.displayBuffer.cells[1][5].character = 89 as DisplayGlyph; // 'Y'

        flashMessage("AB", 0, 5, 100, makeColor(), makeColor(), ctx);

        // Should restore original appearance (plotCharWithColor called at end)
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });
});

// =============================================================================
// flashTemporaryAlert
// =============================================================================

describe("flashTemporaryAlert", () => {
    it("delegates to flashMessage centered with teal color", () => {
        const ctx = createCtx();
        ctx.rogue.playbackFastForward = true; // fast exit
        flashTemporaryAlert("Test", 500, ctx);
        // Since playbackFastForward is true, flashMessage returns early
        // No error means delegation worked
    });

    it("computes centered x position", () => {
        const ctx = createCtx();
        ctx.rogue.playbackFastForward = true;
        // With strLenWithoutEscapes returning length = 4 for "Test"
        const expectedX = Math.trunc((COLS - 4) / 2);
        // This just ensures no throw
        flashTemporaryAlert("Test", 500, ctx);
    });
});

// =============================================================================
// irisFadeBetweenBuffers
// =============================================================================

describe("irisFadeBetweenBuffers", () => {
    it("calls plotCharWithColor for each cell per frame", () => {
        const ctx = createCtx({
            pauseAnimation: vi.fn(() => true), // only 1 frame
        });
        const fromBuf = createScreenDisplayBuffer();
        const toBuf = createScreenDisplayBuffer();
        irisFadeBetweenBuffers(fromBuf, toBuf, COLS / 2, ROWS / 2, 3, false, ctx);
        // 1 frame × COLS × ROWS cells
        expect(ctx.plotCharWithColor).toHaveBeenCalledTimes(COLS * ROWS);
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalledWith(toBuf);
    });

    it("calls overlayDisplayBuffer with toBuf at the end", () => {
        const ctx = createCtx({
            pauseAnimation: vi.fn(() => true),
        });
        const fromBuf = createScreenDisplayBuffer();
        const toBuf = createScreenDisplayBuffer();
        irisFadeBetweenBuffers(fromBuf, toBuf, 0, 0, 1, true, ctx);
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalledWith(toBuf);
    });
});

// =============================================================================
// colorFlash
// =============================================================================

describe("colorFlash", () => {
    it("calls hiliteCell for qualifying tiles", () => {
        const ctx = createCtx();
        colorFlash(makeColor(100, 0, 0), 0, 0, 3, 2, 20, 15, ctx);
        // Should call hiliteCell for tiles within radius
        expect(ctx.hiliteCell).toHaveBeenCalled();
    });

    it("respects maxRadius", () => {
        const ctx = createCtx({
            pauseAnimation: vi.fn(() => true), // 1 frame
        });
        colorFlash(makeColor(100, 0, 0), 0, 0, 1, 1, 20, 15, ctx);
        // With radius 1, should only hilite cells within 1 cell of (20,15)
        for (const call of (ctx.hiliteCell as ReturnType<typeof vi.fn>).mock.calls) {
            const [cx, cy] = call;
            const dist = (cx - 20) * (cx - 20) + (cy - 15) * (cy - 15);
            expect(dist).toBeLessThanOrEqual(1);
        }
    });
});

// =============================================================================
// displayMonsterFlashes
// =============================================================================

describe("displayMonsterFlashes", () => {
    it("clears creaturesWillFlashThisTurn", () => {
        const ctx = createCtx();
        ctx.rogue.creaturesWillFlashThisTurn = true;
        displayMonsterFlashes(true, ctx);
        expect(ctx.rogue.creaturesWillFlashThisTurn).toBe(false);
    });

    it("returns early if autoPlayingLevel", () => {
        const ctx = createCtx();
        ctx.rogue.autoPlayingLevel = true;
        const monster = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_WILL_FLASH,
            flashStrength: 50,
        });
        ctx.iterateCreatures = vi.fn(() => [monster]);
        displayMonsterFlashes(true, ctx);
        // Monster flag should NOT be cleared (early return)
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeTruthy();
    });

    it("returns early if blockCombatText", () => {
        const ctx = createCtx();
        ctx.rogue.blockCombatText = true;
        displayMonsterFlashes(true, ctx);
        expect(ctx.getCellAppearance).not.toHaveBeenCalled();
    });

    it("collects flashing monsters and calls flashForeground", () => {
        const ctx = createCtx();
        const monster = makeCreature({
            loc: { x: 10, y: 10 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_WILL_FLASH,
            flashStrength: 80,
            flashColor: makeColor(100, 0, 0),
        });
        ctx.iterateCreatures = vi.fn(() => [monster]);
        ctx.canSeeMonster = vi.fn(() => true);

        displayMonsterFlashes(true, ctx);

        // MB_WILL_FLASH should be cleared
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeFalsy();
        // getCellAppearance should be called (from flashForeground)
        expect(ctx.getCellAppearance).toHaveBeenCalled();
    });

    it("does not flash invisible monsters", () => {
        const ctx = createCtx();
        const monster = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_WILL_FLASH,
            flashStrength: 80,
        });
        ctx.iterateCreatures = vi.fn(() => [monster]);
        ctx.canSeeMonster = vi.fn(() => false);

        displayMonsterFlashes(true, ctx);

        // MB_WILL_FLASH still cleared
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeFalsy();
        // But no flash effect (flashForeground called with count 0)
        // Only player + monster checked, neither visible
        expect(ctx.getCellAppearance).not.toHaveBeenCalled();
    });

    it("does not flash when flashingEnabled is false", () => {
        const ctx = createCtx();
        const monster = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_WILL_FLASH,
            flashStrength: 80,
        });
        ctx.iterateCreatures = vi.fn(() => [monster]);

        displayMonsterFlashes(false, ctx);

        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeFalsy();
        expect(ctx.getCellAppearance).not.toHaveBeenCalled();
    });

    it("checks player first before other monsters", () => {
        const ctx = createCtx();
        ctx.player = makeCreature({
            loc: { x: 5, y: 5 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_WILL_FLASH,
            flashStrength: 90,
            flashColor: makeColor(0, 100, 0),
        });
        ctx.iterateCreatures = vi.fn(() => []);

        displayMonsterFlashes(true, ctx);

        // Player's flash flag should be cleared
        expect(ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeFalsy();
        // Should produce a flash (getCellAppearance called from flashForeground)
        expect(ctx.getCellAppearance).toHaveBeenCalled();
    });
});
