/*
 *  monsters.ts — Monster context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildMonsterSpawningContext() and buildMonsterStateContext(),
 *  the two context factories that wire the monster module's DI interfaces.
 *
 *  Machine building, minion pathfinding, waypoint distance maps, and scent-
 *  based awareness are stubbed here; they will be wired in port-v2-platform.
 *  Combat callbacks delegate to buildCombatDamageContext() (Phase 3).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getBuildMachineFn } from "./core.js";
import { buildCombatDamageContext } from "./combat.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    cellHasTerrainType as cellHasTerrainTypeFn,
    burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import {
    awareOfTarget as awareOfTargetFn,
    closestWaypointIndex as closestWaypointIndexFn,
    closestWaypointIndexTo as closestWaypointIndexToFn,
} from "./monsters/monster-awareness.js";
import type { AwarenessContext } from "./monsters/monster-awareness.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
    heal as healFn,
} from "./combat/combat-damage.js";
import { monsterCanSubmergeNow } from "./monsters/monster-spawning.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { allocGrid, fillGrid } from "./grid/grid.js";
import { openPathBetween as openPathBetweenFn } from "./items/bolt-geometry.js";
import { passableArcCount as passableArcCountFn, randomMatchingLocation as randomMatchingLocationFn } from "./architect/helpers.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { randRange, randPercent } from "./math/rng.js";
import { coordinatesAreInMap, posNeighborInDirection } from "./globals/tables.js";
import { DCOLS, DROWS, MAX_WAYPOINT_COUNT } from "./types/constants.js";
import { TileFlag, MonsterBookkeepingFlag, TerrainFlag } from "./types/flags.js";
import { GameMode, DungeonLayer, TileType } from "./types/enums.js";
import { extinguishFireOnCreature as extinguishFireOnCreatureFn } from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { white, minersLightColor } from "./globals/colors.js";
import type { SpawnContext } from "./monsters/monster-spawning.js";
import { monsterAvoids as monsterAvoidsFn } from "./monsters/monster-state.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import { traversiblePathBetween as traversiblePathBetweenFn } from "./monsters/monster-actions.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import type { MonsterGenContext } from "./monsters/monster-creation.js";
import { becomeAllyWith as becomeAllyWithFn } from "./monsters/monster-lifecycle.js";
import type { Creature, Pos } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildMessageFns } from "./io-wiring.js";
import { doMakeMonsterDropItem, buildQualifyingPathCtx } from "./monsters/monster-drop.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "./movement/path-qualifying.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterAtLoc(player: Creature, monsters: Creature[]) {
    return function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}


// =============================================================================
// buildMonsterSpawningContext
// =============================================================================

/**
 * Build a SpawnContext backed by the current game state.
 *
 * Wires real implementations for map queries, cell flag mutation, monster
 * registration, and administrative kills.  Minion pathfinding
 * (getQualifyingPathLocNear), random location search (randomMatchingLocation),
 * machine building, and manacle drawing are stubbed — wired in port-v2-platform.
 */
