/*
 *  light-verification.test.ts — Direct tests for the 5 NEEDS-VERIFICATION Light.c functions
 *  brogue-ts
 *
 *  Adds coverage for: updateMinersLightRadius, updateLighting, createFlare,
 *  drawFlareFrame, animateFlares — all verified against Light.c (src/brogue/Light.c).
 *
 *  Each function is confirmed to match the C source; see docs/audit/gaps-Light.md.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DCOLS, DROWS } from "../src/types/constants.js";
import { TileFlag } from "../src/types/flags.js";
import { FP_FACTOR } from "../src/math/fixpt.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import type { Tcell, Pcell, LightSource } from "../src/types/types.js";
import { TileType, LightType, StatusEffect } from "../src/types/enums.js";

import {
    updateMinersLightRadius,
    updateLighting,
    type LightingContext,
} from "../src/light/light.js";

import {
    createFlare,
    drawFlareFrame,
    animateFlares,
    newFlare,
    type FlareAnimationCallbacks,
} from "../src/light/flares.js";

// =============================================================================
// Shared test helpers
// =============================================================================

function makeTmap(): Tcell[][] {
    const tmap: Tcell[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        tmap[i] = new Array(DROWS);
        for (let j = 0; j < DROWS; j++) {
            tmap[i][j] = { light: [0, 0, 0], oldLight: [0, 0, 0] };
        }
    }
    return tmap;
}

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = new Array(DROWS);
        for (let j = 0; j < DROWS; j++) {
            pmap[i][j] = {
                layers: [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: {
                    character: 0,
                    foreColorComponents: [0, 0, 0],
                    backColorComponents: [0, 0, 0],
                    opacity: 0,
                },
                rememberedItemCategory: 0,
                rememberedItemKind: 0,
                rememberedItemQuantity: 0,
                rememberedItemOriginDepth: 0,
                rememberedTerrain: TileType.NOTHING,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                exposedToFire: 0,
            };
        }
    }
    return pmap;
}

function makeGrid(fill = 0): number[][] {
    const g: number[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) g[i] = new Array(DROWS).fill(fill);
    return g;
}

/** Zero-emission light source: radius 0, color all-zeros. */
const zeroLight: LightSource = {
    lightColor: {
        red: 0, green: 0, blue: 0,
        redRand: 0, greenRand: 0, blueRand: 0,
        rand: 0, colorDances: false,
    },
    lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
    radialFadeToPercent: 0,
    passThroughCreatures: true,
};

/**
 * Minimal LightingContext for updateLighting / drawFlareFrame / animateFlares tests.
 * No glowing tiles, no monsters, no mutations.
 * Miner's light uses zero radius and zero color so paintLight is a no-op.
 */
function makeMinimalCtx(): LightingContext {
    const tmap = makeTmap();
    const pmap = makePmap();
    const displayDetail = makeGrid(0);

    // Tile catalog: all tiles have glowLight = NO_LIGHT (falsy → no painting)
    const tileCatalog = new Array(256).fill({ glowLight: LightType.NO_LIGHT });
    const lightCatalog: readonly LightSource[] = new Array(256).fill(zeroLight);
    const mutationCatalog = new Array(16).fill({ light: LightType.NO_LIGHT });

    const player = {
        loc: { x: 40, y: 15 },
        info: { foreColor: null, flags: 0, intrinsicLightType: LightType.NO_LIGHT },
        mutationIndex: -1,
        status: new Array(100).fill(0),
        maxStatus: new Array(100).fill(0),
    };

    const rogue = {
        minersLightRadius: 0n,
        lightMultiplier: 1,
        inWater: false,
        minersLight: { ...zeroLight },
        absoluteTurnNumber: 100,
        trueColorMode: false,
        playbackFastForward: false,
        playbackOmniscience: false,
    };

    return {
        tmap, pmap, displayDetail,
        player, rogue,
        monsters: [],
        dormantMonsters: [],
        lightCatalog, tileCatalog, mutationCatalog,
        monsterRevealed: () => false,
        cellHasTerrainFlag: () => false,
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    } as unknown as LightingContext;
}

// =============================================================================
// updateMinersLightRadius
// C source: Light.c:120–154
// TS port:  light/light.ts:269–316
// =============================================================================

