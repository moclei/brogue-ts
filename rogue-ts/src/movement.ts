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

import { getGameState } from "./core.js";
import { buildCombatAttackContext } from "./combat.js";
import { buildMonsterStateContext } from "./monsters.js";
import { buildTurnProcessingContext } from "./turn.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    cellHasTerrainType as cellHasTerrainTypeFn,
    terrainFlags as terrainFlagsFn,
    terrainMechFlags as terrainMechFlagsFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { coordinatesAreInMap, nbDirs } from "./globals/tables.js";
import { diagonalBlocked as diagonalBlockedFn } from "./combat/combat-math.js";
import {
    monsterAvoids as monsterAvoidsFn,
    distanceBetween,
} from "./monsters/monster-state.js";
import {
    monsterRevealed as monsterRevealedFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    monsterWillAttackTarget as monsterWillAttackTargetFn,
    monsterIsHidden as monsterIsHiddenFn,
    monsterIsInClass as monsterIsInClassFn,
} from "./monsters/monster-queries.js";
import { forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn } from "./monsters/monster-spawning.js";
import {
    buildHitList as buildHitListFn,
    attack as attackFn,
} from "./combat/combat-attack.js";
import {
    playerRecoversFromAttacking as playerRecoversFromAttackingFn,
    playerTurnEnded as playerTurnEndedFn,
} from "./time/turn-processing.js";
import { monsterShouldFall as monsterShouldFallFn } from "./time/creature-effects.js";
import { layerWithTMFlag as layerWithTMFlagFn, layerWithFlag as layerWithFlagFn } from "./movement/map-queries.js";
import {
    handleWhipAttacks as handleWhipAttacksFn,
    handleSpearAttacks as handleSpearAttacksFn,
    buildFlailHitList as buildFlailHitListFn,
    abortAttack as abortAttackFn,
} from "./movement/weapon-attacks.js";
import { randValidDirectionFrom as randValidDirectionFromFn, playerMoves as playerMovesFn } from "./movement/player-movement.js";
import { populateCreatureCostMap as populateCreatureCostMapFn } from "./movement/cost-maps-fov.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { backgroundMessageColor, lightBlue, white, black } from "./globals/colors.js";
import { itemAtLoc as itemAtLocFn, numberOfMatchingPackItems as numberOfMatchingPackItemsFn } from "./items/item-inventory.js";
import { monsterDamageAdjustmentAmount as monsterDamageAdjustmentAmountFn } from "./combat/combat-math.js";
import { allocGrid, freeGrid } from "./grid/grid.js";
import { dijkstraScan, calculateDistances } from "./dijkstra/dijkstra.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { randRange, randPercent } from "./math/rng.js";
import { TileFlag, TerrainFlag, TerrainMechFlag } from "./types/flags.js";
import { ItemCategory, CreatureState, DungeonLayer } from "./types/enums.js";
import {
    ASCEND_KEY, DESCEND_KEY, RETURN_KEY,
    DCOLS, DROWS,
} from "./types/constants.js";
import { INVALID_POS } from "./types/types.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import type { CalculateDistancesContext } from "./dijkstra/dijkstra.js";
import type { PlayerMoveContext } from "./movement/player-movement.js";
import type { TravelExploreContext } from "./movement/travel-explore.js";
import type { CostMapFovContext } from "./movement/cost-maps-fov.js";
import type { WeaponAttackContext, BoltInfo } from "./movement/weapon-attacks.js";
import type { Creature, Pos, RogueEvent } from "./types/types.js";

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

