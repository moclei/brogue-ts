/*
 *  menus.ts — Menu context builder (Phase 7 wiring)
 *  Port V2 — rogue-ts
 *
 *  Provides buildMenuContext() — the DI context factory for the menu module.
 *  Wires the async event bridge (nextBrogueEvent → waitForEvent),
 *  async pause (pauseBrogue → setTimeout), button/display IO, and game
 *  lifecycle functions (initializeRogue, startLevel, mainGameLoop).
 *
 *  Stubs:
 *    - File operations (listFiles, loadRunHistory, save/load) — no browser FS
 *    - printHighScores — no persistent score file
 *    - Playback helpers (executeEvent, displayAnnotation, pausePlayback)
 *    - Recording helpers (flushBufferToFile, saveGameNoPrompt, etc.)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, takePendingDeathMessage, takePendingVictory } from "./core.js";
import { runDeathScreen } from "./lifecycle-gameover.js";
import { waitForEvent, commitDraws, mainGameLoop, pauseAndCheckForEvent } from "./platform.js";
import {
    initializeRogue, startLevel, freeEverything,
    getPreviousGameSeed,
} from "./lifecycle.js";
import { buildButtonContext, buildInventoryContext } from "./ui.js";
import { buildInputContext } from "./io/input-context.js";
import { seedRandomGenerator, randRange } from "./math/rng.js";
import { applyColorAverage } from "./io/color.js";
import { storeColorComponents, encodeMessageColor } from "./io/color.js";
import { strLenWithoutEscapes, printString } from "./io/text.js";
import { clamp } from "./math/rng.js";
import {
    plotCharWithColor, locIsInWindow,
    createScreenDisplayBuffer, clearDisplayBuffer,
    overlayDisplayBuffer, saveDisplayBuffer, restoreDisplayBuffer,
    blackOutScreen,
} from "./io/display.js";
import {
    initializeButton, setButtonText,
    initializeButtonState, drawButton, drawButtonsInState,
    processButtonInput, buttonInputLoop,
} from "./io/buttons.js";
import { rectangularShading, printTextBox } from "./io/inventory.js";
import { getInputTextString, confirm } from "./io/input-dispatch.js";
import { smoothHiliteGradient } from "./io/sidebar-player.js";
import {
    black, white, yellow, veryDarkGray,
    flameSourceColor, flameSourceColorSecondary, flameTitleColor,
    titleButtonColor, itemMessageColor, interfaceBoxColor, goodMessageColor,
} from "./globals/colors.js";
import { DisplayGlyph } from "./types/enums.js";
import { COLS, ROWS } from "./types/constants.js";
import type { Color } from "./types/types.js";
import type { MenuContext } from "./menus/menu-types.js";

// =============================================================================
// ASCII art title — 68 chars wide × 26 rows (GlobalsBrogue.c)
// =============================================================================

const BROGUE_TITLE_ART =
    "                                                                    " +
    "                                                                    " +
    "                                                                    " +
    "                                                                    " +
    "                                                                    " +
    "                                                                    " +
    "                                                                    " +
    "########  ########      ######         ######  ####    ### #########" +
    " ##   ###  ##   ###   ##     ###     ##     ##  ##      #   ##     #" +
    " ##    ##  ##    ##  ##       ###   ##       #  ##      #   ##     #" +
    " ##    ##  ##    ##  #    #    ##   #        #  ##      #   ##      " +
    " ##    ##  ##    ## ##   ##     ## ##           ##      #   ##    # " +
    " ##   ##   ##   ##  ##   ###    ## ##           ##      #   ##    # " +
    " ######    ## ###   ##   ####   ## ##           ##      #   ####### " +
    " ##    ##  ##  ##   ##   ####   ## ##           ##      #   ##    # " +
    " ##     ## ##   ##  ##    ###   ## ##     ##### ##      #   ##    # " +
    " ##     ## ##   ##  ###    ##   ## ###      ##  ##      #   ##      " +
    " ##     ## ##    ##  ##    #    #   ##      ##  ##      #   ##      " +
    " ##     ## ##    ##  ###       ##   ###     ##  ###     #   ##     #" +
    " ##    ##  ##     ##  ###     ##     ###   ###   ###   #    ##     #" +
    "########  ####    ###   ######         ####       #####    #########" +
    "                          ##                                        " +
    "                      ##########                                    " +
    "                          ##                                        " +
    "                          ##                                        " +
    "                         ####                                       ";

// =============================================================================
// Module-level menu state
// =============================================================================

let _currentFilePath = "";
let _randomNumbersGenerated = 0;

// =============================================================================
// showGameEndScreen — death / victory overlay after mainGameLoop exits
// =============================================================================

/**
 * Show a simple game-end overlay (death or victory), wait for keypress,
 * then return so main-menu.ts can run freeEverything() and loop back.
 *
 * Full C death/victory screens (funkyFade, inventory review, high scores)
 * are deferred to a later port phase; this is the minimal Phase 8 version.
 */
