/*
 *  monster-details-helpers.ts — Helpers for monster sidebar description
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: buildProperCommaString, monsterIsNegatable,
 *             getMonsterAbilitiesText, getMonsterDominationText
 */

import type { Creature, Bolt, Mutation } from "../types/types.js";
import { BoltFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import { NEGATABLE_TRAITS, MA_NON_NEGATABLE_ABILITIES } from "../types/flags.js";
import { StatusEffect, CreatureState } from "../types/enums.js";
import { wandDominate } from "../power/power-tables.js";
import { monsterBehaviorCatalog, monsterAbilityCatalog } from "../globals/status-effects.js";
import { monsterBookkeepingFlagDescriptions } from "../globals/string-tables.js";

// =============================================================================
// buildProperCommaString — Monsters.c:4245
// =============================================================================

/**
 * Takes a '&'-delimited string and returns a properly comma-separated string.
 * e.g. "foo&bar&baz" → "foo, bar and baz"
 *
 * Ported from buildProperCommaString() in Monsters.c.
 */
export function buildProperCommaString(newText: string): string {
    if (!newText) return "";
    const start = newText.startsWith("&") ? 1 : 0;
    const trimmed = newText.slice(start);
    if (!trimmed) return "";
    const parts = trimmed.split("&");
    if (parts.length === 1) return parts[0];
    const last = parts.pop()!;
    return parts.join(", ") + " and " + last;
}

// =============================================================================
// monsterIsNegatable — Monsters.c:2502
// =============================================================================

/**
 * Returns true if negation will have any effect on this monster.
 *
 * Ported from monsterIsNegatable() in Monsters.c.
 */
export function monsterIsNegatable(
    monst: Creature,
    boltCatalog: readonly Bolt[],
    mutationCatalog: readonly Pick<Mutation, "canBeNegated">[],
): boolean {
    if (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) return false;

    if (
        (monst.info.abilityFlags & ~MA_NON_NEGATABLE_ABILITIES) ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED) ||
        (monst.info.flags & NEGATABLE_TRAITS) ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE) ||
        ((monst.info.flags & MonsterBehaviorFlag.MONST_FIERY) && monst.status[StatusEffect.Burning])
    ) {
        return true;
    }

    if (
        monst.status[StatusEffect.Hasted] ||
        monst.status[StatusEffect.Telepathic] ||
        monst.status[StatusEffect.Shielded] ||
        monst.status[StatusEffect.Levitating] ||
        monst.status[StatusEffect.ImmuneToFire] ||
        monst.status[StatusEffect.Discordant] ||
        monst.status[StatusEffect.Slowed] ||
        monst.status[StatusEffect.MagicalFear] ||
        monst.status[StatusEffect.Stuck] ||
        monst.movementSpeed !== monst.info.movementSpeed ||
        monst.attackSpeed !== monst.info.attackSpeed
    ) {
        return true;
    }

    if (monst.mutationIndex > -1 && mutationCatalog[monst.mutationIndex]?.canBeNegated) {
        return true;
    }

    for (let i = 0; i < 20; i++) {
        const boltIdx = monst.info.bolts[i];
        if (!boltIdx) break;
        if (boltCatalog[boltIdx] && !(boltCatalog[boltIdx].flags & BoltFlag.BF_NOT_NEGATABLE)) {
            return true;
        }
    }

    return false;
}

// =============================================================================
// getMonsterAbilitiesText — Monsters.c:4288
// =============================================================================

/**
 * Builds a comma-separated string describing the monster's abilities.
 *
 * Ported from getMonsterAbilitiesText() in Monsters.c.
 */
