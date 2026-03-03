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
    TextEntryType,
    DisplayGlyph,
    LightType,
    MonsterType,
    TileType,
    EventType,
    StatusEffect,
    ItemCategory,
    DungeonLayer,
    CreatureState,
    CreatureMode,
    FeatType,
    ArmorEnchant,
    BoltType,
    ALL_ITEMS,
} from "./types/enums.js";
import {
    COLS, ROWS, DCOLS, DROWS,
    KEYBOARD_LABELS,
    MESSAGE_ARCHIVE_ENTRIES, MESSAGE_LINES,
    MONSTER_CLASS_COUNT,
    NUMBER_TERRAIN_LAYERS,
    REST_KEY, SEARCH_KEY, ESCAPE_KEY,
    HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD,
    NUMBER_GOOD_WEAPON_ENCHANT_KINDS,
    LEFT_ARROW, LEFT_KEY, RIGHT_ARROW, RIGHT_KEY,
    UP_ARROW, UP_KEY, DOWN_ARROW, DOWN_KEY,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    TAB_KEY, SHIFT_TAB_KEY, RETURN_KEY, ACKNOWLEDGE_KEY,
    NUMPAD_0, NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4,
    NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9,
} from "./types/constants.js";
// PAUSE_BEHAVIOR_DEFAULT imported inline where needed

// -- Input dispatch imports ---------------------------------------------------
import type { InputContext, InputRogueState } from "./io/io-input.js";
import {
    executeKeystroke as executeKeystrokeFn,
    executeMouseClick as executeMouseClickFn,
    stripShiftFromMovementKeystroke as stripShiftFromMovementKeystrokeFn,
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
    applyColorMultiplier,
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
    refreshSideBar as refreshSideBarFn,
    printMonsterDetails as printMonsterDetailsFn,
    printFloorItemDetails as printFloorItemDetailsFn,
    printCarriedItemDetails as printCarriedItemDetailsFn,
    printProgressBar as printProgressBarFn,
} from "./io/io-sidebar.js";
import type { SidebarContext } from "./io/io-sidebar.js";
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
    displayInventory as displayInventoryFn,
} from "./io/io-inventory.js";
import type { InventoryContext } from "./io/io-inventory.js";

// -- Message imports ----------------------------------------------------------
import type { MessageState, MessageContext } from "./io/io-messages.js";
import {
    clearMessageArchive as clearMessageArchiveFn,
    message as messageFn,
    messageWithColor as messageWithColorFn,
    combatMessage as combatMessageFn,
    displayCombatText as displayCombatTextFn,
    confirmMessages as confirmMessagesFn,
    deleteMessages as deleteMessagesFn,
    updateMessageDisplay as updateMessageDisplayFn,
    displayMoreSign as displayMoreSignFn,
    displayMoreSignWithoutWaitingForAcknowledgment as displayMoreSignNoWaitFn,
    temporaryMessage as temporaryMessageFn,
    flavorMessage as flavorMessageFn,
    displayMessageArchive as displayMessageArchiveFn,
} from "./io/io-messages.js";

// -- Info screen imports ------------------------------------------------------
import {
    printHelpScreen as printHelpScreenFn,
    displayFeatsScreen as displayFeatsScreenFn,
    printDiscoveriesScreen as printDiscoveriesScreenFn,
} from "./io/io-screens.js";
import type { ScreenContext } from "./io/io-screens.js";

// -- Visual effects imports ---------------------------------------------------
import type { EffectsContext } from "./io/io-effects.js";
import {
    flashTemporaryAlert as flashTemporaryAlertFn,
    flashMessage as flashMessageFn,
} from "./io/io-effects.js";

// -- Async helpers for browser ------------------------------------------------
import { asyncPause } from "./platform/browser-renderer.js";

// -- Color imports ------------------------------------------------------------
import * as Colors from "./globals/colors.js";

// -- RNG imports --------------------------------------------------------------
import { seedRandomGenerator, randRange, rand64bits, randPercent, randClump, randClumpedRange, clamp } from "./math/rng.js";

// -- Grid imports -------------------------------------------------------------
import { allocGrid, freeGrid, fillGrid, findReplaceGrid, validLocationCount, randomLocationInGrid } from "./grid/grid.js";
import { zeroOutGrid, cellIsPassableOrDoor, passableArcCount, randomMatchingLocation } from "./architect/helpers.js";

// -- Creature imports ---------------------------------------------------------
import { createCreature, initializeGender, initializeStatus } from "./monsters/monster-creation.js";
import { distanceBetween } from "./monsters/monster-state.js";
// moveMonster, prependCreature, removeCreature are used inline in contexts (not as direct imports)
import { freeCaptive as freeCaptiveFn } from "./movement/ally-management.js";
import type { AllyManagementContext } from "./movement/ally-management.js";
import { promoteTile as promoteTileFn, updateEnvironment as updateEnvironmentFn } from "./time/environment.js";
import type { EnvironmentContext } from "./time/environment.js";
import {
    applyInstantTileEffectsToCreature as applyInstantTileEffectsFn,
    applyGradualTileEffectsToCreature as applyGradualTileEffectsFn,
    monsterShouldFall as monsterShouldFallFn,
    monstersFall as monstersFallFn,
    playerFalls as playerFallsFn,
    decrementPlayerStatus as decrementPlayerStatusFn,
    exposeCreatureToFire as exposeCreatureToFireFn,
    updateFlavorText as updateFlavorTextFn,
    updatePlayerUnderwaterness as updatePlayerUnderwaternessFn,
} from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";

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
import { autoRest as autoRestFn, manualSearch as manualSearchFn, rechargeItemsIncrementally as rechargeItemsIncrementallyFn, processIncrementalAutoID as processIncrementalAutoIDFn } from "./time/misc-helpers.js";
import type { MiscHelpersContext } from "./time/misc-helpers.js";

// -- Turn processing imports --------------------------------------------------
import { playerTurnEnded as playerTurnEndedFn, scentDistance, synchronizePlayerTimeState as synchronizePlayerTimeStateFn } from "./time/turn-processing.js";
import type { TurnProcessingContext } from "./time/turn-processing.js";

// -- Scent system imports -----------------------------------------------------
import { addScentToCell, layerWithFlag as layerWithFlagFn, layerWithTMFlag as layerWithTMFlagFn, printLocationDescription as printLocationDescriptionFn } from "./movement/map-queries.js";
import type { DescribeLocationContext } from "./movement/map-queries.js";
// item-helpers inline implementations are defined within buildDescribeLocationContext

// -- Game lifecycle imports ---------------------------------------------------
import { victory as victoryFn, enableEasyMode as enableEasyModeFn } from "./game/game-lifecycle.js";
import type { LifecycleContext } from "./game/game-lifecycle.js";

// (Creature effects, environment, safety maps, monster AI, combat damage,
//  search/scent, spawn, flares, cleanup imports are deferred — currently
//  using inline stubs in buildTurnProcessingContext.  They will be wired
//  to real implementations incrementally in Steps 3d-3f.)

// -- Combat math imports ------------------------------------------------------
import { diagonalBlocked as diagonalBlockedFn } from "./combat/combat-math.js";
import {
    attack as attackFn,
    buildHitList as buildHitListFn,
    moralAttack as moralAttackFn,
} from "./combat/combat-attack.js";
import type { AttackContext } from "./combat/combat-attack.js";
// killCreature is also called directly from several contexts beyond attack()
import { killCreature as killCreatureFn, inflictDamage as inflictDamageFn } from "./combat/combat-damage.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import { splitMonster as splitMonsterFn, anyoneWantABite as anyoneWantABiteFn, handlePaladinFeat as handlePaladinFeatFn, decrementWeaponAutoIDTimer as decrementWeaponAutoIDTimerFn, playerImmuneToMonster as playerImmuneToMonsterFn } from "./combat/combat-helpers.js";
import type { CombatHelperContext } from "./combat/combat-helpers.js";
import { specialHit as specialHitFn, magicWeaponHit as magicWeaponHitFn, applyArmorRunicEffect as applyArmorRunicEffectFn } from "./combat/combat-runics.js";
import type { RunicContext } from "./combat/combat-runics.js";
import { playerRecoversFromAttacking as playerRecoversFromAttackingFn } from "./time/turn-processing.js";
import { alertMonster } from "./monsters/monster-state.js";
import { monsterIsInClass, monstersAreEnemies as monstersAreEnemiesFn, monsterIsHidden as monsterIsHiddenFn, monsterWillAttackTarget as monsterWillAttackTargetFn } from "./monsters/monster-queries.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import {
    handleWhipAttacks as handleWhipAttacksFn,
    handleSpearAttacks as handleSpearAttacksFn,
    abortAttack as abortAttackFn,
    buildFlailHitList as buildFlailHitListFn,
} from "./movement/weapon-attacks.js";
import type { WeaponAttackContext, BoltInfo } from "./movement/weapon-attacks.js";
import { getImpactLoc as getImpactLocFn } from "./items/bolt-geometry.js";
import { ringWisdomMultiplier as ringWisdomMultiplierFn, charmRechargeDelay as charmRechargeDelayFn, turnsForFullRegenInThousandths, weaponForceDistance as weaponForceDistanceFn } from "./power/power-tables.js";

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
import type { MachineContext, ItemOps } from "./architect/machines.js";
import type { BuildBridgeContext } from "./architect/lakes.js";

// -- Flag imports -------------------------------------------------------------
import { TileFlag, TerrainFlag, TerrainMechFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag, MonsterAbilityFlag, ItemFlag, MessageFlag, T_OBSTRUCTS_SCENT, T_DIVIDES_LEVEL, T_PATHING_BLOCKER, T_HARMFUL_TERRAIN, T_MOVES_ITEMS, ANY_KIND_OF_VISIBLE, IS_IN_MACHINE } from "./types/flags.js";

// -- State helper imports -----------------------------------------------------
import { cellHasTerrainFlag, cellHasTMFlag, cellHasTerrainType, terrainFlags, terrainMechFlags, discoveredTerrainFlagsAtLoc, highestPriorityLayer } from "./state/helpers.js";
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
import { RNG_COSMETIC } from "./game/game-init.js";

// -- Safety maps import -------------------------------------------------------
import { updateSafetyMap as updateSafetyMapFn, updateClairvoyance as updateClairvoyanceFn } from "./time/safety-maps.js";
import type { SafetyMapsContext } from "./time/safety-maps.js";

// -- Creature effects import (burnItem) ---------------------------------------
import { burnItem as burnItemFn } from "./time/creature-effects.js";

// -- Appearance imports -------------------------------------------------------
import { bakeTerrainColors } from "./io/io-appearance.js";

// -- Item imports -------------------------------------------------------------
import { generateItem, initializeItem as initializeItemFn, itemMagicPolarity as itemMagicPolarityFn, getItemCategoryGlyph as getItemCategoryGlyphFn, getHallucinatedItemCategory as getHallucinatedItemCategoryFn } from "./items/item-generation.js";
import { addItemToPack, removeItemFromArray, numberOfItemsInPack as numberOfItemsInPackFn, numberOfMatchingPackItems as numberOfMatchingPackItemsFn, itemAtLoc as itemAtLocFn, canPickUpItem, checkForDisenchantment as checkForDisenchantmentFn } from "./items/item-inventory.js";
import { identify, identifyItemKind as identifyItemKindFn, itemName as itemNameFn, isVowelish as isVowelishFn, itemValue as itemValueFn } from "./items/item-naming.js";
import type { ItemNamingContext } from "./items/item-naming.js";
import { shuffleFlavors } from "./items/item-naming.js";
import { equipItem, unequipItem, recalculateEquipmentBonuses, updateEncumbrance as updateEncumbranceFn, updateRingBonuses as updateRingBonusesFn, strengthCheck, displayedArmorValue as displayedArmorValueFn, netEnchant as netEnchantFn } from "./items/item-usage.js";
import type { EquipContext, EquipmentState } from "./items/item-usage.js";
import { updateIdentifiableItems as updateIdentifiableItemsFn, magicCharDiscoverySuffix as magicCharDiscoverySuffixFn, eat as eatFn } from "./items/item-handlers.js";
import type { ItemHandlerContext } from "./items/item-handlers.js";
import { useKeyAt as useKeyAtFn } from "./movement/item-helpers.js";
import type { ItemHelperContext } from "./movement/item-helpers.js";