describe("updateMinersLightRadius", () => {
    // Helper to build a minimal rogue-like object for the function
    function makeRogue(overrides: Record<string, unknown> = {}) {
        return {
            minersLightRadius: 5n * FP_FACTOR,
            lightMultiplier: 1,
            inWater: false,
            minersLight: {
                lightColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
                lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            },
            ...overrides,
        } as unknown as Parameters<typeof updateMinersLightRadius>[0];
    }

    function makePlayer(darkStatus = 0, maxDarkStatus = 0) {
        const status = new Array(100).fill(0);
        const maxStatus = new Array(100).fill(0);
        status[StatusEffect.Darkness] = darkStatus;
        maxStatus[StatusEffect.Darkness] = maxDarkStatus;
        return { status, maxStatus } as unknown as Parameters<typeof updateMinersLightRadius>[1];
    }

    it("lightMultiplier=1: radius = 100 * minersLightRadius (clamped)", () => {
        // 100 * 5 * FP_FACTOR * 1 / FP_FACTOR = 500
        const rogue = makeRogue();
        updateMinersLightRadius(rogue, makePlayer());
        expect(rogue.minersLight.lightRadius.lowerBound).toBe(500);
        expect(rogue.minersLight.lightRadius.upperBound).toBe(500);
    });

    it("lightMultiplier=1: radialFadeToPercent = 35 + min(65, lightMultiplier*5)", () => {
        // 35 + max(0, min(65, 1*5)) * 1 = 35 + 5 = 40
        const rogue = makeRogue();
        updateMinersLightRadius(rogue, makePlayer());
        expect(rogue.minersLight.radialFadeToPercent).toBe(40);
    });

    it("negative lightMultiplier divides radius by (-mult+1)", () => {
        // lightMultiplier=-2: lightRadius / (-1*-2+1) = 500*FP_FACTOR / 3 → /FP_FACTOR = 166
        const rogue = makeRogue({ lightMultiplier: -2 });
        updateMinersLightRadius(rogue, makePlayer());
        expect(rogue.minersLight.lightRadius.lowerBound).toBe(166);
        // radialFadeToPercent: max(0, min(65, -2*5)) = max(0,-10) = 0 → 35+0=35
        expect(rogue.minersLight.radialFadeToPercent).toBe(35);
    });

    it("inWater halves radius (min 3)", () => {
        // 100 * 10 * FP_FACTOR / FP_FACTOR = 1000 → /2 = 500 (> 3, stays 500)
        const rogue = makeRogue({ minersLightRadius: 10n * FP_FACTOR, inWater: true });
        updateMinersLightRadius(rogue, makePlayer());
        expect(rogue.minersLight.lightRadius.lowerBound).toBe(500);
    });

    it("lightMultiplier=0: radius floor is 2 (minimum light)", () => {
        // *= 0 → 0; max(0, 2*FP_FACTOR) → 2*FP_FACTOR; /FP_FACTOR = 2
        const rogue = makeRogue({ lightMultiplier: 0 });
        updateMinersLightRadius(rogue, makePlayer());
        expect(rogue.minersLight.lightRadius.lowerBound).toBe(2);
        expect(rogue.minersLight.radialFadeToPercent).toBe(35);
    });
});

// =============================================================================
// updateLighting
// C source: Light.c:208–281
// TS port:  light/light.ts:383–477
// =============================================================================

