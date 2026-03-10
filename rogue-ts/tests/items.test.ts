/*
 *  items.test.ts — Integration tests for the item handling pipeline
 *  Port V2 — rogue-ts
 *
 *  These tests exercise drinkPotion() and apply() through the real context
 *  builders (buildItemHandlerContext, buildItemHelperContext).  They verify
 *  item state changes and turn advancement without requiring a full platform.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "../src/core.js";
import { buildItemHandlerContext, buildItemHelperContext } from "../src/items.js";
import { buildInputContext } from "../src/io/input-context.js";
import { drinkPotion, apply } from "../src/items/item-handlers.js";
import { buildTurnProcessingContext } from "../src/turn.js";
import { playerTurnEnded as playerTurnEndedFn } from "../src/time/turn-processing.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, PotionKind, ItemCategory, StatusEffect, DungeonLayer } from "../src/types/enums.js";
import type { Creature, Item } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

function makePotion(kind: PotionKind): Item {
    return {
        category: ItemCategory.POTION,
        kind,
        flags: 0,
        displayChar: 33 as never,
        foreColor: { red: 100, green: 50, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 },
        quantity: 1,
        quiverNumber: 0,
        loc: { x: 0, y: 0 },
        depth: 1,
        originDepth: 1,
        enchant1: 0,
        enchant2: 0,
        vorpalEnemy: 0,
        charges: 0,
        timesEnchanted: 0,
        carried: true,
        inventoryLetter: "a",
        inscription: "",
        identified: false,
    } as unknown as Item;
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
    rogue.strength = 12;
    return player;
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
    initGameState();
});

// ---------------------------------------------------------------------------
// drinkPotion — core item use
// ---------------------------------------------------------------------------

describe("drinkPotion — strength potion applies to rogue.strength", () => {
    it("drinking a strength potion increases rogue.strength by 1", () => {
        setupPlayer();
        const { rogue, packItems } = getGameState();
        const initialStrength = rogue.strength;

        const potion = makePotion(PotionKind.Strength);
        packItems.push(potion);

        const ctx = buildItemHandlerContext();
        const result = drinkPotion(potion, ctx);

        expect(result).toBe(true);
        expect(rogue.strength).toBe(initialStrength + 1);
    });

    it("potion is removed from packItems after drinking", () => {
        setupPlayer();
        const { packItems } = getGameState();

        const potion = makePotion(PotionKind.Strength);
        packItems.push(potion);

        const ctx = buildItemHandlerContext();
        drinkPotion(potion, ctx);

        expect(packItems).not.toContain(potion);
        expect(packItems).toHaveLength(0);
    });

    it("drinking a hallucination potion sets hallucinating status", () => {
        setupPlayer();
        const { player, packItems } = getGameState();

        const potion = makePotion(PotionKind.Hallucination);
        packItems.push(potion);

        const ctx = buildItemHandlerContext();
        drinkPotion(potion, ctx);

        expect(player.status[StatusEffect.Hallucinating]).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// apply() — full cycle: item used, turn advances
// ---------------------------------------------------------------------------

describe("apply — full cycle: drink potion, playerTurnEnded, game still runs", () => {
    it("apply() with strength potion ends the turn and game continues", () => {
        setupPlayer();
        const { rogue, packItems } = getGameState();
        const initialStrength = rogue.strength;

        const potion = makePotion(PotionKind.Strength);
        packItems.push(potion);

        const ctx = buildItemHandlerContext();
        apply(potion, ctx);  // calls playerTurnEnded internally

        expect(rogue.strength).toBe(initialStrength + 1);
        expect(rogue.gameHasEnded).toBe(false);
    });

    it("potion consumed and turn ended: monster list unaffected", () => {
        setupPlayer();
        const { packItems } = getGameState();

        const potion = makePotion(PotionKind.Strength);
        packItems.push(potion);

        const ctx = buildItemHandlerContext();
        apply(potion, ctx);

        // No monsters: monsters array stays empty after turn processing
        expect(getGameState().monsters).toHaveLength(0);
        expect(packItems).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// buildItemHelperContext — smoke test
// ---------------------------------------------------------------------------

describe("buildItemHelperContext — context builds without errors", () => {
    it("buildItemHelperContext returns a context with pmap and player", () => {
        setupPlayer();
        const { player } = getGameState();

        const ctx = buildItemHelperContext();

        expect(ctx.player).toBe(player);
        expect(ctx.packItems).toBeInstanceOf(Array);
        expect(ctx.floorItems).toBeInstanceOf(Array);
    });

    it("posEq returns true for equal positions", () => {
        setupPlayer();
        const ctx = buildItemHelperContext();
        expect(ctx.posEq({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
        expect(ctx.posEq({ x: 3, y: 4 }, { x: 3, y: 5 })).toBe(false);
    });
});

// =============================================================================
// Stub audit: known-incomplete behaviours in buildItemHandlerContext
// =============================================================================

it("buildItemHandlerContext().message() queues message in archive (Phase 1)", () => {
    // items.ts:256 wires io.message from buildMessageContext() into the item handler context.
    // Calling message() increments messageState.archivePosition confirming the pipeline is live.
    const ctx = buildItemHandlerContext();
    ctx.message("test message", 0);
    const { messageState } = getGameState();
    expect(messageState.archivePosition).toBeGreaterThan(0);
});

it.skip("stub: confirm() always returns true (should prompt player for y/n)", () => {
    // DEFER: port-v2-platform — deferred Phase 3b.
    // buildItemHandlerContext().confirm() returns true unconditionally.
    // Real implementation requires async confirm dialog via waitForEvent() event bridge.
    // Cursed-item warnings are silently bypassed until then.
});

it("promptForItemOfType() returns null with empty pack (real impl, buttonInputLoop deferred)", async () => {
    // Real promptForItemOfType is wired. With an empty pack, returns null immediately
    // without showing the inventory. Full selection requires Phase 7a (buttonInputLoop wiring).
    const ctx = buildItemHandlerContext();
    const result = await ctx.promptForItemOfType(0xffff, 0, 0, "Pick an item", false);
    expect(result).toBeNull();
});

it("spawnDungeonFeature() places a gas tile on the pmap (architect spawner wired)", () => {
    // spawnDungeonFeature is wired to architect/machines spawnDungeonFeature.
    // Spawning a gas-layer feature increments pmap volume at the target cell.
    setupPlayer();
    const { pmap } = getGameState();
    const ctx = buildItemHandlerContext();

    const feat = {
        tile: 48,               // some non-zero gas tile value
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
    ctx.spawnDungeonFeature(5, 5, feat, false, false);
    expect(pmap[5][5].volume).toBe(before + 10);
});


it("teleport() with INVALID_POS runs without throwing", () => {
    // Smoke test: teleport() is now wired. With an empty pmap (default state)
    // there may be no valid cell, so the player may stay put — but it must not throw.
    setupPlayer();
    const ctx = buildItemHandlerContext();
    const { player } = getGameState();
    expect(() => ctx.teleport(player, ctx.INVALID_POS, true)).not.toThrow();
});


it("exposeCreatureToFire() sets Burning status on a monster", () => {
    setupPlayer();
    const ctx = buildItemHandlerContext();
    const { player } = getGameState();
    // Use the player as the test creature (avoids needing a real monster spawn)
    player.status[StatusEffect.Burning] = 0;
    player.status[StatusEffect.ImmuneToFire] = 0;
    ctx.exposeCreatureToFire(player);
    expect(player.status[StatusEffect.Burning]).toBeGreaterThan(0);
});


// =============================================================================
// Stub registry — Items.c domain stubs (Phase 3b, port-v2-audit)
// =============================================================================

it.skip("wiring stub: items.ts chooseTarget() and playerCancelsBlinking() are async stubs (platform IO required)", () => {
    // DEFER: port-v2-platform — requires async event bridge (moveCursor + confirm via waitForEvent).
    // chooseTarget domain function is implemented in items/targeting.ts.
    // playerCancelsBlinking domain function is in items/targeting.ts.
    // Both stubs in items.ts are async but still return stub values.
});

it("swapLastEquipment() does not throw when no swap state exists", () => {
    // C: Items.c:6441 — swapLastEquipment()
    // Verify the early-exit path: rogue.swappedIn/swappedOut null → message + return.
    const { rogue } = getGameState();
    rogue.swappedIn = null;
    rogue.swappedOut = null;
    expect(() => buildInputContext().swapLastEquipment()).not.toThrow();
});






// =============================================================================
// Stub registry — Monsters.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: fadeInMonster() is a no-op (should animate a monster appearing on screen)", () => {
    // DEFER: port-v2-platform — requires canvas animation via the async event bridge.
    // C: Monsters.c:904 — fadeInMonster()
    // items.ts:375,423, combat.ts:92, and turn.ts:90 all have `() => {}` context stubs.
    // Real implementation renders the monster with gradually increasing opacity over several frames.
});

// =============================================================================
// Stub registry — Recordings.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: recordKeystrokeSequence() is a no-op (should record a multi-key input sequence for playback)", () => {
    // DEFER: port-v2-persistence
    // C: Recordings.c:154 — recordKeystrokeSequence()
    // items.ts:194 has a `() => {}` context stub.
    // Real implementation appends each keystroke to the recording buffer for playback.
});

it.skip("stub: recordMouseClick() is a no-op (should record a mouse click event for playback)", () => {
    // DEFER: port-v2-persistence
    // C: Recordings.c:162 — recordMouseClick()
    // items.ts:195 and movement.ts:457 have `() => {}` context stubs.
    // Real implementation appends mouse position and button state to the recording buffer.
});
