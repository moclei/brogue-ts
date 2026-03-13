/*
 *  inventory-display.ts — displayInventory function
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Items.c (displayInventory ~360 lines)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Item, BrogueButton } from "../types/types.js";
import { type DisplayGlyph, ItemCategory, ALL_ITEMS } from "../types/enums.js";
import { ButtonDrawState } from "../types/enums.js";
import {
    COLS,
    KEYBOARD_LABELS,
    MAX_PACK_ITEMS,
    ROWS,
    INTERFACE_OPACITY,
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
    ESCAPE_KEY,
    ACKNOWLEDGE_KEY,
} from "../types/constants.js";
import { ButtonFlag, ItemFlag } from "../types/flags.js";
import {
    type InventoryContext,
    displayMagicCharForItem,
} from "./inventory.js";

// =============================================================================
// displayInventory — Items.c:2770
// =============================================================================

/**
 * Display the inventory screen. Returns the inventory letter of the chosen
 * item (e.g. `"a"`), or `""` if the user cancels or acts on an item directly.
 *
 * C: `displayInventory` in Items.c (~360 lines)
 */
export async function displayInventory(
    categoryMask: number,
    requiredFlags: number,
    forbiddenFlags: number,
    waitForAcknowledge: boolean,
    includeButtons: boolean,
    ctx: InventoryContext,
): Promise<string> {
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
        const letter = KEYBOARD_LABELS ? theItem.inventoryLetter : " ";
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

        const loopResult = await ctx.buttonInputLoop(
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
                // Highlight the selected button by drawing it as "pressed"
                // C passes NULL to draw directly to screen; TS needs a temp buffer.
                const highlightBuf = ctx.createScreenDisplayBuffer();
                ctx.clearDisplayBuffer(highlightBuf);
                ctx.drawButton(buttons[currentHighlight], ButtonDrawState.Pressed, highlightBuf);
                ctx.overlayDisplayBuffer(highlightBuf);

                if (theEvent.shiftKey || theEvent.controlKey || waitForAcknowledge) {
                    actionKey = await ctx.printCarriedItemDetails(
                        itemList[currentHighlight],
                        Math.max(2, ctx.mapToWindowX(COLS - maxLength - 42)),
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
                            await ctx.apply(itemList[currentHighlight]);
                            break;
                        case EQUIP_KEY:
                            await ctx.equip(itemList[currentHighlight]);
                            break;
                        case UNEQUIP_KEY:
                            await ctx.unequip(itemList[currentHighlight]);
                            break;
                        case DROP_KEY:
                            await ctx.drop(itemList[currentHighlight]);
                            break;
                        case THROW_KEY:
                            await ctx.throwCommand(itemList[currentHighlight], false);
                            break;
                        case RELABEL_KEY:
                            await ctx.relabel(itemList[currentHighlight]);
                            break;
                        case CALL_KEY:
                            await ctx.call(itemList[currentHighlight]);
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

// =============================================================================
// PromptItemContext + promptForItemOfType — Items.c:7586
// =============================================================================

/**
 * Extension of InventoryContext with the extra fields needed by promptForItemOfType.
 */
export interface PromptItemContext extends InventoryContext {
    temporaryMessage(msg: string, flags: number): void;
    numberOfMatchingPackItems(category: number, requiredFlags: number, forbiddenFlags: number): number;
}

/**
 * Show a temporary prompt, display the inventory filtered to matching items,
 * and return the selected Item, or null if cancelled.
 *
 * C: `promptForItemOfType` in Items.c:7586
 */
export async function promptForItemOfType(
    category: number,
    requiredFlags: number,
    forbiddenFlags: number,
    prompt: string,
    allowInventoryActions: boolean,
    ctx: PromptItemContext,
): Promise<Item | null> {
    if (!ctx.numberOfMatchingPackItems(ALL_ITEMS, requiredFlags, forbiddenFlags)) {
        return null;
    }

    ctx.temporaryMessage(prompt, 0);

    const keystroke = await displayInventory(
        category, requiredFlags, forbiddenFlags, false, allowInventoryActions, ctx,
    );

    if (!keystroke) return null;

    const code = keystroke.charCodeAt(0);
    if (code < "a".charCodeAt(0) || code > "z".charCodeAt(0)) {
        ctx.confirmMessages();
        if (code !== ESCAPE_KEY && code !== ACKNOWLEDGE_KEY) {
            ctx.message("Invalid entry.", 0);
        }
        return null;
    }

    const theItem = ctx.packItems.find(item => item.inventoryLetter === keystroke) ?? null;
    if (!theItem) {
        ctx.confirmMessages();
        ctx.message("No such item.", 0);
        return null;
    }

    return theItem;
}
