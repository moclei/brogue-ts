/*
 *  runtime.ts — Game runtime DI container
 *  brogue-ts
 *
 *  Creates a unified runtime that wires the BrogueConsole platform layer
 *  into all DI contexts, connecting:
 *    mainBrogueJunction → initializeRogue → startLevel → mainInputLoop
 *
 *  The runtime holds shared mutable state and provides context implementations
 *  for every module. Each ported function receives its DI context from here.
 *
 *  NOTE: Many lifecycle methods delegate to TODO stubs for systems that
 *  depend on unported deep game logic (dungeon generation, monster AI, etc.).
 *  Full implementation is Phase 4 (Integration). This file establishes the
 *  architecture and demonstrates how all the pieces connect.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueConsole } from "./types/platform.js";
import type {
    Color,
    Creature,
    CreatureType,
    DungeonFeature,
    Fixpt,
    GameConstants,
    Item,
    ItemTable,
    LevelData,
    LightSource,
    MeteredItem,
    Pcell,
    Pos,
    ScreenDisplayBuffer,
    SavedDisplayBuffer,
    Tcell,
    BrogueButton,
    ButtonState,
    RogueEvent,
    WindowPos,
    PauseBehavior,
} from "./types/types.js";
import { INVALID_POS } from "./types/types.js";
import {
    NGCommand,
    GameMode,
    GameVariant,
    ButtonDrawState,
    DungeonLayer,
    TextEntryType,
    DisplayGlyph,
    LightType,
    MonsterType,
    TileType,
    EventType,
    StatusEffect,
    ItemCategory,
} from "./types/enums.js";
import {
    COLS, ROWS, DCOLS, DROWS,
    KEYBOARD_LABELS,
    MESSAGE_ARCHIVE_ENTRIES,
    MONSTER_CLASS_COUNT,
    NUMBER_TERRAIN_LAYERS,
    REST_KEY, SEARCH_KEY,
} from "./types/constants.js";
// PAUSE_BEHAVIOR_DEFAULT imported inline where needed

// -- Input dispatch imports ---------------------------------------------------
import type { InputContext, InputRogueState } from "./io/io-input.js";
import {
    executeKeystroke as executeKeystrokeFn,
    executeMouseClick as executeMouseClickFn,
} from "./io/io-input.js";

// -- Targeting imports --------------------------------------------------------
import type { TargetingContext } from "./io/io-targeting.js";
import {
    getPlayerPathOnMap as getPlayerPathOnMapFn,
    hilitePath as hilitePatchFn,
    clearCursorPath as clearCursorPathFn,
    hideCursor as hideCursorFn,
    showCursor as showCursorFn,
    getClosestValidLocationOnMap as getClosestValidLocationOnMapFn,
    processSnapMap as processSnapMapFn,
    hiliteCell as hiliteCellFn,
} from "./io/io-targeting.js";

// -- IO module imports --------------------------------------------------------
import {
    applyColorAverage,
    applyColorAugment,
    bakeColor,
    separateColors,
    encodeMessageColor,
    decodeMessageColor,
    storeColorComponents,
} from "./io/io-color.js";
import {
    createScreenDisplayBuffer,
    clearDisplayBuffer,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    overlayDisplayBuffer as overlayDisplayBufferFn,
    plotCharToBuffer,
    locIsInWindow,
    mapToWindowX,
    mapToWindowY,
} from "./io/io-display.js";
import {
    plotCharWithColor,
    blackOutScreen,
} from "./io/io-appearance.js";
import {
    windowToMap as windowToMapFn,
    windowToMapX as windowToMapXFromDisplay,
    windowToMapY as windowToMapYFromDisplay,
} from "./io/io-display.js";
import {
    strLenWithoutEscapes,
    printString as printStringFn,
    wrapText,
    printStringWithWrapping,
} from "./io/io-text.js";
import {
    smoothHiliteGradient,
} from "./io/io-sidebar.js";
import type { ButtonContext } from "./io/io-buttons.js";
import {
    initializeButton,
    setButtonText as setButtonTextFn,
    drawButton as drawButtonFn,
    drawButtonsInState as drawButtonsInStateFn,
    initializeButtonState,
    processButtonInput as processButtonInputFn,
    buttonInputLoop as buttonInputLoopFn,
} from "./io/io-buttons.js";
import {
    rectangularShading as rectangularShadingFn,
    printTextBox as printTextBoxFn,
} from "./io/io-inventory.js";
import type { InventoryContext } from "./io/io-inventory.js";

// -- Message imports ----------------------------------------------------------
import type { MessageState } from "./io/io-messages.js";
import {
    clearMessageArchive as clearMessageArchiveFn,
} from "./io/io-messages.js";

// -- Async helpers for browser ------------------------------------------------
import { asyncPause } from "./platform/browser-renderer.js";

// -- Color imports ------------------------------------------------------------
import * as Colors from "./globals/colors.js";

// -- RNG imports --------------------------------------------------------------
import { seedRandomGenerator, randRange, rand64bits, randPercent, randClump, randClumpedRange, clamp } from "./math/rng.js";

// -- Grid imports -------------------------------------------------------------
import { allocGrid, freeGrid, fillGrid } from "./grid/grid.js";
import { zeroOutGrid } from "./architect/helpers.js";

// -- Creature imports ---------------------------------------------------------
import { createCreature, initializeGender, initializeStatus } from "./monsters/monster-creation.js";
import { distanceBetween } from "./monsters/monster-state.js";

// -- Player movement imports --------------------------------------------------
import { playerMoves as playerMovesFn, playerRuns as playerRunsFn } from "./movement/player-movement.js";
import type { PlayerMoveContext, PlayerRunContext } from "./movement/player-movement.js";

// -- Travel / explore imports -------------------------------------------------
import {
    travel as travelFn,
    travelRoute as travelRouteFn,
    useStairs as useStairsFn,
    explore as exploreFn,
    autoPlayLevel as autoPlayLevelFn,
    proposeOrConfirmLocation as proposeOrConfirmLocationFn,
    nextStep as nextStepFn,
} from "./movement/travel-explore.js";
import type { TravelExploreContext } from "./movement/travel-explore.js";

// -- Auto-rest / search imports -----------------------------------------------
import { autoRest as autoRestFn, manualSearch as manualSearchFn } from "./time/misc-helpers.js";
import type { MiscHelpersContext } from "./time/misc-helpers.js";

// -- Turn processing imports --------------------------------------------------
import { playerTurnEnded as playerTurnEndedFn } from "./time/turn-processing.js";
import type { TurnProcessingContext } from "./time/turn-processing.js";

// (Creature effects, environment, safety maps, monster AI, combat damage,
//  search/scent, spawn, flares, cleanup imports are deferred — currently
//  using inline stubs in buildTurnProcessingContext.  They will be wired
//  to real implementations incrementally in Steps 3d-3f.)

// -- Combat math imports ------------------------------------------------------
import { diagonalBlocked as diagonalBlockedFn } from "./combat/combat-math.js";

// -- Dijkstra scan import -----------------------------------------------------
import { dijkstraScan as dijkstraScanFn } from "./dijkstra/dijkstra.js";

// -- Cost map import ----------------------------------------------------------
import type { CostMapFovContext } from "./movement/cost-maps-fov.js";

// -- FOV & pathfinding imports ------------------------------------------------
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import type { FOVContext } from "./light/fov.js";
import { calculateDistances as calculateDistancesFn, pathingDistance as pathingDistanceFn } from "./dijkstra/dijkstra.js";
import type { CalculateDistancesContext } from "./dijkstra/dijkstra.js";
import { populateGenericCostMap as populateGenericCostMapFn, populateCreatureCostMap as populateCreatureCostMapFn } from "./movement/cost-maps-fov.js";

// -- Architect imports --------------------------------------------------------
import {
    digDungeon as digDungeonFn,
    placeStairs as placeStairsFn,
    initializeLevel as initializeLevelFn,
    setUpWaypoints as setUpWaypointsFn,
    updateMapToShore as updateMapToShoreFn,
    restoreMonster as restoreMonsterFn,
    restoreItems as restoreItemsFn,
} from "./architect/architect.js";
import type { ArchitectContext } from "./architect/architect.js";
import { analyzeMap as analyzeMapFn } from "./architect/analysis.js";
import type { MachineContext, ItemOps, MonsterOps } from "./architect/machines.js";
import type { BuildBridgeContext } from "./architect/lakes.js";

// -- Flag imports -------------------------------------------------------------
import { TileFlag, TerrainFlag, TerrainMechFlag, MonsterBehaviorFlag } from "./types/flags.js";

// -- State helper imports -----------------------------------------------------
import { cellHasTerrainFlag, cellHasTMFlag, terrainFlags, terrainMechFlags, discoveredTerrainFlagsAtLoc, highestPriorityLayer } from "./state/helpers.js";
import { coordinatesAreInMap, isPosInMap, nbDirs } from "./globals/tables.js";
import { FP_FACTOR } from "./math/fixpt.js";

// -- Catalog imports (more) ---------------------------------------------------
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonProfileCatalog } from "./globals/dungeon-profile-catalog.js";
import { blueprintCatalog } from "./globals/blueprint-catalog.js";
import { autoGeneratorCatalog } from "./globals/autogenerator-catalog.js";

// -- Game-level import --------------------------------------------------------
import { startLevel as startLevelFn } from "./game/game-level.js";
import type { LevelContext } from "./game/game-level.js";

// -- Appearance imports -------------------------------------------------------
import { bakeTerrainColors } from "./io/io-appearance.js";

// -- Item imports -------------------------------------------------------------
import { generateItem } from "./items/item-generation.js";
import { addItemToPack } from "./items/item-inventory.js";
import { identify } from "./items/item-naming.js";
import { shuffleFlavors } from "./items/item-naming.js";
import { equipItem, recalculateEquipmentBonuses } from "./items/item-usage.js";
import type { EquipContext, EquipmentState } from "./items/item-usage.js";

// -- Catalog imports ----------------------------------------------------------
import { monsterCatalog as monsterCatalogData } from "./globals/monster-catalog.js";
import { lightCatalog as lightCatalogData } from "./globals/light-catalog.js";
import { meteredItemsGenerationTable as meteredItemsGenTable } from "./globals/item-catalog.js";
import { scrollTable, potionTable } from "./globals/item-catalog.js";
import { dynamicColorsBounds } from "./globals/tables.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";

// -- Game lifecycle imports ---------------------------------------------------
import type { GameInitContext } from "./game/game-init.js";
import { initializeRogue as initializeRogueFn, initializeGameVariant as initializeGameVariantFn } from "./game/game-init.js";
import type { CleanupContext } from "./game/game-cleanup.js";
import { freeEverything as freeEverythingFn } from "./game/game-cleanup.js";
import { resetDFMessageEligibility } from "./architect/architect.js";

// -- Recording imports --------------------------------------------------------
import { createRecordingBuffer } from "./recordings/recording-state.js";
import type { RecordingBuffer, RecordingFileIO } from "./recordings/recording-state.js";
import { initRecording as initRecordingFn } from "./recordings/recording-init.js";

// -- Flare imports ------------------------------------------------------------
import { deleteAllFlares } from "./light/flares.js";

// -- Menu imports (for type reference) ----------------------------------------
import type { MenuContext, MenuRogueState, FileEntry, RogueRun } from "./menus/main-menu.js";

// =============================================================================
// Brogue game constants (default variant: Brogue CE)
// =============================================================================

/** Default GameConstants for the classic Brogue CE variant. */
export const BROGUE_GAME_CONSTANTS: GameConstants = {
    majorVersion: 1,
    minorVersion: 15,
    patchVersion: 1,
    variantName: "brogue",
    versionString: "CE 1.15.1",
    dungeonVersionString: "CE 1.15",
    patchVersionPattern: "CE 1.15.%hu",
    recordingVersionString: "CE 1.15.1",
    deepestLevel: 40,
    amuletLevel: 26,
    depthAccelerator: 1,
    minimumAltarLevel: 13,
    minimumLavaLevel: 4,
    minimumBrimstoneLevel: 17,
    mutationsOccurAboveLevel: 10,
    monsterOutOfDepthChance: 10,
    machinesPerLevelSuppressionMultiplier: 4,
    machinesPerLevelSuppressionOffset: 2,
    machinesPerLevelIncreaseFactor: 1,
    maxLevelForBonusMachines: 2,
    deepestLevelForMachines: 26,
    extraItemsPerLevel: 0,
    goldAdjustmentStartDepth: 6,
    playerTransferenceRatio: 20,
    onHitHallucinateDuration: 20,
    onHitWeakenDuration: 300,
    onHitMercyHealPercent: 50,
    weaponKillsToAutoID: 20,
    armorDelayToAutoID: 1000,
    ringDelayToAutoID: 1500,
    fallDamageMin: 8,
    fallDamageMax: 10,
    numberAutogenerators: 0,     // Will be set by variant init
    numberBoltKinds: 0,
    numberBlueprints: 0,
    numberHordes: 0,
    numberMeteredItems: 0,
    numberCharmKinds: 0,
    numberPotionKinds: 0,
    numberGoodPotionKinds: 8,
    numberScrollKinds: 0,
    numberGoodScrollKinds: 12,
    numberWandKinds: 0,
    numberGoodWandKinds: 6,
    numberFeats: 0,
    companionFeatRequiredXP: 10400,
    mainMenuTitleHeight: 26,
    mainMenuTitleWidth: 68,
};

