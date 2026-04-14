/*
 *  tests/menus/machine-debug.test.ts — Machine debug blueprint boost tests
 *  Port V2 — rogue-ts
 *
 *  Covers:
 *   - getDebugBlueprintCatalog: passthrough when no boosts selected
 *   - getDebugBlueprintCatalog: boosts frequency and depthRange[0] for selected indices
 *   - Unselected blueprints are not modified
 *   - Index 0 (dummy) is never modified
 */

import { describe, it, expect, beforeEach } from "vitest";
import { boostedBlueprints, getDebugBlueprintCatalog } from "../../src/menus/machine-debug.js";
import type { Blueprint } from "../../src/types/types.js";

function makeCatalog(count: number): Blueprint[] {
    return Array.from({ length: count }, (_, i) => ({
        name: `Blueprint ${i}`,
        depthRange: [5, 20] as [number, number],
        roomSize: [10, 30] as [number, number],
        frequency: 10,
        featureCount: 0,
        dungeonProfileType: 0 as any,
        flags: 0,
        feature: [],
    }));
}

beforeEach(() => {
    boostedBlueprints.clear();
});

describe("getDebugBlueprintCatalog", () => {
    it("returns the same catalog reference when no blueprints are boosted", () => {
        const catalog = makeCatalog(5);
        const result = getDebugBlueprintCatalog(catalog);
        expect(result).toBe(catalog);
    });

    it("boosts frequency and depthRange[0] for a selected index", () => {
        const catalog = makeCatalog(5);
        boostedBlueprints.add(2);
        const result = getDebugBlueprintCatalog(catalog);
        expect(result[2].frequency).toBeGreaterThan(catalog[2].frequency);
        expect(result[2].depthRange[0]).toBe(1);
    });

    it("preserves depthRange[1] for boosted blueprints", () => {
        const catalog = makeCatalog(5);
        boostedBlueprints.add(3);
        const result = getDebugBlueprintCatalog(catalog);
        expect(result[3].depthRange[1]).toBe(catalog[3].depthRange[1]);
    });

    it("does not modify unselected blueprints", () => {
        const catalog = makeCatalog(5);
        boostedBlueprints.add(1);
        const result = getDebugBlueprintCatalog(catalog);
        // Index 2, 3, 4 are unmodified
        expect(result[2]).toBe(catalog[2]);
        expect(result[3]).toBe(catalog[3]);
        expect(result[4]).toBe(catalog[4]);
    });

    it("never modifies index 0 (dummy blueprint)", () => {
        const catalog = makeCatalog(5);
        boostedBlueprints.add(0); // should be ignored
        const result = getDebugBlueprintCatalog(catalog);
        expect(result[0]).toBe(catalog[0]);
    });

    it("returns a new array (not the same reference) when boosts are active", () => {
        const catalog = makeCatalog(5);
        boostedBlueprints.add(1);
        const result = getDebugBlueprintCatalog(catalog);
        expect(result).not.toBe(catalog);
    });

    it("catalog length is unchanged after boost", () => {
        const catalog = makeCatalog(72);
        boostedBlueprints.add(5);
        boostedBlueprints.add(30);
        const result = getDebugBlueprintCatalog(catalog);
        expect(result.length).toBe(catalog.length);
    });
});