/** Build a WeaponAttackContext for whip/spear/flail attacks. */
function buildWeaponAttackContext(): WeaponAttackContext {
    const { player, rogue, pmap, monsters } = getGameState();
    const attackCtx = buildCombatAttackContext();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const monsterAtLoc = buildMonsterAtLocHelper(player, monsters);
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);

    return {
        pmap,
        player,
        rogue: { weapon: rogue.weapon, playbackFastForward: rogue.playbackFastForward },
        nbDirs,
        coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
        isPosInMap: (pos) => coordinatesAreInMap(pos.x, pos.y),
        cellHasTerrainFlag,
        diagonalBlocked: (x1, y1, x2, y2, _isPlayer) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos)),
        monsterAtLoc,
        canSeeMonster,
        monsterIsHidden: (m, observer) => monsterIsHiddenFn(m, observer, {
            player, cellHasTerrainFlag,
            cellHasGas: () => false,
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: false,
        }),
        monsterWillAttackTarget: (a, d) =>
            monsterWillAttackTargetFn(a, d, player, cellHasTerrainFlag),
        monsterIsInClass: (m, cls) => monsterIsInClassFn(m, monsterClassCatalog[cls]),
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        monsterName: buildMonsterNameHelper(player),
        distanceBetween: (a, b) => distanceBetween(a, b),

        itemName: () => "item",             // stub — real name in port-v2-platform

        attack: (attacker, defender, lunge) =>
            attackFn(attacker, defender, lunge, attackCtx),

        boltCatalog: boltCatalog as unknown as readonly BoltInfo[],
        getImpactLoc: (_origin, target) => ({ ...target }),  // stub
        zap: () => {},                       // stub — wired in port-v2-platform

        confirm: () => true,                 // stub — wired in port-v2-platform
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
        plotForegroundChar: () => {},         // stub — wired in port-v2-platform
        pauseAnimation: () => {},             // stub — wired in port-v2-platform
        refreshDungeonCell: () => {},         // stub — wired in port-v2-platform
        lightBlue,
        allMonsters: () => monsters,
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
    const { player, rogue, pmap, monsters, packItems } = getGameState();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);

    const monsterAtLoc = buildMonsterAtLocHelper(player, monsters);
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);

    const monsterStateCtx = buildMonsterStateContext();
    const attackCtx = buildCombatAttackContext();

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
        getQualifyingPathLocNear: (target) => ({ ...target }),  // stub — wired in port-v2-platform

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
        useKeyAt: () => {},              // stub — wired in port-v2-platform
        pickUpItemAt: () => {},          // stub — wired in port-v2-platform
        checkForMissingKeys: () => {},   // stub — wired in port-v2-platform

        // ── Ally/captive ──────────────────────────────────────────────────────
        freeCaptive(monst) {  // minimal: ally the creature and message
            monst.creatureState = CreatureState.Ally;
            monst.leader = player;
        },

        // ── Map manipulation (stubs — wired in port-v2-platform) ─────────────
        promoteTile: () => {},
        refreshDungeonCell: () => {},
        discoverCell(x, y) {
            // Inline: mark the cell discovered (stub for visual effects)
            if (coordinatesAreInMap(x, y)) {
                pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            }
        },
        spawnDungeonFeature: () => {},
        dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as readonly never[],

        // ── Stairs (stub — wired in port-v2-platform) ────────────────────────
        useStairs: () => {},

        // ── Game flow ────────────────────────────────────────────────────────
        playerTurnEnded() {
            const turnCtx = buildTurnProcessingContext();
            playerTurnEndedFn(turnCtx);
        },
        recordKeystroke: () => {},       // stub — wired in port-v2-platform
        cancelKeystroke: () => {},       // stub — wired in port-v2-platform
        confirm: () => true,             // stub — wired in port-v2-platform

        // ── Messages (stubs — wired in port-v2-platform) ─────────────────────
        message: () => {},
        messageWithColor: () => {},
        combatMessage: () => {},
        backgroundMessageColor,

        // ── RNG ───────────────────────────────────────────────────────────────
        randPercent: (pct) => randPercent(pct),
        randRange: (lo, hi) => randRange(lo, hi),

        // ── Vomit ────────────────────────────────────────────────────────────
        vomit: () => {},                 // stub — spawnDungeonFeature is stub

        // ── isDisturbed ───────────────────────────────────────────────────────
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
    const { player, rogue, pmap, monsters, floorItems, packItems, gameConst } = getGameState();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);
    const monsterAtLoc = buildMonsterAtLocHelper(player, monsters);
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    const monsterStateCtx = buildMonsterStateContext();

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
        canPass: (_m, blocker) => !!(blocker.info?.flags & 0), // stub — wired in port-v2-platform
        monstersAreTeammates: (a, b) => a.leader === b || b.leader === a,
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        monsterDamageAdjustmentAmount: (m) =>
            Number(monsterDamageAdjustmentAmountFn(m, player)),

        // ── Player movement ───────────────────────────────────────────────────
        playerMoves: (dir) => playerMovesFn(dir, buildMovementContext()),

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

        // ── UI stubs (wired in port-v2-platform) ─────────────────────────────
        message: () => {},
        messageWithColor: () => {},
        confirmMessages: () => {},
        hiliteCell: () => {},
        refreshDungeonCell: () => {},
        refreshSideBar: () => {},
        updateFlavorText: () => {},
        clearCursorPath: () => {},
        hilitePath: () => {},
        getPlayerPathOnMap: () => 0,
        commitDraws: () => {},
        pauseAnimation: async () => false,
        recordMouseClick: () => {},
        mapToWindowX: (x) => x,
        mapToWindowY: (y) => y,
        windowToMapX: (wx) => wx,
        windowToMapY: (wy) => wy,
        updatePlayerUnderwaterness: () => {},
        updateVision: () => {},
        nextBrogueEvent: (_event: RogueEvent) => {},   // stub — wired in port-v2-platform
        executeMouseClick: () => {},
        printString: () => {},

        // ── Colors ────────────────────────────────────────────────────────────
        hiliteColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        white,
        black,
        lightBlue,
        backgroundMessageColor,

        // ── Level transitions (stubs — wired in port-v2-platform) ────────────
        startLevel: () => {},
        victory: () => {},

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

