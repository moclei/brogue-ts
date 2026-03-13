/*
 *  io/menu-bar.ts — Game menu bar: bottom-row action buttons for platform.ts
 *  Port V2 — rogue-ts
 *
 *  Provides draw/click helpers for the five bottom-bar buttons (Explore, Rest,
 *  Search, Menu, Inventory) that appear at ROWS-1 during normal gameplay.
 *
 *  This module has NO dependency on platform.ts or ui.ts (both import platform),
 *  so it can be safely imported by platform.ts without circular deps.
 *
 *  C: IO.c — initializeMenuButtons, drawButtonsInState
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import {
    applyColorAverage, bakeColor, separateColors,
    encodeMessageColor, decodeMessageColor,
} from "./color.js";
import { strLenWithoutEscapes } from "./text.js";
import {
    plotCharToBuffer, locIsInWindow,
    createScreenDisplayBuffer, clearDisplayBuffer,
    saveDisplayBuffer, restoreDisplayBuffer,
    applyOverlay,
} from "./display.js";
import {
    initializeButton, initializeButtonState, drawButtonsInState,
} from "./buttons.js";
import type { ButtonContext } from "./buttons.js";
import { ButtonFlag } from "../types/flags.js";
import {
    white, yellow, interfaceButtonColor,
} from "../globals/colors.js";
import { mapToWindowX } from "../globals/tables.js";
import {
    COLS, ROWS, KEYBOARD_LABELS,
    EXPLORE_KEY, REST_KEY, SEARCH_KEY, INVENTORY_KEY,
    ACKNOWLEDGE_KEY, TAB_KEY, RIGHT_KEY,
} from "../types/constants.js";
import type { ButtonState, BrogueButton, ScreenDisplayBuffer } from "../types/types.js";

const MAX_MENU_BUTTON_COUNT = 5;

// =============================================================================
// buildMenuBarButtonCtx — minimal ButtonContext for drawing only
// =============================================================================

function buildMenuBarButtonCtx(): ButtonContext {
    const { rogue, displayBuffer } = getGameState();
    return {
        rogue: {
            playbackMode: rogue.playbackMode,
            playbackPaused: rogue.playbackPaused,
        },
        applyColorAverage,
        bakeColor,
        separateColors,
        strLenWithoutEscapes,
        decodeMessageColor,
        encodeMessageColor,
        plotCharToBuffer,
        locIsInWindow,
        createScreenDisplayBuffer,
        clearDisplayBuffer,
        overlayDisplayBuffer: (dbuf) => applyOverlay(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBuffer(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBuffer(displayBuffer, saved),
        // Async methods — not used for drawing, stubs sufficient
        nextBrogueEvent: () => Promise.reject(new Error("not available in menu-bar ctx")),
        pauseBrogue: () => Promise.resolve(false),
        pauseAnimation: () => Promise.resolve(false),
    };
}

// =============================================================================
// buildGameMenuButtonState — initialize the five bottom-bar buttons
// =============================================================================

/**
 * Build and return a ButtonState for the game's bottom-bar menu buttons.
 * Mirrors initializeMenuButtons() in input-mouse.ts, but uses raw imports
 * instead of an InputContext so platform.ts can call this without circular deps.
 *
 * C: IO.c::initializeMenuButtons
 */
