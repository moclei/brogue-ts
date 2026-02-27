/*
 *  architect.ts — Top-level dungeon generation orchestration
 *  brogue-ts
 *
 *  Contains the master dungeon generation pipeline: clearing the level,
 *  carving rooms, placing lakes/bridges/stairs, and initializing the level.
 *
 *  Ported from: Architect.c (clearLevel, carveDungeon, digDungeon,
 *  adjustDungeonProfileForDepth, adjustDungeonFirstRoomProfileForDepth,
 *  updateMapToShore, setUpWaypoints, refreshWaypoint,
 *  validStairLoc, prepareForStairs, placeStairs,
 *  resetDFMessageEligibility,
 *  initializeLevel, restoreMonster, restoreItems — stubs for runtime deps)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pcell, Pos, DungeonProfile, DungeonFeature, GameConstants, FloorTileType, AutoGenerator, Blueprint } from "../types/types.js";
import { TileType, DungeonLayer, DungeonProfileType } from "../types/enums.js";
import {
    DCOLS, DROWS, ROOM_TYPE_COUNT,
    MAX_WAYPOINT_COUNT, WAYPOINT_SIGHT_RADIUS,
    PDS_OBSTRUCTION, PDS_FORBIDDEN,
} from "../types/constants.js";
import {
    TerrainFlag, TerrainMechFlag, TileFlag,
    T_PATHING_BLOCKER, T_OBSTRUCTS_SCENT,
    IS_IN_MACHINE,
} from "../types/flags.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import { cellHasTerrainFlag, cellHasTMFlag } from "../state/helpers.js";
import { allocGrid, freeGrid, fillGrid, type Grid } from "../grid/grid.js";
import { randPercent, clamp, fillSequentialList, shuffleList } from "../math/rng.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { dijkstraScan } from "../dijkstra/dijkstra.js";
import { passableArcCount } from "./helpers.js";
import { designRandomRoom, attachRooms } from "./rooms.js";
import { designLakes, fillLakes, removeDiagonalOpenings, cleanUpLakeBoundaries, buildABridge, finishWalls, finishDoors, type BuildBridgeContext } from "./lakes.js";
import { addLoops } from "./analysis.js";
import { addMachines, runAutogenerators, type MachineContext } from "./machines.js";

// =============================================================================
// Context types for dependency injection
// =============================================================================

/**
 * Context for the full dungeon generation pipeline.
 * Bundles all external dependencies needed by digDungeon and its callees.
 */
export interface ArchitectContext {
    pmap: Pcell[][];
    depthLevel: number;
    gameConstants: GameConstants;
    dungeonProfileCatalog: readonly DungeonProfile[];
    dungeonFeatureCatalog: DungeonFeature[];
    blueprintCatalog: readonly Blueprint[];
    autoGeneratorCatalog: readonly AutoGenerator[];
    tileCatalog: readonly FloorTileType[];

    /** Current machine number counter (mutated during generation) */
    machineNumber: number;
    /** Number of reward rooms generated so far (mutated during generation) */
    rewardRoomsGenerated: number;
    /** Whether the loop map needs recalculation */
    staleLoopMap: boolean;

    // Callbacks for systems not yet ported
    machineContext: MachineContext;

    /** Bridge building context */
    bridgeContext: BuildBridgeContext;

    /** Analyze the map (compute chokepoints). Updates chokeMap in place. */
    analyzeMap(calculateChokeMap: boolean): void;

    /** Get FOV mask from origin. */
    getFOVMask(
        grid: Grid,
        xLoc: number,
        yLoc: number,
        maxRadius: bigint,
        forbiddenTerrain: number,
        forbiddenFlags: number,
        cautiousOnWalls: boolean,
    ): void;

    /** Populate a generic cost map for Dijkstra. */
    populateGenericCostMap(costMap: Grid): void;

    /** Calculate distances from origin. */
    calculateDistances(
        distanceMap: Grid,
        destX: number,
        destY: number,
        blockingFlags: number,
        traveler: null,
        treatAsOpaque: boolean,
        eightWay: boolean,
    ): void;
}

