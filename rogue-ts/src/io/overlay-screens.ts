/*
 *  io/overlay-screens.ts — Full-screen overlay panels (help, feats, discoveries)
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c — printHelpScreen (IO.c:4066),
 *               displayFeatsScreen (IO.c:4188), printDiscoveriesScreen (IO.c:4240)
 *
 *  Each function saves the current display buffer, builds a fresh overlay,
 *  blends it onto the screen, awaits an optional waitFn (caller-supplied
 *  async event wait), and restores the buffer.
 *
 *  Pass waitFn = async () => { await waitForEvent(); } in production.
 *  Omit waitFn in tests (overlay renders and restores immediately).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { commitDraws } from "../platform.js";
import {
    createScreenDisplayBuffer, clearDisplayBuffer,
    overlayDisplayBuffer, saveDisplayBuffer, restoreDisplayBuffer,
    plotCharToBuffer,
} from "./display.js";
import { printString, strLenWithoutEscapes, upperCase } from "./text.js";
import { encodeMessageColor, applyColorAverage } from "./color.js";
import { mapToWindowX, mapToWindowY } from "../globals/tables.js";
import { COLS, ROWS, DCOLS, INTERFACE_OPACITY, STAT_BAR_WIDTH, FEAT_NAME_LENGTH, KEYBOARD_LABELS } from "../types/constants.js";
import { DisplayGlyph, ItemCategory } from "../types/enums.js";
import {
    itemMessageColor, black, white, gray, darkGray,
    itemColor, goodMessageColor, badMessageColor,
    advancementMessageColor, flavorTextColor,
} from "../globals/colors.js";
import { magicCharDiscoverySuffix } from "../items/item-handlers.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import { ringTable, staffTable, wandTable } from "../globals/item-catalog.js";
import { featCatalog } from "../globals/feat-catalog.js";
import { clamp } from "../math/rng.js";
import type { ScreenDisplayBuffer, ItemTable } from "../types/types.js";

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Blend an overlay dbuf onto displayBuffer (writing results back into
 * displayBuffer so the platform renderer sees the update).
 * Mirrors the write-back pattern used in menus.ts.
 */
function applyOverlay(displayBuffer: ScreenDisplayBuffer, dbuf: ScreenDisplayBuffer): void {
    const results = overlayDisplayBuffer(displayBuffer, dbuf);
    for (const r of results) {
        const cell = displayBuffer.cells[r.x][r.y];
        cell.character = r.character;
        cell.foreColorComponents[0] = clamp(r.foreColor.red, 0, 100);
        cell.foreColorComponents[1] = clamp(r.foreColor.green, 0, 100);
        cell.foreColorComponents[2] = clamp(r.foreColor.blue, 0, 100);
        cell.backColorComponents[0] = clamp(r.backColor.red, 0, 100);
        cell.backColorComponents[1] = clamp(r.backColor.green, 0, 100);
        cell.backColorComponents[2] = clamp(r.backColor.blue, 0, 100);
    }
}

/**
 * Port of C `printDiscoveries()` (static, IO.c:4139).
 * Renders one category column of the discoveries screen into dbuf.
 */
function printDiscoveries(
    category: number,
    count: number,
    itemChar: DisplayGlyph,
    x: number,
    y: number,
    dbuf: ScreenDisplayBuffer,
    table: readonly Pick<ItemTable, "name" | "identified" | "frequency">[],
): void {
    const goodColor = { ...goodMessageColor };
    applyColorAverage(goodColor, black, 50);
    const badColor = { ...badMessageColor };
    applyColorAverage(badColor, black, 50);

    let totalFrequency = 0;
    for (let i = 0; i < count; i++) {
        if (!table[i].identified) {
            totalFrequency += table[i].frequency;
        }
    }

    for (let i = 0; i < count; i++) {
        let theColor = table[i].identified ? white : darkGray;

        if (table[i].identified) {
            plotCharToBuffer(itemChar, x, y + i, itemColor, black, dbuf);
        } else {
            const magic = magicCharDiscoverySuffix(category, i, { boltCatalog });
            if (magic === 1) {
                plotCharToBuffer(DisplayGlyph.G_GOOD_MAGIC, x, y + i, goodColor, black, dbuf);
            } else if (magic === -1) {
                plotCharToBuffer(DisplayGlyph.G_BAD_MAGIC, x, y + i, badColor, black, dbuf);
            }
        }

        let buf = upperCase(table[i].name);
        if (!table[i].identified && table[i].frequency > 0 && totalFrequency > 0) {
            buf += ` (${Math.trunc(table[i].frequency * 100 / totalFrequency)}%)`;
        }
        buf += " ";

        printString(buf, x + 2, y + i, theColor, black, dbuf);
    }
}

