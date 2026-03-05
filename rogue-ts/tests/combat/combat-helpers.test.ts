/*
 *  combat-helpers.test.ts — Tests for combat utility functions
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    strLenWithoutEscapes,
    CombatMessageBuffer,
    handlePaladinFeat,
    playerImmuneToMonster,
    decrementWeaponAutoIDTimer,
    splitMonster,
    anyoneWantABite,
} from "../../src/combat/combat-helpers.js";
import type { CombatHelperContext } from "../../src/combat/combat-helpers.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { monsterClassCatalog } from "../../src/globals/monster-class-catalog.js";
import { MonsterType, StatusEffect, CreatureState, ArmorEnchant } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    ItemFlag,
    LEARNABLE_ABILITIES,
} from "../../src/types/flags.js";
import type { Creature, Color, Item } from "../../src/types/types.js";

// =============================================================================
// Helpers
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
    c.currentHP = cat.maxHP;
    c.movementSpeed = cat.movementSpeed;
    c.attackSpeed = cat.attackSpeed;
    return c;
}

const white: Color = { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };

function makeCtx(player: Creature, overrides?: Partial<CombatHelperContext>): CombatHelperContext {
    return {
        player,
        weapon: null,
        armor: null,
        playerStrength: 12,
        canSeeMonster: () => true,
        canDirectlySeeMonster: () => true,
        monsterName: () => "the monster",
        monstersAreTeammates: () => false,
        monsterAvoids: () => false,
        monsterIsInClass: () => false,
        monsterAtLoc: () => null,
        cellHasMonsterOrPlayer: () => false,
        isPosInMap: (loc) => loc.x >= 0 && loc.x < 79 && loc.y >= 0 && loc.y < 29,
        message: vi.fn(),
        combatMessage: vi.fn(),
        cloneMonster: vi.fn(() => null),
        fadeInMonster: vi.fn(),
        refreshSideBar: vi.fn(),
        setCellMonsterFlag: vi.fn(),
        randRange: (lo: number, hi: number) => lo,
        monsterCatalog,
        monsterClassCatalog,
        cautiousMode: false,
        setCautiousMode: vi.fn(),
        updateIdentifiableItems: vi.fn(),
        messageWithColor: vi.fn(),
        itemName: () => "item",
        itemMessageColor: white,
        featRecord: [true, true, true, true],
        FEAT_PALADIN: 0,
        iterateAllies: () => [],
        iterateAllMonsters: () => [],
        depthLevel: 1,
        deepestLevel: 26,
        ...overrides,
    };
}

// =============================================================================
// strLenWithoutEscapes
// =============================================================================

describe("strLenWithoutEscapes", () => {
    it("returns length of plain string", () => {
        expect(strLenWithoutEscapes("hello")).toBe(5);
    });

    it("returns 0 for empty string", () => {
        expect(strLenWithoutEscapes("")).toBe(0);
    });

    it("skips color escape sequences", () => {
        // Escape char + 3 bytes = 4 chars skipped
        const str = "\x1bRGBhello";
        expect(strLenWithoutEscapes(str)).toBe(5);
    });

    it("handles multiple escapes", () => {
        const str = "\x1bRGBhi\x1bRGBworld";
        expect(strLenWithoutEscapes(str)).toBe(7); // "hi" + "world"
    });

    it("handles string that is all escapes", () => {
        const str = "\x1bRGB\x1bXYZ";
        expect(strLenWithoutEscapes(str)).toBe(0);
    });
});

// =============================================================================
// CombatMessageBuffer
// =============================================================================

describe("CombatMessageBuffer", () => {
    it("starts with no messages", () => {
        const buf = new CombatMessageBuffer();
        expect(buf.hasMessages()).toBe(false);
    });

    it("buffers messages", () => {
        const buf = new CombatMessageBuffer();
        buf.addMessage("hello", null);
        expect(buf.hasMessages()).toBe(true);
    });

    it("flushes messages in order", () => {
        const buf = new CombatMessageBuffer();
        buf.addMessage("first", null);
        buf.addMessage("second", null);
        const messageFn = vi.fn();
        buf.flush(messageFn, false);
        expect(messageFn).toHaveBeenCalledTimes(2);
        expect(messageFn.mock.calls[0][0]).toBe("first");
        expect(messageFn.mock.calls[1][0]).toBe("second");
    });

    it("clears buffer after flush", () => {
        const buf = new CombatMessageBuffer();
        buf.addMessage("test", null);
        buf.flush(vi.fn(), false);
        expect(buf.hasMessages()).toBe(false);
    });

    it("does nothing when flushing empty buffer", () => {
        const buf = new CombatMessageBuffer();
        const messageFn = vi.fn();
        buf.flush(messageFn, false);
        expect(messageFn).not.toHaveBeenCalled();
    });

    it("passes FOLDABLE flag", () => {
        const buf = new CombatMessageBuffer();
        buf.addMessage("test", null);
        const messageFn = vi.fn();
        buf.flush(messageFn, false);
        // FOLDABLE = 1
        expect(messageFn.mock.calls[0][1]).toBe(1);
    });

    it("passes REQUIRE_ACKNOWLEDGMENT flag in cautious mode", () => {
        const buf = new CombatMessageBuffer();
        buf.addMessage("test", null);
        const messageFn = vi.fn();
        buf.flush(messageFn, true);
        // FOLDABLE | REQUIRE_ACKNOWLEDGMENT = 1 | 2 = 3
        expect(messageFn.mock.calls[0][1]).toBe(3);
    });

    it("clear() removes messages without flushing", () => {
        const buf = new CombatMessageBuffer();
        buf.addMessage("test", null);
        buf.clear();
        expect(buf.hasMessages()).toBe(false);
    });
});

// =============================================================================
// handlePaladinFeat
// =============================================================================

describe("handlePaladinFeat", () => {
    let player: Creature;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
    });

    it("disables paladin feat when attacking non-tracking creature", () => {
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.creatureState = CreatureState.Wandering;
        const ctx = makeCtx(player, { featRecord: [true] });
        handlePaladinFeat(defender, ctx);
        expect(ctx.featRecord[0]).toBe(false);
    });

    it("does not disable feat when attacking tracking creature", () => {
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.creatureState = CreatureState.TrackingScent;
        const ctx = makeCtx(player, { featRecord: [true] });
        handlePaladinFeat(defender, ctx);
        expect(ctx.featRecord[0]).toBe(true);
    });

    it("does not disable feat when already false", () => {
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.creatureState = CreatureState.Wandering;
        const ctx = makeCtx(player, { featRecord: [false] });
        handlePaladinFeat(defender, ctx);
        expect(ctx.featRecord[0]).toBe(false);
    });

    it("does not disable feat if defender is inanimate", () => {
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.creatureState = CreatureState.Wandering;
        defender.info.flags |= MonsterBehaviorFlag.MONST_INANIMATE;
        const ctx = makeCtx(player, { featRecord: [true] });
        handlePaladinFeat(defender, ctx);
        expect(ctx.featRecord[0]).toBe(true);
    });

    it("does not disable feat if player is seized", () => {
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.creatureState = CreatureState.Wandering;
        player.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SEIZED;
        const ctx = makeCtx(player, { featRecord: [true] });
        handlePaladinFeat(defender, ctx);
        expect(ctx.featRecord[0]).toBe(true);
    });
});

// =============================================================================
// playerImmuneToMonster
// =============================================================================

describe("playerImmuneToMonster", () => {
    let player: Creature;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
    });

    it("returns false with no armor", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeCtx(player, { armor: null });
        expect(playerImmuneToMonster(monst, ctx)).toBe(false);
    });

    it("returns false if armor has no runic", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const armor = { flags: 0, enchant2: ArmorEnchant.Immunity, vorpalEnemy: 0 } as any;
        const ctx = makeCtx(player, { armor });
        expect(playerImmuneToMonster(monst, ctx)).toBe(false);
    });

    it("returns false if armor runic is not immunity", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const armor = { flags: ItemFlag.ITEM_RUNIC, enchant2: ArmorEnchant.Absorption, vorpalEnemy: 0 } as any;
        const ctx = makeCtx(player, { armor });
        expect(playerImmuneToMonster(monst, ctx)).toBe(false);
    });

    it("returns true if monster is in the immunity class", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const armor = { flags: ItemFlag.ITEM_RUNIC, enchant2: ArmorEnchant.Immunity, vorpalEnemy: 0 } as any;
        const ctx = makeCtx(player, { armor, monsterIsInClass: () => true });
        expect(playerImmuneToMonster(monst, ctx)).toBe(true);
    });

    it("returns false if monster is not in the immunity class", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const armor = { flags: ItemFlag.ITEM_RUNIC, enchant2: ArmorEnchant.Immunity, vorpalEnemy: 0 } as any;
        const ctx = makeCtx(player, { armor, monsterIsInClass: () => false });
        expect(playerImmuneToMonster(monst, ctx)).toBe(false);
    });

    it("returns false if checked against the player", () => {
        const armor = { flags: ItemFlag.ITEM_RUNIC, enchant2: ArmorEnchant.Immunity, vorpalEnemy: 0 } as any;
        const ctx = makeCtx(player, { armor, monsterIsInClass: () => true });
        expect(playerImmuneToMonster(player, ctx)).toBe(false);
    });
});

// =============================================================================
// decrementWeaponAutoIDTimer
// =============================================================================

describe("decrementWeaponAutoIDTimer", () => {
    let player: Creature;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
    });

    it("does nothing with no weapon", () => {
        const ctx = makeCtx(player, { weapon: null });
        decrementWeaponAutoIDTimer(ctx);
        expect(ctx.updateIdentifiableItems).not.toHaveBeenCalled();
    });

    it("does nothing if weapon is already identified", () => {
        const weapon = { flags: ItemFlag.ITEM_IDENTIFIED, charges: 5, quantity: 1 } as any;
        const ctx = makeCtx(player, { weapon });
        decrementWeaponAutoIDTimer(ctx);
        expect(ctx.updateIdentifiableItems).not.toHaveBeenCalled();
    });

    it("decrements charges without identifying when charges > 1", () => {
        const weapon = { flags: 0, charges: 5, quantity: 1 } as any;
        const ctx = makeCtx(player, { weapon });
        decrementWeaponAutoIDTimer(ctx);
        expect(weapon.charges).toBe(4);
        expect(ctx.updateIdentifiableItems).not.toHaveBeenCalled();
    });

    it("identifies weapon when charges reaches 0", () => {
        const weapon = { flags: 0, charges: 1, quantity: 1 } as any;
        const ctx = makeCtx(player, { weapon });
        decrementWeaponAutoIDTimer(ctx);
        expect(weapon.flags & ItemFlag.ITEM_IDENTIFIED).toBeTruthy();
        expect(ctx.updateIdentifiableItems).toHaveBeenCalled();
        expect(ctx.messageWithColor).toHaveBeenCalledTimes(2);
    });
});

// =============================================================================
// splitMonster
// =============================================================================

describe("splitMonster", () => {
    let player: Creature;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
    });

    it("does nothing if monster lacks MA_CLONE_SELF_ON_DEFEND", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.abilityFlags = 0;
        monst.loc = { x: 6, y: 5 };
        const ctx = makeCtx(player);
        splitMonster(monst, player, ctx);
        expect(ctx.cloneMonster).not.toHaveBeenCalled();
    });

    it("does nothing if monster is dying", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.abilityFlags |= MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND;
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        monst.loc = { x: 6, y: 5 };
        const ctx = makeCtx(player);
        splitMonster(monst, player, ctx);
        expect(ctx.cloneMonster).not.toHaveBeenCalled();
    });

    it("does nothing if too many clones", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.abilityFlags |= MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND;
        monst.loc = { x: 6, y: 5 };
        monst.currentHP = 10;
        // Create 100+ allied clones
        const allies = Array.from({ length: 101 }, () => {
            const a = makeCreature(MonsterType.MK_GOBLIN);
            return a;
        });
        const ctx = makeCtx(player, {
            iterateAllMonsters: () => allies,
            monstersAreTeammates: () => true,
        });
        splitMonster(monst, player, ctx);
        expect(ctx.cloneMonster).not.toHaveBeenCalled();
    });

    it("splits monster when conditions are met", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.abilityFlags |= MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND;
        monst.loc = { x: 6, y: 5 };
        monst.currentHP = 10;
        const clone = makeCreature(MonsterType.MK_GOBLIN);
        clone.ticksUntilTurn = 50;
        const ctx = makeCtx(player, {
            cloneMonster: vi.fn(() => clone),
            cellHasMonsterOrPlayer: () => false,
            monsterAvoids: () => false,
        });
        splitMonster(monst, player, ctx);
        expect(ctx.cloneMonster).toHaveBeenCalled();
        expect(monst.currentHP).toBe(5); // Halved (10+1)/2 = 5
        expect(clone.ticksUntilTurn).toBe(101); // Minimum 101
    });

    it("does not split if all adjacent cells are blocked", () => {
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.abilityFlags |= MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND;
        monst.loc = { x: 6, y: 5 };
        monst.currentHP = 10;
        const ctx = makeCtx(player, {
            cellHasMonsterOrPlayer: () => true, // All blocked
        });
        splitMonster(monst, player, ctx);
        expect(ctx.cloneMonster).not.toHaveBeenCalled();
    });
});

// =============================================================================
// anyoneWantABite
// =============================================================================

describe("anyoneWantABite", () => {
    let player: Creature;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
    });

    it("returns false if decedent has nothing learnable", () => {
        const decedent = makeCreature(MonsterType.MK_GOBLIN);
        decedent.info.abilityFlags = 0;
        decedent.info.flags = 0;
        decedent.info.bolts = [0];
        const ctx = makeCtx(player);
        expect(anyoneWantABite(decedent, ctx)).toBe(false);
    });

    it("returns false if decedent is inanimate", () => {
        const decedent = makeCreature(MonsterType.MK_GOBLIN);
        decedent.info.flags = MonsterBehaviorFlag.MONST_INANIMATE;
        decedent.info.abilityFlags = MonsterAbilityFlag.MA_POISONS;
        const ctx = makeCtx(player);
        expect(anyoneWantABite(decedent, ctx)).toBe(false);
    });

    it("returns false if no allies exist", () => {
        const decedent = makeCreature(MonsterType.MK_GOBLIN);
        decedent.info.abilityFlags = MonsterAbilityFlag.MA_POISONS;
        const ctx = makeCtx(player, { iterateAllies: () => [] });
        expect(anyoneWantABite(decedent, ctx)).toBe(false);
    });

    it("returns true when a suitable ally exists", () => {
        const decedent = makeCreature(MonsterType.MK_GOBLIN);
        decedent.info.abilityFlags = MonsterAbilityFlag.MA_TRANSFERENCE; // Learnable ability
        decedent.info.flags = 0;
        decedent.loc = { x: 10, y: 10 };

        const ally = makeCreature(MonsterType.MK_GOBLIN);
        ally.creatureState = CreatureState.Ally;
        ally.newPowerCount = 1;
        ally.targetCorpseLoc = { x: -1, y: -1 }; // Invalid pos
        ally.info.abilityFlags = 0; // Doesn't have the ability yet
        ally.info.flags = 0;
        ally.loc = { x: 11, y: 10 };

        const ctx = makeCtx(player, {
            iterateAllies: () => [ally],
            isPosInMap: (loc) => loc.x >= 0 && loc.x < 79 && loc.y >= 0 && loc.y < 29,
            monsterAvoids: () => false,
        });
        const result = anyoneWantABite(decedent, ctx);
        expect(result).toBe(true);
        expect(ally.targetCorpseLoc).toEqual({ x: 10, y: 10 });
        expect(ally.corpseAbsorptionCounter).toBe(20);
    });
});
