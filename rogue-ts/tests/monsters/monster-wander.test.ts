/*
 *  monster-wander.test.ts — Tests for wander-destination and scent-tracking functions
 *  brogue-ts
 *
 *  Covers: isValidWanderDestination, isLocalScentMaximum, scentDirection
 *  Ported from Monsters.c (Phase 3a NEEDS-VERIFICATION)
 */

import { describe, it, expect } from "vitest";
import {
    isValidWanderDestination,
    isLocalScentMaximum,
    scentDirection,
} from "../../src/monsters/monster-actions.js";
import type {
    WanderContext,
    LocalScentContext,
    ScentDirectionContext,
} from "../../src/monsters/monster-actions.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect } from "../../src/types/enums.js";
import { TerrainFlag } from "../../src/types/flags.js";
import { nbDirs } from "../../src/globals/tables.js";
import type { Creature, Pos } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

const NO_DIRECTION = -1;
const DIRECTION_COUNT = 8;

function makeMonster(): Creature {
    const c = createCreature();
    const cat = monsterCatalog[MonsterType.MK_GOBLIN];
    c.info = {
        ...cat,
        damage: { ...cat.damage },
        foreColor: { ...cat.foreColor },
        bolts: [...cat.bolts],
    };
    c.loc = { x: 5, y: 5 };
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.waypointAlreadyVisited = new Array(10).fill(false);
    return c;
}

function makeWanderCtx(overrides?: Partial<WanderContext>): WanderContext {
    return {
        waypointCount: 3,
        waypointDistanceMap: (_i) => {
            const map: number[][] = Array.from({ length: 80 }, () => new Array(30).fill(5));
            return map;
        },
        nextStep: (_map, _loc, _monst, _includeMonsters) => 0, // direction 0 = valid
        NO_DIRECTION,
        ...overrides,
    };
}

function makeLocalScentCtx(
    scentMap: number[][],
    overrides?: Partial<LocalScentContext>,
): LocalScentContext {
    return {
        scentMap,
        cellHasTerrainFlag: () => false,
        diagonalBlocked: () => false,
        coordinatesAreInMap: (x, y) => x >= 0 && x < 10 && y >= 0 && y < 10,
        nbDirs,
        DIRECTION_COUNT,
        ...overrides,
    };
}

function makeScentCtx(
    scentMap: number[][],
    overrides?: Partial<ScentDirectionContext>,
): ScentDirectionContext {
    return {
        scentMap,
        coordinatesAreInMap: (x, y) => x >= 0 && x < 10 && y >= 0 && y < 10,
        cellHasTerrainFlag: () => false,
        cellFlags: () => 0,
        diagonalBlocked: () => false,
        monsterAvoids: () => false,
        monsterAtLoc: () => null,
        canPass: () => true,
        nbDirs,
        NO_DIRECTION,
        DIRECTION_COUNT,
        HAS_MONSTER: 0x8,
        HAS_PLAYER: 0x10,
        ...overrides,
    };
}

// =============================================================================
// isValidWanderDestination — Monsters.c:1197
// =============================================================================

describe("isValidWanderDestination", () => {
    it("returns false for negative wpIndex", () => {
        const monst = makeMonster();
        const ctx = makeWanderCtx();
        expect(isValidWanderDestination(monst, -1, ctx)).toBe(false);
    });

    it("returns false when wpIndex >= waypointCount", () => {
        const monst = makeMonster();
        const ctx = makeWanderCtx({ waypointCount: 3 });
        expect(isValidWanderDestination(monst, 3, ctx)).toBe(false);
    });

    it("returns false when waypoint is already visited", () => {
        const monst = makeMonster();
        monst.waypointAlreadyVisited[1] = true;
        const ctx = makeWanderCtx();
        expect(isValidWanderDestination(monst, 1, ctx)).toBe(false);
    });

    it("returns false when distance map is null", () => {
        const monst = makeMonster();
        const ctx = makeWanderCtx({ waypointDistanceMap: () => null });
        expect(isValidWanderDestination(monst, 0, ctx)).toBe(false);
    });

    it("returns false when distance at monster's location is negative", () => {
        const monst = makeMonster(); // loc = {x:5, y:5}
        const distMap = Array.from({ length: 80 }, () => new Array(30).fill(5));
        distMap[5][5] = -1; // unreachable from here
        const ctx = makeWanderCtx({ waypointDistanceMap: () => distMap });
        expect(isValidWanderDestination(monst, 0, ctx)).toBe(false);
    });

    it("returns false when nextStep returns NO_DIRECTION", () => {
        const monst = makeMonster();
        const ctx = makeWanderCtx({ nextStep: () => NO_DIRECTION });
        expect(isValidWanderDestination(monst, 0, ctx)).toBe(false);
    });

    it("returns true when all conditions are met", () => {
        const monst = makeMonster(); // loc = {x:5, y:5}
        const distMap = Array.from({ length: 80 }, () => new Array(30).fill(5));
        distMap[5][5] = 3; // positive distance
        const ctx = makeWanderCtx({
            waypointDistanceMap: () => distMap,
            nextStep: () => 0, // valid direction (not NO_DIRECTION)
        });
        expect(isValidWanderDestination(monst, 0, ctx)).toBe(true);
    });
});

