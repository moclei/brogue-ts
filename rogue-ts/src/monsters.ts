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

import { getGameState } from "./core.js";
import { buildCombatDamageContext } from "./combat.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    cellHasTerrainType as cellHasTerrainTypeFn,
} from "./state/helpers.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
    heal as healFn,
} from "./combat/combat-damage.js";
import { monsterCanSubmergeNow } from "./monsters/monster-spawning.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { allocGrid, fillGrid } from "./grid/grid.js";
import { randRange, randPercent } from "./math/rng.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { DCOLS, DROWS, MAX_WAYPOINT_COUNT } from "./types/constants.js";
import { TileFlag } from "./types/flags.js";
import { CreatureState, GameMode } from "./types/enums.js";
import type { SpawnContext } from "./monsters/monster-spawning.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import type { MonsterGenContext } from "./monsters/monster-creation.js";
import type { Creature, Pos } from "./types/types.js";

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
        gameConst, monsterItemsHopper,
    } = getGameState();

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
        buildMachine: () => {},         // stub — wired in port-v2-platform
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
        refreshDungeonCell: () => {},   // stub — wired in port-v2-platform

        // ── Visibility ────────────────────────────────────────────────────────
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),

        // ── Ally management ───────────────────────────────────────────────────
        becomeAllyWith(creature) {
            // Minimal: set ally state and link to player.
            // Full implementation (sound, bookkeepingFlags, etc.) wired in port-v2-platform.
            creature.creatureState = CreatureState.Ally;
            creature.leader = player;
        },

        // ── Decorative stubs ──────────────────────────────────────────────────
        drawManacles: () => {},         // stub — wired in port-v2-platform

        // ── Grid ops ─────────────────────────────────────────────────────────
        allocGrid,
        fillGrid,

        // ── Complex pathfinding stubs (wired in port-v2-platform) ─────────────
        getQualifyingPathLocNear: (loc) => ({ x: loc.x, y: loc.y }),
        randomMatchingLocation: () => null,
        passableArcCount: () => 0,

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
    const { player, rogue, pmap, monsters, floorItems } = getGameState();

    const combatCtx = buildCombatDamageContext();

    const cellHasTerrainFlag = (loc: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, loc, flags);
    const cellHasTMFlag = (loc: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, loc, flags);

    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    const queryCtx: MonsterQueryContext = {
        player,
        cellHasTerrainFlag,
        cellHasGas: (_loc) => false,     // stub
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    return {
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

        // ── Waypoint system (stubs — needs wpDistance maps) ───────────────────
        waypointCount: rogue.wpCount,
        maxWaypointCount: MAX_WAYPOINT_COUNT,
        closestWaypointIndex: () => -1,         // stub
        closestWaypointIndexTo: () => -1,       // stub

        // ── Terrain analysis (stubs — needs burn/secret tile logic) ───────────
        burnedTerrainFlagsAtLoc: () => 0,       // stub
        discoveredTerrainFlagsAtLoc: () => 0,   // stub
        passableArcCount: () => 0,              // stub

        // ── Awareness (stubs — needs scent map and FOV) ───────────────────────
        awareOfTarget: () => false,             // stub
        openPathBetween: () => false,           // stub
        traversiblePathBetween: () => false,    // stub
        inFieldOfView: (loc) =>
            !!(pmap[loc.x]?.[loc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW),

        // ── Side effects ──────────────────────────────────────────────────────
        heal: (monst, percent, panacea) => healFn(monst, percent, panacea, combatCtx),
        inflictDamage: (attacker, defender, damage) =>
            inflictDamageFn(attacker, defender, damage, null, false, combatCtx),
        killCreature: (monst, quiet) => killCreatureFn(monst, quiet, combatCtx),
        extinguishFireOnCreature: () => {},     // stub — wired in port-v2-platform
        makeMonsterDropItem(monst) {
            if (monst.carriedItem) {
                floorItems.push(monst.carriedItem);
                monst.carriedItem = null;
            }
        },

        // ── UI stubs (wired in port-v2-platform) ──────────────────────────────
        refreshDungeonCell: () => {},
        message: () => {},
        messageWithColor: () => {},
        combatMessage: () => {},
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
}
