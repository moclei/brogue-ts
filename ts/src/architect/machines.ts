/*
 *  machines.ts — Machine/blueprint placement for the dungeon architect
 *  brogue-ts
 *
 *  Contains all machine-related functions: blueprint qualification,
 *  feature candidate selection, interior preparation, machine building,
 *  and spawn map operations.
 *
 *  Ported from: Architect.c (blueprintQualifies, cellIsFeatureCandidate,
 *  addTileToMachineInteriorAndIterate, expandMachineInterior,
 *  fillInteriorForVestibuleMachine, redesignInterior,
 *  prepareInteriorWithMachineFlags, buildAMachine, addMachines,
 *  runAutogenerators, fillSpawnMap, spawnMapDF, spawnDungeonFeature)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pcell, Pos, FloorTileType, Blueprint, DungeonFeature, DungeonProfile, AutoGenerator } from "../types/types.js";
import { DungeonLayer, TileType, MachineType, CreatureState, CreatureMode, ItemCategory } from "../types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS, MACHINES_BUFFER_LENGTH, PDS_FORBIDDEN, PDS_OBSTRUCTION } from "../types/constants.js";
import {
    TileFlag, IS_IN_MACHINE, TerrainFlag, TerrainMechFlag,
    T_PATHING_BLOCKER,
    BlueprintFlag, MachineFeatureFlag, DFFlag,
    ItemFlag, HordeFlag, MonsterBookkeepingFlag,
} from "../types/flags.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import { cellHasTerrainFlag, cellHasTMFlag, cellHasTerrainType, highestPriorityLayer } from "../state/helpers.js";
import { allocGrid, fillGrid, freeGrid, type Grid } from "../grid/grid.js";
import { randRange, randPercent, shuffleList, fillSequentialList } from "../math/rng.js";
import { dijkstraScan } from "../dijkstra/dijkstra.js";
import { zeroOutGrid, copyMap, cellIsPassableOrDoor, passableArcCount, levelIsDisconnectedWithBlockingMap, randomMatchingLocation } from "./helpers.js";
import { attachRooms } from "./rooms.js";
import { addLoops } from "./analysis.js";

// =============================================================================
// Constants
// =============================================================================

const DIRECTION_COUNT = 8;

// =============================================================================
// Types — Callback interfaces for item/monster operations
// =============================================================================

/**
 * Minimal item interface for machine building.
 * Structurally compatible with the full `Item` type from types.ts.
 */
export interface MachineItem {
    category: number;
    kind: number;
    quantity: number;
    flags: number;
    keyLoc: Array<{ loc: Pos; machine: number; disposableHere: boolean }>;
    originDepth: number;
}

/**
 * Minimal creature interface for machine building.
 */
export interface MachineCreature {
    loc: Pos;
    bookkeepingFlags: number;
    creatureState: number;
    creatureMode: number;
    machineHome: number;
    leader: MachineCreature | null;
    carriedItem: MachineItem | null;
}

/**
 * Callback interface for item operations during machine building.
 * Provided by the Items module via `createItemOps()`.
 */
export interface ItemOps {
    generateItem(category: number, kind: number): MachineItem;
    deleteItem(item: MachineItem): void;
    placeItemAt(item: MachineItem, pos: Pos): void;
    removeItemFromArray(item: MachineItem, arr: MachineItem[]): void;
    itemIsHeavyWeapon(item: MachineItem): boolean;
    itemIsPositivelyEnchanted(item: MachineItem): boolean;
}

/**
 * Callback interface for monster operations during machine building.
 * These will be provided by the Monsters module once ported.
 */
export interface MonsterOps {
    spawnHorde(
        leaderID: number,
        pos: Pos,
        forbiddenFlags: number,
        requiredFlags: number,
    ): MachineCreature | null;
    monsterAtLoc(pos: Pos): MachineCreature | null;
    killCreature(creature: MachineCreature, quiet: boolean): void;
    generateMonster(monsterID: number, atDepth: boolean, summon: boolean): MachineCreature | null;
    toggleMonsterDormancy(creature: MachineCreature): void;
    iterateMachineMonsters(): MachineCreature[];
}

/**
 * Context for dungeon feature spawning operations.
 * Bundles the external dependencies needed by fillSpawnMap and spawnDungeonFeature.
 */
export interface SpawnContext {
    pmap: Pcell[][];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    staleLoopMap: boolean;
}

/**
 * Context for machine building operations.
 * Bundles all external dependencies via dependency injection.
 */
