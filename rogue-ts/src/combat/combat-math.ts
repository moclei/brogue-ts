/*
 *  combat-math.ts — Combat math: hit probability, damage/defense adjustments
 *  brogue-ts
 *
 *  Ported from: src/brogue/Combat.c
 *  Functions: monsterDamageAdjustmentAmount, monsterDefenseAdjusted,
 *             monsterAccuracyAdjusted, hitProbability, attackHit,
 *             diagonalBlocked (from Movement.c, used in attack resolution)
 *
 *  These are the *pure calculation* functions for combat mechanics.
 *  They take creature data + context and return numbers/booleans.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, MonsterClass, Pos, Fixpt } from "../types/types.js";
import { StatusEffect, WeaponEnchant } from "../types/enums.js";
import { ItemFlag, MonsterBookkeepingFlag, TerrainFlag } from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { damageFraction, accuracyFraction, defenseFraction } from "../power/power-tables.js";
import { netEnchant } from "../items/item-usage.js";
import { monsterIsInClass } from "../monsters/monster-queries.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal context for combat math calculations.
 * Provides player identity, weapon, and RNG access.
 */
export interface CombatMathContext {
    /** The player creature (used for player identity checks). */
    player: Creature;
    /** Player's currently equipped weapon (null if unarmed). */
    weapon: Item | null;
    /** Player's currently equipped armor (null if unarmored). */
    armor: Item | null;
    /** Player strength stat. */
    playerStrength: number;
    /** Monster class catalog for vorpal/slaying lookups. */
    monsterClassCatalog: readonly MonsterClass[];
    /** Random percent check (returns true with given probability). */
    randPercent(pct: number): boolean;
    /** Check if cell has terrain flags at a position (for diagonalBlocked). */
    getTerrainFlags?(loc: Pos): number;
}

// =============================================================================
// monsterDamageAdjustmentAmount — from Combat.c:78
// =============================================================================

/**
 * Calculate the damage adjustment for a monster.
 * For the player, returns FP_FACTOR (1.0x) — player damage is handled
 * through strength routines in recalculateEquipmentBonuses.
 * For monsters, uses damageFraction based on weakness.
 *
 * C: fixpt monsterDamageAdjustmentAmount(const creature *monst)
 *
 * @param monst The attacking creature.
 * @param player The player creature (for identity check).
 * @returns The damage adjustment as a fixed-point value.
 */
export function monsterDamageAdjustmentAmount(monst: Creature, player: Creature): Fixpt {
    if (monst === player) {
        // Player damage is handled through strength routines elsewhere
        return FP_FACTOR;
    } else {
        return damageFraction(BigInt(monst.weaknessAmount) * FP_FACTOR * -3n / 2n);
    }
}

// =============================================================================
// monsterDefenseAdjusted — from Combat.c:87
// =============================================================================

/**
 * Calculate the effective defense of a creature, adjusted for weakness.
 * For the player, weakness is already factored into recalculateEquipmentBonuses.
 * For monsters, each point of weakness subtracts 25 defense.
 *
 * C: short monsterDefenseAdjusted(const creature *monst)
 *
 * @param monst The defending creature.
 * @param player The player creature (for identity check).
 * @returns The adjusted defense value (minimum 0).
 */
export function monsterDefenseAdjusted(monst: Creature, player: Creature): number {
    let retval: number;
    if (monst === player) {
        // Weakness is already taken into account in recalculateEquipmentBonuses() for the player.
        retval = monst.info.defense;
    } else {
        retval = monst.info.defense - 25 * monst.weaknessAmount;
    }
    return Math.max(retval, 0);
}

// =============================================================================
// monsterAccuracyAdjusted — from Combat.c:98
// =============================================================================

/**
 * Calculate the effective accuracy of a creature, adjusted for weakness.
 * Uses accuracyFraction to apply the weakness penalty.
 *
 * C: short monsterAccuracyAdjusted(const creature *monst)
 *
 * @param monst The attacking creature.
 * @returns The adjusted accuracy value (minimum 0).
 */
export function monsterAccuracyAdjusted(monst: Creature): number {
    const weaknessEnchant = BigInt(monst.weaknessAmount) * FP_FACTOR * -3n / 2n;
    const retval = Number(BigInt(monst.info.accuracy) * accuracyFraction(weaknessEnchant) / FP_FACTOR);
    return Math.max(retval, 0);
}

// =============================================================================
// hitProbability — from Combat.c:105
// =============================================================================

