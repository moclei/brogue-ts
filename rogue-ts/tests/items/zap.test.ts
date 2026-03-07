/*
 *  zap.test.ts — Integration tests for zap (bolt travel loop)
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import { zap } from "../../src/items/zap.js";
import type { ZapContext, ZapRenderContext } from "../../src/items/zap-context.js";
import type { Bolt, Creature, Pcell } from "../../src/types/types.js";
import {
    BoltEffect,
    CreatureState,
    TileType,
    DungeonLayer,
    StatusEffect,
} from "../../src/types/enums.js";
import {
    TileFlag,
    TerrainFlag,
    BoltFlag,
    MonsterBookkeepingFlag,
} from "../../src/types/flags.js";
import { NUMBER_TERRAIN_LAYERS, DCOLS, DROWS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCell(terrainFlag = 0, tileFlags = 0): Pcell {
    const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING) as TileType[];
    layers[DungeonLayer.Dungeon] = TileType.FLOOR;
    return {
        layers,
        flags: tileFlags,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: TileType.NOTHING,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: terrainFlag,
        rememberedTMFlags: 0,
        exposedToFire: 0,
    };
}

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = makeCell(0, 0);
        }
    }
    return pmap;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 1, y: 1 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 0,
            monsterName: "test",
            displayChar: 64,
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 10,
            turnsBetweenRegen: 30,
            movementSpeed: 100,
            attackSpeed: 100,
            damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            accuracy: 100,
            defense: 0,
            DFChance: 0,
            DFType: 0,
            bloodType: 0,
            lightType: 0,
            intrinsicLightType: 0,
            flags: 0,
            abilityFlags: 0,
            bolts: [],
            isLarge: false,
        },
        currentHP: 10,
        turnsSpentStationary: 0,
        creatureState: CreatureState.Wandering,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        movementSpeed: 100,
        attackSpeed: 100,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        mutationIndex: -1,
        wasNegated: false,
        ...overrides,
    } as Creature;
}

function makeNoOpRender(): ZapRenderContext {
    return {
        refreshSideBar: vi.fn(),
        displayCombatText: vi.fn(),
        refreshDungeonCell: vi.fn(),
        backUpLighting: vi.fn(),
        restoreLighting: vi.fn(),
        demoteVisibility: vi.fn(),
        updateFieldOfViewDisplay: vi.fn(),
        paintLight: vi.fn(),
        updateVision: vi.fn(),
        updateLighting: vi.fn(),
        hiliteCell: vi.fn(),
        pauseAnimation: vi.fn().mockResolvedValue(false),
        getCellAppearance: vi.fn().mockReturnValue({ char: 0, foreColor: {}, backColor: {} }),
        plotCharWithColor: vi.fn(),
        colorMultiplierFromDungeonLight: vi.fn().mockReturnValue({}),
    };
}

function makeCtx(overrides: Partial<ZapContext> = {}): ZapContext {
    const player = makeCreature({ loc: { x: 1, y: 1 } });
    return {
        render: makeNoOpRender(),
        pmap: makePmap(),
        player,
        rogue: {
            armor: null,
            strength: 12,
            weaknessAmount: 0,
            scentTurnNumber: 100,
            playbackFastForward: false,
            playbackOmniscience: false,
        },
        boltCatalog: [],
        monsterClassCatalog: [],
        monsterAtLoc: vi.fn().mockReturnValue(null),
        canSeeMonster: vi.fn().mockReturnValue(false),
        playerCanSee: vi.fn().mockReturnValue(false),
        playerCanSeeOrSense: vi.fn().mockReturnValue(false),
        cellHasTerrainFlag: vi.fn().mockReturnValue(false),
        cellHasTMFlag: vi.fn().mockReturnValue(false),
        monsterName: vi.fn().mockReturnValue("the monster"),
        message: vi.fn(),
        combatMessage: vi.fn(),
        messageColorFromVictim: vi.fn().mockReturnValue(null),
        tileText: vi.fn().mockReturnValue("wall"),
        attack: vi.fn(),
        inflictDamage: vi.fn().mockReturnValue(false),
        killCreature: vi.fn(),
        moralAttack: vi.fn(),
        splitMonster: vi.fn(),
        handlePaladinFeat: vi.fn(),
        gameOver: vi.fn(),
        haste: vi.fn(),
        slow: vi.fn(),
        imbueInvisibility: vi.fn().mockReturnValue(false),
        wandDominate: vi.fn().mockReturnValue(50),
        becomeAllyWith: vi.fn(),
        negate: vi.fn().mockReturnValue(false),
        empowerMonster: vi.fn(),
        addPoison: vi.fn(),
        heal: vi.fn(),
        cloneMonster: vi.fn().mockReturnValue(null),
        flashMonster: vi.fn(),
        wakeUp: vi.fn(),
        exposeCreatureToFire: vi.fn(),
        exposeTileToFire: vi.fn().mockReturnValue(false),
        exposeTileToElectricity: vi.fn().mockReturnValue(false),
        createFlare: vi.fn(),
        tunnelize: vi.fn().mockReturnValue(false),
        freeCaptivesEmbeddedAt: vi.fn(),
        spawnDungeonFeature: vi.fn(),
        teleport: vi.fn(),
        disentangle: vi.fn(),
        applyInstantTileEffectsToCreature: vi.fn(),
        pickUpItemAt: vi.fn(),
        checkForMissingKeys: vi.fn(),
        findAlternativeHomeFor: vi.fn().mockReturnValue(null),
        autoIdentify: vi.fn(),
        beckonMonster: vi.fn(),
        polymorph: vi.fn().mockReturnValue(false),
        setUpWaypoints: vi.fn(),
        generateMonster: vi.fn().mockReturnValue(makeCreature({ loc: { x: 3, y: 3 } })),
        getQualifyingPathLocNear: vi.fn().mockReturnValue({ x: 3, y: 3 }),
        fadeInMonster: vi.fn(),
        randPercent: vi.fn().mockReturnValue(false),
        randRange: vi.fn().mockReturnValue(5),
        ...overrides,
    };
}

function makeBolt(effect: BoltEffect, overrides: Partial<Bolt> = {}): Bolt {
    return {
        name: "test bolt",
        description: "",
        abilityDescription: "",
        theChar: 0,
        foreColor: null,
        backColor: null,
        boltEffect: effect,
        magnitude: 2,
        pathDF: 0,
        targetDF: 0,
        forbiddenMonsterFlags: 0,
        flags: 0,
        ...overrides,
    };
}

// =============================================================================
// zap — basic guard
// =============================================================================

describe("zap > guard: origin equals target", () => {
    it("returns false immediately without traversing any cells", async () => {
        const ctx = makeCtx();
        const bolt = makeBolt(BoltEffect.Damage);
        const result = await zap({ x: 5, y: 5 }, { x: 5, y: 5 }, bolt, false, false, ctx);
        expect(result).toBe(false);
        expect(ctx.monsterAtLoc).not.toHaveBeenCalled();
    });
});

// =============================================================================
// zap — bolt travels and calls detonateBolt at terminal cell
// =============================================================================

describe("zap > bolt reaches terminal cell", () => {
    it("calls detonateBolt (spawnDungeonFeature) when BE_OBSTRUCTION bolt stops", async () => {
        const ctx = makeCtx();
        // All cells open. Bolt travels, then detonates.
        const bolt = makeBolt(BoltEffect.Obstruction);
        const result = await zap({ x: 1, y: 5 }, { x: 10, y: 5 }, bolt, false, false, ctx);
        // spawnDungeonFeature called for DF_FORCEFIELD by detonateBolt
        expect(ctx.spawnDungeonFeature).toHaveBeenCalled();
        // autoID set by obstruction detonation
        expect(result).toBe(true);
    });

    it("calls setUpWaypoints when BE_TUNNELING bolt stops", async () => {
        const ctx = makeCtx();
        const bolt = makeBolt(BoltEffect.Tunneling);
        await zap({ x: 1, y: 5 }, { x: 10, y: 5 }, bolt, false, false, ctx);
        expect(ctx.setUpWaypoints).toHaveBeenCalled();
    });
});

// =============================================================================
// zap — blinking: returns false when first path cell is obstructed
// =============================================================================

describe("zap > BE_BLINKING early exit", () => {
    it("returns false when blink destination is obstructed terrain", async () => {
        const ctx = makeCtx();
        // First path cell blocks passability + vision.
        (ctx.cellHasTerrainFlag as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const bolt = makeBolt(BoltEffect.Blinking);
        const result = await zap({ x: 5, y: 5 }, { x: 6, y: 5 }, bolt, false, false, ctx);
        expect(result).toBe(false);
    });
});

// =============================================================================
// zap — bolt stops at wall
// =============================================================================

describe("zap > bolt stops at blocking terrain", () => {
    it("terminates when traversal reaches a wall cell", async () => {
        const ctx = makeCtx();
        let callCount = 0;
        // First N cells open, then block.
        (ctx.cellHasTerrainFlag as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            return callCount > 3;
        });
        const bolt = makeBolt(BoltEffect.Damage);
        // Even though target is distant, bolt should stop early at the wall.
        await zap({ x: 1, y: 5 }, { x: 20, y: 5 }, bolt, false, false, ctx);
        // detonateBolt is always called (harmless for Damage effect with no targetDF)
        expect(ctx.spawnDungeonFeature).not.toHaveBeenCalled();
    });
});

// =============================================================================
// zap — bolt passes through creatures
// =============================================================================

describe("zap > BF_PASSES_THRU_CREATURES", () => {
    it("continues traversal after hitting a monster when flag is set", async () => {
        const ctx = makeCtx();
        // Monster is at (5, 5). Both the zap loop and updateBolt call monsterAtLoc,
        // so we match by position rather than call order.
        const monster = makeCreature({ loc: { x: 5, y: 5 } });
        monster.bookkeepingFlags = 0;
        (ctx.monsterAtLoc as ReturnType<typeof vi.fn>).mockImplementation(
            (pos: { x: number; y: number }) =>
                pos.x === 5 && pos.y === 5 ? monster : null,
        );

        const bolt = makeBolt(BoltEffect.Damage, { flags: BoltFlag.BF_PASSES_THRU_CREATURES });
        await zap({ x: 1, y: 5 }, { x: 10, y: 5 }, bolt, false, false, ctx);

        // inflictDamage called (monster was hit).
        expect(ctx.inflictDamage).toHaveBeenCalledWith(
            null, monster, expect.any(Number), null, false,
        );
        // monsterAtLoc was called for cells beyond (5,5) — bolt did not stop.
        const calls = (ctx.monsterAtLoc as ReturnType<typeof vi.fn>).mock.calls;
        const lastX = calls[calls.length - 1][0].x;
        expect(lastX).toBeGreaterThan(5);
    });
});

// =============================================================================
// zap — hideDetails uses null bolt (no path tuning)
// =============================================================================

describe("zap > hideDetails", () => {
    it("returns false without crashing when hideDetails = true", async () => {
        const ctx = makeCtx();
        const bolt = makeBolt(BoltEffect.Damage);
        // Should not throw; passes null bolt to getLineCoordinates.
        await expect(
            zap({ x: 1, y: 5 }, { x: 10, y: 5 }, bolt, true, false, ctx),
        ).resolves.not.toThrow();
    });
});
