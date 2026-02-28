/*
 *  item-handlers.ts — Interactive item usage handlers
 *  brogue-ts
 *
 *  Ported from Items.c: apply, readScroll, drinkPotion, useStaffOrWand,
 *  useCharm, eat, consumePackItem, uncurse, autoIdentify, identifyItemKind,
 *  magicMapCell, recordApplyItemCommand, updateIdentifiableItems,
 *  detectMagicOnItem, magicCharDiscoverySuffix
 *
 *  These functions are the interactive item-usage handlers that were
 *  deferred from Phase 2 because they require UI integration (prompts,
 *  messages, targeting, inventory display).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Item, ItemTable, Creature, GameConstants, Pos, Pcell,
    PlayerCharacter, Fixpt, Color, Bolt,
} from "../types/types.js";
import {
    ItemCategory, ScrollKind, PotionKind, StaffKind, CharmKind,
    RingKind, FoodKind, StatusEffect, DungeonLayer, BoltEffect,
    ALL_ITEMS, HAS_INTRINSIC_POLARITY, CAN_BE_DETECTED,
} from "../types/enums.js";
import { ItemFlag, TileFlag, TerrainFlag, TerrainMechFlag } from "../types/flags.js";
import { DCOLS, DROWS, APPLY_KEY, STOMACH_SIZE } from "../types/constants.js";
import { getTableForCategory } from "./item-generation.js";
import { itemName, identify, identifyItemKind as identifyItemKindNaming, tryIdentifyLastItemKinds } from "./item-naming.js";
import { netEnchant } from "./item-usage.js";
import type { ItemNamingContext } from "./item-naming.js";

// =============================================================================
// Types & DI Context
// =============================================================================

/**
 * Dependency injection context for interactive item handlers.
 * Bundles all game state and helper functions needed by the apply/use functions.
 */
export interface ItemHandlerContext {
    // ── Game state ──
    gc: GameConstants;
    rogue: PlayerCharacter;
    player: Creature;
    pmap: Pcell[][];
    packItems: Item[];
    floorItems: Item[];
    monsters: Creature[];

    // ── Item tables ──
    scrollTable: ItemTable[];
    potionTable: ItemTable[];
    foodTable: ItemTable[];
    wandTable: ItemTable[];
    staffTable: ItemTable[];
    ringTable: ItemTable[];
    charmTable: ItemTable[];

    // ── Catalogs ──
    tileCatalog: Array<{ flags: number; mechFlags: number; drawPriority: number }>;
    boltCatalog: Bolt[];
    dungeonFeatureCatalog: Array<{ /* DF definition */ }>;

    // ── Colors ──
    itemMessageColor: Color;
    advancementMessageColor: Color;

    // ── Naming context ──
    namingCtx: ItemNamingContext;

    // ── RNG ──
    randRange(lo: number, hi: number): number;
    randPercent(pct: number): boolean;
    randClump(range: { lowerBound: number; upperBound: number; clumpFactor: number }): number;

    // ── UI functions ──
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Color, flags: number): void;
    confirmMessages(): void;
    confirm(prompt: string, defaultYes: boolean): boolean;
    temporaryMessage(msg: string, flags: number): void;
    printString(s: string, x: number, y: number, fg: Color, bg: Color, grid: null): void;

    // ── Inventory / item management ──
    promptForItemOfType(
        category: number,
        requiredFlags: number,
        forbiddenFlags: number,
        prompt: string,
        allowEscape: boolean,
    ): Item | null;
    numberOfMatchingPackItems(category: number, requiredFlags: number, forbiddenFlags: number, displayErrors: boolean): number;
    removeItemFromChain(theItem: Item, chain: Item[]): void;
    deleteItem(theItem: Item): void;
    updateIdentifiableItem(theItem: Item): void;
    updateEncumbrance(): void;
    updateRingBonuses(): void;
    equipItem(theItem: Item, forceEquip: boolean, unequipHint: null): void;
    recalculateEquipmentBonuses(): void;
    itemMagicPolarity(theItem: Item): number;

    // ── Recording ──
    recordKeystroke(key: number, shift: boolean, ctrl: boolean): void;
    recordKeystrokeSequence(command: number[]): void;
    recordMouseClick(x: number, y: number, leftClick: boolean, shift: boolean): void;

    // ── Creature/combat helpers ──
    heal(target: Creature, percent: number, increaseMax: boolean): void;
    haste(target: Creature, duration: number): void;
    teleport(target: Creature, destination: Pos, voluntary: boolean): void;
    exposeCreatureToFire(target: Creature): void;
    extinguishFireOnCreature(target: Creature): void;
    makePlayerTelepathic(duration: number): void;
    imbueInvisibility(target: Creature, duration: number): void;
    wakeUp(monst: Creature): void;
    fadeInMonster(monst: Creature): void;
    flashMonster(monst: Creature, color: Color, strength: number): void;
    aggravateMonsters(range: number, x: number, y: number, color: Color): void;
    monsterAtLoc(pos: Pos): Creature | null;
    monsterName(monst: Creature, includeArticle: boolean): string;
    spawnHorde(depth: number, pos: Pos, flags: number, forbiddenFlags: number): Creature | null;
    summonGuardian(charm: Item): void;

    // ── Dungeon feature / environment ──
    spawnDungeonFeature(x: number, y: number, feature: unknown, refreshCell: boolean, abortIfBlocking: boolean): void;
    cellHasTMFlag(pos: Pos, flag: number): boolean;
    cellHasTerrainFlag(pos: Pos, flag: number): boolean;
    discover(x: number, y: number): void;
    refreshDungeonCell(pos: Pos): void;
    crystalize(radius: number): void;
    rechargeItems(category: number): void;
    negationBlast(source: string, radius: number): void;
    discordBlast(source: string, radius: number): void;

    // ── Visual effects ──
    colorFlash(color: Color, flags: number, tileFlags: number, radius: number, maxRadius: number, x: number, y: number): void;
    createFlare(x: number, y: number, lightIndex: number): void;
    displayLevel(): void;

    // ── Vision/light ──
    updateMinersLightRadius(): void;
    updateVision(refreshDisplay: boolean): void;
    updateClairvoyance(): void;
    updatePlayerRegenerationDelay(): void;

    // ── Targeting ──
    chooseTarget(maxDistance: number, autoTargetMode: number, theItem: Item): { confirmed: boolean; target: Pos };
    staffBlinkDistance(enchant: Fixpt): number;
    playerCancelsBlinking(origin: Pos, target: Pos, maxDistance: number): boolean;

    // ── Turn management ──
    playerTurnEnded(): void;

    // ── Map helpers ──
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;

    // ── Charm calculation helpers ──
    charmHealing(enchant: Fixpt): number;
    charmProtection(enchant: Fixpt): number;
    charmEffectDuration(kind: number, enchant: number): number;
    charmShattering(enchant: Fixpt): number;
    charmNegationRadius(enchant: Fixpt): number;
    charmRechargeDelay(kind: number, enchant: number): number;
    enchantMagnitude(): number;

    // ── Feature constants ──
    /** Dungeon feature indices for various effects. */
    DF_INCINERATION_POTION: number;
    DF_HOLE_POTION: number;
    DF_POISON_GAS_CLOUD_POTION: number;
    DF_PARALYSIS_GAS_CLOUD_POTION: number;
    DF_CONFUSION_GAS_CLOUD_POTION: number;
    DF_LICHEN_PLANTED: number;
    DF_SACRED_GLYPHS: number;

    /** Flare light indices. */
    SCROLL_ENCHANTMENT_LIGHT: number;
    SCROLL_PROTECTION_LIGHT: number;
    POTION_STRENGTH_LIGHT: number;

    /** Message flags. */
    REQUIRE_ACKNOWLEDGMENT: number;
    REFRESH_SIDEBAR: number;

    /** Whether to show keyboard labels in prompts. */
    KEYBOARD_LABELS: boolean;

    /** Invalid position constant. */
    INVALID_POS: Pos;

    /** Bolt IDs. */
    BOLT_SHIELDING: number;

    /** Horde flags. */
    HORDE_LEADER_CAPTIVE: number;
    HORDE_NO_PERIODIC_SPAWN: number;
    HORDE_IS_SUMMONED: number;
    HORDE_MACHINE_ONLY: number;

    /** Magic map colors. */
    magicMapFlashColor: Color;
    darkBlue: Color;
    gray: Color;
    black: Color;

    /** Tile flag constants. */
    MAGIC_MAPPED: number;
    IN_FIELD_OF_VIEW: number;

    /** nbDirs directional offsets. */
    nbDirs: readonly [number, number][];
}

