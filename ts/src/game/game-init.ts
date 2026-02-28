/*
 *  game-init.ts — Game initialization, variant setup, helper utilities
 *  brogue-ts
 *
 *  Ported from: src/brogue/RogueMain.c (lines 33–535)
 *  Functions: rogueMain, printBrogueVersion, fileExists, chooseFile, openFile,
 *             getOrdinalSuffix, welcome, initializeGameVariant,
 *             initializeRogue, setPlayerDisplayChar
 *
 *  Also ports setPlayerDisplayChar from src/brogue/Monsters.c (lines 409–415)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    Creature,
    CreatureType,
    Fixpt,
    GameConstants,
    Item,
    LevelData,
    LightSource,
    MeteredItem,
    MeteredItemGenerationTable,
    Pos,
    ScreenDisplayBuffer,
} from "../types/types.js";
import { INVALID_POS } from "../types/types.js";
import { GameMode, GameVariant, CreatureState, DisplayGlyph, MonsterType, StatusEffect } from "../types/enums.js";
import { ItemCategory, ALL_ITEMS } from "../types/enums.js";
import { FoodKind, WeaponKind, ArmorKind } from "../types/enums.js";
import {
    DCOLS, DROWS,
    MAX_WAYPOINT_COUNT,
    MAX_ITEMS_IN_MONSTER_ITEMS_HOPPER,
    MESSAGE_ARCHIVE_ENTRIES,
    BROGUE_FILENAME_MAX,
    ANNOTATION_SUFFIX,
} from "../types/constants.js";
import { ItemFlag } from "../types/flags.js";

// =============================================================================
// Constants
// =============================================================================

/** RNG mode: reproducible game RNG */
export const RNG_SUBSTANTIVE = 0;

/** RNG mode: cosmetic-only RNG */
export const RNG_COSMETIC = 1;

/** D_IMMORTAL: debug immortality flag (false in production) */
export const D_IMMORTAL = false;

/** D_OMNISCENCE: debug omniscience flag (false in production) */
export const D_OMNISCENCE = false;

/** EXIT_STATUS_SUCCESS code */
export const EXIT_STATUS_SUCCESS = 0;

// =============================================================================
// DI Context
// =============================================================================

/**
 * Minimal rogue state required by the game-init module.
 */
export interface GameInitRogueState {
    mode: GameMode;
    playbackMode: boolean;
    playbackPaused: boolean;
    playbackFastForward: boolean;
    playbackOmniscience: boolean;
    playbackBetweenTurns: boolean;
    hideSeed: boolean;
    displayStealthRangeMode: boolean;
    trueColorMode: boolean;
    gameHasEnded: boolean;
    gameInProgress: boolean;
    highScoreSaved: boolean;
    cautiousMode: boolean;
    milliseconds: number;
    RNG: number;
    seed: bigint;
    gold: number;
    goldGenerated: number;
    strength: number;
    weapon: Item | null;
    armor: Item | null;
    ringLeft: Item | null;
    ringRight: Item | null;
    swappedIn: Item | null;
    swappedOut: Item | null;
    flares: unknown[];
    yendorWarden: Creature | null;
    minersLight: LightSource;
    minersLightRadius: Fixpt;
    ticksTillUpdateEnvironment: number;
    scentTurnNumber: number;
    playerTurnNumber: number;
    absoluteTurnNumber: number;
    xpxpThisTurn: number;
    stealthRange: number;
    previousPoisonPercent: number;
    depthLevel: number;
    deepestLevel: number;
    monsterSpawnFuse: number;
    mapToShore: number[][] | null;
    mapToSafeTerrain: number[][] | null;
    cursorLoc: Pos;
    rewardRoomsGenerated: number;
    clairvoyance: number;
    stealthBonus: number;
    regenerationBonus: number;
    lightMultiplier: number;
    wisdomBonus: number;
    transference: number;
    reaping: number;
    wpDistance: (number[][] | null)[];
    meteredItems: MeteredItem[];
    featRecord: boolean[];
    currentGamePath: string;
    disturbed: boolean;
    autoPlayingLevel: boolean;
    automationActive: boolean;
    justRested: boolean;
    justSearched: boolean;
    inWater: boolean;
    creaturesWillFlashThisTurn: boolean;
    updatedSafetyMapThisTurn: boolean;
    updatedAllySafetyMapThisTurn: boolean;
    updatedMapToSafeTerrainThisTurn: boolean;
    updatedMapToShoreThisTurn: boolean;
    foodSpawned: bigint;
    quit: boolean;
    gameExitStatusCode: number;
    recording: boolean;
}

