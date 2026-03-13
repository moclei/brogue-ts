/*
 *  items/item-helper-context.ts — buildItemHelperContext factory
 *  Port V2 — rogue-ts
 *
 *  Extracted from items.ts to keep that file under the 600-line limit.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import {
    wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "../globals/item-catalog.js";
import { itemMessageColor } from "../globals/colors.js";
import { coordinatesAreInMap } from "../globals/tables.js";
import { itemName as itemNameFn } from "./item-naming.js";
import { removeItemFromArray, itemAtLoc as itemAtLocFn } from "./item-inventory.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./item-utils.js";
import { initializeItem } from "./item-generation.js";
import { charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import { distanceBetween } from "../monsters/monster-state.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import { randPercent } from "../math/rng.js";
import { TileFlag } from "../types/flags.js";
import { ItemCategory } from "../types/enums.js";
import type { ItemHelperContext } from "../movement/item-helpers.js";
import type { Creature, ItemTable, Pos } from "../types/types.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildNamingCtx(state: ReturnType<typeof getGameState>) {
    const { rogue, mutableScrollTable, mutablePotionTable, monsterCatalog, gameConst } = state;
    return {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],
        charmRechargeDelay: (kind: number, enchant: number) =>
            charmRechargeDelayFn(charmEffectTable[kind], enchant),
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: (classId: number) =>
            monsterCatalog[classId]?.monsterName ?? "creature",
    };
}

function buildMonsterAtLoc(player: Creature, monsters: Creature[]) {
    return function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

// =============================================================================
// buildItemHelperContext
// =============================================================================

/**
 * Build an ItemHelperContext backed by the current game state.
 *
 * Wires real implementations for item description, key use, map queries,
 * and pack/floor item management.  promoteTile and discover are stubbed —
 * they require terrain mutation wired in port-v2-platform.
 */
export function buildItemHelperContext(): ItemHelperContext {
    const state = getGameState();
    const { player, rogue, pmap, monsters, packItems, floorItems } = state;

    const namingCtx = buildNamingCtx(state);
    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    return {
        pmap,
        player,
        rogue: { playbackOmniscience: rogue.playbackOmniscience },
        tileCatalog: tileCatalog as unknown as readonly {
            flags: number; mechFlags: number; discoverType: number; description: string;
        }[],
        packItems,
        floorItems,
        itemMessageColor,

        initializeItem: () => initializeItem(),

        itemName(theItem, buf, includeDetails, includeArticle, _maxLen) {
            buf[0] = itemNameFn(theItem, includeDetails, includeArticle, namingCtx);
        },

        describeHallucinatedItem(buf) {
            buf[0] = "something strange";  // permanent-defer — hallucination item names require flavor catalog
        },

        removeItemFromChain: (item, chain) => removeItemFromArray(item, chain),

        deleteItem(item) {
            removeItemFromArray(item, floorItems);
            removeItemFromArray(item, packItems);
        },

        monsterAtLoc,

        promoteTile: () => {},              // permanent-defer — requires EnvironmentContext

        messageWithColor: () => {},         // permanent-defer — this context is for non-message item ops

        cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
        cellHasTMFlag: (loc, flags) => cellHasTMFlagFn(pmap, loc, flags),
        coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        distanceBetween: (p1, p2) => distanceBetween(p1, p2),
        discover: () => {},                 // permanent-defer — needs full MapQueryContext (wired in lifecycle)
        randPercent: (pct) => randPercent(pct),
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        keyOnTileAt: (loc: Pos) => {
            const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;
            if (player.loc.x === loc.x && player.loc.y === loc.y) {
                const k = packItems.find(it => (it.category & ItemCategory.KEY) && keyMatchesLocationFn(it, loc, rogue.depthLevel, machineNum));
                if (k) return k;
            }
            if (pmap[loc.x]?.[loc.y]?.flags & TileFlag.HAS_ITEM) {
                const fi = itemAtLocFn(loc, floorItems);
                if (fi && (fi.category & ItemCategory.KEY) && keyMatchesLocationFn(fi, loc, rogue.depthLevel, machineNum)) return fi;
            }
            return null;
        },
    };
}
