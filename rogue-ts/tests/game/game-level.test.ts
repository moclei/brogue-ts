/*
 *  game-level.test.ts — Unit tests for game-level.ts
 *  brogue-ts
 *
 *  Phase 4a NEEDS-VERIFICATION: updateColors
 *  Source: RogueMain.c:537–545
 *
 *  Note: startLevel is an orchestrator with IO dependencies (displayLevel,
 *  refreshSideBar, etc.) and a missing environment simulation loop.
 *  See test.skip entries below.
 */

import { describe, it, expect } from "vitest";
import { updateColors } from "../../src/game/game-level.js";
import type { LevelContext } from "../../src/game/game-level.js";
import { applyColorAverage } from "../../src/io/color.js";
import type { Color } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(red: number, green: number, blue: number): Color {
    return { red, green, blue, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makeUpdateColorsCtx(
    depthLevel: number,
    amuletLevel: number,
    dynamicColors: Color[],
    dynamicColorsBounds: readonly [Color, Color][],
): LevelContext {
    return {
        rogue: { depthLevel } as any,
        gameConst: { amuletLevel } as any,
        dynamicColors,
        dynamicColorsBounds,
        applyColorAverage,
        // Other fields unused by updateColors
        player: null as any,
        FP_FACTOR: 0n as any,
        levels: [],
        pmap: [],
        monsters: [],
        dormantMonsters: [],
        floorItems: [],
        setMonsters() {},
        setDormantMonsters() {},
        scentMap: null,
        setScentMap() {},
        levelFeelings: [],
        allocGrid() { return []; },
        fillGrid() {},
        freeGrid() {},
        seedRandomGenerator: () => 0n,
        rand_64bits: () => 0n,
        synchronizePlayerTimeState() {},
        cellHasTerrainFlag() { return false; },
        coordinatesAreInMap() { return false; },
        pmapAt() { return {} as any; },
        posNeighborInDirection() { return { x: 0, y: 0 }; },
        calculateDistances() {},
        pathingDistance() { return 0; },
        currentStealthRange() { return 0; },
        getQualifyingLocNear() { return { x: 0, y: 0 }; },
        getQualifyingPathLocNear() { return { x: 0, y: 0 }; },
        digDungeon() {},
        placeStairs() { return { success: false, upStairsLoc: { x: 0, y: 0 } }; },
        initializeLevel() {},
        setUpWaypoints() {},
        shuffleTerrainColors() {},
        numberOfMatchingPackItems() { return 0; },
        itemAtLoc() { return null; },
        describedItemName() { return ""; },
        generateItem() { return {} as any; },
        placeItemAt() {},
        restoreMonster() {},
        restoreItems() {},
        updateMonsterState() {},
        storeMemories() {},
        updateVision() {},
        discoverCell() {},
        updateMapToShore() {},
        updateRingBonuses() {},
        displayLevel() {},
        refreshSideBar() {},
        messageWithColor() {},
        RNGCheck() {},
        flushBufferToFile() {},
        deleteAllFlares() {},
        hideCursor() {},
        itemMessageColor: makeColor(0, 0, 0),
        nbDirs: [],
        clamp: (val, lo, hi) => Math.min(hi, Math.max(lo, val)),
    };
}

// =============================================================================
// updateColors — RogueMain.c:538
//
// C formula: weight = min(100, max(0, depthLevel * 100 / amuletLevel))
// For each dynamic color: copy start, then applyColorAverage(dc, end, weight)
// =============================================================================

describe("updateColors", () => {
    it("weight=0 (depth 0, amuletLevel=26): result equals start color", () => {
        const start = makeColor(50, 30, 10);
        const end = makeColor(0, 100, 0);
        const dc = makeColor(0, 0, 0);

        const ctx = makeUpdateColorsCtx(0, 26, [dc], [[start, end]]);
        updateColors(ctx);

        // At depth 0: weight = 0 → should be identical to start
        expect(dc.red).toBe(50);
        expect(dc.green).toBe(30);
        expect(dc.blue).toBe(10);
    });

    it("weight=100 (depth >= amuletLevel): result equals end color", () => {
        const start = makeColor(50, 30, 10);
        const end = makeColor(0, 100, 0);
        const dc = makeColor(0, 0, 0);

        // depth 26 / amuletLevel 26 = weight 100
        const ctx = makeUpdateColorsCtx(26, 26, [dc], [[start, end]]);
        updateColors(ctx);

        // At weight=100: applyColorAverage copies end color entirely
        expect(dc.red).toBe(0);
        expect(dc.green).toBe(100);
        expect(dc.blue).toBe(0);
    });

    it("intermediate depth: result is a blend", () => {
        const start = makeColor(100, 0, 0);
        const end = makeColor(0, 0, 100);
        const dc = makeColor(0, 0, 0);

        // depth 13 / amuletLevel 26 = 50% weight
        const ctx = makeUpdateColorsCtx(13, 26, [dc], [[start, end]]);
        updateColors(ctx);

        // applyColorAverage(dc, end, 50): dc starts as start, then blend by 50%
        // dc.red = trunc(100 * 50 / 100) = 50
        // dc.blue = trunc(0 * 50 + 100 * 50) / 100 = 50
        expect(dc.red).toBe(50);
        expect(dc.blue).toBe(50);
    });

    it("updates all dynamic colors in the array", () => {
        const dc1 = makeColor(0, 0, 0);
        const dc2 = makeColor(0, 0, 0);
        const start1 = makeColor(80, 0, 0);
        const end1 = makeColor(0, 80, 0);
        const start2 = makeColor(0, 0, 80);
        const end2 = makeColor(80, 80, 80);

        const ctx = makeUpdateColorsCtx(0, 26, [dc1, dc2], [[start1, end1], [start2, end2]]);
        updateColors(ctx);

        // weight=0: copy start colors
        expect(dc1.red).toBe(80);
        expect(dc2.blue).toBe(80);
    });

    it("clamps weight to 100 when depth exceeds amuletLevel", () => {
        const start = makeColor(100, 0, 0);
        const end = makeColor(0, 0, 100);
        const dc = makeColor(0, 0, 0);

        // depth 30 > amuletLevel 26 → weight clamped to 100
        const ctx = makeUpdateColorsCtx(30, 26, [dc], [[start, end]]);
        updateColors(ctx);

        expect(dc.red).toBe(0);
        expect(dc.blue).toBe(100);
    });
});

// =============================================================================
// startLevel — RogueMain.c:547
// DIVERGENCE: environment simulation loop stubbed
// =============================================================================

it.skip(
    "startLevel: environment simulation (updateEnvironment loop) is stubbed",
    () => {
        // UPDATE: known divergence — TS skips while(timeAway--) loop; fix note below.
        // C runs `while (timeAway--) { updateEnvironment(); }` (up to 100 iterations)
        // TS skips this loop entirely — no ctx.updateEnvironment call exists.
        // Result: terrain processes (swamp gas, brimstone, fire spread) do not
        // evolve during level transitions. Behavioral divergence from C.
        //
        // Fix: add updateEnvironment to LevelContext and call it in the loop:
        //   while (timeAway-- > 0) {
        //     rogue.absoluteTurnNumber = Math.max(currentTurnNumber, timeAway) - timeAway;
        //     ctx.updateEnvironment();
        //   }
        //   rogue.absoluteTurnNumber = currentTurnNumber;
    },
);
