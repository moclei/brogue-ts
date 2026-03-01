/*
 *  io-input.ts — Input dispatch: event loop, keystroke handling, text entry
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: mainInputLoop (~300 lines), executeKeystroke (~270 lines),
 *             executeMouseClick, executeEvent, actionMenu (~160 lines),
 *             initializeMenuButtons, nextBrogueEvent, pauseBrogue,
 *             pauseAnimation, waitForAcknowledgment,
 *             waitForKeystrokeOrMouseClick, confirm, nextKeyPress,
 *             getInputTextString (~120 lines), considerCautiousMode,
 *             stripShiftFromMovementKeystroke, confirmMessages
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
    Pos,
    WindowPos,
    PauseBehavior,
    Creature,
    Item,
} from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { EventType, Direction, TextEntryType, RNG as RNGEnum } from "../types/enums.js";
import { ButtonFlag } from "../types/flags.js";
import {
    COLS, ROWS, DCOLS,
    KEYBOARD_LABELS,
    INTERFACE_OPACITY,
    UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW,
    NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
    NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9,
    DESCEND_KEY, ASCEND_KEY, REST_KEY, AUTO_REST_KEY,
    SEARCH_KEY, INVENTORY_KEY, EQUIP_KEY, UNEQUIP_KEY,
    DROP_KEY, APPLY_KEY, THROW_KEY, RETHROW_KEY,
    RELABEL_KEY, SWAP_KEY, TRUE_COLORS_KEY, STEALTH_RANGE_KEY,
    CALL_KEY, EXPLORE_KEY, AUTOPLAY_KEY,
    MESSAGE_ARCHIVE_KEY, BROGUE_HELP_KEY, FEATS_KEY,
    DISCOVERIES_KEY, CREATE_ITEM_MONSTER_KEY,
    SAVE_GAME_KEY, NEW_GAME_KEY, QUIT_KEY, GRAPHICS_KEY,
    SEED_KEY, EASY_MODE_KEY, PRINTSCREEN_KEY,
    RETURN_KEY, DELETE_KEY, TAB_KEY,
    ESCAPE_KEY, ACKNOWLEDGE_KEY, PERIOD_KEY,
    VIEW_RECORDING_KEY, LOAD_SAVED_GAME_KEY,
    MESSAGE_LINES, DEFAULT_PLAYBACK_DELAY,
} from "../types/constants.js";
import {
    white, yellow, black, gray, teal,
    interfaceBoxColor, interfaceButtonColor, itemMessageColor,
} from "../globals/colors.js";
import { PAUSE_BEHAVIOR_DEFAULT } from "../types/types.js";

// =============================================================================
// DI Context
// =============================================================================

/**
 * Minimal rogue state required by the input dispatch module.
 */
export interface InputRogueState {
    mode: number;         // GameMode
    RNG: number;
    depthLevel: number;
    deepestLevel: number;
    gameHasEnded: boolean;
    playbackMode: boolean;
    playbackFastForward: boolean;
    playbackDelayPerTurn: number;
    playbackDelayThisTurn: number;
    playbackPaused: boolean;
    playbackOOS: boolean;
    playbackOmniscience: boolean;
    playbackBetweenTurns: boolean;
    autoPlayingLevel: boolean;
    automationActive: boolean;
    disturbed: boolean;
    justRested: boolean;
    cautiousMode: boolean;
    trueColorMode: boolean;
    displayStealthRangeMode: boolean;
    quit: boolean;
    cursorMode: boolean;
    cursorLoc: Pos;
    cursorPathIntensity: number;
    upLoc: Pos;
    downLoc: Pos;
    playerTurnNumber: number;
    nextGame: number;     // NGCommand
    lastItemThrown: Item | null;
    creaturesWillFlashThisTurn: boolean;
}

/**
 * Dependency-injection context for the input dispatch module.
 *
 * This is intentionally large because the input layer is the glue between
 * the UI event stream and every game subsystem.
 */
export interface InputContext {
    rogue: InputRogueState;
    player: Creature;

    /** Whether the build is a debug build. */
    DEBUG: boolean;
    /** Whether the server mode is active. */
    serverMode: boolean;
    /** Whether the graphics renderer is available. */
    hasGraphics: boolean;
    /** Current graphics mode (0=text, 1=tiles, 2=hybrid). */
    graphicsMode: number;
    /** Global nonInteractivePlayback flag. */
    nonInteractivePlayback: boolean;
    /** Debug wormholing flag. */
    D_WORMHOLING: boolean;
    /** Debug safety vision flag. */
    D_SAFETY_VISION: boolean;
    /** Debug scent vision flag. */
    D_SCENT_VISION: boolean;
    /** Display message archive pointer (messages array). */
    displayedMessage: string[];
    /** The unstable messagesUnconfirmed counter. */
    messagesUnconfirmed: number;

    // Game mode constant for easy mode.
    GAME_MODE_EASY: number;

    // -- Coordinate helpers ---------------------------------------------------

    posEq(a: Pos, b: Pos): boolean;
    isPosInMap(pos: Pos): boolean;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    windowToMap(w: WindowPos): Pos;
    windowToMapX(x: number): number;
    distanceBetween(a: Pos, b: Pos): number;

    // -- Color helpers --------------------------------------------------------

    encodeMessageColor(theColor: Readonly<Color>): string;

    // -- Text / display -------------------------------------------------------

    strLenWithoutEscapes(s: string): number;
    printString(str: string, x: number, y: number, foreColor: Readonly<Color>, backColor: Readonly<Color>, dbuf: ScreenDisplayBuffer | null): void;
    plotCharWithColor(inputChar: DisplayGlyph, pos: WindowPos, foreColor: Readonly<Color>, backColor: Readonly<Color>): void;

    // -- Messages -------------------------------------------------------------

    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;
    temporaryMessage(msg: string, flags: number): void;
    confirmMessages(): void;
    updateMessageDisplay(): void;

    // -- Display buffers ------------------------------------------------------

    commitDraws(): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;

    // -- Buttons (from io-buttons.ts) -----------------------------------------

    initializeButton(): BrogueButton;
    initializeButtonState(state: ButtonState, buttons: BrogueButton[], count: number, winX: number, winY: number, winWidth: number, winHeight: number): void;
    buttonInputLoop(buttons: BrogueButton[], count: number, winX: number, winY: number, winWidth: number, winHeight: number, event: RogueEvent | null): number | Promise<number>;

    // -- Text box (from io-inventory.ts) --------------------------------------

    printTextBox(text: string, x: number, y: number, width: number, foreColor: Readonly<Color>, backColor: Readonly<Color>, buttons: BrogueButton[], buttonCount: number): number | Promise<number>;
    rectangularShading(x: number, y: number, width: number, height: number, color: Readonly<Color>, opacity: number, dbuf: ScreenDisplayBuffer): void;

    // -- Events / timing ------------------------------------------------------

    pauseForMilliseconds(milliseconds: number, behavior: PauseBehavior): boolean;
    nextKeyOrMouseEvent(textInput: boolean, colorsDance: boolean): RogueEvent;
    locIsInWindow(pos: WindowPos): boolean;

    // -- Display --------------------------------------------------------------

    displayLevel(): void;
    refreshSideBar(x: number, y: number, justClearing: boolean): void;
    displayInventory(categoryMask: number, titleFlags: number, focusFlags: number, includeDetails: boolean, includeButtons: boolean): void;
    displayMessageArchive(): void;
    printHelpScreen(): void;
    displayFeatsScreen(): void;
    printDiscoveriesScreen(): void;
    flashTemporaryAlert(msg: string, time: number): void;
    displayMonsterFlashes(flashAll: boolean): void;
    setGraphicsMode(mode: number): number;

    // -- Game actions ---------------------------------------------------------

