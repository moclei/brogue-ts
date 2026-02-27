/*
 *  monster-ops.test.ts — Tests for MonsterOps bridge factory
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    createMonsterOps,
    toggleMonsterDormancy,
} from "../../src/monsters/monster-ops.js";
import type { MonsterOpsContext } from "../../src/monsters/monster-ops.js";
import type { Creature, Pos } from "../../src/types/types.js";
import { CreatureState } from "../../src/types/enums.js";
import { MonsterBookkeepingFlag } from "../../src/types/flags.js";

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────

function makeCreature(overrides: Partial<Creature> = {}): Creature {
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
        creatureMode: 0,
        mutationIndex: -1,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        status: [],
        maxStatus: [],
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
        machineHome: 0,
        ...overrides,
    } as Creature;
}

function makeOpsCtx(overrides: Partial<MonsterOpsContext> = {}): MonsterOpsContext {
    return {
        monsters: [],
        spawnHorde: vi.fn().mockReturnValue(null),
        monsterAtLoc: vi.fn().mockReturnValue(null),
        killCreature: vi.fn(),
        generateMonster: vi.fn().mockReturnValue(null),
        toggleMonsterDormancy: vi.fn(),
        ...overrides,
    };
}

// ───────────────────────────────────────────────────────────────
// createMonsterOps
// ───────────────────────────────────────────────────────────────

describe("createMonsterOps", () => {
    it("returns an object with all MonsterOps methods", () => {
        const ctx = makeOpsCtx();
        const ops = createMonsterOps(ctx);
        expect(ops).toHaveProperty("spawnHorde");
        expect(ops).toHaveProperty("monsterAtLoc");
        expect(ops).toHaveProperty("killCreature");
        expect(ops).toHaveProperty("generateMonster");
        expect(ops).toHaveProperty("toggleMonsterDormancy");
        expect(ops).toHaveProperty("iterateMachineMonsters");
    });

    it("spawnHorde delegates to ctx", () => {
        const leader = makeCreature();
        const ctx = makeOpsCtx({
            spawnHorde: vi.fn().mockReturnValue(leader),
        });
        const ops = createMonsterOps(ctx);
        const result = ops.spawnHorde(5, { x: 10, y: 10 }, 0, 0);
        expect(ctx.spawnHorde).toHaveBeenCalledWith(5, { x: 10, y: 10 }, 0, 0);
        expect(result).toBe(leader);
    });

    it("monsterAtLoc delegates to ctx", () => {
        const monst = makeCreature();
        const ctx = makeOpsCtx({
            monsterAtLoc: vi.fn().mockReturnValue(monst),
        });
        const ops = createMonsterOps(ctx);
        const result = ops.monsterAtLoc({ x: 3, y: 7 });
        expect(ctx.monsterAtLoc).toHaveBeenCalledWith({ x: 3, y: 7 });
        expect(result).toBe(monst);
    });

    it("killCreature delegates to ctx", () => {
        const monst = makeCreature();
        const ctx = makeOpsCtx();
        const ops = createMonsterOps(ctx);
        ops.killCreature(monst, true);
        expect(ctx.killCreature).toHaveBeenCalledWith(monst, true);
    });

    it("generateMonster delegates to ctx", () => {
        const monst = makeCreature();
        const ctx = makeOpsCtx({
            generateMonster: vi.fn().mockReturnValue(monst),
        });
        const ops = createMonsterOps(ctx);
        const result = ops.generateMonster(3, true, false);
        expect(ctx.generateMonster).toHaveBeenCalledWith(3, true, false);
        expect(result).toBe(monst);
    });

    it("toggleMonsterDormancy delegates to ctx", () => {
        const monst = makeCreature();
        const ctx = makeOpsCtx();
        const ops = createMonsterOps(ctx);
        ops.toggleMonsterDormancy(monst);
        expect(ctx.toggleMonsterDormancy).toHaveBeenCalledWith(monst);
    });

    it("iterateMachineMonsters returns the full monsters list", () => {
        const m1 = makeCreature({ currentHP: 1 });
        const m2 = makeCreature({ currentHP: 2 });
        const ctx = makeOpsCtx({ monsters: [m1, m2] });
        const ops = createMonsterOps(ctx);
        const result = ops.iterateMachineMonsters();
        expect(result).toHaveLength(2);
        expect(result[0]).toBe(m1);
        expect(result[1]).toBe(m2);
    });

    it("spawnHorde returns null when ctx returns null", () => {
        const ctx = makeOpsCtx();
        const ops = createMonsterOps(ctx);
        expect(ops.spawnHorde(0, { x: 0, y: 0 }, 0, 0)).toBeNull();
    });

    it("generateMonster returns null when ctx returns null", () => {
        const ctx = makeOpsCtx();
        const ops = createMonsterOps(ctx);
        expect(ops.generateMonster(0, false, false)).toBeNull();
    });
});

// ───────────────────────────────────────────────────────────────
// toggleMonsterDormancy
// ───────────────────────────────────────────────────────────────

describe("toggleMonsterDormancy", () => {
    it("sets dormant monster to tracking scent", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DORMANT,
            creatureState: CreatureState.Sleeping,
        });
        toggleMonsterDormancy(monst);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT).toBe(0);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("sets active monster to dormant sleeping", () => {
        const monst = makeCreature({
            bookkeepingFlags: 0,
            creatureState: CreatureState.Wandering,
        });
        toggleMonsterDormancy(monst);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT).toBeTruthy();
        expect(monst.creatureState).toBe(CreatureState.Sleeping);
    });

    it("toggle twice restores original dormancy state", () => {
        const monst = makeCreature({
            bookkeepingFlags: 0,
            creatureState: CreatureState.Wandering,
        });
        toggleMonsterDormancy(monst);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT).toBeTruthy();
        toggleMonsterDormancy(monst);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT).toBe(0);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("preserves other bookkeeping flags", () => {
        const otherFlag = MonsterBookkeepingFlag.MB_FOLLOWER;
        const monst = makeCreature({
            bookkeepingFlags: otherFlag,
            creatureState: CreatureState.Wandering,
        });
        toggleMonsterDormancy(monst);
        expect(monst.bookkeepingFlags & otherFlag).toBeTruthy();
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DORMANT).toBeTruthy();
    });
});
