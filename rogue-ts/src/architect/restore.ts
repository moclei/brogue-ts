/*
 *  architect/restore.ts — restoreMonster and restoreItems
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Architect.c lines 3501–3599
 *  Functions: restoreMonster, restoreItems
 *
 *  Contexts: RestoreMonsterContext, RestoreItemsContext
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos, Item, DungeonFeature, FloorTileType } from "../types/types.js";
import {
    TerrainFlag,
    TerrainMechFlag,
    MonsterBookkeepingFlag,
    ItemFlag,
    IS_IN_MACHINE,
    T_DIVIDES_LEVEL,
} from "../types/flags.js";
import { StatusEffect } from "../types/enums.js";

// =============================================================================
// Context interfaces
// =============================================================================

/**
 * Minimal context for restoreMonster.
 *
 * C equivalent: Architect.c:3501
 */
export interface RestoreMonsterContext {
    pmap: Pcell[][];
    monsters: Creature[];
    nbDirs: readonly [number, number][];
    coordinatesAreInMap(x: number, y: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    avoidedFlagsForMonster(info: Creature["info"]): number;
    /**
     * Find a qualifying path location near target.
     * Signature matches getQualifyingPathLocNear's external interface.
     */
    getQualifyingPathLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        blockingTerrainFlags: number,
        blockingMapFlags: number,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;
    /** (Optionally) known-passable predicate — used by nextStep. */
    knownToPlayerAsPassableOrSecretDoor(pos: Pos): boolean;

    // Flags
    HAS_PLAYER: number;
    HAS_STAIRS: number;
    HAS_MONSTER: number;
    IS_IN_MACHINE: number;
}

/**
 * Minimal context for restoreItems.
 *
 * C equivalent: Architect.c:3573
 */
export interface RestoreItemsContext {
    pmap: Pcell[][];
    floorItems: Item[];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    coordinatesAreInMap(x: number, y: number): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    /**
     * Place an item at a destination on the map.
     */
    placeItemAt(item: Item, dest: Pos): void;
    /**
     * Find a qualifying location near target, avoiding certain terrain/map flags.
     * Returns null if none found.
     */
    getQualifyingLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        blockingMap: number[][] | null,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        forbidLiquid: boolean,
        deterministic: boolean,
    ): Pos | null;
    // Constants
    HAS_MONSTER: number;
    HAS_ITEM: number;
    HAS_STAIRS: number;
}

// =============================================================================
// restoreMonster — Architect.c:3501
// =============================================================================

/**
 * Restore a monster to the level after a depth transition.
 *
 * If the monster has STATUS_ENTERS_LEVEL_IN > 0, it is moved step-by-step
 * toward the stairs (or pit) before being placed. If the resulting position
 * conflicts with the player or stairs, it is relocated to the nearest valid
 * location via getQualifyingPathLocNear.
 *
 * C equivalent: `restoreMonster(monst, mapToStairs, mapToPit)` in Architect.c:3501
 *
 * @param monst - The monster to restore.
 * @param mapToStairs - Dijkstra distance-to-stairs map (null if not available).
 * @param mapToPit - Dijkstra distance-to-pit map (null if not available).
 */
