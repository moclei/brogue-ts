/*
 *  io/debug-overlays.ts — Debug display overlay functions
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *    displayGrid, displayWaypoints, displayMachines,
 *    displayChokeMap, displayLoops
 *
 *  Developer visualization tools; called only in DEBUG mode.
 *  Each function iterates the dungeon grid and highlights cells
 *  based on pathfinding/architecture data.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "../core.js";
import { getChokeMap } from "../lifecycle.js";
import { getCellAppearance } from "./cell-appearance.js";
import { plotCharWithColor as plotCharFn, mapToWindow } from "./display.js";
import { applyColorAugment, separateColors } from "./color.js";
import { clamp } from "../math/rng.js";
import * as Colors from "../globals/colors.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { T_WAYPOINT_BLOCKER, TerrainFlag, TileFlag, MessageFlag } from "../types/flags.js";
import { cellHasTerrainFlag as cellHasTerrainFlagFn } from "../state/helpers.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { terrainRandomValues, displayDetail } from "../render-state.js";
import type { Color } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";

const CHOKEMAP_CUTOFF = 160;
type MsgFn = (msg: string, flags: number) => void | Promise<void>;

/** Build per-call cell-appearance and plot helpers from current game state. */
function buildHelpers() {
    const { pmap, tmap, rogue, player, monsters, dormantMonsters,
        floorItems, monsterCatalog, displayBuffer } = getGameState();
    const scentMap = getScentMap() ?? [];
    const getCellApp = (x: number, y: number) =>
        getCellAppearance({ x, y }, pmap, tmap, displayBuffer, rogue, player,
            monsters, dormantMonsters, floorItems,
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            terrainRandomValues, displayDetail, scentMap);
    const plotChar = (glyph: DisplayGlyph, x: number, y: number, fg: Color, bg: Color) =>
        plotCharFn(glyph, mapToWindow({ x, y }), fg, bg, displayBuffer);
    return { pmap, rogue, player, getCellApp, plotChar };
}

// =============================================================================
// buildDebugOverlayFns
// =============================================================================

/**
 * Build the 5 debug display overlay closures.
 *
 * @param temporaryMessage - wired message fn (from buildMessageFns())
 * @param displayLevel     - wired level renderer (from buildDisplayLevelFn())
 */
export function buildDebugOverlayFns(
    temporaryMessage: MsgFn,
    displayLevel: () => void,
): {
    displayGrid(grid: number[][]): void;
    displayWaypoints(): void;
    displayMachines(): void;
    displayChokeMap(): void;
    displayLoops(): void;
} {
    return {

        // C: IO.c:4339 displayGrid()
        displayGrid(grid: number[][]): void {
            const { pmap, player, getCellApp, plotChar } = buildHelpers();
            let topRange = -30000;
            let bottomRange = 30000;
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (cellHasTerrainFlagFn(pmap, { x: i, y: j }, T_WAYPOINT_BLOCKER)
                        || grid[i][j] === grid[0][0]
                        || (i === player.loc.x && j === player.loc.y)) continue;
                    if (grid[i][j] > topRange) topRange = grid[i][j];
                    if (grid[i][j] < bottomRange) bottomRange = grid[i][j];
                }
            }
            const range = Math.max(1, topRange - bottomRange);
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (cellHasTerrainFlagFn(pmap, { x: i, y: j },
                        TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_LAVA_INSTA_DEATH)
                        || grid[i][j] === grid[0][0]
                        || (i === player.loc.x && j === player.loc.y)) continue;
                    let score = 300 - (grid[i][j] - bottomRange) * 300 / range;
                    const tempColor: Color = { ...Colors.black };
                    tempColor.blue = clamp(score, 0, 100); score -= 100;
                    tempColor.red  = clamp(score, 0, 100); score -= 100;
                    tempColor.green = clamp(score, 0, 100);
                    const { glyph, foreColor } = getCellApp(i, j);
                    plotChar(glyph, i, j, foreColor, tempColor);
                }
            }
        },

        // C: IO.c:2206 displayWaypoints()
        displayWaypoints(): void {
            const { rogue, getCellApp, plotChar } = buildHelpers();
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    let lowestDist = 30000;
                    for (let w = 0; w < rogue.wpCount; w++) {
                        const d = rogue.wpDistance[w]?.[i]?.[j];
                        if (d !== undefined && d < lowestDist) lowestDist = d;
                    }
                    if (lowestDist < 10) {
                        const strength = clamp(100 - lowestDist * 15, 0, 100);
                        const { glyph, foreColor, backColor } = getCellApp(i, j);
                        applyColorAugment(foreColor, Colors.white, strength);
                        applyColorAugment(backColor, Colors.white, strength);
                        separateColors(foreColor, backColor);
                        plotChar(glyph, i, j, foreColor, backColor);
                    }
                }
            }
            temporaryMessage("Waypoints:", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
            displayLevel();
        },

        // C: IO.c:2226 displayMachines()
        displayMachines(): void {
            const { pmap, getCellApp, plotChar } = buildHelpers();
            // Cosmetic-only random machine colors; Math.random() acceptable here
            const machineColors: Color[] = Array.from({ length: 50 }, () => ({
                ...Colors.black,
                red:   Math.floor(Math.random() * 101),
                green: Math.floor(Math.random() * 101),
                blue:  Math.floor(Math.random() * 101),
            }));
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    const mn = pmap[i][j].machineNumber;
                    if (!mn) continue;
                    const { foreColor, backColor } = getCellApp(i, j);
                    applyColorAugment(backColor, machineColors[mn], 50);
                    const code = mn < 10  ? '0'.charCodeAt(0) + mn
                        : mn < 36 ? 'a'.charCodeAt(0) + mn - 10
                        : 'A'.charCodeAt(0) + mn - 36;
                    plotChar(code as DisplayGlyph, i, j, foreColor, backColor);
                }
            }
            temporaryMessage("Machines:", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
            displayLevel();
        },

        // C: IO.c:2264 displayChokeMap()
        displayChokeMap(): void {
            const { pmap, getCellApp, plotChar } = buildHelpers();
            const chokeMap = getChokeMap();
            if (!chokeMap) return;
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (chokeMap[i][j] >= CHOKEMAP_CUTOFF) continue;
                    const { glyph, foreColor, backColor } = getCellApp(i, j);
                    if (pmap[i][j].flags & TileFlag.IS_GATE_SITE) {
                        applyColorAugment(backColor, Colors.teal, 50);
                    } else {
                        applyColorAugment(backColor, Colors.red,
                            100 - chokeMap[i][j] * 100 / CHOKEMAP_CUTOFF);
                    }
                    plotChar(glyph, i, j, foreColor, backColor);
                }
            }
            temporaryMessage("Choke map:", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
            displayLevel();
        },

        // C: IO.c:2289 displayLoops()
        displayLoops(): void {
            const { pmap, getCellApp, plotChar } = buildHelpers();
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    const flags = pmap[i][j].flags;
                    if (flags & TileFlag.IN_LOOP) {
                        const { glyph, foreColor, backColor } = getCellApp(i, j);
                        applyColorAugment(backColor, Colors.yellow, 50);
                        plotChar(glyph, i, j, foreColor, backColor);
                    }
                    if (flags & TileFlag.IS_CHOKEPOINT) {
                        const { glyph, foreColor, backColor } = getCellApp(i, j);
                        applyColorAugment(backColor, Colors.teal, 50);
                        plotChar(glyph, i, j, foreColor, backColor);
                    }
                }
            }
            temporaryMessage("Loops:", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
            displayLevel();
        },
    };
}
