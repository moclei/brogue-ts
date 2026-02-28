/*
 *  recording-interactive.ts — Interactive save/load with UI prompts
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c
 *  Functions: saveGame, saveRecording, loadSavedGame
 *
 *  These are the interactive (prompt-based) counterparts to
 *  saveGameNoPrompt/saveRecordingNoPrompt in recording-save-load.ts.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { RogueEvent, Color, ScreenDisplayBuffer, GameConstants } from "../types/types.js";
import { EventType, TextEntryType, ExitStatus } from "../types/enums.js";
import {
    COLS, ROWS, INTERFACE_OPACITY,
    GAME_SUFFIX, RECORDING_SUFFIX, LAST_RECORDING_NAME,
    ESCAPE_KEY,
} from "../types/constants.js";
import { MessageFlag } from "../types/flags.js";
import {
    recordChar,
    flushBufferToFile,
    type RecordingBuffer,
    type RecordingBufferContext,
    type RecordingFileIO,
} from "./recording-state.js";
import { getAvailableFilePath, getDefaultFilePath, switchToPlaying } from "./recording-save-load.js";
import type { DefaultFilePathContext, SwitchToPlayingContext } from "./recording-save-load.js";

// =============================================================================
// Constants
// =============================================================================

/** Maximum text input length for filenames. C: `#define MAX_TEXT_INPUT_FILENAME_LENGTH (COLS - 12)` */
const MAX_TEXT_INPUT_FILENAME_LENGTH = COLS - 12;

// =============================================================================
// DI Context — Interactive Save/Load
// =============================================================================

/**
 * Rogue state subset needed by interactive save/load functions.
 */
export interface InteractiveSaveRogueState {
    playbackMode: boolean;
    playbackFastForward: boolean;
    playbackOmniscience: boolean;
    playbackOOS: boolean;
    playbackPaused: boolean;
    recording: boolean;
    gameHasEnded: boolean;
    gameExitStatusCode: number;
    playerTurnNumber: number;
    howManyTurns: number;
    depthLevel: number;
    creaturesWillFlashThisTurn: boolean;
    RNG: number;
    seed: bigint;
    quit: boolean;
    mode: number;
    versionString: string;
    deepestLevel: number;
}

/**
 * Full DI context for interactive save/load functions.
 */
export interface InteractiveSaveContext {
    rogue: InteractiveSaveRogueState;

    /** Player creature state. */
    player: {
        bookkeepingFlags: number;
    };

    /** Recording buffer state. */
    buffer: RecordingBuffer;

    /** Current file path for the recording file. */
    currentFilePath: string;

    /** File I/O abstraction. */
    fileIO: RecordingFileIO;

    /** Game constants. */
    gameConst: GameConstants;

    /** Whether server mode is active. */
    serverMode: boolean;

    /** RNG constants. */
    RNG_COSMETIC: number;
    RNG_SUBSTANTIVE: number;

    // ── Colors ──────────────────────────────────────────────────────────────
    black: Color;
    darkPurple: Color;

    // ── Display ─────────────────────────────────────────────────────────────
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    rectangularShading(
        x: number, y: number, width: number, height: number,
        backColor: Color, opacity: number, dbuf: ScreenDisplayBuffer,
    ): void;
    printProgressBar(
        x: number, y: number, label: string,
        current: number, max: number, fillColor: Color, dim: boolean,
    ): void;
    blackOutScreen(): void;
    refreshSideBar(focusX: number, focusY: number, highlight: boolean): void;
    updateMessageDisplay(): void;
    displayLevel(): void;
    commitDraws(): void;

    // ── Messages ────────────────────────────────────────────────────────────
    message(msg: string, flags: number): void;
    confirm(prompt: string, alsoDuringPlayback: boolean): boolean;
    confirmMessages(): void;

    // ── Input ───────────────────────────────────────────────────────────────
    getInputTextString(
        resultBuf: string[], prompt: string, maxLength: number,
        defaultText: string, suffix: string, inputType: TextEntryType, confirmOnEntry: boolean,
    ): boolean;
    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInputEvenInPlayback: boolean): RogueEvent;
    pauseBrogue(milliseconds: number, behavior: number): boolean;
    executeEvent(event: RogueEvent): void;

    // ── Game lifecycle ──────────────────────────────────────────────────────
    initializeRogue(seed: bigint): void;
    startLevel(depth: number, stairDirection: number): void;
    resetRandomNumbersGenerated(): void;

    // ── Constants ────────────────────────────────────────────────────────────
    PAUSE_BEHAVIOR_DEFAULT: number;
}

// =============================================================================
// saveGame — interactive variant with filename prompt
// =============================================================================

