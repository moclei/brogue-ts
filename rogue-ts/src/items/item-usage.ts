/*
 *  item-usage.ts — Equipment, enchantment & usage calculations
 *  brogue-ts
 *
 *  Ported from Items.c (equipItem, unequipItem, netEnchant, etc.)
 *  and Combat.c (strengthModifier, netEnchant).
 *
 *  These are the *pure calculation* functions for item mechanics.
 *  Interactive scroll/potion/wand handlers are deferred to a later step.
 */

import type { Item, Creature, Fixpt } from "../types/types.js";
import { ItemCategory, RingKind, ScrollKind, StatusEffect } from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { damageFraction } from "../power/power-tables.js";
import { scrollTable, ringTable, wandTable } from "../globals/item-catalog.js";
import { getTableForCategory } from "./item-generation.js";

// =============================================================================
// Types
// =============================================================================

/** Minimal player/rogue state needed by equipment calculations. */
export interface EquipmentState {
    /** Player creature (with info, status, maxStatus, movementSpeed, attackSpeed, weaknessAmount). */
    player: Creature;
    /** Currently equipped weapon. */
    weapon: Item | null;
    /** Currently equipped armor. */
    armor: Item | null;
    /** Currently equipped left ring. */
    ringLeft: Item | null;
    /** Currently equipped right ring. */
    ringRight: Item | null;
    /** Player strength stat. */
    strength: number;
    /** Ring-derived bonuses. */
    clairvoyance: number;
    stealthBonus: number;
    regenerationBonus: number;
    lightMultiplier: number;
    awarenessBonus: number;
    transference: number;
    wisdomBonus: number;
    reaping: number;
}

/** Context for equip/unequip operations that may produce messages. */
export interface EquipContext {
    state: EquipmentState;
    message: (text: string, requireAcknowledge: boolean) => void;
    /** Callback to recalculate ring bonuses after ring equip/unequip. */
    updateRingBonuses: () => void;
    /** Callback to update clairvoyance. */
    updateClairvoyance?: () => void;
    /** Callback to refresh the display after clairvoyance change. */
    displayLevel?: () => void;
    /** Callback to recalculate equipment bonuses. */
    updateEncumbrance: () => void;
    /** Item naming function for messages. */
    itemName: (theItem: Item, includeDetails: boolean, includeArticle: boolean) => string;
    /** Identify item kind. */
    identifyItemKind?: (theItem: Item) => void;
    /** Update field of view. */
    updateFieldOfViewDisplay?: () => void;
    /** Update miner's light radius. */
    updateMinersLightRadius?: () => void;
    /** Update player regeneration delay. */
    updatePlayerRegenerationDelay?: () => void;
}

// =============================================================================
// strengthModifier — from Combat.c:60
// =============================================================================

/**
 * Calculate the strength modifier for an item.
 * Positive difference (player stronger) gives 0.25x per point bonus.
 * Negative difference (player weaker) gives 2.5x per point penalty.
 *
 * C: fixpt strengthModifier(item *theItem) in Combat.c
 *
 * @param theItem The weapon or armor item.
 * @param playerStrength Player's strength stat.
 * @param weaknessAmount Player's weakness debuff.
 * @returns The strength modifier as a fixed-point value.
 */
export function strengthModifier(theItem: Item, playerStrength: number, weaknessAmount: number): Fixpt {
    const difference = (playerStrength - weaknessAmount) - theItem.strengthRequired;
    if (difference > 0) {
        return BigInt(difference) * FP_FACTOR / 4n; // 0.25x bonus per point
    } else {
        return BigInt(difference) * FP_FACTOR * 5n / 2n; // 2.5x penalty per point
    }
}

// =============================================================================
// netEnchant — from Combat.c:69
// =============================================================================

/**
 * Calculate the net enchantment of an item, including strength modifier.
 * Clamped to [-20, 50] in fixed-point.
 *
 * C: fixpt netEnchant(item *theItem) in Combat.c
 *
 * @param theItem The item.
 * @param playerStrength Player's strength stat.
 * @param weaknessAmount Player's weakness debuff.
 * @returns The net enchantment as a fixed-point value.
 */
