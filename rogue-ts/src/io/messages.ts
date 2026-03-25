/*
 *  messages.ts — Message rendering, display, and interaction
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c + src/brogue/Combat.c
 *  Functions: updateMessageDisplay, displayRecentMessages, deleteMessages,
 *             confirmMessages, clearMessageArchive, displayMoreSign,
 *             displayMoreSignWithoutWaitingForAcknowledgment, message,
 *             messageWithColor, flavorMessage, temporaryMessage,
 *             combatMessage, displayCombatText, displayMessageArchive
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { EventType } from "../types/enums.js";
import {
    COLS, ROWS, DCOLS, MESSAGE_LINES,
    MESSAGE_ARCHIVE_ENTRIES, MESSAGE_ARCHIVE_LINES, MESSAGE_ARCHIVE_VIEW_LINES,
    INTERFACE_OPACITY, COLOR_ESCAPE,
} from "../types/constants.js";
import { MessageFlag } from "../types/flags.js";
import { black, white, flavorTextColor } from "../globals/colors.js";
import { strLenWithoutEscapes, printString } from "./text.js";
import { encodeMessageColor, decodeMessageColor, applyColorAverage } from "./color.js";
import {
    mapToWindowX, mapToWindowY,
    clearDisplayBuffer, createScreenDisplayBuffer,
} from "./display.js";
import {
    type MessageState,
    type MessageContext,
    formatRecentMessages,
    addMessageToArchive,
} from "./messages-state.js";

// Re-export types and state helpers for consumers that previously imported
// everything from a single messages module.
export type { ArchivedMessage, MessageState, MessageContext } from "./messages-state.js";
export {
    createMessageState,
    getArchivedMessage,
    formatCountedMessage,
    foldMessages,
    formatRecentMessages,
    addMessageToArchive,
} from "./messages-state.js";

// =============================================================================
// Rendering functions (need MessageContext)
// =============================================================================

/**
 * Render the currently displayed messages to the screen.
 * Dims older / confirmed messages.
 *
 * C: `updateMessageDisplay` in IO.c
 */
export function updateMessageDisplay(ctx: MessageContext): void {
    const state = ctx.messageState;

    for (let i = 0; i < MESSAGE_LINES; i++) {
        let messageColor: Color = { ...white };

        if (i >= state.messagesUnconfirmed) {
            applyColorAverage(messageColor, black, 50);
            applyColorAverage(messageColor, black, Math.trunc(75 * i / MESSAGE_LINES));
        }

        let m = 0;
        let j = 0;
        while (state.displayedMessage[i][m] && j < DCOLS) {
            while (state.displayedMessage[i].charCodeAt(m) === COLOR_ESCAPE) {
                const decoded = decodeMessageColor(state.displayedMessage[i], m);
                messageColor = decoded.color;
                m = decoded.nextIndex;
                if (i >= state.messagesUnconfirmed) {
                    applyColorAverage(messageColor, black, 50);
                    applyColorAverage(messageColor, black, Math.trunc(75 * i / MESSAGE_LINES));
                }
            }

            if (m >= state.displayedMessage[i].length) break;

            ctx.plotCharWithColor(
                state.displayedMessage[i].charCodeAt(m) as DisplayGlyph,
                { windowX: mapToWindowX(j), windowY: MESSAGE_LINES - i - 1 },
                messageColor,
                black,
            );
            j++;
            m++;
        }
        for (; j < DCOLS; j++) {
            ctx.plotCharWithColor(
                32 as DisplayGlyph, // space
                { windowX: mapToWindowX(j), windowY: MESSAGE_LINES - i - 1 },
                black,
                black,
            );
        }
    }
}

/**
 * Display recent archived messages after recalculating message confirmations.
 *
 * C: `displayRecentMessages` in IO.c
 */
export function displayRecentMessages(ctx: MessageContext): void {
    const { messageState: state } = ctx;

    const { buffer, latestMessageLines } = formatRecentMessages(
        state,
        MESSAGE_LINES,
        ctx.rogue.playerTurnNumber,
    );
    state.messagesUnconfirmed = latestMessageLines;

    // Copy from buffer (most recent at bottom) into displayedMessage
    // (index 0 = most recent)
    for (let i = 0; i < MESSAGE_LINES; i++) {
        state.displayedMessage[i] = buffer[MESSAGE_LINES - i - 1];
    }

    updateMessageDisplay(ctx);
}

/**
 * Clear all displayed messages. Does NOT clear the archive.
 *
 * C: `deleteMessages` in IO.c
 */
export function deleteMessages(ctx: MessageContext): void {
    for (let i = 0; i < MESSAGE_LINES; i++) {
        ctx.messageState.displayedMessage[i] = "";
    }
    confirmMessages(ctx);
}

/**
 * Mark all messages as confirmed (no more highlighting).
 *
 * C: `confirmMessages` in IO.c
 */
