/*
 *  recording-playback.ts — Playback UI: seek, annotation, user interaction
 *  brogue-ts
 *
 *  Ported from: src/brogue/Recordings.c
 *  Functions: loadNextAnnotation, displayAnnotation, printPlaybackHelpScreen,
 *             resetPlayback, seek, promptToAdvanceToLocation, pausePlayback,
 *             executePlaybackInput, describeKeystroke, appendModifierKeyDescription,
 *             selectFile, parseFile
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { RogueEvent, Color, ScreenDisplayBuffer, SavedDisplayBuffer } from "../types/types.js";
import { EventType, TextEntryType, NGCommand, GraphicsMode } from "../types/enums.js";
import {
    COLS, ROWS, DCOLS, STAT_BAR_WIDTH, INTERFACE_OPACITY, MESSAGE_LINES,
    KEYBOARD_LABELS, DEFAULT_PLAYBACK_DELAY,
    UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW,
    UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY,
    ACKNOWLEDGE_KEY, TAB_KEY, ASCEND_KEY, DESCEND_KEY,
    INVENTORY_KEY, BROGUE_HELP_KEY, FEATS_KEY,
    DISCOVERIES_KEY, MESSAGE_ARCHIVE_KEY,
    VIEW_RECORDING_KEY, LOAD_SAVED_GAME_KEY, NEW_GAME_KEY,
    QUIT_KEY, TRUE_COLORS_KEY, STEALTH_RANGE_KEY,
    GRAPHICS_KEY, SEED_KEY, SWITCH_TO_PLAYING_KEY,
    ESCAPE_KEY, NUMPAD_0, NUMPAD_9,
    RECORDING_SUFFIX, GAME_SUFFIX,
    UNKNOWN_KEY,
} from "../types/constants.js";
import {
    uncompressKeystroke,
    recallChar,
    recallNumber,
    fillBufferFromFile,
    type RecordingBuffer,
    type RecordingBufferContext,
} from "./recording-state.js";

// =============================================================================
// Recording Seek Modes
// =============================================================================

export enum RecordingSeekMode {
    Turn = 0,
    Depth,
}

// =============================================================================
// DI Context — Playback UI
// =============================================================================

/**
 * Rogue-state subset needed by playback UI functions.
 */
export interface PlaybackRogueState {
    playbackMode: boolean;
    playbackPaused: boolean;
    playbackFastForward: boolean;
    playbackOmniscience: boolean;
    playbackDelayPerTurn: number;
    playbackDelayThisTurn: number;
    playbackOOS: boolean;
    playbackBetweenTurns: boolean;
    gameHasEnded: boolean;
    gameExitStatusCode: number;
    playerTurnNumber: number;
    depthLevel: number;
    howManyTurns: number;
    creaturesWillFlashThisTurn: boolean;
    trueColorMode: boolean;
    displayStealthRangeMode: boolean;
    autoPlayingLevel: boolean;
    RNG: number;
    nextGame: NGCommand;
    nextGamePath: string;
    currentGamePath: string;
    nextAnnotationTurn: number;
    nextAnnotation: string;
    locationInAnnotationFile: number;
}

/**
 * Full DI context for playback UI functions.
 */
export interface PlaybackContext {
    rogue: PlaybackRogueState;

    /** Recording buffer state. */
    buffer: RecordingBuffer;

    /** Maximum level changes in the recording. */
    maxLevelChanges: number;

    /** Whether non-interactive playback is active. */
    nonInteractivePlayback: boolean;

    /** Annotation file path. */
    annotationPathname: string;

    /** Whether the platform has graphics tile support. */
    hasGraphics: boolean;

    /** Current graphics mode. */
    graphicsMode: GraphicsMode;

    /** RNG constants. */
    RNG_COSMETIC: number;
    RNG_SUBSTANTIVE: number;

    // ── Colors ──────────────────────────────────────────────────────────────
    black: Color;
    white: Color;
    teal: Color;
    darkPurple: Color;
    itemMessageColor: Color;

