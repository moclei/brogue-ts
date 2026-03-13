/*
 *  platform.test.ts — Tests for the async event bridge and main game loop
 *  Port V2 — rogue-ts
 *
 *  Verifies:
 *   - initPlatform() / waitForEvent() — async contract
 *   - processEvent() with MouseDown — left-click dispatches travel(target, true)
 *     with no confirmation dialog (autoConfirm = true)
 *   - mainGameLoop() — exits when gameHasEnded is set
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState, gameOver } from "../src/core.js";
import { initPlatform, waitForEvent, processEvent, mainGameLoop } from "../src/platform.js";
import { buildHoverHandlerFn, buildClearHoverPathFn } from "../src/io/hover-wiring.js";
import { EventType, StatusEffect, TileType } from "../src/types/enums.js";
import { TileFlag } from "../src/types/flags.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType } from "../src/types/enums.js";
import { mapToWindowX, mapToWindowY } from "../src/globals/tables.js";
import type { RogueEvent } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Minimal mock console that resolves one pre-queued event then hangs. */
function makeMockConsole(events: RogueEvent[]) {
    let index = 0;
    return {
        waitForEvent(): Promise<RogueEvent> {
            if (index < events.length) {
                return Promise.resolve(events[index++]);
            }
            // Hang indefinitely — caller must terminate the loop externally
            return new Promise(() => { /* never resolves */ });
        },
    };
}

function setupPlayer() {
    const { player, rogue, pmap } = getGameState();
    const cat = monsterCatalog[MonsterType.MK_YOU];
    Object.assign(player, {
        info: { ...cat, damage: { ...cat.damage }, foreColor: { ...cat.foreColor }, bolts: [...cat.bolts] },
        currentHP: cat.maxHP,
        movementSpeed: 100,
        attackSpeed: 100,
        ticksUntilTurn: 100,
    });
    player.loc = { x: 5, y: 5 };
    player.status[StatusEffect.Nutrition] = 2150;
    rogue.ticksTillUpdateEnvironment = 100;
    rogue.strength = 12;

    // Place player and surrounding cells as passable + discovered floor
    for (let dx = -1; dx <= 2; dx++) {
        for (let dy = -1; dy <= 2; dy++) {
            const cell = pmap[5 + dx]?.[5 + dy];
            if (cell) {
                cell.layers[0] = TileType.FLOOR;
                cell.layers[1] = TileType.NOTHING;
                cell.layers[2] = TileType.NOTHING;
                cell.layers[3] = TileType.NOTHING;
                cell.flags |= TileFlag.DISCOVERED;
            }
        }
    }
    pmap[5][5].flags |= TileFlag.HAS_PLAYER;
    return player;
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
    initGameState();
});

describe("initPlatform / waitForEvent", () => {
    it("waitForEvent returns a Promise", async () => {
        const event: RogueEvent = {
            eventType: EventType.Keystroke,
            param1: 32,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };
        initPlatform(makeMockConsole([event]));
        const result = waitForEvent();
        expect(result).toBeInstanceOf(Promise);
        const resolved = await result;
        expect(resolved.eventType).toBe(EventType.Keystroke);
        expect(resolved.param1).toBe(32);
    });
});

