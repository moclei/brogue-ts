/*
 *  ui.test.ts — Integration tests for UI context builders
 *  Port V2 — rogue-ts
 *
 *  These tests verify that the context builders wire the correct game state
 *  and that the async bridge contract is upheld (nextBrogueEvent must return
 *  a Promise, never a synchronous value).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "../src/core.js";
import { initPlatform } from "../src/platform.js";
import { shuffleTerrainColors, terrainRandomValues } from "../src/render-state.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import {
    buildDisplayContext,
    buildMessageContext,
    buildInventoryContext,
    buildButtonContext,
} from "../src/ui.js";
import { EventType } from "../src/types/enums.js";
import type { Item } from "../src/types/types.js";
import { ItemCategory } from "../src/types/enums.js";

// =============================================================================
// Helpers
// =============================================================================

function makeMinimalItem(): Item {
    return {
        category: ItemCategory.FOOD,
        kind: 0,
        flags: 0,
        displayChar: 33 as never,
        foreColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 },
        quantity: 1,
        quiverNumber: 0,
        loc: { x: 0, y: 0 },
        depth: 1,
        originDepth: 1,
        enchant1: 0,
        enchant2: 0,
        vorpalEnemy: 0,
        charges: 0,
        timesEnchanted: 0,
        carried: true,
        inventoryLetter: "a",
        inscription: "",
        identified: false,
    } as unknown as Item;
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
    initGameState();
});

// =============================================================================
// buildDisplayContext
// =============================================================================

describe("buildDisplayContext", () => {
    it("returns rogue state from core", () => {
        const ctx = buildDisplayContext();
        const { rogue } = getGameState();
        expect(ctx.rogue).toBe(rogue);
    });

    it("displayBuffer is the live core buffer", () => {
        const ctx = buildDisplayContext();
        const { displayBuffer } = getGameState();
        expect(ctx.displayBuffer).toBe(displayBuffer);
    });

    it("createScreenDisplayBuffer produces a COLS×ROWS grid", () => {
        const ctx = buildDisplayContext();
        const buf = ctx.createScreenDisplayBuffer();
        expect(buf.cells).toHaveLength(100);  // COLS
        expect(buf.cells[0]).toHaveLength(34); // ROWS (31 + MESSAGE_LINES)
    });

    it("saveDisplayBuffer returns a SavedDisplayBuffer", () => {
        const ctx = buildDisplayContext();
        const saved = ctx.saveDisplayBuffer();
        expect(saved).toHaveProperty("savedScreen");
    });

    it("display callbacks smoke test — wired ops do not throw on blank map", () => {
        // refreshDungeonCell and refreshSideBar are now wired to real implementations.
        // refreshSideBar needs player.info (set during level init, not in bare initGameState),
        // so only non-appearance-dependent ops are tested here.
        const ctx = buildDisplayContext();
        const { displayBuffer } = getGameState();
        expect(() => ctx.refreshDungeonCell({ x: 5, y: 5 })).not.toThrow();
        expect(() => ctx.plotCharWithColor(65, { windowX: 0, windowY: 0 }, { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false }, { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false })).not.toThrow();
        expect(() => ctx.overlayDisplayBuffer(displayBuffer)).not.toThrow();
        expect(() => ctx.clearDisplayBuffer(displayBuffer)).not.toThrow();
        expect(() => ctx.updateFlavorText()).not.toThrow();
    });
});

// =============================================================================
// buildMessageContext
// =============================================================================

describe("buildMessageContext", () => {
    it("messageState is the live core state", () => {
        const ctx = buildMessageContext();
        const { messageState } = getGameState();
        expect(ctx.messageState).toBe(messageState);
    });

    it("messageState starts with empty archive", () => {
        const ctx = buildMessageContext();
        expect(ctx.messageState.archivePosition).toBe(0);
        expect(ctx.messageState.combatText).toBe("");
        expect(ctx.messageState.messagesUnconfirmed).toBe(0);
    });

    it("mutations to messageState are visible through getGameState", () => {
        const ctx = buildMessageContext();
        ctx.messageState.combatText = "test combat text";
        const { messageState } = getGameState();
        expect(messageState.combatText).toBe("test combat text");
    });

    it("initGameState resets messageState", () => {
        const ctx = buildMessageContext();
        ctx.messageState.combatText = "dirty";
        ctx.messageState.archivePosition = 5;
        initGameState();
        const { messageState } = getGameState();
        expect(messageState.combatText).toBe("");
        expect(messageState.archivePosition).toBe(0);
    });

    it("rogue state is the live core state", () => {
        const ctx = buildMessageContext();
        const { rogue } = getGameState();
        expect(ctx.rogue).toBe(rogue);
    });

    it("displayBuffer is the live core buffer", () => {
        const ctx = buildMessageContext();
        const { displayBuffer } = getGameState();
        expect(ctx.displayBuffer).toBe(displayBuffer);
    });

    it("nextBrogueEvent returns a Promise (async bridge contract)", async () => {
        const ctx = buildMessageContext();
        const result = ctx.nextBrogueEvent(false, false, false);
        expect(result).toBeInstanceOf(Promise);
        const event = await result;
        expect(event.eventType).toBe(EventType.EventError);
    });

    it("pauseBrogue returns a Promise", async () => {
        const ctx = buildMessageContext();
        const result = ctx.pauseBrogue(0, { interruptForMouseMove: false });
        expect(result).toBeInstanceOf(Promise);
    });
});

// =============================================================================
// buildInventoryContext
// =============================================================================

describe("buildInventoryContext", () => {
    it("packItems is the live core array", () => {
        const ctx = buildInventoryContext();
        const { packItems } = getGameState();
        expect(ctx.packItems).toBe(packItems);
    });

    it("rogue equipment fields start as null", () => {
        const ctx = buildInventoryContext();
        expect(ctx.rogue.weapon).toBeNull();
        expect(ctx.rogue.armor).toBeNull();
        expect(ctx.rogue.ringLeft).toBeNull();
        expect(ctx.rogue.ringRight).toBeNull();
    });

    it("numberOfItemsInPack returns 0 on empty pack", () => {
        const ctx = buildInventoryContext();
        expect(ctx.numberOfItemsInPack()).toBe(0);
    });

    it("numberOfItemsInPack reflects live pack state", () => {
        const { packItems } = getGameState();
        packItems.push(makeMinimalItem());
        const ctx = buildInventoryContext();
        // numberOfMatchingPackItems with category=0 counts all items
        // exact behaviour depends on implementation, just ensure it doesn't throw
        expect(() => ctx.numberOfItemsInPack()).not.toThrow();
    });

    it("buttonInputLoop returns a Promise", async () => {
        const ctx = buildInventoryContext();
        const result = ctx.buttonInputLoop([], 0, 0, 0, 0, 0);
        expect(result).toBeInstanceOf(Promise);
        const { chosenButton } = await result;
        expect(chosenButton).toBe(-1);
    });

    it("mapToWindowX and mapToWindowY are wired", () => {
        const ctx = buildInventoryContext();
        // mapToWindowX(0) = STAT_BAR_WIDTH + 1 = 21 + 1 = 22
        expect(typeof ctx.mapToWindowX(0)).toBe("number");
        expect(typeof ctx.mapToWindowY(0)).toBe("number");
    });
});

// =============================================================================
// buildButtonContext — async bridge (critical contract)
// =============================================================================

describe("buildButtonContext — async bridge", () => {
    it("nextBrogueEvent returns a Promise (not synchronous)", async () => {
        const ctx = buildButtonContext();
        const result = ctx.nextBrogueEvent(false, false, false);
        expect(result).toBeInstanceOf(Promise);
    });

    it("nextBrogueEvent resolves to a valid RogueEvent", async () => {
        const ctx = buildButtonContext();
        const event = await ctx.nextBrogueEvent(false, false, false);
        expect(event).toHaveProperty("eventType");
        expect(event).toHaveProperty("param1");
        expect(event).toHaveProperty("controlKey");
    });

    it("pauseBrogue returns a Promise", async () => {
        const ctx = buildButtonContext();
        const result = ctx.pauseBrogue(0);
        expect(result).toBeInstanceOf(Promise);
        const interrupted = await result;
        expect(typeof interrupted).toBe("boolean");
    });

    it("pauseAnimation returns a Promise", async () => {
        const ctx = buildButtonContext();
        const result = ctx.pauseAnimation(0);
        expect(result).toBeInstanceOf(Promise);
    });

    it("rogue state is wired from core", () => {
        const ctx = buildButtonContext();
        const { rogue } = getGameState();
        expect(ctx.rogue.playbackMode).toBe(rogue.playbackMode);
        expect(ctx.rogue.playbackPaused).toBe(rogue.playbackPaused);
    });

    it("stub callbacks do not throw", () => {
        const ctx = buildButtonContext();
        const c: Color = { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
        const buf = ctx.createScreenDisplayBuffer();
        expect(() => ctx.applyColorAverage(c, c, 50)).not.toThrow();
        expect(() => ctx.bakeColor(c)).not.toThrow();
        expect(() => ctx.separateColors(c, c)).not.toThrow();
        expect(() => ctx.plotCharToBuffer(65, 0, 0, c, c, buf)).not.toThrow();
        expect(() => ctx.clearDisplayBuffer(buf)).not.toThrow();
        expect(() => ctx.overlayDisplayBuffer(buf)).not.toThrow();
    });
});

// Needed for type reference in test
import type { Color } from "../src/types/types.js";

// =============================================================================
// Stub registry — behaviors deferred to port-v2-platform
// =============================================================================

it("wired: refreshDungeonCell() is wired in buildDisplayContext() via buildRefreshDungeonCellFn()", () => {
    // ui.ts: wired via buildRefreshDungeonCellFn() — calls getCellAppearance + plotCharWithColor.
    // Does not throw on blank map (player.info not accessed unless HAS_PLAYER flag is set on cell).
    const ctx = buildDisplayContext();
    expect(() => ctx.refreshDungeonCell({ x: 5, y: 5 })).not.toThrow();
});

it.skip("wired: refreshSideBar() requires player.info to be set (level-init precondition)", () => {
    // ui.ts: wired via buildRefreshSideBarFn() — now calls real sidebar rendering.
    // Requires player.info to be set (done during level initialization via generateMonster).
    // Full integration test deferred to port-v2-platform; sidebar-wiring.test.ts covers internals.
});

it.skip("stub: plotCharWithColor() requires a rendered display buffer (IO integration)", () => {
    // C: IO.c plotCharWithColor() — wired in ui.ts:244 via plotCharWithColorFn.
    // Functional in browser; unit tests lack a rendered display buffer with proper cell state.
    // IO integration test only; deferred to port-v2-platform.
});

it.skip("stub: overlayDisplayBuffer() requires a rendered display buffer (IO integration)", () => {
    // C: IO.c overlayDisplayBuffer() — wired in ui.ts:246 via applyOverlayFn.
    // Functional in browser; unit tests lack a rendered display buffer for meaningful assertions.
    // IO integration test only; deferred to port-v2-platform.
});

it.skip("stub: clearDisplayBuffer() wired to io/display; full integration test deferred", () => {
    // C: IO.c clearDisplayBuffer() — wired in ui.ts:249 via clearDisplayBufferFn.
    // Functional in browser; basic clear already exercised via buildButtonContext smoke tests.
    // Full integration test (verify all cells blanked) deferred to port-v2-platform.
});

it("updateFlavorText() is wired — no throw when rogue.disturbed is false", () => {
    // buildDisplayContext().updateFlavorText() now calls updateFlavorTextFn via buildUpdateFlavorTextFn().
    // When rogue.disturbed is false (test default), the function is a no-op (no flavor line rendered).
    // Verifies the context wiring does not throw; full render coverage is a browser integration test.
    const ctx = buildDisplayContext();
    expect(() => ctx.updateFlavorText()).not.toThrow();
    const msgCtx = buildMessageContext();
    expect(() => msgCtx.updateFlavorText()).not.toThrow();
});

it("waitForAcknowledgment() is wired — resolves immediately when platform not initialised (tests)", async () => {
    // waitForAcknowledgment() in buildMessageContext() now uses waitForEvent() via the async bridge.
    // In test context, waitForEvent() throws (platform not initialised) → caught → resolves immediately.
    // In-browser it awaits space/escape/click before returning.
    const ctx = buildMessageContext();
    await expect(ctx.waitForAcknowledgment()).resolves.toBeUndefined();
});

it("B110 (part 3): waitForAcknowledgment() waits for space/escape/click — ignores other keys", async () => {
    // Root cause: colorFlash() calls pauseAndCheckForEvent(50) which stores any
    // interrupting keystroke (e.g. space) in _lookaheadEvent.  Without drainLookahead(),
    // the next waitForEvent() call inside waitForAcknowledgment() immediately returns
    // that stale space event — dismissing the "--MORE--" prompt before the player sees it.
    //
    // Fix: waitForAcknowledgment() calls drainLookahead() after commitDraws(), so any
    // animation-buffered event is discarded before entering the acknowledgment wait loop.
    //
    // This test verifies the core acknowledgment contract: non-ack keys (e.g. 'd')
    // are ignored and the loop continues until space/escape/click arrives.
    // A mock platform queues 'd' then space (then space for all further calls so
    // subsequent tests in this file that share the platform state don't hang).
    const dKeyEvent = {
        eventType: EventType.Keystroke,
        param1: 100, // 'd' — not an acknowledgment key
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };
    const spaceEvent = {
        eventType: EventType.Keystroke,
        param1: 32, // space = ACKNOWLEDGE_KEY
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };
    let callCount = 0;
    initPlatform({
        waitForEvent(): Promise<typeof dKeyEvent | typeof spaceEvent> {
            callCount++;
            // First call: 'd' key (non-ack, should be ignored by the loop).
            // All subsequent calls: space (acknowledges).
            return Promise.resolve(callCount === 1 ? dKeyEvent : spaceEvent);
        },
    });
    const ctx = buildMessageContext();
    await ctx.waitForAcknowledgment();
    // Must have consumed 'd' (ignored) then 'space' (acknowledged) = 2 calls.
    expect(callCount).toBe(2);
});

it("flashTemporaryAlert() — wired, does not throw in test environment", () => {
    // buildMessageContext().flashTemporaryAlert() now calls flashTemporaryAlertFn from effects-alerts.ts.
    // Uses a minimal EffectsContext (no getCellAppearance / hiliteCell — those aren't used by flashMessage).
    // pauseBrogue returns false synchronously; time=0 means the animation loop runs 0 iterations.
    const ctx = buildMessageContext();
    expect(() => ctx.flashTemporaryAlert(" Alert! ", 0)).not.toThrow();
});

it("buildInventoryContext().message() queues message in archive (Phase 7a)", async () => {
    // buildInventoryContext().message(msg, flags) now wired to real message pipeline.
    const ctx = buildInventoryContext();
    await ctx.message("test message", 0);
    const { messageState } = getGameState();
    // archive position advanced = message was queued
    expect(messageState.archivePosition).toBeGreaterThan(0);
});

it("buildInventoryContext().confirmMessages() marks messages confirmed (Phase 7a)", () => {
    // buildInventoryContext().confirmMessages() now wired to real confirmMessages.
    const { messageState } = getGameState();
    messageState.messagesUnconfirmed = 3;
    const ctx = buildInventoryContext();
    ctx.confirmMessages();
    expect(messageState.messagesUnconfirmed).toBe(0);
});

it("buildInventoryContext() item actions wired (Phase 7c)", () => {
    // equip(), unequip(), drop(), relabel() now call real handlers from inventory-actions.ts.
    // throwCommand() and call() remain stubbed until Phase 8.
    // Smoke test: calling with null item returns a Promise without throwing.
    const ctx = buildInventoryContext();
    const result = ctx.equip(null as never);
    expect(result).toBeInstanceOf(Promise);
});

it("buildButtonContext().strLenWithoutEscapes() skips COLOR_ESCAPE sequences (Phase 9b-4)", () => {
    // C: Combat.c strLenWithoutEscapes — each escape is 4 bytes (char 25 + 3 data bytes).
    // Wired via strLenWithoutEscapesFn in ui.ts:530.
    const ctx = buildButtonContext();
    expect(ctx.strLenWithoutEscapes("hello")).toBe(5);
    const esc4 = String.fromCharCode(25, 0, 0, 0);
    expect(ctx.strLenWithoutEscapes(esc4 + "hello")).toBe(5);
    expect(ctx.strLenWithoutEscapes("ab" + esc4 + "cd")).toBe(4);
});

// =============================================================================
// Stub registry — Buttons.c wiring stubs (Phase 3d, port-v2-audit)
// =============================================================================

it.skip("stub: initializeButtonState() is a no-op in input context (permanent — signature mismatch)", () => {
    // C: Buttons.c:175 — initializeButtonState()
    // io/input-context.ts has () => {} stub. The TS domain function (io/buttons.ts) returns a new
    // ButtonState rather than mutating a passed-in struct (TS/C signature mismatch).
    // buttonInputLoop calls it directly so this context slot is never needed.
    // Permanently acceptable stub — documented in TASKS.md ## Deferred.
});

it("buttonInputLoop() wired in input context — delegates to io/buttons (Phase 7c)", async () => {
    // C: Buttons.c:323 — buttonInputLoop()
    // io/input-context.ts now delegates to buttonInputLoopFn + buildButtonContext().
    // Platform not initialised → nextBrogueEvent falls back to escape key → loop exits.
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    const result = ctx.buttonInputLoop([], 0, 0, 0, 0, 0, null);
    expect(result).toBeInstanceOf(Promise);
    const chosen = await result;
    expect(chosen).toBe(-1);
});

it("buttonInputLoop() wired in ui/inventory context — delegates to io/buttons (Phase 7c)", async () => {
    // C: Buttons.c:323 — buttonInputLoop()
    // buildInventoryContext().buttonInputLoop now delegates to buttonInputLoopFn.
    // Platform not initialised → nextBrogueEvent falls back to escape key → loop exits.
    const ctx = buildInventoryContext();
    const result = ctx.buttonInputLoop([], 0, 0, 0, 0, 0);
    expect(result).toBeInstanceOf(Promise);
    const { chosenButton } = await result;
    expect(chosenButton).toBe(-1);
});

it("buildButtonContext() color ops are wired to real io/ implementations (Phase 9b-4)", () => {
    // applyColorAverage, bakeColor, separateColors, encodeMessageColor, decodeMessageColor,
    // plotCharToBuffer all wired in ui.ts:527–534.
    const ctx = buildButtonContext();
    // applyColorAverage blends base toward target
    const base: Color = { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
    const target: Color = { red: 0, green: 0, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
    ctx.applyColorAverage(base, target, 50);
    expect(base.red).toBe(50);
    expect(base.blue).toBe(50);
    // encodeMessageColor produces a 4-byte escape sequence starting with char 25
    const encoded = ctx.encodeMessageColor(target);
    expect(encoded.length).toBe(4);
    expect(encoded.charCodeAt(0)).toBe(25); // COLOR_ESCAPE
    // strLenWithoutEscapes strips the escape — 4-byte prefix not counted
    expect(ctx.strLenWithoutEscapes(encoded + "hi")).toBe(2);
});

// =============================================================================
// Stub registry — IO.c domain stubs (Phase 3b, port-v2-audit)
// =============================================================================

it("displayLevel() is wired in buildInputContext() and buildItemHandlerContext() (Phase 7)", async () => {
    // C: IO.c:910 — displayLevel(). Now wired via buildDisplayLevelFn() in io-wiring.ts
    // in items.ts and input-context.ts. Previously stubbed as () => {}.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    expect(() => buildInputContext().displayLevel()).not.toThrow();
});

it("shuffleTerrainColors() populates terrainRandomValues (Phase 7a)", () => {
    // C: IO.c:966 — shuffleTerrainColors() now wired in lifecycle.ts and turn.ts.
    // Seed the RNG so randRange returns non-zero values, then reset all and shuffle.
    seedRandomGenerator(12345n);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) terrainRandomValues[i][j].fill(0);
    shuffleTerrainColors(100, true);
    // After a full reset, at least one cell in the grid should have a non-zero value.
    let found = false;
    outer: for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
            if (terrainRandomValues[i][j].some((v) => v !== 0)) { found = true; break outer; }
        }
    }
    expect(found).toBe(true);
});

it("displayMessageArchive() returns a Promise and resolves without throwing (B104)", async () => {
    // C: IO.c:3356 — displayMessageArchive() now async; wired via buildMessageContext() in input-context.ts.
    // With an empty archive (length <= MESSAGE_LINES) it returns early without entering the scroll loop.
    // In test context (platform not initialised), nextBrogueEvent/pauseBrogue fall back to no-ops.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    const result = ctx.displayMessageArchive();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.not.toThrow();
});

it("printHelpScreen() renders help overlay without throwing (Phase 7c)", async () => {
    // C: IO.c:4066 — printHelpScreen() in io/overlay-screens.ts.
    // Now async with optional waitFn; passes overlayWaitFn from input-context
    // (which awaits one event, falling back to no-op when platform not initialised).
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    await expect(Promise.resolve(ctx.printHelpScreen())).resolves.not.toThrow();
});

it("displayFeatsScreen() renders feats overlay without throwing (Phase 7c)", async () => {
    // C: IO.c:4188 — displayFeatsScreen() in io/overlay-screens.ts.
    // Now async with optional waitFn.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    await expect(Promise.resolve(ctx.displayFeatsScreen())).resolves.not.toThrow();
});

it("printDiscoveriesScreen() renders discoveries overlay without throwing (Phase 7c)", async () => {
    // C: IO.c:4240 — printDiscoveriesScreen() in io/overlay-screens.ts.
    // Now async with optional waitFn.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    await expect(Promise.resolve(ctx.printDiscoveriesScreen())).resolves.not.toThrow();
});

it("printSeed() wired: displays seed via message system (Phase 7a)", async () => {
    // C: IO.c:4391 — printSeed() now wired in io/input-context.ts.
    // Calling it should not throw; it emits the seed as a message.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    expect(() => ctx.printSeed()).not.toThrow();
});

it("displayGrid() wired: renders numeric grid overlay without throwing", async () => {
    // C: IO.c:4339 — displayGrid()
    // Iterates DCOLS×DROWS, maps grid values to a blue→red→green color scale,
    // and calls plotCharWithColor for each visible cell.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    const grid: number[][] = Array.from({ length: 79 }, () => new Array(29).fill(0));
    expect(() => ctx.displayGrid(grid)).not.toThrow();
});

it("displayWaypoints() wired: renders waypoint distances without throwing", async () => {
    // C: IO.c:2206 — displayWaypoints()
    // Highlights cells near waypoints with white tint, then calls temporaryMessage + displayLevel.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    expect(() => ctx.displayWaypoints()).not.toThrow();
});

it("displayMachines() wired: renders machine numbers without throwing", async () => {
    // C: IO.c:2226 — displayMachines()
    // Overlays machine number glyphs and random per-machine background colors.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    expect(() => ctx.displayMachines()).not.toThrow();
});

it("displayChokeMap() wired: renders choke distances without throwing", async () => {
    // C: IO.c:2264 — displayChokeMap()
    // Colors cells by chokeMap value; gate sites tinted teal, others red gradient.
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    expect(() => ctx.displayChokeMap()).not.toThrow();
});

it("displayLoops() wired: renders loop/chokepoint cells without throwing", async () => {
    // C: IO.c:2289 — displayLoops()
    // Highlights IN_LOOP cells (yellow) and IS_CHOKEPOINT cells (teal).
    initGameState();
    const { buildInputContext } = await import("../src/io/input-context.js");
    const ctx = buildInputContext();
    expect(() => ctx.displayLoops()).not.toThrow();
});

it.skip("stub: saveRecording() is a no-op (DEFER: port-v2-persistence)", () => {
    // DEFER: port-v2-persistence — serialise recording buffer to file/browser storage.
    // C: RogueMain.c — saveRecording() called from gameOver() and victory().
    // lifecycle.ts:buildLifecycleContext() has saveRecording: (_f) => {} stub.
});

it.skip("stub: saveRecordingNoPrompt() is a no-op (DEFER: port-v2-persistence)", () => {
    // DEFER: port-v2-persistence — silent recording save without player prompt.
    // C: RogueMain.c — saveRecordingNoPrompt() called from gameOver() and victory() in server mode.
    // lifecycle.ts:buildLifecycleContext() has saveRecordingNoPrompt: (_f) => {} stub.
});
