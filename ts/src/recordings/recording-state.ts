/*
 *  recording-state.ts — Recording state, buffer management, and codec
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c
 *  Functions: recordChar, recallChar, recordNumber, recallNumber,
 *             numberToString, compressKeystroke, uncompressKeystroke,
 *             considerFlushingBufferToFile
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import {
    INPUT_RECORD_BUFFER,
    INPUT_RECORD_BUFFER_MAX_SIZE,
    UP_ARROW, LEFT_ARROW, DOWN_ARROW, RIGHT_ARROW,
    ESCAPE_KEY, RETURN_KEY, DELETE_KEY, TAB_KEY,
    NUMPAD_0, NUMPAD_1, NUMPAD_2, NUMPAD_3,
    NUMPAD_4, NUMPAD_5, NUMPAD_6, NUMPAD_7,
    NUMPAD_8, NUMPAD_9,
    UNKNOWN_KEY,
} from "../types/constants.js";
import { EventType } from "../types/enums.js";

// =============================================================================
// Keystroke compression table — maps special keys to compact single-byte codes
// =============================================================================

/**
 * Table of special keystrokes that get compressed to 128+index during recording.
 * Mirrors the C `keystrokeTable[]` static array.
 */
export const KEYSTROKE_TABLE: readonly number[] = [
    UP_ARROW, LEFT_ARROW, DOWN_ARROW, RIGHT_ARROW,
    ESCAPE_KEY, RETURN_KEY, DELETE_KEY, TAB_KEY,
    NUMPAD_0, NUMPAD_1, NUMPAD_2, NUMPAD_3,
    NUMPAD_4, NUMPAD_5, NUMPAD_6, NUMPAD_7,
    NUMPAD_8, NUMPAD_9,
];

// =============================================================================
// Recording buffer state
// =============================================================================

/**
 * Mutable recording buffer state. Encapsulates all the C global variables
 * related to recording/playback buffer management:
 *   - inputRecordBuffer
 *   - locationInRecordingBuffer
 *   - recordingLocation
 *   - positionInPlaybackFile
 *   - lengthOfPlaybackFile
 *   - maxLevelChanges
 */
export interface RecordingBuffer {
    /** The in-memory buffer of recorded bytes. */
    data: Uint8Array;

    /**
     * Current position within `data` (the in-memory buffer).
     * C name: locationInRecordingBuffer
     */
    bufferPosition: number;

    /**
     * Absolute byte offset in the logical recording stream.
     * C name: recordingLocation
     */
    streamPosition: number;

    /**
     * Total length of the playback file in bytes.
     * C name: lengthOfPlaybackFile
     */
    playbackFileLength: number;

    /**
     * Byte offset in the underlying file for the next fillBuffer read.
     * C name: positionInPlaybackFile
     */
    fileReadPosition: number;

    /**
     * Maximum number of depth changes recorded (used for seek estimation).
     * C name: maxLevelChanges
     */
    maxLevelChanges: number;
}

/**
 * Create a fresh recording buffer with default state.
 */
export function createRecordingBuffer(): RecordingBuffer {
    return {
        data: new Uint8Array(INPUT_RECORD_BUFFER_MAX_SIZE),
        bufferPosition: 0,
        streamPosition: 0,
        playbackFileLength: 0,
        fileReadPosition: 0,
        maxLevelChanges: 0,
    };
}

// =============================================================================
// File I/O abstraction — injected dependency
// =============================================================================

/**
 * Abstract file operations that the recording system needs.
 * Platform implementations (Node.js, browser, etc.) provide concrete versions.
 */
export interface RecordingFileIO {
    /** Check if a file exists at the given path. */
    fileExists(path: string): boolean;

    /** Write bytes at the end of a file (append). Creates file if needed. */
    appendBytes(path: string, bytes: Uint8Array): void;

    /**
     * Read up to `count` bytes from `path` starting at `offset`.
     * Returns the bytes read and the new file position after reading.
     */
    readBytes(path: string, offset: number, count: number): { bytes: Uint8Array; newOffset: number };

    /** Write the header bytes at the start of a file (overwriting). Creates file if needed. */
    writeHeader(path: string, header: Uint8Array): void;

    /** Remove a file. No-op if it doesn't exist. */
    removeFile(path: string): void;

    /** Rename/move a file. */
    renameFile(fromPath: string, toPath: string): void;

    /** Copy a file from one path to another. */
    copyFile(fromPath: string, toPath: string, length: number): void;
}

// =============================================================================
// Keystroke codec
// =============================================================================

/**
 * Compress a keystroke value into a single byte for recording.
 * Special keys (arrows, escape, numpad, etc.) are mapped to 128+index.
 * ASCII characters < 256 are stored directly.
 * Unknown keys return UNKNOWN_KEY.
 *
 * Port of C `compressKeystroke()`.
 */
