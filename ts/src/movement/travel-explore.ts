/*
 *  travel-explore.ts — Travel, exploration, auto-play, and pathfinding step logic
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: nextStep, displayRoute, travelRoute, travelMap, travel,
 *             getExploreMap, explore, autoPlayLevel, startFighting,
 *             adjacentFightingDir, proposeOrConfirmLocation, useStairs
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Pcell, Item, Color, RogueEvent } from "../types/types.js";
import { Direction, StatusEffect, GameMode } from "../types/enums.js";
import {
    TileFlag, TerrainFlag,
    MonsterBehaviorFlag, MonsterBookkeepingFlag, ItemFlag,
    T_PATHING_BLOCKER,
} from "../types/flags.js";
import { DCOLS, DROWS, PDS_FORBIDDEN, PDS_OBSTRUCTION, KEYBOARD_LABELS } from "../types/constants.js";

// =============================================================================
// Constants
// =============================================================================

const DIRECTION_COUNT = 8;
const NO_DIRECTION: Direction = -1 as Direction;

// =============================================================================
// Context
// =============================================================================

/**
 * Context for travel and exploration functions.
 * Uses DI to avoid global state.
 */
export interface TravelExploreContext {
    /** Permanent map cells (column-major). */
    pmap: Pcell[][];
    /** The player creature. */
    player: Creature;
    /** Rogue game state. */
    rogue: {
        disturbed: boolean;
        automationActive: boolean;
        autoPlayingLevel: boolean;
        gameHasEnded: boolean;
        blockCombatText: boolean;
        playbackMode: boolean;
        cursorLoc: Pos;
        upLoc: Pos;
        downLoc: Pos;
        depthLevel: number;
        deepestLevel: number;
        mode: GameMode;
    };
    /** Monster list. */
    monsters: Creature[];
    /** Direction table: [dx, dy] for 8 compass directions. */
    nbDirs: readonly [number, number][];
    /** Game constants. */
    gameConst: { deepestLevel: number };
    /** Tile catalog for terrain data. */
    tileCatalog: readonly { flags: number; mechFlags: number; discoverType: number }[];

    // --- Map helpers ---
    coordinatesAreInMap(x: number, y: number): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, limitToPlayerKnowledge: boolean): boolean;
    monsterAvoids(monst: Creature, p: Pos): boolean;

    // --- Creature helpers ---
    monsterAtLoc(loc: Pos): Creature | null;
    canSeeMonster(monst: Creature): boolean;
    canPass(monst: Creature, blocker: Creature): boolean;
    monstersAreTeammates(monst1: Creature, monst2: Creature): boolean;
    monstersAreEnemies(monst1: Creature, monst2: Creature): boolean;
    monsterDamageAdjustmentAmount(monst: Creature): number;

    // --- Player movement ---
    playerMoves(direction: Direction): boolean;

    // --- Distance/pathfinding ---
    allocGrid(): number[][];
    freeGrid(grid: number[][]): void;
    calculateDistances(
        distanceMap: number[][],
        destX: number,
        destY: number,
        blockingTerrainFlags: number,
        traveler: Creature | null,
        canUseSecretDoors: boolean,
        eightWays: boolean,
    ): void;
    dijkstraScan(distanceMap: number[][], costMap: number[][], allowDiagonals: boolean): void;
    populateCreatureCostMap(costMap: number[][], monst: Creature): void;

    // --- Known-terrain helpers ---
    knownToPlayerAsPassableOrSecretDoor(pos: Pos): boolean;

    // --- Item helpers ---
    itemAtLoc(loc: Pos): Item | null;
    numberOfMatchingPackItems(category: number, requiredFlags: number, forbiddenFlags: number, isBlessed: boolean): number;

    // --- UI helpers ---
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Color | null, flags: number): void;
    confirmMessages(): void;
    hiliteCell(x: number, y: number, color: Color, strength: number, saveBuf: boolean): void;
    refreshDungeonCell(loc: Pos): void;
    refreshSideBar(x: number, y: number, focusedOnMonster: boolean): void;
    updateFlavorText(): void;
    clearCursorPath(): void;
    hilitePath(path: Pos[], steps: number, removeHighlight: boolean): void;
    getPlayerPathOnMap(path: Pos[], distanceMap: number[][], playerLoc: Pos): number;
    commitDraws(): void;
    pauseAnimation(duration: number, behavior: number): boolean;
    recordMouseClick(x: number, y: number, shift: boolean, alt: boolean): void;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    windowToMapX(wx: number): number;
    windowToMapY(wy: number): number;
    updatePlayerUnderwaterness(): void;
    updateVision(refreshDisplay: boolean): void;
    nextBrogueEvent(event: RogueEvent, textInput: boolean, colorsDance: boolean, realInputOnly: boolean): void;
    executeMouseClick(event: RogueEvent): void;
    printString(str: string, x: number, y: number, fg: Color, bg: Color, charGrid: null): void;
    hiliteColor: Color;
    white: Color;
    black: Color;
    lightBlue: Color;
    backgroundMessageColor: Color;

    // --- Level transitions ---
    startLevel(previousDepth: number, stairDirection: number): void;
    victory(isDescending: boolean): void;

    // --- FP math ---
    fpFactor: number;

    // --- AMULET constant ---
    AMULET: number;

    // --- debug flag ---
    D_WORMHOLING: boolean;

    // --- Pos helpers ---
    posEq(a: Pos, b: Pos): boolean;
    INVALID_POS: Pos;

    // --- Constants ---
    ASCEND_KEY: number;
    DESCEND_KEY: number;
    RETURN_KEY: number;
}

