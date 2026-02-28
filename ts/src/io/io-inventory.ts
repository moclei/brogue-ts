/*
 *  io-inventory.ts — Inventory display, text box, and rectangular shading
 *  brogue-ts
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
import { ItemCategory, PRENAMED_CATEGORY, ALL_ITEMS } from "../types/enums.js";
import { ButtonDrawState } from "../types/enums.js";
import {
    COLS,
    ROWS,
    DCOLS,
    DROWS,
    KEYBOARD_LABELS,
    MAX_PACK_ITEMS,
    INTERFACE_OPACITY,
    ESCAPE_KEY,
    ACKNOWLEDGE_KEY,
    UP_KEY,
    DOWN_KEY,
    APPLY_KEY,
    EQUIP_KEY,
    UNEQUIP_KEY,
    DROP_KEY,
    THROW_KEY,
    RELABEL_KEY,
    CALL_KEY,
    UP_ARROW,
    DOWN_ARROW,
    NUMPAD_2,
    NUMPAD_8,
} from "../types/constants.js";
import { ButtonFlag } from "../types/flags.js";
import { ItemFlag } from "../types/flags.js";

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
    ): { chosenButton: number; event: RogueEvent };

    // -- Sidebar detail panels ------------------------------------------------

    printCarriedItemDetails(
        theItem: Item,
        x: number,
        y: number,
        width: number,
        includeButtons: boolean,
    ): number;

    // -- Text & item naming ---------------------------------------------------

    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string;
    upperCase(s: string): string;
    itemMagicPolarity(theItem: Item): number;
    numberOfItemsInPack(): number;
    clearCursorPath(): void;

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
export function printTextBox(
    textBuf: string,
    x: number,
    y: number,
    width: number,
    foreColor: Readonly<Color>,
    backColor: Readonly<Color>,
    ctx: InventoryContext,
    buttons?: BrogueButton[],
    buttonCount?: number,
): number {
    let x2: number;
    let y2: number;
    const bCount = buttonCount ?? 0;

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
        const result = ctx.buttonInputLoop(buttons, bCount, x2, y2, width, (y2 + lineCount + 1 + padLines) - y2);
        return result.chosenButton;
    } else {
        return -1;
    }
}

// =============================================================================
// displayInventory — Items.c:2770
// =============================================================================

/**
 * Display the inventory screen. Returns the inventory letter of the chosen
 * item (e.g. `"a"`), or `""` if the user cancels or acts on an item directly.
 *
 * C: `displayInventory` in Items.c (~360 lines)
 */
