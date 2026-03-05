/*
 *  monster-spawning.ts — Monster horde selection, spawning, and population
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: pickHordeType, forbiddenFlagsForMonster, avoidedFlagsForMonster,
 *             monsterCanSubmergeNow, spawnMinions, spawnHorde, populateMonsters,
 *             getRandomMonsterSpawnLocation, spawnPeriodicHorde
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, CreatureType, HordeType, GameConstants, Pos } from "../types/types.js";
import { MonsterType, StatusEffect, CreatureState, TileType } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TerrainFlag,
    TerrainMechFlag,
    HordeFlag,
    T_PATHING_BLOCKER,
    T_HARMFUL_TERRAIN,
    T_DIVIDES_LEVEL,
    HORDE_MACHINE_ONLY,
} from "../types/flags.js";
import type { MonsterRNG, MonsterGenContext } from "./monster-creation.js";
import { generateMonster } from "./monster-creation.js";

// ============================================================================
// Pure query functions (no map state required)
// ============================================================================

/**
 * Computes the terrain flags that a monster of the given type cannot enter.
 * Based on the monster's movement capabilities (flight, fire immunity, etc.).
 *
 * Ported from forbiddenFlagsForMonster() in Monsters.c.
 */
export function forbiddenFlagsForMonster(monsterType: CreatureType): number {
    let flags = T_PATHING_BLOCKER;

    if (monsterType.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) {
        flags &= ~(
            TerrainFlag.T_LAVA_INSTA_DEATH |
            TerrainFlag.T_SPONTANEOUSLY_IGNITES |
            TerrainFlag.T_IS_FIRE
        );
    }
    if (monsterType.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE | MonsterBehaviorFlag.MONST_FLIES)) {
        flags &= ~TerrainFlag.T_LAVA_INSTA_DEATH;
    }
    if (monsterType.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE) {
        flags &= ~(TerrainFlag.T_SPONTANEOUSLY_IGNITES | TerrainFlag.T_IS_FIRE);
    }
    if (monsterType.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WATER | MonsterBehaviorFlag.MONST_FLIES)) {
        flags &= ~TerrainFlag.T_IS_DEEP_WATER;
    }
    if (monsterType.flags & MonsterBehaviorFlag.MONST_FLIES) {
        flags &= ~(TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DF_TRAP);
    }

    return flags >>> 0; // ensure unsigned
}

/**
 * Computes the terrain flags that a monster of the given type avoids.
 * This is a superset of forbidden flags plus harmful terrain.
 *
 * Ported from avoidedFlagsForMonster() in Monsters.c.
 */
export function avoidedFlagsForMonster(monsterType: CreatureType): number {
    let flags = forbiddenFlagsForMonster(monsterType) | T_HARMFUL_TERRAIN | TerrainFlag.T_SACRED;

    if (monsterType.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) {
        flags &= ~(T_HARMFUL_TERRAIN | TerrainFlag.T_IS_DF_TRAP);
    }
    if (monsterType.flags & MonsterBehaviorFlag.MONST_INANIMATE) {
        flags &= ~(
            TerrainFlag.T_CAUSES_POISON |
            TerrainFlag.T_CAUSES_DAMAGE |
            TerrainFlag.T_CAUSES_PARALYSIS |
            TerrainFlag.T_CAUSES_CONFUSION
        );
    }
    if (monsterType.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE) {
        flags &= ~TerrainFlag.T_IS_FIRE;
    }
    if (monsterType.flags & MonsterBehaviorFlag.MONST_FLIES) {
        flags &= ~TerrainFlag.T_CAUSES_POISON;
    }

    return flags >>> 0;
}

// ============================================================================
// pickHordeType
// ============================================================================

/**
 * Returns a random horde type index, weighted by spawn frequency, which has
 * all requiredFlags and none of the forbiddenFlags.
 *
 * If summonerType is MK_YOU (0), all hordes valid for the given depth are
 * considered. Otherwise, all summoned hordes with that leader type are used.
 *
 * Ported from pickHordeType() in Monsters.c.
 *
 * @returns The horde catalog index, or -1 if no valid horde exists.
 */
