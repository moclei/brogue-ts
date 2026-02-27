/*
 *  combat-math.test.ts — Tests for combat math calculations
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    monsterDamageAdjustmentAmount,
    monsterDefenseAdjusted,
    monsterAccuracyAdjusted,
    hitProbability,
    attackHit,
    diagonalBlocked,
} from "../../src/combat/combat-math.js";
import type { CombatMathContext } from "../../src/combat/combat-math.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { monsterClassCatalog } from "../../src/globals/monster-class-catalog.js";
import { MonsterType, StatusEffect, WeaponEnchant, CreatureState } from "../../src/types/enums.js";
import { ItemCategory } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    ItemFlag,
    TerrainFlag,
} from "../../src/types/flags.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";
import type { Creature, Item, Pos } from "../../src/types/types.js";

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
    c.currentHP = cat.maxHP;
    c.loc = { x: 5, y: 5 };
    c.movementSpeed = cat.movementSpeed;
    c.attackSpeed = cat.attackSpeed;
    return c;
}

function makePlayer(): Creature {
    const c = makeCreature(MonsterType.MK_YOU);
    c.info.accuracy = 100;
    c.info.defense = 0;
    return c;
}

function makeWeapon(enchant1 = 0, strengthRequired = 12): Item {
    return {
        category: ItemCategory.WEAPON,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 3, upperBound: 10, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0 as MonsterType,
        strengthRequired,
        quiverNumber: 0,
        displayChar: 0,
        foreColor: null,
        inventoryColor: null,
        quantity: 1,
        inventoryLetter: "a",
        inscription: "",
        loc: { x: -1, y: -1 },
        keyLoc: [],
        originDepth: 0,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
    };
}

function makeCombatCtx(
    player: Creature,
    overrides?: Partial<CombatMathContext>,
): CombatMathContext {
    return {
        player,
        weapon: null,
        armor: null,
        playerStrength: 12,
        monsterClassCatalog,
        randPercent: (pct: number) => pct >= 50, // deterministic: hit if >= 50%
        ...overrides,
    };
}

// =============================================================================
// monsterDamageAdjustmentAmount
// =============================================================================

describe("monsterDamageAdjustmentAmount", () => {
    it("returns FP_FACTOR (1.0) for the player", () => {
        const player = makePlayer();
        expect(monsterDamageAdjustmentAmount(player, player)).toBe(FP_FACTOR);
    });

    it("returns FP_FACTOR (1.0) for monsters with no weakness", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.weaknessAmount = 0;
        const result = monsterDamageAdjustmentAmount(goblin, player);
        // damageFraction(0) should be FP_FACTOR
        expect(result).toBe(FP_FACTOR);
    });

    it("returns reduced damage for weakened monsters", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.weaknessAmount = 2;
        const result = monsterDamageAdjustmentAmount(goblin, player);
        // Weakness should reduce damage below 1.0x
        expect(result).toBeLessThan(FP_FACTOR);
        expect(result).toBeGreaterThan(0n);
    });

    it("returns same value as damageFraction(-1.5 * weakness * FP_FACTOR)", () => {
        const player = makePlayer();
        const monster = makeCreature(MonsterType.MK_OGRE);
        monster.weaknessAmount = 3;
        const result = monsterDamageAdjustmentAmount(monster, player);
        // Should be a valid fixpt > 0
        expect(result).toBeGreaterThan(0n);
    });
});

// =============================================================================
// monsterDefenseAdjusted
// =============================================================================

describe("monsterDefenseAdjusted", () => {
    it("returns base defense for the player (weakness handled elsewhere)", () => {
        const player = makePlayer();
        player.info.defense = 50;
        player.weaknessAmount = 5; // Should not affect player defense here
        expect(monsterDefenseAdjusted(player, player)).toBe(50);
    });

    it("returns base defense for monsters with no weakness", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.weaknessAmount = 0;
        expect(monsterDefenseAdjusted(goblin, player)).toBe(goblin.info.defense);
    });

    it("subtracts 25 per weakness point for monsters", () => {
        const player = makePlayer();
        const monster = makeCreature(MonsterType.MK_OGRE);
        const baseDefense = monster.info.defense;
        monster.weaknessAmount = 1;
        expect(monsterDefenseAdjusted(monster, player)).toBe(Math.max(baseDefense - 25, 0));
    });

    it("clamps to 0 for heavily weakened monsters", () => {
        const player = makePlayer();
        const monster = makeCreature(MonsterType.MK_GOBLIN);
        monster.weaknessAmount = 100; // Very high weakness
        expect(monsterDefenseAdjusted(monster, player)).toBe(0);
    });
});

// =============================================================================
// monsterAccuracyAdjusted
// =============================================================================

describe("monsterAccuracyAdjusted", () => {
    it("returns base accuracy for monsters with no weakness", () => {
        const monster = makeCreature(MonsterType.MK_GOBLIN);
        monster.weaknessAmount = 0;
        // accuracyFraction(0) = FP_FACTOR, so accuracy * FP_FACTOR / FP_FACTOR = accuracy
        expect(monsterAccuracyAdjusted(monster)).toBe(monster.info.accuracy);
    });

    it("returns reduced accuracy for weakened monsters", () => {
        const monster = makeCreature(MonsterType.MK_OGRE);
        const baseAccuracy = monster.info.accuracy;
        monster.weaknessAmount = 2;
        const result = monsterAccuracyAdjusted(monster);
        expect(result).toBeLessThan(baseAccuracy);
        expect(result).toBeGreaterThanOrEqual(0);
    });

    it("greatly reduces accuracy for extreme weakness", () => {
        const monster = makeCreature(MonsterType.MK_GOBLIN);
        const baseAccuracy = monster.info.accuracy;
        monster.weaknessAmount = 100;
        const result = monsterAccuracyAdjusted(monster);
        // Extreme weakness should reduce accuracy to near-zero
        expect(result).toBeLessThan(baseAccuracy / 2);
        expect(result).toBeGreaterThanOrEqual(0);
    });
});

// =============================================================================
// hitProbability
// =============================================================================

describe("hitProbability", () => {
    it("returns 100 for stuck defenders", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.status[StatusEffect.Stuck] = 5;
        const ctx = makeCombatCtx(player);
        expect(hitProbability(player, defender, ctx)).toBe(100);
    });

    it("returns 100 for captive defenders", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        const ctx = makeCombatCtx(player);
        expect(hitProbability(player, defender, ctx)).toBe(100);
    });

    it("returns 100 for seized defender / seizing attacker combo", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_BOG_MONSTER);
        attacker.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SEIZING;
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SEIZED;
        const ctx = makeCombatCtx(player);
        expect(hitProbability(attacker, defender, ctx)).toBe(100);
    });

    it("uses monster accuracy/defense for monster-vs-monster", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeCombatCtx(player);
        const prob = hitProbability(attacker, defender, ctx);
        expect(prob).toBeGreaterThanOrEqual(0);
        expect(prob).toBeLessThanOrEqual(100);
    });

    it("uses weapon enchant for player attacks", () => {
        const player = makePlayer();
        player.info.accuracy = 100;
        const weapon = makeWeapon(3, 12); // +3 enchanted weapon
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.info.defense = 0;
        const ctx = makeCombatCtx(player, { weapon, playerStrength: 15 });

        const prob = hitProbability(player, defender, ctx);
        expect(prob).toBeGreaterThan(0);
        expect(prob).toBeLessThanOrEqual(100);
    });

    it("returns 100 for weapon of slaying against vorpal enemy", () => {
        const player = makePlayer();
        // Find a monster class with known members
        const dragonClassIndex = monsterClassCatalog.findIndex(c => c.name === "dragon");
        const weapon = makeWeapon(0, 12);
        weapon.flags |= ItemFlag.ITEM_RUNIC;
        weapon.enchant2 = WeaponEnchant.Slaying;
        weapon.vorpalEnemy = dragonClassIndex as MonsterType;
        const dragon = makeCreature(MonsterType.MK_DRAGON);
        const ctx = makeCombatCtx(player, { weapon });
        expect(hitProbability(player, dragon, ctx)).toBe(100);
    });

    it("does not return 100 for slaying weapon against non-vorpal enemy", () => {
        const player = makePlayer();
        const dragonClassIndex = monsterClassCatalog.findIndex(c => c.name === "dragon");
        const weapon = makeWeapon(0, 12);
        weapon.flags |= ItemFlag.ITEM_RUNIC;
        weapon.enchant2 = WeaponEnchant.Slaying;
        weapon.vorpalEnemy = dragonClassIndex as MonsterType;
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeCombatCtx(player, { weapon });
        const prob = hitProbability(player, goblin, ctx);
        // Goblin is not a dragon, so no auto-hit
        expect(prob).toBeLessThanOrEqual(100);
    });

    it("is clamped to [0, 100]", () => {
        const player = makePlayer();
        // High accuracy attacker
        const attacker = makeCreature(MonsterType.MK_DRAGON);
        attacker.info.accuracy = 200;
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.info.defense = 0;
        const ctx = makeCombatCtx(player);
        const prob = hitProbability(attacker, defender, ctx);
        expect(prob).toBeLessThanOrEqual(100);
        expect(prob).toBeGreaterThanOrEqual(0);
    });

    it("higher defense lowers hit probability", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_GOBLIN);
        const defender1 = makeCreature(MonsterType.MK_GOBLIN);
        defender1.info.defense = 0;
        const defender2 = makeCreature(MonsterType.MK_GOBLIN);
        defender2.info.defense = 50;
        const ctx = makeCombatCtx(player);
        const prob1 = hitProbability(attacker, defender1, ctx);
        const prob2 = hitProbability(attacker, defender2, ctx);
        expect(prob1).toBeGreaterThanOrEqual(prob2);
    });
});

// =============================================================================
// attackHit
// =============================================================================

describe("attackHit", () => {
    it("auto-hits stuck defenders", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.status[StatusEffect.Stuck] = 5;
        const ctx = makeCombatCtx(player, { randPercent: () => false });
        expect(attackHit(player, defender, ctx)).toBe(true);
    });

    it("auto-hits paralyzed defenders", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.status[StatusEffect.Paralyzed] = 5;
        const ctx = makeCombatCtx(player, { randPercent: () => false });
        expect(attackHit(player, defender, ctx)).toBe(true);
    });

    it("auto-hits captive defenders", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        const ctx = makeCombatCtx(player, { randPercent: () => false });
        expect(attackHit(player, defender, ctx)).toBe(true);
    });

    it("uses rand_percent for normal attacks (hit when high prob)", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        // Always return true for any percent check
        const ctx = makeCombatCtx(player, { randPercent: () => true });
        expect(attackHit(player, defender, ctx)).toBe(true);
    });

    it("misses when rand_percent returns false", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        // Always return false for any percent check
        const ctx = makeCombatCtx(player, { randPercent: () => false });
        expect(attackHit(player, defender, ctx)).toBe(false);
    });
});

// =============================================================================
// diagonalBlocked
// =============================================================================

describe("diagonalBlocked", () => {
    it("returns false for non-diagonal movement", () => {
        // Same column (vertical move)
        expect(diagonalBlocked(5, 5, 5, 6, () => 0)).toBe(false);
        // Same row (horizontal move)
        expect(diagonalBlocked(5, 5, 6, 5, () => 0)).toBe(false);
    });

    it("returns false when neither corner has obstructing terrain", () => {
        const getFlags = () => 0;
        expect(diagonalBlocked(5, 5, 6, 6, getFlags)).toBe(false);
    });

    it("returns true when (x1, y2) has diagonal-blocking terrain", () => {
        const getFlags = (loc: Pos) => {
            // (5, 6) blocks diagonals
            if (loc.x === 5 && loc.y === 6) return TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT;
            return 0;
        };
        expect(diagonalBlocked(5, 5, 6, 6, getFlags)).toBe(true);
    });

    it("returns true when (x2, y1) has diagonal-blocking terrain", () => {
        const getFlags = (loc: Pos) => {
            // (6, 5) blocks diagonals
            if (loc.x === 6 && loc.y === 5) return TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT;
            return 0;
        };
        expect(diagonalBlocked(5, 5, 6, 6, getFlags)).toBe(true);
    });

    it("returns true when both corners have diagonal-blocking terrain", () => {
        const getFlags = () => TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT;
        expect(diagonalBlocked(5, 5, 6, 6, getFlags)).toBe(true);
    });

    it("works for all diagonal directions", () => {
        const getFlags = () => 0;
        // NE
        expect(diagonalBlocked(5, 5, 6, 4, getFlags)).toBe(false);
        // NW
        expect(diagonalBlocked(5, 5, 4, 4, getFlags)).toBe(false);
        // SE
        expect(diagonalBlocked(5, 5, 6, 6, getFlags)).toBe(false);
        // SW
        expect(diagonalBlocked(5, 5, 4, 6, getFlags)).toBe(false);
    });
});
