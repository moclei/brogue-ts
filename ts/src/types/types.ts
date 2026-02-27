/*
 *  types.ts — Port of structs/typedefs from Rogue.h
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    DisplayGlyph, TileType, LightType, DungeonFeatureType, DungeonProfileType,
    MonsterType, BoltType, CreatureState, CreatureMode,
    DungeonLayer, NGCommand, GameMode, EventType, BoltEffect,
} from "./enums.js";

// ===== Fixed-point type =====

/** Fixed-point number. 64-bit signed integer with 16-bit fractional part. */
export type Fixpt = bigint;

// ===== Pos — dungeon coordinate =====

export interface Pos {
    x: number;
    y: number;
}

export const INVALID_POS: Pos = { x: -1, y: -1 };

// ===== WindowPos — window coordinate =====

export interface WindowPos {
    windowX: number;
    windowY: number;
}

// ===== RandomRange =====

export interface RandomRange {
    lowerBound: number;
    upperBound: number;
    clumpFactor: number;
}

// ===== Color =====

export interface Color {
    red: number;
    green: number;
    blue: number;
    redRand: number;
    greenRand: number;
    blueRand: number;
    rand: number;
    colorDances: boolean;
}

// ===== Events =====

export interface RogueEvent {
    eventType: EventType;
    param1: number;
    param2: number;
    controlKey: boolean;
    shiftKey: boolean;
}

// ===== High Scores =====

export interface RogueHighScoresEntry {
    score: number;
    date: string;
    description: string;
}

export interface RogueRun {
    seed: bigint;
    dateNumber: number;
    result: string;
    killedBy: string;
    gold: number;
    lumenstones: number;
    score: number;
    turns: number;
    deepestLevel: number;
}

// ===== Display Buffers =====

export interface CellDisplayBuffer {
    character: DisplayGlyph;
    foreColorComponents: [number, number, number];
    backColorComponents: [number, number, number];
    opacity: number;
}

export interface ScreenDisplayBuffer {
    cells: CellDisplayBuffer[][];  // [COLS][ROWS]
}

export interface SavedDisplayBuffer {
    savedScreen: ScreenDisplayBuffer;
}

// ===== Map Cells =====

/** Permanent cell — persisted across level saves */
export interface Pcell {
    layers: TileType[];   // [NUMBER_TERRAIN_LAYERS]
    flags: number;        // tileFlags bitmask
    volume: number;       // quantity of gas
    machineNumber: number;
    rememberedAppearance: CellDisplayBuffer;
    rememberedItemCategory: number;  // itemCategory bitmask
    rememberedItemKind: number;
    rememberedItemQuantity: number;
    rememberedItemOriginDepth: number;
    rememberedTerrain: TileType;
    rememberedCellFlags: number;
    rememberedTerrainFlags: number;
    rememberedTMFlags: number;
    exposedToFire: number;
}

/** Transient cell — not saved between levels */
export interface Tcell {
    light: [number, number, number];    // RGB
    oldLight: [number, number, number]; // previous frame RGB
}

// ===== Items =====

export interface KeyLocationProfile {
    loc: Pos;
    machine: number;
    disposableHere: boolean;
}

export interface Item {
    category: number;   // itemCategory bitmask
    kind: number;
    flags: number;      // itemFlags bitmask
    damage: RandomRange;
    armor: number;
    charges: number;
    enchant1: number;
    enchant2: number;
    timesEnchanted: number;
    vorpalEnemy: MonsterType;
    strengthRequired: number;
    quiverNumber: number;
    displayChar: DisplayGlyph;
    foreColor: Color | null;
    inventoryColor: Color | null;
    quantity: number;
    inventoryLetter: string;
    inscription: string;
    loc: Pos;
    keyLoc: KeyLocationProfile[];   // [KEY_ID_MAXIMUM]
    originDepth: number;
    spawnTurnNumber: number;
    lastUsed: [number, number, number];
}

export interface ItemTable {
    name: string;
    flavor: string;
    callTitle: string;
    frequency: number;
    marketValue: number;
    strengthRequired: number;
    power: number;
    range: RandomRange;
    identified: boolean;
    called: boolean;
    magicPolarity: number;
    magicPolarityRevealed: boolean;
    description: string;
}

export interface MeteredItem {
    frequency: number;
    numberSpawned: number;
}

export interface CharmEffectTableEntry {
    kind: number;
    effectDurationBase: number;
    effectDurationIncrement: readonly Fixpt[];
    rechargeDelayDuration: number;
    rechargeDelayBase: number;
    rechargeDelayMinTurns: number;
    effectMagnitudeConstant: number;
    effectMagnitudeMultiplier: number;
}

