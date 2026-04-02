/*
 *  tile-effects-wiring.ts — Wiring for applyInstantTileEffectsToCreature
 *  Port V2 — rogue-ts
 *
 *  Exports buildApplyInstantTileEffectsFn(), which wires the real
 *  applyInstantTileEffectsToCreature implementation to current game state.
 *  Used by buildTurnProcessingContext and other context builders that were
 *  previously stubbing this function with () => {}.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// Re-export environment builders extracted to keep this file under 600 lines
export { buildExposeTileToFireFn, buildExposeTileToElectricityFn } from "./tile-effects-env-wiring.js";

import { getGameState, gameOver } from "./core.js";
import {
    applyInstantTileEffectsToCreature as applyInstantFn,
    monstersFall as monstersFallFn,
} from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { promoteTile as promoteTileFn, exposeTileToFire as exposeTileToFireFn } from "./time/environment.js";
import type { EnvironmentContext } from "./time/environment.js";
import { useKeyAt as useKeyAtFn } from "./movement/item-helpers.js";
import type { ItemHelperContext } from "./movement/item-helpers.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "./movement/path-qualifying.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    flashMonster as flashMonsterFn,
} from "./combat/combat-damage.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import {
    buildRefreshDungeonCellFn,
    buildMessageFns,
    buildRefreshSideBarFn,
    buildDisplayLevelFn,
} from "./io-wiring.js";
import { buildUpdateVisionFn, buildAnimateFlaresFn } from "./vision-wiring.js";
import {
    updateMinersLightRadius as updateMinersLightRadiusFn,
    playerInDarkness as playerInDarknessFn,
} from "./light/light.js";
import { getCellAppearance } from "./io/cell-appearance.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import {
    layerWithFlag as layerWithFlagFn,
    describeLocation as describeLocationFn,
    tileFlavor as tileFlavorFn,
} from "./movement/map-queries.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    highestPriorityLayer as highestPriorityLayerFn,
    terrainFlags as terrainFlagsFn,
} from "./state/helpers.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { autoIdentify as autoIdentifyFn } from "./items/item-handlers.js";
import {
    removeItemFromArray as removeItemFromArrayFn,
    deleteItem as deleteItemFn,
    itemAtLoc as itemAtLocFn,
    numberOfMatchingPackItems as numberOfMatchingPackItemsFn,
} from "./items/item-inventory.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./items/item-utils.js";
import { monstersAreEnemies as monstersAreEnemiesFn } from "./monsters/monster-queries.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { doMakeMonsterDropItem } from "./monsters/monster-drop.js";
import { spawnPeriodicHorde as spawnPeriodicHordeFn } from "./monsters/monster-spawning.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import {
    goodMessageColor, badMessageColor, itemMessageColor,
    brown, confusionGasColor, fireForeColor, torchLightColor, minersLightColor,
    white, pink, green, yellow, orange, red, darkRed, darkGreen,
} from "./globals/colors.js";
import { flavorMessage as flavorMessageFn } from "./io/messages.js";
import { buildMessageContext } from "./ui.js";
import {
    randRange, randPercent, randClumpedRange,
    fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn,
} from "./math/rng.js";
import { DCOLS, DROWS, STOMACH_SIZE } from "./types/constants.js";
import { TileFlag, ItemFlag, DFFlag, MonsterBookkeepingFlag } from "./types/flags.js";
import { recalculateEquipmentBonuses as recalculateEquipmentBonusesFn, updateEncumbrance as updateEncumbranceFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses } from "./items/equip-helpers.js";
import { dropItem as dropItemFn } from "./items/floor-items.js";
import { buildUpdateFloorItemsFn } from "./items/floor-items-wiring.js";
import { CreatureState, DungeonLayer, FoodKind, LightType, StatusEffect, ItemCategory, ALL_ITEMS } from "./types/enums.js";
import { createFlare as createFlareFn } from "./light/flares.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { INVALID_POS } from "./types/types.js";
import type { Creature, Item, Pos, Color } from "./types/types.js";
import { foodTable, wandTable, staffTable, ringTable, charmTable, armorTable } from "./globals/item-catalog.js";
import type { ItemTable } from "./types/types.js";
import { monstersTurn as monstersTurnFn } from "./monsters/monster-actions.js";
import { buildMonstersTurnContext } from "./turn-monster-ai.js";
import { toggleMonsterDormancy } from "./monsters/monster-ops.js";

// =============================================================================
// buildApplyInstantTileEffectsFn
// =============================================================================

/**
 * Returns an `applyInstantTileEffectsToCreature(monst)` closure wired to the
 * current game state. Replaces the `() => {}` stub in context builders.
 *
 * Builds a partial CreatureEffectsContext covering all fields actually read
 * by applyInstantTileEffectsToCreature and its internal helpers
 * (exposeCreatureToFire, extinguishFireOnCreature, updatePlayerUnderwaterness,
 * monsterShouldFall, promoteTile, exposeTileToFire, useKeyAt).
 */
