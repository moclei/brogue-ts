/*
 *  ally-management.ts — Ally and captive management
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: becomeAllyWith, freeCaptive, freeCaptivesEmbeddedAt
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos } from "../types/types.js";
import { CreatureState } from "../types/enums.js";
import {
    TerrainFlag, TileFlag,
    MonsterBehaviorFlag, MonsterBookkeepingFlag,
} from "../types/flags.js";

// =============================================================================
// Context
// =============================================================================

/**
 * Context for ally management functions.
 */
export interface AllyManagementContext {
    /** The player creature. */
    player: Creature;
    /** Permanent map cells. */
    pmap: Pcell[][];
    /** Demote the monster from any leadership role in its group. */
    demoteMonsterFromLeadership(monst: Creature): void;
    /** Force the monster to drop its carried item. */
    makeMonsterDropItem(monst: Creature): void;
    /** Refresh the display for a dungeon cell. */
    refreshDungeonCell(loc: Pos): void;
    /** Get a monster's display name. */
    monsterName(monst: Creature, includeArticle: boolean): string;
    /** Display a message to the player. */
    message(msg: string, flags: number): void;
    /** Find the creature at a given location. */
    monsterAtLoc(loc: Pos): Creature | null;
    /** Check if cell has terrain flags. */
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
}

// =============================================================================
// becomeAllyWith — from Movement.c:513
// =============================================================================

/**
 * Converts a creature into an ally of the player. Demotes it from
 * any leadership role, drops its item, recursively converts its
 * carried monster, and sets the appropriate flags.
 *
 * C: void becomeAllyWith(creature *monst)
 */
export function becomeAllyWith(
    monst: Creature,
    ctx: AllyManagementContext,
): void {
    ctx.demoteMonsterFromLeadership(monst);

    // Drop carried item
    if (monst.carriedItem) {
        ctx.makeMonsterDropItem(monst);
    }

    // Recursively ally the carried monster (e.g. phoenix eggs)
    if (monst.carriedMonster) {
        becomeAllyWith(monst.carriedMonster, ctx);
    }

    monst.creatureState = CreatureState.Ally;
    monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
    monst.leader = ctx.player;
    monst.bookkeepingFlags &= ~(MonsterBookkeepingFlag.MB_CAPTIVE | MonsterBookkeepingFlag.MB_SEIZED);
    ctx.refreshDungeonCell(monst.loc);
}

// =============================================================================
// freeCaptive — from Movement.c:530
// =============================================================================

/**
 * Frees a captive creature, making it an ally and displaying a message.
 *
 * C: void freeCaptive(creature *monst)
 */
export function freeCaptive(
    monst: Creature,
    ctx: AllyManagementContext,
): void {
    becomeAllyWith(monst, ctx);
    const monstName = ctx.monsterName(monst, false);
    ctx.message(`you free the grateful ${monstName} and gain a faithful ally.`, 0);
}

// =============================================================================
// freeCaptivesEmbeddedAt — from Movement.c:539
// =============================================================================

/**
 * Checks if there's a captive embedded in obstructing terrain at (x, y).
 * If so, frees them and returns true. This is called when terrain is
 * tunnelized or destroyed.
 *
 * C: boolean freeCaptivesEmbeddedAt(short x, short y)
 */
export function freeCaptivesEmbeddedAt(
    x: number,
    y: number,
    ctx: AllyManagementContext,
): boolean {
    if (ctx.pmap[x][y].flags & TileFlag.HAS_MONSTER) {
        const monst = ctx.monsterAtLoc({ x, y });
        if (
            monst &&
            (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) &&
            !(monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS) &&
            ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
        ) {
            freeCaptive(monst, ctx);
            return true;
        }
    }
    return false;
}
