/*
 *  monster-creation.test.ts — Tests for monster creation & initialization
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    createCreature,
    generateMonster,
    initializeMonster,
    initializeStatus,
    initializeGender,
    mutateMonster,
} from "../../src/monsters/monster-creation.js";
import type { MonsterRNG, MonsterGenContext } from "../../src/monsters/monster-creation.js";
import type { Creature, CreatureType, GameConstants } from "../../src/types/types.js";
import { MonsterType, StatusEffect, CreatureState, CreatureMode } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterAbilityFlag,
    MonsterBookkeepingFlag,
} from "../../src/types/flags.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { mutationCatalog } from "../../src/globals/mutation-catalog.js";
import { MAX_WAYPOINT_COUNT, STOMACH_SIZE } from "../../src/types/constants.js";

// =============================================================================
// Test helpers
// =============================================================================

/** Create a deterministic RNG for testing. */
function makeTestRNG(overrides?: Partial<MonsterRNG>): MonsterRNG {
    return {
        randRange: overrides?.randRange ?? ((lo, hi) => lo),
        randPercent: overrides?.randPercent ?? ((_pct) => false),
    };
}

/** Create a minimal GameConstants for testing. */
function makeTestGameConstants(overrides?: Partial<GameConstants>): GameConstants {
    return {
        majorVersion: 1,
        minorVersion: 0,
        patchVersion: 0,
        variantName: "test",
        versionString: "1.0.0",
        dungeonVersionString: "1",
        patchVersionPattern: "",
        recordingVersionString: "",
        deepestLevel: 40,
        amuletLevel: 26,
        depthAccelerator: 1,
        minimumAltarLevel: 4,
        minimumLavaLevel: 4,
        minimumBrimstoneLevel: 17,
        mutationsOccurAboveLevel: 8,
        monsterOutOfDepthChance: 15,
        extraItemsPerLevel: 1,
        goldAdjustmentStartDepth: 4,
        machinesPerLevelSuppressionMultiplier: 32,
        machinesPerLevelSuppressionOffset: 4,
        machinesPerLevelIncreaseFactor: 4,
        maxLevelForBonusMachines: 12,
        deepestLevelForMachines: 37,
        playerTransferenceRatio: 40,
        onHitHallucinateDuration: 20,
        onHitWeakenDuration: 300,
        onHitMercyHealPercent: 50,
        fallDamageMin: 8,
        fallDamageMax: 10,
        weaponKillsToAutoID: 20,
        armorDelayToAutoID: 1400,
        ringDelayToAutoID: 1500,
        numberAutogenerators: 0,
        numberBoltKinds: 0,
        ...overrides,
    } as GameConstants;
}

/** Create a minimal MonsterGenContext for testing. */
function makeTestContext(overrides?: Partial<MonsterGenContext>): MonsterGenContext {
    return {
        rng: makeTestRNG(),
        gameConstants: makeTestGameConstants(),
        depthLevel: 5,
        monsterCatalog,
        mutationCatalog,
        monsterItemsHopper: [],
        itemsEnabled: true,
        ...overrides,
    };
}

// =============================================================================
// createCreature
// =============================================================================

describe("createCreature", () => {
    it("returns a creature with all fields initialized to defaults", () => {
        const c = createCreature();

        expect(c.loc).toEqual({ x: 0, y: 0 });
        expect(c.depth).toBe(0);
        expect(c.currentHP).toBe(0);
        expect(c.mutationIndex).toBe(-1);
        expect(c.wasNegated).toBe(false);
        expect(c.leader).toBeNull();
        expect(c.carriedMonster).toBeNull();
        expect(c.carriedItem).toBeNull();
        expect(c.mapToMe).toBeNull();
        expect(c.safetyMap).toBeNull();
        expect(c.waypointAlreadyVisited).toHaveLength(MAX_WAYPOINT_COUNT);
        expect(c.status).toHaveLength(StatusEffect.NumberOfStatusEffects);
        expect(c.maxStatus).toHaveLength(StatusEffect.NumberOfStatusEffects);
    });
});

// =============================================================================
// initializeStatus
// =============================================================================

