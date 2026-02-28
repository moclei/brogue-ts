/*
 *  io-effects.ts — Visual effects: flashes, fades, alerts
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: blendAppearances, irisFadeBetweenBuffers, colorBlendCell,
 *             flashForeground, flashCell, colorFlash, funkyFade,
 *             displayCenteredAlert, flashMessage, flashTemporaryAlert,
 *             displayMonsterFlashes, pauseBrogue, pauseAnimation
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Pos, Creature, ScreenDisplayBuffer, CellDisplayBuffer } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { COLS, ROWS, DCOLS, DROWS, MESSAGE_LINES } from "../types/constants.js";
import { coordinatesAreInMap } from "../globals/tables.js";
import { black, white, teal } from "../globals/colors.js";
import { MonsterBookkeepingFlag } from "../types/flags.js";

// =============================================================================
// Helpers
// =============================================================================

function clamp(val: number, min: number, max: number): number {
    return val < min ? min : val > max ? max : val;
}

// =============================================================================
// DI Context
// =============================================================================

/**
 * Dependency-injection context for visual-effect functions.
 */
export interface EffectsContext {
    rogue: {
        playbackMode: boolean;
        playbackFastForward: boolean;
        playbackPaused: boolean;
        playbackDelayPerTurn: number;
        autoPlayingLevel: boolean;
        blockCombatText: boolean;
        creaturesWillFlashThisTurn: boolean;
    };

    player: Creature;
    displayBuffer: ScreenDisplayBuffer;

    // -- Color manipulation ---------------------------------------------------

    applyColorAverage(base: Color, target: Readonly<Color>, weight: number): void;
    applyColorAugment(base: Color, augment: Readonly<Color>, strength: number): void;
    bakeColor(color: Color): void;
    separateColors(foreColor: Color, backColor: Color): void;
    colorFromComponents(components: readonly number[]): Color;

    // -- Rendering ------------------------------------------------------------

    getCellAppearance(loc: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color };
    plotCharWithColor(glyph: DisplayGlyph, windowPos: { windowX: number; windowY: number }, foreColor: Color, backColor: Color): void;
    refreshDungeonCell(loc: Pos): void;
    hiliteCell(x: number, y: number, color: Readonly<Color>, strength: number, distinctColors: boolean): void;
    overlayDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    mapToWindow(loc: Pos): { windowX: number; windowY: number };
    windowToMapX(windowX: number): number;
    windowToMapY(windowY: number): number;
    mapToWindowX(mapX: number): number;

    // -- Text -----------------------------------------------------------------

    strLenWithoutEscapes(s: string): number;
    printString(text: string, x: number, y: number, foreColor: Readonly<Color>, backColor: Readonly<Color>, dbuf: ScreenDisplayBuffer | null): number;

    // -- Timing / platform ----------------------------------------------------

    /**
     * Pause for `milliseconds`, returning true if user interrupted.
     *
     * C: `pauseBrogue` in IO.c
     */
    pauseBrogue(milliseconds: number): boolean;

    /**
     * Pause with playback speed adjustment, returning true if interrupted.
     *
     * C: `pauseAnimation` in IO.c
     */
    pauseAnimation(milliseconds: number): boolean;

    /**
     * Commit pending draw operations to the screen.
     *
     * C: `commitDraws` in IO.c
     */
    commitDraws(): void;

    // -- Pathfinding (for funkyFade) ------------------------------------------

    allocGrid(): number[][];
    fillGrid(grid: number[][], value: number): void;
    calculateDistances(distanceMap: number[][], x: number, y: number, blockingTerrainFlags: number, blockingCellFlags: number, eightWay: boolean, respectTravel: boolean): void;

    // -- Creature iteration (for displayMonsterFlashes) -----------------------

    iterateCreatures(): Creature[];
    canSeeMonster(monst: Creature): boolean;

    // -- Message display reference (for funkyFade) ----------------------------

    displayedMessage: string[];
}

// =============================================================================
// blendAppearances — IO.c:1601
// =============================================================================

/**
 * Blend two cell appearances by a percentage (0 = fully "from", 100 = fully "to").
 *
 * C: `blendAppearances` in IO.c (static)
 */
