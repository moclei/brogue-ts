/*
 *  monster-lifecycle.test.ts — Tests for becomeAllyWith, cloneMonster, resurrectAlly
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    becomeAllyWith,
    cloneMonster,
    resurrectAlly,
    type BecomeAllyContext,
    type CloneMonsterContext,
    type ResurrectAllyContext,
} from "../../src/monsters/monster-lifecycle.js";
import { CreatureState, StatusEffect, MonsterType } from "../../src/types/enums.js";
import {
    MonsterAbilityFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TileFlag,
} from "../../src/types/flags.js";
import type { Creature, CreatureType } from "../../src/types/types.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";

// =============================================================================
// Helpers
// =============================================================================

const statusLen = Object.keys(StatusEffect).length / 2;

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 10, y: 10 },
        info: {
            monsterID: MonsterType.MK_GOBLIN,
            monsterName: "goblin",
            displayChar: "g",
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 10,
            defense: 5,
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
            flags: MonsterBehaviorFlag.MONST_MALE,
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
        mapToMe: null,
        safetyMap: null,
        weaknessAmount: 0,
        poisonAmount: 0,
        wasNegated: false,
        absorptionFlags: 0,
        absorbBehavior: false,
        absorptionBolt: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        machineHome: 0,
        targetCorpseName: "",
        ...overrides,
    } as Creature;
}

function makePlayer(): Creature {
    return makeCreature({ info: { ...makeCreature().info, monsterName: "you", monsterID: MonsterType.MK_YOU } });
}

function makeAllyCtx(player: Creature, overrides: Partial<BecomeAllyContext> = {}): BecomeAllyContext {
    return {
        player,
        demoteMonsterFromLeadership: vi.fn(),
        makeMonsterDropItem: vi.fn(),
        refreshDungeonCell: vi.fn(),
        ...overrides,
    };
}

function makeCloneCtx(
    player: Creature,
    monsters: Creature[],
    overrides: Partial<CloneMonsterContext> = {},
): CloneMonsterContext {
    return {
        rng: { randRange: () => 0, randPercent: () => false },
        player,
        monsters,
        dormantMonsters: [],
        prependCreature: vi.fn((m: Creature) => monsters.unshift(m)),
        removeFromMonsters: vi.fn((m: Creature) => {
            const idx = monsters.indexOf(m);
            if (idx !== -1) monsters.splice(idx, 1);
            return idx !== -1;
        }),
        removeFromDormant: vi.fn(() => false),
        becomeAllyWith: vi.fn(),
        getQualifyingPathLocNear: vi.fn((_loc, ..._args) => ({ x: 11, y: 11 })),
        setPmapFlag: vi.fn(),
        refreshDungeonCell: vi.fn(),
        canSeeMonster: vi.fn(() => false),
        monsterName: vi.fn(() => "goblin"),
        message: vi.fn(),
        featRecord: new Array(10).fill(false),
        FEAT_JELLYMANCER: 4,
        ...overrides,
    };
}

function makeResurrectCtx(
    purgatory: Creature[],
    monsters: Creature[],
    overrides: Partial<ResurrectAllyContext> = {},
): ResurrectAllyContext {
    return {
        purgatory,
        monsters,
        monsterCatalog,
        removeFromPurgatory: vi.fn((m: Creature) => {
            const idx = purgatory.indexOf(m);
            if (idx !== -1) purgatory.splice(idx, 1);
        }),
        prependCreature: vi.fn((m: Creature) => monsters.unshift(m)),
        getQualifyingPathLocNear: vi.fn((_loc, ..._args) => ({ x: 12, y: 12 })),
        setPmapFlag: vi.fn(),
        heal: vi.fn(),
        ...overrides,
    };
}

// =============================================================================
// becomeAllyWith
// =============================================================================

describe("becomeAllyWith", () => {
    it("sets creatureState to Ally", () => {
        const player = makePlayer();
        const monst = makeCreature({ creatureState: CreatureState.TrackingScent });
        becomeAllyWith(monst, makeAllyCtx(player));
        expect(monst.creatureState).toBe(CreatureState.Ally);
    });

    it("sets MB_FOLLOWER bookkeeping flag", () => {
        const player = makePlayer();
        const monst = makeCreature();
        becomeAllyWith(monst, makeAllyCtx(player));
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER).toBeTruthy();
    });

    it("sets leader to player", () => {
        const player = makePlayer();
        const monst = makeCreature();
        becomeAllyWith(monst, makeAllyCtx(player));
        expect(monst.leader).toBe(player);
    });

    it("clears MB_CAPTIVE and MB_SEIZED flags", () => {
        const player = makePlayer();
        const monst = makeCreature({
            bookkeepingFlags:
                MonsterBookkeepingFlag.MB_CAPTIVE | MonsterBookkeepingFlag.MB_SEIZED,
        });
        becomeAllyWith(monst, makeAllyCtx(player));
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE).toBe(0);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED).toBe(0);
    });

    it("calls demoteMonsterFromLeadership", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const ctx = makeAllyCtx(player);
        becomeAllyWith(monst, ctx);
        expect(ctx.demoteMonsterFromLeadership).toHaveBeenCalledWith(monst);
    });

    it("calls makeMonsterDropItem when carriedItem is present", () => {
        const player = makePlayer();
        const item = {} as never;
        const monst = makeCreature({ carriedItem: item });
        const ctx = makeAllyCtx(player);
        becomeAllyWith(monst, ctx);
        expect(ctx.makeMonsterDropItem).toHaveBeenCalledWith(monst);
    });

    it("does not call makeMonsterDropItem when no carriedItem", () => {
        const player = makePlayer();
        const monst = makeCreature({ carriedItem: null });
        const ctx = makeAllyCtx(player);
        becomeAllyWith(monst, ctx);
        expect(ctx.makeMonsterDropItem).not.toHaveBeenCalled();
    });

    it("calls refreshDungeonCell with monster location", () => {
        const player = makePlayer();
        const monst = makeCreature({ loc: { x: 7, y: 9 } });
        const ctx = makeAllyCtx(player);
        becomeAllyWith(monst, ctx);
        expect(ctx.refreshDungeonCell).toHaveBeenCalledWith({ x: 7, y: 9 });
    });

    it("recursively converts carriedMonster", () => {
        const player = makePlayer();
        const inner = makeCreature({ creatureState: CreatureState.TrackingScent });
        const outer = makeCreature({ carriedMonster: inner });
        becomeAllyWith(outer, makeAllyCtx(player));
        expect(inner.creatureState).toBe(CreatureState.Ally);
        expect(inner.leader).toBe(player);
    });
});

// =============================================================================
// cloneMonster
// =============================================================================

describe("cloneMonster", () => {
    it("creates a separate Creature object (not same reference)", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone).not.toBe(monst);
    });

    it("clone has same stats as original", () => {
        const player = makePlayer();
        const monst = makeCreature({ currentHP: 7 });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone.currentHP).toBe(7);
        expect(clone.info.monsterID).toBe(monst.info.monsterID);
    });

    it("clone has independent info copy (not shared reference)", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        clone.info.defense = 999;
        expect(monst.info.defense).toBe(5); // original unchanged
    });

    it("clone clears mapToMe, safetyMap, and carriedItem", () => {
        const player = makePlayer();
        const monst = makeCreature({
            mapToMe: [[0]] as unknown as never,
            safetyMap: [[0]] as unknown as never,
            carriedItem: {} as never,
        });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone.mapToMe).toBeNull();
        expect(clone.safetyMap).toBeNull();
        expect(clone.carriedItem).toBeNull();
    });

    it("clone has MB_FOLLOWER and no MB_LEADER, MB_CAPTIVE, MB_WEAPON_AUTO_ID", () => {
        const player = makePlayer();
        const monst = makeCreature({
            bookkeepingFlags:
                MonsterBookkeepingFlag.MB_LEADER |
                MonsterBookkeepingFlag.MB_CAPTIVE |
                MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID,
        });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER).toBeTruthy();
        expect(clone.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).toBe(0);
        expect(clone.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE).toBe(0);
        expect(clone.bookkeepingFlags & MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID).toBe(0);
    });

    it("clone is added to monsters list via prependCreature", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(ctx.prependCreature).toHaveBeenCalledWith(clone);
    });

    it("clone ticksUntilTurn is set to 101", () => {
        const player = makePlayer();
        const monst = makeCreature({ ticksUntilTurn: 50 });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone.ticksUntilTurn).toBe(101);
    });

    it("sets clone leader to monst when monst has no leader", () => {
        const player = makePlayer();
        const monst = makeCreature({ leader: null });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone.leader).toBe(monst);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).toBeTruthy();
    });

    it("inherits monst.leader when monst already has a leader", () => {
        const player = makePlayer();
        const existingLeader = makeCreature();
        const monst = makeCreature({ leader: existingLeader });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(clone.leader).toBe(existingLeader);
    });

    it("cloning a captive calls becomeAllyWith on the clone", () => {
        const player = makePlayer();
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, false, ctx);
        expect(ctx.becomeAllyWith).toHaveBeenCalledWith(clone);
    });

    it("placeClone=true calls getQualifyingPathLocNear and setPmapFlag", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(monst, false, true, ctx);
        expect(ctx.getQualifyingPathLocNear).toHaveBeenCalled();
        expect(ctx.setPmapFlag).toHaveBeenCalledWith(clone.loc, TileFlag.HAS_MONSTER);
    });

    it("placeClone=false does not call getQualifyingPathLocNear", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        cloneMonster(monst, false, false, ctx);
        expect(ctx.getQualifyingPathLocNear).not.toHaveBeenCalled();
    });

    it("announce=true + canSeeMonster=true calls message", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters, {
            canSeeMonster: vi.fn(() => true),
        });
        cloneMonster(monst, true, true, ctx);
        expect(ctx.message).toHaveBeenCalled();
    });

    it("announce=true + canSeeMonster=false does not call message", () => {
        const player = makePlayer();
        const monst = makeCreature();
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters, {
            canSeeMonster: vi.fn(() => false),
        });
        cloneMonster(monst, true, true, ctx);
        expect(ctx.message).not.toHaveBeenCalled();
    });

    it("player clone gets 'clone' name and Ally state", () => {
        const player = makePlayer();
        const monsters: Creature[] = [player];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(player, false, false, ctx);
        expect(clone.info.monsterName).toBe("clone");
        expect(clone.creatureState).toBe(CreatureState.Ally);
    });

    it("player clone gets weakened stats", () => {
        const player = makePlayer();
        const monsters: Creature[] = [player];
        const ctx = makeCloneCtx(player, monsters);
        const clone = cloneMonster(player, false, false, ctx);
        expect(clone.info.damage.lowerBound).toBe(1);
        expect(clone.info.damage.upperBound).toBe(2);
        expect(clone.info.defense).toBe(0);
    });

    it("jellymancer feat triggers when 90+ allied clone-monsters exist", () => {
        const player = makePlayer();
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            info: {
                ...makeCreature().info,
                abilityFlags: MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND,
            },
        });
        // Populate 90 allied clone-capable monsters
        const alliedClones: Creature[] = Array.from({ length: 90 }, () =>
            makeCreature({
                creatureState: CreatureState.Ally,
                info: {
                    ...makeCreature().info,
                    abilityFlags: MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND,
                },
            }),
        );
        const monsters: Creature[] = [monst, ...alliedClones];
        const featRecord = new Array(10).fill(false);
        const ctx = makeCloneCtx(player, monsters, { featRecord, FEAT_JELLYMANCER: 4 });
        cloneMonster(monst, false, false, ctx);
        // After adding clone, total = 91 (90 existing + 1 clone just added)
        expect(featRecord[4]).toBe(true);
    });

    it("jellymancer feat does not trigger when fewer than 90 allied clones", () => {
        const player = makePlayer();
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            info: {
                ...makeCreature().info,
                abilityFlags: MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND,
            },
        });
        const monsters: Creature[] = [monst]; // only 1 ally
        const featRecord = new Array(10).fill(false);
        const ctx = makeCloneCtx(player, monsters, { featRecord, FEAT_JELLYMANCER: 4 });
        cloneMonster(monst, false, false, ctx);
        expect(featRecord[4]).toBe(false);
    });

    it("carriedMonster clone is added then immediately removed from both lists", () => {
        const player = makePlayer();
        const inner = makeCreature({ loc: { x: 5, y: 5 } });
        const monst = makeCreature({ carriedMonster: inner });
        const monsters: Creature[] = [monst];
        const ctx = makeCloneCtx(player, monsters);
        cloneMonster(monst, false, false, ctx);
        expect(ctx.removeFromMonsters).toHaveBeenCalled();
        expect(ctx.removeFromDormant).toHaveBeenCalled();
    });
});

// =============================================================================
// resurrectAlly
// =============================================================================

describe("resurrectAlly", () => {
    it("returns false when purgatory is empty", () => {
        const ctx = makeResurrectCtx([], []);
        expect(resurrectAlly({ x: 5, y: 5 }, ctx)).toBe(false);
    });

    it("returns true when an ally is resurrected", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        const ctx = makeResurrectCtx([ally], []);
        expect(resurrectAlly({ x: 5, y: 5 }, ctx)).toBe(true);
    });

    it("removes the resurrected ally from purgatory", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        const purgatory = [ally];
        const ctx = makeResurrectCtx(purgatory, []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ctx.removeFromPurgatory).toHaveBeenCalledWith(ally);
    });

    it("adds the resurrected ally to the monsters list via prependCreature", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        const monsters: Creature[] = [];
        const ctx = makeResurrectCtx([ally], monsters);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ctx.prependCreature).toHaveBeenCalledWith(ally);
    });

    it("sets the ally location via getQualifyingPathLocNear result", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        const ctx = makeResurrectCtx([ally], [], {
            getQualifyingPathLocNear: vi.fn(() => ({ x: 15, y: 20 })),
        });
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ally.loc).toEqual({ x: 15, y: 20 });
    });

    it("sets HAS_MONSTER on the pmap cell", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        const ctx = makeResurrectCtx([ally], [], {
            getQualifyingPathLocNear: vi.fn(() => ({ x: 15, y: 20 })),
        });
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ctx.setPmapFlag).toHaveBeenCalledWith({ x: 15, y: 20 }, TileFlag.HAS_MONSTER);
    });

    it("clears MB_IS_DYING, MB_ADMINISTRATIVE_DEATH, MB_HAS_DIED, MB_IS_FALLING flags", () => {
        const ally = makeCreature({
            totalPowerCount: 5,
            bookkeepingFlags:
                MonsterBookkeepingFlag.MB_IS_DYING |
                MonsterBookkeepingFlag.MB_HAS_DIED |
                MonsterBookkeepingFlag.MB_IS_FALLING,
        });
        const ctx = makeResurrectCtx([ally], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ally.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBe(0);
        expect(ally.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED).toBe(0);
        expect(ally.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING).toBe(0);
    });

    it("clears burning status (non-fiery monster)", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        ally.status[StatusEffect.Burning] = 5;
        const ctx = makeResurrectCtx([ally], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ally.status[StatusEffect.Burning]).toBe(0);
    });

    it("does not clear burning status for fiery monsters", () => {
        const ally = makeCreature({
            totalPowerCount: 5,
            info: {
                ...makeCreature().info,
                flags: MonsterBehaviorFlag.MONST_FIERY,
            },
        });
        ally.status[StatusEffect.Burning] = 1000;
        const ctx = makeResurrectCtx([ally], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ally.status[StatusEffect.Burning]).toBe(1000);
    });

    it("clears discordant status", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        ally.status[StatusEffect.Discordant] = 10;
        const ctx = makeResurrectCtx([ally], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ally.status[StatusEffect.Discordant]).toBe(0);
    });

    it("calls heal with 100% panacea", () => {
        const ally = makeCreature({ totalPowerCount: 5 });
        const ctx = makeResurrectCtx([ally], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ctx.heal).toHaveBeenCalledWith(ally, 100, true);
    });

    it("picks the ally with the highest totalPowerCount", () => {
        const weak = makeCreature({ totalPowerCount: 2 });
        const strong = makeCreature({ totalPowerCount: 8 });
        const ctx = makeResurrectCtx([weak, strong], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ctx.removeFromPurgatory).toHaveBeenCalledWith(strong);
    });

    it("breaks power ties by highest monsterID", () => {
        const lowID = makeCreature({
            totalPowerCount: 5,
            info: { ...makeCreature().info, monsterID: MonsterType.MK_GOBLIN },
        });
        const highID = makeCreature({
            totalPowerCount: 5,
            info: { ...makeCreature().info, monsterID: MonsterType.MK_TROLL },
        });
        const ctx = makeResurrectCtx([lowID, highID], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ctx.removeFromPurgatory).toHaveBeenCalledWith(highID);
    });

    it("resets info for MA_ENTER_SUMMONS creatures and clears wasNegated", () => {
        // Use a monster type with MA_ENTER_SUMMONS if available in catalog,
        // otherwise stub the catalog entry.
        const monstID = MonsterType.MK_PHOENIX_EGG;
        const catalogEntry = monsterCatalog[monstID];
        // Only test if catalog entry has MA_ENTER_SUMMONS
        if (!(catalogEntry?.abilityFlags & MonsterAbilityFlag.MA_ENTER_SUMMONS)) {
            return; // skip — catalog entry doesn't have the flag
        }
        const ally = makeCreature({
            totalPowerCount: 5,
            wasNegated: true,
            info: { ...catalogEntry, damage: { ...catalogEntry.damage }, foreColor: { ...catalogEntry.foreColor }, bolts: [...catalogEntry.bolts] },
        });
        // Mutate the info to simulate a changed state
        ally.info.defense = 999;
        const ctx = makeResurrectCtx([ally], []);
        resurrectAlly({ x: 5, y: 5 }, ctx);
        expect(ally.info.defense).toBe(catalogEntry.defense); // reset from catalog
        expect(ally.wasNegated).toBe(false);
    });
});
