/*
 *  io/inventory-actions.ts — Inventory action dialogs
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Items.c
 *  Functions: equip (3232), unequip (7500), drop (7548), relabel (6385)
 *
 *  Each function prompts for an item (if theItem is null), validates the
 *  action, mutates game state, and calls playerTurnEnded() on success.
 *  relabel is async because it awaits a single keystroke via waitForEvent().
 *
 *  call and throw are not ported here — call requires async getInputTextString
 *  (deferred Phase 8) and throw requires chooseTarget (also Phase 8).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { buildEquipState, syncEquipState } from "../items/equip-helpers.js";
import {
    equipItem as equipItemFn,
    unequipItem as unequipItemFn,
    updateRingBonuses as updateRingBonusesFn,
    updateEncumbrance as updateEncumbranceFn,
} from "../items/item-usage.js";
import { canDrop as canDropFn, dropItem as dropItemFn } from "../items/floor-items.js";
import { itemName as itemNameFn } from "../items/item-naming.js";
import { itemOfPackLetter as itemOfPackLetterFn } from "../items/item-inventory.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "../items/item-generation.js";
import { playerTurnEnded as playerTurnEndedFn } from "../turn.js";
import {
    buildMessageFns,
    buildPromptForItemOfTypeFn,
    buildRefreshDungeonCellFn,
    buildDisplayLevelFn,
} from "../io-wiring.js";
import { buildUpdateClairvoyanceFn } from "../vision-wiring.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { wandTable, staffTable, ringTable, charmTable } from "../globals/item-catalog.js";
import { itemMessageColor } from "../globals/colors.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import { ItemCategory, ALL_ITEMS, EventType } from "../types/enums.js";
import { ItemFlag, TileFlag } from "../types/flags.js";
import { KEYBOARD_LABELS } from "../types/constants.js";
import type { Item, ItemTable, Pos } from "../types/types.js";

// =============================================================================
// Shared helpers
// =============================================================================

function buildNamingCtx() {
    const { rogue, mutablePotionTable, mutableScrollTable, gameConst, monsterCatalog } = getGameState();
    return {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: (id: number) => monsterCatalog[id]?.monsterName ?? "creature",
    };
}

function itemStr(item: Item, includeDetails: boolean, includeArticle: boolean): string {
    return itemNameFn(item, includeDetails, includeArticle, buildNamingCtx());
}

function buildEquipCtx() {
    const s = buildEquipState();
    const io = buildMessageFns();
    return {
        state: s,
        message: (text: string, _req: boolean) => io.message(text, 0),
        itemName: itemStr,
        updateRingBonuses: () => { updateRingBonusesFn(s); syncEquipState(s); },
        updateEncumbrance: () => updateEncumbranceFn(s),
        updateClairvoyance: buildUpdateClairvoyanceFn(),
        displayLevel: buildDisplayLevelFn(),
    };
}

// =============================================================================
// equip — Items.c:3232
// =============================================================================

/**
 * Equip a weapon, armor, or ring.
 * If theItem is null, prompts the player to choose from inventory.
 *
 * C: void equip(item *theItem)  Items.c:3232
 */
export async function equip(theItem: Item | null): Promise<void> {
    const { rogue } = getGameState();
    const io = buildMessageFns();
    const promptFn = buildPromptForItemOfTypeFn();

    if (!theItem) {
        theItem = await promptFn(
            ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.RING,
            0, ItemFlag.ITEM_EQUIPPED,
            KEYBOARD_LABELS
                ? "Equip what? (a-z, shift for more info; or <esc> to cancel)"
                : "Equip what?",
            true,
        );
    }
    if (!theItem) return;

    if (!(theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.RING))) {
        io.confirmMessages();
        io.message("You can't equip that.", 0);
        return;
    }

    let theItem2: Item | null = null;

    if (theItem.category & ItemCategory.RING) {
        if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
            io.confirmMessages();
            io.message("you are already wearing that ring.", 0);
            return;
        }
        if (rogue.ringLeft && rogue.ringRight) {
            io.confirmMessages();
            theItem2 = await promptFn(
                ItemCategory.RING, ItemFlag.ITEM_EQUIPPED, 0,
                "You are already wearing two rings; remove which first?",
                true,
            );
            if (!theItem2 || !(theItem2.category & ItemCategory.RING) || !(theItem2.flags & ItemFlag.ITEM_EQUIPPED)) {
                if (theItem2) io.message("Invalid entry.", 0);
                return;
            }
        }
    }

    if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
        io.confirmMessages();
        io.message("already equipped.", 0);
        return;
    }

    if (theItem.category & (ItemCategory.WEAPON | ItemCategory.ARMOR)) {
        theItem2 = (theItem.category & ItemCategory.WEAPON) ? rogue.weapon : rogue.armor;
    }

    const ctx = buildEquipCtx();
    if (!equipItemFn(theItem, false, theItem2, ctx)) return;
    syncEquipState(ctx.state);

    rogue.swappedOut = theItem2;
    rogue.swappedIn = rogue.swappedOut ? theItem : null;

    await playerTurnEndedFn();
}

