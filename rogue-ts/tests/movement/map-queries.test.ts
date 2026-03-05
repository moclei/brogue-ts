/*
 *  map-queries.test.ts — Tests for movement/map-queries helpers
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    layerWithTMFlag,
    layerWithFlag,
    tileFlavor,
    tileText,
    storeMemories,
    discover,
    isDisturbed,
    addScentToCell,
    getLocationFlags,
    describeLocation,
    printLocationDescription,
    highestPriorityLayer,
} from "../../src/movement/map-queries.js";
import type { MapQueryContext, DescribeLocationContext } from "../../src/movement/map-queries.js";
import { DungeonLayer, CreatureState, StatusEffect, TileType, ItemCategory } from "../../src/types/enums.js";
import {
    TerrainFlag,
    TerrainMechFlag,
    TileFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    ItemFlag,
} from "../../src/types/flags.js";
import type { Pcell, Creature, Pos, Item, DungeonFeature } from "../../src/types/types.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import { NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Creates a minimal Pcell with the given tile layers.
 */
function makeCell(
    layers: TileType[] = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
    flags = 0,
): Pcell {
    return {
        layers: [...layers],
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
 * Creates a minimal 2D pmap (3x3) with floor tiles.
 */
function makePmap(width = 3, height = 3): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < width; x++) {
        pmap[x] = [];
        for (let y = 0; y < height; y++) {
            pmap[x][y] = makeCell();
        }
    }
    return pmap;
}

/**
 * Creates a minimal creature for testing.
 */
function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 1, y: 1 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 0,
            monsterName: "test creature",
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

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: ItemCategory.WEAPON,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
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
        loc: { x: 1, y: 1 },
        keyLoc: [],
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    } as Item;
}

/** Direction deltas matching ts/src/globals/tables.ts — indexed by Direction enum. */
const nbDirs: readonly [number, number][] = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
];

/**
 * Creates a minimal MapQueryContext for testing.
 */
function makeMapQueryContext(pmap: Pcell[][], overrides: Partial<MapQueryContext> = {}): MapQueryContext {
    const player = makeCreature({ loc: { x: 1, y: 1 } });
    return {
        pmap,
        player,
        rogue: { scentTurnNumber: 100, disturbed: false, automationActive: false },
        scentMap: pmap.map(col => col.map(() => 0)),
        terrainFlags: (pos: Pos) => {
            let flags = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                flags |= tileCatalog[pmap[pos.x][pos.y].layers[layer]].flags;
            }
            return flags;
        },
        terrainMechFlags: (pos: Pos) => {
            let flags = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                flags |= tileCatalog[pmap[pos.x][pos.y].layers[layer]].mechFlags;
            }
            return flags;
        },
        cellHasTerrainFlag: (pos: Pos, flag: number) => {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                if (tileCatalog[pmap[pos.x][pos.y].layers[layer]].flags & flag) return true;
            }
            return false;
        },
        cellHasTMFlag: (pos: Pos, flag: number) => {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                if (tileCatalog[pmap[pos.x][pos.y].layers[layer]].mechFlags & flag) return true;
            }
            return false;
        },
        coordinatesAreInMap: (x, y) => x >= 0 && x < pmap.length && y >= 0 && y < pmap[0].length,
        playerCanSee: () => true,
        monsterAtLoc: () => null,
        dormantMonsterAtLoc: () => null,
        canSeeMonster: () => true,
        monsterRevealed: () => false,
        spawnDungeonFeature: () => {},
        refreshDungeonCell: () => {},
        dungeonFeatureCatalog: [],
        itemAtLoc: () => null,
        nbDirs,
        ...overrides,
    };
}

// =============================================================================
// layerWithTMFlag
// =============================================================================

