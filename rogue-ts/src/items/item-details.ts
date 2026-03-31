/*
 *  items/item-details.ts — itemDetails: full sidebar description for an item
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Items.c:1879
 *  Functions:   itemDetails
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, ItemTable, Creature, Color, Fixpt } from "../types/types.js";
import { ItemCategory } from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import { STOMACH_SIZE } from "../types/constants.js";
import {
    buildWeaponArmorDetails, buildStaffDetails, buildWandDetails,
    buildRingDetails, buildCharmDetails,
} from "./item-details-helpers.js";

// =============================================================================
// ItemDetailsContext
// =============================================================================

export interface ItemDetailsContext {
    // Game state
    player: Creature;
    packItems: Item[];
    playbackOmniscience: boolean;
    absoluteTurnNumber: number;
    strength: number;
    weapon: Item | null;
    armor: Item | null;

    // Catalog tables
    foodTable: readonly Pick<ItemTable, "name" | "power">[];
    keyTable: readonly Pick<ItemTable, "description">[];
    staffTable: readonly Pick<ItemTable, "identified">[];
    wandTable: readonly Pick<ItemTable, "range" | "identified">[];
    ringTable: readonly Pick<ItemTable, "identified">[];

    // Item table lookup by category (null if category has no table)
    tableForItemCategory(category: number): readonly Pick<ItemTable, "description" | "flavor" | "identified">[] | null;

    // Formula helpers
    netEnchant(item: Item): Fixpt;
    strengthModifier(item: Item): Fixpt;
    accuracyFraction(enchant: Fixpt): Fixpt;
    damageFraction(enchant: Fixpt): Fixpt;
    displayedArmorValue(): number;
    armorValueIfUnenchanted(item: Item): number;
    armorStealthAdjustment(item: Item | null): number;
    enchantMagnitude(): number;
    enchantIncrement(item: Item): Fixpt;
    apparentRingBonus(ringKind: number): number;

    // Power-table helpers (staves)
    staffChargeDuration(item: Item): bigint;
    ringWisdomMultiplier(enchant: Fixpt): Fixpt;
    staffDamageLow(enchant: Fixpt): number;
    staffDamageHigh(enchant: Fixpt): number;
    staffPoison(enchant: Fixpt): number;
    staffBlinkDistance(enchant: Fixpt): number;
    staffEntrancementDuration(enchant: Fixpt): number;
    staffHasteDuration(enchant: Fixpt): number;
    staffBladeCount(enchant: Fixpt): number;
    staffProtection(enchant: Fixpt): number;
    staffDiscordDuration(enchant: Fixpt): number;

    // Power-table helpers (weapons)
    runicWeaponChance(item: Item, nextLevel: boolean, enchant: Fixpt): number;
    weaponImageCount(enchant: Fixpt): number;
    weaponImageDuration(enchant: Fixpt): number;
    weaponParalysisDuration(enchant: Fixpt): number;
    weaponSlowDuration(enchant: Fixpt): number;
    weaponConfusionDuration(enchant: Fixpt): number;
    weaponForceDistance(enchant: Fixpt): number;

    // Power-table helpers (armor)
    armorImageCount(enchant: Fixpt): number;
    armorAbsorptionMax(enchant: Fixpt): number;
    armorReprisalPercent(enchant: Fixpt): number;
    reflectionChance(enchant: Fixpt): number;

    // Power-table helpers (rings)
    turnsForFullRegenInThousandths(enchant: Fixpt): number;
    ringWisdomRate(enchant: Fixpt): number;   // ringWisdomMultiplier * 100 / FP_FACTOR

    // Power-table helpers (charms)
    charmHealing(enchant: Fixpt): number;
    charmProtection(enchant: Fixpt): number;
    charmShattering(enchant: Fixpt): number;
    charmGuardianLifespan(enchant: Fixpt): number;
    charmNegationRadius(enchant: Fixpt): number;
    charmEffectDuration(kind: number, enchantLevel: number): number;
    charmRechargeDelay(kind: number, enchantLevel: number): number;

    // String helpers
    itemName(item: Item, includeDetails: boolean, includeArticle: boolean): string;
    encodeMessageColor(color: Readonly<Color>): string;
    isVowelish(word: string): boolean;
    itemIsCarried(item: Item): boolean;

    // Monster class helpers
    describeMonsterClass(classID: number, useAnd: boolean): string;
    monsterClassHasAcidicMonster(classID: number): boolean;

    // Color constants
    goodMessageColor: Readonly<Color>;
    badMessageColor: Readonly<Color>;
    white: Readonly<Color>;
    itemMessageColor: Readonly<Color>;

    // Name tables
    weaponRunicNames: readonly string[];
    armorRunicNames: readonly string[];

    // Game constants
    weaponKillsToAutoID: number;
    armorDelayToAutoID: number;
    ringDelayToAutoID: number;
    TURNS_FOR_FULL_REGEN: number;
}

// =============================================================================
// itemDetails — Items.c:1879
// =============================================================================

/**
 * Generate the full sidebar detail text for an item.
 * Returns a string with embedded color escape sequences.
 *
 * C: void itemDetails(char *buf, item *theItem) — Items.c:1879
 */
