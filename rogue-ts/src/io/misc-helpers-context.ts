/*
 *  io/misc-helpers-context.ts — buildMiscHelpersContext factory
 *  Port V2 — rogue-ts
 *
 *  Builds the MiscHelpersContext (used by autoRest and manualSearch).
 *  Extracted from input-context.ts to keep that file under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "../core.js";
import { buildMonsterStateContext } from "../monsters.js";
import { playerTurnEnded as playerTurnEndedFn } from "../turn.js";
import {
    distanceBetween,
    monsterAvoids as monsterAvoidsFn,
} from "../monsters/monster-state.js";
import { canSeeMonster as canSeeMonsterFn, monsterRevealed as monsterRevealedFn } from "../monsters/monster-queries.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    terrainMechFlags as terrainMechFlagsFn,
} from "../state/helpers.js";
import { search as searchFn } from "../movement/item-helpers.js";
import { discover as discoverFn } from "../movement/map-queries.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "../architect/machines.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { ringTable } from "../globals/item-catalog.js";
import { randPercent, randClumpedRange } from "../math/rng.js";
// autoRest and manualSearch are imported in input-context.ts; only the context builder lives here.
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "../light/light.js";
import {
    buildMessageFns,
    buildRefreshDungeonCellFn,
    buildDisplayLevelFn,
} from "../io-wiring.js";
import type { MiscHelpersContext } from "../time/misc-helpers.js";
import type { ItemHelperContext } from "../movement/item-helpers.js";
import { TURNS_FOR_FULL_REGEN, REST_KEY, SEARCH_KEY, DCOLS, DROWS } from "../types/constants.js";
import { TileFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import type { Pos, Color } from "../types/types.js";
import { INVALID_POS } from "../types/types.js";
import { coordinatesAreInMap, nbDirs, posNeighborInDirection } from "../globals/tables.js";
import { DungeonLayer } from "../types/enums.js";

// =============================================================================
// buildMiscHelpersContext — Time.c helpers (autoRest, manualSearch)
// =============================================================================

/**
 * Build a MiscHelpersContext backed by the current game state.
 *
 * Only autoRest and manualSearch are called from buildInputContext; the
 * remaining fields (rechargeItemsIncrementally, monsterEntersLevel, etc.)
 * are stubbed — they are not invoked from this context.
 */
