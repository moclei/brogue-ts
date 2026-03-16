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

import { getGameState, gameOver } from "./core.js";
import {
    applyInstantTileEffectsToCreature as applyInstantFn,
} from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { promoteTile as promoteTileFn, exposeTileToFire as exposeTileToFireFn } from "./time/environment.js";
import type { EnvironmentContext } from "./time/environment.js";
import { useKeyAt as useKeyAtFn } from "./movement/item-helpers.js";
import type { ItemHelperContext } from "./movement/item-helpers.js";
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
} from "./io-wiring.js";
import { buildUpdateVisionFn } from "./vision-wiring.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import { getCellAppearance } from "./io/cell-appearance.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { layerWithFlag as layerWithFlagFn } from "./movement/map-queries.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
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
} from "./items/item-inventory.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./items/item-utils.js";
import { monstersAreEnemies as monstersAreEnemiesFn } from "./monsters/monster-queries.js";
import {
    goodMessageColor, badMessageColor, itemMessageColor,
    brown, confusionGasColor, fireForeColor, torchLightColor, minersLightColor,
    white, pink, green, yellow, orange, red, darkRed, darkGreen,
} from "./globals/colors.js";
import { randRange, randPercent, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "./math/rng.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { TileFlag, ItemFlag } from "./types/flags.js";

import { CreatureState, DungeonLayer, LightType } from "./types/enums.js";
import { createFlare as createFlareFn } from "./light/flares.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { INVALID_POS } from "./types/types.js";
import type { Creature, Pos, Color } from "./types/types.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";
import type { ItemTable } from "./types/types.js";

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
    const spawnFeature = (x: number, y: number, feat: any, v: boolean, o: boolean) =>
        spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat, v, o);

    let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
    const envCtx = {
        pmap, rogue, tileCatalog, dungeonFeatureCatalog, DCOLS, DROWS, monsters, levels,
        refreshDungeonCell, spawnDungeonFeature: spawnFeature, cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        monstersFall: () => {}, updateFloorItems: () => {}, monstersTurn: () => {}, keyOnTileAt: () => null,
        removeCreature: () => false, prependCreature: () => {},
        rand_range: randRange, rand_percent: randPercent,
        max: Math.max, min: Math.min,
        fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
        shuffleList: (list: number[], _len: number) => shuffleListFn(list),
        exposeTileToFire: (x: number, y: number, a: boolean) => exposeToFire(x, y, a),
    } as unknown as EnvironmentContext;
    exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);

    // ── ItemHelperContext for keyOnTileAt / useKeyAt ───────────────────────────
    const monsterAtLoc = (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        return monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
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
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as any, true, false);
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
        makeMonsterDropItem: () => {},
        clearLastTarget: () => {},
        clearYendorWarden: () => {},
        clearCellMonsterFlag: () => {},
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
        demoteMonsterFromLeadership: () => {},
        checkForContinuedLeadership: () => {},
        getMonsterDFMessage: () => "",
        resolvePronounEscapes: (s: string) => s,
        message: io.message,
        monsterCatalog: [],
        updateEncumbrance: () => {},
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: () => {},
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
        demoteMonsterFromLeadership: () => {},

        // Item helpers
        itemName(item: any, buf: string[], inclDetails: boolean, inclArticle: boolean): void {
            buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx);
        },
        numberOfMatchingPackItems: () => 0,
        autoIdentify: (item: any) => autoIdentifyFn(item, {
            gc: gameConst,
            messageWithColor: io.messageWithColor,
            itemMessageColor, namingCtx,
        }),
        removeItemFromChain: (item: any, chain: any[]) => removeItemFromArrayFn(item, chain),
        deleteItem: deleteItemFn,
        dropItem: () => null,
        eat: () => {},
        makeMonsterDropItem: () => {},

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
        flavorMessage: () => {},
        refreshDungeonCell,
        gameOver: (msg: string) => gameOver(msg),
        flashMessage: () => {},
        confirmMessages: io.confirmMessages,
        displayLevel: () => {},

        // Colors
        goodMessageColor, badMessageColor, itemMessageColor,
        fireForeColor, torchLightColor, minersLightColor, white, brown, green, red, orange, yellow, pink,
        confusionGasColor, darkRed, darkGreen,

        // Environment
        updateVision,
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        spawnDungeonFeature: (x: number, y: number, feat: any, v: boolean, o: boolean) =>
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat, v, o),
        promoteTile: (x: number, y: number, layer: number, useFireDF: boolean) =>
            promoteTileFn(x, y, layer as DungeonLayer, useFireDF, envCtx),
        exposeTileToFire: (x: number, y: number, alwaysIgnite: boolean) =>
            exposeTileToFireFn(x, y, alwaysIgnite, envCtx),
        startLevel: () => {},
        teleport: () => {},
        createFlare: (x: number, y: number, lightType: number) => createFlareFn(x, y, lightType as LightType, rogue, lightCatalog),
        animateFlares: () => {},
        spawnPeriodicHorde: () => {},
        monstersFall: () => {},
        updateFloorItems: () => {},
        synchronizePlayerTimeState: () => {},
        recalculateEquipmentBonuses: () => {},
        updateEncumbrance: () => {},
        playerInDarkness: () => false,
        playerTurnEnded: () => {},

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
        search: () => false,
        recordKeystroke: () => {},

        // Map queries
        layerWithFlag: (x: number, y: number, flag: number) => layerWithFlagFn(pmap, x, y, flag),
        highestPriorityLayer: () => 0,
        describeLocation: (buf: string[]) => { buf[0] = ""; },
        tileFlavor: () => "",

        // Math
        rand_range: randRange,
        rand_percent: randPercent,
        max: Math.max, min: Math.min,
        assureCosmeticRNG: () => {},
        restoreRNG: () => {},

        // Constants
        REQUIRE_ACKNOWLEDGMENT: 1,
        COLS: 100,
        HUNGER_THRESHOLD: 150, WEAK_THRESHOLD: 50, FAINT_THRESHOLD: 25,
        ALL_ITEMS: 0xFFFF,
        AMULET: 0x200, FOOD: 0x001, FRUIT: 0x002, ARMOR: 0x080, RING: 0x100,
        GENERIC_FLASH_LIGHT: 0,
        ANY_KIND_OF_VISIBLE: TileFlag.VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE,
        DISCOVERED: TileFlag.DISCOVERED,
        ITEM_DETECTED: TileFlag.ITEM_DETECTED,
        HAS_ITEM: TileFlag.HAS_ITEM,
        SEARCHED_FROM_HERE: TileFlag.SEARCHED_FROM_HERE,
        IS_IN_SHADOW: TileFlag.IS_IN_SHADOW,
        armorTable: [],
    } as unknown as CreatureEffectsContext;

    return (monst: Creature) => applyInstantFn(monst, ctx);
}
