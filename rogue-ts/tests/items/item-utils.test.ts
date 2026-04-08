/*
 *  item-utils.test.ts — Tests for lotteryDraw, describeMonsterClass,
 *                        keyMatchesLocation, monsterClassHasAcidicMonster,
 *                        beckonMonster, itemCanBeCalled
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    lotteryDraw,
    describeMonsterClass,
    keyMatchesLocation,
    keyOnTileAt,
    monsterClassHasAcidicMonster,
    beckonMonster,
    itemCanBeCalled,
    type BeckonMonsterContext,
} from "../../src/items/item-utils.js";
import { MonsterType, StatusEffect, CreatureState, BoltType, BoltEffect, ItemCategory } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag, MonsterBookkeepingFlag, ItemFlag, TileFlag,
} from "../../src/types/flags.js";
import { KEY_ID_MAXIMUM } from "../../src/types/constants.js";
import { boltCatalog } from "../../src/globals/bolt-catalog.js";
import type { Creature, Item, MonsterClass, Pcell, Bolt, CreatureType } from "../../src/types/types.js";
import { DisplayGlyph } from "../../src/types/enums.js";
import { itemColor, white } from "../../src/globals/colors.js";

// =============================================================================
// Helpers
// =============================================================================

const statusLen = Object.keys(StatusEffect).length / 2;

function makeCreature(x = 10, y = 10, overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x, y },
        info: {
            monsterID: MonsterType.MK_GOBLIN,
            monsterName: "goblin",
            displayChar: "g" as DisplayGlyph,
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 10,
            defense: 0,
            accuracy: 100,
            damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            turnsBetweenRegen: 20,
            movementSpeed: 100,
            attackSpeed: 100,
            bloodType: 0,
            intrinsicLightType: 0,
            DFChance: 0,
            DFType: 0,
            bolts: [],
            flags: 0,
            abilityFlags: 0,
        },
        currentHP: 10,
        movementSpeed: 100,
        attackSpeed: 100,
        turnsUntilRegen: 20,
        regenPerTurn: 0,
        ticksUntilTurn: 0,
        previousHealthPoints: 10,
        creatureState: CreatureState.TrackingScent,
        creatureMode: 0,
        mutationIndex: -1,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        status: new Array(statusLen).fill(0),
        maxStatus: new Array(statusLen).fill(0),
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
        targetCorpseLoc: { x: -1, y: -1 },
        corpseAbsorptionCounter: -1,
        targetWaypointIndex: -1,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: -1, y: -1 },
        depth: 1,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        mapToMe: null,
        safetyMap: null,
        weaknessAmount: 0,
        poisonAmount: 0,
        wasNegated: false,
        absorptionFlags: 0,
        absorbBehavior: false,
        absorptionBolt: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        machineHome: 0,
        targetCorpseName: "",
        ...overrides,
    } as Creature;
}

function makeItem(overrides: Partial<Item> = {}): Item {
    const keyLoc = Array.from({ length: KEY_ID_MAXIMUM }, () => ({
        loc: { x: 0, y: 0 }, machine: 0, disposableHere: false,
    }));
    return {
        category: 0, kind: 0, flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0, charges: 0, enchant1: 0, enchant2: 0,
        timesEnchanted: 0, vorpalEnemy: 0, strengthRequired: 0, quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON, foreColor: itemColor, inventoryColor: white,
        quantity: 1, inventoryLetter: "", inscription: "",
        loc: { x: 0, y: 0 }, keyLoc, originDepth: 1, spawnTurnNumber: 0, lastUsed: [0, 0, 0],
        nextItem: null,
        ...overrides,
    } as unknown as Item;
}

/** Build a minimal passable pmap sized [width][height]. All cells passable by default. */
function makePmap(width = 40, height = 30): Pcell[][] {
    return Array.from({ length: width }, () =>
        Array.from({ length: height }, () => ({
            layers: [0, 0, 0, 0] as unknown as number[],
            flags: 0,
            volume: 0,
            machineNumber: 0,
            rememberedAppearance: {} as Pcell["rememberedAppearance"],
            rememberedItemCategory: 0,
            rememberedItemKind: 0,
            rememberedItemQuantity: 0,
            rememberedItemOriginDepth: 0,
            rememberedTerrain: 0,
            rememberedCellFlags: 0,
            rememberedTerrainFlags: 0,
            rememberedTMFlags: 0,
            exposedToFire: 0,
        }) as Pcell),
    );
}