export function itemDetails(theItem: Item, ctx: ItemDetailsContext): string {
    const g = ctx.encodeMessageColor(ctx.goodMessageColor);
    const b = ctx.encodeMessageColor(ctx.badMessageColor);
    const w = ctx.encodeMessageColor(ctx.white);
    const singular = theItem.quantity === 1;
    const carried = ctx.itemIsCarried(theItem);
    const identified = !!(theItem.flags & ItemFlag.ITEM_IDENTIFIED) || ctx.playbackOmniscience;
    const magicDetected = !!(theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED);

    // ── Name line ──────────────────────────────────────────────────────────
    const theName = ctx.itemName(theItem, false, false);
    const fullName = ctx.itemName(theItem, true, true);
    let buf = ctx.encodeMessageColor(ctx.itemMessageColor);
    buf += fullName.toUpperCase();
    if (carried) buf += ` (${theItem.inventoryLetter})`;
    buf += `${w}\n\n`;

    const enchant = ctx.netEnchant(theItem);
    const mag = ctx.enchantMagnitude();

    // ── Introductory description ───────────────────────────────────────────
    const catTable = ctx.tableForItemCategory(theItem.category);
    if (catTable && (catTable[theItem.kind].identified || ctx.playbackOmniscience)) {
        buf += catTable[theItem.kind].description;
        if (theItem.category === ItemCategory.POTION && theItem.kind === 13 /* POTION_LIFE */) {
            const pct = Math.trunc((ctx.player.info.maxHP + 10) * 100 / ctx.player.info.maxHP - 100);
            buf += `\n\nIt will increase your maximum health by ${g}${pct}%${w}.`;
        }
    } else {
        buf += buildUnidentifiedIntro(theItem, singular, ctx);
    }

    // ── Origin depth ───────────────────────────────────────────────────────
    if (carried && theItem.originDepth > 0) {
        const vault = (theItem.flags & ItemFlag.ITEM_IS_KEY) && !(theItem.category & ItemCategory.KEY);
        buf += ` (You found ${singular ? "it" : "them"}${vault ? " in a vault" : ""} on depth ${theItem.originDepth}.) `;
    }

    // ── Category-specific details ──────────────────────────────────────────
    buf += buildCategoryDetails(theItem, theName, singular, enchant, mag, identified, magicDetected, g, b, w, ctx);

    return buf;
}

// =============================================================================
// Private helpers
// =============================================================================

function buildUnidentifiedIntro(theItem: Item, singular: boolean, ctx: ItemDetailsContext): string {
    const catTable = ctx.tableForItemCategory(theItem.category);
    const flavor = catTable ? catTable[theItem.kind].flavor ?? "" : "";
    switch (theItem.category) {
        case ItemCategory.POTION:
            return `${singular ? "This" : "These"} flask${singular ? "" : "s"} contain${singular ? "s" : ""} a swirling ${flavor} liquid. Who knows what ${singular ? "it" : "they"} will do when drunk or thrown?`;
        case ItemCategory.SCROLL:
            return `${singular ? "This" : "These"} parchment${singular ? "" : "s"} ${singular ? "is" : "are"} covered with indecipherable writing, and bear${singular ? "s" : ""} a title of "${flavor}." Who knows what ${singular ? "it" : "they"} will do when read aloud?`;
        case ItemCategory.STAFF:
            return `This gnarled ${flavor} staff is warm to the touch. Who knows what it will do when used?`;
        case ItemCategory.WAND:
            return `This thin ${flavor} wand is warm to the touch. Who knows what it will do when used?`;
        case ItemCategory.RING:
            return `This metal band is adorned with a${ctx.isVowelish(flavor) ? "n" : ""} ${flavor} gem that glitters in the darkness. Who knows what effect it has when worn? `;
        case ItemCategory.CHARM:
            return "What a perplexing charm!";
        case ItemCategory.AMULET:
            return "Legends are told about this mysterious golden amulet, and legions of adventurers have perished in its pursuit. Unfathomable riches await anyone with the skill and ambition to carry it into the light of day.";
        case ItemCategory.GEM:
            return `Faint golden lights swirl and fluoresce beneath the stone${singular ? "'s" : "s'"} surface. Lumenstones are said to contain mysterious properties of untold power, but for you, they mean one thing: riches.`;
        case ItemCategory.KEY:
            return ctx.keyTable[theItem.kind]?.description ?? "";
        case ItemCategory.GOLD:
            return `A pile of ${theItem.quantity} shining gold coins.`;
        default:
            return "";
    }
}

function buildCategoryDetails(
    theItem: Item, theName: string, singular: boolean,
    enchant: Fixpt, mag: number, identified: boolean, magicDetected: boolean,
    g: string, b: string, w: string,
    ctx: ItemDetailsContext,
): string {
    let buf = "";
    const enchantInc = ctx.enchantIncrement(theItem);
    const nextEnchant = enchant + BigInt(mag) * enchantInc;

    switch (theItem.category) {
        case ItemCategory.FOOD: {
            const hungry = (STOMACH_SIZE - ctx.player.status[12 /* STATUS_NUTRITION */]) >= ctx.foodTable[theItem.kind].power;
            buf += `\n\nYou are ${hungry ? "" : "not yet "}hungry enough to fully enjoy a ${ctx.foodTable[theItem.kind].name}.`;
            break;
        }

        case ItemCategory.WEAPON:
        case ItemCategory.ARMOR:
            buf += buildWeaponArmorDetails(theItem, theName, singular, enchant, nextEnchant, mag, identified, magicDetected, g, b, w, ctx);
            break;

        case ItemCategory.STAFF:
            buf += buildStaffDetails(theItem, theName, enchant, nextEnchant, g, b, w, ctx);
            break;

        case ItemCategory.WAND:
            buf += buildWandDetails(theItem, enchant, mag, ctx);
            break;

        case ItemCategory.RING:
            buf += buildRingDetails(theItem, theName, enchant, nextEnchant, identified, g, b, w, ctx);
            break;

        case ItemCategory.CHARM:
            buf += buildCharmDetails(theItem, enchant, nextEnchant, mag, ctx);
            break;

        default:
            break;
    }
    return buf;
}
