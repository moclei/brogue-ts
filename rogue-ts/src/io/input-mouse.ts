/*
 *  io/input-mouse.ts — Mouse dispatch, action menu, menu button initialization
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/io/io-input.ts (lines 731–1482)
 *  Source C: src/brogue/IO.c
 *  Functions: executeMouseClick, initializeMenuButtons, actionMenu
 *
 *  Port V2 changes:
 *  - executeMouseClick: left-click goes directly to ctx.travel(); does NOT call
 *    mainInputLoop (per PLAN.md — the outer loop lives in platform.ts).
 *  - actionMenu: calls executeEvent from input-dispatch.ts via explicit import.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueButton, ButtonState, RogueEvent, WindowPos } from "../types/types.js";
import { EventType } from "../types/enums.js";
import { ButtonFlag } from "../types/flags.js";
import { initializeButtonState } from "./buttons.js";
import {
    COLS, ROWS, KEYBOARD_LABELS, DCOLS, INTERFACE_OPACITY,
    EXPLORE_KEY, REST_KEY, SEARCH_KEY, INVENTORY_KEY,
    AUTO_REST_KEY, AUTOPLAY_KEY, RETHROW_KEY, EASY_MODE_KEY,
    TRUE_COLORS_KEY, STEALTH_RANGE_KEY, GRAPHICS_KEY,
    FEATS_KEY, DISCOVERIES_KEY, CREATE_ITEM_MONSTER_KEY,
    SEED_KEY, BROGUE_HELP_KEY, QUIT_KEY, SAVE_GAME_KEY,
    LOAD_SAVED_GAME_KEY, VIEW_RECORDING_KEY,
    ACKNOWLEDGE_KEY, TAB_KEY,
    UP_KEY, DOWN_KEY, RIGHT_KEY, UP_ARROW, DOWN_ARROW,
    NUMPAD_2, NUMPAD_8,
    ASCEND_KEY, DESCEND_KEY,
    MESSAGE_LINES,
} from "../types/constants.js";
import {
    white, yellow, black,
    interfaceBoxColor, interfaceButtonColor, itemMessageColor,
} from "../globals/colors.js";
import type { InputContext } from "./input-keystrokes.js";
import { executeEvent } from "./input-dispatch.js";

const MAX_MENU_BUTTON_COUNT = 5;

// =============================================================================
// executeMouseClick — IO.c:2431 (port-v2 simplified)
// =============================================================================

/**
 * Dispatch a mouse click.
 *
 * Port V2: left-click goes directly to travel() — no intermediate cursor loop.
 * Right-click opens inventory. Click in message area opens message archive.
 */
export async function executeMouseClick(ctx: InputContext, theEvent: RogueEvent): Promise<void> {
    const mouse: WindowPos = { windowX: theEvent.param1, windowY: theEvent.param2 };
    const autoConfirm = theEvent.controlKey;

    if (theEvent.eventType === EventType.RightMouseUp) {
        await ctx.displayInventory(ctx.ALL_ITEMS, 0, 0, true, true);
    } else if (ctx.isPosInMap(ctx.windowToMap(mouse))) {
        // Port V2: always travel directly, no cursor mode loop
        await ctx.travel(ctx.windowToMap(mouse), autoConfirm || true);
    } else if (
        ctx.windowToMapX(mouse.windowX) >= 0 &&
        ctx.windowToMapX(mouse.windowX) < DCOLS &&
        mouse.windowY >= 0 &&
        mouse.windowY < MESSAGE_LINES
    ) {
        ctx.displayMessageArchive();
    }
}

// =============================================================================
// initializeMenuButtons — IO.c:443
// =============================================================================

/**
 * Set up the five bottom-bar menu buttons (Explore, Rest, Search, Menu,
 * Inventory) or the playback equivalents.
 */