// =============================================================================
// Simple helper functions
// =============================================================================

/**
 * Port of C `uncurse()`.
 * Removes the ITEM_CURSED flag from an item. Returns true if the item was cursed.
 */
export function uncurse(theItem: Item): boolean {
    if (theItem.flags & ItemFlag.ITEM_CURSED) {
        theItem.flags &= ~ItemFlag.ITEM_CURSED;
        return true;
    }
    return false;
}

/**
 * Port of C `consumePackItem()`.
 * Decrements quantity or removes the item from the pack entirely.
 */
export function consumePackItem(theItem: Item, ctx: Pick<ItemHandlerContext, "removeItemFromChain" | "deleteItem" | "packItems">): void {
    if (theItem.quantity > 1) {
        theItem.quantity--;
    } else {
        ctx.removeItemFromChain(theItem, ctx.packItems);
        ctx.deleteItem(theItem);
    }
}

/**
 * Port of C `recordApplyItemCommand()`.
 * Records the APPLY key + inventory letter for playback.
 */
export function recordApplyItemCommand(theItem: Item, ctx: Pick<ItemHandlerContext, "recordKeystrokeSequence">): void {
    if (!theItem) return;
    ctx.recordKeystrokeSequence([APPLY_KEY, theItem.inventoryLetter.charCodeAt(0)]);
}

// identifyItemKind is imported from item-naming.ts as identifyItemKindNaming

/**
 * Port of C `autoIdentify()`.
 * Automatically identifies an item's kind and displays an appropriate message.
 */
export function autoIdentify(
    theItem: Item,
    ctx: Pick<ItemHandlerContext, "gc" | "messageWithColor" | "itemMessageColor" | "namingCtx">,
): void {
    const theTable = getTableForCategory(theItem.category);

    if (theTable && !theTable[theItem.kind].identified) {
        identifyItemKindNaming(theItem, ctx.gc);
        const quantityBackup = theItem.quantity;
        theItem.quantity = 1;
        const newName = itemName(theItem, false, true, ctx.namingCtx);
        theItem.quantity = quantityBackup;
        const verb = (theItem.category & (ItemCategory.POTION | ItemCategory.SCROLL)) ? "have been" : "be";
        ctx.messageWithColor(`(It must ${verb} ${newName}.)`, ctx.itemMessageColor, 0);
    }

    if ((theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR))
        && (theItem.flags & ItemFlag.ITEM_RUNIC)
        && !(theItem.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED)) {

        const oldName = itemName(theItem, false, false, ctx.namingCtx);
        theItem.flags |= (ItemFlag.ITEM_RUNIC_IDENTIFIED | ItemFlag.ITEM_RUNIC_HINTED);
        const newName = itemName(theItem, true, true, ctx.namingCtx);
        ctx.messageWithColor(`(Your ${oldName} must be ${newName}.)`, ctx.itemMessageColor, 0);
    }
}

/**
 * Port of C `detectMagicOnItem()`.
 * Applies detect magic identification to an item.
 */
export function detectMagicOnItem(theItem: Item): void {
    if (theItem.category & HAS_INTRINSIC_POLARITY) {
        theItem.flags |= ItemFlag.ITEM_MAGIC_DETECTED;
        // Identify cursed items fully, identify blessed items kind-only
        if (theItem.enchant1 < 0) {
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
        }
    }
}

/**
 * Port of C `magicMapCell()`.
 * Reveals a cell on the magic map.
 */
