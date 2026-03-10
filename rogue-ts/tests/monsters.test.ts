/*
 *  monsters.test.ts — Integration tests for monster context builders
 *  Port V2 — rogue-ts
 *
 *  Exercises buildMonsterSpawningContext() and buildMonsterStateContext()
 *  through the real context builders.  Verifies horde spawning and monster
 *  state transitions without requiring a full platform.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "../src/core.js";
import { buildMonsterSpawningContext, buildMonsterStateContext } from "../src/monsters.js";
import { spawnHorde } from "../src/monsters/monster-spawning.js";
import { decrementMonsterStatus } from "../src/monsters/monster-state.js";
import { createCreature } from "../src/monsters/monster-creation.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, CreatureState, TileType } from "../src/types/enums.js";
import { MonsterBookkeepingFlag, TileFlag } from "../src/types/flags.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../src/types/constants.js";
import type { Creature } from "../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

/** Set a single cell in pmap to FLOOR so monsters can be placed there. */
function makeFloorCell(x: number, y: number): void {
    const { pmap } = getGameState();
    // DungeonLayer.Dungeon = 0
    pmap[x][y].layers[0] = TileType.FLOOR;
    pmap[x][y].flags = 0;
}

function makeMonster(monsterID: MonsterType, hp?: number): Creature {
    const c = createCreature();
    const cat = monsterCatalog[monsterID];
    c.info = {
        ...cat,
        damage: { ...cat.damage },
        foreColor: { ...cat.foreColor },
        bolts: [...cat.bolts],
    };
    c.currentHP = hp ?? cat.maxHP;
    c.movementSpeed = cat.movementSpeed;
    c.attackSpeed = cat.attackSpeed;
    c.ticksUntilTurn = 200;
    return c;
}

function setupPlayer(): Creature {
    const { player, rogue } = getGameState();
    const cat = monsterCatalog[MonsterType.MK_YOU];
    Object.assign(player, {
        info: { ...cat, damage: { ...cat.damage }, foreColor: { ...cat.foreColor }, bolts: [...cat.bolts] },
        currentHP: cat.maxHP,
        movementSpeed: 100,
        attackSpeed: 100,
        ticksUntilTurn: 100,
    });
    player.loc = { x: 5, y: 5 };
    player.status[StatusEffect.Nutrition] = 2150;
    rogue.ticksTillUpdateEnvironment = 100;
    return player;
}

// =============================================================================
// beforeEach
// =============================================================================

beforeEach(() => {
    initGameState();
});

// =============================================================================
// buildMonsterSpawningContext — horde spawning integration
// =============================================================================