// =============================================================================
// lotteryDraw
// =============================================================================

describe("lotteryDraw", () => {
    it("always returns 0 for single-element array", () => {
        const rng = (lo: number, hi: number) => lo; // always min
        expect(lotteryDraw([10], rng)).toBe(0);
        expect(lotteryDraw([1], rng)).toBe(0);
    });

    it("returns 0 when randIndex falls in first bucket", () => {
        // frequencies [5, 3, 2] — total 10
        // randIndex 0..4 → 0, 5..7 → 1, 8..9 → 2
        const rng = (_lo: number, _hi: number) => 4;
        expect(lotteryDraw([5, 3, 2], rng)).toBe(0);
    });

    it("returns 1 when randIndex falls in second bucket", () => {
        const rng = (_lo: number, _hi: number) => 5;
        expect(lotteryDraw([5, 3, 2], rng)).toBe(1);
    });

    it("returns 2 when randIndex falls in last bucket", () => {
        const rng = (_lo: number, _hi: number) => 8;
        expect(lotteryDraw([5, 3, 2], rng)).toBe(2);
    });

    it("skips zero-weight entries", () => {
        // [0, 5, 0] — all valid indices map to 1
        const rng = (_lo: number, _hi: number) => 2;
        expect(lotteryDraw([0, 5, 0], rng)).toBe(1);
    });
});

// =============================================================================
// describeMonsterClass
// =============================================================================

describe("describeMonsterClass", () => {
    function makeClasses(members: MonsterType[][]): readonly MonsterClass[] {
        return members.map((ml) => ({
            name: "test-class",
            frequency: 1,
            maxDepth: 0,
            memberList: ml,
        }));
    }

    function makeMonsters(names: string[]): readonly Pick<CreatureType, "monsterName">[] {
        return names.map((monsterName) => ({ monsterName }));
    }

    it("single member: just the name", () => {
        const classes = makeClasses([[0 as MonsterType]]);
        const monsters = makeMonsters(["rat"]);
        expect(describeMonsterClass(0, true, classes, monsters)).toBe("rat");
    });

    it("two members with 'and' conjunction", () => {
        const classes = makeClasses([[0 as MonsterType, 1 as MonsterType]]);
        const monsters = makeMonsters(["rat", "goblin"]);
        expect(describeMonsterClass(0, true, classes, monsters)).toBe("rat and goblin");
    });

    it("two members with 'or' conjunction", () => {
        const classes = makeClasses([[0 as MonsterType, 1 as MonsterType]]);
        const monsters = makeMonsters(["rat", "goblin"]);
        expect(describeMonsterClass(0, false, classes, monsters)).toBe("rat or goblin");
    });

    it("three members: comma + conjunction before last", () => {
        const classes = makeClasses([[0 as MonsterType, 1 as MonsterType, 2 as MonsterType]]);
        const monsters = makeMonsters(["rat", "goblin", "troll"]);
        expect(describeMonsterClass(0, true, classes, monsters)).toBe("rat, goblin and troll");
        expect(describeMonsterClass(0, false, classes, monsters)).toBe("rat, goblin or troll");
    });
});

// =============================================================================
// keyMatchesLocation
// =============================================================================

