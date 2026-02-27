/*
 *  item-naming.ts — Item naming, identification & flavor text
 *  brogue-ts
 *
 *  Ported from Items.c: itemName, itemKindName, itemRunicName,
 *  identify, identifyItemKind, shuffleFlavors, isVowelish, itemValue,
 *  tableForItemCategory (already in item-generation), etc.
 */

import type { Item, ItemTable, GameConstants } from "../types/types.js";
import {
    ItemCategory, HAS_INTRINSIC_POLARITY,
    FoodKind,
    WeaponKind, WeaponEnchant, ArmorKind, ArmorEnchant,
    StaffKind, RingKind,
} from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import {
    NUMBER_ITEM_TITLES, NUMBER_ITEM_COLORS, NUMBER_TITLE_PHONEMES,
    NUMBER_ITEM_WOODS, NUMBER_ITEM_METALS, NUMBER_ITEM_GEMS,
} from "../types/constants.js";
import { Fl } from "../types/flags.js";
import {
    titlePhonemes,
    itemColorsRef, itemWoodsRef, itemMetalsRef, itemGemsRef,
    weaponRunicNames, armorRunicNames,
} from "../globals/string-tables.js";
import {
    foodTable, weaponTable, armorTable,
    potionTable, scrollTable,
    ringTable, wandTable, staffTable, charmTable,
    keyTable,
} from "../globals/item-catalog.js";
import { getTableForCategory as getTableReadonly } from "./item-generation.js";

/**
 * Mutable version of getTableForCategory for identification functions
 * that need to write to table entries.
 */
function getTableForCategory(category: number): ItemTable[] | null {
    return getTableReadonly(category) as ItemTable[] | null;
}

// =============================================================================
// Constants
// =============================================================================

const MAGIC_POLARITY_BENEVOLENT = 1;
const MAGIC_POLARITY_MALEVOLENT = -1;
const MAGIC_POLARITY_ANY = 0;
const NUMBER_ITEM_CATEGORIES = 13;

// =============================================================================
// Mutable flavor arrays — shuffled per game
// =============================================================================

/** Shuffled copy of itemColorsRef (for potion flavors). */
export const itemColors: string[] = [...itemColorsRef];

/** Shuffled copy of itemWoodsRef (for staff flavors). */
export const itemWoods: string[] = [...itemWoodsRef];

/** Shuffled copy of itemMetalsRef (for wand flavors). */
export const itemMetals: string[] = [...itemMetalsRef];

/** Shuffled copy of itemGemsRef (for ring flavors). */
export const itemGems: string[] = [...itemGemsRef];

/** Generated scroll titles (random phoneme combinations). */
export const itemTitles: string[] = new Array<string>(NUMBER_ITEM_TITLES).fill("");

// =============================================================================
// Context for naming functions that need external state
// =============================================================================

export interface ItemNamingContext {
    gameConstants: GameConstants;
    depthLevel: number;
    /** For item naming functions that look up identification state */
    potionTable: ItemTable[];
    scrollTable: ItemTable[];
    wandTable: ItemTable[];
    staffTable: ItemTable[];
    ringTable: ItemTable[];
    charmTable: ItemTable[];
    /** Charm recharge delay calculation */
    charmRechargeDelay?(charmKind: number, enchant: number): number;
    /** Whether the player is in omniscient playback mode */
    playbackOmniscience?: boolean;
    /** Monster class catalog for vorpal enemy name lookup */
    monsterClassName?(classId: number): string;
}

// =============================================================================
// Vowel detection
// =============================================================================

/**
 * Determine if a word starts with a vowel sound for a/an article selection.
 * Handles special cases: "uni..." → not vowelish, "eu..." → not vowelish.
 *
 * C: isVowelish(char *theChar)
 */
export function isVowelish(word: string): boolean {
    // In C, color escape sequences are skipped. We don't use those in TS.
    const upper = word.toUpperCase();
    if (upper.startsWith("UNI") || upper.startsWith("EU")) {
        return false;
    }
    const first = upper[0];
    return first === "A" || first === "E" || first === "I" || first === "O" || first === "U";
}

// =============================================================================
// Item kind name (simple name without details)
// =============================================================================

/**
 * Get the plain kind name for an item (e.g., "broadsword", "potion of healing").
 *
 * C: itemKindName(item *theItem, char *kindName)
 */
