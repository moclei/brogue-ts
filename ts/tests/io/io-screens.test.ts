/*
 *  io-screens.test.ts — Tests for io-screens.ts (info screens)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    COLS, ROWS, DCOLS, DROWS,
    STAT_BAR_WIDTH,
    INTERFACE_OPACITY,
    HIGH_SCORES_COUNT,
    FEAT_NAME_LENGTH,
} from "../../src/types/constants.js";
import {
    DisplayGlyph as G,
    ItemCategory,
    StaffKind,
    RingKind,
    GameMode,
} from "../../src/types/enums.js";
import type { Color, ScreenDisplayBuffer, SavedDisplayBuffer, ItemTable } from "../../src/types/types.js";
import { createScreenDisplayBuffer } from "../../src/io/io-display.js";
import { black, white, itemMessageColor, goodMessageColor } from "../../src/globals/colors.js";
import {
    type ScreenContext,
    type RogueHighScoresEntry,
    type FeatEntry,
    printHelpScreen,
    displayFeatsScreen,
    printDiscoveriesScreen,
    printHighScores,
    displayGrid,
    printSeed,
} from "../../src/io/io-screens.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDance: false };
}

function makeItemTable(overrides: Partial<ItemTable> = {}): ItemTable {
    return {
        name: "test item",
        flavor: "",
        callTitle: "",
        frequency: 10,
        marketValue: 0,
        strengthRequired: 0,
        power: 0,
        range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: false,
        called: false,
        magicPolarity: 0,
        magicPolarityRevealed: false,
        description: "",
        ...overrides,
    };
}

function makeFeat(name: string, desc: string, initialValue = true): FeatEntry {
    return { name, description: desc, initialValue };
}

function createCtx(overrides: Partial<ScreenContext> = {}): ScreenContext {
    const savedBuf = createScreenDisplayBuffer();
    return {
        rogue: {
            seed: 12345,
            playerTurnNumber: 100,
            hideSeed: false,
            mode: GameMode.Normal,
            featRecord: [true, true, false, false],
            updatedSafetyMapThisTurn: true,
        },
        player: { loc: { x: 10, y: 10 } },
        gameConst: {
            numberFeats: 4,
            numberScrollKinds: 3,
            numberPotionKinds: 3,
            numberWandKinds: 3,
            versionString: "1.13",
        },
        featTable: [
            makeFeat("Pure Mage", "Ascend without using a weapon.", true),
            makeFeat("Pure Warrior", "Ascend without using a staff.", true),
            makeFeat("Companion", "Explore 13 depths with an ally.", false),
            makeFeat("Specialist", "Enchant an item to +16.", false),
        ],
        boltCatalog: [],
        scrollTable: [
            makeItemTable({ name: "scroll of enchanting", identified: true }),
            makeItemTable({ name: "scroll of identify", identified: false, frequency: 20 }),
            makeItemTable({ name: "scroll of teleport", identified: false, frequency: 10 }),
        ],
        potionTable: [
            makeItemTable({ name: "potion of life", identified: true }),
            makeItemTable({ name: "potion of strength", identified: false, frequency: 15 }),
            makeItemTable({ name: "potion of telepathy", identified: false, frequency: 5 }),
        ],
        ringTable: Array.from({ length: RingKind.NumberRingKinds }, (_, i) =>
            makeItemTable({ name: `ring ${i}`, identified: i % 2 === 0 }),
        ),
        staffTable: Array.from({ length: StaffKind.NumberStaffKinds }, (_, i) =>
            makeItemTable({ name: `staff ${i}`, identified: i < 3 }),
        ),
        wandTable: [
            makeItemTable({ name: "wand of teleport" }),
            makeItemTable({ name: "wand of slow" }),
            makeItemTable({ name: "wand of polymorph" }),
        ],

        printString: vi.fn(),
        plotCharToBuffer: vi.fn(),
        plotCharWithColor: vi.fn(),
        strLenWithoutEscapes: vi.fn((s: string) => s.replace(/\x1b\[[^m]*m/g, "").length),
        encodeMessageColor: vi.fn((_c: Readonly<Color>) => "\x07\x01\x02\x03"),

        applyColorAverage: vi.fn((target: Color, source: Readonly<Color>, weight: number) => {
            target.red = Math.round(target.red + (source.red - target.red) * weight / 100);
            target.green = Math.round(target.green + (source.green - target.green) * weight / 100);
            target.blue = Math.round(target.blue + (source.blue - target.blue) * weight / 100);
        }),

        createScreenDisplayBuffer: vi.fn(() => createScreenDisplayBuffer()),
        clearDisplayBuffer: vi.fn(),
        saveDisplayBuffer: vi.fn(() => savedBuf as unknown as SavedDisplayBuffer),
        restoreDisplayBuffer: vi.fn(),
        overlayDisplayBuffer: vi.fn(),
        blackOutScreen: vi.fn(),
        commitDraws: vi.fn(),

        mapToWindowX: vi.fn((x: number) => x + STAT_BAR_WIDTH + 1),
        mapToWindowY: vi.fn((y: number) => y),
        mapToWindow: vi.fn((p: { x: number; y: number }) => ({
            x: p.x + STAT_BAR_WIDTH + 1,
            y: p.y,
        })),

        waitForAcknowledgment: vi.fn(),
        waitForKeystrokeOrMouseClick: vi.fn(),

        message: vi.fn(),
        updateFlavorText: vi.fn(),
        updateMessageDisplay: vi.fn(),

        getHighScoresList: vi.fn(() => ({
            list: [
                { score: 10000, date: "2026-01-01", description: "Killed by a dragon on depth 20" },
                { score: 5000, date: "2026-01-02", description: "Starved on depth 10" },
                { score: 0, date: "", description: "" },
            ] as RogueHighScoresEntry[],
            mostRecentLine: 0,
        })),

        cellHasTerrainFlag: vi.fn(() => false),
        getCellAppearance: vi.fn(() => ({
            glyph: G.G_FLOOR as unknown as import("../../src/types/enums.js").DisplayGlyph,
            foreColor: makeColor(50, 50, 50),
            backColor: makeColor(0, 0, 0),
        })),

        safetyMap: null,
        updateSafetyMap: vi.fn(),

        tableForItemCategory: vi.fn((cat: number) => {
            const self = createCtx();
            switch (cat) {
                case ItemCategory.SCROLL: return overrides.scrollTable ?? self.scrollTable;
                case ItemCategory.POTION: return overrides.potionTable ?? self.potionTable;
                case ItemCategory.RING: return overrides.ringTable ?? self.ringTable;
                case ItemCategory.STAFF: return overrides.staffTable ?? self.staffTable;
                case ItemCategory.WAND: return overrides.wandTable ?? self.wandTable;
                default: return null;
            }
        }),
        magicCharDiscoverySuffix: vi.fn((_cat: number, _kind: number) => 1),
        upperCase: vi.fn((s: string) => s.toUpperCase()),

        wizardMode: false,

        ...overrides,
    };
}

// =============================================================================
// printHelpScreen
// =============================================================================

describe("printHelpScreen", () => {
    let ctx: ScreenContext;

    beforeEach(() => {
        ctx = createCtx();
    });

    it("saves and restores the display buffer", () => {
        printHelpScreen(ctx);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalledOnce();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("creates and clears a display buffer", () => {
        printHelpScreen(ctx);
        expect(ctx.createScreenDisplayBuffer).toHaveBeenCalledOnce();
        expect(ctx.clearDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("prints help text lines to the buffer", () => {
        printHelpScreen(ctx);
        // Should have printed at least the title line and command lines
        expect(ctx.printString).toHaveBeenCalled();
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        // At least several lines of help text
        expect(calls.length).toBeGreaterThanOrEqual(10);
    });

    it("replaces **** with color escape sequences", () => {
        printHelpScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        // None of the printed strings should contain ****
        for (const call of calls) {
            expect(call[0]).not.toContain("****");
        }
    });

    it("sets opacity to INTERFACE_OPACITY on map area cells", () => {
        const dbuf = createScreenDisplayBuffer();
        (ctx.createScreenDisplayBuffer as ReturnType<typeof vi.fn>).mockReturnValue(dbuf);
        printHelpScreen(ctx);
        // Check a cell in the map area
        const mapX = (ctx.mapToWindowX as ReturnType<typeof vi.fn>)(0);
        expect(dbuf.cells[mapX][0].opacity).toBe(INTERFACE_OPACITY);
    });

    it("overlays the display buffer", () => {
        printHelpScreen(ctx);
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("waits for acknowledgment", () => {
        printHelpScreen(ctx);
        expect(ctx.waitForAcknowledgment).toHaveBeenCalledOnce();
    });

    it("updates flavor text and message display after restore", () => {
        printHelpScreen(ctx);
        expect(ctx.updateFlavorText).toHaveBeenCalledOnce();
        expect(ctx.updateMessageDisplay).toHaveBeenCalledOnce();
    });
});

// =============================================================================
// displayFeatsScreen
// =============================================================================

describe("displayFeatsScreen", () => {
    let ctx: ScreenContext;

    beforeEach(() => {
        ctx = createCtx();
    });

    it("creates and clears a display buffer", () => {
        displayFeatsScreen(ctx);
        expect(ctx.createScreenDisplayBuffer).toHaveBeenCalledOnce();
        expect(ctx.clearDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("prints the title", () => {
        displayFeatsScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const titleCall = calls.find((c: unknown[]) => (c[0] as string).includes("-- FEATS --"));
        expect(titleCall).toBeDefined();
    });

    it("prints one line per feat", () => {
        displayFeatsScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        // Should print feat lines — 4 feats + title + legend lines
        expect(calls.length).toBeGreaterThanOrEqual(ctx.gameConst.numberFeats + 1);
    });

    it("prints the legend section", () => {
        displayFeatsScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const legendCall = calls.find((c: unknown[]) => (c[0] as string).includes("-- LEGEND --"));
        expect(legendCall).toBeDefined();
    });

    it("prints continue instruction", () => {
        displayFeatsScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const continueCall = calls.find((c: unknown[]) => (c[0] as string).includes("press any key to continue"));
        expect(continueCall).toBeDefined();
    });

    it("sets opacity: 0 for sidebar, INTERFACE_OPACITY for rest", () => {
        const dbuf = createScreenDisplayBuffer();
        (ctx.createScreenDisplayBuffer as ReturnType<typeof vi.fn>).mockReturnValue(dbuf);
        displayFeatsScreen(ctx);
        // Sidebar area should be 0
        expect(dbuf.cells[0][0].opacity).toBe(0);
        expect(dbuf.cells[STAT_BAR_WIDTH - 1][0].opacity).toBe(0);
        // Map area should be INTERFACE_OPACITY
        expect(dbuf.cells[STAT_BAR_WIDTH][0].opacity).toBe(INTERFACE_OPACITY);
    });

    it("saves and restores display buffer", () => {
        displayFeatsScreen(ctx);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalledOnce();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("waits for keystroke or mouse click", () => {
        displayFeatsScreen(ctx);
        expect(ctx.waitForKeystrokeOrMouseClick).toHaveBeenCalledOnce();
    });

    it("shows achieved status with + marker for achieved feats", () => {
        // featRecord[2] = true, but initialValue for feat[2] is false, so this is "achieved"
        ctx.rogue.featRecord = [true, true, true, false];
        displayFeatsScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        // Find the call for feat index 2 (Companion)
        const companionCall = calls.find((c: unknown[]) => (c[0] as string).includes("Companion"));
        expect(companionCall).toBeDefined();
        expect((companionCall![0] as string)).toContain("+");
    });

    it("shows failed status with - marker for failed feats", () => {
        // featRecord[0] = false, initialValue[0] = true → failed
        ctx.rogue.featRecord = [false, true, false, false];
        displayFeatsScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const pureMageCall = calls.find((c: unknown[]) => (c[0] as string).includes("Pure Mage"));
        expect(pureMageCall).toBeDefined();
        expect((pureMageCall![0] as string)).toContain("-");
    });
});

// =============================================================================
// printDiscoveriesScreen
// =============================================================================

describe("printDiscoveriesScreen", () => {
    let ctx: ScreenContext;

    beforeEach(() => {
        ctx = createCtx();
    });

    it("saves and restores display buffer", () => {
        printDiscoveriesScreen(ctx);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalledOnce();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("creates and clears a display buffer", () => {
        printDiscoveriesScreen(ctx);
        expect(ctx.createScreenDisplayBuffer).toHaveBeenCalledOnce();
        expect(ctx.clearDisplayBuffer).toHaveBeenCalledOnce();
    });

    it("prints category headers for scrolls, rings, potions, staffs, wands", () => {
        printDiscoveriesScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const headers = calls.map((c: unknown[]) => c[0] as string);
        expect(headers.some(h => h.includes("-- SCROLLS --"))).toBe(true);
        expect(headers.some(h => h.includes("-- RINGS --"))).toBe(true);
        expect(headers.some(h => h.includes("-- POTIONS --"))).toBe(true);
        expect(headers.some(h => h.includes("-- STAFFS --"))).toBe(true);
        expect(headers.some(h => h.includes("-- WANDS --"))).toBe(true);
    });

    it("prints continue instruction", () => {
        printDiscoveriesScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const continueCall = calls.find((c: unknown[]) => (c[0] as string).includes("press any key to continue"));
        expect(continueCall).toBeDefined();
    });

    it("sets opacity: 0 for sidebar, INTERFACE_OPACITY for rest", () => {
        const dbuf = createScreenDisplayBuffer();
        (ctx.createScreenDisplayBuffer as ReturnType<typeof vi.fn>).mockReturnValue(dbuf);
        printDiscoveriesScreen(ctx);
        expect(dbuf.cells[0][0].opacity).toBe(0);
        expect(dbuf.cells[STAT_BAR_WIDTH][0].opacity).toBe(INTERFACE_OPACITY);
    });

    it("waits for keystroke or mouse click", () => {
        printDiscoveriesScreen(ctx);
        expect(ctx.waitForKeystrokeOrMouseClick).toHaveBeenCalledOnce();
    });

    it("calls tableForItemCategory for each displayed category", () => {
        printDiscoveriesScreen(ctx);
        const fn = ctx.tableForItemCategory as ReturnType<typeof vi.fn>;
        const calledWith = fn.mock.calls.map((c: unknown[]) => c[0]);
        expect(calledWith).toContain(ItemCategory.SCROLL);
        expect(calledWith).toContain(ItemCategory.POTION);
        expect(calledWith).toContain(ItemCategory.RING);
        expect(calledWith).toContain(ItemCategory.STAFF);
        expect(calledWith).toContain(ItemCategory.WAND);
    });

    it("calls magicCharDiscoverySuffix for unidentified items", () => {
        printDiscoveriesScreen(ctx);
        expect(ctx.magicCharDiscoverySuffix).toHaveBeenCalled();
    });

    it("plots good magic icon for items with positive magic suffix", () => {
        (ctx.magicCharDiscoverySuffix as ReturnType<typeof vi.fn>).mockReturnValue(1);
        printDiscoveriesScreen(ctx);
        const calls = (ctx.plotCharToBuffer as ReturnType<typeof vi.fn>).mock.calls;
        const goodMagicCalls = calls.filter((c: unknown[]) => c[0] === G.G_GOOD_MAGIC);
        expect(goodMagicCalls.length).toBeGreaterThan(0);
    });

    it("plots bad magic icon for items with negative magic suffix", () => {
        (ctx.magicCharDiscoverySuffix as ReturnType<typeof vi.fn>).mockReturnValue(-1);
        printDiscoveriesScreen(ctx);
        const calls = (ctx.plotCharToBuffer as ReturnType<typeof vi.fn>).mock.calls;
        const badMagicCalls = calls.filter((c: unknown[]) => c[0] === G.G_BAD_MAGIC);
        expect(badMagicCalls.length).toBeGreaterThan(0);
    });

    it("plots item glyph for identified items", () => {
        // Make first scroll identified
        const scrolls = [
            makeItemTable({ name: "scroll of enchanting", identified: true }),
            makeItemTable({ name: "scroll of identify", identified: false }),
            makeItemTable({ name: "scroll of teleport", identified: false }),
        ];
        ctx = createCtx({ scrollTable: scrolls });
        printDiscoveriesScreen(ctx);
        const calls = (ctx.plotCharToBuffer as ReturnType<typeof vi.fn>).mock.calls;
        const scrollGlyphCalls = calls.filter((c: unknown[]) => c[0] === G.G_SCROLL);
        expect(scrollGlyphCalls.length).toBeGreaterThan(0);
    });

    it("uppercases item names", () => {
        printDiscoveriesScreen(ctx);
        expect(ctx.upperCase).toHaveBeenCalled();
    });

    it("shows frequency percentage for unidentified items", () => {
        printDiscoveriesScreen(ctx);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        // Find strings that contain a percentage
        const withPercent = calls.filter((c: unknown[]) => (c[0] as string).match(/\(\d+%\)/));
        expect(withPercent.length).toBeGreaterThan(0);
    });
});

// =============================================================================
// printHighScores
// =============================================================================

describe("printHighScores", () => {
    let ctx: ScreenContext;

    beforeEach(() => {
        ctx = createCtx();
    });

    it("calls getHighScoresList", () => {
        printHighScores(ctx, true);
        expect(ctx.getHighScoresList).toHaveBeenCalledOnce();
    });

    it("calls blackOutScreen", () => {
        printHighScores(ctx, true);
        expect(ctx.blackOutScreen).toHaveBeenCalledOnce();
    });

    it("prints the title line", () => {
        printHighScores(ctx, true);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const titleCall = calls.find((c: unknown[]) => (c[0] as string).includes("-- HIGH SCORES --"));
        expect(titleCall).toBeDefined();
    });

    it("prints score entries with rank, score, date, description", () => {
        printHighScores(ctx, true);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        // Should print rank "1)" and "2)" (2 non-zero scores)
        const rankCalls = calls.filter((c: unknown[]) => (c[0] as string).match(/\d+\)/));
        expect(rankCalls.length).toBe(2);
        // Should print score values
        const scoreCalls = calls.filter((c: unknown[]) => (c[0] as string) === "10000" || (c[0] as string) === "5000");
        expect(scoreCalls.length).toBe(2);
    });

    it("prints footer with continue instruction", () => {
        printHighScores(ctx, true);
        const calls = (ctx.printString as ReturnType<typeof vi.fn>).mock.calls;
        const footerCall = calls.find((c: unknown[]) =>
            (c[0] as string).includes("Press space to continue") || (c[0] as string).includes("Touch anywhere"),
        );
        expect(footerCall).toBeDefined();
    });

    it("calls commitDraws and waitForAcknowledgment", () => {
        printHighScores(ctx, true);
        expect(ctx.commitDraws).toHaveBeenCalledOnce();
        expect(ctx.waitForAcknowledgment).toHaveBeenCalledOnce();
    });

    it("uses hilite for most recent entry when hiliteMostRecent is true", () => {
        // The mostRecentLine is 0. applyColorAverage should be called with
        // itemMessageColor for that line (hilited) and white for the rest.
        printHighScores(ctx, true);
        const calls = (ctx.applyColorAverage as ReturnType<typeof vi.fn>).mock.calls;
        // Check that itemMessageColor was used in at least one call (for hilited line)
        const itemMsgCalls = calls.filter((c: unknown[]) => c[1] === itemMessageColor);
        expect(itemMsgCalls.length).toBeGreaterThan(0);
    });

    it("does not hilite when hiliteMostRecent is false", () => {
        printHighScores(ctx, false);
        // hiliteLineNum should be -1, so no line matches
        // applyColorAverage for score lines should use white, not itemMessageColor
        const calls = (ctx.applyColorAverage as ReturnType<typeof vi.fn>).mock.calls;
        // Title uses itemMessageColor, scores use white
        // For the two score entries (i=0, i=1), they should use white
        // Each score entry: 1 call with white + 1 call with black
        // Can't easily assert the exact calls, but verify no entry gets itemMessageColor blend
        // (except the title which always does)
        // The title blend is the first one. After that, score lines should use white.
        // With hiliteMostRecent=false, score line 0 should NOT use itemMessageColor
        const scoreCalls = calls.slice(1); // skip title
        // Score lines are in pairs: first blend with white, second with black
        // None of the score lines should blend with itemMessageColor
        const itemMsgScoreCalls = scoreCalls.filter(
            (c: unknown[]) => c[1] === itemMessageColor,
        );
        // Only the footer uses goodMessageColor. No score line should use itemMessageColor.
        expect(itemMsgScoreCalls.length).toBe(0);
    });

    it("handles empty high scores list", () => {
        (ctx.getHighScoresList as ReturnType<typeof vi.fn>).mockReturnValue({
            list: [],
            mostRecentLine: -1,
        });
        printHighScores(ctx, true);
        // Should still print title and footer
        expect(ctx.printString).toHaveBeenCalled();
        expect(ctx.commitDraws).toHaveBeenCalled();
    });
});

// =============================================================================
// displayGrid
// =============================================================================

describe("displayGrid", () => {
    let ctx: ScreenContext;
    let map: number[][];

    beforeEach(() => {
        // Create a small grid
        map = Array.from({ length: DCOLS }, () => Array.from({ length: DROWS }, () => 0));
        // Set some values
        map[0][0] = 30000; // sentinel value (map[0][0] is skipped)
        map[5][5] = 10;
        map[6][6] = 20;
        map[7][7] = 30;
        ctx = createCtx();
    });

    it("skips cells at player location", () => {
        ctx.player.loc = { x: 5, y: 5 };
        displayGrid(ctx, map);
        const calls = (ctx.plotCharWithColor as ReturnType<typeof vi.fn>).mock.calls;
        // Should not plot at player location
        const playerPlots = calls.filter(
            (c: unknown[]) => {
                const loc = c[1] as { x: number; y: number };
                return loc.x === (ctx.mapToWindow as ReturnType<typeof vi.fn>)({ x: 5, y: 5 }).x
                    && loc.y === (ctx.mapToWindow as ReturnType<typeof vi.fn>)({ x: 5, y: 5 }).y;
            },
        );
        expect(playerPlots.length).toBe(0);
    });

    it("skips cells matching map[0][0] (sentinel value)", () => {
        // All cells that equal map[0][0] (30000) should be skipped
        map[3][3] = 30000;
        displayGrid(ctx, map);
        const calls = (ctx.plotCharWithColor as ReturnType<typeof vi.fn>).mock.calls;
        // cell (3,3) should be skipped since map[3][3] === map[0][0]
        const plotAt33 = calls.filter((c: unknown[]) => {
            const loc = c[1] as { x: number; y: number };
            return loc.x === (ctx.mapToWindow as ReturnType<typeof vi.fn>)({ x: 3, y: 3 }).x
                && loc.y === (ctx.mapToWindow as ReturnType<typeof vi.fn>)({ x: 3, y: 3 }).y;
        });
        expect(plotAt33.length).toBe(0);
    });

    it("skips cells with T_WAYPOINT_BLOCKER terrain flags", () => {
        (ctx.cellHasTerrainFlag as ReturnType<typeof vi.fn>).mockReturnValue(true);
        displayGrid(ctx, map);
        // No plotCharWithColor calls should be made
        expect(ctx.plotCharWithColor).not.toHaveBeenCalled();
    });

    it("calls getCellAppearance for rendered cells", () => {
        displayGrid(ctx, map);
        expect(ctx.getCellAppearance).toHaveBeenCalled();
    });

    it("generates heat-map colors based on map values", () => {
        // Fill the whole grid with the sentinel so only specific cells render
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                map[i][j] = 30000;
            }
        }
        // Place two cells with very different values
        map[1][1] = 0;    // bottom of range
        map[2][2] = 100;  // top of range
        // Player is at (10,10), sentinel is 30000
        displayGrid(ctx, map);
        const calls = (ctx.plotCharWithColor as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBe(2);
        const color1 = calls[0][3] as Color;
        const color2 = calls[1][3] as Color;
        // The two cells have min vs max values, so colors must differ
        expect(
            color1.red !== color2.red ||
            color1.green !== color2.green ||
            color1.blue !== color2.blue,
        ).toBe(true);
    });

    it("updates safety map if map is safetyMap and not updated this turn", () => {
        const safetyMap = map;
        ctx.safetyMap = safetyMap;
        ctx.rogue.updatedSafetyMapThisTurn = false;
        displayGrid(ctx, safetyMap);
        expect(ctx.updateSafetyMap).toHaveBeenCalledOnce();
    });

    it("does not update safety map if already updated this turn", () => {
        const safetyMap = map;
        ctx.safetyMap = safetyMap;
        ctx.rogue.updatedSafetyMapThisTurn = true;
        displayGrid(ctx, safetyMap);
        expect(ctx.updateSafetyMap).not.toHaveBeenCalled();
    });

    it("does not update safety map if map is not safetyMap", () => {
        ctx.safetyMap = Array.from({ length: DCOLS }, () => Array.from({ length: DROWS }, () => 0));
        ctx.rogue.updatedSafetyMapThisTurn = false;
        displayGrid(ctx, map);
        expect(ctx.updateSafetyMap).not.toHaveBeenCalled();
    });
});

// =============================================================================
// printSeed
// =============================================================================

describe("printSeed", () => {
    let ctx: ScreenContext;

    beforeEach(() => {
        ctx = createCtx();
    });

    it("displays seed number when not hidden", () => {
        ctx.rogue.hideSeed = false;
        ctx.rogue.seed = 12345;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBe(1);
        expect(calls[0][0]).toContain("12345");
        expect(calls[0][0]).toContain("Dungeon seed #");
    });

    it("displays HIDDEN when seed is hidden", () => {
        ctx.rogue.hideSeed = true;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).toContain("Dungeon seed HIDDEN");
    });

    it("includes turn number", () => {
        ctx.rogue.playerTurnNumber = 42;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).toContain("turn #42");
    });

    it("includes version string", () => {
        ctx.gameConst.versionString = "1.13";
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).toContain("version 1.13");
    });

    it("includes 'easy mode' prefix when in easy mode", () => {
        ctx.rogue.mode = GameMode.Easy;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).toContain("easy mode");
    });

    it("includes 'wizard mode' prefix when wizardMode is true", () => {
        ctx.wizardMode = true;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).toContain("wizard mode");
    });

    it("does not include mode prefix in normal mode", () => {
        ctx.rogue.mode = GameMode.Normal;
        ctx.wizardMode = false;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).not.toContain("easy mode");
        expect(calls[0][0]).not.toContain("wizard mode");
    });

    it("passes message flag 0", () => {
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][1]).toBe(0);
    });

    it("handles bigint seed", () => {
        ctx.rogue.seed = BigInt("123456789012345");
        ctx.rogue.hideSeed = false;
        printSeed(ctx);
        const calls = (ctx.message as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls[0][0]).toContain("123456789012345");
    });
});
