/*
 *  main-menu.test.ts — Tests for main-menu.ts (title screen, menus, dialogs, stats)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { COLS, ROWS, INTERFACE_OPACITY, KEYBOARD_LABELS, RETURN_KEY, ACKNOWLEDGE_KEY } from "../../src/types/constants.js";
import { NGCommand, GameMode, GameVariant, EventType, ButtonDrawState, TextEntryType } from "../../src/types/enums.js";
import { ButtonFlag } from "../../src/types/flags.js";
import type { Color, BrogueButton, ButtonState, ScreenDisplayBuffer, RogueEvent, SavedDisplayBuffer, WindowPos, PauseBehavior, DisplayGlyph, GameConstants } from "../../src/types/types.js";
import { createScreenDisplayBuffer, clearDisplayBuffer } from "../../src/io/io-display.js";
import {
    type MenuContext,
    type MenuRogueState,
    type FileEntry,
    type RogueRun,
    type FlameGrid,
    type FlameColorGrid,
    type ColorSource,
    type FlameMask,
    createFlameGrid,
    createFlameMask,
    createFlameColorGrid,
    createColorSources,
    antiAlias,
    initializeMenuFlames,
    updateMenuFlames,
    drawMenuFlames,
    initializeMainMenuButton,
    initializeMainMenuButtons,
    stackButtons,
    initializeMenu,
    initializeMainMenu,
    initializeFlyoutMenu,
    isFlyoutActive,
    getNextGameButtonPos,
    redrawMainMenuButtons,
    chooseGameVariant,
    chooseGameMode,
    dialogAlert,
    dialogChooseFile,
    quitImmediately,
    createGameStats,
    addRunToGameStats,
    viewGameStats,
    titleMenu,
    mainBrogueJunction,
    MENU_FLAME_ROW_PADDING,
    MENU_FLAME_PRECISION_FACTOR,
} from "../../src/menus/main-menu.js";

// =============================================================================
// Helpers
// =============================================================================

function makeColor(r = 0, g = 0, b = 0): Color {
    return { red: r, green: g, blue: b, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };
}

function makeRogueState(overrides: Partial<MenuRogueState> = {}): MenuRogueState {
    return {
        mode: GameMode.Normal,
        nextGame: NGCommand.Nothing,
        nextGamePath: "",
        nextGameSeed: 0n,
        currentGamePath: "",
        gameHasEnded: false,
        gameInProgress: false,
        quit: false,
        playbackMode: false,
        playbackFastForward: false,
        playbackPaused: false,
        playbackBetweenTurns: false,
        playbackOOS: false,
        recording: false,
        depthLevel: 1,
        creaturesWillFlashThisTurn: false,
        seed: 0n,
        patchVersion: 0,
        ...overrides,
    };
}

function makeGameConst(overrides: Partial<GameConstants> = {}): GameConstants {
    return {
        versionString: "v1.0.0",
        mainMenuTitleWidth: 5,
        mainMenuTitleHeight: 2,
        deepestLevel: 26,
        amuletLevel: 26,
        ...overrides,
    } as GameConstants;
}

function makeButton(overrides: Partial<BrogueButton> = {}): BrogueButton {
    return {
        text: "Test",
        x: 0,
        y: 0,
        hotkey: [],
        buttonColor: makeColor(20, 20, 40),
        textColor: makeColor(100, 100, 100),
        hotkeyTextColor: makeColor(100, 100, 0),
        opacity: 100,
        symbol: [],
        flags: ButtonFlag.B_ENABLED | ButtonFlag.B_DRAW,
        command: NGCommand.Nothing,
        ...overrides,
    };
}

let callCount = 0;
function createCtx(overrides: Partial<MenuContext> = {}): MenuContext {
    callCount = 0;
    return {
        rogue: makeRogueState(),
        gameConst: makeGameConst(),
        gameVariant: GameVariant.Brogue,
        mainMenuTitle: "BROGUEBROGUE",
        isApplicationActive: vi.fn(() => true),
        serverMode: false,
        nonInteractivePlayback: false,
        wizardMode: false,
        previousGameSeed: 0n,
        randomNumbersGenerated: 0,
        setRandomNumbersGenerated: vi.fn(),
        currentFilePath: "",
        setCurrentFilePath: vi.fn(),
        setGameVariant: vi.fn(),
        seedRandomGenerator: vi.fn((s: bigint) => s),
        rand_range: vi.fn((lo: number, hi: number) => lo),
        applyColorAverage: vi.fn((base: Color, target: Readonly<Color>, weight: number) => {
            base.red = Math.round(base.red + (target.red - base.red) * weight / 100);
            base.green = Math.round(base.green + (target.green - base.green) * weight / 100);
            base.blue = Math.round(base.blue + (target.blue - base.blue) * weight / 100);
        }),
        strLenWithoutEscapes: vi.fn((s: string) => s.length),
        encodeMessageColor: vi.fn(() => ""),
        plotCharWithColor: vi.fn(() => true),
        locIsInWindow: vi.fn(() => true),
        createScreenDisplayBuffer,
        clearDisplayBuffer,
        overlayDisplayBuffer: vi.fn(),
        saveDisplayBuffer: vi.fn(() => ({ savedScreen: createScreenDisplayBuffer() }) as SavedDisplayBuffer),
        restoreDisplayBuffer: vi.fn(),
        blackOutScreen: vi.fn(),
        commitDraws: vi.fn(),
        printString: vi.fn(),
        initializeButton: vi.fn(() => makeButton()),
        setButtonText: vi.fn((btn: BrogueButton, hotkey: string, _noHotkey: string) => {
            btn.text = hotkey;
        }),
        initializeButtonState: vi.fn((buttons: BrogueButton[], count: number, x: number, y: number, w: number, h: number): ButtonState => ({
            buttons,
            buttonCount: count,
            buttonFocused: -1,
            buttonDepressed: -1,
            buttonChosen: -1,
            winX: x,
            winY: y,
            winWidth: w,
            winHeight: h,
        })),
        drawButton: vi.fn(),
        drawButtonsInState: vi.fn(),
        processButtonInput: vi.fn(async () => ({ chosenButton: -1, canceled: false })),
        buttonInputLoop: vi.fn(async () => ({ chosenButton: -1, event: { eventType: EventType.Keystroke, param1: 0, param2: 0, controlKey: false, shiftKey: false } })),
        rectangularShading: vi.fn(),
        printTextBox: vi.fn(async () => -1),
        nextBrogueEvent: vi.fn(async () => ({
            eventType: EventType.Keystroke,
            param1: "q".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        })),
        pauseBrogue: vi.fn(async () => false),
        getInputTextString: vi.fn(async () => null),
        printHighScores: vi.fn(async () => {}),
        confirm: vi.fn(async () => true),
        waitForKeystrokeOrMouseClick: vi.fn(async () => {}),
        message: vi.fn(),
        smoothHiliteGradient: vi.fn((x: number, max: number) => Math.trunc(x * 100 / max)),
        initializeRogue: vi.fn(),
        startLevel: vi.fn(),
        mainInputLoop: vi.fn(),
        freeEverything: vi.fn(),
        initializeGameVariant: vi.fn(),
        initializeLaunchArguments: vi.fn(),
        flushBufferToFile: vi.fn(),
        saveGameNoPrompt: vi.fn(),
        saveRecordingNoPrompt: vi.fn(() => "test.broguerec"),
        getAvailableFilePath: vi.fn((prefix: string, suffix: string) => prefix + suffix),
        executeEvent: vi.fn(),
        displayAnnotation: vi.fn(),
        pausePlayback: vi.fn(),
        listFiles: vi.fn(() => []),
        loadRunHistory: vi.fn(() => []),
        saveResetRun: vi.fn(),
        openFile: vi.fn(() => true),
        black: makeColor(0, 0, 0),
        white: makeColor(100, 100, 100),
        yellow: makeColor(100, 100, 0),
        veryDarkGray: makeColor(5, 5, 5),
        flameSourceColor: makeColor(20, 7, 7),
        flameSourceColorSecondary: makeColor(7, 2, 0),
        flameTitleColor: makeColor(0, 0, 0),
        titleButtonColor: makeColor(23, 11, 7),
        itemMessageColor: makeColor(100, 90, 40),
        interfaceBoxColor: makeColor(7, 6, 15),
        goodMessageColor: makeColor(60, 50, 100),
        G_LEFT_TRIANGLE: 0x25c0 as DisplayGlyph,
        G_UP_ARROW: 0x2191 as DisplayGlyph,
        G_DOWN_ARROW: 0x2193 as DisplayGlyph,
        ...overrides,
    };
}

// =============================================================================
// Flame grid factories
// =============================================================================

describe("createFlameGrid", () => {
    it("creates a grid of COLS x (ROWS + PADDING) with zeroed RGB", async () => {
        const grid = createFlameGrid();
        expect(grid.length).toBe(COLS);
        expect(grid[0].length).toBe(ROWS + MENU_FLAME_ROW_PADDING);
        expect(grid[0][0]).toEqual([0, 0, 0]);
    });
});

describe("createFlameMask", () => {
    it("creates a grid of COLS x ROWS filled with zeros", async () => {
        const mask = createFlameMask();
        expect(mask.length).toBe(COLS);
        expect(mask[0].length).toBe(ROWS);
        expect(mask[0][0]).toBe(0);
    });
});

describe("createFlameColorGrid", () => {
    it("creates a grid of COLS x (ROWS + PADDING) filled with null", async () => {
        const grid = createFlameColorGrid();
        expect(grid.length).toBe(COLS);
        expect(grid[0].length).toBe(ROWS + MENU_FLAME_ROW_PADDING);
        expect(grid[0][0]).toBeNull();
    });
});

describe("createColorSources", () => {
    it("creates an array of color sources with initial random values", async () => {
        const ctx = createCtx();
        const sources = createColorSources(ctx);
        expect(sources.length).toBe(1136);
        expect(sources[0]).toHaveLength(4);
    });
});

// =============================================================================
// antiAlias
// =============================================================================

describe("antiAlias", () => {
    it("fills intermediate values at edges of solid mask regions", async () => {
        const mask = createFlameMask();
        // Create a 3×3 block so the center has 4 neighbors and edges have ≥2
        for (let i = 5; i <= 7; i++) {
            for (let j = 5; j <= 7; j++) {
                mask[i][j] = 100;
            }
        }

        antiAlias(mask);

        // Interior cells remain 100
        expect(mask[6][6]).toBe(100);

        // A cell adjacent to 2 block cells (e.g. (4, 5) borders (5,5) only → 1 neighbor → 0;
        // but (4, 6) borders (5,6) → 1 neighbor too.
        // Let's check a corner neighbor: (4, 5) borders (5,5) → 1 nb → 0.
        // (5, 4) borders (5,5) → 1 nb → 0.
        // Cell (4, 6) borders (5,6) → 1 nb → 0.
        // For nbCount ≥ 2, a cell like (8, 6) borders (7,6) only → 1 nb → 0 too.
        // Need a cell adjacent to ≥2 block cells: e.g. (4, 5) if we extend the block.

        // A corner of the block: cell at (4, 4) borders (5,4)=0 and (4,5)=100 → 1 nb → 0.
        // Cell at (5, 4) borders (5,5)=100 and (6,4)=0 → 1 nb → 0.
        // For 2 neighbors, we need cells at the edge indentation.
        // Outside corner: (8, 5) borders (7,5)=100 → 1 → 0; (8, 6) borders (7,6)=100 → 1 → 0.
        // Inside the set: all cells with value 100 keep 100.
        // The antiAlias with a 3x3 block actually only produces 0 outside (all have 1 100-neighbor max).
        // intensity = [0, 0, 35, 50, 60], so nbCount < 2 → 0.
        expect(mask[4][5]).toBe(0); // 1 neighbor → intensity[1] = 0
    });

    it("does not affect cells with zero neighbors", async () => {
        const mask = createFlameMask();
        antiAlias(mask);
        // All still zero
        for (let i = 0; i < COLS; i++) {
            for (let j = 0; j < ROWS; j++) {
                expect(mask[i][j]).toBe(0);
            }
        }
    });

    it("assigns correct values based on neighbor count", async () => {
        const mask = createFlameMask();
        // Create an L-shape so some cells have 2 block-neighbors:
        //  100 100
        //  100  0
        mask[10][10] = 100;
        mask[11][10] = 100;
        mask[10][11] = 100;

        antiAlias(mask);

        // Cell (11, 11) borders (10,11)=100 and (11,10)=100 → 2 neighbors → intensity[2] = 35
        expect(mask[11][11]).toBe(35);

        // Cell (9, 10) borders (10,10)=100 → 1 neighbor → intensity[1] = 0
        expect(mask[9][10]).toBe(0);
    });

    it("uses higher intensity for cells with more neighbors", async () => {
        const mask = createFlameMask();
        // Create a cross pattern centered at (10, 10):
        //     100
        // 100 100 100
        //     100
        mask[10][9] = 100;
        mask[9][10] = 100;
        mask[10][10] = 100;
        mask[11][10] = 100;
        mask[10][11] = 100;

        antiAlias(mask);

        // Cell (9, 9) borders (10,9)=100 and (9,10)=100 → 2 neighbors → 35
        expect(mask[9][9]).toBe(35);
        // Cell (11, 9) borders (10,9)=100 and (11,10)=100 → 2 neighbors → 35
        expect(mask[11][9]).toBe(35);
    });
});

// =============================================================================
// updateMenuFlames
// =============================================================================

describe("updateMenuFlames", () => {
    it("flames propagate from color sources upward", async () => {
        const flames = createFlameGrid();
        const colors = createFlameColorGrid();
        const ctx = createCtx();
        const sources = createColorSources(ctx);

        // Place a red color source near the bottom
        colors[10][ROWS + MENU_FLAME_ROW_PADDING - 1] = makeColor(50, 0, 0);

        for (let i = 0; i < 10; i++) {
            updateMenuFlames(colors, sources, flames, ctx);
        }

        // The cell above should have some red value
        const bottomFlame = flames[10][ROWS + MENU_FLAME_ROW_PADDING - 1][0];
        expect(bottomFlame).toBeGreaterThan(0);
    });
});

// =============================================================================
// drawMenuFlames
// =============================================================================

describe("drawMenuFlames", () => {
    it("calls plotCharWithColor for each cell", async () => {
        const ctx = createCtx();
        const flames = createFlameGrid();
        const mask = createFlameMask();
        const dbuf = createScreenDisplayBuffer();

        drawMenuFlames(flames, mask, ctx, dbuf);

        expect(ctx.plotCharWithColor).toHaveBeenCalledTimes(COLS * ROWS);
    });

    it("renders the version string in the bottom-right", async () => {
        const ctx = createCtx();
        (ctx.strLenWithoutEscapes as any).mockReturnValue(6);
        const flames = createFlameGrid();
        const mask = createFlameMask();
        const dbuf = createScreenDisplayBuffer();

        drawMenuFlames(flames, mask, ctx, dbuf);

        // Confirm the version string position: cells at ROWS - 1, COLS - 6 to COLS - 1
        const lastRowCalls = (ctx.plotCharWithColor as any).mock.calls.filter(
            (call: any[]) => call[1].windowY === ROWS - 1 && call[1].windowX >= COLS - 6,
        );
        expect(lastRowCalls.length).toBe(6);
        // The character should be from the version string
        expect(lastRowCalls[0][0]).toBe(ctx.gameConst.versionString.charCodeAt(0));
    });

    it("uses black with mask=100", async () => {
        const ctx = createCtx();
        const flames = createFlameGrid();
        const mask = createFlameMask();
        mask[5][5] = 100;
        const dbuf = createScreenDisplayBuffer();

        drawMenuFlames(flames, mask, ctx, dbuf);

        // For the cell at (5, 5), backColor should be ctx.black
        const call55 = (ctx.plotCharWithColor as any).mock.calls.find(
            (c: any[]) => c[1].windowX === 5 && c[1].windowY === 5,
        );
        expect(call55).toBeDefined();
        expect(call55[3]).toEqual(ctx.black); // backColor is black when mask=100
    });
});

// =============================================================================
// Menu button setup
// =============================================================================

describe("initializeMainMenuButton", () => {
    it("creates a button with the given hotkeys and command", async () => {
        const ctx = createCtx();
        const btn = initializeMainMenuButton(
            "  %sN%sew Game  ",
            "n".charCodeAt(0),
            "N".charCodeAt(0),
            NGCommand.NewGame,
            ctx,
        );
        expect(btn.hotkey).toEqual(["n".charCodeAt(0), "N".charCodeAt(0)]);
        expect(btn.command).toBe(NGCommand.NewGame);
        expect(btn.flags & ButtonFlag.B_WIDE_CLICK_AREA).toBeTruthy();
    });
});

describe("initializeMainMenuButtons", () => {
    it("creates 4 buttons with left triangles on the first 3", async () => {
        const ctx = createCtx();
        const buttons = initializeMainMenuButtons(ctx);
        expect(buttons).toHaveLength(4);
        // First 3 have symbols
        expect(buttons[0].symbol).toEqual([ctx.G_LEFT_TRIANGLE]);
        expect(buttons[1].symbol).toEqual([ctx.G_LEFT_TRIANGLE]);
        expect(buttons[2].symbol).toEqual([ctx.G_LEFT_TRIANGLE]);
    });
});

describe("stackButtons", () => {
    it("stacks buttons top-to-bottom with correct spacing", async () => {
        const buttons = [makeButton(), makeButton(), makeButton()];
        stackButtons(buttons, 3, 10, 5, 2, true);
        expect(buttons[0].x).toBe(10);
        expect(buttons[0].y).toBe(5);
        expect(buttons[1].y).toBe(7);
        expect(buttons[2].y).toBe(9);
    });

    it("stacks buttons bottom-to-top with correct spacing", async () => {
        const buttons = [makeButton(), makeButton(), makeButton()];
        stackButtons(buttons, 3, 10, 10, 2, false);
        expect(buttons[2].x).toBe(10);
        expect(buttons[2].y).toBe(10);
        expect(buttons[1].y).toBe(8);
        expect(buttons[0].y).toBe(6);
    });
});

// =============================================================================
// initializeMenu / initializeMainMenu
// =============================================================================

describe("initializeMenu", () => {
    it("creates button state and shadow buffer from positioned buttons", async () => {
        const ctx = createCtx();
        const buttons = [makeButton({ x: 10, y: 5, text: "Hello" }), makeButton({ x: 10, y: 7, text: "World" })];
        const { state, shadowBuf } = initializeMenu(buttons, 2, ctx);
        expect(state.buttonCount).toBe(2);
        expect(ctx.rectangularShading).toHaveBeenCalled();
    });
});

describe("initializeMainMenu", () => {
    it("creates 4 buttons stacked bottom-to-top from quit position", async () => {
        const ctx = createCtx();
        const { state, buttons, shadowBuf } = initializeMainMenu(60, 30, ctx);
        expect(buttons).toHaveLength(4);
        expect(state.buttonCount).toBe(4);
        // Bottom button (quit) should be at y=30
        expect(buttons[3].y).toBe(30);
    });
});

// =============================================================================
// initializeFlyoutMenu
// =============================================================================

describe("initializeFlyoutMenu", () => {
    it("returns play flyout with 4 buttons when FlyoutPlay", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.FlyoutPlay;
        const flyout = initializeFlyoutMenu(59, 20, ctx);
        expect(flyout).not.toBeNull();
        expect(flyout!.buttons).toHaveLength(4);
    });

    it("returns view flyout with 3 buttons when FlyoutView", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.FlyoutView;
        const flyout = initializeFlyoutMenu(59, 20, ctx);
        expect(flyout).not.toBeNull();
        expect(flyout!.buttons).toHaveLength(3);
    });

    it("returns null for non-flyout commands", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.NewGame;
        const flyout = initializeFlyoutMenu(59, 20, ctx);
        expect(flyout).toBeNull();
    });
});

// =============================================================================
// isFlyoutActive
// =============================================================================

describe("isFlyoutActive", () => {
    it("returns true for FlyoutPlay and FlyoutView", async () => {
        expect(isFlyoutActive(NGCommand.FlyoutPlay)).toBe(true);
        expect(isFlyoutActive(NGCommand.FlyoutView)).toBe(true);
    });

    it("returns false for non-flyout commands", async () => {
        expect(isFlyoutActive(NGCommand.Nothing)).toBe(false);
        expect(isFlyoutActive(NGCommand.NewGame)).toBe(false);
        expect(isFlyoutActive(NGCommand.Quit)).toBe(false);
    });
});

// =============================================================================
// getNextGameButtonPos
// =============================================================================

describe("getNextGameButtonPos", () => {
    it("returns the position of the button with matching command", async () => {
        const buttons = [
            makeButton({ command: NGCommand.NewGame, x: 10, y: 5 }),
            makeButton({ command: NGCommand.FlyoutPlay, x: 10, y: 7 }),
            makeButton({ command: NGCommand.FlyoutView, x: 10, y: 9 }),
            makeButton({ command: NGCommand.Quit, x: 10, y: 11 }),
        ];
        const pos = getNextGameButtonPos(buttons, NGCommand.FlyoutPlay);
        expect(pos).toEqual({ x: 10, y: 7 });
    });

    it("returns null when no matching button", async () => {
        const buttons = [
            makeButton({ command: NGCommand.NewGame }),
            makeButton({ command: NGCommand.FlyoutPlay }),
            makeButton({ command: NGCommand.FlyoutView }),
            makeButton({ command: NGCommand.NewGameWithSeed }),
        ];
        expect(getNextGameButtonPos(buttons, NGCommand.Quit)).toBeNull();
    });
});

// =============================================================================
// chooseGameVariant
// =============================================================================

describe("chooseGameVariant", () => {
    it("sets Brogue variant when user selects button 1", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(1);
        await chooseGameVariant(ctx);
        expect(ctx.setGameVariant).toHaveBeenCalledWith(GameVariant.Brogue);
    });

    it("sets RapidBrogue variant when user selects button 0", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(0);
        await chooseGameVariant(ctx);
        expect(ctx.setGameVariant).toHaveBeenCalledWith(GameVariant.RapidBrogue);
    });

    it("sets BulletBrogue variant when user selects button 2", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(2);
        await chooseGameVariant(ctx);
        expect(ctx.setGameVariant).toHaveBeenCalledWith(GameVariant.BulletBrogue);
    });

    it("sets nextGame to Nothing when user cancels", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(-1);
        await chooseGameVariant(ctx);
        expect(ctx.rogue.nextGame).toBe(NGCommand.Nothing);
    });
});

// =============================================================================
// chooseGameMode
// =============================================================================

describe("chooseGameMode", () => {
    it("sets Normal mode when user selects button 2", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(2);
        await chooseGameMode(ctx);
        expect(ctx.rogue.mode).toBe(GameMode.Normal);
    });

    it("sets Easy mode when user selects button 1", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(1);
        await chooseGameMode(ctx);
        expect(ctx.rogue.mode).toBe(GameMode.Easy);
    });

    it("sets Wizard mode when user selects button 0", async () => {
        const ctx = createCtx();
        (ctx.printTextBox as any).mockResolvedValue(0);
        await chooseGameMode(ctx);
        expect(ctx.rogue.mode).toBe(GameMode.Wizard);
    });

    it("always resets nextGame to Nothing", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.GameMode;
        (ctx.printTextBox as any).mockResolvedValue(-1);
        await chooseGameMode(ctx);
        expect(ctx.rogue.nextGame).toBe(NGCommand.Nothing);
    });
});

// =============================================================================
// dialogAlert
// =============================================================================

describe("dialogAlert", () => {
    it("shows a dialog with an OK button", async () => {
        const ctx = createCtx();
        await dialogAlert("Test message!", ctx);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalled();
        expect(ctx.printTextBox).toHaveBeenCalledTimes(1);
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
    });
});

// =============================================================================
// quitImmediately
// =============================================================================

describe("quitImmediately", () => {
    it("returns 0 (success)", async () => {
        const ctx = createCtx();
        expect(quitImmediately(ctx)).toBe(0);
    });

    it("saves game when recording and game in progress", async () => {
        const ctx = createCtx();
        ctx.rogue.recording = true;
        ctx.rogue.gameInProgress = true;
        quitImmediately(ctx);
        expect(ctx.flushBufferToFile).toHaveBeenCalled();
        expect(ctx.saveGameNoPrompt).toHaveBeenCalled();
    });

    it("saves recording when recording but game ended", async () => {
        const ctx = createCtx();
        ctx.rogue.recording = true;
        ctx.rogue.gameHasEnded = true;
        quitImmediately(ctx);
        expect(ctx.flushBufferToFile).toHaveBeenCalled();
        expect(ctx.saveRecordingNoPrompt).toHaveBeenCalled();
    });

    it("does not save when not recording", async () => {
        const ctx = createCtx();
        ctx.rogue.recording = false;
        quitImmediately(ctx);
        expect(ctx.flushBufferToFile).not.toHaveBeenCalled();
    });
});

// =============================================================================
// dialogChooseFile
// =============================================================================

describe("dialogChooseFile", () => {
    it("shows alert when no matching files", async () => {
        const ctx = createCtx();
        (ctx.listFiles as any).mockReturnValue([]);
        const result = await dialogChooseFile(".broguesave", "Open game:", ctx);
        expect(result).toBeNull();
        expect(ctx.printTextBox).toHaveBeenCalled(); // dialogAlert
    });

    it("returns selected file path", async () => {
        const ctx = createCtx();
        const files: FileEntry[] = [
            { path: "game1.broguesave", date: new Date("2025-01-01") },
            { path: "game2.broguesave", date: new Date("2025-01-02") },
        ];
        (ctx.listFiles as any).mockReturnValue(files);
        (ctx.buttonInputLoop as any).mockResolvedValue({
            chosenButton: 0,
            event: { eventType: EventType.MouseUp, param1: 0, param2: 0, controlKey: false, shiftKey: false },
        });

        const result = await dialogChooseFile(".broguesave", "Open game:", ctx);
        // Files sorted by date descending, so index 0 = game2
        expect(result).toBe("game2.broguesave");
    });

    it("returns null when user cancels", async () => {
        const ctx = createCtx();
        const files: FileEntry[] = [{ path: "game1.broguesave", date: new Date("2025-01-01") }];
        (ctx.listFiles as any).mockReturnValue(files);
        (ctx.buttonInputLoop as any).mockResolvedValue({
            chosenButton: -1,
            event: { eventType: EventType.Keystroke, param1: 0x1b, param2: 0, controlKey: false, shiftKey: false },
        });

        const result = await dialogChooseFile(".broguesave", "Open game:", ctx);
        expect(result).toBeNull();
    });

    it("filters files by suffix", async () => {
        const ctx = createCtx();
        const files: FileEntry[] = [
            { path: "game1.broguesave", date: new Date("2025-01-01") },
            { path: "rec1.broguerec", date: new Date("2025-01-02") },
        ];
        (ctx.listFiles as any).mockReturnValue(files);
        (ctx.buttonInputLoop as any).mockResolvedValue({
            chosenButton: 0,
            event: { eventType: EventType.MouseUp, param1: 0, param2: 0, controlKey: false, shiftKey: false },
        });

        const result = await dialogChooseFile(".broguesave", "Open game:", ctx);
        // Only one file matches, so button 0 = game1
        expect(result).toBe("game1.broguesave");
    });
});

// =============================================================================
// Game stats
// =============================================================================

describe("createGameStats", () => {
    it("initializes all fields to zero", async () => {
        const stats = createGameStats();
        expect(stats.games).toBe(0);
        expect(stats.won).toBe(0);
        expect(stats.highestScore).toBe(0);
    });
});

describe("addRunToGameStats", () => {
    it("increments games count", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Died", killedBy: "trap", gold: 10, lumenstones: 0, score: 100, turns: 50, deepestLevel: 5 }, stats);
        expect(stats.games).toBe(1);
    });

    it("tracks wins correctly (Escaped)", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Escaped", killedBy: "", gold: 100, lumenstones: 5, score: 1000, turns: 500, deepestLevel: 26 }, stats);
        expect(stats.won).toBe(1);
        expect(stats.escaped).toBe(1);
        expect(stats.currentWinStreak).toBe(1);
    });

    it("tracks mastery separately", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Mastered", killedBy: "", gold: 200, lumenstones: 25, score: 5000, turns: 1000, deepestLevel: 26 }, stats);
        expect(stats.mastered).toBe(1);
        expect(stats.currentMasteryStreak).toBe(1);
    });

    it("resets win streak on death", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Escaped", killedBy: "", gold: 100, lumenstones: 5, score: 1000, turns: 500, deepestLevel: 26 }, stats);
        addRunToGameStats({ seed: 2n, dateNumber: 0, result: "Died", killedBy: "rat", gold: 5, lumenstones: 0, score: 50, turns: 20, deepestLevel: 3 }, stats);
        expect(stats.currentWinStreak).toBe(0);
        expect(stats.longestWinStreak).toBe(1);
    });

    it("tracks highest score", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Died", killedBy: "", gold: 0, lumenstones: 0, score: 500, turns: 100, deepestLevel: 10 }, stats);
        addRunToGameStats({ seed: 2n, dateNumber: 0, result: "Died", killedBy: "", gold: 0, lumenstones: 0, score: 200, turns: 50, deepestLevel: 5 }, stats);
        expect(stats.highestScore).toBe(500);
    });

    it("tracks fewest turns win", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Escaped", killedBy: "", gold: 0, lumenstones: 0, score: 1000, turns: 500, deepestLevel: 26 }, stats);
        addRunToGameStats({ seed: 2n, dateNumber: 0, result: "Escaped", killedBy: "", gold: 0, lumenstones: 0, score: 1200, turns: 300, deepestLevel: 26 }, stats);
        expect(stats.fewestTurnsWin).toBe(300);
    });

    it("computes win rate", async () => {
        const stats = createGameStats();
        addRunToGameStats({ seed: 1n, dateNumber: 0, result: "Escaped", killedBy: "", gold: 0, lumenstones: 0, score: 1000, turns: 500, deepestLevel: 26 }, stats);
        addRunToGameStats({ seed: 2n, dateNumber: 0, result: "Died", killedBy: "", gold: 0, lumenstones: 0, score: 50, turns: 20, deepestLevel: 3 }, stats);
        expect(stats.winRate).toBe(50);
    });
});

describe("viewGameStats", () => {
    it("displays stats screen and waits for input", async () => {
        const ctx = createCtx();
        await viewGameStats(ctx);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalled();
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalled();
        expect(ctx.commitDraws).toHaveBeenCalled();
        expect(ctx.waitForKeystrokeOrMouseClick).toHaveBeenCalled();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
    });

    it("offers reset button when there are recent stats", async () => {
        const runs: RogueRun[] = [
            { seed: 1n, dateNumber: 0, result: "Died", killedBy: "trap", gold: 10, lumenstones: 0, score: 100, turns: 50, deepestLevel: 5 },
        ];
        const ctx = createCtx({ loadRunHistory: vi.fn(() => runs) });
        await viewGameStats(ctx);
        // Should show button input loop for the reset button instead of waitForKeystrokeOrMouseClick
        expect(ctx.buttonInputLoop).toHaveBeenCalled();
    });
});

// =============================================================================
// titleMenu
// =============================================================================

describe("titleMenu", () => {
    it("seeds the RNG and initializes flames before entering the loop", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.Nothing;

        // pauseBrogue returns true (input ready), then nextBrogueEvent returns 'q' keystroke.
        // processButtonInput returns chosenButton: 3 (Quit button).
        // Since nextGame(Nothing) !== mainButtons[3].command(Quit), nextGame gets set to Quit.
        // Inner loop exits (Keystroke event), outer loop exits (Quit is not flyout/Nothing).
        (ctx.pauseBrogue as any).mockResolvedValue(true);
        (ctx.nextBrogueEvent as any).mockResolvedValue({
            eventType: EventType.Keystroke,
            param1: "q".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        });
        (ctx.processButtonInput as any).mockResolvedValue({ chosenButton: 3, canceled: false });

        const dbuf = createScreenDisplayBuffer();
        await titleMenu(ctx, dbuf);

        expect(ctx.seedRandomGenerator).toHaveBeenCalledWith(0n);
        expect(ctx.blackOutScreen).toHaveBeenCalledWith(dbuf);
    });

    it("sets nextGame to NewGame when user presses 'n'", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.Nothing;

        (ctx.pauseBrogue as any).mockResolvedValue(true);
        (ctx.nextBrogueEvent as any).mockResolvedValue({
            eventType: EventType.Keystroke,
            param1: "n".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        });

        const dbuf = createScreenDisplayBuffer();
        await titleMenu(ctx, dbuf);

        expect(ctx.rogue.nextGame).toBe(NGCommand.NewGame);
    });
});

// =============================================================================
// mainBrogueJunction
// =============================================================================

describe("mainBrogueJunction", () => {
    it("initializes game variant and launch arguments", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.Quit;
        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);
        expect(ctx.initializeGameVariant).toHaveBeenCalled();
        expect(ctx.initializeLaunchArguments).toHaveBeenCalled();
    });

    it("creates a new game when nextGame is NewGame", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.NewGame;

        // mainInputLoop ends the game loop by setting Quit
        (ctx.mainInputLoop as any).mockImplementation(() => {
            ctx.rogue.nextGame = NGCommand.Quit;
        });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);

        expect(ctx.initializeRogue).toHaveBeenCalled();
        expect(ctx.startLevel).toHaveBeenCalled();
        expect(ctx.freeEverything).toHaveBeenCalled();
    });

    it("shows high scores when nextGame is HighScores", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.HighScores;

        // After printHighScores, set to Quit so we exit the loop
        (ctx.printHighScores as any).mockImplementation(() => {
            ctx.rogue.nextGame = NGCommand.Quit;
        });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);

        expect(ctx.printHighScores).toHaveBeenCalledWith(false);
    });

    it("shows game stats when nextGame is GameStats", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.GameStats;

        // loadRunHistory is called inside viewGameStats; set Quit there
        (ctx.loadRunHistory as any).mockImplementation(() => {
            ctx.rogue.nextGame = NGCommand.Quit;
            return [];
        });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);
    });

    it("opens game file when nextGame is OpenGame and path is pre-set", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.OpenGame;
        ctx.rogue.nextGamePath = "saved.broguesave";

        (ctx.mainInputLoop as any).mockImplementation(() => {
            ctx.rogue.nextGame = NGCommand.Quit;
        });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);

        expect(ctx.openFile).toHaveBeenCalledWith("saved.broguesave");
        expect(ctx.mainInputLoop).toHaveBeenCalled();
    });

    it("prompts for seed in NewGameWithSeed", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.NewGameWithSeed;
        ctx.rogue.nextGameSeed = 0n;

        (ctx.getInputTextString as any).mockResolvedValue("12345");
        (ctx.mainInputLoop as any).mockImplementation(() => {
            ctx.rogue.nextGame = NGCommand.Quit;
        });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);

        expect(ctx.getInputTextString).toHaveBeenCalled();
        expect(ctx.initializeRogue).toHaveBeenCalled();
    });

    it("uses pre-set seed in NewGameWithSeed when nextGameSeed > 0", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.NewGameWithSeed;
        ctx.rogue.nextGameSeed = 42n;

        (ctx.mainInputLoop as any).mockImplementation(() => {
            ctx.rogue.nextGame = NGCommand.Quit;
        });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);

        expect(ctx.getInputTextString).not.toHaveBeenCalled();
        expect(ctx.initializeRogue).toHaveBeenCalledWith(42n);
    });

    it("cancels NewGameWithSeed when user cancels seed prompt", async () => {
        const ctx = createCtx();
        ctx.rogue.nextGame = NGCommand.NewGameWithSeed;
        ctx.rogue.nextGameSeed = 0n;

        // getInputTextString returns null (cancelled)
        (ctx.getInputTextString as any).mockResolvedValue(null);

        // After nextGame resets to Nothing, titleMenu will be called.
        // Make titleMenu exit immediately by having pauseBrogue set Quit.
        (ctx.pauseBrogue as any).mockResolvedValue(true);
        (ctx.nextBrogueEvent as any).mockResolvedValue({
            eventType: EventType.Keystroke,
            param1: "q".charCodeAt(0),
            param2: 0,
            controlKey: false,
            shiftKey: false,
        });
        (ctx.processButtonInput as any).mockResolvedValue({ chosenButton: 3, canceled: false });

        const dbuf = createScreenDisplayBuffer();
        await mainBrogueJunction(ctx, dbuf);

        expect(ctx.initializeRogue).not.toHaveBeenCalled();
    });
});