    playerMoves(direction: number): void;
    playerRuns(direction: number): void;
    playerTurnEnded(): void;
    autoRest(): void;
    manualSearch(): void;
    travel(loc: Pos, autoConfirm: boolean): void;
    travelRoute(path: Pos[], steps: number): void;
    equip(item: Item | null): void;
    unequip(item: Item | null): void;
    drop(item: Item | null): void;
    apply(item: Item | null): void;
    throwCommand(item: Item | null, confirmed: boolean): void;
    relabel(item: Item | null): void;
    call(item: Item | null): void;
    swapLastEquipment(): void;
    enableEasyMode(): void;
    saveGame(): void;
    gameOver(message: string, showHighScores: boolean): void;
    printSeed(): void;
    showCursor(): void;
    hideCursor(): void;
    exploreKey(controlKey: boolean): void;
    autoPlayLevel(controlKey: boolean): void;
    useStairs(delta: number): void;
    takeScreenshot(): boolean;
    itemIsCarried(item: Item): boolean;
    dialogCreateItemOrMonster(): void;

    // -- Sidebar focus --------------------------------------------------------

    monsterAtLoc(loc: Pos): Creature | null;
    itemAtLoc(loc: Pos): Item | null;
    canSeeMonster(monst: Creature): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;
    cellHasTMFlag(loc: Pos, flag: number): boolean;
    printMonsterDetails(monst: Creature): void;
    printFloorItemDetails(item: Item): void;
    printLocationDescription(x: number, y: number): void;

    // -- Targeting / cursor ---------------------------------------------------

    moveCursor(
        targetConfirmed: { value: boolean },
        canceled: { value: boolean },
        tabKey: { value: boolean },
        cursorLoc: { value: Pos },
        theEvent: { value: RogueEvent },
        state: ButtonState,
        doButtons: boolean,
        cursorMode: boolean,
        restingAllowed: boolean,
    ): boolean;
    nextTargetAfter(monst: Creature | null, outLoc: { value: Pos }, currentLoc: Pos, mode: number, reverse: boolean): boolean;
    hilitePath(path: Pos[], steps: number, unhilite: boolean): void;
    clearCursorPath(): void;
    hiliteCell(x: number, y: number, color: Readonly<Color>, opacity: number, flash: boolean): void;
    refreshDungeonCell(loc: Pos): void;

    // -- Pathing --------------------------------------------------------------

    allocGrid(): number[][];
    freeGrid(grid: number[][]): void;
    fillGrid(grid: number[][], value: number): void;
    dijkstraScan(grid: number[][], costMap: number[][], useDiagonals: boolean): void;
    populateCreatureCostMap(costMap: number[][], creature: Creature): void;
    getPlayerPathOnMap(path: Pos[], playerPathingMap: number[][], origin: Pos): number;
    processSnapMap(cursorSnapMap: number[][]): void;
    getClosestValidLocationOnMap(snapMap: number[][], x: number, y: number): Pos;
    diagonalBlocked(fromX: number, fromY: number, toX: number, toY: number, limitToPlayerKnowledge: boolean): boolean;
    pmapFlagsAt(loc: Pos): number;
    terrainFlags(loc: Pos): number;
    terrainMechFlags(loc: Pos): number;

    // -- Recordings -----------------------------------------------------------

    recordKeystroke(keystroke: number, controlKey: boolean, shiftKey: boolean): void;
    recallEvent(): RogueEvent;
    executePlaybackInput(event: RogueEvent): boolean;

    // -- Recording file access -------------------------------------------------

    proposeOrConfirmLocation(loc: Pos, failMsg: string): boolean;
    characterForbiddenInFilename(char: string): boolean;

    // -- Safety map (debug) ---------------------------------------------------

    safetyMap: number[][] | null;
    displayGrid(grid: number[][]): void;
    displayLoops(): void;
    displayChokeMap(): void;
    displayMachines(): void;
    displayWaypoints(): void;

    // -- Autotarget mode constant ---------------------------------------------

    AUTOTARGET_MODE_EXPLORE: number;

    // -- Terrain / monster flags -----------------------------------------------

    TM_LIST_IN_SIDEBAR: number;
    TM_PROMOTES_ON_PLAYER_ENTRY: number;
    T_OBSTRUCTS_PASSABILITY: number;
    HAS_MONSTER: number;
    MONST_ATTACKABLE_THRU_WALLS: number;
    STATUS_HALLUCINATING: number;
    STATUS_TELEPATHIC: number;
    STATUS_SEARCHING: number;
    ALL_ITEMS: number;
    REQUIRE_ACKNOWLEDGMENT: number;

    // -- Directions array (nbDirs) -------------------------------------------

    nbDirs: number[][];
}

// =============================================================================
// stripShiftFromMovementKeystroke — IO.c:3658
// =============================================================================

/**
 * If the keystroke is the uppercase version of a movement key (Shift held),
 * convert it to the lowercase equivalent.
 *
 * C: `stripShiftFromMovementKeystroke` in IO.c
 */
export function stripShiftFromMovementKeystroke(keystroke: number): number {
    const newKey = keystroke - ("A".charCodeAt(0) - "a".charCodeAt(0));
    if (
        newKey === LEFT_KEY ||
        newKey === RIGHT_KEY ||
        newKey === DOWN_KEY ||
        newKey === UP_KEY ||
        newKey === UPLEFT_KEY ||
        newKey === UPRIGHT_KEY ||
        newKey === DOWNLEFT_KEY ||
        newKey === DOWNRIGHT_KEY
    ) {
        return newKey;
    }
    return keystroke;
}

// =============================================================================
// considerCautiousMode — IO.c:840
// =============================================================================

/**
 * Placeholder — the original implementation was commented-out in C.
 *
 * C: `considerCautiousMode` in IO.c
 */
export function considerCautiousMode(_ctx: InputContext): void {
    // The C implementation was entirely commented out.
}

// =============================================================================
// pauseBrogue — IO.c:2367
// =============================================================================

/**
 * Pause the game for the given number of milliseconds.
 * For long delays, pauses in small increments so user interruptions are
 * detected quickly.  Returns true if the user interrupted.
 *
 * C: `pauseBrogue` in IO.c
 */
export function pauseBrogue(ctx: InputContext, milliseconds: number, behavior: PauseBehavior): boolean {
    ctx.commitDraws();
    if (ctx.rogue.playbackMode && ctx.rogue.playbackFastForward) {
        return true;
    }
    while (milliseconds > 100) {
        if (ctx.pauseForMilliseconds(50, behavior)) return true;
        milliseconds -= 50;
    }
    return ctx.pauseForMilliseconds(milliseconds, behavior);
}

// =============================================================================
// pauseAnimation — IO.c:2381
// =============================================================================

/**
 * Same as `pauseBrogue`, but during playback the delay scales according
 * to playback speed.
 *
 * C: `pauseAnimation` in IO.c
 */
export function pauseAnimation(ctx: InputContext, milliseconds: number, behavior: PauseBehavior): boolean {
    if (ctx.rogue.playbackMode && !ctx.rogue.playbackPaused && milliseconds > 0) {
        let factor = ctx.rogue.playbackDelayPerTurn / DEFAULT_PLAYBACK_DELAY;
        if (factor > 1) factor = Math.sqrt(factor);
        milliseconds = Math.max(1, Math.round(milliseconds * factor));
    }
    return pauseBrogue(ctx, milliseconds, behavior);
}

// =============================================================================
// nextBrogueEvent — IO.c:2390
// =============================================================================

/**
 * Get the next event — either from playback recording or from real user
 * input. Handles playback pausing and out-of-sync recovery.
 *
 * C: `nextBrogueEvent` in IO.c
 */