// =============================================================================
// nextStep — from Movement.c:1490
// =============================================================================

/**
 * Given a distance map and a target position, finds the best direction
 * to step from `target` that descends the distance gradient most steeply.
 *
 * C: short nextStep(short **distanceMap, pos target, creature *monst, boolean preferDiagonals)
 */
export function nextStep(
    distanceMap: number[][],
    target: Pos,
    monst: Creature | null,
    preferDiagonals: boolean,
    ctx: TravelExploreContext,
): Direction {
    let bestScore = 0;
    let bestDir: Direction = NO_DIRECTION;

    for (
        let dir = preferDiagonals ? 7 : 0;
        preferDiagonals ? dir >= 0 : dir < DIRECTION_COUNT;
        preferDiagonals ? dir-- : dir++
    ) {
        const newX = target.x + ctx.nbDirs[dir][0];
        const newY = target.y + ctx.nbDirs[dir][1];

        if (ctx.coordinatesAreInMap(newX, newY)) {
            let blocked = false;
            const blocker = ctx.monsterAtLoc({ x: newX, y: newY });

            if (monst && ctx.monsterAvoids(monst, { x: newX, y: newY })) {
                blocked = true;
            } else if (
                monst &&
                blocker &&
                !ctx.canPass(monst, blocker) &&
                !ctx.monstersAreTeammates(monst, blocker) &&
                !ctx.monstersAreEnemies(monst, blocker)
            ) {
                blocked = true;
            }

            const score = distanceMap[target.x][target.y] - distanceMap[newX][newY];
            if (
                score > bestScore &&
                !ctx.diagonalBlocked(target.x, target.y, newX, newY, monst === ctx.player) &&
                ctx.knownToPlayerAsPassableOrSecretDoor({ x: newX, y: newY }) &&
                !blocked
            ) {
                bestDir = dir as Direction;
                bestScore = score;
            }
        }
    }

    return bestDir;
}

// =============================================================================
// displayRoute — from Movement.c:1536
// =============================================================================

/**
 * Displays or removes the travel route highlighting on the map.
 *
 * C: static void displayRoute(short **distanceMap, boolean removeRoute)
 */
export function displayRoute(
    distanceMap: number[][],
    removeRoute: boolean,
    ctx: TravelExploreContext,
): void {
    let currentX = ctx.player.loc.x;
    let currentY = ctx.player.loc.y;

    if (distanceMap[currentX][currentY] < 0 || distanceMap[currentX][currentY] === 30000) {
        return;
    }

    let advanced: boolean;
    do {
        if (removeRoute) {
            ctx.refreshDungeonCell({ x: currentX, y: currentY });
        } else {
            ctx.hiliteCell(currentX, currentY, ctx.hiliteColor, 50, true);
        }
        advanced = false;
        for (let dir = 7; dir >= 0; dir--) {
            const newX = currentX + ctx.nbDirs[dir][0];
            const newY = currentY + ctx.nbDirs[dir][1];
            if (
                ctx.coordinatesAreInMap(newX, newY) &&
                distanceMap[newX][newY] >= 0 &&
                distanceMap[newX][newY] < distanceMap[currentX][currentY] &&
                !ctx.diagonalBlocked(currentX, currentY, newX, newY, true)
            ) {
                currentX = newX;
                currentY = newY;
                advanced = true;
                break;
            }
        }
    } while (advanced);
}