    // ── Display ─────────────────────────────────────────────────────────────
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: SavedDisplayBuffer): void;
    commitDraws(): void;
    printString(
        str: string, x: number, y: number,
        foreColor: Color, backColor: Color,
        dbuf: ScreenDisplayBuffer | null,
    ): void;
    printProgressBar(
        x: number, y: number, label: string,
        current: number, max: number, fillColor: Color, dim: boolean,
    ): void;
    rectangularShading(
        x: number, y: number, width: number, height: number,
        backColor: Color, opacity: number, dbuf: ScreenDisplayBuffer,
    ): void;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    windowToMapX(x: number): number;
    encodeMessageColor(color: Color): string;

    // ── Messages ────────────────────────────────────────────────────────────
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Color, flags: number): void;
    confirmMessages(): void;
    updateMessageDisplay(): void;
    flashTemporaryAlert(msg: string, duration: number): void;

    // ── UI Screens ──────────────────────────────────────────────────────────
    displayLevel(): void;
    refreshSideBar(focusX: number, focusY: number, highlight: boolean): void;
    displayInventory(category: number, titleMode: number, selMode: number, waiting: boolean, withButtons: boolean): number;
    displayFeatsScreen(): void;
    printDiscoveriesScreen(): void;
    displayMessageArchive(): void;
    printSeed(): void;
    printTextBox(text: string, x: number, y: number, width: number, backColor: Color, foreColor: Color, dbuf: ScreenDisplayBuffer | null, flags: number): void;
    displayMoreSign(): void;
    waitForAcknowledgment(): void;
    blackOutScreen(): void;

    // ── Input ───────────────────────────────────────────────────────────────
    confirm(prompt: string, alsoDuringPlayback: boolean): boolean;
    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInputEvenInPlayback: boolean): RogueEvent;
    pauseBrogue(milliseconds: number, behavior: number): boolean;
    stripShiftFromMovementKeystroke(key: number): number;
    mainInputLoop(): void;
    getInputTextString(
        resultBuf: string[], prompt: string, maxLength: number,
        defaultText: string, suffix: string, inputType: TextEntryType, confirmOnEntry: boolean,
    ): boolean;
    dialogChooseFile(suffix: string, prompt: string): string | null;
    fileExists(path: string): boolean;

    // ── Game lifecycle ──────────────────────────────────────────────────────
    notifyEvent(type: string, score: number, data: number, description: string, recording: string): void;
    setGraphicsMode(mode: GraphicsMode): GraphicsMode;
    freeEverything(): void;
    initializeRogue(seed: bigint): void;
    startLevel(depth: number, stairDirection: number): void;
    resetRandomNumbersGenerated(): void;

    // ── Recording file I/O ──────────────────────────────────────────────────
    /** Read annotation file contents. Returns lines of text. */
    readAnnotationFile(pathname: string, offset: number): { lines: string[]; newOffset: number } | null;

    // ── Playback switch (optional) ──────────────────────────────────────────
    /** switchToPlaying if enabled. */
    switchToPlaying?(): void;
    enablePlaybackSwitch: boolean;

    /** RecordingBufferContext needed by fillBufferFromFile (parseFile). */
    bufferCtx: RecordingBufferContext;

    // ── Constants ────────────────────────────────────────────────────────────
    ALL_ITEMS: number;
    REQUIRE_ACKNOWLEDGMENT: number;
    PAUSE_BEHAVIOR_DEFAULT: number;
    GAMEOVER_RECORDING: string;

    /** Refill buffer callback for recallChar/recallNumber. */
    refillBuffer(): void;

    /** Execute a game event (delegates to IO executeEvent). */
    executeEvent(event: RogueEvent): void;
}

// =============================================================================
// Annotation System
// =============================================================================

/**
 * Load the next annotation from the annotation file.
 * Port of C `loadNextAnnotation()`.
 */
export function loadNextAnnotation(ctx: PlaybackContext): void {
    if (ctx.rogue.nextAnnotationTurn === -1) {
        return;
    }

    const result = ctx.readAnnotationFile(ctx.annotationPathname, ctx.rogue.locationInAnnotationFile);
    if (result === null) {
        return;
    }

    for (const line of result.lines) {
        // Try to parse "turnNumber\tdescription"
        const tabIndex = line.indexOf("\t");
        if (tabIndex === -1) {
            // No tab — skip this line
            continue;
        }
        const turnStr = line.substring(0, tabIndex);
        const currentReadTurn = parseInt(turnStr, 10);
        if (isNaN(currentReadTurn)) {
            continue;
        }

        const description = line.substring(tabIndex + 1);

        if (currentReadTurn > ctx.rogue.playerTurnNumber ||
            (currentReadTurn <= 1 && ctx.rogue.playerTurnNumber <= 1 && currentReadTurn >= ctx.rogue.playerTurnNumber)) {

            ctx.rogue.nextAnnotationTurn = currentReadTurn;

            // Strip trailing newline and non-printable characters
            let cleaned = description.replace(/\n$/, "");
            cleaned = cleaned.replace(/[^ -~]/g, " ");
            ctx.rogue.nextAnnotation = cleaned;

            ctx.rogue.locationInAnnotationFile = result.newOffset;
            return;
        }
    }

    // Reached end of file without finding a future annotation
    ctx.rogue.nextAnnotation = "";
    ctx.rogue.nextAnnotationTurn = -1;
    ctx.rogue.locationInAnnotationFile = result.newOffset;
}

/**
 * Display the current annotation if we've reached its turn number.
 * Port of C `displayAnnotation()`.
 */
export function displayAnnotation(ctx: PlaybackContext): void {
    if (ctx.rogue.playbackMode &&
        ctx.rogue.playerTurnNumber === ctx.rogue.nextAnnotationTurn) {

        if (!ctx.rogue.playbackFastForward) {
            ctx.refreshSideBar(-1, -1, false);

            const rbuf = ctx.saveDisplayBuffer();
            ctx.printTextBox(
                ctx.rogue.nextAnnotation,
                0, 0, 0, // x=0, y=0, width=0 (auto)
                ctx.black, ctx.white, null, 0,
            );

            ctx.rogue.playbackMode = false;
            ctx.displayMoreSign();
            ctx.rogue.playbackMode = true;

            ctx.restoreDisplayBuffer(rbuf);
        }

        loadNextAnnotation(ctx);
    }
}

