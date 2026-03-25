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
import { MonsterBookkeepingFlag, MonsterAbilityFlag } from "../src/types/flags.js";
import { MonsterType, StatusEffect, CreatureState, CreatureMode, ItemCategory, TileType, DungeonLayer } from "../src/types/enums.js";
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
        const { monsters, floorItems, pmap } = getGameState();
        // set a real floor cell so doMakeMonsterDropItem can find a drop location
        pmap[6][5].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[6][5].layers[DungeonLayer.Liquid] = TileType.NOTHING;
        pmap[6][5].layers[DungeonLayer.Gas] = TileType.NOTHING;
        pmap[6][5].layers[DungeonLayer.Surface] = TileType.NOTHING;
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
        const { monsters, floorItems, pmap } = getGameState();
        // set a real floor cell so doMakeMonsterDropItem can find a drop location
        pmap[6][5].layers[DungeonLayer.Dungeon] = TileType.FLOOR;
        pmap[6][5].layers[DungeonLayer.Liquid] = TileType.NOTHING;
        pmap[6][5].layers[DungeonLayer.Gas] = TileType.NOTHING;
        pmap[6][5].layers[DungeonLayer.Surface] = TileType.NOTHING;
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

it("demoteMonsterFromLeadership removes leader flag and reassigns followers", () => {
    const { monsters } = getGameState();
    const leader = makeMonster(MonsterType.MK_RAT);
    const follower = makeMonster(MonsterType.MK_RAT);
    leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
    follower.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
    follower.leader = leader;
    monsters.push(leader, follower);

    const ctx = buildCombatDamageContext();
    ctx.demoteMonsterFromLeadership(leader);

    expect(leader.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).toBe(0);
    expect(follower.leader).toBeNull(); // promoted to new leader, leader=null
    expect(follower.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).toBeTruthy();
});

it("checkForContinuedLeadership removes MB_LEADER when no followers remain", () => {
    const { monsters } = getGameState();
    const leader = makeMonster(MonsterType.MK_RAT);
    leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
    monsters.push(leader);

    const ctx = buildCombatDamageContext();
    ctx.checkForContinuedLeadership(leader);

    expect(leader.bookkeepingFlags & MonsterBookkeepingFlag.MB_LEADER).toBe(0);
});

it("getMonsterDFMessage returns DFMessage from monsterText catalog", () => {
    const ctx = buildCombatDamageContext();
    // MonsterType 6 (acid mound) has a non-empty DFMessage
    const msg = ctx.getMonsterDFMessage(6);
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
    // MonsterType 0 (player) has empty DFMessage
    expect(ctx.getMonsterDFMessage(0)).toBe("");
});

it("resolvePronounEscapes substitutes $HESHE based on monster gender", () => {
    const { player, monsters, pmap } = getGameState();
    // Make a visible male monster
    const monst = makeMonster(MonsterType.MK_RAT);
    monst.loc = { x: 5, y: 5 };
    monst.info.flags |= (1 << 25); // MONST_MALE
    pmap[5][5].flags |= (1 << 1);  // VISIBLE
    monsters.push(monst);

    const ctx = buildCombatDamageContext();
    expect(ctx.resolvePronounEscapes("$HESHE attacks", monst)).toBe("he attacks");
    expect(ctx.resolvePronounEscapes("$HISHER weapon", monst)).toBe("his weapon");
    expect(ctx.resolvePronounEscapes("$HIMHER", monst)).toBe("him");
    expect(ctx.resolvePronounEscapes("$HESHE", player)).toBe("you");
});

it("unAlly removes ally status and follower flags", () => {
    const monst = makeMonster(MonsterType.MK_RAT);
    const { player } = getGameState();
    monst.creatureState = CreatureState.Ally;
    monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER | MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED;
    monst.leader = player;

    const ctx = buildCombatAttackContext();
    ctx.unAlly(monst);

    expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER).toBe(0);
    expect(monst.leader).toBeNull();
});

it("wakeUp alerts monster and sets ticksUntilTurn to 100", () => {
    const { monsters, player } = getGameState();
    const monst = makeMonster(MonsterType.MK_RAT);
    monst.loc = { x: 5, y: 5 };
    monst.creatureState = CreatureState.Sleeping;
    monst.ticksUntilTurn = 0;
    monsters.push(monst);

    const ctx = buildCombatDamageContext();
    ctx.wakeUp(monst);

    expect(monst.ticksUntilTurn).toBe(100);
    expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    expect(monst.lastSeenPlayerAt).toEqual(player.loc);
});

// ---------------------------------------------------------------------------
// B63 — Monkey steal-and-flee (MA_HIT_STEAL_FLEE)
// ---------------------------------------------------------------------------

