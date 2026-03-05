/*
 *  ui.ts — UI context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildDisplayContext(), buildMessageContext(),
 *  buildInventoryContext(), and buildButtonContext().
 *
 *  These context builders close over shared state from core.ts and provide
 *  the DI contexts expected by the io/ functions.  All display/rendering
 *  callbacks are stubbed here — they will be wired to real platform
 *  implementations in port-v2-platform.
 *
 *  IMPORTANT: buildButtonContext().nextBrogueEvent must always return a
 *  Promise<RogueEvent>, never a synchronous value.  This is the async bridge
 *  contract enforced by the test suite.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "./items/item-generation.js";
import { numberOfItemsInPack as numberOfItemsInPackFn } from "./items/item-inventory.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";
import { mapToWindowX, mapToWindowY } from "./globals/tables.js";
import { white, gray, black } from "./globals/colors.js";
import { EventType, DisplayGlyph } from "./types/enums.js";
import { COLS, ROWS } from "./types/constants.js";
import type { ItemTable } from "./types/types.js";
import type {
    MessageState, ScreenDisplayBuffer, CellDisplayBuffer, SavedDisplayBuffer,
    RogueEvent, BrogueButton, Item, Color, Pos, WindowPos, PauseBehavior,
} from "./types/types.js";

// =============================================================================
// Private helpers
// =============================================================================

function makeBlankBuffer(): ScreenDisplayBuffer {
    const cells: CellDisplayBuffer[][] = new Array(COLS);
    for (let i = 0; i < COLS; i++) {
        cells[i] = new Array(ROWS);
        for (let j = 0; j < ROWS; j++) {
            cells[i][j] = {
                character: 32 as DisplayGlyph,
                foreColorComponents: [0, 0, 0],
                backColorComponents: [0, 0, 0],
                opacity: 0,
            };
        }
    }
    return { cells };
}

function fakeEvent(): RogueEvent {
    return {
        eventType: EventType.EventError,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };
}

// =============================================================================
// Context interfaces
// =============================================================================

/** Context for display / cell rendering operations. Wired in port-v2-platform. */
export interface DisplayContext {
    rogue: {
        displayStealthRangeMode: boolean;
        trueColorMode: boolean;
    };
    displayBuffer: ScreenDisplayBuffer;
    refreshDungeonCell(loc: Pos): void;
    refreshSideBar(x: number, y: number, forceFullUpdate: boolean): void;
    plotCharWithColor(ch: number, pos: WindowPos, fg: Readonly<Color>, bg: Readonly<Color>): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    updateFlavorText(): void;
}

/** Context for message archive, display, and interaction. */
export interface MessageContext {
    rogue: {
        playerTurnNumber: number;
        cautiousMode: boolean;
        disturbed: boolean;
        autoPlayingLevel: boolean;
        playbackMode: boolean;
        playbackOOS: boolean;
        playbackDelayThisTurn: number;
        playbackDelayPerTurn: number;
        playbackFastForward: boolean;
    };
    messageState: MessageState;
    displayBuffer: ScreenDisplayBuffer;
    plotCharWithColor(ch: number, pos: WindowPos, fg: Readonly<Color>, bg: Readonly<Color>): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    refreshSideBar(x: number, y: number, forceFullUpdate: boolean): void;
    refreshDungeonCell(loc: Pos): void;
    waitForAcknowledgment(): void;
    pauseBrogue(ms: number, behavior: PauseBehavior): Promise<boolean>;
    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInput: boolean): Promise<RogueEvent>;
    flashTemporaryAlert(msg: string, ms: number): void;
    updateFlavorText(): void;
    stripShiftFromMovementKeystroke(keystroke: number): number;
}