// =============================================================================
// isLocalScentMaximum — Monsters.c:2817
// =============================================================================

describe("isLocalScentMaximum", () => {
    it("returns true when no accessible neighbor has higher scent", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 10;
        // All neighbors have scent 0, which is not > 10
        const ctx = makeLocalScentCtx(scentMap);
        expect(isLocalScentMaximum({ x: 5, y: 5 }, ctx)).toBe(true);
    });

    it("returns false when an accessible neighbor has higher scent", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 5;
        scentMap[5][4] = 10; // north neighbor (dir 0: dy=-1) has higher scent
        const ctx = makeLocalScentCtx(scentMap);
        expect(isLocalScentMaximum({ x: 5, y: 5 }, ctx)).toBe(false);
    });

    it("returns true when higher-scent neighbor is blocked by terrain", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 5;
        scentMap[5][4] = 10;
        // That neighbor has T_OBSTRUCTS_PASSABILITY
        const ctx = makeLocalScentCtx(scentMap, {
            cellHasTerrainFlag: (_loc: Pos, flags: number) =>
                !!(flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY),
        });
        expect(isLocalScentMaximum({ x: 5, y: 5 }, ctx)).toBe(true);
    });

    it("returns true when higher-scent diagonal neighbor is diagonally blocked", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 5;
        scentMap[4][4] = 10; // diagonal neighbor (dir 4: [-1,-1])
        const ctx = makeLocalScentCtx(scentMap, {
            diagonalBlocked: () => true, // all diagonals blocked
        });
        expect(isLocalScentMaximum({ x: 5, y: 5 }, ctx)).toBe(true);
    });
});

// =============================================================================
// scentDirection — Monsters.c:2833
// =============================================================================

describe("scentDirection", () => {
    it("returns the direction of the highest adjacent scent", () => {
        // monst at (5,5), north neighbor (5,4) has highest scent
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 5;
        scentMap[5][4] = 15; // north (nbDirs[0] = [0,-1])
        scentMap[5][6] = 8;  // south

        const monst = makeMonster(); // loc = {5,5}
        const ctx = makeScentCtx(scentMap);
        const dir = scentDirection(monst, ctx);

        // dir 0 is [0,-1] → north, which has scent 15 (highest)
        expect(dir).toBe(0);
    });

    it("returns NO_DIRECTION when no neighbor has higher scent", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 20; // local maximum — no neighbor is higher
        const monst = makeMonster();
        const ctx = makeScentCtx(scentMap);
        expect(scentDirection(monst, ctx)).toBe(NO_DIRECTION);
    });

    it("skips cells blocked by terrain", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 5;
        scentMap[5][4] = 15; // north has high scent but is blocked
        scentMap[5][6] = 8;  // south is accessible
        const monst = makeMonster();
        const ctx = makeScentCtx(scentMap, {
            cellHasTerrainFlag: (loc: Pos, flags: number) =>
                loc.x === 5 && loc.y === 4 && !!(flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY),
        });
        const dir = scentDirection(monst, ctx);
        // Should pick south (dir 1 = [0,1]) since north is blocked
        expect(dir).toBe(1);
    });

    it("skips cells avoided by the monster", () => {
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 5;
        scentMap[5][4] = 15; // north — but monster avoids it
        scentMap[5][6] = 8;  // south is fine
        const monst = makeMonster();
        const ctx = makeScentCtx(scentMap, {
            monsterAvoids: (_m: Creature, loc: Pos) => loc.x === 5 && loc.y === 4,
        });
        const dir = scentDirection(monst, ctx);
        expect(dir).toBe(1); // south
    });

    it("diffuses scent on retry and finds a direction (canTryAgain path)", () => {
        // Set up a scenario where the first pass finds nothing,
        // but after diffusion a neighbor gets a higher scent.
        const scentMap = Array.from({ length: 10 }, () => new Array(10).fill(0));
        scentMap[5][5] = 10;
        // After diffusion, a 2-step neighbor feeds into a cardinal neighbor.
        // scentMap[5][3] = 12 → after diffusion, scentMap[5][4] = max(0, 12-1) = 11 > 10
        scentMap[5][3] = 12;
        const monst = makeMonster();
        const ctx = makeScentCtx(scentMap);
        const dir = scentDirection(monst, ctx);
        // After diffusion, north (5,4) gains scent 11 > 10 → dir 0
        expect(dir).toBe(0);
    });
});
