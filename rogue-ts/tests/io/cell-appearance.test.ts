/*
 *  io/cell-appearance.test.ts — Unit tests for getCellAppearance
 *  Port V2 — rogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import { TileType, DisplayGlyph } from "../../src/types/enums.js";
import { TileFlag } from "../../src/types/flags.js";
import type { Pcell, Tcell, Creature, PlayerCharacter, ScreenDisplayBuffer } from "../../src/types/types.js";
import { createScreenDisplayBuffer } from "../../src/io/display.js";
import { getCellAppearance, refreshDungeonCell, displayLevel } from "../../src/io/cell-appearance.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "../../src/globals/dungeon-feature-catalog.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";

// =============================================================================
// Test helpers
// =============================================================================

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
                    character: 0 as DisplayGlyph,
                    foreColorComponents: [0, 0, 0],
                    backColorComponents: [0, 0, 0],
                    opacity: 0,
                },
                rememberedLayers: [],
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

function makeTerrainRandomValues(): number[][][] {
    const vals: number[][][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        vals[i] = new Array(DROWS);
        for (let j = 0; j < DROWS; j++) {
            vals[i][j] = [500, 500, 500, 500, 500, 500, 500, 500];
        }
    }
    return vals;
}

function makeGrid(fill = 0): number[][] {
    const grid: number[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) grid[i] = new Array(DROWS).fill(fill);
    return grid;
}

// Minimal PlayerCharacter with just the fields accessed in getCellAppearance
function makeRogue(overrides?: Partial<PlayerCharacter>): PlayerCharacter {
    return {
        playbackOmniscience: false,
        trueColorMode: false,
        displayStealthRangeMode: false,
        inWater: false,
        scentTurnNumber: 0,
        stealthRange: 10,
        cursorPathIntensity: 20,
        ...overrides,
    } as unknown as PlayerCharacter;
}

// =============================================================================
// Tests
// =============================================================================

describe("getCellAppearance", () => {
    it("undiscovered cell returns space + black + undiscoveredColor", () => {
        const pmap = makePmap();
        const tmap = makeTmap();
        const displayBuffer: ScreenDisplayBuffer = createScreenDisplayBuffer();
        const rogue = makeRogue();
        const player = {} as unknown as Creature;

        // pmap[5][5].flags = 0: no DISCOVERED, no MAGIC_MAPPED, no ANY_KIND_OF_VISIBLE
        const result = getCellAppearance(
            { x: 5, y: 5 },
            pmap, tmap, displayBuffer, rogue, player,
            [], [], [],         // monsters, dormantMonsters, floorItems
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            makeTerrainRandomValues(), makeGrid(), makeGrid(),
        );

        expect(result.glyph).toBe(32); // space character
        // undiscoveredColor is black (all zeros)
        expect(result.foreColor.red).toBe(0);
        expect(result.foreColor.green).toBe(0);
        expect(result.foreColor.blue).toBe(0);
        // backColor = undiscoveredColor (also all zeros per globals/colors.ts)
        expect(result.backColor.red).toBe(0);
        expect(result.backColor.green).toBe(0);
        expect(result.backColor.blue).toBe(0);
    });

    it("stable memory cell restores stored appearance (before post-processing)", () => {
        const pmap = makePmap();
        const tmap = makeTmap();
        const displayBuffer: ScreenDisplayBuffer = createScreenDisplayBuffer();
        const rogue = makeRogue();
        const player = { status: new Array(30).fill(0), loc: { x: 0, y: 0 } } as unknown as Creature;

        // Set cell to discovered + stable memory with stored appearance
        pmap[3][3].flags = TileFlag.DISCOVERED | TileFlag.STABLE_MEMORY;
        pmap[3][3].rememberedAppearance.character = DisplayGlyph.G_FLOOR;
        pmap[3][3].rememberedAppearance.foreColorComponents = [60, 60, 60];
        pmap[3][3].rememberedAppearance.backColorComponents = [5, 5, 5];

        const result = getCellAppearance(
            { x: 3, y: 3 },
            pmap, tmap, displayBuffer, rogue, player,
            [], [], [],
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            makeTerrainRandomValues(), makeGrid(), makeGrid(),
        );

        // Stable memory path reads from rememberedAppearance; post-processing applies
        // memory-color dimming. We just check the char is preserved.
        expect(result.glyph).toBe(DisplayGlyph.G_FLOOR);
    });

    it("discovered + VISIBLE floor with light produces non-black background", () => {
        const pmap = makePmap();
        const tmap = makeTmap();
        const displayBuffer = createScreenDisplayBuffer();
        const rogue = makeRogue();
        const player = { status: new Array(30).fill(0), loc: { x: 0, y: 0 } } as unknown as Creature;

        // Mark cell as discovered and currently visible
        pmap[5][5].flags = TileFlag.DISCOVERED | TileFlag.VISIBLE;
        // Provide some light so the cell isn't pitch black
        tmap[5][5].light = [50, 50, 50];

        const result = getCellAppearance(
            { x: 5, y: 5 },
            pmap, tmap, displayBuffer, rogue, player,
            [], [], [],
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            makeTerrainRandomValues(), makeGrid(), makeGrid(),
        );

        // Fully visible lit floor should have some non-zero color component
        const hasColor =
            result.foreColor.red > 0 || result.foreColor.green > 0 || result.foreColor.blue > 0 ||
            result.backColor.red > 0 || result.backColor.green > 0 || result.backColor.blue > 0;
        expect(hasColor).toBe(true);
    });
});

// =============================================================================
// refreshDungeonCell
// =============================================================================

describe("refreshDungeonCell", () => {
    it("writes getCellAppearance result to displayBuffer at the cell's window position", () => {
        const displayBuffer = createScreenDisplayBuffer();
        const mockAppearance = {
            glyph: DisplayGlyph.G_FLOOR,
            foreColor: { red: 60, green: 40, blue: 20, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            backColor: { red: 10, green: 8, blue: 5, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        };
        const getCellAppFn = vi.fn(() => mockAppearance);

        refreshDungeonCell({ x: 5, y: 5 }, getCellAppFn, displayBuffer);

        expect(getCellAppFn).toHaveBeenCalledWith({ x: 5, y: 5 });
        // Window position for (5,5): mapToWindowX(5)=5+20+1=26, mapToWindowY(5)=5+3=8
        const cell = displayBuffer.cells[26][8];
        expect(cell.character).toBe(DisplayGlyph.G_FLOOR);
    });
});

// =============================================================================
// displayLevel
// =============================================================================

describe("displayLevel", () => {
    it("calls refreshCell exactly DCOLS×DROWS times", () => {
        const refreshCell = vi.fn();
        displayLevel(DCOLS, DROWS, refreshCell);
        expect(refreshCell).toHaveBeenCalledTimes(DCOLS * DROWS);
    });

    it("calls refreshCell with every cell coordinate", () => {
        const visited = new Set<string>();
        displayLevel(3, 4, (loc) => visited.add(`${loc.x},${loc.y}`));
        expect(visited.size).toBe(12);
        expect(visited.has("0,0")).toBe(true);
        expect(visited.has("2,3")).toBe(true);
    });
});
