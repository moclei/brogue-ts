/*
 *  io-input.test.ts — Tests for io-input.ts (input dispatch module)
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InputContext, InputRogueState } from "../../src/io/io-input.js";
import type {
    BrogueButton,
    ButtonState,
    Color,
    Creature,
    Item,
    Pos,
    RogueEvent,
    SavedDisplayBuffer,
    ScreenDisplayBuffer,
    WindowPos,
} from "../../src/types/types.js";
import { EventType, Direction, TextEntryType, RNG as RNGEnum } from "../../src/types/enums.js";
import {
    ACKNOWLEDGE_KEY, ESCAPE_KEY, RETURN_KEY, DELETE_KEY,
    UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY,
    UPLEFT_KEY, UPRIGHT_KEY, DOWNLEFT_KEY, DOWNRIGHT_KEY,
    UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW,
    NUMPAD_1, NUMPAD_2, NUMPAD_3, NUMPAD_4, NUMPAD_5, NUMPAD_6, NUMPAD_7, NUMPAD_8, NUMPAD_9,
    DESCEND_KEY, ASCEND_KEY, REST_KEY, AUTO_REST_KEY,
    SEARCH_KEY, INVENTORY_KEY, EQUIP_KEY, UNEQUIP_KEY,
    DROP_KEY, APPLY_KEY, THROW_KEY, RETHROW_KEY,
    RELABEL_KEY, SWAP_KEY, TRUE_COLORS_KEY, STEALTH_RANGE_KEY,
    CALL_KEY, EXPLORE_KEY, AUTOPLAY_KEY,
    MESSAGE_ARCHIVE_KEY, BROGUE_HELP_KEY, FEATS_KEY,
    DISCOVERIES_KEY, CREATE_ITEM_MONSTER_KEY,
    SAVE_GAME_KEY, NEW_GAME_KEY, QUIT_KEY, GRAPHICS_KEY,
    SEED_KEY, EASY_MODE_KEY, PRINTSCREEN_KEY,
    PERIOD_KEY,
} from "../../src/types/constants.js";
import { ButtonFlag } from "../../src/types/flags.js";

import {
    stripShiftFromMovementKeystroke,
    considerCautiousMode,
    pauseBrogue,
    pauseAnimation,
    nextBrogueEvent,
    nextKeyPress,
    waitForAcknowledgment,
    waitForKeystrokeOrMouseClick,
    confirm,
    getInputTextString,
    executeMouseClick,
    executeKeystroke,
    executeEvent,
    initializeMenuButtons,
    actionMenu,
    mainInputLoop,
} from "../../src/io/io-input.js";

// ============================================================================
// Mock helpers
// ============================================================================

function makeRogue(overrides: Partial<InputRogueState> = {}): InputRogueState {
    return {
        mode: 0,
        RNG: 0,
        depthLevel: 1,
        deepestLevel: 1,
        gameHasEnded: false,
        playbackMode: false,
        playbackFastForward: false,
        playbackDelayPerTurn: 50,
        playbackDelayThisTurn: 50,
        playbackPaused: false,
        playbackOOS: false,
        playbackOmniscience: false,
        playbackBetweenTurns: false,
        autoPlayingLevel: false,
        automationActive: false,
        disturbed: false,
        justRested: false,
        cautiousMode: false,
        trueColorMode: false,
        displayStealthRangeMode: false,
        quit: false,
        cursorMode: false,
        cursorLoc: { x: -1, y: -1 },
        cursorPathIntensity: 20,
        upLoc: { x: 10, y: 10 },
        downLoc: { x: 20, y: 20 },
        playerTurnNumber: 100,
        nextGame: 0,
        lastItemThrown: null,
        creaturesWillFlashThisTurn: false,
        ...overrides,
    };
}

function makePlayer(overrides: Partial<Creature> = {}): Creature {
    return {
        info: { flags: 0 } as any,
        loc: { x: 5, y: 5 },
        depth: 1,
        currentHP: 100,
        turnsUntilRegen: 0,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: 0 as any,
        creatureMode: 0 as any,
        mutationIndex: -1,
        wasNegated: false,
        targetWaypointIndex: 0,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: 0, y: 0 },
        targetCorpseLoc: { x: 0, y: 0 },
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
        previousHealthPoints: 100,
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        status: new Array(30).fill(0),
        maxStatus: new Array(30).fill(0),
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

function makeSavedDisplayBuffer(): SavedDisplayBuffer {
    return { cells: [] } as any;
}

function makeScreenDisplayBuffer(): ScreenDisplayBuffer {
    return { cells: [] } as any;
}

function makeEvent(overrides: Partial<RogueEvent> = {}): RogueEvent {
    return {
        eventType: EventType.Keystroke,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
        ...overrides,
    };
}

function makeCtx(overrides: Partial<InputContext> = {}): InputContext {
    const rogue = makeRogue(overrides.rogue as any);
    const player = overrides.player ?? makePlayer();

    return {
        rogue,
        player,
        DEBUG: false,
        serverMode: false,
        hasGraphics: false,
        graphicsMode: 0,
        nonInteractivePlayback: false,
        D_WORMHOLING: false,
        D_SAFETY_VISION: false,
        D_SCENT_VISION: false,
        displayedMessage: [""],
        messagesUnconfirmed: 0,
        GAME_MODE_EASY: 1,

        posEq: vi.fn((a: Pos, b: Pos) => a.x === b.x && a.y === b.y),
        isPosInMap: vi.fn((pos: Pos) => pos.x >= 0 && pos.x < 79 && pos.y >= 0 && pos.y < 31),
        mapToWindowX: vi.fn((x: number) => x + 21),
        mapToWindowY: vi.fn((y: number) => y + 3),
        windowToMap: vi.fn((w: WindowPos) => ({ x: w.windowX - 21, y: w.windowY - 3 })),
        windowToMapX: vi.fn((x: number) => x - 21),
        distanceBetween: vi.fn(() => 10),

        encodeMessageColor: vi.fn(() => "\x1b"),
        strLenWithoutEscapes: vi.fn((s: string) => s.replace(/\x1b[^\x1b]*/g, "").length),
        printString: vi.fn(),
        plotCharWithColor: vi.fn(),

        message: vi.fn(),
        messageWithColor: vi.fn(),
        temporaryMessage: vi.fn(),
        confirmMessages: vi.fn(),
        updateMessageDisplay: vi.fn(),

        commitDraws: vi.fn(),
        saveDisplayBuffer: vi.fn(() => makeSavedDisplayBuffer()),
        restoreDisplayBuffer: vi.fn(),
        overlayDisplayBuffer: vi.fn(),
        clearDisplayBuffer: vi.fn(),
        createScreenDisplayBuffer: vi.fn(() => makeScreenDisplayBuffer()),

        initializeButton: vi.fn((): BrogueButton => ({
            text: "",
            x: 0,
            y: 0,
            hotkey: [],
            buttonColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            textColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            hotkeyTextColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            opacity: 100,
            symbol: [],
            flags: ButtonFlag.B_DRAW | ButtonFlag.B_ENABLED | ButtonFlag.B_GRADIENT | ButtonFlag.B_HOVER_ENABLED,
            command: 0 as any,
        })),
        initializeButtonState: vi.fn(),
        buttonInputLoop: vi.fn(() => -1),

        printTextBox: vi.fn(() => 0),
        rectangularShading: vi.fn(),

        pauseForMilliseconds: vi.fn(() => false),
        nextKeyOrMouseEvent: vi.fn(() => makeEvent()),
        locIsInWindow: vi.fn(() => true),

        displayLevel: vi.fn(),
        refreshSideBar: vi.fn(),
        displayInventory: vi.fn(),
        displayMessageArchive: vi.fn(),
        printHelpScreen: vi.fn(),
        displayFeatsScreen: vi.fn(),
        printDiscoveriesScreen: vi.fn(),
        flashTemporaryAlert: vi.fn(),
        displayMonsterFlashes: vi.fn(),
        setGraphicsMode: vi.fn((m: number) => m),

        playerMoves: vi.fn(),
        playerRuns: vi.fn(),
        playerTurnEnded: vi.fn(),
        autoRest: vi.fn(),
        manualSearch: vi.fn(),
        travel: vi.fn(),
        travelRoute: vi.fn(),
        equip: vi.fn(),
        unequip: vi.fn(),
        drop: vi.fn(),
        apply: vi.fn(),
        throwCommand: vi.fn(),
        relabel: vi.fn(),
        call: vi.fn(),
        swapLastEquipment: vi.fn(),
        enableEasyMode: vi.fn(),
        saveGame: vi.fn(),
        gameOver: vi.fn(),
        printSeed: vi.fn(),
        showCursor: vi.fn(),
        hideCursor: vi.fn(),
        exploreKey: vi.fn(),
        autoPlayLevel: vi.fn(),
        useStairs: vi.fn(),
        takeScreenshot: vi.fn(() => true),
        itemIsCarried: vi.fn(() => true),
        dialogCreateItemOrMonster: vi.fn(),

        monsterAtLoc: vi.fn(() => null),
        itemAtLoc: vi.fn(() => null),
        canSeeMonster: vi.fn(() => false),
        playerCanSeeOrSense: vi.fn(() => false),
        cellHasTMFlag: vi.fn(() => false),
        printMonsterDetails: vi.fn(),
        printFloorItemDetails: vi.fn(),
        printLocationDescription: vi.fn(),

        moveCursor: vi.fn(() => false),
        nextTargetAfter: vi.fn(() => false),
        hilitePath: vi.fn(),
        clearCursorPath: vi.fn(),
        hiliteCell: vi.fn(),
        refreshDungeonCell: vi.fn(),

        allocGrid: vi.fn(() => Array.from({ length: 100 }, () => new Array(34).fill(0))),
        freeGrid: vi.fn(),
        fillGrid: vi.fn(),
        dijkstraScan: vi.fn(),
        populateCreatureCostMap: vi.fn(),
        getPlayerPathOnMap: vi.fn(() => 0),
        processSnapMap: vi.fn(),
        getClosestValidLocationOnMap: vi.fn(() => ({ x: 5, y: 5 })),
        diagonalBlocked: vi.fn(() => false),
        pmapFlagsAt: vi.fn(() => 0),
        terrainFlags: vi.fn(() => 0),
        terrainMechFlags: vi.fn(() => 0),

        recordKeystroke: vi.fn(),
        recallEvent: vi.fn(() => makeEvent()),
        executePlaybackInput: vi.fn(() => false),

        proposeOrConfirmLocation: vi.fn(() => true),
        characterForbiddenInFilename: vi.fn(() => false),

        safetyMap: null,
        displayGrid: vi.fn(),
        displayLoops: vi.fn(),
        displayChokeMap: vi.fn(),
        displayMachines: vi.fn(),
        displayWaypoints: vi.fn(),

        AUTOTARGET_MODE_EXPLORE: 0,
        TM_LIST_IN_SIDEBAR: 1,
        TM_PROMOTES_ON_PLAYER_ENTRY: 2,
        T_OBSTRUCTS_PASSABILITY: 4,
        HAS_MONSTER: 8,
        MONST_ATTACKABLE_THRU_WALLS: 16,
        STATUS_HALLUCINATING: 0,
        STATUS_TELEPATHIC: 1,
        STATUS_SEARCHING: 12,
        ALL_ITEMS: 0xffff,
        REQUIRE_ACKNOWLEDGMENT: 1,

        nbDirs: [
            [0, -1], [0, 1], [-1, 0], [1, 0],
            [-1, -1], [-1, 1], [1, -1], [1, 1],
        ],

        ...overrides,
    } as InputContext;
}