/**
 * Dependency-injection context for the game-init module.
 */
export interface GameInitContext {
    rogue: GameInitRogueState;
    player: Creature;
    gameConst: GameConstants;
    gameVariant: GameVariant;

    /** Monster catalog — used for player.info = monsterCatalog[0]. */
    monsterCatalog: CreatureType[];

    /** Metered item generation table. */
    meteredItemsGenerationTable: readonly MeteredItemGenerationTable[];

    /** Feat table. */
    featTable: readonly { name: string; description: string; initialValue: boolean }[];

    /** Light catalog — for rogue.minersLight. */
    lightCatalog: readonly LightSource[];

    /** MINERS_LIGHT index into lightCatalog. */
    MINERS_LIGHT: number;

    /** Dynamic color bounds for depth-based color interpolation. */
    dynamicColorsBounds: readonly [Color, Color][];

    /** Mutable dynamic color pointers. */
    dynamicColors: Color[];

    /** Display detail grid (DCOLS×DROWS). */
    displayDetail: number[][];

    /** Terrain random values grid (DCOLS×DROWS×8). */
    terrainRandomValues: number[][][];

    /** Message archive for message history display. */
    messageArchive: { message: string }[];
    messageArchivePosition: number;
    setMessageArchivePosition(n: number): void;

    /** previousGameSeed for replay / reseed. */
    previousGameSeed: bigint;
    setPreviousGameSeed(seed: bigint): void;

    /** Level data array (deepestLevel+1). */
    levels: LevelData[];
    setLevels(levels: LevelData[]): void;

    /** Current monster lists (pointers into level data). */
    monsters: Creature[];
    dormantMonsters: Creature[];
    setMonsters(m: Creature[]): void;
    setDormantMonsters(m: Creature[]): void;

    /** Item list sentinels. */
    floorItems: Item[];
    packItems: Item[];
    monsterItemsHopper: Item[];

    /** Purgatory list for dead allies (possible resurrection). */
    purgatory: Creature[];

    /** Safety / routing grids. */
    safetyMap: number[][];
    allySafetyMap: number[][];
    chokeMap: number[][];

    /** Scent map pointer (null initially, set per-level). */
    scentMap: number[][] | null;
    setScentMap(map: number[][] | null): void;

    // -- RNG ------------------------------------------------------------------

    seedRandomGenerator(seed: bigint): bigint;
    rand_range(lo: number, hi: number): number;
    rand_64bits(): bigint;

    // -- Grid operations ------------------------------------------------------

    allocGrid(): number[][];
    fillGrid(grid: number[][], value: number): void;
    zeroOutGrid(grid: number[][]): void;
    freeGrid(grid: number[][]): void;
    distanceBetween(a: Pos, b: Pos): number;

    // -- Item operations ------------------------------------------------------

    generateItem(category: number, kind: number): Item;
    addItemToPack(item: Item): Item;
    identify(item: Item): void;
    equipItem(item: Item, willUnequip: boolean, swapItem: Item | null): void;
    recalculateEquipmentBonuses(): void;

    // -- Creature operations --------------------------------------------------

    initializeGender(monst: Creature): void;
    initializeStatus(monst: Creature): void;

    // -- Recording & display --------------------------------------------------

