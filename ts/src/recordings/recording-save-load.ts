/*
 *  recording-save-load.ts — Save/load functions and file path utilities
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c
 *  Functions: getAvailableFilePath, characterForbiddenInFilename,
 *             getDefaultFilePath, saveGameNoPrompt, saveRecordingNoPrompt,
 *             switchToPlaying, copyFile
 *
 *  Interactive save functions (saveGame, saveRecording) are deferred to Phase 3
 *  because they require getInputTextString and confirm dialogs.
 *
 *  loadSavedGame is deferred to Phase 3 because it requires initializeRogue,
 *  startLevel, and UI functions (progress bar, event loop).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { GameConstants } from "../types/types.js";
import { GameMode, ExitStatus } from "../types/enums.js";
import {
    GAME_SUFFIX,
    RECORDING_SUFFIX,
    LAST_GAME_NAME,
} from "../types/constants.js";
import {
    recordChar,
    flushBufferToFile,
    type RecordingBufferContext,
} from "./recording-state.js";
import { EventType } from "../types/enums.js";
import { MonsterBookkeepingFlag } from "../types/flags.js";

// =============================================================================
// File path utilities
// =============================================================================

/**
 * Check if a character is forbidden in filenames.
 * Port of C `characterForbiddenInFilename()`.
 */
export function characterForbiddenInFilename(char: string): boolean {
    return char === "/" || char === "\\" || char === ":";
}

/**
 * Given a defaultPath (without suffix) and a suffix, return either the
 * defaultPath or "defaultPath (N)" where N is the lowest number that
 * doesn't collide with an existing file.
 *
 * Port of C `getAvailableFilePath()`.
 *
 * @returns The path without suffix (caller appends suffix when ready)
 */
export function getAvailableFilePath(
    defaultPath: string,
    suffix: string,
    fileExists: (path: string) => boolean,
): string {
    let result = defaultPath;
    let fullPath = `${result}${suffix}`;
    let iterator = 2;

    while (fileExists(fullPath)) {
        result = `${defaultPath} (${iterator})`;
        fullPath = `${result}${suffix}`;
        iterator++;
    }

    return result;
}

/**
 * Context needed for getDefaultFilePath.
 */
export interface DefaultFilePathContext {
    rogue: {
        seed: bigint;
        depthLevel: number;
        quit: boolean;
        mode: number;
    };
    player: {
        bookkeepingFlags: number;
    };
    gameConst: GameConstants;
    serverMode: boolean;
}

/**
 * Generate the default save/recording file name (without suffix).
 * Port of C `getDefaultFilePath()`.
 */
export function getDefaultFilePath(
    gameOver: boolean,
    ctx: DefaultFilePathContext,
): string {
    const seedStr = formatSeedString(ctx.rogue.seed);

    if (ctx.serverMode) {
        // WebBrogue: short filenames that fit in 30 bytes
        return `#${seedStr}`;
    }

    if (!gameOver) {
        return `Saved ${ctx.gameConst.versionString} #${seedStr} at depth ${ctx.rogue.depthLevel}`;
    } else if (ctx.rogue.quit) {
        return appendModeLabel(
            `${ctx.gameConst.versionString} #${seedStr} Quit at depth ${ctx.rogue.depthLevel}`,
            ctx.rogue.mode,
        );
    } else if (ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) {
        return appendModeLabel(
            `${ctx.gameConst.versionString} #${seedStr} Died at depth ${ctx.rogue.depthLevel}`,
            ctx.rogue.mode,
        );
    } else if (ctx.rogue.depthLevel > 26) {
        return appendModeLabel(
            `${ctx.gameConst.versionString} #${seedStr} Mastered the dungeons`,
            ctx.rogue.mode,
        );
    } else {
        return appendModeLabel(
            `${ctx.gameConst.versionString} #${seedStr} Escaped the dungeons`,
            ctx.rogue.mode,
        );
    }
}

/**
 * Format a seed as a display string.
 * 32-bit numbers are printed in full. 64-bit numbers longer than 11 digits
 * are shortened to e.g. "184...51615".
 */
