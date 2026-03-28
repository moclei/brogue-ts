/*
 *  lifecycle-debug.ts — Debug/cheat context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildDebugItemContext() for the in-game cheat panel (F2).
 *  Lives outside lifecycle.ts because that file is already at the 600-line limit.
 */

import { getGameState } from "./core.js";
import { randRange, randPercent, randClump } from "./math/rng.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { MONSTER_CLASS_COUNT } from "./types/constants.js";
import { MonsterType } from "./types/enums.js";
import type { ItemGenContext } from "./items/item-generation.js";

// Mirrors lifecycle.ts:chooseVorpalEnemy — needed for generateItem when assigning slaying runics.
function chooseVorpalEnemy(): number {
    const classIdx = randRange(0, MONSTER_CLASS_COUNT - 1);
    const cls = monsterClassCatalog[classIdx];
    if (!cls.memberList.length) return MonsterType.MK_RAT;
    return cls.memberList[randRange(0, cls.memberList.length - 1)];
}

/**
 * Builds the minimal ItemGenContext required by generateItem(), drawing from
 * current game state. Called by the F2 cheat panel's Give Item action.
 */
export function buildDebugItemContext(): ItemGenContext {
    const { gameConst, rogue, mutableScrollTable, mutablePotionTable } = getGameState();
    return {
        rng: { randRange, randPercent, randClump },
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        scrollTable: mutableScrollTable,
        potionTable: mutablePotionTable,
        depthAccelerator: gameConst.depthAccelerator,
        chooseVorpalEnemy,
    };
}
