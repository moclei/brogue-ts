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

import { getGameState, getScentMap } from "../core.js";
import { buildMovementContext, buildTravelContext } from "../movement.js";
import { buildItemHandlerContext } from "../items.js";
import { buildMonsterStateContext } from "../monsters.js";
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
    posNeighborInDirection,
} from "../globals/tables.js";
import {
    distanceBetween,
    monsterAvoids as monsterAvoidsFn,
} from "../monsters/monster-state.js";
import { wandDominate } from "../power/power-tables.js";
import { openPathBetween } from "../items/bolt-geometry.js";
import { negationWillAffectMonster } from "../items/bolt-helpers.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { monstersAreTeammates as monstersAreTeammatesFn, monsterRevealed as monsterRevealedFn } from "../monsters/monster-queries.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    terrainMechFlags as terrainMechFlagsFn,
} from "../state/helpers.js";
import { search as searchFn } from "../movement/item-helpers.js";
import { discover as discoverFn } from "../movement/map-queries.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "../architect/machines.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { ringTable } from "../globals/item-catalog.js";
import { randPercent, randClumpedRange } from "../math/rng.js";
import { autoRest as autoRestFn, manualSearch as manualSearchFn } from "../time/misc-helpers.js";
import { equipItem as equipItemFn, updateRingBonuses as updateRingBonusesFn, updateEncumbrance as updateEncumbranceFn } from "../items/item-usage.js";
import { buildEquipState, syncEquipBonuses, syncEquipState } from "../items/equip-helpers.js";
import type { MiscHelpersContext } from "../time/misc-helpers.js";
import type { ItemHelperContext } from "../movement/item-helpers.js";
import { dijkstraScan as dijkstraScanFn } from "../dijkstra/dijkstra.js";
import {
    buildMessageFns,
    buildRefreshDungeonCellFn,
    buildHiliteCellFn,
    buildRefreshSideBarFn, buildConfirmFn, buildDisplayLevelFn,
} from "../io-wiring.js";
import { buildDebugOverlayFns } from "./debug-overlays.js";
import { buildSidebarContext, buildPrintLocationDescriptionFn } from "./sidebar-wiring.js";
import { printMonsterDetails as printMonsterDetailsFn } from "./sidebar-monsters.js";
import { enableEasyMode as enableEasyModeImpl, gameOver as gameOverImpl, type LifecycleContext } from "../game/game-lifecycle.js";
import { buildLifecycleContext } from "../lifecycle-gameover.js";
import {
    printHelpScreen as printHelpScreenFn,
    displayFeatsScreen as displayFeatsScreenFn,
    printDiscoveriesScreen as printDiscoveriesScreenFn,
} from "./overlay-screens.js";
import { displayMessageArchive as displayMessageArchiveFn } from "./messages.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "../light/light.js";
import { encodeMessageColor } from "./color.js";
import {
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    applyOverlay as applyOverlayFn,
    plotCharWithColor as plotCharWithColorFn,
} from "./display.js";
import { buttonInputLoop as buttonInputLoopFn, initializeButton as initializeButtonFn } from "./buttons.js";
import { equip as equipFn, unequip as unequipFn, drop as dropFn, relabel as relabelFn } from "./inventory-actions.js";
import { buildButtonContext, buildInventoryContext, buildMessageContext } from "../ui.js";
import { displayInventory as displayInventoryFn } from "./inventory-display.js";
import { buildThrowCommandFn, buildCallCommandFn } from "../items/item-commands.js";
import { exploreKey as exploreKeyFn } from "./explore-wiring.js";
import { TURNS_FOR_FULL_REGEN, REST_KEY, SEARCH_KEY, DCOLS, DROWS } from "../types/constants.js";
import { moveCursor as moveCursorFn, nextTargetAfter as nextTargetAfterFn } from "./cursor-move.js";
import { commitDraws, waitForEvent, getGraphicsMode, setGraphicsMode, hasGraphics } from "../platform.js";
import { EventType, AutoTargetMode, StatusEffect, ALL_ITEMS } from "../types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, MonsterBehaviorFlag, MessageFlag } from "../types/flags.js";
import type { InputContext } from "./input-keystrokes.js";
import type { PlayerRunContext } from "../movement/player-movement.js";
import type { Pos, RogueEvent, Color } from "../types/types.js";
import { INVALID_POS } from "../types/types.js";

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
// buildMiscHelpersContext — Time.c helpers (autoRest, manualSearch)
// =============================================================================

