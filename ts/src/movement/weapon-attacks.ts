/*
 *  weapon-attacks.ts — Extended weapon attack helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: abortAttackAgainstAcidicTarget, abortAttackAgainstDiscordantAlly,
 *             abortAttack, handleWhipAttacks, handleSpearAttacks, buildFlailHitList
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos, Item } from "../types/types.js";
import { StatusEffect, CreatureState, BoltType, WeaponEnchant } from "../types/enums.js";
import {
    TerrainFlag,
    MonsterBehaviorFlag, MonsterBookkeepingFlag, MonsterAbilityFlag,
    ItemFlag,
} from "../types/flags.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Bolt-like structure for the whip attack.
 */
export interface BoltInfo {
    theChar: number;
    // Other bolt fields as needed for zap()
}

/**
 * Context for weapon attack functions.
 */
export interface WeaponAttackContext {
    // ── State ──
    pmap: Pcell[][];
    player: Creature;
    rogue: {
        weapon: Item | null;
        playbackFastForward: boolean;
    };
    nbDirs: readonly [number, number][];

    // ── Map queries ──
    coordinatesAreInMap(x: number, y: number): boolean;
    isPosInMap(pos: Pos): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;

    // ── Monster queries ──
    monsterAtLoc(loc: Pos): Creature | null;
    canSeeMonster(monst: Creature): boolean;
    monsterIsHidden(monst: Creature, observer: Creature): boolean;
    monsterWillAttackTarget(attacker: Creature, defender: Creature): boolean;
    monsterIsInClass(monst: Creature, monsterClass: number): boolean;
    monstersAreEnemies(a: Creature, b: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    distanceBetween(a: Pos, b: Pos): number;

    // ── Item queries ──
    itemName(item: Item, includeDetails: boolean, includeArticle: boolean): string;

    // ── Combat ──
    attack(attacker: Creature, defender: Creature, lungeAttack: boolean): boolean;

    // ── Bolt system ──
    boltCatalog: readonly BoltInfo[];
    getImpactLoc(origin: Pos, target: Pos, maxDistance: number, returnLastEmpty: boolean, bolt: BoltInfo | null): Pos;
    zap(origin: Pos, target: Pos, bolt: BoltInfo, hideDetails: boolean, boltInView: boolean): void;

    // ── UI ──
    confirm(prompt: string, defaultYes: boolean): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;
    plotForegroundChar(ch: number, x: number, y: number, color: unknown, isOverlay: boolean): void;
    pauseAnimation(frames: number, behavior: number): void;
    refreshDungeonCell(loc: Pos): void;
    lightBlue: unknown;

    // ── All monsters (for buildFlailHitList) ──
    allMonsters(): Creature[];
}

// =============================================================================
// Bolt character tables (for visual effects)
// =============================================================================

/** Characters used for whip attack visual: ||~~\//\ indexed by direction */
const WHIP_BOLT_CHARS: readonly number[] = [
    0x7C, 0x7C, 0x7E, 0x7E, 0x5C, 0x2F, 0x2F, 0x5C, // | | ~ ~ \ / / backslash
];

/** Characters used for spear attack visual: ||--\//\ indexed by direction */
const SPEAR_BOLT_CHARS: readonly number[] = [
    0x7C, 0x7C, 0x2D, 0x2D, 0x5C, 0x2F, 0x2F, 0x5C, // | | - - \ / / backslash
];

// =============================================================================
// abortAttackAgainstAcidicTarget — from Movement.c:558
// =============================================================================

/**
 * Asks the player for confirmation before attacking an acidic monster
 * that would degrade the player's weapon. Returns true to abort.
 *
 * C: static boolean abortAttackAgainstAcidicTarget(const creature *hitList[8])
 */
export function abortAttackAgainstAcidicTarget(
    hitList: (Creature | null)[],
    ctx: WeaponAttackContext,
): boolean {
    if (!ctx.rogue.weapon || (ctx.rogue.weapon.flags & ItemFlag.ITEM_PROTECTED)) {
        return false;
    }

    for (let i = 0; i < hitList.length && i < 8; i++) {
        const target = hitList[i];
        if (
            target &&
            (target.info.flags & MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON) &&
            ctx.canSeeMonster(target) &&
            (
                !(ctx.rogue.weapon.flags & ItemFlag.ITEM_RUNIC) ||
                !(ctx.rogue.weapon.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) ||
                ctx.rogue.weapon.enchant2 !== WeaponEnchant.Slaying ||
                !ctx.monsterIsInClass(target, ctx.rogue.weapon.vorpalEnemy)
            )
        ) {
            const monstName = ctx.monsterName(target, true);
            const weaponName = ctx.itemName(ctx.rogue.weapon, false, false);
            if (ctx.confirm(`Degrade your ${weaponName} by attacking ${monstName}?`, false)) {
                return false; // Fire when ready!
            } else {
                return true; // Abort!
            }
        }
    }
    return false;
}

// =============================================================================
// abortAttackAgainstDiscordantAlly — from Movement.c:591
// =============================================================================

/**
 * Asks the player for confirmation before attacking a discordant ally.
 * Returns true to abort.
 *
 * C: static boolean abortAttackAgainstDiscordantAlly(const creature *hitList[8])
 */
export function abortAttackAgainstDiscordantAlly(
    hitList: (Creature | null)[],
    ctx: WeaponAttackContext,
): boolean {
    for (let i = 0; i < hitList.length && i < 8; i++) {
        const target = hitList[i];
        if (
            target &&
            target.creatureState === CreatureState.Ally &&
            target.status[StatusEffect.Discordant] &&
            ctx.canSeeMonster(target)
        ) {
            const monstName = ctx.monsterName(target, true);
            if (ctx.confirm(`Are you sure you want to attack ${monstName}?`, false)) {
                return false; // Don't abort.
            } else {
                return true; // Abort!
            }
        }
    }
    return false;
}

// =============================================================================
// abortAttack — from Movement.c:617
// =============================================================================

/**
 * Determines if a player attack should be aborted. Shows confirmation
 * dialogs for acidic monsters and discordant allies, unless the player
 * is confused or hallucinating (but not telepathic).
 *
 * C: static boolean abortAttack(const creature *hitList[8])
 */
export function abortAttack(
    hitList: (Creature | null)[],
    ctx: WeaponAttackContext,
): boolean {
    // Too bad if confused or hallucinating (but not telepathic)
    if (
        ctx.player.status[StatusEffect.Confused] ||
        (ctx.player.status[StatusEffect.Hallucinating] && !ctx.player.status[StatusEffect.Telepathic])
    ) {
        return false;
    }

    return (
        abortAttackAgainstAcidicTarget(hitList, ctx) ||
        abortAttackAgainstDiscordantAlly(hitList, ctx)
    );
}

// =============================================================================
// handleWhipAttacks — from Movement.c:638
// =============================================================================

/**
 * Checks for and executes a whip-style extended-range melee attack.
 * Returns true if a whip attack was launched.
 *
 * C: boolean handleWhipAttacks(creature *attacker, enum directions dir, boolean *aborted)
 *
 * @param aborted - An object with a `value` field; set to true if the player
 *   opted not to attack (as opposed to there being no valid whip target).
 */
export function handleWhipAttacks(
    attacker: Creature,
    dir: number,
    aborted: { value: boolean },
    ctx: WeaponAttackContext,
): boolean {
    const isPlayer = attacker === ctx.player;

    // Check if attacker has whip capability
    if (isPlayer) {
        if (!ctx.rogue.weapon || !(ctx.rogue.weapon.flags & ItemFlag.ITEM_ATTACKS_EXTEND)) {
            return false;
        }
    } else if (!(attacker.info.abilityFlags & MonsterAbilityFlag.MA_ATTACKS_EXTEND)) {
        return false;
    }

    const originLoc = attacker.loc;
    const targetLoc: Pos = {
        x: originLoc.x + ctx.nbDirs[dir][0],
        y: originLoc.y + ctx.nbDirs[dir][1],
    };

    // Must not be diagonally blocked
    if (ctx.diagonalBlocked(originLoc.x, originLoc.y, targetLoc.x, targetLoc.y, isPlayer)) {
        return false;
    }

    // Find impact location (up to range 5)
    const strikeLoc = ctx.getImpactLoc(originLoc, targetLoc, 5, false, ctx.boltCatalog[BoltType.WHIP]);

    const defender = ctx.monsterAtLoc(strikeLoc);
    if (
        defender &&
        (!isPlayer || ctx.canSeeMonster(defender)) &&
        !ctx.monsterIsHidden(defender, attacker) &&
        ctx.monsterWillAttackTarget(attacker, defender)
    ) {
        if (isPlayer) {
            const hitList: (Creature | null)[] = new Array(8).fill(null);
            hitList[0] = defender;
            if (abortAttack(hitList, ctx)) {
                aborted.value = true;
                return false;
            }
        }

        attacker.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
        const theBolt: BoltInfo = { ...ctx.boltCatalog[BoltType.WHIP] };
        theBolt.theChar = WHIP_BOLT_CHARS[dir];
        ctx.zap(originLoc, targetLoc, theBolt, false, false);
        return true;
    }
    return false;
}

// =============================================================================
// handleSpearAttacks — from Movement.c:695
// =============================================================================

/**
 * Checks for and executes a spear-style piercing attack.
 * Returns true if a spear attack was launched.
 *
 * C: boolean handleSpearAttacks(creature *attacker, enum directions dir, boolean *aborted)
 *
 * @param aborted - An object with a `value` field; set to true if the player
 *   opted not to attack (as opposed to there being no valid spear target).
 */
export function handleSpearAttacks(
    attacker: Creature,
    dir: number,
    aborted: { value: boolean },
    ctx: WeaponAttackContext,
): boolean {
    const isPlayer = attacker === ctx.player;
    const hitList: (Creature | null)[] = new Array(8).fill(null);
    let range = 2;
    let h = 0;
    let proceed = false;
    let visualEffect = false;

    // Check if attacker has spear capability
    if (isPlayer) {
        if (!ctx.rogue.weapon || !(ctx.rogue.weapon.flags & ItemFlag.ITEM_ATTACKS_PENETRATE)) {
            return false;
        }
    } else if (!(attacker.info.abilityFlags & MonsterAbilityFlag.MA_ATTACKS_PENETRATE)) {
        return false;
    }

    // Must not be diagonally blocked in attack direction
    const neighborLoc: Pos = {
        x: attacker.loc.x + ctx.nbDirs[dir][0],
        y: attacker.loc.y + ctx.nbDirs[dir][1],
    };
    if (ctx.diagonalBlocked(attacker.loc.x, attacker.loc.y, neighborLoc.x, neighborLoc.y, isPlayer)) {
        return false;
    }

    // Scan for targets along the spear path
    for (let i = 0; i < range; i++) {
        const targetLoc: Pos = {
            x: attacker.loc.x + (1 + i) * ctx.nbDirs[dir][0],
            y: attacker.loc.y + (1 + i) * ctx.nbDirs[dir][1],
        };
        if (!ctx.isPosInMap(targetLoc)) {
            break;
        }

        const defender = ctx.monsterAtLoc(targetLoc);
        if (
            defender &&
            (
                !ctx.cellHasTerrainFlag(targetLoc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                (defender.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
            ) &&
            ctx.monsterWillAttackTarget(attacker, defender)
        ) {
            hitList[h++] = defender;

            if (
                i === 0 ||
                (
                    !ctx.monsterIsHidden(defender, attacker) &&
                    (!isPlayer || ctx.canSeeMonster(defender))
                )
            ) {
                proceed = true;
            }
        }

        if (ctx.cellHasTerrainFlag(targetLoc, TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION)) {
            break;
        }

        // Update effective range
        range = i + 1;
    }

    if (proceed) {
        if (isPlayer) {
            if (abortAttack(hitList, ctx)) {
                aborted.value = true;
                return false;
            }
        }

        // Visual effect
        if (!ctx.rogue.playbackFastForward) {
            for (let i = 0; i < range; i++) {
                const targetLoc: Pos = {
                    x: attacker.loc.x + (1 + i) * ctx.nbDirs[dir][0],
                    y: attacker.loc.y + (1 + i) * ctx.nbDirs[dir][1],
                };
                if (ctx.isPosInMap(targetLoc) && ctx.playerCanSeeOrSense(targetLoc.x, targetLoc.y)) {
                    visualEffect = true;
                    ctx.plotForegroundChar(SPEAR_BOLT_CHARS[dir], targetLoc.x, targetLoc.y, ctx.lightBlue, true);
                }
            }
        }

        attacker.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;

        // Attack in reverse order (so spears of force send both monsters flying)
        for (let i = h - 1; i >= 0; i--) {
            ctx.attack(attacker, hitList[i]!, false);
        }

        // Clean up visual effect
        if (visualEffect) {
            ctx.pauseAnimation(16, 0 /* PAUSE_BEHAVIOR_DEFAULT */);
            for (let i = 0; i < range; i++) {
                const targetLoc: Pos = {
                    x: attacker.loc.x + (1 + i) * ctx.nbDirs[dir][0],
                    y: attacker.loc.y + (1 + i) * ctx.nbDirs[dir][1],
                };
                if (ctx.isPosInMap(targetLoc)) {
                    ctx.refreshDungeonCell(targetLoc);
                }
            }
        }
        return true;
    }
    return false;
}

// =============================================================================
// buildFlailHitList — from Movement.c:801
// =============================================================================

/**
 * Builds a hit list of enemies adjacent to both the player's current position
 * and the destination position, for flail-style area attacks.
 *
 * C: static void buildFlailHitList(const short x, const short y, const short newX, const short newY, const creature *hitList[16])
 */
export function buildFlailHitList(
    x: number,
    y: number,
    newX: number,
    newY: number,
    hitList: (Creature | null)[],
    ctx: WeaponAttackContext,
): void {
    let idx = 0;

    for (const monst of ctx.allMonsters()) {
        if (
            ctx.distanceBetween({ x, y }, monst.loc) === 1 &&
            ctx.distanceBetween({ x: newX, y: newY }, monst.loc) === 1 &&
            ctx.canSeeMonster(monst) &&
            ctx.monstersAreEnemies(ctx.player, monst) &&
            monst.creatureState !== CreatureState.Ally &&
            !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
            (
                !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
            )
        ) {
            // Find next empty slot
            while (hitList[idx]) {
                idx++;
            }
            hitList[idx] = monst;
        }
    }
}
