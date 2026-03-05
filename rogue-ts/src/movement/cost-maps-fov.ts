/*
 *  cost-maps-fov.ts — Cost map population and FOV display update
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: populateGenericCostMap, populateCreatureCostMap, updateFieldOfViewDisplay
 *
 *  (getLocationFlags is already in map-queries.ts)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Pcell, Item, Color, Tcell } from "../types/types.js";
import { CreatureState, StatusEffect, DungeonLayer } from "../types/enums.js";
import {
    TileFlag, TerrainFlag, TerrainMechFlag,
    MonsterBehaviorFlag, ItemFlag,
    T_PATHING_BLOCKER,
} from "../types/flags.js";
import { DCOLS, DROWS, PDS_FORBIDDEN, PDS_OBSTRUCTION, VISIBILITY_THRESHOLD } from "../types/constants.js";

// =============================================================================
// Context
// =============================================================================

/**
 * Context for cost map and FOV display functions.
 */
export interface CostMapFovContext {
    /** Permanent map cells (column-major). */
    pmap: Pcell[][];
    /** Light/visibility map. */
    tmap: Tcell[][];
    /** The player creature. */
    player: Creature;
    /** Rogue game state. */
    rogue: {
        depthLevel: number;
        automationActive: boolean;
        playerTurnNumber: number;
        xpxpThisTurn: number;
        /** mapToShore[x][y] = distance to nearest safe shore cell. */
        mapToShore: number[][];
    };
    /** Tile catalog for terrain data. */
    tileCatalog: readonly {
        flags: number;
        mechFlags: number;
        discoverType: number;
        description: string;
        foreColor: Color | null;
        backColor: Color | null;
    }[];

    // --- Map helpers ---
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    terrainFlags(pos: Pos): number;
    terrainMechFlags(pos: Pos): number;
    discoveredTerrainFlagsAtLoc(pos: Pos): number;
    monsterAvoids(monst: Creature, pos: Pos): boolean;
    canPass(monst: Creature, blocker: Creature): boolean;
    distanceBetween(p1: Pos, p2: Pos): number;

    // --- Creature helpers ---
    monsterAtLoc(loc: Pos): Creature | null;
    playerCanSee(x: number, y: number): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;

    // --- Item helpers ---
    itemAtLoc(loc: Pos): Item | null;
    itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: number | null): void;

    // --- UI helpers ---
    messageWithColor(msg: string, color: Color | null, flags: number): void;
    refreshDungeonCell(loc: Pos): void;
    discoverCell(x: number, y: number): void;
    storeMemories(x: number, y: number): void;
    layerWithTMFlag(x: number, y: number, flag: number): DungeonLayer;

    // --- Color constants ---
    itemMessageColor: Color;
    backgroundMessageColor: Color;

    // --- Item category constant ---
    KEY: number;

    // --- RNG ---
    assureCosmeticRNG(): void;
    restoreRNG(): void;

    // --- getLocationFlags from map-queries ---
    getLocationFlags(x: number, y: number, limitToPlayerKnowledge: boolean): {
        tFlags: number;
        tmFlags: number;
        cellFlags: number;
    };
}

// =============================================================================
// populateGenericCostMap — from Movement.c:1733
// =============================================================================

/**
 * Populates a generic cost map based on terrain passability.
 * Cells with obstructing terrain are marked as PDS_OBSTRUCTION or PDS_FORBIDDEN,
 * pathing-blocking cells as PDS_FORBIDDEN, and all others as 1.
 *
 * C: void populateGenericCostMap(short **costMap)
 */
export function populateGenericCostMap(
    costMap: number[][],
    ctx: CostMapFovContext,
): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const pos: Pos = { x: i, y: j };
            if (
                ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                (!ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) ||
                    !!(ctx.discoveredTerrainFlagsAtLoc(pos) & TerrainFlag.T_OBSTRUCTS_PASSABILITY))
            ) {
                costMap[i][j] = ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
            } else if (ctx.cellHasTerrainFlag(pos, T_PATHING_BLOCKER & ~TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                costMap[i][j] = PDS_FORBIDDEN;
            } else {
                costMap[i][j] = 1;
            }
        }
    }
}

// =============================================================================
// populateCreatureCostMap — from Movement.c:1780
// =============================================================================

/**
 * Populates a cost map tailored for a specific creature's movement.
 * Considers terrain, monster avoidance, temporary status durations
 * (levitation over lava/water), and trap exploration costs.
 *
 * C: void populateCreatureCostMap(short **costMap, creature *monst)
 */
