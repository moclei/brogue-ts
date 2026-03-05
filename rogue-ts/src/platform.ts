/*
 *  platform.ts — Async event bridge and main game loop
 *  Port V2 — rogue-ts
 *
 *  Initializes the browser console, provides waitForEvent() / peekEvent() for
 *  async event consumption, and hosts mainGameLoop() — the top-level async
 *  game loop that never synchronously blocks.
 *
 *  Event dispatch:
 *   - Keystroke         → handleKeystroke()  (wired in port-v2-platform Phase 4)
 *   - MouseDown         → handleLeftClick()  → travel(target, true, buildTravelContext())
 *   - RightMouseDown    → handleRightClick() → inventory UI (Phase 5)
 *   - MouseEnteredCell  → handleHover()      → sidebar update (Phase 3)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { buildTravelContext } from "./movement.js";
import { travel } from "./movement/travel-explore.js";
import { windowToMapX, windowToMapY, coordinatesAreInMap } from "./globals/tables.js";
import { EventType } from "./types/enums.js";
import type { RogueEvent } from "./types/types.js";

// =============================================================================
// Module-level state
// =============================================================================

/**
 * Minimal interface for the platform event queue.
 * The browser console satisfies this; tests can pass a mock.
 */
export interface PlatformConsole {
    waitForEvent(): Promise<RogueEvent>;
}

let _console: PlatformConsole | null = null;

// =============================================================================
// initPlatform — call once from bootstrap
// =============================================================================

/**
 * Initialize the platform module with a browser console.
 * Must be called before waitForEvent() or mainGameLoop().
 */
export function initPlatform(browserConsole: PlatformConsole): void {
    _console = browserConsole;
}

// =============================================================================
// Event access
// =============================================================================

/**
 * Wait asynchronously for the next input event.
 * Resolves as soon as a key or mouse event arrives from the browser.
 */
export function waitForEvent(): Promise<RogueEvent> {
    if (!_console) throw new Error("Platform not initialized — call initPlatform() first");
    return _console.waitForEvent();
}

/**
 * Non-blocking event peek (playback only).
 * Returns the next queued event without waiting, or null if the queue is empty.
 * The browser renderer does not expose a synchronous peek; this always returns null
 * unless the platform is backed by a playback-aware console.
 */
export function peekEvent(): RogueEvent | null {
    // The browser renderer resolves via Promise — no synchronous peek available.
    // Playback callers should use a dedicated event source rather than peeking
    // at the live queue.
    return null;
}

// =============================================================================
// Event dispatch
// =============================================================================

/**
 * Dispatch a single event to the appropriate handler.
 * Called by mainGameLoop() for every event received from waitForEvent().
 */
export async function processEvent(event: RogueEvent): Promise<void> {
    const { rogue } = getGameState();
    if (rogue.gameHasEnded) return;

    switch (event.eventType) {
        case EventType.Keystroke:
            await handleKeystroke(event);
            break;

        case EventType.MouseDown:
            await handleLeftClick(event.param1, event.param2);
            break;

        case EventType.RightMouseDown:
            await handleRightClick(event.param1, event.param2);
            break;

        case EventType.MouseEnteredCell:
            handleHover(event.param1, event.param2);
            break;

        default:
            // Ignore MouseUp, RightMouseUp, and other event types
            break;
    }
}

// =============================================================================
// Handlers
// =============================================================================

/**
 * Left-click: travel directly to the clicked map cell.
 * Converts window coordinates to map coordinates and calls travel(target, true).
 * autoConfirm is always true for mouse travel — no confirmation dialog.
 */
async function handleLeftClick(windowX: number, windowY: number): Promise<void> {
    const mapX = windowToMapX(windowX);
    const mapY = windowToMapY(windowY);
    if (!coordinatesAreInMap(mapX, mapY)) return;

    const target = { x: mapX, y: mapY };
    const travelCtx = buildTravelContext();
    await travel(target, true, travelCtx);
}

/**
 * Right-click: open inventory at the clicked cell.
 * Stubbed — port-v2-platform Phase 5: open inventory via buildInventoryContext().
 */
async function handleRightClick(_windowX: number, _windowY: number): Promise<void> {
    // stub — port-v2-platform Phase 5
}

/**
 * Mouse hover: update the sidebar to reflect the hovered cell.
 * Stubbed — port-v2-platform Phase 3: call display.refreshSideBar(mapX, mapY, false).
 */
function handleHover(_windowX: number, _windowY: number): void {
    // stub — port-v2-platform Phase 3
}

/**
 * Keystroke: dispatch to the input handler.
 * Stubbed — port-v2-platform Phase 4: wire to io/input-keystrokes.ts.
 */
async function handleKeystroke(_event: RogueEvent): Promise<void> {
    // stub — port-v2-platform Phase 4
}

// =============================================================================
// Main game loop
// =============================================================================

/**
 * The top-level async game loop.
 * Runs until the game ends, awaiting each event before processing it.
 * Never synchronously blocks — all waiting is done via await.
 */
export async function mainGameLoop(): Promise<void> {
    const { rogue } = getGameState();
    while (!rogue.gameHasEnded) {
        const event = await waitForEvent();
        await processEvent(event);
    }
}