// =============================================================================
// Playback Help Screen
// =============================================================================

const PLAYBACK_HELP_LINE_COUNT = 20;

/**
 * Display the playback help screen overlay.
 * Port of C `printPlaybackHelpScreen()`.
 */
export function printPlaybackHelpScreen(ctx: PlaybackContext): void {
    const helpText: string[] = [
        "Commands:",
        "",
        "         <space>: pause or unpause playback",
        "   k or up arrow: play back faster",
        " j or down arrow: play back slower",
        "               <: go to previous level",
        "               >: go to next level",
        "             0-9: skip to specified turn number",
        "l or right arrow: advance one turn (shift for 5 turns; control for 20)",
        "",
        "           <tab>: enable or disable omniscience",
        "          return: examine surroundings",
        "               i: display inventory",
        "               D: display discovered items",
        "               V: view saved recording",
        "               O: open and resume saved game",
        "               N: begin a new game",
        "               Q: quit to title screen",
        "",
        "        -- press any key to continue --",
    ];

    // Replace the text after the colon with white color escapes
    const whiteEsc = ctx.encodeMessageColor(ctx.white);
    for (let i = 0; i < helpText.length; i++) {
        const colonIdx = helpText[i].indexOf(": ");
        if (colonIdx !== -1) {
            helpText[i] = helpText[i].substring(0, colonIdx + 2) + whiteEsc + helpText[i].substring(colonIdx + 2);
        }
    }

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);

    for (let i = 0; i < PLAYBACK_HELP_LINE_COUNT && i < helpText.length; i++) {
        ctx.printString(helpText[i], ctx.mapToWindowX(5), ctx.mapToWindowY(i),
            ctx.itemMessageColor, ctx.black, dbuf);
    }

    // Set opacity: sidebar area = 0, map area = INTERFACE_OPACITY
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[i][j].opacity = (i < STAT_BAR_WIDTH ? 0 : INTERFACE_OPACITY);
        }
    }

    const rbuf = ctx.saveDisplayBuffer();
    ctx.overlayDisplayBuffer(dbuf);

    ctx.rogue.playbackMode = false;
    ctx.waitForAcknowledgment();
    ctx.rogue.playbackMode = true;
    ctx.restoreDisplayBuffer(rbuf);
}

// =============================================================================
// Reset Playback
// =============================================================================

/**
 * Reset the playback state to the beginning, preserving display preferences.
 * Port of C `resetPlayback()`.
 */
function resetPlayback(ctx: PlaybackContext): void {
    const omniscient = ctx.rogue.playbackOmniscience;
    const stealth = ctx.rogue.displayStealthRangeMode;
    const trueColors = ctx.rogue.trueColorMode;

    ctx.freeEverything();
    ctx.resetRandomNumbersGenerated();
    ctx.rogue.playbackMode = true;
    ctx.initializeRogue(0n); // Seed argument is ignored during playback.

    ctx.rogue.playbackOmniscience = omniscient;
    ctx.rogue.displayStealthRangeMode = stealth;
    ctx.rogue.trueColorMode = trueColors;

    ctx.rogue.playbackFastForward = false;
    ctx.blackOutScreen();
    ctx.rogue.playbackFastForward = true;
    ctx.startLevel(ctx.rogue.depthLevel, 1);
}

// =============================================================================
// Seek
// =============================================================================

/**
 * Seek to a target turn or depth in the recording.
 * Port of C `seek()`.
 */
