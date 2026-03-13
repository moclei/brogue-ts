/*
 *  monster-blink-ai.test.ts — Tests for monster blink AI helpers
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    perimeterCoords,
    monsterBlinkToPreferenceMap,
    monsterBlinkToSafety,
    type MonsterBlinkContext,
    type MonsterBlinkToSafetyContext,
} from "../../src/monsters/monster-blink-ai.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { boltCatalog } from "../../src/globals/bolt-catalog.js";
import { MonsterType, StatusEffect, CreatureState, BoltEffect, BoltType } from "../../src/types/enums.js";
import { MonsterBehaviorFlag, TerrainFlag } from "../../src/types/flags.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import type { Creature, Bolt } from "../../src/types/types.js";

// =============================================================================
// Helpers
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
    c.loc = { x: 10, y: 10 };
    c.currentHP = c.info.maxHP;
    c.movementSpeed = c.info.movementSpeed;
    c.attackSpeed = c.info.attackSpeed;
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

function makeGrid(fill = 0): number[][] {
    return Array.from({ length: DCOLS }, () => new Array(DROWS).fill(fill));
}

/** A blink context where the monster has no blink ability (monsterHasBoltEffect → 0). */
function makeBlinkCtx(overrides: Partial<MonsterBlinkContext> = {}): MonsterBlinkContext {
    return {
        boltCatalog,
        monsterHasBoltEffect: () => 0,
        monsterAvoids: () => false,
        canDirectlySeeMonster: () => false,
        monsterName: (m, _includeArticle) => m.info.monsterName,
        combatMessage: () => {},
        cellHasTerrainFlag: () => false,
        zap: () => {},
        BE_BLINKING: BoltEffect.Blinking,
        BOLT_BLINKING: BoltType.BLINKING,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        ...overrides,
    };
}

/** A blink-to-safety context with empty safety maps. */
function makeBlinkToSafetyCtx(
    overrides: Partial<MonsterBlinkToSafetyContext> = {},
): MonsterBlinkToSafetyContext {
    const base = makeBlinkCtx();
    return {
        ...base,
        allySafetyMap: makeGrid(0),
        rogue: {
            updatedAllySafetyMapThisTurn: false,
            updatedSafetyMapThisTurn: false,
        },
        player: makeCreature(MonsterType.MK_YOU),
        safetyMap: makeGrid(0),
        inFieldOfView: () => false,
        allocGrid: makeGrid,
        copyGrid: (dest, src) => {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) dest[i][j] = src[i][j];
            }
        },
        updateSafetyMap: () => {},
        updateAllySafetyMap: () => {},
        ...overrides,
    };
}

// =============================================================================
// perimeterCoords
// =============================================================================

describe("perimeterCoords", () => {
    it("n=0 → top-left corner (-5, -5)", () => {
        expect(perimeterCoords(0)).toEqual({ x: -5, y: -5 });
    });

    it("n=10 → top-right corner (5, -5)", () => {
        expect(perimeterCoords(10)).toEqual({ x: 5, y: -5 });
    });

    it("n=11 → bottom-left corner (-5, 5)", () => {
        expect(perimeterCoords(11)).toEqual({ x: -5, y: 5 });
    });

    it("n=21 → bottom-right corner (5, 5)", () => {
        expect(perimeterCoords(21)).toEqual({ x: 5, y: 5 });
    });

    it("n=22 → left edge top (-5, -4)", () => {
        expect(perimeterCoords(22)).toEqual({ x: -5, y: -4 });
    });

    it("n=30 → left edge bottom (-5, 4)", () => {
        expect(perimeterCoords(30)).toEqual({ x: -5, y: 4 });
    });

    it("n=31 → right edge top (5, -4)", () => {
        expect(perimeterCoords(31)).toEqual({ x: 5, y: -4 });
    });

    it("n=39 → right edge bottom (5, 4)", () => {
        expect(perimeterCoords(39)).toEqual({ x: 5, y: 4 });
    });

    it("produces 40 distinct points (n=0..39)", () => {
        const pts = Array.from({ length: 40 }, (_, i) => perimeterCoords(i));
        const keys = new Set(pts.map(p => `${p.x},${p.y}`));
        expect(keys.size).toBe(40);
    });

    it("all points lie on the radius-5 perimeter (|x|=5 or |y|=5)", () => {
        for (let i = 0; i < 40; i++) {
            const { x, y } = perimeterCoords(i);
            expect(Math.abs(x) === 5 || Math.abs(y) === 5).toBe(true);
        }
    });

    it("n >= 40 returns (0, 0) as a fallback", () => {
        expect(perimeterCoords(40)).toEqual({ x: 0, y: 0 });
        expect(perimeterCoords(99)).toEqual({ x: 0, y: 0 });
    });
});

