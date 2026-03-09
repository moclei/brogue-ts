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
import { buildTurnProcessingContext, buildMonstersTurnContext } from "../src/turn.js";
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

it("monstUseMagic returns false for a monster with no bolt abilities", () => {
    // A rat has no bolts — monstUseBolt short-circuits and returns false,
    // so monstUseMagic returns false without attempting to cast.
    setupPlayer();
    const ctx = buildMonstersTurnContext();
    const rat = makeTestCreature();
    // Ensure no bolt abilities (MK_RAT.bolts should be empty / [0, ...])
    rat.info.bolts = [0];
    expect(ctx.monstUseMagic(rat)).toBe(false);
});

// =============================================================================
// Stub registry — Monsters.c + Recordings.c + Time.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================


it.skip("stub: displayAnnotation() is a no-op (should display recording annotation text during playback)", () => {
    // C: Recordings.c:435 — displayAnnotation()
    // turn.ts:218 has a `() => {}` context stub.
    // Real implementation should read the next annotation string from the recording
    // buffer and display it as a message on screen during playback mode.
});

it.skip("stub: RNGCheck() is a no-op (should verify RNG state matches recorded value during playback)", () => {
    // C: Recordings.c:582 — RNGCheck()
    // turn.ts:259 has a `() => {}` context stub.
    // Real implementation should read the stored RNG seed from the recording buffer
    // and compare it against the current RNG state, halting on out-of-sync mismatch.
});

it.skip("stub: recallEvent() returns a fake event (should replay recorded input events during playback)", () => {
    // C: Recordings.c:340 — recallEvent()
    // io/input-context.ts:252 has a fakeEvent stub returning a synthetic event object.
    // Real implementation should decode the next event from the recording buffer
    // and return it so the main input loop replays the original player input.
});

it.skip("stub: executePlaybackInput() always returns false (should execute one step of recording playback)", () => {
    // C: Recordings.c:832 — executePlaybackInput()
    // io/input-context.ts:253 has a `() => false` context stub.
    // Real implementation should advance the playback state machine by one event
    // and return true if the recording has been fully replayed.
});

// =============================================================================
// Stub registry — wiring stubs (Phase 3d, port-v2-audit)
// =============================================================================

it.skip("stub: enableEasyMode() is a no-op in input context (should delegate to game-lifecycle enableEasyMode)", () => {
    // C: RogueMain.c:1384 — enableEasyMode()
    // io/input-context.ts:203 has a `() => {}` context stub with comment "LifecycleContext not wired".
    // Domain function is IMPLEMENTED at game/game-lifecycle.ts:627 (untested).
    // Real wiring should call enableEasyMode() from game-lifecycle.ts via a LifecycleContext.
});

it.skip("stub: dropItem() not yet wired into playerFalls context (startLevel dependency missing)", () => {
    // C: Items.c:7652 — dropItem()
    // Domain function IMPLEMENTED: items/floor-items.ts — dropItem().
    // playerFalls() in creature-effects.ts needs startLevel() — a full level-transition context.
    // Deferred until startLevel is wired into buildTurnProcessingContext() in Phase 8.
});

// placeItemAt in machineContext.itemOps is now wired — lifecycle.ts uses real placeItemAt()
// from items/floor-items.ts. Tests in tests/items/item-ops.test.ts cover the domain function.

it.skip("stub: makeMonsterDropItem() is () => {} in gradualCtx (turn.ts) — monsters don't drop carried items in deep water", () => {
    // C: Time.c:457 applyGradualTileEffectsToCreature — monster branch: if carriedItem and in
    // deep water, calls makeMonsterDropItem(monst). Domain function tested in creature-effects.test.ts.
    // Wiring gap: gradualCtx in buildTurnProcessingContext() (turn.ts) has makeMonsterDropItem: () => {}.
    // To fix: implement makeMonsterDropItem in gradualCtx using placeItemAt + removeItemFromArray.
    // Impact: monsters standing in deep water will never drop their carried item.
});