export function netEnchant(theItem: Item, playerStrength: number, weaknessAmount: number): Fixpt {
    let retval = BigInt(theItem.enchant1) * FP_FACTOR;
    if (theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR)) {
        retval += strengthModifier(theItem, playerStrength, weaknessAmount);
    }
    // Clamp to [-20, 50]
    const min = -20n * FP_FACTOR;
    const max = 50n * FP_FACTOR;
    if (retval < min) retval = min;
    if (retval > max) retval = max;
    return retval;
}

// =============================================================================
// effectiveRingEnchant — from Items.c:1839
// =============================================================================

/**
 * Get the "effective" enchantment of a ring. If identified, returns the
 * true enchant1. If not, returns min(enchant1, timesEnchanted + 1).
 * This prevents the player from seeing the full benefit until identified.
 *
 * C: static short effectiveRingEnchant(item *theItem)
 */
export function effectiveRingEnchant(theItem: Item): number {
    if (theItem.category !== ItemCategory.RING) return 0;
    if (theItem.flags & ItemFlag.ITEM_IDENTIFIED) {
        return theItem.enchant1;
    } else {
        return Math.min(theItem.enchant1, theItem.timesEnchanted + 1);
    }
}

// =============================================================================
// apparentRingBonus — from Items.c:1850
// =============================================================================

/**
 * Get the total apparent ring bonus for a specific ring kind.
 *
 * C: static short apparentRingBonus(const enum ringKind kind)
 */
export function apparentRingBonus(
    kind: RingKind,
    state: EquipmentState,
): number {
    const rings = [state.ringLeft, state.ringRight];
    let retval = 0;

    if (ringTable[kind].identified) {
        for (const ring of rings) {
            if (ring && ring.kind === kind) {
                retval += effectiveRingEnchant(ring);
            }
        }
    }
    return retval;
}

// =============================================================================
// enchantIncrement — from Items.c:1814
// =============================================================================

/**
 * Calculate the increment per enchantment level for itemDetails display.
 * Weapons/armor with 0 strength required get 1.0x.
 * If the player can't meet the strength requirement, 3.5x.
 * Otherwise 1.25x.
 * Non-weapon/armor items always get 1.0x.
 *
 * C: static fixpt enchantIncrement(item *theItem)
 */
export function enchantIncrement(theItem: Item, playerStrength: number, weaknessAmount: number): Fixpt {
    if (theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR)) {
        if (theItem.strengthRequired === 0) {
            return FP_FACTOR;
        } else if (playerStrength - weaknessAmount < theItem.strengthRequired) {
            return FP_FACTOR * 35n / 10n;
        } else {
            return FP_FACTOR * 125n / 100n;
        }
    } else {
        return FP_FACTOR;
    }
}

// =============================================================================
// enchantMagnitude — from Items.c:1760
// =============================================================================

/**
 * Get the magnitude of a scroll of enchanting.
 * This is the "power" field of the enchanting scroll table entry.
 *
 * C: static int enchantMagnitude()
 */
export function enchantMagnitude(): number {
    return scrollTable[ScrollKind.Enchanting].power ?? 1;
}

// =============================================================================
// armorValueIfUnenchanted — from Items.c:3188
// =============================================================================

/**
 * Estimate the armor value if the item were unenchanted.
 * Uses the average armor value from the table and applies the strength modifier.
 *
 * C: short armorValueIfUnenchanted(item *theItem)
 */
export function armorValueIfUnenchanted(
    theItem: Item,
    playerStrength: number,
    weaknessAmount: number,
): number {
    const table = getTableForCategory(ItemCategory.ARMOR);
    if (!table) return 0;
    const entry = table[theItem.kind];
    if (!entry.range) return 0;
    const averageValue = Math.floor((entry.range.upperBound + entry.range.lowerBound) / 2);
    const strMod = strengthModifier(theItem, playerStrength, weaknessAmount);
    const strengthAdjusted = averageValue + Number(10n * strMod / FP_FACTOR);
    return Math.max(0, Math.floor(strengthAdjusted / 10));
}

// =============================================================================
// displayedArmorValue — from Items.c:3195
// =============================================================================

/**
 * Calculate the armor value displayed to the player.
 * If the armor is identified, shows actual defense. Otherwise, estimates.
 *
 * C: short displayedArmorValue()
 */
