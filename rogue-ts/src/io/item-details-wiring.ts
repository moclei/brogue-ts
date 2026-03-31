/*
 *  io/item-details-wiring.ts — buildItemDetailsFn: wires ItemDetailsContext from live state
 *  Port V2 — rogue-ts
 *
 *  Exports:
 *    buildItemDetailsFn() — returns (item: Item) => string closure, fully wired
 *
 *  Used by io-wiring.ts (buildRefreshSideBarFn) and io/sidebar-wiring.ts
 *  (buildSidebarContext) to replace the itemDetails stub.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import type { Item } from "../types/types.js";
import { ItemFlag } from "../types/flags.js";
import { ItemCategory } from "../types/enums.js";
import { itemDetails as itemDetailsFn, type ItemDetailsContext } from "../items/item-details.js";
import { itemName as itemNameFn, itemIsCarried as itemIsCarriedFn, isVowelish } from "../items/item-naming.js";
import {
    netEnchant as netEnchantFn,
    strengthModifier as strengthModifierFn,
    apparentRingBonus as apparentRingBonusFn,
    enchantIncrement as enchantIncrementFn,
    enchantMagnitude as enchantMagnitudeFn,
    armorValueIfUnenchanted as armorValueIfUnenchantedFn,
    displayedArmorValue as displayedArmorValueFn,
} from "../items/item-usage.js";
import { buildEquipState } from "../items/equip-helpers.js";
import { getTableForCategory as getTableForCategoryFn } from "../items/item-generation.js";
import { describeMonsterClass as describeMonsterClassFn, monsterClassHasAcidicMonster as monsterClassHasAcidicMonsterFn } from "../items/item-utils.js";
import { foodTable, keyTable, staffTable, wandTable, ringTable, armorTable, charmEffectTable } from "../globals/item-catalog.js";
import { monsterClassCatalog } from "../globals/monster-class-catalog.js";
import { weaponRunicNames, armorRunicNames } from "../globals/string-tables.js";
import {
    staffDamageLow, staffDamageHigh, staffPoison, staffBlinkDistance,
    staffEntrancementDuration, staffHasteDuration, staffBladeCount,
    staffProtection, staffDiscordDuration,
    ringWisdomMultiplier,
    weaponImageCount, weaponImageDuration, weaponParalysisDuration,
    weaponSlowDuration, weaponConfusionDuration, weaponForceDistance,
    armorImageCount, armorAbsorptionMax, armorReprisalPercent, reflectionChance,
    turnsForFullRegenInThousandths,
    charmHealing, charmProtection, charmShattering,
    charmGuardianLifespan, charmNegationRadius,
    charmEffectDuration as charmEffectDurationFn,
    charmRechargeDelay as charmRechargeDelayFn,
    runicWeaponChance as runicWeaponChanceFn,
    accuracyFraction, damageFraction,
} from "../power/power-tables.js";
import { staffChargeDuration as staffChargeDurationFn } from "../time/misc-helpers.js";
import { encodeMessageColor } from "./color.js";
import { goodMessageColor, badMessageColor, white, itemMessageColor } from "../globals/colors.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { TURNS_FOR_FULL_REGEN } from "../types/constants.js";

// =============================================================================
// buildItemDetailsFn
// =============================================================================

/**
 * Returns a closure `(item: Item) => string` that generates the full sidebar
 * detail text for an item.  The closure captures live game state at call time.
 *
 * Called from io-wiring.ts and io/sidebar-wiring.ts to wire the itemDetails stub.
 */