// ============================================================================
// Tests
// ============================================================================

describe("stripShiftFromMovementKeystroke", () => {
    it("converts uppercase movement keys to lowercase", () => {
        // 'H' → 'h' (LEFT_KEY)
        expect(stripShiftFromMovementKeystroke("H".charCodeAt(0))).toBe(LEFT_KEY);
        // 'K' → 'k' (UP_KEY)
        expect(stripShiftFromMovementKeystroke("K".charCodeAt(0))).toBe(UP_KEY);
        // 'J' → 'j' (DOWN_KEY)
        expect(stripShiftFromMovementKeystroke("J".charCodeAt(0))).toBe(DOWN_KEY);
        // 'L' → 'l' (RIGHT_KEY)
        expect(stripShiftFromMovementKeystroke("L".charCodeAt(0))).toBe(RIGHT_KEY);
        // 'Y' → 'y' (UPLEFT_KEY)
        expect(stripShiftFromMovementKeystroke("Y".charCodeAt(0))).toBe(UPLEFT_KEY);
        // 'U' → 'u' (UPRIGHT_KEY)
        expect(stripShiftFromMovementKeystroke("U".charCodeAt(0))).toBe(UPRIGHT_KEY);
        // 'B' → 'b' (DOWNLEFT_KEY)
        expect(stripShiftFromMovementKeystroke("B".charCodeAt(0))).toBe(DOWNLEFT_KEY);
        // 'N' → 'n' (DOWNRIGHT_KEY)
        expect(stripShiftFromMovementKeystroke("N".charCodeAt(0))).toBe(DOWNRIGHT_KEY);
    });

    it("leaves non-movement keys unchanged", () => {
        expect(stripShiftFromMovementKeystroke("Q".charCodeAt(0))).toBe("Q".charCodeAt(0));
        expect(stripShiftFromMovementKeystroke("A".charCodeAt(0))).toBe("A".charCodeAt(0));
        expect(stripShiftFromMovementKeystroke(ESCAPE_KEY)).toBe(ESCAPE_KEY);
    });

    it("leaves already-lowercase movement keys unchanged", () => {
        // Already lowercase → converting again would yield garbage, but the function
        // only subtracts if the result matches a movement key, so lowercase stays.
        expect(stripShiftFromMovementKeystroke(LEFT_KEY)).toBe(LEFT_KEY);
    });
});

