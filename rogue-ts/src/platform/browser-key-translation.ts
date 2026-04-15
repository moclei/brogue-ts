/*
 *  platform/browser-key-translation.ts — DOM KeyboardEvent to Brogue key code mapping
 *  Port V2 — rogue-ts
 *
 *  Extracted from browser-renderer.ts to keep that file under the 600-line limit.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import {
    ESCAPE_KEY,
    RETURN_KEY,
    DELETE_KEY,
    TAB_KEY,
    UP_ARROW,
    DOWN_ARROW,
    LEFT_ARROW,
    RIGHT_ARROW,
    NUMPAD_0,
    NUMPAD_1,
    NUMPAD_2,
    NUMPAD_3,
    NUMPAD_4,
    NUMPAD_5,
    NUMPAD_6,
    NUMPAD_7,
    NUMPAD_8,
    NUMPAD_9,
    PRINTSCREEN_KEY,
} from "../types/constants.js";

/**
 * Translate a DOM KeyboardEvent to a Brogue key code.
 * Returns null if the key should be ignored.
 *
 * Pure function — no side effects, safe to call from any context.
 */
export function translateKey(domEvent: KeyboardEvent): number | null {
    switch (domEvent.key) {
        case "Escape":       return ESCAPE_KEY;
        case "ArrowUp":      return UP_ARROW;
        case "ArrowDown":    return DOWN_ARROW;
        case "ArrowLeft":    return LEFT_ARROW;
        case "ArrowRight":   return RIGHT_ARROW;
        case "Enter":        return RETURN_KEY;
        case "Backspace":    return DELETE_KEY;
        case "Tab":          return TAB_KEY;
        case "PrintScreen":  return PRINTSCREEN_KEY;
        default:             break;
    }

    // Numpad digits (0–9)
    if (
        domEvent.code.startsWith("Numpad") &&
        domEvent.key.length === 1 &&
        domEvent.key >= "0" &&
        domEvent.key <= "9"
    ) {
        const numpadKeys = [
            NUMPAD_0, NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
            NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9,
        ];
        return numpadKeys[parseInt(domEvent.key, 10)];
    }

    // Printable single characters
    if (domEvent.key.length === 1) {
        return domEvent.key.charCodeAt(0);
    }

    return null;
}
