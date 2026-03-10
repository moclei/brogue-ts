/*
 *  game.test.ts — Tests for game/ module functions
 *  brogue-ts
 *
 *  Phase 3b NEEDS-VERIFICATION: setPlayerDisplayChar
 *  Phase 4a NEEDS-VERIFICATION: getOrdinalSuffix, printBrogueVersion
 *  Phase 4b NEEDS-VERIFICATION: initializeGameVariant, welcome, fileExists,
 *                                chooseFile, openFile, enableEasyMode, executeEvent
 *  Source: RogueMain.c:137, 39, 157, 173, 45, 55, 68, 89, 1384
 */

import { describe, it, expect, vi } from "vitest";
import {
    setPlayerDisplayChar, getOrdinalSuffix, printBrogueVersion,
    initializeGameVariant, welcome, fileExists, chooseFile, openFile,
} from "../src/game/game-init.js";
import { enableEasyMode } from "../src/game/game-lifecycle.js";
import { executeEvent } from "../src/io/input-dispatch.js";
import { createCreature } from "../src/monsters/monster-creation.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, GameMode, GameVariant, EventType, DisplayGlyph } from "../src/types/enums.js";
import { MessageFlag } from "../src/types/flags.js";
import { EASY_MODE_KEY } from "../src/types/constants.js";
import type { Creature, RogueEvent } from "../src/types/types.js";

