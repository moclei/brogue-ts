/*
 *  wizard.ts — Wizard / debug mode dialogs
 *  brogue-ts
 *
 *  Ported from: src/brogue/Wizard.c (523 lines)
 *  Functions: initializeCreateItemButton, dialogSelectEntryFromList,
 *             dialogCreateItemChooseVorpalEnemy, dialogCreateItemChooseRunic,
 *             dialogCreateItemChooseKind, dialogCreateItemChooseEnchantmentLevel,
 *             dialogCreateMonsterChooseMutation, dialogCreateMonster,
 *             dialogCreateItem, dialogCreateItemOrMonster
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    BrogueButton,
    ScreenDisplayBuffer,
    SavedDisplayBuffer,
    Item,
    Creature,
    CreatureType,
    ItemTable,
    MonsterClass,
    Mutation,
    Pos,
    WindowPos,
} from "../types/types.js";
import { ItemCategory, CAN_BE_ENCHANTED, NEVER_IDENTIFIABLE } from "../types/enums.js";
import {
    WeaponKind,
    WeaponEnchant,
    ArmorKind,
    ArmorEnchant,
    MonsterType,
    TextEntryType,
    DisplayGlyph,
    CreatureState,
} from "../types/enums.js";
import { ButtonFlag, ItemFlag, MessageFlag, MonsterBehaviorFlag } from "../types/flags.js";
import { MONST_NEVER_MUTATED, MA_NEVER_MUTATED } from "../types/flags.js";
import {
    COLS, KEYBOARD_LABELS, INTERFACE_OPACITY, MAX_PACK_ITEMS,
    NUMBER_ITEM_CATEGORIES, MONSTER_CLASS_COUNT, NUMBER_MUTATORS,
    NUMBER_WEAPON_RUNIC_KINDS, NUMBER_GOOD_WEAPON_ENCHANT_KINDS,
} from "../types/constants.js";
import { upperCase } from "../io/io-text.js";

// =============================================================================
// Constants — Wizard.c:36
// =============================================================================

export const DIALOG_CREATE_ITEM_MAX_BUTTONS = 26;
const MONSTERS_PER_PAGE = 24;

// =============================================================================
// DI Context
// =============================================================================

/**
 * Dependency-injection context for the wizard module.
 */
export interface WizardContext {
    // -- Rogue state -----------------------------------------------------------

    rogue: {
        depthLevel: number;
        gold: number;
        featRecord: boolean[];
    };

