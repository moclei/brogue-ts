/*
 *  monster-actions.ts — Monster actions, status negation, summoning, turn logic
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: prependCreature, removeCreature, negateCreatureStatusEffects,
 *             canNegateCreatureStatusEffects, monsterSummons, monstersTurn
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature, Pos, StatusEffectInfo } from "../types/types.js";
import { StatusEffect, CreatureState } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    TerrainFlag,
    TerrainMechFlag,
    T_HARMFUL_TERRAIN,
} from "../types/flags.js";
import { distanceBetween } from "./monster-state.js";
import { getLineCoordinates } from "../items/bolt-geometry.js";

// ============================================================================
// Creature list management — array-based (no linked lists)
// ============================================================================

/**
 * Add a creature to the front of a creature array.
 * TypeScript equivalent of prependCreature() — uses Array.unshift.
 *
 * Ported from prependCreature() in Monsters.c.
 */
export function prependCreature(list: Creature[], creature: Creature): void {
    list.unshift(creature);
}

/**
 * Remove a creature from a creature array.
 * Returns true if the creature was found and removed.
 *
 * Ported from removeCreature() in Monsters.c.
 */
export function removeCreature(list: Creature[], creature: Creature): boolean {
    const idx = list.indexOf(creature);
    if (idx !== -1) {
        list.splice(idx, 1);
        return true;
    }
    return false;
}

// ============================================================================
// canNegateCreatureStatusEffects
// ============================================================================

/**
 * Checks if a creature has any negatable status effects.
 *
 * Ported from canNegateCreatureStatusEffects() in Monsters.c.
 */