export function buildGameMenuButtonState(playbackMode: boolean): ButtonState {
    const goldEsc = encodeMessageColor(KEYBOARD_LABELS ? yellow : white);
    const whiteEsc = encodeMessageColor(white);

    const rawButtons: BrogueButton[] = [];
    for (let i = 0; i < MAX_MENU_BUTTON_COUNT; i++) {
        const btn = initializeButton();
        btn.opacity = 75;
        btn.buttonColor = { ...interfaceButtonColor };
        btn.y = ROWS - 1;
        btn.flags |= ButtonFlag.B_WIDE_CLICK_AREA;
        btn.flags &= ~ButtonFlag.B_KEYPRESS_HIGHLIGHT;
        rawButtons.push(btn);
    }

    let buttonCount = 0;

    if (playbackMode) {
        rawButtons[buttonCount].text = ` Unpause (${goldEsc}space${whiteEsc}) `;
        rawButtons[buttonCount].hotkey = [ACKNOWLEDGE_KEY];
        buttonCount++;
        rawButtons[buttonCount].text = KEYBOARD_LABELS
            ? `Omniscience (${goldEsc}tab${whiteEsc})`
            : "   Omniscience   ";
        rawButtons[buttonCount].hotkey = [TAB_KEY];
        buttonCount++;
        rawButtons[buttonCount].text = KEYBOARD_LABELS
            ? ` Next Turn (${goldEsc}l${whiteEsc}) `
            : "   Next Turn   ";
        rawButtons[buttonCount].hotkey = [RIGHT_KEY];
        buttonCount++;
        rawButtons[buttonCount].text = "  Menu  ";
        buttonCount++;
    } else {
        rawButtons[buttonCount].text = `   E${goldEsc}x${whiteEsc}plore   `;
        rawButtons[buttonCount].hotkey = [EXPLORE_KEY, "X".charCodeAt(0)];
        buttonCount++;
        rawButtons[buttonCount].text = KEYBOARD_LABELS
            ? `   Rest (${goldEsc}z${whiteEsc})   `
            : "     Rest     ";
        rawButtons[buttonCount].hotkey = [REST_KEY];
        buttonCount++;
        rawButtons[buttonCount].text = KEYBOARD_LABELS
            ? `  Search (${goldEsc}s${whiteEsc})  `
            : "    Search    ";
        rawButtons[buttonCount].hotkey = [SEARCH_KEY];
        buttonCount++;
        rawButtons[buttonCount].text = "    Menu    ";
        buttonCount++;
    }

    rawButtons[4].text = `   ${goldEsc}I${whiteEsc}nventory   `;
    rawButtons[4].hotkey = [INVENTORY_KEY, "I".charCodeAt(0)];

    let x = mapToWindowX(0);
    for (let i = 0; i < MAX_MENU_BUTTON_COUNT; i++) {
        rawButtons[i].x = x;
        x += strLenWithoutEscapes(rawButtons[i].text) + 2;
    }

    return initializeButtonState(
        rawButtons,
        MAX_MENU_BUTTON_COUNT,
        mapToWindowX(0),
        ROWS - 1,
        COLS - mapToWindowX(0),
        1,
    );
}

// =============================================================================
// drawGameMenuButtons — overlay bottom-bar buttons onto the display buffer
// =============================================================================

/**
 * Draw the game menu bar buttons into a temp display buffer and overlay them
 * onto the main display buffer. Call this before commitDraws() each frame.
 *
 * C: equivalent to the drawButtonsInState call inside cursor-mode moveCursor().
 */
export function drawGameMenuButtons(state: ButtonState): void {
    const { displayBuffer } = getGameState();
    const ctx = buildMenuBarButtonCtx();
    const dbuf: ScreenDisplayBuffer = createScreenDisplayBuffer();
    clearDisplayBuffer(dbuf);
    drawButtonsInState(state, dbuf, ctx);
    applyOverlay(displayBuffer, dbuf);
}

// =============================================================================
// findClickedMenuButton — hit-test a click against the button row
// =============================================================================

/**
 * Check whether a window-coordinate click lands on one of the menu bar buttons.
 * Returns the button index (0–4), or -1 if no button was hit.
 *
 * C: processButtonInput in Buttons.c (click path only).
 */
export function findClickedMenuButton(
    state: ButtonState,
    windowX: number,
    windowY: number,
): number {
    // B_WIDE_CLICK_AREA: accept clicks on the row above (ROWS-2) as well.
    const isButtonRow = windowY === ROWS - 1 ||
        (windowY === ROWS - 2 && state.buttonCount > 0 &&
         !!(state.buttons[0].flags & ButtonFlag.B_WIDE_CLICK_AREA));
    if (!isButtonRow) return -1;

    for (let i = 0; i < state.buttonCount; i++) {
        const btn = state.buttons[i];
        if (!(btn.flags & ButtonFlag.B_ENABLED)) continue;
        const width = strLenWithoutEscapes(btn.text);
        if (windowX >= btn.x && windowX < btn.x + width) {
            return i;
        }
    }
    return -1;
}
