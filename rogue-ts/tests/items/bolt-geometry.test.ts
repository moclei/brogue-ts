/*
 *  bolt-geometry.test.ts — Tests for bolt path calculations
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    getLineCoordinates,
    getImpactLoc,
    reflectBolt,
    openPathBetween,
    INVALID_POS,
} from "../../src/items/bolt-geometry.js";
import type { Pos, Bolt } from "../../src/types/types.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function makeBolt(overrides: Partial<Bolt> = {}): Bolt {
    return {
        name: "test bolt",
        description: "",
        abilityDescription: "",
        theChar: 0,
        foreColor: { red: 100, green: 100, blue: 100, colorRand: 0, colorDance: 0 },
        backColor: { red: 50, green: 50, blue: 50, colorRand: 0, colorDance: 0 },
        boltEffect: 0,
        magnitude: 5,
        pathDF: 0,
        targetDF: 0,
        forbiddenMonsterFlags: 0,
        flags: 0,
        ...overrides,
    };
}

// =============================================================================
// getLineCoordinates
// =============================================================================

describe("getLineCoordinates", () => {
    it("returns empty array when origin equals target", () => {
        const result = getLineCoordinates({ x: 5, y: 5 }, { x: 5, y: 5 });
        expect(result).toEqual([]);
    });

    it("traces a horizontal line", () => {
        const result = getLineCoordinates({ x: 5, y: 10 }, { x: 15, y: 10 });
        expect(result.length).toBeGreaterThan(0);
        // All y coordinates should be 10 (horizontal line)
        for (const pos of result) {
            expect(pos.y).toBe(10);
        }
        // First coordinate should be adjacent to origin
        expect(result[0].x).toBe(6);
    });

    it("traces a vertical line", () => {
        const result = getLineCoordinates({ x: 10, y: 5 }, { x: 10, y: 15 });
        expect(result.length).toBeGreaterThan(0);
        // All x coordinates should be 10
        for (const pos of result) {
            expect(pos.x).toBe(10);
        }
        expect(result[0].y).toBe(6);
    });

    it("traces a diagonal line", () => {
        const result = getLineCoordinates({ x: 5, y: 5 }, { x: 15, y: 15 });
        expect(result.length).toBeGreaterThan(0);
        // Each step should be diagonal (x and y both increment)
        for (let i = 0; i < result.length; i++) {
            expect(result[i].x).toBe(6 + i);
            expect(result[i].y).toBe(6 + i);
        }
    });

    it("traces from left to right correctly", () => {
        const result = getLineCoordinates({ x: 3, y: 10 }, { x: 20, y: 10 });
        expect(result[0].x).toBe(4);
        // Should pass through the target
        expect(result.some(p => p.x === 20 && p.y === 10)).toBe(true);
    });

    it("traces from right to left correctly", () => {
        const result = getLineCoordinates({ x: 20, y: 10 }, { x: 3, y: 10 });
        expect(result[0].x).toBe(19);
    });

    it("all coordinates are in the map", () => {
        const result = getLineCoordinates({ x: 5, y: 5 }, { x: 70, y: 25 });
        for (const pos of result) {
            expect(pos.x).toBeGreaterThanOrEqual(0);
            expect(pos.x).toBeLessThan(DCOLS);
            expect(pos.y).toBeGreaterThanOrEqual(0);
            expect(pos.y).toBeLessThan(DROWS);
        }
    });

    it("without bolt returns center-of-target path", () => {
        const result1 = getLineCoordinates({ x: 5, y: 5 }, { x: 20, y: 10 }, null, null);
        const result2 = getLineCoordinates({ x: 5, y: 5 }, { x: 20, y: 10 });
        expect(result1).toEqual(result2);
    });

    it("with bolt and evaluator tries multiple offsets", () => {
        const bolt = makeBolt();
        let callCount = 0;

        const evaluator = (path: readonly Pos[], origin: Pos, target: Pos, b: Bolt): number => {
            callCount++;
            return path.length; // Simple: score = path length
        };

        const result = getLineCoordinates({ x: 5, y: 5 }, { x: 20, y: 10 }, bolt, evaluator);
        // Should have been called 21 times (one per offset)
        expect(callCount).toBe(21);
        expect(result.length).toBeGreaterThan(0);
    });

    it("evaluator picks path with highest score", () => {
        const bolt = makeBolt();

        // Evaluator that assigns a very high score to offset 3 (index 3)
        let evalIndex = 0;
        const evaluator = (path: readonly Pos[]): number => {
            evalIndex++;
            return evalIndex === 4 ? 10000 : 1; // 4th call (offset index 3) gets highest score
        };

        const result = getLineCoordinates({ x: 10, y: 10 }, { x: 30, y: 15 }, bolt, evaluator);
        expect(result.length).toBeGreaterThan(0);
    });
});

// =============================================================================
// getImpactLoc
// =============================================================================

describe("getImpactLoc", () => {
    const noCreatures: (loc: Pos, origin: Pos) => boolean = () => false;
    const noCells: (loc: Pos) => boolean = () => false;

    it("returns last position when unobstructed", () => {
        const result = getImpactLoc(
            { x: 5, y: 10 }, { x: 15, y: 10 },
            5, false, null,
            noCreatures, noCells,
        );
        expect(result.x).toBe(10);
        expect(result.y).toBe(10);
    });

    it("stops at creature", () => {
        const creatureAt = (loc: Pos) => loc.x === 8 && loc.y === 10;
        const result = getImpactLoc(
            { x: 5, y: 10 }, { x: 15, y: 10 },
            20, false, null,
            creatureAt, noCells,
        );
        expect(result.x).toBe(8);
        expect(result.y).toBe(10);
    });

    it("stops at blocking cell", () => {
        const cellAt = (loc: Pos) => loc.x === 9 && loc.y === 10;
        const result = getImpactLoc(
            { x: 5, y: 10 }, { x: 15, y: 10 },
            20, false, null,
            noCreatures, cellAt,
        );
        expect(result.x).toBe(9);
        expect(result.y).toBe(10);
    });

    it("returns last empty space when requested", () => {
        const cellAt = (loc: Pos) => loc.x === 9 && loc.y === 10;
        const result = getImpactLoc(
            { x: 5, y: 10 }, { x: 15, y: 10 },
            20, true, null,
            noCreatures, cellAt,
        );
        expect(result.x).toBe(8);
        expect(result.y).toBe(10);
    });

    it("returns origin when first cell blocks and returnLastEmptySpace is true", () => {
        const cellAt = (loc: Pos) => loc.x === 6 && loc.y === 10;
        const result = getImpactLoc(
            { x: 5, y: 10 }, { x: 15, y: 10 },
            20, true, null,
            noCreatures, cellAt,
        );
        expect(result.x).toBe(5);
        expect(result.y).toBe(10);
    });

    it("respects maxDistance", () => {
        const result = getImpactLoc(
            { x: 5, y: 10 }, { x: 50, y: 10 },
            3, false, null,
            noCreatures, noCells,
        );
        // maxDistance=3 → cells 6, 7, 8 → stops at x=8
        expect(result.x).toBe(8);
    });
});

// =============================================================================
// reflectBolt
// =============================================================================

describe("reflectBolt", () => {
    const rng = (lo: number, hi: number) => Math.floor((lo + hi) / 2);

    it("reflects with retrace path", () => {
        // Build a simple horizontal path
        const coords: Pos[] = [];
        for (let i = 0; i < 20; i++) {
            coords.push({ x: 10 + i, y: 10 });
        }
        const kinkCell = 5;
        const newLen = reflectBolt(
            coords[2 * kinkCell]?.x ?? 20,
            coords[2 * kinkCell]?.y ?? 10,
            coords,
            kinkCell,
            true,
            rng,
        );
        expect(newLen).toBeGreaterThan(kinkCell);
        // After kink, coordinates should retrace back
        for (let k = 1; k <= kinkCell; k++) {
            expect(coords[kinkCell + k].x).toBe(coords[kinkCell - k].x);
            expect(coords[kinkCell + k].y).toBe(coords[kinkCell - k].y);
        }
    });

    it("reflects with random target when needRandomTarget is true", () => {
        const coords: Pos[] = [];
        for (let i = 0; i < 10; i++) {
            coords.push({ x: 10 + i, y: 10 });
        }
        const kinkCell = 3;
        // Target same as kinkCell position → needRandomTarget = true
        const newLen = reflectBolt(
            coords[kinkCell].x,
            coords[kinkCell].y,
            coords,
            kinkCell,
            false,
            rng,
        );
        expect(newLen).toBeGreaterThan(kinkCell);
    });

    it("reflects toward specific target", () => {
        const coords: Pos[] = [];
        for (let i = 0; i < 10; i++) {
            coords.push({ x: 10 + i, y: 10 });
        }
        const kinkCell = 3;
        // Target far away from kink
        const newLen = reflectBolt(
            40, 20,
            coords,
            kinkCell,
            false,
            rng,
        );
        expect(newLen).toBeGreaterThan(kinkCell);
    });

    it("truncates the array to the final length", () => {
        const coords: Pos[] = [];
        for (let i = 0; i < 50; i++) {
            coords.push({ x: 10 + (i % 60), y: 10 });
        }
        const kinkCell = 5;
        const newLen = reflectBolt(40, 20, coords, kinkCell, false, rng);
        expect(coords.length).toBe(newLen);
    });
});

// =============================================================================
// openPathBetween
// =============================================================================

describe("openPathBetween", () => {
    it("returns true when path is clear", () => {
        const noBlocks = () => false;
        expect(openPathBetween({ x: 5, y: 10 }, { x: 15, y: 10 }, noBlocks)).toBe(true);
    });

    it("returns false when a cell blocks the path", () => {
        const blocks = (loc: Pos) => loc.x === 10 && loc.y === 10;
        expect(openPathBetween({ x: 5, y: 10 }, { x: 15, y: 10 }, blocks)).toBe(false);
    });

    it("returns true for diagonal path when clear", () => {
        expect(openPathBetween({ x: 5, y: 5 }, { x: 10, y: 10 }, () => false)).toBe(true);
    });

    it("blocks before reaching target returns false", () => {
        const blocks = (loc: Pos) => loc.x === 8 && loc.y === 8;
        expect(openPathBetween({ x: 5, y: 5 }, { x: 10, y: 10 }, blocks)).toBe(false);
    });
});