describe("considerCautiousMode", () => {
    it("is a no-op (C implementation was commented out)", () => {
        const ctx = makeCtx();
        expect(() => considerCautiousMode(ctx)).not.toThrow();
    });
});

describe("pauseBrogue", () => {
    it("returns true immediately during fast-forward playback", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true, playbackFastForward: true } as any });
        expect(pauseBrogue(ctx, 500, { interruptForMouseMove: false })).toBe(true);
        expect(ctx.commitDraws).toHaveBeenCalled();
        expect(ctx.pauseForMilliseconds).not.toHaveBeenCalled();
    });

    it("pauses in 50ms increments for long delays", () => {
        const ctx = makeCtx();
        pauseBrogue(ctx, 250, { interruptForMouseMove: false });
        // 250 > 100: first loop iteration: pause(50), 250-50=200
        // 200 > 100: pause(50), 200-50=150
        // 150 > 100: pause(50), 150-50=100
        // 100 <= 100: pause(100)
        // Total: 4 calls
        expect(ctx.pauseForMilliseconds).toHaveBeenCalledTimes(4);
    });

    it("returns true if interrupted during incremental pause", () => {
        const ctx = makeCtx();
        (ctx.pauseForMilliseconds as any).mockReturnValueOnce(true);
        expect(pauseBrogue(ctx, 200, { interruptForMouseMove: false })).toBe(true);
        expect(ctx.pauseForMilliseconds).toHaveBeenCalledTimes(1);
    });

    it("pauses directly for short delays (<= 100ms)", () => {
        const ctx = makeCtx();
        pauseBrogue(ctx, 80, { interruptForMouseMove: false });
        expect(ctx.pauseForMilliseconds).toHaveBeenCalledTimes(1);
        expect(ctx.pauseForMilliseconds).toHaveBeenCalledWith(80, { interruptForMouseMove: false });
    });
});