describe("layerWithTMFlag", () => {
    it("returns NoLayer when no layer has the flag", () => {
        const pmap = makePmap();
        expect(layerWithTMFlag(pmap, 1, 1, TerrainMechFlag.TM_IS_SECRET)).toBe(DungeonLayer.NoLayer);
    });

    it("returns the layer that has the flag", () => {
        const pmap = makePmap();
        // Find a tile type that has TM_STAND_IN_TILE mechFlag
        // DEEP_WATER has TM_ALLOWS_SUBMERGING. Let's search for a tile with a known mechFlag.
        // Use SECRET_DOOR which has TM_IS_SECRET
        pmap[1][1].layers[DungeonLayer.Dungeon] = TileType.SECRET_DOOR;
        expect(layerWithTMFlag(pmap, 1, 1, TerrainMechFlag.TM_IS_SECRET)).toBe(DungeonLayer.Dungeon);
    });
});

// =============================================================================
// layerWithFlag
// =============================================================================

describe("layerWithFlag", () => {
    it("returns NoLayer when no layer has the flag", () => {
        const pmap = makePmap(); // FLOOR has no T_OBSTRUCTS_PASSABILITY
        expect(layerWithFlag(pmap, 1, 1, TerrainFlag.T_OBSTRUCTS_PASSABILITY)).toBe(DungeonLayer.NoLayer);
    });

    it("returns the correct layer when a layer has the flag", () => {
        const pmap = makePmap();
        pmap[1][1].layers[DungeonLayer.Dungeon] = TileType.WALL;
        expect(layerWithFlag(pmap, 1, 1, TerrainFlag.T_OBSTRUCTS_PASSABILITY)).toBe(DungeonLayer.Dungeon);
    });
});

// =============================================================================
// tileFlavor / tileText
// =============================================================================

describe("tileFlavor", () => {
    it("returns the flavor text of the highest-priority tile", () => {
        const pmap = makePmap();
        const result = tileFlavor(pmap, 1, 1, highestPriorityLayer);
        expect(typeof result).toBe("string");
        // FLOOR's flavorText from tileCatalog
        expect(result).toBe(tileCatalog[TileType.FLOOR].flavorText);
    });
});

describe("tileText", () => {
    it("returns the description of the highest-priority tile", () => {
        const pmap = makePmap();
        const result = tileText(pmap, 1, 1, highestPriorityLayer);
        expect(typeof result).toBe("string");
        expect(result).toBe(tileCatalog[TileType.FLOOR].description);
    });
});

// =============================================================================
// storeMemories
// =============================================================================

describe("storeMemories", () => {
    it("saves terrain flags, TM flags, cell flags, and remembered terrain", () => {
        const pmap = makePmap();
        const cell = pmap[1][1];
        cell.flags = TileFlag.DISCOVERED;
        cell.layers[DungeonLayer.Dungeon] = TileType.FLOOR;

        const terrainFlagsFn = (pos: Pos) => tileCatalog[pmap[pos.x][pos.y].layers[DungeonLayer.Dungeon]].flags;
        const terrainMechFlagsFn = (pos: Pos) => tileCatalog[pmap[pos.x][pos.y].layers[DungeonLayer.Dungeon]].mechFlags;

        storeMemories(pmap, 1, 1, terrainFlagsFn, terrainMechFlagsFn, highestPriorityLayer);

        expect(cell.rememberedTerrainFlags).toBe(terrainFlagsFn({ x: 1, y: 1 }));
        expect(cell.rememberedTMFlags).toBe(terrainMechFlagsFn({ x: 1, y: 1 }));
        expect(cell.rememberedCellFlags).toBe(TileFlag.DISCOVERED);
        expect(cell.rememberedTerrain).toBe(TileType.FLOOR);
    });
});

// =============================================================================
// isDisturbed
// =============================================================================