    // -- Display primitives ---------------------------------------------------

    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>): void;

    printString(
        text: string,
        x: number,
        y: number,
        foreColor: Readonly<Color>,
        backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer | null,
    ): void;

    rectangularShading(
        x: number,
        y: number,
        width: number,
        height: number,
        backColor: Readonly<Color>,
        opacity: number,
        dbuf: ScreenDisplayBuffer,
    ): void;

    // -- Buttons ---------------------------------------------------------------

    initializeButton(): BrogueButton;
    buttonInputLoop(
        buttons: BrogueButton[],
        buttonCount: number,
        winX: number,
        winY: number,
        winWidth: number,
        winHeight: number,
    ): { chosenButton: number; event: import("../types/types.js").RogueEvent };

    // -- Text & prompts -------------------------------------------------------

    strLenWithoutEscapes(s: string): number;
    getInputTextString(
        prompt: string,
        maxLength: number,
        defaultEntry: string,
        promptSuffix: string,
        textEntryType: TextEntryType,
        useDialogBox: boolean,
    ): string | null;

    confirm(prompt: string, alsoDuringPlayback: boolean): boolean;
    confirmMessages(): void;
    temporaryMessage(msg: string, flags: number): void;
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;

    // -- Targeting ------------------------------------------------------------

    chooseTarget(
        targetLoc: { value: Pos },
        maxDistance: number,
        autotargetMode: number,
        theItem: Item | null,
    ): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;

    // -- Catalogs & tables ----------------------------------------------------

    readonly monsterCatalog: readonly CreatureType[];
    readonly monsterClassCatalog: readonly MonsterClass[];
    readonly mutationCatalog: readonly Mutation[];
    readonly itemCategoryNames: readonly string[];
    readonly weaponRunicNames: readonly string[];
    readonly armorRunicNames: readonly string[];

    tableForItemCategory(category: number): readonly ItemTable[] | null;
    itemKindCount(category: number, polarityConstraint: number): number;

    // -- Item operations ------------------------------------------------------

    numberOfItemsInPack(): number;
    generateItem(category: number, kind: number): Item;
    addItemToPack(theItem: Item): Item;
    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string;
    identify(theItem: Item): void;
    deleteItem(theItem: Item): void;

    // -- Monster operations ---------------------------------------------------

    generateMonster(monsterID: MonsterType, itemPossible: boolean, mutationPossible: boolean): Creature;
    initializeMonster(monst: Creature, itemPossible: boolean): void;
    mutateMonster(monst: Creature, mutationIndex: number): void;
    monsterAtLoc(loc: Pos): Creature | null;
    killCreature(monst: Creature, administrativeDeath: boolean): void;
    removeDeadMonsters(): void;
    becomeAllyWith(monst: Creature): void;
    fadeInMonster(monst: Creature): void;

    refreshSideBar(focusX: number, focusY: number, focusedEntityMustGoFirst: boolean): void;
    refreshDungeonCell(loc: Pos): void;
    pmapLayerAt(loc: Pos, layer: number): number;
    cellHasTerrainFlag(loc: Pos, flag: number): boolean;
    pmapFlagsAt(loc: Pos): number;

    readonly HAS_MONSTER: number;
    readonly T_OBSTRUCTS_PASSABILITY: number;
    readonly DUNGEON_LAYER: number;
    readonly WALL_TILE: number;
    readonly AUTOTARGET_MODE_NONE: number;
    readonly FEAT_TONE: number;

    // -- RNG ------------------------------------------------------------------

    rand_range(lo: number, hi: number): number;

    // -- Colors ---------------------------------------------------------------

    readonly black: Readonly<Color>;
    readonly white: Readonly<Color>;
    readonly itemMessageColor: Readonly<Color>;
    readonly interfaceBoxColor: Readonly<Color>;

    // -- Layout ---------------------------------------------------------------

    readonly WINDOW_POSITION_DUNGEON_TOP_LEFT: Readonly<WindowPos>;
}

// =============================================================================
// Helper: unflag — RogueMain.c:1406
// =============================================================================

/**
 * Convert a single-bit flag back to its index (e.g. 8 → 3).
 *
 * C: `unflag` in RogueMain.c
 */
export function unflag(flag: number): number {
    for (let i = 0; i < 32; i++) {
        if ((flag >>> i) === 1) {
            return i;
        }
    }
    return -1;
}

// =============================================================================
// initializeCreateItemButton — Wizard.c:27
// =============================================================================

/**
 * Create a button for a wizard dialog entry — text is uppercased.
 *
 * C: `initializeCreateItemButton` in Wizard.c
 */
export function initializeCreateItemButton(
    text: string,
    ctx: Pick<WizardContext, "initializeButton">,
): BrogueButton {
    const button = ctx.initializeButton();
    button.text = upperCase(text);
    return button;
}

// =============================================================================
// dialogSelectEntryFromList — Wizard.c:39
// =============================================================================

/**
 * Display a dialog window for the user to select a single entry from a list
 * of buttons. Returns the chosen button index, or -1 if canceled.
 *
 * C: `dialogSelectEntryFromList` in Wizard.c
 */
