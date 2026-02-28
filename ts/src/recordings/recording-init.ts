/*
 *  recording-init.ts — Recording initialization and version checking
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c
 *  Functions: initRecording, getPatchVersion
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { GameConstants } from "../types/types.js";
import { ExitStatus } from "../types/enums.js";
import {
    DEFAULT_PLAYBACK_DELAY,
    BROGUE_PATCH,
} from "../types/constants.js";
import {
    recallChar,
    recallNumber,
    fillBufferFromFile,
    flushBufferToFile,
    type RecordingBuffer,
    type RecordingFileIO,
} from "./recording-state.js";

// =============================================================================
// Version checking
// =============================================================================

/**
 * Attempt to extract the patch version from a version string using
 * a pattern match. The major and minor versions must match the current
 * game constants. Returns the patch version, or null if not compatible.
 *
 * Port of C `getPatchVersion()`.
 *
 * In C, this uses sscanf with patchVersionPattern (e.g. "CE 1.15.%hu").
 * In TypeScript, we use a regex generated from the pattern.
 */
export function getPatchVersion(
    versionString: string,
    patchVersionPattern: string,
): number | null {
    // Split on the format specifier (%hu or %d) and build a regex from the parts
    const parts = patchVersionPattern.split(/%hu|%d/);
    if (parts.length !== 2) {
        // Pattern doesn't contain exactly one format specifier
        return null;
    }

    const escapedParts = parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`^${escapedParts[0]}(\\d+)${escapedParts[1]}$`);

    const match = versionString.match(regex);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

// =============================================================================
// Recording Rogue state subset needed for initRecording
// =============================================================================

/**
 * The slice of PlayerCharacter/rogue state that initRecording reads and writes.
 */
export interface InitRecordingRogue {
    playbackMode: boolean;
    playbackFastForward: boolean;
    playbackPaused: boolean;
    playbackOOS: boolean;
    playbackOmniscience: boolean;
    playbackDelayPerTurn: number;
    playbackDelayThisTurn: number;
    recording: boolean;
    gameHasEnded: boolean;
    gameExitStatusCode: number;
    seed: bigint;
    howManyTurns: number;
    currentTurnNumber: number;
    patchVersion: number;
    nextAnnotationTurn: number;
    nextAnnotation: string;
    locationInAnnotationFile: number;
    versionString: string;
    mode: number;
    playerTurnNumber: number;
    deepestLevel: number;
}

/**
 * Context needed for initRecording.
 */
export interface InitRecordingContext {
    buffer: RecordingBuffer;
    rogue: InitRecordingRogue;
    currentFilePath: string;
    fileIO: RecordingFileIO;
    gameConst: GameConstants;

    /** Callback to seed the random number generator. */
    seedRandomGenerator(seed: bigint): void;

    /** Store the seed for display/recording purposes. */
    previousGameSeed: bigint;

    /** Whether we're in non-interactive (headless) playback mode. */
    nonInteractivePlayback: boolean;

    /** Callback to display an alert dialog (Phase 3 — may be a no-op). */
    dialogAlert(message: string): void;

    /** Check if an annotation file exists at the expected path. */
    annotationPathname: string;
}

/**
 * Initialize recording state.
 * In recording mode: sets up a new recording file.
 * In playback mode: reads the header, validates version, seeds RNG.
 *
 * Port of C `initRecording()`.
 */
