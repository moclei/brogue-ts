/*
 *  monster-ai-movement.test.ts — Verification tests for Monsters.c movement AI
 *  brogue-ts
 *
 *  Phase 3b NEEDS-VERIFICATION: moveMonster, moveMonsterPassivelyTowards,
 *  randValidDirectionFrom, traversiblePathBetween, pathTowardCreature, monsterMillAbout
 *
 *  Ported from: src/brogue/Monsters.c, src/brogue/Movement.c
 */

import { describe, it, expect, vi } from "vitest";
import {
    moveMonster,
    moveMonsterPassivelyTowards,
    randValidDirectionFrom,
} from "../../src/monsters/monster-movement.js";
import type {
    MoveMonsterContext,
    RandValidDirectionContext,
} from "../../src/monsters/monster-movement.js";
import {
    traversiblePathBetween,
    pathTowardCreature,
    monsterMillAbout,
    moveAlly,
} from "../../src/monsters/monster-actions.js";
import type {
    TraversiblePathContext,
    PathTowardCreatureContext,
    MonsterMillAboutContext,
    MoveAllyContext,
} from "../../src/monsters/monster-actions.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { nbDirs } from "../../src/globals/tables.js";
import { MonsterType, StatusEffect, CreatureState } from "../../src/types/enums.js";
import { MonsterBookkeepingFlag } from "../../src/types/flags.js";
import type { Creature, Pos } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

const NO_DIRECTION = -1;

function makeMonster(type: MonsterType = MonsterType.MK_GOBLIN): Creature {
    const c = createCreature();
    const cat = monsterCatalog[type];
    c.info = { ...cat, damage: { ...cat.damage }, foreColor: { ...cat.foreColor }, bolts: [...cat.bolts] };
    c.loc = { x: 5, y: 5 };
    c.currentHP = c.info.maxHP;
    c.movementSpeed = c.info.movementSpeed;
    c.attackSpeed = c.info.attackSpeed;
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

function makeMoveCtx(overrides?: Partial<MoveMonsterContext>): MoveMonsterContext {
    return {
        player: makeMonster(MonsterType.MK_YOU),
        monsters: [],
        rng: { randRange: (_lo: number) => _lo, randPercent: () => false },
        coordinatesAreInMap: (x, y) => x >= 0 && x < 79 && y >= 0 && y < 29,
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        cellFlags: () => 0,
        setCellFlag: () => {},
        clearCellFlag: () => {},
        discoveredTerrainFlagsAtLoc: () => 0,
        passableArcCount: () => 0,
        liquidLayerIsEmpty: () => true,
        playerCanSee: () => false,
        monsterAtLoc: () => null,
        refreshDungeonCell: () => {},
        discover: () => {},
        applyInstantTileEffectsToCreature: () => {},
        updateVision: () => {},
        pickUpItemAt: () => {},
        shuffleList: () => {},
        monsterAvoids: () => false,
        HAS_MONSTER: 0x0001,
        HAS_PLAYER: 0x0002,
        HAS_ITEM: 0x0004,
        HAS_STAIRS: 0x0008,
        DCOLS: 79,
        DROWS: 29,
        // MoveMonsterContext extras
        vomit: () => {},
        randValidDirectionFrom: () => NO_DIRECTION,
        nbDirs,
        diagonalBlocked: () => false,
        handleWhipAttacks: () => false,
        handleSpearAttacks: () => false,
        monsterSwarmDirection: () => NO_DIRECTION,
        buildHitList: () => {},
        attack: () => {},
        getQualifyingPathLocNear: () => ({ x: 0, y: 0 }),
        surfaceLayerAt: () => 0,
        clearSurfaceLayer: () => {},
        surfaceLayerHasFlag: () => false,
        gameHasEnded: false,
        NO_DIRECTION,
        forbiddenFlagsForMonster: () => 0,
        ...overrides,
    };
}

// =============================================================================
// randValidDirectionFrom — Movement.c:462
// =============================================================================

describe("randValidDirectionFrom", () => {
    it("returns NO_DIRECTION when all neighbors are out of bounds", () => {
        const monst = makeMonster();
        monst.loc = { x: 0, y: 0 };
        const ctx: RandValidDirectionContext = {
            coordinatesAreInMap: () => false,
            cellHasTerrainFlag: () => false,
            cellFlags: () => 0,
            diagonalBlocked: () => false,
            monsterAvoids: () => false,
            nbDirs,
            HAS_PLAYER: 0x0002,
            NO_DIRECTION,
            rng: { randRange: (lo: number) => lo },
        };
        expect(randValidDirectionFrom(monst, 0, 0, false, ctx)).toBe(NO_DIRECTION);
    });

    it("returns a valid direction when at least one neighbor is open", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx: RandValidDirectionContext = {
            coordinatesAreInMap: (x, y) => x >= 0 && x < 79 && y >= 0 && y < 29,
            cellHasTerrainFlag: () => false,
            cellFlags: () => 0,
            diagonalBlocked: () => false,
            monsterAvoids: () => false,
            nbDirs,
            HAS_PLAYER: 0x0002,
            NO_DIRECTION,
            rng: { randRange: (lo: number) => lo },
        };
        const dir = randValidDirectionFrom(monst, 5, 5, false, ctx);
        expect(dir).not.toBe(NO_DIRECTION);
        expect(dir).toBeGreaterThanOrEqual(0);
        expect(dir).toBeLessThan(8);
    });

    it("skips cells the monster avoids when respectAvoidancePreferences=true", () => {
        // All neighbors exist but monster avoids all of them
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx: RandValidDirectionContext = {
            coordinatesAreInMap: (x, y) => x >= 0 && x < 79 && y >= 0 && y < 29,
            cellHasTerrainFlag: () => false,
            cellFlags: () => 0,
            diagonalBlocked: () => false,
            monsterAvoids: () => true,   // avoids all
            nbDirs,
            HAS_PLAYER: 0x0002,
            NO_DIRECTION,
            rng: { randRange: (lo: number) => lo },
        };
        expect(randValidDirectionFrom(monst, 5, 5, true, ctx)).toBe(NO_DIRECTION);
    });
});

