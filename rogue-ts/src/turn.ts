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
import { deleteItem as deleteItemFn, numberOfMatchingPackItems as numberOfMatchingPackItemsFn, itemAtLoc as itemAtLocFn } from "./items/item-inventory.js";
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
} from "./state/helpers.js";
import { anyoneWantABite as anyoneWantABiteFn } from "./combat/combat-helpers.js";
import type { CombatHelperContext } from "./combat/combat-helpers.js";
import { allocGrid } from "./grid/grid.js";
import { zeroOutGrid } from "./architect/helpers.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { randRange, randPercent, randClumpedRange, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "./math/rng.js";
import { nbDirs, coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import {
    goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
    orange, green, red, yellow, darkRed, darkGreen, poisonColor,
} from "./globals/colors.js";
import { DCOLS, DROWS, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD } from "./types/constants.js";
import { TileFlag, ItemFlag, MessageFlag, MonsterBookkeepingFlag, TerrainFlag, TerrainMechFlag, T_OBSTRUCTS_SCENT, IS_IN_MACHINE } from "./types/flags.js";
import { refreshWaypoint as refreshWaypointFn } from "./architect/architect.js";
import { populateGenericCostMap } from "./movement/cost-maps-fov.js";
import { CreatureState, GameMode, ALL_ITEMS, LightType, ItemCategory, FoodKind, DungeonLayer } from "./types/enums.js";
import type { TurnProcessingContext } from "./time/turn-processing.js";
import { updateEnvironment as updateEnvironmentFn, promoteTile as promoteTileFn, activateMachine as activateMachineFn, circuitBreakersPreventActivation as circuitBreakersPreventActivationFn, exposeTileToFire as exposeTileToFireFn } from "./time/environment.js";
import type { EnvironmentContext } from "./time/environment.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { applyGradualTileEffectsToCreature as applyGradualTileEffectsFn, playerFalls as playerFallsFn, decrementPlayerStatus as decrementPlayerStatusFn, currentStealthRange as currentStealthRangeFn } from "./time/creature-effects.js";
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";
import { buildFadeInMonsterFn } from "./combat.js";
import type { Creature, Pcell, Pos, PlayerCharacter, Color, Item } from "./types/types.js";
import { INVALID_POS } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn, buildDisplayLevelFn } from "./io-wiring.js";
import { displayCombatText as displayCombatTextFn } from "./io/messages.js";
import { buildMessageContext } from "./ui.js";
import { buildUpdateVisionFn, buildAnimateFlaresFn } from "./vision-wiring.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn, playerInDarkness as playerInDarknessFn } from "./light/light.js";
import { shuffleTerrainColors as shuffleTerrainColorsFn } from "./render-state.js";
import { checkForContinuedLeadership as checkForContinuedLeadershipFn, demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { buildResolvePronounEscapesFn, getMonsterDFMessage as getMonsterDFMessageFn } from "./io/text.js";
import { buildMonstersTurnContext } from "./turn-monster-ai.js";
import { doMakeMonsterDropItem } from "./monsters.js";
import { updateEncumbrance as updateEncumbranceFn, recalculateEquipmentBonuses as recalculateEquipmentBonusesFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses } from "./items/equip-helpers.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import { scentDistance } from "./time/turn-processing.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { autoIdentify as autoIdentifyFn } from "./items/item-handlers.js";
import { dropItem as dropItemFn } from "./items/floor-items.js";
import { buildUpdateFloorItemsFn } from "./items/floor-items-wiring.js";
import { startLevel as startLevelFn } from "./lifecycle.js";
import { layerWithFlag as layerWithFlagFn } from "./movement/map-queries.js";
import { teleport as teleportFn, disentangle as disentangleFn } from "./monsters/monster-teleport.js";
import { createFlare as createFlareFn } from "./light/flares.js";
import { calculateDistances } from "./dijkstra/dijkstra.js";
import { forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn, avoidedFlagsForMonster as avoidedFlagsForMonsterFn } from "./monsters/monster-spawning.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "./items/item-generation.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./items/item-utils.js";
import { wandTable, staffTable, ringTable, charmTable, armorTable } from "./globals/item-catalog.js";
import type { ItemTable } from "./types/types.js";
import { buildMonstersApproachStairsCtx, monstersApproachStairs as monstersApproachStairsFn } from "./time/stairs-wiring.js";

// =============================================================================
// Minimal combat context — used by inflictDamage/killCreature/addPoison calls
// in the turn-processing pipeline. Full context in Phase 3: combat.ts.
// =============================================================================

function buildMinimalCombatContext(
    player: Creature,
    rogue: PlayerCharacter,
    pmap: Pcell[][],
    monsters: Creature[],
    floorItems: Item[],
): CombatDamageContext {
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();
    const resolvePronounEscapes = buildResolvePronounEscapesFn(player, pmap, rogue);

    return {
        player,
        easyMode: rogue.mode === GameMode.Easy,
        transference: rogue.transference,
        playerTransferenceRatio: 20,
        canSeeMonster,
        canDirectlySeeMonster: canSeeMonster,
        wakeUp: buildWakeUpFn(player, monsters),
        spawnDungeonFeature(x, y, featureIndex, probability, _isGas) {
            const feat = dungeonFeatureCatalog[featureIndex];
            if (!feat) return;
            const scaled = probability === 100
                ? feat
                : { ...feat, startProbability: Math.floor(feat.startProbability * probability / 100) };
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, scaled as never, true, false);
        },
        refreshSideBar,
        combatMessage: io.combatMessage,
        messageWithColor: (text, color) => io.messageWithColor(text, color, 0),
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            return `${pfx}${m.info.monsterName}`;
        },
        gameOver: (msg) => gameOver(msg),
        setCreaturesWillFlash: () => { rogue.creaturesWillFlashThisTurn = true; },
        deleteItem: deleteItemFn,
        makeMonsterDropItem: (monst: Creature) =>
            doMakeMonsterDropItem(monst, pmap, floorItems, (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags), refreshDungeonCell),
        clearLastTarget: () => {},                  // stub
        clearYendorWarden: () => {},                // stub
        clearCellMonsterFlag: () => {},             // stub
        prependCreature: () => {},                  // stub
        applyInstantTileEffectsToCreature: () => {},// stub
        fadeInMonster: buildFadeInMonsterFn(),
        refreshDungeonCell,
        anyoneWantABite: (decedent) => anyoneWantABiteFn(decedent, {
            player,
            iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
            randRange: (lo: number, hi: number) => randRange(lo, hi),
            isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
            monsterAvoids: () => false,
        } as unknown as CombatHelperContext),
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes,
        message: io.message,
        monsterCatalog: [],                         // stub — real catalog via core.ts
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: () => {},                     // stub
        badMessageColor,
        poisonColor,
    };
}

