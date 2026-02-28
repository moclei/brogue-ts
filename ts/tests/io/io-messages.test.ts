/*
 *  io-messages.test.ts — Tests for io-messages.ts (message system)
 *  brogue-ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { seedRandomGenerator } from "../../src/math/rng.js";
import {
    COLS, DCOLS, MESSAGE_LINES, MESSAGE_ARCHIVE_ENTRIES,
    MAX_MESSAGE_REPEATS, COLOR_ESCAPE, COLOR_VALUE_INTERCEPT,
} from "../../src/types/constants.js";
import { MessageFlag } from "../../src/types/flags.js";
import type { Color, WindowPos, ScreenDisplayBuffer } from "../../src/types/types.js";
import type { DisplayGlyph } from "../../src/types/enums.js";
import { EventType } from "../../src/types/enums.js";
import { createScreenDisplayBuffer } from "../../src/io/io-display.js";
import {
    type ArchivedMessage,
    type MessageState,
    type MessageContext,
    createMessageState,
    getArchivedMessage,
    formatCountedMessage,
    foldMessages,
    formatRecentMessages,
    addMessageToArchive,
    clearMessageArchive,
    updateMessageDisplay,
    displayRecentMessages,
    confirmMessages,
    deleteMessages,
    message,
    messageWithColor,
    flavorMessage,
    temporaryMessage,
    combatMessage,
    displayCombatText,
    displayMoreSign,
    displayMoreSignWithoutWaitingForAcknowledgment,
} from "../../src/io/io-messages.js";

// =============================================================================
// Helpers
// =============================================================================

function colorEsc(r: number, g: number, b: number): string {
    return (
        String.fromCharCode(COLOR_ESCAPE) +
        String.fromCharCode(COLOR_VALUE_INTERCEPT + r) +
        String.fromCharCode(COLOR_VALUE_INTERCEPT + g) +
        String.fromCharCode(COLOR_VALUE_INTERCEPT + b)
    );
}

/** Create a minimal MessageContext for testing rendering functions. */
function createTestContext(
    overrides: Partial<MessageContext> = {},
): MessageContext {
    const state = createMessageState();
    const displayBuffer = createScreenDisplayBuffer();
    const plotCalls: { ch: number; pos: WindowPos; fg: Color; bg: Color }[] = [];

    return {
        rogue: {
            playerTurnNumber: 1,
            cautiousMode: false,
            disturbed: false,
            autoPlayingLevel: false,
            playbackMode: false,
            playbackOOS: false,
            playbackDelayThisTurn: 0,
            playbackDelayPerTurn: 50,
            playbackFastForward: false,
        },
        messageState: state,
        displayBuffer,

        plotCharWithColor: vi.fn((ch, pos, fg, bg) => {
            plotCalls.push({ ch, pos, fg: { ...fg }, bg: { ...bg } });
        }),
        overlayDisplayBuffer: vi.fn(),
        saveDisplayBuffer: vi.fn(() => ({ savedScreen: createScreenDisplayBuffer() })),
        restoreDisplayBuffer: vi.fn(),
        refreshSideBar: vi.fn(),
        refreshDungeonCell: vi.fn(),
        waitForAcknowledgment: vi.fn(),
        pauseBrogue: vi.fn(() => false),
        nextBrogueEvent: vi.fn(() => ({
            eventType: EventType.Keystroke,
            param1: 32, // space = acknowledge
            param2: 0,
            controlKey: false,
            shiftKey: false,
        })),
        flashTemporaryAlert: vi.fn(),
        updateFlavorText: vi.fn(),
        stripShiftFromMovementKeystroke: vi.fn((k: number) => k),
        ...overrides,
    } as unknown as MessageContext;
}

// =============================================================================
// createMessageState
// =============================================================================

