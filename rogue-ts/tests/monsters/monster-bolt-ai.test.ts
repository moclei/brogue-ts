/*
 *  monster-bolt-ai.test.ts — Tests for monsterHasBoltEffect and monsterCanShootWebs
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    monsterHasBoltEffect,
    monsterCanShootWebs,
    monsterCastSpell,
    monstUseBolt,
    monstUseMagic,
} from "../../src/monsters/monster-bolt-ai.js";
import type { BoltAIContext } from "../../src/monsters/monster-bolt-ai.js";
import type { Creature, Bolt, FloorTileType, DungeonFeature } from "../../src/types/types.js";
import { BoltEffect, CreatureState } from "../../src/types/enums.js";
import { BoltFlag, MonsterBehaviorFlag, TerrainFlag } from "../../src/types/flags.js";
import { white } from "../../src/globals/colors.js";

// =============================================================================
// Minimal test helpers
// =============================================================================

function makeMonster(bolts: number[]): Creature {
    const boltArray = new Array(20).fill(0);
    bolts.forEach((b, i) => { boltArray[i] = b; });
    return {
        info: {
            monsterID: 1,
            flags: 0,
            abilityFlags: 0,
            movementSpeed: 100,
            attackSpeed: 100,
            maxHP: 10,
            damage: { lowerBound: 1, upperBound: 2, clumpFactor: 1 },
            defense: 10,
            accuracy: 80,
            turnsBetweenRegen: 5000,
            bolts: boltArray,
            displayChar: "r",
            foreColor: white,
        },
        currentHP: 10,
        movementSpeed: 100,
        attackSpeed: 100,
        mutationIndex: -1,
        status: new Array(50).fill(0),
        bookkeepingFlags: 0,
        creatureState: 0,
        loc: { x: 5, y: 5 },
    } as unknown as Creature;
}

function makeBolt(boltEffect: BoltEffect, pathDF = 0): Bolt {
    return {
        boltEffect,
        pathDF,
        flags: 0,
        forbiddenMonsterFlags: 0,
        targetDF: 0,
        description: "fires",
    } as unknown as Bolt;
}

function makeTileCatalog(entangles: boolean): FloorTileType[] {
    const catalog = new Array(10).fill(null).map(() => ({ flags: 0 })) as FloorTileType[];
    if (entangles) {
        catalog[3] = { flags: TerrainFlag.T_ENTANGLES } as unknown as FloorTileType;
    }
    return catalog;
}

function makeDungeonFeatureCatalog(tileIndex: number): DungeonFeature[] {
    const catalog = new Array(10).fill(null).map(() => ({ tile: 0 })) as DungeonFeature[];
    catalog[5] = { tile: tileIndex } as unknown as DungeonFeature;
    return catalog;
}

// =============================================================================
// monsterHasBoltEffect
// =============================================================================

describe("monsterHasBoltEffect", () => {
    it("returns 0 when monster has no bolts", () => {
        const monst = makeMonster([]);
        const boltCatalog: Bolt[] = [];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(0);
    });

    it("returns bolt type when monster has matching bolt effect", () => {
        const monst = makeMonster([2]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),   // index 0
            makeBolt(BoltEffect.Attack), // index 1
            makeBolt(BoltEffect.Blinking), // index 2 — match
        ];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(2);
    });

    it("returns 0 when bolt effect does not match", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),    // index 0
            makeBolt(BoltEffect.Attack),  // index 1
        ];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(0);
    });

    it("returns first matching bolt type when multiple bolts present", () => {
        const monst = makeMonster([1, 2, 3]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Haste),    // index 1
            makeBolt(BoltEffect.Blinking), // index 2 — first match
            makeBolt(BoltEffect.Blinking), // index 3 — second match (not returned)
        ];
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(2);
    });

    it("stops scanning at first zero bolt entry", () => {
        // bolts array is [2, 0, 1] — scan stops at index 1
        const monst = makeMonster([2, 0, 1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Attack),   // index 1 — never reached
            makeBolt(BoltEffect.Blinking), // index 2
        ];
        // Should find bolt 2 (Blinking) at position 0 of the bolts array
        expect(monsterHasBoltEffect(monst, BoltEffect.Blinking, boltCatalog)).toBe(2);
        // But if we search for Attack (index 1), scan stops at zero before reaching it
        expect(monsterHasBoltEffect(monst, BoltEffect.Attack, boltCatalog)).toBe(0);
    });
});

// =============================================================================
// monsterCanShootWebs
// =============================================================================

describe("monsterCanShootWebs", () => {
    it("returns false when monster has no bolts", () => {
        const monst = makeMonster([]);
        expect(monsterCanShootWebs(monst, [], [], [])).toBe(false);
    });

    it("returns false when bolt has no pathDF", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Attack, 0), // pathDF = 0 → no terrain feature
        ];
        expect(monsterCanShootWebs(monst, boltCatalog, [], [])).toBe(false);
    });

    it("returns true when bolt pathDF tile has T_ENTANGLES", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.None, 5), // pathDF = 5
        ];
        const tileCatalog = makeTileCatalog(true);  // tile 3 has T_ENTANGLES
        const dfCatalog = makeDungeonFeatureCatalog(3); // df[5].tile = 3
        expect(monsterCanShootWebs(monst, boltCatalog, tileCatalog, dfCatalog)).toBe(true);
    });

    it("returns false when bolt pathDF tile does not entangle", () => {
        const monst = makeMonster([1]);
        const boltCatalog = [
            makeBolt(BoltEffect.None),
            makeBolt(BoltEffect.Damage, 5), // pathDF = 5
        ];
        const tileCatalog = makeTileCatalog(false); // no T_ENTANGLES
        const dfCatalog = makeDungeonFeatureCatalog(3);
        expect(monsterCanShootWebs(monst, boltCatalog, tileCatalog, dfCatalog)).toBe(false);
    });
});

// =============================================================================
// BoltAIContext helpers for monsterCastSpell / monstUseBolt / monstUseMagic
// =============================================================================

/** Bolt that targets enemies (damage bolt). */
function makeDamageBolt(): Bolt {
    return {
        boltEffect: BoltEffect.Damage,
        flags: BoltFlag.BF_TARGET_ENEMIES,
        forbiddenMonsterFlags: 0,
        pathDF: 0,
        targetDF: 0,
        description: "blasts",
    } as unknown as Bolt;
}

