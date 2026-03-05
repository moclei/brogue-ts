/*
 *  rooms.ts — Room design, door placement, and room attachment
 *  brogue-ts
 *
 *  All room shape generators, door site selection, hallway attachment,
 *  the random room dispatcher, room fitting, and room attachment logic.
 *
 *  Ported from: Architect.c lines 1951–2423
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, DungeonProfile } from "../types/types.js";
import { Direction } from "../types/enums.js";
import {
    DCOLS, DROWS, ROOM_TYPE_COUNT,
    HORIZONTAL_CORRIDOR_MIN_LENGTH, HORIZONTAL_CORRIDOR_MAX_LENGTH,
    VERTICAL_CORRIDOR_MIN_LENGTH, VERTICAL_CORRIDOR_MAX_LENGTH,
    CAVE_MIN_WIDTH, CAVE_MIN_HEIGHT,
} from "../types/constants.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import {
    allocGrid, freeGrid, fillGrid, copyGrid,
    drawRectangleOnGrid, drawCircleOnGrid,
    createBlobOnGrid, randomLocationInGrid,
    type Grid,
} from "../grid/grid.js";
import { randRange, randPercent, shuffleList, fillSequentialList, clamp } from "../math/rng.js";
import { oppositeDirection } from "./helpers.js";

// =============================================================================
// Room insertion (recursive flood fill from room to dungeon)
// =============================================================================

/**
 * Recursively copy a room from roomMap into dungeonMap at the given offset.
 * Only follows cardinal directions where roomMap is nonzero.
 *
 * C equivalent: `insertRoomAt(dungeonMap, roomMap, ...)` in Architect.c line 1951
 */
export function insertRoomAt(
    dungeonMap: Grid,
    roomMap: Grid,
    roomToDungeonX: number,
    roomToDungeonY: number,
    xRoom: number,
    yRoom: number,
): void {
    dungeonMap[xRoom + roomToDungeonX][yRoom + roomToDungeonY] = 1;

    for (let dir = 0; dir < 4; dir++) {
        const newX = xRoom + nbDirs[dir][0];
        const newY = yRoom + nbDirs[dir][1];
        if (
            coordinatesAreInMap(newX, newY)
            && roomMap[newX][newY]
            && coordinatesAreInMap(newX + roomToDungeonX, newY + roomToDungeonY)
            && dungeonMap[newX + roomToDungeonX][newY + roomToDungeonY] === 0
        ) {
            insertRoomAt(dungeonMap, roomMap, roomToDungeonX, roomToDungeonY, newX, newY);
        }
    }
}

// =============================================================================
// Room shape generators
// =============================================================================

/**
 * Design a cavern using cellular automata blob generation.
 *
 * C equivalent: `designCavern(grid, minWidth, maxWidth, minHeight, maxHeight)`
 * in Architect.c line 1971
 */
export function designCavern(
    grid: Grid,
    minWidth: number,
    maxWidth: number,
    minHeight: number,
    maxHeight: number,
): void {
    const blobGrid = allocGrid();

    fillGrid(grid, 0);
    const blob = createBlobOnGrid(
        blobGrid,
        5,          // roundCount
        minWidth, minHeight,
        maxWidth, maxHeight,
        55,         // percentSeeded
        "ffffffttt", // birthParameters
        "ffffttttt", // survivalParameters
    );

    // Position the cave in the center of the grid
    const destX = Math.floor((DCOLS - blob.width) / 2);
    const destY = Math.floor((DROWS - blob.height) / 2);

    // Find a flood-fill insertion point (first nonzero cell in blobGrid)
    // Note: replicates C's for-loop post-increment behavior where fillX/fillY
    // are one past the found cell when the loop exits.
    let fillX = 0;
    let fillY = 0;
    let foundFillPoint = false;
    for (fillX = 0; fillX < DCOLS && !foundFillPoint; fillX++) {
        for (fillY = 0; fillY < DROWS && !foundFillPoint; fillY++) {
            if (blobGrid[fillX][fillY]) {
                foundFillPoint = true;
            }
        }
    }
    // C for-loop semantics: fillX and fillY have been incremented once past
    // the found position due to post-increment in the for loop.
    // We replicate this for determinism.

    insertRoomAt(grid, blobGrid, destX - blob.minX, destY - blob.minY, fillX, fillY);
    freeGrid(blobGrid);
}

