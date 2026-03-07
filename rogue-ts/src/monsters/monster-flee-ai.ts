/*
 *  monster-flee-ai.ts — Monster flee AI helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: fleeingMonsterAwareOfPlayer (2363), getSafetyMap (2371),
 *             allyFlees (2988)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos } from "../types/types.js";
import { StatusEffect } from "../types/enums.js";
import { MonsterBehaviorFlag } from "../types/flags.js";
import { distanceBetween } from "./monster-state.js";

// =============================================================================
// fleeingMonsterAwareOfPlayer — Monsters.c:2363
// =============================================================================

export interface FleeingMonsterAwarenessContext {
    player: Creature;
    /** Returns true if the cell at loc has the IN_FIELD_OF_VIEW tile flag set. */
    inFieldOfView(loc: Pos): boolean;
}

/**
 * Returns true if the fleeing monster can sense the player.
 * If the player is invisible, awareness requires adjacency (distance <= 1).
 * Otherwise, awareness requires the monster's cell to be in the player's FOV.
 *
 * Ported from fleeingMonsterAwareOfPlayer() in Monsters.c.
 */
export function fleeingMonsterAwareOfPlayer(
    monst: Creature,
    ctx: FleeingMonsterAwarenessContext,
): boolean {
    if (ctx.player.status[StatusEffect.Invisible]) {
        return distanceBetween(monst.loc, ctx.player.loc) <= 1;
    } else {
        return ctx.inFieldOfView(monst.loc);
    }
}

// =============================================================================
// getSafetyMap — Monsters.c:2371
// =============================================================================

export interface GetSafetyMapContext extends FleeingMonsterAwarenessContext {
    safetyMap: number[][];
    rogue: {
        updatedSafetyMapThisTurn: boolean;
    };
    allocGrid(): number[][];
    copyGrid(dest: number[][], src: number[][]): void;
    updateSafetyMap(): void;
}

/**
 * Returns the appropriate safety map for a fleeing monster.
 *
 * If the monster is aware of the player, the global safetyMap is used and any
 * cached per-monster map is discarded. Otherwise, a per-monster copy of the
 * global safetyMap is created and reused until the monster next senses the player.
 *
 * Ported from getSafetyMap() in Monsters.c.
 */
export function getSafetyMap(
    monst: Creature,
    ctx: GetSafetyMapContext,
): number[][] {
    if (fleeingMonsterAwareOfPlayer(monst, ctx)) {
        // Discard stale per-monster map
        if (monst.safetyMap) {
            monst.safetyMap = null;
        }
        if (!ctx.rogue.updatedSafetyMapThisTurn) {
            ctx.updateSafetyMap();
        }
        return ctx.safetyMap;
    } else {
        if (!monst.safetyMap) {
            if (!ctx.rogue.updatedSafetyMapThisTurn) {
                ctx.updateSafetyMap();
            }
            monst.safetyMap = ctx.allocGrid();
            ctx.copyGrid(monst.safetyMap, ctx.safetyMap);
        }
        return monst.safetyMap;
    }
}

// =============================================================================
// allyFlees — Monsters.c:2988
// =============================================================================

export interface AllyFleesContext {
    player: Creature;
    monsterFleesFrom(monst: Creature, defender: Creature): boolean;
}

/**
 * Returns true if an allied monster should flee from its closest enemy.
 *
 * Spectral blades and timed allies (maxHP <= 1 or STATUS_LIFESPAN_REMAINING)
 * never flee. Otherwise, an ally flees when:
 *   - It is within 10 spaces, HP <= 33%, can regenerate, is not carrying a
 *     monster, and either has MONST_FLEES_NEAR_DEATH or its HP fraction is
 *     less than half the player's.
 *   - OR monsterFleesFrom() returns true (damage-immune, kamikaze, etc.).
 *
 * Ported from allyFlees() in Monsters.c.
 */
export function allyFlees(
    ally: Creature,
    closestEnemy: Creature | null,
    ctx: AllyFleesContext,
): boolean {
    if (!closestEnemy) {
        return false;
    }

    // Spectral blades and timed allies should never flee
    if (ally.info.maxHP <= 1 || ally.status[StatusEffect.LifespanRemaining] > 0) {
        return false;
    }

    if (
        distanceBetween(ally.loc, closestEnemy.loc) < 10 &&
        (100 * ally.currentHP / ally.info.maxHP <= 33) &&
        ally.info.turnsBetweenRegen > 0 &&
        !ally.carriedMonster &&
        (
            (ally.info.flags & MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH) ||
            (100 * ally.currentHP / ally.info.maxHP * 2 <
             100 * ctx.player.currentHP / ctx.player.info.maxHP)
        )
    ) {
        return true;
    }

    if (ctx.monsterFleesFrom(ally, closestEnemy)) {
        return true;
    }

    return false;
}
