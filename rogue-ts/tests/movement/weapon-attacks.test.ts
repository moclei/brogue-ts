/*
 *  weapon-attacks.test.ts — Tests for extended weapon attack helpers
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    abortAttackAgainstAcidicTarget,
    abortAttackAgainstDiscordantAlly,
    abortAttack,
    handleWhipAttacks,
    handleSpearAttacks,
    buildFlailHitList,
} from "../../src/movement/weapon-attacks.js";
import type { WeaponAttackContext, BoltInfo } from "../../src/movement/weapon-attacks.js";
import { StatusEffect, CreatureState, WeaponEnchant, BoltType, TileType, ItemCategory } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag, MonsterBookkeepingFlag, MonsterAbilityFlag,
    ItemFlag, TerrainFlag,
} from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

const nbDirs: readonly [number, number][] = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 0,
            monsterName: "test",
            displayChar: 0,
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
        creatureState: CreatureState.Wandering,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        movementSpeed: 100,
        attackSpeed: 100,
        carriedItem: null,
        ...overrides,
    } as Creature;
}

function makeWeapon(flags = 0): Item {
    return {
        category: ItemCategory.WEAPON,
        kind: 0,
        flags,
        damage: { lowerBound: 1, upperBound: 5, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 10,
        quiverNumber: 0,
        displayChar: 0,
        foreColor: null,
        inventoryColor: null,
        quantity: 1,
        inventoryLetter: "a",
        inscription: "",
        loc: { x: -1, y: -1 },
        keyLoc: [],
        originDepth: 0,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
    } as Item;
}

function makeCtx(overrides: Partial<WeaponAttackContext> = {}): WeaponAttackContext {
    const player = makeCreature({ loc: { x: 5, y: 5 } });
    return {
        pmap: [],
        player,
        rogue: { weapon: null, playbackFastForward: false },
        nbDirs,
        coordinatesAreInMap: () => true,
        isPosInMap: () => true,
        cellHasTerrainFlag: () => false,
        diagonalBlocked: () => false,
        monsterAtLoc: () => null,
        canSeeMonster: () => true,
        monsterIsHidden: () => false,
        monsterWillAttackTarget: () => true,
        monsterIsInClass: () => false,
        monstersAreEnemies: () => true,
        monsterName: () => "a goblin",
        distanceBetween: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
        itemName: () => "a sword",
        attack: () => true,
        boltCatalog: [],
        getImpactLoc: (_o, _t) => ({ x: 5, y: 3 }),
        zap: () => {},
        confirm: () => true,
        playerCanSeeOrSense: () => true,
        plotForegroundChar: () => {},
        pauseAnimation: () => {},
        refreshDungeonCell: () => {},
        lightBlue: null,
        allMonsters: () => [],
        ...overrides,
    };
}

// =============================================================================
// abortAttackAgainstAcidicTarget
// =============================================================================

describe("abortAttackAgainstAcidicTarget", () => {
    it("returns false when player has no weapon", () => {
        const ctx = makeCtx();
        const hitList: (Creature | null)[] = [makeCreature()];
        expect(abortAttackAgainstAcidicTarget(hitList, ctx)).toBe(false);
    });

    it("returns false when weapon is protected", () => {
        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(ItemFlag.ITEM_PROTECTED), playbackFastForward: false },
        });
        const hitList: (Creature | null)[] = [makeCreature()];
        expect(abortAttackAgainstAcidicTarget(hitList, ctx)).toBe(false);
    });

    it("returns true when player declines to attack acidic monster", () => {
        const acidicMonst = makeCreature();
        acidicMonst.info.flags |= MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON;

        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(), playbackFastForward: false },
            confirm: () => false, // player says "no"
        });

        const hitList: (Creature | null)[] = [acidicMonst];
        expect(abortAttackAgainstAcidicTarget(hitList, ctx)).toBe(true);
    });

    it("returns false when player confirms attack on acidic monster", () => {
        const acidicMonst = makeCreature();
        acidicMonst.info.flags |= MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON;

        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(), playbackFastForward: false },
            confirm: () => true, // player says "yes"
        });

        const hitList: (Creature | null)[] = [acidicMonst];
        expect(abortAttackAgainstAcidicTarget(hitList, ctx)).toBe(false);
    });
});

// =============================================================================
// abortAttackAgainstDiscordantAlly
// =============================================================================

describe("abortAttackAgainstDiscordantAlly", () => {
    it("returns false when no allies in hit list", () => {
        const ctx = makeCtx();
        const hitList: (Creature | null)[] = [makeCreature()];
        expect(abortAttackAgainstDiscordantAlly(hitList, ctx)).toBe(false);
    });

    it("returns true when player declines to attack discordant ally", () => {
        const ally = makeCreature({ creatureState: CreatureState.Ally });
        ally.status[StatusEffect.Discordant] = 5;

        const ctx = makeCtx({ confirm: () => false });
        const hitList: (Creature | null)[] = [ally];
        expect(abortAttackAgainstDiscordantAlly(hitList, ctx)).toBe(true);
    });

    it("returns false when player confirms attack on discordant ally", () => {
        const ally = makeCreature({ creatureState: CreatureState.Ally });
        ally.status[StatusEffect.Discordant] = 5;

        const ctx = makeCtx({ confirm: () => true });
        const hitList: (Creature | null)[] = [ally];
        expect(abortAttackAgainstDiscordantAlly(hitList, ctx)).toBe(false);
    });
});

// =============================================================================
// abortAttack
// =============================================================================

describe("abortAttack", () => {
    it("returns false (does not abort) when player is confused", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Confused] = 5;

        const acidicMonst = makeCreature();
        acidicMonst.info.flags |= MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON;

        const hitList: (Creature | null)[] = [acidicMonst];
        expect(abortAttack(hitList, ctx)).toBe(false);
    });

    it("returns false when player is hallucinating (not telepathic)", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Hallucinating] = 5;

        const hitList: (Creature | null)[] = [makeCreature()];
        expect(abortAttack(hitList, ctx)).toBe(false);
    });

    it("delegates to acidic/discordant checks when player is sane", () => {
        const acidicMonst = makeCreature();
        acidicMonst.info.flags |= MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON;

        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(), playbackFastForward: false },
            confirm: () => false,
        });

        const hitList: (Creature | null)[] = [acidicMonst];
        expect(abortAttack(hitList, ctx)).toBe(true);
    });
});

// =============================================================================
// handleWhipAttacks
// =============================================================================

describe("handleWhipAttacks", () => {
    it("returns false when player has no weapon", () => {
        const ctx = makeCtx();
        const aborted = { value: false };
        expect(handleWhipAttacks(ctx.player, 0, aborted, ctx)).toBe(false);
    });

    it("returns false when weapon doesn't extend", () => {
        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(0), playbackFastForward: false },
        });
        const aborted = { value: false };
        expect(handleWhipAttacks(ctx.player, 0, aborted, ctx)).toBe(false);
    });

    it("returns true and calls zap when a valid target exists", () => {
        const defender = makeCreature({ loc: { x: 5, y: 3 } });
        const zapSpy = vi.fn();
        const whipBolt = { theChar: 0 } as BoltInfo;
        const boltCatalog: BoltInfo[] = [];
        boltCatalog[BoltType.WHIP] = whipBolt;

        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(ItemFlag.ITEM_ATTACKS_EXTEND), playbackFastForward: false },
            monsterAtLoc: (loc) => (loc.x === 5 && loc.y === 3) ? defender : null,
            boltCatalog,
            getImpactLoc: () => ({ x: 5, y: 3 }),
            zap: zapSpy,
        });

        const aborted = { value: false };
        const result = handleWhipAttacks(ctx.player, 0, aborted, ctx);
        expect(result).toBe(true);
        expect(zapSpy).toHaveBeenCalledTimes(1);
    });

    it("returns false when diagonally blocked", () => {
        const ctx = makeCtx({
            rogue: { weapon: makeWeapon(ItemFlag.ITEM_ATTACKS_EXTEND), playbackFastForward: false },
            diagonalBlocked: () => true,
        });

        const aborted = { value: false };
        expect(handleWhipAttacks(ctx.player, 4, aborted, ctx)).toBe(false);
    });
});

// =============================================================================
// buildFlailHitList
// =============================================================================

describe("buildFlailHitList", () => {
    it("adds enemies adjacent to both positions", () => {
        const enemy = makeCreature({ loc: { x: 5, y: 5 } });
        const ctx = makeCtx({
            allMonsters: () => [enemy],
        });

        const hitList: (Creature | null)[] = new Array(16).fill(null);
        // Player at (4,5), moving to (5,5) — enemy at (5,5) is adjacent to both if dist=1
        // Actually let's pick: player at (4,5), newPos at (6,5), enemy at (5,5)
        // dist((4,5),(5,5)) = 1, dist((6,5),(5,5)) = 1 → both adjacent
        buildFlailHitList(4, 5, 6, 5, hitList, ctx);

        expect(hitList[0]).toBe(enemy);
    });

    it("skips dying monsters", () => {
        const dying = makeCreature({
            loc: { x: 5, y: 5 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DYING,
        });
        const ctx = makeCtx({
            allMonsters: () => [dying],
        });

        const hitList: (Creature | null)[] = new Array(16).fill(null);
        buildFlailHitList(4, 5, 6, 5, hitList, ctx);

        expect(hitList[0]).toBe(null);
    });

    it("skips allies", () => {
        const ally = makeCreature({
            loc: { x: 5, y: 5 },
            creatureState: CreatureState.Ally,
        });
        const ctx = makeCtx({
            allMonsters: () => [ally],
        });

        const hitList: (Creature | null)[] = new Array(16).fill(null);
        buildFlailHitList(4, 5, 6, 5, hitList, ctx);

        expect(hitList[0]).toBe(null);
    });
});
