/*
 *  recording-events.ts — Event recording and recall functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c
 *  Functions: recordEvent, recordKeystroke, cancelKeystroke,
 *             recordKeystrokeSequence, recordMouseClick,
 *             recallEvent, OOSCheck, RNGCheck
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { RogueEvent } from "../types/types.js";
import { EventType } from "../types/enums.js";
import { UNKNOWN_KEY } from "../types/constants.js";
import {
    compressKeystroke,
    uncompressKeystroke,
    recordChar,
    recallChar,
    recordNumber,
    recallNumber,
    considerFlushingBufferToFile,
    type RecordingBuffer,
    type RecordingBufferContext,
} from "./recording-state.js";

// =============================================================================
// Fl() macro — bitfield flag helper (matches C `Fl(N)`)
// =============================================================================

function Fl(n: number): number {
    return 1 << n;
}

// =============================================================================
// Event Recording
// =============================================================================

/**
 * Record a game event into the recording buffer.
 * Port of C `recordEvent()`.
 *
 * Keystrokes: Event type, compressed keystroke, modifier flags (3 bytes).
 * Mouse events: Event type, x, y, modifier flags (4 bytes).
 */
export function recordEvent(
    event: RogueEvent,
    buf: RecordingBuffer,
    playbackMode: boolean,
): void {
    if (playbackMode) {
        return;
    }

    recordChar(buf, event.eventType);

    if (event.eventType === EventType.Keystroke) {
        const c = compressKeystroke(event.param1);
        if (c === UNKNOWN_KEY) {
            return;
        }
        recordChar(buf, c);
    } else {
        recordChar(buf, event.param1 & 0xFF);
        recordChar(buf, event.param2 & 0xFF);
    }

    // Record the modifier keys
    let modifiers = 0;
    if (event.controlKey) {
        modifiers += Fl(1);
    }
    if (event.shiftKey) {
        modifiers += Fl(2);
    }
    recordChar(buf, modifiers);
}

/**
 * Record a keystroke event (convenience wrapper).
 * Port of C `recordKeystroke()`.
 */
export function recordKeystroke(
    keystroke: number,
    controlKey: boolean,
    shiftKey: boolean,
    buf: RecordingBuffer,
    playbackMode: boolean,
): void {
    if (playbackMode) {
        return;
    }

    const event: RogueEvent = {
        eventType: EventType.Keystroke,
        param1: keystroke,
        param2: 0,
        controlKey,
        shiftKey,
    };
    recordEvent(event, buf, playbackMode);
}

/**
 * Cancel the last recorded keystroke (rewind 3 bytes).
 * Port of C `cancelKeystroke()`.
 */
export function cancelKeystroke(buf: RecordingBuffer): void {
    // A keystroke is encoded as 3 bytes: eventType, compressed key, modifiers
    if (buf.bufferPosition >= 3) {
        buf.bufferPosition -= 3;
        buf.streamPosition -= 3;
    }
}

/**
 * Record a series of keystrokes from a string.
 * Port of C `recordKeystrokeSequence()`.
 */
export function recordKeystrokeSequence(
    sequence: string,
    buf: RecordingBuffer,
    playbackMode: boolean,
): void {
    for (let i = 0; i < sequence.length; i++) {
        recordKeystroke(sequence.charCodeAt(i), false, false, buf, playbackMode);
    }
}

/**
 * Record a mouse click event (convenience wrapper).
 * Port of C `recordMouseClick()`.
 */
export function recordMouseClick(
    x: number,
    y: number,
    controlKey: boolean,
    shiftKey: boolean,
    buf: RecordingBuffer,
    playbackMode: boolean,
): void {
    if (playbackMode) {
        return;
    }

    const event: RogueEvent = {
        eventType: EventType.MouseUp,
        param1: x,
        param2: y,
        controlKey,
        shiftKey,
    };
    recordEvent(event, buf, playbackMode);
}

// =============================================================================
// Event Recall
// =============================================================================

/**
 * Callback for playback panic (out-of-sync) handling.
 * The actual UI is Phase 3; we just invoke the callback.
 */
export interface PlaybackPanicHandler {
    onPlaybackPanic(message: string): void;
}