// -- Catalog imports ----------------------------------------------------------
import { monsterCatalog as monsterCatalogData } from "./globals/monster-catalog.js";
import { monsterText } from "./globals/monster-text.js";
import { lightCatalog as lightCatalogData } from "./globals/light-catalog.js";
import { meteredItemsGenerationTable as meteredItemsGenTable } from "./globals/item-catalog.js";
import { scrollTable, potionTable, lumenstoneDistribution, staffTable, ringTable, wandTable, charmTable, charmEffectTable, armorTable, foodTable } from "./globals/item-catalog.js";
import { populateItems as populateItemsFn } from "./items/item-population.js";
import { populateMonsters as populateMonstersFn, spawnHorde as spawnHordeFn, spawnPeriodicHorde as spawnPeriodicHordeFn, monsterCanSubmergeNow as monsterCanSubmergeNowFn, forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn, avoidedFlagsForMonster as avoidedFlagsForMonsterFn } from "./monsters/monster-spawning.js";
import { generateMonster as generateMonsterFn } from "./monsters/monster-creation.js";
import { createMonsterOps, toggleMonsterDormancy as toggleMonsterDormancyFn } from "./monsters/monster-ops.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { statusEffectCatalog } from "./globals/status-effects.js";
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
import { createFlare as createFlareFn, animateFlares as animateFlaresFn, deleteAllFlares } from "./light/flares.js";
import { playerInDarkness as playerInDarknessFn, updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import type { LightingContext } from "./light/light.js";

// -- Additional creature/combat imports for Phase 6 --------------------------
import { vomit as vomitFn } from "./movement/player-movement.js";
import { search as searchFn } from "./movement/item-helpers.js";
import { flashMonster as flashMonsterFn, addPoison as addPoisonFn } from "./combat/combat-damage.js";
import { exposeTileToFire as exposeTileToFireFn } from "./time/environment.js";
import { monsterAvoids as monsterAvoidsFn } from "./monsters/monster-state.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import { recordKeystroke as recordKeystrokeFn, cancelKeystroke as cancelKeystrokeFn, recordMouseClick as recordMouseClickFn } from "./recordings/recording-events.js";
import { printHighScores as printHighScoresFn } from "./io/io-screens.js";

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

    // -- Fields from TurnProcessingContext rogue state --
    awarenessBonus: number;
    wpCount: number;
    wpRefreshTicker: number;
    wpCoordinates: Pos[];
    heardCombatThisTurn: boolean;
    receivedLevitationWarning: boolean;
    flareCount: number;

    // -- Fields from SidebarContext rogue state --
    sidebarLocationList: Pos[];

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

        // -- TurnProcessingContext rogue state --
        awarenessBonus: 0,
        wpCount: 0,
        wpRefreshTicker: 0,
        wpCoordinates: [],
        heardCombatThisTurn: false,
        receivedLevitationWarning: false,
        flareCount: 0,

        // -- Sidebar state --
        sidebarLocationList: Array.from({ length: ROWS * 2 }, () => ({ x: -1, y: -1 })),

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
    /** Internal state access for testing. */
    _test: {
        readonly monsters: Creature[];
        readonly player: Creature;
        readonly pmap: Pcell[][];
        readonly rogue: any;
    };
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

    // -- burnedTerrainFlagsAtLoc -----------------------------------------------
    // Returns terrain flags of the tiles that would replace flammable tiles
    // at this location if burned (and also any explosive promote successors).
    // C: burnedTerrainFlagsAtLoc() in Monsters.c
    function burnedTerrainFlagsAtLocFn(loc: Pos): number {
        const cell = pmap[loc.x][loc.y];
        let flags = 0;
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            const tileType = cell.layers[layer];
            if (tileCatalog[tileType].flags & TerrainFlag.T_IS_FLAMMABLE) {
                // Successor terrain flags for burning
                const fireDF = tileCatalog[tileType].fireType;
                if (fireDF) {
                    flags |= tileCatalog[dungeonFeatureCatalog[fireDF].tile].flags;
                }
                // Also include promote-type successor if tile is explosive
                if (tileCatalog[tileType].mechFlags & TerrainMechFlag.TM_EXPLOSIVE_PROMOTE) {
                    const promoteDF = tileCatalog[tileType].promoteType;
                    if (promoteDF) {
                        flags |= tileCatalog[dungeonFeatureCatalog[promoteDF].tile].flags;
                    }
                }
            }
        }
        return flags;
    }

    // -- monsterAvoids wrapper ------------------------------------------------
    // Wraps the real monsterAvoids (Monsters.c) with a minimal context built
    // from runtime state.  Used by 8+ DI context builders.
    function monsterAvoidsWrapped(monst: Creature, p: Pos): boolean {
        return monsterAvoidsFn(monst, p, {
            player,
            downLoc: rogue.downLoc,
            upLoc: rogue.upLoc,
            terrainFlags: terrainFlagsAt,
            cellFlags: (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            discoveredTerrainFlagsAtLoc: discoveredTerrainFlagsAtLocFn,
            monsterAtLoc: monsterAtLocFn,
            passableArcCount: (x: number, y: number) => passableArcCount(pmap, x, y),
            burnedTerrainFlagsAtLoc: burnedTerrainFlagsAtLocFn,
            playerHasRespirationArmor: () => !!(
                rogue.armor &&
                (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
                rogue.armor.enchant2 === ArmorEnchant.Respiration
            ),
            mapToShore: rogue.mapToShore,
            HAS_MONSTER: TileFlag.HAS_MONSTER,
            HAS_PLAYER: TileFlag.HAS_PLAYER,
            PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
            HAS_STAIRS: TileFlag.HAS_STAIRS,
            IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
            monsterCanSubmergeNow: (m) => monsterCanSubmergeNowFn(m, cellHasTMFlagAt, cellHasTerrainFlagAt),
            isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
        } as MonsterStateContext);
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
            monsterAvoids: monsterAvoidsWrapped,
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
            monsterAvoids: monsterAvoidsWrapped,
            canPass: () => false,
            distanceBetween,
            monsterAtLoc: monsterAtLocFn,
            playerCanSee: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
            itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, _maxLen: number | null): void {
                buf[0] = itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },
            messageWithColor: msgOps.messageWithColor,
            refreshDungeonCell: () => {},
            discoverCell: () => {},
            storeMemories: () => {},
            layerWithTMFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),
            itemMessageColor: Colors.itemMessageColor,
            backgroundMessageColor: Colors.backgroundMessageColor,
            KEY: 0x2000, // ItemCategory.KEY
            assureCosmeticRNG: assureCosmeticRNGImpl,
            restoreRNG: restoreRNGImpl,
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

    // -- getCellAppearance ------------------------------------------------------
    // Mirrors C getCellAppearance (IO.c:1094). Tracks separate priorities for
    // foreColor, backColor, and displayChar so that surface tiles (e.g. blood)
    // with a null backColor inherit the floor's background instead of going black.
    // Also checks monster visibility (dormant, invisible, submerged).
    function getCellAppearance(pos: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color } {
        const cell = pmap[pos.x][pos.y];
        const isVisible = !!(cell.flags & TileFlag.VISIBLE);
        const isDiscovered = !!(cell.flags & TileFlag.DISCOVERED);

        // If cell is neither visible nor discovered, render as unexplored
        if (!isVisible && !isDiscovered) {
            return {
                glyph: 0x20 as DisplayGlyph, // space
                foreColor: { ...Colors.black },
                backColor: { ...Colors.black },
            };
        }

        // --- Per-attribute priority terrain rendering (C: IO.c:1139-1184) ---
        // Default to floor appearance
        const floorTile = tileCatalog[TileType.FLOOR];
        const defaultBlack: Color = { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
        let cellForeColor: Color = floorTile.foreColor ? { ...floorTile.foreColor } : { ...defaultBlack };
        let cellBackColor: Color = floorTile.backColor ? { ...floorTile.backColor } : { ...defaultBlack };
        let cellChar: DisplayGlyph = floorTile.displayChar as DisplayGlyph;
        let bestFCPriority = 10000;
        let bestBCPriority = 10000;
        let bestCharPriority = 10000;

        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (layer === DungeonLayer.Gas) continue; // Gas is handled separately
            const tileType = cell.layers[layer];
            if (!tileType) continue; // NOTHING
            const tile = tileCatalog[tileType];
            if (!tile) continue;

            if (tile.drawPriority < bestFCPriority && tile.foreColor) {
                cellForeColor = { ...tile.foreColor };
                bestFCPriority = tile.drawPriority;
            }
            if (tile.drawPriority < bestBCPriority && tile.backColor) {
                cellBackColor = { ...tile.backColor };
                bestBCPriority = tile.drawPriority;
            }
            if (tile.drawPriority < bestCharPriority && tile.displayChar) {
                cellChar = tile.displayChar as DisplayGlyph;
                bestCharPriority = tile.drawPriority;
            }
        }

        // Bake terrain random values into colors
        bakeTerrainColors(cellForeColor, cellBackColor, terrainRandomValues[pos.x][pos.y], rogue.trueColorMode);

        // Apply tmap lighting
        const lightR = tmap[pos.x][pos.y].light[0];
        const lightG = tmap[pos.x][pos.y].light[1];
        const lightB = tmap[pos.x][pos.y].light[2];
        cellForeColor.red = clamp(Math.floor(cellForeColor.red * (100 + lightR) / 100), 0, 100);
        cellForeColor.green = clamp(Math.floor(cellForeColor.green * (100 + lightG) / 100), 0, 100);
        cellForeColor.blue = clamp(Math.floor(cellForeColor.blue * (100 + lightB) / 100), 0, 100);
        cellBackColor.red = clamp(Math.floor(cellBackColor.red * (100 + lightR) / 100), 0, 100);
        cellBackColor.green = clamp(Math.floor(cellBackColor.green * (100 + lightG) / 100), 0, 100);
        cellBackColor.blue = clamp(Math.floor(cellBackColor.blue * (100 + lightB) / 100), 0, 100);

        // Collect the final glyph and colors — entity rendering may override these
        let resultGlyph = cellChar;
        let resultForeColor = cellForeColor;
        let resultBackColor = cellBackColor;

        if (isVisible) {
            // --- Check for player at this cell ---
            if (pos.x === player.loc.x && pos.y === player.loc.y) {
                resultGlyph = player.info.displayChar;
                resultForeColor = { ...Colors.white };
            }

            // --- Check for visible monsters (C: IO.c:1236-1262) ---
            else if (cell.flags & TileFlag.HAS_MONSTER) {
                const monst = monsterAtLocFn(pos);
                if (monst && !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)) {
                    // Check if monster is hidden (dormant, invisible, submerged)
                    const isDormant = !!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT);
                    const isInvisible = !!monst.status[StatusEffect.Invisible];
                    const isSubmerged = !!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED);

                    // monsterIsHidden: dormant always hidden; invisible (and no gas) hidden;
                    // submerged hidden unless observer is also in deep water
                    const observerInWater = cellHasTerrainFlagAt(player.loc, TerrainFlag.T_IS_DEEP_WATER)
                        && !player.status[StatusEffect.Levitating];
                    const hiddenBySubmersion = isSubmerged && !observerInWater;
                    const isHidden = isDormant || (isInvisible && !(cell.layers[DungeonLayer.Gas])) || hiddenBySubmersion;

                    if (!isHidden) {
                        let monstForeColor: Color = monst.info.foreColor
                            ? { ...monst.info.foreColor }
                            : { ...Colors.white };

                        // Invisible or submerged but shown (allies) — semi-transparent
                        if (isInvisible || isSubmerged) {
                            applyColorAverage(monstForeColor, cellBackColor, 75);
                        } else if (monst.creatureState === CreatureState.Ally
                            && !(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)) {
                            // Allies tinted pink
                            applyColorAverage(monstForeColor, Colors.pink, 50);
                        }

                        resultGlyph = monst.info.displayChar;
                        resultForeColor = monstForeColor;
                    }
                }
            }

            // --- Check for items on the floor ---
            else if (cell.flags & TileFlag.HAS_ITEM) {
                for (const item of floorItems) {
                    if (item.loc.x === pos.x && item.loc.y === pos.y) {
                        resultGlyph = item.displayChar;
                        resultForeColor = item.foreColor ? { ...item.foreColor } : { ...Colors.itemMessageColor };
                        break;
                    }
                }
            }

            // Apply underwater tint (C: IO.c:1428-1431)
            // When the player is submerged in deep water, all visible cells get
            // a blue tint via deepWaterLightColor multiplier.
            if (rogue.inWater) {
                applyColorMultiplier(resultForeColor, Colors.deepWaterLightColor);
                applyColorMultiplier(resultBackColor, Colors.deepWaterLightColor);
            }
        } else if (isDiscovered) {
            // Remembered cells when underwater: heavy darkening (C: IO.c:1398-1401)
            if (rogue.inWater) {
                applyColorAverage(resultForeColor, Colors.black, 80);
                applyColorAverage(resultBackColor, Colors.black, 80);
            } else {
                // Normal fog of war dimming
                resultForeColor.red = Math.floor(resultForeColor.red * 40 / 100);
                resultForeColor.green = Math.floor(resultForeColor.green * 40 / 100);
                resultForeColor.blue = Math.floor(resultForeColor.blue * 40 / 100);
                resultBackColor.red = Math.floor(resultBackColor.red * 40 / 100);
                resultBackColor.green = Math.floor(resultBackColor.green * 40 / 100);
                resultBackColor.blue = Math.floor(resultBackColor.blue * 40 / 100);
            }
        }

        return { glyph: resultGlyph, foreColor: resultForeColor, backColor: resultBackColor };
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
        // getFOVMask starts scanning from column 1, so the origin cell is never
        // included. Mark it explicitly (the player can always see their own cell).
        grid[player.loc.x][player.loc.y] = 1;

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

    // =========================================================================
    // Shared message helpers — Phase 1 of Wire Gameplay Systems
    // =========================================================================

    /**
     * Build the MessageContext DI object from shared runtime state.
     * This is the single source of truth for wiring the message system.
     */
    function buildMessageContext(): MessageContext {
        return {
            rogue: {
                get playerTurnNumber() { return rogue.playerTurnNumber; },
                get cautiousMode() { return rogue.cautiousMode; },
                set cautiousMode(v: boolean) { rogue.cautiousMode = v; },
                get disturbed() { return rogue.disturbed; },
                set disturbed(v: boolean) { rogue.disturbed = v; },
                get autoPlayingLevel() { return rogue.autoPlayingLevel; },
                get playbackMode() { return rogue.playbackMode; },
                get playbackOOS() { return rogue.playbackOOS; },
                get playbackDelayThisTurn() { return rogue.playbackDelayThisTurn; },
                set playbackDelayThisTurn(v: number) { rogue.playbackDelayThisTurn = v; },
                get playbackDelayPerTurn() { return rogue.playbackDelayPerTurn; },
                get playbackFastForward() { return rogue.playbackFastForward; },
            },
            messageState,
            displayBuffer,

            plotCharWithColor(ch, pos, fg, bg) {
                plotCharWithColor(ch, pos, fg, bg, displayBuffer);
            },
            overlayDisplayBuffer(dbuf) { applyOverlay(dbuf); },
            saveDisplayBuffer() { return saveDisplayBufferFn(displayBuffer); },
            restoreDisplayBuffer(saved) {
                restoreDisplayBufferFn(displayBuffer, saved);
                commitDraws();
            },

            refreshSideBar: refreshSideBarRuntime,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            waitForAcknowledgment() {
                // In the browser async model, blocking acknowledgment is not possible
                // from synchronous game code. Commit draws so the player sees the
                // message; acknowledgment-gated pauses will be upgraded to async in
                // a later phase when the input loop supports it.
                commitDraws();
            },
            pauseBrogue(_ms, _behavior) {
                // Synchronous pause not possible in browser — commit draws and return
                // "not interrupted". Real async pause is handled at the input-loop level.
                commitDraws();
                return false;
            },
            nextBrogueEvent(_textInput, _colorsDance, _realInput) {
                // Synchronous event poll — return a no-op event. The async input loop
                // handles real event delivery.
                return { eventType: 0, param1: 0, param2: 0, controlKey: false, shiftKey: false } as RogueEvent;
            },
            flashTemporaryAlert(msg, ms) {
                // Forward to the effects implementation via a minimal EffectsContext
                flashTemporaryAlertFn(msg, ms, buildEffectsContext());
            },
            updateFlavorText: updateFlavorTextRuntime,
            stripShiftFromMovementKeystroke(keystroke) {
                return stripShiftFromMovementKeystrokeFn(keystroke);
            },
        };
    }

    /**
     * Build a minimal EffectsContext for flash functions used by the message system.
     */
    function buildEffectsContext(): EffectsContext {
        return {
            rogue: {
                get playbackMode() { return rogue.playbackMode; },
                get playbackFastForward() { return rogue.playbackFastForward; },
                get playbackPaused() { return rogue.playbackPaused; },
                get playbackDelayPerTurn() { return rogue.playbackDelayPerTurn; },
                get autoPlayingLevel() { return rogue.autoPlayingLevel; },
                get blockCombatText() { return rogue.blockCombatText; },
                get creaturesWillFlashThisTurn() { return rogue.creaturesWillFlashThisTurn; },
                set creaturesWillFlashThisTurn(v: boolean) { rogue.creaturesWillFlashThisTurn = v; },
            },
            player,
            displayBuffer,
            applyColorAverage,
            applyColorAugment,
            bakeColor,
            separateColors,
            colorFromComponents(components: readonly number[]) {
                return { red: components[0] ?? 0, green: components[1] ?? 0, blue: components[2] ?? 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
            },
            getCellAppearance,
            plotCharWithColor(glyph, windowPos, fg, bg) {
                plotCharWithColor(glyph, windowPos, fg, bg, displayBuffer);
            },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            hiliteCell(x, y, color, strength, distinctColors) {
                const tCtx = buildTargetingContext();
                hiliteCellFn(x, y, color, strength, distinctColors, tCtx);
            },
            overlayDisplayBuffer(dbuf) { applyOverlay(dbuf); },
            mapToWindow(loc) {
                return { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) };
            },
            windowToMapX: windowToMapXFromDisplay,
            windowToMapY(windowY) { return windowY - MESSAGE_LINES; },
            mapToWindowX,
            strLenWithoutEscapes,
            printString(text, x, y, fg, bg, dbuf) {
                printStringFn(text, x, y, fg, bg, dbuf ?? displayBuffer);
                return strLenWithoutEscapes(text);
            },
            pauseBrogue(_ms) {
                commitDraws();
                return false;
            },
            pauseAnimation(_ms) {
                commitDraws();
                return false;
            },
            commitDraws,
            allocGrid,
            fillGrid,
            calculateDistances(distanceMap, x, y, blockingFlags, _blockingCellFlags, eightWay, _respectTravel) {
                calculateDistancesWrapped(distanceMap, x, y, blockingFlags, null, false, eightWay);
            },
            iterateCreatures() { return monsters; },
            canSeeMonster(monst) {
                return !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE);
            },
            displayedMessage: messageState.displayedMessage,
        };
    }

    /**
     * Build a spreadable bag of message operations for use in any DI context.
     *
     * Usage:
     *   const msgOps = buildMessageOps();
     *   return { ...msgOps, ...otherContextFields };
     *
     * Returned methods have the same signatures as the stubs they replace:
     *   message, messageWithColor, combatMessage, confirmMessages,
     *   deleteMessages, updateMessageDisplay, displayMoreSign,
     *   displayMoreSignWithoutWaitingForAcknowledgment, temporaryMessage,
     *   flavorMessage, flashTemporaryAlert, flashMessage,
     *   encodeMessageColor, displayMessageArchive, displayCombatText
     */
    function buildMessageOps() {
        return {
            message(msg: string, flags: number): void {
                messageFn(buildMessageContext(), msg, flags);
                commitDraws();
            },
            messageWithColor(msg: string, color: Readonly<Color>, flags: number): void {
                messageWithColorFn(buildMessageContext(), msg, color, flags);
                commitDraws();
            },
            combatMessage(msg: string, color: Readonly<Color> | null): void {
                combatMessageFn(buildMessageContext(), msg, color);
            },
            displayCombatText(): void {
                displayCombatTextFn(buildMessageContext());
                commitDraws();
            },
            confirmMessages(): void {
                confirmMessagesFn(buildMessageContext());
                commitDraws();
            },
            deleteMessages(): void {
                deleteMessagesFn(buildMessageContext());
                commitDraws();
            },
            updateMessageDisplay(): void {
                updateMessageDisplayFn(buildMessageContext());
                commitDraws();
            },
            displayMoreSign(): void {
                displayMoreSignFn(buildMessageContext());
                commitDraws();
            },
            displayMoreSignWithoutWaitingForAcknowledgment(): void {
                displayMoreSignNoWaitFn(buildMessageContext());
                commitDraws();
            },
            temporaryMessage(msg: string, flags: number): void {
                temporaryMessageFn(buildMessageContext(), msg, flags);
                commitDraws();
            },
            flavorMessage(msg: string): void {
                flavorMessageFn(buildMessageContext(), msg);
                commitDraws();
            },
            flashTemporaryAlert(msg: string, time: number): void {
                flashTemporaryAlertFn(msg, time, buildEffectsContext());
                commitDraws();
            },
            flashMessage(msg: string, x: number, y: number, duration: number, foreColor: Readonly<Color>, backColor: Readonly<Color>): void {
                flashMessageFn(msg, x, y, duration, foreColor, backColor, buildEffectsContext());
                commitDraws();
            },
            encodeMessageColor(buf: string[], pos: number, color: Readonly<Color>): void {
                buf[pos] = encodeMessageColor(color);
            },
            displayMessageArchive(): void {
                displayMessageArchiveFn(buildMessageContext());
                commitDraws();
            },
        };
    }

    // Cache a single instance of message ops to spread into DI contexts
    const msgOps = buildMessageOps();

    // =========================================================================
    // Item naming & query helpers — Phase 2: Item Interaction
    // =========================================================================

    /**
     * Build a shared ItemNamingContext for itemName() calls.
     * Always returns a fresh snapshot of current game state (depthLevel may change).
     */
    function buildItemNamingContext(): ItemNamingContext {
        return {
            gameConstants: gameConst,
            depthLevel: rogue.depthLevel,
            potionTable: potionTable as unknown as ItemTable[],
            scrollTable: scrollTable as unknown as ItemTable[],
            wandTable: wandTable as unknown as ItemTable[],
            staffTable: staffTable as unknown as ItemTable[],
            ringTable: ringTable as unknown as ItemTable[],
            charmTable: charmTable as unknown as ItemTable[],
            playbackOmniscience: rogue.playbackOmniscience,
            monsterClassName(classId: number): string {
                return monsterClassCatalog[classId]?.name ?? "unknown";
            },
        };
    }

    /**
     * Convenience: get item name as a string (wraps the ported itemNameFn).
     */
    function getItemName(theItem: Item, includeDetails: boolean, includeArticle: boolean): string {
        return itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
    }

    /**
     * Build the shared item operations helper (like buildMessageOps for messages).
     * Every DI context that needs item queries can use these.
     */
    // Item ops helpers (getItemName, itemAtLocFn, etc.) are used directly in context builders.

    // =========================================================================
    // Phase 5: Sidebar, Inventory, Screens — shared context builders
    // =========================================================================

    /**
     * Build a SidebarContext for refreshSideBar and detail panel functions.
     */
    function buildSidebarContext(): SidebarContext {
        return {
            rogue: {
                get gameHasEnded() { return rogue.gameHasEnded; },
                get playbackFastForward() { return rogue.playbackFastForward; },
                get playbackMode() { return rogue.playbackMode; },
                get playbackOmniscience() { return rogue.playbackOmniscience; },
                get playbackOOS() { return rogue.playbackOOS; },
                get playbackPaused() { return rogue.playbackPaused; },
                get playerTurnNumber() { return rogue.playerTurnNumber; },
                get howManyTurns() { return rogue.howManyTurns; },
                get depthLevel() { return rogue.depthLevel; },
                get strength() { return rogue.strength; },
                get gold() { return rogue.gold; },
                get stealthRange() { return rogue.stealthRange; },
                get sidebarLocationList() { return rogue.sidebarLocationList; },
                get armor() { return rogue.armor; },
                get trueColorMode() { return rogue.trueColorMode; },
            },
            player,
            pmap,
            tileCatalog,
            displayBuffer,

            statusEffectCatalog,
            mutationCatalog,
            monsterText,

            // Entity lookup
            monsterAtLoc: monsterAtLocFn,
            itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            canDirectlySeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.TELEPATHIC_VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE)),
            playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerInDarkness: () => playerInDarknessFn(tmap, player.loc),

            // Monster iteration
            iterateMonsters: () => [...monsters],

            // Floor items
            floorItems: () => [...floorItems],

            // Naming
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            itemName(theItem, includeDetails, includeArticle, _titleColor?) {
                return itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },

            // Item helpers
            getHallucinatedItemCategory: () => getHallucinatedItemCategoryFn({
                randRange,
                randPercent,
                randClump: (range) => randClumpedRange(range.lowerBound, range.upperBound, range.clumpFactor),
            }),
            getItemCategoryGlyph: getItemCategoryGlyphFn,
            describeHallucinatedItem() {
                // Simplified hallucinated item description
                return "a strange shimmering item";
            },

            // Cell appearance
            getCellAppearance,

            // Armor
            displayedArmorValue: () => displayedArmorValueFn({
                player,
                armor: rogue.armor,
                weapon: rogue.weapon,
                ringLeft: rogue.ringLeft,
                ringRight: rogue.ringRight,
                strength: rogue.strength,
                clairvoyance: rogue.clairvoyance,
                stealthBonus: rogue.stealthBonus,
                regenerationBonus: rogue.regenerationBonus,
                lightMultiplier: rogue.lightMultiplier,
                awarenessBonus: rogue.awarenessBonus,
                transference: rogue.transference,
                wisdomBonus: rogue.wisdomBonus,
                reaping: rogue.reaping,
            }),
            estimatedArmorValue: () => displayedArmorValueFn({
                player,
                armor: rogue.armor,
                weapon: rogue.weapon,
                ringLeft: rogue.ringLeft,
                ringRight: rogue.ringRight,
                strength: rogue.strength,
                clairvoyance: rogue.clairvoyance,
                stealthBonus: rogue.stealthBonus,
                regenerationBonus: rogue.regenerationBonus,
                lightMultiplier: rogue.lightMultiplier,
                awarenessBonus: rogue.awarenessBonus,
                transference: rogue.transference,
                wisdomBonus: rogue.wisdomBonus,
                reaping: rogue.reaping,
            }),

            // Layer queries
            cellHasTMFlag: cellHasTMFlagAt,
            layerWithTMFlag: (x, y, flag) => layerWithTMFlagFn(pmap, x, y, flag),

            // Text detail functions
            monsterDetails(_monst) {
                // TODO: full monster description text — stub for now
                return `${_monst.info.monsterName} (HP: ${_monst.currentHP}/${_monst.info.maxHP})`;
            },
            itemDetails(theItem) {
                // TODO: full item description text — stub for now
                return getItemName(theItem, true, true);
            },

            // Rendering helpers
            printTextBox(text, x, y, width, foreColor, backColor) {
                // Synchronous text box rendering: wrap text and render to display buffer
                const { text: wrapped, lineCount } = wrapText(text, width || 40);
                const renderWidth = width || 40;
                const renderX = Math.max(0, Math.min(x, COLS - renderWidth));
                const renderY = Math.max(0, Math.min(y, ROWS - lineCount));
                rectangularShadingFn(renderX, renderY, renderWidth, lineCount + 2, backColor, 100, displayBuffer, {
                    storeColorComponents,
                });
                printStringWithWrapping(wrapped, renderX + 1, renderY + 1, renderWidth - 2, foreColor, backColor, displayBuffer);
                commitDraws();
                return lineCount;
            },
            printProgressBar(x, y, label, amtFilled, amtMax, fillColor, dim) {
                printProgressBarFn(x, y, label, amtFilled, amtMax, fillColor, dim, displayBuffer);
            },
        };
    }

    /**
     * Runtime-level refreshSideBar — calls the real function with a fresh SidebarContext.
     */
    function refreshSideBarRuntime(focusX: number, focusY: number, forceFullUpdate: boolean): void {
        refreshSideBarFn(focusX, focusY, forceFullUpdate, buildSidebarContext());
        commitDraws();
    }

    /**
     * Runtime-level updateFlavorText — calls the real function with a CreatureEffectsContext.
     */
    function updateFlavorTextRuntime(): void {
        updateFlavorTextFn(buildCreatureEffectsContext());
    }

    /**
     * Build a DescribeLocationContext for printLocationDescription and describeLocation.
     */
    function buildDescribeLocationContext(): DescribeLocationContext {
        return {
            pmap,
            player,
            rogue: {
                scentTurnNumber: rogue.scentTurnNumber,
                disturbed: rogue.disturbed,
                automationActive: rogue.automationActive,
            },
            scentMap: scentMap ?? allocGrid(),
            terrainFlags: terrainFlagsAt,
            terrainMechFlags: terrainMechFlagsAt,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            coordinatesAreInMap,
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            monsterAtLoc: monsterAtLocFn,
            dormantMonsterAtLoc(loc) {
                for (const m of dormantMonsters) {
                    if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
                }
                return null;
            },
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterRevealed(monst) {
                const flags = pmap[monst.loc.x]?.[monst.loc.y]?.flags ?? 0;
                return !!(flags & (TileFlag.TELEPATHIC_VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE));
            },
            spawnDungeonFeature: spawnDungeonFeatureFromObject,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            dungeonFeatureCatalog,
            itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
            nbDirs,
            // DescribeLocationContext extensions
            playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.TELEPATHIC_VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE)),
            playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            itemMagicPolarity: itemMagicPolarityFn,
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            monsterCanSubmergeNow: (monst) => monsterCanSubmergeNowFn(monst, cellHasTMFlagAt, cellHasTerrainFlagAt),
            describedItemName(item, maxLength) {
                const buf = [getItemName(item, true, true)];
                if (buf[0].length > maxLength) {
                    buf[0] = getItemName(item, false, true);
                }
                return buf[0];
            },
            describedItemBasedOnParameters(category, kind, quantity, originDepth) {
                const tempItem = initializeItemFn();
                tempItem.category = category;
                tempItem.kind = kind;
                tempItem.quantity = quantity;
                tempItem.originDepth = originDepth;
                return itemNameFn(tempItem, false, true, buildItemNamingContext());
            },
            describeHallucinatedItem() {
                return "a strange shimmering item";
            },
            cosmeticRandRange: randRange,
            playbackOmniscience: rogue.playbackOmniscience,
            flavorMessage: msgOps.flavorMessage,
        };
    }

    /**
     * Build a ScreenContext for info screen functions (help, feats, discoveries).
     */
    function buildScreenContext(): ScreenContext {
        return {
            rogue: {
                get seed() { return rogue.seed; },
                get playerTurnNumber() { return rogue.playerTurnNumber; },
                get hideSeed() { return false; },
                get mode() { return rogue.mode; },
                get featRecord() { return rogue.featRecord; },
                get updatedSafetyMapThisTurn() { return rogue.updatedSafetyMapThisTurn; },
            },
            player: { loc: player.loc },
            gameConst: {
                numberFeats: gameConst.numberFeats,
                numberScrollKinds: gameConst.numberScrollKinds,
                numberPotionKinds: gameConst.numberPotionKinds,
                numberWandKinds: gameConst.numberWandKinds,
                versionString: gameConst.versionString,
            },
            featTable: [],
            boltCatalog: [],
            scrollTable: scrollTable as unknown as ItemTable[],
            potionTable: potionTable as unknown as ItemTable[],
            ringTable: ringTable as unknown as ItemTable[],
            staffTable: staffTable as unknown as ItemTable[],
            wandTable: wandTable as unknown as ItemTable[],

            // Display helpers
            printString(str, x, y, fg, bg, dbuf) {
                printStringFn(str, x, y, fg, bg, dbuf ?? displayBuffer);
            },
            plotCharToBuffer(glyph, loc, fg, bg, dbuf) {
                plotCharToBuffer(glyph, loc.windowX, loc.windowY, fg, bg, dbuf);
            },
            plotCharWithColor(glyph, loc, fg, bg, _dbuf) {
                plotCharWithColor(glyph, loc, fg, bg, displayBuffer);
            },
            strLenWithoutEscapes,
            encodeMessageColor,

            // Color manipulation
            applyColorAverage,

            // Display buffer management
            createScreenDisplayBuffer: () => createScreenDisplayBuffer(),
            clearDisplayBuffer: (dbuf) => clearDisplayBuffer(dbuf),
            saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
            restoreDisplayBuffer(saved) {
                restoreDisplayBufferFn(displayBuffer, saved);
                commitDraws();
            },
            overlayDisplayBuffer(dbuf) { applyOverlay(dbuf); },
            blackOutScreen(dbuf) { blackOutScreen(dbuf); },
            commitDraws,

            // Coordinate mapping
            mapToWindowX,
            mapToWindowY,
            mapToWindow(p) { return { windowX: mapToWindowX(p.x), windowY: mapToWindowY(p.y) }; },

            // Waiting
            waitForAcknowledgment() { commitDraws(); },
            waitForKeystrokeOrMouseClick() { commitDraws(); },

            // Message system
            message: msgOps.message,
            updateFlavorText: updateFlavorTextRuntime,
            updateMessageDisplay: msgOps.updateMessageDisplay,

            // High scores
            getHighScoresList() { return { list: [], mostRecentLine: -1 }; },

            // Map / terrain helpers
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            getCellAppearance,

            // Safety map
            safetyMap,
            updateSafetyMap() { updateSafetyMapFn(buildSafetyMapsContext()); },

            // Table helpers
            tableForItemCategory(category: number) {
                switch (category) {
                    case ItemCategory.SCROLL: return scrollTable as unknown as ItemTable[];
                    case ItemCategory.POTION: return potionTable as unknown as ItemTable[];
                    case ItemCategory.RING: return ringTable as unknown as ItemTable[];
                    case ItemCategory.STAFF: return staffTable as unknown as ItemTable[];
                    case ItemCategory.WAND: return wandTable as unknown as ItemTable[];
                    default: return null;
                }
            },
            magicCharDiscoverySuffix(category, kind) {
                return magicCharDiscoverySuffixFn(category, kind, { boltCatalog: [] as any });
            },
            upperCase(str) { return str.charAt(0).toUpperCase() + str.slice(1); },

            wizardMode: false,
        };
    }

    /**
     * Build an InventoryContext for displayInventory.
     */
    function buildInventoryContext(): InventoryContext {
        return {
            rogue: {
                get weapon() { return rogue.weapon; },
                get armor() { return rogue.armor; },
                get ringLeft() { return rogue.ringLeft; },
                get ringRight() { return rogue.ringRight; },
            },
            packItems,

            // Color
            applyColorAverage,
            encodeMessageColor,
            storeColorComponents,

            // Rendering
            createScreenDisplayBuffer: () => createScreenDisplayBuffer(),
            clearDisplayBuffer: (dbuf) => clearDisplayBuffer(dbuf),
            overlayDisplayBuffer(dbuf) { applyOverlay(dbuf); },
            saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
            restoreDisplayBuffer(saved) {
                restoreDisplayBufferFn(displayBuffer, saved);
                commitDraws();
            },

            drawButton(button, highlight, dbuf) {
                drawButtonFn(button, highlight, dbuf, buildButtonContext());
            },

            plotCharToBuffer(ch, x, y, fg, bg, dbuf) {
                plotCharToBuffer(ch, x, y, fg, bg, dbuf);
            },

            printStringWithWrapping(str, x, y, width, fg, bg, dbuf) {
                return printStringWithWrapping(str, x, y, width, fg, bg, dbuf);
            },

            strLenWithoutEscapes,
            wrapText,

            // Button loop
            async buttonInputLoop(buttons, buttonCount, winX, winY, winWidth, winHeight) {
                const result = await buttonInputLoopFn(buttons, buttonCount, winX, winY, winWidth, winHeight, buildButtonContext());
                return { chosenButton: result.chosenButton, event: result.event };
            },

            // Sidebar detail panels
            printCarriedItemDetails(theItem, x, y, width, includeButtons) {
                return printCarriedItemDetailsFn(theItem, x, y, width, includeButtons, buildSidebarContext());
            },

            // Text & item naming
            itemName(theItem, includeDetails, includeArticle) {
                return getItemName(theItem, includeDetails, includeArticle);
            },
            upperCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); },
            itemMagicPolarity: itemMagicPolarityFn,
            numberOfItemsInPack: () => numberOfItemsInPackFn(packItems),
            clearCursorPath() { clearCursorPathFn(buildTargetingContext()); },

            // Messages
            confirmMessages: msgOps.confirmMessages,
            message: msgOps.message,

            // Coordinate mapping
            mapToWindowX,
            mapToWindowY,

            // Colors
            white: Colors.white,
            gray: Colors.gray,
            black: Colors.black,
            itemColor: Colors.itemColor,
            goodMessageColor: Colors.goodMessageColor,
            badMessageColor: Colors.badMessageColor,
            interfaceBoxColor: Colors.interfaceBoxColor ?? { red: 40, green: 40, blue: 40, rand: 0, colorDances: false },

            // Glyphs
            G_GOOD_MAGIC: DisplayGlyph.G_GOOD_MAGIC,
            G_BAD_MAGIC: DisplayGlyph.G_BAD_MAGIC,
        };
    }

    /**
     * Prompt the player to select an item from their inventory matching
     * the given filters. Returns the selected Item, or null if cancelled.
     *
     * C: promptForItemOfType() in Items.c:7586
     */
    async function promptForItemOfType(
        category: number,
        requiredFlags: number,
        forbiddenFlags: number,
        prompt: string,
        allowInventoryActions: boolean,
    ): Promise<Item | null> {
        if (!numberOfMatchingPackItemsFn(packItems, ALL_ITEMS, requiredFlags, forbiddenFlags)) {
            return null;
        }

        msgOps.temporaryMessage(prompt, 0);

        const keystroke = await displayInventoryFn(
            category, requiredFlags, forbiddenFlags,
            false, allowInventoryActions, buildInventoryContext(),
        );

        if (!keystroke) {
            // Player took a direct action from inventory screen, or cancelled
            return null;
        }

        if (keystroke < "a" || keystroke > "z") {
            msgOps.confirmMessages();
            if (keystroke.charCodeAt(0) !== ESCAPE_KEY && keystroke.charCodeAt(0) !== ACKNOWLEDGE_KEY) {
                msgOps.message("Invalid entry.", 0);
            }
            return null;
        }

        const theItem = packItems.find(it => it.inventoryLetter === keystroke) ?? null;
        if (!theItem) {
            msgOps.confirmMessages();
            msgOps.message("No such item.", 0);
            return null;
        }

        return theItem;
    }

    /**
     * Build a full EquipContext from current rogue state.
     * Used for equip/unequip operations during gameplay (not just init).
     */
    function buildFullEquipContext(): EquipContext {
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
            message: (text, _requireAck) => msgOps.message(text, 0),
            updateRingBonuses: () => updateRingBonusesFn(equipState),
            updateEncumbrance: () => updateEncumbranceFn(equipState),
            itemName: getItemName,
            identifyItemKind: (theItem) => identifyItemKindFn(theItem, gameConst),
            displayLevel: () => { displayLevelFn(); commitDraws(); },
            updateClairvoyance: () => { updateClairvoyanceFn(buildSafetyMapsContext()); },
            updateFieldOfViewDisplay: () => { updateVisionFn(true); },
            updateMinersLightRadius: () => { /* stub — deferred */ },
            updatePlayerRegenerationDelay() {
                // C: updatePlayerRegenerationDelay() in Items.c
                let maxHP = player.info.maxHP;
                const turnsForFull = turnsForFullRegenInThousandths(
                    BigInt(rogue.regenerationBonus) * FP_FACTOR,
                );
                player.regenPerTurn = 0;
                const turnsForFullInTurns = Math.floor(turnsForFull / 1000);
                while (maxHP > turnsForFullInTurns) {
                    player.regenPerTurn++;
                    maxHP -= turnsForFullInTurns;
                }
                player.info.turnsBetweenRegen = maxHP > 0
                    ? Math.floor(turnsForFull / maxHP)
                    : turnsForFull;
            },
        };
    }

    /**
     * Sync equipment state from a full EquipContext back to rogue state.
     */
    function syncFullEquipState(equipCtx: EquipContext): void {
        rogue.weapon = equipCtx.state.weapon;
        rogue.armor = equipCtx.state.armor;
        rogue.ringLeft = equipCtx.state.ringLeft;
        rogue.ringRight = equipCtx.state.ringRight;
        rogue.strength = equipCtx.state.strength;
        rogue.clairvoyance = equipCtx.state.clairvoyance;
        rogue.stealthBonus = equipCtx.state.stealthBonus;
        rogue.regenerationBonus = equipCtx.state.regenerationBonus;
        rogue.lightMultiplier = equipCtx.state.lightMultiplier;
        rogue.transference = equipCtx.state.transference;
        rogue.wisdomBonus = equipCtx.state.wisdomBonus;
        rogue.reaping = equipCtx.state.reaping;
    }

    /**
     * Remove a floor item at a given location and clear the HAS_ITEM flag.
     * Also promotes terrain with T_PROMOTES_ON_ITEM_PICKUP if applicable.
     */
    function removeItemAt(loc: Pos): void {
        pmap[loc.x][loc.y].flags &= ~TileFlag.HAS_ITEM;
        // Check for terrain promotion on item pickup
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            const tile = tileCatalog[pmap[loc.x][loc.y].layers[layer]];
            if (tile && (tile as any).mechFlags & TerrainMechFlag.TM_PROMOTES_ON_ITEM_PICKUP) {
                promoteTileImpl(loc.x, loc.y, layer, false);
            }
        }
    }

    /**
     * Pick up item at a given location and add to pack.
     * Ported from C: pickUpItemAt() in Items.c:836
     */
    function pickUpItemAtImpl(loc: Pos): void {
        rogue.disturbed = true;

        const theItem = itemAtLocFn(loc, floorItems);
        if (!theItem) {
            msgOps.message("Error: Expected item; item not found.", 0);
            return;
        }

        // Auto-ID items with ITEM_KIND_AUTO_ID flag
        if (theItem.flags & ItemFlag.ITEM_KIND_AUTO_ID) {
            identifyItemKindFn(theItem, gameConst);
        }

        // Wand identification if table is identified and bounds match
        if ((theItem.category & ItemCategory.WAND)
            && (wandTable as unknown as ItemTable[])[theItem.kind]?.identified) {
            const table = (wandTable as unknown as ItemTable[])[theItem.kind];
            if (table.range.lowerBound === table.range.upperBound) {
                theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
            }
        }

        if (canPickUpItem(theItem, packItems)) {
            // Remove from floor
            pmap[loc.x][loc.y].flags &= ~TileFlag.ITEM_DETECTED;

            removeItemFromArray(theItem, floorItems);

            if (theItem.category & ItemCategory.GOLD) {
                rogue.gold += theItem.quantity;
                msgOps.messageWithColor(
                    `you found ${theItem.quantity} pieces of gold.`,
                    Colors.itemMessageColor,
                    0,
                );
                removeItemAt(loc);
                return;
            }

            if ((theItem.category & ItemCategory.AMULET)
                && numberOfMatchingPackItemsFn(packItems, ItemCategory.AMULET, 0, 0) > 0) {
                msgOps.message("you already have the Amulet of Yendor.", 0);
                return;
            }

            const addedItem = addItemToPack(theItem, packItems);

            const name = getItemName(addedItem, true, true);
            msgOps.messageWithColor(
                `you now have ${name} (${addedItem.inventoryLetter}).`,
                Colors.itemMessageColor,
                0,
            );

            removeItemAt(loc);

            // Amulet guardian logic
            if (addedItem.category & ItemCategory.AMULET) {
                if (!rogue.yendorWarden) {
                    for (const monst of monsters) {
                        if (monst.info.monsterID === MonsterType.MK_WARDEN_OF_YENDOR) {
                            rogue.yendorWarden = monst;
                            break;
                        }
                    }
                }
            }
        } else {
            const name = getItemName(theItem, true, true);
            msgOps.messageWithColor(
                `your pack is too full to pick up ${name}.`,
                Colors.badMessageColor,
                0,
            );
        }
    }

    /**
     * Check if a tile should promote because its key was removed.
     * Ported from C: checkForMissingKeys() in Items.c:4310
     */
    function checkForMissingKeysImpl(x: number, y: number): void {
        if (cellHasTMFlagAt({ x, y }, TerrainMechFlag.TM_PROMOTES_WITHOUT_KEY)) {
            // Check if there's a key at this location (on floor or carried by monster)
            let keyFound = false;
            for (const item of floorItems) {
                if (item.loc.x === x && item.loc.y === y && (item.category & ItemCategory.KEY)) {
                    keyFound = true;
                    break;
                }
            }
            if (!keyFound) {
                for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                    const tile = tileCatalog[pmap[x][y].layers[layer]];
                    if (tile && (tile as any).mechFlags & TerrainMechFlag.TM_PROMOTES_WITHOUT_KEY) {
                        promoteTileImpl(x, y, layer, false);
                    }
                }
            }
        }
    }

    /**
     * Make a monster drop its carried item on the ground.
     * Ported from C: makeMonsterDropItem() in Monsters.c:4065
     */
    function makeMonsterDropItemImpl(monst: Creature): void {
        if (!monst.carriedItem) return;

        const dropLoc = { ...monst.loc }; // simplified: drop at monster's location
        const item = monst.carriedItem;
        monst.carriedItem = null;

        item.loc = { ...dropLoc };

        // Try to find a free adjacent cell if the current one has an item
        if (pmap[dropLoc.x][dropLoc.y].flags & TileFlag.HAS_ITEM) {
            for (let i = 0; i < 8; i++) {
                const nx = dropLoc.x + nbDirs[i][0];
                const ny = dropLoc.y + nbDirs[i][1];
                if (coordinatesAreInMap(nx, ny)
                    && !(pmap[nx][ny].flags & (TileFlag.HAS_ITEM | TileFlag.HAS_PLAYER | TileFlag.HAS_STAIRS))
                    && !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_ITEMS)) {
                    item.loc = { x: nx, y: ny };
                    break;
                }
            }
        }

        floorItems.push(item);
        pmap[item.loc.x][item.loc.y].flags |= TileFlag.HAS_ITEM;

        const { glyph, foreColor, backColor } = getCellAppearance(item.loc);
        plotCharWithColor(glyph, { windowX: mapToWindowX(item.loc.x), windowY: mapToWindowY(item.loc.y) }, foreColor, backColor, displayBuffer);
    }

    /**
     * Build an ItemHelperContext for useKeyAt() and related helpers.
     */
    function buildItemHelperContext(): ItemHelperContext {
        return {
            pmap,
            player,
            rogue: { playbackOmniscience: rogue.playbackOmniscience },
            tileCatalog: tileCatalog as any,
            initializeItem: initializeItemFn,
            itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, _maxLen: number | null): void {
                buf[0] = itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },
            describeHallucinatedItem(buf: string[]): void {
                buf[0] = "a strange item";
            },
            removeItemFromChain: removeItemFromArray,
            deleteItem(_theItem: Item): void {
                // GC handles cleanup in TS
            },
            monsterAtLoc: monsterAtLocFn,
            promoteTile(x: number, y: number, layer: number, isVolatile: boolean): void {
                promoteTileImpl(x, y, layer, isVolatile);
            },
            messageWithColor: msgOps.messageWithColor,
            itemMessageColor: Colors.itemMessageColor,
            packItems,
            floorItems,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            coordinatesAreInMap,
            playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            distanceBetween,
            discover: (_x: number, _y: number) => { /* stub */ },
            randPercent,
            posEq: (a: Pos, b: Pos) => a.x === b.x && a.y === b.y,
        };
    }

    // -- ButtonContext (needed by several menu functions) ----------------------
    function buildButtonContext(): ButtonContext { return buttonCtx; }
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
        printCarriedItemDetails: () => 0,       // stub — needs SidebarContext (Phase 5)
        itemName: getItemName,
        upperCase: (s: string) => s.toUpperCase(),
        itemMagicPolarity: itemMagicPolarityFn,
        numberOfItemsInPack: () => numberOfItemsInPackFn(packItems),
        clearCursorPath: () => {},               // stub
        confirmMessages: msgOps.confirmMessages,
        message: msgOps.message,
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
            itemName: getItemName,
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

    // -- Build SpawnContext (for monster population) ----------------------------
    function buildSpawnContext(): import("./monsters/monster-spawning.js").SpawnContext {
        return {
            genCtx: {
                rng: { randRange, randPercent },
                gameConstants: gameConst,
                depthLevel: rogue.depthLevel,
                monsterCatalog,
                mutationCatalog,
                monsterItemsHopper,
                itemsEnabled: true,
            },
            gameConstants: gameConst,
            hordeCatalog,
            monsterCatalog,
            monsters,
            monstersEnabled: true,

            cellHasTerrainFlag(loc, flags) {
                return cellHasTerrainFlag(pmap, loc, flags);
            },
            cellHasTMFlag(loc, flags) {
                return cellHasTMFlag(pmap, loc, flags);
            },
            cellHasTerrainType(loc, terrainType) {
                return cellHasTerrainType(pmap, loc, terrainType);
            },
            isPosInMap(loc) {
                return coordinatesAreInMap(loc.x, loc.y);
            },

            monsterAtLoc: monsterAtLocFn,
            killCreature(creature, quiet) {
                killCreatureImpl(creature, quiet);
            },
            buildMachine(_machineType, _x, _y) {
                // Stub — machine building during spawning (rare: captive hordes)
            },
            setCellFlag(loc, flag) {
                pmap[loc.x][loc.y].flags |= flag;
            },
            clearCellFlag(loc, flag) {
                pmap[loc.x][loc.y].flags &= ~flag;
            },
            refreshDungeonCell(_loc) {
                // No-op during level generation
            },
            playerCanSeeOrSense(_x, _y) {
                return false; // Not relevant during initial population
            },
            becomeAllyWith(_creature) {
                // Stub — ally system
            },
            drawManacles(_loc) {
                // Stub — visual manacles around captive location
            },
            allocGrid,
            fillGrid,
            getQualifyingPathLocNear(loc, _hallwaysAllowed, _blockingTerrainFlags, _blockingMapFlags, _forbiddenTerrainFlags, _forbiddenMapFlags, _deterministic) {
                // Simplified — return the target location itself
                return { ...loc };
            },
            randomMatchingLocation(dungeonType, liquidType, terrainType) {
                return randomMatchingLocation(pmap, tileCatalog as any, dungeonType, liquidType, terrainType);
            },
            passableArcCount(x, y) {
                return passableArcCount(pmap, x, y);
            },
            getPmapFlags(loc) {
                return pmap[loc.x][loc.y].flags;
            },
        };
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
            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            flavorMessage: msgOps.flavorMessage,

            // Color encoding - adapts the (color) => string API to the (buf, pos, color) => void API
            encodeMessageColor: msgOps.encodeMessageColor,

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
            monsterOps: createMonsterOps({
                monsters,
                spawnHorde(leaderID, pos, forbiddenFlags, requiredFlags) {
                    return spawnHordeFn(leaderID, pos, forbiddenFlags, requiredFlags, buildSpawnContext());
                },
                monsterAtLoc: monsterAtLocFn,
                killCreature(creature, quiet) {
                    killCreatureImpl(creature, quiet);
                },
                generateMonster(monsterID, _atDepth, summon) {
                    return generateMonsterFn(monsterID, true, !summon, {
                        rng: { randRange, randPercent },
                        gameConstants: gameConst,
                        depthLevel: rogue.depthLevel,
                        monsterCatalog,
                        mutationCatalog,
                        monsterItemsHopper,
                        itemsEnabled: true,
                    });
                },
                toggleMonsterDormancy: toggleMonsterDormancyFn,
            }),
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
                synchronizePlayerTimeStateFn(buildTurnProcessingContext());
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
                initializeLevelFn(
                    pmap, upStairsLoc, rogue.depthLevel, levels, getFOVMaskWrapped,
                    // populateItems callback
                    (upLoc: Pos) => {
                        const itemState = {
                            depthLevel: rogue.depthLevel,
                            depthAccelerator: gameConst.depthAccelerator,
                            goldGenerated: rogue.goldGenerated,
                            foodSpawned: rogue.foodSpawned,
                            meteredItems: rogue.meteredItems,
                        };
                        populateItemsFn(upLoc, {
                            state: itemState,
                            gameConstants: gameConst,
                            rng: { randRange, randPercent, randClump },
                            scrollTable: mutableScrollTable,
                            potionTable: mutablePotionTable,
                            meteredItemsGenerationTable: meteredItemsGenTable,
                            lumenstoneDistribution,
                            cellHasTerrainFlag(pos, flags) {
                                return cellHasTerrainFlag(pmap, pos, flags);
                            },
                            getCellFlags(x, y) {
                                return pmap[x][y].flags;
                            },
                            getDungeonLayer(x, y) {
                                return pmap[x][y].layers[DungeonLayer.Dungeon];
                            },
                            setDungeonLayer(x, y, value) {
                                pmap[x][y].layers[DungeonLayer.Dungeon] = value;
                            },
                            isPassableOrSecretDoor(pos) {
                                return cellIsPassableOrDoor(pmap, pos.x, pos.y);
                            },
                            passableArcCount(x, y) {
                                return passableArcCount(pmap, x, y);
                            },
                            randomMatchingLocation(dungeonType, liquidType, terrainType) {
                                return randomMatchingLocation(pmap, tileCatalog as any, dungeonType, liquidType, terrainType);
                            },
                            placeItemAt(item, loc) {
                                item.loc = { ...loc };
                                floorItems.push(item);
                                pmap[loc.x][loc.y].flags |= TileFlag.HAS_ITEM;
                            },
                            chooseVorpalEnemy,
                        });
                        // Sync mutable state back to rogue
                        rogue.goldGenerated = itemState.goldGenerated;
                        rogue.foodSpawned = itemState.foodSpawned;
                    },
                    // populateMonsters callback
                    () => {
                        populateMonstersFn(buildSpawnContext());
                    },
                );
            },
            setUpWaypoints() {
                const result = setUpWaypointsFn(pmap, populateGenericCostMapWrapped, getFOVMaskWrapped);
                rogue.wpDistance = result.wpDistance;
            },
            shuffleTerrainColors: shuffleTerrainColorsFn,

            numberOfMatchingPackItems: (_category: number, _flags: number, _flags2: number, _useFlags: boolean) =>
                numberOfMatchingPackItemsFn(packItems, _category, _flags, _flags2),
            itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
            describedItemName(theItem: Item) {
                return getItemName(theItem, true, true);
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
            refreshSideBar: refreshSideBarRuntime,
            messageWithColor: msgOps.messageWithColor,
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
            monsterAvoids: monsterAvoidsWrapped,
            canPass: () => false,
            distanceBetween,
            monsterAtLoc: monsterAtLocFn,
            playerCanSee: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (_x, _y) => !!(pmap[_x]?.[_y]?.flags & TileFlag.VISIBLE),
            itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
            itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, _maxLen: number | null): void {
                buf[0] = itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },
            messageWithColor: msgOps.messageWithColor,
            refreshDungeonCell: () => {},
            discoverCell: () => {},
            storeMemories: () => {},
            layerWithTMFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),
            itemMessageColor: Colors.itemMessageColor,
            backgroundMessageColor: Colors.backgroundMessageColor,
            KEY: ItemCategory.KEY,
            assureCosmeticRNG: assureCosmeticRNGImpl,
            restoreRNG: restoreRNGImpl,
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
            rogue,
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
            monsterAvoids: monsterAvoidsWrapped,
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
            numberOfMatchingPackItems(category: number, _requiredFlags: number, _forbiddenFlags: number, _isBlessed: boolean) {
                return numberOfMatchingPackItemsFn(packItems, category, _requiredFlags, _forbiddenFlags);
            },

            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            confirmMessages: msgOps.confirmMessages,
            hiliteCell(x, y, color, strength, saveBuf) {
                const tCtx = buildTargetingContext();
                hiliteCellFn(x, y, color, strength, saveBuf, tCtx);
            },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            refreshSideBar: refreshSideBarRuntime,
            updateFlavorText: updateFlavorTextRuntime,
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
            recordMouseClick(x, y, controlKey, shiftKey) {
                recordMouseClickFn(x, y, controlKey, shiftKey, recordingBuffer, rogue.playbackMode);
            },
            mapToWindowX,
            mapToWindowY,
            windowToMapX: windowToMapXFromDisplay,
            windowToMapY: windowToMapYFromDisplay,
            updatePlayerUnderwaterness() { updatePlayerUnderwaternessFn(buildCreatureEffectsContext()); },
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
            victory(superVictory) { doVictory(superVictory); },

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

    // =========================================================================
    // Phase 3: Monster Lifecycle — Shared helper implementations
    // =========================================================================

    /**
     * Demote a monster from leadership, reassigning followers to a new leader.
     * Ported from demoteMonsterFromLeadership() in Monsters.c:4094.
     */
    function demoteMonsterFromLeadershipImpl(monst: Creature): void {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_LEADER;
        if (monst.mapToMe) {
            freeGrid(monst.mapToMe);
            monst.mapToMe = null;
        }

        let newLeader: Creature | null = null;
        let atLeastOneNewFollower = false;

        for (let level = 0; level <= gameConst.deepestLevel; level++) {
            const list = level === 0 ? monsters : (levels[level - 1]?.monsters ?? []);
            for (const follower of list) {
                if (follower === monst || follower.leader !== monst) continue;
                if (follower.bookkeepingFlags & MonsterBookkeepingFlag.MB_BOUND_TO_LEADER) {
                    follower.leader = null;
                    follower.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_FOLLOWER;
                } else if (newLeader) {
                    follower.leader = newLeader;
                    atLeastOneNewFollower = true;
                    follower.targetWaypointIndex = monst.targetWaypointIndex;
                    if (follower.targetWaypointIndex >= 0) {
                        follower.waypointAlreadyVisited[follower.targetWaypointIndex] = false;
                    }
                } else {
                    newLeader = follower;
                    follower.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
                    follower.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_FOLLOWER;
                    follower.leader = null;
                }
            }
        }

        if (newLeader && !atLeastOneNewFollower) {
            newLeader.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_LEADER;
        }

        // Clear dormant followers
        for (let level = 0; level <= gameConst.deepestLevel; level++) {
            const list = level === 0 ? dormantMonsters : (levels[level - 1]?.dormantMonsters ?? []);
            for (const follower of list) {
                if (follower === monst || follower.leader !== monst) continue;
                follower.leader = null;
                follower.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_FOLLOWER;
            }
        }
    }

    /**
     * Check if a monster still has followers; if not, remove MB_LEADER.
     * Ported from checkForContinuedLeadership() in Monsters.c:4077.
     */
    function checkForContinuedLeadershipImpl(monst: Creature): void {
        let maintainLeadership = false;
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER) {
            for (const follower of monsters) {
                if (follower.leader === monst && monst !== follower) {
                    maintainLeadership = true;
                    break;
                }
            }
        }
        if (!maintainLeadership) {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_LEADER;
        }
    }

    /**
     * Fade in a monster visually. Simplified version that refreshes the cell.
     * Full version would flash the monster with the background color.
     * Ported from fadeInMonster() in Monsters.c:904.
     */
    function fadeInMonsterImpl(monst: Creature): void {
        // Set HAS_MONSTER flag so the cell renders the monster
        if (monst !== player && coordinatesAreInMap(monst.loc.x, monst.loc.y)) {
            pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.HAS_MONSTER;
        }
        const { glyph, foreColor, backColor } = getCellAppearance(monst.loc);
        plotCharWithColor(glyph, { windowX: mapToWindowX(monst.loc.x), windowY: mapToWindowY(monst.loc.y) }, foreColor, backColor, displayBuffer);
    }

    /**
     * Runtime-level cloneMonster — port of Monsters.c:559.
     * Clones a monster, optionally placing it near the original.
     *
     * @param monst The monster to clone.
     * @param announce Whether to announce the clone's appearance.
     * @param placeClone Whether to place the clone on the map.
     */
    function cloneMonsterImpl(monst: Creature, announce: boolean, placeClone: boolean): Creature | null {
        // Generate a fresh creature of the same type
        const newMonst = generateMonsterFn(monst.info.monsterID, false, false, {
            rng: { randRange, randPercent },
            gameConstants: gameConst,
            depthLevel: rogue.depthLevel,
            monsterCatalog,
            mutationCatalog,
            monsterItemsHopper,
            itemsEnabled: true,
        });

        // Copy all properties from original (deep copy key arrays)
        const savedInfo = { ...monst.info };
        Object.assign(newMonst, monst);
        newMonst.info = { ...savedInfo };
        newMonst.status = [...monst.status];
        newMonst.maxStatus = [...monst.maxStatus];

        // Reset clone-specific fields
        newMonst.carriedMonster = null;
        initializeGender(newMonst, { randRange, randPercent });
        newMonst.bookkeepingFlags &= ~(MonsterBookkeepingFlag.MB_LEADER | MonsterBookkeepingFlag.MB_CAPTIVE | MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID);
        newMonst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        newMonst.mapToMe = null;
        newMonst.safetyMap = null;
        newMonst.carriedItem = null;

        // Clone carried monster recursively (rare case)
        if (monst.carriedMonster) {
            const parentClone = cloneMonsterImpl(monst.carriedMonster, false, false);
            if (parentClone) {
                // Remove from world lists since cloneMonster auto-adds
                const mi = monsters.indexOf(parentClone);
                if (mi >= 0) monsters.splice(mi, 1);
                const di = dormantMonsters.indexOf(parentClone);
                if (di >= 0) dormantMonsters.splice(di, 1);
            }
        }

        newMonst.ticksUntilTurn = 101;
        if (monst.creatureState !== CreatureState.Ally) {
            newMonst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED;
        }

        // Set up leadership
        if (monst.leader) {
            newMonst.leader = monst.leader;
        } else {
            newMonst.leader = monst;
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
        }

        // Captive clones become allies
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
            newMonst.creatureState = CreatureState.Ally;
        }

        // Add to monster list
        monsters.push(newMonst);

        if (placeClone) {
            // Find an adjacent empty cell for the clone
            let placed = false;
            for (let dx = -1; dx <= 1 && !placed; dx++) {
                for (let dy = -1; dy <= 1 && !placed; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = monst.loc.x + dx;
                    const ny = monst.loc.y + dy;
                    if (coordinatesAreInMap(nx, ny)
                        && !(pmap[nx][ny].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER | TileFlag.HAS_STAIRS))
                        && !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                        newMonst.loc = { x: nx, y: ny };
                        placed = true;
                    }
                }
            }
            if (!placed) {
                // If no adjacent cell, place at same location (will overlap briefly)
                newMonst.loc = { ...monst.loc };
            }

            pmap[newMonst.loc.x][newMonst.loc.y].flags |= TileFlag.HAS_MONSTER;
            // Refresh the cell
            const { glyph, foreColor, backColor } = getCellAppearance(newMonst.loc);
            plotCharWithColor(glyph, { windowX: mapToWindowX(newMonst.loc.x), windowY: mapToWindowY(newMonst.loc.y) }, foreColor, backColor, displayBuffer);

            if (announce && !!(pmap[newMonst.loc.x]?.[newMonst.loc.y]?.flags & TileFlag.VISIBLE)) {
                const monstName = newMonst.info.monsterName;
                msgOps.message(`another ${monstName} appears!`, 0);
            }
        }

        // Player clone special case
        if (monst === player) {
            newMonst.info.foreColor = Colors.gray;
            newMonst.info.damage = { lowerBound: 1, upperBound: 2, clumpFactor: 1 };
            newMonst.info.defense = 0;
            newMonst.info.monsterName = "clone";
            newMonst.creatureState = CreatureState.Ally;
        }

        // Jellymancer feat tracking
        if (monst.creatureState === CreatureState.Ally
            && (monst.info.abilityFlags & MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND)
            && !rogue.featRecord[FeatType.Jellymancer]) {
            let jellyCount = 0;
            for (const m of monsters) {
                if (m.creatureState === CreatureState.Ally
                    && (m.info.abilityFlags & MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND)) {
                    jellyCount++;
                }
            }
            if (jellyCount >= 90) {
                rogue.featRecord[FeatType.Jellymancer] = true;
            }
        }

        return newMonst;
    }

    /**
     * Helper: returns the appropriate message color based on the victim's
     * relationship to the player.
     * C: messageColorFromVictim (IO.c:3598)
     */
    function messageColorFromVictimImpl(monst: Creature): Readonly<Color> {
        if (monst === player) {
            return Colors.badMessageColor;
        } else if (player.status[StatusEffect.Hallucinating] && !rogue.playbackOmniscience) {
            return Colors.white;
        } else if (monst.creatureState === CreatureState.Ally) {
            return Colors.badMessageColor;
        } else if (monstersAreEnemiesFn(player, monst, player, cellHasTerrainFlagAt)) {
            return Colors.goodMessageColor;
        } else {
            return Colors.white;
        }
    }

    /**
     * Port of C forceWeaponHit (Combat.c:498).
     * Pushes the defender away from the player using a simulated blinking bolt,
     * then applies force damage on impact with terrain or another creature.
     */
    function forceWeaponHitImpl(defender: Creature, theItem: Item): boolean {
        let autoID = false;
        let knowFirstMonsterDied = false;

        // Get monster name
        const monstName = (defender === player)
            ? "you"
            : `the ${defender.info.monsterName}`;

        const oldLoc = { ...defender.loc };

        // Push direction: from player through defender (clamped to unit step)
        const dx = clamp(defender.loc.x - player.loc.x, -1, 1);
        const dy = clamp(defender.loc.y - player.loc.y, -1, 1);
        const newLoc = { x: defender.loc.x + dx, y: defender.loc.y + dy };

        // Announce the launch if visible and the path is clear
        const canSeeDef = !!(pmap[defender.loc.x]?.[defender.loc.y]?.flags & TileFlag.VISIBLE);
        if (canSeeDef
            && coordinatesAreInMap(newLoc.x, newLoc.y)
            && !cellHasTerrainFlagAt(newLoc, TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION)
            && !(pmap[newLoc.x]?.[newLoc.y]?.flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER))) {
            msgOps.combatMessage(
                `you launch ${monstName} backward with the force of your blow`,
                messageColorFromVictimImpl(defender),
            );
            autoID = true;
        }

        // Simulate blinking bolt push.
        // In C: theBolt.magnitude = max(1, netEnchant(theItem) / FP_FACTOR)
        //        blinkDistance = magnitude * 2 + 1
        const enchant = netEnchantFn(theItem, rogue.strength, player.status[StatusEffect.Weakened]);
        const magnitude = Math.max(1, Number(enchant / FP_FACTOR));
        const blinkDistance = magnitude * 2 + 1;

        // Walk the defender along the push direction
        let pushLoc = { ...defender.loc };
        for (let i = 0; i < blinkDistance; i++) {
            const testX = pushLoc.x + dx;
            const testY = pushLoc.y + dy;
            if (!coordinatesAreInMap(testX, testY)) break;
            if (cellHasTerrainFlagAt({ x: testX, y: testY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) break;
            if (pmap[testX][testY].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) break;
            pushLoc = { x: testX, y: testY };
        }

        // Move the defender to the farthest open cell
        if (pushLoc.x !== defender.loc.x || pushLoc.y !== defender.loc.y) {
            pmap[defender.loc.x][defender.loc.y].flags &= ~TileFlag.HAS_MONSTER;
            {
                const { glyph, foreColor, backColor } = getCellAppearance(defender.loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(defender.loc.x), windowY: mapToWindowY(defender.loc.y) }, foreColor, backColor, displayBuffer);
            }
            defender.loc = pushLoc;
            pmap[defender.loc.x][defender.loc.y].flags |= TileFlag.HAS_MONSTER;
            {
                const { glyph, foreColor, backColor } = getCellAppearance(defender.loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(defender.loc.x), windowY: mapToWindowY(defender.loc.y) }, foreColor, backColor, displayBuffer);
            }
        }

        // Impact check — defender was stopped short of full distance
        if (!(defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)
            && distanceBetween(oldLoc, defender.loc) > 0
            && distanceBetween(oldLoc, defender.loc) < weaponForceDistanceFn(enchant)) {

            const impactLoc = { x: defender.loc.x + dx, y: defender.loc.y + dy };

            let otherMonster: Creature | null = null;
            let impactDesc: string;

            if (coordinatesAreInMap(impactLoc.x, impactLoc.y)
                && (pmap[impactLoc.x][impactLoc.y].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER))) {
                otherMonster = monsterAtLocFn(impactLoc);
                if (otherMonster) {
                    impactDesc = (otherMonster === player)
                        ? "you"
                        : `the ${otherMonster.info.monsterName}`;
                } else {
                    impactDesc = "something";
                }
            } else {
                otherMonster = null;
                if (coordinatesAreInMap(impactLoc.x, impactLoc.y)) {
                    const layer = highestPriorityLayer(pmap, impactLoc.x, impactLoc.y, true);
                    const tileType = pmap[impactLoc.x][impactLoc.y].layers[layer];
                    impactDesc = tileCatalog[tileType]?.description ?? "a wall";
                } else {
                    impactDesc = "a wall";
                }
            }

            const forceDamage = distanceBetween(oldLoc, defender.loc);

            // Apply impact damage to defender
            if (!(defender.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE))
                && inflictDamageFn(null, defender, forceDamage, Colors.white, false, buildCombatDamageContext())) {

                if (!!(pmap[defender.loc.x]?.[defender.loc.y]?.flags & TileFlag.VISIBLE)) {
                    knowFirstMonsterDied = true;
                    const deathVerb = (defender.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "is destroyed" : "dies";
                    msgOps.combatMessage(
                        `${monstName} ${deathVerb} on impact with ${impactDesc}`,
                        messageColorFromVictimImpl(defender),
                    );
                    autoID = true;
                }
                killCreatureFn(defender, false, buildCombatDamageContext());
            } else {
                if (!!(pmap[defender.loc.x]?.[defender.loc.y]?.flags & TileFlag.VISIBLE)) {
                    msgOps.combatMessage(
                        `${monstName} slams against ${impactDesc}`,
                        messageColorFromVictimImpl(defender),
                    );
                    autoID = true;
                }
            }

            moralAttackFn(player, defender, buildAttackContext());
            splitMonsterFn(defender, player, buildCombatHelperContext());

            // Collateral damage to the creature at impact location
            if (otherMonster
                && !(otherMonster.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE))) {

                if (inflictDamageFn(null, otherMonster, forceDamage, Colors.white, false, buildCombatDamageContext())) {
                    if (!!(pmap[otherMonster.loc.x]?.[otherMonster.loc.y]?.flags & TileFlag.VISIBLE)) {
                        const otherDeathVerb = (otherMonster.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ? "is destroyed" : "dies";
                        const alsoStr = knowFirstMonsterDied ? "also " : "";
                        msgOps.combatMessage(
                            `${impactDesc} ${alsoStr}${otherDeathVerb} when ${monstName} slams into them`,
                            messageColorFromVictimImpl(otherMonster),
                        );
                        autoID = true;
                    }
                    killCreatureFn(otherMonster, false, buildCombatDamageContext());
                }
                if (otherMonster.creatureState !== CreatureState.Ally) {
                    // Allies won't defect if you throw another monster at them
                    moralAttackFn(player, otherMonster, buildAttackContext());
                    splitMonsterFn(otherMonster, player, buildCombatHelperContext());
                }
            }
        }
        return autoID;
    }

    /**
     * Port of the stealing logic from C specialHit (Combat.c:426-479).
     * Called when a monster with MA_HIT_STEAL_FLEE successfully hits the player.
     * Picks a random non-equipped pack item, takes it, and flees.
     */
    function monsterStealsFromPlayerImpl(attacker: Creature): void {
        // Count non-equipped items in the player's pack
        const itemCandidates = numberOfMatchingPackItemsFn(
            packItems, ALL_ITEMS, 0, ItemFlag.ITEM_EQUIPPED,
        );
        if (!itemCandidates) return;

        // Pick a random non-equipped item
        let randItemIndex = randRange(1, itemCandidates);
        let theItem: Item | null = null;
        for (const item of packItems) {
            if (!(item.flags & ItemFlag.ITEM_EQUIPPED)) {
                if (randItemIndex === 1) {
                    theItem = item;
                    break;
                }
                randItemIndex--;
            }
        }
        if (!theItem) return;

        // Calculate stolen quantity: weapons steal half a stack, others steal 1
        let stolenQuantity: number;
        if (theItem.category & ItemCategory.WEAPON) {
            stolenQuantity = theItem.quantity > 3
                ? Math.floor((theItem.quantity + 1) / 2)
                : theItem.quantity;
        } else {
            stolenQuantity = 1;
        }

        if (stolenQuantity < theItem.quantity) {
            // Peel off stolen items from the stack (create a clone)
            const stolen: Item = { ...theItem };
            theItem.quantity -= stolenQuantity;
            stolen.quantity = stolenQuantity;
            theItem = stolen;
        } else {
            // Remove the whole item from pack
            if (rogue.swappedIn === theItem || rogue.swappedOut === theItem) {
                rogue.swappedIn = null;
                rogue.swappedOut = null;
            }
            removeItemFromArray(theItem, packItems);
        }

        // Give item to attacker and set it to flee
        theItem.flags &= ~ItemFlag.ITEM_PLAYER_AVOIDS;
        attacker.carriedItem = theItem;
        attacker.creatureMode = CreatureMode.PermFleeing;
        attacker.creatureState = CreatureState.Fleeing;

        // Display theft message
        const monstName = `the ${attacker.info.monsterName}`;
        const itemDisplayName = getItemName(theItem, false, true);
        msgOps.messageWithColor(
            `${monstName} stole ${itemDisplayName}!`,
            Colors.badMessageColor,
            0,
        );
        rogue.autoPlayingLevel = false;
    }

    /**
     * Port of C teleport (Monsters.c:1146).
     * Teleports a creature to a destination, or to a random location if no
     * valid destination is provided.
     */
    function teleportImpl(monst: Creature, destination: Pos, respectTerrainAvoidancePreferences: boolean): void {
        let dest = { ...destination };

        if (!isPosInMap(dest)) {
            // Build FOV mask from monster's current position
            const monstFOV = allocGrid();
            fillGrid(monstFOV, 0);
            const fovCtx = {
                cellHasTerrainFlag: cellHasTerrainFlagAt,
                getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
            };
            getFOVMaskFn(
                monstFOV, monst.loc.x, monst.loc.y,
                BigInt(DCOLS) * FP_FACTOR,
                TerrainFlag.T_OBSTRUCTS_VISION, 0, false, fovCtx,
            );

            // Calculate distances from monster's location
            const grid = allocGrid();
            fillGrid(grid, 0);
            const forbiddenFlags = forbiddenFlagsForMonsterFn(monst.info);
            calculateDistancesWrapped(
                grid, monst.loc.x, monst.loc.y,
                forbiddenFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY,
                null, false, true,
            );

            // Keep cells at moderate distance (>= DCOLS/2), set others to 0
            findReplaceGrid(grid, -30000, Math.floor(DCOLS / 2), 0);
            findReplaceGrid(grid, 2, 30000, 1);

            if (validLocationCount(grid, 1) < 1) {
                fillGrid(grid, 1);
            }

            // Apply terrain preferences
            const avoidedFlags = respectTerrainAvoidancePreferences
                ? avoidedFlagsForMonsterFn(monst.info)
                : forbiddenFlags;

            // Zero out cells with forbidden/avoided terrain or special flags
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    const tFlags = terrainFlagsAt({ x: i, y: j });
                    const cFlags = pmap[i]?.[j]?.flags ?? 0;
                    if ((tFlags & avoidedFlags)
                        || (cFlags & (IS_IN_MACHINE | TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS))) {
                        grid[i][j] = 0;
                    }
                }
            }

            // Exclude cells visible from monster's current location
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (monstFOV[i][j]) {
                        grid[i][j] = 0;
                    }
                }
            }

            dest = randomLocationInGrid(grid, 1);
            freeGrid(grid);
            freeGrid(monstFOV);

            if (!isPosInMap(dest)) {
                return; // No valid location found
            }
        }

        // Disentangle (C: disentangle, Monsters.c:1138)
        if (monst === player && monst.status[StatusEffect.Stuck]) {
            msgOps.message("you break free!", 0);
        }
        monst.status[StatusEffect.Stuck] = 0;

        // Move creature
        pmap[monst.loc.x][monst.loc.y].flags &= ~(monst === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER);
        {
            const { glyph, foreColor, backColor } = getCellAppearance(monst.loc);
            plotCharWithColor(glyph, { windowX: mapToWindowX(monst.loc.x), windowY: mapToWindowY(monst.loc.y) }, foreColor, backColor, displayBuffer);
        }
        monst.loc = dest;
        pmap[monst.loc.x][monst.loc.y].flags |= (monst === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER);
        {
            const { glyph, foreColor, backColor } = getCellAppearance(monst.loc);
            plotCharWithColor(glyph, { windowX: mapToWindowX(monst.loc.x), windowY: mapToWindowY(monst.loc.y) }, foreColor, backColor, displayBuffer);
        }

        // Non-player: reset to wandering
        if (monst !== player) {
            monst.creatureState = CreatureState.Wandering;
        }
    }

    /**
     * Simplified runtime spawnDungeonFeature. Handles single-tile placement
     * and gas volume. Full propagation/blocking deferred.
     */
    function spawnDungeonFeatureRuntime(x: number, y: number, featureIndex: number, _probability: number, _isGas: boolean): void {
        if (featureIndex <= 0 || featureIndex >= dungeonFeatureCatalog.length) return;
        const feat = dungeonFeatureCatalog[featureIndex];
        if (!feat) return;

        if (feat.tile) {
            if (feat.layer === DungeonLayer.Gas) {
                pmap[x][y].volume += feat.startProbability;
            }
            pmap[x][y].layers[feat.layer] = feat.tile;
        }

        // Refresh the cell
        if (coordinatesAreInMap(x, y)) {
            const { glyph, foreColor, backColor } = getCellAppearance({ x, y });
            plotCharWithColor(glyph, { windowX: mapToWindowX(x), windowY: mapToWindowY(y) }, foreColor, backColor, displayBuffer);
        }
    }

    /**
     * Runtime spawnDungeonFeature that accepts a DungeonFeature object directly.
     * Used by promoteTile and EnvironmentContext.
     */
    function spawnDungeonFeatureFromObject(x: number, y: number, feat: DungeonFeature, _isVolatile: boolean, _overrideProtection: boolean): void {
        if (!feat) return;

        if (feat.tile) {
            if (feat.layer === DungeonLayer.Gas) {
                pmap[x][y].volume += feat.startProbability;
            }
            pmap[x][y].layers[feat.layer] = feat.tile;
        }

        // Handle subsequent DFs
        if (feat.subsequentDF && feat.subsequentDF < dungeonFeatureCatalog.length) {
            spawnDungeonFeatureFromObject(x, y, dungeonFeatureCatalog[feat.subsequentDF], _isVolatile, _overrideProtection);
        }

        // Refresh the cell
        if (coordinatesAreInMap(x, y)) {
            const { glyph, foreColor, backColor } = getCellAppearance({ x, y });
            plotCharWithColor(glyph, { windowX: mapToWindowX(x), windowY: mapToWindowY(y) }, foreColor, backColor, displayBuffer);
        }
    }

    // =========================================================================
    // Shared cell refresh helper
    // =========================================================================

    /** Refresh a single dungeon cell on screen (appearance → plot). */
    function refreshDungeonCellRuntime(loc: Pos): void {
        const { glyph, foreColor, backColor } = getCellAppearance(loc);
        plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
    }

    /** Check whether the player can see or sense a cell. */
    function playerCanSeeOrSenseRuntime(x: number, y: number): boolean {
        return !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.TELEPATHIC_VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE));
    }

    // =========================================================================
    // Phase 3 helpers: getTerrainGrid, getRandomMonsterSpawnLocation,
    //                  buildSafetyMapsContext, updateFloorItemsImpl,
    //                  assureCosmeticRNG / restoreRNG
    // =========================================================================

    /**
     * getTerrainGrid — fills grid locations with `value` if they match terrain or map flags.
     * Ported from Grid.c:161.
     */
    function getTerrainGrid(grid: number[][], value: number, tFlags: number, mapFlags: number): void {
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (grid[i][j] !== value && (cellHasTerrainFlag(pmap, { x: i, y: j }, tFlags) || (pmap[i][j].flags & mapFlags))) {
                    grid[i][j] = value;
                }
            }
        }
    }

    /**
     * getRandomMonsterSpawnLocation — finds a random location far from the player.
     * Ported from Monsters.c:1086.
     */
    function getRandomMonsterSpawnLocationImpl(): Pos | null {
        const grid = allocGrid();
        fillGrid(grid, 0);
        calculateDistancesFn(grid, player.loc.x, player.loc.y, T_DIVIDES_LEVEL, null, true, true, buildCalcDistCtx());
        getTerrainGrid(grid, 0, T_PATHING_BLOCKER | T_HARMFUL_TERRAIN, TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS | TileFlag.IN_FIELD_OF_VIEW);
        findReplaceGrid(grid, -30000, Math.floor(DCOLS / 2) - 1, 0);
        findReplaceGrid(grid, 30000, 30000, 0);
        findReplaceGrid(grid, Math.floor(DCOLS / 2), 30000 - 1, 1);
        let loc = randomLocationInGrid(grid, 1);
        if (loc.x < 0 || loc.y < 0) {
            fillGrid(grid, 1);
            getTerrainGrid(grid, 0, T_PATHING_BLOCKER | T_HARMFUL_TERRAIN, TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS | TileFlag.IN_FIELD_OF_VIEW | IS_IN_MACHINE);
            loc = randomLocationInGrid(grid, 1);
        }
        freeGrid(grid);
        if (loc.x < 0 || loc.y < 0) {
            return null;
        }
        return loc;
    }

    /**
     * Build a SafetyMapsContext for updateSafetyMap / updateClairvoyance / updateVision.
     */
    function buildSafetyMapsContext(): SafetyMapsContext {
        return {
            player,
            rogue: {
                get clairvoyance() { return rogue.clairvoyance; },
                get depthLevel() { return rogue.depthLevel; },
                get updatedSafetyMapThisTurn() { return rogue.updatedSafetyMapThisTurn; },
                set updatedSafetyMapThisTurn(v) { rogue.updatedSafetyMapThisTurn = v; },
                get updatedAllySafetyMapThisTurn() { return rogue.updatedAllySafetyMapThisTurn; },
                set updatedAllySafetyMapThisTurn(v) { rogue.updatedAllySafetyMapThisTurn = v; },
                get updatedMapToSafeTerrainThisTurn() { return rogue.updatedMapToSafeTerrainThisTurn; },
                set updatedMapToSafeTerrainThisTurn(v) { rogue.updatedMapToSafeTerrainThisTurn = v; },
                get mapToSafeTerrain() { return rogue.mapToSafeTerrain; },
                get upLoc() { return rogue.upLoc; },
                get downLoc() { return rogue.downLoc; },
            },
            monsters,
            dormantMonsters,
            pmap,
            tileCatalog,
            safetyMap: safetyMap ?? allocGrid(),
            allySafetyMap: allySafetyMap ?? allocGrid(),
            DCOLS,
            DROWS,
            FP_FACTOR: Number(FP_FACTOR),
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            coordinatesAreInMap,
            pmapAt: (loc: Pos) => pmap[loc.x][loc.y],
            discoveredTerrainFlagsAtLoc: discoveredTerrainFlagsAtLocFn,
            monsterAtLoc: monsterAtLocFn,
            monstersAreEnemies: (m1, m2) => monstersAreEnemiesFn(m1, m2, player, cellHasTerrainFlagAt),
            monsterRevealed(monst) {
                return !!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED);
            },
            zeroOutGrid(grid: number[][]) {
                // Ensure grid has proper dimensions, then zero it out
                if (grid.length === 0) {
                    for (let i = 0; i < DCOLS; i++) {
                        grid[i] = new Array(DROWS).fill(0);
                    }
                } else {
                    fillGrid(grid, 0);
                }
            },
            getFOVMask(grid, x, y, radius, obstructionFlags, extraFlags, omniscient) {
                getFOVMaskWrapped(grid, x, y, BigInt(radius), obstructionFlags, extraFlags, omniscient);
            },
            updateLighting() {
                // Simplified — full lighting update deferred
            },
            updateFieldOfViewDisplay(_newlyVisible, _refreshDisplay) {
                displayLevelFn();
                commitDraws();
            },
            discoverCell(x, y) {
                if (coordinatesAreInMap(x, y)) {
                    pmap[x][y].flags |= TileFlag.DISCOVERED;
                }
            },
            refreshDungeonCell(loc) {
                refreshDungeonCellRuntime(loc);
            },
            allocGrid,
            freeGrid,
            dijkstraScan: dijkstraScanFn,
            max: Math.max,
            min: Math.min,
            floorItems,
        };
    }

    /**
     * assureCosmeticRNG / restoreRNG — RNG stream switching.
     * Saves the current RNG mode and switches to cosmetic RNG.
     */
    let _savedRNG = 0;
    function assureCosmeticRNGImpl(): void {
        _savedRNG = rogue.RNG;
        rogue.RNG = RNG_COSMETIC;
    }
    function restoreRNGImpl(): void {
        rogue.RNG = _savedRNG;
    }

    /**
     * updateFloorItemsImpl — handles floor item decay, fire damage, drift, and
     * tile promotion on item presence.
     * Ported from Items.c:1192.
     */
    function updateFloorItemsImpl(): void {
        for (let idx = floorItems.length - 1; idx >= 0; idx--) {
            const theItem = floorItems[idx];
            const x = theItem.loc.x;
            const y = theItem.loc.y;

            if (rogue.absoluteTurnNumber < theItem.spawnTurnNumber) {
                // Item fell from a higher level — don't touch it yet
                continue;
            }

            // Auto-descent (chasms, pits)
            if (cellHasTerrainFlagAt({ x, y }, TerrainFlag.T_AUTO_DESCENT)) {
                if (playerCanSeeOrSenseRuntime(x, y)) {
                    const buf = getItemName(theItem, false, false);
                    msgOps.messageWithColor(
                        `the ${buf} plunge${theItem.quantity > 1 ? "" : "s"} out of sight!`,
                        Colors.itemMessageColor, 0,
                    );
                }
                if (pmap[x]?.[y]?.flags & TileFlag.VISIBLE) {
                    if (coordinatesAreInMap(x, y)) {
                        pmap[x][y].flags |= TileFlag.DISCOVERED;
                    }
                }
                theItem.flags |= ItemFlag.ITEM_PREPLACED;

                // Remove from floor items
                removeItemFromArray(theItem, floorItems);
                pmap[x][y].flags &= ~(TileFlag.HAS_ITEM | TileFlag.ITEM_DETECTED);

                if ((theItem.category & ItemCategory.POTION) || rogue.depthLevel === gameConst.deepestLevel) {
                    // Potions don't survive the fall; at deepest level, items are lost
                    // (deleteItem is a no-op in our system — just removing from array is enough)
                } else {
                    // Add to next level's item chain
                    theItem.spawnTurnNumber = rogue.absoluteTurnNumber;
                    if (levels[rogue.depthLevel - 1 + 1]) {
                        if (!levels[rogue.depthLevel - 1 + 1].items) {
                            levels[rogue.depthLevel - 1 + 1].items = [];
                        }
                        (levels[rogue.depthLevel - 1 + 1].items as Item[]).push(theItem);
                    }
                }
                refreshDungeonCellRuntime({ x, y });
                continue;
            }

            // Fire / lava destroying flammable items
            if ((cellHasTerrainFlagAt({ x, y }, TerrainFlag.T_IS_FIRE) && (theItem.flags & ItemFlag.ITEM_FLAMMABLE))
                || (cellHasTerrainFlagAt({ x, y }, TerrainFlag.T_LAVA_INSTA_DEATH) && !(theItem.category & ItemCategory.AMULET))) {
                burnItemImpl(theItem);
                continue;
            }

            // Items drifting in water/wind (T_MOVES_ITEMS)
            if (cellHasTerrainFlagAt({ x, y }, T_MOVES_ITEMS)) {
                // Simplified drift: find adjacent cell without item/obstruction
                let driftLoc: Pos | null = null;
                for (const [dx, dy] of nbDirs) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (coordinatesAreInMap(nx, ny)
                        && !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_ITEMS | TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                        && !(pmap[nx][ny].flags & TileFlag.HAS_ITEM)) {
                        driftLoc = { x: nx, y: ny };
                        break;
                    }
                }
                if (driftLoc && distanceBetween({ x, y }, driftLoc) === 1) {
                    // Move item
                    pmap[x][y].flags &= ~TileFlag.HAS_ITEM;
                    pmap[driftLoc.x][driftLoc.y].flags |= TileFlag.HAS_ITEM;
                    if (pmap[x][y].flags & TileFlag.ITEM_DETECTED) {
                        pmap[x][y].flags &= ~TileFlag.ITEM_DETECTED;
                        pmap[driftLoc.x][driftLoc.y].flags |= TileFlag.ITEM_DETECTED;
                    }
                    theItem.loc = driftLoc;
                    refreshDungeonCellRuntime({ x, y });
                    refreshDungeonCellRuntime(driftLoc);
                    continue;
                }
            }

            // Tile promotion on item presence
            if (cellHasTMFlagAt({ x, y }, TerrainMechFlag.TM_PROMOTES_ON_ITEM)) {
                for (let layer = 0; layer < 3 /* NUMBER_TERRAIN_LAYERS */; layer++) {
                    if (tileCatalog[pmap[x][y].layers[layer]]?.mechFlags & TerrainMechFlag.TM_PROMOTES_ON_ITEM) {
                        promoteTileImpl(x, y, layer, false);
                    }
                }
                continue;
            }

            // Auto-identify items in player's machine
            if (pmap[x][y].machineNumber
                && pmap[x][y].machineNumber === pmap[player.loc.x]?.[player.loc.y]?.machineNumber
                && (theItem.flags & ItemFlag.ITEM_KIND_AUTO_ID)) {
                identifyItemKindFn(theItem, gameConst);
            }
        }
    }

    /**
     * burnItem helper — burns an item using the real burnItem function
     * with a minimal CreatureEffectsContext.
     */
    function burnItemImpl(theItem: Item): void {
        burnItemFn(theItem, buildCreatureEffectsContext() as any);
    }

    /**
     * anyoneWantABite implementation — checks if any ally wants to absorb decedent.
     */
    function anyoneWantABiteImpl(decedent: Creature): boolean {
        try {
            return anyoneWantABiteFn(decedent, buildCombatHelperContext());
        } catch {
            return false;
        }
    }

    /**
     * Build a CombatDamageContext for killCreature and inflictDamage calls
     * outside the attack() path.
     */
    function buildCombatDamageContext(): CombatDamageContext {
        return {
            player,
            easyMode: rogue.mode === GameMode.Easy,
            transference: rogue.transference,
            playerTransferenceRatio: gameConst.playerTransferenceRatio,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            canDirectlySeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            wakeUp(monst) { alertMonster(monst, player); },
            spawnDungeonFeature: spawnDungeonFeatureRuntime,
            refreshSideBar() { refreshSideBarRuntime(-1, -1, false); },
            combatMessage: msgOps.combatMessage,
            messageWithColor(text, color) { msgOps.messageWithColor(text, color, 0); },
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            gameOver(message) { doGameOver(message, false); },
            setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },
            deleteItem(_item) { /* GC handles cleanup */ },
            makeMonsterDropItem: makeMonsterDropItemImpl,
            clearLastTarget(monst) {
                if (rogue.lastTarget === monst) rogue.lastTarget = null;
            },
            clearYendorWarden(monst) {
                if (rogue.yendorWarden === monst) rogue.yendorWarden = null;
            },
            clearCellMonsterFlag(loc, isDormant) {
                if (!isDormant) {
                    pmap[loc.x][loc.y].flags &= ~TileFlag.HAS_MONSTER;
                }
            },
            prependCreature(monst) {
                if (!monsters.includes(monst)) {
                    monsters.unshift(monst);
                }
            },
            applyInstantTileEffectsToCreature(monst) {
                applyInstantTileEffectsFn(monst, buildCreatureEffectsContext());
            },
            fadeInMonster: fadeInMonsterImpl,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            anyoneWantABite: anyoneWantABiteImpl,
            demoteMonsterFromLeadership: demoteMonsterFromLeadershipImpl,
            checkForContinuedLeadership: checkForContinuedLeadershipImpl,
            getMonsterDFMessage(monsterID) {
                return monsterText[monsterID]?.DFMessage ?? "";
            },
            resolvePronounEscapes(text, _monst) { return text; },
            message: msgOps.message,
            monsterCatalog,
            updateEncumbrance() {
                const ctx = buildFullEquipContext();
                updateEncumbranceFn(ctx.state);
                syncFullEquipState(ctx);
            },
            updateMinersLightRadius() { updateMinersLightRadiusFn(rogue as any, player); },
            updateVision() { updateVisionFn(true); },
            badMessageColor: Colors.badMessageColor,
            poisonColor: Colors.poisonColor,
        };
    }

    /**
     * Shared killCreature implementation using real function + full CombatDamageContext.
     */
    function killCreatureImpl(decedent: Creature, administrativeDeath: boolean): void {
        killCreatureFn(decedent, administrativeDeath, buildCombatDamageContext());
    }

    /**
     * Shared inflictDamage implementation using real function + full CombatDamageContext.
     */
    function inflictDamageImpl(attacker: Creature | null, defender: Creature, damage: number, flashColor: Color | null, ignoresProtectionShield: boolean): boolean {
        return inflictDamageFn(attacker, defender, damage, flashColor, ignoresProtectionShield, buildCombatDamageContext());
    }

    /**
     * Build a CombatHelperContext for splitMonster and anyoneWantABite.
     */
    function buildCombatHelperContext(): CombatHelperContext {
        return {
            player,
            weapon: rogue.weapon,
            armor: rogue.armor,
            playerStrength: rogue.strength,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            canDirectlySeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            monstersAreTeammates: () => false,
            monsterAvoids: monsterAvoidsWrapped,
            monsterIsInClass: (monst, mc) => monsterIsInClass(monst, mc),
            monsterAtLoc: monsterAtLocFn,
            cellHasMonsterOrPlayer(loc) {
                return !!(pmap[loc.x]?.[loc.y]?.flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER));
            },
            isPosInMap(loc) {
                return coordinatesAreInMap(loc.x, loc.y);
            },
            message: msgOps.message,
            combatMessage: msgOps.combatMessage,
            cloneMonster(monst, announce, placeClone) {
                return cloneMonsterImpl(monst, announce, placeClone);
            },
            fadeInMonster: fadeInMonsterImpl,
            refreshSideBar() { refreshSideBarRuntime(-1, -1, false); },
            setCellMonsterFlag(loc, hasMonster) {
                if (hasMonster) {
                    pmap[loc.x][loc.y].flags |= TileFlag.HAS_MONSTER;
                } else {
                    pmap[loc.x][loc.y].flags &= ~TileFlag.HAS_MONSTER;
                }
            },
            randRange,
            monsterCatalog,
            monsterClassCatalog,
            cautiousMode: rogue.cautiousMode,
            setCautiousMode(val) { rogue.cautiousMode = val; },
            updateIdentifiableItems() {
                updateIdentifiableItemsFn({
                    packItems,
                    floorItems,
                    updateIdentifiableItem(theItem: Item) {
                        // Simplified auto-identification
                        theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
                    },
                });
            },
            messageWithColor(text, color) { msgOps.messageWithColor(text, color, 0); },
            itemName: (item: Item) => getItemName(item, false, false),
            itemMessageColor: Colors.itemMessageColor,
            featRecord: rogue.featRecord ?? [],
            FEAT_PALADIN: 0, // Feat index — deferred
            iterateAllies() {
                return monsters.filter(m => m.creatureState === CreatureState.Ally);
            },
            iterateAllMonsters() {
                return [...monsters];
            },
            depthLevel: rogue.depthLevel,
            deepestLevel: gameConst.deepestLevel,
        };
    }

    /**
     * promoteTile implementation using the real promoteTile function.
     * Ported from promoteTile() in Time.c:1101.
     */
    function promoteTileImpl(x: number, y: number, layer: number, useFireDF: boolean): void {
        promoteTileFn(x, y, layer as DungeonLayer, useFireDF, buildEnvironmentContext());
    }

    /**
     * Shared search helper — delegates to the real search function.
     */
    function searchRuntime(searchStrength: number): boolean {
        return searchFn(searchStrength, {
            pmap,
            player,
            rogue: { playbackOmniscience: rogue.playbackOmniscience ?? false },
            tileCatalog: tileCatalog as any,
            initializeItem: () => initializeItemFn(),
            itemName: (theItem, buf, includeDetails, includeArticle, _maxLen) => {
                buf[0] = itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },
            describeHallucinatedItem: (buf) => { buf[0] = "something strange"; },
            removeItemFromChain: (theItem, chain) => {
                const idx = chain.indexOf(theItem);
                if (idx >= 0) { chain.splice(idx, 1); return true; }
                return false;
            },
            deleteItem: (_theItem) => { /* GC handles */ },
            monsterAtLoc: monsterAtLocFn,
            promoteTile: promoteTileImpl,
            messageWithColor: msgOps.messageWithColor,
            itemMessageColor: Colors.itemMessageColor,
            packItems,
            floorItems,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            coordinatesAreInMap,
            playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            distanceBetween,
            discover(x, y) {
                if (coordinatesAreInMap(x, y)) {
                    pmap[x][y].flags |= TileFlag.DISCOVERED;
                }
            },
            randPercent,
            posEq: (a, b) => a.x === b.x && a.y === b.y,
        });
    }

    /**
     * Build a LightingContext for flare animation and light painting.
     */
    function buildLightingContext(): LightingContext {
        return {
            tmap,
            pmap,
            displayDetail,
            player,
            rogue: rogue as any,
            monsters,
            dormantMonsters,
            lightCatalog: lightCatalogData,
            tileCatalog: tileCatalog as any,
            mutationCatalog,
            monsterRevealed: (monst) => {
                if (monst.status[StatusEffect.Telepathic]) return true;
                if (monst.status[StatusEffect.Entranced]) return true;
                return false;
            },
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            getCellFlags: (x, y) => pmap[x]?.[y]?.flags ?? 0,
        };
    }

    /**
     * Build a minimal EnvironmentContext for promoteTile and updateEnvironment.
     */
    function buildEnvironmentContext(): EnvironmentContext {
        return {
            player,
            rogue,
            monsters,
            pmap,
            levels,
            tileCatalog,
            dungeonFeatureCatalog,
            DCOLS,
            DROWS,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            coordinatesAreInMap,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            spawnDungeonFeature: spawnDungeonFeatureFromObject,
            monstersFall() { monstersFallFn(buildCreatureEffectsContext()); },
            updateFloorItems() { updateFloorItemsImpl(); },
            monstersTurn(monst) {
                // Simplified: tick the monster forward (full AI deferred)
                monst.ticksUntilTurn = monst.movementSpeed || 100;
            },
            keyOnTileAt: (loc: Pos) => itemAtLocFn(loc, floorItems),
            removeCreature(list, monst) {
                const idx = list.indexOf(monst);
                if (idx >= 0) { list.splice(idx, 1); return true; }
                return false;
            },
            prependCreature(list, monst) {
                list.unshift(monst);
            },
            rand_range: randRange,
            rand_percent: randPercent,
            max: Math.max,
            min: Math.min,
            fillSequentialList(list, length) {
                for (let i = 0; i < length; i++) list[i] = i;
            },
            shuffleList(list, _length) {
                for (let i = list.length - 1; i > 0; i--) {
                    const j = randRange(0, i);
                    [list[i], list[j]] = [list[j], list[i]];
                }
            },
            exposeTileToFire(x, y, alwaysIgnite) { return exposeTileToFireFn(x, y, alwaysIgnite, buildEnvironmentContext()); },
        };
    }

    /**
     * Build an AllyManagementContext for freeCaptive.
     */
    function buildAllyManagementContext(): AllyManagementContext {
        return {
            player,
            pmap,
            demoteMonsterFromLeadership: demoteMonsterFromLeadershipImpl,
            makeMonsterDropItem: makeMonsterDropItemImpl,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            message: msgOps.message,
            monsterAtLoc: monsterAtLocFn,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
        };
    }

    /**
     * Build CreatureEffectsContext for applyInstantTileEffectsToCreature,
     * monstersFall, playerFalls, decrementPlayerStatus, etc.
     */
    function buildCreatureEffectsContext(): CreatureEffectsContext {
        return {
            player,
            rogue,
            monsters,
            pmap,
            tmap,
            levels,
            gameConst,
            tileCatalog,
            dungeonFeatureCatalog,
            packItems,
            floorItems,
            DCOLS,
            DROWS,
            INVALID_POS,

            // Map helpers
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasTMFlag: cellHasTMFlagAt,
            terrainFlags: terrainFlagsAt,
            pmapAt,
            coordinatesAreInMap,
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.TELEPATHIC_VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE)),

            // Monster helpers
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            canDirectlySeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterName(buf, monst, includeArticle) {
                if (monst === player) {
                    buf[0] = "you";
                } else {
                    const article = includeArticle
                        ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                        : "";
                    buf[0] = `${article}${monst.info.monsterName}`;
                }
            },
            monsterAtLoc: monsterAtLocFn,
            monstersAreEnemies: (_m1, _m2) => true, // Simplified — full version checks ally state
            monsterIsInClass: (monst, mc) => monsterIsInClass(monst, monsterClassCatalog[mc as number]),
            removeCreature(list, monst) {
                const idx = list.indexOf(monst);
                if (idx >= 0) { list.splice(idx, 1); return true; }
                return false;
            },
            prependCreature(list, monst) {
                list.unshift(monst);
            },
            demoteMonsterFromLeadership: demoteMonsterFromLeadershipImpl,

            // Item helpers
            itemName(theItem, buf, includeDetails, includeArticle, _maxLen) {
                buf[0] = itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },
            numberOfMatchingPackItems: (category, kind, flags, _checkCarried) =>
                numberOfMatchingPackItemsFn(packItems, category, kind, flags),
            autoIdentify: (theItem: Item) => identify(theItem, gameConst),
            removeItemFromChain(theItem, chain) {
                const idx = chain.indexOf(theItem);
                if (idx >= 0) chain.splice(idx, 1);
            },
            deleteItem(_theItem) { /* GC handles cleanup */ },
            dropItem(theItem) {
                // C: dropItem() in Items.c:7652
                // Check if terrain obstructs items at player's location
                if (cellHasTerrainFlagAt(player.loc, TerrainFlag.T_OBSTRUCTS_ITEMS)) {
                    return null;
                }

                if (theItem.quantity > 1 && !(theItem.category & (ItemCategory.WEAPON | ItemCategory.GEM))) {
                    // Peel off one copy from the stack
                    const clone = initializeItemFn();
                    Object.assign(clone, theItem);
                    theItem.quantity--;
                    clone.quantity = 1;
                    // Place the clone on the floor
                    clone.loc = { ...player.loc };
                    removeItemFromArray(clone, floorItems); // safety
                    floorItems.push(clone);
                    pmap[player.loc.x][player.loc.y].flags |= TileFlag.HAS_ITEM;
                    return clone;
                } else {
                    // Drop the entire item — remove from pack, place on floor
                    removeItemFromArray(theItem, packItems);
                    theItem.loc = { ...player.loc };
                    removeItemFromArray(theItem, floorItems); // safety
                    floorItems.push(theItem);
                    pmap[player.loc.x][player.loc.y].flags |= TileFlag.HAS_ITEM;
                    return theItem;
                }
            },
            eat(theItem, recordCommands) {
                eatFn(theItem, recordCommands, {
                    player,
                    packItems,
                    foodTable: foodTable as any,
                    itemMessageColor: Colors.itemMessageColor,
                    confirm: () => true, // forced eating always proceeds
                    messageWithColor: msgOps.messageWithColor,
                    removeItemFromChain(item: Item, chain: Item[]) {
                        const idx = chain.indexOf(item);
                        if (idx >= 0) chain.splice(idx, 1);
                    },
                    deleteItem() { /* GC handles cleanup */ },
                    recordKeystrokeSequence(keys: number[]) {
                        for (const k of keys) recordKeystrokeFn(k, false, false, recordingBuffer, rogue.playbackMode);
                    },
                } as unknown as ItemHandlerContext);
            },
            makeMonsterDropItem: makeMonsterDropItemImpl,

            // Combat helpers
            inflictDamage(attacker, defender, damage, flashColor, _showDamage) {
                return inflictDamageFn(attacker, defender, damage, flashColor, false, buildCombatDamageContext());
            },
            killCreature: killCreatureImpl,
            combatMessage: msgOps.combatMessage,
            messageColorFromVictim: () => Colors.white,
            addPoison(monst, totalDamage, concentrationIncrement) {
                addPoisonFn(monst, totalDamage, concentrationIncrement, buildCombatDamageContext());
            },
            flashMonster(monst, color, strength) {
                flashMonsterFn(monst, color, strength, buildCombatDamageContext());
            },

            // UI
            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            flavorMessage: msgOps.flavorMessage,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            gameOver(message, _showScore) { doGameOver(message, false); },
            flashMessage: msgOps.flashMessage,
            confirmMessages: msgOps.confirmMessages,
            displayLevel() { displayLevelFn(); commitDraws(); },

            // Colors
            goodMessageColor: Colors.goodMessageColor,
            badMessageColor: Colors.badMessageColor,
            itemMessageColor: Colors.itemMessageColor,
            fireForeColor: Colors.fireForeColor ?? Colors.orange,
            torchLightColor: Colors.torchLightColor ?? Colors.orange,
            minersLightColor: Colors.minersLightStartColor ?? Colors.white,
            white: Colors.white,
            brown: Colors.brown ?? Colors.orange,
            green: Colors.green,
            red: Colors.red,
            orange: Colors.orange,
            yellow: Colors.yellow,
            pink: Colors.pink ?? Colors.red,
            confusionGasColor: Colors.confusionGasColor ?? Colors.purple ?? Colors.yellow,
            darkRed: Colors.darkRed,
            darkGreen: Colors.darkGreen,

            // Environment
            updateVision(refreshDisplay) { updateVisionFn(refreshDisplay); },
            updateMinersLightRadius() { updateMinersLightRadiusFn(rogue as any, player); },
            spawnDungeonFeature: spawnDungeonFeatureFromObject,
            promoteTile: promoteTileImpl,
            exposeTileToFire(x, y, alwaysIgnite) { return exposeTileToFireFn(x, y, alwaysIgnite, buildEnvironmentContext()); },
            startLevel(previousDepth, stairDirection) {
                const levelCtx = buildLevelContext();
                startLevelFn(levelCtx, previousDepth, stairDirection);
                displayLevelFn();
                commitDraws();
            },
            teleport(monst, target, safe) { teleportImpl(monst, target, safe); },
            createFlare(x, y, flareType) { createFlareFn(x, y, flareType, rogue as any, lightCatalogData); },
            animateFlares(flares, _count) {
                animateFlaresFn(flares, buildLightingContext(), {
                    demoteVisibility: () => { /* simplified — full demoteVisibility needs FOV system */ },
                    updateFieldOfViewDisplay: (_updateDancing, _refreshDisplay) => { displayLevelFn(); commitDraws(); },
                    pauseAnimation: (ms) => browserConsole.pauseForMilliseconds(ms, { interruptForMouseMove: false }),
                });
            },
            spawnPeriodicHorde() { spawnPeriodicHordeFn(buildSpawnContext(), getRandomMonsterSpawnLocationImpl); },
            monstersFall() { monstersFallFn(buildCreatureEffectsContext()); },
            updateFloorItems() { updateFloorItemsImpl(); },
            synchronizePlayerTimeState() { synchronizePlayerTimeStateFn(buildCreatureEffectsContext() as any); },
            recalculateEquipmentBonuses() {
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
            updateEncumbrance() {
                const eqCtx = buildFullEquipContext();
                updateEncumbranceFn(eqCtx.state);
                syncFullEquipState(eqCtx);
            },
            playerInDarkness() { return playerInDarknessFn(tmap, player.loc); },
            playerTurnEnded() { playerTurnEndedFn(buildTurnProcessingContext()); },

            // Movement/search
            keyOnTileAt: (loc: Pos) => itemAtLocFn(loc, floorItems),
            useKeyAt(_theItem, _x, _y) { /* stub — key usage deferred */ },
            discover(x, y) {
                if (coordinatesAreInMap(x, y)) {
                    pmap[x][y].flags |= TileFlag.DISCOVERED;
                }
            },
            discoverCell(x, y) {
                if (coordinatesAreInMap(x, y)) {
                    pmap[x][y].flags |= TileFlag.DISCOVERED;
                }
            },
            search(searchStrength) { return searchRuntime(searchStrength); },
            recordKeystroke(key, shift, alt) {
                recordKeystrokeFn(key, shift, alt, recordingBuffer, rogue.playbackMode);
            },

            // Map query functions
            layerWithFlag: (x, y, flag) => layerWithFlagFn(pmap, x, y, flag),
            highestPriorityLayer: (x, y, skipGas) => highestPriorityLayer(pmap, x, y, skipGas),
            describeLocation(buf, x, y) {
                const layer = highestPriorityLayer(pmap, x, y, false);
                buf[0] = tileCatalog[pmap[x][y].layers[layer]].description;
            },
            tileFlavor(x, y) {
                const layer = highestPriorityLayer(pmap, x, y, false);
                return tileCatalog[pmap[x][y].layers[layer]].flavorText;
            },

            // Math
            rand_range: randRange,
            rand_percent: randPercent,
            randClumpedRange,
            max: Math.max,
            min: Math.min,

            // RNG control
            assureCosmeticRNG: assureCosmeticRNGImpl,
            restoreRNG: restoreRNGImpl,

            // Misc
            mapToWindowX,
            mapToWindowY,
            strLenWithoutEscapes,
            COLS,
            REQUIRE_ACKNOWLEDGMENT: MessageFlag.REQUIRE_ACKNOWLEDGMENT,
            HUNGER_THRESHOLD,
            WEAK_THRESHOLD,
            FAINT_THRESHOLD,
            ALL_ITEMS: 0xFFFF,
            AMULET: ItemCategory.AMULET,
            FOOD: ItemCategory.FOOD,
            FRUIT: 1, // FOOD kind 1
            ARMOR: ItemCategory.ARMOR,
            RING: ItemCategory.RING,
            GENERIC_FLASH_LIGHT: LightType.GENERIC_FLASH_LIGHT,
            ANY_KIND_OF_VISIBLE,
            DISCOVERED: TileFlag.DISCOVERED,
            ITEM_DETECTED: TileFlag.ITEM_DETECTED,
            HAS_ITEM: TileFlag.HAS_ITEM,
            SEARCHED_FROM_HERE: TileFlag.SEARCHED_FROM_HERE,
            IS_IN_SHADOW: TileFlag.IS_IN_SHADOW,
            armorTable: armorTable as readonly { strengthRequired: number }[],
        };
    }

    /**
     * Build the AttackContext for combat resolution.
     */
    function buildAttackContext(): AttackContext {
        return {
            // ── CombatMathContext ──
            player,
            weapon: rogue.weapon,
            armor: rogue.armor,
            playerStrength: rogue.strength,
            monsterClassCatalog,
            randPercent,
            getTerrainFlags: (loc: Pos) => terrainFlagsAt(loc),

            // ── CombatDamageContext ──
            easyMode: rogue.mode === GameMode.Easy,
            transference: rogue.transference,
            playerTransferenceRatio: gameConst.playerTransferenceRatio,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            canDirectlySeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            wakeUp(monst) {
                alertMonster(monst, player);
            },
            spawnDungeonFeature: spawnDungeonFeatureRuntime,
            refreshSideBar() { refreshSideBarRuntime(-1, -1, false); },
            combatMessage: msgOps.combatMessage,
            messageWithColor(text, color) { msgOps.messageWithColor(text, color, 0); },
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            gameOver(message) { doGameOver(message, false); },
            setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },
            deleteItem(_item: Item): void {
                // In TS with arrays, items are GC'd after removal from chains.
                // The caller (killCreature) already handles removeItemFromChain.
            },
            makeMonsterDropItem: makeMonsterDropItemImpl,
            clearLastTarget(monst) {
                if (rogue.lastTarget === monst) rogue.lastTarget = null;
            },
            clearYendorWarden(monst) {
                if (rogue.yendorWarden === monst) rogue.yendorWarden = null;
            },
            clearCellMonsterFlag(loc, isDormant) {
                if (!isDormant) {
                    pmap[loc.x][loc.y].flags &= ~TileFlag.HAS_MONSTER;
                }
            },
            prependCreature(monst) {
                if (!monsters.includes(monst)) {
                    monsters.unshift(monst);
                }
            },
            applyInstantTileEffectsToCreature(_monst) {
                // Simplified: full version needs CreatureEffectsContext
            },
            fadeInMonster: fadeInMonsterImpl,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            anyoneWantABite: anyoneWantABiteImpl,
            demoteMonsterFromLeadership: demoteMonsterFromLeadershipImpl,
            checkForContinuedLeadership: checkForContinuedLeadershipImpl,
            getMonsterDFMessage: () => "",
            resolvePronounEscapes(text, _monst) { return text; },
            message: msgOps.message,
            monsterCatalog,
            updateEncumbrance() {
                const ctx = buildFullEquipContext();
                updateEncumbranceFn(ctx.state);
                syncFullEquipState(ctx);
            },
            updateMinersLightRadius() { updateMinersLightRadiusFn(rogue as any, player); },
            updateVision() { updateVisionFn(true); },
            badMessageColor: Colors.badMessageColor,
            poisonColor: Colors.poisonColor,

            // ── AttackContext extras ──
            cellFlags: (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            monsterAtLoc: monsterAtLocFn,
            setMonsterLocation(monst, loc) {
                pmap[monst.loc.x][monst.loc.y].flags &= ~(monst === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER);
                monst.loc.x = loc.x;
                monst.loc.y = loc.y;
                pmap[loc.x][loc.y].flags |= (monst === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER);
            },
            monsterWillAttackTarget: () => true,
            monsterIsInClass: (monst, mc) => monsterIsInClass(monst, mc),
            randRange,
            randClump,
            blockCombatText: rogue.blockCombatText,
            setDisturbed() { rogue.disturbed = true; },
            reaping: rogue.reaping,
            magicWeaponHit(defender, weapon, wasSneakOrSleep) {
                magicWeaponHitFn(defender, weapon, wasSneakOrSleep, buildRunicContext());
            },
            applyArmorRunicEffect(attacker, damage, firstHit) {
                return applyArmorRunicEffectFn(attacker, damage, firstHit, buildRunicContext());
            },
            specialHit(attacker, defender, damage) {
                specialHitFn(attacker, defender, damage, buildRunicContext());
            },
            splitMonster(monst, attacker) {
                splitMonsterFn(monst, attacker, buildCombatHelperContext());
            },
            attackVerb: () => "hit",
            messageColorFromVictim: () => Colors.white,
            decrementWeaponAutoIDTimer() {
                decrementWeaponAutoIDTimerFn(buildCombatHelperContext());
            },
            rechargeItemsIncrementally(amount) {
                rechargeItemsIncrementallyFn(amount, buildMiscHelpersContext());
            },
            equipItem(item: Item, force: boolean) {
                const ctx = buildFullEquipContext();
                equipItem(item, force, null, ctx);
                syncFullEquipState(ctx);
            },
            itemName: (item: Item) => getItemName(item, false, false),
            checkForDisenchantment(item: Item) {
                checkForDisenchantmentFn(item, NUMBER_GOOD_WEAPON_ENCHANT_KINDS, ArmorEnchant.NumberGoodArmorEnchantKinds);
            },
            strengthCheck(item: Item, force: boolean) {
                const ctx = buildFullEquipContext();
                strengthCheck(item, !force, ctx);
                syncFullEquipState(ctx);
            },
            itemMessageColor: Colors.itemMessageColor,
            handlePaladinFeat(defender) {
                handlePaladinFeatFn(defender, buildCombatHelperContext());
            },
            setPureMageFeatFailed() {
                rogue.featRecord[FeatType.PureMage] = false;
            },
            setDragonslayerFeatAchieved() {
                // DragonSlayer feat: set to true when a dragon-type is killed
                // (already tracked in the feat record; nothing extra needed here)
            },
            reportHeardCombat: () => false,
            whiteColor: Colors.white,
            redColor: { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            gameOverFromMonster(mName) { doGameOver(mName, false); },
            unAlly(monst) {
                if (monst.creatureState === CreatureState.Ally) {
                    monst.creatureState = CreatureState.TrackingScent;
                }
            },
            alertMonster(monst) { alertMonster(monst, player); },
        };
    }

    /**
     * Build the RunicContext for weapon/armor runic effects.
     * Extends AttackContext with runic-specific callbacks.
     */
    function buildRunicContext(): RunicContext {
        const atkCtx = buildAttackContext();
        return {
            ...atkCtx,
            armorRunicIdentified() {
                return !!(rogue.armor && (rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED));
            },
            autoIdentify(item: Item) {
                identify(item, gameConst);
            },
            createFlare(x, y, type) {
                createFlareFn(x, y, type, rogue as any, lightCatalogData);
            },
            cloneMonster(monst, announce, placeClone) {
                return cloneMonsterImpl(monst, announce, placeClone);
            },
            playerImmuneToMonster(monst) {
                return playerImmuneToMonsterFn(monst, buildCombatHelperContext());
            },
            slow(monst, duration) {
                monst.status[StatusEffect.Slowed] = Math.max(monst.status[StatusEffect.Slowed], duration);
                monst.maxStatus[StatusEffect.Slowed] = Math.max(monst.maxStatus[StatusEffect.Slowed], monst.status[StatusEffect.Slowed]);
            },
            weaken(monst, duration) {
                monst.status[StatusEffect.Weakened] = Math.max(monst.status[StatusEffect.Weakened], duration);
                monst.maxStatus[StatusEffect.Weakened] = Math.max(monst.maxStatus[StatusEffect.Weakened], monst.status[StatusEffect.Weakened]);
            },
            exposeCreatureToFire(monst) {
                exposeCreatureToFireFn(monst, buildCreatureEffectsContext());
            },
            monsterStealsFromPlayer(attacker) {
                monsterStealsFromPlayerImpl(attacker);
            },
            monstersAreEnemies(monst1, monst2) {
                return monstersAreEnemiesFn(monst1, monst2, player, cellHasTerrainFlagAt);
            },
            itemName: (item: Item) => getItemName(item, false, false),
            onHitHallucinateDuration: gameConst.onHitHallucinateDuration,
            onHitWeakenDuration: gameConst.onHitWeakenDuration,
            onHitMercyHealPercent: gameConst.onHitMercyHealPercent,
            forceWeaponHit(defender, weapon) {
                return forceWeaponHitImpl(defender, weapon);
            },
        };
    }

    /**
     * Build a MonsterQueryContext for monster visibility checks.
     */
    function buildMonsterQueryContext(): MonsterQueryContext {
        return {
            player,
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            cellHasGas(loc) {
                return pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas] !== 0;
            },
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: false,
        };
    }

    /**
     * Build a WeaponAttackContext for whip/spear/flail/abort-attack functions.
     */
    function buildWeaponAttackContext(): WeaponAttackContext {
        const mqCtx = buildMonsterQueryContext();

        // Minimal bolt catalog — only WHIP entry needed for now
        const minimalBoltCatalog: BoltInfo[] = [];
        minimalBoltCatalog[BoltType.WHIP] = { theChar: 0 };

        return {
            pmap,
            player,
            rogue: {
                weapon: rogue.weapon,
                playbackFastForward: false,
            },
            nbDirs: nbDirs as any,

            // -- Map queries --
            coordinatesAreInMap,
            isPosInMap: (pos) => coordinatesAreInMap(pos.x, pos.y),
            cellHasTerrainFlag: cellHasTerrainFlagAt,
            diagonalBlocked(x1, y1, x2, y2, _isPlayer) {
                return diagonalBlockedFn(x1, y1, x2, y2, (loc) => terrainFlagsAt(loc));
            },

            // -- Monster queries --
            monsterAtLoc: monsterAtLocFn,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterIsHidden(monst, observer) {
                return monsterIsHiddenFn(monst, observer, mqCtx);
            },
            monsterWillAttackTarget(attacker, defender) {
                return monsterWillAttackTargetFn(attacker, defender, player, cellHasTerrainFlagAt);
            },
            monsterIsInClass(monst, mc) {
                return monsterIsInClass(monst, monsterClassCatalog[mc as number]);
            },
            monstersAreEnemies(monst1, monst2) {
                return monstersAreEnemiesFn(monst1, monst2, player, cellHasTerrainFlagAt);
            },
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            distanceBetween,

            // -- Item queries --
            itemName: (item) => getItemName(item, false, false),

            // -- Combat --
            attack(attacker, defender, lungeAttack) {
                const atkCtx = buildAttackContext();
                return attackFn(attacker, defender, lungeAttack, atkCtx);
            },

            // -- Bolt system --
            boltCatalog: minimalBoltCatalog,
            getImpactLoc(origin, target, maxDistance, returnLastEmpty, _bolt) {
                return getImpactLocFn(
                    origin, target, maxDistance, returnLastEmpty, null,
                    // creatureBlocks: a creature at loc (other than origin) blocks
                    (loc, originLoc) => {
                        if (loc.x === originLoc.x && loc.y === originLoc.y) return false;
                        return monsterAtLocFn(loc) !== null;
                    },
                    // cellBlocks: impassable terrain blocks
                    (loc) => cellHasTerrainFlagAt(loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY),
                );
            },
            zap(origin, _target, _bolt, _hideDetails, _boltInView) {
                // Simplified zap for whip attacks: find the first creature along the
                // bolt path and attack it. Full bolt animation/effects deferred.
                const attacker = (origin.x === player.loc.x && origin.y === player.loc.y)
                    ? player
                    : monsterAtLocFn(origin);
                if (!attacker) return;
                // The defender was already verified by handleWhipAttacks via getImpactLoc.
                // Re-find it by scanning the impact location.
                const strikeLoc = getImpactLocFn(
                    origin, _target, 5, false, null,
                    (loc, originLoc) => {
                        if (loc.x === originLoc.x && loc.y === originLoc.y) return false;
                        return monsterAtLocFn(loc) !== null;
                    },
                    (loc) => cellHasTerrainFlagAt(loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY),
                );
                const defender = monsterAtLocFn(strikeLoc);
                if (defender) {
                    const atkCtx = buildAttackContext();
                    attackFn(attacker, defender, false, atkCtx);
                }
            },

            // -- UI --
            confirm: () => true, // Full confirm dialog not yet wired
            playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            plotForegroundChar(_ch, _x, _y, _color, _isOverlay) {
                // Visual overlay for spear attacks — deferred
            },
            pauseAnimation(frames, _behavior) {
                browserConsole.pauseForMilliseconds(frames * 16, { interruptForMouseMove: false });
            },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            lightBlue: Colors.lightBlue,

            // -- All monsters --
            allMonsters: () => monsters,
        };
    }

    /**
     * Build the PlayerMoveContext for playerMoves/playerRuns.
     */
    function buildPlayerMoveContext(): PlayerMoveContext & PlayerRunContext {
        return {
            pmap,
            player,
            rogue,
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
            monsterName(monst, includeArticle) {
                if (monst === player) return "you";
                const article = includeArticle
                    ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${article}${monst.info.monsterName}`;
            },
            monsterAvoids: monsterAvoidsWrapped,
            monsterShouldFall: () => false,
            forbiddenFlagsForMonster: () => 0,
            distanceBetween,
            allMonsters: () => monsters,

            layerWithTMFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),
            layerWithFlag: (x, y, _flag) => highestPriorityLayer(pmap, x, y, false),

            handleWhipAttacks(monst, dir, aborted) {
                const wCtx = buildWeaponAttackContext();
                return handleWhipAttacksFn(monst, dir, aborted, wCtx);
            },
            handleSpearAttacks(monst, dir, aborted) {
                const wCtx = buildWeaponAttackContext();
                return handleSpearAttacksFn(monst, dir, aborted, wCtx);
            },
            buildFlailHitList(x1, y1, x2, y2, hitList) {
                const wCtx = buildWeaponAttackContext();
                buildFlailHitListFn(x1, y1, x2, y2, hitList, wCtx);
            },
            buildHitList(hitList, attacker, defender, allAdjacent) {
                const atkCtx = buildAttackContext();
                const result = buildHitListFn(attacker, defender, allAdjacent, atkCtx);
                for (let i = 0; i < result.length && i < hitList.length; i++) {
                    hitList[i] = result[i];
                }
            },
            abortAttack(hitList) {
                const wCtx = buildWeaponAttackContext();
                return abortAttackFn(hitList, wCtx);
            },
            attack(attacker, defender, lungeAttack) {
                const atkCtx = buildAttackContext();
                return attackFn(attacker, defender, lungeAttack, atkCtx);
            },
            playerRecoversFromAttacking(anyHit) {
                const tpCtx = buildTurnProcessingContext();
                playerRecoversFromAttackingFn(anyHit, tpCtx);
            },

            randValidDirectionFrom: () => 0,
            moveMonster(monst, dx, dy) {
                // Simplified moveMonster for ally swapping / pushing.
                // Full version requires MoveMonsterContext with AI systems.
                const newX = monst.loc.x + dx;
                const newY = monst.loc.y + dy;
                if (
                    coordinatesAreInMap(newX, newY) &&
                    !cellHasTerrainFlagAt({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                    !(pmap[newX][newY].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER))
                ) {
                    pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.HAS_MONSTER;
                    monst.loc.x = newX;
                    monst.loc.y = newY;
                    pmap[newX][newY].flags |= TileFlag.HAS_MONSTER;
                }
            },
            getQualifyingPathLocNear(target) { return { ...target }; },

            keyInPackFor(loc: Pos): Item | null {
                for (const item of packItems) {
                    if (item.category & ItemCategory.KEY) {
                        for (let i = 0; i < item.keyLoc.length; i++) {
                            const kl = item.keyLoc[i];
                            if (!kl || (!kl.loc.x && !kl.machine)) break;
                            if ((kl.loc.x === loc.x && kl.loc.y === loc.y)
                                || kl.machine === pmap[loc.x][loc.y].machineNumber) {
                                return item;
                            }
                        }
                    }
                }
                return null;
            },
            useKeyAt(item: Item, x: number, y: number): void {
                useKeyAtFn(item, x, y, buildItemHelperContext());
            },
            pickUpItemAt: pickUpItemAtImpl,
            checkForMissingKeys: checkForMissingKeysImpl,

            freeCaptive(monst) {
                freeCaptiveFn(monst, buildAllyManagementContext());
            },

            promoteTile(x, y, layer, isVolatile) {
                promoteTileImpl(x, y, layer, isVolatile);
            },
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            discoverCell(x, y) {
                pmap[x][y].flags |= TileFlag.DISCOVERED;
            },
            spawnDungeonFeature: spawnDungeonFeatureFromObject,
            dungeonFeatureCatalog,

            useStairs(direction) {
                useStairsFn(direction, buildTravelExploreContext());
            },

            playerTurnEnded() {
                doPlayerTurnEnded();
            },
            recordKeystroke(key, shift, ctrl) {
                recordKeystrokeFn(key, ctrl, shift, recordingBuffer, rogue.playbackMode);
            },
            cancelKeystroke() { cancelKeystrokeFn(recordingBuffer); },
            confirm: () => true,

            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            combatMessage: msgOps.combatMessage,
            backgroundMessageColor: Colors.backgroundMessageColor,

            randPercent: randPercent,
            randRange,

            vomit(monst) {
                vomitFn(monst, {
                    player,
                    dungeonFeatureCatalog,
                    spawnDungeonFeature: spawnDungeonFeatureFromObject,
                    canDirectlySeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                    monsterName(m, includeArticle) {
                        if (m === player) return "you";
                        const article = includeArticle
                            ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                            : "";
                        return `${article}${m.info.monsterName}`;
                    },
                    combatMessage: msgOps.combatMessage,
                    automationActive: rogue.automationActive,
                });
            },

            // -- PlayerRunContext extensions --
            isPosInMap,
            posEq(a: Pos, b: Pos) { return a.x === b.x && a.y === b.y; },
            updateFlavorText() { updateFlavorTextFn(buildCreatureEffectsContext()); },

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
            rogue,
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
            ringWisdomMultiplier: (val: number) => Number(ringWisdomMultiplierFn(BigInt(val))),
            charmRechargeDelay: (kind: number, enchant: number) => {
                const entry = charmEffectTable[kind];
                return entry ? charmRechargeDelayFn(entry, enchant) : 0;
            },

            itemName: (theItem: Item, includeArticle: boolean, includeRunic: boolean) =>
                itemNameFn(theItem, includeRunic, includeArticle, buildItemNamingContext()),
            identify(item) { identify(item, gameConst); },
            updateIdentifiableItems() {
                updateIdentifiableItemsFn({
                    packItems,
                    floorItems,
                    updateIdentifiableItem(_theItem: Item) {
                        // Simplified: mark items as identifiable based on usage count
                        // Full implementation needs autoIdentify logic — deferred
                    },
                });
            },
            numberOfMatchingPackItems: (category: number, requiredFlags?: number, forbiddenFlags?: number, _displayErrors?: boolean) =>
                numberOfMatchingPackItemsFn(packItems, category, requiredFlags ?? 0, forbiddenFlags ?? 0),

            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,

            monsterAvoids: monsterAvoidsWrapped,
            canSeeMonster: (monst) => !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE),
            monsterName: () => "monster",
            messageColorFromVictim: () => Colors.white,
            inflictDamage(attacker: Creature | null, defender: Creature, damage: number, flashColor: Color | null, showDamage: boolean) {
                return inflictDamageImpl(attacker, defender, damage, flashColor, showDamage);
            },
            killCreature(monst: Creature, administrativeDeath: boolean) {
                killCreatureImpl(monst, administrativeDeath);
            },
            demoteMonsterFromLeadership: demoteMonsterFromLeadershipImpl,
            restoreMonster() { /* stub */ },
            removeCreature(list, monst) {
                const idx = list.indexOf(monst);
                if (idx >= 0) { list.splice(idx, 1); return true; }
                return false;
            },
            prependCreature(list, monst) {
                list.unshift(monst);
            },
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
            search(strength) { searchRuntime(strength); },

            recordKeystroke(key, shifted, ctrled) {
                const keyCode = typeof key === "string" ? key.charCodeAt(0) : key;
                recordKeystrokeFn(keyCode, ctrled, shifted, recordingBuffer, rogue.playbackMode);
            },
            playerTurnEnded() {
                doPlayerTurnEnded();
            },
            pauseAnimation(_frames, _behavior) {
                return browserConsole.pauseForMilliseconds(0, { interruptForMouseMove: false });
            },

            ringTable: [],
            displayLevel: displayLevelFn,
            updateMinersLightRadius() { updateMinersLightRadiusFn(rogue as any, player); },
            itemMessageColor: Colors.itemMessageColor,
            red: Colors.red,
            REST_KEY: String.fromCharCode(REST_KEY),
            SEARCH_KEY: String.fromCharCode(SEARCH_KEY),
            PAUSE_BEHAVIOR_DEFAULT: 0,
        } satisfies MiscHelpersContext;
    }

    // =========================================================================
    // buildLifecycleContext — Step 3e: Game lifecycle (gameOver, victory)
    // =========================================================================

    /**
     * Build the LifecycleContext for gameOver, victory, and enableEasyMode.
     * Provides all display, messaging, scoring, and recording hooks.
     */
    function buildLifecycleContext(): LifecycleContext {
        return {
            rogue: rogue as unknown as LifecycleContext["rogue"],
            player,
            gameConst,
            serverMode: false,
            nonInteractivePlayback: false,
            packItems,
            featTable: [],  // Will be populated when feat system is wired

            // -- Display primitives -----------------------------------------------
            displayBuffer,
            clearDisplayBuffer(dbuf) { clearDisplayBuffer(dbuf); },
            blackOutScreen(dbuf) { blackOutScreen(dbuf); },
            displayLevel() { displayLevelFn(); commitDraws(); },
            refreshSideBar(x, y, justClearing) {
                refreshSideBarFn(x, y, justClearing, buildSidebarContext());
            },

            // -- Display functions ------------------------------------------------
            printString(str, x, y, fg, bg, dbuf) {
                printStringFn(str, x, y, fg, bg, dbuf ?? displayBuffer);
                if (!dbuf) commitDraws();
            },
            plotCharToBuffer(ch, pos, fg, bg, dbuf) {
                plotCharToBuffer(ch, pos.windowX, pos.windowY, fg, bg, dbuf);
            },
            funkyFade(_dbuf, _colorStart, _startDelay, _duration, _cx, _cy, _inward) {
                // Stub — full funkyFade needs animation pipeline (Step 3f)
                commitDraws();
            },
            strLenWithoutEscapes,
            mapToWindowX,
            mapToWindowY,

            // -- Messages & dialogs -----------------------------------------------
            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            confirmMessages: msgOps.confirmMessages,
            deleteMessages: msgOps.deleteMessages,
            displayMoreSign: msgOps.displayMoreSign,
            displayMoreSignWithoutWaitingForAcknowledgment: msgOps.displayMoreSignWithoutWaitingForAcknowledgment,
            flashTemporaryAlert: msgOps.flashTemporaryAlert,
            confirm(_prompt, _alsoDuringPlayback) { return true; },

            // -- Input ------------------------------------------------------------
            nextBrogueEvent(_event, _textInput, _colorsDance, _realInputOnly) {
                // Stub — set escape so loops exit immediately
                _event.eventType = EventType.Keystroke;
                _event.param1 = ESCAPE_KEY;
            },

            // -- Item operations --------------------------------------------------
            identify(_item) {
                _item.flags |= ItemFlag.ITEM_IDENTIFIED;
            },
            itemName(item: Item, includeDetails: boolean, includeArticle: boolean, _color: Readonly<Color>) {
                return itemNameFn(item, includeDetails, includeArticle, buildItemNamingContext());
            },
            upperCase(buf) {
                return buf.charAt(0).toUpperCase() + buf.slice(1);
            },
            itemValue: itemValueFn,
            numberOfMatchingPackItems: (category: number, _flags: number, _flags2: number, _useFlags: boolean) =>
                numberOfMatchingPackItemsFn(packItems, category, _flags, _flags2),
            isVowelish: isVowelishFn,
            displayInventory(_categoryMask, _flags, _flags2, _showAll, _justCount) {
                return 0; // stub
            },

            // -- Recording & scoring ----------------------------------------------
            flushBufferToFile() { /* no-op — recording not fully wired */ },
            saveHighScore(_entry) { return false; },
            printHighScores(highlight) { printHighScoresFn(buildScreenContext(), highlight); },
            saveRecording(_filenameOut) { /* stub */ },
            saveRecordingNoPrompt(_filenameOut) { /* stub */ },
            notifyEvent(_type, _score, _data, _description, _recording) { /* no-op */ },
            saveRunHistory(_result, _killedBy, _score, _gems) { /* no-op */ },
            recordKeystroke(key, controlKey, shiftKey) {
                recordKeystrokeFn(key, controlKey, shiftKey, recordingBuffer, rogue.playbackMode);
            },

            // -- Player display ---------------------------------------------------
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            encodeMessageColor: msgOps.encodeMessageColor,

            // -- Color references -------------------------------------------------
            black: Colors.black,
            white: Colors.white,
            gray: Colors.gray,
            yellow: Colors.yellow,
            lightBlue: Colors.lightBlue,
            badMessageColor: Colors.badMessageColor,
            itemMessageColor: Colors.itemMessageColor,
            advancementMessageColor: Colors.advancementMessageColor,
            superVictoryColor: Colors.superVictoryColor ?? Colors.white,

            // -- Displayed messages (writable) ------------------------------------
            displayedMessage: messageState.displayedMessage,

            // -- Glyph references -------------------------------------------------
            G_GOLD: DisplayGlyph.G_GOLD,
            G_AMULET: DisplayGlyph.G_AMULET,
        };
    }

    /**
     * Pending death screen info — stored by doGameOver (Phase 1) so the
     * interactive death screen can be shown asynchronously after
     * mainInputLoop exits (Phase 2).
     */
    let pendingDeathScreen: { killedBy: string; useCustomPhrasing: boolean } | null = null;

    /**
     * Phase 1 of gameOver: synchronous state changes.
     *
     * Sets essential flags so the main loop exits, then stores the death
     * info for the async Phase 2 (runDeathScreen) that runs after
     * mainInputLoop's while-loop finishes.
     *
     * We intentionally skip calling the full gameOverFn here because it
     * needs async input (nextBrogueEvent) which can't be awaited from a
     * synchronous call-chain (combat → killCreature → doGameOver).
     */
    function doGameOver(killedBy: string, useCustomPhrasing: boolean): void {
        // Guard against double-entry (matches C gameOver guard)
        if (player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) {
            return;
        }
        player.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;

        rogue.autoPlayingLevel = false;
        rogue.gameInProgress = false;
        rogue.gameHasEnded = true;

        // Store for the async Phase 2
        pendingDeathScreen = { killedBy, useCustomPhrasing };
    }

    /**
     * Phase 2 of gameOver: async interactive death screen.
     *
     * Shows "You die..." message, waits for player acknowledgment,
     * displays death description and score summary.
     * Called from mainInputLoop after the while-loop exits.
     */
    async function runDeathScreen(killedBy: string, useCustomPhrasing: boolean): Promise<void> {
        const isQuit = rogue.quit;

        // Build death description
        let description: string;
        if (useCustomPhrasing) {
            description = `${killedBy} on depth ${rogue.depthLevel}`;
        } else {
            const article = isVowelishFn(killedBy) ? "n" : "";
            description = `Killed by a${article} ${killedBy} on depth ${rogue.depthLevel}`;
        }

        // Count gems
        const numGems = numberOfMatchingPackItemsFn(packItems, ItemCategory.GEM, 0, 0);
        rogue.gold += 500 * numGems;

        const score = rogue.mode === GameMode.Easy
            ? Math.floor(rogue.gold / 10)
            : rogue.gold;

        if (!isQuit) {
            // Show "You die..." and wait for acknowledge
            player.currentHP = 0;
            refreshSideBarRuntime(-1, -1, false);

            // Build the full death summary line
            let summaryBuf = description;
            if (score > 0) {
                summaryBuf += numGems > 0
                    ? ` with treasure worth ${score} gold`
                    : ` with ${score} gold`;
            }
            summaryBuf += ".";

            msgOps.messageWithColor("You die...", Colors.badMessageColor, 0);
            displayLevelFn();

            // Simplified funkyFade: just black out screen after a brief pause
            blackOutScreen(displayBuffer);
            printStringFn(
                summaryBuf,
                Math.floor((COLS - strLenWithoutEscapes(summaryBuf)) / 2),
                Math.floor(ROWS / 2),
                Colors.gray, Colors.black, displayBuffer,
            );
            commitDraws();

            // Single wait: player presses any key or clicks to dismiss
            await browserConsole.waitForEvent();
        }

        // Black out and return to let the title screen take over.
        blackOutScreen(displayBuffer);
        commitDraws();
    }

    /**
     * Call victory with the full lifecycle context.
     */
    function doVictory(superVictory: boolean): void {
        victoryFn(buildLifecycleContext(), superVictory);
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
            monsterAvoids: monsterAvoidsWrapped,
            monsterIsInClass(_monst, _monsterClass) {
                return false; // simplified
            },
            isVowelish(word) {
                return "aeiouAEIOU".includes(word[0] ?? "");
            },
            monstersTurn(monst) {
                // Simplified monster AI — real monstersTurn needs MonstersTurnContext
                // with ~30 unported methods. This provides basic visible behavior:
                //   - Sleeping monsters wake when player is nearby & visible
                //   - Hunting/tracking monsters move toward player via scent
                //   - Wandering monsters move randomly occasionally

                // Skip dead/dying monsters (mirrors C code's early return in monstersTurn)
                if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) ||
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED) ||
                    monst.currentHP <= 0
                ) {
                    monst.ticksUntilTurn = monst.movementSpeed || 100;
                    return;
                }

                const mx = monst.loc.x;
                const my = monst.loc.y;
                const dist = Math.abs(player.loc.x - mx) + Math.abs(player.loc.y - my);
                const inFOV = !!(pmap[mx]?.[my]?.flags & TileFlag.IN_FIELD_OF_VIEW);

                // Sleeping: wake up if player is nearby and in FOV
                if (monst.creatureState === CreatureState.Sleeping) {
                    if (dist <= 12 && inFOV) {
                        monst.creatureState = CreatureState.TrackingScent;
                    }
                    monst.ticksUntilTurn = monst.movementSpeed || 100;
                    return;
                }

                // Tracking/Hunting: follow scent toward player
                if (monst.creatureState === CreatureState.TrackingScent) {
                    const sm = scentMap ?? [];
                    const myScent = sm[mx]?.[my] ?? 0;
                    let bestDir = -1;
                    let bestScent = 0;
                    for (let dir = 0; dir < 8; dir++) {
                        const nx = mx + nbDirs[dir][0];
                        const ny = my + nbDirs[dir][1];
                        if (!coordinatesAreInMap(nx, ny)) continue;
                        const cellScent = sm[nx]?.[ny] ?? 0;
                        if (
                            cellScent > bestScent &&
                            !(pmap[nx][ny].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) &&
                            !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                            !monsterAvoidsWrapped(monst, { x: nx, y: ny })
                        ) {
                            bestScent = cellScent;
                            bestDir = dir;
                        }
                    }

                    if (bestDir >= 0 && bestScent > myScent) {
                        const newX = mx + nbDirs[bestDir][0];
                        const newY = my + nbDirs[bestDir][1];
                        pmap[mx][my].flags &= ~TileFlag.HAS_MONSTER;
                        monst.loc.x = newX;
                        monst.loc.y = newY;
                        pmap[newX][newY].flags |= TileFlag.HAS_MONSTER;
                        monst.turnsSpentStationary = 0;
                    } else if (dist <= 1) {
                        // Adjacent to player — attack!
                        // Surface submerged monsters before attacking (C: moveMonster, Monsters.c:3863)
                        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) {
                            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                            refreshDungeonCellRuntime(monst.loc);
                        }
                        attackFn(monst, player, false, buildAttackContext());
                    } else {
                        // No scent — fall back to direct approach
                        const dx = Math.sign(player.loc.x - mx);
                        const dy = Math.sign(player.loc.y - my);
                        const nx = mx + dx;
                        const ny = my + dy;
                        if (
                            coordinatesAreInMap(nx, ny) &&
                            !(pmap[nx][ny].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) &&
                            !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                            !monsterAvoidsWrapped(monst, { x: nx, y: ny })
                        ) {
                            pmap[mx][my].flags &= ~TileFlag.HAS_MONSTER;
                            monst.loc.x = nx;
                            monst.loc.y = ny;
                            pmap[nx][ny].flags |= TileFlag.HAS_MONSTER;
                            monst.turnsSpentStationary = 0;
                        }
                    }
                    monst.ticksUntilTurn = monst.movementSpeed || 100;
                    return;
                }

                // Fleeing: move away from the player (inverse of tracking scent)
                // This handles monkeys after stealing (PermFleeing + Fleeing state)
                // and other flee scenarios.
                if (monst.creatureState === CreatureState.Fleeing) {
                    let bestDir = -1;
                    let bestDist = dist;
                    for (let dir = 0; dir < 8; dir++) {
                        const nx = mx + nbDirs[dir][0];
                        const ny = my + nbDirs[dir][1];
                        if (!coordinatesAreInMap(nx, ny)) continue;
                        const newDist = Math.abs(player.loc.x - nx) + Math.abs(player.loc.y - ny);
                        if (
                            newDist > bestDist &&
                            !(pmap[nx][ny].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) &&
                            !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                            !monsterAvoidsWrapped(monst, { x: nx, y: ny })
                        ) {
                            bestDist = newDist;
                            bestDir = dir;
                        }
                    }
                    if (bestDir >= 0) {
                        const nx = mx + nbDirs[bestDir][0];
                        const ny = my + nbDirs[bestDir][1];
                        pmap[mx][my].flags &= ~TileFlag.HAS_MONSTER;
                        monst.loc.x = nx;
                        monst.loc.y = ny;
                        pmap[nx][ny].flags |= TileFlag.HAS_MONSTER;
                        monst.turnsSpentStationary = 0;
                    } else if (dist <= 1) {
                        // Cornered — attack the player as a last resort
                        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) {
                            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                            refreshDungeonCellRuntime(monst.loc);
                        }
                        attackFn(monst, player, false, buildAttackContext());
                    }
                    monst.ticksUntilTurn = monst.movementSpeed || 100;
                    return;
                }

                // Wandering: random movement occasionally
                if (monst.creatureState === CreatureState.Wandering) {
                    if (randRange(0, 3) === 0) {
                        const dir = randRange(0, 7);
                        const nx = mx + nbDirs[dir][0];
                        const ny = my + nbDirs[dir][1];
                        if (
                            coordinatesAreInMap(nx, ny) &&
                            !(pmap[nx][ny].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) &&
                            !cellHasTerrainFlagAt({ x: nx, y: ny }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                            !monsterAvoidsWrapped(monst, { x: nx, y: ny })
                        ) {
                            pmap[mx][my].flags &= ~TileFlag.HAS_MONSTER;
                            monst.loc.x = nx;
                            monst.loc.y = ny;
                            pmap[nx][ny].flags |= TileFlag.HAS_MONSTER;
                            monst.turnsSpentStationary = 0;
                        }
                    }
                    // Check if player came into view — start tracking
                    if (dist <= 12 && inFOV) {
                        monst.creatureState = CreatureState.TrackingScent;
                    }
                }

                monst.ticksUntilTurn = monst.movementSpeed || 100;
            },
            decrementMonsterStatus(monst) {
                // Decrement all positive status counters
                for (let i = 0; i < monst.status.length; i++) {
                    if (monst.status[i] > 0) {
                        monst.status[i]--;
                    }
                }

                // Submersion check (C: decrementMonsterStatus in Monsters.c)
                // Monsters with MONST_SUBMERGES that are in submersion-compatible
                // terrain have a 20% chance per turn to submerge.
                if (
                    monsterCanSubmergeNowFn(monst, cellHasTMFlagAt, cellHasTerrainFlagAt) &&
                    !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
                ) {
                    if (randPercent(20)) {
                        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
                        // Re-evaluate fleeing state if we just submerged
                        if (
                            !monst.status[StatusEffect.MagicalFear] &&
                            monst.creatureState === CreatureState.Fleeing &&
                            (!(monst.info.flags & MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH) ||
                                monst.currentHP >= Math.floor(monst.info.maxHP * 3 / 4))
                        ) {
                            monst.creatureState = CreatureState.TrackingScent;
                        }
                        refreshDungeonCellRuntime(monst.loc);
                    } else if (
                        (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
                        monst.creatureState !== CreatureState.Ally
                    ) {
                        // Restricted-to-liquid monsters flee if they can't submerge
                        monst.creatureState = CreatureState.Fleeing;
                    }
                }

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
            itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, _maxLen: number | null): void {
                buf[0] = itemNameFn(theItem, includeDetails, includeArticle, buildItemNamingContext());
            },
            numberOfMatchingPackItems: (category: number, _kind: number, _flags: number, _checkCarried: boolean) =>
                numberOfMatchingPackItemsFn(packItems, category, 0, 0),

            // -- Combat helpers ----------------------------------------------
            inflictDamage(attacker, defender, damage, flashColor, showDamage) {
                return inflictDamageImpl(attacker, defender, damage, flashColor, showDamage);
            },
            killCreature(monst, administrativeDeath) {
                killCreatureImpl(monst, administrativeDeath);
            },
            combatMessage: msgOps.combatMessage,
            displayCombatText: msgOps.displayCombatText,
            messageColorFromVictim(_monst) {
                return Colors.white;
            },
            addPoison(monst, totalDamage, concentrationIncrement) {
                addPoisonFn(monst, totalDamage, concentrationIncrement, buildCombatDamageContext());
            },
            flashMonster(monst, color, strength) {
                flashMonsterFn(monst, color, strength, buildCombatDamageContext());
            },

            // -- UI ----------------------------------------------------------
            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            flavorMessage: msgOps.flavorMessage,
            refreshDungeonCell(loc) {
                const { glyph, foreColor, backColor } = getCellAppearance(loc);
                plotCharWithColor(glyph, { windowX: mapToWindowX(loc.x), windowY: mapToWindowY(loc.y) }, foreColor, backColor, displayBuffer);
            },
            displayLevel() {
                displayLevelFn();
                commitDraws();
            },
            displayAnnotation() { /* stub — recordings not wired */ },
            refreshSideBar(x, y, forceFullUpdate) {
                refreshSideBarFn(x, y, forceFullUpdate, buildSidebarContext());
            },
            gameOver(message, _showScore) {
                doGameOver(message, false);
            },
            confirm(_message, _isDangerous) {
                return true; // auto-confirm for now
            },
            flashMessage: msgOps.flashMessage,
            recordKeystroke(key, shift, alt) {
                recordKeystrokeFn(key, shift, alt, recordingBuffer, rogue.playbackMode);
            },
            confirmMessages: msgOps.confirmMessages,
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
                updateEnvironmentFn(buildEnvironmentContext());
            },
            updateVision(refreshDisplay) {
                updateVisionFn(refreshDisplay);
            },
            updateMapToShore() {
                // Stub — uses Dijkstra, complex context
            },
            updateSafetyMap() {
                updateSafetyMapFn(buildSafetyMapsContext());
            },
            refreshWaypoint(_index) {
                // Stub — needs ArchitectContext
            },
            analyzeMap(_updateChokemap) {
                // Stub — needs AnalysisContext
            },
            removeDeadMonsters() {
                // Remove monsters marked as dying/dead and clear their map flags.
                for (let i = monsters.length - 1; i >= 0; i--) {
                    const m = monsters[i];
                    if (
                        (m.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) ||
                        (m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED) ||
                        m.currentHP <= 0
                    ) {
                        // Safety: ensure HAS_MONSTER is cleared on the cell
                        if (coordinatesAreInMap(m.loc.x, m.loc.y)) {
                            pmap[m.loc.x][m.loc.y].flags &= ~TileFlag.HAS_MONSTER;
                        }
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
            animateFlares(flares, _count) {
                animateFlaresFn(flares, buildLightingContext(), {
                    demoteVisibility: () => { /* simplified */ },
                    updateFieldOfViewDisplay: (_updateDancing, _refreshDisplay) => { displayLevelFn(); commitDraws(); },
                    pauseAnimation: (ms) => browserConsole.pauseForMilliseconds(ms, { interruptForMouseMove: false }),
                });
            },

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
            rechargeItemsIncrementally(multiplier) {
                rechargeItemsIncrementallyFn(multiplier, buildMiscHelpersContext());
            },
            processIncrementalAutoID() {
                processIncrementalAutoIDFn(buildMiscHelpersContext());
            },

            // -- Tile effects ------------------------------------------------
            applyInstantTileEffectsToCreature(monst) {
                applyInstantTileEffectsFn(monst, buildCreatureEffectsContext());
            },
            applyGradualTileEffectsToCreature(monst, ticks) {
                applyGradualTileEffectsFn(monst, ticks, buildCreatureEffectsContext());
            },
            monsterShouldFall(monst) {
                return monsterShouldFallFn(monst, buildCreatureEffectsContext());
            },
            monstersFall() {
                monstersFallFn(buildCreatureEffectsContext());
            },
            decrementPlayerStatus() {
                decrementPlayerStatusFn(buildCreatureEffectsContext());
            },
            playerFalls() {
                playerFallsFn(buildCreatureEffectsContext());
            },
            handleHealthAlerts() {
                // Stub — handleHealthAlerts uses complex UI interactions
            },
            updateScent() {
                // Real implementation: spread scent from player's position using FOV
                rogue.scentTurnNumber++;
                if (!scentMap) return;
                const scentGrid = allocGrid();
                fillGrid(scentGrid, 0);
                getFOVMaskWrapped(
                    scentGrid, player.loc.x, player.loc.y,
                    BigInt(DCOLS) * FP_FACTOR,
                    T_OBSTRUCTS_SCENT,
                    0, false,
                );
                // Build a minimal MapQueryContext for addScentToCell
                const mapQueryCtx = {
                    cellHasTerrainFlag: cellHasTerrainFlagAt,
                    rogue: { scentTurnNumber: rogue.scentTurnNumber },
                    scentMap,
                } as any;
                for (let i = 0; i < DCOLS; i++) {
                    for (let j = 0; j < DROWS; j++) {
                        if (scentGrid[i][j]) {
                            addScentToCell(i, j, scentDistance(player.loc.x, player.loc.y, i, j), mapQueryCtx);
                        }
                    }
                }
                addScentToCell(player.loc.x, player.loc.y, 0, mapQueryCtx);
                freeGrid(scentGrid);
            },
            currentStealthRange() {
                return 0; // simplified
            },

            // -- Movement / search -------------------------------------------
            search(searchStrength) {
                return searchRuntime(searchStrength);
            },
            playerCanDirectlySee,
            playerCanSee,

            // -- Spawn -------------------------------------------------------
            spawnDungeonFeature(x, y, feat, isVolatile, overrideProtection) {
                spawnDungeonFeatureFromObject(x, y, feat, isVolatile, overrideProtection);
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
        try {
            playerTurnEndedFn(buildTurnProcessingContext());
        } catch (e) {
            console.error("[BrogueCE] Error in playerTurnEnded:", e);
        }
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
            message: msgOps.message,
            messageWithColor: msgOps.messageWithColor,
            temporaryMessage: msgOps.temporaryMessage,
            confirmMessages: msgOps.confirmMessages,
            updateMessageDisplay: msgOps.updateMessageDisplay,

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
            refreshSideBar(x, y, justClearing) {
                refreshSideBarFn(x, y, justClearing, buildSidebarContext());
            },
            async displayInventory(categoryMask, titleFlags, focusFlags, includeDetails, includeButtons) {
                await displayInventoryFn(categoryMask, titleFlags, focusFlags, includeDetails, includeButtons, buildInventoryContext());
            },
            displayMessageArchive: msgOps.displayMessageArchive,
            printHelpScreen() { printHelpScreenFn(buildScreenContext()); },
            displayFeatsScreen() { displayFeatsScreenFn(buildScreenContext()); },
            printDiscoveriesScreen() { printDiscoveriesScreenFn(buildScreenContext()); },
            flashTemporaryAlert: msgOps.flashTemporaryAlert,
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
            async equip(theItem: Item | null) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.RING,
                        0, ItemFlag.ITEM_EQUIPPED,
                        KEYBOARD_LABELS
                            ? "Equip what? (a-z, shift for more info; or <esc> to cancel)"
                            : "Equip what?",
                        true,
                    );
                }
                if (!theItem) return;
                const ctx = buildFullEquipContext();
                equipItem(theItem, false, null, ctx);
                syncFullEquipState(ctx);
            },
            async unequip(theItem: Item | null) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ALL_ITEMS, ItemFlag.ITEM_EQUIPPED, 0,
                        KEYBOARD_LABELS
                            ? "Remove (unequip) what? (a-z or <esc> to cancel)"
                            : "Remove (unequip) what?",
                        true,
                    );
                }
                if (!theItem) return;
                if (!(theItem.flags & ItemFlag.ITEM_EQUIPPED)) {
                    const name = getItemName(theItem, false, false);
                    msgOps.confirmMessages();
                    msgOps.messageWithColor(
                        `your ${name} ${theItem.quantity === 1 ? "was" : "were"} not equipped.`,
                        Colors.itemMessageColor, 0,
                    );
                    return;
                }
                const ctx = buildFullEquipContext();
                unequipItem(theItem, false, ctx);
                syncFullEquipState(ctx);
                const name = getItemName(theItem, true, true);
                msgOps.confirmMessages();
                msgOps.messageWithColor(
                    `you are no longer ${theItem.category & ItemCategory.WEAPON ? "wielding" : "wearing"} ${name}.`,
                    Colors.itemMessageColor, 0,
                );
                doPlayerTurnEnded();
            },
            async drop(theItem: Item | null) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ALL_ITEMS, 0, 0,
                        KEYBOARD_LABELS
                            ? "Drop what? (a-z, shift for more info; or <esc> to cancel)"
                            : "Drop what?",
                        true,
                    );
                }
                if (!theItem) return;
                // Remove from pack and place on floor
                if ((theItem.flags & ItemFlag.ITEM_EQUIPPED) && (theItem.flags & ItemFlag.ITEM_CURSED)) {
                    const name = getItemName(theItem, false, false);
                    msgOps.confirmMessages();
                    msgOps.messageWithColor(`you can't; your ${name} appears to be cursed.`, Colors.itemMessageColor, 0);
                    return;
                }
                if (theItem.flags & ItemFlag.ITEM_EQUIPPED) {
                    const ctx = buildFullEquipContext();
                    unequipItem(theItem, false, ctx);
                    syncFullEquipState(ctx);
                }
                removeItemFromArray(theItem, packItems);
                theItem.loc = { ...player.loc };
                theItem.flags |= ItemFlag.ITEM_PLAYER_AVOIDS;
                floorItems.push(theItem);
                pmap[player.loc.x][player.loc.y].flags |= TileFlag.HAS_ITEM;
                const name = getItemName(theItem, true, true);
                msgOps.messageWithColor(`You dropped ${name}.`, Colors.itemMessageColor, 0);
                doPlayerTurnEnded();
            },
            async apply(theItem: Item | null) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ItemCategory.SCROLL | ItemCategory.FOOD | ItemCategory.POTION
                            | ItemCategory.STAFF | ItemCategory.WAND | ItemCategory.CHARM,
                        0, 0,
                        KEYBOARD_LABELS
                            ? "Apply what? (a-z, shift for more info; or <esc> to cancel)"
                            : "Apply what?",
                        true,
                    );
                }
                if (!theItem) return;
                msgOps.confirmMessages();
                // Full apply dispatch requires targeting, bolts, etc.
                // For now, handle food/potions which don't need targeting:
                const name = getItemName(theItem, false, true);
                msgOps.message(`you can't apply ${name} yet (full item usage coming soon).`, 0);
            },
            async throwCommand(theItem: Item | null, _confirmed: boolean) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ALL_ITEMS, 0, 0,
                        KEYBOARD_LABELS
                            ? "Throw what? (a-z, shift for more info; or <esc> to cancel)"
                            : "Throw what?",
                        true,
                    );
                }
                if (!theItem) return;
                // Throwing requires targeting system — show selected item but defer full throw
                const name = getItemName(theItem, false, false);
                msgOps.message(`Throwing ${name} requires targeting (coming soon).`, 0);
            },
            async relabel(theItem: Item | null) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ALL_ITEMS, 0, 0,
                        KEYBOARD_LABELS
                            ? "Relabel what? (a-z, shift for more info; or <esc> to cancel)"
                            : "Relabel what?",
                        true,
                    );
                }
                if (!theItem) return;
                // Relabel needs a second key input for the new letter
                // For now, just acknowledge the selection
                msgOps.message("Relabeling not yet fully available.", 0);
            },
            async call(theItem: Item | null) {
                if (!theItem) {
                    theItem = await promptForItemOfType(
                        ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.SCROLL
                            | ItemCategory.RING | ItemCategory.POTION | ItemCategory.STAFF
                            | ItemCategory.WAND | ItemCategory.CHARM,
                        0, 0,
                        KEYBOARD_LABELS
                            ? "Call what? (a-z, shift for more info; or <esc> to cancel)"
                            : "Call what?",
                        true,
                    );
                }
                if (!theItem) return;
                msgOps.message("Calling/naming not yet fully available.", 0);
            },
            swapLastEquipment() {
                // Requires lastEquippedWeapon/lastEquippedArmor tracking on rogue state
                // Deferred until Phase 5 when inventory UI is fully wired
                msgOps.message("Equipment swapping not yet available.", 0);
            },
            enableEasyMode() {
                enableEasyModeFn(buildLifecycleContext());
            },
            saveGame() { /* stub — save/load deferred */ },
            gameOver(message, _showHighScores) {
                doGameOver(message, false);
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
            printMonsterDetails(monst) {
                printMonsterDetailsFn(monst, buildSidebarContext());
            },
            printFloorItemDetails(item) {
                printFloorItemDetailsFn(item, buildSidebarContext());
            },
            printLocationDescription(x, y) {
                printLocationDescriptionFn(x, y, buildDescribeLocationContext());
            },

            // -- Targeting / cursor -----------------------------------------------
            moveCursor(
                targetConfirmed, canceled, tabKey, cursorLoc, theEvent,
                _state, colorsDance, keysMoveCursor, targetCanLeaveMap,
            ) {
                // Full moveCursor port — C: Items.c:5372
                // Maps TS interface params to C semantics:
                //   colorsDance ← doButtons (controls animation while waiting)
                //   keysMoveCursor ← cursorMode (whether keys move cursor)
                //   targetCanLeaveMap ← restingAllowed (whether cursor can leave map)
                rogue.cursorLoc = { ...cursorLoc.value };

                targetConfirmed.value = false;
                canceled.value = false;
                tabKey.value = false;
                let sidebarHighlighted = false;

                let again: boolean;
                let cursorMovementCommand: boolean;
                let movementKeystroke: boolean;
                let ev: RogueEvent = theEvent.value;

                do {
                    again = false;
                    cursorMovementCommand = false;
                    movementKeystroke = false;

                    // Get next event (button overlay handling deferred)
                    commitDraws();
                    ev = browserConsole.nextKeyOrMouseEvent(false, colorsDance);

                    if (ev.eventType === EventType.MouseUp || ev.eventType === EventType.MouseEnteredCell) {
                        if (ev.param1 >= 0
                            && ev.param1 < mapToWindowX(0)
                            && ev.param2 >= 0
                            && ev.param2 < ROWS - 1
                            && rogue.sidebarLocationList[ev.param2]
                            && coordinatesAreInMap(
                                rogue.sidebarLocationList[ev.param2].x,
                                rogue.sidebarLocationList[ev.param2].y,
                            )) {
                            // Cursor is on an entity in the sidebar
                            rogue.cursorLoc = { ...rogue.sidebarLocationList[ev.param2] };
                            sidebarHighlighted = true;
                            cursorMovementCommand = true;
                            refreshSideBarRuntime(rogue.cursorLoc.x, rogue.cursorLoc.y, false);
                            if (ev.eventType === EventType.MouseUp) {
                                targetConfirmed.value = true;
                            }
                        } else if (
                            coordinatesAreInMap(
                                windowToMapXFromDisplay(ev.param1),
                                windowToMapYFromDisplay(ev.param2),
                            )
                            || (targetCanLeaveMap && ev.eventType !== EventType.MouseUp)
                        ) {
                            // Cursor is in the map area (or allowed to leave)
                            if (ev.eventType === EventType.MouseUp
                                && !ev.shiftKey
                                && (ev.controlKey
                                    || (rogue.cursorLoc.x === windowToMapXFromDisplay(ev.param1)
                                        && rogue.cursorLoc.y === windowToMapYFromDisplay(ev.param2)))) {
                                targetConfirmed.value = true;
                            }
                            rogue.cursorLoc.x = windowToMapXFromDisplay(ev.param1);
                            rogue.cursorLoc.y = windowToMapYFromDisplay(ev.param2);
                            cursorMovementCommand = true;
                        } else {
                            cursorMovementCommand = false;
                            again = ev.eventType !== EventType.MouseUp;
                        }
                    } else if (ev.eventType === EventType.Keystroke) {
                        let keystroke = ev.param1;
                        const moveIncrement = (ev.controlKey || ev.shiftKey) ? 5 : 1;
                        keystroke = stripShiftFromMovementKeystrokeFn(keystroke);

                        switch (keystroke) {
                            case LEFT_ARROW: case LEFT_KEY: case NUMPAD_4:
                                if (keysMoveCursor && rogue.cursorLoc.x > 0) {
                                    rogue.cursorLoc.x -= moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case RIGHT_ARROW: case RIGHT_KEY: case NUMPAD_6:
                                if (keysMoveCursor && rogue.cursorLoc.x < DCOLS - 1) {
                                    rogue.cursorLoc.x += moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case UP_ARROW: case UP_KEY: case NUMPAD_8:
                                if (keysMoveCursor && rogue.cursorLoc.y > 0) {
                                    rogue.cursorLoc.y -= moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case DOWN_ARROW: case DOWN_KEY: case NUMPAD_2:
                                if (keysMoveCursor && rogue.cursorLoc.y < DROWS - 1) {
                                    rogue.cursorLoc.y += moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case UPLEFT_KEY: case NUMPAD_7:
                                if (keysMoveCursor && rogue.cursorLoc.x > 0 && rogue.cursorLoc.y > 0) {
                                    rogue.cursorLoc.x -= moveIncrement;
                                    rogue.cursorLoc.y -= moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case UPRIGHT_KEY: case NUMPAD_9:
                                if (keysMoveCursor && rogue.cursorLoc.x < DCOLS - 1 && rogue.cursorLoc.y > 0) {
                                    rogue.cursorLoc.x += moveIncrement;
                                    rogue.cursorLoc.y -= moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case DOWNLEFT_KEY: case NUMPAD_1:
                                if (keysMoveCursor && rogue.cursorLoc.x > 0 && rogue.cursorLoc.y < DROWS - 1) {
                                    rogue.cursorLoc.x -= moveIncrement;
                                    rogue.cursorLoc.y += moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case DOWNRIGHT_KEY: case NUMPAD_3:
                                if (keysMoveCursor && rogue.cursorLoc.x < DCOLS - 1 && rogue.cursorLoc.y < DROWS - 1) {
                                    rogue.cursorLoc.x += moveIncrement;
                                    rogue.cursorLoc.y += moveIncrement;
                                }
                                cursorMovementCommand = movementKeystroke = keysMoveCursor;
                                break;
                            case TAB_KEY: case SHIFT_TAB_KEY: case NUMPAD_0:
                                tabKey.value = true;
                                break;
                            case RETURN_KEY:
                                targetConfirmed.value = true;
                                break;
                            case ESCAPE_KEY: case ACKNOWLEDGE_KEY:
                                canceled.value = true;
                                break;
                            default:
                                break;
                        }
                    } else if (ev.eventType === EventType.RightMouseUp) {
                        // do nothing
                    } else {
                        again = true;
                    }

                    // Un-highlight sidebar if cursor moved off a visible entity
                    if (sidebarHighlighted) {
                        const cellFlags = pmap[rogue.cursorLoc.x]?.[rogue.cursorLoc.y]?.flags ?? 0;
                        const monst = monsterAtLocFn(rogue.cursorLoc);
                        const canSee = monst
                            ? !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE)
                            : false;

                        if ((!(cellFlags & (TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER)) || !canSee)
                            && (!(cellFlags & TileFlag.HAS_ITEM) || !(cellFlags & TileFlag.VISIBLE))
                            && (!cellHasTMFlagAt(rogue.cursorLoc, TerrainMechFlag.TM_LIST_IN_SIDEBAR)
                                || !(cellFlags & TileFlag.VISIBLE))) {
                            refreshSideBarRuntime(-1, -1, false);
                            sidebarHighlighted = false;
                        }
                    }

                    // Clamp cursor to valid range
                    if (targetCanLeaveMap && !movementKeystroke) {
                        rogue.cursorLoc.x = clamp(rogue.cursorLoc.x, -1, DCOLS);
                        rogue.cursorLoc.y = clamp(rogue.cursorLoc.y, -1, DROWS);
                    } else {
                        rogue.cursorLoc.x = clamp(rogue.cursorLoc.x, 0, DCOLS - 1);
                        rogue.cursorLoc.y = clamp(rogue.cursorLoc.y, 0, DROWS - 1);
                    }
                } while (again && !cursorMovementCommand);

                // Write event back to caller
                theEvent.value = ev;

                // Un-highlight sidebar on exit
                if (sidebarHighlighted) {
                    refreshSideBarRuntime(-1, -1, false);
                }

                // Write cursor location back
                cursorLoc.value = { ...rogue.cursorLoc };

                return !cursorMovementCommand;
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
            recordKeystroke(keystroke, controlKey, shiftKey) {
                recordKeystrokeFn(keystroke, controlKey, shiftKey, recordingBuffer, rogue.playbackMode);
            },
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
        async printHighScores(hiliteMostRecent: boolean) {
            printHighScoresFn(buildScreenContext(), hiliteMostRecent);
        },
        async confirm(_prompt: string, _alsoDuringPlayback: boolean) {
            // TODO: Wire to io-input confirm
            return false;
        },
        async waitForKeystrokeOrMouseClick() {
            commitDraws();
            await browserConsole.waitForEvent();
        },
        message: msgOps.message,

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

                // Re-check after awaiting — gameHasEnded may have been set
                // externally (e.g. by doGameOver or tests) while we were
                // waiting for an event. If so, don't dispatch the event.
                if (rogue.gameHasEnded) break;

                try {
                    if (event.eventType === EventType.Keystroke) {
                        await executeKeystrokeFn(inputCtx, event.param1, event.controlKey, event.shiftKey);
                    } else if (
                        event.eventType === EventType.MouseUp ||
                        event.eventType === EventType.RightMouseUp
                    ) {
                        await executeMouseClickFn(inputCtx, event);
                    } else if (event.eventType === EventType.MouseEnteredCell) {
                        // Bug 5 fix: Handle mouse hover for sidebar updates,
                        // flavor text, and path preview — mirrors C mainInputLoop
                        // logic (IO.c:651-694) that processes moveCursor results.
                        const mapX = windowToMapXFromDisplay(event.param1);
                        const mapY = windowToMapYFromDisplay(event.param2);

                        if (coordinatesAreInMap(mapX, mapY)) {
                            rogue.cursorLoc = { x: mapX, y: mapY };
                            refreshSideBarRuntime(mapX, mapY, false);
                            printLocationDescriptionFn(mapX, mapY, buildDescribeLocationContext());
                        } else if (
                            event.param1 >= 0
                            && event.param1 < mapToWindowX(0)
                            && event.param2 >= 0
                            && event.param2 < ROWS - 1
                            && rogue.sidebarLocationList[event.param2]
                            && coordinatesAreInMap(
                                rogue.sidebarLocationList[event.param2].x,
                                rogue.sidebarLocationList[event.param2].y,
                            )
                        ) {
                            // Mouse is over a sidebar entity — focus on it
                            const loc = rogue.sidebarLocationList[event.param2];
                            rogue.cursorLoc = { x: loc.x, y: loc.y };
                            refreshSideBarRuntime(loc.x, loc.y, false);
                            printLocationDescriptionFn(loc.x, loc.y, buildDescribeLocationContext());
                        }
                    }
                } catch (e) {
                    console.error("[BrogueCE] Error processing input event:", e);
                }
            }

            // Phase 2: if player died, show the interactive death screen now
            // that we're back in an async context.
            if (pendingDeathScreen) {
                const { killedBy, useCustomPhrasing } = pendingDeathScreen;
                pendingDeathScreen = null;
                await runDeathScreen(killedBy, useCustomPhrasing);
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

    return {
        menuCtx,
        displayBuffer,
        commitDraws,
        _test: {
            get monsters() { return monsters; },
            get player() { return player; },
            get pmap() { return pmap; },
            get rogue() { return rogue; },
        },
    };
}
