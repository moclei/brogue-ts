/*
 *  io/input-context-helpers.ts — Sub-context builders for buildInputContext
 *  Port V2 — rogue-ts
 *
 *  Extracted from input-context.ts to keep that file under 600 lines.
 *  Provides TargetingContext and EffectsContext factories used by
 *  processSnapMap, getPlayerPathOnMap, flashTemporaryAlert,
 *  and displayMonsterFlashes.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Pcell, ScreenDisplayBuffer, MessageState, Color, PlayerCharacter } from "../types/types.js";
import type { TargetingContext } from "./targeting.js";
import type { EffectsContext } from "./effects.js";
import type { TravelExploreContext } from "../movement/travel-explore.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import { nbDirs, coordinatesAreInMap, mapToWindowX, windowToMapX, windowToMapY } from "../globals/tables.js";
import {
    terrainFlags as terrainFlagsFn,
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import { monsterAvoids as monsterAvoidsFn } from "../monsters/monster-state.js";
import { canPass as canPassFn } from "../monsters/monster-movement.js";
import { monstersAreEnemies as monstersAreEnemiesFn } from "../monsters/monster-queries.js";
import { canSeeMonster as canSeeMonsterFn } from "../monsters/monster-queries.js";
import { buildMonsterStateContext } from "../monsters.js";
import { nextStep as nextStepFn } from "../movement/travel-explore.js";
import { dijkstraScan as dijkstraScanFn, calculateDistances as calculateDistancesFn } from "../dijkstra/dijkstra.js";
import { allocGrid as allocGridFn, fillGrid as fillGridFn } from "../grid/grid.js";
import { populateCreatureCostMap as populateCreatureCostMapFn } from "../movement/cost-maps-fov.js";
import { buildCostMapFovContext } from "../movement-cost-map.js";
import { diagonalBlocked as diagonalBlockedFn } from "../combat/combat-math.js";
import {
    buildGetCellAppearanceFn,
    buildRefreshDungeonCellFn,
    buildHiliteCellFn,
} from "../io-wiring.js";
import {
    applyColorAverage as applyColorAverageFn,
    bakeColor as bakeColorFn,
    applyColorAugment as applyColorAugmentFn,
    separateColors as separateColorsFn,
} from "./color.js";
import {
    applyOverlay as applyOverlayFn,
    plotCharWithColor as plotCharWithColorFn,
    mapToWindow as mapToWindowFn,
} from "./display.js";
import {
    printString as printStringFn,
    strLenWithoutEscapes as strLenWithoutEscapesFn,
} from "./text.js";
import { commitDraws, pauseAndCheckForEvent } from "../platform.js";

// =============================================================================
// Types
// =============================================================================

/** Slice of game state used by the context builders here. */
export interface InputContextSlice {
    rogue: PlayerCharacter;
    player: Creature;
    pmap: Pcell[][];
    monsters: Creature[];
    displayBuffer: ScreenDisplayBuffer;
    messageState: MessageState;
}

// =============================================================================
// buildTargetingCtx — for processSnapMap / getPlayerPathOnMap
// =============================================================================

/**
 * Build a minimal TargetingContext backed by live game state.
 * Mirrors buildPathTracingCtx in hover-wiring.ts.
 */
export function buildTargetingCtx(
    s: InputContextSlice,
    cellHasTMFlag: (loc: Pos, flag: number) => boolean,
    refreshDungeonCell: (loc: Pos) => void,
): TargetingContext {
    const { rogue, player, pmap, monsters, displayBuffer } = s;
    const terrainFlagCheck = (pos: Pos, flags: number): boolean =>
        !!(terrainFlagsFn(pmap, pos) & flags);
    // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
    const monsterAtLocT = (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        return monsters.find(
            m => m.loc.x === loc.x && m.loc.y === loc.y &&
                !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
        ) ?? null;
    };
    const monsterStateCtx = buildMonsterStateContext();
    const nextStepCtx = {
        nbDirs,
        coordinatesAreInMap,
        monsterAtLoc: monsterAtLocT,
        monsterAvoids: (m: Creature, loc: Pos) =>
            monsterAvoidsFn(m, loc, monsterStateCtx),
        canPass: (mover: Creature, blocker: Creature) =>
            canPassFn(mover, blocker, player, terrainFlagCheck),
        monstersAreTeammates: (a: Creature, b: Creature) =>
            a.leader === b || b.leader === a,
        monstersAreEnemies: (a: Creature, b: Creature) =>
            monstersAreEnemiesFn(a, b, player, terrainFlagCheck),
        diagonalBlocked: (x1: number, y1: number, x2: number, y2: number, _lim: boolean) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos: Pos) => terrainFlagsFn(pmap, pos)),
        knownToPlayerAsPassableOrSecretDoor(pos: Pos) {
            const cell = pmap[pos.x]?.[pos.y];
            if (!cell) return false;
            if (!(cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))) return false;
            if (cell.rememberedTerrainFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) {
                return !!(cell.rememberedTMFlags & TerrainMechFlag.TM_IS_SECRET);
            }
            return true;
        },
    } as unknown as TravelExploreContext;
    const costMapFovCtx = buildCostMapFovContext();
    return {
        rogue: {
            playbackMode: rogue.playbackMode,
            cursorMode: rogue.cursorMode,
            cursorPathIntensity: rogue.cursorPathIntensity,
            cursorLoc: rogue.cursorLoc,
        },
        player,
        pmap,
        nextStep: (map: number[][], at: Pos, monst: Creature | null, pref: boolean) =>
            nextStepFn(map, at, monst, pref, nextStepCtx),
        allocGrid: () => allocGridFn(),
        fillGrid: fillGridFn,
        dijkstraScan: dijkstraScanFn,
        populateCreatureCostMap: (costMap: number[][], monst: Creature) =>
            populateCreatureCostMapFn(costMap, monst, costMapFovCtx),
        cellHasTMFlag,
        refreshDungeonCell,
        // Unused by processSnapMap/getPlayerPathOnMap, stubbed:
        getCellAppearance: buildGetCellAppearanceFn(),
        applyColorAugment: applyColorAugmentFn,
        separateColors: separateColorsFn,
        plotCharWithColor: (ch: number, wp: { windowX: number; windowY: number }, fg: unknown, bg: unknown) =>
            plotCharWithColorFn(ch as never, wp, fg as never, bg as never, displayBuffer),
        mapToWindow: mapToWindowFn,
    } as unknown as TargetingContext;
}

