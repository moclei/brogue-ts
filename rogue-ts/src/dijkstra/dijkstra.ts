/*
 *  dijkstra.ts — Dijkstra scanning algorithm for pathfinding distance maps
 *  brogue-ts
 *
 *  Ported from: src/brogue/Dijkstra.c (259 lines)
 *  Original code by Joshua Day.
 *
 *  The core dijkstraScan function is pure: grid in, grid out, no game state.
 *  The calculateDistances function depends on game state helpers (terrain
 *  queries, creature queries) — these are injected via a context interface.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { DCOLS, DROWS, PDS_FORBIDDEN, PDS_OBSTRUCTION } from "../types/constants.js";
import type { Pos, Creature } from "../types/types.js";
import type { Grid } from "../grid/grid.js";
import { allocGrid, freeGrid } from "../grid/grid.js";
import { nbDirs } from "../globals/tables.js";

// =============================================================================
// Internal types (private to module)
// =============================================================================

/**
 * A node in the priority-sorted linked list used by the Dijkstra scanner.
 * In C these are stored in a flat array; we keep the same layout and use
 * object references for the linked list pointers.
 *
 * C equivalent: `pdsLink` struct in Dijkstra.c
 */
interface PdsLink {
    /** Index in the flat links array (x + DCOLS * y). */
    index: number;
    /** Current shortest distance to this cell. */
    distance: number;
    /** Movement cost for this cell. Negative = impassable. */
    cost: number;
    /** Previous node in the sorted linked list (or null). */
    left: PdsLink | null;
    /** Next node in the sorted linked list (or null). */
    right: PdsLink | null;
}

/**
 * Priority queue backed by a sorted doubly-linked list over a flat cell array.
 *
 * C equivalent: `pdsMap` struct in Dijkstra.c
 */
interface PdsMap {
    /** Sentinel node at the front of the sorted list. */
    front: PdsLink;
    /** Flat array of DCOLS*DROWS links, indexed by (x + DCOLS * y). */
    links: PdsLink[];
}

// =============================================================================
// PdsMap helpers
// =============================================================================

/** Access the PdsLink at grid position (x, y). Equivalent to C's PDS_CELL macro. */
function pdsCell(map: PdsMap, x: number, y: number): PdsLink {
    return map.links[x + DCOLS * y];
}

/** Create a fresh PdsMap with all links initialized. */
function createPdsMap(): PdsMap {
    const links: PdsLink[] = new Array(DCOLS * DROWS);
    for (let i = 0; i < DCOLS * DROWS; i++) {
        links[i] = {
            index: i,
            distance: 0,
            cost: 0,
            left: null,
            right: null,
        };
    }
    const front: PdsLink = {
        index: -1,
        distance: -1,
        cost: 0,
        left: null,
        right: null,
    };
    return { front, links };
}

// =============================================================================
// Core PDS algorithm (all private/internal)
// =============================================================================

/**
 * Process the priority queue: for each queued cell, relax its neighbors.
 * This is the main Dijkstra relaxation loop.
 *
 * C equivalent: `pdsUpdate` in Dijkstra.c
 */
function pdsUpdate(map: PdsMap, useDiagonals: boolean): void {
    const dirs = useDiagonals ? 8 : 4;

    let head: PdsLink | null = map.front.right;
    map.front.right = null;

    while (head !== null) {
        for (let dir = 0; dir < dirs; dir++) {
            const neighborIndex = head.index + (nbDirs[dir][0] + DCOLS * nbDirs[dir][1]);

            // Bounds check: ensure the neighbor index is within the flat array
            if (neighborIndex < 0 || neighborIndex >= DCOLS * DROWS) continue;

            const link = map.links[neighborIndex];

            // Verify passability
            if (link.cost < 0) continue;

            // Diagonal movement check: both cardinal components must be passable
            if (dir >= 4) {
                const way1Index = head.index + nbDirs[dir][0];
                const way2Index = head.index + DCOLS * nbDirs[dir][1];
                if (way1Index < 0 || way1Index >= DCOLS * DROWS
                    || way2Index < 0 || way2Index >= DCOLS * DROWS) continue;
                const way1 = map.links[way1Index];
                const way2 = map.links[way2Index];
                if (way1.cost === PDS_OBSTRUCTION || way2.cost === PDS_OBSTRUCTION) continue;
            }

            if (head.distance + link.cost < link.distance) {
                link.distance = head.distance + link.cost;

                // Remove link from its current position in the list
                if (link.right !== null) link.right.left = link.left;
                if (link.left !== null) link.left.right = link.right;

                // Reinsert at the correct sorted position (starting from head)
                let left: PdsLink | null = head;
                let right: PdsLink | null = head.right;
                while (right !== null && right.distance < link.distance) {
                    left = right;
                    right = right.right;
                }
                if (left !== null) left.right = link;
                link.right = right;
                link.left = left;
                if (right !== null) right.left = link;
            }
        }

        const nextHead: PdsLink | null = head.right;
        head.left = null;
        head.right = null;
        head = nextHead;
    }
}

