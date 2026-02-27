/*
 *  monster-spawning.test.ts — Tests for monster spawning functions
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    pickHordeType,
    forbiddenFlagsForMonster,
    avoidedFlagsForMonster,
    monsterCanSubmergeNow,
} from "../../src/monsters/monster-spawning.js";
import type { MonsterRNG } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { hordeCatalog } from "../../src/globals/horde-catalog.js";
import { MonsterType, StatusEffect } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TerrainFlag,
    HordeFlag,
    T_PATHING_BLOCKER,
    T_HARMFUL_TERRAIN,
} from "../../src/types/flags.js";
import { createCreature } from "../../src/monsters/monster-creation.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeTestRNG(overrides?: Partial<MonsterRNG>): MonsterRNG {
    return {
        randRange: overrides?.randRange ?? ((lo, _hi) => lo),
        randPercent: overrides?.randPercent ?? ((_pct) => false),
    };
}

// =============================================================================
// forbiddenFlagsForMonster
// =============================================================================

describe("forbiddenFlagsForMonster", () => {
    it("returns T_PATHING_BLOCKER for a normal monster with no special flags", () => {
        const goblin = monsterCatalog[MonsterType.MK_GOBLIN];
        const flags = forbiddenFlagsForMonster(goblin);
        expect(flags).toBe(T_PATHING_BLOCKER >>> 0);
    });

    it("clears T_IS_DEEP_WATER for flying monsters", () => {
        const bat = monsterCatalog[MonsterType.MK_VAMPIRE_BAT]; // MONST_FLIES
        const flags = forbiddenFlagsForMonster(bat);
        expect(flags & TerrainFlag.T_IS_DEEP_WATER).toBe(0);
        expect(flags & TerrainFlag.T_LAVA_INSTA_DEATH).toBe(0); // also cleared by MONST_FLIES
    });

    it("clears fire-related flags for fire-immune monsters", () => {
        const salamander = monsterCatalog[MonsterType.MK_SALAMANDER]; // MONST_IMMUNE_TO_FIRE
        const flags = forbiddenFlagsForMonster(salamander);
        expect(flags & TerrainFlag.T_IS_FIRE).toBe(0);
        expect(flags & TerrainFlag.T_SPONTANEOUSLY_IGNITES).toBe(0);
        expect(flags & TerrainFlag.T_LAVA_INSTA_DEATH).toBe(0);
    });

    it("clears deep water flag for water-immune monsters", () => {
        const eel = monsterCatalog[MonsterType.MK_EEL]; // MONST_IMMUNE_TO_WATER
        const flags = forbiddenFlagsForMonster(eel);
        expect(flags & TerrainFlag.T_IS_DEEP_WATER).toBe(0);
    });

    it("clears trap flags for flying monsters", () => {
        const wisp = monsterCatalog[MonsterType.MK_WILL_O_THE_WISP]; // MONST_FLIES
        const flags = forbiddenFlagsForMonster(wisp);
        expect(flags & TerrainFlag.T_AUTO_DESCENT).toBe(0);
        expect(flags & TerrainFlag.T_IS_DF_TRAP).toBe(0);
    });
});

// =============================================================================
// avoidedFlagsForMonster
// =============================================================================

describe("avoidedFlagsForMonster", () => {
    it("includes T_HARMFUL_TERRAIN and T_SACRED in addition to forbidden flags", () => {
        const goblin = monsterCatalog[MonsterType.MK_GOBLIN];
        const avoided = avoidedFlagsForMonster(goblin);
        const forbidden = forbiddenFlagsForMonster(goblin);
        // avoided should be a superset of forbidden
        expect(avoided & forbidden).toBe(forbidden);
        expect(avoided & T_HARMFUL_TERRAIN).not.toBe(0);
        expect(avoided & TerrainFlag.T_SACRED).not.toBe(0);
    });

    it("clears poison for inanimate monsters", () => {
        // Goblin totem is inanimate
        const totem = monsterCatalog[MonsterType.MK_GOBLIN_TOTEM];
        const avoided = avoidedFlagsForMonster(totem);
        expect(avoided & TerrainFlag.T_CAUSES_POISON).toBe(0);
        expect(avoided & TerrainFlag.T_CAUSES_DAMAGE).toBe(0);
    });

    it("clears poison for flying monsters", () => {
        const bat = monsterCatalog[MonsterType.MK_VAMPIRE_BAT];
        const avoided = avoidedFlagsForMonster(bat);
        expect(avoided & TerrainFlag.T_CAUSES_POISON).toBe(0);
    });
});

// =============================================================================
// pickHordeType
// =============================================================================

describe("pickHordeType", () => {
    it("returns -1 when no hordes match", () => {
        // Depth 100 with all flags forbidden — nothing should match
        const rng = makeTestRNG();
        const result = pickHordeType(100, MonsterType.MK_YOU, 0xFFFFFFFF, 0, hordeCatalog, rng);
        expect(result).toBe(-1);
    });

    it("selects a valid horde for depth 1", () => {
        const rng = makeTestRNG({ randRange: (lo, _hi) => lo });
        const result = pickHordeType(
            1,
            MonsterType.MK_YOU,
            HordeFlag.HORDE_IS_SUMMONED | HordeFlag.HORDE_MACHINE_BOSS,
            0,
            hordeCatalog,
            rng,
        );
        expect(result).toBeGreaterThanOrEqual(0);
        const horde = hordeCatalog[result];
        expect(horde.minLevel).toBeLessThanOrEqual(1);
        expect(horde.maxLevel).toBeGreaterThanOrEqual(1);
    });

    it("respects forbiddenFlags", () => {
        const rng = makeTestRNG({ randRange: (lo, _hi) => lo });
        // Forbid all regular hordes — only summoned should remain
        const result = pickHordeType(
            5,
            MonsterType.MK_YOU,
            HordeFlag.HORDE_IS_SUMMONED,
            0,
            hordeCatalog,
            rng,
        );
        if (result >= 0) {
            expect(hordeCatalog[result].flags & HordeFlag.HORDE_IS_SUMMONED).toBe(0);
        }
    });

    it("respects requiredFlags", () => {
        const rng = makeTestRNG({ randRange: (lo, _hi) => lo });
        const result = pickHordeType(
            15,
            MonsterType.MK_YOU,
            0,
            HordeFlag.HORDE_MACHINE_BOSS,
            hordeCatalog,
            rng,
        );
        if (result >= 0) {
            expect(hordeCatalog[result].flags & HordeFlag.HORDE_MACHINE_BOSS).not.toBe(0);
        }
    });

    it("finds summoned hordes by summoner type", () => {
        const rng = makeTestRNG({ randRange: (lo, _hi) => lo });
        const result = pickHordeType(
            0,
            MonsterType.MK_GOBLIN_CONJURER,
            0,
            0,
            hordeCatalog,
            rng,
        );
        expect(result).toBeGreaterThanOrEqual(0);
        const horde = hordeCatalog[result];
        expect(horde.flags & HordeFlag.HORDE_IS_SUMMONED).not.toBe(0);
        expect(horde.leaderType).toBe(MonsterType.MK_GOBLIN_CONJURER);
    });

    it("weights selection by frequency", () => {
        // With a custom catalog of two hordes, one with freq 1 and one with freq 99,
        // index 100 should select the second one.
        const testCatalog = [
            { ...hordeCatalog[0], frequency: 1, minLevel: 1, maxLevel: 40, flags: 0 },
            { ...hordeCatalog[0], frequency: 99, minLevel: 1, maxLevel: 40, flags: 0 },
        ];
        const rng = makeTestRNG({ randRange: (_lo, _hi) => 100 }); // index = 100 → past first (1), into second
        const result = pickHordeType(5, MonsterType.MK_YOU, 0, 0, testCatalog, rng);
        expect(result).toBe(1);
    });
});

// =============================================================================
// monsterCanSubmergeNow
// =============================================================================

describe("monsterCanSubmergeNow", () => {
    function makeSubmerger(): ReturnType<typeof createCreature> {
        const c = createCreature();
        const eel = monsterCatalog[MonsterType.MK_EEL]; // MONST_SUBMERGES
        c.info = {
            ...eel,
            damage: { ...eel.damage },
            foreColor: { ...eel.foreColor },
            bolts: [...eel.bolts],
        };
        c.loc = { x: 5, y: 5 };
        c.bookkeepingFlags = 0;
        c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
        return c;
    }

    it("returns true when conditions are met", () => {
        const monst = makeSubmerger();
        const result = monsterCanSubmergeNow(
            monst,
            () => true,   // TM_ALLOWS_SUBMERGING
            () => false,  // no blocking terrain
        );
        expect(result).toBe(true);
    });

    it("returns false when monster lacks MONST_SUBMERGES flag", () => {
        const monst = makeSubmerger();
        monst.info.flags &= ~MonsterBehaviorFlag.MONST_SUBMERGES;
        const result = monsterCanSubmergeNow(monst, () => true, () => false);
        expect(result).toBe(false);
    });

    it("returns false when terrain doesn't allow submerging", () => {
        const monst = makeSubmerger();
        const result = monsterCanSubmergeNow(
            monst,
            () => false,  // TM_ALLOWS_SUBMERGING = false
            () => false,
        );
        expect(result).toBe(false);
    });

    it("returns false when monster is seized", () => {
        const monst = makeSubmerger();
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SEIZED;
        const result = monsterCanSubmergeNow(monst, () => true, () => false);
        expect(result).toBe(false);
    });

    it("returns false when monster is captive", () => {
        const monst = makeSubmerger();
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        const result = monsterCanSubmergeNow(monst, () => true, () => false);
        expect(result).toBe(false);
    });

    it("returns false in lava without fire immunity", () => {
        const monst = makeSubmerger();
        // Remove fire immunity
        monst.info.flags &= ~(MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE | MonsterBehaviorFlag.MONST_INVULNERABLE);
        monst.status[StatusEffect.ImmuneToFire] = 0;

        const cellHasTMFlag = () => true; // allows submerging
        const cellHasTerrainFlag = (_loc: any, flag: number) => {
            // Return true for T_LAVA_INSTA_DEATH, false for T_OBSTRUCTS_PASSABILITY
            return flag === TerrainFlag.T_LAVA_INSTA_DEATH;
        };

        const result = monsterCanSubmergeNow(monst, cellHasTMFlag, cellHasTerrainFlag);
        expect(result).toBe(false);
    });
});
