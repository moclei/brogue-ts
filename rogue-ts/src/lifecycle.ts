/*
 *  lifecycle.ts — Game lifecycle context builders
 *  Port V2 — rogue-ts
 *
 *  Provides module-level lifecycle state and builds the DI contexts required
 *  by the game domain functions:
 *    buildGameInitContext()  → GameInitContext  (game-init.ts)
 *    buildLevelContext()     → LevelContext     (game-level.ts)
 *    buildCleanupContext()   → CleanupContext   (game-cleanup.ts)
 *
 *  Public API:
 *    initializeRogue(seed)   — reset game state and initialize a new game
 *    startLevel(old, dir)    — save current level and transition to next
 *    freeEverything()        — release all level resources after game ends
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, setMonsters, setDormantMonsters, setLevels } from "./core.js";
import { initializeRogue as initializeRogueFn } from "./game/game-init.js";
import { startLevel as startLevelFn } from "./game/game-level.js";
import { freeEverything as freeEverythingFn } from "./game/game-cleanup.js";
import { dynamicColorsBounds, nbDirs, coordinatesAreInMap, posNeighborInDirection,
    mapToWindowX, mapToWindowY } from "./globals/tables.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { LightType, DungeonLayer, MonsterType, EventType, DisplayGlyph } from "./types/enums.js";
import { meteredItemsGenerationTable, lumenstoneDistribution,
    scrollTable, potionTable } from "./globals/item-catalog.js";
import { autoGeneratorCatalog } from "./globals/autogenerator-catalog.js";
import { blueprintCatalog } from "./globals/blueprint-catalog.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { dungeonProfileCatalog } from "./globals/dungeon-profile-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { itemMessageColor, white, backgroundMessageColor, goodMessageColor,
    black, gray, yellow, lightBlue, badMessageColor, advancementMessageColor,
    superVictoryColor } from "./globals/colors.js";
import { KEYBOARD_LABELS, DCOLS, DROWS, MESSAGE_ARCHIVE_ENTRIES, MONSTER_CLASS_COUNT } from "./types/constants.js";
import { TileFlag } from "./types/flags.js";
import { seedRandomGenerator, randRange, rand64bits, randPercent, randClump, clamp } from "./math/rng.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { allocGrid, fillGrid, freeGrid } from "./grid/grid.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { zeroOutGrid } from "./architect/helpers.js";
import { distanceBetween } from "./monsters/monster-state.js";
import { calculateDistances, pathingDistance as pathingDistanceFn } from "./dijkstra/dijkstra.js";
import type { CalculateDistancesContext } from "./dijkstra/dijkstra.js";
import { applyColorAverage } from "./io/color.js";
import { buildTurnProcessingContext } from "./turn.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import { digDungeon, placeStairs, initializeLevel, setUpWaypoints,
    updateMapToShore, getQualifyingLocNear as getQualifyingLocNearFn,
    resetDFMessageEligibility } from "./architect/architect.js";
import { analyzeMap } from "./architect/analysis.js";
import { getFOVMask } from "./light/fov.js";
import { populateGenericCostMap } from "./movement/cost-maps-fov.js";
import { populateItems } from "./items/item-population.js";
import { populateMonsters } from "./monsters/monster-spawning.js";
import { generateItem } from "./items/item-generation.js";
import { addItemToPack, numberOfMatchingPackItems, itemAtLoc as itemAtLocFn, deleteItem as deleteItemFn } from "./items/item-inventory.js";
import { identify, shuffleFlavors } from "./items/item-naming.js";
import { equipItem, recalculateEquipmentBonuses, updateRingBonuses as updateRingBonusesFn, updateEncumbrance as updateEncumbranceFn } from "./items/item-usage.js";
import type { EquipContext } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses } from "./items/equip-helpers.js";
import type { MachineItem } from "./architect/machines.js";
import { initializeGender, initializeStatus, generateMonster } from "./monsters/monster-creation.js";
import { createMonsterOps, toggleMonsterDormancy } from "./monsters/monster-ops.js";
import { blackOutScreen, clearDisplayBuffer, plotCharToBuffer } from "./io/display.js";
import {
    getCellAppearance,
    refreshDungeonCell as refreshDungeonCellFn,
    displayLevel as displayLevelFn,
} from "./io/cell-appearance.js";
import { clearMessageArchive } from "./io/messages.js";
import { deleteAllFlares } from "./light/flares.js";
import { cellHasTerrainFlag as ctf, cellHasTMFlag as ctmf, terrainFlags as tf } from "./state/helpers.js";
import { passableArcCount, cellIsPassableOrDoor, randomMatchingLocation } from "./architect/helpers.js";
import { synchronizePlayerTimeState } from "./time/turn-processing.js";
import type { Creature, Color, Item, LevelData } from "./types/types.js";
import type { GameInitContext } from "./game/game-init.js";
import type { LevelContext } from "./game/game-level.js";
import type { CleanupContext } from "./game/game-cleanup.js";
import type { LifecycleContext } from "./game/game-lifecycle.js";
import { buildRefreshSideBarFn, buildMessageFns } from "./io-wiring.js";

// =============================================================================
// Module-level lifecycle state (not in core.ts)
// =============================================================================

let dynamicColors: Color[] = dynamicColorsBounds.map(([start]) => ({ ...start }));

let safetyMap: number[][] | null = allocGrid();
let allySafetyMap: number[][] | null = allocGrid();
let chokeMap: number[][] | null = allocGrid();
let scentMap: number[][] | null = null;
/** Expose the current scent map for rendering helpers. */
export function getScentMap(): number[][] | null { return scentMap; }
let purgatory: Creature[] = [];
let previousGameSeed: bigint = 0n;

