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
import { isDOMModalEnabled, showModal } from "../platform/ui-modal.js";
import { parseColorEscapes } from "../platform/ui-messages.js";

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

// =============================================================================
// DOM content builders — used when isDOMModalEnabled() is true
// =============================================================================

/**
 * Build a single styled line element from a Brogue color-escaped string.
 * Leading/trailing whitespace is preserved (`white-space: pre`).
 */
function buildColorLine(text: string): HTMLElement {
    const div = document.createElement("div");
    div.style.cssText = "white-space:pre;min-height:1.4em;";
    const segments = parseColorEscapes(text || " ", 1.0);
    for (const seg of segments) {
        if (!seg.text) continue;
        const span = document.createElement("span");
        span.style.color = seg.color;
        span.textContent = seg.text;
        div.appendChild(span);
    }
    return div;
}

/** Build the help screen DOM content element. */
function buildHelpScreenDOM(helpText: string[]): HTMLElement {
    const root = document.createElement("div");
    root.style.cssText = "min-width:min(600px,85vw);";
    for (const line of helpText) {
        root.appendChild(buildColorLine(line));
    }
    return root;
}

/** Build the feats screen DOM content element. */
function buildFeatsScreenDOM(
    featRecord: boolean[],
    numFeats: number,
): HTMLElement {
    const root = document.createElement("div");
    root.style.cssText = "min-width:min(560px,85vw);";

    const title = document.createElement("div");
    title.style.cssText = "text-align:center;color:#9e9;margin-bottom:0.5em;";
    title.textContent = "-- FEATS --";
    root.appendChild(title);

    for (let i = 0; i < numFeats && i < featCatalog.length; i++) {
        const feat = featCatalog[i];
        const isInitial = featRecord[i] === feat.initialValue;
        const achieved = !isInitial && featRecord[i];

        const statusChar = isInitial ? " " : (achieved ? "+" : "-");
        const statusColor = isInitial ? "#888" : (achieved ? "#8f8" : "#f66");
        const nameColor = "#bbb";

        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:0.5em;white-space:pre;";

        const name = document.createElement("span");
        name.style.color = nameColor;
        name.textContent = feat.name.padStart(FEAT_NAME_LENGTH);
        row.appendChild(name);

        const sep = document.createElement("span");
        sep.style.color = statusColor;
        sep.textContent = ` ${statusChar} `;
        row.appendChild(sep);

        const desc = document.createElement("span");
        desc.style.color = "#ccc";
        desc.textContent = feat.description;
        row.appendChild(desc);

        root.appendChild(row);
    }

    const legendSection = document.createElement("div");
    legendSection.style.cssText = "margin-top:1em;text-align:center;";

    const legendTitle = document.createElement("div");
    legendTitle.style.color = "#888";
    legendTitle.textContent = "-- LEGEND --";
    legendSection.appendChild(legendTitle);

    const legendLine = document.createElement("div");
    legendLine.innerHTML =
        `<span style="color:#f66">Failed(-)</span>  ` +
        `<span style="color:#8f8">Achieved(+)</span>`;
    legendSection.appendChild(legendLine);

    const cont = document.createElement("div");
    cont.style.cssText = "margin-top:0.8em;color:#bbb;";
    cont.textContent = KEYBOARD_LABELS ? "-- press any key to continue --" : "-- touch anywhere to continue --";
    legendSection.appendChild(cont);

    root.appendChild(legendSection);
    return root;
}

/** Render one discovery category column into a container element. */
function buildDiscoveryCategoryDOM(
    container: HTMLElement,
    title: string,
    category: number,
    count: number,
    table: readonly Pick<ItemTable, "name" | "identified" | "frequency">[],
): void {
    const hdr = document.createElement("div");
    hdr.style.cssText = "color:#9e9;margin-bottom:0.2em;";
    hdr.textContent = title;
    container.appendChild(hdr);

    let totalFrequency = 0;
    for (let i = 0; i < count; i++) {
        if (!table[i].identified) totalFrequency += table[i].frequency;
    }

    for (let i = 0; i < count; i++) {
        const identified = table[i].identified;
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:0.4em;white-space:pre;";

        const glyph = document.createElement("span");
        const magic = identified ? 0 : magicCharDiscoverySuffix(category, i, { boltCatalog });
        glyph.textContent = identified ? "=" : (magic === 1 ? "+" : (magic === -1 ? "-" : " "));
        glyph.style.color = identified ? "#ddaa44" : (magic === 1 ? "#8f8" : (magic === -1 ? "#f88" : "#555"));
        row.appendChild(glyph);

        const name = document.createElement("span");
        let label = upperCase(table[i].name);
        if (!identified && table[i].frequency > 0 && totalFrequency > 0) {
            label += ` (${Math.trunc(table[i].frequency * 100 / totalFrequency)}%)`;
        }
        name.textContent = label;
        name.style.color = identified ? "#ccc" : "#555";
        row.appendChild(name);

        container.appendChild(row);
    }
}

/** Build the discoveries screen DOM content element. */
function buildDiscoveriesScreenDOM(
    numberScrollKinds: number,
    numberPotionKinds: number,
    numberWandKinds: number,
    scrollTable: readonly Pick<ItemTable, "name" | "identified" | "frequency">[],
    potionTable: readonly Pick<ItemTable, "name" | "identified" | "frequency">[],
): HTMLElement {
    const root = document.createElement("div");
    root.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr;gap:1em 2em;min-width:min(700px,85vw);";

    const leftCol = document.createElement("div");
    buildDiscoveryCategoryDOM(leftCol, "-- SCROLLS --", ItemCategory.SCROLL, numberScrollKinds, scrollTable);
    const ringGap = document.createElement("div");
    ringGap.style.height = "0.6em";
    leftCol.appendChild(ringGap);
    buildDiscoveryCategoryDOM(leftCol, "-- RINGS --", ItemCategory.RING, ringTable.length, ringTable as ItemTable[]);
    root.appendChild(leftCol);

    const midCol = document.createElement("div");
    buildDiscoveryCategoryDOM(midCol, "-- POTIONS --", ItemCategory.POTION, numberPotionKinds, potionTable);
    root.appendChild(midCol);

    const rightCol = document.createElement("div");
    buildDiscoveryCategoryDOM(rightCol, "-- STAFFS --", ItemCategory.STAFF, staffTable.length, staffTable as ItemTable[]);
    const wandGap = document.createElement("div");
    wandGap.style.height = "0.6em";
    rightCol.appendChild(wandGap);
    buildDiscoveryCategoryDOM(rightCol, "-- WANDS --", ItemCategory.WAND, numberWandKinds, wandTable as ItemTable[]);
    root.appendChild(rightCol);

    const footer = document.createElement("div");
    footer.style.cssText = "grid-column:1/-1;text-align:center;color:#bbb;margin-top:0.4em;";
    footer.textContent = KEYBOARD_LABELS ? "-- press any key to continue --" : "-- touch anywhere to continue --";
    root.appendChild(footer);

    return root;
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

    if (isDOMModalEnabled()) {
        await showModal(buildHelpScreenDOM(helpText));
        return;
    }

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

    if (isDOMModalEnabled()) {
        const numFeats = Math.min(gameConst.numberFeats, featCatalog.length);
        await showModal(buildFeatsScreenDOM(rogue.featRecord, numFeats));
        return;
    }

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

    if (isDOMModalEnabled()) {
        await showModal(buildDiscoveriesScreenDOM(
            gameConst.numberScrollKinds,
            gameConst.numberPotionKinds,
            gameConst.numberWandKinds,
            mutableScrollTable,
            mutablePotionTable,
        ));
        return;
    }

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
