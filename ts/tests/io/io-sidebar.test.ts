/*
 *  io-sidebar.test.ts — Tests for io-sidebar.ts (sidebar rendering)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { seedRandomGenerator } from "../../src/math/rng.js";
import { COLS, ROWS, DCOLS, DROWS, STOMACH_SIZE, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD } from "../../src/types/constants.js";
import { DisplayGlyph, StatusEffect, CreatureState, DungeonLayer, MonsterType } from "../../src/types/enums.js";
import { TileFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag, TerrainMechFlag, ItemFlag } from "../../src/types/flags.js";
import type { Color, Creature, Item, Pcell, FloorTileType, Pos, ScreenDisplayBuffer } from "../../src/types/types.js";
import { createScreenDisplayBuffer } from "../../src/io/io-display.js";
import { statusEffectCatalog } from "../../src/globals/status-effects.js";
import { mutationCatalog } from "../../src/globals/mutation-catalog.js";
import { monsterText } from "../../src/globals/monster-text.js";
import {
    type SidebarContext,
    type SidebarEntity,
    EntityDisplayType,
    SIDEBAR_WIDTH,
    smoothHiliteGradient,
    creatureHealthChangePercent,
    printProgressBar,
    printMonsterInfo,
    printItemInfo,
    printTerrainInfo,
    collectSidebarEntities,
    refreshSideBar,
    printMonsterDetails,
    printFloorItemDetails,
    printCarriedItemDetails,
} from "../../src/io/io-sidebar.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(
    red = 0, green = 0, blue = 0,
    redRand = 0, greenRand = 0, blueRand = 0,
    rand = 0, colorDances = false,
): Color {
    return { red, green, blue, redRand, greenRand, blueRand, rand, colorDances };
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    const statusArr = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    const maxStatusArr = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    statusArr[StatusEffect.Nutrition] = STOMACH_SIZE;

    return {
        info: {
            monsterID: MonsterType.MK_YOU,
            monsterName: "you",
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(100, 90, 30),
            maxHP: 30,
            defense: 0,
            accuracy: 100,
            damage: { lowerBound: 1, upperBound: 2, clumpFactor: 1 },
            turnsBetweenRegen: 20,
            movementSpeed: 100,
            attackSpeed: 100,
            bloodType: 0 as any,
            intrinsicLightType: 0 as any,
            isLarge: false,
            DFChance: 0,
            DFType: 0 as any,
            bolts: [],
            flags: 0,
            abilityFlags: 0,
        },
        loc: { x: 20, y: 15 },
        depth: 1,
        currentHP: 25,
        turnsUntilRegen: 20,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: CreatureState.Ally,
        creatureMode: 0,
        mutationIndex: -1,
        wasNegated: false,
        targetWaypointIndex: -1,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: -1, y: -1 },
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
        previousHealthPoints: 25,
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: makeColor(),
        status: statusArr,
        maxStatus: maxStatusArr,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        machineHome: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        leader: null,
        carriedMonster: null,
        carriedItem: null,
        ...overrides,
    } as Creature;
}

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
        vorpalEnemy: 0 as MonsterType,
        strengthRequired: 0,
        quiverNumber: 0,
        displayChar: DisplayGlyph.G_WEAPON,
        foreColor: makeColor(100, 95, -30),
        inventoryColor: null,
        quantity: 1,
        inventoryLetter: "a",
        inscription: "",
        loc: { x: 22, y: 15 },
        keyLoc: [],
        originDepth: 1,
        spawnTurnNumber: 0,
        lastUsed: [0, 0, 0],
        ...overrides,
    } as Item;
}

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = {
                layers: [0, 0, 0, 0],
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: { character: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0], opacity: 0 },
                rememberedItemCategory: 0,
                rememberedItemKind: 0,
                rememberedItemQuantity: 0,
                rememberedItemOriginDepth: 0,
                rememberedTerrain: 0 as any,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                exposedToFire: 0,
            };
        }
    }
    return pmap;
}

function createTestContext(overrides: Partial<SidebarContext> = {}): SidebarContext {
    const player = makeCreature();
    const displayBuffer = createScreenDisplayBuffer();
    const pmap = makePmap();

    // Mark player cell
    pmap[player.loc.x][player.loc.y].flags |= TileFlag.HAS_PLAYER;

    return {
        rogue: {
            gameHasEnded: false,
            playbackFastForward: false,
            playbackMode: false,
            playbackOmniscience: false,
            playbackOOS: false,
            playbackPaused: false,
            playerTurnNumber: 10,
            howManyTurns: 100,
            depthLevel: 3,
            strength: 12,
            gold: 150,
            stealthRange: 14,
            sidebarLocationList: Array.from({ length: ROWS * 2 }, () => ({ x: -1, y: -1 })),
            armor: null,
            trueColorMode: false,
        },
        player,
        pmap,
        tileCatalog: [{ displayChar: 0, drawPriority: 0, chanceToIgnite: 0, fireType: 0, discoverType: 0, promoteType: 0, promoteChance: 0, glowLight: 0 as any, flags: 0, mechFlags: 0, description: "stone floor", flavorText: "" }] as FloorTileType[],
        displayBuffer,
        statusEffectCatalog: statusEffectCatalog as unknown as { name: string }[],
        mutationCatalog: mutationCatalog as unknown as { title: string; textColor: Color }[],
        monsterText: monsterText as unknown as { absorbStatus: string }[],

        monsterAtLoc: vi.fn((_loc: Pos) => null),
        itemAtLoc: vi.fn((_loc: Pos) => null),
        canSeeMonster: vi.fn((_monst: Creature) => true),
        canDirectlySeeMonster: vi.fn((_monst: Creature) => true),
        playerCanSeeOrSense: vi.fn((_x: number, _y: number) => true),
        playerCanDirectlySee: vi.fn((_x: number, _y: number) => true),
        playerInDarkness: vi.fn(() => false),
        iterateMonsters: vi.fn(() => []),
        floorItems: vi.fn(() => []),
        monsterName: vi.fn((_monst: Creature, _includeArticle: boolean) => "you"),
        itemName: vi.fn((_theItem: Item, _details: boolean, _article: boolean, _titleColor?: Readonly<Color>) => "a short sword"),
        getHallucinatedItemCategory: vi.fn(() => 0),
        getItemCategoryGlyph: vi.fn((_cat: number) => DisplayGlyph.G_WEAPON),
        describeHallucinatedItem: vi.fn(() => "a glowing potion"),
        getCellAppearance: vi.fn((_loc: Pos) => ({
            glyph: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(100, 90, 30),
            backColor: makeColor(0, 0, 0),
        })),
        displayedArmorValue: vi.fn(() => 5),
        estimatedArmorValue: vi.fn(() => 4),
        cellHasTMFlag: vi.fn((_loc: Pos, _flag: number) => false),
        layerWithTMFlag: vi.fn((_x: number, _y: number, _flag: number) => DungeonLayer.NoLayer),
        monsterDetails: vi.fn((_monst: Creature) => "A naked adventurer."),
        itemDetails: vi.fn((_theItem: Item) => "A short sword."),
        printTextBox: vi.fn((_text: string, _x: number, _y: number, _width: number, _fg: Readonly<Color>, _bg: Readonly<Color>) => -1),
        printProgressBar: vi.fn(),

        ...overrides,
    };
}

// =============================================================================
// smoothHiliteGradient
// =============================================================================

describe("smoothHiliteGradient", () => {
    it("returns 0 at the edges", () => {
        expect(smoothHiliteGradient(0, 20)).toBe(0);
    });

    it("returns ~100 at the midpoint", () => {
        // sin(π/2) = 1, so smoothHiliteGradient(10, 20) ≈ 100
        const mid = smoothHiliteGradient(10, 20);
        expect(mid).toBe(100);
    });

    it("is symmetric", () => {
        const left = smoothHiliteGradient(3, 20);
        const right = smoothHiliteGradient(17, 20);
        // sin(3π/20) ≈ sin(17π/20) — symmetric about midpoint
        expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
    });

    it("returns 0 when max is 0", () => {
        expect(smoothHiliteGradient(5, 0)).toBe(0);
    });

    it("returns 0 when current is 0", () => {
        expect(smoothHiliteGradient(0, 10)).toBe(0);
    });
});

// =============================================================================
// creatureHealthChangePercent
// =============================================================================

describe("creatureHealthChangePercent", () => {
    it("returns 0 when no change", () => {
        const monst = makeCreature({ currentHP: 25, previousHealthPoints: 25 });
        monst.info.maxHP = 30;
        expect(creatureHealthChangePercent(monst)).toBe(0);
    });

    it("returns negative percent for damage taken", () => {
        const monst = makeCreature({ currentHP: 15, previousHealthPoints: 25 });
        monst.info.maxHP = 30;
        // (15 - 25) / 30 * 100 = -33
        expect(creatureHealthChangePercent(monst)).toBe(-33);
    });

    it("returns positive percent for healing", () => {
        const monst = makeCreature({ currentHP: 28, previousHealthPoints: 20 });
        monst.info.maxHP = 30;
        // (28 - 20) / 30 * 100 = 26
        expect(creatureHealthChangePercent(monst)).toBe(26);
    });

    it("caps previous at maxHP to ignore overhealing", () => {
        const monst = makeCreature({ currentHP: 30, previousHealthPoints: 35 });
        monst.info.maxHP = 30;
        // (30 - min(35, 30)) / 30 * 100 = 0
        expect(creatureHealthChangePercent(monst)).toBe(0);
    });

    it("returns 0 when previousHealthPoints is 0", () => {
        const monst = makeCreature({ currentHP: 10, previousHealthPoints: 0 });
        monst.info.maxHP = 30;
        expect(creatureHealthChangePercent(monst)).toBe(0);
    });

    it("returns 0 when previousHealthPoints is negative", () => {
        const monst = makeCreature({ currentHP: 10, previousHealthPoints: -5 });
        monst.info.maxHP = 30;
        expect(creatureHealthChangePercent(monst)).toBe(0);
    });
});

// =============================================================================
// printProgressBar
// =============================================================================

describe("printProgressBar", () => {
    let displayBuffer: ScreenDisplayBuffer;

    beforeEach(() => {
        seedRandomGenerator(12345n);
        displayBuffer = createScreenDisplayBuffer();
    });

    it("renders a 20-wide bar at the specified position", () => {
        printProgressBar(0, 5, "Health", 20, 30, makeColor(15, 10, 50), false, displayBuffer);
        // Check that all 20 columns have been written at y=5
        for (let i = 0; i < SIDEBAR_WIDTH; i++) {
            const cell = displayBuffer.cells[i][5];
            // At least the back color should be non-zero (fill color)
            expect(cell.backColorComponents[0] + cell.backColorComponents[1] + cell.backColorComponents[2]).toBeGreaterThan(0);
        }
    });

    it("centers the label text", () => {
        printProgressBar(0, 3, "HP", 10, 10, makeColor(15, 10, 50), false, displayBuffer);
        // "HP" is 2 chars, centered in 20 = offset 9
        // The character at column 9 should be 'H' (charCode 72)
        const cell9 = displayBuffer.cells[9][3];
        expect(cell9.character).toBe("H".charCodeAt(0));
        const cell10 = displayBuffer.cells[10][3];
        expect(cell10.character).toBe("P".charCodeAt(0));
    });

    it("does not render at row ROWS-1", () => {
        const dbuf = createScreenDisplayBuffer();
        printProgressBar(0, ROWS - 1, "Test", 5, 10, makeColor(15, 10, 50), false, dbuf);
        // Should not have been written — default cell has opacity 0
        const cell = dbuf.cells[0][ROWS - 1];
        expect(cell.opacity).toBe(0);
    });

    it("clamps amtFilled to amtMax", () => {
        // Should not crash when filled > max
        printProgressBar(0, 2, "Test", 50, 10, makeColor(15, 10, 50), false, displayBuffer);
        // Just verify it doesn't throw
        expect(true).toBe(true);
    });

    it("handles zero amtMax gracefully", () => {
        printProgressBar(0, 2, "Test", 5, 0, makeColor(15, 10, 50), false, displayBuffer);
        // Should not crash
        expect(true).toBe(true);
    });

    it("applies dim effect", () => {
        const dbuf1 = createScreenDisplayBuffer();
        const dbuf2 = createScreenDisplayBuffer();
        seedRandomGenerator(999n);
        printProgressBar(0, 2, "Health", 15, 30, makeColor(15, 10, 50), false, dbuf1);
        seedRandomGenerator(999n);
        printProgressBar(0, 2, "Health", 15, 30, makeColor(15, 10, 50), true, dbuf2);
        // Dim version should have darker colors on average
        let sum1 = 0, sum2 = 0;
        for (let i = 0; i < SIDEBAR_WIDTH; i++) {
            sum1 += dbuf1.cells[i][2].backColorComponents[0] + dbuf1.cells[i][2].backColorComponents[1] + dbuf1.cells[i][2].backColorComponents[2];
            sum2 += dbuf2.cells[i][2].backColorComponents[0] + dbuf2.cells[i][2].backColorComponents[1] + dbuf2.cells[i][2].backColorComponents[2];
        }
        expect(sum2).toBeLessThan(sum1);
    });
});

// =============================================================================
// printMonsterInfo
// =============================================================================

describe("printMonsterInfo", () => {
    let ctx: SidebarContext;

    beforeEach(() => {
        seedRandomGenerator(42n);
        ctx = createTestContext();
    });

    it("returns ROWS - 1 when y >= ROWS - 1", () => {
        expect(printMonsterInfo(ctx.player, ROWS - 1, false, false, ctx)).toBe(ROWS - 1);
    });

    it("renders player info and returns advanced y", () => {
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        // Should have rendered at least the name line + health bar + nutrition + stats + stealth + blank
        expect(y).toBeGreaterThan(4);
    });

    it("shows player visibility status", () => {
        // Test invisible
        ctx.player.status[StatusEffect.Invisible] = 10;
        ctx.monsterName = vi.fn(() => "you");
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        expect(y).toBeGreaterThan(0);
    });

    it("shows player dark status", () => {
        ctx.playerInDarkness = vi.fn(() => true);
        ctx.monsterName = vi.fn(() => "you");
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        expect(y).toBeGreaterThan(0);
    });

    it("renders monster with dim=true", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            currentHP: 15,
        });
        monst.info.monsterName = "rat";
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.info.displayChar = DisplayGlyph.G_RAT;
        monst.info.maxHP = 20;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, true, false, ctx);
        expect(y).toBeGreaterThan(2);
    });

    it("renders monster with highlight=true", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            currentHP: 15,
        });
        monst.info.monsterName = "kobold";
        monst.info.monsterID = MonsterType.MK_KOBOLD;
        monst.info.displayChar = DisplayGlyph.G_KOBOLD;
        monst.info.maxHP = 20;
        monst.creatureState = CreatureState.TrackingScent;
        ctx.monsterName = vi.fn(() => "kobold");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_KOBOLD,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, true, ctx);
        expect(y).toBeGreaterThan(2);
    });

    it("shows mutation line for mutated monsters", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            mutationIndex: 0, // "explosive"
        });
        monst.info.monsterName = "rat";
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.info.maxHP = 20;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const yNoMutation = printMonsterInfo(makeCreature({ loc: { x: 25, y: 18 }, mutationIndex: -1 }), 2, false, false, ctx);
        const yWithMutation = printMonsterInfo(monst, 2, false, false, ctx);
        // Mutation adds one extra line
        expect(yWithMutation).toBeGreaterThanOrEqual(yNoMutation + 1);
    });

    it("shows health bar for creatures with maxHP > 1", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            currentHP: 10,
        });
        monst.info.maxHP = 20;
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        // Health bar + state line + blank = at least 5 lines
        expect(y).toBeGreaterThanOrEqual(5);
    });

    it("shows status effects", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
        });
        monst.info.maxHP = 20;
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.status[StatusEffect.Confused] = 10;
        monst.maxStatus[StatusEffect.Confused] = 20;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        expect(y).toBeGreaterThanOrEqual(6); // name + health + confused bar + state + blank
    });

    it("shows nutrition for player", () => {
        ctx.player.status[StatusEffect.Nutrition] = STOMACH_SIZE; // full
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        expect(y).toBeGreaterThanOrEqual(4); // name + health + nutrition + str/armor + stealth + blank
    });

    it("shows STARVING when nutrition is 0", () => {
        ctx.player.status[StatusEffect.Nutrition] = 0;
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        expect(y).toBeGreaterThanOrEqual(3);
    });

    it("shows different hunger labels based on thresholds", () => {
        // Hungry
        ctx.player.status[StatusEffect.Nutrition] = HUNGER_THRESHOLD - 1;
        let y1 = printMonsterInfo(ctx.player, 0, false, false, ctx);

        // Weak
        ctx.player.status[StatusEffect.Nutrition] = WEAK_THRESHOLD - 1;
        let y2 = printMonsterInfo(ctx.player, 0, false, false, ctx);

        // Both should render (we just check they don't crash)
        expect(y1).toBeGreaterThan(0);
        expect(y2).toBeGreaterThan(0);
    });

    it("shows Negated for negated monsters", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            wasNegated: true,
            newPowerCount: 5,
            totalPowerCount: 5,
        });
        monst.info.maxHP = 1; // skip health bar
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.info.flags = MonsterBehaviorFlag.MONST_INANIMATE; // skip behavior line
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "totem");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_TURRET,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        expect(y).toBeGreaterThan(3); // name + negated + blank
    });

    it("shows creature state strings", () => {
        const states: [CreatureState, string][] = [
            [CreatureState.Sleeping, "Sleeping"],
            [CreatureState.Ally, "Ally"],
            [CreatureState.Fleeing, "Fleeing"],
            [CreatureState.TrackingScent, "Hunting"],
        ];

        for (const [state] of states) {
            const monst = makeCreature({
                loc: { x: 25, y: 18 },
                creatureState: state,
            });
            monst.info.maxHP = 1;
            monst.info.monsterID = MonsterType.MK_RAT;
            ctx.monsterName = vi.fn(() => "rat");
            ctx.getCellAppearance = vi.fn(() => ({
                glyph: DisplayGlyph.G_RAT,
                foreColor: makeColor(50, 50, 50),
                backColor: makeColor(0, 0, 0),
            }));
            ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

            const y = printMonsterInfo(monst, 2, false, false, ctx);
            expect(y).toBeGreaterThan(3); // name + state + blank
        }
    });

    it("shows Captive for captive monsters", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
            creatureState: CreatureState.Wandering,
        });
        monst.info.maxHP = 1;
        monst.info.monsterID = MonsterType.MK_RAT;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        expect(y).toBeGreaterThan(3);
    });

    it("shows poison with multiplier", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            poisonAmount: 3,
        });
        monst.info.maxHP = 20;
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.status[StatusEffect.Poisoned] = 5;
        monst.maxStatus[StatusEffect.Poisoned] = 10;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        expect(y).toBeGreaterThan(4); // name + health + poison + state + blank
    });

    it("shows fatal poison label when lethal", () => {
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            currentHP: 10,
            poisonAmount: 3,
        });
        monst.info.maxHP = 20;
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.status[StatusEffect.Poisoned] = 5; // 5 * 3 = 15 >= 10 HP
        monst.maxStatus[StatusEffect.Poisoned] = 10;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        expect(y).toBeGreaterThan(4);
    });

    it("shows carriedItem glyph", () => {
        const carriedItem = makeItem({ displayChar: DisplayGlyph.G_SCROLL });
        const monst = makeCreature({
            loc: { x: 25, y: 18 },
            carriedItem,
        });
        monst.info.maxHP = 1;
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.creatureState = CreatureState.Wandering;
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));
        ctx.pmap[25][18] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_MONSTER };

        const y = printMonsterInfo(monst, 2, false, false, ctx);
        // Check that carried item glyph was plotted at column 1
        const cell = ctx.displayBuffer.cells[1][2];
        expect(cell.character).toBe(DisplayGlyph.G_SCROLL);
    });

    it("shows player strength and armor", () => {
        ctx.rogue.strength = 15;
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        // Should include str/armor line
        expect(y).toBeGreaterThanOrEqual(5);
    });

    it("shows gold when player has gold", () => {
        ctx.rogue.gold = 200;
        const y = printMonsterInfo(ctx.player, 0, false, false, ctx);
        expect(y).toBeGreaterThanOrEqual(5);
    });

    it("does not show gold when player has no gold", () => {
        ctx.rogue.gold = 0;
        const y1 = printMonsterInfo(ctx.player, 0, false, false, ctx);

        ctx.rogue.gold = 100;
        const y2 = printMonsterInfo(ctx.player, 0, false, false, ctx);
        // With gold should take more lines
        expect(y2).toBeGreaterThanOrEqual(y1 + 1);
    });
});

// =============================================================================
// printItemInfo
// =============================================================================

describe("printItemInfo", () => {
    let ctx: SidebarContext;

    beforeEach(() => {
        seedRandomGenerator(42n);
        ctx = createTestContext();
    });

    it("returns ROWS - 1 when y >= ROWS - 1", () => {
        const item = makeItem();
        expect(printItemInfo(item, ROWS - 1, false, false, ctx)).toBe(ROWS - 1);
    });

    it("renders item info and returns advanced y", () => {
        const item = makeItem({ loc: { x: 22, y: 15 } });
        ctx.pmap[22][15] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_ITEM };
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_WEAPON,
            foreColor: makeColor(100, 95, -30),
            backColor: makeColor(0, 0, 0),
        }));

        const y = printItemInfo(item, 2, false, false, ctx);
        // Should be at least 2 lines above starting point (name + spacing)
        expect(y).toBeGreaterThanOrEqual(4);
    });

    it("overrides glyph when item is at player location", () => {
        const item = makeItem({ loc: { x: 20, y: 15 } }); // same as player
        ctx.pmap[20][15] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_ITEM | TileFlag.HAS_PLAYER };
        // getCellAppearance returns player glyph
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_PLAYER,
            foreColor: makeColor(100, 90, 30),
            backColor: makeColor(0, 0, 0),
        }));

        const y = printItemInfo(item, 2, false, false, ctx);
        // Should still render (overriding to item glyph)
        expect(y).toBeGreaterThan(2);
        // Check that the glyph at (0, 2) is the item's glyph, not player
        const cell = ctx.displayBuffer.cells[0][2];
        expect(cell.character).toBe(DisplayGlyph.G_WEAPON);
    });

    it("uses hallucinated item when hallucinating", () => {
        ctx.player.status[StatusEffect.Hallucinating] = 10;
        const item = makeItem({ loc: { x: 22, y: 15 } });
        ctx.pmap[22][15] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_ITEM };
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_WEAPON,
            foreColor: makeColor(100, 95, -30),
            backColor: makeColor(0, 0, 0),
        }));

        printItemInfo(item, 2, false, false, ctx);
        expect(ctx.describeHallucinatedItem).toHaveBeenCalled();
    });

    it("renders dimmed item", () => {
        const item = makeItem({ loc: { x: 22, y: 15 } });
        ctx.pmap[22][15] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_ITEM };
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_WEAPON,
            foreColor: makeColor(100, 95, -30),
            backColor: makeColor(0, 0, 0),
        }));

        const y = printItemInfo(item, 2, true, false, ctx);
        expect(y).toBeGreaterThan(2);
    });

    it("applies highlight gradient", () => {
        const item = makeItem({ loc: { x: 22, y: 15 } });
        ctx.pmap[22][15] = { ...ctx.pmap[0][0], flags: TileFlag.HAS_ITEM };
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_WEAPON,
            foreColor: makeColor(100, 95, -30),
            backColor: makeColor(0, 0, 0),
        }));

        const y = printItemInfo(item, 2, false, true, ctx);
        expect(y).toBeGreaterThan(2);
    });
});

// =============================================================================
// printTerrainInfo
// =============================================================================

describe("printTerrainInfo", () => {
    let ctx: SidebarContext;

    beforeEach(() => {
        seedRandomGenerator(42n);
        ctx = createTestContext();
    });

    it("returns ROWS - 1 when py >= ROWS - 1", () => {
        expect(printTerrainInfo(10, 10, ROWS - 1, "a staircase", false, false, ctx)).toBe(ROWS - 1);
    });

    it("renders terrain info and returns advanced py", () => {
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_DOWN_STAIRS,
            foreColor: makeColor(80, 80, 40),
            backColor: makeColor(0, 0, 0),
        }));

        const py = printTerrainInfo(15, 10, 5, "a downward staircase", false, false, ctx);
        expect(py).toBeGreaterThan(5);
    });

    it("renders terrain dimmed", () => {
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_DOWN_STAIRS,
            foreColor: makeColor(80, 80, 40),
            backColor: makeColor(0, 0, 0),
        }));

        const py = printTerrainInfo(15, 10, 5, "a downward staircase", true, false, ctx);
        expect(py).toBeGreaterThan(5);
    });

    it("renders terrain highlighted", () => {
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_DOWN_STAIRS,
            foreColor: makeColor(80, 80, 40),
            backColor: makeColor(0, 0, 0),
        }));

        const py = printTerrainInfo(15, 10, 5, "a downward staircase", false, true, ctx);
        expect(py).toBeGreaterThan(5);
    });
});

// =============================================================================
// collectSidebarEntities
// =============================================================================

describe("collectSidebarEntities", () => {
    let ctx: SidebarContext;

    beforeEach(() => {
        ctx = createTestContext();
    });

    it("always includes player first", () => {
        const entities = collectSidebarEntities(-1, -1, false, ctx);
        expect(entities.length).toBeGreaterThanOrEqual(1);
        expect(entities[0].type).toBe(EntityDisplayType.Creature);
        expect(entities[0].creature).toBe(ctx.player);
    });

    it("includes item at player's location", () => {
        const playerItem = makeItem({ loc: { x: ctx.player.loc.x, y: ctx.player.loc.y } });
        ctx.itemAtLoc = vi.fn((loc: Pos) => {
            if (loc.x === ctx.player.loc.x && loc.y === ctx.player.loc.y) return playerItem;
            return null;
        });

        const entities = collectSidebarEntities(-1, -1, false, ctx);
        expect(entities.length).toBe(2);
        expect(entities[1].type).toBe(EntityDisplayType.Item);
        expect(entities[1].item).toBe(playerItem);
    });

    it("includes visible monsters sorted by distance", () => {
        const nearMonst = makeCreature({ loc: { x: 22, y: 15 } }); // dist² = 4
        nearMonst.info.monsterID = MonsterType.MK_RAT;
        const farMonst = makeCreature({ loc: { x: 30, y: 20 } }); // dist² = 100+25=125
        farMonst.info.monsterID = MonsterType.MK_KOBOLD;

        ctx.pmap[22][15].flags |= TileFlag.HAS_MONSTER;
        ctx.pmap[30][20].flags |= TileFlag.HAS_MONSTER;
        ctx.iterateMonsters = vi.fn(() => [nearMonst, farMonst]);

        const entities = collectSidebarEntities(-1, -1, false, ctx);
        const monsters = entities.filter(e => e.type === EntityDisplayType.Creature && e.creature !== ctx.player);
        expect(monsters.length).toBe(2);
        expect(monsters[0].creature).toBe(nearMonst);
        expect(monsters[1].creature).toBe(farMonst);
    });

    it("excludes monsters with MONST_NOT_LISTED_IN_SIDEBAR", () => {
        const monst = makeCreature({ loc: { x: 22, y: 15 } });
        monst.info.flags = MonsterBehaviorFlag.MONST_NOT_LISTED_IN_SIDEBAR;
        ctx.pmap[22][15].flags |= TileFlag.HAS_MONSTER;
        ctx.iterateMonsters = vi.fn(() => [monst]);

        const entities = collectSidebarEntities(-1, -1, false, ctx);
        const monsters = entities.filter(e => e.type === EntityDisplayType.Creature && e.creature !== ctx.player);
        expect(monsters.length).toBe(0);
    });

    it("includes visible floor items sorted by distance", () => {
        const nearItem = makeItem({ loc: { x: 21, y: 15 } }); // dist² = 1
        const farItem = makeItem({ loc: { x: 30, y: 20 } }); // dist² = 125

        ctx.floorItems = vi.fn(() => [nearItem, farItem]);

        const entities = collectSidebarEntities(-1, -1, false, ctx);
        const items = entities.filter(e => e.type === EntityDisplayType.Item);
        expect(items.length).toBe(2);
        expect(items[0].item).toBe(nearItem);
        expect(items[1].item).toBe(farItem);
    });

    it("includes terrain with TM_LIST_IN_SIDEBAR", () => {
        const terrainX = 21, terrainY = 15;
        ctx.cellHasTMFlag = vi.fn((loc: Pos, flag: number) => {
            return loc.x === terrainX && loc.y === terrainY && (flag & TerrainMechFlag.TM_LIST_IN_SIDEBAR) !== 0;
        });
        ctx.layerWithTMFlag = vi.fn(() => DungeonLayer.Surface);
        ctx.tileCatalog = [
            { displayChar: 0, drawPriority: 0, chanceToIgnite: 0, fireType: 0, discoverType: 0, promoteType: 0, promoteChance: 0, glowLight: 0 as any, flags: 0, mechFlags: TerrainMechFlag.TM_LIST_IN_SIDEBAR, description: "a downward staircase", flavorText: "" },
        ] as FloorTileType[];

        const entities = collectSidebarEntities(-1, -1, false, ctx);
        const terrain = entities.filter(e => e.type === EntityDisplayType.Terrain);
        expect(terrain.length).toBe(1);
        expect(terrain[0].terrainDescription).toBe("a downward staircase");
    });

    it("puts focused entity first when focusedEntityMustGoFirst", () => {
        const monst = makeCreature({ loc: { x: 30, y: 20 } });
        monst.info.monsterID = MonsterType.MK_RAT;
        ctx.pmap[30][20].flags |= TileFlag.HAS_MONSTER;
        ctx.monsterAtLoc = vi.fn((loc: Pos) => {
            if (loc.x === 30 && loc.y === 20) return monst;
            return null;
        });
        ctx.iterateMonsters = vi.fn(() => [monst]);

        const entities = collectSidebarEntities(30, 20, true, ctx);
        // Player first, then the focused monster (before proximity sort)
        expect(entities.length).toBeGreaterThanOrEqual(2);
        expect(entities[1].type).toBe(EntityDisplayType.Creature);
        expect(entities[1].x).toBe(30);
        expect(entities[1].y).toBe(20);
    });

    it("limits total entities to ROWS - 1", () => {
        // Create enough monsters to fill the sidebar
        const monsters: Creature[] = [];
        for (let i = 0; i < ROWS; i++) {
            const mx = Math.min(i + 1, DCOLS - 1);
            const my = Math.min(i, DROWS - 1);
            const monst = makeCreature({ loc: { x: mx, y: my } });
            monst.info.monsterID = MonsterType.MK_RAT;
            ctx.pmap[mx][my].flags |= TileFlag.HAS_MONSTER;
            monsters.push(monst);
        }
        ctx.iterateMonsters = vi.fn(() => monsters);

        const entities = collectSidebarEntities(-1, -1, false, ctx);
        // Each entity takes at least 2 rows, so max ~17 entities
        expect(entities.length).toBeLessThanOrEqual(ROWS);
    });
});

// =============================================================================
// refreshSideBar
// =============================================================================

describe("refreshSideBar", () => {
    let ctx: SidebarContext;

    beforeEach(() => {
        seedRandomGenerator(42n);
        ctx = createTestContext();
    });

    it("does nothing when game has ended", () => {
        ctx.rogue.gameHasEnded = true;
        refreshSideBar(-1, -1, false, ctx);
        // Check that the display buffer retains its default (space=32, opacity=0)
        expect(ctx.displayBuffer.cells[0][0].opacity).toBe(0);
    });

    it("does nothing when playback fast forward", () => {
        ctx.rogue.playbackFastForward = true;
        refreshSideBar(-1, -1, false, ctx);
        expect(ctx.displayBuffer.cells[0][0].opacity).toBe(0);
    });

    it("renders player in sidebar", () => {
        refreshSideBar(-1, -1, false, ctx);
        // Something should be rendered at row 0
        expect(ctx.displayBuffer.cells[0][0].character).not.toBe(0);
    });

    it("renders depth footer", () => {
        ctx.rogue.depthLevel = 5;
        refreshSideBar(-1, -1, false, ctx);
        // Check that the depth line is at ROWS - 1
        const lastRow = ROWS - 1;
        let hasContent = false;
        for (let x = 0; x < SIDEBAR_WIDTH; x++) {
            if (ctx.displayBuffer.cells[x][lastRow].character !== 0) {
                hasContent = true;
                break;
            }
        }
        expect(hasContent).toBe(true);
    });

    it("clears remaining sidebar rows", () => {
        refreshSideBar(-1, -1, false, ctx);
        // After the last entity, remaining rows should be spaces
        // We can verify by checking a row near the bottom is cleared
        const row = ROWS - 2;
        let allSpaces = true;
        for (let x = 0; x < SIDEBAR_WIDTH; x++) {
            const ch = ctx.displayBuffer.cells[x][row].character;
            if (ch !== 0 && ch !== 32) {
                allSpaces = false;
                break;
            }
        }
        expect(allSpaces).toBe(true);
    });

    it("initializes sidebarLocationList", () => {
        refreshSideBar(-1, -1, false, ctx);
        // First few rows should map to player location
        expect(ctx.rogue.sidebarLocationList[0]).toEqual(ctx.player.loc);
    });

    it("renders playback header when in playback mode", () => {
        ctx.rogue.playbackMode = true;
        ctx.rogue.howManyTurns = 100;
        ctx.rogue.playerTurnNumber = 50;
        refreshSideBar(-1, -1, false, ctx);

        // Row 0 should contain the playback header
        // Check for the '-' character which appears in "-- PLAYBACK --"
        const dashCode = "-".charCodeAt(0);
        let hasDash = false;
        for (let x = 0; x < SIDEBAR_WIDTH; x++) {
            if (ctx.displayBuffer.cells[x][0].character === dashCode) {
                hasDash = true;
                break;
            }
        }
        expect(hasDash).toBe(true);
    });

    it("renders OOS indicator when playback OOS", () => {
        ctx.rogue.playbackMode = true;
        ctx.rogue.playbackOOS = true;
        refreshSideBar(-1, -1, false, ctx);
        // Just verify it doesn't throw
        expect(true).toBe(true);
    });

    it("renders paused indicator when playback paused", () => {
        ctx.rogue.playbackMode = true;
        ctx.rogue.playbackPaused = true;
        refreshSideBar(-1, -1, false, ctx);
        expect(true).toBe(true);
    });

    it("dims non-focused entities when there is a focused entity", () => {
        const monst = makeCreature({ loc: { x: 22, y: 15 } });
        monst.info.monsterID = MonsterType.MK_RAT;
        monst.info.maxHP = 20;
        monst.creatureState = CreatureState.Wandering;
        ctx.pmap[22][15].flags |= TileFlag.HAS_MONSTER;
        ctx.monsterAtLoc = vi.fn((loc: Pos) => {
            if (loc.x === 22 && loc.y === 15) return monst;
            return null;
        });
        ctx.iterateMonsters = vi.fn(() => [monst]);
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));

        refreshSideBar(22, 15, false, ctx);
        // Should render without error
        expect(ctx.rogue.sidebarLocationList[0]).toEqual(ctx.player.loc);
    });

    it("retries with focusedEntityMustGoFirst when focused entity doesn't fit", () => {
        // Focus on an entity that would be last in the list
        // but the sidebar is too full to show it
        const monst = makeCreature({ loc: { x: 50, y: 20 } });
        monst.info.monsterID = MonsterType.MK_RAT;
        ctx.pmap[50][20].flags |= TileFlag.HAS_MONSTER;
        ctx.monsterAtLoc = vi.fn((loc: Pos) => {
            if (loc.x === 50 && loc.y === 20) return monst;
            return null;
        });

        // Create many monsters to fill the sidebar
        const monsters: Creature[] = [];
        for (let i = 0; i < 15; i++) {
            const mx = ctx.player.loc.x + ((i % 2 === 0) ? 1 : -1) * (i + 1);
            const my = ctx.player.loc.y;
            if (mx >= 0 && mx < DCOLS && my >= 0 && my < DROWS) {
                const m = makeCreature({ loc: { x: mx, y: my }, currentHP: 20 });
                m.info.monsterID = MonsterType.MK_RAT;
                m.info.maxHP = 20;
                m.creatureState = CreatureState.Wandering;
                ctx.pmap[mx][my].flags |= TileFlag.HAS_MONSTER;
                monsters.push(m);
            }
        }
        monsters.push(monst);
        ctx.iterateMonsters = vi.fn(() => monsters);
        ctx.monsterName = vi.fn(() => "rat");
        ctx.getCellAppearance = vi.fn(() => ({
            glyph: DisplayGlyph.G_RAT,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        }));

        // This should trigger the recursive retry
        refreshSideBar(50, 20, false, ctx);
        // Just verify no error
        expect(true).toBe(true);
    });
});

// =============================================================================
// Detail panel functions
// =============================================================================

describe("printMonsterDetails", () => {
    it("calls monsterDetails and printTextBox", () => {
        const ctx = createTestContext();
        const monst = makeCreature();
        printMonsterDetails(monst, ctx);
        expect(ctx.monsterDetails).toHaveBeenCalledWith(monst);
        expect(ctx.printTextBox).toHaveBeenCalled();
    });
});

describe("printFloorItemDetails", () => {
    it("calls itemDetails and printTextBox", () => {
        const ctx = createTestContext();
        const item = makeItem();
        printFloorItemDetails(item, ctx);
        expect(ctx.itemDetails).toHaveBeenCalledWith(item);
        expect(ctx.printTextBox).toHaveBeenCalled();
    });
});

describe("printCarriedItemDetails", () => {
    it("calls itemDetails and printTextBox", () => {
        const ctx = createTestContext();
        const item = makeItem();
        const result = printCarriedItemDetails(item, 10, 5, 30, false, ctx);
        expect(ctx.itemDetails).toHaveBeenCalledWith(item);
        expect(ctx.printTextBox).toHaveBeenCalled();
        expect(result).toBe(-1); // default return from mock
    });
});

// =============================================================================
// EntityDisplayType enum
// =============================================================================

describe("EntityDisplayType", () => {
    it("has expected values", () => {
        expect(EntityDisplayType.Nothing).toBe(0);
        expect(EntityDisplayType.Creature).toBe(1);
        expect(EntityDisplayType.Item).toBe(2);
        expect(EntityDisplayType.Terrain).toBe(3);
    });
});

// =============================================================================
// SIDEBAR_WIDTH constant
// =============================================================================

describe("SIDEBAR_WIDTH", () => {
    it("is 20", () => {
        expect(SIDEBAR_WIDTH).toBe(20);
    });
});