// =============================================================================
// Level clearing
// =============================================================================

/**
 * Clear the dungeon map, resetting all cells to granite / default state.
 *
 * C equivalent: `clearLevel()` in Architect.c line 2760
 */
export function clearLevel(pmap: Pcell[][]): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const cell = pmap[i][j];
            cell.layers[DungeonLayer.Dungeon] = TileType.GRANITE;
            cell.layers[DungeonLayer.Liquid] = TileType.NOTHING;
            cell.layers[DungeonLayer.Gas] = TileType.NOTHING;
            cell.layers[DungeonLayer.Surface] = TileType.NOTHING;
            cell.machineNumber = 0;
            cell.rememberedTerrain = TileType.NOTHING;
            cell.rememberedItemCategory = 0;
            cell.rememberedItemKind = 0;
            cell.rememberedItemQuantity = 0;
            cell.rememberedItemOriginDepth = 0;
            cell.flags = 0;
            cell.volume = 0;
        }
    }
}

// =============================================================================
// Dungeon profile adjustments
// =============================================================================

/**
 * Adjust dungeon room generation profile based on current depth.
 * Deeper levels get more caves and fewer cross rooms / corridors.
 *
 * C equivalent: `adjustDungeonProfileForDepth(theProfile)` in Architect.c line 2425
 */
export function adjustDungeonProfileForDepth(
    theProfile: DungeonProfile,
    depthLevel: number,
    amuletLevel: number,
): void {
    const descentPercent = clamp(Math.floor(100 * (depthLevel - 1) / (amuletLevel - 1)), 0, 100);

    theProfile.roomFrequencies[0] += Math.floor(20 * (100 - descentPercent) / 100);
    theProfile.roomFrequencies[1] += Math.floor(10 * (100 - descentPercent) / 100);
    theProfile.roomFrequencies[3] += Math.floor(7 * (100 - descentPercent) / 100);
    theProfile.roomFrequencies[5] += Math.floor(10 * descentPercent / 100);

    theProfile.corridorChance += Math.floor(80 * (100 - descentPercent) / 100);
}

/**
 * Adjust the first room's dungeon profile based on current depth.
 * Depth 1 always starts with the entrance room.
 *
 * C equivalent: `adjustDungeonFirstRoomProfileForDepth(theProfile)` in Architect.c line 2436
 */
export function adjustDungeonFirstRoomProfileForDepth(
    theProfile: DungeonProfile,
    depthLevel: number,
    amuletLevel: number,
): void {
    const descentPercent = clamp(Math.floor(100 * (depthLevel - 1) / (amuletLevel - 1)), 0, 100);

    if (depthLevel === 1) {
        // All dungeons start with the entrance room on depth 1.
        for (let i = 0; i < ROOM_TYPE_COUNT; i++) {
            theProfile.roomFrequencies[i] = 0;
        }
        theProfile.roomFrequencies[7] = 1;
    } else {
        theProfile.roomFrequencies[6] += Math.floor(50 * descentPercent / 100);
    }
}

// =============================================================================
// Dungeon carving
// =============================================================================

/**
 * Carve rooms and hallways into the dungeon grid.
 * Called by digDungeon(). Places the first room, then attaches more rooms.
 *
 * C equivalent: `carveDungeon(grid)` in Architect.c line 2456
 */