export function compressKeystroke(key: number): number {
    for (let i = 0; i < KEYSTROKE_TABLE.length; i++) {
        if (KEYSTROKE_TABLE[i] === key) {
            return 128 + i;
        }
    }
    if (key < 256) {
        return key;
    }
    return UNKNOWN_KEY;
}

/**
 * Decompress a byte back into the original keystroke value.
 * Port of C `uncompressKeystroke()`.
 */
export function uncompressKeystroke(c: number): number {
    if (c >= 128 && (c - 128) < KEYSTROKE_TABLE.length) {
        return KEYSTROKE_TABLE[c - 128];
    }
    return c;
}

// =============================================================================
// Number encoding/decoding
// =============================================================================

/**
 * Encode a number into big-endian bytes.
 * Port of C `numberToString()`.
 *
 * @param value The number to encode
 * @param numberOfBytes How many bytes to use (1-8)
 * @param target Array to write into
 * @param offset Starting offset in `target`
 */
export function numberToBytes(
    value: number | bigint,
    numberOfBytes: number,
    target: Uint8Array,
    offset: number = 0,
): void {
    // Use BigInt for values that may exceed 32-bit range
    let n = typeof value === "bigint" ? value : BigInt(value);
    for (let i = numberOfBytes - 1; i >= 0; i--) {
        target[offset + i] = Number(n & 0xFFn);
        n >>= 8n;
    }
}

/**
 * Decode big-endian bytes back into a number.
 *
 * @param source Array to read from
 * @param numberOfBytes How many bytes to read (1-8)
 * @param offset Starting offset in `source`
 * @returns The decoded value as a bigint (caller can convert to number if needed)
 */
export function bytesToNumber(
    source: Uint8Array,
    numberOfBytes: number,
    offset: number = 0,
): bigint {
    let n = 0n;
    for (let i = 0; i < numberOfBytes; i++) {
        n = (n << 8n) + BigInt(source[offset + i]);
    }
    return n;
}

// =============================================================================
// Recording buffer operations
// =============================================================================

/**
 * Context needed by buffer operations that may trigger a file flush.
 * Includes all the fields that writeHeaderInfo needs, since flushing writes headers.
 */
export interface RecordingBufferContext {
    buffer: RecordingBuffer;
    rogue: {
        versionString: string;
        mode: number;
        seed: bigint;
        playerTurnNumber: number;
        deepestLevel: number;
        playbackMode: boolean;
    };
    currentFilePath: string;
    fileIO: RecordingFileIO;
}

/**
 * Record a single byte into the recording buffer.
 * Port of C `recordChar()`.
 */
export function recordChar(buf: RecordingBuffer, c: number): void {
    if (buf.bufferPosition < INPUT_RECORD_BUFFER_MAX_SIZE) {
        buf.data[buf.bufferPosition++] = c & 0xFF;
        buf.streamPosition++;
    } else {
        // In C this prints a warning. We log and drop the byte.
        console.warn(
            `Recording buffer length exceeded at location ${buf.streamPosition - 1}! ` +
            `Turn number unknown.`
        );
    }
}

/**
 * Flush the buffer to file if it has reached the flush threshold.
 * Port of C `considerFlushingBufferToFile()`.
 */
export function considerFlushingBufferToFile(ctx: RecordingBufferContext): void {
    if (ctx.buffer.bufferPosition >= INPUT_RECORD_BUFFER) {
        flushBufferToFile(ctx);
    }
}

/**
 * Record a multi-byte number into the recording buffer.
 * Port of C `recordNumber()`.
 */
export function recordNumber(buf: RecordingBuffer, value: number | bigint, numberOfBytes: number): void {
    const bytes = new Uint8Array(numberOfBytes);
    numberToBytes(value, numberOfBytes, bytes);
    for (let i = 0; i < numberOfBytes; i++) {
        recordChar(buf, bytes[i]);
    }
}

/**
 * Recall a single byte from the recording buffer during playback.
 * Port of C `recallChar()`.
 *
 * When the in-memory buffer is exhausted, calls `refillBuffer` to load more.
 */
export function recallChar(
    buf: RecordingBuffer,
    refillBuffer: () => void,
): number {
    if (buf.streamPosition > buf.playbackFileLength) {
        return EventType.EndOfRecording;
    }
    const c = buf.data[buf.bufferPosition++];
    buf.streamPosition++;
    if (buf.bufferPosition >= INPUT_RECORD_BUFFER) {
        refillBuffer();
    }
    return c;
}

/**
 * Recall a multi-byte number from the recording buffer during playback.
 * Port of C `recallNumber()`.
 */