async function showGameEndScreen(): Promise<void> {
    const deathMsg = takePendingDeathMessage();
    const victoryType = takePendingVictory();

    if (!deathMsg && victoryType === 'none') return;

    if (deathMsg) {
        // Full C-faithful death sequence: message, inventory review, fade, death text
        await runDeathScreen(deathMsg);
        return;
    }

    // Victory placeholder (B98 only covers death; victory screens are a separate item)
    const { rogue, displayBuffer } = getGameState();
    blackOutScreen(displayBuffer);

    const lines: Array<{ text: string; color: Color }> = [];
    if (victoryType === 'super') {
        lines.push({ text: "You escaped with the Amulet of Yendor!", color: { ...yellow } });
        lines.push({ text: `You survived to depth ${rogue.depthLevel}.`, color: { ...veryDarkGray } });
    } else {
        lines.push({ text: "You escaped from the dungeon!", color: { ...white } });
        lines.push({ text: `You survived to depth ${rogue.depthLevel}.`, color: { ...veryDarkGray } });
    }
    lines.push({ text: "Press any key to continue.", color: { ...veryDarkGray } });

    const startY = Math.floor(ROWS / 2) - Math.floor(lines.length / 2);
    for (let i = 0; i < lines.length; i++) {
        const { text, color } = lines[i];
        const startX = Math.floor((COLS - text.length) / 2);
        printString(text, startX, startY + i, color, black, displayBuffer);
    }

    commitDraws();
    await waitForEvent();
}

// =============================================================================
// buildMenuContext
// =============================================================================

/**
 * Build the DI context for the main menu module.
 * Called from bootstrap.ts before the first menu render.
 */