export function itemKindName(theItem: Item): string {
    const table = getTableForCategory(theItem.category);
    if (table) {
        return table[theItem.kind].name;
    }
    switch (theItem.category) {
        case ItemCategory.KEY:
            return keyTable[theItem.kind].name;
        case ItemCategory.GOLD:
            return "gold pieces";
        case ItemCategory.AMULET:
            return "amulet of yendor";
        case ItemCategory.GEM:
            return "lumenstone";
        default:
            return "unknown";
    }
}

// =============================================================================
// Item runic name
// =============================================================================

/**
 * Get the runic name for a weapon or armor (e.g., "speed", "multiplicity").
 *
 * C: itemRunicName(item *theItem, char *runicName)
 */
export function itemRunicName(theItem: Item, monsterClassName?: (classId: number) => string): string {
    if (!(theItem.flags & ItemFlag.ITEM_RUNIC)) return "";

    let vorpalPrefix = "";
    if (
        (theItem.category === ItemCategory.ARMOR && theItem.enchant2 === ArmorEnchant.Immunity)
        || (theItem.category === ItemCategory.WEAPON && theItem.enchant2 === WeaponEnchant.Slaying)
    ) {
        if (monsterClassName) {
            vorpalPrefix = monsterClassName(theItem.vorpalEnemy) + " ";
        }
    }

    if (theItem.category === ItemCategory.WEAPON) {
        return vorpalPrefix + (weaponRunicNames[theItem.enchant2] ?? "");
    }
    if (theItem.category === ItemCategory.ARMOR) {
        return vorpalPrefix + (armorRunicNames[theItem.enchant2] ?? "");
    }
    return "";
}

// =============================================================================
// Item naming (full name generation)
// =============================================================================

/**
 * Generate the display name for an item.
 *
 * @param theItem         The item to name
 * @param includeDetails  Include enchantment, charges, strength, etc.
 * @param includeArticle  Include article (a/an/the/number)
 * @param ctx             Naming context with table state and game constants
 * @returns The formatted item name
 *
 * C: itemName(item *theItem, char *root, boolean includeDetails, boolean includeArticle, const color *baseColor)
 * Note: Color escape sequences are omitted in this TS port.
 */
