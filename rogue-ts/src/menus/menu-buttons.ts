/*
 *  menus/menu-buttons.ts — Menu button factory helpers
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/main-menu.ts (lines 640–752)
 *  Source C: src/brogue/MainMenu.c (functions: initializeMainMenuButton,
 *             stackButtons, initializeMenu)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueButton, ButtonState, ScreenDisplayBuffer } from "../types/types.js";
import { NGCommand } from "../types/enums.js";
import { ButtonFlag } from "../types/flags.js";
import { COLS, ROWS, INTERFACE_OPACITY } from "../types/constants.js";
import type { MenuContext } from "./menu-types.js";

// =============================================================================
// initializeMainMenuButton — MainMenu.c:250
// =============================================================================

/**
 * Initialize a single main menu button (without positioning).
 *
 * C: `initializeMainMenuButton` in MainMenu.c
 */
export function initializeMainMenuButton(
    textWithHotkey: string,
    hotkey1: number,
    hotkey2: number,
    command: NGCommand,
    ctx: MenuContext,
): BrogueButton {
    const button = ctx.initializeButton();

    const textWithoutHotkey = textWithHotkey.replace(/%s/g, "");
    ctx.setButtonText(button, textWithHotkey, textWithoutHotkey);

    button.hotkey = [hotkey1, hotkey2];
    button.flags |= ButtonFlag.B_WIDE_CLICK_AREA;
    button.buttonColor = { ...ctx.titleButtonColor };
    button.command = command;

    return button;
}

// =============================================================================
// stackButtons — MainMenu.c:310
// =============================================================================

/**
 * Stack buttons vertically, either top-to-bottom or bottom-to-top.
 *
 * C: `stackButtons` in MainMenu.c
 */
export function stackButtons(
    buttons: BrogueButton[],
    buttonCount: number,
    startX: number,
    startY: number,
    spacing: number,
    topToBottom: boolean,
): void {
    let y = startY;
    if (topToBottom) {
        for (let i = 0; i < buttonCount; i++) {
            buttons[i].x = startX;
            buttons[i].y = y;
            y += spacing;
        }
    } else {
        for (let i = buttonCount - 1; i >= 0; i--) {
            buttons[i].x = startX;
            buttons[i].y = y;
            y -= spacing;
        }
    }
}

// =============================================================================
// initializeMenu — MainMenu.c:330
// =============================================================================

/**
 * Initialize a menu from pre-positioned buttons, computing the frame from
 * button positions and text, then creating a shadow buffer.
 *
 * C: `initializeMenu` in MainMenu.c
 */
export function initializeMenu(
    buttons: BrogueButton[],
    buttonCount: number,
    ctx: MenuContext,
): { state: ButtonState; shadowBuf: ScreenDisplayBuffer } {
    let minX = COLS;
    let minY = ROWS;
    let maxX = 0;
    let maxY = 0;

    for (let i = 0; i < buttonCount; i++) {
        minX = Math.min(minX, buttons[i].x);
        maxX = Math.max(maxX, buttons[i].x + ctx.strLenWithoutEscapes(buttons[i].text));
        minY = Math.min(minY, buttons[i].y);
        maxY = Math.max(maxY, buttons[i].y);
    }

    const width = maxX - minX;
    const height = maxY - minY;

    const state = ctx.initializeButtonState(buttons, buttonCount, minX, minY, width, height);

    const shadowBuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(shadowBuf);
    ctx.rectangularShading(minX, minY, width, height + 1, ctx.black, INTERFACE_OPACITY, shadowBuf);

    return { state, shadowBuf };
}