/**
 * Clear all distances in the map to maxDistance and unlink all nodes.
 *
 * C equivalent: `pdsClear` in Dijkstra.c
 */
function pdsClear(map: PdsMap, maxDistance: number): void {
    map.front.right = null;

    for (let i = 0; i < DCOLS * DROWS; i++) {
        map.links[i].distance = maxDistance;
        map.links[i].left = null;
        map.links[i].right = null;
    }
}

/**
 * Set the distance for a specific cell and insert it into the priority queue.
 * Only updates if the new distance is less than the current distance.
 *
 * C equivalent: `pdsSetDistance` in Dijkstra.c
 */
function pdsSetDistance(map: PdsMap, x: number, y: number, distance: number): void {
    if (x > 0 && y > 0 && x < DCOLS - 1 && y < DROWS - 1) {
        const link = pdsCell(map, x, y);

        if (link.distance > distance) {
            link.distance = distance;

            // Remove from current position
            if (link.right !== null) link.right.left = link.left;
            if (link.left !== null) link.left.right = link.right;

            // Insert at sorted position from front
            let left: PdsLink = map.front;
            let right: PdsLink | null = map.front.right;

            while (right !== null && right.distance < link.distance) {
                left = right;
                right = right.right;
            }

            link.right = right;
            link.left = left;
            left.right = link;
            if (right !== null) right.left = link;
        }
    }
}

/**
 * Load distances and costs from the grid arrays into the PDS map and build
 * the initial priority queue.
 *
 * If distanceMap is provided, initial distances come from it.
 * If costMap is provided, costs come from it; otherwise costs are computed
 * from terrain passability (via the cellHasTerrainFlag callback).
 *
 * C equivalent: `pdsBatchInput` in Dijkstra.c
 *
 * @param cellHasTerrainFlagFn - Callback to check terrain flags at a position.
 *   Only needed when costMap is null. Matches the signature:
 *   (pos: Pos, flagMask: number) => boolean
 */
function pdsBatchInput(
    map: PdsMap,
    distanceMap: Grid | null,
    costMap: Grid | null,
    maxDistance: number,
    cellHasTerrainFlagFn?: (pos: Pos, flagMask: number) => boolean,
): void {
    let left: PdsLink | null = null;
    let right: PdsLink | null = null;

    map.front.right = null;

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const link = pdsCell(map, i, j);

            if (distanceMap !== null) {
                link.distance = distanceMap[i][j];
            } else {
                if (costMap !== null) {
                    // totally hackish; refactor (preserved comment from original C)
                    link.distance = maxDistance;
                }
            }

            let cost: number;

            if (i === 0 || j === 0 || i === DCOLS - 1 || j === DROWS - 1) {
                cost = PDS_OBSTRUCTION;
            } else if (costMap === null) {
                // When no cost map is provided, derive costs from terrain.
                // This path requires the terrain flag callback.
                if (cellHasTerrainFlagFn) {
                    const pos: Pos = { x: i, y: j };
                    const obstructsPassability = cellHasTerrainFlagFn(pos, T_OBSTRUCTS_PASSABILITY);
                    const obstructsDiagonal = cellHasTerrainFlagFn(pos, T_OBSTRUCTS_DIAGONAL_MOVEMENT);

                    if (obstructsPassability && obstructsDiagonal) {
                        cost = PDS_OBSTRUCTION;
                    } else {
                        cost = PDS_FORBIDDEN;
                    }
                } else {
                    // Fallback: treat as forbidden if no callback provided
                    cost = PDS_FORBIDDEN;
                }
            } else {
                cost = costMap[i][j];
            }

            link.cost = cost;

            if (cost > 0) {
                if (link.distance < maxDistance) {
                    if (right === null || right.distance > link.distance) {
                        // Reset traversal pointers when a closer cell is found
                        left = map.front;
                        // TS can't track aliased mutations, so we assert the type here.
                        // map.front.right may have been modified via left.right = link above.
                        right = map.front.right as PdsLink | null;
                    }

                    while (right !== null && right.distance < link.distance) {
                        left = right;
                        right = right.right as PdsLink | null;
                    }

                    link.right = right;
                    link.left = left!;
                    left!.right = link;
                    if (right !== null) right.left = link;

                    left = link;
                } else {
                    link.right = null;
                    link.left = null;
                }
            } else {
                link.right = null;
                link.left = null;
            }
        }
    }
}

