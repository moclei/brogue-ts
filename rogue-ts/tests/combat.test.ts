/*
 *  combat.test.ts — Integration tests for the combat pipeline
 *  Port V2 — rogue-ts
 *
 *  These tests exercise attack() and killCreature() through the real context
 *  builders (buildCombatDamageContext, buildCombatAttackContext).  They verify
 *  the combat state machine without requiring a full platform.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { initGameState, getGameState } from "../src/core.js";
import { buildCombatDamageContext, buildCombatAttackContext } from "../src/combat.js";
import { attack } from "../src/combat/combat-attack.js";
import { killCreature } from "../src/combat/combat-damage.js";
import { buildTurnProcessingContext } from "../src/turn.js";
import { playerTurnEnded as playerTurnEndedFn } from "../src/time/turn-processing.js";
import { createCreature } from "../src/monsters/monster-creation.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterBookkeepingFlag } from "../src/types/flags.js";
import { MonsterType, StatusEffect, CreatureState } from "../src/types/enums.js";
import type { Creature, Item } from "../src/types/types.js";

// =============================================================================
// Test helpers
// =============================================================================

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
    c.ticksUntilTurn = 200; // won't take a turn on its own
    return c;
}

/** Minimal placeholder item for drop testing. */
function makeItem(): Item {
    return {
        category: 0,
        kind: 0,
        flags: 0,
        displayChar: 0 as never,
        foreColor: { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 },
        quantity: 1,
        quiverNumber: 0,
        loc: { x: 0, y: 0 },
        depth: 0,
        originDepth: 0,
        enchant1: 0,
        enchant2: 0,
        vorpalEnemy: 0,
        charges: 0,
        timesEnchanted: 0,
        carried: false,
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
    return player;
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
    initGameState();
});

// ---------------------------------------------------------------------------
// killCreature — core death machinery
// ---------------------------------------------------------------------------