describe("isDisturbed", () => {
    it("returns false when nothing interesting is adjacent", () => {
        const pmap = makePmap(5, 5);
        const ctx = makeMapQueryContext(pmap);
        expect(isDisturbed(2, 2, ctx)).toBe(false);
    });

    it("returns true when an adjacent cell has an item", () => {
        const pmap = makePmap(5, 5);
        pmap[3][2].flags |= TileFlag.HAS_ITEM;
        const ctx = makeMapQueryContext(pmap);
        expect(isDisturbed(2, 2, ctx)).toBe(true);
    });

    it("returns true when a visible non-ally monster is adjacent", () => {
        const pmap = makePmap(5, 5);
        const enemy = makeCreature({
            loc: { x: 3, y: 2 },
            creatureState: CreatureState.Wandering,
        });
        const ctx = makeMapQueryContext(pmap, {
            monsterAtLoc: (loc: Pos) =>
                loc.x === 3 && loc.y === 2 ? enemy : null,
            canSeeMonster: () => true,
        });
        expect(isDisturbed(2, 2, ctx)).toBe(true);
    });

    it("returns false when adjacent monster is an ally", () => {
        const pmap = makePmap(5, 5);
        const ally = makeCreature({
            loc: { x: 3, y: 2 },
            creatureState: CreatureState.Ally,
        });
        const ctx = makeMapQueryContext(pmap, {
            monsterAtLoc: (loc: Pos) =>
                loc.x === 3 && loc.y === 2 ? ally : null,
            canSeeMonster: () => true,
        });
        expect(isDisturbed(2, 2, ctx)).toBe(false);
    });
});

// =============================================================================
// addScentToCell
// =============================================================================

describe("addScentToCell", () => {
    it("writes scent value to cell based on scentTurnNumber - distance", () => {
        const pmap = makePmap();
        const ctx = makeMapQueryContext(pmap, {
            rogue: { scentTurnNumber: 200, disturbed: false, automationActive: false },
        });
        ctx.scentMap[1][1] = 0;

        addScentToCell(1, 1, 5, ctx);

        // value = (200 - 5) & 0xFFFF = 195
        expect(ctx.scentMap[1][1]).toBe(195);
    });

    it("takes the max of new value and existing scent", () => {
        const pmap = makePmap();
        const ctx = makeMapQueryContext(pmap, {
            rogue: { scentTurnNumber: 200, disturbed: false, automationActive: false },
        });
        ctx.scentMap[1][1] = 198;

        addScentToCell(1, 1, 5, ctx);

        // value = 195, existing = 198 → max is 198
        expect(ctx.scentMap[1][1]).toBe(198);
    });
});

// =============================================================================
// getLocationFlags
// =============================================================================

describe("getLocationFlags", () => {
    it("returns actual terrain flags when limitToPlayerKnowledge is false", () => {
        const pmap = makePmap();
        const ctx = makeMapQueryContext(pmap);
        const result = getLocationFlags(1, 1, false, ctx);
        expect(result.tFlags).toBe(ctx.terrainFlags({ x: 1, y: 1 }));
        expect(result.tmFlags).toBe(ctx.terrainMechFlags({ x: 1, y: 1 }));
        expect(result.cellFlags).toBe(pmap[1][1].flags);
    });

    it("returns remembered flags when limitToPlayerKnowledge is true, cell is discovered, and player can't see", () => {
        const pmap = makePmap();
        const cell = pmap[1][1];
        cell.flags = TileFlag.DISCOVERED;
        cell.rememberedTerrainFlags = 0xABCD;
        cell.rememberedTMFlags = 0x1234;
        cell.rememberedCellFlags = 0x5678;

        const ctx = makeMapQueryContext(pmap, {
            playerCanSee: () => false,
        });

        const result = getLocationFlags(1, 1, true, ctx);
        expect(result.tFlags).toBe(0xABCD);
        expect(result.tmFlags).toBe(0x1234);
        expect(result.cellFlags).toBe(0x5678);
    });

    it("returns actual flags when limitToPlayerKnowledge is true but player can see", () => {
        const pmap = makePmap();
        pmap[1][1].flags = TileFlag.DISCOVERED;
        const ctx = makeMapQueryContext(pmap, {
            playerCanSee: () => true,
        });

        const result = getLocationFlags(1, 1, true, ctx);
        // Should return actual flags, not remembered ones
        expect(result.tFlags).toBe(ctx.terrainFlags({ x: 1, y: 1 }));
    });
});

// =============================================================================
// discover
// =============================================================================