    initRecording(): void;
    shuffleFlavors(): void;
    resetDFMessageEligibility(): void;
    deleteMessages(): void;
    clearMessageArchive(): void;
    blackOutScreen(displayBuffer: ScreenDisplayBuffer): void;

    // -- Display buffer (for blackOutScreen) ----------------------------------

    displayBuffer: ScreenDisplayBuffer;

    // -- Messages -------------------------------------------------------------

    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;
    flavorMessage(msg: string): void;
    encodeMessageColor(buf: string[], pos: number, color: Readonly<Color>): void;

    // -- Color references -----------------------------------------------------

    itemMessageColor: Readonly<Color>;
    white: Readonly<Color>;
    backgroundMessageColor: Readonly<Color>;

    // -- Variant initialization -----------------------------------------------

    initializeGameVariantBrogue(): void;
    initializeGameVariantRapidBrogue(): void;
    initializeGameVariantBulletBrogue(): void;

    // -- Misc -----------------------------------------------------------------

    KEYBOARD_LABELS: boolean;
}

// =============================================================================
// Utility functions
// =============================================================================

/**
 * Port of C `getOrdinalSuffix()` — returns "st", "nd", "rd", or "th".
 */
export function getOrdinalSuffix(n: number): string {
    // Handle special cases for 11, 12, and 13
    if (n === 11 || n === 12 || n === 13) {
        return "th";
    }
    const lastDigit = n % 10;
    switch (lastDigit) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

/**
 * Port of C `fileExists()` — checks if a file path exists.
 * In the browser/TS context, this is delegated to the platform layer.
 */
export function fileExists(
    ctx: { fileExistsSync(path: string): boolean },
    pathname: string,
): boolean {
    return ctx.fileExistsSync(pathname);
}

/**
 * Port of C `chooseFile()` — player specifies a file via text input.
 * Returns the full path with suffix appended, or null on cancel.
 */
export function chooseFile(
    ctx: {
        getInputTextString(
            prompt: string,
            maxLength: number,
            defaultName: string,
            suffix: string,
            textEntryType: number,
            useDialogBox: boolean,
        ): string | null;
    },
    prompt: string,
    defaultName: string,
    suffix: string,
    textEntryTypeFilename: number,
): string | null {
    const maxLen = Math.min(DCOLS - 25, BROGUE_FILENAME_MAX - suffix.length);
    const result = ctx.getInputTextString(
        prompt,
        maxLen,
        defaultName,
        suffix,
        textEntryTypeFilename,
        false,
    );
    if (result != null && result.length > 0) {
        return result + suffix;
    }
    return null;
}

/**
 * Port of C `openFile()` — checks if a file exists, and if so sets up the
 * currentFilePath and annotation pathname.
 *
 * Returns `{ success, annotationPath }`.
 */
export function openFile(
    ctx: { fileExistsSync(path: string): boolean },
    path: string,
): { success: boolean; currentFilePath: string; annotationPathname: string } {
    if (!ctx.fileExistsSync(path)) {
        return { success: false, currentFilePath: "", annotationPathname: "" };
    }

    const currentFilePath = path;
    let annotationPathname = "";

    // Find the last '.' in path and replace suffix with ANNOTATION_SUFFIX
    const lastDot = path.lastIndexOf(".");
    if (lastDot > 0) {
        const baseName = path.substring(0, lastDot);
        const candidate = baseName + ANNOTATION_SUFFIX;
        if (candidate.length < BROGUE_FILENAME_MAX) {
            annotationPathname = candidate;
        }
    }

    return { success: true, currentFilePath, annotationPathname };
}

// =============================================================================
// setPlayerDisplayChar
// =============================================================================

/**
 * Port of C `setPlayerDisplayChar()` from Monsters.c:409–415.
 * Sets the player's display character based on game mode.
 */
export function setPlayerDisplayChar(player: Creature, mode: GameMode): void {
    if (mode === GameMode.Easy) {
        player.info.displayChar = DisplayGlyph.G_DEMON;
    } else {
        player.info.displayChar = DisplayGlyph.G_PLAYER;
    }
}

// =============================================================================
// initializeGameVariant
// =============================================================================

/**
 * Port of C `initializeGameVariant()` — dispatches to variant-specific init.
 */
export function initializeGameVariant(ctx: GameInitContext): void {
    switch (ctx.gameVariant) {
        case GameVariant.RapidBrogue:
            ctx.initializeGameVariantRapidBrogue();
            break;
        case GameVariant.BulletBrogue:
            ctx.initializeGameVariantBulletBrogue();
            break;
        default:
            ctx.initializeGameVariantBrogue();
    }
}

// =============================================================================
// welcome
// =============================================================================

/**
 * Port of C `welcome()` — opening messages when a new game starts.
 */
export function welcome(ctx: GameInitContext): void {
    ctx.message("Hello and welcome, adventurer, to the Dungeons of Doom!", 0);

    // Build colored "Retrieve the Amulet of Yendor from the Nth floor" message
    const parts: string[] = [];
    parts.push("Retrieve the ");
    // Note: in TS we use string concatenation instead of C-style encodeMessageColor
    // The actual color encoding is done in the message renderer
    parts.push("Amulet of Yendor");
    const suffix = getOrdinalSuffix(ctx.gameConst.amuletLevel);
    parts.push(` from the ${ctx.gameConst.amuletLevel}${suffix} floor and escape with it!`);
    ctx.message(parts.join(""), 0);

    if (ctx.KEYBOARD_LABELS) {
        ctx.messageWithColor(
            "Press <?> for help at any time.",
            ctx.backgroundMessageColor,
            0,
        );
    }
    ctx.flavorMessage("The doors to the dungeon slam shut behind you.");
}

// =============================================================================
// initializeRogue — main game initialization (~345 lines in C)
// =============================================================================

/**
 * Port of C `initializeRogue()`.
 *
 * Initializes all game state for a new game from the given seed.
 * If seed is 0, generates a new random seed.
 * Preserves certain rogue state fields across the reset (playback flags, etc.).
 */
export function initializeRogue(ctx: GameInitContext, seed: bigint): void {
    const { rogue, gameConst: gc } = ctx;

    // Save fields that survive the reset ("the animals on the ark")
    const playingback = rogue.playbackMode;
    const playbackPaused = rogue.playbackPaused;
    const playbackFF = rogue.playbackFastForward;
    const mode = rogue.mode;
    const hideSeed = rogue.hideSeed;
    const displayStealthRangeMode = rogue.displayStealthRangeMode;
    const trueColorMode = rogue.trueColorMode;
    const currentGamePath = rogue.currentGamePath;

    // ---- Reset rogue state ("the flood") ----
    // In C this is a memset to zero. In TS we set all fields explicitly.
    resetRogueState(rogue);

    // ---- Restore preserved fields ----
    rogue.playbackMode = playingback;
    rogue.playbackPaused = playbackPaused;
    rogue.playbackFastForward = playbackFF;
    rogue.mode = mode;
    rogue.hideSeed = hideSeed;
    rogue.displayStealthRangeMode = displayStealthRangeMode;
    rogue.trueColorMode = trueColorMode;
    rogue.currentGamePath = currentGamePath;

    rogue.gameHasEnded = false;
    rogue.gameInProgress = true;
    rogue.highScoreSaved = false;
    rogue.cautiousMode = false;
    rogue.milliseconds = 0;

    // Allocate metered items and feat records
    rogue.meteredItems = [];
    for (let i = 0; i < gc.numberMeteredItems; i++) {
        rogue.meteredItems.push({ frequency: 0, numberSpawned: 0 });
    }
    rogue.featRecord = new Array(gc.numberFeats).fill(false);

    rogue.RNG = RNG_SUBSTANTIVE;
    if (!rogue.playbackMode) {
        rogue.seed = ctx.seedRandomGenerator(seed);
        ctx.setPreviousGameSeed(rogue.seed);
    }

    ctx.initRecording();

    // ---- Initialize levels array ----
    const levels: LevelData[] = [];
    for (let i = 0; i <= gc.deepestLevel; i++) {
        levels.push(createEmptyLevelData());
    }
    levels[0].upStairsLoc = { x: Math.floor((DCOLS - 1) / 2) - 1, y: DROWS - 2 };
    ctx.setLevels(levels);

    // Set metered item frequencies to initial values
    for (let i = 0; i < gc.numberMeteredItems; i++) {
        rogue.meteredItems[i].frequency = ctx.meteredItemsGenerationTable[i].initialFrequency;
    }

    // All DF messages are eligible for display
    ctx.resetDFMessageEligibility();

    // Initialize the levels list with seeds and stair locations
    for (let i = 0; i <= gc.deepestLevel; i++) {
        if (rogue.seed >> 32n) {
            // generate a 64-bit seed
            levels[i].levelSeed = ctx.rand_64bits();
        } else {
            // backward-compatible seed
            const lo = BigInt(ctx.rand_range(0, 9999));
            const hi = BigInt(ctx.rand_range(0, 9999));
            levels[i].levelSeed = lo + 10000n * hi;
        }
        if (levels[i].levelSeed === 0n) {
            levels[i].levelSeed = BigInt(i + 1);
        }
        levels[i].monsters = [];
        levels[i].dormantMonsters = [];
        levels[i].items = [];
        levels[i].scentMap = null;
        levels[i].visited = false;
        levels[i].playerExitedVia = { x: 0, y: 0 };

        // Place downstairs at random location, sufficiently far from upstairs
        do {
            levels[i].downStairsLoc = {
                x: ctx.rand_range(1, DCOLS - 2),
                y: ctx.rand_range(1, DROWS - 2),
            };
        } while (
            ctx.distanceBetween(levels[i].upStairsLoc, levels[i].downStairsLoc) <
            Math.floor(DCOLS / 3)
        );

        if (i < gc.deepestLevel) {
            levels[i + 1].upStairsLoc = {
                x: levels[i].downStairsLoc.x,
                y: levels[i].downStairsLoc.y,
            };
        }
    }

    // Initialize waypoints
    rogue.wpDistance = [];
    for (let i = 0; i < MAX_WAYPOINT_COUNT; i++) {
        rogue.wpDistance.push(ctx.allocGrid());
        ctx.fillGrid(rogue.wpDistance[i]!, 0);
    }

    rogue.rewardRoomsGenerated = 0;

    // Pre-shuffle the random terrain colors
    const oldRNG = rogue.RNG;
    rogue.RNG = RNG_COSMETIC;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            for (let k = 0; k < 8; k++) {
                ctx.terrainRandomValues[i][j][k] = ctx.rand_range(0, 1000);
            }
        }
    }
    rogue.RNG = oldRNG; // restoreRNG

    ctx.zeroOutGrid(ctx.displayDetail);

    // Set monster IDs
    for (let i = 0; i < ctx.monsterCatalog.length; i++) {
        ctx.monsterCatalog[i].monsterID = i;
    }

    ctx.shuffleFlavors();

    // Initialize feat records
    for (let i = 0; i < gc.numberFeats; i++) {
        rogue.featRecord[i] = ctx.featTable[i].initialValue;
    }

    ctx.deleteMessages();
    for (let i = 0; i < MESSAGE_ARCHIVE_ENTRIES; i++) {
        ctx.messageArchive[i].message = "";
    }
    ctx.setMessageArchivePosition(0);

    // Seed the item stacks (in TS we use arrays, not linked lists)
    ctx.floorItems.length = 0;
    ctx.packItems.length = 0;
    ctx.monsterItemsHopper.length = 0;

    // Pre-generate monster items hopper
    for (let i = 0; i < MAX_ITEMS_IN_MONSTER_ITEMS_HOPPER; i++) {
        const theItem = ctx.generateItem(ALL_ITEMS & ~ItemCategory.FOOD, -1);
        ctx.monsterItemsHopper.push(theItem);
    }

    // Set up monster/dormant lists for level 0
    ctx.setMonsters(levels[0].monsters);
    ctx.setDormantMonsters(levels[0].dormantMonsters);
    ctx.purgatory.length = 0;

    ctx.setScentMap(null);

    // Allocate safety grids
    ctx.fillGrid(ctx.safetyMap, 0);
    ctx.fillGrid(ctx.allySafetyMap, 0);
    ctx.fillGrid(ctx.chokeMap, 0);

    rogue.mapToSafeTerrain = ctx.allocGrid();
    ctx.fillGrid(rogue.mapToSafeTerrain, 0);

    // ---- Initialize the player ----
    const { player } = ctx;
    // Reset creature fields
    resetCreatureFields(player);
    player.info = { ...ctx.monsterCatalog[MonsterType.MK_YOU] };
    setPlayerDisplayChar(player, rogue.mode);
    ctx.initializeGender(player);
    player.movementSpeed = player.info.movementSpeed;
    player.attackSpeed = player.info.attackSpeed;
    ctx.initializeStatus(player);
    player.carriedItem = null;
    player.currentHP = player.info.maxHP;
    player.creatureState = CreatureState.Ally;
    player.ticksUntilTurn = 0;
    player.mutationIndex = -1;

    rogue.depthLevel = 1;
    rogue.deepestLevel = 1;
    rogue.scentTurnNumber = 1000;
    rogue.playerTurnNumber = 0;
    rogue.absoluteTurnNumber = 0;
    rogue.previousPoisonPercent = 0;
    rogue.foodSpawned = 0n;
    rogue.gold = 0;
    rogue.goldGenerated = 0;
    rogue.disturbed = false;
    rogue.autoPlayingLevel = false;
    rogue.automationActive = false;
    rogue.justRested = false;
    rogue.justSearched = false;
    rogue.inWater = false;
    rogue.creaturesWillFlashThisTurn = false;
    rogue.updatedSafetyMapThisTurn = false;
    rogue.updatedAllySafetyMapThisTurn = false;
    rogue.updatedMapToSafeTerrainThisTurn = false;
    rogue.updatedMapToShoreThisTurn = false;
    rogue.strength = 12;
    rogue.weapon = null;
    rogue.armor = null;
    rogue.ringLeft = null;
    rogue.ringRight = null;
    rogue.swappedIn = null;
    rogue.swappedOut = null;
    rogue.monsterSpawnFuse = ctx.rand_range(125, 175);
    rogue.ticksTillUpdateEnvironment = 100;
    rogue.mapToShore = null;
    rogue.cursorLoc = { ...INVALID_POS };
    rogue.xpxpThisTurn = 0;

    rogue.yendorWarden = null;

    rogue.flares = [];

    rogue.minersLight = { ...ctx.lightCatalog[ctx.MINERS_LIGHT] };

    rogue.clairvoyance = 0;
    rogue.regenerationBonus = 0;
    rogue.stealthBonus = 0;
    rogue.transference = 0;
    rogue.wisdomBonus = 0;
    rogue.reaping = 0;
    rogue.lightMultiplier = 1;

    // ---- Starting equipment ----
    let theItem: Item;

    theItem = ctx.generateItem(ItemCategory.FOOD, FoodKind.Ration);
    ctx.addItemToPack(theItem);

    theItem = ctx.generateItem(ItemCategory.WEAPON, WeaponKind.Dagger);
    theItem.enchant1 = 0;
    theItem.enchant2 = 0;
    theItem.flags &= ~(ItemFlag.ITEM_CURSED | ItemFlag.ITEM_RUNIC);
    ctx.identify(theItem);
    ctx.addItemToPack(theItem);
    ctx.equipItem(theItem, false, null);

    theItem = ctx.generateItem(ItemCategory.WEAPON, WeaponKind.Dart);
    theItem.enchant1 = 0;
    theItem.enchant2 = 0;
    theItem.quantity = 15;
    theItem.flags &= ~(ItemFlag.ITEM_CURSED | ItemFlag.ITEM_RUNIC);
    ctx.identify(theItem);
    ctx.addItemToPack(theItem);

    theItem = ctx.generateItem(ItemCategory.ARMOR, ArmorKind.LeatherArmor);
    theItem.enchant1 = 0;
    theItem.flags &= ~(ItemFlag.ITEM_CURSED | ItemFlag.ITEM_RUNIC);
    ctx.identify(theItem);
    ctx.addItemToPack(theItem);
    ctx.equipItem(theItem, false, null);
    player.status[StatusEffect.Donning] = 0;

    ctx.recalculateEquipmentBonuses();

    if (D_OMNISCENCE) {
        rogue.playbackOmniscience = true;
    }

    // DEBUG block is intentionally omitted for production builds.
    // Debug items would be added here when D_DEBUG is enabled.

    ctx.clearMessageArchive();
    ctx.blackOutScreen(ctx.displayBuffer);
    welcome(ctx);
}

