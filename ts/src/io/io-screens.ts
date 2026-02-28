/*
 *  io-screens.ts — Info screens: help, high scores, feats, discoveries,
 *                  seed display, debug grid display
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: printHelpScreen, printHighScores, displayFeatsScreen,
 *             printDiscoveriesScreen, printDiscoveries (static helper),
 *             printSeed, displayGrid
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, Pos, WindowPos, ScreenDisplayBuffer, SavedDisplayBuffer, ItemTable } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import {
    COLS, ROWS, DCOLS, DROWS,
    STAT_BAR_WIDTH,
    INTERFACE_OPACITY,
    KEYBOARD_LABELS,
    HIGH_SCORES_COUNT,
    FEAT_NAME_LENGTH,
} from "../types/constants.js";
import {
    DisplayGlyph as G,
    ItemCategory,
    StaffKind,
    RingKind,
    GameMode,
} from "../types/enums.js";
import { TerrainFlag, T_WAYPOINT_BLOCKER } from "../types/flags.js";
import {
    black, white, gray, darkGray,
    itemMessageColor, itemColor,
    flavorTextColor,
    goodMessageColor, badMessageColor, advancementMessageColor,
} from "../globals/colors.js";

// =============================================================================
// Types
// =============================================================================

export interface RogueHighScoresEntry {
    score: number;
    date: string;
    description: string;
}

export interface FeatEntry {
    name: string;
    description: string;
    initialValue: boolean;
}

export interface BoltInfo {
    flags: number;
}

// =============================================================================
// DI Context
// =============================================================================

/**
 * Dependency-injection context for info-screen functions.
 */
export interface ScreenContext {
    rogue: {
        seed: number | bigint;
        playerTurnNumber: number;
        hideSeed: boolean;
        mode: GameMode;
        featRecord: boolean[];
        updatedSafetyMapThisTurn: boolean;
    };

    player: {
        loc: Pos;
    };

    gameConst: {
        numberFeats: number;
        numberScrollKinds: number;
        numberPotionKinds: number;
        numberWandKinds: number;
        versionString: string;
    };

    featTable: readonly FeatEntry[];
    boltCatalog: readonly BoltInfo[];

    // Item tables
    scrollTable: readonly ItemTable[];
    potionTable: readonly ItemTable[];
    ringTable: readonly ItemTable[];
    staffTable: readonly ItemTable[];
    wandTable: readonly ItemTable[];

    // Display helpers
    printString(
        str: string, x: number, y: number,
        foreColor: Readonly<Color>, backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer | null,
    ): void;
    plotCharToBuffer(
        glyph: DisplayGlyph, loc: WindowPos,
        foreColor: Readonly<Color>, backColor: Readonly<Color>,
        dbuf: ScreenDisplayBuffer,
    ): void;
    plotCharWithColor(
        glyph: DisplayGlyph, loc: WindowPos,
        foreColor: Readonly<Color>, backColor: Readonly<Color>,
        displayBuffer: ScreenDisplayBuffer,
    ): void;
    strLenWithoutEscapes(str: string): number;
    encodeMessageColor(color: Readonly<Color>): string;

    // Color manipulation
    applyColorAverage(target: Color, source: Readonly<Color>, weight: number): void;

    // Display buffer management
    createScreenDisplayBuffer(): ScreenDisplayBuffer;
    clearDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    saveDisplayBuffer(): SavedDisplayBuffer;
    restoreDisplayBuffer(rbuf: SavedDisplayBuffer): void;
    overlayDisplayBuffer(dbuf: ScreenDisplayBuffer): void;
    blackOutScreen(dbuf: ScreenDisplayBuffer): void;
    commitDraws(): void;

    // Coordinate mapping
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    mapToWindow(p: Pos): WindowPos;

    // Waiting
    waitForAcknowledgment(): void;
    waitForKeystrokeOrMouseClick(): void;

    // Message system
    message(msg: string, flags: number): void;
    updateFlavorText(): void;
    updateMessageDisplay(): void;

    // High scores
    getHighScoresList(): { list: RogueHighScoresEntry[]; mostRecentLine: number };

    // Map / terrain helpers
    cellHasTerrainFlag(pos: Pos, flagMask: number): boolean;
    getCellAppearance(loc: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color };

