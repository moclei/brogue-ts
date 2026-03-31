/*
 *  items/staff-targeting-wiring.ts — Target-selection and render context builders
 *  Port V2 — rogue-ts
 *
 *  Extracted from staff-wiring.ts to keep each file under the 600-line cap.
 *
 *  Exports:
 *    buildMonsterAtLocFn              — locate creature at map position
 *    buildStaffChooseTargetFn         — real chooseTarget (targeting cursor)
 *    buildStaffPlayerCancelsBlinkingFn — real playerCancelsBlinking
 *    buildStaffZapRenderContext        — ZapRenderContext with real lighting wired
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { waitForEvent, commitDraws, pauseAndCheckForEvent } from "../platform.js";
import { moveCursor as moveCursorFn } from "../io/cursor-move.js";
import type { MoveCursorContext } from "../io/cursor-move.js";
import {
    chooseTarget as chooseTargetFn,
    playerCancelsBlinking as playerCancelsBlinkingFn,
} from "./targeting.js";
import { openPathBetween } from "./bolt-geometry.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import {
    buildMessageFns,
    buildConfirmFn,
    buildRefreshDungeonCellFn,
    buildHiliteCellFn,
    buildGetCellAppearanceFn,
    buildRefreshSideBarFn,
} from "../io-wiring.js";
import { buildRefreshSideBarWithFocusFn, buildPrintLocationDescriptionFn } from "../io/sidebar-wiring.js";
import { buildBoltLightingFns } from "../vision-wiring.js";
import {
    plotCharWithColor as plotCharWithColorFn,
    mapToWindow,
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    applyOverlay as applyOverlayFn,
} from "../io/display.js";
import {
    drawButtonsInState as drawButtonsInStateFn,
    processButtonInput as processButtonInputFn,
} from "../io/buttons.js";
import { buildButtonContext, buildMessageContext } from "../ui.js";
import { black } from "../globals/colors.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { staffBlinkDistance as staffBlinkDistanceFn } from "../power/power-tables.js";
import { wandDominate as wandDominateFn } from "../power/power-tables.js";
import {
    canSeeMonster as canSeeMonsterFn,
    monstersAreTeammates as monstersAreTeammatesFn,
} from "../monsters/monster-queries.js";
import { negationWillAffectMonster as negationWillAffectMonsterFn } from "./bolt-helpers.js";
import { distanceBetween } from "../monsters/monster-state.js";
import { coordinatesAreInMap, mapToWindowX, windowToMapX, windowToMapY } from "../globals/tables.js";
import { displayCombatText as displayCombatTextFn } from "../io/messages.js";
import type { MessageContext as SyncMessageContext } from "../io/messages-state.js";
import { TileFlag, TerrainFlag } from "../types/flags.js";
import { AutoTargetMode, BoltType } from "../types/enums.js";
import type { Item, Pos, RogueEvent, Creature } from "../types/types.js";
import type { ChooseTargetContext } from "./targeting.js";
import type { ZapRenderContext } from "./zap-context.js";

// =============================================================================
// buildMonsterAtLocFn
// =============================================================================

export function buildMonsterAtLocFn(player: Creature, monsters: Creature[]) {
    return (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

// =============================================================================
// buildStaffChooseTargetFn — real chooseTarget wired for staff/wand use
// =============================================================================

/**
 * Returns a pre-bound chooseTarget for use in ItemHandlerContext.
 * Awaits waitForEvent() on each cursor move, driving the targeting loop.
 * Mirrors the wiring in buildThrowCommandFn (item-commands.ts).
 */