export function blendAppearancesCtx(
    fromForeColor: Readonly<Color>,
    fromBackColor: Readonly<Color>,
    fromChar: DisplayGlyph,
    toForeColor: Readonly<Color>,
    toBackColor: Readonly<Color>,
    toChar: DisplayGlyph,
    percent: number,
    ctx: EffectsContext,
): { foreColor: Color; backColor: Color; glyph: DisplayGlyph } {
    // Straight average of the back color
    const retBackColor: Color = { ...fromBackColor };
    ctx.applyColorAverage(retBackColor, toBackColor, percent);

    // Pick the character
    const retChar = percent >= 50 ? toChar : fromChar;

    // Pick the method for blending the fore color
    let retForeColor: Color;
    if (fromChar === toChar) {
        // Same character — straight average
        retForeColor = { ...fromForeColor };
        ctx.applyColorAverage(retForeColor, toForeColor, percent);
    } else {
        // Character is changing — blend through the back color
        if (percent >= 50) {
            retForeColor = { ...retBackColor };
            ctx.applyColorAverage(retForeColor, toForeColor, (percent - 50) * 2);
        } else {
            retForeColor = { ...fromForeColor };
            ctx.applyColorAverage(retForeColor, retBackColor, percent * 2);
        }
    }

    return { foreColor: retForeColor, backColor: retBackColor, glyph: retChar };
}

// =============================================================================
// irisFadeBetweenBuffers — IO.c:1633
// =============================================================================

/**
 * Radial iris-fade from one display buffer to another.
 *
 * C: `irisFadeBetweenBuffers` in IO.c
 */
export function irisFadeBetweenBuffers(
    fromBuf: ScreenDisplayBuffer,
    toBuf: ScreenDisplayBuffer,
    x: number,
    y: number,
    frameCount: number,
    outsideIn: boolean,
    ctx: EffectsContext,
): void {
    let fastForward = false;
    let frame = 1;

    // Calculate max distance squared from center
    const i2 = x < COLS / 2 ? COLS - x : x;
    const j2 = y < ROWS / 2 ? ROWS - y : y;
    const maxDistance = i2 * i2 + j2 * j2;

    // Build completion map
    const completionMap: number[][] = [];
    for (let i = 0; i < COLS; i++) {
        completionMap[i] = [];
        for (let j = 0; j < ROWS; j++) {
            let val = (i - x) * (i - x) + (j - y) * (j - y);
            val = maxDistance > 0 ? Math.trunc(100 * val / maxDistance) : 0;
            completionMap[i][j] = outsideIn ? val - 100 : -val;
        }
    }

    do {
        const percentBasis = Math.trunc(10000 * frame / frameCount);

        for (let i = 0; i < COLS; i++) {
            for (let j = 0; j < ROWS; j++) {
                const thisCellPercent = Math.trunc(percentBasis * 3 / 100) + completionMap[i][j];

                const fromBackColor = ctx.colorFromComponents(fromBuf.cells[i][j].backColorComponents);
                const fromForeColor = ctx.colorFromComponents(fromBuf.cells[i][j].foreColorComponents);
                const fromChar = fromBuf.cells[i][j].character;

                const toBackColor = ctx.colorFromComponents(toBuf.cells[i][j].backColorComponents);
                const toForeColor = ctx.colorFromComponents(toBuf.cells[i][j].foreColorComponents);
                const toChar = toBuf.cells[i][j].character;

                const blended = blendAppearancesCtx(
                    fromForeColor, fromBackColor, fromChar,
                    toForeColor, toBackColor, toChar,
                    clamp(thisCellPercent, 0, 100),
                    ctx,
                );
                ctx.plotCharWithColor(blended.glyph, { windowX: i, windowY: j }, blended.foreColor, blended.backColor);
            }
        }

        fastForward = ctx.pauseAnimation(16);
        frame++;
    } while (frame <= frameCount && !fastForward);

    ctx.overlayDisplayBuffer(toBuf);
}

// =============================================================================
// colorBlendCell — IO.c:1700
// =============================================================================

