/*
 *  lifecycle-level.ts — buildLevelContext
 *  Port V2 — rogue-ts
 *
 *  Provides buildLevelContext() → LevelContext (game-level.ts).
 *  Extracted from lifecycle.ts to keep that file under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, setMonsters, setDormantMonsters, getScentMap, setScentMap, setBuildMachineFn } from "./core.js";
import { commitDraws } from "./platform.js";
import { dynamicColorsBounds, nbDirs, coordinatesAreInMap, posNeighborInDirection } from "./globals/tables.js";
import { DungeonLayer, MonsterType, ItemCategory } from "./types/enums.js";
import { meteredItemsGenerationTable, lumenstoneDistribution,
    scrollTable, potionTable, armorTable } from "./globals/item-catalog.js";
import { autoGeneratorCatalog } from "./globals/autogenerator-catalog.js";
import { blueprintCatalog } from "./globals/blueprint-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { dungeonProfileCatalog } from "./globals/dungeon-profile-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { itemMessageColor, goodMessageColor } from "./globals/colors.js";
import { DCOLS, DROWS, MONSTER_CLASS_COUNT } from "./types/constants.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, IS_IN_MACHINE } from "./types/flags.js";
import { seedRandomGenerator, randRange, rand64bits, randPercent, randClump, clamp } from "./math/rng.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { allocGrid, fillGrid, freeGrid } from "./grid/grid.js";
import { terrainRandomValues, displayDetail, shuffleTerrainColors as shuffleTerrainColorsFn } from "./render-state.js";
import { calculateDistances, pathingDistance as pathingDistanceFn } from "./dijkstra/dijkstra.js";
import type { CalculateDistancesContext } from "./dijkstra/dijkstra.js";
import { applyColorAverage } from "./io/color.js";
import { buildTurnProcessingContext } from "./turn.js";
import { buildMonsterSpawningContext, buildMonsterStateContext } from "./monsters.js";
import { updateMonsterState as updateMonsterStateFn } from "./monsters/monster-state.js";
import { digDungeon, placeStairs, initializeLevel, setUpWaypoints,
    updateMapToShore, getQualifyingLocNear as getQualifyingLocNearFn,
    restoreMonster as restoreMonsterFn, restoreItems as restoreItemsFn } from "./architect/architect.js";
import { avoidedFlagsForMonster as avoidedFlagsForMonsterFn } from "./monsters/monster-spawning.js";
import { analyzeMap } from "./architect/analysis.js";
import { getFOVMask } from "./light/fov.js";
import { populateGenericCostMap } from "./movement/cost-maps-fov.js";
import { populateItems } from "./items/item-population.js";
import { populateMonsters, spawnHorde as spawnHordeFn } from "./monsters/monster-spawning.js";
import { generateItem, itemMagicPolarity as itemMagicPolarityFn, itemIsHeavyWeapon as itemIsHeavyWeaponFn, itemIsPositivelyEnchanted as itemIsPositivelyEnchantedFn } from "./items/item-generation.js";
import { placeItemAt as placeItemAtFn } from "./items/floor-items.js";
import { numberOfMatchingPackItems, itemAtLoc as itemAtLocFn, removeItemFromArray as removeItemFromArrayFn, deleteItem as deleteItemFn } from "./items/item-inventory.js";
import { updateRingBonuses as updateRingBonusesFn } from "./items/item-usage.js";
import { updatePlayerRegenerationDelay as updatePlayerRegenerationDelayFn } from "./items/item-effects.js";
import { buildEquipState, syncEquipBonuses } from "./items/equip-helpers.js";
import { buildAMachine, type MachineItem } from "./architect/machines.js";
import { generateMonster } from "./monsters/monster-creation.js";
import { createMonsterOps, toggleMonsterDormancy } from "./monsters/monster-ops.js";
import {
    getCellAppearance,
    refreshDungeonCell as refreshDungeonCellFn,
    displayLevel as displayLevelFn,
} from "./io/cell-appearance.js";
import { deleteAllFlares } from "./light/flares.js";
import {
    cellHasTerrainFlag as ctf,
    cellHasTMFlag as ctmf,
    terrainFlags as tf,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { passableArcCount, cellIsPassableOrDoor, randomMatchingLocation } from "./architect/helpers.js";
import { synchronizePlayerTimeState } from "./time/turn-processing.js";
import { currentStealthRange as currentStealthRangeFn } from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { playerInDarkness as playerInDarknessFn, updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import type { Creature, Color, Item } from "./types/types.js";
import type { LevelContext } from "./game/game-level.js";
import { buildMessageFns, buildRefreshSideBarFn, buildRefreshDungeonCellFn } from "./io-wiring.js";
import { buildUpdateVisionFn } from "./vision-wiring.js";
import { buildUpdateEnvironmentFn } from "./turn-env-wiring.js";
import { buildCombatDamageContext } from "./combat.js";
import { killCreature as killCreatureFn } from "./combat/combat-damage.js";
import { hideCursor as hideCursorFn } from "./io/targeting.js";
import type { TargetingContext } from "./io/targeting.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "./movement/path-qualifying.js";
import { getChokeMap, getDynamicColors } from "./lifecycle.js";

// =============================================================================
// Private helpers (shared with buildGameInitContext in lifecycle.ts)
// =============================================================================

export function chooseVorpalEnemy(): number {
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
        discoveredTerrainFlagsAtLoc: (pos: { x: number; y: number }) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
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
        monsterAvoids: () => false, // permanent-defer — level-build distance calc; monsters not yet spawned
        discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
        isPlayer: (m: Creature) => m === player,
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
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

    const chokeMap = getChokeMap();
    const dynamicColors = getDynamicColors();

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
        spawnHorde(leaderID, pos, forbiddenFlags, requiredFlags) {
            return spawnHordeFn(leaderID, pos, forbiddenFlags, requiredFlags, buildMonsterSpawningContext());
        },
        monsterAtLoc(pos) {
            if (pos.x === player.loc.x && pos.y === player.loc.y) return player;
            return monsters.find(m => m.loc.x === pos.x && m.loc.y === pos.y) ?? null;
        },
        killCreature: (creature, quiet) => {
            void killCreatureFn(creature as unknown as import("./types/types.js").Creature, quiet, buildCombatDamageContext());
        },
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
                generateItem: (category: number, kind: number) => generateItem(category, kind, {
                    rng: { randRange, randPercent, randClump }, gameConstants: gameConst,
                    depthLevel: rogue.depthLevel, scrollTable: mutableScrollTable,
                    potionTable: mutablePotionTable, depthAccelerator: gameConst.depthAccelerator,
                    chooseVorpalEnemy,
                }),
                deleteItem: (item: MachineItem) => deleteItemFn(item as unknown as import("./types/types.js").Item),
                placeItemAt(item: MachineItem, loc: import("./types/types.js").Pos) {
                    placeItemAtFn(item as unknown as Item, loc, {
                        pmap, floorItems: floorItems as any,
                        tileCatalog: tileCatalog as any,
                        dungeonFeatureCatalog: dungeonFeatureCatalog as any,
                        itemMagicPolarity: (i) => itemMagicPolarityFn(i as unknown as Item),
                        cellHasTerrainFlag: (pos, flags) => ctf(pmap, pos, flags),
                        cellHasTMFlag: (pos, flags) => ctmf(pmap, pos, flags),
                        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                        itemName: (_i, buf) => { buf[0] = "item"; },
                        message: (msg: string, flags: number) => void buildMessageFns().message(msg, flags),
                        spawnDungeonFeature: () => {},   // permanent-defer — machine gen; display ops suppressed at level-build time
                        promoteTile: () => {},           // permanent-defer — tile promotion during machine build is level-gen only
                        discover: () => {},              // permanent-defer — discovery during machine build not needed
                        refreshDungeonCell: buildRefreshDungeonCellFn(),
                        REQUIRE_ACKNOWLEDGMENT: 1,
                    });
                },
                removeItemFromArray: (item: MachineItem, arr: MachineItem[]) => removeItemFromArrayFn(
                    item as unknown as import("./types/types.js").Item,
                    arr as unknown as import("./types/types.js").Item[],
                ),
                itemIsHeavyWeapon: (i: MachineItem) => itemIsHeavyWeaponFn(i as import("./types/types.js").Item), itemIsPositivelyEnchanted: (i: MachineItem) => itemIsPositivelyEnchantedFn(i as import("./types/types.js").Item),
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

    // Register machine builder so buildMonsterSpawningContext().buildMachine can call it.
    setBuildMachineFn((machineType, x, y) => {
        buildAMachine(archCtx.machineContext, machineType, x, y, 0, null, null, null);
        rogue.machineNumber = archCtx.machineContext.machineNumber;
    });

    // Build combat context once for updateEnvironment
    const combatCtx = buildCombatDamageContext();

    return {
        rogue, player, gameConst, FP_FACTOR,
        levels: getGameState().levels, pmap,
        monsters, dormantMonsters, floorItems, setMonsters, setDormantMonsters,
        scentMap: getScentMap(), setScentMap,
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
        currentStealthRange: () => currentStealthRangeFn({
            player,
            rogue,
            pmapAt: (loc: { x: number; y: number }) => pmap[loc.x][loc.y],
            IS_IN_SHADOW: TileFlag.IS_IN_SHADOW,
            ARMOR: ItemCategory.ARMOR,
            armorTable,
            playerInDarkness: () => playerInDarknessFn(tmap, player.loc),
            max: Math.max,
        } as unknown as CreatureEffectsContext),
        getQualifyingLocNear(target, _hw, _forbidCell, forbidTerrain, forbidMap, _det, _flood) {
            return getQualifyingLocNearFn(pmap, target, forbidTerrain, forbidMap) ?? { ...target };
        },
        getQualifyingPathLocNear: (target, hallwaysAllowed, btf, bmf, ftf, fmf, det) =>
            getQualifyingPathLocNearFn(target, hallwaysAllowed, btf, bmf, ftf, fmf, det, {
                pmap,
                cellHasTerrainFlag: (loc, flags) => ctf(pmap, loc, flags),
                cellFlags: (pos) => pmap[pos.x][pos.y].flags,
                rng: { randRange },
                getQualifyingLocNear: (t, _hw, ftf2, fmf2) =>
                    getQualifyingLocNearFn(pmap, t, ftf2, fmf2),
            }),
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
            const r = setUpWaypoints(pmap, costMapWrap, getFOVMaskWrap, monsters);
            rogue.wpDistance = r.wpDistance;
        },
        shuffleTerrainColors: (pct, reset) => shuffleTerrainColorsFn(pct, reset, pmap),
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
        updateEnvironment: buildUpdateEnvironmentFn(combatCtx),
        restoreMonster: (monst, mapToStairs, mapToPit) => restoreMonsterFn(monst, mapToStairs, mapToPit, {
            pmap, monsters, nbDirs,
            coordinatesAreInMap,
            cellHasTMFlag: (pos, flags) => ctmf(pmap, pos, flags),
            cellHasTerrainFlag: (pos, flags) => ctf(pmap, pos, flags),
            avoidedFlagsForMonster: (info) => avoidedFlagsForMonsterFn(info),
            knownToPlayerAsPassableOrSecretDoor: (pos) => {
                const cell = pmap[pos.x]?.[pos.y];
                if (!cell) return false;
                const discovered = !!(cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED));
                const visible = !!(cell.flags & TileFlag.VISIBLE);
                let obstructs: boolean;
                if (discovered && !visible) {
                    obstructs = !!(cell.rememberedTerrainFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                } else {
                    obstructs = ctf(pmap, pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                }
                const isSecret = ctmf(pmap, pos, TerrainMechFlag.TM_IS_SECRET);
                return !obstructs || isSecret;
            },
            getQualifyingPathLocNear: (target, hallwaysAllowed, blockTerrFl, blockMapFl, forbTerrFl, forbMapFl, det) =>
                getQualifyingPathLocNearFn(target, hallwaysAllowed, blockTerrFl, blockMapFl, forbTerrFl, forbMapFl, det, {
                    pmap,
                    cellHasTerrainFlag: (pos, flags) => ctf(pmap, pos, flags),
                    cellFlags: (pos) => pmap[pos.x]?.[pos.y]?.flags ?? 0,
                    getQualifyingLocNear: (t, _ha, forbTerrF, forbMapF, _det) =>
                        getQualifyingLocNearFn(pmap, t, forbTerrF, forbMapF),
                    rng: { randRange },
                }),
            HAS_PLAYER: TileFlag.HAS_PLAYER,
            HAS_MONSTER: TileFlag.HAS_MONSTER,
            HAS_STAIRS: TileFlag.HAS_STAIRS,
            IS_IN_MACHINE,
        }),
        restoreItems: () => restoreItemsFn({
            pmap, floorItems, tileCatalog, dungeonFeatureCatalog,
            coordinatesAreInMap,
            cellHasTerrainFlag: (pos, flags) => ctf(pmap, pos, flags),
            cellHasTMFlag: (pos, flags) => ctmf(pmap, pos, flags),
            placeItemAt: (item, dest) => {
                item.loc = { ...dest };
                if (!floorItems.includes(item)) floorItems.unshift(item);
                pmap[dest.x][dest.y].flags |= TileFlag.HAS_ITEM;
            },
            getQualifyingLocNear: (target, _hallwaysAllowed, _blockingMap, forbTerrFlags, forbMapFlags, _forbidLiquid, _deterministic) =>
                getQualifyingLocNearFn(pmap, target, forbTerrFlags, forbMapFlags),
            HAS_MONSTER: TileFlag.HAS_MONSTER,
            HAS_ITEM: TileFlag.HAS_ITEM,
            HAS_STAIRS: TileFlag.HAS_STAIRS,
        }),
        updateMonsterState: (monst) => updateMonsterStateFn(monst, buildMonsterStateContext()),
        storeMemories(x, y) {
            const cell = pmap[x][y];
            cell.rememberedTerrainFlags = tf(pmap, { x, y });
            cell.rememberedCellFlags = cell.flags;
        },
        updateVision: buildUpdateVisionFn(),
        discoverCell: (x, y) => { pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY; pmap[x][y].flags |= TileFlag.DISCOVERED; },
        updateMapToShore() { rogue.mapToShore = updateMapToShore(pmap); },
        updateRingBonuses: () => { const s = buildEquipState(); updateRingBonusesFn(s); syncEquipBonuses(s); },
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updatePlayerRegenerationDelay: () => { updatePlayerRegenerationDelayFn({ player, regenerationBonus: rogue.regenerationBonus }); },
        displayLevel() {
            // Use getGameState() here: setMonsters()/setDormantMonsters() during startLevel()
            // replace the module-level array references after this context was built, so the
            // captured `monsters`/`dormantMonsters`/`floorItems` would be stale on level entry.
            const state = getGameState();
            const getCellApp = (loc: { x: number; y: number }) => getCellAppearance(
                loc, pmap, tmap, displayBuffer, rogue, player,
                state.monsters, state.dormantMonsters, state.floorItems,
                tileCatalog, dungeonFeatureCatalog, monsterCatalog,
                terrainRandomValues, displayDetail, getScentMap() ?? [],
            );
            displayLevelFn(DCOLS, DROWS, (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer));
            commitDraws();
        },
        refreshSideBar: (_x, _y, _justClearing) => buildRefreshSideBarFn()(),
        messageWithColor: (msg: string, color: Readonly<Color>, flags: number) => {
            void buildMessageFns().messageWithColor(msg, color, flags);
        },
        RNGCheck: () => {}, // DEFER: port-v2-persistence — recording playback check
        flushBufferToFile: () => {}, // DEFER: port-v2-persistence — recording flush
        deleteAllFlares() { deleteAllFlares(rogue); },
        hideCursor: () => hideCursorFn({ rogue, player } as unknown as TargetingContext),
        itemMessageColor, nbDirs, clamp,
    };
}