export interface MachineContext {
    pmap: Pcell[][];
    chokeMap: Grid;
    tileCatalog: readonly FloorTileType[];
    blueprintCatalog: readonly Blueprint[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    dungeonProfileCatalog: readonly DungeonProfile[];
    autoGeneratorCatalog: readonly AutoGenerator[];
    depthLevel: number;
    machineNumber: number;
    rewardRoomsGenerated: number;
    staleLoopMap: boolean;
    gameConstants: {
        numberBlueprints: number;
        numberAutogenerators: number;
        amuletLevel: number;
        deepestLevelForMachines: number;
        machinesPerLevelSuppressionMultiplier: number;
        machinesPerLevelSuppressionOffset: number;
        machinesPerLevelIncreaseFactor: number;
        maxLevelForBonusMachines: number;
    };
    itemOps: ItemOps;
    monsterOps: MonsterOps;
    /** Analyze the map (compute chokepoints). Updates chokeMap in place. */
    analyzeMap(calculateChokeMap: boolean): void;
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
    /** Pathing distance between two points (for addMachines context). */
    pathingDistance?(x1: number, y1: number, x2: number, y2: number): number;
    /** Item array references for sub-machine operations */
    floorItems: MachineItem[];
    packItems: MachineItem[];
}

// =============================================================================
// Machine helper functions
// =============================================================================

/**
 * Check if a blueprint qualifies for the current depth and required flags.
 *
 * C equivalent: `blueprintQualifies(i, requiredMachineFlags)` in Architect.c line 455
 */
export function blueprintQualifies(
    catalog: readonly Blueprint[],
    i: number,
    depthLevel: number,
    requiredMachineFlags: number,
): boolean {
    const bp = catalog[i];
    if (
        bp.depthRange[0] > depthLevel
        || bp.depthRange[1] < depthLevel
        // Must have the required flags:
        || (~bp.flags & requiredMachineFlags)
        // May NOT have BP_ADOPT_ITEM unless that flag is required:
        || (bp.flags & BlueprintFlag.BP_ADOPT_ITEM & ~requiredMachineFlags)
        // May NOT have BP_VESTIBULE unless that flag is required:
        || (bp.flags & BlueprintFlag.BP_VESTIBULE & ~requiredMachineFlags)
    ) {
        return false;
    }
    return true;
}

/**
 * Check if an item is a duplicate of any in the spawned items list.
 *
 * C equivalent: `itemIsADuplicate(theItem, spawnedItems, itemCount)` in Architect.c line 441
 */
export function itemIsADuplicate(
    theItem: MachineItem,
    spawnedItems: (MachineItem | null)[],
    itemCount: number,
): boolean {
    // Categories that shouldn't be duplicated
    const UNIQUE_CATEGORIES = 0; // Will be filled with STAFF | WAND | POTION | SCROLL | RING | WEAPON | ARMOR | CHARM
    if (theItem.category & UNIQUE_CATEGORIES) {
        for (let i = 0; i < itemCount; i++) {
            if (
                spawnedItems[i]
                && spawnedItems[i]!.category === theItem.category
                && spawnedItems[i]!.kind === theItem.kind
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Add a location to an item's key locks.
 *
 * C equivalent: `addLocationToKey(theItem, x, y, disposableHere)` in Architect.c line 591
 */
export function addLocationToKey(
    theItem: MachineItem,
    x: number,
    y: number,
    disposableHere: boolean,
): void {
    let i = 0;
    while (i < theItem.keyLoc.length && (theItem.keyLoc[i].loc.x || theItem.keyLoc[i].machine)) {
        i++;
    }
    if (i < theItem.keyLoc.length) {
        theItem.keyLoc[i].loc = { x, y };
        theItem.keyLoc[i].disposableHere = disposableHere;
    }
}

/**
 * Add a machine number to an item's key locks.
 *
 * C equivalent: `addMachineNumberToKey(theItem, machineNumber, disposableHere)` in Architect.c line 599
 */
export function addMachineNumberToKey(
    theItem: MachineItem,
    machineNumber: number,
    disposableHere: boolean,
): void {
    let i = 0;
    while (i < theItem.keyLoc.length && (theItem.keyLoc[i].loc.x || theItem.keyLoc[i].machine)) {
        i++;
    }
    if (i < theItem.keyLoc.length) {
        theItem.keyLoc[i].machine = machineNumber;
        theItem.keyLoc[i].disposableHere = disposableHere;
    }
}

/**
 * Check whether a cell qualifies as a candidate for placing a machine feature.
 *
 * C equivalent: `cellIsFeatureCandidate(x, y, originX, originY, distanceBound,
 *   interior, occupied, viewMap, distanceMap, machineNumber, featureFlags, bpFlags)`
 *   in Architect.c line 492
 */
export function cellIsFeatureCandidate(
    pmap: Pcell[][],
    _tCatalog: readonly FloorTileType[],
    x: number,
    y: number,
    originX: number,
    originY: number,
    distanceBound: [number, number],
    interior: Grid,
    occupied: Grid,
    viewMap: Grid,
    distanceMap: Grid,
    machineNumber: number,
    featureFlags: number,
    bpFlags: number,
): boolean {
    const MF = MachineFeatureFlag;

    // No building in the hallway if prohibited.
    if ((featureFlags & MF.MF_NOT_IN_HALLWAY) && passableArcCount(pmap, x, y) > 1) {
        return false;
    }

    // No building along the perimeter if prohibited.
    if ((featureFlags & MF.MF_NOT_ON_LEVEL_PERIMETER)
        && (x === 0 || x === DCOLS - 1 || y === 0 || y === DROWS - 1)) {
        return false;
    }

    // The origin is a candidate if the feature is flagged to be built at the origin.
    if (featureFlags & MF.MF_BUILD_AT_ORIGIN) {
        return (x === originX && y === originY);
    } else if ((bpFlags & BlueprintFlag.BP_ROOM) && x === originX && y === originY) {
        return false;
    }

    // No building in another feature's personal space!
    if (occupied[x][y]) {
        return false;
    }

    // Must be in the viewmap if the appropriate flag is set.
    if ((featureFlags & (MF.MF_IN_VIEW_OF_ORIGIN | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN))
        && !viewMap[x][y]) {
        return false;
    }

    // Do a distance check if the feature requests it.
    let distance: number;
    if (cellHasTerrainFlag(pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        distance = 10000;
        for (let dir = 0; dir < 4; dir++) {
            const newX = x + nbDirs[dir][0];
            const newY = y + nbDirs[dir][1];
            if (
                coordinatesAreInMap(newX, newY)
                && !cellHasTerrainFlag(pmap, { x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                && distance > distanceMap[newX][newY] + 1
            ) {
                distance = distanceMap[newX][newY] + 1;
            }
        }
    } else {
        distance = distanceMap[x][y];
    }

    if (distance > distanceBound[1] || distance < distanceBound[0]) {
        return false;
    }

    if (featureFlags & MF.MF_BUILD_IN_WALLS) {
        // If we're supposed to build in a wall...
        if (
            !interior[x][y]
            && (pmap[x][y].machineNumber === 0 || pmap[x][y].machineNumber === machineNumber)
            && cellHasTerrainFlag(pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
        ) {
            for (let dir = 0; dir < 4; dir++) {
                const newX = x + nbDirs[dir][0];
                const newY = y + nbDirs[dir][1];
                if (
                    coordinatesAreInMap(newX, newY)
                    && (
                        (interior[newX][newY] && !(newX === originX && newY === originY))
                        || (
                            (featureFlags & MF.MF_BUILD_ANYWHERE_ON_LEVEL)
                            && !cellHasTerrainFlag(pmap, { x: newX, y: newY }, T_PATHING_BLOCKER)
                            && pmap[newX][newY].machineNumber === 0
                        )
                    )
                ) {
                    return true;
                }
            }
        }
        return false;
    } else if (cellHasTerrainFlag(pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        return false;
    } else if (featureFlags & MF.MF_BUILD_ANYWHERE_ON_LEVEL) {
        if (
            (featureFlags & MF.MF_GENERATE_ITEM)
            && (cellHasTerrainFlag(pmap, { x, y }, TerrainFlag.T_OBSTRUCTS_ITEMS | T_PATHING_BLOCKER)
                || (pmap[x][y].flags & (TileFlag.IS_CHOKEPOINT | TileFlag.IN_LOOP | IS_IN_MACHINE)))
        ) {
            return false;
        } else {
            return !(pmap[x][y].flags & IS_IN_MACHINE);
        }
    } else if (interior[x][y]) {
        return true;
    }
    return false;
}

// =============================================================================
// Interior manipulation functions
// =============================================================================

/**
 * Recursively add tiles to machine interior by flood-filling through
 * cells with equal or lower choke values.
 *
 * C equivalent: `addTileToMachineInteriorAndIterate(interior, startX, startY)`
 *   in Architect.c line 400
 */
export function addTileToMachineInteriorAndIterate(
    pmap: Pcell[][],
    chokeMap: Grid,
    interior: Grid,
    startX: number,
    startY: number,
): boolean {
    let goodSoFar = true;

    interior[startX][startY] = 1;

    for (let dir = 0; dir < 4 && goodSoFar; dir++) {
        const newX = startX + nbDirs[dir][0];
        const newY = startY + nbDirs[dir][1];
        if (coordinatesAreInMap(newX, newY)) {
            if (
                (pmap[newX][newY].flags & TileFlag.HAS_ITEM)
                || ((pmap[newX][newY].flags & IS_IN_MACHINE) && !(pmap[newX][newY].flags & TileFlag.IS_GATE_SITE))
            ) {
                return false;
            }
            if (
                !interior[newX][newY]
                && chokeMap[newX][newY] <= chokeMap[startX][startY]
                && !(pmap[newX][newY].flags & IS_IN_MACHINE)
            ) {
                if (goodSoFar) {
                    goodSoFar = addTileToMachineInteriorAndIterate(pmap, chokeMap, interior, newX, newY);
                }
            }
        }
    }
    return goodSoFar;
}

/**
 * Expand the machine interior by absorbing neighboring wall cells that
 * have enough interior open neighbors and no exterior open neighbors.
 *
 * C equivalent: `expandMachineInterior(interior, minimumInteriorNeighbors)`
 *   in Architect.c line 607
 */
export function expandMachineInterior(
    pmap: Pcell[][],
    tCatalog: readonly FloorTileType[],
    interior: Grid,
    minimumInteriorNeighbors: number,
): void {
    let madeChange: boolean;

    do {
        madeChange = false;
        for (let i = 1; i < DCOLS - 1; i++) {
            for (let j = 1; j < DROWS - 1; j++) {
                if (
                    cellHasTerrainFlag(pmap, { x: i, y: j }, T_PATHING_BLOCKER)
                    && pmap[i][j].machineNumber === 0
                ) {
                    // Count up interior open neighbors
                    let nbcount = 0;
                    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                        const newX = i + nbDirs[dir][0];
                        const newY = j + nbDirs[dir][1];
                        if (
                            interior[newX][newY]
                            && !cellHasTerrainFlag(pmap, { x: newX, y: newY }, T_PATHING_BLOCKER)
                        ) {
                            nbcount++;
                        }
                    }
                    if (nbcount >= minimumInteriorNeighbors) {
                        // Make sure zero exterior open/machine neighbors
                        nbcount = 0;
                        for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                            const newX = i + nbDirs[dir][0];
                            const newY = j + nbDirs[dir][1];
                            if (
                                !interior[newX][newY]
                                && (!cellHasTerrainFlag(pmap, { x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) || pmap[newX][newY].machineNumber !== 0)
                            ) {
                                nbcount++;
                                break;
                            }
                        }
                        if (!nbcount) {
                            // Welcome the location into the machine
                            madeChange = true;
                            interior[i][j] = 1;
                            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                                if (tCatalog[pmap[i][j].layers[layer]].flags & T_PATHING_BLOCKER) {
                                    pmap[i][j].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING) as number;
                                }
                            }
                            for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                                const newX = i + nbDirs[dir][0];
                                const newY = j + nbDirs[dir][1];
                                if (pmap[newX][newY].layers[DungeonLayer.Dungeon] === TileType.GRANITE) {
                                    pmap[newX][newY].layers[DungeonLayer.Dungeon] = TileType.WALL;
                                }
                            }
                        }
                    }
                }
            }
        }
    } while (madeChange);

    // Clear doors and secret doors out of the interior
    for (let i = 1; i < DCOLS - 1; i++) {
        for (let j = 1; j < DROWS - 1; j++) {
            if (
                interior[i][j]
                && (pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.DOOR
                    || pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.SECRET_DOOR)
            ) {
                pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
            }
        }
    }
}

/**
 * Fill the interior for a vestibule (door guard) machine.
 * Uses Dijkstra distance from the origin to grab nearby cells.
 *
 * C equivalent: `fillInteriorForVestibuleMachine(interior, bp, originX, originY)`
 *   in Architect.c line 674
 */
export function fillInteriorForVestibuleMachine(
    pmap: Pcell[][],
    interior: Grid,
    blueprint: Blueprint,
    originX: number,
    originY: number,
    populateGenericCostMap: (costMap: Grid) => void,
): boolean {
    let success = true;

    zeroOutGrid(interior);

    const distanceMap = allocGrid();
    fillGrid(distanceMap, 30000);
    distanceMap[originX][originY] = 0;

    const costMap = allocGrid();
    populateGenericCostMap(costMap);
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (costMap[i][j] === 1 && (pmap[i][j].flags & IS_IN_MACHINE)) {
                costMap[i][j] = PDS_FORBIDDEN;
            }
        }
    }
    costMap[originX][originY] = 1;
    dijkstraScan(distanceMap, costMap, false);
    freeGrid(costMap);

    let qualifyingTileCount = 0;
    const totalFreq = randRange(blueprint.roomSize[0], blueprint.roomSize[1]);

    const sCols = new Array<number>(DCOLS);
    fillSequentialList(sCols);
    shuffleList(sCols);
    const sRows = new Array<number>(DROWS);
    fillSequentialList(sRows);
    shuffleList(sRows);

    for (let k = 0; k < 1000 && qualifyingTileCount < totalFreq; k++) {
        for (let i = 0; i < DCOLS && qualifyingTileCount < totalFreq; i++) {
            for (let j = 0; j < DROWS && qualifyingTileCount < totalFreq; j++) {
                if (distanceMap[sCols[i]][sRows[j]] === k) {
                    interior[sCols[i]][sRows[j]] = 1;
                    qualifyingTileCount++;

                    if (pmap[sCols[i]][sRows[j]].flags & TileFlag.HAS_ITEM) {
                        success = false;
                        qualifyingTileCount = totalFreq; // break out
                    }
                }
            }
        }
    }

    // Check blocking qualifications
    if (
        (blueprint.flags & BlueprintFlag.BP_TREAT_AS_BLOCKING)
        && levelIsDisconnectedWithBlockingMap(pmap, interior, false)
    ) {
        success = false;
    } else if (
        (blueprint.flags & BlueprintFlag.BP_REQUIRE_BLOCKING)
        && levelIsDisconnectedWithBlockingMap(pmap, interior, true) < 100
    ) {
        success = false;
    }

    freeGrid(distanceMap);
    return success;
}

/**
 * Redesign the interior of a machine by clearing it and cutting new rooms.
 *
 * C equivalent: `redesignInterior(interior, originX, originY, theProfileIndex)`
 *   in Architect.c line 734
 */
export function redesignInterior(
    pmap: Pcell[][],
    interior: Grid,
    originX: number,
    originY: number,
    dungeonProfile: DungeonProfile,
): void {
    const grid = allocGrid();
    const orphanList: Pos[] = [];

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (interior[i][j]) {
                if (i === originX && j === originY) {
                    grid[i][j] = 1; // All rooms must grow from this space
                } else {
                    grid[i][j] = 0; // Fair game for placing rooms
                }
            } else if (cellIsPassableOrDoor(pmap, i, j)) {
                grid[i][j] = 1; // Treat existing level as already built
                for (let dir = 0; dir < 4; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(newX, newY)
                        && interior[newX][newY]
                        && (newX !== originX || newY !== originY)
                    ) {
                        orphanList.push({ x: newX, y: newY });
                        grid[i][j] = -1; // Orphaned door is off limits
                        break;
                    }
                }
            } else {
                grid[i][j] = -1; // Exterior spaces off limits
            }
        }
    }

    attachRooms(grid, dungeonProfile, 40, 40);

    // Connect orphaned rooms
    if (orphanList.length > 0) {
        const pathingGrid = allocGrid();
        const costGrid = allocGrid();

        for (let n = 0; n < orphanList.length; n++) {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (interior[i][j]) {
                        if (grid[i][j] > 0) {
                            pathingGrid[i][j] = 0;
                            costGrid[i][j] = 1;
                        } else {
                            pathingGrid[i][j] = 30000;
                            costGrid[i][j] = 1;
                        }
                    } else {
                        pathingGrid[i][j] = 30000;
                        costGrid[i][j] = PDS_OBSTRUCTION;
                    }
                }
            }
            dijkstraScan(pathingGrid, costGrid, false);

            let i = orphanList[n].x;
            let j = orphanList[n].y;
            while (pathingGrid[i][j] > 0) {
                let foundDir = false;
                for (let dir = 0; dir < 4; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(newX, newY)
                        && pathingGrid[newX][newY] < pathingGrid[i][j]
                    ) {
                        grid[i][j] = 1;
                        i = newX;
                        j = newY;
                        foundDir = true;
                        break;
                    }
                }
                if (!foundDir) break;
            }
        }

        freeGrid(pathingGrid);
        freeGrid(costGrid);
    }

    addLoops(grid, 10);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (interior[i][j]) {
                if (grid[i][j] >= 0) {
                    pmap[i][j].layers[DungeonLayer.Surface] = TileType.NOTHING;
                    pmap[i][j].layers[DungeonLayer.Gas] = TileType.NOTHING;
                }
                if (grid[i][j] === 0) {
                    pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.GRANITE;
                    interior[i][j] = 0;
                }
                if (grid[i][j] >= 1) {
                    pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
                }
            }
        }
    }

    freeGrid(grid);
}