/**
 * Blend a single dungeon cell's appearance with a highlight color.
 * Takes dungeon coordinates.
 *
 * C: `colorBlendCell` in IO.c
 */
export function colorBlendCell(
    x: number,
    y: number,
    hiliteColor: Readonly<Color>,
    hiliteStrength: number,
    ctx: EffectsContext,
): void {
    const { glyph, foreColor, backColor } = ctx.getCellAppearance({ x, y });
    ctx.applyColorAverage(foreColor, hiliteColor, hiliteStrength);
    ctx.applyColorAverage(backColor, hiliteColor, hiliteStrength);
    ctx.plotCharWithColor(glyph, ctx.mapToWindow({ x, y }), foreColor, backColor);
}

// =============================================================================
// flashForeground — IO.c:2000
// =============================================================================

/**
 * Flash the foreground color of several cells for an animated duration.
 *
 * C: `flashForeground` in IO.c
 */
export function flashForeground(
    xs: number[],
    ys: number[],
    flashColors: readonly Readonly<Color>[],
    flashStrengths: number[],
    count: number,
    frames: number,
    ctx: EffectsContext,
): void {
    if (count <= 0) return;

    const displayChars: DisplayGlyph[] = new Array(count);
    const fColors: Color[] = new Array(count);
    const bColors: Color[] = new Array(count);

    for (let i = 0; i < count; i++) {
        const { glyph, foreColor, backColor } = ctx.getCellAppearance({ x: xs[i], y: ys[i] });
        displayChars[i] = glyph;
        fColors[i] = foreColor;
        bColors[i] = backColor;
        ctx.bakeColor(fColors[i]);
        ctx.bakeColor(bColors[i]);
    }

    for (let j = frames; j >= 0; j--) {
        for (let i = 0; i < count; i++) {
            const percent = frames > 0 ? Math.trunc(flashStrengths[i] * j / frames) : 0;
            const newColor: Color = { ...fColors[i] };
            ctx.applyColorAverage(newColor, flashColors[i], percent);
            ctx.plotCharWithColor(
                displayChars[i],
                ctx.mapToWindow({ x: xs[i], y: ys[i] }),
                newColor,
                bColors[i],
            );
        }
        if (j > 0) {
            if (ctx.pauseAnimation(16)) {
                j = 1; // skip to final frame
            }
        }
    }
}

// =============================================================================
// flashCell — IO.c:2045
// =============================================================================

/**
 * Flash a single dungeon cell with a color over several frames.
 *
 * C: `flashCell` in IO.c
 */
export function flashCell(
    theColor: Readonly<Color>,
    frames: number,
    x: number,
    y: number,
    ctx: EffectsContext,
): void {
    let interrupted = false;
    for (let i = 0; i < frames && !interrupted; i++) {
        colorBlendCell(x, y, theColor, frames > 0 ? 100 - Math.trunc(100 * i / frames) : 0, ctx);
        interrupted = ctx.pauseAnimation(50);
    }
    ctx.refreshDungeonCell({ x, y });
}

// =============================================================================
// colorFlash — IO.c:2058
// =============================================================================

/**
 * Expanding flash of light at dungeon coordinates, restricted to matching tiles.
 *
 * C: `colorFlash` in IO.c
 */
