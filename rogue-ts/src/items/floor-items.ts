/*
 *  items/floor-items.ts — updateFloorItems
 *  Port V2 — rogue-ts
 *
 *  Ported from Items.c:1192 — updateFloorItems().
 *  Called each turn to process items lying on the dungeon floor:
 *  auto-descent, burning, drift on moving terrain, tile promotion,
 *  auto-identification in machines, and enchant-swap activation.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, Pcell, Pos, LevelData, GameConstants, Color, FloorTileType, DungeonFeature } from "../types/types.js";
import {
    TerrainFlag, TerrainMechFlag, TileFlag, ItemFlag,
    ANY_KIND_OF_VISIBLE, T_MOVES_ITEMS,
} from "../types/flags.js";
import { ItemCategory } from "../types/enums.js";
import { NUMBER_TERRAIN_LAYERS } from "../types/constants.js";
import { distanceBetween } from "../monsters/monster-state.js";
import { removeItemFromArray, addItemToArray } from "./item-inventory.js";
import { initializeItem } from "./item-generation.js";

// =============================================================================
// Context
// =============================================================================

export interface UpdateFloorItemsContext {
    floorItems: Item[];
    pmap: Pcell[][];
    rogue: {
        absoluteTurnNumber: number;
        depthLevel: number;
    };
    gameConst: GameConstants;
    levels: LevelData[];
    player: { loc: Pos };
    tileCatalog: readonly FloorTileType[];

    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    cellHasTMFlag(loc: Pos, flags: number): boolean;

    itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: null): void;
    identifyItemKind(theItem: Item): void;

    removeItemFromChain(item: Item, chain: Item[]): void;
    deleteItem(item: Item): void;

    /** Burn the item (destroy it and spawn fire). */
    burnItem(theItem: Item): void;
    /** Promote a terrain layer at (x, y). */
    promoteTile(x: number, y: number, layer: number, isForced: boolean): void;
    /** Activate a machine by number. */
    activateMachine(machineNumber: number): void;
    /** Check if circuit-breaker tiles prevent machine activation. */
    circuitBreakersPreventActivation(machineNumber: number): boolean;
    /** Swap enchants between two items in a machine. Returns true if swapped. */
    swapItemEnchants(machineNumber: number): boolean;
    /** Find an adjacent qualifying location near target (hallways allowed). */
    getQualifyingLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        blockingMap: null,
        forbidTerrain: number,
        forbidMapFlags: number,
        forbidLiquid: boolean,
        deterministic: boolean,
    ): Pos | null;

    messageWithColor(msg: string, color: Color, flags: number): void;
    discover(x: number, y: number): void;
    refreshDungeonCell(loc: Pos): void;

    itemMessageColor: Color;
}

// =============================================================================
// updateFloorItems — Items.c:1192
// =============================================================================

/**
 * Process all items currently on the dungeon floor for the current turn.
 *
 * Handles:
 *  - Auto-descent: items on pit tiles fall to the next depth level
 *  - Burning: flammable items on fire/lava are destroyed
 *  - Drift: items on moving terrain (deep water, lava) drift to adjacent cell
 *  - Tile promotion: terrain promotes when an item sits on it
 *  - Auto-ID: items in the player's current machine are identified
 *  - Enchant swap: items on swap-activation tiles trigger enchant exchange
 */
