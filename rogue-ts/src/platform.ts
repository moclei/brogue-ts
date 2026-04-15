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
import type { TileType } from "./types/enums.js";
import type { RogueEvent, ScreenDisplayBuffer, ButtonState } from "./types/types.js";
import { COLS, ROWS, MESSAGE_LINES, DCOLS } from "./types/constants.js";
import { buildInputContext } from "./io/input-context.js";
import { executeKeystroke } from "./io/input-dispatch.js";
import { createScreenDisplayBuffer } from "./io/display.js";
import { registerPauseAndCheckForEvent, registerPauseIgnoringHover } from "./platform-bridge.js";
import { shuffleTerrainColors } from "./render-state.js";
import {
    buildGameMenuButtonState,
    drawGameMenuButtons,
    findClickedMenuButton,
} from "./io/menu-bar.js";
import { actionMenu } from "./io/input-mouse.js";
import { buildHoverHandlerFn, buildClearHoverPathFn } from "./io/hover-wiring.js";
import { setSidebarHoverCallbacks, setSidebarCanvasSuppression, setSidebarVisible, setDOMSidebarEnabled } from "./platform/ui-sidebar.js";
import { setMessagesCanvasSuppression, setMessagesVisible, setDOMMessagesEnabled } from "./platform/ui-messages.js";
import { setBottomBarClickCallback, setBottomBarCanvasSuppression, setBottomBarVisible, setDOMBottomBarEnabled } from "./platform/ui-bottom-bar.js";
import { setDOMModalEnabled } from "./platform/ui-modal.js";
import { GraphicsMode } from "./types/enums.js";
import type { CellSpriteDataProvider } from "./platform/browser-renderer.js";
import { buildCellSpriteDataProvider } from "./sprite-data-wiring.js";

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

/** Console may optionally support graphics mode (browser renderer). */
export interface PlatformConsoleWithGraphics extends PlatformConsole {
    setGraphicsMode(mode: GraphicsMode): GraphicsMode;
}

let _console: PlatformConsole | null = null;

/** Current graphics mode. Persists so input context and renderer stay in sync. */
let _graphicsMode: GraphicsMode = GraphicsMode.Tiles;

/** True when the console supports setGraphicsMode (e.g. browser renderer). */
let _hasGraphics = false;

/** If the console supports injectEvent, this is wired up at initPlatform time. */
let _injectEvent: ((ev: RogueEvent) => void) | null = null;

/** Bottom-bar action button state. Initialized once when mainGameLoop starts. */
let _menuState: ButtonState | null = null;

// Hover handler and path-clear function, initialized lazily in mainGameLoop.
let _hoverHandler: ((mapX: number, mapY: number) => void) | null = null;
let _clearHoverPath: (() => void) | null = null;

/** Last hovered map cell, or null if no hover is active. Used to re-apply the
 *  highlight after idle displayLevel() redraws overwrite it. */
let _lastHoverPos: { x: number; y: number } | null = null;

/**
 * Callback invoked when mainGameLoop starts (gameplay=true) and ends (gameplay=false).
 * Registered by bootstrap.ts to resize the canvas and update renderer state.
 */
let _onCanvasModeChange: ((gameplay: boolean) => void) | null = null;

/**
 * Register a callback that is invoked when gameplay mode changes.
 * bootstrap.ts uses this to resize the canvas between menu and dungeon sizes.
 */
export function registerCanvasModeCallback(fn: (gameplay: boolean) => void): void {
    _onCanvasModeChange = fn;
}

/** Optional plotChar from the browser console (absent in test mocks). */
type PlotCharFn = (
    inputChar: number, x: number, y: number,
    fr: number, fg: number, fb: number,
    br: number, bg: number, bb: number,
    tileType?: TileType,
) => void;
let _plotChar: PlotCharFn | null = null;

/** Setter for the layer compositing data provider (absent in test mocks). */
type SetProviderFn = (provider: CellSpriteDataProvider) => void;
let _setCellSpriteDataProvider: SetProviderFn | null = null;

/** Previous frame buffer for dirty-cell detection in commitDraws(). */
let _prevBuffer: ScreenDisplayBuffer = createScreenDisplayBuffer();

/** When true, next commitDraws() redraws every cell (e.g. after graphics mode change). */
let _forceFullRedraw = false;

