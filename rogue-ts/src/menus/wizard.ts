/*
 *  menus/wizard.ts — Wizard / debug mode dialogs
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/wizard.ts
 *  Source C: src/brogue/Wizard.c (functions: initializeCreateItemButton,
 *             dialogSelectEntryFromList, dialogCreateMonsterChooseMutation,
 *             dialogCreateMonster, dialogCreateItemOrMonster)
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
    RogueEvent,
} from "../types/types.js";
import {
    MonsterType, TextEntryType, DisplayGlyph, CreatureState,
} from "../types/enums.js";
import { ButtonFlag, MessageFlag, MonsterBehaviorFlag } from "../types/flags.js";
import { MONST_NEVER_MUTATED, MA_NEVER_MUTATED } from "../types/flags.js";
import {
    KEYBOARD_LABELS, INTERFACE_OPACITY,
    NUMBER_MUTATORS,
} from "../types/constants.js";
import { upperCase } from "../io/text.js";
import { dialogCreateItem } from "./wizard-items.js";

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
    ): Promise<{ chosenButton: number; event: RogueEvent }>;

    // -- Text & prompts -------------------------------------------------------

    strLenWithoutEscapes(s: string): number;
    getInputTextString(
        prompt: string,
        maxLength: number,
        defaultEntry: string,
        promptSuffix: string,
        textEntryType: TextEntryType,
        useDialogBox: boolean,
    ): Promise<string | null>;

    confirm(prompt: string, alsoDuringPlayback: boolean): Promise<boolean>;
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
export async function dialogSelectEntryFromList(
    buttons: BrogueButton[],
    buttonCount: number,
    windowTitle: string,
    ctx: WizardContext,
): Promise<number> {
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

    ctx.printString(windowTitle, x, y - 1, ctx.itemMessageColor, ctx.interfaceBoxColor, dbuf);
    ctx.rectangularShading(x - 1, y - 1, width + 1, height + 1, ctx.interfaceBoxColor, INTERFACE_OPACITY, dbuf);

    const rbuf = ctx.saveDisplayBuffer();
    ctx.overlayDisplayBuffer(dbuf);

    const result = await ctx.buttonInputLoop(buttons, buttonCount, x, y, width, height);

    ctx.restoreDisplayBuffer(rbuf);

    return result.chosenButton;
}

// =============================================================================
// dialogCreateMonsterChooseMutation — Wizard.c:280
// =============================================================================

/**
 * Display a dialog to choose a mutation for a monster.
 *
 * C: `dialogCreateMonsterChooseMutation` in Wizard.c
 */
export async function dialogCreateMonsterChooseMutation(
    theMonster: Creature,
    ctx: WizardContext,
): Promise<void> {
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

    const noMutationIndex = buttons.length;
    buttons.push(initializeCreateItemButton("No mutation", ctx));

    const selectedMutation = await dialogSelectEntryFromList(buttons, buttons.length, "Choose a mutation:", ctx);

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
export async function dialogCreateMonster(ctx: WizardContext): Promise<void> {
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

    const rangeButtons: BrogueButton[] = [];
    for (let i = 0; i < monsterKinds.length; i += MONSTERS_PER_PAGE) {
        const endIdx = Math.min(i + MONSTERS_PER_PAGE - 1, monsterKinds.length - 1);
        const rangeText = `${monsterKinds[i].monsterName} - ${monsterKinds[endIdx].monsterName}`;
        rangeButtons.push(initializeCreateItemButton(rangeText, ctx));
    }

    const monsterOffset = await dialogSelectEntryFromList(rangeButtons, rangeButtons.length, "Create monster:", ctx);
    if (monsterOffset === -1) return;

    const startIdx = monsterOffset * MONSTERS_PER_PAGE;

    const monsterButtons: BrogueButton[] = [];
    for (let i = startIdx; i < startIdx + MONSTERS_PER_PAGE && i < monsterKinds.length; i++) {
        monsterButtons.push(initializeCreateItemButton(monsterKinds[i].monsterName, ctx));
    }

    const selectedMonster = await dialogSelectEntryFromList(monsterButtons, monsterButtons.length, "Create monster:", ctx);
    if (selectedMonster === -1) return;

    const finalIndex = startIdx + selectedMonster;
    const theMonster = ctx.generateMonster(monsterKinds[finalIndex].monsterID, false, false);

    if (
        !(theMonster.info.flags & MONST_NEVER_MUTATED) &&
        !(theMonster.info.abilityFlags & MA_NEVER_MUTATED)
    ) {
        await dialogCreateMonsterChooseMutation(theMonster, ctx);
    }
    ctx.initializeMonster(theMonster, false);

    let theMessage: string;
    if (theMonster.info.displayChar === DisplayGlyph.G_TURRET) {
        theMessage = `Create ${theMonster.info.monsterName} where? Choose a visible wall.`;
    } else {
        theMessage = `Create ${theMonster.info.monsterName} where? Choose a visible unobstructed location.`;
    }
    ctx.temporaryMessage(theMessage, MessageFlag.REFRESH_SIDEBAR);

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

        const oldMonster = ctx.monsterAtLoc(loc);
        if (oldMonster) {
            ctx.killCreature(oldMonster, true);
            ctx.removeDeadMonsters();
        }

        theMonster.loc = loc;
        ctx.pmapFlagsAt(loc);
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
            if (await ctx.confirm(allyPrompt, false)) {
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
        ctx.confirmMessages();
        ctx.killCreature(theMonster, true);
        ctx.removeDeadMonsters();
    }
    ctx.refreshSideBar(-1, -1, false);
}

// =============================================================================
// dialogCreateItemOrMonster — Wizard.c:508
// =============================================================================

/**
 * Top-level wizard dialog: choose to create an item or monster.
 *
 * C: `dialogCreateItemOrMonster` in Wizard.c
 */
export async function dialogCreateItemOrMonster(ctx: WizardContext): Promise<void> {
    const buttons: BrogueButton[] = [
        initializeCreateItemButton("Item", ctx),
        initializeCreateItemButton("Monster", ctx),
    ];

    const selectedType = await dialogSelectEntryFromList(buttons, 2, "Create:", ctx);

    if (selectedType === 0) {
        await dialogCreateItem(ctx);
    } else if (selectedType === 1) {
        await dialogCreateMonster(ctx);
    }
}
