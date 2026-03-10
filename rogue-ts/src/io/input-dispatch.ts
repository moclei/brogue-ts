/*
 *  io/input-dispatch.ts — Text entry, keystroke dispatch, event dispatch
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/io/io-input.ts (lines 543–1099)
 *  Source C: src/brogue/IO.c
 *  Functions: confirm, getInputTextString, keystrokeToDirection,
 *             executeKeystroke, executeEvent
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueButton, RogueEvent, SavedDisplayBuffer } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { EventType, Direction, TextEntryType } from "../types/enums.js";
import { ButtonFlag } from "../types/flags.js";
import {
    COLS, ROWS, KEYBOARD_LABELS,
    UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW,
    NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
    NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9,
    DESCEND_KEY, ASCEND_KEY, REST_KEY, AUTO_REST_KEY,
    SEARCH_KEY, INVENTORY_KEY, EQUIP_KEY, UNEQUIP_KEY,
    DROP_KEY, APPLY_KEY, THROW_KEY, RETHROW_KEY,
    RELABEL_KEY, SWAP_KEY, TRUE_COLORS_KEY, STEALTH_RANGE_KEY,
    CALL_KEY, EXPLORE_KEY, AUTOPLAY_KEY,
    MESSAGE_ARCHIVE_KEY, BROGUE_HELP_KEY, FEATS_KEY,
    DISCOVERIES_KEY, CREATE_ITEM_MONSTER_KEY,
    SAVE_GAME_KEY, NEW_GAME_KEY, QUIT_KEY, GRAPHICS_KEY,
    SEED_KEY, EASY_MODE_KEY, PRINTSCREEN_KEY,
    RETURN_KEY, DELETE_KEY,
    ESCAPE_KEY, ACKNOWLEDGE_KEY, PERIOD_KEY,
    MESSAGE_LINES, INTERFACE_OPACITY,
} from "../types/constants.js";
import {
    white, yellow, black, gray, teal,
    interfaceBoxColor,
} from "../globals/colors.js";
import type { InputContext } from "./input-keystrokes.js";
import {
    stripShiftFromMovementKeystroke, considerCautiousMode,
    pauseAnimation, nextKeyPress,
} from "./input-keystrokes.js";
import { PAUSE_BEHAVIOR_DEFAULT } from "../types/types.js";

// =============================================================================
// confirm — IO.c:2933
// =============================================================================

/**
 * Show a yes/no dialog. Returns true if user confirmed.
 */
export async function confirm(ctx: InputContext, prompt: string, alsoDuringPlayback: boolean): Promise<boolean> {
    if (ctx.rogue.autoPlayingLevel || (!alsoDuringPlayback && ctx.rogue.playbackMode)) {
        return true;
    }

    const whiteEsc = ctx.encodeMessageColor(white);
    const yellowEsc = KEYBOARD_LABELS ? ctx.encodeMessageColor(yellow) : ctx.encodeMessageColor(white);

    const buttons: BrogueButton[] = [];

    const btn0 = ctx.initializeButton();
    btn0.text = `     ${yellowEsc}Y${whiteEsc}es     `;
    btn0.hotkey = ["y".charCodeAt(0), "Y".charCodeAt(0), RETURN_KEY];
    btn0.flags |= ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_KEYPRESS_HIGHLIGHT;
    buttons.push(btn0);

    const btn1 = ctx.initializeButton();
    btn1.text = `     ${yellowEsc}N${whiteEsc}o      `;
    btn1.hotkey = ["n".charCodeAt(0), "N".charCodeAt(0), ACKNOWLEDGE_KEY, ESCAPE_KEY];
    btn1.flags |= ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_KEYPRESS_HIGHLIGHT;
    buttons.push(btn1);

    const rbuf = ctx.saveDisplayBuffer();
    const retVal = await ctx.printTextBox(
        prompt,
        Math.floor(COLS / 3),
        Math.floor(ROWS / 3),
        Math.floor(COLS / 3),
        white,
        interfaceBoxColor,
        buttons,
        2,
    );
    ctx.restoreDisplayBuffer(rbuf);

    return retVal !== -1 && retVal !== 1;
}