export function nextBrogueEvent(
    ctx: InputContext,
    textInput: boolean,
    colorsDance: boolean,
    realInputEvenInPlayback: boolean,
): RogueEvent {
    let returnEvent: RogueEvent = {
        eventType: EventType.EventError,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };

    if (ctx.rogue.playbackMode && !realInputEvenInPlayback) {
        let repeatAgain: boolean;
        do {
            repeatAgain = false;
            if (
                (!ctx.rogue.playbackFastForward && ctx.rogue.playbackBetweenTurns) ||
                ctx.rogue.playbackOOS
            ) {
                const pauseDuration = ctx.rogue.playbackPaused
                    ? DEFAULT_PLAYBACK_DELAY
                    : ctx.rogue.playbackDelayThisTurn;
                if (pauseDuration && pauseBrogue(ctx, pauseDuration, PAUSE_BEHAVIOR_DEFAULT)) {
                    const recordingInput = nextBrogueEvent(ctx, false, false, true);
                    const interaction = ctx.executePlaybackInput(recordingInput);
                    repeatAgain = !ctx.rogue.playbackPaused && interaction;
                }
            }
        } while ((repeatAgain || ctx.rogue.playbackOOS) && !ctx.rogue.gameHasEnded);
        ctx.rogue.playbackDelayThisTurn = ctx.rogue.playbackDelayPerTurn;
        returnEvent = ctx.recallEvent();
    } else {
        ctx.commitDraws();
        if (ctx.rogue.creaturesWillFlashThisTurn) {
            ctx.displayMonsterFlashes(true);
        }
        do {
            returnEvent = ctx.nextKeyOrMouseEvent(textInput, colorsDance);
        } while (
            returnEvent.eventType === EventType.MouseUp &&
            !ctx.locIsInWindow({ windowX: returnEvent.param1, windowY: returnEvent.param2 })
        );
    }

    if (returnEvent.eventType === EventType.EventError) {
        ctx.rogue.playbackPaused = ctx.rogue.playbackMode;
        ctx.message("Event error!", ctx.REQUIRE_ACKNOWLEDGMENT);
    }

    return returnEvent;
}

// =============================================================================
// nextKeyPress — IO.c:4056
// =============================================================================

/**
 * Block until the user presses a key; return its code.
 *
 * C: `nextKeyPress` in IO.c
 */
export function nextKeyPress(ctx: InputContext, textInput: boolean): number {
    let theEvent: RogueEvent;
    do {
        theEvent = nextBrogueEvent(ctx, textInput, false, false);
    } while (theEvent.eventType !== EventType.Keystroke);
    return theEvent.param1;
}

// =============================================================================
// waitForAcknowledgment — IO.c:2910
// =============================================================================

/**
 * Block until the user presses space / escape / clicks.
 *
 * C: `waitForAcknowledgment` in IO.c
 */
export function waitForAcknowledgment(ctx: InputContext): void {
    if (
        ctx.rogue.autoPlayingLevel ||
        (ctx.rogue.playbackMode && !ctx.rogue.playbackOOS) ||
        ctx.nonInteractivePlayback
    ) {
        return;
    }

    let theEvent: RogueEvent;
    do {
        theEvent = nextBrogueEvent(ctx, false, false, false);
        if (
            theEvent.eventType === EventType.Keystroke &&
            theEvent.param1 !== ACKNOWLEDGE_KEY &&
            theEvent.param1 !== ESCAPE_KEY
        ) {
            ctx.flashTemporaryAlert(" -- Press space or click to continue -- ", 500);
        }
    } while (
        !(
            (theEvent.eventType === EventType.Keystroke &&
                (theEvent.param1 === ACKNOWLEDGE_KEY || theEvent.param1 === ESCAPE_KEY)) ||
            theEvent.eventType === EventType.MouseUp
        )
    );
}

// =============================================================================
// waitForKeystrokeOrMouseClick — IO.c:2926
// =============================================================================

/**
 * Block until any key or mouse click.
 *
 * C: `waitForKeystrokeOrMouseClick` in IO.c
 */
export function waitForKeystrokeOrMouseClick(ctx: InputContext): void {
    let theEvent: RogueEvent;
    do {
        theEvent = nextBrogueEvent(ctx, false, false, false);
    } while (
        theEvent.eventType !== EventType.Keystroke &&
        theEvent.eventType !== EventType.MouseUp
    );
}

// =============================================================================
// confirm — IO.c:2933
// =============================================================================

/**
 * Show a yes/no dialog.  Returns true if user confirmed.
 *
 * C: `confirm` in IO.c
 */
export async function confirm(ctx: InputContext, prompt: string, alsoDuringPlayback: boolean): Promise<boolean> {
    if (ctx.rogue.autoPlayingLevel || (!alsoDuringPlayback && ctx.rogue.playbackMode)) {
        return true;
    }

    const whiteEsc = ctx.encodeMessageColor(white);
    const yellowEsc = KEYBOARD_LABELS ? ctx.encodeMessageColor(yellow) : ctx.encodeMessageColor(white);

    const buttons: BrogueButton[] = [];

    const btn0 = ctx.initializeButton();
    btn0.text = `     ${yellowEsc}Y${whiteEsc}es     `;
    btn0.hotkey = ["y".charCodeAt(0), "Y".charCodeAt(0), RETURN_KEY];
    btn0.flags |= ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_KEYPRESS_HIGHLIGHT;
    buttons.push(btn0);

    const btn1 = ctx.initializeButton();
    btn1.text = `     ${yellowEsc}N${whiteEsc}o      `;
    btn1.hotkey = ["n".charCodeAt(0), "N".charCodeAt(0), ACKNOWLEDGE_KEY, ESCAPE_KEY];
    btn1.flags |= ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_KEYPRESS_HIGHLIGHT;
    buttons.push(btn1);

    const rbuf = ctx.saveDisplayBuffer();
    const retVal = await ctx.printTextBox(
        prompt,
        Math.floor(COLS / 3),
        Math.floor(ROWS / 3),
        Math.floor(COLS / 3),
        white,
        interfaceBoxColor,
        buttons,
        2,
    );
    ctx.restoreDisplayBuffer(rbuf);

    return retVal !== -1 && retVal !== 1;
}

// =============================================================================
// getInputTextString — IO.c:2720
// =============================================================================

/**
 * Show a text-entry prompt and return the entered string.
 * Returns `null` if the user cancelled (Escape).
 *
 * C: `getInputTextString` in IO.c
 */
export function getInputTextString(
    ctx: InputContext,
    prompt: string,
    maxLength: number,
    defaultEntry: string,
    promptSuffix: string,
    textEntryType: TextEntryType,
    useDialogBox: boolean,
): string | null {
    const textEntryBounds: [number, number][] = [
        [" ".charCodeAt(0), "~".charCodeAt(0)],
        [" ".charCodeAt(0), "~".charCodeAt(0)],
        ["0".charCodeAt(0), "9".charCodeAt(0)],
    ];

    const promptSuffixLen = promptSuffix.length;

    // Truncate default entry if it + suffix exceeds maxLength
    let entry = defaultEntry;
    const overflow = entry.length + promptSuffixLen - maxLength;
    if (overflow > 0) {
        entry = entry.substring(0, entry.length - overflow);
    }

    let x: number;
    let y: number;
    let rbuf: SavedDisplayBuffer | null = null;

    if (useDialogBox) {
        x = Math.floor((COLS - Math.max(maxLength, ctx.strLenWithoutEscapes(prompt))) / 2);
        y = Math.floor(ROWS / 2) - 1;
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.rectangularShading(
            x - 1, y - 2,
            Math.max(maxLength, ctx.strLenWithoutEscapes(prompt)) + 2, 4,
            interfaceBoxColor, INTERFACE_OPACITY, dbuf,
        );
        rbuf = ctx.saveDisplayBuffer();
        ctx.overlayDisplayBuffer(dbuf);
        ctx.printString(prompt, x, y - 1, white, interfaceBoxColor, null);
        for (let i = 0; i < maxLength; i++) {
            ctx.plotCharWithColor(" ".charCodeAt(0) as DisplayGlyph, { windowX: x + i, windowY: y }, black, black);
        }
        ctx.printString(entry, x, y, white, black, null);
    } else {
        ctx.confirmMessages();
        x = ctx.mapToWindowX(ctx.strLenWithoutEscapes(prompt));
        y = MESSAGE_LINES - 1;
        ctx.temporaryMessage(prompt, 0);
        ctx.printString(entry, x, y, white, black, null);
    }

    maxLength = Math.min(maxLength, COLS - x);

    // Build working buffer as character array
    const inputChars: number[] = [];
    for (let i = 0; i < entry.length; i++) {
        inputChars[i] = entry.charCodeAt(i);
    }
    let charNum = ctx.strLenWithoutEscapes(entry);
    for (let i = charNum; i < maxLength; i++) {
        inputChars[i] = " ".charCodeAt(0);
    }

    const suffix = promptSuffix.length === 0 ? " " : promptSuffix;

    let keystroke: number;
    do {
        ctx.printString(suffix, charNum + x, y, gray, black, null);
        ctx.plotCharWithColor(
            (suffix.charCodeAt(0) || " ".charCodeAt(0)) as DisplayGlyph,
            { windowX: x + charNum, windowY: y },
            black,
            white,
        );
        keystroke = nextKeyPress(ctx, true);

        if (keystroke === DELETE_KEY && charNum > 0) {
            ctx.printString(suffix, charNum + x - 1, y, gray, black, null);
            ctx.plotCharWithColor(
                " ".charCodeAt(0) as DisplayGlyph,
                { windowX: x + charNum + suffix.length - 1, windowY: y },
                black,
                black,
            );
            charNum--;
            inputChars[charNum] = " ".charCodeAt(0);
        } else if (
            keystroke >= textEntryBounds[textEntryType][0] &&
            keystroke <= textEntryBounds[textEntryType][1]
        ) {
            let ch = keystroke;
            if (
                textEntryType === TextEntryType.Filename &&
                ctx.characterForbiddenInFilename(String.fromCharCode(ch))
            ) {
                ch = "-".charCodeAt(0);
            }

            inputChars[charNum] = ch;
            ctx.plotCharWithColor(
                ch as DisplayGlyph,
                { windowX: x + charNum, windowY: y },
                white,
                black,
            );
            if (charNum < maxLength - promptSuffixLen) {
                ctx.printString(suffix, charNum + x + 1, y, gray, black, null);
                charNum++;
            }
        }
    } while (keystroke !== RETURN_KEY && keystroke !== ESCAPE_KEY);

    if (useDialogBox && rbuf) {
        ctx.restoreDisplayBuffer(rbuf);
    }

    const inputText = String.fromCharCode(...inputChars.slice(0, charNum));

    if (keystroke === ESCAPE_KEY) {
        return null;
    }

    // Append to the first displayed message
    if (ctx.displayedMessage.length > 0) {
        ctx.displayedMessage[0] += inputText + suffix;
    }
    return inputText;
}

