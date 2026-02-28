/*
 *  io-targeting.ts — Cursor path, snap map, and targeting helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c (lines 34–163)
 *  Functions: getPlayerPathOnMap, reversePath, hilitePath, clearCursorPath,
 *             hideCursor, showCursor, getClosestValidLocationOnMap,
 *             processSnapMap, hiliteCell
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, Creature, Color, Pcell } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { Direction } from "../types/enums.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { TileFlag, TerrainMechFlag } from "../types/flags.js";
import { coordinatesAreInMap, isPosInMap, posNeighborInDirection, nbDirs } from "../globals/tables.js";
import { INVALID_POS } from "../types/types.js";

// =============================================================================
// Types
// =============================================================================

type Grid = number[][];

/**
 * DI context for targeting / cursor functions.
 *
 * Keeps these functions decoupled from global state.  Callers build the
 * context from whatever concrete services they have available.
 */
export interface TargetingContext {
    /** Current game state. */
    rogue: {
        playbackMode: boolean;
        cursorMode: boolean;
        cursorPathIntensity: number;
        cursorLoc: Pos;
    };

    /** The player creature. */
    player: Creature;

    /** Dungeon cell map (DCOLS × DROWS). */
    pmap: Pcell[][];

    // -- Pathfinding helpers --------------------------------------------------

    /**
     * Follow the distance map one step from `target`, returning the best
     * direction (or Direction.NoDirection if stuck).
     *
     * C: `nextStep` in Movement.c / IO.c
     */
    nextStep(distanceMap: Grid, target: Pos, monst: Creature | null, preferDiagonals: boolean): Direction;

    // -- Dijkstra / cost maps -------------------------------------------------

    /** Allocate a DCOLS × DROWS grid filled with 0. */
    allocGrid(): Grid;

    /** Fill every cell of `grid` with `value`. */
    fillGrid(grid: Grid, value: number): void;

    /** Run Dijkstra scan in‑place on the distance map. */
    dijkstraScan(distanceMap: Grid, costMap: Grid | null, useDiagonals: boolean): void;

    /** Build a creature cost map for pathfinding. */
    populateCreatureCostMap(costMap: Grid, monst: Creature): void;

    // -- Tile queries ---------------------------------------------------------

    /** Check whether a cell has a specific terrain mechanic flag. */
    cellHasTMFlag(pos: Pos, flag: number): boolean;

    // -- Rendering (stubbed until full IO wiring) -----------------------------

    /** Repaint a single dungeon cell. */
    refreshDungeonCell(loc: Pos): void;

    /**
     * Retrieve the visual appearance of a cell.
     *
     * C: `getCellAppearance` in IO.c
     */
    getCellAppearance(loc: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color };

    /**
     * Apply a highlight tint over a dungeon cell's current appearance.
     *
     * C: `hiliteCell` in IO.c
     */
    applyColorAugment(base: Color, augment: Readonly<Color>, strength: number): void;
    separateColors(foreColor: Color, backColor: Color): void;

    /**
     * Plot a single character at window coordinates.
     *
     * C: `plotCharWithColor` in IO.c
     */
    plotCharWithColor(glyph: DisplayGlyph, windowPos: { windowX: number; windowY: number }, foreColor: Color, backColor: Color): void;

    /** Convert dungeon coordinates to window coordinates. */
    mapToWindow(loc: Pos): { windowX: number; windowY: number };
}

// =============================================================================
// getPlayerPathOnMap — IO.c:34
// =============================================================================

/**
 * Follow a Dijkstra distance map from `origin`, placing each step into
 * `path`.  Returns the number of steps.
 *
 * C: `getPlayerPathOnMap` in IO.c
 */
export function getPlayerPathOnMap(
    path: Pos[],
    map: Grid,
    origin: Pos,
    ctx: TargetingContext,
): number {
    let at = { ...origin };
    let steps = 0;

    while (true) {
        const dir = ctx.nextStep(map, at, ctx.player, false);
        if (dir === Direction.NoDirection) {
            break;
        }
        at = posNeighborInDirection(at, dir);
        path[steps] = at;
        steps++;
    }

    return steps;
}

// =============================================================================
// reversePath — IO.c:50
// =============================================================================

/**
 * Reverse the first `steps` entries of `path` in place.
 *
 * C: `reversePath` in IO.c
 */
export function reversePath(path: Pos[], steps: number): void {
    for (let i = 0; i < Math.trunc(steps / 2); i++) {
        const temp = path[steps - i - 1];
        path[steps - i - 1] = path[i];
        path[i] = temp;
    }
}

// =============================================================================
// hilitePath — IO.c:58
// =============================================================================

/**
 * Set or clear `IS_IN_PATH` for each cell in `path` and refresh the cell.
 *
 * C: `hilitePath` in IO.c
 */
export function hilitePath(
    path: Pos[],
    steps: number,
    unhilite: boolean,
    ctx: TargetingContext,
): void {
    if (unhilite) {
        for (let i = 0; i < steps; i++) {
            ctx.pmap[path[i].x][path[i].y].flags &= ~TileFlag.IS_IN_PATH;
            ctx.refreshDungeonCell(path[i]);
        }
    } else {
        for (let i = 0; i < steps; i++) {
            ctx.pmap[path[i].x][path[i].y].flags |= TileFlag.IS_IN_PATH;
            ctx.refreshDungeonCell(path[i]);
        }
    }
}