describe("keyMatchesLocation", () => {
    it("returns false for item without ITEM_IS_KEY flag", () => {
        const item = makeItem({ flags: 0, originDepth: 1 });
        expect(keyMatchesLocation(item, { x: 5, y: 5 }, 1, 0)).toBe(false);
    });

    it("returns false when item.originDepth != depthLevel", () => {
        const item = makeItem({ flags: ItemFlag.ITEM_IS_KEY, originDepth: 2 });
        item.keyLoc[0] = { loc: { x: 5, y: 5 }, machine: 0, disposableHere: false };
        expect(keyMatchesLocation(item, { x: 5, y: 5 }, 1, 0)).toBe(false);
    });

    it("returns true when keyLoc.loc matches", () => {
        const item = makeItem({ flags: ItemFlag.ITEM_IS_KEY, originDepth: 3 });
        item.keyLoc[0] = { loc: { x: 7, y: 8 }, machine: 0, disposableHere: false };
        expect(keyMatchesLocation(item, { x: 7, y: 8 }, 3, 0)).toBe(true);
    });

    it("returns true when keyLoc.machine matches machineNumber", () => {
        const item = makeItem({ flags: ItemFlag.ITEM_IS_KEY, originDepth: 1 });
        item.keyLoc[0] = { loc: { x: 0, y: 0 }, machine: 5, disposableHere: false };
        expect(keyMatchesLocation(item, { x: 3, y: 3 }, 1, 5)).toBe(true);
    });

    it("returns false when no keyLoc entry matches", () => {
        const item = makeItem({ flags: ItemFlag.ITEM_IS_KEY, originDepth: 1 });
        item.keyLoc[0] = { loc: { x: 9, y: 9 }, machine: 3, disposableHere: false };
        expect(keyMatchesLocation(item, { x: 4, y: 4 }, 1, 7)).toBe(false);
    });
});

// =============================================================================
// monsterClassHasAcidicMonster
// =============================================================================

describe("monsterClassHasAcidicMonster", () => {
    function makeClasses(members: MonsterType[][]): readonly MonsterClass[] {
        return members.map((ml) => ({
            name: "c",
            frequency: 1,
            maxDepth: 0,
            memberList: ml,
        }));
    }
    function makeMonsters(flagsList: number[]): readonly Pick<CreatureType, "flags">[] {
        return flagsList.map((flags) => ({ flags }));
    }

    it("returns false when no member is acidic", () => {
        const classes = makeClasses([[0 as MonsterType, 1 as MonsterType]]);
        const monsters = makeMonsters([MonsterBehaviorFlag.MONST_MALE, 0]);
        expect(monsterClassHasAcidicMonster(0, classes, monsters)).toBe(false);
    });

    it("returns true when any member has MONST_DEFEND_DEGRADE_WEAPON", () => {
        const classes = makeClasses([[0 as MonsterType, 1 as MonsterType]]);
        const monsters = makeMonsters([0, MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON]);
        expect(monsterClassHasAcidicMonster(0, classes, monsters)).toBe(true);
    });

    it("returns true for first member acidic", () => {
        const classes = makeClasses([[0 as MonsterType]]);
        const monsters = makeMonsters([MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON]);
        expect(monsterClassHasAcidicMonster(0, classes, monsters)).toBe(true);
    });
});

// =============================================================================
// beckonMonster
// =============================================================================