export function updateFloorItems(ctx: UpdateFloorItemsContext): void {
    const { floorItems, pmap, rogue, gameConst, levels, player, tileCatalog } = ctx;

    // Snapshot the array — items may be removed/relocated during iteration.
    const snapshot = [...floorItems];

    for (const theItem of snapshot) {
        // Guard: item may have been removed by a previous iteration step.
        if (!floorItems.includes(theItem)) continue;

        const x = theItem.loc.x;
        const y = theItem.loc.y;
        const loc: Pos = { x, y };

        if (rogue.absoluteTurnNumber < theItem.spawnTurnNumber) {
            // Simulating an earlier turn than when this item fell to the level.
            continue;
        }

        // ── Auto-descent ────────────────────────────────────────────────────
        if (ctx.cellHasTerrainFlag(loc, TerrainFlag.T_AUTO_DESCENT)) {
            const playerCanSeeOrSense = !!(pmap[x]?.[y]?.flags & ANY_KIND_OF_VISIBLE);
            if (playerCanSeeOrSense) {
                const buf: string[] = [""];
                ctx.itemName(theItem, buf, false, false, null);
                const plunge = theItem.quantity > 1 ? "" : "s";
                ctx.messageWithColor(
                    `The ${buf[0]} plunge${plunge} out of sight!`,
                    ctx.itemMessageColor,
                    0,
                );
            }
            if (!!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE)) {
                ctx.discover(x, y);
            }
            theItem.flags |= ItemFlag.ITEM_PREPLACED;
            ctx.removeItemFromChain(theItem, floorItems);
            pmap[x][y].flags &= ~(TileFlag.HAS_ITEM | TileFlag.ITEM_DETECTED);

            if (theItem.category === ItemCategory.POTION ||
                rogue.depthLevel === gameConst.deepestLevel) {
                // Potions don't survive the fall; also nothing below the deepest level.
                ctx.deleteItem(theItem);
            } else {
                // Place on next level's item list.
                theItem.spawnTurnNumber = rogue.absoluteTurnNumber;
                const nextLevel = levels[rogue.depthLevel]; // levels is 0-indexed
                if (nextLevel) {
                    nextLevel.items.push(theItem);
                }
            }
            ctx.refreshDungeonCell(loc);
            continue;
        }

        // ── Burn ────────────────────────────────────────────────────────────
        if (
            (ctx.cellHasTerrainFlag(loc, TerrainFlag.T_IS_FIRE) &&
                (theItem.flags & ItemFlag.ITEM_FLAMMABLE)) ||
            (ctx.cellHasTerrainFlag(loc, TerrainFlag.T_LAVA_INSTA_DEATH) &&
                !(theItem.category & ItemCategory.AMULET))
        ) {
            ctx.burnItem(theItem);
            continue;
        }

        // ── Drift on moving terrain ─────────────────────────────────────────
        if (ctx.cellHasTerrainFlag(loc, T_MOVES_ITEMS)) {
            const newLoc = ctx.getQualifyingLocNear(
                loc, true, null,
                TerrainFlag.T_OBSTRUCTS_ITEMS | TerrainFlag.T_OBSTRUCTS_PASSABILITY,
                TileFlag.HAS_ITEM,
                false, false,
            );
            // Items can only drift to an adjacent cell (distance == 1) to prevent
            // drifting through walls.
            if (newLoc && distanceBetween(loc, newLoc) === 1) {
                // Inline removeItemAt(loc): clear HAS_ITEM and handle tile promotion.
                pmap[x][y].flags &= ~TileFlag.HAS_ITEM;
                if (ctx.cellHasTMFlag(loc, TerrainMechFlag.TM_PROMOTES_ON_ITEM_PICKUP)) {
                    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                        const tileType = pmap[x][y].layers[layer];
                        if (tileCatalog[tileType]?.mechFlags & TerrainMechFlag.TM_PROMOTES_ON_ITEM_PICKUP) {
                            ctx.promoteTile(x, y, layer, false);
                        }
                    }
                }
                pmap[newLoc.x][newLoc.y].flags |= TileFlag.HAS_ITEM;
                // Transfer ITEM_DETECTED flag to the new cell.
                if (pmap[x][y].flags & TileFlag.ITEM_DETECTED) {
                    pmap[x][y].flags &= ~TileFlag.ITEM_DETECTED;
                    pmap[newLoc.x][newLoc.y].flags |= TileFlag.ITEM_DETECTED;
                }
                theItem.loc = { ...newLoc };
                ctx.refreshDungeonCell(loc);
                ctx.refreshDungeonCell(newLoc);
                continue;
            }
        }

        // ── Tile promotion on item presence ─────────────────────────────────
        if (ctx.cellHasTMFlag(loc, TerrainMechFlag.TM_PROMOTES_ON_ITEM)) {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                const tileType = pmap[x][y].layers[layer];
                if (tileCatalog[tileType]?.mechFlags & TerrainMechFlag.TM_PROMOTES_ON_ITEM) {
                    ctx.promoteTile(x, y, layer, false);
                }
            }
            continue;
        }

        // ── Auto-identify in machine ─────────────────────────────────────────
        const cellMachine = pmap[x]?.[y]?.machineNumber ?? 0;
        const playerMachine = pmap[player.loc.x]?.[player.loc.y]?.machineNumber ?? 0;
        if (cellMachine && cellMachine === playerMachine &&
            (theItem.flags & ItemFlag.ITEM_KIND_AUTO_ID)) {
            ctx.identifyItemKind(theItem);
        }

        // ── Enchant-swap activation ──────────────────────────────────────────
        if (ctx.cellHasTMFlag(loc, TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION) && cellMachine) {
            if (!ctx.circuitBreakersPreventActivation(cellMachine) &&
                ctx.swapItemEnchants(cellMachine)) {
                ctx.activateMachine(cellMachine);
            }
        }
    }
}

