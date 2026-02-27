/*
 *  item-inventory.ts — Item chain management & inventory helpers
 *  brogue-ts
 *
 *  In C, items are stored as singly-linked lists (nextItem pointers).
 *  In our TypeScript port, both floor items and pack items use plain arrays
 *  (as defined in GameState). These functions provide the equivalent operations.
 */

import type { Item, Pos } from "../types/types.js";
import { ItemCategory, CAN_BE_SWAPPED } from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import { MAX_PACK_ITEMS } from "../types/constants.js";

// =============================================================================
// Chain/array management
// =============================================================================

/**
 * Remove an item from an array (the TS equivalent of removeItemFromChain).
 * Returns true if the item was found and removed, false otherwise.
 *
 * C: removeItemFromChain(item *theItem, item *theChain)
 */
export function removeItemFromArray(theItem: Item, chain: Item[]): boolean {
    const idx = chain.indexOf(theItem);
    if (idx >= 0) {
        chain.splice(idx, 1);
        return true;
    }
    return false;
}

/**
 * Add an item to the front of an array (the TS equivalent of addItemToChain).
 * C items are inserted at the head of the linked list after the sentinel;
 * we prepend to the array.
 *
 * C: addItemToChain(item *theItem, item *theChain)
 */
export function addItemToArray(theItem: Item, chain: Item[]): void {
    chain.unshift(theItem);
}

/**
 * Find an item at a specific position on the floor.
 *
 * C: itemAtLoc(pos loc)
 */
export function itemAtLoc(loc: Pos, floorItems: Item[]): Item | null {
    for (const item of floorItems) {
        if (item.loc.x === loc.x && item.loc.y === loc.y) {
            return item;
        }
    }
    return null;
}

/**
 * Find a pack item by its inventory letter.
 *
 * C: itemOfPackLetter(char letter)
 */
export function itemOfPackLetter(letter: string, packItems: Item[]): Item | null {
    for (const item of packItems) {
        if (item.inventoryLetter === letter) {
            return item;
        }
    }
    return null;
}

// =============================================================================
// Inventory counting
// =============================================================================

/**
 * Count total items in the pack. Weapons and gems count as 1 regardless of
 * quantity (they stack in quivers), other items count by quantity.
 *
 * C: numberOfItemsInPack()
 */
export function numberOfItemsInPack(packItems: Item[]): number {
    let count = 0;
    for (const item of packItems) {
        count += (item.category & (ItemCategory.WEAPON | ItemCategory.GEM))
            ? 1
            : item.quantity;
    }
    return count;
}

/**
 * Count pack items matching a category mask with required/forbidden flags.
 *
 * C: numberOfMatchingPackItems(categoryMask, requiredFlags, forbiddenFlags, displayErrors)
 * Note: The displayErrors parameter is omitted; messaging is handled by the caller.
 */
export function numberOfMatchingPackItems(
    packItems: Item[],
    categoryMask: number,
    requiredFlags: number,
    forbiddenFlags: number,
): number {
    let count = 0;
    for (const item of packItems) {
        if (
            (item.category & categoryMask)
            && !(~item.flags & requiredFlags)
            && !(item.flags & forbiddenFlags)
        ) {
            count++;
        }
    }
    return count;
}

// =============================================================================
// Inventory letters
// =============================================================================

/**
 * Check if an inventory letter is available (not used by any pack item).
 *
 * C: inventoryLetterAvailable(char proposedLetter)
 */
