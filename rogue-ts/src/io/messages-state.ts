/*
 *  messages-state.ts — Message system types, state, and pure helpers
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Contains: ArchivedMessage, MessageState, MessageContext interfaces,
 *            createMessageState(), getArchivedMessage(), formatCountedMessage(),
 *            foldMessages(), formatRecentMessages(), addMessageToArchive()
 *
 *  Pure archive logic operates on MessageState; rendering uses MessageContext.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, ScreenDisplayBuffer, SavedDisplayBuffer, WindowPos, Pos, RogueEvent, PauseBehavior } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import {
    DCOLS, MESSAGE_LINES,
    MESSAGE_ARCHIVE_ENTRIES,
    MAX_MESSAGE_REPEATS,
} from "../types/constants.js";
import { MessageFlag } from "../types/flags.js";
import { strLenWithoutEscapes, wrapText, capitalizeAndPunctuateSentences, splitLines } from "./text.js";

// =============================================================================
// Types
// =============================================================================

/** A single entry in the message archive ring buffer. C: `archivedMessage` */
export interface ArchivedMessage {
    message: string;
    count: number;           // how many times this message appears
    turn: number;            // player turn of the first occurrence
    flags: number;           // message flags (FOLDABLE, REQUIRE_ACKNOWLEDGMENT, etc.)
}

/** Mutable state for the message system. */
export interface MessageState {
    /** Ring buffer of archived messages. Length = MESSAGE_ARCHIVE_ENTRIES. */
    archive: ArchivedMessage[];
    /** Current write position in the ring buffer. */
    archivePosition: number;
    /** Currently displayed message strings (MESSAGE_LINES entries, index 0 = most recent). */
    displayedMessage: string[];
    /** Number of lines from the current turn (shown without dimming). */
    messagesUnconfirmed: number;
    /** Buffered combat text (flushed by displayCombatText). */
    combatText: string;
}

/**
 * DI context for message rendering and interaction.
 *
 * Pure archive logic (formatCountedMessage, foldMessages, formatRecentMessages,
 * addMessageToArchive) can operate on MessageState directly.
 * Rendering functions (message, temporaryMessage, displayMessageArchive, etc.)
 * need this context for side effects.
 */
export interface MessageContext {
    rogue: {
        playerTurnNumber: number;
        cautiousMode: boolean;
        disturbed: boolean;
        autoPlayingLevel: boolean;
        playbackMode: boolean;
        playbackOOS: boolean;
        playbackDelayThisTurn: number;
        playbackDelayPerTurn: number;
        playbackFastForward: boolean;
    };
    messageState: MessageState;
    displayBuffer: ScreenDisplayBuffer;

    // Rendering
    plotCharWithColor(ch: DisplayGlyph, pos: WindowPos, fg: Readonly<Color>, bg: Readonly<Color>): void;

    // Display buffer operations (these operate on ctx.displayBuffer)
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;

    // Interaction callbacks
    refreshSideBar(x: number, y: number, forceFullUpdate: boolean): void;
    refreshDungeonCell(loc: Pos): void;
    waitForAcknowledgment(): void | Promise<void>;
    pauseBrogue(ms: number, behavior: PauseBehavior): boolean;
    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInput: boolean): RogueEvent;
    flashTemporaryAlert(msg: string, ms: number): void | Promise<void>;
    updateFlavorText(): void;
    stripShiftFromMovementKeystroke(keystroke: number): number;
}

// =============================================================================
// State construction
// =============================================================================

/** Create a fresh MessageState with empty archive and display. */
export function createMessageState(): MessageState {
    const archive: ArchivedMessage[] = new Array(MESSAGE_ARCHIVE_ENTRIES);
    for (let i = 0; i < MESSAGE_ARCHIVE_ENTRIES; i++) {
        archive[i] = { message: "", count: 0, turn: 0, flags: 0 };
    }

    const displayedMessage: string[] = new Array(MESSAGE_LINES);
    for (let i = 0; i < MESSAGE_LINES; i++) {
        displayedMessage[i] = "";
    }

    return {
        archive,
        archivePosition: 0,
        displayedMessage,
        messagesUnconfirmed: 0,
        combatText: "",
    };
}

// =============================================================================
// Pure archive logic (no side effects, testable without DI)
// =============================================================================

/**
 * Get the archived message the given number of entries back in history.
 * Pass 0 to get the entry under archivePosition (the next write slot).
 * Pass 1 to get the most recently written entry.
 *
 * C: `getArchivedMessage` (static) in IO.c
 */
export function getArchivedMessage(state: MessageState, back: number): ArchivedMessage {
    return state.archive[
        (state.archivePosition + MESSAGE_ARCHIVE_ENTRIES - back) % MESSAGE_ARCHIVE_ENTRIES
    ];
}

/**
 * Format a message with its repeat count.
 *
 * C: `formatCountedMessage` (static) in IO.c
 */
export function formatCountedMessage(m: ArchivedMessage): string {
    if (m.count <= 1) {
        return m.message;
    } else if (m.count >= MAX_MESSAGE_REPEATS) {
        return `${m.message} (many)`;
    } else {
        return `${m.message} (x${m.count})`;
    }
}

