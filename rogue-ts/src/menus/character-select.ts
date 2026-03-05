/*
 *  menus/character-select.ts — Game variant/mode selection, dialogs, file chooser, stats
 *  Port V2 — rogue-ts
 *
 *  Ported from: ts/src/menus/main-menu.ts (lines 866–1362)
 *  Source C: src/brogue/MainMenu.c (functions: chooseGameVariant, chooseGameMode,
 *             dialogAlert, quitImmediately, dialogChooseFile, viewGameStats,
 *             addRunToGameStats)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, BrogueButton } from "../types/types.js";
import { NGCommand, GameVariant, GameMode } from "../types/enums.js";
import { ButtonFlag } from "../types/flags.js";
import {
    COLS, ROWS, KEYBOARD_LABELS, INTERFACE_OPACITY,
    RETURN_KEY, ACKNOWLEDGE_KEY,
    UP_ARROW, DOWN_ARROW, PAGE_UP_KEY, PAGE_DOWN_KEY,
    NUMPAD_2, NUMPAD_8,
} from "../types/constants.js";
import type { MenuContext, GameStats, RogueRun } from "./menu-types.js";
import { initializeMainMenuButton } from "./menu-buttons.js";

export { GameStats, RogueRun };

const FILES_ON_PAGE_MAX = Math.min(26, ROWS - 7);
const MAX_FILENAME_DISPLAY_LENGTH = 53;

// =============================================================================
// chooseGameVariant — MainMenu.c:390
// =============================================================================

/**
 * Display a dialog to choose a game variant (Brogue / Rapid / Bullet).
 *
 * C: `chooseGameVariant` in MainMenu.c
 */