/**
 * Prepare the interior of a machine based on its blueprint flags.
 * This includes expanding, purging, surrounding with walls, redesigning, etc.
 *
 * C equivalent: `prepareInteriorWithMachineFlags(interior, originX, originY, flags, dungeonProfileIndex)`
 *   in Architect.c line 856
 */
export function prepareInteriorWithMachineFlags(
    pmap: Pcell[][],
    tCatalog: readonly FloorTileType[],
    interior: Grid,
    originX: number,
    originY: number,
    flags: number,
    dungeonProfile: DungeonProfile,
): void {
    const BP = BlueprintFlag;

    // Expand the interior
    if (flags & BP.BP_MAXIMIZE_INTERIOR) {
        expandMachineInterior(pmap, tCatalog, interior, 1);
    } else if (flags & BP.BP_OPEN_INTERIOR) {
        expandMachineInterior(pmap, tCatalog, interior, 4);
    }

    // Cleanse the interior — no interesting terrain
    if (flags & BP.BP_PURGE_INTERIOR) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (interior[i][j]) {
                    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                        pmap[i][j].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING) as number;
                    }
                }
            }
        }
    }

    // Purge pathing blockers
    if (flags & BP.BP_PURGE_PATHING_BLOCKERS) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (interior[i][j]) {
                    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                        if (tCatalog[pmap[i][j].layers[layer]].flags & T_PATHING_BLOCKER) {
                            pmap[i][j].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING) as number;
                        }
                    }
                }
            }
        }
    }

    // Purge liquids
    if (flags & BP.BP_PURGE_LIQUIDS) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (interior[i][j]) {
                    pmap[i][j].layers[DungeonLayer.Liquid] = TileType.NOTHING;
                }
            }
        }
    }

    // Surround with walls
    if (flags & BP.BP_SURROUND_WITH_WALLS) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (interior[i][j] && !(pmap[i][j].flags & TileFlag.IS_GATE_SITE)) {
                    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                        const newX = i + nbDirs[dir][0];
                        const newY = j + nbDirs[dir][1];
                        if (
                            coordinatesAreInMap(newX, newY)
                            && !interior[newX][newY]
                            && !cellHasTerrainFlag(pmap, { x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                            && !(pmap[newX][newY].flags & TileFlag.IS_GATE_SITE)
                            && !pmap[newX][newY].machineNumber
                            && cellHasTerrainFlag(pmap, { x: newX, y: newY }, T_PATHING_BLOCKER)
                        ) {
                            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                                pmap[newX][newY].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.WALL : 0) as number;
                            }
                        }
                    }
                }
            }
        }
    }

    // Redesign interior
    if (flags & BP.BP_REDESIGN_INTERIOR) {
        redesignInterior(pmap, interior, originX, originY, dungeonProfile);
    }

    // Mark as impregnable
    if (flags & BP.BP_IMPREGNABLE) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (interior[i][j] && !(pmap[i][j].flags & TileFlag.IS_GATE_SITE)) {
                    pmap[i][j].flags |= TileFlag.IMPREGNABLE;
                    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
                        const newX = i + nbDirs[dir][0];
                        const newY = j + nbDirs[dir][1];
                        if (
                            coordinatesAreInMap(newX, newY)
                            && !interior[newX][newY]
                            && !(pmap[newX][newY].flags & TileFlag.IS_GATE_SITE)
                        ) {
                            pmap[newX][newY].flags |= TileFlag.IMPREGNABLE;
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// Spawn map functions
// =============================================================================

/**
 * Propagate a dungeon feature's spawn map outward from the origin.
 *
 * C equivalent: `spawnMapDF(x, y, propagationTerrain, requirePropTerrain,
 *   startProb, probDec, spawnMap)` in Architect.c line 3278
 */
export function spawnMapDF(
    pmap: Pcell[][],
    x: number,
    y: number,
    propagationTerrain: number,
    requirePropTerrain: boolean,
    startProb: number,
    probDec: number,
    spawnMap: Grid,
): void {
    let t = 1;
    spawnMap[x][y] = t;

    let madeChange = true;
    let prob = startProb;

    while (madeChange && prob > 0) {
        madeChange = false;
        t++;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (spawnMap[i][j] === t - 1) {
                    for (let dir = 0; dir < 4; dir++) {
                        const x2 = i + nbDirs[dir][0];
                        const y2 = j + nbDirs[dir][1];
                        if (
                            coordinatesAreInMap(x2, y2)
                            && (!requirePropTerrain || (propagationTerrain > 0 && cellHasTerrainType(pmap, { x: x2, y: y2 }, propagationTerrain)))
                            && (!cellHasTerrainFlag(pmap, { x: x2, y: y2 }, TerrainFlag.T_OBSTRUCTS_SURFACE_EFFECTS) || (propagationTerrain > 0 && cellHasTerrainType(pmap, { x: x2, y: y2 }, propagationTerrain)))
                            && randPercent(prob)
                        ) {
                            spawnMap[x2][y2] = t;
                            madeChange = true;
                        }
                    }
                }
            }
        }
        prob -= probDec;
        if (t > 100) {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (spawnMap[i][j] === t) {
                        spawnMap[i][j] = 2;
                    } else if (spawnMap[i][j] > 0) {
                        spawnMap[i][j] = 1;
                    }
                }
            }
            t = 2;
        }
    }
    if (requirePropTerrain && !cellHasTerrainType(pmap, { x, y }, propagationTerrain)) {
        spawnMap[x][y] = 0;
    }
}

