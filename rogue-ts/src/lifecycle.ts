/*
 *  lifecycle.ts — Game lifecycle context builders
 *  Port V2 — rogue-ts
 *
 *  Provides module-level lifecycle state and builds the DI contexts required
 *  by the game domain functions:
 *    buildGameInitContext()  → GameInitContext  (game-init.ts)
 *    buildLevelContext()     → LevelContext     (game-level.ts) — see lifecycle-level.ts
 *    buildCleanupContext()   → CleanupContext   (game-cleanup.ts)
 *
 *  Public API:
 *    initializeRogue(seed)   — reset game state and initialize a new game
 *    startLevel(old, dir)    — save current level and transition to next
 *    freeEverything()        — release all level resources after game ends
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, setMonsters, setDormantMonsters, setLevels, getScentMap, setScentMap } from "./core.js";
import { refreshSpriteDataProvider } from "./platform.js";
import { initializeRogue as initializeRogueFn } from "./game/game-init.js";
import { startLevel as startLevelFn } from "./game/game-level.js";
import { freeEverything as freeEverythingFn } from "./game/game-cleanup.js";
import { dynamicColorsBounds } from "./globals/tables.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { LightType } from "./types/enums.js";
import { meteredItemsGenerationTable, wandTable, charmTable } from "./globals/item-catalog.js";
import { featCatalog } from "./globals/feat-catalog.js";
import { autoGeneratorCatalog } from "./globals/autogenerator-catalog.js";
import { blueprintCatalog } from "./globals/blueprint-catalog.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { buildLevelContext, chooseVorpalEnemy } from "./lifecycle-level.js";
import { itemMessageColor, white, backgroundMessageColor } from "./globals/colors.js";
import { KEYBOARD_LABELS, MESSAGE_ARCHIVE_ENTRIES } from "./types/constants.js";
import { seedRandomGenerator, randRange, rand64bits, randPercent, randClump } from "./math/rng.js";
import { allocGrid, fillGrid, freeGrid } from "./grid/grid.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { zeroOutGrid } from "./architect/helpers.js";
import { distanceBetween } from "./monsters/monster-state.js";
import { encodeMessageColor } from "./io/color.js";
import { addItemToPack, deleteItem as deleteItemFn } from "./items/item-inventory.js";
import { identify, shuffleFlavors, itemColors, itemTitles } from "./items/item-naming.js";
import { equipItem, recalculateEquipmentBonuses, updateRingBonuses as updateRingBonusesFn, updateEncumbrance as updateEncumbranceFn } from "./items/item-usage.js";
import type { EquipContext } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses, syncEquipState } from "./items/equip-helpers.js";
import { generateItem } from "./items/item-generation.js";
import { initializeGender, initializeStatus } from "./monsters/monster-creation.js";
import { blackOutScreen } from "./io/display.js";
import { clearMessageArchive } from "./io/messages.js";
import { deleteAllFlares } from "./light/flares.js";
import { resetDFMessageEligibility } from "./architect/architect.js";
import type { Creature, Color, LevelData } from "./types/types.js";
import type { GameInitContext } from "./game/game-init.js";
import type { CleanupContext } from "./game/game-cleanup.js";
import { buildMessageFns } from "./io-wiring.js";

// =============================================================================
// Module-level lifecycle state (not in core.ts)
// =============================================================================

let dynamicColors: Color[] = dynamicColorsBounds.map(([start]) => ({ ...start }));

let safetyMap: number[][] | null = allocGrid();
let allySafetyMap: number[][] | null = allocGrid();
let chokeMap: number[][] | null = allocGrid();
let purgatory: Creature[] = [];
let previousGameSeed: bigint = 0n;

const messageArchive: { message: string }[] = Array.from(
    { length: MESSAGE_ARCHIVE_ENTRIES }, () => ({ message: "" }),
);
let messageArchivePosition = 0;

// =============================================================================
// Module-level state getters (used by lifecycle-level.ts)
// =============================================================================

/** Exposes chokeMap for buildLevelContext in lifecycle-level.ts. */
export function getChokeMap(): number[][] | null { return chokeMap; }
/** Exposes dynamicColors for buildLevelContext in lifecycle-level.ts. */
export function getDynamicColors(): Color[] { return dynamicColors; }

// buildLevelContext is in lifecycle-level.ts (extracted to keep this file under 600 lines).
export { buildLevelContext };

