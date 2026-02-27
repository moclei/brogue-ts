/*
 *  combat-damage.ts — Damage infliction, healing, poison, and creature death
 *  brogue-ts
 *
 *  Ported from: src/brogue/Combat.c
 *  Functions: flashMonster, inflictDamage, inflictLethalDamage,
 *             addPoison, killCreature, heal
 *
 *  These functions mutate creature state and trigger side effects
 *  (blood, messages, item drops, etc.) through a DI context.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Color, Pos, CreatureType } from "../types/types.js";
import { StatusEffect, CreatureState } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
} from "../types/flags.js";

// =============================================================================
// Constants
// =============================================================================

/**
 * Minimum flash strength for damage flashes.
 * C: #define MIN_FLASH_STRENGTH  50
 */
const MIN_FLASH_STRENGTH = 50;

// =============================================================================
// Context
// =============================================================================

/**
 * Context for combat damage operations.
 * Provides access to player identity, game state, and side-effect callbacks.
 */
export interface CombatDamageContext {
    /** The player creature (for identity checks). */
    player: Creature;

    /** Whether the game is in easy mode (damage reduction for player). */
    easyMode: boolean;

    /** Player transference value (from rogue state). */
    transference: number;

    /** Player transference ratio constant. */
    playerTransferenceRatio: number;

    // ── Creature visibility ──
    /** Whether a monster can be seen by the player. */
    canSeeMonster(monst: Creature): boolean;
    /** Whether a monster can be directly seen (not telepathic). */
    canDirectlySeeMonster(monst: Creature): boolean;

    // ── Side effects ──
    /** Wake up a sleeping creature. */
    wakeUp(monst: Creature): void;
    /** Spawn a dungeon feature at a position. */
    spawnDungeonFeature(x: number, y: number, featureIndex: number, probability: number, isGas: boolean): void;
    /** Refresh the UI for a dungeon cell. */
    refreshSideBar(): void;
    /** Send a combat message. */
    combatMessage(text: string, color?: Color | null): void;
    /** Display a colored message. */
    messageWithColor(text: string, color: Color): void;
    /** Get a monster's display name. */
    monsterName(monst: Creature, includeArticle: boolean): string;
    /** Trigger game over (player death from cursed ring transference). */
    gameOver(message: string): void;
    /** Signal that creatures should flash this turn. */
    setCreaturesWillFlash(): void;

    // ── killCreature callbacks ──
    /** Delete an item from the game. */
    deleteItem(item: any): void;
    /** Make a monster drop its carried item. */
    makeMonsterDropItem(monst: Creature): void;
    /** Set the global flag for creatures flashing. */
    clearLastTarget(monst: Creature): void;
    /** Clear yendor warden reference if this monster. */
    clearYendorWarden(monst: Creature): void;
    /** Get the cell flags at a position. */
    clearCellMonsterFlag(loc: Pos, isDormant: boolean): void;
    /** Prepend a creature to the monster list. */
    prependCreature(monst: Creature): void;
    /** Apply instant tile effects to a creature. */
    applyInstantTileEffectsToCreature(monst: Creature): void;
    /** Fade in a monster visually. */
    fadeInMonster(monst: Creature): void;
    /** Refresh a dungeon cell. */
    refreshDungeonCell(loc: Pos): void;
    /** Check if anyone wants to absorb the decedent. */
    anyoneWantABite(decedent: Creature): boolean;
    /** Demote a monster from leadership. */
    demoteMonsterFromLeadership(monst: Creature): void;
    /** Check for continued leadership after follower death. */
    checkForContinuedLeadership(leader: Creature): void;
    /** Get the monster text for DF messages. */
    getMonsterDFMessage(monsterID: number): string;
    /** Resolve pronoun escapes in a string. */
    resolvePronounEscapes(text: string, monst: Creature): string;
    /** Generic message function. */
    message(text: string, flags: number): void;
    /** Monster catalog (for checking original ability flags). */
    monsterCatalog: readonly CreatureType[];

    // ── heal callbacks ──
    /** Update encumbrance after weakness is cleared. */
    updateEncumbrance(): void;
    /** Update miner's light after darkness is cleared. */
    updateMinersLightRadius(): void;
    /** Update vision after darkness is cleared. */
    updateVision(): void;

    // ── Color references ──
    /** The bad message color. */
    badMessageColor: Color;
    /** The poison flash color. */
    poisonColor: Color;
}

// =============================================================================
// flashMonster — from Combat.c:1355
// =============================================================================

/**
 * Schedule a monster for a colored flash. If the monster is already
 * scheduled for a weaker flash, upgrades to the new one.
 *
 * C: void flashMonster(creature *monst, const color *theColor, short strength)
 *
 * @param monst The creature to flash.
 * @param color The flash color (null = no flash).
 * @param strength The flash intensity (0-100).
 * @param ctx Combat damage context.
 */
