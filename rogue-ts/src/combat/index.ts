/*
 *  combat/index.ts — Barrel export for combat module
 *  brogue-ts
 */

export {
    monsterDamageAdjustmentAmount,
    monsterDefenseAdjusted,
    monsterAccuracyAdjusted,
    hitProbability,
    attackHit,
    diagonalBlocked,
} from "./combat-math.js";

export type {
    CombatMathContext,
} from "./combat-math.js";

export {
    flashMonster,
    inflictDamage,
    inflictLethalDamage,
    addPoison,
    killCreature,
    heal,
} from "./combat-damage.js";

export type {
    CombatDamageContext,
} from "./combat-damage.js";

export {
    buildHitList,
    processStaggerHit,
    moralAttack,
    attack,
} from "./combat-attack.js";

export type {
    AttackContext,
} from "./combat-attack.js";

export {
    specialHit,
    magicWeaponHit,
    applyArmorRunicEffect,
} from "./combat-runics.js";

export type {
    RunicContext,
} from "./combat-runics.js";

export {
    strLenWithoutEscapes,
    CombatMessageBuffer,
    handlePaladinFeat,
    playerImmuneToMonster,
    decrementWeaponAutoIDTimer,
    attackVerb,
    splitMonster,
    anyoneWantABite,
} from "./combat-helpers.js";

export type {
    CombatHelperContext,
} from "./combat-helpers.js";
