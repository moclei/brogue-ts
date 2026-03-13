/*
 *  items.ts — Item context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildItemHandlerContext() and buildItemHelperContext(),
 *  the context factories that wire the items module's DI interfaces.
 *
 *  UI functions (message, confirm, display), platform recording, and
 *  complex environment effects (spawnDungeonFeature, crystalize,
 *  negationBlast, haste, teleport, etc.) are stubbed here; they will
 *  be wired in port-v2-platform.  Charm/enchant calculations, heal,
 *  removeItemFromChain, and inventory queries are real implementations.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";
import { buildCombatDamageContext, buildFadeInMonsterFn } from "./combat.js";
import { buildTurnProcessingContext } from "./turn.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import {
    foodTable, wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "./globals/item-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import {
    identify as identifyFn,
} from "./items/item-naming.js";
import {
    removeItemFromArray,
    numberOfMatchingPackItems as numberOfMatchingPackItemsFn,
} from "./items/item-inventory.js";
import { enchantMagnitude, netEnchant as netEnchantFn, updateEncumbrance as updateEncumbranceFn, updateRingBonuses as updateRingBonusesFn, equipItem as equipItemFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses, syncEquipState } from "./items/equip-helpers.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "./items/item-generation.js";
import {
    heal as healFn,
    killCreature as killCreatureFn,
    inflictLethalDamage as inflictLethalDamageFn,
    flashMonster as flashMonsterFn,
} from "./combat/combat-damage.js";
import { alertMonster as alertMonsterFn } from "./monsters/monster-state.js";
import {
    teleport as teleportFn,
    disentangle as disentangleFn,
} from "./monsters/monster-teleport.js";
import { calculateDistances } from "./dijkstra/dijkstra.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import {
    spawnHorde as spawnHordeFn,
    forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn,
    avoidedFlagsForMonster as avoidedFlagsForMonsterFn,
} from "./monsters/monster-spawning.js";
import {
    monsterName as monsterNameFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    canSeeMonster as canSeeMonsterFn,
    monsterRevealed as monsterRevealedFn,
} from "./monsters/monster-queries.js";
import { negateCreature } from "./monsters/monster-negate.js";
import {
    negationBlast as negationBlastFn,
    haste as hasteFn,
    makePlayerTelepathic as makePlayerTelepathicFn,
    imbueInvisibility as imbueInvisibilityFn,
    discordBlast as discordBlastFn,
    rechargeItems as rechargeItemsFn,
    updateIdentifiableItem as updateIdentifiableItemFn,
    updatePlayerRegenerationDelay as updatePlayerRegenerationDelayFn,
} from "./items/item-effects.js";
import { updateIdentifiableItems as updateIdentifiableItemsFn } from "./items/item-handlers.js";
import { statusEffectCatalog } from "./globals/status-effects.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "./io/color.js";
import {
    charmHealing as charmHealingFn,
    charmProtection as charmProtectionFn,
    charmEffectDuration as charmEffectDurationFn,
    charmShattering as charmShatteringFn,
    charmNegationRadius as charmNegationRadiusFn,
    charmRechargeDelay as charmRechargeDelayFn,
    charmGuardianLifespan as charmGuardianLifespanFn,
    staffBlinkDistance as staffBlinkDistanceFn,
} from "./power/power-tables.js";
import { randRange, randPercent, randClump } from "./math/rng.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "./state/helpers.js";
import {
    coordinatesAreInMap, mapToWindowX, mapToWindowY, nbDirs,
} from "./globals/tables.js";
import { playerTurnEnded as playerTurnEndedFn } from "./time/turn-processing.js";
import { allocGrid, fillGrid } from "./grid/grid.js";
import { freeCaptivesEmbeddedAt as freeCaptivesEmbeddedAtFn } from "./movement/ally-management.js";
import { generateMonster as generateMonsterFn } from "./monsters/monster-creation.js";
import {
    aggravateMonsters as aggravateMonstersFn,
    crystalize as crystalizeFn,
    summonGuardian as summonGuardianFn,
} from "./items/monster-spell-effects.js";
import {
    itemMessageColor, advancementMessageColor, magicMapFlashColor,
    darkBlue, gray, black, forceFieldColor,
} from "./globals/colors.js";
import { DungeonFeatureType, LightType, BoltType, CharmKind, StatusEffect } from "./types/enums.js";
import {
    TileFlag, MessageFlag, HordeFlag, HORDE_MACHINE_ONLY,
    MonsterBookkeepingFlag, TerrainMechFlag, IS_IN_MACHINE,
} from "./types/flags.js";
import { INVALID_POS } from "./types/types.js";
import { KEYBOARD_LABELS } from "./types/constants.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import type { ItemHandlerContext } from "./items/item-handlers.js";
import {
    buildStaffChooseTargetFn,
    buildStaffPlayerCancelsBlinkingFn,
    buildStaffZapFn,
} from "./items/staff-wiring.js";
import type { ItemTable, Creature, Pos } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn, buildExposeCreatureToFireFn, buildPromptForItemOfTypeFn, buildConfirmFn, buildDisplayLevelFn, buildColorFlashFn } from "./io-wiring.js";
import { buildResolvePronounEscapesFn } from "./io/text.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterAtLoc(player: Creature, monsters: Creature[]) {
    return function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

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

// =============================================================================
// buildItemHandlerContext
// =============================================================================

/**
 * Build an ItemHandlerContext backed by the current game state.
 *
 * Wires real implementations for item tables, catalogs, RNG, heal,
 * charm calculations, inventory management, and turn advancement.
 * Platform/display, recording, environment effects, and movement-based
 * operations (haste, teleport, targeting) are stubbed — wired in
 * port-v2-platform.
 */