export function buildApplyInstantTileEffectsFn(): (monst: Creature) => void {
    const {
        player, rogue, pmap, tmap, displayBuffer, monsters, dormantMonsters, floorItems,
        packItems, levels, gameConst, mutablePotionTable, mutableScrollTable,
        monsterCatalog, scentMap,
    } = getGameState();

    const io = buildMessageFns();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const updateVision = buildUpdateVisionFn();
    const cellHasTerrainFlag = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags);
    const canSeeMonster = (m: Creature) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    const dormancyCtx = {
        monsters,
        dormantMonsters,
        pmap,
        getQualifyingPathLocNear: (target: Pos, hallwaysAllowed: boolean, btf: number, bmf: number, ftf: number, fmf: number, det: boolean) =>
            getQualifyingPathLocNearFn(target, hallwaysAllowed, btf, bmf, ftf, fmf, det, {
                pmap,
                cellHasTerrainFlag,
                cellFlags: (pos: Pos) => pmap[pos.x][pos.y].flags,
                rng: { randRange },
                getQualifyingLocNear: (t: Pos) => t,
            }),
        makeMonsterDropItem: (monst: Creature) => doMakeMonsterDropItem(monst, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCell),
    };

    // naming context for itemName / autoIdentify
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

    // ── EnvironmentContext for promoteTile / exposeTileToFire ──────────────────
    // Runtime spawnDungeonFeature: calls the base function then applies gameplay effects
    // (message display, dormant monster activation) that are not needed during generation.
    const runtimeSpawnFeature = (x: number, y: number, feat: any, v: boolean, o: boolean): void => {
        // Pass refreshDungeonCell so spread features (e.g. DF_INACTIVE_GLYPH) visually update
        // cells immediately during gameplay (C: Architect.c spawnDungeonFeature refreshCell path).
        spawnDungeonFeatureFn(
            pmap,
            tileCatalog,
            dungeonFeatureCatalog,
            x,
            y,
            feat,
            v,
            o,
            refreshDungeonCell,
            (fx, fy, appliedFeat, blockingMap) => {
                if (!(appliedFeat.flags & DFFlag.DFF_ACTIVATE_DORMANT_MONSTER)) {
                    return;
                }
                for (const monst of [...dormantMonsters]) {
                    if (
                        (monst.loc.x === fx && monst.loc.y === fy)
                        || !!blockingMap[monst.loc.x]?.[monst.loc.y]
                    ) {
                        toggleMonsterDormancy(monst, dormancyCtx);
                        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_MARKED_FOR_SACRIFICE) {
                            updateVision(true);
                        }
                        refreshDungeonCell(monst.loc);
                    }
                }
            },
        );
        // Show message if feature has description and player can see the cell (C: Architect.c:3370)
        if (feat.description && !feat.messageDisplayed && (pmap[x]?.[y]?.flags & TileFlag.VISIBLE)) {
            feat.messageDisplayed = true;
            void io.message(feat.description, 0);
        }
    };
    const spawnFeature = runtimeSpawnFeature;

    let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
    const envCtx = {
        pmap, rogue, tileCatalog, dungeonFeatureCatalog, DCOLS, DROWS, monsters, levels,
        refreshDungeonCell, spawnDungeonFeature: spawnFeature, cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        monstersFall: () => {}, // permanent-defer — tile-effects env does not run the fall pass mid-activation
        updateFloorItems: () => {},
        monstersTurn: (monst: Creature) => { void monstersTurnFn(monst, buildMonstersTurnContext()); },
        keyOnTileAt: () => null,
        removeCreature: () => false, prependCreature: () => {},
        rand_range: randRange, rand_percent: randPercent,
        max: Math.max, min: Math.min,
        fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
        shuffleList: (list: number[], _len: number) => shuffleListFn(list),
        exposeTileToFire: (x: number, y: number, a: boolean) => exposeToFire(x, y, a),
    } as unknown as EnvironmentContext;
    exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);

    // ── ItemHelperContext for keyOnTileAt / useKeyAt ───────────────────────────
    // Skip MB_HAS_DIED monsters — matches C iterateCreatures() (B112)
    const monsterAtLoc = (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        return monsters.find(
            m => m.loc.x === loc.x && m.loc.y === loc.y &&
                !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
        ) ?? null;
    };

    const keyOnTileAt = (loc: Pos) => {
        const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;
        if (player.loc.x === loc.x && player.loc.y === loc.y) {
            const k = packItems.find(it =>
                (it.flags & ItemFlag.ITEM_IS_KEY) &&
                keyMatchesLocationFn(it, loc, rogue.depthLevel, machineNum));
            if (k) return k;
        }
        if (pmap[loc.x]?.[loc.y]?.flags & TileFlag.HAS_ITEM) {
            const fi = itemAtLocFn(loc, floorItems);
            if (fi && (fi.flags & ItemFlag.ITEM_IS_KEY) &&
                keyMatchesLocationFn(fi, loc, rogue.depthLevel, machineNum)) return fi;
        }
        const monst = monsterAtLoc(loc);
        if (monst?.carriedItem && (monst.carriedItem.flags & ItemFlag.ITEM_IS_KEY) &&
            keyMatchesLocationFn(monst.carriedItem, loc, rogue.depthLevel, machineNum))
            return monst.carriedItem;
        return null;
    };

    const itemHelperCtx = {
        pmap, player, tileCatalog, packItems, floorItems,
        rogue: { playbackOmniscience: rogue.playbackOmniscience ?? false },
        cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        promoteTile: (x: number, y: number, layer: number, useFireDF: boolean) =>
            promoteTileFn(x, y, layer as DungeonLayer, useFireDF, envCtx),
        messageWithColor: io.messageWithColor,
        itemMessageColor,
        removeItemFromChain: (item: any, chain: any[]) => removeItemFromArrayFn(item, chain),
        deleteItem: deleteItemFn,
        monsterAtLoc,
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        discover: (x: number, y: number) => {
            if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED;
        },
        randPercent,
        posEq: (a: Pos, b: Pos) => a.x === b.x && a.y === b.y,
        keyOnTileAt,
        initializeItem: () => ({}) as any,
        itemName: (item: any, buf: string[], inclDetails: boolean, inclArticle: boolean) => {
            buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx);
        },
        describeHallucinatedItem: (buf: string[]) => { buf[0] = "something"; },
    } as unknown as ItemHelperContext;

    // ── Minimal CombatDamageContext for inflictDamage/killCreature/flashMonster ─
    const combatCtx = {
        player,
        easyMode: false,
        transference: rogue.transference,
        playerTransferenceRatio: 20,
        canSeeMonster,
        canDirectlySeeMonster: canSeeMonster,
        wakeUp: () => {},
        spawnDungeonFeature: (x: number, y: number, featureIndex: number, _probability: number) => {
            const feat = dungeonFeatureCatalog[featureIndex];
            if (!feat) return;
            runtimeSpawnFeature(x, y, feat, true, false);
        },
        refreshSideBar: () => {},
        combatMessage: io.combatMessage,
        messageWithColor: (text: string, color: Color) => io.messageWithColor(text, color, 0),
        monsterName: (m: Creature, includeArticle: boolean) => {
            if (m === player) return "you";
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            return `${pfx}${m.info.monsterName}`;
        },
        gameOver: (msg: string) => gameOver(msg),
        setCreaturesWillFlash: () => { (rogue as any).creaturesWillFlashThisTurn = true; },
        deleteItem: deleteItemFn,
        makeMonsterDropItem: (monst: Creature) => doMakeMonsterDropItem(monst, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCell),
        clearLastTarget: (monst: Creature) => { if (rogue.lastTarget === monst) rogue.lastTarget = null; },
        clearYendorWarden: (monst: Creature) => { if (rogue.yendorWarden === monst) rogue.yendorWarden = null; },
        clearCellMonsterFlag: (loc: Pos, isDormant: boolean) => {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags &= ~(isDormant ? TileFlag.HAS_DORMANT_MONSTER : TileFlag.HAS_MONSTER);
            }
        },
        prependCreature: () => {},
        applyInstantTileEffectsToCreature: () => {},  // no recursion in this sub-ctx
        fadeInMonster: (monst: Creature) => {
            const { backColor } = getCellAppearance(
                monst.loc, pmap, tmap, displayBuffer, rogue, player,
                monsters, dormantMonsters, floorItems,
                tileCatalog, dungeonFeatureCatalog, monsterCatalog,
                terrainRandomValues, displayDetail, scentMap ?? [],
            );
            flashMonsterFn(monst, backColor, 100, combatCtx);
        },
        refreshDungeonCell,
        anyoneWantABite: () => {},
        demoteMonsterFromLeadership: (monst: Creature) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: () => {},
        getMonsterDFMessage: () => "",
        resolvePronounEscapes: (s: string) => s,
        message: io.message,
        monsterCatalog,
        updateEncumbrance: () => { const s = buildEquipState(); updateEncumbranceFn(s); syncEquipBonuses(s); },
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: buildUpdateVisionFn(),
        badMessageColor,
        poisonColor: { red: 25, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
    } as unknown as CombatDamageContext;

    // ── Full partial CreatureEffectsContext ────────────────────────────────────
    const messageColorFromVictim = (monst: Creature): Color =>
        (monst === player || monst.creatureState === CreatureState.Ally)
            ? badMessageColor
            : goodMessageColor;

    const ctx = {
        player,
        rogue: rogue as unknown as CreatureEffectsContext["rogue"],
        pmap, monsters, floorItems, packItems, levels, gameConst,
        tileCatalog, dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as CreatureEffectsContext["dungeonFeatureCatalog"],
        DCOLS, DROWS, INVALID_POS,

        // Map helpers
        cellHasTerrainFlag, cellHasTMFlag,
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),

        // Monster helpers
        canSeeMonster,
        canDirectlySeeMonster: canSeeMonster,
        monsterName(buf: string[], m: Creature, includeArticle: boolean): void {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        },
        monsterAtLoc,
        monstersAreEnemies: (a: Creature, b: Creature) =>
            monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        monsterIsInClass: () => false,
        removeCreature(list: Creature[], monst: Creature) {
            const idx = list.indexOf(monst);
            if (idx >= 0) { list.splice(idx, 1); return true; }
            return false;
        },
        prependCreature(list: Creature[], monst: Creature) { list.unshift(monst); },
        demoteMonsterFromLeadership: (monst: Creature) => demoteMonsterFromLeadershipFn(monst, monsters),

        // Item helpers
        itemName(item: any, buf: string[], inclDetails: boolean, inclArticle: boolean): void {
            buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx);
        },
        numberOfMatchingPackItems: (cat: number, kind: number, flags: number, _checkCarried: boolean) =>
            numberOfMatchingPackItemsFn(packItems, cat, kind, flags),
        autoIdentify: (item: any) => autoIdentifyFn(item, {
            gc: gameConst,
            messageWithColor: io.messageWithColor,
            itemMessageColor, namingCtx,
        }),
        removeItemFromChain: (item: any, chain: any[]) => removeItemFromArrayFn(item, chain),
        deleteItem: deleteItemFn,
        dropItem: (theItem: Item) => dropItemFn(theItem, {
            pmap, floorItems,
            tileCatalog: tileCatalog as never,
            dungeonFeatureCatalog: dungeonFeatureCatalog as never,
            packItems, player,
            rogue: { swappedIn: rogue.swappedIn, swappedOut: rogue.swappedOut },
            itemMagicPolarity: () => 0,
            cellHasTerrainFlag,
            cellHasTMFlag,
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            itemName: (i: Item, buf: string[]) => { buf[0] = itemNameFn(i, false, true, namingCtx); },
            message: io.message,
            spawnDungeonFeature: () => {}, promoteTile: () => {}, discover: () => {},
            refreshDungeonCell,
            REQUIRE_ACKNOWLEDGMENT: 1,
            itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
            pickUpItemAt: () => {},
        }),
        eat: (theItem: Item, _recordCommands: boolean) => {
            // C: Items.c:6700 — update nutrition, then consume item from pack
            const foodPower = (foodTable as unknown as ItemTable[])[theItem.kind]?.power ?? 0;
            player.status[StatusEffect.Nutrition] = Math.min(
                foodPower + player.status[StatusEffect.Nutrition],
                STOMACH_SIZE,
            );
            buildRefreshSideBarFn()();
            const msg = theItem.kind === FoodKind.Ration
                ? "That food tasted delicious!"
                : "My, what a yummy mango!";
            void io.messageWithColor(msg, itemMessageColor, 0);
            if (theItem.quantity > 1) {
                theItem.quantity--;
            } else {
                removeItemFromArrayFn(theItem, packItems);
                deleteItemFn(theItem);
            }
        },
        makeMonsterDropItem: (monst: Creature) => doMakeMonsterDropItem(monst, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCell),

        // Combat helpers
        inflictDamage: (attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean) =>
            inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
        killCreature: (monst: Creature, adminDeath: boolean) => killCreatureFn(monst, adminDeath, combatCtx),
        combatMessage: io.combatMessage,
        messageColorFromVictim,
        addPoison: (monst: Creature, total: number, conc: number) => addPoisonFn(monst, total, conc, combatCtx),
        flashMonster: (monst: Creature, color: Color, strength: number) =>
            flashMonsterFn(monst, color, strength, combatCtx),

        // UI
        message: io.message,
        messageWithColor: io.messageWithColor,
        flavorMessage: (msg: string) => {
            const msgCtx = buildMessageContext();
            flavorMessageFn(msgCtx, msg);
        },
        refreshDungeonCell,
        gameOver: (msg: string) => gameOver(msg),
        flashMessage: () => {},  // cosmetic animation — safe no-op in this ctx
        confirmMessages: io.confirmMessages,
        displayLevel: buildDisplayLevelFn(),

        // Colors
        goodMessageColor, badMessageColor, itemMessageColor,
        fireForeColor, torchLightColor, minersLightColor, white, brown, green, red, orange, yellow, pink,
        confusionGasColor, darkRed, darkGreen,

        // Environment
        updateVision,
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        spawnDungeonFeature: runtimeSpawnFeature,
        promoteTile: (x: number, y: number, layer: number, useFireDF: boolean) =>
            promoteTileFn(x, y, layer as DungeonLayer, useFireDF, envCtx),
        exposeTileToFire: (x: number, y: number, alwaysIgnite: boolean) =>
            exposeTileToFireFn(x, y, alwaysIgnite, envCtx),
        startLevel: () => {},  // level transition — circular dependency with lifecycle.ts; wire in playerFalls ctx instead
        teleport: () => {},  // complex FOV context — separate backlog item
        createFlare: (x: number, y: number, lightType: number) => createFlareFn(x, y, lightType as LightType, rogue, lightCatalog),
        animateFlares: buildAnimateFlaresFn(),
        spawnPeriodicHorde: () => spawnPeriodicHordeFn(buildMonsterSpawningContext(), () => null),
        monstersFall: () => monstersFallFn(ctx as unknown as CreatureEffectsContext),
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
            activateMachine: () => {},                        // permanent-defer — updateFloorItems tile-expiry path does not trigger machine activation
            circuitBreakersPreventActivation: () => false,   // permanent-defer — updateFloorItems tile-expiry path does not check circuit breakers
        }),
        synchronizePlayerTimeState: () => { rogue.ticksTillUpdateEnvironment = player.ticksUntilTurn; },
        recalculateEquipmentBonuses: () => {
            const eqState = buildEquipState();
            recalculateEquipmentBonusesFn(eqState);
            syncEquipBonuses(eqState);
        },
        updateEncumbrance: () => { const s = buildEquipState(); updateEncumbranceFn(s); syncEquipBonuses(s); },
        playerInDarkness: () => playerInDarknessFn(tmap, player.loc),
        playerTurnEnded: () => {},  // re-entry guard — playerFalls in tile-effects ctx does not re-enter turn loop

        // Movement/search
        keyOnTileAt,
        useKeyAt: (item: any, x: number, y: number) => useKeyAtFn(item, x, y, itemHelperCtx),
        discover: (x: number, y: number) => {
            if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED;
        },
        discoverCell: (x: number, y: number) => {
            if (coordinatesAreInMap(x, y)) {
                pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            }
        },
        search: () => false,    // record-command path — safe no-op in tile-effects ctx
        recordKeystroke: () => {},

        // Map queries
        layerWithFlag: (x: number, y: number, flag: number) => layerWithFlagFn(pmap, x, y, flag),
        highestPriorityLayer: (x: number, y: number, skipGas: boolean) => highestPriorityLayerFn(pmap, x, y, skipGas),
        describeLocation: (buf: string[], x: number, y: number) => {
            buf[0] = describeLocationFn(x, y, {
                pmap, player,
                itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
            } as unknown as Parameters<typeof describeLocationFn>[2]);
        },
        tileFlavor: (x: number, y: number) => tileFlavorFn(pmap, x, y, highestPriorityLayerFn),

        // Math
        rand_range: randRange,
        rand_percent: randPercent,
        randClumpedRange,
        max: Math.max, min: Math.min,
        assureCosmeticRNG: () => {},    // cosmetic RNG swap — safe no-op in this ctx
        restoreRNG: () => {},

        // Additional fields required by playerFalls / updateFlavorText
        pmapAt: (loc: Pos) => pmap[loc.x][loc.y],
        terrainFlags: (pos: Pos) => terrainFlagsFn(pmap, pos),
        mapToWindowX: (x: number) => x,
        mapToWindowY: (y: number) => y,
        strLenWithoutEscapes: (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length,

        // Constants
        REQUIRE_ACKNOWLEDGMENT: 1,
        COLS: 100,
        HUNGER_THRESHOLD: 150, WEAK_THRESHOLD: 50, FAINT_THRESHOLD: 25,
        ALL_ITEMS,
        AMULET: ItemCategory.AMULET, FOOD: ItemCategory.FOOD, FRUIT: FoodKind.Fruit,
        ARMOR: ItemCategory.ARMOR, RING: ItemCategory.RING,
        GENERIC_FLASH_LIGHT: LightType.GENERIC_FLASH_LIGHT,
        ANY_KIND_OF_VISIBLE: TileFlag.VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE,
        DISCOVERED: TileFlag.DISCOVERED,
        ITEM_DETECTED: TileFlag.ITEM_DETECTED,
        HAS_ITEM: TileFlag.HAS_ITEM,
        SEARCHED_FROM_HERE: TileFlag.SEARCHED_FROM_HERE,
        IS_IN_SHADOW: TileFlag.IS_IN_SHADOW,
        armorTable: armorTable as unknown as CreatureEffectsContext["armorTable"],
    } as unknown as CreatureEffectsContext;

    return (monst: Creature) => applyInstantFn(monst, ctx);
}

