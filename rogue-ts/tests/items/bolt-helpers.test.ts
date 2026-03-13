/*
 *  bolt-helpers.test.ts — Tests for tunnelize, negationWillAffectMonster, projectileReflects
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    tunnelize,
    negationWillAffectMonster,
    projectileReflects,
} from "../../src/items/bolt-helpers.js";
import type { TunnelizeContext, ProjectileReflectsContext } from "../../src/items/bolt-helpers.js";
import type { Creature, Pcell, Item, Bolt, Mutation, MonsterClass } from "../../src/types/types.js";
import { CreatureState, StatusEffect, TileType, DungeonLayer, DungeonFeatureType } from "../../src/types/enums.js";
import {
    TileFlag,
    MonsterAbilityFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    BoltFlag,
    ItemFlag,
    ArmorEnchant,
} from "../../src/types/flags.js";
import { ArmorEnchant as ArmorEnchantEnum } from "../../src/types/enums.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import { NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
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
        carriedMonster: null,
        leader: null,
        mutationIndex: -1,
        wasNegated: false,
        ...overrides,
    } as Creature;
}

function makeCell(
    tileType: TileType = TileType.FLOOR,
    flags = 0,
): Pcell {
    const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING) as TileType[];
    layers[DungeonLayer.Dungeon] = tileType;
    return {
        layers,
        flags,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: TileType.NOTHING,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
    };
}

/**
 * Build a 3×3 pmap suitable for tunnelize tests at (1,1).
 * All cells default to FLOOR with no flags.
 * Cell at (cx, cy) can be overridden with a custom tile and flags.
 */
function makePmap3x3(
    cx: number,
    cy: number,
    cellTile: TileType,
    cellFlags = 0,
): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < 3; x++) {
        pmap[x] = [];
        for (let y = 0; y < 3; y++) {
            pmap[x][y] = (x === cx && y === cy)
                ? makeCell(cellTile, cellFlags)
                : makeCell(TileType.FLOOR, 0);
        }
    }
    return pmap;
}

function makeTunnelizeCtx(
    pmap: Pcell[][],
    overrides: Partial<TunnelizeContext> = {},
): TunnelizeContext {
    return {
        pmap,
        tileCatalog,
        // By default: returns false for all flags → no kinks detected, no obstruction
        cellHasTerrainFlag: (_pos, _flags) => false,
        spawnDungeonFeature: vi.fn(),
        monsterAtLoc: () => null,
        inflictLethalDamage: vi.fn(),
        killCreature: vi.fn(),
        freeCaptivesEmbeddedAt: vi.fn(),
        randPercent: () => false,
        ...overrides,
    };
}

// =============================================================================
// tunnelize
// =============================================================================

