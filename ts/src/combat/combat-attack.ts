/*
 *  combat-attack.ts — Attack resolution: hit lists, staggering, moral effects, main attack loop
 *  brogue-ts
 *
 *  Ported from: src/brogue/Combat.c
 *  Functions: buildHitList, processStaggerHit, moralAttack, attack
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, Color, Pos, MonsterClass } from "../types/types.js";
import { StatusEffect, CreatureState, Direction } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    ItemFlag,
    TerrainFlag,
    SPECIAL_HIT,
} from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { nbDirs, cDirs, coordinatesAreInMap } from "../globals/tables.js";
import { monsterDamageAdjustmentAmount, attackHit, diagonalBlocked } from "./combat-math.js";
import type { CombatMathContext } from "./combat-math.js";
import { inflictDamage, killCreature } from "./combat-damage.js";
import type { CombatDamageContext } from "./combat-damage.js";
import { distanceBetween } from "../monsters/monster-state.js";

// =============================================================================
// Context
// =============================================================================

/**
 * Full context for attack resolution.
 * Extends both CombatMathContext and CombatDamageContext, plus attack-specific callbacks.
 */
export interface AttackContext extends CombatMathContext, CombatDamageContext {
    // ── Map queries ──
    /** Get cell flags (HAS_MONSTER | HAS_PLAYER, etc.). */
    cellFlags(loc: Pos): number;
    /** Check if cell has terrain flag. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Get terrain flags at a position. */
    getTerrainFlags(loc: Pos): number;
    /** Find the creature at a location. */
    monsterAtLoc(loc: Pos): Creature | null;
    /** Move a creature to a new position. */
    setMonsterLocation(monst: Creature, loc: Pos): void;

    // ── Creature queries ──
    /** Check if attacker will attack target. */
    monsterWillAttackTarget(attacker: Creature, defender: Creature): boolean;
    /** Check if monster is in a monster class. */
    monsterIsInClass(monst: Creature, monsterClass: MonsterClass): boolean;

    // ── RNG ──
    /** Random number in range [lo, hi]. */
    randRange(lo: number, hi: number): number;
    /** Random clumped value from a damage range. */
    randClump(damage: { lowerBound: number; upperBound: number; clumpFactor: number }): number;

    // ── Rogue state ──
    /** Whether combat text is blocked. */
    blockCombatText: boolean;
    /** Set the disturbed flag. */
    setDisturbed(): void;
    /** Reaping enchant value (0 = none). */
    reaping: number;

    // ── Attack effects (injected from 6d) ──
    /** Apply weapon runic effects (magicWeaponHit). */
    magicWeaponHit(defender: Creature, weapon: Item, wasSneakOrSleep: boolean): void;
    /** Apply armor runic effects, returns description string. */
    applyArmorRunicEffect(attacker: Creature, damage: { value: number }, firstHit: boolean): string;
    /** Apply special monster hit abilities. */
    specialHit(attacker: Creature, defender: Creature, damage: number): void;
    /** Process jelly splitting (splitMonster). */
    splitMonster(defender: Creature, attacker: Creature): void;

    // ── Display ──
    /** Get the attack verb based on damage percentage. */
    attackVerb(damagePercent: number): string;
    /** Get a color based on the victim for combat messages. */
    messageColorFromVictim(defender: Creature): Color;
    /** Get a monster's display name for combat messages. */
    monsterName(monst: Creature, includeArticle: boolean): string;
    /** Resolve $HESHE, $HISHER, $HIMHER pronoun escapes. */
    resolvePronounEscapes(text: string, monst: Creature): string;

    // ── Weapon degradation / tracking ──
    /** Decrement weapon auto-ID timer. */
    decrementWeaponAutoIDTimer(): void;
    /** Recharge items incrementally. */
    rechargeItemsIncrementally(amount: number): void;
    /** Equip an item (for re-equipping degraded weapon). */
    equipItem(item: Item, force: boolean): void;
    /** Get item display name. */
    itemName(item: Item): string;
    /** Check for weapon disenchantment. */
    checkForDisenchantment(item: Item): void;
    /** Strength check for armor burden. */
    strengthCheck(item: Item, force: boolean): void;
    /** Item message color. */
    itemMessageColor: Color;

