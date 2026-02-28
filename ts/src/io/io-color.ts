/*
 *  io-color.ts — Color manipulation functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: applyColorMultiplier, applyColorAverage, applyColorAugment,
 *             applyColorScalar, applyColorBounds, desaturate, randomizeColor,
 *             swapColors, bakeColor, normColor, separateColors,
 *             storeColorComponents, colorFromComponents,
 *             colorMultiplierFromDungeonLight, adjustedLightValue,
 *             encodeMessageColor, decodeMessageColor, blendAppearances,
 *             colorDiff, messageColorFromVictim
 *
 *  These are *pure* color math helpers that operate on mutable Color objects.
 *  C integer semantics: all multiplications use truncating integer division
 *  (Math.trunc for signed, Math.floor for unsigned divisors).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Tcell, Creature } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { CreatureState } from "../types/enums.js";
import { clamp, randRange } from "../math/rng.js";
import { LIGHT_SMOOTHING_THRESHOLD, COLOR_ESCAPE, COLOR_VALUE_INTERCEPT } from "../types/constants.js";
import { FP_FACTOR, fpSqrt } from "../math/fixpt.js";
import { black, white, badMessageColor, goodMessageColor } from "../globals/colors.js";

// =============================================================================
// Constants
// =============================================================================

/** Minimum perceptual distance between fore/back colors before separateColors kicks in. */
export const MIN_COLOR_DIFF = 600;

// =============================================================================
// Color arithmetic — mutating operations on Color objects
// =============================================================================

/**
 * Multiply each component of baseColor by the corresponding component of
 * multiplierColor / 100. Mutates `baseColor` in place.
 *
 * C: `applyColorMultiplier` in IO.c
 */
export function applyColorMultiplier(baseColor: Color, multiplierColor: Readonly<Color>): void {
    baseColor.red = Math.trunc(baseColor.red * multiplierColor.red / 100);
    baseColor.redRand = Math.trunc(baseColor.redRand * multiplierColor.redRand / 100);
    baseColor.green = Math.trunc(baseColor.green * multiplierColor.green / 100);
    baseColor.greenRand = Math.trunc(baseColor.greenRand * multiplierColor.greenRand / 100);
    baseColor.blue = Math.trunc(baseColor.blue * multiplierColor.blue / 100);
    baseColor.blueRand = Math.trunc(baseColor.blueRand * multiplierColor.blueRand / 100);
    baseColor.rand = Math.trunc(baseColor.rand * multiplierColor.rand / 100);
}

/**
 * Blend baseColor toward newColor by `averageWeight` percent (0–100).
 * weight=0 leaves baseColor unchanged; weight=100 replaces it with newColor.
 *
 * C: `applyColorAverage` in IO.c
 */
export function applyColorAverage(baseColor: Color, newColor: Readonly<Color>, averageWeight: number): void {
    const complement = 100 - averageWeight;
    baseColor.red = Math.trunc((baseColor.red * complement + newColor.red * averageWeight) / 100);
    baseColor.redRand = Math.trunc((baseColor.redRand * complement + newColor.redRand * averageWeight) / 100);
    baseColor.green = Math.trunc((baseColor.green * complement + newColor.green * averageWeight) / 100);
    baseColor.greenRand = Math.trunc((baseColor.greenRand * complement + newColor.greenRand * averageWeight) / 100);
    baseColor.blue = Math.trunc((baseColor.blue * complement + newColor.blue * averageWeight) / 100);
    baseColor.blueRand = Math.trunc((baseColor.blueRand * complement + newColor.blueRand * averageWeight) / 100);
    baseColor.rand = Math.trunc((baseColor.rand * complement + newColor.rand * averageWeight) / 100);
    baseColor.colorDances = baseColor.colorDances || newColor.colorDances;
}

/**
 * Add augmentingColor * augmentWeight/100 to baseColor.
 *
 * C: `applyColorAugment` in IO.c
 */