/**
 * Fill the spawn map into the pmap, placing terrain tiles where appropriate.
 * This is the non-runtime version used during dungeon generation
 * (refresh=false, so no creature/item effects).
 *
 * C equivalent: `fillSpawnMap(layer, surfaceTileType, spawnMap, blockedByOtherLayers,
 *   refresh, superpriority)` in Architect.c line 3208
 *
 * @returns true if at least one tile was placed
 */
export function fillSpawnMap(
    pmap: Pcell[][],
    tCatalog: readonly FloorTileType[],
    layer: DungeonLayer,
    surfaceTileType: number,
    spawnMap: Grid,
    blockedByOtherLayers: boolean,
    _refresh: boolean,
    superpriority: boolean,
): boolean {
    let accomplishedSomething = false;

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (
                spawnMap[i][j]
                && pmap[i][j].layers[layer] !== surfaceTileType
                && (superpriority || tCatalog[pmap[i][j].layers[layer]].drawPriority >= tCatalog[surfaceTileType].drawPriority)
                && !(layer === DungeonLayer.Surface && cellHasTerrainFlag(pmap, { x: i, y: j }, TerrainFlag.T_OBSTRUCTS_SURFACE_EFFECTS))
                && (!blockedByOtherLayers || tCatalog[pmap[i][j].layers[highestPriorityLayer(pmap, i, j, true)]].drawPriority >= tCatalog[surfaceTileType].drawPriority)
            ) {
                if (
                    (tCatalog[surfaceTileType].flags & TerrainFlag.T_IS_FIRE)
                    && !(tCatalog[pmap[i][j].layers[layer]].flags & TerrainFlag.T_IS_FIRE)
                ) {
                    pmap[i][j].flags |= TileFlag.CAUGHT_FIRE_THIS_TURN;
                }

                if (
                    (tCatalog[pmap[i][j].layers[layer]].flags & T_PATHING_BLOCKER)
                    !== (tCatalog[surfaceTileType].flags & T_PATHING_BLOCKER)
                ) {
                    // staleLoopMap would be set on rogue state
                }

                pmap[i][j].layers[layer] = surfaceTileType;
                accomplishedSomething = true;

                // Note: refresh-related operations (refreshDungeonCell, applyInstantTileEffectsToCreature,
                // burnItem) are skipped during dungeon generation (refresh=false).
                // They will be handled when the full runtime is ported.
            } else {
                spawnMap[i][j] = 0;
            }
        }
    }
    return accomplishedSomething;
}

/**
 * Spawn a dungeon feature at the given location.
 * Simplified version for dungeon generation (refreshCell=false path).
 *
 * C equivalent: `spawnDungeonFeature(x, y, feat, refreshCell, abortIfBlocking)`
 *   in Architect.c line 3359
 *
 * @returns true if the feature was successfully generated
 */
export function spawnDungeonFeature(
    pmap: Pcell[][],
    tCatalog: readonly FloorTileType[],
    dungeonFeatureCatalog: readonly DungeonFeature[],
    x: number,
    y: number,
    feat: DungeonFeature,
    refreshCell: boolean,
    abortIfBlocking: boolean,
): boolean {
    const blockingMap = allocGrid();
    fillGrid(blockingMap, 0);

    // Determine if blocking check is needed
    const blocking = (
        abortIfBlocking
        && !(feat.flags & DFFlag.DFF_PERMIT_BLOCKING)
        && ((tCatalog[feat.tile].flags & T_PATHING_BLOCKER)
            || (feat.flags & DFFlag.DFF_TREAT_AS_BLOCKING))
    );

    let succeeded: boolean;

    if (feat.tile) {
        if (feat.layer === DungeonLayer.Gas) {
            pmap[x][y].volume += feat.startProbability;
            pmap[x][y].layers[DungeonLayer.Gas] = feat.tile;
            succeeded = true;
        } else {
            spawnMapDF(
                pmap,
                x, y,
                feat.propagationTerrain,
                feat.propagationTerrain ? true : false,
                feat.startProbability,
                feat.probabilityDecrement,
                blockingMap,
            );

            if (!blocking || !levelIsDisconnectedWithBlockingMap(pmap, blockingMap, false)) {
                fillSpawnMap(
                    pmap,
                    tCatalog,
                    feat.layer,
                    feat.tile,
                    blockingMap,
                    !!(feat.flags & DFFlag.DFF_BLOCKED_BY_OTHER_LAYERS),
                    refreshCell,
                    !!(feat.flags & DFFlag.DFF_SUPERPRIORITY),
                );
                succeeded = true;
            } else {
                succeeded = false;
            }
        }
    } else {
        blockingMap[x][y] = 1;
        succeeded = true;
    }

    if (succeeded && (feat.flags & (DFFlag.DFF_CLEAR_LOWER_PRIORITY_TERRAIN | DFFlag.DFF_CLEAR_OTHER_TERRAIN))) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (blockingMap[i][j]) {
                    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                        if (layer !== feat.layer && layer !== DungeonLayer.Gas) {
                            if (feat.flags & DFFlag.DFF_CLEAR_LOWER_PRIORITY_TERRAIN) {
                                if (tCatalog[pmap[i][j].layers[layer]].drawPriority <= tCatalog[feat.tile].drawPriority) {
                                    continue;
                                }
                            }
                            pmap[i][j].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING) as number;
                        }
                    }
                }
            }
        }
    }

    // Handle subsequent DFs
    if (succeeded && feat.subsequentDF) {
        if (feat.flags & DFFlag.DFF_SUBSEQ_EVERYWHERE) {
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (blockingMap[i][j]) {
                        spawnDungeonFeature(pmap, tCatalog, dungeonFeatureCatalog, i, j, dungeonFeatureCatalog[feat.subsequentDF], refreshCell, abortIfBlocking);
                    }
                }
            }
        } else {
            spawnDungeonFeature(pmap, tCatalog, dungeonFeatureCatalog, x, y, dungeonFeatureCatalog[feat.subsequentDF], refreshCell, abortIfBlocking);
        }
    }

    freeGrid(blockingMap);
    return succeeded;
}