// =============================================================================
// executeMouseClick — IO.c:2431
// =============================================================================

/**
 * Dispatch a mouse click — right-click opens inventory, left-click on map
 * triggers travel/cursor, click in message area opens message archive.
 *
 * C: `executeMouseClick` in IO.c
 */
export async function executeMouseClick(ctx: InputContext, theEvent: RogueEvent): Promise<void> {
    const mouse: WindowPos = { windowX: theEvent.param1, windowY: theEvent.param2 };
    const autoConfirm = theEvent.controlKey;

    if (theEvent.eventType === EventType.RightMouseUp) {
        ctx.displayInventory(ctx.ALL_ITEMS, 0, 0, true, true);
    } else if (ctx.isPosInMap(ctx.windowToMap(mouse))) {
        if (autoConfirm) {
            ctx.travel(ctx.windowToMap(mouse), autoConfirm);
        } else {
            ctx.rogue.cursorLoc = ctx.windowToMap(mouse);
            await mainInputLoop(ctx);
        }
    } else if (
        ctx.windowToMapX(mouse.windowX) >= 0 &&
        ctx.windowToMapX(mouse.windowX) < DCOLS &&
        mouse.windowY >= 0 &&
        mouse.windowY < MESSAGE_LINES
    ) {
        ctx.displayMessageArchive();
    }
}

// =============================================================================
// keystrokeToDirection — helper
// =============================================================================

function keystrokeToDirection(keystroke: number): number {
    switch (keystroke) {
        case UP_KEY:
        case UP_ARROW:
        case NUMPAD_8:
            return Direction.Up;
        case DOWN_KEY:
        case DOWN_ARROW:
        case NUMPAD_2:
            return Direction.Down;
        case LEFT_KEY:
        case LEFT_ARROW:
        case NUMPAD_4:
            return Direction.Left;
        case RIGHT_KEY:
        case RIGHT_ARROW:
        case NUMPAD_6:
            return Direction.Right;
        case NUMPAD_7:
        case UPLEFT_KEY:
            return Direction.UpLeft;
        case UPRIGHT_KEY:
        case NUMPAD_9:
            return Direction.UpRight;
        case DOWNLEFT_KEY:
        case NUMPAD_1:
            return Direction.DownLeft;
        case DOWNRIGHT_KEY:
        case NUMPAD_3:
            return Direction.DownRight;
        default:
            return -1;
    }
}

// =============================================================================
// executeKeystroke — IO.c:2451
// =============================================================================

/**
 * Dispatch a single keystroke to the appropriate game action.
 *
 * C: `executeKeystroke` in IO.c
 */