describe("tunnelize", () => {
    it("returns false without changes when cell is IMPREGNABLE", () => {
        const pmap = makePmap3x3(1, 1, TileType.WALL, TileFlag.IMPREGNABLE);
        const ctx = makeTunnelizeCtx(pmap);
        const result = tunnelize(1, 1, ctx);
        expect(result).toBe(false);
        // Tile unchanged
        expect(pmap[1][1].layers[DungeonLayer.Dungeon]).toBe(TileType.WALL);
        expect(vi.mocked(ctx.spawnDungeonFeature as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    });

    it("converts boundary wall to CRYSTAL_WALL and returns true", () => {
        // x=0 is a boundary; needs a full column pmap[0][...]
        const pmap: Pcell[][] = [];
        pmap[0] = [makeCell(TileType.WALL, 0), makeCell(TileType.FLOOR, 0), makeCell(TileType.FLOOR, 0)];
        pmap[1] = [makeCell(TileType.FLOOR, 0), makeCell(TileType.FLOOR, 0), makeCell(TileType.FLOOR, 0)];
        const spawnSpy = vi.fn();
        const ctx = makeTunnelizeCtx(pmap, { spawnDungeonFeature: spawnSpy });
        const result = tunnelize(0, 1, ctx);
        expect(result).toBe(true);
        expect(pmap[0][1].layers[DungeonLayer.Dungeon]).toBe(TileType.CRYSTAL_WALL);
        expect(spawnSpy).toHaveBeenCalledWith(0, 1, DungeonFeatureType.DF_TUNNELIZE, true, false);
    });

    it("converts interior WALL to FLOOR and returns true", () => {
        const pmap = makePmap3x3(1, 1, TileType.WALL);
        const spawnSpy = vi.fn();
        const ctx = makeTunnelizeCtx(pmap, { spawnDungeonFeature: spawnSpy });
        const result = tunnelize(1, 1, ctx);
        expect(result).toBe(true);
        expect(pmap[1][1].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
        expect(spawnSpy).toHaveBeenCalledWith(1, 1, DungeonFeatureType.DF_TUNNELIZE, true, false);
    });

    it("returns false for interior FLOOR cell (nothing to do)", () => {
        const pmap = makePmap3x3(1, 1, TileType.FLOOR);
        const spawnSpy = vi.fn();
        const ctx = makeTunnelizeCtx(pmap, { spawnDungeonFeature: spawnSpy });
        const result = tunnelize(1, 1, ctx);
        expect(result).toBe(false);
        expect(spawnSpy).not.toHaveBeenCalled();
    });

    it("calls freeCaptivesEmbeddedAt before processing", () => {
        const pmap = makePmap3x3(1, 1, TileType.WALL);
        const freeSpy = vi.fn();
        const ctx = makeTunnelizeCtx(pmap, { freeCaptivesEmbeddedAt: freeSpy });
        tunnelize(1, 1, ctx);
        expect(freeSpy).toHaveBeenCalledWith(1, 1);
    });

    it("kills MONST_ATTACKABLE_THRU_WALLS monster in tunneled cell", () => {
        const pmap = makePmap3x3(1, 1, TileType.WALL, TileFlag.HAS_MONSTER);
        const turret = makeCreature({
            loc: { x: 1, y: 1 },
            info: {
                monsterID: 0, monsterName: "turret", displayChar: 0,
                foreColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
                maxHP: 10, turnsBetweenRegen: 0, movementSpeed: 100, attackSpeed: 100,
                damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
                accuracy: 0, defense: 0, DFChance: 0, DFType: 0, bloodType: 0,
                lightType: 0, intrinsicLightType: 0, isLarge: false,
                flags: MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS,
                abilityFlags: 0, bolts: [],
            } as Creature["info"],
        });
        const killSpy = vi.fn();
        const lethalSpy = vi.fn();
        const ctx = makeTunnelizeCtx(pmap, {
            monsterAtLoc: () => turret,
            killCreature: killSpy,
            inflictLethalDamage: lethalSpy,
        });
        tunnelize(1, 1, ctx);
        expect(lethalSpy).toHaveBeenCalledWith(null, turret);
        expect(killSpy).toHaveBeenCalledWith(turret, false);
    });

    it("does not kill non-wall monster in tunneled cell", () => {
        const pmap = makePmap3x3(1, 1, TileType.WALL, TileFlag.HAS_MONSTER);
        const monster = makeCreature({ loc: { x: 1, y: 1 } }); // no MONST_ATTACKABLE_THRU_WALLS
        const killSpy = vi.fn();
        const ctx = makeTunnelizeCtx(pmap, {
            monsterAtLoc: () => monster,
            killCreature: killSpy,
        });
        tunnelize(1, 1, ctx);
        expect(killSpy).not.toHaveBeenCalled();
    });
});

// =============================================================================
// negationWillAffectMonster
// =============================================================================

const emptyBoltCatalog: Bolt[] = [];
const emptyMutationCatalog: Mutation[] = [];

describe("negationWillAffectMonster", () => {
    it("returns false for MONST_INVULNERABLE regardless of isBolt", () => {
        const monst = makeCreature({ info: { flags: MonsterBehaviorFlag.MONST_INVULNERABLE } } as any);
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(false);
        expect(negationWillAffectMonster(monst, false, emptyBoltCatalog, emptyMutationCatalog)).toBe(false);
    });

    it("returns false for MA_REFLECT_100 when isBolt=true", () => {
        const monst = makeCreature({ info: { abilityFlags: MonsterAbilityFlag.MA_REFLECT_100 } } as any);
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(false);
    });

    it("returns true for MA_REFLECT_100 when isBolt=false (blast can still affect)", () => {
        const monst = makeCreature({ info: { abilityFlags: MonsterAbilityFlag.MA_REFLECT_100 } } as any);
        expect(negationWillAffectMonster(monst, false, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true for MONST_DIES_IF_NEGATED", () => {
        const monst = makeCreature({ info: { flags: MonsterBehaviorFlag.MONST_DIES_IF_NEGATED } } as any);
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true when monster is MB_SEIZING", () => {
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_SEIZING });
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true when monster is STATUS_SLOWED", () => {
        const monst = makeCreature();
        monst.status[StatusEffect.Slowed] = 10;
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true when monster is STATUS_HASTED", () => {
        const monst = makeCreature();
        monst.status[StatusEffect.Hasted] = 5;
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true when movementSpeed has been modified", () => {
        const monst = makeCreature({ movementSpeed: 50 }); // info.movementSpeed = 100
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true when attackSpeed has been modified", () => {
        const monst = makeCreature({ attackSpeed: 200 }); // info.attackSpeed = 100
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns true when monster has a negatable bolt", () => {
        const bolt: Bolt = {
            name: "", description: "", abilityDescription: "",
            flags: 0, // BF_NOT_NEGATABLE not set
            pathDF: 0, theChar: 0, foreColor: null, backColor: null,
            magnitude: 0, lightFlare: 0, flashColor: null, distance: 0,
            originDF: 0, explosionDF: 0, creatureDF: 0, wallDF: 0, DF: 0,
            boltEffect: 0, backColor2: null,
        } as any;
        const monst = makeCreature({ info: { bolts: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] } } as any);
        const catalog: Bolt[] = [null as any, bolt];
        expect(negationWillAffectMonster(monst, true, catalog, emptyMutationCatalog)).toBe(true);
    });

    it("returns false when monster's bolt is BF_NOT_NEGATABLE", () => {
        const bolt: Bolt = { flags: BoltFlag.BF_NOT_NEGATABLE } as any;
        const monst = makeCreature();
        // Override just the bolts array; keep flags/abilityFlags/speeds from base
        monst.info.bolts = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const catalog: Bolt[] = [null as any, bolt];
        expect(negationWillAffectMonster(monst, true, catalog, emptyMutationCatalog)).toBe(false);
    });

    it("returns false for plain unmodified monster with no special traits", () => {
        const monst = makeCreature();
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, emptyMutationCatalog)).toBe(false);
    });

    it("returns true when mutation has canBeNegated=true", () => {
        const mutation: Mutation = { canBeNegated: true } as any;
        const monst = makeCreature({ mutationIndex: 0 });
        const mutCatalog: Mutation[] = [mutation];
        expect(negationWillAffectMonster(monst, true, emptyBoltCatalog, mutCatalog)).toBe(true);
    });
});

