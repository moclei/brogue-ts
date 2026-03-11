/*
 *  movement.ts — Movement context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildMovementContext(), buildTravelContext(), and
 *  buildCostMapFovContext(), the context factories that wire the movement
 *  module's DI interfaces.
 *
 *  Display callbacks (refreshDungeonCell, hilitePath, pauseAnimation, etc.),
 *  stair transitions, item pickup, and the platform event bridge (nextBrogueEvent)
 *  are stubbed here; they will be wired in port-v2-platform.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, setVictory } from "./core.js";
import { buildCombatAttackContext } from "./combat.js";
import { buildMonsterStateContext } from "./monsters.js";
import { buildTurnProcessingContext } from "./turn.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    cellHasTerrainType as cellHasTerrainTypeFn,
    terrainFlags as terrainFlagsFn,
} from "./state/helpers.js";
import { coordinatesAreInMap, nbDirs, mapToWindowX as mapToWindowXFn, mapToWindowY as mapToWindowYFn } from "./globals/tables.js";
import { diagonalBlocked as diagonalBlockedFn } from "./combat/combat-math.js";
import {
    monsterAvoids as monsterAvoidsFn,
    distanceBetween,
} from "./monsters/monster-state.js";
import {
    monsterRevealed as monsterRevealedFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    monsterWillAttackTarget as monsterWillAttackTargetFn,
} from "./monsters/monster-queries.js";
import { forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn } from "./monsters/monster-spawning.js";
import { canPass as canPassFn } from "./monsters/monster-movement.js";
import {
    buildHitList as buildHitListFn,
    attack as attackFn,
} from "./combat/combat-attack.js";
import {
    hilitePath as hilitePathFn,
    clearCursorPath as clearCursorPathFn,
    hiliteCell as hiliteCellFn,
} from "./io/targeting.js";
import {
    applyColorAugment as applyColorAugmentFn,
    separateColors as separateColorsFn,
} from "./io/color.js";
import {
    mapToWindow as mapToWindowFn,
    plotCharWithColor as plotCharWithColorFn,
    windowToMapX as windowToMapXFn,
    windowToMapY as windowToMapYFn,
} from "./io/display.js";
import { platformPauseAndCheckForEvent } from "./platform-bridge.js";
import { buildUpdateVisionFn } from "./vision-wiring.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import {
    playerRecoversFromAttacking as playerRecoversFromAttackingFn,
    playerTurnEnded as playerTurnEndedFn,
} from "./time/turn-processing.js";
import {
    monsterShouldFall as monsterShouldFallFn,
    updatePlayerUnderwaterness as updatePlayerUnderwaternessFn,
} from "./time/creature-effects.js";
import { promoteTile as promoteTileFn } from "./time/environment.js";
import { useKeyAt as useKeyAtFn, checkForMissingKeys as checkForMissingKeysFn } from "./movement/item-helpers.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "./movement/path-qualifying.js";
import { pickUpItemAt as pickUpItemAtFn } from "./items/pickup.js";
import { removeItemAt as removeItemAtFn } from "./items/floor-items.js";
import { identifyItemKind as identifyItemKindFn, itemName as itemNameFn } from "./items/item-naming.js";
import {
    numberOfItemsInPack as numberOfItemsInPackFn,
    itemWillStackWithPack as itemWillStackWithPackFn,
    removeItemFromArray as removeItemFromArrayFn,
    addItemToPack as addItemToPackFn,
    deleteItem as deleteItemFn,
} from "./items/item-inventory.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";
import type { ItemTable } from "./types/types.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./items/item-utils.js";
import { layerWithTMFlag as layerWithTMFlagFn, layerWithFlag as layerWithFlagFn } from "./movement/map-queries.js";
import {
    handleWhipAttacks as handleWhipAttacksFn,
    handleSpearAttacks as handleSpearAttacksFn,
    buildFlailHitList as buildFlailHitListFn,
    abortAttack as abortAttackFn,
} from "./movement/weapon-attacks.js";
import { randValidDirectionFrom as randValidDirectionFromFn, playerMoves as playerMovesFn, vomit as vomitFn } from "./movement/player-movement.js";
import { populateCreatureCostMap as populateCreatureCostMapFn } from "./movement/cost-maps-fov.js";
import { buildCostMapFovContext } from "./movement-cost-map.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { backgroundMessageColor, lightBlue, white, black } from "./globals/colors.js";
import { itemAtLoc as itemAtLocFn, numberOfMatchingPackItems as numberOfMatchingPackItemsFn } from "./items/item-inventory.js";
import { monsterDamageAdjustmentAmount as monsterDamageAdjustmentAmountFn } from "./combat/combat-math.js";
import { allocGrid, freeGrid } from "./grid/grid.js";
import { dijkstraScan, calculateDistances } from "./dijkstra/dijkstra.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { randRange, randPercent, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "./math/rng.js";
import { TileFlag, TerrainFlag, TerrainMechFlag } from "./types/flags.js";
import { ItemCategory, CreatureState, DungeonLayer } from "./types/enums.js";
import {
    ASCEND_KEY, DESCEND_KEY, RETURN_KEY,
    DCOLS, DROWS,
} from "./types/constants.js";
import { INVALID_POS } from "./types/types.js";
import type { CalculateDistancesContext } from "./dijkstra/dijkstra.js";
import type { PlayerMoveContext } from "./movement/player-movement.js";
import { useStairs as useStairsFn } from "./movement/travel-explore.js";
import type { TravelExploreContext } from "./movement/travel-explore.js";
import { startLevel as startLevelFn } from "./lifecycle.js";
import { commitDraws } from "./platform.js";
import type { Creature, Pos, RogueEvent } from "./types/types.js";
import type { EnvironmentContext } from "./time/environment.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildGetCellAppearanceFn, buildConfirmFn } from "./io-wiring.js";
import { buildWeaponAttackContext } from "./movement-weapon-context.js";
export { buildWeaponAttackContext };

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterAtLocHelper(player: Creature, monsters: Creature[]) {
    return function monsterAtLoc(loc: Pos): Creature | null {
        if (player.loc.x === loc.x && player.loc.y === loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}
function buildMonsterNameHelper(player: Creature) {
    return function monsterName(monst: Creature, includeArticle: boolean): string {
        if (monst === player) return "you";
        const pfx = includeArticle
            ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
            : "";
        return `${pfx}${monst.info.monsterName}`;
    };
}
// =============================================================================
// buildMovementContext
// =============================================================================

/**
 * Build a PlayerMoveContext backed by the current game state.
 *
 * Wires real implementations for terrain queries, monster queries, combat
 * (attack, buildHitList, weapon attacks), and turn advancement.
 * Display callbacks, stair transitions, item pickup, and confirm dialogs
 * are stubbed — wired in port-v2-platform.
 */