describe("beckonMonster", () => {
    function makeCtx(
        pmap: Pcell[][],
        player: Creature,
        monsters: Creature[],
        overrides: Partial<BeckonMonsterContext> = {},
    ): BeckonMonsterContext {
        return {
            pmap,
            player,
            boltCatalog,
            freeCaptive: (m) => { m.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_CAPTIVE; },
            cellHasTerrainFlag: () => false,   // all terrain passable
            monsterAtLoc: (loc) => {
                if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
                return monsters.find((m) => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
            },
            ...overrides,
        };
    }

    it("moves monster toward target (closer position)", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const monst = makeCreature(15, 5);
        pmap[15][5].flags |= TileFlag.HAS_MONSTER;

        const ctx = makeCtx(pmap, player, [monst]);
        beckonMonster(monst, player.loc.x, player.loc.y, ctx);

        // Monster should have moved closer to the player (x should decrease)
        expect(monst.loc.x).toBeLessThan(15);
        // pmap flags: old cell cleared, new cell set
        expect(pmap[15][5].flags & TileFlag.HAS_MONSTER).toBe(0);
        expect(pmap[monst.loc.x][monst.loc.y].flags & TileFlag.HAS_MONSTER).toBeTruthy();
    });

    it("frees a captive monster before beckoning", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const monst = makeCreature(15, 5, {
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
        });
        pmap[15][5].flags |= TileFlag.HAS_MONSTER;

        const ctx = makeCtx(pmap, player, [monst]);
        beckonMonster(monst, player.loc.x, player.loc.y, ctx);

        // Captive flag should be cleared
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE).toBe(0);
    });

    it("sets ticksUntilTurn to at least player.attackSpeed + 1", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5, { attackSpeed: 100 });
        const monst = makeCreature(15, 5, { ticksUntilTurn: 0 });
        pmap[15][5].flags |= TileFlag.HAS_MONSTER;

        const ctx = makeCtx(pmap, player, [monst]);
        beckonMonster(monst, player.loc.x, player.loc.y, ctx);

        expect(monst.ticksUntilTurn).toBeGreaterThanOrEqual(player.attackSpeed + 1);
    });

    it("does not move monster if already adjacent to target", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        // Adjacent: dist = 1, magnitude = max(1, (1-2)/2) = 1, maxDist = 4
        // getImpactLoc from (6,5) toward (5,5) hits player immediately → returns (6,5)
        const monst = makeCreature(6, 5);
        pmap[6][5].flags |= TileFlag.HAS_MONSTER;

        const origLoc = { ...monst.loc };
        const ctx = makeCtx(pmap, player, [monst]);
        beckonMonster(monst, player.loc.x, player.loc.y, ctx);

        // Should not have moved (player is at destination, path blocked immediately)
        expect(monst.loc.x).toBe(origLoc.x);
        expect(monst.loc.y).toBe(origLoc.y);
    });

    it("stops before the player (creatures block path)", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const monst = makeCreature(12, 5);
        pmap[12][5].flags |= TileFlag.HAS_MONSTER;

        const ctx = makeCtx(pmap, player, [monst]);
        beckonMonster(monst, player.loc.x, player.loc.y, ctx);

        // Monster should not land on the player's cell
        expect(monst.loc.x !== player.loc.x || monst.loc.y !== player.loc.y).toBe(true);
    });
});

// =============================================================================
// itemCanBeCalled
// =============================================================================

describe("itemCanBeCalled", () => {
    it("returns true for WEAPON", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.WEAPON }))).toBe(true);
    });
    it("returns true for ARMOR", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.ARMOR }))).toBe(true);
    });
    it("returns true for SCROLL", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.SCROLL }))).toBe(true);
    });
    it("returns true for RING", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.RING }))).toBe(true);
    });
    it("returns true for POTION", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.POTION }))).toBe(true);
    });
    it("returns true for STAFF", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.STAFF }))).toBe(true);
    });
    it("returns true for WAND", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.WAND }))).toBe(true);
    });
    it("returns true for CHARM", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.CHARM }))).toBe(true);
    });
    it("returns false for FOOD", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.FOOD }))).toBe(false);
    });
    it("returns false for GOLD", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.GOLD }))).toBe(false);
    });
    it("returns false for AMULET", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.AMULET }))).toBe(false);
    });
    it("returns false for GEM", () => {
        expect(itemCanBeCalled(makeItem({ category: ItemCategory.GEM }))).toBe(false);
    });
});

// =============================================================================
// keyOnTileAt
// =============================================================================

