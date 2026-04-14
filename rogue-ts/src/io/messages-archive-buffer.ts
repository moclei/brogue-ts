/*
 *  io/messages-archive-buffer.ts — Buffer-based message archive rendering
 *  Port V2 — rogue-ts
 *
 *  Contains the buffer-animated message archive display functions extracted
 *  from messages.ts to keep that file under the 600-line limit.
 *
 *  These functions are used when DOM mode is disabled (fallback rendering).
 *
 *  C: IO.c — drawMessageArchive, animateMessageArchive, scrollMessageArchive
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { DisplayGlyph } from "../types/enums.js";
import { EventType } from "../types/enums.js";
import {
    ROWS, DCOLS, MESSAGE_LINES,
    MESSAGE_ARCHIVE_LINES, MESSAGE_ARCHIVE_VIEW_LINES,
    INTERFACE_OPACITY,
} from "../types/constants.js";
import { white, black } from "../globals/colors.js";
import { printString } from "./text.js";
import { mapToWindowX, clearDisplayBuffer, createScreenDisplayBuffer } from "./display.js";
import type { MessageContext } from "./messages-state.js";

// =============================================================================
// drawMessageArchive — buffer-based archive overlay
// =============================================================================

/**
 * Draw formatted messages in the message archive overlay into a temp buffer.
 *
 * C: `drawMessageArchive` (static) in IO.c
 */
export function drawMessageArchive(
    ctx: MessageContext,
    messages: string[],
    length: number,
    offset: number,
    height: number,
): void {
    const dbuf = createScreenDisplayBuffer();
    clearDisplayBuffer(dbuf);

    for (let i = 0; (MESSAGE_ARCHIVE_LINES - offset + i) < MESSAGE_ARCHIVE_LINES && i < ROWS && i < height; i++) {
        const msgIdx = MESSAGE_ARCHIVE_LINES - offset + i;
        if (msgIdx >= 0 && msgIdx < messages.length) {
            printString(messages[msgIdx], mapToWindowX(0), i, white, black, dbuf);
        }

        // Set opacity and fade from bottom to top
        const fadePercent = Math.trunc(50 * (length - offset + i) / length) + 50;
        for (let j = 0; j < DCOLS; j++) {
            const wx = mapToWindowX(j);
            dbuf.cells[wx][i].opacity = INTERFACE_OPACITY;
            if (dbuf.cells[wx][i].character !== (32 as DisplayGlyph)) { // not a space
                for (let k = 0; k < 3; k++) {
                    dbuf.cells[wx][i].foreColorComponents[k] =
                        Math.trunc(dbuf.cells[wx][i].foreColorComponents[k] * fadePercent / 100);
                }
            }
        }
    }

    ctx.overlayDisplayBuffer(dbuf);
}

// =============================================================================
// animateMessageArchive — pull-down / pull-up animation
// =============================================================================

/**
 * Pull-down / pull-up animation for the buffer-based message archive.
 *
 * C: `animateMessageArchive` (static) in IO.c
 */
export async function animateMessageArchive(
    ctx: MessageContext,
    opening: boolean,
    messages: string[],
    length: number,
    offset: number,
    height: number,
): Promise<void> {
    let fastForward = false;

    for (
        let i = opening ? MESSAGE_LINES : height;
        opening ? i <= height : i >= MESSAGE_LINES;
        i += opening ? 1 : -1
    ) {
        const rbuf = ctx.saveDisplayBuffer();

        drawMessageArchive(ctx, messages, length, offset - height + i, i);

        if (!fastForward && await ctx.pauseBrogue(opening ? 2 : 1, { interruptForMouseMove: false })) {
            fastForward = true;
            // Dequeue the event that interrupted us
            await ctx.nextBrogueEvent(false, false, true);
            i = opening ? height - 1 : MESSAGE_LINES + 1; // skip to end
        }
        ctx.restoreDisplayBuffer(rbuf);
    }
}

// =============================================================================
// scrollMessageArchive — keyboard input loop for archive navigation
// =============================================================================

/**
 * Accept keyboard input to navigate or dismiss the opened message archive.
 * Returns the new offset.
 *
 * C: `scrollMessageArchive` (static) in IO.c
 */
export async function scrollMessageArchive(
    ctx: MessageContext,
    messages: string[],
    length: number,
    startOffset: number,
    height: number,
): Promise<number> {
    let offset = startOffset;
    let lastOffset = offset - 1; // ensure first render

    if (ctx.rogue.autoPlayingLevel || (ctx.rogue.playbackMode && !ctx.rogue.playbackOOS)) {
        return offset;
    }

    const rbuf = ctx.saveDisplayBuffer();
    let exit = false;

    do {
        if (offset !== lastOffset) {
            ctx.restoreDisplayBuffer(rbuf);
            drawMessageArchive(ctx, messages, length, offset, height);
        }
        lastOffset = offset;

        const theEvent = await ctx.nextBrogueEvent(false, false, false);

        if (theEvent.eventType === EventType.Keystroke) {
            let keystroke = theEvent.param1;
            keystroke = ctx.stripShiftFromMovementKeystroke(keystroke);

            const UP_KEY = 107;    // 'k'
            const DOWN_KEY = 106;  // 'j'
            const UP_ARROW = 63232;
            const DOWN_ARROW = 63233;
            const NUMPAD_8 = 56;
            const NUMPAD_2 = 50;
            const ACKNOWLEDGE_KEY = 32; // space
            const ESCAPE_KEY = 0x1b;

            switch (keystroke) {
                case UP_KEY:
                case UP_ARROW:
                case NUMPAD_8:
                    if (theEvent.controlKey) {
                        offset = length;
                    } else if (theEvent.shiftKey) {
                        offset++;
                    } else {
                        offset += Math.trunc(MESSAGE_ARCHIVE_VIEW_LINES / 3);
                    }
                    break;
                case DOWN_KEY:
                case DOWN_ARROW:
                case NUMPAD_2:
                    if (theEvent.controlKey) {
                        offset = height;
                    } else if (theEvent.shiftKey) {
                        offset--;
                    } else {
                        offset -= Math.trunc(MESSAGE_ARCHIVE_VIEW_LINES / 3);
                    }
                    break;
                case ACKNOWLEDGE_KEY:
                case ESCAPE_KEY:
                    exit = true;
                    break;
                default:
                    await ctx.flashTemporaryAlert(" -- Press space or click to continue -- ", 500);
            }
        }

        if (theEvent.eventType === EventType.MouseUp) {
            exit = true;
        }

        offset = Math.max(height, Math.min(offset, length));
    } while (!exit);

    ctx.restoreDisplayBuffer(rbuf);
    return offset;
}
