/*
 *  monster-movement.test.ts — Tests for monster movement helpers
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    canPass,
    isPassableOrSecretDoor,
    setMonsterLocation,
    findAlternativeHomeFor,
    getQualifyingLocNear,
    getQualifyingGridLocNear,
} from "../../src/monsters/monster-movement.js";
import type { MonsterMovementContext } from "../../src/monsters/monster-movement.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, CreatureState } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TerrainFlag,
    TerrainMechFlag,
} from "../../src/types/flags.js";
import type { Creature, Pos } from "../../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

function makeCreature(monsterID: MonsterType): Creature {
    const c = createCreature();
    const cat = monsterCatalog[monsterID];
    c.info = {
        ...cat,
        damage: { ...cat.damage },
        foreColor: { ...cat.foreColor },
        bolts: [...cat.bolts],
    };
    c.loc = { x: 5, y: 5 };
    c.currentHP = c.info.maxHP;
    c.movementSpeed = c.info.movementSpeed;
    c.attackSpeed = c.info.attackSpeed;
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

function makePlayer(): Creature {
    return makeCreature(MonsterType.MK_YOU);
}

function makeMovementContext(
    player: Creature,
    monsters: Creature[] = [],
    overrides?: Partial<MonsterMovementContext>,
): MonsterMovementContext {
    return {
        player,
        monsters,
        rng: { randRange: (lo) => lo, randPercent: () => false },
        coordinatesAreInMap: (x, y) => x >= 0 && x < 79 && y >= 0 && y < 29,
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        cellFlags: () => 0,
        setCellFlag: () => {},
        clearCellFlag: () => {},
        discoveredTerrainFlagsAtLoc: () => 0,
        passableArcCount: () => 0,
        liquidLayerIsEmpty: () => true,
        playerCanSee: () => true,
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
        ...overrides,
    };
}

// =============================================================================
// canPass
// =============================================================================

describe("canPass", () => {
    it("cannot pass the player", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        expect(canPass(mover, player, player, () => false)).toBe(false);
    });

    it("cannot pass confused blocker", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        const blocker = makeCreature(MonsterType.MK_OGRE);
        blocker.status[StatusEffect.Confused] = 1;
        expect(canPass(mover, blocker, player, () => false)).toBe(false);
    });

    it("cannot pass stuck blocker", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        const blocker = makeCreature(MonsterType.MK_OGRE);
        blocker.status[StatusEffect.Stuck] = 1;
        expect(canPass(mover, blocker, player, () => false)).toBe(false);
    });

    it("cannot pass captive blocker", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        const blocker = makeCreature(MonsterType.MK_OGRE);
        blocker.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        expect(canPass(mover, blocker, player, () => false)).toBe(false);
    });

    it("cannot pass immobile blocker", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        const blocker = makeCreature(MonsterType.MK_GOBLIN_TOTEM);
        expect(canPass(mover, blocker, player, () => false)).toBe(false);
    });

    it("cannot pass enemies", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        mover.creatureState = CreatureState.Ally;
        const blocker = makeCreature(MonsterType.MK_OGRE);
        blocker.creatureState = CreatureState.TrackingScent;
        expect(canPass(mover, blocker, player, () => false)).toBe(false);
    });

    it("leader can pass its follower", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_OGRE);
        const blocker = makeCreature(MonsterType.MK_GOBLIN);
        blocker.leader = mover;
        expect(canPass(mover, blocker, player, () => false)).toBe(true);
    });

    it("follower cannot pass its leader", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        const leader = makeCreature(MonsterType.MK_OGRE);
        mover.leader = leader;
        expect(canPass(mover, leader, player, () => false)).toBe(false);
    });

    it("stronger teammate can pass weaker", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_OGRE);
        mover.currentHP = 100;
        mover.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        const blocker = makeCreature(MonsterType.MK_GOBLIN);
        blocker.currentHP = 10;
        blocker.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        mover.leader = player;
        blocker.leader = player;
        expect(canPass(mover, blocker, player, () => false)).toBe(true);
    });

    it("weaker teammate cannot pass stronger", () => {
        const player = makePlayer();
        const mover = makeCreature(MonsterType.MK_GOBLIN);
        mover.currentHP = 10;
        mover.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        const blocker = makeCreature(MonsterType.MK_OGRE);
        blocker.currentHP = 100;
        blocker.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        mover.leader = player;
        blocker.leader = player;
        expect(canPass(mover, blocker, player, () => false)).toBe(false);
    });
});

// =============================================================================
// isPassableOrSecretDoor
// =============================================================================

describe("isPassableOrSecretDoor", () => {
    it("returns true for open terrain", () => {
        expect(isPassableOrSecretDoor(
            { x: 5, y: 5 },
            () => false, () => false, () => 0,
        )).toBe(true);
    });

    it("returns false for walls", () => {
        expect(isPassableOrSecretDoor(
            { x: 5, y: 5 },
            (_loc, flag) => (flag & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
            () => false, () => 0,
        )).toBe(false);
    });

    it("returns true for secret doors (that don't reveal as walls)", () => {
        expect(isPassableOrSecretDoor(
            { x: 5, y: 5 },
            (_loc, flag) => (flag & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
            (_loc, flag) => (flag & TerrainMechFlag.TM_IS_SECRET) !== 0,
            () => 0, // discovered flags show nothing blocking
        )).toBe(true);
    });

    it("returns false for secret wall that reveals as impassable", () => {
        expect(isPassableOrSecretDoor(
            { x: 5, y: 5 },
            (_loc, flag) => (flag & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
            (_loc, flag) => (flag & TerrainMechFlag.TM_IS_SECRET) !== 0,
            () => TerrainFlag.T_OBSTRUCTS_PASSABILITY, // revealed as wall
        )).toBe(false);
    });
});

// =============================================================================
// setMonsterLocation
// =============================================================================

describe("setMonsterLocation", () => {
    it("updates monster position and cell flags", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };
        monst.turnsSpentStationary = 10;

        const clearCellFlag = vi.fn();
        const setCellFlag = vi.fn();
        const refreshDungeonCell = vi.fn();
        const applyInstantTileEffectsToCreature = vi.fn();

        const ctx = makeMovementContext(player, [], {
            clearCellFlag,
            setCellFlag,
            refreshDungeonCell,
            applyInstantTileEffectsToCreature,
        });

        setMonsterLocation(monst, { x: 6, y: 7 }, ctx);

        expect(monst.loc).toEqual({ x: 6, y: 7 });
        expect(monst.turnsSpentStationary).toBe(0);
        expect(clearCellFlag).toHaveBeenCalledWith({ x: 5, y: 5 }, ctx.HAS_MONSTER);
        expect(setCellFlag).toHaveBeenCalledWith({ x: 6, y: 7 }, ctx.HAS_MONSTER);
        expect(refreshDungeonCell).toHaveBeenCalledTimes(2);
        expect(applyInstantTileEffectsToCreature).toHaveBeenCalledWith(monst);
    });

    it("clears submerged flag when moving to non-submerging terrain", () => {
        const player = makePlayer();
        const eel = makeCreature(MonsterType.MK_EEL);
        eel.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
        eel.loc = { x: 5, y: 5 };

        const ctx = makeMovementContext(player, [], {
            cellHasTMFlag: () => false, // no TM_ALLOWS_SUBMERGING
        });
        setMonsterLocation(eel, { x: 6, y: 6 }, ctx);
        expect(eel.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED).toBe(0);
    });

    it("calls discover for secret doors when player can see", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };

        const discover = vi.fn();
        const ctx = makeMovementContext(player, [], {
            playerCanSee: () => true,
            cellHasTMFlag: (_loc: Pos, flag: number) => flag === TerrainMechFlag.TM_IS_SECRET,
            cellHasTerrainFlag: (_loc: Pos, flag: number) =>
                (flag & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
            discover,
        });
        setMonsterLocation(monst, { x: 6, y: 6 }, ctx);
        expect(discover).toHaveBeenCalledWith(6, 6);
    });

    it("updates vision and picks up items for the player", () => {
        const player = makePlayer();
        player.loc = { x: 5, y: 5 };

        const updateVision = vi.fn();
        const pickUpItemAt = vi.fn();
        const HAS_ITEM = 0x0004;

        const ctx = makeMovementContext(player, [], {
            updateVision,
            pickUpItemAt,
            HAS_ITEM,
            cellFlags: () => HAS_ITEM,
        });
        setMonsterLocation(player, { x: 6, y: 6 }, ctx);
        expect(updateVision).toHaveBeenCalledWith(true);
        expect(pickUpItemAt).toHaveBeenCalled();
    });
});

// =============================================================================
// findAlternativeHomeFor
// =============================================================================

describe("findAlternativeHomeFor", () => {
    it("finds a nearby empty cell", () => {
        const player = makePlayer();
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 10, y: 10 };

        const ctx = makeMovementContext(player, [], {
            cellFlags: () => 0, // no monsters or players
            monsterAvoids: () => false,
        });

        const result = findAlternativeHomeFor(monst, false, ctx);
        expect(result.x).not.toBe(-1);
        expect(result.y).not.toBe(-1);
        // Should be 1 step away (Manhattan distance)
        const dist = Math.abs(result.x - monst.loc.x) + Math.abs(result.y - monst.loc.y);
        expect(dist).toBeLessThanOrEqual(1);
    });

    it("returns -1,-1 when no valid location exists", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 10, y: 10 };

        const ctx = makeMovementContext(player, [], {
            cellFlags: () => 0x0001 | 0x0002, // everything has monster or player
        });

        const result = findAlternativeHomeFor(monst, false, ctx);
        expect(result).toEqual({ x: -1, y: -1 });
    });
});

// =============================================================================
// getQualifyingLocNear
// =============================================================================

describe("getQualifyingLocNear", () => {
    it("returns the target if it qualifies (k=0 ring)", () => {
        const player = makePlayer();
        const ctx = makeMovementContext(player, [], {
            cellHasTerrainFlag: () => false,
            cellFlags: () => 0,
        });

        // Target position at 5,5 — it's on the k=0 ring
        const result = getQualifyingLocNear(
            { x: 5, y: 5 }, true, null, 0, 0, false, true, ctx,
        );
        expect(result).not.toBeNull();
    });

    it("returns null when no qualifying location exists", () => {
        const player = makePlayer();
        const ctx = makeMovementContext(player, [], {
            // Everything is forbidden
            cellHasTerrainFlag: () => true,
        });

        const result = getQualifyingLocNear(
            { x: 5, y: 5 }, true, null, TerrainFlag.T_OBSTRUCTS_PASSABILITY, 0,
            false, true, ctx,
        );
        expect(result).toBeNull();
    });

    it("respects forbidden map flags", () => {
        const player = makePlayer();
        const HAS_MONSTER = 0x0001;
        const ctx = makeMovementContext(player, [], {
            cellFlags: () => HAS_MONSTER,
            HAS_MONSTER,
        });

        const result = getQualifyingLocNear(
            { x: 5, y: 5 }, true, null, 0, HAS_MONSTER, false, true, ctx,
        );
        expect(result).toBeNull();
    });

    it("respects blocking map", () => {
        const player = makePlayer();
        // Create a blocking map where everything is blocked
        const blockingMap: number[][] = Array.from({ length: 79 }, () =>
            Array.from({ length: 29 }, () => 1),
        );
        const ctx = makeMovementContext(player);

        const result = getQualifyingLocNear(
            { x: 5, y: 5 }, true, blockingMap, 0, 0, false, true, ctx,
        );
        expect(result).toBeNull();
    });
});

// =============================================================================
// getQualifyingGridLocNear
// =============================================================================

describe("getQualifyingGridLocNear", () => {
    it("finds a true cell in the grid", () => {
        const player = makePlayer();
        const grid: boolean[][] = Array.from({ length: 79 }, () =>
            Array.from({ length: 29 }, () => false),
        );
        // Set one cell to true near the target
        grid[6][5] = true;

        const ctx = makeMovementContext(player);
        const result = getQualifyingGridLocNear({ x: 5, y: 5 }, grid, true, ctx);
        expect(result).toEqual({ x: 6, y: 5 });
    });

    it("returns null when no grid cell is true", () => {
        const player = makePlayer();
        const grid: boolean[][] = Array.from({ length: 79 }, () =>
            Array.from({ length: 29 }, () => false),
        );

        const ctx = makeMovementContext(player);
        const result = getQualifyingGridLocNear({ x: 5, y: 5 }, grid, true, ctx);
        expect(result).toBeNull();
    });

    it("uses deterministic selection (middle candidate)", () => {
        const player = makePlayer();
        const grid: boolean[][] = Array.from({ length: 79 }, () =>
            Array.from({ length: 29 }, () => false),
        );
        // Set three cells to true at distance 1
        grid[4][5] = true;
        grid[5][4] = true;
        grid[6][5] = true;

        const ctx = makeMovementContext(player);
        const result = getQualifyingGridLocNear({ x: 5, y: 5 }, grid, true, ctx);
        expect(result).not.toBeNull();
    });
});