export function buildItemHandlerContext(): ItemHandlerContext {
    const state = getGameState();
    const {
        player, rogue, pmap, monsters, packItems, floorItems,
        mutableScrollTable, mutablePotionTable, gameConst,
    } = state;

    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();

    const combatCtx = buildCombatDamageContext();
    const namingCtx = buildNamingCtx(state);

    const cellHasTerrainFlag = (loc: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, loc, flags);
    const cellHasTMFlag = (loc: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, loc, flags);
    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    // ── MonsterQueryContext — used by negationBlast creature checks ──────────
    const mqCtx = {
        player,
        cellHasTerrainFlag,
        cellHasGas: () => false,
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // ── NegateContext — wires negateCreature for negationBlast ───────────────
    const negateCtx = {
        player,
        boltCatalog,
        mutationCatalog,
        statusEffectCatalog,
        monsterName: (m: Creature, includeArticle: boolean) =>
            monsterNameFn(m, includeArticle, mqCtx),
        killCreature: (m: Creature) => killCreatureFn(m, false, combatCtx),
        combatMessage: io.combatMessage,
        messageColorFromVictim: (m: Creature) => messageColorFromVictimFn(
            m, player,
            player.status[StatusEffect.Hallucinating] > 0,
            rogue.playbackOmniscience,
            (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        ),
        extinguishFireOnCreature: () => {},  // permanent-defer — requires full CreatureEffectsContext
        refreshDungeonCell,
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        resolvePronounEscapes: buildResolvePronounEscapesFn(player, pmap, rogue),
    };

    return {
        // ── Game state ──────────────────────────────────────────────────────
        gc: gameConst,
        rogue,
        player,
        pmap,
        packItems,
        floorItems,
        monsters,

        // ── Item tables ─────────────────────────────────────────────────────
        scrollTable: mutableScrollTable,
        potionTable: mutablePotionTable,
        foodTable: foodTable as unknown as ItemTable[],
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],

        // ── Catalogs ────────────────────────────────────────────────────────
        tileCatalog: tileCatalog as unknown as Array<{ flags: number; mechFlags: number; drawPriority: number }>,
        boltCatalog,
        dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as Array<object>,

        // ── Colors ──────────────────────────────────────────────────────────
        itemMessageColor,
        advancementMessageColor,

        // ── Naming context ──────────────────────────────────────────────────
        namingCtx,

        // ── RNG ─────────────────────────────────────────────────────────────
        randRange: (lo, hi) => randRange(lo, hi),
        randPercent: (pct) => randPercent(pct),
        randClump: (range) => randClump(range),

        // ── UI stubs (wired in port-v2-platform) ────────────────────────────
        message: io.message,
        messageWithColor: io.messageWithColor,
        confirmMessages: io.confirmMessages,
        confirm: buildConfirmFn(),
        temporaryMessage: () => {},
        printString: () => {},

        // ── Inventory / item management ─────────────────────────────────────
        promptForItemOfType: buildPromptForItemOfTypeFn(),
        numberOfMatchingPackItems: (cat, req, forbidden, _err) =>
            numberOfMatchingPackItemsFn(packItems, cat, req, forbidden),
        removeItemFromChain(item, chain) { removeItemFromArray(item, chain); },
        deleteItem(item) {
            const idx = floorItems.indexOf(item);
            if (idx >= 0) floorItems.splice(idx, 1);
        },
        updateIdentifiableItem(item) {
            updateIdentifiableItemFn(item, {
                scrollTable: mutableScrollTable,
                potionTable: mutablePotionTable,
            });
        },
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateRingBonuses: () => { const s = buildEquipState(); updateRingBonusesFn(s); syncEquipBonuses(s); },
        equipItem: (item, force, hint) => {
            const s = buildEquipState();
            equipItemFn(item, force, hint, { state: s, message: (text, req) => io.message(text, req ? 1 : 0), itemName: () => "item",
                updateRingBonuses: () => { updateRingBonusesFn(s); syncEquipBonuses(s); }, updateEncumbrance: () => updateEncumbranceFn(s) });
            syncEquipState(s);
        },
        recalculateEquipmentBonuses: () => {},
        itemMagicPolarity: (item) => itemMagicPolarityFn(item),

        // ── Recording stubs (wired in port-v2-platform) ─────────────────────
        recordKeystroke: () => {},
        recordKeystrokeSequence: () => {},
        recordMouseClick: () => {},

        // ── Creature / combat helpers ────────────────────────────────────────
        heal: (target, percent, increaseMax) => healFn(target, percent, increaseMax, combatCtx),
        haste(target, duration) {
            hasteFn(target, duration, {
                player,
                updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
                message: io.message,
            });
        },
        teleport(target, destination, voluntary) {
            const calcDistCtx = {
                cellHasTerrainFlag,
                cellHasTMFlag,
                monsterAtLoc,
                monsterAvoids: () => false as const,
                discoveredTerrainFlagsAtLoc: () => 0,
                isPlayer: (m: Creature) => m === player,
                getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
            };
            const fovCtx = {
                cellHasTerrainFlag,
                getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
            };
            teleportFn(target, destination, voluntary, {
                player,
                disentangle: (m) => disentangleFn(m, { player, message: () => {} }),
                calculateDistancesFrom: (grid, x, y, flags) =>
                    calculateDistances(grid, x, y, flags, null, true, false, calcDistCtx),
                getFOVMaskAt: (grid, x, y, radius, terrain, flags, cautious) =>
                    getFOVMaskFn(grid, x, y, radius, terrain, flags, cautious, fovCtx),
                forbiddenFlagsForMonster: (info) => forbiddenFlagsForMonsterFn(info),
                avoidedFlagsForMonster: (info) => avoidedFlagsForMonsterFn(info),
                cellHasTerrainFlag,
                cellHasTMFlag,
                getCellFlags: (x, y) => pmap[x]?.[y]?.flags ?? 0,
                isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
                setMonsterLocation(monst, loc) {
                    const flag = monst === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER;
                    if (pmap[monst.loc.x]?.[monst.loc.y]) {
                        pmap[monst.loc.x][monst.loc.y].flags &= ~flag;
                        refreshDungeonCell(monst.loc);
                    }
                    monst.loc = { ...loc };
                    if (pmap[loc.x]?.[loc.y]) {
                        pmap[loc.x][loc.y].flags |= flag;
                    }
                    if (
                        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
                        !cellHasTMFlagFn(pmap, loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
                    ) {
                        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                    }
                },
                chooseNewWanderDestination: () => {},  // stub — Phase 3a
                IS_IN_MACHINE,
                HAS_PLAYER: TileFlag.HAS_PLAYER,
                HAS_MONSTER: TileFlag.HAS_MONSTER,
                HAS_STAIRS: TileFlag.HAS_STAIRS,
            });
        },
        exposeCreatureToFire: buildExposeCreatureToFireFn(),
        extinguishFireOnCreature: () => {},  // permanent-defer — requires full CreatureEffectsContext
        makePlayerTelepathic(duration) {
            makePlayerTelepathicFn(duration, {
                player,
                monsters,
                refreshDungeonCell,
                message: io.message,
            });
        },
        imbueInvisibility(target, duration) {
            imbueInvisibilityFn(target, duration, {
                player,
                boltCatalog,
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                monsterRevealed: (m) => monsterRevealedFn(m, player),
                refreshDungeonCell,
                refreshSideBar,
                flashMonster: (m, c, s) => flashMonsterFn(m, c, s, combatCtx),
            });
        },
        wakeUp: buildWakeUpFn(player, monsters),
        fadeInMonster: buildFadeInMonsterFn(),
        flashMonster: (m, c, s) => flashMonsterFn(m, c, s, combatCtx),
        aggravateMonsters(range, x, y, color) {
            aggravateMonstersFn(range, x, y, color, {
                player,
                monsters,
                scentMap: allocGrid(),          // fresh grid — scent gradient is approximate
                getPathDistances: (_gx, _gy) => {
                    const g = allocGrid();
                    fillGrid(g, 0);             // distance 0: all cells qualify; correct for full-map range
                    return g;
                },
                refreshWaypoint: () => {},      // permanent-defer — requires waypoint grid context
                wakeUp: buildWakeUpFn(player, monsters),
                alertMonster: (m) => alertMonsterFn(m, player),
                addScentToCell: () => {},       // permanent-defer — needs MapQueryContext with scentTurnNumber
                setStealthRange: (r) => { rogue.stealthRange = r; },
                currentStealthRange: () => rogue.stealthRange, // was hardcoded 14; use live value
                discover: () => {},             // permanent-defer — needs full MapQueryContext (wired in lifecycle)
                discoverCell: () => {},         // permanent-defer — requires CreatureEffectsContext
                colorFlash: buildColorFlashFn(),
                playerCanSee: (px, py) => !!(pmap[px]?.[py]?.flags & TileFlag.VISIBLE),
                message: io.message,
            });
        },
        monsterAtLoc,
        monsterName: (monst, _includeArticle) =>
            monst === player ? "you" : monst.info.monsterName,
        spawnHorde: (hordeID, pos, forbiddenHordeFlags, requiredHordeFlags) => {
            const spawnCtx = buildMonsterSpawningContext();
            return spawnHordeFn(hordeID, pos, forbiddenHordeFlags, requiredHordeFlags, spawnCtx);
        },
        summonGuardian(theItem) {
            const spawnCtx = buildMonsterSpawningContext();
            summonGuardianFn(theItem, {
                player,
                pmap,
                generateMonster: (kind, itemPossible, mutationPossible) =>
                    generateMonsterFn(kind, itemPossible, mutationPossible, spawnCtx.genCtx),
                getQualifyingPathLocNear: (loc, _useDiags, _forbidTerrain, _forbidFlags,
                    _adjTerrain, _adjFlags, _forbidLit) => ({ ...loc }),  // permanent-defer — requires Dijkstra pathfinding
                charmGuardianLifespan: (enchant) =>
                    charmGuardianLifespanFn(
                        enchant,
                        charmEffectTable[CharmKind.Guardian].effectMagnitudeConstant,
                        charmEffectTable[CharmKind.Guardian].effectMagnitudeMultiplier,
                    ),
                netEnchant: (item) => netEnchantFn(item, rogue.strength, player.weaknessAmount),
                fadeInMonster: buildFadeInMonsterFn(),
            });
        },

        // ── Dungeon feature / environment ───────────────────────────────────
        spawnDungeonFeature(x, y, feature, refreshCell, abortIfBlocking) {
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feature as never, refreshCell, abortIfBlocking);
        },
        cellHasTMFlag,
        cellHasTerrainFlag,
        discover: () => {},                  // permanent-defer — needs full MapQueryContext (wired in lifecycle)
        refreshDungeonCell,
        crystalize(radius) {
            const combatCtx = buildCombatDamageContext();
            const allyCtx = {
                player, pmap,
                demoteMonsterFromLeadership: () => {},  // stub
                makeMonsterDropItem: () => {},           // stub
                refreshDungeonCell,
                monsterName: (m: Creature) => m.info.monsterName,
                message: io.message,
                monsterAtLoc,
                cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
            };
            crystalizeFn(radius, {
                player,
                pmap,
                spawnDungeonFeature: (x, y, feat, vol, abo) =>
                    spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, vol, abo),
                monsterAtLoc,
                inflictLethalDamage: (attacker, defender) =>
                    inflictLethalDamageFn(attacker, defender, combatCtx),
                killCreature: (monst, admin) => killCreatureFn(monst, admin, combatCtx),
                freeCaptivesEmbeddedAt: (x, y) => freeCaptivesEmbeddedAtFn(x, y, allyCtx),
                updateVision: () => {},         // permanent-defer — visual update (wired in turn/lifecycle contexts)
                colorFlash: buildColorFlashFn(),
                displayLevel: buildDisplayLevelFn(),
                refreshSideBar,
                forceFieldColor,
            });
        },
        rechargeItems(categories) {
            rechargeItemsFn(categories, {
                packItems,
                message: io.message,
            });
        },
        negationBlast(source, radius) {
            negationBlastFn(source, radius, {
                player,
                monsters,
                floorItems,
                pmap,
                itemMessageColor,
                negate: (m) => negateCreature(m, negateCtx),
                colorFlash: buildColorFlashFn(),
                flashMonster: (m, c, s) => flashMonsterFn(m, c, s, combatCtx),
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                messageWithColor: io.messageWithColor,
                identify: (item) => identifyFn(item, gameConst),
                refreshDungeonCell,
                updateIdentifiableItems: () => updateIdentifiableItemsFn({
                    packItems,
                    floorItems,
                    updateIdentifiableItem: () => {},
                }),
                charmRechargeDelay: (kind, enchant) =>
                    charmRechargeDelayFn(charmEffectTable[kind], enchant),
                IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
            });
        },
        discordBlast(source, radius) {
            discordBlastFn(source, radius, {
                player,
                monsters,
                pmap,
                itemMessageColor,
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                colorFlash: buildColorFlashFn(),
                flashMonster: (m, c, s) => flashMonsterFn(m, c, s, combatCtx),
                messageWithColor: io.messageWithColor,
                IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
            });
        },

        // ── Visual effects ───────────────────────────────────────────────────
        colorFlash: buildColorFlashFn(),
        createFlare: () => {},               // permanent-defer — visual flare effect only
        displayLevel: buildDisplayLevelFn(),

        // ── Vision / light stubs ────────────────────────────────────────────
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: () => {},              // permanent-defer — visual update (wired in turn/lifecycle contexts)
        updateClairvoyance: () => {},        // permanent-defer — requires SafetyMapsContext
        updatePlayerRegenerationDelay() {
            updatePlayerRegenerationDelayFn({
                player,
                regenerationBonus: rogue.regenerationBonus,
            });
        },

        // ── Targeting ───────────────────────────────────────────────────────
        chooseTarget: buildStaffChooseTargetFn(),
        staffBlinkDistance: (enchant) => staffBlinkDistanceFn(enchant),
        playerCancelsBlinking: buildStaffPlayerCancelsBlinkingFn(),
        zap: buildStaffZapFn(),

        // ── Turn management ─────────────────────────────────────────────────
        async playerTurnEnded() {
            const turnCtx = buildTurnProcessingContext();
            await playerTurnEndedFn(turnCtx);
        },

        // ── Map helpers ─────────────────────────────────────────────────────
        mapToWindowX: (x) => mapToWindowX(x),
        mapToWindowY: (y) => mapToWindowY(y),

        // ── Charm calculation helpers ────────────────────────────────────────
        charmHealing: (enchant) =>
            charmHealingFn(enchant, charmEffectTable[CharmKind.Health].effectMagnitudeMultiplier),
        charmProtection: (enchant) =>
            charmProtectionFn(enchant, charmEffectTable[CharmKind.Protection].effectMagnitudeMultiplier),
        charmEffectDuration: (kind, enchant) =>
            charmEffectDurationFn(charmEffectTable[kind], enchant),
        charmShattering: (enchant) =>
            charmShatteringFn(enchant, charmEffectTable[CharmKind.Shattering].effectMagnitudeConstant),
        charmNegationRadius: (enchant) =>
            charmNegationRadiusFn(
                enchant,
                charmEffectTable[CharmKind.Negation].effectMagnitudeConstant,
                charmEffectTable[CharmKind.Negation].effectMagnitudeMultiplier,
            ),
        charmRechargeDelay: (kind, enchant) =>
            charmRechargeDelayFn(charmEffectTable[kind], enchant),
        enchantMagnitude: () => enchantMagnitude(),

        // ── Dungeon feature indices ──────────────────────────────────────────
        DF_INCINERATION_POTION: DungeonFeatureType.DF_INCINERATION_POTION,
        DF_HOLE_POTION: DungeonFeatureType.DF_HOLE_POTION,
        DF_POISON_GAS_CLOUD_POTION: DungeonFeatureType.DF_POISON_GAS_CLOUD_POTION,
        DF_PARALYSIS_GAS_CLOUD_POTION: DungeonFeatureType.DF_PARALYSIS_GAS_CLOUD_POTION,
        DF_CONFUSION_GAS_CLOUD_POTION: DungeonFeatureType.DF_CONFUSION_GAS_CLOUD_POTION,
        DF_LICHEN_PLANTED: DungeonFeatureType.DF_LICHEN_PLANTED,
        DF_SACRED_GLYPHS: DungeonFeatureType.DF_SACRED_GLYPHS,

        // ── Light type indices ───────────────────────────────────────────────
        SCROLL_ENCHANTMENT_LIGHT: LightType.SCROLL_ENCHANTMENT_LIGHT,
        SCROLL_PROTECTION_LIGHT: LightType.SCROLL_PROTECTION_LIGHT,
        POTION_STRENGTH_LIGHT: LightType.POTION_STRENGTH_LIGHT,

        // ── Message flags ────────────────────────────────────────────────────
        REQUIRE_ACKNOWLEDGMENT: MessageFlag.REQUIRE_ACKNOWLEDGMENT,
        REFRESH_SIDEBAR: MessageFlag.REFRESH_SIDEBAR,

        // ── Misc constants ───────────────────────────────────────────────────
        KEYBOARD_LABELS,
        INVALID_POS: { ...INVALID_POS },
        BOLT_SHIELDING: BoltType.SHIELDING,

        // ── Horde flags ──────────────────────────────────────────────────────
        HORDE_LEADER_CAPTIVE: HordeFlag.HORDE_LEADER_CAPTIVE,
        HORDE_NO_PERIODIC_SPAWN: HordeFlag.HORDE_NO_PERIODIC_SPAWN,
        HORDE_IS_SUMMONED: HordeFlag.HORDE_IS_SUMMONED,
        HORDE_MACHINE_ONLY,

        // ── Magic mapping colors ─────────────────────────────────────────────
        magicMapFlashColor,
        darkBlue,
        gray,
        black,

        // ── Tile flag constants ──────────────────────────────────────────────
        MAGIC_MAPPED: TileFlag.MAGIC_MAPPED,
        IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,

        // ── Directional offsets ──────────────────────────────────────────────
        nbDirs,
    };
}

export { buildItemHelperContext } from "./items/item-helper-context.js"; // split for file-size limit