export function displayInventory(
    categoryMask: number,
    requiredFlags: number,
    forbiddenFlags: number,
    waitForAcknowledge: boolean,
    includeButtons: boolean,
    ctx: InventoryContext,
): string {
    ctx.clearCursorPath();

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);

    // Build color escape sequences
    const whiteColorEsc = ctx.encodeMessageColor(ctx.white);
    const grayColorEsc = ctx.encodeMessageColor(ctx.gray);
    const yellowColorEsc = ctx.encodeMessageColor(ctx.itemColor);
    const darkItemColor: Color = { ...ctx.itemColor };
    ctx.applyColorAverage(darkItemColor, ctx.black, 50);
    const darkYellowColorEsc = ctx.encodeMessageColor(darkItemColor);
    const goodColorEsc = ctx.encodeMessageColor(ctx.goodMessageColor);
    const badColorEsc = ctx.encodeMessageColor(ctx.badMessageColor);

    // Check if pack is empty
    if (ctx.packItems.length === 0) {
        ctx.confirmMessages();
        ctx.message("Your pack is empty!", 0);
        return "";
    }

    // Check for any magic-detected items
    let magicDetected = false;
    for (const theItem of ctx.packItems) {
        if (displayMagicCharForItem(theItem) && (theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED)) {
            magicDetected = true;
        }
    }

    // Build ordered item list: equipped first, then non-equipped
    const itemList: Item[] = [];
    let equippedItemCount = 0;

    if (ctx.rogue.weapon) {
        itemList.push(ctx.rogue.weapon);
        equippedItemCount++;
    }
    if (ctx.rogue.armor) {
        itemList.push(ctx.rogue.armor);
        equippedItemCount++;
    }
    if (ctx.rogue.ringLeft) {
        itemList.push(ctx.rogue.ringLeft);
        equippedItemCount++;
    }
    if (ctx.rogue.ringRight) {
        itemList.push(ctx.rogue.ringRight);
        equippedItemCount++;
    }

    for (const theItem of ctx.packItems) {
        if (!(theItem.flags & ItemFlag.ITEM_EQUIPPED)) {
            itemList.push(theItem);
        }
    }

    const itemNumber = itemList.length;

    // Initialize buttons
    const buttons: BrogueButton[] = [];
    for (let i = 0; i < Math.max(MAX_PACK_ITEMS, ROWS); i++) {
        buttons[i] = {
            text: "",
            x: 0,
            y: ctx.mapToWindowY(i + (equippedItemCount && i >= equippedItemCount ? 1 : 0)),
            hotkey: [],
            buttonColor: { ...ctx.black },
            textColor: { ...ctx.white },
            hotkeyTextColor: { ...ctx.white },
            opacity: INTERFACE_OPACITY,
            symbol: [],
            flags: ButtonFlag.B_DRAW,
            command: 0 as any,
        };
    }

    const closeParen = KEYBOARD_LABELS ? ")" : " ";

    // Set up item buttons
    let maxLength = 0;
    for (let i = 0; i < itemNumber; i++) {
        const theItem = itemList[i];

        buttons[i].flags |= (ButtonFlag.B_DRAW | ButtonFlag.B_GRADIENT | ButtonFlag.B_ENABLED);
        if (!waitForAcknowledge) {
            buttons[i].flags |= ButtonFlag.B_KEYPRESS_HIGHLIGHT;
        }
        buttons[i].hotkey = [
            theItem.inventoryLetter.charCodeAt(0),
            theItem.inventoryLetter.charCodeAt(0) + "A".charCodeAt(0) - "a".charCodeAt(0),
        ];

        if (
            (theItem.category & categoryMask) &&
            !(~theItem.flags & requiredFlags) &&
            !(theItem.flags & forbiddenFlags)
        ) {
            buttons[i].flags |= ButtonFlag.B_HOVER_ENABLED;
        }

        // Build item name
        let buf = ctx.itemName(theItem, true, true);
        buf = ctx.upperCase(buf);

        const isHoverEnabled = !!(buttons[i].flags & ButtonFlag.B_HOVER_ENABLED);
        const letter = KEYBOARD_LABELS ? String.fromCharCode(theItem.inventoryLetter) : " ";
        const protectedChar = (theItem.flags & ItemFlag.ITEM_PROTECTED) ? "}" : closeParen;
        const equippedSuffix = (theItem.flags & ItemFlag.ITEM_EQUIPPED)
            ? (theItem.category & ItemCategory.WEAPON ? " (in hand) " : " (worn) ")
            : "";

        if (
            (theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) &&
            !(theItem.category & ItemCategory.AMULET)
        ) {
            const polarity = ctx.itemMagicPolarity(theItem);
            let magicEsc: string;
            if (polarity === 0) {
                buttons[i].symbol[0] = "-".charCodeAt(0) as DisplayGlyph;
                magicEsc = yellowColorEsc;
            } else if (polarity === 1) {
                buttons[i].symbol[0] = ctx.G_GOOD_MAGIC;
                magicEsc = goodColorEsc;
            } else {
                buttons[i].symbol[0] = ctx.G_BAD_MAGIC;
                magicEsc = badColorEsc;
            }

            // Two symbols: magic indicator and item glyph
            buttons[i].text =
                ` ${letter}${protectedChar} ${magicEsc}* ` +
                `${isHoverEnabled ? yellowColorEsc : darkYellowColorEsc}* ` +
                `${isHoverEnabled ? whiteColorEsc : grayColorEsc}${buf}` +
                `${grayColorEsc}${equippedSuffix}`;
            buttons[i].symbol[1] = theItem.displayChar;
        } else {
            // Single symbol: item glyph
            buttons[i].text =
                ` ${letter}${protectedChar} ` +
                `${magicDetected ? "  " : ""}` +
                `${isHoverEnabled ? yellowColorEsc : darkYellowColorEsc}* ` +
                `${isHoverEnabled ? whiteColorEsc : grayColorEsc}${buf}` +
                `${grayColorEsc}${equippedSuffix}`;
            buttons[i].symbol[0] = theItem.displayChar;
        }

        maxLength = Math.max(maxLength, ctx.strLenWithoutEscapes(buttons[i].text));
    }

    const itemCount = itemNumber;
    if (itemCount === 0) {
        ctx.confirmMessages();
        ctx.message("Nothing of that type!", 0);
        return "";
    }

    // Add extra info lines
    let extraLineCount = 0;
    if (waitForAcknowledge) {
        const itemSpaceRemaining = MAX_PACK_ITEMS - ctx.numberOfItemsInPack();
        if (itemSpaceRemaining > 0) {
            buttons[itemNumber + extraLineCount].text =
                `${grayColorEsc}${magicDetected ? "  " : ""}    You have room for ${itemSpaceRemaining} more item${itemSpaceRemaining === 1 ? "" : "s"}.`;
        } else {
            buttons[itemNumber + extraLineCount].text =
                `${grayColorEsc}${magicDetected ? "  " : ""}    Your pack is full.`;
        }
        maxLength = Math.max(maxLength, ctx.strLenWithoutEscapes(buttons[itemNumber + extraLineCount].text));
        extraLineCount++;

        buttons[itemNumber + extraLineCount].text = KEYBOARD_LABELS
            ? `${grayColorEsc}${magicDetected ? "  " : ""} -- press (a-z) for more info -- `
            : `${grayColorEsc}${magicDetected ? "  " : ""} -- touch an item for more info -- `;
        maxLength = Math.max(maxLength, ctx.strLenWithoutEscapes(buttons[itemNumber + extraLineCount].text));
        extraLineCount++;
    }

    if (equippedItemCount > 0) {
        buttons[itemNumber + extraLineCount].text =
            `      ${magicDetected ? "  " : ""}${grayColorEsc}---`;
        buttons[itemNumber + extraLineCount].y = ctx.mapToWindowY(equippedItemCount);
        extraLineCount++;
    }

    // Position and pad all buttons
    for (let i = 0; i < itemNumber + extraLineCount; i++) {
        buttons[i].x = COLS - maxLength;

        // Pad with spaces to right edge
        const visibleLen = ctx.strLenWithoutEscapes(buttons[i].text);
        const neededSpaces = COLS - (buttons[i].x + visibleLen);
        if (neededSpaces > 0) {
            buttons[i].text += " ".repeat(neededSpaces);
        }

        ctx.drawButton(buttons[i], ButtonDrawState.Normal, dbuf);
    }

    // Add invisible up/down arrow buttons
    buttons[itemNumber + extraLineCount + 0] = {
        ...buttons[0],
        text: "",
        flags: ButtonFlag.B_ENABLED,
        hotkey: [NUMPAD_8, UP_ARROW],
        symbol: [],
    };
    buttons[itemNumber + extraLineCount + 1] = {
        ...buttons[0],
        text: "",
        flags: ButtonFlag.B_ENABLED,
        hotkey: [NUMPAD_2, DOWN_ARROW],
        symbol: [],
    };

    const rbuf = ctx.saveDisplayBuffer();
    ctx.overlayDisplayBuffer(dbuf);

    let theKey = "";
    let repeatDisplay: boolean;

    do {
        repeatDisplay = false;

        let highlightItemLine = -1;
        ctx.restoreDisplayBuffer(rbuf);

        const loopResult = ctx.buttonInputLoop(
            buttons,
            itemCount + extraLineCount + 2,
            COLS - maxLength,
            ctx.mapToWindowY(0),
            maxLength,
            itemNumber + extraLineCount,
        );
        highlightItemLine = loopResult.chosenButton;
        const theEvent = loopResult.event;

        // Handle up/down key navigation
        if (highlightItemLine === itemNumber + extraLineCount + 0) {
            highlightItemLine = itemNumber - 1;
            theEvent.shiftKey = true;
        } else if (highlightItemLine === itemNumber + extraLineCount + 1) {
            highlightItemLine = 0;
            theEvent.shiftKey = true;
        }

        if (highlightItemLine >= 0 && highlightItemLine < itemNumber) {
            theKey = itemList[highlightItemLine].inventoryLetter;
        } else {
            theKey = "";
        }

        // Was an item selected for detail view?
        if (highlightItemLine > -1 && highlightItemLine < itemNumber &&
            (waitForAcknowledge || theEvent.shiftKey || theEvent.controlKey)) {

            let actionKey: number;
            let currentHighlight = highlightItemLine;

            do {
                ctx.overlayDisplayBuffer(dbuf);
                ctx.drawButton(buttons[currentHighlight], ButtonDrawState.Pressed, null);

                if (theEvent.shiftKey || theEvent.controlKey || waitForAcknowledge) {
                    actionKey = ctx.printCarriedItemDetails(
                        itemList[currentHighlight],
                        Math.max(2, ctx.mapToWindowX(DCOLS - maxLength - 42)),
                        ctx.mapToWindowY(2),
                        40,
                        includeButtons,
                    );

                    ctx.restoreDisplayBuffer(rbuf);

                    if (actionKey === -1) {
                        repeatDisplay = true;
                        ctx.overlayDisplayBuffer(dbuf);
                    } else {
                        repeatDisplay = false;
                        ctx.restoreDisplayBuffer(rbuf);
                    }

                    switch (actionKey) {
                        case APPLY_KEY:
                        case EQUIP_KEY:
                        case UNEQUIP_KEY:
                        case DROP_KEY:
                        case THROW_KEY:
                        case RELABEL_KEY:
                        case CALL_KEY:
                            // Action taken directly — will return 0
                            break;
                        case UP_KEY:
                            currentHighlight--;
                            if (currentHighlight < 0) currentHighlight = itemNumber - 1;
                            break;
                        case DOWN_KEY:
                            currentHighlight++;
                            if (currentHighlight >= itemNumber) currentHighlight = 0;
                            break;
                        default:
                            break;
                    }

                    if (actionKey === UP_KEY || actionKey === DOWN_KEY) {
                        theKey = itemList[currentHighlight].inventoryLetter;
                    } else if (actionKey > -1) {
                        // Player took an action directly from the item screen
                        ctx.restoreDisplayBuffer(rbuf);
                        return "";
                    }
                } else {
                    actionKey = -1;
                }
            } while (actionKey === UP_KEY || actionKey === DOWN_KEY);
        }
    } while (repeatDisplay);

    ctx.restoreDisplayBuffer(rbuf);

    return theKey;
}