/** Context for inventory display. */
export interface InventoryContext {
    rogue: {
        weapon: Item | null;
        armor: Item | null;
        ringLeft: Item | null;
        ringRight: Item | null;
        strength: number;
    };
    packItems: Item[];
    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string;
    itemMagicPolarity(theItem: Item): number;
    numberOfItemsInPack(): number;
    message(msg: string, flags: number): void;
    confirmMessages(): void;
    buttonInputLoop(
        buttons: BrogueButton[],
        buttonCount: number,
        winX: number,
        winY: number,
        winWidth: number,
        winHeight: number,
    ): Promise<{ chosenButton: number; event: RogueEvent }>;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    apply(theItem: Item): void | Promise<void>;
    equip(theItem: Item): void | Promise<void>;
    unequip(theItem: Item): void | Promise<void>;
    drop(theItem: Item): void | Promise<void>;
    throwCommand(theItem: Item, confirmed: boolean): void | Promise<void>;
    relabel(theItem: Item): void | Promise<void>;
    call(theItem: Item): void | Promise<void>;
    white: Readonly<Color>;
    gray: Readonly<Color>;
    black: Readonly<Color>;
}

/**
 * Context for the button input system.
 *
 * nextBrogueEvent MUST return Promise<RogueEvent> — not a synchronous value.
 * This is the async bridge contract for the browser platform.
 */
export interface ButtonContext {
    rogue: {
        playbackMode: boolean;
        playbackPaused: boolean;
    };
    applyColorAverage(base: Color, target: Readonly<Color>, weight: number): void;
    bakeColor(color: Color): void;
    separateColors(foreColor: Color, backColor: Color): void;
    strLenWithoutEscapes(s: string): number;
    decodeMessageColor(msg: string, i: number): { color: Color; nextIndex: number };
    encodeMessageColor(theColor: Readonly<Color>): string;
    plotCharToBuffer(
        inputChar: number,
        x: number,
        y: number,
        fg: Readonly<Color>,
        bg: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): void;
    locIsInWindow(pos: { windowX: number; windowY: number }): boolean;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    nextBrogueEvent(
        textInput: boolean,
        colorsDance: boolean,
        realInputEvenInPlayback: boolean,
    ): Promise<RogueEvent>;
    pauseBrogue(milliseconds: number): Promise<boolean>;
    pauseAnimation(milliseconds: number): Promise<boolean>;
}

// =============================================================================
// buildDisplayContext
// =============================================================================

/**
 * Build a DisplayContext backed by the current game state.
 *
 * All display callbacks are stubbed — they will be wired to real canvas/
 * terminal rendering in port-v2-platform.
 */
export function buildDisplayContext(): DisplayContext {
    const { rogue, displayBuffer } = getGameState();
    return {
        rogue,
        displayBuffer,
        refreshDungeonCell: () => {},                         // stub — port-v2-platform
        refreshSideBar: () => {},                             // stub — port-v2-platform
        plotCharWithColor: () => {},                          // stub — port-v2-platform
        overlayDisplayBuffer: () => {},                       // stub — port-v2-platform
        saveDisplayBuffer: () => ({ savedScreen: displayBuffer }),
        restoreDisplayBuffer: () => {},                       // stub — port-v2-platform
        clearDisplayBuffer: () => {},                         // stub — port-v2-platform
        createScreenDisplayBuffer: makeBlankBuffer,
        updateFlavorText: () => {},                           // stub — port-v2-platform
    };
}

// =============================================================================
// buildMessageContext
// =============================================================================

/**
 * Build a MessageContext backed by the current game state.
 *
 * The messageState and rogue state are real; all rendering callbacks are
 * stubbed and will be wired in port-v2-platform.
 */
export function buildMessageContext(): MessageContext {
    const { rogue, messageState, displayBuffer } = getGameState();
    return {
        rogue,
        messageState,
        displayBuffer,
        plotCharWithColor: () => {},                          // stub — port-v2-platform
        overlayDisplayBuffer: () => {},                       // stub — port-v2-platform
        saveDisplayBuffer: () => ({ savedScreen: displayBuffer }),
        restoreDisplayBuffer: () => {},                       // stub — port-v2-platform
        refreshSideBar: () => {},                             // stub — port-v2-platform
        refreshDungeonCell: () => {},                         // stub — port-v2-platform
        waitForAcknowledgment: () => {},                      // stub — port-v2-platform
        pauseBrogue: async () => false,                       // stub — port-v2-platform
        nextBrogueEvent: async () => fakeEvent(),             // stub — port-v2-platform
        flashTemporaryAlert: () => {},                        // stub — port-v2-platform
        updateFlavorText: () => {},                           // stub — port-v2-platform
        stripShiftFromMovementKeystroke: (k) => k,
    };
}

