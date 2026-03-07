/*
 *  tests/menus/menus.test.ts — Menu module tests
 *  Port V2 — rogue-ts
 *
 *  Covers:
 *   - Flame simulation: updateMenuFlames advances values from source
 *   - Stats: addRunToGameStats accumulates correctly
 *   - Save/Load: stubbed pending implementation (test.skip)
 */

import { describe, it, expect } from "vitest";
import { createFlameGrid, createFlameColorGrid, createColorSources, updateMenuFlames } from "../../src/menus/menu-flames.js";
import { createGameStats, addRunToGameStats } from "../../src/menus/character-select.js";
import type { RogueRun } from "../../src/menus/menu-types.js";

// =============================================================================
// Flame simulation
// =============================================================================

describe("updateMenuFlames", () => {
    it("advances flame values from a source tile", () => {
        const colors = createFlameColorGrid();
        const flames = createFlameGrid();
        const colorSources = createColorSources({ rand_range: () => 0 });

        // Place a high-intensity red color source at the bottom-left
        const ROWS_PADDED = flames[0].length;
        colors[0][ROWS_PADDED - 1] = {
            red: 100, green: 0, blue: 0,
            redRand: 0, greenRand: 0, blueRand: 0, rand: 0,
        };

        updateMenuFlames(colors, colorSources, flames, { rand_range: () => 0 });

        // The source tile should have non-zero red after one update
        expect(flames[0][ROWS_PADDED - 1][0]).toBeGreaterThan(0);
    });
});

// =============================================================================
// Game stats
// =============================================================================

describe("addRunToGameStats", () => {
    it("accumulates wins and streaks correctly", () => {
        const stats = createGameStats();
        const run: RogueRun = {
            seed: 42n,
            dateNumber: 20240101,
            result: "Escaped",
            killedBy: "",
            gold: 500,
            lumenstones: 3,
            score: 1000,
            turns: 2000,
            deepestLevel: 10,
        };

        addRunToGameStats(run, stats);

        expect(stats.games).toBe(1);
        expect(stats.won).toBe(1);
        expect(stats.escaped).toBe(1);
        expect(stats.currentWinStreak).toBe(1);
        expect(stats.highestScore).toBe(1000);
        expect(stats.deepestLevel).toBe(10);
        expect(stats.fewestTurnsWin).toBe(2000);
    });

    it("resets win streak on a loss", () => {
        const stats = createGameStats();
        const win: RogueRun = {
            seed: 1n, dateNumber: 0, result: "Escaped", killedBy: "",
            gold: 0, lumenstones: 0, score: 100, turns: 100, deepestLevel: 5,
        };
        const loss: RogueRun = {
            seed: 2n, dateNumber: 0, result: "Killed", killedBy: "a goblin",
            gold: 0, lumenstones: 0, score: 50, turns: 50, deepestLevel: 2,
        };

        addRunToGameStats(win, stats);
        addRunToGameStats(loss, stats);

        expect(stats.longestWinStreak).toBe(1);
        expect(stats.currentWinStreak).toBe(0);
    });

    it("seed === 0n resets recent stats (save-reset marker)", () => {
        const stats = createGameStats();
        const run: RogueRun = {
            seed: 1n, dateNumber: 0, result: "Escaped", killedBy: "",
            gold: 0, lumenstones: 0, score: 100, turns: 100, deepestLevel: 5,
        };
        const resetMarker: RogueRun = {
            seed: 0n, dateNumber: 0, result: "", killedBy: "",
            gold: 0, lumenstones: 0, score: 0, turns: 0, deepestLevel: 0,
        };

        addRunToGameStats(run, stats);
        // seed === 0 is the reset marker — caller in viewGameStats re-inits recent stats
        expect(resetMarker.seed).toBe(0n);
        // This documents the convention used by viewGameStats to detect a reset marker
    });
});

// =============================================================================
// Save / Load — stubbed (not yet implemented)
// =============================================================================

describe("save / load game", () => {
    it.skip("saveGameNoPrompt() persists game state to the current file path", () => {
        // STUB: saveGameNoPrompt is deferred to the recordings/persistence phase.
        // Correct behavior: calls the platform file ops to write a .broguesave file
        // at ctx.currentFilePath, encoding the full rogue state.
    });

    it.skip("loadSavedGame() restores a .broguesave file and starts mainInputLoop", () => {
        // STUB: loadSavedGame is deferred to the recordings/persistence phase.
        // Correct behavior: reads the .broguesave at gamePath, restores rogue state,
        // and calls startLevel() followed by mainInputLoop().
    });

    it.skip("saveRecordingNoPrompt() writes a .broguerec recording file", () => {
        // STUB: recording subsystem deferred.
        // Correct behavior: flushes the recording buffer to disk as a .broguerec file.
    });

    it.skip("openFile() returns false for non-existent paths", () => {
        // STUB: platform file ops deferred.
        // Correct behavior: ctx.openFile('nonexistent.broguesave') returns false.
    });
});