describe("killCreature — marks creature dying and handles item drop", () => {
    it("sets MB_IS_DYING and MB_HAS_DIED on a normal monster", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT);
        monster.loc = { x: 6, y: 5 };
        const { monsters } = getGameState();
        monsters.push(monster);

        const ctx = buildCombatDamageContext();
        killCreature(monster, false, ctx);

        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED).toBeTruthy();
        expect(monster.currentHP).toBe(0);
    });

    it("drops carried item to floorItems", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT);
        monster.loc = { x: 6, y: 5 };
        const item = makeItem();
        monster.carriedItem = item;
        const { monsters, floorItems } = getGameState();
        monsters.push(monster);

        const ctx = buildCombatDamageContext();
        killCreature(monster, false, ctx);

        expect(monster.carriedItem).toBeNull();
        expect(floorItems).toContain(item);
    });

    it("administrative death deletes item rather than dropping it", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT);
        monster.loc = { x: 6, y: 5 };
        const item = makeItem();
        monster.carriedItem = item;
        const { monsters, floorItems } = getGameState();
        monsters.push(monster);
        floorItems.push(item); // pre-place so deleteItem can find it

        const ctx = buildCombatDamageContext();
        killCreature(monster, true, ctx);

        expect(monster.carriedItem).toBeNull();
        expect(floorItems).not.toContain(item);
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH).toBeTruthy();
    });

    it("does not double-kill an already-dying monster", () => {
        setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT);
        monster.loc = { x: 6, y: 5 };
        const { monsters } = getGameState();
        monsters.push(monster);
        monster.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;

        const ctx = buildCombatDamageContext();
        // Second kill should be a no-op
        expect(() => killCreature(monster, false, ctx)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// attack — full attack resolution with sleeping monster (guaranteed hit)
// ---------------------------------------------------------------------------

describe("attack — player attacks sleeping monster", () => {
    it("kills a 1-HP sleeping monster and marks it dying", () => {
        const player = setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT, 1);
        monster.loc = { x: 6, y: 5 };
        monster.creatureState = CreatureState.Sleeping; // guarantees hit + 3x damage
        const { monsters } = getGameState();
        monsters.push(monster);

        const ctx = buildCombatAttackContext();
        const hit = attack(player, monster, false, ctx);

        expect(hit).toBe(true);
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
    });

    it("drops the monster's carried item after a killing blow", () => {
        const player = setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT, 1);
        monster.loc = { x: 6, y: 5 };
        monster.creatureState = CreatureState.Sleeping;
        const item = makeItem();
        monster.carriedItem = item;
        const { monsters, floorItems } = getGameState();
        monsters.push(monster);

        const ctx = buildCombatAttackContext();
        attack(player, monster, false, ctx);

        expect(floorItems).toContain(item);
        expect(monster.carriedItem).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Full cycle — attack kills monster, playerTurnEnded removes it
// ---------------------------------------------------------------------------

describe("full cycle — attack, die, remove from monster list", () => {
    it("removes dead monster from monsters array after playerTurnEnded", () => {
        const player = setupPlayer();
        const monster = makeMonster(MonsterType.MK_RAT, 1);
        monster.loc = { x: 6, y: 5 };
        monster.creatureState = CreatureState.Sleeping;
        const { monsters } = getGameState();
        monsters.push(monster);

        // Step 1: attack — monster dies
        const combatCtx = buildCombatAttackContext();
        attack(player, monster, false, combatCtx);
        expect(monster.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();

        // Step 2: playerTurnEnded → removeDeadMonsters
        const turnCtx = buildTurnProcessingContext();
        playerTurnEndedFn(turnCtx);

        expect(getGameState().monsters).not.toContain(monster);
        expect(getGameState().monsters).toHaveLength(0);
    });
});

// =============================================================================
// Stub audit: known-incomplete behaviours in buildCombatDamageContext
// =============================================================================

it.skip("stub: anyoneWantABite wires real absorption check (CombatHelperContext)", () => {
    // buildCombatDamageContext().anyoneWantABite always returns false.
    // Real implementation should call anyoneWantABite() from combat-helpers.ts
    // with a properly built CombatHelperContext (needs clone, monsterAtLoc, etc.).
});

it.skip("stub: demoteMonsterFromLeadership wires real leadership demotion", () => {
    // buildCombatDamageContext().demoteMonsterFromLeadership is a no-op.
    // Real implementation should clear leader/follower links for the dying creature.
});

it.skip("stub: checkForContinuedLeadership wires real leadership continuation", () => {
    // buildCombatDamageContext().checkForContinuedLeadership is a no-op.
    // Real implementation should promote a follower to leader if the leader dies.
});

it.skip("stub: getMonsterDFMessage returns empty string (should look up DF catalog)", () => {
    // buildCombatDamageContext().getMonsterDFMessage always returns "".
    // Real implementation should return dungeonFeatureCatalog[monster.DFType].message
    // when the monster has MA_DF_ON_DEATH.
});

it.skip("stub: resolvePronounEscapes is a passthrough (should substitute $HESHE etc.)", () => {
    // buildCombatDamageContext().resolvePronounEscapes returns the text unchanged.
    // Real implementation should substitute $HESHE, $HISHER, $HIMHER based on gender.
});

it.skip("stub: attackVerb returns 'hits' (should select verb from monster text table)", () => {
    // buildCombatAttackContext().attackVerb returns 'hits' regardless of damage.
    // Real implementation should call attackVerb(attacker, damagePercent, monsterTextTable, ctx)
    // from combat-helpers.ts to pick the correct damage-tier verb.
});

it.skip("stub: magicWeaponHit is a no-op (should apply weapon runic on-hit effects)", () => {
    // buildCombatAttackContext().magicWeaponHit does nothing.
    // Real implementation should call magicWeaponHit() from combat-runics.ts
    // with a full RunicContext, triggering enchant effects (paralysis, slowing, etc.).
});

it.skip("stub: applyArmorRunicEffect returns '' (should apply armor runic on-hit effects)", () => {
    // buildCombatAttackContext().applyArmorRunicEffect does nothing.
    // Real implementation should call applyArmorRunicEffect() from combat-runics.ts.
});

it.skip("stub: specialHit is a no-op (should apply monster on-hit abilities)", () => {
    // buildCombatAttackContext().specialHit does nothing.
    // Real implementation should call specialHit() from combat-runics.ts
    // for monster abilities like poison, fire, weakness, item stealing, etc.
});

it.skip("stub: unAlly is a no-op (should be wired in monsters.ts)", () => {
    // buildCombatAttackContext().unAlly does nothing.
    // Real implementation should remove ally status and set monster back to wandering.
});

it.skip("stub: wakeUp sets TrackingScent only (should call full wakeUp with MonsterStateContext)", () => {
    // buildCombatDamageContext().wakeUp sets creatureState = TrackingScent.
    // Real wakeUp also plays a sound, updates scent map, and alerts nearby allies.
});
