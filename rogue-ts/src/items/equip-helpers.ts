/*
 *  equip-helpers.ts — Shared EquipmentState helpers for context builders
 *  rogue-ts
 *
 *  buildEquipState() reads the current game state from core.ts and returns
 *  an EquipmentState snapshot.  syncEquipBonuses() writes ring-derived bonus
 *  fields from a mutated state back to rogue.  syncEquipState() writes all
 *  equipment references (weapon/armor/rings) and ring bonuses.
 *
 *  Used by lifecycle.ts, combat.ts, items.ts, and turn.ts — anywhere an
 *  updateEncumbrance / updateRingBonuses / equipItem callback must be wired.
 */

import { getGameState } from "../core.js";
import type { EquipmentState } from "./item-usage.js";

// =============================================================================
// buildEquipState — snapshot of rogue equipment fields
// =============================================================================

/**
 * Build an EquipmentState from the current game state.
 * The `player` field is a live reference; mutations to player.movementSpeed
 * etc. are visible to the rest of the system immediately.
 */
export function buildEquipState(): EquipmentState {
    const { rogue, player } = getGameState();
    return {
        player,
        weapon:   rogue.weapon,
        armor:    rogue.armor,
        ringLeft: rogue.ringLeft,
        ringRight: rogue.ringRight,
        strength: rogue.strength,
        clairvoyance:      rogue.clairvoyance,
        stealthBonus:      rogue.stealthBonus,
        regenerationBonus: rogue.regenerationBonus,
        lightMultiplier:   rogue.lightMultiplier,
        awarenessBonus:    0,
        transference:      rogue.transference,
        wisdomBonus:       rogue.wisdomBonus,
        reaping:           rogue.reaping,
    };
}

// =============================================================================
// syncEquipBonuses — write ring bonuses back to rogue
// =============================================================================

/**
 * Copy ring-bonus fields from a mutated EquipmentState back to rogue.
 * Must be called after updateRingBonuses() or equipItem() when
 * the state object is not rogue itself.
 */
export function syncEquipBonuses(state: EquipmentState): void {
    const { rogue } = getGameState();
    rogue.clairvoyance      = state.clairvoyance;
    rogue.stealthBonus      = state.stealthBonus;
    rogue.regenerationBonus = state.regenerationBonus;
    rogue.lightMultiplier   = state.lightMultiplier;
    rogue.transference      = state.transference;
    rogue.wisdomBonus       = state.wisdomBonus;
    rogue.reaping           = state.reaping;
}

// =============================================================================
// syncEquipState — write all equipment refs + ring bonuses back to rogue
// =============================================================================

/**
 * Copy weapon/armor/ring references AND ring-bonus fields from a mutated
 * EquipmentState back to rogue.
 *
 * Use this (instead of syncEquipBonuses alone) whenever an equip or unequip
 * operation may have changed which items are equipped — otherwise rogue.weapon,
 * rogue.armor, rogue.ringLeft, and rogue.ringRight will be stale.
 */
export function syncEquipState(state: EquipmentState): void {
    const { rogue } = getGameState();
    rogue.weapon    = state.weapon;
    rogue.armor     = state.armor;
    rogue.ringLeft  = state.ringLeft;
    rogue.ringRight = state.ringRight;
    syncEquipBonuses(state);
}
