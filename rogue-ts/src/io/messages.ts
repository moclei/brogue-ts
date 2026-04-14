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
import {
    COLS, ROWS, DCOLS, MESSAGE_LINES,
    MESSAGE_ARCHIVE_ENTRIES, MESSAGE_ARCHIVE_LINES, MESSAGE_ARCHIVE_VIEW_LINES,
    COLOR_ESCAPE,
} from "../types/constants.js";
import { MessageFlag } from "../types/flags.js";
import { black, white, flavorTextColor } from "../globals/colors.js";
import { strLenWithoutEscapes, printString } from "./text.js";
import { encodeMessageColor, decodeMessageColor, applyColorAverage } from "./color.js";
import {
    mapToWindowX, mapToWindowY,
} from "./display.js";
import {
    type MessageState,
    type MessageContext,
    formatRecentMessages,
    addMessageToArchive,
} from "./messages-state.js";
import {
    animateMessageArchive,
    scrollMessageArchive,
} from "./messages-archive-buffer.js";
import {
    isDOMMessagesEnabled,
    renderMessages as renderMessagesDOM,
    showMoreSign as showMoreSignDOM,
    hideMoreSign as hideMoreSignDOM,
    showMessageArchiveDOM,
} from "../platform/ui-messages.js";
import {
    isDOMBottomBarEnabled,
    updateFlavorTextDOM,
} from "../platform/ui-bottom-bar.js";

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

    // DOM path — render messages as styled HTML spans
    if (isDOMMessagesEnabled()) {
        renderMessagesDOM(state.displayedMessage, state.messagesUnconfirmed);
        return;
    }

    // Buffer path (kept for fallback / non-DOM builds)
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

    if (isDOMMessagesEnabled()) {
        showMoreSignDOM();
        await ctx.waitForAcknowledgment();
        hideMoreSignDOM();
        return;
    }

    // Buffer path
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

    if (isDOMBottomBarEnabled()) {
        updateFlavorTextDOM(text);
        return;
    }

    // Buffer path
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

    if (isDOMMessagesEnabled()) {
        // DOM path: scrollable overlay panel, replaces the buffer-animated version.
        // Pass only the non-empty lines (oldest first).
        const lines = messageBuffer.slice(0, length);
        await showMessageArchiveDOM(lines);
        ctx.updateFlavorText();
        confirmMessages(ctx);
        updateMessageDisplay(ctx);
        return;
    }

    // Buffer path (kept for fallback)
    const height = Math.min(length, MESSAGE_ARCHIVE_VIEW_LINES);
    let offset = height;

    await animateMessageArchive(ctx, true, messageBuffer, length, offset, height);
    offset = await scrollMessageArchive(ctx, messageBuffer, length, offset, height);
    await animateMessageArchive(ctx, false, messageBuffer, length, offset, height);

    ctx.updateFlavorText();
    confirmMessages(ctx);
    updateMessageDisplay(ctx);
}
