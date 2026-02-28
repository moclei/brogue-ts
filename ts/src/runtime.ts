/*
 *  runtime.ts — Game runtime DI container
 *  brogue-ts
 *
 *  Creates a unified runtime that wires the BrogueConsole platform layer
 *  into all DI contexts, connecting:
 *    mainBrogueJunction → initializeRogue → startLevel → mainInputLoop
 *
 *  The runtime holds shared mutable state and provides context implementations
 *  for every module. Each ported function receives its DI context from here.
 *
 *  NOTE: Many lifecycle methods delegate to TODO stubs for systems that
 *  depend on unported deep game logic (dungeon generation, monster AI, etc.).
 *  Full implementation is Phase 4 (Integration). This file establishes the
 *  architecture and demonstrates how all the pieces connect.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueConsole } from "./types/platform.js";
import type {
    Color,
    GameConstants,
    ScreenDisplayBuffer,
    SavedDisplayBuffer,
    BrogueButton,
    ButtonState,
    RogueEvent,
    WindowPos,
    PauseBehavior,
} from "./types/types.js";
import {
    NGCommand,
    GameMode,
    GameVariant,
    ButtonDrawState,
    TextEntryType,
    DisplayGlyph,
} from "./types/enums.js";
import { COLS, ROWS } from "./types/constants.js";

// -- IO module imports --------------------------------------------------------
import {
    applyColorAverage,
    bakeColor,
    separateColors,
    encodeMessageColor,
    decodeMessageColor,
    storeColorComponents,
} from "./io/io-color.js";
import {
    createScreenDisplayBuffer,
    clearDisplayBuffer,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    overlayDisplayBuffer as overlayDisplayBufferFn,
    plotCharToBuffer,
    locIsInWindow,
    mapToWindowX,
    mapToWindowY,
} from "./io/io-display.js";
import {
    plotCharWithColor,
    blackOutScreen,
} from "./io/io-appearance.js";
import {
    strLenWithoutEscapes,
    printString as printStringFn,
    wrapText,
    printStringWithWrapping,
} from "./io/io-text.js";
import {
    smoothHiliteGradient,
} from "./io/io-sidebar.js";
import type { ButtonContext } from "./io/io-buttons.js";
import {
    initializeButton,
    setButtonText as setButtonTextFn,
    drawButton as drawButtonFn,
    drawButtonsInState as drawButtonsInStateFn,
    initializeButtonState,
    processButtonInput as processButtonInputFn,
    buttonInputLoop as buttonInputLoopFn,
} from "./io/io-buttons.js";
import {
    rectangularShading as rectangularShadingFn,
    printTextBox as printTextBoxFn,
} from "./io/io-inventory.js";
import type { InventoryContext } from "./io/io-inventory.js";

// -- Color imports ------------------------------------------------------------
import * as Colors from "./globals/colors.js";

// -- RNG imports --------------------------------------------------------------
import { seedRandomGenerator, randRange } from "./math/rng.js";

// -- Menu imports (for type reference) ----------------------------------------
import type { MenuContext, MenuRogueState, FileEntry, RogueRun } from "./menus/main-menu.js";

// =============================================================================
// Brogue game constants (default variant: Brogue CE)
// =============================================================================

/** Default GameConstants for the classic Brogue CE variant. */
export const BROGUE_GAME_CONSTANTS: GameConstants = {
    majorVersion: 1,
    minorVersion: 15,
    patchVersion: 1,
    variantName: "brogue",
    versionString: "CE 1.15.1",
    dungeonVersionString: "CE 1.15",
    patchVersionPattern: "CE 1.15.%hu",
    recordingVersionString: "CE 1.15.1",
    deepestLevel: 40,
    amuletLevel: 26,
    depthAccelerator: 1,
    minimumAltarLevel: 13,
    minimumLavaLevel: 4,
    minimumBrimstoneLevel: 17,
    mutationsOccurAboveLevel: 10,
    monsterOutOfDepthChance: 10,
    machinesPerLevelSuppressionMultiplier: 4,
    machinesPerLevelSuppressionOffset: 2,
    machinesPerLevelIncreaseFactor: 1,
    maxLevelForBonusMachines: 2,
    deepestLevelForMachines: 26,
    extraItemsPerLevel: 0,
    goldAdjustmentStartDepth: 6,
    playerTransferenceRatio: 20,
    onHitHallucinateDuration: 20,
    onHitWeakenDuration: 300,
    onHitMercyHealPercent: 50,
    weaponKillsToAutoID: 20,
    armorDelayToAutoID: 1000,
    ringDelayToAutoID: 1500,
    fallDamageMin: 8,
    fallDamageMax: 10,
    numberAutogenerators: 0,     // Will be set by variant init
    numberBoltKinds: 0,
    numberBlueprints: 0,
    numberHordes: 0,
    numberMeteredItems: 0,
    numberCharmKinds: 0,
    numberPotionKinds: 0,
    numberGoodPotionKinds: 8,
    numberScrollKinds: 0,
    numberGoodScrollKinds: 12,
    numberWandKinds: 0,
    numberGoodWandKinds: 6,
    numberFeats: 0,
    companionFeatRequiredXP: 10400,
    mainMenuTitleHeight: 19,
    mainMenuTitleWidth: 33,
};

