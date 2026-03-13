/*
 *  menus/main-menu.ts — Title screen, main menu navigation, main game dispatcher
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/main-menu.ts (lines 640–1697)
 *  Source C: src/brogue/MainMenu.c (functions: initializeMainMenuButtons,
 *             initializeMainMenu, initializeFlyoutMenu, isFlyoutActive,
 *             getNextGameButtonPos, redrawMainMenuButtons, titleMenu,
 *             mainBrogueJunction)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueButton, ButtonState, ScreenDisplayBuffer, RogueEvent } from "../types/types.js";
import { NGCommand, EventType, ButtonDrawState, TextEntryType } from "../types/enums.js";
import {
    COLS, ROWS,
    GAME_SUFFIX, RECORDING_SUFFIX, LAST_GAME_NAME,
} from "../types/constants.js";
import type { MenuContext } from "./menu-types.js";
import { MENU_FLAME_UPDATE_DELAY } from "./menu-types.js";
import { initializeMainMenuButton, stackButtons, initializeMenu } from "./menu-buttons.js";
import { updateMenuFlames, drawMenuFlames, initializeMenuFlames } from "./menu-flames.js";
import {
    chooseGameMode, chooseGameVariant, dialogChooseFile, viewGameStats,
} from "./character-select.js";

// Re-export for use by character-select and other modules
export { initializeMainMenuButton };

const MAIN_MENU_BUTTON_COUNT = 4;
const FLYOUT_X = 59;

// =============================================================================
// initializeMainMenuButtons — MainMenu.c:270
// =============================================================================

/**
 * Initialize the four main menu buttons (New Game, Play, View, Quit).
 *
 * C: `initializeMainMenuButtons` in MainMenu.c
 */
export function initializeMainMenuButtons(ctx: MenuContext): BrogueButton[] {
    const buttons: BrogueButton[] = [
        initializeMainMenuButton("     %sN%sew Game     ", "n".charCodeAt(0), "N".charCodeAt(0), NGCommand.NewGame, ctx),
        initializeMainMenuButton(" *     %sP%slay       ", "p".charCodeAt(0), "P".charCodeAt(0), NGCommand.FlyoutPlay, ctx),
        initializeMainMenuButton(" *     %sV%siew       ", "v".charCodeAt(0), "V".charCodeAt(0), NGCommand.FlyoutView, ctx),
        initializeMainMenuButton("       %sQ%suit       ", "q".charCodeAt(0), "Q".charCodeAt(0), NGCommand.Quit, ctx),
    ];

    // Add a left-facing triangle to all buttons except Quit
    for (let i = 0; i < MAIN_MENU_BUTTON_COUNT - 1; i++) {
        buttons[i].symbol = [ctx.G_LEFT_TRIANGLE];
    }

    return buttons;
}

// =============================================================================
// initializeMainMenu — MainMenu.c:325
// =============================================================================

/**
 * Initialize the main menu (buttons + layout).
 *
 * C: `initializeMainMenu` in MainMenu.c
 */
export function initializeMainMenu(
    quitX: number,
    quitY: number,
    ctx: MenuContext,
): { state: ButtonState; buttons: BrogueButton[]; shadowBuf: ScreenDisplayBuffer } {
    const buttons = initializeMainMenuButtons(ctx);
    stackButtons(buttons, MAIN_MENU_BUTTON_COUNT, quitX, quitY, 2, false);

    const { state, shadowBuf } = initializeMenu(buttons, MAIN_MENU_BUTTON_COUNT, ctx);
    return { state, buttons, shadowBuf };
}

// =============================================================================
// initializeFlyoutMenu — MainMenu.c:350
// =============================================================================

/**
 * Initialize a flyout sub-menu and position its buttons.
 *
 * C: `initializeFlyoutMenu` in MainMenu.c
 */