export function itemName(
    theItem: Item,
    includeDetails: boolean,
    includeArticle: boolean,
    ctx: ItemNamingContext,
): string {
    const plural = theItem.quantity > 1 ? "s" : "";
    let root = "";
    let article = "";
    const omniscient = ctx.playbackOmniscience ?? false;

    switch (theItem.category) {
        case ItemCategory.FOOD:
            if (theItem.kind === FoodKind.Fruit) {
                root = `mango${plural}`;
            } else {
                if (theItem.quantity === 1) {
                    article = "some ";
                    root = "food";
                } else {
                    root = `ration${plural} of food`;
                }
            }
            break;

        case ItemCategory.WEAPON:
            root = `${weaponTable[theItem.kind].name}${plural}`;
            if (includeDetails) {
                if ((theItem.flags & ItemFlag.ITEM_IDENTIFIED) || omniscient) {
                    root = `${theItem.enchant1 < 0 ? "" : "+"}${theItem.enchant1} ${root}`;
                }
                if (theItem.flags & ItemFlag.ITEM_RUNIC) {
                    if ((theItem.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) || omniscient) {
                        const runic = itemRunicName(theItem, ctx.monsterClassName);
                        root = `${root} of ${runic}`;
                    } else if (theItem.flags & (ItemFlag.ITEM_IDENTIFIED | ItemFlag.ITEM_RUNIC_HINTED)) {
                        root += " (unknown runic)";
                    }
                }
                root = `${root} <${theItem.strengthRequired}>`;
            }
            break;

        case ItemCategory.ARMOR:
            root = armorTable[theItem.kind].name;
            if (includeDetails) {
                if ((theItem.flags & ItemFlag.ITEM_RUNIC)
                    && ((theItem.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) || omniscient)) {
                    const runic = itemRunicName(theItem, ctx.monsterClassName);
                    root = `${root} of ${runic}`;
                }
                if ((theItem.flags & ItemFlag.ITEM_IDENTIFIED) || omniscient) {
                    root = `${theItem.enchant1 < 0 ? "" : "+"}${theItem.enchant1} ${root} [${Math.floor(theItem.armor / 10) + theItem.enchant1}]<${theItem.strengthRequired}>`;
                } else {
                    root = `${root} <${theItem.strengthRequired}>`;
                }
                if ((theItem.flags & ItemFlag.ITEM_RUNIC)
                    && (theItem.flags & (ItemFlag.ITEM_IDENTIFIED | ItemFlag.ITEM_RUNIC_HINTED))
                    && !(theItem.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED)
                    && !omniscient) {
                    root += " (unknown runic)";
                }
            }
            break;

        case ItemCategory.SCROLL:
            if (ctx.scrollTable[theItem.kind].identified || omniscient) {
                root = `scroll${plural} of ${ctx.scrollTable[theItem.kind].name}`;
            } else if (ctx.scrollTable[theItem.kind].called) {
                root = `scroll${plural} called ${ctx.scrollTable[theItem.kind].callTitle}`;
            } else {
                root = `scroll${plural} entitled "${ctx.scrollTable[theItem.kind].flavor}"`;
            }
            break;

        case ItemCategory.POTION:
            if (ctx.potionTable[theItem.kind].identified || omniscient) {
                root = `potion${plural} of ${ctx.potionTable[theItem.kind].name}`;
            } else if (ctx.potionTable[theItem.kind].called) {
                root = `potion${plural} called ${ctx.potionTable[theItem.kind].callTitle}`;
            } else {
                root = `${ctx.potionTable[theItem.kind].flavor} potion${plural}`;
            }
            break;

        case ItemCategory.WAND:
            if (ctx.wandTable[theItem.kind].identified || omniscient) {
                root = `wand${plural} of ${ctx.wandTable[theItem.kind].name}`;
            } else if (ctx.wandTable[theItem.kind].called) {
                root = `wand${plural} called ${ctx.wandTable[theItem.kind].callTitle}`;
            } else {
                root = `${ctx.wandTable[theItem.kind].flavor} wand${plural}`;
            }
            if (includeDetails) {
                if ((theItem.flags & (ItemFlag.ITEM_IDENTIFIED | ItemFlag.ITEM_MAX_CHARGES_KNOWN)) || omniscient) {
                    root = `${root} [${theItem.charges}]`;
                } else if (theItem.enchant2 > 2) {
                    root = `${root} (used ${theItem.enchant2} times)`;
                } else if (theItem.enchant2) {
                    root = `${root} (used ${theItem.enchant2 === 2 ? "twice" : "once"})`;
                }
            }
            break;

        case ItemCategory.STAFF:
            if (ctx.staffTable[theItem.kind].identified || omniscient) {
                root = `staff${plural} of ${ctx.staffTable[theItem.kind].name}`;
            } else if (ctx.staffTable[theItem.kind].called) {
                root = `staff${plural} called ${ctx.staffTable[theItem.kind].callTitle}`;
            } else {
                root = `${ctx.staffTable[theItem.kind].flavor} staff${plural}`;
            }
            if (includeDetails) {
                if ((theItem.flags & ItemFlag.ITEM_IDENTIFIED) || omniscient) {
                    root = `${root} [${theItem.charges}/${theItem.enchant1}]`;
                } else if (theItem.flags & ItemFlag.ITEM_MAX_CHARGES_KNOWN) {
                    root = `${root} [?/${theItem.enchant1}]`;
                }
            }
            break;

        case ItemCategory.RING:
            if (ctx.ringTable[theItem.kind].identified || omniscient) {
                root = `ring${plural} of ${ctx.ringTable[theItem.kind].name}`;
            } else if (ctx.ringTable[theItem.kind].called) {
                root = `ring${plural} called ${ctx.ringTable[theItem.kind].callTitle}`;
            } else {
                root = `${ctx.ringTable[theItem.kind].flavor} ring${plural}`;
            }
            if (includeDetails && ((theItem.flags & ItemFlag.ITEM_IDENTIFIED) || omniscient)) {
                root = `${theItem.enchant1 < 0 ? "" : "+"}${theItem.enchant1} ${root}`;
            }
            break;

        case ItemCategory.CHARM:
            root = `${ctx.charmTable[theItem.kind].name} charm${plural}`;
            if (includeDetails) {
                root = `${theItem.enchant1 < 0 ? "" : "+"}${theItem.enchant1} ${root}`;
                if (theItem.charges && ctx.charmRechargeDelay) {
                    const delay = ctx.charmRechargeDelay(theItem.kind, theItem.enchant1);
                    const pct = Math.floor((delay - theItem.charges) * 100 / delay);
                    root = `${root} (${pct}%)`;
                } else {
                    root += " (ready)";
                }
            }
            break;

        case ItemCategory.GOLD:
            root = `gold piece${plural}`;
            break;

        case ItemCategory.AMULET:
            root = `Amulet${plural} of Yendor`;
            break;

        case ItemCategory.GEM:
            root = `lumenstone${plural} from depth ${theItem.originDepth}`;
            break;

        case ItemCategory.KEY:
            if (includeDetails && theItem.originDepth > 0 && theItem.originDepth !== ctx.depthLevel) {
                root = `${keyTable[theItem.kind].name}${plural} from depth ${theItem.originDepth}`;
            } else {
                root = `${keyTable[theItem.kind].name}${plural}`;
            }
            break;

        default:
            root = `unknown item${plural}`;
            break;
    }

    // Article
    if (includeArticle) {
        if (theItem.quantity > 1) {
            article = `${theItem.quantity} `;
        } else if (theItem.category & ItemCategory.AMULET) {
            article = "the ";
        } else if (
            !(theItem.category & ItemCategory.ARMOR)
            && !(theItem.category === ItemCategory.FOOD && theItem.kind === FoodKind.Ration)
        ) {
            // Armor gets no article; "some food" was handled above
            article = article || `a${isVowelish(root) ? "n" : ""} `;
        }
    }

    let result = article ? `${article}${root}` : root;

    // Inscription
    if (includeDetails && theItem.inscription) {
        result = `${result} "${theItem.inscription}"`;
    }

    return result;
}