describe("buildMonsterSpawningContext — spawn a horde", () => {
    it("spawns a solo rat horde at a given location", () => {
        setupPlayer();
        // hordeID 0 = MK_RAT, 0 member types, no special spawnsIn
        const targetLoc = { x: 10, y: 10 };
        makeFloorCell(targetLoc.x, targetLoc.y);

        const ctx = buildMonsterSpawningContext();
        const leader = spawnHorde(0, targetLoc, 0, 0, ctx);

        expect(leader).not.toBeNull();
        expect(leader!.movementSpeed).toBeGreaterThan(0);
        expect(leader!.ticksUntilTurn).toBeGreaterThan(0);
        expect(leader!.info.monsterName).toBeTruthy();
    });

    it("adds the spawned leader to the monsters list", () => {
        setupPlayer();
        const targetLoc = { x: 10, y: 10 };
        makeFloorCell(targetLoc.x, targetLoc.y);

        const ctx = buildMonsterSpawningContext();
        const leader = spawnHorde(0, targetLoc, 0, 0, ctx);

        const { monsters } = getGameState();
        expect(monsters).toContain(leader);
    });

    it("sets HAS_MONSTER flag on the target cell", () => {
        setupPlayer();
        const targetLoc = { x: 10, y: 10 };
        makeFloorCell(targetLoc.x, targetLoc.y);

        const ctx = buildMonsterSpawningContext();
        spawnHorde(0, targetLoc, 0, 0, ctx);

        const { pmap } = getGameState();
        // HAS_MONSTER = TileFlag value 8 (Fl(3) = 1<<3 = 8)
        expect(pmap[targetLoc.x][targetLoc.y].flags & TileFlag.HAS_MONSTER).toBeTruthy();
    });

    it("leader location matches spawn target", () => {
        setupPlayer();
        const targetLoc = { x: 8, y: 12 };
        makeFloorCell(targetLoc.x, targetLoc.y);

        const ctx = buildMonsterSpawningContext();
        const leader = spawnHorde(0, targetLoc, 0, 0, ctx);

        expect(leader!.loc.x).toBe(targetLoc.x);
        expect(leader!.loc.y).toBe(targetLoc.y);
    });

    it("kills a pre-existing monster at the spawn location", () => {
        setupPlayer();
        const targetLoc = { x: 10, y: 10 };
        makeFloorCell(targetLoc.x, targetLoc.y);

        // Place an existing monster at the target
        const preexisting = makeMonster(MonsterType.MK_RAT);
        preexisting.loc = { ...targetLoc };
        const { monsters } = getGameState();
        monsters.push(preexisting);

        const ctx = buildMonsterSpawningContext();
        spawnHorde(0, targetLoc, 0, 0, ctx);

        // Pre-existing should be marked as dying (administrative kill)
        expect(preexisting.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
    });
});

// =============================================================================
// buildMonsterStateContext — status decrement integration
// =============================================================================

describe("buildMonsterStateContext — decrementMonsterStatus", () => {
    it("decrements a burning status each turn", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT, 100);
        monster.loc = { x: 6, y: 5 };
        monster.status[StatusEffect.Burning] = 5;
        // Remove fiery flag so burning decrements
        monster.info.flags &= ~(1 << 25); // MONST_FIERY is a specific bit
        const { monsters } = getGameState();
        monsters.push(monster);

        const ctx = buildMonsterStateContext();
        // With HP=100 the burn damage (1-3) won't kill it
        const died = decrementMonsterStatus(monster, ctx);

        expect(died).toBe(false);
        // Burning should have decremented by 1 (unless fire killed it, but HP=100)
        expect(monster.status[StatusEffect.Burning]).toBeLessThan(5);
    });

    it("decrements a generic status effect each turn", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT);
        monster.loc = { x: 6, y: 5 };
        monster.status[StatusEffect.Confused] = 10;
        const { monsters } = getGameState();
        monsters.push(monster);

        const ctx = buildMonsterStateContext();
        decrementMonsterStatus(monster, ctx);

        expect(monster.status[StatusEffect.Confused]).toBe(9);
    });

    it("monster dies when LifespanRemaining hits zero", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT);
        monster.loc = { x: 6, y: 5 };
        monster.status[StatusEffect.LifespanRemaining] = 1;
        const { monsters } = getGameState();
        monsters.push(monster);

        const ctx = buildMonsterStateContext();
        const died = decrementMonsterStatus(monster, ctx);

        expect(died).toBe(true);
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
    });
});

// =============================================================================
// Stub audit — known-incomplete behaviours
// =============================================================================

it.skip("stub: buildMonsterSpawningContext().getQualifyingPathLocNear returns provided loc (stub, not real pathfinding)", () => {
    // buildMonsterSpawningContext().getQualifyingPathLocNear always returns the provided location.
    // Real implementation should use Dijkstra-based pathfinding to find an adjacent passable cell.
    // Required for spawnMinions() to place followers near the leader.
});

it.skip("stub: buildMonsterSpawningContext().randomMatchingLocation returns null (stub, not real random search)", () => {
    // buildMonsterSpawningContext().randomMatchingLocation always returns null.
    // Real implementation should scan pmap for matching dungeon/liquid/terrain type.
    // Required for spawnHorde() random location selection when loc is INVALID_POS.
});

it.skip("stub: buildMonsterSpawningContext().passableArcCount returns 0 (stub, needs arc counting)", () => {
    // buildMonsterSpawningContext().passableArcCount returns 0 for all positions.
    // Real implementation should count how many contiguous arcs of passable terrain surround a cell.
    // Required for spawnHorde() random location selection (avoids dead-end cells).
});

it.skip("stub: buildMonsterSpawningContext().buildMachine is a no-op (stub, needs machine builder)", () => {
    // buildMonsterSpawningContext().buildMachine does nothing.
    // Real implementation should call buildMachine() from the architect module.
    // Required for hordes with machine > 0 (machine-associated spawns).
});


