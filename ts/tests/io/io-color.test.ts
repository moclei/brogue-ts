/*
 *  io-color.test.ts — Tests for io-color.ts (color manipulation)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { seedRandomGenerator } from "../../src/math/rng.js";
import { COLOR_ESCAPE, COLOR_VALUE_INTERCEPT } from "../../src/types/constants.js";
import { CreatureState } from "../../src/types/enums.js";
import type { Color, Tcell, Creature } from "../../src/types/types.js";
import {
    applyColorMultiplier,
    applyColorAverage,
    applyColorAugment,
    applyColorScalar,
    applyColorBounds,
    desaturate,
    randomizeColor,
    swapColors,
    bakeColor,
    normColor,
    colorDiff,
    separateColors,
    storeColorComponents,
    colorFromComponents,
    adjustedLightValue,
    colorMultiplierFromDungeonLight,
    encodeMessageColor,
    decodeMessageColor,
    blendAppearances,
    messageColorFromVictim,
    MIN_COLOR_DIFF,
} from "../../src/io/io-color.js";

import { black, white, goodMessageColor, badMessageColor } from "../../src/globals/colors.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Create a fresh mutable Color. */
function makeColor(
    red = 0, green = 0, blue = 0,
    redRand = 0, greenRand = 0, blueRand = 0,
    rand = 0, colorDances = false,
): Color {
    return { red, green, blue, redRand, greenRand, blueRand, rand, colorDances };
}

/** Create a minimal Creature stub for testing. */
function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        creatureState: CreatureState.Sleeping,
        ...overrides,
    } as Creature;
}

// =============================================================================
// applyColorMultiplier
// =============================================================================

describe("applyColorMultiplier", () => {
    it("multiplies each component pair", () => {
        const base = makeColor(50, 80, 100, 20, 40, 60, 10);
        const mult = makeColor(100, 50, 200, 50, 100, 25, 100);
        applyColorMultiplier(base, mult);

        expect(base.red).toBe(Math.trunc(50 * 100 / 100));   // 50
        expect(base.green).toBe(Math.trunc(80 * 50 / 100));   // 40
        expect(base.blue).toBe(Math.trunc(100 * 200 / 100));  // 200
        expect(base.redRand).toBe(Math.trunc(20 * 50 / 100)); // 10
        expect(base.greenRand).toBe(Math.trunc(40 * 100 / 100)); // 40
        expect(base.blueRand).toBe(Math.trunc(60 * 25 / 100));   // 15
        expect(base.rand).toBe(Math.trunc(10 * 100 / 100));      // 10
    });

    it("zeroes everything when multiplied by black", () => {
        const base = makeColor(50, 50, 50, 10, 10, 10, 5);
        applyColorMultiplier(base, { ...black, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false });
        expect(base.red).toBe(0);
        expect(base.green).toBe(0);
        expect(base.blue).toBe(0);
        expect(base.rand).toBe(0);
    });

    it("handles negative components (C allows negative color values)", () => {
        const base = makeColor(-50, 100, 0);
        const mult = makeColor(100, 100, 100, 100, 100, 100, 100);
        applyColorMultiplier(base, mult);
        expect(base.red).toBe(-50);
        expect(base.green).toBe(100);
    });
});

// =============================================================================
// applyColorAverage
// =============================================================================

describe("applyColorAverage", () => {
    it("at weight=0, baseColor is unchanged", () => {
        const base = makeColor(100, 50, 25);
        const original = { ...base };
        applyColorAverage(base, makeColor(0, 0, 0), 0);
        expect(base.red).toBe(original.red);
        expect(base.green).toBe(original.green);
        expect(base.blue).toBe(original.blue);
    });

    it("at weight=100, baseColor becomes newColor", () => {
        const base = makeColor(100, 50, 25);
        const target = makeColor(10, 20, 30);
        applyColorAverage(base, target, 100);
        expect(base.red).toBe(10);
        expect(base.green).toBe(20);
        expect(base.blue).toBe(30);
    });

    it("at weight=50, gives the midpoint", () => {
        const base = makeColor(100, 0, 50);
        const target = makeColor(0, 100, 50);
        applyColorAverage(base, target, 50);
        expect(base.red).toBe(50);
        expect(base.green).toBe(50);
        expect(base.blue).toBe(50);
    });

    it("propagates colorDances flag via OR", () => {
        const base = makeColor(10, 10, 10, 0, 0, 0, 0, false);
        const target = makeColor(10, 10, 10, 0, 0, 0, 0, true);
        applyColorAverage(base, target, 50);
        expect(base.colorDances).toBe(true);
    });
});

