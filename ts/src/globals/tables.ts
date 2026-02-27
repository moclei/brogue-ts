/*
 *  tables.ts — Direction tables, charm increment tables, dynamic color bounds
 *  brogue-ts
 *
 *  Ported from GlobalsBase.c and Globals.c
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color } from "../types/types.js";
import type { Fixpt } from "../types/types.js";
import {
    minersLightStartColor, minersLightEndColor,
    wallBackColorStart, wallBackColorEnd,
    deepWaterBackColorStart, deepWaterBackColorEnd,
    shallowWaterBackColorStart, shallowWaterBackColorEnd,
    floorBackColorStart, floorBackColorEnd,
    chasmEdgeBackColorStart, chasmEdgeBackColorEnd,
} from "./colors.js";
import { DCOLS, DROWS, STAT_BAR_WIDTH, MESSAGE_LINES } from "../types/constants.js";

// =============================================================================
// Direction tables  (from GlobalsBase.c)
// =============================================================================

/**
 * Neighbor directions: N, S, W, E, NW, SW, NE, SE
 * First 4 are cardinal, all 8 include diagonals.
 * Each entry is [dx, dy].
 */
export const nbDirs: readonly [number, number][] = Object.freeze([
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
]);

/**
 * Clockwise directions starting from South:
 * S, SE, E, NE, N, NW, W, SW
 */
export const cDirs: readonly [number, number][] = Object.freeze([
    [0, 1], [1, 1], [1, 0], [1, -1],
    [0, -1], [-1, -1], [-1, 0], [-1, 1],
]);

// =============================================================================
// Map coordinate helpers  (from GlobalsBase.c / Rogue.h macros)
// =============================================================================

/** Window position of the dungeon top-left corner */
export const WINDOW_POSITION_DUNGEON_TOP_LEFT = Object.freeze({
    windowX: STAT_BAR_WIDTH + 3,
    windowY: MESSAGE_LINES + 2,
});

/** Convert dungeon map x to window x */
export function mapToWindowX(x: number): number {
    return x + STAT_BAR_WIDTH + 1;
}

/** Convert dungeon map y to window y */
export function mapToWindowY(y: number): number {
    return y + MESSAGE_LINES + 1;
}

/** Convert window x to dungeon map x */
export function windowToMapX(x: number): number {
    return x - STAT_BAR_WIDTH - 1;
}

/** Convert window y to dungeon map y */
export function windowToMapY(y: number): number {
    return y - MESSAGE_LINES - 1;
}

/** Check if coordinates are within the dungeon map */
export function coordinatesAreInMap(x: number, y: number): boolean {
    return x >= 0 && x < DCOLS && y >= 0 && y < DROWS;
}

/** Check if coordinates are within the visible window */
export function coordinatesAreInWindow(x: number, y: number): boolean {
    return x >= 0 && x < DCOLS && y >= 0 && y < DROWS;
}

/** Check if a Pos is within the dungeon map */
export function isPosInMap(pos: { x: number; y: number }): boolean {
    return pos.x >= 0 && pos.x < DCOLS && pos.y >= 0 && pos.y < DROWS;
}

// =============================================================================
// Dynamic color bounds  (from Globals.c)
// =============================================================================

/**
 * Pairs of [startColor, endColor] for dynamic colors that interpolate at runtime.
 * Index matches NUMBER_DYNAMIC_COLORS order:
 *   0 = miners light, 1 = wall, 2 = deep water,
 *   3 = shallow water, 4 = floor, 5 = chasm edge
 */
export const dynamicColorsBounds: readonly [Color, Color][] = Object.freeze([
    [minersLightStartColor, minersLightEndColor],
    [wallBackColorStart, wallBackColorEnd],
    [deepWaterBackColorStart, deepWaterBackColorEnd],
    [shallowWaterBackColorStart, shallowWaterBackColorEnd],
    [floorBackColorStart, floorBackColorEnd],
    [chasmEdgeBackColorStart, chasmEdgeBackColorEnd],
]);

// =============================================================================
// Charm increment power tables  (from GlobalsBase.c)
// =============================================================================

/** 1.0^x — constant identity (used for charms with no duration scaling) */
export const POW_0_CHARM_INCREMENT: readonly Fixpt[] = Object.freeze([
    65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n,
    65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n,
    65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n,
    65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n,
    65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n, 65536n,
    65536n,
]);

/** 1.20^x fixed point, with x from 1 to 50 in increments of 1 */
export const POW_120_CHARM_INCREMENT: readonly Fixpt[] = Object.freeze([
    78643n, 94371n, 113246n, 135895n, 163074n, 195689n, 234827n, 281792n, 338151n, 405781n,
    486937n, 584325n, 701190n, 841428n, 1009714n, 1211657n, 1453988n, 1744786n, 2093744n, 2512492n,
    3014991n, 3617989n, 4341587n, 5209905n, 6251886n, 7502263n, 9002716n, 10803259n, 12963911n, 15556694n,
    18668032n, 22401639n, 26881967n, 32258360n, 38710033n, 46452039n, 55742447n, 66890937n, 80269124n, 96322949n,
    115587539n, 138705047n, 166446056n, 199735268n, 239682321n, 287618785n, 345142543n, 414171051n, 497005262n, 596406314n,
    715687577n,
]);

/** 1.25^x fixed point, with x from 1 to 50 in increments of 1 */
export const POW_125_CHARM_INCREMENT: readonly Fixpt[] = Object.freeze([
    81920n, 102400n, 128000n, 160000n, 200000n, 250000n, 312500n, 390625n, 488281n, 610351n,
    762939n, 953674n, 1192092n, 1490116n, 1862645n, 2328306n, 2910383n, 3637978n, 4547473n, 5684341n,
    7105427n, 8881784n, 11102230n, 13877787n, 17347234n, 21684043n, 27105054n, 33881317n, 42351647n, 52939559n,
    66174449n, 82718061n, 103397576n, 129246970n, 161558713n, 201948391n, 252435489n, 315544362n, 394430452n, 493038065n,
    616297582n, 770371977n, 962964972n, 1203706215n, 1504632769n, 1880790961n, 2350988701n, 2938735877n, 3673419846n, 4591774807n,
    5739718509n,
]);
