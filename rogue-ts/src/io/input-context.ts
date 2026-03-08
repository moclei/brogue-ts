/*
 *  io/input-context.ts — InputContext builder
 *  Port V2 — rogue-ts
 *
 *  Wires the unified InputContext (used by executeKeystroke and friends)
 *  to the domain modules.  Game actions that are fully ported are wired
 *  to real implementations; display, messaging, and not-yet-ported item
 *  commands are stubbed with no-ops.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { buildMovementContext, buildTravelContext } from "../movement.js";
import { buildItemHandlerContext } from "../items.js";
import { playerTurnEnded as playerTurnEndedFn } from "../turn.js";
import {
    playerMoves as playerMovesFn,
    playerRuns as playerRunsFn,
} from "../movement/player-movement.js";
import {
    travel as travelFn,
    travelRoute as travelRouteFn,
    useStairs as useStairsFn,
    proposeOrConfirmLocation as proposeOrConfirmLocationFn,
} from "../movement/travel-explore.js";
import { apply as applyFn } from "../items/item-handlers.js";
import { itemIsCarried as itemIsCarriedFn } from "../items/item-naming.js";
import {
    mapToWindowX, mapToWindowY,
    windowToMapX, windowToMapY,
    coordinatesAreInMap, nbDirs,
} from "../globals/tables.js";
import { distanceBetween } from "../monsters/monster-state.js";
import { wandDominate } from "../power/power-tables.js";
import { openPathBetween } from "../items/bolt-geometry.js";
import { negationWillAffectMonster } from "../items/bolt-helpers.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { monstersAreTeammates as monstersAreTeammatesFn } from "../monsters/monster-queries.js";
import { cellHasTerrainFlag as cellHasTerrainFlagFn } from "../state/helpers.js";
import { cellHasTMFlag as cellHasTMFlagFn } from "../state/helpers.js";
import { moveCursor as moveCursorFn, nextTargetAfter as nextTargetAfterFn } from "./cursor-move.js";
import { commitDraws } from "../platform.js";
import { EventType, AutoTargetMode, StatusEffect, ALL_ITEMS } from "../types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, MonsterBehaviorFlag, MessageFlag } from "../types/flags.js";
import type { InputContext } from "./input-keystrokes.js";
import type { PlayerRunContext } from "../movement/player-movement.js";
import type { Pos, RogueEvent } from "../types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function fakeEvent(): RogueEvent {
    return {
        eventType: EventType.EventError,
        param1: 0, param2: 0,
        controlKey: false, shiftKey: false,
    };
}


// =============================================================================
// buildInputContext — IO.c / RogueMain.c
// =============================================================================

/**
 * Build an InputContext backed by the current game state.
 *
 * Core game actions (movement, travel, apply) are wired to real domain
 * implementations.  Display, messaging, inventory commands, and debug
 * helpers are stubbed — they will be wired progressively in Phase 5.
 */