export function applyColorAugment(baseColor: Color, augmentingColor: Readonly<Color>, augmentWeight: number): void {
    baseColor.red += Math.trunc(augmentingColor.red * augmentWeight / 100);
    baseColor.redRand += Math.trunc(augmentingColor.redRand * augmentWeight / 100);
    baseColor.green += Math.trunc(augmentingColor.green * augmentWeight / 100);
    baseColor.greenRand += Math.trunc(augmentingColor.greenRand * augmentWeight / 100);
    baseColor.blue += Math.trunc(augmentingColor.blue * augmentWeight / 100);
    baseColor.blueRand += Math.trunc(augmentingColor.blueRand * augmentWeight / 100);
    baseColor.rand += Math.trunc(augmentingColor.rand * augmentWeight / 100);
}

/**
 * Scale all color components by scalar/100.
 *
 * C: `applyColorScalar` in IO.c
 */
export function applyColorScalar(baseColor: Color, scalar: number): void {
    baseColor.red = Math.trunc(baseColor.red * scalar / 100);
    baseColor.redRand = Math.trunc(baseColor.redRand * scalar / 100);
    baseColor.green = Math.trunc(baseColor.green * scalar / 100);
    baseColor.greenRand = Math.trunc(baseColor.greenRand * scalar / 100);
    baseColor.blue = Math.trunc(baseColor.blue * scalar / 100);
    baseColor.blueRand = Math.trunc(baseColor.blueRand * scalar / 100);
    baseColor.rand = Math.trunc(baseColor.rand * scalar / 100);
}

/**
 * Clamp all color components to [lowerBound, upperBound].
 *
 * C: `applyColorBounds` in IO.c
 */
export function applyColorBounds(baseColor: Color, lowerBound: number, upperBound: number): void {
    baseColor.red = clamp(baseColor.red, lowerBound, upperBound);
    baseColor.redRand = clamp(baseColor.redRand, lowerBound, upperBound);
    baseColor.green = clamp(baseColor.green, lowerBound, upperBound);
    baseColor.greenRand = clamp(baseColor.greenRand, lowerBound, upperBound);
    baseColor.blue = clamp(baseColor.blue, lowerBound, upperBound);
    baseColor.blueRand = clamp(baseColor.blueRand, lowerBound, upperBound);
    baseColor.rand = clamp(baseColor.rand, lowerBound, upperBound);
}

/**
 * Desaturate a color by mixing each RGB channel toward the average.
 * The rand components are redistributed to `rand` (shared randomness).
 *
 * C: `desaturate` in IO.c
 */
export function desaturate(baseColor: Color, weight: number): void {
    const avg = Math.trunc((baseColor.red + baseColor.green + baseColor.blue) / 3) + 1;
    baseColor.red = Math.trunc(baseColor.red * (100 - weight) / 100) + Math.trunc(avg * weight / 100);
    baseColor.green = Math.trunc(baseColor.green * (100 - weight) / 100) + Math.trunc(avg * weight / 100);
    baseColor.blue = Math.trunc(baseColor.blue * (100 - weight) / 100) + Math.trunc(avg * weight / 100);

    const randAvg = baseColor.redRand + baseColor.greenRand + baseColor.blueRand;
    baseColor.redRand = Math.trunc(baseColor.redRand * (100 - weight) / 100);
    baseColor.greenRand = Math.trunc(baseColor.greenRand * (100 - weight) / 100);
    baseColor.blueRand = Math.trunc(baseColor.blueRand * (100 - weight) / 100);

    baseColor.rand += Math.trunc(randAvg * weight / 3 / 100);
}

/**
 * Randomize each RGB component by ±percent% (using RNG).
 * Assumes color is already baked (no rand components).
 *
 * C: `randomizeColor` in IO.c (depends on `randomizeByPercent`)
 */