// =============================================================================
// buildCostMapFovContext
// =============================================================================

/**
 * Build a CostMapFovContext backed by the current game state.
 *
 * Wires real terrain queries and cell flag access.
 * Display callbacks (refreshDungeonCell, messageWithColor) and cosmetic RNG
 * are stubbed — wired in port-v2-platform.
 */
export function buildCostMapFovContext(): CostMapFovContext {
    const { player, rogue, pmap, tmap, floorItems } = getGameState();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);

    const monsterStateCtx = buildMonsterStateContext();

    return {
        // ── Map state ─────────────────────────────────────────────────────────
        pmap,
        tmap,
        player,
        rogue: {
            depthLevel: rogue.depthLevel,
            automationActive: rogue.automationActive,
            playerTurnNumber: rogue.playerTurnNumber,
            xpxpThisTurn: rogue.xpxpThisTurn,
            mapToShore: rogue.mapToShore ?? Array.from({ length: DCOLS }, () => new Array(DROWS).fill(0)),
        },
        tileCatalog: tileCatalog as unknown as CostMapFovContext["tileCatalog"],

        // ── Map helpers ───────────────────────────────────────────────────────
        cellHasTerrainFlag,
        cellHasTMFlag,
        terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
        terrainMechFlags: (pos) => terrainMechFlagsFn(pmap, pos),
        discoveredTerrainFlagsAtLoc: (pos) => discoveredTerrainFlagsAtLocFn(
            pmap, pos, tileCatalog,
            (tileType) => tileCatalog[tileCatalog[tileType]?.discoverType ?? 0]?.flags ?? 0,
        ),
        monsterAvoids: (m, pos) => monsterAvoidsFn(m, pos, monsterStateCtx),
        canPass: (_m, _blocker) => false,   // stub
        distanceBetween: (a, b) => distanceBetween(a, b),

        // ── Creature helpers ──────────────────────────────────────────────────
        monsterAtLoc: buildMonsterAtLocHelper(player, []),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),

        // ── Item helpers ──────────────────────────────────────────────────────
        itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
        itemName: (_item, buf) => { buf[0] = "item"; },  // stub

        // ── UI stubs (wired in port-v2-platform) ─────────────────────────────
        messageWithColor: () => {},
        refreshDungeonCell: () => {},
        discoverCell: (x, y) => {
            if (x >= 0 && x < DCOLS && y >= 0 && y < DROWS) {
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            }
        },
        storeMemories: () => {},             // stub — wired in port-v2-platform
        layerWithTMFlag: (x, y, flag) =>
            layerWithTMFlagFn(pmap, x, y, flag) as DungeonLayer,

        // ── Color constants ───────────────────────────────────────────────────
        itemMessageColor: { red: 100, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        backgroundMessageColor,

        // ── Item category constant ────────────────────────────────────────────
        KEY: ItemCategory.KEY,

        // ── Cosmetic RNG (stubs — wired in port-v2-platform) ─────────────────
        assureCosmeticRNG: () => {},
        restoreRNG: () => {},

        // ── getLocationFlags ──────────────────────────────────────────────────
        getLocationFlags(x, y, limitToPlayerKnowledge) {
            const cell = pmap[x][y];
            if (
                limitToPlayerKnowledge &&
                (cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) &&
                !(pmap[x][y].flags & TileFlag.VISIBLE)
            ) {
                return {
                    tFlags: cell.rememberedTerrainFlags,
                    tmFlags: cell.rememberedTMFlags,
                    cellFlags: cell.rememberedCellFlags,
                };
            }
            return {
                tFlags: terrainFlagsFn(pmap, { x, y }),
                tmFlags: terrainMechFlagsFn(pmap, { x, y }),
                cellFlags: cell.flags,
            };
        },
    };
}