describe("pauseAnimation", () => {
    it("scales delay during playback based on playbackDelayPerTurn", () => {
        const ctx = makeCtx({
            rogue: {
                playbackMode: true,
                playbackPaused: false,
                playbackDelayPerTurn: 200, // factor = 200/50 = 4, sqrt(4) = 2
            } as any,
        });
        pauseAnimation(ctx, 100, { interruptForMouseMove: false });
        // milliseconds = max(1, round(100 * 2)) = 200
        // 200 > 100: pause in increments
        expect(ctx.pauseForMilliseconds).toHaveBeenCalled();
    });

    it("does not scale when paused during playback", () => {
        const ctx = makeCtx({
            rogue: {
                playbackMode: true,
                playbackPaused: true,
                playbackDelayPerTurn: 200,
            } as any,
        });
        pauseAnimation(ctx, 80, { interruptForMouseMove: false });
        // Should not scale — factor condition is !playbackPaused
        expect(ctx.pauseForMilliseconds).toHaveBeenCalledWith(80, { interruptForMouseMove: false });
    });

    it("does not scale when not in playback mode", () => {
        const ctx = makeCtx();
        pauseAnimation(ctx, 50, { interruptForMouseMove: false });
        expect(ctx.pauseForMilliseconds).toHaveBeenCalledWith(50, { interruptForMouseMove: false });
    });
});

describe("nextBrogueEvent", () => {
    it("gets events from real input when not in playback", () => {
        const ctx = makeCtx();
        const ev = makeEvent({ eventType: EventType.Keystroke, param1: 42 });
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(ev);
        const result = nextBrogueEvent(ctx, false, false, false);
        expect(result.eventType).toBe(EventType.Keystroke);
        expect(result.param1).toBe(42);
        expect(ctx.commitDraws).toHaveBeenCalled();
    });

    it("flashes creatures if creaturesWillFlashThisTurn", () => {
        const ctx = makeCtx({ rogue: { creaturesWillFlashThisTurn: true } as any });
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(makeEvent());
        nextBrogueEvent(ctx, false, false, false);
        expect(ctx.displayMonsterFlashes).toHaveBeenCalledWith(true);
    });

    it("filters out MOUSE_UP events outside the window", () => {
        const ctx = makeCtx();
        const outsideEvent = makeEvent({ eventType: EventType.MouseUp, param1: -1, param2: -1 });
        const insideEvent = makeEvent({ eventType: EventType.Keystroke, param1: 65 });
        (ctx.locIsInWindow as any).mockReturnValueOnce(false);
        (ctx.nextKeyOrMouseEvent as any)
            .mockReturnValueOnce(outsideEvent)
            .mockReturnValueOnce(insideEvent);
        const result = nextBrogueEvent(ctx, false, false, false);
        expect(result.eventType).toBe(EventType.Keystroke);
    });

    it("reports error events", () => {
        const ctx = makeCtx();
        const errEvent = makeEvent({ eventType: EventType.EventError });
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(errEvent);
        nextBrogueEvent(ctx, false, false, false);
        expect(ctx.message).toHaveBeenCalledWith("Event error!", ctx.REQUIRE_ACKNOWLEDGMENT);
    });

    it("uses recallEvent in playback mode", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true } as any });
        const recalled = makeEvent({ eventType: EventType.Keystroke, param1: 99 });
        (ctx.recallEvent as any).mockReturnValue(recalled);
        const result = nextBrogueEvent(ctx, false, false, false);
        expect(result.param1).toBe(99);
        expect(ctx.recallEvent).toHaveBeenCalled();
    });
});

describe("nextKeyPress", () => {
    it("blocks until a keystroke event", () => {
        const ctx = makeCtx();
        const mouseEvent = makeEvent({ eventType: EventType.MouseUp });
        const keyEvent = makeEvent({ eventType: EventType.Keystroke, param1: 65 });
        (ctx.nextKeyOrMouseEvent as any)
            .mockReturnValueOnce(mouseEvent)
            .mockReturnValueOnce(keyEvent);
        expect(nextKeyPress(ctx, false)).toBe(65);
    });
});

describe("waitForAcknowledgment", () => {
    it("returns immediately during autoplay", () => {
        const ctx = makeCtx({ rogue: { autoPlayingLevel: true } as any });
        waitForAcknowledgment(ctx);
        expect(ctx.nextKeyOrMouseEvent).not.toHaveBeenCalled();
    });

    it("returns immediately during non-OOS playback", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true, playbackOOS: false } as any });
        waitForAcknowledgment(ctx);
        expect(ctx.nextKeyOrMouseEvent).not.toHaveBeenCalled();
    });

    it("accepts space key", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.Keystroke, param1: ACKNOWLEDGE_KEY }),
        );
        waitForAcknowledgment(ctx);
        expect(ctx.nextKeyOrMouseEvent).toHaveBeenCalled();
    });

    it("accepts escape key", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.Keystroke, param1: ESCAPE_KEY }),
        );
        waitForAcknowledgment(ctx);
        expect(ctx.nextKeyOrMouseEvent).toHaveBeenCalled();
    });

    it("accepts mouse click", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.MouseUp }),
        );
        waitForAcknowledgment(ctx);
    });

    it("flashes prompt on non-acknowledge keystroke before accepting acknowledge", () => {
        const ctx = makeCtx();
        const wrongKey = makeEvent({ eventType: EventType.Keystroke, param1: "a".charCodeAt(0) });
        const ackKey = makeEvent({ eventType: EventType.Keystroke, param1: ACKNOWLEDGE_KEY });
        (ctx.nextKeyOrMouseEvent as any)
            .mockReturnValueOnce(wrongKey)
            .mockReturnValueOnce(ackKey);
        waitForAcknowledgment(ctx);
        expect(ctx.flashTemporaryAlert).toHaveBeenCalledWith(
            " -- Press space or click to continue -- ",
            500,
        );
    });
});