export function initializeFlyoutMenu(
    anchorX: number,
    anchorY: number,
    ctx: MenuContext,
): { state: ButtonState; buttons: BrogueButton[]; shadowBuf: ScreenDisplayBuffer } | null {
    let buttons: BrogueButton[];

    if (ctx.rogue.nextGame === NGCommand.FlyoutPlay) {
        buttons = [
            initializeMainMenuButton("  New %sS%seeded Game  ", "s".charCodeAt(0), "S".charCodeAt(0), NGCommand.NewGameWithSeed, ctx),
            initializeMainMenuButton("     %sL%soad Game     ", "l".charCodeAt(0), "L".charCodeAt(0), NGCommand.OpenGame, ctx),
            initializeMainMenuButton("  Change V%sa%sriant   ", "a".charCodeAt(0), "A".charCodeAt(0), NGCommand.GameVariant, ctx),
            initializeMainMenuButton("   Change %sM%sode     ", "m".charCodeAt(0), "M".charCodeAt(0), NGCommand.GameMode, ctx),
        ];
    } else if (ctx.rogue.nextGame === NGCommand.FlyoutView) {
        buttons = [
            initializeMainMenuButton("   View %sR%secording  ", "r".charCodeAt(0), "R".charCodeAt(0), NGCommand.ViewRecording, ctx),
            initializeMainMenuButton("    %sH%sigh Scores    ", "h".charCodeAt(0), "H".charCodeAt(0), NGCommand.HighScores, ctx),
            initializeMainMenuButton("    %sG%same Stats     ", "g".charCodeAt(0), "G".charCodeAt(0), NGCommand.GameStats, ctx),
        ];
    } else {
        return null;
    }

    stackButtons(buttons, buttons.length, anchorX, anchorY, 2, false);
    const { state, shadowBuf } = initializeMenu(buttons, buttons.length, ctx);
    return { state, buttons, shadowBuf };
}

// =============================================================================
// isFlyoutActive — MainMenu.c:471
// =============================================================================

/**
 * Returns true if rogue.nextGame is a flyout command.
 *
 * C: `isFlyoutActive` in MainMenu.c
 */
export function isFlyoutActive(nextGame: NGCommand): boolean {
    return nextGame >= NGCommand.FlyoutPlay && nextGame <= NGCommand.FlyoutOptions;
}

// =============================================================================
// getNextGameButtonPos — MainMenu.c:479
// =============================================================================

/**
 * Find the button matching rogue.nextGame and return its position.
 *
 * C: `getNextGameButtonPos` in MainMenu.c
 */
export function getNextGameButtonPos(
    buttons: BrogueButton[],
    nextGame: NGCommand,
): { x: number; y: number } | null {
    for (let i = 0; i < MAIN_MENU_BUTTON_COUNT; i++) {
        if (buttons[i].command === nextGame) {
            return { x: buttons[i].x, y: buttons[i].y };
        }
    }
    return null;
}

// =============================================================================
// redrawMainMenuButtons — MainMenu.c:491
// =============================================================================

/**
 * Draw main menu buttons, darkening all except the one associated with
 * the active flyout.
 *
 * C: `redrawMainMenuButtons` in MainMenu.c
 */
export function redrawMainMenuButtons(
    state: ButtonState,
    dbuf: ScreenDisplayBuffer,
    ctx: MenuContext,
): void {
    if (ctx.rogue.nextGame === NGCommand.Nothing) {
        ctx.drawButtonsInState(state, dbuf);
    } else {
        for (let i = 0; i < MAIN_MENU_BUTTON_COUNT; i++) {
            const drawState = state.buttons[i].command === ctx.rogue.nextGame
                ? ButtonDrawState.Normal
                : ButtonDrawState.Pressed;
            ctx.drawButton(state.buttons[i], drawState, dbuf);
        }
    }
}

// =============================================================================
// titleMenu — MainMenu.c:507
// =============================================================================

/**
 * Run the animated title screen with fire and menu buttons.
 * Sets rogue.nextGame based on user selection.
 *
 * C: `titleMenu` in MainMenu.c
 */