    // Safety map
    safetyMap: number[][] | null;
    updateSafetyMap(): void;

    // Table helpers
    tableForItemCategory(category: number): readonly ItemTable[] | null;
    magicCharDiscoverySuffix(category: number, kind: number): number;
    upperCase(str: string): string;

    /** WIZARD_MODE flag — true when in wizard/debug mode. */
    wizardMode: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const BROGUE_HELP_LINE_COUNT = 33;

// =============================================================================
// printHelpScreen
// =============================================================================

/**
 * Display the in-game help screen with command reference.
 *
 * C: `printHelpScreen` in IO.c
 */
export function printHelpScreen(ctx: ScreenContext): void {
    const helpText: string[] = [
        "",
        "",
        "          -- Commands --",
        "",
        "          mouse  ****move cursor (including to examine monsters and terrain)",
        "          click  ****travel",
        "  control-click  ****advance one space",
        "       <return>  ****enable keyboard cursor control",
        "    <space/esc>  ****disable keyboard cursor control",
        "hjklyubn, arrow keys, or numpad  ****move or attack (control or shift to run)",
        "",
        "a/e/r/t/d/c/R/w  ****apply/equip/remove/throw/drop/call/relabel/swap an item",
        "              T  ****re-throw last item at last monster",
        " i, right-click  ****view inventory",
        "              D  ****list discovered items",
        "",
        "              z  ****rest once",
        "              Z  ****rest for 100 turns or until something happens",
        "              s  ****search for secrets (control-s: long search)",
        "           <, >  ****travel to stairs",
        "              x  ****auto-explore (control-x: fast forward)",
        "              A  ****autopilot (control-A: fast forward)",
        "              M  ****display old messages",
        "              G  ****toggle graphical tiles (when available)",
        "",
        "              S  ****save and exit",
        "              Q  ****quit and abandon game",
        "",
        "              \\  ****disable/enable color effects",
        "              ]  ****display/hide stealth range",
        "    <space/esc>  ****clear message or cancel command",
        "",
        "        -- press space or click to continue --",
    ];

    // Replace "****" with color escape to white
    const whiteEsc = ctx.encodeMessageColor(white);
    for (let i = 0; i < helpText.length; i++) {
        helpText[i] = helpText[i].replace(/\*\*\*\*/g, whiteEsc);
    }

    const rbuf = ctx.saveDisplayBuffer();

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);

    // Print the text to the dbuf
    const lineCount = Math.min(BROGUE_HELP_LINE_COUNT, helpText.length, ROWS);
    for (let i = 0; i < lineCount; i++) {
        ctx.printString(helpText[i], ctx.mapToWindowX(1), i, itemMessageColor, black, dbuf);
    }

    // Set the dbuf opacity
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[ctx.mapToWindowX(i)][j].opacity = INTERFACE_OPACITY;
        }
    }

    // Display
    ctx.overlayDisplayBuffer(dbuf);
    ctx.waitForAcknowledgment();
    ctx.restoreDisplayBuffer(rbuf);
    ctx.updateFlavorText();
    ctx.updateMessageDisplay();
}

// =============================================================================
// printDiscoveries (static helper)
// =============================================================================

/**
 * Print a list of item discoveries for one category.
 *
 * C: `printDiscoveries` (static) in IO.c
 */