const messageArchive: { message: string }[] = Array.from(
    { length: MESSAGE_ARCHIVE_ENTRIES }, () => ({ message: "" }),
);
let messageArchivePosition = 0;

// =============================================================================
// Private helpers
// =============================================================================

function chooseVorpalEnemy(): number {
    const classIdx = randRange(0, MONSTER_CLASS_COUNT - 1);
    const cls = monsterClassCatalog[classIdx];
    if (cls.memberList.length === 0) return MonsterType.MK_RAT;
    return cls.memberList[randRange(0, cls.memberList.length - 1)];
}

function makeFovCtx() {
    const { pmap } = getGameState();
    return {
        cellHasTerrainFlag: (pos: { x: number; y: number }, flags: number) => ctf(pmap, pos, flags),
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    };
}

function makeCostMapCtx() {
    const { pmap } = getGameState();
    // populateGenericCostMap only uses cellHasTerrainFlag, cellHasTMFlag, discoveredTerrainFlagsAtLoc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {
        cellHasTerrainFlag: (pos: { x: number; y: number }, flags: number) => ctf(pmap, pos, flags),
        cellHasTMFlag: (pos: { x: number; y: number }, flags: number) => ctmf(pmap, pos, flags),
        discoveredTerrainFlagsAtLoc: (_pos: { x: number; y: number }) => 0,
    } as unknown as import("./movement/cost-maps-fov.js").CostMapFovContext;
}

function makeCalcDistCtx(): CalculateDistancesContext {
    const { player, pmap, monsters } = getGameState();
    return {
        cellHasTerrainFlag: (pos, flags) => ctf(pmap, pos, flags),
        cellHasTMFlag: (pos, flags) => ctmf(pmap, pos, flags),
        monsterAtLoc(pos) {
            if (pos.x === player.loc.x && pos.y === player.loc.y) return player;
            return monsters.find(m => m.loc.x === pos.x && m.loc.y === pos.y) ?? null;
        },
        monsterAvoids: () => false,
        discoveredTerrainFlagsAtLoc: () => 0,
        isPlayer: (m: Creature) => m === player,
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    };
}


// =============================================================================
// buildGameInitContext
// =============================================================================

