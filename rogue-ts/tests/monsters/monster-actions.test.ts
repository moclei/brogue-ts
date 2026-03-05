/*
 *  monster-actions.test.ts — Tests for monster actions module
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    prependCreature,
    removeCreature,
    canNegateCreatureStatusEffects,
    negateCreatureStatusEffects,
    monsterSummons,
    monstersTurn,
} from "../../src/monsters/monster-actions.js";
import { StatusEffect, CreatureState, CreatureMode } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
} from "../../src/types/flags.js";
import type {
    Creature,
    StatusEffectInfo,
} from "../../src/types/types.js";
import type {
    MonsterSummonsContext,
    MonstersTurnContext,
} from "../../src/monsters/monster-actions.js";

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    const statusLen = Object.keys(StatusEffect).length / 2; // enum count
    return {
        loc: { x: 5, y: 5 },
        info: {
            monsterID: 0,
            monsterName: "test",
            displayChar: "t",
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 10,
            defense: 0,
            accuracy: 100,
            damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            turnsBetweenRegen: 20,
            movementSpeed: 100,
            attackSpeed: 100,
            bloodType: 0,
            intrinsicLightType: 0,
            DFChance: 0,
            DFType: 0,
            bolts: [],
            flags: 0,
            abilityFlags: 0,
        },
        currentHP: 10,
        movementSpeed: 100,
        attackSpeed: 100,
        turnsUntilRegen: 20,
        regenPerTurn: 0,
        ticksUntilTurn: 0,
        previousHealthPoints: 10,
        creatureState: CreatureState.Wandering,
        creatureMode: CreatureMode.Normal,
        mutationIndex: -1,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        status: new Array(statusLen).fill(0),
        maxStatus: new Array(statusLen).fill(0),
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
        targetCorpseLoc: { x: -1, y: -1 },
        corpseAbsorptionCounter: -1,
        targetWaypointIndex: -1,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: -1, y: -1 },
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        followers: [],
        mapToMe: null,
        safetyMap: null,
        ...overrides,
    } as Creature;
}

function makeStatusEffectCatalog(): StatusEffectInfo[] {
    const catalog: StatusEffectInfo[] = [];
    const statusLen = Object.keys(StatusEffect).length / 2;
    for (let i = 0; i < statusLen; i++) {
        catalog.push({
            isNegatable: false,
            playerNegatedValue: 0,
        });
    }
    // Mark some as negatable for testing
    catalog[StatusEffect.Hasted] = { isNegatable: true, playerNegatedValue: 0 };
    catalog[StatusEffect.Slowed] = { isNegatable: true, playerNegatedValue: 0 };
    catalog[StatusEffect.Invisible] = { isNegatable: true, playerNegatedValue: 0 };
    catalog[StatusEffect.Telepathic] = { isNegatable: true, playerNegatedValue: 5 };
    catalog[StatusEffect.Darkness] = { isNegatable: true, playerNegatedValue: 0 };
    return catalog;
}

// ───────────────────────────────────────────────────────────────
// prependCreature
// ───────────────────────────────────────────────────────────────

describe("prependCreature", () => {
    it("adds creature to front of array", () => {
        const a = makeCreature({ currentHP: 1 });
        const b = makeCreature({ currentHP: 2 });
        const list: Creature[] = [b];
        prependCreature(list, a);
        expect(list).toHaveLength(2);
        expect(list[0]).toBe(a);
        expect(list[1]).toBe(b);
    });

    it("adds to empty array", () => {
        const a = makeCreature();
        const list: Creature[] = [];
        prependCreature(list, a);
        expect(list).toHaveLength(1);
        expect(list[0]).toBe(a);
    });
});

// ───────────────────────────────────────────────────────────────
// removeCreature
// ───────────────────────────────────────────────────────────────

describe("removeCreature", () => {
    it("removes creature from array", () => {
        const a = makeCreature({ currentHP: 1 });
        const b = makeCreature({ currentHP: 2 });
        const list = [a, b];
        const result = removeCreature(list, a);
        expect(result).toBe(true);
        expect(list).toHaveLength(1);
        expect(list[0]).toBe(b);
    });

    it("returns false if creature not found", () => {
        const a = makeCreature();
        const b = makeCreature();
        const list = [a];
        const result = removeCreature(list, b);
        expect(result).toBe(false);
        expect(list).toHaveLength(1);
    });
});

// ───────────────────────────────────────────────────────────────
// canNegateCreatureStatusEffects
// ───────────────────────────────────────────────────────────────

describe("canNegateCreatureStatusEffects", () => {
    const catalog = makeStatusEffectCatalog();

    it("returns false for null creature", () => {
        expect(canNegateCreatureStatusEffects(null, catalog)).toBe(false);
    });

    it("returns false for invulnerable creature", () => {
        const monst = makeCreature({
            info: {
                ...makeCreature().info,
                flags: MonsterBehaviorFlag.MONST_INVULNERABLE,
            },
        });
        monst.status[StatusEffect.Hasted] = 10;
        expect(canNegateCreatureStatusEffects(monst, catalog)).toBe(false);
    });

    it("returns true when creature has negatable status", () => {
        const monst = makeCreature();
        monst.status[StatusEffect.Hasted] = 10;
        expect(canNegateCreatureStatusEffects(monst, catalog)).toBe(true);
    });

    it("returns false when creature has only non-negatable statuses", () => {
        const monst = makeCreature();
        // Set a status that is NOT in the negatable list
        monst.status[StatusEffect.Paralyzed] = 10;
        expect(canNegateCreatureStatusEffects(monst, catalog)).toBe(false);
    });

    it("returns false when creature has no statuses", () => {
        const monst = makeCreature();
        expect(canNegateCreatureStatusEffects(monst, catalog)).toBe(false);
    });
});

// ───────────────────────────────────────────────────────────────
// negateCreatureStatusEffects
// ───────────────────────────────────────────────────────────────

describe("negateCreatureStatusEffects", () => {
    const catalog = makeStatusEffectCatalog();

    it("does nothing for null creature", () => {
        const player = makeCreature();
        negateCreatureStatusEffects(null, player, catalog);
        // No error thrown
    });

    it("does nothing for invulnerable creature", () => {
        const player = makeCreature();
        const monst = makeCreature({
            info: { ...makeCreature().info, flags: MonsterBehaviorFlag.MONST_INVULNERABLE },
        });
        monst.status[StatusEffect.Hasted] = 10;
        negateCreatureStatusEffects(monst, player, catalog);
        expect(monst.status[StatusEffect.Hasted]).toBe(10);
    });

    it("sets negatable statuses to 0 for monsters", () => {
        const player = makeCreature();
        const monst = makeCreature();
        monst.status[StatusEffect.Hasted] = 15;
        monst.status[StatusEffect.Slowed] = 8;
        negateCreatureStatusEffects(monst, player, catalog);
        expect(monst.status[StatusEffect.Hasted]).toBe(0);
        expect(monst.status[StatusEffect.Slowed]).toBe(0);
    });

    it("sets negatable statuses to playerNegatedValue for player", () => {
        const player = makeCreature();
        player.status[StatusEffect.Telepathic] = 20;
        negateCreatureStatusEffects(player, player, catalog);
        // Telepathic has playerNegatedValue of 5
        expect(player.status[StatusEffect.Telepathic]).toBe(5);
    });

    it("leaves non-negatable statuses untouched", () => {
        const player = makeCreature();
        const monst = makeCreature();
        monst.status[StatusEffect.Paralyzed] = 5;
        monst.status[StatusEffect.Hasted] = 10;
        negateCreatureStatusEffects(monst, player, catalog);
        expect(monst.status[StatusEffect.Paralyzed]).toBe(5);
        expect(monst.status[StatusEffect.Hasted]).toBe(0);
    });

    it("calls onDarknessNegated callback for player when darkness negated", () => {
        const player = makeCreature();
        player.status[StatusEffect.Darkness] = 10;
        const callback = vi.fn();
        negateCreatureStatusEffects(player, player, catalog, callback);
        expect(callback).toHaveBeenCalledOnce();
        expect(player.status[StatusEffect.Darkness]).toBe(0);
    });

    it("does not call onDarknessNegated for non-player", () => {
        const player = makeCreature();
        const monst = makeCreature();
        monst.status[StatusEffect.Darkness] = 10;
        const callback = vi.fn();
        negateCreatureStatusEffects(monst, player, catalog, callback);
        expect(callback).not.toHaveBeenCalled();
    });
});

// ───────────────────────────────────────────────────────────────
// monsterSummons
// ───────────────────────────────────────────────────────────────

describe("monsterSummons", () => {
    function makeSummonsCtx(overrides: Partial<MonsterSummonsContext> = {}): MonsterSummonsContext {
        return {
            player: makeCreature(),
            monsters: [],
            rng: {
                randRange: vi.fn().mockReturnValue(0),
            },
            adjacentLevelAllyCount: 0,
            deepestLevel: 26,
            depthLevel: 5,
            summonMinions: vi.fn(),
            ...overrides,
        };
    }

    it("returns false if monster has no MA_CAST_SUMMON", () => {
        const monst = makeCreature();
        const ctx = makeSummonsCtx();
        expect(monsterSummons(monst, false, ctx)).toBe(false);
    });

    it("summons when alwaysUse is true and minionCount < 50", () => {
        const monst = makeCreature({
            info: { ...makeCreature().info, abilityFlags: MonsterAbilityFlag.MA_CAST_SUMMON },
        });
        const ctx = makeSummonsCtx();
        const result = monsterSummons(monst, true, ctx);
        expect(result).toBe(true);
        expect(ctx.summonMinions).toHaveBeenCalledWith(monst);
    });

    it("does not summon via alwaysUse when minionCount >= 50", () => {
        const monst = makeCreature({
            info: { ...makeCreature().info, abilityFlags: MonsterAbilityFlag.MA_CAST_SUMMON },
            creatureState: CreatureState.TrackingScent,
        });
        // Create many followers
        const followers: Creature[] = [];
        for (let i = 0; i < 55; i++) {
            const follower = makeCreature({
                bookkeepingFlags: MonsterBookkeepingFlag.MB_FOLLOWER,
                leader: monst,
            });
            followers.push(follower);
        }
        // randRange returns non-zero so the random chance branch also fails
        const ctx = makeSummonsCtx({
            monsters: followers,
            rng: { randRange: vi.fn().mockReturnValue(5) },
        });
        // With alwaysUse=true and minionCount >= 50, the alwaysUse branch skips;
        // with random chance also failing, should NOT summon
        const result = monsterSummons(monst, true, ctx);
        expect(result).toBe(false);
        expect(ctx.summonMinions).not.toHaveBeenCalled();
    });

    it("summons for MA_ENTER_SUMMONS with random chance", () => {
        const monst = makeCreature({
            info: {
                ...makeCreature().info,
                abilityFlags: MonsterAbilityFlag.MA_CAST_SUMMON | MonsterAbilityFlag.MA_ENTER_SUMMONS,
            },
        });
        const ctx = makeSummonsCtx({
            rng: { randRange: vi.fn().mockReturnValue(0) },
        });
        const result = monsterSummons(monst, false, ctx);
        expect(result).toBe(true);
    });
});

// ───────────────────────────────────────────────────────────────
// monstersTurn (basic turn logic)
// ───────────────────────────────────────────────────────────────

describe("monstersTurn", () => {
    function makeTurnCtx(overrides: Partial<MonstersTurnContext> = {}): MonstersTurnContext {
        return {
            player: makeCreature({ loc: { x: 10, y: 10 } }),
            monsters: [],
            rng: {
                randRange: vi.fn().mockReturnValue(1),
                randPercent: vi.fn().mockReturnValue(false),
            },
            cellHasTerrainFlag: vi.fn().mockReturnValue(false),
            cellHasTMFlag: vi.fn().mockReturnValue(false),
            cellFlags: vi.fn().mockReturnValue(0),
            inFieldOfView: vi.fn().mockReturnValue(false),
            updateMonsterState: vi.fn(),
            moveMonster: vi.fn().mockReturnValue(false),
            moveMonsterPassivelyTowards: vi.fn().mockReturnValue(false),
            monsterAvoids: vi.fn().mockReturnValue(false),
            monstUseMagic: vi.fn().mockReturnValue(false),
            monsterHasBoltEffect: vi.fn().mockReturnValue(0),
            monsterBlinkToPreferenceMap: vi.fn().mockReturnValue(false),
            monsterBlinkToSafety: vi.fn().mockReturnValue(false),
            monsterSummons: vi.fn().mockReturnValue(false),
            monsterCanShootWebs: vi.fn().mockReturnValue(false),
            updateMonsterCorpseAbsorption: vi.fn().mockReturnValue(false),
            spawnDungeonFeature: vi.fn(),
            applyInstantTileEffectsToCreature: vi.fn(),
            makeMonsterDropItem: vi.fn(),
            scentDirection: vi.fn().mockReturnValue(-1),
            isLocalScentMaximum: vi.fn().mockReturnValue(false),
            pathTowardCreature: vi.fn(),
            nextStep: vi.fn().mockReturnValue(-1),
            getSafetyMap: vi.fn().mockReturnValue([]),
            traversiblePathBetween: vi.fn().mockReturnValue(false),
            monsterWillAttackTarget: vi.fn().mockReturnValue(false),
            chooseNewWanderDestination: vi.fn(),
            isValidWanderDestination: vi.fn().mockReturnValue(false),
            waypointDistanceMap: vi.fn().mockReturnValue([]),
            wanderToward: vi.fn(),
            randValidDirectionFrom: vi.fn().mockReturnValue(-1),
            monsterMillAbout: vi.fn(),
            moveAlly: vi.fn(),
            nbDirs: [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
            NO_DIRECTION: -1,
            DCOLS: 79,
            DROWS: 29,
            diagonalBlocked: vi.fn().mockReturnValue(false),
            mapToSafeTerrain: null,
            updateSafeTerrainMap: vi.fn(),
            scentMap: [],
            IN_FIELD_OF_VIEW: 0x0001,
            MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
            MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
            BE_BLINKING: 0,
            ...overrides,
        };
    }

    it("increments turnsSpentStationary", () => {
        const monst = makeCreature({ turnsSpentStationary: 5 });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(monst.turnsSpentStationary).toBe(6);
    });

    it("returns early if corpse absorption returns true", () => {
        const monst = makeCreature({ corpseAbsorptionCounter: 0 });
        const ctx = makeTurnCtx({
            updateMonsterCorpseAbsorption: vi.fn().mockReturnValue(true),
        });
        monstersTurn(monst, ctx);
        expect(ctx.updateMonsterCorpseAbsorption).toHaveBeenCalledWith(monst);
        expect(ctx.updateMonsterState).not.toHaveBeenCalled();
    });

    it("returns early if paralyzed", () => {
        const monst = makeCreature({ movementSpeed: 100 });
        monst.status[StatusEffect.Paralyzed] = 5;
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(monst.ticksUntilTurn).toBe(100);
        expect(ctx.updateMonsterState).not.toHaveBeenCalled();
    });

    it("returns early if entranced", () => {
        const monst = makeCreature({ movementSpeed: 100 });
        monst.status[StatusEffect.Entranced] = 3;
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(monst.ticksUntilTurn).toBe(100);
    });

    it("drops item if captive with carried item", () => {
        const monst = makeCreature({
            movementSpeed: 100,
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
            carriedItem: {} as any,
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(ctx.makeMonsterDropItem).toHaveBeenCalledWith(monst);
        expect(monst.ticksUntilTurn).toBe(100);
    });

    it("returns early for dying creature", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DYING,
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        // Should NOT have called updateMonsterState (paralyzed/entranced check passes)
    });

    it("sleeping monster updates state and returns", () => {
        const monst = makeCreature({
            movementSpeed: 100,
            creatureState: CreatureState.Sleeping,
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(monst.ticksUntilTurn).toBe(100);
        expect(ctx.updateMonsterState).toHaveBeenCalledWith(monst);
    });

    it("immobile monster tries magic, sets attack speed for ticks", () => {
        const monst = makeCreature({
            attackSpeed: 120,
            info: {
                ...makeCreature().info,
                flags: MonsterBehaviorFlag.MONST_IMMOBILE,
            },
        });
        const ctx = makeTurnCtx({
            monstUseMagic: vi.fn().mockReturnValue(true),
        });
        monstersTurn(monst, ctx);
        expect(ctx.monstUseMagic).toHaveBeenCalledWith(monst);
        expect(monst.ticksUntilTurn).toBe(120);
    });

    it("immobile monster that cannot use magic still sets attack speed", () => {
        const monst = makeCreature({
            attackSpeed: 100,
            info: {
                ...makeCreature().info,
                flags: MonsterBehaviorFlag.MONST_IMMOBILE,
            },
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(monst.ticksUntilTurn).toBe(100);
    });

    it("ally state delegates to moveAlly", () => {
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(ctx.moveAlly).toHaveBeenCalledWith(monst);
    });

    it("wandering follower stays near leader", () => {
        const leader = makeCreature({ loc: { x: 20, y: 20 } });
        const monst = makeCreature({
            creatureState: CreatureState.Wandering,
            bookkeepingFlags: MonsterBookkeepingFlag.MB_FOLLOWER,
            leader,
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(ctx.pathTowardCreature).toHaveBeenCalledWith(monst, leader);
    });

    it("wandering follower mills about near immobile leader", () => {
        const leader = makeCreature({
            loc: { x: 6, y: 6 },
            info: { ...makeCreature().info, flags: MonsterBehaviorFlag.MONST_IMMOBILE },
        });
        const monst = makeCreature({
            creatureState: CreatureState.Wandering,
            bookkeepingFlags: MonsterBookkeepingFlag.MB_FOLLOWER,
            leader,
        });
        const ctx = makeTurnCtx();
        monstersTurn(monst, ctx);
        expect(ctx.monsterMillAbout).toHaveBeenCalledWith(monst, 100);
    });

    it("wandering non-follower chooses waypoint and walks", () => {
        const monst = makeCreature({
            creatureState: CreatureState.Wandering,
        });
        const ctx = makeTurnCtx({
            randValidDirectionFrom: vi.fn().mockReturnValue(0),
        });
        monstersTurn(monst, ctx);
        expect(ctx.chooseNewWanderDestination).toHaveBeenCalled();
    });

    it("dungeon feature spawning when DFChance triggers", () => {
        const monst = makeCreature({
            info: {
                ...makeCreature().info,
                DFChance: 100,
                DFType: 42,
                flags: MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION,
            },
        });
        const ctx = makeTurnCtx({
            rng: {
                randRange: vi.fn().mockReturnValue(1),
                randPercent: vi.fn().mockReturnValue(true),
            },
        });
        monstersTurn(monst, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(5, 5, 42, true, false);
    });
});