// =============================================================================
// Identification
// =============================================================================

/**
 * Count the number of item kinds with a given polarity (or all if polarityConstraint == 0).
 *
 * C: itemKindCount(enum itemCategory category, int polarityConstraint)
 */
export function itemKindCount(
    category: number,
    polarityConstraint: number,
    gc: GameConstants,
): number {
    let totalKinds = 0;
    let goodKinds = 0;

    switch (category) {
        case ItemCategory.SCROLL:
            totalKinds = gc.numberScrollKinds;
            goodKinds = gc.numberGoodScrollKinds;
            break;
        case ItemCategory.POTION:
            totalKinds = gc.numberPotionKinds;
            goodKinds = gc.numberGoodPotionKinds;
            break;
        case ItemCategory.WAND:
            totalKinds = gc.numberWandKinds;
            goodKinds = gc.numberGoodWandKinds;
            break;
        case ItemCategory.STAFF:
            totalKinds = StaffKind.NumberStaffKinds;
            goodKinds = StaffKind.NumberGoodStaffKinds;
            break;
        case ItemCategory.FOOD:
            totalKinds = FoodKind.NumberFoodKinds;
            goodKinds = 0;
            break;
        case ItemCategory.WEAPON:
            totalKinds = WeaponKind.NumberWeaponKinds;
            goodKinds = 0;
            break;
        case ItemCategory.ARMOR:
            totalKinds = ArmorKind.NumberArmorKinds;
            goodKinds = 0;
            break;
        case ItemCategory.RING:
            totalKinds = RingKind.NumberRingKinds;
            goodKinds = RingKind.NumberRingKinds;
            break;
        case ItemCategory.CHARM:
            totalKinds = gc.numberCharmKinds;
            goodKinds = gc.numberCharmKinds;
            break;
        default:
            return -1;
    }

    if (polarityConstraint === MAGIC_POLARITY_BENEVOLENT) return goodKinds;
    if (polarityConstraint === MAGIC_POLARITY_MALEVOLENT) return totalKinds - goodKinds;
    return totalKinds;
}

/**
 * Try to find the last unidentified item kind in a category (with optional polarity).
 * Returns the kind index or -1 if none or multiple remain.
 *
 * C: tryGetLastUnidentifiedItemKind(category, polarityConstraint)
 */