export function buildGameInitContext(): GameInitContext {
    const {
        rogue, player, gameConst, gameVariant, monsterCatalog,
        mutableScrollTable, mutablePotionTable, messageState, displayBuffer,
        monsters, dormantMonsters, floorItems, packItems, monsterItemsHopper,
    } = getGameState();
    const { message, messageWithColor } = buildMessageFns();

    return {
        rogue, player, gameConst, gameVariant, monsterCatalog,
        meteredItemsGenerationTable, featTable: [],
        lightCatalog, MINERS_LIGHT: LightType.MINERS_LIGHT,
        dynamicColorsBounds, dynamicColors,
        displayDetail, terrainRandomValues,
        messageArchive, messageArchivePosition,
        setMessageArchivePosition(n) { messageArchivePosition = n; },
        previousGameSeed,
        setPreviousGameSeed(seed) { previousGameSeed = seed; },
        levels: [] as unknown as LevelData[],
        setLevels,
        monsters, dormantMonsters, setMonsters, setDormantMonsters,
        floorItems, packItems, monsterItemsHopper, purgatory,
        safetyMap: safetyMap!,
        allySafetyMap: allySafetyMap!,
        chokeMap: chokeMap!,
        scentMap,
        setScentMap(map) { scentMap = map; },
        seedRandomGenerator, rand_range: randRange, rand_64bits: rand64bits,
        allocGrid, fillGrid, zeroOutGrid, freeGrid, distanceBetween,
        generateItem(category, kind) {
            return generateItem(category, kind, {
                rng: { randRange, randPercent, randClump },
                gameConstants: gameConst, depthLevel: rogue.depthLevel,
                scrollTable: mutableScrollTable, potionTable: mutablePotionTable,
                depthAccelerator: gameConst.depthAccelerator, chooseVorpalEnemy,
            });
        },
        addItemToPack(item) { return addItemToPack(item, packItems); },
        identify(item) { identify(item, gameConst); },
        equipItem(item, willUnequip, swapItem) {
            const state = buildEquipState();
            const equipCtx: EquipContext = {
                state,
                message: (text, _ack) => message(text, 0),
                updateRingBonuses: () => { updateRingBonusesFn(state); syncEquipBonuses(state); },
                updateEncumbrance: () => updateEncumbranceFn(state),
                itemName: (i) => i.displayChar ? String.fromCharCode(i.displayChar) : "?",
            };
            equipItem(item, willUnequip, swapItem, equipCtx);
            syncEquipBonuses(state);
        },
        recalculateEquipmentBonuses() {
            const state = buildEquipState();
            recalculateEquipmentBonuses(state);
            syncEquipBonuses(state);
        },
        initializeGender(monst) { initializeGender(monst, { randRange, randPercent }); },
        initializeStatus(monst) { initializeStatus(monst, monst === player); },
        initRecording: () => {},
        shuffleFlavors() { shuffleFlavors(gameConst, randRange, randPercent); },
        resetDFMessageEligibility() { resetDFMessageEligibility(dungeonFeatureCatalog); },
        deleteMessages() {
            for (let i = 0; i < messageState.displayedMessage.length; i++) {
                messageState.displayedMessage[i] = "";
            }
            messageState.messagesUnconfirmed = 0;
        },
        clearMessageArchive() { clearMessageArchive(messageState); },
        blackOutScreen(dbuf) { blackOutScreen(dbuf); },
        displayBuffer,
        message, messageWithColor, flavorMessage: () => {},
        encodeMessageColor: () => {},
        itemMessageColor, white, backgroundMessageColor,
        initializeGameVariantBrogue() {
            gameConst.numberScrollKinds = mutableScrollTable.length;
            gameConst.numberPotionKinds = mutablePotionTable.length;
            gameConst.numberMeteredItems = meteredItemsGenerationTable.length;
            gameConst.numberAutogenerators = autoGeneratorCatalog.length;
            gameConst.numberBlueprints = blueprintCatalog.length;
            gameConst.numberHordes = hordeCatalog.length;
            gameConst.numberBoltKinds = boltCatalog.length;
        },
        initializeGameVariantRapidBrogue() {
            gameConst.deepestLevel = 10; gameConst.amuletLevel = 7; gameConst.depthAccelerator = 4;
            gameConst.numberScrollKinds = mutableScrollTable.length;
            gameConst.numberPotionKinds = mutablePotionTable.length;
            gameConst.numberMeteredItems = meteredItemsGenerationTable.length;
            gameConst.numberAutogenerators = autoGeneratorCatalog.length;
            gameConst.numberBlueprints = blueprintCatalog.length;
            gameConst.numberHordes = hordeCatalog.length;
            gameConst.numberBoltKinds = boltCatalog.length;
        },
        initializeGameVariantBulletBrogue() {
            gameConst.deepestLevel = 5; gameConst.amuletLevel = 4; gameConst.depthAccelerator = 8;
            gameConst.numberScrollKinds = mutableScrollTable.length;
            gameConst.numberPotionKinds = mutablePotionTable.length;
            gameConst.numberMeteredItems = meteredItemsGenerationTable.length;
            gameConst.numberAutogenerators = autoGeneratorCatalog.length;
            gameConst.numberBlueprints = blueprintCatalog.length;
            gameConst.numberHordes = hordeCatalog.length;
            gameConst.numberBoltKinds = boltCatalog.length;
        },
        KEYBOARD_LABELS,
    };
}