export function getMonsterAbilitiesText(
    monst: Creature,
    includeNegatable: boolean,
    includeNonNegatable: boolean,
    boltCatalog: readonly Bolt[],
): string {
    let buf = "";

    if (includeNegatable && monst.mutationIndex >= 0) buf += "has a rare mutation";

    const attackChanged = monst.attackSpeed !== monst.info.attackSpeed;
    if ((includeNegatable && attackChanged) || (includeNonNegatable && !attackChanged)) {
        if (monst.attackSpeed < 100) buf += "&attacks quickly";
        else if (monst.attackSpeed > 100) buf += "&attacks slowly";
    }

    const moveChanged = monst.movementSpeed !== monst.info.movementSpeed;
    if ((includeNegatable && moveChanged) || (includeNonNegatable && !moveChanged)) {
        if (monst.movementSpeed < 100) buf += "&moves quickly";
        else if (monst.movementSpeed > 100) buf += "&moves slowly";
    }

    if (includeNonNegatable) {
        if (monst.info.turnsBetweenRegen === 0) buf += "&does not regenerate";
        else if (monst.info.turnsBetweenRegen < 5000) buf += "&regenerates quickly";
    }

    for (let i = 0; i < monst.info.bolts.length; i++) {
        const boltIdx = monst.info.bolts[i];
        if (!boltIdx) break;
        const bolt = boltCatalog[boltIdx];
        if (bolt?.abilityDescription) {
            const notNeg = !!(bolt.flags & BoltFlag.BF_NOT_NEGATABLE);
            if ((includeNegatable && !notNeg) || (includeNonNegatable && notNeg)) {
                buf += "&" + bolt.abilityDescription;
            }
        }
    }

    for (let i = 0; i < 32; i++) {
        if ((monst.info.abilityFlags & (1 << i)) && monsterAbilityCatalog[i]?.description) {
            const neg = monsterAbilityCatalog[i].isNegatable;
            if ((includeNegatable && neg) || (includeNonNegatable && !neg)) {
                buf += "&" + monsterAbilityCatalog[i].description;
            }
        }
    }

    for (let i = 0; i < 32; i++) {
        if ((monst.info.flags & (1 << i)) && monsterBehaviorCatalog[i]?.description) {
            const neg = monsterBehaviorCatalog[i].isNegatable;
            if ((includeNegatable && neg) || (includeNonNegatable && !neg)) {
                buf += "&" + monsterBehaviorCatalog[i].description;
            }
        }
    }

    for (let i = 0; i < 32; i++) {
        if ((monst.bookkeepingFlags & (1 << i)) && monsterBookkeepingFlagDescriptions[i]) {
            const seizing = !!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING);
            if ((includeNegatable && seizing) || (includeNonNegatable && !seizing)) {
                buf += "&" + monsterBookkeepingFlagDescriptions[i];
            }
        }
    }

    return buildProperCommaString(buf);
}

// =============================================================================
// getMonsterDominationText — Monsters.c:4207
// =============================================================================

/**
 * Returns a description of how a wand of domination affects the given monster.
 * Returns empty string if not applicable.
 *
 * Ported from getMonsterDominationText() in Monsters.c.
 */
export function getMonsterDominationText(
    monst: Creature,
    monsterNameFn: (m: Creature, article: boolean) => string,
): string {
    if (
        monst.creatureState === CreatureState.Ally ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
    ) {
        return "";
    }

    const monstName = monsterNameFn(monst, true);
    const possessive = monstName.endsWith("s") ? monstName + "'" : monstName + "'s";

    let successChance = 0;
    if (!(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))) {
        successChance = wandDominate(monst.currentHP, monst.info.maxHP);
    }

    if (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) {
        return `\n     A wand of domination will have no effect on objects like ${monstName}.`;
    } else if (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) {
        return `\n     A wand of domination will not affect ${monstName}.`;
    } else if (successChance <= 0) {
        return `\n     A wand of domination will fail at ${possessive} current health level.`;
    } else if (successChance >= 100) {
        return `\n     A wand of domination will always succeed at ${possessive} current health level.`;
    }
    return `\n     A wand of domination will have a ${successChance}% chance of success at ${possessive} current health level.`;
}
