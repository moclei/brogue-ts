/*
 *  browser-renderer.ts — Canvas2D-based BrogueConsole for the browser
 *  brogue-ts
 *
 *  Renders the 100×34 character grid onto an HTML <canvas>, translating
 *  keyboard and mouse DOM events into RogueEvent objects.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueConsole } from "../types/platform.js";
import type { RogueEvent, PauseBehavior } from "../types/types.js";
import { EventType, GraphicsMode, DisplayGlyph } from "../types/enums.js";
import {
    COLS, ROWS,
    ESCAPE_KEY, RETURN_KEY, DELETE_KEY, TAB_KEY,
    UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW,
    NUMPAD_0, NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
    NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9,
    PRINTSCREEN_KEY,
} from "../types/constants.js";
import { glyphToUnicode } from "./glyph-map.js";

// =============================================================================
// Constants
// =============================================================================

/** Default monospace font for the grid. */
const DEFAULT_FONT = "monospace";

/** Polling interval (ms) while waiting for input with color dance. */
export const PAUSE_BETWEEN_EVENT_POLLING = 36;

// =============================================================================
// Internal state
// =============================================================================

/** Queued DOM events waiting to be consumed by the game loop. */
interface QueuedEvent {
    event: RogueEvent;
}

// =============================================================================
// BrowserRendererOptions
// =============================================================================

export interface BrowserRendererOptions {
    /** The <canvas> element to render to. */
    canvas: HTMLCanvasElement;

    /** Font family to use (default: "monospace"). */
    fontFamily?: string;

    /** Font size in pixels (auto-calculated from canvas size if omitted). */
    fontSize?: number;

    /**
     * Callback invoked from `gameLoop` to start the actual game.
     * Typically calls `rogueMain()`.
     */
    onGameLoop?: () => void;

    /**
     * Optional callback invoked when the game shuffles terrain colors.
     * Used for color-dance animation during input waits.
     */
    onColorsDance?: () => void;
}

// =============================================================================
// createBrowserConsole — factory function
// =============================================================================

/**
 * Creates a `BrogueConsole` implementation backed by an HTML Canvas2D context.
 *
 * The renderer:
 * - Divides the canvas into a COLS×ROWS grid of uniformly-sized cells.
 * - Implements `plotChar` by drawing Unicode glyphs (via `glyphToUnicode`) with
 *   foreground/background colors into each cell.
 * - Translates DOM keyboard and mouse events into `RogueEvent` objects.
 * - Provides async-compatible `pauseForMilliseconds` and `nextKeyOrMouseEvent`
 *   using a shared event queue.
 */