it("buildMonsterStateContext().closestWaypointIndex uses wpDistance maps (Phase 6)", () => {
    // closestWaypointIndex is now wired via monster-awareness.ts.
    // With no wpDistance maps (rogue.wpCount=0), returns -1 (no waypoints).
    const ctx = buildMonsterStateContext();
    const monst = makeMonster(MonsterType.MK_GOBLIN);
    expect(ctx.closestWaypointIndex(monst)).toBe(-1);
});

it("buildMonsterStateContext().awareOfTarget uses scent map and FOV (Phase 6)", () => {
    // awareOfTarget is now wired via monster-awareness.ts.
    // With stealthRange=0 and no scent, perceived distance=1000 > awareness*3=0 → false.
    const ctx = buildMonsterStateContext();
    const monst = makeMonster(MonsterType.MK_GOBLIN);
    expect(ctx.awareOfTarget(monst, monst)).toBe(false);
});

it.skip("stub: buildMonsterStateContext().traversiblePathBetween returns false (stub, needs pathfinding)", () => {
    // buildMonsterStateContext().traversiblePathBetween always returns false.
    // Real implementation runs Dijkstra from monster to target checking avoidedFlags.
    // Required for monsterFleesFrom() distance checks in updateMonsterState().
});

it.skip("stub: buildMonsterStateContext().extinguishFireOnCreature is a no-op (stub, needs CreatureEffectsContext)", () => {
    // buildMonsterStateContext().extinguishFireOnCreature does nothing.
    // Real implementation clears burning status and updates miner's light if player.
    // Required for decrementMonsterStatus() burning cleanup.
});

it("buildMonsterStateContext().queryCtx.cellHasGas detects gas layer (Phase 6)", () => {
    // cellHasGas now checks pmap[loc].layers[DungeonLayer.Gas] !== 0.
    // Clear the gas layer to NOTHING; then expect false.
    const { pmap } = getGameState();
    pmap[5][5].layers[2] = TileType.NOTHING;  // DungeonLayer.Gas = 2
    const ctx = buildMonsterStateContext();
    expect(ctx.queryCtx.cellHasGas({ x: 5, y: 5 })).toBe(false);
    // Set a non-zero gas tile; expect true.
    pmap[5][5].layers[2] = TileType.POISON_GAS;
    const ctx2 = buildMonsterStateContext();
    expect(ctx2.queryCtx.cellHasGas({ x: 5, y: 5 })).toBe(true);
});

it("buildMonsterStateContext().closestWaypointIndexTo uses wpDistance maps (Phase 6)", () => {
    // closestWaypointIndexTo is now wired via monster-awareness.ts.
    // With no wpDistance maps, returns -1.
    const ctx = buildMonsterStateContext();
    expect(ctx.closestWaypointIndexTo({ x: 5, y: 5 })).toBe(-1);
});

it("buildMonsterStateContext().burnedTerrainFlagsAtLoc checks flammable layers (Phase 6)", () => {
    // burnedTerrainFlagsAtLoc is now wired via state/helpers.ts.
    // With default pmap (all NOTHING/non-flammable layers), returns 0.
    const ctx = buildMonsterStateContext();
    expect(ctx.burnedTerrainFlagsAtLoc({ x: 0, y: 0 })).toBe(0);
});

it.skip("stub: buildMonsterStateContext().discoveredTerrainFlagsAtLoc returns 0 (needs terrain history)", () => {
    // buildMonsterStateContext().discoveredTerrainFlagsAtLoc(loc) returns 0.
    // Real implementation should return the terrain flags seen at loc during
    // the current generation for secret-door hunting AI.
});

it("buildMonsterStateContext().openPathBetween uses bolt-geometry (Phase 6)", () => {
    // openPathBetween is now wired via openPathBetweenFn from bolt-geometry.ts.
    // Adjacent cells with no obstructing terrain → open path.
    const ctx = buildMonsterStateContext();
    expect(ctx.openPathBetween({ x: 5, y: 5 }, { x: 5, y: 6 })).toBe(true);
});

// =============================================================================
// Stub registry — Monsters.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: drawManacles() is a no-op (should draw manacle terrain decorations adjacent to a chained monster)", () => {
    // UPDATE: permanent defer — visual only; documented in TASKS.md ## Deferred.
    // C: Monsters.c:771 — drawManacles()
    // monsters.ts:141 has a `() => {}` context stub.
    // No gameplay effect; stub is permanently acceptable.
});
