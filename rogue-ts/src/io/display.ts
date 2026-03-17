/*
 *  io/display.ts — Display buffer operations, coordinate helpers, and cell appearance
 *  Port V2 — rogue-ts
 *
 *  Combined from: ts/src/io/io-display.ts + ts/src/io/io-appearance.ts
 *  Ported from: src/brogue/IO.c + src/brogue/Rogue.h (inline functions)
 *
 *  Functions: clearDisplayBuffer, copyDisplayBuffer, saveDisplayBuffer,
 *             restoreDisplayBuffer, overlayDisplayBuffer, plotCharToBuffer,
 *             locIsInWindow, mapToWindow, mapToWindowX, mapToWindowY,
 *             windowToMapX, windowToMapY, createScreenDisplayBuffer,
 *             createCellDisplayBuffer,
 *             glyphIsWallish, bakeTerrainColors, terrainColorsDancing,
 *             plotCharWithColor, highlightScreenCell, blackOutScreen,
 *             colorOverDungeon, randomAnimateMonster
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { CellDisplayBuffer, ScreenDisplayBuffer, SavedDisplayBuffer, Pos, WindowPos, Color } from "../types/types.js";
import { DisplayGlyph } from "../types/enums.js";
import type { TileType } from "../types/enums.js";
import { COLS, ROWS, STAT_BAR_WIDTH, MESSAGE_LINES } from "../types/constants.js";
import { clamp, cosmeticRandRange } from "../math/rng.js";
import {
    storeColorComponents, colorFromComponents, applyColorAugment, applyColorAverage,
} from "./color.js";

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
            const c = dbuf.cells[i][j];
            c.character = 32 as DisplayGlyph; // space
            c.foreColorComponents[0] = 0;
            c.foreColorComponents[1] = 0;
            c.foreColorComponents[2] = 0;
            c.backColorComponents[0] = 0;
            c.backColorComponents[1] = 0;
            c.backColorComponents[2] = 0;
            c.opacity = 0;
            delete c.tileType;
            delete c.underlyingTerrain;
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
            dst.tileType = src.tileType;
            dst.underlyingTerrain = src.underlyingTerrain;
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

/** Result of overlaying one cell during overlayDisplayBuffer. */
export interface OverlayResult {
    character: DisplayGlyph;
    foreColor: Color;
    backColor: Color;
    x: number;
    y: number;
}

/**
 * Overlay `overBuf` onto `displayBuffer` with per-cell alpha blending.
 * Cells with opacity=0 in the overlay are skipped.
 *
 * C: `overlayDisplayBuffer` in IO.c
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

/**
 * Apply an overlay buffer onto displayBuffer, blending and writing results back.
 * This is the side-effecting version of overlayDisplayBuffer — use this when you
 * need the canvas to reflect the overlay (all context builders, menus, etc.).
 *
 * overlayDisplayBuffer itself is side-effect-free (returns results only) for
 * testability; this wrapper is the correct call for rendering paths.
 */
export function applyOverlay(
    displayBuffer: ScreenDisplayBuffer,
    dbuf: Readonly<ScreenDisplayBuffer>,
): void {
    for (const r of overlayDisplayBuffer(displayBuffer, dbuf)) {
        const cell = displayBuffer.cells[r.x][r.y];
        cell.character = r.character;
        cell.foreColorComponents[0] = clamp(r.foreColor.red, 0, 100);
        cell.foreColorComponents[1] = clamp(r.foreColor.green, 0, 100);
        cell.foreColorComponents[2] = clamp(r.foreColor.blue, 0, 100);
        cell.backColorComponents[0] = clamp(r.backColor.red, 0, 100);
        cell.backColorComponents[1] = clamp(r.backColor.green, 0, 100);
        cell.backColorComponents[2] = clamp(r.backColor.blue, 0, 100);
    }
}

/**
 * Plot a character with fore/back color into a ScreenDisplayBuffer at (x, y).
 * Bakes random color components using the RNG.
 * Optional tileType is stored for tile/hybrid renderer sprite lookup.
 * Optional underlyingTerrain is stored for creature cells (terrain under mob).
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
    tileType?: TileType,
    underlyingTerrain?: TileType,
): void {
    if (!locIsInWindow({ windowX: x, windowY: y })) return;

    const cell = dbuf.cells[x][y];
    cell.foreColorComponents[0] = foreColor.red + cosmeticRandRange(0, foreColor.redRand) + cosmeticRandRange(0, foreColor.rand);
    cell.foreColorComponents[1] = foreColor.green + cosmeticRandRange(0, foreColor.greenRand) + cosmeticRandRange(0, foreColor.rand);
    cell.foreColorComponents[2] = foreColor.blue + cosmeticRandRange(0, foreColor.blueRand) + cosmeticRandRange(0, foreColor.rand);
    cell.backColorComponents[0] = backColor.red + cosmeticRandRange(0, backColor.redRand) + cosmeticRandRange(0, backColor.rand);
    cell.backColorComponents[1] = backColor.green + cosmeticRandRange(0, backColor.greenRand) + cosmeticRandRange(0, backColor.rand);
    cell.backColorComponents[2] = backColor.blue + cosmeticRandRange(0, backColor.blueRand) + cosmeticRandRange(0, backColor.rand);
    cell.character = inputChar;
    if (tileType !== undefined) cell.tileType = tileType;
    else delete cell.tileType;
    if (underlyingTerrain !== undefined) cell.underlyingTerrain = underlyingTerrain;
    else delete cell.underlyingTerrain;
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

// =============================================================================
// Glyph queries (from io-appearance.ts)
// =============================================================================

/**
 * Returns true if the glyph looks like a wall for rendering wall-top tiles.
 *
 * C: `glyphIsWallish` (static) in IO.c
 */