/**
 * Build a MiscHelpersContext backed by the current game state.
 *
 * Only autoRest and manualSearch are called from buildInputContext; the
 * remaining fields (rechargeItemsIncrementally, monsterEntersLevel, etc.)
 * are stubbed — they are not invoked from this context.
 */
function buildMiscHelpersContext(): MiscHelpersContext {
    const { rogue, player, pmap, monsters, floorItems, packItems, levels } = getGameState();
    const io = buildMessageFns();
    const refreshDungeonCell = buildRefreshDungeonCellFn();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);
    const monsterAtLoc = (loc: Pos) => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        return monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
    };
    const spawnFeature = (x: number, y: number, feat: unknown, rc: boolean, ab: boolean) =>
        spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, rc, ab);

    // Minimal ItemHelperContext for the search() call in manualSearch
    const searchCtx: ItemHelperContext = {
        pmap,
        player,
        rogue: { playbackOmniscience: rogue.playbackOmniscience },
        tileCatalog: tileCatalog as unknown as ItemHelperContext["tileCatalog"],
        initializeItem: () => ({} as never),
        itemName: () => {},
        describeHallucinatedItem: () => {},
        removeItemFromChain: () => false,
        deleteItem: () => {},
        monsterAtLoc,
        promoteTile: () => {},
        messageWithColor: () => {},
        itemMessageColor: null,
        packItems,
        floorItems,
        cellHasTerrainFlag,
        cellHasTMFlag,
        coordinatesAreInMap,
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        distanceBetween,
        discover: (x, y) => {
            discoverFn(x, y, {
                pmap,
                player,
                rogue: {
                    scentTurnNumber: rogue.scentTurnNumber,
                    disturbed: rogue.disturbed,
                    automationActive: rogue.automationActive,
                },
                scentMap: getScentMap() ?? ([] as number[][]),
                terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
                terrainMechFlags: (pos) => terrainMechFlagsFn(pmap, pos),
                cellHasTerrainFlag,
                cellHasTMFlag,
                coordinatesAreInMap,
                playerCanSee: (x2, y2) => !!(pmap[x2]?.[y2]?.flags & TileFlag.VISIBLE),
                monsterAtLoc,
                canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                monsterRevealed: (m) => monsterRevealedFn(m, player),
                spawnDungeonFeature: spawnFeature as never,
                refreshDungeonCell,
                dungeonFeatureCatalog,
                nbDirs: nbDirs as [number, number][],
            });
        },
        randPercent,
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        keyOnTileAt: () => null,
    };

    return {
        player,
        rogue: {
            depthLevel: rogue.depthLevel,
            wisdomBonus: rogue.wisdomBonus,
            awarenessBonus: rogue.awarenessBonus,
            justRested: rogue.justRested,
            justSearched: rogue.justSearched,
            automationActive: rogue.automationActive,
            disturbed: rogue.disturbed,
            yendorWarden: rogue.yendorWarden ?? null,
            weapon: rogue.weapon ?? null,
            armor: rogue.armor ?? null,
            ringLeft: rogue.ringLeft ?? null,
            ringRight: rogue.ringRight ?? null,
            upLoc: rogue.upLoc,
            downLoc: rogue.downLoc,
            monsterSpawnFuse: rogue.monsterSpawnFuse,
        },
        monsters,
        levels,
        pmap,
        packItems,

        DCOLS,
        DROWS,
        FP_FACTOR: 1000,                         // stub — not used by autoRest/manualSearch
        TURNS_FOR_FULL_REGEN,
        deepestLevel: rogue.deepestLevel,
        INVALID_POS,

        randClumpedRange: (min, max, clumps) => randClumpedRange(min, max, clumps),
        rand_percent: (pct) => randPercent(pct),
        max: Math.max,
        clamp: (val, min, max) => Math.min(Math.max(val, min), max),
        ringWisdomMultiplier: (val) => val,       // stub — not used by autoRest/manualSearch
        charmRechargeDelay: () => 0,              // stub — not used by autoRest/manualSearch

        itemName: () => "",                       // stub
        identify: () => {},                       // stub
        updateIdentifiableItems: () => {},        // stub
        numberOfMatchingPackItems: () => 0,       // stub

        message: io.message,
        messageWithColor: (msg, color, flags) =>
            io.messageWithColor(msg, color as Readonly<Color>, flags),

        monsterAvoids: (monst, loc) =>
            monsterAvoidsFn(monst, loc, buildMonsterStateContext()),
        canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName: () => "",                    // stub
        messageColorFromVictim: () => null,       // stub
        inflictDamage: () => false,               // stub
        killCreature: () => {},                   // stub
        demoteMonsterFromLeadership: () => {},    // stub
        restoreMonster: () => {},                 // stub
        removeCreature: () => {},                 // stub
        prependCreature: () => {},                // stub
        avoidedFlagsForMonster: () => 0,          // stub
        getQualifyingPathLocNear: (loc) => loc,   // stub

        posNeighborInDirection,
        cellHasTerrainFlag,
        pmapAt: (loc) => pmap[loc.x][loc.y],
        terrainFlags: (loc) => terrainFlagsFn(pmap, loc),
        refreshDungeonCell,
        search: (strength) => { searchFn(strength, searchCtx); },
        recordKeystroke: () => {},                // stub — persistence layer
        playerTurnEnded: async () => { await playerTurnEndedFn(); },
        pauseAnimation: () => false,              // stub — Phase 3b

        ringTable: ringTable as unknown as Array<{ identified: boolean }>,
        displayLevel: buildDisplayLevelFn(),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        itemMessageColor: null,
        red: null,
        REST_KEY: String.fromCharCode(REST_KEY),
        SEARCH_KEY: String.fromCharCode(SEARCH_KEY),
        PAUSE_BEHAVIOR_DEFAULT: 0,
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
    const printLocDesc = buildPrintLocationDescriptionFn();
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
        strLenWithoutEscapes: (s) => s.length,
        printString: () => {},
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
        initializeButtonState: () => {},                      // stub — mutating signature differs from domain
        buttonInputLoop: async (buttons, count, winX, winY, winWidth, winHeight, _event) => {
            const result = await buttonInputLoopFn(buttons, count, winX, winY, winWidth, winHeight, buildButtonContext());
            return result.chosenButton;
        },

        // ── Text box (stubs — wired in Phase 5) ──────────────────────────────
        printTextBox: async () => -1,
        rectangularShading: () => {},

        // ── Events / timing ───────────────────────────────────────────────────
        // nextKeyOrMouseEvent: sync fallback; real events arrive via waitForEvent().
        nextKeyOrMouseEvent: () => fakeEvent(),
        nextBrogueEvent: async (_t, _c, _r) => { commitDraws(); return waitForEvent(); },
        pauseForMilliseconds: () => false,
        locIsInWindow: () => false,

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        displayMessageArchive: async () => { await displayMessageArchiveFn(buildMessageContext() as any); },
        printHelpScreen: () => printHelpScreenFn(overlayWaitFn),
        displayFeatsScreen: () => displayFeatsScreenFn(overlayWaitFn),
        printDiscoveriesScreen: () => printDiscoveriesScreenFn(overlayWaitFn),
        flashTemporaryAlert: () => {},
        displayMonsterFlashes: () => {},

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
        saveGame: () => {},                         // stub — save system not yet ported
        gameOver: (killedBy, useCustomPhrasing) => gameOverImpl(buildLifecycleContext(), killedBy, useCustomPhrasing),
        printSeed: () => { buildMessageFns().message(`Seed: ${rogue.seed}`, 0); },
        showCursor: () => {},                       // stub — cursor display (Phase 5)
        hideCursor: () => {},                       // stub — cursor display (Phase 5)
        exploreKey: (ctrl) => exploreKeyFn(ctrl, travelCtx(), io.message, rogue, player.loc),
        autoPlayLevel: async (ctrl) => { await autoPlayLevelFn(ctrl, travelCtx()); },
        takeScreenshot: () => false,                // stub — screenshot not yet ported
        dialogCreateItemOrMonster: () => {},        // stub — debug only

        // ── Item predicates ───────────────────────────────────────────────────
        itemIsCarried: (item) => itemIsCarriedFn(item, packItems),

        monsterAtLoc,
        itemAtLoc,
        canSeeMonster: (m) =>
            !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: () => false,           // stub — sensory detail
        cellHasTMFlag,
        printMonsterDetails: (monst) => printMonsterDetailsFn(monst, buildSidebarContext()),
        printFloorItemDetails: () => {},            // stub — itemDetails not yet ported
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

        // ── Pathing (stubs — wired in Phase 5) ───────────────────────────────
        allocGrid: () => [],
        freeGrid: () => {},
        fillGrid: () => {},
        dijkstraScan: (distanceMap, costMap, useDiagonals) =>
            dijkstraScanFn(distanceMap, costMap, useDiagonals),
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
