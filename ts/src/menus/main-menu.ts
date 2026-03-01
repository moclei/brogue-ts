/*
 *  main-menu.ts — Title screen, main menu navigation, dialogs, game stats
 *  brogue-ts
 *
 *  Ported from: src/brogue/MainMenu.c (1,287 lines)
 *  Functions: initializeMenuFlames, updateMenuFlames, drawMenuFlames, antiAlias,
 *             initializeMainMenuButton, initializeMainMenuButtons, stackButtons,
 *             initializeMenu, initializeMainMenu, initializeFlyoutMenu,
 *             isFlyoutActive, getNextGameButtonPos, redrawMainMenuButtons,
 *             titleMenu, quitImmediately, dialogAlert, dialogChooseFile,
 *             viewGameStats, chooseGameVariant, chooseGameMode,
 *             mainBrogueJunction
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
import { NGCommand, GameMode, GameVariant, EventType, ButtonDrawState, TextEntryType } from "../types/enums.js";
import { ButtonFlag } from "../types/flags.js";
import {
    COLS, ROWS,
    KEYBOARD_LABELS,
    INTERFACE_OPACITY,
    RETURN_KEY, ACKNOWLEDGE_KEY,
    UP_ARROW, DOWN_ARROW, PAGE_UP_KEY, PAGE_DOWN_KEY,
    NUMPAD_2, NUMPAD_8,
    GAME_SUFFIX, RECORDING_SUFFIX, LAST_GAME_NAME,
} from "../types/constants.js";

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

const MENU_TITLE_OFFSET_X = -7;
const MENU_TITLE_OFFSET_Y = -2;

const MAIN_MENU_BUTTON_COUNT = 4;
const FLYOUT_X = 59;

const FILES_ON_PAGE_MAX = Math.min(26, ROWS - 7);
const MAX_FILENAME_DISPLAY_LENGTH = 53;

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

// =============================================================================
// Flame simulation helpers
// =============================================================================

/** Create a zeroed flame grid. */
export function createFlameGrid(): FlameGrid {
    const grid: FlameGrid = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        grid[i] = new Array(ROWS + MENU_FLAME_ROW_PADDING);
        for (let j = 0; j < ROWS + MENU_FLAME_ROW_PADDING; j++) {
            grid[i][j] = [0, 0, 0];
        }
    }
    return grid;
}

/** Create a zeroed flame mask. */
export function createFlameMask(): FlameMask {
    const mask: FlameMask = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        mask[i] = new Array(ROWS).fill(0);
    }
    return mask;
}

/** Create a null-filled flame color grid. */
export function createFlameColorGrid(): FlameColorGrid {
    const grid: FlameColorGrid = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        grid[i] = new Array(ROWS + MENU_FLAME_ROW_PADDING).fill(null);
    }
    return grid;
}

/** Create color source array with random drift values. */
export function createColorSources(ctx: Pick<MenuContext, "rand_range">): ColorSource[] {
    const sources: ColorSource[] = new Array(MENU_FLAME_COLOR_SOURCE_COUNT);
    for (let i = 0; i < MENU_FLAME_COLOR_SOURCE_COUNT; i++) {
        sources[i] = [
            ctx.rand_range(0, 1000),
            ctx.rand_range(0, 1000),
            ctx.rand_range(0, 1000),
            ctx.rand_range(0, 1000),
        ];
    }
    return sources;
}

// =============================================================================
// antiAlias — MainMenu.c:161
// =============================================================================

/**
 * Takes a grid of values (0 or 100) and fills in intermediate values at
 * edges to smooth the mask.
 *
 * C: `antiAlias` in MainMenu.c
 */
export function antiAlias(mask: FlameMask): void {
    const intensity = [0, 0, 35, 50, 60];
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // cardinal directions

    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            if (mask[i][j] < 100) {
                let nbCount = 0;
                for (let dir = 0; dir < 4; dir++) {
                    const x = i + dirs[dir][0];
                    const y = j + dirs[dir][1];
                    if (x >= 0 && x < COLS && y >= 0 && y < ROWS && mask[x][y] === 100) {
                        nbCount++;
                    }
                }
                mask[i][j] = intensity[nbCount];
            }
        }
    }
}

// =============================================================================
// initializeMenuFlames — MainMenu.c:185
// =============================================================================

/**
 * Initialize the title screen flame simulation state.
 *
 * C: `initializeMenuFlames` in MainMenu.c
 */
export function initializeMenuFlames(
    includeTitle: boolean,
    ctx: MenuContext,
): { flames: FlameGrid; colorSources: ColorSource[]; colors: FlameColorGrid; colorStorage: Color[]; mask: FlameMask } {
    const mask = createFlameMask();
    const colors = createFlameColorGrid();
    const flames = createFlameGrid();

    // Seed source color random components.
    const colorSources = createColorSources(ctx);

    // Put flame source along the bottom row.
    const colorStorage: Color[] = [];
    let colorSourceCount = 0;

    for (let i = 0; i < COLS; i++) {
        const col: Color = { ...ctx.flameSourceColor };
        ctx.applyColorAverage(col, ctx.flameSourceColorSecondary, 100 - (ctx.smoothHiliteGradient(i, COLS - 1) + 25));
        colorStorage.push(col);
        colors[i][ROWS + MENU_FLAME_ROW_PADDING - 1] = colorStorage[colorSourceCount];
        colorSourceCount++;
    }

    if (includeTitle) {
        const titleW = ctx.gameConst.mainMenuTitleWidth;
        const titleH = ctx.gameConst.mainMenuTitleHeight;
        const title = ctx.mainMenuTitle;

        for (let i = 0; i < titleW; i++) {
            for (let j = 0; j < titleH; j++) {
                if (title[j * titleW + i] !== " ") {
                    const cx = Math.trunc((COLS - titleW) / 2) + i + MENU_TITLE_OFFSET_X;
                    const cy = Math.trunc((ROWS - titleH) / 2) + j + MENU_TITLE_OFFSET_Y;
                    if (cx >= 0 && cx < COLS && cy >= 0 && cy < ROWS + MENU_FLAME_ROW_PADDING) {
                        colors[cx][cy] = ctx.flameTitleColor;
                        colorSourceCount++;
                        if (cy < ROWS) {
                            mask[cx][cy] = 100;
                        }
                    }
                }
            }
        }

        // Anti-alias the mask.
        antiAlias(mask);
    }

    // brogueAssert(colorSourceCount <= MENU_FLAME_COLOR_SOURCE_COUNT)

    // Simulate the background flames for a while
    for (let i = 0; i < 100; i++) {
        updateMenuFlames(colors, colorSources, flames, ctx);
    }

    return { flames, colorSources, colors, colorStorage, mask };
}