export function glyphIsWallish(glyph: DisplayGlyph): boolean {
    switch (glyph) {
        case DisplayGlyph.G_WALL:
        case DisplayGlyph.G_OPEN_DOOR:
        case DisplayGlyph.G_CLOSED_DOOR:
        case DisplayGlyph.G_UP_STAIRS:
        case DisplayGlyph.G_DOORWAY:
        case DisplayGlyph.G_WALL_TOP:
        case DisplayGlyph.G_LEVER:
        case DisplayGlyph.G_LEVER_PULLED:
        case DisplayGlyph.G_CLOSED_IRON_DOOR:
        case DisplayGlyph.G_OPEN_IRON_DOOR:
        case DisplayGlyph.G_TURRET:
        case DisplayGlyph.G_GRANITE:
        case DisplayGlyph.G_TORCH:
        case DisplayGlyph.G_PORTCULLIS:
            return true;
        default:
            return false;
    }
}

// =============================================================================
// Terrain color baking (from io-appearance.ts)
// =============================================================================

/**
 * Bake the terrain random values into foreground and background colors.
 *
 * C: `bakeTerrainColors` (static) in IO.c
 */
export function bakeTerrainColors(
    foreColor: Color,
    backColor: Color,
    vals: readonly number[],
    trueColorMode: boolean,
): void {
    const neutralColors = [500, 500, 500, 500, 500, 500, 0, 0];
    const v = trueColorMode ? neutralColors : vals;

    const foreRand = Math.trunc(foreColor.rand * v[6] / 1000);
    const backRand = Math.trunc(backColor.rand * v[7] / 1000);

    foreColor.red += Math.trunc(foreColor.redRand * v[0] / 1000) + foreRand;
    foreColor.green += Math.trunc(foreColor.greenRand * v[1] / 1000) + foreRand;
    foreColor.blue += Math.trunc(foreColor.blueRand * v[2] / 1000) + foreRand;
    foreColor.redRand = 0;
    foreColor.greenRand = 0;
    foreColor.blueRand = 0;
    foreColor.rand = 0;

    backColor.red += Math.trunc(backColor.redRand * v[3] / 1000) + backRand;
    backColor.green += Math.trunc(backColor.greenRand * v[4] / 1000) + backRand;
    backColor.blue += Math.trunc(backColor.blueRand * v[5] / 1000) + backRand;
    backColor.redRand = 0;
    backColor.greenRand = 0;
    backColor.blueRand = 0;
    backColor.rand = 0;
}

/** Returns whether either color has colorDances set. */
export function terrainColorsDancing(foreColor: Readonly<Color>, backColor: Readonly<Color>): boolean {
    return foreColor.colorDances || backColor.colorDances;
}

// =============================================================================
// plotCharWithColor — bakes colors into display buffer (from io-appearance.ts)
// =============================================================================

/**
 * Bake random color components and write a character + colors into the
 * main display buffer cell at window position (x, y).
 * Optional tileType is stored for tile/hybrid renderer sprite lookup.
 * Optional underlyingTerrain is stored for creature cells (terrain under mob).
 *
 * C: `plotCharWithColor` in IO.c
 */