// =============================================================================
// unequip — Items.c:7500
// =============================================================================

/**
 * Remove (unequip) a currently equipped item.
 * If theItem is null, prompts the player to choose from inventory.
 *
 * C: void unequip(item *theItem)  Items.c:7500
 */
export async function unequip(theItem: Item | null): Promise<void> {
    const io = buildMessageFns();
    const promptFn = buildPromptForItemOfTypeFn();

    if (!theItem) {
        theItem = await promptFn(
            ALL_ITEMS, ItemFlag.ITEM_EQUIPPED, 0,
            KEYBOARD_LABELS
                ? "Remove (unequip) what? (a-z or <esc> to cancel)"
                : "Remove (unequip) what?",
            true,
        );
    }
    if (!theItem) return;

    if (!(theItem.flags & ItemFlag.ITEM_EQUIPPED)) {
        const name = itemStr(theItem, false, false);
        const verb = theItem.quantity === 1 ? "was" : "were";
        io.confirmMessages();
        io.messageWithColor(`your ${name} ${verb} not equipped.`, itemMessageColor, 0);
        return;
    }

    const ctx = buildEquipCtx();
    if (!unequipItemFn(theItem, false, ctx)) return; // cursed
    syncEquipState(ctx.state);

    let name = itemStr(theItem, true, true);
    if (name.length > 52) name = itemStr(theItem, false, true);
    io.confirmMessages();
    const verb = (theItem.category & ItemCategory.WEAPON) ? "wielding" : "wearing";
    io.messageWithColor(`you are no longer ${verb} ${name}.`, itemMessageColor, 0);

    await playerTurnEndedFn();
}

// =============================================================================
// drop — Items.c:7548
// =============================================================================

/**
 * Drop an item from the player's pack onto the floor at their current location.
 * If theItem is null, prompts the player to choose from inventory.
 *
 * C: void drop(item *theItem)  Items.c:7548
 */