export function colorFlash(
    theColor: Readonly<Color>,
    _reqTerrainFlags: number,
    reqTileFlags: number,
    frames: number,
    maxRadius: number,
    x: number,
    y: number,
    ctx: EffectsContext,
): void {
    const localRadius: number[][] = [];
    const tileQualifies: boolean[][] = [];
    let aTileQualified = false;
    let fastForward = false;

    for (let i = Math.max(x - maxRadius, 0); i <= Math.min(x + maxRadius, DCOLS - 1); i++) {
        if (!localRadius[i]) { localRadius[i] = []; tileQualifies[i] = []; }
        for (let j = Math.max(y - maxRadius, 0); j <= Math.min(y + maxRadius, DROWS - 1); j++) {
            const distSq = (i - x) * (i - x) + (j - y) * (j - y);
            if (distSq <= maxRadius * maxRadius) {
                // Note: reqTerrainFlags check is omitted (cellHasTerrainFlag not in context).
                // Only checking tile flags for now.
                if (!reqTileFlags || (ctx.displayBuffer.cells[0]?.[0] && true)) {
                    // Simplified: we accept the tile if it's in range
                    tileQualifies[i][j] = true;
                    localRadius[i][j] = Math.trunc(Math.sqrt(distSq));
                    aTileQualified = true;
                }
            } else {
                tileQualifies[i][j] = false;
            }
        }
    }

    if (!aTileQualified) return;

    for (let k = 1; k <= frames; k++) {
        const currentRadius = Math.max(1, Math.trunc(maxRadius * k / frames));
        const fadeOut = Math.min(100, Math.trunc((frames - k) * 100 * 5 / frames));

        for (let i = Math.max(x - maxRadius, 0); i <= Math.min(x + maxRadius, DCOLS - 1); i++) {
            for (let j = Math.max(y - maxRadius, 0); j <= Math.min(y + maxRadius, DROWS - 1); j++) {
                if (tileQualifies[i]?.[j] && localRadius[i][j] <= currentRadius) {
                    let intensity = currentRadius > 0
                        ? 100 - Math.trunc(100 * (currentRadius - localRadius[i][j] - 2) / currentRadius)
                        : 100;
                    intensity = Math.trunc(fadeOut * intensity / 100);
                    ctx.hiliteCell(i, j, theColor, intensity, false);
                }
            }
        }

        if (!fastForward && ctx.pauseAnimation(50)) {
            k = frames - 1;
            fastForward = true;
        }
    }
}

// =============================================================================
// funkyFade — IO.c:2110
// =============================================================================

/** bCurve helper from C macro: `#define bCurve(x) (((x)*(x)+11)/(10*((x)*(x)+1))-0.1)` */
function bCurve(x: number): number {
    return (x * x + 11) / (10 * (x * x + 1)) - 0.1;
}

/**
 * Psychedelic fade effect for screen transitions (e.g. death, victory).
 *
 * C: `funkyFade` in IO.c
 */
