/*
 *  monster-queries.ts — Monster visibility, relationship, and name queries
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: monsterRevealed, monsterHiddenBySubmersion, monsterIsHidden,
 *             canSeeMonster, canDirectlySeeMonster, monsterName,
 *             monsterIsInClass, attackWouldBeFutile, monsterWillAttackTarget,
 *             monstersAreTeammates, monstersAreEnemies
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, MonsterClass, Pos } from "../types/types.js";
import { StatusEffect, CreatureState } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TerrainFlag,
    MonsterAbilityFlag,
} from "../types/flags.js";

// ============================================================================
// Query context — DI for map/player-dependent operations
// ============================================================================

/**
 * Context for monster query operations that need map or player data.
 */
export interface MonsterQueryContext {
    /** The player creature. Used to check `monst === player`. */
    player: Creature;
    /** Check if cell has terrain flags. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Check if a cell's gas layer is non-empty. */
    cellHasGas(loc: Pos): boolean;
    /** Check if the player can see a location (lit, in FOV, etc.). */
    playerCanSee(x: number, y: number): boolean;
    /** Check if the player can directly see (line-of-sight, no telepathy). */
    playerCanDirectlySee(x: number, y: number): boolean;
    /** Whether playback omniscience is enabled. */
    playbackOmniscience: boolean;
}

// ============================================================================
// monsterRevealed
// ============================================================================

/**
 * Checks if the player knows a monster's location via telepathy or entrancement.
 *
 * Ported from monsterRevealed() in Monsters.c.
 */
export function monsterRevealed(monst: Creature, player: Creature): boolean {
    if (monst === player) {
        return false;
    }
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED) {
        return true;
    }
    if (monst.status[StatusEffect.Entranced]) {
        return true;
    }
    if (player.status[StatusEffect.Telepathic] && !(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)) {
        return true;
    }
    return false;
}

// ============================================================================
// monsterHiddenBySubmersion
// ============================================================================

/**
 * Checks if a monster is hidden because it's submerged, and the observer
 * isn't also in deep water.
 *
 * Ported from monsterHiddenBySubmersion() in Monsters.c.
 */
export function monsterHiddenBySubmersion(
    monst: Creature,
    observer: Creature | null,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) {
        if (
            observer &&
            cellHasTerrainFlag(observer.loc, TerrainFlag.T_IS_DEEP_WATER) &&
            !observer.status[StatusEffect.Levitating]
        ) {
            // Observer is in deep water, so target is not hidden
            return false;
        }
        // Submerged and observer is not in deep water
        return true;
    }
    return false;
}

// ============================================================================
// monstersAreTeammates
// ============================================================================

/**
 * Checks if two creatures are teammates (same leader, follower/leader pair,
 * or both allied with the player).
 *
 * Ported from monstersAreTeammates() in Monsters.c.
 */
export function monstersAreTeammates(
    monst1: Creature,
    monst2: Creature,
    player: Creature,
): boolean {
    return (
        ((monst1.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) !== 0 && monst1.leader === monst2) ||
        ((monst2.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) !== 0 && monst2.leader === monst1) ||
        (monst1.creatureState === CreatureState.Ally && monst2 === player) ||
        (monst1 === player && monst2.creatureState === CreatureState.Ally) ||
        (monst1.creatureState === CreatureState.Ally && monst2.creatureState === CreatureState.Ally) ||
        (
            (monst1.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) !== 0 &&
            (monst2.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) !== 0 &&
            monst1.leader === monst2.leader
        )
    );
}

// ============================================================================
// monstersAreEnemies
// ============================================================================

/**
 * Determines if two creatures are enemies. Considers captive status,
 * discord, liquid-restricted predators, and faction alignment.
 *
 * Ported from monstersAreEnemies() in Monsters.c.
 */