export async function executeKeystroke(ctx: InputContext, keystroke: number, controlKey: boolean, shiftKey: boolean): Promise<void> {
    ctx.confirmMessages();
    keystroke = stripShiftFromMovementKeystroke(keystroke);

    const direction = keystrokeToDirection(keystroke);

    if (direction < 0) {
        // Non-movement commands
        switch (keystroke) {
            case DESCEND_KEY:
                considerCautiousMode(ctx);
                if (ctx.D_WORMHOLING) {
                    ctx.recordKeystroke(DESCEND_KEY, false, false);
                    ctx.useStairs(1);
                } else if (ctx.proposeOrConfirmLocation(ctx.rogue.downLoc, "I see no way down.")) {
                    ctx.travel(ctx.rogue.downLoc, true);
                }
                break;
            case ASCEND_KEY:
                considerCautiousMode(ctx);
                if (ctx.D_WORMHOLING) {
                    ctx.recordKeystroke(ASCEND_KEY, false, false);
                    ctx.useStairs(-1);
                } else if (ctx.proposeOrConfirmLocation(ctx.rogue.upLoc, "I see no way up.")) {
                    ctx.travel(ctx.rogue.upLoc, true);
                }
                break;
            case RETURN_KEY:
                ctx.showCursor();
                break;
            case REST_KEY:
            case PERIOD_KEY:
            case NUMPAD_5:
                considerCautiousMode(ctx);
                ctx.rogue.justRested = true;
                ctx.recordKeystroke(REST_KEY, false, false);
                ctx.playerTurnEnded();
                break;
            case AUTO_REST_KEY:
                ctx.rogue.justRested = true;
                ctx.autoRest();
                break;
            case SEARCH_KEY:
                if (controlKey) {
                    ctx.rogue.disturbed = false;
                    ctx.rogue.automationActive = true;
                    do {
                        ctx.manualSearch();
                        if (pauseAnimation(ctx, 80, PAUSE_BEHAVIOR_DEFAULT)) {
                            ctx.rogue.disturbed = true;
                        }
                    } while (
                        ctx.player.status[ctx.STATUS_SEARCHING] < 5 &&
                        !ctx.rogue.disturbed
                    );
                    ctx.rogue.automationActive = false;
                } else {
                    ctx.manualSearch();
                }
                break;
            case INVENTORY_KEY:
                ctx.displayInventory(ctx.ALL_ITEMS, 0, 0, true, true);
                break;
            case EQUIP_KEY:
                ctx.equip(null);
                break;
            case UNEQUIP_KEY:
                ctx.unequip(null);
                break;
            case DROP_KEY:
                ctx.drop(null);
                break;
            case APPLY_KEY:
                ctx.apply(null);
                break;
            case THROW_KEY:
                ctx.throwCommand(null, false);
                break;
            case RETHROW_KEY:
                if (ctx.rogue.lastItemThrown != null && ctx.itemIsCarried(ctx.rogue.lastItemThrown)) {
                    ctx.throwCommand(ctx.rogue.lastItemThrown, true);
                }
                break;
            case RELABEL_KEY:
                ctx.relabel(null);
                break;
            case SWAP_KEY:
                ctx.swapLastEquipment();
                break;
            case TRUE_COLORS_KEY:
                ctx.rogue.trueColorMode = !ctx.rogue.trueColorMode;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                if (ctx.rogue.trueColorMode) {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Color effects disabled. Press '\\' again to enable."
                            : "Color effects disabled.",
                        teal,
                        0,
                    );
                } else {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Color effects enabled. Press '\\' again to disable."
                            : "Color effects enabled.",
                        teal,
                        0,
                    );
                }
                break;
            case STEALTH_RANGE_KEY:
                ctx.rogue.displayStealthRangeMode = !ctx.rogue.displayStealthRangeMode;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                if (ctx.rogue.displayStealthRangeMode) {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Stealth range displayed. Press ']' again to hide."
                            : "Stealth range displayed.",
                        teal,
                        0,
                    );
                } else {
                    ctx.messageWithColor(
                        KEYBOARD_LABELS
                            ? "Stealth range hidden. Press ']' again to display."
                            : "Stealth range hidden.",
                        teal,
                        0,
                    );
                }
                break;
            case CALL_KEY:
                ctx.call(null);
                break;
            case EXPLORE_KEY:
                considerCautiousMode(ctx);
                ctx.exploreKey(controlKey);
                break;
            case AUTOPLAY_KEY:
                if (await confirm(ctx, "Turn on autopilot?", false)) {
                    ctx.autoPlayLevel(controlKey);
                }
                break;
            case MESSAGE_ARCHIVE_KEY:
                ctx.displayMessageArchive();
                break;
            case BROGUE_HELP_KEY:
                ctx.printHelpScreen();
                break;
            case FEATS_KEY:
                ctx.displayFeatsScreen();
                break;
            case DISCOVERIES_KEY:
                ctx.printDiscoveriesScreen();
                break;
            case CREATE_ITEM_MONSTER_KEY:
                if (ctx.DEBUG) {
                    ctx.dialogCreateItemOrMonster();
                }
                break;
            case SAVE_GAME_KEY:
                if (ctx.rogue.playbackMode || ctx.serverMode) {
                    return;
                }
                if (await confirm(ctx, "Save this game and exit?", false)) {
                    ctx.saveGame();
                }
                break;
            case NEW_GAME_KEY:
                if (ctx.rogue.playerTurnNumber < 50 || await confirm(ctx, "End this game and begin a new game?", false)) {
                    ctx.rogue.nextGame = 1; // NG_NEW_GAME
                    ctx.rogue.gameHasEnded = true;
                }
                break;
            case QUIT_KEY:
                if (await confirm(ctx, "Quit and abandon this game? (The save will be deleted.)", false)) {
                    ctx.recordKeystroke(QUIT_KEY, false, false);
                    ctx.rogue.quit = true;
                    ctx.gameOver("Quit", true);
                }
                break;
            case GRAPHICS_KEY:
                if (ctx.hasGraphics) {
                    ctx.graphicsMode = ctx.setGraphicsMode((ctx.graphicsMode + 1) % 3);
                    switch (ctx.graphicsMode) {
                        case 0: // TEXT_GRAPHICS
                            ctx.messageWithColor(
                                KEYBOARD_LABELS
                                    ? "Switched to text mode. Press 'G' again to enable tiles."
                                    : "Switched to text mode.",
                                teal,
                                0,
                            );
                            break;
                        case 1: // TILES_GRAPHICS
                            ctx.messageWithColor(
                                KEYBOARD_LABELS
                                    ? "Switched to graphical tiles. Press 'G' again to enable hybrid mode."
                                    : "Switched to graphical tiles.",
                                teal,
                                0,
                            );
                            break;
                        case 2: // HYBRID_GRAPHICS
                            ctx.messageWithColor(
                                KEYBOARD_LABELS
                                    ? "Switched to hybrid mode. Press 'G' again to disable tiles."
                                    : "Switched to hybrid mode.",
                                teal,
                                0,
                            );
                            break;
                    }
                }
                break;
            case SEED_KEY:
                if (ctx.DEBUG) {
                    ctx.displayLoops();
                    ctx.displayChokeMap();
                    ctx.displayMachines();
                    ctx.displayWaypoints();
                }
                ctx.printSeed();
                break;
            case EASY_MODE_KEY:
                ctx.enableEasyMode();
                break;
            case PRINTSCREEN_KEY:
                if (ctx.takeScreenshot()) {
                    ctx.flashTemporaryAlert(" Screenshot saved in save directory ", 2000);
                }
                break;
            default:
                break;
        }
    }

    if (direction >= 0) {
        ctx.hideCursor();
        considerCautiousMode(ctx);
        if (controlKey || shiftKey) {
            ctx.playerRuns(direction);
        } else {
            ctx.playerMoves(direction);
        }
        ctx.refreshSideBar(-1, -1, false);
    }

    if (ctx.D_SAFETY_VISION && ctx.safetyMap) {
        ctx.displayGrid(ctx.safetyMap);
    }
    if (ctx.rogue.trueColorMode || ctx.D_SCENT_VISION) {
        ctx.displayLevel();
    }

    ctx.rogue.cautiousMode = false;
}

// =============================================================================
// executeEvent — RogueMain.c:45
// =============================================================================

/**
 * Dispatch a single event (keystroke or mouse click).
 *
 * C: `executeEvent` in RogueMain.c
 */
export async function executeEvent(ctx: InputContext, theEvent: RogueEvent): Promise<void> {
    ctx.rogue.playbackBetweenTurns = false;
    if (theEvent.eventType === EventType.Keystroke) {
        await executeKeystroke(ctx, theEvent.param1, theEvent.controlKey, theEvent.shiftKey);
    } else if (
        theEvent.eventType === EventType.MouseUp ||
        theEvent.eventType === EventType.RightMouseUp
    ) {
        await executeMouseClick(ctx, theEvent);
    }
}

// =============================================================================
// initializeMenuButtons — IO.c:443
// =============================================================================

const MAX_MENU_BUTTON_COUNT = 5;

/**
 * Set up the five bottom-bar menu buttons (Explore, Rest, Search, Menu, Inventory)
 * or the playback equivalents.
 *
 * C: `initializeMenuButtons` (static) in IO.c
 */