describe("processEvent — left-click", () => {
    it("dispatches travel to adjacent cell without hanging (autoConfirm = true)", async () => {
        const player = setupPlayer();

        // Click on the cell one step to the right of the player (dungeon coords 6,5)
        // window coords = mapToWindowX(6), mapToWindowY(5)
        const clickEvent: RogueEvent = {
            eventType: EventType.MouseDown,
            param1: mapToWindowX(6),
            param2: mapToWindowY(5),
            controlKey: false,
            shiftKey: false,
        };

        // processEvent should complete without awaiting additional input
        await processEvent(clickEvent);

        // Player should have moved to (6, 5) — adjacent cell, no confirmation needed
        expect(player.loc.x).toBe(6);
        expect(player.loc.y).toBe(5);
    });

    it("ignores clicks outside the dungeon map bounds", async () => {
        const player = setupPlayer();

        // Click on the sidebar (window x = 0, which maps to dungeon x = -21, out of bounds)
        const clickEvent: RogueEvent = {
            eventType: EventType.MouseDown,
            param1: 0,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        await processEvent(clickEvent);

        // Player should not have moved
        expect(player.loc.x).toBe(5);
        expect(player.loc.y).toBe(5);
    });
});

// B35 — mouse hover: path highlight + location description
describe("B35 hover handler", () => {
    it("sets IS_IN_PATH on cells along the path from player to cursor", () => {
        setupPlayer(); // player at (5,5)

        // Extend passable floor from player to (10,5)
        const { pmap } = getGameState();
        for (let x = 5; x <= 10; x++) {
            const cell = pmap[x][5];
            cell.layers[0] = TileType.FLOOR;
            cell.layers[1] = TileType.NOTHING;
            cell.layers[2] = TileType.NOTHING;
            cell.layers[3] = TileType.NOTHING;
            cell.flags |= TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED;
        }

        const hover = buildHoverHandlerFn();
        hover(10, 5); // hover over (10, 5)

        // At least one intermediate cell should have IS_IN_PATH set
        let pathCellCount = 0;
        for (let x = 6; x <= 10; x++) {
            if (pmap[x][5].flags & TileFlag.IS_IN_PATH) pathCellCount++;
        }
        expect(pathCellCount).toBeGreaterThan(0);
    });

    it("clears IS_IN_PATH on all cells when clearHoverPath is called", () => {
        setupPlayer();
        const { pmap } = getGameState();
        for (let x = 5; x <= 10; x++) {
            const cell = pmap[x][5];
            cell.layers[0] = TileType.FLOOR;
            cell.layers[1] = TileType.NOTHING;
            cell.layers[2] = TileType.NOTHING;
            cell.layers[3] = TileType.NOTHING;
            cell.flags |= TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED;
        }

        const hover = buildHoverHandlerFn();
        hover(10, 5);

        const clearPath = buildClearHoverPathFn();
        clearPath();

        for (let x = 5; x <= 10; x++) {
            expect(pmap[x][5].flags & TileFlag.IS_IN_PATH).toBe(0);
        }
    });

    it("clears old path when hovering a different cell", () => {
        setupPlayer();
        const { pmap } = getGameState();
        for (let x = 5; x <= 10; x++) {
            const cell = pmap[x][5];
            cell.layers[0] = TileType.FLOOR;
            cell.layers[1] = TileType.NOTHING;
            cell.layers[2] = TileType.NOTHING;
            cell.layers[3] = TileType.NOTHING;
            cell.flags |= TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED;
        }

        const hover = buildHoverHandlerFn();
        hover(10, 5);
        hover(6, 5); // move hover to adjacent cell

        // Cell at (10,5) should no longer have IS_IN_PATH
        expect(pmap[10][5].flags & TileFlag.IS_IN_PATH).toBe(0);
    });
});

describe("mainGameLoop", () => {
    it("exits immediately when gameHasEnded is already set", async () => {
        const { rogue } = getGameState();
        rogue.gameHasEnded = true;

        // mainGameLoop should exit without consuming any events
        let consoleUsed = false;
        initPlatform({
            waitForEvent() {
                consoleUsed = true;
                return new Promise(() => { /* never resolves */ });
            },
        });

        await mainGameLoop();

        expect(consoleUsed).toBe(false);
    });

    it("exits after gameOver is called within event processing", async () => {
        setupPlayer();

        let eventIndex = 0;
        const events: RogueEvent[] = [
            // First event: keystroke (handled as stub, no-op)
            {
                eventType: EventType.Keystroke,
                param1: 32,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            },
        ];

        initPlatform({
            waitForEvent(): Promise<RogueEvent> {
                if (eventIndex < events.length) {
                    const ev = events[eventIndex++];
                    return Promise.resolve(ev);
                }
                // After all events consumed, end the game and resolve
                gameOver("test over", true);
                // Return a no-op event that will be ignored because gameHasEnded = true
                return Promise.resolve({
                    eventType: EventType.Keystroke,
                    param1: 0,
                    param2: 0,
                    controlKey: false,
                    shiftKey: false,
                });
            },
        });

        await mainGameLoop();

        const { rogue } = getGameState();
        expect(rogue.gameHasEnded).toBe(true);
    });
});