export function magicMapCell(
    x: number, y: number,
    ctx: Pick<ItemHandlerContext, "pmap" | "tileCatalog">,
): void {
    const cell = ctx.pmap[x][y];
    cell.flags |= TileFlag.MAGIC_MAPPED;
    cell.rememberedTerrainFlags = ctx.tileCatalog[cell.layers[DungeonLayer.Dungeon]].flags
        | ctx.tileCatalog[cell.layers[DungeonLayer.Liquid]].flags;
    cell.rememberedTMFlags = ctx.tileCatalog[cell.layers[DungeonLayer.Dungeon]].mechFlags
        | ctx.tileCatalog[cell.layers[DungeonLayer.Liquid]].mechFlags;
    if (cell.layers[DungeonLayer.Liquid]
        && ctx.tileCatalog[cell.layers[DungeonLayer.Liquid]].drawPriority
            < ctx.tileCatalog[cell.layers[DungeonLayer.Dungeon]].drawPriority) {
        cell.rememberedTerrain = cell.layers[DungeonLayer.Liquid];
    } else {
        cell.rememberedTerrain = cell.layers[DungeonLayer.Dungeon];
    }
}

/**
 * Port of C `updateIdentifiableItems()`.
 * Updates the identifiable status of all items in pack and on floor.
 */
export function updateIdentifiableItems(
    ctx: Pick<ItemHandlerContext, "packItems" | "floorItems" | "updateIdentifiableItem">,
): void {
    for (const item of ctx.packItems) {
        ctx.updateIdentifiableItem(item);
    }
    for (const item of ctx.floorItems) {
        ctx.updateIdentifiableItem(item);
    }
}

/**
 * Port of C `magicCharDiscoverySuffix()`.
 * Returns +1 for beneficial, -1 for harmful, 0 for neutral items.
 * Used to warn about detected-as-cursed items before use.
 *
 * C: Items.c:7411
 */
export function magicCharDiscoverySuffix(
    category: number,
    kind: number,
    ctx: Pick<ItemHandlerContext, "boltCatalog">,
): number {
    switch (category) {
        case ItemCategory.SCROLL:
            switch (kind) {
                case ScrollKind.AggravateMonster:
                case ScrollKind.SummonMonster:
                    return -1;
                default:
                    return 1;
            }
        case ItemCategory.POTION:
            switch (kind) {
                case PotionKind.Hallucination:
                case PotionKind.Incineration:
                case PotionKind.Descent:
                case PotionKind.Poison:
                case PotionKind.Paralysis:
                case PotionKind.Confusion:
                case PotionKind.Lichen:
                case PotionKind.Darkness:
                    return -1;
                default:
                    return 1;
            }
        case ItemCategory.WAND:
        case ItemCategory.STAFF: {
            const table = getTableForCategory(category);
            if (table) {
                const bolt = ctx.boltCatalog[table[kind].power];
                // BF_TARGET_ALLIES flag means harmful when used on self/allies
                if (bolt && bolt.flags & 0x20 /* BF_TARGET_ALLIES */) {
                    return -1;
                }
            }
            return 1;
        }
        case ItemCategory.RING:
            return 0;
        case ItemCategory.CHARM:
            return 1;
        default:
            return 0;
    }
}

// =============================================================================
// eat — C: Items.c:6686
// =============================================================================

/**
 * Port of C `eat()`.
 * The player eats the given food item.
 */
export function eat(theItem: Item, recordCommands: boolean, ctx: ItemHandlerContext): boolean {
    if (!(theItem.category & ItemCategory.FOOD)) return false;

    if (STOMACH_SIZE - ctx.player.status[StatusEffect.Nutrition]
        < ctx.foodTable[theItem.kind].power) {
        const foodName = theItem.kind === FoodKind.Ration ? "food" : "mango";
        if (!ctx.confirm(
            `You're not hungry enough to fully enjoy the ${foodName}. Eat it anyway?`,
            false,
        )) {
            return false;
        }
    }

    ctx.player.status[StatusEffect.Nutrition] = Math.min(
        ctx.foodTable[theItem.kind].power + ctx.player.status[StatusEffect.Nutrition],
        STOMACH_SIZE,
    );

    if (theItem.kind === FoodKind.Ration) {
        ctx.messageWithColor("That food tasted delicious!", ctx.itemMessageColor, 0);
    } else {
        ctx.messageWithColor("My, what a yummy mango!", ctx.itemMessageColor, 0);
    }

    if (recordCommands) {
        recordApplyItemCommand(theItem, ctx);
    }

    consumePackItem(theItem, ctx);
    return true;
}

// =============================================================================
// readScroll — C: Items.c:6957
// =============================================================================

/**
 * Port of C `readScroll()`.
 * The player reads a scroll. Returns true if the scroll was consumed.
 */