// =============================================================================
// buildLevelContext
// =============================================================================

export function buildLevelContext(): LevelContext {
    const {
        rogue, player, gameConst, pmap, tmap,
        monsters, dormantMonsters, floorItems, packItems,
        mutableScrollTable, mutablePotionTable, monsterItemsHopper,
        monsterCatalog, displayBuffer,
    } = getGameState();

    const fovCtx = makeFovCtx();
    const costCtx = makeCostMapCtx();

    const getFOVMaskWrap = (
        grid: number[][], x: number, y: number, r: bigint,
        ft: number, ff: number, c: boolean,
    ) => getFOVMask(grid, x, y, r, ft, ff, c, fovCtx);

    const analyzeMapWrap = (calcChoke: boolean) => analyzeMap(pmap, chokeMap, calcChoke);

    const calcDistWrap = (
        grid: number[][], x: number, y: number, blockFlags: number,
        blocker: Creature | null, canUseSecretDoors: boolean, eightWays: boolean,
    ) => calculateDistances(grid, x, y, blockFlags, blocker, canUseSecretDoors, eightWays, makeCalcDistCtx());

    const pathDistWrap = (x1: number, y1: number, x2: number, y2: number, blockFlags: number) =>
        pathingDistanceFn(x1, y1, x2, y2, blockFlags, makeCalcDistCtx());

    const costMapWrap = (costMap: number[][]) => populateGenericCostMap(costMap, costCtx);

    // ---- Architect context ---------------------------------------------------
    const monsterOps = createMonsterOps({
        monsters,
        spawnHorde: () => null,
        monsterAtLoc(pos) {
            if (pos.x === player.loc.x && pos.y === player.loc.y) return player;
            return monsters.find(m => m.loc.x === pos.x && m.loc.y === pos.y) ?? null;
        },
        killCreature: () => {},
        generateMonster(monsterID, _atDepth, _summon) {
            return generateMonster(monsterID, true, true, {
                rng: { randRange, randPercent },
                gameConstants: gameConst, depthLevel: rogue.depthLevel,
                monsterCatalog, mutationCatalog, monsterItemsHopper, itemsEnabled: true,
            });
        },
        toggleMonsterDormancy,
    });

    const archCtx = {
        pmap, depthLevel: rogue.depthLevel, gameConstants: gameConst,
        dungeonProfileCatalog, dungeonFeatureCatalog, blueprintCatalog, autoGeneratorCatalog, tileCatalog,
        machineNumber: rogue.rewardRoomsGenerated,
        rewardRoomsGenerated: rogue.rewardRoomsGenerated,
        staleLoopMap: rogue.staleLoopMap,
        machineContext: {
            pmap, chokeMap: chokeMap!, tileCatalog,
            blueprintCatalog, dungeonFeatureCatalog, dungeonProfileCatalog, autoGeneratorCatalog,
            depthLevel: rogue.depthLevel,
            machineNumber: rogue.rewardRoomsGenerated,
            rewardRoomsGenerated: rogue.rewardRoomsGenerated,
            staleLoopMap: rogue.staleLoopMap,
            gameConstants: gameConst, monsterOps,
            itemOps: {
                generateItem: () => ({ category: 0, kind: 0, quantity: 1, flags: 0, keyLoc: [], originDepth: 0 } as unknown as Item),
                deleteItem: () => {}, placeItemAt: () => {}, removeItemFromArray: () => {},
                itemIsHeavyWeapon: () => false, itemIsPositivelyEnchanted: () => false,
            },
            analyzeMap: analyzeMapWrap,
            calculateDistances: calcDistWrap,
            getFOVMask: getFOVMaskWrap,
            populateGenericCostMap: costMapWrap,
            floorItems: floorItems as unknown as MachineItem[],
            packItems: packItems as unknown as MachineItem[],
        },
        bridgeContext: {
            depthLevel: rogue.depthLevel, depthAccelerator: gameConst.depthAccelerator,
            pathingDistance: pathDistWrap,
        },
        analyzeMap: analyzeMapWrap,
        getFOVMask: getFOVMaskWrap,
        populateGenericCostMap: costMapWrap,
        calculateDistances: calcDistWrap,
        floorItems: floorItems as unknown as MachineItem[],
        packItems: packItems as unknown as MachineItem[],
    };

    return {
        rogue, player, gameConst, FP_FACTOR,
        levels: getGameState().levels, pmap,
        monsters, dormantMonsters, floorItems, setMonsters, setDormantMonsters,
        scentMap, setScentMap(map) { scentMap = map; },
        dynamicColors, dynamicColorsBounds,
        levelFeelings: [
            { message: "You sense a very powerful presence on this level.", color: goodMessageColor },
            { message: "You sense an ancient and very powerful magic here.", color: goodMessageColor },
        ],
        allocGrid, fillGrid, freeGrid, applyColorAverage,
        seedRandomGenerator, rand_64bits: rand64bits,
        synchronizePlayerTimeState() { synchronizePlayerTimeState(buildTurnProcessingContext()); },
        cellHasTerrainFlag: (loc, flag) => ctf(pmap, loc, flag),
        coordinatesAreInMap,
        pmapAt: (loc) => pmap[loc.x][loc.y],
        posNeighborInDirection,
        calculateDistances: calcDistWrap,
        pathingDistance: pathDistWrap,
        currentStealthRange: () => 14, // stub — stealth system not yet wired
        getQualifyingLocNear(target, _hw, _forbidCell, forbidTerrain, forbidMap, _det, _flood) {
            return getQualifyingLocNearFn(pmap, target, forbidTerrain, forbidMap) ?? { ...target };
        },
        getQualifyingPathLocNear: (target) => ({ ...target }),
        digDungeon() {
            digDungeon(archCtx);
            rogue.rewardRoomsGenerated = archCtx.rewardRoomsGenerated;
            rogue.staleLoopMap = archCtx.staleLoopMap;
        },
        placeStairs() {
            const r = placeStairs(pmap, getGameState().levels, rogue.depthLevel, gameConst.deepestLevel);
            if (r) {
                rogue.upLoc = { ...r.upStairsLoc };
                rogue.downLoc = { ...r.downStairsLoc };
                const lvl = getGameState().levels[rogue.depthLevel - 1];
                lvl.upStairsLoc = { ...r.upStairsLoc };
                lvl.downStairsLoc = { ...r.downStairsLoc };
                return { success: true, upStairsLoc: r.upStairsLoc };
            }
            return { success: false, upStairsLoc: { x: 0, y: 0 } };
        },
        initializeLevel(upStairsLoc) {
            const itemState = {
                depthLevel: rogue.depthLevel, depthAccelerator: gameConst.depthAccelerator,
                goldGenerated: rogue.goldGenerated, foodSpawned: rogue.foodSpawned,
                meteredItems: rogue.meteredItems,
            };
            initializeLevel(pmap, upStairsLoc, rogue.depthLevel, getGameState().levels,
                getFOVMaskWrap,
                (upLoc) => {
                    populateItems(upLoc, {
                        state: itemState, gameConstants: gameConst,
                        rng: { randRange, randPercent, randClump },
                        scrollTable, potionTable, meteredItemsGenerationTable, lumenstoneDistribution,
                        cellHasTerrainFlag: (pos, flags) => ctf(pmap, pos, flags),
                        getCellFlags: (x, y) => pmap[x][y].flags,
                        getDungeonLayer: (x, y) => pmap[x][y].layers[DungeonLayer.Dungeon],
                        setDungeonLayer: (x, y, v) => { pmap[x][y].layers[DungeonLayer.Dungeon] = v; },
                        isPassableOrSecretDoor: (pos) => cellIsPassableOrDoor(pmap, pos.x, pos.y),
                        passableArcCount: (x, y) => passableArcCount(pmap, x, y),
                        randomMatchingLocation: (dt, lt, tt) => randomMatchingLocation(pmap, tileCatalog, dt, lt, tt),
                        placeItemAt(item, loc) {
                            item.loc = { ...loc };
                            floorItems.push(item);
                            pmap[loc.x][loc.y].flags |= TileFlag.HAS_ITEM;
                        },
                        chooseVorpalEnemy,
                    });
                    rogue.goldGenerated = itemState.goldGenerated;
                    rogue.foodSpawned = itemState.foodSpawned;
                },
                () => { populateMonsters(buildMonsterSpawningContext()); },
            );
        },
        setUpWaypoints() {
            const r = setUpWaypoints(pmap, costMapWrap, getFOVMaskWrap);
            rogue.wpDistance = r.wpDistance;
        },
        shuffleTerrainColors: () => {},
        numberOfMatchingPackItems: (cat, flags, flags2, _useFlags) =>
            numberOfMatchingPackItems(packItems, cat, flags, flags2),
        itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
        describedItemName: (item) => item.displayChar ? String.fromCharCode(item.displayChar) : "?",
        generateItem(category, kind) {
            return generateItem(category, kind, {
                rng: { randRange, randPercent, randClump }, gameConstants: gameConst,
                depthLevel: rogue.depthLevel, scrollTable: mutableScrollTable,
                potionTable: mutablePotionTable, depthAccelerator: gameConst.depthAccelerator,
                chooseVorpalEnemy,
            });
        },
        placeItemAt(item, loc) {
            item.loc = { ...loc };
            const idx = floorItems.indexOf(item);
            if (idx >= 0) floorItems.splice(idx, 1);
            floorItems.unshift(item);
            pmap[loc.x][loc.y].flags |= TileFlag.HAS_ITEM;
        },
        restoreMonster: () => {},
        restoreItems: () => {},
        updateMonsterState: () => {},
        storeMemories(x, y) {
            const cell = pmap[x][y];
            cell.rememberedTerrainFlags = tf(pmap, { x, y });
            cell.rememberedCellFlags = cell.flags;
        },
        updateVision: () => {},
        discoverCell: (x, y) => { pmap[x][y].flags |= TileFlag.DISCOVERED; },
        updateMapToShore() { rogue.mapToShore = updateMapToShore(pmap); },
        updateRingBonuses: () => { const s = buildEquipState(); updateRingBonusesFn(s); syncEquipBonuses(s); },
        displayLevel() {
            const getCellApp = (loc: { x: number; y: number }) => getCellAppearance(
                loc, pmap, tmap, displayBuffer, rogue, player,
                monsters, dormantMonsters, floorItems,
                tileCatalog, dungeonFeatureCatalog, monsterCatalog,
                terrainRandomValues, displayDetail, scentMap ?? [],
            );
            displayLevelFn(DCOLS, DROWS, (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer));
        },
        refreshSideBar: () => {},
        messageWithColor: () => {},
        RNGCheck: () => {},
        flushBufferToFile: () => {},
        deleteAllFlares() { deleteAllFlares(rogue); },
        hideCursor: () => {},
        itemMessageColor, nbDirs, clamp,
    };
}

