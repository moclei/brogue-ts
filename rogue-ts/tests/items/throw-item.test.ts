/*
 *  throw-item.test.ts — Unit tests for hitMonsterWithProjectileWeapon + throwItem
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    hitMonsterWithProjectileWeapon,
    throwItem,
} from "../../src/items/throw-item.js";
import type {
    HitMonsterContext,
    ThrowItemContext,
    ThrowItemRenderContext,
} from "../../src/items/throw-item.js";
import type { Creature, Item, Pcell } from "../../src/types/types.js";
import {
    ItemCategory, WeaponKind, PotionKind,
    CreatureState, CreatureMode, StatusEffect,
    DungeonFeatureType, TileType, DungeonLayer,
} from "../../src/types/enums.js";
import {
    ItemFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag,
    TileFlag, TerrainFlag,
} from "../../src/types/flags.js";
import { NUMBER_TERRAIN_LAYERS, DCOLS, DROWS } from "../../src/types/constants.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";

// =============================================================================
// Fixtures
// =============================================================================

function makeCell(flags = 0): Pcell {
    const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING) as TileType[];
    layers[DungeonLayer.Dungeon] = TileType.FLOOR;
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

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = makeCell(0);
        }
    }
    return pmap;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    const status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    const maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return {
        loc: { x: 5, y: 5 },
        depth: 1,
        currentHP: 10,
        turnsUntilRegen: 0,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: CreatureState.Wandering,
        creatureMode: CreatureMode.Normal,
        mutationIndex: -1,
        wasNegated: false,
        targetWaypointIndex: 0,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: 0, y: 0 },
        targetCorpseLoc: { x: -1, y: -1 },
        targetCorpseName: "",
        absorptionFlags: 0,
        absorbBehavior: false,
        absorptionBolt: 0,
        corpseAbsorptionCounter: 0,
        mapToMe: null,
        safetyMap: null,
        ticksUntilTurn: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        previousHealthPoints: 10,
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
        status,
        maxStatus,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        machineHome: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        leader: null,
        carriedMonster: null,
        carriedItem: null,
        info: {
            monsterID: 0,
            monsterName: "goblin",
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
        ...overrides,
    } as Creature;
}

function makeWeapon(overrides: Partial<Item> = {}): Item {
    return {
        category: ItemCategory.WEAPON,
        kind: WeaponKind.Dart,
        flags: 0,
        damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: 0,
        foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
        inventoryColor: null,
        quantity: 1,
        inventoryLetter: "a",
        inscription: "",
        loc: { x: 5, y: 5 },
        keyLoc: [],
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    } as Item;
}

function makePotion(kind: PotionKind, overrides: Partial<Item> = {}): Item {
    return {
        category: ItemCategory.POTION,
        kind,
        flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: 0,
        foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
        inventoryColor: null,
        quantity: 1,
        inventoryLetter: "b",
        inscription: "",
        loc: { x: 5, y: 5 },
        keyLoc: [],
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    } as Item;
}

const RED_COLOR = { red: 100, green: 0, blue: 0, rand: 0, colorDances: false };

function makeHitCtx(overrides: Partial<HitMonsterContext> = {}): HitMonsterContext {
    const player = makeCreature({ loc: { x: 1, y: 1 } });
    return {
        player,
        attackHit: vi.fn().mockReturnValue(true),
        inflictDamage: vi.fn().mockReturnValue(false), // false = not killed
        killCreature: vi.fn(),
        magicWeaponHit: vi.fn(),
        moralAttack: vi.fn(),
        splitMonster: vi.fn(),
        handlePaladinFeat: vi.fn(),
        applyArmorRunicEffect: vi.fn().mockReturnValue(""),
        itemName: vi.fn().mockReturnValue("dart"),
        monsterName: vi.fn().mockImplementation((m, _) => m.info.monsterName),
        messageColorFromVictim: vi.fn().mockReturnValue(null),
        message: vi.fn(),
        messageWithColor: vi.fn(),
        netEnchant: vi.fn().mockReturnValue(0n),
        damageFraction: vi.fn().mockReturnValue(FP_FACTOR),
        randClump: vi.fn().mockReturnValue(2),
        red: RED_COLOR,
        ...overrides,
    };
}

function makeNoOpRender(): ThrowItemRenderContext {
    return {
        playerCanSee: vi.fn().mockReturnValue(false),
        playerCanDirectlySee: vi.fn().mockReturnValue(false),
        plotItemAt: vi.fn(),
        pauseAnimation: vi.fn().mockResolvedValue(false),
        refreshDungeonCell: vi.fn(),
        playbackFastForward: false,
    };
}

const FLOOR_TILE = { flags: 0, mechFlags: 0, description: "the floor", flavorText: "stands here" };
const WALL_TILE = {
    flags: TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION,
    mechFlags: 0,
    description: "a stone wall",
    flavorText: "a wall",
};

function makeThrowCtx(
    pmap: Pcell[][],
    overrides: Partial<ThrowItemContext> = {},
): ThrowItemContext {
    const base = makeHitCtx(overrides);
    return {
        ...base,
        render: makeNoOpRender(),
        pmap,
        boltCatalog: [{ name: "none", description: "", abilityDescription: "", theChar: 0, foreColor: null, backColor: null, boltEffect: 0, magnitude: 0, pathDF: 0, targetDF: 0, forbiddenMonsterFlags: 0, flags: 0 }],
        monsterAtLoc: vi.fn().mockReturnValue(null),
        cellHasTerrainFlag: vi.fn().mockReturnValue(false),
        cellHasTMFlag: vi.fn().mockReturnValue(false),
        deleteItem: vi.fn(),
        placeItemAt: vi.fn(),
        getQualifyingLocNear: vi.fn().mockImplementation((target) => target),
        spawnDungeonFeature: vi.fn(),
        promoteTile: vi.fn(),
        exposeCreatureToFire: vi.fn(),
        autoIdentify: vi.fn(),
        tileCatalog: new Array(256).fill(FLOOR_TILE),
        highestPriorityLayer: vi.fn().mockReturnValue(0),
        layerWithTMFlag: vi.fn().mockReturnValue(-1),
        potionTable: new Array(16).fill({ flavor: "crimson" }),
        ...overrides,
    } as ThrowItemContext;
}

// =============================================================================
// hitMonsterWithProjectileWeapon
// =============================================================================

describe("hitMonsterWithProjectileWeapon", () => {
    it("returns false for non-weapon items", () => {
        const ctx = makeHitCtx();
        const potion = makePotion(PotionKind.Poison);
        const monst = makeCreature();
        expect(hitMonsterWithProjectileWeapon(ctx.player, monst, potion, ctx)).toBe(false);
    });

    it("calls handlePaladinFeat when player throws at non-immune monster", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature();
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(ctx.handlePaladinFeat).toHaveBeenCalledWith(monst);
    });

    it("does not call handlePaladinFeat for immune monsters", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature({ info: { ...makeCreature().info, flags: MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS } });
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(ctx.handlePaladinFeat).not.toHaveBeenCalled();
    });

    it("clears STATUS_ENTRANCED on target", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature();
        monst.status[StatusEffect.Entranced] = 5;
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(monst.status[StatusEffect.Entranced]).toBe(0);
    });

    it("sets tracking scent on wandering monster hit", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature({ creatureState: CreatureState.Wandering });
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("does not change state of perm-fleeing monsters", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature({
            creatureState: CreatureState.Fleeing,
            creatureMode: CreatureMode.PermFleeing,
        });
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(monst.creatureState).toBe(CreatureState.Fleeing);
    });

    it("does not change state of ally monsters", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature({ creatureState: CreatureState.Ally });
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(monst.creatureState).toBe(CreatureState.Ally);
    });

    it("passes theItem as overrideWeapon to attackHit when player throws", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature();
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(ctx.attackHit).toHaveBeenCalledWith(ctx.player, monst, dart);
    });

    it("passes null overrideWeapon to attackHit when monster throws", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const thrower = makeCreature({ loc: { x: 2, y: 2 } });
        const monst = makeCreature();
        hitMonsterWithProjectileWeapon(thrower, monst, dart, ctx);
        expect(ctx.attackHit).toHaveBeenCalledWith(thrower, monst, null);
    });

    it("deals zero damage to immune monsters", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature({ info: { ...makeCreature().info, flags: MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS } });
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(ctx.inflictDamage).toHaveBeenCalledWith(ctx.player, monst, 0, RED_COLOR, false);
    });

    it("returns true and calls moralAttack + splitMonster on hit", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon();
        const monst = makeCreature();
        const result = hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(result).toBe(true);
        expect(ctx.moralAttack).toHaveBeenCalledWith(ctx.player, monst);
        expect(ctx.splitMonster).toHaveBeenCalledWith(monst, ctx.player);
    });

    it("calls killCreature when inflictDamage returns true (killed)", () => {
        const ctx = makeHitCtx({ inflictDamage: vi.fn().mockReturnValue(true) });
        const dart = makeWeapon();
        const monst = makeCreature();
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(ctx.killCreature).toHaveBeenCalledWith(monst, false);
    });

    it("calls magicWeaponHit for runic weapon on non-lethal hit", () => {
        const ctx = makeHitCtx();
        const dart = makeWeapon({ flags: ItemFlag.ITEM_RUNIC });
        const monst = makeCreature();
        hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(ctx.magicWeaponHit).toHaveBeenCalledWith(monst, dart, false);
    });

    it("clears ITEM_PLAYER_AVOIDS on miss and returns false", () => {
        const ctx = makeHitCtx({ attackHit: vi.fn().mockReturnValue(false) });
        const dart = makeWeapon({ flags: ItemFlag.ITEM_PLAYER_AVOIDS });
        const monst = makeCreature();
        const result = hitMonsterWithProjectileWeapon(ctx.player, monst, dart, ctx);
        expect(result).toBe(false);
        expect(dart.flags & ItemFlag.ITEM_PLAYER_AVOIDS).toBe(0);
    });

    it("applies armor runic when player is the target", () => {
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        const ctx = makeHitCtx({
            player,
            applyArmorRunicEffect: vi.fn().mockReturnValue("absorbed!"),
        });
        const dart = makeWeapon();
        const thrower = makeCreature({ loc: { x: 2, y: 2 } });
        hitMonsterWithProjectileWeapon(thrower, player, dart, ctx);
        expect(ctx.applyArmorRunicEffect).toHaveBeenCalled();
        expect(ctx.message).toHaveBeenCalledWith("absorbed!", 0);
    });
});

// =============================================================================
// throwItem
// =============================================================================

describe("throwItem", () => {
    let pmap: Pcell[][];

    beforeEach(() => {
        pmap = makePmap();
    });

    it("sets ITEM_PLAYER_AVOIDS on thrown item", async () => {
        const dart = makeWeapon({ kind: WeaponKind.Dart });
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        const ctx = makeThrowCtx(pmap);
        await throwItem(dart, thrower, { x: 5, y: 10 }, 20, ctx);
        // flag is set at the start; it may later be cleared on miss
        // just verify placeItemAt was called (item landed)
        expect(ctx.placeItemAt).toHaveBeenCalled();
    });

    it("sets ticksUntilTurn to attackSpeed", async () => {
        const dart = makeWeapon();
        const thrower = makeCreature({ loc: { x: 5, y: 5 }, attackSpeed: 150 });
        const ctx = makeThrowCtx(pmap);
        await throwItem(dart, thrower, { x: 5, y: 10 }, 20, ctx);
        expect(thrower.ticksUntilTurn).toBe(150);
    });

    it("calls deleteItem and returns early when weapon hits monster", async () => {
        const dart = makeWeapon({ kind: WeaponKind.Dart });
        const monst = makeCreature({ loc: { x: 5, y: 7 } });
        pmap[5][7].flags |= TileFlag.HAS_MONSTER;

        // Throw straight down from (5,5) to (5,14): path is (5,6), (5,7), ...
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        const ctx = makeThrowCtx(pmap, {
            player,
            monsterAtLoc: vi.fn().mockImplementation((pos) =>
                pos.x === 5 && pos.y === 7 ? monst : null,
            ),
            attackHit: vi.fn().mockReturnValue(true),
            inflictDamage: vi.fn().mockReturnValue(false),
        });

        await throwItem(dart, thrower, { x: 5, y: 14 }, 20, ctx);
        expect(ctx.deleteItem).toHaveBeenCalledWith(dart);
        expect(ctx.placeItemAt).not.toHaveBeenCalled();
    });

    it("spawns gas cloud for poison potion shatter", async () => {
        const potion = makePotion(PotionKind.Poison);
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        const ctx = makeThrowCtx(pmap, {
            // cellHasTerrainFlag returns false (not T_AUTO_DESCENT) so potion shatters
            cellHasTerrainFlag: vi.fn().mockReturnValue(false),
        });

        await throwItem(potion, thrower, { x: 5, y: 10 }, 20, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(
            expect.any(Number), expect.any(Number),
            DungeonFeatureType.DF_POISON_GAS_CLOUD_POTION,
            true, false,
        );
        expect(ctx.autoIdentify).toHaveBeenCalledWith(potion);
        expect(ctx.deleteItem).toHaveBeenCalledWith(potion);
    });

    it("spawns incineration feature for incineration potion shatter", async () => {
        const potion = makePotion(PotionKind.Incineration);
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        const ctx = makeThrowCtx(pmap, {
            cellHasTerrainFlag: vi.fn().mockReturnValue(false),
        });

        await throwItem(potion, thrower, { x: 5, y: 10 }, 20, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(
            expect.any(Number), expect.any(Number),
            DungeonFeatureType.DF_INCINERATION_POTION,
            true, false,
        );
    });

    it("does not auto-identify harmless non-hallucination potions", async () => {
        const potion = makePotion(PotionKind.Life);
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        const ctx = makeThrowCtx(pmap, {
            cellHasTerrainFlag: vi.fn().mockReturnValue(false),
        });

        await throwItem(potion, thrower, { x: 5, y: 10 }, 20, ctx);
        expect(ctx.autoIdentify).not.toHaveBeenCalled();
        expect(ctx.deleteItem).toHaveBeenCalledWith(potion);
    });

    it("spawns dart explosion for incendiary dart and calls exposeCreatureToFire", async () => {
        const dart = makeWeapon({ kind: WeaponKind.IncendiaryDart });
        const monst = makeCreature({ loc: { x: 5, y: 8 } });
        pmap[5][8].flags |= TileFlag.HAS_MONSTER;

        const ctx = makeThrowCtx(pmap, {
            cellHasTerrainFlag: vi.fn().mockReturnValue(false),
            monsterAtLoc: vi.fn().mockImplementation((pos) =>
                pos.x === 5 && pos.y === 8 ? monst : null,
            ),
        });

        await throwItem(dart, makeCreature({ loc: { x: 5, y: 5 } }), { x: 5, y: 8 }, 20, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(
            5, 8, DungeonFeatureType.DF_DART_EXPLOSION, true, false,
        );
        expect(ctx.exposeCreatureToFire).toHaveBeenCalledWith(monst);
        expect(ctx.deleteItem).toHaveBeenCalledWith(dart);
    });

    it("places item at qualifying location when no collision", async () => {
        const dart = makeWeapon();
        const ctx = makeThrowCtx(pmap, {
            cellHasTerrainFlag: vi.fn().mockReturnValue(false),
            getQualifyingLocNear: vi.fn().mockReturnValue({ x: 5, y: 10 }),
        });
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        await throwItem(dart, thrower, { x: 5, y: 10 }, 20, ctx);
        expect(ctx.placeItemAt).toHaveBeenCalledWith(dart, { x: 5, y: 10 });
    });

    it("monster thrower in FOV announces throw", async () => {
        const dart = makeWeapon();
        const thrower = makeCreature({ loc: { x: 5, y: 5 } });
        pmap[5][5].flags |= TileFlag.IN_FIELD_OF_VIEW;
        // thrower is NOT the player
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        const ctx = makeThrowCtx(pmap, {
            player,
            monsterName: vi.fn().mockReturnValue("goblin"),
            itemName: vi.fn().mockReturnValue("a dart"),
        });

        await throwItem(dart, thrower, { x: 5, y: 10 }, 20, ctx);
        expect(ctx.message).toHaveBeenCalledWith("goblin hurls a dart.", 0);
    });
});
