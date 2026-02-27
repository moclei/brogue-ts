/*
 *  safety-maps.ts — Safety map, clairvoyance, telepathy, and vision updates
 *  brogue-ts
 *
 *  Ported from: src/brogue/Time.c
 *  Functions: updateClairvoyance, updateTelepathy, updateVision,
 *             updateSafetyMap, updateAllySafetyMap, updateSafeTerrainMap,
 *             resetDistanceCellInGrid
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Creature,
    Pos,
    Pcell,
    Item,
    FloorTileType,
} from "../types/types.js";
import { StatusEffect, CreatureState, DungeonLayer, TileType } from "../types/enums.js";
import {
    TileFlag,
    TerrainFlag,
    TerrainMechFlag,
    T_PATHING_BLOCKER,
    T_HARMFUL_TERRAIN,
    MonsterBehaviorFlag,
} from "../types/flags.js";
import { nbDirs } from "./environment.js";

// =============================================================================
// Constants
// =============================================================================

export const PDS_FORBIDDEN = -1;
export const PDS_OBSTRUCTION = -2;

// =============================================================================
// Context
// =============================================================================

export interface SafetyMapsContext {
    player: Creature;
    rogue: {
        clairvoyance: number;
        depthLevel: number;
        updatedSafetyMapThisTurn: boolean;
        updatedAllySafetyMapThisTurn: boolean;
        updatedMapToSafeTerrainThisTurn: boolean;
        mapToSafeTerrain: number[][] | null;
        upLoc: Pos;
        downLoc: Pos;
    };
    monsters: Creature[];
    dormantMonsters: Creature[];
    pmap: Pcell[][];
    tileCatalog: readonly FloorTileType[];

    safetyMap: number[][];
    allySafetyMap: number[][];

    DCOLS: number;
    DROWS: number;
    FP_FACTOR: number;

    // Map helpers
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    coordinatesAreInMap(x: number, y: number): boolean;
    pmapAt(loc: Pos): Pcell;
    discoveredTerrainFlagsAtLoc(loc: Pos): number;
    monsterAtLoc(loc: Pos): Creature | null;
    monstersAreEnemies(m1: Creature, m2: Creature): boolean;
    monsterRevealed(monst: Creature): boolean;

    // Vision
    zeroOutGrid(grid: number[][]): void;
    getFOVMask(grid: number[][], x: number, y: number, radius: number, obstructionFlags: number, extraFlags: number, omniscient: boolean): void;
    updateLighting(): void;
    updateFieldOfViewDisplay(newlyVisible: boolean, refreshDisplay: boolean): void;
    discoverCell(x: number, y: number): void;
    refreshDungeonCell(loc: Pos): void;

    // Dijkstra
    allocGrid(): number[][];
    freeGrid(grid: number[][]): void;
    dijkstraScan(distanceMap: number[][], costMap: number[][], useDiagonals: boolean): void;

    // Math
    max(a: number, b: number): number;
    min(a: number, b: number): number;

    // Items
    floorItems: Item[];
}

// =============================================================================
// updateClairvoyance — from Time.c:552
// =============================================================================

export function updateClairvoyance(
    ctx: SafetyMapsContext,
): void {
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].flags &= ~TileFlag.WAS_CLAIRVOYANT_VISIBLE;

            if (ctx.pmap[i][j].flags & TileFlag.CLAIRVOYANT_VISIBLE) {
                ctx.pmap[i][j].flags |= TileFlag.WAS_CLAIRVOYANT_VISIBLE;
            }

            ctx.pmap[i][j].flags &= ~(TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.CLAIRVOYANT_DARKENED);
        }
    }

    const cursed = ctx.rogue.clairvoyance < 0;
    let clairvoyanceRadius: number;
    let cFlags: number;
    if (cursed) {
        clairvoyanceRadius = (ctx.rogue.clairvoyance - 1) * -1;
        cFlags = TileFlag.CLAIRVOYANT_DARKENED;
    } else {
        clairvoyanceRadius = ctx.rogue.clairvoyance > 0 ? ctx.rogue.clairvoyance + 1 : 0;
        cFlags = TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.DISCOVERED;
    }

    const px = ctx.player.loc.x;
    const py = ctx.player.loc.y;
    for (
        let i = ctx.max(0, px - clairvoyanceRadius);
        i < ctx.min(ctx.DCOLS, px + clairvoyanceRadius + 1);
        i++
    ) {
        for (
            let j = ctx.max(0, py - clairvoyanceRadius);
            j < ctx.min(ctx.DROWS, py + clairvoyanceRadius + 1);
            j++
        ) {
            const dx = px - i;
            const dy = py - j;
            if (
                dx * dx + dy * dy < clairvoyanceRadius * clairvoyanceRadius + clairvoyanceRadius &&
                (ctx.pmap[i][j].layers[DungeonLayer.Dungeon] !== TileType.GRANITE ||
                    ctx.pmap[i][j].flags & TileFlag.DISCOVERED)
            ) {
                if (cFlags & TileFlag.DISCOVERED) {
                    ctx.discoverCell(i, j);
                }
                ctx.pmap[i][j].flags |= cFlags;
                if (!(ctx.pmap[i][j].flags & TileFlag.HAS_PLAYER) && !cursed) {
                    ctx.pmap[i][j].flags &= ~TileFlag.STABLE_MEMORY;
                }
            }
        }
    }
}

// =============================================================================
// updateTelepathy — from Time.c:600
// =============================================================================

export function updateTelepathy(
    ctx: SafetyMapsContext,
): void {
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].flags &= ~TileFlag.WAS_TELEPATHIC_VISIBLE;
            if (ctx.pmap[i][j].flags & TileFlag.TELEPATHIC_VISIBLE) {
                ctx.pmap[i][j].flags |= TileFlag.WAS_TELEPATHIC_VISIBLE;
            }
            ctx.pmap[i][j].flags &= ~TileFlag.TELEPATHIC_VISIBLE;
        }
    }

    const grid: number[][] = [];
    ctx.zeroOutGrid(grid);

    const processMonster = (monst: Creature) => {
        if (ctx.monsterRevealed(monst)) {
            ctx.getFOVMask(
                grid,
                monst.loc.x,
                monst.loc.y,
                2 * ctx.FP_FACTOR,
                TerrainFlag.T_OBSTRUCTS_VISION,
                0,
                false,
            );
            ctx.pmapAt(monst.loc).flags |= TileFlag.TELEPATHIC_VISIBLE;
            ctx.discoverCell(monst.loc.x, monst.loc.y);
        }
    };

    for (const monst of ctx.monsters) {
        processMonster(monst);
    }
    for (const monst of ctx.dormantMonsters) {
        processMonster(monst);
    }

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (grid[i]?.[j]) {
                ctx.pmap[i][j].flags |= TileFlag.TELEPATHIC_VISIBLE;
                ctx.discoverCell(i, j);
            }
        }
    }
}

// =============================================================================
// updateVision — from Time.c:742
// =============================================================================

export function updateVision(
    refreshDisplay: boolean,
    ctx: SafetyMapsContext,
): void {
    // demoteVisibility inlined
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].flags &= ~TileFlag.WAS_VISIBLE;
            if (ctx.pmap[i][j].flags & TileFlag.VISIBLE) {
                ctx.pmap[i][j].flags &= ~TileFlag.VISIBLE;
                ctx.pmap[i][j].flags |= TileFlag.WAS_VISIBLE;
            }
        }
    }

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].flags &= ~TileFlag.IN_FIELD_OF_VIEW;
        }
    }

    // Calculate player's field of view
    const grid: number[][] = [];
    ctx.zeroOutGrid(grid);
    ctx.getFOVMask(
        grid,
        ctx.player.loc.x,
        ctx.player.loc.y,
        (ctx.DCOLS + ctx.DROWS) * ctx.FP_FACTOR,
        TerrainFlag.T_OBSTRUCTS_VISION,
        0,
        false,
    );
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (grid[i]?.[j]) {
                ctx.pmap[i][j].flags |= TileFlag.IN_FIELD_OF_VIEW;
            }
        }
    }
    ctx.pmapAt(ctx.player.loc).flags |= TileFlag.IN_FIELD_OF_VIEW | TileFlag.VISIBLE;

    if (ctx.rogue.clairvoyance < 0) {
        ctx.discoverCell(ctx.player.loc.x, ctx.player.loc.y);
    }

    if (ctx.rogue.clairvoyance !== 0) {
        updateClairvoyance(ctx);
    }

    updateTelepathy(ctx);
    ctx.updateLighting();
    ctx.updateFieldOfViewDisplay(true, refreshDisplay);

    // Refresh hallucination display
    if (ctx.player.status[StatusEffect.Hallucinating] > 0) {
        for (const theItem of ctx.floorItems) {
            if ((ctx.pmapAt(theItem.loc).flags & TileFlag.DISCOVERED) && refreshDisplay) {
                ctx.refreshDungeonCell(theItem.loc);
            }
        }
        for (const monst of ctx.monsters) {
            if ((ctx.pmapAt(monst.loc).flags & TileFlag.DISCOVERED) && refreshDisplay) {
                ctx.refreshDungeonCell(monst.loc);
            }
        }
    }
}

// =============================================================================
// resetDistanceCellInGrid — from Time.c:1584
// =============================================================================

export function resetDistanceCellInGrid(
    grid: number[][],
    x: number,
    y: number,
    ctx: Pick<SafetyMapsContext, "coordinatesAreInMap">,
): void {
    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        if (ctx.coordinatesAreInMap(newX, newY) && grid[x][y] > grid[newX][newY] + 1) {
            grid[x][y] = grid[newX][newY] + 1;
        }
    }
}

// =============================================================================
// updateAllySafetyMap — from Time.c:1522
// =============================================================================

export function updateAllySafetyMap(
    ctx: SafetyMapsContext,
): void {
    ctx.rogue.updatedAllySafetyMapThisTurn = true;

    const playerCostMap = ctx.allocGrid();
    const monsterCostMap = ctx.allocGrid();

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.allySafetyMap[i][j] = 30000;
            playerCostMap[i][j] = monsterCostMap[i][j] = 1;

            const pos: Pos = { x: i, y: j };

            if (
                ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                (!ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) ||
                    (ctx.discoveredTerrainFlagsAtLoc(pos) & TerrainFlag.T_OBSTRUCTS_PASSABILITY))
            ) {
                playerCostMap[i][j] = monsterCostMap[i][j] = ctx.cellHasTerrainFlag(
                    pos,
                    TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT,
                )
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
            } else if (ctx.cellHasTerrainFlag(pos, T_PATHING_BLOCKER & ~TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                playerCostMap[i][j] = monsterCostMap[i][j] = PDS_FORBIDDEN;
            } else if (ctx.cellHasTerrainFlag(pos, TerrainFlag.T_SACRED)) {
                playerCostMap[i][j] = 1;
                monsterCostMap[i][j] = PDS_FORBIDDEN;
            } else if (
                (ctx.pmap[i][j].flags & TileFlag.HAS_MONSTER) &&
                ctx.monstersAreEnemies(ctx.player, ctx.monsterAtLoc(pos)!)
            ) {
                playerCostMap[i][j] = 1;
                monsterCostMap[i][j] = PDS_FORBIDDEN;
                ctx.allySafetyMap[i][j] = 0;
            }
        }
    }

    playerCostMap[ctx.player.loc.x][ctx.player.loc.y] = PDS_FORBIDDEN;
    monsterCostMap[ctx.player.loc.x][ctx.player.loc.y] = PDS_FORBIDDEN;

    ctx.dijkstraScan(ctx.allySafetyMap, playerCostMap, false);

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (monsterCostMap[i][j] < 0) {
                continue;
            }
            if (ctx.allySafetyMap[i][j] === 30000) {
                ctx.allySafetyMap[i][j] = 150;
            }
            ctx.allySafetyMap[i][j] = Math.floor(
                (50 * ctx.allySafetyMap[i][j]) / (50 + ctx.allySafetyMap[i][j]),
            );
            ctx.allySafetyMap[i][j] *= -3;

            if (ctx.pmap[i][j].flags & TileFlag.IN_LOOP) {
                ctx.allySafetyMap[i][j] -= 10;
            }
        }
    }
    ctx.dijkstraScan(ctx.allySafetyMap, monsterCostMap, false);

    ctx.freeGrid(playerCostMap);
    ctx.freeGrid(monsterCostMap);
}

// =============================================================================
// updateSafetyMap — from Time.c:1598
// =============================================================================

export function updateSafetyMap(
    ctx: SafetyMapsContext,
): void {
    ctx.rogue.updatedSafetyMapThisTurn = true;

    const playerCostMap = ctx.allocGrid();
    const monsterCostMap = ctx.allocGrid();

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.safetyMap[i][j] = 30000;
            playerCostMap[i][j] = monsterCostMap[i][j] = 1;

            const pos: Pos = { x: i, y: j };

            if (
                ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                (!ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) ||
                    (ctx.discoveredTerrainFlagsAtLoc(pos) & TerrainFlag.T_OBSTRUCTS_PASSABILITY))
            ) {
                playerCostMap[i][j] = monsterCostMap[i][j] = ctx.cellHasTerrainFlag(
                    pos,
                    TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT,
                )
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
            } else if (ctx.cellHasTerrainFlag(pos, TerrainFlag.T_SACRED)) {
                playerCostMap[i][j] = 1;
                monsterCostMap[i][j] = PDS_FORBIDDEN;
            } else if (ctx.cellHasTerrainFlag(pos, TerrainFlag.T_LAVA_INSTA_DEATH)) {
                monsterCostMap[i][j] = PDS_FORBIDDEN;
                if (
                    ctx.player.status[StatusEffect.Levitating] ||
                    !ctx.player.status[StatusEffect.ImmuneToFire]
                ) {
                    playerCostMap[i][j] = 1;
                } else {
                    playerCostMap[i][j] = PDS_FORBIDDEN;
                }
            } else {
                if (ctx.pmap[i][j].flags & TileFlag.HAS_MONSTER) {
                    const monst = ctx.monsterAtLoc(pos);
                    if (
                        monst &&
                        (monst.creatureState === CreatureState.Sleeping ||
                            monst.turnsSpentStationary > 2 ||
                            (monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION) ||
                            monst.creatureState === CreatureState.Ally) &&
                        monst.creatureState !== CreatureState.Fleeing
                    ) {
                        playerCostMap[i][j] = 1;
                        monsterCostMap[i][j] = PDS_FORBIDDEN;
                        continue;
                    }
                }

                if (ctx.cellHasTerrainFlag(pos, TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_IS_DF_TRAP)) {
                    monsterCostMap[i][j] = PDS_FORBIDDEN;
                    if (ctx.player.status[StatusEffect.Levitating]) {
                        playerCostMap[i][j] = 1;
                    } else {
                        playerCostMap[i][j] = PDS_FORBIDDEN;
                    }
                } else if (ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_FIRE)) {
                    monsterCostMap[i][j] = PDS_FORBIDDEN;
                    if (ctx.player.status[StatusEffect.ImmuneToFire]) {
                        playerCostMap[i][j] = 1;
                    } else {
                        playerCostMap[i][j] = PDS_FORBIDDEN;
                    }
                } else if (
                    ctx.cellHasTerrainFlag(
                        pos,
                        TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_SPONTANEOUSLY_IGNITES,
                    )
                ) {
                    if (ctx.player.status[StatusEffect.Levitating]) {
                        playerCostMap[i][j] = 1;
                    } else {
                        playerCostMap[i][j] = 5;
                    }
                    monsterCostMap[i][j] = 5;
                } else if (
                    ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                    ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) &&
                    !(ctx.discoveredTerrainFlagsAtLoc(pos) & TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                    !(ctx.pmap[i][j].flags & TileFlag.IN_FIELD_OF_VIEW)
                ) {
                    playerCostMap[i][j] = 100;
                    monsterCostMap[i][j] = 1;
                } else {
                    playerCostMap[i][j] = monsterCostMap[i][j] = 1;
                }
            }
        }
    }

    ctx.safetyMap[ctx.player.loc.x][ctx.player.loc.y] = 0;
    playerCostMap[ctx.player.loc.x][ctx.player.loc.y] = 1;
    monsterCostMap[ctx.player.loc.x][ctx.player.loc.y] = PDS_FORBIDDEN;

    playerCostMap[ctx.rogue.upLoc.x][ctx.rogue.upLoc.y] = PDS_FORBIDDEN;
    monsterCostMap[ctx.rogue.upLoc.x][ctx.rogue.upLoc.y] = PDS_FORBIDDEN;
    playerCostMap[ctx.rogue.downLoc.x][ctx.rogue.downLoc.y] = PDS_FORBIDDEN;
    monsterCostMap[ctx.rogue.downLoc.x][ctx.rogue.downLoc.y] = PDS_FORBIDDEN;

    ctx.dijkstraScan(ctx.safetyMap, playerCostMap, false);

    // Secret doors the player can't see are not safe; the areas behind them are
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (
                ctx.cellHasTerrainFlag({ x: i, y: j }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_IS_SECRET) &&
                !(ctx.discoveredTerrainFlagsAtLoc({ x: i, y: j }) & TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                !(ctx.pmap[i][j].flags & TileFlag.IN_FIELD_OF_VIEW)
            ) {
                resetDistanceCellInGrid(ctx.safetyMap, i, j, ctx);
            }
        }
    }

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (monsterCostMap[i][j] < 0) {
                continue;
            }
            if (ctx.safetyMap[i][j] === 30000) {
                ctx.safetyMap[i][j] = 150;
            }
            ctx.safetyMap[i][j] = Math.floor(
                (50 * ctx.safetyMap[i][j]) / (50 + ctx.safetyMap[i][j]),
            );
            ctx.safetyMap[i][j] *= -3;

            if (ctx.pmap[i][j].flags & TileFlag.IN_LOOP) {
                ctx.safetyMap[i][j] -= 10;
            }
        }
    }
    ctx.dijkstraScan(ctx.safetyMap, monsterCostMap, false);

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            if (monsterCostMap[i][j] < 0) {
                ctx.safetyMap[i][j] = 30000;
            }
        }
    }

    ctx.freeGrid(playerCostMap);
    ctx.freeGrid(monsterCostMap);
}

// =============================================================================
// updateSafeTerrainMap — from Time.c:1732
// =============================================================================

export function updateSafeTerrainMap(
    ctx: SafetyMapsContext,
): void {
    ctx.rogue.updatedMapToSafeTerrainThisTurn = true;

    if (!ctx.rogue.mapToSafeTerrain) {
        return;
    }

    const costMap = ctx.allocGrid();

    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            const pos: Pos = { x: i, y: j };
            const monst = ctx.monsterAtLoc(pos);

            if (
                ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                (!ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) ||
                    (ctx.discoveredTerrainFlagsAtLoc(pos) & TerrainFlag.T_OBSTRUCTS_PASSABILITY))
            ) {
                costMap[i][j] = ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
                ctx.rogue.mapToSafeTerrain[i][j] = 30000;
            } else if (
                (monst &&
                    (monst.turnsSpentStationary > 1 ||
                        (monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION))) ||
                (ctx.cellHasTerrainFlag(pos, T_PATHING_BLOCKER & ~T_HARMFUL_TERRAIN) &&
                    !ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET))
            ) {
                costMap[i][j] = PDS_FORBIDDEN;
                ctx.rogue.mapToSafeTerrain[i][j] = 30000;
            } else if (
                ctx.cellHasTerrainFlag(pos, T_HARMFUL_TERRAIN) ||
                ctx.pmap[i][j].layers[DungeonLayer.Dungeon] === TileType.DOOR
            ) {
                costMap[i][j] = 1;
                ctx.rogue.mapToSafeTerrain[i][j] = 30000;
            } else {
                costMap[i][j] = 1;
                ctx.rogue.mapToSafeTerrain[i][j] = 0;
            }
        }
    }
    ctx.dijkstraScan(ctx.rogue.mapToSafeTerrain, costMap, false);
    ctx.freeGrid(costMap);
}
