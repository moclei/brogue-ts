/*
 *  cursor-move.test.ts — Tests for nextTargetAfter and moveCursor
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    nextTargetAfter,
    moveCursor,
    type NextTargetContext,
    type MoveCursorContext,
} from "../../src/io/cursor-move.js";
import { AutoTargetMode, EventType, ItemCategory } from "../../src/types/enums.js";
import type { Creature, Item, Pos, RogueEvent, ButtonState, ScreenDisplayBuffer, SavedDisplayBuffer } from "../../src/types/types.js";
import { DisplayGlyph } from "../../src/types/enums.js";
import { KEY_ID_MAXIMUM, DCOLS, DROWS } from "../../src/types/constants.js";
import { itemColor, white } from "../../src/globals/colors.js";
import { MonsterBookkeepingFlag, TileFlag } from "../../src/types/flags.js";

// =============================================================================
// Minimal helpers
// =============================================================================

function pos(x: number, y: number): Pos { return { x, y }; }
function invalidPos(): Pos { return { x: -1, y: -1 }; }

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = Array.from({ length: KEY_ID_MAXIMUM }, () => ({
        loc: { x: 0, y: 0 }, machine: 0, disposableHere: false,
    }));
    return {
        category: ItemCategory.STAFF, kind: 0, flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0, charges: 3, enchant1: 0, enchant2: 0,
        timesEnchanted: 0, vorpalEnemy: 0, strengthRequired: 0, quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON, foreColor: itemColor, inventoryColor: white,
        quantity: 1, inventoryLetter: "b", inscription: "",
        loc: { x: 0, y: 0 }, keyLoc, originDepth: 1, spawnTurnNumber: 0, lastUsed: [0, 0, 0],
        nextItem: null,
        ...overrides,
    } as unknown as Item;
}

function makeMonster(x: number, y: number, overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x, y },
        info: {
            monsterName: "goblin", flags: 0, abilityFlags: 0,
            maxHP: 10, movementSpeed: 100, attackSpeed: 100,
            bolts: [], damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            defense: 0, accuracy: 100, turnsBetweenRegen: 20,
            bloodType: 0, intrinsicLightType: 0, DFChance: 0, DFType: 0,
            displayChar: "g" as DisplayGlyph,
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
        },
        currentHP: 10,
        movementSpeed: 100, attackSpeed: 100,
        turnsUntilRegen: 20, regenPerTurn: 0, ticksUntilTurn: 0,
        previousHealthPoints: 10, creatureState: 0, creatureMode: 0,
        mutationIndex: -1, bookkeepingFlags: 0, spawnDepth: 1,
        status: new Array(30).fill(0), maxStatus: new Array(30).fill(0),
        turnsSpentStationary: 0, flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
        targetCorpseLoc: invalidPos(), corpseAbsorptionCounter: -1,
        targetWaypointIndex: -1, waypointAlreadyVisited: [],
        lastSeenPlayerAt: invalidPos(), depth: 1,
        carriedItem: null, carriedMonster: null, leader: null,
        mapToMe: null, safetyMap: null,
        weaknessAmount: 0, poisonAmount: 0, wasNegated: false,
        absorptionFlags: 0, absorbBehavior: false, absorptionBolt: 0,
        xpxp: 0, newPowerCount: 0, totalPowerCount: 0, machineHome: 0,
        targetCorpseName: "",
        ...overrides,
    } as Creature;
}

// =============================================================================
// nextTargetAfter helpers
// =============================================================================

function makeNextTargetCtx(
    sidebarLocs: Pos[],
    monsters: Creature[] = [],
    overrides: Partial<NextTargetContext> = {},
): NextTargetContext {
    const player = makeMonster(0, 0);
    // Fill sidebar list to ROWS length with invalid positions
    const ROWS = 34;
    const list: Pos[] = Array.from({ length: ROWS }, (_, i) =>
        i < sidebarLocs.length ? sidebarLocs[i] : invalidPos(),
    );
    return {
        player,
        rogue: { depthLevel: 1, sidebarLocationList: list },
        boltCatalog: [],
        monstersAreTeammates: () => false,
        canSeeMonster: () => true,
        openPathBetween: () => true,
        distanceBetween: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
        wandDominate: () => 50,
        negationWillAffectMonster: () => true,
        isPosInMap: (p) => p.x >= 0 && p.x < 79 && p.y >= 0 && p.y < 29,
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        monsterAtLoc: (loc) => monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null,
        itemAtLoc: () => null,
        ...overrides,
    };
}

// =============================================================================
// nextTargetAfter
// =============================================================================

describe("nextTargetAfter", () => {
    it("returns false for AUTOTARGET_MODE_NONE", () => {
        const ctx = makeNextTargetCtx([pos(5, 5)]);
        const out = { value: pos(0, 0) };
        expect(nextTargetAfter(null, out, pos(0, 0), AutoTargetMode.None, false, ctx)).toBe(false);
    });

    it("returns false when sidebar list has no valid positions", () => {
        const ctx = makeNextTargetCtx([]);
        const out = { value: pos(0, 0) };
        expect(nextTargetAfter(null, out, pos(0, 0), AutoTargetMode.Explore, false, ctx)).toBe(false);
    });

    it("EXPLORE mode returns first valid position that isn't targetLoc", () => {
        const locs = [pos(3, 5), pos(7, 8)];
        const ctx = makeNextTargetCtx(locs);
        const out = { value: pos(0, 0) };
        // targetLoc = (3,5) so it skips that and picks (7,8)
        const found = nextTargetAfter(null, out, pos(3, 5), AutoTargetMode.Explore, false, ctx);
        expect(found).toBe(true);
        expect(out.value).toEqual(pos(7, 8));
    });

    it("EXPLORE mode skips player location only when no item at player loc", () => {
        // All sidebar entries are player's loc — should find nothing
        const player = makeMonster(5, 5);
        const ctx = makeNextTargetCtx([pos(5, 5), pos(5, 5)]);
        ctx.player = player;
        const out = { value: pos(0, 0) };
        expect(nextTargetAfter(null, out, pos(3, 3), AutoTargetMode.Explore, false, ctx)).toBe(false);
    });

    it("deduplicates consecutive identical positions", () => {
        // Two identical entries should only count as one candidate
        const locs = [pos(5, 5), pos(5, 5), pos(8, 8)];
        const ctx = makeNextTargetCtx(locs);
        const out = { value: pos(0, 0) };
        const found = nextTargetAfter(null, out, pos(5, 5), AutoTargetMode.Explore, false, ctx);
        expect(found).toBe(true);
        expect(out.value).toEqual(pos(8, 8));
    });

    it("reverseDirection iterates backward", () => {
        const locs = [pos(2, 2), pos(5, 5), pos(8, 8)];
        const ctx = makeNextTargetCtx(locs);
        const out = { value: pos(0, 0) };
        // targetLoc = (5,5); reverse should find (2,2) before (8,8)
        const found = nextTargetAfter(null, out, pos(5, 5), AutoTargetMode.Explore, true, ctx);
        expect(found).toBe(true);
        expect(out.value).toEqual(pos(2, 2));
    });
});

// =============================================================================
// moveCursor helpers
// =============================================================================

function fakeEvent(overrides: Partial<RogueEvent> = {}): RogueEvent {
    return {
        eventType: EventType.EventError,
        param1: 0, param2: 0, controlKey: false, shiftKey: false,
        ...overrides,
    };
}

function makeButtonState(): ButtonState {
    return {
        buttonFocused: -1, buttonDepressed: -1, buttonChosen: -1,
        buttonCount: 0, buttons: [], winX: 0, winY: 0, winWidth: 0, winHeight: 0,
    };
}

function makeMoveCursorCtx(
    events: RogueEvent[],
    overrides: Partial<MoveCursorContext> = {},
): MoveCursorContext {
    let idx = 0;
    const savedBuf: SavedDisplayBuffer = { savedScreen: { cells: [] } as never };
    return {
        rogue: {
            cursorLoc: pos(5, 5),
            RNG: 0,
            sidebarLocationList: Array.from({ length: 34 }, () => invalidPos()),
        },
        nextKeyOrMouseEvent: () => events[idx++] ?? fakeEvent(),
        createScreenDisplayBuffer: () => ({ cells: [] } as unknown as ScreenDisplayBuffer),
        clearDisplayBuffer: () => {},
        saveDisplayBuffer: () => savedBuf,
        overlayDisplayBuffer: () => {},
        restoreDisplayBuffer: () => {},
        drawButtonsInState: () => {},
        processButtonInput: async () => -1,
        refreshSideBar: vi.fn(),
        pmapFlagsAt: () => 0,
        canSeeMonster: () => false,
        monsterAtLoc: () => null,
        playerCanSeeOrSense: () => false,
        cellHasTMFlag: () => false,
        coordinatesAreInMap: (x, y) => x >= 0 && x < DCOLS && y >= 0 && y < DROWS,
        isPosInMap: (p) => p.x >= 0 && p.x < DCOLS && p.y >= 0 && p.y < DROWS,
        mapToWindowX: (x) => x + 20,   // sidebar is 20 cols wide
        windowToMapX: (wx) => wx - 20,
        windowToMapY: (wy) => wy,
        ...overrides,
    };
}

// =============================================================================
// moveCursor
// =============================================================================

describe("moveCursor", () => {
    it("sets canceled=true on ESCAPE key", async () => {
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: 0x1b })];
        const ctx = makeMoveCursorCtx(events);
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(5, 5) };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(can.value).toBe(true);
    });

    it("sets canceled=true on SPACE (ACKNOWLEDGE_KEY)", async () => {
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: 32 })];
        const ctx = makeMoveCursorCtx(events);
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(5, 5) };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(can.value).toBe(true);
    });

    it("sets targetConfirmed=true on RETURN key", async () => {
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: 0x0a })];
        const ctx = makeMoveCursorCtx(events);
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(5, 5) };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(tC.value).toBe(true);
    });

    it("sets tabKey=true on TAB key and returns true (re-dispatch)", async () => {
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: 0x09 })];
        const ctx = makeMoveCursorCtx(events);
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(5, 5) };
        const ev = { value: fakeEvent() };
        const doEvent = await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(tab.value).toBe(true);
        // TAB does not move cursor → cursorMovementCommand=false → returns true
        expect(doEvent).toBe(true);
    });

    it("moves cursor left with LEFT_KEY ('h')", async () => {
        const LEFT_KEY = 0x68; // 'h'
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: LEFT_KEY })];
        const ctx = makeMoveCursorCtx(events);
        ctx.rogue.cursorLoc = pos(10, 10);
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(10, 10) };
        const ev = { value: fakeEvent() };
        const doEvent = await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(loc.value.x).toBe(9);
        expect(doEvent).toBe(false); // cursor moved → returns false
    });

    it("moves cursor right with RIGHT_KEY ('l')", async () => {
        const RIGHT_KEY = 0x6c; // 'l'
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: RIGHT_KEY })];
        const ctx = makeMoveCursorCtx(events);
        ctx.rogue.cursorLoc = pos(10, 10);
        const loc = { value: pos(10, 10) };
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(loc.value.x).toBe(11);
    });

    it("mouse click on map cell confirms target", async () => {
        // mapToWindowX(0) = 20 → map starts at wx=20
        // clicking at wx=30, wy=10 → mapX=10, mapY=10
        const events = [fakeEvent({
            eventType: EventType.MouseUp,
            param1: 30, param2: 10,
            controlKey: false, shiftKey: false,
        })];
        const ctx = makeMoveCursorCtx(events);
        ctx.rogue.cursorLoc = pos(10, 10); // already at destination
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(10, 10) };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(tC.value).toBe(true);
        expect(loc.value).toEqual(pos(10, 10));
    });

    it("clamps cursor to map bounds", async () => {
        // Try to move cursor beyond DCOLS-1
        const RIGHT_KEY = 0x6c;
        const events = [fakeEvent({ eventType: EventType.Keystroke, param1: RIGHT_KEY })];
        const ctx = makeMoveCursorCtx(events);
        ctx.rogue.cursorLoc = pos(DCOLS - 1, 10);
        const loc = { value: pos(DCOLS - 1, 10) };
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(loc.value.x).toBeLessThanOrEqual(DCOLS - 1);
    });

    it("fake EventError event exits loop without modifying flags", async () => {
        // No events queued → returns immediately with defaults
        const ctx = makeMoveCursorCtx([]);
        ctx.rogue.cursorLoc = pos(5, 5);
        const tC = { value: false }, can = { value: false }, tab = { value: false };
        const loc = { value: pos(5, 5) };
        const ev = { value: fakeEvent() };
        await moveCursor(tC, can, tab, loc, ev, makeButtonState(), false, true, false, ctx);
        expect(tC.value).toBe(false);
        expect(can.value).toBe(false);
        expect(tab.value).toBe(false);
    });
});