describe("updateLighting", () => {
    beforeEach(() => { seedRandomGenerator(42n); });

    it("records old lights before zeroing", () => {
        const ctx = makeMinimalCtx();
        ctx.tmap[5][5].light = [50, 70, 30];

        updateLighting(ctx);

        // oldLight should capture the pre-zero values (recordOldLights called first)
        expect(ctx.tmap[5][5].oldLight).toEqual([50, 70, 30]);
    });

    it("zeroes all light before painting", () => {
        const ctx = makeMinimalCtx();
        ctx.tmap[20][10].light = [100, 100, 100];

        updateLighting(ctx);

        // No glow sources, miner's light is zero-radius → cell stays at 0
        expect(ctx.tmap[20][10].light[0]).toBe(0);
        expect(ctx.tmap[20][10].light[1]).toBe(0);
        expect(ctx.tmap[20][10].light[2]).toBe(0);
    });

    it("sets IS_IN_SHADOW on all cells (miner's light maintainShadows=true)", () => {
        const ctx = makeMinimalCtx();
        // Clear IS_IN_SHADOW to ensure the function sets it
        ctx.pmap[10][10].flags &= ~TileFlag.IS_IN_SHADOW;
        ctx.pmap[50][20].flags &= ~TileFlag.IS_IN_SHADOW;

        updateLighting(ctx);

        // paintLight for miner's light is called with maintainShadows=true → no shadow dispel
        expect(ctx.pmap[10][10].flags & TileFlag.IS_IN_SHADOW).not.toBe(0);
        expect(ctx.pmap[50][20].flags & TileFlag.IS_IN_SHADOW).not.toBe(0);
    });

    it("updates player foreColor based on lighting state", () => {
        const ctx = makeMinimalCtx();

        updateLighting(ctx);

        // With no light sources, all cells are dark:
        // light[i]+10 = 10, minersLightColor.red = 180 → playerInDarkness → foreColor set
        expect(ctx.player.info.foreColor).not.toBeNull();
    });
});

// =============================================================================
// createFlare
// C source: Light.c:308–319
// TS port:  light/flares.ts:82–91
// =============================================================================

describe("createFlare", () => {
    const testLight: LightSource = {
        lightColor: {
            red: 100, green: 50, blue: 25,
            redRand: 0, greenRand: 0, blueRand: 0,
            rand: 0, colorDances: false,
        },
        lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
        radialFadeToPercent: 0,
        passThroughCreatures: true,
    };

    it("appends a fading flare to rogue.flares with correct defaults", () => {
        const lightCatalog = new Array(256).fill(null) as (LightSource | null)[];
        lightCatalog[LightType.BURNING_CREATURE_LIGHT] = testLight;
        const rogue = { flares: [] as unknown[], absoluteTurnNumber: 42 } as unknown as Parameters<typeof createFlare>[3];

        createFlare(10, 15, LightType.BURNING_CREATURE_LIGHT, rogue, lightCatalog as readonly LightSource[]);

        const flares = (rogue as unknown as { flares: ReturnType<typeof newFlare>[] }).flares;
        expect(flares).toHaveLength(1);
        expect(flares[0].loc).toEqual({ x: 10, y: 15 });
        expect(flares[0].coeffChangeAmount).toBe(-15);   // standard fade rate
        expect(flares[0].coeff).toBe(100 * 1000);         // initial full intensity
        expect(flares[0].coeffLimit).toBe(0);             // fades to 0
        expect(flares[0].turnNumber).toBe(42);
    });

    it("appends multiple flares independently", () => {
        const lightCatalog: readonly LightSource[] = new Array(256).fill(zeroLight);
        const rogue = { flares: [], absoluteTurnNumber: 1 } as unknown as Parameters<typeof createFlare>[3];

        createFlare(1, 2, LightType.NO_LIGHT, rogue, lightCatalog);
        createFlare(3, 4, LightType.NO_LIGHT, rogue, lightCatalog);

        expect((rogue as unknown as { flares: unknown[] }).flares).toHaveLength(2);
    });
});

// =============================================================================
// drawFlareFrame
// C source: Light.c:351–366
// TS port:  light/flares.ts:145–165
// =============================================================================

