/*
 *  ui.ts — UI context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildDisplayContext(), buildMessageContext(),
 *  buildInventoryContext(), and buildButtonContext().
 *
 *  These context builders close over shared state from core.ts and provide
 *  the DI contexts expected by the io/ functions.  All display/rendering
 *  callbacks are stubbed here — they will be wired to real platform
 *  implementations in port-v2-platform.
 *
 *  IMPORTANT: buildButtonContext().nextBrogueEvent must always return a
 *  Promise<RogueEvent>, never a synchronous value.  This is the async bridge
 *  contract enforced by the test suite.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { waitForEvent, commitDraws, pauseAndCheckForEvent, drainLookahead } from "./platform.js";
import type {
    MessageState, ScreenDisplayBuffer, SavedDisplayBuffer,
    RogueEvent, BrogueButton, Item, Color, Pos, WindowPos, PauseBehavior,
} from "./types/types.js";
import { EventType } from "./types/enums.js";
// IO layer — pure functions that don't need the dungeon appearance system
import {
    plotCharWithColor as plotCharWithColorFn,
    plotCharToBuffer as plotCharToBufferFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    applyOverlay as applyOverlayFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    locIsInWindow as locIsInWindowFn,
} from "./io/display.js";
import {
    applyColorAverage as applyColorAverageFn,
    bakeColor as bakeColorFn,
    separateColors as separateColorsFn,
    encodeMessageColor as encodeMessageColorFn,
    decodeMessageColor as decodeMessageColorFn,
    colorFromComponents as colorFromComponentsFn,
} from "./io/color.js";
import { strLenWithoutEscapes as strLenWithoutEscapesFn } from "./io/text.js";
import { buildUpdateFlavorTextFn, buildRefreshDungeonCellFn, buildRefreshSideBarFn } from "./io-wiring.js";
import { flashTemporaryAlert as flashTemporaryAlertFn } from "./io/effects-alerts.js";
import type { EffectsContext } from "./io/effects.js";

// =============================================================================
// Private helpers
// =============================================================================

function fakeEvent(): RogueEvent {
    return {
        eventType: EventType.EventError,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };
}

// =============================================================================
// Context interfaces
// =============================================================================

/** Context for display / cell rendering operations. Wired in port-v2-platform. */
export interface DisplayContext {
    rogue: {
        displayStealthRangeMode: boolean;
        trueColorMode: boolean;
    };
    displayBuffer: ScreenDisplayBuffer;
    refreshDungeonCell(loc: Pos): void;
    refreshSideBar(x: number, y: number, forceFullUpdate: boolean): void;
    plotCharWithColor(ch: number, pos: WindowPos, fg: Readonly<Color>, bg: Readonly<Color>): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    updateFlavorText(): void;
}

/** Context for message archive, display, and interaction. */
export interface MessageContext {
    rogue: {
        playerTurnNumber: number;
        cautiousMode: boolean;
        disturbed: boolean;
        autoPlayingLevel: boolean;
        playbackMode: boolean;
        playbackOOS: boolean;
        playbackDelayThisTurn: number;
        playbackDelayPerTurn: number;
        playbackFastForward: boolean;
    };
    messageState: MessageState;
    displayBuffer: ScreenDisplayBuffer;
    plotCharWithColor(ch: number, pos: WindowPos, fg: Readonly<Color>, bg: Readonly<Color>): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    refreshSideBar(x: number, y: number, forceFullUpdate: boolean): void;
    refreshDungeonCell(loc: Pos): void;
    waitForAcknowledgment(): void | Promise<void>;
    pauseBrogue(ms: number, behavior: PauseBehavior): Promise<boolean>;
    nextBrogueEvent(textInput: boolean, colorsDance: boolean, realInput: boolean): Promise<RogueEvent>;
    flashTemporaryAlert(msg: string, ms: number): void | Promise<void>;
    updateFlavorText(): void;
    stripShiftFromMovementKeystroke(keystroke: number): number;
}

