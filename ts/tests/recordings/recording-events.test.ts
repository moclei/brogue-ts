/*
 *  recording-events.test.ts — Tests for event recording and recall
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    recordEvent,
    recordKeystroke,
    cancelKeystroke,
    recordKeystrokeSequence,
    recordMouseClick,
    recallEvent,
    OOSCheck,
    RNGCheck,
    type PlaybackPanicHandler,
    type RNGCheckContext,
} from "../../src/recordings/recording-events.js";
import {
    createRecordingBuffer,
    compressKeystroke,
    recallChar,
    type RecordingBuffer,
    type RecordingBufferContext,
    type RecordingFileIO,
} from "../../src/recordings/recording-state.js";
import type { RogueEvent } from "../../src/types/types.js";
import { EventType } from "../../src/types/enums.js";
import {
    UP_ARROW, ESCAPE_KEY, RETURN_KEY, UNKNOWN_KEY,
    INPUT_RECORD_BUFFER,
} from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function makeFileIO(): RecordingFileIO {
    return {
        fileExists: vi.fn().mockReturnValue(true),
        appendBytes: vi.fn(),
        readBytes: vi.fn().mockReturnValue({ bytes: new Uint8Array(INPUT_RECORD_BUFFER), newOffset: 0 }),
        writeHeader: vi.fn(),
        removeFile: vi.fn(),
        renameFile: vi.fn(),
        copyFile: vi.fn(),
    };
}

function makeBufferCtx(buf?: RecordingBuffer): RecordingBufferContext {
    return {
        buffer: buf ?? createRecordingBuffer(),
        rogue: {
            versionString: "CE 1.15.1",
            mode: 0,
            seed: 12345n,
            playerTurnNumber: 0,
            deepestLevel: 1,
            playbackMode: false,
        },
        currentFilePath: "/test/recording.broguerec",
        fileIO: makeFileIO(),
    };
}

function noop() {}

function panicHandler(): PlaybackPanicHandler {
    return { onPlaybackPanic: vi.fn() };
}

// =============================================================================
// recordEvent
// =============================================================================

describe("recordEvent", () => {
    it("records a keystroke event as 3 bytes", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "a".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        recordEvent(event, buf, false);

        expect(buf.bufferPosition).toBe(3);
        expect(buf.data[0]).toBe(EventType.Keystroke);
        expect(buf.data[1]).toBe("a".charCodeAt(0)); // ASCII, no compression needed
        expect(buf.data[2]).toBe(0); // no modifiers
    });

    it("records a special keystroke with compression", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: UP_ARROW,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        recordEvent(event, buf, false);

        expect(buf.bufferPosition).toBe(3);
        expect(buf.data[1]).toBe(compressKeystroke(UP_ARROW));
    });

    it("records modifier keys correctly", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "x".charCodeAt(0),
            param2: 0,
            controlKey: true,
            shiftKey: true,
        };

        recordEvent(event, buf, false);

        expect(buf.data[2]).toBe((1 << 1) + (1 << 2)); // Fl(1) + Fl(2)
    });

    it("records ctrl-only modifier", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "c".charCodeAt(0),
            param2: 0,
            controlKey: true,
            shiftKey: false,
        };

        recordEvent(event, buf, false);

        expect(buf.data[2]).toBe(1 << 1); // Fl(1)
    });

    it("records shift-only modifier", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "A".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: true,
        };

        recordEvent(event, buf, false);

        expect(buf.data[2]).toBe(1 << 2); // Fl(2)
    });

    it("records a mouse event as 4 bytes", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.MouseUp,
            param1: 50, // x
            param2: 20, // y
            controlKey: false,
            shiftKey: false,
        };

        recordEvent(event, buf, false);

        expect(buf.bufferPosition).toBe(4);
        expect(buf.data[0]).toBe(EventType.MouseUp);
        expect(buf.data[1]).toBe(50);
        expect(buf.data[2]).toBe(20);
        expect(buf.data[3]).toBe(0); // no modifiers
    });

    it("does nothing in playback mode", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "a".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        recordEvent(event, buf, true);

        expect(buf.bufferPosition).toBe(0);
    });

    it("aborts on UNKNOWN_KEY and only writes eventType", () => {
        const buf = createRecordingBuffer();
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: 99999, // will compress to UNKNOWN_KEY
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        recordEvent(event, buf, false);

        // eventType byte is written, then UNKNOWN_KEY detected and returns early
        expect(buf.bufferPosition).toBe(1);
    });
});

// =============================================================================
// recordKeystroke
// =============================================================================

describe("recordKeystroke", () => {
    it("records a simple keystroke", () => {
        const buf = createRecordingBuffer();
        recordKeystroke("z".charCodeAt(0), false, false, buf, false);

        expect(buf.bufferPosition).toBe(3);
        expect(buf.data[0]).toBe(EventType.Keystroke);
        expect(buf.data[1]).toBe("z".charCodeAt(0));
        expect(buf.data[2]).toBe(0);
    });

    it("does nothing in playback mode", () => {
        const buf = createRecordingBuffer();
        recordKeystroke("z".charCodeAt(0), false, false, buf, true);
        expect(buf.bufferPosition).toBe(0);
    });
});

// =============================================================================
// cancelKeystroke
// =============================================================================

describe("cancelKeystroke", () => {
    it("rewinds 3 bytes", () => {
        const buf = createRecordingBuffer();
        recordKeystroke("a".charCodeAt(0), false, false, buf, false);
        expect(buf.bufferPosition).toBe(3);
        expect(buf.streamPosition).toBe(3);

        cancelKeystroke(buf);

        expect(buf.bufferPosition).toBe(0);
        expect(buf.streamPosition).toBe(0);
    });

    it("does not underflow when buffer has < 3 bytes", () => {
        const buf = createRecordingBuffer();
        buf.bufferPosition = 2;
        buf.streamPosition = 2;

        cancelKeystroke(buf);

        // Should not go negative — the assertion in C would fail, but we just skip
        expect(buf.bufferPosition).toBe(2);
        expect(buf.streamPosition).toBe(2);
    });

    it("cancels only the last keystroke when multiple recorded", () => {
        const buf = createRecordingBuffer();
        recordKeystroke("a".charCodeAt(0), false, false, buf, false);
        recordKeystroke("b".charCodeAt(0), false, false, buf, false);
        expect(buf.bufferPosition).toBe(6);

        cancelKeystroke(buf);

        expect(buf.bufferPosition).toBe(3);
        // First keystroke still intact
        expect(buf.data[0]).toBe(EventType.Keystroke);
        expect(buf.data[1]).toBe("a".charCodeAt(0));
    });
});

// =============================================================================
// recordKeystrokeSequence
// =============================================================================

describe("recordKeystrokeSequence", () => {
    it("records each character as a separate keystroke", () => {
        const buf = createRecordingBuffer();
        recordKeystrokeSequence("abc", buf, false);

        expect(buf.bufferPosition).toBe(9); // 3 keystrokes × 3 bytes each
        expect(buf.data[1]).toBe("a".charCodeAt(0));
        expect(buf.data[4]).toBe("b".charCodeAt(0));
        expect(buf.data[7]).toBe("c".charCodeAt(0));
    });

    it("records empty string as no events", () => {
        const buf = createRecordingBuffer();
        recordKeystrokeSequence("", buf, false);
        expect(buf.bufferPosition).toBe(0);
    });
});

// =============================================================================
// recordMouseClick
// =============================================================================

describe("recordMouseClick", () => {
    it("records a mouse click as 4 bytes", () => {
        const buf = createRecordingBuffer();
        recordMouseClick(30, 15, false, false, buf, false);

        expect(buf.bufferPosition).toBe(4);
        expect(buf.data[0]).toBe(EventType.MouseUp);
        expect(buf.data[1]).toBe(30);
        expect(buf.data[2]).toBe(15);
        expect(buf.data[3]).toBe(0);
    });

    it("records mouse click with modifiers", () => {
        const buf = createRecordingBuffer();
        recordMouseClick(10, 5, true, true, buf, false);

        expect(buf.data[3]).toBe((1 << 1) + (1 << 2)); // ctrl + shift
    });

    it("does nothing in playback mode", () => {
        const buf = createRecordingBuffer();
        recordMouseClick(10, 5, false, false, buf, true);
        expect(buf.bufferPosition).toBe(0);
    });
});

// =============================================================================
// recallEvent
// =============================================================================

describe("recallEvent", () => {
    it("recalls a keystroke event", () => {
        const buf = createRecordingBuffer();
        // Manually write a keystroke: eventType, compressed key, modifiers
        buf.data[0] = EventType.Keystroke;
        buf.data[1] = "a".charCodeAt(0);
        buf.data[2] = 0; // no modifiers
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.eventType).toBe(EventType.Keystroke);
        expect(event.param1).toBe("a".charCodeAt(0));
        expect(event.controlKey).toBe(false);
        expect(event.shiftKey).toBe(false);
    });

    it("recalls a keystroke with special key decompression", () => {
        const buf = createRecordingBuffer();
        buf.data[0] = EventType.Keystroke;
        buf.data[1] = compressKeystroke(UP_ARROW);
        buf.data[2] = 0;
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.param1).toBe(UP_ARROW);
    });

    it("recalls a keystroke with modifiers", () => {
        const buf = createRecordingBuffer();
        buf.data[0] = EventType.Keystroke;
        buf.data[1] = "x".charCodeAt(0);
        buf.data[2] = (1 << 1) | (1 << 2); // ctrl + shift
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.controlKey).toBe(true);
        expect(event.shiftKey).toBe(true);
    });

    it("recalls a mouse up event", () => {
        const buf = createRecordingBuffer();
        buf.data[0] = EventType.MouseUp;
        buf.data[1] = 42; // x
        buf.data[2] = 17; // y
        buf.data[3] = 0;
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.eventType).toBe(EventType.MouseUp);
        expect(event.param1).toBe(42);
        expect(event.param2).toBe(17);
    });

    it("recalls mouse entered cell event", () => {
        const buf = createRecordingBuffer();
        buf.data[0] = EventType.MouseEnteredCell;
        buf.data[1] = 10;
        buf.data[2] = 20;
        buf.data[3] = 0;
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.eventType).toBe(EventType.MouseEnteredCell);
        expect(event.param1).toBe(10);
        expect(event.param2).toBe(20);
    });

    it("skips SavedGameLoaded events (sets tryAgain)", () => {
        const buf = createRecordingBuffer();
        // In C, SavedGameLoaded has no param bytes and no separate modifier byte.
        // The do-while loop re-reads the event type for the next event.
        // The modifier byte is read only once AFTER the loop exits.
        //
        // Layout: [SavedGameLoaded] [Keystroke] [key] [modifier]
        buf.data[0] = EventType.SavedGameLoaded;
        buf.data[1] = EventType.Keystroke;
        buf.data[2] = "b".charCodeAt(0);
        buf.data[3] = 0; // modifier for the final event
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.eventType).toBe(EventType.Keystroke);
        expect(event.param1).toBe("b".charCodeAt(0));
    });

    it("calls panic handler for unknown event types", () => {
        const buf = createRecordingBuffer();
        buf.data[0] = 255; // unknown event type
        buf.data[1] = 0; // modifier byte (read after panic/tryAgain)
        // After panic + tryAgain, game will end:
        buf.playbackFileLength = 100;

        const handler = panicHandler();
        const event = recallEvent(buf, noop, handler, () => true);

        expect(handler.onPlaybackPanic).toHaveBeenCalled();
    });

    it("round-trips a recorded keystroke event", () => {
        const buf = createRecordingBuffer();
        recordKeystroke(ESCAPE_KEY, true, false, buf, false);

        // Reset for reading
        buf.bufferPosition = 0;
        buf.streamPosition = 0;
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.eventType).toBe(EventType.Keystroke);
        expect(event.param1).toBe(ESCAPE_KEY);
        expect(event.controlKey).toBe(true);
        expect(event.shiftKey).toBe(false);
    });

    it("round-trips a recorded mouse click", () => {
        const buf = createRecordingBuffer();
        recordMouseClick(50, 25, false, true, buf, false);

        buf.bufferPosition = 0;
        buf.streamPosition = 0;
        buf.playbackFileLength = 100;

        const event = recallEvent(buf, noop, null, () => false);

        expect(event.eventType).toBe(EventType.MouseUp);
        expect(event.param1).toBe(50);
        expect(event.param2).toBe(25);
        expect(event.controlKey).toBe(false);
        expect(event.shiftKey).toBe(true);
    });
});

// =============================================================================
// OOSCheck
// =============================================================================

describe("OOSCheck", () => {
    it("records RNG_CHECK + value during recording", () => {
        const ctx = makeBufferCtx();
        OOSCheck(42, 1, ctx, noop, null);

        expect(ctx.buffer.bufferPosition).toBe(2); // eventType + 1 byte value
        expect(ctx.buffer.data[0]).toBe(EventType.RNGCheck);
        expect(ctx.buffer.data[1]).toBe(42);
    });

    it("verifies matching value during playback", () => {
        const ctx = makeBufferCtx();
        ctx.rogue.playbackMode = true;
        // Write the expected data
        ctx.buffer.data[0] = EventType.RNGCheck;
        ctx.buffer.data[1] = 42;
        ctx.buffer.playbackFileLength = 100;

        const handler = panicHandler();
        OOSCheck(42, 1, ctx, noop, handler);

        expect(handler.onPlaybackPanic).not.toHaveBeenCalled();
    });

    it("panics on event type mismatch during playback", () => {
        const ctx = makeBufferCtx();
        ctx.rogue.playbackMode = true;
        ctx.buffer.data[0] = EventType.Keystroke; // wrong type
        ctx.buffer.data[1] = 42;
        ctx.buffer.playbackFileLength = 100;

        const handler = panicHandler();
        OOSCheck(42, 1, ctx, noop, handler);

        expect(handler.onPlaybackPanic).toHaveBeenCalledWith(
            expect.stringContaining("Event type mismatch")
        );
    });

    it("panics on value mismatch during playback", () => {
        const ctx = makeBufferCtx();
        ctx.rogue.playbackMode = true;
        ctx.buffer.data[0] = EventType.RNGCheck;
        ctx.buffer.data[1] = 99; // expected 42
        ctx.buffer.playbackFileLength = 100;

        const handler = panicHandler();
        OOSCheck(42, 1, ctx, noop, handler);

        expect(handler.onPlaybackPanic).toHaveBeenCalledWith(
            expect.stringContaining("Expected RNG output")
        );
    });

    it("round-trips a 4-byte OOS check", () => {
        // Record
        const ctx = makeBufferCtx();
        OOSCheck(0xDEAD, 4, ctx, noop, null);

        expect(ctx.buffer.bufferPosition).toBe(5); // 1 + 4

        // Playback
        ctx.rogue.playbackMode = true;
        ctx.buffer.bufferPosition = 0;
        ctx.buffer.streamPosition = 0;
        ctx.buffer.playbackFileLength = 100;

        const handler = panicHandler();
        OOSCheck(0xDEAD, 4, ctx, noop, handler);

        expect(handler.onPlaybackPanic).not.toHaveBeenCalled();
    });
});

// =============================================================================
// RNGCheck
// =============================================================================

describe("RNGCheck", () => {
    it("switches to substantive RNG, records random value, and restores", () => {
        const ctx: RNGCheckContext = {
            buffer: createRecordingBuffer(),
            rogue: {
                versionString: "CE 1.15.1",
                mode: 0,
                seed: 0n,
                playerTurnNumber: 0,
                deepestLevel: 1,
                playbackMode: false,
                RNG: 99, // cosmetic
            },
            currentFilePath: "/test/rec.broguerec",
            fileIO: makeFileIO(),
            RNG_SUBSTANTIVE: 0,
            randRange: vi.fn().mockReturnValue(123),
        };

        RNGCheck(ctx, noop, null);

        // Should have switched to substantive and back
        expect(ctx.rogue.RNG).toBe(99); // restored
        // Should have called randRange(0, 255)
        expect(ctx.randRange).toHaveBeenCalledWith(0, 255);
        // Should have recorded 2 bytes (RNG_CHECK + 1 byte value)
        expect(ctx.buffer.bufferPosition).toBe(2);
    });

    it("uses substantive RNG during the check", () => {
        let rngDuringCall = -1;
        const ctx: RNGCheckContext = {
            buffer: createRecordingBuffer(),
            rogue: {
                versionString: "CE 1.15.1",
                mode: 0,
                seed: 0n,
                playerTurnNumber: 0,
                deepestLevel: 1,
                playbackMode: false,
                RNG: 1, // cosmetic
            },
            currentFilePath: "/test/rec.broguerec",
            fileIO: makeFileIO(),
            RNG_SUBSTANTIVE: 0,
            randRange: vi.fn().mockImplementation(() => {
                rngDuringCall = ctx.rogue.RNG;
                return 50;
            }),
        };

        RNGCheck(ctx, noop, null);

        expect(rngDuringCall).toBe(0); // was set to RNG_SUBSTANTIVE during call
        expect(ctx.rogue.RNG).toBe(1); // restored
    });
});