export function displayedArmorValue(state: EquipmentState): number {
    if (!state.armor || (state.armor.flags & ItemFlag.ITEM_IDENTIFIED)) {
        return Math.floor(state.player.info.defense / 10);
    } else {
        return armorValueIfUnenchanted(state.armor, state.strength, state.player.weaknessAmount);
    }
}

// =============================================================================
// recalculateEquipmentBonuses — from Items.c:7687
// =============================================================================

/**
 * Recalculate damage and defense based on equipped weapon and armor.
 *
 * C: void recalculateEquipmentBonuses()
 */
export function recalculateEquipmentBonuses(state: EquipmentState): void {
    const { player } = state;

    if (state.weapon) {
        const enchant = netEnchant(state.weapon, state.strength, player.weaknessAmount);
        player.info.damage = { ...state.weapon.damage };
        player.info.damage.lowerBound = Number(
            BigInt(player.info.damage.lowerBound) * damageFraction(enchant) / FP_FACTOR
        );
        player.info.damage.upperBound = Number(
            BigInt(player.info.damage.upperBound) * damageFraction(enchant) / FP_FACTOR
        );
        if (player.info.damage.lowerBound < 1) player.info.damage.lowerBound = 1;
        if (player.info.damage.upperBound < 1) player.info.damage.upperBound = 1;
    }

    if (state.armor) {
        const enchant = netEnchant(state.armor, state.strength, player.weaknessAmount);
        const donning = BigInt(player.status[StatusEffect.Donning]) * FP_FACTOR;
        const effectiveEnchant = enchant - donning;
        player.info.defense = Number(
            (BigInt(state.armor.armor) * FP_FACTOR + effectiveEnchant * 10n) / FP_FACTOR
        );
        if (player.info.defense < 0) player.info.defense = 0;
    }
}

// =============================================================================
// updateRingBonuses — from Items.c:7852
// =============================================================================

/**
 * Recalculate ring-derived bonuses from equipped rings.
 *
 * C: void updateRingBonuses()
 *
 * Note: Does NOT call updateMinersLightRadius() or updatePlayerRegenerationDelay() —
 * those must be called by the caller as side-effects.
 */
export function updateRingBonuses(state: EquipmentState): void {
    const rings = [state.ringLeft, state.ringRight];

    state.clairvoyance = 0;
    state.stealthBonus = 0;
    state.regenerationBonus = 0;
    state.transference = 0;
    state.awarenessBonus = 0;
    state.wisdomBonus = 0;
    state.reaping = 0;
    state.lightMultiplier = 1;

    for (const ring of rings) {
        if (ring) {
            const ench = effectiveRingEnchant(ring);
            switch (ring.kind) {
                case RingKind.Clairvoyance: state.clairvoyance += ench; break;
                case RingKind.Stealth: state.stealthBonus += ench; break;
                case RingKind.Regeneration: state.regenerationBonus += ench; break;
                case RingKind.Transference: state.transference += ench; break;
                case RingKind.Light: state.lightMultiplier += ench; break;
                case RingKind.Awareness: state.awarenessBonus += 20 * ench; break;
                case RingKind.Wisdom: state.wisdomBonus += ench; break;
                case RingKind.Reaping: state.reaping += ench; break;
            }
        }
    }

    if (state.lightMultiplier <= 0) {
        state.lightMultiplier--; // because it starts at 1 instead of 0
    }

    if (state.stealthBonus < 0) {
        state.stealthBonus *= 4;
    }
}

// =============================================================================
// updateEncumbrance — from Items.c:3167
// =============================================================================

/**
 * Update the player's movement and attack speed based on status effects,
 * then recalculate equipment bonuses.
 *
 * C: void updateEncumbrance()
 */
export function updateEncumbrance(state: EquipmentState): void {
    const { player } = state;

    let moveSpeed = player.info.movementSpeed;
    let attackSpeed = player.info.attackSpeed;

    if (player.status[StatusEffect.Hasted]) {
        moveSpeed = Math.floor(moveSpeed / 2);
        attackSpeed = Math.floor(attackSpeed / 2);
    } else if (player.status[StatusEffect.Slowed]) {
        moveSpeed *= 2;
        attackSpeed *= 2;
    }

    player.movementSpeed = moveSpeed;
    player.attackSpeed = attackSpeed;

    recalculateEquipmentBonuses(state);
}