function seek(seekTarget: number, seekMode: RecordingSeekMode, ctx: PlaybackContext): void {
    let progressBarRefreshInterval = 1;
    let startTurnNumber = 0;
    let targetTurnNumber = 0;
    let avgTurnsPerLevel = 1;
    let useProgressBar = false;
    let arrivedAtDestination = false;

    const pauseState = ctx.rogue.playbackPaused;

    // Configure progress bar
    switch (seekMode) {
        case RecordingSeekMode.Depth:
            if (ctx.maxLevelChanges > 0) {
                avgTurnsPerLevel = Math.floor(ctx.rogue.howManyTurns / ctx.maxLevelChanges);
            }
            if (seekTarget <= ctx.rogue.depthLevel) {
                startTurnNumber = 0;
                targetTurnNumber = avgTurnsPerLevel * seekTarget;
            } else {
                startTurnNumber = ctx.rogue.playerTurnNumber;
                targetTurnNumber = ctx.rogue.playerTurnNumber + avgTurnsPerLevel;
            }
            break;
        case RecordingSeekMode.Turn:
            if (seekTarget < ctx.rogue.playerTurnNumber) {
                startTurnNumber = 0;
                targetTurnNumber = seekTarget;
            } else {
                startTurnNumber = ctx.rogue.playerTurnNumber;
                targetTurnNumber = seekTarget;
            }
            break;
    }

    if (targetTurnNumber - startTurnNumber > 100) {
        useProgressBar = true;
        progressBarRefreshInterval = Math.max(1, Math.floor(targetTurnNumber / 500));
    }

    // There is no rewind, so start over at depth 1
    if ((seekMode === RecordingSeekMode.Turn && seekTarget < ctx.rogue.playerTurnNumber)
        || (seekMode === RecordingSeekMode.Depth && seekTarget <= ctx.rogue.depthLevel)) {

        resetPlayback(ctx);
        if ((seekMode === RecordingSeekMode.Depth && seekTarget === 1)
            || (seekMode === RecordingSeekMode.Turn && seekTarget === 0)) {
            arrivedAtDestination = true;
        }
    }

    if (useProgressBar) {
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.rectangularShading(
            Math.floor((COLS - 20) / 2), Math.floor(ROWS / 2),
            20, 1, ctx.black, INTERFACE_OPACITY, dbuf,
        );
        ctx.overlayDisplayBuffer(dbuf);
        ctx.commitDraws();
    }
    ctx.rogue.playbackFastForward = true;

    while (!arrivedAtDestination && !ctx.rogue.gameHasEnded && !ctx.rogue.playbackOOS) {
        if (useProgressBar && (ctx.rogue.playerTurnNumber % progressBarRefreshInterval === 0)) {
            ctx.rogue.playbackFastForward = false; // so that pauseBrogue looks for inputs
            ctx.printProgressBar(
                Math.floor((COLS - 20) / 2), Math.floor(ROWS / 2),
                "[     Loading...   ]",
                ctx.rogue.playerTurnNumber - startTurnNumber,
                targetTurnNumber - startTurnNumber,
                ctx.darkPurple, false,
            );
            while (ctx.pauseBrogue(0, ctx.PAUSE_BEHAVIOR_DEFAULT)) {
                if (ctx.rogue.gameHasEnded) {
                    return;
                }
                ctx.rogue.creaturesWillFlashThisTurn = false;
                ctx.nextBrogueEvent(true, false, true); // eat input if not clicking X
            }
            ctx.rogue.playbackFastForward = true;
        }

        ctx.rogue.RNG = ctx.RNG_COSMETIC; // dancing terrain colors can't influence recordings
        ctx.rogue.playbackDelayThisTurn = 0;
        const theEvent = ctx.nextBrogueEvent(false, true, false);
        ctx.rogue.RNG = ctx.RNG_SUBSTANTIVE;
        executeEvent(theEvent, ctx);

        if ((seekMode === RecordingSeekMode.Depth && ctx.rogue.depthLevel === seekTarget)
            || (seekMode === RecordingSeekMode.Turn && ctx.rogue.playerTurnNumber >= seekTarget)) {
            arrivedAtDestination = true;
        }
    }

    ctx.rogue.playbackPaused = pauseState;
    ctx.rogue.playbackFastForward = false;
    ctx.confirmMessages();
    ctx.updateMessageDisplay();
    ctx.refreshSideBar(-1, -1, false);
    ctx.displayLevel();
}

/**
 * Execute an event during playback seeking.
 * This is a thin wrapper — the real executeEvent is in io-input.ts,
 * injected via context.
 */
function executeEvent(event: RogueEvent, ctx: PlaybackContext): void {
    // During seek, events are fed directly to the game engine.
    // The actual dispatch is handled by whatever mainInputLoop does
    // with the event. In the C code, executeEvent is a function in IO.c.
    // We delegate to the context.
    ctx.executeEvent(event);
}

// =============================================================================
// Prompt to Advance to Location
// =============================================================================

/**
 * Ask the user for a turn number and seek to it.
 * Port of C `promptToAdvanceToLocation()`.
 */
function promptToAdvanceToLocation(keystroke: number, ctx: PlaybackContext): void {
    if (ctx.rogue.playbackOOS || !ctx.rogue.playbackPaused || unpause(ctx)) {
        const initialText = (keystroke === "0".charCodeAt(0) ? "" : String.fromCharCode(keystroke));

        ctx.rogue.playbackMode = false;
        const resultBuf: string[] = [initialText];
        const enteredText = ctx.getInputTextString(
            resultBuf, "Go to turn number: ", 9, initialText, "",
            TextEntryType.Numbers, false,
        );
        ctx.confirmMessages();
        ctx.rogue.playbackMode = true;

        if (enteredText && resultBuf[0] !== "") {
            const destinationFrame = parseInt(resultBuf[0], 10);

            if (ctx.rogue.playbackOOS && destinationFrame > ctx.rogue.playerTurnNumber) {
                ctx.flashTemporaryAlert(" Out of sync ", 3000);
            } else if (destinationFrame === ctx.rogue.playerTurnNumber) {
                ctx.flashTemporaryAlert(` Already at turn ${destinationFrame} `, 1000);
            } else {
                seek(
                    Math.min(destinationFrame, ctx.rogue.howManyTurns),
                    RecordingSeekMode.Turn,
                    ctx,
                );
            }
            ctx.rogue.playbackPaused = true;
        }
    }
}

/**
 * Attempt to unpause — returns true if successfully unpaused (or was already unpaused).
 * Used by promptToAdvanceToLocation.
 */
