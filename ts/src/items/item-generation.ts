/*
 *  item-generation.ts — Item creation and generation
 *  brogue-ts
 *
 *  Ported from: src/brogue/Items.c
 *  Functions: initializeItem, generateItem, pickItemCategory,
 *             chooseKind, makeItemInto, getItemCategoryGlyph,
 *             itemIsThrowingWeapon, itemIsHeavyWeapon,
 *             itemIsPositivelyEnchanted, itemMagicPolarity
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, ItemTable, GameConstants } from "../types/types.js";
import type { Color } from "../types/types.js";
import {
    DisplayGlyph,
    ItemCategory,
    ALL_ITEMS,
    WeaponKind,
    ArmorKind,
    StaffKind,
    ArmorEnchant,
    MonsterType,
} from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import {
    NUMBER_GOOD_WEAPON_ENCHANT_KINDS,
    NUMBER_WEAPON_RUNIC_KINDS,
    KEY_ID_MAXIMUM,
} from "../types/constants.js";
import { itemColor, white } from "../globals/colors.js";
import {
    keyTable,
    foodTable,
    weaponTable,
    armorTable,
    staffTable,
    ringTable,
    potionTable,
    scrollTable,
    wandTable,
    charmTable,
    itemGenerationProbabilities,
} from "../globals/item-catalog.js";

// =============================================================================
// DI context — external dependencies injected for testability
// =============================================================================

/**
 * RNG functions required by item generation.
 * In production these come from `math/rng.ts`.
 */
export interface ItemRNG {
    randRange(lo: number, hi: number): number;
    randPercent(pct: number): boolean;
    randClump(range: { lowerBound: number; upperBound: number; clumpFactor: number }): number;
}

/**
 * Minimal context required for item generation.
 */
export interface ItemGenContext {
    rng: ItemRNG;
    gameConstants: GameConstants;
    /** Current depth level (rogue.depthLevel). */
    depthLevel: number;
    /** Mutable scroll table copy used during level generation. */
    scrollTable: ItemTable[];
    /** Mutable potion table copy used during level generation. */
    potionTable: ItemTable[];
    /** Depth accelerator multiplier for gold quantity calculation. */
    depthAccelerator: number;
    /** Callback to choose a vorpal enemy type (for slaying/immunity runics). */
    chooseVorpalEnemy(): MonsterType;
}

// =============================================================================
// Display glyph for item categories
// =============================================================================

const ITEM_CATEGORY_ORDER: readonly number[] = [
    ItemCategory.FOOD,
    ItemCategory.WEAPON,
    ItemCategory.ARMOR,
    ItemCategory.SCROLL,
    ItemCategory.POTION,
    ItemCategory.STAFF,
    ItemCategory.WAND,
    ItemCategory.GEM,
    ItemCategory.RING,
    ItemCategory.CHARM,
    ItemCategory.KEY,
    ItemCategory.GOLD,
    ItemCategory.AMULET,
];

const ITEM_CATEGORY_GLYPH_MAP: ReadonlyMap<number, DisplayGlyph> = new Map([
    [ItemCategory.FOOD, DisplayGlyph.G_FOOD],
    [ItemCategory.WEAPON, DisplayGlyph.G_WEAPON],
    [ItemCategory.ARMOR, DisplayGlyph.G_ARMOR],
    [ItemCategory.SCROLL, DisplayGlyph.G_SCROLL],
    [ItemCategory.POTION, DisplayGlyph.G_POTION],
    [ItemCategory.STAFF, DisplayGlyph.G_STAFF],
    [ItemCategory.WAND, DisplayGlyph.G_WAND],
    [ItemCategory.GEM, DisplayGlyph.G_GEM],
    [ItemCategory.RING, DisplayGlyph.G_RING],
    [ItemCategory.CHARM, DisplayGlyph.G_CHARM],
    [ItemCategory.KEY, DisplayGlyph.G_KEY],
    [ItemCategory.GOLD, DisplayGlyph.G_GOLD],
    [ItemCategory.AMULET, DisplayGlyph.G_AMULET],
]);

/**
 * Gets the display glyph for the given item category.
 * Corresponds to C `getItemCategoryGlyph`.
 */
export function getItemCategoryGlyph(category: number): DisplayGlyph {
    return ITEM_CATEGORY_GLYPH_MAP.get(category) ?? 0;
}

// =============================================================================
// Item table lookup
// =============================================================================