// =============================================================================
// removeItemAt — Items.c:823
// =============================================================================

export interface RemoveItemAtContext {
    pmap: Pcell[][];
    tileCatalog: readonly FloorTileType[];
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    promoteTile(x: number, y: number, layer: number, isForced: boolean): void;
}

/**
 * Clear the HAS_ITEM flag at loc and trigger TM_PROMOTES_ON_ITEM_PICKUP
 * terrain promotions.
 *
 * Ported from Items.c:823 — removeItemAt().
 */
export function removeItemAt(loc: Pos, ctx: RemoveItemAtContext): void {
    const { pmap, tileCatalog } = ctx;
    pmap[loc.x][loc.y].flags &= ~TileFlag.HAS_ITEM;
    if (ctx.cellHasTMFlag(loc, TerrainMechFlag.TM_PROMOTES_ON_ITEM_PICKUP)) {
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            const tileType = pmap[loc.x][loc.y].layers[layer];
            if (tileCatalog[tileType]?.mechFlags & TerrainMechFlag.TM_PROMOTES_ON_ITEM_PICKUP) {
                ctx.promoteTile(loc.x, loc.y, layer, false);
            }
        }
    }
}

// =============================================================================
// placeItemAt — Items.c:422
// =============================================================================

export interface PlaceItemAtContext {
    pmap: Pcell[][];
    floorItems: Item[];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];

    itemMagicPolarity(item: Item): number;
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    playerCanSee(x: number, y: number): boolean;

    // Pressure-plate side effects — stubs acceptable until platform wired
    itemName(item: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: null): void;
    message(msg: string, flags: number): void;
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;
    promoteTile(x: number, y: number, layer: number, isForced: boolean): void;
    discover(x: number, y: number): void;
    refreshDungeonCell(loc: Pos): void;

    REQUIRE_ACKNOWLEDGMENT: number;
}

/**
 * Place theItem on the dungeon floor at dest.
 *
 * Sets item.loc, adds to floorItems (guarding against double-placement),
 * sets HAS_ITEM and ITEM_DETECTED pmap flags, and triggers pressure-plate
 * DF traps if applicable.
 *
 * Note: the C random-location fallback when dest is invalid is not ported —
 * all TS callers must supply a valid dest.
 *
 * Ported from Items.c:422 — placeItemAt().
 */
