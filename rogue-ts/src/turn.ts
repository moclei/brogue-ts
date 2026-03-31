/*
 *  turn.ts — Turn processing context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildTurnProcessingContext() and buildMonstersTurnContext(),
 *  the two context factories that wire playerTurnEnded() and monstersTurn().
 *
 *  UI/rendering callbacks are stubbed here; they will be wired in port-v2-platform.
 *  Combat callbacks delegate to the minimal combat context (Phase 3: combat.ts
 *  will promote these to full implementations).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver } from "./core.js";
import { numberOfMatchingPackItems as numberOfMatchingPackItemsFn, itemAtLoc as itemAtLocFn } from "./items/item-inventory.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    flashMonster as flashMonsterFn,
} from "./combat/combat-damage.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
    terrainMechFlags as terrainMechFlagsFn,
    highestPriorityLayer,
} from "./state/helpers.js";
import { allocGrid } from "./grid/grid.js";
import { zeroOutGrid } from "./architect/helpers.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { randRange, randPercent, randClumpedRange, clamp } from "./math/rng.js";
import { nbDirs, coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import {
    goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
    orange, green, red, yellow, darkRed, darkGreen,
    white, minersLightColor,
} from "./globals/colors.js";
import { DCOLS, DROWS, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD } from "./types/constants.js";
import { TileFlag, MessageFlag, MonsterBookkeepingFlag, TerrainFlag, T_OBSTRUCTS_SCENT } from "./types/flags.js";
import { refreshWaypoint as refreshWaypointFn, updateMapToShore as updateMapToShoreFn } from "./architect/architect.js";
import { analyzeMap as analyzeMapFn } from "./architect/analysis.js";
import { populateGenericCostMap } from "./movement/cost-maps-fov.js";
import { CreatureState, ALL_ITEMS, ItemCategory, FoodKind, DungeonLayer } from "./types/enums.js";
import type { TurnProcessingContext } from "./time/turn-processing.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { applyGradualTileEffectsToCreature as applyGradualTileEffectsFn, decrementPlayerStatus as decrementPlayerStatusFn, currentStealthRange as currentStealthRangeFn, monstersFall as monstersFallFn, handleHealthAlerts as handleHealthAlertsFn } from "./time/creature-effects.js";
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";
import type { Creature, Pcell, Pos, Color, Item } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildDisplayLevelFn } from "./io-wiring.js";
import { displayCombatText as displayCombatTextFn } from "./io/messages.js";
import { buildMessageContext } from "./ui.js";
import { buildUpdateVisionFn, buildAnimateFlaresFn } from "./vision-wiring.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn, playerInDarkness as playerInDarknessFn } from "./light/light.js";
import { shuffleTerrainColors as shuffleTerrainColorsFn } from "./render-state.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { buildMonstersTurnContext } from "./turn-monster-ai.js";
import { doMakeMonsterDropItem } from "./monsters/monster-drop.js";
import { updateEncumbrance as updateEncumbranceFn, recalculateEquipmentBonuses as recalculateEquipmentBonusesFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses } from "./items/equip-helpers.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import { scentDistance } from "./time/turn-processing.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { autoIdentify as autoIdentifyFn, updateIdentifiableItems as updateIdentifiableItemsFn } from "./items/item-handlers.js";
import { updateIdentifiableItem as updateIdentifiableItemFn } from "./items/item-effects.js";
import { identify as identifyFn } from "./items/item-naming.js";
import { dropItem as dropItemFn } from "./items/floor-items.js";
import { monsterCanSubmergeNow as monsterCanSubmergeNowFn, spawnPeriodicHorde as spawnPeriodicHordeFn } from "./monsters/monster-spawning.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import {
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
    monsterRevealed as monsterRevealedFn,
    monsterIsInClass as monsterIsInClassFn,
} from "./monsters/monster-queries.js";
import { decrementMonsterStatus as decrementMonsterStatusFn, monsterAvoids as monsterAvoidsFn } from "./monsters/monster-state.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { storeMemories as storeMemoriesFn } from "./movement/map-queries.js";
import { dijkstraScan as dijkstraScanFn } from "./dijkstra/dijkstra.js";
import { updateSafetyMap as updateSafetyMapFn } from "./time/safety-maps.js";
import type { SafetyMapsContext } from "./time/safety-maps.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "./items/item-generation.js";
import { wandTable, staffTable, ringTable, charmTable, armorTable, charmEffectTable } from "./globals/item-catalog.js";
import { ringWisdomMultiplier as ringWisdomMultiplierFn, charmRechargeDelay as charmRechargeDelayFn } from "./power/power-tables.js";
import { rechargeItemsIncrementally as rechargeItemsIncrementallyFn, processIncrementalAutoID as processIncrementalAutoIDFn } from "./time/misc-helpers.js";
import type { MiscHelpersContext } from "./time/misc-helpers.js";
import type { ItemTable } from "./types/types.js";
import { buildMonstersApproachStairsCtx, monstersApproachStairs as monstersApproachStairsFn } from "./time/stairs-wiring.js";
import { commitDraws } from "./platform.js";
import { platformPauseIgnoringHover } from "./platform-bridge.js";
import { buildGetRandomMonsterSpawnLocationFn, buildMinimalCombatContext, buildMonsterAvoidsCtx } from "./turn-combat-helpers.js";
import { buildUpdateEnvironmentFn, buildPlayerFallsFn } from "./turn-env-wiring.js";

/** Build the TurnProcessingContext for playerTurnEnded().
 *
 * Called each time the player ends a turn. Pulls live state from core.ts
 * and provides real implementations for scheduler-critical operations;
 * stubs for UI/rendering (wired in port-v2-platform).
 */