// =============================================================================
// Default menu title (ASCII art)
// =============================================================================

// The title is stored as a flat string; each character maps to a cell in
// a mainMenuTitleWidth × mainMenuTitleHeight grid. Non-space chars are
// rendered as flame-lit glyphs on the title screen.
// Ported from GlobalsBrogue.c — 68 chars wide × 26 rows.
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
// Runtime state — unified rogue state
// =============================================================================

/**
 * Unified rogue state that satisfies MenuRogueState, GameInitRogueState,
 * CleanupRogueState, and InitRecordingRogue. This single object is the
 * superset shared by every DI context.
 */
interface RuntimeRogueState extends MenuRogueState {
    // -- Fields from GameInitRogueState not in MenuRogueState --
    playbackOmniscience: boolean;
    hideSeed: boolean;
    displayStealthRangeMode: boolean;
    trueColorMode: boolean;
    highScoreSaved: boolean;
    cautiousMode: boolean;
    milliseconds: number;
    RNG: number;
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
    disturbed: boolean;
    autoPlayingLevel: boolean;
    automationActive: boolean;
    justRested: boolean;
    justSearched: boolean;
    inWater: boolean;
    updatedSafetyMapThisTurn: boolean;
    updatedAllySafetyMapThisTurn: boolean;
    updatedMapToSafeTerrainThisTurn: boolean;
    updatedMapToShoreThisTurn: boolean;
    foodSpawned: bigint;
    gameExitStatusCode: number;

    // -- Fields from LevelRogueState not in above --
    lastTarget: Creature | null;
    upLoc: Pos;
    downLoc: Pos;
    staleLoopMap: boolean;

    // -- Fields from InputRogueState --
    cursorMode: boolean;
    cursorPathIntensity: number;
    lastItemThrown: Item | null;
    blockCombatText: boolean;

    // -- Fields from InitRecordingRogue not in above --
    playbackDelayPerTurn: number;
    playbackDelayThisTurn: number;
    howManyTurns: number;
    currentTurnNumber: number;
    nextAnnotationTurn: number;
    nextAnnotation: string;
    locationInAnnotationFile: number;
    versionString: string;
}

/**
 * Create the unified rogue state with all fields initialized to defaults.
 */
function createRogueState(): RuntimeRogueState {
    const defaultLight: LightSource = {
        lightColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        radialFadeToPercent: 0,
        passThroughCreatures: false,
    };

    return {
        // -- MenuRogueState fields --
        mode: GameMode.Normal,
        nextGame: NGCommand.Nothing,
        nextGamePath: "",
        nextGameSeed: 0n,
        currentGamePath: "",
        gameHasEnded: false,
        gameInProgress: false,
        quit: false,
        playbackMode: false,
        playbackFastForward: false,
        playbackPaused: false,
        playbackBetweenTurns: false,
        playbackOOS: false,
        recording: false,
        depthLevel: 1,
        creaturesWillFlashThisTurn: false,
        seed: 0n,
        patchVersion: 1,

        // -- GameInitRogueState extensions --
        playbackOmniscience: false,
        hideSeed: false,
        displayStealthRangeMode: false,
        trueColorMode: false,
        highScoreSaved: false,
        cautiousMode: false,
        milliseconds: 0,
        RNG: 0,
        gold: 0,
        goldGenerated: 0,
        strength: 12,
        weapon: null,
        armor: null,
        ringLeft: null,
        ringRight: null,
        swappedIn: null,
        swappedOut: null,
        flares: [],
        yendorWarden: null,
        minersLight: { ...defaultLight },
        minersLightRadius: 0n,
        ticksTillUpdateEnvironment: 100,
        scentTurnNumber: 1000,
        playerTurnNumber: 0,
        absoluteTurnNumber: 0,
        xpxpThisTurn: 0,
        stealthRange: 0,
        previousPoisonPercent: 0,
        deepestLevel: 1,
        monsterSpawnFuse: 0,
        mapToShore: null,
        mapToSafeTerrain: null,
        cursorLoc: { ...INVALID_POS },
        rewardRoomsGenerated: 0,
        clairvoyance: 0,
        stealthBonus: 0,
        regenerationBonus: 0,
        lightMultiplier: 1,
        wisdomBonus: 0,
        transference: 0,
        reaping: 0,
        wpDistance: [],
        meteredItems: [],
        featRecord: [],
        disturbed: false,
        autoPlayingLevel: false,
        automationActive: false,
        justRested: false,
        justSearched: false,
        inWater: false,
        updatedSafetyMapThisTurn: false,
        updatedAllySafetyMapThisTurn: false,
        updatedMapToSafeTerrainThisTurn: false,
        updatedMapToShoreThisTurn: false,
        foodSpawned: 0n,
        gameExitStatusCode: 0,

        // -- LevelRogueState extensions --
        lastTarget: null,
        upLoc: { x: 0, y: 0 },
        downLoc: { x: 0, y: 0 },
        staleLoopMap: false,

        // -- InputRogueState extensions --
        cursorMode: false,
        cursorPathIntensity: 20,
        lastItemThrown: null,
        blockCombatText: false,

        // -- InitRecordingRogue extensions --
        playbackDelayPerTurn: 0,
        playbackDelayThisTurn: 0,
        howManyTurns: 0,
        currentTurnNumber: 0,
        nextAnnotationTurn: 0,
        nextAnnotation: "",
        locationInAnnotationFile: 0,
        versionString: "",
    };
}

// =============================================================================
// commitDraws — bridge display buffer → BrogueConsole
// =============================================================================

/**
 * Walk every cell in the display buffer and render changed cells to the
 * BrogueConsole via plotChar. Color values are in 0–100 range (Brogue
 * convention) and are scaled to 0–255 for the console.
 */
function makeCommitDraws(
    displayBuffer: ScreenDisplayBuffer,
    prevBuffer: ScreenDisplayBuffer,
    console: BrogueConsole,
): () => void {
    return function commitDraws(): void {
        for (let x = 0; x < COLS; x++) {
            for (let y = 0; y < ROWS; y++) {
                const cell = displayBuffer.cells[x][y];
                const prev = prevBuffer.cells[x][y];

                if (
                    cell.character !== prev.character ||
                    cell.foreColorComponents[0] !== prev.foreColorComponents[0] ||
                    cell.foreColorComponents[1] !== prev.foreColorComponents[1] ||
                    cell.foreColorComponents[2] !== prev.foreColorComponents[2] ||
                    cell.backColorComponents[0] !== prev.backColorComponents[0] ||
                    cell.backColorComponents[1] !== prev.backColorComponents[1] ||
                    cell.backColorComponents[2] !== prev.backColorComponents[2]
                ) {
                    // Scale from 0–100 to 0–255
                    const fr = Math.round(cell.foreColorComponents[0] * 2.55);
                    const fg = Math.round(cell.foreColorComponents[1] * 2.55);
                    const fb = Math.round(cell.foreColorComponents[2] * 2.55);
                    const br = Math.round(cell.backColorComponents[0] * 2.55);
                    const bg = Math.round(cell.backColorComponents[1] * 2.55);
                    const bb = Math.round(cell.backColorComponents[2] * 2.55);

                    console.plotChar(cell.character, x, y, fr, fg, fb, br, bg, bb);

                    // Sync prev buffer
                    prev.character = cell.character;
                    prev.foreColorComponents[0] = cell.foreColorComponents[0];
                    prev.foreColorComponents[1] = cell.foreColorComponents[1];
                    prev.foreColorComponents[2] = cell.foreColorComponents[2];
                    prev.backColorComponents[0] = cell.backColorComponents[0];
                    prev.backColorComponents[1] = cell.backColorComponents[1];
                    prev.backColorComponents[2] = cell.backColorComponents[2];
                }
            }
        }
    };
}

// =============================================================================
// createRuntime — master factory
// =============================================================================

/**
 * Public result from `createRuntime`.
 */
export interface GameRuntime {
    /** The fully-wired MenuContext for mainBrogueJunction. */
    menuCtx: MenuContext;
    /** The main display buffer (shared by all contexts). */
    displayBuffer: ScreenDisplayBuffer;
    /** Flush the display buffer to the console. */
    commitDraws(): void;
}

/**
 * Extended console interface that adds async event waiting.
 * The browser renderer returns this; future Node.js renderers will too.
 */
export interface AsyncBrogueConsole extends BrogueConsole {
    /** Async wait for the next input event (keyboard or mouse). */
    waitForEvent(): Promise<RogueEvent>;
}

/**
 * Create a game runtime from a platform console.
 *
 * This wires the BrogueConsole into all DI contexts and connects the
 * game lifecycle: mainBrogueJunction → initializeRogue → startLevel →
 * mainInputLoop.
 */
