/*
 *  inventory.ts — Inventory context, text box, and rectangular shading
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c (printTextBox, rectangularShading) and
 *               src/brogue/Items.c (displayInventory, displayMagicCharForItem)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    BrogueButton,
    ScreenDisplayBuffer,
    RogueEvent,
    SavedDisplayBuffer,
    Item,
} from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { PRENAMED_CATEGORY } from "../types/enums.js";
import { ButtonDrawState } from "../types/enums.js";
import {
    COLS,
    ROWS,
    DCOLS,
    INTERFACE_OPACITY,
} from "../types/constants.js";
import { ButtonFlag } from "../types/flags.js";
import { ItemFlag } from "../types/flags.js";
import { isDOMModalEnabled, showTextBoxModal } from "../platform/ui-modal.js";
import type { ModalButton } from "../platform/ui-modal.js";

// =============================================================================
// Constants
// =============================================================================

const MIN_DEFAULT_INFO_PANEL_WIDTH = 33;

// =============================================================================
// DI Context
// =============================================================================

export interface InventoryContext {
    rogue: {
        weapon: Item | null;
        armor: Item | null;
        ringLeft: Item | null;
        ringRight: Item | null;
    };

    /** Sentinel-headed pack list (packItems.nextItem is first real item). */
    packItems: Item[];

    // -- Color ----------------------------------------------------------------

    applyColorAverage(base: Color, target: Readonly<Color>, weight: number): void;
    encodeMessageColor(theColor: Readonly<Color>): string;
    storeColorComponents(theColor: Readonly<Color>): [number, number, number];

    // -- Rendering ------------------------------------------------------------

    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;

    drawButton(button: BrogueButton, highlight: ButtonDrawState, dbuf: ScreenDisplayBuffer | null): void;

    plotCharToBuffer(
        inputChar: DisplayGlyph,
        x: number,
        y: number,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): void;

    printStringWithWrapping(
        theString: string,
        x: number,
        y: number,
        width: number,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): number;

    strLenWithoutEscapes(s: string): number;

    wrapText(sourceText: string, width: number): { text: string; lineCount: number };

    // -- Button loop ----------------------------------------------------------

    buttonInputLoop(
        buttons: BrogueButton[],
        buttonCount: number,
        winX: number,
        winY: number,
        winWidth: number,
        winHeight: number,
    ): Promise<{ chosenButton: number; event: RogueEvent }>;

    // -- Sidebar detail panels ------------------------------------------------

    printCarriedItemDetails(
        theItem: Item,
        x: number,
        y: number,
        width: number,
        includeButtons: boolean,
    ): number | Promise<number>;

    // -- Text & item naming ---------------------------------------------------

    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string;
    upperCase(s: string): string;
    itemMagicPolarity(theItem: Item): number;
    numberOfItemsInPack(): number;
    clearCursorPath(): void;

    // -- Item actions (dispatched from item detail panel) --------------------

    apply(theItem: Item): void | Promise<void>;
    equip(theItem: Item): void | Promise<void>;
    unequip(theItem: Item): void | Promise<void>;
    drop(theItem: Item): void | Promise<void>;
    throwCommand(theItem: Item, confirmed: boolean): void | Promise<void>;
    relabel(theItem: Item): void | Promise<void>;
    call(theItem: Item): void | Promise<void>;

    // -- Messages -------------------------------------------------------------

    confirmMessages(): void;
    message(msg: string, flags: number): void;

    // -- Coordinate mapping ---------------------------------------------------

    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;

    // -- Colors ---------------------------------------------------------------

    white: Readonly<Color>;
    gray: Readonly<Color>;
    black: Readonly<Color>;
    itemColor: Readonly<Color>;
    goodMessageColor: Readonly<Color>;
    badMessageColor: Readonly<Color>;
    interfaceBoxColor: Readonly<Color>;

    // -- Glyphs ---------------------------------------------------------------

    G_GOOD_MAGIC: DisplayGlyph;
    G_BAD_MAGIC: DisplayGlyph;
}

// =============================================================================
// DOM helpers
// =============================================================================

import { COLOR_ESCAPE } from "../types/constants.js";

/** Strip Brogue color escape sequences from a button label for DOM display. */
export function stripColorEscapes(s: string): string {
    let out = "";
    let i = 0;
    while (i < s.length) {
        if (s.charCodeAt(i) === COLOR_ESCAPE) {
            i += 4; // skip escape + 3 color bytes
        } else {
            out += s[i];
            i++;
        }
    }
    return out.trim();
}

// =============================================================================
// displayMagicCharForItem — Items.c:2761
// =============================================================================

/**
 * Whether an item should display a magic-detection symbol in the inventory.
 *
 * C: `displayMagicCharForItem` (static) in Items.c
 */
export function displayMagicCharForItem(theItem: Item): boolean {
    if (!(theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) ||
        (theItem.category & PRENAMED_CATEGORY)) {
        return false;
    }
    return true;
}

// =============================================================================
// rectangularShading — IO.c:4919
// =============================================================================