// =============================================================================
// updateMenuFlames — MainMenu.c:84
// =============================================================================

/**
 * Update one tick of the flame simulation.
 *
 * C: `updateMenuFlames` in MainMenu.c
 */
export function updateMenuFlames(
    colors: FlameColorGrid,
    colorSources: ColorSource[],
    flames: FlameGrid,
    ctx: Pick<MenuContext, "rand_range">,
): void {
    let colorSourceNumber = 0;

    for (let j = 0; j < ROWS + MENU_FLAME_ROW_PADDING; j++) {
        // Make a temp copy of the current row.
        const tempFlames: number[][] = new Array(COLS);
        for (let i = 0; i < COLS; i++) {
            tempFlames[i] = [flames[i][j][0], flames[i][j][1], flames[i][j][2]];
        }

        for (let i = 0; i < COLS; i++) {
            // Each cell is the weighted average of itself, neighbors, and the cell below.
            // Itself (weight 100):
            for (let k = 0; k < 3; k++) {
                flames[i][j][k] = Math.trunc(100 * flames[i][j][k] / MENU_FLAME_DENOMINATOR);
            }

            // Left and right neighbors (weight SPREAD_SPEED/2 each):
            for (let l = -1; l <= 1; l += 2) {
                let x = i + l;
                if (x === -1) x = COLS - 1;
                else if (x === COLS) x = 0;
                for (let k = 0; k < 3; k++) {
                    flames[i][j][k] += Math.trunc(MENU_FLAME_SPREAD_SPEED * tempFlames[x][k] / 2 / MENU_FLAME_DENOMINATOR);
                }
            }

            // Below (weight RISE_SPEED):
            const y = j + 1;
            if (y < ROWS + MENU_FLAME_ROW_PADDING) {
                for (let k = 0; k < 3; k++) {
                    flames[i][j][k] += Math.trunc(MENU_FLAME_RISE_SPEED * flames[i][y][k] / MENU_FLAME_DENOMINATOR);
                }
            }

            // Fade a little:
            for (let k = 0; k < 3; k++) {
                flames[i][j][k] = Math.trunc((1000 - MENU_FLAME_FADE_SPEED) * flames[i][j][k] / 1000);
            }

            // If it's a color source tile:
            const colorRef = colors[i][j];
            if (colorRef) {
                // Cause the color to drift a little.
                for (let k = 0; k < 4; k++) {
                    colorSources[colorSourceNumber][k] += ctx.rand_range(-MENU_FLAME_COLOR_DRIFT_SPEED, MENU_FLAME_COLOR_DRIFT_SPEED);
                    colorSources[colorSourceNumber][k] = Math.max(0, Math.min(1000, colorSources[colorSourceNumber][k]));
                }

                // Add the color to this tile's flames.
                const rand = Math.trunc(colorRef.rand * colorSources[colorSourceNumber][0] / 1000);
                flames[i][j][0] += (colorRef.red + Math.trunc(colorRef.redRand * colorSources[colorSourceNumber][1] / 1000) + rand) * MENU_FLAME_PRECISION_FACTOR;
                flames[i][j][1] += (colorRef.green + Math.trunc(colorRef.greenRand * colorSources[colorSourceNumber][2] / 1000) + rand) * MENU_FLAME_PRECISION_FACTOR;
                flames[i][j][2] += (colorRef.blue + Math.trunc(colorRef.blueRand * colorSources[colorSourceNumber][3] / 1000) + rand) * MENU_FLAME_PRECISION_FACTOR;

                colorSourceNumber++;
            }
        }
    }
}

// =============================================================================
// drawMenuFlames — MainMenu.c:42
// =============================================================================

/**
 * Render the flame simulation into the display buffer.
 *
 * C: `drawMenuFlames` in MainMenu.c
 */
export function drawMenuFlames(
    flames: FlameGrid,
    mask: FlameMask,
    ctx: MenuContext,
    displayBuffer: ScreenDisplayBuffer,
): void {
    const versionStringLength = ctx.strLenWithoutEscapes(ctx.gameConst.versionString);

    let gameModeString = "";
    if (ctx.wizardMode) {
        gameModeString = "Wizard Mode";
    } else if (ctx.rogue.mode === GameMode.Easy) {
        gameModeString = "Easy Mode";
    }
    const gameModeStringLength = gameModeString.length;

    for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
            let dchar: number;
            if (j === ROWS - 1 && i >= COLS - versionStringLength) {
                dchar = ctx.gameConst.versionString.charCodeAt(i - (COLS - versionStringLength));
            } else if (gameModeStringLength && j === ROWS - 1 && i < gameModeStringLength) {
                dchar = gameModeString.charCodeAt(i);
            } else {
                dchar = 32; // space
            }

            if (mask[i][j] === 100) {
                ctx.plotCharWithColor(
                    dchar as DisplayGlyph,
                    { windowX: i, windowY: j },
                    ctx.veryDarkGray,
                    ctx.black,
                    displayBuffer,
                );
            } else {
                const tempColor: Color = { ...ctx.black };
                tempColor.red = Math.trunc(flames[i][j][0] / MENU_FLAME_PRECISION_FACTOR);
                tempColor.green = Math.trunc(flames[i][j][1] / MENU_FLAME_PRECISION_FACTOR);
                tempColor.blue = Math.trunc(flames[i][j][2] / MENU_FLAME_PRECISION_FACTOR);
                if (mask[i][j] > 0) {
                    ctx.applyColorAverage(tempColor, ctx.black, mask[i][j]);
                }
                ctx.plotCharWithColor(
                    dchar as DisplayGlyph,
                    { windowX: i, windowY: j },
                    ctx.veryDarkGray,
                    tempColor,
                    displayBuffer,
                );
            }
        }
    }
}

// =============================================================================
// Menu button setup — MainMenu.c:250–387
// =============================================================================

/**
 * Initialize a single main menu button (without positioning).
 *
 * C: `initializeMainMenuButton` in MainMenu.c
 */
export function initializeMainMenuButton(
    textWithHotkey: string,
    hotkey1: number,
    hotkey2: number,
    command: NGCommand,
    ctx: MenuContext,
): BrogueButton {
    const button = ctx.initializeButton();

    const textWithoutHotkey = textWithHotkey.replace(/%s/g, "");
    ctx.setButtonText(button, textWithHotkey, textWithoutHotkey);

    button.hotkey = [hotkey1, hotkey2];
    button.flags |= ButtonFlag.B_WIDE_CLICK_AREA;
    button.buttonColor = { ...ctx.titleButtonColor };
    button.command = command;

    return button;
}

