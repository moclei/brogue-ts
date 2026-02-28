/*
 *  bolt-geometry.ts — Bolt path calculation (pure geometry)
 *  brogue-ts
 *
 *  Ported from Items.c: getLineCoordinates, getImpactLoc, reflectBolt.
 *
 *  These functions compute bolt paths using fixed-point line-tracing.
 *  The evaluation/scoring of paths (which depends on game state) is
 *  injected via callbacks.
 */

import type { Pos, Bolt } from "../types/types.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { DCOLS, DROWS, MAX_BOLT_LENGTH } from "../types/constants.js";
import { coordinatesAreInMap } from "../globals/tables.js";

// =============================================================================
// Constants
// =============================================================================

/** Diamond-exit-rule waypoint offsets (percentages within target cell). */
const OFFSETS: readonly [number, number][] = [
    [50, 50], // center of the square first
    [40, 40], [60, 40], [60, 60], [40, 60],
    [50, 30], [70, 50], [50, 70], [30, 50],
    [50, 20], [80, 50], [50, 80], [20, 50],
    [50, 10], [90, 50], [50, 90], [10, 50],
    [50, 1],  [99, 50], [50, 99], [1, 50],
];
const NUM_OFFSETS = OFFSETS.length; // 21

/** Sentinel position marking the end of a coordinate list. */
export const INVALID_POS: Readonly<Pos> = Object.freeze({ x: -1, y: -1 });

// =============================================================================
// Types
// =============================================================================

/**
 * Callback to evaluate a candidate bolt path. The function receives the path
 * coordinates and bolt info, and returns a numeric score. Higher is better.
 *
 * If null/undefined, no evaluation is performed and the center-of-target
 * path is returned (equivalent to `theBolt == NULL` in C).
 */
export type BoltPathEvaluator = (
    path: readonly Pos[],
    originLoc: Pos,
    targetLoc: Pos,
    theBolt: Bolt,
) => number;

/**
 * Callback to check if a cell blocks line of sight for impact loc.
 * Returns true if the cell at the given position blocks.
 */
export type CellBlocksCheck = (loc: Pos) => boolean;

/**
 * Callback to check if a creature is at the given position and visible.
 * Returns true if an obstructing creature is there.
 */
export type CreatureAtCheck = (loc: Pos, originLoc: Pos) => boolean;

// =============================================================================
// getLineCoordinates — from Items.c:3415
// =============================================================================

/**
 * Trace a line from originLoc toward targetLoc using fixed-point arithmetic.
 * Without an evaluator, returns the first (center-of-target) path.
 * With an evaluator, tries 21 waypoint offsets and returns the best-scoring path.
 *
 * C: short getLineCoordinates(pos listOfCoordinates[], const pos originLoc,
 *                              const pos targetLoc, const bolt *theBolt)
 *
 * @param originLoc The starting position (center is used).
 * @param targetLoc The target position.
 * @param theBolt Optional bolt for path evaluation. If null, no tuning.
 * @param evaluator Optional callback to score candidate paths.
 * @returns An array of Pos coordinates along the line (not including origin).
 */