// =============================================================================
// getInputTextString — IO.c:2720
// =============================================================================

/**
 * Show a text-entry prompt and return the entered string.
 * Returns null if the user cancelled (Escape).
 */
export function getInputTextString(
    ctx: InputContext,
    prompt: string,
    maxLength: number,
    defaultEntry: string,
    promptSuffix: string,
    textEntryType: TextEntryType,
    useDialogBox: boolean,
): string | null {
    const textEntryBounds: [number, number][] = [
        [" ".charCodeAt(0), "~".charCodeAt(0)],
        [" ".charCodeAt(0), "~".charCodeAt(0)],
        ["0".charCodeAt(0), "9".charCodeAt(0)],
    ];

    const promptSuffixLen = promptSuffix.length;

    let entry = defaultEntry;
    const overflow = entry.length + promptSuffixLen - maxLength;
    if (overflow > 0) {
        entry = entry.substring(0, entry.length - overflow);
    }

    let x: number;
    let y: number;
    let rbuf: SavedDisplayBuffer | null = null;

    if (useDialogBox) {
        x = Math.floor((COLS - Math.max(maxLength, ctx.strLenWithoutEscapes(prompt))) / 2);
        y = Math.floor(ROWS / 2) - 1;
        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.rectangularShading(
            x - 1, y - 2,
            Math.max(maxLength, ctx.strLenWithoutEscapes(prompt)) + 2, 4,
            interfaceBoxColor, INTERFACE_OPACITY, dbuf,
        );
        rbuf = ctx.saveDisplayBuffer();
        ctx.overlayDisplayBuffer(dbuf);
        ctx.printString(prompt, x, y - 1, white, interfaceBoxColor, null);
        for (let i = 0; i < maxLength; i++) {
            ctx.plotCharWithColor(" ".charCodeAt(0) as DisplayGlyph, { windowX: x + i, windowY: y }, black, black);
        }
        ctx.printString(entry, x, y, white, black, null);
    } else {
        ctx.confirmMessages();
        x = ctx.mapToWindowX(ctx.strLenWithoutEscapes(prompt));
        y = MESSAGE_LINES - 1;
        ctx.temporaryMessage(prompt, 0);
        ctx.printString(entry, x, y, white, black, null);
    }

    maxLength = Math.min(maxLength, COLS - x);

    const inputChars: number[] = [];
    for (let i = 0; i < entry.length; i++) {
        inputChars[i] = entry.charCodeAt(i);
    }
    let charNum = ctx.strLenWithoutEscapes(entry);
    for (let i = charNum; i < maxLength; i++) {
        inputChars[i] = " ".charCodeAt(0);
    }

    const suffix = promptSuffix.length === 0 ? " " : promptSuffix;

    let keystroke: number;
    do {
        ctx.printString(suffix, charNum + x, y, gray, black, null);
        ctx.plotCharWithColor(
            (suffix.charCodeAt(0) || " ".charCodeAt(0)) as DisplayGlyph,
            { windowX: x + charNum, windowY: y },
            black, white,
        );
        keystroke = nextKeyPress(ctx, true);

        if (keystroke === DELETE_KEY && charNum > 0) {
            ctx.printString(suffix, charNum + x - 1, y, gray, black, null);
            ctx.plotCharWithColor(
                " ".charCodeAt(0) as DisplayGlyph,
                { windowX: x + charNum + suffix.length - 1, windowY: y },
                black, black,
            );
            charNum--;
            inputChars[charNum] = " ".charCodeAt(0);
        } else if (
            keystroke >= textEntryBounds[textEntryType][0] &&
            keystroke <= textEntryBounds[textEntryType][1]
        ) {
            let ch = keystroke;
            if (
                textEntryType === TextEntryType.Filename &&
                ctx.characterForbiddenInFilename(String.fromCharCode(ch))
            ) {
                ch = "-".charCodeAt(0);
            }
            inputChars[charNum] = ch;
            ctx.plotCharWithColor(ch as DisplayGlyph, { windowX: x + charNum, windowY: y }, white, black);
            if (charNum < maxLength - promptSuffixLen) {
                ctx.printString(suffix, charNum + x + 1, y, gray, black, null);
                charNum++;
            }
        }
    } while (keystroke !== RETURN_KEY && keystroke !== ESCAPE_KEY);

    if (useDialogBox && rbuf) {
        ctx.restoreDisplayBuffer(rbuf);
    }

    const inputText = String.fromCharCode(...inputChars.slice(0, charNum));

    if (keystroke === ESCAPE_KEY) {
        return null;
    }

    if (ctx.displayedMessage.length > 0) {
        ctx.displayedMessage[0] += inputText + suffix;
    }
    return inputText;
}

