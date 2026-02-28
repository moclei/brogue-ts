/*
 *  io-display.ts — Display buffer operations and coordinate helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c + src/brogue/Rogue.h (inline functions)
 *  Functions: clearDisplayBuffer, copyDisplayBuffer, saveDisplayBuffer,
 *             restoreDisplayBuffer, overlayDisplayBuffer,
 *             plotCharToBuffer, mapToWindow, windowToMap,
 *             mapToWindowX, mapToWindowY, windowToMapX, windowToMapY,
 *             locIsInWindow, createScreenDisplayBuffer,
 *             createCellDisplayBuffer
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { CellDisplayBuffer, ScreenDisplayBuffer, SavedDisplayBuffer, Pos, WindowPos, Color } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { COLS, ROWS, STAT_BAR_WIDTH, MESSAGE_LINES } from "../types/constants.js";
import { randRange } from "../math/rng.js";
import { colorFromComponents, applyColorAverage } from "./io-color.js";

// =============================================================================
// Cell / buffer constructors
// =============================================================================

/** Create a fresh CellDisplayBuffer with blank defaults. */
export function createCellDisplayBuffer(): CellDisplayBuffer {
    return {
        character: 32 as DisplayGlyph, // space
        foreColorComponents: [0, 0, 0],
        backColorComponents: [0, 0, 0],
        opacity: 0,
    };
}

/** Create a fresh COLS×ROWS ScreenDisplayBuffer filled with blank cells. */
export function createScreenDisplayBuffer(): ScreenDisplayBuffer {
    const cells: CellDisplayBuffer[][] = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        cells[i] = new Array(ROWS);
        for (let j = 0; j < ROWS; j++) {
            cells[i][j] = createCellDisplayBuffer();
        }
    }
    return { cells };
}

// =============================================================================
// Buffer operations
// =============================================================================

/**
 * Clear a display buffer: set all cells to space, zero all color components,
 * zero opacity.
 *
 * C: `clearDisplayBuffer` in IO.c
 */
export function clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[i][j].character = 32 as DisplayGlyph; // space
            dbuf.cells[i][j].foreColorComponents[0] = 0;
            dbuf.cells[i][j].foreColorComponents[1] = 0;
            dbuf.cells[i][j].foreColorComponents[2] = 0;
            dbuf.cells[i][j].backColorComponents[0] = 0;
            dbuf.cells[i][j].backColorComponents[1] = 0;
            dbuf.cells[i][j].backColorComponents[2] = 0;
            dbuf.cells[i][j].opacity = 0;
        }
    }
}

/**
 * Deep-copy one ScreenDisplayBuffer to another.
 *
 * C: `copyDisplayBuffer` in IO.c
 */
export function copyDisplayBuffer(toBuf: ScreenDisplayBuffer, fromBuf: Readonly<ScreenDisplayBuffer>): void {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const src = fromBuf.cells[i][j];
            const dst = toBuf.cells[i][j];
            dst.character = src.character;
            dst.foreColorComponents[0] = src.foreColorComponents[0];
            dst.foreColorComponents[1] = src.foreColorComponents[1];
            dst.foreColorComponents[2] = src.foreColorComponents[2];
            dst.backColorComponents[0] = src.backColorComponents[0];
            dst.backColorComponents[1] = src.backColorComponents[1];
            dst.backColorComponents[2] = src.backColorComponents[2];
            dst.opacity = src.opacity;
        }
    }
}

/**
 * Save the current display buffer as a SavedDisplayBuffer (deep copy).
 *
 * C: `saveDisplayBuffer` in IO.c
 */
export function saveDisplayBuffer(displayBuffer: Readonly<ScreenDisplayBuffer>): SavedDisplayBuffer {
    const saved = createScreenDisplayBuffer();
    copyDisplayBuffer(saved, displayBuffer);
    return { savedScreen: saved };
}

/**
 * Restore a previously saved display buffer.
 *
 * C: `restoreDisplayBuffer` in IO.c
 */
export function restoreDisplayBuffer(
    displayBuffer: ScreenDisplayBuffer,
    savedBuf: Readonly<SavedDisplayBuffer>,
): void {
    copyDisplayBuffer(displayBuffer, savedBuf.savedScreen);
}

/**
 * Overlay `overBuf` onto `displayBuffer` with per-cell alpha blending.
 * Cells with opacity=0 in the overlay are skipped.
 *
 * Returns an array of `{character, foreColor, backColor, x, y}` for each
 * cell that was composited (the caller decides how to render them).
 *
 * C: `overlayDisplayBuffer` in IO.c — the original calls plotCharWithColor
 * directly; our port decouples computation from rendering.
 */