export function buildMovementContext(): PlayerMoveContext {
    const { player, rogue, pmap, monsters, levels, packItems, floorItems, gameConst,
        mutableScrollTable, mutablePotionTable, monsterCatalog } = getGameState();
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
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);

    const monsterAtLoc = buildMonsterAtLocHelper(player, monsters);
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);

    const spawnFeature = (x: number, y: number, feat: unknown, rc: boolean, ab: boolean) =>
        spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, rc, ab);

    const monsterStateCtx = buildMonsterStateContext();
    const attackCtx = buildCombatAttackContext();

    // Partial EnvironmentContext for promoteTile (unused fields stubbed).
    // fillSequentialList/shuffleList must be real: activateMachine fills and
    // shuffles sCols/sRows before iterating pmap; stubs leave them undefined
    // and pmap[undefined] crashes.  monstersTurn remains stubbed (complex wiring).
    const envCtx = {
        pmap, rogue, tileCatalog, dungeonFeatureCatalog, DCOLS, DROWS, monsters, levels,
        refreshDungeonCell, spawnDungeonFeature: spawnFeature, cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        monstersFall: () => {}, updateFloorItems: () => {}, monstersTurn: () => {}, keyOnTileAt: () => null,
        removeCreature: () => false, prependCreature: () => {},
        rand_range: (a: number, b: number) => randRange(a, b), rand_percent: (p: number) => randPercent(p),
        max: Math.max, min: Math.min,
        fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
        shuffleList: (list: number[], _len: number) => shuffleListFn(list),
        exposeTileToFire: () => false,
    } as unknown as EnvironmentContext;

    // Partial ItemHelperContext for useKeyAt/checkForMissingKeys.
    const itemHelperCtx = {
        pmap, player, tileCatalog,
        rogue: { playbackOmniscience: rogue.playbackOmniscience ?? false },
        packItems, floorItems,
        cellHasTerrainFlag, cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        promoteTile: (x: number, y: number, layer: number, isVolatile: boolean) =>
            promoteTileFn(x, y, layer as DungeonLayer, isVolatile, envCtx),
        messageWithColor: io.messageWithColor,
        itemMessageColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        removeItemFromChain: (item: any, chain: any[]) => removeItemFromArrayFn(item, chain),
        deleteItem: (item: any) => deleteItemFn(item),
        monsterAtLoc,
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        distanceBetween,
        discover: (x: number, y: number) => { if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED; },
        randPercent,
        posEq: (a: Pos, b: Pos) => a.x === b.x && a.y === b.y,
        keyOnTileAt: (loc: Pos) => {
            const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;
            if (player.loc.x === loc.x && player.loc.y === loc.y) {
                const k = packItems.find(it => (it.category & ItemCategory.KEY) && keyMatchesLocationFn(it, loc, rogue.depthLevel, machineNum));
                if (k) return k;
            }
            if (pmap[loc.x][loc.y].flags & TileFlag.HAS_ITEM) {
                const fi = itemAtLocFn(loc, floorItems);
                if (fi && (fi.category & ItemCategory.KEY) && keyMatchesLocationFn(fi, loc, rogue.depthLevel, machineNum)) return fi;
            }
            const monst = monsterAtLoc(loc);
            if (monst?.carriedItem && (monst.carriedItem.category & ItemCategory.KEY) && keyMatchesLocationFn(monst.carriedItem, loc, rogue.depthLevel, machineNum)) return monst.carriedItem;
            return null;
        },
        initializeItem: () => ({}) as any,
        itemName: (item: any, buf: string[], inclDetails: boolean, inclArticle: boolean) => { buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx); },
        describeHallucinatedItem: (buf: string[]) => { buf[0] = "something"; },
    } as unknown as import("./movement/item-helpers.js").ItemHelperContext;

    // Partial QualifyingPathContext for getQualifyingPathLocNear.
    const pathCtx = {
        pmap,
        cellHasTerrainFlag,
        cellFlags: (pos: Pos) => pmap[pos.x][pos.y].flags,
        rng: { randRange: (lo: number, hi: number) => randRange(lo, hi) },
        // Fallback is rare (only when dijkstra finds no path); stub for now.
        getQualifyingLocNear: (_t: Pos) => null,
    } as unknown as import("./movement/path-qualifying.js").QualifyingPathContext;

    // Context for pickUpItemAt.
    const pickupCtx = {
        player, rogue, pmap, monsters, packItems, floorItems,
        gameConst,
        tileCatalog,
        itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
        identifyItemKind: (item: any) => identifyItemKindFn(item, gameConst, { scrollTable: mutableScrollTable, potionTable: mutablePotionTable }),
        wandKindData: (kind: number) => wandTable[kind] ?? null,
        numberOfItemsInPack: () => numberOfItemsInPackFn(packItems),
        itemWillStackWithPack: (item: any) => itemWillStackWithPackFn(item, packItems),
        removeItemFromFloor: (item: any) => removeItemFromArrayFn(item, floorItems),
        addItemToPack: (item: any) => addItemToPackFn(item, packItems),
        deleteItem: (item: any) => deleteItemFn(item),
        removeItemAt: (loc: Pos) => removeItemAtFn(loc, { pmap, tileCatalog, cellHasTMFlag,
            promoteTile: (x: number, y: number, layer: number, isVol: boolean) => promoteTileFn(x, y, layer as DungeonLayer, isVol, envCtx) }),
        numberOfMatchingPackItems: (cat: number, req: number, forb: number) => numberOfMatchingPackItemsFn(packItems, cat, req, forb),
        getRandomMonsterSpawnLocation: (): Pos => ({ x: 0, y: 0 }),  // stub — DEFER: port-v2-platform
        generateMonster: () => ({}) as any,                           // stub — DEFER: port-v2-platform
        itemName: (item: any, buf: string[], inclDetails: boolean, inclArticle: boolean) => { buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx); },
        messageWithColor: io.messageWithColor,
        message: io.message,
        itemMessageColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        badMessageColor: { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
    } as unknown as import("./items/pickup.js").PickUpItemAtContext;

    function randValidDirectionFrom(
        monst: Creature, x: number, y: number, respectAvoidance: boolean,
    ): number {
        return randValidDirectionFromFn(monst, x, y, respectAvoidance, {
            pmap,
            nbDirs,
            coordinatesAreInMap: (nx, ny) => coordinatesAreInMap(nx, ny),
            cellHasTerrainFlag,
            diagonalBlocked: (x1, y1, x2, y2, _ip) =>
                diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos)),
            monsterAvoids: (m, pos) => monsterAvoidsFn(m, pos, monsterStateCtx),
            randRange: (lo, hi) => randRange(lo, hi),
        });
    }

    return {
        // ── Map state ─────────────────────────────────────────────────────────
        pmap,
        player,
        rogue,
        nbDirs,

        // ── Map queries ───────────────────────────────────────────────────────
        coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
        cellHasTerrainFlag,
        cellHasTMFlag,
        cellHasTerrainType: (pos, t) => cellHasTerrainTypeFn(pmap, pos, t),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        diagonalBlocked: (x1, y1, x2, y2, _isPlayer) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos)),

        // ── Monster queries ───────────────────────────────────────────────────
        monsterAtLoc,
        canSeeMonster,
        monsterRevealed: (m) => monsterRevealedFn(m, player),
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        monsterWillAttackTarget: (a, d) =>
            monsterWillAttackTargetFn(a, d, player, cellHasTerrainFlag),
        monsterName: buildMonsterNameHelper(player),
        monsterAvoids: (m, pos) => monsterAvoidsFn(m, pos, monsterStateCtx),
        monsterShouldFall: (m) => monsterShouldFallFn(m,
            { cellHasTerrainFlag } as unknown as import("./time/creature-effects.js").CreatureEffectsContext),
        forbiddenFlagsForMonster: (info) => forbiddenFlagsForMonsterFn(info),
        distanceBetween: (a, b) => distanceBetween(a, b),
        allMonsters: () => monsters,

        // ── Layer queries ─────────────────────────────────────────────────────
        layerWithTMFlag: (x, y, flag) => layerWithTMFlagFn(pmap, x, y, flag),
        layerWithFlag: (x, y, flag) => layerWithFlagFn(pmap, x, y, flag),

        // ── Combat ───────────────────────────────────────────────────────────
        handleWhipAttacks: (monst, dir, aborted) =>
            handleWhipAttacksFn(monst, dir, aborted, buildWeaponAttackContext()),
        handleSpearAttacks: (monst, dir, aborted) =>
            handleSpearAttacksFn(monst, dir, aborted, buildWeaponAttackContext()),
        buildFlailHitList: (x1, y1, x2, y2, hitList) =>
            buildFlailHitListFn(x1, y1, x2, y2, hitList, buildWeaponAttackContext()),
        buildHitList: (hitList, attacker, defender, allAdj) => {
            const result = buildHitListFn(attacker, defender, allAdj, attackCtx);
            for (let i = 0; i < result.length; i++) hitList[i] = result[i];
        },
        abortAttack: (hitList) => abortAttackFn(hitList, buildWeaponAttackContext()),
        attack: (attacker, defender, lunge) =>
            attackFn(attacker, defender, lunge, attackCtx),
        playerRecoversFromAttacking: (anyHit) =>
            playerRecoversFromAttackingFn(anyHit, buildTurnProcessingContext()),

        // ── Movement ─────────────────────────────────────────────────────────
        randValidDirectionFrom,
        moveMonster(monst, dx, dy) {  // stub — entranced movement, wired in port-v2-platform
            const ox = monst.loc.x;
            const oy = monst.loc.y;
            const nx = ox + dx;
            const ny = oy + dy;
            if (!coordinatesAreInMap(nx, ny)) return;
            pmap[ox][oy].flags &= ~TileFlag.HAS_MONSTER;
            monst.loc = { x: nx, y: ny };
            pmap[nx][ny].flags |= TileFlag.HAS_MONSTER;
        },
        getQualifyingPathLocNear: (target, hallwaysAllowed, blockTF, blockMF, forbidTF, forbidMF, det) =>
            getQualifyingPathLocNearFn(target, hallwaysAllowed, blockTF, blockMF, forbidTF, forbidMF, det, pathCtx),

        // ── Items ─────────────────────────────────────────────────────────────
        keyInPackFor(loc) {
            return packItems.find((item) => {
                if (!(item.category & ItemCategory.KEY)) return false;
                for (let i = 0; i < item.keyLoc.length; i++) {
                    const kl = item.keyLoc[i];
                    if (!kl.loc.x && !kl.machine) break;
                    if (kl.loc.x === loc.x && kl.loc.y === loc.y) return true;
                    if (kl.machine && kl.machine === pmap[loc.x]?.[loc.y]?.machineNumber) return true;
                }
                return false;
            }) ?? null;
        },
        useKeyAt: (item, x, y) => useKeyAtFn(item, x, y, itemHelperCtx),
        pickUpItemAt: (loc) => pickUpItemAtFn(loc, pickupCtx),
        checkForMissingKeys: (x, y) => checkForMissingKeysFn(x, y, itemHelperCtx),

        // ── Ally/captive ──────────────────────────────────────────────────────
        freeCaptive(monst) { monst.creatureState = CreatureState.Ally; monst.leader = player; },

        // ── Map manipulation ──────────────────────────────────────────────────
        promoteTile: (x, y, layer, useFireDF) => promoteTileFn(x, y, layer as DungeonLayer, useFireDF, envCtx),
        refreshDungeonCell,
        discoverCell: (x, y) => { if (coordinatesAreInMap(x, y)) { pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY; pmap[x][y].flags |= TileFlag.DISCOVERED; } },
        spawnDungeonFeature: spawnFeature,
        dungeonFeatureCatalog,
        useStairs: (delta) => {
            console.log("[playerMoves] useStairs called delta=%d", delta);
            useStairsFn(delta, buildTravelContext());
        },

        // ── Game flow ────────────────────────────────────────────────────────
        playerTurnEnded: async () => { await playerTurnEndedFn(buildTurnProcessingContext()); },
        recordKeystroke: () => {},       // DEFER: port-v2-persistence (input recording layer)
        cancelKeystroke: () => {},       // DEFER: port-v2-persistence (input recording layer)
        confirm: buildConfirmFn(),

        // ── Messages (stubs — wired in port-v2-platform) ─────────────────────
        message: io.message,
        messageWithColor: io.messageWithColor,
        combatMessage: io.combatMessage,
        backgroundMessageColor,

        randPercent: (pct) => randPercent(pct),
        randRange: (lo, hi) => randRange(lo, hi),

        // ── Vomit / isDisturbed ───────────────────────────────────────────────
        vomit(monst) {
            vomitFn(monst, {
                player,
                dungeonFeatureCatalog,
                spawnDungeonFeature: spawnFeature,
                canDirectlySeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                monsterName: buildMonsterNameHelper(player),
                combatMessage: io.combatMessage,
                automationActive: rogue.automationActive,
            });
        },
        isDisturbed(x, y): boolean {
            for (let i = 0; i < 8; i++) {
                const nx = x + nbDirs[i][0];
                const ny = y + nbDirs[i][1];
                if (!coordinatesAreInMap(nx, ny)) continue;
                if (pmap[nx][ny].flags & TileFlag.HAS_ITEM) return true;
                const m = monsterAtLoc({ x: nx, y: ny });
                if (
                    m && m.creatureState !== CreatureState.Ally &&
                    (canSeeMonster(m) || monsterRevealedFn(m, player))
                ) return true;
            }
            return false;
        },
    };
}

