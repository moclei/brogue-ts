/*
 *  monster-state.ts — Monster state updates, status effects, terrain avoidance
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: empowerMonster, chooseNewWanderDestination, monsterAvoids,
 *             alertMonster, wakeUp, updateMonsterState, decrementMonsterStatus,
 *             monsterFleesFrom, distanceBetween, cloneMonster
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos } from "../types/types.js";
import { StatusEffect, CreatureState, CreatureMode } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    TerrainFlag,
    TerrainMechFlag,
    T_HARMFUL_TERRAIN,
    T_RESPIRATION_IMMUNITIES,
} from "../types/flags.js";
import {
    monsterWillAttackTarget,
    monstersAreTeammates,
    monstersAreEnemies,
    attackWouldBeFutile,
    canSeeMonster,
    monsterName,
} from "./monster-queries.js";
import type { MonsterQueryContext } from "./monster-queries.js";
import { avoidedFlagsForMonster } from "./monster-spawning.js";

// ============================================================================
// State context — DI for map/game-dependent operations
// ============================================================================

/**
 * Context for monster state operations that need map, scent, or game data.
 */
export interface MonsterStateContext {
    /** The player creature. */
    player: Creature;
    /** All active (non-dormant) monsters. */
    monsters: Creature[];
    /** Random number generator */
    rng: {
        randRange(lo: number, hi: number): number;
        randPercent(pct: number): boolean;
    };
    /** Query context for visibility / name operations. */
    queryCtx: MonsterQueryContext;

    // ── Map access ──
    /** Check if cell has terrain flags. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Check if cell has terrain mechanics flags. */
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    /** Get terrain flags at a position. */
    terrainFlags(loc: Pos): number;
    /** Get cell flags at a position (HAS_MONSTER, HAS_PLAYER, etc.). */
    cellFlags(loc: Pos): number;
    /** Check if a position is within the map bounds. */
    isPosInMap(loc: Pos): boolean;
    /** The staircase positions. */
    downLoc: Pos;
    upLoc: Pos;

    // ── Creature queries ──
    /** Find the creature at a given location (including the player). */
    monsterAtLoc(loc: Pos): Creature | null;

    // ── Waypoint system ──
    /** Number of waypoints in the current level. */
    waypointCount: number;
    /** Maximum number of waypoints. */
    maxWaypointCount: number;
    /** Find the closest unvisited waypoint index for this monster. Returns -1 if none. */
    closestWaypointIndex(monst: Creature): number;
    /** Find the closest waypoint index to a given position. Returns -1 if none. */
    closestWaypointIndexTo(loc: Pos): number;

    // ── Terrain analysis ──
    /** Get terrain flags that would result from burning at this location. */
    burnedTerrainFlagsAtLoc(loc: Pos): number;
    /** Get terrain flags that would result from discovering secrets at this location. */
    discoveredTerrainFlagsAtLoc(loc: Pos): number;
    /** Count passable arcs around a position. */
    passableArcCount(x: number, y: number): number;

    // ── Awareness (for updateMonsterState) ──
    /** Check if an observer is aware of a target (scent-based). */
    awareOfTarget(observer: Creature, target: Creature): boolean;
    /** Check if there's an open path between two positions. */
    openPathBetween(loc1: Pos, loc2: Pos): boolean;
    /** Check if there's a traversible path between a monster and a location. */
    traversiblePathBetween(monst: Creature, x: number, y: number): boolean;
    /** Get player FOV flag at a position. */
    inFieldOfView(loc: Pos): boolean;

    // ── Side effects ──
    /** Heal a creature by a percentage. */
    heal(monst: Creature, percent: number, panacea: boolean): void;
    /** Inflict damage on a creature, returns true if creature dies. */
    inflictDamage(attacker: Creature | null, defender: Creature, damage: number): boolean;
    /** Kill a creature. */
    killCreature(monst: Creature, quiet: boolean): void;
    /** Extinguish fire on a creature. */
    extinguishFireOnCreature(monst: Creature): void;
    /** Make a monster drop its carried item. */
    makeMonsterDropItem(monst: Creature): void;
    /** Refresh a dungeon cell display. */
    refreshDungeonCell(loc: Pos): void;
    /** Display a message. */
    message(text: string, flags: number): void;
    /** Display a colored message. */
    messageWithColor(text: string, flags: number): void;
    /** Send a combat message. */
    combatMessage(text: string): void;
    /** Whether the player can see a location. */
    playerCanSee(x: number, y: number): boolean;