export function recallNumber(
    buf: RecordingBuffer,
    numberOfBytes: number,
    refillBuffer: () => void,
): bigint {
    let n = 0n;
    for (let i = 0; i < numberOfBytes; i++) {
        n = (n << 8n) + BigInt(recallChar(buf, refillBuffer));
    }
    return n;
}

// =============================================================================
// Header constants
// =============================================================================

/** Number of bytes at the start of a recording file for the header. */
export const RECORDING_HEADER_LENGTH = 36;

// =============================================================================
// File I/O — flush and fill
// =============================================================================

/**
 * Flush the in-memory recording buffer to the file.
 * Port of C `flushBufferToFile()`.
 */
export function flushBufferToFile(ctx: RecordingBufferContext): void {
    if (ctx.rogue.playbackMode) {
        return;
    }

    if (ctx.currentFilePath !== "") {
        ctx.buffer.playbackFileLength += ctx.buffer.bufferPosition;
        writeHeaderInfo(ctx);

        if (ctx.buffer.bufferPosition !== 0) {
            const bytesToWrite = new Uint8Array(
                ctx.buffer.data.buffer,
                ctx.buffer.data.byteOffset,
                ctx.buffer.bufferPosition,
            );
            ctx.fileIO.appendBytes(ctx.currentFilePath, bytesToWrite);
        }
    }
    ctx.buffer.bufferPosition = 0;
}

/**
 * Fill the in-memory buffer from the file during playback.
 * Port of C `fillBufferFromFile()`.
 */
export function fillBufferFromFile(ctx: RecordingBufferContext): void {
    const result = ctx.fileIO.readBytes(
        ctx.currentFilePath,
        ctx.buffer.fileReadPosition,
        INPUT_RECORD_BUFFER,
    );
    // Copy bytes into the buffer
    ctx.buffer.data.set(result.bytes);
    ctx.buffer.fileReadPosition = result.newOffset;
    ctx.buffer.bufferPosition = 0;
}

// =============================================================================
// Header read/write
// =============================================================================

/**
 * Write the recording header to the file.
 * Port of C `writeHeaderInfo()`.
 *
 * Header layout (36 bytes):
 *   [0..14]  version string (15 chars, null-padded)
 *   [15]     game mode
 *   [16..23] seed (8 bytes, big-endian)
 *   [24..27] player turn number (4 bytes)
 *   [28..31] deepest level (4 bytes)
 *   [32..35] length of playback file (4 bytes)
 */
export function writeHeaderInfo(ctx: RecordingBufferContext): void {
    const header = new Uint8Array(RECORDING_HEADER_LENGTH);

    // Version string (up to 15 chars)
    for (let i = 0; i < 15 && i < ctx.rogue.versionString.length; i++) {
        header[i] = ctx.rogue.versionString.charCodeAt(i);
    }

    // Game mode
    header[15] = ctx.rogue.mode;

    // Seed (8 bytes big-endian)
    numberToBytes(ctx.rogue.seed, 8, header, 16);

    // Player turn number (4 bytes)
    numberToBytes(ctx.rogue.playerTurnNumber, 4, header, 24);

    // Deepest level (4 bytes)
    numberToBytes(ctx.rogue.deepestLevel, 4, header, 28);

    // Length of playback file (4 bytes)
    numberToBytes(ctx.buffer.playbackFileLength, 4, header, 32);

    // Ensure file exists
    if (!ctx.fileIO.fileExists(ctx.currentFilePath)) {
        ctx.fileIO.writeHeader(ctx.currentFilePath, new Uint8Array(0));
    }

    ctx.fileIO.writeHeader(ctx.currentFilePath, header);

    if (ctx.buffer.playbackFileLength < RECORDING_HEADER_LENGTH) {
        ctx.buffer.playbackFileLength = RECORDING_HEADER_LENGTH;
    }
}

/**
 * Parse a recording header from raw bytes.
 * Returns the decoded header fields.
 */
export function parseHeaderInfo(header: Uint8Array): {
    versionString: string;
    mode: number;
    seed: bigint;
    playerTurnNumber: number;
    deepestLevel: number;
    playbackFileLength: number;
} {
    // Extract version string (up to 15 chars, null-terminated)
    let versionString = "";
    for (let i = 0; i < 15; i++) {
        if (header[i] === 0) break;
        versionString += String.fromCharCode(header[i]);
    }

    return {
        versionString,
        mode: header[15],
        seed: bytesToNumber(header, 8, 16),
        playerTurnNumber: Number(bytesToNumber(header, 4, 24)),
        deepestLevel: Number(bytesToNumber(header, 4, 28)),
        playbackFileLength: Number(bytesToNumber(header, 4, 32)),
    };
}