export function overlayDisplayBuffer(
    displayBuffer: ScreenDisplayBuffer,
    overBuf: Readonly<ScreenDisplayBuffer>,
): OverlayResult[] {
    const results: OverlayResult[] = [];

    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const overCell = overBuf.cells[i][j];
            if (overCell.opacity !== 0) {
                const backColor = colorFromComponents(overCell.backColorComponents);
                let character: DisplayGlyph;
                let foreColor: Color;

                if (overCell.character === (32 as DisplayGlyph)) {
                    // Blank cells in the overbuf take the character from the screen
                    character = displayBuffer.cells[i][j].character;
                    foreColor = colorFromComponents(displayBuffer.cells[i][j].foreColorComponents);
                    applyColorAverage(foreColor, backColor, overCell.opacity);
                } else {
                    character = overCell.character;
                    foreColor = colorFromComponents(overCell.foreColorComponents);
                }

                // Blend back color
                const tempColor = colorFromComponents(displayBuffer.cells[i][j].backColorComponents);
                applyColorAverage(backColor, tempColor, 100 - overCell.opacity);

                results.push({ character, foreColor, backColor, x: i, y: j });
            }
        }
    }

    return results;
}

/** Result of overlaying one cell during overlayDisplayBuffer. */
export interface OverlayResult {
    character: DisplayGlyph;
    foreColor: Color;
    backColor: Color;
    x: number;
    y: number;
}

/**
 * Plot a character with fore/back color into a ScreenDisplayBuffer at (x, y).
 * Bakes random color components using the RNG.
 *
 * C: `plotCharToBuffer` in IO.c
 */
export function plotCharToBuffer(
    inputChar: DisplayGlyph,
    x: number,
    y: number,
    foreColor: Readonly<Color>,
    backColor: Readonly<Color>,
    dbuf: ScreenDisplayBuffer,
): void {
    if (!locIsInWindow({ windowX: x, windowY: y })) return;

    const cell = dbuf.cells[x][y];
    cell.foreColorComponents[0] = foreColor.red + randRange(0, foreColor.redRand) + randRange(0, foreColor.rand);
    cell.foreColorComponents[1] = foreColor.green + randRange(0, foreColor.greenRand) + randRange(0, foreColor.rand);
    cell.foreColorComponents[2] = foreColor.blue + randRange(0, foreColor.blueRand) + randRange(0, foreColor.rand);
    cell.backColorComponents[0] = backColor.red + randRange(0, backColor.redRand) + randRange(0, backColor.rand);
    cell.backColorComponents[1] = backColor.green + randRange(0, backColor.greenRand) + randRange(0, backColor.rand);
    cell.backColorComponents[2] = backColor.blue + randRange(0, backColor.blueRand) + randRange(0, backColor.rand);
    cell.character = inputChar;
}

// =============================================================================
// Coordinate conversion
// =============================================================================

/** Check if a window position is within the terminal bounds. C: `locIsInWindow` in Rogue.h */
export function locIsInWindow(w: WindowPos): boolean {
    return w.windowX >= 0 && w.windowX < COLS && w.windowY >= 0 && w.windowY < ROWS;
}

/** Convert dungeon (map) coordinates to window coordinates. C: `mapToWindow` in Rogue.h */
export function mapToWindow(p: Pos): WindowPos {
    return {
        windowX: p.x + STAT_BAR_WIDTH + 1,
        windowY: p.y + MESSAGE_LINES,
    };
}

/** Convert window coordinates to dungeon (map) coordinates. C: `windowToMap` in Rogue.h */
export function windowToMap(w: WindowPos): Pos {
    return {
        x: w.windowX - STAT_BAR_WIDTH - 1,
        y: w.windowY - MESSAGE_LINES,
    };
}

/** C: `mapToWindowX` macro. */
export function mapToWindowX(x: number): number {
    return x + STAT_BAR_WIDTH + 1;
}

/** C: `mapToWindowY` macro. */
export function mapToWindowY(y: number): number {
    return y + MESSAGE_LINES;
}

/** C: `windowToMapX` macro. */
export function windowToMapX(x: number): number {
    return x - STAT_BAR_WIDTH - 1;
}

/** C: `windowToMapY` macro. */
export function windowToMapY(y: number): number {
    return y - MESSAGE_LINES;
}