/** Context for inventory display. */
export interface InventoryContext {
    rogue: {
        weapon: Item | null;
        armor: Item | null;
        ringLeft: Item | null;
        ringRight: Item | null;
        strength: number;
    };
    packItems: Item[];
    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string;
    itemMagicPolarity(theItem: Item): number;
    numberOfItemsInPack(): number;
    message(msg: string, flags: number): void;
    confirmMessages(): void;
    buttonInputLoop(
        buttons: BrogueButton[],
        buttonCount: number,
        winX: number,
        winY: number,
        winWidth: number,
        winHeight: number,
    ): Promise<{ chosenButton: number; event: RogueEvent }>;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    apply(theItem: Item): void | Promise<void>;
    equip(theItem: Item): void | Promise<void>;
    unequip(theItem: Item): void | Promise<void>;
    drop(theItem: Item): void | Promise<void>;
    throwCommand(theItem: Item, confirmed: boolean): void | Promise<void>;
    relabel(theItem: Item): void | Promise<void>;
    call(theItem: Item): void | Promise<void>;
    white: Readonly<Color>;
    gray: Readonly<Color>;
    black: Readonly<Color>;
}

/**
 * Context for the button input system.
 *
 * nextBrogueEvent MUST return Promise<RogueEvent> — not a synchronous value.
 * This is the async bridge contract for the browser platform.
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
        inputChar: number,
        x: number,
        y: number,
        fg: Readonly<Color>,
        bg: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): void;
    locIsInWindow(pos: { windowX: number; windowY: number }): boolean;
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;
    nextBrogueEvent(
        textInput: boolean,
        colorsDance: boolean,
        realInputEvenInPlayback: boolean,
    ): Promise<RogueEvent>;
    pauseBrogue(milliseconds: number): Promise<boolean>;
    pauseAnimation(milliseconds: number): Promise<boolean>;
}

// =============================================================================
// buildDisplayContext
// =============================================================================

/**
 * Build a DisplayContext backed by the current game state.
 *
 * Pure display-buffer operations are wired to io/display.ts.
 * refreshDungeonCell, refreshSideBar, and updateFlavorText require the
 * dungeon appearance system and remain stubbed until Phase 7.
 */
export function buildDisplayContext(): DisplayContext {
    const { rogue, displayBuffer } = getGameState();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const refreshSideBarInner = buildRefreshSideBarFn();
    return {
        rogue,
        displayBuffer,
        refreshDungeonCell,
        refreshSideBar: (_x, _y, _force) => refreshSideBarInner(),
        plotCharWithColor: (ch, pos, fg, bg) =>
            { plotCharWithColorFn(ch, pos, fg, bg, displayBuffer); },
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        clearDisplayBuffer: clearDisplayBufferFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        updateFlavorText: buildUpdateFlavorTextFn(),
    };
}

// =============================================================================
// buildMessageContext
// =============================================================================

/**
 * Build a MessageContext backed by the current game state.
 *
 * Pure display-buffer operations are wired to io/display.ts.
 * refreshDungeonCell, refreshSideBar, updateFlavorText, flashTemporaryAlert,
 * waitForAcknowledgment, and nextBrogueEvent require either the dungeon
 * appearance system or the async event bridge and remain stubbed until Phase 7.
 */
