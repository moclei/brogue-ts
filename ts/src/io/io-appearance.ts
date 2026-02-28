/*
 *  io-appearance.ts — Cell appearance rendering primitives
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: glyphIsWallish, bakeTerrainColors, plotCharWithColor,
 *             highlightScreenCell, blackOutScreen, colorOverDungeon,
 *             randomAnimateMonster
 *
 *  The monster-heavy getCellAppearance and refreshDungeonCell functions
 *  are deferred to Step 2 (io-game-ui.ts) since they depend on the full
 *  game state context.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, ScreenDisplayBuffer, WindowPos } from "../types/types.js";
import { DisplayGlyph } from "../types/enums.js";
import { COLS, ROWS } from "../types/constants.js";
import { clamp, randRange } from "../math/rng.js";
import { storeColorComponents, colorFromComponents, applyColorAugment } from "./io-color.js";
import { locIsInWindow, mapToWindow } from "./io-display.js";

// =============================================================================
// Glyph queries
// =============================================================================

/**
 * Returns true if the glyph looks like a wall for the purpose of rendering
 * wall-top tiles above it.
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
// Terrain color baking
// =============================================================================

/**
 * Bake the terrain random values into foreground and background colors.
 * The `terrainRandomValues` grid stores 8 random values per cell in [0, 1000],
 * which are used as scaling factors for the color's random components.
 *
 * C: `bakeTerrainColors` (static) in IO.c
 *
 * @param foreColor - Foreground color (mutated in place)
 * @param backColor - Background color (mutated in place)
 * @param vals - Array of 8 random values [0, 1000] for this cell
 *               Indices 0-2 = fore RGB random, 3-5 = back RGB random,
 *               6 = fore global rand, 7 = back global rand
 * @param trueColorMode - If true, use neutral (500) values for all random terms
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

/**
 * Returns whether either color has `colorDances` set — the caller uses
 * this to set the TERRAIN_COLORS_DANCING flag on the pmap cell.
 */
export function terrainColorsDancing(foreColor: Readonly<Color>, backColor: Readonly<Color>): boolean {
    return foreColor.colorDances || backColor.colorDances;
}

// =============================================================================
// plotCharWithColor — bakes colors into display buffer
// =============================================================================

/**
 * Bake random color components and write a character + colors into the
 * main display buffer cell at window position (x, y).
 *
 * Returns false if the position is out of bounds or rendering was skipped.
 *
 * C: `plotCharWithColor` in IO.c — in C this writes directly into the global
 * `displayBuffer`. In TS, the buffer is passed explicitly.
 */
export function plotCharWithColor(
    inputChar: DisplayGlyph,
    loc: WindowPos,
    cellForeColor: Readonly<Color>,
    cellBackColor: Readonly<Color>,
    displayBuffer: ScreenDisplayBuffer,
): boolean {
    if (!locIsInWindow(loc)) return false;

    let foreRed = cellForeColor.red;
    let foreGreen = cellForeColor.green;
    let foreBlue = cellForeColor.blue;
    let backRed = cellBackColor.red;
    let backGreen = cellBackColor.green;
    let backBlue = cellBackColor.blue;

    const foreRand = randRange(0, cellForeColor.rand);
    const backRand = randRange(0, cellBackColor.rand);
    foreRed += randRange(0, cellForeColor.redRand) + foreRand;
    foreGreen += randRange(0, cellForeColor.greenRand) + foreRand;
    foreBlue += randRange(0, cellForeColor.blueRand) + foreRand;
    backRed += randRange(0, cellBackColor.redRand) + backRand;
    backGreen += randRange(0, cellBackColor.greenRand) + backRand;
    backBlue += randRange(0, cellBackColor.blueRand) + backRand;

    foreRed = clamp(foreRed, 0, 100);
    foreGreen = clamp(foreGreen, 0, 100);
    foreBlue = clamp(foreBlue, 0, 100);
    backRed = clamp(backRed, 0, 100);
    backGreen = clamp(backGreen, 0, 100);
    backBlue = clamp(backBlue, 0, 100);

    // If the fore and back colors are identical and the char isn't a space,
    // collapse to a space (invisible character).
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

    return true;
}

// =============================================================================
// Highlight / fill operations
// =============================================================================

/**
 * Augment the fore and back color components of a single display buffer cell
 * by the highlight color scaled by strength.
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
// Random animate monster (for hallucination effects)
// =============================================================================

/**
 * Randomly pick an animate, vulnerable monster type index.
 * Used by getCellAppearance for hallucination effects.
 *
 * C: `randomAnimateMonster` (static) in IO.c
 *
 * @param monsterFlags - Array of monster flag values from the monster catalog
 * @param inanimate - The MONST_INANIMATE flag value
 * @param invulnerable - The MONST_INVULNERABLE flag value
 * @returns The index of a random animate monster
 */
export function randomAnimateMonster(
    monsterFlags: readonly number[],
    inanimate: number,
    invulnerable: number,
): number {
    // Build filtered list (cached after first call via closure)
    const animate: number[] = [];
    for (let i = 0; i < monsterFlags.length; i++) {
        if (!(monsterFlags[i] & (inanimate | invulnerable))) {
            animate.push(i);
        }
    }

    if (animate.length === 0) return 0;
    return animate[randRange(0, animate.length - 1)];
}