export function getLineCoordinates(
    originLoc: Pos,
    targetLoc: Pos,
    theBolt: Bolt | null = null,
    evaluator: BoltPathEvaluator | null = null,
): Pos[] {
    if (originLoc.x === targetLoc.x && originLoc.y === targetLoc.y) {
        return [];
    }

    let bestScore = 0;
    let bestOffset = 0;
    let bestPath: Pos[] = [];

    const totalIterations = (theBolt && evaluator) ? NUM_OFFSETS + 1 : 1;

    for (let offset = 0; offset < totalIterations; offset++) {
        const useOffset = offset < NUM_OFFSETS ? offset : bestOffset;

        // Always shoot from the center of the origin cell
        let px = BigInt(originLoc.x) * FP_FACTOR + FP_FACTOR / 2n;
        let py = BigInt(originLoc.y) * FP_FACTOR + FP_FACTOR / 2n;

        // Vector to target (with waypoint offset within target cell)
        let sx = BigInt(targetLoc.x) * FP_FACTOR
            + BigInt(OFFSETS[useOffset][0]) * FP_FACTOR / 100n
            - px;
        let sy = BigInt(targetLoc.y) * FP_FACTOR
            + BigInt(OFFSETS[useOffset][1]) * FP_FACTOR / 100n
            - py;

        // Normalize step to move exactly one row or column at a time
        const absSx = sx < 0n ? -sx : sx;
        const absSy = sy < 0n ? -sy : sy;
        const m = absSx > absSy ? absSx : absSy;
        sx = sx * FP_FACTOR / m;
        sy = sy * FP_FACTOR / m;

        // Trace the line
        const path: Pos[] = [];
        while (true) {
            px += sx;
            py += sy;
            const cellX = px < 0n ? -1 : Number(px / FP_FACTOR);
            const cellY = py < 0n ? -1 : Number(py / FP_FACTOR);

            if (!coordinatesAreInMap(cellX, cellY)) break;
            path.push({ x: cellX, y: cellY });
        }

        // Last iteration: just return the path using the best offset
        if (offset === NUM_OFFSETS) {
            bestPath = path;
            break;
        }

        // No bolt/evaluator: return first path (center-of-target)
        if (!theBolt || !evaluator) {
            bestPath = path;
            break;
        }

        // Evaluate this path
        const score = evaluator(path, originLoc, targetLoc, theBolt);
        if (score > bestScore) {
            bestScore = score;
            bestOffset = offset;
        }
    }

    return bestPath;
}

// =============================================================================
// getImpactLoc — from Items.c:3569
// =============================================================================

/**
 * Determine where a bolt would stop given the line from origin to target.
 * Uses callbacks to check for creatures and terrain obstructions.
 *
 * C: void getImpactLoc(pos *returnLoc, const pos originLoc, const pos targetLoc,
 *                       const short maxDistance, const boolean returnLastEmptySpace,
 *                       const bolt *theBolt)
 *
 * @param originLoc The origin position.
 * @param targetLoc The target position.
 * @param maxDistance Maximum bolt travel distance.
 * @param returnLastEmptySpace If true, return the last unblocked position.
 * @param theBolt The bolt (for path calculation).
 * @param creatureBlocks Callback checking if a creature blocks at a position.
 * @param cellBlocks Callback checking if terrain blocks at a position.
 * @param evaluator Optional path evaluator.
 * @returns The impact position.
 */
export function getImpactLoc(
    originLoc: Pos,
    targetLoc: Pos,
    maxDistance: number,
    returnLastEmptySpace: boolean,
    theBolt: Bolt | null,
    creatureBlocks: CreatureAtCheck,
    cellBlocks: CellBlocksCheck,
    evaluator: BoltPathEvaluator | null = null,
): Pos {
    const coords = getLineCoordinates(originLoc, targetLoc, theBolt, evaluator);
    const n = Math.min(coords.length, maxDistance);

    let i: number;
    for (i = 0; i < n; i++) {
        if (creatureBlocks(coords[i], originLoc)) break;
        if (cellBlocks(coords[i])) break;
    }

    if (i === maxDistance) {
        return { ...coords[i - 1] };
    } else if (returnLastEmptySpace) {
        if (i === 0) {
            return { ...originLoc };
        } else {
            return { ...coords[i - 1] };
        }
    } else {
        if (i < coords.length) {
            return { ...coords[i] };
        }
        // Bolt went off the map — return last valid position
        return coords.length > 0 ? { ...coords[coords.length - 1] } : { ...originLoc };
    }
}

// =============================================================================
// reflectBolt — from Items.c:4244
// =============================================================================