describe("discover", () => {
    it("does nothing when the cell has no TM_IS_SECRET flag", () => {
        const pmap = makePmap();
        const refreshSpy = vi.fn();
        const ctx = makeMapQueryContext(pmap, { refreshDungeonCell: refreshSpy });
        discover(1, 1, ctx);
        expect(refreshSpy).not.toHaveBeenCalled();
    });

    it("reveals a secret door by spawning its discover feature", () => {
        const pmap = makePmap();
        pmap[1][1].layers[DungeonLayer.Dungeon] = TileType.SECRET_DOOR;

        const refreshSpy = vi.fn();
        const spawnSpy = vi.fn();
        const dummyFeat = {} as DungeonFeature;

        // Build a fake dungeonFeatureCatalog sized large enough for discoverType
        const discoverType = tileCatalog[TileType.SECRET_DOOR].discoverType as number;
        const catalog: DungeonFeature[] = [];
        catalog[discoverType] = dummyFeat;

        const ctx = makeMapQueryContext(pmap, {
            refreshDungeonCell: refreshSpy,
            spawnDungeonFeature: spawnSpy,
            dungeonFeatureCatalog: catalog,
        });

        discover(1, 1, ctx);

        expect(refreshSpy).toHaveBeenCalledWith({ x: 1, y: 1 });
        expect(spawnSpy).toHaveBeenCalledWith(1, 1, dummyFeat, true, false);
    });

    it("sets rogue.disturbed when player can see the revealed cell", () => {
        const pmap = makePmap();
        pmap[1][1].layers[DungeonLayer.Dungeon] = TileType.SECRET_DOOR;

        const discoverType = tileCatalog[TileType.SECRET_DOOR].discoverType as number;
        const catalog: DungeonFeature[] = [];
        catalog[discoverType] = {} as DungeonFeature;

        const ctx = makeMapQueryContext(pmap, {
            playerCanSee: () => true,
            dungeonFeatureCatalog: catalog,
        });

        discover(1, 1, ctx);

        expect(ctx.rogue.disturbed).toBe(true);
    });
});

// =============================================================================
// describeLocation
// =============================================================================

function makeDescribeCtx(
    pmap: Pcell[][],
    overrides: Partial<DescribeLocationContext> = {},
): DescribeLocationContext {
    const base = makeMapQueryContext(pmap);
    return {
        ...base,
        playerCanSeeOrSense: () => true,
        playerCanDirectlySee: () => true,
        itemAtLoc: () => null,
        dormantMonsterAtLoc: () => null,
        itemMagicPolarity: () => 0,
        monsterName: (m: Creature, article: boolean) => article ? "a goblin" : "goblin",
        monsterCanSubmergeNow: () => false,
        describedItemName: (item: Item, maxLen: number) => "a short sword",
        describedItemBasedOnParameters: () => "an item",
        describeHallucinatedItem: () => "a psychedelic thingy",
        cosmeticRandRange: (lo: number, hi: number) => lo,
        playbackOmniscience: false,
        flavorMessage: () => {},
        ...overrides,
    };
}