    // ── Player equipment (for monsterAvoids player-specific checks) ──
    /** Player's armor respiration check (for gas immunities). */
    playerHasRespirationArmor(): boolean;
    /** Map to shore distances (for fire/lava avoidance). null if not available. */
    mapToShore: number[][] | null;
    /** Pressure plate depressed flag value. */
    PRESSURE_PLATE_DEPRESSED: number;
    /** HAS_MONSTER flag value. */
    HAS_MONSTER: number;
    /** HAS_PLAYER flag value. */
    HAS_PLAYER: number;
    /** HAS_STAIRS flag value. */
    HAS_STAIRS: number;
    /** IN_FIELD_OF_VIEW flag value. */
    IN_FIELD_OF_VIEW: number;
    /** Check if a creature can submerge at its current location. */
    monsterCanSubmergeNow(monst: Creature): boolean;

    // ── Map dimensions ──
    DCOLS: number;
    DROWS: number;
}

// ============================================================================
// distanceBetween — Chebyshev distance
// ============================================================================

/**
 * Returns the Chebyshev distance between two positions (max of abs differences).
 *
 * Ported from distanceBetween() in Monsters.c.
 */
export function distanceBetween(loc1: Pos, loc2: Pos): number {
    return Math.max(Math.abs(loc1.x - loc2.x), Math.abs(loc1.y - loc2.y));
}

// ============================================================================
// alertMonster
// ============================================================================

/**
 * Sets a monster to tracking-scent state (or fleeing if permanent fleeing mode)
 * and records the player's last known position.
 *
 * Ported from alertMonster() in Monsters.c.
 */
export function alertMonster(monst: Creature, player: Creature): void {
    monst.creatureState =
        monst.creatureMode === CreatureMode.PermFleeing
            ? CreatureState.Fleeing
            : CreatureState.TrackingScent;
    monst.lastSeenPlayerAt = { x: player.loc.x, y: player.loc.y };
}

// ============================================================================
// wakeUp
// ============================================================================

/**
 * Wakes a monster and all its teammates. Non-ally monsters begin tracking.
 *
 * Ported from wakeUp() in Monsters.c.
 */
export function wakeUp(monst: Creature, ctx: MonsterStateContext): void {
    if (monst.creatureState !== CreatureState.Ally) {
        alertMonster(monst, ctx.player);
    }
    monst.ticksUntilTurn = 100;

    for (const teammate of ctx.monsters) {
        if (
            monst !== teammate &&
            monstersAreTeammates(monst, teammate, ctx.player) &&
            teammate.creatureMode === CreatureMode.Normal
        ) {
            if (
                teammate.creatureState === CreatureState.Sleeping ||
                teammate.creatureState === CreatureState.Wandering
            ) {
                teammate.ticksUntilTurn = Math.max(100, teammate.ticksUntilTurn);
            }
            if (monst.creatureState !== CreatureState.Ally) {
                // teammate.creatureMode is already known to be Normal here,
                // so PermFleeing branch is unreachable (matches C behavior).
                teammate.creatureState = CreatureState.TrackingScent;
                updateMonsterState(teammate, ctx);
            }
        }
    }
}

// ============================================================================
// empowerMonster
// ============================================================================

/**
 * Boosts a monster's stats (HP, defense, accuracy, damage) and heals it fully.
 * Used when a monster absorbs an ally.
 *
 * Ported from empowerMonster() in Monsters.c.
 */
export function empowerMonster(monst: Creature, ctx: MonsterStateContext): void {
    monst.info.maxHP += 12;
    monst.info.defense += 10;
    monst.info.accuracy += 10;
    monst.info.damage.lowerBound += Math.max(1, Math.floor(monst.info.damage.lowerBound / 10));
    monst.info.damage.upperBound += Math.max(1, Math.floor(monst.info.damage.upperBound / 10));
    monst.newPowerCount++;
    monst.totalPowerCount++;
    ctx.heal(monst, 100, true);

    if (canSeeMonster(monst, ctx.queryCtx)) {
        const name = monsterName(monst, true, ctx.queryCtx);
        ctx.combatMessage(`${name} looks stronger`);
    }
}

