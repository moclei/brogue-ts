/*
 *  monster-awareness.ts — Monster awareness and waypoint helpers
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: awarenessDistance, awareOfTarget, closestWaypointIndex,
 *             closestWaypointIndexTo
 *
 *  Phase 6: wired into buildMonsterStateContext (monsters.ts) and
 *  buildMonstersTurnContext (turn-monster-ai.ts).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos } from "../types/types.js";
import { CreatureState } from "../types/enums.js";
import { MonsterBehaviorFlag } from "../types/flags.js";
import { scentDistance } from "../time/turn-processing.js";

// =============================================================================
// AwarenessContext
// =============================================================================

/**
 * Context for awareOfTarget / awarenessDistance — the minimal game-state
 * slice needed to compute whether a monster is aware of its target.
 */
export interface AwarenessContext {
    /** The player creature (used to distinguish player vs monster targets). */
    player: Creature;
    /** The scent diffusion map from the turn layer. */
    scentMap: number[][];
    /** Monotonically increasing scent counter from rogue.scentTurnNumber. */
    scentTurnNumber: number;
    /** rogue.stealthRange — player's current stealth range. */
    stealthRange: number;
    /** True if there is an unobstructed line-of-fire between two positions. */
    openPathBetween(loc1: Pos, loc2: Pos): boolean;
    /** True if the dungeon cell at loc is in the player's field of view. */
    inFieldOfView(loc: Pos): boolean;
    /** Returns true with probability pct/100. */
    randPercent(pct: number): boolean;
}

// =============================================================================
// awarenessDistance — Monsters.c:1621
// =============================================================================

/**
 * Returns the "perceived distance" between observer and target.
 * Takes the smaller of scent-based distance and direct geometric distance
 * (when a clear line of sight exists).
 *
 * C: static short awarenessDistance(creature *observer, creature *target)
 */
function awarenessDistance(
    observer: Creature,
    target: Creature,
    ctx: AwarenessContext,
): number {
    let perceived = ctx.scentTurnNumber
        - (ctx.scentMap[observer.loc.x]?.[observer.loc.y] ?? 0);

    const isPlayer = target === ctx.player;
    const obsInFOV = ctx.inFieldOfView(observer.loc);

    if ((isPlayer && obsInFOV) ||
        (!isPlayer && ctx.openPathBetween(observer.loc, target.loc))) {
        const direct = scentDistance(
            observer.loc.x, observer.loc.y,
            target.loc.x, target.loc.y,
        );
        perceived = Math.min(perceived, direct);
    }

    if (perceived < 0) perceived = 1000;
    return Math.min(perceived, 1000);
}

// =============================================================================
// awareOfTarget — Monsters.c:1649
// =============================================================================

/**
 * Returns true if observer is (or becomes) aware of target this turn.
 * Accounts for always-hunting, immobile, tracking-scent, and FOV states.
 *
 * C: static boolean awareOfTarget(creature *observer, creature *target)
 */
export function awareOfTarget(
    observer: Creature,
    target: Creature,
    ctx: AwarenessContext,
): boolean {
    const perceived = awarenessDistance(observer, target, ctx);
    const awareness = ctx.stealthRange * 2;

    if (observer.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_HUNTING) {
        return true;
    }
    if (observer.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE) {
        return perceived <= awareness;
    }
    if (perceived > awareness * 3) {
        return false;
    }
    if (observer.creatureState === CreatureState.TrackingScent) {
        return perceived > awareness ? ctx.randPercent(97) : true;
    }
    if (target === ctx.player && !ctx.inFieldOfView(observer.loc)) {
        return false;
    }
    if (perceived <= awareness) {
        return ctx.randPercent(25);
    }
    return false;
}

// =============================================================================
// closestWaypointIndex — Monsters.c:1205
// =============================================================================

/**
 * Returns the index of the closest unvisited waypoint to the monster.
 * Returns -1 if no suitable waypoint is found.
 *
 * Simplified from C: skips the nextStep reachability check since nextStep
 * is not yet wired (Phase 6 note). The distance check (>= 0 and < DCOLS/2)
 * still ensures only reachable waypoints are selected.
 *
 * C: static short closestWaypointIndex(creature *monst)
 */
export function closestWaypointIndex(
    monst: Creature,
    wpCount: number,
    wpDistance: (number[][] | null)[],
    DCOLS: number,
): number {
    let closestDist = Math.floor(DCOLS / 2);
    let closestIndex = -1;
    for (let i = 0; i < wpCount; i++) {
        if (monst.waypointAlreadyVisited[i]) continue;
        const dist = wpDistance[i]?.[monst.loc.x]?.[monst.loc.y] ?? -1;
        if (dist >= 0 && dist < closestDist) {
            closestDist = dist;
            closestIndex = i;
        }
    }
    return closestIndex;
}

// =============================================================================
// closestWaypointIndexTo — Monsters.c:1685
// =============================================================================

/**
 * Returns the index of the waypoint with the smallest distance value at pos.
 * Returns -1 if no waypoint maps are available.
 *
 * C: static short closestWaypointIndexTo(pos p)
 */
export function closestWaypointIndexTo(
    pos: Pos,
    wpCount: number,
    wpDistance: (number[][] | null)[],
): number {
    let closestDist = 1000;
    let closestIndex = -1;
    for (let i = 0; i < wpCount; i++) {
        const dist = wpDistance[i]?.[pos.x]?.[pos.y] ?? -1;
        if (dist >= 0 && dist < closestDist) {
            closestDist = dist;
            closestIndex = i;
        }
    }
    return closestIndex;
}