export async function titleMenu(ctx: MenuContext, displayBuffer: ScreenDisplayBuffer): Promise<void> {
    ctx.seedRandomGenerator(0n);

    ctx.rogue.nextGamePath = "";
    ctx.rogue.nextGameSeed = 0n;

    ctx.blackOutScreen(displayBuffer);

    const quitButtonX = COLS - 20;
    const quitButtonY = ROWS - 3;
    const { state: mainMenu, buttons: mainButtons, shadowBuf: mainShadowBuf } =
        initializeMainMenu(quitButtonX, quitButtonY, ctx);

    const { flames, colorSources, colors, mask } =
        initializeMenuFlames(true, ctx);
    ctx.rogue.creaturesWillFlashThisTurn = false;

    let flyoutMenu: ButtonState | null = null;
    let flyoutButtons: BrogueButton[] = [];
    let flyoutShadowBuf: ScreenDisplayBuffer | null = null;
    let lastFlameUpdate = 0;

    do {
        if (isFlyoutActive(ctx.rogue.nextGame)) {
            const bPos = getNextGameButtonPos(mainButtons, ctx.rogue.nextGame);
            if (bPos) {
                const flyout = initializeFlyoutMenu(FLYOUT_X, bPos.y, ctx);
                if (flyout) {
                    flyoutMenu = flyout.state;
                    flyoutButtons = flyout.buttons;
                    flyoutShadowBuf = flyout.shadowBuf;
                }
            }
        }

        let theEvent: RogueEvent = {
            eventType: EventType.EventError,
            param1: 0,
            param2: 0,
            controlKey: false,
            shiftKey: false,
        };

        do {
            if (ctx.isApplicationActive()) {
                const now = Date.now();
                if (now - lastFlameUpdate >= MENU_FLAME_UPDATE_DELAY) {
                    updateMenuFlames(colors, colorSources, flames, ctx);
                    lastFlameUpdate = now;
                }
                drawMenuFlames(flames, mask, ctx, displayBuffer);
                ctx.overlayDisplayBuffer(mainShadowBuf);

                const dbuf = ctx.createScreenDisplayBuffer();
                ctx.clearDisplayBuffer(dbuf);
                redrawMainMenuButtons(mainMenu, dbuf, ctx);
                ctx.overlayDisplayBuffer(dbuf);

                if (isFlyoutActive(ctx.rogue.nextGame) && flyoutMenu && flyoutShadowBuf) {
                    ctx.overlayDisplayBuffer(flyoutShadowBuf);
                    const flyoutDbuf = ctx.createScreenDisplayBuffer();
                    ctx.clearDisplayBuffer(flyoutDbuf);
                    ctx.drawButtonsInState(flyoutMenu, flyoutDbuf);
                    ctx.overlayDisplayBuffer(flyoutDbuf);
                    mainMenu.buttonDepressed = -1;
                    mainMenu.buttonFocused = -1;
                }

                if (await ctx.pauseBrogue(MENU_FLAME_UPDATE_DELAY, { interruptForMouseMove: true })) {
                    theEvent = await ctx.nextBrogueEvent(true, false, true);

                    if (theEvent.eventType === EventType.Keystroke &&
                        (theEvent.param1 === "n".charCodeAt(0) || theEvent.param1 === "N".charCodeAt(0))) {
                        ctx.rogue.nextGame = NGCommand.NewGame;
                        break;
                    }

                    let flyoutIndex = -1;
                    if (isFlyoutActive(ctx.rogue.nextGame) && flyoutMenu) {
                        const flyoutResult = await ctx.processButtonInput(flyoutMenu, theEvent);
                        flyoutIndex = flyoutResult.chosenButton;
                        if (flyoutIndex !== -1 && (theEvent.eventType === EventType.MouseUp || theEvent.eventType === EventType.Keystroke)) {
                            ctx.rogue.nextGame = flyoutButtons[flyoutIndex].command;
                        }
                        if (ctx.rogue.nextGame === NGCommand.GameMode) {
                            await chooseGameMode(ctx);
                        } else if (ctx.rogue.nextGame === NGCommand.GameVariant) {
                            await chooseGameVariant(ctx);
                        }
                    }

                    const mainResult = await ctx.processButtonInput(mainMenu, theEvent);
                    const mainIndex = mainResult.chosenButton;

                    if (theEvent.eventType === EventType.MouseUp || theEvent.eventType === EventType.Keystroke) {
                        if (mainIndex !== -1 && ctx.rogue.nextGame !== mainButtons[mainIndex].command) {
                            ctx.rogue.nextGame = mainButtons[mainIndex].command;
                        } else if (flyoutIndex === -1) {
                            ctx.rogue.nextGame = NGCommand.Nothing;
                        }
                    }
                }
            } else {
                await ctx.pauseBrogue(64);
            }
        } while (
            theEvent.eventType !== EventType.MouseUp &&
            theEvent.eventType !== EventType.Keystroke &&
            (isFlyoutActive(ctx.rogue.nextGame) || ctx.rogue.nextGame === NGCommand.Nothing)
        );
    } while (isFlyoutActive(ctx.rogue.nextGame) || ctx.rogue.nextGame === NGCommand.Nothing);

    drawMenuFlames(flames, mask, ctx, displayBuffer);
}