/**
 * Design the entrance room (the big upside-down T at the start of depth 1).
 *
 * C equivalent: `designEntranceRoom(grid)` in Architect.c line 2005
 */
export function designEntranceRoom(grid: Grid): void {
    fillGrid(grid, 0);

    const roomWidth = 8;
    const roomHeight = 10;
    const roomWidth2 = 20;
    const roomHeight2 = 5;
    const roomX = Math.floor(DCOLS / 2 - roomWidth / 2) - 1;
    const roomY = DROWS - roomHeight - 2;
    const roomX2 = Math.floor(DCOLS / 2 - roomWidth2 / 2) - 1;
    const roomY2 = DROWS - roomHeight2 - 2;

    drawRectangleOnGrid(grid, roomX, roomY, roomWidth, roomHeight, 1);
    drawRectangleOnGrid(grid, roomX2, roomY2, roomWidth2, roomHeight2, 1);
}

/**
 * Design a cross-shaped room (two overlapping rectangles).
 *
 * C equivalent: `designCrossRoom(grid)` in Architect.c line 2023
 */
export function designCrossRoom(grid: Grid): void {
    fillGrid(grid, 0);

    const roomWidth = randRange(3, 12);
    const roomX = randRange(
        Math.max(0, Math.floor(DCOLS / 2) - (roomWidth - 1)),
        Math.min(DCOLS, Math.floor(DCOLS / 2)),
    );
    const roomWidth2 = randRange(4, 20);
    const roomX2 = (roomX + Math.floor(roomWidth / 2) + randRange(0, 2) + randRange(0, 2) - 3)
        - Math.floor(roomWidth2 / 2);

    const roomHeight = randRange(3, 7);
    const roomY = Math.floor(DROWS / 2) - roomHeight;

    const roomHeight2 = randRange(2, 5);
    const roomY2 = Math.floor(DROWS / 2) - roomHeight2 - (randRange(0, 2) + randRange(0, 1));

    drawRectangleOnGrid(grid, roomX - 5, roomY + 5, roomWidth, roomHeight, 1);
    drawRectangleOnGrid(grid, roomX2 - 5, roomY2 + 5, roomWidth2, roomHeight2, 1);
}

/**
 * Design a symmetrical cross room.
 *
 * C equivalent: `designSymmetricalCrossRoom(grid)` in Architect.c line 2043
 */
export function designSymmetricalCrossRoom(grid: Grid): void {
    fillGrid(grid, 0);

    const majorWidth = randRange(4, 8);
    const majorHeight = randRange(4, 5);

    let minorWidth = randRange(3, 4);
    if (majorHeight % 2 === 0) {
        minorWidth -= 1;
    }
    let minorHeight = 3; // rand_range(2, 3) in C was hardcoded to 3
    if (majorWidth % 2 === 0) {
        minorHeight -= 1;
    }

    drawRectangleOnGrid(grid,
        Math.floor((DCOLS - majorWidth) / 2),
        Math.floor((DROWS - minorHeight) / 2),
        majorWidth, minorHeight, 1);
    drawRectangleOnGrid(grid,
        Math.floor((DCOLS - minorWidth) / 2),
        Math.floor((DROWS - majorHeight) / 2),
        minorWidth, majorHeight, 1);
}

/**
 * Design a small rectangular room.
 *
 * C equivalent: `designSmallRoom(grid)` in Architect.c line 2064
 */
export function designSmallRoom(grid: Grid): void {
    fillGrid(grid, 0);
    const width = randRange(3, 6);
    const height = randRange(2, 4);
    drawRectangleOnGrid(grid,
        Math.floor((DCOLS - width) / 2),
        Math.floor((DROWS - height) / 2),
        width, height, 1);
}

/**
 * Design a circular room, possibly with a hollow center.
 *
 * C equivalent: `designCircularRoom(grid)` in Architect.c line 2073
 */
export function designCircularRoom(grid: Grid): void {
    let radius: number;

    if (randPercent(5)) {
        radius = randRange(4, 10);
    } else {
        radius = randRange(2, 4);
    }

    fillGrid(grid, 0);
    drawCircleOnGrid(grid, Math.floor(DCOLS / 2), Math.floor(DROWS / 2), radius, 1);

    if (radius > 6 && randPercent(50)) {
        drawCircleOnGrid(grid, Math.floor(DCOLS / 2), Math.floor(DROWS / 2),
            randRange(3, radius - 3), 0);
    }
}