/**
 * Apply a shaded rectangle to a display buffer, with falloff outside the rectangle.
 *
 * C: `rectangularShading` in IO.c
 */
export function rectangularShading(
    x: number,
    y: number,
    width: number,
    height: number,
    backColor: Readonly<Color>,
    opacity: number,
    dbuf: ScreenDisplayBuffer,
    ctx: Pick<InventoryContext, "storeColorComponents">,
): void {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const components = ctx.storeColorComponents(backColor);
            dbuf.cells[i][j].backColorComponents = components;

            if (i >= x && i < x + width && j >= y && j < y + height) {
                dbuf.cells[i][j].opacity = Math.min(100, opacity);
            } else {
                let dist = 0;
                dist += Math.max(0, Math.max(x - i, i - x - width + 1));
                dist += Math.max(0, Math.max(y - j, j - y - height + 1));
                dbuf.cells[i][j].opacity = Math.trunc((opacity - 10) / Math.max(1, dist));
                if (dbuf.cells[i][j].opacity < 3) {
                    dbuf.cells[i][j].opacity = 0;
                }
            }
        }
    }
}

// =============================================================================
// printTextBox — IO.c:4964
// =============================================================================

/**
 * Render a text box with optional shading and button loop.
 *
 * If `width <= 0`, x and width are auto-calculated based on the x position
 * relative to the map center.
 *
 * If buttons are provided, runs a button input loop and returns the chosen
 * button index. Otherwise returns -1.
 *
 * C: `printTextBox` in IO.c
 */
export async function printTextBox(
    textBuf: string,
    x: number,
    y: number,
    width: number,
    foreColor: Readonly<Color>,
    backColor: Readonly<Color>,
    ctx: InventoryContext,
    buttons?: BrogueButton[],
    buttonCount?: number,
): Promise<number> {
    const bCount = buttonCount ?? 0;

    // DOM path: replace buffer rendering with HTML modal.
    if (isDOMModalEnabled()) {
        const modalButtons: ModalButton[] = [];
        if (bCount > 0 && buttons) {
            for (let i = 0; i < bCount; i++) {
                if (buttons[i].flags & ButtonFlag.B_DRAW) {
                    modalButtons.push({
                        label: stripColorEscapes(buttons[i].text),
                        hotkeys: [...buttons[i].hotkey].filter(k => k > 0),
                    });
                } else {
                    // Keep index alignment even for non-drawn buttons.
                    modalButtons.push({ label: "", hotkeys: [...buttons[i].hotkey].filter(k => k > 0) });
                }
            }
        }
        return showTextBoxModal(textBuf, modalButtons);
    }

    let x2: number;
    let y2: number;

    if (width <= 0) {
        // Auto-calculate y and width
        if (x < DCOLS / 2 - 1) {
            x2 = ctx.mapToWindowX(x + 10);
            width = (DCOLS - x) - 20;
        } else {
            x2 = ctx.mapToWindowX(10);
            width = x - 20;
        }
        y2 = ctx.mapToWindowY(2);

        if (width < MIN_DEFAULT_INFO_PANEL_WIDTH) {
            x2 -= Math.trunc((MIN_DEFAULT_INFO_PANEL_WIDTH - width) / 2);
            width = MIN_DEFAULT_INFO_PANEL_WIDTH;
        }
    } else {
        y2 = y;
        x2 = x;
    }

    // Widen text box if it doesn't fit
    let lineCount = ctx.wrapText(textBuf, width).lineCount;
    while (lineCount + y2 >= ROWS - 2 && width < COLS - 5) {
        width++;
        if (x2 + Math.trunc(width / 2) > Math.trunc(COLS / 2)) {
            x2--;
        }
        lineCount = ctx.wrapText(textBuf, width).lineCount;
    }

    let padLines: number;
    if (bCount > 0 && buttons) {
        padLines = 2;
        let bx = x2 + width;
        let by = y2 + lineCount + 1;
        for (let i = 0; i < bCount; i++) {
            if (buttons[i].flags & ButtonFlag.B_DRAW) {
                bx -= ctx.strLenWithoutEscapes(buttons[i].text) + 2;
                buttons[i].x = bx;
                buttons[i].y = by;
                if (bx < x2) {
                    bx = x2 + width - (ctx.strLenWithoutEscapes(buttons[i].text) + 2);
                    by += 2;
                    padLines += 2;
                    buttons[i].x = bx;
                    buttons[i].y = by;
                }
            }
        }
    } else {
        padLines = 0;
    }

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);
    ctx.printStringWithWrapping(textBuf, x2, y2, width, foreColor, backColor, dbuf);
    rectangularShading(x2, y2, width, lineCount + padLines, backColor, INTERFACE_OPACITY, dbuf, ctx);
    ctx.overlayDisplayBuffer(dbuf);

    if (bCount > 0 && buttons) {
        const result = await ctx.buttonInputLoop(buttons, bCount, x2, y2, width, (y2 + lineCount + 1 + padLines) - y2);
        return result.chosenButton;
    } else {
        return -1;
    }
}