// =============================================================================
// applyColorAugment
// =============================================================================

describe("applyColorAugment", () => {
    it("adds scaled color components", () => {
        const base = makeColor(50, 50, 50);
        const aug = makeColor(100, 200, -100);
        applyColorAugment(base, aug, 50);
        expect(base.red).toBe(100);    // 50 + 100*50/100 = 100
        expect(base.green).toBe(150);  // 50 + 200*50/100 = 150
        expect(base.blue).toBe(0);     // 50 + (-100)*50/100 = 0
    });

    it("at weight=0, no change", () => {
        const base = makeColor(50, 50, 50);
        applyColorAugment(base, makeColor(100, 100, 100), 0);
        expect(base.red).toBe(50);
    });
});

// =============================================================================
// applyColorScalar
// =============================================================================

describe("applyColorScalar", () => {
    it("scales all components by scalar/100", () => {
        const base = makeColor(100, 50, 200, 10, 20, 30, 5);
        applyColorScalar(base, 50);
        expect(base.red).toBe(50);
        expect(base.green).toBe(25);
        expect(base.blue).toBe(100);
        expect(base.redRand).toBe(5);
        expect(base.greenRand).toBe(10);
        expect(base.blueRand).toBe(15);
        expect(base.rand).toBe(2); // trunc(5*50/100) = 2
    });

    it("at scalar=100, no change", () => {
        const base = makeColor(77, 33, 11);
        applyColorScalar(base, 100);
        expect(base.red).toBe(77);
        expect(base.green).toBe(33);
        expect(base.blue).toBe(11);
    });
});

// =============================================================================
// applyColorBounds
// =============================================================================

describe("applyColorBounds", () => {
    it("clamps components to the given range", () => {
        const base = makeColor(-10, 150, 50, -5, 200, 30, 120);
        applyColorBounds(base, 0, 100);
        expect(base.red).toBe(0);
        expect(base.green).toBe(100);
        expect(base.blue).toBe(50);
        expect(base.redRand).toBe(0);
        expect(base.greenRand).toBe(100);
        expect(base.blueRand).toBe(30);
        expect(base.rand).toBe(100);
    });
});

// =============================================================================
// desaturate
// =============================================================================

describe("desaturate", () => {
    it("at weight=0, no change", () => {
        const base = makeColor(100, 0, 50);
        desaturate(base, 0);
        expect(base.red).toBe(100);
        expect(base.green).toBe(0);
        expect(base.blue).toBe(50);
    });

    it("at weight=100, all RGB channels converge to the average", () => {
        const base = makeColor(90, 30, 30);
        desaturate(base, 100);
        const avg = Math.trunc((90 + 30 + 30) / 3) + 1; // 51
        expect(base.red).toBe(avg);
        expect(base.green).toBe(avg);
        expect(base.blue).toBe(avg);
    });

    it("redistributes rand components", () => {
        const base = makeColor(50, 50, 50, 30, 60, 90, 10);
        desaturate(base, 100);
        // All individual rands go to 0
        expect(base.redRand).toBe(0);
        expect(base.greenRand).toBe(0);
        expect(base.blueRand).toBe(0);
        // Global rand picks up the redistributed value
        expect(base.rand).toBe(10 + Math.trunc((30 + 60 + 90) * 100 / 3 / 100));
    });
});

// =============================================================================
// randomizeColor
// =============================================================================

describe("randomizeColor", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("modifies RGB within the randomize percent range", () => {
        const base = makeColor(50, 50, 50);
        randomizeColor(base, 20);
        // Each component should be in [50 * 80/100, 50 * 120/100] = [40, 60]
        expect(base.red).toBeGreaterThanOrEqual(40);
        expect(base.red).toBeLessThanOrEqual(60);
        expect(base.green).toBeGreaterThanOrEqual(40);
        expect(base.green).toBeLessThanOrEqual(60);
        expect(base.blue).toBeGreaterThanOrEqual(40);
        expect(base.blue).toBeLessThanOrEqual(60);
    });

    it("at percent=0, values are unchanged", () => {
        const base = makeColor(50, 50, 50);
        randomizeColor(base, 0);
        expect(base.red).toBe(50);
        expect(base.green).toBe(50);
        expect(base.blue).toBe(50);
    });
});

// =============================================================================
// swapColors
// =============================================================================

describe("swapColors", () => {
    it("swaps all fields between two colors", () => {
        const c1 = makeColor(10, 20, 30, 1, 2, 3, 4, true);
        const c2 = makeColor(90, 80, 70, 9, 8, 7, 6, false);
        swapColors(c1, c2);
        expect(c1.red).toBe(90);
        expect(c1.colorDances).toBe(false);
        expect(c2.red).toBe(10);
        expect(c2.colorDances).toBe(true);
    });
});