    // ── Feat tracking ──
    /** Handle paladin feat check. */
    handlePaladinFeat(defender: Creature): void;
    /** Track pure mage feat. */
    setPureMageFeatFailed(): void;
    /** Track dragonslayer feat. */
    setDragonslayerFeatAchieved(): void;
    /** Report heard combat this turn. Returns whether it was already reported. */
    reportHeardCombat(): boolean;

    // ── Combat text ──
    /** The white color constant. */
    whiteColor: Color;
    /** The red color constant (for hit flashes). */
    redColor: Color;

    // ── Game over ──
    /** Game over from monster killing player. */
    gameOverFromMonster(monsterName: string): void;

    // ── Un-ally ──
    /** Remove ally status from a creature. */
    unAlly(monst: Creature): void;
    /** Alert a monster that the player is nearby. */
    alertMonster(monst: Creature): void;
}

// =============================================================================
// buildHitList — from Combat.c:1744
// =============================================================================

/**
 * Build a list of creatures that will be hit by an attack.
 * For non-sweep attacks, only the primary target is hit.
 * For sweep attacks (axes), all adjacent enemies in a circle are hit.
 *
 * C: void buildHitList(const creature **hitList, const creature *attacker,
 *                       creature *defender, const boolean sweep)
 *
 * @param attacker The attacking creature.
 * @param defender The primary target.
 * @param sweep Whether this is a sweep (axe) attack.
 * @param ctx Attack context.
 * @returns Array of up to 8 creatures to hit (null entries for empty slots).
 */