// =============================================================================
// buildTravelContext
// =============================================================================

/**
 * Build a TravelExploreContext backed by the current game state.
 *
 * Wires real implementations for pathfinding (calculateDistances, dijkstraScan),
 * cost maps (populateCreatureCostMap), and player movement (playerMoves).
 * All display callbacks (hilitePath, clearCursorPath, pauseAnimation,
 * nextBrogueEvent, commitDraws, etc.) are stubbed — wired in port-v2-platform.
 */
export function buildTravelContext(): TravelExploreContext {
    const { player, rogue, pmap, monsters, floorItems, packItems, gameConst, displayBuffer } = getGameState();
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);
    const monsterAtLoc = buildMonsterAtLocHelper(player, monsters);
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    const monsterStateCtx = buildMonsterStateContext();

    // Minimal context for cursor-path highlighting (hilitePath, clearCursorPath)
    const pathHighlightCtx = {
        rogue: { playbackMode: rogue.playbackMode },
        pmap,
        refreshDungeonCell,
    } as unknown as import("./io/targeting.js").TargetingContext;

    // Context for hiliteCell: needs cell appearance + color ops + plotCharWithColor
    const getCellApp = buildGetCellAppearanceFn();
    const hiliteCellCtx = {
        ...pathHighlightCtx,
        getCellAppearance: getCellApp,
        applyColorAugment: applyColorAugmentFn,
        separateColors: separateColorsFn,
        plotCharWithColor: (g: number, wp: { windowX: number; windowY: number }, fg: unknown, bg: unknown) =>
            plotCharWithColorFn(g as never, wp, fg as never, bg as never, displayBuffer),
        mapToWindow: mapToWindowFn,
    } as unknown as import("./io/targeting.js").TargetingContext;

    return {
        // ── Map state ─────────────────────────────────────────────────────────
        pmap,
        player,
        rogue,
        monsters,
        nbDirs,
        gameConst: { deepestLevel: gameConst.deepestLevel },
        tileCatalog: tileCatalog as unknown as readonly { flags: number; mechFlags: number; discoverType: number }[],

        // ── Map helpers ───────────────────────────────────────────────────────
        coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
        cellHasTerrainFlag,
        cellHasTMFlag,
        diagonalBlocked: (x1, y1, x2, y2, _lim) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos)),
        monsterAvoids: (m, pos) => monsterAvoidsFn(m, pos, monsterStateCtx),

        // ── Creature helpers ──────────────────────────────────────────────────
        monsterAtLoc,
        canSeeMonster,
        canPass: (mover, blocker) => canPassFn(mover, blocker, player, cellHasTerrainFlag),
        monstersAreTeammates: (a, b) => a.leader === b || b.leader === a,
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        monsterDamageAdjustmentAmount: (m) =>
            Number(monsterDamageAdjustmentAmountFn(m, player)),

        // ── Player movement ───────────────────────────────────────────────────
        playerMoves: async (dir) => await playerMovesFn(dir, buildMovementContext()),

        // ── Distance / pathfinding ────────────────────────────────────────────
        allocGrid: () => allocGrid(),
        freeGrid: (grid) => freeGrid(grid),
        calculateDistances: (distMap, destX, destY, blockFlags, traveler, secretDoors, eightWays) =>
            calculateDistances(distMap, destX, destY, blockFlags, traveler, secretDoors, eightWays, {
                cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
                cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
                monsterAtLoc: monsterAtLoc,
                monsterAvoids: () => false,
                discoveredTerrainFlagsAtLoc: () => 0,
                isPlayer: (m: Creature) => m === player,
                getCellFlags: (x: number, y: number) => pmap[x][y].flags,
            } satisfies CalculateDistancesContext),
        dijkstraScan: (distMap, costMap, allowDiag) =>
            dijkstraScan(distMap, costMap, allowDiag),
        populateCreatureCostMap: (costMap, monst) =>
            populateCreatureCostMapFn(costMap, monst, buildCostMapFovContext()),

        // ── Known-terrain helper ──────────────────────────────────────────────
        knownToPlayerAsPassableOrSecretDoor(pos) {
            const cell = pmap[pos.x]?.[pos.y];
            if (!cell) return false;
            if (!(cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))) return false;
            if (cell.rememberedTerrainFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) {
                return !!(cell.rememberedTMFlags & TerrainMechFlag.TM_IS_SECRET);
            }
            return true;
        },

        // ── Item helpers ──────────────────────────────────────────────────────
        itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
        numberOfMatchingPackItems: (cat, req, forbidden, _isBlessed) =>
            numberOfMatchingPackItemsFn(packItems, cat, req, forbidden),

        // ── UI ────────────────────────────────────────────────────────────────
        message: io.message,
        messageWithColor: io.messageWithColor,
        confirmMessages: io.confirmMessages,
        hiliteCell: (x, y, color, strength, flash) => hiliteCellFn(x, y, color, strength, flash, hiliteCellCtx),
        refreshDungeonCell,
        refreshSideBar,
        updateFlavorText: () => {},          // stub — needs CreatureEffectsContext (Phase 3c)
        clearCursorPath: () => clearCursorPathFn(pathHighlightCtx),
        hilitePath: (path, steps, remove) => hilitePathFn(path, steps, remove, pathHighlightCtx),
        getPlayerPathOnMap: () => 0,
        commitDraws: () => commitDraws(),
        pauseAnimation: async (ms, _behavior) => { commitDraws(); return platformPauseAndCheckForEvent(ms); },
        recordMouseClick: () => {},
        mapToWindowX: (x) => mapToWindowXFn(x),
        mapToWindowY: (y) => mapToWindowYFn(y),
        windowToMapX: (wx) => windowToMapXFn(wx),
        windowToMapY: (wy) => windowToMapYFn(wy),
        updatePlayerUnderwaterness: () => updatePlayerUnderwaternessFn({
            player, rogue: rogue as unknown as CreatureEffectsContext["rogue"], pmap,
            cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
            updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); }, updateVision: buildUpdateVisionFn(), displayLevel: () => {},
        } as unknown as CreatureEffectsContext),
        updateVision: buildUpdateVisionFn(),
        nextBrogueEvent: (_event: RogueEvent) => {},   // permanent-defer — cursor event loop not needed in movement context
        executeMouseClick: () => {},
        printString: () => {},

        // ── Colors ────────────────────────────────────────────────────────────
        hiliteColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        white,
        black,
        lightBlue,
        backgroundMessageColor,

        // ── Level transitions ─────────────────────────────────────────────────
        startLevel: (oldLevel, dir) => {
            console.log("[useStairs] startLevel called oldLevel=%d dir=%d", oldLevel, dir);
            startLevelFn(oldLevel, dir);
        },
        victory: (isDescending) => setVictory(isDescending),

        // ── FP math ───────────────────────────────────────────────────────────
        fpFactor: Number(FP_FACTOR),

        // ── Constants ────────────────────────────────────────────────────────
        AMULET: ItemCategory.AMULET,
        D_WORMHOLING: false,
        ASCEND_KEY,
        DESCEND_KEY,
        RETURN_KEY,

        // ── Pos helpers ───────────────────────────────────────────────────────
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        INVALID_POS: { ...INVALID_POS },
    };
}

// buildCostMapFovContext moved to movement-cost-map.ts to stay under 600 lines.
export { buildCostMapFovContext } from "./movement-cost-map.js";
