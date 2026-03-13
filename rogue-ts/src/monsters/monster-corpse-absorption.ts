/*
 *  monster-corpse-absorption.ts — updateMonsterCorpseAbsorption
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Function: updateMonsterCorpseAbsorption (Monsters.c:3250)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Creature } from "../types/types.js";

// ============================================================================
// CorpseAbsorptionContext
// ============================================================================

export interface CorpseAbsorptionContext {
    // ── Monster query ──
    canSeeMonster(monst: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    getAbsorbingText(monstID: number): string;

    // ── Catalog lookups ──
    boltAbilityDescription(boltIndex: number): string;
    behaviorDescription(flagIndex: number): string;
    abilityDescription(flagIndex: number): string;

    // ── Text ──
    resolvePronounEscapes(msg: string, monst: Creature): string;

    // ── IO ──
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void | Promise<void>;
    goodMessageColor: Readonly<Color>;
    advancementMessageColor: Readonly<Color>;

    // ── Flags ──
    MB_ABSORBING: number;
    MB_SUBMERGED: number;
    MONST_FIERY: number;
    MONST_FLIES: number;
    MONST_IMMUNE_TO_FIRE: number;
    MONST_INVISIBLE: number;
    MONST_RESTRICTED_TO_LIQUID: number;
    MONST_SUBMERGES: number;
    STATUS_BURNING: number;
    STATUS_LEVITATING: number;
    STATUS_IMMUNE_TO_FIRE: number;
    STATUS_INVISIBLE: number;
    BOLT_NONE: number;

    // ── Helpers ──
    unflag(flag: number): number;
}

// ============================================================================
// updateMonsterCorpseAbsorption — Monsters.c:3250
// ============================================================================

/**
 * Advances corpse-absorption state for a monster eating a corpse to gain abilities.
 * Returns true if the monster spent its turn absorbing (abort normal turn logic).
 *
 * Ported from updateMonsterCorpseAbsorption() in Monsters.c.
 */
export function updateMonsterCorpseAbsorption(
    monst: Creature,
    ctx: CorpseAbsorptionContext,
): boolean {
    const atCorpse =
        monst.loc.x === monst.targetCorpseLoc.x &&
        monst.loc.y === monst.targetCorpseLoc.y;

    if (atCorpse && (monst.bookkeepingFlags & ctx.MB_ABSORBING)) {
        if (--monst.corpseAbsorptionCounter <= 0) {
            // Absorption complete — assign the new ability
            monst.targetCorpseLoc = { x: -1, y: -1 }; // INVALID_POS

            if (monst.absorptionBolt !== ctx.BOLT_NONE) {
                // Find first empty bolt slot and assign
                let i = 0;
                while (monst.info.bolts[i] !== ctx.BOLT_NONE) i++;
                monst.info.bolts[i] = monst.absorptionBolt;
            } else if (monst.absorbBehavior) {
                monst.info.flags |= monst.absorptionFlags;
            } else {
                monst.info.abilityFlags |= monst.absorptionFlags;
            }

            monst.newPowerCount--;
            monst.bookkeepingFlags &= ~ctx.MB_ABSORBING;

            // Apply status effects that correspond to newly gained flags
            if (monst.info.flags & ctx.MONST_FIERY) {
                monst.status[ctx.STATUS_BURNING] = monst.maxStatus[ctx.STATUS_BURNING] = 1000;
            }
            if (monst.info.flags & ctx.MONST_FLIES) {
                monst.status[ctx.STATUS_LEVITATING] = monst.maxStatus[ctx.STATUS_LEVITATING] = 1000;
                monst.info.flags &= ~(ctx.MONST_RESTRICTED_TO_LIQUID | ctx.MONST_SUBMERGES);
                monst.bookkeepingFlags &= ~ctx.MB_SUBMERGED;
            }
            if (monst.info.flags & ctx.MONST_IMMUNE_TO_FIRE) {
                monst.status[ctx.STATUS_IMMUNE_TO_FIRE] = monst.maxStatus[ctx.STATUS_IMMUNE_TO_FIRE] = 1000;
            }
            if (monst.info.flags & ctx.MONST_INVISIBLE) {
                monst.status[ctx.STATUS_INVISIBLE] = monst.maxStatus[ctx.STATUS_INVISIBLE] = 1000;
            }

            // Send messages if the player can see the monster
            if (ctx.canSeeMonster(monst)) {
                const monstName = ctx.monsterName(monst, true);
                const absorbText = ctx.getAbsorbingText(monst.info.monsterID);
                ctx.messageWithColor(
                    `${monstName} finished ${absorbText} the ${monst.targetCorpseName}.`,
                    ctx.goodMessageColor,
                    0,
                );
                let abilityMsg: string;
                if (monst.absorptionBolt !== ctx.BOLT_NONE) {
                    abilityMsg = `${monstName} ${ctx.boltAbilityDescription(monst.absorptionBolt)}!`;
                } else if (monst.absorbBehavior) {
                    abilityMsg = `${monstName} now ${ctx.behaviorDescription(ctx.unflag(monst.absorptionFlags))}!`;
                } else {
                    abilityMsg = `${monstName} now ${ctx.abilityDescription(ctx.unflag(monst.absorptionFlags))}!`;
                }
                ctx.messageWithColor(
                    ctx.resolvePronounEscapes(abilityMsg, monst),
                    ctx.advancementMessageColor,
                    0,
                );
            }

            monst.absorptionFlags = 0;
            monst.absorptionBolt = ctx.BOLT_NONE;
        }
        monst.ticksUntilTurn = 100;
        return true;
    } else if (--monst.corpseAbsorptionCounter <= 0) {
        // Counter expired away from the corpse — lose the chance
        monst.targetCorpseLoc = { x: -1, y: -1 }; // INVALID_POS
        monst.bookkeepingFlags &= ~ctx.MB_ABSORBING;
        monst.absorptionFlags = 0;
        monst.absorptionBolt = ctx.BOLT_NONE;
    } else if (monst.bookkeepingFlags & ctx.MB_ABSORBING) {
        // Absorbing but not currently on the corpse — pause absorbing
        monst.bookkeepingFlags &= ~ctx.MB_ABSORBING;
        if (monst.corpseAbsorptionCounter <= 15) {
            // Too few turns remaining to reach the corpse — abandon
            monst.targetCorpseLoc = { x: -1, y: -1 }; // INVALID_POS
            monst.absorptionFlags = 0;
            monst.absorptionBolt = ctx.BOLT_NONE;
        }
    }
    return false;
}