// =============================================================================
// buildGameInitContext
// =============================================================================

export function buildGameInitContext(): GameInitContext {
    const {
        rogue, player, gameConst, gameVariant, monsterCatalog,
        mutableScrollTable, mutablePotionTable, messageState, displayBuffer,
        monsters, dormantMonsters, floorItems, packItems, monsterItemsHopper,
    } = getGameState();
    const { message, messageWithColor } = buildMessageFns();

    return {
        rogue, player, gameConst, gameVariant, monsterCatalog,
        meteredItemsGenerationTable, featTable: featCatalog,
        lightCatalog, MINERS_LIGHT: LightType.MINERS_LIGHT,
        dynamicColorsBounds, dynamicColors,
        displayDetail, terrainRandomValues,
        messageArchive, messageArchivePosition,
        setMessageArchivePosition(n) { messageArchivePosition = n; },
        previousGameSeed,
        setPreviousGameSeed(seed) { previousGameSeed = seed; },
        levels: [] as unknown as LevelData[],
        setLevels,
        monsters, dormantMonsters, setMonsters, setDormantMonsters,
        floorItems, packItems, monsterItemsHopper, purgatory,
        safetyMap: safetyMap!,
        allySafetyMap: allySafetyMap!,
        chokeMap: chokeMap!,
        scentMap: getScentMap(),
        setScentMap,
        seedRandomGenerator, rand_range: randRange, rand_64bits: rand64bits,
        allocGrid, fillGrid, zeroOutGrid, freeGrid, distanceBetween,
        generateItem(category, kind) {
            return generateItem(category, kind, {
                rng: { randRange, randPercent, randClump },
                gameConstants: gameConst, depthLevel: rogue.depthLevel,
                scrollTable: mutableScrollTable, potionTable: mutablePotionTable,
                depthAccelerator: gameConst.depthAccelerator, chooseVorpalEnemy,
            });
        },
        addItemToPack(item) { return addItemToPack(item, packItems); },
        identify(item) { identify(item, gameConst, { scrollTable: mutableScrollTable, potionTable: mutablePotionTable }); },
        equipItem(item, willUnequip, swapItem) {
            const state = buildEquipState();
            const equipCtx: EquipContext = {
                state,
                message: (text, _ack) => message(text, 0),
                updateRingBonuses: () => { updateRingBonusesFn(state); syncEquipBonuses(state); },
                updateEncumbrance: () => updateEncumbranceFn(state),
                itemName: (i) => i.displayChar ? String.fromCharCode(i.displayChar) : "?",
            };
            equipItem(item, willUnequip, swapItem, equipCtx);
            syncEquipState(state);
        },
        recalculateEquipmentBonuses() {
            const state = buildEquipState();
            recalculateEquipmentBonuses(state);
            syncEquipBonuses(state);
        },
        initializeGender(monst) { initializeGender(monst, { randRange, randPercent }); },
        initializeStatus(monst) { initializeStatus(monst, monst === player); },
        initRecording: () => {},
        shuffleFlavors() {
            shuffleFlavors(gameConst, randRange, randPercent);
            // itemName reads mutablePotionTable/mutableScrollTable (shallow copies of catalog
            // arrays). Sync the shuffled flavor values so itemName sees the randomized strings.
            for (let i = 0; i < mutablePotionTable.length; i++) mutablePotionTable[i].flavor = itemColors[i];
            for (let i = 0; i < mutableScrollTable.length; i++) mutableScrollTable[i].flavor = itemTitles[i];
        },
        resetDFMessageEligibility() { resetDFMessageEligibility(dungeonFeatureCatalog); },
        deleteMessages() {
            for (let i = 0; i < messageState.displayedMessage.length; i++) {
                messageState.displayedMessage[i] = "";
            }
            messageState.messagesUnconfirmed = 0;
        },
        clearMessageArchive() { clearMessageArchive(messageState); },
        blackOutScreen(dbuf) { blackOutScreen(dbuf); },
        displayBuffer,
        message, messageWithColor, flavorMessage: () => {},
        encodeMessageColor,
        itemMessageColor, white, backgroundMessageColor,
        initializeGameVariantBrogue() {
            gameConst.numberScrollKinds = mutableScrollTable.length;
            gameConst.numberPotionKinds = mutablePotionTable.length;
            gameConst.numberWandKinds = wandTable.length;
            gameConst.numberCharmKinds = charmTable.length;
            gameConst.numberMeteredItems = meteredItemsGenerationTable.length;
            gameConst.numberAutogenerators = autoGeneratorCatalog.length;
            gameConst.numberBlueprints = blueprintCatalog.length;
            gameConst.numberHordes = hordeCatalog.length;
            gameConst.numberBoltKinds = boltCatalog.length;
        },
        initializeGameVariantRapidBrogue() {
            gameConst.deepestLevel = 10; gameConst.amuletLevel = 7; gameConst.depthAccelerator = 4;
            gameConst.numberScrollKinds = mutableScrollTable.length;
            gameConst.numberPotionKinds = mutablePotionTable.length;
            gameConst.numberWandKinds = wandTable.length;
            gameConst.numberCharmKinds = charmTable.length;
            gameConst.numberMeteredItems = meteredItemsGenerationTable.length;
            gameConst.numberAutogenerators = autoGeneratorCatalog.length;
            gameConst.numberBlueprints = blueprintCatalog.length;
            gameConst.numberHordes = hordeCatalog.length;
            gameConst.numberBoltKinds = boltCatalog.length;
        },
        initializeGameVariantBulletBrogue() {
            gameConst.deepestLevel = 5; gameConst.amuletLevel = 4; gameConst.depthAccelerator = 8;
            gameConst.numberScrollKinds = mutableScrollTable.length;
            gameConst.numberPotionKinds = mutablePotionTable.length;
            gameConst.numberWandKinds = wandTable.length;
            gameConst.numberCharmKinds = charmTable.length;
            gameConst.numberMeteredItems = meteredItemsGenerationTable.length;
            gameConst.numberAutogenerators = autoGeneratorCatalog.length;
            gameConst.numberBlueprints = blueprintCatalog.length;
            gameConst.numberHordes = hordeCatalog.length;
            gameConst.numberBoltKinds = boltCatalog.length;
        },
        KEYBOARD_LABELS,
    };
}

