/*
 *  item-ops.ts — Factory for ItemOps callbacks
 *  brogue-ts
 *
 *  Creates the ItemOps implementation that wires real item functions
 *  into the machine building system. This bridges the items module
 *  with the architect/machines module.
 */

import type { Item, ItemTable, Pcell, GameConstants, Pos } from "../types/types.js";
import type { ItemOps, MachineItem } from "../architect/machines.js";
import { TileFlag } from "../types/flags.js";
import { ItemFlag } from "../types/flags.js";
import { generateItem, itemIsHeavyWeapon, itemIsPositivelyEnchanted, itemMagicPolarity } from "./item-generation.js";
import type { ItemGenContext } from "./item-generation.js";
import { removeItemFromArray, addItemToArray } from "./item-inventory.js";

/**
 * Context required to create ItemOps callbacks.
 * Bundles the game state and dependencies needed for item operations
 * during machine building.
 */
export interface ItemOpsContext {
    /** The generation context for creating items. */
    genCtx: ItemGenContext;
    /** The level's pmap for setting tile flags. */
    pmap: Pcell[][];
    /** The floor items array (shared reference with MachineContext). */
    floorItems: Item[];
}

/**
 * Create an ItemOps implementation backed by the real item functions.
 *
 * This is the bridge between the architect's machine building system
 * (which uses the minimal MachineItem interface) and the full item
 * module (which works with Item objects).
 *
 * All MachineItem parameters are expected to actually be Item objects
 * at runtime, since they are created by generateItem().
 */
export function createItemOps(ctx: ItemOpsContext): ItemOps {
    return {
        generateItem(category: number, kind: number): MachineItem {
            return generateItem(category, kind, ctx.genCtx);
        },

        deleteItem(_item: MachineItem): void {
            // In TypeScript with arrays, deletion is just GC.
            // The machine code already removes items from floorItems/packItems
            // via removeItemFromArray before calling deleteItem.
        },

        placeItemAt(item: MachineItem, pos: Pos): void {
            const theItem = item as Item;
            theItem.loc = { ...pos };

            // Remove first (in case of double-placement), then add
            removeItemFromArray(theItem, ctx.floorItems);
            addItemToArray(theItem, ctx.floorItems);

            // Set HAS_ITEM flag on the pmap cell
            ctx.pmap[pos.x][pos.y].flags |= TileFlag.HAS_ITEM;

            // Set ITEM_DETECTED if magic-detected and has polarity
            if ((theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) && itemMagicPolarity(theItem)) {
                ctx.pmap[pos.x][pos.y].flags |= TileFlag.ITEM_DETECTED;
            }
        },

        removeItemFromArray(item: MachineItem, arr: MachineItem[]): void {
            removeItemFromArray(item as Item, arr as Item[]);
        },

        itemIsHeavyWeapon(item: MachineItem): boolean {
            return itemIsHeavyWeapon(item as Item);
        },

        itemIsPositivelyEnchanted(item: MachineItem): boolean {
            return itemIsPositivelyEnchanted(item as Item);
        },
    };
}
