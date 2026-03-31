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
    autoPlayLevel as autoPlayLevelFn,
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
import { canSeeMonster as canSeeMonsterFn, monstersAreTeammates as monstersAreTeammatesFn } from "../monsters/monster-queries.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    terrainMechFlags as terrainMechFlagsFn,
} from "../state/helpers.js";
import { autoRest as autoRestFn, manualSearch as manualSearchFn } from "../time/misc-helpers.js";
import { equipItem as equipItemFn, updateRingBonuses as updateRingBonusesFn, updateEncumbrance as updateEncumbranceFn } from "../items/item-usage.js";
import { buildEquipState, syncEquipBonuses, syncEquipState } from "../items/equip-helpers.js";
import { dijkstraScan as dijkstraScanFn } from "../dijkstra/dijkstra.js";
import {
    buildMessageFns,
    buildRefreshDungeonCellFn,
    buildHiliteCellFn,
    buildRefreshSideBarFn, buildConfirmFn, buildDisplayLevelFn,
} from "../io-wiring.js";
import { buildDebugOverlayFns } from "./debug-overlays.js";
import { buildSidebarContext, buildPrintLocationDescriptionFn } from "./sidebar-wiring.js";
import { printFloorItemDetails as printFloorItemDetailsFn } from "./sidebar-player.js";
import { printMonsterDetails as printMonsterDetailsFn } from "./sidebar-monsters.js";
import { enableEasyMode as enableEasyModeImpl, gameOver as gameOverImpl, type LifecycleContext } from "../game/game-lifecycle.js";
import { buildLifecycleContext } from "../lifecycle-gameover.js";
import {
    printHelpScreen as printHelpScreenFn,
    displayFeatsScreen as displayFeatsScreenFn,
    printDiscoveriesScreen as printDiscoveriesScreenFn,
} from "./overlay-screens.js";
import { displayMessageArchive as displayMessageArchiveFn } from "./messages.js";
import { encodeMessageColor, storeColorComponents as storeColorComponentsFn } from "./color.js";
import {
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    applyOverlay as applyOverlayFn,
    plotCharWithColor as plotCharWithColorFn,
    locIsInWindow as locIsInWindowFn,
} from "./display.js";
import { buttonInputLoop as buttonInputLoopFn, initializeButton as initializeButtonFn, initializeButtonState as initializeButtonStateFn } from "./buttons.js";
import { equip as equipFn, unequip as unequipFn, drop as dropFn, relabel as relabelFn } from "./inventory-actions.js";
import { buildButtonContext, buildInventoryContext, buildMessageContext } from "../ui.js";
import { displayInventory as displayInventoryFn } from "./inventory-display.js";
import { printTextBox as printTextBoxFn, rectangularShading as rectangularShadingFn } from "./inventory.js";
import { buildThrowCommandFn, buildCallCommandFn } from "../items/item-commands.js";
import { exploreKey as exploreKeyFn } from "./explore-wiring.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { moveCursor as moveCursorFn, nextTargetAfter as nextTargetAfterFn } from "./cursor-move.js";
import { commitDraws, waitForEvent, getGraphicsMode, setGraphicsMode, hasGraphics } from "../platform.js";
import { EventType, AutoTargetMode, StatusEffect, ALL_ITEMS } from "../types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, MonsterBehaviorFlag, MessageFlag } from "../types/flags.js";
import type { InputContext } from "./input-keystrokes.js";
import type { PlayerRunContext } from "../movement/player-movement.js";
import type { Pos, RogueEvent, Color } from "../types/types.js";
import { allocGrid as allocGridFn, fillGrid as fillGridFn } from "../grid/grid.js";
import {
    showCursor as showCursorFn,
    hideCursor as hideCursorFn,
    getPlayerPathOnMap as getPlayerPathOnMapFn,
    processSnapMap as processSnapMapFn,
    getClosestValidLocationOnMap as getClosestValidLocationOnMapFn,
    type TargetingContext,
} from "./targeting.js";
import { populateCreatureCostMap as populateCreatureCostMapFn } from "../movement/cost-maps-fov.js";
import { buildCostMapFovContext } from "../movement-cost-map.js";
import { diagonalBlocked as diagonalBlockedFn } from "../combat/combat-math.js";
import { strLenWithoutEscapes as strLenWithoutEscapesFn, printString as printStringFn } from "./text.js";
import { displayMonsterFlashes as displayMonsterFlashesFn, flashTemporaryAlert as flashTemporaryAlertFn } from "./effects-alerts.js";
import { buildMiscHelpersContext } from "./misc-helpers-context.js";
import { buildTargetingCtx, buildEffectsCtx } from "./input-context-helpers.js";

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
        displayBuffer, messageState,
    } = getGameState();

    // Shared context factories (built fresh each call so they close
    // over the current mutable state snapshot).
    const moveCtx = () => buildMovementContext();
    const printLocDesc = buildPrintLocationDescriptionFn();
    const travelCtx = () => buildTravelContext();
    const itemCtx = () => buildItemHandlerContext();

    const cellHasTMFlag = (loc: Pos, flag: number) =>
        cellHasTMFlagFn(pmap, loc, flag);

    const mqCtxInput = {
        player,
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[3]),   // DungeonLayer.Gas = 3
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

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

    // Overlay screens await a real user action (keypress or mouse click).
    // MouseEnteredCell (hover) must not dismiss the screen — C uses
    // waitForKeystrokeOrMouseClick() which ignores mouse-move events.
    const overlayWaitFn = async (): Promise<void> => {
        try {
            commitDraws();
            let ev: RogueEvent;
            do {
                ev = await waitForEvent();
            } while (ev.eventType === EventType.MouseEnteredCell);
        } catch {}
    };

    const refreshSideBarFn = buildRefreshSideBarFn();
    const displayLevelFn = buildDisplayLevelFn();
    const io = buildMessageFns();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const hiliteCellFn = buildHiliteCellFn();
    const itemCmdDeps = {
        message: (msg: string, flags: number) => io.message(msg, flags),
        messageWithColor: (msg: string, color: Readonly<Color> | null, flags: number) => io.messageWithColor(msg, color!, flags),
        confirmMessages: () => io.confirmMessages(),
    };

    const ctxSlice = { rogue, player, pmap, monsters, displayBuffer, messageState };
    const getTargetingCtx = () => buildTargetingCtx(ctxSlice, cellHasTMFlag, refreshDungeonCell);
    const getEffectsCtx = () => buildEffectsCtx(ctxSlice, mqCtxInput);

    return {
        // ── State ─────────────────────────────────────────────────────────────
        rogue,
        player,

        // ── Flags ─────────────────────────────────────────────────────────────
        DEBUG: false,
        serverMode: false,
        hasGraphics: hasGraphics(),
        graphicsMode: getGraphicsMode(),
        setGraphicsMode,
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

        // ── Color / text helpers ──────────────────────────────────────────────
        encodeMessageColor,
        strLenWithoutEscapes: strLenWithoutEscapesFn,
        printString: (str, x, y, foreColor, backColor, dbuf) =>
            printStringFn(str, x, y, foreColor, backColor, dbuf ?? displayBuffer),
        plotCharWithColor: (ch, pos, fg, bg) => { plotCharWithColorFn(ch, pos, fg, bg, displayBuffer); },

        // ── Messages ──────────────────────────────────────────────────────────
        message: (msg, flags) => io.message(msg, flags),
        messageWithColor: (msg, color, flags) => io.messageWithColor(msg, color, flags),
        temporaryMessage: (msg, flags) => io.temporaryMessage(msg, flags),
        confirmMessages: () => io.confirmMessages(),
        updateMessageDisplay: () => io.updateMessageDisplay(),

        // ── Display buffers ───────────────────────────────────────────────────
        commitDraws,
        saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBufferFn(displayBuffer, saved),
        overlayDisplayBuffer: (dbuf) => { applyOverlayFn(displayBuffer, dbuf); },
        clearDisplayBuffer: clearDisplayBufferFn,
        createScreenDisplayBuffer: createScreenDisplayBufferFn,

        // ── Buttons ───────────────────────────────────────────────────────────
        initializeButton: () => initializeButtonFn(),
        initializeButtonState: (state, buttons, count, winX, winY, winWidth, winHeight) => {
            const newState = initializeButtonStateFn(buttons, count, winX, winY, winWidth, winHeight);
            Object.assign(state, newState);
        },
        buttonInputLoop: async (buttons, count, winX, winY, winWidth, winHeight, _event) => {
            const result = await buttonInputLoopFn(buttons, count, winX, winY, winWidth, winHeight, buildButtonContext());
            return result.chosenButton;
        },

        // ── Text box ─────────────────────────────────────────────────────────
        printTextBox: async (text, x, y, width, foreColor, backColor, buttons, buttonCount) =>
            printTextBoxFn(text, x, y, width, foreColor, backColor, buildInventoryContext(), buttons, buttonCount),
        rectangularShading: (x, y, width, height, color, opacity, dbuf) =>
            rectangularShadingFn(x, y, width, height, color, opacity, dbuf, { storeColorComponents: storeColorComponentsFn }),

        // ── Events / timing ───────────────────────────────────────────────────
        // nextKeyOrMouseEvent: sync fallback; real events arrive via waitForEvent().
        nextKeyOrMouseEvent: () => fakeEvent(),
        nextBrogueEvent: async (_t, _c, _r) => { commitDraws(); return waitForEvent(); },
        pauseForMilliseconds: () => false,
        locIsInWindow: (pos) => locIsInWindowFn(pos),

        // ── Display ───────────────────────────────────────────────────────────
        displayLevel: displayLevelFn,
        refreshSideBar: (_x, _y, _justClearing) => refreshSideBarFn(),
        displayInventory: async (categoryMask, requiredFlags, forbiddenFlags, waitForAcknowledge, includeButtons) => {
            await displayInventoryFn(categoryMask, requiredFlags, forbiddenFlags, waitForAcknowledge, includeButtons,
                buildInventoryContext());
            // displayInventory restores the display buffer at the end, wiping any dungeon
            // changes from item effects (e.g. magic mapping). Re-render dungeon + messages.
            displayLevelFn();
            io.updateMessageDisplay();
        },
        displayMessageArchive: async () => { await displayMessageArchiveFn(buildMessageContext() as any); },
        printHelpScreen: () => printHelpScreenFn(overlayWaitFn),
        displayFeatsScreen: () => displayFeatsScreenFn(overlayWaitFn),
        printDiscoveriesScreen: () => printDiscoveriesScreenFn(overlayWaitFn),
        flashTemporaryAlert: async (msg, time) => {
            await flashTemporaryAlertFn(msg, time, getEffectsCtx());
        },
        displayMonsterFlashes: (flashAll) => {
            displayMonsterFlashesFn(flashAll, getEffectsCtx());
        },

        // ── Game actions ──────────────────────────────────────────────────────
        playerMoves: async (dir) => { await playerMovesFn(dir, moveCtx()); },
        playerRuns: async (dir) => { await playerRunsFn(dir, moveCtx() as PlayerRunContext); },
        playerTurnEnded: async () => { await playerTurnEndedFn(); },
        autoRest: async () => { await autoRestFn(buildMiscHelpersContext()); },
        manualSearch: async () => { await manualSearchFn(buildMiscHelpersContext()); },

        travel: (loc, autoConfirm) => travelFn(loc, autoConfirm, travelCtx()),
        travelRoute: (path, steps) => travelRouteFn(path, steps, travelCtx()),
        useStairs: (delta) => { useStairsFn(delta, travelCtx()); },

        apply: (item) => applyFn(item, itemCtx()),
        equip: (item) => equipFn(item),
        unequip: (item) => unequipFn(item),
        drop: (item) => dropFn(item),
        throwCommand: buildThrowCommandFn(itemCmdDeps),
        relabel: (item) => relabelFn(item),
        call: buildCallCommandFn(itemCmdDeps),
        async swapLastEquipment() {
            // C: Items.c:6441 — swapLastEquipment()
            const io = buildMessageFns();
            if (!rogue.swappedIn || !rogue.swappedOut) {
                io.confirmMessages();
                await io.message("You have nothing to swap.", 0);
                return;
            }
            const s = buildEquipState();
            const swapped = equipItemFn(rogue.swappedOut, false, rogue.swappedIn, {
                state: s,
                message: (text, _requireAck) => io.message(text, 0),
                itemName: (_i, _details, _article) => "item",
                updateRingBonuses: () => { updateRingBonusesFn(s); syncEquipBonuses(s); },
                updateEncumbrance: () => updateEncumbranceFn(s),
            });
            if (!swapped) return;  // cursed — can't swap
            syncEquipState(s);
            const tmp = rogue.swappedIn;
            rogue.swappedIn = rogue.swappedOut;
            rogue.swappedOut = tmp;
            await playerTurnEndedFn();
        },
        enableEasyMode: () => enableEasyModeImpl({ ...buildLifecycleContext(), confirm: buildConfirmFn() } as unknown as LifecycleContext),
        saveGame: () => {},                         // DEFER: port-v2-persistence
        gameOver: (killedBy, useCustomPhrasing) => gameOverImpl(buildLifecycleContext(), killedBy, useCustomPhrasing),
        printSeed: () => { buildMessageFns().message(`Seed: ${rogue.seed}`, 0); },
        showCursor: () => showCursorFn({ rogue, player } as unknown as TargetingContext),
        hideCursor: () => hideCursorFn({ rogue, player } as unknown as TargetingContext),
        exploreKey: (ctrl) => exploreKeyFn(ctrl, travelCtx(), io.message, rogue, player.loc),
        autoPlayLevel: async (ctrl) => { await autoPlayLevelFn(ctrl, travelCtx()); },
        takeScreenshot: () => false,                // stub — screenshot not yet ported
        dialogCreateItemOrMonster: () => {},        // permanent-defer — debug wizard; WizardContext wiring is low priority

        // ── Item predicates ───────────────────────────────────────────────────
        itemIsCarried: (item) => itemIsCarriedFn(item, packItems),

        monsterAtLoc,
        itemAtLoc,
        canSeeMonster: (m) =>
            !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
        cellHasTMFlag,
        printMonsterDetails: (monst) => printMonsterDetailsFn(monst, buildSidebarContext()),
        printFloorItemDetails: (item) => printFloorItemDetailsFn(item, buildSidebarContext()),
        printLocationDescription: printLocDesc,

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
                    canSeeMonster: (m) => canSeeMonsterFn(m, mqCtxInput),
                    monsterAtLoc: (loc) => {
                        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
                        for (const m of monsters) {
                            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
                        }
                        return null;
                    },
                    playerCanSeeOrSense: (x, y) =>
                        !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
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
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtxInput),
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
        hilitePath: (path, steps, unhilite) => {
            if (unhilite) {
                for (let i = 0; i < steps; i++) {
                    if (pmap[path[i].x]?.[path[i].y]) pmap[path[i].x][path[i].y].flags &= ~TileFlag.IS_IN_PATH;
                    refreshDungeonCell(path[i]);
                }
            } else {
                for (let i = 0; i < steps; i++) {
                    if (pmap[path[i].x]?.[path[i].y]) pmap[path[i].x][path[i].y].flags |= TileFlag.IS_IN_PATH;
                    refreshDungeonCell(path[i]);
                }
            }
        },
        clearCursorPath: () => {
            if (!rogue.playbackMode) {
                for (let i = 1; i < DCOLS; i++) {
                    for (let j = 1; j < DROWS; j++) {
                        if (pmap[i]?.[j]?.flags & TileFlag.IS_IN_PATH) {
                            pmap[i][j].flags &= ~TileFlag.IS_IN_PATH;
                            refreshDungeonCell({ x: i, y: j });
                        }
                    }
                }
            }
        },
        hiliteCell: (x, y, color, opacity, distinctColors) =>
            hiliteCellFn(x, y, color, opacity, distinctColors),
        refreshDungeonCell: (loc) => refreshDungeonCell(loc),

        // ── Pathing ───────────────────────────────────────────────────────────
        allocGrid: () => allocGridFn(),
        freeGrid: () => {},
        fillGrid: (grid, value) => fillGridFn(grid, value),
        dijkstraScan: (distanceMap, costMap, useDiagonals) =>
            dijkstraScanFn(distanceMap, costMap, useDiagonals),
        populateCreatureCostMap: (costMap, creature) =>
            populateCreatureCostMapFn(costMap, creature, buildCostMapFovContext()),
        getPlayerPathOnMap: (path, playerPathingMap, origin) =>
            getPlayerPathOnMapFn(path, playerPathingMap, origin, getTargetingCtx()),
        processSnapMap: (cursorSnapMap) =>
            processSnapMapFn(cursorSnapMap, getTargetingCtx()),
        getClosestValidLocationOnMap: (snapMap, x, y) =>
            getClosestValidLocationOnMapFn(snapMap, x, y),
        diagonalBlocked: (fromX, fromY, toX, toY, _limitToPlayerKnowledge) =>
            diagonalBlockedFn(fromX, fromY, toX, toY, (pos) => terrainFlagsFn(pmap, pos)),
        pmapFlagsAt: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
        terrainFlags: (loc) => terrainFlagsFn(pmap, loc),
        terrainMechFlags: (loc) => terrainMechFlagsFn(pmap, loc),

        // ── Recordings (stubs) ────────────────────────────────────────────────
        recordKeystroke: () => {},              // DEFER: port-v2-persistence
        recallEvent: fakeEvent,
        executePlaybackInput: () => false,      // DEFER: port-v2-persistence (playback layer)
        proposeOrConfirmLocation: (loc, failMsg) =>
            proposeOrConfirmLocationFn(loc, failMsg, travelCtx()),
        characterForbiddenInFilename: () => false, // DEFER: port-v2-persistence (filename validation for saves)

        // ── Debug ─────────────────────────────────────────────────────────────
        safetyMap: null,
        ...buildDebugOverlayFns(io.temporaryMessage, buildDisplayLevelFn()),

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