export function buildMonsterSpawningContext(): SpawnContext {
    const {
        player, rogue, pmap, monsters, monsterCatalog,
        gameConst, monsterItemsHopper, floorItems,
    } = getGameState();
    const refreshDungeonCell = buildRefreshDungeonCellFn();

    const combatCtx = buildCombatDamageContext();

    const genCtx: MonsterGenContext = {
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        monsterCatalog,
        mutationCatalog,
        monsterItemsHopper,
        itemsEnabled: rogue.mode !== GameMode.Wizard,
    };

    const cellHasTerrainFlag = (loc: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, loc, flags);
    const cellHasTMFlag = (loc: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, loc, flags);

    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    return {
        genCtx,
        gameConstants: gameConst,
        hordeCatalog,
        monsterCatalog,
        monsters,
        monstersEnabled: !rogue.playbackMode,

        // ── Map queries ───────────────────────────────────────────────────────
        cellHasTerrainFlag,
        cellHasTMFlag,
        cellHasTerrainType: (loc, terrainType) =>
            cellHasTerrainTypeFn(pmap, loc, terrainType),
        isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),

        // ── Map mutation ──────────────────────────────────────────────────────
        monsterAtLoc,
        killCreature: (creature, quiet) => killCreatureFn(creature, quiet, combatCtx),
        buildMachine: (machineType, x, y) => {
            const fn = getBuildMachineFn();
            if (fn) fn(machineType, x, y);
        },
        setCellFlag(loc, flag) {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags |= flag;
            }
        },
        clearCellFlag(loc, flag) {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags &= ~flag;
            }
        },
        refreshDungeonCell,

        // ── Visibility ────────────────────────────────────────────────────────
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),

        // ── Ally management ───────────────────────────────────────────────────
        becomeAllyWith(creature) {
            becomeAllyWithFn(creature, {
                player,
                demoteMonsterFromLeadership(monst) {
                    // Simplified: single-level follower reassignment.
                    // Full multi-level iteration deferred to port-v2-platform.
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
                        }
                    }
                },
                makeMonsterDropItem: (monst) =>
                    doMakeMonsterDropItem(monst, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCell),
                refreshDungeonCell,
            });
        },

        // ── Decorative ───────────────────────────────────────────────────────
        drawManacles: (loc) => {
            // C: Monsters.c:771 — drawManacles / drawManacle
            // Indexed by direction (0=UP,1=DOWN,2=LEFT,3=RIGHT,4=UPLEFT,5=DOWNLEFT,6=UPRIGHT,7=DOWNRIGHT)
            const manacles: TileType[] = [
                TileType.MANACLE_T, TileType.MANACLE_B, TileType.MANACLE_L, TileType.MANACLE_R,
                TileType.MANACLE_TL, TileType.MANACLE_BL, TileType.MANACLE_TR, TileType.MANACLE_BR,
            ];
            // Four groups of fallback directions; try each in order, stop on first success
            const fallback = [
                [4, 0, 2], // UPLEFT, UP, LEFT
                [5, 1, 2], // DOWNLEFT, DOWN, LEFT
                [6, 0, 3], // UPRIGHT, UP, RIGHT
                [7, 1, 3], // DOWNRIGHT, DOWN, RIGHT
            ];
            const tryPlace = (dir: number): boolean => {
                const newLoc = posNeighborInDirection(loc, dir);
                if (!coordinatesAreInMap(newLoc.x, newLoc.y)) return false;
                const cell = pmap[newLoc.x][newLoc.y];
                if (cell.layers[DungeonLayer.Dungeon] !== TileType.FLOOR) return false;
                if (cell.layers[DungeonLayer.Liquid] !== TileType.NOTHING) return false;
                cell.layers[DungeonLayer.Surface] = manacles[dir];
                return true;
            };
            for (const group of fallback) {
                for (const dir of group) {
                    if (tryPlace(dir)) break;
                }
            }
        },

        // ── Grid ops ─────────────────────────────────────────────────────────
        allocGrid,
        fillGrid,

        // ── Complex pathfinding ───────────────────────────────────────────────
        getQualifyingPathLocNear: (loc, hallwaysAllowed, blockingTerrainFlags, blockingMapFlags, forbiddenTerrainFlags, forbiddenMapFlags, deterministic) =>
            getQualifyingPathLocNearFn(loc, hallwaysAllowed, blockingTerrainFlags, blockingMapFlags, forbiddenTerrainFlags, forbiddenMapFlags, deterministic, buildQualifyingPathCtx(pmap, cellHasTerrainFlag)),
        randomMatchingLocation: (dt, lt, tt) => randomMatchingLocationFn(pmap, tileCatalog, dt, lt, tt),
        passableArcCount: (x, y) => passableArcCountFn(pmap, x, y),

        // ── Cell flags ────────────────────────────────────────────────────────
        getPmapFlags: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
    };
}

// =============================================================================
// buildMonsterStateContext
// =============================================================================

/**
 * Build a MonsterStateContext backed by the current game state.
 *
 * Wires real implementations for status decrement, combat damage/kill,
 * healing, and flag checks.  Waypoint distance maps, scent-based awareness,
 * path analysis, and fire-extinguishing are stubbed — wired in port-v2-platform.
 */
