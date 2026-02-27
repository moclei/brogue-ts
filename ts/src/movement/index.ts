/*
 *  movement/index.ts — Barrel exports for the movement module
 *  brogue-ts
 *
 *  This module contains the TypeScript port of src/brogue/Movement.c.
 *  Functions are organized into sub-modules by concern.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// === 7a: Map query helpers ===
export {
    highestPriorityLayer,
    layerWithTMFlag,
    layerWithFlag,
    tileFlavor,
    tileText,
    storeMemories,
    discover,
    isDisturbed,
    addScentToCell,
    getLocationFlags,
    describeLocation,
    printLocationDescription,
} from "./map-queries.js";
export type { MapQueryContext } from "./map-queries.js";

// === 7b: Player movement ===
export {
    randValidDirectionFrom,
    vomit,
    moveEntrancedMonsters,
    playerRuns,
    playerMoves,
} from "./player-movement.js";
export type { PlayerMoveContext } from "./player-movement.js";

// === 7c: Extended weapon attacks ===
export {
    abortAttackAgainstAcidicTarget,
    abortAttackAgainstDiscordantAlly,
    abortAttack,
    handleWhipAttacks,
    handleSpearAttacks,
    buildFlailHitList,
} from "./weapon-attacks.js";
export type { WeaponAttackContext } from "./weapon-attacks.js";

// === 7d: Ally/captive management ===
export {
    becomeAllyWith,
    freeCaptive,
    freeCaptivesEmbeddedAt,
} from "./ally-management.js";
export type { AllyManagementContext } from "./ally-management.js";

// === 7e: Travel & explore ===
export {
    nextStep,
    displayRoute,
    travelRoute,
    travelMap,
    travel,
    getExploreMap,
    adjacentFightingDir,
    startFighting,
    explore,
    autoPlayLevel,
    proposeOrConfirmLocation,
    useStairs,
} from "./travel-explore.js";
export type { TravelExploreContext } from "./travel-explore.js";

// === 7f: Cost maps & FOV display ===
export {
    populateGenericCostMap,
    populateCreatureCostMap,
    updateFieldOfViewDisplay,
} from "./cost-maps-fov.js";
export type { CostMapFovContext } from "./cost-maps-fov.js";

// === 7g: Item description helpers ===
export {
    describedItemBasedOnParameters,
    describedItemName,
    useKeyAt,
    search,
} from "./item-helpers.js";
export type { ItemHelperContext } from "./item-helpers.js";
