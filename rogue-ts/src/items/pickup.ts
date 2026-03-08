/*
 *  items/pickup.ts — Player item pickup logic
 *  brogue-ts
 *
 *  Ported from: src/brogue/Items.c
 *  Functions: pickUpItemAt
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Pcell, Item, Color, GameConstants, FloorTileType } from "../types/types.js";
import { ItemCategory } from "../types/enums.js";
import { ItemFlag, MessageFlag, TileFlag } from "../types/flags.js";
import { MAX_PACK_ITEMS } from "../types/constants.js";
import { MonsterType } from "../types/enums.js";

// =============================================================================
// Context
// =============================================================================

export interface PickUpItemAtContext {
    player: Creature;
    rogue: {
        disturbed: boolean;
        gold: number;
        yendorWarden: Creature | null;
        featRecord: boolean[];
    };
    pmap: Pcell[][];
    monsters: Creature[];
    packItems: Item[];
    floorItems: Item[];
    gameConst: GameConstants;
    tileCatalog: readonly FloorTileType[];

    // Item helpers
    itemAtLoc(loc: Pos): Item | null;
    identifyItemKind(item: Item): void;
    wandKindData(kind: number): { identified: boolean; range: { lowerBound: number; upperBound: number } } | null;
    numberOfItemsInPack(): number;
    itemWillStackWithPack(item: Item): boolean;
    removeItemFromFloor(item: Item): boolean;
    addItemToPack(item: Item): Item;
    deleteItem(item: Item): void;
    removeItemAt(loc: Pos): void;
    numberOfMatchingPackItems(category: number, required: number, forbidden: number, checkCarried: boolean): number;

    // Monster helpers (for Amulet warden spawn)
    getRandomMonsterSpawnLocation(): Pos;
    generateMonster(kind: MonsterType, seeded: boolean, genItems: boolean): Creature;

    // Text
    itemName(item: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: number | null): void;
    messageWithColor(msg: string, color: Color, flags: number): void;
    message(msg: string, flags: number): void;

    // Colors
    itemMessageColor: Color;
    badMessageColor: Color;
}

// =============================================================================
// pickUpItemAt — from Items.c:836
// =============================================================================

/**
 * Picks up the item at `loc` into the player's pack. Handles gold, amulets,
 * full packs, and Yendor Warden spawning.
 *
 * C: void pickUpItemAt(pos loc)
 */
export function pickUpItemAt(loc: Pos, ctx: PickUpItemAtContext): void {
    const buf: string[] = [""];
    const buf2: string[] = [""];

    ctx.rogue.disturbed = true;

    const theItem = ctx.itemAtLoc(loc);
    if (!theItem) {
        ctx.message("Error: Expected item; item not found.", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
        return;
    }

    // Auto-identify on pickup
    if (
        (theItem.flags & ItemFlag.ITEM_KIND_AUTO_ID) &&
        ctx.wandKindData !== undefined
    ) {
        ctx.identifyItemKind(theItem);
    }

    // Auto-identify wands with fixed charges
    if (theItem.category & ItemCategory.WAND) {
        const wd = ctx.wandKindData(theItem.kind);
        if (wd?.identified && wd.range.lowerBound === wd.range.upperBound) {
            theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
        }
    }

    if (
        ctx.numberOfItemsInPack() < MAX_PACK_ITEMS ||
        (theItem.category & ItemCategory.GOLD) ||
        ctx.itemWillStackWithPack(theItem)
    ) {
        // Remove ITEM_DETECTED flag
        ctx.pmap[loc.x][loc.y].flags &= ~TileFlag.ITEM_DETECTED;

        if (!ctx.removeItemFromFloor(theItem)) {
            return; // should not happen
        }

        // Gold: just add to total
        if (theItem.category & ItemCategory.GOLD) {
            ctx.rogue.gold += theItem.quantity;
            ctx.rogue.featRecord[6] = false; // FEAT_TONE = 6
            buf[0] = `you found ${theItem.quantity} pieces of gold.`;
            ctx.messageWithColor(buf[0], ctx.itemMessageColor, 0);
            ctx.deleteItem(theItem);
            ctx.removeItemAt(loc);
            return;
        }

        // Duplicate Amulet check
        if (
            (theItem.category & ItemCategory.AMULET) &&
            ctx.numberOfMatchingPackItems(ItemCategory.AMULET, 0, 0, false)
        ) {
            ctx.message("you already have the Amulet of Yendor.", 0);
            ctx.deleteItem(theItem);
            return;
        }

        const stacked = ctx.addItemToPack(theItem);
        ctx.itemName(stacked, buf2, true, true, null);
        buf[0] = `you now have ${buf2[0]} (${stacked.inventoryLetter}).`;
        ctx.messageWithColor(buf[0], ctx.itemMessageColor, 0);
        ctx.removeItemAt(loc);

        // Spawn Yendor Warden when amulet is first picked up
        if ((stacked.category & ItemCategory.AMULET) && !ctx.rogue.yendorWarden) {
            // Check if warden already exists
            for (const monst of ctx.monsters) {
                if (monst.info.monsterID === MonsterType.MK_WARDEN_OF_YENDOR) {
                    ctx.rogue.yendorWarden = monst;
                    break;
                }
            }
            if (!ctx.rogue.yendorWarden) {
                const spawnLoc = ctx.getRandomMonsterSpawnLocation();
                const warden = ctx.generateMonster(MonsterType.MK_WARDEN_OF_YENDOR, false, false);
                warden.loc = spawnLoc;
                ctx.pmap[spawnLoc.x][spawnLoc.y].flags |= TileFlag.HAS_MONSTER;
                ctx.rogue.yendorWarden = warden;
            }
        }
    } else {
        // Pack full
        theItem.flags |= ItemFlag.ITEM_PLAYER_AVOIDS;
        ctx.itemName(theItem, buf2, false, true, null);
        buf[0] = `Your pack is too full to pick up ${buf2[0]}.`;
        ctx.messageWithColor(buf[0], ctx.badMessageColor, 0);
    }
}