/** Schedule a full redraw on the next commitDraws() cycle. */
export function forceFullRedraw(): void {
    _forceFullRedraw = true;
}

/**
 * Build a fresh CellSpriteDataProvider (capturing the current pmap/tmap
 * references from getGameState()) and wire it into the browser renderer.
 * Must be called after initializeRogue() — which replaces pmap/tmap — and
 * before the first commitDraws() of a new game, so the autotile pipeline
 * is active on the very first frame.
 *
 * Also schedules a full redraw so no stale cells remain from a previous session.
 *
 * No-op in test environments (setCellSpriteDataProvider not present).
 */
export function refreshSpriteDataProvider(): void {
    if (_setCellSpriteDataProvider) {
        _setCellSpriteDataProvider(buildCellSpriteDataProvider());
        _forceFullRedraw = true;
    }
}

/**
 * Event captured by pauseAndCheckForEvent() when an input arrives before the
 * timeout. Drained by the next waitForEvent() call.
 */
let _lookaheadEvent: RogueEvent | null = null;

// =============================================================================
// initPlatform — call once from bootstrap
// =============================================================================

/**
 * Initialize the platform module with a browser console.
 * Must be called before waitForEvent() or mainGameLoop().
 *
 * If the console has a `plotChar` method (browser renderer), it will be
 * used by commitDraws() to flush the display buffer to the screen.
 * Test mocks that only implement waitForEvent() work fine — commitDraws()
 * becomes a no-op in that case.
 */
export function initPlatform(browserConsole: PlatformConsole & {
    plotChar?: PlotCharFn;
    setGraphicsMode?: (mode: GraphicsMode) => GraphicsMode;
    setCellSpriteDataProvider?: SetProviderFn;
    injectEvent?: (ev: RogueEvent) => void;
}): void {
    _console = browserConsole;
    _plotChar = browserConsole.plotChar ?? null;
    _setCellSpriteDataProvider = browserConsole.setCellSpriteDataProvider ?? null;
    _hasGraphics = typeof (browserConsole as PlatformConsoleWithGraphics).setGraphicsMode === "function";
    _injectEvent = browserConsole.injectEvent ?? null;
    _prevBuffer = createScreenDisplayBuffer();
    registerPauseAndCheckForEvent(pauseAndCheckForEvent);
    registerPauseIgnoringHover(pauseAndCheckForEventIgnoringHover);
}

/**
 * Inject a synthetic event into the game's input queue.
 * Used by DOM UI elements (e.g. bottom bar buttons) to trigger game actions
 * without going through the canvas event listener path.
 */
export function injectGameEvent(ev: RogueEvent): void {
    _injectEvent?.(ev);
}

/**
 * Current graphics mode (Text / Tiles). Used by input context and renderer.
 */
export function getGraphicsMode(): GraphicsMode {
    return _graphicsMode;
}

/**
 * Set graphics mode and notify the console if it supports it. Returns the mode set.
 * Schedules a full redraw so the new mode is visible immediately (matches C behavior).
 *
 * Text mode disables DOM extraction so the player gets a pure canvas/buffer experience.
 * Tiles mode enables DOM extraction for sidebar, messages, bottom bar, and modals.
 */
export function setGraphicsMode(mode: GraphicsMode): GraphicsMode {
    _graphicsMode = mode;
    const c = _console as PlatformConsoleWithGraphics | null;
    if (c?.setGraphicsMode) c.setGraphicsMode(mode);
    _forceFullRedraw = true;
    const useDOM = mode === GraphicsMode.Tiles;
    setDOMSidebarEnabled(useDOM);
    setDOMMessagesEnabled(useDOM);
    setDOMBottomBarEnabled(useDOM);
    setDOMModalEnabled(useDOM);
    // If gameplay is active, also show/hide the DOM elements so they don't remain
    // visible but stale when switching to ASCII mode. _menuState !== null is used
    // as a proxy for "gameplay is running" (same lifecycle as mainGameLoop).
    if (_menuState !== null) {
        setSidebarVisible(useDOM);
        setMessagesVisible(useDOM);
        setBottomBarVisible(useDOM);
        // Canvas suppression must mirror DOM state: when DOM is off (ASCII mode),
        // the canvas must render those rows again instead of blacking them out.
        setSidebarCanvasSuppression(useDOM);
        setMessagesCanvasSuppression(useDOM);
        setBottomBarCanvasSuppression(useDOM);
    }
    return _graphicsMode;
}

