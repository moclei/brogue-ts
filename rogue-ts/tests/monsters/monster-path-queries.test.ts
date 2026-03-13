/*
 *  monster-path-queries.test.ts — Tests for specifiedPathBetween and dormantMonsterAtLoc
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    specifiedPathBetween,
    dormantMonsterAtLoc,
    type SpecifiedPathContext,
    type DormantMonsterContext,
} from "../../src/monsters/monster-path-queries.js";
import { TileFlag } from "../../src/types/flags.js";
import { TerrainFlag } from "../../src/types/flags.js";
import { CreatureState, StatusEffect, MonsterType } from "../../src/types/enums.js";
import type { Creature } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCtx(
    terrainBlocked: Set<string> = new Set(),
    flagBlocked: Set<string> = new Set(),
): SpecifiedPathContext {
    return {
        cellHasTerrainFlag(loc, flags) {
            return terrainBlocked.has(`${loc.x},${loc.y}`) && flags !== 0;
        },
        cellHasPmapFlags(loc, flags) {
            return flagBlocked.has(`${loc.x},${loc.y}`) && flags !== 0;
        },
    };
}

function makeCreature(x: number, y: number, overrides: Partial<Creature> = {}): Creature {
    const statusLen = Object.keys(StatusEffect).length / 2;
    return {
        loc: { x, y },
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
        creatureState: CreatureState.Sleeping,
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

// =============================================================================
// specifiedPathBetween
// =============================================================================

describe("specifiedPathBetween", () => {
    it("returns true for a horizontal line with no blockers", () => {
        const ctx = makeCtx();
        expect(specifiedPathBetween(5, 10, 10, 10, 0, 0, ctx)).toBe(true);
    });

    it("returns true for a vertical line with no blockers", () => {
        const ctx = makeCtx();
        expect(specifiedPathBetween(5, 5, 5, 12, 0, 0, ctx)).toBe(true);
    });

    it("returns true for a diagonal line with no blockers", () => {
        const ctx = makeCtx();
        expect(specifiedPathBetween(3, 3, 8, 8, 0, 0, ctx)).toBe(true);
    });

    it("returns true when blockingTerrain is 0 even if cells have terrain flags", () => {
        // blockingTerrain=0 means no terrain blocks — should always pass terrain check
        const ctx = makeCtx(new Set(["6,10", "7,10"]));
        expect(specifiedPathBetween(5, 10, 10, 10, 0, 0, ctx)).toBe(true);
    });

    it("returns false when a cell on the path has the blocking terrain flag", () => {
        // Block cell (7,10) on the path from (5,10) to (10,10)
        const ctx: SpecifiedPathContext = {
            cellHasTerrainFlag(loc, flags) {
                return loc.x === 7 && loc.y === 10 && (flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0;
            },
            cellHasPmapFlags: () => false,
        };
        expect(specifiedPathBetween(5, 10, 10, 10, TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0, ctx)).toBe(false);
    });

    it("returns false when a cell on the path has the blocking map flag", () => {
        const ctx: SpecifiedPathContext = {
            cellHasTerrainFlag: () => false,
            cellHasPmapFlags(loc, flags) {
                return loc.x === 7 && loc.y === 10 && (flags & TileFlag.HAS_MONSTER) !== 0;
            },
        };
        expect(specifiedPathBetween(5, 10, 10, 10, 0, TileFlag.HAS_MONSTER, ctx)).toBe(false);
    });

    it("returns true if the blocking cell is beyond the target", () => {
        // Target is at (8,10); blocker is at (9,10) — beyond the target
        const ctx: SpecifiedPathContext = {
            cellHasTerrainFlag(loc, flags) {
                return loc.x === 9 && loc.y === 10 && flags !== 0;
            },
            cellHasPmapFlags: () => false,
        };
        expect(specifiedPathBetween(5, 10, 8, 10, TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0, ctx)).toBe(true);
    });

    it("returns true when origin equals target (empty path)", () => {
        const ctx = makeCtx();
        // getLineCoordinates returns [] for same point — loop doesn't execute
        expect(specifiedPathBetween(5, 10, 5, 10, TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0, ctx)).toBe(true);
    });

    it("returns false when the target cell itself has a blocking terrain flag", () => {
        const x2 = 10;
        const y2 = 10;
        const ctx: SpecifiedPathContext = {
            cellHasTerrainFlag(loc, flags) {
                return loc.x === x2 && loc.y === y2 && flags !== 0;
            },
            cellHasPmapFlags: () => false,
        };
        expect(specifiedPathBetween(5, 10, x2, y2, TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0, ctx)).toBe(false);
    });
});

// =============================================================================
// dormantMonsterAtLoc
// =============================================================================

describe("dormantMonsterAtLoc", () => {
    function makeDormantCtx(
        dormantMonsters: Creature[],
        hasDormantFlag: Set<string> = new Set(),
    ): DormantMonsterContext {
        return {
            dormantMonsters,
            cellHasPmapFlags(loc, flags) {
                if (flags & TileFlag.HAS_DORMANT_MONSTER) {
                    return hasDormantFlag.has(`${loc.x},${loc.y}`);
                }
                return false;
            },
        };
    }

    it("returns null when the cell has no HAS_DORMANT_MONSTER flag", () => {
        const monst = makeCreature(5, 5);
        const ctx = makeDormantCtx([monst], new Set()); // flag not set
        expect(dormantMonsterAtLoc({ x: 5, y: 5 }, ctx)).toBeNull();
    });

    it("returns null when the flag is set but no monster is at that location", () => {
        const monst = makeCreature(6, 6); // at (6,6), not (5,5)
        const ctx = makeDormantCtx([monst], new Set(["5,5"]));
        expect(dormantMonsterAtLoc({ x: 5, y: 5 }, ctx)).toBeNull();
    });

    it("returns the dormant monster when flag and location match", () => {
        const monst = makeCreature(5, 5);
        const ctx = makeDormantCtx([monst], new Set(["5,5"]));
        expect(dormantMonsterAtLoc({ x: 5, y: 5 }, ctx)).toBe(monst);
    });

    it("returns the correct monster when multiple dormant monsters exist", () => {
        const m1 = makeCreature(5, 5);
        const m2 = makeCreature(7, 8);
        const m3 = makeCreature(9, 9);
        const ctx = makeDormantCtx([m1, m2, m3], new Set(["5,5", "7,8", "9,9"]));
        expect(dormantMonsterAtLoc({ x: 7, y: 8 }, ctx)).toBe(m2);
        expect(dormantMonsterAtLoc({ x: 9, y: 9 }, ctx)).toBe(m3);
    });

    it("returns null for an empty dormant list even if flag is set", () => {
        const ctx = makeDormantCtx([], new Set(["5,5"]));
        expect(dormantMonsterAtLoc({ x: 5, y: 5 }, ctx)).toBeNull();
    });
});