export function buildMiscHelpersContext(): MiscHelpersContext {
    const { rogue, player, pmap, monsters, floorItems, packItems, levels } = getGameState();
    const io = buildMessageFns();
    const refreshDungeonCell = buildRefreshDungeonCellFn();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);
    // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
    const monsterAtLoc = (loc: Pos) => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        return monsters.find(
            m => m.loc.x === loc.x && m.loc.y === loc.y &&
                !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
        ) ?? null;
    };
    const spawnFeature = (x: number, y: number, feat: unknown, rc: boolean, ab: boolean) =>
        spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, rc, ab);

    const mqCtx = {
        player,
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // Minimal ItemHelperContext for the search() call in manualSearch
    const searchCtx: ItemHelperContext = {
        pmap,
        player,
        rogue: { playbackOmniscience: rogue.playbackOmniscience },
        tileCatalog: tileCatalog as unknown as ItemHelperContext["tileCatalog"],
        initializeItem: () => ({} as never),
        itemName: () => {},
        describeHallucinatedItem: () => {},
        removeItemFromChain: () => false,
        deleteItem: () => {},
        monsterAtLoc,
        promoteTile: () => {},
        messageWithColor: () => {},
        itemMessageColor: null,
        packItems,
        floorItems,
        cellHasTerrainFlag,
        cellHasTMFlag,
        coordinatesAreInMap,
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        distanceBetween,
        discover: (x, y) => {
            discoverFn(x, y, {
                pmap,
                player,
                rogue: {
                    scentTurnNumber: rogue.scentTurnNumber,
                    disturbed: rogue.disturbed,
                    automationActive: rogue.automationActive,
                },
                scentMap: getScentMap() ?? ([] as number[][]),
                terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
                terrainMechFlags: (pos) => terrainMechFlagsFn(pmap, pos),
                cellHasTerrainFlag,
                cellHasTMFlag,
                coordinatesAreInMap,
                playerCanSee: (x2, y2) => !!(pmap[x2]?.[y2]?.flags & TileFlag.VISIBLE),
                monsterAtLoc,
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                monsterRevealed: (m) => monsterRevealedFn(m, player),
                spawnDungeonFeature: spawnFeature as never,
                refreshDungeonCell,
                dungeonFeatureCatalog,
                nbDirs: nbDirs as [number, number][],
            });
        },
        randPercent,
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        keyOnTileAt: () => null,
    };

    return {
        player,
        rogue: {
            depthLevel: rogue.depthLevel,
            wisdomBonus: rogue.wisdomBonus,
            awarenessBonus: rogue.awarenessBonus,
            justRested: rogue.justRested,
            justSearched: rogue.justSearched,
            automationActive: rogue.automationActive,
            disturbed: rogue.disturbed,
            yendorWarden: rogue.yendorWarden ?? null,
            weapon: rogue.weapon ?? null,
            armor: rogue.armor ?? null,
            ringLeft: rogue.ringLeft ?? null,
            ringRight: rogue.ringRight ?? null,
            upLoc: rogue.upLoc,
            downLoc: rogue.downLoc,
            monsterSpawnFuse: rogue.monsterSpawnFuse,
        },
        monsters,
        levels,
        pmap,
        packItems,

        DCOLS,
        DROWS,
        FP_FACTOR: 1000,                         // stub — not used by autoRest/manualSearch
        TURNS_FOR_FULL_REGEN,
        deepestLevel: rogue.deepestLevel,
        INVALID_POS,

        randClumpedRange: (min, max, clumps) => randClumpedRange(min, max, clumps),
        rand_percent: (pct) => randPercent(pct),
        max: Math.max,
        clamp: (val, min, max) => Math.min(Math.max(val, min), max),
        ringWisdomMultiplier: (val) => val,       // stub — not used by autoRest/manualSearch
        charmRechargeDelay: () => 0,              // stub — not used by autoRest/manualSearch

        itemName: () => "",                       // stub
        identify: () => {},                       // stub
        updateIdentifiableItems: () => {},        // stub
        numberOfMatchingPackItems: () => 0,       // stub

        message: io.message,
        messageWithColor: (msg, color, flags) =>
            io.messageWithColor(msg, color as Readonly<Color>, flags),

        monsterAvoids: (monst, loc) =>
            monsterAvoidsFn(monst, loc, buildMonsterStateContext()),
        canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
        monsterName: () => "",                    // stub
        messageColorFromVictim: () => null,       // stub
        inflictDamage: () => false,               // stub
        killCreature: () => {},                   // stub
        demoteMonsterFromLeadership: () => {},    // stub
        restoreMonster: () => {},                 // stub
        removeCreature: () => {},                 // stub
        prependCreature: () => {},                // stub
        avoidedFlagsForMonster: () => 0,          // stub
        getQualifyingPathLocNear: (loc) => loc,   // stub

        posNeighborInDirection,
        cellHasTerrainFlag,
        pmapAt: (loc) => pmap[loc.x][loc.y],
        terrainFlags: (loc) => terrainFlagsFn(pmap, loc),
        refreshDungeonCell,
        search: (strength) => { searchFn(strength, searchCtx); },
        recordKeystroke: () => {},                // stub — persistence layer
        playerTurnEnded: async () => { await playerTurnEndedFn(); },
        pauseAnimation: () => false,              // stub — Phase 3b

        ringTable: ringTable as unknown as Array<{ identified: boolean }>,
        displayLevel: buildDisplayLevelFn(),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        itemMessageColor: null,
        red: null,
        REST_KEY: String.fromCharCode(REST_KEY),
        SEARCH_KEY: String.fromCharCode(SEARCH_KEY),
        PAUSE_BEHAVIOR_DEFAULT: 0,
    };
}

