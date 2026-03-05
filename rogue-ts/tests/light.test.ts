/*
 *  light.test.ts — Tests for the light module
 *  brogue-ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DCOLS, DROWS, LOS_SLOPE_GRANULARITY } from "../src/types/constants.js";
import { TileFlag, TerrainFlag } from "../src/types/flags.js";
import { FP_FACTOR } from "../src/math/fixpt.js";
import { seedRandomGenerator } from "../src/math/rng.js";
import type { Pos, Fixpt, Pcell, Tcell, LightSource, Color } from "../src/types/types.js";
import { TileType, LightType, StatusEffect, DisplayDetailValue } from "../src/types/enums.js";

import {
    betweenOctant1andN,
    scanOctantFOV,
    getFOVMask,
    type FOVContext,
} from "../src/light/fov.js";

import {
    paintLight,
    backUpLighting,
    restoreLighting,
    recordOldLights,
    updateDisplayDetail,
    playerInDarkness,
    createLightBackup,
    applyColorScalar,
    type LightingContext,
    type LightBackup,
} from "../src/light/light.js";

import {
    newFlare,
    flareIsActive,
    updateFlare,
    deleteAllFlares,
} from "../src/light/flares.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Create a fresh DCOLS×DROWS grid filled with the given value. */
function makeGrid(fill: number = 0): number[][] {
    const grid: number[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        grid[i] = new Array(DROWS).fill(fill);
    }
    return grid;
}

/** Create a mock Pcell grid with all cells set to FLOOR (open, no flags). */
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

/** Create a mock Tcell grid with all cells zeroed. */
function makeTmap(): Tcell[][] {
    const tmap: Tcell[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        tmap[i] = new Array(DROWS);
        for (let j = 0; j < DROWS; j++) {
            tmap[i][j] = {
                light: [0, 0, 0],
                oldLight: [0, 0, 0],
            };
        }
    }
    return tmap;
}

/** Create a simple FOVContext from a pmap (no terrain flags = open). */
function makeFOVContext(pmap: Pcell[][]): FOVContext {
    return {
        cellHasTerrainFlag: (_pos: Pos, _flagMask: number) => false,
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    };
}

/** Create a FOVContext that treats certain positions as walls. */
function makeFOVContextWithWalls(pmap: Pcell[][], wallSet: Set<string>): FOVContext {
    return {
        cellHasTerrainFlag: (pos: Pos, flagMask: number) => {
            if (wallSet.has(`${pos.x},${pos.y}`)) {
                // The wall blocks vision
                return (flagMask & TerrainFlag.T_OBSTRUCTS_VISION) !== 0;
            }
            return false;
        },
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    };
}

// =============================================================================
// betweenOctant1andN tests
// =============================================================================

describe("betweenOctant1andN", () => {
    // Using origin (10, 10) and a test point (12, 9), so dx=2, dy=-1
    const x0 = 10, y0 = 10;
    const x = 12, y = 9; // dx=2, dy=-1

    it("octant 1: identity", () => {
        expect(betweenOctant1andN(x, y, x0, y0, 1)).toEqual([12, 9]);
    });

    it("octant 2: reflect y across origin", () => {
        // y0 - dy = 10 - (-1) = 11
        expect(betweenOctant1andN(x, y, x0, y0, 2)).toEqual([12, 11]);
    });

    it("octant 3: x0 - dy, y0 + dx", () => {
        // x0 - (-1) = 11, y0 + 2 = 12
        expect(betweenOctant1andN(x, y, x0, y0, 3)).toEqual([11, 12]);
    });

    it("octant 4: x0 + dy, y0 + dx", () => {
        // x0 + (-1) = 9, y0 + 2 = 12
        expect(betweenOctant1andN(x, y, x0, y0, 4)).toEqual([9, 12]);
    });

    it("octant 5: reflect both", () => {
        // x0 - dx = 8, y0 - dy = 11
        expect(betweenOctant1andN(x, y, x0, y0, 5)).toEqual([8, 11]);
    });

    it("octant 6: reflect x across origin", () => {
        // x0 - dx = 8
        expect(betweenOctant1andN(x, y, x0, y0, 6)).toEqual([8, 9]);
    });

    it("octant 7: x0 + dy, y0 - dx", () => {
        // x0 + (-1) = 9, y0 - 2 = 8
        expect(betweenOctant1andN(x, y, x0, y0, 7)).toEqual([9, 8]);
    });

    it("octant 8: x0 - dy, y0 - dx", () => {
        // x0 - (-1) = 11, y0 - 2 = 8
        expect(betweenOctant1andN(x, y, x0, y0, 8)).toEqual([11, 8]);
    });

    it("all 8 octants produce 8 distinct points", () => {
        const points = new Set<string>();
        for (let n = 1; n <= 8; n++) {
            const [rx, ry] = betweenOctant1andN(x, y, x0, y0, n);
            points.add(`${rx},${ry}`);
        }
        expect(points.size).toBe(8);
    });
});

