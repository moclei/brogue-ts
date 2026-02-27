/*
 *  fov.ts — Field-of-view (shadowcasting) computation
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c (betweenOctant1andN, scanOctantFOV, getFOVMask)
 *
 *  These functions implement recursive shadowcasting for computing visibility
 *  masks. They are used by the lighting system, architect, and vision updates.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, Fixpt } from "../types/types.js";
import { LOS_SLOPE_GRANULARITY } from "../types/constants.js";
import { coordinatesAreInMap } from "../globals/tables.js";
import { FP_FACTOR, fpSqrt } from "../math/fixpt.js";
import { TileFlag } from "../types/flags.js";

// =============================================================================
// Context interface for FOV computations
// =============================================================================

/**
 * Dependency injection context for FOV calculations.
 * Provides access to terrain and cell flag data needed by scanOctantFOV.
 */
export interface FOVContext {
    /** Check terrain flags at a position. C: cellHasTerrainFlag(pos, flags) */
    cellHasTerrainFlag: (pos: Pos, flagMask: number) => boolean;
    /** Get cell flags (pmap[x][y].flags). */
    getCellFlags: (x: number, y: number) => number;
}

// =============================================================================
// Octant transformation
// =============================================================================

/**
 * Transform coordinates between octant 1 and octant N, using the origin
 * (x0, y0) as the center of symmetry.
 *
 * C equivalent: `betweenOctant1andN` in Movement.c
 *
 * @returns The transformed [x, y] coordinates.
 */
export function betweenOctant1andN(
    x: number,
    y: number,
    x0: number,
    y0: number,
    n: number,
): [number, number] {
    const dx = x - x0;
    const dy = y - y0;

    switch (n) {
        case 1:
            return [x, y];
        case 2:
            return [x, y0 - dy];
        case 3:
            return [x0 - dy, y0 + dx];
        case 4:
            return [x0 + dy, y0 + dx];
        case 5:
            return [x0 - dx, y0 - dy];
        case 6:
            return [x0 - dx, y];
        case 7:
            return [x0 + dy, y0 - dx];
        case 8:
            return [x0 - dy, y0 - dx];
        default:
            return [x, y];
    }
}

// =============================================================================
// Recursive shadowcasting
// =============================================================================

/**
 * Scan one octant for field-of-view using recursive shadowcasting.
 *
 * This is a custom implementation that handles both opaque terrain and
 * forbidden cell flags (e.g., creatures blocking light). The `cautiousOnWalls`
 * parameter controls whether wall tiles are only illuminated if the adjacent
 * non-wall tile closer to the origin is already in the field of view. This
 * prevents lighting artifacts where light leaks around the "wrong" side of
 * a wall.
 *
 * C equivalent: `scanOctantFOV` in Movement.c
 */