function unpause(ctx: PlaybackContext): boolean {
    if (!ctx.rogue.playbackPaused) {
        return true;
    }
    // In the C code, this tries to unpause and returns whether it succeeded.
    // The guard `!rogue.playbackPaused || unpause()` means:
    // "if already unpaused, proceed; otherwise try to unpause"
    return false;
}

// =============================================================================
// Pause Playback
// =============================================================================

/**
 * Pause the playback and enter the main input loop until unpaused.
 * Port of C `pausePlayback()`.
 */
export function pausePlayback(ctx: PlaybackContext): void {
    if (!ctx.rogue.playbackPaused) {
        ctx.rogue.playbackPaused = true;
        ctx.messageWithColor(
            KEYBOARD_LABELS
                ? "recording paused. Press space to play."
                : "recording paused.",
            ctx.teal, 0,
        );
        ctx.refreshSideBar(-1, -1, false);
        ctx.mainInputLoop();
        ctx.messageWithColor("recording unpaused.", ctx.teal, 0);
        ctx.rogue.playbackPaused = false;
        ctx.refreshSideBar(-1, -1, false);
        ctx.rogue.playbackDelayThisTurn = DEFAULT_PLAYBACK_DELAY;
    }
}

// =============================================================================
// Execute Playback Input
// =============================================================================

/**
 * Process user input during playback — speed, pausing, seeking, screen access.
 * Port of C `executePlaybackInput()`.
 *
 * Returns true if the input was handled by the playback system.
 */
