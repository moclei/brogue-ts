/*
 *  recording-state.test.ts — Tests for recording state, codec, and buffer management
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    KEYSTROKE_TABLE,
    compressKeystroke,
    uncompressKeystroke,
    numberToBytes,
    bytesToNumber,
    createRecordingBuffer,
    recordChar,
    recallChar,
    recordNumber,
    recallNumber,
    considerFlushingBufferToFile,
    flushBufferToFile,
    fillBufferFromFile,
    RECORDING_HEADER_LENGTH,
    writeHeaderInfo,
    parseHeaderInfo,
    type RecordingBuffer,
    type RecordingBufferContext,
    type RecordingFileIO,
} from "../../src/recordings/recording-state.js";
import {
    INPUT_RECORD_BUFFER,
    INPUT_RECORD_BUFFER_MAX_SIZE,
    UP_ARROW, LEFT_ARROW, DOWN_ARROW, RIGHT_ARROW,
    ESCAPE_KEY, RETURN_KEY, DELETE_KEY, TAB_KEY,
    NUMPAD_0, NUMPAD_5, NUMPAD_9,
    UNKNOWN_KEY,
} from "../../src/types/constants.js";
import { EventType } from "../../src/types/enums.js";

// =============================================================================
// Helpers
// =============================================================================

function makeFileIO(overrides: Partial<RecordingFileIO> = {}): RecordingFileIO {
    return {
        fileExists: vi.fn().mockReturnValue(true),
        appendBytes: vi.fn(),
        readBytes: vi.fn().mockReturnValue({ bytes: new Uint8Array(INPUT_RECORD_BUFFER), newOffset: INPUT_RECORD_BUFFER }),
        writeHeader: vi.fn(),
        removeFile: vi.fn(),
        renameFile: vi.fn(),
        copyFile: vi.fn(),
        ...overrides,
    };
}

function makeBufferCtx(overrides: Partial<RecordingBufferContext> = {}): RecordingBufferContext {
    return {
        buffer: createRecordingBuffer(),
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
        ...overrides,
    };
}

// =============================================================================
// Keystroke compression
// =============================================================================

describe("compressKeystroke", () => {
    it("compresses special keys to 128+index", () => {
        expect(compressKeystroke(UP_ARROW)).toBe(128 + 0);
        expect(compressKeystroke(LEFT_ARROW)).toBe(128 + 1);
        expect(compressKeystroke(DOWN_ARROW)).toBe(128 + 2);
        expect(compressKeystroke(RIGHT_ARROW)).toBe(128 + 3);
        expect(compressKeystroke(ESCAPE_KEY)).toBe(128 + 4);
        expect(compressKeystroke(RETURN_KEY)).toBe(128 + 5);
        expect(compressKeystroke(DELETE_KEY)).toBe(128 + 6);
        expect(compressKeystroke(TAB_KEY)).toBe(128 + 7);
    });

    it("compresses numpad keys", () => {
        expect(compressKeystroke(NUMPAD_0)).toBe(128 + 8);
        expect(compressKeystroke(NUMPAD_5)).toBe(128 + 13);
        expect(compressKeystroke(NUMPAD_9)).toBe(128 + 17);
    });

    it("passes through ASCII chars < 256 directly", () => {
        expect(compressKeystroke("a".charCodeAt(0))).toBe("a".charCodeAt(0));
        expect(compressKeystroke("Z".charCodeAt(0))).toBe("Z".charCodeAt(0));
        expect(compressKeystroke(" ".charCodeAt(0))).toBe(" ".charCodeAt(0));
        expect(compressKeystroke(0)).toBe(0);
        expect(compressKeystroke(255)).toBe(255);
    });

    it("returns UNKNOWN_KEY for unrecognized large values", () => {
        expect(compressKeystroke(99999)).toBe(UNKNOWN_KEY);
    });
});

describe("uncompressKeystroke", () => {
    it("decompresses special keys from 128+index", () => {
        expect(uncompressKeystroke(128 + 0)).toBe(UP_ARROW);
        expect(uncompressKeystroke(128 + 1)).toBe(LEFT_ARROW);
        expect(uncompressKeystroke(128 + 2)).toBe(DOWN_ARROW);
        expect(uncompressKeystroke(128 + 3)).toBe(RIGHT_ARROW);
        expect(uncompressKeystroke(128 + 4)).toBe(ESCAPE_KEY);
    });

    it("decompresses numpad keys", () => {
        expect(uncompressKeystroke(128 + 8)).toBe(NUMPAD_0);
        expect(uncompressKeystroke(128 + 17)).toBe(NUMPAD_9);
    });

    it("passes through non-special bytes directly", () => {
        expect(uncompressKeystroke("a".charCodeAt(0))).toBe("a".charCodeAt(0));
        expect(uncompressKeystroke(0)).toBe(0);
        expect(uncompressKeystroke(127)).toBe(127);
    });

    it("passes through values beyond keystroke table range", () => {
        // 128 + 18 is beyond the 18-entry table
        expect(uncompressKeystroke(128 + 18)).toBe(128 + 18);
        expect(uncompressKeystroke(200)).toBe(200);
    });

    it("round-trips with compressKeystroke for all special keys", () => {
        for (const key of KEYSTROKE_TABLE) {
            const compressed = compressKeystroke(key);
            expect(uncompressKeystroke(compressed)).toBe(key);
        }
    });

    it("round-trips with compressKeystroke for ASCII chars", () => {
        for (let c = 0; c < 128; c++) {
            const compressed = compressKeystroke(c);
            if (compressed !== UNKNOWN_KEY) {
                expect(uncompressKeystroke(compressed)).toBe(c);
            }
        }
    });
});

// =============================================================================
// Number encoding/decoding
// =============================================================================

describe("numberToBytes / bytesToNumber", () => {
    it("encodes and decodes a 1-byte number", () => {
        const buf = new Uint8Array(1);
        numberToBytes(42, 1, buf);
        expect(buf[0]).toBe(42);
        expect(bytesToNumber(buf, 1)).toBe(42n);
    });

    it("encodes and decodes a 2-byte number", () => {
        const buf = new Uint8Array(2);
        numberToBytes(0x1234, 2, buf);
        expect(buf[0]).toBe(0x12);
        expect(buf[1]).toBe(0x34);
        expect(bytesToNumber(buf, 2)).toBe(0x1234n);
    });

    it("encodes and decodes a 4-byte number", () => {
        const buf = new Uint8Array(4);
        numberToBytes(0xDEADBEEF, 4, buf);
        expect(bytesToNumber(buf, 4)).toBe(0xDEADBEEFn);
    });

    it("encodes and decodes an 8-byte bigint", () => {
        const buf = new Uint8Array(8);
        const value = 0x123456789ABCDEFn;
        numberToBytes(value, 8, buf);
        expect(bytesToNumber(buf, 8)).toBe(value);
    });

    it("handles zero", () => {
        const buf = new Uint8Array(4);
        numberToBytes(0, 4, buf);
        expect(bytesToNumber(buf, 4)).toBe(0n);
        for (let i = 0; i < 4; i++) {
            expect(buf[i]).toBe(0);
        }
    });

    it("writes at an offset", () => {
        const buf = new Uint8Array(10);
        buf.fill(0xFF);
        numberToBytes(0x1234, 2, buf, 4);
        expect(buf[4]).toBe(0x12);
        expect(buf[5]).toBe(0x34);
        expect(buf[3]).toBe(0xFF); // untouched
        expect(buf[6]).toBe(0xFF); // untouched
    });

    it("reads from an offset", () => {
        const buf = new Uint8Array([0xFF, 0xFF, 0x12, 0x34, 0xFF]);
        expect(bytesToNumber(buf, 2, 2)).toBe(0x1234n);
    });

    it("handles max 4-byte value", () => {
        const buf = new Uint8Array(4);
        numberToBytes(0xFFFFFFFF, 4, buf);
        expect(bytesToNumber(buf, 4)).toBe(0xFFFFFFFFn);
    });
});

// =============================================================================
// Recording buffer
// =============================================================================

describe("createRecordingBuffer", () => {
    it("creates a buffer with correct default state", () => {
        const buf = createRecordingBuffer();
        expect(buf.data.length).toBe(INPUT_RECORD_BUFFER_MAX_SIZE);
        expect(buf.bufferPosition).toBe(0);
        expect(buf.streamPosition).toBe(0);
        expect(buf.playbackFileLength).toBe(0);
        expect(buf.fileReadPosition).toBe(0);
        expect(buf.maxLevelChanges).toBe(0);
    });
});

describe("recordChar", () => {
    it("records a byte and advances positions", () => {
        const buf = createRecordingBuffer();
        recordChar(buf, 42);
        expect(buf.data[0]).toBe(42);
        expect(buf.bufferPosition).toBe(1);
        expect(buf.streamPosition).toBe(1);
    });

    it("records multiple bytes sequentially", () => {
        const buf = createRecordingBuffer();
        recordChar(buf, 10);
        recordChar(buf, 20);
        recordChar(buf, 30);
        expect(buf.data[0]).toBe(10);
        expect(buf.data[1]).toBe(20);
        expect(buf.data[2]).toBe(30);
        expect(buf.bufferPosition).toBe(3);
        expect(buf.streamPosition).toBe(3);
    });

    it("masks to 8 bits", () => {
        const buf = createRecordingBuffer();
        recordChar(buf, 0x1FF);
        expect(buf.data[0]).toBe(0xFF);
    });

    it("drops bytes when buffer is full", () => {
        const buf = createRecordingBuffer();
        buf.bufferPosition = INPUT_RECORD_BUFFER_MAX_SIZE;
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        recordChar(buf, 42);
        expect(buf.bufferPosition).toBe(INPUT_RECORD_BUFFER_MAX_SIZE); // unchanged
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});

describe("recallChar", () => {
    it("recalls a byte and advances positions", () => {
        const buf = createRecordingBuffer();
        buf.data[0] = 42;
        buf.playbackFileLength = 100;
        const refill = vi.fn();
        const c = recallChar(buf, refill);
        expect(c).toBe(42);
        expect(buf.bufferPosition).toBe(1);
        expect(buf.streamPosition).toBe(1);
    });

    it("returns EndOfRecording when past file length", () => {
        const buf = createRecordingBuffer();
        buf.playbackFileLength = 0;
        buf.streamPosition = 1; // past the end
        const refill = vi.fn();
        const c = recallChar(buf, refill);
        expect(c).toBe(EventType.EndOfRecording);
    });

    it("calls refillBuffer when buffer position reaches threshold", () => {
        const buf = createRecordingBuffer();
        buf.bufferPosition = INPUT_RECORD_BUFFER - 1;
        buf.playbackFileLength = 100000;
        buf.streamPosition = 0;
        const refill = vi.fn();
        recallChar(buf, refill);
        expect(refill).toHaveBeenCalledOnce();
    });

    it("does not call refillBuffer before threshold", () => {
        const buf = createRecordingBuffer();
        buf.bufferPosition = 0;
        buf.playbackFileLength = 100;
        const refill = vi.fn();
        recallChar(buf, refill);
        expect(refill).not.toHaveBeenCalled();
    });
});

describe("recordNumber / recallNumber", () => {
    it("records and recalls a 1-byte number", () => {
        const buf = createRecordingBuffer();
        recordNumber(buf, 200, 1);
        expect(buf.bufferPosition).toBe(1);
        expect(buf.data[0]).toBe(200);

        // Now recall it
        buf.bufferPosition = 0;
        buf.streamPosition = 0;
        buf.playbackFileLength = 100;
        const refill = vi.fn();
        const n = recallNumber(buf, 1, refill);
        expect(n).toBe(200n);
    });

    it("records and recalls a 4-byte number", () => {
        const buf = createRecordingBuffer();
        recordNumber(buf, 0xDEADBEEF, 4);
        expect(buf.bufferPosition).toBe(4);

        buf.bufferPosition = 0;
        buf.streamPosition = 0;
        buf.playbackFileLength = 100;
        const refill = vi.fn();
        const n = recallNumber(buf, 4, refill);
        expect(n).toBe(0xDEADBEEFn);
    });

    it("records and recalls an 8-byte bigint seed", () => {
        const buf = createRecordingBuffer();
        const seed = 0x123456789ABCDEFn;
        recordNumber(buf, seed, 8);
        expect(buf.bufferPosition).toBe(8);

        buf.bufferPosition = 0;
        buf.streamPosition = 0;
        buf.playbackFileLength = 100;
        const refill = vi.fn();
        const n = recallNumber(buf, 8, refill);
        expect(n).toBe(seed);
    });
});

// =============================================================================
// considerFlushingBufferToFile
// =============================================================================

describe("considerFlushingBufferToFile", () => {
    it("flushes when buffer reaches INPUT_RECORD_BUFFER threshold", () => {
        const ctx = makeBufferCtx();
        ctx.buffer.bufferPosition = INPUT_RECORD_BUFFER;
        considerFlushingBufferToFile(ctx);
        // After flushing, bufferPosition should be reset to 0
        expect(ctx.buffer.bufferPosition).toBe(0);
    });

    it("does not flush when below threshold", () => {
        const ctx = makeBufferCtx();
        ctx.buffer.bufferPosition = INPUT_RECORD_BUFFER - 1;
        const appendSpy = ctx.fileIO.appendBytes as ReturnType<typeof vi.fn>;
        considerFlushingBufferToFile(ctx);
        expect(appendSpy).not.toHaveBeenCalled();
        expect(ctx.buffer.bufferPosition).toBe(INPUT_RECORD_BUFFER - 1);
    });
});

// =============================================================================
// flushBufferToFile
// =============================================================================

describe("flushBufferToFile", () => {
    it("does nothing in playback mode", () => {
        const ctx = makeBufferCtx();
        ctx.rogue.playbackMode = true;
        ctx.buffer.bufferPosition = 10;
        flushBufferToFile(ctx);
        expect(ctx.buffer.bufferPosition).toBe(10); // unchanged
    });

    it("resets buffer position even with empty file path (matches C behavior)", () => {
        const ctx = makeBufferCtx();
        ctx.currentFilePath = "";
        ctx.buffer.bufferPosition = 10;
        flushBufferToFile(ctx);
        // In C, locationInRecordingBuffer is always reset to 0
        expect(ctx.buffer.bufferPosition).toBe(0);
        // But no file I/O was performed
        expect(ctx.fileIO.writeHeader).not.toHaveBeenCalled();
        expect(ctx.fileIO.appendBytes).not.toHaveBeenCalled();
    });

    it("writes header and appends buffer contents", () => {
        const ctx = makeBufferCtx();
        ctx.buffer.data[0] = 1;
        ctx.buffer.data[1] = 2;
        ctx.buffer.data[2] = 3;
        ctx.buffer.bufferPosition = 3;

        flushBufferToFile(ctx);

        expect(ctx.fileIO.writeHeader).toHaveBeenCalled();
        expect(ctx.fileIO.appendBytes).toHaveBeenCalledWith(
            ctx.currentFilePath,
            expect.any(Uint8Array),
        );
        const appendedBytes = (ctx.fileIO.appendBytes as ReturnType<typeof vi.fn>).mock.calls[0][1] as Uint8Array;
        expect(appendedBytes.length).toBe(3);
        expect(appendedBytes[0]).toBe(1);
        expect(appendedBytes[1]).toBe(2);
        expect(appendedBytes[2]).toBe(3);
        expect(ctx.buffer.bufferPosition).toBe(0); // reset
    });

    it("updates playbackFileLength", () => {
        const ctx = makeBufferCtx();
        ctx.buffer.playbackFileLength = 100;
        ctx.buffer.bufferPosition = 50;
        flushBufferToFile(ctx);
        // playbackFileLength increased by bufferPosition before flush
        expect(ctx.buffer.playbackFileLength).toBeGreaterThanOrEqual(RECORDING_HEADER_LENGTH);
    });

    it("skips appendBytes when buffer is empty", () => {
        const ctx = makeBufferCtx();
        ctx.buffer.bufferPosition = 0;
        flushBufferToFile(ctx);
        expect(ctx.fileIO.appendBytes).not.toHaveBeenCalled();
    });
});

// =============================================================================
// fillBufferFromFile
// =============================================================================

describe("fillBufferFromFile", () => {
    it("reads bytes from file and resets buffer position", () => {
        const testBytes = new Uint8Array(INPUT_RECORD_BUFFER);
        testBytes[0] = 99;
        testBytes[1] = 88;
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: testBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeBufferCtx({ fileIO });
        ctx.buffer.bufferPosition = 500; // was partway through
        ctx.buffer.fileReadPosition = 36; // past header

        fillBufferFromFile(ctx);

        expect(ctx.buffer.bufferPosition).toBe(0);
        expect(ctx.buffer.data[0]).toBe(99);
        expect(ctx.buffer.data[1]).toBe(88);
        expect(ctx.buffer.fileReadPosition).toBe(INPUT_RECORD_BUFFER);
    });
});

// =============================================================================
// Header encoding/decoding
// =============================================================================

describe("writeHeaderInfo / parseHeaderInfo", () => {
    it("writes and parses a round-trip header", () => {
        const fileIO = makeFileIO();
        let capturedHeader: Uint8Array | null = null;
        (fileIO.writeHeader as ReturnType<typeof vi.fn>).mockImplementation(
            (_path: string, header: Uint8Array) => {
                capturedHeader = new Uint8Array(header);
            },
        );

        const ctx = makeBufferCtx({ fileIO });
        ctx.rogue.versionString = "CE 1.15.1";
        ctx.rogue.mode = 2;
        ctx.rogue.seed = 9999999999n;
        ctx.rogue.playerTurnNumber = 1234;
        ctx.rogue.deepestLevel = 15;
        ctx.buffer.playbackFileLength = 5000;

        writeHeaderInfo(ctx);

        expect(capturedHeader).not.toBeNull();
        expect(capturedHeader!.length).toBe(RECORDING_HEADER_LENGTH);

        const parsed = parseHeaderInfo(capturedHeader!);
        expect(parsed.versionString).toBe("CE 1.15.1");
        expect(parsed.mode).toBe(2);
        expect(parsed.seed).toBe(9999999999n);
        expect(parsed.playerTurnNumber).toBe(1234);
        expect(parsed.deepestLevel).toBe(15);
        expect(parsed.playbackFileLength).toBe(5000);
    });

    it("handles empty version string", () => {
        const fileIO = makeFileIO();
        let capturedHeader: Uint8Array | null = null;
        (fileIO.writeHeader as ReturnType<typeof vi.fn>).mockImplementation(
            (_path: string, header: Uint8Array) => {
                capturedHeader = new Uint8Array(header);
            },
        );

        const ctx = makeBufferCtx({ fileIO });
        ctx.rogue.versionString = "";
        writeHeaderInfo(ctx);

        const parsed = parseHeaderInfo(capturedHeader!);
        expect(parsed.versionString).toBe("");
    });

    it("truncates version string at 15 chars", () => {
        const fileIO = makeFileIO();
        let capturedHeader: Uint8Array | null = null;
        (fileIO.writeHeader as ReturnType<typeof vi.fn>).mockImplementation(
            (_path: string, header: Uint8Array) => {
                capturedHeader = new Uint8Array(header);
            },
        );

        const ctx = makeBufferCtx({ fileIO });
        ctx.rogue.versionString = "This is a very long version string";
        writeHeaderInfo(ctx);

        const parsed = parseHeaderInfo(capturedHeader!);
        expect(parsed.versionString).toBe("This is a very ");
    });

    it("ensures playbackFileLength is at least RECORDING_HEADER_LENGTH", () => {
        const ctx = makeBufferCtx();
        ctx.buffer.playbackFileLength = 10; // less than header length
        writeHeaderInfo(ctx);
        expect(ctx.buffer.playbackFileLength).toBe(RECORDING_HEADER_LENGTH);
    });

    it("creates file if it doesn't exist", () => {
        const fileIO = makeFileIO({
            fileExists: vi.fn().mockReturnValue(false),
        });
        const ctx = makeBufferCtx({ fileIO });
        writeHeaderInfo(ctx);
        // writeHeader is called twice: once to create the file, once to write the real header
        expect(fileIO.writeHeader).toHaveBeenCalledTimes(2);
    });
});

describe("parseHeaderInfo", () => {
    it("parses seed=0 correctly", () => {
        const header = new Uint8Array(RECORDING_HEADER_LENGTH);
        const parsed = parseHeaderInfo(header);
        expect(parsed.seed).toBe(0n);
        expect(parsed.playerTurnNumber).toBe(0);
        expect(parsed.deepestLevel).toBe(0);
        expect(parsed.playbackFileLength).toBe(0);
    });
});