// =============================================================================
// getFOVMask tests
// =============================================================================

describe("getFOVMask", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        pmap = makePmap();
    });

    it("sees the origin cell's neighbors in an open map", () => {
        const grid = makeGrid();
        const ctx = makeFOVContext(pmap);
        const origin = { x: 40, y: 15 };

        getFOVMask(grid, origin.x, origin.y, 5n * FP_FACTOR, 0, 0, false, ctx);

        // Cells adjacent to origin should be visible
        expect(grid[41][15]).toBe(1);
        expect(grid[39][15]).toBe(1);
        expect(grid[40][14]).toBe(1);
        expect(grid[40][16]).toBe(1);
        // Diagonals too
        expect(grid[41][14]).toBe(1);
        expect(grid[39][16]).toBe(1);
    });

    it("does not see beyond the radius", () => {
        const grid = makeGrid();
        const ctx = makeFOVContext(pmap);
        const origin = { x: 40, y: 15 };
        const radius = 3n * FP_FACTOR;

        getFOVMask(grid, origin.x, origin.y, radius, 0, 0, false, ctx);

        // Cell at distance 4 should not be visible (beyond radius of 3)
        expect(grid[44][15]).toBe(0);
        expect(grid[36][15]).toBe(0);
    });

    it("walls block vision behind them", () => {
        const grid = makeGrid();
        const wallSet = new Set<string>();
        // Place a wall at (42, 15) — east of origin (40, 15)
        wallSet.add("42,15");
        const ctx = makeFOVContextWithWalls(pmap, wallSet);
        const origin = { x: 40, y: 15 };
        const radius = 10n * FP_FACTOR;

        getFOVMask(grid, origin.x, origin.y, radius, TerrainFlag.T_OBSTRUCTS_VISION, 0, false, ctx);

        // The wall itself should be visible
        expect(grid[42][15]).toBe(1);
        // Cells between origin and wall should be visible
        expect(grid[41][15]).toBe(1);
        // Cell directly behind the wall should not be visible
        expect(grid[43][15]).toBe(0);
    });

    it("origin cell is not set by getFOVMask (only scanned octants)", () => {
        const grid = makeGrid();
        const ctx = makeFOVContext(pmap);
        getFOVMask(grid, 40, 15, 5n * FP_FACTOR, 0, 0, false, ctx);
        // Note: the C code doesn't set the origin cell in getFOVMask itself;
        // updateVision sets it separately. The scanOctantFOV starts at column 1.
        expect(grid[40][15]).toBe(0);
    });

    it("with forbiddenFlags blocks cells with HAS_MONSTER", () => {
        const grid = makeGrid();
        // Place a "monster" at (41, 15)
        pmap[41][15].flags = TileFlag.HAS_MONSTER;
        const ctx = makeFOVContext(pmap);
        const origin = { x: 40, y: 15 };

        getFOVMask(
            grid, origin.x, origin.y, 10n * FP_FACTOR,
            0, TileFlag.HAS_MONSTER, false, ctx,
        );

        // The monster cell is visible (it's illuminated)
        expect(grid[41][15]).toBe(1);
        // But cells behind it are blocked
        expect(grid[42][15]).toBe(0);
    });
});