export function flashMonster(
    monst: Creature,
    color: Color | null,
    strength: number,
    ctx: CombatDamageContext,
): void {
    if (!color) {
        return;
    }
    if (
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH) ||
        monst.flashStrength < strength
    ) {
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_WILL_FLASH;
        monst.flashStrength = strength;
        monst.flashColor = { ...color };
        ctx.setCreaturesWillFlash();
    }
}

// =============================================================================
// inflictLethalDamage — from Combat.c:1515
// =============================================================================

/**
 * Inflict exactly enough damage to kill the defender.
 * Convenience wrapper around inflictDamage.
 *
 * C: void inflictLethalDamage(creature *attacker, creature *defender)
 *
 * @param attacker The attacking creature (or null for environmental).
 * @param defender The creature to kill.
 * @param ctx Combat damage context.
 * @returns Always true (the creature dies).
 */
export function inflictLethalDamage(
    attacker: Creature | null,
    defender: Creature,
    ctx: CombatDamageContext,
): boolean {
    return inflictDamage(attacker, defender, defender.currentHP, null, true, ctx);
}

// =============================================================================
// inflictDamage — from Combat.c:1521
// =============================================================================

/**
 * Inflict damage on a creature, handling shields, transference, blood,
 * fleeing behavior, and flash effects.
 *
 * Returns true if this was a killing stroke, but does NOT call killCreature.
 *
 * C: boolean inflictDamage(creature *attacker, creature *defender,
 *                           short damage, const color *flashColor,
 *                           boolean ignoresProtectionShield)
 *
 * @param attacker The attacking creature (or null for environmental damage).
 * @param defender The creature receiving damage.
 * @param damage The amount of damage to inflict.
 * @param flashColor The flash color to use (null for no flash).
 * @param ignoresProtectionShield Whether to bypass protection shields.
 * @param ctx Combat damage context.
 * @returns True if the defender was killed (HP <= 0).
 */