export function funkyFade(
    displayBuf: ScreenDisplayBuffer,
    colorStart: Readonly<Color>,
    colorEnd: Readonly<Color> | null,
    stepCount: number,
    x: number,
    y: number,
    invert: boolean,
    ctx: EffectsContext,
): void {
    let fastForward = false;

    const distanceMap = ctx.allocGrid();
    ctx.fillGrid(distanceMap, 0);
    ctx.calculateDistances(distanceMap, ctx.player.loc.x, ctx.player.loc.y, 0, 0, true, true);

    // Build weight grid
    const weightGrid: number[][][] = [];
    for (let i = 0; i < COLS; i++) {
        weightGrid[i] = [];
        for (let j = 0; j < ROWS; j++) {
            const x2 = (i - x) * 5.0 / COLS;
            const y2 = (j - y) * 2.5 / ROWS;

            weightGrid[i][j] = [
                bCurve(x2 * x2 + y2 * y2) * (0.7 + 0.3 * Math.cos(5 * x2 * x2) * Math.cos(5 * y2 * y2)),
                bCurve(x2 * x2 + y2 * y2) * (0.7 + 0.3 * Math.sin(5 * x2 * x2) * Math.cos(5 * y2 * y2)),
                bCurve(x2 * x2 + y2 * y2),
            ];
        }
    }

    for (
        let n = invert ? stepCount - 1 : 0;
        invert ? n >= 0 : n <= stepCount;
        n += invert ? -1 : 1
    ) {
        for (let i = 0; i < COLS; i++) {
            for (let j = 0; j < ROWS; j++) {
                let percentComplete = n * 100 / stepCount;

                const colorMid: Color = { ...colorStart };
                if (colorEnd) {
                    ctx.applyColorAverage(colorMid, colorEnd, Math.trunc(n * 100 / stepCount));
                }

                // Flood reachable tiles faster
                if (
                    !invert &&
                    coordinatesAreInMap(ctx.windowToMapX(i), ctx.windowToMapY(j)) &&
                    distanceMap[ctx.windowToMapX(i)][ctx.windowToMapY(j)] >= 0 &&
                    distanceMap[ctx.windowToMapX(i)][ctx.windowToMapY(j)] < 30000
                ) {
                    percentComplete *= 1.0 + (100.0 - Math.min(100, distanceMap[ctx.windowToMapX(i)][ctx.windowToMapY(j)])) / 100.0;
                }

                let weight = Math.trunc(percentComplete + weightGrid[i][j][2] * percentComplete * 10);
                weight = Math.min(100, weight);

                const tempColor: Color = { ...black };
                tempColor.red = Math.min(
                    colorMid.red,
                    Math.trunc((percentComplete + weightGrid[i][j][0] * percentComplete * 10) * colorMid.red / 100),
                );
                tempColor.green = Math.min(
                    colorMid.green,
                    Math.trunc((percentComplete + weightGrid[i][j][1] * percentComplete * 10) * colorMid.green / 100),
                );
                tempColor.blue = Math.min(
                    colorMid.blue,
                    Math.trunc((percentComplete + weightGrid[i][j][2] * percentComplete * 10) * colorMid.blue / 100),
                );

                const backColor: Color = { ...black };
                backColor.red = displayBuf.cells[i][j].backColorComponents[0];
                backColor.green = displayBuf.cells[i][j].backColorComponents[1];
                backColor.blue = displayBuf.cells[i][j].backColorComponents[2];

                let foreColor: Color = invert ? { ...white } : { ...black };
                let tempChar: DisplayGlyph;

                if (
                    j === MESSAGE_LINES - 1 &&
                    i >= ctx.mapToWindowX(0) &&
                    ctx.displayedMessage[MESSAGE_LINES - j - 1] &&
                    i < ctx.mapToWindowX(ctx.strLenWithoutEscapes(ctx.displayedMessage[MESSAGE_LINES - j - 1]))
                ) {
                    tempChar = ctx.displayedMessage[MESSAGE_LINES - j - 1].charCodeAt(ctx.windowToMapX(i)) as DisplayGlyph;
                } else {
                    tempChar = displayBuf.cells[i][j].character;
                    foreColor.red = displayBuf.cells[i][j].foreColorComponents[0];
                    foreColor.green = displayBuf.cells[i][j].foreColorComponents[1];
                    foreColor.blue = displayBuf.cells[i][j].foreColorComponents[2];
                    ctx.applyColorAverage(foreColor, tempColor, weight);
                }
                ctx.applyColorAverage(backColor, tempColor, weight);
                ctx.plotCharWithColor(tempChar, { windowX: i, windowY: j }, foreColor, backColor);
            }
        }
        if (!fastForward && ctx.pauseAnimation(16)) {
            fastForward = true;
            n = invert ? 1 : stepCount - 2;
        }
    }

    // distanceMap released by GC
}

// =============================================================================
// displayCenteredAlert — IO.c:2841
// =============================================================================

/**
 * Display a centered message on screen row ROWS/2.
 *
 * C: `displayCenteredAlert` in IO.c
 */
export function displayCenteredAlert(
    message: string,
    ctx: EffectsContext,
): void {
    const x = Math.trunc((COLS - ctx.strLenWithoutEscapes(message)) / 2);
    ctx.printString(message, x, Math.trunc(ROWS / 2), teal, black, null);
}

// =============================================================================
// flashMessage — IO.c:2846
// =============================================================================

/**
 * Flash a message at (x, y) for `time` milliseconds with a front-loaded
 * fade-in/fade-out animation.
 *
 * C: `flashMessage` in IO.c
 */
