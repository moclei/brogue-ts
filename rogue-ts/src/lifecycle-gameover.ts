/*
 *  lifecycle-gameover.ts — buildLifecycleContext for game-lifecycle.ts screens
 *  Port V2 — rogue-ts
 *
 *  Provides:
 *    - buildLifecycleContext() — DI context for game/game-lifecycle.ts (not in main flow)
 *    - runDeathScreen()       — full async death sequence (called from menus.ts)
 *    - deathFadeAsync()       — radial blackout animation helper (private)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "./core.js";
import { EventType, DisplayGlyph, ItemCategory, GameMode, ALL_ITEMS } from "./types/enums.js";
import { DCOLS, DROWS, COLS, ROWS, MESSAGE_LINES, ACKNOWLEDGE_KEY, ESCAPE_KEY, INVENTORY_KEY } from "./types/constants.js";
import { ItemFlag } from "./types/flags.js";
import type { ScreenDisplayBuffer } from "./types/types.js";
import { featCatalog } from "./globals/feat-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { mapToWindowX, mapToWindowY } from "./globals/tables.js";
import {
    black, white, gray, yellow, lightBlue, badMessageColor,
    itemMessageColor, advancementMessageColor, superVictoryColor,
} from "./globals/colors.js";
import {
    blackOutScreen, clearDisplayBuffer, plotCharToBuffer,
    createScreenDisplayBuffer, copyDisplayBuffer,
} from "./io/display.js";
import { strLenWithoutEscapes, printString } from "./io/text.js";
import { waitForEvent, commitDraws, pauseAndCheckForEvent } from "./platform.js";
import { buildInventoryContext, buildMessageContext } from "./ui.js";
import { displayInventory } from "./io/inventory-display.js";
import { encodeMessageColor } from "./io/color.js";
import {
    getCellAppearance,
    refreshDungeonCell as refreshDungeonCellFn,
    displayLevel as displayLevelFn,
} from "./io/cell-appearance.js";
import {
    deleteMessages as deleteMessagesFn,
    displayMoreSignWithoutWaitingForAcknowledgment as displayMoreSignWithoutFn,
} from "./io/messages.js";
import type { MessageContext as SyncMessageContext } from "./io/messages-state.js";
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
    const msgCtx = buildMessageContext() as unknown as SyncMessageContext;
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
        printString: (str, x, y, fg, bg, dbuf) => printString(str, x, y, fg, bg, dbuf ?? displayBuffer),
        plotCharToBuffer: (ch, pos, fg, bg, dbuf) => plotCharToBuffer(ch, pos.windowX, pos.windowY, fg, bg, dbuf),
        // funkyFade: the sync C-port path (gameOver/victory in game-lifecycle.ts) calls this
        // synchronously; the real effects.ts:funkyFade requires a full EffectsContext with
        // pathfinding deps. The death path uses runDeathScreen (async) which calls
        // deathFadeAsync directly and never reaches this. Keep as no-op for the sync port path.
        funkyFade: () => {},
        strLenWithoutEscapes: (s) => strLenWithoutEscapes(s),
        mapToWindowX, mapToWindowY,
        message, messageWithColor, confirmMessages,
        deleteMessages: () => deleteMessagesFn(msgCtx),
        // displayMoreSign is async in TS but the LifecycleContext interface expects void.
        // The real death path uses runDeathScreen which handles --MORE-- directly.
        // Keep as no-op for the sync gameOver/victory C-port path.
        displayMoreSign: () => {},
        displayMoreSignWithoutWaitingForAcknowledgment: () => displayMoreSignWithoutFn(msgCtx),
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

// =============================================================================
// deathFadeAsync — async radial blackout from player position
// =============================================================================

/**
 * Fade the current screen to black radiating outward from the player's
 * window position. Cells near the player fade first; outer cells lag.
 *
 * Simpler async alternative to the sync C funkyFade (RogueMain.c:1136).
 * Uses real async delays so the animation is visible in the browser.
 */
async function deathFadeAsync(
    displayBuf: ScreenDisplayBuffer,
    playerWindowX: number,
    playerWindowY: number,
): Promise<void> {
    const snapshot = createScreenDisplayBuffer();
    copyDisplayBuffer(snapshot, displayBuf);

    const STEPS = 40;
    for (let n = 0; n <= STEPS; n++) {
        const basePct = n / STEPS;
        for (let i = 0; i < COLS; i++) {
            for (let j = 0; j < ROWS; j++) {
                // Normalise distance from player so 0 = at player, 1 = far edge
                const dx = (i - playerWindowX) * 2.0 / COLS;
                const dy = (j - playerWindowY) * 1.0 / ROWS;
                const dist = Math.min(1.0, Math.sqrt(dx * dx + dy * dy));
                // Cells near the player fade 2.5× faster than the edges
                const localPct = Math.min(1.0, basePct * (1.0 + (1.0 - dist) * 1.5));
                const weight = Math.trunc(localPct * 100);

                const src = snapshot.cells[i][j];
                const dst = displayBuf.cells[i][j];
                dst.character = src.character;
                const scale = (100 - weight) / 100;
                dst.foreColorComponents[0] = Math.trunc(src.foreColorComponents[0] * scale);
                dst.foreColorComponents[1] = Math.trunc(src.foreColorComponents[1] * scale);
                dst.foreColorComponents[2] = Math.trunc(src.foreColorComponents[2] * scale);
                dst.backColorComponents[0] = Math.trunc(src.backColorComponents[0] * scale);
                dst.backColorComponents[1] = Math.trunc(src.backColorComponents[1] * scale);
                dst.backColorComponents[2] = Math.trunc(src.backColorComponents[2] * scale);
            }
        }
        commitDraws();
        const interrupted = await pauseAndCheckForEvent(25); // ~25ms per frame → ~1 second total
        if (interrupted) break;
    }

    // Ensure the screen is fully black at the end
    blackOutScreen(displayBuf);
    commitDraws();
}