// ============================================================================
// chooseNewWanderDestination
// ============================================================================

/**
 * Selects a new waypoint target for a wandering monster.
 * Randomly clears two visited flags and marks the current target as visited,
 * then picks the closest unvisited waypoint.
 *
 * Ported from chooseNewWanderDestination() in Monsters.c.
 */
export function chooseNewWanderDestination(monst: Creature, ctx: MonsterStateContext): void {
    const wpCount = ctx.waypointCount;
    if (wpCount <= 0) return;

    // Set two random checkpoints to false (equilibrates to 50% active)
    monst.waypointAlreadyVisited[ctx.rng.randRange(0, wpCount - 1)] = false;
    monst.waypointAlreadyVisited[ctx.rng.randRange(0, wpCount - 1)] = false;

    // Mark current target as visited
    if (monst.targetWaypointIndex >= 0) {
        monst.waypointAlreadyVisited[monst.targetWaypointIndex] = true;
    }

    monst.targetWaypointIndex = ctx.closestWaypointIndex(monst);
    if (monst.targetWaypointIndex === -1) {
        // Reset all visited flags and try again
        for (let i = 0; i < wpCount; i++) {
            monst.waypointAlreadyVisited[i] = false;
        }
        monst.targetWaypointIndex = ctx.closestWaypointIndex(monst);
    }
}

// ============================================================================
// monsterFleesFrom
// ============================================================================

/**
 * Determines if a monster will flee from another creature.
 * Considers damage immunity, maintains-distance behavior, kamikaze targets,
 * poison effectiveness, and sacrifice markers.
 *
 * Ported from monsterFleesFrom() in Monsters.c.
 */
export function monsterFleesFrom(
    monst: Creature,
    defender: Creature,
    player: Creature,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    if (!monsterWillAttackTarget(defender, monst, player, cellHasTerrainFlag)) {
        return false;
    }
    if (distanceBetween(monst.loc, defender.loc) >= 4) {
        return false;
    }
    if (
        (defender.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
        !(defender.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)
    ) {
        return true;
    }
    if (
        monst.creatureState === CreatureState.Ally &&
        !monst.status[StatusEffect.Discordant] &&
        (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_MARKED_FOR_SACRIFICE)
    ) {
        return true;
    }
    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE) ||
        (defender.info.abilityFlags & MonsterAbilityFlag.MA_KAMIKAZE)
    ) {
        return true;
    }
    if (
        (monst.info.abilityFlags & MonsterAbilityFlag.MA_POISONS) &&
        defender.status[StatusEffect.Poisoned] * defender.poisonAmount > defender.currentHP
    ) {
        return true;
    }
    return false;
}

// ============================================================================
// monsterAvoids
// ============================================================================

/**
 * Determines if a monster should avoid a given map position.
 * Considers terrain hazards, monster immunities, enemies, traps, and
 * corridor-avoidance behavior.
 *
 * Ported from monsterAvoids() in Monsters.c.
 */
