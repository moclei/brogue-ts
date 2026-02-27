/*
 *  combat-damage.test.ts — Tests for damage/status helper functions
 *  brogue-ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    flashMonster,
    inflictDamage,
    inflictLethalDamage,
    addPoison,
    killCreature,
    heal,
} from "../../src/combat/combat-damage.js";
import type { CombatDamageContext } from "../../src/combat/combat-damage.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, CreatureState } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
} from "../../src/types/flags.js";
import type { Creature, Color } from "../../src/types/types.js";

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
    c.loc = { x: 5, y: 5 };
    c.movementSpeed = cat.movementSpeed;
    c.attackSpeed = cat.attackSpeed;
    return c;
}

const white: Color = { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };
const red: Color = { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };
const poisonGreen: Color = { red: 0, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };

function makeDamageCtx(player: Creature, overrides?: Partial<CombatDamageContext>): CombatDamageContext {
    return {
        player,
        easyMode: false,
        transference: 0,
        playerTransferenceRatio: 100,
        canSeeMonster: () => true,
        canDirectlySeeMonster: () => true,
        wakeUp: vi.fn(),
        spawnDungeonFeature: vi.fn(),
        refreshSideBar: vi.fn(),
        combatMessage: vi.fn(),
        messageWithColor: vi.fn(),
        monsterName: (monst: Creature) => "the monster",
        gameOver: vi.fn(),
        setCreaturesWillFlash: vi.fn(),
        deleteItem: vi.fn(),
        makeMonsterDropItem: vi.fn(),
        clearLastTarget: vi.fn(),
        clearYendorWarden: vi.fn(),
        clearCellMonsterFlag: vi.fn(),
        prependCreature: vi.fn(),
        applyInstantTileEffectsToCreature: vi.fn(),
        fadeInMonster: vi.fn(),
        refreshDungeonCell: vi.fn(),
        anyoneWantABite: vi.fn(() => false),
        demoteMonsterFromLeadership: vi.fn(),
        checkForContinuedLeadership: vi.fn(),
        getMonsterDFMessage: () => "",
        resolvePronounEscapes: (text: string) => text,
        message: vi.fn(),
        monsterCatalog,
        updateEncumbrance: vi.fn(),
        updateMinersLightRadius: vi.fn(),
        updateVision: vi.fn(),
        badMessageColor: red,
        poisonColor: poisonGreen,
        ...overrides,
    };
}

// =============================================================================
// flashMonster
// =============================================================================

describe("flashMonster", () => {
    it("does nothing if color is null", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeDamageCtx(player);
        flashMonster(goblin, null, 100, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeFalsy();
    });

    it("sets flash state on the creature", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeDamageCtx(player);
        flashMonster(goblin, white, 75, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeTruthy();
        expect(goblin.flashStrength).toBe(75);
        expect(goblin.flashColor.red).toBe(100);
        expect(ctx.setCreaturesWillFlash).toHaveBeenCalled();
    });

    it("upgrades flash if new one is stronger", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeDamageCtx(player);
        flashMonster(goblin, white, 50, ctx);
        flashMonster(goblin, red, 80, ctx);
        expect(goblin.flashStrength).toBe(80);
        expect(goblin.flashColor.red).toBe(100);
        expect(goblin.flashColor.green).toBe(0);
    });

    it("does not downgrade flash if new one is weaker", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeDamageCtx(player);
        flashMonster(goblin, white, 80, ctx);
        flashMonster(goblin, red, 50, ctx);
        expect(goblin.flashStrength).toBe(80);
        expect(goblin.flashColor.red).toBe(100);
        expect(goblin.flashColor.green).toBe(100);
    });
});

// =============================================================================
// inflictDamage
// =============================================================================

describe("inflictDamage", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: CombatDamageContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        goblin = makeCreature(MonsterType.MK_GOBLIN);
        ctx = makeDamageCtx(player);
    });

    it("returns false for 0 damage", () => {
        expect(inflictDamage(player, goblin, 0, null, false, ctx)).toBe(false);
        expect(goblin.currentHP).toBe(goblin.info.maxHP);
    });

    it("returns false for invulnerable defenders", () => {
        goblin.info.flags |= MonsterBehaviorFlag.MONST_INVULNERABLE;
        expect(inflictDamage(player, goblin, 100, null, false, ctx)).toBe(false);
        expect(goblin.currentHP).toBe(goblin.info.maxHP);
    });

    it("reduces HP and returns false if creature survives", () => {
        const startHP = goblin.currentHP;
        const damage = 3;
        expect(inflictDamage(player, goblin, damage, null, false, ctx)).toBe(false);
        expect(goblin.currentHP).toBe(startHP - damage);
    });

    it("returns true and sets HP to 0 if creature dies", () => {
        expect(inflictDamage(player, goblin, goblin.currentHP + 10, null, false, ctx)).toBe(true);
        expect(goblin.currentHP).toBe(0);
    });

    it("returns true for exactly lethal damage", () => {
        expect(inflictDamage(player, goblin, goblin.currentHP, null, false, ctx)).toBe(true);
        expect(goblin.currentHP).toBe(0);
    });

    it("absorbs damage through protection shield", () => {
        const startHP = goblin.currentHP;
        goblin.status[StatusEffect.Shielded] = 50; // 50/10 = 5 HP of shield
        goblin.maxStatus[StatusEffect.Shielded] = 50;
        expect(inflictDamage(player, goblin, 3, null, false, ctx)).toBe(false);
        // Shield absorbs 3 damage (30 shield points), leaving 20 shield
        expect(goblin.status[StatusEffect.Shielded]).toBe(20);
        expect(goblin.currentHP).toBe(startHP);
    });

    it("shield fully consumed by large damage", () => {
        const startHP = goblin.currentHP;
        goblin.status[StatusEffect.Shielded] = 30; // 3 HP of shield
        goblin.maxStatus[StatusEffect.Shielded] = 30;
        expect(inflictDamage(player, goblin, 10, null, false, ctx)).toBe(false);
        // Shield absorbs ceil(30/10)=3 HP, leaving 7 damage to HP
        expect(goblin.status[StatusEffect.Shielded]).toBe(0);
        expect(goblin.maxStatus[StatusEffect.Shielded]).toBe(0);
        expect(goblin.currentHP).toBe(startHP - 7);
    });

    it("ignores shield when ignoresProtectionShield is true", () => {
        const startHP = goblin.currentHP;
        goblin.status[StatusEffect.Shielded] = 100;
        expect(inflictDamage(player, goblin, 5, null, true, ctx)).toBe(false);
        expect(goblin.currentHP).toBe(startHP - 5);
        expect(goblin.status[StatusEffect.Shielded]).toBe(100);
    });

    it("clears MB_ABSORBING flag on damage", () => {
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_ABSORBING;
        inflictDamage(player, goblin, 1, null, false, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_ABSORBING).toBeFalsy();
    });

    it("wakes sleeping monsters", () => {
        goblin.creatureState = CreatureState.Sleeping;
        inflictDamage(player, goblin, 1, null, false, ctx);
        expect(ctx.wakeUp).toHaveBeenCalledWith(goblin);
    });

    it("does not wake the player", () => {
        player.creatureState = CreatureState.Sleeping;
        inflictDamage(goblin, player, 1, null, false, ctx);
        expect(ctx.wakeUp).not.toHaveBeenCalled();
    });

    it("reduces damage in easy mode for the player", () => {
        ctx = makeDamageCtx(player, { easyMode: true });
        player.currentHP = 100;
        player.info.maxHP = 100;
        inflictDamage(goblin, player, 25, null, false, ctx);
        // 25 / 5 = 5 damage
        expect(player.currentHP).toBe(95);
    });

    it("easy mode minimum damage is 1", () => {
        ctx = makeDamageCtx(player, { easyMode: true });
        player.currentHP = 100;
        player.info.maxHP = 100;
        inflictDamage(goblin, player, 3, null, false, ctx);
        // 3 / 5 = 0.6, floor = 0, max(1, 0) = 1
        expect(player.currentHP).toBe(99);
    });

    it("handles negative damage (healing) without exceeding maxHP", () => {
        goblin.currentHP = 5;
        goblin.info.maxHP = 10;
        inflictDamage(null, goblin, -20, null, false, ctx);
        expect(goblin.currentHP).toBe(10); // capped at maxHP
    });

    it("triggers fleeing near death for appropriate monsters", () => {
        goblin.info.flags |= MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH;
        goblin.currentHP = 10;
        goblin.info.maxHP = 40;
        goblin.creatureState = CreatureState.TrackingScent;
        // Damage enough to put below 25% HP (10 HP): need to go to <= 10
        inflictDamage(player, goblin, 1, null, false, ctx);
        // Now at 9 HP out of 40 max, 40/4 = 10 >= 9
        expect(goblin.creatureState).toBe(CreatureState.Fleeing);
    });

    it("allies do not flee near death", () => {
        goblin.info.flags |= MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH;
        goblin.currentHP = 10;
        goblin.info.maxHP = 40;
        goblin.creatureState = CreatureState.Ally;
        inflictDamage(player, goblin, 5, null, false, ctx);
        expect(goblin.creatureState).toBe(CreatureState.Ally);
    });

    it("calls refreshSideBar", () => {
        inflictDamage(player, goblin, 1, null, false, ctx);
        expect(ctx.refreshSideBar).toHaveBeenCalled();
    });
});

// =============================================================================
// inflictLethalDamage
// =============================================================================

describe("inflictLethalDamage", () => {
    it("kills the defender", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeDamageCtx(player);
        const result = inflictLethalDamage(player, goblin, ctx);
        expect(result).toBe(true);
        expect(goblin.currentHP).toBe(0);
    });

    it("works with null attacker", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeDamageCtx(player);
        const result = inflictLethalDamage(null, goblin, ctx);
        expect(result).toBe(true);
        expect(goblin.currentHP).toBe(0);
    });
});

// =============================================================================
// addPoison
// =============================================================================

describe("addPoison", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: CombatDamageContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        goblin = makeCreature(MonsterType.MK_GOBLIN);
        ctx = makeDamageCtx(player);
    });

    it("does nothing for non-positive duration", () => {
        addPoison(goblin, 0, 5, ctx);
        expect(goblin.status[StatusEffect.Poisoned]).toBe(0);
        expect(goblin.poisonAmount).toBe(0);
    });

    it("applies poison with duration and concentration", () => {
        addPoison(goblin, 10, 3, ctx);
        expect(goblin.status[StatusEffect.Poisoned]).toBe(10);
        expect(goblin.poisonAmount).toBe(3);
        expect(goblin.maxStatus[StatusEffect.Poisoned]).toBe(
            Math.floor(goblin.info.maxHP / 3)
        );
    });

    it("accumulates poison", () => {
        addPoison(goblin, 10, 3, ctx);
        addPoison(goblin, 5, 2, ctx);
        expect(goblin.status[StatusEffect.Poisoned]).toBe(15);
        expect(goblin.poisonAmount).toBe(5);
    });

    it("shows combat message when player first poisoned", () => {
        addPoison(player, 10, 3, ctx);
        expect(ctx.combatMessage).toHaveBeenCalledWith(
            "scalding poison fills your veins",
            ctx.badMessageColor,
        );
    });

    it("does not show message if player already poisoned", () => {
        player.status[StatusEffect.Poisoned] = 5;
        addPoison(player, 10, 3, ctx);
        expect(ctx.combatMessage).not.toHaveBeenCalled();
    });

    it("sets poisonAmount to 1 if it would be 0", () => {
        goblin.poisonAmount = 0;
        addPoison(goblin, 5, 0, ctx);
        expect(goblin.poisonAmount).toBe(1);
    });

    it("flashes visible monsters with poison color", () => {
        addPoison(goblin, 5, 3, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeTruthy();
        expect(goblin.flashStrength).toBe(100);
    });

    it("does not flash invisible monsters", () => {
        ctx = makeDamageCtx(player, { canSeeMonster: () => false });
        addPoison(goblin, 5, 3, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_WILL_FLASH).toBeFalsy();
    });
});

// =============================================================================
// killCreature
// =============================================================================

describe("killCreature", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: CombatDamageContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        goblin = makeCreature(MonsterType.MK_GOBLIN);
        ctx = makeDamageCtx(player);
    });

    it("marks creature as dying", () => {
        killCreature(goblin, false, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED).toBeTruthy();
        expect(goblin.currentHP).toBe(0);
    });

    it("does nothing for already-dying creatures", () => {
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        killCreature(goblin, false, ctx);
        expect(ctx.clearLastTarget).not.toHaveBeenCalled();
    });

    it("does nothing for already-dead creatures", () => {
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_HAS_DIED;
        killCreature(goblin, false, ctx);
        expect(ctx.clearLastTarget).not.toHaveBeenCalled();
    });

    it("drops item for non-administrative death", () => {
        goblin.carriedItem = { category: 0 } as any; // mock item
        killCreature(goblin, false, ctx);
        expect(ctx.makeMonsterDropItem).toHaveBeenCalledWith(goblin);
    });

    it("deletes item for administrative death", () => {
        const mockItem = { category: 0 } as any;
        goblin.carriedItem = mockItem;
        killCreature(goblin, true, ctx);
        expect(ctx.deleteItem).toHaveBeenCalledWith(mockItem);
        expect(goblin.carriedItem).toBeNull();
    });

    it("sets MB_ADMINISTRATIVE_DEATH for administrative deaths", () => {
        killCreature(goblin, true, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH).toBeTruthy();
    });

    it("does not set MB_ADMINISTRATIVE_DEATH for normal deaths", () => {
        killCreature(goblin, false, ctx);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH).toBeFalsy();
    });

    it("clears global references", () => {
        killCreature(goblin, false, ctx);
        expect(ctx.clearLastTarget).toHaveBeenCalledWith(goblin);
        expect(ctx.clearYendorWarden).toHaveBeenCalledWith(goblin);
    });

    it("clears cell monster flag", () => {
        killCreature(goblin, false, ctx);
        expect(ctx.clearCellMonsterFlag).toHaveBeenCalledWith(goblin.loc, false);
    });

    it("clears cell dormant flag for dormant monsters", () => {
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DORMANT;
        killCreature(goblin, false, ctx);
        expect(ctx.clearCellMonsterFlag).toHaveBeenCalledWith(goblin.loc, true);
    });

    it("demotes leadership", () => {
        killCreature(goblin, false, ctx);
        expect(ctx.demoteMonsterFromLeadership).toHaveBeenCalledWith(goblin);
    });

    it("checks continued leadership for leader", () => {
        const leader = makeCreature(MonsterType.MK_OGRE);
        goblin.leader = leader;
        killCreature(goblin, false, ctx);
        expect(ctx.checkForContinuedLeadership).toHaveBeenCalledWith(leader);
    });

    it("releases carried monster on non-administrative death", () => {
        const carried = makeCreature(MonsterType.MK_RAT);
        goblin.carriedMonster = carried;
        killCreature(goblin, false, ctx);
        expect(ctx.prependCreature).toHaveBeenCalledWith(carried);
        expect(carried.loc.x).toBe(goblin.loc.x);
        expect(carried.loc.y).toBe(goblin.loc.y);
        expect(carried.ticksUntilTurn).toBe(200);
        expect(goblin.carriedMonster).toBeNull();
    });

    it("calls anyoneWantABite for non-administrative death", () => {
        killCreature(goblin, false, ctx);
        expect(ctx.anyoneWantABite).toHaveBeenCalledWith(goblin);
    });

    it("does not call anyoneWantABite for administrative death", () => {
        killCreature(goblin, true, ctx);
        expect(ctx.anyoneWantABite).not.toHaveBeenCalled();
    });

    it("shows sense of loss for unseen dying allies", () => {
        goblin.creatureState = CreatureState.Ally;
        ctx = makeDamageCtx(player, { canSeeMonster: () => false });
        killCreature(goblin, false, ctx);
        expect(ctx.messageWithColor).toHaveBeenCalledWith(
            "you feel a sense of loss.",
            ctx.badMessageColor,
        );
    });

    it("does not show sense of loss for visible allies", () => {
        goblin.creatureState = CreatureState.Ally;
        killCreature(goblin, false, ctx);
        expect(ctx.messageWithColor).not.toHaveBeenCalled();
    });

    it("does not mark player with MB_IS_DYING", () => {
        killCreature(player, false, ctx);
        expect(player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeFalsy();
    });
});

// =============================================================================
// heal
// =============================================================================

describe("heal", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: CombatDamageContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 5;
        goblin.info.maxHP = 20;
        ctx = makeDamageCtx(player);
    });

    it("heals by percentage of max HP", () => {
        heal(goblin, 50, false, ctx);
        // 50% of 20 = 10, start at 5, so 15
        expect(goblin.currentHP).toBe(15);
    });

    it("does not exceed max HP", () => {
        heal(goblin, 100, false, ctx);
        expect(goblin.currentHP).toBe(20);
    });

    it("shows combat message for visible non-player monsters", () => {
        heal(goblin, 50, false, ctx);
        expect(ctx.combatMessage).toHaveBeenCalled();
    });

    it("does not show message for the player", () => {
        player.currentHP = 10;
        player.info.maxHP = 100;
        heal(player, 50, false, ctx);
        expect(ctx.combatMessage).not.toHaveBeenCalled();
    });

    it("does not show message for panacea", () => {
        heal(goblin, 50, true, ctx);
        expect(ctx.combatMessage).not.toHaveBeenCalled();
    });

    describe("panacea clears negative effects", () => {
        it("clears hallucination", () => {
            goblin.status[StatusEffect.Hallucinating] = 10;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Hallucinating]).toBe(1);
        });

        it("clears confusion", () => {
            goblin.status[StatusEffect.Confused] = 10;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Confused]).toBe(1);
        });

        it("clears nausea", () => {
            goblin.status[StatusEffect.Nauseous] = 10;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Nauseous]).toBe(1);
        });

        it("clears slowing", () => {
            goblin.status[StatusEffect.Slowed] = 10;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Slowed]).toBe(1);
        });

        it("clears weakness and updates encumbrance", () => {
            goblin.status[StatusEffect.Weakened] = 10;
            goblin.weaknessAmount = 3;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Weakened]).toBe(0);
            expect(goblin.weaknessAmount).toBe(0);
            expect(ctx.updateEncumbrance).toHaveBeenCalled();
        });

        it("clears poison", () => {
            goblin.status[StatusEffect.Poisoned] = 10;
            goblin.poisonAmount = 5;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Poisoned]).toBe(0);
            expect(goblin.poisonAmount).toBe(0);
        });

        it("clears darkness for player and updates vision", () => {
            player.currentHP = 10;
            player.info.maxHP = 100;
            player.status[StatusEffect.Darkness] = 5;
            heal(player, 50, true, ctx);
            expect(player.status[StatusEffect.Darkness]).toBe(0);
            expect(ctx.updateMinersLightRadius).toHaveBeenCalled();
            expect(ctx.updateVision).toHaveBeenCalled();
        });

        it("clears darkness for non-player without updating vision", () => {
            goblin.status[StatusEffect.Darkness] = 5;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Darkness]).toBe(0);
            expect(ctx.updateMinersLightRadius).not.toHaveBeenCalled();
        });

        it("does not clear effects already at 1", () => {
            goblin.status[StatusEffect.Hallucinating] = 1;
            heal(goblin, 50, true, ctx);
            expect(goblin.status[StatusEffect.Hallucinating]).toBe(1);
        });

        it("does not clear effects at 0", () => {
            goblin.status[StatusEffect.Poisoned] = 0;
            goblin.poisonAmount = 0;
            heal(goblin, 50, true, ctx);
            expect(goblin.poisonAmount).toBe(0);
        });
    });
});