export function carveDungeon(
    grid: Grid,
    depthLevel: number,
    amuletLevel: number,
    dungeonProfileCatalog: readonly DungeonProfile[],
): void {
    // Copy the basic profile and adjust for depth
    const theDP: DungeonProfile = {
        roomFrequencies: [...dungeonProfileCatalog[DungeonProfileType.Basic].roomFrequencies],
        corridorChance: dungeonProfileCatalog[DungeonProfileType.Basic].corridorChance,
    };
    adjustDungeonProfileForDepth(theDP, depthLevel, amuletLevel);

    // Copy the first room profile and adjust for depth
    const theFirstRoomDP: DungeonProfile = {
        roomFrequencies: [...dungeonProfileCatalog[DungeonProfileType.BasicFirstRoom].roomFrequencies],
        corridorChance: dungeonProfileCatalog[DungeonProfileType.BasicFirstRoom].corridorChance,
    };
    adjustDungeonFirstRoomProfileForDepth(theFirstRoomDP, depthLevel, amuletLevel);

    // Place the first room
    designRandomRoom(grid, false, theFirstRoomDP.roomFrequencies);

    // Attach more rooms
    attachRooms(grid, theDP, 35, 35);
}

// =============================================================================
// digDungeon — Master dungeon generation function
// =============================================================================

/**
 * Generate a complete dungeon level.
 * This is the master function that orchestrates all dungeon generation steps.
 *
 * C equivalent: `digDungeon()` in Architect.c line 2877
 */
export function digDungeon(ctx: ArchitectContext): void {
    ctx.machineNumber = 0;

    // Clear level and fill with granite
    clearLevel(ctx.pmap);

    // Carve rooms
    const grid = allocGrid();
    carveDungeon(grid, ctx.depthLevel, ctx.gameConstants.amuletLevel, ctx.dungeonProfileCatalog);

    // Add loops for secondary connections
    addLoops(grid, 20);

    // Transfer grid to pmap
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (grid[i][j] === 1) {
                ctx.pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
            } else if (grid[i][j] === 2) {
                ctx.pmap[i][j].layers[DungeonLayer.Dungeon] =
                    (randPercent(60) && ctx.depthLevel < ctx.gameConstants.deepestLevel)
                        ? TileType.DOOR
                        : TileType.FLOOR;
            }
        }
    }
    freeGrid(grid);

    // Finish walls (cardinal only)
    finishWalls(ctx.pmap, false);

    // Design and fill lakes
    const lakeMap = allocGrid();
    designLakes(ctx.pmap, lakeMap);
    fillLakes(ctx.pmap, lakeMap, ctx.depthLevel, ctx.gameConstants);
    freeGrid(lakeMap);

    // Run non-machine autogenerators
    runAutogenerators(ctx.machineContext, false);

    // Remove diagonal openings
    removeDiagonalOpenings(ctx.pmap);

    // Add treasure machines
    addMachines(ctx.machineContext);

    // Sync machine number back from machine context
    ctx.machineNumber = ctx.machineContext.machineNumber;

    // Run machine autogenerators
    runAutogenerators(ctx.machineContext, true);

    // Clean up lake boundaries
    cleanUpLakeBoundaries(ctx.pmap);

    // Add bridges
    while (buildABridge(ctx.pmap, ctx.bridgeContext));

    // Remove orphaned doors and add secret doors
    finishDoors(ctx.pmap, ctx.depthLevel, ctx.gameConstants.amuletLevel);

    // Finish walls (including diagonals)
    finishWalls(ctx.pmap, true);
}

// =============================================================================
// Stair placement
// =============================================================================

/**
 * Check whether a position is valid for placing stairs.
 *
 * A valid stair location is a plain wall with exactly three cardinal
 * wall neighbors and one non-blocking neighbor, with specific
 * diagonal requirements.
 *
 * C equivalent: `validStairLoc(x, y)` in Architect.c line 3604
 */