export function scanOctantFOV(
    grid: number[][],
    xLoc: number,
    yLoc: number,
    octant: number,
    maxRadius: Fixpt,
    columnsRightFromOrigin: number,
    startSlope: number,
    endSlope: number,
    forbiddenTerrain: number,
    forbiddenFlags: number,
    cautiousOnWalls: boolean,
    ctx: FOVContext,
): void {
    if (BigInt(columnsRightFromOrigin) * FP_FACTOR >= maxRadius) return;

    let newStartSlope: number = startSlope;
    let newEndSlope: number = 0;

    // NOTE: C integer division truncates toward zero. We must use Math.trunc,
    // not Math.floor, to match C semantics for negative values.
    const halfGran = Math.trunc(-LOS_SLOPE_GRANULARITY / 2);
    const a = Math.trunc(
        (halfGran + 1 + startSlope * columnsRightFromOrigin)
        / LOS_SLOPE_GRANULARITY,
    );
    const b = Math.trunc(
        (halfGran + 1 + endSlope * columnsRightFromOrigin)
        / LOS_SLOPE_GRANULARITY,
    );

    const iStart = Math.min(a, b);
    const iEnd = Math.max(a, b);

    // Restrict vision to a circle of radius maxRadius
    const maxRadiusNum = Number(maxRadius);
    const fpFactorNum = Number(FP_FACTOR);
    const maxRSqOverFp2 = (maxRadiusNum * maxRadiusNum) / (fpFactorNum * fpFactorNum);

    if (
        columnsRightFromOrigin * columnsRightFromOrigin + iEnd * iEnd
        >= maxRSqOverFp2
    ) {
        return;
    }

    let adjustedIStart = iStart;
    if (
        columnsRightFromOrigin * columnsRightFromOrigin + iStart * iStart
        >= maxRSqOverFp2
    ) {
        // Clamp iStart to the circle boundary
        const innerVal = (maxRadius * maxRadius / FP_FACTOR)
            - BigInt(columnsRightFromOrigin * columnsRightFromOrigin) * FP_FACTOR;
        adjustedIStart = -Number(fpSqrt(innerVal) / FP_FACTOR);
    }

    // Check if the initial cell (before the loop) is lit
    let [tx, ty] = betweenOctant1andN(
        xLoc + columnsRightFromOrigin,
        yLoc + adjustedIStart,
        xLoc,
        yLoc,
        octant,
    );
    let currentlyLit =
        coordinatesAreInMap(tx, ty)
        && !(
            ctx.cellHasTerrainFlag({ x: tx, y: ty }, forbiddenTerrain)
            || (ctx.getCellFlags(tx, ty) & forbiddenFlags)
        );

    for (let i = adjustedIStart; i <= iEnd; i++) {
        [tx, ty] = betweenOctant1andN(
            xLoc + columnsRightFromOrigin,
            yLoc + i,
            xLoc,
            yLoc,
            octant,
        );

        if (!coordinatesAreInMap(tx, ty)) {
            continue;
        }

        const cellObstructed =
            ctx.cellHasTerrainFlag({ x: tx, y: ty }, forbiddenTerrain)
            || !!(ctx.getCellFlags(tx, ty) & forbiddenFlags);

        // If we're cautious on walls and this is a wall:
        if (cautiousOnWalls && cellObstructed) {
            // (x2, y2) is the tile one space closer to the origin from the tile we're on:
            let closerY = i;
            if (i < 0) {
                closerY = i + 1;
            } else if (i > 0) {
                closerY = i - 1;
            }
            const [x2, y2] = betweenOctant1andN(
                xLoc + columnsRightFromOrigin - 1,
                yLoc + closerY,
                xLoc,
                yLoc,
                octant,
            );

            if (
                coordinatesAreInMap(x2, y2)
                && (ctx.getCellFlags(x2, y2) & TileFlag.IN_FIELD_OF_VIEW)
            ) {
                // Previous tile is visible, so illuminate
                grid[tx][ty] = 1;
            }
        } else {
            // Illuminate
            grid[tx][ty] = 1;
        }

        if (!cellObstructed && !currentlyLit) {
            // Transition from dark to lit: next column slope starts here
            // C: (long int) ((LOS_SLOPE_GRANULARITY * (i) - LOS_SLOPE_GRANULARITY / 2) / (columnsRightFromOrigin * 2 + 1) * 2)
            newStartSlope = Math.trunc(
                (LOS_SLOPE_GRANULARITY * i - Math.trunc(LOS_SLOPE_GRANULARITY / 2))
                / (columnsRightFromOrigin * 2 + 1),
            ) * 2;
            currentlyLit = true;
        } else if (cellObstructed && currentlyLit) {
            // Transition from lit to dark: next column slope ends here
            newEndSlope = Math.trunc(
                (LOS_SLOPE_GRANULARITY * i - Math.trunc(LOS_SLOPE_GRANULARITY / 2))
                / (columnsRightFromOrigin * 2 - 1),
            ) * 2;
            if (newStartSlope <= newEndSlope) {
                // Recurse into the next column
                scanOctantFOV(
                    grid, xLoc, yLoc, octant, maxRadius,
                    columnsRightFromOrigin + 1,
                    newStartSlope, newEndSlope,
                    forbiddenTerrain, forbiddenFlags,
                    cautiousOnWalls, ctx,
                );
            }
            currentlyLit = false;
        }
    }

    if (currentlyLit) {
        // Got to the bottom of the scan while lit
        newEndSlope = endSlope;
        if (newStartSlope <= newEndSlope) {
            scanOctantFOV(
                grid, xLoc, yLoc, octant, maxRadius,
                columnsRightFromOrigin + 1,
                newStartSlope, newEndSlope,
                forbiddenTerrain, forbiddenFlags,
                cautiousOnWalls, ctx,
            );
        }
    }
}

// =============================================================================
// Public FOV mask generation
// =============================================================================

/**
 * Compute a field-of-view mask from (xLoc, yLoc) with the given radius.
 * Cells visible from the origin are set to 1 in the grid; others are 0.
 *
 * @param grid - A DCOLS×DROWS grid. Should be zeroed before calling. Cells
 *   within the FOV will be set to 1.
 * @param xLoc - Origin X coordinate.
 * @param yLoc - Origin Y coordinate.
 * @param maxRadius - Maximum vision radius (in fixed-point).
 * @param forbiddenTerrain - Terrain flags that block vision (e.g., T_OBSTRUCTS_VISION).
 * @param forbiddenFlags - Cell flags that block vision (e.g., HAS_MONSTER | HAS_PLAYER).
 * @param cautiousOnWalls - If true, wall tiles are only illuminated if the adjacent
 *   non-wall tile closer to the origin is already in the field of view.
 * @param ctx - FOV context providing terrain and cell flag access.
 *
 * C equivalent: `getFOVMask` in Movement.c
 */
export function getFOVMask(
    grid: number[][],
    xLoc: number,
    yLoc: number,
    maxRadius: Fixpt,
    forbiddenTerrain: number,
    forbiddenFlags: number,
    cautiousOnWalls: boolean,
    ctx: FOVContext,
): void {
    for (let octant = 1; octant <= 8; octant++) {
        scanOctantFOV(
            grid, xLoc, yLoc, octant, maxRadius,
            1, -LOS_SLOPE_GRANULARITY, 0,
            forbiddenTerrain, forbiddenFlags,
            cautiousOnWalls, ctx,
        );
    }
}