export function buildTurnProcessingContext(): TurnProcessingContext {
    const {
        player, rogue, pmap, tmap, monsters, dormantMonsters,
        packItems, floorItems, levels, gameConst,
        mutableScrollTable, mutablePotionTable, monsterCatalog,
    } = getGameState();
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();
    const namingCtx = {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: (classId: number) => monsterCatalog[classId]?.monsterName ?? "creature",
    };

    const combatCtx = buildMinimalCombatContext(player, rogue, pmap, monsters, floorItems);

    // ── Gradual tile effects context (for water item loss, terrain damage/healing) ──
    const _ctf = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
    const gradualCtx = {
        player, pmap,
        rogue,
        cellHasTerrainFlag: _ctf,
        HAS_ITEM: TileFlag.HAS_ITEM,
        ALL_ITEMS,
        rand_percent: randPercent,
        rand_range: randRange,
        packItems,
        numberOfMatchingPackItems: (cat: number, _kind: number, flags: number) =>
            numberOfMatchingPackItemsFn(packItems, cat, 0, flags),
        dropItem: (theItem: Item) => dropItemFn(theItem, {
            pmap, floorItems,
            tileCatalog: tileCatalog as never,
            dungeonFeatureCatalog: dungeonFeatureCatalog as never,
            packItems, player,
            rogue: { swappedIn: rogue.swappedIn, swappedOut: rogue.swappedOut },
            itemMagicPolarity: itemMagicPolarityFn,
            cellHasTerrainFlag: _ctf,
            cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            itemName: (i: Item, buf: string[]) => { buf[0] = itemNameFn(i, false, true, namingCtx); },
            message: io.message,
            spawnDungeonFeature: () => {}, promoteTile: () => {}, discover: () => {},
            refreshDungeonCell,
            REQUIRE_ACKNOWLEDGMENT: 1,
            itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
            pickUpItemAt: () => {},
        }),
        itemName: (i: Item, buf: string[], details: boolean, article: boolean) => {
            buf[0] = itemNameFn(i, details, article, namingCtx);
        },
        messageWithColor: (msg: string, color: Color, flags: number) => io.messageWithColor(msg, color, flags),
        itemMessageColor,
        makeMonsterDropItem: (monst: Creature) =>
            doMakeMonsterDropItem(monst, pmap, floorItems, _ctf, refreshDungeonCell),
        max: Math.max, min: Math.min,
        tileCatalog,
        autoIdentify: (item: Item) => autoIdentifyFn(item, {
            gc: gameConst,
            messageWithColor: (msg: string, color: Color, flags: number) => io.messageWithColor(msg, color, flags),
            itemMessageColor, namingCtx,
        }),
        message: io.message,
        badMessageColor, goodMessageColor,
        inflictDamage: (attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean) =>
            inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
        killCreature: (monst: Creature, adminDeath: boolean) => killCreatureFn(monst, adminDeath, combatCtx),
        gameOver: (msg: string) => gameOver(msg),
        canSeeMonster: (m: Creature) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName: (buf: string[], m: Creature, includeArticle: boolean) => {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        },
        messageColorFromVictim: (monst: Creature): Color =>
            (monst === player || monst.creatureState === CreatureState.Ally) ? badMessageColor : goodMessageColor,
        refreshDungeonCell,
    } as unknown as CreatureEffectsContext;

    // ── decrementPlayerStatus context — status timers, hunger, haste/slow ────
    // Extends gradualCtx with the extra fields needed by decrementPlayerStatus
    // and the checkNutrition sub-function it calls.
    const decrementStatusCtx = {
        ...(gradualCtx as any),
        AMULET: ItemCategory.AMULET,
        FOOD: ItemCategory.FOOD,
        FRUIT: FoodKind.Fruit,
        ARMOR: ItemCategory.ARMOR,
        HUNGER_THRESHOLD,
        WEAK_THRESHOLD,
        FAINT_THRESHOLD,
        REQUIRE_ACKNOWLEDGMENT: MessageFlag.REQUIRE_ACKNOWLEDGMENT,
        updateVision: buildUpdateVisionFn(),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        displayLevel: buildDisplayLevelFn(),
        synchronizePlayerTimeState: () => { rogue.ticksTillUpdateEnvironment = player.ticksUntilTurn; },
        recalculateEquipmentBonuses: () => {
            const eqState = buildEquipState();
            recalculateEquipmentBonusesFn(eqState);
            syncEquipBonuses(eqState);
        },
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        confirmMessages: () => {},      // stub — complex UI sequencing
        eat: () => {},                  // stub — emergency eating deferred
        playerTurnEnded: () => {},      // stub — avoid re-entry
        spawnPeriodicHorde: () => spawnPeriodicHordeFn(
            buildMonsterSpawningContext(),
            buildGetRandomMonsterSpawnLocationFn(player, pmap),
        ),
    } as unknown as CreatureEffectsContext;

    function pmapAt(loc: Pos): Pcell { return pmap[loc.x][loc.y]; }

    function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    }

    // Scent map — shared with monster AI via rogue.scentMap.
    if (!rogue.scentMap) rogue.scentMap = allocGrid();
    const scentMap = rogue.scentMap;

    // Safety grids — transient per-level state (wired in port-v2-platform).
    const safetyMap = allocGrid();
    const allySafetyMap = allocGrid();

    // FOV context for updateScent
    const fovCtxForScent = {
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
    };

    // Monster query context — needed for correct canSeeMonster (checks MB_SUBMERGED etc.)
    const mqCtx = {
        player,
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // Minimal MonsterStateContext for decrementMonsterStatus — only the fields
    // actually accessed by that function (submersion, burning, poison, etc.).
    // Waypoints/pathfinding fields are never called from decrementMonsterStatus.
    const decrementMonsterStatusCtx = {
        player,
        rng: { randRange, randPercent },
        queryCtx: mqCtx,
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        monsterCanSubmergeNow: (m: Creature) =>
            monsterCanSubmergeNowFn(m,
                (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
                (pos: Pos, f: number) => cellHasTerrainFlagFn(pmap, pos, f)),
        inflictDamage: (attacker: Creature | null, defender: Creature, damage: number) =>
            inflictDamageFn(attacker, defender, damage, null, false, combatCtx),
        killCreature: (m: Creature, quiet: boolean) => killCreatureFn(m, quiet, combatCtx),
        // For monsters: just clear burning; player fire-color reset is in the full impl
        extinguishFireOnCreature: (m: Creature) => { m.status[15] = 0; /* StatusEffect.Burning */ },
        makeMonsterDropItem: (m: Creature) =>
            doMakeMonsterDropItem(m, pmap, floorItems, (pos: Pos, f: number) => cellHasTerrainFlagFn(pmap, pos, f), refreshDungeonCell),
        refreshDungeonCell,
        message: io.message,
        messageWithColor: (text: string, flags: number) => io.message(text, flags),
        combatMessage: (text: string) => io.combatMessage(text, null),
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
    } as unknown as import("./monsters/monster-state.js").MonsterStateContext;

    return {
        player,
        rogue: rogue as unknown as TurnProcessingContext["rogue"],
        monsters,
        dormantMonsters,
        pmap,
        levels,
        gameConst,
        scentMap,
        safetyMap,
        allySafetyMap,
        packItems,
        floorItems,
        tileCatalog,
        dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as TurnProcessingContext["dungeonFeatureCatalog"],

        DCOLS, DROWS, FP_FACTOR,

        // ── Map helpers ───────────────────────────────────────────────────────
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
        cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
        terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
        discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
        coordinatesAreInMap,
        pmapAt,

        // ── Monster helpers ───────────────────────────────────────────────────
        canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, mqCtx),
        monsterRevealed: (m) => monsterRevealedFn(m, player),
        monsterName(buf, m, includeArticle) {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        },
        monsterAtLoc,
        monstersAreEnemies: (m1, m2) => m1.creatureState !== CreatureState.Ally && m2 === player,
        monsterAvoids: (monst, p) => monsterAvoidsFn(monst, p, buildMonsterAvoidsCtx(player, monsters, pmap, rogue)),
        monsterIsInClass: (monst, cls) =>
            monsterIsInClassFn(monst, monsterClassCatalog[cls] ?? { memberList: [] } as never),
        isVowelish: (w) => "aeiouAEIOU".includes(w[0] ?? ""),
        monstersTurn: (monst) => monstersTurnFn(monst, buildMonstersTurnContext()),
        decrementMonsterStatus: (monst) => decrementMonsterStatusFn(monst, decrementMonsterStatusCtx),
        removeCreature(list, monst) {
            const idx = list.indexOf(monst);
            if (idx >= 0) { list.splice(idx, 1); return true; }
            return false;
        },
        prependCreature(list, monst) { list.unshift(monst); },

        // ── Item helpers ──────────────────────────────────────────────────────
        itemName(item, buf, inclDetails, inclArticle) { buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx); },
        numberOfMatchingPackItems: (cat, _kind, forbiddenFlags, _checkCarried) =>
            numberOfMatchingPackItemsFn(packItems, cat, 0, forbiddenFlags),

        // ── Combat helpers ────────────────────────────────────────────────────
        inflictDamage: (attacker, defender, damage, flashColor, showDamage) =>
            inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
        killCreature: (monst, adminDeath) => killCreatureFn(monst, adminDeath, combatCtx),
        combatMessage: io.combatMessage,
        displayCombatText: () => displayCombatTextFn(buildMessageContext() as any),
        messageColorFromVictim: () => badMessageColor,
        addPoison: (monst, total, conc) => addPoisonFn(monst, total, conc, combatCtx),
        flashMonster: (monst, color, strength) => flashMonsterFn(monst, color, strength, combatCtx),

        // ── UI (stubs — wired in port-v2-platform) ────────────────────────────
        message: io.message,
        messageWithColor: io.messageWithColor,
        flavorMessage: () => {},
        refreshDungeonCell,
        displayLevel: () => {},
        displayAnnotation: () => {},
        refreshSideBar,
        gameOver: (msg) => gameOver(msg),
        confirm: () => true,
        flashMessage: () => {},
        recordKeystroke: () => {},
        confirmMessages: io.confirmMessages,
        pauseAnimation: async (ms) => { commitDraws(); return platformPauseIgnoringHover(ms); },

        // ── Colors ───────────────────────────────────────────────────────────
        goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
        orange, green, red, yellow, darkRed, darkGreen,
        white, minersLightColor,

        // ── Environment / vision ──────────────────────────────────────────────
        updateEnvironment: buildUpdateEnvironmentFn(combatCtx),
        updateVision: buildUpdateVisionFn(),
        updateMapToShore: () => { rogue.mapToShore = updateMapToShoreFn(pmap); },
        updateSafetyMap: () => updateSafetyMapFn({
            rogue, player, pmap,
            safetyMap, allySafetyMap,
            DCOLS, DROWS, FP_FACTOR: 1,
            cellHasTerrainFlag: (pos: Pos, f: number) => cellHasTerrainFlagFn(pmap, pos, f),
            cellHasTMFlag: (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
            coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
            discoveredTerrainFlagsAtLoc: (pos: Pos) => discoveredTerrainFlagsAtLocFn(
                pmap, pos, tileCatalog,
                (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            monsterAtLoc,
            allocGrid, freeGrid: () => {},
            dijkstraScan: dijkstraScanFn,
        } as unknown as SafetyMapsContext),
        refreshWaypoint(index: number) {
            const dist = rogue.wpDistance[index];
            const coord = rogue.wpCoordinates[index];
            if (!dist || !coord) return;
            const costCtx = {
                cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
                cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
                discoveredTerrainFlagsAtLoc: (pos: Pos) => discoveredTerrainFlagsAtLocFn(
                    pmap, pos, tileCatalog,
                    (tileType) => {
                        const df = tileCatalog[tileType]?.discoverType ?? 0;
                        return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                    },
                ),
            };
            refreshWaypointFn(dist, coord, (cm) => populateGenericCostMap(cm, costCtx as never), monsters);
        },
        analyzeMap: (calculateChokeMap: boolean) => analyzeMapFn(pmap, null, calculateChokeMap),
        removeDeadMonsters() {
            for (let i = monsters.length - 1; i >= 0; i--) {
                const m = monsters[i];
                if (
                    (m.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) ||
                    (m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED) ||
                    m.currentHP <= 0
                ) {
                    if (coordinatesAreInMap(m.loc.x, m.loc.y)) {
                        pmap[m.loc.x][m.loc.y].flags &= ~TileFlag.HAS_MONSTER;
                    }
                    monsters.splice(i, 1);
                }
            }
        },
        shuffleTerrainColors: (pct, reset) => shuffleTerrainColorsFn(pct, reset, pmap),
        resetDFMessageEligibility() {
            for (const df of dungeonFeatureCatalog) {
                df.messageDisplayed = false;
            }
        },
        RNGCheck: () => {},
        animateFlares: buildAnimateFlaresFn(),

        // ── Scent / FOV ───────────────────────────────────────────────────────
        addScentToCell: (x, y, distance) => {
            // Inline addScentToCell logic (from movement/map-queries.ts)
            if (!cellHasTerrainFlagFn(pmap, {x, y}, T_OBSTRUCTS_SCENT) ||
                !cellHasTerrainFlagFn(pmap, {x, y}, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                const value = (rogue.scentTurnNumber - distance) & 0xFFFF;
                scentMap[x][y] = Math.max(value, scentMap[x][y] & 0xFFFF);
            }
        },
        getFOVMask: (grid, cx, cy, radius, blockFlags, blockTMFlags, ignoreWalls) =>
            getFOVMaskFn(grid, cx, cy, radius, blockFlags, blockTMFlags, ignoreWalls, fovCtxForScent),
        zeroOutGrid,
        discoverCell: (x, y) => { if (coordinatesAreInMap(x, y)) { pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY; pmap[x][y].flags |= TileFlag.DISCOVERED; } },
        discover: (x, y) => { if (coordinatesAreInMap(x, y)) { pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY; pmap[x][y].flags |= TileFlag.DISCOVERED; } },
        storeMemories: (x, y) => storeMemoriesFn(
            pmap, x, y,
            (pos) => terrainFlagsFn(pmap, pos),
            (pos) => terrainMechFlagsFn(pmap, pos),
            (pm, xi, yi, skipGas) => highestPriorityLayer(pm, xi, yi, skipGas) as DungeonLayer,
        ),

        // ── Items / recharging ────────────────────────────────────────────────
        rechargeItemsIncrementally: (multiplier: number) => rechargeItemsIncrementallyFn(multiplier, {
            rogue: { wisdomBonus: rogue.wisdomBonus },
            FP_FACTOR: Number(FP_FACTOR),
            ringWisdomMultiplier: (val: number) => Number(ringWisdomMultiplierFn(BigInt(val))),
            packItems,
            randClumpedRange,
            max: Math.max,
            clamp,
            charmRechargeDelay: (kind: number, enchant: number) =>
                charmRechargeDelayFn(charmEffectTable[kind], enchant),
            itemName: (item: Item, includeDetails: boolean, includeArticle: boolean) =>
                itemNameFn(item, includeDetails, includeArticle, namingCtx),
            message: io.message,
        } as unknown as MiscHelpersContext),
        processIncrementalAutoID: () => processIncrementalAutoIDFn({
            rogue: {
                armor: rogue.armor,
                ringLeft: rogue.ringLeft,
                ringRight: rogue.ringRight,
            } as unknown as MiscHelpersContext["rogue"],
            ringTable,
            itemName: (item: Item, _inclArticle: boolean, inclRunic: boolean) =>
                itemNameFn(item, inclRunic, _inclArticle, namingCtx),
            message: io.message,
            identify: (item: Item) => identifyFn(item, gameConst, { scrollTable: mutableScrollTable, potionTable: mutablePotionTable }),
            updateIdentifiableItems: () => updateIdentifiableItemsFn({
                packItems, floorItems,
                updateIdentifiableItem: (item: Item) => updateIdentifiableItemFn(item, { scrollTable: mutableScrollTable, potionTable: mutablePotionTable }),
            }),
        } as unknown as MiscHelpersContext),

        // ── Tile effects ──────────────────────────────────────────────────────
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        applyGradualTileEffectsToCreature: (monst, ticks) => applyGradualTileEffectsFn(monst, ticks, gradualCtx),
        monsterShouldFall: () => false,
        monstersFall: () => monstersFallFn({
            monsters, pmap, levels,
            cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
            rogue: { depthLevel: rogue.depthLevel } as unknown as CreatureEffectsContext["rogue"],
            canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
            monsterName: (buf: string[], m: Creature, includeArticle: boolean) => {
                if (m === player) { buf[0] = "you"; return; }
                const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
                buf[0] = `${pfx}${m.info.monsterName}`;
            },
            messageWithColor: (msg: string, color: Color, flags: number) => io.messageWithColor(msg, color, flags),
            messageColorFromVictim: (monst: Creature): Color =>
                (monst === player || monst.creatureState === CreatureState.Ally) ? badMessageColor : goodMessageColor,
            killCreature: (monst: Creature, adminDeath: boolean) => killCreatureFn(monst, adminDeath, combatCtx),
            inflictDamage: (attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean) =>
                inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
            randClumpedRange, red,
            demoteMonsterFromLeadership: (monst: Creature) => demoteMonsterFromLeadershipFn(monst, monsters),
            removeCreature: (list: Creature[], monst: Creature) => {
                const i = list.indexOf(monst); if (i >= 0) { list.splice(i, 1); return true; } return false;
            },
            prependCreature: (list: Creature[], monst: Creature) => { list.unshift(monst); },
            refreshDungeonCell,
        } as unknown as CreatureEffectsContext),
        decrementPlayerStatus: () => decrementPlayerStatusFn(decrementStatusCtx),
        playerFalls: buildPlayerFallsFn(combatCtx),
        handleHealthAlerts: async () => handleHealthAlertsFn({
            player,
            rogue: rogue as unknown as CreatureEffectsContext["rogue"],
            badMessageColor, darkRed, yellow, darkGreen,
            flashMessage: () => {},
            assureCosmeticRNG: () => {},
            restoreRNG: () => {},
        } as unknown as CreatureEffectsContext),
        updateScent() {
            if (!rogue.scentMap) rogue.scentMap = allocGrid();
            const sm = rogue.scentMap;
            const grid = allocGrid();
            zeroOutGrid(grid);
            getFOVMaskFn(grid, player.loc.x, player.loc.y,
                BigInt(DCOLS) * FP_FACTOR, T_OBSTRUCTS_SCENT, 0, false, fovCtxForScent);
            const px = player.loc.x, py = player.loc.y;
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (grid[i][j]) {
                        const dist = scentDistance(px, py, i, j);
                        const value = (rogue.scentTurnNumber - dist) & 0xFFFF;
                        if (!cellHasTerrainFlagFn(pmap, {x:i,y:j}, T_OBSTRUCTS_SCENT) ||
                            !cellHasTerrainFlagFn(pmap, {x:i,y:j}, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                            sm[i][j] = Math.max(value, sm[i][j] & 0xFFFF);
                        }
                    }
                }
            }
            const val0 = rogue.scentTurnNumber & 0xFFFF;
            sm[px][py] = Math.max(val0, sm[px][py] & 0xFFFF);
        },
        currentStealthRange: () => currentStealthRangeFn({
            player,
            rogue,
            pmapAt: (loc: Pos) => pmap[loc.x][loc.y],
            IS_IN_SHADOW: TileFlag.IS_IN_SHADOW,
            ARMOR: ItemCategory.ARMOR,
            armorTable,
            playerInDarkness: () => playerInDarknessFn(tmap, player.loc),
            max: Math.max,
        } as unknown as CreatureEffectsContext),

        // ── Movement / search (stubs) ─────────────────────────────────────────
        search: () => false,
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),

        spawnDungeonFeature: (x, y, feat, isVolatile, overrideProtection) => {
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, isVolatile, overrideProtection);
        },

        // ── Constants ─────────────────────────────────────────────────────────
        nbDirs,
        rand_range: randRange,
        rand_percent: randPercent,
        max: Math.max,
        min: Math.min,
        monstersApproachStairs: () => monstersApproachStairsFn(buildMonstersApproachStairsCtx()),
    };
}

// buildMonstersTurnContext is in turn-monster-ai.ts (re-exported below)
export { buildMonstersTurnContext } from "./turn-monster-ai.js";

// Re-export for use by other domain files
export { buildTurnProcessingContext as buildTurnCtx };

// Convenience: import and call playerTurnEnded with the built context
import { playerTurnEnded as playerTurnEndedFn } from "./time/turn-processing.js";
import { monstersTurn as monstersTurnFn } from "./monsters/monster-actions.js";

/** Run one full player turn. Called by the main game loop. */
export async function playerTurnEnded(): Promise<void> {
    await playerTurnEndedFn(buildTurnProcessingContext());
}
