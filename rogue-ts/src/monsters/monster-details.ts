/*
 *  monster-details.ts — Sidebar monster description: monsterDetails + helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: staffOrWandEffectOnMonsterDescription, summarizePack,
 *             monsterDetails
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, Bolt, FloorTileType, ItemTable, Pos, Color, Mutation, MonsterWords, Fixpt } from "../types/types.js";
import { BoltEffect } from "../types/enums.js";
import { ItemCategory, WandKind, CharmKind, ScrollKind, StaffKind } from "../types/enums.js";
import { CreatureState, StatusEffect } from "../types/enums.js";
import {
    MonsterBehaviorFlag, MonsterAbilityFlag, MonsterBookkeepingFlag, ItemFlag, BoltFlag,
} from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { staffDamageLow, staffDamageHigh, staffPoison } from "../power/power-tables.js";
import {
    goodMessageColor, badMessageColor, itemMessageColor,
    advancementMessageColor, pink, white,
} from "../globals/colors.js";
import {
    buildProperCommaString, monsterIsNegatable,
    getMonsterAbilitiesText, getMonsterDominationText,
} from "./monster-details-helpers.js";

// =============================================================================
// MonsterDetailsContext
// =============================================================================

export interface MonsterDetailsContext {
    player: Creature;
    rogue: { weapon: Item | null; armor: Item | null; strength: number };
    packItems: Item[];

    boltCatalog: readonly Bolt[];
    staffTable: readonly ItemTable[];
    wandTable: readonly ItemTable[];
    monsterText: readonly Pick<MonsterWords, "flavorText">[];
    mutationCatalog: readonly Pick<Mutation, "description" | "canBeNegated" | "textColor">[];
    tileCatalog: readonly FloorTileType[];

    monsterName(monst: Creature, includeArticle: boolean): string;
    monsterIsInClass(monst: Creature, monsterClass: number): boolean;
    resolvePronounEscapes(text: string, monst: Creature): string;
    hitProbability(attacker: Creature, defender: Creature): number;
    /** Returns monsterDamageAdjustmentAmount as a Fixpt bigint. */
    monsterDamageAdjustment(monst: Creature): Fixpt;
    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string;
    encodeMessageColor(color: Readonly<Color>): string;
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    cellHasTMFlag(loc: Pos, flag: number): boolean;
    layerWithFlag(x: number, y: number, flag: number): number;
}

// =============================================================================
// PackSummary
// =============================================================================

interface PackSummary {
    hasNegationWand: boolean;
    hasNegationScroll: boolean;
    hasNegationCharm: boolean;
    hasDominationWand: boolean;
    hasShatteringCharm: boolean;
    hasShatteringScroll: boolean;
    hasTunnelingStaff: boolean;
    wandCount: number;
    staffCount: number;
}

// =============================================================================
// boltIndexForItem / boltEffectForItem — Items.c:4337–4351
// =============================================================================

function boltIndexForItem(
    theItem: Item,
    staffTable: readonly ItemTable[],
    wandTable: readonly ItemTable[],
): number {
    if (theItem.category & ItemCategory.STAFF) return staffTable[theItem.kind]?.power ?? 0;
    if (theItem.category & ItemCategory.WAND) return wandTable[theItem.kind]?.power ?? 0;
    return 0;
}

function boltEffectForItem(
    theItem: Item,
    boltCatalog: readonly Bolt[],
    staffTable: readonly ItemTable[],
    wandTable: readonly ItemTable[],
): BoltEffect {
    if (theItem.category & (ItemCategory.STAFF | ItemCategory.WAND)) {
        return boltCatalog[boltIndexForItem(theItem, staffTable, wandTable)]?.boltEffect ?? BoltEffect.None;
    }
    return BoltEffect.None;
}

// =============================================================================
// staffOrWandEffectOnMonsterDescription — Monsters.c:4373
// =============================================================================

