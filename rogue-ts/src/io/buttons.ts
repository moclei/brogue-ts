/*
 *  io/buttons.ts — Button system: drawing, state management, input loop
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/io/io-buttons.ts
 *  Source C: src/brogue/Buttons.c
 *  Functions: initializeButton, setButtonText, drawButton, drawButtonsInState,
 *             initializeButtonState, processButtonInput, buttonInputLoop
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    BrogueButton,
    ButtonState,
    ScreenDisplayBuffer,
    RogueEvent,
    SavedDisplayBuffer,
} from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { ButtonDrawState, EventType } from "../types/enums.js";
import { COLS, KEYBOARD_LABELS, BUTTON_TEXT_SIZE, COLOR_ESCAPE, ESCAPE_KEY, ACKNOWLEDGE_KEY } from "../types/constants.js";
import { ButtonFlag } from "../types/flags.js";
import { white, gray, interfaceButtonColor, buttonHoverColor, itemMessageColor } from "../globals/colors.js";
import { colorDiff } from "./color.js";
import { smoothHiliteGradient } from "./sidebar-player.js";

// =============================================================================
// DI Context
// =============================================================================

/**
 * Dependency-injection context for button functions.
 * Matches the ButtonContext interface in ui.ts structurally.
 */
export interface ButtonContext {
    rogue: {
        playbackMode: boolean;
        playbackPaused: boolean;
    };

    applyColorAverage(base: Color, target: Readonly<Color>, weight: number): void;
    bakeColor(color: Color): void;
    separateColors(foreColor: Color, backColor: Color): void;

    strLenWithoutEscapes(s: string): number;
    decodeMessageColor(msg: string, i: number): { color: Color; nextIndex: number };
    encodeMessageColor(theColor: Readonly<Color>): string;

    plotCharToBuffer(
        inputChar: DisplayGlyph,
        x: number,
        y: number,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): void;

    locIsInWindow(pos: { windowX: number; windowY: number }): boolean;

    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;

    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInputEvenInPlayback: boolean): Promise<RogueEvent>;
    pauseBrogue(milliseconds: number): Promise<boolean>;
    pauseAnimation(milliseconds: number): Promise<boolean>;
}

// =============================================================================
// initializeButton — Buttons.c:124
// =============================================================================

/**
 * Create a fully initialized button with default flags and colors.
 *
 * C: `initializeButton` in Buttons.c
 */
export function initializeButton(): BrogueButton {
    return {
        text: "",
        x: 0,
        y: 0,
        hotkey: [],
        buttonColor: { ...interfaceButtonColor },
        textColor: { ...white },
        hotkeyTextColor: KEYBOARD_LABELS ? { ...itemMessageColor } : { ...white },
        opacity: 100,
        symbol: [],
        flags:
            ButtonFlag.B_ENABLED |
            ButtonFlag.B_GRADIENT |
            ButtonFlag.B_HOVER_ENABLED |
            ButtonFlag.B_DRAW |
            ButtonFlag.B_KEYPRESS_HIGHLIGHT,
        command: 0 as never,
    };
}

// =============================================================================
// setButtonText — Buttons.c:140
// =============================================================================

/**
 * Sets button text with optional hotkey color escapes.
 *
 * `textWithHotkey` should contain two `%s` placeholders for the hotkey
 * color start and end escapes (e.g. `"%sN%sew Game"`).
 *
 * C: `setButtonText` in Buttons.c
 */
export function setButtonText(
    button: BrogueButton,
    textWithHotkey: string,
    textWithoutHotkey: string,
    ctx: ButtonContext,
): void {
    const textColorEscape = ctx.encodeMessageColor(button.textColor);
    const hotkeyColorEscape = ctx.encodeMessageColor(button.hotkeyTextColor);

    let text: string;
    if (KEYBOARD_LABELS) {
        text = textColorEscape + textWithHotkey
            .replace("%s", hotkeyColorEscape)
            .replace("%s", textColorEscape);
    } else {
        text = textColorEscape + textWithoutHotkey;
    }

    button.text = text.slice(0, BUTTON_TEXT_SIZE - 1);
}

// =============================================================================
// drawButton — Buttons.c:41
// =============================================================================

/**
 * Draw a single button to a display buffer (or to screen if dbuf is null).
 *
 * C: `drawButton` in Buttons.c
 */