export function tryGetLastUnidentifiedItemKind(
    category: number,
    polarityConstraint: number,
    gc: GameConstants,
): number {
    const table = getTableForCategory(category);
    const totalKinds = itemKindCount(category, MAGIC_POLARITY_ANY, gc);

    if (!table || totalKinds <= 0) return -1;

    let lastKind = -1;
    for (let i = 0; i < totalKinds; i++) {
        if (
            !table[i].identified
            && (table[i].magicPolarity === polarityConstraint || polarityConstraint === MAGIC_POLARITY_ANY)
        ) {
            if (lastKind !== -1) {
                return -1; // At least two unidentified items remain
            }
            lastKind = i;
        }
    }
    return lastKind;
}

/**
 * Count items where the magic polarity has been revealed for a category.
 *
 * C: magicPolarityRevealedItemKindCount(category, polarityConstraint)
 */
export function magicPolarityRevealedItemKindCount(
    category: number,
    polarityConstraint: number,
    gc: GameConstants,
): number {
    const table = getTableForCategory(category);
    const totalKinds = itemKindCount(category, MAGIC_POLARITY_ANY, gc);

    if (!table || totalKinds <= 0 || !polarityConstraint) return -1;

    let count = 0;
    for (let i = 0; i < totalKinds; i++) {
        if (
            table[i].magicPolarity === polarityConstraint
            && (table[i].identified || table[i].magicPolarityRevealed)
        ) {
            count++;
        }
    }
    return count;
}

/**
 * Try to identify the last item kind in a given category with a polarity constraint.
 *
 * C: tryIdentifyLastItemKind(category, polarityConstraint)
 */
export function tryIdentifyLastItemKind(
    category: number,
    polarityConstraint: number,
    gc: GameConstants,
): void {
    const table = getTableForCategory(category);
    if (!table) return;

    const lastKind = tryGetLastUnidentifiedItemKind(category, polarityConstraint, gc);

    if (lastKind >= 0) {
        if (polarityConstraint === MAGIC_POLARITY_ANY) {
            table[lastKind].identified = true;
        } else {
            const oppositePol = polarityConstraint * -1;
            const oppositeRevealed = magicPolarityRevealedItemKindCount(category, oppositePol, gc);
            const oppositeCount = itemKindCount(category, oppositePol, gc);
            if (table[lastKind].magicPolarityRevealed || oppositeRevealed === oppositeCount) {
                table[lastKind].identified = true;
            }
        }
    }
}

/**
 * Try to identify the last item of the given category or all polarized categories.
 *
 * C: tryIdentifyLastItemKinds(category)
 */
export function tryIdentifyLastItemKinds(category: number, gc: GameConstants): void {
    let categoryCount = 1;

    if (category === HAS_INTRINSIC_POLARITY) {
        categoryCount = NUMBER_ITEM_CATEGORIES;
    }

    for (let i = 0; i < categoryCount; i++) {
        const loopCat = categoryCount === 1 ? category : Fl(i);
        if (category & HAS_INTRINSIC_POLARITY & loopCat) {
            tryIdentifyLastItemKind(loopCat, MAGIC_POLARITY_BENEVOLENT, gc);
            tryIdentifyLastItemKind(loopCat, MAGIC_POLARITY_MALEVOLENT, gc);
        }
    }
}

/**
 * Identify an item's kind — marks the item table entry as identified,
 * and triggers last-kind deduction.
 *
 * C: identifyItemKind(item *theItem)
 * Note: Does NOT call updateRingBonuses() — that's a gameplay effect
 * handled by the caller.
 */
export function identifyItemKind(theItem: Item, gc: GameConstants): void {
    const table = getTableForCategory(theItem.category);
    if (!table) return;

    theItem.flags &= ~ItemFlag.ITEM_KIND_AUTO_ID;

    let tableCount = 0;
    switch (theItem.category) {
        case ItemCategory.SCROLL: tableCount = gc.numberScrollKinds; break;
        case ItemCategory.POTION: tableCount = gc.numberPotionKinds; break;
        case ItemCategory.WAND: tableCount = gc.numberWandKinds; break;
        case ItemCategory.STAFF: tableCount = StaffKind.NumberStaffKinds; break;
        case ItemCategory.RING: tableCount = RingKind.NumberRingKinds; break;
        default: break;
    }

    // Rings with non-positive enchantment are auto-identified
    if ((theItem.category & ItemCategory.RING) && theItem.enchant1 <= 0) {
        theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
    }

    // Wands with fixed charges (lowerBound == upperBound) are auto-identified
    if ((theItem.category & ItemCategory.WAND) && table[theItem.kind].range) {
        const r = table[theItem.kind].range!;
        if (r.lowerBound === r.upperBound) {
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
        }
    }

    if (tableCount) {
        table[theItem.kind].identified = true;
        tryIdentifyLastItemKinds(theItem.category, gc);
    }
}