describe("initializeStatus", () => {
    it("sets all status values to zero for a normal monster", () => {
        const c = createCreature();
        c.info = { ...monsterCatalog[MonsterType.MK_GOBLIN], damage: { ...monsterCatalog[MonsterType.MK_GOBLIN].damage }, foreColor: { ...monsterCatalog[MonsterType.MK_GOBLIN].foreColor }, bolts: [...monsterCatalog[MonsterType.MK_GOBLIN].bolts] };
        initializeStatus(c);

        // Goblin has no intrinsic flags, so all should be 0 except nutrition
        for (let i = 0; i < StatusEffect.NumberOfStatusEffects; i++) {
            if (i === StatusEffect.Nutrition) continue;
            expect(c.status[i]).toBe(0);
        }
        expect(c.status[StatusEffect.Nutrition]).toBe(1000);
    });

    it("sets intrinsic statuses for a fiery flying monster", () => {
        const c = createCreature();
        c.info = { ...monsterCatalog[MonsterType.MK_WILL_O_THE_WISP], damage: { ...monsterCatalog[MonsterType.MK_WILL_O_THE_WISP].damage }, foreColor: { ...monsterCatalog[MonsterType.MK_WILL_O_THE_WISP].foreColor }, bolts: [...monsterCatalog[MonsterType.MK_WILL_O_THE_WISP].bolts] };
        initializeStatus(c);

        // Wisp has MONST_FLIES, MONST_IMMUNE_TO_FIRE, and MONST_FIERY
        expect(c.status[StatusEffect.Burning]).toBe(1000);
        expect(c.status[StatusEffect.Levitating]).toBe(1000);
        expect(c.status[StatusEffect.ImmuneToFire]).toBe(1000);
    });

    it("sets invisible status for invisible monsters", () => {
        const c = createCreature();
        c.info = { ...monsterCatalog[MonsterType.MK_PHANTOM], damage: { ...monsterCatalog[MonsterType.MK_PHANTOM].damage }, foreColor: { ...monsterCatalog[MonsterType.MK_PHANTOM].foreColor }, bolts: [...monsterCatalog[MonsterType.MK_PHANTOM].bolts] };
        initializeStatus(c);

        expect(c.status[StatusEffect.Invisible]).toBe(1000);
    });

    it("sets player nutrition to STOMACH_SIZE", () => {
        const c = createCreature();
        c.info = { ...monsterCatalog[MonsterType.MK_YOU], damage: { ...monsterCatalog[MonsterType.MK_YOU].damage }, foreColor: { ...monsterCatalog[MonsterType.MK_YOU].foreColor }, bolts: [...monsterCatalog[MonsterType.MK_YOU].bolts] };
        initializeStatus(c, true);

        expect(c.status[StatusEffect.Nutrition]).toBe(STOMACH_SIZE);
        expect(c.maxStatus[StatusEffect.Nutrition]).toBe(STOMACH_SIZE);
    });
});

// =============================================================================
// initializeGender
// =============================================================================

describe("initializeGender", () => {
    it("removes one gender flag when both are set (male on 50%)", () => {
        const c = createCreature();
        c.info = {
            ...monsterCatalog[MonsterType.MK_OGRE],
            damage: { ...monsterCatalog[MonsterType.MK_OGRE].damage },
            foreColor: { ...monsterCatalog[MonsterType.MK_OGRE].foreColor },
            bolts: [...monsterCatalog[MonsterType.MK_OGRE].bolts],
        };
        // Ogre has both MONST_MALE and MONST_FEMALE
        expect(c.info.flags & MonsterBehaviorFlag.MONST_MALE).not.toBe(0);
        expect(c.info.flags & MonsterBehaviorFlag.MONST_FEMALE).not.toBe(0);

        // randPercent(50) returns true → remove MONST_MALE
        const rng = makeTestRNG({ randPercent: () => true });
        initializeGender(c, rng);

        expect(c.info.flags & MonsterBehaviorFlag.MONST_MALE).toBe(0);
        expect(c.info.flags & MonsterBehaviorFlag.MONST_FEMALE).not.toBe(0);
    });

    it("keeps both flags unchanged when only one is set", () => {
        const c = createCreature();
        c.info = {
            ...monsterCatalog[MonsterType.MK_CENTAUR], // male only
            damage: { ...monsterCatalog[MonsterType.MK_CENTAUR].damage },
            foreColor: { ...monsterCatalog[MonsterType.MK_CENTAUR].foreColor },
            bolts: [...monsterCatalog[MonsterType.MK_CENTAUR].bolts],
        };

        const rng = makeTestRNG();
        const flagsBefore = c.info.flags;
        initializeGender(c, rng);

        expect(c.info.flags).toBe(flagsBefore);
    });
});

// =============================================================================
// mutateMonster
// =============================================================================