export function buildInputContext(): InputContext {
    const {
        rogue, player, pmap, packItems, floorItems, monsters,
        displayBuffer,
    } = getGameState();

    // Shared context factories (built fresh each call so they close
    // over the current mutable state snapshot).
    const moveCtx = () => buildMovementContext();
    const travelCtx = () => buildTravelContext();
    const itemCtx = () => buildItemHandlerContext();

    const cellHasTMFlag = (loc: Pos, flag: number) =>
        cellHasTMFlagFn(pmap, loc, flag);

    const monsterAtLoc = (loc: Pos) => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };

    const itemAtLoc = (loc: Pos) => {
        for (const it of floorItems) {
            if (it.loc.x === loc.x && it.loc.y === loc.y) return it;
        }
        return null;
    };

    return {
        // ── State ─────────────────────────────────────────────────────────────
        rogue,
        player,

        // ── Flags ─────────────────────────────────────────────────────────────
        DEBUG: false,
        serverMode: false,
        hasGraphics: false,
        graphicsMode: 0,
        nonInteractivePlayback: false,
        D_WORMHOLING: false,
        D_SAFETY_VISION: false,
        D_SCENT_VISION: false,
        displayedMessage: [],
        messagesUnconfirmed: 0,
        GAME_MODE_EASY: 1,

        // ── Coordinate helpers ────────────────────────────────────────────────
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        isPosInMap: (pos) => coordinatesAreInMap(pos.x, pos.y),
        mapToWindowX,
        mapToWindowY,
        windowToMap: (w) => ({ x: windowToMapX(w.windowX), y: windowToMapY(w.windowY) }),
        windowToMapX,
        distanceBetween,

        // ── Color / text helpers (stubs — wired in Phase 5) ──────────────────
        encodeMessageColor: () => "",
        strLenWithoutEscapes: (s) => s.length,
        printString: () => {},
        plotCharWithColor: () => {},

        // ── Messages (stubs — wired in Phase 5) ──────────────────────────────
        message: () => {},
        messageWithColor: () => {},
        temporaryMessage: () => {},
        confirmMessages: () => {},
        updateMessageDisplay: () => {},

        // ── Display buffers ───────────────────────────────────────────────────
        commitDraws,
        saveDisplayBuffer: () => ({ savedScreen: displayBuffer }),
        restoreDisplayBuffer: () => {},
        overlayDisplayBuffer: () => {},
        clearDisplayBuffer: () => {},
        createScreenDisplayBuffer: () => {
            // minimal blank buffer — real rendering wired in Phase 5
            return { cells: [] };
        },

        // ── Buttons (stubs — wired in Phase 5) ───────────────────────────────
        initializeButton: () => ({
            text: "", hotkey: [], x: 0, y: 0, width: 0, flags: 0,
        } as never),
        initializeButtonState: () => {},
        buttonInputLoop: async () => -1,

        // ── Text box (stubs — wired in Phase 5) ──────────────────────────────
        printTextBox: async () => -1,
        rectangularShading: () => {},

        // ── Events / timing ───────────────────────────────────────────────────
        // nextKeyOrMouseEvent is the synchronous fallback used inside
        // nextBrogueEvent's blocking loops.  On the browser platform all
        // actual events arrive through waitForEvent() before executeKeystroke
        // is called, so returning a no-op event here prevents infinite loops.
        nextKeyOrMouseEvent: () => fakeEvent(),
        pauseForMilliseconds: () => false,
        locIsInWindow: () => false,

        // ── Display (stubs — wired in Phase 5) ───────────────────────────────
        displayLevel: () => {},
        refreshSideBar: () => {},
        displayInventory: async () => {},
        displayMessageArchive: () => {},
        printHelpScreen: () => {},
        displayFeatsScreen: () => {},
        printDiscoveriesScreen: () => {},
        flashTemporaryAlert: () => {},
        displayMonsterFlashes: () => {},
        setGraphicsMode: (m) => m,

        // ── Game actions ──────────────────────────────────────────────────────
        playerMoves: (dir) => { playerMovesFn(dir, moveCtx()); },
        playerRuns: (dir) => { playerRunsFn(dir, moveCtx() as PlayerRunContext); },
        playerTurnEnded: () => { playerTurnEndedFn(); },
        autoRest: () => {},                         // stub — no MiscHelpersContext yet
        manualSearch: () => {},                     // stub — no MiscHelpersContext yet

        travel: (loc, autoConfirm) => travelFn(loc, autoConfirm, travelCtx()),
        travelRoute: (path, steps) => travelRouteFn(path, steps, travelCtx()),
        useStairs: (delta) => { useStairsFn(delta, travelCtx()); },

        apply: (item) => applyFn(item, itemCtx()),
        equip: async () => {},                      // stub — equip dialog not yet ported
        unequip: async () => {},                    // stub — unequip dialog not yet ported
        drop: async () => {},                       // stub — drop dialog not yet ported
        throwCommand: async () => {},               // stub — throw dialog not yet ported
        relabel: async () => {},                    // stub — relabel dialog not yet ported
        call: async () => {},                       // stub — call dialog not yet ported
        swapLastEquipment: () => {},                // stub — not yet ported
        enableEasyMode: () => {},                   // stub — LifecycleContext not wired
        saveGame: () => {},                         // stub — save system not yet ported
        gameOver: () => {},                         // stub — LifecycleContext not wired
        printSeed: () => {},                        // stub — not yet ported
        showCursor: () => {},                       // stub — cursor display (Phase 5)
        hideCursor: () => {},                       // stub — cursor display (Phase 5)
        exploreKey: async () => {},                 // stub — explore display hooks (Phase 5)
        autoPlayLevel: async () => {},              // stub — display hooks (Phase 5)
        takeScreenshot: () => false,                // stub — screenshot not yet ported
        dialogCreateItemOrMonster: () => {},        // stub — debug only

        // ── Item predicates ───────────────────────────────────────────────────
        itemIsCarried: (item) => itemIsCarriedFn(item, packItems),

        // ── Sidebar focus (stubs — wired in Phase 5) ─────────────────────────
        monsterAtLoc,
        itemAtLoc,
        canSeeMonster: (m) =>
            !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: () => false,           // stub — Phase 5
        cellHasTMFlag,
        printMonsterDetails: () => {},
        printFloorItemDetails: () => {},
        printLocationDescription: () => {},

        // ── Targeting / cursor ────────────────────────────────────────────────
        moveCursor: async (targetConfirmed, canceled, tabKey, cursorLoc, theEvent, state, colorsDance, keysMoveCursor, targetCanLeaveMap) =>
            moveCursorFn(
                targetConfirmed, canceled, tabKey, cursorLoc, theEvent, state,
                colorsDance, keysMoveCursor, targetCanLeaveMap,
                {
                    rogue,
                    nextKeyOrMouseEvent: () => ({ eventType: EventType.EventError, param1: 0, param2: 0, controlKey: false, shiftKey: false }),
                    createScreenDisplayBuffer: () => ({ cells: [] } as never),
                    clearDisplayBuffer: () => {},
                    saveDisplayBuffer: () => ({ savedScreen: displayBuffer }),
                    overlayDisplayBuffer: () => {},
                    restoreDisplayBuffer: () => {},
                    drawButtonsInState: () => {},
                    processButtonInput: async () => -1,
                    refreshSideBar: () => {},
                    pmapFlagsAt: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
                    canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                    monsterAtLoc: (loc) => {
                        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
                        for (const m of monsters) {
                            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
                        }
                        return null;
                    },
                    playerCanSeeOrSense: () => false,
                    cellHasTMFlag: (loc, flag) => cellHasTMFlagFn(pmap, loc, flag),
                    coordinatesAreInMap,
                    isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
                    mapToWindowX,
                    windowToMapX,
                    windowToMapY,
                },
            ),
        nextTargetAfter: (item, outLoc, currentLoc, mode, reverse) =>
            nextTargetAfterFn(item, outLoc, currentLoc, mode as AutoTargetMode, reverse, {
                player,
                rogue,
                boltCatalog,
                monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
                canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                openPathBetween: (from, to) => openPathBetween(from, to,
                    (loc) => cellHasTerrainFlagFn(pmap, loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
                distanceBetween,
                wandDominate: (hp, max) => wandDominate(hp, max),
                negationWillAffectMonster: (m, isBolt) =>
                    negationWillAffectMonster(m, isBolt, boltCatalog, mutationCatalog),
                isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
                posEq: (a, b) => a.x === b.x && a.y === b.y,
                monsterAtLoc: (loc) => {
                    if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
                    for (const m of monsters) {
                        if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
                    }
                    return null;
                },
                itemAtLoc,
            }),
        hilitePath: () => {},
        clearCursorPath: () => {},
        hiliteCell: () => {},
        refreshDungeonCell: () => {},

        // ── Pathing (stubs — wired in Phase 5) ───────────────────────────────
        allocGrid: () => [],
        freeGrid: () => {},
        fillGrid: () => {},
        dijkstraScan: () => {},
        populateCreatureCostMap: () => {},
        getPlayerPathOnMap: () => 0,
        processSnapMap: () => {},
        getClosestValidLocationOnMap: () => ({ x: 0, y: 0 }),
        diagonalBlocked: () => false,
        pmapFlagsAt: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
        terrainFlags: () => 0,
        terrainMechFlags: () => 0,

        // ── Recordings (stubs) ────────────────────────────────────────────────
        recordKeystroke: () => {},
        recallEvent: fakeEvent,
        executePlaybackInput: () => false,
        proposeOrConfirmLocation: (loc, failMsg) =>
            proposeOrConfirmLocationFn(loc, failMsg, travelCtx()),
        characterForbiddenInFilename: () => false,

        // ── Debug ─────────────────────────────────────────────────────────────
        safetyMap: null,
        displayGrid: () => {},
        displayLoops: () => {},
        displayChokeMap: () => {},
        displayMachines: () => {},
        displayWaypoints: () => {},

        // ── Constants ─────────────────────────────────────────────────────────
        AUTOTARGET_MODE_EXPLORE: AutoTargetMode.Explore,
        TM_LIST_IN_SIDEBAR: TerrainMechFlag.TM_LIST_IN_SIDEBAR,
        TM_PROMOTES_ON_PLAYER_ENTRY: TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY,
        T_OBSTRUCTS_PASSABILITY: TerrainFlag.T_OBSTRUCTS_PASSABILITY,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        MONST_ATTACKABLE_THRU_WALLS: MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS,
        STATUS_HALLUCINATING: StatusEffect.Hallucinating,
        STATUS_TELEPATHIC: StatusEffect.Telepathic,
        STATUS_SEARCHING: StatusEffect.Searching,
        ALL_ITEMS,
        REQUIRE_ACKNOWLEDGMENT: MessageFlag.REQUIRE_ACKNOWLEDGMENT,
        nbDirs: nbDirs as unknown as number[][],
    };
}
