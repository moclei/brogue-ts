/*
 *  platform.ts — Platform abstraction layer interface
 *  brogue-ts
 *
 *  Port of the brogueConsole struct from platformdependent.c
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { DisplayGlyph, GraphicsMode } from "./enums.js";
import type { RogueEvent, PauseBehavior } from "./types.js";

/**
 * Platform abstraction — mirrors the C `brogueConsole` struct.
 *
 * Any platform (browser, terminal, test harness) must implement this
 * interface to drive the game loop.
 */
export interface BrogueConsole {
    /** Run the main game loop. */
    gameLoop(): void;

    /**
     * Pause for the given number of milliseconds.
     * Returns true if interrupted by an event.
     */
    pauseForMilliseconds(milliseconds: number, behavior: PauseBehavior): boolean;

    /**
     * Block until the next keyboard or mouse event.
     * @param textInput - If true, expect text entry
     * @param colorsDance - If true, animate color cycling while waiting
     */
    nextKeyOrMouseEvent(
        textInput: boolean,
        colorsDance: boolean,
    ): RogueEvent;

    /**
     * Plot a single character at grid position (x, y) with foreground and
     * background RGB colors.
     */
    plotChar(
        inputChar: DisplayGlyph,
        x: number,
        y: number,
        foreRed: number,
        foreGreen: number,
        foreBlue: number,
        backRed: number,
        backGreen: number,
        backBlue: number,
    ): void;

    /** Remap one key to another. */
    remap(from: string, to: string): void;

    /** Check if a modifier key is currently held. */
    modifierHeld(modifier: number): boolean;

    /** Notify the platform of a game event. */
    notifyEvent(eventId: number, data1: number, data2: number, str1: string, str2: string): void;

    /** Take a screenshot. Returns true on success. */
    takeScreenshot(): boolean;

    /** Set the graphics mode. Returns the mode actually set. */
    setGraphicsMode(mode: GraphicsMode): GraphicsMode;
}