/**
 * The category order used by `pickItemCategory` and `itemGenerationProbabilities`.
 * Maps index position to ItemCategory bitmask.
 * Order: GOLD, SCROLL, POTION, STAFF, WAND, WEAPON, ARMOR, FOOD, RING, CHARM, AMULET, GEM, KEY
 */
const CORRESPONDING_CATEGORIES: readonly number[] = [
    ItemCategory.GOLD,
    ItemCategory.SCROLL,
    ItemCategory.POTION,
    ItemCategory.STAFF,
    ItemCategory.WAND,
    ItemCategory.WEAPON,
    ItemCategory.ARMOR,
    ItemCategory.FOOD,
    ItemCategory.RING,
    ItemCategory.CHARM,
    ItemCategory.AMULET,
    ItemCategory.GEM,
    ItemCategory.KEY,
];

/**
 * Returns the item table for the given category.
 * Uses mutable scroll/potion tables from the context if provided (for
 * level-generation frequency manipulation).
 */
export function getTableForCategory(
    category: number,
    ctx?: { scrollTable?: ItemTable[]; potionTable?: ItemTable[] },
): readonly ItemTable[] | null {
    switch (category) {
        case ItemCategory.FOOD: return foodTable;
        case ItemCategory.WEAPON: return weaponTable;
        case ItemCategory.ARMOR: return armorTable;
        case ItemCategory.SCROLL: return ctx?.scrollTable ?? scrollTable;
        case ItemCategory.POTION: return ctx?.potionTable ?? potionTable;
        case ItemCategory.STAFF: return staffTable;
        case ItemCategory.WAND: return wandTable;
        case ItemCategory.RING: return ringTable;
        case ItemCategory.CHARM: return charmTable;
        case ItemCategory.KEY: return keyTable;
        default: return null;
    }
}

/**
 * Returns the number of kinds for the given category.
 */
export function getKindCountForCategory(category: number, gc: GameConstants): number {
    switch (category) {
        case ItemCategory.FOOD: return foodTable.length;
        case ItemCategory.WEAPON: return weaponTable.length;
        case ItemCategory.ARMOR: return armorTable.length;
        case ItemCategory.SCROLL: return gc.numberScrollKinds;
        case ItemCategory.POTION: return gc.numberPotionKinds;
        case ItemCategory.STAFF: return staffTable.length;
        case ItemCategory.WAND: return gc.numberWandKinds;
        case ItemCategory.RING: return ringTable.length;
        case ItemCategory.CHARM: return gc.numberCharmKinds;
        case ItemCategory.KEY: return keyTable.length;
        default: return 0;
    }
}

// =============================================================================
// Category & kind selection
// =============================================================================

/**
 * Pick a random item category based on generation probabilities.
 * If `theCategory` is a bitmask, only categories in the mask are considered.
 * Corresponds to C `pickItemCategory`.
 */
export function pickItemCategory(theCategory: number, rng: ItemRNG): number {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
        if (theCategory <= 0 || (theCategory & CORRESPONDING_CATEGORIES[i])) {
            sum += itemGenerationProbabilities[i];
        }
    }
    if (sum === 0) {
        return theCategory; // e.g. AMULET or GEM with no frequency
    }

    let randIndex = rng.randRange(1, sum);
    for (let i = 0; ; i++) {
        if (theCategory <= 0 || (theCategory & CORRESPONDING_CATEGORIES[i])) {
            if (randIndex <= itemGenerationProbabilities[i]) {
                return CORRESPONDING_CATEGORIES[i];
            }
            randIndex -= itemGenerationProbabilities[i];
        }
    }
}

/**
 * Choose a kind based on weighted frequencies in the table.
 * Corresponds to C `chooseKind`.
 */
export function chooseKind(table: readonly ItemTable[], numKinds: number, rng: ItemRNG): number {
    let totalFrequencies = 0;
    for (let i = 0; i < numKinds; i++) {
        totalFrequencies += Math.max(0, table[i].frequency);
    }
    let randomFrequency = rng.randRange(1, totalFrequencies);
    let i = 0;
    for (; randomFrequency > table[i].frequency; i++) {
        randomFrequency -= Math.max(0, table[i].frequency);
    }
    return i;
}

// =============================================================================
// Item creation
// =============================================================================

/**
 * Create a blank item with default values.
 * Corresponds to C `initializeItem`.
 */