// =============================================================================
// moveMonster — Monsters.c:3711
// =============================================================================

describe("moveMonster", () => {
    it("returns false for dx=0, dy=0", () => {
        const monst = makeMonster();
        const ctx = makeMoveCtx();
        expect(moveMonster(monst, 0, 0, ctx)).toBe(false);
    });

    it("returns false when target is out of bounds", () => {
        const monst = makeMonster();
        monst.loc = { x: 0, y: 0 };
        const ctx = makeMoveCtx();
        expect(moveMonster(monst, -1, 0, ctx)).toBe(false);
    });

    it("moves to empty passable cell — updates loc and returns true", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx = makeMoveCtx();
        const result = moveMonster(monst, 1, 0, ctx);
        expect(result).toBe(true);
        expect(monst.loc.x).toBe(6);
        expect(monst.loc.y).toBe(5);
        expect(monst.ticksUntilTurn).toBe(monst.movementSpeed);
    });

    it("returns false when target cell blocks passability", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        // Make source passable, target blocked
        const ctx = makeMoveCtx({
            cellHasTerrainFlag: (_loc: Pos, _flags: number) => {
                return _loc.x === 6 && _loc.y === 5;  // target is blocked
            },
        });
        expect(moveMonster(monst, 1, 0, ctx)).toBe(false);
    });

    it("vomits (25% chance) and returns true without moving", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        monst.status[StatusEffect.Nauseous] = 5;
        const vomit = vi.fn();
        const ctx = makeMoveCtx({
            rng: { randRange: (lo: number) => lo, randPercent: () => true },
            vomit,
        });
        const result = moveMonster(monst, 1, 0, ctx);
        expect(result).toBe(true);
        expect(vomit).toHaveBeenCalledWith(monst);
        expect(monst.loc.x).toBe(5); // didn't move
    });
});