export function buildMenuContext(): MenuContext {
    const { rogue, gameConst, gameVariant, displayBuffer } = getGameState();

    const btnCtx = () => buildButtonContext();
    const invCtx = () => buildInventoryContext();
    const inCtx = () => buildInputContext();

    return {
        // -- State -----------------------------------------------------------
        rogue: rogue as MenuContext["rogue"],
        gameConst,
        gameVariant,

        mainMenuTitle: BROGUE_TITLE_ART,
        isApplicationActive: () => true,
        serverMode: false,
        nonInteractivePlayback: false,
        wizardMode: false,

        previousGameSeed: getPreviousGameSeed(),

        randomNumbersGenerated: _randomNumbersGenerated,
        setRandomNumbersGenerated: (n) => { _randomNumbersGenerated = n; },

        currentFilePath: _currentFilePath,
        setCurrentFilePath: (path) => { _currentFilePath = path; },

        setGameVariant: () => {
            // Variant switching re-initializes constants; stubbed for Phase 7
        },

        // -- RNG -------------------------------------------------------------
        seedRandomGenerator,
        rand_range: randRange,

        // -- Color -----------------------------------------------------------
        applyColorAverage,

        // -- Text ------------------------------------------------------------
        strLenWithoutEscapes,
        encodeMessageColor,

        // -- Rendering -------------------------------------------------------
        plotCharWithColor,
        locIsInWindow,

        createScreenDisplayBuffer,
        clearDisplayBuffer,
        overlayDisplayBuffer: (dbuf) => {
            const results = overlayDisplayBuffer(displayBuffer, dbuf);
            for (const r of results) {
                const cell = displayBuffer.cells[r.x][r.y];
                cell.character = r.character;
                cell.foreColorComponents[0] = clamp(r.foreColor.red, 0, 100);
                cell.foreColorComponents[1] = clamp(r.foreColor.green, 0, 100);
                cell.foreColorComponents[2] = clamp(r.foreColor.blue, 0, 100);
                cell.backColorComponents[0] = clamp(r.backColor.red, 0, 100);
                cell.backColorComponents[1] = clamp(r.backColor.green, 0, 100);
                cell.backColorComponents[2] = clamp(r.backColor.blue, 0, 100);
            }
        },
        saveDisplayBuffer: () => saveDisplayBuffer(displayBuffer),
        restoreDisplayBuffer: (saved) => restoreDisplayBuffer(displayBuffer, saved),
        blackOutScreen: (dbuf) => blackOutScreen(dbuf),
        commitDraws,

        printString: (text, x, y, foreColor, backColor, dbuf) => {
            if (dbuf) printString(text, x, y, foreColor, backColor, dbuf);
        },

        // -- Buttons ---------------------------------------------------------
        initializeButton,
        setButtonText: (button, withHotkey, withoutHotkey) =>
            setButtonText(button, withHotkey, withoutHotkey, btnCtx()),

        initializeButtonState,
        drawButton: (button, highlight, dbuf) =>
            drawButton(button, highlight, dbuf, btnCtx()),
        drawButtonsInState: (state, dbuf) =>
            drawButtonsInState(state, dbuf, btnCtx()),

        processButtonInput: async (state, event) =>
            processButtonInput(state, event, btnCtx()),
        buttonInputLoop: async (buttons, count, x, y, w, h) =>
            buttonInputLoop(buttons, count, x, y, w, h, btnCtx()),

        rectangularShading: (x, y, width, height, backColor, opacity, dbuf) =>
            rectangularShading(x, y, width, height, backColor, opacity, dbuf,
                { storeColorComponents }),

        printTextBox: async (textBuf, x, y, width, foreColor, backColor, buttons, buttonCount) =>
            printTextBox(textBuf, x, y, width, foreColor, backColor,
                invCtx(),
                buttons, buttonCount),

        // -- Events / timing -------------------------------------------------

        /** Async wrapper over the platform event queue. Flushes draws first. */
        nextBrogueEvent: async (_textInput, _colorsDance, _realInputEvenInPlayback) => {
            commitDraws();
            return waitForEvent();
        },

        /** Async delay — flushes draws, then sleeps up to ms milliseconds.
         *  Returns true early if an input event arrives (mirrors C pauseBrogue). */
        pauseBrogue: async (milliseconds, behavior) => {
            commitDraws();
            if (behavior?.interruptForMouseMove) {
                return pauseAndCheckForEvent(milliseconds);
            }
            await new Promise<void>(resolve => setTimeout(resolve, milliseconds));
            return false;
        },

        // -- Prompts / info --------------------------------------------------
        getInputTextString: async (prompt, maxLength, defaultEntry, promptSuffix, textEntryType, useDialogBox) =>
            getInputTextString(inCtx(), prompt, maxLength, defaultEntry, promptSuffix, textEntryType, useDialogBox),

        printHighScores: async (_hiliteMostRecent) => {
            // stub — no persistent score file in browser mode
        },

        confirm: async (prompt, alsoDuringPlayback) =>
            confirm(inCtx(), prompt, alsoDuringPlayback),

        waitForKeystrokeOrMouseClick: async () => {
            commitDraws();
            await waitForEvent();
        },

        message: () => {},   // stub — full message system is in io/messages.ts

        // -- Sidebar helper --------------------------------------------------
        smoothHiliteGradient,

        // -- Game lifecycle --------------------------------------------------
        initializeRogue,
        startLevel,
        mainInputLoop: async () => {
            await mainGameLoop();
            await showGameEndScreen();
        },
        freeEverything,
        initializeGameVariant: () => {
            // Variant re-initialization is handled in lifecycle.ts via buildGameInitContext
        },
        initializeLaunchArguments: () => {},

        // -- Recording stubs -------------------------------------------------
        flushBufferToFile: () => {},
        saveGameNoPrompt: () => {},
        saveRecordingNoPrompt: () => "",
        getAvailableFilePath: () => "",

        // -- Playback stubs --------------------------------------------------
        executeEvent: () => {},
        displayAnnotation: () => {},
        pausePlayback: () => {},

        // -- Platform file ops (no browser FS yet) ---------------------------
        listFiles: () => [],
        loadRunHistory: () => [],
        saveResetRun: () => {},
        openFile: () => false,

        // -- Color constants -------------------------------------------------
        black,
        white,
        yellow,
        veryDarkGray,
        flameSourceColor,
        flameSourceColorSecondary,
        flameTitleColor,
        titleButtonColor,
        itemMessageColor,
        interfaceBoxColor,
        goodMessageColor,

        // -- Glyph constants -------------------------------------------------
        G_LEFT_TRIANGLE: DisplayGlyph.G_LEFT_TRIANGLE,
        G_UP_ARROW: DisplayGlyph.G_UP_ARROW,
        G_DOWN_ARROW: DisplayGlyph.G_DOWN_ARROW,
    };
}