// =============================================================================
// travelRoute — from Movement.c:1566
// =============================================================================

/**
 * Follows a pre-computed path, moving the player step by step.
 *
 * C: void travelRoute(pos path[1000], short steps)
 */
export function travelRoute(
    path: Pos[],
    steps: number,
    ctx: TravelExploreContext,
): void {
    ctx.rogue.disturbed = false;
    ctx.rogue.automationActive = true;

    // Mark currently visible monsters as already seen
    for (const monst of ctx.monsters) {
        if (ctx.canSeeMonster(monst)) {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_ALREADY_SEEN;
        } else {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_ALREADY_SEEN;
        }
    }

    for (let i = 0; i < steps && !ctx.rogue.disturbed; i++) {
        // Check future path for obstructions
        for (let j = i + 1; j < steps - 1; j++) {
            if (
                ctx.diagonalBlocked(path[j - 1].x, path[j - 1].y, path[j].x, path[j].y, true) ||
                ctx.monsterAvoids(ctx.player, path[j])
            ) {
                ctx.rogue.disturbed = true;
                break;
            }
        }

        // Try to move in the direction that leads to path[i]
        for (let dir = 0; dir < DIRECTION_COUNT && !ctx.rogue.disturbed; dir++) {
            const neighborX = ctx.player.loc.x + ctx.nbDirs[dir][0];
            const neighborY = ctx.player.loc.y + ctx.nbDirs[dir][1];
            if (neighborX === path[i].x && neighborY === path[i].y) {
                if (!ctx.playerMoves(dir as Direction)) {
                    ctx.rogue.disturbed = true;
                }
                if (ctx.pauseAnimation(25, 0 /* PAUSE_BEHAVIOR_DEFAULT */)) {
                    ctx.rogue.disturbed = true;
                }
                break;
            }
        }
    }

    ctx.rogue.disturbed = true;
    ctx.rogue.automationActive = false;
    ctx.updateFlavorText();
}

// =============================================================================
// travelMap — from Movement.c:1611
// =============================================================================

/**
 * Moves the player along a distance map, stepping downhill each turn.
 *
 * C: static void travelMap(short **distanceMap)
 */
export function travelMap(
    distanceMap: number[][],
    ctx: TravelExploreContext,
): void {
    let currentX = ctx.player.loc.x;
    let currentY = ctx.player.loc.y;

    ctx.rogue.disturbed = false;
    ctx.rogue.automationActive = true;

    if (distanceMap[currentX][currentY] < 0 || distanceMap[currentX][currentY] === 30000) {
        return;
    }

    let advanced: boolean;
    do {
        advanced = false;
        for (let dir = 7; dir >= 0; dir--) {
            const newX = currentX + ctx.nbDirs[dir][0];
            const newY = currentY + ctx.nbDirs[dir][1];
            if (
                ctx.coordinatesAreInMap(newX, newY) &&
                distanceMap[newX][newY] >= 0 &&
                distanceMap[newX][newY] < distanceMap[currentX][currentY] &&
                !ctx.diagonalBlocked(currentX, currentY, newX, newY, true)
            ) {
                if (!ctx.playerMoves(dir as Direction)) {
                    ctx.rogue.disturbed = true;
                }
                if (ctx.pauseAnimation(500, 0 /* PAUSE_BEHAVIOR_DEFAULT */)) {
                    ctx.rogue.disturbed = true;
                }
                currentX = newX;
                currentY = newY;
                advanced = true;
                break;
            }
        }
    } while (advanced && !ctx.rogue.disturbed);

    ctx.rogue.disturbed = true;
    ctx.rogue.automationActive = false;
    ctx.updateFlavorText();
}

// =============================================================================
// travel — from Movement.c:1649
// =============================================================================

/**
 * Main travel function: moves the player toward a target location.
 * If autoConfirm is false, asks the player for confirmation.
 *
 * C: void travel(pos target, boolean autoConfirm)
 */
