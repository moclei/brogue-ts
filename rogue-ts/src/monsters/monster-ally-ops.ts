/*
 *  monster-ally-ops.ts — Ally state management: unAlly, leadership checks
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: unAlly (Monsters.c:2939), checkForContinuedLeadership (Monsters.c:4077),
 *             demoteMonsterFromLeadership (Monsters.c:4094)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature } from "../types/types.js";
import { CreatureState } from "../types/enums.js";
import { MonsterBookkeepingFlag } from "../types/flags.js";

// =============================================================================
// unAlly — Monsters.c:2939
// =============================================================================

/**
 * Removes ally status from a monster, setting it back to tracking scent
 * and clearing follower and telepathic-reveal bookkeeping flags.
 *
 * C: void unAlly(creature *monst)
 */
export function unAlly(monst: Creature): void {
    if (monst.creatureState === CreatureState.Ally) {
        monst.creatureState = CreatureState.TrackingScent;
        monst.bookkeepingFlags &= ~(
            MonsterBookkeepingFlag.MB_FOLLOWER |
            MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED
        );
        monst.leader = null;
    }
}

// =============================================================================
// checkForContinuedLeadership — Monsters.c:4077
// =============================================================================

/**
 * Clears the MB_LEADER flag from monst if it no longer has any followers.
 *
 * C: void checkForContinuedLeadership(creature *monst)
 *
 * @param monst    The monster to check.
 * @param monsters Active monsters list.
 */
export function checkForContinuedLeadership(monst: Creature, monsters: Creature[]): void {
    if (!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER)) {
        return;
    }
    let maintainLeadership = false;
    for (const follower of monsters) {
        if (follower.leader === monst && follower !== monst) {
            maintainLeadership = true;
            break;
        }
    }
    if (!maintainLeadership) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_LEADER;
    }
}

// =============================================================================
// demoteMonsterFromLeadership — Monsters.c:4094
// =============================================================================

/**
 * Removes leadership from monst and reassigns its followers to a new leader
 * (the first non-bound follower found). Bound followers are orphaned.
 *
 * Note: the C version iterates all levels; this implementation only handles
 * the current level's monster list. Multi-level iteration is deferred.
 *
 * C: void demoteMonsterFromLeadership(creature *monst)
 *
 * @param monst    The monster losing its leader role.
 * @param monsters Active monsters list (current level only).
 */
export function demoteMonsterFromLeadership(monst: Creature, monsters: Creature[]): void {
    monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_LEADER;
    monst.mapToMe = null;

    let newLeader: Creature | null = null;
    for (const follower of monsters) {
        if (follower === monst || follower.leader !== monst) continue;
        if (follower.bookkeepingFlags & MonsterBookkeepingFlag.MB_BOUND_TO_LEADER) {
            follower.leader = null;
            follower.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_FOLLOWER;
        } else if (newLeader) {
            follower.leader = newLeader;
        } else {
            newLeader = follower;
            follower.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
            follower.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_FOLLOWER;
            follower.leader = null;
        }
    }
}