export function readScroll(theItem: Item, ctx: ItemHandlerContext): boolean {
    const scrollKind = ctx.scrollTable[theItem.kind];

    // Warn about known-cursed scrolls
    if (magicCharDiscoverySuffix(theItem.category, theItem.kind, ctx) === -1
        && ((theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) || scrollKind.identified)) {

        const prompt = scrollKind.identified
            ? `Really read a scroll of ${scrollKind.name}?`
            : "Really read a cursed scroll?";
        if (!ctx.confirm(prompt, false)) {
            return false;
        }
    }

    // Past the point of no return
    recordApplyItemCommand(theItem, ctx);

    let hadEffect: boolean;

    switch (theItem.kind) {
        case ScrollKind.Identify:
            identify(theItem, ctx.gc);
            updateIdentifiableItems(ctx);
            ctx.messageWithColor(
                "this is a scroll of identify.",
                ctx.itemMessageColor,
                ctx.REQUIRE_ACKNOWLEDGMENT,
            );
            if (ctx.numberOfMatchingPackItems(
                ALL_ITEMS,
                ItemFlag.ITEM_CAN_BE_IDENTIFIED, 0, false,
            ) === 0) {
                ctx.message("everything in your pack is already identified.", 0);
                break;
            }
            {
                let chosen: Item | null;
                do {
                    chosen = ctx.promptForItemOfType(
                        ALL_ITEMS,
                        ItemFlag.ITEM_CAN_BE_IDENTIFIED, 0,
                        ctx.KEYBOARD_LABELS
                            ? "Identify what? (a-z; shift for more info)"
                            : "Identify what?",
                        false,
                    );
                    if (ctx.rogue.gameHasEnded) return false;
                    if (chosen && !(chosen.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED)) {
                        ctx.confirmMessages();
                        const name2 = itemName(chosen, true, true, ctx.namingCtx);
                        const pronoun = chosen.quantity > 1 ? "they're" : "it's";
                        ctx.messageWithColor(
                            `you already know ${pronoun} ${name2}.`,
                            ctx.itemMessageColor, 0,
                        );
                    }
                } while (!chosen || !(chosen.flags & ItemFlag.ITEM_CAN_BE_IDENTIFIED));

                ctx.recordKeystroke(chosen.inventoryLetter.charCodeAt(0), false, false);
                ctx.confirmMessages();
                identify(chosen, ctx.gc);
                const identifiedName = itemName(chosen, true, true, ctx.namingCtx);
                const verb = chosen.quantity === 1 ? "this is" : "these are";
                ctx.messageWithColor(`${verb} ${identifiedName}.`, ctx.itemMessageColor, 0);
            }
            break;

        case ScrollKind.Teleport:
            ctx.teleport(ctx.player, ctx.INVALID_POS, true);
            break;

        case ScrollKind.RemoveCurse:
            hadEffect = false;
            for (const packItem of ctx.packItems) {
                if (uncurse(packItem)) hadEffect = true;
            }
            if (hadEffect) {
                ctx.message("your pack glows with a cleansing light, and a malevolent energy disperses.", 0);
            } else {
                ctx.message("your pack glows with a cleansing light, but nothing happens.", 0);
            }
            break;

        case ScrollKind.Enchanting:
            identify(theItem, ctx.gc);
            ctx.messageWithColor(
                "this is a scroll of enchanting.",
                ctx.itemMessageColor,
                ctx.REQUIRE_ACKNOWLEDGMENT,
            );
            {
                const enchantableCategories = ItemCategory.WEAPON | ItemCategory.ARMOR
                    | ItemCategory.RING | ItemCategory.STAFF | ItemCategory.WAND | ItemCategory.CHARM;
                if (!ctx.numberOfMatchingPackItems(enchantableCategories, 0, 0, false)) {
                    ctx.confirmMessages();
                    ctx.message("you have nothing that can be enchanted.", 0);
                    break;
                }
                let enchantTarget: Item | null;
                do {
                    enchantTarget = ctx.promptForItemOfType(
                        enchantableCategories, 0, 0,
                        ctx.KEYBOARD_LABELS
                            ? "Enchant what? (a-z; shift for more info)"
                            : "Enchant what?",
                        false,
                    );
                    ctx.confirmMessages();
                    if (!enchantTarget || !(enchantTarget.category & enchantableCategories)) {
                        ctx.messageWithColor("Can't enchant that.", ctx.itemMessageColor, ctx.REQUIRE_ACKNOWLEDGMENT);
                    }
                    if (ctx.rogue.gameHasEnded) return false;
                } while (!enchantTarget || !(enchantTarget.category & enchantableCategories));

                ctx.recordKeystroke(enchantTarget.inventoryLetter.charCodeAt(0), false, false);
                ctx.confirmMessages();

                const magnitude = ctx.enchantMagnitude();
                enchantTarget.timesEnchanted += magnitude;

                switch (enchantTarget.category) {
                    case ItemCategory.WEAPON:
                        enchantTarget.strengthRequired = Math.max(0, enchantTarget.strengthRequired - magnitude);
                        enchantTarget.enchant1 += magnitude;
                        if (enchantTarget.quiverNumber) {
                            enchantTarget.quiverNumber = ctx.randRange(1, 60000);
                        }
                        break;
                    case ItemCategory.ARMOR:
                        enchantTarget.strengthRequired = Math.max(0, enchantTarget.strengthRequired - magnitude);
                        enchantTarget.enchant1 += magnitude;
                        break;
                    case ItemCategory.RING:
                        enchantTarget.enchant1 += magnitude;
                        ctx.updateRingBonuses();
                        if (enchantTarget.kind === RingKind.Clairvoyance) {
                            ctx.updateClairvoyance();
                            ctx.displayLevel();
                        }
                        break;
                    case ItemCategory.STAFF:
                        enchantTarget.enchant1 += magnitude;
                        enchantTarget.charges += magnitude;
                        enchantTarget.enchant2 = Math.floor(500 / enchantTarget.enchant1);
                        break;
                    case ItemCategory.WAND:
                        enchantTarget.charges += ctx.wandTable[enchantTarget.kind].range.lowerBound * magnitude;
                        break;
                    case ItemCategory.CHARM:
                        enchantTarget.enchant1 += magnitude;
                        enchantTarget.charges = Math.min(0, enchantTarget.charges);
                        break;
                    default: break;
                }

                if ((enchantTarget.category & (ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.STAFF | ItemCategory.RING | ItemCategory.CHARM))
                    && enchantTarget.enchant1 >= 16) {
                    ctx.rogue.featRecord[0 /* FEAT_SPECIALIST */] = true;
                }

                if (enchantTarget.flags & ItemFlag.ITEM_EQUIPPED) {
                    ctx.equipItem(enchantTarget, true, null);
                }

                const eName = itemName(enchantTarget, false, false, ctx.namingCtx);
                const gleamS = enchantTarget.quantity === 1 ? "s" : "";
                ctx.messageWithColor(
                    `your ${eName} gleam${gleamS} briefly in the darkness.`,
                    ctx.itemMessageColor, 0,
                );
                if (uncurse(enchantTarget)) {
                    ctx.messageWithColor(
                        `a malevolent force leaves your ${eName}.`,
                        ctx.itemMessageColor, 0,
                    );
                }
                ctx.createFlare(ctx.player.loc.x, ctx.player.loc.y, ctx.SCROLL_ENCHANTMENT_LIGHT);
            }
            break;

        case ScrollKind.Recharging:
            ctx.rechargeItems(ItemCategory.STAFF | ItemCategory.CHARM);
            break;

        case ScrollKind.ProtectArmor:
            if (ctx.rogue.armor) {
                const tempItem = ctx.rogue.armor;
                tempItem.flags |= ItemFlag.ITEM_PROTECTED;
                const aName = itemName(tempItem, false, false, ctx.namingCtx);
                ctx.messageWithColor(
                    `a protective golden light covers your ${aName}.`,
                    ctx.itemMessageColor, 0,
                );
                if (uncurse(tempItem)) {
                    ctx.messageWithColor(
                        `a malevolent force leaves your ${aName}.`,
                        ctx.itemMessageColor, 0,
                    );
                }
            } else {
                ctx.message("a protective golden light surrounds you, but it quickly disperses.", 0);
            }
            ctx.createFlare(ctx.player.loc.x, ctx.player.loc.y, ctx.SCROLL_PROTECTION_LIGHT);
            break;

        case ScrollKind.ProtectWeapon:
            if (ctx.rogue.weapon) {
                const tempItem = ctx.rogue.weapon;
                tempItem.flags |= ItemFlag.ITEM_PROTECTED;
                const wName = itemName(tempItem, false, false, ctx.namingCtx);
                ctx.messageWithColor(
                    `a protective golden light covers your ${wName}.`,
                    ctx.itemMessageColor, 0,
                );
                if (uncurse(tempItem)) {
                    ctx.messageWithColor(
                        `a malevolent force leaves your ${wName}.`,
                        ctx.itemMessageColor, 0,
                    );
                }
                if (ctx.rogue.weapon.quiverNumber) {
                    ctx.rogue.weapon.quiverNumber = ctx.randRange(1, 60000);
                }
            } else {
                ctx.message("a protective golden light covers your empty hands, but it quickly disperses.", 0);
            }
            ctx.createFlare(ctx.player.loc.x, ctx.player.loc.y, ctx.SCROLL_PROTECTION_LIGHT);
            break;

        case ScrollKind.Sanctuary:
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_SACRED_GLYPHS],
                true, false,
            );
            ctx.messageWithColor(
                "sprays of color arc to the ground, forming glyphs where they alight.",
                ctx.itemMessageColor, 0,
            );
            break;

        case ScrollKind.MagicMapping:
            ctx.confirmMessages();
            ctx.messageWithColor("this scroll has a map on it!", ctx.itemMessageColor, 0);
            // Reveal secrets
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_IS_SECRET)) {
                        ctx.discover(i, j);
                        magicMapCell(i, j, ctx);
                        ctx.pmap[i][j].flags &= ~(TileFlag.STABLE_MEMORY | TileFlag.DISCOVERED);
                    }
                }
            }
            // Reveal undiscovered non-granite cells
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (!(ctx.pmap[i][j].flags & TileFlag.DISCOVERED)
                        && ctx.pmap[i][j].layers[DungeonLayer.Dungeon] !== 0 /* GRANITE */) {
                        magicMapCell(i, j, ctx);
                    }
                }
            }
            // Mark trap-free
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (!ctx.cellHasTerrainFlag({ x: i, y: j }, TerrainFlag.T_IS_DF_TRAP)) {
                        ctx.pmap[i][j].flags |= TileFlag.KNOWN_TO_BE_TRAP_FREE;
                    }
                }
            }
            ctx.colorFlash(
                ctx.magicMapFlashColor, 0, ctx.MAGIC_MAPPED,
                15, DCOLS + DROWS,
                ctx.player.loc.x, ctx.player.loc.y,
            );
            break;

        case ScrollKind.AggravateMonster:
            ctx.aggravateMonsters(
                DCOLS + DROWS,
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.gray,
            );
            ctx.message("the scroll emits a piercing shriek that echoes throughout the dungeon!", 0);
            break;

        case ScrollKind.SummonMonster: {
            let numberOfMonsters = 0;
            for (let j = 0; j < 25 && numberOfMonsters < 3; j++) {
                for (let i = 0; i < 8; i++) {
                    const x = ctx.player.loc.x + ctx.nbDirs[i][0];
                    const y = ctx.player.loc.y + ctx.nbDirs[i][1];
                    if (!ctx.cellHasTMFlag({ x, y }, 0 /* T_OBSTRUCTS_PASSABILITY — use TerrainFlag */)
                        && !(ctx.pmap[x]?.[y]?.flags & TileFlag.HAS_MONSTER)
                        && ctx.randPercent(10) && numberOfMonsters < 3) {
                        const monst = ctx.spawnHorde(
                            0, { x, y },
                            ctx.HORDE_LEADER_CAPTIVE | ctx.HORDE_NO_PERIODIC_SPAWN
                                | ctx.HORDE_IS_SUMMONED | ctx.HORDE_MACHINE_ONLY,
                            0,
                        );
                        if (monst) {
                            ctx.wakeUp(monst);
                            ctx.fadeInMonster(monst);
                            numberOfMonsters++;
                        }
                    }
                }
            }
            if (numberOfMonsters > 1) {
                ctx.message("the fabric of space ripples, and monsters appear!", 0);
            } else if (numberOfMonsters === 1) {
                ctx.message("the fabric of space ripples, and a monster appears!", 0);
            } else {
                ctx.message("the fabric of space boils violently around you, but nothing happens.", 0);
            }
            break;
        }

        case ScrollKind.Negation:
            ctx.negationBlast("the scroll", DCOLS);
            break;

        case ScrollKind.Shattering:
            ctx.messageWithColor(
                "the scroll emits a wave of turquoise light that pierces the nearby walls!",
                ctx.itemMessageColor, 0,
            );
            ctx.crystalize(9);
            break;

        case ScrollKind.Discord:
            ctx.discordBlast("the scroll", DCOLS);
            break;
    }

    // Auto-identify on use (except enchanting and identify — they self-identify above)
    if (!scrollKind.identified
        && theItem.kind !== ScrollKind.Enchanting
        && theItem.kind !== ScrollKind.Identify) {
        autoIdentify(theItem, ctx);
    }

    return true;
}