export function placeItemAt(theItem: Item, dest: Pos, ctx: PlaceItemAtContext): Item {
    const { pmap, floorItems, tileCatalog, dungeonFeatureCatalog } = ctx;

    theItem.loc = { ...dest };

    // Guard against double-placement (would cause infinite loops in C linked list).
    removeItemFromArray(theItem, floorItems);
    addItemToArray(theItem, floorItems);

    pmap[dest.x][dest.y].flags |= TileFlag.HAS_ITEM;
    if ((theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) && ctx.itemMagicPolarity(theItem)) {
        pmap[dest.x][dest.y].flags |= TileFlag.ITEM_DETECTED;
    }

    // Pressure-plate DF trap trigger
    if (
        ctx.cellHasTerrainFlag(dest, TerrainFlag.T_IS_DF_TRAP) &&
        !ctx.cellHasTerrainFlag(dest, T_MOVES_ITEMS) &&
        !(pmap[dest.x][dest.y].flags & TileFlag.PRESSURE_PLATE_DEPRESSED)
    ) {
        pmap[dest.x][dest.y].flags |= TileFlag.PRESSURE_PLATE_DEPRESSED;
        if (ctx.playerCanSee(dest.x, dest.y)) {
            if (ctx.cellHasTMFlag(dest, TerrainMechFlag.TM_IS_SECRET)) {
                ctx.discover(dest.x, dest.y);
                ctx.refreshDungeonCell(dest);
            }
            const buf: string[] = [""];
            ctx.itemName(theItem, buf, false, false, null);
            ctx.message(
                `a pressure plate clicks underneath the ${buf[0]}!`,
                ctx.REQUIRE_ACKNOWLEDGMENT,
            );
        }
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            const tileType = pmap[dest.x][dest.y].layers[layer];
            const tile = tileCatalog[tileType];
            if (tile?.flags & TerrainFlag.T_IS_DF_TRAP) {
                ctx.spawnDungeonFeature(
                    dest.x, dest.y,
                    dungeonFeatureCatalog[tile.fireType],
                    true, false,
                );
                ctx.promoteTile(dest.x, dest.y, layer, false);
            }
        }
    }

    return theItem;
}

// =============================================================================
// canDrop / dropItem — Items.c:7541, 7652
// =============================================================================

export interface DropItemContext extends PlaceItemAtContext {
    packItems: Item[];
    player: { loc: Pos };
    rogue: { swappedIn: Item | null; swappedOut: Item | null };

    itemAtLoc(loc: Pos): Item | null;
    pickUpItemAt(loc: Pos): void;  // STUBBED-TRACKED in movement.ts
}

/**
 * Returns true if the player can drop an item at their current location.
 * Ported from Items.c:7541 — canDrop() (static).
 */
export function canDrop(ctx: { player: { loc: Pos }; cellHasTerrainFlag(loc: Pos, flags: number): boolean }): boolean {
    return !ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_ITEMS);
}

/**
 * Drop theItem from the player's pack onto the floor at the player's location.
 *
 * If theItem is a stack of more than one (non-weapon, non-gem), peels one copy
 * off the top and places it. Otherwise moves the entire item to the floor.
 * Clears swappedIn/swappedOut references when dropping the whole item.
 *
 * Returns the dropped item, or null if the terrain obstructs items.
 *
 * Ported from Items.c:7652 — dropItem().
 */
export function dropItem(theItem: Item, ctx: DropItemContext): Item | null {
    if (ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_ITEMS)) {
        return null;
    }

    const itemOnFloor = ctx.itemAtLoc(ctx.player.loc);

    if (theItem.quantity > 1 && !(theItem.category & (ItemCategory.WEAPON | ItemCategory.GEM))) {
        // Peel one item off the stack and drop it.
        const itemFromTopOfStack = initializeItem();
        Object.assign(itemFromTopOfStack, { ...theItem });
        theItem.quantity--;
        itemFromTopOfStack.quantity = 1;
        if (itemOnFloor) {
            itemOnFloor.inventoryLetter = theItem.inventoryLetter;
            ctx.pickUpItemAt(ctx.player.loc);
        }
        return placeItemAt(itemFromTopOfStack, ctx.player.loc, ctx);
    } else {
        // Drop the entire item.
        if (ctx.rogue.swappedIn === theItem || ctx.rogue.swappedOut === theItem) {
            ctx.rogue.swappedIn = null;
            ctx.rogue.swappedOut = null;
        }
        removeItemFromArray(theItem, ctx.packItems);
        if (itemOnFloor) {
            itemOnFloor.inventoryLetter = theItem.inventoryLetter;
            ctx.pickUpItemAt(ctx.player.loc);
        }
        return placeItemAt(theItem, ctx.player.loc, ctx);
    }
}