/** True when the console supports tile/hybrid graphics (e.g. browser renderer). */
export function hasGraphics(): boolean {
    return _hasGraphics;
}

// =============================================================================
// Event access
// =============================================================================

/**
 * Wait asynchronously for the next input event.
 * If pauseAndCheckForEvent() buffered an event, that is returned first.
 * Otherwise resolves as soon as a key or mouse event arrives from the browser.
 */
export function waitForEvent(): Promise<RogueEvent> {
    if (!_console) throw new Error("Platform not initialized — call initPlatform() first");
    if (_lookaheadEvent !== null) {
        const ev = _lookaheadEvent;
        _lookaheadEvent = null;
        return Promise.resolve(ev);
    }
    return _console.waitForEvent();
}

/**
 * Discard any event buffered by pauseAndCheckForEvent().
 *
 * Animation loops (e.g. colorFlash) call pauseAndCheckForEvent() so they can
 * be interrupted by user input.  The interrupting event is stored in
 * _lookaheadEvent and would otherwise be returned immediately by the next
 * waitForEvent() call — prematurely dismissing a "--MORE--" acknowledgment
 * prompt that the player hasn't even seen yet.
 *
 * Call drainLookahead() after commitDraws() but before awaiting fresh user
 * input whenever you need to ensure the prompt is acknowledged by a new
 * keystroke rather than a stale one from a preceding animation.
 */
export function drainLookahead(): void {
    _lookaheadEvent = null;
}

/**
 * Sleep for up to `ms` milliseconds, but resolve early if a user input event
 * arrives. Returns true if interrupted by input, false if the timeout elapsed.
 *
 * Any event captured during the race is stored in _lookaheadEvent so the next
 * waitForEvent() call returns it. Even when the timeout wins, the event promise's
 * .then() handler remains live and will buffer any event that arrives before the
 * next waitForEvent() call.
 */
export async function pauseAndCheckForEvent(ms: number): Promise<boolean> {
    if (!_console) throw new Error("Platform not initialized — call initPlatform() first");
    if (_lookaheadEvent !== null) return true;

    const timeoutP = new Promise<false>(resolve => setTimeout(() => resolve(false), ms));

    // The .then() stores the event in _lookaheadEvent regardless of whether
    // the timeout already won — the next waitForEvent() call will drain it.
    const eventP = _console.waitForEvent().then(ev => {
        _lookaheadEvent = ev;
        return true as const;
    });

    return Promise.race([timeoutP, eventP]);
}

/**
 * Returns true if `ev` should interrupt travel (keystroke or mouse-button press).
 * MouseUp, RightMouseUp, and MouseEnteredCell do not interrupt travel.
 * C: pauseAnimation(ms, PAUSE_BEHAVIOR_DEFAULT) — only real input stops travel.
 */
function isTravelInterrupt(ev: RogueEvent): boolean {
    // C PAUSE_BEHAVIOR_DEFAULT: any event except MouseEnteredCell (hover) interrupts.
    // Travel now fires on MouseUp (matching C's executeEvent), so the triggering
    // MouseUp is consumed before travelMap starts — the queue is clean on entry.
    return ev.eventType !== EventType.MouseEnteredCell;
}

/**
 * Like pauseAndCheckForEvent, but only returns true for real user input
 * (keystrokes, mouse-button presses). MouseUp, RightMouseUp, and
 * MouseEnteredCell events are silently discarded.
 * C: pauseAnimation(ms, PAUSE_BEHAVIOR_DEFAULT) — mouse-move and mouse-up
 * do not interrupt travel or animations.
 */
export async function pauseAndCheckForEventIgnoringHover(ms: number): Promise<boolean> {
    if (!_console) throw new Error("Platform not initialized — call initPlatform() first");

    // Drain any pending non-interrupting lookahead without counting it.
    if (_lookaheadEvent !== null) {
        if (isTravelInterrupt(_lookaheadEvent)) return true;
        _lookaheadEvent = null;
    }

    const deadline = Date.now() + ms;
    let remaining = ms;
    while (remaining > 0) {
        const interrupted = await pauseAndCheckForEvent(remaining);
        if (!interrupted) return false;
        // Re-read after await — cast to escape TypeScript's stale narrowing.
        const ev = _lookaheadEvent as RogueEvent | null;
        if (ev !== null && isTravelInterrupt(ev)) return true;
        // Non-interrupting event (hover, mouse-up) — discard and continue.
        _lookaheadEvent = null;
        remaining = deadline - Date.now();
    }
    return false;
}