// =============================================================================
// moveMonsterPassivelyTowards — Monsters.c:1515
// =============================================================================

describe("moveMonsterPassivelyTowards", () => {
    it("returns false when already at destination", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx = makeMoveCtx();
        expect(moveMonsterPassivelyTowards(monst, { x: 5, y: 5 }, false, ctx)).toBe(false);
    });

    it("moves monster cardinally toward target", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx = makeMoveCtx();
        const result = moveMonsterPassivelyTowards(monst, { x: 5, y: 10 }, true, ctx);
        expect(result).toBe(true);
        expect(monst.loc.y).toBe(6);  // moved south by one step
    });

    it("skips player cell when willingToAttackPlayer=false", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        // Target is at (5, 10), direct path goes through (5, 6) which has HAS_PLAYER
        const HAS_PLAYER = 0x0002;
        const ctx = makeMoveCtx({
            HAS_PLAYER,
            // All cells flagged as having player → monster should not move
            cellFlags: (_loc: Pos) => HAS_PLAYER,
        });
        const result = moveMonsterPassivelyTowards(monst, { x: 5, y: 10 }, false, ctx);
        // Can't move because every target cell has player flag
        expect(result).toBe(false);
    });

    it("returns false when target is out of map", () => {
        const monst = makeMonster();
        monst.loc = { x: 0, y: 0 };
        const ctx = makeMoveCtx();
        // Map starts at 0; target one step off edge
        expect(moveMonsterPassivelyTowards(monst, { x: -5, y: 0 }, true, ctx)).toBe(false);
    });
});

// =============================================================================
// traversiblePathBetween — Monsters.c:1994
// =============================================================================

describe("traversiblePathBetween", () => {
    function makeTraversibleCtx(overrides?: Partial<TraversiblePathContext>): TraversiblePathContext {
        return {
            monsterAvoids: () => false,
            DCOLS: 79,
            DROWS: 29,
            ...overrides,
        };
    }

    it("returns true for direct path with no obstacles", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx = makeTraversibleCtx();
        expect(traversiblePathBetween(monst, 8, 5, ctx)).toBe(true);
    });

    it("returns true when already at target", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const ctx = makeTraversibleCtx();
        expect(traversiblePathBetween(monst, 5, 5, ctx)).toBe(true);
    });

    it("returns false when monster avoids a cell on the path", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        // Monster avoids (6, 5) — a cell directly on the cardinal path to (8, 5)
        const ctx = makeTraversibleCtx({
            monsterAvoids: (_m: Creature, loc: Pos) => loc.x === 6 && loc.y === 5,
        });
        expect(traversiblePathBetween(monst, 8, 5, ctx)).toBe(false);
    });
});

it("traversiblePathBetween uses bolt getLineCoordinates (fixed from Bresenham)", () => {
    // Fixed: C (Monsters.c:1994) uses getLineCoordinates(coords, origin, target, &boltCatalog[BOLT_NONE])
    // TS now uses the same fixed-point bolt-geometry algorithm.
    const monst = makeMonster();
    monst.loc = { x: 0, y: 0 };
    const ctx: TraversiblePathContext = {
        monsterAvoids: (_m: Creature, loc: Pos) => loc.x === 2 && loc.y === 2,
        DCOLS: 79,
        DROWS: 29,
    };
    // Diagonal path from (0,0) to (4,4): getLineCoordinates passes through (2,2).
    expect(traversiblePathBetween(monst, 4, 4, ctx)).toBe(false);
});

// =============================================================================
// pathTowardCreature — Monsters.c:2089
// =============================================================================