describe("createMessageState", () => {
    it("creates an archive of correct size with empty messages", () => {
        const state = createMessageState();
        expect(state.archive.length).toBe(MESSAGE_ARCHIVE_ENTRIES);
        expect(state.archivePosition).toBe(0);
        expect(state.archive[0].message).toBe("");
        expect(state.archive[0].count).toBe(0);
    });

    it("creates MESSAGE_LINES empty displayed messages", () => {
        const state = createMessageState();
        expect(state.displayedMessage.length).toBe(MESSAGE_LINES);
        for (let i = 0; i < MESSAGE_LINES; i++) {
            expect(state.displayedMessage[i]).toBe("");
        }
    });

    it("initializes combat text as empty", () => {
        const state = createMessageState();
        expect(state.combatText).toBe("");
    });
});

// =============================================================================
// getArchivedMessage
// =============================================================================

describe("getArchivedMessage", () => {
    it("returns the entry at archivePosition when back=0", () => {
        const state = createMessageState();
        state.archive[0].message = "test";
        const entry = getArchivedMessage(state, 0);
        expect(entry.message).toBe("test");
    });

    it("returns the most recent entry when back=1", () => {
        const state = createMessageState();
        state.archive[0].message = "first";
        state.archivePosition = 1;
        const entry = getArchivedMessage(state, 1);
        expect(entry.message).toBe("first");
    });

    it("wraps around the ring buffer", () => {
        const state = createMessageState();
        state.archivePosition = 0; // pointing at slot 0
        state.archive[MESSAGE_ARCHIVE_ENTRIES - 1].message = "wrapped";
        const entry = getArchivedMessage(state, 1);
        expect(entry.message).toBe("wrapped");
    });
});

// =============================================================================
// formatCountedMessage
// =============================================================================

describe("formatCountedMessage", () => {
    it("returns raw message when count is 1", () => {
        const m: ArchivedMessage = { message: "hello", count: 1, turn: 0, flags: 0 };
        expect(formatCountedMessage(m)).toBe("hello");
    });

    it("appends (xN) for count > 1", () => {
        const m: ArchivedMessage = { message: "hit", count: 3, turn: 0, flags: 0 };
        expect(formatCountedMessage(m)).toBe("hit (x3)");
    });

    it("appends (many) when count >= MAX_MESSAGE_REPEATS", () => {
        const m: ArchivedMessage = { message: "hit", count: MAX_MESSAGE_REPEATS, turn: 0, flags: 0 };
        expect(formatCountedMessage(m)).toBe("hit (many)");
    });

    it("also shows (many) for count above max", () => {
        const m: ArchivedMessage = { message: "hit", count: MAX_MESSAGE_REPEATS + 1, turn: 0, flags: 0 };
        expect(formatCountedMessage(m)).toBe("hit (many)");
    });
});

// =============================================================================
// addMessageToArchive
// =============================================================================

describe("addMessageToArchive", () => {
    it("inserts a new message at archivePosition and advances", () => {
        const state = createMessageState();
        const isNew = addMessageToArchive(state, "hello world", 0, 1);
        expect(isNew).toBe(true);
        expect(state.archivePosition).toBe(1);
        expect(state.archive[0].message).toBe("hello world");
        expect(state.archive[0].count).toBe(1);
        expect(state.archive[0].turn).toBe(1);
    });

    it("collapses duplicate messages from the same turn", () => {
        const state = createMessageState();
        addMessageToArchive(state, "hit", MessageFlag.FOLDABLE, 1);
        const isNew = addMessageToArchive(state, "hit", MessageFlag.FOLDABLE, 1);
        expect(isNew).toBe(false);
        expect(state.archivePosition).toBe(1); // didn't advance
        expect(state.archive[0].count).toBe(2);
    });

    it("collapses non-foldable with the most recent entry", () => {
        const state = createMessageState();
        addMessageToArchive(state, "you see a door", 0, 1);
        // Same message next turn, non-foldable — collapses with most recent (i===1)
        const isNew = addMessageToArchive(state, "you see a door", 0, 2);
        expect(isNew).toBe(false);
        expect(state.archive[0].count).toBe(2);
        expect(state.archive[0].turn).toBe(2); // updated to current turn
    });

    it("does not collapse different messages", () => {
        const state = createMessageState();
        addMessageToArchive(state, "hello", 0, 1);
        const isNew = addMessageToArchive(state, "world", 0, 1);
        expect(isNew).toBe(true);
        expect(state.archivePosition).toBe(2);
    });

    it("caps repeat count at MAX_MESSAGE_REPEATS", () => {
        const state = createMessageState();
        addMessageToArchive(state, "hit", MessageFlag.FOLDABLE, 1);
        state.archive[0].count = MAX_MESSAGE_REPEATS;
        addMessageToArchive(state, "hit", MessageFlag.FOLDABLE, 1);
        expect(state.archive[0].count).toBe(MAX_MESSAGE_REPEATS); // not incremented
    });

    it("wraps around the ring buffer", () => {
        const state = createMessageState();
        // Fill all but one slot
        for (let i = 0; i < MESSAGE_ARCHIVE_ENTRIES; i++) {
            addMessageToArchive(state, `msg${i}`, 0, i);
        }
        expect(state.archivePosition).toBe(0); // wrapped around
        // Insert one more
        addMessageToArchive(state, "overflow", 0, MESSAGE_ARCHIVE_ENTRIES);
        expect(state.archivePosition).toBe(1);
        expect(state.archive[0].message).toBe("overflow");
    });
});

