/*
 *  game-cleanup.test.ts — Unit tests for game-cleanup.ts
 *  brogue-ts
 *
 *  Phase 4a NEEDS-VERIFICATION: freeCreature, removeDeadMonsters, unflag
 *  Source: RogueMain.c:937–1044, 1405–1414
 */

import { describe, it, expect } from "vitest";
import {
    freeCreature,
    removeDeadMonsters,
    unflag,
} from "../../src/game/game-cleanup.js";
import type { CleanupContext } from "../../src/game/game-cleanup.js";
import { MonsterBehaviorFlag, MonsterBookkeepingFlag, MonsterAbilityFlag } from "../../src/types/flags.js";
import type { Creature } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 0, y: 0 },
        info: {
            flags: 0,
            abilityFlags: 0,
            monsterID: 0,
            movementSpeed: 100,
            attackSpeed: 100,
            maxHP: 10,
            defense: 0,
            damage: { lowerBound: 1, upperBound: 1, clumpFactor: 1 },
            foreColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            displayChar: 0,
            bolts: [],
            turnsBetweenRegen: 100,
            attackHitPercent: 70,
            poisonStrength: 0,
            pathfindPriority: 0,
            genFlags: 0,
            mutationIndex: -1,
        } as any,
        currentHP: 10,
        maxHP: 10,
        bookkeepingFlags: 0,
        creatureState: 0,
        status: new Array(40).fill(0),
        mapToMe: null,
        safetyMap: null,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        mutationIndex: -1,
        movementSpeed: 100,
        attackSpeed: 100,
        ticksUntilTurn: 0,
        xpxp: 0,
        lastSeenPlayerAt: { x: -1, y: -1 },
        // Cast to any for brevity; test targets only the fields above
        ...overrides,
    } as unknown as Creature;
}

function makeCleanupCtx(
    monsters: Creature[],
    dormantMonsters: Creature[],
    player: Creature,
): CleanupContext {
    const purgatory: Creature[] = [];
    return {
        rogue: {
            mapToShore: null,
            mapToSafeTerrain: null,
            wpDistance: [],
            flares: [],
            featRecord: [],
        },
        player,
        gameConst: { deepestLevel: 26 } as any,
        levels: [],
        setLevels() {},
        monsters,
        dormantMonsters,
        floorItems: [],
        packItems: [],
        monsterItemsHopper: [],
        purgatory,
        safetyMap: null,
        allySafetyMap: null,
        chokeMap: null,
        scentMap: null,
        setSafetyMap() {},
        setAllySafetyMap() {},
        setChokeMap() {},
        setScentMap() {},
        freeGrid() {},
        deleteItem() {},
        deleteAllFlares() {},
    };
}

// =============================================================================
// freeCreature — RogueMain.c:937
// =============================================================================

describe("freeCreature", () => {
    it("nulls mapToMe and safetyMap", () => {
        const m = makeCreature({ mapToMe: [[1]] as any, safetyMap: [[2]] as any });
        freeCreature(m);
        expect(m.mapToMe).toBeNull();
        expect(m.safetyMap).toBeNull();
    });

    it("nulls carriedItem", () => {
        const item = { category: 1 } as any;
        const m = makeCreature({ carriedItem: item });
        freeCreature(m);
        expect(m.carriedItem).toBeNull();
    });

    it("recursively frees carriedMonster and nulls it", () => {
        const inner = makeCreature({ mapToMe: [[3]] as any });
        const outer = makeCreature({ carriedMonster: inner });
        freeCreature(outer);
        expect(outer.carriedMonster).toBeNull();
        expect(inner.mapToMe).toBeNull(); // inner was freed recursively
    });

    it("is a no-op when carriedMonster is null", () => {
        const m = makeCreature();
        expect(() => freeCreature(m)).not.toThrow();
    });
});

// =============================================================================
// removeDeadMonsters — RogueMain.c:979
// =============================================================================