describe("waitForKeystrokeOrMouseClick", () => {
    it("waits for keystroke", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.Keystroke, param1: 65 }),
        );
        waitForKeystrokeOrMouseClick(ctx);
        expect(ctx.nextKeyOrMouseEvent).toHaveBeenCalled();
    });

    it("waits for mouse click", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.MouseUp }),
        );
        waitForKeystrokeOrMouseClick(ctx);
    });

    it("ignores non-keystroke, non-mouseup events", () => {
        const ctx = makeCtx();
        const moveEvent = makeEvent({ eventType: EventType.MouseEnteredCell });
        const keyEvent = makeEvent({ eventType: EventType.Keystroke, param1: 65 });
        (ctx.nextKeyOrMouseEvent as any)
            .mockReturnValueOnce(moveEvent)
            .mockReturnValueOnce(keyEvent);
        waitForKeystrokeOrMouseClick(ctx);
        expect(ctx.nextKeyOrMouseEvent).toHaveBeenCalledTimes(2);
    });
});

describe("confirm", () => {
    it("returns true during autoplay", () => {
        const ctx = makeCtx({ rogue: { autoPlayingLevel: true } as any });
        expect(confirm(ctx, "Really?", false)).toBe(true);
        expect(ctx.printTextBox).not.toHaveBeenCalled();
    });

    it("returns true during playback (if not alsoDuringPlayback)", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true } as any });
        expect(confirm(ctx, "Really?", false)).toBe(true);
    });

    it("shows dialog during playback if alsoDuringPlayback", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true } as any });
        (ctx.printTextBox as any).mockReturnValue(0); // Yes
        expect(confirm(ctx, "Really?", true)).toBe(true);
        expect(ctx.printTextBox).toHaveBeenCalled();
    });

    it("returns true when user chooses Yes (button 0)", () => {
        const ctx = makeCtx();
        (ctx.printTextBox as any).mockReturnValue(0);
        expect(confirm(ctx, "Delete?", false)).toBe(true);
    });

    it("returns false when user chooses No (button 1)", () => {
        const ctx = makeCtx();
        (ctx.printTextBox as any).mockReturnValue(1);
        expect(confirm(ctx, "Delete?", false)).toBe(false);
    });

    it("returns false when user cancels (-1)", () => {
        const ctx = makeCtx();
        (ctx.printTextBox as any).mockReturnValue(-1);
        expect(confirm(ctx, "Delete?", false)).toBe(false);
    });

    it("restores display buffer after dialog", () => {
        const ctx = makeCtx();
        (ctx.printTextBox as any).mockReturnValue(0);
        confirm(ctx, "Test?", false);
        expect(ctx.saveDisplayBuffer).toHaveBeenCalled();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
    });
});

describe("getInputTextString", () => {
    it("returns null when user presses escape", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.Keystroke, param1: ESCAPE_KEY }),
        );
        const result = getInputTextString(ctx, "Enter name:", 20, "", ".broguesave", TextEntryType.Normal, true);
        expect(result).toBeNull();
    });

    it("returns entered text on return key", () => {
        const ctx = makeCtx();
        const calls: RogueEvent[] = [
            makeEvent({ eventType: EventType.Keystroke, param1: "h".charCodeAt(0) }),
            makeEvent({ eventType: EventType.Keystroke, param1: "i".charCodeAt(0) }),
            makeEvent({ eventType: EventType.Keystroke, param1: RETURN_KEY }),
        ];
        let callIdx = 0;
        (ctx.nextKeyOrMouseEvent as any).mockImplementation(() => calls[callIdx++]);
        (ctx.strLenWithoutEscapes as any).mockImplementation((s: string) => s.length);

        const result = getInputTextString(ctx, "Name:", 20, "", "", TextEntryType.Normal, false);
        expect(result).toBe("hi");
    });

    it("handles delete key", () => {
        const ctx = makeCtx();
        const calls: RogueEvent[] = [
            makeEvent({ eventType: EventType.Keystroke, param1: "a".charCodeAt(0) }),
            makeEvent({ eventType: EventType.Keystroke, param1: "b".charCodeAt(0) }),
            makeEvent({ eventType: EventType.Keystroke, param1: DELETE_KEY }),
            makeEvent({ eventType: EventType.Keystroke, param1: RETURN_KEY }),
        ];
        let callIdx = 0;
        (ctx.nextKeyOrMouseEvent as any).mockImplementation(() => calls[callIdx++]);
        (ctx.strLenWithoutEscapes as any).mockImplementation((s: string) => s.length);

        const result = getInputTextString(ctx, ">", 20, "", "", TextEntryType.Normal, false);
        expect(result).toBe("a");
    });

    it("filters characters for number-only entry", () => {
        const ctx = makeCtx();
        const calls: RogueEvent[] = [
            makeEvent({ eventType: EventType.Keystroke, param1: "a".charCodeAt(0) }),  // rejected
            makeEvent({ eventType: EventType.Keystroke, param1: "5".charCodeAt(0) }),  // accepted
            makeEvent({ eventType: EventType.Keystroke, param1: RETURN_KEY }),
        ];
        let callIdx = 0;
        (ctx.nextKeyOrMouseEvent as any).mockImplementation(() => calls[callIdx++]);
        (ctx.strLenWithoutEscapes as any).mockImplementation((s: string) => s.length);

        const result = getInputTextString(ctx, ">", 20, "", "", TextEntryType.Numbers, false);
        expect(result).toBe("5");
    });

    it("uses dialog box mode", () => {
        const ctx = makeCtx();
        (ctx.nextKeyOrMouseEvent as any).mockReturnValue(
            makeEvent({ eventType: EventType.Keystroke, param1: RETURN_KEY }),
        );
        (ctx.strLenWithoutEscapes as any).mockImplementation((s: string) => s.length);

        getInputTextString(ctx, "Enter:", 15, "", "", TextEntryType.Normal, true);
        expect(ctx.rectangularShading).toHaveBeenCalled();
        expect(ctx.overlayDisplayBuffer).toHaveBeenCalled();
        expect(ctx.restoreDisplayBuffer).toHaveBeenCalled();
    });

    it("uses default entry value", () => {
        const ctx = makeCtx();
        const calls: RogueEvent[] = [
            makeEvent({ eventType: EventType.Keystroke, param1: RETURN_KEY }),
        ];
        let callIdx = 0;
        (ctx.nextKeyOrMouseEvent as any).mockImplementation(() => calls[callIdx++]);
        (ctx.strLenWithoutEscapes as any).mockImplementation((s: string) => s.length);

        const result = getInputTextString(ctx, ">", 20, "default", "", TextEntryType.Normal, false);
        expect(result).toBe("default");
    });
});