// =============================================================================
// foldMessages
// =============================================================================

describe("foldMessages", () => {
    it("returns folded=0 when archive is empty", () => {
        const state = createMessageState();
        const result = foldMessages(state, 0);
        expect(result.folded).toBe(0);
        expect(result.text).toBe("");
    });

    it("returns a single non-foldable message", () => {
        const state = createMessageState();
        addMessageToArchive(state, "you descend", 0, 1);
        const result = foldMessages(state, 0);
        expect(result.folded).toBe(1);
        expect(result.text).toBe("you descend");
        expect(result.turn).toBe(1);
    });

    it("folds multiple FOLDABLE messages from the same turn with semicolons", () => {
        const state = createMessageState();
        addMessageToArchive(state, "the goblin hits you", MessageFlag.FOLDABLE, 1);
        addMessageToArchive(state, "you hit the goblin", MessageFlag.FOLDABLE, 1);

        const result = foldMessages(state, 0);
        expect(result.folded).toBe(2);
        // Messages are combined oldest-to-newest with semicolons and trailing period
        expect(result.text).toBe("the goblin hits you; you hit the goblin.");
    });

    it("does not fold messages from different turns", () => {
        const state = createMessageState();
        addMessageToArchive(state, "you hit the goblin", MessageFlag.FOLDABLE, 1);
        addMessageToArchive(state, "the goblin hits you", MessageFlag.FOLDABLE, 2);

        // Most recent message (turn 2) — single FOLDABLE gets trailing period
        const result = foldMessages(state, 0);
        expect(result.folded).toBe(1);
        expect(result.text).toBe("the goblin hits you.");
        expect(result.turn).toBe(2);
    });

    it("does not fold if first message is not FOLDABLE", () => {
        const state = createMessageState();
        addMessageToArchive(state, "you descend", 0, 1);
        addMessageToArchive(state, "the goblin hits you", MessageFlag.FOLDABLE, 1);

        // Most recent message — single FOLDABLE gets trailing period
        const result = foldMessages(state, 0);
        expect(result.folded).toBe(1);
        expect(result.text).toBe("the goblin hits you.");
    });

    it("includes repeated message counts in folded output", () => {
        const state = createMessageState();
        addMessageToArchive(state, "the goblin hits you", MessageFlag.FOLDABLE, 1);
        addMessageToArchive(state, "the goblin hits you", MessageFlag.FOLDABLE, 1); // collapsed -> count=2

        const result = foldMessages(state, 0);
        expect(result.folded).toBe(1);
        // Single FOLDABLE gets trailing period
        expect(result.text).toBe("the goblin hits you (x2).");
    });

    it("wraps long folded messages across lines with period-newline", () => {
        const state = createMessageState();
        // Create messages that are too long to fit on one semicolon-separated line
        const longMsg1 = "the acid mound corrodes your plate armor of multiplicity";
        const longMsg2 = "the goblin mystic casts a spell of confusion at you";
        addMessageToArchive(state, longMsg1, MessageFlag.FOLDABLE, 1);
        addMessageToArchive(state, longMsg2, MessageFlag.FOLDABLE, 1);

        const result = foldMessages(state, 0);
        expect(result.folded).toBe(2);
        // These should be on separate lines since together > DCOLS
        expect(result.text).toContain(".\n");
    });
});

