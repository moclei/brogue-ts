/*
 *  spell-effects.test.ts — Unit tests for slow() and weaken()
 *  brogue-ts
 *
 *  Covers Items.c:3905 (slow) and Items.c:3827 (weaken).
 */

import { describe, it, expect, vi } from "vitest";
import { slow, weaken } from "../../src/items/item-effects.js";
import type { SlowContext, WeakenContext } from "../../src/items/item-effects.js";
import type { Creature } from "../../src/types/types.js";
import { StatusEffect } from "../../src/types/enums.js";
import { MonsterBehaviorFlag } from "../../src/types/flags.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 1, y: 1 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 0,
            monsterName: "test",
            displayChar: 64,
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 10,
            turnsBetweenRegen: 30,
            movementSpeed: 100,
            attackSpeed: 100,
            damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            accuracy: 100,
            defense: 0,
            DFChance: 0,
            DFType: 0,
            bloodType: 0,
            lightType: 0,
            intrinsicLightType: 0,
            flags: 0,
            abilityFlags: 0,
            bolts: [],
            isLarge: false,
        },
        currentHP: 10,
        turnsSpentStationary: 0,
        creatureState: 0 as never,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        movementSpeed: 100,
        attackSpeed: 100,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        mutationIndex: -1,
        wasNegated: false,
        weaknessAmount: 0,
        ...overrides,
    } as Creature;
}

function makeSlowCtx(player: Creature, overrides: Partial<SlowContext> = {}): SlowContext {
    return {
        player,
        updateEncumbrance: vi.fn(),
        message: vi.fn(),
        ...overrides,
    };
}

function makeWeakenCtx(player: Creature, overrides: Partial<WeakenContext> = {}): WeakenContext {
    return {
        player,
        rogue: { weapon: null, armor: null },
        messageWithColor: vi.fn(),
        badMessageColor: { red: 100, green: 50, blue: 60, rand: 0, colorDances: false },
        strengthCheck: vi.fn(),
        ...overrides,
    };
}

// =============================================================================
// slow — Items.c:3905
// =============================================================================

describe("slow > non-player monster", () => {
    it("sets STATUS_SLOWED and maxStatus to the given turns", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ movementSpeed: 100, attackSpeed: 100 });
        const ctx = makeSlowCtx(player);

        slow(monst, 30, ctx);

        expect(monst.status[StatusEffect.Slowed]).toBe(30);
        expect(monst.maxStatus[StatusEffect.Slowed]).toBe(30);
    });

    it("clears STATUS_HASTED", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        monst.status[StatusEffect.Hasted] = 10;
        const ctx = makeSlowCtx(player);

        slow(monst, 30, ctx);

        expect(monst.status[StatusEffect.Hasted]).toBe(0);
    });

    it("doubles movementSpeed and attackSpeed for non-player creature", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ movementSpeed: 100, attackSpeed: 100 });
        (monst.info as { movementSpeed: number }).movementSpeed = 100;
        (monst.info as { attackSpeed: number }).attackSpeed = 100;
        const ctx = makeSlowCtx(player);

        slow(monst, 30, ctx);

        expect(monst.movementSpeed).toBe(200);
        expect(monst.attackSpeed).toBe(200);
    });

    it("does not call updateEncumbrance or message for non-player", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        const ctx = makeSlowCtx(player);

        slow(monst, 30, ctx);

        expect(ctx.updateEncumbrance).not.toHaveBeenCalled();
        expect(ctx.message).not.toHaveBeenCalled();
    });
});

describe("slow > player", () => {
    it("sets STATUS_SLOWED on the player", () => {
        const player = makeCreature();
        const ctx = makeSlowCtx(player);

        slow(player, 20, ctx);

        expect(player.status[StatusEffect.Slowed]).toBe(20);
        expect(player.maxStatus[StatusEffect.Slowed]).toBe(20);
    });

    it("calls updateEncumbrance and message for player", () => {
        const player = makeCreature();
        const ctx = makeSlowCtx(player);

        slow(player, 20, ctx);

        expect(ctx.updateEncumbrance).toHaveBeenCalledOnce();
        expect(ctx.message).toHaveBeenCalledWith("you feel yourself slow down.", 0);
    });

    it("does not double player movementSpeed (updateEncumbrance handles it)", () => {
        const player = makeCreature({ movementSpeed: 100 });
        const ctx = makeSlowCtx(player);

        slow(player, 20, ctx);

        // movementSpeed unchanged — updateEncumbrance (stubbed) is responsible
        expect(player.movementSpeed).toBe(100);
    });
});