export function monstersAreEnemies(
    monst1: Creature,
    monst2: Creature,
    player: Creature,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    if ((monst1.bookkeepingFlags | monst2.bookkeepingFlags) & MonsterBookkeepingFlag.MB_CAPTIVE) {
        return false;
    }
    if (monst1 === monst2) {
        return false;
    }
    if (monst1.status[StatusEffect.Discordant] || monst2.status[StatusEffect.Discordant]) {
        return true;
    }
    // Eels and krakens attack anything in deep water
    if (
        (
            (monst1.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
            !(monst2.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WATER) &&
            !monst2.status[StatusEffect.Levitating] &&
            cellHasTerrainFlag(monst2.loc, TerrainFlag.T_IS_DEEP_WATER)
        ) ||
        (
            (monst2.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
            !(monst1.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WATER) &&
            !monst1.status[StatusEffect.Levitating] &&
            cellHasTerrainFlag(monst1.loc, TerrainFlag.T_IS_DEEP_WATER)
        )
    ) {
        return true;
    }
    return (
        (monst1.creatureState === CreatureState.Ally || monst1 === player) !==
        (monst2.creatureState === CreatureState.Ally || monst2 === player)
    );
}

// ============================================================================
// monsterIsHidden
// ============================================================================

/**
 * Checks if a creature is in a state that hides it from an observer.
 * A creature is hidden if it's dormant, invisible (and not in gas), or submerged.
 * Teammates are never hidden from each other.
 *
 * Ported from monsterIsHidden() in Monsters.c.
 */
export function monsterIsHidden(
    monst: Creature,
    observer: Creature | null,
    ctx: MonsterQueryContext,
): boolean {
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT) {
        return true;
    }
    if (observer && monstersAreTeammates(monst, observer, ctx.player)) {
        return false;
    }
    if (monst.status[StatusEffect.Invisible] && !ctx.cellHasGas(monst.loc)) {
        return true;
    }
    if (monsterHiddenBySubmersion(monst, observer, ctx.cellHasTerrainFlag)) {
        return true;
    }
    return false;
}

// ============================================================================
// canSeeMonster
// ============================================================================

/**
 * Checks if the player has full knowledge about a creature —
 * knows where it is and what kind it is. Ignores hallucination.
 *
 * Ported from canSeeMonster() in Monsters.c.
 */
export function canSeeMonster(monst: Creature, ctx: MonsterQueryContext): boolean {
    if (monst === ctx.player) {
        return true;
    }
    if (
        !monsterIsHidden(monst, ctx.player, ctx) &&
        (ctx.playerCanSee(monst.loc.x, monst.loc.y) || monsterRevealed(monst, ctx.player))
    ) {
        return true;
    }
    return false;
}

// ============================================================================
// canDirectlySeeMonster
// ============================================================================

/**
 * Checks if the player can physically see a monster (line of sight and
 * adequate lighting). Ignores telepathy.
 *
 * Ported from canDirectlySeeMonster() in Monsters.c.
 */
export function canDirectlySeeMonster(monst: Creature, ctx: MonsterQueryContext): boolean {
    if (monst === ctx.player) {
        return true;
    }
    if (ctx.playerCanDirectlySee(monst.loc.x, monst.loc.y) && !monsterIsHidden(monst, ctx.player, ctx)) {
        return true;
    }
    return false;
}

// ============================================================================
// monsterName
// ============================================================================

/**
 * Generates the display name for a monster. Returns "you" for the player,
 * the monster's name (with optional article) if visible, or "something" if not.
 *
 * Ported from monsterName() in Monsters.c (simplified — hallucination random
 * names deferred to when cosmetic RNG is wired up).
 */
export function monsterName(
    monst: Creature,
    includeArticle: boolean,
    ctx: MonsterQueryContext,
): string {
    if (monst === ctx.player) {
        return "you";
    }
    if (canSeeMonster(monst, ctx) || ctx.playbackOmniscience) {
        // TODO: Hallucination random name generation when cosmetic RNG is wired up
        const article = includeArticle
            ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
            : "";
        return `${article}${monst.info.monsterName}`;
    }
    return "something";
}

// ============================================================================
// monsterIsInClass
// ============================================================================

/**
 * Checks if a monster belongs to a given monster class.
 *
 * Ported from monsterIsInClass() in Monsters.c.
 */
export function monsterIsInClass(
    monst: Creature,
    monsterClass: MonsterClass,
): boolean {
    for (const memberType of monsterClass.memberList) {
        if (memberType === monst.info.monsterID) {
            return true;
        }
    }
    return false;
}

// ============================================================================
// attackWouldBeFutile
// ============================================================================

/**
 * Checks if attacking a defender would be pointless (e.g. immune to weapons,
 * invulnerable, embedded in obstruction crystal).
 *
 * Ported from attackWouldBeFutile() in Monsters.c.
 */
export function attackWouldBeFutile(
    attacker: Creature,
    defender: Creature,
    player: Creature,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    if (
        cellHasTerrainFlag(defender.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !(defender.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
    ) {
        return true;
    }
    if (attacker === player) {
        return false; // Let the player do what she wants
    }
    if (
        (attacker.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
        !attacker.status[StatusEffect.Levitating] &&
        defender.status[StatusEffect.Levitating]
    ) {
        return true;
    }
    if (defender.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) {
        return true;
    }
    if (
        (defender.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS) &&
        !(attacker.info.abilityFlags & MonsterAbilityFlag.MA_POISONS)
    ) {
        return true;
    }
    return false;
}

// ============================================================================
// monsterWillAttackTarget
// ============================================================================

/**
 * Determines if a creature is willing to attack another. Considers discord,
 * entrancement, confusion, and faction. Location/terrain not considered
 * (except via monstersAreEnemies for deep-water predators).
 *
 * Ported from monsterWillAttackTarget() in Monsters.c.
 */
export function monsterWillAttackTarget(
    attacker: Creature,
    defender: Creature,
    player: Creature,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    if (attacker === defender || (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)) {
        return false;
    }
    if (attacker === player && defender.creatureState === CreatureState.Ally) {
        return !!defender.status[StatusEffect.Discordant];
    }
    if (attacker.status[StatusEffect.Entranced] && defender.creatureState !== CreatureState.Ally) {
        return true;
    }
    if (
        attacker.creatureState === CreatureState.Ally &&
        attacker !== player &&
        defender.status[StatusEffect.Entranced]
    ) {
        return false;
    }
    if (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
        return false;
    }
    if (
        attacker.status[StatusEffect.Discordant] ||
        defender.status[StatusEffect.Discordant] ||
        attacker.status[StatusEffect.Confused]
    ) {
        return true;
    }
    if (
        monstersAreEnemies(attacker, defender, player, cellHasTerrainFlag) &&
        !monstersAreTeammates(attacker, defender, player)
    ) {
        return true;
    }
    return false;
}
