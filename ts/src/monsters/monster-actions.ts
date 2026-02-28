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

import type { Creature, Pos, StatusEffectInfo } from "../types/types.js";
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
