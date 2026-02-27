/*
 *  recording-save-load.test.ts — Tests for save/load and file path utilities
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    characterForbiddenInFilename,
    getAvailableFilePath,
    getDefaultFilePath,
    formatSeedString,
    saveGameNoPrompt,
    saveRecordingNoPrompt,
    switchToPlaying,
    type DefaultFilePathContext,
    type SaveContext,
    type SwitchToPlayingContext,
} from "../../src/recordings/recording-save-load.js";
import {
    createRecordingBuffer,
    type RecordingFileIO,
} from "../../src/recordings/recording-state.js";
import type { GameConstants } from "../../src/types/types.js";
import { GameMode, ExitStatus, EventType } from "../../src/types/enums.js";
import { MonsterBookkeepingFlag } from "../../src/types/flags.js";
import {
    GAME_SUFFIX,
    RECORDING_SUFFIX,
    LAST_GAME_NAME,
    INPUT_RECORD_BUFFER,
} from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function makeFileIO(overrides: Partial<RecordingFileIO> = {}): RecordingFileIO {
    return {
        fileExists: vi.fn().mockReturnValue(false),
        appendBytes: vi.fn(),
        readBytes: vi.fn().mockReturnValue({ bytes: new Uint8Array(INPUT_RECORD_BUFFER), newOffset: 0 }),
        writeHeader: vi.fn(),
        removeFile: vi.fn(),
        renameFile: vi.fn(),
        copyFile: vi.fn(),
        ...overrides,
    };
}

function makeGameConst(overrides: Partial<GameConstants> = {}): GameConstants {
    return {
        majorVersion: 1, minorVersion: 15, patchVersion: 1,
        variantName: "Brogue CE", versionString: "CE 1.15.1",
        dungeonVersionString: "CE 1.15",
        patchVersionPattern: "CE 1.15.%hu",
        recordingVersionString: "CE 1.15.1",
        deepestLevel: 40, amuletLevel: 26, depthAccelerator: 0,
        minimumAltarLevel: 5, minimumLavaLevel: 5, minimumBrimstoneLevel: 15,
        mutationsOccurAboveLevel: 3, monsterOutOfDepthChance: 0, extraItemsPerLevel: 0,
        goldAdjustmentStartDepth: 0,
        machinesPerLevelSuppressionMultiplier: 0, machinesPerLevelSuppressionOffset: 0,
        machinesPerLevelIncreaseFactor: 0, maxLevelForBonusMachines: 0, deepestLevelForMachines: 0,
        playerTransferenceRatio: 0, onHitHallucinateDuration: 0, onHitWeakenDuration: 0,
        onHitMercyHealPercent: 0, fallDamageMin: 0, fallDamageMax: 0,
        weaponKillsToAutoID: 0, armorDelayToAutoID: 0, ringDelayToAutoID: 0,
        numberAutogenerators: 0, numberBoltKinds: 0, numberBlueprints: 0,
        numberHordes: 0, numberMeteredItems: 0, numberCharmKinds: 0,
        numberPotionKinds: 0, numberGoodPotionKinds: 0,
        numberScrollKinds: 0, numberGoodScrollKinds: 0,
        numberWandKinds: 0, numberGoodWandKinds: 0,
        numberFeats: 0, companionFeatRequiredXP: 0,
        mainMenuTitleHeight: 0, mainMenuTitleWidth: 0,
        ...overrides,
    } as GameConstants;
}

function makeSaveCtx(overrides: Partial<SaveContext> = {}): SaveContext {
    return {
        buffer: createRecordingBuffer(),
        rogue: {
            versionString: "CE 1.15.1",
            mode: GameMode.Normal,
            seed: 42n,
            playerTurnNumber: 100,
            deepestLevel: 5,
            playbackMode: false,
            recording: true,
            gameHasEnded: false,
            gameExitStatusCode: 0,
            quit: false,
            depthLevel: 5,
        },
        player: { bookkeepingFlags: 0 },
        gameConst: makeGameConst(),
        serverMode: false,
        currentFilePath: "/tmp/LastGame.broguesave",
        fileIO: makeFileIO(),
        ...overrides,
    };
}

// =============================================================================
// characterForbiddenInFilename
// =============================================================================

describe("characterForbiddenInFilename", () => {
    it("rejects forward slash", () => {
        expect(characterForbiddenInFilename("/")).toBe(true);
    });

    it("rejects backslash", () => {
        expect(characterForbiddenInFilename("\\")).toBe(true);
    });

    it("rejects colon", () => {
        expect(characterForbiddenInFilename(":")).toBe(true);
    });

    it("allows normal characters", () => {
        expect(characterForbiddenInFilename("a")).toBe(false);
        expect(characterForbiddenInFilename("1")).toBe(false);
        expect(characterForbiddenInFilename(" ")).toBe(false);
        expect(characterForbiddenInFilename(".")).toBe(false);
        expect(characterForbiddenInFilename("#")).toBe(false);
    });
});

// =============================================================================
// getAvailableFilePath
// =============================================================================

describe("getAvailableFilePath", () => {
    it("returns defaultPath when no file exists", () => {
        const result = getAvailableFilePath("MyGame", ".broguesave", () => false);
        expect(result).toBe("MyGame");
    });

    it("appends (2) when default already exists", () => {
        const existing = new Set(["MyGame.broguesave"]);
        const result = getAvailableFilePath("MyGame", ".broguesave", (p) => existing.has(p));
        expect(result).toBe("MyGame (2)");
    });

    it("increments until a free name is found", () => {
        const existing = new Set([
            "MyGame.broguesave",
            "MyGame (2).broguesave",
            "MyGame (3).broguesave",
        ]);
        const result = getAvailableFilePath("MyGame", ".broguesave", (p) => existing.has(p));
        expect(result).toBe("MyGame (4)");
    });
});

// =============================================================================
// formatSeedString
// =============================================================================

describe("formatSeedString", () => {
    it("returns full string for small seeds", () => {
        expect(formatSeedString(12345n)).toBe("12345");
    });

    it("returns full string for 11-digit seeds", () => {
        expect(formatSeedString(12345678901n)).toBe("12345678901");
    });

    it("shortens 12+ digit seeds", () => {
        const result = formatSeedString(184467440737095n);
        expect(result).toMatch(/^184\.\.\..*$/);
        expect(result.length).toBeLessThanOrEqual(12);
    });

    it("preserves last 5 digits", () => {
        const result = formatSeedString(184467440737095n);
        // 184467440737095 % 100000 = 37095
        expect(result).toBe("184...37095");
    });

    it("handles zero", () => {
        expect(formatSeedString(0n)).toBe("0");
    });
});

// =============================================================================
// getDefaultFilePath
// =============================================================================

describe("getDefaultFilePath", () => {
    const baseCtx: DefaultFilePathContext = {
        rogue: { seed: 42n, depthLevel: 7, quit: false, mode: GameMode.Normal },
        player: { bookkeepingFlags: 0 },
        gameConst: makeGameConst(),
        serverMode: false,
    };

    it("generates save path (not game over)", () => {
        const path = getDefaultFilePath(false, baseCtx);
        expect(path).toBe("Saved CE 1.15.1 #42 at depth 7");
    });

    it("generates quit path", () => {
        const ctx = { ...baseCtx, rogue: { ...baseCtx.rogue, quit: true } };
        const path = getDefaultFilePath(true, ctx);
        expect(path).toBe("CE 1.15.1 #42 Quit at depth 7");
    });

    it("generates death path", () => {
        const ctx = {
            ...baseCtx,
            player: { bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DYING },
        };
        const path = getDefaultFilePath(true, ctx);
        expect(path).toBe("CE 1.15.1 #42 Died at depth 7");
    });

    it("generates mastery path for deep runs", () => {
        const ctx = { ...baseCtx, rogue: { ...baseCtx.rogue, depthLevel: 27 } };
        const path = getDefaultFilePath(true, ctx);
        expect(path).toBe("CE 1.15.1 #42 Mastered the dungeons");
    });

    it("generates escape path for normal wins", () => {
        const ctx = { ...baseCtx, rogue: { ...baseCtx.rogue, depthLevel: 1 } };
        const path = getDefaultFilePath(true, ctx);
        expect(path).toBe("CE 1.15.1 #42 Escaped the dungeons");
    });

    it("appends (wizard) label for wizard mode", () => {
        const ctx = { ...baseCtx, rogue: { ...baseCtx.rogue, mode: GameMode.Wizard } };
        const path = getDefaultFilePath(true, ctx);
        expect(path).toContain("(wizard)");
    });

    it("appends (easy) label for easy mode", () => {
        const ctx = { ...baseCtx, rogue: { ...baseCtx.rogue, mode: GameMode.Easy } };
        const path = getDefaultFilePath(true, ctx);
        expect(path).toContain("(easy)");
    });

    it("generates short path in server mode", () => {
        const ctx = { ...baseCtx, serverMode: true };
        const path = getDefaultFilePath(false, ctx);
        expect(path).toBe("#42");
    });

    it("generates short path in server mode with large seed", () => {
        const ctx = {
            ...baseCtx,
            serverMode: true,
            rogue: { ...baseCtx.rogue, seed: 184467440737095n },
        };
        const path = getDefaultFilePath(false, ctx);
        expect(path).toBe("#184...37095");
    });
});

// =============================================================================
// saveGameNoPrompt
// =============================================================================

describe("saveGameNoPrompt", () => {
    it("does nothing in playback mode", () => {
        const ctx = makeSaveCtx();
        ctx.rogue.playbackMode = true;
        saveGameNoPrompt(ctx);
        expect(ctx.fileIO.renameFile).not.toHaveBeenCalled();
    });

    it("flushes buffer and renames file", () => {
        const ctx = makeSaveCtx();
        saveGameNoPrompt(ctx);

        expect(ctx.fileIO.renameFile).toHaveBeenCalled();
        const [from, to] = (ctx.fileIO.renameFile as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(from).toBe("/tmp/LastGame.broguesave");
        expect(to).toContain(GAME_SUFFIX);
    });

    it("sets gameHasEnded and recording=false", () => {
        const ctx = makeSaveCtx();
        saveGameNoPrompt(ctx);
        expect(ctx.rogue.gameHasEnded).toBe(true);
        expect(ctx.rogue.gameExitStatusCode).toBe(ExitStatus.Success);
        expect(ctx.rogue.recording).toBe(false);
    });

    it("updates currentFilePath", () => {
        const ctx = makeSaveCtx();
        saveGameNoPrompt(ctx);
        expect(ctx.currentFilePath).toContain(GAME_SUFFIX);
    });
});

// =============================================================================
// saveRecordingNoPrompt
// =============================================================================

describe("saveRecordingNoPrompt", () => {
    it("does nothing in playback mode", () => {
        const ctx = makeSaveCtx();
        ctx.rogue.playbackMode = true;
        const result = saveRecordingNoPrompt(ctx);
        expect(result).toBe("");
    });

    it("renames the current file with recording suffix", () => {
        const ctx = makeSaveCtx();
        const path = saveRecordingNoPrompt(ctx);

        expect(path).toContain(RECORDING_SUFFIX);
        expect(ctx.fileIO.renameFile).toHaveBeenCalled();
        expect(ctx.rogue.recording).toBe(false);
    });
});

// =============================================================================
// switchToPlaying
// =============================================================================

describe("switchToPlaying", () => {
    it("transitions from playback to recording mode", () => {
        const ctx: SwitchToPlayingContext = {
            buffer: createRecordingBuffer(),
            rogue: {
                versionString: "CE 1.15.1",
                mode: 0,
                seed: 42n,
                playerTurnNumber: 0,
                deepestLevel: 1,
                playbackMode: true,
                playbackFastForward: true,
                playbackOmniscience: true,
                recording: false,
            },
            currentFilePath: "/tmp/recording.broguerec",
            fileIO: makeFileIO(),
        };
        ctx.buffer.streamPosition = 500;

        switchToPlaying(ctx);

        expect(ctx.rogue.playbackMode).toBe(false);
        expect(ctx.rogue.playbackFastForward).toBe(false);
        expect(ctx.rogue.playbackOmniscience).toBe(false);
        expect(ctx.rogue.recording).toBe(true);
        expect(ctx.buffer.bufferPosition).toBe(1); // after recording SavedGameLoaded
    });

    it("copies recording file to LastGame path", () => {
        const ctx: SwitchToPlayingContext = {
            buffer: createRecordingBuffer(),
            rogue: {
                versionString: "CE 1.15.1",
                mode: 0,
                seed: 42n,
                playerTurnNumber: 0,
                deepestLevel: 1,
                playbackMode: true,
                playbackFastForward: false,
                playbackOmniscience: false,
                recording: false,
            },
            currentFilePath: "/tmp/recording.broguerec",
            fileIO: makeFileIO(),
        };
        ctx.buffer.streamPosition = 1000;

        switchToPlaying(ctx);

        expect(ctx.fileIO.copyFile).toHaveBeenCalledWith(
            "/tmp/recording.broguerec",
            expect.stringContaining(LAST_GAME_NAME),
            1000,
        );
    });

    it("records SavedGameLoaded event", () => {
        const ctx: SwitchToPlayingContext = {
            buffer: createRecordingBuffer(),
            rogue: {
                versionString: "CE 1.15.1",
                mode: 0,
                seed: 42n,
                playerTurnNumber: 0,
                deepestLevel: 1,
                playbackMode: true,
                playbackFastForward: false,
                playbackOmniscience: false,
                recording: false,
            },
            currentFilePath: "/tmp/recording.broguerec",
            fileIO: makeFileIO(),
        };

        switchToPlaying(ctx);

        // First byte in buffer should be SAVED_GAME_LOADED
        expect(ctx.buffer.data[0]).toBe(EventType.SavedGameLoaded);
    });

    it("updates currentFilePath to LastGame path", () => {
        const ctx: SwitchToPlayingContext = {
            buffer: createRecordingBuffer(),
            rogue: {
                versionString: "CE 1.15.1",
                mode: 0,
                seed: 42n,
                playerTurnNumber: 0,
                deepestLevel: 1,
                playbackMode: true,
                playbackFastForward: false,
                playbackOmniscience: false,
                recording: false,
            },
            currentFilePath: "/tmp/recording.broguerec",
            fileIO: makeFileIO(),
        };

        switchToPlaying(ctx);

        expect(ctx.currentFilePath).toContain(LAST_GAME_NAME);
        expect(ctx.currentFilePath).toContain(GAME_SUFFIX);
    });
});
