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
import { drinkPotion, apply } from "../src/items/item-handlers.js";
import { buildTurnProcessingContext } from "../src/turn.js";
import { playerTurnEnded as playerTurnEndedFn } from "../src/time/turn-processing.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, PotionKind, ItemCategory, StatusEffect } from "../src/types/enums.js";
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

it.skip("stub: message() is a no-op (should queue a message for display)", () => {
    // buildItemHandlerContext().message() does nothing.
    // Real implementation should call the message queue in ui.ts,
    // rendering the text on the 3-row message area.
});

it.skip("stub: confirm() always returns true (should prompt player for y/n)", () => {
    // buildItemHandlerContext().confirm() returns true unconditionally.
    // Real implementation should display a yes/no prompt and wait for keypress.
    // This means cursed-item warnings are silently bypassed in the wiring phase.
});

it.skip("stub: promptForItemOfType() returns null (should open inventory chooser)", () => {
    // buildItemHandlerContext().promptForItemOfType() always returns null.
    // Real implementation should render the inventory list, highlight matching items,
    // and wait for the player to pick one.
});

it.skip("stub: spawnDungeonFeature() is a no-op (should spawn terrain/gas effects)", () => {
    // buildItemHandlerContext().spawnDungeonFeature() does nothing.
    // Real implementation should call spawnDungeonFeature() from architect/
    // which places DF tile effects at the given position.
});

it.skip("stub: haste() is a no-op (should apply movementSpeed bonus for N turns)", () => {
    // buildItemHandlerContext().haste() does nothing.
    // Real implementation should apply the haste status effect to the creature.
});

it.skip("stub: teleport() is a no-op (should relocate creature to random valid cell)", () => {
    // buildItemHandlerContext().teleport() does nothing.
    // Real implementation should find a random passable cell and move the creature.
});

it.skip("stub: aggravateMonsters() is a no-op (should wake all monsters in range)", () => {
    // buildItemHandlerContext().aggravateMonsters() does nothing.
    // Real implementation should wake and alert every monster within the radius.
});

it.skip("stub: crystalize() is a no-op (should create crystal terrain in radius)", () => {
    // buildItemHandlerContext().crystalize() does nothing.
    // Real implementation should call the shattering scroll terrain effect.
});

it.skip("stub: negationBlast() is a no-op (should strip magic from creatures/items in FOV)", () => {
    // buildItemHandlerContext().negationBlast() does nothing.
    // Real implementation should iterate creatures/floor items in field of view
    // and remove all magical status effects.
});

it.skip("stub: exposeCreatureToFire() is a no-op (should set Burning status on creature)", () => {
    // buildItemHandlerContext().exposeCreatureToFire() does nothing.
    // Real implementation should call exposeCreatureToFire() from creature-effects.ts
    // with a fully wired CreatureEffectsContext.
});

it.skip("stub: updateEncumbrance() is a no-op (should recalculate speed penalties)", () => {
    // buildItemHandlerContext().updateEncumbrance() does nothing.
    // Real implementation should recalculate movement/attack speed based on
    // equipped armor weight vs. player strength.
});
