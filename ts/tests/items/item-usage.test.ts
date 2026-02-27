/*
 *  item-usage.test.ts — Tests for equipment, enchantment & usage calculations
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    strengthModifier,
    netEnchant,
    effectiveRingEnchant,
    apparentRingBonus,
    enchantIncrement,
    enchantMagnitude,
    armorValueIfUnenchanted,
    displayedArmorValue,
    recalculateEquipmentBonuses,
    updateRingBonuses,
    updateEncumbrance,
    strengthCheck,
    equipItem,
    unequipItem,
    enchantItem,
} from "../../src/items/item-usage.js";
import type { EquipmentState, EquipContext } from "../../src/items/item-usage.js";
import type { Item, Creature } from "../../src/types/types.js";
import { ItemCategory, RingKind, StatusEffect, DisplayGlyph, MonsterType } from "../../src/types/enums.js";
import { ItemFlag } from "../../src/types/flags.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { white, itemColor } from "../../src/globals/colors.js";
import { ringTable } from "../../src/globals/item-catalog.js";

// =============================================================================
// Helpers
// =============================================================================

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = [];
    for (let i = 0; i < KEY_ID_MAXIMUM; i++) {
        keyLoc.push({ loc: { x: 0, y: 0 }, machine: 0, disposableHere: false });
    }
    return {
        category: 0,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 1, upperBound: 4, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 12,
        quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON,
        foreColor: itemColor,
        inventoryColor: white,
        quantity: 1,
        inventoryLetter: "",
        inscription: "",
        loc: { x: 0, y: 0 },
        keyLoc,
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    };
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        info: {
            monsterID: MonsterType.MK_YOU,
            monsterName: "player",
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: white,
            maxHP: 40,
            defense: 0,
            accuracy: 100,
            damage: { lowerBound: 1, upperBound: 2, clumpFactor: 1 },
            turnsBetweenRegen: 30,
            movementSpeed: 100,
            attackSpeed: 100,
            bloodType: 0,
            intrinsicLightType: 0,
            isLarge: false,
            DFChance: 0,
            DFType: 0,
            bolts: [],
            flags: 0,
            abilityFlags: 0,
        },
        loc: { x: 10, y: 10 },
        depth: 1,
        currentHP: 40,
        turnsUntilRegen: 30,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: 0,
        creatureMode: 0,
        mutationIndex: -1,
        wasNegated: false,
        targetWaypointIndex: -1,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: -1, y: -1 },
        targetCorpseLoc: { x: -1, y: -1 },
        targetCorpseName: "",
        absorptionFlags: 0,
        absorbBehavior: false,
        absorptionBolt: 0,
        corpseAbsorptionCounter: 0,
        mapToMe: null,
        safetyMap: null,
        ticksUntilTurn: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        previousHealthPoints: 40,
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { ...white },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        bookkeepingFlags: 0,
        spawnDepth: 1,
        machineHome: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        leader: null,
        carriedMonster: null,
        carriedItem: null,
        ...overrides,
    } as Creature;
}

function makeEquipState(overrides: Partial<EquipmentState> = {}): EquipmentState {
    return {
        player: makeCreature(),
        weapon: null,
        armor: null,
        ringLeft: null,
        ringRight: null,
        strength: 12,
        clairvoyance: 0,
        stealthBonus: 0,
        regenerationBonus: 0,
        lightMultiplier: 1,
        awarenessBonus: 0,
        transference: 0,
        wisdomBonus: 0,
        reaping: 0,
        ...overrides,
    };
}

function makeEquipCtx(state?: EquipmentState): EquipContext {
    const s = state ?? makeEquipState();
    return {
        state: s,
        message: () => {},
        updateRingBonuses: () => updateRingBonuses(s),
        updateEncumbrance: () => updateEncumbrance(s),
        itemName: (item, _details, _article) => "item",
    };
}

// =============================================================================
// strengthModifier
// =============================================================================

describe("strengthModifier", () => {
    it("returns positive modifier when player is stronger", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 10 });
        // strength 14, weakness 0, difference = 4 → 4 * FP_FACTOR / 4 = FP_FACTOR
        const mod = strengthModifier(item, 14, 0);
        expect(mod).toBe(FP_FACTOR);
    });

    it("returns 0 modifier when strength exactly meets requirement", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 14 });
        const mod = strengthModifier(item, 14, 0);
        expect(mod).toBe(0n);
    });

    it("returns negative modifier when player is weaker", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 14 });
        // strength 12, difference = -2 → -2 * FP_FACTOR * 5/2 = -5 * FP_FACTOR
        const mod = strengthModifier(item, 12, 0);
        expect(mod).toBe(-5n * FP_FACTOR);
    });

    it("accounts for weakness", () => {
        const item = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 10 });
        // strength 14, weakness 2, effective = 12, difference = 2
        const mod = strengthModifier(item, 14, 2);
        expect(mod).toBe(2n * FP_FACTOR / 4n);
    });
});

// =============================================================================
// netEnchant
// =============================================================================

describe("netEnchant", () => {
    it("returns enchant1 * FP_FACTOR for non-weapon/armor items", () => {
        const ring = makeItem({ category: ItemCategory.RING, enchant1: 3 });
        expect(netEnchant(ring, 14, 0)).toBe(3n * FP_FACTOR);
    });

    it("adds strength modifier for weapons", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, enchant1: 2, strengthRequired: 10 });
        // strength 14, difference = 4, strMod = FP_FACTOR
        const result = netEnchant(weapon, 14, 0);
        expect(result).toBe(2n * FP_FACTOR + FP_FACTOR); // 3 * FP_FACTOR
    });

    it("clamps to -20 FP_FACTOR minimum", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, enchant1: -5, strengthRequired: 20 });
        // strength 10, difference = -10, strMod = -25 * FP_FACTOR
        // total = -5 - 25 = -30, clamped to -20
        const result = netEnchant(weapon, 10, 0);
        expect(result).toBe(-20n * FP_FACTOR);
    });

    it("clamps to 50 FP_FACTOR maximum", () => {
        const ring = makeItem({ category: ItemCategory.RING, enchant1: 60 });
        expect(netEnchant(ring, 14, 0)).toBe(50n * FP_FACTOR);
    });
});

// =============================================================================
// effectiveRingEnchant
// =============================================================================

describe("effectiveRingEnchant", () => {
    it("returns 0 for non-ring items", () => {
        expect(effectiveRingEnchant(makeItem({ category: ItemCategory.WEAPON }))).toBe(0);
    });

    it("returns enchant1 for identified rings", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 3,
            timesEnchanted: 0,
        });
        expect(effectiveRingEnchant(ring)).toBe(3);
    });

    it("returns min(enchant1, timesEnchanted+1) for unidentified rings", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            enchant1: 5,
            timesEnchanted: 2,
        });
        expect(effectiveRingEnchant(ring)).toBe(3); // min(5, 2+1)
    });

    it("returns enchant1 when it is less than timesEnchanted+1", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            enchant1: 1,
            timesEnchanted: 5,
        });
        expect(effectiveRingEnchant(ring)).toBe(1);
    });
});

// =============================================================================
// apparentRingBonus
// =============================================================================

describe("apparentRingBonus", () => {
    it("returns 0 when no rings are equipped", () => {
        const state = makeEquipState();
        expect(apparentRingBonus(RingKind.Regeneration, state)).toBe(0);
    });

    it("returns sum of effective enchants when kind is identified", () => {
        const savedIdentified = ringTable[RingKind.Regeneration].identified;
        ringTable[RingKind.Regeneration].identified = true;
        try {
            const ring = makeItem({
                category: ItemCategory.RING,
                kind: RingKind.Regeneration,
                flags: ItemFlag.ITEM_IDENTIFIED,
                enchant1: 3,
            });
            const state = makeEquipState({ ringLeft: ring });
            expect(apparentRingBonus(RingKind.Regeneration, state)).toBe(3);
        } finally {
            ringTable[RingKind.Regeneration].identified = savedIdentified;
        }
    });
});

// =============================================================================
// enchantIncrement
// =============================================================================

describe("enchantIncrement", () => {
    it("returns FP_FACTOR for non-weapon/armor items", () => {
        const ring = makeItem({ category: ItemCategory.RING });
        expect(enchantIncrement(ring, 14, 0)).toBe(FP_FACTOR);
    });

    it("returns FP_FACTOR for weapon with 0 strengthRequired", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 0 });
        expect(enchantIncrement(weapon, 14, 0)).toBe(FP_FACTOR);
    });

    it("returns 3.5x factor when player is too weak", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 20 });
        expect(enchantIncrement(weapon, 14, 0)).toBe(FP_FACTOR * 35n / 10n);
    });

    it("returns 1.25x factor when player meets requirement", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 14 });
        expect(enchantIncrement(weapon, 14, 0)).toBe(FP_FACTOR * 125n / 100n);
    });
});

// =============================================================================
// enchantMagnitude
// =============================================================================

describe("enchantMagnitude", () => {
    it("returns the power of the enchanting scroll table entry", () => {
        expect(enchantMagnitude()).toBeGreaterThanOrEqual(1);
    });
});

// =============================================================================
// armorValueIfUnenchanted
// =============================================================================

describe("armorValueIfUnenchanted", () => {
    it("returns a non-negative value", () => {
        const armor = makeItem({ category: ItemCategory.ARMOR, kind: 0, strengthRequired: 12 });
        expect(armorValueIfUnenchanted(armor, 14, 0)).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 for weaklings with heavy armor", () => {
        const armor = makeItem({ category: ItemCategory.ARMOR, kind: 0, strengthRequired: 25 });
        // Massive penalty with low strength
        const val = armorValueIfUnenchanted(armor, 5, 0);
        expect(val).toBe(0);
    });
});

// =============================================================================
// displayedArmorValue
// =============================================================================

describe("displayedArmorValue", () => {
    it("returns player defense / 10 when armor is identified", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            flags: ItemFlag.ITEM_IDENTIFIED,
        });
        const state = makeEquipState({ armor });
        state.player.info.defense = 50;
        expect(displayedArmorValue(state)).toBe(5);
    });

    it("returns player defense / 10 when no armor equipped", () => {
        const state = makeEquipState();
        state.player.info.defense = 30;
        expect(displayedArmorValue(state)).toBe(3);
    });

    it("estimates when armor is unidentified", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            kind: 0,
            strengthRequired: 12,
        });
        const state = makeEquipState({ armor, strength: 14 });
        const val = displayedArmorValue(state);
        expect(val).toBeGreaterThanOrEqual(0);
    });
});

// =============================================================================
// recalculateEquipmentBonuses
// =============================================================================

describe("recalculateEquipmentBonuses", () => {
    it("updates player damage from equipped weapon", () => {
        const weapon = makeItem({
            category: ItemCategory.WEAPON,
            enchant1: 0,
            strengthRequired: 12,
            damage: { lowerBound: 3, upperBound: 10, clumpFactor: 1 },
        });
        const state = makeEquipState({ weapon, strength: 12 });
        recalculateEquipmentBonuses(state);
        expect(state.player.info.damage.lowerBound).toBeGreaterThanOrEqual(1);
        expect(state.player.info.damage.upperBound).toBeGreaterThanOrEqual(1);
    });

    it("updates player defense from equipped armor", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            enchant1: 2,
            armor: 100,
            strengthRequired: 12,
        });
        const state = makeEquipState({ armor, strength: 14 });
        recalculateEquipmentBonuses(state);
        expect(state.player.info.defense).toBeGreaterThan(0);
    });

    it("ensures defense is never negative", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            enchant1: -10,
            armor: 10,
            strengthRequired: 20,
        });
        const state = makeEquipState({ armor, strength: 8 });
        recalculateEquipmentBonuses(state);
        expect(state.player.info.defense).toBeGreaterThanOrEqual(0);
    });
});

// =============================================================================
// updateRingBonuses
// =============================================================================

describe("updateRingBonuses", () => {
    it("resets all bonuses when no rings equipped", () => {
        const state = makeEquipState({
            clairvoyance: 5,
            stealthBonus: 3,
            regenerationBonus: 2,
        });
        updateRingBonuses(state);
        expect(state.clairvoyance).toBe(0);
        expect(state.stealthBonus).toBe(0);
        expect(state.regenerationBonus).toBe(0);
        expect(state.lightMultiplier).toBe(1);
    });

    it("accumulates bonuses from equipped rings", () => {
        const regen = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Regeneration,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 3,
        });
        const state = makeEquipState({ ringLeft: regen });
        updateRingBonuses(state);
        expect(state.regenerationBonus).toBe(3);
    });

    it("stacks bonuses from two rings of the same kind", () => {
        const regen1 = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Regeneration,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 2,
        });
        const regen2 = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Regeneration,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 3,
        });
        const state = makeEquipState({ ringLeft: regen1, ringRight: regen2 });
        updateRingBonuses(state);
        expect(state.regenerationBonus).toBe(5);
    });

    it("quadruples negative stealth bonus", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Stealth,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: -2,
        });
        const state = makeEquipState({ ringLeft: ring });
        updateRingBonuses(state);
        expect(state.stealthBonus).toBe(-8); // -2 * 4
    });

    it("decrements light multiplier when <= 0", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Light,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: -1,
        });
        const state = makeEquipState({ ringLeft: ring });
        updateRingBonuses(state);
        // lightMultiplier starts at 1, -1 from ring = 0, then -- = -1
        expect(state.lightMultiplier).toBe(-1);
    });

    it("sets awareness bonus to 20 * enchant", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Awareness,
            flags: ItemFlag.ITEM_IDENTIFIED,
            enchant1: 3,
        });
        const state = makeEquipState({ ringLeft: ring });
        updateRingBonuses(state);
        expect(state.awarenessBonus).toBe(60);
    });
});

// =============================================================================
// updateEncumbrance
// =============================================================================

describe("updateEncumbrance", () => {
    it("halves speed when hasted", () => {
        const state = makeEquipState();
        state.player.info.movementSpeed = 100;
        state.player.info.attackSpeed = 100;
        state.player.status[StatusEffect.Hasted] = 10;
        updateEncumbrance(state);
        expect(state.player.movementSpeed).toBe(50);
        expect(state.player.attackSpeed).toBe(50);
    });

    it("doubles speed when slowed", () => {
        const state = makeEquipState();
        state.player.info.movementSpeed = 100;
        state.player.info.attackSpeed = 100;
        state.player.status[StatusEffect.Slowed] = 10;
        updateEncumbrance(state);
        expect(state.player.movementSpeed).toBe(200);
        expect(state.player.attackSpeed).toBe(200);
    });

    it("uses base speed when neither hasted nor slowed", () => {
        const state = makeEquipState();
        state.player.info.movementSpeed = 100;
        state.player.info.attackSpeed = 100;
        updateEncumbrance(state);
        expect(state.player.movementSpeed).toBe(100);
        expect(state.player.attackSpeed).toBe(100);
    });
});

// =============================================================================
// equipItem / unequipItem
// =============================================================================

describe("equipItem", () => {
    it("equips a weapon", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON });
        const state = makeEquipState();
        const ctx = makeEquipCtx(state);
        const result = equipItem(weapon, false, null, ctx);
        expect(result).toBe(true);
        expect(state.weapon).toBe(weapon);
        expect(weapon.flags & ItemFlag.ITEM_EQUIPPED).toBeTruthy();
    });

    it("equips armor and sets donning status", () => {
        const armor = makeItem({ category: ItemCategory.ARMOR, armor: 100 });
        const state = makeEquipState();
        const ctx = makeEquipCtx(state);
        equipItem(armor, false, null, ctx);
        expect(state.armor).toBe(armor);
        expect(state.player.status[StatusEffect.Donning]).toBe(10); // armor/10 = 100/10
    });

    it("equips a ring to the left slot first", () => {
        const ring = makeItem({ category: ItemCategory.RING, kind: RingKind.Regeneration });
        const state = makeEquipState();
        const ctx = makeEquipCtx(state);
        equipItem(ring, false, null, ctx);
        expect(state.ringLeft).toBe(ring);
    });

    it("equips a ring to the right slot when left is taken", () => {
        const ring1 = makeItem({ category: ItemCategory.RING, kind: RingKind.Regeneration });
        const ring2 = makeItem({ category: ItemCategory.RING, kind: RingKind.Light });
        const state = makeEquipState({ ringLeft: ring1 });
        ring1.flags |= ItemFlag.ITEM_EQUIPPED;
        const ctx = makeEquipCtx(state);
        equipItem(ring2, false, null, ctx);
        expect(state.ringRight).toBe(ring2);
    });

    it("fails to equip ring when both slots are full and no hint", () => {
        const ring1 = makeItem({ category: ItemCategory.RING, kind: RingKind.Regeneration, flags: ItemFlag.ITEM_EQUIPPED });
        const ring2 = makeItem({ category: ItemCategory.RING, kind: RingKind.Light, flags: ItemFlag.ITEM_EQUIPPED });
        const ring3 = makeItem({ category: ItemCategory.RING, kind: RingKind.Awareness });
        const state = makeEquipState({ ringLeft: ring1, ringRight: ring2 });
        const ctx = makeEquipCtx(state);
        const result = equipItem(ring3, false, null, ctx);
        expect(result).toBe(false);
    });

    it("unequips previous weapon when equipping a new one", () => {
        const weapon1 = makeItem({ category: ItemCategory.WEAPON, flags: ItemFlag.ITEM_EQUIPPED });
        const weapon2 = makeItem({ category: ItemCategory.WEAPON });
        const state = makeEquipState({ weapon: weapon1 });
        const ctx = makeEquipCtx(state);
        const result = equipItem(weapon2, false, null, ctx);
        expect(result).toBe(true);
        expect(state.weapon).toBe(weapon2);
        expect(weapon1.flags & ItemFlag.ITEM_EQUIPPED).toBe(0);
    });

    it("fails if previous weapon is cursed and not forced", () => {
        const weapon1 = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_EQUIPPED | ItemFlag.ITEM_CURSED,
        });
        const weapon2 = makeItem({ category: ItemCategory.WEAPON });
        const state = makeEquipState({ weapon: weapon1 });
        const ctx = makeEquipCtx(state);
        const result = equipItem(weapon2, false, null, ctx);
        expect(result).toBe(false);
        expect(state.weapon).toBe(weapon1);
    });

    it("force equip bypasses cursed check", () => {
        const weapon1 = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_EQUIPPED | ItemFlag.ITEM_CURSED,
        });
        const weapon2 = makeItem({ category: ItemCategory.WEAPON });
        const state = makeEquipState({ weapon: weapon1 });
        const ctx = makeEquipCtx(state);
        const result = equipItem(weapon2, true, null, ctx);
        expect(result).toBe(true);
        expect(state.weapon).toBe(weapon2);
    });

    it("force equip skips donning delay", () => {
        const armor = makeItem({ category: ItemCategory.ARMOR, armor: 100 });
        const state = makeEquipState();
        const ctx = makeEquipCtx(state);
        equipItem(armor, true, null, ctx);
        expect(state.player.status[StatusEffect.Donning]).toBe(0);
    });
});

describe("unequipItem", () => {
    it("unequips a weapon", () => {
        const weapon = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_EQUIPPED,
        });
        const state = makeEquipState({ weapon });
        const ctx = makeEquipCtx(state);
        const result = unequipItem(weapon, false, ctx);
        expect(result).toBe(true);
        expect(state.weapon).toBeNull();
        expect(weapon.flags & ItemFlag.ITEM_EQUIPPED).toBe(0);
    });

    it("unequips armor and resets defense", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            flags: ItemFlag.ITEM_EQUIPPED,
        });
        const state = makeEquipState({ armor });
        state.player.info.defense = 50;
        const ctx = makeEquipCtx(state);
        unequipItem(armor, false, ctx);
        expect(state.armor).toBeNull();
        expect(state.player.info.defense).toBe(0);
    });

    it("fails for cursed items when not forced", () => {
        const weapon = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_EQUIPPED | ItemFlag.ITEM_CURSED,
        });
        const state = makeEquipState({ weapon });
        const ctx = makeEquipCtx(state);
        const result = unequipItem(weapon, false, ctx);
        expect(result).toBe(false);
        expect(state.weapon).toBe(weapon);
    });

    it("force unequips cursed items", () => {
        const weapon = makeItem({
            category: ItemCategory.WEAPON,
            flags: ItemFlag.ITEM_EQUIPPED | ItemFlag.ITEM_CURSED,
        });
        const state = makeEquipState({ weapon });
        const ctx = makeEquipCtx(state);
        const result = unequipItem(weapon, true, ctx);
        expect(result).toBe(true);
        expect(state.weapon).toBeNull();
    });

    it("returns false for null item", () => {
        const ctx = makeEquipCtx();
        expect(unequipItem(null, false, ctx)).toBe(false);
    });

    it("returns false for unequipped item", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON });
        const ctx = makeEquipCtx();
        expect(unequipItem(weapon, false, ctx)).toBe(false);
    });

    it("unequips left ring", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Regeneration,
            flags: ItemFlag.ITEM_EQUIPPED,
        });
        const state = makeEquipState({ ringLeft: ring });
        const ctx = makeEquipCtx(state);
        unequipItem(ring, false, ctx);
        expect(state.ringLeft).toBeNull();
    });

    it("unequips right ring", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            kind: RingKind.Regeneration,
            flags: ItemFlag.ITEM_EQUIPPED,
        });
        const state = makeEquipState({ ringRight: ring });
        const ctx = makeEquipCtx(state);
        unequipItem(ring, false, ctx);
        expect(state.ringRight).toBeNull();
    });
});

// =============================================================================
// enchantItem
// =============================================================================

describe("enchantItem", () => {
    const rng = (lo: number, hi: number) => Math.floor((lo + hi) / 2);

    it("enchants a weapon", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, enchant1: 2, strengthRequired: 15 });
        const mag = enchantMagnitude();
        enchantItem(weapon, rng);
        expect(weapon.enchant1).toBe(2 + mag);
        expect(weapon.strengthRequired).toBe(Math.max(0, 15 - mag));
        expect(weapon.timesEnchanted).toBe(mag);
    });

    it("enchants armor", () => {
        const armor = makeItem({ category: ItemCategory.ARMOR, enchant1: 1, strengthRequired: 14 });
        const mag = enchantMagnitude();
        enchantItem(armor, rng);
        expect(armor.enchant1).toBe(1 + mag);
        expect(armor.strengthRequired).toBe(Math.max(0, 14 - mag));
    });

    it("enchants a ring", () => {
        const ring = makeItem({ category: ItemCategory.RING, enchant1: 2 });
        const mag = enchantMagnitude();
        enchantItem(ring, rng);
        expect(ring.enchant1).toBe(2 + mag);
    });

    it("enchants a staff and recalculates recharge", () => {
        const staff = makeItem({ category: ItemCategory.STAFF, enchant1: 3, charges: 3 });
        const mag = enchantMagnitude();
        enchantItem(staff, rng);
        expect(staff.enchant1).toBe(3 + mag);
        expect(staff.charges).toBe(3 + mag);
        expect(staff.enchant2).toBe(Math.floor(500 / staff.enchant1));
    });

    it("enchants a wand by adding charges", () => {
        const wand = makeItem({ category: ItemCategory.WAND, kind: 0, charges: 3 });
        enchantItem(wand, rng);
        expect(wand.charges).toBeGreaterThan(3);
    });

    it("enchants a charm and recharges it", () => {
        const charm = makeItem({ category: ItemCategory.CHARM, enchant1: 2, charges: 50 });
        enchantItem(charm, rng);
        expect(charm.charges).toBe(0); // Instantly recharges
        expect(charm.enchant1).toBe(2 + enchantMagnitude());
    });

    it("randomizes quiver number for quivered weapons", () => {
        const weapon = makeItem({ category: ItemCategory.WEAPON, enchant1: 1, quiverNumber: 42 });
        enchantItem(weapon, rng);
        expect(weapon.quiverNumber).not.toBe(42);
    });

    it("returns false for non-enchantable categories", () => {
        const food = makeItem({ category: ItemCategory.FOOD });
        expect(enchantItem(food, rng)).toBe(false);
    });
});

// =============================================================================
// strengthCheck
// =============================================================================

describe("strengthCheck", () => {
    it("shows message when player is too weak for weapon", () => {
        const messages: string[] = [];
        const weapon = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 20 });
        const state = makeEquipState({ strength: 12 });
        const ctx: EquipContext = {
            ...makeEquipCtx(state),
            message: (msg) => messages.push(msg),
            itemName: () => "broadsword",
        };
        strengthCheck(weapon, true, ctx);
        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0]).toContain("barely lift");
        expect(messages[0]).toContain("8 more strength");
    });

    it("does not show message when player is strong enough", () => {
        const messages: string[] = [];
        const weapon = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 12 });
        const state = makeEquipState({ strength: 14 });
        const ctx: EquipContext = {
            ...makeEquipCtx(state),
            message: (msg) => messages.push(msg),
        };
        strengthCheck(weapon, true, ctx);
        expect(messages.length).toBe(0);
    });

    it("does not show message when noisy is false", () => {
        const messages: string[] = [];
        const weapon = makeItem({ category: ItemCategory.WEAPON, strengthRequired: 20 });
        const state = makeEquipState({ strength: 12 });
        const ctx: EquipContext = {
            ...makeEquipCtx(state),
            message: (msg) => messages.push(msg),
        };
        strengthCheck(weapon, false, ctx);
        expect(messages.length).toBe(0);
    });
});