export function pickHordeType(
    depth: number,
    summonerType: MonsterType,
    forbiddenFlags: number,
    requiredFlags: number,
    hordeCatalog: readonly HordeType[],
    rng: MonsterRNG,
): number {
    let possCount = 0;

    for (let i = 0; i < hordeCatalog.length; i++) {
        const h = hordeCatalog[i];
        if (
            !(h.flags & forbiddenFlags) &&
            !(~h.flags & requiredFlags) &&
            (
                (!summonerType && h.minLevel <= depth && h.maxLevel >= depth) ||
                (summonerType && (h.flags & HordeFlag.HORDE_IS_SUMMONED) && h.leaderType === summonerType)
            )
        ) {
            possCount += h.frequency;
        }
    }

    if (possCount === 0) {
        return -1;
    }

    let index = rng.randRange(1, possCount);

    for (let i = 0; i < hordeCatalog.length; i++) {
        const h = hordeCatalog[i];
        if (
            !(h.flags & forbiddenFlags) &&
            !(~h.flags & requiredFlags) &&
            (
                (!summonerType && h.minLevel <= depth && h.maxLevel >= depth) ||
                (summonerType && (h.flags & HordeFlag.HORDE_IS_SUMMONED) && h.leaderType === summonerType)
            )
        ) {
            if (index <= h.frequency) {
                return i;
            }
            index -= h.frequency;
        }
    }

    return 0; // should never happen
}

// ============================================================================
// Spawning context — DI for map-dependent operations
// ============================================================================

/**
 * Context for monster spawning operations. Provides callbacks for
 * map-dependent operations that the pure spawning logic needs.
 */
export interface SpawnContext {
    /** Monster generation context (catalogs, RNG, depth, etc.). */
    genCtx: MonsterGenContext;
    /** Game constants. */
    gameConstants: GameConstants;
    /** Horde catalog to use. */
    hordeCatalog: readonly HordeType[];
    /** Monster catalog to use. */
    monsterCatalog: readonly CreatureType[];
    /** The active monsters list for this level. */
    monsters: Creature[];
    /** Whether monsters are enabled. */
    monstersEnabled: boolean;

    // --- Map query callbacks ---
    /** Checks if a cell has the given terrain flags set. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Checks if a cell has a terrain mechanics flag set. */
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    /** Checks if a cell has a specific terrain type (tile type). */
    cellHasTerrainType(loc: Pos, terrainType: TileType): boolean;
    /** Checks if a position is inside the map bounds. */
    isPosInMap(loc: Pos): boolean;