describe("mutateMonster", () => {
    it("applies mutation index 0 (explosive) correctly", () => {
        const c = createCreature();
        c.info = {
            ...monsterCatalog[MonsterType.MK_OGRE],
            damage: { ...monsterCatalog[MonsterType.MK_OGRE].damage },
            foreColor: { ...monsterCatalog[MonsterType.MK_OGRE].foreColor },
            bolts: [...monsterCatalog[MonsterType.MK_OGRE].bolts],
        };
        const originalHP = c.info.maxHP;
        const originalDef = c.info.defense;

        mutateMonster(c, 0, mutationCatalog);

        expect(c.mutationIndex).toBe(0);
        // Explosive mutation: healthFactor=50, defenseFactor=50
        expect(c.info.maxHP).toBe(Math.floor(originalHP * 50 / 100));
        expect(c.info.defense).toBe(Math.floor(originalDef * 50 / 100));
        // Should have MA_DF_ON_DEATH added
        expect(c.info.abilityFlags & MonsterAbilityFlag.MA_DF_ON_DEATH).not.toBe(0);
    });

    it("enforces minimum damage bounds", () => {
        const c = createCreature();
        c.info = {
            ...monsterCatalog[MonsterType.MK_RAT],
            damage: { ...monsterCatalog[MonsterType.MK_RAT].damage },
            foreColor: { ...monsterCatalog[MonsterType.MK_RAT].foreColor },
            bolts: [...monsterCatalog[MonsterType.MK_RAT].bolts],
        };
        // Rat does 1-3 damage
        expect(c.info.damage.lowerBound).toBe(1);

        // Apply a mutation with damageFactor that would reduce to 0
        // explosive: damageFactor=100 → doesn't reduce
        // Let's use a custom mutation for this test
        const testMutation = {
            ...mutationCatalog[0],
            damageFactor: 1, // 1% → floor to 0, but should clamp to 1
        };

        mutateMonster(c, 0, [testMutation]);

        expect(c.info.damage.lowerBound).toBeGreaterThanOrEqual(1);
    });

    it("does not modify damage when damage bounds are zero", () => {
        const c = createCreature();
        // Goblin totem has 0,0,0 damage
        c.info = {
            ...monsterCatalog[MonsterType.MK_GOBLIN_TOTEM],
            damage: { ...monsterCatalog[MonsterType.MK_GOBLIN_TOTEM].damage },
            foreColor: { ...monsterCatalog[MonsterType.MK_GOBLIN_TOTEM].foreColor },
            bolts: [...monsterCatalog[MonsterType.MK_GOBLIN_TOTEM].bolts],
        };

        mutateMonster(c, 0, mutationCatalog);

        expect(c.info.damage.lowerBound).toBe(0);
        expect(c.info.damage.upperBound).toBe(0);
    });
});

// =============================================================================
// initializeMonster
// =============================================================================

describe("initializeMonster", () => {
    it("sets basic creature properties from info", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_GOBLIN];
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const ctx = makeTestContext({ depthLevel: 5 });
        initializeMonster(c, false, ctx);

        expect(c.depth).toBe(5);
        expect(c.spawnDepth).toBe(5);
        expect(c.currentHP).toBe(catEntry.maxHP);
        expect(c.movementSpeed).toBe(catEntry.movementSpeed);
        expect(c.attackSpeed).toBe(catEntry.attackSpeed);
        expect(c.ticksUntilTurn).toBe(catEntry.movementSpeed);
        expect(c.turnsUntilRegen).toBe(catEntry.turnsBetweenRegen * 1000);
        expect(c.creatureMode).toBe(CreatureMode.Normal);
        expect(c.xpxp).toBe(0);
        expect(c.machineHome).toBe(0);
        expect(c.leader).toBeNull();
        expect(c.carriedMonster).toBeNull();
    });

    it("sets creature to sleeping when randPercent(25) is false and not NEVER_SLEEPS", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_GOBLIN];
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const rng = makeTestRNG({ randPercent: () => false });
        const ctx = makeTestContext({ rng });
        initializeMonster(c, false, ctx);

        expect(c.creatureState).toBe(CreatureState.Sleeping);
    });

    it("sets NEVER_SLEEPS creatures to TRACKING_SCENT", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_EEL]; // has MONST_NEVER_SLEEPS
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const rng = makeTestRNG({ randPercent: () => false });
        const ctx = makeTestContext({ rng });
        initializeMonster(c, false, ctx);

        expect(c.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("does not assign item when itemPossible is false", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_DRAGON]; // CARRY_ITEM_100
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const mockItem = { originDepth: 0 } as any;
        const ctx = makeTestContext({ monsterItemsHopper: [mockItem] });
        initializeMonster(c, false, ctx);

        expect(c.carriedItem).toBeNull();
        expect(ctx.monsterItemsHopper).toHaveLength(1); // item not consumed
    });

    it("assigns item from hopper when itemPossible and chance succeeds", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_DRAGON]; // CARRY_ITEM_100
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const mockItem = { originDepth: 0 } as any;
        const rng = makeTestRNG({ randPercent: () => true }); // all percent checks pass
        const ctx = makeTestContext({
            rng,
            monsterItemsHopper: [mockItem],
            depthLevel: 5,
        });
        initializeMonster(c, true, ctx);

        expect(c.carriedItem).toBe(mockItem);
        expect(mockItem.originDepth).toBe(5);
        expect(ctx.monsterItemsHopper).toHaveLength(0); // item consumed
    });

    it("sets MB_WEAPON_AUTO_ID for animate creatures", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_GOBLIN]; // not inanimate
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const ctx = makeTestContext();
        initializeMonster(c, false, ctx);

        expect(c.bookkeepingFlags & MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID).not.toBe(0);
    });

    it("initializes waypoint visited array", () => {
        const c = createCreature();
        const catEntry = monsterCatalog[MonsterType.MK_GOBLIN];
        c.info = {
            ...catEntry,
            damage: { ...catEntry.damage },
            foreColor: { ...catEntry.foreColor },
            bolts: [...catEntry.bolts],
        };
        initializeStatus(c);

        const ctx = makeTestContext();
        initializeMonster(c, false, ctx);

        expect(c.waypointAlreadyVisited).toHaveLength(MAX_WAYPOINT_COUNT);
    });
});