describe("describeLocation", () => {
    it("describes player location with no item using tileFlavor", () => {
        const pmap = makePmap();
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        const ctx = makeDescribeCtx(pmap, { player });

        const result = describeLocation(1, 1, ctx);
        // Should return the tileFlavor for FLOOR
        expect(result).toBe(tileCatalog[TileType.FLOOR].flavorText);
    });

    it("describes levitating player", () => {
        const pmap = makePmap();
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        player.status[StatusEffect.Levitating] = 10;
        const ctx = makeDescribeCtx(pmap, { player });

        const result = describeLocation(1, 1, ctx);
        expect(result).toContain("you are hovering above");
        expect(result).toContain(tileCatalog[TileType.FLOOR].description);
    });

    it("describes magic-detected item aura (benevolent)", () => {
        const pmap = makePmap();
        const theItem = makeItem({ flags: ItemFlag.ITEM_MAGIC_DETECTED });
        const player = makeCreature({ loc: { x: 0, y: 0 } }); // player not at 1,1

        const ctx = makeDescribeCtx(pmap, {
            player,
            playerCanSeeOrSense: () => false,
            itemAtLoc: (loc: Pos) => loc.x === 1 && loc.y === 1 ? theItem : null,
            itemMagicPolarity: () => 1,
        });

        const result = describeLocation(1, 1, ctx);
        expect(result).toBe("you can detect the aura of benevolent magic here.");
    });

    it("describes magic-detected item aura (malevolent)", () => {
        const pmap = makePmap();
        const theItem = makeItem({ flags: ItemFlag.ITEM_MAGIC_DETECTED });
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            playerCanSeeOrSense: () => false,
            itemAtLoc: (loc: Pos) => loc.x === 1 && loc.y === 1 ? theItem : null,
            itemMagicPolarity: () => -1,
        });

        const result = describeLocation(1, 1, ctx);
        expect(result).toBe("you can detect the aura of malevolent magic here.");
    });

    it("describes telepathically sensed monster", () => {
        const pmap = makePmap();
        pmap[1][1].flags = TileFlag.DISCOVERED;
        const monst = makeCreature({ loc: { x: 1, y: 1 } });
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            monsterAtLoc: (loc: Pos) => loc.x === 1 && loc.y === 1 ? monst : null,
            canSeeMonster: () => false,
            monsterRevealed: () => true,
            itemAtLoc: () => null,
        });
        pmap[1][1].flags |= TileFlag.HAS_MONSTER;

        const result = describeLocation(1, 1, ctx);
        expect(result).toContain("you can sense a");
        expect(result).toContain("psychic emanation");
    });

    it("describes remembered cell from memory", () => {
        const pmap = makePmap();
        pmap[1][1].flags = TileFlag.DISCOVERED;
        pmap[1][1].rememberedTerrain = TileType.FLOOR;
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            playerCanSeeOrSense: () => false,
            canSeeMonster: () => false,
        });

        const result = describeLocation(1, 1, ctx);
        expect(result).toContain("you remember seeing");
    });

    it("describes just terrain when no monster or item", () => {
        const pmap = makePmap();
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            playerCanDirectlySee: () => true,
        });

        const result = describeLocation(1, 1, ctx);
        expect(result).toContain("you see");
        expect(result).toContain(tileCatalog[TileType.FLOOR].description);
    });

    it("describes a visible monster standing on terrain", () => {
        const pmap = makePmap();
        pmap[1][1].flags = TileFlag.HAS_MONSTER;
        const monst = makeCreature({
            loc: { x: 1, y: 1 },
            creatureState: CreatureState.Wandering,
        });
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            monsterAtLoc: (loc: Pos) => loc.x === 1 && loc.y === 1 ? monst : null,
            canSeeMonster: () => true,
        });

        const result = describeLocation(1, 1, ctx);
        expect(result).toContain("a goblin");
        expect(result).toContain("is");
    });

    it("describes an item on the ground with no monster", () => {
        const pmap = makePmap();
        const theItem = makeItem({ quantity: 1, category: ItemCategory.WEAPON });
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            itemAtLoc: (loc: Pos) => loc.x === 1 && loc.y === 1 ? theItem : null,
            describedItemName: () => "a short sword",
        });

        const result = describeLocation(1, 1, ctx);
        expect(result).toContain("a short sword");
        expect(result).toContain("lying");
    });
});

// =============================================================================
// printLocationDescription
// =============================================================================

describe("printLocationDescription", () => {
    it("calls flavorMessage with the description", () => {
        const pmap = makePmap();
        const flavorSpy = vi.fn();
        const player = makeCreature({ loc: { x: 0, y: 0 } });

        const ctx = makeDescribeCtx(pmap, {
            player,
            flavorMessage: flavorSpy,
        });

        printLocationDescription(1, 1, ctx);

        expect(flavorSpy).toHaveBeenCalledTimes(1);
        expect(typeof flavorSpy.mock.calls[0][0]).toBe("string");
    });
});