export function travel(
    target: Pos,
    autoConfirm: boolean,
    ctx: TravelExploreContext,
): void {
    ctx.confirmMessages();

    if (ctx.D_WORMHOLING) {
        ctx.recordMouseClick(ctx.mapToWindowX(target.x), ctx.mapToWindowY(target.y), true, false);
        ctx.pmap[ctx.player.loc.x][ctx.player.loc.y].flags &= ~TileFlag.HAS_PLAYER;
        ctx.refreshDungeonCell(ctx.player.loc);
        ctx.player.loc = target;
        ctx.pmap[target.x][target.y].flags |= TileFlag.HAS_PLAYER;
        ctx.updatePlayerUnderwaterness();
        ctx.refreshDungeonCell(target);
        ctx.updateVision(true);
        return;
    }

    // If targeting a cardinal neighbor, just move there directly
    if (Math.abs(ctx.player.loc.x - target.x) + Math.abs(ctx.player.loc.y - target.y) === 1) {
        for (let i = 0; i < 4; i++) {
            if (
                ctx.nbDirs[i][0] === target.x - ctx.player.loc.x &&
                ctx.nbDirs[i][1] === target.y - ctx.player.loc.y
            ) {
                ctx.playerMoves(i as Direction);
                break;
            }
        }
        return;
    }

    if (!(ctx.pmap[target.x][target.y].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))) {
        ctx.message("You have not explored that location.", 0);
        return;
    }

    const distanceMap = ctx.allocGrid();
    ctx.calculateDistances(distanceMap, target.x, target.y, 0, ctx.player, false, false);

    if (distanceMap[ctx.player.loc.x][ctx.player.loc.y] < 30000) {
        if (autoConfirm) {
            travelMap(distanceMap, ctx);
        } else {
            let staircaseConfirmKey = 0;
            if (ctx.posEq(ctx.rogue.upLoc, target)) {
                staircaseConfirmKey = ctx.ASCEND_KEY;
            } else if (ctx.posEq(ctx.rogue.downLoc, target)) {
                staircaseConfirmKey = ctx.DESCEND_KEY;
            }

            displayRoute(distanceMap, false, ctx);
            ctx.message("Travel this route? (y/n)", 0);

            const theEvent: RogueEvent = {
                eventType: 0,
                param1: 0,
                param2: 0,
                controlKey: false,
                shiftKey: false,
            };
            do {
                ctx.nextBrogueEvent(theEvent, true, false, false);
            } while (theEvent.eventType !== 2 /* MOUSE_UP */ && theEvent.eventType !== 0 /* KEYSTROKE */);

            displayRoute(distanceMap, true, ctx); // clear route display
            ctx.confirmMessages();

            if (
                (theEvent.eventType === 2 /* MOUSE_UP */ &&
                    ctx.windowToMapX(theEvent.param1) === target.x &&
                    ctx.windowToMapY(theEvent.param2) === target.y) ||
                (theEvent.eventType === 0 /* KEYSTROKE */ &&
                    (theEvent.param1 === 89 /* 'Y' */ ||
                        theEvent.param1 === 121 /* 'y' */ ||
                        theEvent.param1 === ctx.RETURN_KEY ||
                        (theEvent.param1 === staircaseConfirmKey && theEvent.param1 !== 0)))
            ) {
                travelMap(distanceMap, ctx);
                ctx.commitDraws();
            } else if (theEvent.eventType === 2 /* MOUSE_UP */) {
                ctx.executeMouseClick(theEvent);
            }
        }
    } else {
        ctx.rogue.cursorLoc = ctx.INVALID_POS;
        ctx.message("No path is available.", 0);
    }

    ctx.freeGrid(distanceMap);
}

// =============================================================================
// exploreGoalValue — from Movement.c:1891
// =============================================================================

/**
 * Heuristic value for exploration: prefers cells near the center.
 *
 * C: #define exploreGoalValue(x, y)  (0 - abs((x) - DCOLS / 2) / 3 - abs((x) - DCOLS / 2) / 4)
 */
function exploreGoalValue(x: number): number {
    return 0 - Math.floor(Math.abs(x - DCOLS / 2) / 3) - Math.floor(Math.abs(x - DCOLS / 2) / 4);
}

// =============================================================================
// getExploreMap — from Movement.c:1893
// =============================================================================

/**
 * Builds a distance map for exploration. Undiscovered cells and
 * items on the ground become goal values; the map is then run
 * through Dijkstra to produce distances.
 *
 * C: void getExploreMap(short **map, boolean headingToStairs)
 */