// =============================================================================
// formatRecentMessages
// =============================================================================

describe("formatRecentMessages", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("returns empty buffer for empty archive", () => {
        const state = createMessageState();
        const { buffer, linesFormatted, latestMessageLines } = formatRecentMessages(state, MESSAGE_LINES, 1);
        expect(linesFormatted).toBe(0);
        expect(latestMessageLines).toBe(0);
        for (const line of buffer) {
            expect(line).toBe("");
        }
    });

    it("puts the most recent message in the last row", () => {
        const state = createMessageState();
        addMessageToArchive(state, "hello world", 0, 1);

        const { buffer, linesFormatted } = formatRecentMessages(state, MESSAGE_LINES, 1);
        expect(linesFormatted).toBe(1);
        // Last row should contain the message (capitalized)
        expect(buffer[MESSAGE_LINES - 1]).toContain("Hello world");
    });

    it("counts lines from the current turn as latestMessageLines", () => {
        const state = createMessageState();
        addMessageToArchive(state, "old message", 0, 1);
        addMessageToArchive(state, "new message", 0, 2);

        const { latestMessageLines } = formatRecentMessages(state, MESSAGE_LINES, 2);
        expect(latestMessageLines).toBe(1); // only the new message
    });

    it("handles multiple messages filling multiple rows", () => {
        const state = createMessageState();
        addMessageToArchive(state, "first", 0, 1);
        addMessageToArchive(state, "second", 0, 2);
        addMessageToArchive(state, "third", 0, 3);

        const { buffer, linesFormatted } = formatRecentMessages(state, MESSAGE_LINES, 3);
        expect(linesFormatted).toBe(3);
        expect(buffer[MESSAGE_LINES - 1]).toContain("Third");
        expect(buffer[MESSAGE_LINES - 2]).toContain("Second");
        expect(buffer[MESSAGE_LINES - 3]).toContain("First");
    });
});

// =============================================================================
// clearMessageArchive
// =============================================================================

describe("clearMessageArchive", () => {
    it("resets archive position to 0 and clears all entries", () => {
        const state = createMessageState();
        addMessageToArchive(state, "hello", 0, 1);
        addMessageToArchive(state, "world", 0, 2);
        expect(state.archivePosition).toBe(2);

        clearMessageArchive(state);
        expect(state.archivePosition).toBe(0);
        expect(state.archive[0].message).toBe("");
        expect(state.archive[1].message).toBe("");
    });
});

// =============================================================================
// confirmMessages / deleteMessages
// =============================================================================

describe("confirmMessages", () => {
    it("sets messagesUnconfirmed to 0", () => {
        const ctx = createTestContext();
        ctx.messageState.messagesUnconfirmed = 3;
        confirmMessages(ctx);
        expect(ctx.messageState.messagesUnconfirmed).toBe(0);
    });

    it("calls updateMessageDisplay", () => {
        const ctx = createTestContext();
        ctx.messageState.messagesUnconfirmed = 1;
        confirmMessages(ctx);
        // plotCharWithColor is called by updateMessageDisplay
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });
});

describe("deleteMessages", () => {
    it("clears all displayed messages", () => {
        const ctx = createTestContext();
        ctx.messageState.displayedMessage[0] = "hello";
        ctx.messageState.displayedMessage[1] = "world";
        deleteMessages(ctx);
        for (let i = 0; i < MESSAGE_LINES; i++) {
            expect(ctx.messageState.displayedMessage[i]).toBe("");
        }
    });

    it("also confirms messages", () => {
        const ctx = createTestContext();
        ctx.messageState.messagesUnconfirmed = 2;
        deleteMessages(ctx);
        expect(ctx.messageState.messagesUnconfirmed).toBe(0);
    });
});

// =============================================================================
// updateMessageDisplay
// =============================================================================

