/*
 *  fixpt.ts — Fixed-point arithmetic, ported from Math.c
 *  brogue-ts
 *
 *  Fixed-point numbers are BigInt values with a 16-bit fractional part.
 *  The value 1.0 is represented as FP_FACTOR = 65536n = 2^16.
 *
 *  We use BigInt throughout to faithfully reproduce the C `long long` behavior.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Fixpt } from "../types/types.js";

// ===== Constants =====

/** Number of fractional bits. */
export const FP_BASE = 16;

/** Fixed-point factor: 1.0 in fixed-point representation. */
export const FP_FACTOR: Fixpt = 1n << BigInt(FP_BASE);

// ===== Core operations =====

/**
 * Convert an integer to fixed-point.
 */
export function fpFromInt(n: number): Fixpt {
    return BigInt(n) << BigInt(FP_BASE);
}

/**
 * Convert a floating-point number to fixed-point.
 * Rounds to nearest.
 */
export function fpFromFloat(f: number): Fixpt {
    return BigInt(Math.round(f * Number(FP_FACTOR)));
}

/**
 * Convert a fixed-point number to a JavaScript number (float).
 */
export function fpToFloat(x: Fixpt): number {
    return Number(x) / Number(FP_FACTOR);
}

/**
 * Fixed-point multiplication: (x * y) / FP_FACTOR.
 *
 * Mirrors C macro: #define FP_MUL(x, y) ((x) * (y) / FP_FACTOR)
 */
export function fpMul(x: Fixpt, y: Fixpt): Fixpt {
    return (x * y) / FP_FACTOR;
}

/**
 * Fixed-point division: (x * FP_FACTOR) / y.
 *
 * Mirrors C macro: #define FP_DIV(x, y) ((x) * FP_FACTOR / (y))
 */
export function fpDiv(x: Fixpt, y: Fixpt): Fixpt {
    return (x * FP_FACTOR) / y;
}

/**
 * Round a fixed-point number to the nearest integer (as a fixed-point value
 * with zero fractional part — or more precisely, return the integer part).
 *
 * Mirrors `fp_round()` from Math.c.
 */
export function fpRound(x: Fixpt): Fixpt {
    const div = x / FP_FACTOR;
    const rem = x % FP_FACTOR;
    const sign = x >= 0n ? 1n : -1n;

    const half = FP_FACTOR / 2n;
    if (rem >= half || rem <= -half) {
        return div + sign;
    } else {
        return div;
    }
}

/**
 * Return the integer part of a fixed-point number (truncate toward zero).
 */
export function fpFloor(x: Fixpt): bigint {
    return x / FP_FACTOR;
}

/**
 * Returns the bit position of the most significant bit of x,
 * where the unit bit has position 1. Returns 0 if x === 0.
 *
 * Mirrors `msbpos()` from Math.c.
 */
function msbpos(x: bigint): number {
    if (x === 0n) return 0;
    let n = 0;
    let v = x;
    do {
        n += 1;
        v >>= 1n;
    } while (v > 0n);
    return n;
}

/**
 * Fixed-point power of 2.
 *
 * Mirrors `fp_exp2()` from Math.c.
 */
function fpExp2(n: number): Fixpt {
    if (n >= 0) {
        return FP_FACTOR << BigInt(n);
    } else {
        return FP_FACTOR >> BigInt(-n);
    }
}

// Pre-computed square root table from the C source
const SQUARE_ROOTS: Fixpt[] = [
    0n, 65536n, 92682n, 113511n, 131073n, 146543n, 160529n, 173392n,
    185363n, 196608n, 207243n, 217359n, 227023n, 236293n, 245213n, 253819n,
    262145n, 270211n, 278045n, 285665n, 293086n, 300323n, 307391n, 314299n,
    321059n, 327680n, 334169n, 340535n, 346784n, 352923n, 358955n, 364889n,
    370727n, 376475n, 382137n, 387717n, 393216n, 398640n, 403991n, 409273n,
    414487n, 419635n, 424721n, 429749n, 434717n, 439629n, 444487n, 449293n,
    454047n, 458752n, 463409n, 468021n, 472587n, 477109n, 481589n, 486028n,
    490427n, 494786n, 499107n, 503391n, 507639n, 511853n, 516031n, 520175n,
    524289n, 528369n, 532417n, 536435n, 540423n, 544383n, 548313n, 552217n,
    556091n, 559939n, 563762n, 567559n, 571329n, 575077n, 578799n, 582497n,
    586171n, 589824n, 593453n, 597061n, 600647n, 604213n, 607755n, 611279n,
    614783n, 618265n, 621729n, 625173n, 628599n, 632007n, 635395n, 638765n,
    642119n, 645455n, 648773n, 652075n, 655360n, 658629n, 661881n, 665117n,
    668339n, 671545n, 674735n, 677909n, 681071n, 684215n, 687347n, 690465n,
    693567n, 696657n, 699733n, 702795n, 705845n, 708881n, 711903n, 714913n,
    717911n, 720896n, 723869n, 726829n, 729779n, 732715n, 735639n, 738553n,
];

/**
 * Fixed-point square root using bisection.
 *
 * Mirrors `fp_sqrt()` from Math.c.
 */
export function fpSqrt(u: Fixpt): Fixpt {
    if (u < 0n) return -fpSqrt(-u);

    // Check if u is a small integer (0..127)
    const FP_BASE_BIG = BigInt(FP_BASE);
    if ((u & (127n << FP_BASE_BIG)) === u) {
        return SQUARE_ROOTS[Number(u >> FP_BASE_BIG)];
    }

    // Find k such that 2^(k-1) <= u < 2^k
    const k = msbpos(u) - FP_BASE;

    let x = 0n;
    let upper = fpExp2(Math.floor((k + (k > 0 ? 1 : 0)) / 2));
    let lower = upper / 2n;

    while (upper !== lower + 1n) {
        x = (upper + lower) / 2n;
        const fx = fpMul(x, x) - u;

        if (fx === 0n) {
            break;
        } else if (fx > 0n) {
            upper = x;
        } else {
            lower = x;
        }
    }

    return x;
}

/**
 * Fixed-point exponentiation: base^expn.
 *
 * Mirrors `fp_pow()` from Math.c.
 */
export function fpPow(base: Fixpt, expn: number): Fixpt {
    if (base === 0n) return 0n;

    let b = base;
    let e = expn;

    if (e < 0) {
        b = fpDiv(FP_FACTOR, b);
        e = -e;
    }

    let res = FP_FACTOR;
    let err = 0n;

    while (e-- > 0) {
        res = res * b + (err * b) / FP_FACTOR;
        err = res % FP_FACTOR;
        res = res / FP_FACTOR;
    }

    return res + fpRound(err);
}