// =============================================================================
// drinkPotion — C: Items.c:7239
// =============================================================================

/**
 * Port of C `drinkPotion()`.
 * The player drinks a potion. Returns true if consumed.
 */
export function drinkPotion(theItem: Item, ctx: ItemHandlerContext): boolean {
    const potionKind = ctx.potionTable[theItem.kind];

    // Warn about known-cursed potions
    if (magicCharDiscoverySuffix(theItem.category, theItem.kind, ctx) === -1
        && ((theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) || potionKind.identified)) {

        const prompt = potionKind.identified
            ? `Really drink a potion of ${potionKind.name}?`
            : "Really drink a cursed potion?";
        if (!ctx.confirm(prompt, false)) return false;
    }

    ctx.confirmMessages();
    const magnitude = ctx.randClump(potionKind.range);

    switch (theItem.kind) {
        case PotionKind.Life:
            {
                const healPrefix = ctx.player.currentHP < ctx.player.info.maxHP
                    ? "you heal completely and " : "";
                const pctIncrease = Math.floor(
                    (ctx.player.info.maxHP + magnitude) * 100 / ctx.player.info.maxHP - 100,
                );
                ctx.player.info.maxHP += magnitude;
                ctx.heal(ctx.player, 100, true);
                ctx.updatePlayerRegenerationDelay();
                ctx.messageWithColor(
                    `${healPrefix}your maximum health increases by ${pctIncrease}%.`,
                    ctx.advancementMessageColor, 0,
                );
            }
            break;

        case PotionKind.Hallucination:
            ctx.player.status[StatusEffect.Hallucinating] = magnitude;
            ctx.player.maxStatus[StatusEffect.Hallucinating] = magnitude;
            ctx.message("colors are everywhere! The walls are singing!", 0);
            break;

        case PotionKind.Incineration:
            ctx.message("as you uncork the flask, it explodes in flame!", 0);
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_INCINERATION_POTION],
                true, false,
            );
            ctx.exposeCreatureToFire(ctx.player);
            break;

        case PotionKind.Darkness:
            ctx.player.status[StatusEffect.Darkness] = Math.max(magnitude, ctx.player.status[StatusEffect.Darkness]);
            ctx.player.maxStatus[StatusEffect.Darkness] = Math.max(magnitude, ctx.player.maxStatus[StatusEffect.Darkness]);
            ctx.updateMinersLightRadius();
            ctx.updateVision(true);
            ctx.message("your vision flickers as a cloak of darkness settles around you!", 0);
            break;

        case PotionKind.Descent:
            ctx.colorFlash(ctx.darkBlue, 0, ctx.IN_FIELD_OF_VIEW, 3, 3, ctx.player.loc.x, ctx.player.loc.y);
            ctx.message("vapor pours out of the flask and causes the floor to disappear!", 0);
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_HOLE_POTION],
                true, false,
            );
            if (!ctx.player.status[StatusEffect.Levitating]) {
                ctx.player.bookkeepingFlags |= 0; // MB_IS_FALLING — use proper flag
            }
            break;

        case PotionKind.Strength:
            ctx.rogue.strength += magnitude;
            if (ctx.player.status[StatusEffect.Weakened]) {
                ctx.player.status[StatusEffect.Weakened] = 1;
            }
            ctx.player.weaknessAmount = 0;
            ctx.updateEncumbrance();
            ctx.messageWithColor("newfound strength surges through your body.", ctx.advancementMessageColor, 0);
            ctx.createFlare(ctx.player.loc.x, ctx.player.loc.y, ctx.POTION_STRENGTH_LIGHT);
            break;

        case PotionKind.Poison:
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_POISON_GAS_CLOUD_POTION],
                true, false,
            );
            ctx.message("caustic gas billows out of the open flask!", 0);
            break;

        case PotionKind.Paralysis:
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_PARALYSIS_GAS_CLOUD_POTION],
                true, false,
            );
            ctx.message("your muscles stiffen as a cloud of pink gas bursts from the open flask!", 0);
            break;

        case PotionKind.Telepathy:
            ctx.makePlayerTelepathic(magnitude);
            break;

        case PotionKind.Levitation:
            ctx.player.status[StatusEffect.Levitating] = magnitude;
            ctx.player.maxStatus[StatusEffect.Levitating] = magnitude;
            ctx.player.bookkeepingFlags &= ~0; // ~MB_SEIZED — use proper flag
            ctx.message("you float into the air!", 0);
            break;

        case PotionKind.Confusion:
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_CONFUSION_GAS_CLOUD_POTION],
                true, false,
            );
            ctx.message("a shimmering cloud of rainbow-colored gas billows out of the open flask!", 0);
            break;

        case PotionKind.Lichen:
            ctx.message("a handful of tiny spores burst out of the open flask!", 0);
            ctx.spawnDungeonFeature(
                ctx.player.loc.x, ctx.player.loc.y,
                ctx.dungeonFeatureCatalog[ctx.DF_LICHEN_PLANTED],
                true, false,
            );
            break;

        case PotionKind.DetectMagic: {
            let hadEffectOnLevel = false;
            let hadEffectOnPack = false;

            // Floor items
            for (const floorItem of ctx.floorItems) {
                if (floorItem.category & CAN_BE_DETECTED) {
                    detectMagicOnItem(floorItem);
                    if (ctx.itemMagicPolarity(floorItem)) {
                        ctx.pmap[floorItem.loc.x][floorItem.loc.y].flags |= TileFlag.ITEM_DETECTED;
                        hadEffectOnLevel = true;
                        ctx.refreshDungeonCell(floorItem.loc);
                    }
                }
            }

            // Monster carried items
            for (const monst of ctx.monsters) {
                if (monst.carriedItem && (monst.carriedItem.category & CAN_BE_DETECTED)) {
                    detectMagicOnItem(monst.carriedItem);
                    if (ctx.itemMagicPolarity(monst.carriedItem)) {
                        hadEffectOnLevel = true;
                        ctx.refreshDungeonCell(monst.loc);
                    }
                }
            }

            // Pack items
            for (const packItem of ctx.packItems) {
                if (packItem.category & CAN_BE_DETECTED) {
                    detectMagicOnItem(packItem);
                    if (ctx.itemMagicPolarity(packItem)) {
                        if (packItem !== theItem && (packItem.flags & ItemFlag.ITEM_MAGIC_DETECTED)) {
                            hadEffectOnPack = true;
                        }
                    }
                }
            }

            if (hadEffectOnLevel || hadEffectOnPack) {
                tryIdentifyLastItemKinds(HAS_INTRINSIC_POLARITY, ctx.gc);
                if (hadEffectOnLevel && hadEffectOnPack) {
                    ctx.message("you can somehow feel the presence of magic on the level and in your pack.", 0);
                } else if (hadEffectOnLevel) {
                    ctx.message("you can somehow feel the presence of magic on the level.", 0);
                } else {
                    ctx.message("you can somehow feel the presence of magic in your pack.", 0);
                }
            } else {
                ctx.message("you can somehow feel the absence of magic on the level and in your pack.", 0);
            }
            break;
        }

        case PotionKind.HasteSelf:
            ctx.haste(ctx.player, magnitude);
            break;

        case PotionKind.FireImmunity:
            ctx.player.status[StatusEffect.ImmuneToFire] = magnitude;
            ctx.player.maxStatus[StatusEffect.ImmuneToFire] = magnitude;
            if (ctx.player.status[StatusEffect.Burning]) {
                ctx.extinguishFireOnCreature(ctx.player);
            }
            ctx.message("a comforting breeze envelops you, and you no longer fear fire.", 0);
            break;

        case PotionKind.Invisibility:
            ctx.player.status[StatusEffect.Invisible] = magnitude;
            ctx.player.maxStatus[StatusEffect.Invisible] = magnitude;
            ctx.message("you shiver as a chill runs up your spine.", 0);
            break;

        default:
            ctx.messageWithColor(
                "you feel very strange, as though your body doesn't know how to react!",
                ctx.itemMessageColor,
                ctx.REQUIRE_ACKNOWLEDGMENT,
            );
    }

    if (!potionKind.identified) {
        autoIdentify(theItem, ctx);
    }

    recordApplyItemCommand(theItem, ctx);
    consumePackItem(theItem, ctx);
    return true;
}