export function plotCharWithColor(
    inputChar: DisplayGlyph,
    loc: WindowPos,
    cellForeColor: Readonly<Color>,
    cellBackColor: Readonly<Color>,
    displayBuffer: ScreenDisplayBuffer,
    tileType?: TileType,
    underlyingTerrain?: TileType,
): boolean {
    if (!locIsInWindow(loc)) return false;

    let foreRed = cellForeColor.red;
    let foreGreen = cellForeColor.green;
    let foreBlue = cellForeColor.blue;
    let backRed = cellBackColor.red;
    let backGreen = cellBackColor.green;
    let backBlue = cellBackColor.blue;

    const foreRand = cosmeticRandRange(0, cellForeColor.rand);
    const backRand = cosmeticRandRange(0, cellBackColor.rand);
    foreRed += cosmeticRandRange(0, cellForeColor.redRand) + foreRand;
    foreGreen += cosmeticRandRange(0, cellForeColor.greenRand) + foreRand;
    foreBlue += cosmeticRandRange(0, cellForeColor.blueRand) + foreRand;
    backRed += cosmeticRandRange(0, cellBackColor.redRand) + backRand;
    backGreen += cosmeticRandRange(0, cellBackColor.greenRand) + backRand;
    backBlue += cosmeticRandRange(0, cellBackColor.blueRand) + backRand;

    foreRed = clamp(foreRed, 0, 100);
    foreGreen = clamp(foreGreen, 0, 100);
    foreBlue = clamp(foreBlue, 0, 100);
    backRed = clamp(backRed, 0, 100);
    backGreen = clamp(backGreen, 0, 100);
    backBlue = clamp(backBlue, 0, 100);

    // Collapse to space if fore and back colors are identical and char is not space
    let finalChar = inputChar;
    if (
        inputChar !== (32 as DisplayGlyph) &&
        foreRed === backRed &&
        foreGreen === backGreen &&
        foreBlue === backBlue
    ) {
        finalChar = 32 as DisplayGlyph;
    }

    const target = displayBuffer.cells[loc.windowX][loc.windowY];
    target.character = finalChar;
    target.foreColorComponents[0] = foreRed;
    target.foreColorComponents[1] = foreGreen;
    target.foreColorComponents[2] = foreBlue;
    target.backColorComponents[0] = backRed;
    target.backColorComponents[1] = backGreen;
    target.backColorComponents[2] = backBlue;
    if (tileType !== undefined) target.tileType = tileType;
    else delete target.tileType;
    if (underlyingTerrain !== undefined) target.underlyingTerrain = underlyingTerrain;
    else delete target.underlyingTerrain;

    return true;
}

// =============================================================================
// Highlight / fill operations (from io-appearance.ts)
// =============================================================================

/**
 * Augment the fore and back color components of a single display buffer cell.
 *
 * C: `highlightScreenCell` in IO.c
 */
export function highlightScreenCell(
    x: number,
    y: number,
    highlightColor: Readonly<Color>,
    strength: number,
    displayBuffer: ScreenDisplayBuffer,
): void {
    const cell = displayBuffer.cells[x][y];

    let tempColor = colorFromComponents(cell.foreColorComponents);
    applyColorAugment(tempColor, highlightColor, strength);
    const fore = storeColorComponents(tempColor);
    cell.foreColorComponents[0] = fore[0];
    cell.foreColorComponents[1] = fore[1];
    cell.foreColorComponents[2] = fore[2];

    tempColor = colorFromComponents(cell.backColorComponents);
    applyColorAugment(tempColor, highlightColor, strength);
    const back = storeColorComponents(tempColor);
    cell.backColorComponents[0] = back[0];
    cell.backColorComponents[1] = back[1];
    cell.backColorComponents[2] = back[2];
}

/**
 * Fill the entire screen with black spaces.
 *
 * C: `blackOutScreen` in IO.c
 */
export function blackOutScreen(displayBuffer: ScreenDisplayBuffer): void {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const cell = displayBuffer.cells[i][j];
            cell.character = 32 as DisplayGlyph;
            cell.foreColorComponents[0] = 0;
            cell.foreColorComponents[1] = 0;
            cell.foreColorComponents[2] = 0;
            cell.backColorComponents[0] = 0;
            cell.backColorComponents[1] = 0;
            cell.backColorComponents[2] = 0;
            delete cell.tileType;
            delete cell.underlyingTerrain;
        }
    }
}

/**
 * Fill the dungeon area (DCOLS×DROWS) with a solid color.
 *
 * C: `colorOverDungeon` in IO.c
 */
export function colorOverDungeon(
    color: Readonly<Color>,
    dcols: number,
    drows: number,
    displayBuffer: ScreenDisplayBuffer,
): void {
    for (let i = 0; i < dcols; i++) {
        for (let j = 0; j < drows; j++) {
            const wpos = mapToWindow({ x: i, y: j });
            plotCharWithColor(32 as DisplayGlyph, wpos, color, color, displayBuffer);
        }
    }
}

// =============================================================================
// Random animate monster (from io-appearance.ts)
// =============================================================================

/**
 * Randomly pick an animate, vulnerable monster type index.
 *
 * C: `randomAnimateMonster` (static) in IO.c
 */
export function randomAnimateMonster(
    monsterFlags: readonly number[],
    inanimate: number,
    invulnerable: number,
): number {
    const animate: number[] = [];
    for (let i = 0; i < monsterFlags.length; i++) {
        if (!(monsterFlags[i] & (inanimate | invulnerable))) {
            animate.push(i);
        }
    }

    if (animate.length === 0) return 0;
    return animate[cosmeticRandRange(0, animate.length - 1)];
}