/**
 * Initialize the four main menu buttons (New Game, Play, View, Quit).
 *
 * C: `initializeMainMenuButtons` in MainMenu.c
 */
export function initializeMainMenuButtons(ctx: MenuContext): BrogueButton[] {
    const buttons: BrogueButton[] = [
        initializeMainMenuButton("     %sN%sew Game     ", "n".charCodeAt(0), "N".charCodeAt(0), NGCommand.NewGame, ctx),
        initializeMainMenuButton(" *     %sP%slay       ", "p".charCodeAt(0), "P".charCodeAt(0), NGCommand.FlyoutPlay, ctx),
        initializeMainMenuButton(" *     %sV%siew       ", "v".charCodeAt(0), "V".charCodeAt(0), NGCommand.FlyoutView, ctx),
        initializeMainMenuButton("       %sQ%suit       ", "q".charCodeAt(0), "Q".charCodeAt(0), NGCommand.Quit, ctx),
    ];

    // Add a left-facing triangle to all buttons except Quit
    for (let i = 0; i < MAIN_MENU_BUTTON_COUNT - 1; i++) {
        buttons[i].symbol = [ctx.G_LEFT_TRIANGLE];
    }

    return buttons;
}

/**
 * Stack buttons vertically, either top-to-bottom or bottom-to-top.
 *
 * C: `stackButtons` in MainMenu.c
 */
export function stackButtons(
    buttons: BrogueButton[],
    buttonCount: number,
    startX: number,
    startY: number,
    spacing: number,
    topToBottom: boolean,
): void {
    let y = startY;
    if (topToBottom) {
        for (let i = 0; i < buttonCount; i++) {
            buttons[i].x = startX;
            buttons[i].y = y;
            y += spacing;
        }
    } else {
        for (let i = buttonCount - 1; i >= 0; i--) {
            buttons[i].x = startX;
            buttons[i].y = y;
            y -= spacing;
        }
    }
}

/**
 * Initialize a menu from pre-positioned buttons, computing the frame from
 * button positions and text, then creating a shadow buffer.
 *
 * C: `initializeMenu` in MainMenu.c
 */
export function initializeMenu(
    buttons: BrogueButton[],
    buttonCount: number,
    ctx: MenuContext,
): { state: ButtonState; shadowBuf: ScreenDisplayBuffer } {
    let minX = COLS;
    let minY = ROWS;
    let maxX = 0;
    let maxY = 0;

    for (let i = 0; i < buttonCount; i++) {
        minX = Math.min(minX, buttons[i].x);
        maxX = Math.max(maxX, buttons[i].x + ctx.strLenWithoutEscapes(buttons[i].text));
        minY = Math.min(minY, buttons[i].y);
        maxY = Math.max(maxY, buttons[i].y);
    }

    const width = maxX - minX;
    const height = maxY - minY;

    const state = ctx.initializeButtonState(buttons, buttonCount, minX, minY, width, height);

    const shadowBuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(shadowBuf);
    ctx.rectangularShading(minX, minY, width, height + 1, ctx.black, INTERFACE_OPACITY, shadowBuf);

    return { state, shadowBuf };
}

/**
 * Initialize the main menu (buttons + layout).
 *
 * C: `initializeMainMenu` in MainMenu.c
 */
export function initializeMainMenu(
    quitX: number,
    quitY: number,
    ctx: MenuContext,
): { state: ButtonState; buttons: BrogueButton[]; shadowBuf: ScreenDisplayBuffer } {
    const buttons = initializeMainMenuButtons(ctx);
    stackButtons(buttons, MAIN_MENU_BUTTON_COUNT, quitX, quitY, 2, false);

    const { state, shadowBuf } = initializeMenu(buttons, MAIN_MENU_BUTTON_COUNT, ctx);
    return { state, buttons, shadowBuf };
}

/**
 * Initialize a flyout sub-menu and position its buttons.
 *
 * C: `initializeFlyoutMenu` in MainMenu.c
 */
export function initializeFlyoutMenu(
    anchorX: number,
    anchorY: number,
    ctx: MenuContext,
): { state: ButtonState; buttons: BrogueButton[]; shadowBuf: ScreenDisplayBuffer } | null {
    let buttons: BrogueButton[];

    if (ctx.rogue.nextGame === NGCommand.FlyoutPlay) {
        buttons = [
            initializeMainMenuButton("  New %sS%seeded Game  ", "s".charCodeAt(0), "S".charCodeAt(0), NGCommand.NewGameWithSeed, ctx),
            initializeMainMenuButton("     %sL%soad Game     ", "l".charCodeAt(0), "L".charCodeAt(0), NGCommand.OpenGame, ctx),
            initializeMainMenuButton("  Change V%sa%sriant   ", "a".charCodeAt(0), "A".charCodeAt(0), NGCommand.GameVariant, ctx),
            initializeMainMenuButton("   Change %sM%sode     ", "m".charCodeAt(0), "M".charCodeAt(0), NGCommand.GameMode, ctx),
        ];
    } else if (ctx.rogue.nextGame === NGCommand.FlyoutView) {
        buttons = [
            initializeMainMenuButton("   View %sR%secording  ", "r".charCodeAt(0), "R".charCodeAt(0), NGCommand.ViewRecording, ctx),
            initializeMainMenuButton("    %sH%sigh Scores    ", "h".charCodeAt(0), "H".charCodeAt(0), NGCommand.HighScores, ctx),
            initializeMainMenuButton("    %sG%same Stats     ", "g".charCodeAt(0), "G".charCodeAt(0), NGCommand.GameStats, ctx),
        ];
    } else {
        return null;
    }

    stackButtons(buttons, buttons.length, anchorX, anchorY, 2, false);
    const { state, shadowBuf } = initializeMenu(buttons, buttons.length, ctx);
    return { state, buttons, shadowBuf };
}

// =============================================================================
// isFlyoutActive — MainMenu.c:471
// =============================================================================

/**
 * Returns true if rogue.nextGame is a flyout command.
 *
 * C: `isFlyoutActive` in MainMenu.c
 */
export function isFlyoutActive(nextGame: NGCommand): boolean {
    return nextGame >= NGCommand.FlyoutPlay && nextGame <= NGCommand.FlyoutOptions;
}

// =============================================================================
// getNextGameButtonPos — MainMenu.c:479
// =============================================================================

/**
 * Find the button matching rogue.nextGame and return its position.
 *
 * C: `getNextGameButtonPos` in MainMenu.c
 */
