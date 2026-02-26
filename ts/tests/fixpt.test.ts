/*
 *  fixpt.test.ts — Tests for fixed-point arithmetic port
 *  brogue-ts
 *
 *  Cross-validates against known C output.
 */

import { describe, it, expect } from "vitest";
import {
    FP_BASE,
    FP_FACTOR,
    fpFromInt,
    fpFromFloat,
    fpToFloat,
    fpMul,
    fpDiv,
    fpRound,
    fpFloor,
    fpSqrt,
    fpPow,
} from "../src/math/fixpt.js";

describe("FP constants", () => {
    it("FP_BASE is 16", () => {
        expect(FP_BASE).toBe(16);
    });

    it("FP_FACTOR is 2^16 = 65536", () => {
        expect(FP_FACTOR).toBe(65536n);
    });
});

describe("fpFromInt / fpToFloat", () => {
    it("converts 1 to FP_FACTOR", () => {
        expect(fpFromInt(1)).toBe(FP_FACTOR);
    });

    it("converts 0 to 0", () => {
        expect(fpFromInt(0)).toBe(0n);
    });

    it("round-trips integers", () => {
        for (const n of [-100, -1, 0, 1, 42, 1000]) {
            expect(fpToFloat(fpFromInt(n))).toBe(n);
        }
    });
});

describe("fpFromFloat", () => {
    it("converts 0.5 correctly", () => {
        expect(fpFromFloat(0.5)).toBe(FP_FACTOR / 2n);
    });

    it("converts negative values", () => {
        expect(fpFromFloat(-1.5)).toBe(-FP_FACTOR - FP_FACTOR / 2n);
    });
});

describe("fpMul", () => {
    it("1 * 1 = 1", () => {
        expect(fpMul(FP_FACTOR, FP_FACTOR)).toBe(FP_FACTOR);
    });

    it("2 * 3 = 6", () => {
        const two = fpFromInt(2);
        const three = fpFromInt(3);
        expect(fpMul(two, three)).toBe(fpFromInt(6));
    });

    it("0.5 * 0.5 = 0.25", () => {
        const half = FP_FACTOR / 2n;
        const quarter = FP_FACTOR / 4n;
        expect(fpMul(half, half)).toBe(quarter);
    });

    it("handles negative values", () => {
        const neg2 = fpFromInt(-2);
        const three = fpFromInt(3);
        expect(fpMul(neg2, three)).toBe(fpFromInt(-6));
    });
});

describe("fpDiv", () => {
    it("6 / 2 = 3", () => {
        expect(fpDiv(fpFromInt(6), fpFromInt(2))).toBe(fpFromInt(3));
    });

    it("1 / 2 = 0.5", () => {
        expect(fpDiv(FP_FACTOR, fpFromInt(2))).toBe(FP_FACTOR / 2n);
    });

    it("1 / 3 ≈ 0.333...", () => {
        const result = fpToFloat(fpDiv(FP_FACTOR, fpFromInt(3)));
        expect(result).toBeCloseTo(1 / 3, 4);
    });
});

describe("fpRound", () => {
    it("rounds 0.5 up", () => {
        expect(fpRound(FP_FACTOR / 2n)).toBe(1n);
    });

    it("rounds 0.4 down", () => {
        // 0.4 * 65536 ≈ 26214
        expect(fpRound(26214n)).toBe(0n);
    });

    it("rounds -0.5 down", () => {
        expect(fpRound(-FP_FACTOR / 2n)).toBe(-1n);
    });

    it("rounds exact integers to themselves", () => {
        expect(fpRound(fpFromInt(5))).toBe(5n);
        expect(fpRound(fpFromInt(-3))).toBe(-3n);
    });
});

describe("fpFloor", () => {
    it("truncates toward zero", () => {
        expect(fpFloor(fpFromInt(5) + FP_FACTOR / 2n)).toBe(5n);
        expect(fpFloor(fpFromInt(-5) - FP_FACTOR / 2n)).toBe(-5n);
    });
});

describe("fpSqrt", () => {
    it("sqrt(0) = 0", () => {
        expect(fpSqrt(0n)).toBe(0n);
    });

    it("sqrt(1) = 1", () => {
        expect(fpSqrt(FP_FACTOR)).toBe(FP_FACTOR);
    });

    it("sqrt(4) ≈ 2 (matches C lookup table)", () => {
        // C SQUARE_ROOTS[4] = 131073 (off-by-one from exact 2.0 = 131072)
        expect(fpSqrt(fpFromInt(4))).toBe(131073n);
        expect(fpToFloat(fpSqrt(fpFromInt(4)))).toBeCloseTo(2, 4);
    });

    it("sqrt(9) = 3", () => {
        // C produces 196608 = 3 * 65536
        expect(fpSqrt(fpFromInt(9))).toBe(fpFromInt(3));
    });

    it("sqrt(100) = 10", () => {
        expect(fpSqrt(fpFromInt(100))).toBe(fpFromInt(10));
    });

    it("sqrt(2) ≈ 1.4142", () => {
        const result = fpToFloat(fpSqrt(fpFromInt(2)));
        expect(result).toBeCloseTo(Math.sqrt(2), 3);
    });

    it("sqrt(127) from lookup table matches", () => {
        // C: SQUARE_ROOTS[127] = 738553
        expect(fpSqrt(fpFromInt(127))).toBe(738553n);
    });

    it("sqrt of negative returns negative", () => {
        const neg4 = fpFromInt(-4);
        // Mirrors C: -SQUARE_ROOTS[4] = -131073
        expect(fpSqrt(neg4)).toBe(-131073n);
    });

    it("sqrt of large value is accurate", () => {
        const large = fpFromInt(10000);
        const result = fpToFloat(fpSqrt(large));
        expect(result).toBeCloseTo(100, 1);
    });
});

describe("fpPow", () => {
    it("base^0 = 1", () => {
        expect(fpPow(fpFromInt(5), 0)).toBe(FP_FACTOR);
    });

    it("base^1 = base", () => {
        expect(fpPow(fpFromInt(5), 1)).toBe(fpFromInt(5));
    });

    it("2^10 = 1024", () => {
        expect(fpPow(fpFromInt(2), 10)).toBe(fpFromInt(1024));
    });

    it("3^3 = 27", () => {
        expect(fpPow(fpFromInt(3), 3)).toBe(fpFromInt(27));
    });

    it("0^n = 0", () => {
        expect(fpPow(0n, 5)).toBe(0n);
    });

    it("2^-1 = 0.5", () => {
        const result = fpPow(fpFromInt(2), -1);
        expect(result).toBe(FP_FACTOR / 2n);
    });

    it("2^-3 = 0.125", () => {
        const result = fpToFloat(fpPow(fpFromInt(2), -3));
        expect(result).toBeCloseTo(0.125, 4);
    });

    it("handles fractional base", () => {
        // (1.5)^2 = 2.25
        const onePointFive = FP_FACTOR + FP_FACTOR / 2n;
        const result = fpToFloat(fpPow(onePointFive, 2));
        expect(result).toBeCloseTo(2.25, 3);
    });
});
