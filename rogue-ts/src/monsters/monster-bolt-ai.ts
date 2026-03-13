/*
 *  monster-bolt-ai.ts — Monster spell/bolt dispatch pipeline
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: generallyValidBoltTarget, targetEligibleForCombatBuff,
 *             specificallyValidBoltTarget, monsterCastSpell,
 *             monstUseBolt, monstUseMagic
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Creature, Pos, Bolt, FloorTileType, DungeonFeature, CreatureType,
    PlayerCharacter,
} from "../types/types.js";
import { StatusEffect, CreatureState, BoltEffect, ArmorEnchant } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    BoltFlag,
    TerrainFlag,
    ItemFlag,
} from "../types/flags.js";
import { netEnchant } from "../items/item-usage.js";

// ============================================================================
// BoltAIContext
// ============================================================================

/**
 * Context for the bolt/spell AI pipeline.
 * All game state dependencies are injected here.
 */
export interface BoltAIContext {
    player: Creature;
    monsters: Creature[];
    rogue: PlayerCharacter;

    boltCatalog: readonly Bolt[];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    monsterCatalog: readonly CreatureType[];

    rng: { randPercent(pct: number): boolean };

    /** Open line-of-sight path between two positions (no terrain obstruction). */
    openPathBetween(loc1: Pos, loc2: Pos): boolean;
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    inFieldOfView(loc: Pos): boolean;

    /** True if the player can directly see the given monster's cell. */
    canDirectlySeeMonster(monst: Creature): boolean;
    /** True if target is hidden from viewer (invisible, submerged in non-gas, etc.). */
    monsterIsHidden(target: Creature, viewer: Creature): boolean;
    monstersAreTeammates(a: Creature, b: Creature): boolean;
    monstersAreEnemies(a: Creature, b: Creature): boolean;
    canSeeMonster(monst: Creature): boolean;

    burnedTerrainFlagsAtLoc(loc: Pos): number;
    avoidedFlagsForMonster(info: CreatureType): number;
    distanceBetween(a: Pos, b: Pos): number;

    monsterName(monst: Creature, includeArticle: boolean): string;
    resolvePronounEscapes(text: string, monst: Creature): string;
    combatMessage(msg: string, color: null): void;

    zap(origin: Pos, target: Pos, bolt: Bolt, hideDetails: boolean, boltInView: boolean): void;
    gameOver(message: string): void;

    /** Attempt monster summoning; returns true if used the monster's turn. */
    monsterSummons(monst: Creature, alwaysUse: boolean): boolean;
}

// ============================================================================
// generallyValidBoltTarget — Monsters.c:2534
// ============================================================================

/**
 * Returns true if the caster may fire any bolt at the target.
 * This is a prerequisite check before per-bolt validation.
 *
 * Ported from generallyValidBoltTarget() in Monsters.c.
 */