export function initializeItem(): Item {
    const keyLoc: Item["keyLoc"] = [];
    for (let i = 0; i < KEY_ID_MAXIMUM; i++) {
        keyLoc.push({ loc: { x: 0, y: 0 }, machine: 0, disposableHere: false });
    }
    return {
        category: 0,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0 as MonsterType,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: DisplayGlyph.G_CLOSED_DOOR, // '&' placeholder — will be set by makeItemInto
        foreColor: itemColor as Color,
        inventoryColor: white as Color,
        quantity: 1,
        inventoryLetter: "",
        inscription: "",
        loc: { x: -1, y: -1 },
        keyLoc,
        originDepth: 0,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
    };
}

/**
 * Configure an existing item to be the given category and kind.
 * Picks random category/kind if the parameters are <= 0 / < 0.
 * Corresponds to C `makeItemInto`.
 */
export function makeItemInto(
    theItem: Item,
    itemCategory: number,
    itemKind: number,
    ctx: ItemGenContext,
): Item {
    const { rng, gameConstants } = ctx;

    if (itemCategory <= 0) {
        itemCategory = ALL_ITEMS;
    }

    itemCategory = pickItemCategory(itemCategory, rng);
    theItem.category = itemCategory;
    theItem.displayChar = getItemCategoryGlyph(theItem.category);

    let theEntry: ItemTable | null = null;

    switch (itemCategory) {
        case ItemCategory.FOOD: {
            if (itemKind < 0) {
                itemKind = chooseKind(foodTable, foodTable.length, rng);
            }
            theEntry = foodTable[itemKind];
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
            break;
        }
        case ItemCategory.WEAPON: {
            if (itemKind < 0) {
                itemKind = chooseKind(weaponTable, weaponTable.length, rng);
            }
            theEntry = weaponTable[itemKind];
            theItem.damage = { ...weaponTable[itemKind].range };
            theItem.strengthRequired = weaponTable[itemKind].strengthRequired;

            // Set weapon-type-specific flags
            switch (itemKind) {
                case WeaponKind.Dagger:
                    theItem.flags |= ItemFlag.ITEM_SNEAK_ATTACK_BONUS;
                    break;
                case WeaponKind.Mace:
                case WeaponKind.Hammer:
                    theItem.flags |= ItemFlag.ITEM_ATTACKS_STAGGER;
                    break;
                case WeaponKind.Whip:
                    theItem.flags |= ItemFlag.ITEM_ATTACKS_EXTEND;
                    break;
                case WeaponKind.Rapier:
                    theItem.flags |= (ItemFlag.ITEM_ATTACKS_QUICKLY | ItemFlag.ITEM_LUNGE_ATTACKS);
                    break;
                case WeaponKind.Flail:
                    theItem.flags |= ItemFlag.ITEM_PASS_ATTACKS;
                    break;
                case WeaponKind.Spear:
                case WeaponKind.Pike:
                    theItem.flags |= ItemFlag.ITEM_ATTACKS_PENETRATE;
                    break;
                case WeaponKind.Axe:
                case WeaponKind.WarAxe:
                    theItem.flags |= ItemFlag.ITEM_ATTACKS_ALL_ADJACENT;
                    break;
            }

            // Random enchantment
            if (rng.randPercent(40)) {
                theItem.enchant1 += rng.randRange(1, 3);
                if (rng.randPercent(50)) {
                    // cursed
                    theItem.enchant1 *= -1;
                    theItem.flags |= ItemFlag.ITEM_CURSED;
                    if (rng.randPercent(33)) {
                        theItem.enchant2 = rng.randRange(
                            NUMBER_GOOD_WEAPON_ENCHANT_KINDS,
                            NUMBER_WEAPON_RUNIC_KINDS - 1,
                        );
                        theItem.flags |= ItemFlag.ITEM_RUNIC;
                    }
                } else if (
                    rng.randRange(3, 10)
                    * ((theItem.flags & ItemFlag.ITEM_ATTACKS_STAGGER) ? 2 : 1)
                    / ((theItem.flags & ItemFlag.ITEM_ATTACKS_QUICKLY) ? 2 : 1)
                    / ((theItem.flags & ItemFlag.ITEM_ATTACKS_EXTEND) ? 2 : 1)
                    > theItem.damage.lowerBound
                ) {
                    // good runic
                    theItem.enchant2 = rng.randRange(0, NUMBER_GOOD_WEAPON_ENCHANT_KINDS - 1);
                    theItem.flags |= ItemFlag.ITEM_RUNIC;
                    if (theItem.enchant2 === 7) { // W_SLAYING
                        theItem.vorpalEnemy = ctx.chooseVorpalEnemy();
                    }
                } else {
                    while (rng.randPercent(10)) {
                        theItem.enchant1++;
                    }
                }
            }

            // Throwing weapons
            if (
                itemKind === WeaponKind.Dart
                || itemKind === WeaponKind.IncendiaryDart
                || itemKind === WeaponKind.Javelin
            ) {
                if (itemKind === WeaponKind.IncendiaryDart) {
                    theItem.quantity = rng.randRange(3, 6);
                } else {
                    theItem.quantity = rng.randRange(5, 18);
                }
                theItem.quiverNumber = rng.randRange(1, 60000);
                theItem.flags &= ~(ItemFlag.ITEM_CURSED | ItemFlag.ITEM_RUNIC);
                theItem.enchant1 = 0;
            }

            theItem.charges = gameConstants.weaponKillsToAutoID;
            break;
        }
        case ItemCategory.ARMOR: {
            if (itemKind < 0) {
                itemKind = chooseKind(armorTable, armorTable.length, rng);
            }
            theEntry = armorTable[itemKind];
            theItem.armor = rng.randClump(armorTable[itemKind].range);
            theItem.strengthRequired = armorTable[itemKind].strengthRequired;
            theItem.charges = gameConstants.armorDelayToAutoID;

            if (rng.randPercent(40)) {
                theItem.enchant1 += rng.randRange(1, 3);
                if (rng.randPercent(50)) {
                    // cursed
                    theItem.enchant1 *= -1;
                    theItem.flags |= ItemFlag.ITEM_CURSED;
                    if (rng.randPercent(33)) {
                        theItem.enchant2 = rng.randRange(
                            ArmorEnchant.NumberGoodArmorEnchantKinds,
                            ArmorEnchant.NumberArmorEnchantKinds - 1,
                        );
                        theItem.flags |= ItemFlag.ITEM_RUNIC;
                    }
                } else if (rng.randRange(0, 95) > theItem.armor) {
                    // good runic
                    theItem.enchant2 = rng.randRange(0, ArmorEnchant.NumberGoodArmorEnchantKinds - 1);
                    theItem.flags |= ItemFlag.ITEM_RUNIC;
                    if (theItem.enchant2 === ArmorEnchant.Immunity) {
                        theItem.vorpalEnemy = ctx.chooseVorpalEnemy();
                    }
                } else {
                    while (rng.randPercent(10)) {
                        theItem.enchant1++;
                    }
                }
            }
            break;
        }
        case ItemCategory.SCROLL: {
            if (itemKind < 0) {
                itemKind = chooseKind(ctx.scrollTable, gameConstants.numberScrollKinds, rng);
            }
            theEntry = ctx.scrollTable[itemKind];
            theItem.flags |= ItemFlag.ITEM_FLAMMABLE;
            break;
        }
        case ItemCategory.POTION: {
            if (itemKind < 0) {
                itemKind = chooseKind(ctx.potionTable, gameConstants.numberPotionKinds, rng);
            }
            theEntry = ctx.potionTable[itemKind];
            break;
        }
        case ItemCategory.STAFF: {
            if (itemKind < 0) {
                itemKind = chooseKind(staffTable, staffTable.length, rng);
            }
            theEntry = staffTable[itemKind];
            theItem.charges = 2;
            if (rng.randPercent(50)) {
                theItem.charges++;
                if (rng.randPercent(15)) {
                    theItem.charges++;
                    while (rng.randPercent(10)) {
                        theItem.charges++;
                    }
                }
            }
            theItem.enchant1 = theItem.charges;
            theItem.enchant2 = (
                itemKind === StaffKind.Blinking || itemKind === StaffKind.Obstruction
            ) ? 1000 : 500;
            break;
        }
        case ItemCategory.WAND: {
            if (itemKind < 0) {
                itemKind = chooseKind(wandTable, gameConstants.numberWandKinds, rng);
            }
            theEntry = wandTable[itemKind];
            theItem.charges = rng.randClump(wandTable[itemKind].range);
            break;
        }
        case ItemCategory.RING: {
            if (itemKind < 0) {
                itemKind = chooseKind(ringTable, ringTable.length, rng);
            }
            theEntry = ringTable[itemKind];
            theItem.enchant1 = rng.randClump(ringTable[itemKind].range);
            theItem.charges = gameConstants.ringDelayToAutoID;
            if (rng.randPercent(16)) {
                theItem.enchant1 *= -1;
                theItem.flags |= ItemFlag.ITEM_CURSED;
            } else {
                while (rng.randPercent(10)) {
                    theItem.enchant1++;
                }
            }
            break;
        }
        case ItemCategory.CHARM: {
            if (itemKind < 0) {
                itemKind = chooseKind(charmTable, gameConstants.numberCharmKinds, rng);
            }
            theItem.charges = 0; // charms start ready
            theItem.enchant1 = rng.randClump(charmTable[itemKind].range);
            while (rng.randPercent(7)) {
                theItem.enchant1++;
            }
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
            break;
        }
        case ItemCategory.GOLD: {
            theEntry = null;
            theItem.quantity = rng.randRange(
                50 + ctx.depthLevel * 10 * ctx.depthAccelerator,
                100 + ctx.depthLevel * 15 * ctx.depthAccelerator,
            );
            break;
        }
        case ItemCategory.AMULET: {
            theEntry = null;
            itemKind = 0;
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
            break;
        }
        case ItemCategory.GEM: {
            theEntry = null;
            itemKind = 0;
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
            break;
        }
        case ItemCategory.KEY: {
            theEntry = null;
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
            break;
        }
    }

    // Mark unidentified items as CAN_BE_IDENTIFIED
    if (
        !(theItem.flags & ItemFlag.ITEM_IDENTIFIED)
        && (
            !(theItem.category & (ItemCategory.POTION | ItemCategory.SCROLL))
            || (theEntry && !theEntry.identified)
        )
    ) {
        theItem.flags |= ItemFlag.ITEM_CAN_BE_IDENTIFIED;
    }

    theItem.kind = itemKind;
    return theItem;
}