export function confirmMessages(ctx: MessageContext): void {
    ctx.messageState.messagesUnconfirmed = 0;
    updateMessageDisplay(ctx);
}

/**
 * Empty the message archive.
 *
 * C: `clearMessageArchive` in IO.c
 */
export function clearMessageArchive(state: MessageState): void {
    state.archivePosition = 0;
    for (let i = 0; i < MESSAGE_ARCHIVE_ENTRIES; i++) {
        state.archive[i].message = "";
        state.archive[i].count = 0;
        state.archive[i].turn = 0;
        state.archive[i].flags = 0;
    }
}

/**
 * Show "--MORE--" indicator and wait for acknowledgment.
 *
 * C: `displayMoreSign` in IO.c
 */
export async function displayMoreSign(ctx: MessageContext): Promise<void> {
    if (ctx.rogue.autoPlayingLevel) {
        return;
    }

    const state = ctx.messageState;

    if (strLenWithoutEscapes(state.displayedMessage[0]) < DCOLS - 8 || state.messagesUnconfirmed > 0) {
        printString("--MORE--", COLS - 8, MESSAGE_LINES - 1, white, black, ctx.displayBuffer);
        await ctx.waitForAcknowledgment();
        printString("        ", COLS - 8, MESSAGE_LINES - 1, black, black, ctx.displayBuffer);
    } else {
        printString("--MORE--", COLS - 8, MESSAGE_LINES, white, black, ctx.displayBuffer);
        await ctx.waitForAcknowledgment();
        for (let i = 1; i <= 8; i++) {
            ctx.refreshDungeonCell({ x: DCOLS - i, y: 0 });
        }
    }
}

/**
 * Show "--MORE--" without waiting (used for posthumous inventory viewing).
 *
 * C: `displayMoreSignWithoutWaitingForAcknowledgment` in IO.c
 */
export function displayMoreSignWithoutWaitingForAcknowledgment(ctx: MessageContext): void {
    const state = ctx.messageState;

    if (strLenWithoutEscapes(state.displayedMessage[0]) < DCOLS - 8 || state.messagesUnconfirmed > 0) {
        printString("--MORE--", COLS - 8, MESSAGE_LINES - 1, black, white, ctx.displayBuffer);
    } else {
        printString("--MORE--", COLS - 8, MESSAGE_LINES, black, white, ctx.displayBuffer);
    }
}

// =============================================================================
// Main message functions
// =============================================================================

/**
 * Insert or collapse a new message into the archive and redraw the recent
 * message display.
 *
 * C: `message` in IO.c
 */
export async function message(ctx: MessageContext, msg: string, flags: number): Promise<void> {
    if (!msg) {
        return;
    }

    ctx.rogue.disturbed = true;

    if (flags & MessageFlag.REQUIRE_ACKNOWLEDGMENT || flags & MessageFlag.REFRESH_SIDEBAR) {
        ctx.refreshSideBar(-1, -1, false);
    }

    await displayCombatText(ctx);

    addMessageToArchive(ctx.messageState, msg, flags, ctx.rogue.playerTurnNumber);
    displayRecentMessages(ctx);

    if ((flags & MessageFlag.REQUIRE_ACKNOWLEDGMENT) || ctx.rogue.cautiousMode) {
        await displayMoreSign(ctx);
        confirmMessages(ctx);
        ctx.rogue.cautiousMode = false;
    }

    if (ctx.rogue.playbackMode) {
        ctx.rogue.playbackDelayThisTurn += Math.min(2000, ctx.rogue.playbackDelayPerTurn * 5);
    }
}

/**
 * Send a message with a color prefix.
 *
 * C: `messageWithColor` in IO.c
 */
export async function messageWithColor(ctx: MessageContext, msg: string, theColor: Readonly<Color>, flags: number): Promise<void> {
    const prefix = encodeMessageColor(theColor);
    await message(ctx, prefix + msg, flags);
}

/**
 * Display a flavor text string in the bottom flavor line (ROWS-2).
 * This is NOT archived.
 *
 * C: `flavorMessage` in IO.c
 */
export function flavorMessage(ctx: MessageContext, msg: string): void {
    // Copy and capitalize
    let text = msg.substring(0, COLS * 2);

    // Skip leading color escapes, then capitalize the first visible char
    let i = 0;
    while (i < text.length && text.charCodeAt(i) === COLOR_ESCAPE) {
        i += 4;
    }
    if (i < text.length) {
        text = text.substring(0, i) + text.charAt(i).toUpperCase() + text.substring(i + 1);
    }

    printString(text, mapToWindowX(0), ROWS - 2, flavorTextColor, black, ctx.displayBuffer);

    // Clear remainder of the line
    const visLen = strLenWithoutEscapes(text);
    for (let j = visLen; j < DCOLS; j++) {
        ctx.plotCharWithColor(
            32 as DisplayGlyph, // space
            { windowX: mapToWindowX(j), windowY: ROWS - 2 },
            black,
            black,
        );
    }
}