// =============================================================================
// buildInventoryContext
// =============================================================================

/**
 * Build an InventoryContext backed by the current game state.
 *
 * item naming and polarity queries are wired to real implementations.
 * Display, button loop, and item action callbacks are stubbed.
 */
export function buildInventoryContext(): InventoryContext {
    const { rogue, packItems, displayBuffer, mutablePotionTable, mutableScrollTable, gameConst } = getGameState();
    const namingCtx = {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: () => "creature",
    };
    return {
        rogue,
        packItems,
        itemName: (item, includeDetails, includeArticle) =>
            itemNameFn(item, includeDetails, includeArticle, namingCtx),
        itemMagicPolarity: (item) => itemMagicPolarityFn(item),
        numberOfItemsInPack: () =>
            numberOfItemsInPackFn(packItems),
        message: () => {},                                    // stub — port-v2-platform
        confirmMessages: () => {},                            // stub — port-v2-platform
        buttonInputLoop: async () => ({ chosenButton: -1, event: fakeEvent() }), // stub
        overlayDisplayBuffer: () => {},                       // stub — port-v2-platform
        saveDisplayBuffer: () => ({ savedScreen: displayBuffer }),
        restoreDisplayBuffer: () => {},                       // stub — port-v2-platform
        clearDisplayBuffer: () => {},                         // stub — port-v2-platform
        createScreenDisplayBuffer: makeBlankBuffer,
        mapToWindowX,
        mapToWindowY,
        apply: () => {},                                      // stub — port-v2-platform
        equip: () => {},                                      // stub — port-v2-platform
        unequip: () => {},                                    // stub — port-v2-platform
        drop: () => {},                                       // stub — port-v2-platform
        throwCommand: () => {},                               // stub — port-v2-platform
        relabel: () => {},                                    // stub — port-v2-platform
        call: () => {},                                       // stub — port-v2-platform
        white,
        gray,
        black,
    };
}

// =============================================================================
// buildButtonContext
// =============================================================================

/**
 * Build a ButtonContext backed by the current game state.
 *
 * nextBrogueEvent, pauseBrogue, and pauseAnimation are always async
 * (returning Promise<RogueEvent> / Promise<boolean>).  This is the async
 * bridge contract required by the browser platform.
 *
 * All rendering and color callbacks are stubbed; they will be wired in
 * port-v2-platform.
 */
export function buildButtonContext(): ButtonContext {
    const { rogue, displayBuffer } = getGameState();
    return {
        rogue: {
            playbackMode: rogue.playbackMode,
            playbackPaused: rogue.playbackPaused,
        },
        // -- Color stubs (wired in port-v2-platform) --------------------------
        applyColorAverage: () => {},                          // stub
        bakeColor: () => {},                                  // stub
        separateColors: () => {},                             // stub
        strLenWithoutEscapes: (s) => s.length,               // minimal stub
        decodeMessageColor: (_msg, i) => ({
            color: { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            nextIndex: i + 4,
        }),                                                   // stub
        encodeMessageColor: () => "",                         // stub
        // -- Rendering stubs (wired in port-v2-platform) ----------------------
        plotCharToBuffer: () => {},                           // stub
        locIsInWindow: () => false,                           // stub
        createScreenDisplayBuffer: makeBlankBuffer,
        clearDisplayBuffer: () => {},                         // stub
        overlayDisplayBuffer: () => {},                       // stub
        saveDisplayBuffer: () => ({ savedScreen: displayBuffer }),
        restoreDisplayBuffer: () => {},                       // stub
        // -- Async bridge: these MUST return Promises -------------------------
        nextBrogueEvent: async () => fakeEvent(),
        pauseBrogue: async () => false,
        pauseAnimation: async () => false,
    };
}