/**
 * Design a chunky room made of overlapping circles.
 *
 * C equivalent: `designChunkyRoom(grid)` in Architect.c line 2091
 */
export function designChunkyRoom(grid: Grid): void {
    const chunkCount = randRange(2, 8);

    fillGrid(grid, 0);
    drawCircleOnGrid(grid, Math.floor(DCOLS / 2), Math.floor(DROWS / 2), 2, 1);

    let minX = Math.floor(DCOLS / 2) - 3;
    let maxX = Math.floor(DCOLS / 2) + 3;
    let minY = Math.floor(DROWS / 2) - 3;
    let maxY = Math.floor(DROWS / 2) + 3;

    for (let i = 0; i < chunkCount;) {
        const x = randRange(minX, maxX);
        const y = randRange(minY, maxY);
        if (grid[x][y]) {
            drawCircleOnGrid(grid, x, y, 2, 1);
            i++;
            minX = Math.max(1, Math.min(x - 3, minX));
            maxX = Math.min(DCOLS - 2, Math.max(x + 3, maxX));
            minY = Math.max(1, Math.min(y - 3, minY));
            maxY = Math.min(DROWS - 2, Math.max(y + 3, maxY));
        }
    }
}

// =============================================================================
// Door site selection
// =============================================================================

/**
 * If the indicated tile is a wall on the room stored in grid, and it could
 * be the site of a door out of that room, return the outbound direction.
 * Otherwise, return NoDirection.
 *
 * C equivalent: `directionOfDoorSite(grid, x, y)` in Architect.c line 2126
 */
export function directionOfDoorSite(grid: Grid, x: number, y: number): Direction {
    if (grid[x][y]) {
        // Already occupied
        return Direction.NoDirection;
    }

    let solutionDir = Direction.NoDirection;
    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        const oppX = x - nbDirs[dir][0];
        const oppY = y - nbDirs[dir][1];

        if (
            coordinatesAreInMap(oppX, oppY)
            && coordinatesAreInMap(newX, newY)
            && grid[oppX][oppY] === 1
        ) {
            if (solutionDir !== Direction.NoDirection) {
                // Already claimed by another direction; no doors here
                return Direction.NoDirection;
            }
            solutionDir = dir as Direction;
        }
    }
    return solutionDir;
}

/**
 * Choose random door sites from a room map, one per cardinal direction.
 *
 * Each door site is a cell adjacent to the room that could serve as a door,
 * with an outward ray that doesn't re-intersect the room.
 *
 * C equivalent: `chooseRandomDoorSites(roomMap, doorSites)` in Architect.c line 2155
 *
 * @param roomMap The room grid (1 = room interior, 0 = exterior)
 * @returns Array of 4 Pos values (one per direction: Up, Down, Left, Right),
 *   with {x: -1, y: -1} for directions where no door site was found.
 */
export function chooseRandomDoorSites(roomMap: Grid): Pos[] {
    const grid = allocGrid();
    copyGrid(grid, roomMap);

    // Find valid door sites and mark them with dir + 2
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (!grid[i][j]) {
                const dir = directionOfDoorSite(roomMap, i, j);
                if (dir !== Direction.NoDirection) {
                    // Trace a ray 10 spaces outward to ensure it doesn't re-intersect the room
                    let newX = i + nbDirs[dir][0];
                    let newY = j + nbDirs[dir][1];
                    let doorSiteFailed = false;
                    for (let k = 0; k < 10 && coordinatesAreInMap(newX, newY) && !doorSiteFailed; k++) {
                        if (grid[newX][newY]) {
                            doorSiteFailed = true;
                        }
                        newX += nbDirs[dir][0];
                        newY += nbDirs[dir][1];
                    }
                    if (!doorSiteFailed) {
                        grid[i][j] = dir + 2; // +2 to avoid conflict with 0 (exterior) and 1 (interior)
                    }
                }
            }
        }
    }

    // Pick one door per direction
    const doorSites: Pos[] = [];
    for (let dir = 0; dir < 4; dir++) {
        doorSites[dir] = randomLocationInGrid(grid, dir + 2);
    }

    freeGrid(grid);
    return doorSites;
}

// =============================================================================
// Hallway attachment
// =============================================================================

/**
 * Attach a hallway to a room at one of its door sites, then update
 * the door sites to radiate from the hallway end.
 *
 * C equivalent: `attachHallwayTo(grid, doorSites)` in Architect.c line 2205
 *
 * @param grid The room grid to draw the hallway on
 * @param doorSites Mutable array of door positions (modified in place)
 */