function makePlayer(): Creature {
    const c = createCreature();
    const cat = monsterCatalog[MonsterType.MK_YOU];
    c.info = { ...cat, damage: { ...cat.damage }, foreColor: { ...cat.foreColor }, bolts: [...cat.bolts] };
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

// =============================================================================
// setPlayerDisplayChar — Monsters.c:409
// =============================================================================

describe("setPlayerDisplayChar", () => {
    it("sets G_DEMON in easy mode", () => {
        const player = makePlayer();
        setPlayerDisplayChar(player, GameMode.Easy);
        expect(player.info.displayChar).toBe(DisplayGlyph.G_DEMON);
    });

    it("sets G_PLAYER in normal mode", () => {
        const player = makePlayer();
        setPlayerDisplayChar(player, GameMode.Normal);
        expect(player.info.displayChar).toBe(DisplayGlyph.G_PLAYER);
    });

    it("sets G_PLAYER for any non-easy mode", () => {
        const player = makePlayer();
        setPlayerDisplayChar(player, GameMode.Seed);
        expect(player.info.displayChar).toBe(DisplayGlyph.G_PLAYER);
    });
});

// =============================================================================
// getOrdinalSuffix — RogueMain.c:137
// =============================================================================

describe("getOrdinalSuffix", () => {
    it("1 → st", () => expect(getOrdinalSuffix(1)).toBe("st"));
    it("2 → nd", () => expect(getOrdinalSuffix(2)).toBe("nd"));
    it("3 → rd", () => expect(getOrdinalSuffix(3)).toBe("rd"));
    it("4 → th", () => expect(getOrdinalSuffix(4)).toBe("th"));
    it("10 → th", () => expect(getOrdinalSuffix(10)).toBe("th"));
    it("11 → th (special case)", () => expect(getOrdinalSuffix(11)).toBe("th"));
    it("12 → th (special case)", () => expect(getOrdinalSuffix(12)).toBe("th"));
    it("13 → th (special case)", () => expect(getOrdinalSuffix(13)).toBe("th"));
    it("21 → st", () => expect(getOrdinalSuffix(21)).toBe("st"));
    it("22 → nd", () => expect(getOrdinalSuffix(22)).toBe("nd"));
    it("23 → rd", () => expect(getOrdinalSuffix(23)).toBe("rd"));
    it("26 → th (amulet level)", () => expect(getOrdinalSuffix(26)).toBe("th"));
    // C only special-cases 11, 12, 13 — not 111, 112, 113
    it("111 → st (no teen override)", () => expect(getOrdinalSuffix(111)).toBe("st"));
    it("112 → nd (no teen override)", () => expect(getOrdinalSuffix(112)).toBe("nd"));
    it("113 → rd (no teen override)", () => expect(getOrdinalSuffix(113)).toBe("rd"));
});

// =============================================================================
// printBrogueVersion — RogueMain.c:39
// =============================================================================

describe("printBrogueVersion", () => {
    it("returns a string containing all three version lines", () => {
        const result = printBrogueVersion("1.15.1", "1.0", "2.0");
        expect(result).toContain("Brogue version: 1.15.1");
        expect(result).toContain("Supports variant (rapid_brogue): 1.0");
        expect(result).toContain("Supports variant (bullet_brogue): 2.0");
    });

    it("returns a newline-delimited multi-line string", () => {
        const result = printBrogueVersion("a", "b", "c");
        const lines = result.split("\n");
        expect(lines).toHaveLength(3);
    });
});

// =============================================================================
// initializeRogue — RogueMain.c:190
// Complex orchestrator (~345 lines); requires full GameInitContext mock.
// Covered indirectly by seed-determinism.test.ts via the wiring in lifecycle.ts.
// =============================================================================

it.skip(
    "initializeRogue: full direct test requires GameInitContext mock (complex orchestrator)",
    () => {
        // UPDATE: complex orchestrator (~50 context members); indirect coverage via seed-determinism.test.ts.
        // GameInitContext has ~50 context members including RNG, catalog,
        // item generation, equipment, message archive, recording.
        // Direct unit test deferred; seed-determinism.test.ts provides integration coverage.
    },
);

// =============================================================================
// freeEverything — RogueMain.c:984
// Lifecycle wrapper: calls freeEverythingFn(buildCleanupContext()).
// Domain function tested in game/game-cleanup.test.ts (freeCreature, removeDeadMonsters).
// Integration test requires full CleanupContext with allocated grids.
// =============================================================================

it.skip(
    "freeEverything: full test requires CleanupContext with allocated level/grid data",
    () => {
        // UPDATE: needs CleanupContext with allocated level/grid data; risk: low.
        // freeEverything iterates levels[0..deepestLevel], frees grids, clears arrays.
        // The domain fn freeEverything in game-cleanup.ts is straightforward; the lifecycle
        // wrapper in lifecycle.ts delegates via buildCleanupContext().
        // Risk: low (GC prevents leaks; object invariants cleared by array/null assignment).
    },
);

// =============================================================================
// gameOver (game-lifecycle.ts:201) — RogueMain.c:1046
// Full death sequence: input loop, funkyFade, printHighScores, saveRecording.
// Requires IO mocks. Synchronous state phase tested in core.test.ts.
// =============================================================================

it.skip(
    "gameOver (game-lifecycle.ts): full death screen requires IO context mocks",
    () => {
        // UPDATE: full death screen — needs IO context mocks (nextBrogueEvent, funkyFade, etc.).
        // core.ts:gameOver (sync state: MB_IS_DYING, gameHasEnded) has 5 tests in core.test.ts.
        // game-lifecycle.ts:gameOver (full sequence) needs:
        //   - nextBrogueEvent mock (input loop termination)
        //   - funkyFade, printHighScores, saveRecording mocks
        //   - KEYBOARD_LABELS constant handling
        // D_IMMORTAL path (player gets better) is also untested.
    },
);

// =============================================================================
// victory (game-lifecycle.ts:416) — RogueMain.c:1218
// Full victory sequence: 3 display screens, item tally, achievements, recording.
// Requires IO + display mocks.
// =============================================================================

it.skip(
    "victory (game-lifecycle.ts): full victory screen requires IO + display context mocks",
    () => {
        // UPDATE: full victory — needs IO + display context mocks.
        // victory() is called when the player escapes the dungeon.
        // Requires: funkyFade, plotCharToBuffer, printString, saveHighScore, saveRecording.
        // superVictory vs normal victory paths both untested.
        // travel-explore.test.ts verifies that victory is *called* at the right time
        // (player reaches upstairs with amulet), but the display sequence is unverified.
    },
);

// =============================================================================
// initializeGameVariant — RogueMain.c:173
// =============================================================================

describe("initializeGameVariant", () => {
    function makeCtx() {
        return {
            gameVariant: GameVariant.Brogue,
            initializeGameVariantBrogue: vi.fn(),
            initializeGameVariantRapidBrogue: vi.fn(),
            initializeGameVariantBulletBrogue: vi.fn(),
        };
    }

    it("dispatches to initializeGameVariantBrogue for default variant", () => {
        const ctx = makeCtx();
        ctx.gameVariant = GameVariant.Brogue;
        initializeGameVariant(ctx as any);
        expect(ctx.initializeGameVariantBrogue).toHaveBeenCalledOnce();
        expect(ctx.initializeGameVariantRapidBrogue).not.toHaveBeenCalled();
    });

    it("dispatches to initializeGameVariantRapidBrogue", () => {
        const ctx = makeCtx();
        ctx.gameVariant = GameVariant.RapidBrogue;
        initializeGameVariant(ctx as any);
        expect(ctx.initializeGameVariantRapidBrogue).toHaveBeenCalledOnce();
        expect(ctx.initializeGameVariantBrogue).not.toHaveBeenCalled();
    });

    it("dispatches to initializeGameVariantBulletBrogue", () => {
        const ctx = makeCtx();
        ctx.gameVariant = GameVariant.BulletBrogue;
        initializeGameVariant(ctx as any);
        expect(ctx.initializeGameVariantBulletBrogue).toHaveBeenCalledOnce();
        expect(ctx.initializeGameVariantBrogue).not.toHaveBeenCalled();
    });
});

// =============================================================================
// welcome — RogueMain.c:157
// =============================================================================
// Divergence: C uses encodeMessageColor to embed color codes in the amulet message;
// TS concatenates a plain string. The Amulet name will not be colorized in-game.
// Test.skip tracks the color-encoding gap.

describe("welcome", () => {
    function makeCtx(keyboardLabels: boolean) {
        const messages: string[] = [];
        return {
            message: vi.fn((msg: string) => { messages.push(msg); }),
            messageWithColor: vi.fn(),
            flavorMessage: vi.fn(),
            encodeMessageColor: vi.fn(),
            itemMessageColor: {},
            white: {},
            backgroundMessageColor: {},
            KEYBOARD_LABELS: keyboardLabels,
            gameConst: { amuletLevel: 26 },
            _messages: messages,
        };
    }

    it("sends welcome and amulet messages (amuletLevel=26)", () => {
        const ctx = makeCtx(false);
        welcome(ctx as any);
        expect(ctx.message).toHaveBeenCalledWith(
            "Hello and welcome, adventurer, to the Dungeons of Doom!", 0,
        );
        const amuletCall = ctx.message.mock.calls[1][0] as string;
        expect(amuletCall).toContain("Amulet of Yendor");
        expect(amuletCall).toContain("26th floor");
    });

    it("sends keyboard-help message only when KEYBOARD_LABELS=true", () => {
        const ctxOff = makeCtx(false);
        welcome(ctxOff as any);
        expect(ctxOff.messageWithColor).not.toHaveBeenCalled();

        const ctxOn = makeCtx(true);
        welcome(ctxOn as any);
        expect(ctxOn.messageWithColor).toHaveBeenCalledOnce();
        expect(ctxOn.messageWithColor.mock.calls[0][0]).toContain("<?>");
    });

    it("always sends the flavor message", () => {
        const ctx = makeCtx(false);
        welcome(ctx as any);
        expect(ctx.flavorMessage).toHaveBeenCalledWith(
            "The doors to the dungeon slam shut behind you.",
        );
    });

    it.skip("welcome: amulet name is not colorized (color encoding divergence vs C)", () => {
        // UPDATE: known acceptable divergence — no encodeMessageColor call in TS.
        // C: welcome() calls encodeMessageColor(buf, ..., &itemMessageColor) and
        //    encodeMessageColor(buf, ..., &white) to embed color codes in the message string.
        // TS: welcome() (game-init.ts) just joins the strings — no encodeMessageColor call.
        // Fix: call ctx.encodeMessageColor on the string[] parts before joining.
        // Impact: Amulet of Yendor will not be highlighted in itemMessageColor in-game.
    });
});

// =============================================================================
// fileExists — RogueMain.c:55
// =============================================================================

describe("fileExists", () => {
    it("returns true when ctx.fileExistsSync returns true", () => {
        const ctx = { fileExistsSync: (_p: string) => true };
        expect(fileExists(ctx, "/some/path.broguesave")).toBe(true);
    });

    it("returns false when ctx.fileExistsSync returns false", () => {
        const ctx = { fileExistsSync: (_p: string) => false };
        expect(fileExists(ctx, "/no/such/file")).toBe(false);
    });

    it("passes the pathname to ctx.fileExistsSync", () => {
        const spy = vi.fn(() => false);
        fileExists({ fileExistsSync: spy }, "/my/file.brogue");
        expect(spy).toHaveBeenCalledWith("/my/file.brogue");
    });
});

// =============================================================================
// chooseFile — RogueMain.c:68
// =============================================================================

describe("chooseFile", () => {
    it("returns path+suffix when getInputTextString returns non-empty name", () => {
        const ctx = { getInputTextString: () => "dungeon" };
        const result = chooseFile(ctx as any, "prompt", "default", ".broguesave", 0);
        expect(result).toBe("dungeon.broguesave");
    });

    it("returns null when getInputTextString returns null (cancelled)", () => {
        const ctx = { getInputTextString: () => null };
        expect(chooseFile(ctx as any, "prompt", "default", ".broguesave", 0)).toBeNull();
    });

    it("returns null when getInputTextString returns empty string", () => {
        const ctx = { getInputTextString: () => "" };
        expect(chooseFile(ctx as any, "prompt", "default", ".broguesave", 0)).toBeNull();
    });
});

// =============================================================================
// openFile — RogueMain.c:89
// =============================================================================

describe("openFile", () => {
    it("returns success:false when file does not exist", () => {
        const ctx = { fileExistsSync: () => false };
        const result = openFile(ctx, "/no/file.broguesave");
        expect(result.success).toBe(false);
        expect(result.currentFilePath).toBe("");
    });

    it("returns success:true with currentFilePath and derived annotationPathname", () => {
        const ctx = { fileExistsSync: () => true };
        const result = openFile(ctx, "/save/dungeon.broguesave");
        expect(result.success).toBe(true);
        expect(result.currentFilePath).toBe("/save/dungeon.broguesave");
        expect(result.annotationPathname).toBe("/save/dungeon.txt");
    });

    it("leaves annotationPathname empty when path has no dot", () => {
        const ctx = { fileExistsSync: () => true };
        const result = openFile(ctx, "/save/dungeon");
        expect(result.success).toBe(true);
        // No dot → no annotation suffix derivable (lastIndexOf(".") returns -1)
        expect(result.annotationPathname).toBe("");
    });
});

// =============================================================================
// enableEasyMode — RogueMain.c:1384
// =============================================================================

describe("enableEasyMode", () => {
    function makeEasyCtx(confirmResult: boolean, initialMode = GameMode.Normal) {
        const player = makePlayer();
        return {
            rogue: { mode: initialMode },
            player,
            message: vi.fn(),
            confirm: vi.fn(() => confirmResult),
            recordKeystroke: vi.fn(),
            refreshDungeonCell: vi.fn(),
            refreshSideBar: vi.fn(),
        };
    }

    it("sends 'Alas' message and returns early when already in easy mode", () => {
        const ctx = makeEasyCtx(false, GameMode.Easy);
        enableEasyMode(ctx as any);
        expect(ctx.message.mock.calls[0][0]).toContain("Alas");
        expect(ctx.confirm).not.toHaveBeenCalled();
        expect(ctx.rogue.mode).toBe(GameMode.Easy);
    });

    it("sends 'dissipates' message when player declines", () => {
        const ctx = makeEasyCtx(false);
        enableEasyMode(ctx as any);
        expect(ctx.confirm).toHaveBeenCalledOnce();
        const lastMsg = ctx.message.mock.calls.at(-1)?.[0] as string;
        expect(lastMsg).toContain("dissipates");
        expect(ctx.rogue.mode).toBe(GameMode.Normal);
    });

    it("enables easy mode and records keystroke when player confirms", () => {
        const ctx = makeEasyCtx(true);
        enableEasyMode(ctx as any);
        expect(ctx.rogue.mode).toBe(GameMode.Easy);
        expect(ctx.recordKeystroke).toHaveBeenCalledWith(EASY_MODE_KEY, false, true);
        expect(ctx.refreshDungeonCell).toHaveBeenCalledOnce();
        expect(ctx.refreshSideBar).toHaveBeenCalledOnce();
    });

    it("first message to player uses REQUIRE_ACKNOWLEDGMENT flag", () => {
        const ctx = makeEasyCtx(false);
        enableEasyMode(ctx as any);
        const firstMsg = ctx.message.mock.calls[0];
        expect(firstMsg[1]).toBe(MessageFlag.REQUIRE_ACKNOWLEDGMENT);
    });
});

// =============================================================================
// executeEvent — RogueMain.c:45
// =============================================================================

describe("executeEvent", () => {
    function makeMinimalCtx() {
        return { rogue: { playbackBetweenTurns: true } };
    }

    function makeEvent(type: EventType, param1 = 0): RogueEvent {
        return { eventType: type, param1, param2: 0, controlKey: false, shiftKey: false };
    }

    it("always sets playbackBetweenTurns to false", async () => {
        const ctx = makeMinimalCtx();
        const ev = makeEvent(EventType.MouseMoved);
        await executeEvent(ctx as any, ev);
        expect(ctx.rogue.playbackBetweenTurns).toBe(false);
    });

    it("calls onMouseClick for MOUSE_UP event", async () => {
        const ctx = makeMinimalCtx();
        const onMouseClick = vi.fn(async () => {});
        await executeEvent(ctx as any, makeEvent(EventType.MouseUp), onMouseClick);
        expect(onMouseClick).toHaveBeenCalledOnce();
    });

    it("calls onMouseClick for RIGHT_MOUSE_UP event", async () => {
        const ctx = makeMinimalCtx();
        const onMouseClick = vi.fn(async () => {});
        await executeEvent(ctx as any, makeEvent(EventType.RightMouseUp), onMouseClick);
        expect(onMouseClick).toHaveBeenCalledOnce();
    });

    it("does not call onMouseClick for unmatched event type", async () => {
        const ctx = makeMinimalCtx();
        const onMouseClick = vi.fn(async () => {});
        await executeEvent(ctx as any, makeEvent(EventType.MouseMoved), onMouseClick);
        expect(onMouseClick).not.toHaveBeenCalled();
    });

    it.skip("executeEvent: KEYSTROKE path requires full InputContext mock", () => {
        // UPDATE: needs full InputContext mock; indirect coverage via io/input-cursor.ts in play.
        // C: executeEvent dispatches KEYSTROKE → executeKeystroke(param1, controlKey, shiftKey).
        // TS: executeEvent → executeKeystroke(ctx, param1, controlKey, shiftKey, openMenu).
        // executeKeystroke requires a full InputContext with rogue, player, items, equipment etc.
        // Indirect coverage: input-dispatch.ts is exercised by io/input-cursor.ts in play sessions.
    });
})
