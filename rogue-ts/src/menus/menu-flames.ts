/*
 *  menus/menu-flames.ts — Animated fire simulation for the title screen
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/main-menu.ts (lines 354–638)
 *  Source C: src/brogue/MainMenu.c (functions: initializeMenuFlames,
 *             updateMenuFlames, drawMenuFlames, antiAlias)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, ScreenDisplayBuffer } from "../types/types.js";
import { GameMode } from "../types/enums.js";
import type { DisplayGlyph } from "../types/enums.js";
import { COLS, ROWS } from "../types/constants.js";
import type {
    FlameGrid,
    ColorSource,
    FlameColorGrid,
    FlameMask,
    MenuContext,
} from "./menu-types.js";
import {
    MENU_FLAME_PRECISION_FACTOR,
    MENU_FLAME_RISE_SPEED,
    MENU_FLAME_SPREAD_SPEED,
    MENU_FLAME_COLOR_DRIFT_SPEED,
    MENU_FLAME_FADE_SPEED,
    MENU_FLAME_ROW_PADDING,
    MENU_FLAME_COLOR_SOURCE_COUNT,
    MENU_FLAME_DENOMINATOR,
} from "./menu-types.js";

const MENU_TITLE_OFFSET_X = -7;
const MENU_TITLE_OFFSET_Y = -2;

// =============================================================================
// Grid factory helpers
// =============================================================================

/** Create a zeroed flame grid. */
export function createFlameGrid(): FlameGrid {
    const grid: FlameGrid = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        grid[i] = new Array(ROWS + MENU_FLAME_ROW_PADDING);
        for (let j = 0; j < ROWS + MENU_FLAME_ROW_PADDING; j++) {
            grid[i][j] = [0, 0, 0];
        }
    }
    return grid;
}

/** Create a zeroed flame mask. */
export function createFlameMask(): FlameMask {
    const mask: FlameMask = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        mask[i] = new Array(ROWS).fill(0);
    }
    return mask;
}

/** Create a null-filled flame color grid. */
export function createFlameColorGrid(): FlameColorGrid {
    const grid: FlameColorGrid = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        grid[i] = new Array(ROWS + MENU_FLAME_ROW_PADDING).fill(null);
    }
    return grid;
}

/** Create color source array with random drift values. */
export function createColorSources(ctx: Pick<MenuContext, "rand_range">): ColorSource[] {
    const sources: ColorSource[] = new Array(MENU_FLAME_COLOR_SOURCE_COUNT);
    for (let i = 0; i < MENU_FLAME_COLOR_SOURCE_COUNT; i++) {
        sources[i] = [
            ctx.rand_range(0, 1000),
            ctx.rand_range(0, 1000),
            ctx.rand_range(0, 1000),
            ctx.rand_range(0, 1000),
        ];
    }
    return sources;
}

// =============================================================================
// antiAlias — MainMenu.c:161
// =============================================================================

/**
 * Takes a grid of values (0 or 100) and fills in intermediate values at
 * edges to smooth the mask.
 *
 * C: `antiAlias` in MainMenu.c
 */
export function antiAlias(mask: FlameMask): void {
    const intensity = [0, 0, 35, 50, 60];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // cardinal directions

    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            if (mask[i][j] < 100) {
                let nbCount = 0;
                for (let dir = 0; dir < 4; dir++) {
                    const x = i + dirs[dir][0];
                    const y = j + dirs[dir][1];
                    if (x >= 0 && x < COLS && y >= 0 && y < ROWS && mask[x][y] === 100) {
                        nbCount++;
                    }
                }
                mask[i][j] = intensity[nbCount];
            }
        }
    }
}

// =============================================================================
// initializeMenuFlames — MainMenu.c:185
// =============================================================================

/**
 * Initialize the title screen flame simulation state.
 *
 * C: `initializeMenuFlames` in MainMenu.c
 */
export function initializeMenuFlames(
    includeTitle: boolean,
    ctx: MenuContext,
): { flames: FlameGrid; colorSources: ColorSource[]; colors: FlameColorGrid; colorStorage: Color[]; mask: FlameMask } {
    const mask = createFlameMask();
    const colors = createFlameColorGrid();
    const flames = createFlameGrid();

    const colorSources = createColorSources(ctx);
    const colorStorage: Color[] = [];
    let colorSourceCount = 0;

    for (let i = 0; i < COLS; i++) {
        const col: Color = { ...ctx.flameSourceColor };
        ctx.applyColorAverage(col, ctx.flameSourceColorSecondary, 100 - (ctx.smoothHiliteGradient(i, COLS - 1) + 25));
        colorStorage.push(col);
        colors[i][ROWS + MENU_FLAME_ROW_PADDING - 1] = colorStorage[colorSourceCount];
        colorSourceCount++;
    }

    if (includeTitle) {
        const titleW = ctx.gameConst.mainMenuTitleWidth;
        const titleH = ctx.gameConst.mainMenuTitleHeight;
        const title = ctx.mainMenuTitle;

        for (let i = 0; i < titleW; i++) {
            for (let j = 0; j < titleH; j++) {
                if (title[j * titleW + i] !== " ") {
                    const cx = Math.trunc((COLS - titleW) / 2) + i + MENU_TITLE_OFFSET_X;
                    const cy = Math.trunc((ROWS - titleH) / 2) + j + MENU_TITLE_OFFSET_Y;
                    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS + MENU_FLAME_ROW_PADDING) {
                        colors[cx][cy] = ctx.flameTitleColor;
                        colorSourceCount++;
                        if (cy < ROWS) {
                            mask[cx][cy] = 100;
                        }
                    }
                }
            }
        }

        antiAlias(mask);
    }

    for (let i = 0; i < 100; i++) {
        updateMenuFlames(colors, colorSources, flames, ctx);
    }

    return { flames, colorSources, colors, colorStorage, mask };
}