/**
 * Fully identify an item — sets identified flag, reveals runic, identifies kind.
 *
 * C: identify(item *theItem)
 * Note: Does NOT call updateRingBonuses() — that's handled by the caller.
 */
export function identify(theItem: Item, gc: GameConstants): void {
    theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
    theItem.flags &= ~ItemFlag.ITEM_CAN_BE_IDENTIFIED;
    if (theItem.flags & ItemFlag.ITEM_RUNIC) {
        theItem.flags |= (ItemFlag.ITEM_RUNIC_IDENTIFIED | ItemFlag.ITEM_RUNIC_HINTED);
    }
    identifyItemKind(theItem, gc);
}

// =============================================================================
// Table reset & flavor shuffling
// =============================================================================

/**
 * Reset an item table entry's identification state.
 *
 * C: resetItemTableEntry(itemTable *theEntry)
 */
export function resetItemTableEntry(entry: ItemTable): void {
    entry.identified = false;
    entry.magicPolarityRevealed = false;
    entry.called = false;
    entry.callTitle = "";
}

/**
 * Shuffle the flavor arrays and generate scroll titles. Call once at game start.
 * Uses the provided RNG to ensure determinism.
 *
 * C: shuffleFlavors()
 */
export function shuffleFlavors(
    gc: GameConstants,
    randRange: (lo: number, hi: number) => number,
    randPercent: (pct: number) => boolean,
): void {
    // Reset item table identification state
    for (let i = 0; i < gc.numberPotionKinds; i++) resetItemTableEntry(potionTable[i]);
    for (let i = 0; i < StaffKind.NumberStaffKinds; i++) resetItemTableEntry(staffTable[i]);
    for (let i = 0; i < gc.numberWandKinds; i++) resetItemTableEntry(wandTable[i]);
    for (let i = 0; i < gc.numberScrollKinds; i++) resetItemTableEntry(scrollTable[i]);
    for (let i = 0; i < RingKind.NumberRingKinds; i++) resetItemTableEntry(ringTable[i]);

    // Shuffle flavor arrays using Fisher-Yates-ish shuffle (matches C behavior)
    const shuffleArray = (arr: string[], len: number, ref: readonly string[]): void => {
        for (let i = 0; i < len; i++) arr[i] = ref[i];
        for (let i = 0; i < len; i++) {
            const r = randRange(0, len - 1);
            if (r !== i) {
                const tmp = arr[i];
                arr[i] = arr[r];
                arr[r] = tmp;
            }
        }
    };

    shuffleArray(itemColors, NUMBER_ITEM_COLORS, itemColorsRef);
    shuffleArray(itemWoods, NUMBER_ITEM_WOODS, itemWoodsRef);
    shuffleArray(itemGems, NUMBER_ITEM_GEMS, itemGemsRef);
    shuffleArray(itemMetals, NUMBER_ITEM_METALS, itemMetalsRef);

    // Generate scroll titles from random phoneme combinations
    for (let i = 0; i < NUMBER_ITEM_TITLES; i++) {
        itemTitles[i] = "";
        const numPhonemes = randRange(3, 4);
        for (let j = 0; j < numPhonemes; j++) {
            const phonemeIdx = randRange(0, NUMBER_TITLE_PHONEMES - 1);
            const separator = (randPercent(50) && j > 0) ? " " : "";
            itemTitles[i] += separator + titlePhonemes[phonemeIdx];
        }
    }
}

// =============================================================================
// Item value
// =============================================================================

/**
 * Get the gold value of an item (used for scoring).
 *
 * C: itemValue(item *theItem)
 */
export function itemValue(theItem: Item): number {
    switch (theItem.category) {
        case ItemCategory.AMULET: return 35000;
        case ItemCategory.GEM: return 5000 * theItem.quantity;
        default: return 0;
    }
}

/**
 * Check if an item is carried in the pack.
 *
 * C: itemIsCarried(item *theItem)
 */
export function itemIsCarried(theItem: Item, packItems: Item[]): boolean {
    return packItems.includes(theItem);
}