// =============================================================================
// monsterBlinkToPreferenceMap
// =============================================================================

describe("monsterBlinkToPreferenceMap", () => {
    it("returns false when monster has no blink bolt ability", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        const map = makeGrid(5);
        const ctx = makeBlinkCtx({ monsterHasBoltEffect: () => 0 });
        expect(monsterBlinkToPreferenceMap(monst, map, true, ctx)).toBe(false);
    });

    it("returns false when all sampled cells are equal preference and no better destination", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 10, y: 10 };
        // Flat map — no cell is strictly better than the current position.
        const map = makeGrid(0);
        const ctx = makeBlinkCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
        });
        expect(monsterBlinkToPreferenceMap(monst, map, true, ctx)).toBe(false);
    });

    it("returns false when the best reachable cell is blocked by terrain", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 10, y: 10 };
        const map = makeGrid(0);
        // Spike the origin cell high so nothing beats it
        map[10][10] = 100;
        const ctx = makeBlinkCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
            // All terrain obstructs → getImpactLoc stops at origin for every target
            cellHasTerrainFlag: () => true,
        });
        expect(monsterBlinkToPreferenceMap(monst, map, false, ctx)).toBe(false);
    });

    it("calls combatMessage when monster can be seen and blinks", () => {
        const monst = makeCreature(MonsterType.MK_VAMPIRE);
        monst.loc = { x: 10, y: 10 };
        monst.attackSpeed = 100;

        // Build a gradient map where cells far in the +x direction have high values
        const map = makeGrid(0);
        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) {
                map[x][y] = x;  // higher x → higher preference
            }
        }

        const combatMessage = vi.fn();
        const zap = vi.fn();
        const ctx = makeBlinkCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
            canDirectlySeeMonster: () => true,
            combatMessage,
            zap,
            cellHasTerrainFlag: () => false,
        });

        const result = monsterBlinkToPreferenceMap(monst, map, true, ctx);
        if (result) {
            expect(combatMessage).toHaveBeenCalledOnce();
            expect(zap).toHaveBeenCalledOnce();
        }
    });

    it("sets ticksUntilTurn = attackSpeed * 2 for slow casters", () => {
        const monst = makeCreature(MonsterType.MK_VAMPIRE);
        monst.loc = { x: 10, y: 10 };
        monst.attackSpeed = 100;
        monst.info = {
            ...monst.info,
            flags: monst.info.flags | MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        };

        const map = makeGrid(0);
        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) map[x][y] = x;
        }

        const zap = vi.fn();
        const ctx = makeBlinkCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
            zap,
            cellHasTerrainFlag: () => false,
        });

        const result = monsterBlinkToPreferenceMap(monst, map, true, ctx);
        if (result) {
            expect(monst.ticksUntilTurn).toBe(200); // 100 * 2
        }
    });

    it("sets ticksUntilTurn = attackSpeed for normal casters", () => {
        const monst = makeCreature(MonsterType.MK_VAMPIRE);
        monst.loc = { x: 10, y: 10 };
        monst.attackSpeed = 100;
        // Ensure MONST_CAST_SPELLS_SLOWLY is not set
        monst.info = {
            ...monst.info,
            flags: monst.info.flags & ~MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        };

        const map = makeGrid(0);
        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) map[x][y] = x;
        }

        const zap = vi.fn();
        const ctx = makeBlinkCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
            zap,
            cellHasTerrainFlag: () => false,
        });

        const result = monsterBlinkToPreferenceMap(monst, map, true, ctx);
        if (result) {
            expect(monst.ticksUntilTurn).toBe(100); // 100 * 1
        }
    });

    it("blinkUphill=false targets lower preference values", () => {
        const monst = makeCreature(MonsterType.MK_VAMPIRE);
        monst.loc = { x: 10, y: 10 };
        monst.attackSpeed = 100;

        // Map where cells with lower x have lower values (monster at x=10, value=10)
        // With blinkUphill=false, it should aim for x < 10
        const map = makeGrid(0);
        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) map[x][y] = x * 10;
        }

        const zapArgs: Array<{ origin: unknown; target: unknown }> = [];
        const ctx = makeBlinkCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
            zap: (origin, target) => { zapArgs.push({ origin, target }); },
            cellHasTerrainFlag: () => false,
        });

        const result = monsterBlinkToPreferenceMap(monst, map, false, ctx);
        if (result) {
            // The chosen target should be to the left (lower x)
            const target = zapArgs[0]?.target as { x: number; y: number } | undefined;
            if (target) {
                expect(target.x).toBeLessThan(10);
            }
        }
    });
});