export function executePlaybackInput(
    recordingInput: RogueEvent,
    ctx: PlaybackContext,
): boolean {
    if (!ctx.rogue.playbackMode) {
        return false;
    }

    if (ctx.nonInteractivePlayback) {
        return false;
    }

    if (recordingInput.eventType === EventType.Keystroke) {
        let key = recordingInput.param1;
        key = ctx.stripShiftFromMovementKeystroke(key);

        switch (key) {
            case UP_ARROW:
            case UP_KEY: {
                const newDelay = Math.max(1, Math.min(
                    Math.floor(ctx.rogue.playbackDelayPerTurn * 2 / 3),
                    ctx.rogue.playbackDelayPerTurn - 1,
                ));
                if (newDelay !== ctx.rogue.playbackDelayPerTurn) {
                    ctx.flashTemporaryAlert(" Faster ", 300);
                }
                ctx.rogue.playbackDelayPerTurn = newDelay;
                ctx.rogue.playbackDelayThisTurn = ctx.rogue.playbackDelayPerTurn;
                return true;
            }
            case DOWN_ARROW:
            case DOWN_KEY: {
                const newDelay = Math.min(3000, Math.max(
                    Math.floor(ctx.rogue.playbackDelayPerTurn * 3 / 2),
                    ctx.rogue.playbackDelayPerTurn + 1,
                ));
                if (newDelay !== ctx.rogue.playbackDelayPerTurn) {
                    ctx.flashTemporaryAlert(" Slower ", 300);
                }
                ctx.rogue.playbackDelayPerTurn = newDelay;
                ctx.rogue.playbackDelayThisTurn = ctx.rogue.playbackDelayPerTurn;
                return true;
            }
            case ACKNOWLEDGE_KEY:
                if (ctx.rogue.playbackOOS && ctx.rogue.playbackPaused) {
                    ctx.flashTemporaryAlert(" Out of sync ", 2000);
                } else {
                    ctx.rogue.playbackPaused = !ctx.rogue.playbackPaused;
                }
                return true;

            case TAB_KEY:
                ctx.rogue.playbackOmniscience = !ctx.rogue.playbackOmniscience;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                if (ctx.rogue.playbackOmniscience) {
                    ctx.messageWithColor("Omniscience enabled.", ctx.teal, 0);
                } else {
                    ctx.messageWithColor("Omniscience disabled.", ctx.teal, 0);
                }
                return true;

            case ASCEND_KEY:
                seek(Math.max(ctx.rogue.depthLevel - 1, 1), RecordingSeekMode.Depth, ctx);
                return true;

            case DESCEND_KEY:
                if (ctx.rogue.depthLevel === ctx.maxLevelChanges) {
                    ctx.flashTemporaryAlert(" Already reached deepest depth explored ", 2000);
                    return false;
                }
                seek(ctx.rogue.depthLevel + 1, RecordingSeekMode.Depth, ctx);
                return true;

            case INVENTORY_KEY:
                ctx.rogue.playbackMode = false;
                ctx.displayInventory(ctx.ALL_ITEMS, 0, 0, true, false);
                ctx.rogue.playbackMode = true;
                return true;

            case RIGHT_KEY:
            case RIGHT_ARROW:
            case LEFT_KEY:
            case LEFT_ARROW: {
                let frameCount: number;
                if (key === RIGHT_KEY || key === RIGHT_ARROW) {
                    frameCount = 1;
                } else {
                    frameCount = -1;
                }
                if (recordingInput.shiftKey) {
                    frameCount *= 5;
                }
                if (recordingInput.controlKey) {
                    frameCount *= 20;
                }

                let destinationFrame: number;
                if (frameCount < 0) {
                    if ((-frameCount) > ctx.rogue.playerTurnNumber) {
                        destinationFrame = 0;
                    } else {
                        destinationFrame = ctx.rogue.playerTurnNumber + frameCount;
                    }
                } else {
                    destinationFrame = Math.min(
                        ctx.rogue.playerTurnNumber + frameCount,
                        ctx.rogue.howManyTurns,
                    );
                }

                if (destinationFrame === ctx.rogue.playerTurnNumber) {
                    ctx.flashTemporaryAlert(" Already at end of recording ", 1000);
                } else if (frameCount < 0) {
                    ctx.rogue.playbackMode = false;
                    const proceed = (ctx.rogue.playerTurnNumber < 100 || ctx.confirm("Rewind?", true));
                    ctx.rogue.playbackMode = true;
                    if (proceed) {
                        seek(destinationFrame, RecordingSeekMode.Turn, ctx);
                    }
                } else {
                    // advance by the right number of turns
                    seek(destinationFrame, RecordingSeekMode.Turn, ctx);
                }
                return true;
            }

            case BROGUE_HELP_KEY:
                printPlaybackHelpScreen(ctx);
                return true;

            case FEATS_KEY:
                ctx.rogue.playbackMode = false;
                ctx.displayFeatsScreen();
                ctx.rogue.playbackMode = true;
                return true;

            case DISCOVERIES_KEY:
                ctx.rogue.playbackMode = false;
                ctx.printDiscoveriesScreen();
                ctx.rogue.playbackMode = true;
                return true;

            case MESSAGE_ARCHIVE_KEY:
                ctx.rogue.playbackMode = false;
                ctx.displayMessageArchive();
                ctx.rogue.playbackMode = true;
                return true;

            case VIEW_RECORDING_KEY: {
                ctx.confirmMessages();
                ctx.rogue.playbackMode = false;
                const path = ctx.dialogChooseFile(RECORDING_SUFFIX, "View recording: ");
                if (path !== null) {
                    if (ctx.fileExists(path)) {
                        ctx.rogue.nextGamePath = path;
                        ctx.rogue.currentGamePath = path;
                        ctx.rogue.nextGame = NGCommand.ViewRecording;
                        ctx.rogue.gameHasEnded = true;
                        ctx.rogue.gameExitStatusCode = 0; // EXIT_STATUS_SUCCESS
                    } else {
                        ctx.message("File not found.", 0);
                    }
                }
                ctx.rogue.playbackMode = true;
                return true;
            }

            case LOAD_SAVED_GAME_KEY: {
                ctx.confirmMessages();
                ctx.rogue.playbackMode = false;
                const path = ctx.dialogChooseFile(GAME_SUFFIX, "Open saved game: ");
                if (path !== null) {
                    if (ctx.fileExists(path)) {
                        ctx.rogue.nextGamePath = path;
                        ctx.rogue.currentGamePath = path;
                        ctx.rogue.nextGame = NGCommand.OpenGame;
                        ctx.rogue.gameHasEnded = true;
                    } else {
                        ctx.message("File not found.", 0);
                    }
                }
                ctx.rogue.playbackMode = true;
                return true;
            }

            case NEW_GAME_KEY:
                ctx.rogue.playbackMode = false;
                if (ctx.confirm("Close recording and begin a new game?", true)) {
                    ctx.rogue.nextGame = NGCommand.NewGame;
                    ctx.rogue.gameHasEnded = true;
                }
                ctx.rogue.playbackMode = true;
                return true;

            case QUIT_KEY:
                ctx.rogue.gameHasEnded = true;
                ctx.rogue.gameExitStatusCode = 0; // EXIT_STATUS_SUCCESS
                ctx.rogue.playbackOOS = false;
                ctx.rogue.creaturesWillFlashThisTurn = false;
                ctx.notifyEvent(ctx.GAMEOVER_RECORDING, 0, 0, "recording ended", "none");
                return true;

            case TRUE_COLORS_KEY:
                ctx.rogue.trueColorMode = !ctx.rogue.trueColorMode;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                if (ctx.rogue.trueColorMode) {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Color effects disabled. Press '\\' again to enable."
                            : "Color effects disabled.",
                        ctx.teal, 0,
                    );
                } else {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Color effects enabled. Press '\\' again to disable."
                            : "Color effects enabled.",
                        ctx.teal, 0,
                    );
                }
                return true;

            case STEALTH_RANGE_KEY:
                ctx.rogue.displayStealthRangeMode = !ctx.rogue.displayStealthRangeMode;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                if (ctx.rogue.displayStealthRangeMode) {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Stealth range displayed. Press ']' again to hide."
                            : "Stealth range displayed.",
                        ctx.teal, 0,
                    );
                } else {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Stealth range hidden. Press ']' again to display."
                            : "Stealth range hidden.",
                        ctx.teal, 0,
                    );
                }
                return true;

            case GRAPHICS_KEY:
                if (ctx.hasGraphics) {
                    ctx.graphicsMode = ctx.setGraphicsMode(((ctx.graphicsMode as number) + 1) % 3 as GraphicsMode);
                    switch (ctx.graphicsMode) {
                        case GraphicsMode.Text:
                            ctx.messageWithColor(
                                KEYBOARD_LABELS
                                    ? "Switched to text mode. Press 'G' again to enable tiles."
                                    : "Switched to text mode.",
                                ctx.teal, 0,
                            );
                            break;
                        case GraphicsMode.Tiles:
                            ctx.messageWithColor(
                                KEYBOARD_LABELS
                                    ? "Switched to graphical tiles. Press 'G' again to enable hybrid mode."
                                    : "Switched to graphical tiles.",
                                ctx.teal, 0,
                            );
                            break;
                        case GraphicsMode.Hybrid:
                            ctx.messageWithColor(
                                KEYBOARD_LABELS
                                    ? "Switched to hybrid mode. Press 'G' again to disable tiles."
                                    : "Switched to hybrid mode.",
                                ctx.teal, 0,
                            );
                            break;
                    }
                }
                return true;

            case SEED_KEY:
                ctx.printSeed();
                return true;

            case SWITCH_TO_PLAYING_KEY:
                if (ctx.enablePlaybackSwitch) {
                    if (!ctx.rogue.gameHasEnded && !ctx.rogue.playbackOOS) {
                        ctx.switchToPlaying?.();
                        ctx.buffer.playbackFileLength = ctx.buffer.streamPosition;
                    }
                    return true;
                }
                return false;

            case ESCAPE_KEY:
                if (!ctx.rogue.playbackPaused) {
                    ctx.rogue.playbackPaused = true;
                    return true;
                }
                return false;

            default:
                if ((key >= "0".charCodeAt(0) && key <= "9".charCodeAt(0))
                    || (key >= NUMPAD_0 && key <= NUMPAD_9)) {
                    promptToAdvanceToLocation(key, ctx);
                    return true;
                }
                return false;
        }
    } else if (recordingInput.eventType === EventType.MouseUp) {
        const x = recordingInput.param1;
        const y = recordingInput.param2;
        if (ctx.windowToMapX(x) >= 0 && ctx.windowToMapX(x) < DCOLS && y >= 0 && y < MESSAGE_LINES) {
            // Click in message block — display message archive
            ctx.rogue.playbackMode = false;
            ctx.displayMessageArchive();
            ctx.rogue.playbackMode = true;
            return true;
        } else if (!ctx.rogue.playbackPaused) {
            // clicking anywhere else pauses the playback
            ctx.rogue.playbackPaused = true;
            return true;
        }
    } else if (recordingInput.eventType === EventType.RightMouseUp) {
        ctx.rogue.playbackMode = false;
        ctx.displayInventory(ctx.ALL_ITEMS, 0, 0, true, false);
        ctx.rogue.playbackMode = true;
        return true;
    }

    return false;
}

