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

// =============================================================================
// Stub registry — Items.c domain stubs (Phase 3b, port-v2-audit)
// =============================================================================

it.skip("stub: playerCancelsBlinking() always returns true (should let player abort blink wand targeting)", () => {
    // C: Items.c:6470 — playerCancelsBlinking()
    // items.ts:243 has a `() => true` stub.
    // Real implementation should run the blink targeting cursor loop and return
    // true only if the player presses Escape or an invalid target key.
});

it.skip("stub: summonGuardian() is a no-op (should spawn a guardian monster near the player)", () => {
    // C: Items.c:6651 — summonGuardian()
    // items.ts:216 has a `() => {}` stub.
    // Real implementation should find a valid adjacent cell and spawn a guardian
    // creature allied to the player.
});

it.skip("stub: updateIdentifiableItem() is a no-op (should update identification state for one item)", () => {
    // C: Items.c:6908 — updateIdentifiableItem()
    // items.ts:185 has a `() => {}` stub.
    // Real implementation should check whether the given item's kind has been
    // used enough to auto-identify and update its known/identified flags.
});

it.skip("stub: nextTargetAfter() always returns false (should cycle targeting cursor to next monster)", () => {
    // C: Items.c:5281 — nextTargetAfter()
    // io/input-context.ts:230 has a `() => false` context stub.
    // Real implementation should advance the targeting cursor to the next visible
    // hostile monster in line-of-sight order.
});

it.skip("stub: moveCursor() always returns false (should move the targeting cursor one step)", () => {
    // C: Items.c:5372 — moveCursor()
    // io/input-context.ts:229 has a `() => false` context stub.
    // Real implementation should move the targeting reticle by one cell in the
    // given direction and update the map highlight.
});

it.skip("stub: chooseTarget() returns an invalid position (should run the bolt targeting UI loop)", () => {
    // C: Items.c:5607 — chooseTarget()
    // items.ts:241 has a context stub returning an invalid position.
    // Real implementation should show the targeting cursor, handle directional
    // input, and return the confirmed target location.
});

it.skip("stub: swapLastEquipment() is a no-op (should swap weapon/armor with previously equipped item)", () => {
    // C: Items.c:6441 — swapLastEquipment()
    // io/input-context.ts:202 has a `() => {}` stub.
    // Real implementation should equip the most recently unequipped weapon or
    // armor, swapping with the currently equipped item.
});

it.skip("stub: updatePlayerRegenerationDelay() is a no-op (should recalculate HP regeneration rate)", () => {
    // C: Items.c:7903 — updatePlayerRegenerationDelay()
    // items.ts:238 has a `() => {}` stub.
    // Real implementation should recompute the player's regeneration delay based
    // on equipped rings of regeneration and current status effects.
});

it.skip("stub: makePlayerTelepathic() is a no-op (should grant temporary telepathy to the player)", () => {
    // C: Items.c:3976 — makePlayerTelepathic()
    // items.ts:203 has a `() => {}` stub.
    // Real implementation should set the telepathy status flag and duration on
    // the player creature so monsters become visible through walls.
});

it.skip("stub: rechargeItems() is a no-op (should recharge all depleted staffs and charms)", () => {
    // C: Items.c:3989 — rechargeItems()
    // items.ts:225 has a `() => {}` stub.
    // Note: distinct from rechargeItemsIncrementally (Time.c per-turn tick).
    // Real implementation should instantly restore all staffs/charms to full
    // charge (used by the recharge scroll).
});

it.skip("stub: discordBlast() is a no-op (should make all monsters in FOV attack each other)", () => {
    // C: Items.c:4129 — discordBlast()
    // items.ts:227 has a `() => {}` stub.
    // Real implementation should apply the discord status to every visible
    // monster, causing them to treat all creatures as enemies.
});

it.skip("stub: imbueInvisibility() is a no-op (should grant temporary invisibility to the player)", () => {
    // C: Items.c:4187 — imbueInvisibility()
    // items.ts:204 has a `() => {}` stub.
    // Real implementation should set the invisible status flag and duration on
    // the player so monsters cannot detect them by sight.
});

// =============================================================================
// Stub registry — Monsters.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: fadeInMonster() is a no-op (should animate a monster appearing on screen)", () => {
    // C: Monsters.c:904 — fadeInMonster()
    // items.ts:206, combat.ts:92, and turn.ts:90 all have `() => {}` context stubs.
    // Real implementation should render the monster with gradually increasing opacity
    // over several frames so it visibly materializes rather than appearing instantly.
});

// =============================================================================
// Stub registry — Recordings.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: recordKeystrokeSequence() is a no-op (should record a multi-key input sequence for playback)", () => {
    // C: Recordings.c:154 — recordKeystrokeSequence()
    // items.ts:194 has a `() => {}` context stub.
    // Real implementation should append each keystroke in the sequence to the
    // recording buffer so the full input sequence can be replayed later.
});

it.skip("stub: recordMouseClick() is a no-op (should record a mouse click event for playback)", () => {
    // C: Recordings.c:162 — recordMouseClick()
    // items.ts:195 and movement.ts:457 have `() => {}` context stubs.
    // Real implementation should append the mouse position and button state to the
    // recording buffer so click events can be replayed during playback.
});
