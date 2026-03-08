/*
 *  monster-details.test.ts — Tests for monsterDetails and helpers
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    buildProperCommaString,
    monsterIsNegatable,
    getMonsterAbilitiesText,
    getMonsterDominationText,
} from "../../src/monsters/monster-details-helpers.js";
import { monsterDetails } from "../../src/monsters/monster-details.js";
import type { MonsterDetailsContext } from "../../src/monsters/monster-details.js";
import type { Creature, Bolt } from "../../src/types/types.js";
import { MonsterBehaviorFlag, MonsterAbilityFlag, MonsterBookkeepingFlag } from "../../src/types/flags.js";
import { StatusEffect, CreatureState } from "../../src/types/enums.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";
import { white } from "../../src/globals/colors.js";

// =============================================================================
// buildProperCommaString
// =============================================================================

describe("buildProperCommaString", () => {
    it("returns empty string for empty input", () => {
        expect(buildProperCommaString("")).toBe("");
        expect(buildProperCommaString("&")).toBe("");
    });

    it("returns single item unchanged", () => {
        expect(buildProperCommaString("foo")).toBe("foo");
        expect(buildProperCommaString("&foo")).toBe("foo");
    });

    it("joins two items with 'and'", () => {
        expect(buildProperCommaString("foo&bar")).toBe("foo and bar");
    });

    it("joins three items with comma and 'and'", () => {
        expect(buildProperCommaString("foo&bar&baz")).toBe("foo, bar and baz");
    });

    it("ignores leading '&'", () => {
        expect(buildProperCommaString("&a&b&c")).toBe("a, b and c");
    });
});

// =============================================================================
// monsterIsNegatable
// =============================================================================

function makeMinimalMonster(overrides: Partial<Creature["info"]> = {}): Creature {
    return {
        info: {
            monsterID: 1,
            flags: 0,
            abilityFlags: 0,
            movementSpeed: 100,
            attackSpeed: 100,
            maxHP: 10,
            damage: { lowerBound: 1, upperBound: 2, clumpFactor: 1 },
            defense: 10,
            accuracy: 80,
            turnsBetweenRegen: 5000, // ≥5000 → no regen ability text
            bolts: new Array(20).fill(0),
            displayChar: "r",
            foreColor: white,
            ...overrides,
        },
        currentHP: 10,
        movementSpeed: 100,
        attackSpeed: 100,
        mutationIndex: -1,
        status: new Array(50).fill(0),
        bookkeepingFlags: 0,
        creatureState: CreatureState.TrackingScent,
        loc: { x: 5, y: 5 },
    } as unknown as Creature;
}

describe("monsterIsNegatable", () => {
    const emptyBolts: Bolt[] = [];
    const emptyMutations: { canBeNegated: boolean }[] = [];

    it("returns false for invulnerable monster", () => {
        const monst = makeMinimalMonster({ flags: MonsterBehaviorFlag.MONST_INVULNERABLE });
        expect(monsterIsNegatable(monst, emptyBolts, emptyMutations)).toBe(false);
    });

    it("returns true for invisible monster (NEGATABLE_TRAITS)", () => {
        const monst = makeMinimalMonster({ flags: MonsterBehaviorFlag.MONST_INVISIBLE });
        expect(monsterIsNegatable(monst, emptyBolts, emptyMutations)).toBe(true);
    });

    it("returns true for monster with MONST_DIES_IF_NEGATED", () => {
        const monst = makeMinimalMonster({ flags: MonsterBehaviorFlag.MONST_DIES_IF_NEGATED });
        expect(monsterIsNegatable(monst, emptyBolts, emptyMutations)).toBe(true);
    });

    it("returns true when monster has haste status", () => {
        const monst = makeMinimalMonster();
        monst.status[StatusEffect.Hasted] = 5;
        expect(monsterIsNegatable(monst, emptyBolts, emptyMutations)).toBe(true);
    });

    it("returns false for plain monster with no negatables", () => {
        const monst = makeMinimalMonster();
        expect(monsterIsNegatable(monst, emptyBolts, emptyMutations)).toBe(false);
    });

    it("returns true when movement speed has changed (hasted/slowed)", () => {
        const monst = makeMinimalMonster();
        monst.movementSpeed = 50; // faster than base 100
        expect(monsterIsNegatable(monst, emptyBolts, emptyMutations)).toBe(true);
    });
});

// =============================================================================
// getMonsterAbilitiesText
// =============================================================================

describe("getMonsterAbilitiesText", () => {
    it("returns empty string for monster with no abilities", () => {
        const monst = makeMinimalMonster();
        const result = getMonsterAbilitiesText(monst, true, true, []);
        expect(result).toBe("");
    });

    it("includes 'attacks quickly' when attack speed has changed (negatable)", () => {
        const monst = makeMinimalMonster();
        monst.attackSpeed = 50; // changed from info.attackSpeed (100) → negatable
        const result = getMonsterAbilitiesText(monst, true, false, []);
        expect(result).toContain("attacks quickly");
    });

    it("includes 'attacks quickly' for inherently fast monster (non-negatable)", () => {
        // Base attackSpeed is 50 — never changed, so it's a permanent trait
        const monst = makeMinimalMonster({ attackSpeed: 50 });
        monst.attackSpeed = 50;
        const result = getMonsterAbilitiesText(monst, false, true, []);
        expect(result).toContain("attacks quickly");
    });

    it("includes 'does not regenerate' for turnsBetweenRegen === 0", () => {
        const monst = makeMinimalMonster({ turnsBetweenRegen: 0 });
        const result = getMonsterAbilitiesText(monst, false, true, []);
        expect(result).toContain("does not regenerate");
    });
});

// =============================================================================
// getMonsterDominationText
// =============================================================================

describe("getMonsterDominationText", () => {
    const nameFn = (_: Creature, _article: boolean) => "the goblin";

    it("returns empty string for allied monster", () => {
        const monst = makeMinimalMonster();
        monst.creatureState = CreatureState.Ally;
        expect(getMonsterDominationText(monst, nameFn)).toBe("");
    });

    it("returns inanimate message for inanimate monster", () => {
        const monst = makeMinimalMonster({ flags: MonsterBehaviorFlag.MONST_INANIMATE });
        const result = getMonsterDominationText(monst, nameFn);
        expect(result).toContain("no effect on objects");
    });

    it("returns success chance when monster is at low health", () => {
        const monst = makeMinimalMonster();
        monst.currentHP = 1; // very low vs maxHP 10 → 100% domination
        const result = getMonsterDominationText(monst, nameFn);
        expect(result).toContain("always succeed");
    });
});

// =============================================================================
// monsterDetails — wiring stub (SidebarContext not yet built)
// =============================================================================

it("monsterDetails wiring: SidebarContext.monsterDetails returns a string (Phase 6)", async () => {
    // monsterDetails is now wired in io-wiring.ts buildRefreshSideBarFn.
    // Build a minimal MonsterDetailsContext and verify monsterDetails returns a string.
    const ctx: MonsterDetailsContext = {
        player: makeMinimalMonster(),
        rogue: { weapon: null, armor: null, strength: 12 },
        packItems: [],
        boltCatalog: [],
        staffTable: [],
        wandTable: [],
        monsterText: [],
        mutationCatalog: [],
        tileCatalog: [],
        monsterName: (m) => m.info.monsterName ?? "creature",
        monsterIsInClass: () => false,
        resolvePronounEscapes: (text) => text,
        hitProbability: () => 50,
        monsterDamageAdjustment: () => BigInt(100) as import("../../src/types/types.js").Fixpt,
        itemName: () => "item",
        encodeMessageColor: () => "",
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        layerWithFlag: () => 0,
    };
    const monst = makeMinimalMonster();
    const result = monsterDetails(monst, ctx);
    expect(typeof result).toBe("string");
});