export function generallyValidBoltTarget(
    caster: Creature,
    target: Creature,
    ctx: BoltAIContext,
): boolean {
    if (caster === target) {
        return false;
    }
    // Discordant monsters wandering don't target the player.
    if (
        caster.status[StatusEffect.Discordant] &&
        caster.creatureState === CreatureState.Wandering &&
        target === ctx.player
    ) {
        return false;
    }
    // Sane allies don't cast at sacrifice targets.
    if (
        caster.creatureState === CreatureState.Ally &&
        !caster.status[StatusEffect.Discordant] &&
        (target.bookkeepingFlags & MonsterBookkeepingFlag.MB_MARKED_FOR_SACRIFICE)
    ) {
        return false;
    }
    // Submerged or hidden targets can't be hit.
    if (
        ctx.monsterIsHidden(target, caster) ||
        (target.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
    ) {
        return false;
    }
    return ctx.openPathBetween(caster.loc, target.loc);
}

// ============================================================================
// targetEligibleForCombatBuff — Monsters.c:2563
// ============================================================================

/**
 * Returns true if a combat-buff bolt (haste, shielding) should be cast at the target.
 * Allied casters must have an enemy visible in FOV; non-allied casters need an aware target.
 *
 * Ported from targetEligibleForCombatBuff() in Monsters.c.
 */
export function targetEligibleForCombatBuff(
    caster: Creature,
    target: Creature,
    ctx: BoltAIContext,
): boolean {
    if (caster.creatureState === CreatureState.Ally) {
        if (ctx.canDirectlySeeMonster(caster)) {
            // Check if any enemy of the player is visible in FOV.
            const allTargets: Creature[] = [ctx.player, ...ctx.monsters];
            for (const enemy of allTargets) {
                if (
                    ctx.monstersAreEnemies(ctx.player, enemy) &&
                    ctx.canSeeMonster(enemy) &&
                    ctx.inFieldOfView(enemy.loc)
                ) {
                    return true;
                }
            }
        }
        return false;
    } else {
        return target.creatureState === CreatureState.TrackingScent;
    }
}

// ============================================================================
// specificallyValidBoltTarget — Monsters.c:2587
// ============================================================================

/**
 * Determines whether the caster should fire the given bolt type at the target.
 * Assumes generallyValidBoltTarget has already passed.
 *
 * Ported from specificallyValidBoltTarget() in Monsters.c.
 */
export function specificallyValidBoltTarget(
    caster: Creature,
    target: Creature,
    theBoltType: number,
    ctx: BoltAIContext,
): boolean {
    const bolt = ctx.boltCatalog[theBoltType];
    if (!bolt) return false;

    // Ally targeting check.
    if (
        (bolt.flags & BoltFlag.BF_TARGET_ALLIES) &&
        (!ctx.monstersAreTeammates(caster, target) || ctx.monstersAreEnemies(caster, target))
    ) {
        return false;
    }
    if (
        (bolt.flags & BoltFlag.BF_TARGET_ENEMIES) &&
        !ctx.monstersAreEnemies(caster, target)
    ) {
        return false;
    }
    if (
        (bolt.flags & BoltFlag.BF_TARGET_ENEMIES) &&
        (target.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)
    ) {
        return false;
    }

    // Don't fire a reflectable bolt at a reflective target (unless it's your ally).
    if (
        (
            (target.info.flags & MonsterBehaviorFlag.MONST_REFLECT_50) ||
            (target.info.abilityFlags & MonsterAbilityFlag.MA_REFLECT_100)
        ) &&
        target.creatureState !== CreatureState.Ally &&
        !(bolt.flags & (BoltFlag.BF_NEVER_REFLECTS | BoltFlag.BF_HALTS_BEFORE_OBSTRUCTION))
    ) {
        return false;
    }

    // Per-type forbidden flags.
    if (bolt.forbiddenMonsterFlags & target.info.flags) {
        return false;
    }

    // Don't fire fiery bolts at fire-immune targets.
    if ((bolt.flags & BoltFlag.BF_FIERY) && target.status[StatusEffect.ImmuneToFire]) {
        return false;
    }
    // Don't fire fiery bolts when standing on combustible terrain that would harm the caster.
    if (
        (bolt.flags & BoltFlag.BF_FIERY) &&
        (ctx.burnedTerrainFlagsAtLoc(caster.loc) & ctx.avoidedFlagsForMonster(caster.info))
    ) {
        return false;
    }

    // Per-boltEffect rules.
    switch (bolt.boltEffect) {
        case BoltEffect.Beckoning:
            if (ctx.distanceBetween(caster.loc, target.loc) <= 1) {
                return false;
            }
            break;

        case BoltEffect.Attack:
            if (
                ctx.cellHasTerrainFlag(target.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                !(target.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
            ) {
                return false;
            }
            if (target.status[StatusEffect.Entranced] && ctx.monstersAreEnemies(caster, target)) {
                return false;
            }
            break;
        case BoltEffect.Damage:
            if (target.status[StatusEffect.Entranced] && ctx.monstersAreEnemies(caster, target)) {
                // Don't break an enemy's entrancement.
                return false;
            }
            break;

        case BoltEffect.None: {
            if (bolt.targetDF) {
                const dfEntry = ctx.dungeonFeatureCatalog[bolt.targetDF];
                const terrainFlags = dfEntry ? (ctx.tileCatalog[dfEntry.tile]?.flags ?? 0) : 0;
                if (
                    (terrainFlags & TerrainFlag.T_ENTANGLES) &&
                    target.status[StatusEffect.Stuck]
                ) {
                    return false;
                }
                if (
                    (bolt.flags & BoltFlag.BF_TARGET_ENEMIES) &&
                    !(terrainFlags & ctx.avoidedFlagsForMonster(target.info)) &&
                    (
                        !(terrainFlags & TerrainFlag.T_ENTANGLES) ||
                        (target.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS)
                    )
                ) {
                    return false;
                }
            }
            break;
        }

        case BoltEffect.Discord:
            if (target.status[StatusEffect.Discordant] || target === ctx.player) {
                return false;
            }
            break;

        case BoltEffect.Negation:
            if (ctx.monstersAreEnemies(caster, target)) {
                if (
                    target.status[StatusEffect.Hasted] ||
                    target.status[StatusEffect.Telepathic] ||
                    target.status[StatusEffect.Shielded]
                ) {
                    return true;
                }
                if (target.info.flags & (MonsterBehaviorFlag.MONST_DIES_IF_NEGATED | MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS)) {
                    return true;
                }
                if (
                    (target.status[StatusEffect.ImmuneToFire] || target.status[StatusEffect.Levitating]) &&
                    ctx.cellHasTerrainFlag(target.loc, TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_AUTO_DESCENT)
                ) {
                    return true;
                }
                if (
                    ctx.monstersAreTeammates(caster, target) &&
                    target.status[StatusEffect.Discordant] &&
                    !caster.status[StatusEffect.Discordant] &&
                    !(target.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED)
                ) {
                    return true;
                }
            } else if (ctx.monstersAreTeammates(caster, target)) {
                if (
                    target === ctx.player &&
                    ctx.rogue.armor &&
                    (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
                    (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) &&
                    ctx.rogue.armor.enchant2 === ArmorEnchant.Reflection &&
                    netEnchant(ctx.rogue.armor, ctx.rogue.strength, ctx.player.weaknessAmount) > 0n
                ) {
                    return false;
                }
                if (target.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED) {
                    return false;
                }
                if (
                    target.status[StatusEffect.Entranced] &&
                    caster.creatureState !== CreatureState.Ally
                ) {
                    return true;
                }
                if (target.status[StatusEffect.MagicalFear]) {
                    return true;
                }
            }
            return false; // Don't cast negation without a good reason.

        case BoltEffect.Slow:
            if (target.status[StatusEffect.Slowed]) {
                return false;
            }
            break;

        case BoltEffect.Haste:
            if (target.status[StatusEffect.Hasted]) {
                return false;
            }
            if (!targetEligibleForCombatBuff(caster, target, ctx)) {
                return false;
            }
            break;

        case BoltEffect.Shielding:
            if (target.status[StatusEffect.Shielded]) {
                return false;
            }
            if (!targetEligibleForCombatBuff(caster, target, ctx)) {
                return false;
            }
            break;

        case BoltEffect.Healing:
            if (target.currentHP >= target.info.maxHP) {
                return false;
            }
            break;

        case BoltEffect.Tunneling:
        case BoltEffect.Obstruction:
            return false;

        default:
            break;
    }

    return true;
}

// ============================================================================
// monsterCastSpell — Monsters.c:2755
// ============================================================================

/**
 * Fires a bolt from the caster at the target, logging the action if visible.
 * Checks for player death and triggers gameOver if the player was killed.
 *
 * Ported from monsterCastSpell() in Monsters.c.
 */
export function monsterCastSpell(
    caster: Creature,
    target: Creature,
    boltIndex: number,
    ctx: BoltAIContext,
): void {
    if (ctx.canDirectlySeeMonster(caster)) {
        const monstName = ctx.monsterName(caster, true);
        let buf = `${monstName} ${ctx.boltCatalog[boltIndex].description}`;
        buf = ctx.resolvePronounEscapes(buf, caster);
        ctx.combatMessage(buf, null);
    }

    const theBolt: Bolt = { ...ctx.boltCatalog[boltIndex] };
    ctx.zap(caster.loc, target.loc, theBolt, false, false);

    if (ctx.player.currentHP <= 0) {
        const casterName = ctx.monsterCatalog[caster.info.monsterID]?.monsterName ?? "a monster";
        ctx.gameOver(casterName);
    }
}

// ============================================================================
// monstUseBolt — Monsters.c:2777
// ============================================================================

/**
 * Attempts to have a monster fire a bolt. Iterates the player then all other
 * monsters as potential targets, picks the first valid one, and fires with a
 * 30% probability (or always if MONST_ALWAYS_USE_ABILITY is set).
 *
 * Returns true if the monster cast a bolt.
 *
 * Ported from monstUseBolt() in Monsters.c.
 */
export function monstUseBolt(monst: Creature, ctx: BoltAIContext): boolean {
    if (!monst.info.bolts[0]) {
        return false; // Monster has no bolt abilities.
    }

    const allTargets: Creature[] = [ctx.player, ...ctx.monsters];

    for (const target of allTargets) {
        if (!generallyValidBoltTarget(monst, target, ctx)) {
            continue;
        }
        for (let i = 0; i < monst.info.bolts.length; i++) {
            const boltType = monst.info.bolts[i];
            if (!boltType) break; // bolts array is zero-terminated

            if (ctx.boltCatalog[boltType]?.boltEffect === BoltEffect.Blinking) {
                continue; // Blinking is handled elsewhere.
            }

            if (specificallyValidBoltTarget(monst, target, boltType, ctx)) {
                const alwaysUse = !!(monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY);
                if (alwaysUse || ctx.rng.randPercent(30)) {
                    monsterCastSpell(monst, target, boltType, ctx);
                    return true;
                }
            }
        }
    }

    return false;
}

// ============================================================================
// monstUseMagic — Monsters.c:2808
// ============================================================================

/**
 * Attempts summoning, then bolt-casting.
 * Returns true if the monster used its turn on magic.
 *
 * Ported from monstUseMagic() in Monsters.c.
 */
export function monstUseMagic(monst: Creature, ctx: BoltAIContext): boolean {
    const alwaysUse = !!(monst.info.flags & MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY);
    if (ctx.monsterSummons(monst, alwaysUse)) {
        return true;
    }
    return monstUseBolt(monst, ctx);
}

// ============================================================================
// monsterHasBoltEffect — Monsters.c:2079
// ============================================================================

/**
 * Returns the bolt type if the monster has a bolt with the given effect.
 * Returns 0 (BOLT_NONE) if no matching bolt is found.
 *
 * Ported from monsterHasBoltEffect() in Monsters.c.
 */
export function monsterHasBoltEffect(
    monst: Creature,
    boltEffectIndex: number,
    boltCatalog: readonly Bolt[],
): number {
    for (let i = 0; i < monst.info.bolts.length && monst.info.bolts[i] !== 0; i++) {
        if (boltCatalog[monst.info.bolts[i]]?.boltEffect === boltEffectIndex) {
            return monst.info.bolts[i];
        }
    }
    return 0;
}

// ============================================================================
// monsterCanShootWebs — Monsters.c:1608
// ============================================================================

/**
 * Returns true if the monster has a bolt whose path-spawned dungeon feature
 * entangles targets (i.e. the monster can shoot webs).
 *
 * Ported from monsterCanShootWebs() in Monsters.c.
 */
export function monsterCanShootWebs(
    monst: Creature,
    boltCatalog: readonly Bolt[],
    tileCatalog: readonly FloorTileType[],
    dungeonFeatureCatalog: readonly DungeonFeature[],
): boolean {
    for (let i = 0; i < monst.info.bolts.length && monst.info.bolts[i] !== 0; i++) {
        const theBolt = boltCatalog[monst.info.bolts[i]];
        if (theBolt?.pathDF) {
            const df = dungeonFeatureCatalog[theBolt.pathDF];
            if (df && (tileCatalog[df.tile]?.flags ?? 0) & TerrainFlag.T_ENTANGLES) {
                return true;
            }
        }
    }
    return false;
}