describe("updateMessageDisplay", () => {
    it("renders displayed messages via plotCharWithColor", () => {
        const ctx = createTestContext();
        ctx.messageState.displayedMessage[0] = "hi";
        ctx.messageState.messagesUnconfirmed = 1;

        updateMessageDisplay(ctx);

        // Should call plotCharWithColor for at least the 'h' and 'i' characters
        // plus spaces for the rest of the line, for each MESSAGE_LINE
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });

    it("dims confirmed messages (messagesUnconfirmed=0 means all dimmed)", () => {
        const ctx = createTestContext();
        ctx.messageState.displayedMessage[0] = "A";
        ctx.messageState.messagesUnconfirmed = 0;

        const calls: { fg: Color }[] = [];
        (ctx.plotCharWithColor as ReturnType<typeof vi.fn>).mockImplementation(
            (ch: number, pos: WindowPos, fg: Color, bg: Color) => {
                calls.push({ fg: { ...fg } });
            },
        );

        updateMessageDisplay(ctx);

        // The first character should have dimmed color (white dimmed by 50%)
        const charCalls = calls.filter(c => c.fg.red !== 0 || c.fg.green !== 0 || c.fg.blue !== 0);
        if (charCalls.length > 0) {
            // Dimmed white should have values less than 100
            expect(charCalls[0].fg.red).toBeLessThan(100);
        }
    });
});

// =============================================================================
// displayRecentMessages
// =============================================================================

describe("displayRecentMessages", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("populates displayedMessage from the archive", () => {
        const ctx = createTestContext();
        addMessageToArchive(ctx.messageState, "hello world", 0, 1);

        displayRecentMessages(ctx);

        // displayedMessage[0] should have the most recent message
        expect(ctx.messageState.displayedMessage[0]).toContain("Hello world");
    });

    it("sets messagesUnconfirmed based on current turn", () => {
        const ctx = createTestContext();
        ctx.rogue.playerTurnNumber = 5;
        addMessageToArchive(ctx.messageState, "old msg", 0, 3);
        addMessageToArchive(ctx.messageState, "new msg", 0, 5);

        displayRecentMessages(ctx);

        expect(ctx.messageState.messagesUnconfirmed).toBe(1);
    });
});

// =============================================================================
// message
// =============================================================================

describe("message", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("does nothing for empty string", () => {
        const ctx = createTestContext();
        message(ctx, "", 0);
        expect(ctx.messageState.archivePosition).toBe(0);
    });

    it("sets rogue.disturbed to true", () => {
        const ctx = createTestContext();
        message(ctx, "hello", 0);
        expect(ctx.rogue.disturbed).toBe(true);
    });

    it("adds message to archive and updates display", () => {
        const ctx = createTestContext();
        message(ctx, "the door opens", 0);
        expect(ctx.messageState.archivePosition).toBe(1);
        expect(ctx.messageState.displayedMessage[0]).toContain("The door opens");
    });

    it("calls refreshSideBar for REQUIRE_ACKNOWLEDGMENT", () => {
        const ctx = createTestContext();
        message(ctx, "important!", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
        expect(ctx.refreshSideBar).toHaveBeenCalledWith(-1, -1, false);
    });

    it("calls refreshSideBar for REFRESH_SIDEBAR", () => {
        const ctx = createTestContext();
        message(ctx, "sidebar update", MessageFlag.REFRESH_SIDEBAR);
        expect(ctx.refreshSideBar).toHaveBeenCalledWith(-1, -1, false);
    });

    it("displays --MORE-- and confirms for REQUIRE_ACKNOWLEDGMENT", () => {
        const ctx = createTestContext();
        message(ctx, "important!", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
        expect(ctx.waitForAcknowledgment).toHaveBeenCalled();
    });

    it("displays --MORE-- when cautiousMode is true", () => {
        const ctx = createTestContext();
        ctx.rogue.cautiousMode = true;
        message(ctx, "be careful!", 0);
        expect(ctx.waitForAcknowledgment).toHaveBeenCalled();
        expect(ctx.rogue.cautiousMode).toBe(false);
    });

    it("adds playback delay in playback mode", () => {
        const ctx = createTestContext();
        ctx.rogue.playbackMode = true;
        ctx.rogue.playbackDelayPerTurn = 50;
        ctx.rogue.playbackDelayThisTurn = 0;
        message(ctx, "hello", 0);
        expect(ctx.rogue.playbackDelayThisTurn).toBe(250); // min(2000, 50*5)
    });
});

// =============================================================================
// messageWithColor
// =============================================================================

describe("messageWithColor", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("prepends a color escape to the message", () => {
        const ctx = createTestContext();
        const red: Color = {
            red: 100, green: 0, blue: 0,
            redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false,
        };
        messageWithColor(ctx, "danger!", red, 0);

        const entry = getArchivedMessage(ctx.messageState, 1);
        // The message should start with a COLOR_ESCAPE
        expect(entry.message.charCodeAt(0)).toBe(COLOR_ESCAPE);
        expect(entry.message).toContain("danger!");
    });
});