/** A player-like target creature. */
function makePlayer(): Creature {
    return {
        info: { flags: 0, abilityFlags: 0, maxHP: 20, monsterName: "you", monsterID: 0 },
        currentHP: 20,
        bookkeepingFlags: 0,
        creatureState: CreatureState.TrackingScent,
        status: new Array(50).fill(0),
        loc: { x: 8, y: 5 },
    } as unknown as Creature;
}

/** A caster monster with bolt index 1, MONST_ALWAYS_USE_ABILITY set. */
function makeCaster(): Creature {
    const bolts = new Array(20).fill(0);
    bolts[0] = 1; // bolt type index 1
    return {
        info: {
            monsterID: 1,
            flags: MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY,
            abilityFlags: 0,
            maxHP: 10,
            monsterName: "the rat",
            bolts,
        },
        currentHP: 10,
        bookkeepingFlags: 0,
        creatureState: CreatureState.Hunting,
        status: new Array(50).fill(0),
        loc: { x: 5, y: 5 },
    } as unknown as Creature;
}

function makeBoltAICtx(overrides: Partial<BoltAIContext> = {}): BoltAIContext {
    const player = makePlayer();
    return {
        player,
        monsters: [],
        rogue: {} as never,
        boltCatalog: [makeBolt(BoltEffect.None), makeDamageBolt()],
        tileCatalog: [],
        dungeonFeatureCatalog: [],
        monsterCatalog: [{ monsterName: "rat" }] as never,
        rng: { randPercent: () => false },
        openPathBetween: () => true,
        cellHasTerrainFlag: () => false,
        inFieldOfView: () => true,
        canDirectlySeeMonster: () => false,
        monsterIsHidden: () => false,
        monstersAreTeammates: () => false,
        monstersAreEnemies: () => true,
        canSeeMonster: () => true,
        burnedTerrainFlagsAtLoc: () => 0,
        avoidedFlagsForMonster: () => 0,
        distanceBetween: () => 3,
        monsterName: (m) => m.info.monsterName ?? "monster",
        resolvePronounEscapes: (text) => text,
        combatMessage: () => {},
        zap: vi.fn().mockResolvedValue(true),
        gameOver: () => {},
        monsterSummons: () => false,
        ...overrides,
    };
}

// =============================================================================
// monsterCastSpell
// =============================================================================