// =============================================================================
// printHelpScreen — IO.c:4066
// =============================================================================

/**
 * Display the in-game keybinding reference overlay.
 * Pass waitFn to block until the player acknowledges (e.g. any key/click).
 *
 * C: `printHelpScreen` in IO.c:4066
 */
export async function printHelpScreen(waitFn?: () => Promise<void>): Promise<void> {
    const { displayBuffer } = getGameState();

    const whiteEscape = encodeMessageColor(white);
    const helpText: string[] = [
        "",
        "",
        "          -- Commands --",
        "",
        `          mouse  ${whiteEscape}move cursor (including to examine monsters and terrain)`,
        `          click  ${whiteEscape}travel`,
        `  control-click  ${whiteEscape}advance one space`,
        `       <return>  ${whiteEscape}enable keyboard cursor control`,
        `    <space/esc>  ${whiteEscape}disable keyboard cursor control`,
        `hjklyubn, arrow keys, or numpad  ${whiteEscape}move or attack (control or shift to run)`,
        "",
        `a/e/r/t/d/c/R/w  ${whiteEscape}apply/equip/remove/throw/drop/call/relabel/swap an item`,
        `              T  ${whiteEscape}re-throw last item at last monster`,
        ` i, right-click  ${whiteEscape}view inventory`,
        `              D  ${whiteEscape}list discovered items`,
        "",
        `              z  ${whiteEscape}rest once`,
        `              Z  ${whiteEscape}rest for 100 turns or until something happens`,
        `              s  ${whiteEscape}search for secrets (control-s: long search)`,
        `           <, >  ${whiteEscape}travel to stairs`,
        `              x  ${whiteEscape}auto-explore (control-x: fast forward)`,
        `              A  ${whiteEscape}autopilot (control-A: fast forward)`,
        `              M  ${whiteEscape}display old messages`,
        `              G  ${whiteEscape}toggle graphical tiles (when available)`,
        "",
        `              S  ${whiteEscape}save and exit`,
        `              Q  ${whiteEscape}quit and abandon game`,
        "",
        `              \\  ${whiteEscape}disable/enable color effects`,
        `              ]  ${whiteEscape}display/hide stealth range`,
        `    <space/esc>  ${whiteEscape}clear message or cancel command`,
        "",
        "        -- press space or click to continue --",
    ];

    const rbuf = saveDisplayBuffer(displayBuffer);
    const dbuf = createScreenDisplayBuffer();
    clearDisplayBuffer(dbuf);

    const lineCount = Math.min(helpText.length, ROWS);
    for (let i = 0; i < lineCount; i++) {
        printString(helpText[i], mapToWindowX(1), i, itemMessageColor, black, dbuf);
    }

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[mapToWindowX(i)][j].opacity = INTERFACE_OPACITY;
        }
    }

    applyOverlay(displayBuffer, dbuf);
    if (waitFn) await waitFn();
    restoreDisplayBuffer(displayBuffer, rbuf);
    commitDraws();
}

// =============================================================================
// displayFeatsScreen — IO.c:4188
// =============================================================================

/**
 * Display the feats/achievements overlay screen.
 * Pass waitFn to block until the player acknowledges.
 *
 * C: `displayFeatsScreen` in IO.c:4188
 */
