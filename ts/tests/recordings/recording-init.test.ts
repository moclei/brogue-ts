/*
 *  recording-init.test.ts — Tests for recording initialization and version checking
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    getPatchVersion,
    initRecording,
    type InitRecordingContext,
    type InitRecordingRogue,
} from "../../src/recordings/recording-init.js";
import {
    createRecordingBuffer,
    numberToBytes,
    RECORDING_HEADER_LENGTH,
    type RecordingBuffer,
    type RecordingFileIO,
} from "../../src/recordings/recording-state.js";
import type { GameConstants } from "../../src/types/types.js";
import { ExitStatus } from "../../src/types/enums.js";
import {
    DEFAULT_PLAYBACK_DELAY,
    BROGUE_PATCH,
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

function makeRogue(overrides: Partial<InitRecordingRogue> = {}): InitRecordingRogue {
    return {
        playbackMode: false,
        playbackFastForward: false,
        playbackPaused: false,
        playbackOOS: false,
        playbackOmniscience: false,
        playbackDelayPerTurn: 0,
        playbackDelayThisTurn: 0,
        recording: false,
        gameHasEnded: false,
        gameExitStatusCode: 0,
        seed: 0n,
        howManyTurns: 0,
        currentTurnNumber: 0,
        patchVersion: 0,
        nextAnnotationTurn: 0,
        nextAnnotation: "",
        locationInAnnotationFile: 0,
        versionString: "",
        mode: 0,
        playerTurnNumber: 0,
        deepestLevel: 1,
        ...overrides,
    };
}

function makeGameConst(overrides: Partial<GameConstants> = {}): GameConstants {
    return {
        majorVersion: 1,
        minorVersion: 15,
        patchVersion: 1,
        variantName: "Brogue CE",
        versionString: "CE 1.15.1",
        dungeonVersionString: "CE 1.15",
        patchVersionPattern: "CE 1.15.%hu",
        recordingVersionString: "CE 1.15.1",
        deepestLevel: 40,
        amuletLevel: 26,
        depthAccelerator: 0,
        minimumAltarLevel: 5,
        minimumLavaLevel: 5,
        minimumBrimstoneLevel: 15,
        mutationsOccurAboveLevel: 3,
        monsterOutOfDepthChance: 0,
        extraItemsPerLevel: 0,
        goldAdjustmentStartDepth: 0,
        machinesPerLevelSuppressionMultiplier: 0,
        machinesPerLevelSuppressionOffset: 0,
        machinesPerLevelIncreaseFactor: 0,
        maxLevelForBonusMachines: 0,
        deepestLevelForMachines: 0,
        playerTransferenceRatio: 0,
        onHitHallucinateDuration: 0,
        onHitWeakenDuration: 0,
        onHitMercyHealPercent: 0,
        fallDamageMin: 0,
        fallDamageMax: 0,
        weaponKillsToAutoID: 0,
        armorDelayToAutoID: 0,
        ringDelayToAutoID: 0,
        numberAutogenerators: 0,
        numberBoltKinds: 0,
        numberBlueprints: 0,
        numberHordes: 0,
        numberMeteredItems: 0,
        numberCharmKinds: 0,
        numberPotionKinds: 0,
        numberGoodPotionKinds: 0,
        numberScrollKinds: 0,
        numberGoodScrollKinds: 0,
        numberWandKinds: 0,
        numberGoodWandKinds: 0,
        numberFeats: 0,
        companionFeatRequiredXP: 0,
        mainMenuTitleHeight: 0,
        mainMenuTitleWidth: 0,
        ...overrides,
    } as GameConstants;
}

/**
 * Create a fake recording file buffer with a valid header for playback tests.
 */
function makePlaybackFileBytes(opts: {
    versionString?: string;
    mode?: number;
    seed?: bigint;
    turnCount?: number;
    depthChanges?: number;
    fileLength?: number;
} = {}): Uint8Array {
    const buf = new Uint8Array(INPUT_RECORD_BUFFER);

    const version = opts.versionString ?? "CE 1.15.1";
    for (let i = 0; i < 15 && i < version.length; i++) {
        buf[i] = version.charCodeAt(i);
    }

    buf[15] = opts.mode ?? 0;

    numberToBytes(opts.seed ?? 42n, 8, buf, 16);
    numberToBytes(opts.turnCount ?? 100, 4, buf, 24);
    numberToBytes(opts.depthChanges ?? 5, 4, buf, 28);
    numberToBytes(opts.fileLength ?? 5000, 4, buf, 32);

    return buf;
}