describe("executeMouseClick", () => {
    it("opens inventory on right-click", () => {
        const ctx = makeCtx();
        executeMouseClick(ctx, makeEvent({ eventType: EventType.RightMouseUp, param1: 50, param2: 10 }));
        expect(ctx.displayInventory).toHaveBeenCalled();
    });

    it("shows message archive when clicking in message area", () => {
        const ctx = makeCtx();
        // windowToMapX returns a valid map x (0-78), but window_y is in MESSAGE_LINES (0-2)
        (ctx.windowToMapX as any).mockReturnValue(5);
        (ctx.isPosInMap as any).mockReturnValue(false); // Not in map
        executeMouseClick(ctx, makeEvent({ eventType: EventType.MouseUp, param1: 26, param2: 1 }));
        expect(ctx.displayMessageArchive).toHaveBeenCalled();
    });

    it("travels with ctrl-click on map", () => {
        const ctx = makeCtx();
        (ctx.isPosInMap as any).mockReturnValue(true);
        executeMouseClick(ctx, makeEvent({
            eventType: EventType.MouseUp,
            param1: 30,
            param2: 10,
            controlKey: true,
        }));
        expect(ctx.travel).toHaveBeenCalled();
    });
});

describe("executeKeystroke — movement", () => {
    it("moves player up with UP_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, UP_KEY, false, false);
        expect(ctx.playerMoves).toHaveBeenCalledWith(Direction.Up);
    });

    it("moves player down with DOWN_ARROW", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, DOWN_ARROW, false, false);
        expect(ctx.playerMoves).toHaveBeenCalledWith(Direction.Down);
    });

    it("moves diagonally with NUMPAD keys", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, NUMPAD_7, false, false);
        expect(ctx.playerMoves).toHaveBeenCalledWith(Direction.UpLeft);
    });

    it("runs when shift is held", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, UP_KEY, false, true);
        expect(ctx.playerRuns).toHaveBeenCalledWith(Direction.Up);
    });

    it("runs when control is held", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, LEFT_KEY, true, false);
        expect(ctx.playerRuns).toHaveBeenCalledWith(Direction.Left);
    });

    it("hides cursor on movement", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, RIGHT_KEY, false, false);
        expect(ctx.hideCursor).toHaveBeenCalled();
    });

    it("refreshes sidebar after movement", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, DOWN_KEY, false, false);
        expect(ctx.refreshSideBar).toHaveBeenCalledWith(-1, -1, false);
    });
});