export function canNegateCreatureStatusEffects(
    monst: Creature | null,
    statusEffectCatalog: readonly StatusEffectInfo[],
): boolean {
    if (!monst || (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        return false;
    }
    for (let i = 0; i < monst.status.length; i++) {
        if (monst.status[i] > 0 && statusEffectCatalog[i]?.isNegatable) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// negateCreatureStatusEffects
// ============================================================================

/**
 * Negates a creature's negatable status effects.
 * For the player, sets to playerNegatedValue; for monsters, sets to 0.
 *
 * Ported from negateCreatureStatusEffects() in Monsters.c.
 */
export function negateCreatureStatusEffects(
    monst: Creature | null,
    player: Creature,
    statusEffectCatalog: readonly StatusEffectInfo[],
    onDarknessNegated?: () => void,
): void {
    if (!monst || (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        return;
    }
    for (let i = 0; i < monst.status.length; i++) {
        if (monst.status[i] > 0 && statusEffectCatalog[i]?.isNegatable) {
            monst.status[i] = monst === player
                ? (statusEffectCatalog[i].playerNegatedValue ?? 0)
                : 0;
            if (i === StatusEffect.Darkness && monst === player && onDarknessNegated) {
                onDarknessNegated();
            }
        }
    }
}

// ============================================================================
// monsterSummons
// ============================================================================

/**
 * Context for the monsterSummons function.
 */
export interface MonsterSummonsContext {
    player: Creature;
    monsters: Creature[];
    rng: {
        randRange(lo: number, hi: number): number;
    };
    /** Count of allied monsters on adjacent depth levels. */
    adjacentLevelAllyCount: number;
    /** Deepest level in the game. */
    deepestLevel: number;
    /** Current depth level. */
    depthLevel: number;
    /** Actually perform the summoning. */
    summonMinions(monst: Creature): void;
}

/**
 * Determines if a monster should summon minions, and if so, performs the summon.
 * Returns true if the monster used its turn to summon.
 *
 * Ported from monsterSummons() in Monsters.c.
 */
export function monsterSummons(
    monst: Creature,
    alwaysUse: boolean,
    ctx: MonsterSummonsContext,
): boolean {
    if (!(monst.info.abilityFlags & MonsterAbilityFlag.MA_CAST_SUMMON)) {
        return false;
    }

    let minionCount = 0;

    // Count existing minions
    for (const target of ctx.monsters) {
        if (monst.creatureState === CreatureState.Ally) {
            if (target.creatureState === CreatureState.Ally) {
                minionCount++;
            }
        } else if (
            (target.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
            target.leader === monst
        ) {
            minionCount++;
        }
    }

    // Allied summoners also count monsters on adjacent depth levels
    if (monst.creatureState === CreatureState.Ally) {
        minionCount += ctx.adjacentLevelAllyCount;
    }

    if (alwaysUse && minionCount < 50) {
        ctx.summonMinions(monst);
        return true;
    } else if (monst.info.abilityFlags & MonsterAbilityFlag.MA_ENTER_SUMMONS) {
        if (!ctx.rng.randRange(0, 7)) {
            ctx.summonMinions(monst);
            return true;
        }
    } else if (
        (monst.creatureState !== CreatureState.Ally || minionCount < 5) &&
        !ctx.rng.randRange(0, minionCount * minionCount * 3 + 1)
    ) {
        ctx.summonMinions(monst);
        return true;
    }

    return false;
}

// ============================================================================
// Helper function stubs — monstUseMagic, monsterBlinkToPreferenceMap,
//   monsterBlinkToSafety
// These require deep magic / blink systems not yet ported.
// ============================================================================

/**
 * Stub: returns false — full magic casting not yet ported.
 */
export function monstUseMagicStub(_monst: Creature): boolean {
    return false;
}

/**
 * Stub: returns false — full blink-to-map not yet ported.
 */
export function monsterBlinkToPreferenceMapStub(
    _monst: Creature,
    _preferenceMap: number[][],
    _blinkUphill: boolean,
): boolean {
    return false;
}

/**
 * Stub: returns false — full blink-to-safety not yet ported.
 */
export function monsterBlinkToSafetyStub(_monst: Creature): boolean {
    return false;
}

// ============================================================================
// isValidWanderDestination — Monsters.c:1197
// ============================================================================

/**
 * Context interface for isValidWanderDestination.
 */
export interface WanderContext {
    waypointCount: number;
    waypointDistanceMap(index: number): number[][] | null;
    nextStep(map: number[][], loc: Pos, monst: Creature | null, includeMonsters: boolean): number;
    NO_DIRECTION: number;
}

/**
 * Returns true if wpIndex is a valid wander destination for this monster.
 * The waypoint must be reachable and not already visited.
 *
 * Ported from isValidWanderDestination() in Monsters.c.
 */
export function isValidWanderDestination(
    monst: Creature,
    wpIndex: number,
    ctx: WanderContext,
): boolean {
    if (wpIndex < 0 || wpIndex >= ctx.waypointCount) {
        return false;
    }
    if (monst.waypointAlreadyVisited[wpIndex]) {
        return false;
    }
    const distMap = ctx.waypointDistanceMap(wpIndex);
    if (!distMap) {
        return false;
    }
    if (distMap[monst.loc.x][monst.loc.y] < 0) {
        return false;
    }
    if (ctx.nextStep(distMap, monst.loc, monst, false) === ctx.NO_DIRECTION) {
        return false;
    }
    return true;
}

// ============================================================================
// wanderToward — Monsters.c:1699
// ============================================================================

/**
 * Context for wanderToward.
 */
export interface WanderTowardContext {
    DCOLS: number;
    DROWS: number;
    waypointCount: number;
    waypointDistanceMap(index: number): number[][] | null;
    closestWaypointIndexTo(loc: Pos): number;
}

/**
 * Sets the monster's target waypoint to the closest one near the given destination.
 *
 * Ported from wanderToward() in Monsters.c.
 */
export function wanderToward(
    monst: Creature,
    destination: Pos,
    ctx: WanderTowardContext,
): void {
    if (
        destination.x < 0 ||
        destination.x >= ctx.DCOLS ||
        destination.y < 0 ||
        destination.y >= ctx.DROWS
    ) {
        return;
    }
    const waypointIndex = ctx.closestWaypointIndexTo(destination);
    if (waypointIndex !== -1) {
        monst.waypointAlreadyVisited[waypointIndex] = false;
        monst.targetWaypointIndex = waypointIndex;
    }
}

// ============================================================================
// traversiblePathBetween — Monsters.c:1994
// ============================================================================

/**
 * Context for traversiblePathBetween.
 */
export interface TraversiblePathContext {
    monsterAvoids(monst: Creature, loc: Pos): boolean;
    DCOLS: number;
    DROWS: number;
}

/**
 * Returns true if a monster can traverse the path from its current location
 * to (x2, y2) using line-of-sight stepping without hitting avoided terrain.
 *
 * This port uses a simplified line-of-sight traversal (Bresenham-style)
 * rather than the full bolt-path algorithm from the C source.
 *
 * Ported from traversiblePathBetween() in Monsters.c.
 */
export function traversiblePathBetween(
    monst: Creature,
    x2: number,
    y2: number,
    ctx: TraversiblePathContext,
): boolean {
    const targetLoc = { x: x2, y: y2 };
    // C: getLineCoordinates(coords, originLoc, targetLoc, &boltCatalog[BOLT_NONE])
    // Uses fixed-point bolt-path geometry, not Bresenham.
    const coords = getLineCoordinates(monst.loc, targetLoc);

    for (const coord of coords) {
        if (coord.x === x2 && coord.y === y2) {
            return true;
        }
        if (ctx.monsterAvoids(monst, coord)) {
            return false;
        }
    }

    return true;
}

// ============================================================================
// pathTowardCreature — Monsters.c:2089
// ============================================================================

/**
 * Context for pathTowardCreature.
 */
export interface PathTowardCreatureContext {
    traversiblePathBetween(monst: Creature, x: number, y: number): boolean;
    distanceBetween(loc1: Pos, loc2: Pos): number;
    moveMonsterPassivelyTowards(monst: Creature, target: Pos, willingToAttackPlayer: boolean): boolean;
    monsterBlinkToPreferenceMap(monst: Creature, map: number[][], blinkUphill: boolean): boolean;
    nextStep(map: number[][], loc: Pos, monst: Creature | null, includeMonsters: boolean): number;
    randValidDirectionFrom(monst: Creature, x: number, y: number, allowDiag: boolean): number;
    nbDirs: readonly [number, number][];
    NO_DIRECTION: number;
    MONST_CAST_SPELLS_SLOWLY: number;
    monstersAreEnemies(m1: Creature, m2: Creature): boolean;
    allocGrid(): number[][];
    calculateDistances(grid: number[][], x: number, y: number, flags: number, monst: Creature, twoPass: boolean, checkTargetPassability: boolean): void;
    MB_GIVEN_UP_ON_SCENT: number;
}

/**
 * Moves a monster toward a target creature using either direct passive movement
 * (if a traversible path exists) or the target's distance map.
 *
 * Ported from pathTowardCreature() in Monsters.c.
 */
export function pathTowardCreature(
    monst: Creature,
    target: Creature,
    ctx: PathTowardCreatureContext,
): void {
    if (ctx.traversiblePathBetween(monst, target.loc.x, target.loc.y)) {
        if (ctx.distanceBetween(monst.loc, target.loc) <= 2) {
            monst.bookkeepingFlags &= ~ctx.MB_GIVEN_UP_ON_SCENT;
        }
        ctx.moveMonsterPassivelyTowards(monst, target.loc, monst.creatureState !== CreatureState.Ally);
        return;
    }

    // Ensure target has a distance map
    if (!target.mapToMe) {
        target.mapToMe = ctx.allocGrid();
        ctx.calculateDistances(target.mapToMe, target.loc.x, target.loc.y, 0, monst, true, false);
    }

    // Recalculate if map is stale
    if ((target.mapToMe as number[][])[target.loc.x][target.loc.y] > 3) {
        ctx.calculateDistances(target.mapToMe as number[][], target.loc.x, target.loc.y, 0, monst, true, false);
    }

    // Blink toward target if far or hostile
    if (
        ctx.distanceBetween(monst.loc, target.loc) > 10 ||
        ctx.monstersAreEnemies(monst, target)
    ) {
        if (ctx.monsterBlinkToPreferenceMap(monst, target.mapToMe as number[][], false)) {
            monst.ticksUntilTurn = monst.attackSpeed *
                ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
            return;
        }
    }

    // Follow the distance map
    let dir = ctx.nextStep(target.mapToMe as number[][], monst.loc, monst, true);
    if (dir === ctx.NO_DIRECTION) {
        dir = ctx.randValidDirectionFrom(monst, monst.loc.x, monst.loc.y, true);
    }
    if (dir === ctx.NO_DIRECTION) {
        return; // blocked
    }
    const targetLoc: Pos = {
        x: monst.loc.x + ctx.nbDirs[dir][0],
        y: monst.loc.y + ctx.nbDirs[dir][1],
    };
    ctx.moveMonsterPassivelyTowards(monst, targetLoc, monst.creatureState !== CreatureState.Ally);
}

// ============================================================================
// isLocalScentMaximum — Monsters.c:2817
// ============================================================================

/**
 * Context for isLocalScentMaximum.
 */
export interface LocalScentContext {
    scentMap: number[][];
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;
    coordinatesAreInMap(x: number, y: number): boolean;
    nbDirs: readonly [number, number][];
    DIRECTION_COUNT: number;
}

/**
 * Returns true if the scent at loc is >= the scent in every accessible adjacent cell.
 * Used to detect when a monster is stuck at a local scent peak.
 *
 * Ported from isLocalScentMaximum() in Monsters.c.
 */
export function isLocalScentMaximum(loc: Pos, ctx: LocalScentContext): boolean {
    const baselineScent = ctx.scentMap[loc.x][loc.y];
    for (let dir = 0; dir < ctx.DIRECTION_COUNT; dir++) {
        const newLoc: Pos = {
            x: loc.x + ctx.nbDirs[dir][0],
            y: loc.y + ctx.nbDirs[dir][1],
        };
        if (
            ctx.coordinatesAreInMap(newLoc.x, newLoc.y) &&
            ctx.scentMap[newLoc.x][newLoc.y] > baselineScent &&
            !ctx.cellHasTerrainFlag(newLoc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
            !ctx.diagonalBlocked(loc.x, loc.y, newLoc.x, newLoc.y, false)
        ) {
            return false;
        }
    }
    return true;
}

// ============================================================================
// scentDirection — Monsters.c:2833
// ============================================================================

/**
 * Context for scentDirection.
 */
export interface ScentDirectionContext {
    scentMap: number[][];
    coordinatesAreInMap(x: number, y: number): boolean;
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    cellFlags(loc: Pos): number;
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;
    monsterAvoids(monst: Creature, loc: Pos): boolean;
    monsterAtLoc(loc: Pos): Creature | null;
    canPass(mover: Creature, blocker: Creature): boolean;
    nbDirs: readonly [number, number][];
    NO_DIRECTION: number;
    DIRECTION_COUNT: number;
    HAS_MONSTER: number;
    HAS_PLAYER: number;
}

/**
 * Returns the direction index toward the strongest adjacent scent cell,
 * or NO_DIRECTION if no higher-scent adjacent cell is reachable.
 * On first failure, diffuses scent through cardinal neighbors and retries once.
 *
 * Ported from scentDirection() in Monsters.c.
 */
export function scentDirection(monst: Creature, ctx: ScentDirectionContext): number {
    const x = monst.loc.x;
    const y = monst.loc.y;

    let canTryAgain = true;

    for (;;) {
        let bestDirection = ctx.NO_DIRECTION;
        let bestNearbyScent = 0;

        for (let dir = 0; dir < ctx.DIRECTION_COUNT; dir++) {
            const newX = x + ctx.nbDirs[dir][0];
            const newY = y + ctx.nbDirs[dir][1];
            const otherMonst = ctx.monsterAtLoc({ x: newX, y: newY });
            if (
                ctx.coordinatesAreInMap(newX, newY) &&
                ctx.scentMap[newX][newY] > bestNearbyScent &&
                (!(ctx.cellFlags({ x: newX, y: newY }) & ctx.HAS_MONSTER) ||
                    (otherMonst !== null && ctx.canPass(monst, otherMonst))) &&
                !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                !ctx.diagonalBlocked(x, y, newX, newY, false) &&
                !ctx.monsterAvoids(monst, { x: newX, y: newY })
            ) {
                bestNearbyScent = ctx.scentMap[newX][newY];
                bestDirection = dir;
            }
        }

        if (bestDirection >= 0 && bestNearbyScent > ctx.scentMap[x][y]) {
            return bestDirection;
        }

        if (canTryAgain) {
            // Diffuse scent through cardinal neighbors to resolve diagonal kinks
            canTryAgain = false;
            for (let dir = 0; dir < 4; dir++) {
                const newX = x + ctx.nbDirs[dir][0];
                const newY = y + ctx.nbDirs[dir][1];
                for (let dir2 = 0; dir2 < 4; dir2++) {
                    const newestX = newX + ctx.nbDirs[dir2][0];
                    const newestY = newY + ctx.nbDirs[dir2][1];
                    if (ctx.coordinatesAreInMap(newX, newY) && ctx.coordinatesAreInMap(newestX, newestY)) {
                        ctx.scentMap[newX][newY] = Math.max(
                            ctx.scentMap[newX][newY],
                            ctx.scentMap[newestX][newestY] - 1,
                        );
                    }
                }
            }
        } else {
            return ctx.NO_DIRECTION;
        }
    }
}

// ============================================================================
// monsterMillAbout — Monsters.c:3019
// ============================================================================

/**
 * Context for monsterMillAbout.
 */
export interface MonsterMillAboutContext {
    rng: {
        randPercent(pct: number): boolean;
    };
    randValidDirectionFrom(monst: Creature, x: number, y: number, allowDiag: boolean): number;
    moveMonsterPassivelyTowards(monst: Creature, target: Pos, willingToAttackPlayer: boolean): boolean;
    nbDirs: readonly [number, number][];
    NO_DIRECTION: number;
}

/**
 * Randomly moves the monster one step with a given chance (movementChance%).
 *
 * Ported from monsterMillAbout() in Monsters.c.
 */
export function monsterMillAbout(
    monst: Creature,
    movementChance: number,
    ctx: MonsterMillAboutContext,
): void {
    if (ctx.rng.randPercent(movementChance)) {
        const dir = ctx.randValidDirectionFrom(monst, monst.loc.x, monst.loc.y, true);
        if (dir !== ctx.NO_DIRECTION) {
            const targetLoc: Pos = {
                x: monst.loc.x + ctx.nbDirs[dir][0],
                y: monst.loc.y + ctx.nbDirs[dir][1],
            };
            ctx.moveMonsterPassivelyTowards(monst, targetLoc, false);
        }
    }
}

// ============================================================================
// moveAlly — Monsters.c:3040
// ============================================================================

/**
 * Context for moveAlly.
 */
export interface MoveAllyContext {
    player: Creature;
    monsters: Creature[];
    rng: {
        randPercent(pct: number): boolean;
    };

    // Terrain
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    T_HARMFUL_TERRAIN: number;
    T_IS_FIRE: number;
    T_CAUSES_DAMAGE: number;
    T_CAUSES_PARALYSIS: number;
    T_CAUSES_CONFUSION: number;
    MONST_INANIMATE: number;
    MONST_INVULNERABLE: number;
    MONST_CAST_SPELLS_SLOWLY: number;
    MONST_ALWAYS_USE_ABILITY: number;
    MONST_ALWAYS_HUNTING: number;

    // Safety map
    mapToSafeTerrain: number[][] | null;
    updatedMapToSafeTerrainThisTurn: boolean;
    updateSafeTerrainMap(): void;

    // Movement
    monsterWillAttackTarget(monst: Creature, target: Creature): boolean;
    traversiblePathBetween(monst: Creature, x: number, y: number): boolean;
    moveMonster(monst: Creature, dx: number, dy: number): boolean;
    moveMonsterPassivelyTowards(monst: Creature, target: Pos, willingToAttackPlayer: boolean): boolean;
    monsterBlinkToPreferenceMap(monst: Creature, map: number[][], blinkUphill: boolean): boolean;
    monsterBlinkToSafety(monst: Creature): boolean;
    monstUseMagic(monst: Creature): boolean;
    monsterSummons(monst: Creature, alwaysUse: boolean): boolean;
    nextStep(map: number[][], loc: Pos, monst: Creature | null, includeMonsters: boolean): number;
    randValidDirectionFrom(monst: Creature, x: number, y: number, allowDiag: boolean): number;
    pathTowardCreature(monst: Creature, target: Creature): void;
    nbDirs: readonly [number, number][];
    NO_DIRECTION: number;
    DCOLS: number;
    DROWS: number;
    allyFlees(monst: Creature, closestMonster: Creature | null): boolean;

    // Leash/rest state
    justRested: boolean;
    justSearched: boolean;
    MB_SEIZED: number;
    MB_FOLLOWER: number;
    MB_SUBMERGED: number;
    MB_DOES_NOT_TRACK_LEADER: number;
    STATUS_INVISIBLE: number;
    STATUS_IMMUNE_TO_FIRE: number;
    MONST_MAINTAINS_DISTANCE: number;
    MONST_FLITS: number;
    MONST_IMMOBILE: number;
    MONSTER_TRACKING_SCENT: number;
    attackWouldBeFutile(monst: Creature, target: Creature): boolean;
    monsterHasBoltEffect(monst: Creature, effectType: number): number;
    BE_BLINKING: number;

    allySafetyMap: number[][];
    distanceBetween(loc1: Pos, loc2: Pos): number;

    // Corpse-eating branch (C:3208)
    isPosInMap(pos: Pos): boolean;
    STATUS_POISONED: number;
    STATUS_BURNING: number;
    canSeeMonster(monst: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    getMonsterAbsorbingText(monst: Creature): string;
    goodMessageColor: Readonly<Color>;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void | Promise<void>;
    MB_ABSORBING: number;

    // Mill-about / scent-follow (C:3222)
    inFieldOfView(loc: Pos): boolean;
    monsterMillAbout(monst: Creature, chance: number): void;
    MB_GIVEN_UP_ON_SCENT: number;
    scentMap: number[][];
    scentDirection(monst: Creature): number;
}

/**
 * Handles the given allied monster's turn under normal circumstances.
 *
 * Ported from moveAlly() in Monsters.c.
 */
export function moveAlly(monst: Creature, ctx: MoveAllyContext): void {
    const x = monst.loc.x;
    const y = monst.loc.y;

    if (!monst.leader) {
        monst.leader = ctx.player;
        monst.bookkeepingFlags |= ctx.MB_FOLLOWER;
    }

    // Escape harmful terrain first
    const inHarmfulTerrain =
        ctx.cellHasTerrainFlag(
            { x, y },
            ctx.T_HARMFUL_TERRAIN & ~(ctx.T_IS_FIRE | ctx.T_CAUSES_DAMAGE | ctx.T_CAUSES_PARALYSIS | ctx.T_CAUSES_CONFUSION),
        ) ||
        (ctx.cellHasTerrainFlag({ x, y }, ctx.T_IS_FIRE) && !(monst.status[StatusEffect.ImmuneToFire])) ||
        (ctx.cellHasTerrainFlag({ x, y }, ctx.T_CAUSES_DAMAGE | ctx.T_CAUSES_PARALYSIS | ctx.T_CAUSES_CONFUSION) &&
            !(monst.info.flags & (ctx.MONST_INANIMATE | ctx.MONST_INVULNERABLE)));

    if (inHarmfulTerrain) {
        if (!ctx.updatedMapToSafeTerrainThisTurn) {
            ctx.updateSafeTerrainMap();
        }

        if (ctx.mapToSafeTerrain && ctx.monsterBlinkToPreferenceMap(monst, ctx.mapToSafeTerrain, false)) {
            monst.ticksUntilTurn = monst.attackSpeed *
                ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
            return;
        }

        if (ctx.mapToSafeTerrain) {
            const dir = ctx.nextStep(ctx.mapToSafeTerrain, { x, y }, monst, true);
            if (dir !== ctx.NO_DIRECTION) {
                const targetLoc: Pos = {
                    x: x + ctx.nbDirs[dir][0],
                    y: y + ctx.nbDirs[dir][1],
                };
                if (ctx.moveMonsterPassivelyTowards(monst, targetLoc, false)) {
                    return;
                }
            }
        }
    }

    // Find nearest enemy
    let closestMonster: Creature | null = null;
    let shortestDistance = Math.max(ctx.DROWS, ctx.DCOLS);

    for (const target of ctx.monsters) {
        if (
            target !== monst &&
            (!(target.bookkeepingFlags & ctx.MB_SUBMERGED) || (monst.bookkeepingFlags & ctx.MB_SUBMERGED)) &&
            ctx.monsterWillAttackTarget(monst, target) &&
            ctx.distanceBetween({ x, y }, target.loc) < shortestDistance &&
            ctx.traversiblePathBetween(monst, target.loc.x, target.loc.y) &&
            !ctx.cellHasTerrainFlag(target.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
            (!target.status[ctx.STATUS_INVISIBLE] || ctx.rng.randPercent(33))
        ) {
            shortestDistance = ctx.distanceBetween({ x, y }, target.loc);
            closestMonster = target;
        }
    }

    // Weak allies flee if in presence of enemies
    if (ctx.allyFlees(monst, closestMonster)) {
        if (
            ctx.monsterHasBoltEffect(monst, ctx.BE_BLINKING) &&
            (monst.info.flags & ctx.MONST_ALWAYS_USE_ABILITY || ctx.rng.randPercent(30)) &&
            ctx.monsterBlinkToSafety(monst)
        ) {
            return;
        }
        if (ctx.monsterSummons(monst, !!(monst.info.flags & ctx.MONST_ALWAYS_USE_ABILITY))) {
            return;
        }
        const dir = ctx.nextStep(ctx.allySafetyMap, monst.loc, monst, true);
        let targetLoc: Pos = monst.loc;
        if (dir !== ctx.NO_DIRECTION) {
            targetLoc = {
                x: x + ctx.nbDirs[dir][0],
                y: y + ctx.nbDirs[dir][1],
            };
        }
        if (
            dir === ctx.NO_DIRECTION ||
            (ctx.allySafetyMap[targetLoc.x][targetLoc.y] >= ctx.allySafetyMap[x][y]) ||
            (!ctx.moveMonster(monst, ctx.nbDirs[dir][0], ctx.nbDirs[dir][1]) &&
                !ctx.moveMonsterPassivelyTowards(monst, targetLoc, true))
        ) {
            // can't flee; fall through to normal ally logic below
        } else {
            return;
        }
    }

    // Magic users sometimes cast spells
    if (ctx.monstUseMagic(monst)) {
        monst.ticksUntilTurn = monst.attackSpeed *
            ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
        return;
    }

    // Determine leash length
    let leashLength: number;
    if (monst.bookkeepingFlags & ctx.MB_SEIZED) {
        leashLength = Math.max(ctx.DCOLS, ctx.DROWS);
    } else if (ctx.justRested || ctx.justSearched) {
        leashLength = 10;
    } else {
        leashLength = 4;
    }
    // C:3142 — if adjacent to enemy, extend leash (or max out if enemy is faster and tracking)
    if (shortestDistance === 1 && closestMonster) {
        if (
            closestMonster.movementSpeed < monst.movementSpeed &&
            !(closestMonster.info.flags & (ctx.MONST_FLITS | ctx.MONST_IMMOBILE)) &&
            closestMonster.creatureState === ctx.MONSTER_TRACKING_SCENT
        ) {
            leashLength = Math.max(ctx.DCOLS, ctx.DROWS);
        } else {
            leashLength++;
        }
    }

    // Attack or pursue nearest enemy within leash (C:3153)
    if (
        closestMonster &&
        (ctx.distanceBetween({ x, y }, ctx.player.loc) < leashLength ||
            !!(monst.bookkeepingFlags & ctx.MB_DOES_NOT_TRACK_LEADER)) &&
        !(monst.info.flags & ctx.MONST_MAINTAINS_DISTANCE) &&
        !ctx.attackWouldBeFutile(monst, closestMonster)
    ) {
        ctx.pathTowardCreature(monst, closestMonster);
        return;
    }

    // Corpse-eating branch (C:3208)
    if (
        ctx.isPosInMap(monst.targetCorpseLoc) &&
        !monst.status[ctx.STATUS_POISONED] &&
        (!monst.status[ctx.STATUS_BURNING] || !!monst.status[ctx.STATUS_IMMUNE_TO_FIRE])
    ) {
        ctx.moveMonsterPassivelyTowards(monst, monst.targetCorpseLoc, false);
        if (
            monst.loc.x === monst.targetCorpseLoc.x &&
            monst.loc.y === monst.targetCorpseLoc.y &&
            !(monst.bookkeepingFlags & ctx.MB_ABSORBING)
        ) {
            if (ctx.canSeeMonster(monst)) {
                const monstName = ctx.monsterName(monst, true);
                const absorbText = ctx.getMonsterAbsorbingText(monst);
                void ctx.messageWithColor(
                    `${monstName} begins ${absorbText} the fallen ${monst.targetCorpseName}.`,
                    ctx.goodMessageColor, 0,
                );
            }
            monst.corpseAbsorptionCounter = 20;
            monst.bookkeepingFlags |= ctx.MB_ABSORBING;
        }
        return;
    }

    // Mill about if close to player or doesn't track leader (C:3222)
    if (
        (monst.bookkeepingFlags & ctx.MB_DOES_NOT_TRACK_LEADER) ||
        (ctx.distanceBetween({ x, y }, ctx.player.loc) < 3 && ctx.inFieldOfView({ x, y }))
    ) {
        monst.bookkeepingFlags &= ~ctx.MB_GIVEN_UP_ON_SCENT;
        ctx.monsterMillAbout(monst, 30);
        return;
    }

    // Follow scent back to leader (C:3228)
    if (
        !(monst.bookkeepingFlags & ctx.MB_GIVEN_UP_ON_SCENT) &&
        ctx.distanceBetween({ x, y }, ctx.player.loc) > 10 &&
        ctx.monsterBlinkToPreferenceMap(monst, ctx.scentMap, true)
    ) {
        monst.ticksUntilTurn = monst.attackSpeed *
            ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
        return;
    }

    const scentDir = ctx.scentDirection(monst);
    if (scentDir === ctx.NO_DIRECTION || (monst.bookkeepingFlags & ctx.MB_GIVEN_UP_ON_SCENT)) {
        monst.bookkeepingFlags |= ctx.MB_GIVEN_UP_ON_SCENT;
        if (monst.leader) {
            ctx.pathTowardCreature(monst, monst.leader);
        }
    } else {
        const targetLoc: Pos = {
            x: x + ctx.nbDirs[scentDir][0],
            y: y + ctx.nbDirs[scentDir][1],
        };
        ctx.moveMonsterPassivelyTowards(monst, targetLoc, false);
    }
}

// ============================================================================
// monstersTurn — the main monster AI loop
// ============================================================================

/**
 * Context for the monstersTurn function — the main AI loop.
 * Abstracts all subsystem dependencies through DI.
 */
export interface MonstersTurnContext {
    player: Creature;
    monsters: Creature[];
    rng: {
        randRange(lo: number, hi: number): number;
        randPercent(pct: number): boolean;
    };

    // ── Map access ──
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    cellFlags(loc: Pos): number;
    inFieldOfView(loc: Pos): boolean;

    // ── Monster state ──
    updateMonsterState(monst: Creature): void;

    // ── Monster movement ──
    moveMonster(monst: Creature, dx: number, dy: number): boolean;
    moveMonsterPassivelyTowards(monst: Creature, target: Pos, willingToAttackPlayer: boolean): boolean;
    monsterAvoids(monst: Creature, p: Pos): boolean;

    // ── Magic/abilities ──
    monstUseMagic(monst: Creature): boolean;
    monsterHasBoltEffect(monst: Creature, effectType: number): number;
    monsterBlinkToPreferenceMap(monst: Creature, preferenceMap: number[][], blinkUphill: boolean): boolean;
    monsterBlinkToSafety(monst: Creature): boolean;
    monsterSummons(monst: Creature, alwaysUse: boolean): boolean;
    monsterCanShootWebs(monst: Creature): boolean;

    // ── Corpse absorption ──
    updateMonsterCorpseAbsorption(monst: Creature): boolean;

    // ── Dungeon features ──
    spawnDungeonFeature(x: number, y: number, dfType: number, isVolatile: boolean, ignoreBlocking: boolean): void;

    // ── Tile effects ──
    applyInstantTileEffectsToCreature(monst: Creature): void;

    // ── Items ──
    makeMonsterDropItem(monst: Creature): void;

    // ── Pathfinding ──
    scentDirection(monst: Creature): number;
    isLocalScentMaximum(loc: Pos): boolean;
    pathTowardCreature(monst: Creature, target: Creature): void;
    nextStep(map: number[][], loc: Pos, monst: Creature | null, includeMonsters: boolean): number;
    getSafetyMap(monst: Creature): number[][];
    traversiblePathBetween(monst: Creature, x: number, y: number): boolean;
    monsterWillAttackTarget(monst: Creature, target: Creature): boolean;

    // ── Wandering ──
    chooseNewWanderDestination(monst: Creature): void;
    isValidWanderDestination(monst: Creature, waypointIndex: number): boolean;
    waypointDistanceMap(waypointIndex: number): number[][];
    wanderToward(monst: Creature, loc: Pos): void;
    randValidDirectionFrom(monst: Creature, x: number, y: number, allowDiag: boolean): number;
    monsterMillAbout(monst: Creature, chance: number): void;
    moveAlly(monst: Creature): void;

    // ── Direction data ──
    nbDirs: readonly [number, number][];
    NO_DIRECTION: number;

    // ── Map dimensions ──
    DCOLS: number;
    DROWS: number;

    // ── Misc ──
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;
    mapToSafeTerrain: number[][] | null;
    updateSafeTerrainMap(): void;
    scentMap: number[][];

    // ── Flags ──
    IN_FIELD_OF_VIEW: number;
    MB_GIVEN_UP_ON_SCENT: number;
    MONST_CAST_SPELLS_SLOWLY: number;
    BE_BLINKING: number;
}

/**
 * Executes a monster's turn — the main AI decision loop.
 * Handles sleeping, immobile turrets, discordant behavior, hunting,
 * fleeing, wandering, and ally behavior.
 *
 * Ported from monstersTurn() in Monsters.c.
 */
export function monstersTurn(monst: Creature, ctx: MonstersTurnContext): void {
    const x = monst.loc.x;
    const y = monst.loc.y;

    monst.turnsSpentStationary++;

    // Corpse absorption
    if (monst.corpseAbsorptionCounter >= 0 && ctx.updateMonsterCorpseAbsorption(monst)) {
        return;
    }

    // Dungeon feature chance
    if (
        monst.info.DFChance &&
        (monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION) &&
        ctx.rng.randPercent(monst.info.DFChance)
    ) {
        ctx.spawnDungeonFeature(x, y, monst.info.DFType, true, false);
    }

    ctx.applyInstantTileEffectsToCreature(monst);

    // Paralyzed, entranced, or captive — turn ends
    if (
        monst.status[StatusEffect.Paralyzed] ||
        monst.status[StatusEffect.Entranced] ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
    ) {
        monst.ticksUntilTurn = monst.movementSpeed;
        if ((monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) && monst.carriedItem) {
            ctx.makeMonsterDropItem(monst);
        }
        return;
    }

    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) {
        return;
    }

    monst.ticksUntilTurn = Math.floor(monst.movementSpeed / 3);

    // Sleepers
    if (monst.creatureState === CreatureState.Sleeping) {
        monst.ticksUntilTurn = monst.movementSpeed;
        ctx.updateMonsterState(monst);
        return;
    }

    ctx.updateMonsterState(monst);

    // Re-check after updateMonsterState (may have changed state back to Sleeping)
    if ((monst.creatureState as CreatureState) === CreatureState.Sleeping) {
        monst.ticksUntilTurn = monst.movementSpeed;
        return;
    }

    // Immobile monsters (turrets, totems)
    if (monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE) {
        if (ctx.monstUseMagic(monst)) {
            monst.ticksUntilTurn = monst.attackSpeed *
                ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
            return;
        }
        monst.ticksUntilTurn = monst.attackSpeed;
        return;
    }

    // Discordant monsters
    if (monst.status[StatusEffect.Discordant] && monst.creatureState !== CreatureState.Fleeing) {
        let shortestDistance = Math.max(ctx.DROWS, ctx.DCOLS);
        let closestMonster: Creature | null = null;

        const allCreatures = [ctx.player, ...ctx.monsters];
        for (const target of allCreatures) {
            if (
                target !== monst &&
                (!(target.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) ||
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) &&
                ctx.monsterWillAttackTarget(monst, target) &&
                distanceBetween(monst.loc, target.loc) < shortestDistance &&
                ctx.traversiblePathBetween(monst, target.loc.x, target.loc.y) &&
                (!ctx.monsterAvoids(monst, target.loc) ||
                    (target.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)) &&
                (!target.status[StatusEffect.Invisible] || ctx.rng.randPercent(33))
            ) {
                shortestDistance = distanceBetween(monst.loc, target.loc);
                closestMonster = target;
            }
        }

        if (closestMonster && ctx.monstUseMagic(monst)) {
            monst.ticksUntilTurn = monst.attackSpeed *
                ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
            return;
        }
        if (closestMonster && !(monst.info.flags & MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE)) {
            if (ctx.moveMonsterPassivelyTowards(monst, closestMonster.loc, true)) {
                return;
            }
        }
    }

    // Hunting
    if (
        (monst.creatureState === CreatureState.TrackingScent ||
            (monst.creatureState === CreatureState.Ally && monst.status[StatusEffect.Discordant])) &&
        (!(monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) ||
            ctx.cellHasTMFlag(ctx.player.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING))
    ) {
        // Magic/blink
        const boltType = ctx.monsterHasBoltEffect(monst, ctx.BE_BLINKING);
        if (
            ctx.monstUseMagic(monst) ||
            (boltType &&
                ((monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY) || ctx.rng.randPercent(30)) &&
                ctx.monsterBlinkToPreferenceMap(monst, ctx.scentMap, true))
        ) {
            monst.ticksUntilTurn = monst.attackSpeed *
                ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
            return;
        }

        // Attack adjacent allies of the player
        if (
            distanceBetween(monst.loc, ctx.player.loc) > 1 ||
            ctx.diagonalBlocked(x, y, ctx.player.loc.x, ctx.player.loc.y, false)
        ) {
            for (const ally of ctx.monsters) {
                if (
                    ctx.monsterWillAttackTarget(monst, ally) &&
                    distanceBetween(monst.loc, ally.loc) === 1 &&
                    (!ally.status[StatusEffect.Invisible] || ctx.rng.randPercent(33))
                ) {
                    if (ctx.moveMonsterPassivelyTowards(monst, ally.loc, true)) {
                        return;
                    }
                }
            }
        }

        // Special movement for levitating/restricted/submerged monsters
        if (
            (monst.status[StatusEffect.Levitating] ||
                (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) ||
                (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) ||
                ((monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
                    ctx.monsterCanShootWebs(monst))) &&
            ctx.inFieldOfView(monst.loc)
        ) {
            ctx.moveMonsterPassivelyTowards(monst, ctx.player.loc, true);
            return;
        }

        // Always-hunting monster that has given up on scent
        if (
            (monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_HUNTING) &&
            (monst.bookkeepingFlags & ctx.MB_GIVEN_UP_ON_SCENT)
        ) {
            ctx.pathTowardCreature(monst, ctx.player);
            return;
        }

        const dir = ctx.scentDirection(monst);
        if (dir === ctx.NO_DIRECTION) {
            const alreadyAtBestScent = ctx.isLocalScentMaximum(monst.loc);
            if (
                alreadyAtBestScent &&
                monst.creatureState !== CreatureState.Ally &&
                !ctx.inFieldOfView(monst.loc)
            ) {
                if (monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_HUNTING) {
                    ctx.pathTowardCreature(monst, ctx.player);
                    monst.bookkeepingFlags |= ctx.MB_GIVEN_UP_ON_SCENT;
                    return;
                }
                monst.creatureState = CreatureState.Wandering;
                ctx.wanderToward(monst, monst.lastSeenPlayerAt);
            }
        } else {
            ctx.moveMonster(monst, ctx.nbDirs[dir][0], ctx.nbDirs[dir][1]);
        }
    } else if (monst.creatureState === CreatureState.Fleeing) {
        // Fleeing
        const boltType = ctx.monsterHasBoltEffect(monst, ctx.BE_BLINKING);
        if (
            boltType &&
            ((monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY) || ctx.rng.randPercent(30)) &&
            ctx.monsterBlinkToSafety(monst)
        ) {
            return;
        }

        if (ctx.monsterSummons(monst, !!(monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY))) {
            return;
        }

        const safetyMap = ctx.getSafetyMap(monst);
        const fleeDir = ctx.nextStep(safetyMap, monst.loc, null, true);
        let targetLoc: Pos = monst.loc;
        if (fleeDir !== -1) {
            targetLoc = {
                x: x + ctx.nbDirs[fleeDir][0],
                y: y + ctx.nbDirs[fleeDir][1],
            };
        }
        if (
            fleeDir === -1 ||
            (!ctx.moveMonster(monst, ctx.nbDirs[fleeDir][0], ctx.nbDirs[fleeDir][1]) &&
                !ctx.moveMonsterPassivelyTowards(monst, targetLoc, true))
        ) {
            // Attack if cornered
            const allCreatures = [ctx.player, ...ctx.monsters];
            for (const ally of allCreatures) {
                if (
                    !monst.status[StatusEffect.MagicalFear] &&
                    ctx.monsterWillAttackTarget(monst, ally) &&
                    distanceBetween(monst.loc, ally.loc) <= 1
                ) {
                    ctx.moveMonster(monst, ally.loc.x - x, ally.loc.y - y);
                    return;
                }
            }
        }
        return;
    } else if (
        monst.creatureState === CreatureState.Wandering ||
        ((monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
            !ctx.cellHasTMFlag(ctx.player.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING))
    ) {
        // Wandering — escape harmful terrain
        if (
            ctx.cellHasTerrainFlag(monst.loc, T_HARMFUL_TERRAIN & ~TerrainFlag.T_IS_FIRE) ||
            (ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_IS_FIRE) &&
                !monst.status[StatusEffect.ImmuneToFire] &&
                !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE))
        ) {
            if (ctx.mapToSafeTerrain) {
                const boltType = ctx.monsterHasBoltEffect(monst, ctx.BE_BLINKING);
                if (
                    boltType &&
                    ctx.monsterBlinkToPreferenceMap(monst, ctx.mapToSafeTerrain, false)
                ) {
                    monst.ticksUntilTurn = monst.attackSpeed *
                        ((monst.info.flags & ctx.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
                    return;
                }

                const safeDir = ctx.nextStep(ctx.mapToSafeTerrain, monst.loc, monst, true);
                if (safeDir !== -1) {
                    const safeLoc = {
                        x: x + ctx.nbDirs[safeDir][0],
                        y: y + ctx.nbDirs[safeDir][1],
                    };
                    if (ctx.moveMonsterPassivelyTowards(monst, safeLoc, true)) {
                        return;
                    }
                }
            }
        }

        // Attack adjacent allies of the player while wandering
        if (monst.creatureState === CreatureState.Wandering) {
            for (const ally of ctx.monsters) {
                if (
                    ctx.monsterWillAttackTarget(monst, ally) &&
                    distanceBetween(monst.loc, ally.loc) === 1 &&
                    (!ally.status[StatusEffect.Invisible] || ctx.rng.randPercent(33))
                ) {
                    if (ctx.moveMonsterPassivelyTowards(monst, ally.loc, true)) {
                        return;
                    }
                }
            }
        }

        // Followers stay near leader
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) {
            if (monst.leader && distanceBetween(monst.loc, monst.leader.loc) > 2) {
                ctx.pathTowardCreature(monst, monst.leader);
            } else if (monst.leader && (monst.leader.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)) {
                ctx.monsterMillAbout(monst, 100);
            } else if (monst.leader && (monst.leader.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)) {
                ctx.monsterMillAbout(monst, 10);
            } else {
                ctx.monsterMillAbout(monst, 30);
            }
        } else {
            // Step toward waypoint
            let dir = ctx.NO_DIRECTION;
            if (ctx.isValidWanderDestination(monst, monst.targetWaypointIndex)) {
                dir = ctx.nextStep(
                    ctx.waypointDistanceMap(monst.targetWaypointIndex),
                    monst.loc, monst, false,
                );
            }
            if (
                !ctx.isValidWanderDestination(monst, monst.targetWaypointIndex) ||
                dir === ctx.NO_DIRECTION
            ) {
                ctx.chooseNewWanderDestination(monst);
                if (ctx.isValidWanderDestination(monst, monst.targetWaypointIndex)) {
                    dir = ctx.nextStep(
                        ctx.waypointDistanceMap(monst.targetWaypointIndex),
                        monst.loc, monst, false,
                    );
                }
            }
            if (dir === ctx.NO_DIRECTION) {
                dir = ctx.randValidDirectionFrom(monst, x, y, true);
            }
            if (dir !== ctx.NO_DIRECTION) {
                const targetLoc = {
                    x: x + ctx.nbDirs[dir][0],
                    y: y + ctx.nbDirs[dir][1],
                };
                ctx.moveMonsterPassivelyTowards(monst, targetLoc, true);
            }
        }
    } else if (monst.creatureState === CreatureState.Ally) {
        ctx.moveAlly(monst);
    }
}