export function initializeMenuButtons(ctx: InputContext, state: ButtonState, buttons: BrogueButton[]): void {
    const goldTextEscape = ctx.encodeMessageColor(KEYBOARD_LABELS ? yellow : white);
    const whiteTextEscape = ctx.encodeMessageColor(white);

    for (let i = 0; i < MAX_MENU_BUTTON_COUNT; i++) {
        const btn = ctx.initializeButton();
        btn.opacity = 75;
        btn.buttonColor = { ...interfaceButtonColor };
        btn.y = ROWS - 1;
        btn.flags |= ButtonFlag.B_WIDE_CLICK_AREA;
        btn.flags &= ~ButtonFlag.B_KEYPRESS_HIGHLIGHT;
        Object.assign(buttons[i], btn);
    }

    let buttonCount = 0;

    if (ctx.rogue.playbackMode) {
        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = ` Unpause (${goldTextEscape}space${whiteTextEscape}) `;
        } else {
            buttons[buttonCount].text = "     Unpause     ";
        }
        buttons[buttonCount].hotkey = [ACKNOWLEDGE_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `Omniscience (${goldTextEscape}tab${whiteTextEscape})`;
        } else {
            buttons[buttonCount].text = "   Omniscience   ";
        }
        buttons[buttonCount].hotkey = [TAB_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = ` Next Turn (${goldTextEscape}l${whiteTextEscape}) `;
        } else {
            buttons[buttonCount].text = "   Next Turn   ";
        }
        buttons[buttonCount].hotkey = [RIGHT_KEY];
        buttonCount++;

        buttons[buttonCount].text = "  Menu  ";
        buttonCount++;
    } else {
        buttons[buttonCount].text = `   E${goldTextEscape}x${whiteTextEscape}plore   `;
        buttons[buttonCount].hotkey = [EXPLORE_KEY, "X".charCodeAt(0)];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `   Rest (${goldTextEscape}z${whiteTextEscape})   `;
        } else {
            buttons[buttonCount].text = "     Rest     ";
        }
        buttons[buttonCount].hotkey = [REST_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  Search (${goldTextEscape}s${whiteTextEscape})  `;
        } else {
            buttons[buttonCount].text = "    Search    ";
        }
        buttons[buttonCount].hotkey = [SEARCH_KEY];
        buttonCount++;

        buttons[buttonCount].text = "    Menu    ";
        buttonCount++;
    }

    buttons[4].text = `   ${goldTextEscape}I${whiteTextEscape}nventory   `;
    buttons[4].hotkey = [INVENTORY_KEY, "I".charCodeAt(0)];

    let x = ctx.mapToWindowX(0);
    for (let i = 0; i < 5; i++) {
        buttons[i].x = x;
        x += ctx.strLenWithoutEscapes(buttons[i].text) + 2;
    }

    const newState = initializeButtonState(
        buttons, 5,
        ctx.mapToWindowX(0), ROWS - 1,
        COLS - ctx.mapToWindowX(0), 1,
    );
    Object.assign(state, newState);
}

// =============================================================================
// actionMenu — IO.c:170
// =============================================================================

/**
 * Show the in-game action/settings menu. Returns the hotkey of the chosen
 * action, or -1 if cancelled.
 */
export async function actionMenu(ctx: InputContext, x: number, playingBack: boolean): Promise<number> {
    const yellowEsc = ctx.encodeMessageColor(itemMessageColor);
    const whiteEsc = ctx.encodeMessageColor(white);
    const darkGrayEsc = ctx.encodeMessageColor(black);

    const takeActionOurselves: boolean[] = new Array(ROWS).fill(false);
    let buttonChosen: number;

    do {
        const buttons: BrogueButton[] = [];
        for (let i = 0; i < ROWS; i++) {
            const btn = ctx.initializeButton();
            btn.buttonColor = { ...interfaceBoxColor };
            btn.opacity = INTERFACE_OPACITY;
            buttons.push(btn);
        }

        let buttonCount = 0;

        if (playingBack) {
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}k: ${whiteEsc}Faster playback  ` : "  Faster playback  ";
            buttons[buttonCount].hotkey = [UP_KEY, UP_ARROW, NUMPAD_8];
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}j: ${whiteEsc}Slower playback  ` : "  Slower playback  ";
            buttons[buttonCount].hotkey = [DOWN_KEY, DOWN_ARROW, NUMPAD_2];
            buttonCount++;
            buttons[buttonCount].text = `    ${darkGrayEsc}---`;
            buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `${yellowEsc}0-9: ${whiteEsc}Fast forward to turn  ` : "  Fast forward to turn  ";
            buttons[buttonCount].hotkey = ["0".charCodeAt(0)];
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}<:${whiteEsc} Previous Level  ` : "  Previous Level  ";
            buttons[buttonCount].hotkey = [ASCEND_KEY];
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}>:${whiteEsc} Next Level  ` : "  Next Level  ";
            buttons[buttonCount].hotkey = [DESCEND_KEY];
            buttonCount++;
            buttons[buttonCount].text = `    ${darkGrayEsc}---`;
            buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
            buttonCount++;
        } else {
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}Z: ${whiteEsc}Rest until better  ` : "  Rest until better  ";
            buttons[buttonCount].hotkey = [AUTO_REST_KEY];
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}A: ${whiteEsc}Autopilot  ` : "  Autopilot  ";
            buttons[buttonCount].hotkey = [AUTOPLAY_KEY];
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}T: ${whiteEsc}Re-throw at last monster  ` : "  Re-throw at last monster  ";
            buttons[buttonCount].hotkey = [RETHROW_KEY];
            buttonCount++;
            if (ctx.rogue.mode !== ctx.GAME_MODE_EASY) {
                buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}&: ${whiteEsc}Easy mode  ` : "  Easy mode  ";
                buttons[buttonCount].hotkey = [EASY_MODE_KEY];
                buttonCount++;
            }
            buttons[buttonCount].text = `    ${darkGrayEsc}---`;
            buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
            buttonCount++;
        }

        // Shared options
        buttons[buttonCount].text = KEYBOARD_LABELS
            ? `  ${yellowEsc}\\: ${whiteEsc}[${ctx.rogue.trueColorMode ? "X" : " "}] Hide color effects  `
            : `  [${ctx.rogue.trueColorMode ? " " : "X"}] Hide color effects  `;
        buttons[buttonCount].hotkey = [TRUE_COLORS_KEY];
        takeActionOurselves[buttonCount] = true;
        buttonCount++;

        buttons[buttonCount].text = KEYBOARD_LABELS
            ? `  ${yellowEsc}]: ${whiteEsc}[${ctx.rogue.displayStealthRangeMode ? "X" : " "}] Display stealth range  `
            : `  [${ctx.rogue.displayStealthRangeMode ? "X" : " "}] Show stealth range  `;
        buttons[buttonCount].hotkey = [STEALTH_RANGE_KEY];
        takeActionOurselves[buttonCount] = true;
        buttonCount++;

        if (ctx.hasGraphics) {
            const gModeChar = " X"[ctx.graphicsMode] ?? " ";
            buttons[buttonCount].text = KEYBOARD_LABELS
                ? `  ${yellowEsc}G: ${whiteEsc}[${gModeChar}] Enable graphics  `
                : `  [${gModeChar}] Enable graphics  `;
            buttons[buttonCount].hotkey = [GRAPHICS_KEY];
            takeActionOurselves[buttonCount] = true;
            buttonCount++;
        }

        buttons[buttonCount].text = `    ${darkGrayEsc}---`;
        buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
        buttonCount++;

        buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}F: ${whiteEsc}Feats             ` : "  Feats             ";
        buttons[buttonCount].hotkey = [FEATS_KEY];
        buttonCount++;

        buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}D: ${whiteEsc}Discovered items  ` : "  Discovered items  ";
        buttons[buttonCount].hotkey = [DISCOVERIES_KEY];

        if (ctx.DEBUG) {
            buttonCount++;
            buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}C: ${whiteEsc}Create item or monster  ` : "  Create item or monster  ";
            buttons[buttonCount].hotkey = [CREATE_ITEM_MONSTER_KEY];
        }
        buttonCount++;

        buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}~: ${whiteEsc}View dungeon seed  ` : "  View dungeon seed  ";
        buttons[buttonCount].hotkey = [SEED_KEY];
        buttonCount++;

        if (KEYBOARD_LABELS) {
            buttons[buttonCount].text = `  ${yellowEsc}?: ${whiteEsc}Help  `;
            buttons[buttonCount].hotkey = [BROGUE_HELP_KEY];
            buttonCount++;
        }

        buttons[buttonCount].text = `    ${darkGrayEsc}---`;
        buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
        buttonCount++;

        if (!ctx.serverMode) {
            if (playingBack) {
                buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}O: ${whiteEsc}Open saved game  ` : "  Open saved game  ";
                buttons[buttonCount].hotkey = [LOAD_SAVED_GAME_KEY];
                buttonCount++;
                buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}V: ${whiteEsc}View saved recording  ` : "  View saved recording  ";
                buttons[buttonCount].hotkey = [VIEW_RECORDING_KEY];
                buttonCount++;
            } else {
                buttons[buttonCount].text = KEYBOARD_LABELS ? `  ${yellowEsc}S: ${whiteEsc}Save and exit  ` : "  Save and exit  ";
                buttons[buttonCount].hotkey = [SAVE_GAME_KEY];
                buttonCount++;
            }
        }

        buttons[buttonCount].text = KEYBOARD_LABELS
            ? `  ${yellowEsc}Q: ${whiteEsc}Quit ${playingBack ? "to title screen" : "and abandon game"}  `
            : `  Quit ${playingBack ? "to title screen" : "and abandon game"}  `;
        buttons[buttonCount].hotkey = [QUIT_KEY];
        buttonCount++;

        buttons[buttonCount].text = " ";
        buttons[buttonCount].flags &= ~ButtonFlag.B_ENABLED;
        buttonCount++;

        // Layout
        let longestName = 0;
        for (let i = 0; i < buttonCount; i++) {
            longestName = Math.max(longestName, ctx.strLenWithoutEscapes(buttons[i].text));
        }
        if (x + longestName >= COLS) {
            x = COLS - longestName - 1;
        }
        const y = ROWS - buttonCount;
        for (let i = 0; i < buttonCount; i++) {
            buttons[i].x = x;
            buttons[i].y = y + i;
            const padLen = longestName - ctx.strLenWithoutEscapes(buttons[i].text);
            buttons[i].text += " ".repeat(padLen);
        }

        const rbuf = ctx.saveDisplayBuffer();
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.rectangularShading(x - 1, y, longestName + 2, buttonCount, black, Math.floor(INTERFACE_OPACITY / 2), dbuf);
        ctx.overlayDisplayBuffer(dbuf);
        buttonChosen = await ctx.buttonInputLoop(buttons, buttonCount, x - 1, y, longestName + 2, buttonCount, null);
        ctx.restoreDisplayBuffer(rbuf);

        if (buttonChosen === -1) {
            return -1;
        } else if (takeActionOurselves[buttonChosen]) {
            const theEvent: RogueEvent = {
                eventType: EventType.Keystroke,
                param1: buttons[buttonChosen].hotkey[0],
                param2: 0,
                shiftKey: false,
                controlKey: false,
            };
            await executeEvent(ctx, theEvent, executeMouseClick, (ax, pb) => actionMenu(ctx, ax, pb));
        } else {
            return buttons[buttonChosen].hotkey[0];
        }
    } while (takeActionOurselves[buttonChosen]);

    return -1;
}