// =============================================================================
// Machine building data structure
// =============================================================================

/** Internal working data for buildAMachine (mirrors C's machineData struct). */
interface MachineData {
    interior: Grid;       // Master grid for the machine
    occupied: Grid;       // Personal space of previously built features
    candidates: Grid;     // Feature candidate locations
    blockingMap: Grid;    // Blocking check grid
    viewMap: Grid;        // FOV grid for MF_IN_VIEW_OF_ORIGIN
    levelBackup: Pcell[][];  // Backup of pmap before modifications
    spawnedItems: (MachineItem | null)[];
    spawnedItemsSub: (MachineItem | null)[];
    spawnedMonsters: (MachineCreature | null)[];
    spawnedMonstersSub: (MachineCreature | null)[];
    gateCandidates: Pos[];
    distances: number[];
    sCols: number[];
    sRows: number[];
}

function createMachineData(): MachineData {
    const interior = allocGrid();
    const occupied = allocGrid();
    const candidates = allocGrid();
    const blockingMap = allocGrid();
    const viewMap = allocGrid();

    // Create pmap backup
    const levelBackup: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        levelBackup[i] = [];
        for (let j = 0; j < DROWS; j++) {
            levelBackup[i][j] = {
                layers: new Array(NUMBER_TERRAIN_LAYERS).fill(0),
                flags: 0,
                volume: 0,
                machineNumber: 0,
            } as Pcell;
        }
    }

    return {
        interior,
        occupied,
        candidates,
        blockingMap,
        viewMap,
        levelBackup,
        spawnedItems: new Array(MACHINES_BUFFER_LENGTH).fill(null),
        spawnedItemsSub: new Array(MACHINES_BUFFER_LENGTH).fill(null),
        spawnedMonsters: new Array(MACHINES_BUFFER_LENGTH).fill(null),
        spawnedMonstersSub: new Array(MACHINES_BUFFER_LENGTH).fill(null),
        gateCandidates: [],
        distances: new Array(100).fill(0),
        sCols: new Array(DCOLS).fill(0),
        sRows: new Array(DROWS).fill(0),
    };
}

function freeMachineData(p: MachineData): void {
    freeGrid(p.interior);
    freeGrid(p.occupied);
    freeGrid(p.candidates);
    freeGrid(p.blockingMap);
    freeGrid(p.viewMap);
}

// =============================================================================
// buildAMachine — The core machine building function (~750 lines in C)
// =============================================================================

/**
 * Build a machine from a blueprint.
 *
 * If bp <= 0, a blueprint is randomly chosen from those that qualify.
 * If originX/originY <= 0, a location is chosen automatically.
 *
 * C equivalent: `buildAMachine(bp, originX, originY, requiredMachineFlags,
 *   adoptiveItem, parentSpawnedItems, parentSpawnedMonsters)`
 *   in Architect.c line 984
 *
 * @returns true if the machine was successfully built
 */
