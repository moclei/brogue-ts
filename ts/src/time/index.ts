/*
 *  time/index.ts — Barrel exports for the time module
 *  brogue-ts
 *
 *  This module re-exports all time-related functions ported from Time.c.
 */

// 8a: Turn processing core
export {
    scentDistance,
    recordCurrentCreatureHealths,
    addXPXPToAlly,
    handleXPXP,
    playerRecoversFromAttacking,
    synchronizePlayerTimeState,
    resetScentTurnNumber,
    playerTurnEnded,
    type TurnProcessingContext,
} from "./turn-processing.js";

// 8b: Status / creature effects
export {
    exposeCreatureToFire,
    extinguishFireOnCreature,
    burnItem,
    applyInstantTileEffectsToCreature,
    applyGradualTileEffectsToCreature,
    monsterShouldFall,
    monstersFall,
    decrementPlayerStatus,
    playerFalls,
    checkNutrition,
    handleHealthAlerts,
    flashCreatureAlert,
    updatePlayerUnderwaterness,
    updateFlavorText,
    type CreatureEffectsContext,
} from "./creature-effects.js";

// 8c: Environment updates
export {
    updateEnvironment,
    promoteTile,
    activateMachine,
    circuitBreakersPreventActivation,
    exposeTileToFire,
    exposeTileToElectricity,
    updateVolumetricMedia,
    nbDirs,
    type EnvironmentContext,
} from "./environment.js";

// 8d: Safety maps & vision
export {
    updateClairvoyance,
    updateTelepathy,
    updateVision,
    resetDistanceCellInGrid,
    updateAllySafetyMap,
    updateSafetyMap,
    updateSafeTerrainMap,
    PDS_FORBIDDEN,
    PDS_OBSTRUCTION,
    type SafetyMapsContext,
} from "./safety-maps.js";

// 8e: Misc helpers
export {
    staffChargeDuration,
    rechargeItemsIncrementally,
    processIncrementalAutoID,
    dangerChanged,
    autoRest,
    manualSearch,
    updateYendorWardenTracking,
    monsterEntersLevel,
    monstersApproachStairs,
    type MiscHelpersContext,
} from "./misc-helpers.js";