export function getExploreMap(
    map: number[][],
    headingToStairs: boolean,
    ctx: TravelExploreContext,
): void {
    const costMap = ctx.allocGrid();
    ctx.populateCreatureCostMap(costMap, ctx.player);

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            map[i][j] = 30000; // Can be overridden later.
            const theItem = ctx.itemAtLoc({ x: i, y: j });

            if (!(ctx.pmap[i][j].flags & TileFlag.DISCOVERED)) {
                if (
                    (ctx.pmap[i][j].flags & TileFlag.MAGIC_MAPPED) &&
                    (ctx.tileCatalog[ctx.pmap[i][j].layers[0 /* DUNGEON */]].flags |
                        ctx.tileCatalog[ctx.pmap[i][j].layers[1 /* LIQUID */]].flags) &
                        T_PATHING_BLOCKER
                ) {
                    // Magic-mapped cells revealed as obstructions
                    costMap[i][j] = ctx.cellHasTerrainFlag(
                        { x: i, y: j },
                        TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT,
                    )
                        ? PDS_OBSTRUCTION
                        : PDS_FORBIDDEN;
                } else {
                    costMap[i][j] = 1;
                    map[i][j] = exploreGoalValue(i);
                }
            } else if (theItem && !ctx.monsterAvoids(ctx.player, { x: i, y: j })) {
                if (theItem.flags & ItemFlag.ITEM_PLAYER_AVOIDS) {
                    costMap[i][j] = 20;
                } else {
                    costMap[i][j] = 1;
                    map[i][j] = exploreGoalValue(i) - 10;
                }
            }
        }
    }

    costMap[ctx.rogue.downLoc.x][ctx.rogue.downLoc.y] = 100;
    costMap[ctx.rogue.upLoc.x][ctx.rogue.upLoc.y] = 100;

    if (headingToStairs) {
        map[ctx.rogue.downLoc.x][ctx.rogue.downLoc.y] = 0; // head to stairs
    }

    ctx.dijkstraScan(map, costMap, true);
    ctx.freeGrid(costMap);
}

// =============================================================================
// adjacentFightingDir — from Movement.c:1872
// =============================================================================

/**
 * Returns the direction of an adjacent enemy that the player can fight,
 * or NO_DIRECTION if none.
 *
 * C: enum directions adjacentFightingDir()
 */
export function adjacentFightingDir(ctx: TravelExploreContext): Direction {
    if (ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        return NO_DIRECTION;
    }

    for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
        const newX = ctx.player.loc.x + ctx.nbDirs[dir][0];
        const newY = ctx.player.loc.y + ctx.nbDirs[dir][1];
        const monst = ctx.monsterAtLoc({ x: newX, y: newY });
        if (
            monst &&
            ctx.canSeeMonster(monst) &&
            (!ctx.diagonalBlocked(ctx.player.loc.x, ctx.player.loc.y, newX, newY, false) ||
                !!(monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)) &&
            ctx.monstersAreEnemies(ctx.player, monst) &&
            !(monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE))
        ) {
            return dir as Direction;
        }
    }

    return NO_DIRECTION;
}

// =============================================================================
// startFighting — from Movement.c:2065
// =============================================================================

/**
 * Starts fighting an adjacent monster, continuing until the player
 * is disturbed, the game ends, or damage threshold is reached.
 *
 * C: boolean startFighting(enum directions dir, boolean tillDeath)
 */
export function startFighting(
    dir: Direction,
    tillDeath: boolean,
    ctx: TravelExploreContext,
): boolean {
    const neighborX = ctx.player.loc.x + ctx.nbDirs[dir][0];
    const neighborY = ctx.player.loc.y + ctx.nbDirs[dir][1];
    const neighborLoc: Pos = { x: neighborX, y: neighborY };
    const monst = ctx.monsterAtLoc(neighborLoc);

    if (!monst) return false;
    if (monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        return false;
    }

    let expectedDamage = Math.floor(
        (monst.info.damage.upperBound * ctx.monsterDamageAdjustmentAmount(monst)) / ctx.fpFactor,
    );
    if (ctx.rogue.mode === GameMode.Easy) {
        expectedDamage = Math.floor(expectedDamage / 5);
    }

    ctx.rogue.blockCombatText = true;
    ctx.rogue.disturbed = false;

    do {
        if (!ctx.playerMoves(dir)) {
            break;
        }
        if (ctx.pauseAnimation(1, 0 /* PAUSE_BEHAVIOR_DEFAULT */)) {
            break;
        }
    } while (
        !ctx.rogue.disturbed &&
        !ctx.rogue.gameHasEnded &&
        (tillDeath || ctx.player.currentHP > expectedDamage) &&
        !!(ctx.pmap[neighborX][neighborY].flags & TileFlag.HAS_MONSTER) &&
        ctx.monsterAtLoc(neighborLoc) === monst
    );

    ctx.rogue.blockCombatText = false;
    return ctx.rogue.disturbed;
}