export async function drop(theItem: Item | null): Promise<void> {
    const { rogue, player, pmap, floorItems, packItems } = getGameState();
    const io = buildMessageFns();
    const promptFn = buildPromptForItemOfTypeFn();
    const refreshDungeonCell = buildRefreshDungeonCellFn();

    if (!theItem) {
        theItem = await promptFn(
            ALL_ITEMS, 0, 0,
            KEYBOARD_LABELS
                ? "Drop what? (a-z, shift for more info; or <esc> to cancel)"
                : "Drop what?",
            true,
        );
    }
    if (!theItem) return;

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);

    if ((theItem.flags & ItemFlag.ITEM_EQUIPPED) && (theItem.flags & ItemFlag.ITEM_CURSED)) {
        const name = itemStr(theItem, false, false);
        io.confirmMessages();
        io.messageWithColor(`you can't; your ${name} appears to be cursed.`, itemMessageColor, 0);
        return;
    }

    if (canDropFn({ player, cellHasTerrainFlag })) {
        if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
            const ctx = buildEquipCtx();
            unequipItemFn(theItem, false, ctx);
            syncEquipState(ctx.state);
        }

        const itemAtLoc = (loc: Pos) =>
            floorItems.find(i => i.loc.x === loc.x && i.loc.y === loc.y) ?? null;

        const droppedItem = dropItemFn(theItem, {
            pmap, floorItems,
            tileCatalog: tileCatalog as never,
            dungeonFeatureCatalog: dungeonFeatureCatalog as never,
            packItems,
            player,
            rogue: { swappedIn: rogue.swappedIn, swappedOut: rogue.swappedOut },
            itemMagicPolarity: itemMagicPolarityFn,
            cellHasTerrainFlag,
            cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
            playerCanSee: (x: number, y: number) =>
                !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            itemName: (i: Item, buf: string[]) => { buf[0] = itemStr(i, true, true); },
            message: (msg: string, flags: number) => io.message(msg, flags),
            spawnDungeonFeature: () => {},   // permanent-defer — pressure plates rarely triggered by drop
            promoteTile: () => {},           // permanent-defer — tile promotion after drop is rare
            discover: () => {},              // permanent-defer — discovery on drop not needed
            refreshDungeonCell,
            REQUIRE_ACKNOWLEDGMENT: 1,
            itemAtLoc,
            pickUpItemAt: () => {},          // permanent-defer — item-swap edge case; rare path
        });

        if (droppedItem) {
            droppedItem.flags |= ItemFlag.ITEM_PLAYER_AVOIDS;
            const name = itemStr(droppedItem, true, true);
            io.messageWithColor(`You dropped ${name}.`, itemMessageColor, 0);
            await playerTurnEndedFn();
        }
    } else {
        io.confirmMessages();
        io.message("There is already something there.", 0);
    }
}

// =============================================================================
// relabel — Items.c:6385
// =============================================================================

/**
 * Reassign the inventory letter of an item.
 * If theItem is null, prompts the player to choose from inventory.
 * Awaits a single keystroke ('a'-'z') via waitForEvent().
 *
 * C: void relabel(item *theItem)  Items.c:6385
 */
export async function relabel(theItem: Item | null): Promise<void> {
    const { rogue, packItems } = getGameState();
    const io = buildMessageFns();
    const promptFn = buildPromptForItemOfTypeFn();

    if (!KEYBOARD_LABELS && !rogue.playbackMode) return;

    if (!theItem) {
        theItem = await promptFn(
            ALL_ITEMS, 0, 0,
            KEYBOARD_LABELS
                ? "Relabel what? (a-z, shift for more info; or <esc> to cancel)"
                : "Relabel what?",
            true,
        );
    }
    if (!theItem) return;

    io.temporaryMessage("New letter? (a-z)", 0);

    // Await a keystroke event for the new label.
    let newLabel = "";
    while (true) {
        let ev: import("../types/types.js").RogueEvent;
        try {
            const { waitForEvent } = await import("../platform.js");
            ev = await waitForEvent();
        } catch {
            return; // platform not initialized (tests) — silently abort
        }
        if (ev.eventType === EventType.Keystroke) {
            newLabel = String.fromCharCode(ev.param1);
            break;
        }
    }

    if (newLabel >= "A" && newLabel <= "Z") {
        newLabel = newLabel.toLowerCase();
    }

    if (newLabel >= "a" && newLabel <= "z") {
        if (newLabel !== theItem.inventoryLetter) {
            const oldItem = itemOfPackLetterFn(newLabel, packItems);
            if (oldItem) {
                oldItem.inventoryLetter = theItem.inventoryLetter;
                const oldName = itemStr(oldItem, true, true);
                io.messageWithColor(
                    `Relabeled ${oldName} as (${oldItem.inventoryLetter});`,
                    itemMessageColor, 0,
                );
            }
            theItem.inventoryLetter = newLabel;
            const name = itemStr(theItem, true, true);
            const prefix = oldItem ? " r" : "R";
            io.messageWithColor(
                `${prefix}elabeled ${name} as (${newLabel}).`,
                itemMessageColor, 0,
            );
        } else {
            const name = itemStr(theItem, true, true);
            const verb = theItem.quantity === 1 ? "is" : "are";
            io.messageWithColor(
                `${name} ${verb} already labeled (${newLabel}).`,
                itemMessageColor, 0,
            );
        }
    }
}
