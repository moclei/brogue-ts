/*
 *  game-lifecycle.ts — Game over, victory, easy mode
 *  brogue-ts
 *
 *  Ported from: src/brogue/RogueMain.c (lines 1046–1403)
 *  Functions: gameOver, victory, enableEasyMode
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    Creature,
    GameConstants,
    Item,
    RogueHighScoresEntry,
    ScreenDisplayBuffer,
    WindowPos,
    RogueEvent,
} from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { GameMode, EventType, ItemCategory } from "../types/enums.js";
import { MonsterBookkeepingFlag, MessageFlag, ItemFlag } from "../types/flags.js";
import {
    COLS, ROWS,
    ACKNOWLEDGE_KEY, ESCAPE_KEY, INVENTORY_KEY, EASY_MODE_KEY,
} from "../types/constants.js";

import { setPlayerDisplayChar, D_IMMORTAL, EXIT_STATUS_SUCCESS } from "./game-init.js";

// =============================================================================
// Notification event types
// =============================================================================

export const GAMEOVER_DEATH = "death";
export const GAMEOVER_QUIT = "quit";
export const GAMEOVER_VICTORY = "victory";
export const GAMEOVER_SUPERVICTORY = "supervictory";
export const GAMEOVER_RECORDING = "recording";

// =============================================================================
// DI Context
// =============================================================================

/**
 * Minimal rogue state for the lifecycle module.
 */
export interface LifecycleRogueState {
    mode: GameMode;
    gameInProgress: boolean;
    gameHasEnded: boolean;
    highScoreSaved: boolean;
    quit: boolean;
    autoPlayingLevel: boolean;
    playbackMode: boolean;
    playbackFastForward: boolean;
    creaturesWillFlashThisTurn: boolean;
    depthLevel: number;
    gold: number;
    goldGenerated: number;
    playerTurnNumber: number;
    currentGamePath: string;
    gameExitStatusCode: number;
    featRecord: boolean[];
}

/**
 * Dependency-injection context for the lifecycle module.
 */
export interface LifecycleContext {
    rogue: LifecycleRogueState;
    player: Creature;
    gameConst: GameConstants;

    /** Whether running in server mode (auto-save recording, no prompts). */
    serverMode: boolean;

    /** Whether non-interactive playback is active. */
    nonInteractivePlayback: boolean;

    /** Pack items list. */
    packItems: Item[];

    /** Feat table for achievements. */
    featTable: readonly { name: string; description: string; initialValue: boolean }[];

    // -- Display primitives ---------------------------------------------------

    displayBuffer: ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    blackOutScreen(dbuf: ScreenDisplayBuffer): void;
    displayLevel(): void;
    refreshSideBar(x: number, y: number, justClearing: boolean): void;

    // -- Display functions -----------------------------------------------------

    printString(
        str: string,
        x: number,
        y: number,
        fg: Readonly<Color>,
        bg: Readonly<Color>,
        dbuf: ScreenDisplayBuffer | null,
    ): void;
    plotCharToBuffer(
        ch: DisplayGlyph,
        pos: WindowPos,
        fg: Readonly<Color>,
        bg: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): void;
    funkyFade(
        dbuf: ScreenDisplayBuffer,
        colorStart: Readonly<Color>,
        startDelay: number,
        duration: number,
        cx: number,
        cy: number,
        inward: boolean,
    ): void;
    strLenWithoutEscapes(str: string): number;
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;

    // -- Messages & dialogs ---------------------------------------------------

    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;
    confirmMessages(): void;
    deleteMessages(): void;
    displayMoreSign(): void;
    displayMoreSignWithoutWaitingForAcknowledgment(): void;
    flashTemporaryAlert(msg: string, time: number): void;
    confirm(prompt: string, alsoDuringPlayback: boolean): boolean;

    // -- Input ----------------------------------------------------------------

    nextBrogueEvent(event: RogueEvent, textInput: boolean, colorsDance: boolean, realInputOnly: boolean): void;