export function validStairLoc(pmap: Pcell[][], x: number, y: number): boolean {
    if (x < 1 || x >= DCOLS - 1 || y < 1 || y >= DROWS - 1
        || pmap[x][y].layers[DungeonLayer.Dungeon] !== TileType.WALL) {
        return false;
    }

    // No neighbors in machines
    for (let dir = 0; dir < 8; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        if (pmap[newX][newY].flags & IS_IN_MACHINE) {
            return false;
        }
    }

    let neighborWallCount = 0;
    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];

        if (cellHasTerrainFlag(pmap, { x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
            // neighbor is a wall
            neighborWallCount++;
        } else {
            // neighbor is not a wall
            if (cellHasTerrainFlag(pmap, { x: newX, y: newY }, T_PATHING_BLOCKER)
                || passableArcCount(pmap, newX, newY) >= 2) {
                return false;
            }

            // Check the two diagonals between the walls
            let diagX = x - nbDirs[dir][0] + nbDirs[dir][1];
            let diagY = y - nbDirs[dir][1] + nbDirs[dir][0];
            if (!cellHasTerrainFlag(pmap, { x: diagX, y: diagY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                return false;
            }

            diagX = x - nbDirs[dir][0] - nbDirs[dir][1];
            diagY = y - nbDirs[dir][1] - nbDirs[dir][0];
            if (!cellHasTerrainFlag(pmap, { x: diagX, y: diagY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                return false;
            }
        }
    }

    return neighborWallCount === 3;
}

/**
 * Prepare a cell for stairs placement.
 * Adds torches on either side, exposes granite, marks walls as impregnable,
 * and zeros out the grid in the vicinity.
 *
 * C equivalent: `prepareForStairs(x, y, grid)` in Architect.c line 3656
 */
export function prepareForStairs(pmap: Pcell[][], x: number, y: number, grid: Grid): void {
    // Add torches to either side
    for (let dir = 0; dir < 4; dir++) {
        if (!cellHasTerrainFlag(pmap, { x: x + nbDirs[dir][0], y: y + nbDirs[dir][1] }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
            let newX = x - nbDirs[dir][1];
            let newY = y - nbDirs[dir][0];
            pmap[newX][newY].layers[DungeonLayer.Dungeon] = TileType.TORCH_WALL;

            newX = x + nbDirs[dir][1];
            newY = y + nbDirs[dir][0];
            pmap[newX][newY].layers[DungeonLayer.Dungeon] = TileType.TORCH_WALL;
            break;
        }
    }

    // Expose granite and mark impregnable
    for (let dir = 0; dir < 8; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        if (pmap[newX][newY].layers[DungeonLayer.Dungeon] === TileType.GRANITE) {
            pmap[newX][newY].layers[DungeonLayer.Dungeon] = TileType.WALL;
        }
        if (cellHasTerrainFlag(pmap, { x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
            pmap[newX][newY].flags |= TileFlag.IMPREGNABLE;
        }
    }

    // Zero out grid in the vicinity
    for (let newX = Math.max(0, x - 5); newX < Math.min(DCOLS, x + 5); newX++) {
        for (let newY = Math.max(0, y - 5); newY < Math.min(DROWS, y + 5); newY++) {
            grid[newX][newY] = 0;
        }
    }
}

/**
 * Find the nearest qualifying location from a grid of valid positions.
 * Searches outward from the target position.
 *
 * Simplified version of C's getQualifyingGridLocNear — searches
 * in expanding rings from the target.
 */
export function getQualifyingGridLocNear(
    grid: Grid,
    target: Pos,
): Pos | null {
    // Check target first
    if (coordinatesAreInMap(target.x, target.y) && grid[target.x][target.y]) {
        return { x: target.x, y: target.y };
    }
    // Expanding ring search
    for (let radius = 1; radius < Math.max(DCOLS, DROWS); radius++) {
        for (let i = target.x - radius; i <= target.x + radius; i++) {
            for (let j = target.y - radius; j <= target.y + radius; j++) {
                if (Math.abs(i - target.x) === radius || Math.abs(j - target.y) === radius) {
                    if (coordinatesAreInMap(i, j) && grid[i][j]) {
                        return { x: i, y: j };
                    }
                }
            }
        }
    }
    return null;
}

/**
 * Find a qualifying open location near the target, avoiding certain terrain and flags.
 *
 * Simplified version of C's getQualifyingLocNear. Searches in expanding rings.
 */
export function getQualifyingLocNear(
    pmap: Pcell[][],
    target: Pos,
    avoidTerrainFlags: number,
    avoidCellFlags: number,
): Pos | null {
    for (let radius = 0; radius < Math.max(DCOLS, DROWS); radius++) {
        for (let i = target.x - radius; i <= target.x + radius; i++) {
            for (let j = target.y - radius; j <= target.y + radius; j++) {
                if (
                    coordinatesAreInMap(i, j)
                    && !cellHasTerrainFlag(pmap, { x: i, y: j }, avoidTerrainFlags)
                    && !(pmap[i][j].flags & avoidCellFlags)
                ) {
                    return { x: i, y: j };
                }
            }
        }
    }
    return null;
}

/**
 * Place stairs (up and down) on the dungeon level.
 *
 * C equivalent: `placeStairs(upStairsLoc)` in Architect.c line 3690
 *
 * @param levels - Level data array (for stair positions across depths)
 * @param depthLevel - Current depth level (1-indexed)
 * @param deepestLevel - Maximum level depth
 * @returns The up stairs location, or null on failure
 */
export function placeStairs(
    pmap: Pcell[][],
    levels: Array<{ upStairsLoc: Pos; downStairsLoc: Pos; playerExitedVia: Pos; visited: boolean }>,
    depthLevel: number,
    deepestLevel: number,
): { upStairsLoc: Pos; downStairsLoc: Pos } | null {
    const grid = allocGrid();
    const n = depthLevel - 1;

    // Build valid stair location grid
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            grid[i][j] = validStairLoc(pmap, i, j) ? 1 : 0;
        }
    }

    // Place down stairs
    let downLoc = getQualifyingGridLocNear(grid, levels[n].downStairsLoc);
    if (downLoc) {
        prepareForStairs(pmap, downLoc.x, downLoc.y, grid);
    } else {
        // Fallback: find any open location
        downLoc = getQualifyingLocNear(
            pmap,
            levels[n].downStairsLoc,
            TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_ITEMS
                | TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DEEP_WATER
                | TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DF_TRAP,
            TileFlag.HAS_MONSTER | TileFlag.HAS_ITEM | TileFlag.HAS_STAIRS | IS_IN_MACHINE,
        );
        if (!downLoc) {
            freeGrid(grid);
            return null;
        }
    }

    if (depthLevel === deepestLevel) {
        pmap[downLoc.x][downLoc.y].layers[DungeonLayer.Dungeon] = TileType.DUNGEON_PORTAL;
    } else {
        pmap[downLoc.x][downLoc.y].layers[DungeonLayer.Dungeon] = TileType.DOWN_STAIRS;
    }
    pmap[downLoc.x][downLoc.y].layers[DungeonLayer.Liquid] = TileType.NOTHING;
    pmap[downLoc.x][downLoc.y].layers[DungeonLayer.Surface] = TileType.NOTHING;

    if (!levels[n + 1]?.visited) {
        if (levels[n + 1]) {
            levels[n + 1].upStairsLoc = downLoc;
        }
    }
    levels[n].downStairsLoc = downLoc;

    // Place up stairs
    let upLoc = getQualifyingGridLocNear(grid, levels[n].upStairsLoc);
    if (upLoc) {
        prepareForStairs(pmap, upLoc.x, upLoc.y, grid);
    } else {
        upLoc = getQualifyingLocNear(
            pmap,
            levels[n].upStairsLoc,
            TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_ITEMS
                | TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DEEP_WATER
                | TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DF_TRAP,
            TileFlag.HAS_MONSTER | TileFlag.HAS_ITEM | TileFlag.HAS_STAIRS | IS_IN_MACHINE,
        );
        if (!upLoc) {
            freeGrid(grid);
            return null;
        }
    }

    levels[n].upStairsLoc = upLoc;

    if (depthLevel === 1) {
        pmap[upLoc.x][upLoc.y].layers[DungeonLayer.Dungeon] = TileType.DUNGEON_EXIT;
    } else {
        pmap[upLoc.x][upLoc.y].layers[DungeonLayer.Dungeon] = TileType.UP_STAIRS;
    }
    pmap[upLoc.x][upLoc.y].layers[DungeonLayer.Liquid] = TileType.NOTHING;
    pmap[upLoc.x][upLoc.y].layers[DungeonLayer.Surface] = TileType.NOTHING;

    pmap[downLoc.x][downLoc.y].flags |= TileFlag.HAS_STAIRS;
    pmap[upLoc.x][upLoc.y].flags |= TileFlag.HAS_STAIRS;

    freeGrid(grid);
    return { upStairsLoc: upLoc, downStairsLoc: downLoc };
}

// =============================================================================
// Map distance calculations
// =============================================================================

/**
 * Calculate a distance map from all dry land tiles to the nearest
 * dangerous liquid tile (deep water, lava, chasm).
 *
 * C equivalent: `updateMapToShore()` in Architect.c line 2982
 *
 * @returns The computed mapToShore grid
 */
export function updateMapToShore(pmap: Pcell[][]): Grid {
    const costMap = allocGrid();
    const mapToShore = allocGrid();
    fillGrid(mapToShore, 0);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (cellHasTerrainFlag(pmap, { x: i, y: j }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                costMap[i][j] = cellHasTerrainFlag(pmap, { x: i, y: j }, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
                mapToShore[i][j] = 30000;
            } else {
                costMap[i][j] = 1;
                mapToShore[i][j] = (
                    cellHasTerrainFlag(pmap, { x: i, y: j },
                        TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_AUTO_DESCENT)
                    && !cellHasTMFlag(pmap, { x: i, y: j }, TerrainMechFlag.TM_IS_SECRET)
                ) ? 30000 : 0;
            }
        }
    }

    dijkstraScan(mapToShore, costMap, true);
    freeGrid(costMap);
    return mapToShore;
}

// =============================================================================
// Waypoints
// =============================================================================

/**
 * Refresh a single waypoint's distance map.
 *
 * C equivalent: `refreshWaypoint(wpIndex)` in Architect.c line 3014
 */
export function refreshWaypoint(
    wpDistance: Grid,
    wpCoord: Pos,
    populateGenericCostMap: (costMap: Grid) => void,
): void {
    const costMap = allocGrid();
    populateGenericCostMap(costMap);

    // In the full game, sleeping/immobile/captive monsters are marked as PDS_FORBIDDEN.
    // That will be added when monsters are ported.

    fillGrid(wpDistance, 30000);
    wpDistance[wpCoord.x][wpCoord.y] = 0;
    dijkstraScan(wpDistance, costMap, true);
    freeGrid(costMap);
}

/**
 * Set up waypoints across the level for monster pathfinding.
 * Distributes waypoints using FOV to ensure coverage of all reachable areas.
 *
 * C equivalent: `setUpWaypoints()` in Architect.c line 3033
 *
 * @returns The waypoint data (coordinates and distance maps)
 */
export function setUpWaypoints(
    pmap: Pcell[][],
    populateGenericCostMap: (costMap: Grid) => void,
    getFOVMask: (grid: Grid, x: number, y: number, maxRadius: bigint, forbiddenTerrain: number, forbiddenFlags: number, cautiousOnWalls: boolean) => void,
): { wpCoordinates: Pos[]; wpDistance: Grid[] } {
    const grid = allocGrid();
    fillGrid(grid, 0);

    // Mark cells that obstruct scent
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (cellHasTerrainFlag(pmap, { x: i, y: j }, T_OBSTRUCTS_SCENT)) {
                grid[i][j] = 1;
            }
        }
    }

    const wpCoordinates: Pos[] = [];
    const wpDistance: Grid[] = [];

    const totalCoords = DCOLS * DROWS;
    const sCoord = new Array<number>(totalCoords);
    fillSequentialList(sCoord);
    shuffleList(sCoord);

    for (let i = 0; i < totalCoords && wpCoordinates.length < MAX_WAYPOINT_COUNT; i++) {
        const x = Math.floor(sCoord[i] / DROWS);
        const y = sCoord[i] % DROWS;
        if (!grid[x][y]) {
            getFOVMask(grid, x, y, BigInt(WAYPOINT_SIGHT_RADIUS) * FP_FACTOR, T_OBSTRUCTS_SCENT, 0, false);
            grid[x][y] = 1;
            wpCoordinates.push({ x, y });
        }
    }

    // Calculate distance maps for all waypoints
    for (let i = 0; i < wpCoordinates.length; i++) {
        const dist = allocGrid();
        refreshWaypoint(dist, wpCoordinates[i], populateGenericCostMap);
        wpDistance.push(dist);
    }

    freeGrid(grid);
    return { wpCoordinates, wpDistance };
}

// =============================================================================
// Dungeon feature message eligibility reset
// =============================================================================

/**
 * Reset the messageDisplayed flag for all dungeon features.
 *
 * C equivalent: `resetDFMessageEligibility()` in Architect.c line 3200
 */
export function resetDFMessageEligibility(dungeonFeatureCatalog: DungeonFeature[]): void {
    for (let i = 0; i < dungeonFeatureCatalog.length; i++) {
        dungeonFeatureCatalog[i].messageDisplayed = false;
    }
}

// =============================================================================
// Level initialization (stubs for runtime dependencies)
// =============================================================================

/**
 * Initialize a dungeon level — places player, monsters, items and stairs.
 *
 * C equivalent: `initializeLevel(upStairsLoc)` in Architect.c line 3764
 *
 * NOTE: This is a partial implementation. Full creature/item placement
 * depends on systems not yet ported (Monsters.c, Items.c).
 * Currently handles the FOV setup and restoreItems/restoreMonster stubs.
 */
export function initializeLevel(
    pmap: Pcell[][],
    upStairsLoc: Pos,
    depthLevel: number,
    levels: Array<{ visited: boolean }>,
    getFOVMask: (grid: Grid, x: number, y: number, maxRadius: bigint, forbiddenTerrain: number, forbiddenFlags: number, cautiousOnWalls: boolean) => void,
): void {
    let upLoc = { ...upStairsLoc };

    if (!levels[depthLevel - 1].visited) {
        // Run FOV from up stairs so monsters don't spawn within sight
        for (let dir = 0; dir < 4; dir++) {
            const nextX = upLoc.x + nbDirs[dir][0];
            const nextY = upLoc.y + nbDirs[dir][1];
            if (coordinatesAreInMap(nextX, nextY)
                && !cellHasTerrainFlag(pmap, { x: nextX, y: nextY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                upLoc = { x: nextX, y: nextY };
                break;
            }
        }
        const grid = allocGrid();
        fillGrid(grid, 0);
        getFOVMask(
            grid, upLoc.x, upLoc.y,
            BigInt(Math.max(DCOLS, DROWS)) * FP_FACTOR,
            TerrainFlag.T_OBSTRUCTS_VISION, 0, false,
        );
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j]) {
                    pmap[i][j].flags |= TileFlag.IN_FIELD_OF_VIEW;
                }
            }
        }
        freeGrid(grid);

        // populateItems(upLoc) and populateMonsters() will be called here
        // once the Items and Monsters modules are ported.
    }

    // restoreItems() and restoreMonster() stubs — will be implemented
    // once the full item/monster systems are ported.
}

/**
 * Restore a monster to the level (stub).
 *
 * C equivalent: `restoreMonster(monst, mapToStairs, mapToPit)` in Architect.c line 3501
 *
 * Full implementation depends on creature system, pathfinding through
 * occupied cells (nextStep), and getQualifyingPathLocNear — all not yet ported.
 */
export function restoreMonster(): void {
    // Stub — will be implemented when Monsters module is ported
}

/**
 * Restore items that fell from the previous depth (stub).
 *
 * C equivalent: `restoreItems()` in Architect.c line 3573
 *
 * Full implementation depends on item chain management, getQualifyingLocNear
 * with creature awareness, and placeItemAt.
 */
export function restoreItems(): void {
    // Stub — will be implemented when Items module is ported
}