// =============================================================================
// useStaffOrWand — C: Items.c:6545
// =============================================================================

/**
 * Port of C `useStaffOrWand()`.
 * The player zaps a staff or wand at a target. Returns true if the turn was used.
 */
export function useStaffOrWand(theItem: Item, ctx: ItemHandlerContext): boolean {
    const theTable = getTableForCategory(theItem.category, {
        scrollTable: ctx.scrollTable,
        potionTable: ctx.potionTable,
    });
    if (!theTable) return false;

    const buf2 = itemName(theItem, false, false, ctx.namingCtx);

    if (theItem.charges <= 0 && (theItem.flags & ItemFlag.ITEM_IDENTIFIED)) {
        ctx.messageWithColor(`Your ${buf2} has no charges.`, ctx.itemMessageColor, 0);
        return false;
    }

    ctx.temporaryMessage(
        "Direction? (<hjklyubn>, mouse, or <tab>; <return> to confirm)",
        ctx.REFRESH_SIDEBAR,
    );
    ctx.printString(
        `Zapping your ${buf2}:`,
        ctx.mapToWindowX(0), 1,
        ctx.itemMessageColor, ctx.black, null,
    );

    const theBolt: Bolt = { ...ctx.boltCatalog[theTable[theItem.kind].power] };
    if (theItem.category === ItemCategory.STAFF) {
        theBolt.magnitude = theItem.enchant1;
    }

    let maxDistance: number;
    if ((theItem.category & ItemCategory.STAFF)
        && theItem.kind === StaffKind.Blinking
        && (theItem.flags & (ItemFlag.ITEM_IDENTIFIED | ItemFlag.ITEM_MAX_CHARGES_KNOWN))) {
        maxDistance = ctx.staffBlinkDistance(netEnchant(theItem, ctx.rogue.strength, ctx.player.weaknessAmount));
    } else {
        maxDistance = -1;
    }

    const boltKnown = theTable[theItem.kind].identified;
    const originLoc: Pos = { ...ctx.player.loc };
    const { confirmed: confirmedTarget, target: zapTarget } =
        ctx.chooseTarget(maxDistance, 0 /* AUTOTARGET_MODE_USE_STAFF_OR_WAND */, theItem);

    if (confirmedTarget && boltKnown
        && theBolt.boltEffect === BoltEffect.Blinking
        && ctx.playerCancelsBlinking(originLoc, zapTarget, maxDistance)) {
        return false;
    }

    if (!confirmedTarget) return false;

    recordApplyItemCommand(theItem, ctx);
    ctx.recordMouseClick(ctx.mapToWindowX(zapTarget.x), ctx.mapToWindowY(zapTarget.y), true, false);
    ctx.confirmMessages();

    ctx.rogue.featRecord[0 /* FEAT_PURE_WARRIOR */] = false;

    if (theItem.charges > 0) {
        const monst = ctx.monsterAtLoc(zapTarget);
        const msg = monst
            ? `you zap your ${buf2} at ${ctx.monsterName(monst, true)}.`
            : `you zap your ${buf2}.`;
        ctx.message(msg, 0);

        // TODO: call zap() bolt function when ported
        // autoID = zap(originLoc, zapTarget, theBolt, !boltKnown, false);
    } else {
        const depletedMsg = theItem.category === ItemCategory.STAFF
            ? `Your ${buf2} fizzles; it must be out of charges for now.`
            : `Your ${buf2} fizzles; it must be depleted.`;
        ctx.messageWithColor(depletedMsg, ctx.itemMessageColor, 0);
        theItem.flags |= ItemFlag.ITEM_MAX_CHARGES_KNOWN;
        ctx.playerTurnEnded();
        return false;
    }

    if (theItem.category & ItemCategory.STAFF) {
        theItem.lastUsed[2] = theItem.lastUsed[1];
        theItem.lastUsed[1] = theItem.lastUsed[0];
        theItem.lastUsed[0] = ctx.rogue.absoluteTurnNumber;
    }

    if (theItem.charges > 0) {
        theItem.charges--;
        if (theItem.category === ItemCategory.WAND) {
            theItem.enchant2++;
        }
    }

    return true;
}