// =============================================================================
// bakeColor
// =============================================================================

describe("bakeColor", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("zeroes all random fields after baking", () => {
        const c = makeColor(50, 50, 50, 10, 20, 30, 5);
        bakeColor(c);
        expect(c.redRand).toBe(0);
        expect(c.greenRand).toBe(0);
        expect(c.blueRand).toBe(0);
        expect(c.rand).toBe(0);
    });

    it("a color with no random fields is unchanged", () => {
        const c = makeColor(77, 33, 11);
        bakeColor(c);
        expect(c.red).toBe(77);
        expect(c.green).toBe(33);
        expect(c.blue).toBe(11);
    });

    it("adds random offset to base values", () => {
        const c = makeColor(50, 50, 50, 10, 10, 10, 0);
        bakeColor(c);
        // Each channel should be in [50, 60]
        expect(c.red).toBeGreaterThanOrEqual(50);
        expect(c.red).toBeLessThanOrEqual(60);
        expect(c.green).toBeGreaterThanOrEqual(50);
        expect(c.green).toBeLessThanOrEqual(60);
        expect(c.blue).toBeGreaterThanOrEqual(50);
        expect(c.blue).toBeLessThanOrEqual(60);
    });
});

// =============================================================================
// normColor
// =============================================================================

describe("normColor", () => {
    it("normalizes the color and zeroes random fields", () => {
        const c = makeColor(100, 100, 100, 5, 5, 5, 5);
        normColor(c, 100, 0);
        // 100+100+100 = 300, so each channel = 100 * 300 / 300 * 100 / 100 = 100
        expect(c.red).toBe(100);
        expect(c.green).toBe(100);
        expect(c.blue).toBe(100);
        expect(c.redRand).toBe(0);
        expect(c.greenRand).toBe(0);
        expect(c.blueRand).toBe(0);
        expect(c.rand).toBe(0);
    });

    it("applies color translation before normalizing", () => {
        const c = makeColor(30, 30, 30);
        normColor(c, 100, 20);
        // After translation: each = 50, vectorLength = 150
        // Each = trunc(50 * 300 / 150) * 100 / 100 = 100
        expect(c.red).toBe(100);
        expect(c.green).toBe(100);
        expect(c.blue).toBe(100);
    });

    it("handles vectorLength=0 gracefully", () => {
        const c = makeColor(0, 0, 0);
        normColor(c, 100, 0);
        expect(c.red).toBe(0);
        expect(c.green).toBe(0);
        expect(c.blue).toBe(0);
    });
});

// =============================================================================
// colorDiff
// =============================================================================

describe("colorDiff", () => {
    it("returns 0 for identical colors", () => {
        const c = makeColor(50, 50, 50);
        expect(colorDiff(c, c)).toBe(0);
    });

    it("returns positive value for different colors", () => {
        expect(colorDiff(makeColor(100, 0, 0), makeColor(0, 0, 0))).toBeGreaterThan(0);
    });

    it("weights green more heavily than red, red more than blue (ITU-R BT.709)", () => {
        const base = makeColor(0, 0, 0);
        const diffRed = colorDiff(makeColor(100, 0, 0), base);
        const diffGreen = colorDiff(makeColor(0, 100, 0), base);
        const diffBlue = colorDiff(makeColor(0, 0, 100), base);
        expect(diffGreen).toBeGreaterThan(diffRed);
        expect(diffRed).toBeGreaterThan(diffBlue);
    });
});

// =============================================================================
// separateColors
// =============================================================================

describe("separateColors", () => {
    it("returns false for already distinct colors", () => {
        const fore = makeColor(100, 100, 100);
        const back = makeColor(0, 0, 0);
        expect(separateColors(fore, back)).toBe(false);
    });

    it("modifies foreground when colors are too similar", () => {
        const fore = makeColor(50, 50, 50);
        const back = makeColor(50, 50, 50);
        const result = separateColors(fore, back);
        expect(result).toBe(true);
        // Fore should have been pushed away from back
        expect(colorDiff(fore, back)).toBeGreaterThanOrEqual(MIN_COLOR_DIFF * 0.5);
    });

    it("darkens bright similar colors (modifier = black)", () => {
        const fore = makeColor(90, 90, 90);
        const back = makeColor(90, 90, 90);
        separateColors(fore, back);
        // Bright colors get pushed toward black
        expect(fore.red).toBeLessThan(90);
        expect(fore.green).toBeLessThan(90);
        expect(fore.blue).toBeLessThan(90);
    });

    it("lightens dark similar colors (modifier = white)", () => {
        const fore = makeColor(10, 10, 10);
        const back = makeColor(10, 10, 10);
        separateColors(fore, back);
        // Dark colors get pushed toward white
        expect(fore.red).toBeGreaterThan(10);
        expect(fore.green).toBeGreaterThan(10);
        expect(fore.blue).toBeGreaterThan(10);
    });
});