// =============================================================================
// keystrokeToDirection — helper
// =============================================================================

function keystrokeToDirection(keystroke: number): number {
    switch (keystroke) {
        case UP_KEY: case UP_ARROW: case NUMPAD_8: return Direction.Up;
        case DOWN_KEY: case DOWN_ARROW: case NUMPAD_2: return Direction.Down;
        case LEFT_KEY: case LEFT_ARROW: case NUMPAD_4: return Direction.Left;
        case RIGHT_KEY: case RIGHT_ARROW: case NUMPAD_6: return Direction.Right;
        case NUMPAD_7: case UPLEFT_KEY: return Direction.UpLeft;
        case UPRIGHT_KEY: case NUMPAD_9: return Direction.UpRight;
        case DOWNLEFT_KEY: case NUMPAD_1: return Direction.DownLeft;
        case DOWNRIGHT_KEY: case NUMPAD_3: return Direction.DownRight;
        default: return -1;
    }
}

// =============================================================================
// executeKeystroke — IO.c:2451
// =============================================================================

/**
 * Dispatch a single keystroke to the appropriate game action.
 *
 * @param openMenu — optional callback to open the action menu (avoids
 *   circular dep with input-mouse.ts where actionMenu lives).
 */
export async function executeKeystroke(
    ctx: InputContext,
    keystroke: number,
    controlKey: boolean,
    shiftKey: boolean,
    openMenu?: (x: number, playingBack: boolean) => Promise<number>,
): Promise<void> {
    ctx.confirmMessages();
    keystroke = stripShiftFromMovementKeystroke(keystroke);

    const direction = keystrokeToDirection(keystroke);

    if (direction < 0) {
        switch (keystroke) {
            case DESCEND_KEY:
                considerCautiousMode(ctx);
                if (ctx.D_WORMHOLING) {
                    ctx.recordKeystroke(DESCEND_KEY, false, false);
                    ctx.useStairs(1);
                } else if (ctx.proposeOrConfirmLocation(ctx.rogue.downLoc, "I see no way down.")) {
                    await ctx.travel(ctx.rogue.downLoc, true);
                }
                break;
            case ASCEND_KEY:
                considerCautiousMode(ctx);
                if (ctx.D_WORMHOLING) {
                    ctx.recordKeystroke(ASCEND_KEY, false, false);
                    ctx.useStairs(-1);
                } else if (ctx.proposeOrConfirmLocation(ctx.rogue.upLoc, "I see no way up.")) {
                    await ctx.travel(ctx.rogue.upLoc, true);
                }
                break;
            case RETURN_KEY:
                ctx.showCursor();
                break;
            case REST_KEY:
            case PERIOD_KEY:
            case NUMPAD_5:
                considerCautiousMode(ctx);
                ctx.rogue.justRested = true;
                ctx.recordKeystroke(REST_KEY, false, false);
                ctx.playerTurnEnded();
                break;
            case AUTO_REST_KEY:
                ctx.rogue.justRested = true;
                ctx.autoRest();
                break;
            case SEARCH_KEY:
                if (controlKey) {
                    ctx.rogue.disturbed = false;
                    ctx.rogue.automationActive = true;
                    do {
                        ctx.manualSearch();
                        if (pauseAnimation(ctx, 80, PAUSE_BEHAVIOR_DEFAULT)) {
                            ctx.rogue.disturbed = true;
                        }
                    } while (ctx.player.status[ctx.STATUS_SEARCHING] < 5 && !ctx.rogue.disturbed);
                    ctx.rogue.automationActive = false;
                } else {
                    ctx.manualSearch();
                }
                break;
            case INVENTORY_KEY:
                await ctx.displayInventory(ctx.ALL_ITEMS, 0, 0, true, true);
                break;
            case EQUIP_KEY:
                await ctx.equip(null);
                break;
            case UNEQUIP_KEY:
                await ctx.unequip(null);
                break;
            case DROP_KEY:
                await ctx.drop(null);
                break;
            case APPLY_KEY:
                await ctx.apply(null);
                break;
            case THROW_KEY:
                await ctx.throwCommand(null, false);
                break;
            case RETHROW_KEY:
                if (ctx.rogue.lastItemThrown != null && ctx.itemIsCarried(ctx.rogue.lastItemThrown)) {
                    await ctx.throwCommand(ctx.rogue.lastItemThrown, true);
                }
                break;
            case RELABEL_KEY:
                await ctx.relabel(null);
                break;
            case SWAP_KEY:
                ctx.swapLastEquipment();
                break;
            case TRUE_COLORS_KEY:
                ctx.rogue.trueColorMode = !ctx.rogue.trueColorMode;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                ctx.messageWithColor(
                    ctx.rogue.trueColorMode
                        ? (KEYBOARD_LABELS ? "Color effects disabled. Press '\\' again to enable." : "Color effects disabled.")
                        : (KEYBOARD_LABELS ? "Color effects enabled. Press '\\' again to disable." : "Color effects enabled."),
                    teal, 0,
                );
                break;
            case STEALTH_RANGE_KEY:
                ctx.rogue.displayStealthRangeMode = !ctx.rogue.displayStealthRangeMode;
                ctx.displayLevel();
                ctx.refreshSideBar(-1, -1, false);
                ctx.messageWithColor(
                    ctx.rogue.displayStealthRangeMode
                        ? (KEYBOARD_LABELS ? "Stealth range displayed. Press ']' again to hide." : "Stealth range displayed.")
                        : (KEYBOARD_LABELS ? "Stealth range hidden. Press ']' again to display." : "Stealth range hidden."),
                    teal, 0,
                );
                break;
            case CALL_KEY:
                await ctx.call(null);
                break;
            case EXPLORE_KEY:
                considerCautiousMode(ctx);
                await ctx.exploreKey(controlKey);
                break;
            case AUTOPLAY_KEY:
                if (await confirm(ctx, "Turn on autopilot?", false)) {
                    await ctx.autoPlayLevel(controlKey);
                }
                break;
            case MESSAGE_ARCHIVE_KEY:
                ctx.displayMessageArchive();
                break;
            case BROGUE_HELP_KEY:
                await ctx.printHelpScreen();
                break;
            case FEATS_KEY:
                await ctx.displayFeatsScreen();
                break;
            case DISCOVERIES_KEY:
                await ctx.printDiscoveriesScreen();
                break;
            case CREATE_ITEM_MONSTER_KEY:
                if (ctx.DEBUG) ctx.dialogCreateItemOrMonster();
                break;
            case SAVE_GAME_KEY:
                if (ctx.rogue.playbackMode || ctx.serverMode) return;
                if (await confirm(ctx, "Save this game and exit?", false)) {
                    ctx.saveGame();
                }
                break;
            case NEW_GAME_KEY:
                if (ctx.rogue.playerTurnNumber < 50 || await confirm(ctx, "End this game and begin a new game?", false)) {
                    ctx.rogue.nextGame = 1;
                    ctx.rogue.gameHasEnded = true;
                }
                break;
            case QUIT_KEY:
                if (await confirm(ctx, "Quit and abandon this game? (The save will be deleted.)", false)) {
                    ctx.recordKeystroke(QUIT_KEY, false, false);
                    ctx.rogue.quit = true;
                    ctx.gameOver("Quit", true);
                }
                break;
            case GRAPHICS_KEY:
                if (ctx.hasGraphics) {
                    ctx.graphicsMode = ctx.setGraphicsMode((ctx.graphicsMode + 1) % 3);
                    const modeMsg = ["Switched to text mode.", "Switched to graphical tiles.", "Switched to hybrid mode."];
                    const modeMsgKb = [
                        "Switched to text mode. Press 'G' again to enable tiles.",
                        "Switched to graphical tiles. Press 'G' again to enable hybrid mode.",
                        "Switched to hybrid mode. Press 'G' again to disable tiles.",
                    ];
                    ctx.messageWithColor(KEYBOARD_LABELS ? (modeMsgKb[ctx.graphicsMode] ?? "") : (modeMsg[ctx.graphicsMode] ?? ""), teal, 0);
                }
                break;
            case SEED_KEY:
                if (ctx.DEBUG) {
                    ctx.displayLoops();
                    ctx.displayChokeMap();
                    ctx.displayMachines();
                    ctx.displayWaypoints();
                }
                ctx.printSeed();
                break;
            case EASY_MODE_KEY:
                ctx.enableEasyMode();
                break;
            case PRINTSCREEN_KEY:
                if (ctx.takeScreenshot()) {
                    ctx.flashTemporaryAlert(" Screenshot saved in save directory ", 2000);
                }
                break;
            case ESCAPE_KEY: {
                if (openMenu) {
                    const menuResult = await openMenu(20, ctx.rogue.playbackMode);
                    if (menuResult > 0) {
                        await executeKeystroke(ctx, menuResult, false, false, openMenu);
                    }
                }
                break;
            }
            default:
                break;
        }
    }

    if (direction >= 0) {
        ctx.hideCursor();
        considerCautiousMode(ctx);
        if (controlKey || shiftKey) {
            await ctx.playerRuns(direction);
        } else {
            await ctx.playerMoves(direction);
        }
        ctx.refreshSideBar(-1, -1, false);
    }

    if (ctx.D_SAFETY_VISION && ctx.safetyMap) {
        ctx.displayGrid(ctx.safetyMap);
    }
    if (ctx.rogue.trueColorMode || ctx.D_SCENT_VISION) {
        ctx.displayLevel();
    }

    ctx.rogue.cautiousMode = false;
}

// =============================================================================
// executeEvent — RogueMain.c:45
// =============================================================================

/**
 * Dispatch a single event (keystroke or mouse click).
 *
 * @param onMouseClick — provided by input-mouse.ts to handle mouse clicks,
 *   avoiding circular dependency.
 */
export async function executeEvent(
    ctx: InputContext,
    theEvent: RogueEvent,
    onMouseClick?: (ctx: InputContext, event: RogueEvent) => Promise<void>,
    openMenu?: (x: number, playingBack: boolean) => Promise<number>,
): Promise<void> {
    ctx.rogue.playbackBetweenTurns = false;
    if (theEvent.eventType === EventType.Keystroke) {
        await executeKeystroke(ctx, theEvent.param1, theEvent.controlKey, theEvent.shiftKey, openMenu);
    } else if (
        theEvent.eventType === EventType.MouseUp ||
        theEvent.eventType === EventType.RightMouseUp
    ) {
        if (onMouseClick) {
            await onMouseClick(ctx, theEvent);
        }
    }
}