// =============================================================================
// Keystroke Description (debug/parse)
// =============================================================================

/**
 * Key list for the recording parser keystroke description.
 * Port of C `describeKeystroke()` lookup table.
 */
import {
    REST_KEY, AUTO_REST_KEY, SEARCH_KEY,
    EQUIP_KEY, UNEQUIP_KEY, APPLY_KEY, THROW_KEY,
    RELABEL_KEY, DROP_KEY, CALL_KEY,
    EXPLORE_KEY, AUTOPLAY_KEY, EASY_MODE_KEY,
    RETURN_KEY, DELETE_KEY, PERIOD_KEY,
    NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
    NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
} from "../types/constants.js";

const KEY_LIST: readonly number[] = [
    UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY, UP_ARROW, LEFT_ARROW,
    DOWN_ARROW, RIGHT_ARROW, UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    DESCEND_KEY, ASCEND_KEY, REST_KEY, AUTO_REST_KEY, SEARCH_KEY, INVENTORY_KEY,
    ACKNOWLEDGE_KEY, EQUIP_KEY, UNEQUIP_KEY, APPLY_KEY, THROW_KEY, RELABEL_KEY, DROP_KEY, CALL_KEY,
    BROGUE_HELP_KEY, FEATS_KEY, DISCOVERIES_KEY, RETURN_KEY,
    EXPLORE_KEY, AUTOPLAY_KEY, SEED_KEY, EASY_MODE_KEY, ESCAPE_KEY,
    RETURN_KEY, DELETE_KEY, TAB_KEY, PERIOD_KEY, VIEW_RECORDING_KEY, NUMPAD_0,
    NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4, NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8,
    NUMPAD_9, UNKNOWN_KEY,
];

const DESC_LIST: readonly string[] = [
    "up", "down", "left", "right", "up arrow", "left arrow",
    "down arrow", "right arrow", "upleft", "upright", "downleft", "downright",
    "descend", "ascend", "rest", "auto rest", "search", "inventory", "acknowledge",
    "equip", "unequip", "apply", "throw", "relabel", "drop", "call",
    "help", "discoveries", "repeat travel", "return", "explore", "autoplay", "seed",
    "easy mode", "escape", "return", "delete", "tab", "period", "open file",
    "numpad 0", "numpad 1", "numpad 2", "numpad 3", "numpad 4", "numpad 5", "numpad 6",
    "numpad 7", "numpad 8", "numpad 9", "unknown",
];

/**
 * Describe a compressed keystroke byte for the recording parser.
 * Port of C `describeKeystroke()`.
 */