function printDiscoveries(
    ctx: ScreenContext,
    category: number,
    count: number,
    itemCharacter: DisplayGlyph,
    x: number,
    y: number,
    dbuf: ScreenDisplayBuffer,
): void {
    const goodColor: Color = { ...goodMessageColor };
    ctx.applyColorAverage(goodColor, black, 50);
    const badColor: Color = { ...badMessageColor };
    ctx.applyColorAverage(badColor, black, 50);

    const theTable = ctx.tableForItemCategory(category);
    if (!theTable) return;

    let totalFrequency = 0;
    for (let i = 0; i < count; i++) {
        if (!theTable[i].identified) {
            totalFrequency += theTable[i].frequency;
        }
    }

    for (let i = 0; i < count; i++) {
        let theColor: Readonly<Color>;
        if (theTable[i].identified) {
            theColor = white;
            ctx.plotCharToBuffer(itemCharacter, { windowX: x, windowY: y + i }, itemColor, black, dbuf);
        } else {
            theColor = darkGray;
            const magic = ctx.magicCharDiscoverySuffix(category, i);
            if (magic === 1) {
                ctx.plotCharToBuffer(G.G_GOOD_MAGIC, { windowX: x, windowY: y + i }, goodColor, black, dbuf);
            } else if (magic === -1) {
                ctx.plotCharToBuffer(G.G_BAD_MAGIC, { windowX: x, windowY: y + i }, badColor, black, dbuf);
            }
        }

        let buf = theTable[i].name;

        if (!theTable[i].identified
            && theTable[i].frequency > 0
            && totalFrequency > 0) {
            buf += ` (${Math.floor(theTable[i].frequency * 100 / totalFrequency)}%)`;
        }

        buf = ctx.upperCase(buf) + " ";
        ctx.printString(buf, x + 2, y + i, theColor, black, dbuf);
    }
}

// =============================================================================
// displayFeatsScreen
// =============================================================================

/**
 * Display the feats screen. Lists all feats and their achievement status.
 *
 * C: `displayFeatsScreen` in IO.c
 */
export function displayFeatsScreen(ctx: ScreenContext): void {
    const availableColorEscape = ctx.encodeMessageColor(white);
    const achievedColorEscape = ctx.encodeMessageColor(advancementMessageColor);
    const failedColorEscape = ctx.encodeMessageColor(badMessageColor);

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);

    // Title
    let buf = "-- FEATS --";
    let y = 1;
    ctx.printString(
        buf,
        ctx.mapToWindowX(Math.floor((DCOLS - FEAT_NAME_LENGTH - ctx.strLenWithoutEscapes(buf)) / 2)),
        y, flavorTextColor, black, dbuf,
    );

    // List of feats, color-coded by status
    for (let i = 0; i < ctx.gameConst.numberFeats; i++) {
        let featColorEscape: string;
        let featStatusChar: string;

        if (ctx.rogue.featRecord[i] === ctx.featTable[i].initialValue) {
            featColorEscape = availableColorEscape;
            featStatusChar = " ";
        } else if (ctx.rogue.featRecord[i]) {
            featColorEscape = achievedColorEscape;
            featStatusChar = "+";
        } else {
            featColorEscape = failedColorEscape;
            featStatusChar = "-";
        }

        const paddedName = ctx.featTable[i].name.padStart(FEAT_NAME_LENGTH);
        buf = `${paddedName} ${featColorEscape}${featStatusChar} ${ctx.featTable[i].description}`;
        ctx.printString(buf, ctx.mapToWindowX(0), y + i + 1, itemMessageColor, black, dbuf);
    }

    // Legend
    buf = "-- LEGEND --";
    ctx.printString(
        buf,
        ctx.mapToWindowX(Math.floor((DCOLS - FEAT_NAME_LENGTH - ctx.strLenWithoutEscapes(buf)) / 2)),
        ROWS - 5, gray, black, dbuf,
    );
    buf = `${failedColorEscape}Failed(-)  ${achievedColorEscape}Achieved(+)  `;
    ctx.printString(
        buf,
        ctx.mapToWindowX(Math.floor((DCOLS - FEAT_NAME_LENGTH - ctx.strLenWithoutEscapes(buf)) / 2)),
        ROWS - 4, white, black, dbuf,
    );

    buf = KEYBOARD_LABELS
        ? "-- press any key to continue --"
        : "-- touch anywhere to continue --";
    ctx.printString(
        buf,
        ctx.mapToWindowX(Math.floor((DCOLS - FEAT_NAME_LENGTH - ctx.strLenWithoutEscapes(buf)) / 2)),
        ROWS - 2, itemMessageColor, black, dbuf,
    );

    // Set the opacity
    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[i][j].opacity = (i < STAT_BAR_WIDTH ? 0 : INTERFACE_OPACITY);
        }
    }

    const rbuf = ctx.saveDisplayBuffer();
    ctx.overlayDisplayBuffer(dbuf);
    ctx.waitForKeystrokeOrMouseClick();
    ctx.restoreDisplayBuffer(rbuf);
}

// =============================================================================
// printDiscoveriesScreen
// =============================================================================

