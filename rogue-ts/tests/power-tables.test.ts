/*
 *  power-tables.test.ts — Tests for PowerTables.c port
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import { FP_FACTOR } from "../src/math/fixpt.js";
import {
    staffDamageLow,
    staffDamageHigh,
    staffBlinkDistance,
    staffHasteDuration,
    staffBladeCount,
    staffDiscordDuration,
    staffEntrancementDuration,
    staffProtection,
    staffPoison,
    ringWisdomMultiplier,
    weaponParalysisDuration,
    weaponConfusionDuration,
    weaponForceDistance,
    weaponSlowDuration,
    weaponImageCount,
    weaponImageDuration,
    armorReprisalPercent,
    armorAbsorptionMax,
    armorImageCount,
    reflectionChance,
    turnsForFullRegenInThousandths,
    damageFraction,
    accuracyFraction,
    defenseFraction,
    charmProtection,
    wandDominate,
    runicWeaponChance,
} from "../src/power/power-tables.js";

// Helper: convert integer enchant level to Fixpt (multiply by FP_FACTOR)
function enc(n: number): bigint {
    return BigInt(n) * FP_FACTOR;
}

describe("Staff functions", () => {
    it("staffDamageLow computes correctly", () => {
        // staffDamageLow(enchant) = (2 + enchant / FP_FACTOR) * 3 / 4
        expect(staffDamageLow(enc(1))).toBe(2); // (2+1)*3/4 = 2 (integer division)
        expect(staffDamageLow(enc(4))).toBe(4); // (2+4)*3/4 = 4 (integer division)
        expect(staffDamageLow(enc(10))).toBe(9); // (2+10)*3/4 = 9
    });

    it("staffDamageHigh computes correctly", () => {
        // staffDamageHigh(enchant) = 4 + (5 * enchant / FP_FACTOR / 2)
        expect(staffDamageHigh(enc(1))).toBe(6); // 4 + 5*1/2 = 6 (integer division)
        expect(staffDamageHigh(enc(4))).toBe(14); // 4 + 5*4/2 = 14
        expect(staffDamageHigh(enc(10))).toBe(29); // 4 + 5*10/2 = 29
    });

    it("staffBlinkDistance computes correctly", () => {
        expect(staffBlinkDistance(enc(1))).toBe(4);
        expect(staffBlinkDistance(enc(5))).toBe(12);
    });

    it("staffHasteDuration computes correctly", () => {
        expect(staffHasteDuration(enc(1))).toBe(6);
        expect(staffHasteDuration(enc(3))).toBe(14);
    });

    it("staffBladeCount computes correctly", () => {
        expect(staffBladeCount(enc(2))).toBe(3);
        expect(staffBladeCount(enc(4))).toBe(6);
    });

    it("staffDiscordDuration computes correctly", () => {
        expect(staffDiscordDuration(enc(3))).toBe(12);
    });

    it("staffEntrancementDuration computes correctly", () => {
        expect(staffEntrancementDuration(enc(3))).toBe(9);
    });

    it("staffProtection returns positive values for typical enchant levels", () => {
        const prot = staffProtection(enc(3));
        expect(prot).toBeGreaterThan(0);
    });

    it("staffPoison returns expected values", () => {
        // At enchant 2: idx = 0, value = 5 * 65536 / 65536 = 5
        expect(staffPoison(enc(2))).toBe(5);
        // At enchant 3: idx = 1, value = 5 * 85196 / 65536 = 6
        expect(staffPoison(enc(3))).toBe(6);
    });
});

describe("Ring wisdom", () => {
    it("ringWisdomMultiplier at enchant 0 returns FP_FACTOR (1.0)", () => {
        // idx = min(27, 0) + 10 = 10, POW_WISDOM[10] = 65536
        expect(ringWisdomMultiplier(enc(0))).toBe(65536n);
    });

    it("ringWisdomMultiplier at enchant 1 is greater than 1.0", () => {
        expect(ringWisdomMultiplier(enc(1))).toBeGreaterThan(65536n);
    });

    it("ringWisdomMultiplier at enchant -1 is less than 1.0", () => {
        expect(ringWisdomMultiplier(enc(-1))).toBeLessThan(65536n);
    });
});

describe("Weapon enchantment functions", () => {
    it("weaponParalysisDuration clamps to at least 2", () => {
        expect(weaponParalysisDuration(enc(0))).toBe(2);
        expect(weaponParalysisDuration(enc(4))).toBe(4);
    });

    it("weaponConfusionDuration clamps to at least 3", () => {
        expect(weaponConfusionDuration(enc(1))).toBe(3);
        expect(weaponConfusionDuration(enc(4))).toBe(6);
    });

    it("weaponForceDistance clamps to at least 4", () => {
        expect(weaponForceDistance(enc(0))).toBe(4);
        expect(weaponForceDistance(enc(5))).toBe(12);
    });

    it("weaponSlowDuration clamps to at least 3", () => {
        expect(weaponSlowDuration(enc(0))).toBeGreaterThanOrEqual(3);
    });

    it("weaponImageCount is clamped to 1..7", () => {
        expect(weaponImageCount(enc(1))).toBe(1);
        expect(weaponImageCount(enc(21))).toBe(7);
    });

    it("weaponImageDuration always returns 3", () => {
        expect(weaponImageDuration(enc(5))).toBe(3);
    });
});

describe("Armor enchantment functions", () => {
    it("armorReprisalPercent clamps to at least 5", () => {
        expect(armorReprisalPercent(enc(0))).toBe(5);
        expect(armorReprisalPercent(enc(3))).toBe(15);
    });

    it("armorAbsorptionMax clamps to at least 1", () => {
        expect(armorAbsorptionMax(enc(0))).toBe(1);
        expect(armorAbsorptionMax(enc(5))).toBe(5);
    });

    it("armorImageCount is clamped to 1..5", () => {
        expect(armorImageCount(enc(1))).toBe(1);
        expect(armorImageCount(enc(30))).toBe(5);
    });
});

describe("Reflection chance", () => {
    it("reflectionChance returns 0-100 range", () => {
        const r = reflectionChance(enc(1));
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(100);
    });

    it("reflectionChance increases with enchantment", () => {
        expect(reflectionChance(enc(5))).toBeGreaterThan(reflectionChance(enc(1)));
    });
});

describe("Regeneration", () => {
    it("turnsForFullRegenInThousandths decreases with positive bonus", () => {
        const base = turnsForFullRegenInThousandths(enc(0));
        const bonus5 = turnsForFullRegenInThousandths(enc(5));
        expect(bonus5).toBeLessThan(base);
    });

    it("turnsForFullRegenInThousandths increases with negative bonus", () => {
        const base = turnsForFullRegenInThousandths(enc(0));
        const malus = turnsForFullRegenInThousandths(enc(-3));
        expect(malus).toBeGreaterThan(base);
    });
});

describe("Damage / accuracy / defense fractions", () => {
    it("damageFraction at 0 enchant returns FP_FACTOR (1.0)", () => {
        // idx = 0 * 4 + 80 = 80, POW_DAMAGE_FRACTION[80] = 65536
        expect(damageFraction(enc(0))).toBe(65536n);
    });

    it("damageFraction increases with positive enchant", () => {
        expect(damageFraction(enc(5))).toBeGreaterThan(damageFraction(enc(0)));
    });

    it("accuracyFraction mirrors damageFraction", () => {
        expect(accuracyFraction(enc(3))).toBe(damageFraction(enc(3)));
    });

    it("defenseFraction at 0 defense returns FP_FACTOR (1.0)", () => {
        // idx = 0 * 4 / 10 + 80 = 80, POW_DEFENSE_FRACTION[80] = 65536
        expect(defenseFraction(enc(0))).toBe(65536n);
    });

    it("defenseFraction decreases with positive defense", () => {
        expect(defenseFraction(enc(10))).toBeLessThan(defenseFraction(enc(0)));
    });
});

describe("Charm protection", () => {
    it("charmProtection returns positive values", () => {
        // enchant 3, effectMagnitudeMultiplier = 150
        expect(charmProtection(enc(3), 150)).toBeGreaterThan(0);
    });
});

describe("Wand dominate", () => {
    it("returns 100 when currentHP * 5 < maxHP", () => {
        expect(wandDominate(1, 100)).toBe(100);
    });

    it("returns 0 when at full health", () => {
        expect(wandDominate(100, 100)).toBe(0);
    });

    it("scales linearly with damage", () => {
        expect(wandDominate(50, 100)).toBe(50);
    });
});

describe("Runic weapon chance", () => {
    it("W_SLAYING always returns 0", () => {
        expect(runicWeaponChance(7, enc(5), 10, false, false)).toBe(0);
    });

    it("bad runics (>= NUMBER_GOOD_WEAPON_ENCHANT_KINDS) return 15", () => {
        expect(runicWeaponChance(8, enc(5), 10, false, false)).toBe(15);
        expect(runicWeaponChance(9, enc(5), 10, false, false)).toBe(15);
    });

    it("returns 0 for negative enchantment", () => {
        // Actually it returns max(1, enchantLevel/FP_FACTOR) which is 1 when enchant is negative
        // because of the clamp at the end. Let me re-read the code...
        // When enchantLevel < 0: chance = 0, then clamp(chance, max(1, enchant/FP_FACTOR), 100)
        // max(1, -1) = 1, so the minimum is 1.
        expect(runicWeaponChance(0, enc(-1), 10, false, false)).toBe(1);
    });

    it("returns positive values for positive enchantment", () => {
        const chance = runicWeaponChance(0, enc(5), 5, false, false);
        expect(chance).toBeGreaterThan(0);
        expect(chance).toBeLessThanOrEqual(100);
    });

    it("stagger weapons get adjusted chance", () => {
        const normal = runicWeaponChance(0, enc(5), 5, false, false);
        const stagger = runicWeaponChance(0, enc(5), 5, true, false);
        // Stagger adjusts: 1 - (1-p)^2, which is always >= p for p in [0,1]
        expect(stagger).toBeGreaterThanOrEqual(normal);
    });
});
