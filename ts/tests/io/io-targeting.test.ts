/*
 *  io-targeting.test.ts — Tests for io-targeting.ts (cursor & pathing)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import { Direction } from "../../src/types/enums.js";
import { TileFlag, TerrainMechFlag } from "../../src/types/flags.js";
import { INVALID_POS } from "../../src/types/types.js";
import type { Color, Creature, Pcell, Pos, DisplayGlyph } from "../../src/types/types.js";
import { allocGrid, fillGrid } from "../../src/grid/grid.js";
import {
    type TargetingContext,
    getPlayerPathOnMap,
    reversePath,
    hilitePath,
    clearCursorPath,
    hideCursor,
    showCursor,
    getClosestValidLocationOnMap,
    processSnapMap,
    hiliteCell,
} from "../../src/io/io-targeting.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = {
                layers: [0, 0, 0, 0],
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: { character: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0], opacity: 0 },
                rememberedItemCategory: 0,
                rememberedItemKind: 0,
                rememberedItemQuantity: 0,
                rememberedItemOriginDepth: 0,
                rememberedTerrain: 0 as any,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                exposedToFire: 0,
            };
        }
    }
    return pmap;
}

function makePlayer(loc: Pos = { x: 20, y: 15 }): Creature {
    return {
        loc,
        info: { monsterID: 0, monsterName: "player" },
    } as unknown as Creature;
}

function createCtx(overrides: Partial<TargetingContext> = {}): TargetingContext {
    const player = makePlayer();
    return {
        rogue: {
            playbackMode: false,
            cursorMode: false,
            cursorPathIntensity: 20,
            cursorLoc: { x: -1, y: -1 },
        },
        player,
        pmap: makePmap(),
        nextStep: vi.fn(() => Direction.NoDirection),
        allocGrid,
        fillGrid,
        dijkstraScan: vi.fn(),
        populateCreatureCostMap: vi.fn(),
        cellHasTMFlag: vi.fn(() => false),
        refreshDungeonCell: vi.fn(),
        getCellAppearance: vi.fn(() => ({
            glyph: 64 as DisplayGlyph,
            foreColor: makeColor(100, 100, 100),
            backColor: makeColor(0, 0, 0),
        })),
        applyColorAugment: vi.fn(),
        separateColors: vi.fn(),
        plotCharWithColor: vi.fn(),
        mapToWindow: vi.fn((loc: Pos) => ({ windowX: loc.x + 1, windowY: loc.y + 1 })),
        ...overrides,
    };
}

// =============================================================================
// getPlayerPathOnMap
// =============================================================================

describe("getPlayerPathOnMap", () => {
    it("returns 0 steps when nextStep immediately returns NoDirection", () => {
        const ctx = createCtx();
        const path: Pos[] = [];
        const steps = getPlayerPathOnMap(path, allocGrid(), { x: 20, y: 15 }, ctx);
        expect(steps).toBe(0);
    });

    it("follows nextStep until NoDirection is returned", () => {
        // Simulate a 3-step path: right, right, down
        let callCount = 0;
        const ctx = createCtx({
            nextStep: vi.fn(() => {
                callCount++;
                if (callCount === 1) return Direction.Right;
                if (callCount === 2) return Direction.Right;
                if (callCount === 3) return Direction.Down;
                return Direction.NoDirection;
            }),
        });
        const map = allocGrid();
        const path: Pos[] = [];
        const steps = getPlayerPathOnMap(path, map, { x: 10, y: 10 }, ctx);

        expect(steps).toBe(3);
        expect(path[0]).toEqual({ x: 11, y: 10 }); // right from (10,10)
        expect(path[1]).toEqual({ x: 12, y: 10 }); // right from (11,10)
        expect(path[2]).toEqual({ x: 12, y: 11 }); // down from (12,10)
    });

    it("passes the player to nextStep", () => {
        const ctx = createCtx();
        const map = allocGrid();
        getPlayerPathOnMap([], map, { x: 5, y: 5 }, ctx);
        expect(ctx.nextStep).toHaveBeenCalledWith(map, { x: 5, y: 5 }, ctx.player, false);
    });
});

// =============================================================================
// reversePath
// =============================================================================

describe("reversePath", () => {
    it("reverses a path of even length", () => {
        const path: Pos[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
            { x: 4, y: 4 },
        ];
        reversePath(path, 4);
        expect(path[0]).toEqual({ x: 4, y: 4 });
        expect(path[1]).toEqual({ x: 3, y: 3 });
        expect(path[2]).toEqual({ x: 2, y: 2 });
        expect(path[3]).toEqual({ x: 1, y: 1 });
    });

    it("reverses a path of odd length", () => {
        const path: Pos[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
        ];
        reversePath(path, 3);
        expect(path[0]).toEqual({ x: 3, y: 3 });
        expect(path[1]).toEqual({ x: 2, y: 2 });
        expect(path[2]).toEqual({ x: 1, y: 1 });
    });

    it("does nothing for a single-step path", () => {
        const path: Pos[] = [{ x: 5, y: 5 }];
        reversePath(path, 1);
        expect(path[0]).toEqual({ x: 5, y: 5 });
    });

    it("does nothing for 0 steps", () => {
        const path: Pos[] = [{ x: 5, y: 5 }];
        reversePath(path, 0);
        expect(path[0]).toEqual({ x: 5, y: 5 });
    });

    it("only reverses the first `steps` entries", () => {
        const path: Pos[] = [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
            { x: 4, y: 4 },
            { x: 5, y: 5 },
        ];
        reversePath(path, 3);
        expect(path[0]).toEqual({ x: 3, y: 3 });
        expect(path[1]).toEqual({ x: 2, y: 2 });
        expect(path[2]).toEqual({ x: 1, y: 1 });
        // Beyond steps untouched
        expect(path[3]).toEqual({ x: 4, y: 4 });
        expect(path[4]).toEqual({ x: 5, y: 5 });
    });
});

// =============================================================================
// hilitePath
// =============================================================================

describe("hilitePath", () => {
    it("sets IS_IN_PATH on each cell when not unhiliting", () => {
        const ctx = createCtx();
        const path: Pos[] = [
            { x: 10, y: 10 },
            { x: 11, y: 10 },
            { x: 12, y: 10 },
        ];

        hilitePath(path, 3, false, ctx);

        expect(ctx.pmap[10][10].flags & TileFlag.IS_IN_PATH).toBeTruthy();
        expect(ctx.pmap[11][10].flags & TileFlag.IS_IN_PATH).toBeTruthy();
        expect(ctx.pmap[12][10].flags & TileFlag.IS_IN_PATH).toBeTruthy();
        expect(ctx.refreshDungeonCell).toHaveBeenCalledTimes(3);
    });

    it("clears IS_IN_PATH on each cell when unhiliting", () => {
        const ctx = createCtx();
        // Pre-set flags
        ctx.pmap[10][10].flags |= TileFlag.IS_IN_PATH;
        ctx.pmap[11][10].flags |= TileFlag.IS_IN_PATH;
        const path: Pos[] = [
            { x: 10, y: 10 },
            { x: 11, y: 10 },
        ];

        hilitePath(path, 2, true, ctx);

        expect(ctx.pmap[10][10].flags & TileFlag.IS_IN_PATH).toBeFalsy();
        expect(ctx.pmap[11][10].flags & TileFlag.IS_IN_PATH).toBeFalsy();
        expect(ctx.refreshDungeonCell).toHaveBeenCalledTimes(2);
    });

    it("refreshes each cell in the path", () => {
        const ctx = createCtx();
        const path: Pos[] = [{ x: 5, y: 5 }, { x: 6, y: 5 }];
        hilitePath(path, 2, false, ctx);
        expect(ctx.refreshDungeonCell).toHaveBeenCalledWith({ x: 5, y: 5 });
        expect(ctx.refreshDungeonCell).toHaveBeenCalledWith({ x: 6, y: 5 });
    });

    it("handles 0 steps", () => {
        const ctx = createCtx();
        hilitePath([], 0, false, ctx);
        expect(ctx.refreshDungeonCell).not.toHaveBeenCalled();
    });
});

// =============================================================================
// clearCursorPath
// =============================================================================

describe("clearCursorPath", () => {
    it("clears IS_IN_PATH from all flagged cells", () => {
        const ctx = createCtx();
        ctx.pmap[10][10].flags |= TileFlag.IS_IN_PATH;
        ctx.pmap[20][15].flags |= TileFlag.IS_IN_PATH;

        clearCursorPath(ctx);

        expect(ctx.pmap[10][10].flags & TileFlag.IS_IN_PATH).toBeFalsy();
        expect(ctx.pmap[20][15].flags & TileFlag.IS_IN_PATH).toBeFalsy();
        expect(ctx.refreshDungeonCell).toHaveBeenCalledTimes(2);
    });

    it("does nothing in playback mode", () => {
        const ctx = createCtx();
        ctx.rogue.playbackMode = true;
        ctx.pmap[10][10].flags |= TileFlag.IS_IN_PATH;

        clearCursorPath(ctx);

        // Flag NOT cleared in playback mode
        expect(ctx.pmap[10][10].flags & TileFlag.IS_IN_PATH).toBeTruthy();
        expect(ctx.refreshDungeonCell).not.toHaveBeenCalled();
    });

    it("skips cells without IS_IN_PATH", () => {
        const ctx = createCtx();
        clearCursorPath(ctx);
        expect(ctx.refreshDungeonCell).not.toHaveBeenCalled();
    });

    it("doesn't scan row/column 0", () => {
        const ctx = createCtx();
        ctx.pmap[0][5].flags |= TileFlag.IS_IN_PATH;
        ctx.pmap[5][0].flags |= TileFlag.IS_IN_PATH;

        clearCursorPath(ctx);

        // Row 0 and col 0 should be skipped (loop starts at 1)
        expect(ctx.pmap[0][5].flags & TileFlag.IS_IN_PATH).toBeTruthy();
        expect(ctx.pmap[5][0].flags & TileFlag.IS_IN_PATH).toBeTruthy();
        expect(ctx.refreshDungeonCell).not.toHaveBeenCalled();
    });
});

// =============================================================================
// hideCursor
// =============================================================================

describe("hideCursor", () => {
    it("sets cursorMode to false", () => {
        const ctx = createCtx();
        ctx.rogue.cursorMode = true;
        hideCursor(ctx);
        expect(ctx.rogue.cursorMode).toBe(false);
    });

    it("sets cursorPathIntensity to 20", () => {
        const ctx = createCtx();
        ctx.rogue.cursorPathIntensity = 50;
        hideCursor(ctx);
        expect(ctx.rogue.cursorPathIntensity).toBe(20);
    });

    it("sets cursorLoc to INVALID_POS", () => {
        const ctx = createCtx();
        ctx.rogue.cursorLoc = { x: 10, y: 10 };
        hideCursor(ctx);
        expect(ctx.rogue.cursorLoc.x).toBe(-1);
        expect(ctx.rogue.cursorLoc.y).toBe(-1);
    });
});

// =============================================================================
// showCursor
// =============================================================================

describe("showCursor", () => {
    it("sets cursorMode to true", () => {
        const ctx = createCtx();
        showCursor(ctx);
        expect(ctx.rogue.cursorMode).toBe(true);
    });

    it("sets cursorPathIntensity to 50", () => {
        const ctx = createCtx();
        showCursor(ctx);
        expect(ctx.rogue.cursorPathIntensity).toBe(50);
    });

    it("snaps cursorLoc to player when not on map", () => {
        const ctx = createCtx();
        ctx.rogue.cursorLoc = { x: -1, y: -1 };
        showCursor(ctx);
        expect(ctx.rogue.cursorLoc).toEqual(ctx.player.loc);
    });

    it("keeps cursorLoc when already on map", () => {
        const ctx = createCtx();
        ctx.rogue.cursorLoc = { x: 10, y: 10 };
        showCursor(ctx);
        expect(ctx.rogue.cursorLoc).toEqual({ x: 10, y: 10 });
    });

    it("does not mutate player.loc when snapping", () => {
        const ctx = createCtx();
        ctx.rogue.cursorLoc = { x: -1, y: -1 };
        showCursor(ctx);
        ctx.rogue.cursorLoc.x = 99;
        // Player's loc should not be affected (deep copy)
        expect(ctx.player.loc.x).toBe(20);
    });
});

// =============================================================================
// getClosestValidLocationOnMap
// =============================================================================

describe("getClosestValidLocationOnMap", () => {
    it("returns the closest reachable cell", () => {
        const map = allocGrid();
        fillGrid(map, 30000); // all unreachable
        map[15][10] = 5;
        map[25][20] = 3;

        const result = getClosestValidLocationOnMap(map, 14, 10);
        expect(result).toEqual({ x: 15, y: 10 });
    });

    it("breaks ties by lower map score", () => {
        const map = allocGrid();
        fillGrid(map, 30000);
        // Two cells equidistant from (10, 10)
        map[11][10] = 10; // dist² = 1
        map[10][11] = 5;  // dist² = 1, lower score

        const result = getClosestValidLocationOnMap(map, 10, 10);
        expect(result).toEqual({ x: 10, y: 11 });
    });

    it("returns INVALID_POS when no cell is reachable", () => {
        const map = allocGrid();
        fillGrid(map, 30000);

        const result = getClosestValidLocationOnMap(map, 10, 10);
        expect(result.x).toBe(-1);
        expect(result.y).toBe(-1);
    });

    it("excludes border cells (only scans 1..DCOLS-2, 1..DROWS-2)", () => {
        const map = allocGrid();
        fillGrid(map, 30000);
        map[0][5] = 1;   // border — should be skipped
        map[5][0] = 1;   // border — should be skipped

        const result = getClosestValidLocationOnMap(map, 0, 5);
        expect(result.x).toBe(-1); // nothing found
    });

    it("excludes negative map values", () => {
        const map = allocGrid();
        fillGrid(map, 30000);
        map[10][10] = -1;
        map[15][10] = 5;

        const result = getClosestValidLocationOnMap(map, 10, 10);
        // Skips (-1), finds (15,10)
        expect(result).toEqual({ x: 15, y: 10 });
    });
});

// =============================================================================
// processSnapMap
// =============================================================================

describe("processSnapMap", () => {
    it("calls populateCreatureCostMap, fills map, and runs dijkstraScan", () => {
        const ctx = createCtx();
        const map = allocGrid();

        processSnapMap(map, ctx);

        expect(ctx.populateCreatureCostMap).toHaveBeenCalled();
        expect(ctx.dijkstraScan).toHaveBeenCalledWith(map, expect.any(Array), true);
    });

    it("sets player position to 0 in the map", () => {
        const ctx = createCtx();
        const map = allocGrid();

        processSnapMap(map, ctx);

        // After fillGrid(30000) and before dijkstraScan, player cell is 0
        // dijkstraScan is mocked, so the value should still be 0
        expect(map[ctx.player.loc.x][ctx.player.loc.y]).toBe(0);
    });

    it("pulls TM_INVERT_WHEN_HIGHLIGHTED cells toward neighbors", () => {
        const ctx = createCtx();

        // Set up a cell at (10, 10) with TM_INVERT_WHEN_HIGHLIGHTED
        ctx.cellHasTMFlag = vi.fn((pos: Pos, flag: number) => {
            return pos.x === 10 && pos.y === 10 &&
                (flag & TerrainMechFlag.TM_INVERT_WHEN_HIGHLIGHTED) !== 0;
        });

        // Mock dijkstraScan to set up reachable cells
        ctx.dijkstraScan = vi.fn((distMap: number[][]) => {
            // After scan, set some reachable values
            distMap[10][10] = 30000; // unreachable initially
            distMap[10][9] = 5;     // neighbor above is reachable (Up direction)
            distMap[11][10] = 8;    // neighbor right is reachable (Right is dir index 3 for cardinal)
        });

        const map = allocGrid();
        processSnapMap(map, ctx);

        // Cell (10,10) should now have the minimum neighbor value = 5
        expect(map[10][10]).toBe(5);
    });

    it("does not modify cells without TM_INVERT_WHEN_HIGHLIGHTED", () => {
        const ctx = createCtx();
        ctx.cellHasTMFlag = vi.fn(() => false);

        // dijkstraScan sets some values
        ctx.dijkstraScan = vi.fn((distMap: number[][]) => {
            distMap[10][10] = 100;
        });

        const map = allocGrid();
        processSnapMap(map, ctx);

        // Non-inverted cell keeps its value from dijkstraScan
        expect(map[10][10]).toBe(100);
    });
});

// =============================================================================
// hiliteCell
// =============================================================================

describe("hiliteCell", () => {
    it("gets cell appearance and applies color augment", () => {
        const ctx = createCtx();
        const hilColor = makeColor(50, 50, 50);

        hiliteCell(10, 10, hilColor, 75, false, ctx);

        expect(ctx.getCellAppearance).toHaveBeenCalledWith({ x: 10, y: 10 });
        expect(ctx.applyColorAugment).toHaveBeenCalledTimes(2); // fore + back
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });

    it("separates colors when distinctColors is true", () => {
        const ctx = createCtx();

        hiliteCell(10, 10, makeColor(), 50, true, ctx);

        expect(ctx.separateColors).toHaveBeenCalled();
    });

    it("does not separate colors when distinctColors is false", () => {
        const ctx = createCtx();

        hiliteCell(10, 10, makeColor(), 50, false, ctx);

        expect(ctx.separateColors).not.toHaveBeenCalled();
    });

    it("uses mapToWindow to get window coordinates", () => {
        const ctx = createCtx();

        hiliteCell(15, 12, makeColor(), 50, false, ctx);

        expect(ctx.mapToWindow).toHaveBeenCalledWith({ x: 15, y: 12 });
    });

    it("passes the correct glyph to plotCharWithColor", () => {
        const ctx = createCtx({
            getCellAppearance: vi.fn(() => ({
                glyph: 65 as DisplayGlyph, // 'A'
                foreColor: makeColor(100, 100, 100),
                backColor: makeColor(0, 0, 0),
            })),
        });

        hiliteCell(10, 10, makeColor(), 50, false, ctx);

        expect(ctx.plotCharWithColor).toHaveBeenCalledWith(
            65,
            expect.anything(),
            expect.anything(),
            expect.anything(),
        );
    });
});
