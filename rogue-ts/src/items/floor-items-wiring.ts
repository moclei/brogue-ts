/*
 *  items/floor-items-wiring.ts — context builder for updateFloorItems
 *  Port V2 — rogue-ts
 *
 *  Exports buildUpdateFloorItemsFn() which wires the real updateFloorItems
 *  into EnvironmentContext.updateFloorItems.
 *
 *  promoteTile / activateMachine / circuitBreakersPreventActivation are
 *  accepted as callbacks so the caller can close over the EnvironmentContext.
 *
 *  C: Items.c:1192 — updateFloorItems()
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Item, Pcell, Pos, LevelData, GameConstants,
    FloorTileType, DungeonFeature, Color, ItemTable,
} from "../types/types.js";
import { TileFlag, ANY_KIND_OF_VISIBLE } from "../types/flags.js";
import { updateFloorItems } from "./floor-items.js";
import { removeItemFromArray, deleteItem as deleteItemFn } from "./item-inventory.js";
import { identifyItemKind as identifyItemKindFn } from "./item-naming.js";
import { getQualifyingLocNear as getQualifyingLocNearFn } from "../architect/architect.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "../architect/machines.js";
import { coordinatesAreInMap } from "../globals/tables.js";

// =============================================================================
// Interface
// =============================================================================

export interface UpdateFloorItemsWiringParams {
    floorItems: Item[];
    pmap: Pcell[][];
    rogue: { absoluteTurnNumber: number; depthLevel: number };
    gameConst: GameConstants;
    levels: LevelData[];
    player: { loc: Pos };
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    mutableScrollTable: ItemTable[];
    mutablePotionTable: ItemTable[];
    itemMessageColor: Color;
    messageWithColor(msg: string, color: Color, flags: number): void;
    itemName(theItem: Item, buf: string[], details: boolean, article: boolean, maxLen: null): void;
    refreshDungeonCell(loc: Pos): void;
    /** Delegates to promoteTile(x, y, layer, useFireDF, envCtx). */
    promoteTile(x: number, y: number, layer: number, useFireDF: boolean): void;
    /** Delegates to activateMachine(mn, envCtx). */
    activateMachine(machineNumber: number): void;
    /** Delegates to circuitBreakersPreventActivation(mn, envCtx). */
    circuitBreakersPreventActivation(machineNumber: number): boolean;
}

// =============================================================================
// buildUpdateFloorItemsFn — C: Items.c:1192
// =============================================================================

/**
 * Build the updateFloorItems callback for EnvironmentContext.
 *
 * Wires the real updateFloorItems() with game-state closures. The
 * environment callbacks (promoteTile, activateMachine, circuitBreakers)
 * are provided by the caller so they can close over their EnvironmentContext.
 *
 * C: Items.c:1192 updateFloorItems()
 */
export function buildUpdateFloorItemsFn(p: UpdateFloorItemsWiringParams): () => void {
    return (): void => updateFloorItems({
        floorItems: p.floorItems,
        pmap: p.pmap,
        rogue: p.rogue,
        gameConst: p.gameConst,
        levels: p.levels,
        player: p.player,
        tileCatalog: p.tileCatalog,

        cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(p.pmap, loc, flags),
        cellHasTMFlag: (loc, flags) => cellHasTMFlagFn(p.pmap, loc, flags),

        itemName: p.itemName,
        identifyItemKind: (item) => identifyItemKindFn(item, p.gameConst, {
            scrollTable: p.mutableScrollTable,
            potionTable: p.mutablePotionTable,
        }),

        removeItemFromChain: (item, chain) => { removeItemFromArray(item, chain as Item[]); },
        deleteItem: deleteItemFn,

        burnItem: (item) => {
            // Inline burn — avoids building full CreatureEffectsContext.
            // Matches Items.c burnItem: removes item, clears HAS_ITEM, shows
            // message if visible, spawns DF_ITEM_FIRE (index 15).
            const { x, y } = item.loc;
            removeItemFromArray(item, p.floorItems);
            deleteItemFn(item);
            p.pmap[x][y].flags &= ~(TileFlag.HAS_ITEM | TileFlag.ITEM_DETECTED);
            if (p.pmap[x]?.[y]?.flags & (ANY_KIND_OF_VISIBLE | TileFlag.DISCOVERED | TileFlag.ITEM_DETECTED)) {
                p.refreshDungeonCell(item.loc);
            }
            if (p.pmap[x]?.[y]?.flags & TileFlag.VISIBLE) {
                const buf: string[] = [""];
                p.itemName(item, buf, false, true, null);
                p.messageWithColor(
                    `${buf[0]} burn${item.quantity === 1 ? "s" : ""} up!`,
                    p.itemMessageColor, 0,
                );
            }
            spawnDungeonFeatureFn(
                p.pmap, p.tileCatalog, p.dungeonFeatureCatalog,
                x, y, p.dungeonFeatureCatalog[15] as DungeonFeature, true, false, p.refreshDungeonCell,
            );
        },

        promoteTile: p.promoteTile,
        activateMachine: p.activateMachine,
        circuitBreakersPreventActivation: p.circuitBreakersPreventActivation,
        swapItemEnchants: () => false,   // enchant-swap machine wired separately

        getQualifyingLocNear: (target, _hall, _map, forbidTerrain, forbidMapFlags) =>
            getQualifyingLocNearFn(p.pmap, target, forbidTerrain, forbidMapFlags),

        messageWithColor: p.messageWithColor,
        discover: (x, y) => { if (coordinatesAreInMap(x, y)) p.pmap[x][y].flags |= TileFlag.DISCOVERED; },
        refreshDungeonCell: p.refreshDungeonCell,
        itemMessageColor: p.itemMessageColor,
    });
}
