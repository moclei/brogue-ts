/*
 *  item-helpers.ts — Item description helpers and search/key functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: describedItemBasedOnParameters, describedItemName, useKeyAt, search
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Pcell, Item } from "../types/types.js";
import { StatusEffect } from "../types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag } from "../types/flags.js";
import { NUMBER_TERRAIN_LAYERS, KEY_ID_MAXIMUM } from "../types/constants.js";

// =============================================================================
// Context
// =============================================================================

/**
 * Context for item description helper functions.
 */
export interface ItemHelperContext {
    /** Permanent map cells (column-major). */
    pmap: Pcell[][];
    /** The player creature. */
    player: Creature;
    /** Rogue game state subset. */
    rogue: {
        playbackOmniscience: boolean;
    };
    /** Tile catalog for terrain descriptions. */
    tileCatalog: readonly {
        flags: number;
        mechFlags: number;
        discoverType: number;
        description: string;
    }[];

    // --- Item helpers ---
    initializeItem(): Item;
    itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: number | null): void;
    describeHallucinatedItem(buf: string[]): void;

    // --- Key/item management ---
    removeItemFromChain(theItem: Item, chain: Item[]): boolean;
    deleteItem(theItem: Item): void;
    monsterAtLoc(loc: Pos): Creature | null;
    promoteTile(x: number, y: number, layer: number, isVolatile: boolean): void;

    // --- UI ---
    messageWithColor(msg: string, color: any, flags: number): void;
    itemMessageColor: any;

    // --- Pack and floor items ---
    packItems: Item[];
    floorItems: Item[];

    // --- Map helpers ---
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    coordinatesAreInMap(x: number, y: number): boolean;
    playerCanDirectlySee(x: number, y: number): boolean;
    distanceBetween(p1: Pos, p2: Pos): number;
    discover(x: number, y: number): void;
    randPercent(chance: number): boolean;

    // --- Pos helpers ---
    posEq(a: Pos, b: Pos): boolean;
}

// =============================================================================
// describedItemBasedOnParameters — from Movement.c:111
// =============================================================================

/**
 * Creates a temporary item with the given properties and returns its name.
 * Used for remembered item descriptions.
 *
 * C: void describedItemBasedOnParameters(short theCategory, short theKind, short theQuantity, short theOriginDepth, char *buf)
 */
export function describedItemBasedOnParameters(
    theCategory: number,
    theKind: number,
    theQuantity: number,
    theOriginDepth: number,
    buf: string[],
    ctx: ItemHelperContext,
): void {
    const tempItem = ctx.initializeItem();
    tempItem.category = theCategory;
    tempItem.kind = theKind;
    tempItem.quantity = theQuantity;
    tempItem.originDepth = theOriginDepth;
    ctx.itemName(tempItem, buf, false, true, null);
}

// =============================================================================
// describedItemName — from Movement.c:130
// =============================================================================

/**
 * Describes an item for the location description bar. Tries to include
 * full details, falling back to terse description if too long.
 * Uses hallucinated description when appropriate.
 *
 * C: void describedItemName(const item *theItem, char *description, int maxLength)
 */
export function describedItemName(
    theItem: Item,
    description: string[],
    maxLength: number,
    ctx: ItemHelperContext,
): void {
    if (ctx.rogue.playbackOmniscience || !ctx.player.status[StatusEffect.Hallucinating]) {
        ctx.itemName(theItem, description, true, true, null);
        if (description[0].length > maxLength) {
            ctx.itemName(theItem, description, false, true, null);
        }
    } else {
        ctx.describeHallucinatedItem(description);
    }
}

// =============================================================================
// useKeyAt — from Movement.c:407
// =============================================================================

/**
 * Uses a key item at the given location. Promotes terrain that accepts
 * keys, and disposes of the key if it is marked as disposable here.
 *
 * C: void useKeyAt(item *theItem, short x, short y)
 */
export function useKeyAt(
    theItem: Item,
    x: number,
    y: number,
    ctx: ItemHelperContext,
): void {
    let terrainName = "unknown terrain";
    let preposition = "on";

    // Promote terrain that accepts keys
    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        const tile = ctx.tileCatalog[ctx.pmap[x][y].layers[layer]];
        if (tile.mechFlags & TerrainMechFlag.TM_PROMOTES_WITH_KEY) {
            if (tile.description.startsWith("a ")) {
                terrainName = `the ${tile.description.slice(2)}`;
            } else {
                terrainName = tile.description;
            }
            if (tile.mechFlags & TerrainMechFlag.TM_STAND_IN_TILE) {
                preposition = "in";
            } else {
                preposition = "on";
            }
            ctx.promoteTile(x, y, layer, false);
        }
    }

    // Check if key is disposable at this location
    let disposable = false;
    for (let i = 0; i < KEY_ID_MAXIMUM && (theItem.keyLoc[i].loc.x || theItem.keyLoc[i].machine); i++) {
        if (ctx.posEq(theItem.keyLoc[i].loc, { x, y }) && theItem.keyLoc[i].disposableHere) {
            disposable = true;
        } else if (
            theItem.keyLoc[i].machine === ctx.pmap[x][y].machineNumber &&
            theItem.keyLoc[i].disposableHere
        ) {
            disposable = true;
        }
    }

    if (disposable) {
        if (ctx.removeItemFromChain(theItem, ctx.packItems)) {
            const buf2: string[] = [""];
            ctx.itemName(theItem, buf2, true, false, null);
            ctx.messageWithColor(
                `you use your ${buf2[0]} ${preposition} ${terrainName}.`,
                ctx.itemMessageColor,
                0,
            );
            ctx.deleteItem(theItem);
        } else if (ctx.removeItemFromChain(theItem, ctx.floorItems)) {
            ctx.deleteItem(theItem);
            ctx.pmap[x][y].flags &= ~TileFlag.HAS_ITEM;
        } else if (ctx.pmap[x][y].flags & TileFlag.HAS_MONSTER) {
            const monst = ctx.monsterAtLoc({ x, y });
            if (monst && monst.carriedItem && monst.carriedItem === theItem) {
                monst.carriedItem = null;
                ctx.deleteItem(theItem);
            }
        }
    }
}

// =============================================================================
// search — from Movement.c:2131
// =============================================================================

/**
 * Searches around the player for hidden features (secret doors, traps).
 * Returns true if something was discovered.
 *
 * C: boolean search(short searchStrength)
 */
export function search(
    searchStrength: number,
    ctx: ItemHelperContext,
): boolean {
    let foundSomething = false;
    const radius = Math.floor(searchStrength / 10);
    const px = ctx.player.loc.x;
    const py = ctx.player.loc.y;

    for (let i = px - radius; i <= px + radius; i++) {
        for (let j = py - radius; j <= py + radius; j++) {
            if (
                ctx.coordinatesAreInMap(i, j) &&
                ctx.playerCanDirectlySee(i, j)
            ) {
                let percent =
                    searchStrength -
                    ctx.distanceBetween({ x: px, y: py }, { x: i, y: j }) * 10;

                if (ctx.cellHasTerrainFlag({ x: i, y: j }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                    percent = Math.floor((percent * 2) / 3);
                }

                if (percent >= 100) {
                    ctx.pmap[i][j].flags |= TileFlag.KNOWN_TO_BE_TRAP_FREE;
                }
                percent = Math.min(percent, 100);

                if (ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_IS_SECRET)) {
                    if (ctx.randPercent(percent)) {
                        ctx.discover(i, j);
                        foundSomething = true;
                    }
                }
            }
        }
    }
    return foundSomething;
}