export function attachHallwayTo(grid: Grid, doorSites: Pos[]): void {
    // Pick a direction
    const dirs = new Array(4);
    fillSequentialList(dirs);
    shuffleList(dirs);

    let dir = Direction.NoDirection;
    let i: number;
    for (i = 0; i < 4; i++) {
        dir = dirs[i] as Direction;
        if (
            doorSites[dir].x !== -1
            && doorSites[dir].y !== -1
            && coordinatesAreInMap(
                doorSites[dir].x + nbDirs[dir][0] * HORIZONTAL_CORRIDOR_MAX_LENGTH,
                doorSites[dir].y + nbDirs[dir][1] * VERTICAL_CORRIDOR_MAX_LENGTH,
            )
        ) {
            break; // That's our direction
        }
    }
    if (i === 4) {
        return; // No valid direction for hallways
    }

    let length: number;
    if (dir === Direction.Up || dir === Direction.Down) {
        length = randRange(VERTICAL_CORRIDOR_MIN_LENGTH, VERTICAL_CORRIDOR_MAX_LENGTH);
    } else {
        length = randRange(HORIZONTAL_CORRIDOR_MIN_LENGTH, HORIZONTAL_CORRIDOR_MAX_LENGTH);
    }

    let x = doorSites[dir].x;
    let y = doorSites[dir].y;
    for (let step = 0; step < length; step++) {
        if (coordinatesAreInMap(x, y)) {
            grid[x][y] = 1;
        }
        x += nbDirs[dir][0];
        y += nbDirs[dir][1];
    }

    // Back up to the last interior cell
    x = clamp(x - nbDirs[dir][0], 0, DCOLS - 1);
    y = clamp(y - nbDirs[dir][1], 0, DROWS - 1);

    const allowObliqueHallwayExit = randPercent(15);
    for (let dir2 = 0; dir2 < 4; dir2++) {
        const newX = x + nbDirs[dir2][0];
        const newY = y + nbDirs[dir2][1];

        if (
            (dir2 !== dir && !allowObliqueHallwayExit)
            || !coordinatesAreInMap(newX, newY)
            || grid[newX][newY]
        ) {
            doorSites[dir2] = { x: -1, y: -1 };
        } else {
            doorSites[dir2] = { x: newX, y: newY };
        }
    }
}

// =============================================================================
// Random room dispatcher
// =============================================================================

/**
 * Generate a random room shape on the grid based on weighted type frequencies.
 *
 * Room type indices:
 *   0 = Cross room
 *   1 = Small symmetrical cross room
 *   2 = Small room
 *   3 = Circular room
 *   4 = Chunky room
 *   5 = Cave (small/medium variants)
 *   6 = Cavern (fills a level)
 *   7 = Entrance room (depth 1)
 *
 * C equivalent: `designRandomRoom(grid, attachHallway, doorSites, roomTypeFrequencies)`
 * in Architect.c line 2274
 *
 * @param grid The grid to draw the room on
 * @param shouldAttachHallway Whether to add a hallway from one door site
 * @param roomTypeFrequencies Array of 8 weights for each room type
 * @returns Array of 4 door site positions (or null if doorSites not needed)
 */
export function designRandomRoom(
    grid: Grid,
    shouldAttachHallway: boolean,
    roomTypeFrequencies: number[],
): Pos[] | null {
    // Weighted random selection
    let sum = 0;
    for (let i = 0; i < ROOM_TYPE_COUNT; i++) {
        sum += roomTypeFrequencies[i];
    }
    let randIndex = randRange(0, sum - 1);
    let roomType = 0;
    for (roomType = 0; roomType < ROOM_TYPE_COUNT; roomType++) {
        if (randIndex < roomTypeFrequencies[roomType]) {
            break;
        }
        randIndex -= roomTypeFrequencies[roomType];
    }

    switch (roomType) {
        case 0:
            designCrossRoom(grid);
            break;
        case 1:
            designSymmetricalCrossRoom(grid);
            break;
        case 2:
            designSmallRoom(grid);
            break;
        case 3:
            designCircularRoom(grid);
            break;
        case 4:
            designChunkyRoom(grid);
            break;
        case 5:
            switch (randRange(0, 2)) {
                case 0:
                    designCavern(grid, 3, 12, 4, 8);      // Compact cave room
                    break;
                case 1:
                    designCavern(grid, 3, 12, 15, DROWS - 2); // Large north-south cave
                    break;
                case 2:
                    designCavern(grid, 20, DROWS - 2, 4, 8); // Large east-west cave
                    break;
            }
            break;
        case 6:
            designCavern(grid, CAVE_MIN_WIDTH, DCOLS - 2, CAVE_MIN_HEIGHT, DROWS - 2);
            break;
        case 7:
            designEntranceRoom(grid);
            break;
    }

    // Choose door sites
    const doorSites = chooseRandomDoorSites(grid);

    if (shouldAttachHallway) {
        let dir = randRange(0, 3);
        for (let attempt = 0; doorSites[dir].x === -1 && attempt < 3; attempt++) {
            dir = (dir + 1) % 4;
        }
        attachHallwayTo(grid, doorSites);
    }

    return doorSites;
}