    // --- Map mutation callbacks ---
    /** Gets a monster at a location. */
    monsterAtLoc(loc: Pos): Creature | null;
    /** Kill a creature (remove from game). */
    killCreature(creature: Creature, quiet: boolean): void;
    /** Build a machine at a location. */
    buildMachine(machineType: number, x: number, y: number): void;
    /** Set cell flags. */
    setCellFlag(loc: Pos, flag: number): void;
    /** Clear cell flags. */
    clearCellFlag(loc: Pos, flag: number): void;
    /** Refresh a dungeon cell visually (no-op for headless). */
    refreshDungeonCell(loc: Pos): void;
    /** Check if player can see/sense a location (for refresh). */
    playerCanSeeOrSense(x: number, y: number): boolean;
    /** Make a creature an ally of the player. */
    becomeAllyWith(creature: Creature): void;
    /** Draw manacles around a location. */
    drawManacles(loc: Pos): void;
    /** Allocate a grid (2D number array). */
    allocGrid(): number[][];
    /** Fill a grid with a value. */
    fillGrid(grid: number[][], value: number): void;
    /** Find a qualifying path location near the given position. */
    getQualifyingPathLocNear(
        loc: Pos,
        hallwaysAllowed: boolean,
        blockingTerrainFlags: number,
        blockingMapFlags: number,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;
    /** Find a random matching location with specific terrain. */
    randomMatchingLocation(
        dungeonType: TileType,
        liquidType: TileType | -1,
        terrainType: TileType | -1,
    ): Pos | null;
    /** Get the passable arc count for a location. */
    passableArcCount(x: number, y: number): number;
    /** Get pmap flags at a position. */
    getPmapFlags(loc: Pos): number;
}

// ============================================================================
// monsterCanSubmergeNow
// ============================================================================

/**
 * Checks if a monster can submerge at its current location.
 *
 * Ported from monsterCanSubmergeNow() in Monsters.c.
 */
export function monsterCanSubmergeNow(
    monst: Creature,
    cellHasTMFlag: (loc: Pos, flags: number) => boolean,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    return !!(
        (monst.info.flags & MonsterBehaviorFlag.MONST_SUBMERGES) &&
        cellHasTMFlag(monst.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING) &&
        !cellHasTerrainFlag(monst.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !(monst.bookkeepingFlags & (
            MonsterBookkeepingFlag.MB_SEIZING |
            MonsterBookkeepingFlag.MB_SEIZED |
            MonsterBookkeepingFlag.MB_CAPTIVE
        )) &&
        (
            (monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE | MonsterBehaviorFlag.MONST_INVULNERABLE)) ||
            monst.status[StatusEffect.ImmuneToFire] ||
            !cellHasTerrainFlag(monst.loc, TerrainFlag.T_LAVA_INSTA_DEATH)
        )
    );
}

// ============================================================================
// spawnMinions
// ============================================================================

/**
 * Spawns the member/minion creatures for a horde around a leader.
 * Returns true if at least one minion was spawned.
 *
 * Ported from spawnMinions() in Monsters.c.
 */
export function spawnMinions(
    hordeID: number,
    leader: Creature,
    summoned: boolean,
    itemPossible: boolean,
    ctx: SpawnContext,
): boolean {
    const theHorde = ctx.hordeCatalog[hordeID];
    let atLeastOneMinion = false;

    for (let iSpecies = 0; iSpecies < theHorde.numberOfMemberTypes; iSpecies++) {
        const memberRange = theHorde.memberCount[iSpecies];
        const count = ctx.genCtx.rng.randRange(memberRange.lowerBound, memberRange.upperBound);

        let forbiddenTerrainFlags = forbiddenFlagsForMonster(
            ctx.monsterCatalog[theHorde.memberType[iSpecies]],
        );
        if (theHorde.spawnsIn) {
            // Allow spawning in the horde's designated terrain
            // (tileCatalog terrain flags would remove the blocking flag)
            // For simplicity, we clear the deep water / lava flags when spawnsIn is set
            forbiddenTerrainFlags &= ~terrainFlagForTileType(theHorde.spawnsIn);
        }

        for (let iMember = 0; iMember < count; iMember++) {
            const monst = generateMonster(
                theHorde.memberType[iSpecies],
                itemPossible,
                !summoned,
                ctx.genCtx,
            );

            let failsafe = 0;
            do {
                monst.loc = ctx.getQualifyingPathLocNear(
                    { x: leader.loc.x, y: leader.loc.y },
                    summoned,
                    T_DIVIDES_LEVEL & forbiddenTerrainFlags,
                    0x2 | 0x10, // HAS_PLAYER | HAS_STAIRS
                    forbiddenTerrainFlags,
                    0x4, // HAS_MONSTER
                    false,
                );
            } while (
                theHorde.spawnsIn &&
                !ctx.cellHasTerrainType(monst.loc, theHorde.spawnsIn) &&
                failsafe++ < 20
            );

            if (failsafe >= 20) {
                // Abort this minion — remove it
                const idx = ctx.monsters.indexOf(monst);
                if (idx !== -1) ctx.monsters.splice(idx, 1);
                ctx.killCreature(monst, true);
                break;
            }

            if (monsterCanSubmergeNow(monst, ctx.cellHasTMFlag, ctx.cellHasTerrainFlag)) {
                monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
            }

            ctx.setCellFlag(monst.loc, 0x4); // HAS_MONSTER
            monst.bookkeepingFlags |= (MonsterBookkeepingFlag.MB_FOLLOWER | MonsterBookkeepingFlag.MB_JUST_SUMMONED);
            monst.leader = leader;
            monst.creatureState = leader.creatureState;
            if (monst.creatureState === CreatureState.Ally) {
                monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_DOES_NOT_RESURRECT;
            }
            monst.mapToMe = null;
            if (theHorde.flags & HordeFlag.HORDE_DIES_ON_LEADER_DEATH) {
                monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_BOUND_TO_LEADER;
            }
            if (theHorde.flags & HordeFlag.HORDE_ALLIED_WITH_PLAYER) {
                ctx.becomeAllyWith(monst);
            }

            ctx.monsters.push(monst);
            atLeastOneMinion = true;
        }
    }

    if (atLeastOneMinion && !(theHorde.flags & HordeFlag.HORDE_DIES_ON_LEADER_DEATH)) {
        leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
    }

    return atLeastOneMinion;
}

// ============================================================================
// spawnHorde
// ============================================================================

/**
 * Spawns a complete horde (leader + minions) at the given location.
 * If hordeID is 0 (or less), it's randomly chosen based on depth.
 * If loc is invalid, a random location is chosen.
 *
 * Returns the horde leader, or null on failure.
 *
 * Ported from spawnHorde() in Monsters.c.
 */
export function spawnHorde(
    hordeID: number,
    loc: Pos,
    forbiddenFlags: number,
    requiredFlags: number,
    ctx: SpawnContext,
): Creature | null {
    const { gameConstants: gc, genCtx } = ctx;
    const rng = genCtx.rng;
    const depthLevel = genCtx.depthLevel;

    // Out-of-depth chance
    let depth: number;
    if (depthLevel > 1 && rng.randPercent(gc.monsterOutOfDepthChance)) {
        depth = depthLevel + rng.randRange(1, Math.min(5, Math.floor(depthLevel / 2)));
        if (depth > gc.amuletLevel) {
            depth = Math.max(depthLevel, gc.amuletLevel);
        }
        forbiddenFlags |= HordeFlag.HORDE_NEVER_OOD;
    } else {
        depth = depthLevel;
    }

    // Pick horde type if not specified
    if (hordeID <= 0) {
        let failsafe = 50;
        let tryAgain: boolean;
        do {
            tryAgain = false;
            hordeID = pickHordeType(depth, MonsterType.MK_YOU, forbiddenFlags, requiredFlags, ctx.hordeCatalog, rng);
            if (hordeID < 0) {
                return null;
            }
            if (ctx.isPosInMap(loc)) {
                if (
                    ctx.cellHasTerrainFlag(loc, T_PATHING_BLOCKER) &&
                    (!ctx.hordeCatalog[hordeID].spawnsIn ||
                        !ctx.cellHasTerrainType(loc, ctx.hordeCatalog[hordeID].spawnsIn))
                ) {
                    tryAgain = true;
                }
                if (
                    ctx.hordeCatalog[hordeID].spawnsIn &&
                    !ctx.cellHasTerrainType(loc, ctx.hordeCatalog[hordeID].spawnsIn)
                ) {
                    tryAgain = true;
                }
            }
        } while (--failsafe && tryAgain);
    }

    // Find a random location if none was given
    let failsafe = 50;
    if (!ctx.isPosInMap(loc)) {
        let i = 0;
        do {
            const liquidType = ctx.hordeCatalog[hordeID].spawnsIn
                ? ctx.hordeCatalog[hordeID].spawnsIn
                : -1 as TileType | -1;
            const foundLoc = ctx.randomMatchingLocation(TileType.FLOOR, liquidType, -1);
            if (!foundLoc || ctx.passableArcCount(foundLoc.x, foundLoc.y) > 1) {
                if (!--failsafe) {
                    return null;
                }
                hordeID = pickHordeType(depth, MonsterType.MK_YOU, forbiddenFlags, 0, ctx.hordeCatalog, rng);
                if (hordeID < 0) {
                    return null;
                }
                continue;
            }
            loc = foundLoc;
            i++;
            // Avoid spawning in visible areas (check pmap flags)
            const pmapFlags = ctx.getPmapFlags(loc);
            // ANY_KIND_OF_VISIBLE | IN_FIELD_OF_VIEW
            if (i < 25 && (pmapFlags & (0x10000 | 0x20000))) {
                continue;
            }
            break;
        } while (true);
    }

    const theHorde = ctx.hordeCatalog[hordeID];

    // Build accompanying machine if any
    if (theHorde.machine > 0) {
        ctx.buildMachine(theHorde.machine, loc.x, loc.y);
    }

    // Generate the leader
    const leader = generateMonster(theHorde.leaderType, true, true, genCtx);
    leader.loc = { ...loc };

    if (theHorde.flags & HordeFlag.HORDE_LEADER_CAPTIVE) {
        leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        leader.creatureState = CreatureState.Wandering;
        if (leader.info.turnsBetweenRegen > 0) {
            leader.currentHP = Math.floor(leader.info.maxHP / 4) + 1;
        }
        // Draw manacles unless spawning in special terrain
        if (!theHorde.spawnsIn) {
            ctx.drawManacles(loc);
        }
    } else if (theHorde.flags & HordeFlag.HORDE_ALLIED_WITH_PLAYER) {
        ctx.becomeAllyWith(leader);
    }

    if (theHorde.flags & HordeFlag.HORDE_SACRIFICE_TARGET) {
        leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_MARKED_FOR_SACRIFICE;
        // leader.info.intrinsicLightType = SACRIFICE_MARK_LIGHT;
        // TODO: set intrinsic light when light catalog is wired up
    }

    if (theHorde.flags & HordeFlag.HORDE_MACHINE_THIEF) {
        leader.safetyMap = ctx.allocGrid();
        ctx.fillGrid(leader.safetyMap, 0);
    }

    // Remove any pre-existing monster at this location
    const preexisting = ctx.monsterAtLoc(loc);
    if (preexisting) {
        ctx.killCreature(preexisting, true);
    }

    ctx.setCellFlag(loc, 0x4); // HAS_MONSTER
    if (ctx.playerCanSeeOrSense(loc.x, loc.y)) {
        ctx.refreshDungeonCell(loc);
    }
    if (monsterCanSubmergeNow(leader, ctx.cellHasTMFlag, ctx.cellHasTerrainFlag)) {
        leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
    }

    ctx.monsters.push(leader);
    spawnMinions(hordeID, leader, false, true, ctx);

    return leader;
}

// ============================================================================
// populateMonsters
// ============================================================================

/**
 * Generates and places all starting monsters for a level.
 *
 * Ported from populateMonsters() in Monsters.c.
 */
export function populateMonsters(ctx: SpawnContext): void {
    if (!ctx.monstersEnabled) {
        return;
    }

    const gc = ctx.gameConstants;
    const depthLevel = ctx.genCtx.depthLevel;
    const rng = ctx.genCtx.rng;

    let numberOfMonsters = Math.min(20, 6 + 3 * Math.max(0, depthLevel - gc.amuletLevel));

    while (rng.randPercent(60)) {
        numberOfMonsters++;
    }

    for (let i = 0; i < numberOfMonsters; i++) {
        spawnHorde(
            0,
            { x: -1, y: -1 }, // INVALID_POS triggers random placement
            HordeFlag.HORDE_IS_SUMMONED | HORDE_MACHINE_ONLY,
            0,
            ctx,
        );
    }
}

// ============================================================================
// spawnPeriodicHorde (called during gameplay, not level gen)
// ============================================================================

/**
 * Spawns a periodic horde during gameplay (wandering in from the edges).
 * Requires a `getRandomMonsterSpawnLocation` callback.
 *
 * Ported from spawnPeriodicHorde() in Monsters.c.
 */
export function spawnPeriodicHorde(
    ctx: SpawnContext,
    getRandomMonsterSpawnLocation: () => Pos | null,
): void {
    if (!ctx.monstersEnabled) {
        return;
    }

    const spawnLoc = getRandomMonsterSpawnLocation();
    if (spawnLoc) {
        const leader = spawnHorde(
            0,
            spawnLoc,
            HordeFlag.HORDE_IS_SUMMONED |
            HordeFlag.HORDE_LEADER_CAPTIVE |
            HordeFlag.HORDE_NO_PERIODIC_SPAWN |
            HORDE_MACHINE_ONLY,
            0,
            ctx,
        );
        if (leader) {
            leader.creatureState = CreatureState.Wandering;
            for (const monst of ctx.monsters) {
                if (monst.leader === leader) {
                    monst.creatureState = CreatureState.Wandering;
                }
            }
        }
    }
}

// ============================================================================
// Helper: terrain flag for tile type (used in spawnMinions)
// ============================================================================

/**
 * Returns the terrain flag that corresponds to a spawnsIn tile type.
 * Used to allow minions to spawn in special terrain.
 */
function terrainFlagForTileType(tileType: TileType): number {
    switch (tileType) {
        case TileType.DEEP_WATER:
            return TerrainFlag.T_IS_DEEP_WATER;
        case TileType.LAVA:
            return TerrainFlag.T_LAVA_INSTA_DEATH;
        case TileType.MUD:
            return TerrainFlag.T_ENTANGLES; // MUD terrain flag
        default:
            return 0;
    }
}