/**
 * Compute the reflected path of a bolt at a kink cell.
 * Modifies the coordinate list in-place after the kink point.
 *
 * C: short reflectBolt(short targetX, short targetY, pos listOfCoordinates[],
 *                       short kinkCell, boolean retracePath)
 *
 * @param targetX Target X (for retrace mode, this is typically the caster's X).
 * @param targetY Target Y (for retrace mode, this is typically the caster's Y).
 * @param listOfCoordinates The mutable coordinate array.
 * @param kinkCell The index where reflection occurs.
 * @param retracePath If true, the bolt retraces toward the caster then extends.
 * @param randRange RNG function for random target selection.
 * @returns The new total path length.
 */
export function reflectBolt(
    targetX: number,
    targetY: number,
    listOfCoordinates: Pos[],
    kinkCell: number,
    retracePath: boolean,
    randRange: (lo: number, hi: number) => number,
): number {
    const needRandomTarget = (
        targetX < 0 || targetY < 0
        || (targetX === listOfCoordinates[kinkCell].x && targetY === listOfCoordinates[kinkCell].y)
    );

    let finalLength: number;

    if (retracePath) {
        // Retrace: follow the exact trajectory back to the caster
        for (let k = 1; k <= kinkCell && kinkCell + k < MAX_BOLT_LENGTH; k++) {
            listOfCoordinates[kinkCell + k] = { ...listOfCoordinates[kinkCell - k] };
        }

        // Compute extension path beyond the caster
        const origin = listOfCoordinates[2 * kinkCell];
        const target: Pos = {
            x: targetX + (targetX - listOfCoordinates[kinkCell].x),
            y: targetY + (targetY - listOfCoordinates[kinkCell].y),
        };

        // NULL bolt because reflected path should not be tuned
        const newPath = getLineCoordinates(origin, target, null, null);
        const newPathLength = newPath.length;

        for (let k = 0; k < newPathLength; k++) {
            listOfCoordinates[2 * kinkCell + k + 1] = { ...newPath[k] };
        }
        finalLength = 2 * kinkCell + newPathLength + 1;
    } else {
        // Non-retrace: pick a new random target and extend
        let failsafe = 50;
        let newTarget: Pos;

        if (needRandomTarget) {
            do {
                newTarget = {
                    x: randRange(0, DCOLS - 1),
                    y: randRange(0, DROWS - 1),
                };
                failsafe--;
            } while (
                failsafe > 0
                && (newTarget.x === listOfCoordinates[kinkCell].x && newTarget.y === listOfCoordinates[kinkCell].y)
            );
        } else {
            newTarget = { x: targetX, y: targetY };
        }

        const newPath = getLineCoordinates(listOfCoordinates[kinkCell], newTarget, null, null);
        const newPathLength = newPath.length;

        for (let k = 0; k < newPathLength; k++) {
            listOfCoordinates[kinkCell + k + 1] = { ...newPath[k] };
        }
        finalLength = kinkCell + newPathLength + 1;
    }

    // Truncate
    listOfCoordinates.length = finalLength;
    return finalLength;
}

// =============================================================================
// openPathBetween — from Items.c:4623
// =============================================================================

/**
 * Check if there is an open (unobstructed) straight-line path between two positions.
 * Uses the same line-tracing algorithm as bolts.
 *
 * C: boolean openPathBetween(pos fromLoc, pos toLoc)
 *
 * @param fromLoc Starting position.
 * @param toLoc Ending position.
 * @param cellBlocks Callback to check if a cell blocks passage.
 * @returns True if the path is clear, false if any cell blocks.
 */
export function openPathBetween(
    fromLoc: Pos,
    toLoc: Pos,
    cellBlocks: CellBlocksCheck,
): boolean {
    const coords = getLineCoordinates(fromLoc, toLoc, null, null);

    for (const pos of coords) {
        if (pos.x === toLoc.x && pos.y === toLoc.y) {
            return true; // Reached target without obstruction
        }
        if (cellBlocks(pos)) {
            return false;
        }
    }

    return false; // Target not reached (shouldn't normally happen)
}