export function drawButton(
    button: BrogueButton,
    highlight: ButtonDrawState,
    dbuf: ScreenDisplayBuffer | null,
    ctx: ButtonContext,
): void {
    if (!(button.flags & ButtonFlag.B_DRAW)) return;

    const width = ctx.strLenWithoutEscapes(button.text);
    const fColorBase: Color = (button.flags & ButtonFlag.B_ENABLED)
        ? { ...white }
        : { ...gray };
    const bColorBase: Color = { ...button.buttonColor };

    const black0: Color = { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };

    if (highlight === ButtonDrawState.Hover && (button.flags & ButtonFlag.B_HOVER_ENABLED)) {
        ctx.applyColorAverage(fColorBase, buttonHoverColor, 25);
        ctx.applyColorAverage(bColorBase, buttonHoverColor, 25);
    }

    const bColorEdge: Color = { ...bColorBase };
    const bColorMid: Color = { ...bColorBase };
    ctx.applyColorAverage(bColorEdge, black0, 50);

    if (highlight === ButtonDrawState.Pressed) {
        ctx.applyColorAverage(bColorMid, black0, 75);
        if (colorDiff(bColorMid, bColorBase) < 50) {
            Object.assign(bColorMid, bColorBase);
            ctx.applyColorAverage(bColorMid, buttonHoverColor, 50);
        }
    }

    let bColor: Color = { ...bColorMid };

    let opacity = button.opacity;
    if (highlight === ButtonDrawState.Hover || highlight === ButtonDrawState.Pressed) {
        opacity = 100 - Math.trunc((100 - opacity) * opacity / 100);
    }

    let symbolNumber = 0;
    let currentFColor: Color = { ...fColorBase };

    for (let i = 0, textLoc = 0; i < width && i + button.x < COLS; i++, textLoc++) {
        while (textLoc < button.text.length && button.text.charCodeAt(textLoc) === COLOR_ESCAPE) {
            const decoded = ctx.decodeMessageColor(button.text, textLoc);
            currentFColor = decoded.color;
            textLoc = decoded.nextIndex;
        }

        const fColor: Color = { ...currentFColor };

        if (button.flags & ButtonFlag.B_GRADIENT) {
            const midPercent = smoothHiliteGradient(i, width - 1);
            Object.assign(bColor, bColorEdge);
            ctx.applyColorAverage(bColor, bColorMid, midPercent);
        }

        if (highlight === ButtonDrawState.Pressed) {
            ctx.applyColorAverage(fColor, bColor, 30);
        }

        if (button.opacity < 100) {
            ctx.applyColorAverage(fColor, bColor, 100 - opacity);
        }

        ctx.bakeColor(fColor);
        ctx.bakeColor(bColor);
        ctx.separateColors(fColor, bColor);

        let displayCharacter: DisplayGlyph = button.text.charCodeAt(textLoc) as DisplayGlyph;
        if (button.text[textLoc] === "*") {
            if (symbolNumber < button.symbol.length && button.symbol[symbolNumber]) {
                displayCharacter = button.symbol[symbolNumber];
            }
            symbolNumber++;
        }

        if (ctx.locIsInWindow({ windowX: button.x + i, windowY: button.y })) {
            const targetBuf = dbuf ?? ctx.createScreenDisplayBuffer();
            ctx.plotCharToBuffer(displayCharacter, button.x + i, button.y, fColor, bColor, targetBuf);
            if (dbuf) {
                dbuf.cells[button.x + i][button.y].opacity = opacity;
            }
        }
    }
}

// =============================================================================
// drawButtonsInState — Buttons.c:159
// =============================================================================

/**
 * Draw all buttons according to the current state (normal/hover/pressed).
 *
 * C: `drawButtonsInState` in Buttons.c
 */
export function drawButtonsInState(
    state: ButtonState,
    dbuf: ScreenDisplayBuffer,
    ctx: ButtonContext,
): void {
    for (let i = 0; i < state.buttonCount; i++) {
        if (state.buttons[i].flags & ButtonFlag.B_DRAW) {
            let drawState = ButtonDrawState.Normal;
            if (i === state.buttonFocused) drawState = ButtonDrawState.Hover;
            if (i === state.buttonDepressed) drawState = ButtonDrawState.Pressed;
            drawButton(state.buttons[i], drawState, dbuf, ctx);
        }
    }
}

// =============================================================================
// initializeButtonState — Buttons.c:175
// =============================================================================

/**
 * Initialize a button state from an array of buttons and window dimensions.
 *
 * C: `initializeButtonState` in Buttons.c
 */
export function initializeButtonState(
    buttons: BrogueButton[],
    buttonCount: number,
    winX: number,
    winY: number,
    winWidth: number,
    winHeight: number,
): ButtonState {
    const state: ButtonState = {
        buttonChosen: -1,
        buttonFocused: -1,
        buttonDepressed: -1,
        buttonCount,
        buttons: [],
        winX,
        winY,
        winWidth,
        winHeight,
    };

    for (let i = 0; i < buttonCount; i++) {
        state.buttons[i] = { ...buttons[i] };
    }

    return state;
}

// =============================================================================
// processButtonInput — Buttons.c:203
// =============================================================================

export interface ProcessButtonResult {
    chosenButton: number;
    canceled: boolean;
}

/**
 * Process one round of user input and update the button state.
 *
 * C: `processButtonInput` in Buttons.c
 */