export function buildItemDetailsFn(): (item: Item) => string {
    const {
        rogue, player, gameConst, packItems,
        mutableScrollTable, mutablePotionTable, monsterCatalog,
    } = getGameState();

    const namingCtx = {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as import("../types/types.js").ItemTable[],
        staffTable: staffTable as unknown as import("../types/types.js").ItemTable[],
        ringTable: ringTable as unknown as import("../types/types.js").ItemTable[],
        charmTable: [] as import("../types/types.js").ItemTable[],
        charmRechargeDelay: (kind: number, enchant: number) =>
            charmRechargeDelayFn(charmEffectTable[kind], enchant),
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: (classId: number) =>
            monsterClassCatalog[classId]?.name ?? "creature",
    };

    const equipState = buildEquipState();

    const ctx: ItemDetailsContext = {
        // Game state
        player,
        packItems,
        playbackOmniscience: rogue.playbackOmniscience,
        absoluteTurnNumber: rogue.absoluteTurnNumber,
        strength: rogue.strength,
        weapon: rogue.weapon,
        armor: rogue.armor,

        // Catalog tables
        foodTable: foodTable as unknown as Pick<import("../types/types.js").ItemTable, "name" | "power">[],
        keyTable: keyTable as unknown as Pick<import("../types/types.js").ItemTable, "description">[],
        staffTable: staffTable as unknown as Pick<import("../types/types.js").ItemTable, "identified">[],
        wandTable: wandTable as unknown as Pick<import("../types/types.js").ItemTable, "range" | "identified">[],
        ringTable: ringTable as unknown as Pick<import("../types/types.js").ItemTable, "identified">[],

        tableForItemCategory: (category) =>
            getTableForCategoryFn(category, {
                scrollTable: mutableScrollTable as unknown as import("../types/types.js").ItemTable[],
                potionTable: mutablePotionTable as unknown as import("../types/types.js").ItemTable[],
            }) as unknown as Pick<import("../types/types.js").ItemTable, "description" | "flavor" | "identified">[] | null,

        // Formula helpers
        netEnchant: (item) => netEnchantFn(item, rogue.strength, player.weaknessAmount),
        strengthModifier: (item) => strengthModifierFn(item, rogue.strength, player.weaknessAmount),
        accuracyFraction: (enchant) => accuracyFraction(enchant),
        damageFraction: (enchant) => damageFraction(enchant),
        displayedArmorValue: () => displayedArmorValueFn(equipState),
        armorValueIfUnenchanted: (item) => armorValueIfUnenchantedFn(item, rogue.strength, player.weaknessAmount),
        armorStealthAdjustment: (item) => {
            if (!item || !(item.category & ItemCategory.ARMOR)) return 0;
            return Math.max(0, (armorTable[item.kind]?.strengthRequired ?? 0) - 12);
        },
        enchantMagnitude: () => enchantMagnitudeFn(),
        enchantIncrement: (item) => enchantIncrementFn(item, rogue.strength, player.weaknessAmount),
        apparentRingBonus: (ringKind) => apparentRingBonusFn(ringKind, equipState),

        // Power-table helpers (staves)
        staffChargeDuration: (item) => BigInt(staffChargeDurationFn(item)),
        ringWisdomMultiplier: (enchant) => ringWisdomMultiplier(enchant),
        staffDamageLow: (enchant) => staffDamageLow(enchant),
        staffDamageHigh: (enchant) => staffDamageHigh(enchant),
        staffPoison: (enchant) => staffPoison(enchant),
        staffBlinkDistance: (enchant) => staffBlinkDistance(enchant),
        staffEntrancementDuration: (enchant) => staffEntrancementDuration(enchant),
        staffHasteDuration: (enchant) => staffHasteDuration(enchant),
        staffBladeCount: (enchant) => staffBladeCount(enchant),
        staffProtection: (enchant) => staffProtection(enchant),
        staffDiscordDuration: (enchant) => staffDiscordDuration(enchant),

        // Power-table helpers (weapons)
        runicWeaponChance: (item, _nextLevel, enchant) => {
            const adjDmg = Math.floor((item.damage.lowerBound + item.damage.upperBound) / 2);
            const stagger = !!(item.flags & ItemFlag.ITEM_ATTACKS_STAGGER);
            const quick = !!(item.flags & ItemFlag.ITEM_ATTACKS_QUICKLY);
            return runicWeaponChanceFn(item.enchant2, enchant, adjDmg, stagger, quick);
        },
        weaponImageCount: (enchant) => weaponImageCount(enchant),
        weaponImageDuration: (enchant) => weaponImageDuration(enchant),
        weaponParalysisDuration: (enchant) => weaponParalysisDuration(enchant),
        weaponSlowDuration: (enchant) => weaponSlowDuration(enchant),
        weaponConfusionDuration: (enchant) => weaponConfusionDuration(enchant),
        weaponForceDistance: (enchant) => weaponForceDistance(enchant),

        // Power-table helpers (armor)
        armorImageCount: (enchant) => armorImageCount(enchant),
        armorAbsorptionMax: (enchant) => armorAbsorptionMax(enchant),
        armorReprisalPercent: (enchant) => armorReprisalPercent(enchant),
        reflectionChance: (enchant) => reflectionChance(enchant),

        // Power-table helpers (rings)
        turnsForFullRegenInThousandths: (enchant) => turnsForFullRegenInThousandths(enchant),
        ringWisdomRate: (enchant) => Math.trunc(Number(ringWisdomMultiplier(enchant)) * 100 / Number(FP_FACTOR)),

        // Power-table helpers (charms) — index by CharmKind ordinal
        charmHealing: (enchant) => charmHealing(enchant, charmEffectTable[0].effectMagnitudeMultiplier),
        charmProtection: (enchant) => charmProtection(enchant, charmEffectTable[1].effectMagnitudeMultiplier),
        charmShattering: (enchant) => charmShattering(enchant, charmEffectTable[7].effectMagnitudeConstant),
        charmGuardianLifespan: (enchant) => charmGuardianLifespan(enchant, charmEffectTable[8].effectMagnitudeConstant, charmEffectTable[8].effectMagnitudeMultiplier),
        charmNegationRadius: (enchant) => charmNegationRadius(enchant, charmEffectTable[11].effectMagnitudeConstant, charmEffectTable[11].effectMagnitudeMultiplier),
        charmEffectDuration: (kind, enchantLevel) => charmEffectDurationFn(charmEffectTable[kind], enchantLevel),
        charmRechargeDelay: (kind, enchantLevel) => charmRechargeDelayFn(charmEffectTable[kind], enchantLevel),

        // String helpers
        itemName: (item, incDet, incArt) => itemNameFn(item, incDet, incArt, namingCtx),
        encodeMessageColor: (color) => encodeMessageColor(color),
        isVowelish: (word) => isVowelish(word),
        itemIsCarried: (item) => itemIsCarriedFn(item, packItems),

        // Monster class helpers
        describeMonsterClass: (classID, useAnd) => describeMonsterClassFn(classID, useAnd, monsterClassCatalog, monsterCatalog),
        monsterClassHasAcidicMonster: (classID) => monsterClassHasAcidicMonsterFn(classID, monsterClassCatalog, monsterCatalog),

        // Color constants
        goodMessageColor,
        badMessageColor,
        white,
        itemMessageColor,

        // Name tables
        weaponRunicNames,
        armorRunicNames,

        // Game constants
        weaponKillsToAutoID: gameConst.weaponKillsToAutoID,
        armorDelayToAutoID: gameConst.armorDelayToAutoID,
        ringDelayToAutoID: gameConst.ringDelayToAutoID,
        TURNS_FOR_FULL_REGEN,
    };

    return (item: Item) => itemDetailsFn(item, ctx);
}