/**
 * Run the Dijkstra update and transfer results back to the distance map.
 *
 * C equivalent: `pdsBatchOutput` in Dijkstra.c
 */
function pdsBatchOutput(map: PdsMap, distanceMap: Grid, useDiagonals: boolean): void {
    pdsUpdate(map, useDiagonals);
    // Transfer results to the distanceMap
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            distanceMap[i][j] = pdsCell(map, i, j).distance;
        }
    }
}

// =============================================================================
// Terrain flag constants (imported here for use in pdsBatchInput)
// =============================================================================

import { TerrainFlag } from "../types/flags.js";

const T_OBSTRUCTS_PASSABILITY = TerrainFlag.T_OBSTRUCTS_PASSABILITY;
const T_OBSTRUCTS_DIAGONAL_MOVEMENT = TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT;

// =============================================================================
// Public API
// =============================================================================

/**
 * Perform a Dijkstra scan on a distance/cost map.
 *
 * This is the pure pathfinding core — no game state dependencies.
 * The distanceMap serves as both input (initial distances) and output
 * (computed shortest distances). Cells with distance < 30000 are sources.
 *
 * @param distanceMap - Grid to scan. Pre-set cells with low values as sources,
 *   high values (30000) as unvisited. Modified in place with shortest distances.
 * @param costMap - Grid of movement costs. Positive = traversable,
 *   PDS_FORBIDDEN (-1) = impassable, PDS_OBSTRUCTION (-2) = blocks diagonals.
 *   If null, costs are derived from terrain flags (requires game state).
 * @param useDiagonals - Whether to allow diagonal movement.
 *
 * C equivalent: `dijkstraScan` in Dijkstra.c
 */
export function dijkstraScan(
    distanceMap: Grid,
    costMap: Grid | null,
    useDiagonals: boolean,
): void {
    const map = createPdsMap();
    pdsBatchInput(map, distanceMap, costMap, 30000);
    pdsBatchOutput(map, distanceMap, useDiagonals);
}

// =============================================================================
// Context interface for calculateDistances
// =============================================================================

/**
 * Dependency injection context for calculateDistances.
 * These callbacks replace the C global state and helper functions.
 */
export interface CalculateDistancesContext {
    /** Check terrain flags at a position. C: cellHasTerrainFlag(pos, flags) */
    cellHasTerrainFlag: (pos: Pos, flags: number) => boolean;

    /** Check terrain mechanical flags. C: cellHasTMFlag(pos, flags) */
    cellHasTMFlag: (pos: Pos, flags: number) => boolean;

    /** Find creature at a position. C: monsterAtLoc(pos) */
    monsterAtLoc: (pos: Pos) => Creature | null;

    /** Check if creature avoids a position. C: monsterAvoids(creature, pos) */
    monsterAvoids: (creature: Creature, pos: Pos) => boolean;

    /** Get terrain flags that would be revealed if secrets are discovered. */
    discoveredTerrainFlagsAtLoc: (pos: Pos) => number;

    /** Check if a creature is the player. C: traveler == &player */
    isPlayer: (creature: Creature) => boolean;

    /** Get cell flags (pmap[x][y].flags). */
    getCellFlags: (x: number, y: number) => number;
}

// Flags needed by calculateDistances
import { MonsterBehaviorFlag, TileFlag } from "../types/flags.js";

const MONST_IMMUNE_TO_WEAPONS = MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS;
const MONST_INVULNERABLE = MonsterBehaviorFlag.MONST_INVULNERABLE;
const MONST_IMMOBILE = MonsterBehaviorFlag.MONST_IMMOBILE;
const MONST_GETS_TURN_ON_ACTIVATION = MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION;