export function describeKeystroke(keyByte: number): string {
    const key = uncompressKeystroke(keyByte);
    for (let i = 0; i < KEY_LIST.length; i++) {
        if (key === KEY_LIST[i]) {
            return DESC_LIST[i];
        }
    }
    return `key ${key}`;
}

/**
 * Read and decode modifier key byte from the recording buffer.
 * Port of C `appendModifierKeyDescription()`.
 */
function appendModifierKeyDescription(modByte: number): string {
    let suffix = "";
    if (modByte & (1 << 1)) {
        suffix += " + CTRL";
    }
    if (modByte & (1 << 2)) {
        suffix += " + SHIFT";
    }
    return suffix;
}

// =============================================================================
// Select File (debug)
// =============================================================================

/**
 * Deprecated helper — only used by `parseFile`.
 * Port of C `selectFile()`.
 */
function selectFile(prompt: string, _defaultName: string, suffix: string, ctx: PlaybackContext): boolean {
    const path = ctx.dialogChooseFile(suffix, prompt);
    if (path !== null) {
        if (ctx.fileExists(path)) {
            return true;
        } else {
            ctx.confirmMessages();
            ctx.message("File not found.", 0);
        }
    }
    return false;
}

// =============================================================================
// Parse File (debug)
// =============================================================================

/**
 * Parse a recording file and produce a textual event description.
 * Port of C `parseFile()`.
 *
 * NOTE: This is a debugging utility. In the browser context we return
 * the description as a string rather than writing to a file.
 */
export function parseFile(ctx: PlaybackContext): string | null {
    if (!selectFile("Parse recording: ", "Recording.broguerec", "", ctx)) {
        ctx.confirmMessages();
        return null;
    }

    // Save current buffer state
    const oldStreamPos = ctx.buffer.streamPosition;
    const oldBufPos = ctx.buffer.bufferPosition;
    const oldFileLen = ctx.buffer.playbackFileLength;
    const oldFileReadPos = ctx.buffer.fileReadPosition;

    ctx.buffer.streamPosition = 0;
    ctx.buffer.bufferPosition = 0;
    ctx.buffer.fileReadPosition = 0;
    ctx.buffer.playbackFileLength = 10_000_000; // hack so that the recalls don't freak out
    fillBufferFromFile(ctx.bufferCtx);

    const lines: string[] = [];

    // Read header
    let versionStr = "";
    for (let i = 0; i < 16; i++) {
        versionStr += String.fromCharCode(recallChar(ctx.buffer, ctx.refillBuffer));
    }

    const seed = recallNumber(ctx.buffer, 8, ctx.refillBuffer);
    const numTurns = recallNumber(ctx.buffer, 4, ctx.refillBuffer);
    const numDepths = recallNumber(ctx.buffer, 4, ctx.refillBuffer);
    const fileLength = recallNumber(ctx.buffer, 4, ctx.refillBuffer);

    lines.push(
        `Parsed file:`,
        `\tVersion: ${versionStr}`,
        `\tSeed: ${seed}`,
        `\tNumber of turns: ${numTurns}`,
        `\tNumber of depth changes: ${numDepths}`,
        `\tFile length: ${fileLength}`,
    );

    let i = 0;
    while (ctx.buffer.streamPosition < Number(fileLength)) {
        const startLoc = ctx.buffer.streamPosition;
        const c = recallChar(ctx.buffer, ctx.refillBuffer);
        let description: string;

        switch (c) {
            case EventType.Keystroke: {
                const keyByte = recallChar(ctx.buffer, ctx.refillBuffer);
                description = describeKeystroke(keyByte);
                const modByte = recallChar(ctx.buffer, ctx.refillBuffer);
                description += appendModifierKeyDescription(modByte);
                break;
            }
            case EventType.MouseUp:
            case EventType.MouseDown:
            case EventType.MouseEnteredCell: {
                const x = recallChar(ctx.buffer, ctx.refillBuffer);
                const y = recallChar(ctx.buffer, ctx.refillBuffer);
                description = `Mouse click: (${x}, ${y})`;
                const modByte = recallChar(ctx.buffer, ctx.refillBuffer);
                description += appendModifierKeyDescription(modByte);
                break;
            }
            case EventType.RNGCheck:
                description = `\tRNG check: ${recallChar(ctx.buffer, ctx.refillBuffer)}`;
                break;
            case EventType.SavedGameLoaded:
                description = "Saved game loaded";
                break;
            default:
                description = `UNKNOWN EVENT TYPE: ${c}`;
                break;
        }

        const padding = i < 10 ? " " : "";
        lines.push(`Event ${i}, loc ${startLoc}, length ${ctx.buffer.streamPosition - startLoc}:${padding}\t${description}`);
        i++;
    }

    // Restore buffer state
    ctx.buffer.streamPosition = oldStreamPos;
    ctx.buffer.bufferPosition = oldBufPos;
    ctx.buffer.playbackFileLength = oldFileLen;
    ctx.buffer.fileReadPosition = oldFileReadPos;
    ctx.message("File parsed.", 0);

    return lines.join("\n");
}

