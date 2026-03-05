/*
 *  menus/wizard-items.ts — Wizard item creation dialogs
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/wizard.ts (lines 299–770)
 *  Source C: src/brogue/Wizard.c (functions: dialogCreateItemChooseVorpalEnemy,
 *             dialogCreateItemChooseRunic, dialogCreateItemChooseKind,
 *             dialogCreateItemChooseEnchantmentLevel, dialogCreateItem)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item } from "../types/types.js";
import {
    ItemCategory, WeaponKind, WeaponEnchant, ArmorKind, ArmorEnchant,
    TextEntryType, CAN_BE_ENCHANTED, NEVER_IDENTIFIABLE,
} from "../types/enums.js";
import { ItemFlag } from "../types/flags.js";
import {
    MONSTER_CLASS_COUNT, NUMBER_WEAPON_RUNIC_KINDS, NUMBER_GOOD_WEAPON_ENCHANT_KINDS,
    MAX_PACK_ITEMS, NUMBER_ITEM_CATEGORIES,
} from "../types/constants.js";
import type { WizardContext } from "./wizard.js";
import { initializeCreateItemButton, dialogSelectEntryFromList } from "./wizard.js";

// =============================================================================
// dialogCreateItemChooseVorpalEnemy — Wizard.c:91
// =============================================================================

/**
 * Display a dialog to choose a vorpal enemy class. Returns the chosen index,
 * or -1 if canceled.
 *
 * C: `dialogCreateItemChooseVorpalEnemy` in Wizard.c
 */
export async function dialogCreateItemChooseVorpalEnemy(ctx: WizardContext): Promise<number> {
    const buttons = [];

    for (let i = 0; i < MONSTER_CLASS_COUNT; i++) {
        buttons.push(initializeCreateItemButton(ctx.monsterClassCatalog[i].name, ctx));
    }

    return dialogSelectEntryFromList(buttons, buttons.length, "Choose a vorpal enemy:", ctx);
}

// =============================================================================
// dialogCreateItemChooseRunic — Wizard.c:104
// =============================================================================

/**
 * Display a dialog to choose a runic for a weapon or armor.
 * Assigns the runic and vorpal enemy (if applicable) to the item.
 *
 * C: `dialogCreateItemChooseRunic` in Wizard.c
 */
export async function dialogCreateItemChooseRunic(theItem: Item, ctx: WizardContext): Promise<void> {
    if (!(theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR))) {
        return;
    }

    const buttons = [];
    let runicOffset = 0;

    if (theItem.category === ItemCategory.WEAPON) {
        if (
            theItem.kind === WeaponKind.Hammer ||
            theItem.kind === WeaponKind.WarAxe ||
            theItem.kind === WeaponKind.Pike ||
            theItem.kind === WeaponKind.Broadsword
        ) {
            for (let i = 0; i < NUMBER_WEAPON_RUNIC_KINDS - NUMBER_GOOD_WEAPON_ENCHANT_KINDS; i++) {
                buttons.push(
                    initializeCreateItemButton(ctx.weaponRunicNames[i + NUMBER_GOOD_WEAPON_ENCHANT_KINDS], ctx),
                );
            }
            runicOffset = NUMBER_GOOD_WEAPON_ENCHANT_KINDS;
        } else if (theItem.quiverNumber === 0) {
            for (let i = 0; i < NUMBER_WEAPON_RUNIC_KINDS; i++) {
                buttons.push(initializeCreateItemButton(ctx.weaponRunicNames[i], ctx));
            }
        } else {
            return;
        }
    } else if (theItem.category === ItemCategory.ARMOR) {
        if (theItem.kind === ArmorKind.PlateMail) {
            for (
                let i = 0;
                i < ArmorEnchant.NumberArmorEnchantKinds - ArmorEnchant.NumberGoodArmorEnchantKinds;
                i++
            ) {
                buttons.push(
                    initializeCreateItemButton(ctx.armorRunicNames[i + ArmorEnchant.NumberGoodArmorEnchantKinds], ctx),
                );
            }
            runicOffset = ArmorEnchant.NumberGoodArmorEnchantKinds;
        } else {
            for (let i = 0; i < ArmorEnchant.NumberArmorEnchantKinds; i++) {
                buttons.push(initializeCreateItemButton(ctx.armorRunicNames[i], ctx));
            }
        }
    }

    const noRunicIndex = buttons.length;
    buttons.push(initializeCreateItemButton("No Runic", ctx));

    const selectedRunic = await dialogSelectEntryFromList(buttons, buttons.length, "Choose a runic:", ctx);

    if (selectedRunic >= 0 && selectedRunic !== noRunicIndex) {
        theItem.enchant2 = selectedRunic + runicOffset;
        theItem.flags |= ItemFlag.ITEM_RUNIC;

        if (
            (theItem.enchant2 === WeaponEnchant.Slaying && theItem.category === ItemCategory.WEAPON) ||
            (theItem.enchant2 === ArmorEnchant.Immunity && theItem.category === ItemCategory.ARMOR)
        ) {
            const selectedVorpalEnemy = await dialogCreateItemChooseVorpalEnemy(ctx);

            if (selectedVorpalEnemy >= 0) {
                theItem.vorpalEnemy = selectedVorpalEnemy;
            } else {
                theItem.enchant2 = 0;
                theItem.flags &= ~ItemFlag.ITEM_RUNIC;
            }
        }
    } else if (selectedRunic === noRunicIndex) {
        theItem.enchant2 = 0;
        theItem.flags &= ~ItemFlag.ITEM_RUNIC;
    }
}