// =============================================================================
// updateMenuFlames — MainMenu.c:84
// =============================================================================

/**
 * Update one tick of the flame simulation.
 *
 * C: `updateMenuFlames` in MainMenu.c
 */
export function updateMenuFlames(
    colors: FlameColorGrid,
    colorSources: ColorSource[],
    flames: FlameGrid,
    ctx: Pick<MenuContext, "rand_range">,
): void {
    let colorSourceNumber = 0;

    for (let j = 0; j < ROWS + MENU_FLAME_ROW_PADDING; j++) {
        const tempFlames: number[][] = new Array(COLS);
        for (let i = 0; i < COLS; i++) {
            tempFlames[i] = [flames[i][j][0], flames[i][j][1], flames[i][j][2]];
        }

        for (let i = 0; i < COLS; i++) {
            for (let k = 0; k < 3; k++) {
                flames[i][j][k] = Math.trunc(100 * flames[i][j][k] / MENU_FLAME_DENOMINATOR);
            }

            for (let l = -1; l <= 1; l += 2) {
                let x = i + l;
                if (x === -1) x = COLS - 1;
                else if (x === COLS) x = 0;
                for (let k = 0; k < 3; k++) {
                    flames[i][j][k] += Math.trunc(MENU_FLAME_SPREAD_SPEED * tempFlames[x][k] / 2 / MENU_FLAME_DENOMINATOR);
                }
            }

            const y = j + 1;
            if (y < ROWS + MENU_FLAME_ROW_PADDING) {
                for (let k = 0; k < 3; k++) {
                    flames[i][j][k] += Math.trunc(MENU_FLAME_RISE_SPEED * flames[i][y][k] / MENU_FLAME_DENOMINATOR);
                }
            }

            for (let k = 0; k < 3; k++) {
                flames[i][j][k] = Math.trunc((1000 - MENU_FLAME_FADE_SPEED) * flames[i][j][k] / 1000);
            }

            const colorRef = colors[i][j];
            if (colorRef) {
                for (let k = 0; k < 4; k++) {
                    colorSources[colorSourceNumber][k] += ctx.rand_range(-MENU_FLAME_COLOR_DRIFT_SPEED, MENU_FLAME_COLOR_DRIFT_SPEED);
                    colorSources[colorSourceNumber][k] = Math.max(0, Math.min(1000, colorSources[colorSourceNumber][k]));
                }

                const rand = Math.trunc(colorRef.rand * colorSources[colorSourceNumber][0] / 1000);
                flames[i][j][0] += (colorRef.red + Math.trunc(colorRef.redRand * colorSources[colorSourceNumber][1] / 1000) + rand) * MENU_FLAME_PRECISION_FACTOR;
                flames[i][j][1] += (colorRef.green + Math.trunc(colorRef.greenRand * colorSources[colorSourceNumber][2] / 1000) + rand) * MENU_FLAME_PRECISION_FACTOR;
                flames[i][j][2] += (colorRef.blue + Math.trunc(colorRef.blueRand * colorSources[colorSourceNumber][3] / 1000) + rand) * MENU_FLAME_PRECISION_FACTOR;

                colorSourceNumber++;
            }
        }
    }
}

// =============================================================================
// drawMenuFlames — MainMenu.c:42
// =============================================================================

/**
 * Render the flame simulation into the display buffer.
 *
 * C: `drawMenuFlames` in MainMenu.c
 */
export function drawMenuFlames(
    flames: FlameGrid,
    mask: FlameMask,
    ctx: MenuContext,
    displayBuffer: ScreenDisplayBuffer,
): void {
    const versionStringLength = ctx.strLenWithoutEscapes(ctx.gameConst.versionString);

    let gameModeString = "";
    if (ctx.wizardMode) {
        gameModeString = "Wizard Mode";
    } else if (ctx.rogue.mode === GameMode.Easy) {
        gameModeString = "Easy Mode";
    }
    const gameModeStringLength = gameModeString.length;

    for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
            let dchar: number;
            if (j === ROWS - 1 && i >= COLS - versionStringLength) {
                dchar = ctx.gameConst.versionString.charCodeAt(i - (COLS - versionStringLength));
            } else if (gameModeStringLength && j === ROWS - 1 && i < gameModeStringLength) {
                dchar = gameModeString.charCodeAt(i);
            } else {
                dchar = 32; // space
            }

            if (mask[i][j] === 100) {
                ctx.plotCharWithColor(
                    dchar as DisplayGlyph,
                    { windowX: i, windowY: j },
                    ctx.veryDarkGray,
                    ctx.black,
                    displayBuffer,
                );
            } else {
                const tempColor: Color = { ...ctx.black };
                tempColor.red = Math.trunc(flames[i][j][0] / MENU_FLAME_PRECISION_FACTOR);
                tempColor.green = Math.trunc(flames[i][j][1] / MENU_FLAME_PRECISION_FACTOR);
                tempColor.blue = Math.trunc(flames[i][j][2] / MENU_FLAME_PRECISION_FACTOR);
                if (mask[i][j] > 0) {
                    ctx.applyColorAverage(tempColor, ctx.black, mask[i][j]);
                }
                ctx.plotCharWithColor(
                    dchar as DisplayGlyph,
                    { windowX: i, windowY: j },
                    ctx.veryDarkGray,
                    tempColor,
                    displayBuffer,
                );
            }
        }
    }
}