// =============================================================================
// runDeathScreen — full async death sequence (C: gameOver in RogueMain.c)
// =============================================================================

/**
 * Full async death sequence: sidebar HP=0, "You die..." message,
 * optional inventory review, radial fade to black, death text + feats,
 * then waits for acknowledgment before returning to the main menu.
 *
 * Replaces the 3-line placeholder in showGameEndScreen (menus.ts).
 * Called from menus.ts after mainGameLoop() exits with a pending death.
 *
 * Recording save is a no-op stub — deferred to port-v2-persistence.
 *
 * C: RogueMain.c:gameOver() (phases 1–5, excluding persistence)
 */
export async function runDeathScreen(killedBy: string): Promise<void> {
    const { rogue, player, gameConst: gc, displayBuffer, packItems } = getGameState();

    // Phase 1: show HP=0 in sidebar, display "You die..." in the message area
    player.currentHP = 0;
    buildRefreshSideBarFn()();

    const { messageWithColor, confirmMessages } = buildMessageFns();
    await messageWithColor("You die... (press 'i' to view your inventory)", badMessageColor, 0);

    // Show --MORE-- without waiting (C: displayMoreSignWithoutWaitingForAcknowledgment)
    printString("--MORE--", COLS - 8, MESSAGE_LINES - 1, black, white, displayBuffer);
    commitDraws();

    // Phase 2: input loop — 'i' views inventory; space / click / escape continues
    let done = false;
    while (!done) {
        const ev = await waitForEvent();
        if (ev.eventType === EventType.Keystroke && ev.param1 === INVENTORY_KEY) {
            for (const item of packItems) {
                identify(item, gc);
                item.flags &= ~ItemFlag.ITEM_MAGIC_DETECTED;
            }
            await displayInventory(ALL_ITEMS, 0, 0, true, false, buildInventoryContext());
            // Re-render dungeon + --MORE-- after inventory closes
            printString("--MORE--", COLS - 8, MESSAGE_LINES - 1, black, white, displayBuffer);
            commitDraws();
        } else if (
            (ev.eventType === EventType.Keystroke &&
             (ev.param1 === ACKNOWLEDGE_KEY || ev.param1 === ESCAPE_KEY)) ||
            ev.eventType === EventType.MouseUp
        ) {
            done = true;
        }
    }
    confirmMessages();

    // Phase 3: radial fade to black from the player's position (C: funkyFade)
    await deathFadeAsync(displayBuffer, mapToWindowX(player.loc.x), mapToWindowY(player.loc.y));

    // Phase 4: death text on the black screen
    // killedBy already contains the full phrase (e.g. "Killed by a goblin")
    let buf = `${killedBy} on depth ${rogue.depthLevel}`;

    const numGems = packCount(packItems, ItemCategory.GEM, 0, 0);
    rogue.gold += 500 * numGems;
    if (rogue.mode === GameMode.Easy) {
        rogue.gold = Math.floor(rogue.gold / 10);
    }
    if (rogue.gold > 0) {
        buf += numGems > 0
            ? ` with treasure worth ${rogue.gold} gold`
            : ` with ${rogue.gold} gold`;
    }
    if (packItems.some(item => !!(item.category & ItemCategory.AMULET))) {
        buf += ", amulet in hand";
    }
    buf += ".";

    printString(
        buf,
        Math.floor((COLS - strLenWithoutEscapes(buf)) / 2),
        Math.floor(ROWS / 2),
        gray, black, displayBuffer,
    );

    // Print any earned feats below the death line
    let y = Math.floor(ROWS / 2) + 3;
    for (let i = 0; i < gc.numberFeats; i++) {
        if (rogue.featRecord[i] && !featCatalog[i]?.initialValue) {
            const feat = featCatalog[i];
            const featBuf = `${feat.name}: ${feat.description}`;
            printString(
                featBuf,
                Math.floor((COLS - strLenWithoutEscapes(featBuf)) / 2),
                y++,
                advancementMessageColor, black, displayBuffer,
            );
        }
    }

    commitDraws();

    // Phase 5: wait for acknowledgment (--More-- equivalent)
    let acked = false;
    while (!acked) {
        const ev = await waitForEvent();
        if (
            (ev.eventType === EventType.Keystroke &&
             (ev.param1 === ACKNOWLEDGE_KEY || ev.param1 === ESCAPE_KEY)) ||
            ev.eventType === EventType.MouseUp
        ) {
            acked = true;
        }
    }

    // Phase 6: saveRecording — DEFER: port-v2-persistence
}