    // -- Item operations ------------------------------------------------------

    identify(item: Item): void;
    itemName(item: Item, includeDetails: boolean, includeArticle: boolean, color: Readonly<Color>): string;
    upperCase(buf: string): string;
    itemValue(item: Item): number;
    numberOfMatchingPackItems(category: number, flags: number, flags2: number, useFlags: boolean): number;
    isVowelish(word: string): boolean;
    displayInventory(categoryMask: number, flags: number, flags2: number, showAll: boolean, justCount: boolean): number;

    // -- Recording & scoring --------------------------------------------------

    flushBufferToFile(): void;
    saveHighScore(entry: RogueHighScoresEntry): boolean;
    printHighScores(highlight: boolean): void;
    saveRecording(filenameOut: string[]): void;
    saveRecordingNoPrompt(filenameOut: string[]): void;
    notifyEvent(type: string, score: number, data: number, description: string, recording: string): void;
    saveRunHistory(result: string, killedBy: string, score: number, gems: number): void;
    recordKeystroke(key: number, controlKey: boolean, shiftKey: boolean): void;

    // -- Player display -------------------------------------------------------

    refreshDungeonCell(loc: { x: number; y: number }): void;
    encodeMessageColor(buf: string[], pos: number, color: Readonly<Color>): void;

    // -- Color references -----------------------------------------------------

    black: Readonly<Color>;
    white: Readonly<Color>;
    gray: Readonly<Color>;
    yellow: Readonly<Color>;
    lightBlue: Readonly<Color>;
    badMessageColor: Readonly<Color>;
    itemMessageColor: Readonly<Color>;
    advancementMessageColor: Readonly<Color>;
    superVictoryColor: Readonly<Color>;

    // -- Displayed messages (writable) ----------------------------------------

    displayedMessage: string[];

    // -- Glyph references -----------------------------------------------------

    G_GOLD: DisplayGlyph;
    G_AMULET: DisplayGlyph;
}

// =============================================================================
// gameOver — death handling, scoring, save recording
// =============================================================================

/**
 * Port of C `gameOver()`.
 *
 * Handles player death: shows death message, allows inventory review,
 * saves high score and recording, fires notification events.
 */