// =============================================================================
// Room fitting
// =============================================================================

/**
 * Check whether a room (in hyperspace/roomMap) fits at the given offset
 * in the dungeon. A room fits if every cell of the room, and every cell
 * adjacent to it, is empty (0) or outside the map.
 *
 * C equivalent: `roomFitsAt(dungeonMap, roomMap, x, y)` in Architect.c line 2344
 */
export function roomFitsAt(
    dungeonMap: Grid,
    roomMap: Grid,
    roomToDungeonX: number,
    roomToDungeonY: number,
): boolean {
    for (let xRoom = 0; xRoom < DCOLS; xRoom++) {
        for (let yRoom = 0; yRoom < DROWS; yRoom++) {
            if (roomMap[xRoom][yRoom]) {
                const xDungeon = xRoom + roomToDungeonX;
                const yDungeon = yRoom + roomToDungeonY;

                for (let i = xDungeon - 1; i <= xDungeon + 1; i++) {
                    for (let j = yDungeon - 1; j <= yDungeon + 1; j++) {
                        if (!coordinatesAreInMap(i, j) || dungeonMap[i][j] > 0) {
                            return false;
                        }
                    }
                }
            }
        }
    }
    return true;
}

// =============================================================================
// Room attachment (the main room-building loop)
// =============================================================================

/**
 * Attach multiple rooms and hallways to a dungeon grid.
 *
 * On the grid: 0 = granite, 1 = floor, 2 = possible door site,
 * -1 = off-limits (can't place rooms there or grow from there).
 *
 * C equivalent: `attachRooms(grid, theDP, attempts, maxRoomCount)`
 * in Architect.c line 2367
 */
export function attachRooms(
    grid: Grid,
    theDP: DungeonProfile,
    attempts: number,
    maxRoomCount: number,
): void {
    // Create a shuffled scan order for the dungeon grid
    const sCoord = new Array(DCOLS * DROWS);
    fillSequentialList(sCoord);
    shuffleList(sCoord);

    const roomMap = allocGrid();

    let roomsBuilt = 0;
    let roomsAttempted = 0;
    while (roomsBuilt < maxRoomCount && roomsAttempted < attempts) {
        // Build a room in hyperspace
        fillGrid(roomMap, 0);
        const doorSites = designRandomRoom(
            roomMap,
            roomsAttempted <= attempts - 5 && randPercent(theDP.corridorChance),
            theDP.roomFrequencies,
        );

        if (!doorSites) {
            roomsAttempted++;
            continue;
        }

        // Slide hyperspace across real space in shuffled order
        for (let i = 0; i < DCOLS * DROWS; i++) {
            const x = Math.floor(sCoord[i] / DROWS);
            const y = sCoord[i] % DROWS;

            const dir = directionOfDoorSite(grid, x, y);
            const oppDir = oppositeDirection(dir);
            if (
                dir !== Direction.NoDirection
                && oppDir !== Direction.NoDirection
                && doorSites[oppDir].x !== -1
                && roomFitsAt(grid, roomMap,
                    x - doorSites[oppDir].x,
                    y - doorSites[oppDir].y)
            ) {
                // Room fits here
                insertRoomAt(grid, roomMap,
                    x - doorSites[oppDir].x,
                    y - doorSites[oppDir].y,
                    doorSites[oppDir].x,
                    doorSites[oppDir].y);
                grid[x][y] = 2; // Door site
                roomsBuilt++;
                break;
            }
        }

        roomsAttempted++;
    }

    freeGrid(roomMap);
}