// =============================================================================
// buildCleanupContext
// =============================================================================

export function buildCleanupContext(): CleanupContext {
    const { rogue, player, gameConst, levels,
        monsters, dormantMonsters, floorItems, packItems, monsterItemsHopper } = getGameState();
    return {
        rogue, player, gameConst, levels, setLevels,
        monsters, dormantMonsters, floorItems, packItems, monsterItemsHopper,
        purgatory, safetyMap, allySafetyMap, chokeMap, scentMap: getScentMap(),
        setSafetyMap(map) { safetyMap = map; },
        setAllySafetyMap(map) { allySafetyMap = map; },
        setChokeMap(map) { chokeMap = map; },
        setScentMap,
        freeGrid,
        deleteItem: deleteItemFn,
        deleteAllFlares() { deleteAllFlares(rogue); },
    };
}

// =============================================================================
// Public entry points
// =============================================================================

/** Returns the seed of the most recently completed game. */
export function getPreviousGameSeed(): bigint { return previousGameSeed; }

/** Initialize game state for a new game from seed (0 = random). */
export function initializeRogue(seed: bigint): void {
    dynamicColors = dynamicColorsBounds.map(([start]) => ({ ...start }));
    // Re-allocate grids freed by freeEverything() — matches C initializeRogue behavior.
    // Without this, a second game (die → new game) passes null grids to buildLevelContext
    // and crashes when analyzeMap/machineContext access chokeMap[i][j].
    if (!safetyMap) safetyMap = allocGrid();
    if (!allySafetyMap) allySafetyMap = allocGrid();
    if (!chokeMap) chokeMap = allocGrid();
    initializeRogueFn(buildGameInitContext(), seed);
    // Wire a fresh CellSpriteDataProvider after initializeRogue replaces pmap/tmap.
    // This must happen before startLevel → displayLevel → commitDraws so that autotiled
    // sprites (walls, floors) use the layer pipeline on the very first frame.
    refreshSpriteDataProvider();
}

/** Transition to a new level. oldLevel = the level number being left (1-indexed). */
export function startLevel(oldLevel: number, stairDirection: number): void {
    startLevelFn(buildLevelContext(), oldLevel, stairDirection);
}

/** Release all game resources. Call after the game ends. */
export function freeEverything(): void {
    freeEverythingFn(buildCleanupContext());
}
