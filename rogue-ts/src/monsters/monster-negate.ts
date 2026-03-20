/*
 *  monsters/monster-negate.ts — negateCreature
 *  Port V2 — rogue-ts
 *
 *  Ported from Items.c:3734 — negate().
 *  Strips a creature of all magical traits, abilities, and status effects.
 *  Called by negationBlast() and by the negation bolt effect.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Bolt, Mutation, StatusEffectInfo, Color } from "../types/types.js";
import {
    BoltFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    NEGATABLE_TRAITS,
    MA_NON_NEGATABLE_ABILITIES,
} from "../types/flags.js";
import { BoltType, StatusEffect } from "../types/enums.js";
import {
    canNegateCreatureStatusEffects,
    negateCreatureStatusEffects,
} from "./monster-actions.js";

// =============================================================================
// Context
// =============================================================================

export interface NegateContext {
    player: Creature;
    boltCatalog: readonly Bolt[];
    mutationCatalog: readonly Mutation[];
    statusEffectCatalog: readonly StatusEffectInfo[];

    monsterName(monst: Creature, includeArticle: boolean): string;
    killCreature(monst: Creature): void;
    combatMessage(msg: string, color: Readonly<Color> | null): void;
    messageColorFromVictim(monst: Creature): Readonly<Color>;
    extinguishFireOnCreature(monst: Creature): void;
    refreshDungeonCell(loc: Pos): void;
    refreshSideBar(): void;
    applyInstantTileEffectsToCreature(monst: Creature): void;
    resolvePronounEscapes(text: string, monst: Creature): string;
}

// =============================================================================
// negateCreature — Items.c:3734
// =============================================================================

/**
 * Strips the creature of all magical traits, abilities, and status effects.
 * Returns true if any change occurred (for wand-of-negation identification).
 *
 * Ported from Items.c:3734 — negate().
 */
export function negateCreature(monst: Creature, ctx: NegateContext): boolean {
    let negated = false;
    const monstName = ctx.monsterName(monst, true);

    // 1. Strip negatable ability flags (keep MA_NON_NEGATABLE_ABILITIES)
    if (monst.info.abilityFlags & ~MA_NON_NEGATABLE_ABILITIES) {
        monst.info.abilityFlags &= MA_NON_NEGATABLE_ABILITIES;
        negated = true;
        monst.wasNegated = true;
    }

    // 2. Release from seizing
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SEIZING;
        negated = true;
    }

    // 3. Kill creatures animated purely by magic
    if (monst.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED) {
        let deathMsg: string;
        if (monst.status[StatusEffect.Levitating]) {
            deathMsg = `${monstName} dissipates into thin air`;
        } else if (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) {
            deathMsg = `${monstName} shatters into tiny pieces`;
        } else {
            deathMsg = `${monstName} falls to the ground, lifeless`;
        }
        ctx.killCreature(monst);
        ctx.combatMessage(deathMsg, ctx.messageColorFromVictim(monst));
        negated = true;
    } else if (!(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        // 4. Negate status effects
        if (canNegateCreatureStatusEffects(monst, ctx.statusEffectCatalog)) {
            negateCreatureStatusEffects(monst, ctx.player, ctx.statusEffectCatalog);
            negated = true;
        }

        // 5. Strip fire immunity
        if (monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE) {
            monst.info.flags &= ~MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE;
            monst.wasNegated = true;
            negated = true;
        }

        // 6. Reset movement/attack speed to base values
        if (monst.movementSpeed !== monst.info.movementSpeed) {
            monst.movementSpeed = monst.info.movementSpeed;
            negated = true;
        }
        if (monst.attackSpeed !== monst.info.attackSpeed) {
            monst.attackSpeed = monst.info.attackSpeed;
            negated = true;
        }

        // 7. Strip negatable mutation
        if (
            monst !== ctx.player &&
            monst.mutationIndex > -1 &&
            ctx.mutationCatalog[monst.mutationIndex]?.canBeNegated
        ) {
            monst.mutationIndex = -1;
            negated = true;
            monst.wasNegated = true;
        }

        // 8. Strip NEGATABLE_TRAITS (fiery, etc.)
        if (monst !== ctx.player && (monst.info.flags & NEGATABLE_TRAITS)) {
            if (
                (monst.info.flags & MonsterBehaviorFlag.MONST_FIERY) &&
                monst.status[StatusEffect.Burning]
            ) {
                ctx.extinguishFireOnCreature(monst);
            }
            monst.info.flags &= ~NEGATABLE_TRAITS;
            negated = true;
            monst.wasNegated = true;
            ctx.refreshDungeonCell(monst.loc);
            ctx.refreshSideBar();
        }

        // 9. Strip negatable bolts; compact array to keep BF_NOT_NEGATABLE bolts
        const backup = [...monst.info.bolts];
        for (let i = 0; i < monst.info.bolts.length; i++) {
            const b = monst.info.bolts[i];
            if (b && !(ctx.boltCatalog[b]?.flags & BoltFlag.BF_NOT_NEGATABLE)) {
                monst.info.bolts[i] = BoltType.NONE;
                negated = true;
                monst.wasNegated = true;
            }
        }
        // Compact: keep only the non-negatable bolts, in original order
        monst.info.bolts = backup.filter(
            b => b !== BoltType.NONE && !!(ctx.boltCatalog[b]?.flags & BoltFlag.BF_NOT_NEGATABLE),
        );

        // 10. Allow allies to re-learn lost ability slots
        monst.newPowerCount = monst.totalPowerCount;

        // 11. Apply instant tile effects (creature may fall/die from terrain)
        ctx.applyInstantTileEffectsToCreature(monst);
    }

    // 12. Combat message for non-player monsters that survived negation
    if (
        negated &&
        monst !== ctx.player &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_DIES_IF_NEGATED)
    ) {
        const msg = ctx.resolvePronounEscapes(
            `${monstName} is stripped of $HISHER special traits`,
            monst,
        );
        ctx.combatMessage(msg, ctx.messageColorFromVictim(monst));
    }

    return negated;
}