/**
 * Allocate and generate a specified item (or random category/kind if -1).
 * The item is NOT placed on the map or inserted into any list.
 * Corresponds to C `generateItem`.
 */
export function generateItem(
    theCategory: number,
    theKind: number,
    ctx: ItemGenContext,
): Item {
    const theItem = initializeItem();
    makeItemInto(theItem, theCategory, theKind, ctx);
    return theItem;
}

// =============================================================================
// Item classification helpers
// =============================================================================

/**
 * Checks if an item is a throwing weapon (dart, javelin, incendiary dart).
 * Corresponds to C `itemIsThrowingWeapon`.
 */
export function itemIsThrowingWeapon(theItem: Item): boolean {
    return (
        theItem.category === ItemCategory.WEAPON
        && (
            theItem.kind === WeaponKind.Dart
            || theItem.kind === WeaponKind.Javelin
            || theItem.kind === WeaponKind.IncendiaryDart
        )
    );
}

/**
 * Checks if an item is a heavy weapon (non-throwing, strength > 15).
 * Corresponds to C `itemIsHeavyWeapon`.
 */
export function itemIsHeavyWeapon(theItem: Item): boolean {
    return (
        theItem.category === ItemCategory.WEAPON
        && !itemIsThrowingWeapon(theItem)
        && weaponTable[theItem.kind].strengthRequired > 15
    );
}