// =============================================================================
// explore — from Movement.c:1939
// =============================================================================

/**
 * Main exploration loop: the player automatically explores the level,
 * fighting adjacent enemies as they appear.
 *
 * C: boolean explore(short frameDelay)
 */
export function explore(
    frameDelay: number,
    ctx: TravelExploreContext,
): boolean {
    ctx.clearCursorPath();

    let madeProgress = false;
    let headingToStairs = false;

    if (ctx.player.status[StatusEffect.Confused]) {
        ctx.message("Not while you're confused.", 0);
        return false;
    }
    if (ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        ctx.message("Not while you're trapped.", 0);
        return false;
    }

    // Mark currently visible monsters as already seen
    for (const monst of ctx.monsters) {
        if (ctx.canSeeMonster(monst)) {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_ALREADY_SEEN;
        } else {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_ALREADY_SEEN;
        }
    }

    // Fight any adjacent enemies
    let dir: Direction = adjacentFightingDir(ctx);
    if (
        dir !== NO_DIRECTION &&
        startFighting(dir, ctx.player.status[StatusEffect.Hallucinating] ? true : false, ctx)
    ) {
        return true;
    }

    if (!ctx.rogue.autoPlayingLevel) {
        const exploreMsg = KEYBOARD_LABELS
            ? "Exploring... press any key to stop."
            : "Exploring... touch anywhere to stop.";
        ctx.message(exploreMsg, 0);
        ctx.confirmMessages();
        ctx.printString(exploreMsg, ctx.mapToWindowX(0), ctx.mapToWindowY(-1), ctx.white, ctx.black, null);
    }

    ctx.rogue.disturbed = false;
    ctx.rogue.automationActive = true;

    const distanceMap = ctx.allocGrid();
    do {
        // Fight any adjacent enemies
        dir = adjacentFightingDir(ctx);
        if (dir !== NO_DIRECTION) {
            startFighting(dir, ctx.player.status[StatusEffect.Hallucinating] ? true : false, ctx);
            if (ctx.rogue.disturbed) {
                madeProgress = true;
                continue;
            }
        }
        if (ctx.rogue.disturbed) {
            continue;
        }

        getExploreMap(distanceMap, headingToStairs, ctx);

        // Hilite path
        const path: Pos[] = new Array(1000).fill(null).map(() => ({ x: 0, y: 0 }));
        const steps = ctx.getPlayerPathOnMap(path, distanceMap, ctx.player.loc);
        ctx.hilitePath(path, steps, false);

        // Take a step
        dir = nextStep(distanceMap, ctx.player.loc, null, false, ctx);

        if (!headingToStairs && ctx.rogue.autoPlayingLevel && dir === NO_DIRECTION) {
            headingToStairs = true;
            continue;
        }

        ctx.refreshSideBar(-1, -1, false);

        if (dir === NO_DIRECTION) {
            ctx.rogue.disturbed = true;
        } else if (!ctx.playerMoves(dir)) {
            ctx.rogue.disturbed = true;
        } else {
            madeProgress = true;
            if (ctx.pauseAnimation(frameDelay, 0 /* PAUSE_BEHAVIOR_DEFAULT */)) {
                ctx.rogue.disturbed = true;
                ctx.rogue.autoPlayingLevel = false;
            }
        }
        ctx.hilitePath(path, steps, true);
    } while (!ctx.rogue.disturbed);

    ctx.rogue.automationActive = false;
    ctx.refreshSideBar(-1, -1, false);
    ctx.freeGrid(distanceMap);
    return madeProgress;
}

// =============================================================================
// autoPlayLevel — from Movement.c:2041
// =============================================================================

