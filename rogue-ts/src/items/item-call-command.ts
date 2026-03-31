/*
 *  items/item-call-command.ts — buildCallCommandFn wiring factory
 *  Port V2 — rogue-ts
 *
 *  Extracted from item-commands.ts to keep that file under 600 lines.
 *  Exports buildCallCommandFn() — the 'call' (inscribe) command.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { waitForEvent, commitDraws } from "../platform.js";
import { inscribeItem } from "./item-call.js";
import { itemCanBeCalled } from "./item-utils.js";
import { itemName as itemNameFn } from "./item-naming.js";
import {
    wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "../globals/item-catalog.js";
import { charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import { plotCharToBuffer } from "../io/display.js";
import { mapToWindowX } from "../globals/tables.js";
import { printString } from "../io/text.js";
import { playerTurnEnded as playerTurnEndedFn } from "../turn.js";
import { black, gray, white, itemMessageColor } from "../globals/colors.js";
import { DELETE_KEY, ESCAPE_KEY, RETURN_KEY, MESSAGE_LINES, COLS, DCOLS } from "../types/constants.js";
import { DisplayGlyph, EventType } from "../types/enums.js";
import type { Color, Item, ItemTable, RogueEvent } from "../types/types.js";
// ItemCommandDeps is defined in item-commands.ts; type-only import avoids a
// runtime circular reference (item-commands.ts re-exports buildCallCommandFn
// from this module, but only needs the type here at compile time).
import type { ItemCommandDeps } from "./item-commands.js";

// =============================================================================
// asyncGetInputTextString — async text-entry loop for browser
// =============================================================================

/**
 * Show a text-entry prompt in the message area and read keystrokes via
 * waitForEvent(). Returns the entered string or null if cancelled (Escape).
 *
 * Replicates getInputTextString() (IO.c:2720) in non-dialog mode with
 * TEXT_INPUT_NORMAL bounds (printable ASCII 32–126).
 *
 * C: getInputTextString in IO.c
 */
export async function asyncGetInputTextString(
    prompt: string,
    maxLength: number,
    defaultEntry: string,
    promptSuffix: string,
): Promise<string | null> {
    const { displayBuffer } = getGameState();
    const SPACE = 32;
    const TILDE = 126;
    const BACKSPACE = 8;

    // Capitalize and show prompt in the message area (mirrors temporaryMessage)
    const text = prompt.charAt(0).toUpperCase() + prompt.slice(1);
    for (let row = 0; row < MESSAGE_LINES; row++) {
        for (let col = 0; col < DCOLS; col++) {
            plotCharToBuffer(SPACE as DisplayGlyph, mapToWindowX(col), row, black, black, displayBuffer);
        }
    }
    printString(text, mapToWindowX(0), MESSAGE_LINES - 1, white, black, displayBuffer);

    // Cursor position is immediately after the visible prompt text
    const promptVisLen = text.replace(/\x19[\s\S]{3}/g, "").length;
    const baseX = mapToWindowX(promptVisLen);
    const y = MESSAGE_LINES - 1;
    const actualMaxLength = Math.min(maxLength, COLS - baseX);
    const promptSuffixLen = promptSuffix.length;

    // Initialise input buffer from defaultEntry
    const inputChars: number[] = new Array(actualMaxLength).fill(SPACE);
    let charNum = 0;
    if (defaultEntry) {
        const take = Math.min(defaultEntry.length, actualMaxLength);
        for (let i = 0; i < take; i++) { inputChars[i] = defaultEntry.charCodeAt(i); }
        printString(defaultEntry.substring(0, take), baseX, y, white, black, displayBuffer);
        charNum = take;
    }

    const suffix = promptSuffix || " ";

    for (;;) {
        // Render cursor: suffix in gray, first char inverted (black on white)
        printString(suffix, baseX + charNum, y, gray, black, displayBuffer);
        plotCharToBuffer(
            (suffix.charCodeAt(0) || SPACE) as DisplayGlyph,
            baseX + charNum, y, black, white, displayBuffer,
        );
        commitDraws();

        let event: RogueEvent;
        try { event = await waitForEvent(); } catch { return null; }
        if (event.eventType !== EventType.Keystroke) continue;
        const keystroke = event.param1;

        if ((keystroke === DELETE_KEY || keystroke === BACKSPACE) && charNum > 0) {
            printString(suffix, baseX + charNum - 1, y, gray, black, displayBuffer);
            plotCharToBuffer(
                SPACE as DisplayGlyph,
                baseX + charNum + suffix.length - 1, y, black, black, displayBuffer,
            );
            charNum--;
            inputChars[charNum] = SPACE;
        } else if (keystroke >= SPACE && keystroke <= TILDE) {
            inputChars[charNum] = keystroke;
            plotCharToBuffer(keystroke as DisplayGlyph, baseX + charNum, y, white, black, displayBuffer);
            if (charNum < actualMaxLength - promptSuffixLen) {
                printString(suffix, baseX + charNum + 1, y, gray, black, displayBuffer);
                charNum++;
            }
        } else if (keystroke === RETURN_KEY) {
            return String.fromCharCode(...inputChars.slice(0, charNum));
        } else if (keystroke === ESCAPE_KEY) {
            return null;
        }
    }
}

// =============================================================================
// buildCallCommandFn
// =============================================================================

/**
 * Returns an async function implementing the 'call' (inscribe) command.
 * Wire into buildInputContext().call and buildInventoryContext().call.
 *
 * NOTE: getInputTextString is stubbed to return null (no inscription applied)
 * until Phase 2 wires synchronous event delivery into the text-entry loop.
 */
export function buildCallCommandFn(
    deps: ItemCommandDeps,
): (item: Item | null) => Promise<void> {
    return async (item) => {
        if (!item) return;
        if (!itemCanBeCalled(item)) return;

        const { rogue, gameConst, mutablePotionTable, mutableScrollTable } = getGameState();
        const namingCtx = {
            gameConstants: gameConst,
            depthLevel: rogue.depthLevel,
            potionTable: mutablePotionTable,
            scrollTable: mutableScrollTable,
            wandTable: wandTable as unknown as ItemTable[],
            staffTable: staffTable as unknown as ItemTable[],
            ringTable: ringTable as unknown as ItemTable[],
            charmTable: charmTable as unknown as ItemTable[],
            charmRechargeDelay: (kind: number, enchant: number) =>
                charmRechargeDelayFn(charmEffectTable[kind], enchant),
            playbackOmniscience: rogue.playbackOmniscience,
            monsterClassName: (_classId: number) => "creature",
        };

        const confirmed = await inscribeItem(item, {
            itemName: (i, details, article) => itemNameFn(i, details, article, namingCtx),
            getInputTextString: asyncGetInputTextString,
            confirmMessages: deps.confirmMessages,
            messageWithColor: (msg, color: Readonly<Color> | null, flags) =>
                deps.messageWithColor(msg, color, flags),
            strLenWithoutEscapes: (s) => s.replace(/\x19[\s\S]{3}/g, "").length,
            itemMessageColor,
        });

        if (confirmed) {
            await playerTurnEndedFn();
        }
    };
}
