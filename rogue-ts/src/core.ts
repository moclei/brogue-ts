/*
 *  core.ts — Shared mutable game state for BrogueCE port v2
 *  Port V2 — rogue-ts
 *
 *  All domain context builders (turn.ts, combat.ts, items.ts, etc.) import
 *  from this module. State variables are module-level lets; domain files
 *  destructure them via getGameState() each time they build a context.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { createCreature } from "./monsters/monster-creation.js";
import { monsterCatalog as monsterCatalogData } from "./globals/monster-catalog.js";
import { scrollTable, potionTable } from "./globals/item-catalog.js";
import { BROGUE_GAME_CONSTANTS } from "./game/game-constants.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS, ROWS } from "./types/constants.js";
import { TileType, GameMode, NGCommand, DisplayGlyph, GameVariant } from "./types/enums.js";
import { INVALID_POS } from "./types/types.js";
import { MonsterBookkeepingFlag } from "./types/flags.js";
import type {
    Creature, PlayerCharacter, Pcell, Tcell, Item, LevelData,
    GameConstants, LightSource, CreatureType, ItemTable,
} from "./types/types.js";

// =============================================================================
// Private helpers — state factories
// =============================================================================

function makeDefaultLight(): LightSource {
    return {
        lightColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        radialFadeToPercent: 0,
        passThroughCreatures: false,
    };
}

function createRogueDefaults(): PlayerCharacter {
    return {
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
        playbackOmniscience: false,
        recording: false,
        depthLevel: 1,
        deepestLevel: 1,
        creaturesWillFlashThisTurn: false,
        seed: 0n,
        patchVersion: 1,
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
        monsterSpawnFuse: 0,
        weapon: null,
        armor: null,
        ringLeft: null,
        ringRight: null,
        swappedIn: null,
        swappedOut: null,
        flares: [],
        yendorWarden: null,
        minersLight: makeDefaultLight(),
        minersLightRadius: 0n,
        ticksTillUpdateEnvironment: 100,
        scentTurnNumber: 1000,
        playerTurnNumber: 0,
        absoluteTurnNumber: 0,
        xpxpThisTurn: 0,
        stealthRange: 0,
        previousPoisonPercent: 0,
        upLoc: { x: 0, y: 0 },
        downLoc: { x: 0, y: 0 },
        cursorLoc: { ...INVALID_POS },
        lastTarget: null,
        lastItemThrown: null,
        rewardRoomsGenerated: 0,
        machineNumber: 0,
        sidebarLocationList: Array.from({ length: ROWS * 2 }, () => ({ x: -1, y: -1 })),
        mapToShore: null,
        mapToSafeTerrain: null,
        clairvoyance: 0,
        stealthBonus: 0,
        regenerationBonus: 0,
        lightMultiplier: 1,
        awarenessBonus: 0,
        transference: 0,
        wisdomBonus: 0,
        reaping: 0,
        foodSpawned: 0n,
        meteredItems: [],
        featRecord: [],
        disturbed: false,
        autoPlayingLevel: false,
        automationActive: false,
        justRested: false,
        justSearched: false,
        inWater: false,
        heardCombatThisTurn: false,
        receivedLevitationWarning: false,
        updatedSafetyMapThisTurn: false,
        updatedAllySafetyMapThisTurn: false,
        updatedMapToSafeTerrainThisTurn: false,
        updatedMapToShoreThisTurn: false,
        staleLoopMap: false,
        alreadyFell: false,
        eligibleToUseStairs: false,
        cursorMode: false,
        cursorPathIntensity: 20,
        blockCombatText: false,
        wpCount: 0,
        wpRefreshTicker: 0,
        wpCoordinates: [],
        wpDistance: [],
        gameExitStatusCode: 0,
        playbackDelayPerTurn: 0,
        playbackDelayThisTurn: 0,
        howManyTurns: 0,
        currentTurnNumber: 0,
        howManyDepthChanges: 0,
        nextAnnotationTurn: 0,
        nextAnnotation: "",
        locationInAnnotationFile: 0,
        versionString: "",
    };
}

function createPmap(): Pcell[][] {
    const map: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        map[x] = [];
        for (let y = 0; y < DROWS; y++) {
            map[x][y] = {
                layers: new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.GRANITE),
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: {
                    character: 0 as DisplayGlyph,
                    foreColorComponents: [0, 0, 0],
                    backColorComponents: [0, 0, 0],
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
    return map;
}

function createTmap(): Tcell[][] {
    const map: Tcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        map[x] = [];
        for (let y = 0; y < DROWS; y++) {
            map[x][y] = {
                light: [0, 0, 0],
                oldLight: [0, 0, 0],
            };
        }
    }
    return map;
}

// =============================================================================
// Shared mutable state
// =============================================================================

let player: Creature = createCreature();
let rogue: PlayerCharacter = createRogueDefaults();
let pmap: Pcell[][] = createPmap();
let tmap: Tcell[][] = createTmap();
let monsters: Creature[] = [];
let dormantMonsters: Creature[] = [];
let packItems: Item[] = [];
let floorItems: Item[] = [];
let monsterItemsHopper: Item[] = [];
let levels: LevelData[] = [];
let gameConst: GameConstants = { ...BROGUE_GAME_CONSTANTS };
let gameVariant: GameVariant = GameVariant.Brogue;
let monsterCatalog: CreatureType[] = monsterCatalogData.map(m => ({ ...m }));
let mutableScrollTable: ItemTable[] = scrollTable.map(t => ({ ...t }));
let mutablePotionTable: ItemTable[] = potionTable.map(t => ({ ...t }));

/** Pending death info set by gameOver(); consumed by the async death screen in platform.ts. */
let pendingDeathMessage: string | null = null;