// =============================================================================
// storeColorComponents / colorFromComponents
// =============================================================================

describe("storeColorComponents / colorFromComponents", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("round-trips a pure color (no random)", () => {
        const c = makeColor(50, 75, 25);
        const components = storeColorComponents(c);
        expect(components).toEqual([50, 75, 25]);

        const restored = colorFromComponents(components);
        expect(restored.red).toBe(50);
        expect(restored.green).toBe(75);
        expect(restored.blue).toBe(25);
        expect(restored.redRand).toBe(0);
        expect(restored.rand).toBe(0);
        expect(restored.colorDances).toBe(false);
    });

    it("clamps component values to [0, 100]", () => {
        const c = makeColor(200, -50, 50);
        const components = storeColorComponents(c);
        expect(components[0]).toBe(100);
        expect(components[1]).toBe(0);
        expect(components[2]).toBe(50);
    });

    it("applies random offsets within range", () => {
        const c = makeColor(50, 50, 50, 10, 10, 10, 0);
        const components = storeColorComponents(c);
        expect(components[0]).toBeGreaterThanOrEqual(50);
        expect(components[0]).toBeLessThanOrEqual(60);
    });
});

// =============================================================================
// adjustedLightValue
// =============================================================================

describe("adjustedLightValue", () => {
    it("returns values ≤ threshold unchanged", () => {
        expect(adjustedLightValue(0)).toBe(0);
        expect(adjustedLightValue(100)).toBe(100);
        expect(adjustedLightValue(150)).toBe(150);
    });

    it("compresses values above threshold (sqrt compression)", () => {
        const val = adjustedLightValue(600);
        expect(val).toBeGreaterThan(150);
        expect(val).toBeLessThan(600);
    });

    it("is monotonically increasing", () => {
        let prev = 0;
        for (let i = 0; i <= 1000; i += 50) {
            const current = adjustedLightValue(i);
            expect(current).toBeGreaterThanOrEqual(prev);
            prev = current;
        }
    });
});

// =============================================================================
// colorMultiplierFromDungeonLight
// =============================================================================

describe("colorMultiplierFromDungeonLight", () => {
    it("builds a color multiplier from tmap light values", () => {
        const tmap: Tcell[][] = [[{
            light: [100, 200, 50],
            oldLight: [0, 0, 0],
        }]];

        const result = colorMultiplierFromDungeonLight(0, 0, tmap);
        expect(result.red).toBe(adjustedLightValue(100));
        expect(result.redRand).toBe(result.red);
        expect(result.green).toBe(adjustedLightValue(200));
        expect(result.greenRand).toBe(result.green);
        expect(result.blue).toBe(adjustedLightValue(50));
        expect(result.blueRand).toBe(result.blue);
        expect(result.colorDances).toBe(false);
    });

    it("clamps negative light values to 0 before adjusting", () => {
        const tmap: Tcell[][] = [[{
            light: [-50, 0, 100],
            oldLight: [0, 0, 0],
        }]];

        const result = colorMultiplierFromDungeonLight(0, 0, tmap);
        expect(result.red).toBe(0);
        expect(result.green).toBe(0);
        expect(result.blue).toBe(100);
    });
});

// =============================================================================
// encodeMessageColor / decodeMessageColor
// =============================================================================

describe("encodeMessageColor / decodeMessageColor", () => {
    beforeEach(() => {
        seedRandomGenerator(42n);
    });

    it("round-trips a simple color", () => {
        const c = makeColor(50, 75, 25);
        const encoded = encodeMessageColor(c);
        expect(encoded.length).toBe(4);
        expect(encoded.charCodeAt(0)).toBe(COLOR_ESCAPE);

        const { color, nextIndex } = decodeMessageColor(encoded, 0);
        expect(nextIndex).toBe(4);
        expect(color.red).toBe(50);
        expect(color.green).toBe(75);
        expect(color.blue).toBe(25);
    });

    it("clamps encoded values to [0, 100]", () => {
        const c = makeColor(200, -50, 50);
        const encoded = encodeMessageColor(c);
        const { color } = decodeMessageColor(encoded, 0);
        expect(color.red).toBe(100);
        expect(color.green).toBe(0);
        expect(color.blue).toBe(50);
    });

    it("returns white for non-escape input", () => {
        const { color, nextIndex } = decodeMessageColor("hello", 0);
        expect(nextIndex).toBe(0); // doesn't advance
        expect(color.red).toBe(100);
        expect(color.green).toBe(100);
        expect(color.blue).toBe(100);
    });

    it("handles encode embedded in a string", () => {
        seedRandomGenerator(42n);
        const c = makeColor(30, 60, 90);
        const prefix = "Hello ";
        const encoded = prefix + encodeMessageColor(c) + "World";
        const { color, nextIndex } = decodeMessageColor(encoded, prefix.length);
        expect(nextIndex).toBe(prefix.length + 4);
        expect(color.red).toBe(30);
        expect(color.green).toBe(60);
        expect(color.blue).toBe(90);
    });
});

