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
import { playerMoves } from "../src/movement/player-movement.js";
import { populateCreatureCostMap } from "../src/movement/cost-maps-fov.js";
import { buildTurnProcessingContext } from "../src/turn.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, Direction, StatusEffect, TileType, DungeonLayer } from "../src/types/enums.js";
import { TileFlag } from "../src/types/flags.js";
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
    it("player moves right one cell: loc.x advances by 1", () => {
        const player = setupPlayer();
        const ctx = buildMovementContext();

        const moved = playerMoves(Direction.Right, ctx);

        expect(moved).toBe(true);
        expect(player.loc.x).toBe(6);
        expect(player.loc.y).toBe(5);
    });

    it("player moves down one cell: loc.y advances by 1", () => {
        const player = setupPlayer();
        const ctx = buildMovementContext();

        const moved = playerMoves(Direction.Down, ctx);

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

it.skip("stub: recordKeystroke() is a no-op (should record player input for replay)", () => {
    // buildMovementContext().recordKeystroke() does nothing.
    // Real implementation should call the recording system to store the directional
    // keystroke for playback/seed-verification.
});

it.skip("stub: confirm() always returns true (should prompt player for y/n)", () => {
    // buildMovementContext().confirm() returns true unconditionally.
    // Real implementation should display a yes/no prompt and wait for keypress.
    // Affects lava/chasm/fire/trap safety checks in playerMoves.
});

it.skip("stub: pickUpItemAt() is a no-op (should pick up items from floor cell)", () => {
    // buildMovementContext().pickUpItemAt() does nothing.
    // Real implementation should transfer the item from floorItems to packItems
    // and display an inventory message.
});

it.skip("stub: checkForMissingKeys() is a no-op (should warn about missing keys)", () => {
    // buildMovementContext().checkForMissingKeys() does nothing.
    // Real implementation should check if the cell was a key-locked area and
    // the player no longer has the required key.
});

it.skip("stub: promoteTile() is a no-op (should change terrain type on interaction)", () => {
    // buildMovementContext().promoteTile() does nothing.
    // Real implementation should call the architect's tile promotion logic,
    // e.g. opening a door or triggering a pressure plate.
});

it.skip("stub: refreshDungeonCell() is a no-op (should redraw a cell on screen)", () => {
    // buildMovementContext().refreshDungeonCell() does nothing.
    // Real implementation should trigger a cell redraw via the platform renderer.
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

it.skip("stub: getQualifyingPathLocNear() returns target as-is (should pathfind)", () => {
    // buildMovementContext().getQualifyingPathLocNear() returns the target unchanged.
    // Real implementation should search for a nearby passable cell matching the
    // given blocking/forbidden flag constraints.
});

it.skip("stub: nextBrogueEvent() is a no-op in travel context (should wait for input)", () => {
    // buildTravelContext().nextBrogueEvent() does nothing.
    // Real implementation should await a platform event (key/mouse) before returning.
    // This is the async bridge for travel confirmation dialogs.
});

it.skip("stub: pauseAnimation() returns false in travel context (should animate steps)", () => {
    // buildTravelContext().pauseAnimation() returns false immediately.
    // Real implementation should delay rendering by the given frame count and
    // return true if interrupted by a keypress.
});

it.skip("stub: hilitePath()/clearCursorPath() are no-ops (should draw path on map)", () => {
    // buildTravelContext().hilitePath() and clearCursorPath() do nothing.
    // Real implementation should highlight/un-highlight the travel route on the
    // dungeon map display.
});

it.skip("stub: buildMovementContext().getImpactLoc returns target as-is (should trace bolt path)", () => {
    // buildMovementContext().getImpactLoc(origin, target) returns target unchanged.
    // Real implementation should trace the bolt trajectory through the dungeon,
    // stopping at the first wall or blocking creature hit.
});

it.skip("stub: buildCostMapFovContext().canPass returns false (should query monster traversal rules)", () => {
    // buildCostMapFovContext().canPass(monster, blocker) returns false always.
    // Real implementation should check if the monster type can pass through
    // or over the blocker creature (e.g. incorporeal, same team).
});

it.skip("stub: buildCostMapFovContext().itemName writes 'item' (should name the actual item)", () => {
    // buildCostMapFovContext().itemName(item, buf) writes 'item' to buf[0].
    // Real implementation should call the full item naming pipeline and write
    // the formatted name so the cursor tooltip shows the correct item name.
});

// =============================================================================
// Stub registry — IO.c movement-context domain stubs (Phase 3b, port-v2-audit)
// =============================================================================

it.skip("stub: plotForegroundChar() is a no-op (should render a foreground glyph for projectile animation)", () => {
    // C: IO.c:1836 — plotForegroundChar()
    // movement.ts:161 has a `() => {}` stub with comment "stub — wired in port-v2-platform".
    // Real implementation should write a glyph with foreground color to the display
    // buffer at the given position, used for spear and bolt projectile animations.
});

it.skip("stub: exploreKey() is a no-op (should execute one step of auto-explore)", () => {
    // C: IO.c:2313 — exploreKey()
    // io/input-context.ts:209 has an `async () => {}` stub with comment "explore display hooks (Phase 5)".
    // Real implementation should advance the player one step toward the nearest
    // unexplored cell and update the display, halting on danger or player input.
});

// =============================================================================
// Stub registry — Recordings.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: cancelKeystroke() is a no-op (should remove the last recorded keystroke from the buffer)", () => {
    // C: Recordings.c:147 — cancelKeystroke()
    // movement.ts:322 has a `() => {}` context stub.
    // Real implementation should pop the most recently appended keystroke from the
    // recording buffer when the player cancels an action mid-sequence.
});

// =============================================================================
// Stub registry — wiring stubs (Phase 3d, port-v2-audit)
// =============================================================================

it.skip("stub: dijkstraScan() is a no-op in input context (should delegate to dijkstra/dijkstraScan)", () => {
    // C: Dijkstra.c:202 — dijkstraScan()
    // io/input-context.ts:240 has a `() => {}` context stub.
    // Domain function is IMPLEMENTED and tested in dijkstra.test.ts.
    // Real wiring should call dijkstraScan() from dijkstra/dijkstra.ts; pathfinding is not
    // needed in the keyboard input context, so this slot may remain a deliberate no-op.
});

it.skip("stub: terrainFlags() returns 0 in input context (should delegate to state/helpers terrainFlags)", () => {
    // C: Globals.c:581 — terrainFlags()
    // io/input-context.ts:247 has a `() => 0` context stub.
    // Domain function is IMPLEMENTED at state/helpers.ts:36 and tested in movement/map-queries.test.ts.
    // Real wiring should call terrainFlags() from state/helpers.ts to return the terrain flag bitmask
    // for a given cell — used by movement collision and traversal checks.
});

it.skip("stub: terrainMechFlags() returns 0 in input context (should delegate to state/helpers terrainMechFlags)", () => {
    // C: Globals.c:590 — terrainMechFlags()
    // io/input-context.ts:248 has a `() => 0` context stub.
    // Domain function is IMPLEMENTED at state/helpers.ts:51 and tested in movement/map-queries.test.ts.
    // Real wiring should call terrainMechFlags() from state/helpers.ts to return the tile-mechanic
    // flag bitmask for a given cell — used by movement interaction checks.
});
