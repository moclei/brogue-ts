/*
 *  monster-awareness.test.ts — Tests for monster awareness mechanics
 *  brogue-ts
 *
 *  Covers: awareOfTarget (Monsters.c:1649)
 *  Focus: invisibility interaction (B103 — WAI per C ground truth)
 */

import { describe, it, expect } from "vitest";
import { awareOfTarget } from "../../src/monsters/monster-awareness.js";
import type { AwarenessContext } from "../../src/monsters/monster-awareness.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, CreatureState } from "../../src/types/enums.js";
import { MonsterBehaviorFlag } from "../../src/types/flags.js";
import type { Creature } from "../../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeCreature(monsterID: MonsterType): Creature {
    const c = createCreature();
    const cat = monsterCatalog[monsterID];
    c.info = {
        ...cat,
        damage: { ...cat.damage },
        foreColor: { ...cat.foreColor },
        bolts: [...cat.bolts],
    };
    c.loc = { x: 5, y: 5 };
    c.currentHP = c.info.maxHP;
    c.movementSpeed = c.info.movementSpeed;
    c.attackSpeed = c.info.attackSpeed;
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

function makePlayer(): Creature {
    return makeCreature(MonsterType.MK_YOU);
}

/**
 * Build a minimal AwarenessContext.
 *
 * The scent map is all zeros (no scent anywhere), so `perceived` from the
 * scent path would be `scentTurnNumber` (1000 = very far). The geometric
 * shortcut (via `openPathBetween`) is enabled by default so that
 * `awarenessDistance` falls back to `scentDistance` between monster and
 * player — which is what we want to exercise distance thresholds cleanly.
 *
 * @param stealthRange - Player stealth range (14 = normal, 1 = invisible)
 * @param randPercentResult - Deterministic result returned by randPercent
 */
function makeAwarenessContext(
    player: Creature,
    stealthRange: number,
    randPercentResult: boolean = false,
): AwarenessContext {
    // Scent map: all zeros so scent-based perceived = scentTurnNumber (1000)
    const scentMap: number[][] = Array.from({ length: 10 }, () =>
        new Array(10).fill(0),
    );
    const scentTurnNumber = 1000;

    return {
        player,
        scentMap,
        scentTurnNumber,
        stealthRange,
        // Enable the geometric shortcut: for player targets, the shortcut
        // fires when the monster is in the player's FOV (inFieldOfView).
        openPathBetween: () => true,
        inFieldOfView: () => true,
        randPercent: () => randPercentResult,
    };
}

// =============================================================================
// awareOfTarget — invisibility mechanics (B103)
// =============================================================================

describe("awareOfTarget — invisibility (B103 WAI)", () => {
    it("tracking monster far beyond awareness*3 immediately disengages when player is invisible", () => {
        // stealthRange=1 → awareness=2, awareness*3=6
        // Monster at (5,5), player at (0,0):
        //   scentDistance(5,5, 0,0) = 2*5+5 = 15 → perceived=min(1000,15)=15 > 6 → false
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };
        monst.creatureState = CreatureState.TrackingScent;
        const ctx = makeAwarenessContext(player, 1);
        expect(awareOfTarget(monst, player, ctx)).toBe(false);
    });

    it("tracking monster just beyond awareness but within awareness*3 uses randPercent(97) when player is invisible", () => {
        // stealthRange=1 → awareness=2, awareness*3=6
        // Monster at (2,0), player at (0,0):
        //   scentDistance(2,0, 0,0) = 2*2+0 = 4; perceived=min(1000,4)=4
        //   4 > awareness=2, 4 < awareness*3=6 → randPercent(97) path
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 2, y: 0 };
        monst.creatureState = CreatureState.TrackingScent;
        // Result mirrors the randPercent return value
        expect(awareOfTarget(monst, player, makeAwarenessContext(player, 1, false))).toBe(false);
        expect(awareOfTarget(monst, player, makeAwarenessContext(player, 1, true))).toBe(true);
    });

    it("tracking monster within awareness stays aware when player is invisible", () => {
        // stealthRange=1 → awareness=2
        // Monster at (1,0), player at (0,0):
        //   scentDistance(1,0, 0,0) = 2*1+0 = 2 = awareness → perceived=2 ≤ 2 → true
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 1, y: 0 };
        monst.creatureState = CreatureState.TrackingScent;
        const ctx = makeAwarenessContext(player, 1);
        expect(awareOfTarget(monst, player, ctx)).toBe(true);
    });

    it("tracking monster at awareness+1 uses randPercent(97) when invisible", () => {
        // stealthRange=1 → awareness=2
        // Monster at (1,1), player at (0,0):
        //   scentDistance(1,1, 0,0) = 1 + 2*1 = 3 → perceived=3 > awareness=2, < awareness*3=6
        //   → randPercent(97) path
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 1, y: 1 };
        monst.creatureState = CreatureState.TrackingScent;
        expect(awareOfTarget(monst, player, makeAwarenessContext(player, 1, true))).toBe(true);
        expect(awareOfTarget(monst, player, makeAwarenessContext(player, 1, false))).toBe(false);
    });

    it("normal (visible) tracking monster stays aware at typical ranges", () => {
        // stealthRange=14 → awareness=28
        // Monster at (5,0), player at (0,0):
        //   scentDistance(5,0, 0,0) = 2*5+0 = 10 ≤ 28 → perceived ≤ awareness → true
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 0 };
        monst.creatureState = CreatureState.TrackingScent;
        const ctx = makeAwarenessContext(player, 14);
        expect(awareOfTarget(monst, player, ctx)).toBe(true);
    });

    it("ALWAYS_HUNTING monster stays aware regardless of invisibility", () => {
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info = { ...monst.info };
        monst.info.flags = monst.info.flags | MonsterBehaviorFlag.MONST_ALWAYS_HUNTING;
        monst.loc = { x: 9, y: 9 };
        monst.creatureState = CreatureState.TrackingScent;
        // stealthRange=1 (invisible), very far — ALWAYS_HUNTING overrides everything
        const ctx = makeAwarenessContext(player, 1);
        expect(awareOfTarget(monst, player, ctx)).toBe(true);
    });
});