export function inventoryLetterAvailable(proposedLetter: string, packItems: Item[]): boolean {
    if (proposedLetter >= "a" && proposedLetter <= "z") {
        for (const item of packItems) {
            if (item.inventoryLetter === proposedLetter) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * Find the next available inventory letter (a–z).
 * Returns empty string if all 26 are taken.
 *
 * C: nextAvailableInventoryCharacter()
 */
export function nextAvailableInventoryCharacter(packItems: Item[]): string {
    const charTaken = new Array<boolean>(26).fill(false);
    for (const item of packItems) {
        const c = item.inventoryLetter;
        if (c >= "a" && c <= "z") {
            charTaken[c.charCodeAt(0) - "a".charCodeAt(0)] = true;
        }
    }
    for (let i = 0; i < 26; i++) {
        if (!charTaken[i]) {
            return String.fromCharCode("a".charCodeAt(0) + i);
        }
    }
    return "";
}

// =============================================================================
// Item stacking
// =============================================================================

/**
 * Merge attributes from an old item into a new item during stacking.
 * Propagates flags, keeps higher enchantment and lower strength requirement.
 *
 * C: conflateItemCharacteristics(item *newItem, item *oldItem)
 */
export function conflateItemCharacteristics(newItem: Item, oldItem: Item): void {
    // Let magic detection and other flags propagate to the new stack
    newItem.flags |= (oldItem.flags & (
        ItemFlag.ITEM_MAGIC_DETECTED
        | ItemFlag.ITEM_IDENTIFIED
        | ItemFlag.ITEM_PROTECTED
        | ItemFlag.ITEM_RUNIC
        | ItemFlag.ITEM_RUNIC_HINTED
        | ItemFlag.ITEM_CAN_BE_IDENTIFIED
        | ItemFlag.ITEM_MAX_CHARGES_KNOWN
    ));

    // Keep the higher enchantment and lower strength requirement
    if (oldItem.enchant1 > newItem.enchant1) {
        newItem.enchant1 = oldItem.enchant1;
    }
    if (oldItem.strengthRequired < newItem.strengthRequired) {
        newItem.strengthRequired = oldItem.strengthRequired;
    }

    // Keep track of origin depth only if every item in the stack has the same
    if (oldItem.originDepth <= 0 || newItem.originDepth !== oldItem.originDepth) {
        newItem.originDepth = 0;
    }
}

/**
 * Stack an old item into a new item: increment quantity, merge attributes.
 *
 * C: stackItems(item *newItem, item *oldItem)
 */
export function stackItems(newItem: Item, oldItem: Item): void {
    newItem.quantity += oldItem.quantity;
    conflateItemCharacteristics(newItem, oldItem);
    // In C, deleteItem(oldItem) frees memory. In TS, the caller is responsible
    // for removing oldItem from whatever array it's in.
}

/**
 * Check whether an item will stack with something already in the pack
 * (i.e., won't consume an extra inventory slot). This is true for:
 * - Gems from the same origin depth
 * - Items with a matching quiver number
 *
 * Note: Food, potions, and scrolls DO stack (merged quantity), but each
 * kind still occupies a pack slot, so this function returns false for them.
 * The name is a bit misleading — see original C comment.
 *
 * C: itemWillStackWithPack(item *theItem)
 */
export function itemWillStackWithPack(theItem: Item, packItems: Item[]): boolean {
    if (theItem.category & ItemCategory.GEM) {
        for (const temp of packItems) {
            if ((temp.category & ItemCategory.GEM) && theItem.originDepth === temp.originDepth) {
                return true;
            }
        }
        return false;
    }

    if (!theItem.quiverNumber) {
        return false;
    }

    for (const temp of packItems) {
        if (temp.quiverNumber === theItem.quiverNumber) {
            return true;
        }
    }
    return false;
}

/**
 * Add an item to the player's pack. Handles stacking for stackable categories
 * (FOOD, POTION, SCROLL, GEM) and quivered weapons. Assigns an inventory
 * letter if needed. Items are inserted in category-sorted order.
 *
 * Returns the item in the pack (which may be the existing stack target if
 * the item was merged into it).
 *
 * C: addItemToPack(item *theItem)
 */
export function addItemToPack(theItem: Item, packItems: Item[]): Item {
    // Can the item stack with another in the inventory?
    if (theItem.category & (ItemCategory.FOOD | ItemCategory.POTION | ItemCategory.SCROLL | ItemCategory.GEM)) {
        for (const existing of packItems) {
            if (
                theItem.category === existing.category
                && theItem.kind === existing.kind
                && (!(theItem.category & ItemCategory.GEM) || theItem.originDepth === existing.originDepth)
            ) {
                // Found a match — stack into the existing item
                stackItems(existing, theItem);
                return existing;
            }
        }
    } else if ((theItem.category & ItemCategory.WEAPON) && theItem.quiverNumber > 0) {
        for (const existing of packItems) {
            if (
                theItem.category === existing.category
                && theItem.kind === existing.kind
                && theItem.quiverNumber === existing.quiverNumber
            ) {
                stackItems(existing, theItem);
                return existing;
            }
        }
    }

    // Assign a reference letter to the item
    if (!inventoryLetterAvailable(theItem.inventoryLetter, packItems)) {
        const letter = nextAvailableInventoryCharacter(packItems);
        if (letter) {
            theItem.inventoryLetter = letter;
        }
    }

    // Insert at proper place in pack chain (sorted by category)
    let insertIdx = 0;
    while (insertIdx < packItems.length && packItems[insertIdx].category <= theItem.category) {
        insertIdx++;
    }
    packItems.splice(insertIdx, 0, theItem);

    return theItem;
}

// =============================================================================
// Item classification helpers
// =============================================================================

/**
 * Check if an item is "swappable" — equippable items that aren't quivered.
 *
 * C: itemIsSwappable(const item *theItem)
 */
export function itemIsSwappable(theItem: Item): boolean {
    return !!(theItem.category & CAN_BE_SWAPPED) && theItem.quiverNumber === 0;
}

/**
 * Check if a weapon/armor should lose its runic due to negative enchantment.
 * Returns true if the runic was removed.
 *
 * C: checkForDisenchantment(item *theItem)
 */
export function checkForDisenchantment(
    theItem: Item,
    numberGoodWeaponEnchantKinds: number,
    numberGoodArmorEnchantKinds: number,
): boolean {
    if (
        (theItem.flags & ItemFlag.ITEM_RUNIC)
        && (
            ((theItem.category & ItemCategory.WEAPON) && theItem.enchant2 < numberGoodWeaponEnchantKinds)
            || ((theItem.category & ItemCategory.ARMOR) && theItem.enchant2 < numberGoodArmorEnchantKinds)
        )
        && theItem.enchant1 <= 0
    ) {
        theItem.enchant2 = 0;
        theItem.flags &= ~(ItemFlag.ITEM_RUNIC | ItemFlag.ITEM_RUNIC_HINTED | ItemFlag.ITEM_RUNIC_IDENTIFIED);
        return true;
    }
    if ((theItem.flags & ItemFlag.ITEM_CURSED) && theItem.enchant1 >= 0) {
        theItem.flags &= ~ItemFlag.ITEM_CURSED;
    }
    return false;
}

/**
 * Whether picking up this item is possible (pack has room, or item will stack).
 *
 * C: inlined in pickUpItemAt()
 */
export function canPickUpItem(theItem: Item, packItems: Item[]): boolean {
    return (
        numberOfItemsInPack(packItems) < MAX_PACK_ITEMS
        || !!(theItem.category & ItemCategory.GOLD)
        || itemWillStackWithPack(theItem, packItems)
    );
}