// =============================================================================
// strengthCheck — from Items.c:3203
// =============================================================================

/**
 * Check if the player is strong enough for their weapon/armor and display a warning.
 *
 * C: void strengthCheck(item *theItem, boolean noisy)
 */
export function strengthCheck(
    theItem: Item | null,
    noisy: boolean,
    ctx: EquipContext,
): void {
    const { state, message, itemName, updateEncumbrance: doUpdate } = ctx;
    doUpdate();

    if (noisy && theItem) {
        if ((theItem.category & ItemCategory.WEAPON) && theItem.strengthRequired > state.strength - state.player.weaknessAmount) {
            const deficiency = theItem.strengthRequired - Math.max(0, state.strength - state.player.weaknessAmount);
            const name = itemName(theItem, false, false);
            message(`You can barely lift the ${name}; ${deficiency} more strength would be ideal.`, false);
        }

        if ((theItem.category & ItemCategory.ARMOR) && theItem.strengthRequired > state.strength - state.player.weaknessAmount) {
            const deficiency = theItem.strengthRequired - Math.max(0, state.strength - state.player.weaknessAmount);
            const name = itemName(theItem, false, false);
            message(`You stagger under the weight of the ${name}; ${deficiency} more strength would be ideal.`, false);
        }
    }
}

// =============================================================================
// equipItem — from Items.c:7718
// =============================================================================

/**
 * Equip an item (weapon, armor, or ring). Returns true on success.
 *
 * C: boolean equipItem(item *theItem, boolean force, item *unequipHint)
 *
 * @param theItem The item to equip.
 * @param force If true, skip cursed checks and donning delay.
 * @param unequipHint If provided and two rings are equipped, specifies which to unequip.
 * @param ctx The context providing state and callbacks.
 * @returns True if the item was successfully equipped, false otherwise.
 */
export function equipItem(
    theItem: Item,
    force: boolean,
    unequipHint: Item | null,
    ctx: EquipContext,
): boolean {
    const { state, message, itemName } = ctx;

    // Already-equipped rings can't be re-equipped
    if ((theItem.category & ItemCategory.RING) && (theItem.flags & ItemFlag.ITEM_EQUIPPED)) {
        return false;
    }

    let previouslyEquippedItem: Item | null = null;

    if (theItem.category & ItemCategory.WEAPON) {
        previouslyEquippedItem = state.weapon;
    } else if (theItem.category & ItemCategory.ARMOR) {
        previouslyEquippedItem = state.armor;
    } else if (
        (theItem.category & ItemCategory.RING)
        && unequipHint
        && state.ringLeft
        && state.ringRight
        && (unequipHint === state.ringLeft || unequipHint === state.ringRight)
    ) {
        previouslyEquippedItem = unequipHint;
    }

    if (previouslyEquippedItem && !unequipItem(previouslyEquippedItem, force, ctx)) {
        return false; // Can't unequip cursed item
    }

    if (theItem.category & ItemCategory.WEAPON) {
        state.weapon = theItem;
        strengthCheck(theItem, !force, ctx);
    } else if (theItem.category & ItemCategory.ARMOR) {
        if (!force) {
            const donningDelay = Math.floor(theItem.armor / 10);
            state.player.status[StatusEffect.Donning] = donningDelay;
            state.player.maxStatus[StatusEffect.Donning] = donningDelay;
        }
        state.armor = theItem;
        strengthCheck(theItem, !force, ctx);
    } else if (theItem.category & ItemCategory.RING) {
        if (state.ringLeft && state.ringRight) {
            return false; // Both ring slots full with no hint
        }
        if (state.ringLeft) {
            state.ringRight = theItem;
        } else {
            state.ringLeft = theItem;
        }
        ctx.updateRingBonuses();
        if (theItem.kind === RingKind.Clairvoyance) {
            ctx.updateClairvoyance?.();
            ctx.displayLevel?.();
            ctx.identifyItemKind?.(theItem);
        } else if (theItem.kind === RingKind.Light || theItem.kind === RingKind.Stealth) {
            ctx.identifyItemKind?.(theItem);
        }
        ctx.updateEncumbrance();
    }

    theItem.flags |= ItemFlag.ITEM_EQUIPPED;

    if (!force) {
        const name = itemName(theItem, true, true);
        if (previouslyEquippedItem) {
            const oldName = itemName(previouslyEquippedItem, false, true);
            message(`Now wielding ${name}. (Was ${oldName}.)`, false);
        } else {
            message(`Now ${(theItem.category & ItemCategory.WEAPON) ? "wielding" : (theItem.category & ItemCategory.ARMOR) ? "wearing" : "wearing"} ${name}.`, false);
        }
    }

    return true;
}