/**
 * Recall a game event from the recording buffer during playback.
 * Port of C `recallEvent()`.
 */
export function recallEvent(
    buf: RecordingBuffer,
    refillBuffer: () => void,
    panicHandler: PlaybackPanicHandler | null,
    gameHasEnded: () => boolean,
): RogueEvent {
    const event: RogueEvent = {
        eventType: EventType.Keystroke,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };

    let tryAgain = false;

    do {
        tryAgain = false;
        const c = recallChar(buf, refillBuffer);
        event.eventType = c;

        switch (c) {
            case EventType.Keystroke:
                event.param1 = uncompressKeystroke(recallChar(buf, refillBuffer));
                event.param2 = 0;
                break;

            case EventType.SavedGameLoaded:
                tryAgain = true;
                // C code does flashTemporaryAlert(" Saved game loaded ", 1000)
                // That's a UI operation — skip in core module.
                break;

            case EventType.MouseUp:
            case EventType.MouseDown:
            case EventType.MouseEnteredCell:
            case EventType.RightMouseUp:
            case EventType.RightMouseDown:
                event.param1 = recallChar(buf, refillBuffer);
                event.param2 = recallChar(buf, refillBuffer);
                break;

            case EventType.RNGCheck:
            case EventType.EndOfRecording:
            case EventType.EventError:
            default:
                if (panicHandler) {
                    panicHandler.onPlaybackPanic(
                        `Unrecognized event type in playback: event ID ${c}`
                    );
                }
                tryAgain = true;
                break;
        }
    } while (tryAgain && !gameHasEnded());

    // Recall the modifier key flags
    const modByte = recallChar(buf, refillBuffer);
    event.controlKey = (modByte & Fl(1)) !== 0;
    event.shiftKey = (modByte & Fl(2)) !== 0;

    return event;
}

// =============================================================================
// Out-of-Sync Checking
// =============================================================================

/**
 * Perform an out-of-sync check.
 * During recording: writes an RNG_CHECK event + the value.
 * During playback: reads and compares the recorded value.
 *
 * Port of C `OOSCheck()`.
 */
export function OOSCheck(
    x: number,
    numberOfBytes: number,
    ctx: RecordingBufferContext,
    refillBuffer: () => void,
    panicHandler: PlaybackPanicHandler | null,
): void {
    if (ctx.rogue.playbackMode) {
        const eventType = recallChar(ctx.buffer, refillBuffer);
        const recordedNumber = recallNumber(ctx.buffer, numberOfBytes, refillBuffer);
        if (eventType !== EventType.RNGCheck || Number(recordedNumber) !== x) {
            if (eventType !== EventType.RNGCheck) {
                if (panicHandler) {
                    panicHandler.onPlaybackPanic("Event type mismatch in RNG check.");
                }
            } else {
                if (panicHandler) {
                    panicHandler.onPlaybackPanic(
                        `Expected RNG output of ${Number(recordedNumber)}; got ${x}.`
                    );
                }
            }
        }
    } else {
        recordChar(ctx.buffer, EventType.RNGCheck);
        recordNumber(ctx.buffer, x, numberOfBytes);
        considerFlushingBufferToFile(ctx);
    }
}

/**
 * Context needed for the full RNGCheck function.
 */
export interface RNGCheckContext extends RecordingBufferContext {
    rogue: RecordingBufferContext["rogue"] & {
        RNG: number;
    };
    /** The substantive RNG stream index. */
    RNG_SUBSTANTIVE: number;
    /** Generate a random number in [lower, upper]. */
    randRange(lower: number, upper: number): number;
}

/**
 * Compare a random number once per player turn to detect out-of-sync during playback.
 * Port of C `RNGCheck()`.
 */
export function RNGCheck(
    ctx: RNGCheckContext,
    refillBuffer: () => void,
    panicHandler: PlaybackPanicHandler | null,
): void {
    const oldRNG = ctx.rogue.RNG;
    ctx.rogue.RNG = ctx.RNG_SUBSTANTIVE;

    const randomNumber = ctx.randRange(0, 255);
    OOSCheck(randomNumber, 1, ctx, refillBuffer, panicHandler);

    ctx.rogue.RNG = oldRNG;
}