// =============================================================================
// backUpLighting / restoreLighting tests
// =============================================================================

describe("backUpLighting / restoreLighting", () => {
    it("round-trips lighting data", () => {
        const tmap = makeTmap();
        tmap[5][5].light = [100, 200, 50];
        tmap[10][3].light = [-20, 30, 0];

        const backup = createLightBackup();
        backUpLighting(tmap, backup);

        // Modify original
        tmap[5][5].light = [0, 0, 0];
        tmap[10][3].light = [0, 0, 0];

        // Restore
        restoreLighting(tmap, backup);

        expect(tmap[5][5].light).toEqual([100, 200, 50]);
        expect(tmap[10][3].light).toEqual([-20, 30, 0]);
    });
});

describe("recordOldLights", () => {
    it("copies light to oldLight", () => {
        const tmap = makeTmap();
        tmap[5][5].light = [100, 200, 50];

        recordOldLights(tmap);

        expect(tmap[5][5].oldLight).toEqual([100, 200, 50]);
    });
});

// =============================================================================
// applyColorScalar tests
// =============================================================================

describe("applyColorScalar", () => {
    it("scales all components by scalar/100", () => {
        const color: Color = {
            red: 100, green: 200, blue: 50,
            redRand: 10, greenRand: 20, blueRand: 5,
            rand: 30, colorDances: false,
        };

        applyColorScalar(color, 50);

        expect(color.red).toBe(50);
        expect(color.green).toBe(100);
        expect(color.blue).toBe(25);
        expect(color.redRand).toBe(5);
        expect(color.greenRand).toBe(10);
        expect(color.blueRand).toBe(2);
        expect(color.rand).toBe(15);
    });

    it("scalar of 100 leaves values unchanged", () => {
        const color: Color = {
            red: 100, green: 200, blue: 50,
            redRand: 10, greenRand: 20, blueRand: 5,
            rand: 30, colorDances: false,
        };

        applyColorScalar(color, 100);

        expect(color.red).toBe(100);
        expect(color.green).toBe(200);
        expect(color.blue).toBe(50);
    });

    it("scalar of 0 zeroes everything", () => {
        const color: Color = {
            red: 100, green: 200, blue: 50,
            redRand: 10, greenRand: 20, blueRand: 5,
            rand: 30, colorDances: false,
        };

        applyColorScalar(color, 0);

        expect(color.red).toBe(0);
        expect(color.green).toBe(0);
        expect(color.blue).toBe(0);
        expect(color.rand).toBe(0);
    });
});

// =============================================================================
// updateDisplayDetail tests
// =============================================================================