// =============================================================================
// blendAppearances
// =============================================================================

describe("blendAppearances", () => {
    it("at percent=0, returns 'from' appearance", () => {
        const fromFore = makeColor(100, 0, 0);
        const fromBack = makeColor(0, 100, 0);
        const toFore = makeColor(0, 0, 100);
        const toBack = makeColor(50, 50, 50);

        const result = blendAppearances(fromFore, fromBack, 65 as any, toFore, toBack, 66 as any, 0);
        expect(result.char).toBe(65); // fromChar
        expect(result.backColor.red).toBe(fromBack.red);
        expect(result.backColor.green).toBe(fromBack.green);
        expect(result.backColor.blue).toBe(fromBack.blue);
    });

    it("at percent=100, returns 'to' appearance", () => {
        const fromFore = makeColor(100, 0, 0);
        const fromBack = makeColor(0, 100, 0);
        const toFore = makeColor(0, 0, 100);
        const toBack = makeColor(50, 50, 50);

        const result = blendAppearances(fromFore, fromBack, 65 as any, toFore, toBack, 66 as any, 100);
        expect(result.char).toBe(66); // toChar
        expect(result.backColor.red).toBe(toBack.red);
        expect(result.backColor.green).toBe(toBack.green);
        expect(result.backColor.blue).toBe(toBack.blue);
        expect(result.foreColor.red).toBe(toFore.red);
        expect(result.foreColor.green).toBe(toFore.green);
        expect(result.foreColor.blue).toBe(toFore.blue);
    });

    it("at percent=50 with same char, blends foreColor via average", () => {
        const fromFore = makeColor(100, 0, 0);
        const fromBack = makeColor(0, 0, 0);
        const toFore = makeColor(0, 100, 0);
        const toBack = makeColor(0, 0, 0);
        const sameChar = 65 as any;

        const result = blendAppearances(fromFore, fromBack, sameChar, toFore, toBack, sameChar, 50);
        expect(result.foreColor.red).toBe(50);   // average of 100 and 0
        expect(result.foreColor.green).toBe(50);  // average of 0 and 100
    });

    it("at percent=50 with different chars, picks toChar", () => {
        const fromFore = makeColor(100, 0, 0);
        const fromBack = makeColor(0, 0, 0);
        const toFore = makeColor(0, 100, 0);
        const toBack = makeColor(0, 0, 0);

        const result = blendAppearances(fromFore, fromBack, 65 as any, toFore, toBack, 66 as any, 50);
        expect(result.char).toBe(66);
    });
});

// =============================================================================
// messageColorFromVictim
// =============================================================================

describe("messageColorFromVictim", () => {
    it("returns badMessageColor for the player", () => {
        const player = makeCreature();
        const result = messageColorFromVictim(player, player, false, false, () => false);
        expect(result).toBe(badMessageColor);
    });

    it("returns white when hallucinating", () => {
        const player = makeCreature();
        const monst = makeCreature();
        const result = messageColorFromVictim(monst, player, true, false, () => false);
        expect(result).toBe(white);
    });

    it("returns badMessageColor for allies", () => {
        const player = makeCreature();
        const ally = makeCreature({ creatureState: CreatureState.Ally });
        const result = messageColorFromVictim(ally, player, false, false, () => false);
        expect(result).toBe(badMessageColor);
    });

    it("returns goodMessageColor for enemies", () => {
        const player = makeCreature();
        const enemy = makeCreature({ creatureState: CreatureState.TrackingScent });
        const result = messageColorFromVictim(enemy, player, false, false, () => true);
        expect(result).toBe(goodMessageColor);
    });

    it("returns white for non-enemy, non-ally monsters", () => {
        const player = makeCreature();
        const monst = makeCreature({ creatureState: CreatureState.Wandering });
        const result = messageColorFromVictim(monst, player, false, false, () => false);
        expect(result).toBe(white);
    });
});
