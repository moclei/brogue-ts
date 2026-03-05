/*
 *  null-platform.ts — No-op BrogueConsole for testing / headless use
 *  brogue-ts
 *
 *  Ported from: src/platform/null-platform.c
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueConsole } from "../types/platform.js";
import type { RogueEvent } from "../types/types.js";
import { EventType, GraphicsMode } from "../types/enums.js";

/**
 * A no-op implementation of BrogueConsole.
 *
 * Useful for:
 *  - Unit testing game logic without a real display
 *  - Headless simulation / AI-driven runs
 *  - Recording verification
 */
export const nullConsole: BrogueConsole = {
    gameLoop(): void {
        // No-op — tests drive the game directly
    },

    pauseForMilliseconds(_milliseconds: number, _behavior: { interruptForMouseMove: boolean }): boolean {
        return false;
    },

    nextKeyOrMouseEvent(_textInput: boolean, _colorsDance: boolean): RogueEvent {
        return {
            eventType: EventType.Keystroke,
            param1: 0,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
    },

    plotChar(
        _inputChar: number,
        _x: number, _y: number,
        _foreRed: number, _foreGreen: number, _foreBlue: number,
        _backRed: number, _backGreen: number, _backBlue: number,
    ): void {
        // No-op
    },

    remap(_from: string, _to: string): void {
        // No-op
    },

    modifierHeld(_modifier: number): boolean {
        return false;
    },

    notifyEvent(
        _eventId: number,
        _data1: number, _data2: number,
        _str1: string, _str2: string,
    ): void {
        // No-op
    },

    takeScreenshot(): boolean {
        return false;
    },

    setGraphicsMode(_mode: GraphicsMode): GraphicsMode {
        return GraphicsMode.Text;
    },
};