// =============================================================================
// useCharm — C: Items.c:6716
// =============================================================================

/**
 * Port of C `useCharm()`.
 * The player uses a charm. Returns true if the charm was used.
 */
export function useCharm(theItem: Item, ctx: ItemHandlerContext): boolean {
    if (theItem.charges > 0) {
        const buf2 = itemName(theItem, false, false, ctx.namingCtx);
        ctx.messageWithColor(`Your ${buf2} hasn't finished recharging.`, ctx.itemMessageColor, 0);
        return false;
    }

    const enchant = netEnchant(theItem, ctx.rogue.strength, ctx.player.weaknessAmount);
    ctx.rogue.featRecord[0 /* FEAT_PURE_WARRIOR */] = false;

    switch (theItem.kind) {
        case CharmKind.Health:
            ctx.heal(ctx.player, ctx.charmHealing(enchant), false);
            ctx.message("You feel much healthier.", 0);
            break;

        case CharmKind.Protection:
            if (ctx.charmProtection(enchant) > ctx.player.status[StatusEffect.Shielded]) {
                ctx.player.status[StatusEffect.Shielded] = ctx.charmProtection(enchant);
            }
            ctx.player.maxStatus[StatusEffect.Shielded] = ctx.player.status[StatusEffect.Shielded];
            if (ctx.boltCatalog[ctx.BOLT_SHIELDING].backColor) {
                ctx.flashMonster(ctx.player, ctx.boltCatalog[ctx.BOLT_SHIELDING].backColor, 100);
            }
            ctx.message("A shimmering shield coalesces around you.", 0);
            break;

        case CharmKind.Haste:
            ctx.haste(ctx.player, ctx.charmEffectDuration(theItem.kind, theItem.enchant1));
            break;

        case CharmKind.FireImmunity:
            ctx.player.status[StatusEffect.ImmuneToFire] = ctx.charmEffectDuration(theItem.kind, theItem.enchant1);
            ctx.player.maxStatus[StatusEffect.ImmuneToFire] = ctx.player.status[StatusEffect.ImmuneToFire];
            if (ctx.player.status[StatusEffect.Burning]) {
                ctx.extinguishFireOnCreature(ctx.player);
            }
            ctx.message("you no longer fear fire.", 0);
            break;

        case CharmKind.Invisibility:
            ctx.imbueInvisibility(ctx.player, ctx.charmEffectDuration(theItem.kind, theItem.enchant1));
            ctx.message("You shiver as a chill runs up your spine.", 0);
            break;

        case CharmKind.Telepathy:
            ctx.makePlayerTelepathic(ctx.charmEffectDuration(theItem.kind, theItem.enchant1));
            break;

        case CharmKind.Levitation:
            ctx.player.status[StatusEffect.Levitating] = ctx.charmEffectDuration(theItem.kind, theItem.enchant1);
            ctx.player.maxStatus[StatusEffect.Levitating] = ctx.player.status[StatusEffect.Levitating];
            ctx.player.bookkeepingFlags &= ~0; // ~MB_SEIZED
            ctx.message("you float into the air!", 0);
            break;

        case CharmKind.Shattering:
            ctx.messageWithColor(
                "your charm emits a wave of turquoise light that pierces the nearby walls!",
                ctx.itemMessageColor, 0,
            );
            ctx.crystalize(ctx.charmShattering(enchant));
            break;

        case CharmKind.Guardian:
            ctx.messageWithColor(
                "your charm flashes and the form of a mythical guardian coalesces!",
                ctx.itemMessageColor, 0,
            );
            ctx.summonGuardian(theItem);
            break;

        case CharmKind.Teleportation:
            ctx.teleport(ctx.player, ctx.INVALID_POS, true);
            break;

        case CharmKind.Recharging:
            ctx.rechargeItems(ItemCategory.STAFF);
            break;

        case CharmKind.Negation:
            ctx.negationBlast("your charm", ctx.charmNegationRadius(enchant) + 1);
            break;

        default: break;
    }

    theItem.charges = ctx.charmRechargeDelay(theItem.kind, theItem.enchant1);
    recordApplyItemCommand(theItem, ctx);
    return true;
}

