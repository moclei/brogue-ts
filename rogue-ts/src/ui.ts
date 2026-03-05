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
import { apply as applyFn } from "./items/item-handlers.js";
import { buildItemHandlerContext } from "./items.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";
import { mapToWindowX, mapToWindowY } from "./globals/tables.js";
import { white, gray, black } from "./globals/colors.js";
import { EventType } from "./types/enums.js";
import type { ItemTable } from "./types/types.js";
import type {
    MessageState, ScreenDisplayBuffer, SavedDisplayBuffer,
    RogueEvent, BrogueButton, Item, Color, Pos, WindowPos, PauseBehavior,
} from "./types/types.js";
// IO layer — pure functions that don't need the dungeon appearance system
import {
    plotCharWithColor as plotCharWithColorFn,
    plotCharToBuffer as plotCharToBufferFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    overlayDisplayBuffer as overlayDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    locIsInWindow as locIsInWindowFn,
} from "./io/display.js";
import {
    applyColorAverage as applyColorAverageFn,
    bakeColor as bakeColorFn,
    separateColors as separateColorsFn,
} from "./io/color.js";
import {
    encodeMessageColor as encodeMessageColorFn,
    decodeMessageColor as decodeMessageColorFn,
} from "./io/color.js";
import { strLenWithoutEscapes as strLenWithoutEscapesFn } from "./io/text.js";

// =============================================================================
// Private helpers
// =============================================================================

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
 * Pure display-buffer operations are wired to io/display.ts.
 * refreshDungeonCell, refreshSideBar, and updateFlavorText require the
 * dungeon appearance system and remain stubbed until Phase 7.
 */
export function buildDisplayContext(): DisplayContext {
    const { rogue, displayBuffer } = getGameState();
    return {
        rogue,
        displayBuffer,
        refreshDungeonCell: () => {},                         // stub — needs appearance system
        refreshSideBar: () => {},                             // stub — needs appearance system
        plotCharWithColor: (ch, pos, fg, bg) =>
            { plotCharWithColorFn(ch, pos, fg, bg, displayBuffer); },
        overlayDisplayBuffer: (dbuf) => overlayDisplayBufferFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        clearDisplayBuffer: clearDisplayBufferFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        updateFlavorText: () => {},                           // stub — needs appearance system
    };
}

// =============================================================================
// buildMessageContext
// =============================================================================

/**
 * Build a MessageContext backed by the current game state.
 *
 * Pure display-buffer operations are wired to io/display.ts.
 * refreshDungeonCell, refreshSideBar, updateFlavorText, flashTemporaryAlert,
 * waitForAcknowledgment, and nextBrogueEvent require either the dungeon
 * appearance system or the async event bridge and remain stubbed until Phase 7.
 */
export function buildMessageContext(): MessageContext {
    const { rogue, messageState, displayBuffer } = getGameState();
    return {
        rogue,
        messageState,
        displayBuffer,
        plotCharWithColor: (ch, pos, fg, bg) =>
            { plotCharWithColorFn(ch, pos, fg, bg, displayBuffer); },
        overlayDisplayBuffer: (dbuf) => overlayDisplayBufferFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        refreshSideBar: () => {},                             // stub — needs appearance system
        refreshDungeonCell: () => {},                         // stub — needs appearance system
        waitForAcknowledgment: () => {},                      // stub — sync/async bridge (Phase 7)
        pauseBrogue: async () => false,                       // stub — sync/async bridge (Phase 7)
        nextBrogueEvent: async () => fakeEvent(),             // stub — sync/async bridge (Phase 7)
        flashTemporaryAlert: () => {},                        // stub — needs appearance system
        updateFlavorText: () => {},                           // stub — needs appearance system
        stripShiftFromMovementKeystroke: (k) => k,
    };
}

// =============================================================================
// buildInventoryContext
// =============================================================================

/**
 * Build an InventoryContext backed by the current game state.
 *
 * Item naming, polarity, apply action, and display-buffer operations are
 * wired to real implementations.  Button loop, message, equip/unequip/drop/
 * throw/relabel/call dialogs remain stubbed until the button and dialog
 * systems are fully wired in Phase 7.
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
        message: () => {},                                    // stub — needs message context wiring
        confirmMessages: () => {},                            // stub — needs message context wiring
        buttonInputLoop: async () => ({ chosenButton: -1, event: fakeEvent() }), // stub — Phase 7
        overlayDisplayBuffer: (dbuf) => overlayDisplayBufferFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        clearDisplayBuffer: clearDisplayBufferFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        mapToWindowX,
        mapToWindowY,
        apply: (item) => { applyFn(item, buildItemHandlerContext()); },
        equip: async () => {},                                // stub — dialog not yet ported
        unequip: async () => {},                              // stub — dialog not yet ported
        drop: async () => {},                                 // stub — dialog not yet ported
        throwCommand: async () => {},                         // stub — dialog not yet ported
        relabel: async () => {},                              // stub — dialog not yet ported
        call: async () => {},                                 // stub — dialog not yet ported
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
 * Color, text, and display-buffer operations are wired to real io/ functions.
 * The async event bridge (nextBrogueEvent, pauseBrogue, pauseAnimation) remains
 * stubbed until Phase 7 when the browser platform is fully wired.
 */
export function buildButtonContext(): ButtonContext {
    const { rogue, displayBuffer } = getGameState();
    return {
        rogue: {
            playbackMode: rogue.playbackMode,
            playbackPaused: rogue.playbackPaused,
        },
        // -- Color / text ops wired to io/color.ts and io/text.ts -------------
        applyColorAverage: applyColorAverageFn,
        bakeColor: bakeColorFn,
        separateColors: separateColorsFn,
        strLenWithoutEscapes: strLenWithoutEscapesFn,
        decodeMessageColor: decodeMessageColorFn,
        encodeMessageColor: encodeMessageColorFn,
        // -- Rendering ops wired to io/display.ts -----------------------------
        plotCharToBuffer: plotCharToBufferFn,
        locIsInWindow: locIsInWindowFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        clearDisplayBuffer: clearDisplayBufferFn,
        overlayDisplayBuffer: (dbuf) => overlayDisplayBufferFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        // -- Async bridge: these MUST return Promises -------------------------
        // Real event dispatch wired in Phase 7 when browser platform is connected.
        nextBrogueEvent: async () => fakeEvent(),
        pauseBrogue: async () => false,
        pauseAnimation: async () => false,
    };
}
