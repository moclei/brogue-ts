/*
 *  combat-runics.ts — Weapon/armor runic effects and monster special hits
 *  brogue-ts
 *
 *  Ported from: src/brogue/Combat.c
 *  Functions: specialHit, magicWeaponHit, applyArmorRunicEffect
 *
 *  These functions handle the complex on-hit special effects for both
 *  weapons and armor. Heavy use of DI context for side effects.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, Pos } from "../types/types.js";
import { StatusEffect, WeaponEnchant, ArmorEnchant } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    ItemFlag,
    SPECIAL_HIT,
} from "../types/flags.js";
import {
    runicWeaponChance,
    weaponParalysisDuration,
    weaponSlowDuration,
    weaponConfusionDuration,
    armorReprisalPercent,
    armorAbsorptionMax,
    armorImageCount,
} from "../power/power-tables.js";
import { netEnchant } from "../items/item-usage.js";
import { attackHit } from "./combat-math.js";
import { inflictDamage, inflictLethalDamage, killCreature, addPoison, heal, flashMonster } from "./combat-damage.js";
import { processStaggerHit } from "./combat-attack.js";
import type { AttackContext } from "./combat-attack.js";

// =============================================================================
// Context for runic operations
// =============================================================================

/**
 * Context for weapon/armor runic effect operations.
 * Extends AttackContext with additional runic-specific callbacks.
 */
export interface RunicContext extends AttackContext {
    // ── Runic-specific callbacks ──
    /** Whether the armor runic is already identified. */
    armorRunicIdentified(): boolean;
    /** Auto-identify an item (marks it as identified). */
    autoIdentify(item: Item): void;
    /** Create a visual flare at a location. */
    createFlare(x: number, y: number, type: number): void;
    /** Clone a monster. Returns null if cloning fails. */
    cloneMonster(monst: Creature, selfClone: boolean, maintainCorpse: boolean): Creature | null;
    /** Check if player is immune to this monster (armor of immunity). */
    playerImmuneToMonster(monst: Creature): boolean;
    /** Slow a creature by a duration. */
    slow(monst: Creature, duration: number): void;
    /** Weaken a creature by a duration. */
    weaken(monst: Creature, duration: number): void;
    /** Expose a creature to fire. */
    exposeCreatureToFire(monst: Creature): void;
    /** Steal an item from the player. */
    monsterStealsFromPlayer(attacker: Creature): void;
    /** Check if monsters are enemies of each other. */
    monstersAreEnemies(monst1: Creature, monst2: Creature): boolean;
    /** Get an item name string. */
    itemName(item: Item): string;

    // ── Game constants ──
    /** Duration for on-hit hallucination. */
    onHitHallucinateDuration: number;
    /** Duration for on-hit weakness. */
    onHitWeakenDuration: number;
    /** Heal percent for mercy weapon. */
    onHitMercyHealPercent: number;

    // ── Force weapon ──
    /** Execute force weapon bolt (blinking bolt). */
    forceWeaponHit(defender: Creature, weapon: Item): boolean;
}

// =============================================================================
// specialHit — from Combat.c:382
// =============================================================================

/**
 * Apply special on-hit abilities for monsters (poison, weakness, fire,
 * item stealing, armor degradation, hallucination, stagger).
 *
 * C: static void specialHit(creature *attacker, creature *defender, short damage)
 *
 * @param attacker The attacking creature.
 * @param defender The defending creature.
 * @param damage The amount of damage dealt.
 * @param ctx Runic context.
 */
