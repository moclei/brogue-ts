/*
 *  game-constants.ts — BrogueCE variant game constants
 *  Port V2 — rogue-ts
 *
 *  Ported from runtime.ts (BROGUE_GAME_CONSTANTS) and GlobalsBrogue.c.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { GameConstants } from "../types/types.js";

/**
 * Default game constants for the BrogueCE variant.
 *
 * Counts (numberAutogenerators, numberBoltKinds, etc.) are 0 here and
 * filled in by initializeGameVariantBrogue() at game-init time, since
 * they depend on the catalog lengths set up during variant init.
 */
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
    extraItemsPerLevel: 0,
    goldAdjustmentStartDepth: 6,
    machinesPerLevelSuppressionMultiplier: 4,
    machinesPerLevelSuppressionOffset: 2,
    machinesPerLevelIncreaseFactor: 1,
    maxLevelForBonusMachines: 2,
    deepestLevelForMachines: 26,
    playerTransferenceRatio: 20,
    onHitHallucinateDuration: 20,
    onHitWeakenDuration: 300,
    onHitMercyHealPercent: 50,
    fallDamageMin: 8,
    fallDamageMax: 10,
    weaponKillsToAutoID: 20,
    armorDelayToAutoID: 1000,
    ringDelayToAutoID: 1500,
    numberAutogenerators: 0,   // set by initializeGameVariantBrogue
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