// =============================================================================
// dialogCreateItemChooseKind — Wizard.c:176
// =============================================================================

/**
 * Display a dialog to choose an item kind within a category.
 * Returns the selected kind index, or -1 if canceled.
 *
 * C: `dialogCreateItemChooseKind` in Wizard.c
 */
export async function dialogCreateItemChooseKind(
    category: number,
    ctx: WizardContext,
): Promise<number> {
    const kindTable = ctx.tableForItemCategory(category);
    const kindCount = ctx.itemKindCount(category, 0);

    if (!kindTable || kindCount === 0) return -1;

    const buttons = [];
    for (let i = 0; i < kindCount; i++) {
        buttons.push(initializeCreateItemButton(kindTable[i].name, ctx));
    }

    const title = `Create ${ctx.itemCategoryNames[unflag(category)]}:`;
    return dialogSelectEntryFromList(buttons, buttons.length, title, ctx);
}

// =============================================================================
// dialogCreateItemChooseEnchantmentLevel — Wizard.c:198
// =============================================================================

/**
 * Display an input dialog for the user to enter the enchantment level.
 * Assigns the enchantment to the item.
 *
 * C: `dialogCreateItemChooseEnchantmentLevel` in Wizard.c
 */
export async function dialogCreateItemChooseEnchantmentLevel(
    theItem: Item,
    ctx: WizardContext,
): Promise<void> {
    let minVal = 0;
    let maxVal = 50;
    let defaultVal = theItem.enchant1;
    const maxInputLength = 2;

    if (theItem.category === ItemCategory.WAND) {
        minVal = 0;
        defaultVal = theItem.charges;
    } else if (theItem.category === ItemCategory.CHARM) {
        minVal = 1;
    } else if (theItem.category === ItemCategory.STAFF) {
        minVal = 2;
    } else if (theItem.category === ItemCategory.RING) {
        minVal = -3;
    } else if (theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR)) {
        if (!(theItem.flags & ItemFlag.ITEM_RUNIC)) {
            minVal = -3;
        } else {
            if (
                (theItem.category === ItemCategory.ARMOR &&
                    theItem.enchant2 >= ArmorEnchant.NumberGoodArmorEnchantKinds) ||
                (theItem.category === ItemCategory.WEAPON &&
                    theItem.enchant2 >= NUMBER_GOOD_WEAPON_ENCHANT_KINDS)
            ) {
                minVal = -3;
                maxVal = -1;
                theItem.enchant1 = ctx.rand_range(-3, -1);
            } else {
                minVal = 1;
                if (theItem.enchant1 < 1) {
                    theItem.enchant1 = ctx.rand_range(1, 3);
                }
            }
            defaultVal = theItem.enchant1;
        }
    }

    const prompt = `How many enchants (${minVal} to ${maxVal}) [default ${defaultVal}]?`;
    const inputBuf = await ctx.getInputTextString(prompt, maxInputLength, "", "", TextEntryType.Normal, true);

    if (inputBuf !== null && inputBuf.length > 0) {
        let enchants = parseInt(inputBuf, 10);
        if (!isNaN(enchants) && String(enchants) === inputBuf) {
            if (enchants > maxVal) {
                enchants = maxVal;
            } else if (enchants < minVal) {
                enchants = defaultVal;
            }

            if (theItem.category === ItemCategory.WAND) {
                theItem.charges = enchants;
            } else if (theItem.category === ItemCategory.STAFF) {
                theItem.charges = enchants;
                theItem.enchant1 = enchants;
            } else {
                theItem.enchant1 = enchants;
            }
        }
    }

    if (theItem.enchant1 < 0) {
        theItem.flags |= ItemFlag.ITEM_CURSED;
    }
}