describe("executeKeystroke — actions", () => {
    it("rests on REST_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, REST_KEY, false, false);
        expect(ctx.rogue.justRested).toBe(true);
        expect(ctx.recordKeystroke).toHaveBeenCalledWith(REST_KEY, false, false);
        expect(ctx.playerTurnEnded).toHaveBeenCalled();
    });

    it("rests on PERIOD_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, PERIOD_KEY, false, false);
        expect(ctx.playerTurnEnded).toHaveBeenCalled();
    });

    it("rests on NUMPAD_5", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, NUMPAD_5, false, false);
        expect(ctx.playerTurnEnded).toHaveBeenCalled();
    });

    it("auto-rests on AUTO_REST_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, AUTO_REST_KEY, false, false);
        expect(ctx.autoRest).toHaveBeenCalled();
    });

    it("searches on SEARCH_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, SEARCH_KEY, false, false);
        expect(ctx.manualSearch).toHaveBeenCalled();
    });

    it("opens inventory on INVENTORY_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, INVENTORY_KEY, false, false);
        expect(ctx.displayInventory).toHaveBeenCalled();
    });

    it("equips on EQUIP_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, EQUIP_KEY, false, false);
        expect(ctx.equip).toHaveBeenCalledWith(null);
    });

    it("unequips on UNEQUIP_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, UNEQUIP_KEY, false, false);
        expect(ctx.unequip).toHaveBeenCalledWith(null);
    });

    it("drops on DROP_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, DROP_KEY, false, false);
        expect(ctx.drop).toHaveBeenCalledWith(null);
    });

    it("applies on APPLY_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, APPLY_KEY, false, false);
        expect(ctx.apply).toHaveBeenCalledWith(null);
    });

    it("throws on THROW_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, THROW_KEY, false, false);
        expect(ctx.throwCommand).toHaveBeenCalledWith(null, false);
    });

    it("re-throws on RETHROW_KEY when item available", () => {
        const item = {} as Item;
        const ctx = makeCtx({ rogue: { lastItemThrown: item } as any });
        (ctx.itemIsCarried as any).mockReturnValue(true);
        executeKeystroke(ctx, RETHROW_KEY, false, false);
        expect(ctx.throwCommand).toHaveBeenCalledWith(item, true);
    });

    it("skips re-throw when item not carried", () => {
        const item = {} as Item;
        const ctx = makeCtx({ rogue: { lastItemThrown: item } as any });
        (ctx.itemIsCarried as any).mockReturnValue(false);
        executeKeystroke(ctx, RETHROW_KEY, false, false);
        expect(ctx.throwCommand).not.toHaveBeenCalled();
    });

    it("swaps equipment on SWAP_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, SWAP_KEY, false, false);
        expect(ctx.swapLastEquipment).toHaveBeenCalled();
    });

    it("toggles true color mode", () => {
        const ctx = makeCtx();
        expect(ctx.rogue.trueColorMode).toBe(false);
        executeKeystroke(ctx, TRUE_COLORS_KEY, false, false);
        expect(ctx.rogue.trueColorMode).toBe(true);
        expect(ctx.displayLevel).toHaveBeenCalled();
        expect(ctx.messageWithColor).toHaveBeenCalled();
    });

    it("toggles stealth range display", () => {
        const ctx = makeCtx();
        expect(ctx.rogue.displayStealthRangeMode).toBe(false);
        executeKeystroke(ctx, STEALTH_RANGE_KEY, false, false);
        expect(ctx.rogue.displayStealthRangeMode).toBe(true);
    });

    it("calls on CALL_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, CALL_KEY, false, false);
        expect(ctx.call).toHaveBeenCalledWith(null);
    });

    it("explores on EXPLORE_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, EXPLORE_KEY, false, false);
        expect(ctx.exploreKey).toHaveBeenCalledWith(false);
    });

    it("shows cursor on RETURN_KEY", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, RETURN_KEY, false, false);
        expect(ctx.showCursor).toHaveBeenCalled();
    });

    it("displays message archive", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, MESSAGE_ARCHIVE_KEY, false, false);
        expect(ctx.displayMessageArchive).toHaveBeenCalled();
    });

    it("displays help screen", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, BROGUE_HELP_KEY, false, false);
        expect(ctx.printHelpScreen).toHaveBeenCalled();
    });

    it("displays feats screen", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, FEATS_KEY, false, false);
        expect(ctx.displayFeatsScreen).toHaveBeenCalled();
    });

    it("displays discoveries screen", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, DISCOVERIES_KEY, false, false);
        expect(ctx.printDiscoveriesScreen).toHaveBeenCalled();
    });

    it("prints seed", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, SEED_KEY, false, false);
        expect(ctx.printSeed).toHaveBeenCalled();
    });

    it("enables easy mode", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, EASY_MODE_KEY, false, false);
        expect(ctx.enableEasyMode).toHaveBeenCalled();
    });

    it("takes screenshot", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, PRINTSCREEN_KEY, false, false);
        expect(ctx.takeScreenshot).toHaveBeenCalled();
        expect(ctx.flashTemporaryAlert).toHaveBeenCalledWith(
            " Screenshot saved in save directory ",
            2000,
        );
    });

    it("confirms messages first", () => {
        const ctx = makeCtx();
        executeKeystroke(ctx, INVENTORY_KEY, false, false);
        expect(ctx.confirmMessages).toHaveBeenCalled();
    });

    it("resets cautious mode after keystroke", () => {
        const ctx = makeCtx({ rogue: { cautiousMode: true } as any });
        executeKeystroke(ctx, INVENTORY_KEY, false, false);
        expect(ctx.rogue.cautiousMode).toBe(false);
    });
});

describe("executeKeystroke — save/quit", () => {
    it("skips save during playback", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true } as any });
        executeKeystroke(ctx, SAVE_GAME_KEY, false, false);
        expect(ctx.saveGame).not.toHaveBeenCalled();
    });

    it("skips save in server mode", () => {
        const ctx = makeCtx({ serverMode: true } as any);
        executeKeystroke(ctx, SAVE_GAME_KEY, false, false);
        expect(ctx.saveGame).not.toHaveBeenCalled();
    });

    it("saves game on confirmation", () => {
        const ctx = makeCtx();
        (ctx.printTextBox as any).mockReturnValue(0); // Yes
        executeKeystroke(ctx, SAVE_GAME_KEY, false, false);
        expect(ctx.saveGame).toHaveBeenCalled();
    });

    it("quits game on confirmation", () => {
        const ctx = makeCtx();
        (ctx.printTextBox as any).mockReturnValue(0); // Yes
        executeKeystroke(ctx, QUIT_KEY, false, false);
        expect(ctx.rogue.quit).toBe(true);
        expect(ctx.gameOver).toHaveBeenCalledWith("Quit", true);
    });

    it("NEW_GAME_KEY is stripped to DOWNRIGHT movement by stripShift", () => {
        // In the C code, 'N' (NEW_GAME_KEY) gets converted to 'n' (DOWNRIGHT_KEY)
        // by stripShiftFromMovementKeystroke, so pressing N triggers diagonal movement.
        // The NEW_GAME_KEY case is only reachable via non-keyboard paths.
        const rogue = makeRogue({ playerTurnNumber: 10 });
        const ctx = makeCtx({ rogue });
        executeKeystroke(ctx, NEW_GAME_KEY, false, false);
        // Should move downright instead of starting new game
        expect(ctx.playerMoves).toHaveBeenCalledWith(Direction.DownRight);
        expect(ctx.rogue.gameHasEnded).toBe(false);
    });
});