export interface MeteredItemGenerationTable {
    category: number;
    kind: number;
    initialFrequency: number;
    incrementFrequency: number;
    decrementFrequency: number;
    genMultiplier: number;
    genIncrement: number;
    levelScaling: number;
    levelGuarantee: number;
    itemNumberGuarantee: number;
}

export interface LevelFeeling {
    message: string;
    color: Color;
}

// ===== Lighting =====

export interface LightSource {
    lightColor: Color;
    lightRadius: RandomRange;
    radialFadeToPercent: number;
    passThroughCreatures: boolean;
}

export interface Flare {
    light: LightSource;
    coeffChangeAmount: number;
    coeffLimit: number;
    loc: Pos;
    coeff: number;
    turnNumber: number;
}

// ===== Bolts =====

export interface Bolt {
    name: string;
    description: string;
    abilityDescription: string;
    theChar: DisplayGlyph;
    foreColor: Color;
    backColor: Color;
    boltEffect: BoltEffect;
    magnitude: number;
    pathDF: DungeonFeatureType;
    targetDF: DungeonFeatureType;
    forbiddenMonsterFlags: number;
    flags: number;  // boltFlags bitmask
}

// ===== Dungeon Profiles & Features =====

export interface DungeonProfile {
    roomFrequencies: number[];  // [ROOM_TYPE_COUNT]
    corridorChance: number;
}

export interface DungeonFeature {
    tile: TileType | 0;
    layer: DungeonLayer;
    startProbability: number;
    probabilityDecrement: number;
    flags: number;  // DFFlags bitmask
    description: string;
    lightFlare: LightType;
    flashColor: Color | null;
    effectRadius: number;
    propagationTerrain: TileType | 0;
    subsequentDF: DungeonFeatureType | 0;
    messageDisplayed: boolean;
}

export interface FloorTileType {
    displayChar: DisplayGlyph | number;
    foreColor?: Color;
    backColor?: Color;
    drawPriority: number;
    chanceToIgnite: number;
    fireType: DungeonFeatureType | 0;
    discoverType: DungeonFeatureType | 0;
    promoteType: DungeonFeatureType | 0;
    promoteChance: number;
    glowLight: LightType;
    flags: number;       // terrainFlagCatalog bitmask
    mechFlags: number;   // terrainMechanicalFlagCatalog bitmask
    description: string;
    flavorText: string;
}

// ===== Creatures =====

export interface CreatureType {
    monsterID: MonsterType;
    monsterName: string;
    displayChar: DisplayGlyph;
    foreColor: Color;
    maxHP: number;
    defense: number;
    accuracy: number;
    damage: RandomRange;
    turnsBetweenRegen: number;
    movementSpeed: number;
    attackSpeed: number;
    bloodType: DungeonFeatureType;
    intrinsicLightType: LightType;
    isLarge: boolean;
    DFChance: number;
    DFType: DungeonFeatureType;
    bolts: BoltType[];   // up to 20
    flags: number;       // monsterBehaviorFlags bitmask
    abilityFlags: number; // monsterAbilityFlags bitmask
}

export interface MonsterWords {
    flavorText: string;
    absorbing: string;
    absorbStatus: string;
    attack: string[];   // up to 5
    DFMessage: string;
    summonMessage: string;
}

export interface StatusEffectInfo {
    name: string;
    isNegatable: boolean;
    playerNegatedValue: number;
}

export interface MonsterBehaviorInfo {
    description: string;
    isNegatable: boolean;
}

export interface MonsterAbilityInfo {
    description: string;
    isNegatable: boolean;
}

export interface Mutation {
    title: string;
    textColor: Color;
    healthFactor: number;
    moveSpeedFactor: number;
    attackSpeedFactor: number;
    defenseFactor: number;
    damageFactor: number;
    DFChance: number;
    DFType: DungeonFeatureType | 0;
    light: LightType;
    monsterFlags: number;
    monsterAbilityFlags: number;
    forbiddenFlags: number;
    forbiddenAbilityFlags: number;
    description: string;
    canBeNegated: boolean;
}

export interface HordeType {
    leaderType: MonsterType;
    numberOfMemberTypes: number;
    memberType: MonsterType[];    // up to 5
    memberCount: RandomRange[];   // up to 5
    minLevel: number;
    maxLevel: number;
    frequency: number;
    spawnsIn: TileType;
    machine: number;
    flags: number;  // hordeFlags bitmask
}

export interface MonsterClass {
    name: string;
    frequency: number;
    maxDepth: number;
    memberList: MonsterType[];  // up to 15
}