describe("monkey steal-and-flee (B63)", () => {
    it("monkey steals an unequipped item and enters MODE_PERM_FLEEING", () => {
        const player = setupPlayer();
        player.currentHP = 100; // won't die from one monkey hit
        player.status[StatusEffect.Paralyzed] = 1; // guarantee attackHit
        player.loc = { x: 5, y: 5 };

        const monkey = makeMonster(MonsterType.MK_MONKEY);
        monkey.loc = { x: 6, y: 5 };
        const { monsters, packItems } = getGameState();
        monsters.push(monkey);

        // Place one unequipped food item in the player's pack
        const food = makeItem();
        food.category = ItemCategory.FOOD;
        packItems.push(food);

        const ctx = buildCombatAttackContext();
        attack(monkey, player, false, ctx);

        // Monkey should now carry the stolen item and be permanently fleeing
        expect(monkey.carriedItem).toBe(food);
        expect(packItems).not.toContain(food);
        expect(monkey.creatureMode).toBe(CreatureMode.PermFleeing);
        expect(monkey.creatureState).toBe(CreatureState.Fleeing);
    });

    it("monkey does not steal when pack is empty", () => {
        const player = setupPlayer();
        player.status[StatusEffect.Paralyzed] = 1;
        player.loc = { x: 5, y: 5 };

        const monkey = makeMonster(MonsterType.MK_MONKEY);
        monkey.loc = { x: 6, y: 5 };
        const { monsters } = getGameState();
        monsters.push(monkey);
        // packItems is empty (no items pushed)

        const ctx = buildCombatAttackContext();
        attack(monkey, player, false, ctx);

        expect(monkey.carriedItem).toBeNull();
        expect(monkey.creatureMode).toBe(CreatureMode.Normal);
    });

    it("monkey with weapon stack > 3 steals half", () => {
        const player = setupPlayer();
        player.currentHP = 100;
        player.status[StatusEffect.Paralyzed] = 1;
        player.loc = { x: 5, y: 5 };

        const monkey = makeMonster(MonsterType.MK_MONKEY);
        monkey.loc = { x: 6, y: 5 };
        const { monsters, packItems } = getGameState();
        monsters.push(monkey);

        const darts = makeItem();
        darts.category = ItemCategory.WEAPON;
        darts.quantity = 10;
        packItems.push(darts);

        const ctx = buildCombatAttackContext();
        attack(monkey, player, false, ctx);

        // Should steal 5 (half of 10, rounded up via (10+1)/2 = 5)
        expect(monkey.carriedItem).not.toBeNull();
        expect(monkey.carriedItem?.quantity).toBe(5);
        // Original stack reduced by 5
        expect(darts.quantity).toBe(5);
        // Original item still in pack
        expect(packItems).toContain(darts);
    });
});

// ---------------------------------------------------------------------------
// B66 — Pink jelly splits when struck (MA_CLONE_SELF_ON_DEFEND)
// ---------------------------------------------------------------------------

describe("pink jelly splits when hit (B66)", () => {
    it("spawns a clone when struck and has room to split", () => {
        const player = setupPlayer();
        player.status[StatusEffect.Paralyzed] = 0; // player can attack normally
        player.loc = { x: 5, y: 5 };

        // Pink jelly with enough HP to survive the hit
        const jelly = makeMonster(MonsterType.MK_PINK_JELLY, 50);
        jelly.loc = { x: 6, y: 5 };
        // Jelly must have MA_CLONE_SELF_ON_DEFEND (it does by catalog)
        expect(jelly.info.abilityFlags & MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND).toBeTruthy();

        const { monsters, pmap } = getGameState();
        monsters.push(jelly);

        // Set the area around the jelly to FLOOR on all terrain layers so
        // monsterAvoids returns false. The default pmap has all 4 layers as
        // GRANITE (T_OBSTRUCTS_PASSABILITY), which would block every spawn cell.
        for (let x = 4; x <= 8; x++) {
            for (let y = 3; y <= 7; y++) {
                pmap[x][y].layers.fill(TileType.FLOOR);
            }
        }

        // Force the hit by marking jelly as sleeping (guaranteed hit + no avoidance on split)
        jelly.creatureState = CreatureState.Sleeping;

        const ctx = buildCombatAttackContext();
        attack(player, jelly, false, ctx);

        // Jelly must still be alive (split only fires when currentHP > 0)
        expect(jelly.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBe(0);

        // A clone should have been added to the monsters array
        const clones = monsters.filter(m => m !== jelly && m.info.monsterID === jelly.info.monsterID);
        expect(clones.length).toBe(1);

        // Both jelly and clone should each have roughly half the original HP
        expect(jelly.currentHP).toBeGreaterThan(0);
        expect(clones[0].currentHP).toBeGreaterThan(0);
        expect(jelly.currentHP + clones[0].currentHP).toBeLessThanOrEqual(50);
    });

    it("does not split when jelly has only 1 HP (dies from the hit)", () => {
        const player = setupPlayer();
        player.loc = { x: 5, y: 5 };

        const jelly = makeMonster(MonsterType.MK_PINK_JELLY, 1);
        jelly.loc = { x: 6, y: 5 };
        jelly.creatureState = CreatureState.Sleeping;

        const { monsters } = getGameState();
        monsters.push(jelly);

        const ctx = buildCombatAttackContext();
        attack(player, jelly, false, ctx);

        // Jelly must be dying (died from the hit)
        expect(jelly.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();

        // No clone should exist
        const clones = monsters.filter(m => m !== jelly && m.info.monsterID === jelly.info.monsterID);
        expect(clones.length).toBe(0);
    });
});