export function formatSeedString(seed: bigint): string {
    const full = seed.toString();
    if (full.length > 11) {
        const last5 = (seed % 100000n).toString().padStart(5, "0");
        return `${full.substring(0, 3)}...${last5}`;
    }
    return full;
}

/**
 * Append the game mode label if in wizard or easy mode.
 */
function appendModeLabel(path: string, mode: number): string {
    if (mode === GameMode.Wizard) {
        return `${path} (wizard)`;
    } else if (mode === GameMode.Easy) {
        return `${path} (easy)`;
    }
    return path;
}

// =============================================================================
// Save — no-prompt variants (used by auto-save and game-over flows)
// =============================================================================

/**
 * Context needed by save operations.
 */
export interface SaveContext extends RecordingBufferContext {
    rogue: RecordingBufferContext["rogue"] & {
        recording: boolean;
        gameHasEnded: boolean;
        gameExitStatusCode: number;
        quit: boolean;
        depthLevel: number;
    };
    player: {
        bookkeepingFlags: number;
    };
    gameConst: GameConstants;
    serverMode: boolean;
}

/**
 * Save the current game without prompting for a filename.
 * Port of C `saveGameNoPrompt()`.
 */
export function saveGameNoPrompt(ctx: SaveContext): void {
    if (ctx.rogue.playbackMode) {
        return;
    }

    const defaultPath = getDefaultFilePath(false, ctx);
    const filePath = getAvailableFilePath(
        defaultPath,
        GAME_SUFFIX,
        (p) => ctx.fileIO.fileExists(p),
    );
    const fullPath = `${filePath}${GAME_SUFFIX}`;

    flushBufferToFile(ctx);
    ctx.fileIO.renameFile(ctx.currentFilePath, fullPath);
    ctx.currentFilePath = fullPath;

    ctx.rogue.gameHasEnded = true;
    ctx.rogue.gameExitStatusCode = ExitStatus.Success;
    ctx.rogue.recording = false;
}

/**
 * Save the recording without prompting for a filename.
 * Port of C `saveRecordingNoPrompt()`.
 *
 * @returns The full file path of the saved recording.
 */
export function saveRecordingNoPrompt(ctx: SaveContext): string {
    if (ctx.rogue.playbackMode) {
        return "";
    }

    const defaultPath = getDefaultFilePath(true, ctx);
    const filePath = getAvailableFilePath(
        defaultPath,
        RECORDING_SUFFIX,
        (p) => ctx.fileIO.fileExists(p),
    );
    const fullPath = `${filePath}${RECORDING_SUFFIX}`;

    ctx.fileIO.removeFile(fullPath);
    ctx.fileIO.renameFile(ctx.currentFilePath, fullPath);
    ctx.rogue.recording = false;

    return fullPath;
}

// =============================================================================
// switchToPlaying — transition from playback to active play
// =============================================================================

/**
 * Context needed by switchToPlaying.
 */
export interface SwitchToPlayingContext extends RecordingBufferContext {
    rogue: RecordingBufferContext["rogue"] & {
        recording: boolean;
        playbackFastForward: boolean;
        playbackOmniscience: boolean;
    };
}

/**
 * Transition from playback mode to active play mode.
 * Called at the end of loading a saved game.
 * Port of C `switchToPlaying()`.
 *
 * NOTE: The UI refresh calls (blackOutScreen, refreshSideBar, etc.)
 * are deferred to Phase 3. This function handles only the state transition.
 */
export function switchToPlaying(ctx: SwitchToPlayingContext): void {
    const lastGamePath = getAvailableFilePath(
        LAST_GAME_NAME,
        GAME_SUFFIX,
        (p) => ctx.fileIO.fileExists(p),
    );
    const fullLastGamePath = `${lastGamePath}${GAME_SUFFIX}`;

    ctx.rogue.playbackMode = false;
    ctx.rogue.playbackFastForward = false;
    ctx.rogue.playbackOmniscience = false;
    ctx.rogue.recording = true;
    ctx.buffer.bufferPosition = 0;

    ctx.fileIO.copyFile(ctx.currentFilePath, fullLastGamePath, ctx.buffer.streamPosition);

    ctx.currentFilePath = fullLastGamePath;

    // Record that a saved game was loaded
    recordChar(ctx.buffer, EventType.SavedGameLoaded);
}