export function getNextGameButtonPos(
    buttons: BrogueButton[],
    nextGame: NGCommand,
): { x: number; y: number } | null {
    for (let i = 0; i < MAIN_MENU_BUTTON_COUNT; i++) {
        if (buttons[i].command === nextGame) {
            return { x: buttons[i].x, y: buttons[i].y };
        }
    }
    return null;
}

// =============================================================================
// redrawMainMenuButtons — MainMenu.c:491
// =============================================================================

/**
 * Draw main menu buttons, darkening all except the one associated with
 * the active flyout.
 *
 * C: `redrawMainMenuButtons` in MainMenu.c
 */
export function redrawMainMenuButtons(
    state: ButtonState,
    dbuf: ScreenDisplayBuffer,
    ctx: MenuContext,
): void {
    if (ctx.rogue.nextGame === NGCommand.Nothing) {
        ctx.drawButtonsInState(state, dbuf);
    } else {
        for (let i = 0; i < MAIN_MENU_BUTTON_COUNT; i++) {
            const drawState = state.buttons[i].command === ctx.rogue.nextGame
                ? ButtonDrawState.Normal
                : ButtonDrawState.Pressed;
            ctx.drawButton(state.buttons[i], drawState, dbuf);
        }
    }
}

// =============================================================================
// chooseGameVariant — MainMenu.c:390
// =============================================================================

/**
 * Display a dialog to choose a game variant (Brogue / Rapid / Bullet).
 *
 * C: `chooseGameVariant` in MainMenu.c
 */