export async function displayFeatsScreen(waitFn?: () => Promise<void>): Promise<void> {
    const { rogue, gameConst, displayBuffer } = getGameState();

    const availableEscape = encodeMessageColor(white);
    const achievedEscape = encodeMessageColor(advancementMessageColor);
    const failedEscape = encodeMessageColor(badMessageColor);

    const dbuf = createScreenDisplayBuffer();
    clearDisplayBuffer(dbuf);

    // Title
    const title = "-- FEATS --";
    let y = 1;
    printString(title, mapToWindowX(Math.trunc((DCOLS - FEAT_NAME_LENGTH - strLenWithoutEscapes(title)) / 2)), y, flavorTextColor, black, dbuf);

    // Feat rows
    const numFeats = Math.min(gameConst.numberFeats, featCatalog.length);
    for (let i = 0; i < numFeats; i++) {
        let featEscape: string;
        let statusChar: string;
        if (rogue.featRecord[i] === featCatalog[i].initialValue) {
            featEscape = availableEscape;
            statusChar = " ";
        } else if (rogue.featRecord[i]) {
            featEscape = achievedEscape;
            statusChar = "+";
        } else {
            featEscape = failedEscape;
            statusChar = "-";
        }
        const buf = `${featCatalog[i].name.padStart(FEAT_NAME_LENGTH)} ${featEscape}${statusChar} ${featCatalog[i].description}`;
        printString(buf, mapToWindowX(0), y + i + 1, itemMessageColor, black, dbuf);
    }

    // Legend
    const legendTitle = "-- LEGEND --";
    printString(legendTitle, mapToWindowX(Math.trunc((DCOLS - FEAT_NAME_LENGTH - strLenWithoutEscapes(legendTitle)) / 2)), ROWS - 5, gray, black, dbuf);
    const legendLine = `${failedEscape}Failed(-)  ${achievedEscape}Achieved(+)  `;
    printString(legendLine, mapToWindowX(Math.trunc((DCOLS - FEAT_NAME_LENGTH - strLenWithoutEscapes(legendLine)) / 2)), ROWS - 4, white, black, dbuf);

    const contLine = KEYBOARD_LABELS ? "-- press any key to continue --" : "-- touch anywhere to continue --";
    printString(contLine, mapToWindowX(Math.trunc((DCOLS - FEAT_NAME_LENGTH - strLenWithoutEscapes(contLine)) / 2)), ROWS - 2, itemMessageColor, black, dbuf);

    // Opacity: skip sidebar
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[i][j].opacity = (i < STAT_BAR_WIDTH ? 0 : INTERFACE_OPACITY);
        }
    }

    const rbuf = saveDisplayBuffer(displayBuffer);
    applyOverlay(displayBuffer, dbuf);
    if (waitFn) await waitFn();
    restoreDisplayBuffer(displayBuffer, rbuf);
    commitDraws();
}

// =============================================================================
// printDiscoveriesScreen — IO.c:4240
// =============================================================================

/**
 * Display the item discoveries overlay screen.
 * Pass waitFn to block until the player acknowledges.
 *
 * C: `printDiscoveriesScreen` in IO.c:4240
 */
export async function printDiscoveriesScreen(waitFn?: () => Promise<void>): Promise<void> {
    const { gameConst, mutableScrollTable, mutablePotionTable, displayBuffer } = getGameState();

    const rbuf = saveDisplayBuffer(displayBuffer);
    const dbuf = createScreenDisplayBuffer();
    clearDisplayBuffer(dbuf);

    // Left column: scrolls and rings
    let y = mapToWindowY(1);
    printString("-- SCROLLS --", mapToWindowX(2), y, flavorTextColor, black, dbuf);
    y++;
    printDiscoveries(ItemCategory.SCROLL, gameConst.numberScrollKinds, DisplayGlyph.G_SCROLL, mapToWindowX(3), y, dbuf, mutableScrollTable);

    y += gameConst.numberScrollKinds + 1;
    printString("-- RINGS --", mapToWindowX(2), y, flavorTextColor, black, dbuf);
    y++;
    printDiscoveries(ItemCategory.RING, ringTable.length, DisplayGlyph.G_RING, mapToWindowX(3), y, dbuf, ringTable as ItemTable[]);

    // Middle column: potions
    y = mapToWindowY(1);
    printString("-- POTIONS --", mapToWindowX(29), y, flavorTextColor, black, dbuf);
    y++;
    printDiscoveries(ItemCategory.POTION, gameConst.numberPotionKinds, DisplayGlyph.G_POTION, mapToWindowX(30), y, dbuf, mutablePotionTable);

    // Right column: staffs and wands
    y = mapToWindowY(1);
    printString("-- STAFFS --", mapToWindowX(53), y, flavorTextColor, black, dbuf);
    y++;
    printDiscoveries(ItemCategory.STAFF, staffTable.length, DisplayGlyph.G_STAFF, mapToWindowX(54), y, dbuf, staffTable as ItemTable[]);

    y += staffTable.length + 1;
    printString("-- WANDS --", mapToWindowX(53), y, flavorTextColor, black, dbuf);
    y++;
    printDiscoveries(ItemCategory.WAND, gameConst.numberWandKinds, DisplayGlyph.G_WAND, mapToWindowX(54), y, dbuf, wandTable as ItemTable[]);

    const contLine = KEYBOARD_LABELS ? "-- press any key to continue --" : "-- touch anywhere to continue --";
    printString(contLine, mapToWindowX(20), mapToWindowY(ROWS - 5), itemMessageColor, black, dbuf);

    // Opacity: skip sidebar
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[i][j].opacity = (i < STAT_BAR_WIDTH ? 0 : INTERFACE_OPACITY);
        }
    }

    applyOverlay(displayBuffer, dbuf);
    if (waitFn) await waitFn();
    restoreDisplayBuffer(displayBuffer, rbuf);
    commitDraws();
}
