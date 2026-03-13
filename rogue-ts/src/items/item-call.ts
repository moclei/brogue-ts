/*
 *  items/item-call.ts — inscribeItem: add a custom inscription to an item
 *  brogue-ts
 *
 *  Ported from: src/brogue/Items.c:1292 (inscribeItem)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Item } from "../types/types.js";
import { DCOLS } from "../types/constants.js";

// =============================================================================
// InscribeContext
// =============================================================================

/**
 * Dependency-injection context for inscribeItem.
 */
export interface InscribeContext {
    /**
     * Build a display name for the item.
     * includeDetails: enchant/identified info; includeArticle: a/an/the prefix.
     */
    itemName(item: Item, includeDetails: boolean, includeArticle: boolean): string;

    /**
     * Prompt the player for a short text string.
     * Returns the entered text, or null if cancelled.
     * May be async (browser text-entry loop) or sync (test mocks).
     */
    getInputTextString(
        prompt: string,
        maxLength: number,
        defaultEntry: string,
        promptSuffix: string,
    ): string | null | Promise<string | null>;

    confirmMessages(): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;
    strLenWithoutEscapes(s: string): number;
    itemMessageColor: Readonly<Color>;
}

// =============================================================================
// inscribeItem — Items.c:1292
// =============================================================================

/**
 * Prompt the player to enter a custom inscription for `theItem`.
 * Temporarily clears the inscription while generating the prompt so the name
 * doesn't include the old inscription, then restores it before calling
 * `getInputTextString`.
 *
 * C: static boolean inscribeItem(item *theItem)
 *    — Items.c:1292
 *
 * @param theItem Item to inscribe.
 * @param ctx     DI context.
 * @returns       true if the player confirmed; false if they cancelled.
 */
export async function inscribeItem(theItem: Item, ctx: InscribeContext): Promise<boolean> {
    const oldInscription = theItem.inscription;
    theItem.inscription = "";
    const nameOfItem = ctx.itemName(theItem, true, true);
    theItem.inscription = oldInscription;

    const promptPrefix = `inscribe: ${nameOfItem} "`;
    const maxLength = Math.min(29, DCOLS - ctx.strLenWithoutEscapes(promptPrefix) - 1);

    const result = await ctx.getInputTextString(promptPrefix, maxLength, "", '"');
    if (result !== null) {
        theItem.inscription = result;
        ctx.confirmMessages();
        const nameAfter = ctx.itemName(theItem, true, true);
        const msg = `${theItem.quantity > 1 ? "they're" : "it's"} ${nameAfter}.`;
        ctx.messageWithColor(msg, ctx.itemMessageColor, 0);
        return true;
    } else {
        ctx.confirmMessages();
        return false;
    }
}
