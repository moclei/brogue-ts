/*
 *  query-context.ts — Construct CellQueryContext for terrain-only rendering
 *  dungeon-cake
 *
 *  Builds the context object consumed by getCellSpriteData. In terrain-only
 *  mode: no creatures, no items, all cells DISCOVERED | VISIBLE, player
 *  positioned at the up-staircase location.
 */

import type { Pcell, Tcell, ScreenDisplayBuffer } from "@game/types/types.js";
import type { CellQueryContext } from "@game/io/cell-queries.js";
import { TileFlag } from "@game/types/flags.js";
import { TileType, DisplayGlyph } from "@game/types/enums.js";
import { DCOLS, DROWS, COLS, ROWS } from "@game/types/constants.js";

import { tileCatalog } from "@game/globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "@game/globals/dungeon-feature-catalog.js";
import { monsterCatalog } from "@game/globals/monster-catalog.js";
import { terrainRandomValues } from "@game/render-state.js";
import { allocGrid } from "@game/grid/grid.js";

import { createPlayerCreatureStub, createRogueStub } from "./stubs.js";

// ── tmap allocation ──────────────────────────────────────────────────────────

function createTmap(): Tcell[][] {
    const tmap: Tcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        tmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            tmap[x][y] = {
                light: [100, 100, 100],
                oldLight: [100, 100, 100],
            };
        }
    }
    return tmap;
}

// ── displayBuffer allocation (unused by getCellSpriteData) ───────────────────

function createDisplayBuffer(): ScreenDisplayBuffer {
    const cells: ScreenDisplayBuffer["cells"] = [];
    for (let x = 0; x < COLS; x++) {
        cells[x] = [];
        for (let y = 0; y < ROWS; y++) {
            cells[x][y] = {
                character: 0 as DisplayGlyph,
                foreColorComponents: [0, 0, 0],
                backColorComponents: [0, 0, 0],
                opacity: 0,
            };
        }
    }
    return { cells };
}

// ── Find staircase position ──────────────────────────────────────────────────

function findUpStaircase(pmap: Pcell[][]): { x: number; y: number } {
    for (let x = 0; x < DCOLS; x++) {
        for (let y = 0; y < DROWS; y++) {
            if (pmap[x][y].layers[0] === TileType.UP_STAIRS) {
                return { x, y };
            }
        }
    }
    return { x: Math.floor(DCOLS / 2), y: Math.floor(DROWS / 2) };
}

// ── Set visibility flags ─────────────────────────────────────────────────────

function markAllCellsVisible(pmap: Pcell[][]): void {
    for (let x = 0; x < DCOLS; x++) {
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y].flags |= TileFlag.DISCOVERED | TileFlag.VISIBLE;
        }
    }
}

// ── Main factory ─────────────────────────────────────────────────────────────

export function createQueryContext(pmap: Pcell[][]): CellQueryContext {
    markAllCellsVisible(pmap);

    const playerLoc = findUpStaircase(pmap);
    const player = createPlayerCreatureStub(playerLoc);
    const rogue = createRogueStub();

    pmap[playerLoc.x][playerLoc.y].flags |= TileFlag.HAS_PLAYER;

    return {
        pmap,
        tmap: createTmap(),
        displayBuffer: createDisplayBuffer(),
        rogue,
        player,
        monsters: [],
        dormantMonsters: [],
        floorItems: [],
        tileCatalog,
        dungeonFeatureCatalog,
        monsterCatalog,
        terrainRandomValues,
        displayDetail: allocGrid(),
        scentMap: allocGrid(),
        monsterFlagsList: monsterCatalog.map(m => m.flags),
    };
}