/**
 * Clear the message area and print a temporary prompt. It will disappear
 * when messages are refreshed and will not be archived.
 *
 * C: `temporaryMessage` in IO.c
 */
export async function temporaryMessage(ctx: MessageContext, msg: string, flags: number): Promise<void> {
    // Capitalize the first visible character (skipping leading color escapes)
    let text = msg;
    let i = 0;
    while (i < text.length && text.charCodeAt(i) === COLOR_ESCAPE) {
        i += 4;
    }
    if (i < text.length) {
        text = text.substring(0, i) + text.charAt(i).toUpperCase() + text.substring(i + 1);
    }

    if (flags & MessageFlag.REFRESH_SIDEBAR) {
        ctx.refreshSideBar(-1, -1, false);
    }

    // Clear the message area
    for (let row = 0; row < MESSAGE_LINES; row++) {
        for (let col = 0; col < DCOLS; col++) {
            ctx.plotCharWithColor(
                32 as DisplayGlyph,
                { windowX: mapToWindowX(col), windowY: row },
                black,
                black,
            );
        }
    }

    printString(text, mapToWindowX(0), mapToWindowY(-1), white, black, ctx.displayBuffer);

    if (flags & MessageFlag.REQUIRE_ACKNOWLEDGMENT) {
        await ctx.waitForAcknowledgment();
        updateMessageDisplay(ctx);
    }
}

// =============================================================================
// Combat text buffering
// =============================================================================

/**
 * Buffer a combat message for later display. Combat messages are buffered
 * to ensure player combat messages appear before monster ones.
 *
 * C: `combatMessage` in Combat.c
 */
export async function combatMessage(ctx: MessageContext, msg: string, theColor: Readonly<Color> | null): Promise<void> {
    const color = theColor ?? white;

    const prefix = encodeMessageColor(color);
    const newMsg = prefix + msg;

    const state = ctx.messageState;

    // If the buffer would overflow, flush it first
    if (state.combatText.length + newMsg.length > COLS * 2 - 2) {
        await displayCombatText(ctx);
    }

    if (state.combatText) {
        state.combatText += "\n" + newMsg;
    } else {
        state.combatText = newMsg;
    }
}

/**
 * Flush the buffered combat text as FOLDABLE messages.
 *
 * C: `displayCombatText` in Combat.c
 */
export async function displayCombatText(ctx: MessageContext): Promise<void> {
    const state = ctx.messageState;

    if (!state.combatText) {
        return;
    }

    // Copy out and clear to prevent recursion (message() calls displayCombatText)
    const buf = state.combatText;
    state.combatText = "";

    const lines = buf.split("\n");
    for (const line of lines) {
        if (line) {
            await message(
                ctx,
                line,
                MessageFlag.FOLDABLE | (ctx.rogue.cautiousMode ? MessageFlag.REQUIRE_ACKNOWLEDGMENT : 0),
            );
        }
    }

    ctx.rogue.cautiousMode = false;
}

// =============================================================================
// Message archive UI (pull-down display)
// =============================================================================

/**
 * Draw formatted messages in the message archive overlay.
 *
 * C: `drawMessageArchive` (static) in IO.c
 */
function drawMessageArchive(
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

/**
 * Pull-down / pull-up animation for the message archive.
 *
 * C: `animateMessageArchive` (static) in IO.c
 */
async function animateMessageArchive(
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

/**
 * Accept keyboard input to navigate or dismiss the opened message archive.
 * Returns the new offset.
 *
 * C: `scrollMessageArchive` (static) in IO.c
 */
async function scrollMessageArchive(
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
                    ctx.flashTemporaryAlert(" -- Press space or click to continue -- ", 500);
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

/**
 * Display the full message archive with pull-down animation, scrolling,
 * and pull-up animation.
 *
 * C: `displayMessageArchive` in IO.c
 */
export async function displayMessageArchive(ctx: MessageContext): Promise<void> {
    const { buffer: messageBuffer, linesFormatted: length } = formatRecentMessages(
        ctx.messageState,
        MESSAGE_ARCHIVE_LINES,
        ctx.rogue.playerTurnNumber,
    );

    if (length <= MESSAGE_LINES) {
        return;
    }

    const height = Math.min(length, MESSAGE_ARCHIVE_VIEW_LINES);
    let offset = height;

    await animateMessageArchive(ctx, true, messageBuffer, length, offset, height);
    offset = await scrollMessageArchive(ctx, messageBuffer, length, offset, height);
    await animateMessageArchive(ctx, false, messageBuffer, length, offset, height);

    ctx.updateFlavorText();
    confirmMessages(ctx);
    updateMessageDisplay(ctx);
}