/**
 * Save the current game with a filename prompt.
 * Port of C `saveGame()`.
 */
export function saveGame(ctx: InteractiveSaveContext): void {
    if (ctx.rogue.playbackMode) {
        return; // Can't save during playback.
    }

    const defaultPath = getDefaultFilePath(false, buildDefaultFilePathCtx(ctx));
    let filePathWithoutSuffix = getAvailableFilePath(
        defaultPath,
        GAME_SUFFIX,
        (p) => ctx.fileIO.fileExists(p),
    );

    let askAgain: boolean;

    do {
        askAgain = false;
        const resultBuf = [filePathWithoutSuffix];
        if (ctx.getInputTextString(
            resultBuf,
            "Save game as (<esc> to cancel): ",
            MAX_TEXT_INPUT_FILENAME_LENGTH,
            filePathWithoutSuffix,
            GAME_SUFFIX,
            TextEntryType.Filename,
            true,
        )) {
            filePathWithoutSuffix = resultBuf[0];
            const filePath = `${filePathWithoutSuffix}${GAME_SUFFIX}`;
            if (!ctx.fileIO.fileExists(filePath) || ctx.confirm("File of that name already exists. Overwrite?", true)) {
                ctx.fileIO.removeFile(filePath);
                flushBufferToFile(buildBufferCtx(ctx));
                ctx.fileIO.renameFile(ctx.currentFilePath, filePath);
                ctx.currentFilePath = filePath;
                ctx.rogue.recording = false;
                ctx.message("Saved.", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
                ctx.rogue.gameHasEnded = true;
                ctx.rogue.gameExitStatusCode = ExitStatus.Success;
            } else {
                askAgain = true;
            }
        }
    } while (askAgain);
}

// =============================================================================
// saveRecording — interactive variant with filename prompt
// =============================================================================

/**
 * Save the recording with a filename prompt.
 * If the user cancels, saves as "LastRecording" instead.
 * Port of C `saveRecording()`.
 *
 * @param filePathWithoutSuffix - Optional default file path (without suffix).
 *   If omitted, a default path is generated based on game state.
 */
export function saveRecording(
    ctx: InteractiveSaveContext,
    filePathWithoutSuffix?: string,
): void {
    if (ctx.rogue.playbackMode) {
        return;
    }

    const defaultPath = getDefaultFilePath(true, buildDefaultFilePathCtx(ctx));
    let pathWithout = filePathWithoutSuffix ?? getAvailableFilePath(
        defaultPath,
        RECORDING_SUFFIX,
        (p) => ctx.fileIO.fileExists(p),
    );

    let askAgain: boolean;

    do {
        askAgain = false;
        const resultBuf = [pathWithout];
        if (ctx.getInputTextString(
            resultBuf,
            "Save recording as (<esc> to cancel): ",
            MAX_TEXT_INPUT_FILENAME_LENGTH,
            pathWithout,
            RECORDING_SUFFIX,
            TextEntryType.Filename,
            true,
        )) {
            pathWithout = resultBuf[0];
            const filePath = `${pathWithout}${RECORDING_SUFFIX}`;
            if (!ctx.fileIO.fileExists(filePath) || ctx.confirm("File of that name already exists. Overwrite?", true)) {
                ctx.fileIO.removeFile(filePath);
                ctx.fileIO.renameFile(ctx.currentFilePath, filePath);
                ctx.rogue.recording = false;
            } else {
                askAgain = true;
            }
        } else {
            // Declined to save recording; save as LastRecording instead
            const lastRecPath = `${LAST_RECORDING_NAME}${RECORDING_SUFFIX}`;
            if (ctx.fileIO.fileExists(lastRecPath)) {
                ctx.fileIO.removeFile(lastRecPath);
            }
            ctx.fileIO.renameFile(ctx.currentFilePath, lastRecPath);
            ctx.rogue.recording = false;
        }
    } while (askAgain);
}

// =============================================================================
// loadSavedGame — replay saved recording to restore game state
// =============================================================================

/**
 * Load a saved game by replaying its recording to the saved turn number.
 * Returns true if loading completed (possibly with OOS), false if cancelled.
 *
 * Port of C `loadSavedGame()`.
 */
export function loadSavedGame(ctx: InteractiveSaveContext): boolean {
    ctx.resetRandomNumbersGenerated();
    ctx.rogue.playbackMode = true;
    ctx.rogue.playbackFastForward = true;
    ctx.initializeRogue(0n); // Seed argument is ignored in playback mode.

    if (!ctx.rogue.gameHasEnded) {
        ctx.blackOutScreen();
        ctx.startLevel(ctx.rogue.depthLevel, 1);
    }

    if (ctx.rogue.howManyTurns > 0) {
        const progressBarInterval = Math.max(1, Math.floor(ctx.buffer.playbackFileLength / 100));
        let previousStreamPosition = -1; // sentinel value for "not yet updated"

        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.rectangularShading(
            Math.floor((COLS - 20) / 2), Math.floor(ROWS / 2),
            20, 1, ctx.black, INTERFACE_OPACITY, dbuf,
        );
        ctx.rogue.playbackFastForward = false;
        ctx.overlayDisplayBuffer(dbuf);
        ctx.rogue.playbackFastForward = true;

        while (ctx.buffer.streamPosition < ctx.buffer.playbackFileLength
            && ctx.rogue.playerTurnNumber < ctx.rogue.howManyTurns
            && !ctx.rogue.gameHasEnded
            && !ctx.rogue.playbackOOS) {

            ctx.rogue.RNG = ctx.RNG_COSMETIC;
            const theEvent = ctx.nextBrogueEvent(false, true, false);
            ctx.rogue.RNG = ctx.RNG_SUBSTANTIVE;
            ctx.executeEvent(theEvent);

            const currentBucket = Math.floor(ctx.buffer.streamPosition / progressBarInterval);
            const previousBucket = previousStreamPosition < 0
                ? -1
                : Math.floor(previousStreamPosition / progressBarInterval);

            if (currentBucket !== previousBucket && !ctx.rogue.playbackOOS) {
                ctx.rogue.playbackFastForward = false; // so that pauseBrogue looks for inputs
                ctx.printProgressBar(
                    Math.floor((COLS - 20) / 2), Math.floor(ROWS / 2),
                    "[     Loading...   ]",
                    ctx.buffer.streamPosition, ctx.buffer.playbackFileLength,
                    ctx.darkPurple, false,
                );
                while (ctx.pauseBrogue(0, ctx.PAUSE_BEHAVIOR_DEFAULT)) {
                    ctx.rogue.creaturesWillFlashThisTurn = false;
                    const cancelEvent = ctx.nextBrogueEvent(true, false, true);
                    if (ctx.rogue.gameHasEnded ||
                        (cancelEvent.eventType === EventType.Keystroke && cancelEvent.param1 === ESCAPE_KEY)) {
                        return false;
                    }
                }
                ctx.rogue.playbackFastForward = true;
                previousStreamPosition = ctx.buffer.streamPosition;
            }
        }
    }

    if (!ctx.rogue.gameHasEnded && !ctx.rogue.playbackOOS) {
        switchToPlaying(buildSwitchCtx(ctx));
        recordChar(ctx.buffer, EventType.SavedGameLoaded);

        // UI refresh after switching to active play
        ctx.blackOutScreen();
        ctx.refreshSideBar(-1, -1, false);
        ctx.updateMessageDisplay();
        ctx.displayLevel();
    }

    return true;
}

// =============================================================================
// Internal helpers — build sub-contexts from InteractiveSaveContext
// =============================================================================

function buildDefaultFilePathCtx(ctx: InteractiveSaveContext): DefaultFilePathContext {
    return {
        rogue: {
            seed: ctx.rogue.seed,
            depthLevel: ctx.rogue.depthLevel,
            quit: ctx.rogue.quit,
            mode: ctx.rogue.mode,
        },
        player: ctx.player,
        gameConst: ctx.gameConst,
        serverMode: ctx.serverMode,
    };
}

function buildBufferCtx(ctx: InteractiveSaveContext): RecordingBufferContext {
    return {
        buffer: ctx.buffer,
        rogue: {
            versionString: ctx.rogue.versionString,
            mode: ctx.rogue.mode,
            seed: ctx.rogue.seed,
            playerTurnNumber: ctx.rogue.playerTurnNumber,
            deepestLevel: ctx.rogue.deepestLevel,
            playbackMode: ctx.rogue.playbackMode,
        },
        currentFilePath: ctx.currentFilePath,
        fileIO: ctx.fileIO,
    };
}

function buildSwitchCtx(ctx: InteractiveSaveContext): SwitchToPlayingContext {
    return {
        buffer: ctx.buffer,
        rogue: {
            versionString: ctx.rogue.versionString,
            mode: ctx.rogue.mode,
            seed: ctx.rogue.seed,
            playerTurnNumber: ctx.rogue.playerTurnNumber,
            deepestLevel: ctx.rogue.deepestLevel,
            playbackMode: ctx.rogue.playbackMode,
            recording: ctx.rogue.recording,
            playbackFastForward: ctx.rogue.playbackFastForward,
            playbackOmniscience: ctx.rogue.playbackOmniscience,
        },
        currentFilePath: ctx.currentFilePath,
        fileIO: ctx.fileIO,
    };
}