export interface Creature {
    info: CreatureType;
    loc: Pos;
    depth: number;
    currentHP: number;
    turnsUntilRegen: number;
    regenPerTurn: number;
    weaknessAmount: number;
    poisonAmount: number;
    creatureState: CreatureState;
    creatureMode: CreatureMode;
    mutationIndex: number;
    wasNegated: boolean;
    targetWaypointIndex: number;
    waypointAlreadyVisited: boolean[];  // [MAX_WAYPOINT_COUNT]
    lastSeenPlayerAt: Pos;
    targetCorpseLoc: Pos;
    targetCorpseName: string;
    absorptionFlags: number;
    absorbBehavior: boolean;
    absorptionBolt: number;
    corpseAbsorptionCounter: number;
    mapToMe: number[][] | null;
    safetyMap: number[][] | null;
    ticksUntilTurn: number;
    movementSpeed: number;
    attackSpeed: number;
    previousHealthPoints: number;
    turnsSpentStationary: number;
    flashStrength: number;
    flashColor: Color;
    status: number[];       // [NUMBER_OF_STATUS_EFFECTS]
    maxStatus: number[];    // [NUMBER_OF_STATUS_EFFECTS]
    bookkeepingFlags: number;
    spawnDepth: number;
    machineHome: number;
    xpxp: number;
    newPowerCount: number;
    totalPowerCount: number;
    leader: Creature | null;
    carriedMonster: Creature | null;
    carriedItem: Item | null;
}

// ===== Game Constants (variant-specific) =====

export interface GameConstants {
    majorVersion: number;
    minorVersion: number;
    patchVersion: number;
    variantName: string;
    versionString: string;
    dungeonVersionString: string;
    patchVersionPattern: string;
    recordingVersionString: string;
    deepestLevel: number;
    amuletLevel: number;
    depthAccelerator: number;
    minimumAltarLevel: number;
    minimumLavaLevel: number;
    minimumBrimstoneLevel: number;
    mutationsOccurAboveLevel: number;
    monsterOutOfDepthChance: number;
    extraItemsPerLevel: number;
    goldAdjustmentStartDepth: number;
    machinesPerLevelSuppressionMultiplier: number;
    machinesPerLevelSuppressionOffset: number;
    machinesPerLevelIncreaseFactor: number;
    maxLevelForBonusMachines: number;
    deepestLevelForMachines: number;
    playerTransferenceRatio: number;
    onHitHallucinateDuration: number;
    onHitWeakenDuration: number;
    onHitMercyHealPercent: number;
    fallDamageMin: number;
    fallDamageMax: number;
    weaponKillsToAutoID: number;
    armorDelayToAutoID: number;
    ringDelayToAutoID: number;
    numberAutogenerators: number;
    numberBoltKinds: number;
    numberBlueprints: number;
    numberHordes: number;
    numberMeteredItems: number;
    numberCharmKinds: number;
    numberPotionKinds: number;
    numberGoodPotionKinds: number;
    numberScrollKinds: number;
    numberGoodScrollKinds: number;
    numberWandKinds: number;
    numberGoodWandKinds: number;
    numberFeats: number;
    companionFeatRequiredXP: number;
    mainMenuTitleHeight: number;
    mainMenuTitleWidth: number;
}

// ===== Player Character (global game state) =====

