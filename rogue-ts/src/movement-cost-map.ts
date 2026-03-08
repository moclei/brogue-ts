/*
 *  movement-cost-map.ts — buildCostMapFovContext
 *  Port V2 — rogue-ts
 *
 *  Builds a CostMapFovContext from the current game state.
 *  Extracted from movement.ts to keep that file under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { buildMonsterStateContext } from "./monsters.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    terrainMechFlags as terrainMechFlagsFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { monsterAvoids as monsterAvoidsFn, distanceBetween } from "./monsters/monster-state.js";
import { layerWithTMFlag as layerWithTMFlagFn } from "./movement/map-queries.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { itemAtLoc as itemAtLocFn } from "./items/item-inventory.js";
import { backgroundMessageColor } from "./globals/colors.js";
import { buildMessageFns, buildRefreshDungeonCellFn } from "./io-wiring.js";
import { TileFlag } from "./types/flags.js";
import { ItemCategory, DungeonLayer } from "./types/enums.js";
import { DCOLS, DROWS } from "./types/constants.js";
import type { Pos } from "./types/types.js";
import type { CostMapFovContext } from "./movement/cost-maps-fov.js";

// =============================================================================
// buildCostMapFovContext
// =============================================================================

/**
 * Build a CostMapFovContext backed by the current game state.
 *
 * Wires real terrain queries and cell flag access.
 * Display callbacks (refreshDungeonCell, messageWithColor) and cosmetic RNG
 * are stubbed — wired in port-v2-platform.
 */
export function buildCostMapFovContext(): CostMapFovContext {
    const { player, rogue, pmap, tmap, floorItems } = getGameState();
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);

    const monsterStateCtx = buildMonsterStateContext();

    return {
        // ── Map state ─────────────────────────────────────────────────────────
        pmap,
        tmap,
        player,
        rogue: {
            depthLevel: rogue.depthLevel,
            automationActive: rogue.automationActive,
            playerTurnNumber: rogue.playerTurnNumber,
            xpxpThisTurn: rogue.xpxpThisTurn,
            mapToShore: rogue.mapToShore ?? Array.from({ length: DCOLS }, () => new Array(DROWS).fill(0)),
        },
        tileCatalog: tileCatalog as unknown as CostMapFovContext["tileCatalog"],

        // ── Map helpers ───────────────────────────────────────────────────────
        cellHasTerrainFlag,
        cellHasTMFlag,
        terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
        terrainMechFlags: (pos) => terrainMechFlagsFn(pmap, pos),
        discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => { const df = tileCatalog[tileType]?.discoverType ?? 0; return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0; },
        ),
        monsterAvoids: (m, pos) => monsterAvoidsFn(m, pos, monsterStateCtx),
        canPass: (_m, _blocker) => false,   // stub
        distanceBetween: (a, b) => distanceBetween(a, b),

        // ── Creature helpers ──────────────────────────────────────────────────
        monsterAtLoc: (loc: Pos) =>
            (player.loc.x === loc.x && player.loc.y === loc.y ? player : null),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),

        // ── Item helpers ──────────────────────────────────────────────────────
        itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
        itemName: (_item, buf) => { buf[0] = "item"; },  // stub

        // ── UI stubs (wired in port-v2-platform) ─────────────────────────────
        messageWithColor: io.messageWithColor,
        refreshDungeonCell,
        discoverCell: (x, y) => {
            if (x >= 0 && x < DCOLS && y >= 0 && y < DROWS) {
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            }
        },
        storeMemories: () => {},             // stub — wired in port-v2-platform
        layerWithTMFlag: (x, y, flag) =>
            layerWithTMFlagFn(pmap, x, y, flag) as DungeonLayer,

        // ── Color constants ───────────────────────────────────────────────────
        itemMessageColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        backgroundMessageColor,

        // ── Item category constant ────────────────────────────────────────────
        KEY: ItemCategory.KEY,

        // ── Cosmetic RNG (stubs — wired in port-v2-platform) ─────────────────
        assureCosmeticRNG: () => {},
        restoreRNG: () => {},

        // ── getLocationFlags ──────────────────────────────────────────────────
        getLocationFlags(x, y, limitToPlayerKnowledge) {
            const cell = pmap[x][y];
            if (
                limitToPlayerKnowledge &&
                (cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) &&
                !(pmap[x][y].flags & TileFlag.VISIBLE)
            ) {
                return {
                    tFlags: cell.rememberedTerrainFlags,
                    tmFlags: cell.rememberedTMFlags,
                    cellFlags: cell.rememberedCellFlags,
                };
            }
            return {
                tFlags: terrainFlagsFn(pmap, { x, y }),
                tmFlags: terrainMechFlagsFn(pmap, { x, y }),
                cellFlags: cell.flags,
            };
        },
    };
}
