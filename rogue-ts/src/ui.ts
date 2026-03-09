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
import { waitForEvent, commitDraws } from "./platform.js";
import { buttonInputLoop as buttonInputLoopFn, drawButton as drawButtonFn, initializeButton as initializeButtonFn } from "./io/buttons.js";
import { equip as equipFn, unequip as unequipFn, drop as dropFn, relabel as relabelFn } from "./io/inventory-actions.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "./items/item-generation.js";
import { numberOfItemsInPack as numberOfItemsInPackFn } from "./items/item-inventory.js";
import { apply as applyFn } from "./items/item-handlers.js";
import { buildItemHandlerContext } from "./items.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";
import { mapToWindowX, mapToWindowY } from "./globals/tables.js";
import { white, gray, black, itemColor, goodMessageColor, badMessageColor, interfaceBoxColor, itemMessageColor } from "./globals/colors.js";
import { EventType, DisplayGlyph, ItemCategory } from "./types/enums.js";
import { ItemFlag, ButtonFlag } from "./types/flags.js";
import {
    COLS, ROWS, INTERFACE_OPACITY, KEYBOARD_LABELS,
    APPLY_KEY, EQUIP_KEY, UNEQUIP_KEY, DROP_KEY, THROW_KEY, RELABEL_KEY,
    UP_KEY, DOWN_KEY, UP_ARROW, DOWN_ARROW, NUMPAD_8, NUMPAD_2,
} from "./types/constants.js";
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
    applyOverlay as applyOverlayFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    locIsInWindow as locIsInWindowFn,
} from "./io/display.js";
import {
    applyColorAverage as applyColorAverageFn,
    bakeColor as bakeColorFn,
    separateColors as separateColorsFn,
    storeColorComponents as storeColorComponentsFn,
    encodeMessageColor as encodeMessageColorFn,
    decodeMessageColor as decodeMessageColorFn,
} from "./io/color.js";
import {
    strLenWithoutEscapes as strLenWithoutEscapesFn,
    printStringWithWrapping as printStringWithWrappingFn,
    wrapText as wrapTextFn,
    upperCase as upperCaseFn,
} from "./io/text.js";
import {
    message as messageFn,
    confirmMessages as confirmMessagesFn,
} from "./io/messages.js";
import type { MessageContext as SyncMessageContext } from "./io/messages-state.js";
import type { InventoryContext as FullInventoryContext } from "./io/inventory.js";

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
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
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
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
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
export function buildInventoryContext(): FullInventoryContext {
    const { rogue, pmap, packItems, displayBuffer, mutablePotionTable, mutableScrollTable, gameConst } = getGameState();
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
        message: (() => {
            const mc = buildMessageContext() as unknown as SyncMessageContext;
            return (msg: string, flags: number) => messageFn(mc, msg, flags);
        })(),
        confirmMessages: (() => {
            const mc = buildMessageContext() as unknown as SyncMessageContext;
            return () => confirmMessagesFn(mc);
        })(),
        buttonInputLoop: (buttons, count, winX, winY, winWidth, winHeight) =>
            buttonInputLoopFn(buttons, count, winX, winY, winWidth, winHeight, buildButtonContext()),
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        clearDisplayBuffer: clearDisplayBufferFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        mapToWindowX,
        mapToWindowY,
        apply: (item) => applyFn(item, buildItemHandlerContext()),
        equip: (item) => equipFn(item),
        unequip: (item) => unequipFn(item),
        drop: (item) => dropFn(item),
        throwCommand: async () => {                           // stub — Phase 8 (needs chooseTarget)
            const mc = buildMessageContext() as unknown as SyncMessageContext;
            messageFn(mc, "Throwing not yet implemented.", 0);
        },
        relabel: (item) => relabelFn(item),
        call: async () => {},                                 // stub — Phase 8 (needs getInputTextString)
        white,
        gray,
        black,
        // ── Color / text ops ─────────────────────────────────────────────────
        applyColorAverage: applyColorAverageFn,
        encodeMessageColor: encodeMessageColorFn,
        storeColorComponents: storeColorComponentsFn,
        upperCase: upperCaseFn,
        strLenWithoutEscapes: strLenWithoutEscapesFn,
        wrapText: wrapTextFn,
        printStringWithWrapping: printStringWithWrappingFn,
        // ── Rendering ops ────────────────────────────────────────────────────
        plotCharToBuffer: plotCharToBufferFn,
        drawButton: (button, highlight, dbuf) =>
            drawButtonFn(button, highlight, dbuf, buildButtonContext()),
        // ── Item detail panel ────────────────────────────────────────────────
        // Ported from C: printCarriedItemDetails → printTextBox (IO.c:4964)
        printCarriedItemDetails: async (theItem, x, y, width, includeButtons) => {
            const textBuf = itemNameFn(theItem, true, true, namingCtx);
            const bgColor = { ...black, red: 5, green: 5, blue: 20 };

            // Build action buttons matching C's printCarriedItemDetails setup.
            const whiteEsc = encodeMessageColorFn(white);
            const keyEsc   = encodeMessageColorFn(itemMessageColor);
            const mkBtn = (text: string, key: number) => {
                const b = initializeButtonFn();
                b.flags |= ButtonFlag.B_WIDE_CLICK_AREA;
                b.text = text;
                b.hotkey = [key];
                return b;
            };
            const actionButtons = includeButtons ? (() => {
                const bs = [];
                if (theItem.category & (ItemCategory.FOOD | ItemCategory.SCROLL | ItemCategory.POTION | ItemCategory.WAND | ItemCategory.STAFF | ItemCategory.CHARM)) {
                    bs.push(mkBtn(`   ${keyEsc}a${whiteEsc}pply   `, APPLY_KEY));
                }
                if (theItem.category & (ItemCategory.ARMOR | ItemCategory.WEAPON | ItemCategory.RING)) {
                    if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
                        bs.push(mkBtn(`  ${keyEsc}r${whiteEsc}emove   `, UNEQUIP_KEY));
                    } else {
                        bs.push(mkBtn(`   ${keyEsc}e${whiteEsc}quip   `, EQUIP_KEY));
                    }
                }
                bs.push(mkBtn(`   ${keyEsc}d${whiteEsc}rop    `, DROP_KEY));
                bs.push(mkBtn(`   ${keyEsc}t${whiteEsc}hrow   `, THROW_KEY));
                if (KEYBOARD_LABELS) {
                    bs.push(mkBtn(`  ${keyEsc}R${whiteEsc}elabel  `, RELABEL_KEY));
                }
                return bs;
            })() : [];

            // Invisible up/down navigation buttons (C: printCarriedItemDetails).
            const navUp   = initializeButtonFn();
            navUp.flags   = ButtonFlag.B_ENABLED;
            navUp.text    = "";
            navUp.hotkey  = [UP_KEY, NUMPAD_8, UP_ARROW];
            navUp.symbol  = [];
            const navDown = initializeButtonFn();
            navDown.flags = ButtonFlag.B_ENABLED;
            navDown.text  = "";
            navDown.hotkey = [DOWN_KEY, NUMPAD_2, DOWN_ARROW];
            navDown.symbol = [];

            // Compute button positions below text (C: printTextBox layout).
            let padLines = 0;
            if (actionButtons.length > 0) {
                padLines = 2;
                let bx = x + width;
                let by = y + 999; // placeholder until we know lastY
                // We'll fix by after computing lastY; store relative offset for now.
                actionButtons.forEach(btn => {
                    if (btn.flags & ButtonFlag.B_DRAW) {
                        bx -= strLenWithoutEscapesFn(btn.text) + 2;
                        btn.x = bx;
                        btn.y = by; // will be overwritten below
                        if (bx < x) {
                            bx = x + width - (strLenWithoutEscapesFn(btn.text) + 2);
                            by += 2;
                            padLines += 2;
                            btn.x = bx;
                            btn.y = by;
                        }
                    }
                });
            }

            // Render text to buffer; lastY is the bottom of the wrapped text.
            const dbuf = createScreenDisplayBufferFn();
            clearDisplayBufferFn(dbuf);
            const lastY = printStringWithWrappingFn(textBuf, x, y, width, white, bgColor, dbuf);

            // Fix button y positions now that we know lastY.
            if (actionButtons.length > 0) {
                const baseBy = lastY + 2;
                // Recompute properly with correct baseBy
                let bx2 = x + width;
                let by2 = baseBy;
                padLines = 2;
                actionButtons.forEach(btn => {
                    if (btn.flags & ButtonFlag.B_DRAW) {
                        bx2 -= strLenWithoutEscapesFn(btn.text) + 2;
                        btn.x = bx2;
                        btn.y = by2;
                        if (bx2 < x) {
                            bx2 = x + width - (strLenWithoutEscapesFn(btn.text) + 2);
                            by2 += 2;
                            padLines += 2;
                            btn.x = bx2;
                            btn.y = by2;
                        }
                    }
                });
            }

            // Set opacity on full box (text + button rows) — C: rectangularShading.
            for (let ci = x; ci < x + width && ci < COLS; ci++) {
                for (let cj = y; cj <= lastY + padLines && cj < ROWS; cj++) {
                    dbuf.cells[ci][cj].opacity = INTERFACE_OPACITY;
                }
            }
            applyOverlayFn(displayBuffer, dbuf);

            // buttonInputLoop handles drawing + input; nav buttons let arrow keys page.
            const allButtons = [...actionButtons, navUp, navDown];
            const loopHeight = lastY - y + 1 + padLines;
            const result = await buttonInputLoopFn(
                allButtons, allButtons.length,
                x, y, width, loopHeight,
                buildButtonContext(),
            );
            const chosen = allButtons[result.chosenButton];
            return chosen ? (chosen.hotkey[0] ?? -1) : -1;
        },
        // ── Cursor path ──────────────────────────────────────────────────────
        clearCursorPath: () => {
            if (!rogue.playbackMode) {
                for (let i = 0; i < pmap.length; i++) {
                    for (let j = 0; j < pmap[i].length; j++) {
                        pmap[i][j].flags &= ~0x100000;        // IS_IN_PATH = Fl(20)
                    }
                }
            }
        },
        // ── Colors ───────────────────────────────────────────────────────────
        itemColor,
        goodMessageColor,
        badMessageColor,
        interfaceBoxColor,
        // ── Glyphs ───────────────────────────────────────────────────────────
        G_GOOD_MAGIC: DisplayGlyph.G_GOOD_MAGIC,
        G_BAD_MAGIC: DisplayGlyph.G_BAD_MAGIC,
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
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        // -- Async bridge: these MUST return Promises -------------------------
        // waitForEvent() throws when platform not initialised (tests); fall back
        // to an escape keystroke so button loops terminate cleanly.
        nextBrogueEvent: async () => {
            try { commitDraws(); return await waitForEvent(); } catch {
                return { eventType: EventType.Keystroke, param1: 0x1b, param2: 0, controlKey: false, shiftKey: false };
            }
        },
        pauseBrogue: async () => false,
        pauseAnimation: async () => false,
    };
}