export function populateCreatureCostMap(
    costMap: number[][],
    monst: Creature,
    ctx: CostMapFovContext,
): void {
    const isPlayer = monst === ctx.player;
    const unexploredCellCost = 10 + (Math.min(Math.max(ctx.rogue.depthLevel, 5), 15) - 5) * 2;

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const pos: Pos = { x: i, y: j };

            // Undiscovered/unmapped cells for the player
            if (isPlayer && !(ctx.pmap[i][j].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))) {
                costMap[i][j] = PDS_OBSTRUCTION;
                continue;
            }

            const { tFlags, cellFlags: cFlags } = ctx.getLocationFlags(i, j, isPlayer);

            // Obstructing terrain
            if (
                (tFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                (!ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) ||
                    !!(ctx.discoveredTerrainFlagsAtLoc(pos) & TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                    isPlayer)
            ) {
                costMap[i][j] = (tFlags & TerrainFlag.T_OBSTRUCTS_DIAGONAL_MOVEMENT)
                    ? PDS_OBSTRUCTION
                    : PDS_FORBIDDEN;
                continue;
            }

            // Lava with temporary fire immunity / levitation
            if (
                (tFlags & TerrainFlag.T_LAVA_INSTA_DEATH) &&
                !(monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE | MonsterBehaviorFlag.MONST_FLIES | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
                (monst.status[StatusEffect.Levitating] || monst.status[StatusEffect.ImmuneToFire]) &&
                Math.max(monst.status[StatusEffect.Levitating], monst.status[StatusEffect.ImmuneToFire]) <
                    (ctx.rogue.mapToShore[i][j] +
                        Math.floor(ctx.distanceBetween(pos, monst.loc) * monst.movementSpeed / 100))
            ) {
                costMap[i][j] = PDS_FORBIDDEN;
                continue;
            }

            // Auto-descent or deep water with temporary levitation
            if (
                ((tFlags & TerrainFlag.T_AUTO_DESCENT) ||
                    ((tFlags & TerrainFlag.T_IS_DEEP_WATER) && !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WATER))) &&
                !(monst.info.flags & MonsterBehaviorFlag.MONST_FLIES) &&
                monst.status[StatusEffect.Levitating] &&
                monst.status[StatusEffect.Levitating] <
                    (ctx.rogue.mapToShore[i][j] +
                        Math.floor(ctx.distanceBetween(pos, monst.loc) * monst.movementSpeed / 100))
            ) {
                costMap[i][j] = PDS_FORBIDDEN;
                continue;
            }

            // Monster avoidance
            if (ctx.monsterAvoids(monst, pos)) {
                costMap[i][j] = PDS_FORBIDDEN;
                continue;
            }

            // Invulnerable/immune monster blocking
            if (cFlags & TileFlag.HAS_MONSTER) {
                const currentTenant = ctx.monsterAtLoc(pos);
                if (
                    currentTenant &&
                    (currentTenant.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
                    !ctx.canPass(monst, currentTenant)
                ) {
                    costMap[i][j] = PDS_FORBIDDEN;
                    continue;
                }
            }

            // Base cost: trap-free vs unexplored
            if (
                (cFlags & TileFlag.KNOWN_TO_BE_TRAP_FREE) ||
                (!isPlayer && monst.creatureState !== CreatureState.Ally)
            ) {
                costMap[i][j] = 10;
            } else {
                costMap[i][j] = unexploredCellCost;
            }

            // Hazard penalty
            if (!(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
                if (
                    (tFlags & TerrainFlag.T_CAUSES_NAUSEA) ||
                    ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_PROMOTES_ON_ITEM_PICKUP) ||
                    ((tFlags & TerrainFlag.T_ENTANGLES) && !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS))
                ) {
                    costMap[i][j] += 20;
                }
            }

            // Player avoids certain items
            if (isPlayer) {
                const theItem = ctx.itemAtLoc(pos);
                if (theItem && (theItem.flags & ItemFlag.ITEM_PLAYER_AVOIDS)) {
                    costMap[i][j] += 10;
                }
            }
        }
    }
}

// =============================================================================
// updateFieldOfViewDisplay — from Movement.c:2236
// =============================================================================

/**
 * Updates the field-of-view display. Determines which cells became visible,
 * ceased being visible, or changed light color, and refreshes them.
 *
 * C: void updateFieldOfViewDisplay(boolean updateDancingTerrain, boolean refreshDisplay)
 */
