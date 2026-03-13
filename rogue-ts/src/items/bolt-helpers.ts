/*
 *  items/bolt-helpers.ts — Bolt system helper functions
 *  brogue-ts
 *
 *  Ported from Items.c:
 *    impermissibleKinkBetween (3605) — private; used internally by tunnelize
 *    tunnelize (3631)               — remove blocking terrain; fix diagonal kinks
 *    negationWillAffectMonster (3690) — check if negation bolt affects a monster
 *    projectileReflects (4206)      — check if a bolt is reflected by its target
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos, Item, Bolt, FloorTileType, Mutation, MonsterClass } from "../types/types.js";
import {
    TerrainFlag,
    TileFlag,
    BoltFlag,
    MonsterAbilityFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MA_NON_NEGATABLE_ABILITIES,
    NEGATABLE_TRAITS,
    ItemFlag,
} from "../types/flags.js";
import {
    StatusEffect,
    DungeonFeatureType,
    DungeonLayer,
    TileType,
    ArmorEnchant,
} from "../types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../types/constants.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import { netEnchant } from "./item-usage.js";
import { reflectionChance } from "../power/power-tables.js";
import { monsterIsInClass, monstersAreEnemies } from "../monsters/monster-queries.js";

// =============================================================================
// impermissibleKinkBetween — from Items.c:3605 (private)
// =============================================================================

/**
 * Returns true if (x1,y1) and (x2,y2) are unobstructed and diagonally adjacent,
 * but both common neighbor cells are obstructed by passability-blocking terrain
 * and at least one of them also blocks diagonal movement.
 *
 * Used by tunnelize to detect corners that need recursive correction.
 *
 * C: static boolean impermissibleKinkBetween(short x1, short y1, short x2, short y2)
 */