export function monsterAvoids(
    monst: Creature,
    p: Pos,
    ctx: MonsterStateContext,
): boolean {
    const tFlags = ctx.terrainFlags(p);
    const cFlags = ctx.cellFlags(p);

    // Everyone but the player avoids the stairs
    if (
        (p.x === ctx.downLoc.x && p.y === ctx.downLoc.y) ||
        (p.x === ctx.upLoc.x && p.y === ctx.upLoc.y)
    ) {
        return monst !== ctx.player;
    }

    // Dry land — restricted-to-liquid monsters avoid non-submerging terrain
    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
        !ctx.cellHasTMFlag(p, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
    ) {
        return true;
    }

    // Non-allied monsters can always attack the player
    if (
        ctx.player.loc.x === p.x &&
        ctx.player.loc.y === p.y &&
        monst !== ctx.player &&
        monst.creatureState !== CreatureState.Ally
    ) {
        return false;
    }

    // Walls
    if (tFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) {
        if (
            monst !== ctx.player &&
            ctx.cellHasTMFlag(p, TerrainMechFlag.TM_IS_SECRET) &&
            !(ctx.discoveredTerrainFlagsAtLoc(p) & avoidedFlagsForMonster(monst.info))
        ) {
            // Monsters can use secret doors but won't embed in secret levers
            return false;
        }
        if (distanceBetween(monst.loc, p) <= 1) {
            const defender = ctx.monsterAtLoc(p);
            if (defender && (defender.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)) {
                return false;
            }
        }
        return true;
    }

    // Monsters can always attack unfriendly neighboring monsters
    // unless it is immune to us for whatever reason
    if (distanceBetween(monst.loc, p) <= 1) {
        const defender = ctx.monsterAtLoc(p);
        if (
            defender &&
            !(defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
            monsterWillAttackTarget(monst, defender, ctx.player, ctx.cellHasTerrainFlag)
        ) {
            if (attackWouldBeFutile(monst, defender, ctx.player, ctx.cellHasTerrainFlag)) {
                return true;
            } else {
                return false;
            }
        }
    }

    // Monsters always avoid enemy monsters that can't be damaged
    const defenderAtP = ctx.monsterAtLoc(p);
    if (
        defenderAtP &&
        !(defenderAtP.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
        monstersAreEnemies(monst, defenderAtP, ctx.player, ctx.cellHasTerrainFlag) &&
        attackWouldBeFutile(monst, defenderAtP, ctx.player, ctx.cellHasTerrainFlag)
    ) {
        return true;
    }

    // Hidden terrain — player won't avoid what they don't know about
    if (ctx.cellHasTMFlag(p, TerrainMechFlag.TM_IS_SECRET) && monst === ctx.player) {
        return false;
    }

    // Determine invulnerabilities based only on monster characteristics
    let terrainImmunities = 0;
    if (monst.status[StatusEffect.ImmuneToFire]) {
        terrainImmunities |= TerrainFlag.T_IS_FIRE | TerrainFlag.T_SPONTANEOUSLY_IGNITES | TerrainFlag.T_LAVA_INSTA_DEATH;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) {
        terrainImmunities |= T_HARMFUL_TERRAIN | TerrainFlag.T_ENTANGLES |
            TerrainFlag.T_SPONTANEOUSLY_IGNITES | TerrainFlag.T_LAVA_INSTA_DEATH;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) {
        terrainImmunities |= TerrainFlag.T_CAUSES_DAMAGE | TerrainFlag.T_CAUSES_PARALYSIS |
            TerrainFlag.T_CAUSES_CONFUSION | TerrainFlag.T_CAUSES_NAUSEA | TerrainFlag.T_CAUSES_POISON;
    }
    if (monst.status[StatusEffect.Levitating]) {
        terrainImmunities |= TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_CAUSES_POISON |
            TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_IS_DF_TRAP | TerrainFlag.T_LAVA_INSTA_DEATH;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS) {
        terrainImmunities |= TerrainFlag.T_ENTANGLES;
    }
    if (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WATER) {
        terrainImmunities |= TerrainFlag.T_IS_DEEP_WATER;
    }
    if (monst === ctx.player) {
        terrainImmunities |= TerrainFlag.T_SACRED;
    }
    if (monst === ctx.player && ctx.playerHasRespirationArmor()) {
        terrainImmunities |= T_RESPIRATION_IMMUNITIES;
    }

    // Sacred ground
    if (tFlags & TerrainFlag.T_SACRED & ~terrainImmunities) {
        return true;
    }

    // Brimstone
    if (
        !(monst.status[StatusEffect.ImmuneToFire]) &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) &&
        (tFlags & TerrainFlag.T_SPONTANEOUSLY_IGNITES) &&
        !(cFlags & (ctx.HAS_MONSTER | ctx.HAS_PLAYER)) &&
        !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_IS_FIRE | TerrainFlag.T_SPONTANEOUSLY_IGNITES) &&
        (monst === ctx.player || (monst.creatureState !== CreatureState.TrackingScent && monst.creatureState !== CreatureState.Fleeing))
    ) {
        return true;
    }

    // Burning wandering monsters avoid flammable terrain
    if (
        monst !== ctx.player &&
        monst.creatureState === CreatureState.Wandering &&
        (monst.info.flags & MonsterBehaviorFlag.MONST_FIERY) &&
        (tFlags & TerrainFlag.T_IS_FLAMMABLE)
    ) {
        return true;
    }

    // Burning monsters avoid explosive terrain and steam-emitting terrain
    if (
        monst !== ctx.player &&
        monst.status[StatusEffect.Burning] &&
        (ctx.burnedTerrainFlagsAtLoc(p) &
            (TerrainFlag.T_CAUSES_EXPLOSIVE_DAMAGE | TerrainFlag.T_CAUSES_DAMAGE | TerrainFlag.T_AUTO_DESCENT) &
            ~terrainImmunities)
    ) {
        return true;
    }

    // Fire
    if (
        (tFlags & TerrainFlag.T_IS_FIRE & ~terrainImmunities) &&
        !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_IS_FIRE) &&
        !(cFlags & (ctx.HAS_MONSTER | ctx.HAS_PLAYER)) &&
        (monst !== ctx.player ||
            (ctx.mapToShore && ctx.mapToShore[p.x][p.y] >= ctx.player.status[StatusEffect.ImmuneToFire]))
    ) {
        return true;
    }

    // Non-fire harmful terrain
    if (
        (tFlags & T_HARMFUL_TERRAIN & ~TerrainFlag.T_IS_FIRE & ~terrainImmunities) &&
        !ctx.cellHasTerrainFlag(monst.loc, T_HARMFUL_TERRAIN & ~TerrainFlag.T_IS_FIRE)
    ) {
        return true;
    }

    // Chasms or trap doors
    if (
        (tFlags & TerrainFlag.T_AUTO_DESCENT & ~terrainImmunities) &&
        (!(tFlags & TerrainFlag.T_ENTANGLES) || !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS))
    ) {
        return true;
    }

    // Gas or other environmental traps
    if (
        (tFlags & TerrainFlag.T_IS_DF_TRAP & ~terrainImmunities) &&
        !(cFlags & ctx.PRESSURE_PLATE_DEPRESSED) &&
        (monst === ctx.player ||
            monst.creatureState === CreatureState.Wandering ||
            (monst.creatureState === CreatureState.Ally && !ctx.cellHasTMFlag(p, TerrainMechFlag.TM_IS_SECRET))) &&
        !monst.status[StatusEffect.Entranced] &&
        (!(tFlags & TerrainFlag.T_ENTANGLES) || !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS))
    ) {
        return true;
    }

    // Lava
    if (
        (tFlags & TerrainFlag.T_LAVA_INSTA_DEATH & ~terrainImmunities) &&
        (!(tFlags & TerrainFlag.T_ENTANGLES) || !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS)) &&
        (monst !== ctx.player ||
            (ctx.mapToShore &&
                ctx.mapToShore[p.x][p.y] >= Math.max(
                    ctx.player.status[StatusEffect.ImmuneToFire],
                    ctx.player.status[StatusEffect.Levitating],
                )))
    ) {
        return true;
    }

    // Deep water
    if (
        (tFlags & TerrainFlag.T_IS_DEEP_WATER & ~terrainImmunities) &&
        (!(tFlags & TerrainFlag.T_ENTANGLES) || !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS)) &&
        !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_IS_DEEP_WATER)
    ) {
        return true;
    }

    // Poisonous lichen
    if (
        (tFlags & TerrainFlag.T_CAUSES_POISON & ~terrainImmunities) &&
        !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_CAUSES_POISON) &&
        (monst === ctx.player ||
            monst.creatureState !== CreatureState.TrackingScent ||
            monst.currentHP < 10)
    ) {
        return true;
    }

    // Smart monsters don't attack in corridors if they have a group
    if (
        (monst.info.abilityFlags & MonsterAbilityFlag.MA_AVOID_CORRIDORS) &&
        !(monst.status[StatusEffect.Enraged] && monst.currentHP <= Math.floor(monst.info.maxHP / 2)) &&
        monst.creatureState === CreatureState.TrackingScent &&
        (monst.bookkeepingFlags & (MonsterBookkeepingFlag.MB_FOLLOWER | MonsterBookkeepingFlag.MB_LEADER)) &&
        ctx.passableArcCount(p.x, p.y) >= 2 &&
        ctx.passableArcCount(monst.loc.x, monst.loc.y) < 2 &&
        !ctx.cellHasTerrainFlag(monst.loc, T_HARMFUL_TERRAIN & ~terrainImmunities)
    ) {
        return true;
    }

    return false;
}