/**
 * Checks if an item has positive enchantment.
 * Corresponds to C `itemIsPositivelyEnchanted`.
 */
export function itemIsPositivelyEnchanted(theItem: Item): boolean {
    return theItem.enchant1 > 0;
}

/**
 * Returns the magic polarity of an item.
 * Corresponds to C `itemMagicPolarity`.
 *
 * For weapons and armor, polarity is based on enchantment value.
 * For other items with tables, polarity comes from the table.
 */
export function itemMagicPolarity(theItem: Item): number {
    switch (theItem.category) {
        case ItemCategory.WEAPON:
        case ItemCategory.ARMOR:
            if (theItem.enchant1 > 0) return 1;
            if (theItem.enchant1 < 0) return -1;
            return 0;
        default: {
            const table = getTableForCategory(theItem.category);
            if (table && theItem.kind < table.length) {
                return table[theItem.kind].magicPolarity;
            }
            return 0;
        }
    }
}

/**
 * Gets a random item category for hallucination display.
 * Corresponds to C `getHallucinatedItemCategory`.
 */
export function getHallucinatedItemCategory(rng: ItemRNG): number {
    const categories = [
        ItemCategory.FOOD,
        ItemCategory.WEAPON,
        ItemCategory.ARMOR,
        ItemCategory.POTION,
        ItemCategory.SCROLL,
        ItemCategory.STAFF,
        ItemCategory.WAND,
        ItemCategory.RING,
        ItemCategory.CHARM,
        ItemCategory.GOLD,
    ];
    return categories[rng.randRange(0, 9)];
}