// =============================================================================
// commitDraws — flush display buffer to canvas
// =============================================================================

/**
 * Walk every cell in the display buffer and render changed cells to the
 * browser console via plotChar.
 *
 * Colors are stored in 0–100 (Brogue convention) and passed as 0–100 to
 * plotChar; the browser renderer converts them to 0–255 internally.
 *
 * No-op if the platform was initialized without a plotChar (test mocks).
 */
export function commitDraws(): void {
    if (!_plotChar) return;
    const { displayBuffer } = getGameState();
    for (let x = 0; x < COLS; x++) {
        for (let y = 0; y < ROWS; y++) {
            const cell = displayBuffer.cells[x][y];
            const prev = _prevBuffer.cells[x][y];
            const changed =
                _forceFullRedraw ||
                cell.character !== prev.character ||
                cell.foreColorComponents[0] !== prev.foreColorComponents[0] ||
                cell.foreColorComponents[1] !== prev.foreColorComponents[1] ||
                cell.foreColorComponents[2] !== prev.foreColorComponents[2] ||
                cell.backColorComponents[0] !== prev.backColorComponents[0] ||
                cell.backColorComponents[1] !== prev.backColorComponents[1] ||
                cell.backColorComponents[2] !== prev.backColorComponents[2] ||
                cell.tileType !== prev.tileType;

            if (changed) {
                _plotChar(
                    cell.character, x, y,
                    cell.foreColorComponents[0], cell.foreColorComponents[1], cell.foreColorComponents[2],
                    cell.backColorComponents[0], cell.backColorComponents[1], cell.backColorComponents[2],
                    cell.tileType,
                );

                prev.character = cell.character;
                prev.foreColorComponents[0] = cell.foreColorComponents[0];
                prev.foreColorComponents[1] = cell.foreColorComponents[1];
                prev.foreColorComponents[2] = cell.foreColorComponents[2];
                prev.backColorComponents[0] = cell.backColorComponents[0];
                prev.backColorComponents[1] = cell.backColorComponents[1];
                prev.backColorComponents[2] = cell.backColorComponents[2];
                prev.tileType = cell.tileType;
            }
        }
    }
    if (_forceFullRedraw) _forceFullRedraw = false;
}