export function gameOver(ctx: LifecycleContext, killedBy: string, useCustomPhrasing: boolean): void {
    const { rogue, player, gameConst: gc } = ctx;

    if (player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) {
        // We've already been through this once; avoid overkill.
        return;
    }

    player.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
    rogue.autoPlayingLevel = false;
    rogue.gameInProgress = false;
    ctx.flushBufferToFile();

    if (rogue.playbackFastForward) {
        rogue.playbackFastForward = false;
        ctx.displayLevel();
    }

    if (rogue.quit) {
        if (rogue.playbackMode) {
            const savedPlayback = rogue.playbackMode;
            rogue.playbackMode = false;
            ctx.message("(The player quit at this point.)", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
            rogue.playbackMode = savedPlayback;
        }
    } else {
        const playback = rogue.playbackMode;
        if (!D_IMMORTAL && !ctx.nonInteractivePlayback) {
            rogue.playbackMode = false;
        }

        let buf = "You die...";
        // Note: keyboard label hint is informational only
        if (true /* KEYBOARD_LABELS */) {
            buf += " (press 'i' to view your inventory)";
        }
        player.currentHP = 0; // Show empty in the side bar
        ctx.refreshSideBar(-1, -1, false);
        ctx.messageWithColor(buf, ctx.badMessageColor, 0);
        ctx.displayMoreSignWithoutWaitingForAcknowledgment();

        // Input loop: wait for acknowledge, allow inventory viewing
        const theEvent: RogueEvent = createEmptyEvent();
        let done = false;
        while (!done) {
            if (rogue.playbackMode) break;
            ctx.nextBrogueEvent(theEvent, false, false, false);
            if (theEvent.eventType === EventType.Keystroke
                && theEvent.param1 !== ACKNOWLEDGE_KEY
                && theEvent.param1 !== ESCAPE_KEY
                && theEvent.param1 !== INVENTORY_KEY) {
                ctx.flashTemporaryAlert(
                    " -- Press space or click to continue, or press 'i' to view inventory -- ",
                    1500,
                );
            } else if (theEvent.eventType === EventType.Keystroke
                && theEvent.param1 === INVENTORY_KEY) {
                for (const item of ctx.packItems) {
                    ctx.identify(item);
                    item.flags &= ~ItemFlag.ITEM_MAGIC_DETECTED;
                }
                ctx.displayInventory(ItemCategory.FOOD | ItemCategory.POTION | ItemCategory.WEAPON |
                    ItemCategory.ARMOR | ItemCategory.STAFF | ItemCategory.WAND |
                    ItemCategory.SCROLL | ItemCategory.RING | ItemCategory.CHARM |
                    ItemCategory.GOLD | ItemCategory.AMULET | ItemCategory.GEM | ItemCategory.KEY,
                    0, 0, true, false);
            }
            if ((theEvent.eventType === EventType.Keystroke
                    && (theEvent.param1 === ACKNOWLEDGE_KEY || theEvent.param1 === ESCAPE_KEY))
                || theEvent.eventType === EventType.MouseUp) {
                done = true;
            }
        }

        ctx.confirmMessages();
        rogue.playbackMode = playback;
    }

    rogue.creaturesWillFlashThisTurn = false;

    if (D_IMMORTAL && !rogue.quit) {
        ctx.message("...but then you get better.", 0);
        player.currentHP = player.info.maxHP;
        // If nutrition is critical, restore it
        player.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_IS_DYING;
        rogue.gameInProgress = true;
        return;
    }

    if (rogue.highScoreSaved) {
        return;
    }
    rogue.highScoreSaved = true;

    if (rogue.quit) {
        ctx.blackOutScreen(ctx.displayBuffer);
    } else {
        const dbuf = ctx.displayBuffer;
        ctx.funkyFade(
            dbuf, ctx.black, 0, 120,
            ctx.mapToWindowX(player.loc.x), ctx.mapToWindowY(player.loc.y),
            false,
        );
    }

    // Build death description
    let buf: string;
    if (useCustomPhrasing) {
        buf = `${killedBy} on depth ${rogue.depthLevel}`;
    } else {
        const article = ctx.isVowelish(killedBy) ? "n" : "";
        buf = `Killed by a${article} ${killedBy} on depth ${rogue.depthLevel}`;
    }

    // Count gems as 500 gold each
    const numGems = ctx.numberOfMatchingPackItems(ItemCategory.GEM, 0, 0, false);
    rogue.gold += 500 * numGems;

    const theEntry: RogueHighScoresEntry = {
        score: rogue.gold,
        date: new Date().toISOString(),
        description: "",
    };

    if (rogue.mode === GameMode.Easy) {
        theEntry.score = Math.floor(theEntry.score / 10);
    }

    const highScoreText = buf + ".";

    if (theEntry.score > 0) {
        const treasureDesc = numGems > 0
            ? ` with treasure worth ${theEntry.score} gold`
            : ` with ${theEntry.score} gold`;
        buf += treasureDesc;
    }
    if (ctx.numberOfMatchingPackItems(ItemCategory.AMULET, 0, 0, false) > 0) {
        buf += ", amulet in hand";
    }
    buf += ".";
    theEntry.description = highScoreText;

    if (!rogue.quit) {
        ctx.printString(
            buf,
            Math.floor((COLS - ctx.strLenWithoutEscapes(buf)) / 2),
            Math.floor(ROWS / 2),
            ctx.gray, ctx.black, null,
        );

        let y = Math.floor(ROWS / 2) + 3;
        for (let i = 0; i < gc.numberFeats; i++) {
            if (rogue.featRecord[i] && !ctx.featTable[i].initialValue) {
                const featBuf = `${ctx.featTable[i].name}: ${ctx.featTable[i].description}`;
                ctx.printString(
                    featBuf,
                    Math.floor((COLS - ctx.strLenWithoutEscapes(featBuf)) / 2),
                    y,
                    ctx.advancementMessageColor, ctx.black, null,
                );
                y++;
            }
        }

        ctx.displayMoreSign();
    }

    const recordingFilename: string[] = [];

    if (ctx.serverMode) {
        ctx.blackOutScreen(ctx.displayBuffer);
        ctx.saveRecordingNoPrompt(recordingFilename);
    } else {
        if (!rogue.playbackMode && ctx.saveHighScore(theEntry)) {
            ctx.printHighScores(true);
        }
        ctx.blackOutScreen(ctx.displayBuffer);
        ctx.saveRecording(recordingFilename);
    }

    if (!rogue.playbackMode) {
        if (!rogue.quit) {
            ctx.notifyEvent(GAMEOVER_DEATH, theEntry.score, 0, theEntry.description, recordingFilename[0] || "");
        } else {
            ctx.notifyEvent(GAMEOVER_QUIT, theEntry.score, 0, theEntry.description, recordingFilename[0] || "");
        }
    } else {
        ctx.notifyEvent(GAMEOVER_RECORDING, 0, 0, "recording ended", "none");
    }

    if (!rogue.playbackMode
        && rogue.mode !== GameMode.Easy
        && rogue.mode !== GameMode.Wizard) {
        ctx.saveRunHistory(
            rogue.quit ? "Quit" : "Died",
            rogue.quit ? "-" : killedBy,
            theEntry.score,
            numGems,
        );
    }

    rogue.gameHasEnded = true;
    rogue.gameExitStatusCode = EXIT_STATUS_SUCCESS;
}

// =============================================================================
// victory — victory screens, treasure tally, achievements
// =============================================================================

/**
 * Port of C `victory()`.
 *
 * Handles game victory: congratulations screens, item value tally,
 * achievements display, high score save, recording save.
 */
export function victory(ctx: LifecycleContext, superVictory: boolean): void {
    const { rogue, player, gameConst: gc } = ctx;

    rogue.gameInProgress = false;
    ctx.flushBufferToFile();

    if (rogue.playbackFastForward) {
        rogue.playbackFastForward = false;
        ctx.displayLevel();
    }

    // ---- First screen — Congratulations ----
    if (superVictory) {
        ctx.message("Light streams through the portal, and you are teleported out of the dungeon.", 0);
        ctx.funkyFade(
            ctx.displayBuffer, ctx.superVictoryColor, 0, 240,
            ctx.mapToWindowX(player.loc.x), ctx.mapToWindowY(player.loc.y),
            false,
        );
        ctx.displayMoreSign();
        ctx.printString(
            "Congratulations; you have transcended the Dungeons of Doom!                 ",
            ctx.mapToWindowX(0), ctx.mapToWindowY(-1),
            ctx.black, ctx.white, null,
        );
        ctx.displayMoreSign();
        ctx.clearDisplayBuffer(ctx.displayBuffer);
        ctx.deleteMessages();
        ctx.displayedMessage[0] = "You retire in splendor, forever renowned for your remarkable triumph.     ";
    } else {
        ctx.message("You are bathed in sunlight as you throw open the heavy doors.", 0);
        ctx.funkyFade(
            ctx.displayBuffer, ctx.white, 0, 240,
            ctx.mapToWindowX(player.loc.x), ctx.mapToWindowY(player.loc.y),
            false,
        );
        ctx.displayMoreSign();
        ctx.printString(
            "Congratulations; you have escaped from the Dungeons of Doom!     ",
            ctx.mapToWindowX(0), ctx.mapToWindowY(-1),
            ctx.black, ctx.white, null,
        );
        ctx.displayMoreSign();
        ctx.deleteMessages();
        ctx.displayedMessage[0] = "You sell your treasures and live out your days in fame and glory.";
    }

    const dbuf = ctx.displayBuffer;
    ctx.clearDisplayBuffer(dbuf);

    // ---- Second screen — Inventory and item values ----
    ctx.printString(
        ctx.displayedMessage[0],
        ctx.mapToWindowX(0), ctx.mapToWindowY(-1),
        ctx.white, ctx.black, dbuf,
    );

    ctx.plotCharToBuffer(
        ctx.G_GOLD,
        { windowX: ctx.mapToWindowX(2), windowY: ctx.mapToWindowY(1) },
        ctx.yellow, ctx.black, dbuf,
    );
    ctx.printString("Gold", ctx.mapToWindowX(4), ctx.mapToWindowY(1), ctx.white, ctx.black, dbuf);
    ctx.printString(
        `${rogue.gold}`,
        ctx.mapToWindowX(60), ctx.mapToWindowY(1),
        ctx.itemMessageColor, ctx.black, dbuf,
    );
    let totalValue = rogue.gold;
    let gemCount = 0;

    let row = 4;
    for (const theItem of ctx.packItems) {
        if (theItem.category & ItemCategory.GEM) {
            gemCount += theItem.quantity;
        }
        if (theItem.category === ItemCategory.AMULET && superVictory) {
            ctx.plotCharToBuffer(
                ctx.G_AMULET,
                { windowX: ctx.mapToWindowX(2), windowY: Math.min(ROWS - 1, row + 1) },
                ctx.yellow, ctx.black, dbuf,
            );
            ctx.printString(
                "The Birthright of Yendor",
                ctx.mapToWindowX(4), Math.min(ROWS - 1, row + 1),
                ctx.itemMessageColor, ctx.black, dbuf,
            );
            const amuletValue = Math.max(0, ctx.itemValue(theItem) * 2);
            ctx.printString(
                `${amuletValue}`,
                ctx.mapToWindowX(60), Math.min(ROWS - 1, row + 1),
                ctx.itemMessageColor, ctx.black, dbuf,
            );
            totalValue += amuletValue;
            row++;
        } else {
            ctx.identify(theItem);
            let itemBuf = ctx.itemName(theItem, true, true, ctx.white);
            itemBuf = ctx.upperCase(itemBuf);

            ctx.plotCharToBuffer(
                theItem.displayChar,
                { windowX: ctx.mapToWindowX(2), windowY: Math.min(ROWS - 1, row + 1) },
                ctx.yellow, ctx.black, dbuf,
            );
            ctx.printString(
                itemBuf,
                ctx.mapToWindowX(4), Math.min(ROWS - 1, row + 1),
                ctx.white, ctx.black, dbuf,
            );

            const val = ctx.itemValue(theItem);
            if (val > 0) {
                ctx.printString(
                    `${Math.max(0, val)}`,
                    ctx.mapToWindowX(60), Math.min(ROWS - 1, row + 1),
                    ctx.itemMessageColor, ctx.black, dbuf,
                );
            }

            totalValue += Math.max(0, val);
            row++;
        }
    }
    row++;
    ctx.printString("TOTAL:", ctx.mapToWindowX(2), Math.min(ROWS - 1, row + 1), ctx.lightBlue, ctx.black, dbuf);
    ctx.printString(
        `${totalValue}`,
        ctx.mapToWindowX(60), Math.min(ROWS - 1, row + 1),
        ctx.lightBlue, ctx.black, dbuf,
    );

    ctx.funkyFade(dbuf, ctx.white, 0, 120, Math.floor(COLS / 2), Math.floor(ROWS / 2), true);
    ctx.displayMoreSign();

    // ---- Third screen — Achievements and recording save ----
    ctx.blackOutScreen(ctx.displayBuffer);

    let i = 4;
    ctx.printString("Achievements", ctx.mapToWindowX(2), i++, ctx.lightBlue, ctx.black, null);
    i++;
    for (let j = 0; i < ROWS && j < gc.numberFeats; j++) {
        if (rogue.featRecord[j]) {
            const featBuf = `${ctx.featTable[j].name}: ${ctx.featTable[j].description}`;
            ctx.printString(featBuf, ctx.mapToWindowX(2), i, ctx.advancementMessageColor, ctx.black, null);
            i++;
        }
    }

    const victoryVerb = superVictory ? "Mastered" : "Escaped";
    const theEntry: RogueHighScoresEntry = {
        score: totalValue,
        date: new Date().toISOString(),
        description: "",
    };

    if (gemCount === 0) {
        theEntry.description = `${victoryVerb} the Dungeons of Doom!`;
    } else if (gemCount === 1) {
        theEntry.description = `${victoryVerb} the Dungeons of Doom with a lumenstone!`;
    } else {
        theEntry.description = `${victoryVerb} the Dungeons of Doom with ${gemCount} lumenstones!`;
    }

    if (rogue.mode === GameMode.Easy) {
        theEntry.score = Math.floor(theEntry.score / 10);
    }

    let qualified = false;
    if (rogue.mode !== GameMode.Wizard && !rogue.playbackMode) {
        qualified = ctx.saveHighScore(theEntry);
    }

    ctx.displayMoreSign();

    const recordingFilename: string[] = [];
    if (ctx.serverMode) {
        ctx.saveRecordingNoPrompt(recordingFilename);
    } else {
        ctx.blackOutScreen(ctx.displayBuffer);
        ctx.saveRecording(recordingFilename);
        ctx.printHighScores(qualified);
    }

    if (!rogue.playbackMode) {
        if (superVictory) {
            ctx.notifyEvent(GAMEOVER_SUPERVICTORY, theEntry.score, 0, theEntry.description, recordingFilename[0] || "");
        } else {
            ctx.notifyEvent(GAMEOVER_VICTORY, theEntry.score, 0, theEntry.description, recordingFilename[0] || "");
        }
    } else {
        ctx.notifyEvent(GAMEOVER_RECORDING, 0, 0, "recording ended", "none");
    }

    if (!rogue.playbackMode
        && rogue.mode !== GameMode.Easy
        && rogue.mode !== GameMode.Normal) {
        ctx.saveRunHistory(victoryVerb, "-", theEntry.score, gemCount);
    }

    rogue.gameHasEnded = true;
    rogue.gameExitStatusCode = EXIT_STATUS_SUCCESS;
}

// =============================================================================
// enableEasyMode — switch to easy mode during gameplay
// =============================================================================

/**
 * Port of C `enableEasyMode()`.
 */
export function enableEasyMode(ctx: LifecycleContext): void {
    const { rogue, player } = ctx;

    if (rogue.mode === GameMode.Easy) {
        ctx.message("Alas, all hope of salvation is lost. You shed scalding tears at your plight.", 0);
        return;
    }
    ctx.message(
        "A dark presence surrounds you, whispering promises of stolen power.",
        MessageFlag.REQUIRE_ACKNOWLEDGMENT,
    );
    if (ctx.confirm("Succumb to demonic temptation (i.e. enable Easy Mode)?", false)) {
        ctx.recordKeystroke(EASY_MODE_KEY, false, true);
        ctx.message("An ancient and terrible evil burrows into your willing flesh!", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
        rogue.mode = GameMode.Easy;
        setPlayerDisplayChar(player, rogue.mode);
        ctx.refreshDungeonCell(player.loc);
        ctx.refreshSideBar(-1, -1, false);
        ctx.message("Wracked by spasms, your body contorts into an ALL-POWERFUL AMPERSAND!!!", 0);
        ctx.message("You have a feeling that you will take 20% as much damage from now on.", 0);
        ctx.message("But great power comes at a great price -- specifically, a 90% income tax rate.", 0);
    } else {
        ctx.message("The evil dissipates, hissing, from the air around you.", 0);
    }
}

// =============================================================================
// Helpers
// =============================================================================

function createEmptyEvent(): RogueEvent {
    return {
        eventType: EventType.Keystroke,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
    };
}
