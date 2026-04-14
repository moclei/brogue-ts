/*
 *  ui-inventory.ts — buildInventoryContext factory
 *  Port V2 — rogue-ts
 *
 *  Extracted from ui.ts to keep that file under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
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
import { DisplayGlyph, ItemCategory } from "./types/enums.js";
import { ItemFlag, ButtonFlag } from "./types/flags.js";
import {
    COLS, ROWS, INTERFACE_OPACITY, KEYBOARD_LABELS,
    APPLY_KEY, EQUIP_KEY, UNEQUIP_KEY, DROP_KEY, THROW_KEY, RELABEL_KEY, CALL_KEY,
    UP_KEY, DOWN_KEY, UP_ARROW, DOWN_ARROW, NUMPAD_8, NUMPAD_2,
} from "./types/constants.js";
import type { ItemTable } from "./types/types.js";
import type { Color } from "./types/types.js";
import {
    applyColorAverage as applyColorAverageFn,
    storeColorComponents as storeColorComponentsFn,
    encodeMessageColor as encodeMessageColorFn,
} from "./io/color.js";
import {
    strLenWithoutEscapes as strLenWithoutEscapesFn,
    printStringWithWrapping as printStringWithWrappingFn,
    wrapText as wrapTextFn,
    upperCase as upperCaseFn,
} from "./io/text.js";
import {
    message as messageFn,
    messageWithColor as messageWithColorFn,
    confirmMessages as confirmMessagesFn,
} from "./io/messages.js";
import { buildThrowCommandFn, buildCallCommandFn } from "./items/item-commands.js";
import { itemCanBeCalled } from "./items/item-utils.js";
import type { MessageContext as SyncMessageContext } from "./io/messages-state.js";
import type { InventoryContext as FullInventoryContext } from "./io/inventory.js";
import {
    plotCharToBuffer as plotCharToBufferFn,
    applyOverlay as applyOverlayFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
} from "./io/display.js";
import { buildMessageContext, buildButtonContext } from "./ui.js";
import { isDOMModalEnabled, showTextBoxModal } from "./platform/ui-modal.js";
import type { ModalButton } from "./platform/ui-modal.js";
import { stripColorEscapes } from "./io/inventory.js";

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
        throwCommand: (() => {
            const mc = buildMessageContext() as unknown as SyncMessageContext;
            const deps = {
                message: (msg: string, flags: number) => messageFn(mc, msg, flags),
                messageWithColor: (msg: string, color: Readonly<Color> | null, flags: number) =>
                    messageWithColorFn(mc, msg, color ?? white, flags),
                confirmMessages: () => confirmMessagesFn(mc),
            };
            return buildThrowCommandFn(deps);
        })(),
        relabel: (item) => relabelFn(item),
        call: (() => {
            const mc = buildMessageContext() as unknown as SyncMessageContext;
            const deps = {
                message: (msg: string, flags: number) => messageFn(mc, msg, flags),
                messageWithColor: (msg: string, color: Readonly<Color> | null, flags: number) =>
                    messageWithColorFn(mc, msg, color ?? white, flags),
                confirmMessages: () => confirmMessagesFn(mc),
            };
            return buildCallCommandFn(deps);
        })(),
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
                    if (itemCanBeCalled(theItem)) {
                        bs.push(mkBtn(`   ${keyEsc}c${whiteEsc}all    `, CALL_KEY));
                    }
                    bs.push(mkBtn(`  ${keyEsc}R${whiteEsc}elabel  `, RELABEL_KEY));
                }
                return bs;
            })() : [];

            // DOM path: show item text + action buttons in a modal, bypassing buffer rendering.
            if (isDOMModalEnabled()) {
                const modalBtns: ModalButton[] = actionButtons.map(btn => ({
                    label: stripColorEscapes(btn.text),
                    hotkeys: [...btn.hotkey].filter(k => k > 0),
                }));
                const idx = await showTextBoxModal(textBuf, modalBtns);
                if (idx === -1) return -1;
                return actionButtons[idx]?.hotkey[0] ?? -1;
            }

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