// =============================================================================
// printBrogueVersion
// =============================================================================

/**
 * Port of C `printBrogueVersion()` — returns version info as a string.
 */
export function printBrogueVersion(
    brogueVersion: string,
    rapidBrogueVersion: string,
    bulletBrogueVersion: string,
): string {
    return [
        `Brogue version: ${brogueVersion}`,
        `Supports variant (rapid_brogue): ${rapidBrogueVersion}`,
        `Supports variant (bullet_brogue): ${bulletBrogueVersion}`,
    ].join("\n");
}

// =============================================================================
// Helper: resetRogueState — zero out all rogue fields
// =============================================================================

function resetRogueState(rogue: GameInitRogueState): void {
    rogue.mode = GameMode.Normal;
    rogue.playbackMode = false;
    rogue.playbackPaused = false;
    rogue.playbackFastForward = false;
    rogue.playbackOmniscience = false;
    rogue.playbackBetweenTurns = false;
    rogue.hideSeed = false;
    rogue.displayStealthRangeMode = false;
    rogue.trueColorMode = false;
    rogue.gameHasEnded = false;
    rogue.gameInProgress = false;
    rogue.highScoreSaved = false;
    rogue.cautiousMode = false;
    rogue.milliseconds = 0;
    rogue.RNG = 0;
    rogue.seed = 0n;
    rogue.gold = 0;
    rogue.goldGenerated = 0;
    rogue.strength = 0;
    rogue.weapon = null;
    rogue.armor = null;
    rogue.ringLeft = null;
    rogue.ringRight = null;
    rogue.swappedIn = null;
    rogue.swappedOut = null;
    rogue.flares = [];
    rogue.yendorWarden = null;
    rogue.minersLight = { lightColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false }, lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, radialFadeToPercent: 0, passThroughCreatures: false };
    rogue.minersLightRadius = 0n;
    rogue.ticksTillUpdateEnvironment = 0;
    rogue.scentTurnNumber = 0;
    rogue.playerTurnNumber = 0;
    rogue.absoluteTurnNumber = 0;
    rogue.xpxpThisTurn = 0;
    rogue.stealthRange = 0;
    rogue.previousPoisonPercent = 0;
    rogue.depthLevel = 0;
    rogue.deepestLevel = 0;
    rogue.monsterSpawnFuse = 0;
    rogue.mapToShore = null;
    rogue.mapToSafeTerrain = null;
    rogue.cursorLoc = { ...INVALID_POS };
    rogue.rewardRoomsGenerated = 0;
    rogue.clairvoyance = 0;
    rogue.stealthBonus = 0;
    rogue.regenerationBonus = 0;
    rogue.lightMultiplier = 0;
    rogue.wisdomBonus = 0;
    rogue.transference = 0;
    rogue.reaping = 0;
    rogue.wpDistance = [];
    rogue.meteredItems = [];
    rogue.featRecord = [];
    rogue.currentGamePath = "";
    rogue.disturbed = false;
    rogue.autoPlayingLevel = false;
    rogue.automationActive = false;
    rogue.justRested = false;
    rogue.justSearched = false;
    rogue.inWater = false;
    rogue.creaturesWillFlashThisTurn = false;
    rogue.updatedSafetyMapThisTurn = false;
    rogue.updatedAllySafetyMapThisTurn = false;
    rogue.updatedMapToSafeTerrainThisTurn = false;
    rogue.updatedMapToShoreThisTurn = false;
    rogue.foodSpawned = 0n;
    rogue.quit = false;
    rogue.gameExitStatusCode = 0;
    rogue.recording = false;
}