describe("drawFlareFrame", () => {
    beforeEach(() => { seedRandomGenerator(99n); });

    it("returns false for an expired flare (coeff below limit)", () => {
        const flare = newFlare(zeroLight, 40, 15, -15, 0, 100);
        // Force coeff to -1000: coeff/FLARE_PRECISION = -1 < limit (0) → inactive
        flare.coeff = -1000;
        const ctx = makeMinimalCtx();

        expect(drawFlareFrame(flare, 100, ctx)).toBe(false);
    });

    it("adds light at the source cell when active", () => {
        const brightLight: LightSource = {
            lightColor: { red: 100, green: 50, blue: 25, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 },
            radialFadeToPercent: 0,
            passThroughCreatures: true,
        };
        const flare = newFlare(brightLight, 40, 15, -15, 0, 100);
        const ctx = makeMinimalCtx();

        drawFlareFrame(flare, 100, ctx);

        // paintLight always adds colorComponents to the source cell
        expect(ctx.tmap[40][15].light[0]).toBeGreaterThan(0);
    });

    it("scales both radius and color by coeff (half coeff → half light at source)", () => {
        // Use a deterministic light with no random variation
        const detLight: LightSource = {
            lightColor: { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 0 },
            radialFadeToPercent: 0,
            passThroughCreatures: true,
        };

        // Full intensity (coeff = 100*1000): applyColorScalar(color, 100) → red=100
        // Source cell gets +100 (getFOVMask doesn't set origin, so only the direct add)
        const flareFull = newFlare(detLight, 40, 15, -15, 0, 100);
        const ctxFull = makeMinimalCtx();
        seedRandomGenerator(7n);
        drawFlareFrame(flareFull, 100, ctxFull);

        // Half intensity (coeff = 50*1000): applyColorScalar(color, 50) → red=50
        const flareHalf = newFlare(detLight, 40, 15, -15, 0, 100);
        flareHalf.coeff = 50 * 1000;
        const ctxHalf = makeMinimalCtx();
        seedRandomGenerator(7n);
        drawFlareFrame(flareHalf, 100, ctxHalf);

        expect(ctxFull.tmap[40][15].light[0]).toBe(100);
        expect(ctxHalf.tmap[40][15].light[0]).toBe(50);
    });
});

// =============================================================================
// animateFlares
// C source: Light.c:369–404
// TS port:  light/flares.ts:195–242
// =============================================================================

describe("animateFlares", () => {
    beforeEach(() => { seedRandomGenerator(1n); });

    it("calls demoteVisibility and updateFieldOfViewDisplay each animation frame", async () => {
        const flare = newFlare(zeroLight, 40, 15, -15, 0, 100);
        let demoteCount = 0;
        let updateFOVCount = 0;
        const callbacks: FlareAnimationCallbacks = {
            demoteVisibility: () => { demoteCount++; },
            updateFieldOfViewDisplay: () => { updateFOVCount++; },
            pauseAnimation: () => false,
        };

        const ctx = makeMinimalCtx();
        await animateFlares([flare], ctx, callbacks);

        // Loop calls demoteVisibility once per frame + final updateFieldOfViewDisplay after loop
        expect(demoteCount).toBeGreaterThanOrEqual(1);
        expect(updateFOVCount).toBeGreaterThanOrEqual(2); // ≥1 loop iterations + 1 final call
    });

    it("sets expired flares to null in the array", async () => {
        const flare = newFlare(zeroLight, 40, 15, -15, 0, 100);
        const flareArr: (typeof flare | null)[] = [flare];
        const callbacks: FlareAnimationCallbacks = {
            demoteVisibility: () => {},
            updateFieldOfViewDisplay: () => {},
            pauseAnimation: () => false,
        };

        const ctx = makeMinimalCtx();
        await animateFlares(flareArr, ctx, callbacks);

        // All flares expired → entries set to null
        expect(flareArr[0]).toBeNull();
    });

    it("fast-forward mode (trueColorMode) never calls pauseAnimation", async () => {
        const flare = newFlare(zeroLight, 40, 15, -15, 0, 100);
        let pauseCount = 0;
        const callbacks: FlareAnimationCallbacks = {
            demoteVisibility: () => {},
            updateFieldOfViewDisplay: () => {},
            pauseAnimation: () => { pauseCount++; return false; },
        };

        const ctx = makeMinimalCtx();
        (ctx.rogue as unknown as { trueColorMode: boolean }).trueColorMode = true;
        await animateFlares([flare], ctx, callbacks);

        expect(pauseCount).toBe(0);
    });

    it("restores lighting to backup after each frame", async () => {
        // Set a non-zero light value and verify it's restored after animation
        const flare = newFlare(zeroLight, 40, 15, -15, 0, 100);
        const callbacks: FlareAnimationCallbacks = {
            demoteVisibility: () => {},
            updateFieldOfViewDisplay: () => {},
            pauseAnimation: () => false,
        };

        const ctx = makeMinimalCtx();
        // Pre-set a sentinel light value at a far cell
        ctx.tmap[5][5].light = [77, 88, 99];
        const backup = [77, 88, 99];

        await animateFlares([flare], ctx, callbacks);

        // After animation, tmap is restored to pre-animation state
        expect(ctx.tmap[5][5].light).toEqual(backup);
    });
});