export async function chooseGameVariant(ctx: MenuContext): Promise<void> {
    const goldEsc = ctx.encodeMessageColor(ctx.yellow);
    const whiteEsc = ctx.encodeMessageColor(ctx.white);

    let textBuf = `${goldEsc}Brogue${whiteEsc}\n`;
    textBuf += "Classic Brogue. The endlessly captivating masterpiece of dungeon adventuring.\n\n";

    textBuf += `${goldEsc}Rapid Brogue${whiteEsc}\n`;
    textBuf += "Die faster and more often in this quarter-length version of the classic game!\n\n";

    textBuf += `${goldEsc}Bullet Brogue${whiteEsc}\n`;
    textBuf += "No time? Death wish? Bullet Brogue is for you. Not best for new players!\n\n";

    const buttons: BrogueButton[] = [
        initializeMainMenuButton("  %sR%sapid Brogue     ", "r".charCodeAt(0), "R".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("     %sB%srogue        ", "b".charCodeAt(0), "B".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("   Bu%sl%slet Brogue   ", "l".charCodeAt(0), "L".charCodeAt(0), NGCommand.Nothing, ctx),
    ];

    const rbuf = ctx.saveDisplayBuffer();
    const choice = await ctx.printTextBox(textBuf, 20, 7, 45, ctx.white, ctx.black, buttons, 3);
    ctx.restoreDisplayBuffer(rbuf);

    if (choice === 0) {
        ctx.setGameVariant(GameVariant.RapidBrogue);
    } else if (choice === 1) {
        ctx.setGameVariant(GameVariant.Brogue);
    } else if (choice === 2) {
        ctx.setGameVariant(GameVariant.BulletBrogue);
    } else {
        ctx.rogue.nextGame = NGCommand.Nothing;
    }
}

// =============================================================================
// chooseGameMode — MainMenu.c:430
// =============================================================================

/**
 * Display a dialog to choose a game mode (Normal / Easy / Wizard).
 *
 * C: `chooseGameMode` in MainMenu.c
 */
export async function chooseGameMode(ctx: MenuContext): Promise<void> {
    const goldEsc = ctx.encodeMessageColor(ctx.yellow);
    const whiteEsc = ctx.encodeMessageColor(ctx.white);

    let textBuf = `${goldEsc}Normal Mode${whiteEsc}\n`;
    textBuf += "Punishingly difficult. Maliciously alluring. Perfectly normal.\n\n";

    textBuf += `${goldEsc}Easy Mode${whiteEsc}\n`;
    textBuf += "Succumb to temptation and transform into a powerful demon, taking 20% as much damage. ";
    textBuf += "But great power comes at a great price -- you keep only 10% of your score.\n\n";

    textBuf += `${goldEsc}Wizard Mode${whiteEsc}\n`;
    textBuf += "Play as an invincible wizard that starts with legendary items and is magically reborn after every ";
    textBuf += "death. Summon monsters and make them friend or foe. Conjure any item out of thin air. ";
    textBuf += "(Your score is not saved.)";

    const buttons: BrogueButton[] = [
        initializeMainMenuButton("      %sW%sizard       ", "w".charCodeAt(0), "W".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("       %sE%sasy        ", "e".charCodeAt(0), "E".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("      %sN%sormal       ", "n".charCodeAt(0), "N".charCodeAt(0), NGCommand.Nothing, ctx),
    ];

    const rbuf = ctx.saveDisplayBuffer();
    const choice = await ctx.printTextBox(textBuf, 10, 5, 66, ctx.white, ctx.black, buttons, 3);
    ctx.restoreDisplayBuffer(rbuf);

    if (choice === 0) {
        ctx.rogue.mode = GameMode.Wizard;
    } else if (choice === 1) {
        ctx.rogue.mode = GameMode.Easy;
    } else if (choice === 2) {
        ctx.rogue.mode = GameMode.Normal;
    }

    ctx.rogue.nextGame = NGCommand.Nothing;
}

// =============================================================================
// dialogAlert — MainMenu.c:640
// =============================================================================

/**
 * Display a simple alert dialog with an OK button.
 *
 * C: `dialogAlert` in MainMenu.c
 */
export async function dialogAlert(message: string, ctx: MenuContext): Promise<void> {
    const button = ctx.initializeButton();
    button.text = "     OK     ";
    button.hotkey = [RETURN_KEY, ACKNOWLEDGE_KEY];

    const rbuf = ctx.saveDisplayBuffer();
    await ctx.printTextBox(
        message,
        Math.trunc(COLS / 3),
        Math.trunc(ROWS / 3),
        Math.trunc(COLS / 3),
        ctx.white,
        ctx.interfaceBoxColor,
        [button],
        1,
    );
    ctx.restoreDisplayBuffer(rbuf);
}

// =============================================================================
// quitImmediately — MainMenu.c:624
// =============================================================================

/**
 * Closes the game without further prompts, saving recording/game if needed.
 *
 * C: `quitImmediately` in MainMenu.c
 */
export function quitImmediately(ctx: MenuContext): number {
    if (ctx.rogue.recording) {
        ctx.flushBufferToFile();
        if (ctx.rogue.gameInProgress && !ctx.rogue.quit && !ctx.rogue.gameHasEnded) {
            ctx.saveGameNoPrompt();
        } else {
            ctx.saveRecordingNoPrompt();
        }
    }
    return 0; // EXIT_STATUS_SUCCESS
}

// =============================================================================
// dialogChooseFile — MainMenu.c:690
// =============================================================================

/**
 * Display a paginated file chooser dialog. Returns the chosen file path,
 * or null if canceled.
 *
 * C: `dialogChooseFile` in MainMenu.c
 */
export async function dialogChooseFile(
    suffix: string,
    prompt: string,
    ctx: MenuContext,
): Promise<string | null> {
    let files = ctx.listFiles();
    const rbuf = ctx.saveDisplayBuffer();
    let maxPathLength = ctx.strLenWithoutEscapes(prompt);

    // Filter files by suffix
    files = files.filter(f => f.path.endsWith(suffix));

    // Sort by date descending
    files.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Track longest path for dialog width
    for (const f of files) {
        const pathLen = Math.min(f.path.length, MAX_FILENAME_DISPLAY_LENGTH) + 10;
        if (pathLen > maxPathLength) {
            maxPathLength = pathLen;
        }
    }

    const count = files.length;

    if (count === 0) {
        ctx.restoreDisplayBuffer(rbuf);
        await dialogAlert("No applicable files found.", ctx);
        return null;
    }

    let currentPageStart = 0;
    let retval: string | null = null;
    let again: boolean;

    do {
        again = false;

        const pageCount = Math.min(count - currentPageStart, FILES_ON_PAGE_MAX);
        const buttons: BrogueButton[] = [];

        for (let i = 0; i < pageCount; i++) {
            const btn = ctx.initializeButton();
            btn.flags &= ~(ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_GRADIENT);
            btn.buttonColor = { ...ctx.interfaceBoxColor };

            let label = "";
            if (KEYBOARD_LABELS) {
                label = String.fromCharCode("a".charCodeAt(0) + i) + ") ";
            }

            // Strip suffix from display name
            let displayPath = files[currentPageStart + i].path;
            if (displayPath.endsWith(suffix)) {
                displayPath = displayPath.slice(0, displayPath.length - suffix.length);
            }
            if (displayPath.length > MAX_FILENAME_DISPLAY_LENGTH) {
                displayPath = displayPath.slice(0, MAX_FILENAME_DISPLAY_LENGTH - 3) + "...";
            }
            label += displayPath;

            btn.text = label;
            btn.hotkey = ["a".charCodeAt(0) + i, "A".charCodeAt(0) + i];
            buttons.push(btn);
        }

        const x = Math.trunc((COLS - maxPathLength) / 2);
        const width = maxPathLength;
        const height = pageCount + 2;
        const y = Math.max(4, Math.trunc((ROWS - height) / 2));

        // Pad button text and add date
        for (let i = 0; i < pageCount; i++) {
            const pathLen = buttons[i].text.length;
            let padded = buttons[i].text;
            for (let j = pathLen; j < width - 10; j++) {
                padded += " ";
            }
            const d = files[currentPageStart + i].date;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            padded += dateStr;
            buttons[i].text = padded;
            buttons[i].x = x;
            buttons[i].y = y + 1 + i;
        }

        // Navigation arrows if needed
        if (count > FILES_ON_PAGE_MAX) {
            const upBtn = ctx.initializeButton();
            upBtn.text = "     *     ";
            upBtn.symbol = [ctx.G_UP_ARROW];
            if (currentPageStart <= 0) {
                upBtn.flags &= ~(ButtonFlag.B_ENABLED | ButtonFlag.B_DRAW);
            } else {
                upBtn.hotkey = [UP_ARROW, NUMPAD_8, PAGE_UP_KEY];
            }
            upBtn.x = x + Math.trunc((width - 11) / 2);
            upBtn.y = y;
            buttons.push(upBtn);

            const downBtn = ctx.initializeButton();
            downBtn.text = "     *     ";
            downBtn.symbol = [ctx.G_DOWN_ARROW];
            if (currentPageStart + FILES_ON_PAGE_MAX >= count) {
                downBtn.flags &= ~(ButtonFlag.B_ENABLED | ButtonFlag.B_DRAW);
            } else {
                downBtn.hotkey = [DOWN_ARROW, NUMPAD_2, PAGE_DOWN_KEY];
            }
            downBtn.x = x + Math.trunc((width - 11) / 2);
            downBtn.y = y + buttons.length; // after the last button in the list
            buttons.push(downBtn);
        }

        // Render the file list dialog
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.printString(prompt, x, y - 1, ctx.itemMessageColor, ctx.interfaceBoxColor, dbuf);
        ctx.rectangularShading(x - 1, y - 1, width + 1, height + 1, ctx.interfaceBoxColor, INTERFACE_OPACITY, dbuf);
        ctx.overlayDisplayBuffer(dbuf);

        const totalButtons = pageCount + (count > FILES_ON_PAGE_MAX ? 2 : 0);
        const result = await ctx.buttonInputLoop(buttons, totalButtons, x, y, width, height);
        ctx.restoreDisplayBuffer(rbuf);

        const i = result.chosenButton;

        if (i >= 0 && i < pageCount) {
            retval = files[currentPageStart + i].path;
        } else if (i === pageCount) {
            // Up arrow
            again = true;
            currentPageStart -= FILES_ON_PAGE_MAX;
        } else if (i === pageCount + 1) {
            // Down arrow
            again = true;
            currentPageStart += FILES_ON_PAGE_MAX;
        } else {
            retval = null;
        }
    } while (again);

    return retval;
}

// =============================================================================
// Game stats — MainMenu.c:866–1090
// =============================================================================

/**
 * Create zeroed game stats.
 */
export function createGameStats(): GameStats {
    return {
        games: 0,
        escaped: 0,
        mastered: 0,
        won: 0,
        winRate: 0,
        deepestLevel: 0,
        cumulativeLevels: 0,
        highestScore: 0,
        cumulativeScore: 0,
        mostGold: 0,
        cumulativeGold: 0,
        mostLumenstones: 0,
        cumulativeLumenstones: 0,
        fewestTurnsWin: 0,
        cumulativeTurns: 0,
        longestWinStreak: 0,
        longestMasteryStreak: 0,
        currentWinStreak: 0,
        currentMasteryStreak: 0,
    };
}

/**
 * Update stats to include a run.
 *
 * C: `addRuntoGameStats` in MainMenu.c
 */
export function addRunToGameStats(run: RogueRun, stats: GameStats): void {
    stats.games++;
    stats.cumulativeScore += run.score;
    stats.cumulativeGold += run.gold;
    stats.cumulativeLumenstones += run.lumenstones;
    stats.cumulativeLevels += run.deepestLevel;
    stats.cumulativeTurns += run.turns;

    stats.highestScore = Math.max(stats.highestScore, run.score);
    stats.mostGold = Math.max(stats.mostGold, run.gold);
    stats.mostLumenstones = Math.max(stats.mostLumenstones, run.lumenstones);
    stats.deepestLevel = Math.max(stats.deepestLevel, run.deepestLevel);

    if (run.result === "Escaped" || run.result === "Mastered") {
        if (stats.fewestTurnsWin === 0 || run.turns < stats.fewestTurnsWin) {
            stats.fewestTurnsWin = run.turns;
        }
        stats.won++;
        stats.currentWinStreak++;
        if (run.result === "Mastered") {
            stats.currentMasteryStreak++;
            stats.mastered++;
        } else {
            stats.currentMasteryStreak = 0;
            stats.escaped++;
        }
    } else {
        stats.currentWinStreak = 0;
        stats.currentMasteryStreak = 0;
    }

    stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
    stats.longestMasteryStreak = Math.max(stats.longestMasteryStreak, stats.currentMasteryStreak);

    stats.winRate = stats.games === 0 ? 0 : (stats.won / stats.games) * 100;
}

/**
 * Display the game stats screen (All Time + Recent).
 *
 * C: `viewGameStats` in MainMenu.c
 */
export async function viewGameStats(ctx: MenuContext): Promise<void> {
    const allTimeStats = createGameStats();
    const recentStats = createGameStats();

    const runHistory = ctx.loadRunHistory();

    for (const run of runHistory) {
        if (run.seed !== 0n) {
            addRunToGameStats(run, allTimeStats);
            addRunToGameStats(run, recentStats);
        } else {
            // seed === 0 means the player reset their recent stats at this point
            Object.assign(recentStats, createGameStats());
        }
    }

    const rbuf = ctx.saveDisplayBuffer();
    const displayBuffer = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(displayBuffer);

    const whiteEsc = ctx.encodeMessageColor(ctx.white);
    const yellowEsc = ctx.encodeMessageColor(ctx.itemMessageColor);

    const titleColor: Color = { ...ctx.black };
    ctx.applyColorAverage(titleColor, ctx.itemMessageColor, 100);
    ctx.printString("-- GAME STATS --", Math.trunc((COLS - 17 + 1) / 2), 0, titleColor, ctx.black, displayBuffer);

    let row = 4;
    const offset = 21;

    const pad = (s: string, width: number) => s.padStart(width);
    const padLeft = (s: string, width: number) => s.padEnd(width);

    const printRow = (label: string, allTime: string, recent: string) => {
        const line = padLeft(label, 30) + whiteEsc + pad(allTime, 16) + pad(recent, 16);
        ctx.printString(line, offset, row, ctx.itemMessageColor, ctx.black, displayBuffer);
        row++;
    };

    const printRowSingle = (label: string, value: string) => {
        const line = padLeft(label, 30) + whiteEsc + pad(value, 32);
        ctx.printString(line, offset, row, ctx.itemMessageColor, ctx.black, displayBuffer);
        row++;
    };

    // Header
    const header = padLeft("", 30) + pad("All Time", 16) + pad("Recent", 16);
    ctx.printString(header, offset, row, ctx.itemMessageColor, ctx.black, displayBuffer);
    row++;

    printRow("Games Played", String(allTimeStats.games), String(recentStats.games));
    row++; // blank line
    printRow("Won", String(allTimeStats.won), String(recentStats.won));
    printRow("Win Rate (%)", allTimeStats.winRate.toFixed(1), recentStats.winRate.toFixed(1));
    printRow("Escaped", String(allTimeStats.escaped), String(recentStats.escaped));
    printRow("Mastered", String(allTimeStats.mastered), String(recentStats.mastered));
    row++;
    printRow("High Score", String(allTimeStats.highestScore), String(recentStats.highestScore));
    printRow("Most Gold", String(allTimeStats.mostGold), String(recentStats.mostGold));
    printRow("Most Lumenstones", String(allTimeStats.mostLumenstones), String(recentStats.mostLumenstones));
    row++;
    printRow("Deepest Level", String(allTimeStats.deepestLevel), String(recentStats.deepestLevel));

    const allTimeAvgDepth = allTimeStats.games > 0
        ? (allTimeStats.cumulativeLevels / allTimeStats.games).toFixed(1) : "0.0";
    const recentAvgDepth = recentStats.games > 0
        ? (recentStats.cumulativeLevels / recentStats.games).toFixed(1) : "0.0";
    printRow("Average Depth", allTimeAvgDepth, recentAvgDepth);

    const allTimeFastest = allTimeStats.fewestTurnsWin > 0 ? String(allTimeStats.fewestTurnsWin) : "-";
    const recentFastest = recentStats.fewestTurnsWin > 0 ? String(recentStats.fewestTurnsWin) : "-";
    printRow("Shortest Win (Turns)", allTimeFastest, recentFastest);
    row++;
    printRow("Longest Win Streak", String(allTimeStats.longestWinStreak), String(recentStats.longestWinStreak));
    printRow("Longest Mastery Streak", String(allTimeStats.longestMasteryStreak), String(recentStats.longestMasteryStreak));
    row++;
    printRowSingle("Current Win Streak", String(recentStats.currentWinStreak));
    printRowSingle("Current Mastery Streak", String(recentStats.currentMasteryStreak));
    row++;

    // Set the dbuf opacity
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            displayBuffer.cells[i][j].opacity = INTERFACE_OPACITY;
        }
    }

    ctx.overlayDisplayBuffer(displayBuffer);

    const continueColor: Color = { ...ctx.black };
    ctx.applyColorAverage(continueColor, ctx.goodMessageColor, 100);

    const continueText = KEYBOARD_LABELS
        ? "Press space or click to continue."
        : "Touch anywhere to continue.";
    ctx.printString(
        continueText,
        Math.trunc((COLS - ctx.strLenWithoutEscapes(continueText)) / 2),
        ROWS - 1,
        continueColor,
        ctx.black,
        null,
    );

    ctx.commitDraws();

    if (recentStats.games > 0) {
        const resetButtons: BrogueButton[] = [ctx.initializeButton()];
        if (KEYBOARD_LABELS) {
            resetButtons[0].text = `  ${yellowEsc}R${whiteEsc}eset  `;
        } else {
            resetButtons[0].text = "  Reset  ";
        }
        resetButtons[0].hotkey = ["R".charCodeAt(0), "r".charCodeAt(0)];
        resetButtons[0].x = 74;
        resetButtons[0].y = row;

        const result = await ctx.buttonInputLoop(resetButtons, 1, 74, 25, 10, 3);
        if (result.chosenButton === 0 && await ctx.confirm("Reset recent stats?", false)) {
            ctx.saveResetRun();
        }
    } else {
        await ctx.waitForKeystrokeOrMouseClick();
    }

    ctx.restoreDisplayBuffer(rbuf);
}

// =============================================================================
// titleMenu — MainMenu.c:507
// =============================================================================

/**
 * Run the animated title screen with fire and menu buttons.
 * Sets rogue.nextGame based on user selection.
 *
 * C: `titleMenu` in MainMenu.c
 */
export async function titleMenu(ctx: MenuContext, displayBuffer: ScreenDisplayBuffer): Promise<void> {
    // Initialize the RNG so the flames aren't always the same.
    ctx.seedRandomGenerator(0n);

    // Empty nextGamePath and nextGameSeed
    ctx.rogue.nextGamePath = "";
    ctx.rogue.nextGameSeed = 0n;

    ctx.blackOutScreen(displayBuffer);

    // Initialize the main menu with buttons stacked on top of the quit button
    const quitButtonX = COLS - 20;
    const quitButtonY = ROWS - 3;
    const { state: mainMenu, buttons: mainButtons, shadowBuf: mainShadowBuf } =
        initializeMainMenu(quitButtonX, quitButtonY, ctx);

    // Initialize flames
    const { flames, colorSources, colors, mask } =
        initializeMenuFlames(true, ctx);
    ctx.rogue.creaturesWillFlashThisTurn = false; // total unconscionable hack

    let flyoutMenu: ButtonState | null = null;
    let flyoutButtons: BrogueButton[] = [];
    let flyoutShadowBuf: ScreenDisplayBuffer | null = null;

    // Outer loop for menu navigation
    do {
        if (isFlyoutActive(ctx.rogue.nextGame)) {
            const bPos = getNextGameButtonPos(mainButtons, ctx.rogue.nextGame);
            if (bPos) {
                const flyout = initializeFlyoutMenu(FLYOUT_X, bPos.y, ctx);
                if (flyout) {
                    flyoutMenu = flyout.state;
                    flyoutButtons = flyout.buttons;
                    flyoutShadowBuf = flyout.shadowBuf;
                }
            }
        }

        let theEvent: RogueEvent = {
            eventType: EventType.EventError,
            param1: 0,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        // Inner input loop
        do {
            if (ctx.isApplicationActive()) {
                // Update the display
                updateMenuFlames(colors, colorSources, flames, ctx);
                drawMenuFlames(flames, mask, ctx, displayBuffer);
                ctx.overlayDisplayBuffer(mainShadowBuf);

                // Draw the main menu buttons
                const dbuf = ctx.createScreenDisplayBuffer();
                ctx.clearDisplayBuffer(dbuf);
                redrawMainMenuButtons(mainMenu, dbuf, ctx);
                ctx.overlayDisplayBuffer(dbuf);

                // Show flyout if selected
                if (isFlyoutActive(ctx.rogue.nextGame) && flyoutMenu && flyoutShadowBuf) {
                    ctx.overlayDisplayBuffer(flyoutShadowBuf);
                    const flyoutDbuf = ctx.createScreenDisplayBuffer();
                    ctx.clearDisplayBuffer(flyoutDbuf);
                    ctx.drawButtonsInState(flyoutMenu, flyoutDbuf);
                    ctx.overlayDisplayBuffer(flyoutDbuf);
                    mainMenu.buttonDepressed = -1;
                    mainMenu.buttonFocused = -1;
                }

                // Pause briefly
                if (await ctx.pauseBrogue(MENU_FLAME_UPDATE_DELAY, { interruptForMouseMove: true })) {
                    // There was input during the pause! Get the input.
                    theEvent = await ctx.nextBrogueEvent(true, false, true);

                    // Quickstart a new game
                    if (theEvent.eventType === EventType.Keystroke &&
                        (theEvent.param1 === "n".charCodeAt(0) || theEvent.param1 === "N".charCodeAt(0))) {
                        ctx.rogue.nextGame = NGCommand.NewGame;
                        break;
                    }

                    // Process the flyout menu input as needed
                    let flyoutIndex = -1;
                    if (isFlyoutActive(ctx.rogue.nextGame) && flyoutMenu) {
                        const flyoutResult = await ctx.processButtonInput(flyoutMenu, theEvent);
                        flyoutIndex = flyoutResult.chosenButton;
                        if (flyoutIndex !== -1 && (theEvent.eventType === EventType.MouseUp || theEvent.eventType === EventType.Keystroke)) {
                            ctx.rogue.nextGame = flyoutButtons[flyoutIndex].command;
                        }
                        if (ctx.rogue.nextGame === NGCommand.GameMode) {
                            await chooseGameMode(ctx);
                        } else if (ctx.rogue.nextGame === NGCommand.GameVariant) {
                            await chooseGameVariant(ctx);
                        }
                    }

                    // Process the main menu input
                    const mainResult = await ctx.processButtonInput(mainMenu, theEvent);
                    const mainIndex = mainResult.chosenButton;

                    if (theEvent.eventType === EventType.MouseUp || theEvent.eventType === EventType.Keystroke) {
                        if (mainIndex !== -1 && ctx.rogue.nextGame !== mainButtons[mainIndex].command) {
                            ctx.rogue.nextGame = mainButtons[mainIndex].command;
                        } else if (flyoutIndex === -1) {
                            // Hide the flyout if clicking somewhere random or re-selecting the same button
                            ctx.rogue.nextGame = NGCommand.Nothing;
                        }
                    }
                }
            } else {
                await ctx.pauseBrogue(64);
            }
        } while (
            theEvent.eventType !== EventType.MouseUp &&
            theEvent.eventType !== EventType.Keystroke &&
            (isFlyoutActive(ctx.rogue.nextGame) || ctx.rogue.nextGame === NGCommand.Nothing)
        );
    } while (isFlyoutActive(ctx.rogue.nextGame) || ctx.rogue.nextGame === NGCommand.Nothing);

    drawMenuFlames(flames, mask, ctx, displayBuffer);
}

// =============================================================================
// mainBrogueJunction — MainMenu.c:1101
// =============================================================================

/**
 * The top-level menu dispatcher. Runs after launch or after a game ends.
 *
 * C: `mainBrogueJunction` in MainMenu.c
 */
export async function mainBrogueJunction(ctx: MenuContext, displayBuffer: ScreenDisplayBuffer): Promise<void> {
    // Clear screen and display buffer
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const cell = displayBuffer.cells[i][j];
            cell.character = 0 as DisplayGlyph;
            cell.opacity = 100;
            cell.foreColorComponents[0] = 0;
            cell.foreColorComponents[1] = 0;
            cell.foreColorComponents[2] = 0;
            cell.backColorComponents[0] = 0;
            cell.backColorComponents[1] = 0;
            cell.backColorComponents[2] = 0;
            ctx.plotCharWithColor(32 as DisplayGlyph, { windowX: i, windowY: j }, ctx.black, ctx.black, displayBuffer);
        }
    }

    ctx.initializeGameVariant();
    ctx.initializeLaunchArguments();

    do {
        ctx.rogue.gameHasEnded = false;
        ctx.rogue.playbackFastForward = false;
        ctx.rogue.playbackMode = false;

        switch (ctx.rogue.nextGame) {
            case NGCommand.Nothing:
                await titleMenu(ctx, displayBuffer);
                break;

            case NGCommand.GameVariant:
                ctx.rogue.nextGame = NGCommand.Nothing;
                ctx.initializeGameVariant();
                break;

            case NGCommand.NewGame:
            case NGCommand.NewGameWithSeed: {
                ctx.rogue.nextGamePath = "";
                ctx.setRandomNumbersGenerated(0);

                ctx.rogue.playbackMode = false;
                ctx.rogue.playbackFastForward = false;
                ctx.rogue.playbackBetweenTurns = false;

                const path = ctx.getAvailableFilePath(LAST_GAME_NAME, GAME_SUFFIX);
                ctx.setCurrentFilePath(path + GAME_SUFFIX);

                if (ctx.rogue.nextGame === NGCommand.NewGameWithSeed) {
                    if (ctx.rogue.nextGameSeed === 0n) {
                        // Prompt for seed; default is the previous game's seed.
                        const seedDefault = ctx.previousGameSeed === 0n
                            ? ""
                            : ctx.previousGameSeed.toString();

                        const buf = await ctx.getInputTextString(
                            "Generate dungeon with seed number:",
                            20, // length of "18446744073709551615" (2^64 - 1)
                            seedDefault,
                            "",
                            TextEntryType.Numbers,
                            true,
                        );

                        if (buf !== null && buf !== "") {
                            try {
                                let seed = BigInt(buf);
                                if (seed > 18446744073709551615n) {
                                    seed = 18446744073709551615n;
                                }
                                ctx.rogue.nextGameSeed = seed;
                            } catch {
                                ctx.rogue.nextGameSeed = 18446744073709551615n;
                            }
                        } else {
                            ctx.rogue.nextGame = NGCommand.Nothing;
                            break;
                        }
                    }
                } else {
                    ctx.rogue.nextGameSeed = 0n; // Seed based on clock.
                }

                ctx.rogue.nextGame = NGCommand.Nothing;
                ctx.initializeRogue(ctx.rogue.nextGameSeed);
                ctx.startLevel(ctx.rogue.depthLevel, 1);
                await ctx.mainInputLoop();

                if (ctx.serverMode) {
                    ctx.rogue.nextGame = NGCommand.Quit;
                }
                ctx.freeEverything();
                break;
            }

            case NGCommand.OpenGame: {
                ctx.rogue.nextGame = NGCommand.Nothing;
                let gamePath = "";
                if (ctx.rogue.nextGamePath) {
                    gamePath = ctx.rogue.nextGamePath;
                    ctx.rogue.currentGamePath = ctx.rogue.nextGamePath;
                    ctx.rogue.nextGamePath = "";
                } else {
                    const chosen = await dialogChooseFile(GAME_SUFFIX, "Open saved game:", ctx);
                    if (chosen) gamePath = chosen;
                }

                if (gamePath && ctx.openFile(gamePath)) {
                    // loadSavedGame -> mainInputLoop is Step 4/6
                    // Stub: the actual implementation will call loadSavedGame()
                    await ctx.mainInputLoop();
                    ctx.freeEverything();
                }
                ctx.rogue.playbackMode = false;
                ctx.rogue.playbackOOS = false;

                if (ctx.serverMode) {
                    ctx.rogue.nextGame = NGCommand.Quit;
                }
                break;
            }

            case NGCommand.ViewRecording: {
                ctx.rogue.nextGame = NGCommand.Nothing;
                let recPath = "";
                if (ctx.rogue.nextGamePath) {
                    recPath = ctx.rogue.nextGamePath;
                    ctx.rogue.currentGamePath = ctx.rogue.nextGamePath;
                    ctx.rogue.nextGamePath = "";
                } else {
                    const chosen = await dialogChooseFile(RECORDING_SUFFIX, "View recording:", ctx);
                    if (chosen) recPath = chosen;
                }

                if (recPath && ctx.openFile(recPath)) {
                    ctx.setRandomNumbersGenerated(0);
                    ctx.rogue.playbackMode = true;
                    ctx.initializeRogue(0n); // Seed ignored in playback
                    if (!ctx.rogue.gameHasEnded) {
                        ctx.startLevel(ctx.rogue.depthLevel, 1);
                        if (ctx.nonInteractivePlayback) {
                            ctx.rogue.playbackPaused = false;
                        } else {
                            ctx.rogue.playbackPaused = true;
                        }
                        ctx.displayAnnotation();
                    }

                    while (!ctx.rogue.gameHasEnded && ctx.rogue.playbackMode) {
                        if (ctx.rogue.playbackPaused) {
                            ctx.rogue.playbackPaused = false;
                            ctx.pausePlayback();
                        }
                        if (ctx.rogue.gameHasEnded) break;

                        ctx.rogue.playbackBetweenTurns = true;
                        const theEvent = await ctx.nextBrogueEvent(false, true, false);

                        ctx.executeEvent(theEvent);
                    }

                    ctx.freeEverything();
                }
                ctx.rogue.playbackMode = false;
                ctx.rogue.playbackOOS = false;

                if (ctx.serverMode || ctx.nonInteractivePlayback) {
                    ctx.rogue.nextGame = NGCommand.Quit;
                }
                break;
            }

            case NGCommand.HighScores:
                ctx.rogue.nextGame = NGCommand.Nothing;
                await ctx.printHighScores(false);
                break;

            case NGCommand.GameStats:
                ctx.rogue.nextGame = NGCommand.Nothing;
                await viewGameStats(ctx);
                break;

            case NGCommand.Quit:
                // No need to do anything.
                break;

            default:
                break;
        }
    } while (ctx.rogue.nextGame !== NGCommand.Quit);
}