// =============================================================================
// Helper: resetCreatureFields — zero out creature fields (memset equivalent)
// =============================================================================

function resetCreatureFields(c: Creature): void {
    c.loc = { x: 0, y: 0 };
    c.depth = 0;
    c.currentHP = 0;
    c.turnsUntilRegen = 0;
    c.regenPerTurn = 0;
    c.weaknessAmount = 0;
    c.poisonAmount = 0;
    c.creatureState = 0 as CreatureState;
    c.creatureMode = 0 as any;
    c.mutationIndex = -1;
    c.wasNegated = false;
    c.targetWaypointIndex = 0;
    c.waypointAlreadyVisited = [];
    c.lastSeenPlayerAt = { x: 0, y: 0 };
    c.targetCorpseLoc = { x: 0, y: 0 };
    c.targetCorpseName = "";
    c.absorptionFlags = 0;
    c.absorbBehavior = false;
    c.absorptionBolt = 0;
    c.corpseAbsorptionCounter = 0;
    c.mapToMe = null;
    c.safetyMap = null;
    c.ticksUntilTurn = 0;
    c.movementSpeed = 0;
    c.attackSpeed = 0;
    c.previousHealthPoints = 0;
    c.turnsSpentStationary = 0;
    c.flashStrength = 0;
    c.flashColor = { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
    c.status = [];
    c.maxStatus = [];
    c.bookkeepingFlags = 0;
    c.spawnDepth = 0;
    c.machineHome = 0;
    c.xpxp = 0;
    c.newPowerCount = 0;
    c.totalPowerCount = 0;
    c.leader = null;
    c.carriedMonster = null;
    c.carriedItem = null;
}

// =============================================================================
// Helper: createEmptyLevelData
// =============================================================================

function createEmptyLevelData(): LevelData {
    // Create empty DCOLS×DROWS mapStorage
    const mapStorage = [];
    for (let i = 0; i < DCOLS; i++) {
        const col = [];
        for (let j = 0; j < DROWS; j++) {
            col.push({
                layers: [0, 0, 0],
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: {
                    character: 0 as DisplayGlyph,
                    foreColorComponents: [0, 0, 0] as [number, number, number],
                    backColorComponents: [0, 0, 0] as [number, number, number],
                    opacity: 0,
                },
                rememberedItemCategory: 0,
                rememberedItemKind: 0,
                rememberedItemQuantity: 0,
                rememberedItemOriginDepth: 0,
                rememberedTerrain: 0,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                exposedToFire: 0,
            });
        }
        mapStorage.push(col);
    }

    return {
        visited: false,
        mapStorage,
        items: [],
        monsters: [],
        dormantMonsters: [],
        scentMap: null,
        levelSeed: 0n,
        upStairsLoc: { x: 0, y: 0 },
        downStairsLoc: { x: 0, y: 0 },
        playerExitedVia: { x: 0, y: 0 },
        awaySince: 0,
    };
}