export interface PlayerCharacter {
    mode: GameMode;
    depthLevel: number;
    deepestLevel: number;
    disturbed: boolean;
    gameInProgress: boolean;
    gameHasEnded: boolean;
    highScoreSaved: boolean;
    blockCombatText: boolean;
    autoPlayingLevel: boolean;
    automationActive: boolean;
    justRested: boolean;
    justSearched: boolean;
    cautiousMode: boolean;
    receivedLevitationWarning: boolean;
    updatedSafetyMapThisTurn: boolean;
    updatedAllySafetyMapThisTurn: boolean;
    updatedMapToSafeTerrainThisTurn: boolean;
    updatedMapToShoreThisTurn: boolean;
    inWater: boolean;
    heardCombatThisTurn: boolean;
    creaturesWillFlashThisTurn: boolean;
    staleLoopMap: boolean;
    alreadyFell: boolean;
    eligibleToUseStairs: boolean;
    trueColorMode: boolean;
    hideSeed: boolean;
    displayStealthRangeMode: boolean;
    quit: boolean;
    seed: bigint;
    RNG: number;
    gold: number;
    goldGenerated: number;
    strength: number;
    monsterSpawnFuse: number;
    weapon: Item | null;
    armor: Item | null;
    ringLeft: Item | null;
    ringRight: Item | null;
    swappedIn: Item | null;
    swappedOut: Item | null;
    flares: Flare[];
    yendorWarden: Creature | null;
    minersLight: LightSource;
    minersLightRadius: Fixpt;
    ticksTillUpdateEnvironment: number;
    scentTurnNumber: number;
    playerTurnNumber: number;
    absoluteTurnNumber: number;
    milliseconds: number;
    xpxpThisTurn: number;
    stealthRange: number;
    previousPoisonPercent: number;
    upLoc: Pos;
    downLoc: Pos;
    cursorLoc: Pos;
    lastTarget: Creature | null;
    lastItemThrown: Item | null;
    rewardRoomsGenerated: number;
    machineNumber: number;
    sidebarLocationList: Pos[];
    mapToShore: number[][] | null;
    mapToSafeTerrain: number[][] | null;
    recording: boolean;
    playbackMode: boolean;
    patchVersion: number;
    versionString: string;
    currentTurnNumber: number;
    howManyTurns: number;
    howManyDepthChanges: number;
    playbackDelayPerTurn: number;
    playbackDelayThisTurn: number;
    playbackPaused: boolean;
    playbackFastForward: boolean;
    playbackOOS: boolean;
    playbackOmniscience: boolean;
    playbackBetweenTurns: boolean;
    nextAnnotationTurn: number;
    nextAnnotation: string;
    locationInAnnotationFile: number;
    gameExitStatusCode: number;
    foodSpawned: bigint;
    meteredItems: MeteredItem[];
    clairvoyance: number;
    stealthBonus: number;
    regenerationBonus: number;
    lightMultiplier: number;
    awarenessBonus: number;
    transference: number;
    wisdomBonus: number;
    reaping: number;
    featRecord: boolean[];
    wpDistance: (number[][] | null)[];
    wpCount: number;
    wpCoordinates: Pos[];
    wpRefreshTicker: number;
    cursorPathIntensity: number;
    cursorMode: boolean;
    nextGame: NGCommand;
    nextGamePath: string;
    nextGameSeed: bigint;
    currentGamePath: string;
}

// ===== Level Data =====

export interface LevelData {
    visited: boolean;
    mapStorage: Pcell[][];   // [DCOLS][DROWS]
    items: Item[];
    monsters: Creature[];
    dormantMonsters: Creature[];
    scentMap: number[][] | null;
    levelSeed: bigint;
    upStairsLoc: Pos;
    downStairsLoc: Pos;
    playerExitedVia: Pos;
    awaySince: number;
}

// ===== Machine Features & Blueprints =====

export interface MachineFeature {
    featureDF: DungeonFeatureType;
    terrain: TileType;
    layer: DungeonLayer;
    instanceCountRange: [number, number];
    minimumInstanceCount: number;
    itemCategory: number;
    itemKind: number;
    monsterID: number;
    personalSpace: number;
    hordeFlags: number;
    itemFlags: number;
    flags: number;  // machineFeatureFlags bitmask
}

export interface Blueprint {
    name: string;
    depthRange: [number, number];
    roomSize: [number, number];
    frequency: number;
    featureCount: number;
    dungeonProfileType: DungeonProfileType;
    flags: number;  // blueprintFlags bitmask
    feature: MachineFeature[];  // up to 20
}

export interface AutoGenerator {
    terrain: TileType;
    layer: DungeonLayer;
    DFType: DungeonFeatureType;
    machine: number;  // machineTypes
    requiredDungeonFoundationType: TileType;
    requiredLiquidFoundationType: TileType;
    minDepth: number;
    maxDepth: number;
    frequency: number;
    minNumberIntercept: number;
    minNumberSlope: number;
    maxNumber: number;
}

export interface Feat {
    name: string;
    description: string;
    initialValue: boolean;
}

// ===== UI Types =====

export interface BrogueButton {
    text: string;
    x: number;
    y: number;
    hotkey: number[];  // up to 10
    buttonColor: Color;
    textColor: Color;
    hotkeyTextColor: Color;
    opacity: number;
    symbol: DisplayGlyph[];
    flags: number;
    command: NGCommand;
}

export interface ButtonState {
    buttonFocused: number;
    buttonDepressed: number;
    buttonChosen: number;
    buttonCount: number;
    buttons: BrogueButton[];
    winX: number;
    winY: number;
    winWidth: number;
    winHeight: number;
}

export interface ArchivedMessage {
    message: string;
    count: number;
    turn: number;
    flags: number;
}

// ===== Pause Behavior =====

export interface PauseBehavior {
    interruptForMouseMove: boolean;
}

export const PAUSE_BEHAVIOR_DEFAULT: PauseBehavior = { interruptForMouseMove: false };

// ===== Window Position constants =====

export interface WindowPosConst {
    windowX: number;
    windowY: number;
}