// ============================================================================
// updateMonsterState
// ============================================================================

/**
 * Updates a monster's behavioral state based on awareness of the player,
 * proximity to feared enemies, health, and mode.
 *
 * Ported from updateMonsterState() in Monsters.c.
 */
export function updateMonsterState(monst: Creature, ctx: MonsterStateContext): void {
    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_HUNTING) &&
        monst.creatureState !== CreatureState.Ally
    ) {
        monst.creatureState = CreatureState.TrackingScent;
        return;
    }

    const awareOfPlayer = ctx.awareOfTarget(monst, ctx.player);

    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE) &&
        monst.creatureState !== CreatureState.Ally
    ) {
        monst.creatureState = awareOfPlayer
            ? CreatureState.TrackingScent
            : CreatureState.Sleeping;
        return;
    }

    if (
        monst.creatureMode === CreatureMode.PermFleeing &&
        (monst.creatureState === CreatureState.Wandering || monst.creatureState === CreatureState.TrackingScent)
    ) {
        monst.creatureState = CreatureState.Fleeing;
    }

    let closestFearedEnemy = ctx.DCOLS + ctx.DROWS;

    // Check all creatures (including the player) for feared enemies
    const allCreatures = [ctx.player, ...ctx.monsters];
    for (const monst2 of allCreatures) {
        if (
            monsterFleesFrom(monst, monst2, ctx.player, ctx.cellHasTerrainFlag) &&
            distanceBetween(monst.loc, monst2.loc) < closestFearedEnemy &&
            ctx.traversiblePathBetween(monst2, monst.loc.x, monst.loc.y) &&
            ctx.openPathBetween(monst.loc, monst2.loc)
        ) {
            closestFearedEnemy = distanceBetween(monst.loc, monst2.loc);
        }
    }

    if (
        monst.creatureState === CreatureState.Wandering &&
        awareOfPlayer &&
        ctx.inFieldOfView(ctx.player.loc)
    ) {
        // Wandering and noticed the player — start tracking
        alertMonster(monst, ctx.player);
    } else if (monst.creatureState === CreatureState.Sleeping) {
        // Sleeping — chance to awaken
        if (awareOfPlayer) {
            wakeUp(monst, ctx);
        }
    } else if (monst.creatureState === CreatureState.TrackingScent && !awareOfPlayer) {
        // Tracking scent but lost awareness — start wandering
        monst.creatureState = CreatureState.Wandering;
        wanderToward(monst, monst.lastSeenPlayerAt, ctx);
    } else if (
        monst.creatureState === CreatureState.TrackingScent &&
        closestFearedEnemy < 3
    ) {
        monst.creatureState = CreatureState.Fleeing;
    } else if (
        monst.creatureState !== CreatureState.Ally &&
        (monst.info.flags & MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH) &&
        monst.currentHP <= Math.floor(3 * monst.info.maxHP / 4)
    ) {
        if (
            monst.creatureState === CreatureState.Fleeing ||
            monst.currentHP <= Math.floor(monst.info.maxHP / 4)
        ) {
            monst.creatureState = CreatureState.Fleeing;
        }
    } else if (
        monst.creatureMode === CreatureMode.Normal &&
        monst.creatureState === CreatureState.Fleeing &&
        !monst.status[StatusEffect.MagicalFear] &&
        closestFearedEnemy >= 3
    ) {
        monst.creatureState = CreatureState.TrackingScent;
    } else if (
        monst.creatureMode === CreatureMode.PermFleeing &&
        monst.creatureState === CreatureState.Fleeing &&
        (monst.info.abilityFlags & MonsterAbilityFlag.MA_HIT_STEAL_FLEE) &&
        !monst.status[StatusEffect.MagicalFear] &&
        !monst.carriedItem
    ) {
        monst.creatureMode = CreatureMode.Normal;
        if (monst.leader === ctx.player) {
            monst.creatureState = CreatureState.Ally;
        } else {
            alertMonster(monst, ctx.player);
        }
    } else if (
        monst.creatureMode === CreatureMode.Normal &&
        monst.creatureState === CreatureState.Fleeing &&
        (monst.info.flags & MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH) &&
        !monst.status[StatusEffect.MagicalFear] &&
        monst.currentHP >= Math.floor(monst.info.maxHP * 3 / 4)
    ) {
        if (
            (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
            monst.leader === ctx.player
        ) {
            monst.creatureState = CreatureState.Ally;
        } else {
            alertMonster(monst, ctx.player);
        }
    }

    if (awareOfPlayer) {
        if (
            monst.creatureState === CreatureState.Fleeing ||
            monst.creatureState === CreatureState.TrackingScent
        ) {
            monst.lastSeenPlayerAt = { x: ctx.player.loc.x, y: ctx.player.loc.y };
        }
    }
}