// =============================================================================
// Default menu title (ASCII art)
// =============================================================================

// The title is stored as a flat string; each character maps to a cell in
// a mainMenuTitleWidth × mainMenuTitleHeight grid. Non-space chars are
// rendered as flame-lit glyphs on the title screen.
// This is a simplified placeholder — the real title art is in GlobalsBrogue.c.
const BROGUE_TITLE_ART =
    "                                 " +
    "                                 " +
    "                                 " +
    "                                 " +
    "                                 " +
    "          ########               " +
    "          ##    ##               " +
    "          ##    ##  #####        " +
    "          ########  ##  ##       " +
    "          ##    ##  #####        " +
    "          ##    ##  ##  ##       " +
    "          ########  ##   ##      " +
    "                                 " +
    "            BROGUE               " +
    "       Community Edition         " +
    "                                 " +
    "                                 " +
    "                                 " +
    "                                 ";

// =============================================================================
// Runtime state
// =============================================================================

/**
 * Shared rogue state — superset of all module rogue state interfaces.
 * This single object is shared by every DI context.
 */
function createRogueState(): MenuRogueState {
    return {
        mode: GameMode.Normal,
        nextGame: NGCommand.Nothing,
        nextGamePath: "",
        nextGameSeed: 0n,
        currentGamePath: "",
        gameHasEnded: false,
        gameInProgress: false,
        quit: false,
        playbackMode: false,
        playbackFastForward: false,
        playbackPaused: false,
        playbackBetweenTurns: false,
        playbackOOS: false,
        recording: false,
        depthLevel: 1,
        creaturesWillFlashThisTurn: false,
        seed: 0n,
        patchVersion: 1,
    };
}

// =============================================================================
// commitDraws — bridge display buffer → BrogueConsole
// =============================================================================

/**
 * Walk every cell in the display buffer and render changed cells to the
 * BrogueConsole via plotChar. Color values are in 0–100 range (Brogue
 * convention) and are scaled to 0–255 for the console.
 */
