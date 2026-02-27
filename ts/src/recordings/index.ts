/*
 *  recordings/index.ts — Barrel export for the recordings module
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c (1,519 lines)
 *  Phase 2 scope: recording buffer, event codec, save/load, init.
 *  Phase 3 deferred: playback UI (executePlaybackInput, seek, pausePlayback),
 *                     annotation system, interactive save dialogs, loadSavedGame.
 */

// ── Recording state & buffer ────────────────────────────────────────────────
export {
    createRecordingBuffer,
    recordChar,
    recallChar,
    compressKeystroke,
    uncompressKeystroke,
    numberToBytes,
    bytesToNumber,
    flushBufferToFile,
    fillBufferFromFile,
    considerFlushingBufferToFile,
    writeHeaderInfo,
    parseHeaderInfo,
} from "./recording-state.js";

export type {
    RecordingBuffer,
    RecordingFileIO,
    RecordingBufferContext,
} from "./recording-state.js";

// ── Event recording & recall ────────────────────────────────────────────────
export {
    recordEvent,
    recordKeystroke,
    cancelKeystroke,
    recordKeystrokeSequence,
    recordMouseClick,
    recallEvent,
    playbackPanic,
    OOSCheck,
    RNGCheck,
} from "./recording-events.js";

export type {
    RecordingEventsContext,
} from "./recording-events.js";

// ── Recording init ──────────────────────────────────────────────────────────
export {
    getPatchVersion,
    initRecording,
} from "./recording-init.js";

export type {
    RecordingInitContext,
} from "./recording-init.js";

// ── Save/load & file path helpers ───────────────────────────────────────────
export {
    characterForbiddenInFilename,
    getAvailableFilePath,
    getDefaultFilePath,
    formatSeedString,
    saveGameNoPrompt,
    saveRecordingNoPrompt,
    switchToPlaying,
} from "./recording-save-load.js";

export type {
    DefaultFilePathContext,
    SaveContext,
    SwitchToPlayingContext,
} from "./recording-save-load.js";
