/*
 *  io/input-keystrokes.ts — Shared input interfaces and event infrastructure
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/io/io-input.ts (lines 1–541)
 *  Source C: src/brogue/IO.c
 *  Functions: stripShiftFromMovementKeystroke, considerCautiousMode,
 *             pauseBrogue, pauseAnimation, nextBrogueEvent, nextKeyPress,
 *             waitForAcknowledgment, waitForKeystrokeOrMouseClick
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
import { EventType } from "../types/enums.js";
import {
    UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    ACKNOWLEDGE_KEY, ESCAPE_KEY,
    DEFAULT_PLAYBACK_DELAY,
} from "../types/constants.js";
import { PAUSE_BEHAVIOR_DEFAULT } from "../types/types.js";

// =============================================================================
// Shared state slice used by all input functions
// =============================================================================

export interface InputRogueState {
    mode: number;
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
    sidebarLocationList: Pos[];
    upLoc: Pos;
    downLoc: Pos;
    playerTurnNumber: number;
    nextGame: number;
    lastItemThrown: Item | null;
    creaturesWillFlashThisTurn: boolean;
}

// =============================================================================
// Full DI context — covers all input dispatch functions across all input files
// =============================================================================

export interface InputContext {
    rogue: InputRogueState;
    player: Creature;

    DEBUG: boolean;
    serverMode: boolean;
    hasGraphics: boolean;
    graphicsMode: number;
    nonInteractivePlayback: boolean;
    D_WORMHOLING: boolean;
    D_SAFETY_VISION: boolean;
    D_SCENT_VISION: boolean;
    displayedMessage: string[];
    messagesUnconfirmed: number;
    GAME_MODE_EASY: number;

    // Coordinate helpers
    posEq(a: Pos, b: Pos): boolean;
    isPosInMap(pos: Pos): boolean;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    windowToMap(w: WindowPos): Pos;
    windowToMapX(x: number): number;
    distanceBetween(a: Pos, b: Pos): number;

    // Color / text helpers
    encodeMessageColor(theColor: Readonly<Color>): string;
    strLenWithoutEscapes(s: string): number;
    printString(str: string, x: number, y: number, foreColor: Readonly<Color>, backColor: Readonly<Color>, dbuf: ScreenDisplayBuffer | null): void;
    plotCharWithColor(inputChar: DisplayGlyph, pos: WindowPos, foreColor: Readonly<Color>, backColor: Readonly<Color>): void;

    // Messages
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;
    temporaryMessage(msg: string, flags: number): void;
    confirmMessages(): void;
    updateMessageDisplay(): void;

    // Display buffers
    commitDraws(): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;

    // Buttons
    initializeButton(): BrogueButton;
    initializeButtonState(state: ButtonState, buttons: BrogueButton[], count: number, winX: number, winY: number, winWidth: number, winHeight: number): void;
    buttonInputLoop(buttons: BrogueButton[], count: number, winX: number, winY: number, winWidth: number, winHeight: number, event: RogueEvent | null): number | Promise<number>;

    // Text box
    printTextBox(text: string, x: number, y: number, width: number, foreColor: Readonly<Color>, backColor: Readonly<Color>, buttons: BrogueButton[], buttonCount: number): number | Promise<number>;
    rectangularShading(x: number, y: number, width: number, height: number, color: Readonly<Color>, opacity: number, dbuf: ScreenDisplayBuffer): void;

    // Events / timing
    pauseForMilliseconds(milliseconds: number, behavior: PauseBehavior): boolean;
    nextKeyOrMouseEvent(textInput: boolean, colorsDance: boolean): RogueEvent;
    locIsInWindow(pos: WindowPos): boolean;

    // Display
    displayLevel(): void;
    refreshSideBar(x: number, y: number, justClearing: boolean): void;
    displayInventory(categoryMask: number, titleFlags: number, focusFlags: number, includeDetails: boolean, includeButtons: boolean): void | Promise<void>;
    displayMessageArchive(): void;
    printHelpScreen(): void | Promise<void>;
    displayFeatsScreen(): void | Promise<void>;
    printDiscoveriesScreen(): void | Promise<void>;
    flashTemporaryAlert(msg: string, time: number): void;
    displayMonsterFlashes(flashAll: boolean): void;
    setGraphicsMode(mode: number): number;

    // Game actions
    playerMoves(direction: number): void;
    playerRuns(direction: number): void;
    playerTurnEnded(): void | Promise<void>;
    autoRest(): void | Promise<void>;
    manualSearch(): void | Promise<void>;
    travel(loc: Pos, autoConfirm: boolean): void | Promise<void>;
    travelRoute(path: Pos[], steps: number): void | Promise<void>;
    equip(item: Item | null): void | Promise<void>;
    unequip(item: Item | null): void | Promise<void>;
    drop(item: Item | null): void | Promise<void>;
    apply(item: Item | null): void | Promise<void>;
    throwCommand(item: Item | null, confirmed: boolean): void | Promise<void>;
    relabel(item: Item | null): void | Promise<void>;
    call(item: Item | null): void | Promise<void>;
    swapLastEquipment(): void;
    enableEasyMode(): void | Promise<void>;
    saveGame(): void;
    gameOver(message: string, showHighScores: boolean): void;
    printSeed(): void;
    showCursor(): void;
    hideCursor(): void;
    exploreKey(controlKey: boolean): void | Promise<void>;
    autoPlayLevel(controlKey: boolean): void | Promise<void>;
    useStairs(delta: number): void;
    takeScreenshot(): boolean;
    itemIsCarried(item: Item): boolean;
    dialogCreateItemOrMonster(): void;

    // Sidebar focus
    monsterAtLoc(loc: Pos): Creature | null;
    itemAtLoc(loc: Pos): Item | null;
    canSeeMonster(monst: Creature): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;
    cellHasTMFlag(loc: Pos, flag: number): boolean;
    printMonsterDetails(monst: Creature): void;
    printFloorItemDetails(item: Item): void;
    printLocationDescription(x: number, y: number): void;

    // Targeting / cursor
    moveCursor(
        targetConfirmed: { value: boolean },
        canceled: { value: boolean },
        tabKey: { value: boolean },
        cursorLoc: { value: Pos },
        theEvent: { value: RogueEvent },
        state: ButtonState,
        colorsDance: boolean,
        keysMoveCursor: boolean,
        targetCanLeaveMap: boolean,
    ): Promise<boolean>;
    nextTargetAfter(theItem: Item | null, outLoc: { value: Pos }, currentLoc: Pos, mode: number, reverse: boolean): boolean;
    hilitePath(path: Pos[], steps: number, unhilite: boolean): void;
    clearCursorPath(): void;
    hiliteCell(x: number, y: number, color: Readonly<Color>, opacity: number, flash: boolean): void;
    refreshDungeonCell(loc: Pos): void;

    // Pathing
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

    // Recordings
    recordKeystroke(keystroke: number, controlKey: boolean, shiftKey: boolean): void;
    recallEvent(): RogueEvent;
    executePlaybackInput(event: RogueEvent): boolean;
    proposeOrConfirmLocation(loc: Pos, failMsg: string): boolean;
    characterForbiddenInFilename(char: string): boolean;

    // Debug
    safetyMap: number[][] | null;
    displayGrid(grid: number[][]): void;
    displayLoops(): void;
    displayChokeMap(): void;
    displayMachines(): void;
    displayWaypoints(): void;

    // Constants
    AUTOTARGET_MODE_EXPLORE: number;
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
    nbDirs: number[][];
}

// =============================================================================
// stripShiftFromMovementKeystroke — IO.c:3658
// =============================================================================

/**
 * If the keystroke is the uppercase version of a movement key (Shift held),
 * convert it to the lowercase equivalent.
 */
