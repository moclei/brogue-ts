/*
 *  query-context.ts — Construct CellQueryContext for terrain-only rendering
 *  dungeon-cake
 *
 *  Builds the context object consumed by getCellSpriteData. In terrain-only
 *  mode: no creatures, no items, player positioned at the up-staircase.
 *  Supports lighting toggle and fog-of-war mode selection.
 */

import type { Pcell, Tcell, ScreenDisplayBuffer, Creature } from "@game/types/types.js";
import type { CellQueryContext } from "@game/io/cell-queries.js";
import type { LightingContext } from "@game/light/light.js";
import { TileFlag } from "@game/types/flags.js";
import { TileType, DisplayGlyph, DungeonLayer } from "@game/types/enums.js";
import { DCOLS, DROWS, COLS, ROWS } from "@game/types/constants.js";

import { tileCatalog } from "@game/globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "@game/globals/dungeon-feature-catalog.js";
import { monsterCatalog } from "@game/globals/monster-catalog.js";
import { lightCatalog } from "@game/globals/light-catalog.js";
import { mutationCatalog } from "@game/globals/mutation-catalog.js";
import { terrainRandomValues } from "@game/render-state.js";
import { allocGrid } from "@game/grid/grid.js";
import { cellHasTerrainFlag } from "@game/state/helpers.js";
import { updateLighting } from "@game/light/light.js";

import { createPlayerCreatureStub, createRogueStub } from "./stubs.js";

// ── Fog-of-war modes ─────────────────────────────────────────────────────────

export type FogMode =
    | "visible"
    | "remembered"
    | "clairvoyant"
    | "telepathic"
    | "magic-mapped"
    | "omniscience";

export const FOG_MODES: { value: FogMode; label: string }[] = [
    { value: "visible", label: "All Visible" },
    { value: "remembered", label: "Remembered" },
    { value: "clairvoyant", label: "Clairvoyant" },
    { value: "telepathic", label: "Telepathic" },
    { value: "magic-mapped", label: "Magic Mapped" },
    { value: "omniscience", label: "Omniscience" },
];

function fogFlags(mode: FogMode): number {
    switch (mode) {
        case "visible":       return TileFlag.DISCOVERED | TileFlag.VISIBLE;
        case "remembered":    return TileFlag.DISCOVERED;
        case "clairvoyant":   return TileFlag.DISCOVERED | TileFlag.CLAIRVOYANT_VISIBLE;
        case "telepathic":    return TileFlag.DISCOVERED | TileFlag.TELEPATHIC_VISIBLE;
        case "magic-mapped":  return TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED;
        case "omniscience":   return TileFlag.DISCOVERED | TileFlag.VISIBLE;
    }
}

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

// ── displayBuffer allocation ─────────────────────────────────────────────────

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

// ── Apply visibility flags ───────────────────────────────────────────────────

const VISIBILITY_MASK =
    TileFlag.DISCOVERED | TileFlag.VISIBLE |
    TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.TELEPATHIC_VISIBLE |
    TileFlag.MAGIC_MAPPED;

function applyFogMode(pmap: Pcell[][], mode: FogMode): void {
    const flags = fogFlags(mode);
    const needsRemembered = mode === "remembered" || mode === "magic-mapped";
    for (let x = 0; x < DCOLS; x++) {
        for (let y = 0; y < DROWS; y++) {
            const cell = pmap[x][y];
            cell.flags = (cell.flags & ~VISIBILITY_MASK) | flags;
            if (needsRemembered && cell.rememberedLayers.length === 0) {
                cell.rememberedLayers = cell.layers.slice(
                    0, DungeonLayer.NumberTerrainLayers,
                ) as TileType[];
            }
        }
    }
}

// ── Lighting context ─────────────────────────────────────────────────────────

function buildLightingContext(
    pmap: Pcell[][],
    tmap: Tcell[][],
    displayDetail: number[][],
    player: Creature,
    rogue: ReturnType<typeof createRogueStub>,
): LightingContext {
    return {
        tmap,
        pmap,
        displayDetail,
        player,
        rogue,
        monsters: [],
        dormantMonsters: [],
        lightCatalog,
        tileCatalog,
        mutationCatalog,
        monsterRevealed: () => false,
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlag(pmap, pos, flags),
        getCellFlags: (x, y) => pmap[x][y].flags,
    };
}

// ── Main factory ─────────────────────────────────────────────────────────────

export interface QueryContextOptions {
    fogMode?: FogMode;
    lightingEnabled?: boolean;
}

export function createQueryContext(
    pmap: Pcell[][],
    options: QueryContextOptions = {},
): CellQueryContext {
    const { fogMode = "visible", lightingEnabled = false } = options;

    applyFogMode(pmap, fogMode);

    const playerLoc = findUpStaircase(pmap);
    const player = createPlayerCreatureStub(playerLoc);
    const rogue = createRogueStub();

    if (fogMode === "omniscience") {
        rogue.playbackOmniscience = true;
    }

    pmap[playerLoc.x][playerLoc.y].flags |= TileFlag.HAS_PLAYER;

    const tmap = createTmap();
    const displayDetail = allocGrid();

    if (lightingEnabled) {
        updateLighting(
            buildLightingContext(pmap, tmap, displayDetail, player, rogue),
        );
    }

    return {
        pmap,
        tmap,
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
        displayDetail,
        scentMap: allocGrid(),
        monsterFlagsList: monsterCatalog.map(m => m.flags),
    };
}
