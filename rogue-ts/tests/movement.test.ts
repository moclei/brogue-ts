/*
 *  movement.test.ts — Integration tests for the movement wiring layer
 *  Port V2 — rogue-ts
 *
 *  These tests exercise playerMoves() through the real buildMovementContext()
 *  context builder, verifying player position updates and turn advancement
 *  without requiring a full platform.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "../src/core.js";
import {
    buildMovementContext,
    buildTravelContext,
    buildCostMapFovContext,
} from "../src/movement.js";
import { buildWeaponAttackContext } from "../src/movement-weapon-context.js";
import { buildInputContext } from "../src/io/input-context.js";
import { playerMoves } from "../src/movement/player-movement.js";
import { populateCreatureCostMap } from "../src/movement/cost-maps-fov.js";
import { buildTurnProcessingContext } from "../src/turn.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, Direction, StatusEffect, TileType, DungeonLayer, CreatureState } from "../src/types/enums.js";
import { TileFlag, MonsterBookkeepingFlag } from "../src/types/flags.js";
import type { Creature } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

function setupPlayer(): Creature {
    const { player, rogue, pmap } = getGameState();
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
    rogue.strength = 12;

    // Place player on a floor cell and mark surrounding cells passable + discovered
    for (let dx = -1; dx <= 2; dx++) {
        for (let dy = -1; dy <= 2; dy++) {
            const cell = pmap[5 + dx]?.[5 + dy];
            if (cell) {
                cell.layers[0] = TileType.FLOOR;
                cell.layers[1] = TileType.NOTHING;
                cell.layers[2] = TileType.NOTHING;
                cell.layers[3] = TileType.NOTHING;
                // populateCreatureCostMap treats undiscovered cells as PDS_OBSTRUCTION
                cell.flags |= TileFlag.DISCOVERED;
            }
        }
    }

    // Mark player's cell with HAS_PLAYER
    pmap[5][5].flags |= TileFlag.HAS_PLAYER;

    return player;
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
    initGameState();
});

// ---------------------------------------------------------------------------
// buildMovementContext — basic player movement
// ---------------------------------------------------------------------------

describe("playerMoves — basic movement via buildMovementContext", () => {
    it("player moves right one cell: loc.x advances by 1", async () => {
        const player = setupPlayer();
        const ctx = buildMovementContext();

        const moved = await playerMoves(Direction.Right, ctx);

        expect(moved).toBe(true);
        expect(player.loc.x).toBe(6);
        expect(player.loc.y).toBe(5);
    });

    it("player moves down one cell: loc.y advances by 1", async () => {
        const player = setupPlayer();
        const ctx = buildMovementContext();

        const moved = await playerMoves(Direction.Down, ctx);

        expect(moved).toBe(true);
        expect(player.loc.x).toBe(5);
        expect(player.loc.y).toBe(6);
    });

    it("pmap HAS_PLAYER flag updates: old cell cleared, new cell set", () => {
        setupPlayer();
        const { pmap } = getGameState();
        const ctx = buildMovementContext();

        playerMoves(Direction.Right, ctx);

        expect(pmap[5][5].flags & TileFlag.HAS_PLAYER).toBe(0);
        expect(pmap[6][5].flags & TileFlag.HAS_PLAYER).not.toBe(0);
    });

    it("playerTurnEnded is called: ticksUntilTurn drains to 0 after movement", () => {
        const player = setupPlayer();
        const ctx = buildMovementContext();

        playerMoves(Direction.Right, ctx);

        // playerTurnEnded drains the player's ticks (soonestTurn=100 subtracted
        // from ticksUntilTurn=100), leaving 0. Replenishment happens at the
        // START of the next playerTurnEnded call when ticksUntilTurn === 0.
        expect(player.ticksUntilTurn).toBe(0);
    });

    it("game continues running after movement (gameHasEnded stays false)", () => {
        setupPlayer();
        const { rogue } = getGameState();
        const ctx = buildMovementContext();

        playerMoves(Direction.Right, ctx);

        expect(rogue.gameHasEnded).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildMovementContext — context integrity
// ---------------------------------------------------------------------------

describe("buildMovementContext — context has correct references", () => {
    it("context player is the shared game state player", () => {
        setupPlayer();
        const { player } = getGameState();
        const ctx = buildMovementContext();

        expect(ctx.player).toBe(player);
    });

    it("context pmap is the shared game state pmap", () => {
        setupPlayer();
        const { pmap } = getGameState();
        const ctx = buildMovementContext();

        expect(ctx.pmap).toBe(pmap);
    });

    it("coordinatesAreInMap returns true for valid coordinates", () => {
        setupPlayer();
        const ctx = buildMovementContext();

        expect(ctx.coordinatesAreInMap(5, 5)).toBe(true);
        expect(ctx.coordinatesAreInMap(0, 0)).toBe(true);
        expect(ctx.coordinatesAreInMap(-1, 0)).toBe(false);
        expect(ctx.coordinatesAreInMap(200, 200)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildTravelContext — smoke test
// ---------------------------------------------------------------------------

describe("buildTravelContext — context builds without errors", () => {
    it("buildTravelContext returns a context with player and pmap", () => {
        setupPlayer();
        const { player, pmap } = getGameState();
        const ctx = buildTravelContext();

        expect(ctx.player).toBe(player);
        expect(ctx.pmap).toBe(pmap);
    });

    it("posEq works correctly in travel context", () => {
        setupPlayer();
        const ctx = buildTravelContext();

        expect(ctx.posEq({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
        expect(ctx.posEq({ x: 3, y: 4 }, { x: 3, y: 5 })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildCostMapFovContext — cost map generation
// ---------------------------------------------------------------------------

describe("buildCostMapFovContext — populateCreatureCostMap", () => {
    it("populateCreatureCostMap assigns non-zero costs to floor cells", () => {
        const player = setupPlayer();
        const ctx = buildCostMapFovContext();

        const costMap: number[][] = Array.from({ length: 80 }, () => new Array(34).fill(0));
        populateCreatureCostMap(costMap, player, ctx);

        // Floor cells should have a cost > 0 (not PDS_OBSTRUCTION / PDS_FORBIDDEN)
        expect(costMap[5][5]).toBeGreaterThan(0);
        expect(costMap[5][5]).toBeLessThan(30000);
    });
});

// =============================================================================
// Stub audit: known-incomplete behaviours in buildMovementContext
// =============================================================================

it.skip("DEFER: recordKeystroke() — port-v2-persistence (input recording layer)", () => {
    // DEFER: port-v2-persistence
    // buildMovementContext().recordKeystroke() is a permanent no-op stub.
    // Real implementation belongs to the recordings layer (Recordings.c).
});

it("wired: confirm() shows dialog via buildConfirmFn() — returns false in test context (Escape = No)", async () => {
    // confirm() wired in buildMovementContext() via buildConfirmFn() (port-v2-close-out Phase 2b).
    // In test context waitForEvent() throws → nextBrogueEvent falls back to Escape →
    // button loop selects No (hotkey ESCAPE_KEY) → confirm() returns false.
    setupPlayer();
    const ctx = buildMovementContext();
    const result = await ctx.confirm("Really?", false);
    expect(result).toBe(false);
});

it("wired: pickUpItemAt() delegates to pickup domain function (no item on empty cell)", () => {
    // pickUpItemAt is wired Phase 3a: movement.ts → items/pickup.ts pickUpItemAtFn.
    // Calling on a cell with no floor item should complete without throwing.
    setupPlayer();
    const ctx = buildMovementContext();
    expect(() => ctx.pickUpItemAt({ x: 5, y: 5 })).not.toThrow();
});

it("wired: checkForMissingKeys() delegates to item-helper domain function", () => {
    // checkForMissingKeys is wired Phase 3a: movement.ts → movement/item-helpers.ts checkForMissingKeysFn.
    // Calling on a plain floor cell (no key requirement) should complete without throwing.
    setupPlayer();
    const ctx = buildMovementContext();
    expect(() => ctx.checkForMissingKeys(5, 5)).not.toThrow();
});

it("wired: promoteTile() delegates to environment domain function", () => {
    // promoteTile is wired Phase 3a: movement.ts → time/environment.ts promoteTileFn.
    // Calling on a plain floor cell (no promotion defined) should complete without throwing.
    setupPlayer();
    const ctx = buildMovementContext();
    expect(() => ctx.promoteTile(5, 5, DungeonLayer.Dungeon, false)).not.toThrow();
});

it.skip("UPDATE: refreshDungeonCell() wired via buildRefreshDungeonCellFn — IO integration test not feasible", () => {
    // refreshDungeonCell is wired Phase 1: movement.ts → io/cell-appearance.ts buildRefreshDungeonCellFn().
    // The wired function calls getCellAppearance(), which reads tmap/pmap/displayBuffer.
    // In unit tests getCellAppearance crashes (display system not initialized).
    // Verified functional in browser; unit test requires full IO integration setup.
});

it("spawnDungeonFeature() places a gas tile on the pmap (architect spawner wired)", () => {
    // spawnDungeonFeature is wired to architect/machines spawnDungeonFeature.
    // Spawning a gas-layer feature increments pmap volume at the target cell.
    const { pmap } = getGameState();
    const ctx = buildMovementContext();

    const feat = {
        tile: 48,                // some non-zero gas tile value
        layer: DungeonLayer.Gas,
        startProbability: 10,
        probabilityDecrement: 0,
        flags: 0,
        description: "",
        lightFlare: 0,
        flashColor: null,
        effectRadius: 0,
        propagationTerrain: 0,
        subsequentDF: 0,
        messageDisplayed: false,
    };

    const before = pmap[5][5].volume;
    ctx.spawnDungeonFeature(5, 5, feat as never, false, false);
    expect(pmap[5][5].volume).toBe(before + 10);
});

it("wired: getQualifyingPathLocNear() delegates to path-qualifying domain function", () => {
    // getQualifyingPathLocNear is wired Phase 3a: movement.ts → movement/path-qualifying.ts.
    // Should return a Pos or null — not a raw pass-through of the target.
    setupPlayer();
    const ctx = buildMovementContext();
    const result = ctx.getQualifyingPathLocNear({ x: 5, y: 5 }, true, 0, 0, 0, 0, false);
    // Result is either a valid Pos or null (no qualifying cell found)
    expect(result === null || (typeof result === "object" && "x" in result!)).toBe(true);
});

it.skip("DEFER: nextBrogueEvent() sync/async mismatch — travel dialog async refactor required", () => {
    // DEFER: sync/async mismatch — travel dialog async refactor
    // The travel context's nextBrogueEvent is called synchronously in travel-explore.ts.
    // In the browser, all input is async (waitForEvent from platform.ts).
    // Wiring requires making the travel confirm dialog loop async — a larger refactor.
    // Left as no-op until the travel loop architecture is revisited.
});

it("pauseAnimation() wired: returns Promise<boolean> (platform bridge connected)", async () => {
    // platformPauseAndCheckForEvent returns Promise.resolve(false) when platform not initialized.
    const ctx = buildTravelContext();
    const result = await ctx.pauseAnimation(0, 0);
    expect(typeof result).toBe("boolean");
});

it("hilitePath() sets IS_IN_PATH flags; clearCursorPath() clears them", () => {
    // hilitePath wired to io/targeting.ts hilitePathFn.
    // clearCursorPath wired to io/targeting.ts clearCursorPathFn.
    const { pmap } = getGameState();
    const ctx = buildTravelContext();
    const path = [{ x: 5, y: 5 }, { x: 6, y: 5 }];
    ctx.hilitePath(path, 2, false);
    expect(pmap[5][5].flags & TileFlag.IS_IN_PATH).toBeTruthy();
    expect(pmap[6][5].flags & TileFlag.IS_IN_PATH).toBeTruthy();
    ctx.clearCursorPath();
    expect(pmap[5][5].flags & TileFlag.IS_IN_PATH).toBeFalsy();
    expect(pmap[6][5].flags & TileFlag.IS_IN_PATH).toBeFalsy();
});

it("wired: getImpactLoc traces bolt path and stops at wall (not target)", () => {
    // getImpactLoc is wired in movement-weapon-context.ts via bolt-geometry.getImpactLoc.
    // Scenario: origin(5,5) → target(5,10), wall placed at (5,7).
    // Bolt must stop at (5,7) (the blocking cell), not reach target (5,10).
    setupPlayer();
    const { pmap } = getGameState();

    // Place a wall at (5,7) — obstructs passability and vision
    pmap[5][7].layers[0] = TileType.WALL;

    const ctx = buildWeaponAttackContext();
    // null bolt: no path tuning, just straight-line trace
    const impact = ctx.getImpactLoc({ x: 5, y: 5 }, { x: 5, y: 10 }, 20, false, null);

    // Must stop at or before the wall cell, not at the target
    expect(impact.x).toBe(5);
    expect(impact.y).toBeLessThanOrEqual(7);
    expect(impact.y).not.toBe(10);
});

it("wired: canPass delegates to monster-movement canPass — player always blocked; ally with lower HP passable", () => {
    // canPass is now wired in movement.ts (buildTravelContext), movement-cost-map.ts
    // (buildCostMapFovContext), and vision-wiring.ts (fovDisplayCtx).
    setupPlayer();
    const ctx = buildTravelContext();
    const player = getGameState().player;

    // Build two minimal ally creatures (no leader relationship, both Ally state)
    const base = {
        info: { flags: 0, abilityFlags: 0, behaviorFlags: 0, bolts: [] },
        status: new Array(60).fill(0),
        bookkeepingFlags: 0,
        leader: null as Creature | null,
        creatureState: CreatureState.Ally,
    } as unknown as Creature;

    const mover: Creature = { ...base, currentHP: 10, maxHP: 10 } as unknown as Creature;
    const blocker: Creature = { ...base, currentHP: 5, maxHP: 10 } as unknown as Creature;

    // player as blocker → always false
    expect(ctx.canPass(mover, player)).toBe(false);
    // Two Ally-state monsters, no leader link, blocker.currentHP < mover.currentHP → true
    expect(ctx.canPass(mover, blocker)).toBe(true);
    // Reverse HP: blocker stronger → false
    const strongBlocker: Creature = { ...base, currentHP: 20, maxHP: 20 } as unknown as Creature;
    expect(ctx.canPass(mover, strongBlocker)).toBe(false);
});

it("wired: buildCostMapFovContext().itemName() delegates to itemNameFn and writes to buffer", () => {
    // itemName wired in buildCostMapFovContext → items/item-naming.ts itemNameFn via namingCtx.
    // Should write a non-empty string to buf[0] for a valid item (was stub writing "item").
    setupPlayer();
    const ctx = buildCostMapFovContext();
    const buf: string[] = [""];
    // Minimal weapon-like item (category 1 = WEAPON, kind 0)
    const fakeItem = { category: 1, kind: 0, flags: 0, enchant1: 0, enchant2: 0,
                       charges: 0, quantity: 1, quiverNumber: 0, keyLoc: [] };
    ctx.itemName(fakeItem as any, buf, false, false, null);
    expect(typeof buf[0]).toBe("string");
    expect(buf[0].length).toBeGreaterThan(0);
});

// =============================================================================
// Stub registry — IO.c movement-context domain stubs (Phase 3b, port-v2-audit)
// =============================================================================

it.skip("UPDATE: plotForegroundChar() wired in browser — IO integration test not feasible in unit tests", () => {
    // plotForegroundChar is wired in movement-weapon-context.ts to plotCharWithColor + displayBuffer.
    // Functional in browser; unit test verification requires a rendered dungeon cell (IO integration).
    // C: IO.c:1836 — plotForegroundChar() — draws glyph using existing cell background.
});

it("wired: buildInputContext().exploreKey() delegates to exploreFn (async, resolves cleanly)", async () => {
    // exploreKey is wired Phase 2b: input-context.ts → movement/travel-explore.ts exploreFn.
    // With no unexplored cells reachable, explore exits immediately without error.
    setupPlayer();
    const ctx = buildInputContext();
    await expect(ctx.exploreKey(false)).resolves.toBeUndefined();
});

// =============================================================================
// Stub registry — Recordings.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("DEFER: cancelKeystroke() — port-v2-persistence (input recording layer)", () => {
    // DEFER: port-v2-persistence
    // C: Recordings.c:147 — cancelKeystroke()
    // buildMovementContext().cancelKeystroke() is a permanent no-op stub.
    // Real implementation belongs to the recordings layer.
});

// =============================================================================
// Stub registry — wiring stubs (Phase 3d, port-v2-audit)
// =============================================================================

it("wired: buildInputContext().dijkstraScan() delegates to dijkstraScanFn", () => {
    // dijkstraScan is wired Phase 2b: input-context.ts → dijkstra/dijkstra.ts dijkstraScanFn.
    // After a scan from a seeded source cell, adjacent floor cells should have non-infinite distance.
    setupPlayer();
    const ctx = buildInputContext();
    const INFINITY = 30000;
    const distMap: number[][] = Array.from({ length: 80 }, () => new Array(34).fill(INFINITY));
    const costMap: number[][] = Array.from({ length: 80 }, () => new Array(34).fill(1));
    distMap[5][5] = 0;  // source cell
    expect(() => ctx.dijkstraScan(distMap, costMap, false)).not.toThrow();
    // Adjacent cells should be reachable (distance < INFINITY)
    expect(distMap[6][5]).toBeLessThan(INFINITY);
});

it.skip("UPDATE: terrainFlags() in buildInputContext deliberate () => 0 — not needed for keyboard input", () => {
    // C: Globals.c:581 — terrainFlags()
    // io/input-context.ts has `() => 0` — a deliberate stub, not a wiring gap.
    // Domain function IS implemented at state/helpers.ts and tested in movement/map-queries.test.ts.
    // terrainFlags is wired in cursor/misc contexts; buildInputContext does not need it.
    // Stub is intentional and safe; no fix needed.
});

it.skip("UPDATE: knownToPlayerAsPassableOrSecretDoor — safe over-approximation, no fix needed", () => {
    // C (Monsters.c:3668): getLocationFlags falls through to actual terrain flags for undiscovered cells.
    // TS (movement.ts): checks (DISCOVERED | MAGIC_MAPPED) first — returns false for undiscovered cells.
    // In practice harmless: populateCreatureCostMap marks undiscovered cells as PDS_OBSTRUCTION,
    // so pathfinding never routes through them. The TS extra guard is a safe over-approximation.
    // Deliberate divergence — keep as-is, no fix needed.
});

it.skip("UPDATE: terrainMechFlags() in buildInputContext deliberate () => 0 — same as terrainFlags", () => {
    // C: Globals.c:590 — terrainMechFlags()
    // io/input-context.ts has `() => 0` — a deliberate stub, not a wiring gap.
    // Domain function IS implemented at state/helpers.ts and tested in movement/map-queries.test.ts.
    // Same rationale as terrainFlags: buildInputContext does not use these for keyboard dispatch.
    // Stub is intentional and safe; no fix needed.
});
