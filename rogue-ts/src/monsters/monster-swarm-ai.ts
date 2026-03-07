/*
 *  monster-swarm-ai.ts — Monster swarming AI helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: creatureEligibleForSwarming (2134), monsterSwarmDirection (2160)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos } from "../types/types.js";
import { MonsterBehaviorFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import { CreatureState, StatusEffect } from "../types/enums.js";

// =============================================================================
// creatureEligibleForSwarming — Monsters.c:2134
// =============================================================================

/**
 * Returns true if a creature is eligible to participate in swarming movement.
 *
 * Ineligible if: immobile, entranced, confused, stuck, paralysed, magically
 * feared, at final lifespan tick, or currently seizing/seized.
 * Non-player creatures must be in ALLY or TRACKING_SCENT state.
 *
 * Ported from creatureEligibleForSwarming() in Monsters.c.
 */
export function creatureEligibleForSwarming(
    monst: Creature,
    player: Creature,
): boolean {
    if (
        (monst.info.flags &
            (MonsterBehaviorFlag.MONST_IMMOBILE |
                MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION |
                MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE)) ||
        monst.status[StatusEffect.Entranced] ||
        monst.status[StatusEffect.Confused] ||
        monst.status[StatusEffect.Stuck] ||
        monst.status[StatusEffect.Paralyzed] ||
        monst.status[StatusEffect.MagicalFear] ||
        monst.status[StatusEffect.LifespanRemaining] === 1 ||
        (monst.bookkeepingFlags &
            (MonsterBookkeepingFlag.MB_SEIZED | MonsterBookkeepingFlag.MB_SEIZING))
    ) {
        return false;
    }
    if (
        monst !== player &&
        monst.creatureState !== CreatureState.Ally &&
        monst.creatureState !== CreatureState.TrackingScent
    ) {
        return false;
    }
    return true;
}

// =============================================================================
// monsterSwarmDirection — Monsters.c:2160
// =============================================================================

/**
 * Context for monsterSwarmDirection.
 */
export interface MonsterSwarmContext {
    player: Creature;
    monsters: Creature[];
    distanceBetween(loc1: Pos, loc2: Pos): number;
    /** True if a diagonal move between two cells is blocked by corner walls. */
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number): boolean;
    isPosInMap(loc: Pos): boolean;
    cellFlags(loc: Pos): number;
    monsterAvoids(monst: Creature, loc: Pos): boolean;
    monstersAreTeammates(a: Creature, b: Creature): boolean;
    monstersAreEnemies(a: Creature, b: Creature): boolean;
    shuffleList(list: number[]): void;
    nbDirs: readonly [number, number][];
    DIRECTION_COUNT: number;
    NO_DIRECTION: number;
    HAS_PLAYER: number;
    HAS_MONSTER: number;
    MONST_ATTACKABLE_THRU_WALLS: number;
}

/**
 * Swarming: if monst is adjacent to enemy and about to attack, and a nearby
 * teammate needs the space monst occupies to attack the same enemy, monst
 * should step aside to open a flanking position.
 *
 * Returns the direction monst should move (0–7), or NO_DIRECTION.
 *
 * Ported from monsterSwarmDirection() in Monsters.c.
 */