// =============================================================================
// generateMonster
// =============================================================================

describe("generateMonster", () => {
    it("creates a fully initialized creature of the given type", () => {
        const ctx = makeTestContext({ depthLevel: 5 });
        const monst = generateMonster(MonsterType.MK_GOBLIN, false, false, ctx);

        expect(monst.info.monsterID).toBe(MonsterType.MK_GOBLIN);
        expect(monst.info.monsterName).toBe("goblin");
        expect(monst.currentHP).toBe(monsterCatalog[MonsterType.MK_GOBLIN].maxHP);
        expect(monst.depth).toBe(5);
        expect(monst.spawnDepth).toBe(5);
        expect(monst.mutationIndex).toBe(-1); // no mutation at depth 5
    });

    it("does not mutate when mutationPossible is false", () => {
        // At depth 20 mutations would normally be possible
        const rng = makeTestRNG({ randPercent: () => true, randRange: () => 0 });
        const ctx = makeTestContext({ depthLevel: 20, rng });
        const monst = generateMonster(MonsterType.MK_OGRE, false, false, ctx);

        expect(monst.mutationIndex).toBe(-1);
    });

    it("does not mutate at depth below mutationsOccurAboveLevel", () => {
        // depth 5, mutationsOccurAboveLevel = 8
        const rng = makeTestRNG({ randPercent: () => true, randRange: () => 0 });
        const ctx = makeTestContext({ depthLevel: 5, rng });
        const monst = generateMonster(MonsterType.MK_OGRE, false, true, ctx);

        expect(monst.mutationIndex).toBe(-1);
    });

    it("can mutate a monster at sufficient depth", () => {
        // depth 10 > mutationsOccurAboveLevel(8), mutationChance = (10-8)*1 = 2, clamped to [1,10]
        const rng = makeTestRNG({
            randPercent: () => true, // all percent checks pass
            randRange: (lo, _hi) => lo, // return first valid mutation (0)
        });
        const ctx = makeTestContext({ depthLevel: 10, rng });
        const monst = generateMonster(MonsterType.MK_OGRE, false, true, ctx);

        // mutation 0 is "explosive" — has forbiddenFlags for MONST_SUBMERGES
        // Ogre doesn't have MONST_SUBMERGES, so mutation should apply
        expect(monst.mutationIndex).toBe(0);
    });

    it("deep copies the catalog entry so mutations don't affect the catalog", () => {
        const ctx = makeTestContext({ depthLevel: 5 });
        const monst1 = generateMonster(MonsterType.MK_OGRE, false, false, ctx);
        monst1.info.maxHP = 999;

        const monst2 = generateMonster(MonsterType.MK_OGRE, false, false, ctx);
        expect(monst2.info.maxHP).toBe(monsterCatalog[MonsterType.MK_OGRE].maxHP);
    });

    it("generates distinct creatures with independent state", () => {
        const ctx = makeTestContext();
        const m1 = generateMonster(MonsterType.MK_RAT, false, false, ctx);
        const m2 = generateMonster(MonsterType.MK_RAT, false, false, ctx);

        expect(m1).not.toBe(m2);
        m1.currentHP = 0;
        expect(m2.currentHP).toBe(monsterCatalog[MonsterType.MK_RAT].maxHP);
    });
});