export function buildMonsterStateContext(): MonsterStateContext {
    const { player, rogue, pmap, monsters, floorItems, monsterCatalog } = getGameState();
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn();

    const combatCtx = buildCombatDamageContext();

    const cellHasTerrainFlag = (loc: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, loc, flags);
    const cellHasTMFlag = (loc: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, loc, flags);

    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    const queryCtx: MonsterQueryContext = {
        player,
        cellHasTerrainFlag,
        cellHasGas: (loc) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
        playerStatus: player.status,
        monsterCatalog,
    };

    const stateCtx: MonsterStateContext = {
        player,
        monsters,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        queryCtx,

        // ── Map access ────────────────────────────────────────────────────────
        cellHasTerrainFlag,
        cellHasTMFlag,
        terrainFlags: (loc) => terrainFlagsFn(pmap, loc),
        cellFlags: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
        isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
        downLoc: rogue.downLoc,
        upLoc: rogue.upLoc,

        // ── Creature queries ──────────────────────────────────────────────────
        monsterAtLoc,

        // ── Waypoint system ───────────────────────────────────────────────────
        waypointCount: rogue.wpCount,
        maxWaypointCount: MAX_WAYPOINT_COUNT,
        closestWaypointIndex: (monst) =>
            closestWaypointIndexFn(monst, rogue.wpCount, rogue.wpDistance, DCOLS),
        closestWaypointIndexTo: (loc) =>
            closestWaypointIndexToFn(loc, rogue.wpCount, rogue.wpDistance),

        // ── Terrain analysis ──────────────────────────────────────────────────
        burnedTerrainFlagsAtLoc: (loc) => burnedTerrainFlagsAtLocFn(pmap, loc),
        discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
        passableArcCount: (x, y) => passableArcCountFn(pmap, x, y),

        // ── Awareness ────────────────────────────────────────────────────────
        awareOfTarget: (observer, target) => {
            const scentMap = rogue.scentMap ?? [];
            const awarenessCtx: AwarenessContext = {
                player,
                scentMap: scentMap as number[][],
                scentTurnNumber: rogue.scentTurnNumber,
                stealthRange: rogue.stealthRange,
                openPathBetween: (l1, l2) =>
                    openPathBetweenFn(l1, l2, (pos) => cellHasTerrainFlagFn(pmap, pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
                inFieldOfView: (loc) => !!(pmap[loc.x]?.[loc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW),
                randPercent: (pct) => randPercent(pct),
            };
            return awareOfTargetFn(observer, target, awarenessCtx);
        },
        openPathBetween: (l1, l2) =>
            openPathBetweenFn(l1, l2, (pos) => cellHasTerrainFlagFn(pmap, pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
        traversiblePathBetween: (monst, x, y) =>
            traversiblePathBetweenFn(monst, x, y, {
                monsterAvoids: (m, loc) => monsterAvoidsFn(m, loc, stateCtx),
                DCOLS,
                DROWS,
            }),
        inFieldOfView: (loc) =>
            !!(pmap[loc.x]?.[loc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW),

        // ── Side effects ──────────────────────────────────────────────────────
        heal: (monst, percent, panacea) => healFn(monst, percent, panacea, combatCtx),
        inflictDamage: (attacker, defender, damage) =>
            inflictDamageFn(attacker, defender, damage, null, false, combatCtx),
        killCreature: (monst, quiet) => killCreatureFn(monst, quiet, combatCtx),
        extinguishFireOnCreature: (monst) =>
            extinguishFireOnCreatureFn(monst, {
                player,
                white,
                minersLightColor,
                rogue,
                refreshDungeonCell,
                updateVision: () => {},  // monster-only path; player handled in turn-processing.ts
                message: io.message,
            } as unknown as CreatureEffectsContext),
        makeMonsterDropItem: (monst) =>
            doMakeMonsterDropItem(monst, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCell),

        // ── UI stubs (wired in port-v2-platform) ──────────────────────────────
        refreshDungeonCell,
        message: io.message,
        messageWithColor: io.message,
        combatMessage: (text) => io.combatMessage(text, null),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),

        // ── Player equipment stubs ────────────────────────────────────────────
        playerHasRespirationArmor: () => false,
        mapToShore: rogue.mapToShore,

        // ── Flag constants ────────────────────────────────────────────────────
        PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
        HAS_STAIRS: TileFlag.HAS_STAIRS,
        IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,

        // ── Submersion ────────────────────────────────────────────────────────
        monsterCanSubmergeNow: (monst) =>
            monsterCanSubmergeNow(monst, cellHasTMFlag, cellHasTerrainFlag),

        // ── Map dimensions ────────────────────────────────────────────────────
        DCOLS,
        DROWS,
    };
    return stateCtx;
}