// =============================================================================
// Game lifecycle
// =============================================================================

/**
 * Reset all shared state to fresh-game defaults.
 *
 * Called at the start of every new game session. Does NOT do the full
 * initializeRogue() setup (catalog counts, variant init, RNG seed) —
 * that is the responsibility of the wiring layer's initializeRogue context.
 */
export function initGameState(): void {
    player = createCreature();
    rogue = createRogueDefaults();
    pmap = createPmap();
    tmap = createTmap();
    monsters = [];
    dormantMonsters = [];
    packItems = [];
    floorItems = [];
    monsterItemsHopper = [];
    levels = [];
    gameConst = { ...BROGUE_GAME_CONSTANTS };
    gameVariant = GameVariant.Brogue;
    monsterCatalog = monsterCatalogData.map(m => ({ ...m }));
    mutableScrollTable = scrollTable.map(t => ({ ...t }));
    mutablePotionTable = potionTable.map(t => ({ ...t }));
    pendingDeathMessage = null;
}

/**
 * Synchronous phase of game-over: set terminal flags and record cause of death.
 *
 * The async death screen (showing score, waiting for acknowledgement) is
 * handled separately in platform.ts after the main game loop exits.
 * This matches the C two-phase gameOver pattern from the first attempt.
 *
 * Guards against double-entry via MB_IS_DYING (matching C behaviour).
 */
export function gameOver(killedBy: string): void {
    if (player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) {
        return;
    }
    player.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
    rogue.autoPlayingLevel = false;
    rogue.gameInProgress = false;
    rogue.gameHasEnded = true;
    pendingDeathMessage = killedBy;
}

/** Return and clear the pending death message (consumed by the death screen). */
export function takePendingDeathMessage(): string | null {
    const msg = pendingDeathMessage;
    pendingDeathMessage = null;
    return msg;
}

// =============================================================================
// State accessor — called fresh by each domain context builder
// =============================================================================

/**
 * Return the current shared state snapshot.
 *
 * Domain context builders call this at the top of each build function so
 * they always see the latest state. Do NOT cache the result across turns.
 */
export function getGameState() {
    return {
        player,
        rogue,
        pmap,
        tmap,
        monsters,
        dormantMonsters,
        packItems,
        floorItems,
        monsterItemsHopper,
        levels,
        gameConst,
        gameVariant,
        monsterCatalog,
        mutableScrollTable,
        mutablePotionTable,
    };
}

// =============================================================================
// Setters for reassignable arrays
// =============================================================================

/** Replace the active monster list (used during level load/save). */
export function setMonsters(m: Creature[]): void { monsters = m; }

/** Replace the dormant monster list (used during level load/save). */
export function setDormantMonsters(m: Creature[]): void { dormantMonsters = m; }

/** Replace the level data array (grows as player descends). */
export function setLevels(l: LevelData[]): void { levels = l; }

/** Override game constants (used by initializeGameVariant). */
export function setGameConst(gc: GameConstants): void { gameConst = gc; }

/** Override game variant (used by main menu variant selection). */
export function setGameVariant(gv: GameVariant): void { gameVariant = gv; }