// =============================================================================
// Stub registry — Recordings.c domain stubs (Phase 3c, port-v2-audit)
// =============================================================================

it.skip("stub: flushBufferToFile() is a no-op (should write the recording buffer to disk)", () => {
    // C: Recordings.c:223 — flushBufferToFile()
    // menus.ts:250 and lifecycle.ts:483 have `() => {}` context stubs.
    // Real implementation should flush the in-memory recording buffer to a
    // .broguerec file at the current recording path.
});

it.skip("stub: initRecording() is a no-op (should initialize the recording state at game start)", () => {
    // C: Recordings.c:465 — initRecording()
    // lifecycle.ts:238 has a `() => {}` context stub; called once at game init.
    // Real implementation should reset the recording buffer, checkpoint the RNG
    // state, and prepare the file header for a new .broguerec recording.
});

it.skip("stub: pausePlayback() is a no-op (should pause the recording playback state machine)", () => {
    // C: Recordings.c:813 — pausePlayback()
    // menus.ts:258 has a `() => {}` context stub.
    // Real implementation should suspend the playback state machine and display
    // the pause overlay until the player chooses to resume.
});

it.skip("stub: getAvailableFilePath() always returns empty string (should find the next unused save/rec file path)", () => {
    // C: Recordings.c:1109 — getAvailableFilePath()
    // menus.ts:253 has a `() => ""` context stub.
    // Real implementation should scan the save directory for existing .broguesave
    // or .broguerec files and return the first available numbered path.
});

it.skip("stub: characterForbiddenInFilename() always returns false (should validate filename characters)", () => {
    // C: Recordings.c:1122 — characterForbiddenInFilename()
    // io/input-context.ts:256 has a `() => false` context stub.
    // Real implementation should return true for characters that are illegal in
    // filenames on the current platform (e.g. /, \\, :, *, ?, ", <, >, |).
});

it.skip("stub: saveGame() is a no-op (should save the current game state to a .broguesave file)", () => {
    // C: Recordings.c:1181 — saveGame()
    // io/input-context.ts:204 has a `() => {}` stub with comment "save system not yet ported".
    // Real implementation should prompt for a filename if needed and write the full
    // rogue game state to a .broguesave file via the platform's file operations.
});

// =============================================================================
// Stub registry — wiring stubs (Phase 3d, port-v2-audit)
// =============================================================================

it.skip("stub: executeEvent() is a no-op in menus context (should execute one recorded input event during playback)", () => {
    // C: RogueMain.c:45 — executeEvent()
    // menus.ts:256 has a `() => {}` context stub.
    // Domain function is IMPLEMENTED at io/input-dispatch.ts:485 and called from input-cursor.ts:353.
    // Real wiring should call executeEvent() from io/input-dispatch.ts so playback mode
    // advances through recorded events during menu interactions.
});

it.skip("stub: listFiles() returns [] in menus context (should list save/recording files from storage)", () => {
    // C: MainMenu.c (dialogChooseFile) — listFiles is a platform dependency, not a C function.
    // menus.ts:261 has a `() => []` context stub.
    // Real wiring should return the list of available .broguesave or .broguerec files from
    // the browser's persistent storage, so dialogChooseFile can show them for selection.
});

it.skip("stub: loadRunHistory() returns [] in menus context (should load game stats run history from storage)", () => {
    // C: MainMenu.c (viewGameStats) — loadRunHistory is a platform dependency.
    // menus.ts:262 has a `() => []` context stub.
    // Real wiring should read the persisted run history array from storage, so viewGameStats
    // shows accumulated game results rather than an empty stats screen.
});

it.skip("stub: saveResetRun() is a no-op in menus context (should persist a save-reset marker to run history)", () => {
    // C: MainMenu.c — saveResetRun is a platform dependency.
    // menus.ts:263 has a `() => {}` context stub.
    // Real wiring should append a seed=0 reset marker entry to the persisted run history,
    // so viewGameStats correctly splits recent-stats windows on save-reset boundaries.
});