// =============================================================================
// buildCleanupContext
// =============================================================================

export function buildCleanupContext(): CleanupContext {
    const { rogue, player, gameConst, levels,
        monsters, dormantMonsters, floorItems, packItems, monsterItemsHopper } = getGameState();
    return {
        rogue, player, gameConst, levels, setLevels,
        monsters, dormantMonsters, floorItems, packItems, monsterItemsHopper,
        purgatory, safetyMap, allySafetyMap, chokeMap, scentMap,
        setSafetyMap(map) { safetyMap = map; },
        setAllySafetyMap(map) { allySafetyMap = map; },
        setChokeMap(map) { chokeMap = map; },
        setScentMap(map) { scentMap = map; },
        freeGrid,
        deleteItem: deleteItemFn,
        deleteAllFlares() { deleteAllFlares(rogue); },
    };
}

// =============================================================================
// buildLifecycleContext
// =============================================================================

export function buildLifecycleContext(): LifecycleContext {
    const { rogue, player, gameConst, pmap, tmap, monsters, dormantMonsters,
        floorItems, packItems, displayBuffer, monsterCatalog, messageState } = getGameState();
    const { message, messageWithColor, confirmMessages } = buildMessageFns();
    const refreshSideBar = buildRefreshSideBarFn();
    const getCellApp = (loc: { x: number; y: number }) => getCellAppearance(
        loc, pmap, tmap, displayBuffer, rogue, player, monsters, dormantMonsters, floorItems,
        tileCatalog, dungeonFeatureCatalog, monsterCatalog, terrainRandomValues, displayDetail, scentMap ?? []);
    return {
        rogue, player, gameConst, packItems, featTable: [],
        serverMode: false, nonInteractivePlayback: false,
        displayBuffer,
        clearDisplayBuffer: (d) => clearDisplayBuffer(d),
        blackOutScreen: (d) => blackOutScreen(d),
        displayLevel() {
            displayLevelFn(DCOLS, DROWS, (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer));
        },
        refreshSideBar,
        printString: () => {},
        plotCharToBuffer: (ch, pos, fg, bg, dbuf) => plotCharToBuffer(ch, pos.windowX, pos.windowY, fg, bg, dbuf),
        funkyFade: () => {}, strLenWithoutEscapes: () => 0,
        mapToWindowX, mapToWindowY,
        message, messageWithColor, confirmMessages,
        deleteMessages: () => {}, displayMoreSign: () => {},
        displayMoreSignWithoutWaitingForAcknowledgment: () => {},
        flashTemporaryAlert: () => {}, confirm: () => false,
        nextBrogueEvent(ev) { ev.eventType = EventType.MouseUp; }, // stub: exits sync event loops
        identify: (item) => identify(item, gameConst),
        itemName: () => "", upperCase: (s) => s.toUpperCase(), itemValue: () => 0,
        numberOfMatchingPackItems: (cat, fl, fl2, _uf) => numberOfMatchingPackItems(packItems, cat, fl, fl2),
        isVowelish: () => false, displayInventory: () => 0,
        flushBufferToFile: () => {}, saveHighScore: () => false, printHighScores: () => {},
        saveRecording: (_f) => {},              // stub — persistence layer not implemented
        saveRecordingNoPrompt: (_f) => {},      // stub — persistence layer not implemented
        notifyEvent: () => {}, saveRunHistory: () => {}, recordKeystroke: () => {},
        refreshDungeonCell: (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer),
        encodeMessageColor: () => {},
        black, white, gray, yellow, lightBlue, badMessageColor,
        itemMessageColor, advancementMessageColor, superVictoryColor,
        displayedMessage: messageState.displayedMessage,
        G_GOLD: DisplayGlyph.G_GOLD, G_AMULET: DisplayGlyph.G_AMULET,
    };
}

// =============================================================================
// Public entry points
// =============================================================================

/** Returns the seed of the most recently completed game. */
export function getPreviousGameSeed(): bigint { return previousGameSeed; }

/** Initialize game state for a new game from seed (0 = random). */
export function initializeRogue(seed: bigint): void {
    dynamicColors = dynamicColorsBounds.map(([start]) => ({ ...start }));
    initializeRogueFn(buildGameInitContext(), seed);
}

/** Transition to a new level. oldLevel = the level number being left (1-indexed). */
export function startLevel(oldLevel: number, stairDirection: number): void {
    startLevelFn(buildLevelContext(), oldLevel, stairDirection);
}

/** Release all game resources. Call after the game ends. */
export function freeEverything(): void {
    freeEverythingFn(buildCleanupContext());
}