export function updateFieldOfViewDisplay(
    updateDancingTerrain: boolean,
    refreshDisplay: boolean,
    ctx: CostMapFovContext,
): void {
    ctx.assureCosmeticRNG();

    for (let i = 0; i < DCOLS; i++) {
        for (let j = DROWS - 1; j >= 0; j--) {
            const cell = ctx.pmap[i][j];
            const pos: Pos = { x: i, y: j };

            // Determine visibility from FOV + light
            if (
                (cell.flags & TileFlag.IN_FIELD_OF_VIEW) &&
                Math.max(0, ctx.tmap[i][j].light[0]) +
                    Math.max(0, ctx.tmap[i][j].light[1]) +
                    Math.max(0, ctx.tmap[i][j].light[2]) >
                    VISIBILITY_THRESHOLD &&
                !(cell.flags & TileFlag.CLAIRVOYANT_DARKENED)
            ) {
                cell.flags |= TileFlag.VISIBLE;
            }

            if ((cell.flags & TileFlag.VISIBLE) && !(cell.flags & TileFlag.WAS_VISIBLE)) {
                // Cell became visible this move
                if (!(cell.flags & TileFlag.DISCOVERED) && ctx.rogue.automationActive) {
                    if (cell.flags & TileFlag.HAS_ITEM) {
                        const theItem = ctx.itemAtLoc(pos);
                        if (theItem && (theItem.category & ctx.KEY)) {
                            const nameBuf: string[] = [""];
                            ctx.itemName(theItem, nameBuf, false, true, null);
                            ctx.messageWithColor(
                                `you see ${nameBuf[0]}.`,
                                ctx.itemMessageColor,
                                0,
                            );
                        }
                    }
                    if (
                        !(cell.flags & TileFlag.MAGIC_MAPPED) &&
                        ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_INTERRUPT_EXPLORATION_WHEN_SEEN)
                    ) {
                        const layer = ctx.layerWithTMFlag(i, j, TerrainMechFlag.TM_INTERRUPT_EXPLORATION_WHEN_SEEN);
                        const name = ctx.tileCatalog[cell.layers[layer]].description;
                        ctx.messageWithColor(
                            `you see ${name}.`,
                            ctx.backgroundMessageColor,
                            0,
                        );
                    }
                }
                ctx.discoverCell(i, j);
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (!(cell.flags & TileFlag.VISIBLE) && (cell.flags & TileFlag.WAS_VISIBLE)) {
                // Cell ceased being visible
                ctx.storeMemories(i, j);
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (
                !(cell.flags & TileFlag.CLAIRVOYANT_VISIBLE) &&
                (cell.flags & TileFlag.WAS_CLAIRVOYANT_VISIBLE)
            ) {
                // Ceased being clairvoyantly visible
                ctx.storeMemories(i, j);
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (
                !(cell.flags & TileFlag.WAS_CLAIRVOYANT_VISIBLE) &&
                (cell.flags & TileFlag.CLAIRVOYANT_VISIBLE)
            ) {
                // Became clairvoyantly visible
                cell.flags &= ~TileFlag.STABLE_MEMORY;
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (
                !(cell.flags & TileFlag.TELEPATHIC_VISIBLE) &&
                (cell.flags & TileFlag.WAS_TELEPATHIC_VISIBLE)
            ) {
                // Ceased being telepathically visible
                ctx.storeMemories(i, j);
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (
                !(cell.flags & TileFlag.WAS_TELEPATHIC_VISIBLE) &&
                (cell.flags & TileFlag.TELEPATHIC_VISIBLE)
            ) {
                // Became telepathically visible
                if (
                    !(cell.flags & TileFlag.DISCOVERED) &&
                    !ctx.cellHasTerrainFlag(pos, T_PATHING_BLOCKER)
                ) {
                    ctx.rogue.xpxpThisTurn++;
                }
                cell.flags &= ~TileFlag.STABLE_MEMORY;
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (
                ctx.playerCanSeeOrSense(i, j) &&
                (ctx.tmap[i][j].light[0] !== ctx.tmap[i][j].oldLight[0] ||
                    ctx.tmap[i][j].light[1] !== ctx.tmap[i][j].oldLight[1] ||
                    ctx.tmap[i][j].light[2] !== ctx.tmap[i][j].oldLight[2])
            ) {
                // Cell's light color changed this move
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            } else if (
                updateDancingTerrain &&
                ctx.playerCanSee(i, j) &&
                (!ctx.rogue.automationActive || !(ctx.rogue.playerTurnNumber % 5)) &&
                (hasDancingColor(cell, ctx) || ctx.player.status[StatusEffect.Hallucinating])
            ) {
                // Dancing terrain colors
                cell.flags &= ~TileFlag.STABLE_MEMORY;
                if (refreshDisplay) {
                    ctx.refreshDungeonCell(pos);
                }
            }
        }
    }

    ctx.restoreRNG();
}

/**
 * Helper: checks if any layer of the cell has a dancing fore/back color.
 */
function hasDancingColor(
    cell: Pcell,
    ctx: CostMapFovContext,
): boolean {
    const layers = [
        DungeonLayer.Dungeon,
        DungeonLayer.Liquid,
        DungeonLayer.Surface,
        DungeonLayer.Gas,
    ];
    for (const layer of layers) {
        const tile = ctx.tileCatalog[cell.layers[layer]];
        if (tile) {
            if (tile.backColor?.colorDances || tile.foreColor?.colorDances) {
                return true;
            }
        }
    }
    return false;
}