describe("pathTowardCreature", () => {
    function makePathCtx(overrides?: Partial<PathTowardCreatureContext>): PathTowardCreatureContext {
        return {
            traversiblePathBetween: () => false,
            distanceBetween: (_a: Pos, _b: Pos) => Math.max(Math.abs(_a.x - _b.x), Math.abs(_a.y - _b.y)),
            moveMonsterPassivelyTowards: vi.fn().mockReturnValue(false),
            monsterBlinkToPreferenceMap: () => false,
            nextStep: () => NO_DIRECTION,
            randValidDirectionFrom: () => NO_DIRECTION,
            nbDirs,
            NO_DIRECTION,
            MONST_CAST_SPELLS_SLOWLY: 0,
            monstersAreEnemies: () => false,
            allocGrid: () => Array.from({ length: 79 }, () => new Array(29).fill(0)),
            calculateDistances: () => {},
            MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
            ...overrides,
        };
    }

    it("uses passive movement when path is traversible", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const target = makeMonster(MonsterType.MK_OGRE);
        target.loc = { x: 7, y: 5 };
        const passivelyTowards = vi.fn().mockReturnValue(true);
        const ctx = makePathCtx({
            traversiblePathBetween: () => true,
            moveMonsterPassivelyTowards: passivelyTowards,
        });
        pathTowardCreature(monst, target, ctx);
        expect(passivelyTowards).toHaveBeenCalledWith(monst, target.loc, true);
    });

    it("creates distance map when none exists and path is not traversible", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const target = makeMonster(MonsterType.MK_OGRE);
        target.loc = { x: 7, y: 5 };
        target.mapToMe = null;
        const allocGrid = vi.fn().mockReturnValue(Array.from({ length: 79 }, () => new Array(29).fill(0)));
        const calculateDistances = vi.fn();
        const ctx = makePathCtx({ allocGrid, calculateDistances });
        pathTowardCreature(monst, target, ctx);
        expect(allocGrid).toHaveBeenCalled();
        expect(calculateDistances).toHaveBeenCalled();
    });

    it("clears MB_GIVEN_UP_ON_SCENT flag when traversible and within 2 steps", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT;
        const target = makeMonster(MonsterType.MK_OGRE);
        target.loc = { x: 6, y: 5 };  // distance 1
        const ctx = makePathCtx({ traversiblePathBetween: () => true });
        pathTowardCreature(monst, target, ctx);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT).toBe(0);
    });
});

// =============================================================================
// monsterMillAbout — Monsters.c:3019
// =============================================================================

describe("monsterMillAbout", () => {
    function makeMillCtx(overrides?: Partial<MonsterMillAboutContext>): MonsterMillAboutContext {
        return {
            rng: { randPercent: () => false },
            randValidDirectionFrom: () => NO_DIRECTION,
            moveMonsterPassivelyTowards: vi.fn().mockReturnValue(false),
            nbDirs,
            NO_DIRECTION,
            ...overrides,
        };
    }

    it("does not move when randPercent returns false (0% chance)", () => {
        const monst = makeMonster();
        const move = vi.fn();
        const ctx = makeMillCtx({
            rng: { randPercent: () => false },
            moveMonsterPassivelyTowards: move,
        });
        monsterMillAbout(monst, 50, ctx);
        expect(move).not.toHaveBeenCalled();
    });

    it("moves in a valid direction when randPercent returns true", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        const move = vi.fn();
        const ctx = makeMillCtx({
            rng: { randPercent: () => true },
            randValidDirectionFrom: () => 2, // dir 2 = [-1, 0]
            moveMonsterPassivelyTowards: move,
        });
        monsterMillAbout(monst, 100, ctx);
        // Should call moveMonsterPassivelyTowards with (x-1, y) = (4, 5)
        expect(move).toHaveBeenCalledWith(monst, { x: 4, y: 5 }, false);
    });

    it("does not move when no valid direction (NO_DIRECTION) even if randPercent=true", () => {
        const monst = makeMonster();
        const move = vi.fn();
        const ctx = makeMillCtx({
            rng: { randPercent: () => true },
            randValidDirectionFrom: () => NO_DIRECTION,
            moveMonsterPassivelyTowards: move,
        });
        monsterMillAbout(monst, 100, ctx);
        expect(move).not.toHaveBeenCalled();
    });
});

