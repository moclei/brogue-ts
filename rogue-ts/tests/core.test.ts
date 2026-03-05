/*
 *  core.test.ts — Unit tests for shared game state (core.ts)
 *  Port V2 — rogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    initGameState,
    gameOver,
    takePendingDeathMessage,
    getGameState,
    setMonsters,
    setDormantMonsters,
    setLevels,
} from "../src/core.js";
import { MonsterBookkeepingFlag } from "../src/types/flags.js";
import { GameMode } from "../src/types/enums.js";
import { DCOLS, DROWS } from "../src/types/constants.js";

// Always start from a clean slate
beforeEach(() => {
    initGameState();
});

// =============================================================================
// initGameState
// =============================================================================

describe("initGameState", () => {
    it("produces a valid player creature", () => {
        const { player } = getGameState();
        expect(player).toBeDefined();
        expect(player.bookkeepingFlags).toBe(0);
        expect(player.currentHP).toBe(0);
        expect(player.ticksUntilTurn).toBe(0);
    });

    it("produces a valid rogue state with fresh defaults", () => {
        const { rogue } = getGameState();
        expect(rogue.gameHasEnded).toBe(false);
        expect(rogue.gameInProgress).toBe(false);
        expect(rogue.depthLevel).toBe(1);
        expect(rogue.gold).toBe(0);
        expect(rogue.strength).toBe(12);
        expect(rogue.seed).toBe(0n);
        expect(rogue.mode).toBe(GameMode.Normal);
    });

    it("produces a pmap of the correct dimensions", () => {
        const { pmap } = getGameState();
        expect(pmap).toHaveLength(DCOLS);
        expect(pmap[0]).toHaveLength(DROWS);
        expect(pmap[DCOLS - 1]).toHaveLength(DROWS);
    });

    it("produces a tmap of the correct dimensions", () => {
        const { tmap } = getGameState();
        expect(tmap).toHaveLength(DCOLS);
        expect(tmap[0]).toHaveLength(DROWS);
    });

    it("pmap cells have correct initial structure", () => {
        const { pmap } = getGameState();
        const cell = pmap[0][0];
        expect(cell.flags).toBe(0);
        expect(cell.volume).toBe(0);
        expect(cell.machineNumber).toBe(0);
        expect(cell.layers).toHaveLength(4);
    });

    it("starts with empty monster and item lists", () => {
        const { monsters, dormantMonsters, packItems, floorItems, levels } = getGameState();
        expect(monsters).toHaveLength(0);
        expect(dormantMonsters).toHaveLength(0);
        expect(packItems).toHaveLength(0);
        expect(floorItems).toHaveLength(0);
        expect(levels).toHaveLength(0);
    });

    it("resets mutable catalogs on each call", () => {
        const state1 = getGameState();
        const catalogRef1 = state1.monsterCatalog;

        initGameState();

        const state2 = getGameState();
        const catalogRef2 = state2.monsterCatalog;

        // Each call produces a fresh copy — different array identity
        expect(catalogRef1).not.toBe(catalogRef2);
    });

    it("resets rogue state between games", () => {
        // Mutate state
        getGameState().rogue.gold = 9999;

        // Re-init
        initGameState();

        expect(getGameState().rogue.gold).toBe(0);
    });

    it("clears pending death message", () => {
        gameOver("a goblin");
        initGameState();
        expect(takePendingDeathMessage()).toBeNull();
    });
});

// =============================================================================
// gameOver
// =============================================================================

describe("gameOver", () => {
    it("sets gameHasEnded and clears gameInProgress", () => {
        const { rogue } = getGameState();
        rogue.gameInProgress = true;

        gameOver("a troll");

        expect(rogue.gameHasEnded).toBe(true);
        expect(rogue.gameInProgress).toBe(false);
        expect(rogue.autoPlayingLevel).toBe(false);
    });

    it("sets MB_IS_DYING on the player", () => {
        gameOver("a dragon");
        const { player } = getGameState();
        expect(player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
    });

    it("stores the death message for async consumption", () => {
        gameOver("a vampire bat");
        expect(takePendingDeathMessage()).toBe("a vampire bat");
    });

    it("takePendingDeathMessage clears the message after reading", () => {
        gameOver("a goblin");
        takePendingDeathMessage(); // consume
        expect(takePendingDeathMessage()).toBeNull();
    });

    it("guards against double-entry: second call is a no-op", () => {
        gameOver("a goblin");
        gameOver("a troll"); // should be ignored

        // Message should still be from first call
        expect(takePendingDeathMessage()).toBe("a goblin");
    });
});

// =============================================================================
// Setters
// =============================================================================

describe("setMonsters / setDormantMonsters / setLevels", () => {
    it("setMonsters replaces the monster list", () => {
        const newList = [{ loc: { x: 0, y: 0 } }] as any;
        setMonsters(newList);
        expect(getGameState().monsters).toBe(newList);
    });

    it("setDormantMonsters replaces the dormant list", () => {
        const newList = [{ loc: { x: 1, y: 1 } }] as any;
        setDormantMonsters(newList);
        expect(getGameState().dormantMonsters).toBe(newList);
    });

    it("setLevels replaces the level data", () => {
        const newLevels = [{ visited: true }] as any;
        setLevels(newLevels);
        expect(getGameState().levels).toBe(newLevels);
    });
});
