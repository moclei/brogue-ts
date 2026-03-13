/*
 *  platform-bridge.ts — Shared async timing bridge
 *  Port V2 — rogue-ts
 *
 *  Holds a registered pauseAndCheckForEvent implementation so that
 *  movement.ts and other game-logic modules can call it without
 *  creating a circular dependency with platform.ts.
 *
 *  platform.ts registers the real implementation at init time;
 *  before that, calls resolve immediately with false (not interrupted).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

let _pause: ((ms: number) => Promise<boolean>) | null = null;
let _pauseIgnoringHover: ((ms: number) => Promise<boolean>) | null = null;

/**
 * Register the platform's pauseAndCheckForEvent implementation.
 * Called once from initPlatform() in platform.ts.
 */
export function registerPauseAndCheckForEvent(fn: (ms: number) => Promise<boolean>): void {
    _pause = fn;
}

export function registerPauseIgnoringHover(fn: (ms: number) => Promise<boolean>): void {
    _pauseIgnoringHover = fn;
}

/**
 * Pause for up to `ms` milliseconds, returning true if a user event
 * arrived early.  Falls back to immediate false if the platform is not
 * yet initialized (e.g. in tests).
 */
export function platformPauseAndCheckForEvent(ms: number): Promise<boolean> {
    return _pause ? _pause(ms) : Promise.resolve(false);
}

/**
 * Like platformPauseAndCheckForEvent but ignores MouseEnteredCell hover events.
 * Used by travel animation so hover doesn't interrupt pathfinding.
 */
export function platformPauseIgnoringHover(ms: number): Promise<boolean> {
    return _pauseIgnoringHover ? _pauseIgnoringHover(ms) : Promise.resolve(false);
}