describe("keyOnTileAt", () => {
    /** Minimal itemAtLoc: return the first floor item at loc, or null. */
    function itemAtLoc(loc: { x: number; y: number }, items: readonly Item[]): Item | null {
        return items.find(it => it.loc.x === loc.x && it.loc.y === loc.y) ?? null;
    }

    function makeKeyItem(loc: { x: number; y: number }, depthLevel = 1, machine = 0): Item {
        const item = makeItem({
            flags: ItemFlag.ITEM_IS_KEY,
            originDepth: depthLevel,
            loc: { x: loc.x, y: loc.y },
        });
        item.keyLoc[0] = { loc: { x: loc.x, y: loc.y }, machine, disposableHere: false };
        return item;
    }

    it("returns null when no key is present anywhere", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const loc = { x: 3, y: 3 };
        expect(keyOnTileAt(loc, pmap, player, [], [], [], 1, itemAtLoc)).toBeNull();
    });

    it("finds key in player pack when player is on loc", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const key = makeKeyItem({ x: 5, y: 5 }, 1, 0);
        // machine 0 → loc match required
        expect(keyOnTileAt({ x: 5, y: 5 }, pmap, player, [key], [], [], 1, itemAtLoc)).toBe(key);
    });

    it("does not find pack key when player is not on loc", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const key = makeKeyItem({ x: 3, y: 3 }, 1, 0);
        // Player is at (5,5), loc is (3,3) — pack key should not be found
        expect(keyOnTileAt({ x: 3, y: 3 }, pmap, player, [key], [], [], 1, itemAtLoc)).toBeNull();
    });

    it("finds floor item when HAS_ITEM flag is set", () => {
        const pmap = makePmap();
        const player = makeCreature(0, 0);
        const loc = { x: 7, y: 8 };
        pmap[loc.x][loc.y].flags |= TileFlag.HAS_ITEM;
        const key = makeKeyItem(loc, 1, 0);
        expect(keyOnTileAt(loc, pmap, player, [], [key], [], 1, itemAtLoc)).toBe(key);
    });

    it("does not find floor item when HAS_ITEM flag is not set", () => {
        const pmap = makePmap();
        const player = makeCreature(0, 0);
        const loc = { x: 7, y: 8 };
        // HAS_ITEM not set
        const key = makeKeyItem(loc, 1, 0);
        expect(keyOnTileAt(loc, pmap, player, [], [key], [], 1, itemAtLoc)).toBeNull();
    });

    it("finds monster carried item at loc", () => {
        const pmap = makePmap();
        const player = makeCreature(0, 0);
        const loc = { x: 4, y: 4 };
        const key = makeKeyItem(loc, 1, 0);
        const monst = makeCreature(loc.x, loc.y, { carriedItem: key });
        expect(keyOnTileAt(loc, pmap, player, [], [], [monst], 1, itemAtLoc)).toBe(key);
    });

    it("does not find monster carried item when flag is not ITEM_IS_KEY", () => {
        const pmap = makePmap();
        const player = makeCreature(0, 0);
        const loc = { x: 4, y: 4 };
        // A non-key item carried by monster
        const nonKey = makeItem({ flags: 0, originDepth: 1, loc: { x: loc.x, y: loc.y } });
        const monst = makeCreature(loc.x, loc.y, { carriedItem: nonKey });
        expect(keyOnTileAt(loc, pmap, player, [], [], [monst], 1, itemAtLoc)).toBeNull();
    });

    it("pack key takes priority over floor item", () => {
        const pmap = makePmap();
        const player = makeCreature(5, 5);
        const loc = { x: 5, y: 5 };
        pmap[loc.x][loc.y].flags |= TileFlag.HAS_ITEM;
        const packKey = makeKeyItem(loc, 1, 0);
        const floorKey = makeKeyItem(loc, 1, 0);
        // Both present — pack key should be returned first
        const result = keyOnTileAt(loc, pmap, player, [packKey], [floorKey], [], 1, itemAtLoc);
        expect(result).toBe(packKey);
    });
});