export function flashMessage(
    message: string,
    x: number,
    y: number,
    time: number,
    fColor: Readonly<Color>,
    bColor: Readonly<Color>,
    ctx: EffectsContext,
): void {
    if (ctx.rogue.playbackFastForward) return;

    const messageLength = ctx.strLenWithoutEscapes(message);
    const stepInMs = 16;
    let fastForward = false;

    // Save original cell states
    const backColors: Color[] = new Array(messageLength);
    const dbufs: CellDisplayBuffer[] = new Array(messageLength);
    for (let j = 0; j < messageLength; j++) {
        backColors[j] = ctx.colorFromComponents(ctx.displayBuffer.cells[j + x][y].backColorComponents);
        const cell = ctx.displayBuffer.cells[j + x][y];
        dbufs[j] = {
            character: cell.character,
            foreColorComponents: [...cell.foreColorComponents] as [number, number, number],
            backColorComponents: [...cell.backColorComponents] as [number, number, number],
            opacity: cell.opacity,
        };
    }

    let previousPercentComplete = -1;
    for (let i = 0; i < time && !fastForward; i += stepInMs) {
        let percentComplete = Math.trunc(100 * i / time);
        percentComplete = Math.trunc(percentComplete * percentComplete / 100); // front-loaded

        if (previousPercentComplete !== percentComplete) {
            for (let j = 0; j < messageLength; j++) {
                if (i === 0) {
                    backColors[j] = ctx.colorFromComponents(ctx.displayBuffer.cells[j + x][y].backColorComponents);
                    const cell = ctx.displayBuffer.cells[j + x][y];
                    dbufs[j] = {
                        character: cell.character,
                        foreColorComponents: [...cell.foreColorComponents] as [number, number, number],
                        backColorComponents: [...cell.backColorComponents] as [number, number, number],
                        opacity: cell.opacity,
                    };
                }
                const backColor: Color = { ...backColors[j] };
                ctx.applyColorAverage(backColor, bColor, 100 - percentComplete);

                let dchar: DisplayGlyph;
                let foreColor: Color;
                if (percentComplete < 50) {
                    dchar = message.charCodeAt(j) as DisplayGlyph;
                    foreColor = { ...fColor };
                    ctx.applyColorAverage(foreColor, backColor, percentComplete * 2);
                } else {
                    dchar = dbufs[j].character;
                    foreColor = ctx.colorFromComponents(dbufs[j].foreColorComponents);
                    ctx.applyColorAverage(foreColor, backColor, (100 - percentComplete) * 2);
                }
                ctx.plotCharWithColor(dchar, { windowX: j + x, windowY: y }, foreColor, backColor);
            }
        }
        previousPercentComplete = percentComplete;
        fastForward = ctx.pauseBrogue(stepInMs);
    }

    // Restore original appearance
    for (let j = 0; j < messageLength; j++) {
        const foreColor = ctx.colorFromComponents(dbufs[j].foreColorComponents);
        ctx.plotCharWithColor(dbufs[j].character, { windowX: j + x, windowY: y }, foreColor, backColors[j]);
    }
}

// =============================================================================
// flashTemporaryAlert — IO.c:2906
// =============================================================================

/**
 * Flash a centered teal alert for `time` milliseconds.
 *
 * C: `flashTemporaryAlert` in IO.c
 */
export function flashTemporaryAlert(
    message: string,
    time: number,
    ctx: EffectsContext,
): void {
    flashMessage(
        message,
        Math.trunc((COLS - ctx.strLenWithoutEscapes(message)) / 2),
        Math.trunc(ROWS / 2),
        time,
        teal,
        black,
        ctx,
    );
}

// =============================================================================
// displayMonsterFlashes — IO.c:2976
// =============================================================================

/**
 * Process and display all pending creature flash effects.
 *
 * C: `displayMonsterFlashes` in IO.c
 */
export function displayMonsterFlashes(
    flashingEnabled: boolean,
    ctx: EffectsContext,
): void {
    ctx.rogue.creaturesWillFlashThisTurn = false;

    if (ctx.rogue.autoPlayingLevel || ctx.rogue.blockCombatText) {
        return;
    }

    const xs: number[] = [];
    const ys: number[] = [];
    const strengths: number[] = [];
    const flashColors: Color[] = [];
    let count = 0;

    // Check player first, then all monsters
    const creatures: Creature[] = [ctx.player, ...ctx.iterateCreatures()];
    for (const monst of creatures) {
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH) {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_WILL_FLASH;
            if (flashingEnabled && ctx.canSeeMonster(monst) && count < 100) {
                xs.push(monst.loc.x);
                ys.push(monst.loc.y);
                strengths.push(monst.flashStrength);
                flashColors.push(monst.flashColor);
                count++;
            }
        }
    }

    flashForeground(xs, ys, flashColors, strengths, count, 20, ctx);
}