export function dialogSelectEntryFromList(
    buttons: BrogueButton[],
    buttonCount: number,
    windowTitle: string,
    ctx: WizardContext,
): number {
    let maxLen = windowTitle.length;

    for (let i = 0; i < buttonCount; i++) {
        buttons[i].flags &= ~(ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_GRADIENT);
        buttons[i].buttonColor = { ...ctx.interfaceBoxColor };
        buttons[i].hotkey = ["a".charCodeAt(0) + i, "A".charCodeAt(0) + i];
        buttons[i].x = ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowX;
        buttons[i].y = ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowY + 1 + i;

        if (KEYBOARD_LABELS) {
            const label = `${String.fromCharCode("a".charCodeAt(0) + i)}) ${buttons[i].text}`;
            buttons[i].text = label;
            if (label.length > maxLen) {
                maxLen = label.length;
            }
        }
    }

    const width = maxLen + 1;
    const height = buttonCount + 2;
    const x = ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowX;
    const y = ctx.WINDOW_POSITION_DUNGEON_TOP_LEFT.windowY;

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);

    // Dialog title
    ctx.printString(windowTitle, x, y - 1, ctx.itemMessageColor, ctx.interfaceBoxColor, dbuf);
    // Dialog background
    ctx.rectangularShading(x - 1, y - 1, width + 1, height + 1, ctx.interfaceBoxColor, INTERFACE_OPACITY, dbuf);

    // Display the title/background and save prior display state
    const rbuf = ctx.saveDisplayBuffer();
    ctx.overlayDisplayBuffer(dbuf);

    // Display the buttons and wait for user selection
    const selectedButton = ctx.buttonInputLoop(buttons, buttonCount, x, y, width, height).chosenButton;

    // Revert the display state
    ctx.restoreDisplayBuffer(rbuf);

    return selectedButton;
}

// =============================================================================
// dialogCreateItemChooseVorpalEnemy — Wizard.c:91
// =============================================================================

/**
 * Display a dialog to choose a vorpal enemy class. Returns the chosen index,
 * or -1 if canceled.
 *
 * C: `dialogCreateItemChooseVorpalEnemy` in Wizard.c
 */