// =============================================================================
// moveAlly — Monsters.c:3040
// =============================================================================


describe("moveAlly — corpse-eating and scent-follow branches", () => {
    const GOOD_COLOR = { r: 60, g: 50, b: 100, dr: 0, dg: 0, db: 0, variance: 0, colorDances: false };

    function makeMoveAllyCtx(overrides?: Partial<MoveAllyContext>): MoveAllyContext {
        const player = makeMonster(MonsterType.MK_YOU);
        player.loc = { x: 10, y: 10 };
        return {
            player,
            monsters: [],
            rng: { randPercent: () => false },
            cellHasTerrainFlag: () => false,
            T_HARMFUL_TERRAIN: 0,
            T_IS_FIRE: 0x0001,
            T_CAUSES_DAMAGE: 0x0002,
            T_CAUSES_PARALYSIS: 0x0004,
            T_CAUSES_CONFUSION: 0x0008,
            MONST_INANIMATE: 0,
            MONST_INVULNERABLE: 0,
            MONST_CAST_SPELLS_SLOWLY: 0,
            MONST_ALWAYS_USE_ABILITY: 0,
            MONST_ALWAYS_HUNTING: 0,
            MONST_MAINTAINS_DISTANCE: 0,
            MONST_FLITS: 0,
            MONST_IMMOBILE: 0,
            MONSTER_TRACKING_SCENT: 99,
            mapToSafeTerrain: null,
            updatedMapToSafeTerrainThisTurn: false,
            updateSafeTerrainMap: () => {},
            monsterWillAttackTarget: () => false,
            traversiblePathBetween: () => false,
            moveMonster: vi.fn().mockReturnValue(false),
            moveMonsterPassivelyTowards: vi.fn().mockReturnValue(false),
            monsterBlinkToPreferenceMap: () => false,
            monsterBlinkToSafety: () => false,
            monstUseMagic: () => false,
            monsterSummons: () => false,
            nextStep: () => NO_DIRECTION,
            randValidDirectionFrom: () => NO_DIRECTION,
            pathTowardCreature: vi.fn(),
            nbDirs,
            NO_DIRECTION,
            DCOLS: 79,
            DROWS: 29,
            allyFlees: () => false,
            justRested: false,
            justSearched: false,
            MB_SEIZED: MonsterBookkeepingFlag.MB_SEIZED,
            MB_FOLLOWER: MonsterBookkeepingFlag.MB_FOLLOWER,
            MB_SUBMERGED: MonsterBookkeepingFlag.MB_SUBMERGED,
            MB_DOES_NOT_TRACK_LEADER: MonsterBookkeepingFlag.MB_DOES_NOT_TRACK_LEADER,
            MB_ABSORBING: MonsterBookkeepingFlag.MB_ABSORBING,
            MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
            STATUS_INVISIBLE: StatusEffect.Invisible,
            STATUS_IMMUNE_TO_FIRE: StatusEffect.ImmuneToFire,
            STATUS_POISONED: StatusEffect.Poisoned,
            STATUS_BURNING: StatusEffect.Burning,
            attackWouldBeFutile: () => false,
            monsterHasBoltEffect: () => 0,
            BE_BLINKING: 0,
            allySafetyMap: Array.from({ length: 79 }, () => new Array(29).fill(0)),
            distanceBetween: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
            isPosInMap: (p) => p.x >= 0 && p.x < 79 && p.y >= 0 && p.y < 29,
            canSeeMonster: () => false,
            monsterName: (m) => m.info.monsterName ?? "monster",
            getMonsterAbsorbingText: () => "devouring",
            goodMessageColor: GOOD_COLOR,
            messageWithColor: vi.fn(),
            inFieldOfView: () => false,
            monsterMillAbout: vi.fn(),
            scentMap: Array.from({ length: 79 }, () => new Array(29).fill(0)),
            scentDirection: () => NO_DIRECTION,
            ...overrides,
        };
    }

    it("moves toward targetCorpseLoc and starts absorbing when adjacent (C:3208)", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        monst.targetCorpseLoc = { x: 5, y: 5 };  // already at corpse
        monst.targetCorpseName = "goblin";
        monst.leader = makeMonster(MonsterType.MK_YOU);
        const ctx = makeMoveAllyCtx({ canSeeMonster: () => true });
        moveAlly(monst, ctx);
        expect(monst.corpseAbsorptionCounter).toBe(20);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_ABSORBING).toBeTruthy();
        expect(ctx.messageWithColor).toHaveBeenCalled();
    });

    it("moves toward targetCorpseLoc when not yet adjacent (C:3208)", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        monst.targetCorpseLoc = { x: 8, y: 8 };
        monst.leader = makeMonster(MonsterType.MK_YOU);
        const mmpt = vi.fn().mockReturnValue(true);
        const ctx = makeMoveAllyCtx({ moveMonsterPassivelyTowards: mmpt });
        moveAlly(monst, ctx);
        expect(mmpt).toHaveBeenCalledWith(monst, monst.targetCorpseLoc, false);
    });

    it("mills about when close to player and in FOV (C:3222)", () => {
        const monst = makeMonster();
        monst.loc = { x: 10, y: 10 };  // same as player
        monst.targetCorpseLoc = { x: -1, y: -1 };  // invalid (not in map)
        monst.leader = makeMonster(MonsterType.MK_YOU);
        const mill = vi.fn();
        const ctx = makeMoveAllyCtx({
            inFieldOfView: () => true,
            monsterMillAbout: mill,
        });
        // player is at (10,10), monst is at (10,10) → distance 0 < 3
        moveAlly(monst, ctx);
        expect(mill).toHaveBeenCalledWith(monst, 30);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT).toBe(0);
    });

    it("follows scentDirection when far from player (C:3228)", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        monst.targetCorpseLoc = { x: -1, y: -1 };
        const leader = makeMonster(MonsterType.MK_YOU);
        leader.loc = { x: 40, y: 20 };  // far away (distance > 10)
        monst.leader = leader;
        const mmpt = vi.fn().mockReturnValue(true);
        const ctx = makeMoveAllyCtx({
            scentDirection: () => 0,  // dir 0 = [0, -1] (north)
            moveMonsterPassivelyTowards: mmpt,
        });
        ctx.player.loc = { x: 40, y: 20 };
        moveAlly(monst, ctx);
        // dir 0 = [0, -1] → target = {5, 4}
        expect(mmpt).toHaveBeenCalledWith(monst, { x: 5, y: 4 }, false);
    });

    it("falls back to pathTowardCreature(leader) when scentDirection returns -1 (C:3236)", () => {
        const monst = makeMonster();
        monst.loc = { x: 5, y: 5 };
        monst.targetCorpseLoc = { x: -1, y: -1 };
        const leader = makeMonster(MonsterType.MK_YOU);
        leader.loc = { x: 40, y: 20 };
        monst.leader = leader;
        const pathToward = vi.fn();
        const ctx = makeMoveAllyCtx({
            scentDirection: () => NO_DIRECTION,
            pathTowardCreature: pathToward,
        });
        ctx.player.loc = { x: 40, y: 20 };
        moveAlly(monst, ctx);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT).toBeTruthy();
        expect(pathToward).toHaveBeenCalledWith(monst, leader);
    });
});

// makeMonsterDropItem: FIXED — now calls getQualifyingPathLocNear to find a valid drop
// location and sets item.loc + pmap HAS_ITEM flag before adding to floorItems.
// Integration test in tests/monsters.test.ts: "buildMonsterStateContext().makeMonsterDropItem
// places item via path search".