describe("slow > inanimate / invulnerable guard", () => {
    it("does nothing for inanimate monsters", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        monst.info.flags |= MonsterBehaviorFlag.MONST_INANIMATE;
        const ctx = makeSlowCtx(player);

        slow(monst, 30, ctx);

        expect(monst.status[StatusEffect.Slowed]).toBe(0);
        expect(monst.movementSpeed).toBe(100);
    });

    it("does nothing for invulnerable monsters", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        monst.info.flags |= MonsterBehaviorFlag.MONST_INVULNERABLE;
        const ctx = makeSlowCtx(player);

        slow(monst, 30, ctx);

        expect(monst.status[StatusEffect.Slowed]).toBe(0);
    });
});

// =============================================================================
// weaken — Items.c:3827
// =============================================================================

describe("weaken > non-player monster", () => {
    it("increments weaknessAmount", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ weaknessAmount: 0 });
        const ctx = makeWeakenCtx(player);

        weaken(monst, 50, ctx);

        expect(monst.weaknessAmount).toBe(1);
    });

    it("caps weaknessAmount at 10", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ weaknessAmount: 10 });
        const ctx = makeWeakenCtx(player);

        weaken(monst, 50, ctx);

        expect(monst.weaknessAmount).toBe(10);
    });

    it("sets status and maxStatus to maxDuration when current is lower", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        const ctx = makeWeakenCtx(player);

        weaken(monst, 50, ctx);

        expect(monst.status[StatusEffect.Weakened]).toBe(50);
        expect(monst.maxStatus[StatusEffect.Weakened]).toBe(50);
    });

    it("keeps current status when already higher than maxDuration", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        monst.status[StatusEffect.Weakened] = 80;
        monst.maxStatus[StatusEffect.Weakened] = 80;
        const ctx = makeWeakenCtx(player);

        weaken(monst, 50, ctx);

        expect(monst.status[StatusEffect.Weakened]).toBe(80);
        expect(monst.maxStatus[StatusEffect.Weakened]).toBe(80);
    });

    it("does not call messageWithColor or strengthCheck for non-player", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature();
        const ctx = makeWeakenCtx(player);

        weaken(monst, 50, ctx);

        expect(ctx.messageWithColor).not.toHaveBeenCalled();
        expect(ctx.strengthCheck).not.toHaveBeenCalled();
    });
});

describe("weaken > player", () => {
    it("increments player weaknessAmount", () => {
        const player = makeCreature({ weaknessAmount: 3 });
        const ctx = makeWeakenCtx(player);

        weaken(player, 50, ctx);

        expect(player.weaknessAmount).toBe(4);
    });

    it("sets player STATUS_WEAKENED duration", () => {
        const player = makeCreature();
        const ctx = makeWeakenCtx(player);

        weaken(player, 50, ctx);

        expect(player.status[StatusEffect.Weakened]).toBe(50);
        expect(player.maxStatus[StatusEffect.Weakened]).toBe(50);
    });

    it("shows the weakness message to the player", () => {
        const player = makeCreature();
        const ctx = makeWeakenCtx(player);

        weaken(player, 50, ctx);

        expect(ctx.messageWithColor).toHaveBeenCalledWith(
            "your muscles weaken as an enervating toxin fills your veins.",
            ctx.badMessageColor,
            0,
        );
    });

    it("calls strengthCheck for weapon and armor", () => {
        const player = makeCreature();
        const weapon = {} as never;
        const armor = {} as never;
        const ctx = makeWeakenCtx(player, { rogue: { weapon, armor } });

        weaken(player, 50, ctx);

        expect(ctx.strengthCheck).toHaveBeenCalledWith(weapon, true);
        expect(ctx.strengthCheck).toHaveBeenCalledWith(armor, true);
        expect(ctx.strengthCheck).toHaveBeenCalledTimes(2);
    });

    it("calls strengthCheck with null weapon/armor when slots are empty", () => {
        const player = makeCreature();
        const ctx = makeWeakenCtx(player);

        weaken(player, 50, ctx);

        expect(ctx.strengthCheck).toHaveBeenCalledWith(null, true);
        expect(ctx.strengthCheck).toHaveBeenCalledTimes(2);
    });
});