export function restoreMonster(
    monst: Creature,
    mapToStairs: number[][] | null,
    mapToPit: number[][] | null,
    ctx: RestoreMonsterContext,
): void {
    const x = monst.loc.x;
    const y = monst.loc.y;

    // Determine which map to use for pathfinding
    let theMap: number[][] | null = null;
    if (monst.status[StatusEffect.EntersLevelIn] > 0) {
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_PIT) {
            theMap = mapToPit;
        } else {
            theMap = mapToStairs;
        }

        // Remove from current position
        ctx.pmap[x][y].flags &= ~ctx.HAS_MONSTER;

        if (theMap) {
            // Convert STATUS_ENTERS_LEVEL_IN back to steps and advance monster
            // toward the stairs/pit. Mirror C: subtract (entersTurns * 100 / speed) steps.
            const turnCount = Math.floor(
                theMap[monst.loc.x][monst.loc.y] -
                (monst.status[StatusEffect.EntersLevelIn] * 100 / monst.movementSpeed),
            );

            for (let i = 0; i < turnCount; i++) {
                const dir = nextStepAlongMap(theMap, monst.loc, ctx);
                if (dir >= 0) {
                    monst.loc = {
                        x: monst.loc.x + ctx.nbDirs[dir][0],
                        y: monst.loc.y + ctx.nbDirs[dir][1],
                    };
                } else {
                    break;
                }
            }
        }
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_PREPLACED;
    }

    const newX = monst.loc.x;
    const newY = monst.loc.y;

    // Relocate if position conflicts
    if (
        (ctx.pmap[newX][newY].flags & (ctx.HAS_PLAYER | ctx.HAS_STAIRS)) ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_PREPLACED)
    ) {
        if (!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_PREPLACED)) {
            // Clear previous HAS_MONSTER only if not preplaced
            ctx.pmap[newX][newY].flags &= ~ctx.HAS_MONSTER;
        }

        const avoidFlags = ctx.avoidedFlagsForMonster(monst.info);
        const newPos = ctx.getQualifyingPathLocNear(
            { x: newX, y: newY },
            true,
            T_DIVIDES_LEVEL & avoidFlags,
            0,
            avoidFlags,
            ctx.HAS_MONSTER | ctx.HAS_PLAYER | ctx.HAS_STAIRS | ctx.IS_IN_MACHINE,
            true,
        );
        monst.loc = { ...newPos };
    }

    // Set HAS_MONSTER flag at final position
    ctx.pmap[monst.loc.x][monst.loc.y].flags |= ctx.HAS_MONSTER;

    // Clear transitional bookkeeping flags
    monst.bookkeepingFlags &= ~(
        MonsterBookkeepingFlag.MB_PREPLACED |
        MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS |
        MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS |
        MonsterBookkeepingFlag.MB_APPROACHING_PIT |
        MonsterBookkeepingFlag.MB_ABSORBING
    );
    monst.status[StatusEffect.EntersLevelIn] = 0;
    monst.corpseAbsorptionCounter = 0;

    // Remove submerged flag if new cell doesn't allow submersion
    if (
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
        !ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
    ) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
    }

    // Detach from leader if leader is no longer on this level
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) {
        const foundLeader = ctx.monsters.some(m => m === monst.leader);
        if (!foundLeader) {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_FOLLOWER;
            (monst as any).leader = null;
        }
    }
}

// =============================================================================
// restoreItems — Architect.c:3573
// =============================================================================

/**
 * Restore items that fell from the previous depth level.
 *
 * Preplaced items (ITEM_PREPLACED) are removed from the floor chain,
 * then placed at a valid location near their stored position.
 *
 * C equivalent: `restoreItems()` in Architect.c:3573
 */
export function restoreItems(ctx: RestoreItemsContext): void {
    // Separate preplaced items from the floor chain
    const preplaced: Item[] = [];
    for (let i = ctx.floorItems.length - 1; i >= 0; i--) {
        const item = ctx.floorItems[i];
        if (item.flags & ItemFlag.ITEM_PREPLACED) {
            item.flags &= ~ItemFlag.ITEM_PREPLACED;
            ctx.floorItems.splice(i, 1);
            preplaced.push(item);
        }
    }

    // Place each preplaced item at a valid nearby location
    for (const item of preplaced) {
        const loc = ctx.getQualifyingLocNear(
            item.loc,
            true,
            null,
            TerrainFlag.T_OBSTRUCTS_ITEMS,
            ctx.HAS_MONSTER | ctx.HAS_ITEM | ctx.HAS_STAIRS | IS_IN_MACHINE,
            false,
            false,
        );
        if (loc) {
            ctx.placeItemAt(item, loc);
        }
    }
}

// =============================================================================
// nextStepAlongMap — local helper for restoreMonster
// =============================================================================

/**
 * Find the direction that decreases the distance map value most from `pos`.
 * Prefers diagonals (mirrors the C nextStep call with preferDiagonals=true).
 *
 * @param distanceMap - Dijkstra distance map.
 * @param pos - Current position.
 * @param ctx - Context providing nbDirs and coordinatesAreInMap.
 * @returns The best direction index, or -1 if none.
 */
function nextStepAlongMap(
    distanceMap: number[][],
    pos: Pos,
    ctx: Pick<RestoreMonsterContext, "nbDirs" | "coordinatesAreInMap" | "knownToPlayerAsPassableOrSecretDoor">,
): number {
    let bestScore = 0;
    let bestDir = -1;

    // preferDiagonals=true: iterate 7 down to 0
    for (let dir = 7; dir >= 0; dir--) {
        const nx = pos.x + ctx.nbDirs[dir][0];
        const ny = pos.y + ctx.nbDirs[dir][1];

        if (!ctx.coordinatesAreInMap(nx, ny)) continue;
        // Skip walls/impassable cells the player knows about
        if (!ctx.knownToPlayerAsPassableOrSecretDoor({ x: nx, y: ny })) continue;

        const score = distanceMap[pos.x][pos.y] - distanceMap[nx][ny];
        if (score > bestScore) {
            bestDir = dir;
            bestScore = score;
        }
    }

    return bestDir;
}
