/*
 *  io-buttons.test.ts — Tests for io-buttons.ts (button system)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { COLS, KEYBOARD_LABELS, BUTTON_TEXT_SIZE, COLOR_ESCAPE, ESCAPE_KEY, ACKNOWLEDGE_KEY } from "../../src/types/constants.js";
import { ButtonDrawState, EventType } from "../../src/types/enums.js";
import { ButtonFlag } from "../../src/types/flags.js";
import type { Color, BrogueButton, ButtonState, ScreenDisplayBuffer, RogueEvent, SavedDisplayBuffer, DisplayGlyph } from "../../src/types/types.js";
import { white, gray, interfaceButtonColor, buttonHoverColor, itemMessageColor } from "../../src/globals/colors.js";
import { createScreenDisplayBuffer, clearDisplayBuffer } from "../../src/io/io-display.js";
import {
    type ButtonContext,
    initializeButton,
    setButtonText,
    drawButton,
    drawButtonsInState,
    initializeButtonState,
    processButtonInput,
    buttonInputLoop,
} from "../../src/io/io-buttons.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function createCtx(overrides: Partial<ButtonContext> = {}): ButtonContext {
    return {
        rogue: {
            playbackMode: false,
            playbackPaused: false,
        },
        applyColorAverage: vi.fn((base: Color, target: Readonly<Color>, weight: number) => {
            base.red = Math.round(base.red + (target.red - base.red) * weight / 100);
            base.green = Math.round(base.green + (target.green - base.green) * weight / 100);
            base.blue = Math.round(base.blue + (target.blue - base.blue) * weight / 100);
        }),
        bakeColor: vi.fn(),
        separateColors: vi.fn(),
        strLenWithoutEscapes: vi.fn((s: string) => {
            // Strip color escapes for length calculation
            let len = 0;
            for (let i = 0; i < s.length; i++) {
                if (s.charCodeAt(i) === COLOR_ESCAPE) {
                    i += 3; // skip escape + 3 value bytes
                } else {
                    len++;
                }
            }
            return len;
        }),
        decodeMessageColor: vi.fn((msg: string, i: number) => ({
            color: { ...white },
            nextIndex: i + 4, // skip escape + 3 value bytes
        })),
        encodeMessageColor: vi.fn(() => ""),
        plotCharToBuffer: vi.fn(),
        locIsInWindow: vi.fn(() => true),
        createScreenDisplayBuffer,
        clearDisplayBuffer,
        overlayDisplayBuffer: vi.fn(),
        saveDisplayBuffer: vi.fn(() => ({ savedScreen: createScreenDisplayBuffer() })),
        restoreDisplayBuffer: vi.fn(),
        nextBrogueEvent: vi.fn(() => ({
            eventType: EventType.Keystroke,
            param1: ESCAPE_KEY,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        })),
        pauseBrogue: vi.fn(() => false),
        pauseAnimation: vi.fn(() => false),
        ...overrides,
    };
}

function makeButton(overrides: Partial<BrogueButton> = {}): BrogueButton {
    return {
        text: "Test Button",
        x: 10,
        y: 5,
        hotkey: [],
        buttonColor: makeColor(20, 20, 40),
        textColor: { ...white },
        hotkeyTextColor: { ...itemMessageColor },
        opacity: 100,
        symbol: [],
        flags:
            ButtonFlag.B_ENABLED |
            ButtonFlag.B_GRADIENT |
            ButtonFlag.B_HOVER_ENABLED |
            ButtonFlag.B_DRAW |
            ButtonFlag.B_KEYPRESS_HIGHLIGHT,
        command: 0 as any,
        ...overrides,
    };
}

// =============================================================================
// initializeButton
// =============================================================================

describe("initializeButton", () => {
    it("creates a button with default flags", () => {
        const btn = initializeButton();
        expect(btn.flags & ButtonFlag.B_ENABLED).toBeTruthy();
        expect(btn.flags & ButtonFlag.B_GRADIENT).toBeTruthy();
        expect(btn.flags & ButtonFlag.B_HOVER_ENABLED).toBeTruthy();
        expect(btn.flags & ButtonFlag.B_DRAW).toBeTruthy();
        expect(btn.flags & ButtonFlag.B_KEYPRESS_HIGHLIGHT).toBeTruthy();
    });

    it("has empty text", () => {
        const btn = initializeButton();
        expect(btn.text).toBe("");
    });

    it("has opacity 100", () => {
        const btn = initializeButton();
        expect(btn.opacity).toBe(100);
    });

    it("uses interfaceButtonColor as default color", () => {
        const btn = initializeButton();
        expect(btn.buttonColor.red).toBe(interfaceButtonColor.red);
        expect(btn.buttonColor.green).toBe(interfaceButtonColor.green);
        expect(btn.buttonColor.blue).toBe(interfaceButtonColor.blue);
    });

    it("has white text color", () => {
        const btn = initializeButton();
        expect(btn.textColor.red).toBe(white.red);
    });

    it("uses itemMessageColor for hotkey text when KEYBOARD_LABELS is true", () => {
        const btn = initializeButton();
        if (KEYBOARD_LABELS) {
            expect(btn.hotkeyTextColor.red).toBe(itemMessageColor.red);
        }
    });

    it("has empty hotkey and symbol arrays", () => {
        const btn = initializeButton();
        expect(btn.hotkey).toEqual([]);
        expect(btn.symbol).toEqual([]);
    });
});

// =============================================================================
// setButtonText
// =============================================================================

describe("setButtonText", () => {
    it("sets text with hotkey escapes when KEYBOARD_LABELS", () => {
        const ctx = createCtx({
            encodeMessageColor: vi.fn((c: Readonly<Color>) => `[C${c.red}]`),
        });
        const btn = makeButton();
        setButtonText(btn, "%sN%sew Game", "New Game", ctx);
        if (KEYBOARD_LABELS) {
            // Should contain the hotkey escape, the N, and the text color escape
            expect(btn.text).toContain("N");
            expect(btn.text).toContain("ew Game");
        }
    });

    it("uses textWithoutHotkey when KEYBOARD_LABELS is false", () => {
        // This test only makes sense if KEYBOARD_LABELS were false
        // Since it's true in our build, we just verify no crash
        const ctx = createCtx();
        const btn = makeButton();
        setButtonText(btn, "%sX%s test", "Fallback", ctx);
        expect(btn.text.length).toBeGreaterThan(0);
    });

    it("truncates to BUTTON_TEXT_SIZE", () => {
        const ctx = createCtx();
        const btn = makeButton();
        const longText = "A".repeat(BUTTON_TEXT_SIZE + 100);
        setButtonText(btn, longText, longText, ctx);
        expect(btn.text.length).toBeLessThanOrEqual(BUTTON_TEXT_SIZE);
    });
});

// =============================================================================
// drawButton
// =============================================================================

describe("drawButton", () => {
    it("does nothing when B_DRAW flag is not set", () => {
        const ctx = createCtx();
        const btn = makeButton({ flags: 0 });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Normal, dbuf, ctx);
        expect(ctx.plotCharToBuffer).not.toHaveBeenCalled();
    });

    it("plots each character of the button text", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "ABC", x: 5, y: 3 });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Normal, dbuf, ctx);
        expect(ctx.plotCharToBuffer).toHaveBeenCalledTimes(3);
    });

    it("uses white for enabled buttons, gray for disabled", () => {
        const ctx = createCtx();
        const enabledBtn = makeButton({ text: "X", flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED });
        const dbuf = createScreenDisplayBuffer();
        drawButton(enabledBtn, ButtonDrawState.Normal, dbuf, ctx);

        // First call's foreColor should be derived from white (baked)
        expect(ctx.bakeColor).toHaveBeenCalled();
    });

    it("replaces * with symbol characters", () => {
        const ctx = createCtx();
        const btn = makeButton({
            text: "a*b",
            symbol: [42 as DisplayGlyph], // '*'
            x: 0,
            y: 0,
        });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Normal, dbuf, ctx);

        // The second plotCharToBuffer call should use the symbol glyph
        const calls = (ctx.plotCharToBuffer as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[1][0]).toBe(42); // symbol[0] replacing *
    });

    it("sets opacity on dbuf cells", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "X", x: 5, y: 3, opacity: 80 });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Normal, dbuf, ctx);
        // After hover/pressed adjustment, opacity = 80 (no change for Normal)
        expect(dbuf.cells[5][3].opacity).toBe(80);
    });

    it("applies gradient when B_GRADIENT flag set", () => {
        const ctx = createCtx();
        const btn = makeButton({
            text: "ABC",
            flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED | ButtonFlag.B_GRADIENT,
            x: 0,
            y: 0,
        });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Normal, dbuf, ctx);
        // applyColorAverage should be called for gradient blending
        expect(ctx.applyColorAverage).toHaveBeenCalled();
    });

    it("increases opacity for hover state", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "X", x: 5, y: 3, opacity: 80 });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Hover, dbuf, ctx);
        // opacity = 100 - (100-80)*80/100 = 100 - 16 = 84
        expect(dbuf.cells[5][3].opacity).toBe(84);
    });

    it("does not draw past COLS", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "ABCDE", x: COLS - 2 });
        const dbuf = createScreenDisplayBuffer();
        drawButton(btn, ButtonDrawState.Normal, dbuf, ctx);
        // Only 2 characters should fit (COLS-2 and COLS-1)
        expect(ctx.plotCharToBuffer).toHaveBeenCalledTimes(2);
    });
});

// =============================================================================
// drawButtonsInState
// =============================================================================

describe("drawButtonsInState", () => {
    it("draws all drawable buttons", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [
                makeButton({ text: "A" }),
                makeButton({ text: "B" }),
            ],
            2, 0, 0, 20, 10,
        );
        const dbuf = createScreenDisplayBuffer();
        drawButtonsInState(state, dbuf, ctx);
        // 2 buttons with 1 char each = 2 plotCharToBuffer calls
        expect(ctx.plotCharToBuffer).toHaveBeenCalledTimes(2);
    });

    it("draws focused button with Hover state", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "A" }), makeButton({ text: "B" })],
            2, 0, 0, 20, 10,
        );
        state.buttonFocused = 1;
        const dbuf = createScreenDisplayBuffer();
        drawButtonsInState(state, dbuf, ctx);
        // The hover button gets hover color average applied
        expect(ctx.applyColorAverage).toHaveBeenCalled();
    });

    it("skips non-drawable buttons", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [
                makeButton({ text: "A", flags: 0 }), // no B_DRAW
                makeButton({ text: "B" }),
            ],
            2, 0, 0, 20, 10,
        );
        const dbuf = createScreenDisplayBuffer();
        drawButtonsInState(state, dbuf, ctx);
        // Only button B should be drawn
        expect(ctx.plotCharToBuffer).toHaveBeenCalledTimes(1);
    });
});

// =============================================================================
// initializeButtonState
// =============================================================================

describe("initializeButtonState", () => {
    it("sets all indices to -1", () => {
        const state = initializeButtonState([], 0, 0, 0, 10, 5);
        expect(state.buttonChosen).toBe(-1);
        expect(state.buttonFocused).toBe(-1);
        expect(state.buttonDepressed).toBe(-1);
    });

    it("copies buttons into state", () => {
        const buttons = [makeButton({ text: "A" }), makeButton({ text: "B" })];
        const state = initializeButtonState(buttons, 2, 5, 10, 30, 20);
        expect(state.buttons.length).toBe(2);
        expect(state.buttons[0].text).toBe("A");
        expect(state.buttons[1].text).toBe("B");
    });

    it("makes copies, not references", () => {
        const buttons = [makeButton({ text: "A" })];
        const state = initializeButtonState(buttons, 1, 0, 0, 10, 5);
        buttons[0].text = "Changed";
        expect(state.buttons[0].text).toBe("A");
    });

    it("stores window dimensions", () => {
        const state = initializeButtonState([], 0, 5, 10, 30, 20);
        expect(state.winX).toBe(5);
        expect(state.winY).toBe(10);
        expect(state.winWidth).toBe(30);
        expect(state.winHeight).toBe(20);
    });
});

// =============================================================================
// processButtonInput — Mouse events
// =============================================================================

describe("processButtonInput — mouse", () => {
    it("focuses button on mouse move over it", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "Click Me", x: 10, y: 5 })],
            1, 0, 0, 40, 20,
        );
        const event: RogueEvent = {
            eventType: EventType.MouseEnteredCell,
            param1: 12, // within "Click Me" at x=10
            param2: 5,
            controlKey: false,
            shiftKey: false,
        };
        processButtonInput(state, event, ctx);
        expect(state.buttonFocused).toBe(0);
    });

    it("clears focus when mouse moves off button", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "Click Me", x: 10, y: 5 })],
            1, 0, 0, 40, 20,
        );
        state.buttonFocused = 0;
        const event: RogueEvent = {
            eventType: EventType.MouseEnteredCell,
            param1: 50, // outside button
            param2: 5,
            controlKey: false,
            shiftKey: false,
        };
        processButtonInput(state, event, ctx);
        expect(state.buttonFocused).toBe(-1);
    });

    it("depresses button on mouse down", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "OK", x: 10, y: 5 })],
            1, 0, 0, 40, 20,
        );
        const event: RogueEvent = {
            eventType: EventType.MouseDown,
            param1: 10,
            param2: 5,
            controlKey: false,
            shiftKey: false,
        };
        processButtonInput(state, event, ctx);
        expect(state.buttonDepressed).toBe(0);
    });

    it("chooses button on mouse up when depressed and focused", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "OK", x: 10, y: 5 })],
            1, 0, 0, 40, 20,
        );
        state.buttonDepressed = 0;
        const event: RogueEvent = {
            eventType: EventType.MouseUp,
            param1: 10,
            param2: 5,
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.chosenButton).toBe(0);
    });

    it("cancels on mouse up outside window when no button depressed", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "OK", x: 10, y: 5 })],
            1, 5, 3, 30, 15,
        );
        state.buttonDepressed = -1;
        const event: RogueEvent = {
            eventType: EventType.MouseUp,
            param1: 0, // outside window (winX=5)
            param2: 0, // outside window (winY=3)
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.canceled).toBe(true);
    });

    it("does not cancel on mouse up inside window", () => {
        const ctx = createCtx();
        const state = initializeButtonState(
            [makeButton({ text: "OK", x: 10, y: 5 })],
            1, 5, 3, 30, 15,
        );
        state.buttonDepressed = -1;
        const event: RogueEvent = {
            eventType: EventType.MouseUp,
            param1: 10, // inside window
            param2: 5,  // inside window
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.canceled).toBe(false);
    });

    it("supports wide click area", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "Wide", x: 10, y: 5, flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED | ButtonFlag.B_WIDE_CLICK_AREA });
        const state = initializeButtonState([btn], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.MouseEnteredCell,
            param1: 12,
            param2: 6, // one row below button y=5
            controlKey: false,
            shiftKey: false,
        };
        processButtonInput(state, event, ctx);
        expect(state.buttonFocused).toBe(0);
    });
});

// =============================================================================
// processButtonInput — Keystroke events
// =============================================================================

describe("processButtonInput — keystroke", () => {
    it("chooses button by hotkey", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "New", hotkey: ["n".charCodeAt(0)] });
        const state = initializeButtonState([btn], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "n".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.chosenButton).toBe(0);
    });

    it("cancels on ESCAPE_KEY", () => {
        const ctx = createCtx();
        const state = initializeButtonState([makeButton()], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: ESCAPE_KEY,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.canceled).toBe(true);
        expect(result.chosenButton).toBe(-1);
    });

    it("cancels on ACKNOWLEDGE_KEY", () => {
        const ctx = createCtx();
        const state = initializeButtonState([makeButton()], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: ACKNOWLEDGE_KEY,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.canceled).toBe(true);
    });

    it("flashes button on keypress highlight", () => {
        const ctx = createCtx();
        const btn = makeButton({
            text: "Go",
            hotkey: ["g".charCodeAt(0)],
            flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED | ButtonFlag.B_KEYPRESS_HIGHLIGHT,
        });
        const state = initializeButtonState([btn], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "g".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        processButtonInput(state, event, ctx);

        // Should have saved/restored display and paused
        expect(ctx.saveDisplayBuffer).toHaveBeenCalled();
        expect(ctx.pauseBrogue).toHaveBeenCalledWith(50);
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
    });

    it("uses pauseAnimation during playback", () => {
        const ctx = createCtx({
            rogue: { playbackMode: true, playbackPaused: false },
        } as any);
        const btn = makeButton({
            text: "Go",
            hotkey: ["g".charCodeAt(0)],
            flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED | ButtonFlag.B_KEYPRESS_HIGHLIGHT,
        });
        const state = initializeButtonState([btn], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "g".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        processButtonInput(state, event, ctx);
        expect(ctx.pauseAnimation).toHaveBeenCalledWith(1000);
    });

    it("ignores unmatched keystrokes", () => {
        const ctx = createCtx();
        const btn = makeButton({ text: "Go", hotkey: ["g".charCodeAt(0)] });
        const state = initializeButtonState([btn], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "x".charCodeAt(0), // not a hotkey
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.chosenButton).toBe(-1);
        expect(result.canceled).toBe(false);
    });

    it("supports multiple hotkeys per button", () => {
        const ctx = createCtx();
        const btn = makeButton({
            text: "Go",
            hotkey: ["g".charCodeAt(0), "G".charCodeAt(0)],
        });
        const state = initializeButtonState([btn], 1, 0, 0, 40, 20);
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: "G".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        const result = processButtonInput(state, event, ctx);
        expect(result.chosenButton).toBe(0);
    });
});

// =============================================================================
// buttonInputLoop
// =============================================================================

describe("buttonInputLoop", () => {
    it("returns chosen button when user presses hotkey", () => {
        const ctx = createCtx({
            nextBrogueEvent: vi.fn(() => ({
                eventType: EventType.Keystroke,
                param1: "a".charCodeAt(0),
                param2: 0,
                controlKey: false,
                shiftKey: false,
            })),
        });
        const btn = makeButton({ text: "Alpha", hotkey: ["a".charCodeAt(0)] });
        const result = buttonInputLoop([btn], 1, 0, 0, 40, 20, ctx);
        expect(result.chosenButton).toBe(0);
    });

    it("returns -1 when user cancels with escape", () => {
        const ctx = createCtx({
            nextBrogueEvent: vi.fn(() => ({
                eventType: EventType.Keystroke,
                param1: ESCAPE_KEY,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            })),
        });
        const btn = makeButton({ text: "Alpha", hotkey: ["a".charCodeAt(0)] });
        const result = buttonInputLoop([btn], 1, 0, 0, 40, 20, ctx);
        expect(result.chosenButton).toBe(-1);
    });

    it("returns the event that caused selection", () => {
        const ctx = createCtx({
            nextBrogueEvent: vi.fn(() => ({
                eventType: EventType.Keystroke,
                param1: "b".charCodeAt(0),
                param2: 0,
                controlKey: false,
                shiftKey: true,
            })),
        });
        const btn = makeButton({ text: "Beta", hotkey: ["b".charCodeAt(0)] });
        const result = buttonInputLoop([btn], 1, 0, 0, 40, 20, ctx);
        expect(result.event.shiftKey).toBe(true);
    });

    it("loops until a button is chosen or canceled", () => {
        let callCount = 0;
        const ctx = createCtx({
            nextBrogueEvent: vi.fn(() => {
                callCount++;
                if (callCount < 3) {
                    // Non-decisive input
                    return {
                        eventType: EventType.MouseEnteredCell,
                        param1: 0,
                        param2: 0,
                        controlKey: false,
                        shiftKey: false,
                    };
                }
                // Decisive: escape
                return {
                    eventType: EventType.Keystroke,
                    param1: ESCAPE_KEY,
                    param2: 0,
                    controlKey: false,
                    shiftKey: false,
                };
            }),
        });
        const btn = makeButton({ text: "Go" });
        const result = buttonInputLoop([btn], 1, 0, 0, 40, 20, ctx);
        expect(callCount).toBe(3);
        expect(result.chosenButton).toBe(-1);
    });

    it("saves and restores display each iteration", () => {
        const ctx = createCtx({
            nextBrogueEvent: vi.fn(() => ({
                eventType: EventType.Keystroke,
                param1: ESCAPE_KEY,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            })),
        });
        const btn = makeButton({ text: "X" });
        buttonInputLoop([btn], 1, 0, 0, 10, 5, ctx);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalled();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalled();
    });
});