describe("updateDisplayDetail", () => {
    it("classifies DV_DARK for very negative light", () => {
        const tmap = makeTmap();
        const pmap = makePmap();
        const displayDetail = makeGrid(0);

        tmap[5][5].light = [-20, -20, -20];
        pmap[5][5].flags = 0;

        const ctx = {
            tmap, pmap, displayDetail,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        updateDisplayDetail(ctx);

        expect(displayDetail[5][5]).toBe(DisplayDetailValue.Dark);
    });

    it("classifies DV_UNLIT for cells in shadow", () => {
        const tmap = makeTmap();
        const pmap = makePmap();
        const displayDetail = makeGrid(0);

        tmap[5][5].light = [0, 0, 0]; // not dark
        pmap[5][5].flags = TileFlag.IS_IN_SHADOW;

        const ctx = {
            tmap, pmap, displayDetail,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        updateDisplayDetail(ctx);

        expect(displayDetail[5][5]).toBe(DisplayDetailValue.Unlit);
    });

    it("classifies DV_LIT for lit cells not in shadow", () => {
        const tmap = makeTmap();
        const pmap = makePmap();
        const displayDetail = makeGrid(0);

        tmap[5][5].light = [50, 50, 50];
        pmap[5][5].flags = 0; // not in shadow

        const ctx = {
            tmap, pmap, displayDetail,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        updateDisplayDetail(ctx);

        expect(displayDetail[5][5]).toBe(DisplayDetailValue.Lit);
    });
});

// =============================================================================
// playerInDarkness tests
// =============================================================================

describe("playerInDarkness", () => {
    it("returns true when light is significantly below miner's light color", () => {
        const tmap = makeTmap();
        // minersLightColor is { red: 30, green: 30, blue: 45 } (approximately)
        // Player is in darkness if light + 10 < each component
        tmap[5][5].light = [-100, -100, -100];

        expect(playerInDarkness(tmap, { x: 5, y: 5 })).toBe(true);
    });

    it("returns false when light is bright", () => {
        const tmap = makeTmap();
        tmap[5][5].light = [200, 200, 200];

        expect(playerInDarkness(tmap, { x: 5, y: 5 })).toBe(false);
    });
});

// =============================================================================
// paintLight tests
// =============================================================================

describe("paintLight", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("adds light to cells within the FOV radius", () => {
        const tmap = makeTmap();
        const pmap = makePmap();

        const light: LightSource = {
            lightColor: {
                red: 100, green: 50, blue: 25,
                redRand: 0, greenRand: 0, blueRand: 0,
                rand: 0, colorDances: false,
            },
            lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 },
            radialFadeToPercent: 0,
            passThroughCreatures: true,
        };

        const ctx = {
            tmap, pmap,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        paintLight(light, 40, 15, false, false, ctx);

        // The source cell should have received light
        expect(tmap[40][15].light[0]).toBeGreaterThan(0);
        expect(tmap[40][15].light[1]).toBeGreaterThan(0);
        expect(tmap[40][15].light[2]).toBeGreaterThan(0);
    });

    it("dispels IS_IN_SHADOW when light is positive and not maintainShadows", () => {
        const tmap = makeTmap();
        const pmap = makePmap();
        // Mark cells as in shadow
        pmap[40][15].flags = TileFlag.IS_IN_SHADOW;

        const light: LightSource = {
            lightColor: {
                red: 100, green: 50, blue: 25,
                redRand: 0, greenRand: 0, blueRand: 0,
                rand: 0, colorDances: false,
            },
            lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 },
            radialFadeToPercent: 0,
            passThroughCreatures: true,
        };

        const ctx = {
            tmap, pmap,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        paintLight(light, 40, 15, false, false, ctx);

        // Source cell should no longer be in shadow
        expect(pmap[40][15].flags & TileFlag.IS_IN_SHADOW).toBe(0);
    });

    it("does not dispel shadows with maintainShadows=true", () => {
        const tmap = makeTmap();
        const pmap = makePmap();
        pmap[40][15].flags = TileFlag.IS_IN_SHADOW;

        const light: LightSource = {
            lightColor: {
                red: 100, green: 50, blue: 25,
                redRand: 0, greenRand: 0, blueRand: 0,
                rand: 0, colorDances: false,
            },
            lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 },
            radialFadeToPercent: 0,
            passThroughCreatures: true,
        };

        const ctx = {
            tmap, pmap,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        paintLight(light, 40, 15, false, true, ctx);

        // Should still be in shadow
        expect(pmap[40][15].flags & TileFlag.IS_IN_SHADOW).not.toBe(0);
    });

    it("returns true when FOV overlaps player's field of view", () => {
        const tmap = makeTmap();
        const pmap = makePmap();
        // Mark a cell as in player's FOV
        pmap[41][15].flags = TileFlag.IN_FIELD_OF_VIEW;

        const light: LightSource = {
            lightColor: {
                red: 100, green: 50, blue: 25,
                redRand: 0, greenRand: 0, blueRand: 0,
                rand: 0, colorDances: false,
            },
            lightRadius: { lowerBound: 500, upperBound: 500, clumpFactor: 1 },
            radialFadeToPercent: 0,
            passThroughCreatures: true,
        };

        const ctx = {
            tmap, pmap,
            cellHasTerrainFlag: () => false,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        } as unknown as LightingContext;

        const result = paintLight(light, 40, 15, false, false, ctx);
        expect(result).toBe(true);
    });
});

// =============================================================================
// Flare tests
// =============================================================================

describe("flares", () => {
    describe("newFlare", () => {
        it("creates a flare with correct initial values", () => {
            const light: LightSource = {
                lightColor: {
                    red: 100, green: 50, blue: 25,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            };

            const flare = newFlare(light, 10, 15, -15, 0, 100);

            expect(flare.loc).toEqual({ x: 10, y: 15 });
            expect(flare.coeffChangeAmount).toBe(-15);
            expect(flare.coeffLimit).toBe(0);
            expect(flare.coeff).toBe(100 * 1000);
            expect(flare.turnNumber).toBe(100);
        });

        it("forces changePerFrame to 1 if 0", () => {
            const light: LightSource = {
                lightColor: {
                    red: 0, green: 0, blue: 0,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
                radialFadeToPercent: 0,
                passThroughCreatures: false,
            };

            const flare = newFlare(light, 0, 0, 0, 0, 0);
            expect(flare.coeffChangeAmount).toBe(1);
        });
    });

    describe("flareIsActive", () => {
        it("is active at initial state", () => {
            const light: LightSource = {
                lightColor: {
                    red: 100, green: 50, blue: 25,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            };
            const flare = newFlare(light, 10, 15, -15, 0, 100);

            // Active on the same turn
            expect(flareIsActive(flare, 100)).toBe(true);
            // Active on the next turn
            expect(flareIsActive(flare, 101)).toBe(true);
        });

        it("becomes inactive if too many turns have passed", () => {
            const light: LightSource = {
                lightColor: {
                    red: 100, green: 50, blue: 25,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            };
            const flare = newFlare(light, 10, 15, -15, 0, 100);

            // More than 1 turn later
            expect(flareIsActive(flare, 103)).toBe(false);
        });

        it("becomes inactive when coefficient drops below limit (fading)", () => {
            const light: LightSource = {
                lightColor: {
                    red: 100, green: 50, blue: 25,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            };
            const flare = newFlare(light, 10, 15, -15, 0, 100);

            // Force coefficient to 0
            flare.coeff = -1;

            expect(flareIsActive(flare, 100)).toBe(false);
        });
    });

    describe("updateFlare", () => {
        it("updates coefficient and change amount", () => {
            const light: LightSource = {
                lightColor: {
                    red: 100, green: 50, blue: 25,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            };
            const flare = newFlare(light, 10, 15, -15, 0, 100);
            const initialCoeff = flare.coeff;
            const initialChange = flare.coeffChangeAmount;

            updateFlare(flare, 100);

            // Coefficient should have decreased
            expect(flare.coeff).toBeLessThan(initialCoeff);
            // Change amount should accelerate (multiply by 12/10)
            expect(flare.coeffChangeAmount).toBe(Math.floor(initialChange * 12 / 10));
        });

        it("returns false once the flare expires", () => {
            const light: LightSource = {
                lightColor: {
                    red: 100, green: 50, blue: 25,
                    redRand: 0, greenRand: 0, blueRand: 0,
                    rand: 0, colorDances: false,
                },
                lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: true,
            };
            const flare = newFlare(light, 10, 15, -15, 0, 100);

            // Update until it expires
            let active = true;
            let iterations = 0;
            while (active && iterations < 100) {
                active = updateFlare(flare, 100);
                iterations++;
            }

            expect(active).toBe(false);
            expect(iterations).toBeLessThan(100);
        });
    });

    describe("deleteAllFlares", () => {
        it("clears the flare list", () => {
            const rogue = { flares: [null as any, null as any] } as any;
            rogue.flares.length = 2;

            deleteAllFlares(rogue);

            expect(rogue.flares.length).toBe(0);
        });
    });
});