/**
 * Returns a description of what a known staff or wand will do to the monster.
 * Returns empty string if no description is applicable.
 *
 * Ported from staffOrWandEffectOnMonsterDescription() in Monsters.c.
 */
function staffOrWandEffectOnMonsterDescription(
    theItem: Item,
    monst: Creature,
    ctx: MonsterDetailsContext,
): string {
    if (!(theItem.category & (ItemCategory.STAFF | ItemCategory.WAND))) return "";
    const kindTable = (theItem.category & ItemCategory.STAFF) ? ctx.staffTable : ctx.wandTable;
    if (!kindTable[theItem.kind]?.identified) return "";

    const monstName = ctx.monsterName(monst, true);
    const theItemName = ctx.itemName(theItem, false, false);
    const letter = theItem.inventoryLetter;
    const effect = boltEffectForItem(theItem, ctx.boltCatalog, ctx.staffTable, ctx.wandTable);
    const boltIdx = boltIndexForItem(theItem, ctx.staffTable, ctx.wandTable);
    const netEnch = BigInt(theItem.enchant1) * FP_FACTOR;

    switch (effect) {
        case BoltEffect.Damage: {
            const fiery = !!(ctx.boltCatalog[boltIdx]?.flags & BoltFlag.BF_FIERY);
            if (
                (fiery && monst.status[StatusEffect.ImmuneToFire]) ||
                (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)
            ) {
                return `\n     Your ${theItemName} (${letter}) will not harm ${monstName}.`;
            }
            if (theItem.flags & (ItemFlag.ITEM_MAX_CHARGES_KNOWN | ItemFlag.ITEM_IDENTIFIED)) {
                const low = staffDamageLow(netEnch);
                const high = staffDamageHigh(netEnch);
                if (low >= monst.currentHP) {
                    const verb = (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "destroy" : "kill";
                    return `\n     Your ${theItemName} (${letter}) will ${verb} ${monstName} in one hit.`;
                }
                return `\n     Your ${theItemName} (${letter}) will hit ${monstName} for between ${Math.floor(100 * low / monst.currentHP)}% and ${Math.floor(100 * high / monst.currentHP)}% of $HISHER current health.`;
            }
            return "";
        }
        case BoltEffect.Poison: {
            if (monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) {
                return `\n     Your ${theItemName} (${letter}) will not affect ${monstName}.`;
            }
            const poisonAmt = staffPoison(netEnch);
            return `\n     Your ${theItemName} (${letter}) will poison ${monstName} for ${Math.floor(100 * poisonAmt / monst.currentHP)}% of $HISHER current health.`;
        }
        default:
            return "";
    }
}

// =============================================================================
// summarizePack — Monsters.c:4447
// =============================================================================

function summarizePack(
    packItems: Item[],
    staffTable: readonly ItemTable[],
    wandTable: readonly ItemTable[],
): PackSummary {
    const pack: PackSummary = {
        hasNegationWand: false, hasNegationScroll: false, hasNegationCharm: false,
        hasDominationWand: false, hasShatteringCharm: false, hasShatteringScroll: false,
        hasTunnelingStaff: false, wandCount: 0, staffCount: 0,
    };
    for (const theItem of packItems) {
        if (!(theItem.category & (ItemCategory.CHARM | ItemCategory.WAND | ItemCategory.SCROLL | ItemCategory.STAFF))) {
            continue;
        }
        const table = (theItem.category & ItemCategory.STAFF) ? staffTable
            : (theItem.category & ItemCategory.WAND) ? wandTable : null;
        if (table && !table[theItem.kind]?.identified) continue;

        if (theItem.category & ItemCategory.WAND) {
            pack.wandCount++;
            if (theItem.kind === WandKind.Negation) pack.hasNegationWand = true;
            if (theItem.kind === WandKind.Domination) pack.hasDominationWand = true;
        } else if (theItem.category & ItemCategory.STAFF) {
            pack.staffCount++;
            if (theItem.kind === StaffKind.Tunneling) pack.hasTunnelingStaff = true;
        } else if (theItem.category & ItemCategory.CHARM) {
            if (theItem.kind === CharmKind.Negation) pack.hasNegationCharm = true;
            if (theItem.kind === CharmKind.Shattering) pack.hasShatteringCharm = true;
        } else if (theItem.category & ItemCategory.SCROLL) {
            if (theItem.kind === ScrollKind.Negation) pack.hasNegationScroll = true;
            if (theItem.kind === ScrollKind.Shattering) pack.hasShatteringScroll = true;
        }
    }
    return pack;
}

// =============================================================================
// monsterDetails — Monsters.c:4490
// =============================================================================

/**
 * Builds the full sidebar detail text for a monster.
 * Returns a string with embedded color escape sequences.
 *
 * Ported from monsterDetails() in Monsters.c.
 */
export function monsterDetails(monst: Creature, ctx: MonsterDetailsContext): string {
    const { player, rogue } = ctx;
    const monstName = ctx.monsterName(monst, true);
    const capMonstName = monstName.charAt(0).toUpperCase() + monstName.slice(1);
    let buf = "";

    // Flavor text (skip beached-whale case)
    if (
        !(monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) ||
        ctx.cellHasTMFlag(monst.loc, 1 << 0 /* TM_ALLOWS_SUBMERGING */)
    ) {
        const flavor = ctx.monsterText[monst.info.monsterID]?.flavorText ?? "";
        if (flavor) buf += `     ${flavor}\n     `;
    }

    // Mutation description
    if (monst.mutationIndex >= 0) {
        const mutation = ctx.mutationCatalog[monst.mutationIndex];
        if (mutation) {
            buf += ctx.encodeMessageColor(mutation.textColor);
            let desc = mutation.description;
            desc = ctx.resolvePronounEscapes(desc, monst);
            buf += desc.charAt(0).toUpperCase() + desc.slice(1) + "\n     ";
            buf += ctx.encodeMessageColor(white);
        }
    }

    // Trapped in terrain
    if (
        !(monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS) &&
        ctx.cellHasTerrainFlag(monst.loc, 1 << 0 /* T_OBSTRUCTS_PASSABILITY */)
    ) {
        const layer = ctx.layerWithFlag(monst.loc.x, monst.loc.y, 1 << 0);
        const tile = ctx.tileCatalog[layer];
        const prep = (tile?.mechFlags ?? 0) & (1 << 8) /* TM_STAND_IN_TILE */ ? "in" : "on";
        buf += `${capMonstName} is trapped ${prep} ${tile?.description ?? "impassable terrain"}.\n     `;
    }

    // Allegiance
    if (monst.creatureState === CreatureState.Ally) {
        buf += ctx.encodeMessageColor(goodMessageColor);
        buf += `${capMonstName} is your ally.\n     `;
        if (monst.newPowerCount > 0) {
            buf += ctx.encodeMessageColor(advancementMessageColor);
            const n = monst.newPowerCount;
            let text = n === 1
                ? "$HESHE seems ready to learn something new.\n     "
                : `$HESHE seems ready to learn ${n} new talents.\n     `;
            text = ctx.resolvePronounEscapes(text, monst);
            buf += text.charAt(0).toUpperCase() + text.slice(1);
        }
    }

    // Combat info — monster attacking player
    const monsterHitChance = ctx.hitProbability(monst, player);
    const adj = ctx.monsterDamageAdjustment(monst);
    const maxDmg = Number(BigInt(monst.info.damage.upperBound) * adj / FP_FACTOR);

    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
        !ctx.cellHasTMFlag(monst.loc, 1 << 0)
    ) {
        buf += `     ${capMonstName} writhes helplessly on dry land.\n     `;
    } else if (
        rogue.armor &&
        (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
        (rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) &&
        rogue.armor.enchant2 === 5 /* A_IMMUNITY */ &&
        ctx.monsterIsInClass(monst, rogue.armor.vorpalEnemy)
    ) {
        buf += ctx.encodeMessageColor(goodMessageColor);
        buf += `Your ${ctx.itemName(rogue.armor, false, false)} renders you immune to ${monstName}.\n     `;
    } else if (maxDmg === 0) {
        buf += `${capMonstName} deals no direct damage.\n     `;
    } else {
        buf += ctx.encodeMessageColor(badMessageColor);
        if (monst.info.abilityFlags & MonsterAbilityFlag.MA_POISONS) {
            const poisonAvg = Number(BigInt(monst.info.damage.lowerBound + monst.info.damage.upperBound) * adj / 2n / FP_FACTOR);
            buf += `${capMonstName} has a ${monsterHitChance}% chance to poison you and typically poisons for ${poisonAvg} turns.\n     `;
        } else {
            const hitsToKill = Math.max(1, Math.ceil(player.currentHP / maxDmg));
            const pctHealth = Math.floor(100 * Number(BigInt(monst.info.damage.lowerBound + monst.info.damage.upperBound) * adj / 2n / FP_FACTOR) / player.currentHP);
            buf += `${capMonstName} has a ${monsterHitChance}% chance to hit you, typically hits for ${pctHealth}% of your current health, and at worst, could defeat you in ${hitsToKill} hit${hitsToKill > 1 ? "s" : ""}.\n     `;
        }
    }

    // Player attacking monster
    let playerAvgDmg: number;
    let playerMaxDmg: number;
    if (!rogue.weapon || (rogue.weapon.flags & ItemFlag.ITEM_IDENTIFIED)) {
        playerAvgDmg = Math.floor((player.info.damage.lowerBound + player.info.damage.upperBound) / 2);
        playerMaxDmg = player.info.damage.upperBound;
    } else {
        playerAvgDmg = Math.max(1, Math.floor((rogue.weapon.damage.lowerBound + rogue.weapon.damage.upperBound) / 2));
        playerMaxDmg = Math.max(1, rogue.weapon.damage.upperBound);
    }

    if (playerMaxDmg === 0) {
        buf += ctx.encodeMessageColor(white);
        buf += "You deal no direct damage.";
    } else if (
        rogue.weapon &&
        (rogue.weapon.flags & ItemFlag.ITEM_RUNIC) &&
        (rogue.weapon.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) &&
        rogue.weapon.enchant2 === 7 /* W_SLAYING */ &&
        ctx.monsterIsInClass(monst, rogue.weapon.vorpalEnemy)
    ) {
        buf += ctx.encodeMessageColor(goodMessageColor);
        buf += `Your ${ctx.itemName(rogue.weapon, false, false)} will slay ${monstName} in one stroke.`;
    } else if (monst.info.flags & (MonsterBehaviorFlag.MONST_INVULNERABLE | MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS)) {
        buf += ctx.encodeMessageColor(white);
        buf += `${monstName} is immune to your attacks.`;
    } else if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
        buf += ctx.encodeMessageColor(goodMessageColor);
        buf += `${capMonstName} is being held captive.`;
    } else {
        buf += ctx.encodeMessageColor(goodMessageColor);
        const hitsToKill = Math.max(1, Math.ceil(monst.currentHP / playerMaxDmg));
        const playerHitChance = ctx.hitProbability(player, monst);
        const pctHealth = Math.floor(100 * playerAvgDmg / monst.currentHP);
        let text = `You have a ${playerHitChance}% chance to hit ${monstName}, typically hit for ${pctHealth}% of $HISHER current health, and at best, could defeat $HIMHER in ${hitsToKill} hit${hitsToKill > 1 ? "s" : ""}.`;
        text = ctx.resolvePronounEscapes(text, monst);
        buf += text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Pack summary → negation method text
    const pack = summarizePack(ctx.packItems, ctx.staffTable, ctx.wandTable);
    let negBuf = "";
    if (monsterIsNegatable(monst, ctx.boltCatalog, ctx.mutationCatalog)) {
        if (pack.hasNegationCharm) negBuf += "negation charm";
        if (pack.hasNegationScroll) negBuf += "&scroll of negation";
        if (pack.hasNegationWand && !(monst.info.abilityFlags & MonsterAbilityFlag.MA_REFLECT_100)) {
            negBuf += "&wand of negation";
        }
    }
    const negText = buildProperCommaString(negBuf);

    // Item-specific effects
    buf += ctx.encodeMessageColor(itemMessageColor);
    let printStaffWand = true;

    if ((monst.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED) && negText) {
        const verb = (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "destroy" : "kill";
        buf += `\n     Your ${negText} will ${verb} ${monstName}.`;
    }

    if (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS) {
        let shatterBuf = "";
        if (pack.hasShatteringCharm) shatterBuf += "shattering charm";
        if (pack.hasShatteringScroll) shatterBuf += "&scroll of shattering";
        if (pack.hasTunnelingStaff) shatterBuf += "&staff of tunneling";
        const shatterText = buildProperCommaString(shatterBuf);
        if (shatterText) buf += `\n     Your ${shatterText} will destroy ${monstName}.`;
    }

    if ((monst.info.abilityFlags & MonsterAbilityFlag.MA_REFLECT_100) && (pack.staffCount || pack.wandCount)) {
        const staves = pack.staffCount > 0 ? "staff" + (pack.staffCount > 1 ? "s" : "") : "";
        const wands = pack.wandCount > 0 ? "wand" + (pack.wandCount > 1 ? "s" : "") : "";
        buf += `\n     Bolts from your ${staves}${staves && wands ? " and " : ""}${wands} that hit ${monstName} will be reflected directly back at you.`;
        printStaffWand = false;
    }

    if (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) printStaffWand = false;

    if (printStaffWand) {
        for (const theItem of ctx.packItems) {
            const desc = staffOrWandEffectOnMonsterDescription(theItem, monst, ctx);
            if (desc) buf += desc;
        }
        if (pack.hasDominationWand) {
            buf += getMonsterDominationText(monst, ctx.monsterName.bind(ctx));
        }
    }

    // Carried item
    if (monst.carriedItem) {
        buf += ctx.encodeMessageColor(itemMessageColor);
        buf += "\n     " + (capMonstName + " has " + ctx.itemName(monst.carriedItem, true, true) + ".").replace(/^./, c => c.toUpperCase());
    }

    // Was negated
    if (monst.wasNegated && monst.newPowerCount === monst.totalPowerCount) {
        buf += ctx.encodeMessageColor(pink);
        let text = `${capMonstName} is stripped of $HISHER special traits.`;
        text = ctx.resolvePronounEscapes(text, monst);
        buf += "\n     " + text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Abilities list
    buf += ctx.encodeMessageColor(white);
    const showAll = ((monst.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED) && negText) || !negText;
    if (showAll) {
        const abilities = getMonsterAbilitiesText(monst, true, true, ctx.boltCatalog);
        if (abilities) buf += `\n     ${capMonstName} ${abilities}.`;
    } else {
        const nonNeg = getMonsterAbilitiesText(monst, false, true, ctx.boltCatalog);
        const hasNonNeg = !!nonNeg;
        if (nonNeg) buf += `\n     ${capMonstName} ${nonNeg}.`;
        const neg = getMonsterAbilitiesText(monst, true, false, ctx.boltCatalog);
        if (neg) {
            buf += `\n     ${capMonstName}${hasNonNeg ? " also" : ""} has special traits that can be removed by a `;
            buf += ctx.encodeMessageColor(itemMessageColor) + negText + ctx.encodeMessageColor(white);
            buf += `: it ${neg}.`;
        }
    }

    return ctx.resolvePronounEscapes(buf, monst);
}