export function randomizeColor(baseColor: Color, randomizePercent: number): void {
    baseColor.red = randomizeByPercent(baseColor.red, randomizePercent);
    baseColor.green = randomizeByPercent(baseColor.green, randomizePercent);
    baseColor.blue = randomizeByPercent(baseColor.blue, randomizePercent);
}

/** C: `randomizeByPercent` (static helper in IO.c). */
function randomizeByPercent(input: number, percent: number): number {
    return randRange(
        Math.trunc(input * (100 - percent) / 100),
        Math.trunc(input * (100 + percent) / 100),
    );
}

/**
 * Swap two colors in place.
 *
 * C: `swapColors` in IO.c
 */
export function swapColors(color1: Color, color2: Color): void {
    const temp: Color = { ...color1 };
    Object.assign(color1, color2);
    Object.assign(color2, temp);
}

// =============================================================================
// Color baking and normalization
// =============================================================================

/**
 * "Bake" a color: resolve all random components into the base RGB values
 * using the current RNG, and set all random fields to 0.
 *
 * C: `bakeColor` in IO.c
 */
export function bakeColor(theColor: Color): void {
    const rand = randRange(0, theColor.rand);
    theColor.red += randRange(0, theColor.redRand) + rand;
    theColor.green += randRange(0, theColor.greenRand) + rand;
    theColor.blue += randRange(0, theColor.blueRand) + rand;
    theColor.redRand = 0;
    theColor.greenRand = 0;
    theColor.blueRand = 0;
    theColor.rand = 0;
}

/**
 * Normalize a color: translate all components, then scale to match
 * aggregateMultiplier while maintaining the color's direction.
 *
 * C: `normColor` in IO.c
 */
export function normColor(baseColor: Color, aggregateMultiplier: number, colorTranslation: number): void {
    baseColor.red += colorTranslation;
    baseColor.green += colorTranslation;
    baseColor.blue += colorTranslation;
    const vectorLength = baseColor.red + baseColor.green + baseColor.blue;

    if (vectorLength !== 0) {
        baseColor.red = Math.trunc(Math.trunc(baseColor.red * 300 / vectorLength) * aggregateMultiplier / 100);
        baseColor.green = Math.trunc(Math.trunc(baseColor.green * 300 / vectorLength) * aggregateMultiplier / 100);
        baseColor.blue = Math.trunc(Math.trunc(baseColor.blue * 300 / vectorLength) * aggregateMultiplier / 100);
    }
    baseColor.redRand = 0;
    baseColor.greenRand = 0;
    baseColor.blueRand = 0;
    baseColor.rand = 0;
}

// =============================================================================
// Color differentiation
// =============================================================================

/**
 * Perceptual color difference using weighted sum of squared component
 * differences (ITU-R BT.709 luminance weights).
 *
 * C: `COLOR_DIFF` macro in Rogue.h
 */
export function colorDiff(f: Readonly<Color>, b: Readonly<Color>): number {
    return (
        (f.red - b.red) * (f.red - b.red) * 0.2126 +
        (f.green - b.green) * (f.green - b.green) * 0.7152 +
        (f.blue - b.blue) * (f.blue - b.blue) * 0.0722
    );
}

/**
 * If `fore` is too similar to `back`, lighten or darken it until they are
 * sufficiently distinct. Returns true if the color was modified.
 *
 * Assumes colors have already been baked (no random components).
 *
 * C: `separateColors` in IO.c
 */
export function separateColors(fore: Color, back: Readonly<Color>): boolean {
    const f: Color = { ...fore };
    const b: Color = { ...back };
    f.red = clamp(f.red, 0, 100);
    f.green = clamp(f.green, 0, 100);
    f.blue = clamp(f.blue, 0, 100);
    b.red = clamp(b.red, 0, 100);
    b.green = clamp(b.green, 0, 100);
    b.blue = clamp(b.blue, 0, 100);

    const modifier: Readonly<Color> =
        (f.red + f.blue + f.green > 50 * 3) ? black : white;

    let madeChange = false;
    let failsafe = 10;

    while (colorDiff(f, b) < MIN_COLOR_DIFF && --failsafe) {
        applyColorAverage(f, modifier, 20);
        madeChange = true;
    }

    if (madeChange) {
        Object.assign(fore, f);
        return true;
    }
    return false;
}

