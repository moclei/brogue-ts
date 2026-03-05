/*
 *  menus/menu-types.ts — Shared types and DI context for the menu system
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/main-menu.ts (lines 1–353)
 *  Source C: src/brogue/MainMenu.c
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    BrogueButton,
    ButtonState,
    ScreenDisplayBuffer,
    SavedDisplayBuffer,
    RogueEvent,
    GameConstants,
    WindowPos,
    PauseBehavior,
} from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { NGCommand, GameMode, GameVariant, ButtonDrawState, TextEntryType } from "../types/enums.js";

// =============================================================================
// Flame simulation constants — MainMenu.c:30–38
// =============================================================================

export const MENU_FLAME_PRECISION_FACTOR = 10;
export const MENU_FLAME_RISE_SPEED = 50;
export const MENU_FLAME_SPREAD_SPEED = 20;
export const MENU_FLAME_COLOR_DRIFT_SPEED = 500;
export const MENU_FLAME_FADE_SPEED = 20;
export const MENU_FLAME_UPDATE_DELAY = 50;
export const MENU_FLAME_ROW_PADDING = 2;
export const MENU_FLAME_COLOR_SOURCE_COUNT = 1136;
export const MENU_FLAME_DENOMINATOR = 100 + MENU_FLAME_RISE_SPEED + MENU_FLAME_SPREAD_SPEED;

// Re-export enums used by other menu modules
export { NGCommand, GameMode, GameVariant, ButtonDrawState, TextEntryType };

// =============================================================================
// Flame state types
// =============================================================================

/** Flame grid: flames[col][row][rgbChannel]. */
export type FlameGrid = number[][][];

/** Color source: [red, green, blue, rand] randomized drift values (0–1000). */
export type ColorSource = [number, number, number, number];

/** Color pointer grid: colors[col][row] = Color | null. */
export type FlameColorGrid = (Readonly<Color> | null)[][];

/** Title mask: mask[col][row] = 0 or 100 (or anti-aliased intermediate). */
export type FlameMask = number[][];

// =============================================================================
// File entry / run history types (platform-dependent)
// =============================================================================

export interface FileEntry {
    path: string;
    date: Date;
}

export interface RogueRun {
    seed: bigint;
    dateNumber: number;
    result: string;
    killedBy: string;
    gold: number;
    lumenstones: number;
    score: number;
    turns: number;
    deepestLevel: number;
}

export interface GameStats {
    games: number;
    escaped: number;
    mastered: number;
    won: number;
    winRate: number;
    deepestLevel: number;
    cumulativeLevels: number;
    highestScore: number;
    cumulativeScore: number;
    mostGold: number;
    cumulativeGold: number;
    mostLumenstones: number;
    cumulativeLumenstones: number;
    fewestTurnsWin: number; // 0 means never won
    cumulativeTurns: number;
    longestWinStreak: number;
    longestMasteryStreak: number;
    currentWinStreak: number;
    currentMasteryStreak: number;
}

// =============================================================================
// DI Context
// =============================================================================

/**
 * Minimal rogue state required by the menu module.
 */
export interface MenuRogueState {
    mode: GameMode;
    nextGame: NGCommand;
    nextGamePath: string;
    nextGameSeed: bigint;
    currentGamePath: string;
    gameHasEnded: boolean;
    gameInProgress: boolean;
    quit: boolean;
    playbackMode: boolean;
    playbackFastForward: boolean;
    playbackPaused: boolean;
    playbackBetweenTurns: boolean;
    playbackOOS: boolean;
    recording: boolean;
    depthLevel: number;
    creaturesWillFlashThisTurn: boolean;
    seed: bigint;
    patchVersion: number;
}

/**
 * Dependency-injection context for the menu module.
 */
export interface MenuContext {
    rogue: MenuRogueState;
    gameConst: GameConstants;
    gameVariant: GameVariant;

    /** The ASCII art title string (variant-specific). */
    mainMenuTitle: string;

    /** Whether the application window is focused / active. */
    isApplicationActive(): boolean;

    /** Whether we're in server mode (auto-quit after game). */
    serverMode: boolean;

    /** Whether non-interactive playback is active. */
    nonInteractivePlayback: boolean;

    /** WIZARD_MODE flag. */
    wizardMode: boolean;

    /** Seed used by the previous game (for "New Seeded Game" default). */
    previousGameSeed: bigint;

    /** Counter for random numbers generated (reset on new game). */
    randomNumbersGenerated: number;
    setRandomNumbersGenerated(n: number): void;

    /** Current file path for save/recording. */
    currentFilePath: string;
    setCurrentFilePath(path: string): void;

    /** Set the game variant and reinitialize variant-specific data. */
    setGameVariant(variant: GameVariant): void;

    // -- RNG ------------------------------------------------------------------

    seedRandomGenerator(seed: bigint): bigint;
    rand_range(lo: number, hi: number): number;