/**
 * Select and write one or more recent messages for further formatting.
 * FOLDABLE messages from the same turn are combined with semicolons;
 * otherwise only one message is taken.
 *
 * Returns `{ text, folded, turn }` where `folded` is the number of archive
 * entries consumed and `turn` is the player turn number of those entries.
 * Returns `folded === 0` when there are no more messages.
 *
 * C: `foldMessages` (static) in IO.c
 */
export function foldMessages(
    state: MessageState,
    offset: number,
): { text: string; folded: number; turn: number } {
    let folded = 0;

    const first = getArchivedMessage(state, offset + folded + 1);
    if (!first.message) {
        return { text: "", folded: 0, turn: 0 };
    }

    folded++;
    const turn = first.turn;

    // If the first message is not foldable, just return it formatted
    if (!(first.flags & MessageFlag.FOLDABLE)) {
        return { text: formatCountedMessage(first), folded, turn };
    }

    // Search back for more eligible foldable messages from the same turn
    let next = getArchivedMessage(state, offset + folded + 1);
    while (
        folded < MESSAGE_ARCHIVE_ENTRIES &&
        next.message &&
        (next.flags & MessageFlag.FOLDABLE) &&
        turn === next.turn
    ) {
        folded++;
        next = getArchivedMessage(state, offset + folded + 1);
    }

    // Build the combined message from oldest to newest
    let lineLength = 0;
    let result = "";

    for (let i = folded; i >= 1; i--) {
        const m = getArchivedMessage(state, offset + i);
        const counted = formatCountedMessage(m);
        const messageLength = strLenWithoutEscapes(counted);

        if (result.length === 0) {
            result = counted;
            lineLength = messageLength;
        } else if (lineLength + 3 + messageLength <= DCOLS) {
            // +3 for "; " separator and final "."
            result += `; ${counted}`;
            lineLength += 2 + messageLength;
        } else {
            result += `.\n${counted}`;
            lineLength = messageLength;
        }
    }

    result += ".";
    return { text: result, folded, turn };
}

/**
 * Fill a buffer with formatted archived messages. Fills from the bottom,
 * so that the most recent message appears in the last row.
 *
 * Returns `{ linesFormatted, latestMessageLines }`.
 *
 * C: `formatRecentMessages` in IO.c
 */
export function formatRecentMessages(
    state: MessageState,
    height: number,
    playerTurnNumber: number,
): { buffer: string[]; linesFormatted: number; latestMessageLines: number } {
    const buffer: string[] = new Array(height).fill("");
    let bufferCursor = height - 1;
    let messagesFormatted = 0;
    let linesFormatted = 0;
    let latestMessageLines = 0;

    while (bufferCursor >= 0 && messagesFormatted < MESSAGE_ARCHIVE_ENTRIES) {
        const { text: folded, folded: messagesFolded, turn } = foldMessages(state, messagesFormatted);
        if (messagesFolded === 0) {
            break;
        }

        const capitalized = capitalizeAndPunctuateSentences(folded);
        const { text: wrapped, lineCount } = wrapText(capitalized, DCOLS);
        splitLines(lineCount, wrapped, buffer, bufferCursor);

        if (turn === playerTurnNumber) {
            latestMessageLines += lineCount;
        }

        bufferCursor -= lineCount;
        messagesFormatted += messagesFolded;
    }

    linesFormatted = height - 1 - bufferCursor;

    // Clear remaining rows at the top
    while (bufferCursor >= 0) {
        buffer[bufferCursor--] = "";
    }

    return { buffer, linesFormatted, latestMessageLines };
}

/**
 * Insert or collapse a message into the archive. An incoming message may
 * "collapse" into another (be dropped in favor of bumping a repetition count)
 * if the two have identical content and either arrived on the same turn or
 * the older message is the most recent and the new one is not FOLDABLE.
 *
 * Returns true if this was a new message (not collapsed).
 *
 * C: archive insertion logic from `message()` in IO.c
 */
export function addMessageToArchive(
    state: MessageState,
    msg: string,
    flags: number,
    playerTurnNumber: number,
): boolean {
    let isNew = true;

    // Check past entries for collapsing
    for (let i = 1; i < MESSAGE_ARCHIVE_ENTRIES; i++) {
        const entry = getArchivedMessage(state, i);

        // Consider messages that arrived this turn for collapsing.
        // Also consider the latest entry (which may be from past turns)
        // if the incoming message is not semi-colon foldable.
        if (!((i === 1 && !(flags & MessageFlag.FOLDABLE)) || entry.turn === playerTurnNumber)) {
            break;
        }

        if (entry.message === msg) {
            // Found a matching older message — collapse into it
            isNew = false;
            entry.turn = playerTurnNumber;
            if (entry.count < MAX_MESSAGE_REPEATS) {
                entry.count++;
            }
            break;
        }
    }

    // Not collapsed — insert a new entry
    if (isNew) {
        const entry = state.archive[state.archivePosition];
        entry.message = msg;
        entry.count = 1;
        entry.turn = playerTurnNumber;
        entry.flags = flags;
        state.archivePosition = (state.archivePosition + 1) % MESSAGE_ARCHIVE_ENTRIES;
    }

    return isNew;
}