export function stripShiftFromMovementKeystroke(keystroke: number): number {
    const newKey = keystroke - ("A".charCodeAt(0) - "a".charCodeAt(0));
    if (
        newKey === LEFT_KEY || newKey === RIGHT_KEY ||
        newKey === DOWN_KEY || newKey === UP_KEY ||
        newKey === UPLEFT_KEY || newKey === UPRIGHT_KEY ||
        newKey === DOWNLEFT_KEY || newKey === DOWNRIGHT_KEY
    ) {
        return newKey;
    }
    return keystroke;
}

// =============================================================================
// considerCautiousMode — IO.c:840
// =============================================================================

/** Placeholder — the original implementation was commented-out in C. */
export function considerCautiousMode(_ctx: InputContext): void {
    // The C implementation was entirely commented out.
}

// =============================================================================
// pauseBrogue — IO.c:2367
// =============================================================================

/**
 * Pause for the given milliseconds, checking for interruption every 50 ms.
 * Returns true if the user interrupted.
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
 * Same as pauseBrogue, but during playback the delay scales according
 * to playback speed.
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
 * Get the next event — either from playback recording or from real user input.
 */
export function nextBrogueEvent(
    ctx: InputContext,
    textInput: boolean,
    colorsDance: boolean,
    realInputEvenInPlayback: boolean,
): RogueEvent {
    let returnEvent: RogueEvent = {
        eventType: EventType.EventError,
        param1: 0, param2: 0,
        controlKey: false, shiftKey: false,
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

/** Block until the user presses a key; return its code. */
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

/** Block until the user presses space / escape / clicks. */
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

/** Block until any key or mouse click. */
export function waitForKeystrokeOrMouseClick(ctx: InputContext): void {
    let theEvent: RogueEvent;
    do {
        theEvent = nextBrogueEvent(ctx, false, false, false);
    } while (
        theEvent.eventType !== EventType.Keystroke &&
        theEvent.eventType !== EventType.MouseUp
    );
}