export function buildAMachine(
    ctx: MachineContext,
    bpIndex: number,
    originX: number,
    originY: number,
    requiredMachineFlags: number,
    adoptiveItem: MachineItem | null,
    parentSpawnedItems: (MachineItem | null)[] | null,
    parentSpawnedMonsters: (MachineCreature | null)[] | null,
): boolean {
    const alternativeFlags = [MachineFeatureFlag.MF_ALTERNATIVE, MachineFeatureFlag.MF_ALTERNATIVE_2];
    const MF = MachineFeatureFlag;
    const BP = BlueprintFlag;

    const chooseBP = bpIndex <= 0;
    const chooseLocation = originX <= 0 || originY <= 0;

    let distanceMap: Grid | null = null;
    let bp = bpIndex;

    const p = createMachineData();

    let failsafe = 10;
    let tryAgain: boolean;

    do {
        tryAgain = false;
        if (--failsafe <= 0) {
            if (distanceMap) freeGrid(distanceMap);
            freeMachineData(p);
            return false;
        }

        if (chooseBP) {
            // Pick a qualifying blueprint
            let totalFreq = 0;
            for (let i = 1; i < ctx.gameConstants.numberBlueprints; i++) {
                if (blueprintQualifies(ctx.blueprintCatalog, i, ctx.depthLevel, requiredMachineFlags)) {
                    totalFreq += ctx.blueprintCatalog[i].frequency;
                }
            }

            if (!totalFreq) {
                if (distanceMap) freeGrid(distanceMap);
                freeMachineData(p);
                return false;
            }

            let randIndex = randRange(1, totalFreq);
            for (let i = 1; i < ctx.gameConstants.numberBlueprints; i++) {
                if (blueprintQualifies(ctx.blueprintCatalog, i, ctx.depthLevel, requiredMachineFlags)) {
                    if (randIndex <= ctx.blueprintCatalog[i].frequency) {
                        bp = i;
                        break;
                    } else {
                        randIndex -= ctx.blueprintCatalog[i].frequency;
                    }
                }
            }
        }

        const blueprint = ctx.blueprintCatalog[bp];

        // Find a location and map out the machine interior
        if (blueprint.flags & BP.BP_ROOM) {
            // Room machine — find gate sites
            zeroOutGrid(p.interior);

            if (chooseLocation) {
                ctx.analyzeMap(true);
                let totalFreq = 0;
                p.gateCandidates = [];
                for (let i = 0; i < DCOLS; i++) {
                    for (let j = 0; j < DROWS && totalFreq < 50; j++) {
                        if (
                            (ctx.pmap[i][j].flags & TileFlag.IS_GATE_SITE)
                            && !(ctx.pmap[i][j].flags & IS_IN_MACHINE)
                            && ctx.chokeMap[i][j] >= blueprint.roomSize[0]
                            && ctx.chokeMap[i][j] <= blueprint.roomSize[1]
                        ) {
                            p.gateCandidates.push({ x: i, y: j });
                            totalFreq++;
                        }
                    }
                }

                if (totalFreq) {
                    const randIndex = randRange(0, totalFreq - 1);
                    originX = p.gateCandidates[randIndex].x;
                    originY = p.gateCandidates[randIndex].y;
                } else {
                    if (distanceMap) freeGrid(distanceMap);
                    freeMachineData(p);
                    return false;
                }
            }

            tryAgain = !addTileToMachineInteriorAndIterate(ctx.pmap, ctx.chokeMap, p.interior, originX, originY);

        } else if (blueprint.flags & BP.BP_VESTIBULE) {
            if (chooseLocation) {
                if (distanceMap) freeGrid(distanceMap);
                freeMachineData(p);
                return false;
            }
            if (!fillInteriorForVestibuleMachine(ctx.pmap, p.interior, blueprint, originX, originY, ctx.populateGenericCostMap)) {
                if (distanceMap) freeGrid(distanceMap);
                freeMachineData(p);
                return false;
            }

        } else {
            // Non-room machine — expand from random origin
            let locationFailsafe = 10;
            do {
                zeroOutGrid(p.interior);
                tryAgain = false;

                if (chooseLocation) {
                    const loc = randomMatchingLocation(ctx.pmap, ctx.tileCatalog, TileType.FLOOR, TileType.NOTHING, -1);
                    if (loc) {
                        originX = loc.x;
                        originY = loc.y;
                    } else {
                        tryAgain = true;
                        continue;
                    }
                }

                if (!distanceMap) {
                    distanceMap = allocGrid();
                }
                fillGrid(distanceMap, 0);
                ctx.calculateDistances(distanceMap, originX, originY, T_PATHING_BLOCKER, null, true, false);

                let qualifyingTileCount = 0;
                const totalFreq = randRange(blueprint.roomSize[0], blueprint.roomSize[1]);

                fillSequentialList(p.sCols);
                shuffleList(p.sCols);
                fillSequentialList(p.sRows);
                shuffleList(p.sRows);

                for (let k = 0; k < 1000 && qualifyingTileCount < totalFreq; k++) {
                    for (let i = 0; i < DCOLS && qualifyingTileCount < totalFreq; i++) {
                        for (let j = 0; j < DROWS && qualifyingTileCount < totalFreq; j++) {
                            if (distanceMap[p.sCols[i]][p.sRows[j]] === k) {
                                p.interior[p.sCols[i]][p.sRows[j]] = 1;
                                qualifyingTileCount++;

                                if (ctx.pmap[p.sCols[i]][p.sRows[j]].flags & (TileFlag.HAS_ITEM | TileFlag.HAS_MONSTER | IS_IN_MACHINE)) {
                                    tryAgain = true;
                                    qualifyingTileCount = totalFreq; // break out
                                }
                            }
                        }
                    }
                }

                if (
                    (blueprint.flags & BP.BP_TREAT_AS_BLOCKING)
                    && levelIsDisconnectedWithBlockingMap(ctx.pmap, p.interior, false)
                ) {
                    tryAgain = true;
                } else if (
                    (blueprint.flags & BP.BP_REQUIRE_BLOCKING)
                    && levelIsDisconnectedWithBlockingMap(ctx.pmap, p.interior, true) < 100
                ) {
                    tryAgain = true;
                }
            } while (chooseBP && tryAgain && --locationFailsafe);
        }

        if (tryAgain && !chooseBP && !chooseLocation) {
            if (distanceMap) freeGrid(distanceMap);
            freeMachineData(p);
            return false;
        }

    } while (tryAgain);

    const blueprint = ctx.blueprintCatalog[bp];

    // Point of no return — back up the level
    copyMap(ctx.pmap, p.levelBackup);

    // Prepare interior with machine flags
    prepareInteriorWithMachineFlags(
        ctx.pmap, ctx.tileCatalog, p.interior, originX, originY,
        blueprint.flags, ctx.dungeonProfileCatalog[blueprint.dungeonProfileType],
    );

    // Label interior and assign machine number
    const machineNumber = ++ctx.machineNumber;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (p.interior[i][j]) {
                ctx.pmap[i][j].flags |= ((blueprint.flags & BP.BP_ROOM) ? TileFlag.IS_IN_ROOM_MACHINE : TileFlag.IS_IN_AREA_MACHINE);
                ctx.pmap[i][j].machineNumber = machineNumber;
                // Clear secret doors inside machines
                if (ctx.pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.SECRET_DOOR) {
                    ctx.pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.DOOR;
                }
                // Clear wired tiles
                for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                    if (ctx.tileCatalog[ctx.pmap[i][j].layers[layer]].mechFlags & (TerrainMechFlag.TM_IS_WIRED | TerrainMechFlag.TM_IS_CIRCUIT_BREAKER)) {
                        ctx.pmap[i][j].layers[layer] = (layer === DungeonLayer.Dungeon ? TileType.FLOOR : TileType.NOTHING) as number;
                    }
                }
            }
        }
    }

    // Calculate distance map and percentiles
    if (!distanceMap) {
        distanceMap = allocGrid();
    }
    fillGrid(distanceMap, 0);
    ctx.calculateDistances(distanceMap, originX, originY, T_PATHING_BLOCKER, null, true, true);

    let qualifyingTileCount = 0;
    for (let i = 0; i < 100; i++) {
        p.distances[i] = 0;
    }
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (p.interior[i][j] && distanceMap[i][j] < 100) {
                p.distances[distanceMap[i][j]]++;
                qualifyingTileCount++;
            }
        }
    }

    let distance25 = Math.floor(qualifyingTileCount / 4);
    let distance75 = Math.floor(3 * qualifyingTileCount / 4);
    for (let i = 0; i < 100; i++) {
        if (distance25 <= p.distances[i]) {
            distance25 = i;
            break;
        } else {
            distance25 -= p.distances[i];
        }
    }
    for (let i = 0; i < 100; i++) {
        if (distance75 <= p.distances[i]) {
            distance75 = i;
            break;
        } else {
            distance75 -= p.distances[i];
        }
    }

    // Decide which features to skip (MF_ALTERNATIVE handling)
    const skipFeature: boolean[] = new Array(blueprint.featureCount).fill(false);
    for (let j = 0; j <= 1; j++) {
        let totalFreq = 0;
        for (let i = 0; i < blueprint.featureCount; i++) {
            if (blueprint.feature[i].flags & alternativeFlags[j]) {
                skipFeature[i] = true;
                totalFreq++;
            }
        }
        if (totalFreq > 0) {
            let randIndex = randRange(1, totalFreq);
            for (let i = 0; i < blueprint.featureCount; i++) {
                if (blueprint.feature[i].flags & alternativeFlags[j]) {
                    if (randIndex === 1) {
                        skipFeature[i] = false; // This alternative gets built
                        break;
                    } else {
                        randIndex--;
                    }
                }
            }
        }
    }

    // Track spawned items/monsters
    let itemCount = 0;
    let monsterCount = 0;
    let leader: MachineCreature | null = null;
    let torchBearer: MachineCreature | null = null;
    let torch: MachineItem | null = null;

    zeroOutGrid(p.occupied);

    // Build features
    for (let feat = 0; feat < blueprint.featureCount; feat++) {
        if (skipFeature[feat]) continue;

        const feature = blueprint.feature[feat];

        // Distance bounds
        const distanceBound: [number, number] = [0, 10000];
        if (feature.flags & MF.MF_NEAR_ORIGIN) {
            distanceBound[1] = distance25;
        }
        if (feature.flags & MF.MF_FAR_FROM_ORIGIN) {
            distanceBound[0] = distance75;
        }

        // View map
        if (feature.flags & (MF.MF_IN_VIEW_OF_ORIGIN | MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN)) {
            zeroOutGrid(p.viewMap);
            const maxRadius = BigInt(Math.max(DCOLS, DROWS)) * 65536n; // FP_FACTOR
            if (feature.flags & MF.MF_IN_PASSABLE_VIEW_OF_ORIGIN) {
                ctx.getFOVMask(p.viewMap, originX, originY, maxRadius, T_PATHING_BLOCKER, 0, false);
            } else {
                ctx.getFOVMask(
                    p.viewMap, originX, originY, maxRadius,
                    (TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION),
                    0, false,
                );
            }
            p.viewMap[originX][originY] = 1;
        }

        let instance: number;

        do {
            // Build candidate map
            qualifyingTileCount = 0;
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (cellIsFeatureCandidate(
                        ctx.pmap, ctx.tileCatalog, i, j,
                        originX, originY,
                        distanceBound,
                        p.interior, p.occupied, p.viewMap, distanceMap,
                        machineNumber, feature.flags, blueprint.flags,
                    )) {
                        qualifyingTileCount++;
                        p.candidates[i][j] = 1;
                    } else {
                        p.candidates[i][j] = 0;
                    }
                }
            }

            // Determine instance count
            let generateEverywhere: boolean;
            let instanceCount: number;
            if (feature.flags & MF.MF_EVERYWHERE & ~MF.MF_BUILD_AT_ORIGIN) {
                generateEverywhere = true;
                instanceCount = 0;
            } else {
                generateEverywhere = false;
                instanceCount = randRange(feature.instanceCountRange[0], feature.instanceCountRange[1]);
            }

            const personalSpace = feature.personalSpace;

            for (instance = 0; (generateEverywhere || instance < instanceCount) && qualifyingTileCount > 0;) {
                // Find a location
                let featX: number;
                let featY: number;

                if (feature.flags & MF.MF_BUILD_AT_ORIGIN) {
                    featX = originX;
                    featY = originY;
                } else {
                    featX = -1;
                    featY = -1;
                    let randIndex = randRange(1, qualifyingTileCount);
                    for (let i = 0; i < DCOLS && featX < 0; i++) {
                        for (let j = 0; j < DROWS && featX < 0; j++) {
                            if (p.candidates[i][j]) {
                                if (randIndex === 1) {
                                    featX = i;
                                    featY = j;
                                } else {
                                    randIndex--;
                                }
                            }
                        }
                    }
                }

                p.candidates[featX][featY] = 0;
                qualifyingTileCount--;

                let DFSucceeded = true;
                let terrainSucceeded = true;

                // Try to build the DF
                if (feature.featureDF) {
                    DFSucceeded = spawnDungeonFeature(
                        ctx.pmap, ctx.tileCatalog, ctx.dungeonFeatureCatalog,
                        featX, featY,
                        ctx.dungeonFeatureCatalog[feature.featureDF],
                        false,
                        !(feature.flags & MF.MF_PERMIT_BLOCKING),
                    );
                }

                // Try to place terrain
                if (DFSucceeded && feature.terrain) {
                    if (
                        !(feature.flags & MF.MF_PERMIT_BLOCKING)
                        && ((ctx.tileCatalog[feature.terrain].flags & T_PATHING_BLOCKER) || (feature.flags & MF.MF_TREAT_AS_BLOCKING))
                    ) {
                        zeroOutGrid(p.blockingMap);
                        p.blockingMap[featX][featY] = 1;
                        terrainSucceeded = !levelIsDisconnectedWithBlockingMap(ctx.pmap, p.blockingMap, false);
                    }
                    if (terrainSucceeded) {
                        ctx.pmap[featX][featY].layers[feature.layer] = feature.terrain;
                    }
                }

                // Clear personal space around placed feature
                if (DFSucceeded && terrainSucceeded) {
                    for (let i = featX - personalSpace + 1; i <= featX + personalSpace - 1; i++) {
                        for (let j = featY - personalSpace + 1; j <= featY + personalSpace - 1; j++) {
                            if (coordinatesAreInMap(i, j)) {
                                if (p.candidates[i][j]) {
                                    p.candidates[i][j] = 0;
                                    qualifyingTileCount--;
                                }
                                p.occupied[i][j] = 1;
                            }
                        }
                    }
                    instance++;
                }

                if (DFSucceeded && terrainSucceeded) {
                    let theItem: MachineItem | null = null;

                    // Mark as machine cell
                    ctx.pmap[featX][featY].flags |= ((blueprint.flags & BP.BP_ROOM) ? TileFlag.IS_IN_ROOM_MACHINE : TileFlag.IS_IN_AREA_MACHINE);
                    ctx.pmap[featX][featY].machineNumber = machineNumber;

                    // Impregnable
                    if (feature.flags & MF.MF_IMPREGNABLE) {
                        ctx.pmap[featX][featY].flags |= TileFlag.IMPREGNABLE;
                    }

                    // Generate item
                    if (
                        (feature.flags & MF.MF_GENERATE_ITEM)
                        || (adoptiveItem && (feature.flags & MF.MF_ADOPT_ITEM) && (blueprint.flags & BP.BP_ADOPT_ITEM))
                    ) {
                        if (adoptiveItem && (feature.flags & MF.MF_ADOPT_ITEM) && (blueprint.flags & BP.BP_ADOPT_ITEM)) {
                            theItem = adoptiveItem;
                            adoptiveItem = null;
                        } else {
                            theItem = ctx.itemOps.generateItem(feature.itemCategory, feature.itemKind);
                            let itemFailsafe = 1000;
                            while (
                                (theItem.flags & ItemFlag.ITEM_CURSED)
                                || ((feature.flags & MF.MF_REQUIRE_GOOD_RUNIC) && !(theItem.flags & ItemFlag.ITEM_RUNIC))
                                || ((feature.flags & MF.MF_NO_THROWING_WEAPONS) && theItem.category === ItemCategory.WEAPON && theItem.quantity > 1)
                                || ((feature.flags & MF.MF_REQUIRE_HEAVY_WEAPON) && (!ctx.itemOps.itemIsHeavyWeapon(theItem) || !ctx.itemOps.itemIsPositivelyEnchanted(theItem)))
                                || itemIsADuplicate(theItem, p.spawnedItems, itemCount)
                            ) {
                                ctx.itemOps.deleteItem(theItem);
                                theItem = ctx.itemOps.generateItem(feature.itemCategory, feature.itemKind);
                                if (itemFailsafe-- <= 0) break;
                            }
                            p.spawnedItems[itemCount] = theItem;
                            itemCount++;
                        }
                        theItem.flags |= feature.itemFlags;

                        addLocationToKey(theItem, featX, featY, !!(feature.flags & MF.MF_KEY_DISPOSABLE));
                        theItem.originDepth = ctx.depthLevel;
                        if (feature.flags & MF.MF_SKELETON_KEY) {
                            addMachineNumberToKey(theItem, machineNumber, !!(feature.flags & MF.MF_KEY_DISPOSABLE));
                        }
                        if (
                            !(feature.flags & MF.MF_OUTSOURCE_ITEM_TO_MACHINE)
                            && !(feature.flags & MF.MF_MONSTER_TAKE_ITEM)
                        ) {
                            ctx.itemOps.placeItemAt(theItem, { x: featX, y: featY });
                        }
                    }

                    // Handle sub-machines (outsourcing items / vestibules)
                    if (feature.flags & (MF.MF_OUTSOURCE_ITEM_TO_MACHINE | MF.MF_BUILD_VESTIBULE)) {
                        let i: number;
                        let subSuccess = false;
                        for (i = 10; i > 0; i--) {
                            if ((feature.flags & MF.MF_OUTSOURCE_ITEM_TO_MACHINE) && theItem) {
                                ctx.itemOps.removeItemFromArray(theItem, ctx.floorItems);
                                ctx.itemOps.removeItemFromArray(theItem, ctx.packItems);
                                subSuccess = buildAMachine(ctx, -1, -1, -1, BP.BP_ADOPT_ITEM, theItem, p.spawnedItemsSub, p.spawnedMonstersSub);
                            } else if (feature.flags & MF.MF_BUILD_VESTIBULE) {
                                subSuccess = buildAMachine(ctx, -1, featX, featY, BP.BP_VESTIBULE, null, p.spawnedItemsSub, p.spawnedMonstersSub);
                            }

                            if (subSuccess) {
                                // Merge sub-machine's items/monsters into ours
                                for (let j = 0; j < MACHINES_BUFFER_LENGTH && p.spawnedItemsSub[j]; j++) {
                                    p.spawnedItems[itemCount] = p.spawnedItemsSub[j];
                                    itemCount++;
                                    p.spawnedItemsSub[j] = null;
                                }
                                for (let j = 0; j < MACHINES_BUFFER_LENGTH && p.spawnedMonstersSub[j]; j++) {
                                    p.spawnedMonsters[monsterCount] = p.spawnedMonstersSub[j];
                                    monsterCount++;
                                    p.spawnedMonstersSub[j] = null;
                                }
                                break;
                            }
                        }

                        if (!i) {
                            // Sub-machine failed — abort
                            copyMap(p.levelBackup, ctx.pmap);
                            abortItemsAndMonsters(ctx, p.spawnedItems, p.spawnedMonsters);
                            freeGrid(distanceMap!);
                            freeMachineData(p);
                            return false;
                        }
                        theItem = null;
                    }

                    // Generate monsters
                    if ((feature.flags & MF.MF_GENERATE_HORDE) || feature.monsterID) {
                        let monst: MachineCreature | null = null;

                        if (feature.flags & MF.MF_GENERATE_HORDE) {
                            monst = ctx.monsterOps.spawnHorde(
                                0,
                                { x: featX, y: featY },
                                (HordeFlag.HORDE_IS_SUMMONED | HordeFlag.HORDE_LEADER_CAPTIVE) & ~feature.hordeFlags,
                                feature.hordeFlags,
                            );
                            if (monst) {
                                monst.bookkeepingFlags |= MB.MB_JUST_SUMMONED;
                            }
                        }

                        if (feature.monsterID) {
                            monst = ctx.monsterOps.monsterAtLoc({ x: featX, y: featY });
                            if (monst) {
                                ctx.monsterOps.killCreature(monst, true);
                            }
                            monst = ctx.monsterOps.generateMonster(feature.monsterID, true, true);
                            if (monst) {
                                monst.loc = { x: featX, y: featY };
                                ctx.pmap[featX][featY].flags |= TileFlag.HAS_MONSTER;
                                monst.bookkeepingFlags |= MB.MB_JUST_SUMMONED;
                            }
                        }

                        if (monst) {
                            if (!leader) {
                                leader = monst;
                            }

                            if (theItem && (feature.flags & MF.MF_MONSTER_TAKE_ITEM)) {
                                torchBearer = monst;
                                torch = theItem;
                            }
                        }

                        // Process all just-summoned monsters
                        const justSummoned = ctx.monsterOps.iterateMachineMonsters();
                        for (const m of justSummoned) {
                            if (m.bookkeepingFlags & MB.MB_JUST_SUMMONED) {
                                if (!(m.bookkeepingFlags & (MB.MB_LEADER | MB.MB_FOLLOWER))) {
                                    if (leader && leader !== m) {
                                        m.leader = leader;
                                        m.bookkeepingFlags &= ~MB.MB_LEADER;
                                        m.bookkeepingFlags |= MB.MB_FOLLOWER;
                                        leader.bookkeepingFlags |= MB.MB_LEADER;
                                    } else {
                                        leader = m;
                                    }
                                }

                                m.bookkeepingFlags &= ~MB.MB_JUST_SUMMONED;
                                p.spawnedMonsters[monsterCount] = m;
                                monsterCount++;

                                if (feature.flags & MF.MF_MONSTER_SLEEPING) {
                                    m.creatureState = CreatureState.Sleeping;
                                }
                                if (feature.flags & MF.MF_MONSTER_FLEEING) {
                                    m.creatureState = CreatureState.Fleeing;
                                    m.creatureMode = CreatureMode.PermFleeing;
                                }
                                if (feature.flags & MF.MF_MONSTERS_DORMANT) {
                                    ctx.monsterOps.toggleMonsterDormancy(m);
                                    if (!(feature.flags & MF.MF_MONSTER_SLEEPING) && m.creatureState !== CreatureState.Ally) {
                                        m.creatureState = CreatureState.TrackingScent;
                                    }
                                }
                                m.machineHome = machineNumber;
                            }
                        }
                    }
                }
                // Finished with this instance
            }
        } while ((feature.flags & MF.MF_REPEAT_UNTIL_NO_PROGRESS) && instance >= feature.minimumInstanceCount);

        if (instance < feature.minimumInstanceCount && !(feature.flags & MF.MF_REPEAT_UNTIL_NO_PROGRESS)) {
            // Feature placement failed — abort
            copyMap(p.levelBackup, ctx.pmap);
            abortItemsAndMonsters(ctx, p.spawnedItems, p.spawnedMonsters);
            freeGrid(distanceMap!);
            freeMachineData(p);
            return false;
        }
    }

    // Clear interior flag for non-wired cells if requested
    if (blueprint.flags & BP.BP_NO_INTERIOR_FLAG) {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (
                    ctx.pmap[i][j].machineNumber === machineNumber
                    && !cellHasTMFlag(ctx.pmap, { x: i, y: j }, TerrainMechFlag.TM_IS_WIRED | TerrainMechFlag.TM_IS_CIRCUIT_BREAKER)
                ) {
                    ctx.pmap[i][j].flags &= ~IS_IN_MACHINE;
                    ctx.pmap[i][j].machineNumber = 0;
                }
            }
        }
    }

    // Give item to torch bearer if applicable
    if (torchBearer && torch) {
        if (torchBearer.carriedItem) {
            ctx.itemOps.deleteItem(torchBearer.carriedItem);
        }
        ctx.itemOps.removeItemFromArray(torch, ctx.floorItems);
        torchBearer.carriedItem = torch;
    }

    freeGrid(distanceMap!);

    // Pass created items/monsters to parent
    if (parentSpawnedItems) {
        for (let i = 0; i < itemCount; i++) {
            parentSpawnedItems[i] = p.spawnedItems[i];
        }
    }
    if (parentSpawnedMonsters) {
        for (let i = 0; i < monsterCount; i++) {
            parentSpawnedMonsters[i] = p.spawnedMonsters[i];
        }
    }

    freeMachineData(p);
    return true;
}

