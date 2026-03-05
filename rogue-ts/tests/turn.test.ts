/*
 *  turn.test.ts — Integration tests for the turn processing pipeline
 *  Port V2 — rogue-ts
 *
 *  These tests exercise playerTurnEnded() through the real context builder
 *  (buildTurnProcessingContext). They verify scheduler behaviour without
 *  requiring a full platform.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState, setMonsters } from "../src/core.js";
import { buildTurnProcessingContext } from "../src/turn.js";
import { playerTurnEnded as playerTurnEndedFn } from "../src/time/turn-processing.js";
import { createCreature } from "../src/monsters/monster-creation.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterBookkeepingFlag } from "../src/types/flags.js";
import { MonsterType, StatusEffect } from "../src/types/enums.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Return a minimal valid player info from the catalog. */
function playerInfo() {
    return { ...monsterCatalog[MonsterType.MK_YOU] };
}

/** Return a minimal valid monster (rat) from the catalog. */
function monsterInfo() {
    return { ...monsterCatalog[MonsterType.MK_RAT] };
}

/**
 * Produce a test-ready Creature with enough fields set that playerTurnEnded
 * won't hit null-deref or trigger starvation/death mid-test.
 */
function makeTestCreature(opts: {
    movementSpeed?: number;
    ticksUntilTurn?: number;
    isPlayer?: boolean;
} = {}): ReturnType<typeof createCreature> {
    const c = createCreature();
    c.info = opts.isPlayer ? playerInfo() : monsterInfo();
    c.currentHP = c.info.maxHP;
    c.movementSpeed = opts.movementSpeed ?? 100;
    c.attackSpeed = 100;
    c.ticksUntilTurn = opts.ticksUntilTurn ?? 200; // high → won't get a turn
    // Prevent starvation: Nutrition must be > 0
    c.status[StatusEffect.Nutrition] = 2150;
    return c;
}

/** Set up a valid player in the game state. */
function setupPlayer(): ReturnType<typeof createCreature> {
    const { player, rogue } = getGameState();
    const p = makeTestCreature({ isPlayer: true, movementSpeed: 100, ticksUntilTurn: 100 });
    // Copy fields onto the existing player object (core.ts holds a reference)
    Object.assign(player, p);
    // Give enough ticks to end the turn
    player.ticksUntilTurn = 100;
    rogue.ticksTillUpdateEnvironment = 100;
    return player;
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
    initGameState();
});

describe("playerTurnEnded — scheduler", () => {
    it("completes a turn with no monsters present", () => {
        setupPlayer();
        const ctx = buildTurnProcessingContext();
        expect(() => playerTurnEndedFn(ctx)).not.toThrow();
        expect(ctx.player.ticksUntilTurn).toBeLessThanOrEqual(0);
    });

    it("skips dying monsters in the soonestTurn calculation", () => {
        setupPlayer();
        const { monsters } = getGameState();

        // Add a slow monster that would normally dominate soonestTurn
        const slow = makeTestCreature({ movementSpeed: 200, ticksUntilTurn: 5000 });
        slow.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        monsters.push(slow);

        const ctx = buildTurnProcessingContext();
        // Should not spin forever — dying monster is excluded from soonestTurn
        expect(() => playerTurnEndedFn(ctx)).not.toThrow();
        expect(ctx.player.ticksUntilTurn).toBeLessThanOrEqual(0);
    });

    it("removes all dying monsters after playerTurnEnded", () => {
        setupPlayer();
        const { monsters } = getGameState();

        const alive1 = makeTestCreature({ ticksUntilTurn: 200 });
        const alive2 = makeTestCreature({ ticksUntilTurn: 200 });
        const dying  = makeTestCreature({ ticksUntilTurn: 200 });
        dying.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        monsters.push(alive1, alive2, dying);

        const ctx = buildTurnProcessingContext();
        playerTurnEndedFn(ctx);

        // removeDeadMonsters() runs at end of playerTurnEnded
        const remaining = getGameState().monsters;
        expect(remaining).toHaveLength(2);
        expect(remaining).not.toContain(dying);
        expect(remaining).toContain(alive1);
        expect(remaining).toContain(alive2);
    });

    it("handles 3 monsters — one dying mid-turn — without soonestTurn freeze", () => {
        setupPlayer();
        const { monsters } = getGameState();

        const m1 = makeTestCreature({ ticksUntilTurn: 200 });
        const m2 = makeTestCreature({ ticksUntilTurn: 200 });
        const m3 = makeTestCreature({ ticksUntilTurn: 200 });
        m3.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        monsters.push(m1, m2, m3);

        const ctx = buildTurnProcessingContext();
        playerTurnEndedFn(ctx);

        expect(ctx.player.ticksUntilTurn).toBeLessThanOrEqual(0);
        const remaining = getGameState().monsters;
        expect(remaining).toHaveLength(2);
        expect(remaining).not.toContain(m3);
    });

    it("increments absoluteTurnNumber and playerTurnNumber", () => {
        const { rogue } = getGameState();
        setupPlayer();

        const before = { abs: rogue.absoluteTurnNumber, player: rogue.playerTurnNumber };
        const ctx = buildTurnProcessingContext();
        playerTurnEndedFn(ctx);

        expect(rogue.absoluteTurnNumber).toBeGreaterThan(before.abs);
        expect(rogue.playerTurnNumber).toBeGreaterThan(before.player);
    });

    it("does not advance turn if gameHasEnded is set", () => {
        const { rogue, player } = getGameState();
        setupPlayer();
        rogue.gameHasEnded = true;
        const beforeAbs = rogue.absoluteTurnNumber;

        const ctx = buildTurnProcessingContext();
        playerTurnEndedFn(ctx);

        // Main loop exits immediately when gameHasEnded
        expect(rogue.absoluteTurnNumber).toBe(beforeAbs);
    });
});

// =============================================================================
// Stub audit: known-incomplete behaviours in buildMonstersTurnContext
// =============================================================================

it.skip("stub: updateMonsterState wires real monster state transitions", () => {
    // buildMonstersTurnContext().updateMonsterState is a no-op.
    // Real implementation should call monster-state.ts updateMonsterState().
});

it.skip("stub: moveMonster wires real movement with collision detection", () => {
    // buildMonstersTurnContext().moveMonster is a no-op returning false.
    // Real implementation should call movement/player-movement.ts moveMonster().
});

it.skip("stub: monstUseMagic wires bolt/spell AI", () => {
    // buildMonstersTurnContext().monstUseMagic is a no-op returning false.
    // Real implementation should call monster-actions.ts monstUseMagic().
});

it.skip("stub: scentDirection wires scent-following pathfinding", () => {
    // buildMonstersTurnContext().scentDirection returns -1 (no scent).
    // Real implementation needs live scentMap and monster-state helpers.
});

it.skip("stub: pathTowardCreature wires Dijkstra pathfinding", () => {
    // buildMonstersTurnContext().pathTowardCreature is a no-op.
    // Real implementation needs monster mapToMe Dijkstra maps.
});