function makeCommitDraws(
    displayBuffer: ScreenDisplayBuffer,
    prevBuffer: ScreenDisplayBuffer,
    console: BrogueConsole,
): () => void {
    return function commitDraws(): void {
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                const cell = displayBuffer.cells[x][y];
                const prev = prevBuffer.cells[x][y];

                if (
                    cell.character !== prev.character ||
                    cell.foreColorComponents[0] !== prev.foreColorComponents[0] ||
                    cell.foreColorComponents[1] !== prev.foreColorComponents[1] ||
                    cell.foreColorComponents[2] !== prev.foreColorComponents[2] ||
                    cell.backColorComponents[0] !== prev.backColorComponents[0] ||
                    cell.backColorComponents[1] !== prev.backColorComponents[1] ||
                    cell.backColorComponents[2] !== prev.backColorComponents[2]
                ) {
                    // Scale from 0–100 to 0–255
                    const fr = Math.round(cell.foreColorComponents[0] * 2.55);
                    const fg = Math.round(cell.foreColorComponents[1] * 2.55);
                    const fb = Math.round(cell.foreColorComponents[2] * 2.55);
                    const br = Math.round(cell.backColorComponents[0] * 2.55);
                    const bg = Math.round(cell.backColorComponents[1] * 2.55);
                    const bb = Math.round(cell.backColorComponents[2] * 2.55);

                    console.plotChar(cell.character, x, y, fr, fg, fb, br, bg, bb);

                    // Sync prev buffer
                    prev.character = cell.character;
                    prev.foreColorComponents[0] = cell.foreColorComponents[0];
                    prev.foreColorComponents[1] = cell.foreColorComponents[1];
                    prev.foreColorComponents[2] = cell.foreColorComponents[2];
                    prev.backColorComponents[0] = cell.backColorComponents[0];
                    prev.backColorComponents[1] = cell.backColorComponents[1];
                    prev.backColorComponents[2] = cell.backColorComponents[2];
                }
            }
        }
    };
}

// =============================================================================
// createRuntime — master factory
// =============================================================================

/**
 * Public result from `createRuntime`.
 */
export interface GameRuntime {
    /** The fully-wired MenuContext for mainBrogueJunction. */
    menuCtx: MenuContext;
    /** The main display buffer (shared by all contexts). */
    displayBuffer: ScreenDisplayBuffer;
    /** Flush the display buffer to the console. */
    commitDraws(): void;
}

/**
 * Create a game runtime from a platform console.
 *
 * This wires the BrogueConsole into all DI contexts and connects the
 * game lifecycle: mainBrogueJunction → initializeRogue → startLevel →
 * mainInputLoop.
 */