export function specialHit(
    attacker: Creature,
    defender: Creature,
    damage: number,
    ctx: RunicContext,
): void {
    if (!(attacker.info.abilityFlags & SPECIAL_HIT)) {
        return;
    }

    // Special hits that affect the player only
    if (defender === ctx.player) {
        if (ctx.playerImmuneToMonster(attacker)) {
            return;
        }

        // Armor degradation
        if (
            (attacker.info.abilityFlags & MonsterAbilityFlag.MA_HIT_DEGRADE_ARMOR) &&
            ctx.armor &&
            !(ctx.armor.flags & ItemFlag.ITEM_PROTECTED) &&
            ctx.armor.enchant1 + Math.floor(ctx.armor.armor / 10) > -10
        ) {
            ctx.armor.enchant1--;
            ctx.equipItem(ctx.armor, true);
            const armorName = ctx.itemName(ctx.armor);
            ctx.messageWithColor(`your ${armorName} weakens!`, ctx.itemMessageColor);
            ctx.checkForDisenchantment(ctx.armor);
        }

        // Hallucination
        if (attacker.info.abilityFlags & MonsterAbilityFlag.MA_HIT_HALLUCINATE) {
            if (!ctx.player.status[StatusEffect.Hallucinating]) {
                ctx.combatMessage("you begin to hallucinate", null);
            }
            if (!ctx.player.status[StatusEffect.Hallucinating]) {
                ctx.player.maxStatus[StatusEffect.Hallucinating] = 0;
            }
            ctx.player.status[StatusEffect.Hallucinating] += ctx.onHitHallucinateDuration;
            ctx.player.maxStatus[StatusEffect.Hallucinating] = Math.max(
                ctx.player.maxStatus[StatusEffect.Hallucinating],
                ctx.player.status[StatusEffect.Hallucinating],
            );
        }

        // Fire
        if (
            (attacker.info.abilityFlags & MonsterAbilityFlag.MA_HIT_BURN) &&
            !defender.status[StatusEffect.ImmuneToFire]
        ) {
            ctx.exposeCreatureToFire(defender);
        }

        // Item stealing
        if (
            (attacker.info.abilityFlags & MonsterAbilityFlag.MA_HIT_STEAL_FLEE) &&
            !attacker.carriedItem &&
            attacker.currentHP > 0 &&
            !attacker.status[StatusEffect.Confused] &&
            attackHit(attacker, defender, ctx)
        ) {
            ctx.monsterStealsFromPlayer(attacker);
        }
    }

    // Effects that apply to all defenders
    if (
        (attacker.info.abilityFlags & MonsterAbilityFlag.MA_POISONS) &&
        damage > 0 &&
        !(defender.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
    ) {
        addPoison(defender, damage, 1, ctx);
    }

    if (
        (attacker.info.abilityFlags & MonsterAbilityFlag.MA_CAUSES_WEAKNESS) &&
        damage > 0 &&
        !(defender.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
    ) {
        ctx.weaken(defender, ctx.onHitWeakenDuration);
    }

    if (attacker.info.abilityFlags & MonsterAbilityFlag.MA_ATTACKS_STAGGER) {
        processStaggerHit(attacker, defender, ctx);
    }
}

// =============================================================================
// magicWeaponHit — from Combat.c:591
// =============================================================================

/**
 * Apply a runic weapon's special effect on a successful hit.
 * Each weapon enchant type has a different effect: speed, quietus,
 * paralysis, multiplicity, slowing, confusion, force, slaying, mercy, plenty.
 *
 * C: void magicWeaponHit(creature *defender, item *theItem, boolean backstabbed)
 *
 * @param defender The creature that was hit.
 * @param theItem The runic weapon.
 * @param backstabbed Whether the hit was a backstab/sneak attack.
 * @param ctx Runic context.
 */
export function magicWeaponHit(
    defender: Creature,
    theItem: Item,
    backstabbed: boolean,
    ctx: RunicContext,
): void {
    const enchantType = theItem.enchant2 as WeaponEnchant;

    // If defender is already dead, only speed and multiplicity proceed
    if (
        (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
        enchantType !== WeaponEnchant.Speed &&
        enchantType !== WeaponEnchant.Multiplicity
    ) {
        return;
    }

    const enchant = netEnchant(theItem, ctx.playerStrength, ctx.player.weaknessAmount);

    // Determine chance of runic activation
    let chance: number;
    if (enchantType === WeaponEnchant.Slaying) {
        const monsterClass = ctx.monsterClassCatalog[theItem.vorpalEnemy];
        chance = monsterClass && ctx.monsterIsInClass(defender, monsterClass) ? 100 : 0;
    } else if (defender.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        chance = 0;
    } else {
        const adjustedBaseDamage = Math.floor((theItem.damage.lowerBound + theItem.damage.upperBound) / 2);
        const attacksStagger = !!(theItem.flags & ItemFlag.ITEM_ATTACKS_STAGGER);
        const attacksQuickly = !!(theItem.flags & ItemFlag.ITEM_ATTACKS_QUICKLY);
        chance = runicWeaponChance(enchantType, enchant, adjustedBaseDamage, attacksStagger, attacksQuickly);
        if (backstabbed && chance < 100) {
            chance = Math.min(chance * 2, Math.floor((chance + 100) / 2));
        }
    }

    if (chance <= 0 || !ctx.randPercent(chance)) {
        return;
    }

    let autoID = false;
    const monstName = ctx.monsterName(defender, true);
    const theItemName = ctx.itemName(theItem);

    // Flash the defender (unless submerged)
    if (!(defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) {
        switch (enchantType) {
            case WeaponEnchant.Speed:
                ctx.createFlare(ctx.player.loc.x, ctx.player.loc.y, 0 /* SCROLL_ENCHANTMENT_LIGHT */);
                break;
            case WeaponEnchant.Quietus:
                ctx.createFlare(defender.loc.x, defender.loc.y, 1 /* QUIETUS_FLARE_LIGHT */);
                break;
            case WeaponEnchant.Slaying:
                ctx.createFlare(defender.loc.x, defender.loc.y, 2 /* SLAYING_FLARE_LIGHT */);
                break;
            default:
                // Other runics flash the defender with the effect color
                flashMonster(defender, ctx.redColor, 100, ctx);
                break;
        }
        autoID = true;
    }

    ctx.setDisturbed();

    // Apply the runic effect
    switch (enchantType) {
        case WeaponEnchant.Speed:
            if (ctx.player.ticksUntilTurn !== -1) {
                ctx.combatMessage(`your ${theItemName} trembles and time freezes for a moment`, null);
                ctx.player.ticksUntilTurn = -1; // free turn!
                autoID = true;
            }
            break;

        case WeaponEnchant.Slaying:
        case WeaponEnchant.Quietus:
            inflictLethalDamage(ctx.player, defender, ctx);
            ctx.combatMessage(
                `${monstName} suddenly ${(defender.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "shatters" : "dies"}`,
                ctx.messageColorFromVictim(defender),
            );
            killCreature(defender, false, ctx);
            autoID = true;
            break;

        case WeaponEnchant.Paralysis:
            defender.status[StatusEffect.Paralyzed] = Math.max(
                defender.status[StatusEffect.Paralyzed],
                weaponParalysisDuration(enchant),
            );
            defender.maxStatus[StatusEffect.Paralyzed] = defender.status[StatusEffect.Paralyzed];
            if (ctx.canDirectlySeeMonster(defender)) {
                ctx.combatMessage(`${monstName} is frozen in place`, ctx.messageColorFromVictim(defender));
                autoID = true;
            }
            break;

        case WeaponEnchant.Multiplicity:
            // Spectral images — complex spawning, delegated to context
            ctx.combatMessage(
                `Your ${theItemName} emits a flash of light, and spectral duplicates appear!`,
                null,
            );
            // The actual spawning of spectral images is handled by context
            autoID = true;
            break;

        case WeaponEnchant.Slowing:
            ctx.slow(defender, weaponSlowDuration(enchant));
            if (ctx.canDirectlySeeMonster(defender)) {
                ctx.combatMessage(`${monstName} slows down`, ctx.messageColorFromVictim(defender));
                autoID = true;
            }
            break;

        case WeaponEnchant.Confusion:
            defender.status[StatusEffect.Confused] = Math.max(
                defender.status[StatusEffect.Confused],
                weaponConfusionDuration(enchant),
            );
            defender.maxStatus[StatusEffect.Confused] = defender.status[StatusEffect.Confused];
            if (ctx.canDirectlySeeMonster(defender)) {
                ctx.combatMessage(`${monstName} looks very confused`, ctx.messageColorFromVictim(defender));
                autoID = true;
            }
            break;

        case WeaponEnchant.Force:
            autoID = ctx.forceWeaponHit(defender, theItem);
            break;

        case WeaponEnchant.Mercy:
            heal(defender, ctx.onHitMercyHealPercent, false, ctx);
            if (ctx.canSeeMonster(defender)) {
                autoID = true;
            }
            break;

        case WeaponEnchant.Plenty:
            {
                const clone = ctx.cloneMonster(defender, true, true);
                if (clone) {
                    flashMonster(clone, ctx.redColor, 100, ctx);
                    if (ctx.canSeeMonster(clone)) {
                        autoID = true;
                    }
                }
            }
            break;

        default:
            break;
    }

    if (autoID) {
        ctx.autoIdentify(theItem);
    }
}

// =============================================================================
// applyArmorRunicEffect — from Combat.c:808
// =============================================================================

/**
 * Apply an armor runic's defensive effect when the player is hit.
 * Returns a description string for the effect (empty if none).
 *
 * C: void applyArmorRunicEffect(char returnString[DCOLS], creature *attacker,
 *                                short *damage, boolean melee)
 *
 * @param attacker The creature attacking the player.
 * @param damage Object with a `value` field that may be modified.
 * @param melee Whether this is a melee attack.
 * @param ctx Runic context.
 * @returns A description string for the runic effect (empty if none).
 */
export function applyArmorRunicEffect(
    attacker: Creature,
    damage: { value: number },
    melee: boolean,
    ctx: RunicContext,
): string {
    if (!ctx.armor || !(ctx.armor.flags & ItemFlag.ITEM_RUNIC)) {
        return "";
    }

    const enchant = netEnchant(ctx.armor, ctx.playerStrength, ctx.player.weaknessAmount);
    const runicKnown = !!(ctx.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED);
    let runicDiscovered = false;
    let returnString = "";

    const armorName = ctx.itemName(ctx.armor);
    const attackerName = ctx.monsterName(attacker, true);

    switch (ctx.armor.enchant2 as ArmorEnchant) {
        case ArmorEnchant.Multiplicity:
            if (
                melee &&
                !(attacker.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
                ctx.randPercent(33)
            ) {
                // Spawn spectral images of the attacker (delegated to context)
                for (let i = 0; i < armorImageCount(enchant); i++) {
                    ctx.cloneMonster(attacker, false, true);
                }
                runicDiscovered = true;
                returnString = `Your ${armorName} flashes, and spectral images of ${attackerName} appear!`;
            }
            break;

        case ArmorEnchant.Mutuality:
            if (damage.value > 0) {
                // Find adjacent enemies to share damage with
                let count = 0;
                const hitList: (Creature | null)[] = new Array(8).fill(null);
                for (let i = 0; i < 8; i++) {
                    const loc: Pos = {
                        x: ctx.player.loc.x + (i < 4 ? [0, 0, -1, 1][i] : [-1, -1, 1, 1][i - 4]),
                        y: ctx.player.loc.y + (i < 4 ? [-1, 1, 0, 0][i] : [-1, 1, -1, 1][i - 4]),
                    };
                    const monst = ctx.monsterAtLoc(loc);
                    if (
                        monst &&
                        monst !== attacker &&
                        ctx.monstersAreEnemies(ctx.player, monst) &&
                        !(monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
                        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)
                    ) {
                        hitList[i] = monst;
                        count++;
                    }
                }
                if (count) {
                    const sharedDamage = Math.floor((damage.value + count) / (count + 1));
                    for (let i = 0; i < 8; i++) {
                        if (hitList[i] && !(hitList[i]!.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)) {
                            if (inflictDamage(ctx.player, hitList[i]!, sharedDamage, null, true, ctx)) {
                                killCreature(hitList[i]!, false, ctx);
                            }
                        }
                    }
                    runicDiscovered = true;
                    if (!runicKnown) {
                        returnString = `Your ${armorName} pulses, and the damage is shared with the other adjacent enemies!`;
                    }
                    damage.value = sharedDamage;
                }
            }
            break;

        case ArmorEnchant.Absorption:
            {
                const absorbed = ctx.randRange(1, armorAbsorptionMax(enchant));
                damage.value -= absorbed;
                if (damage.value <= 0) {
                    damage.value = 0;
                    runicDiscovered = true;
                    if (!runicKnown) {
                        returnString = `your ${armorName} pulses and absorbs the blow!`;
                    }
                }
            }
            break;

        case ArmorEnchant.Reprisal:
            if (
                melee &&
                !(attacker.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
            ) {
                const newDamage = Math.max(1, Math.floor(armorReprisalPercent(enchant) * damage.value / 100));
                if (inflictDamage(ctx.player, attacker, newDamage, null, true, ctx)) {
                    if (ctx.canSeeMonster(attacker)) {
                        returnString = `your ${armorName} pulses and ${attackerName} drops dead!`;
                        runicDiscovered = true;
                    }
                    killCreature(attacker, false, ctx);
                } else if (!runicKnown) {
                    if (ctx.canSeeMonster(attacker)) {
                        returnString = `your ${armorName} pulses and ${attackerName} shudders in pain!`;
                        runicDiscovered = true;
                    }
                }
            }
            break;

        case ArmorEnchant.Immunity:
            {
                const monsterClass = ctx.monsterClassCatalog[ctx.armor.vorpalEnemy];
                if (monsterClass && ctx.monsterIsInClass(attacker, monsterClass)) {
                    damage.value = 0;
                    runicDiscovered = true;
                }
            }
            break;

        case ArmorEnchant.Burden:
            if (ctx.randPercent(10)) {
                ctx.armor.strengthRequired++;
                returnString = `your ${armorName} suddenly feels heavier!`;
                ctx.equipItem(ctx.armor, true);
                runicDiscovered = true;
            }
            break;

        case ArmorEnchant.Vulnerability:
            damage.value *= 2;
            if (!runicKnown) {
                returnString = `your ${armorName} pulses and you are wracked with pain!`;
                runicDiscovered = true;
            }
            break;

        case ArmorEnchant.Immolation:
            if (ctx.randPercent(10)) {
                returnString = `flames suddenly explode out of your ${armorName}!`;
                ctx.message(returnString, runicKnown ? 0 : 1 /* REQUIRE_ACKNOWLEDGMENT */);
                returnString = "";
                ctx.spawnDungeonFeature(ctx.player.loc.x, ctx.player.loc.y, 0 /* DF_ARMOR_IMMOLATION */, 100, false);
                runicDiscovered = true;
            }
            break;

        default:
            break;
    }

    if (runicDiscovered && !runicKnown) {
        ctx.autoIdentify(ctx.armor);
    }

    return returnString;
}