export function buildStaffChooseTargetFn() {
    return async (maxDistance: number, autoTargetMode: number, theItem: Item) => {
        const { rogue, player, pmap, monsters, floorItems, displayBuffer } = getGameState();
        const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
        const cellHasTerrainFlag = (loc: Pos, flags: number) =>
            cellHasTerrainFlagFn(pmap, loc, flags);
        const cellHasTMFlag = (loc: Pos, flags: number) =>
            cellHasTMFlagFn(pmap, loc, flags);
        const mqCtx = {
            player,
            cellHasTerrainFlag,
            cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers?.[3]),
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x: number, y: number) =>
                !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: rogue.playbackOmniscience,
        };
        const io = buildMessageFns();
        const refreshSideBarFn = buildRefreshSideBarWithFocusFn();
        const printLocDescFn = buildPrintLocationDescriptionFn();

        const chooseCtx: ChooseTargetContext = {
            rogue,
            player,
            pmap,
            boltCatalog,
            monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
            canSeeMonster: (m) => m === player ? true : canSeeMonsterFn(m, mqCtx),
            openPathBetween: (from, to) => openPathBetween(from, to,
                (loc) => cellHasTerrainFlagFn(pmap, loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
            distanceBetween,
            wandDominate: (hp, max) => wandDominateFn(hp, max),
            negationWillAffectMonster: (m, isBolt) =>
                negationWillAffectMonsterFn(m, isBolt, boltCatalog, mutationCatalog),
            isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
            posEq: (a, b) => a.x === b.x && a.y === b.y,
            monsterAtLoc,
            itemAtLoc: (loc) =>
                floorItems.find(i => i.loc.x === loc.x && i.loc.y === loc.y) ?? null,
            hiliteCell: buildHiliteCellFn(),
            refreshDungeonCell: buildRefreshDungeonCellFn(),
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            monsterIsHidden: () => false,  // permanent-defer — targeting cursor; all visible monsters are valid targets
            cellHasTerrainFlag,
            playerCanSeeOrSense: (x: number, y: number) =>
                !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
            cellHasTMFlag,
            refreshSideBar: refreshSideBarFn,
            printLocationDescription: printLocDescFn,
            confirmMessages: io.confirmMessages,
            moveCursor: async (
                tc: { value: boolean }, ca: { value: boolean }, tk: { value: boolean },
                tl: { value: Pos }, ev: { value: RogueEvent },
                state: unknown, colorsDance: boolean, keysMoveCursor: boolean,
                targetCanLeaveMap: boolean,
            ) => {
                let event: RogueEvent;
                try {
                    commitDraws();
                    event = await waitForEvent();
                } catch {
                    ca.value = true;
                    return true;
                }
                const btnCtx = buildButtonContext();
                const movCtx: MoveCursorContext = {
                    rogue,
                    nextKeyOrMouseEvent: () => event,
                    createScreenDisplayBuffer: () => createScreenDisplayBufferFn(),
                    clearDisplayBuffer: (dbuf) => clearDisplayBufferFn(dbuf),
                    saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
                    overlayDisplayBuffer: (dbuf) => { applyOverlayFn(displayBuffer, dbuf); },
                    restoreDisplayBuffer: (rbuf) => restoreDisplayBufferFn(displayBuffer, rbuf),
                    drawButtonsInState: (st, dbuf) => drawButtonsInStateFn(st, dbuf, btnCtx),
                    processButtonInput: async (st, ev) => {
                        const r = await processButtonInputFn(st, ev, btnCtx);
                        return r.chosenButton;
                    },
                    refreshSideBar: refreshSideBarFn,
                    pmapFlagsAt: (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
                    canSeeMonster: (m: Creature) =>
                        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                    monsterAtLoc,
                    playerCanSeeOrSense: (x: number, y: number) =>
                        !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
                    cellHasTMFlag,
                    coordinatesAreInMap,
                    isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                    mapToWindowX,
                    windowToMapX,
                    windowToMapY,
                };
                return moveCursorFn(
                    tc, ca, tk, tl, ev, state as never,
                    colorsDance, keysMoveCursor, targetCanLeaveMap, movCtx,
                );
            },
        };

        return chooseTargetFn(maxDistance, autoTargetMode as AutoTargetMode, theItem, chooseCtx);
    };
}

// =============================================================================
// buildStaffPlayerCancelsBlinkingFn
// =============================================================================

/**
 * Returns a pre-bound playerCancelsBlinking for use in ItemHandlerContext.
 */
export function buildStaffPlayerCancelsBlinkingFn() {
    return async (origin: Pos, target: Pos, maxDistance: number): Promise<boolean> => {
        const { rogue, player, pmap, monsters } = getGameState();
        const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
        const io = buildMessageFns();
        return playerCancelsBlinkingFn(origin, target, maxDistance, {
            rogue,
            player,
            pmap,
            boltCatalog,
            BOLT_BLINKING: BoltType.BLINKING,
            getLocationFlags: (x, y) => ({
                tFlags: pmap[x]?.[y]?.rememberedTerrainFlags ?? 0,
                tmFlags: pmap[x]?.[y]?.rememberedTMFlags ?? 0,
            }),
            cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
            monsterAtLoc,
            staffBlinkDistance: staffBlinkDistanceFn,
            message: (msg, flags) => { void io.message(msg, flags); },
            confirm: buildConfirmFn(),
        });
    };
}

// =============================================================================
// buildStaffZapRenderContext — ZapRenderContext with real lighting wired
// =============================================================================

/**
 * ZapRenderContext: bolt glyph animation + dynamic lighting wired.
 * Sidebar and dungeon cell refresh also wired.
 */
export function buildStaffZapRenderContext(): ZapRenderContext {
    const { displayBuffer } = getGameState();
    const getCellAppFn = buildGetCellAppearanceFn();
    const hiliteFn = buildHiliteCellFn();
    const lighting = buildBoltLightingFns();
    const refreshSideBar = buildRefreshSideBarFn();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    return {
        refreshSideBar: () => refreshSideBar(),
        displayCombatText: () => { void displayCombatTextFn(buildMessageContext() as unknown as SyncMessageContext); },
        refreshDungeonCell: (loc) => refreshDungeonCell(loc),
        backUpLighting: () => lighting.backUpLighting(),
        restoreLighting: () => lighting.restoreLighting(),
        demoteVisibility: () => lighting.demoteVisibility(),
        updateFieldOfViewDisplay: (dancing, refresh) => lighting.updateFieldOfViewDisplay(dancing, refresh),
        paintLight: (theLight, x, y) => lighting.paintLight(theLight, x, y),
        updateVision: (full) => lighting.updateVision(full),
        updateLighting: () => lighting.updateLighting(),
        hiliteCell: (x, y, color, strength, _saveBuf) => hiliteFn(x, y, color, strength, false),
        pauseAnimation: async (delay) => {
            commitDraws();
            return pauseAndCheckForEvent(delay);
        },
        getCellAppearance: (loc) => {
            const { glyph, foreColor, backColor } = getCellAppFn(loc);
            return { char: glyph, foreColor, backColor };
        },
        plotCharWithColor: (theChar, loc, foreColor, backColor) =>
            plotCharWithColorFn(theChar, mapToWindow(loc), foreColor, backColor, displayBuffer),
        colorMultiplierFromDungeonLight: () => ({ ...black, colorDances: false }),
    };
}
