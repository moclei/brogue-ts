/*
 *  items/item-details-helpers.ts — Per-category item detail builders
 *  Port V2 — rogue-ts
 *
 *  Private helpers for item-details.ts. Split to keep both files under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, Fixpt } from "../types/types.js";
import { ItemCategory, WeaponEnchant, ArmorEnchant, StaffKind, CharmKind, RingKind } from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import type { ItemDetailsContext } from "./item-details.js";

const WEAPON_RUNIC_EFFECT_DESCRIPTIONS: readonly string[] = [
    "time will stop while you take an extra turn",
    "the enemy will die instantly",
    "the enemy will be paralyzed",
    "[multiplicity]",
    "the enemy will be slowed",
    "the enemy will be confused",
    "the enemy will be flung",
    "[slaying]",
    "the enemy will be healed",
    "the enemy will be cloned",
];

export function buildWeaponArmorDetails(
    theItem: Item, theName: string, singular: boolean,
    enchant: Fixpt, nextEnchant: Fixpt, _mag: number,
    identified: boolean, magicDetected: boolean,
    g: string, b: string, w: string,
    ctx: ItemDetailsContext,
): string {
    let buf = "";
    const isWeapon = !!(theItem.category & ItemCategory.WEAPON);
    const strMod = ctx.strengthModifier(theItem);
    const strModNum = Number(strMod) / Number(FP_FACTOR);

    if (identified) {
        if (theItem.enchant1) {
            if (theItem.enchant1 > 0) {
                buf += `\n\nThe ${theName} bear${singular ? "s" : ""} an intrinsic enchantment of ${g}+${theItem.enchant1}${w}`;
            } else {
                buf += `\n\nThe ${theName} bear${singular ? "s" : ""} an intrinsic penalty of ${theItem.enchant1}`;
            }
        } else {
            buf += `\n\nThe ${theName} bear${singular ? "s" : ""} no intrinsic enchantment`;
        }
        if (strMod !== 0n) {
            const addl = theItem.enchant1 ? "and" : "but";
            const sameDir = theItem.enchant1 && (theItem.enchant1 > 0) === (strMod > 0n);
            buf += `, ${addl} ${singular ? "carries" : "carry"} ${sameDir ? "an additional" : "a"} ${strMod > 0n ? "bonus of " : "penalty of "}${strMod > 0n ? g : b}${strModNum > 0 ? "+" : ""}${strModNum.toFixed(2)}${w} because of your ${strMod > 0n ? "excess" : "inadequate"} strength. `;
        } else {
            buf += ". ";
        }
    } else {
        if (theItem.enchant1 > 0 && magicDetected) {
            buf += `\n\nYou can feel an ${g}aura of benevolent magic${w} radiating from the ${theName}. `;
        }
        if (strMod !== 0n) {
            const alsoStr = theItem.enchant1 > 0 && magicDetected ? "also " : "";
            buf += `\n\nThe ${theName} ${alsoStr}${singular ? "carries" : "carry"} a ${strMod > 0n ? "bonus of " : "penalty of "}${strMod > 0n ? g : b}${strModNum > 0 ? "+" : ""}${strModNum.toFixed(2)}${w} because of your ${strMod > 0n ? "excess" : "inadequate"} strength. `;
        }
        if (isWeapon) {
            buf += `It will reveal its secrets if you defeat ${theItem.charges}${theItem.charges === ctx.weaponKillsToAutoID ? "" : " more"} ${theItem.charges === 1 ? "enemy" : "enemies"} with it. `;
        } else {
            buf += `It will reveal its secrets if worn for ${theItem.charges}${theItem.charges === ctx.armorDelayToAutoID ? "" : " more"} turn${theItem.charges === 1 ? "" : "s"}. `;
        }
    }

    if (!(theItem.flags & ItemFlag.ITEM_EQUIPPED)) buf += buildEquipComparison(theItem, theName, enchant, identified, g, b, w, ctx);
    if (theItem.flags & ItemFlag.ITEM_PROTECTED) buf += `${g}The ${theName} cannot be corroded by acid.${w} `;

    if (!isWeapon && !(theItem.flags & ItemFlag.ITEM_EQUIPPED)) {
        const curStealth = ctx.armorStealthAdjustment(ctx.armor);
        const newStealth = ctx.armorStealthAdjustment(theItem);
        if (curStealth !== newStealth) {
            const diff = ctx.armor ? newStealth - curStealth : newStealth;
            buf += `Equipping the ${theName} will ${diff > 0 ? `${b}increase` : `${g}decrease`} your stealth range by ${Math.abs(diff)}${w}. `;
        }
    }

    if (isWeapon) {
        buf += buildWeaponRunicDetails(theItem, theName, enchant, nextEnchant, identified, g, b, w, ctx);
        if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
            buf += `\n\nYou hold the ${theName} at the ready${(theItem.flags & ItemFlag.ITEM_CURSED) ? ", and because it is cursed, you are powerless to let go" : ""}. `;
        } else if ((identified || magicDetected) && (theItem.flags & ItemFlag.ITEM_CURSED)) {
            buf += `\n\n${b}You can feel a malevolent magic lurking within the ${theName}.${w} `;
        }
    } else {
        buf += buildArmorRunicDetails(theItem, theName, enchant, nextEnchant, identified, g, b, w, ctx);
        if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
            buf += `\n\nYou are wearing the ${theName}${(theItem.flags & ItemFlag.ITEM_CURSED) ? ", and because it is cursed, you are powerless to remove it" : ""}. `;
        } else if ((identified || magicDetected) && (theItem.flags & ItemFlag.ITEM_CURSED)) {
            buf += `\n\n${b}You can feel a malevolent magic lurking within the ${theName}.${w} `;
        }
    }
    return buf;
}

function buildEquipComparison(
    theItem: Item, theName: string, enchant: Fixpt, identified: boolean,
    g: string, b: string, w: string, ctx: ItemDetailsContext,
): string {
    const assumeStr = (identified || ctx.playbackOmniscience) ? "" : ", assuming it has no hidden properties,";
    if (theItem.category & ItemCategory.WEAPON) {
        const currentAcc = ctx.player.info.accuracy;
        let current = currentAcc;
        let currentDmg: Fixpt;
        if (ctx.weapon) {
            const wEnchant = identified || ctx.playbackOmniscience ? ctx.netEnchant(ctx.weapon) : ctx.strengthModifier(ctx.weapon);
            current = Math.trunc(current * Number(ctx.accuracyFraction(wEnchant)) / Number(FP_FACTOR));
            currentDmg = BigInt(ctx.weapon.damage.lowerBound + ctx.weapon.damage.upperBound) * FP_FACTOR / 2n * ctx.damageFraction(wEnchant) / FP_FACTOR;
        } else {
            currentDmg = BigInt(ctx.player.info.damage.lowerBound + ctx.player.info.damage.upperBound) * FP_FACTOR / 2n;
        }
        const newAcc = Math.trunc(currentAcc * Number(ctx.accuracyFraction(enchant)) / Number(FP_FACTOR));
        const newDmg = BigInt(theItem.damage.lowerBound + theItem.damage.upperBound) * FP_FACTOR / 2n * ctx.damageFraction(enchant) / FP_FACTOR;
        const accChange = Math.trunc(newAcc * 100 / current) - 100;
        const dmgChange = currentDmg === 0n ? 0 : Math.trunc(Number(newDmg * 100n / currentDmg)) - 100;
        return `Wielding the ${theName}${assumeStr} will ${accChange < 0 ? "decrease" : "increase"} your current accuracy by ${accChange < 0 ? b : accChange > 0 ? g : ""}${Math.abs(accChange)}%${w}, and will ${dmgChange < 0 ? "decrease" : "increase"} your current damage by ${dmgChange < 0 ? b : dmgChange > 0 ? g : ""}${Math.abs(dmgChange)}%${w}. `;
    } else {
        const newVal = Math.max(0, (identified || ctx.playbackOmniscience)
            ? Math.trunc((theItem.armor + 10 * Number(enchant) / Number(FP_FACTOR)) / 10)
            : ctx.armorValueIfUnenchanted(theItem));
        const cur = ctx.displayedArmorValue();
        return `Wearing the ${theName}${assumeStr} will result in an armor rating of ${newVal > cur ? g : newVal < cur ? b : w}${newVal}${w}. `;
    }
}

function buildWeaponRunicDetails(
    theItem: Item, theName: string, enchant: Fixpt, nextEnchant: Fixpt,
    identified: boolean, _g: string, _b: string, _w: string, ctx: ItemDetailsContext,
): string {
    if (!(theItem.flags & ItemFlag.ITEM_RUNIC)) return "";
    let buf = "";
    const runicId = theItem.enchant2 as WeaponEnchant;
    if ((theItem.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) || ctx.playbackOmniscience) {
        buf += `\n\nGlowing runes of ${ctx.weaponRunicNames[runicId]} adorn the ${theName}. `;
        if (runicId === WeaponEnchant.Slaying) {
            const desc = ctx.describeMonsterClass(theItem.vorpalEnemy, false);
            const vowel = ctx.isVowelish(desc) ? "n" : "";
            buf += ctx.monsterClassHasAcidicMonster(theItem.vorpalEnemy)
                ? `It is impervious to corrosion when attacking a${vowel} ${desc}, and will never fail to slay one in a single stroke. `
                : `It will never fail to slay a${vowel} ${desc} in a single stroke. `;
        } else if (runicId === WeaponEnchant.Multiplicity) {
            if (identified) {
                const cnt = ctx.weaponImageCount(enchant);
                const nxtCnt = ctx.weaponImageCount(nextEnchant);
                const dur = ctx.weaponImageDuration(enchant);
                const nxtDur = ctx.weaponImageDuration(nextEnchant);
                const nxtChance = ctx.runicWeaponChance(theItem, true, nextEnchant);
                buf += `${ctx.runicWeaponChance(theItem, false, 0n)}% of the time that it hits an enemy, ${cnt} spectral ${theName}${cnt > 1 ? "s" : ""} will spring into being with accuracy and attack power equal to your own, and will dissipate ${dur} turns later. (If the ${theName} is enchanted, ${nxtCnt} image${nxtCnt > 1 ? "s" : ""} will appear ${nxtChance}% of the time, and will last ${nxtDur} turns.)`;
            } else {
                buf += `Sometimes, when it hits an enemy, spectral ${theName}s will spring into being with accuracy and attack power equal to your own, and will dissipate shortly thereafter.`;
            }
        } else {
            buf += buildStandardRunicEffect(theItem, theName, runicId, enchant, nextEnchant, identified, _g, _b, _w, ctx);
        }
    } else if (theItem.flags & ItemFlag.ITEM_IDENTIFIED) {
        buf += `\n\nGlowing runes of an indecipherable language run down the length of the ${theName}. `;
    }
    return buf;
}

function buildStandardRunicEffect(
    theItem: Item, theName: string, runicId: WeaponEnchant,
    enchant: Fixpt, nextEnchant: Fixpt, identified: boolean,
    _g: string, _b: string, _w: string, ctx: ItemDetailsContext,
): string {
    let buf = "";
    if (identified && ctx.runicWeaponChance(theItem, false, 0n) < 2 && ctx.strength - ctx.player.weaknessAmount < theItem.strengthRequired) {
        buf += "Its runic effect will almost never activate because of your inadequate strength, but sometimes, when";
    } else {
        buf += identified ? `${ctx.runicWeaponChance(theItem, false, 0n)}% of the time that` : "Sometimes, when";
    }
    buf += ` it hits an enemy, ${WEAPON_RUNIC_EFFECT_DESCRIPTIONS[runicId]}`;
    let nextLevelState = 0;
    if (identified) {
        switch (runicId) {
            case WeaponEnchant.Speed: buf += ". "; break;
            case WeaponEnchant.Paralysis: nextLevelState = ctx.weaponParalysisDuration(nextEnchant); buf += ` for ${ctx.weaponParalysisDuration(enchant)} turns. `; break;
            case WeaponEnchant.Slowing: nextLevelState = ctx.weaponSlowDuration(nextEnchant); buf += ` for ${ctx.weaponSlowDuration(enchant)} turns. `; break;
            case WeaponEnchant.Confusion: nextLevelState = ctx.weaponConfusionDuration(nextEnchant); buf += ` for ${ctx.weaponConfusionDuration(enchant)} turns. `; break;
            case WeaponEnchant.Force: nextLevelState = ctx.weaponForceDistance(nextEnchant); buf += ` up to ${ctx.weaponForceDistance(enchant)} spaces backward. If the enemy hits an obstruction, it (and any monster it hits) will take damage in proportion to the distance it flew. `; break;
            case WeaponEnchant.Mercy: buf += " by 50% of its maximum health. "; break;
            default: buf += ". "; break;
        }
        const curChance = ctx.runicWeaponChance(theItem, false, 0n);
        const nxtChance = ctx.runicWeaponChance(theItem, true, nextEnchant);
        if (curChance < nxtChance) {
            buf += `(If the ${theName} is enchanted, the chance will increase to ${nxtChance}%`;
            buf += nextLevelState
                ? (runicId === WeaponEnchant.Force ? ` and the distance will increase to ${nextLevelState}.)` : ` and the duration will increase to ${nextLevelState} turns.)`)
                : ".)";
        }
    } else {
        buf += ". ";
    }
    return buf;
}

function buildArmorRunicDetails(
    theItem: Item, theName: string, enchant: Fixpt, nextEnchant: Fixpt,
    identified: boolean, _g: string, _b: string, _w: string, ctx: ItemDetailsContext,
): string {
    if (!(theItem.flags & ItemFlag.ITEM_RUNIC)) return "";
    let buf = "";
    const runicId = theItem.enchant2 as ArmorEnchant;
    if ((theItem.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) || ctx.playbackOmniscience) {
        buf += `\n\nGlowing runes of ${ctx.armorRunicNames[runicId]} adorn the ${theName}. `;
        switch (runicId) {
            case ArmorEnchant.Multiplicity: {
                const cnt = ctx.armorImageCount(enchant);
                const nxtCnt = ctx.armorImageCount(nextEnchant);
                buf += `When worn, 33% of the time that an enemy's attack connects, ${cnt} allied spectral duplicate${cnt === 1 ? "" : "s"} of your attacker will appear for 3 turns. `;
                if (nxtCnt > cnt) buf += `(If the ${theName} is enchanted, the number of duplicates will increase to ${nxtCnt}.) `;
                break;
            }
            case ArmorEnchant.Mutuality: buf += "When worn, the damage that you incur from physical attacks will be split evenly among yourself and all other adjacent enemies. "; break;
            case ArmorEnchant.Absorption: {
                const abs = ctx.armorAbsorptionMax(enchant);
                const nxtAbs = ctx.armorAbsorptionMax(nextEnchant);
                if (identified) buf += `It will reduce the damage of inbound attacks by a random amount between 1 and ${Math.trunc(abs)}, which is ${Math.trunc(100 * abs / ctx.player.info.maxHP)}% of your current maximum health. (If the ${theName} is enchanted, this maximum amount will ${abs === nxtAbs ? "remain at" : "increase to"} ${Math.trunc(nxtAbs)}.) `;
                else buf += "It will reduce the damage of inbound attacks by a random amount determined by its enchantment level. ";
                break;
            }
            case ArmorEnchant.Reprisal: {
                const rp = ctx.armorReprisalPercent(enchant);
                const nxtRp = ctx.armorReprisalPercent(nextEnchant);
                if (identified) buf += `Any enemy that attacks you will itself be wounded by ${rp}% of the damage that it inflicts. (If the ${theName} is enchanted, this percentage will increase to ${nxtRp}%.) `;
                else buf += "Any enemy that attacks you will itself be wounded by a percentage (determined by enchantment level) of the damage that it inflicts. ";
                break;
            }
            case ArmorEnchant.Immunity: buf += `It offers complete protection from any attacking ${ctx.describeMonsterClass(theItem.vorpalEnemy, false)}. `; break;
            case ArmorEnchant.Reflection: {
                if (identified && theItem.enchant1 !== 0) {
                    const rc = ctx.reflectionChance(enchant);
                    const nrc = ctx.reflectionChance(nextEnchant);
                    if (theItem.enchant1 > 0) buf += `When worn, you will deflect ${rc}% of incoming spells -- including directly back at their source ${Math.trunc(rc * rc / 100)}% of the time. (If the armor is enchanted, these will increase to ${nrc}% and ${Math.trunc(nrc * nrc / 100)}%.) `;
                    else buf += `When worn, ${rc}% of your own spells will deflect from their target -- including directly back at you ${Math.trunc(rc * rc / 100)}% of the time. (If the armor is enchanted, these will decrease to ${nrc}% and ${Math.trunc(nrc * nrc / 100)}%.) `;
                } else {
                    buf += "When worn, you will deflect some percentage of incoming spells, determined by enchantment level. ";
                }
                break;
            }
            case ArmorEnchant.Respiration: buf += "When worn, it will maintain a pocket of fresh air around you, rendering you immune to the effects of steam and all toxic gases. "; break;
            case ArmorEnchant.Dampening: buf += "When worn, it will safely absorb the concussive impact of any explosions (though you may still be burned). "; break;
            case ArmorEnchant.Burden: buf += "10% of the time it absorbs a blow, its strength requirement will permanently increase. "; break;
            case ArmorEnchant.Vulnerability: buf += "While it is worn, inbound attacks will inflict twice as much damage. "; break;
            case ArmorEnchant.Immolation: buf += "10% of the time it absorbs a blow, it will explode in flames. "; break;
            default: break;
        }
    } else if (theItem.flags & ItemFlag.ITEM_IDENTIFIED) {
        buf += `\n\nGlowing runes of an indecipherable language spiral around the ${theName}. `;
    }
    return buf;
}

export function buildStaffDetails(
    theItem: Item, theName: string, enchant: Fixpt, nextEnchant: Fixpt,
    _g: string, _b: string, _w: string, ctx: ItemDetailsContext,
): string {
    let buf = "";
    const knownCharges = !!(theItem.flags & ItemFlag.ITEM_IDENTIFIED) || !!(theItem.flags & ItemFlag.ITEM_MAX_CHARGES_KNOWN) || ctx.playbackOmniscience;
    const fullIdent = !!(theItem.flags & ItemFlag.ITEM_IDENTIFIED) || ctx.playbackOmniscience;
    const wisBonus = ctx.apparentRingBonus(RingKind.Wisdom);
    const rechargeTurns = ctx.staffChargeDuration(theItem) * 10n / ctx.ringWisdomMultiplier(BigInt(wisBonus) * FP_FACTOR);
    if (fullIdent) {
        buf += `\n\nThe ${theName} has ${theItem.charges} charges remaining out of a maximum of ${theItem.enchant1} charges, and${wisBonus === 0 ? "" : ", with your current rings,"} recovers a charge in approximately ${rechargeTurns} turns. `;
    } else if (theItem.flags & ItemFlag.ITEM_MAX_CHARGES_KNOWN) {
        buf += `\n\nThe ${theName} has a maximum of ${theItem.enchant1} charges, and${wisBonus === 0 ? "" : ", with your current rings,"} recovers a charge in approximately ${rechargeTurns} turns. `;
    }
    if (theItem.lastUsed[0] > 0 && theItem.lastUsed[1] > 0 && theItem.lastUsed[2] > 0) {
        buf += `You last used it ${ctx.absoluteTurnNumber - theItem.lastUsed[0]}, ${ctx.absoluteTurnNumber - theItem.lastUsed[1]} and ${ctx.absoluteTurnNumber - theItem.lastUsed[2]} turns ago. `;
    } else if (theItem.lastUsed[0] > 0 && theItem.lastUsed[1] > 0) {
        buf += `You last used it ${ctx.absoluteTurnNumber - theItem.lastUsed[0]} and ${ctx.absoluteTurnNumber - theItem.lastUsed[1]} turns ago. `;
    } else if (theItem.lastUsed[0] > 0) {
        const ago = ctx.absoluteTurnNumber - theItem.lastUsed[0];
        buf += `You last used it ${ago} turn${ago === 1 ? "" : "s"} ago. `;
    }
    if ((knownCharges && ctx.staffTable[theItem.kind].identified) || ctx.playbackOmniscience) {
        buf += buildStaffEffectDescription(theItem, enchant, nextEnchant, ctx);
    }
    return buf;
}

function buildStaffEffectDescription(
    theItem: Item, enchant: Fixpt, nextEnchant: Fixpt, ctx: ItemDetailsContext,
): string {
    let desc = "";
    const e1 = ctx.enchantMagnitude();
    switch (theItem.kind as StaffKind) {
        case StaffKind.Lightning: case StaffKind.Fire: {
            const isLightning = theItem.kind === StaffKind.Lightning;
            const cur = ctx.staffDamageLow(enchant) + ctx.staffDamageHigh(enchant);
            const nxt = ctx.staffDamageLow(nextEnchant) + ctx.staffDamageHigh(nextEnchant);
            const pct = Math.trunc(100 * nxt / cur - 100);
            desc = isLightning
                ? `This staff deals damage to every creature in its line of fire; nothing is immune. (If the staff is enchanted, its average damage will increase by ${pct}%.)`
                : `This staff deals damage to any creature that it hits, unless the creature is immune to fire. (If the staff is enchanted, its average damage will increase by ${pct}%.) It also sets creatures and flammable terrain on fire.`;
            break;
        }
        case StaffKind.Poison: desc = `The bolt from this staff will poison any creature that it hits for ${ctx.staffPoison(enchant)} turns. (If the staff is enchanted, this will increase to ${ctx.staffPoison(nextEnchant)} turns.)`; break;
        case StaffKind.Tunneling: desc = `The bolt from this staff will dissolve ${theItem.enchant1} layers of obstruction. (If the staff is enchanted, this will increase to ${theItem.enchant1 + e1} layers.)`; break;
        case StaffKind.Blinking: desc = `This staff enables you to teleport up to ${ctx.staffBlinkDistance(enchant)} spaces. (If the staff is enchanted, this will increase to ${ctx.staffBlinkDistance(nextEnchant)} spaces.)`; break;
        case StaffKind.Entrancement: desc = `This staff will compel its target to mirror your movements for ${ctx.staffEntrancementDuration(enchant)} turns. (If the staff is enchanted, this will increase to ${ctx.staffEntrancementDuration(nextEnchant)} turns.)`; break;
        case StaffKind.Healing:
            desc = Number(enchant) / Number(FP_FACTOR) < 10
                ? `This staff will heal its target by ${theItem.enchant1 * 10}% of its maximum health. (If the staff is enchanted, this will increase to ${(theItem.enchant1 + e1) * 10}%.)`
                : "This staff will completely heal its target.";
            break;
        case StaffKind.Haste: desc = `This staff will cause its target to move twice as fast for ${ctx.staffHasteDuration(enchant)} turns. (If the staff is enchanted, this will increase to ${ctx.staffHasteDuration(nextEnchant)} turns.)`; break;
        case StaffKind.Obstruction: desc = ""; break;
        case StaffKind.Discord: desc = `This staff will cause discord for ${ctx.staffDiscordDuration(enchant)} turns. (If the staff is enchanted, this will increase to ${ctx.staffDiscordDuration(nextEnchant)} turns.)`; break;
        case StaffKind.Conjuration: desc = `${ctx.staffBladeCount(enchant)} phantom blades will be called into service. (If the staff is enchanted, this will increase to ${ctx.staffBladeCount(nextEnchant)} blades.)`; break;
        case StaffKind.Protection: desc = `This staff will shield a creature for up to 20 turns against up to ${Math.trunc(ctx.staffProtection(enchant) / 10)} damage. (If the staff is enchanted, this will increase to ${Math.trunc(ctx.staffProtection(nextEnchant) / 10)} damage.)`; break;
        default: desc = "No one knows what this staff does."; break;
    }
    return desc ? `\n\n${desc}` : "";
}

export function buildWandDetails(theItem: Item, _enchant: Fixpt, mag: number, ctx: ItemDetailsContext): string {
    const wandTable = ctx.wandTable;
    let buf = "\n\n";
    const identified = !!(theItem.flags & ItemFlag.ITEM_IDENTIFIED) || !!(theItem.flags & ItemFlag.ITEM_MAX_CHARGES_KNOWN) || ctx.playbackOmniscience;
    if (identified) {
        const addCharges = wandTable[theItem.kind].range.lowerBound * mag;
        buf += theItem.charges
            ? `${theItem.charges} charge${theItem.charges === 1 ? "" : "s"} remain${theItem.charges === 1 ? "s" : ""}. Enchanting this wand will add ${addCharges} charge${addCharges === 1 ? "" : "s"}.`
            : `No charges remain.  Enchanting this wand will add ${addCharges} charge${addCharges === 1 ? "" : "s"}.`;
    } else {
        buf += theItem.enchant2
            ? `You have used this wand ${theItem.enchant2} time${theItem.enchant2 === 1 ? "" : "s"}, but do not know how many charges, if any, remain.`
            : "You have not yet used this wand.";
        if (wandTable[theItem.kind].identified) {
            const addCharges = wandTable[theItem.kind].range.lowerBound * mag;
            buf += ` Wands of this type can be found with ${wandTable[theItem.kind].range.lowerBound} to ${wandTable[theItem.kind].range.upperBound} charges. Enchanting this wand will add ${addCharges} charge${addCharges === 1 ? "" : "s"}.`;
        }
    }
    return buf;
}

export function buildRingDetails(
    theItem: Item, theName: string, enchant: Fixpt, nextEnchant: Fixpt,
    identified: boolean, _g: string, b: string, w: string, ctx: ItemDetailsContext,
): string {
    let buf = "";
    if ((identified && ctx.ringTable[theItem.kind].identified) || ctx.playbackOmniscience) {
        if (theItem.enchant1) {
            switch (theItem.kind as RingKind) {
                case RingKind.Clairvoyance:
                    buf += theItem.enchant1 > 0
                        ? `\n\nThis ring provides magical sight with a radius of ${theItem.enchant1 + 1}. (If the ring is enchanted, this will increase to ${theItem.enchant1 + 1 + ctx.enchantMagnitude()}.)`
                        : `\n\nThis ring magically blinds you to a radius of ${-theItem.enchant1 + 1}. (If the ring is enchanted, this will decrease to ${-theItem.enchant1 + 1 - ctx.enchantMagnitude()}.)`;
                    break;
                case RingKind.Regeneration:
                    buf += `\n\nWith this ring equipped, you will regenerate all of your health in ${Math.trunc(ctx.turnsForFullRegenInThousandths(enchant) / 1000)} turns (instead of ${ctx.TURNS_FOR_FULL_REGEN}). (If the ring is enchanted, this will decrease to ${Math.trunc(ctx.turnsForFullRegenInThousandths(nextEnchant) / 1000)} turns.)`;
                    break;
                case RingKind.Transference: {
                    const pct = Math.abs(theItem.enchant1) * 5;
                    const nxtPct = Math.abs(theItem.enchant1 + ctx.enchantMagnitude()) * 5;
                    buf += `\n\nDealing direct damage to a creature (whether in melee or otherwise) will ${theItem.enchant1 >= 0 ? "heal" : "harm"} you by ${pct}% of the damage dealt. (If the ring is enchanted, this will ${theItem.enchant1 >= 0 ? "increase" : "decrease"} to ${nxtPct}%.)`;
                    break;
                }
                case RingKind.Wisdom:
                    buf += `\n\nWhen worn, your staffs will recharge at ${ctx.ringWisdomRate(enchant)}% of their normal rate. (If the ring is enchanted, the rate will increase to ${ctx.ringWisdomRate(nextEnchant)}% of the normal rate.)`;
                    break;
                case RingKind.Reaping: {
                    const abs = Math.abs(theItem.enchant1);
                    const nxtAbs = Math.abs(theItem.enchant1 + ctx.enchantMagnitude());
                    buf += `\n\nEach blow that you land with a weapon will ${theItem.enchant1 >= 0 ? "recharge" : "drain"} your staffs and charms by 0-${abs} turns per point of damage dealt. (If the ring is enchanted, this will ${theItem.enchant1 >= 0 ? "increase" : "decrease"} to 0-${nxtAbs} turns per point of damage.)`;
                    break;
                }
                default: break;
            }
        }
    } else {
        buf += `\n\nIt will reveal its secrets if worn for ${theItem.charges}${theItem.charges === ctx.ringDelayToAutoID ? "" : " more"} turn${theItem.charges === 1 ? "" : "s"}`;
        buf += (!identified && (theItem.charges < ctx.ringDelayToAutoID || !!(theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED)))
            ? `, and until then it will function, at best, as a +${theItem.timesEnchanted + 1} ring.`
            : ".";
    }
    if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
        buf += `\n\nThe ${theName} is on your finger${(theItem.flags & ItemFlag.ITEM_CURSED) ? ", and because it is cursed, you are powerless to remove it" : ""}. `;
    } else if ((identified || !!(theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED)) && (theItem.flags & ItemFlag.ITEM_CURSED)) {
        buf += `\n\n${b}You can feel a malevolent magic lurking within the ${theName}.${w} `;
    }
    return buf;
}

export function buildCharmDetails(
    theItem: Item, enchant: Fixpt, nextEnchant: Fixpt, mag: number, ctx: ItemDetailsContext,
): string {
    const kind = theItem.kind as CharmKind;
    const e1 = theItem.enchant1;
    const dur = ctx.charmEffectDuration(kind, e1);
    const nxtDur = ctx.charmEffectDuration(kind, e1 + mag);
    const del = ctx.charmRechargeDelay(kind, e1);
    const nxtDel = ctx.charmRechargeDelay(kind, e1 + mag);
    switch (kind) {
        case CharmKind.Health: {
            return `\n\nWhen used, the charm will heal ${ctx.charmHealing(enchant)}% of your health and recharge in ${del} turns. (If the charm is enchanted, it will heal ${ctx.charmHealing(nextEnchant)}% of your health and recharge in ${nxtDel} turns.)`;
        }
        case CharmKind.Protection: {
            const prot = Math.trunc(100 * ctx.charmProtection(enchant) / 10 / ctx.player.info.maxHP);
            const nxtProt = Math.trunc(100 * ctx.charmProtection(nextEnchant) / 10 / ctx.player.info.maxHP);
            return `\n\nWhen used, the charm will shield you for up to 20 turns for up to ${prot}% of your total health and recharge in ${del} turns. (If the charm is enchanted, it will shield up to ${nxtProt}% of your total health and recharge in ${nxtDel} turns.)`;
        }
        case CharmKind.Haste: return `\n\nWhen used, the charm will haste you for ${dur} turns and recharge in ${del} turns. (If the charm is enchanted, the haste will last ${nxtDur} turns and it will recharge in ${nxtDel} turns.)`;
        case CharmKind.FireImmunity: return `\n\nWhen used, the charm will grant you immunity to fire for ${dur} turns and recharge in ${del} turns. (If the charm is enchanted, the immunity will last ${nxtDur} turns and it will recharge in ${nxtDel} turns.)`;
        case CharmKind.Invisibility: return `\n\nWhen used, the charm will turn you invisible for ${dur} turns and recharge in ${del} turns. While invisible, monsters more than two spaces away cannot track you. (If the charm is enchanted, the invisibility will last ${nxtDur} turns and it will recharge in ${nxtDel} turns.)`;
        case CharmKind.Telepathy: return `\n\nWhen used, the charm will grant you telepathy for ${dur} turns and recharge in ${del} turns. (If the charm is enchanted, the telepathy will last ${nxtDur} turns and it will recharge in ${nxtDel} turns.)`;
        case CharmKind.Levitation: return `\n\nWhen used, the charm will lift you off the ground for ${dur} turns and recharge in ${del} turns. (If the charm is enchanted, the levitation will last ${nxtDur} turns and it will recharge in ${nxtDel} turns.)`;
        case CharmKind.Shattering: return `\n\nWhen used, the charm will dissolve the nearby walls up to ${ctx.charmShattering(enchant)} spaces away, and recharge in ${del} turns. (If the charm is enchanted, it will reach up to ${ctx.charmShattering(nextEnchant)} spaces and recharge in ${nxtDel} turns.)`;
        case CharmKind.Guardian: return `\n\nWhen used, a guardian will materialize for ${ctx.charmGuardianLifespan(enchant)} turns, and the charm will recharge in ${del} turns. (If the charm is enchanted, the guardian will last for ${ctx.charmGuardianLifespan(nextEnchant)} turns and the charm will recharge in ${nxtDel} turns.)`;
        case CharmKind.Teleportation: return `\n\nWhen used, the charm will teleport you elsewhere in the dungeon and recharge in ${del} turns. (If the charm is enchanted, it will recharge in ${nxtDel} turns.)`;
        case CharmKind.Recharging: return `\n\nWhen used, the charm will recharge your staffs (though not your wands or charms), after which it will recharge in ${del} turns. (If the charm is enchanted, it will recharge in ${nxtDel} turns.)`;
        case CharmKind.Negation: return `\n\nWhen used, the charm will emit a wave of anti-magic up to ${ctx.charmNegationRadius(enchant)} spaces away, negating all magical effects on you and on creatures and dropped items in your field of view. It will recharge in ${del} turns. (If the charm is enchanted, it will reach up to ${ctx.charmNegationRadius(nextEnchant)} spaces and recharge in ${nxtDel} turns.)`;
        default: return "";
    }
}
