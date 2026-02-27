/*
 *  globals.test.ts — Tests for color constants and direction tables
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import * as colors from "../src/globals/colors.js";
import {
    nbDirs,
    cDirs,
    POW_0_CHARM_INCREMENT,
    POW_120_CHARM_INCREMENT,
    POW_125_CHARM_INCREMENT,
    dynamicColorsBounds,
} from "../src/globals/tables.js";
import { NUMBER_DYNAMIC_COLORS } from "../src/types/constants.js";

describe("Base colors", () => {
    it("white is {100, 100, 100} with no randomness", () => {
        expect(colors.white.red).toBe(100);
        expect(colors.white.green).toBe(100);
        expect(colors.white.blue).toBe(100);
        expect(colors.white.redRand).toBe(0);
        expect(colors.white.greenRand).toBe(0);
        expect(colors.white.blueRand).toBe(0);
        expect(colors.white.rand).toBe(0);
        expect(colors.white.colorDances).toBe(false);
    });

    it("black is all zeros", () => {
        expect(colors.black.red).toBe(0);
        expect(colors.black.green).toBe(0);
        expect(colors.black.blue).toBe(0);
    });

    it("yellow has expected values", () => {
        expect(colors.yellow.red).toBe(100);
        expect(colors.yellow.green).toBe(100);
        expect(colors.yellow.blue).toBe(0);
    });
});

describe("Dynamic color effects (colorDances flag)", () => {
    it("discordColor has colorDances = true", () => {
        expect(colors.discordColor.colorDances).toBe(true);
    });

    it("descentBoltColor has colorDances = true", () => {
        expect(colors.descentBoltColor.colorDances).toBe(true);
    });
});

describe("Direction tables", () => {
    it("nbDirs has 8 entries (4 cardinal + 4 diagonal)", () => {
        expect(nbDirs.length).toBe(8);
    });

    it("first 4 nbDirs are cardinal directions", () => {
        // Up, Down, Left, Right
        const cardinals = nbDirs.slice(0, 4);
        for (const [dx, dy] of cardinals) {
            // Cardinal means one of dx, dy is 0 and the other is ±1
            expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
        }
    });

    it("last 4 nbDirs are diagonal directions", () => {
        const diagonals = nbDirs.slice(4, 8);
        for (const [dx, dy] of diagonals) {
            expect(Math.abs(dx)).toBe(1);
            expect(Math.abs(dy)).toBe(1);
        }
    });

    it("cDirs has 8 entries going clockwise", () => {
        expect(cDirs.length).toBe(8);
        // Starting from [0,1] and going clockwise
        expect(cDirs[0]).toEqual([0, 1]);
        expect(cDirs[1]).toEqual([1, 1]);
        expect(cDirs[2]).toEqual([1, 0]);
        expect(cDirs[3]).toEqual([1, -1]);
    });
});

describe("Charm increment tables", () => {
    it("POW_0_CHARM_INCREMENT has 51 entries all equal to FP_FACTOR", () => {
        expect(POW_0_CHARM_INCREMENT.length).toBe(51);
        for (const val of POW_0_CHARM_INCREMENT) {
            expect(val).toBe(65536n);
        }
    });

    it("POW_120_CHARM_INCREMENT has 51 entries and values increase", () => {
        expect(POW_120_CHARM_INCREMENT.length).toBe(51);
        // 1.2^1 * FP_FACTOR = 78643, values increase
        expect(POW_120_CHARM_INCREMENT[0]).toBe(78643n);
        expect(POW_120_CHARM_INCREMENT[1]).toBeGreaterThan(POW_120_CHARM_INCREMENT[0]);
    });

    it("POW_125_CHARM_INCREMENT has 51 entries and values increase", () => {
        expect(POW_125_CHARM_INCREMENT.length).toBe(51);
        // 1.25^1 * FP_FACTOR = 81920, values increase
        expect(POW_125_CHARM_INCREMENT[0]).toBe(81920n);
        expect(POW_125_CHARM_INCREMENT[1]).toBeGreaterThan(POW_125_CHARM_INCREMENT[0]);
    });
});

describe("Dynamic color bounds", () => {
    it("dynamicColorsBounds has NUMBER_DYNAMIC_COLORS entries", () => {
        expect(dynamicColorsBounds.length).toBe(NUMBER_DYNAMIC_COLORS);
    });

    it("each entry is a pair of Color objects", () => {
        for (const [shallow, deep] of dynamicColorsBounds) {
            expect(shallow).toHaveProperty("red");
            expect(shallow).toHaveProperty("green");
            expect(shallow).toHaveProperty("blue");
            expect(deep).toHaveProperty("red");
            expect(deep).toHaveProperty("green");
            expect(deep).toHaveProperty("blue");
        }
    });
});
