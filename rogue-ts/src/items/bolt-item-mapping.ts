/*
 *  items/bolt-item-mapping.ts — Bolt index and effect lookup for staff/wand items
 *  brogue-ts
 *
 *  Ported from Items.c: boltEffectForItem (4337), boltForItem (4345).
 *
 *  These two functions translate an item (staff or wand) into the bolt catalog
 *  entry it uses. They are used by useStaffOrWand, staffOrWandEffectOnMonsterDescription,
 *  and the zap system.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, Bolt, ItemTable } from "../types/types.js";
import { ItemCategory, BoltEffect } from "../types/enums.js";

// =============================================================================
// boltForItem — C: Items.c:4345
// =============================================================================

/**
 * Returns the bolt catalog index for a staff or wand item.
 * For all other item categories, returns 0.
 *
 * C: boltForItem(item *theItem) → Items.c:4345
 *    return tableForItemCategory(theItem->category)[theItem->kind].power
 */
export function boltForItem(
    theItem: Item,
    staffTable: readonly ItemTable[],
    wandTable: readonly ItemTable[],
): number {
    if (theItem.category & ItemCategory.STAFF) return staffTable[theItem.kind]?.power ?? 0;
    if (theItem.category & ItemCategory.WAND) return wandTable[theItem.kind]?.power ?? 0;
    return 0;
}

// =============================================================================
// boltEffectForItem — C: Items.c:4337
// =============================================================================

/**
 * Returns the bolt effect enum for a staff or wand item.
 * For all other item categories, returns BoltEffect.None.
 *
 * C: boltEffectForItem(item *theItem) → Items.c:4337
 *    return boltCatalog[...].boltEffect
 */
export function boltEffectForItem(
    theItem: Item,
    boltCatalog: readonly Bolt[],
    staffTable: readonly ItemTable[],
    wandTable: readonly ItemTable[],
): BoltEffect {
    if (theItem.category & (ItemCategory.STAFF | ItemCategory.WAND)) {
        return boltCatalog[boltForItem(theItem, staffTable, wandTable)]?.boltEffect ?? BoltEffect.None;
    }
    return BoltEffect.None;
}