export function createBrowserConsole(options: BrowserRendererOptions): BrogueConsole & {
    /** Async wait for the next event — browser-specific extension. */
    waitForEvent(): Promise<RogueEvent>;
    /** Recalculate cell sizes after canvas resize. */
    handleResize(): void;
} {
    const { canvas, fontFamily = DEFAULT_FONT, onGameLoop } = options;
    const ctx2d = canvas.getContext("2d")!;

    // ---- Cell sizing ----
    let cellWidth = 0;
    let cellHeight = 0;
    let fontSize = options.fontSize ?? 0;

    function recalcCellSize(): void {
        if (options.fontSize) {
            fontSize = options.fontSize;
        } else {
            // Auto-size: pick the largest integer font size that fits
            fontSize = Math.max(1, Math.floor(Math.min(
                canvas.width / COLS,
                canvas.height / ROWS,
            )));
        }
        cellWidth = canvas.width / COLS;
        cellHeight = canvas.height / ROWS;
    }

    recalcCellSize();

    // ---- Event queue ----
    const eventQueue: QueuedEvent[] = [];
    let lastMouseCellX = -1;
    let lastMouseCellY = -1;

    /** Resolve function for the current `waitForEvent` promise, if any. */
    let resolveWait: ((ev: RogueEvent) => void) | null = null;

    function enqueueEvent(ev: RogueEvent): void {
        if (resolveWait) {
            const resolve = resolveWait;
            resolveWait = null;
            resolve(ev);
        } else {
            eventQueue.push({ event: ev });
        }
    }

    /**
     * Async wait for the next event — use this from async game loop code.
     * Exposed on the returned console as `waitForEvent`.
     */
    function _waitForEvent(): Promise<RogueEvent> {
        if (eventQueue.length > 0) {
            return Promise.resolve(eventQueue.shift()!.event);
        }
        return new Promise<RogueEvent>((resolve) => {
            resolveWait = resolve;
        });
    }

    function dequeueEventIfAvailable(): RogueEvent | null {
        if (eventQueue.length > 0) {
            return eventQueue.shift()!.event;
        }
        return null;
    }

    // ---- Coordinate mapping ----
    function pixelToCell(px: number, py: number): { x: number; y: number } {
        return {
            x: Math.min(COLS - 1, Math.max(0, Math.floor(px / cellWidth))),
            y: Math.min(ROWS - 1, Math.max(0, Math.floor(py / cellHeight))),
        };
    }

    // ---- DOM event handlers ----

    function translateKey(domEvent: KeyboardEvent): number | null {
        switch (domEvent.key) {
            case "Escape":      return ESCAPE_KEY;
            case "ArrowUp":     return UP_ARROW;
            case "ArrowDown":   return DOWN_ARROW;
            case "ArrowLeft":   return LEFT_ARROW;
            case "ArrowRight":  return RIGHT_ARROW;
            case "Enter":       return RETURN_KEY;
            case "Backspace":   return DELETE_KEY;
            case "Tab":         return TAB_KEY;
            case "PrintScreen": return PRINTSCREEN_KEY;
            default: break;
        }

        // Numpad digits
        if (domEvent.code.startsWith("Numpad") && domEvent.key.length === 1 && domEvent.key >= "0" && domEvent.key <= "9") {
            const numpadKeys = [NUMPAD_0, NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
                                NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9];
            return numpadKeys[parseInt(domEvent.key, 10)];
        }

        // Printable single characters
        if (domEvent.key.length === 1) {
            return domEvent.key.charCodeAt(0);
        }

        return null;
    }

    function onKeyDown(domEvent: KeyboardEvent): void {
        const keyCode = translateKey(domEvent);
        if (keyCode === null) return;

        domEvent.preventDefault();

        enqueueEvent({
            eventType: EventType.Keystroke,
            param1: keyCode,
            param2: 0,
            controlKey: domEvent.ctrlKey || domEvent.metaKey,
            shiftKey: domEvent.shiftKey,
        });
    }

    function onMouseDown(domEvent: MouseEvent): void {
        const rect = canvas.getBoundingClientRect();
        const { x, y } = pixelToCell(domEvent.clientX - rect.left, domEvent.clientY - rect.top);
        const eventType = domEvent.button === 2 ? EventType.RightMouseDown : EventType.MouseDown;

        enqueueEvent({
            eventType,
            param1: x,
            param2: y,
            controlKey: domEvent.ctrlKey || domEvent.metaKey,
            shiftKey: domEvent.shiftKey,
        });
    }

    function onMouseUp(domEvent: MouseEvent): void {
        const rect = canvas.getBoundingClientRect();
        const { x, y } = pixelToCell(domEvent.clientX - rect.left, domEvent.clientY - rect.top);
        const eventType = domEvent.button === 2 ? EventType.RightMouseUp : EventType.MouseUp;

        enqueueEvent({
            eventType,
            param1: x,
            param2: y,
            controlKey: domEvent.ctrlKey || domEvent.metaKey,
            shiftKey: domEvent.shiftKey,
        });
    }

    function onMouseMove(domEvent: MouseEvent): void {
        const rect = canvas.getBoundingClientRect();
        const { x, y } = pixelToCell(domEvent.clientX - rect.left, domEvent.clientY - rect.top);
        if (x !== lastMouseCellX || y !== lastMouseCellY) {
            lastMouseCellX = x;
            lastMouseCellY = y;
            enqueueEvent({
                eventType: EventType.MouseEnteredCell,
                param1: x,
                param2: y,
                controlKey: domEvent.ctrlKey || domEvent.metaKey,
                shiftKey: domEvent.shiftKey,
            });
        }
    }

    // ---- Attach DOM listeners ----

    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Make the canvas focusable so it can receive keyboard events
    if (!canvas.hasAttribute("tabindex")) {
        canvas.setAttribute("tabindex", "0");
    }

    // ---- Modifier state ----
    let shiftHeld = false;
    let ctrlHeld = false;

    document.addEventListener("keydown", (e) => {
        if (e.key === "Shift") shiftHeld = true;
        if (e.key === "Control" || e.key === "Meta") ctrlHeld = true;
    });
    document.addEventListener("keyup", (e) => {
        if (e.key === "Shift") shiftHeld = false;
        if (e.key === "Control" || e.key === "Meta") ctrlHeld = false;
    });

    // ---- Build the console ----
    const browserConsole: BrogueConsole & { waitForEvent(): Promise<RogueEvent>; handleResize(): void } = {
        waitForEvent: _waitForEvent,
        handleResize: recalcCellSize,

        gameLoop(): void {
            if (onGameLoop) onGameLoop();
        },

        pauseForMilliseconds(_milliseconds: number, behavior: PauseBehavior): boolean {
            // In a synchronous C port, this blocks. In the browser, we check the
            // event queue and return immediately. The actual delay is handled by
            // the caller via async scheduling.
            const ev = dequeueEventIfAvailable();
            if (ev) {
                if (ev.eventType !== EventType.MouseEnteredCell || behavior.interruptForMouseMove) {
                    // Put it back — the caller will consume it via nextKeyOrMouseEvent
                    eventQueue.unshift({ event: ev });
                    return true;
                }
            }
            return false;
        },

        nextKeyOrMouseEvent(_textInput: boolean, _colorsDance: boolean): RogueEvent {
            // For the synchronous API shape, pop from queue if available.
            // The actual async waiting version is `waitForEvent()`.
            const ev = dequeueEventIfAvailable();
            if (ev) return ev;

            // Fallback: return a no-op event. In practice, callers should use
            // the async adapter that calls `waitForEvent()`.
            return {
                eventType: EventType.Keystroke,
                param1: 0,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            };
        },

        plotChar(
            inputChar: DisplayGlyph,
            x: number, y: number,
            foreRed: number, foreGreen: number, foreBlue: number,
            backRed: number, backGreen: number, backBlue: number,
        ): void {
            // Brogue colors are 0–100 percentages; convert to 0–255
            const fr = Math.round(foreRed * 255 / 100);
            const fg = Math.round(foreGreen * 255 / 100);
            const fb = Math.round(foreBlue * 255 / 100);
            const br = Math.round(backRed * 255 / 100);
            const bg = Math.round(backGreen * 255 / 100);
            const bb = Math.round(backBlue * 255 / 100);

            const px = x * cellWidth;
            const py = y * cellHeight;

            // Draw background
            ctx2d.fillStyle = `rgb(${br},${bg},${bb})`;
            ctx2d.fillRect(px, py, cellWidth, cellHeight);

            // Draw character
            const unicode = glyphToUnicode(inputChar);
            if (unicode > 0x20) { // skip space / control chars
                const ch = String.fromCodePoint(unicode);
                ctx2d.fillStyle = `rgb(${fr},${fg},${fb})`;
                ctx2d.font = `${fontSize}px ${fontFamily}`;
                ctx2d.textBaseline = "top";
                ctx2d.textAlign = "center";
                ctx2d.fillText(ch, px + cellWidth / 2, py + (cellHeight - fontSize) / 2);
            }
        },

        remap(_from: string, _to: string): void {
            // Key remapping is not used in the browser build
        },

        modifierHeld(modifier: number): boolean {
            if (modifier === 0) return shiftHeld;
            if (modifier === 1) return ctrlHeld;
            return false;
        },

        notifyEvent(
            _eventId: number,
            _data1: number, _data2: number,
            _str1: string, _str2: string,
        ): void {
            // Optional: could dispatch a CustomEvent on the canvas
        },

        takeScreenshot(): boolean {
            // Trigger a download of the canvas as a PNG
            try {
                const link = document.createElement("a");
                link.download = "brogue-screenshot.png";
                link.href = canvas.toDataURL("image/png");
                link.click();
                return true;
            } catch {
                return false;
            }
        },

        setGraphicsMode(_mode: GraphicsMode): GraphicsMode {
            // Text-only rendering for now
            return GraphicsMode.Text;
        },
    };

    return browserConsole;
}

// =============================================================================
// Async helpers for browser integration
// =============================================================================

/**
 * Async-compatible pause that resolves after `ms` milliseconds, or earlier
 * if an input event arrives and `behavior.interruptForMouseMove` is set.
 */
export function asyncPause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