/**
 * Calculate the probability of an attack hitting.
 * Does NOT account for auto-hit from sleeping or unaware defenders.
 * Does account for auto-hit from stuck/captive defenders and weapons of slaying.
 *
 * Hit probability = accuracy × 0.987^defense (via defenseFraction).
 *
 * C: short hitProbability(creature *attacker, creature *defender)
 *
 * @param attacker The attacking creature.
 * @param defender The defending creature.
 * @param ctx Combat math context (for player weapon, strength, etc.).
 * @returns The hit probability (0-100).
 */
export function hitProbability(
    attacker: Creature,
    defender: Creature,
    ctx: CombatMathContext,
): number {
    let accuracy = monsterAccuracyAdjusted(attacker);
    const defense = monsterDefenseAdjusted(defender, ctx.player);

    // Stuck or captive defenders are always hit
    if (defender.status[StatusEffect.Stuck] || (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)) {
        return 100;
    }

    // Seized defenders are always hit by the seizing attacker
    if (
        (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED) &&
        (attacker.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING)
    ) {
        return 100;
    }

    // Player weapon bonuses
    if (attacker === ctx.player && ctx.weapon) {
        // Weapon of slaying — auto-hit against vorpal enemies
        if (
            (ctx.weapon.flags & ItemFlag.ITEM_RUNIC) &&
            ctx.weapon.enchant2 === WeaponEnchant.Slaying
        ) {
            const monsterClass = ctx.monsterClassCatalog[ctx.weapon.vorpalEnemy];
            if (monsterClass && monsterIsInClass(defender, monsterClass)) {
                return 100;
            }
        }

        // Player accuracy uses net enchant of weapon
        const weaponEnchant = netEnchant(ctx.weapon, ctx.playerStrength, ctx.player.weaknessAmount);
        accuracy = Number(BigInt(ctx.player.info.accuracy) * accuracyFraction(weaponEnchant) / FP_FACTOR);
    }

    // Final hit probability: accuracy × defenseFraction(defense)
    let prob = Number(BigInt(accuracy) * defenseFraction(BigInt(defense) * FP_FACTOR) / FP_FACTOR);

    // Clamp to [0, 100]
    if (prob > 100) prob = 100;
    if (prob < 0) prob = 0;
    return prob;
}

// =============================================================================
// attackHit — from Combat.c:136
// =============================================================================

/**
 * Determine if an attack hits, considering auto-hit conditions.
 * Sleeping, paralyzed, stuck, and captive defenders are automatically hit.
 * Otherwise, uses hitProbability for a random determination.
 *
 * C: boolean attackHit(creature *attacker, creature *defender)
 *
 * @param attacker The attacking creature.
 * @param defender The defending creature.
 * @param ctx Combat math context.
 * @returns True if the attack hits.
 */
export function attackHit(
    attacker: Creature,
    defender: Creature,
    ctx: CombatMathContext,
): boolean {
    // Auto-hit if stuck, paralyzed, or captive
    if (
        defender.status[StatusEffect.Stuck] ||
        defender.status[StatusEffect.Paralyzed] ||
        (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
    ) {
        return true;
    }

    return ctx.randPercent(hitProbability(attacker, defender, ctx));
}

// =============================================================================
// diagonalBlocked — from Movement.c:825
// =============================================================================

/**
 * Check if diagonal movement between two adjacent cells is blocked.
 * A diagonal is blocked if either of the two cells sharing the axis
 * has terrain that obstructs diagonal movement (e.g. a wall corner).
 *
 * C: boolean diagonalBlocked(const short x1, const short y1,
 *                             const short x2, const short y2,
 *                             const boolean limitToPlayerKnowledge)
 *
 * Note: The `limitToPlayerKnowledge` parameter is not ported here —
 * that's a display concern. This function uses actual terrain flags.
 *
 * @param x1 Origin X.
 * @param y1 Origin Y.
 * @param x2 Destination X.
 * @param y2 Destination Y.
 * @param getTerrainFlags Function to get terrain flags at a position.
 * @returns True if the diagonal is blocked.
 */
export function diagonalBlocked(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    getTerrainFlags: (loc: Pos) => number,
): boolean {
    if (x1 === x2 || y1 === y2) {
        return false; // Not a diagonal — not diagonally blocked
    }
    // Check the two cells that share one axis with each endpoint
    if (getTerrainFlags({ x: x1, y: y2 }) & TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT) {
        return true;
    }
    if (getTerrainFlags({ x: x2, y: y1 }) & TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT) {
        return true;
    }
    return false;
}