export function buildHitList(
    attacker: Creature,
    defender: Creature,
    sweep: boolean,
    ctx: AttackContext,
): (Creature | null)[] {
    const hitList: (Creature | null)[] = new Array(8).fill(null);

    const x = attacker.loc.x;
    const y = attacker.loc.y;
    const newX = defender.loc.x;
    const newY = defender.loc.y;

    // Find the direction from attacker to defender
    let dir = Direction.NoDirection as number;
    for (let i = 0; i < Direction.DirectionCount; i++) {
        if (nbDirs[i][0] === newX - x && nbDirs[i][1] === newY - y) {
            dir = i;
            break;
        }
    }

    if (sweep) {
        if (dir === Direction.NoDirection) {
            dir = 0; // Just pick one (UP in C, 0 in our cDirs)
        }
        for (let i = 0; i < 8; i++) {
            const newDir = (dir + i) % Direction.DirectionCount;
            const newestX = x + cDirs[newDir][0];
            const newestY = y + cDirs[newDir][1];
            if (coordinatesAreInMap(newestX, newestY)) {
                const cellFl = ctx.cellFlags({ x: newestX, y: newestY });
                if (cellFl & 0x3) { // HAS_MONSTER | HAS_PLAYER (typically Fl(6) | Fl(7) but we use a mask)
                    const target = ctx.monsterAtLoc({ x: newestX, y: newestY });
                    if (
                        target &&
                        ctx.monsterWillAttackTarget(attacker, target) &&
                        (!ctx.cellHasTerrainFlag(target.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                            (target.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS))
                    ) {
                        hitList[i] = target;
                    }
                }
            }
        }
    } else {
        hitList[0] = defender;
    }

    return hitList;
}

// =============================================================================
// processStaggerHit — from Combat.c:999
// =============================================================================

/**
 * Push a defender away from the attacker by one cell (stagger effect).
 * Only works if the destination is passable and unoccupied.
 * Does nothing for invulnerable, immobile, inanimate, or captive creatures.
 *
 * C: void processStaggerHit(creature *attacker, creature *defender)
 *
 * @param attacker The attacking creature.
 * @param defender The defending creature.
 * @param ctx Attack context.
 */
export function processStaggerHit(
    attacker: Creature,
    defender: Creature,
    ctx: AttackContext,
): void {
    if (
        (defender.info.flags &
            (MonsterBehaviorFlag.MONST_INVULNERABLE |
                MonsterBehaviorFlag.MONST_IMMOBILE |
                MonsterBehaviorFlag.MONST_INANIMATE)) ||
        (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) ||
        ctx.cellHasTerrainFlag(defender.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    ) {
        return;
    }

    const dx = Math.max(-1, Math.min(1, defender.loc.x - attacker.loc.x));
    const dy = Math.max(-1, Math.min(1, defender.loc.y - attacker.loc.y));
    const newX = defender.loc.x + dx;
    const newY = defender.loc.y + dy;

    if (
        coordinatesAreInMap(newX, newY) &&
        !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !(ctx.cellFlags({ x: newX, y: newY }) & 0x3) // No monster or player at destination
    ) {
        ctx.setMonsterLocation(defender, { x: newX, y: newY });
    }
}

// =============================================================================
// moralAttack — from Combat.c:316
// =============================================================================

/**
 * Apply moral effects of a direct damage attack.
 * Wakes paralyzed defenders, clears magical fear, entrancement,
 * enrages corridor-avoiding monsters, and handles ally betrayal.
 *
 * C: void moralAttack(creature *attacker, creature *defender)
 *
 * @param attacker The attacking creature.
 * @param defender The defending creature.
 * @param ctx Attack context.
 */
export function moralAttack(
    attacker: Creature,
    defender: Creature,
    ctx: AttackContext,
): void {
    if (
        defender.currentHP > 0 &&
        !(defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)
    ) {
        // Break paralysis
        if (defender.status[StatusEffect.Paralyzed]) {
            defender.status[StatusEffect.Paralyzed] = 0;
            // Paralyzed creature gets a turn to react before the attacker moves again.
            defender.ticksUntilTurn = Math.min(attacker.attackSpeed, 100) - 1;
        }
        // Reduce magical fear
        if (defender.status[StatusEffect.MagicalFear]) {
            defender.status[StatusEffect.MagicalFear] = 1;
        }
        // Break entrancement
        defender.status[StatusEffect.Entranced] = 0;

        // Enrage corridor-avoiders
        if (defender.info.abilityFlags & MonsterAbilityFlag.MA_AVOID_CORRIDORS) {
            defender.status[StatusEffect.Enraged] = 4;
            defender.maxStatus[StatusEffect.Enraged] = 4;
        }

        // Player attacking an ally (without confusion/discord) breaks ally bond
        if (
            attacker === ctx.player &&
            defender.creatureState === CreatureState.Ally &&
            !defender.status[StatusEffect.Discordant] &&
            !attacker.status[StatusEffect.Confused] &&
            !(attacker.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)
        ) {
            ctx.unAlly(defender);
        }

        // Alert enemy when attacked by player or allies
        if (
            (attacker === ctx.player || attacker.creatureState === CreatureState.Ally) &&
            defender !== ctx.player &&
            defender.creatureState !== CreatureState.Ally
        ) {
            ctx.alertMonster(defender);
        }
    }
}

// =============================================================================
// attack — from Combat.c:1017
// =============================================================================

/**
 * Main attack resolution function. Handles hit/miss determination,
 * damage calculation, sneak attacks, weapon effects, armor runics,
 * combat messaging, and all side effects.
 *
 * C: boolean attack(creature *attacker, creature *defender, boolean lungeAttack)
 *
 * @param attacker The attacking creature.
 * @param defender The defending creature.
 * @param lungeAttack Whether this is a lunge attack (spear).
 * @param ctx Attack context.
 * @returns True if the attack hit.
 */
export function attack(
    attacker: Creature,
    defender: Creature,
    lungeAttack: boolean,
    ctx: AttackContext,
): boolean {
    let damage: number;
    let poisonDamage = 0;

    // Check paladin feat before creatureState is changed
    if (
        attacker === ctx.player &&
        !(defender.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS)
    ) {
        ctx.handlePaladinFeat(defender);
    }

    // Track pure mage feat
    if (attacker === ctx.player && ctx.weapon && ctx.canSeeMonster(defender)) {
        ctx.setPureMageFeatFailed();
    }

    // Kamikaze attackers kill themselves
    if (attacker.info.abilityFlags & MonsterAbilityFlag.MA_KAMIKAZE) {
        killCreature(attacker, false, ctx);
        return true;
    }

    const degradesAttackerWeapon = !!(defender.info.flags & MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON);
    const sightUnseen = !ctx.canSeeMonster(attacker) && !ctx.canSeeMonster(defender);

    // Aquatic monsters can't attack flying targets
    if (
        defender.status[StatusEffect.Levitating] &&
        (attacker.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID)
    ) {
        return false;
    }

    // Player combat disturbs
    if ((attacker === ctx.player || defender === ctx.player) && !ctx.blockCombatText) {
        ctx.setDisturbed();
    }

    // Clear defender's entrancement and reduce fear
    defender.status[StatusEffect.Entranced] = 0;
    if (defender.status[StatusEffect.MagicalFear]) {
        defender.status[StatusEffect.MagicalFear] = 1;
    }

    // Wandering monster starts tracking player
    if (
        attacker !== ctx.player &&
        defender === ctx.player &&
        attacker.creatureState === CreatureState.Wandering
    ) {
        attacker.creatureState = CreatureState.TrackingScent;
    }

    // Determine sneak/sleep/paralysis conditions
    let sneakAttack: boolean;
    let defenderWasAsleep: boolean;
    let defenderWasParalyzed: boolean;

    if (defender.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) {
        sneakAttack = false;
        defenderWasAsleep = false;
        defenderWasParalyzed = false;
    } else {
        sneakAttack =
            defender !== ctx.player &&
            attacker === ctx.player &&
            defender.creatureState === CreatureState.Wandering;
        defenderWasAsleep =
            defender !== ctx.player &&
            defender.creatureState === CreatureState.Sleeping;
        defenderWasParalyzed = defender.status[StatusEffect.Paralyzed] > 0;
    }

    const attackerName = ctx.monsterName(attacker, true);
    const defenderName = ctx.monsterName(defender, true);

    // Seize check
    if (
        (attacker.info.abilityFlags & MonsterAbilityFlag.MA_SEIZES) &&
        (!(attacker.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) ||
            !(defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED)) &&
        distanceBetween(attacker.loc, defender.loc) === 1 &&
        !diagonalBlocked(
            attacker.loc.x,
            attacker.loc.y,
            defender.loc.x,
            defender.loc.y,
            ctx.getTerrainFlags,
        )
    ) {
        attacker.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SEIZING;
        defender.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SEIZED;

        // Submerged seizing monster surfaces
        if (
            defender === ctx.player &&
            (attacker.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
            ctx.canSeeMonster(attacker)
        ) {
            attacker.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
        }

        if (ctx.canSeeMonster(attacker) || ctx.canSeeMonster(defender)) {
            const target = defender === ctx.player ? "your legs" : defenderName;
            ctx.messageWithColor(
                `${attackerName} seizes ${target}!`,
                ctx.whiteColor,
            );
        }
        return false;
    }

    // Determine if the attack hits
    if (
        sneakAttack ||
        defenderWasAsleep ||
        defenderWasParalyzed ||
        lungeAttack ||
        attackHit(attacker, defender, ctx)
    ) {
        // ── HIT ──

        // Calculate base damage
        if (defender.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE)) {
            damage = 0;
        } else {
            const rawDamage = ctx.randClump(attacker.info.damage);
            const adjustment = monsterDamageAdjustmentAmount(attacker, ctx.player);
            damage = Number(BigInt(rawDamage) * adjustment / FP_FACTOR);
        }

        // Sneak/sleep/paralysis bonus: defender doesn't get a reaction
        if (sneakAttack || defenderWasAsleep || defenderWasParalyzed) {
            if (defender !== ctx.player) {
                defender.ticksUntilTurn += Math.max(defender.movementSpeed, defender.attackSpeed);
                if (defender.creatureState !== CreatureState.Ally) {
                    defender.creatureState = CreatureState.TrackingScent;
                }
            }
        }

        // Sneak attack / lunge damage multiplier
        if (sneakAttack || defenderWasAsleep || defenderWasParalyzed || lungeAttack) {
            if (
                attacker === ctx.player &&
                ctx.weapon &&
                (ctx.weapon.flags & ItemFlag.ITEM_SNEAK_ATTACK_BONUS)
            ) {
                damage *= 5; // 5x for daggers
            } else {
                damage *= 3; // 3x for general
            }
        }

        // Armor runic effect
        let armorRunicString = "";
        if (defender === ctx.player && ctx.armor && (ctx.armor.flags & ItemFlag.ITEM_RUNIC)) {
            armorRunicString = ctx.applyArmorRunicEffect(attacker, { value: damage }, true);
            // Note: damage may have been modified by the runic effect through the object reference
        }

        // Reaping
        if (
            attacker === ctx.player &&
            ctx.reaping &&
            !(defender.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
        ) {
            let specialDamage = Math.min(damage, defender.currentHP) * ctx.reaping;
            if (ctx.reaping > 0) {
                specialDamage = ctx.randRange(0, specialDamage);
            } else {
                specialDamage = ctx.randRange(specialDamage, 0);
            }
            if (specialDamage) {
                ctx.rechargeItemsIncrementally(specialDamage);
            }
        }

        // Build explication clause for messaging
        let explicationClause = "";
        if (damage === 0) {
            explicationClause = ` but ${attacker === ctx.player ? "do" : "does"} no damage`;
            if (attacker === ctx.player) {
                ctx.setDisturbed();
            }
        } else if (lungeAttack) {
            explicationClause = " with a vicious lunge attack";
        } else if (defenderWasParalyzed) {
            explicationClause = ` while ${defender === ctx.player ? "you are" : "$HESHE is"} paralyzed`;
        } else if (defenderWasAsleep) {
            explicationClause = " in $HISHER sleep";
        } else if (sneakAttack) {
            explicationClause = ", catching $HIMHER unaware";
        } else if (
            defender.status[StatusEffect.Stuck] ||
            (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
        ) {
            const pronoun = ctx.canSeeMonster(defender) ? "$HESHE" : "it";
            const suffix = defender === ctx.player ? "" : "s";
            explicationClause = ` while ${pronoun} dangle${suffix} helplessly`;
        }
        explicationClause = ctx.resolvePronounEscapes(explicationClause, defender);

        // Poison attack: convert most damage to poison
        if ((attacker.info.abilityFlags & MonsterAbilityFlag.MA_POISONS) && damage > 0) {
            poisonDamage = damage;
            damage = 1;
        }

        // Inflict the damage
        if (inflictDamage(attacker, defender, damage, ctx.redColor, false, ctx)) {
            // ── DEFENDER KILLED ──
            let deathMsg: string;
            if (defenderWasAsleep || sneakAttack || defenderWasParalyzed || lungeAttack) {
                const verb = (defender.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "destroyed" : "dispatched";
                deathMsg = `${attackerName} ${verb} ${defenderName}${explicationClause}`;
            } else {
                const verb = (defender.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "destroyed" : "defeated";
                deathMsg = `${attackerName} ${verb} ${defenderName}${explicationClause}`;
            }

            if (sightUnseen) {
                const msg = (defender.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)
                    ? "you hear something get destroyed in combat"
                    : "you hear something die in combat";
                ctx.combatMessage(msg, null);
            } else {
                ctx.combatMessage(
                    deathMsg,
                    damage > 0 ? ctx.messageColorFromVictim(defender) : ctx.whiteColor,
                );
            }

            killCreature(defender, false, ctx);
            if (defender === ctx.player) {
                ctx.gameOverFromMonster(attacker.info.monsterName);
                return true;
            } else if (attacker === ctx.player && defender.info.monsterID === 0) {
                // MK_DRAGON check — context should handle this
                ctx.setDragonslayerFeatAchieved();
            }
        } else {
            // ── DEFENDER SURVIVED ──
            if (!ctx.blockCombatText && (ctx.canSeeMonster(attacker) || ctx.canSeeMonster(defender))) {
                const adjustment = monsterDamageAdjustmentAmount(attacker, ctx.player);
                const lowerAdjusted = Number(BigInt(attacker.info.damage.lowerBound) * adjustment / FP_FACTOR);
                const rangeAdjusted = Number(
                    BigInt(attacker.info.damage.upperBound - attacker.info.damage.lowerBound) * adjustment / FP_FACTOR
                );
                const damagePercent = Math.max(damage - lowerAdjusted, 0) * 100 / Math.max(1, rangeAdjusted);
                const verb = ctx.attackVerb(damagePercent);
                const hitMsg = `${attackerName} ${verb} ${defenderName}${explicationClause}`;

                if (sightUnseen) {
                    if (!ctx.reportHeardCombat()) {
                        ctx.combatMessage("you hear combat in the distance", null);
                    }
                } else {
                    ctx.combatMessage(hitMsg, ctx.messageColorFromVictim(defender));
                }
            }

            // Stagger hit
            if (attacker === ctx.player && ctx.weapon && (ctx.weapon.flags & ItemFlag.ITEM_ATTACKS_STAGGER)) {
                processStaggerHit(attacker, defender, ctx);
            }

            // Special hit abilities
            if (attacker.info.abilityFlags & SPECIAL_HIT) {
                const effectiveDamage = (attacker.info.abilityFlags & MonsterAbilityFlag.MA_POISONS) ? poisonDamage : damage;
                ctx.specialHit(attacker, defender, effectiveDamage);
            }

            // Armor runic message
            if (armorRunicString) {
                ctx.message(armorRunicString, 0);
                if (ctx.armor && (ctx.armor.flags & ItemFlag.ITEM_RUNIC) && ctx.armor.enchant2 === 0) {
                    // A_BURDEN check — context should handle specific enchant2 values
                    ctx.strengthCheck(ctx.armor, true);
                }
            }
        }

        // Post-hit effects (both kill and survive)
        moralAttack(attacker, defender, ctx);

        // Weapon runic effects
        if (attacker === ctx.player && ctx.weapon && (ctx.weapon.flags & ItemFlag.ITEM_RUNIC)) {
            ctx.magicWeaponHit(defender, ctx.weapon, sneakAttack || defenderWasAsleep || defenderWasParalyzed);
        }

        // Jelly splitting
        ctx.splitMonster(defender, attacker);

        // Auto-ID weapon on kill
        if (
            attacker === ctx.player &&
            (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
            (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID)
        ) {
            ctx.decrementWeaponAutoIDTimer();
        }

        // Weapon degradation
        if (
            degradesAttackerWeapon &&
            attacker === ctx.player &&
            ctx.weapon &&
            !(ctx.weapon.flags & ItemFlag.ITEM_PROTECTED) &&
            !((ctx.weapon.flags & ItemFlag.ITEM_RUNIC) &&
                ctx.weapon.enchant2 === 0 /* W_SLAYING — should be checked via context */ &&
                ctx.monsterIsInClass(defender, ctx.monsterClassCatalog[ctx.weapon.vorpalEnemy])) &&
            ctx.weapon.enchant1 >= -10
        ) {
            ctx.weapon.enchant1--;
            if (ctx.weapon.quiverNumber) {
                ctx.weapon.quiverNumber = ctx.randRange(1, 60000);
            }
            ctx.equipItem(ctx.weapon, true);
            const weaponName = ctx.itemName(ctx.weapon);
            ctx.messageWithColor(`your ${weaponName} weakens!`, ctx.itemMessageColor);
            ctx.checkForDisenchantment(ctx.weapon);
        }

        return true;
    } else {
        // ── MISS ──
        if (!ctx.blockCombatText) {
            if (sightUnseen) {
                if (!ctx.reportHeardCombat()) {
                    ctx.combatMessage("you hear combat in the distance", null);
                }
            } else {
                ctx.combatMessage(`${attackerName} missed ${defenderName}`, null);
            }
        }
        return false;
    }
}
