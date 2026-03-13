/*
 *  lifecycle-gameover.ts — buildLifecycleContext for game-lifecycle.ts screens
 *  Port V2 — rogue-ts
 *
 *  Provides buildLifecycleContext() — the DI context for gameOver() and victory()
 *  in game/game-lifecycle.ts. Extracted from lifecycle.ts to keep that file under
 *  the 600-line limit.
 *
 *  Not currently called in the main game flow (showGameEndScreen in menus.ts is
 *  used instead), but wired for future use.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "./core.js";
import { EventType, DisplayGlyph } from "./types/enums.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { featCatalog } from "./globals/feat-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { mapToWindowX, mapToWindowY } from "./globals/tables.js";
import {
    black, white, gray, yellow, lightBlue, badMessageColor,
    itemMessageColor, advancementMessageColor, superVictoryColor,
} from "./globals/colors.js";
import { blackOutScreen, clearDisplayBuffer, plotCharToBuffer } from "./io/display.js";
import { encodeMessageColor } from "./io/color.js";
import {
    getCellAppearance,
    refreshDungeonCell as refreshDungeonCellFn,
    displayLevel as displayLevelFn,
} from "./io/cell-appearance.js";
import { identify } from "./items/item-naming.js";
import { numberOfMatchingPackItems as packCount } from "./items/item-inventory.js";
import { buildMessageFns, buildRefreshSideBarFn } from "./io-wiring.js";
import type { LifecycleContext } from "./game/game-lifecycle.js";

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
        tileCatalog, dungeonFeatureCatalog, monsterCatalog, terrainRandomValues, displayDetail, getScentMap() ?? []);
    return {
        rogue, player, gameConst, packItems, featTable: featCatalog,
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
        numberOfMatchingPackItems: (cat, fl, fl2, _uf) => packCount(packItems, cat, fl, fl2),
        isVowelish: () => false, displayInventory: () => 0,
        flushBufferToFile: () => {}, saveHighScore: () => false, printHighScores: () => {},
        saveRecording: (_f) => {},              // stub — persistence layer not implemented
        saveRecordingNoPrompt: (_f) => {},      // stub — persistence layer not implemented
        notifyEvent: () => {}, saveRunHistory: () => {}, recordKeystroke: () => {},
        refreshDungeonCell: (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer),
        encodeMessageColor,
        black, white, gray, yellow, lightBlue, badMessageColor,
        itemMessageColor, advancementMessageColor, superVictoryColor,
        displayedMessage: messageState.displayedMessage,
        G_GOLD: DisplayGlyph.G_GOLD, G_AMULET: DisplayGlyph.G_AMULET,
    };
}