export function buildMessageContext(): MessageContext {
    const { rogue, messageState, displayBuffer } = getGameState();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const refreshSideBarInner = buildRefreshSideBarFn();
    return {
        rogue,
        messageState,
        displayBuffer,
        plotCharWithColor: (ch, pos, fg, bg) =>
            { plotCharWithColorFn(ch, pos, fg, bg, displayBuffer); },
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        refreshSideBar: (_x, _y, _force) => refreshSideBarInner(),
        refreshDungeonCell,
        waitForAcknowledgment: async (): Promise<void> => {
            if (rogue.autoPlayingLevel || (rogue.playbackMode && !rogue.playbackOOS)) {
                return;
            }
            try {
                commitDraws();
                // Drain any event buffered by a preceding animation loop
                // (e.g. colorFlash's pauseAndCheckForEvent).  Without this,
                // a space/click pressed to skip the animation would
                // immediately dismiss the "--MORE--" prompt the player
                // hasn't even seen yet.  C never has this issue because its
                // blocking nextBrogueEvent() always reads a fresh event.
                drainLookahead();
                let event = await waitForEvent();
                while (!(
                    (event.eventType === EventType.Keystroke &&
                        (event.param1 === 32 /* space */ || event.param1 === 0x1b /* escape */)) ||
                    event.eventType === EventType.MouseUp
                )) {
                    event = await waitForEvent();
                }
            } catch {
                // Platform not initialised (tests) — acknowledge immediately
            }
        },
        pauseBrogue: async (ms) => {
            // C: pauseBrogue() calls commitDraws() before waiting (IO.c:2368).
            // Without this flush the message archive overlay is never rendered.
            try { commitDraws(); return await pauseAndCheckForEvent(ms); } catch { return false; }
        },
        nextBrogueEvent: async () => {
            // C: nextBrogueEvent() calls commitDraws() in the non-playback path (IO.c:2415).
            // Without this flush the message archive scroll loop shows nothing.
            try { commitDraws(); return await waitForEvent(); } catch { return fakeEvent(); }
        },
        flashTemporaryAlert: async (msg: string, ms: number) => {
            const fCtx = {
                rogue: { playbackFastForward: rogue.playbackFastForward },
                displayBuffer,
                strLenWithoutEscapes: strLenWithoutEscapesFn,
                colorFromComponents: colorFromComponentsFn,
                applyColorAverage: applyColorAverageFn,
                plotCharWithColor: (ch: number, pos: { windowX: number; windowY: number }, fg: Color, bg: Color) =>
                    plotCharWithColorFn(ch, pos, fg, bg, displayBuffer),
                commitDraws,
                pauseBrogue: (milliseconds: number) => pauseAndCheckForEvent(milliseconds),
            } as unknown as EffectsContext;
            await flashTemporaryAlertFn(msg, ms, fCtx);
        },
        updateFlavorText: buildUpdateFlavorTextFn(),
        stripShiftFromMovementKeystroke: (k) => k,
    };
}

// buildInventoryContext — split to ui-inventory.ts to keep this file under 600 lines.
export { buildInventoryContext } from "./ui-inventory.js";

// =============================================================================
// buildButtonContext
// =============================================================================

/**
 * Build a ButtonContext backed by the current game state.
 *
 * nextBrogueEvent, pauseBrogue, and pauseAnimation are always async
 * (returning Promise<RogueEvent> / Promise<boolean>).  This is the async
 * bridge contract required by the browser platform.
 *
 * Color, text, and display-buffer operations are wired to real io/ functions.
 * The async event bridge (nextBrogueEvent, pauseBrogue, pauseAnimation) remains
 * stubbed until Phase 7 when the browser platform is fully wired.
 */
export function buildButtonContext(): ButtonContext {
    const { rogue, displayBuffer } = getGameState();
    return {
        rogue: {
            playbackMode: rogue.playbackMode,
            playbackPaused: rogue.playbackPaused,
        },
        // -- Color / text ops wired to io/color.ts and io/text.ts -------------
        applyColorAverage: applyColorAverageFn,
        bakeColor: bakeColorFn,
        separateColors: separateColorsFn,
        strLenWithoutEscapes: strLenWithoutEscapesFn,
        decodeMessageColor: decodeMessageColorFn,
        encodeMessageColor: encodeMessageColorFn,
        // -- Rendering ops wired to io/display.ts -----------------------------
        plotCharToBuffer: plotCharToBufferFn,
        locIsInWindow: locIsInWindowFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        clearDisplayBuffer: clearDisplayBufferFn,
        overlayDisplayBuffer: (dbuf) => applyOverlayFn(displayBuffer, dbuf),
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        // -- Async bridge: these MUST return Promises -------------------------
        // waitForEvent() throws when platform not initialised (tests); fall back
        // to an escape keystroke so button loops terminate cleanly.
        nextBrogueEvent: async () => {
            try { commitDraws(); return await waitForEvent(); } catch {
                return { eventType: EventType.Keystroke, param1: 0x1b, param2: 0, controlKey: false, shiftKey: false };
            }
        },
        pauseBrogue: async (ms) => { try { return await pauseAndCheckForEvent(ms); } catch { return false; } },
        pauseAnimation: async (ms) => { try { return await pauseAndCheckForEvent(ms); } catch { return false; } },
    };
}