export function createRuntime(browserConsole: AsyncBrogueConsole): GameRuntime {
    // -- Shared state ---------------------------------------------------------
    const rogue = createRogueState();
    const displayBuffer = createScreenDisplayBuffer();
    const prevBuffer = createScreenDisplayBuffer();

    let previousGameSeed = 0n;
    let currentFilePath = "";
    let gameVariant = GameVariant.Brogue;
    let gameConst: GameConstants = { ...BROGUE_GAME_CONSTANTS };

    // -- Player creature (persistent across game sessions) --------------------
    const player: Creature = createCreature();

    // -- Mutable catalogs (deep-copied so initializeRogue can mutate them) ----
    const monsterCatalog: CreatureType[] = monsterCatalogData.map(m => ({ ...m }));

    // -- Mutable scroll/potion tables for item generation ---------------------
    const mutableScrollTable: ItemTable[] = scrollTable.map(t => ({ ...t }));
    const mutablePotionTable: ItemTable[] = potionTable.map(t => ({ ...t }));

    // -- Level data -----------------------------------------------------------
    let levels: LevelData[] = [];

    // -- Monster / item lists (shared references, swapped per-level) ----------
    let monsters: Creature[] = [];
    let dormantMonsters: Creature[] = [];
    const floorItems: Item[] = [];
    const packItems: Item[] = [];
    const monsterItemsHopper: Item[] = [];
    const purgatory: Creature[] = [];

    // -- Dungeon map grids (column-major DCOLS×DROWS) --------------------------
    const pmap: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            pmap[i][j] = {
                layers: new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.GRANITE),
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
                rememberedTerrain: TileType.NOTHING,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                exposedToFire: 0,
            };
        }
    }

    const tmap: Tcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        tmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            tmap[i][j] = {
                light: [0, 0, 0],
                oldLight: [0, 0, 0],
            };
        }
    }

    // -- Safety / routing grids -----------------------------------------------
    let safetyMap: number[][] | null = allocGrid();
    let allySafetyMap: number[][] | null = allocGrid();
    let chokeMap: number[][] | null = allocGrid();
    let scentMap: number[][] | null = null;

    // -- Display detail & terrain random values (DCOLS×DROWS) -----------------
    const displayDetail: number[][] = allocGrid();
    const terrainRandomValues: number[][][] = [];
    for (let i = 0; i < DCOLS; i++) {
        terrainRandomValues[i] = [];
        for (let j = 0; j < DROWS; j++) {
            terrainRandomValues[i][j] = new Array(8).fill(0);
        }
    }

    // -- Dynamic colors (mutable copies for depth interpolation) --------------
    const dynamicColors: Color[] = dynamicColorsBounds.map(([start]) => ({ ...start }));

    // -- Message state --------------------------------------------------------
    const messageArchive: { message: string }[] = [];
    for (let i = 0; i < MESSAGE_ARCHIVE_ENTRIES; i++) {
        messageArchive.push({ message: "" });
    }
    let messageArchivePosition = 0;

    const messageState: MessageState = {
        archive: messageArchive.map(m => ({ message: m.message, count: 0, turn: 0, flags: 0 })),
        archivePosition: 0,
        displayedMessage: ["", "", "", ""],
        messagesUnconfirmed: 0,
        combatText: "",
    };

    // -- Recording buffer -----------------------------------------------------
    const recordingBuffer: RecordingBuffer = createRecordingBuffer();

    // -- No-op file IO for browser (recordings not yet supported) -------------
    const noopFileIO: RecordingFileIO = {
        fileExists: () => false,
        appendBytes: () => {},
        readBytes: () => ({ bytes: new Uint8Array(0), newOffset: 0 }),
        writeHeader: () => {},
        removeFile: () => {},
        renameFile: () => {},
        copyFile: () => {},
    };

    const commitDraws = makeCommitDraws(displayBuffer, prevBuffer, browserConsole);

    /** Apply overlay results back to the main display buffer, then render. */
    function applyOverlay(dbuf: Readonly<ScreenDisplayBuffer>): void {
        const results = overlayDisplayBufferFn(displayBuffer, dbuf as ScreenDisplayBuffer);
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
        commitDraws();
    }

    // =========================================================================
    // Shared helper functions — used by multiple DI contexts
    // =========================================================================

    // -- Terrain queries (wrap pmap) ------------------------------------------
    function cellHasTerrainFlagAt(pos: Pos, flagMask: number): boolean {
        return cellHasTerrainFlag(pmap, pos, flagMask);
    }
    function cellHasTMFlagAt(pos: Pos, flagMask: number): boolean {
        return cellHasTMFlag(pmap, pos, flagMask);
    }
    function terrainFlagsAt(pos: Pos): number {
        return terrainFlags(pmap, pos);
    }
    function terrainMechFlagsAt(pos: Pos): number {
        return terrainMechFlags(pmap, pos);
    }
    function discoveredTerrainFlagsAtLocFn(pos: Pos): number {
        return discoveredTerrainFlagsAtLoc(pmap, pos, tileCatalog, (tileType: number) => {
            // successorTerrainFlags: returns the flags of the tile that would replace
            // this secret tile when discovered (its discoverType)
            const discoverType = tileCatalog[tileType].discoverType;
            return discoverType ? tileCatalog[discoverType].flags : 0;
        });
    }
    function pmapAt(pos: Pos): Pcell {
        return pmap[pos.x][pos.y];
    }
    function posNeighborInDirection(pos: Pos, dir: number): Pos {
        return { x: pos.x + nbDirs[dir][0], y: pos.y + nbDirs[dir][1] };
    }
    function monsterAtLocFn(_pos: Pos): Creature | null {
        // For now, search the monsters list by location
        for (const m of monsters) {
            if (m.loc.x === _pos.x && m.loc.y === _pos.y) return m;
        }
        return null;
    }

    // -- FOV wrapper ----------------------------------------------------------
    const fovCtx: FOVContext = {
        cellHasTerrainFlag: cellHasTerrainFlagAt,
        getCellFlags: (x: number, y: number) => pmap[x][y].flags,
    };
    function getFOVMaskWrapped(
        grid: number[][], x: number, y: number, maxRadius: bigint,
        forbiddenTerrain: number, forbiddenFlags: number, cautiousOnWalls: boolean,
    ): void {
        getFOVMaskFn(grid, x, y, maxRadius, forbiddenTerrain, forbiddenFlags, cautiousOnWalls, fovCtx);
    }

    // -- Dijkstra / calculateDistances wrapper --------------------------------
    function buildCalcDistCtx(): CalculateDistancesContext {
        return {
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            monsterAtLoc: monsterAtLocFn,
            monsterAvoids: () => false, // stub for now
            discoveredTerrainFlagsAtLoc: discoveredTerrainFlagsAtLocFn,
            isPlayer: (creature: Creature) => creature === player,
            getCellFlags: (x: number, y: number) => pmap[x][y].flags,
        };
    }
    function calculateDistancesWrapped(
        distanceMap: number[][], destX: number, destY: number,
        blockingFlags: number, traveler: Creature | null,
        canUseSecretDoors: boolean, eightWays: boolean,
    ): void {
        calculateDistancesFn(distanceMap, destX, destY, blockingFlags, traveler, canUseSecretDoors, eightWays, buildCalcDistCtx());
    }
    function pathingDistanceWrapped(
        x1: number, y1: number, x2: number, y2: number, blockingFlags: number,
    ): number {
        return pathingDistanceFn(x1, y1, x2, y2, blockingFlags, buildCalcDistCtx());
    }

    // -- populateGenericCostMap wrapper ----------------------------------------
    function populateGenericCostMapWrapped(costMap: number[][]): void {
        populateGenericCostMapFn(costMap, {
            pmap,
            tmap,
            player,
            rogue: {
                depthLevel: rogue.depthLevel,
                automationActive: rogue.automationActive,
                playerTurnNumber: rogue.playerTurnNumber,
                xpxpThisTurn: rogue.xpxpThisTurn,
                mapToShore: rogue.mapToShore ?? allocGrid(),
            },
            tileCatalog: tileCatalog as any, // FloorTileType uses optional foreColor/backColor
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            terrainFlags: terrainFlagsAt,
            terrainMechFlags: terrainMechFlagsAt,
            discoveredTerrainFlagsAtLoc: discoveredTerrainFlagsAtLocFn,
            monsterAvoids: () => false,
            canPass: () => false,
            distanceBetween,
            monsterAtLoc: monsterAtLocFn,
            playerCanSee: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            itemAtLoc: () => null,
            itemName: () => {},
            messageWithColor: () => {},
            refreshDungeonCell: () => {},
            discoverCell: () => {},
            storeMemories: () => {},
            layerWithTMFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),
            itemMessageColor: Colors.itemMessageColor,
            backgroundMessageColor: Colors.backgroundMessageColor,
            KEY: 0x2000, // ItemCategory.KEY
            assureCosmeticRNG: () => {},
            restoreRNG: () => {},
            getLocationFlags: (x, y, _limitToPlayerKnowledge) => ({
                tFlags: terrainFlags(pmap, { x, y }),
                tmFlags: terrainMechFlags(pmap, { x, y }),
                cellFlags: pmap[x][y].flags,
            }),
        });
    }

    // -- analyzeMap wrapper ----------------------------------------------------
    function analyzeMapWrapped(calculateChokeMap: boolean): void {
        analyzeMapFn(pmap, chokeMap, calculateChokeMap);
    }

    // -- getCellAppearance (minimal) -------------------------------------------
    function getCellAppearance(pos: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color } {
        const cell = pmap[pos.x][pos.y];

        // Check if the player is at this cell
        if (pos.x === player.loc.x && pos.y === player.loc.y) {
            return {
                glyph: player.info.displayChar,
                foreColor: { ...Colors.white },
                backColor: { ...tileCatalog[cell.layers[DungeonLayer.Dungeon]].backColor! },
            };
        }

        // Get the highest priority terrain layer
        const layer = highestPriorityLayer(pmap, pos.x, pos.y, false);
        const tile = tileCatalog[cell.layers[layer]];

        const foreColor: Color = tile.foreColor
            ? { ...tile.foreColor }
            : { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
        const backColor: Color = tile.backColor
            ? { ...tile.backColor }
            : { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };

        // Bake terrain random values into colors
        bakeTerrainColors(foreColor, backColor, terrainRandomValues[pos.x][pos.y], rogue.trueColorMode);

        // Apply tmap lighting
        const lightR = tmap[pos.x][pos.y].light[0];
        const lightG = tmap[pos.x][pos.y].light[1];
        const lightB = tmap[pos.x][pos.y].light[2];
        foreColor.red = clamp(Math.floor(foreColor.red * (100 + lightR) / 100), 0, 100);
        foreColor.green = clamp(Math.floor(foreColor.green * (100 + lightG) / 100), 0, 100);
        foreColor.blue = clamp(Math.floor(foreColor.blue * (100 + lightB) / 100), 0, 100);
        backColor.red = clamp(Math.floor(backColor.red * (100 + lightR) / 100), 0, 100);
        backColor.green = clamp(Math.floor(backColor.green * (100 + lightG) / 100), 0, 100);
        backColor.blue = clamp(Math.floor(backColor.blue * (100 + lightB) / 100), 0, 100);

        return { glyph: tile.displayChar as DisplayGlyph, foreColor, backColor };
    }

    // -- displayLevel (minimal) ------------------------------------------------
    function displayLevelFn(): void {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                const { glyph, foreColor, backColor } = getCellAppearance({ x: i, y: j });
                plotCharWithColor(
                    glyph,
                    { windowX: mapToWindowX(i), windowY: mapToWindowY(j) },
                    foreColor,
                    backColor,
                    displayBuffer,
                );
            }
        }
    }

    // -- shuffleTerrainColors -------------------------------------------------
    function shuffleTerrainColorsFn(percentOfCells: number, resetAll: boolean): void {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (resetAll || randPercent(percentOfCells)) {
                    for (let k = 0; k < 8; k++) {
                        terrainRandomValues[i][j][k] = randRange(0, 1000);
                    }
                    // Mark terrain colors as dirty (would set TERRAIN_COLORS_DIRTY flag)
                }
            }
        }
    }

    // -- updateVision (simplified) ---------------------------------------------
    function updateVisionFn(_refreshDisplay: boolean): void {
        // Simplified vision: mark all cells in player's FOV as visible
        const grid = allocGrid();
        fillGrid(grid, 0);
        getFOVMaskWrapped(
            grid, player.loc.x, player.loc.y,
            BigInt(DCOLS + DROWS) * FP_FACTOR,
            TerrainFlag.T_OBSTRUCTS_VISION,
            0, false,
        );
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                // Clear old visibility
                pmap[i][j].flags &= ~(TileFlag.VISIBLE | TileFlag.IN_FIELD_OF_VIEW | TileFlag.WAS_VISIBLE);
                if (grid[i][j]) {
                    pmap[i][j].flags |= TileFlag.IN_FIELD_OF_VIEW;
                    pmap[i][j].flags |= TileFlag.VISIBLE;
                    pmap[i][j].flags |= TileFlag.DISCOVERED;
                }
            }
        }
        freeGrid(grid);
    }

    // -- ButtonContext (needed by several menu functions) ----------------------
    const buttonCtx: ButtonContext = {
        rogue,
        applyColorAverage,
        bakeColor,
        separateColors,
        strLenWithoutEscapes,
        decodeMessageColor,
        encodeMessageColor,
        plotCharToBuffer,
        locIsInWindow,
        createScreenDisplayBuffer,
        clearDisplayBuffer(dbuf) { clearDisplayBuffer(dbuf); },
        overlayDisplayBuffer(dbuf) {
            applyOverlay(dbuf);
        },
        saveDisplayBuffer() {
            return saveDisplayBufferFn(displayBuffer);
        },
        restoreDisplayBuffer(saved) {
            restoreDisplayBufferFn(displayBuffer, saved);
            commitDraws();
        },
        async nextBrogueEvent(_textInput, _colorsDance, _realInputEvenInPlayback) {
            commitDraws();
            return browserConsole.waitForEvent();
        },
        async pauseBrogue(ms) {
            commitDraws();
            await asyncPause(ms);
            // Check if an event arrived during the pause
            const ev = browserConsole.nextKeyOrMouseEvent(false, false);
            if (ev.eventType !== 0) { // EventType.Keystroke or mouse
                return true; // interrupted
            }
            return false;
        },
        async pauseAnimation(ms) {
            commitDraws();
            await asyncPause(ms);
            return false;
        },
    };

    // -- Partial InventoryContext for rectangularShading / printTextBox --------
    const inventoryCtxPartial: Pick<InventoryContext, "storeColorComponents"> = {
        storeColorComponents,
    };

    // We build a fuller InventoryContext for printTextBox. This is a minimal
    // subset — the runtime only calls printTextBox from the menu, so we only
    // need the methods it actually uses.
    const inventoryCtxForTextBox = {
        rogue,
        packItems,
        applyColorAverage,
        encodeMessageColor,
        storeColorComponents,
        createScreenDisplayBuffer,
        clearDisplayBuffer(dbuf: ScreenDisplayBuffer) { clearDisplayBuffer(dbuf); },
        overlayDisplayBuffer(dbuf: ScreenDisplayBuffer) {
            applyOverlay(dbuf);
        },
        saveDisplayBuffer() { return saveDisplayBufferFn(displayBuffer); },
        restoreDisplayBuffer(saved: SavedDisplayBuffer) {
            restoreDisplayBufferFn(displayBuffer, saved);
            commitDraws();
        },
        drawButton(button: BrogueButton, highlight: ButtonDrawState, dbuf: ScreenDisplayBuffer | null) {
            drawButtonFn(button, highlight, dbuf, buttonCtx);
        },
        plotCharToBuffer,
        printStringWithWrapping(
            theString: string, x: number, y: number, width: number,
            foreColor: Readonly<Color>, backColor: Readonly<Color>,
            dbuf: ScreenDisplayBuffer,
        ): number {
            return printStringWithWrapping(theString, x, y, width, foreColor, backColor, dbuf);
        },
        strLenWithoutEscapes,
        wrapText,
        async buttonInputLoop(
            buttons: BrogueButton[], count: number,
            winX: number, winY: number, winWidth: number, winHeight: number,
        ) {
            return buttonInputLoopFn(buttons, count, winX, winY, winWidth, winHeight, buttonCtx);
        },
        printCarriedItemDetails: () => 0,       // stub
        itemName: () => "item",                  // stub
        upperCase: (s: string) => s.toUpperCase(),
        itemMagicPolarity: () => 0,              // stub
        numberOfItemsInPack: () => 0,            // stub
        clearCursorPath: () => {},               // stub
        confirmMessages: () => {},               // stub
        message: (_msg: string, _flags: number) => {},  // stub
        mapToWindowX,
        mapToWindowY,
        white: Colors.white,
        gray: Colors.gray,
        black: Colors.black,
        itemColor: Colors.yellow,
        goodMessageColor: Colors.goodMessageColor,
        badMessageColor: Colors.badMessageColor,
        interfaceBoxColor: Colors.interfaceBoxColor,
        G_GOOD_MAGIC: DisplayGlyph.G_GOOD_MAGIC,
        G_BAD_MAGIC: DisplayGlyph.G_BAD_MAGIC
    } satisfies InventoryContext;

    // -- EquipContext for initializeRogue starting equipment -------------------
    function buildEquipContext(): EquipContext {
        const equipState: EquipmentState = {
            player,
            weapon: rogue.weapon,
            armor: rogue.armor,
            ringLeft: rogue.ringLeft,
            ringRight: rogue.ringRight,
            strength: rogue.strength,
            clairvoyance: rogue.clairvoyance,
            stealthBonus: rogue.stealthBonus,
            regenerationBonus: rogue.regenerationBonus,
            lightMultiplier: rogue.lightMultiplier,
            awarenessBonus: 0,
            transference: rogue.transference,
            wisdomBonus: rogue.wisdomBonus,
            reaping: rogue.reaping,
        };
        return {
            state: equipState,
            message: () => {},  // silent during init
            updateRingBonuses: () => {},
            updateEncumbrance: () => {
                recalculateEquipmentBonuses(equipState);
            },
            itemName: () => "item",
        };
    }

    /**
     * Sync equipment state from EquipContext back to rogue state after equip.
     */
    function syncEquipState(equipCtx: EquipContext): void {
        rogue.weapon = equipCtx.state.weapon;
        rogue.armor = equipCtx.state.armor;
        rogue.ringLeft = equipCtx.state.ringLeft;
        rogue.ringRight = equipCtx.state.ringRight;
    }

    // -- chooseVorpalEnemy: picks a random monster class -----------------------
    function chooseVorpalEnemy(): MonsterType {
        // In the C code this picks a random monster from a random class.
        // We pick a random monster class, then a random monster from it.
        const classIdx = randRange(0, MONSTER_CLASS_COUNT - 1);
        const cls = monsterClassCatalog[classIdx];
        if (cls.memberList.length === 0) return MonsterType.MK_RAT;
        return cls.memberList[randRange(0, cls.memberList.length - 1)];
    }

    // -- Build GameInitContext ------------------------------------------------
    function buildGameInitContext(): GameInitContext {
        return {
            rogue,
            player,
            gameConst,
            gameVariant,

            // Catalogs
            monsterCatalog,
            meteredItemsGenerationTable: meteredItemsGenTable,
            featTable: [],  // No feats in base Brogue CE (numberFeats=0)
            lightCatalog: lightCatalogData,
            MINERS_LIGHT: LightType.MINERS_LIGHT,

            // Dynamic colors
            dynamicColorsBounds,
            dynamicColors,

            // Grids
            displayDetail,
            terrainRandomValues,

            // Message archive
            messageArchive,
            messageArchivePosition,
            setMessageArchivePosition(n: number) { messageArchivePosition = n; },

            // Previous game seed
            previousGameSeed,
            setPreviousGameSeed(seed: bigint) { previousGameSeed = seed; menuCtx.previousGameSeed = seed; },

            // Levels
            levels,
            setLevels(l: LevelData[]) { levels = l; },

            // Monster / item lists
            monsters,
            dormantMonsters,
            setMonsters(m: Creature[]) { monsters = m; },
            setDormantMonsters(m: Creature[]) { dormantMonsters = m; },
            floorItems,
            packItems,
            monsterItemsHopper,
            purgatory,

            // Safety grids
            safetyMap: safetyMap!,
            allySafetyMap: allySafetyMap!,
            chokeMap: chokeMap!,
            scentMap,
            setScentMap(map: number[][] | null) { scentMap = map; },

            // RNG
            seedRandomGenerator,
            rand_range: randRange,
            rand_64bits: rand64bits,

            // Grid operations
            allocGrid,
            fillGrid,
            zeroOutGrid,
            freeGrid,
            distanceBetween,

            // Item operations
            generateItem(category: number, kind: number): Item {
                return generateItem(category, kind, {
                    rng: { randRange, randPercent, randClump },
                    gameConstants: gameConst,
                    depthLevel: rogue.depthLevel,
                    scrollTable: mutableScrollTable,
                    potionTable: mutablePotionTable,
                    depthAccelerator: gameConst.depthAccelerator,
                    chooseVorpalEnemy,
                });
            },
            addItemToPack(item: Item): Item {
                return addItemToPack(item, packItems);
            },
            identify(item: Item): void {
                identify(item, gameConst);
            },
            equipItem(item: Item, force: boolean, swapItem: Item | null): void {
                const equipCtx = buildEquipContext();
                equipItem(item, force, swapItem, equipCtx);
                syncEquipState(equipCtx);
            },
            recalculateEquipmentBonuses(): void {
                const equipState: EquipmentState = {
                    player,
                    weapon: rogue.weapon,
                    armor: rogue.armor,
                    ringLeft: rogue.ringLeft,
                    ringRight: rogue.ringRight,
                    strength: rogue.strength,
                    clairvoyance: rogue.clairvoyance,
                    stealthBonus: rogue.stealthBonus,
                    regenerationBonus: rogue.regenerationBonus,
                    lightMultiplier: rogue.lightMultiplier,
                    awarenessBonus: 0,
                    transference: rogue.transference,
                    wisdomBonus: rogue.wisdomBonus,
                    reaping: rogue.reaping,
                };
                recalculateEquipmentBonuses(equipState);
                // Sync back
                rogue.clairvoyance = equipState.clairvoyance;
                rogue.stealthBonus = equipState.stealthBonus;
                rogue.regenerationBonus = equipState.regenerationBonus;
                rogue.lightMultiplier = equipState.lightMultiplier;
                rogue.transference = equipState.transference;
                rogue.wisdomBonus = equipState.wisdomBonus;
                rogue.reaping = equipState.reaping;
            },

            // Creature operations
            initializeGender(monst: Creature): void {
                initializeGender(monst, { randRange, randPercent });
            },
            initializeStatus(monst: Creature): void {
                initializeStatus(monst, monst === player);
            },

            // Recording & display
            initRecording(): void {
                initRecordingFn({
                    buffer: recordingBuffer,
                    rogue: rogue as any, // RuntimeRogueState satisfies InitRecordingRogue
                    currentFilePath,
                    fileIO: noopFileIO,
                    gameConst,
                    seedRandomGenerator,
                    previousGameSeed,
                    nonInteractivePlayback: false,
                    dialogAlert: () => {},
                    annotationPathname: "",
                });
            },
            shuffleFlavors(): void {
                shuffleFlavors(gameConst, randRange, randPercent);
            },
            resetDFMessageEligibility(): void {
                resetDFMessageEligibility(dungeonFeatureCatalog);
            },
            deleteMessages(): void {
                // During initialization, we just clear the displayed messages
                // rather than wiring the full MessageContext (which needs sidebar etc.)
                for (let i = 0; i < messageState.displayedMessage.length; i++) {
                    messageState.displayedMessage[i] = "";
                }
                messageState.messagesUnconfirmed = 0;
            },
            clearMessageArchive(): void {
                clearMessageArchiveFn(messageState);
            },
            blackOutScreen(dbuf: ScreenDisplayBuffer): void {
                blackOutScreen(dbuf);
            },

            // Display buffer
            displayBuffer,

            // Messages
            message(_msg: string, _flags: number): void {
                // TODO: Wire to full message system in Step 3c
            },
            messageWithColor(_msg: string, _color: Readonly<Color>, _flags: number): void {
                // TODO: Wire to full message system in Step 3c
            },
            flavorMessage(_msg: string): void {
                // TODO: Wire to full message system in Step 3c
            },

            // Color encoding - adapts the (color) => string API to the (buf, pos, color) => void API
            encodeMessageColor(buf: string[], pos: number, color: Readonly<Color>): void {
                buf[pos] = encodeMessageColor(color);
            },

            // Colors
            itemMessageColor: Colors.itemMessageColor,
            white: Colors.white,
            backgroundMessageColor: Colors.backgroundMessageColor,

            // Variant initialization (these set gameConst counts from catalog sizes)
            initializeGameVariantBrogue(): void {
                // Set counts from actual catalog lengths
                gameConst.numberScrollKinds = mutableScrollTable.length;
                gameConst.numberPotionKinds = mutablePotionTable.length;
                gameConst.numberMeteredItems = meteredItemsGenTable.length;
                // Other counts remain at their defaults or 0 until those catalogs are wired
            },
            initializeGameVariantRapidBrogue(): void {
                // Rapid Brogue uses the same catalogs but different constants
                gameConst.deepestLevel = 10;
                gameConst.amuletLevel = 7;
                gameConst.depthAccelerator = 4;
                gameConst.numberScrollKinds = mutableScrollTable.length;
                gameConst.numberPotionKinds = mutablePotionTable.length;
                gameConst.numberMeteredItems = meteredItemsGenTable.length;
            },
            initializeGameVariantBulletBrogue(): void {
                // Bullet Brogue: very short
                gameConst.deepestLevel = 5;
                gameConst.amuletLevel = 4;
                gameConst.depthAccelerator = 8;
                gameConst.numberScrollKinds = mutableScrollTable.length;
                gameConst.numberPotionKinds = mutablePotionTable.length;
                gameConst.numberMeteredItems = meteredItemsGenTable.length;
            },

            // Misc
            KEYBOARD_LABELS,
        };
    }

    // -- Build CleanupContext --------------------------------------------------
    function buildCleanupContext(): CleanupContext {
        return {
            rogue,
            player,
            gameConst,
            levels,
            setLevels(l: LevelData[]) { levels = l; },
            monsters,
            dormantMonsters,
            floorItems,
            packItems,
            monsterItemsHopper,
            purgatory,
            safetyMap,
            allySafetyMap,
            chokeMap,
            scentMap,
            setSafetyMap(map: number[][] | null) { safetyMap = map; },
            setAllySafetyMap(map: number[][] | null) { allySafetyMap = map; },
            setChokeMap(map: number[][] | null) { chokeMap = map; },
            setScentMap(map: number[][] | null) { scentMap = map; },
            freeGrid,
            deleteItem(_item: Item): void {
                // In TS, items are GC'd; this is a no-op
            },
            deleteAllFlares(): void {
                deleteAllFlares(rogue as any);
            },
        };
    }

    // -- Build ArchitectContext ------------------------------------------------
    function buildArchitectContext(): ArchitectContext {
        const machineCtx: MachineContext = {
            pmap,
            chokeMap: chokeMap!,
            tileCatalog: tileCatalog as any,
            blueprintCatalog,
            dungeonFeatureCatalog,
            dungeonProfileCatalog,
            autoGeneratorCatalog,
            depthLevel: rogue.depthLevel,
            machineNumber: rogue.rewardRoomsGenerated,
            rewardRoomsGenerated: rogue.rewardRoomsGenerated,
            staleLoopMap: rogue.staleLoopMap,
            gameConstants: {
                numberBlueprints: gameConst.numberBlueprints,
                numberAutogenerators: gameConst.numberAutogenerators,
                amuletLevel: gameConst.amuletLevel,
                deepestLevelForMachines: gameConst.deepestLevelForMachines,
                machinesPerLevelSuppressionMultiplier: gameConst.machinesPerLevelSuppressionMultiplier,
                machinesPerLevelSuppressionOffset: gameConst.machinesPerLevelSuppressionOffset,
                machinesPerLevelIncreaseFactor: gameConst.machinesPerLevelIncreaseFactor,
                maxLevelForBonusMachines: gameConst.maxLevelForBonusMachines,
            },
            itemOps: {
                generateItem(_cat, _kind) { return { category: 0, kind: 0, quantity: 1, flags: 0, keyLoc: [], originDepth: 0 }; },
                deleteItem() {},
                placeItemAt() {},
                removeItemFromArray() {},
                itemIsHeavyWeapon() { return false; },
                itemIsPositivelyEnchanted() { return false; },
            } satisfies ItemOps,
            monsterOps: {
                spawnHorde() { return null; },
                monsterAtLoc: monsterAtLocFn as any,
                killCreature() {},
                generateMonster() { return null; },
                toggleMonsterDormancy() {},
                iterateMachineMonsters() { return []; },
            } satisfies MonsterOps,
            analyzeMap: analyzeMapWrapped,
            calculateDistances: calculateDistancesWrapped,
            getFOVMask: getFOVMaskWrapped,
            populateGenericCostMap: populateGenericCostMapWrapped,
            pathingDistance: (x1: number, y1: number, x2: number, y2: number) =>
                pathingDistanceWrapped(x1, y1, x2, y2, 0),
            floorItems: floorItems as any,
            packItems: packItems as any,
        };

        const bridgeCtx: BuildBridgeContext = {
            depthLevel: rogue.depthLevel,
            depthAccelerator: gameConst.depthAccelerator,
            pathingDistance: (x1, y1, x2, y2, blockFlags) =>
                pathingDistanceWrapped(x1, y1, x2, y2, blockFlags),
        };

        return {
            pmap,
            depthLevel: rogue.depthLevel,
            gameConstants: gameConst,
            dungeonProfileCatalog,
            dungeonFeatureCatalog,
            blueprintCatalog,
            autoGeneratorCatalog,
            tileCatalog: tileCatalog as any,
            machineNumber: rogue.rewardRoomsGenerated,
            rewardRoomsGenerated: rogue.rewardRoomsGenerated,
            staleLoopMap: rogue.staleLoopMap,
            machineContext: machineCtx,
            bridgeContext: bridgeCtx,
            analyzeMap: analyzeMapWrapped,
            getFOVMask: getFOVMaskWrapped,
            populateGenericCostMap: populateGenericCostMapWrapped,
            calculateDistances: calculateDistancesWrapped,
        };
    }

    // -- Build LevelContext ----------------------------------------------------
    function buildLevelContext(): LevelContext {
        return {
            rogue,
            player,
            gameConst,
            FP_FACTOR,

            levels,
            pmap,

            monsters,
            dormantMonsters,
            floorItems,
            setMonsters(m: Creature[]) { monsters = m; },
            setDormantMonsters(m: Creature[]) { dormantMonsters = m; },

            scentMap,
            setScentMap(map: number[][] | null) { scentMap = map; },

            dynamicColors,
            dynamicColorsBounds,

            levelFeelings: [
                { message: "You sense a very powerful presence on this level.", color: Colors.goodMessageColor },
                { message: "You sense an ancient and very powerful magic here.", color: Colors.goodMessageColor },
            ],

            allocGrid,
            fillGrid,
            freeGrid,

            applyColorAverage,

            seedRandomGenerator,
            rand_64bits: rand64bits,

            synchronizePlayerTimeState() {
                // Sync player's time-related state (simplified)
            },

            cellHasTerrainFlag: cellHasTerrainFlagAt,
            coordinatesAreInMap,
            pmapAt,
            posNeighborInDirection,

            calculateDistances: calculateDistancesWrapped,
            pathingDistance: pathingDistanceWrapped,
            currentStealthRange() {
                // Simplified stealth range calculation
                return 14 + rogue.stealthBonus;
            },

            getQualifyingLocNear(target, _hallwaysAllowed, _forbidCellFlags, forbidTerrainFlags, forbidMapFlags, _deterministic, _allowFlood) {
                // Simplified: search outward from target for a valid cell
                for (let r = 0; r < Math.max(DCOLS, DROWS); r++) {
                    for (let dx = -r; dx <= r; dx++) {
                        for (let dy = -r; dy <= r; dy++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                            const x = target.x + dx;
                            const y = target.y + dy;
                            if (!coordinatesAreInMap(x, y)) continue;
                            if (terrainFlagsAt({ x, y }) & forbidTerrainFlags) continue;
                            if (pmap[x][y].flags & forbidMapFlags) continue;
                            return { x, y };
                        }
                    }
                }
                return { ...target };
            },
            getQualifyingPathLocNear(target, _hallwaysAllowed, _terrainMustBe, _terrainMustNotBe, _pathingBlockers, _cellMustNotBe, _deterministic) {
                // Simplified: just return the target
                return { ...target };
            },

            digDungeon() {
                const archCtx = buildArchitectContext();
                digDungeonFn(archCtx);
                // Sync machineNumber back
                rogue.rewardRoomsGenerated = archCtx.rewardRoomsGenerated;
                rogue.staleLoopMap = archCtx.staleLoopMap;
            },
            placeStairs() {
                const result = placeStairsFn(pmap, levels, rogue.depthLevel, gameConst.deepestLevel);
                if (result) {
                    rogue.upLoc = { ...result.upStairsLoc };
                    rogue.downLoc = { ...result.downStairsLoc };
                    levels[rogue.depthLevel - 1].upStairsLoc = { ...result.upStairsLoc };
                    levels[rogue.depthLevel - 1].downStairsLoc = { ...result.downStairsLoc };
                    return { success: true, upStairsLoc: result.upStairsLoc };
                }
                return { success: false, upStairsLoc: { x: 0, y: 0 } };
            },
            initializeLevel(upStairsLoc: Pos) {
                initializeLevelFn(pmap, upStairsLoc, rogue.depthLevel, levels, getFOVMaskWrapped);
            },
            setUpWaypoints() {
                const result = setUpWaypointsFn(pmap, populateGenericCostMapWrapped, getFOVMaskWrapped);
                rogue.wpDistance = result.wpDistance;
            },
            shuffleTerrainColors: shuffleTerrainColorsFn,

            numberOfMatchingPackItems(_category, _flags, _flags2, _useFlags) {
                // Simplified: count items in pack matching category
                let count = 0;
                for (const item of packItems) {
                    if (item.category & _category) count++;
                }
                return count;
            },
            itemAtLoc(loc: Pos) {
                for (const item of floorItems) {
                    if (item.loc.x === loc.x && item.loc.y === loc.y) return item;
                }
                return null;
            },
            describedItemName(_item: Item) {
                return "an item"; // Simplified
            },
            generateItem(category: number, kind: number): Item {
                return generateItem(category, kind, {
                    rng: { randRange, randPercent, randClump },
                    gameConstants: gameConst,
                    depthLevel: rogue.depthLevel,
                    scrollTable: mutableScrollTable,
                    potionTable: mutablePotionTable,
                    depthAccelerator: gameConst.depthAccelerator,
                    chooseVorpalEnemy,
                });
            },
            placeItemAt(item: Item, loc: Pos) {
                item.loc = { ...loc };
                floorItems.push(item);
            },

            restoreMonster(_monst, _mapToStairs, _mapToPit) {
                restoreMonsterFn(); // stub
            },
            restoreItems() {
                restoreItemsFn(); // stub
            },
            updateMonsterState(_monst) {
                // Stub — monster AI not yet wired
            },

            storeMemories(x, y) {
                // Simplified: save remembered appearance
                const cell = pmap[x][y];
                cell.rememberedTerrain = cell.layers[highestPriorityLayer(pmap, x, y, false)];
                cell.rememberedCellFlags = cell.flags;
                cell.rememberedTerrainFlags = terrainFlagsAt({ x, y });
                cell.rememberedTMFlags = terrainMechFlagsAt({ x, y });
                const appearance = getCellAppearance({ x, y });
                cell.rememberedAppearance = {
                    character: appearance.glyph,
                    foreColorComponents: [appearance.foreColor.red, appearance.foreColor.green, appearance.foreColor.blue],
                    backColorComponents: [appearance.backColor.red, appearance.backColor.green, appearance.backColor.blue],
                    opacity: 100,
                };
            },
            updateVision: updateVisionFn,
            discoverCell(x, y) {
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            },
            updateMapToShore() {
                const shore = updateMapToShoreFn(pmap);
                rogue.mapToShore = shore;
            },
            updateRingBonuses() {
                // Simplified — ring bonuses recalculated via equipment system
                const equipState: EquipmentState = {
                    player,
                    weapon: rogue.weapon,
                    armor: rogue.armor,
                    ringLeft: rogue.ringLeft,
                    ringRight: rogue.ringRight,
                    strength: rogue.strength,
                    clairvoyance: rogue.clairvoyance,
                    stealthBonus: rogue.stealthBonus,
                    regenerationBonus: rogue.regenerationBonus,
                    lightMultiplier: rogue.lightMultiplier,
                    awarenessBonus: 0,
                    transference: rogue.transference,
                    wisdomBonus: rogue.wisdomBonus,
                    reaping: rogue.reaping,
                };
                recalculateEquipmentBonuses(equipState);
                rogue.clairvoyance = equipState.clairvoyance;
                rogue.stealthBonus = equipState.stealthBonus;
                rogue.regenerationBonus = equipState.regenerationBonus;
                rogue.lightMultiplier = equipState.lightMultiplier;
                rogue.transference = equipState.transference;
                rogue.wisdomBonus = equipState.wisdomBonus;
                rogue.reaping = equipState.reaping;
            },

            displayLevel: displayLevelFn,
            refreshSideBar(_x, _y, _justClearing) {
                // Stub — sidebar not yet wired
            },
            messageWithColor(_msg, _color, _flags) {
                // TODO: Wire to full message system
            },
            RNGCheck() {
                // No-op for now — recording validation
            },
            flushBufferToFile() {
                // No-op — recording not yet supported
            },
            deleteAllFlares() {
                deleteAllFlares(rogue as any);
            },
            hideCursor() {
                // No-op for browser
            },

            itemMessageColor: Colors.itemMessageColor,
            nbDirs,
            clamp,
        };
    }

    // =========================================================================
    // buildInputContext — wires io-input.ts functions to game state
    // =========================================================================

    /**
     * Build the TargetingContext shared between input and targeting functions.
     */
    function buildTargetingContext(): TargetingContext {
        return {
            rogue,
            player,
            pmap,
            nextStep(distanceMap, target, monst, preferDiagonals) {
                const travelCtx = buildTravelExploreContext();
                return nextStepFn(distanceMap, target, monst, preferDiagonals, travelCtx);
            },
            allocGrid,
            fillGrid,
            dijkstraScan: dijkstraScanFn,
            populateCreatureCostMap(costMap, monst) {
                populateCreatureCostMapWrapped(costMap, monst);
            },
            cellHasTMFlag: cellHasTMFlagAt,
            refreshDungeonCell(_loc) {
                // Simplified: just re-render that cell
                const { glyph, foreColor, backColor } = getCellAppearance(_loc);
                plotCharWithColor(
                    glyph,
                    { windowX: mapToWindowX(_loc.x), windowY: mapToWindowY(_loc.y) },
                    foreColor,
                    backColor,
                    displayBuffer,
                );
            },
            getCellAppearance,
            applyColorAugment,
            separateColors,
            plotCharWithColor(glyph, windowPos, foreColor, backColor) {
                plotCharWithColor(glyph, windowPos, foreColor, backColor, displayBuffer);
            },
            mapToWindow(loc) {
                return { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) };
            },
        };
    }

    /**
     * Wrap populateCreatureCostMap with the CostMapFovContext.
     */
    function populateCreatureCostMapWrapped(costMap: number[][], monst: Creature): void {
        const costCtx: CostMapFovContext = {
            pmap,
            tmap,
            player,
            rogue: {
                depthLevel: rogue.depthLevel,
                automationActive: rogue.automationActive,
                playerTurnNumber: rogue.playerTurnNumber,
                xpxpThisTurn: rogue.xpxpThisTurn,
                mapToShore: rogue.mapToShore ?? allocGrid(),
            },
            tileCatalog: tileCatalog as any,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            terrainFlags: terrainFlagsAt,
            terrainMechFlags: terrainMechFlagsAt,
            discoveredTerrainFlagsAtLoc: discoveredTerrainFlagsAtLocFn,
            monsterAvoids: () => false,
            canPass: () => false,
            distanceBetween,
            monsterAtLoc: monsterAtLocFn,
            playerCanSee: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            itemAtLoc: () => null,
            itemName: () => {},
            messageWithColor: () => {},
            refreshDungeonCell: () => {},
            discoverCell: () => {},
            storeMemories: () => {},
            layerWithTMFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),
            itemMessageColor: Colors.itemMessageColor,
            backgroundMessageColor: Colors.backgroundMessageColor,
            KEY: ItemCategory.KEY,
            assureCosmeticRNG: () => {},
            restoreRNG: () => {},
            getLocationFlags: (x, y, _limitToPlayerKnowledge) => ({
                tFlags: terrainFlags(pmap, { x, y }),
                tmFlags: terrainMechFlags(pmap, { x, y }),
                cellFlags: pmap[x][y].flags,
            }),
        };
        populateCreatureCostMapFn(costMap, monst, costCtx);
    }

    /**
     * Build a simplified TravelExploreContext for stair usage, travel, and explore.
     */
    function buildTravelExploreContext(): TravelExploreContext {
        return {
            pmap,
            player,
            rogue: {
                disturbed: rogue.disturbed,
                automationActive: rogue.automationActive,
                autoPlayingLevel: rogue.autoPlayingLevel,
                gameHasEnded: rogue.gameHasEnded,
                blockCombatText: rogue.blockCombatText,
                playbackMode: rogue.playbackMode,
                cursorLoc: rogue.cursorLoc,
                upLoc: rogue.upLoc,
                downLoc: rogue.downLoc,
                depthLevel: rogue.depthLevel,
                deepestLevel: rogue.deepestLevel,
                mode: rogue.mode as any,
            },
            monsters,
            nbDirs: nbDirs as any,
            gameConst: { deepestLevel: gameConst.deepestLevel },
            tileCatalog: tileCatalog as any,

            coordinatesAreInMap,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            diagonalBlocked(x1, y1, x2, y2, limitToPlayerKnowledge) {
                return diagonalBlockedFn(x1, y1, x2, y2, (loc) => {
                    if (limitToPlayerKnowledge) {
                        return discoveredTerrainFlagsAtLocFn(loc);
                    }
                    return terrainFlagsAt(loc);
                });
            },
            monsterAvoids: () => false,  // stub
            monsterAtLoc: monsterAtLocFn,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            canPass: () => false,
            monstersAreTeammates: () => false,
            monstersAreEnemies: () => true,
            monsterDamageAdjustmentAmount: () => 0,

            playerMoves(direction) {
                const moveCtx = buildPlayerMoveContext();
                return playerMovesFn(direction, moveCtx);
            },

            allocGrid,
            freeGrid,
            calculateDistances: calculateDistancesWrapped,
            dijkstraScan: dijkstraScanFn,
            populateCreatureCostMap: populateCreatureCostMapWrapped,

            knownToPlayerAsPassableOrSecretDoor(pos) {
                const cell = pmap[pos.x][pos.y];
                if (!(cell.flags & TileFlag.DISCOVERED)) return false;
                const tf = terrainFlagsAt(pos);
                if (!(tf & TerrainFlag.T_OBSTRUCTS_PASSABILITY)) return true;
                const tmf = terrainMechFlagsAt(pos);
                return !!(tmf & TerrainMechFlag.TM_IS_SECRET);
            },

            itemAtLoc(loc) {
                for (const item of floorItems) {
                    if (item.loc.x === loc.x && item.loc.y === loc.y) return item;
                }
                return null;
            },
            numberOfMatchingPackItems(category, _requiredFlags, _forbiddenFlags, _isBlessed) {
                let count = 0;
                for (const item of packItems) {
                    if (item.category & category) count++;
                }
                return count;
            },

            message(_msg, _flags) { /* stub */ },
            messageWithColor(_msg, _color, _flags) { /* stub */ },
            confirmMessages() { /* stub */ },
            hiliteCell(x, y, color, strength, saveBuf) {
                const tCtx = buildTargetingContext();
                hiliteCellFn(x, y, color, strength, saveBuf, tCtx);
            },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            refreshSideBar(_x, _y, _focus) { /* stub */ },
            updateFlavorText() { /* stub */ },
            clearCursorPath() {
                clearCursorPathFn(buildTargetingContext());
            },
            hilitePath(path, steps, removeHighlight) {
                hilitePatchFn(path, steps, removeHighlight, buildTargetingContext());
            },
            getPlayerPathOnMap(path, distanceMap, playerLoc) {
                return getPlayerPathOnMapFn(path, distanceMap, playerLoc, buildTargetingContext());
            },
            commitDraws,
            pauseAnimation(_duration, _behavior) {
                // Synchronous: check for interrupt via queue
                return browserConsole.pauseForMilliseconds(0, { interruptForMouseMove: false });
            },
            recordMouseClick() { /* stub — recordings not wired */ },
            mapToWindowX,
            mapToWindowY,
            windowToMapX: windowToMapXFromDisplay,
            windowToMapY: windowToMapYFromDisplay,
            updatePlayerUnderwaterness() { /* stub */ },
            updateVision: updateVisionFn,
            nextBrogueEvent(_event, _textInput, _colorsDance, _realInputOnly) {
                /* stub — synchronous API returns queue peek */
            },
            executeMouseClick(_event) { /* stub — will use InputContext dispatch */ },
            printString(str, x, y, fg, bg) {
                printStringFn(str, x, y, fg, bg, displayBuffer);
            },
            hiliteColor: Colors.white,
            white: Colors.white,
            black: Colors.black,
            lightBlue: Colors.lightBlue ?? Colors.teal,
            backgroundMessageColor: Colors.backgroundMessageColor,

            startLevel(previousDepth, stairDirection) {
                const levelCtx = buildLevelContext();
                startLevelFn(levelCtx, previousDepth, stairDirection);
                displayLevelFn();
                commitDraws();
            },
            victory(_isDescending) { /* stub — Step 3e */ },

            fpFactor: Number(FP_FACTOR),
            AMULET: ItemCategory.AMULET,
            D_WORMHOLING: false,
            posEq(a, b) { return a.x === b.x && a.y === b.y; },
            INVALID_POS,
            ASCEND_KEY: 60, // '<'
            DESCEND_KEY: 62, // '>'
            RETURN_KEY: 13,
        };
    }

    /**
     * Build the PlayerMoveContext for playerMoves/playerRuns.
     */
    function buildPlayerMoveContext(): PlayerMoveContext & PlayerRunContext {
        return {
            pmap,
            player,
            rogue: {
                disturbed: rogue.disturbed,
                automationActive: rogue.automationActive,
                weapon: rogue.weapon,
                armor: rogue.armor,
                downLoc: rogue.downLoc,
                upLoc: rogue.upLoc,
                gameHasEnded: rogue.gameHasEnded,
            },
            nbDirs: nbDirs as any,

            coordinatesAreInMap,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            cellHasTerrainType(pos, tileType) {
                const cell = pmap[pos.x][pos.y];
                for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                    if (cell.layers[layer] === tileType) return true;
                }
                return false;
            },
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            diagonalBlocked(x1, y1, x2, y2, _isPlayer) {
                return diagonalBlockedFn(x1, y1, x2, y2, (loc) => terrainFlagsAt(loc));
            },
            monsterAtLoc: monsterAtLocFn,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterRevealed: () => false,
            monstersAreEnemies: () => true,
            monsterWillAttackTarget: () => true,
            monsterName: () => "monster",
            monsterAvoids: () => false,
            monsterShouldFall: () => false,
            forbiddenFlagsForMonster: () => 0,
            distanceBetween,
            allMonsters: () => monsters,

            layerWithTMFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),
            layerWithFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),

            handleWhipAttacks: () => false,
            handleSpearAttacks: () => false,
            buildFlailHitList: () => [],
            buildHitList(_hitList, _attacker, _defender, _allAdjacent) { /* stub */ },
            abortAttack: () => false,
            attack: () => false,
            playerRecoversFromAttacking() { /* stub */ },

            randValidDirectionFrom: () => 0,
            moveMonster(_monst, _dx, _dy) { /* stub */ },
            getQualifyingPathLocNear(target) { return { ...target }; },

            keyInPackFor: () => null,
            useKeyAt() { /* stub */ },
            pickUpItemAt(_loc) { /* stub */ },
            checkForMissingKeys() { /* stub */ },

            freeCaptive() { /* stub */ },

            promoteTile() { /* stub */ },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            discoverCell(x, y) {
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            },
            spawnDungeonFeature() { /* stub */ },
            dungeonFeatureCatalog,

            useStairs(direction) {
                useStairsFn(direction, buildTravelExploreContext());
            },

            playerTurnEnded() {
                doPlayerTurnEnded();
            },
            recordKeystroke() { /* stub — recordings not wired */ },
            cancelKeystroke() { /* stub */ },
            confirm: () => true,

            message(_msg, _flags) { /* stub */ },
            messageWithColor(_msg, _color, _flags) { /* stub */ },
            combatMessage(_msg, _color) { /* stub */ },
            backgroundMessageColor: Colors.backgroundMessageColor,

            randPercent: randPercent,
            randRange,

            vomit() { /* stub */ },

            // -- PlayerRunContext extensions --
            isPosInMap,
            posEq(a: Pos, b: Pos) { return a.x === b.x && a.y === b.y; },
            updateFlavorText() { /* stub */ },

            // -- isDisturbed --
            isDisturbed(x: number, y: number) {
                // Simplified: check adjacent cells for monsters
                for (let i = 0; i < 8; i++) {
                    const nx = x + nbDirs[i][0];
                    const ny = y + nbDirs[i][1];
                    if (!coordinatesAreInMap(nx, ny)) continue;
                    if (pmap[nx][ny].flags & TileFlag.HAS_ITEM) return true;
                    const monst = monsterAtLocFn({ x: nx, y: ny });
                    if (monst && monst !== player && (pmap[nx][ny].flags & TileFlag.VISIBLE)) return true;
                }
                return false;
            },
        } satisfies PlayerMoveContext & PlayerRunContext;
    }

    /**
     * Build the MiscHelpersContext for autoRest and manualSearch.
     */
    function buildMiscHelpersContext(): MiscHelpersContext {
        return {
            player,
            rogue: {
                depthLevel: rogue.depthLevel,
                wisdomBonus: rogue.wisdomBonus,
                awarenessBonus: 0,
                justRested: rogue.justRested,
                justSearched: rogue.justSearched,
                automationActive: rogue.automationActive,
                disturbed: rogue.disturbed,
                yendorWarden: rogue.yendorWarden,
                weapon: rogue.weapon,
                armor: rogue.armor,
                ringLeft: rogue.ringLeft,
                ringRight: rogue.ringRight,
                upLoc: rogue.upLoc,
                downLoc: rogue.downLoc,
                monsterSpawnFuse: rogue.monsterSpawnFuse,
            },
            monsters,
            levels,
            pmap,
            packItems,

            DCOLS,
            DROWS,
            FP_FACTOR: Number(FP_FACTOR),
            TURNS_FOR_FULL_REGEN: 300,
            deepestLevel: gameConst.deepestLevel,
            INVALID_POS,

            randClumpedRange,
            rand_percent: randPercent,
            max: Math.max,
            clamp,
            ringWisdomMultiplier: () => 1,
            charmRechargeDelay: () => 0,

            itemName: () => "item",
            identify(item) { identify(item, gameConst); },
            updateIdentifiableItems() { /* stub */ },
            numberOfMatchingPackItems(category) {
                let count = 0;
                for (const item of packItems) {
                    if (item.category & category) count++;
                }
                return count;
            },

            message(_msg, _flags) { /* stub */ },
            messageWithColor(_msg, _color, _flags) { /* stub */ },

            monsterAvoids: () => false,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterName: () => "monster",
            messageColorFromVictim: () => Colors.white,
            inflictDamage() { return false; /* stub */ },
            killCreature() { /* stub */ },
            demoteMonsterFromLeadership() { /* stub */ },
            restoreMonster() { /* stub */ },
            removeCreature() { /* stub */ },
            prependCreature() { /* stub */ },
            avoidedFlagsForMonster: () => 0,
            getQualifyingPathLocNear(loc) { return { ...loc }; },

            posNeighborInDirection: posNeighborInDirection,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            pmapAt,
            terrainFlags: terrainFlagsAt,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            search(_strength) { /* stub — search not yet fully wired */ },

            recordKeystroke() { /* stub */ },
            playerTurnEnded() {
                doPlayerTurnEnded();
            },
            pauseAnimation(_frames, _behavior) {
                return browserConsole.pauseForMilliseconds(0, { interruptForMouseMove: false });
            },

            ringTable: [],
            displayLevel: displayLevelFn,
            updateMinersLightRadius() { /* stub */ },
            itemMessageColor: Colors.itemMessageColor,
            red: Colors.red,
            REST_KEY: String.fromCharCode(REST_KEY),
            SEARCH_KEY: String.fromCharCode(SEARCH_KEY),
            PAUSE_BEHAVIOR_DEFAULT: 0,
        } satisfies MiscHelpersContext;
    }

    // =========================================================================
    // buildTurnProcessingContext — Step 3d: Turn processing pipeline
    // =========================================================================

    /**
     * Build the TurnProcessingContext for playerTurnEnded.
     * This is the central turn-processing pipeline that handles:
     * - Monster AI turns
     * - Environment updates (gas, fire, terrain promotion)
     * - Status effect ticking
     * - Item recharging
     * - Scent/FOV updates
     */
    function buildTurnProcessingContext(): TurnProcessingContext {
        function pmapAt(loc: Pos): Pcell {
            return pmap[loc.x][loc.y];
        }

        function playerCanSee(x: number, y: number): boolean {
            return !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE);
        }

        function playerCanDirectlySee(x: number, y: number): boolean {
            return !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE);
        }

        function monsterAtLoc(loc: Pos): Creature | null {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            for (const m of monsters) {
                if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
            }
            return null;
        }

        return {
            player,
            rogue: rogue as unknown as TurnProcessingContext["rogue"],
            monsters,
            dormantMonsters,
            pmap,
            levels,
            gameConst,
            scentMap: scentMap ?? allocGrid(),
            safetyMap: safetyMap ?? allocGrid(),
            allySafetyMap: allySafetyMap ?? allocGrid(),
            packItems,
            floorItems,
            tileCatalog,
            dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as TurnProcessingContext["dungeonFeatureCatalog"],

            DCOLS, DROWS, FP_FACTOR,

            // -- Map helpers -------------------------------------------------
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: (pos, flags) => cellHasTMFlag(pmap, pos, flags),
            terrainFlags: (pos) => terrainFlags(pmap, pos),
            discoveredTerrainFlagsAtLoc: discoveredTerrainFlagsAtLocFn,
            coordinatesAreInMap,
            pmapAt,

            // -- Monster helpers ---------------------------------------------
            canSeeMonster(monst) {
                return !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE) ||
                    !!(monst.bookkeepingFlags & 0 /* MB_TELEPATHICALLY_REVEALED — simplified */);
            },
            canDirectlySeeMonster(monst) {
                return !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE);
            },
            monsterRevealed(monst) {
                return !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE);
            },
            monsterName(buf, _monst, _includeArticle) {
                buf[0] = "monster"; // simplified — full monsterName needs item-naming context
            },
            monsterAtLoc,
            monstersAreEnemies(_monst1, _monst2) {
                return true; // simplified
            },
            monsterAvoids(_monst, _p) {
                return false; // simplified
            },
            monsterIsInClass(_monst, _monsterClass) {
                return false; // simplified
            },
            isVowelish(word) {
                return "aeiouAEIOU".includes(word[0] ?? "");
            },
            monstersTurn(monst) {
                // Stub — full monstersTurn needs MonstersTurnContext with ~30 methods
                // For now, just tick movement speed
                monst.ticksUntilTurn = monst.movementSpeed;
            },
            decrementMonsterStatus(_monst) {
                // Stub — full decrementMonsterStatus needs MonsterStateContext
                return false; // monster survived
            },
            removeCreature(list, monst) {
                const idx = list.indexOf(monst);
                if (idx >= 0) { list.splice(idx, 1); return true; }
                return false;
            },
            prependCreature(list, monst) {
                list.unshift(monst);
            },

            // -- Item helpers ------------------------------------------------
            itemName(_theItem, buf, _includeDetails, _includeArticle, _maxLen) {
                buf[0] = "item"; // simplified
            },
            numberOfMatchingPackItems(category, _kind, _flags, _checkCarried) {
                let count = 0;
                for (const item of packItems) {
                    if (item.category & category) count++;
                }
                return count;
            },

            // -- Combat helpers ----------------------------------------------
            inflictDamage(_attacker, _defender, _damage, _flashColor, _showDamage) {
                return false; // stub — full inflictDamage needs CombatDamageContext
            },
            killCreature(_monst, _administrativeDeath) {
                // stub — full killCreature needs CombatDamageContext
            },
            combatMessage(_msg, _color) {
                // stub
            },
            displayCombatText() {
                // stub
            },
            messageColorFromVictim(_monst) {
                return Colors.white;
            },
            addPoison(_monst, _totalDamage, _concentrationIncrement) {
                // stub
            },
            flashMonster(_monst, _color, _strength) {
                // stub
            },

            // -- UI ----------------------------------------------------------
            message(_msg, _flags) { /* stub */ },
            messageWithColor(_msg, _color, _flags) { /* stub */ },
            flavorMessage(_msg) { /* stub */ },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            displayLevel() {
                displayLevelFn();
                commitDraws();
            },
            displayAnnotation() { /* stub — recordings not wired */ },
            refreshSideBar(_x, _y, _forceFullUpdate) { /* stub */ },
            gameOver(_message, _showScore) {
                rogue.gameHasEnded = true;
            },
            confirm(_message, _isDangerous) {
                return true; // auto-confirm for now
            },
            flashMessage(_msg, _x, _y, _duration, _foreColor, _backColor) { /* stub */ },
            recordKeystroke(_key, _shift, _alt) { /* stub */ },
            confirmMessages() { /* stub */ },
            pauseAnimation(_duration, _behavior) {
                return false; // not interrupted
            },

            // -- Colors ------------------------------------------------------
            goodMessageColor: Colors.goodMessageColor,
            badMessageColor: Colors.badMessageColor,
            advancementMessageColor: Colors.advancementMessageColor,
            itemMessageColor: Colors.itemMessageColor,
            orange: Colors.orange,
            green: Colors.green,
            red: Colors.red,
            yellow: Colors.yellow,
            darkRed: Colors.darkRed,
            darkGreen: Colors.darkGreen,

            // -- Environment / vision ----------------------------------------
            updateEnvironment() {
                // Stub — full updateEnvironment needs EnvironmentContext
            },
            updateVision(refreshDisplay) {
                updateVisionFn(refreshDisplay);
            },
            updateMapToShore() {
                // Stub — uses Dijkstra, complex context
            },
            updateSafetyMap() {
                // Stub — needs SafetyMapsContext
            },
            refreshWaypoint(_index) {
                // Stub — needs ArchitectContext
            },
            analyzeMap(_updateChokemap) {
                // Stub — needs AnalysisContext
            },
            removeDeadMonsters() {
                // Simple inline: remove monsters marked as dying
                for (let i = monsters.length - 1; i >= 0; i--) {
                    if (monsters[i].bookkeepingFlags & 0x4000 /* MB_IS_DYING */) {
                        monsters.splice(i, 1);
                    }
                }
            },
            shuffleTerrainColors(_duration, _b) {
                // Stub — already available but context-heavy
            },
            resetDFMessageEligibility() {
                resetDFMessageEligibility(dungeonFeatureCatalog as unknown as DungeonFeature[]);
            },
            RNGCheck() { /* stub — recordings */ },
            animateFlares(_flares, _count) { /* stub */ },

            // -- Scent / FOV -------------------------------------------------
            addScentToCell(_x, _y, _distance) {
                // Stub — needs scent map logic
            },
            getFOVMask(grid, cx, cy, radius, blockFlags, blockTMFlags, ignoreWalls) {
                const fovCtx: FOVContext = {
                    cellHasTerrainFlag: cellHasTerrainFlagAt,
                    getCellFlags: (x, y) => pmap[x]?.[y]?.flags ?? 0,
                };
                getFOVMaskFn(grid, cx, cy, radius, blockFlags, blockTMFlags, ignoreWalls, fovCtx);
            },
            zeroOutGrid,
            discoverCell(_x, _y) {
                // Stub — marks cell as discovered
                if (coordinatesAreInMap(_x, _y)) {
                    pmap[_x][_y].flags |= TileFlag.DISCOVERED;
                }
            },
            discover(_x, _y) {
                if (coordinatesAreInMap(_x, _y)) {
                    pmap[_x][_y].flags |= TileFlag.DISCOVERED;
                }
            },
            storeMemories(_x, _y) {
                // Stub — stores terrain memory for visited cells
            },

            // -- Items / recharging ------------------------------------------
            rechargeItemsIncrementally(_multiplier) {
                // Stub — needs full item context
            },
            processIncrementalAutoID() {
                // Stub — needs full item context
            },

            // -- Tile effects ------------------------------------------------
            applyInstantTileEffectsToCreature(_monst) {
                // Stub — needs CreatureEffectsContext
            },
            applyGradualTileEffectsToCreature(_monst, _ticks) {
                // Stub — needs CreatureEffectsContext
            },
            monsterShouldFall(_monst) {
                return false; // stub
            },
            monstersFall() {
                // Stub — needs CreatureEffectsContext
            },
            decrementPlayerStatus() {
                // Stub — needs CreatureEffectsContext
            },
            playerFalls() {
                // Stub — needs CreatureEffectsContext
            },
            handleHealthAlerts() {
                // Stub — not yet ported
            },
            updateScent() {
                // Stub — not yet ported as standalone function
                rogue.scentTurnNumber++;
            },
            currentStealthRange() {
                return 0; // simplified
            },

            // -- Movement / search -------------------------------------------
            search(_searchStrength) {
                return false; // stub
            },
            playerCanDirectlySee,
            playerCanSee,

            // -- Spawn -------------------------------------------------------
            spawnDungeonFeature(_x, _y, _feat, _isVolatile, _overrideProtection) {
                // Stub — needs full MachineContext for spawnDungeonFeature
            },

            // -- Constants ---------------------------------------------------
            nbDirs,

            // -- Math --------------------------------------------------------
            rand_range: randRange,
            rand_percent: randPercent,
            max: Math.max,
            min: Math.min,
        };
    }

    /**
     * Shared function to call the real playerTurnEnded with the full context.
     */
    function doPlayerTurnEnded(): void {
        playerTurnEndedFn(buildTurnProcessingContext());
        // Refresh display after turn processing
        displayLevelFn();
        commitDraws();
    }

    /**
     * Build the full InputContext for the main input dispatch system.
     * Many methods are stubs for systems not yet wired; they will be
     * filled in during Steps 3d-3f.
     */
    function buildInputContext(): InputContext {
        const targetingCtx = buildTargetingContext();

        return {
            rogue: rogue as unknown as InputRogueState,
            player,

            DEBUG: false,
            serverMode: false,
            hasGraphics: false,
            graphicsMode: 0,
            nonInteractivePlayback: false,
            D_WORMHOLING: false,
            D_SAFETY_VISION: false,
            D_SCENT_VISION: false,
            displayedMessage: messageState.displayedMessage,
            messagesUnconfirmed: messageState.messagesUnconfirmed,
            GAME_MODE_EASY: GameMode.Easy,

            // -- Coordinate helpers -----------------------------------------------
            posEq(a, b) { return a.x === b.x && a.y === b.y; },
            isPosInMap,
            mapToWindowX,
            mapToWindowY,
            windowToMap: windowToMapFn,
            windowToMapX: windowToMapXFromDisplay,
            distanceBetween(a, b) { return distanceBetween(a, b); },

            // -- Color helpers ----------------------------------------------------
            encodeMessageColor,

            // -- Text / display ---------------------------------------------------
            strLenWithoutEscapes,
            printString(str, x, y, foreColor, backColor, dbuf) {
                printStringFn(str, x, y, foreColor, backColor, dbuf ?? displayBuffer);
            },
            plotCharWithColor(inputChar, pos, foreColor, backColor) {
                plotCharWithColor(inputChar, pos, foreColor, backColor, displayBuffer);
            },

            // -- Messages ---------------------------------------------------------
            message(_msg, _flags) { /* stub — full message system is Step 3f */ },
            messageWithColor(_msg, _color, _flags) { /* stub */ },
            temporaryMessage(_msg, _flags) { /* stub */ },
            confirmMessages() { /* stub */ },
            updateMessageDisplay() { /* stub */ },

            // -- Display buffers --------------------------------------------------
            commitDraws,
            saveDisplayBuffer() { return saveDisplayBufferFn(displayBuffer); },
            restoreDisplayBuffer(saved) {
                restoreDisplayBufferFn(displayBuffer, saved);
                commitDraws();
            },
            overlayDisplayBuffer(dbuf) { applyOverlay(dbuf); },
            clearDisplayBuffer(dbuf) { clearDisplayBuffer(dbuf); },
            createScreenDisplayBuffer,

            // -- Buttons ----------------------------------------------------------
            initializeButton,
            initializeButtonState(state, buttons, count, winX, winY, winWidth, winHeight) {
                const newState = initializeButtonState(buttons, count, winX, winY, winWidth, winHeight);
                Object.assign(state, newState);
            },
            async buttonInputLoop(buttons, count, winX, winY, winWidth, winHeight, _event) {
                const result = await buttonInputLoopFn(buttons, count, winX, winY, winWidth, winHeight, buttonCtx);
                return result.chosenButton;
            },

            // -- Text box ---------------------------------------------------------
            printTextBox(text, x, y, width, foreColor, backColor, buttons, buttonCount) {
                return printTextBoxFn(text, x, y, width, foreColor, backColor, inventoryCtxForTextBox, buttons, buttonCount);
            },
            rectangularShading(x, y, width, height, color, opacity, dbuf) {
                rectangularShadingFn(x, y, width, height, color, opacity, dbuf, inventoryCtxPartial);
            },

            // -- Events / timing --------------------------------------------------
            pauseForMilliseconds(milliseconds, behavior) {
                return browserConsole.pauseForMilliseconds(milliseconds, behavior);
            },
            nextKeyOrMouseEvent(textInput, colorsDance) {
                return browserConsole.nextKeyOrMouseEvent(textInput, colorsDance);
            },
            locIsInWindow,

            // -- Display ----------------------------------------------------------
            displayLevel: displayLevelFn,
            refreshSideBar(_x, _y, _justClearing) { /* stub — Step 3f */ },
            displayInventory(_categoryMask, _titleFlags, _focusFlags, _includeDetails, _includeButtons) { /* stub */ },
            displayMessageArchive() { /* stub */ },
            printHelpScreen() { /* stub */ },
            displayFeatsScreen() { /* stub */ },
            printDiscoveriesScreen() { /* stub */ },
            flashTemporaryAlert(_msg, _time) { /* stub */ },
            displayMonsterFlashes(_flashAll) {
                rogue.creaturesWillFlashThisTurn = false;
            },
            setGraphicsMode(_mode) { return 0; },

            // -- Game actions -----------------------------------------------------
            playerMoves(direction) {
                const moveCtx = buildPlayerMoveContext();
                playerMovesFn(direction, moveCtx);
                // Sync disturbed state back
                rogue.disturbed = moveCtx.rogue.disturbed;
            },
            playerRuns(direction) {
                const runCtx = buildPlayerMoveContext();
                playerRunsFn(direction, runCtx);
                rogue.disturbed = runCtx.rogue.disturbed;
            },
            playerTurnEnded() {
                doPlayerTurnEnded();
            },
            autoRest() {
                const miscCtx = buildMiscHelpersContext();
                autoRestFn(miscCtx);
                // Sync mutable state back
                rogue.disturbed = miscCtx.rogue.disturbed;
                rogue.automationActive = miscCtx.rogue.automationActive;
                rogue.justRested = miscCtx.rogue.justRested;
            },
            manualSearch() {
                const miscCtx = buildMiscHelpersContext();
                manualSearchFn(miscCtx);
                rogue.justSearched = miscCtx.rogue.justSearched;
            },
            travel(loc, autoConfirm) {
                const travelCtx = buildTravelExploreContext();
                travelFn(loc, autoConfirm, travelCtx);
                rogue.disturbed = travelCtx.rogue.disturbed;
            },
            travelRoute(path, steps) {
                const travelCtx = buildTravelExploreContext();
                travelRouteFn(path, steps, travelCtx);
                rogue.disturbed = travelCtx.rogue.disturbed;
            },
            equip(_item) { /* stub — inventory UI not yet wired */ },
            unequip(_item) { /* stub */ },
            drop(_item) { /* stub */ },
            apply(_item) { /* stub */ },
            throwCommand(_item, _confirmed) { /* stub */ },
            relabel(_item) { /* stub */ },
            call(_item) { /* stub */ },
            swapLastEquipment() { /* stub */ },
            enableEasyMode() { /* stub */ },
            saveGame() { /* stub */ },
            gameOver(_message, _showHighScores) {
                rogue.gameHasEnded = true;
            },
            printSeed() {
                // Simple seed display
            },
            showCursor() {
                showCursorFn(buildTargetingContext());
            },
            hideCursor() {
                hideCursorFn(buildTargetingContext());
            },
            exploreKey(controlKey) {
                const travelCtx = buildTravelExploreContext();
                exploreFn(controlKey ? 1 : 5, travelCtx);
                rogue.disturbed = travelCtx.rogue.disturbed;
                rogue.automationActive = travelCtx.rogue.automationActive;
            },
            autoPlayLevel(controlKey) {
                const travelCtx = buildTravelExploreContext();
                autoPlayLevelFn(controlKey, travelCtx);
                rogue.autoPlayingLevel = travelCtx.rogue.autoPlayingLevel;
            },
            useStairs(delta) {
                const travelCtx = buildTravelExploreContext();
                useStairsFn(delta, travelCtx);
            },
            takeScreenshot() { return false; },
            itemIsCarried(item) {
                return packItems.includes(item);
            },
            dialogCreateItemOrMonster() { /* stub */ },

            // -- Sidebar focus ----------------------------------------------------
            monsterAtLoc: monsterAtLocFn,
            itemAtLoc(loc) {
                for (const item of floorItems) {
                    if (item.loc.x === loc.x && item.loc.y === loc.y) return item;
                }
                return null;
            },
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            cellHasTMFlag: cellHasTMFlagAt,
            printMonsterDetails() { /* stub */ },
            printFloorItemDetails() { /* stub */ },
            printLocationDescription() { /* stub */ },

            // -- Targeting / cursor -----------------------------------------------
            moveCursor(
                _targetConfirmed, canceled, _tabKey, _cursorLoc, theEvent,
                _state, _doButtons, _cursorMode, _restingAllowed,
            ) {
                // Simplified moveCursor stub: read next event from queue and
                // dispatch. The full cursor/path system is not yet wired.
                commitDraws();
                const ev = browserConsole.nextKeyOrMouseEvent(false, false);
                if (ev.eventType === EventType.Keystroke && ev.param1 !== 0) {
                    theEvent.value = ev;
                    return true; // doEvent = true → dispatch the event
                }
                if (ev.eventType === EventType.MouseUp || ev.eventType === EventType.RightMouseUp) {
                    theEvent.value = ev;
                    return true;
                }
                // No meaningful event — signal canceled to break the inner loop
                canceled.value = true;
                return false;
            },
            nextTargetAfter() { return false; },
            hilitePath(path, steps, unhilite) {
                hilitePatchFn(path, steps, unhilite, targetingCtx);
            },
            clearCursorPath() {
                clearCursorPathFn(targetingCtx);
            },
            hiliteCell(x, y, color, opacity, flash) {
                hiliteCellFn(x, y, color, opacity, flash, targetingCtx);
            },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },

            // -- Pathing ----------------------------------------------------------
            allocGrid,
            freeGrid,
            fillGrid,
            dijkstraScan: dijkstraScanFn,
            populateCreatureCostMap: populateCreatureCostMapWrapped,
            getPlayerPathOnMap(path, playerPathingMap, origin) {
                return getPlayerPathOnMapFn(path, playerPathingMap, origin, targetingCtx);
            },
            processSnapMap(cursorSnapMap) {
                processSnapMapFn(cursorSnapMap, targetingCtx);
            },
            getClosestValidLocationOnMap: getClosestValidLocationOnMapFn,
            diagonalBlocked(fromX, fromY, toX, toY, limitToPlayerKnowledge) {
                return diagonalBlockedFn(fromX, fromY, toX, toY, (loc) => {
                    if (limitToPlayerKnowledge) {
                        return discoveredTerrainFlagsAtLocFn(loc);
                    }
                    return terrainFlagsAt(loc);
                });
            },
            pmapFlagsAt(loc) { return pmap[loc.x][loc.y].flags; },
            terrainFlags: terrainFlagsAt,
            terrainMechFlags: terrainMechFlagsAt,

            // -- Recordings -------------------------------------------------------
            recordKeystroke() { /* stub */ },
            recallEvent() {
                return { eventType: EventType.EventError, param1: 0, param2: 0, controlKey: false, shiftKey: false };
            },
            executePlaybackInput() { return false; },

            // -- Recording file access --------------------------------------------
            proposeOrConfirmLocation(loc, failMsg) {
                const travelCtx = buildTravelExploreContext();
                return proposeOrConfirmLocationFn(loc, failMsg, travelCtx);
            },
            characterForbiddenInFilename(char) {
                return "/\\:*?\"<>|".includes(char);
            },

            // -- Safety map (debug) -----------------------------------------------
            safetyMap: safetyMap,
            displayGrid() { /* stub */ },
            displayLoops() { /* stub */ },
            displayChokeMap() { /* stub */ },
            displayMachines() { /* stub */ },
            displayWaypoints() { /* stub */ },

            // -- Constants --------------------------------------------------------
            AUTOTARGET_MODE_EXPLORE: 0,
            TM_LIST_IN_SIDEBAR: TerrainMechFlag.TM_LIST_IN_SIDEBAR,
            TM_PROMOTES_ON_PLAYER_ENTRY: TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY,
            T_OBSTRUCTS_PASSABILITY: TerrainFlag.T_OBSTRUCTS_PASSABILITY,
            HAS_MONSTER: TileFlag.HAS_MONSTER,
            MONST_ATTACKABLE_THRU_WALLS: MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS,
            STATUS_HALLUCINATING: StatusEffect.Hallucinating,
            STATUS_TELEPATHIC: StatusEffect.Telepathic,
            STATUS_SEARCHING: StatusEffect.Searching,
            ALL_ITEMS: 0xFFFF,
            REQUIRE_ACKNOWLEDGMENT: 0x01,
            nbDirs: nbDirs as unknown as number[][],
        };
    }

    // -- MenuContext -----------------------------------------------------------
    const menuCtx: MenuContext = {
        // -- State ------------------------------------------------------------
        rogue,
        gameConst,
        gameVariant,
        mainMenuTitle: BROGUE_TITLE_ART,

        isApplicationActive: () => true,
        serverMode: false,
        nonInteractivePlayback: false,
        wizardMode: false,
        previousGameSeed,
        randomNumbersGenerated: 0,
        currentFilePath,

        setRandomNumbersGenerated(n: number) {
            menuCtx.randomNumbersGenerated = n;
        },
        setCurrentFilePath(path: string) {
            currentFilePath = path;
            menuCtx.currentFilePath = path;
        },
        setGameVariant(variant: GameVariant) {
            gameVariant = variant;
            menuCtx.gameVariant = variant;
            // TODO: switch gameConst and catalogs based on variant
        },

        // -- RNG --------------------------------------------------------------
        seedRandomGenerator,
        rand_range: randRange,

        // -- Color manipulation -----------------------------------------------
        applyColorAverage,

        // -- Text -------------------------------------------------------------
        strLenWithoutEscapes,
        encodeMessageColor,

        // -- Rendering --------------------------------------------------------
        plotCharWithColor(
            inputChar: DisplayGlyph,
            loc: WindowPos,
            foreColor: Readonly<Color>,
            backColor: Readonly<Color>,
            dbuf: ScreenDisplayBuffer,
        ): boolean {
            return plotCharWithColor(inputChar, loc, foreColor, backColor, dbuf);
        },
        locIsInWindow,
        createScreenDisplayBuffer,
        clearDisplayBuffer(dbuf: ScreenDisplayBuffer) {
            clearDisplayBuffer(dbuf);
        },
        overlayDisplayBuffer(dbuf: Readonly<ScreenDisplayBuffer>) {
            applyOverlay(dbuf);
        },
        saveDisplayBuffer(): SavedDisplayBuffer {
            return saveDisplayBufferFn(displayBuffer);
        },
        restoreDisplayBuffer(saved: Readonly<SavedDisplayBuffer>) {
            restoreDisplayBufferFn(displayBuffer, saved);
            commitDraws();
        },
        blackOutScreen(dbuf: ScreenDisplayBuffer) {
            blackOutScreen(dbuf);
        },
        commitDraws,

        printString(
            text: string, x: number, y: number,
            foreColor: Readonly<Color>, backColor: Readonly<Color>,
            dbuf: ScreenDisplayBuffer | null,
        ): void {
            printStringFn(text, x, y, foreColor, backColor, dbuf ?? displayBuffer);
        },

        // -- Buttons ----------------------------------------------------------
        initializeButton,
        setButtonText(button: BrogueButton, textWithHotkey: string, textWithoutHotkey: string) {
            setButtonTextFn(button, textWithHotkey, textWithoutHotkey, buttonCtx);
        },
        initializeButtonState(
            buttons: BrogueButton[], buttonCount: number,
            winX: number, winY: number, winWidth: number, winHeight: number,
        ): ButtonState {
            return initializeButtonState(buttons, buttonCount, winX, winY, winWidth, winHeight);
        },
        drawButton(button: BrogueButton, highlight: ButtonDrawState, dbuf: ScreenDisplayBuffer | null) {
            drawButtonFn(button, highlight, dbuf, buttonCtx);
        },
        drawButtonsInState(state: ButtonState, dbuf: ScreenDisplayBuffer) {
            drawButtonsInStateFn(state, dbuf, buttonCtx);
        },
        async processButtonInput(state: ButtonState, event: RogueEvent) {
            return processButtonInputFn(state, event, buttonCtx);
        },
        async buttonInputLoop(
            buttons: BrogueButton[], buttonCount: number,
            winX: number, winY: number, winWidth: number, winHeight: number,
        ) {
            return buttonInputLoopFn(
                buttons, buttonCount, winX, winY, winWidth, winHeight, buttonCtx,
            );
        },

        rectangularShading(
            x: number, y: number, width: number, height: number,
            backColor: Readonly<Color>, opacity: number,
            dbuf: ScreenDisplayBuffer,
        ) {
            rectangularShadingFn(x, y, width, height, backColor, opacity, dbuf, inventoryCtxPartial);
        },

        async printTextBox(
            textBuf: string, x: number, y: number, width: number,
            foreColor: Readonly<Color>, backColor: Readonly<Color>,
            buttons?: BrogueButton[], buttonCount?: number,
        ) {
            return printTextBoxFn(
                textBuf, x, y, width, foreColor, backColor,
                inventoryCtxForTextBox,
                buttons, buttonCount,
            );
        },

        // -- Events / timing --------------------------------------------------
        async nextBrogueEvent(_textInput: boolean, _colorsDance: boolean, _realInputEvenInPlayback: boolean) {
            commitDraws();
            return browserConsole.waitForEvent();
        },
        async pauseBrogue(milliseconds: number, behavior?: PauseBehavior) {
            commitDraws();
            // Yield to the browser event loop for the specified duration
            await asyncPause(milliseconds);
            // Check if an input event arrived during the pause.
            // pauseForMilliseconds peeks at the queue and pushes the event
            // back if one was found, returning true (interrupted).
            return browserConsole.pauseForMilliseconds(
                0, // already paused; just check the queue
                behavior ?? { interruptForMouseMove: false },
            );
        },

        // -- Info screens / prompts -------------------------------------------
        async getInputTextString(
            _prompt: string, _maxLength: number, _defaultEntry: string,
            _promptSuffix: string, _textEntryType: TextEntryType, _useDialogBox: boolean,
        ) {
            // TODO: Wire to io-input getInputTextString with full InputContext
            return null;
        },
        async printHighScores(_hiliteMostRecent: boolean) {
            // TODO: Wire to io-screens printHighScores
        },
        async confirm(_prompt: string, _alsoDuringPlayback: boolean) {
            // TODO: Wire to io-input confirm
            return false;
        },
        async waitForKeystrokeOrMouseClick() {
            commitDraws();
            await browserConsole.waitForEvent();
        },
        message(_msg: string, _flags: number): void {
            // TODO: Wire to io-messages message with full MessageContext
        },

        // -- Sidebar helper ---------------------------------------------------
        smoothHiliteGradient,

        // -- Game lifecycle ---------------------------------------------------
        initializeRogue(seed: bigint): void {
            const gameInitCtx = buildGameInitContext();
            initializeRogueFn(gameInitCtx, seed);
        },
        startLevel(depth: number, stairDirection: number): void {
            const levelCtx = buildLevelContext();
            startLevelFn(levelCtx, depth, stairDirection);
            // Render the newly generated level
            displayLevelFn();
            commitDraws();
        },
        async mainInputLoop(): Promise<void> {
            // Step 3c: Async input loop that dispatches events through
            // the full InputContext via executeKeystroke / executeMouseClick.
            //
            // The outer loop is async (await browserConsole.waitForEvent())
            // because the browser can't block. Each dispatched keystroke
            // calls synchronous game functions (playerMoves, autoRest, etc.)
            // which update state and re-render.
            const inputCtx = buildInputContext();

            while (!rogue.gameHasEnded) {
                displayLevelFn();
                commitDraws();

                const event = await browserConsole.waitForEvent();

                if (event.eventType === EventType.Keystroke) {
                    executeKeystrokeFn(inputCtx, event.param1, event.controlKey, event.shiftKey);
                } else if (
                    event.eventType === EventType.MouseUp ||
                    event.eventType === EventType.RightMouseUp
                ) {
                    executeMouseClickFn(inputCtx, event);
                }
            }
        },
        freeEverything(): void {
            const cleanupCtx = buildCleanupContext();
            freeEverythingFn(cleanupCtx);
        },
        initializeGameVariant(): void {
            const gameInitCtx = buildGameInitContext();
            initializeGameVariantFn(gameInitCtx);
        },
        initializeLaunchArguments(): void {
            // No-op for browser
        },

        // -- Recording stubs --------------------------------------------------
        flushBufferToFile(): void { /* no-op */ },
        saveGameNoPrompt(): void { /* no-op */ },
        saveRecordingNoPrompt(): string { return ""; },
        getAvailableFilePath(prefix: string, suffix: string): string {
            return prefix + suffix;
        },

        // -- Playback stubs ---------------------------------------------------
        executeEvent(_event: RogueEvent): void { /* no-op */ },
        displayAnnotation(): void { /* no-op */ },
        pausePlayback(): void { /* no-op */ },

        // -- Platform file ops ------------------------------------------------
        listFiles(): FileEntry[] { return []; },
        loadRunHistory(): RogueRun[] { return []; },
        saveResetRun(): void { /* no-op */ },
        openFile(_path: string): boolean { return false; },

        // -- Color constants --------------------------------------------------
        black: Colors.black,
        white: Colors.white,
        yellow: Colors.yellow,
        veryDarkGray: Colors.veryDarkGray,
        flameSourceColor: Colors.flameSourceColor,
        flameSourceColorSecondary: Colors.flameSourceColorSecondary,
        flameTitleColor: Colors.flameTitleColor,
        titleButtonColor: Colors.titleButtonColor,
        itemMessageColor: Colors.itemMessageColor,
        interfaceBoxColor: Colors.interfaceBoxColor,
        goodMessageColor: Colors.goodMessageColor,

        // -- Glyph constants --------------------------------------------------
        G_LEFT_TRIANGLE: DisplayGlyph.G_LEFT_TRIANGLE,
        G_UP_ARROW: DisplayGlyph.G_UP_ARROW,
        G_DOWN_ARROW: DisplayGlyph.G_DOWN_ARROW
    };

    return { menuCtx, displayBuffer, commitDraws };
}
