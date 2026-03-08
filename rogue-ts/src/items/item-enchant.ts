/*
 *  item-enchant.ts — Scroll-of-enchanting effect
 *  rogue-ts
 *
 *  Extracted from item-usage.ts to keep that file under the 600-line limit.
 *  C source: Items.c:7046 (case SCROLL_ENCHANTING in readScroll).
 */

import type { Item } from "../types/types.js";
import { ItemCategory } from "../types/enums.js";
import { wandTable } from "../globals/item-catalog.js";
import { enchantMagnitude } from "./item-usage.js";

// =============================================================================
// enchantItem — from Items.c:7046
// =============================================================================

/**
 * Apply scroll of enchanting effect to an item.
 * Modifies the item's properties based on its category.
 *
 * C: case SCROLL_ENCHANTING in readScroll (Items.c:7046–7083)
 *
 * @param theItem The item to enchant.
 * @param randRange RNG function for generating random values.
 * @returns True if the item was enchanted.
 */
export function enchantItem(
    theItem: Item,
    randRange: (lo: number, hi: number) => number,
): boolean {
    const magnitude = enchantMagnitude();
    theItem.timesEnchanted += magnitude;

    switch (theItem.category) {
        case ItemCategory.WEAPON:
            theItem.strengthRequired = Math.max(0, theItem.strengthRequired - magnitude);
            theItem.enchant1 += magnitude;
            if (theItem.quiverNumber) {
                theItem.quiverNumber = randRange(1, 60000);
            }
            break;
        case ItemCategory.ARMOR:
            theItem.strengthRequired = Math.max(0, theItem.strengthRequired - magnitude);
            theItem.enchant1 += magnitude;
            break;
        case ItemCategory.RING:
            theItem.enchant1 += magnitude;
            break;
        case ItemCategory.STAFF:
            theItem.enchant1 += magnitude;
            theItem.charges += magnitude;
            theItem.enchant2 = Math.floor(500 / theItem.enchant1);
            break;
        case ItemCategory.WAND:
            theItem.charges += wandTable[theItem.kind].range!.lowerBound * magnitude;
            break;
        case ItemCategory.CHARM:
            theItem.enchant1 += magnitude;
            theItem.charges = Math.min(0, theItem.charges); // Enchanting instantly recharges
            break;
        default:
            return false;
    }

    return true;
}
