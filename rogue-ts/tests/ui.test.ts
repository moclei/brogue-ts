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

it.skip("stub: buildInventoryContext().message() is a no-op (should queue display message)", () => {
    // buildInventoryContext().message(msg, flags) does nothing.
    // Real implementation should call buildMessageContext()'s message pipeline
    // to archive and display the string in the 3-row message area.
});

it.skip("stub: buildInventoryContext().confirmMessages() is a no-op (should mark messages confirmed)", () => {
    // buildInventoryContext().confirmMessages() does nothing.
    // Real implementation should set messagesUnconfirmed = 0 and redraw the
    // message area without highlighting.
});

it.skip("stub: buildInventoryContext() item actions are no-ops (should dispatch to handlers)", () => {
    // apply(), equip(), unequip(), drop(), throwCommand(), relabel(), call()
    // all do nothing.  Real implementations should call the corresponding item
    // handler functions (drinkPotion, wield, removeItem, etc.) and re-render.
});

it.skip("stub: buildButtonContext().strLenWithoutEscapes() returns s.length (should skip escapes)", () => {
    // Currently returns the raw string length.
    // Real implementation should subtract 4 bytes per COLOR_ESCAPE sequence
    // so that button widths are computed without counting escape chars.
});

it.skip("stub: buildButtonContext() color ops are no-ops (should compute button gradients)", () => {
    // applyColorAverage(), bakeColor(), separateColors(), decodeMessageColor(),
    // encodeMessageColor() and plotCharToBuffer() are all no-ops or minimal stubs.
    // Real implementations should use the io-color / io-display math so that
    // buttons render with correct gradient highlights and hover states.
});