describe("executeKeystroke — debug", () => {
    it("creates items in debug mode", () => {
        const ctx = makeCtx({ DEBUG: true } as any);
        executeKeystroke(ctx, CREATE_ITEM_MONSTER_KEY, false, false);
        expect(ctx.dialogCreateItemOrMonster).toHaveBeenCalled();
    });

    it("does nothing for CREATE_ITEM_MONSTER_KEY in non-debug mode", () => {
        const ctx = makeCtx({ DEBUG: false } as any);
        executeKeystroke(ctx, CREATE_ITEM_MONSTER_KEY, false, false);
        expect(ctx.dialogCreateItemOrMonster).not.toHaveBeenCalled();
    });
});

describe("executeEvent", () => {
    it("dispatches keystroke events", () => {
        const ctx = makeCtx();
        const ev = makeEvent({ eventType: EventType.Keystroke, param1: REST_KEY });
        executeEvent(ctx, ev);
        expect(ctx.rogue.playbackBetweenTurns).toBe(false);
        expect(ctx.playerTurnEnded).toHaveBeenCalled();
    });

    it("dispatches mouse up events", () => {
        const ctx = makeCtx();
        const ev = makeEvent({ eventType: EventType.RightMouseUp, param1: 50, param2: 10 });
        executeEvent(ctx, ev);
        expect(ctx.displayInventory).toHaveBeenCalled();
    });

    it("ignores other event types", () => {
        const ctx = makeCtx();
        const ev = makeEvent({ eventType: EventType.MouseEnteredCell });
        executeEvent(ctx, ev);
        // No action dispatched — nothing should have been called except confirmMessages/strip
    });
});

describe("initializeMenuButtons", () => {
    it("creates 5 buttons for normal mode", () => {
        const ctx = makeCtx();
        const buttons: BrogueButton[] = [];
        for (let i = 0; i < 5; i++) buttons.push(ctx.initializeButton());
        const state: ButtonState = {
            buttonFocused: -1,
            buttonDepressed: -1,
            buttonChosen: -1,
            buttonCount: 0,
            buttons: [],
            winX: 0, winY: 0, winWidth: 0, winHeight: 0,
        };
        initializeMenuButtons(ctx, state, buttons);
        expect(ctx.initializeButtonState).toHaveBeenCalled();
        // Buttons should have been placed
        expect(buttons.length).toBeGreaterThanOrEqual(5);
    });

    it("creates playback buttons when in playback mode", () => {
        const ctx = makeCtx({ rogue: { playbackMode: true } as any });
        const buttons: BrogueButton[] = [];
        for (let i = 0; i < 5; i++) buttons.push(ctx.initializeButton());
        const state: ButtonState = {
            buttonFocused: -1,
            buttonDepressed: -1,
            buttonChosen: -1,
            buttonCount: 0,
            buttons: [],
            winX: 0, winY: 0, winWidth: 0, winHeight: 0,
        };
        initializeMenuButtons(ctx, state, buttons);
        // The first button should have ACKNOWLEDGE_KEY hotkey (Unpause)
        expect(buttons[0].hotkey).toContain(ACKNOWLEDGE_KEY);
    });
});

describe("actionMenu", () => {
    it("returns -1 when cancelled", () => {
        const ctx = makeCtx();
        (ctx.buttonInputLoop as any).mockReturnValue(-1);
        expect(actionMenu(ctx, 10, false)).toBe(-1);
    });

    it("returns hotkey of chosen button", () => {
        const ctx = makeCtx();
        // The first normal-mode button is "Rest until better" with AUTO_REST_KEY
        (ctx.buttonInputLoop as any).mockReturnValue(0);
        const result = actionMenu(ctx, 10, false);
        expect(result).toBe(AUTO_REST_KEY);
    });
});

describe("mainInputLoop", () => {
    it("exits when game has ended", () => {
        const ctx = makeCtx({ rogue: { gameHasEnded: true } as any });
        // Should immediately exit the while loop
        mainInputLoop(ctx);
        expect(ctx.allocGrid).toHaveBeenCalled();
        expect(ctx.freeGrid).toHaveBeenCalledTimes(3);
    });

    it("allocates and frees pathing grids", () => {
        const ctx = makeCtx();
        // End game after one iteration
        (ctx.moveCursor as any).mockImplementation((tc: any) => {
            ctx.rogue.gameHasEnded = true;
            return false;
        });
        mainInputLoop(ctx);
        expect(ctx.allocGrid).toHaveBeenCalledTimes(3); // costMap, playerPathingMap, cursorSnapMap
        expect(ctx.freeGrid).toHaveBeenCalledTimes(3);
    });

    it("dispatches actions menu when button 3 is chosen", () => {
        const ctx = makeCtx();
        let iteration = 0;
        (ctx.moveCursor as any).mockImplementation(
            (tc: any, cc: any, tk: any, cl: any, ev: any, st: any) => {
                iteration++;
                if (iteration === 1) {
                    st.buttonChosen = 3;
                    return false;
                }
                ctx.rogue.gameHasEnded = true;
                return false;
            },
        );
        // actionMenu returns -1 (cancelled)
        (ctx.buttonInputLoop as any).mockReturnValue(-1);
        mainInputLoop(ctx);
        // Should have called rectangularShading for the action menu overlay
        expect(ctx.rectangularShading).toHaveBeenCalled();
    });

    it("refreshes sidebar on exit", () => {
        const ctx = makeCtx({ rogue: { gameHasEnded: true } as any });
        mainInputLoop(ctx);
        expect(ctx.refreshSideBar).toHaveBeenCalledWith(-1, -1, false);
    });
});