    // -- Color manipulation ---------------------------------------------------

    applyColorAverage(base: Color, target: Readonly<Color>, weight: number): void;

    // -- Text -----------------------------------------------------------------

    strLenWithoutEscapes(s: string): number;
    encodeMessageColor(theColor: Readonly<Color>): string;

    // -- Rendering ------------------------------------------------------------

    plotCharWithColor(
        inputChar: DisplayGlyph,
        loc: WindowPos,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        displayBuffer: ScreenDisplayBuffer,
    ): boolean;

    locIsInWindow(pos: WindowPos): boolean;

    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    blackOutScreen(displayBuffer: ScreenDisplayBuffer): void;
    commitDraws(): void;

    printString(
        text: string,
        x: number,
        y: number,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer | null,
    ): void;

    // -- Buttons --------------------------------------------------------------

    initializeButton(): BrogueButton;
    setButtonText(button: BrogueButton, textWithHotkey: string, textWithoutHotkey: string): void;

    initializeButtonState(
        buttons: BrogueButton[],
        buttonCount: number,
        winX: number,
        winY: number,
        winWidth: number,
        winHeight: number,
    ): ButtonState;

    drawButton(button: BrogueButton, highlight: ButtonDrawState, dbuf: ScreenDisplayBuffer | null): void;
    drawButtonsInState(state: ButtonState, dbuf: ScreenDisplayBuffer): void;
    processButtonInput(state: ButtonState, event: RogueEvent): Promise<{ chosenButton: number; canceled: boolean }>;
    buttonInputLoop(
        buttons: BrogueButton[],
        buttonCount: number,
        winX: number,
        winY: number,
        winWidth: number,
        winHeight: number,
    ): Promise<{ chosenButton: number; event: RogueEvent }>;

    rectangularShading(
        x: number,
        y: number,
        width: number,
        height: number,
        backColor: Readonly<Color>,
        opacity: number,
        dbuf: ScreenDisplayBuffer,
    ): void;

    printTextBox(
        textBuf: string,
        x: number,
        y: number,
        width: number,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        buttons?: BrogueButton[],
        buttonCount?: number,
    ): Promise<number>;

    // -- Events / timing ------------------------------------------------------

    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInputEvenInPlayback: boolean): Promise<RogueEvent>;
    pauseBrogue(milliseconds: number, behavior?: PauseBehavior): Promise<boolean>;

    // -- Info screens / prompts -----------------------------------------------

    getInputTextString(
        prompt: string,
        maxLength: number,
        defaultEntry: string,
        promptSuffix: string,
        textEntryType: TextEntryType,
        useDialogBox: boolean,
    ): Promise<string | null>;
    printHighScores(hiliteMostRecent: boolean): Promise<void>;
    confirm(prompt: string, alsoDuringPlayback: boolean): Promise<boolean>;
    waitForKeystrokeOrMouseClick(): Promise<void>;
    message(msg: string, flags: number): void;

    // -- Sidebar helper re-exported from io-sidebar ---------------------------

    smoothHiliteGradient(currentXValue: number, maxXValue: number): number;

    // -- Game lifecycle (Step 4 stubs) ----------------------------------------

    initializeRogue(seed: bigint): void;
    startLevel(depth: number, stairDirection: number): void;
    mainInputLoop(): Promise<void>;
    freeEverything(): void;
    initializeGameVariant(): void;
    initializeLaunchArguments(): void;

    // -- Recording stubs ------------------------------------------------------

    flushBufferToFile(): void;
    saveGameNoPrompt(): void;
    saveRecordingNoPrompt(): string;
    getAvailableFilePath(prefix: string, suffix: string): string;

    // -- Playback (Step 6 stubs) ----------------------------------------------

    executeEvent(event: RogueEvent): void;
    displayAnnotation(): void;
    pausePlayback(): void;

    // -- Platform file ops (Step 5) -------------------------------------------

    listFiles(): FileEntry[];
    loadRunHistory(): RogueRun[];
    saveResetRun(): void;
    openFile(path: string): boolean;

    // -- Color constants ------------------------------------------------------

    readonly black: Readonly<Color>;
    readonly white: Readonly<Color>;
    readonly yellow: Readonly<Color>;
    readonly veryDarkGray: Readonly<Color>;
    readonly flameSourceColor: Readonly<Color>;
    readonly flameSourceColorSecondary: Readonly<Color>;
    readonly flameTitleColor: Readonly<Color>;
    readonly titleButtonColor: Readonly<Color>;
    readonly itemMessageColor: Readonly<Color>;
    readonly interfaceBoxColor: Readonly<Color>;
    readonly goodMessageColor: Readonly<Color>;

    // -- Glyph constants ------------------------------------------------------

    readonly G_LEFT_TRIANGLE: DisplayGlyph;
    readonly G_UP_ARROW: DisplayGlyph;
    readonly G_DOWN_ARROW: DisplayGlyph;
}