// =============================================================================
// Color component storage (for display buffer)
// =============================================================================

/**
 * Convert a Color (with random components) into a 3-element RGB tuple
 * by baking random values and clamping to [0, 100].
 *
 * C: `storeColorComponents` in IO.c
 */
export function storeColorComponents(theColor: Readonly<Color>): [number, number, number] {
    const rand = randRange(0, theColor.rand);
    return [
        clamp(theColor.red + randRange(0, theColor.redRand) + rand, 0, 100),
        clamp(theColor.green + randRange(0, theColor.greenRand) + rand, 0, 100),
        clamp(theColor.blue + randRange(0, theColor.blueRand) + rand, 0, 100),
    ];
}

/**
 * Reconstruct a Color from a 3-element RGB tuple.
 * Returns a fresh Color with all random fields zeroed.
 *
 * C: `colorFromComponents` in IO.c
 */
export function colorFromComponents(rgb: readonly [number, number, number]): Color {
    return {
        red: rgb[0],
        green: rgb[1],
        blue: rgb[2],
        redRand: 0,
        greenRand: 0,
        blueRand: 0,
        rand: 0,
        colorDances: false,
    };
}

// =============================================================================
// Dungeon light helpers
// =============================================================================

/**
 * Smooth very bright light values using sqrt compression above threshold.
 *
 * C: `adjustedLightValue` (static) in IO.c
 */
export function adjustedLightValue(x: number): number {
    if (x <= LIGHT_SMOOTHING_THRESHOLD) {
        return x;
    } else {
        return Math.trunc(
            Number(fpSqrt(BigInt(Math.trunc(x * Number(FP_FACTOR) / LIGHT_SMOOTHING_THRESHOLD)))) *
            LIGHT_SMOOTHING_THRESHOLD / Number(FP_FACTOR)
        );
    }
}

/**
 * Build a color multiplier from the dungeon light at cell (x, y).
 * The resulting color has red/green/blue AND redRand/greenRand/blueRand
 * set to the same adjusted light values (for smooth random variation).
 *
 * C: `colorMultiplierFromDungeonLight` in IO.c
 */
export function colorMultiplierFromDungeonLight(
    x: number,
    y: number,
    tmap: readonly (readonly Tcell[])[],
): Color {
    const rAdj = adjustedLightValue(Math.max(0, tmap[x][y].light[0]));
    const gAdj = adjustedLightValue(Math.max(0, tmap[x][y].light[1]));
    const bAdj = adjustedLightValue(Math.max(0, tmap[x][y].light[2]));
    const randAdj = adjustedLightValue(
        Math.trunc(Math.max(0, tmap[x][y].light[0] + tmap[x][y].light[1] + tmap[x][y].light[2]) / 3),
    );

    return {
        red: rAdj,
        redRand: rAdj,
        green: gAdj,
        greenRand: gAdj,
        blue: bAdj,
        blueRand: bAdj,
        rand: randAdj,
        colorDances: false,
    };
}

// =============================================================================
// Message color encoding/decoding
// =============================================================================

/**
 * Encode a color into a message string as a 4-character escape sequence.
 * The color is first baked and clamped to [0, 100].
 *
 * Returns the encoded escape string (4 characters).
 *
 * C: `encodeMessageColor` in IO.c
 * In TS we return the escape as a string rather than writing into a char array.
 */
