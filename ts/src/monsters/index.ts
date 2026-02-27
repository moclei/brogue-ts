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