export function dialogCreateItemChooseVorpalEnemy(ctx: WizardContext): number {
    const buttons: BrogueButton[] = [];

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
export function dialogCreateItemChooseRunic(theItem: Item, ctx: WizardContext): void {
    if (!(theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR))) {
        return;
    }

    const buttons: BrogueButton[] = [];
    let runicOffset = 0;

    if (theItem.category === ItemCategory.WEAPON) {
        // Heavy weapons can only have bad runics
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
            // Non-thrown weapons can have any runic
            for (let i = 0; i < NUMBER_WEAPON_RUNIC_KINDS; i++) {
                buttons.push(initializeCreateItemButton(ctx.weaponRunicNames[i], ctx));
            }
        } else {
            // Thrown weapons: no runics allowed
            return;
        }
    } else if (theItem.category === ItemCategory.ARMOR) {
        if (theItem.kind === ArmorKind.PlateMail) {
            // Plate mail: bad runics only
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
            // Other armor: any runic
            for (let i = 0; i < ArmorEnchant.NumberArmorEnchantKinds; i++) {
                buttons.push(initializeCreateItemButton(ctx.armorRunicNames[i], ctx));
            }
        }
    }

    // Add "No Runic" button
    const noRunicIndex = buttons.length;
    buttons.push(initializeCreateItemButton("No Runic", ctx));

    const selectedRunic = dialogSelectEntryFromList(buttons, buttons.length, "Choose a runic:", ctx);

    if (selectedRunic >= 0 && selectedRunic !== noRunicIndex) {
        theItem.enchant2 = selectedRunic + runicOffset;
        theItem.flags |= ItemFlag.ITEM_RUNIC;

        if (
            (theItem.enchant2 === WeaponEnchant.Slaying && theItem.category === ItemCategory.WEAPON) ||
            (theItem.enchant2 === ArmorEnchant.Immunity && theItem.category === ItemCategory.ARMOR)
        ) {
            const selectedVorpalEnemy = dialogCreateItemChooseVorpalEnemy(ctx);

            if (selectedVorpalEnemy >= 0) {
                theItem.vorpalEnemy = selectedVorpalEnemy;
            } else {
                // Remove the runic if no vorpal enemy chosen
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
export function dialogCreateItemChooseKind(
    category: number,
    ctx: WizardContext,
): number {
    const kindTable = ctx.tableForItemCategory(category);
    const kindCount = ctx.itemKindCount(category, 0);

    if (!kindTable || kindCount === 0) return -1;

    const buttons: BrogueButton[] = [];
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
export function dialogCreateItemChooseEnchantmentLevel(
    theItem: Item,
    ctx: WizardContext,
): void {
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
            // Bad runics: negatively enchanted only
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
                // Good runics: positively enchanted only
                minVal = 1;
                if (theItem.enchant1 < 1) {
                    theItem.enchant1 = ctx.rand_range(1, 3);
                }
            }
            defaultVal = theItem.enchant1;
        }
    }

    const prompt = `How many enchants (${minVal} to ${maxVal}) [default ${defaultVal}]?`;
    const inputBuf = ctx.getInputTextString(prompt, maxInputLength, "", "", TextEntryType.Normal, true);

    // Validate the input
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
// dialogCreateMonsterChooseMutation — Wizard.c:280
// =============================================================================

/**
 * Display a dialog to choose a mutation for a monster.
 *
 * C: `dialogCreateMonsterChooseMutation` in Wizard.c
 */
export function dialogCreateMonsterChooseMutation(
    theMonster: Creature,
    ctx: WizardContext,
): void {
    const buttons: BrogueButton[] = [];
    const validIndices: number[] = [];

    for (let i = 0; i < NUMBER_MUTATORS; i++) {
        if (
            !(theMonster.info.flags & ctx.mutationCatalog[i].forbiddenFlags) &&
            !(theMonster.info.abilityFlags & ctx.mutationCatalog[i].forbiddenAbilityFlags)
        ) {
            buttons.push(initializeCreateItemButton(ctx.mutationCatalog[i].title, ctx));
            validIndices.push(i);
        }
    }

    // "No mutation" button
    const noMutationIndex = buttons.length;
    buttons.push(initializeCreateItemButton("No mutation", ctx));

    const selectedMutation = dialogSelectEntryFromList(buttons, buttons.length, "Choose a mutation:", ctx);

    if (selectedMutation >= 0 && selectedMutation !== noMutationIndex) {
        ctx.mutateMonster(theMonster, validIndices[selectedMutation]);
    }
}

// =============================================================================
// dialogCreateMonster — Wizard.c:305
// =============================================================================

/**
 * Display a series of dialog windows for creating an arbitrary monster.
 *
 * C: `dialogCreateMonster` in Wizard.c
 */
export function dialogCreateMonster(ctx: WizardContext): void {
    const CREATABLE_MONSTER_KINDS = ctx.monsterCatalog.length - 2; // Exclude lich and phoenix

    // Copy monsters (excluding lich/phoenix), sort alphabetically
    const monsterKinds: CreatureType[] = [];
    for (let i = 0; i < ctx.monsterCatalog.length; i++) {
        if (
            ctx.monsterCatalog[i].monsterID !== MonsterType.MK_LICH &&
            ctx.monsterCatalog[i].monsterID !== MonsterType.MK_PHOENIX
        ) {
            monsterKinds.push({ ...ctx.monsterCatalog[i], monsterName: upperCase(ctx.monsterCatalog[i].monsterName) });
        }
    }

    monsterKinds.sort((a, b) => a.monsterName.localeCompare(b.monsterName));

    // Build range buttons
    const rangeButtons: BrogueButton[] = [];
    for (let i = 0; i < monsterKinds.length; i += MONSTERS_PER_PAGE) {
        const endIdx = Math.min(i + MONSTERS_PER_PAGE - 1, monsterKinds.length - 1);
        const rangeText = `${monsterKinds[i].monsterName} - ${monsterKinds[endIdx].monsterName}`;
        rangeButtons.push(initializeCreateItemButton(rangeText, ctx));
    }

    // Choose a monster range
    const monsterOffset = dialogSelectEntryFromList(rangeButtons, rangeButtons.length, "Create monster:", ctx);
    if (monsterOffset === -1) return;

    const startIdx = monsterOffset * MONSTERS_PER_PAGE;

    // Populate menu of monsters in the selected range
    const monsterButtons: BrogueButton[] = [];
    for (let i = startIdx; i < startIdx + MONSTERS_PER_PAGE && i < monsterKinds.length; i++) {
        monsterButtons.push(initializeCreateItemButton(monsterKinds[i].monsterName, ctx));
    }

    // Choose a monster
    const selectedMonster = dialogSelectEntryFromList(monsterButtons, monsterButtons.length, "Create monster:", ctx);
    if (selectedMonster === -1) return;

    const finalIndex = startIdx + selectedMonster;
    const theMonster = ctx.generateMonster(monsterKinds[finalIndex].monsterID, false, false);

    // Choose a mutation
    if (
        !(theMonster.info.flags & MONST_NEVER_MUTATED) &&
        !(theMonster.info.abilityFlags & MA_NEVER_MUTATED)
    ) {
        dialogCreateMonsterChooseMutation(theMonster, ctx);
    }
    ctx.initializeMonster(theMonster, false);

    let theMessage: string;
    if (theMonster.info.displayChar === DisplayGlyph.G_TURRET) {
        theMessage = `Create ${theMonster.info.monsterName} where? Choose a visible wall.`;
    } else {
        theMessage = `Create ${theMonster.info.monsterName} where? Choose a visible unobstructed location.`;
    }
    ctx.temporaryMessage(theMessage, MessageFlag.REFRESH_SIDEBAR);

    // Pick a location
    const selectedPosition = { value: { x: 0, y: 0 } };
    if (ctx.chooseTarget(selectedPosition, 0, ctx.AUTOTARGET_MODE_NONE, null)) {
        ctx.confirmMessages();
        const loc = selectedPosition.value;
        let locationIsValid = true;

        if (!ctx.playerCanSeeOrSense(loc.x, loc.y)) {
            locationIsValid = false;
        }
        if (theMonster.info.displayChar === DisplayGlyph.G_TURRET &&
            ctx.pmapLayerAt(loc, ctx.DUNGEON_LAYER) !== ctx.WALL_TILE) {
            locationIsValid = false;
        }
        if (theMonster.info.displayChar !== DisplayGlyph.G_TURRET &&
            ctx.cellHasTerrainFlag(loc, ctx.T_OBSTRUCTS_PASSABILITY)) {
            locationIsValid = false;
        }

        if (!locationIsValid) {
            const errMsg = `Invalid location. ${KEYBOARD_LABELS ? "-- Press space or click to continue --" : "-- Touch anywhere to continue --"}`;
            ctx.temporaryMessage(errMsg, MessageFlag.REQUIRE_ACKNOWLEDGMENT);
            ctx.killCreature(theMonster, true);
            ctx.removeDeadMonsters();
            return;
        }

        // If there's already a monster here, quietly bury it
        const oldMonster = ctx.monsterAtLoc(loc);
        if (oldMonster) {
            ctx.killCreature(oldMonster, true);
            ctx.removeDeadMonsters();
        }

        theMonster.loc = loc;
        ctx.pmapFlagsAt(loc); // trigger flag set - HAS_MONSTER is set via context
        theMonster.creatureState = CreatureState.Wandering;
        ctx.fadeInMonster(theMonster);
        ctx.refreshSideBar(-1, -1, false);
        ctx.refreshDungeonCell(theMonster.loc);

        if (
            !(theMonster.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) ||
            theMonster.info.monsterID === MonsterType.MK_PHOENIX_EGG ||
            theMonster.info.monsterID === MonsterType.MK_PHYLACTERY
        ) {
            const allyPrompt = `Make the ${theMonster.info.monsterName} your ally?`;
            if (ctx.confirm(allyPrompt, false)) {
                ctx.becomeAllyWith(theMonster);
                theMessage = `Allied ${theMonster.info.monsterName} created.`;
            } else {
                theMessage = `${theMonster.info.monsterName} created.`;
            }
        } else {
            theMessage = `${theMonster.info.monsterName} created.`;
        }
        ctx.message(theMessage, 0);
    } else {
        // No location chosen
        ctx.confirmMessages();
        ctx.killCreature(theMonster, true);
        ctx.removeDeadMonsters();
    }
    ctx.refreshSideBar(-1, -1, false);
}

// =============================================================================
// dialogCreateItem — Wizard.c:439
// =============================================================================

/**
 * Display a series of dialog windows for creating an arbitrary item.
 *
 * C: `dialogCreateItem` in Wizard.c
 */
export function dialogCreateItem(ctx: WizardContext): void {
    if (ctx.numberOfItemsInPack() >= MAX_PACK_ITEMS) {
        ctx.messageWithColor("Your pack is already full.", ctx.itemMessageColor, 0);
        return;
    }

    // Choose item category
    const categoryButtons: BrogueButton[] = [];
    for (let i = 0; i < NUMBER_ITEM_CATEGORIES; i++) {
        categoryButtons.push(initializeCreateItemButton(ctx.itemCategoryNames[i], ctx));
    }

    const selectedCategory = dialogSelectEntryFromList(
        categoryButtons,
        categoryButtons.length,
        "Create item:",
        ctx,
    );

    if (selectedCategory === -1) return;

    const categoryFlag = 1 << selectedCategory; // Fl(selectedCategory)

    let selectedKind: number;
    if (ctx.tableForItemCategory(categoryFlag)) {
        selectedKind = dialogCreateItemChooseKind(categoryFlag, ctx);
    } else {
        selectedKind = 0;
    }

    if (selectedKind < 0) return;

    let theItem = ctx.generateItem(categoryFlag, selectedKind);
    theItem.flags &= ~ItemFlag.ITEM_CURSED; // We'll add a curse later if negatively enchanted

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
        dialogCreateItemChooseRunic(theItem, ctx);
    }

    if ((categoryFlag & CAN_BE_ENCHANTED) && theItem.quiverNumber === 0) {
        dialogCreateItemChooseEnchantmentLevel(theItem, ctx);
    }

    if ((theItem.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED) && !(categoryFlag & NEVER_IDENTIFIABLE)) {
        if (ctx.confirm("Identify the item?", false)) {
            ctx.identify(theItem);
        }
    }

    theItem = ctx.addItemToPack(theItem);
    const theItemName = ctx.itemName(theItem, true, true);

    const msg = `you now have ${theItemName} (${theItem.inventoryLetter}).`;
    ctx.messageWithColor(msg, ctx.itemMessageColor, 0);
}

// =============================================================================
// dialogCreateItemOrMonster — Wizard.c:508
// =============================================================================

/**
 * Top-level wizard dialog: choose to create an item or monster.
 *
 * C: `dialogCreateItemOrMonster` in Wizard.c
 */
export function dialogCreateItemOrMonster(ctx: WizardContext): void {
    const buttons: BrogueButton[] = [
        initializeCreateItemButton("Item", ctx),
        initializeCreateItemButton("Monster", ctx),
    ];

    const selectedType = dialogSelectEntryFromList(buttons, 2, "Create:", ctx);

    if (selectedType === 0) {
        dialogCreateItem(ctx);
    } else if (selectedType === 1) {
        dialogCreateMonster(ctx);
    }
}