// =============================================================================
// Event access
// =============================================================================

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

    if (event.eventType !== EventType.MouseEnteredCell) {
        console.log("[processEvent] type=%s param1=%s", event.eventType, event.param1);
    }

    switch (event.eventType) {
        case EventType.Keystroke:
            await handleKeystroke(event);
            break;

        case EventType.MouseUp:
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
    // Check if click lands on a menu bar button (bottom row).
    if (_menuState !== null) {
        const buttonIndex = findClickedMenuButton(_menuState, windowX, windowY);
        if (buttonIndex !== -1) {
            const ctx = buildInputContext();
            if (buttonIndex === 3) {
                // Menu button: open the action menu sub-panel.
                const menuX = (_menuState.buttons[3]?.x ?? 0) - 4;
                const hotkey = await actionMenu(ctx, menuX, ctx.rogue.playbackMode);
                if (hotkey !== -1) {
                    await executeKeystroke(ctx, hotkey, false, false);
                }
            } else {
                const hotkey = _menuState.buttons[buttonIndex]?.hotkey[0] ?? -1;
                if (hotkey !== -1) {
                    await executeKeystroke(ctx, hotkey, false, false);
                }
            }
            return;
        }
    }

    _clearHoverPath?.();
    _lastHoverPos = null;

    const mapX = windowToMapX(windowX);
    const mapY = windowToMapY(windowY);

    // If the click is in the message area (top MESSAGE_LINES rows, within dungeon x range),
    // open the message history overlay.  C: IO.c executeMouseEvent() message-block branch.
    if (mapX >= 0 && mapX < DCOLS && windowY >= 0 && windowY < MESSAGE_LINES) {
        const ctx = buildInputContext();
        await ctx.displayMessageArchive();
        return;
    }

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
 * Mouse hover: draw path highlight from player to cursor cell and print
 * location description.  Wired in B35.
 */
function handleHover(windowX: number, windowY: number): void {
    if (!_hoverHandler) return;
    const mapX = windowToMapX(windowX);
    const mapY = windowToMapY(windowY);
    _hoverHandler(mapX, mapY);
    _lastHoverPos = { x: mapX, y: mapY };
}

/**
 * Keystroke: dispatch to the appropriate game action via executeKeystroke.
 * Clears hover path before acting (path should not persist after the player moves).
 * Wired in port-v2-platform Phase 4.
 */
async function handleKeystroke(event: RogueEvent): Promise<void> {
    _clearHoverPath?.();
    _lastHoverPos = null;
    const ctx = buildInputContext();
    await executeKeystroke(ctx, event.param1, event.controlKey, event.shiftKey);
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
    console.log("[mainGameLoop] started");
    const { rogue, pmap } = getGameState();
    _menuState = buildGameMenuButtonState(rogue.playbackMode);
    _hoverHandler = buildHoverHandlerFn();
    _clearHoverPath = buildClearHoverPathFn();
    setSidebarHoverCallbacks(_hoverHandler, _clearHoverPath);
    setSidebarCanvasSuppression(true);
    setMessagesCanvasSuppression(true);
    setBottomBarCanvasSuppression(true);
    // Show DOM sidebar before switching canvas mode so sizeCanvas accounts for it.
    setSidebarVisible(true);
    setMessagesVisible(true);
    setBottomBarVisible(true);
    // Switch canvas to dungeon-only (DCOLS×DROWS) mode for gameplay.
    _onCanvasModeChange?.(true);

    // Register DOM bottom bar button click → inject the button's hotkey directly.
    // Bypasses the MouseUp → findClickedMenuButton coordinate hit-test, which
    // can fail when the dungeon-only canvas remaps the coordinate space.
    // The Menu button (index 3 in normal mode, index 3 in playback mode) has no
    // hotkey, so we fall back to a MouseUp at its window coords so that
    // handleLeftClick → actionMenu fires correctly.
    setBottomBarClickCallback((buttonIndex: number) => {
        const btn = _menuState?.buttons[buttonIndex];
        if (!btn) return;
        const hotkey = btn.hotkey[0] ?? -1;
        if (hotkey === -1) {
            // No hotkey (Menu button) — inject MouseUp so handleLeftClick → actionMenu fires
            injectGameEvent({
                eventType: EventType.MouseUp,
                param1: btn.x,
                param2: btn.y,
                controlKey: false,
                shiftKey: false,
            });
        } else {
            injectGameEvent({
                eventType: EventType.Keystroke,
                param1: hotkey,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            });
        }
    });

    while (!rogue.gameHasEnded) {
        // Defect 3 fix: idle animation loop — animate dancing terrain between inputs.
        // C: mainInputLoop calls displayLevel/refreshDungeonCell on a ~25ms timer.
        const interrupted = await pauseAndCheckForEvent(25);
        if (!interrupted) {
            shuffleTerrainColors(35, false, pmap);
            buildInputContext().displayLevel();
            // B109: re-apply hover highlight after displayLevel() redraws the dungeon.
            // C: mainInputLoop inner do-loop re-runs hilitePath + hiliteCell before
            // every getEvent() call, so the highlight persists through terrain animation.
            if (_hoverHandler !== null && _lastHoverPos !== null) {
                _hoverHandler(_lastHoverPos.x, _lastHoverPos.y);
            }
            drawGameMenuButtons(_menuState);
            commitDraws();
        } else {
            const event = await waitForEvent();
            await processEvent(event);
            drawGameMenuButtons(_menuState);
            commitDraws();
        }
    }
    _menuState = null;
    _hoverHandler = null;
    _clearHoverPath = null;
    _lastHoverPos = null;
    setSidebarHoverCallbacks(null, null);
    setSidebarCanvasSuppression(false);
    setMessagesCanvasSuppression(false);
    setBottomBarCanvasSuppression(false);
    // Hide DOM sidebar before switching canvas mode so sizeCanvas doesn't subtract sidebar columns.
    setSidebarVisible(false);
    setMessagesVisible(false);
    setBottomBarVisible(false);
    setBottomBarClickCallback(null);
    // Restore full 100×34 canvas for the main menu.
    _onCanvasModeChange?.(false);
    console.log("[mainGameLoop] ended");
}
