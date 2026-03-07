/*
 *  monster-summoning.test.ts — Tests for summonMinions
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    summonMinions,
    type SummonMinionsContext,
} from "../../src/monsters/monster-summoning.js";
import { CreatureState, StatusEffect, MonsterType, LightType } from "../../src/types/enums.js";
import {
    MonsterAbilityFlag,
    MonsterBookkeepingFlag,
    TileFlag,
} from "../../src/types/flags.js";
import { hordeCatalog } from "../../src/globals/horde-catalog.js";
import { monsterText } from "../../src/globals/monster-text.js";
import type { Creature } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    const statusLen = Object.keys(StatusEffect).length / 2;
    return {
        loc: { x: 10, y: 10 },
        info: {
            monsterID: MonsterType.MK_GOBLIN,
            monsterName: "goblin",
            displayChar: "g",
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
        creatureState: CreatureState.TrackingScent,
        creatureMode: 0,
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
        depth: 1,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        followers: [],
        mapToMe: null,
        safetyMap: null,
        ...overrides,
    } as Creature;
}

/** Build a context with a single minion that gets spawned. */
function makeCtx(
    summoner: Creature,
    spawnedMinions: Creature[],
    overrides: Partial<SummonMinionsContext> = {},
): SummonMinionsContext {
    const monsters: Creature[] = [];
    return {
        hordeCatalog,
        monsters,
        player: makeCreature({ loc: { x: 0, y: 0 } }),
        rng: {
            randRange: (lo, hi) => lo, // deterministic: always pick first
            randPercent: () => false,
        },
        spawnMinions: (_hordeID, _leader) => {
            // Push all spawnedMinions into monsters list with MB_JUST_SUMMONED
            for (const m of spawnedMinions) {
                m.bookkeepingFlags |= MonsterBookkeepingFlag.MB_JUST_SUMMONED;
                monsters.push(m);
            }
            return spawnedMinions.length > 0;
        },
        setCellFlag: vi.fn(),
        clearCellFlag: vi.fn(),
        removeCreature: vi.fn().mockReturnValue(true),
        prependCreature: vi.fn(),
        canSeeMonster: () => false,
        monsterName: (m, includeArticle) =>
            includeArticle ? `the ${m.info.monsterName}` : m.info.monsterName,
        getSummonMessage: (id) => monsterText[id]?.summonMessage ?? "",
        message: vi.fn(),
        fadeInMonster: vi.fn(),
        refreshDungeonCell: vi.fn(),
        demoteMonsterFromLeadership: vi.fn(),
        createFlare: vi.fn(),
        monstersAreTeammates: (a, b) => a === summoner || b === summoner,
        MA_ENTER_SUMMONS: MonsterAbilityFlag.MA_ENTER_SUMMONS,
        MB_JUST_SUMMONED: MonsterBookkeepingFlag.MB_JUST_SUMMONED,
        MB_LEADER: MonsterBookkeepingFlag.MB_LEADER,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        SUMMONING_FLASH_LIGHT: LightType.SUMMONING_FLASH_LIGHT,
        ...overrides,
    };
}

// =============================================================================
// summonMinions
// =============================================================================