// =============================================================================
// buildEffectsCtx — for flashTemporaryAlert / displayMonsterFlashes
// =============================================================================

/**
 * Minimal EffectsContext backed by live game state.
 */
export function buildEffectsCtx(
    s: InputContextSlice,
    mqCtx: { player: Creature; cellHasTerrainFlag: (pos: Pos, flags: number) => boolean; cellHasGas: (loc: Pos) => boolean; playerCanSee: (x: number, y: number) => boolean; playerCanDirectlySee: (x: number, y: number) => boolean; playbackOmniscience: boolean },
): EffectsContext {
    const { rogue, player, pmap, monsters, displayBuffer, messageState } = s;
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const hiliteCellFn = buildHiliteCellFn();
    const calcDistCtx = {
        cellHasTerrainFlag: (pos: Pos, f: number) => cellHasTerrainFlagFn(pmap, pos, f),
        cellHasTMFlag: (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
        monsterAtLoc: (loc: Pos): Creature | null => {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            return monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
        },
        monsterAvoids: (m: Creature, loc: Pos) => monsterAvoidsFn(m, loc, buildMonsterStateContext()),
        discoveredTerrainFlagsAtLoc: () => 0,   // permanent-defer — funkyFade doesn't need secret terrain
        isPlayer: (m: Creature) => m === player,
        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
    };
    return {
        rogue: {
            playbackMode: rogue.playbackMode,
            playbackFastForward: rogue.playbackFastForward,
            playbackPaused: rogue.playbackPaused,
            playbackDelayPerTurn: rogue.playbackDelayPerTurn,
            autoPlayingLevel: rogue.autoPlayingLevel,
            blockCombatText: rogue.blockCombatText,
            creaturesWillFlashThisTurn: rogue.creaturesWillFlashThisTurn,
        },
        player,
        displayBuffer,
        applyColorAverage: applyColorAverageFn,
        applyColorAugment: applyColorAugmentFn,
        bakeColor: bakeColorFn,
        separateColors: separateColorsFn,
        colorFromComponents: (components: readonly number[]) => ({
            r: components[0] ?? 0, g: components[1] ?? 0, b: components[2] ?? 0,
            variance: { r: 0, g: 0, b: 0 },
        }),
        getCellAppearance: buildGetCellAppearanceFn(),
        plotCharWithColor: (ch: number, wp: { windowX: number; windowY: number }, fg: Color, bg: Color) =>
            plotCharWithColorFn(ch as never, wp, fg, bg, displayBuffer),
        refreshDungeonCell,
        hiliteCell: hiliteCellFn,
        overlayDisplayBuffer: (dbuf: ScreenDisplayBuffer) => { applyOverlayFn(displayBuffer, dbuf); },
        mapToWindow: mapToWindowFn,
        windowToMapX,
        windowToMapY,
        mapToWindowX,
        strLenWithoutEscapes: strLenWithoutEscapesFn,
        printString: (text: string, x: number, y: number, fg: Readonly<Color>, bg: Readonly<Color>, dbuf: ScreenDisplayBuffer | null) => {
            printStringFn(text, x, y, fg, bg, dbuf ?? displayBuffer);
            return 0;
        },
        pauseBrogue: (milliseconds: number) => pauseAndCheckForEvent(milliseconds),
        pauseAnimation: (milliseconds: number) => {
            pauseAndCheckForEvent(milliseconds);
            return false;
        },
        commitDraws,
        allocGrid: allocGridFn,
        fillGrid: fillGridFn,
        calculateDistances: (distanceMap: number[][], x: number, y: number, blockingTerrainFlags: number, _blockingCellFlags: number, eightWay: boolean, _respectTravel: boolean) =>
            calculateDistancesFn(distanceMap, x, y, blockingTerrainFlags, null, true, eightWay, calcDistCtx),
        iterateCreatures: () => monsters.filter(
            m => !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
        ),
        canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
        displayedMessage: messageState.displayedMessage,
    } as unknown as EffectsContext;
}
