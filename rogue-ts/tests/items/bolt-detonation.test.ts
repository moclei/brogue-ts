/*
 *  bolt-detonation.test.ts — Unit tests for detonateBolt
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import { detonateBolt } from "../../src/items/bolt-detonation.js";
import type { ZapContext, ZapRenderContext } from "../../src/items/zap-context.js";
import type { Bolt, Creature, Pcell } from "../../src/types/types.js";
import { BoltEffect, DungeonFeatureType, MonsterType, CreatureState, TileType, DungeonLayer, StatusEffect } from "../../src/types/enums.js";
import { TileFlag, MonsterBookkeepingFlag } from "../../src/types/flags.js";
import { NUMBER_TERRAIN_LAYERS, DCOLS, DROWS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCell(flags = 0): Pcell {
    const layers = new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.NOTHING) as TileType[];
    layers[DungeonLayer.Dungeon] = TileType.FLOOR;
    return {
        layers,
        flags,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: TileType.NOTHING,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
    };
}

function makePmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = makeCell(0);
        }
    }
    return pmap;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 0,
            monsterName: "test",
            displayChar: 0,
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

function makeBolt(effect: BoltEffect, overrides: Partial<Bolt> = {}): Bolt {
    return {
        name: "test bolt",
        description: "",
        abilityDescription: "",
        theChar: 0,
        foreColor: null,
        backColor: null,
        boltEffect: effect,
        magnitude: 3,
        pathDF: 0,
        targetDF: 0,
        forbiddenMonsterFlags: 0,
        flags: 0,
        ...overrides,
    };
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

function makeCtx(pmapArg?: Pcell[][]): ZapContext {
    const player = makeCreature({ loc: { x: 1, y: 1 } });
    const pmap = pmapArg ?? makePmap();
    return {
        render: makeNoOpRender(),
        pmap,
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
    };
}

// =============================================================================
// detonateBolt — BE_OBSTRUCTION
// =============================================================================

describe("detonateBolt > BE_OBSTRUCTION", () => {
    it("spawns DF_FORCEFIELD at terminal cell and sets autoID", () => {
        const bolt = makeBolt(BoltEffect.Obstruction);
        const ctx = makeCtx();
        const autoID = { value: false };

        detonateBolt(bolt, null, 10, 10, autoID, ctx);

        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(10, 10, DungeonFeatureType.DF_FORCEFIELD, true, false);
        expect(autoID.value).toBe(true);
    });

    it("also spawns targetDF if set", () => {
        const bolt = makeBolt(BoltEffect.Obstruction, { targetDF: DungeonFeatureType.DF_SACRED_GLYPHS });
        const ctx = makeCtx();
        const autoID = { value: false };

        detonateBolt(bolt, null, 5, 5, autoID, ctx);

        expect(ctx.spawnDungeonFeature).toHaveBeenCalledTimes(2);
        expect(ctx.spawnDungeonFeature).toHaveBeenNthCalledWith(2, 5, 5, DungeonFeatureType.DF_SACRED_GLYPHS, true, false);
    });
});

// =============================================================================
// detonateBolt — BE_TUNNELING
// =============================================================================

describe("detonateBolt > BE_TUNNELING", () => {
    it("calls setUpWaypoints to recompute pathfinding", () => {
        const bolt = makeBolt(BoltEffect.Tunneling);
        const ctx = makeCtx();
        const autoID = { value: false };

        detonateBolt(bolt, null, 5, 5, autoID, ctx);

        expect(ctx.setUpWaypoints).toHaveBeenCalledTimes(1);
        expect(autoID.value).toBe(false);
    });
});

// =============================================================================
// detonateBolt — BE_CONJURATION
// =============================================================================

describe("detonateBolt > BE_CONJURATION", () => {
    it("generates one spectral blade per staffBladeCount and calls fadeInMonster", () => {
        // magnitude=1 → staffBladeCount(1*FP_FACTOR) = 1 blade at low magnitude
        const bolt = makeBolt(BoltEffect.Conjuration, { magnitude: 1 });
        const pmap = makePmap();
        const ctx = makeCtx(pmap);
        const generatedMonst = makeCreature({ loc: { x: 3, y: 3 } });
        (ctx.generateMonster as ReturnType<typeof vi.fn>).mockReturnValue(generatedMonst);
        const autoID = { value: false };

        detonateBolt(bolt, null, 5, 5, autoID, ctx);

        expect(ctx.generateMonster).toHaveBeenCalledWith(MonsterType.MK_SPECTRAL_BLADE, true, false);
        expect(ctx.fadeInMonster).toHaveBeenCalledWith(generatedMonst);
        expect(generatedMonst.leader).toBe(ctx.player);
        expect(generatedMonst.creatureState).toBe(CreatureState.Ally);
        expect(autoID.value).toBe(true);
    });

    it("calls updateVision after spawning blades", () => {
        const bolt = makeBolt(BoltEffect.Conjuration, { magnitude: 1 });
        const ctx = makeCtx();
        const autoID = { value: false };

        detonateBolt(bolt, null, 5, 5, autoID, ctx);

        expect(ctx.render.updateVision).toHaveBeenCalledWith(true);
    });
});

// =============================================================================
// detonateBolt — BE_BLINKING
// =============================================================================

describe("detonateBolt > BE_BLINKING", () => {
    it("moves caster to destination and calls disentangle", () => {
        const pmap = makePmap();
        const ctx = makeCtx(pmap);
        const caster = makeCreature({ loc: { x: 1, y: 1 } });
        const bolt = makeBolt(BoltEffect.Blinking);
        const autoID = { value: false };

        detonateBolt(bolt, caster, 8, 8, autoID, ctx);

        expect(caster.loc).toEqual({ x: 8, y: 8 });
        expect(ctx.disentangle).toHaveBeenCalledWith(caster);
        expect(ctx.applyInstantTileEffectsToCreature).toHaveBeenCalledWith(caster);
        expect(autoID.value).toBe(true);
    });

    it("increments scentTurnNumber by 30 when caster is player", () => {
        const pmap = makePmap();
        const ctx = makeCtx(pmap);
        const caster = ctx.player;
        const initialScent = ctx.rogue.scentTurnNumber;
        const bolt = makeBolt(BoltEffect.Blinking);
        const autoID = { value: false };

        detonateBolt(bolt, caster, 8, 8, autoID, ctx);

        expect(ctx.rogue.scentTurnNumber).toBe(initialScent + 30);
    });

    it("kills occupant when no alternative home is found", () => {
        const pmap = makePmap();
        pmap[8][8].flags = TileFlag.HAS_MONSTER;
        const ctx = makeCtx(pmap);
        const occupant = makeCreature({ loc: { x: 8, y: 8 } });
        (ctx.monsterAtLoc as ReturnType<typeof vi.fn>).mockReturnValue(occupant);
        (ctx.findAlternativeHomeFor as ReturnType<typeof vi.fn>).mockReturnValue(null);
        const caster = makeCreature({ loc: { x: 1, y: 1 } });
        const bolt = makeBolt(BoltEffect.Blinking);
        const autoID = { value: false };

        detonateBolt(bolt, caster, 8, 8, autoID, ctx);

        expect(ctx.killCreature).toHaveBeenCalledWith(occupant, true);
    });

    it("relocates occupant to alternative home and caster takes the destination", () => {
        const pmap = makePmap();
        pmap[8][8].flags = TileFlag.HAS_MONSTER;
        const ctx = makeCtx(pmap);
        const occupant = makeCreature({ loc: { x: 8, y: 8 } });
        (ctx.monsterAtLoc as ReturnType<typeof vi.fn>).mockReturnValue(occupant);
        (ctx.findAlternativeHomeFor as ReturnType<typeof vi.fn>).mockReturnValue({ x: 6, y: 6 });
        const caster = makeCreature({ loc: { x: 1, y: 1 } });
        const bolt = makeBolt(BoltEffect.Blinking);
        const autoID = { value: false };

        detonateBolt(bolt, caster, 8, 8, autoID, ctx);

        // Occupant relocated to (6,6).
        expect(occupant.loc).toEqual({ x: 6, y: 6 });
        expect(pmap[6][6].flags & TileFlag.HAS_MONSTER).toBe(TileFlag.HAS_MONSTER);
        // Caster blinkd to (8,8) — HAS_MONSTER set for the caster.
        expect(caster.loc).toEqual({ x: 8, y: 8 });
        expect(pmap[8][8].flags & TileFlag.HAS_MONSTER).toBe(TileFlag.HAS_MONSTER);
    });
});

// =============================================================================
// detonateBolt — targetDF only
// =============================================================================

describe("detonateBolt > targetDF", () => {
    it("spawns targetDF for bolts whose effect has no terminal spawn", () => {
        const bolt = makeBolt(BoltEffect.Damage, { targetDF: DungeonFeatureType.DF_FORCEFIELD });
        const ctx = makeCtx();
        const autoID = { value: false };

        detonateBolt(bolt, null, 7, 7, autoID, ctx);

        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(7, 7, DungeonFeatureType.DF_FORCEFIELD, true, false);
    });

    it("does not spawn anything when targetDF is 0", () => {
        const bolt = makeBolt(BoltEffect.Damage, { targetDF: 0 });
        const ctx = makeCtx();
        const autoID = { value: false };

        detonateBolt(bolt, null, 7, 7, autoID, ctx);

        expect(ctx.spawnDungeonFeature).not.toHaveBeenCalled();
    });
});