/**
 * Abort spawned items and monsters when machine construction fails.
 *
 * C equivalent: `abortItemsAndMonsters(spawnedItems, spawnedMonsters)`
 *   in Architect.c line 470
 */
function abortItemsAndMonsters(
    ctx: MachineContext,
    spawnedItems: (MachineItem | null)[],
    spawnedMonsters: (MachineCreature | null)[],
): void {
    for (let i = 0; i < MACHINES_BUFFER_LENGTH && spawnedItems[i]; i++) {
        ctx.itemOps.removeItemFromArray(spawnedItems[i]!, ctx.floorItems);
        ctx.itemOps.removeItemFromArray(spawnedItems[i]!, ctx.packItems);
        // Remove item from any monster that's carrying it
        for (let j = 0; j < MACHINES_BUFFER_LENGTH && spawnedMonsters[j]; j++) {
            if (spawnedMonsters[j]!.carriedItem === spawnedItems[i]) {
                spawnedMonsters[j]!.carriedItem = null;
                break;
            }
        }
        ctx.itemOps.deleteItem(spawnedItems[i]!);
        spawnedItems[i] = null;
    }
    for (let i = 0; i < MACHINES_BUFFER_LENGTH && spawnedMonsters[i]; i++) {
        ctx.monsterOps.killCreature(spawnedMonsters[i]!, true);
        spawnedMonsters[i] = null;
    }
}