export function initializeMenuButtons(ctx: InputContext, state: ButtonState, buttons: BrogueButton[]): void {
    const goldTextEscape = ctx.encodeMessageColor(KEYBOARD_LABELS ? yellow : white);
    const whiteTextEscape = ctx.encodeMessageColor(white);

    for (let i = 0; i < MAX_MENU_BUTTON_COUNT; i++) {
        const btn = ctx.initializeButton();
        btn.opacity = 75;
        btn.buttonColor = { ...interfaceButtonColor };
        btn.y = ROWS - 1;
        btn.flags |= ButtonFlag.B_WIDE_CLICK_AREA;
        btn.flags &= ~ButtonFlag.B_KEYPRESS_HIGHLIGHT;
        // Copy into existing array slot
        Object.assign(buttons[i], btn);
    }

    let buttonCount = 0;

    if (ctx.rogue.playbackMode) {
        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = ` Unpause (${goldTextEscape}space${whiteTextEscape}) `;
        } else {
            buttons[buttonCount].text = "     Unpause     ";
        }
        buttons[buttonCount].hotkey = [ACKNOWLEDGE_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `Omniscience (${goldTextEscape}tab${whiteTextEscape})`;
        } else {
            buttons[buttonCount].text = "   Omniscience   ";
        }
        buttons[buttonCount].hotkey = [TAB_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = ` Next Turn (${goldTextEscape}l${whiteTextEscape}) `;
        } else {
            buttons[buttonCount].text = "   Next Turn   ";
        }
        buttons[buttonCount].hotkey = [RIGHT_KEY, RIGHT_ARROW];
        buttonCount++;

        buttons[buttonCount].text = "  Menu  ";
        buttonCount++;
    } else {
        buttons[buttonCount].text = `   E${goldTextEscape}x${whiteTextEscape}plore   `;
        buttons[buttonCount].hotkey = [EXPLORE_KEY, "X".charCodeAt(0)];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `   Rest (${goldTextEscape}z${whiteTextEscape})   `;
        } else {
            buttons[buttonCount].text = "     Rest     ";
        }
        buttons[buttonCount].hotkey = [REST_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  Search (${goldTextEscape}s${whiteTextEscape})  `;
        } else {
            buttons[buttonCount].text = "    Search    ";
        }
        buttons[buttonCount].hotkey = [SEARCH_KEY];
        buttonCount++;

        buttons[buttonCount].text = "    Menu    ";
        buttonCount++;
    }

    buttons[4].text = `   ${goldTextEscape}I${whiteTextEscape}nventory   `;
    buttons[4].hotkey = [INVENTORY_KEY, "I".charCodeAt(0)];

    let x = ctx.mapToWindowX(0);
    for (let i = 0; i < 5; i++) {
        buttons[i].x = x;
        x += ctx.strLenWithoutEscapes(buttons[i].text) + 2;
    }

    ctx.initializeButtonState(
        state,
        buttons,
        5,
        ctx.mapToWindowX(0),
        ROWS - 1,
        COLS - ctx.mapToWindowX(0),
        1,
    );
}

// =============================================================================
// actionMenu — IO.c:170
// =============================================================================

/**
 * Show the in-game action / settings menu.  Returns the hotkey of the
 * chosen action, or -1 if cancelled.
 *
 * C: `actionMenu` (static) in IO.c
 */
export async function actionMenu(ctx: InputContext, x: number, playingBack: boolean): Promise<number> {
    const yellowEsc = ctx.encodeMessageColor(itemMessageColor);
    const whiteEsc = ctx.encodeMessageColor(white);
    const darkGrayEsc = ctx.encodeMessageColor(black);

    const takeActionOurselves: boolean[] = new Array(ROWS).fill(false);

    let buttonChosen: number;

    do {
        const buttons: BrogueButton[] = [];
        for (let i = 0; i < ROWS; i++) {
            const btn = ctx.initializeButton();
            btn.buttonColor = { ...interfaceBoxColor };
            btn.opacity = INTERFACE_OPACITY;
            buttons.push(btn);
        }

        let buttonCount = 0;

        if (playingBack) {
            // Playback-specific buttons
            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}k: ${whiteEsc}Faster playback  `;
            } else {
                buttons[buttonCount].text = "  Faster playback  ";
            }
            buttons[buttonCount].hotkey = [UP_KEY, UP_ARROW, NUMPAD_8];
            buttonCount++;

            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}j: ${whiteEsc}Slower playback  `;
            } else {
                buttons[buttonCount].text = "  Slower playback  ";
            }
            buttons[buttonCount].hotkey = [DOWN_KEY, DOWN_ARROW, NUMPAD_2];
            buttonCount++;

            buttons[buttonCount].text = `    ${darkGrayEsc}---`;
            buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
            buttonCount++;

            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `${yellowEsc}0-9: ${whiteEsc}Fast forward to turn  `;
            } else {
                buttons[buttonCount].text = "  Fast forward to turn  ";
            }
            buttons[buttonCount].hotkey = ["0".charCodeAt(0)];
            buttonCount++;

            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}<:${whiteEsc} Previous Level  `;
            } else {
                buttons[buttonCount].text = "  Previous Level  ";
            }
            buttons[buttonCount].hotkey = [ASCEND_KEY];
            buttonCount++;

            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}>:${whiteEsc} Next Level  `;
            } else {
                buttons[buttonCount].text = "  Next Level  ";
            }
            buttons[buttonCount].hotkey = [DESCEND_KEY];
            buttonCount++;

            buttons[buttonCount].text = `    ${darkGrayEsc}---`;
            buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
            buttonCount++;
        } else {
            // Normal game buttons
            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}Z: ${whiteEsc}Rest until better  `;
            } else {
                buttons[buttonCount].text = "  Rest until better  ";
            }
            buttons[buttonCount].hotkey = [AUTO_REST_KEY];
            buttonCount++;

            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}A: ${whiteEsc}Autopilot  `;
            } else {
                buttons[buttonCount].text = "  Autopilot  ";
            }
            buttons[buttonCount].hotkey = [AUTOPLAY_KEY];
            buttonCount++;

            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}T: ${whiteEsc}Re-throw at last monster  `;
            } else {
                buttons[buttonCount].text = "  Re-throw at last monster  ";
            }
            buttons[buttonCount].hotkey = [RETHROW_KEY];
            buttonCount++;

            if (ctx.rogue.mode !== ctx.GAME_MODE_EASY) {
                if (KEYBOARD_LABELS) {
                    buttons[buttonCount].text = `  ${yellowEsc}&: ${whiteEsc}Easy mode  `;
                } else {
                    buttons[buttonCount].text = "  Easy mode  ";
                }
                buttons[buttonCount].hotkey = [EASY_MODE_KEY];
                buttonCount++;
            }

            buttons[buttonCount].text = `    ${darkGrayEsc}---`;
            buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
            buttonCount++;
        }

        // Shared options
        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}\\: ${whiteEsc}[${ctx.rogue.trueColorMode ? "X" : " "}] Hide color effects  `;
        } else {
            buttons[buttonCount].text = `  [${ctx.rogue.trueColorMode ? " " : "X"}] Hide color effects  `;
        }
        buttons[buttonCount].hotkey = [TRUE_COLORS_KEY];
        takeActionOurselves[buttonCount] = true;
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}]: ${whiteEsc}[${ctx.rogue.displayStealthRangeMode ? "X" : " "}] Display stealth range  `;
        } else {
            buttons[buttonCount].text = `  [${ctx.rogue.displayStealthRangeMode ? "X" : " "}] Show stealth range  `;
        }
        buttons[buttonCount].hotkey = [STEALTH_RANGE_KEY];
        takeActionOurselves[buttonCount] = true;
        buttonCount++;

        if (ctx.hasGraphics) {
            const gModeChar = " X~"[ctx.graphicsMode] ?? " ";
            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}G: ${whiteEsc}[${gModeChar}] Enable graphics  `;
            } else {
                buttons[buttonCount].text = `  [${gModeChar}] Enable graphics  `;
            }
            buttons[buttonCount].hotkey = [GRAPHICS_KEY];
            takeActionOurselves[buttonCount] = true;
            buttonCount++;
        }

        buttons[buttonCount].text = `    ${darkGrayEsc}---`;
        buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}F: ${whiteEsc}Feats             `;
        } else {
            buttons[buttonCount].text = "  Feats             ";
        }
        buttons[buttonCount].hotkey = [FEATS_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}D: ${whiteEsc}Discovered items  `;
        } else {
            buttons[buttonCount].text = "  Discovered items  ";
        }
        buttons[buttonCount].hotkey = [DISCOVERIES_KEY];

        if (ctx.DEBUG) {
            buttonCount++;
            if (KEYBOARD_LABELS) {
                buttons[buttonCount].text = `  ${yellowEsc}C: ${whiteEsc}Create item or monster  `;
            } else {
                buttons[buttonCount].text = "  Create item or monster  ";
            }
            buttons[buttonCount].hotkey = [CREATE_ITEM_MONSTER_KEY];
        }
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}~: ${whiteEsc}View dungeon seed  `;
        } else {
            buttons[buttonCount].text = "  View dungeon seed  ";
        }
        buttons[buttonCount].hotkey = [SEED_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}?: ${whiteEsc}Help  `;
            buttons[buttonCount].hotkey = [BROGUE_HELP_KEY];
            buttonCount++;
        }

        buttons[buttonCount].text = `    ${darkGrayEsc}---`;
        buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
        buttonCount++;

        if (!ctx.serverMode) {
            if (playingBack) {
                if (KEYBOARD_LABELS) {
                    buttons[buttonCount].text = `  ${yellowEsc}O: ${whiteEsc}Open saved game  `;
                } else {
                    buttons[buttonCount].text = "  Open saved game  ";
                }
                buttons[buttonCount].hotkey = [LOAD_SAVED_GAME_KEY];
                buttonCount++;

                if (KEYBOARD_LABELS) {
                    buttons[buttonCount].text = `  ${yellowEsc}V: ${whiteEsc}View saved recording  `;
                } else {
                    buttons[buttonCount].text = "  View saved recording  ";
                }
                buttons[buttonCount].hotkey = [VIEW_RECORDING_KEY];
                buttonCount++;
            } else {
                if (KEYBOARD_LABELS) {
                    buttons[buttonCount].text = `  ${yellowEsc}S: ${whiteEsc}Save and exit  `;
                } else {
                    buttons[buttonCount].text = "  Save and exit  ";
                }
                buttons[buttonCount].hotkey = [SAVE_GAME_KEY];
                buttonCount++;
            }
        }

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}Q: ${whiteEsc}Quit ${playingBack ? "to title screen" : "and abandon game"}  `;
        } else {
            buttons[buttonCount].text = `  Quit ${playingBack ? "to title screen" : "and abandon game"}  `;
        }
        buttons[buttonCount].hotkey = [QUIT_KEY];
        buttonCount++;

        buttons[buttonCount].text = " ";
        buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
        buttonCount++;

        // Compute layout
        let longestName = 0;
        for (let i = 0; i < buttonCount; i++) {
            longestName = Math.max(longestName, ctx.strLenWithoutEscapes(buttons[i].text));
        }
        if (x + longestName >= COLS) {
            x = COLS - longestName - 1;
        }
        const y = ROWS - buttonCount;
        for (let i = 0; i < buttonCount; i++) {
            buttons[i].x = x;
            buttons[i].y = y + i;
            const padLen = longestName - ctx.strLenWithoutEscapes(buttons[i].text);
            buttons[i].text += " ".repeat(padLen);
        }

        const rbuf = ctx.saveDisplayBuffer();
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.rectangularShading(x - 1, y, longestName + 2, buttonCount, black, Math.floor(INTERFACE_OPACITY / 2), dbuf);
        ctx.overlayDisplayBuffer(dbuf);
        buttonChosen = await ctx.buttonInputLoop(buttons, buttonCount, x - 1, y, longestName + 2, buttonCount, null);
        ctx.restoreDisplayBuffer(rbuf);

        if (buttonChosen === -1) {
            return -1;
        } else if (takeActionOurselves[buttonChosen]) {
            const theEvent: RogueEvent = {
                eventType: EventType.Keystroke,
                param1: buttons[buttonChosen].hotkey[0],
                param2: 0,
                shiftKey: false,
                controlKey: false,
            };
            await executeEvent(ctx, theEvent);
        } else {
            return buttons[buttonChosen].hotkey[0];
        }
    } while (takeActionOurselves[buttonChosen]);

    return -1;
}