function makeInitCtx(overrides: Partial<InitRecordingContext> = {}): InitRecordingContext {
    return {
        buffer: createRecordingBuffer(),
        rogue: makeRogue(),
        currentFilePath: "/test/recording.broguerec",
        fileIO: makeFileIO(),
        gameConst: makeGameConst(),
        seedRandomGenerator: vi.fn(),
        previousGameSeed: 0n,
        nonInteractivePlayback: false,
        dialogAlert: vi.fn(),
        annotationPathname: "/test/annotation.txt",
        ...overrides,
    };
}

// =============================================================================
// getPatchVersion
// =============================================================================

describe("getPatchVersion", () => {
    it("extracts patch version from matching pattern", () => {
        expect(getPatchVersion("CE 1.15.1", "CE 1.15.%hu")).toBe(1);
    });

    it("extracts higher patch version", () => {
        expect(getPatchVersion("CE 1.15.42", "CE 1.15.%hu")).toBe(42);
    });

    it("returns null for non-matching major/minor", () => {
        expect(getPatchVersion("CE 1.14.1", "CE 1.15.%hu")).toBeNull();
    });

    it("returns null for completely different version string", () => {
        expect(getPatchVersion("Brogue v2.0", "CE 1.15.%hu")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(getPatchVersion("", "CE 1.15.%hu")).toBeNull();
    });

    it("handles %d format specifier", () => {
        expect(getPatchVersion("v1.2.3", "v1.2.%d")).toBe(3);
    });

    it("returns null when pattern has no format specifier", () => {
        expect(getPatchVersion("CE 1.15.1", "CE 1.15.1")).toBeNull();
    });
});

// =============================================================================
// initRecording — recording mode
// =============================================================================

describe("initRecording — recording mode", () => {
    it("does nothing with empty file path", () => {
        const ctx = makeInitCtx({ currentFilePath: "" });
        initRecording(ctx);
        expect(ctx.rogue.recording).toBe(false);
    });

    it("initializes buffer state", () => {
        const ctx = makeInitCtx();
        ctx.buffer.bufferPosition = 99;
        ctx.buffer.streamPosition = 99;
        ctx.buffer.fileReadPosition = 99;

        initRecording(ctx);

        expect(ctx.buffer.bufferPosition).toBe(0);
        expect(ctx.buffer.streamPosition).toBe(0);
        expect(ctx.buffer.fileReadPosition).toBe(0);
        expect(ctx.buffer.maxLevelChanges).toBe(0);
    });

    it("sets recording = true", () => {
        const ctx = makeInitCtx();
        initRecording(ctx);
        expect(ctx.rogue.recording).toBe(true);
    });

    it("sets version string from game constants", () => {
        const ctx = makeInitCtx();
        initRecording(ctx);
        expect(ctx.rogue.versionString).toBe("CE 1.15.1");
    });

    it("sets patchVersion to BROGUE_PATCH", () => {
        const ctx = makeInitCtx();
        initRecording(ctx);
        expect(ctx.rogue.patchVersion).toBe(BROGUE_PATCH);
    });

    it("removes existing file and creates new one", () => {
        const ctx = makeInitCtx();
        initRecording(ctx);
        expect(ctx.fileIO.removeFile).toHaveBeenCalledWith(ctx.currentFilePath);
        expect(ctx.fileIO.writeHeader).toHaveBeenCalled();
    });

    it("sets currentTurnNumber to 0", () => {
        const ctx = makeInitCtx();
        ctx.rogue.currentTurnNumber = 99;
        initRecording(ctx);
        expect(ctx.rogue.currentTurnNumber).toBe(0);
    });

    it("resets playback OOS state", () => {
        const ctx = makeInitCtx();
        ctx.rogue.playbackOOS = true;
        ctx.rogue.playbackOmniscience = true;
        initRecording(ctx);
        expect(ctx.rogue.playbackOOS).toBe(false);
        expect(ctx.rogue.playbackOmniscience).toBe(false);
    });
});

// =============================================================================
// initRecording — playback mode
// =============================================================================

describe("initRecording — playback mode", () => {
    it("reads header and seeds RNG", () => {
        const fileBytes = makePlaybackFileBytes({ seed: 12345n, turnCount: 50 });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
        });

        initRecording(ctx);

        expect(ctx.seedRandomGenerator).toHaveBeenCalledWith(12345n);
        expect(ctx.rogue.seed).toBe(12345n);
        expect(ctx.rogue.howManyTurns).toBe(50);
        expect(ctx.previousGameSeed).toBe(12345n);
    });

    it("sets playback delay to default", () => {
        const fileBytes = makePlaybackFileBytes();
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
        });

        initRecording(ctx);

        expect(ctx.rogue.playbackDelayPerTurn).toBe(DEFAULT_PLAYBACK_DELAY);
        expect(ctx.rogue.playbackDelayThisTurn).toBe(DEFAULT_PLAYBACK_DELAY);
    });

    it("reads version string from header", () => {
        const fileBytes = makePlaybackFileBytes({ versionString: "CE 1.15.1" });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
        });

        initRecording(ctx);

        expect(ctx.rogue.versionString).toBe("CE 1.15.1");
    });

    it("reads maxLevelChanges from header", () => {
        const fileBytes = makePlaybackFileBytes({ depthChanges: 12 });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
        });

        initRecording(ctx);

        expect(ctx.buffer.maxLevelChanges).toBe(12);
    });

    it("reads playbackFileLength from header", () => {
        const fileBytes = makePlaybackFileBytes({ fileLength: 9999 });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
        });

        initRecording(ctx);

        expect(ctx.buffer.playbackFileLength).toBe(9999);
    });

    it("accepts compatible older patch version", () => {
        const fileBytes = makePlaybackFileBytes({ versionString: "CE 1.15.0" });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
            gameConst: makeGameConst({ patchVersion: 1 }),
        });

        initRecording(ctx);

        expect(ctx.rogue.patchVersion).toBe(0);
        expect(ctx.rogue.gameHasEnded).toBe(false);
    });

    it("rejects incompatible version in non-interactive mode", () => {
        const fileBytes = makePlaybackFileBytes({ versionString: "CE 1.14.0" });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
            nonInteractivePlayback: true,
        });

        initRecording(ctx);

        expect(ctx.rogue.gameHasEnded).toBe(true);
        expect(ctx.rogue.gameExitStatusCode).toBe(ExitStatus.FailureRecordingWrongVersion);
    });

    it("rejects incompatible version in interactive mode and shows dialog", () => {
        const fileBytes = makePlaybackFileBytes({ versionString: "CE 1.14.0" });
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const dialogAlert = vi.fn();
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
            nonInteractivePlayback: false,
            dialogAlert,
        });

        initRecording(ctx);

        expect(dialogAlert).toHaveBeenCalledWith(
            expect.stringContaining("CE 1.14.0")
        );
        expect(ctx.rogue.gameHasEnded).toBe(true);
    });

    it("sets nextAnnotationTurn to -1 when no annotation file", () => {
        const fileBytes = makePlaybackFileBytes();
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
            fileExists: vi.fn().mockReturnValue(false),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true }),
        });

        initRecording(ctx);

        expect(ctx.rogue.nextAnnotationTurn).toBe(-1);
    });

    it("sets currentTurnNumber to 0", () => {
        const fileBytes = makePlaybackFileBytes();
        const fileIO = makeFileIO({
            readBytes: vi.fn().mockReturnValue({ bytes: fileBytes, newOffset: INPUT_RECORD_BUFFER }),
        });
        const ctx = makeInitCtx({
            fileIO,
            rogue: makeRogue({ playbackMode: true, currentTurnNumber: 99 }),
        });

        initRecording(ctx);

        expect(ctx.rogue.currentTurnNumber).toBe(0);
    });
});
