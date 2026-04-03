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
import {
    canSeeMonster as canSeeMonsterFn,
    monsterRevealed as monsterRevealedFn,
    monsterName as monsterNameFn,
    monstersAreEnemies as monstersAreEnemiesFn,
} from "../monsters/monster-queries.js";
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
import {
    ringTable,
    potionTable,
    scrollTable,
    wandTable,
    staffTable,
    charmTable,
    charmEffectTable,
} from "../globals/item-catalog.js";
import { randPercent, randClumpedRange, randRange } from "../math/rng.js";
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
import { TileFlag, MonsterBookkeepingFlag, TerrainFlag, TerrainMechFlag, IS_IN_MACHINE } from "../types/flags.js";
import type { Pos, Color, Creature } from "../types/types.js";
import { INVALID_POS } from "../types/types.js";
import { coordinatesAreInMap, nbDirs, posNeighborInDirection } from "../globals/tables.js";
import { DungeonLayer, StatusEffect } from "../types/enums.js";
import { ringWisdomMultiplier as ringWisdomMultiplierFn, charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import { itemName as itemNameFn, identify as identifyFn } from "../items/item-naming.js";
import { updateIdentifiableItems as updateIdentifiableItemsFn } from "../items/item-handlers.js";
import { updateIdentifiableItem as updateIdentifiableItemFn } from "../items/item-effects.js";
import { numberOfMatchingPackItems as numberOfMatchingPackItemsFn } from "../items/item-inventory.js";
import { avoidedFlagsForMonster as avoidedFlagsForMonsterFn } from "../monsters/monster-spawning.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "../movement/path-qualifying.js";
import { restoreMonster as restoreMonsterFn, getQualifyingLocNear as getQualifyingLocNearFn } from "../architect/architect.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "../io/color.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "../monsters/monster-ally-ops.js";
import { prependCreature as prependCreatureFn, removeCreature as removeCreatureFn } from "../monsters/monster-actions.js";
import { inflictDamage as inflictDamageFn, killCreature as killCreatureFn } from "../combat/combat-damage.js";
import { buildCombatDamageContext } from "../combat.js";
import { red } from "../globals/colors.js";
import type { ItemTable } from "../types/types.js";

// ItemTable[] — shorthand cast for readonly catalog arrays passed to ItemNamingContext
type ItemNamingTableArr = ItemTable[];

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
    const {
        rogue, player, pmap, monsters, floorItems, packItems, levels,
        gameConst, monsterCatalog, mutableScrollTable, mutablePotionTable,
    } = getGameState();
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
        initializeItem: () => ({} as never),              // permanent-defer — search() never calls initializeItem
        itemName: () => {},                                // permanent-defer — search() never calls itemName
        describeHallucinatedItem: () => {},               // permanent-defer — search() never calls describeHallucinatedItem
        removeItemFromChain: () => false,                  // permanent-defer — search() never removes items from chain
        deleteItem: () => {},                              // permanent-defer — search() never deletes items
        monsterAtLoc,
        promoteTile: () => {},                             // permanent-defer — search() never promotes tiles
        messageWithColor: () => {},                        // permanent-defer — search() never sends messages (discovers use refreshDungeonCell)
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
        keyOnTileAt: () => null, // permanent-defer — search() doesn't use keys; useKeyAt is a separate code path
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
        FP_FACTOR: 1000,                         // number-domain FP scale for recharge calculations
        TURNS_FOR_FULL_REGEN,
        deepestLevel: rogue.deepestLevel,
        INVALID_POS,

        randClumpedRange: (min, max, clumps) => randClumpedRange(min, max, clumps),
        rand_percent: (pct) => randPercent(pct),
        max: Math.max,
        clamp: (val, min, max) => Math.min(Math.max(val, min), max),
        ringWisdomMultiplier: (val: number): number => {
            // val = wisdomBonus * FP_FACTOR(1000); convert to bigint fixpt (65536-base)
            const asFixpt = BigInt(Math.round(val)) * 65536n / 1000n;
            const result = ringWisdomMultiplierFn(asFixpt);
            // convert result back to FP_FACTOR(1000) scale
            return Number(result) * 1000 / 65536;
        },
        charmRechargeDelay: (kind: number, enchant: number): number => {
            const entry = charmEffectTable[kind];
            if (!entry) return 0;
            return charmRechargeDelayFn(entry, enchant);
        },

        itemName: (theItem, includeArticle, includeRunic): string =>
            itemNameFn(theItem, includeRunic, includeArticle, {
                gameConstants: gameConst,
                depthLevel: rogue.depthLevel,
                potionTable: potionTable as ItemNamingTableArr,
                scrollTable: scrollTable as ItemNamingTableArr,
                wandTable: wandTable as ItemNamingTableArr,
                staffTable: staffTable as ItemNamingTableArr,
                ringTable: ringTable as ItemNamingTableArr,
                charmTable: charmTable as ItemNamingTableArr,
                playbackOmniscience: rogue.playbackOmniscience,
                monsterClassName: (classId) => monsterCatalog[classId]?.monsterName ?? "creature",
                charmRechargeDelay: (kind, enchant) => {
                    const entry = charmEffectTable[kind];
                    return entry ? charmRechargeDelayFn(entry, enchant) : 0;
                },
            }),
        identify: (theItem): void =>
            identifyFn(theItem, gameConst, {
                scrollTable: mutableScrollTable,
                potionTable: mutablePotionTable,
            }),
        updateIdentifiableItems: (): void =>
            updateIdentifiableItemsFn({
                packItems,
                floorItems,
                updateIdentifiableItem: (item) =>
                    updateIdentifiableItemFn(item, {
                        scrollTable: mutableScrollTable,
                        potionTable: mutablePotionTable,
                    }),
            }),
        numberOfMatchingPackItems: (category, requiredFlags, forbiddenFlags, _is498): number =>
            numberOfMatchingPackItemsFn(packItems, category, requiredFlags, forbiddenFlags),

        message: io.message,
        messageWithColor: (msg, color, flags) =>
            io.messageWithColor(msg, color as Readonly<Color>, flags),

        monsterAvoids: (monst, loc) =>
            monsterAvoidsFn(monst, loc, buildMonsterStateContext()),
        canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
        monsterAtLoc,
        monsterName: (m: Creature, includeArticle: boolean): string =>
            monsterNameFn(m, includeArticle, {
                ...mqCtx,
                playerStatus: player.status,
                monsterCatalog,
            }),
        messageColorFromVictim: (m: Creature): unknown =>
            messageColorFromVictimFn(
                m,
                player,
                !!(player.status[StatusEffect.Hallucinating]),
                rogue.playbackOmniscience,
                (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
            ),
        inflictDamage: (attacker, defender, damage, color, ignoreArmor): boolean =>
            inflictDamageFn(attacker, defender, damage, color as Color | null, ignoreArmor, buildCombatDamageContext()),
        killCreature: (monst: Creature, maintainCorpse: boolean): void =>
            killCreatureFn(monst, maintainCorpse, buildCombatDamageContext()),
        demoteMonsterFromLeadership: (monst: Creature): void =>
            demoteMonsterFromLeadershipFn(monst, monsters),
        restoreMonster: (monst: Creature): void =>
            restoreMonsterFn(monst, null, null, {
                pmap, monsters, nbDirs, coordinatesAreInMap,
                cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
                cellHasTerrainFlag,
                avoidedFlagsForMonster: (info) => avoidedFlagsForMonsterFn(info),
                knownToPlayerAsPassableOrSecretDoor: (pos: Pos) => {
                    const cell = pmap[pos.x]?.[pos.y];
                    if (!cell) return false;
                    const discovered = !!(cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED));
                    const visible = !!(cell.flags & TileFlag.VISIBLE);
                    const obstructs = (discovered && !visible)
                        ? !!(cell.rememberedTerrainFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        : cellHasTerrainFlagFn(pmap, pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                    return !obstructs || cellHasTMFlagFn(pmap, pos, TerrainMechFlag.TM_IS_SECRET);
                },
                getQualifyingPathLocNear: (loc, diags, bTerrain, bMap, fTerrain, fMap, det) =>
                    getQualifyingPathLocNearFn(loc, diags, bTerrain, bMap, fTerrain, fMap, det, {
                        pmap,
                        cellHasTerrainFlag,
                        cellFlags: (pos: Pos) => pmap[pos.x]?.[pos.y]?.flags ?? 0,
                        getQualifyingLocNear: (t, _ha, forbTerrF, forbMapF, _det) =>
                            getQualifyingLocNearFn(pmap, t, forbTerrF, forbMapF),
                        rng: { randRange },
                    }),
                HAS_PLAYER: TileFlag.HAS_PLAYER,
                HAS_MONSTER: TileFlag.HAS_MONSTER,
                HAS_STAIRS: TileFlag.HAS_STAIRS,
                IS_IN_MACHINE,
            }),
        removeCreature: (list: Creature[], monst: Creature): void => {
            removeCreatureFn(list, monst);
        },
        prependCreature: (list: Creature[], monst: Creature): void =>
            prependCreatureFn(list, monst),
        avoidedFlagsForMonster: (info): number => avoidedFlagsForMonsterFn(info as import("../types/types.js").CreatureType),
        getQualifyingPathLocNear: (loc: Pos, diags: boolean, bTerrain: number, bMap: number, fTerrain: number, fMap: number, det: boolean): Pos =>
            getQualifyingPathLocNearFn(loc, diags, bTerrain, bMap, fTerrain, fMap, det, {
                pmap,
                cellHasTerrainFlag,
                cellFlags: (pos: Pos) => pmap[pos.x]?.[pos.y]?.flags ?? 0,
                getQualifyingLocNear: (t, _ha, forbTerrF, forbMapF, _det) =>
                    getQualifyingLocNearFn(pmap, t, forbTerrF, forbMapF),
                rng: { randRange },
            }),

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
        red,
        REST_KEY: String.fromCharCode(REST_KEY),
        SEARCH_KEY: String.fromCharCode(SEARCH_KEY),
        PAUSE_BEHAVIOR_DEFAULT: 0,
    };
}