// =============================================================================
// Top-level machine placement functions
// =============================================================================

/**
 * Add machines to the dungeon level.
 *
 * C equivalent: `addMachines()` in Architect.c line 1732
 */
export function addMachines(ctx: MachineContext): void {
    ctx.analyzeMap(true);

    // Add the amulet holder on the amulet level
    if (ctx.depthLevel === ctx.gameConstants.amuletLevel) {
        for (let failsafe = 50; failsafe; failsafe--) {
            if (buildAMachine(ctx, MachineType.AmuletArea, -1, -1, 0, null, null, null)) {
                break;
            }
        }
    }

    // Add reward rooms
    let machineCount = 0;
    while (
        ctx.depthLevel <= ctx.gameConstants.deepestLevelForMachines
        && (ctx.rewardRoomsGenerated + machineCount)
            * ctx.gameConstants.machinesPerLevelSuppressionMultiplier
            + ctx.gameConstants.machinesPerLevelSuppressionOffset
            < ctx.depthLevel * ctx.gameConstants.machinesPerLevelIncreaseFactor
    ) {
        machineCount++;
    }

    let randomMachineFactor = (
        ctx.depthLevel <= ctx.gameConstants.maxLevelForBonusMachines
        && (ctx.rewardRoomsGenerated + machineCount) === 0
    ) ? 40 : 15;

    while (randPercent(Math.max(randomMachineFactor, 15 * ctx.gameConstants.machinesPerLevelIncreaseFactor)) && machineCount < 100) {
        randomMachineFactor = 15;
        machineCount++;
    }

    for (let failsafe = 50; machineCount && failsafe; failsafe--) {
        if (buildAMachine(ctx, -1, -1, -1, BP.BP_REWARD, null, null, null)) {
            machineCount--;
            ctx.rewardRoomsGenerated++;
        }
    }
}

/**
 * Run autogenerators to add terrain, DFs, and flavor machines.
 *
 * C equivalent: `runAutogenerators(buildAreaMachines)` in Architect.c line 1780
 *
 * @param buildAreaMachines - if true, build ONLY generators that include machines;
 *   if false, build all EXCEPT generators that include machines.
 */
export function runAutogenerators(ctx: MachineContext, buildAreaMachines: boolean): void {
    for (let ag = 1; ag < ctx.gameConstants.numberAutogenerators; ag++) {
        const gen = ctx.autoGeneratorCatalog[ag];

        if ((gen.machine > 0) === buildAreaMachines) {
            // Enforce depth constraints
            if (ctx.depthLevel < gen.minDepth || ctx.depthLevel > gen.maxDepth) {
                continue;
            }

            // Decide how many to build
            let count = Math.min(
                Math.floor((gen.minNumberIntercept + ctx.depthLevel * gen.minNumberSlope) / 100),
                gen.maxNumber,
            );
            while (randPercent(gen.frequency) && count < gen.maxNumber) {
                count++;
            }

            // Build instances
            for (let i = 0; i < count; i++) {
                const foundationLoc = randomMatchingLocation(
                    ctx.pmap,
                    ctx.tileCatalog,
                    gen.requiredDungeonFoundationType,
                    gen.requiredLiquidFoundationType,
                    -1,
                );

                if (foundationLoc) {
                    // Spawn the DF
                    if (gen.DFType) {
                        spawnDungeonFeature(
                            ctx.pmap,
                            ctx.tileCatalog,
                            ctx.dungeonFeatureCatalog,
                            foundationLoc.x,
                            foundationLoc.y,
                            ctx.dungeonFeatureCatalog[gen.DFType],
                            false,
                            true,
                        );
                    }

                    // Spawn terrain
                    if (
                        gen.terrain
                        && ctx.tileCatalog[ctx.pmap[foundationLoc.x][foundationLoc.y].layers[gen.layer]].drawPriority
                            >= ctx.tileCatalog[gen.terrain].drawPriority
                    ) {
                        // Check connectivity
                        const grid = allocGrid();
                        fillGrid(grid, 0);
                        grid[foundationLoc.x][foundationLoc.y] = 1;
                        if (
                            !(ctx.tileCatalog[gen.terrain].flags & T_PATHING_BLOCKER)
                            || !levelIsDisconnectedWithBlockingMap(ctx.pmap, grid, false)
                        ) {
                            ctx.pmap[foundationLoc.x][foundationLoc.y].layers[gen.layer] = gen.terrain;
                        }
                        freeGrid(grid);
                    }
                }

                // Build machine if requested
                if (gen.machine > 0) {
                    buildAMachine(ctx, gen.machine, -1, -1, 0, null, null, null);
                }
            }
        }
    }
}

// Shorthand alias
const BP = BlueprintFlag;
const MB = MonsterBookkeepingFlag;