// =============================================================================
// clearCursorPath — IO.c:75
// =============================================================================

/**
 * Clear `IS_IN_PATH` from every cell in the dungeon.  More expensive than
 * `hilitePath(…, true)` but doesn't require the path array.
 *
 * C: `clearCursorPath` in IO.c
 */
export function clearCursorPath(ctx: TargetingContext): void {
    if (!ctx.rogue.playbackMode) {
        for (let i = 1; i < DCOLS; i++) {
            for (let j = 1; j < DROWS; j++) {
                if (ctx.pmap[i][j].flags & TileFlag.IS_IN_PATH) {
                    ctx.pmap[i][j].flags &= ~TileFlag.IS_IN_PATH;
                    ctx.refreshDungeonCell({ x: i, y: j });
                }
            }
        }
    }
}

// =============================================================================
// hideCursor — IO.c:90
// =============================================================================

/**
 * Drop out of cursor mode and hide the cursor.
 *
 * C: `hideCursor` in IO.c
 */
export function hideCursor(ctx: TargetingContext): void {
    ctx.rogue.cursorMode = false;
    ctx.rogue.cursorPathIntensity = ctx.rogue.cursorMode ? 50 : 20;
    ctx.rogue.cursorLoc = { ...INVALID_POS };
}

// =============================================================================
// showCursor — IO.c:97
// =============================================================================

/**
 * Enter cursor mode.  If the cursor isn't on the map, snap it to the player.
 *
 * C: `showCursor` in IO.c
 */
export function showCursor(ctx: TargetingContext): void {
    if (!isPosInMap(ctx.rogue.cursorLoc)) {
        ctx.rogue.cursorLoc = { ...ctx.player.loc };
        ctx.rogue.cursorMode = true;
        ctx.rogue.cursorPathIntensity = 50;
    } else {
        ctx.rogue.cursorMode = true;
        ctx.rogue.cursorPathIntensity = 50;
    }
}

// =============================================================================
// getClosestValidLocationOnMap — IO.c:109
// =============================================================================

/**
 * Find the closest reachable cell in `map` to (x, y).
 * Tie-breaks by lowest map score.
 *
 * C: `getClosestValidLocationOnMap` in IO.c (static)
 */
export function getClosestValidLocationOnMap(
    map: Grid,
    x: number,
    y: number,
): Pos {
    let answer: Pos = { ...INVALID_POS };
    let closestDistance = 10000;
    let lowestMapScore = 10000;

    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            if (map[i][j] >= 0 && map[i][j] < 30000) {
                const dist = (i - x) * (i - x) + (j - y) * (j - y);
                if (
                    dist < closestDistance ||
                    (dist === closestDistance && map[i][j] < lowestMapScore)
                ) {
                    answer = { x: i, y: j };
                    closestDistance = dist;
                    lowestMapScore = map[i][j];
                }
            }
        }
    }

    return answer;
}

// =============================================================================
// processSnapMap — IO.c:134
// =============================================================================

/**
 * Build a cursor snap map: Dijkstra from the player, then pull
 * `TM_INVERT_WHEN_HIGHLIGHTED` cells toward their reachable neighbours.
 *
 * C: `processSnapMap` in IO.c (static)
 */
export function processSnapMap(
    map: Grid,
    ctx: TargetingContext,
): void {
    const costMap = ctx.allocGrid();

    ctx.populateCreatureCostMap(costMap, ctx.player);
    ctx.fillGrid(map, 30000);
    map[ctx.player.loc.x][ctx.player.loc.y] = 0;
    ctx.dijkstraScan(map, costMap, true);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_INVERT_WHEN_HIGHLIGHTED)) {
                for (let dir = 0; dir < 4; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(newX, newY) &&
                        map[newX][newY] >= 0 &&
                        map[newX][newY] < map[i][j]
                    ) {
                        map[i][j] = map[newX][newY];
                    }
                }
            }
        }
    }

    // costMap released by GC (no freeGrid needed)
}

// =============================================================================
// hiliteCell — IO.c:1711
// =============================================================================

/**
 * Highlight a single dungeon cell by tinting its appearance with a color.
 *
 * C: `hiliteCell` in IO.c
 */
export function hiliteCell(
    x: number,
    y: number,
    hiliteColor: Readonly<Color>,
    hiliteStrength: number,
    distinctColors: boolean,
    ctx: TargetingContext,
): void {
    const { glyph, foreColor, backColor } = ctx.getCellAppearance({ x, y });
    ctx.applyColorAugment(foreColor, hiliteColor, hiliteStrength);
    ctx.applyColorAugment(backColor, hiliteColor, hiliteStrength);
    if (distinctColors) {
        ctx.separateColors(foreColor, backColor);
    }
    ctx.plotCharWithColor(glyph, ctx.mapToWindow({ x, y }), foreColor, backColor);
}