// =============================================================================
// apply — C: Items.c:6793
// =============================================================================

/**
 * Port of C `apply()`.
 * Main dispatcher for using an item from the inventory.
 */
export function apply(theItem: Item | null, ctx: ItemHandlerContext): void {
    if (!theItem) {
        theItem = ctx.promptForItemOfType(
            ItemCategory.SCROLL | ItemCategory.FOOD | ItemCategory.POTION
                | ItemCategory.STAFF | ItemCategory.WAND | ItemCategory.CHARM,
            0, 0,
            ctx.KEYBOARD_LABELS
                ? "Apply what? (a-z, shift for more info; or <esc> to cancel)"
                : "Apply what?",
            true,
        );
    }

    if (!theItem) return;

    ctx.confirmMessages();

    switch (theItem.category) {
        case ItemCategory.FOOD:
            if (eat(theItem, true, ctx)) break;
            return;
        case ItemCategory.POTION:
            if (drinkPotion(theItem, ctx)) break;
            return;
        case ItemCategory.SCROLL:
            if (readScroll(theItem, ctx)) {
                consumePackItem(theItem, ctx);
                break;
            }
            return;
        case ItemCategory.STAFF:
        case ItemCategory.WAND:
            if (useStaffOrWand(theItem, ctx)) break;
            return;
        case ItemCategory.CHARM:
            if (useCharm(theItem, ctx)) break;
            return;
        default: {
            const name = itemName(theItem, false, true, ctx.namingCtx);
            ctx.message(`you can't apply ${name}.`, 0);
            return;
        }
    }

    ctx.playerTurnEnded();
}
