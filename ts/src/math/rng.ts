/*
 *  rng.ts — Bob Jenkins' small PRNG, ported from Math.c
 *  brogue-ts
 *
 *  This is a faithful port of the C implementation. The RNG uses
 *  32-bit unsigned integer arithmetic with overflow semantics.
 *  We use `>>> 0` to ensure unsigned 32-bit behavior in JavaScript.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { RNG } from "../types/enums.js";

// ===== Internal state =====

interface RanCtx {
    a: number;
    b: number;
    c: number;
    d: number;
}

const RNGState: RanCtx[] = [
    { a: 0, b: 0, c: 0, d: 0 },  // RNG.Substantive
    { a: 0, b: 0, c: 0, d: 0 },  // RNG.Cosmetic
];

let randomNumbersGenerated = 0;

/** Current RNG selection — mirrors rogue.RNG */
let currentRNG: RNG = RNG.Substantive;

// ===== Core PRNG (Jenkins small) =====

function rot(x: number, k: number): number {
    return ((x << k) | (x >>> (32 - k))) >>> 0;
}

function ranval(ctx: RanCtx): number {
    const e = (ctx.a - rot(ctx.b, 27)) >>> 0;
    ctx.a = (ctx.b ^ rot(ctx.c, 17)) >>> 0;
    ctx.b = (ctx.c + ctx.d) >>> 0;
    ctx.c = (ctx.d + e) >>> 0;
    ctx.d = (e + ctx.a) >>> 0;
    return ctx.d;
}

function raninit(ctx: RanCtx, seed: bigint): void {
    const lo = Number(seed & 0xFFFFFFFFn) >>> 0;
    const hi = Number((seed >> 32n) & 0xFFFFFFFFn) >>> 0;

    ctx.a = 0xf1ea5eed;
    ctx.b = lo;
    ctx.c = (lo ^ hi) >>> 0;
    ctx.d = lo;

    for (let i = 0; i < 20; i++) {
        ranval(ctx);
    }
}

// ===== Unbiased range selection =====

const RAND_MAX_COMBO = 0xFFFFFFFF;

/**
 * Returns an unbiased random number in [0, n-1].
 * Uses rejection sampling to eliminate modulo bias.
 */
function range(n: number, rng: RNG): number {
    const div = Math.floor(RAND_MAX_COMBO / n);
    let r: number;
    do {
        r = Math.floor(ranval(RNGState[rng]) / div);
    } while (r >= n);
    return r;
}

// ===== Public API =====

/**
 * Set which RNG stream is active. Mirrors `rogue.RNG`.
 */
export function setRNG(rng: RNG): void {
    currentRNG = rng;
}

/**
 * Get which RNG stream is currently active.
 */
export function getRNG(): RNG {
    return currentRNG;
}

/**
 * Get the total count of substantive random numbers generated.
 */
export function getRandomNumbersGenerated(): number {
    return randomNumbersGenerated;
}

/**
 * Reset the random number counter (useful for testing).
 */
export function resetRandomNumbersGenerated(): void {
    randomNumbersGenerated = 0;
}

/**
 * Seed all RNG streams. If seed is 0n, uses current time.
 * Returns the seed used.
 *
 * Mirrors `seedRandomGenerator()` from Math.c.
 */
export function seedRandomGenerator(seed: bigint): bigint {
    if (seed === 0n) {
        seed = BigInt(Math.floor(Date.now() / 1000)) - 1352700000n;
    }
    raninit(RNGState[RNG.Substantive], seed);
    raninit(RNGState[RNG.Cosmetic], seed);
    randomNumbersGenerated = 0;
    return seed;
}

/**
 * Get a random integer in [lowerBound, upperBound], inclusive.
 * Uses the currently active RNG stream.
 *
 * Mirrors `rand_range()` from Math.c.
 */
export function randRange(lowerBound: number, upperBound: number): number {
    if (upperBound <= lowerBound) {
        return lowerBound;
    }
    if (currentRNG === RNG.Substantive) {
        randomNumbersGenerated++;
    }
    const interval = upperBound - lowerBound + 1;
    return lowerBound + range(interval, currentRNG);
}

/**
 * Get a random 64-bit value as a BigInt.
 *
 * Mirrors `rand_64bits()` from Math.c.
 */
export function rand64bits(): bigint {
    if (currentRNG === RNG.Substantive) {
        randomNumbersGenerated++;
    }
    const hi = BigInt(ranval(RNGState[currentRNG]));
    const lo = BigInt(ranval(RNGState[currentRNG]));
    return (hi << 32n) | lo;
}

/**
 * Test a random roll with a success chance of `percent` out of 100.
 *
 * Mirrors `rand_percent()` from Math.c.
 */
export function randPercent(percent: number): boolean {
    return randRange(0, 99) < clamp(percent, 0, 100);
}

/**
 * Get a random int with a clumped distribution.
 *
 * Mirrors `randClumpedRange()` from Math.c.
 */
export function randClumpedRange(
    lowerBound: number,
    upperBound: number,
    clumpFactor: number,
): number {
    if (upperBound <= lowerBound) {
        return lowerBound;
    }
    if (clumpFactor <= 1) {
        return randRange(lowerBound, upperBound);
    }

    let total = 0;
    const numSides = Math.floor((upperBound - lowerBound) / clumpFactor);
    let i = 0;

    for (; i < (upperBound - lowerBound) % clumpFactor; i++) {
        total += randRange(0, numSides + 1);
    }

    for (; i < clumpFactor; i++) {
        total += randRange(0, numSides);
    }

    return total + lowerBound;
}

/**
 * Get a random value from a RandomRange.
 *
 * Mirrors `randClump()` from Math.c.
 */
export function randClump(theRange: {
    lowerBound: number;
    upperBound: number;
    clumpFactor: number;
}): number {
    return randClumpedRange(
        theRange.lowerBound,
        theRange.upperBound,
        theRange.clumpFactor,
    );
}

// ===== Utility functions =====

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Fisher-Yates (Knuth) shuffle, in-place.
 *
 * Mirrors `shuffleList()` from Math.c.
 */
export function shuffleList(list: number[]): void {
    for (let i = 0; i < list.length - 1; i++) {
        const r = randRange(i, list.length - 1);
        if (i !== r) {
            const tmp = list[r];
            list[r] = list[i];
            list[i] = tmp;
        }
    }
}

/**
 * Fill an array with sequential values [0, 1, 2, ...].
 *
 * Mirrors `fillSequentialList()` from Math.c.
 */
export function fillSequentialList(list: number[]): void {
    for (let i = 0; i < list.length; i++) {
        list[i] = i;
    }
}
