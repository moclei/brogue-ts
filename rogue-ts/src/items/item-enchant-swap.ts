/*
 *  items/item-enchant-swap.ts — enchant-swap machine mechanics
 *  Port V2 — rogue-ts
 *
 *  Implements the enchant-swap machine: two locked floor items swap their
 *  enchant levels, with lower-bound shattering for staves/charms/wands.
 *
 *  C: Items.c:1085–1190
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, Pcell, Pos, Color } from "../types/types.js";
import { ItemCategory } from "../types/enums.js";
import { ItemFlag, TileFlag, TerrainMechFlag, ANY_KIND_OF_VISIBLE } from "../types/flags.js";
import { DCOLS, DROWS } from "../types/constants.js";
import {
    itemIsSwappable,
    enchantLevelKnown,
    effectiveEnchantLevel,
} from "./item-inventory.js";

// =============================================================================
// Context interfaces
// =============================================================================

export interface SwapItemToEnchantLevelContext {
    floorItems: Item[];
    pmap: Pcell[][];
    playerCanSee(x: number, y: number): boolean;
    removeItemFromChain(item: Item, chain: Item[]): void;
    refreshDungeonCell(loc: Pos): void;
    messageWithColor(msg: string, color: Color, flags: number): void;
    itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: null): void;
    itemMessageColor: Color;
    gameConst: {
        weaponKillsToAutoID: number;
        armorDelayToAutoID: number;
        ringDelayToAutoID: number;
    };
    charmRechargeDelay(kind: number, enchant: number): number;
    checkForDisenchantment(item: Item): void;
}

export interface SwapItemEnchantsContext extends SwapItemToEnchantLevelContext {
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    itemAtLoc(loc: Pos): Item | null;
}

// =============================================================================
// swapItemToEnchantLevel — Items.c:1085
// =============================================================================

/**
 * Set the effective enchant level of a floor item to newEnchant.
 *
 * If the new value is below the item's minimum (staff < 2, charm < 1, wand < 0)
 * the item shatters: removed from floorItems, pmap flags cleared, message shown.
 * Otherwise enchant/charges are updated, identification state is adjusted, and
 * checkForDisenchantment is called.
 *
 * C: swapItemToEnchantLevel(item *theItem, short newEnchant, boolean enchantmentKnown)
 */
export function swapItemToEnchantLevel(
    theItem: Item,
    newEnchant: number,
    enchantmentKnown: boolean,
    ctx: SwapItemToEnchantLevelContext,
): void {
    const { floorItems, pmap } = ctx;

    const shatters =
        ((theItem.category & ItemCategory.STAFF) && newEnchant < 2) ||
        ((theItem.category & ItemCategory.CHARM) && newEnchant < 1) ||
        ((theItem.category & ItemCategory.WAND) && newEnchant < 0);

    if (shatters) {
        const buf: string[] = [""];
        ctx.itemName(theItem, buf, false, true, null);
        const name = buf[0] ?? "item";
        const suffix = theItem.quantity === 1 ? "s" : "";
        const msg = `${name} shatter${suffix} from the strain!`;

        const x = theItem.loc.x;
        const y = theItem.loc.y;
        ctx.removeItemFromChain(theItem, floorItems);
        pmap[x][y].flags &= ~(TileFlag.HAS_ITEM | TileFlag.ITEM_DETECTED);
        if (pmap[x][y].flags & (ANY_KIND_OF_VISIBLE | TileFlag.DISCOVERED | TileFlag.ITEM_DETECTED)) {
            ctx.refreshDungeonCell({ x, y });
        }
        if (ctx.playerCanSee(x, y)) {
            ctx.messageWithColor(msg, ctx.itemMessageColor, 0);
        }
    } else {
        // Clamp staff charges down if needed
        if ((theItem.category & ItemCategory.STAFF) && theItem.charges > newEnchant) {
            theItem.charges = newEnchant;
        }

        // Scale charm recharge progress proportionally to the new enchant level
        if (theItem.category & ItemCategory.CHARM) {
            const oldDelay = ctx.charmRechargeDelay(theItem.kind, theItem.enchant1);
            const charmPercent = oldDelay > 0 ? Math.floor(theItem.charges * 100 / oldDelay) : 0;
            theItem.charges = Math.floor(
                charmPercent * ctx.charmRechargeDelay(theItem.kind, newEnchant) / 100,
            );
        }

        // Identification flags
        if (enchantmentKnown) {
            if (theItem.category & ItemCategory.STAFF) {
                theItem.flags |= ItemFlag.ITEM_MAX_CHARGES_KNOWN;
            }
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
        } else {
            theItem.flags &= ~(ItemFlag.ITEM_MAX_CHARGES_KNOWN | ItemFlag.ITEM_IDENTIFIED);
            theItem.flags |= ItemFlag.ITEM_CAN_BE_IDENTIFIED;
            if (theItem.category & ItemCategory.WEAPON) {
                theItem.charges = ctx.gameConst.weaponKillsToAutoID;
            } else if (theItem.category & ItemCategory.ARMOR) {
                theItem.charges = ctx.gameConst.armorDelayToAutoID;
            } else if (theItem.category & ItemCategory.RING) {
                theItem.charges = ctx.gameConst.ringDelayToAutoID;
            }
        }

        // Write the new enchant level
        if (theItem.category & ItemCategory.WAND) {
            theItem.charges = newEnchant;
        } else {
            theItem.enchant1 = newEnchant;
        }

        ctx.checkForDisenchantment(theItem);
    }
}

// =============================================================================
// swapItemEnchants — Items.c:1160
// =============================================================================

/**
 * Scan all TM_SWAP_ENCHANTS_ACTIVATION cells in machineNumber for swappable
 * items. If two items with different effective enchant levels are found,
 * swap their enchants and return true. Returns false if no swap occurred.
 *
 * C: swapItemEnchants(const short machineNumber)
 */
export function swapItemEnchants(
    machineNumber: number,
    ctx: SwapItemEnchantsContext,
): boolean {
    const { pmap } = ctx;

    let lockedItem: Item | null = null;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const cell = pmap[i]?.[j];
            if (!cell || cell.machineNumber !== machineNumber) continue;
            if (!ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_SWAP_ENCHANTS_ACTIVATION)) continue;

            const tempItem = ctx.itemAtLoc({ x: i, y: j });
            if (!tempItem || !itemIsSwappable(tempItem)) continue;

            if (lockedItem) {
                const lockedEnchant = effectiveEnchantLevel(lockedItem);
                const tempEnchant = effectiveEnchantLevel(tempItem);
                if (lockedEnchant !== tempEnchant) {
                    // Presto change-o!
                    const oldEnchant = lockedEnchant;
                    const wasKnown = enchantLevelKnown(lockedItem);
                    swapItemToEnchantLevel(lockedItem, tempEnchant, enchantLevelKnown(tempItem), ctx);
                    swapItemToEnchantLevel(tempItem, oldEnchant, wasKnown, ctx);
                    return true;
                }
            } else {
                lockedItem = tempItem;
            }
        }
    }
    return false;
}
