/*
 *  game.test.ts — Tests for game/ module functions
 *  brogue-ts
 *
 *  Phase 3b NEEDS-VERIFICATION: setPlayerDisplayChar
 *  Phase 4a NEEDS-VERIFICATION: getOrdinalSuffix, printBrogueVersion
 *  Source: RogueMain.c:137, 39
 */

import { describe, it, expect } from "vitest";
import { setPlayerDisplayChar, getOrdinalSuffix, printBrogueVersion } from "../src/game/game-init.js";
import { createCreature } from "../src/monsters/monster-creation.js";
import { monsterCatalog } from "../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, GameMode, DisplayGlyph } from "../src/types/enums.js";
import type { Creature } from "../src/types/types.js";

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
        // victory() is called when the player escapes the dungeon.
        // Requires: funkyFade, plotCharToBuffer, printString, saveHighScore, saveRecording.
        // superVictory vs normal victory paths both untested.
        // travel-explore.test.ts verifies that victory is *called* at the right time
        // (player reaches upstairs with amulet), but the display sequence is unverified.
    },
);