// =============================================================================
// projectileReflects
// =============================================================================

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: 0, kind: 0, flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0, charges: 0, enchant1: 1, enchant2: 0,
        timesEnchanted: 0, vorpalEnemy: 0, strengthRequired: 0, quiverNumber: 0,
        displayChar: 0, foreColor: null as any, inventoryColor: null as any,
        quantity: 1, inventoryLetter: "", inscription: "",
        loc: { x: 0, y: 0 },
        keyLoc: [],
        originDepth: 1, spawnTurnNumber: 0, lastUsed: [0, 0, 0],
        ...overrides,
    } as Item;
}

function makeReflectsCtx(overrides: Partial<ProjectileReflectsContext> = {}): ProjectileReflectsContext {
    const player = makeCreature({ loc: { x: 0, y: 0 } });
    return {
        player,
        rogue: { armor: null, strength: 12, weaknessAmount: 0 },
        monsterClassCatalog: [],
        cellHasTerrainFlag: () => false,
        randPercent: () => false,
        ...overrides,
    };
}

describe("projectileReflects", () => {
    it("returns false when defender has no reflection", () => {
        const attacker = makeCreature();
        const defender = makeCreature();
        const ctx = makeReflectsCtx();
        expect(projectileReflects(attacker, defender, ctx)).toBe(false);
    });

    it("returns true when defender has MA_REFLECT_100", () => {
        const attacker = makeCreature();
        const defender = makeCreature({ info: { abilityFlags: MonsterAbilityFlag.MA_REFLECT_100 } } as any);
        const ctx = makeReflectsCtx();
        expect(projectileReflects(attacker, defender, ctx)).toBe(true);
    });

    it("returns false when defender is null and no reflection", () => {
        const attacker = makeCreature();
        const ctx = makeReflectsCtx();
        expect(projectileReflects(attacker, null, ctx)).toBe(false);
    });

    it("returns true when MONST_REFLECT_50 and rand passes", () => {
        const attacker = makeCreature();
        const defender = makeCreature({ info: { flags: MonsterBehaviorFlag.MONST_REFLECT_50 } } as any);
        // MONST_REFLECT_50 adds 4 * FP_FACTOR to netReflectionLevel → reflectionChance > 0
        // randPercent always returns true
        const ctx = makeReflectsCtx({ randPercent: () => true });
        expect(projectileReflects(attacker, defender, ctx)).toBe(true);
    });

    it("returns false when MONST_REFLECT_50 and rand fails", () => {
        const attacker = makeCreature();
        const defender = makeCreature({ info: { flags: MonsterBehaviorFlag.MONST_REFLECT_50 } } as any);
        const ctx = makeReflectsCtx({ randPercent: () => false });
        expect(projectileReflects(attacker, defender, ctx)).toBe(false);
    });

    it("returns true for immunity armor when attacker is in vorpal class and they are enemies", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 }, creatureState: CreatureState.Ally });
        const attacker = makeCreature({ creatureState: CreatureState.Wandering, info: { monsterID: 5 } } as any);
        const armor = makeItem({
            flags: ItemFlag.ITEM_RUNIC,
            enchant2: ArmorEnchantEnum.Immunity,
            vorpalEnemy: 0,
        });
        const vorpalClass: MonsterClass = { name: "", memberList: [5 as any] };
        const ctx = makeReflectsCtx({
            player,
            rogue: { armor, strength: 12, weaknessAmount: 0 },
            monsterClassCatalog: [vorpalClass],
            // player is ally, attacker is wandering → they're enemies
            cellHasTerrainFlag: () => false,
        });
        expect(projectileReflects(attacker, player, ctx)).toBe(true);
    });

    it("uses reflection armor enchant level to compute probability", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const attacker = makeCreature({ creatureState: CreatureState.Wandering });
        // enchant1=3 gives netReflectionLevel > 0 → some reflection probability
        const armor = makeItem({
            flags: ItemFlag.ITEM_RUNIC,
            enchant2: ArmorEnchantEnum.Reflection,
            enchant1: 3,
        });
        // rand returns true → reflected
        const ctx = makeReflectsCtx({
            player,
            rogue: { armor, strength: 12, weaknessAmount: 0 },
            randPercent: () => true,
        });
        expect(projectileReflects(attacker, player, ctx)).toBe(true);
    });
});