describe("summonMinions", () => {
    it("returns false if pickHordeType finds no summoned horde for this monster type", () => {
        // MonsterType 0 (player) has no summoned horde
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.PLAYER },
        });
        const ctx = makeCtx(summoner, []);
        expect(summonMinions(summoner, ctx)).toBe(false);
    });

    it("returns true when at least one minion was spawned", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion]);
        expect(summonMinions(summoner, ctx)).toBe(true);
    });

    it("sets ticksUntilTurn = 101 on newly summoned minions", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 }, ticksUntilTurn: 0 });
        const ctx = makeCtx(summoner, [minion]);
        summonMinions(summoner, ctx);
        expect(minion.ticksUntilTurn).toBe(101);
    });

    it("sets leader to summoner on newly summoned minions", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion]);
        summonMinions(summoner, ctx);
        expect(minion.leader).toBe(summoner);
    });

    it("clears MB_JUST_SUMMONED from minions after bookkeeping", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion]);
        summonMinions(summoner, ctx);
        expect(minion.bookkeepingFlags & MonsterBookkeepingFlag.MB_JUST_SUMMONED).toBe(0);
    });

    it("calls fadeInMonster for each spawned minion", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion1 = makeCreature({ loc: { x: 11, y: 10 } });
        const minion2 = makeCreature({ loc: { x: 9, y: 10 } });
        const ctx = makeCtx(summoner, [minion1, minion2]);
        summonMinions(summoner, ctx);
        expect(ctx.fadeInMonster).toHaveBeenCalledWith(minion1);
        expect(ctx.fadeInMonster).toHaveBeenCalledWith(minion2);
    });

    it("creates a flare at the summoner's location", () => {
        const summoner = makeCreature({
            loc: { x: 7, y: 8 },
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 8, y: 8 } });
        const ctx = makeCtx(summoner, [minion]);
        summonMinions(summoner, ctx);
        expect(ctx.createFlare).toHaveBeenCalledWith(7, 8, LightType.SUMMONING_FLASH_LIGHT);
    });

    it("sets MB_LEADER on summoner when not MA_ENTER_SUMMONS and minions spawned", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion]);
        summonMinions(summoner, ctx);
        expect(summoner.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).not.toBe(0);
    });

    it("does not set MB_LEADER if no minions were spawned", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        summoner.bookkeepingFlags = 0;
        const ctx = makeCtx(summoner, [], {
            spawnMinions: () => false,
        });
        // Won't find a horde for GOBLIN_CONJURER if spawnMinions is overridden to false
        // But pickHordeType runs first — let's use a summoner that has a real horde
        summonMinions(summoner, ctx);
        // With spawnMinions returning false, MB_LEADER should not be set
        expect(summoner.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).toBe(0);
    });

    describe("MA_ENTER_SUMMONS path", () => {
        it("clears HAS_MONSTER on summoner cell and removes summoner before spawning", () => {
            const summoner = makeCreature({
                loc: { x: 10, y: 10 },
                info: {
                    ...makeCreature().info,
                    monsterID: MonsterType.MK_GOBLIN_CONJURER,
                    abilityFlags: MonsterAbilityFlag.MA_ENTER_SUMMONS,
                },
            });
            const minion = makeCreature({ loc: { x: 11, y: 10 } });
            const ctx = makeCtx(summoner, [minion]);
            summonMinions(summoner, ctx);
            expect(ctx.clearCellFlag).toHaveBeenCalledWith(summoner.loc, TileFlag.HAS_MONSTER);
            expect(ctx.removeCreature).toHaveBeenCalledWith(summoner);
        });

        it("sets host.carriedMonster = summoner when minion was spawned", () => {
            const summoner = makeCreature({
                loc: { x: 10, y: 10 },
                info: {
                    ...makeCreature().info,
                    monsterID: MonsterType.MK_GOBLIN_CONJURER,
                    abilityFlags: MonsterAbilityFlag.MA_ENTER_SUMMONS,
                },
            });
            const minion = makeCreature({ loc: { x: 11, y: 10 } });
            const ctx = makeCtx(summoner, [minion]);
            summonMinions(summoner, ctx);
            expect(minion.carriedMonster).toBe(summoner);
        });

        it("calls demoteMonsterFromLeadership when minion was spawned", () => {
            const summoner = makeCreature({
                loc: { x: 10, y: 10 },
                info: {
                    ...makeCreature().info,
                    monsterID: MonsterType.MK_GOBLIN_CONJURER,
                    abilityFlags: MonsterAbilityFlag.MA_ENTER_SUMMONS,
                },
            });
            const minion = makeCreature({ loc: { x: 11, y: 10 } });
            const ctx = makeCtx(summoner, [minion]);
            summonMinions(summoner, ctx);
            expect(ctx.demoteMonsterFromLeadership).toHaveBeenCalledWith(summoner);
        });

        it("re-adds summoner via prependCreature if no minions spawned", () => {
            const summoner = makeCreature({
                loc: { x: 10, y: 10 },
                info: {
                    ...makeCreature().info,
                    monsterID: MonsterType.MK_GOBLIN_CONJURER,
                    abilityFlags: MonsterAbilityFlag.MA_ENTER_SUMMONS,
                },
            });
            const ctx = makeCtx(summoner, [], {
                spawnMinions: () => false,
            });
            summonMinions(summoner, ctx);
            expect(ctx.setCellFlag).toHaveBeenCalledWith(summoner.loc, TileFlag.HAS_MONSTER);
            expect(ctx.prependCreature).toHaveBeenCalledWith(summoner);
        });
    });

    it("displays summon message when summoner is visible", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion], {
            canSeeMonster: () => true, // always visible
        });
        summonMinions(summoner, ctx);
        expect(ctx.message).toHaveBeenCalled();
        const [msgText] = (ctx.message as ReturnType<typeof vi.fn>).mock.calls[0] as [string, number];
        expect(typeof msgText).toBe("string");
        expect(msgText.length).toBeGreaterThan(0);
    });

    it("does not display message when summoner is not visible", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion], {
            canSeeMonster: () => false,
        });
        summonMinions(summoner, ctx);
        expect(ctx.message).not.toHaveBeenCalled();
    });

    it("uses custom summonMessage from monsterText when available", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion], {
            canSeeMonster: () => true,
            getSummonMessage: () => "calls for reinforcements!",
        });
        summonMinions(summoner, ctx);
        const [msgText] = (ctx.message as ReturnType<typeof vi.fn>).mock.calls[0] as [string, number];
        expect(msgText).toContain("calls for reinforcements!");
    });

    it("falls back to 'incants darkly!' when summonMessage is empty", () => {
        const summoner = makeCreature({
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN_CONJURER },
        });
        const minion = makeCreature({ loc: { x: 11, y: 10 } });
        const ctx = makeCtx(summoner, [minion], {
            canSeeMonster: () => true,
            getSummonMessage: () => "",
        });
        summonMinions(summoner, ctx);
        const [msgText] = (ctx.message as ReturnType<typeof vi.fn>).mock.calls[0] as [string, number];
        expect(msgText).toContain("incants darkly!");
    });
});