// =============================================================================
// dialogCreateItem — Wizard.c:439
// =============================================================================

/**
 * Display a series of dialog windows for creating an arbitrary item.
 *
 * C: `dialogCreateItem` in Wizard.c
 */
export async function dialogCreateItem(ctx: WizardContext): Promise<void> {
    if (ctx.numberOfItemsInPack() >= MAX_PACK_ITEMS) {
        ctx.messageWithColor("Your pack is already full.", ctx.itemMessageColor, 0);
        return;
    }

    const categoryButtons = [];
    for (let i = 0; i < NUMBER_ITEM_CATEGORIES; i++) {
        categoryButtons.push(initializeCreateItemButton(ctx.itemCategoryNames[i], ctx));
    }

    const selectedCategory = await dialogSelectEntryFromList(
        categoryButtons,
        categoryButtons.length,
        "Create item:",
        ctx,
    );

    if (selectedCategory === -1) return;

    const categoryFlag = 1 << selectedCategory;

    let selectedKind: number;
    if (ctx.tableForItemCategory(categoryFlag)) {
        selectedKind = await dialogCreateItemChooseKind(categoryFlag, ctx);
    } else {
        selectedKind = 0;
    }

    if (selectedKind < 0) return;

    let theItem = ctx.generateItem(categoryFlag, selectedKind);
    theItem.flags &= ~ItemFlag.ITEM_CURSED;

    if (categoryFlag === ItemCategory.GEM) {
        theItem.originDepth = ctx.rogue.depthLevel;
    }

    if (categoryFlag === ItemCategory.GOLD) {
        ctx.rogue.gold += theItem.quantity;
        const goldMsg = `you found ${theItem.quantity} pieces of gold.${ctx.rogue.featRecord[ctx.FEAT_TONE] ? ".. and strike a tone of disappointment." : ""}`;
        ctx.rogue.featRecord[ctx.FEAT_TONE] = false;
        ctx.messageWithColor(goldMsg, ctx.itemMessageColor, 0);
        ctx.deleteItem(theItem);
        return;
    }

    if (categoryFlag & (ItemCategory.ARMOR | ItemCategory.WEAPON)) {
        await dialogCreateItemChooseRunic(theItem, ctx);
    }

    if ((categoryFlag & CAN_BE_ENCHANTED) && theItem.quiverNumber === 0) {
        await dialogCreateItemChooseEnchantmentLevel(theItem, ctx);
    }

    if ((theItem.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED) && !(categoryFlag & NEVER_IDENTIFIABLE)) {
        if (await ctx.confirm("Identify the item?", false)) {
            ctx.identify(theItem);
        }
    }

    theItem = ctx.addItemToPack(theItem);
    const theItemName = ctx.itemName(theItem, true, true);

    const msg = `you now have ${theItemName} (${theItem.inventoryLetter}).`;
    ctx.messageWithColor(msg, ctx.itemMessageColor, 0);
}

// Local helper — mirrors unflag in wizard.ts
function unflag(flag: number): number {
    for (let i = 0; i < 32; i++) {
        if ((flag >>> i) === 1) {
            return i;
        }
    }
    return -1;
}