// =============================================================================
// mainBrogueJunction — MainMenu.c:1101
// =============================================================================

/**
 * The top-level menu dispatcher. Runs after launch or after a game ends.
 *
 * C: `mainBrogueJunction` in MainMenu.c
 */
export async function mainBrogueJunction(ctx: MenuContext, displayBuffer: ScreenDisplayBuffer): Promise<void> {
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            const cell = displayBuffer.cells[i][j];
            cell.character = 0 as import("../types/enums.js").DisplayGlyph;
            cell.opacity = 100;
            cell.foreColorComponents[0] = 0;
            cell.foreColorComponents[1] = 0;
            cell.foreColorComponents[2] = 0;
            cell.backColorComponents[0] = 0;
            cell.backColorComponents[1] = 0;
            cell.backColorComponents[2] = 0;
            ctx.plotCharWithColor(32 as import("../types/enums.js").DisplayGlyph, { windowX: i, windowY: j }, ctx.black, ctx.black, displayBuffer);
        }
    }

    ctx.initializeGameVariant();
    ctx.initializeLaunchArguments();

    do {
        ctx.rogue.gameHasEnded = false;
        ctx.rogue.playbackFastForward = false;
        ctx.rogue.playbackMode = false;

        switch (ctx.rogue.nextGame) {
            case NGCommand.Nothing:
                await titleMenu(ctx, displayBuffer);
                break;

            case NGCommand.GameVariant:
                ctx.rogue.nextGame = NGCommand.Nothing;
                ctx.initializeGameVariant();
                break;

            case NGCommand.NewGame:
            case NGCommand.NewGameWithSeed: {
                ctx.rogue.nextGamePath = "";
                ctx.setRandomNumbersGenerated(0);

                ctx.rogue.playbackMode = false;
                ctx.rogue.playbackFastForward = false;
                ctx.rogue.playbackBetweenTurns = false;

                const path = ctx.getAvailableFilePath(LAST_GAME_NAME, GAME_SUFFIX);
                ctx.setCurrentFilePath(path + GAME_SUFFIX);

                if (ctx.rogue.nextGame === NGCommand.NewGameWithSeed) {
                    if (ctx.rogue.nextGameSeed === 0n) {
                        const seedDefault = ctx.previousGameSeed === 0n
                            ? ""
                            : ctx.previousGameSeed.toString();

                        const buf = await ctx.getInputTextString(
                            "Generate dungeon with seed number:",
                            20,
                            seedDefault,
                            "",
                            TextEntryType.Numbers,
                            true,
                        );

                        if (buf !== null && buf !== "") {
                            try {
                                let seed = BigInt(buf);
                                if (seed > 18446744073709551615n) {
                                    seed = 18446744073709551615n;
                                }
                                ctx.rogue.nextGameSeed = seed;
                            } catch {
                                ctx.rogue.nextGameSeed = 18446744073709551615n;
                            }
                        } else {
                            ctx.rogue.nextGame = NGCommand.Nothing;
                            break;
                        }
                    }
                } else {
                    ctx.rogue.nextGameSeed = 0n;
                }

                ctx.rogue.nextGame = NGCommand.Nothing;
                ctx.initializeRogue(ctx.rogue.nextGameSeed);
                ctx.startLevel(ctx.rogue.depthLevel, 1);
                ctx.commitDraws();
                await ctx.mainInputLoop();

                if (ctx.serverMode) {
                    ctx.rogue.nextGame = NGCommand.Quit;
                }
                ctx.freeEverything();
                break;
            }

            case NGCommand.OpenGame: {
                ctx.rogue.nextGame = NGCommand.Nothing;
                let gamePath = "";
                if (ctx.rogue.nextGamePath) {
                    gamePath = ctx.rogue.nextGamePath;
                    ctx.rogue.currentGamePath = ctx.rogue.nextGamePath;
                    ctx.rogue.nextGamePath = "";
                } else {
                    const chosen = await dialogChooseFile(GAME_SUFFIX, "Open saved game:", ctx);
                    if (chosen) gamePath = chosen;
                }

                if (gamePath && ctx.openFile(gamePath)) {
                    await ctx.mainInputLoop();
                    ctx.freeEverything();
                }
                ctx.rogue.playbackMode = false;
                ctx.rogue.playbackOOS = false;

                if (ctx.serverMode) {
                    ctx.rogue.nextGame = NGCommand.Quit;
                }
                break;
            }

            case NGCommand.ViewRecording: {
                ctx.rogue.nextGame = NGCommand.Nothing;
                let recPath = "";
                if (ctx.rogue.nextGamePath) {
                    recPath = ctx.rogue.nextGamePath;
                    ctx.rogue.currentGamePath = ctx.rogue.nextGamePath;
                    ctx.rogue.nextGamePath = "";
                } else {
                    const chosen = await dialogChooseFile(RECORDING_SUFFIX, "View recording:", ctx);
                    if (chosen) recPath = chosen;
                }

                if (recPath && ctx.openFile(recPath)) {
                    ctx.setRandomNumbersGenerated(0);
                    ctx.rogue.playbackMode = true;
                    ctx.initializeRogue(0n);
                    if (!ctx.rogue.gameHasEnded) {
                        ctx.startLevel(ctx.rogue.depthLevel, 1);
                        if (ctx.nonInteractivePlayback) {
                            ctx.rogue.playbackPaused = false;
                        } else {
                            ctx.rogue.playbackPaused = true;
                        }
                        ctx.displayAnnotation();
                    }

                    while (!ctx.rogue.gameHasEnded && ctx.rogue.playbackMode) {
                        if (ctx.rogue.playbackPaused) {
                            ctx.rogue.playbackPaused = false;
                            ctx.pausePlayback();
                        }
                        if (ctx.rogue.gameHasEnded) break;

                        ctx.rogue.playbackBetweenTurns = true;
                        const theEvent = await ctx.nextBrogueEvent(false, true, false);
                        ctx.executeEvent(theEvent);
                    }

                    ctx.freeEverything();
                }
                ctx.rogue.playbackMode = false;
                ctx.rogue.playbackOOS = false;

                if (ctx.serverMode || ctx.nonInteractivePlayback) {
                    ctx.rogue.nextGame = NGCommand.Quit;
                }
                break;
            }

            case NGCommand.HighScores:
                ctx.rogue.nextGame = NGCommand.Nothing;
                await ctx.printHighScores(false);
                break;

            case NGCommand.GameStats:
                ctx.rogue.nextGame = NGCommand.Nothing;
                await viewGameStats(ctx);
                break;

            case NGCommand.Quit:
                break;

            default:
                break;
        }
    } while (ctx.rogue.nextGame !== NGCommand.Quit);
}