// =============================================================================
// unequipItem — from Items.c:7807
// =============================================================================

/**
 * Unequip an item. Returns true on success, false if cursed and not forced.
 *
 * C: boolean unequipItem(item *theItem, boolean force)
 */
export function unequipItem(
    theItem: Item | null,
    force: boolean,
    ctx: EquipContext,
): boolean {
    if (!theItem || !(theItem.flags & ItemFlag.ITEM_EQUIPPED)) {
        return false;
    }

    if ((theItem.flags & ItemFlag.ITEM_CURSED) && !force) {
        const name = ctx.itemName(theItem, false, false);
        ctx.message(
            `you can't; your ${name} appear${theItem.quantity === 1 ? "s" : ""} to be cursed.`,
            false,
        );
        return false;
    }

    const { state } = ctx;
    theItem.flags &= ~ItemFlag.ITEM_EQUIPPED;

    if (theItem.category & ItemCategory.WEAPON) {
        state.player.info.damage = { lowerBound: 1, upperBound: 2, clumpFactor: 1 };
        state.weapon = null;
    }
    if (theItem.category & ItemCategory.ARMOR) {
        state.player.info.defense = 0;
        state.armor = null;
        state.player.status[StatusEffect.Donning] = 0;
    }
    if (theItem.category & ItemCategory.RING) {
        if (state.ringLeft === theItem) {
            state.ringLeft = null;
        } else if (state.ringRight === theItem) {
            state.ringRight = null;
        }
        ctx.updateRingBonuses();
        if (theItem.kind === RingKind.Clairvoyance) {
            ctx.updateClairvoyance?.();
            ctx.updateFieldOfViewDisplay?.();
            ctx.updateClairvoyance?.(); // Yes, called twice like in C
            ctx.displayLevel?.();
        }
    }

    ctx.updateEncumbrance();
    return true;
}

// =============================================================================
// enchantItem — enchanting scroll effect logic from Items.c:7046
// =============================================================================

/**
 * Apply scroll of enchanting effect to an item.
 * Modifies the item's properties based on its category.
 *
 * C: case SCROLL_ENCHANTING in readScroll (Items.c:7046–7083)
 *
 * @param theItem The item to enchant.
 * @param randRange RNG function for generating random values.
 * @returns True if the item was enchanted.
 */
export function enchantItem(
    theItem: Item,
    randRange: (lo: number, hi: number) => number,
): boolean {
    const magnitude = enchantMagnitude();
    theItem.timesEnchanted += magnitude;

    switch (theItem.category) {
        case ItemCategory.WEAPON:
            theItem.strengthRequired = Math.max(0, theItem.strengthRequired - magnitude);
            theItem.enchant1 += magnitude;
            if (theItem.quiverNumber) {
                theItem.quiverNumber = randRange(1, 60000);
            }
            break;
        case ItemCategory.ARMOR:
            theItem.strengthRequired = Math.max(0, theItem.strengthRequired - magnitude);
            theItem.enchant1 += magnitude;
            break;
        case ItemCategory.RING:
            theItem.enchant1 += magnitude;
            break;
        case ItemCategory.STAFF:
            theItem.enchant1 += magnitude;
            theItem.charges += magnitude;
            theItem.enchant2 = Math.floor(500 / theItem.enchant1);
            break;
        case ItemCategory.WAND:
            theItem.charges += wandTable[theItem.kind].range!.lowerBound * magnitude;
            break;
        case ItemCategory.CHARM:
            theItem.enchant1 += magnitude;
            theItem.charges = Math.min(0, theItem.charges); // Enchanting instantly recharges
            break;
        default:
            return false;
    }

    return true;
}
