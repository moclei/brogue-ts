/*
 *  monsters/index.ts — Barrel export for monster module
 *  brogue-ts
 */

export {
    createCreature,
    generateMonster,
    initializeMonster,
    initializeStatus,
    initializeGender,
    mutateMonster,
} from "./monster-creation.js";

export type {
    MonsterRNG,
    MonsterGenContext,
} from "./monster-creation.js";

export {
    pickHordeType,
    forbiddenFlagsForMonster,
    avoidedFlagsForMonster,
    monsterCanSubmergeNow,
    spawnMinions,
    spawnHorde,
    populateMonsters,
    spawnPeriodicHorde,
} from "./monster-spawning.js";

export type {
    SpawnContext,
} from "./monster-spawning.js";

export {
    monsterRevealed,
    monsterHiddenBySubmersion,
    monsterIsHidden,
    canSeeMonster,
    canDirectlySeeMonster,
    monsterName,
    monsterIsInClass,
    attackWouldBeFutile,
    monsterWillAttackTarget,
    monstersAreTeammates,
    monstersAreEnemies,
} from "./monster-queries.js";

export type {
    MonsterQueryContext,
} from "./monster-queries.js";

export {
    distanceBetween,
    alertMonster,
    wakeUp,
    empowerMonster,
    chooseNewWanderDestination,
    monsterFleesFrom,
    monsterAvoids,
    updateMonsterState,
    decrementMonsterStatus,
} from "./monster-state.js";

export type {
    MonsterStateContext,
} from "./monster-state.js";

export {
    canPass,
    isPassableOrSecretDoor,
    setMonsterLocation,
    moveMonster,
    findAlternativeHomeFor,
    getQualifyingLocNear,
    getQualifyingGridLocNear,
} from "./monster-movement.js";

export type {
    MonsterMovementContext,
    MoveMonsterContext,
} from "./monster-movement.js";