export function monsterSwarmDirection(
    monst: Creature,
    enemy: Creature,
    ctx: MonsterSwarmContext,
): number {
    if (
        monst === ctx.player ||
        !creatureEligibleForSwarming(monst, ctx.player)
    ) {
        return ctx.NO_DIRECTION;
    }

    if (
        ctx.distanceBetween(monst.loc, enemy.loc) !== 1 ||
        (ctx.diagonalBlocked(monst.loc.x, monst.loc.y, enemy.loc.x, enemy.loc.y) ||
            !!(enemy.info.flags & ctx.MONST_ATTACKABLE_THRU_WALLS)) ||
        !ctx.monstersAreEnemies(monst, enemy)
    ) {
        return ctx.NO_DIRECTION; // Too far, diagonally blocked, or not enemies.
    }

    // Shuffle cardinals and diagonals independently (mirrors C shuffleList(dirList,4) pattern).
    const cardinals = [0, 1, 2, 3];
    const diagonals = [4, 5, 6, 7];
    ctx.shuffleList(cardinals);
    ctx.shuffleList(diagonals);
    const dirs = [...cardinals, ...diagonals];

    // Find an open cell adjacent to both monst and enemy.
    let targetDir = ctx.NO_DIRECTION;
    for (let i = 0; i < 8 && targetDir === ctx.NO_DIRECTION; i++) {
        const dir = dirs[i];
        const newLoc: Pos = {
            x: monst.loc.x + ctx.nbDirs[dir][0],
            y: monst.loc.y + ctx.nbDirs[dir][1],
        };
        if (
            ctx.isPosInMap(newLoc) &&
            ctx.distanceBetween(enemy.loc, newLoc) === 1 &&
            !(ctx.cellFlags(newLoc) & (ctx.HAS_PLAYER | ctx.HAS_MONSTER)) &&
            !ctx.diagonalBlocked(monst.loc.x, monst.loc.y, newLoc.x, newLoc.y) &&
            (!ctx.diagonalBlocked(enemy.loc.x, enemy.loc.y, newLoc.x, newLoc.y) ||
                !!(enemy.info.flags & ctx.MONST_ATTACKABLE_THRU_WALLS)) &&
            !ctx.monsterAvoids(monst, newLoc)
        ) {
            targetDir = dir;
        }
    }

    if (targetDir === ctx.NO_DIRECTION) {
        return ctx.NO_DIRECTION;
    }

    // Check that a nearby ally would benefit from the space we open.
    // Mirrors C iteration of player + monsters ("handledPlayer" pattern).
    const allCreatures: Creature[] = [ctx.player, ...ctx.monsters];
    for (const ally of allCreatures) {
        if (
            ally === monst ||
            ally === enemy ||
            !ctx.monstersAreTeammates(monst, ally) ||
            !ctx.monstersAreEnemies(ally, enemy) ||
            !creatureEligibleForSwarming(ally, ctx.player) ||
            ctx.distanceBetween(monst.loc, ally.loc) !== 1 ||
            ctx.diagonalBlocked(monst.loc.x, monst.loc.y, ally.loc.x, ally.loc.y) ||
            ctx.monsterAvoids(ally, monst.loc) ||
            !(
                ctx.distanceBetween(enemy.loc, ally.loc) > 1 ||
                ctx.diagonalBlocked(enemy.loc.x, enemy.loc.y, ally.loc.x, ally.loc.y)
            )
        ) {
            continue;
        }

        // Found a prospective ally. Check no alternate attack space exists for it.
        let alternateDirectionExists = false;
        for (let dir = 0; dir < ctx.DIRECTION_COUNT && !alternateDirectionExists; dir++) {
            const newPos: Pos = {
                x: ally.loc.x + ctx.nbDirs[dir][0],
                y: ally.loc.y + ctx.nbDirs[dir][1],
            };
            if (
                ctx.isPosInMap(newPos) &&
                !(ctx.cellFlags(newPos) & (ctx.HAS_PLAYER | ctx.HAS_MONSTER)) &&
                ctx.distanceBetween(enemy.loc, newPos) === 1 &&
                !ctx.diagonalBlocked(enemy.loc.x, enemy.loc.y, newPos.x, newPos.y) &&
                !ctx.diagonalBlocked(ally.loc.x, ally.loc.y, newPos.x, newPos.y) &&
                !ctx.monsterAvoids(ally, newPos)
            ) {
                alternateDirectionExists = true;
            }
        }

        if (!alternateDirectionExists) {
            // Check ally isn't already engaged with a different enemy of its own.
            let foundConflict = false;
            for (const otherEnemy of allCreatures) {
                if (
                    otherEnemy !== ally &&
                    otherEnemy !== monst &&
                    otherEnemy !== enemy &&
                    ctx.monstersAreEnemies(ally, otherEnemy) &&
                    ctx.distanceBetween(ally.loc, otherEnemy.loc) === 1 &&
                    (!ctx.diagonalBlocked(
                        ally.loc.x, ally.loc.y,
                        otherEnemy.loc.x, otherEnemy.loc.y,
                    ) || !!(otherEnemy.info.flags & ctx.MONST_ATTACKABLE_THRU_WALLS))
                ) {
                    foundConflict = true;
                    break;
                }
            }
            if (!foundConflict) {
                return targetDir;
            }
        }
    }

    return ctx.NO_DIRECTION;
}