export function encodeMessageColor(theColor: Readonly<Color>): string {
    const col: Color = { ...theColor };
    bakeColor(col);
    col.red = clamp(col.red, 0, 100);
    col.green = clamp(col.green, 0, 100);
    col.blue = clamp(col.blue, 0, 100);

    return String.fromCharCode(
        COLOR_ESCAPE,
        COLOR_VALUE_INTERCEPT + col.red,
        COLOR_VALUE_INTERCEPT + col.green,
        COLOR_VALUE_INTERCEPT + col.blue,
    );
}

/**
 * Decode a color escape sequence starting at position `i` in `msg`.
 * Returns `{ color, nextIndex }`.
 *
 * C: `decodeMessageColor` in IO.c
 */
export function decodeMessageColor(
    msg: string,
    i: number,
): { color: Color; nextIndex: number } {
    if (msg.charCodeAt(i) !== COLOR_ESCAPE) {
        // Not a color escape — return white as fallback
        return {
            color: { ...white, colorDances: false },
            nextIndex: i,
        };
    }

    i++; // skip the escape byte
    const result: Color = {
        red: clamp(msg.charCodeAt(i++) - COLOR_VALUE_INTERCEPT, 0, 100),
        green: clamp(msg.charCodeAt(i++) - COLOR_VALUE_INTERCEPT, 0, 100),
        blue: clamp(msg.charCodeAt(i++) - COLOR_VALUE_INTERCEPT, 0, 100),
        redRand: 0,
        greenRand: 0,
        blueRand: 0,
        rand: 0,
        colorDances: false,
    };

    return { color: result, nextIndex: i };
}

// =============================================================================
// Appearance blending
// =============================================================================

/**
 * Blend between two cell appearances. Smoothly interpolates back colors,
 * picks the appropriate character at the 50% crossover point, and blends
 * fore colors using either straight average or cross-fade through the
 * back color.
 *
 * C: `blendAppearances` (static) in IO.c
 */
export function blendAppearances(
    fromForeColor: Readonly<Color>,
    fromBackColor: Readonly<Color>,
    fromChar: DisplayGlyph,
    toForeColor: Readonly<Color>,
    toBackColor: Readonly<Color>,
    toChar: DisplayGlyph,
    percent: number,
): { foreColor: Color; backColor: Color; char: DisplayGlyph } {
    // Straight average of the back color
    const retBackColor: Color = { ...fromBackColor };
    applyColorAverage(retBackColor, toBackColor, percent);

    // Pick the character
    const retChar = percent >= 50 ? toChar : fromChar;

    // Pick the method for blending the fore color
    let retForeColor: Color;
    if (fromChar === toChar) {
        // Same character → straight average
        retForeColor = { ...fromForeColor };
        applyColorAverage(retForeColor, toForeColor, percent);
    } else {
        // Different characters → cross-fade through back color
        if (percent >= 50) {
            retForeColor = { ...retBackColor };
            applyColorAverage(retForeColor, toForeColor, (percent - 50) * 2);
        } else {
            retForeColor = { ...fromForeColor };
            applyColorAverage(retForeColor, retBackColor, percent * 2);
        }
    }

    return { foreColor: retForeColor, backColor: retBackColor, char: retChar };
}

// =============================================================================
// Message color from victim
// =============================================================================

/**
 * Returns the appropriate message color for combat text based on the victim.
 *
 * C: `messageColorFromVictim` in IO.c
 */
export function messageColorFromVictim(
    monst: Creature,
    player: Creature,
    isHallucinating: boolean,
    playbackOmniscience: boolean,
    monstersAreEnemies: (a: Creature, b: Creature) => boolean,
): Readonly<Color> {
    if (monst === player) {
        return badMessageColor;
    } else if (isHallucinating && !playbackOmniscience) {
        return white;
    } else if (monst.creatureState === CreatureState.Ally) {
        return badMessageColor;
    } else if (monstersAreEnemies(player, monst)) {
        return goodMessageColor;
    } else {
        return white;
    }
}