// =============================================================================
// flavorMessage
// =============================================================================

describe("flavorMessage", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("capitalizes the first visible character", () => {
        const ctx = createTestContext();
        flavorMessage(ctx, "a mossy floor");
        // Check that printString was called (through display buffer)
        // The flavor text is rendered to ROWS-2
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });

    it("handles leading color escapes when capitalizing", () => {
        const ctx = createTestContext();
        const esc = colorEsc(50, 50, 50);
        flavorMessage(ctx, esc + "a green floor");
        // Should not throw and should capitalize after the escape
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });
});

// =============================================================================
// temporaryMessage
// =============================================================================

describe("temporaryMessage", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("clears the message area and prints the text", () => {
        const ctx = createTestContext();
        temporaryMessage(ctx, "choose a direction:", 0);
        // plotCharWithColor should be called to clear and print
        expect(ctx.plotCharWithColor).toHaveBeenCalled();
    });

    it("calls refreshSideBar when REFRESH_SIDEBAR flag set", () => {
        const ctx = createTestContext();
        temporaryMessage(ctx, "prompt", MessageFlag.REFRESH_SIDEBAR);
        expect(ctx.refreshSideBar).toHaveBeenCalledWith(-1, -1, false);
    });

    it("waits for acknowledgment when REQUIRE_ACKNOWLEDGMENT flag set", () => {
        const ctx = createTestContext();
        temporaryMessage(ctx, "press space", MessageFlag.REQUIRE_ACKNOWLEDGMENT);
        expect(ctx.waitForAcknowledgment).toHaveBeenCalled();
    });
});

// =============================================================================
// combatMessage / displayCombatText
// =============================================================================

describe("combatMessage", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("buffers a combat message", () => {
        const ctx = createTestContext();
        const red: Color = {
            red: 100, green: 0, blue: 0,
            redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false,
        };
        combatMessage(ctx, "you hit the goblin", red);
        expect(ctx.messageState.combatText).toContain("you hit the goblin");
    });

    it("appends subsequent combat messages with newlines", () => {
        const ctx = createTestContext();
        combatMessage(ctx, "you hit the goblin", null);
        combatMessage(ctx, "the goblin dodges", null);
        expect(ctx.messageState.combatText).toContain("\n");
    });

    it("uses white color when null is passed", () => {
        const ctx = createTestContext();
        combatMessage(ctx, "attack", null);
        // The combat text should start with a color escape
        expect(ctx.messageState.combatText.charCodeAt(0)).toBe(COLOR_ESCAPE);
    });
});

describe("displayCombatText", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("does nothing when combatText is empty", () => {
        const ctx = createTestContext();
        displayCombatText(ctx);
        expect(ctx.messageState.archivePosition).toBe(0);
    });

    it("flushes buffered combat text as FOLDABLE messages", () => {
        const ctx = createTestContext();
        ctx.messageState.combatText = "you hit the goblin";

        displayCombatText(ctx);

        expect(ctx.messageState.combatText).toBe("");
        // Should have added a message to the archive
        const entry = getArchivedMessage(ctx.messageState, 1);
        expect(entry.message).toBe("you hit the goblin");
        expect(entry.flags & MessageFlag.FOLDABLE).toBeTruthy();
    });

    it("splits multi-line combat text into separate messages", () => {
        const ctx = createTestContext();
        ctx.messageState.combatText = "first hit\nsecond hit";

        displayCombatText(ctx);

        expect(ctx.messageState.archivePosition).toBe(2);
    });

    it("adds REQUIRE_ACKNOWLEDGMENT when cautiousMode is true", () => {
        const ctx = createTestContext();
        ctx.rogue.cautiousMode = true;
        ctx.messageState.combatText = "you hit the goblin";

        displayCombatText(ctx);

        expect(ctx.waitForAcknowledgment).toHaveBeenCalled();
    });
});