// ============================================================================
// decrementMonsterStatus
// ============================================================================

/**
 * Ticks down all status effects on a monster each turn.
 * Handles regen, burning damage, poison damage, lifespan expiry,
 * haste/slow speed resets, shield decay, invisibility reveal, etc.
 *
 * Ported from decrementMonsterStatus() in Monsters.c.
 */
export function decrementMonsterStatus(monst: Creature, ctx: MonsterStateContext): boolean {
    monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_JUST_SUMMONED;

    // Regeneration
    if (
        monst.currentHP < monst.info.maxHP &&
        monst.info.turnsBetweenRegen > 0 &&
        !monst.status[StatusEffect.Poisoned]
    ) {
        monst.turnsUntilRegen -= 1000;
        if (monst.turnsUntilRegen <= 0) {
            monst.currentHP++;
            monst.previousHealthPoints++;
            monst.turnsUntilRegen += monst.info.turnsBetweenRegen * 1000;
        }
    }

    for (let i = 0; i < monst.status.length; i++) {
        switch (i) {
            case StatusEffect.Levitating:
                if (monst.status[i] && !(monst.info.flags & MonsterBehaviorFlag.MONST_FLIES)) {
                    monst.status[i]--;
                }
                break;

            case StatusEffect.Slowed:
                if (monst.status[i] && !--monst.status[i]) {
                    monst.movementSpeed = monst.info.movementSpeed;
                    monst.attackSpeed = monst.info.attackSpeed;
                }
                break;

            case StatusEffect.Weakened:
                if (monst.status[i] && !--monst.status[i]) {
                    monst.weaknessAmount = 0;
                }
                break;

            case StatusEffect.Hasted:
                if (monst.status[i]) {
                    if (!--monst.status[i]) {
                        monst.movementSpeed = monst.info.movementSpeed;
                        monst.attackSpeed = monst.info.attackSpeed;
                    }
                }
                break;

            case StatusEffect.Burning:
                if (monst.status[i]) {
                    if (!(monst.info.flags & MonsterBehaviorFlag.MONST_FIERY)) {
                        monst.status[i]--;
                    }
                    const damage = ctx.rng.randRange(1, 3);
                    if (
                        !monst.status[StatusEffect.ImmuneToFire] &&
                        !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) &&
                        ctx.inflictDamage(null, monst, damage)
                    ) {
                        if (canSeeMonster(monst, ctx.queryCtx)) {
                            const name = monsterName(monst, true, ctx.queryCtx);
                            const deathWord = (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "up" : "to death";
                            ctx.messageWithColor(`${name} burns ${deathWord}.`, 0);
                        }
                        ctx.killCreature(monst, false);
                        return true; // monster died
                    }
                    if (monst.status[i] <= 0) {
                        ctx.extinguishFireOnCreature(monst);
                    }
                }
                break;

            case StatusEffect.LifespanRemaining:
                if (monst.status[i]) {
                    monst.status[i]--;
                    if (monst.status[i] <= 0) {
                        ctx.killCreature(monst, false);
                        if (canSeeMonster(monst, ctx.queryCtx)) {
                            const name = monsterName(monst, true, ctx.queryCtx);
                            ctx.messageWithColor(`${name} dissipates into thin air.`, 0);
                        }
                        return true; // monster died
                    }
                }
                break;

            case StatusEffect.Poisoned:
                if (monst.status[i]) {
                    monst.status[i]--;
                    if (ctx.inflictDamage(null, monst, monst.poisonAmount)) {
                        if (canSeeMonster(monst, ctx.queryCtx)) {
                            const name = monsterName(monst, true, ctx.queryCtx);
                            ctx.messageWithColor(`${name} dies of poison.`, 0);
                        }
                        ctx.killCreature(monst, false);
                        return true; // monster died
                    }
                    if (!monst.status[i]) {
                        monst.poisonAmount = 0;
                    }
                }
                break;

            case StatusEffect.Stuck:
                if (monst.status[i] && !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_ENTANGLES)) {
                    monst.status[i] = 0;
                }
                break;

            case StatusEffect.Discordant:
                if (monst.status[i] && !--monst.status[i]) {
                    if (
                        monst.creatureState === CreatureState.Fleeing &&
                        !monst.status[StatusEffect.MagicalFear] &&
                        monst.leader === ctx.player
                    ) {
                        monst.creatureState = CreatureState.Ally;
                        if (monst.carriedItem) {
                            ctx.makeMonsterDropItem(monst);
                        }
                    }
                }
                break;

            case StatusEffect.MagicalFear:
                if (monst.status[i]) {
                    if (!--monst.status[i]) {
                        monst.creatureState =
                            monst.leader === ctx.player
                                ? CreatureState.Ally
                                : CreatureState.TrackingScent;
                    }
                }
                break;

            case StatusEffect.Shielded:
                monst.status[i] -= Math.floor(monst.maxStatus[i] / 20);
                if (monst.status[i] <= 0) {
                    monst.status[i] = 0;
                    monst.maxStatus[i] = 0;
                }
                break;

            case StatusEffect.ImmuneToFire:
                if (monst.status[i] && !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE)) {
                    monst.status[i]--;
                }
                break;

            case StatusEffect.Invisible:
                if (
                    monst.status[i] &&
                    !(monst.info.flags & MonsterBehaviorFlag.MONST_INVISIBLE) &&
                    !--monst.status[i] &&
                    ctx.playerCanSee(monst.loc.x, monst.loc.y)
                ) {
                    ctx.refreshDungeonCell(monst.loc);
                }
                break;

            default:
                if (monst.status[i]) {
                    monst.status[i]--;
                }
                break;
        }
    }

    // Submersion check
    if (ctx.monsterCanSubmergeNow(monst) && !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) {
        if (ctx.rng.randPercent(20)) {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
            if (
                !monst.status[StatusEffect.MagicalFear] &&
                monst.creatureState === CreatureState.Fleeing &&
                (!(monst.info.flags & MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH) ||
                    monst.currentHP >= Math.floor(monst.info.maxHP * 3 / 4))
            ) {
                monst.creatureState = CreatureState.TrackingScent;
            }
            ctx.refreshDungeonCell(monst.loc);
        } else if (
            (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
            monst.creatureState !== CreatureState.Ally
        ) {
            monst.creatureState = CreatureState.Fleeing;
        }
    }

    return false; // monster survived
}

// ============================================================================
// wanderToward — internal helper
// ============================================================================

/**
 * Sets a monster to wander toward a given destination by finding the closest
 * waypoint to that destination.
 *
 * Ported from wanderToward() in Monsters.c.
 */
function wanderToward(monst: Creature, destination: Pos, ctx: MonsterStateContext): void {
    if (ctx.isPosInMap(destination)) {
        const waypointIndex = ctx.closestWaypointIndexTo(destination);
        if (waypointIndex !== -1) {
            monst.waypointAlreadyVisited[waypointIndex] = false;
            monst.targetWaypointIndex = waypointIndex;
        }
    }
}