export function inflictDamage(
    attacker: Creature | null,
    defender: Creature,
    damage: number,
    flashColor: Color | null,
    ignoresProtectionShield: boolean,
    ctx: CombatDamageContext,
): boolean {
    // No damage or invulnerable
    if (
        damage === 0 ||
        (defender.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)
    ) {
        return false;
    }

    // Protection shield absorbs damage
    if (!ignoresProtectionShield && defender.status[StatusEffect.Shielded]) {
        if (defender.status[StatusEffect.Shielded] > damage * 10) {
            defender.status[StatusEffect.Shielded] -= damage * 10;
            damage = 0;
        } else {
            damage -= Math.ceil(defender.status[StatusEffect.Shielded] / 10);
            defender.status[StatusEffect.Shielded] = 0;
            defender.maxStatus[StatusEffect.Shielded] = 0;
        }
    }

    // Stop absorbing a corpse if getting hurt
    defender.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_ABSORBING;

    // Bleed (spawn blood dungeon feature), proportional to damage
    if (damage > 0 && defender.info.bloodType) {
        const bleedAmount = Math.min(damage, defender.currentHP);
        const startProb = Math.floor(
            (15 + (bleedAmount * 3) / 2) / 100 // scaled probability
        );
        ctx.spawnDungeonFeature(
            defender.loc.x,
            defender.loc.y,
            defender.info.bloodType,
            startProb,
            false, // isGas flag handled by context
        );
    }

    // Wake sleeping monsters
    if (defender !== ctx.player && defender.creatureState === CreatureState.Sleeping) {
        ctx.wakeUp(defender);
    }

    // Easy mode damage reduction for the player
    if (defender === ctx.player && ctx.easyMode && damage > 0) {
        damage = Math.max(1, Math.floor(damage / 5));
    }

    // Transference (life drain / cursed ring)
    if (
        attacker &&
        (
            (attacker === ctx.player && ctx.transference) ||
            (attacker !== ctx.player && (attacker.info.abilityFlags & MonsterAbilityFlag.MA_TRANSFERENCE))
        ) &&
        !(defender.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
    ) {
        // Maximum transferred damage can't exceed the victim's remaining health
        let transferenceAmount = Math.min(damage, defender.currentHP);

        if (attacker === ctx.player) {
            transferenceAmount = Math.floor(
                (transferenceAmount * ctx.transference) / ctx.playerTransferenceRatio,
            );
            if (transferenceAmount === 0) {
                transferenceAmount = ctx.transference > 0 ? 1 : -1;
            }
        } else if (attacker.creatureState === CreatureState.Ally) {
            transferenceAmount = Math.floor((transferenceAmount * 4) / 10); // allies: 40%
        } else {
            transferenceAmount = Math.floor((transferenceAmount * 9) / 10); // enemies: 90%
        }

        attacker.currentHP += transferenceAmount;

        if (attacker === ctx.player && ctx.player.currentHP <= 0) {
            ctx.gameOver("Drained by a cursed ring");
            return false;
        }
    }

    // Apply the damage
    if (defender.currentHP <= damage) {
        // Killed
        defender.currentHP = 0;
        return true;
    } else {
        // Survived
        if (damage < 0 && defender.currentHP - damage > defender.info.maxHP) {
            defender.currentHP = Math.max(defender.currentHP, defender.info.maxHP);
        } else {
            defender.currentHP -= damage;
        }

        // Flee near death
        if (
            defender !== ctx.player &&
            defender.creatureState !== CreatureState.Ally &&
            (defender.info.flags & MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH) &&
            Math.floor(defender.info.maxHP / 4) >= defender.currentHP
        ) {
            defender.creatureState = CreatureState.Fleeing;
        }

        // Flash the creature
        if (flashColor && damage > 0) {
            flashMonster(
                defender,
                flashColor,
                MIN_FLASH_STRENGTH +
                    Math.floor(
                        ((100 - MIN_FLASH_STRENGTH) * damage) / defender.info.maxHP,
                    ),
                ctx,
            );
        }
    }

    ctx.refreshSideBar();
    return false;
}

// =============================================================================
// addPoison — from Combat.c:1615
// =============================================================================

/**
 * Add poison to a creature. Duration accumulates; concentration determines
 * damage per tick. The maxStatus for poison is set to HP / poisonAmount
 * (the total HP of damage this poison would deal if not cured).
 *
 * C: void addPoison(creature *monst, short durationIncrement, short concentrationIncrement)
 *
 * @param monst The creature to poison.
 * @param durationIncrement Number of turns to add to poison duration.
 * @param concentrationIncrement Poison concentration to add.
 * @param ctx Combat damage context.
 */
export function addPoison(
    monst: Creature,
    durationIncrement: number,
    concentrationIncrement: number,
    ctx: CombatDamageContext,
): void {
    if (durationIncrement > 0) {
        if (monst === ctx.player && !ctx.player.status[StatusEffect.Poisoned]) {
            ctx.combatMessage("scalding poison fills your veins", ctx.badMessageColor);
        }
        if (!monst.status[StatusEffect.Poisoned]) {
            monst.maxStatus[StatusEffect.Poisoned] = 0;
        }
        monst.poisonAmount += concentrationIncrement;
        if (monst.poisonAmount === 0) {
            monst.poisonAmount = 1;
        }
        monst.status[StatusEffect.Poisoned] += durationIncrement;
        monst.maxStatus[StatusEffect.Poisoned] = Math.floor(
            monst.info.maxHP / monst.poisonAmount,
        );

        if (ctx.canSeeMonster(monst)) {
            flashMonster(monst, ctx.poisonColor, 100, ctx);
        }
    }
}

// =============================================================================
// killCreature — from Combat.c:1642
// =============================================================================

/**
 * Mark a creature as dying. Does NOT remove from the monster chain
 * (that's done in removeDeadMonsters to avoid iterator invalidation).
 *
 * If administrativeDeath is true, the monster simply disappears with no
 * messages, dropped items, dungeon features, or other effects.
 *
 * C: void killCreature(creature *decedent, boolean administrativeDeath)
 *
 * @param decedent The creature to kill.
 * @param administrativeDeath If true, silent removal with no side effects.
 * @param ctx Combat damage context.
 */
export function killCreature(
    decedent: Creature,
    administrativeDeath: boolean,
    ctx: CombatDamageContext,
): void {
    // Avoid double-killing
    if (
        decedent.bookkeepingFlags &
        (MonsterBookkeepingFlag.MB_IS_DYING | MonsterBookkeepingFlag.MB_HAS_DIED)
    ) {
        return;
    }

    if (decedent !== ctx.player) {
        decedent.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
    }

    // Clear global references
    ctx.clearLastTarget(decedent);
    ctx.clearYendorWarden(decedent);

    // Handle carried item
    if (decedent.carriedItem) {
        if (administrativeDeath) {
            ctx.deleteItem(decedent.carriedItem);
            decedent.carriedItem = null;
        } else {
            ctx.makeMonsterDropItem(decedent);
        }
    }

    // Spawn dungeon feature on death (non-administrative)
    if (
        !administrativeDeath &&
        (decedent.info.abilityFlags & MonsterAbilityFlag.MA_DF_ON_DEATH) &&
        !(decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING)
    ) {
        ctx.spawnDungeonFeature(
            decedent.loc.x,
            decedent.loc.y,
            decedent.info.DFType,
            100, // full probability
            false,
        );

        const dfMessage = ctx.getMonsterDFMessage(decedent.info.monsterID);
        if (dfMessage && ctx.canSeeMonster(decedent)) {
            const monstName = ctx.monsterName(decedent, true);
            const text = ctx.resolvePronounEscapes(
                `${monstName} ${dfMessage}`,
                decedent,
            );
            ctx.message(text, 0);
        }
    }

    if (decedent === ctx.player) {
        // Player death is handled elsewhere (gameOver)
    } else {
        // "Sense of loss" message for unseen dying allies
        if (
            !administrativeDeath &&
            decedent.creatureState === CreatureState.Ally &&
            !ctx.canSeeMonster(decedent) &&
            (!(decedent.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ||
                (ctx.monsterCatalog[decedent.info.monsterID].abilityFlags &
                    MonsterAbilityFlag.MA_ENTER_SUMMONS)) &&
            !(decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_BOUND_TO_LEADER) &&
            !decedent.carriedMonster
        ) {
            ctx.messageWithColor(
                "you feel a sense of loss.",
                ctx.badMessageColor,
            );
        }

        // Clear map presence flags
        const isDormant = !!(decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT);
        ctx.clearCellMonsterFlag(decedent.loc, isDormant);

        // Mark as dead
        decedent.bookkeepingFlags |= MonsterBookkeepingFlag.MB_HAS_DIED;
        if (administrativeDeath) {
            decedent.bookkeepingFlags |= MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH;
        }

        // Non-administrative, non-dormant death effects
        if (
            !administrativeDeath &&
            !(decedent.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT)
        ) {
            // Release carried monster
            if (decedent.carriedMonster) {
                const carried = decedent.carriedMonster;
                decedent.carriedMonster = null;
                ctx.prependCreature(carried);

                carried.loc = { x: decedent.loc.x, y: decedent.loc.y };
                carried.ticksUntilTurn = 200;
                // HAS_MONSTER flag is set by the context
                ctx.fadeInMonster(carried);

                if (ctx.canSeeMonster(carried)) {
                    const name = ctx.monsterName(carried, true);
                    ctx.combatMessage(`${name} appears`, null);
                }

                ctx.applyInstantTileEffectsToCreature(carried);
            }
            ctx.anyoneWantABite(decedent);
            ctx.refreshDungeonCell(decedent.loc);
        }
    }

    decedent.currentHP = 0;
    ctx.demoteMonsterFromLeadership(decedent);
    if (decedent.leader) {
        ctx.checkForContinuedLeadership(decedent.leader);
    }
}

// =============================================================================
// heal — from Items.c:3933
// =============================================================================

/**
 * Heal a creature by a percentage of its max HP.
 * If panacea is true, also clears negative status effects.
 *
 * C: void heal(creature *monst, short percent, boolean panacea)
 *
 * @param monst The creature to heal.
 * @param percent Percentage of max HP to heal (0-100).
 * @param panacea If true, also cures negative effects.
 * @param ctx Combat damage context.
 */
export function heal(
    monst: Creature,
    percent: number,
    panacea: boolean,
    ctx: CombatDamageContext,
): void {
    monst.currentHP = Math.min(
        monst.info.maxHP,
        monst.currentHP + Math.floor((percent * monst.info.maxHP) / 100),
    );

    if (panacea) {
        if (monst.status[StatusEffect.Hallucinating] > 1) {
            monst.status[StatusEffect.Hallucinating] = 1;
        }
        if (monst.status[StatusEffect.Confused] > 1) {
            monst.status[StatusEffect.Confused] = 1;
        }
        if (monst.status[StatusEffect.Nauseous] > 1) {
            monst.status[StatusEffect.Nauseous] = 1;
        }
        if (monst.status[StatusEffect.Slowed] > 1) {
            monst.status[StatusEffect.Slowed] = 1;
        }
        if (monst.status[StatusEffect.Weakened] > 1) {
            monst.weaknessAmount = 0;
            monst.status[StatusEffect.Weakened] = 0;
            ctx.updateEncumbrance();
        }
        if (monst.status[StatusEffect.Poisoned]) {
            monst.poisonAmount = 0;
            monst.status[StatusEffect.Poisoned] = 0;
        }
        if (monst.status[StatusEffect.Darkness] > 0) {
            monst.status[StatusEffect.Darkness] = 0;
            if (monst === ctx.player) {
                ctx.updateMinersLightRadius();
                ctx.updateVision();
            }
        }
    }

    if (
        ctx.canDirectlySeeMonster(monst) &&
        monst !== ctx.player &&
        !panacea
    ) {
        const monstName = ctx.monsterName(monst, true);
        ctx.combatMessage(`${monstName} looks healthier`, null);
    }
}