/**
 * Auto-plays the current level: explores until no progress can be made,
 * then descends the stairs.
 *
 * C: void autoPlayLevel(boolean fastForward)
 */
export function autoPlayLevel(
    fastForward: boolean,
    ctx: TravelExploreContext,
): void {
    ctx.rogue.autoPlayingLevel = true;

    ctx.confirmMessages();
    const playMsg = KEYBOARD_LABELS
        ? "Playing... press any key to stop."
        : "Playing... touch anywhere to stop.";
    ctx.message(playMsg, 0);

    let madeProgress: boolean;
    do {
        madeProgress = explore(fastForward ? 1 : 50, ctx);

        if (
            !madeProgress &&
            ctx.rogue.downLoc.x === ctx.player.loc.x &&
            ctx.rogue.downLoc.y === ctx.player.loc.y
        ) {
            useStairs(1, ctx);
            madeProgress = true;
        }
    } while (madeProgress && ctx.rogue.autoPlayingLevel);

    ctx.confirmMessages();
    ctx.rogue.autoPlayingLevel = false;
}

// =============================================================================
// proposeOrConfirmLocation — from Movement.c:2164
// =============================================================================

/**
 * Proposes or confirms a travel target location. If the player is already
 * at the target, displays a message. If the location is discovered, sets
 * the cursor or confirms if cursor is already there.
 *
 * C: boolean proposeOrConfirmLocation(pos target, char *failureMessage)
 */
export function proposeOrConfirmLocation(
    target: Pos,
    failureMessage: string,
    ctx: TravelExploreContext,
): boolean {
    if (ctx.posEq(ctx.player.loc, target)) {
        ctx.message("you are already there.", 0);
        return false;
    }

    if (ctx.pmap[target.x][target.y].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) {
        if (ctx.posEq(ctx.rogue.cursorLoc, target)) {
            return true;
        } else {
            ctx.rogue.cursorLoc = target;
            return false;
        }
    }

    ctx.message(failureMessage, 0);
    return false;
}

// =============================================================================
// useStairs — from Movement.c:2180
// =============================================================================

/**
 * Handles using stairs (ascending or descending).
 * stairDirection: 1 = descend, -1 = ascend
 *
 * C: boolean useStairs(short stairDirection)
 */
export function useStairs(
    stairDirection: number,
    ctx: TravelExploreContext,
): boolean {
    let succeeded = false;

    if (stairDirection === 1) {
        if (ctx.rogue.depthLevel < ctx.gameConst.deepestLevel) {
            ctx.rogue.cursorLoc = ctx.INVALID_POS;
            ctx.rogue.depthLevel++;
            ctx.message("You descend.", 0);
            ctx.startLevel(ctx.rogue.depthLevel - 1, stairDirection);
            if (ctx.rogue.depthLevel > ctx.rogue.deepestLevel) {
                ctx.rogue.deepestLevel = ctx.rogue.depthLevel;
            }
        } else if (ctx.numberOfMatchingPackItems(ctx.AMULET, 0, 0, false)) {
            ctx.victory(true);
        } else {
            ctx.confirmMessages();
            ctx.messageWithColor(
                "the crystal archway repels you with a mysterious force!",
                ctx.lightBlue,
                0,
            );
            ctx.messageWithColor(
                "(Only the bearer of the Amulet of Yendor may pass.)",
                ctx.backgroundMessageColor,
                0,
            );
        }
        succeeded = true;
    } else {
        if (ctx.rogue.depthLevel > 1 || ctx.numberOfMatchingPackItems(ctx.AMULET, 0, 0, false)) {
            ctx.rogue.cursorLoc = ctx.INVALID_POS;
            ctx.rogue.depthLevel--;
            if (ctx.rogue.depthLevel === 0) {
                ctx.victory(false);
            } else {
                ctx.message("You ascend.", 0);
                ctx.startLevel(ctx.rogue.depthLevel + 1, stairDirection);
            }
            succeeded = true;
        } else {
            ctx.confirmMessages();
            ctx.messageWithColor("The dungeon exit is magically sealed!", ctx.lightBlue, 0);
            ctx.messageWithColor(
                "(Only the bearer of the Amulet of Yendor may pass.)",
                ctx.backgroundMessageColor,
                0,
            );
        }
    }

    if (succeeded) {
        ctx.updatePlayerUnderwaterness();
    }

    return succeeded;
}