describe("monsterCastSpell", () => {
    it("calls zap with caster.loc and target.loc", async () => {
        const caster = makeCaster();
        const target = makePlayer();
        const zapFn = vi.fn().mockResolvedValue(true);
        const ctx = makeBoltAICtx({ player: target, zap: zapFn });

        await monsterCastSpell(caster, target, 1, ctx);

        expect(zapFn).toHaveBeenCalledOnce();
        expect(zapFn.mock.calls[0][0]).toEqual({ x: 5, y: 5 }); // origin = caster.loc
        expect(zapFn.mock.calls[0][1]).toEqual({ x: 8, y: 5 }); // target = player.loc
    });

    it("logs combatMessage when caster is visible", async () => {
        const caster = makeCaster();
        const target = makePlayer();
        const combatMsg = vi.fn();
        const ctx = makeBoltAICtx({
            player: target,
            canDirectlySeeMonster: () => true,
            combatMessage: combatMsg,
        });

        await monsterCastSpell(caster, target, 1, ctx);

        expect(combatMsg).toHaveBeenCalledOnce();
        const [msg] = combatMsg.mock.calls[0];
        expect(msg).toContain("blasts"); // bolt description included
    });

    it("does not log combatMessage when caster is not visible", async () => {
        const caster = makeCaster();
        const target = makePlayer();
        const combatMsg = vi.fn();
        const ctx = makeBoltAICtx({
            player: target,
            canDirectlySeeMonster: () => false,
            combatMessage: combatMsg,
        });

        await monsterCastSpell(caster, target, 1, ctx);

        expect(combatMsg).not.toHaveBeenCalled();
    });
});

// =============================================================================
// monstUseBolt
// =============================================================================

describe("monstUseBolt", () => {
    it("returns false when monster has no bolts", async () => {
        const monst = makeMonster([]); // no bolts
        const ctx = makeBoltAICtx();
        expect(await monstUseBolt(monst as unknown as Creature, ctx)).toBe(false);
    });

    it("fires zap and returns true when a valid target exists", async () => {
        const caster = makeCaster(); // MONST_ALWAYS_USE_ABILITY + bolt[0]=1
        const target = makePlayer();
        const zapFn = vi.fn().mockResolvedValue(true);
        const ctx = makeBoltAICtx({ player: target, zap: zapFn });

        const result = await monstUseBolt(caster, ctx);

        expect(result).toBe(true);
        expect(zapFn).toHaveBeenCalledOnce();
    });

    it("returns false when target is hidden", async () => {
        const caster = makeCaster();
        const target = makePlayer();
        const zapFn = vi.fn().mockResolvedValue(true);
        const ctx = makeBoltAICtx({
            player: target,
            zap: zapFn,
            monsterIsHidden: () => true, // target is hidden
        });

        const result = await monstUseBolt(caster, ctx);

        expect(result).toBe(false);
        expect(zapFn).not.toHaveBeenCalled();
    });

    it("returns false when no open path to target", async () => {
        const caster = makeCaster();
        const target = makePlayer();
        const zapFn = vi.fn().mockResolvedValue(true);
        const ctx = makeBoltAICtx({
            player: target,
            zap: zapFn,
            openPathBetween: () => false,
        });

        expect(await monstUseBolt(caster, ctx)).toBe(false);
        expect(zapFn).not.toHaveBeenCalled();
    });
});

// =============================================================================
// monstUseMagic
// =============================================================================

describe("monstUseMagic", () => {
    it("returns true immediately when monsterSummons succeeds", async () => {
        const caster = makeCaster();
        const zapFn = vi.fn().mockResolvedValue(true);
        const ctx = makeBoltAICtx({
            zap: zapFn,
            monsterSummons: () => true, // summons succeeds
        });

        const result = await monstUseMagic(caster, ctx);

        expect(result).toBe(true);
        expect(zapFn).not.toHaveBeenCalled(); // no bolt fired
    });

    it("falls through to monstUseBolt when summoning fails", async () => {
        const caster = makeCaster(); // has bolt
        const target = makePlayer();
        const zapFn = vi.fn().mockResolvedValue(true);
        const ctx = makeBoltAICtx({
            player: target,
            zap: zapFn,
            monsterSummons: () => false, // summons fails
        });

        const result = await monstUseMagic(caster, ctx);

        expect(result).toBe(true);
        expect(zapFn).toHaveBeenCalledOnce(); // bolt was fired
    });

    it("returns false when neither summons nor bolt succeeds", async () => {
        const caster = makeMonster([]); // no bolts
        const ctx = makeBoltAICtx({
            monsterSummons: () => false,
        });

        expect(await monstUseMagic(caster as unknown as Creature, ctx)).toBe(false);
    });
});