describe("removeDeadMonsters", () => {
    it("removes a dead monster from the monsters list", () => {
        const player = makeCreature();
        const dead = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_HAS_DIED });
        const alive = makeCreature();
        const monsters = [dead, alive];
        const ctx = makeCleanupCtx(monsters, [], player);

        removeDeadMonsters(ctx);

        expect(ctx.monsters).toHaveLength(1);
        expect(ctx.monsters[0]).toBe(alive);
    });

    it("removes a dead monster from the dormantMonsters list", () => {
        const player = makeCreature();
        const dead = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_HAS_DIED });
        const ctx = makeCleanupCtx([], [dead], player);

        removeDeadMonsters(ctx);

        expect(ctx.dormantMonsters).toHaveLength(0);
    });

    it("moves eligible ally to purgatory", () => {
        const player = makeCreature();
        // Eligible ally: leader === player, no DOES_NOT_RESURRECT, not inanimate, has WEAPON_AUTO_ID
        const ally = makeCreature({
            bookkeepingFlags:
                MonsterBookkeepingFlag.MB_HAS_DIED |
                MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID,
        });
        ally.leader = player;
        // info.flags: not MONST_INANIMATE
        ally.info.flags = 0;

        const ctx = makeCleanupCtx([ally], [], player);
        removeDeadMonsters(ctx);

        expect(ctx.monsters).toHaveLength(0);
        expect(ctx.purgatory).toHaveLength(1);
        expect(ctx.purgatory[0]).toBe(ally);
        // MB_HAS_DIED cleared so purgatory list is iterable
        expect(ally.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED).toBe(0);
    });

    it("does not send ally to purgatory if MB_DOES_NOT_RESURRECT is set", () => {
        const player = makeCreature();
        const ally = makeCreature({
            bookkeepingFlags:
                MonsterBookkeepingFlag.MB_HAS_DIED |
                MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID |
                MonsterBookkeepingFlag.MB_DOES_NOT_RESURRECT,
        });
        ally.leader = player;
        ally.info.flags = 0;

        const ctx = makeCleanupCtx([ally], [], player);
        removeDeadMonsters(ctx);

        expect(ctx.purgatory).toHaveLength(0);
    });

    it("does not send ally to purgatory if MB_ADMINISTRATIVE_DEATH is set", () => {
        const player = makeCreature();
        const ally = makeCreature({
            bookkeepingFlags:
                MonsterBookkeepingFlag.MB_HAS_DIED |
                MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID |
                MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH,
        });
        ally.leader = player;
        ally.info.flags = 0;

        const ctx = makeCleanupCtx([ally], [], player);
        removeDeadMonsters(ctx);

        expect(ctx.purgatory).toHaveLength(0);
    });

    it("does not send non-ally to purgatory", () => {
        const player = makeCreature();
        const monster = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_HAS_DIED,
        });
        // No leader, no WEAPON_AUTO_ID
        monster.leader = null;

        const ctx = makeCleanupCtx([monster], [], player);
        removeDeadMonsters(ctx);

        expect(ctx.purgatory).toHaveLength(0);
    });

    it("leaves alive monsters untouched", () => {
        const player = makeCreature();
        const alive = makeCreature({ bookkeepingFlags: 0 });
        const ctx = makeCleanupCtx([alive], [], player);

        removeDeadMonsters(ctx);

        expect(ctx.monsters).toHaveLength(1);
        expect(ctx.purgatory).toHaveLength(0);
    });
});

// =============================================================================
// unflag — RogueMain.c:1406
// =============================================================================

describe("unflag", () => {
    it("returns 0 for flag 1 (Fl(0))", () => {
        expect(unflag(1)).toBe(0);
    });

    it("returns 1 for flag 2 (Fl(1))", () => {
        expect(unflag(2)).toBe(1);
    });

    it("returns 2 for flag 4 (Fl(2))", () => {
        expect(unflag(4)).toBe(2);
    });

    it("returns 10 for flag 1024 (Fl(10))", () => {
        expect(unflag(1024)).toBe(10);
    });

    it("returns 31 for flag 0x80000000 (Fl(31))", () => {
        expect(unflag(0x80000000)).toBe(31);
    });

    it("returns -1 for 0 (no set bits)", () => {
        expect(unflag(0)).toBe(-1);
    });

    it("multi-bit value 3: returns 1 (highest bit pos where flag >> i === 1)", () => {
        // unflag finds i such that (flag >>> i) === 1 — the highest set bit.
        // For 3 = 0b11: 3 >>> 1 = 1 → returns 1. Matches C behavior.
        // Callers are expected to always pass single-bit Fl(n) values.
        expect(unflag(3)).toBe(1);
    });
});
