/*
 *  effects-alerts.ts — Alert/flash effects
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: displayCenteredAlert, flashMessage, flashTemporaryAlert,
 *             displayMonsterFlashes
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature, CellDisplayBuffer } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { COLS, ROWS } from "../types/constants.js";
import { black, teal } from "../globals/colors.js";
import { MonsterBookkeepingFlag } from "../types/flags.js";
import type { EffectsContext } from "./effects.js";
import { flashForeground } from "./effects.js";

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
export async function flashMessage(
    message: string,
    x: number,
    y: number,
    time: number,
    fColor: Readonly<Color>,
    bColor: Readonly<Color>,
    ctx: EffectsContext,
): Promise<void> {
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
        ctx.commitDraws();
        fastForward = await ctx.pauseBrogue(stepInMs);
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
export async function flashTemporaryAlert(
    message: string,
    time: number,
    ctx: EffectsContext,
): Promise<void> {
    await flashMessage(
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
