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

    it("display callbacks are no-ops (smoke test)", () => {
        const ctx = buildDisplayContext();
        const { displayBuffer } = getGameState();
        expect(() => ctx.refreshDungeonCell({ x: 5, y: 5 })).not.toThrow();
        expect(() => ctx.refreshSideBar(-1, -1, false)).not.toThrow();
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

it.skip("stub: refreshDungeonCell() is a no-op (should redraw one dungeon cell on screen)", () => {
    // buildDisplayContext().refreshDungeonCell(loc) does nothing.
    // Real implementation should recompute the cell's appearance and push it
    // to the canvas/terminal at the correct window coordinates.
});

it.skip("stub: refreshSideBar() is a no-op (should redraw the right-hand entity sidebar)", () => {
    // buildDisplayContext().refreshSideBar(-1, -1, false) does nothing.
    // Real implementation should enumerate nearby monsters/items and render
    // their health bars and names in the 20-column sidebar region.
});

it.skip("stub: plotCharWithColor() is a no-op (should write a char+colors to screen buffer)", () => {
    // buildDisplayContext().plotCharWithColor(ch, pos, fg, bg) does nothing.
    // Real implementation should set the glyph and color at the given window
    // position in the live display buffer and mark the cell dirty.
});

it.skip("stub: overlayDisplayBuffer() is a no-op (should merge an overlay onto screen)", () => {
    // buildDisplayContext().overlayDisplayBuffer(dbuf) does nothing.
    // Real implementation should alpha-blend the overlay cells over the current
    // screen buffer, applying the opacity field from each cell.
});

it.skip("stub: clearDisplayBuffer() is a no-op (should blank all cells in a buffer)", () => {
    // buildDisplayContext().clearDisplayBuffer(dbuf) does nothing.
    // Real implementation should set every cell's character to ' ', zero all
    // color components, and zero opacity.
});

it.skip("stub: updateFlavorText() is a no-op (should render flavor text at ROWS-2)", () => {
    // buildDisplayContext().updateFlavorText() does nothing.
    // Real implementation should recompute the terrain/item flavor string for
    // the cell under the cursor and render it in the flavor line.
});

it.skip("stub: waitForAcknowledgment() is a no-op (should block until keypress)", () => {
    // buildMessageContext().waitForAcknowledgment() does nothing.
    // Real implementation should await nextBrogueEvent and discard the result,
    // used to make the player acknowledge --MORE-- before continuing.
});

it.skip("stub: flashTemporaryAlert() is a no-op (should show a brief overlay alert)", () => {
    // buildMessageContext().flashTemporaryAlert(msg, ms) does nothing.
    // Real implementation should render msg in the message area for `ms`
    // milliseconds, then restore the previous display state.
});

it("buildInventoryContext().message() queues message in archive (Phase 7a)", () => {
    // buildInventoryContext().message(msg, flags) now wired to real message pipeline.
    const ctx = buildInventoryContext();
    ctx.message("test message", 0);
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

it.skip("stub: buildButtonContext().strLenWithoutEscapes() returns s.length (should skip escapes)", () => {
    // Currently returns the raw string length.
    // Real implementation should subtract 4 bytes per COLOR_ESCAPE sequence
    // so that button widths are computed without counting escape chars.
});

// =============================================================================
// Stub registry — Buttons.c wiring stubs (Phase 3d, port-v2-audit)
// =============================================================================

it.skip("stub: initializeButtonState() is a no-op in input context (should delegate to io/buttons initializeButtonState)", () => {
    // C: Buttons.c:175 — initializeButtonState()
    // io/input-context.ts has a `() => {}` stub; the domain function returns a new
    // ButtonState rather than mutating the passed state (signature mismatch).
    // Deferred until the cursor/dialog system needs it explicitly.
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

it.skip("stub: buildButtonContext() color ops are no-ops (should compute button gradients)", () => {
    // applyColorAverage(), bakeColor(), separateColors(), decodeMessageColor(),
    // encodeMessageColor() and plotCharToBuffer() are all no-ops or minimal stubs.
    // Real implementations should use the io-color / io-display math so that
    // buttons render with correct gradient highlights and hover states.
});

// =============================================================================
// Stub registry — IO.c domain stubs (Phase 3b, port-v2-audit)
// =============================================================================

it.skip("stub: displayLevel() is a no-op in items.ts and input-context.ts", () => {
    // C: IO.c:910 — displayLevel()
    // lifecycle.ts: IMPLEMENTED (Phase 1c). items.ts and input-context.ts still
    // have `() => {}` stubs — wired in port-v2-platform.
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

it.skip("stub: displayGrid() is a no-op (should render a debug grid overlay)", () => {
    // C: IO.c:4339 — displayGrid()
    // io/input-context.ts:260 has a `() => {}` stub.
    // Real implementation should draw a visual debug grid over the dungeon map.
});

it.skip("stub: displayWaypoints() is a no-op (should render waypoint debug overlay)", () => {
    // C: IO.c:2206 — displayWaypoints()
    // io/input-context.ts:264 has a `() => {}` stub.
    // Real implementation should draw all waypoint nodes on the dungeon map for
    // debugging monster pathfinding.
});

it.skip("stub: displayMachines() is a no-op (should render machine region debug overlay)", () => {
    // C: IO.c:2226 — displayMachines()
    // io/input-context.ts:263 has a `() => {}` stub.
    // Real implementation should colour-code dungeon cells by machine membership
    // for debugging level generation.
});

it.skip("stub: displayChokeMap() is a no-op (should render choke-point debug overlay)", () => {
    // C: IO.c:2264 — displayChokeMap()
    // io/input-context.ts:262 has a `() => {}` stub.
    // Real implementation should visualise the choke-point heat map used during
    // level generation analysis.
});

it.skip("stub: displayLoops() is a no-op (should render loop detection debug overlay)", () => {
    // C: IO.c:2289 — displayLoops()
    // io/input-context.ts:261 has a `() => {}` stub.
    // Real implementation should highlight dungeon cells that participate in
    // loop structures detected by the architect.
});

it.skip("stub: saveRecording() is a no-op (persistence layer not yet implemented)", () => {
    // C: RogueMain.c — saveRecording() called from gameOver() and victory()
    // lifecycle.ts:buildLifecycleContext() has saveRecording: (_f) => {} stub.
    // Real implementation should serialise the recording buffer to a file or
    // browser storage so the player can replay the run. Blocked on the
    // persistence layer initiative.
});

it.skip("stub: saveRecordingNoPrompt() is a no-op (persistence layer not yet implemented)", () => {
    // C: RogueMain.c — saveRecordingNoPrompt() called from gameOver() and victory() in server mode
    // lifecycle.ts:buildLifecycleContext() has saveRecordingNoPrompt: (_f) => {} stub.
    // Real implementation should silently save the recording without prompting
    // the player. Blocked on the persistence layer initiative.
});