import { TerrainMechFlag } from "../types/flags.js";

const DISCOVERED = TileFlag.DISCOVERED;
const MAGIC_MAPPED = TileFlag.MAGIC_MAPPED;

/**
 * Build a distance map from a destination point, taking terrain constraints
 * and creature positions into account.
 *
 * This is the main pathfinding function used by AI, player travel, etc.
 * Game state dependencies are injected via the `ctx` parameter.
 *
 * @param distanceMap - Output grid. Will be filled with shortest distances.
 * @param destinationX - X coordinate of the target cell (distance 0).
 * @param destinationY - Y coordinate of the target cell (distance 0).
 * @param blockingTerrainFlags - Additional terrain flags to treat as blocking.
 * @param traveler - The creature doing the pathfinding (null for generic).
 * @param canUseSecretDoors - Whether the traveler can path through secret doors.
 * @param eightWays - Whether to allow diagonal movement.
 * @param ctx - Game state context (injected callbacks).
 *
 * C equivalent: `calculateDistances` in Dijkstra.c
 */
export function calculateDistances(
    distanceMap: Grid,
    destinationX: number,
    destinationY: number,
    blockingTerrainFlags: number,
    traveler: Creature | null,
    canUseSecretDoors: boolean,
    eightWays: boolean,
    ctx: CalculateDistancesContext,
): void {
    const map = createPdsMap();

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            let cost: number;

            // Border cells are always impassable (granite walls in the game).
            // This matches pdsBatchInput's behavior and prevents out-of-bounds
            // access during diagonal movement checks.
            if (i === 0 || j === 0 || i === DCOLS - 1 || j === DROWS - 1) {
                cost = PDS_OBSTRUCTION;
                pdsCell(map, i, j).cost = cost;
                continue;
            }

            const pos: Pos = { x: i, y: j };
            const monst = ctx.monsterAtLoc(pos);

            if (
                monst
                && (monst.info.flags & (MONST_IMMUNE_TO_WEAPONS | MONST_INVULNERABLE))
                && (monst.info.flags & (MONST_IMMOBILE | MONST_GETS_TURN_ON_ACTIVATION))
            ) {
                // Always avoid damage-immune stationary monsters.
                cost = PDS_FORBIDDEN;
            } else if (
                canUseSecretDoors
                && ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET)
                && ctx.cellHasTerrainFlag(pos, T_OBSTRUCTS_PASSABILITY)
                && !(ctx.discoveredTerrainFlagsAtLoc(pos) & T_OBSTRUCTS_PASSABILITY)
            ) {
                cost = 1;
            } else if (
                ctx.cellHasTerrainFlag(pos, T_OBSTRUCTS_PASSABILITY)
                || (traveler && ctx.isPlayer(traveler) && !(ctx.getCellFlags(i, j) & (DISCOVERED | MAGIC_MAPPED)))
            ) {
                cost = ctx.cellHasTerrainFlag(pos, T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
            } else if (
                (traveler && ctx.monsterAvoids(traveler, pos))
                || ctx.cellHasTerrainFlag(pos, blockingTerrainFlags)
            ) {
                cost = PDS_FORBIDDEN;
            } else {
                cost = 1;
            }

            pdsCell(map, i, j).cost = cost;
        }
    }

    pdsClear(map, 30000);
    pdsSetDistance(map, destinationX, destinationY, 0);
    pdsBatchOutput(map, distanceMap, eightWays);
}

/**
 * Calculate the shortest path distance between two points.
 *
 * @param x1 - Start X
 * @param y1 - Start Y
 * @param x2 - Destination X
 * @param y2 - Destination Y
 * @param blockingTerrainFlags - Terrain flags to treat as blocking.
 * @param ctx - Game state context (injected callbacks).
 * @returns The pathing distance, or 30000 if unreachable.
 *
 * C equivalent: `pathingDistance` in Dijkstra.c
 */
export function pathingDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    blockingTerrainFlags: number,
    ctx: CalculateDistancesContext,
): number {
    const distanceMap = allocGrid();
    calculateDistances(distanceMap, x2, y2, blockingTerrainFlags, null, true, true, ctx);
    const retval = distanceMap[x1][y1];
    freeGrid(distanceMap);
    return retval;
}