export function initRecording(ctx: InitRecordingContext): void {
    if (ctx.currentFilePath === "") {
        return;
    }

    ctx.buffer.bufferPosition = 0;
    ctx.buffer.fileReadPosition = 0;
    ctx.buffer.streamPosition = 0;
    ctx.buffer.maxLevelChanges = 0;
    ctx.rogue.playbackOOS = false;
    ctx.rogue.playbackOmniscience = false;
    ctx.rogue.nextAnnotationTurn = 0;
    ctx.rogue.nextAnnotation = "";
    ctx.rogue.locationInAnnotationFile = 0;
    ctx.rogue.patchVersion = 0;

    if (ctx.rogue.playbackMode) {
        // --- Playback mode: read header from file ---
        ctx.buffer.playbackFileLength = 100000; // large initial value so recalls don't fail
        ctx.rogue.playbackDelayPerTurn = DEFAULT_PLAYBACK_DELAY;
        ctx.rogue.playbackDelayThisTurn = ctx.rogue.playbackDelayPerTurn;
        ctx.rogue.playbackPaused = false;

        const refillBuffer = () => fillBufferFromFile({
            buffer: ctx.buffer,
            rogue: ctx.rogue,
            currentFilePath: ctx.currentFilePath,
            fileIO: ctx.fileIO,
        });
        refillBuffer();

        // Read version string (15 chars)
        let versionString = "";
        for (let i = 0; i < 15; i++) {
            const ch = recallChar(ctx.buffer, refillBuffer);
            if (ch !== 0) {
                versionString += String.fromCharCode(ch);
            }
        }
        ctx.rogue.versionString = versionString;

        // Read game mode
        ctx.rogue.mode = recallChar(ctx.buffer, refillBuffer);

        // Version compatibility check
        const recPatch = getPatchVersion(versionString, ctx.gameConst.patchVersionPattern);
        if (recPatch !== null && recPatch <= ctx.gameConst.patchVersion) {
            // Compatible: major/minor match, patch <= ours
            ctx.rogue.patchVersion = recPatch;
        } else if (versionString !== ctx.gameConst.recordingVersionString) {
            // Incompatible version
            ctx.rogue.playbackMode = false;
            ctx.rogue.playbackFastForward = false;

            const msg = `This file is from version ${versionString} and cannot be opened in version ${ctx.gameConst.versionString}.`;
            if (!ctx.nonInteractivePlayback) {
                ctx.dialogAlert(msg);
            }

            ctx.rogue.playbackMode = true;
            ctx.rogue.playbackPaused = true;
            ctx.rogue.playbackFastForward = false;
            ctx.rogue.playbackOOS = false;
            ctx.rogue.gameHasEnded = true;
            ctx.rogue.gameExitStatusCode = ExitStatus.FailureRecordingWrongVersion;
        }

        // Read recording metadata
        ctx.rogue.seed = recallNumber(ctx.buffer, 8, refillBuffer);
        ctx.rogue.howManyTurns = Number(recallNumber(ctx.buffer, 4, refillBuffer));
        ctx.buffer.maxLevelChanges = Number(recallNumber(ctx.buffer, 4, refillBuffer));
        ctx.buffer.playbackFileLength = Number(recallNumber(ctx.buffer, 4, refillBuffer));

        ctx.seedRandomGenerator(ctx.rogue.seed);
        ctx.previousGameSeed = ctx.rogue.seed;

        // Check for annotation file
        if (ctx.fileIO.fileExists(ctx.annotationPathname)) {
            // loadNextAnnotation() — deferred to Phase 3 (UI)
            // For now, just mark that annotations exist
        } else {
            ctx.rogue.nextAnnotationTurn = -1;
        }
    } else {
        // --- Recording mode: create a new recording file ---
        ctx.rogue.patchVersion = BROGUE_PATCH;
        ctx.rogue.versionString = ctx.gameConst.recordingVersionString;

        ctx.buffer.playbackFileLength = 1;
        ctx.fileIO.removeFile(ctx.currentFilePath);

        // Create the file
        ctx.fileIO.writeHeader(ctx.currentFilePath, new Uint8Array(0));

        // Flush header info (header never makes it into inputRecordBuffer when recording)
        flushBufferToFile({
            buffer: ctx.buffer,
            rogue: ctx.rogue,
            currentFilePath: ctx.currentFilePath,
            fileIO: ctx.fileIO,
        });

        ctx.rogue.recording = true;
    }

    ctx.rogue.currentTurnNumber = 0;
}