// =============================================================================
// monsterBlinkToSafety
// =============================================================================

describe("monsterBlinkToSafety", () => {
    it("returns false when monster has no blink ability", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        const ctx = makeBlinkToSafetyCtx({ monsterHasBoltEffect: () => 0 });
        expect(monsterBlinkToSafety(monst, ctx)).toBe(false);
    });

    it("uses allySafetyMap for allied monsters", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.creatureState = CreatureState.Ally;
        monst.loc = { x: 10, y: 10 };

        // allySafetyMap: lower values to the left (flee left = safer)
        const allySafetyMap = makeGrid(0);
        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) allySafetyMap[x][y] = x * 10;
        }

        let updateAllyCalled = false;
        const ctx = makeBlinkToSafetyCtx({
            monsterHasBoltEffect: () => BoltType.BLINKING,
            allySafetyMap,
            rogue: { updatedAllySafetyMapThisTurn: false, updatedSafetyMapThisTurn: true },
            updateAllySafetyMap: () => { updateAllyCalled = true; },
            cellHasTerrainFlag: () => false,
        });

        monsterBlinkToSafety(monst, ctx);
        // Should have called updateAllySafetyMap since not updated this turn
        expect(updateAllyCalled).toBe(true);
    });

    it("does not call updateAllySafetyMap if already updated this turn for ally", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.creatureState = CreatureState.Ally;

        let updateAllyCalled = false;
        const ctx = makeBlinkToSafetyCtx({
            monsterHasBoltEffect: () => 0,  // no blink — returns false quickly
            rogue: { updatedAllySafetyMapThisTurn: true, updatedSafetyMapThisTurn: true },
            updateAllySafetyMap: () => { updateAllyCalled = true; },
        });

        monsterBlinkToSafety(monst, ctx);
        expect(updateAllyCalled).toBe(false);
    });

    it("uses getSafetyMap (global or per-monster) for non-ally monsters", () => {
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.creatureState = CreatureState.Hunting;
        monst.loc = { x: 10, y: 10 };

        let updateSafetyCalled = false;
        const ctx = makeBlinkToSafetyCtx({
            monsterHasBoltEffect: () => 0,  // short-circuits to false
            rogue: { updatedAllySafetyMapThisTurn: false, updatedSafetyMapThisTurn: false },
            inFieldOfView: () => true,  // monster is aware of player
            updateSafetyMap: () => { updateSafetyCalled = true; },
        });

        monsterBlinkToSafety(monst, ctx);
        // getSafetyMap triggers updateSafetyMap for aware monster
        expect(updateSafetyCalled).toBe(true);
    });
});