export function createRuntime(browserConsole: BrogueConsole): GameRuntime {
    // -- Shared state ---------------------------------------------------------
    const rogue = createRogueState();
    const displayBuffer = createScreenDisplayBuffer();
    const prevBuffer = createScreenDisplayBuffer();

    let previousGameSeed = 0n;
    let currentFilePath = "";
    let gameVariant = GameVariant.Brogue;
    let gameConst: GameConstants = { ...BROGUE_GAME_CONSTANTS };

    const commitDraws = makeCommitDraws(displayBuffer, prevBuffer, browserConsole);

    // -- ButtonContext (needed by several menu functions) ----------------------
    const buttonCtx: ButtonContext = {
        rogue,
        applyColorAverage,
        bakeColor,
        separateColors,
        strLenWithoutEscapes,
        decodeMessageColor,
        encodeMessageColor,
        plotCharToBuffer,
        locIsInWindow,
        createScreenDisplayBuffer,
        clearDisplayBuffer(dbuf) { clearDisplayBuffer(dbuf); },
        overlayDisplayBuffer(dbuf) {
            overlayDisplayBufferFn(displayBuffer, dbuf);
            commitDraws();
        },
        saveDisplayBuffer() {
            return saveDisplayBufferFn(displayBuffer);
        },
        restoreDisplayBuffer(saved) {
            restoreDisplayBufferFn(displayBuffer, saved);
            commitDraws();
        },
        nextBrogueEvent(textInput, colorsDance, _realInputEvenInPlayback) {
            commitDraws();
            return browserConsole.nextKeyOrMouseEvent(textInput, colorsDance);
        },
        pauseBrogue(ms) {
            return browserConsole.pauseForMilliseconds(ms, { interruptForMouseMove: false });
        },
        pauseAnimation(ms) {
            return browserConsole.pauseForMilliseconds(ms, { interruptForMouseMove: false });
        },
    };

    // -- Partial InventoryContext for rectangularShading / printTextBox --------
    const inventoryCtxPartial: Pick<InventoryContext, "storeColorComponents"> = {
        storeColorComponents,
    };

    // We build a fuller InventoryContext for printTextBox. This is a minimal
    // subset — the runtime only calls printTextBox from the menu, so we only
    // need the methods it actually uses.
    const inventoryCtxForTextBox = {
        rogue: { weapon: null, armor: null, ringLeft: null, ringRight: null },
        packItems: [],
        applyColorAverage,
        encodeMessageColor,
        storeColorComponents,
        createScreenDisplayBuffer,
        clearDisplayBuffer(dbuf: ScreenDisplayBuffer) { clearDisplayBuffer(dbuf); },
        overlayDisplayBuffer(dbuf: ScreenDisplayBuffer) {
            overlayDisplayBufferFn(displayBuffer, dbuf);
            commitDraws();
        },
        saveDisplayBuffer() { return saveDisplayBufferFn(displayBuffer); },
        restoreDisplayBuffer(saved: SavedDisplayBuffer) {
            restoreDisplayBufferFn(displayBuffer, saved);
            commitDraws();
        },
        drawButton(button: BrogueButton, highlight: ButtonDrawState, dbuf: ScreenDisplayBuffer | null) {
            drawButtonFn(button, highlight, dbuf, buttonCtx);
        },
        plotCharToBuffer,
        printStringWithWrapping(
            theString: string, x: number, y: number, width: number,
            foreColor: Readonly<Color>, backColor: Readonly<Color>,
            dbuf: ScreenDisplayBuffer,
        ): number {
            return printStringWithWrapping(theString, x, y, width, foreColor, backColor, dbuf);
        },
        strLenWithoutEscapes,
        wrapText,
        buttonInputLoop(
            buttons: BrogueButton[], count: number,
            winX: number, winY: number, winWidth: number, winHeight: number,
        ) {
            return buttonInputLoopFn(buttons, count, winX, winY, winWidth, winHeight, buttonCtx);
        },
        printCarriedItemDetails: () => 0,       // stub
        itemName: () => "item",                  // stub
        upperCase: (s: string) => s.toUpperCase(),
        itemMagicPolarity: () => 0,              // stub
        numberOfItemsInPack: () => 0,            // stub
        clearCursorPath: () => {},               // stub
        confirmMessages: () => {},               // stub
        message: (_msg: string, _flags: number) => {},  // stub
        mapToWindowX,
        mapToWindowY,
        white: Colors.white,
        gray: Colors.gray,
        black: Colors.black,
        itemColor: Colors.yellow,
        goodMessageColor: Colors.goodMessageColor,
        badMessageColor: Colors.badMessageColor,
        interfaceBoxColor: Colors.interfaceBoxColor,
        G_GOOD_MAGIC: DisplayGlyph.G_GOOD_MAGIC,
        G_BAD_MAGIC: DisplayGlyph.G_BAD_MAGIC
    } satisfies InventoryContext;

    // -- MenuContext -----------------------------------------------------------
    const menuCtx: MenuContext = {
        // -- State ------------------------------------------------------------
        rogue,
        gameConst,
        gameVariant,
        mainMenuTitle: BROGUE_TITLE_ART,

        isApplicationActive: () => true,
        serverMode: false,
        nonInteractivePlayback: false,
        wizardMode: false,
        previousGameSeed,
        randomNumbersGenerated: 0,
        currentFilePath,

        setRandomNumbersGenerated(n: number) {
            menuCtx.randomNumbersGenerated = n;
        },
        setCurrentFilePath(path: string) {
            currentFilePath = path;
            menuCtx.currentFilePath = path;
        },
        setGameVariant(variant: GameVariant) {
            gameVariant = variant;
            menuCtx.gameVariant = variant;
            // TODO: switch gameConst and catalogs based on variant
        },

        // -- RNG --------------------------------------------------------------
        seedRandomGenerator,
        rand_range: randRange,

        // -- Color manipulation -----------------------------------------------
        applyColorAverage,

        // -- Text -------------------------------------------------------------
        strLenWithoutEscapes,
        encodeMessageColor,

        // -- Rendering --------------------------------------------------------
        plotCharWithColor(
            inputChar: DisplayGlyph,
            loc: WindowPos,
            foreColor: Readonly<Color>,
            backColor: Readonly<Color>,
            dbuf: ScreenDisplayBuffer,
        ): boolean {
            return plotCharWithColor(inputChar, loc, foreColor, backColor, dbuf);
        },
        locIsInWindow,
        createScreenDisplayBuffer,
        clearDisplayBuffer(dbuf: ScreenDisplayBuffer) {
            clearDisplayBuffer(dbuf);
        },
        overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>) {
            overlayDisplayBufferFn(displayBuffer, dbuf as ScreenDisplayBuffer);
            commitDraws();
        },
        saveDisplayBuffer(): SavedDisplayBuffer {
            return saveDisplayBufferFn(displayBuffer);
        },
        restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>) {
            restoreDisplayBufferFn(displayBuffer, saved);
            commitDraws();
        },
        blackOutScreen(dbuf: ScreenDisplayBuffer) {
            blackOutScreen(dbuf);
        },
        commitDraws,

        printString(
            text: string, x: number, y: number,
            foreColor: Readonly<Color>, backColor: Readonly<Color>,
            dbuf: ScreenDisplayBuffer | null,
        ): void {
            printStringFn(text, x, y, foreColor, backColor, dbuf ?? displayBuffer);
        },

        // -- Buttons ----------------------------------------------------------
        initializeButton,
        setButtonText(button: BrogueButton, textWithHotkey: string, textWithoutHotkey: string) {
            setButtonTextFn(button, textWithHotkey, textWithoutHotkey, buttonCtx);
        },
        initializeButtonState(
            buttons: BrogueButton[], buttonCount: number,
            winX: number, winY: number, winWidth: number, winHeight: number,
        ): ButtonState {
            return initializeButtonState(buttons, buttonCount, winX, winY, winWidth, winHeight);
        },
        drawButton(button: BrogueButton, highlight: ButtonDrawState, dbuf: ScreenDisplayBuffer | null) {
            drawButtonFn(button, highlight, dbuf, buttonCtx);
        },
        drawButtonsInState(state: ButtonState, dbuf: ScreenDisplayBuffer) {
            drawButtonsInStateFn(state, dbuf, buttonCtx);
        },
        processButtonInput(state: ButtonState, event: RogueEvent) {
            return processButtonInputFn(state, event, buttonCtx);
        },
        buttonInputLoop(
            buttons: BrogueButton[], buttonCount: number,
            winX: number, winY: number, winWidth: number, winHeight: number,
        ) {
            return buttonInputLoopFn(
                buttons, buttonCount, winX, winY, winWidth, winHeight, buttonCtx,
            );
        },

        rectangularShading(
            x: number, y: number, width: number, height: number,
            backColor: Readonly<Color>, opacity: number,
            dbuf: ScreenDisplayBuffer,
        ) {
            rectangularShadingFn(x, y, width, height, backColor, opacity, dbuf, inventoryCtxPartial);
        },

        printTextBox(
            textBuf: string, x: number, y: number, width: number,
            foreColor: Readonly<Color>, backColor: Readonly<Color>,
            buttons?: BrogueButton[], buttonCount?: number,
        ): number {
            return printTextBoxFn(
                textBuf, x, y, width, foreColor, backColor,
                inventoryCtxForTextBox,
                buttons, buttonCount,
            );
        },

        // -- Events / timing --------------------------------------------------
        nextBrogueEvent(textInput: boolean, colorsDance: boolean, _realInputEvenInPlayback: boolean): RogueEvent {
            commitDraws();
            return browserConsole.nextKeyOrMouseEvent(textInput, colorsDance);
        },
        pauseBrogue(milliseconds: number, behavior?: PauseBehavior): boolean {
            return browserConsole.pauseForMilliseconds(
                milliseconds,
                behavior ?? { interruptForMouseMove: false },
            );
        },

        // -- Info screens / prompts -------------------------------------------
        getInputTextString(
            _prompt: string, _maxLength: number, _defaultEntry: string,
            _promptSuffix: string, _textEntryType: TextEntryType, _useDialogBox: boolean,
        ): string | null {
            // TODO: Wire to io-input getInputTextString with full InputContext
            return null;
        },
        printHighScores(_hiliteMostRecent: boolean): void {
            // TODO: Wire to io-screens printHighScores
        },
        confirm(_prompt: string, _alsoDuringPlayback: boolean): boolean {
            // TODO: Wire to io-input confirm
            return false;
        },
        waitForKeystrokeOrMouseClick(): void {
            commitDraws();
            browserConsole.nextKeyOrMouseEvent(false, false);
        },
        message(_msg: string, _flags: number): void {
            // TODO: Wire to io-messages message with full MessageContext
        },

        // -- Sidebar helper ---------------------------------------------------
        smoothHiliteGradient,

        // -- Game lifecycle ---------------------------------------------------
        initializeRogue(_seed: bigint): void {
            // TODO: Wire to game/game-init.initializeRogue with full GameInitContext
            // eslint-disable-next-line no-console
            console.log("[runtime] initializeRogue called — stub");
        },
        startLevel(_depth: number, _stairDirection: number): void {
            // TODO: Wire to game/game-level.startLevel with full LevelContext
            // eslint-disable-next-line no-console
            console.log("[runtime] startLevel called — stub");
        },
        mainInputLoop(): void {
            // TODO: Wire to io/io-input.mainInputLoop with full InputContext
            // eslint-disable-next-line no-console
            console.log("[runtime] mainInputLoop called — stub");
            rogue.gameHasEnded = true;
        },
        freeEverything(): void {
            // TODO: Wire to game/game-cleanup.freeEverything with full CleanupContext
        },
        initializeGameVariant(): void {
            // TODO: Switch catalogs per variant
        },
        initializeLaunchArguments(): void {
            // No-op for browser
        },

        // -- Recording stubs --------------------------------------------------
        flushBufferToFile(): void { /* no-op */ },
        saveGameNoPrompt(): void { /* no-op */ },
        saveRecordingNoPrompt(): string { return ""; },
        getAvailableFilePath(prefix: string, suffix: string): string {
            return prefix + suffix;
        },

        // -- Playback stubs ---------------------------------------------------
        executeEvent(_event: RogueEvent): void { /* no-op */ },
        displayAnnotation(): void { /* no-op */ },
        pausePlayback(): void { /* no-op */ },

        // -- Platform file ops ------------------------------------------------
        listFiles(): FileEntry[] { return []; },
        loadRunHistory(): RogueRun[] { return []; },
        saveResetRun(): void { /* no-op */ },
        openFile(_path: string): boolean { return false; },

        // -- Color constants --------------------------------------------------
        black: Colors.black,
        white: Colors.white,
        yellow: Colors.yellow,
        veryDarkGray: Colors.veryDarkGray,
        flameSourceColor: Colors.flameSourceColor,
        flameSourceColorSecondary: Colors.flameSourceColorSecondary,
        flameTitleColor: Colors.flameTitleColor,
        titleButtonColor: Colors.titleButtonColor,
        itemMessageColor: Colors.itemMessageColor,
        interfaceBoxColor: Colors.interfaceBoxColor,
        goodMessageColor: Colors.goodMessageColor,

        // -- Glyph constants --------------------------------------------------
        G_LEFT_TRIANGLE: DisplayGlyph.G_LEFT_TRIANGLE,
        G_UP_ARROW: DisplayGlyph.G_UP_ARROW,
        G_DOWN_ARROW: DisplayGlyph.G_DOWN_ARROW
    };

    return { menuCtx, displayBuffer, commitDraws };
}