// =============================================================================
// mainInputLoop — IO.c:537
// =============================================================================

/**
 * The main in-game input loop — draws cursor & path, gets events from
 * moveCursor, dispatches actions.
 *
 * C: `mainInputLoop` in IO.c
 */
export async function mainInputLoop(ctx: InputContext): Promise<void> {
    let oldTargetLoc: Pos = { x: 0, y: 0 };
    let steps: number;
    const path: Pos[] = new Array(1000);

    let canceled = false;
    ctx.rogue.cursorMode = false;
    steps = 0;

    ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;

    // Initialize buttons
    const buttons: BrogueButton[] = [];
    for (let i = 0; i < MAX_MENU_BUTTON_COUNT; i++) {
        buttons.push(ctx.initializeButton());
    }
    const state: ButtonState = {
        buttonFocused: -1,
        buttonDepressed: -1,
        buttonChosen: -1,
        buttonCount: 0,
        buttons: [],
        winX: 0,
        winY: 0,
        winWidth: 0,
        winHeight: 0,
    };
    initializeMenuButtons(ctx, state, buttons);

    let playingBack = ctx.rogue.playbackMode;
    ctx.rogue.playbackMode = false;

    const costMap = ctx.allocGrid();
    const playerPathingMap = ctx.allocGrid();
    const cursorSnapMap = ctx.allocGrid();

    ctx.rogue.cursorLoc = { x: -1, y: -1 };

    while (!ctx.rogue.gameHasEnded && (!playingBack || !canceled)) {
        const oldRNG = ctx.rogue.RNG;
        ctx.rogue.RNG = RNGEnum.Cosmetic;

        let focusedOnMonster = false;
        let focusedOnItem = false;
        let focusedOnTerrain = false;
        steps = 0;
        ctx.clearCursorPath();

        const originLoc: Pos = { ...ctx.player.loc };

        if (playingBack && ctx.rogue.cursorMode) {
            ctx.temporaryMessage("Examine what? (<hjklyubn>, mouse, or <tab>)", 0);
        }

        if (
            !playingBack &&
            ctx.posEq(ctx.player.loc, ctx.rogue.cursorLoc) &&
            ctx.posEq(oldTargetLoc, ctx.rogue.cursorLoc)
        ) {
            ctx.rogue.cursorMode = false;
            ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;
            ctx.rogue.cursorLoc = { x: -1, y: -1 };
        }

        oldTargetLoc = { ...ctx.rogue.cursorLoc };

        ctx.populateCreatureCostMap(costMap, ctx.player);

        ctx.fillGrid(playerPathingMap, 30000);
        playerPathingMap[ctx.player.loc.x][ctx.player.loc.y] = 0;
        ctx.dijkstraScan(playerPathingMap, costMap, true);
        ctx.processSnapMap(cursorSnapMap);

        let targetConfirmed: { value: boolean } = { value: false };
        let canceledRef: { value: boolean } = { value: false };
        let tabKey: { value: boolean } = { value: false };
        let doEvent: boolean;
        let textDisplayed: boolean;
        let theEvent: RogueEvent = {
            eventType: EventType.EventError,
            param1: 0,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        let rbuf: SavedDisplayBuffer | undefined;

        do {
            textDisplayed = false;

            // Draw the cursor and path
            if (ctx.isPosInMap(oldTargetLoc)) {
                ctx.refreshDungeonCell(oldTargetLoc);
            }
            if (!playingBack) {
                if (ctx.isPosInMap(oldTargetLoc)) {
                    ctx.hilitePath(path, steps, true);
                }
                if (ctx.isPosInMap(ctx.rogue.cursorLoc)) {
                    let pathDestination: Pos;
                    if (
                        cursorSnapMap[ctx.rogue.cursorLoc.x]?.[ctx.rogue.cursorLoc.y] >= 0 &&
                        cursorSnapMap[ctx.rogue.cursorLoc.x][ctx.rogue.cursorLoc.y] < 30000
                    ) {
                        pathDestination = { ...ctx.rogue.cursorLoc };
                    } else {
                        pathDestination = ctx.getClosestValidLocationOnMap(
                            cursorSnapMap,
                            ctx.rogue.cursorLoc.x,
                            ctx.rogue.cursorLoc.y,
                        );
                    }

                    ctx.fillGrid(playerPathingMap, 30000);
                    playerPathingMap[pathDestination.x][pathDestination.y] = 0;
                    const backupCost = costMap[pathDestination.x][pathDestination.y];
                    costMap[pathDestination.x][pathDestination.y] = 1;
                    ctx.dijkstraScan(playerPathingMap, costMap, true);
                    costMap[pathDestination.x][pathDestination.y] = backupCost;
                    steps = ctx.getPlayerPathOnMap(path, playerPathingMap, ctx.player.loc);

                    if (steps >= 0) {
                        path[steps] = pathDestination;
                    }
                    steps++;

                    if (
                        playerPathingMap[ctx.player.loc.x][ctx.player.loc.y] !== 1 ||
                        !ctx.posEq(pathDestination, ctx.rogue.cursorLoc)
                    ) {
                        ctx.hilitePath(path, steps, false);
                    }
                }
            }

            if (ctx.isPosInMap(ctx.rogue.cursorLoc)) {
                ctx.hiliteCell(
                    ctx.rogue.cursorLoc.x,
                    ctx.rogue.cursorLoc.y,
                    white,
                    steps <= 0 ||
                        ctx.posEq(path[steps - 1], ctx.rogue.cursorLoc) ||
                        (!playingBack && ctx.distanceBetween(ctx.player.loc, ctx.rogue.cursorLoc) <= 1)
                        ? 100
                        : 25,
                    true,
                );

                oldTargetLoc = { ...ctx.rogue.cursorLoc };

                const monst = ctx.monsterAtLoc(ctx.rogue.cursorLoc);
                const theItem = ctx.itemAtLoc(ctx.rogue.cursorLoc);

                if (monst != null && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience)) {
                    ctx.rogue.playbackMode = playingBack;
                    ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                    ctx.rogue.playbackMode = false;

                    focusedOnMonster = true;
                    if (
                        monst !== ctx.player &&
                        (!ctx.player.status[ctx.STATUS_HALLUCINATING] ||
                            ctx.rogue.playbackOmniscience ||
                            ctx.player.status[ctx.STATUS_TELEPATHIC])
                    ) {
                        rbuf = ctx.saveDisplayBuffer();
                        ctx.printMonsterDetails(monst);
                        textDisplayed = true;
                    }
                } else if (
                    theItem != null &&
                    ctx.playerCanSeeOrSense(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y)
                ) {
                    ctx.rogue.playbackMode = playingBack;
                    ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                    ctx.rogue.playbackMode = false;

                    focusedOnItem = true;
                    if (!ctx.player.status[ctx.STATUS_HALLUCINATING] || ctx.rogue.playbackOmniscience) {
                        rbuf = ctx.saveDisplayBuffer();
                        ctx.printFloorItemDetails(theItem);
                        textDisplayed = true;
                    }
                } else if (
                    ctx.cellHasTMFlag(ctx.rogue.cursorLoc, ctx.TM_LIST_IN_SIDEBAR) &&
                    ctx.playerCanSeeOrSense(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y)
                ) {
                    ctx.rogue.playbackMode = playingBack;
                    ctx.refreshSideBar(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y, false);
                    ctx.rogue.playbackMode = false;
                    focusedOnTerrain = true;
                }

                ctx.printLocationDescription(ctx.rogue.cursorLoc.x, ctx.rogue.cursorLoc.y);
            }

            // Get the input!
            ctx.rogue.playbackMode = playingBack;
            const cursorLocRef = { value: { ...ctx.rogue.cursorLoc } };
            const theEventRef = { value: theEvent };
            doEvent = ctx.moveCursor(
                targetConfirmed,
                canceledRef,
                tabKey,
                cursorLocRef,
                theEventRef,
                state,
                !textDisplayed,
                ctx.rogue.cursorMode,
                true,
            );
            ctx.rogue.cursorLoc = cursorLocRef.value;
            theEvent = theEventRef.value;
            ctx.rogue.playbackMode = false;

            if (state.buttonChosen === 3) {
                // Actions menu button
                const buttonInput = await actionMenu(ctx, buttons[3].x - 4, playingBack);
                if (buttonInput === -1) {
                    doEvent = false;
                } else {
                    theEvent = {
                        eventType: EventType.Keystroke,
                        param1: buttonInput,
                        param2: 0,
                        shiftKey: false,
                        controlKey: false,
                    };
                    doEvent = true;
                }
            } else if (state.buttonChosen > -1) {
                theEvent = {
                    eventType: EventType.Keystroke,
                    param1: buttons[state.buttonChosen].hotkey[0],
                    param2: 0,
                    shiftKey: false,
                    controlKey: false,
                };
            }
            state.buttonChosen = -1;
            canceled = canceledRef.value;

            if (playingBack) {
                if (canceled) {
                    ctx.rogue.cursorMode = false;
                    ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;
                }
                if (
                    theEvent.eventType === EventType.Keystroke &&
                    theEvent.param1 === ACKNOWLEDGE_KEY
                ) {
                    canceled = true;
                } else {
                    canceled = false;
                }
            }

            if (focusedOnMonster || focusedOnItem || focusedOnTerrain) {
                focusedOnMonster = false;
                focusedOnItem = false;
                focusedOnTerrain = false;
                if (textDisplayed && rbuf) {
                    ctx.restoreDisplayBuffer(rbuf);
                }
                ctx.rogue.playbackMode = playingBack;
                ctx.refreshSideBar(-1, -1, false);
                ctx.rogue.playbackMode = false;
            }

            if (tabKey.value && !playingBack) {
                const newLoc = { value: { x: 0, y: 0 } };
                if (ctx.nextTargetAfter(null, newLoc, ctx.rogue.cursorLoc, ctx.AUTOTARGET_MODE_EXPLORE, theEvent.shiftKey)) {
                    ctx.rogue.cursorLoc = newLoc.value;
                }
            }

            if (
                theEvent.eventType === EventType.Keystroke &&
                ((theEvent.param1 === ASCEND_KEY &&
                    ctx.rogue.cursorLoc.x === ctx.rogue.upLoc.x &&
                    ctx.rogue.cursorLoc.y === ctx.rogue.upLoc.y) ||
                    (theEvent.param1 === DESCEND_KEY &&
                        ctx.rogue.cursorLoc.x === ctx.rogue.downLoc.x &&
                        ctx.rogue.cursorLoc.y === ctx.rogue.downLoc.y))
            ) {
                targetConfirmed.value = true;
                doEvent = false;
            }
        } while (!targetConfirmed.value && !canceled && !doEvent && !ctx.rogue.gameHasEnded);

        if (ctx.isPosInMap(oldTargetLoc)) {
            ctx.refreshDungeonCell(oldTargetLoc);
        }

        // Restore RNG
        ctx.rogue.RNG = oldRNG;

        if (canceled && !playingBack) {
            ctx.hideCursor();
            ctx.confirmMessages();
        } else if (targetConfirmed.value && !playingBack && ctx.isPosInMap(ctx.rogue.cursorLoc)) {
            if (
                theEvent.eventType === EventType.MouseUp &&
                theEvent.controlKey &&
                steps > 1
            ) {
                // Control-click: move one step along the path
                let dir: number;
                for (dir = 0; dir < Direction.DirectionCount; dir++) {
                    const nx = ctx.player.loc.x + ctx.nbDirs[dir][0];
                    const ny = ctx.player.loc.y + ctx.nbDirs[dir][1];
                    if (path[0] && nx === path[0].x && ny === path[0].y) {
                        break;
                    }
                }
                if (dir < Direction.DirectionCount) {
                    ctx.playerMoves(dir);
                }
            } else if (ctx.D_WORMHOLING) {
                ctx.travel(ctx.rogue.cursorLoc, true);
            } else {
                ctx.confirmMessages();
                if (ctx.posEq(originLoc, ctx.rogue.cursorLoc)) {
                    ctx.confirmMessages();
                } else if (
                    Math.abs(ctx.player.loc.x - ctx.rogue.cursorLoc.x) +
                        Math.abs(ctx.player.loc.y - ctx.rogue.cursorLoc.y) === 1 ||
                    (ctx.distanceBetween(ctx.player.loc, ctx.rogue.cursorLoc) === 1 &&
                        (!ctx.diagonalBlocked(
                            ctx.player.loc.x,
                            ctx.player.loc.y,
                            ctx.rogue.cursorLoc.x,
                            ctx.rogue.cursorLoc.y,
                            !ctx.rogue.playbackOmniscience,
                        ) ||
                            ((ctx.pmapFlagsAt(ctx.rogue.cursorLoc) & ctx.HAS_MONSTER) !== 0 &&
                                ctx.monsterAtLoc(ctx.rogue.cursorLoc) != null &&
                                (ctx.monsterAtLoc(ctx.rogue.cursorLoc)!.info.flags & ctx.MONST_ATTACKABLE_THRU_WALLS) !== 0) ||
                            ((ctx.terrainFlags(ctx.rogue.cursorLoc) & ctx.T_OBSTRUCTS_PASSABILITY) !== 0 &&
                                (ctx.terrainMechFlags(ctx.rogue.cursorLoc) & ctx.TM_PROMOTES_ON_PLAYER_ENTRY) !== 0)))
                ) {
                    // Adjacent cell — move directly
                    let dir: number;
                    for (dir = 0; dir < Direction.DirectionCount; dir++) {
                        if (
                            ctx.player.loc.x + ctx.nbDirs[dir][0] === ctx.rogue.cursorLoc.x &&
                            ctx.player.loc.y + ctx.nbDirs[dir][1] === ctx.rogue.cursorLoc.y
                        ) {
                            break;
                        }
                    }
                    if (dir < Direction.DirectionCount) {
                        ctx.playerMoves(dir);
                    }
                } else if (steps) {
                    ctx.travelRoute(path, steps);
                }
            }
        } else if (doEvent) {
            if (playingBack) {
                ctx.rogue.playbackMode = true;
                ctx.executePlaybackInput(theEvent);
                playingBack = ctx.rogue.playbackMode;
                ctx.rogue.playbackMode = false;
            } else {
                await executeEvent(ctx, theEvent);
                if (ctx.rogue.playbackMode) {
                    playingBack = true;
                    ctx.rogue.playbackMode = false;
                    ctx.confirmMessages();
                    break;
                }
            }
        }
    }

    ctx.rogue.playbackMode = playingBack;
    ctx.refreshSideBar(-1, -1, false);
    ctx.freeGrid(costMap);
    ctx.freeGrid(playerPathingMap);
    ctx.freeGrid(cursorSnapMap);
}