// =============================================================================
// buildTurnProcessingContext
// =============================================================================

/**
 * Build the TurnProcessingContext for playerTurnEnded().
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
        spawnPeriodicHorde: () => {},   // stub — separate wiring
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
        canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        canDirectlySeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterRevealed: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName(buf, m, includeArticle) {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        },
        monsterAtLoc,
        monstersAreEnemies: (m1, m2) => m1.creatureState !== CreatureState.Ally && m2 === player,
        monsterAvoids: () => false,                         // stub
        monsterIsInClass: () => false,                      // stub
        isVowelish: (w) => "aeiouAEIOU".includes(w[0] ?? ""),
        monstersTurn: (monst) => monstersTurnFn(monst, buildMonstersTurnContext()),
        decrementMonsterStatus(monst) {
            for (let i = 0; i < monst.status.length; i++) {
                if (monst.status[i] > 0) monst.status[i]--;
            }
            return false;
        },
        removeCreature(list, monst) {
            const idx = list.indexOf(monst);
            if (idx >= 0) { list.splice(idx, 1); return true; }
            return false;
        },
        prependCreature(list, monst) { list.unshift(monst); },

        // ── Item helpers ──────────────────────────────────────────────────────
        itemName(item, buf, inclDetails, inclArticle) { buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx); },
        numberOfMatchingPackItems: () => 0,                 // stub

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
        pauseAnimation: () => false,

        // ── Colors ───────────────────────────────────────────────────────────
        goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
        orange, green, red, yellow, darkRed, darkGreen,

        // ── Environment / vision ──────────────────────────────────────────────
        updateEnvironment: () => {
            let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
            const envCtx: EnvironmentContext = {
                player, rogue, monsters, pmap, levels, tileCatalog, DCOLS, DROWS,
                dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as EnvironmentContext["dungeonFeatureCatalog"],
                cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
                cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
                coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
                refreshDungeonCell,
                spawnDungeonFeature: (x, y, feat, v, o) => spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, v, o, refreshDungeonCell),
                monstersFall: () => {},
                monstersTurn: () => {},
                updateFloorItems: buildUpdateFloorItemsFn({
                    floorItems, pmap,
                    rogue: { absoluteTurnNumber: rogue.absoluteTurnNumber, depthLevel: rogue.depthLevel },
                    gameConst, levels, player,
                    tileCatalog: tileCatalog as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["tileCatalog"],
                    dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["dungeonFeatureCatalog"],
                    mutableScrollTable: mutableScrollTable as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["mutableScrollTable"],
                    mutablePotionTable: mutablePotionTable as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["mutablePotionTable"],
                    itemMessageColor,
                    messageWithColor: (msg, color, flags) => io.messageWithColor(msg, color, flags),
                    itemName: (item, buf, details, article) => { buf[0] = itemNameFn(item, details, article, namingCtx); },
                    refreshDungeonCell,
                    promoteTile: (x, y, layer, forced) => promoteTileFn(x, y, layer as DungeonLayer, forced, envCtx),
                    activateMachine: (mn) => activateMachineFn(mn, envCtx),
                    circuitBreakersPreventActivation: (mn) => circuitBreakersPreventActivationFn(mn, envCtx),
                }),
                keyOnTileAt: (loc: Pos) => {
                    const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;
                    if (player.loc.x === loc.x && player.loc.y === loc.y) {
                        const k = packItems.find(it => (it.flags & ItemFlag.ITEM_IS_KEY) && keyMatchesLocationFn(it, loc, rogue.depthLevel, machineNum));
                        if (k) return k;
                    }
                    if (pmap[loc.x][loc.y].flags & TileFlag.HAS_ITEM) {
                        const fi = itemAtLocFn(loc, floorItems);
                        if (fi && (fi.flags & ItemFlag.ITEM_IS_KEY) && keyMatchesLocationFn(fi, loc, rogue.depthLevel, machineNum)) return fi;
                    }
                    const monst = monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y);
                    if (monst?.carriedItem && (monst.carriedItem.flags & ItemFlag.ITEM_IS_KEY) && keyMatchesLocationFn(monst.carriedItem, loc, rogue.depthLevel, machineNum)) return monst.carriedItem;
                    return null;
                },
                removeCreature: (list, m) => { const i = list.indexOf(m); if (i >= 0) { list.splice(i, 1); return true; } return false; },
                prependCreature: (list, m) => { list.unshift(m); },
                rand_range: randRange, rand_percent: randPercent, max: Math.max, min: Math.min,
                fillSequentialList: (list) => fillSequentialListFn(list), shuffleList: (list) => shuffleListFn(list),
                exposeTileToFire: (x, y, a) => exposeToFire(x, y, a),
            };
            exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);
            updateEnvironmentFn(envCtx);
        },
        updateVision: buildUpdateVisionFn(),
        updateMapToShore: () => {},
        updateSafetyMap: () => {},
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
        analyzeMap: () => {},
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
        storeMemories: () => {},

        // ── Items / recharging (stubs) ────────────────────────────────────────
        rechargeItemsIncrementally: () => {},
        processIncrementalAutoID: () => {},

        // ── Tile effects ──────────────────────────────────────────────────────
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        applyGradualTileEffectsToCreature: (monst, ticks) => applyGradualTileEffectsFn(monst, ticks, gradualCtx),
        monsterShouldFall: () => false,
        monstersFall: () => {},
        decrementPlayerStatus: () => decrementPlayerStatusFn(decrementStatusCtx),
        playerFalls: async () => {
            const fallCtx = {
                player, rogue, pmap, gameConst,
                cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
                playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                discover: (x: number, y: number) => { if (coordinatesAreInMap(x, y)) { pmap[x][y].flags |= TileFlag.DISCOVERED; } },
                monstersFall: () => {},     // stub — separate backlog item
                updateFloorItems: () => {}, // stub — separate backlog item
                layerWithFlag: (x: number, y: number, flag: number) => layerWithFlagFn(pmap, x, y, flag),
                tileCatalog,
                pmapAt: (pos: Pos) => pmap[pos.x][pos.y],
                REQUIRE_ACKNOWLEDGMENT: 1,
                message: io.message,
                terrainFlags: (pos: Pos) => terrainFlagsFn(pmap, pos),
                messageWithColor: (msg: string, color: Color, f: number) => io.messageWithColor(msg, color, f),
                badMessageColor, red,
                inflictDamage: (attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean) =>
                    inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
                killCreature: (monst: Creature, adminDeath: boolean) => killCreatureFn(monst, adminDeath, combatCtx),
                gameOver: (msg: string) => gameOver(msg),
                startLevel: (depth: number, dir: number) => startLevelFn(depth, dir),
                randClumpedRange,
                teleport: (monst: Creature, destination: Pos, voluntary: boolean) => {
                    const fovCtx = {
                        cellHasTerrainFlag: _ctf,
                        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
                    };
                    teleportFn(monst, destination, voluntary, {
                        player,
                        disentangle: (m: Creature) => disentangleFn(m, { player, message: () => {} }),
                        calculateDistancesFrom: (grid: number[][], x: number, y: number, flags: number) =>
                            calculateDistances(grid, x, y, flags, null, true, false, {
                                cellHasTerrainFlag: _ctf,
                                cellHasTMFlag: (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
                                monsterAtLoc,
                                monsterAvoids: () => false as const,
                                discoveredTerrainFlagsAtLoc: () => 0,
                                isPlayer: (m: Creature) => m === player,
                                getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
                            }),
                        getFOVMaskAt: (grid: number[][], x: number, y: number, radius: bigint, terrain: number, f: number, cautious: boolean) =>
                            getFOVMaskFn(grid, x, y, radius, terrain, f, cautious, fovCtx),
                        forbiddenFlagsForMonster: (info) => forbiddenFlagsForMonsterFn(info),
                        avoidedFlagsForMonster: (info) => avoidedFlagsForMonsterFn(info),
                        cellHasTerrainFlag: _ctf,
                        cellHasTMFlag: (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
                        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
                        isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                        setMonsterLocation(m: Creature, loc: Pos) {
                            const flag = m === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER;
                            if (pmap[m.loc.x]?.[m.loc.y]) pmap[m.loc.x][m.loc.y].flags &= ~flag;
                            m.loc = { ...loc };
                            if (pmap[loc.x]?.[loc.y]) pmap[loc.x][loc.y].flags |= flag;
                            if ((m.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
                                !cellHasTMFlagFn(pmap, loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)) {
                                m.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                            }
                        },
                        chooseNewWanderDestination: () => {},
                        IS_IN_MACHINE,
                        HAS_PLAYER: TileFlag.HAS_PLAYER,
                        HAS_MONSTER: TileFlag.HAS_MONSTER,
                        HAS_STAIRS: TileFlag.HAS_STAIRS,
                    });
                },
                INVALID_POS: { ...INVALID_POS },
                createFlare: (x: number, y: number, lightType: number) => createFlareFn(x, y, lightType as LightType, rogue, lightCatalog),
                animateFlares: () => {},    // stub — flare animation is visual
                GENERIC_FLASH_LIGHT: LightType.GENERIC_FLASH_LIGHT,
            };
            await playerFallsFn(fallCtx as unknown as CreatureEffectsContext);
        },
        handleHealthAlerts: () => {},
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