function impermissibleKinkBetween(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cellHasTerrainFlag: (pos: Pos, flags: number) => boolean,
): boolean {
    if (
        cellHasTerrainFlag({ x: x1, y: y1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
        cellHasTerrainFlag({ x: x2, y: y2 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    ) {
        // One of the two locations is obstructed.
        return false;
    }
    if (Math.abs(x1 - x2) !== 1 || Math.abs(y1 - y2) !== 1) {
        // Not diagonally adjacent.
        return false;
    }
    if (
        !cellHasTerrainFlag({ x: x2, y: y1 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
        !cellHasTerrainFlag({ x: x1, y: y2 }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    ) {
        // At least one common neighbor isn't obstructed.
        return false;
    }
    if (
        !cellHasTerrainFlag({ x: x2, y: y1 }, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT) &&
        !cellHasTerrainFlag({ x: x1, y: y2 }, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
    ) {
        // Neither common neighbor obstructs diagonal movement.
        return false;
    }
    return true;
}

// =============================================================================
// TunnelizeContext + tunnelize — from Items.c:3631
// =============================================================================

/**
 * Dependencies for the tunnelize function.
 */
export interface TunnelizeContext {
    /** The dungeon map. */
    pmap: Pcell[][];
    /** Tile definition catalog (indexed by TileType). */
    tileCatalog: readonly FloorTileType[];
    /** Check if a cell has any of the given terrain flags. */
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    /** Spawn a dungeon feature at (x, y). */
    spawnDungeonFeature(
        x: number,
        y: number,
        dfType: DungeonFeatureType,
        refreshCell: boolean,
        abortIfBlocking: boolean,
    ): void;
    /** Return the creature at the given position, or null. */
    monsterAtLoc(pos: Pos): Creature | null;
    /** Inflict enough damage to kill the defender immediately. */
    inflictLethalDamage(attacker: Creature | null, defender: Creature): void;
    /** Kill the creature. */
    killCreature(monst: Creature, administrativeDeath: boolean): void;
    /** Free any captive monster embedded in terrain at (x, y). */
    freeCaptivesEmbeddedAt(x: number, y: number): void;
    /** Random percentage check: returns true pct% of the time. */
    randPercent(pct: number): boolean;
}

/**
 * Remove passability-obstructing terrain at (x, y) via a tunneling bolt.
 *
 * Boundary walls are replaced with crystal walls (indestructible) rather
 * than dissolved. Any turret or sentinel embedded at the tunneled location
 * is killed. After tunneling, diagonal kinks between newly opened cells and
 * adjacent walls are fixed recursively.
 *
 * Returns true if any terrain was changed.
 *
 * C: static boolean tunnelize(short x, short y) — Items.c:3631
 */
export function tunnelize(x: number, y: number, ctx: TunnelizeContext): boolean {
    const { pmap, tileCatalog } = ctx;

    if (pmap[x][y].flags & TileFlag.IMPREGNABLE) {
        return false;
    }

    ctx.freeCaptivesEmbeddedAt(x, y);

    let didSomething = false;

    if (x === 0 || x === DCOLS - 1 || y === 0 || y === DROWS - 1) {
        // Don't dissolve boundary walls — convert to crystal wall instead.
        pmap[x][y].layers[DungeonLayer.Dungeon] = TileType.CRYSTAL_WALL;
        didSomething = true;
    } else {
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            const tileFlags = tileCatalog[pmap[x][y].layers[layer]]?.flags ?? 0;
            if (tileFlags & (TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION)) {
                pmap[x][y].layers[layer] =
                    layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING;
                didSomething = true;
            }
        }
    }

    if (didSomething) {
        ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_TUNNELIZE, true, false);
        if (pmap[x][y].flags & TileFlag.HAS_MONSTER) {
            // Kill turrets and sentinels if you tunnelize them.
            const monst = ctx.monsterAtLoc({ x, y });
            if (monst && (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)) {
                ctx.inflictLethalDamage(null, monst);
                ctx.killCreature(monst, false);
            }
        }
    }

    if (!ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT) && didSomething) {
        // Tunnel out any diagonal kinks between walls.
        for (let dir = 0; dir < 8; dir++) {
            const x2 = x + nbDirs[dir][0];
            const y2 = y + nbDirs[dir][1];
            if (
                coordinatesAreInMap(x2, y2) &&
                impermissibleKinkBetween(x, y, x2, y2, ctx.cellHasTerrainFlag)
            ) {
                if (
                    (pmap[x][y2].flags & TileFlag.IMPREGNABLE) ||
                    (!(pmap[x2][y].flags & TileFlag.IMPREGNABLE) && ctx.randPercent(50))
                ) {
                    tunnelize(x2, y, ctx);
                } else {
                    tunnelize(x, y2, ctx);
                }
            }
        }
    }

    return didSomething;
}

// =============================================================================
// negationWillAffectMonster — from Items.c:3690
// =============================================================================

/**
 * Returns true if a negation bolt or blast will have any effect on the monster.
 *
 * Negation bolts are reflected by MA_REFLECT_100 monsters before reaching them,
 * so the function returns false for those. Negation never affects the warden
 * (MONST_INVULNERABLE).
 *
 * C: static boolean negationWillAffectMonster(creature *monst, boolean isBolt)
 *    — Items.c:3690
 *
 * @param monst          The monster to check.
 * @param isBolt         True for a negation bolt; false for a negation blast.
 * @param boltCatalog    The bolt catalog (for BF_NOT_NEGATABLE check).
 * @param mutationCatalog The mutation catalog (for canBeNegated check).
 */
export function negationWillAffectMonster(
    monst: Creature,
    isBolt: boolean,
    boltCatalog: readonly Bolt[],
    mutationCatalog: readonly Mutation[],
): boolean {
    // Negation bolts don't affect always-reflecting monsters; negation
    // never affects the warden (MONST_INVULNERABLE).
    if (
        (isBolt && (monst.info.abilityFlags & MonsterAbilityFlag.MA_REFLECT_100)) ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)
    ) {
        return false;
    }

    if (
        (monst.info.abilityFlags & ~MA_NON_NEGATABLE_ABILITIES) ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED) ||
        (monst.info.flags & NEGATABLE_TRAITS) ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE) ||
        ((monst.info.flags & MonsterBehaviorFlag.MONST_FIERY) && monst.status[StatusEffect.Burning]) ||
        monst.status[StatusEffect.ImmuneToFire] ||
        monst.status[StatusEffect.Slowed] ||
        monst.status[StatusEffect.Hasted] ||
        monst.status[StatusEffect.Confused] ||
        monst.status[StatusEffect.Entranced] ||
        monst.status[StatusEffect.Discordant] ||
        monst.status[StatusEffect.Shielded] ||
        monst.status[StatusEffect.Invisible] ||
        monst.status[StatusEffect.MagicalFear] ||
        monst.status[StatusEffect.Levitating] ||
        monst.movementSpeed !== monst.info.movementSpeed ||
        monst.attackSpeed !== monst.info.attackSpeed ||
        (monst.mutationIndex > -1 && (mutationCatalog[monst.mutationIndex]?.canBeNegated ?? false))
    ) {
        return true;
    }

    // Any negatable bolts?
    for (let i = 0; i < 20; i++) {
        const boltType = monst.info.bolts[i];
        if (boltType && !(boltCatalog[boltType]?.flags & BoltFlag.BF_NOT_NEGATABLE)) {
            return true;
        }
    }

    return false;
}

// =============================================================================
// ProjectileReflectsContext + projectileReflects — from Items.c:4206
// =============================================================================

/**
 * Dependencies for the projectileReflects function.
 */
export interface ProjectileReflectsContext {
    /** The player creature. */
    player: Creature;
    /** Relevant rogue state for armor/strength calculations. */
    rogue: {
        armor: Item | null;
        strength: number;
        weaknessAmount: number;
    };
    /** Monster class catalog (indexed by vorpalEnemy value). */
    monsterClassCatalog: readonly MonsterClass[];
    /** Check if a cell has any of the given terrain flags (for monstersAreEnemies). */
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    /** Random percentage check. */
    randPercent(pct: number): boolean;
}

/**
 * Returns true if the attacker's bolt is reflected by the defender.
 *
 * Reflection can come from:
 * - Immunity armor (always reflects the vorpal enemy's attacks)
 * - Reflection armor (probability based on enchant level)
 * - MA_REFLECT_100 ability (always reflects)
 * - MONST_REFLECT_50 flag (adds 4 enchant levels worth of reflection chance)
 *
 * C: boolean projectileReflects(creature *attacker, creature *defender)
 *    — Items.c:4206
 *
 * @param attacker The creature firing the bolt.
 * @param defender The creature the bolt is traveling toward (may be null).
 * @param ctx      The context (player, rogue state, terrain check, RNG).
 */
export function projectileReflects(
    attacker: Creature,
    defender: Creature | null,
    ctx: ProjectileReflectsContext,
): boolean {
    const { player, rogue } = ctx;

    // Immunity armor always reflects its vorpal enemy's projectiles.
    if (
        defender === player &&
        rogue.armor &&
        (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
        rogue.armor.enchant2 === ArmorEnchant.Immunity
    ) {
        const vorpalClass = ctx.monsterClassCatalog[rogue.armor.vorpalEnemy];
        if (
            vorpalClass &&
            monsterIsInClass(attacker, vorpalClass) &&
            monstersAreEnemies(attacker, defender, player, ctx.cellHasTerrainFlag)
        ) {
            return true;
        }
    }

    let netReflectionLevel = 0n;

    if (
        defender === player &&
        rogue.armor &&
        (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
        rogue.armor.enchant2 === ArmorEnchant.Reflection
    ) {
        netReflectionLevel = netEnchant(rogue.armor, rogue.strength, rogue.weaknessAmount);
    }

    if (defender && (defender.info.abilityFlags & MonsterAbilityFlag.MA_REFLECT_100)) {
        return true;
    }

    if (defender && (defender.info.flags & MonsterBehaviorFlag.MONST_REFLECT_50)) {
        netReflectionLevel += 4n * FP_FACTOR;
    }

    if (netReflectionLevel <= 0n) {
        return false;
    }

    const prob = reflectionChance(netReflectionLevel);
    return ctx.randPercent(prob);
}