export async function chooseGameVariant(ctx: MenuContext): Promise<void> {
    const goldEsc = ctx.encodeMessageColor(ctx.yellow);
    const whiteEsc = ctx.encodeMessageColor(ctx.white);

    let textBuf = `${goldEsc}Brogue${whiteEsc}\n`;
    textBuf += "Classic Brogue. The endlessly captivating masterpiece of dungeon adventuring.\n\n";

    textBuf += `${goldEsc}Rapid Brogue${whiteEsc}\n`;
    textBuf += "Die faster and more often in this quarter-length version of the classic game!\n\n";

    textBuf += `${goldEsc}Bullet Brogue${whiteEsc}\n`;
    textBuf += "No time? Death wish? Bullet Brogue is for you. Not best for new players!\n\n";

    const buttons: BrogueButton[] = [
        initializeMainMenuButton("  %sR%sapid Brogue     ", "r".charCodeAt(0), "R".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("     %sB%srogue        ", "b".charCodeAt(0), "B".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("   Bu%sl%slet Brogue   ", "l".charCodeAt(0), "L".charCodeAt(0), NGCommand.Nothing, ctx),
    ];

    const rbuf = ctx.saveDisplayBuffer();
    const choice = await ctx.printTextBox(textBuf, 20, 7, 45, ctx.white, ctx.black, buttons, 3);
    ctx.restoreDisplayBuffer(rbuf);

    if (choice === 0) {
        ctx.setGameVariant(GameVariant.RapidBrogue);
    } else if (choice === 1) {
        ctx.setGameVariant(GameVariant.Brogue);
    } else if (choice === 2) {
        ctx.setGameVariant(GameVariant.BulletBrogue);
    } else {
        ctx.rogue.nextGame = NGCommand.Nothing;
    }
}

// =============================================================================
// chooseGameMode — MainMenu.c:430
// =============================================================================

/**
 * Display a dialog to choose a game mode (Normal / Easy / Wizard).
 *
 * C: `chooseGameMode` in MainMenu.c
 */
export async function chooseGameMode(ctx: MenuContext): Promise<void> {
    const goldEsc = ctx.encodeMessageColor(ctx.yellow);
    const whiteEsc = ctx.encodeMessageColor(ctx.white);

    let textBuf = `${goldEsc}Normal Mode${whiteEsc}\n`;
    textBuf += "Punishingly difficult. Maliciously alluring. Perfectly normal.\n\n";

    textBuf += `${goldEsc}Easy Mode${whiteEsc}\n`;
    textBuf += "Succumb to temptation and transform into a powerful demon, taking 20% as much damage. ";
    textBuf += "But great power comes at a great price -- you keep only 10% of your score.\n\n";

    textBuf += `${goldEsc}Wizard Mode${whiteEsc}\n`;
    textBuf += "Play as an invincible wizard that starts with legendary items and is magically reborn after every ";
    textBuf += "death. Summon monsters and make them friend or foe. Conjure any item out of thin air. ";
    textBuf += "(Your score is not saved.)";

    const buttons: BrogueButton[] = [
        initializeMainMenuButton("      %sW%sizard       ", "w".charCodeAt(0), "W".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("       %sE%sasy        ", "e".charCodeAt(0), "E".charCodeAt(0), NGCommand.Nothing, ctx),
        initializeMainMenuButton("      %sN%sormal       ", "n".charCodeAt(0), "N".charCodeAt(0), NGCommand.Nothing, ctx),
    ];

    const rbuf = ctx.saveDisplayBuffer();
    const choice = await ctx.printTextBox(textBuf, 10, 5, 66, ctx.white, ctx.black, buttons, 3);
    ctx.restoreDisplayBuffer(rbuf);

    if (choice === 0) {
        ctx.rogue.mode = GameMode.Wizard;
    } else if (choice === 1) {
        ctx.rogue.mode = GameMode.Easy;
    } else if (choice === 2) {
        ctx.rogue.mode = GameMode.Normal;
    }

    ctx.rogue.nextGame = NGCommand.Nothing;
}

// =============================================================================
// dialogAlert — MainMenu.c:640
// =============================================================================

/**
 * Display a simple alert dialog with an OK button.
 *
 * C: `dialogAlert` in MainMenu.c
 */
export async function dialogAlert(message: string, ctx: MenuContext): Promise<void> {
    const button = ctx.initializeButton();
    button.text = "     OK     ";
    button.hotkey = [RETURN_KEY, ACKNOWLEDGE_KEY];

    const rbuf = ctx.saveDisplayBuffer();
    await ctx.printTextBox(
        message,
        Math.trunc(COLS / 3),
        Math.trunc(ROWS / 3),
        Math.trunc(COLS / 3),
        ctx.white,
        ctx.interfaceBoxColor,
        [button],
        1,
    );
    ctx.restoreDisplayBuffer(rbuf);
}

// =============================================================================
// quitImmediately — MainMenu.c:624
// =============================================================================

/**
 * Closes the game without further prompts, saving recording/game if needed.
 *
 * C: `quitImmediately` in MainMenu.c
 */
export function quitImmediately(ctx: MenuContext): number {
    if (ctx.rogue.recording) {
        ctx.flushBufferToFile();
        if (ctx.rogue.gameInProgress && !ctx.rogue.quit && !ctx.rogue.gameHasEnded) {
            ctx.saveGameNoPrompt();
        } else {
            ctx.saveRecordingNoPrompt();
        }
    }
    return 0; // EXIT_STATUS_SUCCESS
}

// =============================================================================
// dialogChooseFile — MainMenu.c:690
// =============================================================================

/**
 * Display a paginated file chooser dialog. Returns the chosen file path,
 * or null if canceled.
 *
 * C: `dialogChooseFile` in MainMenu.c
 */
export async function dialogChooseFile(
    suffix: string,
    prompt: string,
    ctx: MenuContext,
): Promise<string | null> {
    let files = ctx.listFiles();
    const rbuf = ctx.saveDisplayBuffer();
    let maxPathLength = ctx.strLenWithoutEscapes(prompt);

    files = files.filter(f => f.path.endsWith(suffix));
    files.sort((a, b) => b.date.getTime() - a.date.getTime());

    for (const f of files) {
        const pathLen = Math.min(f.path.length, MAX_FILENAME_DISPLAY_LENGTH) + 10;
        if (pathLen > maxPathLength) {
            maxPathLength = pathLen;
        }
    }

    const count = files.length;

    if (count === 0) {
        ctx.restoreDisplayBuffer(rbuf);
        await dialogAlert("No applicable files found.", ctx);
        return null;
    }

    let currentPageStart = 0;
    let retval: string | null = null;
    let again: boolean;

    do {
        again = false;

        const pageCount = Math.min(count - currentPageStart, FILES_ON_PAGE_MAX);
        const buttons: BrogueButton[] = [];

        for (let i = 0; i < pageCount; i++) {
            const btn = ctx.initializeButton();
            btn.flags &= ~(ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_GRADIENT);
            btn.buttonColor = { ...ctx.interfaceBoxColor };

            let label = "";
            if (KEYBOARD_LABELS) {
                label = String.fromCharCode("a".charCodeAt(0) + i) + ") ";
            }

            let displayPath = files[currentPageStart + i].path;
            if (displayPath.endsWith(suffix)) {
                displayPath = displayPath.slice(0, displayPath.length - suffix.length);
            }
            if (displayPath.length > MAX_FILENAME_DISPLAY_LENGTH) {
                displayPath = displayPath.slice(0, MAX_FILENAME_DISPLAY_LENGTH - 3) + "...";
            }
            label += displayPath;

            btn.text = label;
            btn.hotkey = ["a".charCodeAt(0) + i, "A".charCodeAt(0) + i];
            buttons.push(btn);
        }

        const x = Math.trunc((COLS - maxPathLength) / 2);
        const width = maxPathLength;
        const height = pageCount + 2;
        const y = Math.max(4, Math.trunc((ROWS - height) / 2));

        for (let i = 0; i < pageCount; i++) {
            const pathLen = buttons[i].text.length;
            let padded = buttons[i].text;
            for (let j = pathLen; j < width - 10; j++) {
                padded += " ";
            }
            const d = files[currentPageStart + i].date;
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            padded += dateStr;
            buttons[i].text = padded;
            buttons[i].x = x;
            buttons[i].y = y + 1 + i;
        }

        if (count > FILES_ON_PAGE_MAX) {
            const upBtn = ctx.initializeButton();
            upBtn.text = "     *     ";
            upBtn.symbol = [ctx.G_UP_ARROW];
            if (currentPageStart <= 0) {
                upBtn.flags &= ~(ButtonFlag.B_ENABLED | ButtonFlag.B_DRAW);
            } else {
                upBtn.hotkey = [UP_ARROW, NUMPAD_8, PAGE_UP_KEY];
            }
            upBtn.x = x + Math.trunc((width - 11) / 2);
            upBtn.y = y;
            buttons.push(upBtn);

            const downBtn = ctx.initializeButton();
            downBtn.text = "     *     ";
            downBtn.symbol = [ctx.G_DOWN_ARROW];
            if (currentPageStart + FILES_ON_PAGE_MAX >= count) {
                downBtn.flags &= ~(ButtonFlag.B_ENABLED | ButtonFlag.B_DRAW);
            } else {
                downBtn.hotkey = [DOWN_ARROW, NUMPAD_2, PAGE_DOWN_KEY];
            }
            downBtn.x = x + Math.trunc((width - 11) / 2);
            downBtn.y = y + buttons.length;
            buttons.push(downBtn);
        }

        const dbuf = ctx.createScreenDisplayBuffer();
        ctx.clearDisplayBuffer(dbuf);
        ctx.printString(prompt, x, y - 1, ctx.itemMessageColor, ctx.interfaceBoxColor, dbuf);
        ctx.rectangularShading(x - 1, y - 1, width + 1, height + 1, ctx.interfaceBoxColor, INTERFACE_OPACITY, dbuf);
        ctx.overlayDisplayBuffer(dbuf);

        const totalButtons = pageCount + (count > FILES_ON_PAGE_MAX ? 2 : 0);
        const result = await ctx.buttonInputLoop(buttons, totalButtons, x, y, width, height);
        ctx.restoreDisplayBuffer(rbuf);

        const i = result.chosenButton;

        if (i >= 0 && i < pageCount) {
            retval = files[currentPageStart + i].path;
        } else if (i === pageCount) {
            again = true;
            currentPageStart -= FILES_ON_PAGE_MAX;
        } else if (i === pageCount + 1) {
            again = true;
            currentPageStart += FILES_ON_PAGE_MAX;
        } else {
            retval = null;
        }
    } while (again);

    return retval;
}

// =============================================================================
// Game stats — MainMenu.c:866–1090
// =============================================================================

/**
 * Create zeroed game stats.
 */
export function createGameStats(): GameStats {
    return {
        games: 0,
        escaped: 0,
        mastered: 0,
        won: 0,
        winRate: 0,
        deepestLevel: 0,
        cumulativeLevels: 0,
        highestScore: 0,
        cumulativeScore: 0,
        mostGold: 0,
        cumulativeGold: 0,
        mostLumenstones: 0,
        cumulativeLumenstones: 0,
        fewestTurnsWin: 0,
        cumulativeTurns: 0,
        longestWinStreak: 0,
        longestMasteryStreak: 0,
        currentWinStreak: 0,
        currentMasteryStreak: 0,
    };
}

/**
 * Update stats to include a run.
 *
 * C: `addRuntoGameStats` in MainMenu.c
 */
export function addRunToGameStats(run: RogueRun, stats: GameStats): void {
    stats.games++;
    stats.cumulativeScore += run.score;
    stats.cumulativeGold += run.gold;
    stats.cumulativeLumenstones += run.lumenstones;
    stats.cumulativeLevels += run.deepestLevel;
    stats.cumulativeTurns += run.turns;

    stats.highestScore = Math.max(stats.highestScore, run.score);
    stats.mostGold = Math.max(stats.mostGold, run.gold);
    stats.mostLumenstones = Math.max(stats.mostLumenstones, run.lumenstones);
    stats.deepestLevel = Math.max(stats.deepestLevel, run.deepestLevel);

    if (run.result === "Escaped" || run.result === "Mastered") {
        if (stats.fewestTurnsWin === 0 || run.turns < stats.fewestTurnsWin) {
            stats.fewestTurnsWin = run.turns;
        }
        stats.won++;
        stats.currentWinStreak++;
        if (run.result === "Mastered") {
            stats.currentMasteryStreak++;
            stats.mastered++;
        } else {
            stats.currentMasteryStreak = 0;
            stats.escaped++;
        }
    } else {
        stats.currentWinStreak = 0;
        stats.currentMasteryStreak = 0;
    }

    stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentWinStreak);
    stats.longestMasteryStreak = Math.max(stats.longestMasteryStreak, stats.currentMasteryStreak);

    stats.winRate = stats.games === 0 ? 0 : (stats.won / stats.games) * 100;
}

/**
 * Display the game stats screen (All Time + Recent).
 *
 * C: `viewGameStats` in MainMenu.c
 */
export async function viewGameStats(ctx: MenuContext): Promise<void> {
    const allTimeStats = createGameStats();
    const recentStats = createGameStats();

    const runHistory = ctx.loadRunHistory();

    for (const run of runHistory) {
        if (run.seed !== 0n) {
            addRunToGameStats(run, allTimeStats);
            addRunToGameStats(run, recentStats);
        } else {
            Object.assign(recentStats, createGameStats());
        }
    }

    const rbuf = ctx.saveDisplayBuffer();
    const displayBuffer = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(displayBuffer);

    const whiteEsc = ctx.encodeMessageColor(ctx.white);
    const yellowEsc = ctx.encodeMessageColor(ctx.itemMessageColor);

    const titleColor: Color = { ...ctx.black };
    ctx.applyColorAverage(titleColor, ctx.itemMessageColor, 100);
    ctx.printString("-- GAME STATS --", Math.trunc((COLS - 17 + 1) / 2), 0, titleColor, ctx.black, displayBuffer);

    let row = 4;
    const offset = 21;

    const pad = (s: string, width: number) => s.padStart(width);
    const padLeft = (s: string, width: number) => s.padEnd(width);

    const printRow = (label: string, allTime: string, recent: string) => {
        const line = padLeft(label, 30) + whiteEsc + pad(allTime, 16) + pad(recent, 16);
        ctx.printString(line, offset, row, ctx.itemMessageColor, ctx.black, displayBuffer);
        row++;
    };

    const printRowSingle = (label: string, value: string) => {
        const line = padLeft(label, 30) + whiteEsc + pad(value, 32);
        ctx.printString(line, offset, row, ctx.itemMessageColor, ctx.black, displayBuffer);
        row++;
    };

    const header = padLeft("", 30) + pad("All Time", 16) + pad("Recent", 16);
    ctx.printString(header, offset, row, ctx.itemMessageColor, ctx.black, displayBuffer);
    row++;

    printRow("Games Played", String(allTimeStats.games), String(recentStats.games));
    row++;
    printRow("Won", String(allTimeStats.won), String(recentStats.won));
    printRow("Win Rate (%)", allTimeStats.winRate.toFixed(1), recentStats.winRate.toFixed(1));
    printRow("Escaped", String(allTimeStats.escaped), String(recentStats.escaped));
    printRow("Mastered", String(allTimeStats.mastered), String(recentStats.mastered));
    row++;
    printRow("High Score", String(allTimeStats.highestScore), String(recentStats.highestScore));
    printRow("Most Gold", String(allTimeStats.mostGold), String(recentStats.mostGold));
    printRow("Most Lumenstones", String(allTimeStats.mostLumenstones), String(recentStats.mostLumenstones));
    row++;
    printRow("Deepest Level", String(allTimeStats.deepestLevel), String(recentStats.deepestLevel));

    const allTimeAvgDepth = allTimeStats.games > 0
        ? (allTimeStats.cumulativeLevels / allTimeStats.games).toFixed(1) : "0.0";
    const recentAvgDepth = recentStats.games > 0
        ? (recentStats.cumulativeLevels / recentStats.games).toFixed(1) : "0.0";
    printRow("Average Depth", allTimeAvgDepth, recentAvgDepth);

    const allTimeFastest = allTimeStats.fewestTurnsWin > 0 ? String(allTimeStats.fewestTurnsWin) : "-";
    const recentFastest = recentStats.fewestTurnsWin > 0 ? String(recentStats.fewestTurnsWin) : "-";
    printRow("Shortest Win (Turns)", allTimeFastest, recentFastest);
    row++;
    printRow("Longest Win Streak", String(allTimeStats.longestWinStreak), String(recentStats.longestWinStreak));
    printRow("Longest Mastery Streak", String(allTimeStats.longestMasteryStreak), String(recentStats.longestMasteryStreak));
    row++;
    printRowSingle("Current Win Streak", String(recentStats.currentWinStreak));
    printRowSingle("Current Mastery Streak", String(recentStats.currentMasteryStreak));
    row++;

    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            displayBuffer.cells[i][j].opacity = INTERFACE_OPACITY;
        }
    }

    ctx.overlayDisplayBuffer(displayBuffer);

    const continueColor: Color = { ...ctx.black };
    ctx.applyColorAverage(continueColor, ctx.goodMessageColor, 100);

    const continueText = KEYBOARD_LABELS
        ? "Press space or click to continue."
        : "Touch anywhere to continue.";
    ctx.printString(
        continueText,
        Math.trunc((COLS - ctx.strLenWithoutEscapes(continueText)) / 2),
        ROWS - 1,
        continueColor,
        ctx.black,
        null,
    );

    ctx.commitDraws();

    if (recentStats.games > 0) {
        const resetButtons: BrogueButton[] = [ctx.initializeButton()];
        if (KEYBOARD_LABELS) {
            resetButtons[0].text = `  ${yellowEsc}R${whiteEsc}eset  `;
        } else {
            resetButtons[0].text = "  Reset  ";
        }
        resetButtons[0].hotkey = ["R".charCodeAt(0), "r".charCodeAt(0)];
        resetButtons[0].x = 74;
        resetButtons[0].y = row;

        const result = await ctx.buttonInputLoop(resetButtons, 1, 74, 25, 10, 3);
        if (result.chosenButton === 0 && await ctx.confirm("Reset recent stats?", false)) {
            ctx.saveResetRun();
        }
    } else {
        await ctx.waitForKeystrokeOrMouseClick();
    }

    ctx.restoreDisplayBuffer(rbuf);
}

