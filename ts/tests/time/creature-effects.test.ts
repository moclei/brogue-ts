/*
 *  creature-effects.test.ts — Tests for creature status effects and tile interactions
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    exposeCreatureToFire,
    extinguishFireOnCreature,
    monsterShouldFall,
    discoverCell,
    demoteVisibility,
    armorStealthAdjustment,
    currentStealthRange,
    checkNutrition,
    burnItem,
    updateFlavorText,
    updatePlayerUnderwaterness,
    decrementPlayerStatus,
    playerFalls,
    monstersFall,
    applyInstantTileEffectsToCreature,
    applyGradualTileEffectsToCreature,
} from "../../src/time/creature-effects.js";
import type { CreatureEffectsContext } from "../../src/time/creature-effects.js";
import { StatusEffect, CreatureState, DungeonLayer, TileType, ArmorEnchant } from "../../src/types/enums.js";
import {
    TileFlag,
    TerrainFlag,
    TerrainMechFlag,
    ItemFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
} from "../../src/types/flags.js";
import type { Creature, Pcell, Tcell, Pos, Item, Color, LevelData, FloorTileType, DungeonFeature } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

const dummyColor: Color = { red: 0, green: 0, blue: 0, rand: 0, colorDances: false };

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: 0,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quantity: 1,
        inventoryLetter: "a",
        inventoryColor: dummyColor,
        inscription: "",
        originDepth: 1,
        keyLoc: [],
        loc: { x: 0, y: 0 },
        ...overrides,
    } as Item;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        depth: 1,
        status: new Array(60).fill(0),
        maxStatus: new Array(60).fill(0),
        info: {
            flags: 0,
            abilityFlags: 0,
            maxHP: 20,
            movementSpeed: 100,
            attackSpeed: 100,
            turnsBetweenRegen: 300,
            DFChance: 0,
            DFType: 0,
            foreColor: dummyColor,
        },
        currentHP: 10,
        previousHealthPoints: 10,
        bookkeepingFlags: 0,
        creatureState: CreatureState.Ally,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        ticksUntilTurn: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        turnsUntilRegen: 300,
        regenPerTurn: 0,
        xpxp: 0,
        poisonAmount: 0,
        machineHome: 0,
        spawnDepth: 1,
        turnsSpentStationary: 0,
        weaknessAmount: 0,
        flashStrength: 0,
        flashColor: dummyColor,
        ...overrides,
    } as Creature;
}

function makeCell(overrides: Partial<Pcell> = {}): Pcell {
    return {
        layers: [1, 0, 0, 0],
        flags: 0,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: 0,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
        ...overrides,
    };
}

const DCOLS = 10;
const DROWS = 10;

function makeTileCatalog(): FloorTileType[] {
    const tiles: FloorTileType[] = [];
    for (let i = 0; i < 100; i++) {
        tiles.push({
            displayChar: 0,
            foreColor: dummyColor,
            backColor: dummyColor,
            drawPriority: 0,
            chanceToIgnite: 0,
            fireType: 0,
            discoverType: 0,
            promoteType: 0,
            promoteChance: 0,
            glowLight: 0 as any,
            flags: 0,
            mechFlags: 0,
            description: "tile",
            flavorText: "you see a tile.",
        });
    }
    return tiles;
}

function makeCtx(overrides: Partial<CreatureEffectsContext> = {}): CreatureEffectsContext {
    const player = makeCreature({ loc: { x: 5, y: 5 } });
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = makeCell();
        }
    }
    const tmap: Tcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        tmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            tmap[x][y] = { light: [0, 0, 0] };
        }
    }

    const tileCatalog = makeTileCatalog();
    const dungeonFeatureCatalog: DungeonFeature[] = [];
    for (let i = 0; i < 100; i++) {
        dungeonFeatureCatalog.push({} as DungeonFeature);
    }

    return {
        player,
        rogue: {
            weapon: null,
            armor: null,
            disturbed: false,
            automationActive: false,
            autoPlayingLevel: false,
            gameHasEnded: false,
            depthLevel: 1,
            deepestLevel: 1,
            staleLoopMap: false,
            inWater: false,
            previousPoisonPercent: 0,
            playbackMode: false,
            minersLight: { lightColor: null },
            monsterSpawnFuse: 100,
            stealthBonus: 0,
            awarenessBonus: 0,
            justRested: false,
            flares: [],
            flareCount: 0,
            yendorWarden: null,
        },
        monsters: [],
        pmap,
        tmap,
        levels: [],
        gameConst: {
            deepestLevel: 26,
            fallDamageMin: 8,
            fallDamageMax: 10,
        } as any,
        tileCatalog,
        dungeonFeatureCatalog,
        packItems: [],
        floorItems: [],
        DCOLS,
        DROWS,
        INVALID_POS: { x: -1, y: -1 },

        // Map helpers
        cellHasTerrainFlag: vi.fn(() => false),
        cellHasTMFlag: vi.fn(() => false),
        terrainFlags: vi.fn(() => 0),
        pmapAt: vi.fn((loc: Pos) => pmap[loc.x][loc.y]),
        coordinatesAreInMap: vi.fn(() => true),
        playerCanSee: vi.fn(() => true),
        playerCanSeeOrSense: vi.fn(() => true),

        // Monster helpers
        canSeeMonster: vi.fn(() => true),
        canDirectlySeeMonster: vi.fn(() => true),
        monsterName: vi.fn((buf: string[], monst: Creature) => { buf[0] = "the monster"; }),
        monsterAtLoc: vi.fn(() => null),
        monstersAreEnemies: vi.fn(() => false),
        monsterIsInClass: vi.fn(() => false),
        removeCreature: vi.fn(() => true),
        prependCreature: vi.fn(),
        demoteMonsterFromLeadership: vi.fn(),

        // Item helpers
        itemName: vi.fn((theItem: Item, buf: string[]) => { buf[0] = "an item"; }),
        numberOfMatchingPackItems: vi.fn(() => 0),
        autoIdentify: vi.fn(),
        removeItemFromChain: vi.fn(),
        deleteItem: vi.fn(),
        dropItem: vi.fn(() => null),
        eat: vi.fn(),
        makeMonsterDropItem: vi.fn(),

        // Combat
        inflictDamage: vi.fn(() => false),
        killCreature: vi.fn(),
        combatMessage: vi.fn(),
        messageColorFromVictim: vi.fn(() => dummyColor),
        addPoison: vi.fn(),
        flashMonster: vi.fn(),

        // UI
        message: vi.fn(),
        messageWithColor: vi.fn(),
        flavorMessage: vi.fn(),
        refreshDungeonCell: vi.fn(),
        gameOver: vi.fn(),
        flashMessage: vi.fn(),
        confirmMessages: vi.fn(),
        displayLevel: vi.fn(),

        // Colors
        goodMessageColor: dummyColor,
        badMessageColor: dummyColor,
        itemMessageColor: dummyColor,
        fireForeColor: { red: 255, green: 50, blue: 0, rand: 0, colorDances: false },
        torchLightColor: { red: 200, green: 100, blue: 0, rand: 0, colorDances: false },
        minersLightColor: { red: 180, green: 180, blue: 180, rand: 0, colorDances: false },
        white: { red: 255, green: 255, blue: 255, rand: 0, colorDances: false },
        brown: dummyColor,
        green: dummyColor,
        red: dummyColor,
        orange: dummyColor,
        yellow: dummyColor,
        pink: dummyColor,
        confusionGasColor: dummyColor,
        darkRed: dummyColor,
        darkGreen: dummyColor,

        // Environment
        updateVision: vi.fn(),
        updateMinersLightRadius: vi.fn(),
        spawnDungeonFeature: vi.fn(),
        promoteTile: vi.fn(),
        exposeTileToFire: vi.fn(),
        startLevel: vi.fn(),
        teleport: vi.fn(),
        createFlare: vi.fn(),
        animateFlares: vi.fn(),
        spawnPeriodicHorde: vi.fn(),
        monstersFall: vi.fn(),
        updateFloorItems: vi.fn(),
        synchronizePlayerTimeState: vi.fn(),
        recalculateEquipmentBonuses: vi.fn(),
        updateEncumbrance: vi.fn(),
        playerInDarkness: vi.fn(() => false),
        playerTurnEnded: vi.fn(),

        // Movement/search
        keyOnTileAt: vi.fn(() => null),
        useKeyAt: vi.fn(),
        discover: vi.fn(),
        discoverCell: vi.fn(),
        search: vi.fn(() => false),
        recordKeystroke: vi.fn(),

        // Map query functions
        layerWithFlag: vi.fn(() => 0),
        highestPriorityLayer: vi.fn(() => DungeonLayer.Dungeon),
        describeLocation: vi.fn((buf: string[]) => { buf[0] = "you see nothing special."; }),
        tileFlavor: vi.fn(() => "tile flavor"),

        // Math
        rand_range: vi.fn((lo: number, hi: number) => lo),
        rand_percent: vi.fn(() => false),
        randClumpedRange: vi.fn((lo: number, hi: number) => lo),
        max: Math.max,
        min: Math.min,

        // RNG control
        assureCosmeticRNG: vi.fn(),
        restoreRNG: vi.fn(),

        // Misc
        mapToWindowX: vi.fn((x: number) => x),
        mapToWindowY: vi.fn((y: number) => y),
        strLenWithoutEscapes: vi.fn((s: string) => s.length),
        COLS: 80,
        REQUIRE_ACKNOWLEDGMENT: 1,
        HUNGER_THRESHOLD: 300,
        WEAK_THRESHOLD: 150,
        FAINT_THRESHOLD: 50,
        ALL_ITEMS: 0xFFFF,
        AMULET: 0x200,
        FOOD: 0x01,
        FRUIT: 1,
        ARMOR: 0x08,
        RING: 0x20,
        GENERIC_FLASH_LIGHT: 0,
        ANY_KIND_OF_VISIBLE: TileFlag.VISIBLE | TileFlag.CLAIRVOYANT_VISIBLE | TileFlag.TELEPATHIC_VISIBLE,
        DISCOVERED: TileFlag.DISCOVERED,
        ITEM_DETECTED: TileFlag.ITEM_DETECTED,
        HAS_ITEM: TileFlag.HAS_ITEM,
        SEARCHED_FROM_HERE: TileFlag.SEARCHED_FROM_HERE,
        IS_IN_SHADOW: TileFlag.IS_IN_SHADOW,
        armorTable: [
            { strengthRequired: 10 },
            { strengthRequired: 12 },
            { strengthRequired: 13 },
            { strengthRequired: 15 },
            { strengthRequired: 17 },
            { strengthRequired: 19 },
        ],

        ...overrides,
    } as unknown as CreatureEffectsContext;
}

// =============================================================================
// exposeCreatureToFire
// =============================================================================

describe("exposeCreatureToFire", () => {
    it("sets burning status to 7 on a non-burning creature", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(7);
        expect(monst.maxStatus[StatusEffect.Burning]).toBe(7);
    });

    it("keeps burning status if already higher", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        monst.status[StatusEffect.Burning] = 10;
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(10);
    });

    it("does not affect creatures that are dying", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DYING });
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("does not affect fire-immune creatures", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        monst.status[StatusEffect.ImmuneToFire] = 10;
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("does not affect invulnerable creatures", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        monst.info.flags = MonsterBehaviorFlag.MONST_INVULNERABLE;
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("does not affect submerged creatures", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_SUBMERGED });
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("does not ignite non-levitating creatures on water", () => {
        const ctx = makeCtx();
        (ctx.cellHasTMFlag as any).mockReturnValue(true);
        const monst = makeCreature();
        monst.status[StatusEffect.Levitating] = 0;
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("ignites levitating creatures even on water", () => {
        const ctx = makeCtx();
        (ctx.cellHasTMFlag as any).mockReturnValue(true);
        const monst = makeCreature();
        monst.status[StatusEffect.Levitating] = 5;
        exposeCreatureToFire(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(7);
    });

    it("shows combat message for player catching fire", () => {
        const ctx = makeCtx();
        exposeCreatureToFire(ctx.player, ctx);
        expect(ctx.combatMessage).toHaveBeenCalledWith("you catch fire", ctx.badMessageColor);
        expect(ctx.rogue.minersLight.lightColor).toBe(ctx.fireForeColor);
    });

    it("shows combat message for visible monster catching fire", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        exposeCreatureToFire(monst, ctx);
        expect(ctx.combatMessage).toHaveBeenCalledWith(
            expect.stringContaining("catches fire"),
            expect.anything(),
        );
    });
});

// =============================================================================
// extinguishFireOnCreature
// =============================================================================

describe("extinguishFireOnCreature", () => {
    it("clears burning status", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        monst.status[StatusEffect.Burning] = 5;
        extinguishFireOnCreature(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("resets player light colors when player is extinguished", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Burning] = 5;
        ctx.rogue.minersLight.lightColor = ctx.fireForeColor;
        extinguishFireOnCreature(ctx.player, ctx);
        expect(ctx.player.info.foreColor).toBe(ctx.white);
        expect(ctx.rogue.minersLight.lightColor).toBe(ctx.minersLightColor);
        expect(ctx.message).toHaveBeenCalledWith("you are no longer on fire.", 0);
    });
});

// =============================================================================
// monsterShouldFall
// =============================================================================

describe("monsterShouldFall", () => {
    it("returns true for non-levitating creature on auto-descent tile", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_AUTO_DESCENT);
        });
        const monst = makeCreature();
        expect(monsterShouldFall(monst, ctx)).toBe(true);
    });

    it("returns false for levitating creatures", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockReturnValue(true);
        const monst = makeCreature();
        monst.status[StatusEffect.Levitating] = 5;
        expect(monsterShouldFall(monst, ctx)).toBe(false);
    });

    it("returns false for preplaced creatures", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_AUTO_DESCENT);
        });
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_PREPLACED });
        expect(monsterShouldFall(monst, ctx)).toBe(false);
    });

    it("returns false for entangled creatures", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            // Auto descent and entanglement
            return !!(flag & (TerrainFlag.T_AUTO_DESCENT | TerrainFlag.T_ENTANGLES));
        });
        const monst = makeCreature();
        expect(monsterShouldFall(monst, ctx)).toBe(false);
    });
});

// =============================================================================
// discoverCell
// =============================================================================

describe("discoverCell", () => {
    it("sets DISCOVERED flag on the cell", () => {
        const ctx = makeCtx();
        discoverCell(3, 3, ctx);
        expect(ctx.pmap[3][3].flags & TileFlag.DISCOVERED).toBeTruthy();
    });

    it("clears STABLE_MEMORY flag", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.STABLE_MEMORY;
        discoverCell(3, 3, ctx);
        expect(ctx.pmap[3][3].flags & TileFlag.STABLE_MEMORY).toBeFalsy();
    });

    it("does not re-increment xpxpThisTurn for already-discovered cells", () => {
        const ctx = makeCtx();
        ctx.pmap[3][3].flags = TileFlag.DISCOVERED;
        (ctx.rogue as any).xpxpThisTurn = 5;
        discoverCell(3, 3, ctx);
        expect((ctx.rogue as any).xpxpThisTurn).toBe(5);
    });
});

// =============================================================================
// demoteVisibility
// =============================================================================

describe("demoteVisibility", () => {
    it("converts VISIBLE to WAS_VISIBLE", () => {
        const ctx = makeCtx();
        ctx.pmap[2][3].flags = TileFlag.VISIBLE;
        demoteVisibility(ctx);
        expect(ctx.pmap[2][3].flags & TileFlag.VISIBLE).toBeFalsy();
        expect(ctx.pmap[2][3].flags & TileFlag.WAS_VISIBLE).toBeTruthy();
    });

    it("clears WAS_VISIBLE from cells that were not VISIBLE", () => {
        const ctx = makeCtx();
        ctx.pmap[2][3].flags = TileFlag.WAS_VISIBLE;
        demoteVisibility(ctx);
        expect(ctx.pmap[2][3].flags & TileFlag.WAS_VISIBLE).toBeFalsy();
    });

    it("handles empty grid without error", () => {
        const ctx = makeCtx();
        expect(() => demoteVisibility(ctx)).not.toThrow();
    });
});

// =============================================================================
// armorStealthAdjustment
// =============================================================================

describe("armorStealthAdjustment", () => {
    it("returns 0 for null armor", () => {
        const ctx = makeCtx();
        expect(armorStealthAdjustment(null, ctx)).toBe(0);
    });

    it("returns 0 for armor with strength <= 12", () => {
        const ctx = makeCtx();
        const armor = makeItem({ category: ctx.ARMOR, kind: 1 }); // strength 12
        expect(armorStealthAdjustment(armor, ctx)).toBe(0);
    });

    it("returns positive value for heavy armor (strength > 12)", () => {
        const ctx = makeCtx();
        const armor = makeItem({ category: ctx.ARMOR, kind: 3 }); // strength 15
        expect(armorStealthAdjustment(armor, ctx)).toBe(3);
    });
});

// =============================================================================
// currentStealthRange
// =============================================================================

describe("currentStealthRange", () => {
    it("returns 1 when invisible", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Invisible] = 10;
        expect(currentStealthRange(ctx)).toBe(1);
    });

    it("returns base 14 under normal conditions", () => {
        const ctx = makeCtx();
        expect(currentStealthRange(ctx)).toBe(14);
    });

    it("halves range in darkness", () => {
        const ctx = makeCtx();
        (ctx.playerInDarkness as any).mockReturnValue(true);
        expect(currentStealthRange(ctx)).toBe(7);
    });

    it("halves again when in shadow", () => {
        const ctx = makeCtx();
        (ctx.playerInDarkness as any).mockReturnValue(true);
        ctx.pmap[5][5].flags |= TileFlag.IS_IN_SHADOW;
        (ctx.pmapAt as any).mockReturnValue(ctx.pmap[5][5]);
        expect(currentStealthRange(ctx)).toBe(3); // floor(7/2) = 3
    });

    it("reduces range when just rested", () => {
        const ctx = makeCtx();
        ctx.rogue.justRested = true;
        expect(currentStealthRange(ctx)).toBe(Math.floor((14 + 1) / 2)); // 7
    });

    it("increases range for aggravating status", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Aggravating] = 5;
        expect(currentStealthRange(ctx)).toBe(14 + 5);
    });

    it("decreases range for stealth bonus", () => {
        const ctx = makeCtx();
        ctx.rogue.stealthBonus = 6;
        expect(currentStealthRange(ctx)).toBe(14 - 6);
    });

    it("clamps minimum to 2 when not resting", () => {
        const ctx = makeCtx();
        ctx.rogue.stealthBonus = 20;
        expect(currentStealthRange(ctx)).toBe(2);
    });

    it("clamps minimum to 1 when resting", () => {
        const ctx = makeCtx();
        ctx.rogue.justRested = true;
        ctx.rogue.stealthBonus = 20;
        const result = currentStealthRange(ctx);
        expect(result).toBe(1);
    });
});

// =============================================================================
// checkNutrition
// =============================================================================

describe("checkNutrition", () => {
    it("shows hungry message at HUNGER_THRESHOLD", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Nutrition] = ctx.HUNGER_THRESHOLD;
        checkNutrition(ctx);
        expect(ctx.message).toHaveBeenCalledWith(expect.stringContaining("hungry"), expect.anything());
        expect(ctx.player.status[StatusEffect.Nutrition]).toBe(ctx.HUNGER_THRESHOLD - 1);
    });

    it("shows weak message at WEAK_THRESHOLD", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Nutrition] = ctx.WEAK_THRESHOLD;
        checkNutrition(ctx);
        expect(ctx.message).toHaveBeenCalledWith(expect.stringContaining("weak"), expect.anything());
    });

    it("shows faint message at FAINT_THRESHOLD", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Nutrition] = ctx.FAINT_THRESHOLD;
        checkNutrition(ctx);
        expect(ctx.message).toHaveBeenCalledWith(expect.stringContaining("faint"), expect.anything());
    });

    it("shows starving message when nutrition reaches 1", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Nutrition] = 1;
        checkNutrition(ctx);
        expect(ctx.message).toHaveBeenCalledWith(expect.stringContaining("starving"), expect.anything());
    });

    it("adds 'and have no food' when no food in pack", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Nutrition] = ctx.HUNGER_THRESHOLD;
        (ctx.numberOfMatchingPackItems as any).mockReturnValue(0);
        checkNutrition(ctx);
        expect(ctx.message).toHaveBeenCalledWith(expect.stringContaining("no food"), expect.anything());
    });
});

// =============================================================================
// burnItem
// =============================================================================

describe("burnItem", () => {
    it("removes item and spawns fire DF", () => {
        const ctx = makeCtx();
        const theItem = makeItem({ loc: { x: 3, y: 4 } });
        ctx.pmap[3][4].flags |= TileFlag.HAS_ITEM;
        burnItem(theItem, ctx);
        expect(ctx.removeItemFromChain).toHaveBeenCalledWith(theItem, ctx.floorItems);
        expect(ctx.deleteItem).toHaveBeenCalledWith(theItem);
        expect(ctx.pmap[3][4].flags & TileFlag.HAS_ITEM).toBeFalsy();
        expect(ctx.spawnDungeonFeature).toHaveBeenCalled();
    });

    it("shows message when player can see location", () => {
        const ctx = makeCtx();
        const theItem = makeItem({ loc: { x: 3, y: 4 } });
        ctx.pmap[3][4].flags |= TileFlag.VISIBLE;
        burnItem(theItem, ctx);
        expect(ctx.messageWithColor).toHaveBeenCalledWith(
            expect.stringContaining("burns up"),
            ctx.itemMessageColor,
            0,
        );
    });
});

// =============================================================================
// updateFlavorText
// =============================================================================

describe("updateFlavorText", () => {
    it("does nothing when not disturbed", () => {
        const ctx = makeCtx();
        ctx.rogue.disturbed = false;
        updateFlavorText(ctx);
        expect(ctx.flavorMessage).not.toHaveBeenCalled();
    });

    it("shows tile flavor when disturbed", () => {
        const ctx = makeCtx();
        ctx.rogue.disturbed = true;
        updateFlavorText(ctx);
        expect(ctx.flavorMessage).toHaveBeenCalledWith("tile flavor");
    });

    it("shows levitation description when levitating", () => {
        const ctx = makeCtx();
        ctx.rogue.disturbed = true;
        ctx.player.status[StatusEffect.Levitating] = 5;
        updateFlavorText(ctx);
        expect(ctx.describeLocation).toHaveBeenCalled();
        expect(ctx.flavorMessage).toHaveBeenCalledWith("you see nothing special.");
    });
});

// =============================================================================
// updatePlayerUnderwaterness
// =============================================================================

describe("updatePlayerUnderwaterness", () => {
    it("sets inWater when on deep water", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = false;
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_DEEP_WATER);
        });
        updatePlayerUnderwaterness(ctx);
        expect(ctx.rogue.inWater).toBe(true);
        expect(ctx.updateMinersLightRadius).toHaveBeenCalled();
    });

    it("clears inWater when no longer on deep water", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = true;
        (ctx.cellHasTerrainFlag as any).mockReturnValue(false);
        updatePlayerUnderwaterness(ctx);
        expect(ctx.rogue.inWater).toBe(false);
    });

    it("prevents underwater when levitating", () => {
        const ctx = makeCtx();
        ctx.rogue.inWater = false;
        ctx.player.status[StatusEffect.Levitating] = 5;
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_DEEP_WATER);
        });
        updatePlayerUnderwaterness(ctx);
        expect(ctx.rogue.inWater).toBe(false);
    });
});

// =============================================================================
// decrementPlayerStatus
// =============================================================================

describe("decrementPlayerStatus", () => {
    it("decrements telepathic status and updates vision when it expires", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Telepathic] = 1;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Telepathic]).toBe(0);
        expect(ctx.updateVision).toHaveBeenCalledWith(true);
        expect(ctx.message).toHaveBeenCalledWith("your preternatural mental sensitivity fades.", 0);
    });

    it("decrements darkness and calls updateMinersLightRadius", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Darkness] = 3;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Darkness]).toBe(2);
        expect(ctx.updateMinersLightRadius).toHaveBeenCalled();
    });

    it("shows message when darkness expires", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Darkness] = 1;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Darkness]).toBe(0);
        expect(ctx.message).toHaveBeenCalledWith(
            "the cloak of darkness lifts from your vision.",
            0,
        );
    });

    it("decrements haste and restores speed when it expires", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Hasted] = 1;
        ctx.player.movementSpeed = 50;
        ctx.player.attackSpeed = 50;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Hasted]).toBe(0);
        expect(ctx.player.movementSpeed).toBe(ctx.player.info.movementSpeed);
        expect(ctx.player.attackSpeed).toBe(ctx.player.info.attackSpeed);
        expect(ctx.synchronizePlayerTimeState).toHaveBeenCalled();
    });

    it("decrements weakness and resets weakness amount", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Weakened] = 1;
        ctx.player.weaknessAmount = 5;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Weakened]).toBe(0);
        expect(ctx.player.weaknessAmount).toBe(0);
        expect(ctx.updateEncumbrance).toHaveBeenCalled();
    });

    it("decrements shielded gradually", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Shielded] = 100;
        ctx.player.maxStatus[StatusEffect.Shielded] = 100;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Shielded]).toBe(95); // 100 - floor(100/20) = 95
    });

    it("clears shielded when it drops to zero or below", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Shielded] = 3;
        ctx.player.maxStatus[StatusEffect.Shielded] = 100;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Shielded]).toBe(0);
        expect(ctx.player.maxStatus[StatusEffect.Shielded]).toBe(0);
    });

    it("does not decrement nutrition when paralyzed", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Nutrition] = 500;
        ctx.player.status[StatusEffect.Paralyzed] = 2;
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Nutrition]).toBe(500);
        // But paralyzed itself decrements
        expect(ctx.player.status[StatusEffect.Paralyzed]).toBe(1);
    });

    it("spawns horde when monsterSpawnFuse runs out", () => {
        const ctx = makeCtx();
        ctx.rogue.monsterSpawnFuse = -1;
        decrementPlayerStatus(ctx);
        expect(ctx.spawnPeriodicHorde).toHaveBeenCalled();
        // Fuse reset
        expect(ctx.rogue.monsterSpawnFuse).toBeGreaterThan(0);
    });

    it("clears stuck when terrain no longer entangles", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Stuck] = 5;
        (ctx.cellHasTerrainFlag as any).mockReturnValue(false);
        decrementPlayerStatus(ctx);
        expect(ctx.player.status[StatusEffect.Stuck]).toBe(0);
    });
});

// =============================================================================
// playerFalls
// =============================================================================

describe("playerFalls", () => {
    it("increments depth level and calls startLevel", () => {
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 3;
        ctx.gameConst.deepestLevel = 26;
        playerFalls(ctx);
        expect(ctx.rogue.depthLevel).toBe(4);
        expect(ctx.startLevel).toHaveBeenCalledWith(3, 0);
    });

    it("clears falling/seized/seizing flags", () => {
        const ctx = makeCtx();
        ctx.player.bookkeepingFlags = MonsterBookkeepingFlag.MB_IS_FALLING | MonsterBookkeepingFlag.MB_SEIZED;
        ctx.rogue.depthLevel = 3;
        ctx.gameConst.deepestLevel = 26;
        playerFalls(ctx);
        expect(ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING).toBeFalsy();
        expect(ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED).toBeFalsy();
    });

    it("teleports when at deepest level", () => {
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 26;
        ctx.gameConst.deepestLevel = 26;
        playerFalls(ctx);
        expect(ctx.teleport).toHaveBeenCalled();
        expect(ctx.rogue.depthLevel).toBe(26); // No change
    });

    it("inflicts fall damage", () => {
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 3;
        ctx.gameConst.deepestLevel = 26;
        playerFalls(ctx);
        expect(ctx.inflictDamage).toHaveBeenCalled();
    });

    it("triggers game over if fall damage kills player", () => {
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 3;
        ctx.gameConst.deepestLevel = 26;
        (ctx.inflictDamage as any).mockReturnValue(true);
        playerFalls(ctx);
        expect(ctx.killCreature).toHaveBeenCalledWith(ctx.player, false);
        expect(ctx.gameOver).toHaveBeenCalledWith("Killed by a fall", true);
    });

    it("updates deepestLevel if applicable", () => {
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 5;
        ctx.rogue.deepestLevel = 5;
        ctx.gameConst.deepestLevel = 26;
        playerFalls(ctx);
        expect(ctx.rogue.deepestLevel).toBe(6);
    });

    it("sets disturbed flag", () => {
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 3;
        ctx.gameConst.deepestLevel = 26;
        playerFalls(ctx);
        expect(ctx.rogue.disturbed).toBe(true);
    });
});

// =============================================================================
// monstersFall
// =============================================================================

describe("monstersFall", () => {
    it("flags falling monsters and processes them", () => {
        const ctx = makeCtx();
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_FALLING,
            loc: { x: 3, y: 3 },
        });
        ctx.monsters.push(monst);
        monstersFall(ctx);
        // Monster should be processed (killed or transferred)
        expect(ctx.inflictDamage).toHaveBeenCalled();
    });

    it("removes monster from current level on survival", () => {
        const ctx = makeCtx();
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_FALLING,
            loc: { x: 3, y: 3 },
        });
        ctx.monsters.push(monst);
        ctx.levels[1] = { visited: true, monsters: [], dormantMonsters: [], items: [], scentMap: null, mapStorage: [], levelSeed: 0n, upStairsLoc: { x: 0, y: 0 }, downStairsLoc: { x: 0, y: 0 }, playerExitedVia: { x: 0, y: 0 } };
        (ctx.inflictDamage as any).mockReturnValue(false);
        monstersFall(ctx);
        expect(ctx.removeCreature).toHaveBeenCalledWith(ctx.monsters, monst);
        expect(ctx.prependCreature).toHaveBeenCalled();
    });

    it("kills monsters that take lethal fall damage", () => {
        const ctx = makeCtx();
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_FALLING,
            loc: { x: 3, y: 3 },
        });
        ctx.monsters.push(monst);
        (ctx.inflictDamage as any).mockReturnValue(true);
        monstersFall(ctx);
        expect(ctx.killCreature).toHaveBeenCalledWith(monst, false);
    });

    it("immediately kills turret-like monsters", () => {
        const ctx = makeCtx();
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_FALLING,
            loc: { x: 3, y: 3 },
        });
        monst.info.flags = MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION;
        ctx.monsters.push(monst);
        monstersFall(ctx);
        expect(ctx.killCreature).toHaveBeenCalledWith(monst, false);
        expect(ctx.inflictDamage).not.toHaveBeenCalled();
    });
});

// =============================================================================
// applyInstantTileEffectsToCreature — selected tests
// =============================================================================

describe("applyInstantTileEffectsToCreature", () => {
    it("marks tile trap-free for player walking on it", () => {
        const ctx = makeCtx();
        ctx.player.loc = { x: 3, y: 3 };
        applyInstantTileEffectsToCreature(ctx.player, ctx);
        expect(ctx.pmap[3][3].flags & TileFlag.KNOWN_TO_BE_TRAP_FREE).toBeTruthy();
    });

    it("does not mark trap-free for levitating player", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Levitating] = 5;
        ctx.player.loc = { x: 3, y: 3 };
        applyInstantTileEffectsToCreature(ctx.player, ctx);
        expect(ctx.pmap[3][3].flags & TileFlag.KNOWN_TO_BE_TRAP_FREE).toBeFalsy();
    });

    it("skips dying creatures", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DYING });
        applyInstantTileEffectsToCreature(monst, ctx);
        // Should return immediately — no side effects
        expect(ctx.pmap[monst.loc.x][monst.loc.y].flags & TileFlag.KNOWN_TO_BE_TRAP_FREE).toBeFalsy();
    });

    it("surfaces submerged creatures on non-submerging tiles", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ bookkeepingFlags: MonsterBookkeepingFlag.MB_SUBMERGED });
        (ctx.cellHasTMFlag as any).mockReturnValue(false);
        applyInstantTileEffectsToCreature(monst, ctx);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED).toBeFalsy();
    });

    it("marks player as falling on auto-descent tile", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_AUTO_DESCENT);
        });
        ctx.player.loc = { x: 3, y: 3 };
        applyInstantTileEffectsToCreature(ctx.player, ctx);
        expect(ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING).toBeTruthy();
    });

    it("extinguishes fire on water tiles for non-fiery monsters", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        monst.status[StatusEffect.Burning] = 5;
        (ctx.cellHasTMFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainMechFlag.TM_EXTINGUISHES_FIRE);
        });
        applyInstantTileEffectsToCreature(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(0);
    });

    it("does not extinguish fire on fiery monsters", () => {
        const ctx = makeCtx();
        const monst = makeCreature();
        monst.status[StatusEffect.Burning] = 5;
        monst.info.flags = MonsterBehaviorFlag.MONST_FIERY;
        (ctx.cellHasTMFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainMechFlag.TM_EXTINGUISHES_FIRE);
        });
        applyInstantTileEffectsToCreature(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(5);
    });

    it("exposes creature to fire on fire tiles", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_FIRE);
        });
        applyInstantTileEffectsToCreature(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(7);
    });

    it("handles lava insta-death for monsters", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_LAVA_INSTA_DEATH);
        });
        applyInstantTileEffectsToCreature(monst, ctx);
        expect(ctx.killCreature).toHaveBeenCalledWith(monst, false);
    });

    it("handles lava insta-death for player (game over)", () => {
        const ctx = makeCtx();
        ctx.player.loc = { x: 3, y: 3 };
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_LAVA_INSTA_DEATH);
        });
        applyInstantTileEffectsToCreature(ctx.player, ctx);
        expect(ctx.gameOver).toHaveBeenCalled();
    });
});

// =============================================================================
// applyGradualTileEffectsToCreature
// =============================================================================

describe("applyGradualTileEffectsToCreature", () => {
    it("inflicts terrain damage to player", () => {
        const ctx = makeCtx();
        ctx.player.loc = { x: 3, y: 3 };
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_CAUSES_DAMAGE);
        });
        applyGradualTileEffectsToCreature(ctx.player, 100, ctx);
        expect(ctx.inflictDamage).toHaveBeenCalled();
    });

    it("heals creatures on healing terrain", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ currentHP: 10, loc: { x: 3, y: 3 } });
        monst.info.maxHP = 20;
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_CAUSES_HEALING);
        });
        applyGradualTileEffectsToCreature(monst, 100, ctx);
        expect(monst.currentHP).toBeGreaterThan(10);
    });

    it("does not heal beyond maxHP", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ currentHP: 20, loc: { x: 3, y: 3 } });
        monst.info.maxHP = 20;
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_CAUSES_HEALING);
        });
        applyGradualTileEffectsToCreature(monst, 100, ctx);
        expect(monst.currentHP).toBe(20);
    });

    it("does not heal inanimate creatures", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ currentHP: 5, loc: { x: 3, y: 3 } });
        monst.info.maxHP = 20;
        monst.info.flags = MonsterBehaviorFlag.MONST_INANIMATE;
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_CAUSES_HEALING);
        });
        applyGradualTileEffectsToCreature(monst, 100, ctx);
        expect(monst.currentHP).toBe(5);
    });

    it("causes monster to drop item in deep water", () => {
        const ctx = makeCtx();
        const monst = makeCreature({ loc: { x: 3, y: 3 }, carriedItem: makeItem() });
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_DEEP_WATER);
        });
        (ctx.rand_percent as any).mockReturnValue(true);
        applyGradualTileEffectsToCreature(monst, 100, ctx);
        expect(ctx.makeMonsterDropItem).toHaveBeenCalledWith(monst);
    });
});