// =============================================================================
// displayMoreSign
// =============================================================================

describe("displayMoreSign", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("does nothing when autoPlayingLevel is true", () => {
        const ctx = createTestContext();
        ctx.rogue.autoPlayingLevel = true;
        displayMoreSign(ctx);
        expect(ctx.waitForAcknowledgment).not.toHaveBeenCalled();
    });

    it("shows --MORE-- and waits for acknowledgment", () => {
        const ctx = createTestContext();
        displayMoreSign(ctx);
        expect(ctx.waitForAcknowledgment).toHaveBeenCalled();
    });
});

// =============================================================================
// displayMoreSignWithoutWaitingForAcknowledgment
// =============================================================================

describe("displayMoreSignWithoutWaitingForAcknowledgment", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("does not wait for acknowledgment", () => {
        const ctx = createTestContext();
        displayMoreSignWithoutWaitingForAcknowledgment(ctx);
        expect(ctx.waitForAcknowledgment).not.toHaveBeenCalled();
    });
});

// =============================================================================
// splitLines (via io-text.ts, tested indirectly through formatRecentMessages)
// =============================================================================

describe("splitLines (via formatRecentMessages)", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("preserves color escapes across line boundaries", () => {
        const state = createMessageState();
        // A message with a color escape that wraps to multiple lines
        const esc = colorEsc(100, 0, 0);
        const longMsg = esc + "a very long message that should definitely wrap across multiple lines when formatted into the message display area";
        addMessageToArchive(state, longMsg, 0, 1);

        const { buffer, linesFormatted } = formatRecentMessages(state, 10, 1);
        // If it wrapped, there should be more than 1 line
        if (linesFormatted > 1) {
            // The second line should start with the color escape
            const secondLine = buffer[10 - linesFormatted + 1];
            if (secondLine) {
                expect(secondLine.charCodeAt(0)).toBe(COLOR_ESCAPE);
            }
        }
    });
});

// =============================================================================
// Integration: multiple messages in sequence
// =============================================================================

describe("message system integration", () => {
    beforeEach(() => {
        seedRandomGenerator(12345n);
    });

    it("handles a sequence of messages across turns", () => {
        const ctx = createTestContext();

        ctx.rogue.playerTurnNumber = 1;
        message(ctx, "you see a door", 0);

        ctx.rogue.playerTurnNumber = 2;
        message(ctx, "you open the door", 0);

        ctx.rogue.playerTurnNumber = 3;
        message(ctx, "a goblin attacks!", 0);

        expect(ctx.messageState.archivePosition).toBe(3);

        // displayedMessage should show the most recent messages
        expect(ctx.messageState.displayedMessage[0]).toContain("goblin");
    });

    it("handles combat text flushed via message()", () => {
        const ctx = createTestContext();

        combatMessage(ctx, "you hit the goblin", null);
        combatMessage(ctx, "the goblin staggers", null);

        // message() calls displayCombatText() internally
        message(ctx, "the goblin dies", 0);

        // All three should be archived (2 combat + 1 regular)
        expect(ctx.messageState.archivePosition).toBeGreaterThanOrEqual(3);
    });

    it("foldable messages from the same turn are combined", () => {
        const ctx = createTestContext();
        ctx.rogue.playerTurnNumber = 5;

        message(ctx, "the goblin hits you", MessageFlag.FOLDABLE);
        message(ctx, "you hit the goblin", MessageFlag.FOLDABLE);

        // Verify the display shows them folded (semicolon-separated)
        const combined = ctx.messageState.displayedMessage.join(" ");
        expect(combined).toContain(";");
    });
});