/**
 * Display the discoveries screen, showing all item kinds grouped by category.
 *
 * C: `printDiscoveriesScreen` in IO.c
 */
export function printDiscoveriesScreen(ctx: ScreenContext): void {
    const rbuf = ctx.saveDisplayBuffer();
    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.clearDisplayBuffer(dbuf);

    let y: number;

    ctx.printString("-- SCROLLS --", ctx.mapToWindowX(2), y = ctx.mapToWindowY(1), flavorTextColor, black, dbuf);
    printDiscoveries(ctx, ItemCategory.SCROLL, ctx.gameConst.numberScrollKinds, G.G_SCROLL, ctx.mapToWindowX(3), ++y, dbuf);

    ctx.printString("-- RINGS --", ctx.mapToWindowX(2), y += ctx.gameConst.numberScrollKinds + 1, flavorTextColor, black, dbuf);
    printDiscoveries(ctx, ItemCategory.RING, RingKind.NumberRingKinds, G.G_RING, ctx.mapToWindowX(3), ++y, dbuf);

    ctx.printString("-- POTIONS --", ctx.mapToWindowX(29), y = ctx.mapToWindowY(1), flavorTextColor, black, dbuf);
    printDiscoveries(ctx, ItemCategory.POTION, ctx.gameConst.numberPotionKinds, G.G_POTION, ctx.mapToWindowX(30), ++y, dbuf);

    ctx.printString("-- STAFFS --", ctx.mapToWindowX(53), y = ctx.mapToWindowY(1), flavorTextColor, black, dbuf);
    printDiscoveries(ctx, ItemCategory.STAFF, StaffKind.NumberStaffKinds, G.G_STAFF, ctx.mapToWindowX(54), ++y, dbuf);

    ctx.printString("-- WANDS --", ctx.mapToWindowX(53), y += StaffKind.NumberStaffKinds + 1, flavorTextColor, black, dbuf);
    printDiscoveries(ctx, ItemCategory.WAND, ctx.gameConst.numberWandKinds, G.G_WAND, ctx.mapToWindowX(54), ++y, dbuf);

    const continueText = KEYBOARD_LABELS
        ? "-- press any key to continue --"
        : "-- touch anywhere to continue --";
    ctx.printString(continueText, ctx.mapToWindowX(20), ctx.mapToWindowY(DROWS - 2), itemMessageColor, black, dbuf);

    for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
            dbuf.cells[i][j].opacity = (i < STAT_BAR_WIDTH ? 0 : INTERFACE_OPACITY);
        }
    }

    ctx.overlayDisplayBuffer(dbuf);
    ctx.waitForKeystrokeOrMouseClick();
    ctx.restoreDisplayBuffer(rbuf);
}

// =============================================================================
// printHighScores
// =============================================================================

/**
 * Display the high scores screen.
 *
 * C: `printHighScores` in IO.c
 */
export function printHighScores(ctx: ScreenContext, hiliteMostRecent: boolean): void {
    const { list, mostRecentLine } = ctx.getHighScoresList();
    let hiliteLineNum = hiliteMostRecent ? mostRecentLine : -1;

    const dbuf = ctx.createScreenDisplayBuffer();
    ctx.blackOutScreen(dbuf);

    // Find max description length
    let maxLength = 0;
    for (let i = 0; i < HIGH_SCORES_COUNT && list[i] && list[i].score > 0; i++) {
        const len = ctx.strLenWithoutEscapes(list[i].description);
        if (len > maxLength) {
            maxLength = len;
        }
    }

    const leftOffset = Math.min(COLS - maxLength - 23 - 1, Math.floor(COLS / 5));

    // Title
    const scoreColorTitle: Color = { ...black };
    ctx.applyColorAverage(scoreColorTitle, itemMessageColor, 100);
    ctx.printString("-- HIGH SCORES --", Math.floor((COLS - 17 + 1) / 2), 0, scoreColorTitle, black, null);

    // Scores
    for (let i = 0; i < HIGH_SCORES_COUNT && list[i] && list[i].score > 0; i++) {
        const scoreColor: Color = { ...black };
        if (i === hiliteLineNum) {
            ctx.applyColorAverage(scoreColor, itemMessageColor, 100);
        } else {
            ctx.applyColorAverage(scoreColor, white, 100);
            ctx.applyColorAverage(scoreColor, black, Math.floor(i * 50 / 24));
        }

        // Rank
        const rank = `${i + 1 < 10 ? " " : ""}${i + 1})`;
        ctx.printString(rank, leftOffset, i + 2, scoreColor, black, null);

        // Score
        ctx.printString(`${list[i].score}`, leftOffset + 5, i + 2, scoreColor, black, null);

        // Date
        ctx.printString(list[i].date, leftOffset + 12, i + 2, scoreColor, black, null);

        // Description
        ctx.printString(list[i].description, leftOffset + 23, i + 2, scoreColor, black, null);
    }

    // Footer
    const footerColor: Color = { ...black };
    ctx.applyColorAverage(footerColor, goodMessageColor, 100);
    const footerText = KEYBOARD_LABELS
        ? "Press space to continue."
        : "Touch anywhere to continue.";
    ctx.printString(
        footerText,
        Math.floor((COLS - ctx.strLenWithoutEscapes(footerText)) / 2),
        ROWS - 1, footerColor, black, null,
    );

    ctx.commitDraws();
    ctx.waitForAcknowledgment();
}