export async function processButtonInput(
    state: ButtonState,
    event: RogueEvent,
    ctx: ButtonContext,
): Promise<ProcessButtonResult> {
    let buttonUsed = false;
    let canceled = false;

    if (
        event.eventType === EventType.MouseDown ||
        event.eventType === EventType.MouseUp ||
        event.eventType === EventType.MouseEnteredCell
    ) {
        const x = event.param1;
        const y = event.param2;

        state.buttonFocused = -1;

        let focusIndex: number;
        for (focusIndex = 0; focusIndex < state.buttonCount; focusIndex++) {
            const btn = state.buttons[focusIndex];
            if (
                (btn.flags & ButtonFlag.B_DRAW) &&
                (btn.flags & ButtonFlag.B_ENABLED) &&
                (btn.y === y || ((btn.flags & ButtonFlag.B_WIDE_CLICK_AREA) && Math.abs(btn.y - y) <= 1)) &&
                x >= btn.x &&
                x < btn.x + ctx.strLenWithoutEscapes(btn.text)
            ) {
                state.buttonFocused = focusIndex;
                if (event.eventType === EventType.MouseDown) {
                    state.buttonDepressed = focusIndex;
                }
                break;
            }
        }
        if (focusIndex === state.buttonCount) {
            state.buttonFocused = -1;
        }

        if (event.eventType === EventType.MouseUp) {
            if (state.buttonDepressed === state.buttonFocused && state.buttonFocused >= 0) {
                buttonUsed = true;
            } else {
                if (
                    state.buttonDepressed < 0 &&
                    !(x >= state.winX && x < state.winX + state.winWidth &&
                      y >= state.winY && y < state.winY + state.winHeight)
                ) {
                    canceled = true;
                }
                state.buttonDepressed = -1;
            }
        }
    }

    if (event.eventType === EventType.Keystroke) {
        for (let i = 0; i < state.buttonCount; i++) {
            for (let k = 0; k < state.buttons[i].hotkey.length && state.buttons[i].hotkey[k]; k++) {
                if (event.param1 === state.buttons[i].hotkey[k]) {
                    if (state.buttons[i].flags & ButtonFlag.B_DRAW) {
                        if (state.buttons[i].flags & ButtonFlag.B_KEYPRESS_HIGHLIGHT) {
                            const rbuf = ctx.saveDisplayBuffer();
                            const dbuf = ctx.createScreenDisplayBuffer();
                            ctx.clearDisplayBuffer(dbuf);
                            drawButtonsInState(state, dbuf, ctx);
                            ctx.overlayDisplayBuffer(dbuf);

                            if (!ctx.rogue.playbackMode || ctx.rogue.playbackPaused) {
                                await ctx.pauseBrogue(50);
                            } else {
                                await ctx.pauseAnimation(1000);
                            }

                            ctx.restoreDisplayBuffer(rbuf);
                        }
                    }

                    state.buttonDepressed = i;
                    buttonUsed = true;
                    break;
                }
            }
            if (buttonUsed) break;
        }

        if (!buttonUsed && (event.param1 === ESCAPE_KEY || event.param1 === ACKNOWLEDGE_KEY)) {
            canceled = true;
        }
    }

    if (buttonUsed) {
        state.buttonChosen = state.buttonDepressed;
        return { chosenButton: state.buttonChosen, canceled: false };
    }
    return { chosenButton: -1, canceled };
}

// =============================================================================
// buttonInputLoop — Buttons.c:323
// =============================================================================

export interface ButtonInputResult {
    chosenButton: number;
    event: RogueEvent;
}

/**
 * Display buttons, collect input, and return the chosen button index.
 * Clicking outside the window region cancels (returns chosenButton = -1).
 *
 * C: `buttonInputLoop` in Buttons.c
 */
export async function buttonInputLoop(
    buttons: BrogueButton[],
    buttonCount: number,
    winX: number,
    winY: number,
    winWidth: number,
    winHeight: number,
    ctx: ButtonContext,
): Promise<ButtonInputResult> {
    const state = initializeButtonState(buttons, buttonCount, winX, winY, winWidth, winHeight);

    let chosenButton = -1;
    let canceled = false;
    let theEvent: RogueEvent = {
        eventType: EventType.EventError,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };

    do {
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        drawButtonsInState(state, dbuf, ctx);

        const rbuf = ctx.saveDisplayBuffer();
        ctx.overlayDisplayBuffer(dbuf);

        theEvent = await ctx.nextBrogueEvent(true, false, false);

        const result = await processButtonInput(state, theEvent, ctx);
        chosenButton = result.chosenButton;
        canceled = result.canceled;

        ctx.restoreDisplayBuffer(rbuf);

    } while (chosenButton === -1 && !canceled);

    return { chosenButton, event: theEvent };
}