// =============================================================================
// displayGrid
// =============================================================================

/**
 * Debug display of a numeric grid (e.g. safety map, dijkstra map) as a
 * heat-map overlay on the dungeon.
 *
 * C: `displayGrid` in IO.c
 */
export function displayGrid(ctx: ScreenContext, map: number[][]): void {
    let topRange = -30000;
    let bottomRange = 30000;

    // Update safety map on demand
    if (map === ctx.safetyMap && !ctx.rogue.updatedSafetyMapThisTurn) {
        ctx.updateSafetyMap();
    }

    // Find the range of values
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (ctx.cellHasTerrainFlag({ x: i, y: j }, T_WAYPOINT_BLOCKER)
                || (map[i][j] === map[0][0])
                || (i === ctx.player.loc.x && j === ctx.player.loc.y)) {
                continue;
            }
            if (map[i][j] > topRange) {
                topRange = map[i][j];
            }
            if (map[i][j] < bottomRange) {
                bottomRange = map[i][j];
            }
        }
    }

    const displayBuffer = ctx.createScreenDisplayBuffer();

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (ctx.cellHasTerrainFlag({ x: i, y: j },
                    TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_LAVA_INSTA_DEATH)
                || (map[i][j] === map[0][0])
                || (i === ctx.player.loc.x && j === ctx.player.loc.y)) {
                continue;
            }
            const range = Math.max(1, topRange - bottomRange);
            let score = 300 - Math.floor((map[i][j] - bottomRange) * 300 / range);
            const tempColor: Color = {
                red: 0, green: 0, blue: 0,
                redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false,
            };
            tempColor.blue = Math.max(Math.min(score, 100), 0);
            score -= 100;
            tempColor.red = Math.max(Math.min(score, 100), 0);
            score -= 100;
            tempColor.green = Math.max(Math.min(score, 100), 0);

            const { glyph, foreColor } = ctx.getCellAppearance({ x: i, y: j });
            ctx.plotCharWithColor(glyph, ctx.mapToWindow({ x: i, y: j }), foreColor, tempColor, displayBuffer);
        }
    }
}

// =============================================================================
// printSeed
// =============================================================================

/**
 * Display a message with the seed #, turn #, game mode (except normal),
 * and game version.
 *
 * C: `printSeed` in IO.c
 */
export function printSeed(ctx: ScreenContext): void {
    let mode = "";
    if (ctx.rogue.mode === GameMode.Easy) {
        mode = "easy mode; ";
    } else if (ctx.wizardMode) {
        mode = "wizard mode; ";
    }

    let buf: string;
    if (ctx.rogue.hideSeed) {
        buf = `Dungeon seed HIDDEN; turn #${ctx.rogue.playerTurnNumber}; ${mode}version ${ctx.gameConst.versionString}`;
    } else {
        buf = `Dungeon seed #${ctx.rogue.seed}; turn #${ctx.rogue.playerTurnNumber}; ${mode}version ${ctx.gameConst.versionString}`;
    }

    ctx.message(buf, 0);
}
