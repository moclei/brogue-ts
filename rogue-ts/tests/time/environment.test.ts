/*
 *  environment.test.ts — Tests for environment update logic
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    circuitBreakersPreventActivation,
    activateMachine,
    promoteTile,
    exposeTileToElectricity,
    exposeTileToFire,
    updateVolumetricMedia,
    updateYendorWardenTracking,
    updateEnvironment,
    nbDirs,
    DIRECTION_COUNT,
} from "../../src/time/environment.js";
import type { EnvironmentContext } from "../../src/time/environment.js";
import { DungeonLayer, TileType, StatusEffect } from "../../src/types/enums.js";
import {
    Fl,
    TileFlag,
    IS_IN_MACHINE,
    TerrainFlag,
    TerrainMechFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
} from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item, Color, LevelData, FloorTileType, DungeonFeature } from "../../src/types/types.js";
import { CreatureState } from "../../src/types/enums.js";
import { NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

const dummyColor: Color = { red: 0, green: 0, blue: 0, rand: 0, colorDances: false };
const DCOLS = 10;
const DROWS = 10;

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        depth: 1,
        status: new Array(60).fill(0),
        maxStatus: new Array(60).fill(0),
        info: { flags: 0, abilityFlags: 0, maxHP: 20, movementSpeed: 100, attackSpeed: 100, turnsBetweenRegen: 300, DFChance: 0, DFType: 0 },
        currentHP: 10,
        previousHealthPoints: 10,
        bookkeepingFlags: 0,
        creatureState: CreatureState.Ally,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        ticksUntilTurn: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        turnsUntilRegen: 300,
        regenPerTurn: 0,
        xpxp: 0,
        poisonAmount: 0,
        machineHome: 0,
        spawnDepth: 1,
        turnsSpentStationary: 0,
        weaknessAmount: 0,
        ...overrides,
    } as Creature;
}

function makeCell(overrides: Partial<Pcell> = {}): Pcell {
    return {
        layers: [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
        flags: 0,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: 0,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
        ...overrides,
    };
}

function makeTileCatalog(): FloorTileType[] {
    const tiles: FloorTileType[] = [];
    for (let i = 0; i < 200; i++) {
        tiles.push({
            displayChar: 0,
            foreColor: dummyColor,
            backColor: dummyColor,
            drawPriority: 50,
            chanceToIgnite: 0,
            fireType: 0,
            discoverType: 0,
            promoteType: 0,
            promoteChance: 0,
            glowLight: 0 as any,
            flags: 0,
            mechFlags: 0,
            description: "tile",
            flavorText: "you see a tile.",
        });
    }
    return tiles;
}

function makeCtx(overrides: Partial<EnvironmentContext> = {}): EnvironmentContext {
    const player = makeCreature({ loc: { x: 5, y: 5 } });
    const pmap: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        pmap[x] = [];
        for (let y = 0; y < DROWS; y++) {
            pmap[x][y] = makeCell();
        }
    }

    const tileCatalog = makeTileCatalog();
    const dungeonFeatureCatalog: DungeonFeature[] = [];
    for (let i = 0; i < 200; i++) {
        dungeonFeatureCatalog.push({} as DungeonFeature);
    }

    return {
        player,
        rogue: {
            depthLevel: 1,
            staleLoopMap: false,
            yendorWarden: null,
        },
        monsters: [],
        pmap,
        levels: [],
        tileCatalog,
        dungeonFeatureCatalog,
        DCOLS,
        DROWS,

        // Map helpers
        cellHasTerrainFlag: vi.fn(() => false),
        cellHasTMFlag: vi.fn(() => false),
        coordinatesAreInMap: vi.fn((x: number, y: number) => x >= 0 && x < DCOLS && y >= 0 && y < DROWS),

        // Environment helpers
        refreshDungeonCell: vi.fn(),
        spawnDungeonFeature: vi.fn(),
        monstersFall: vi.fn(),
        updateFloorItems: vi.fn(),
        monstersTurn: vi.fn(),
        keyOnTileAt: vi.fn(() => null),

        // Monster helpers
        removeCreature: vi.fn(() => true),
        prependCreature: vi.fn(),

        // Math
        rand_range: vi.fn((lo: number) => lo),
        rand_percent: vi.fn(() => false),
        max: Math.max,
        min: Math.min,

        // Shuffle helpers
        fillSequentialList: vi.fn((list: number[], length: number) => {
            for (let i = 0; i < length; i++) list[i] = i;
        }),
        shuffleList: vi.fn(),

        // exposeTileToFire
        exposeTileToFire: vi.fn(() => false),

        ...overrides,
    } as unknown as EnvironmentContext;
}

function makeLevelData(): LevelData {
    return {
        visited: true,
        mapStorage: (() => {
            const m: Pcell[][] = [];
            for (let x = 0; x < DCOLS; x++) {
                m[x] = [];
                for (let y = 0; y < DROWS; y++) {
                    m[x][y] = makeCell();
                }
            }
            return m;
        })(),
        items: [],
        monsters: [],
        dormantMonsters: [],
        scentMap: null,
        levelSeed: 0n,
        upStairsLoc: { x: 2, y: 2 },
        downStairsLoc: { x: 7, y: 7 },
        playerExitedVia: { x: 0, y: 0 },
    };
}

// =============================================================================
// nbDirs
// =============================================================================

describe("nbDirs", () => {
    it("has 8 entries", () => {
        expect(nbDirs.length).toBe(8);
        expect(DIRECTION_COUNT).toBe(8);
    });

    it("first 4 are cardinal directions", () => {
        // Each should have exactly one non-zero component
        for (let i = 0; i < 4; i++) {
            const [dx, dy] = nbDirs[i];
            expect(Math.abs(dx) + Math.abs(dy)).toBe(1);
        }
    });
});

// =============================================================================
// circuitBreakersPreventActivation
// =============================================================================

describe("circuitBreakersPreventActivation", () => {
    it("returns false when no circuit breaker in machine", () => {
        const ctx = makeCtx();
        expect(circuitBreakersPreventActivation(1, ctx)).toBe(false);
    });

    it("returns true when a circuit breaker tile exists in the machine", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].machineNumber = 1;
        (ctx.cellHasTMFlag as any).mockImplementation((pos: Pos, flag: number) => {
            return pos.x === 3 && pos.y === 4 && !!(flag & TerrainMechFlag.TM_IS_CIRCUIT_BREAKER);
        });
        expect(circuitBreakersPreventActivation(1, ctx)).toBe(true);
    });

    it("ignores circuit breakers in other machines", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].machineNumber = 2;
        (ctx.cellHasTMFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainMechFlag.TM_IS_CIRCUIT_BREAKER);
        });
        expect(circuitBreakersPreventActivation(1, ctx)).toBe(false);
    });
});

// =============================================================================
// promoteTile
// =============================================================================

describe("promoteTile", () => {
    it("vanishes tile and sets floor for dungeon layer", () => {
        const ctx = makeCtx();
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_VANISHES_UPON_PROMOTION,
            flags: 0,
            promoteType: 0,
        };
        promoteTile(3, 4, DungeonLayer.Dungeon, false, ctx);
        expect(ctx.pmap[3][4].layers[DungeonLayer.Dungeon]).toBe(TileType.FLOOR);
        expect(ctx.refreshDungeonCell).toHaveBeenCalled();
    });

    it("vanishes gas layer and resets volume", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].layers[DungeonLayer.Gas] = 5; // some gas type
        ctx.pmap[3][4].volume = 10;
        ctx.tileCatalog[5] = {
            ...ctx.tileCatalog[5],
            mechFlags: TerrainMechFlag.TM_VANISHES_UPON_PROMOTION,
            flags: 0,
            promoteType: 0,
        };
        promoteTile(3, 4, DungeonLayer.Gas, false, ctx);
        expect(ctx.pmap[3][4].layers[DungeonLayer.Gas]).toBe(TileType.NOTHING);
        expect(ctx.pmap[3][4].volume).toBe(0);
    });

    it("spawns dungeon feature when DFType exists", () => {
        const ctx = makeCtx();
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: 0,
            promoteType: 5 as any,
        };
        promoteTile(3, 4, DungeonLayer.Dungeon, false, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(3, 4, ctx.dungeonFeatureCatalog[5], true, false);
    });

    it("uses fireType when useFireDF is true", () => {
        const ctx = makeCtx();
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: 0,
            promoteType: 0 as any,
            fireType: 7 as any,
        };
        promoteTile(3, 4, DungeonLayer.Dungeon, true, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalledWith(3, 4, ctx.dungeonFeatureCatalog[7], true, false);
    });

    it("sets staleLoopMap when vanishing a pathing blocker", () => {
        const ctx = makeCtx();
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_VANISHES_UPON_PROMOTION,
            flags: TerrainFlag.T_OBSTRUCTS_PASSABILITY, // part of T_PATHING_BLOCKER
            promoteType: 0,
        };
        promoteTile(3, 4, DungeonLayer.Dungeon, false, ctx);
        expect(ctx.rogue.staleLoopMap).toBe(true);
    });

    it("activates machine when wired and not powered", () => {
        const ctx = makeCtx();
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.pmap[3][4].machineNumber = 1;
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_IS_WIRED,
            promoteType: 0,
        };
        // Track if activateMachine logic runs by checking IS_POWERED gets set and cleared
        promoteTile(3, 4, DungeonLayer.Dungeon, false, ctx);
        // After activation, power should be cleared
        expect(ctx.pmap[3][4].flags & TileFlag.IS_POWERED).toBeFalsy();
    });

    it("does not activate machine when circuit breaker prevents it", () => {
        const ctx = makeCtx();
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.pmap[3][4].machineNumber = 1;
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_IS_WIRED,
            promoteType: 0,
        };
        // Circuit breaker in the machine
        ctx.pmap[6][6].machineNumber = 1;
        (ctx.cellHasTMFlag as any).mockImplementation((pos: Pos, flag: number) => {
            return pos.x === 6 && pos.y === 6 && !!(flag & TerrainMechFlag.TM_IS_CIRCUIT_BREAKER);
        });
        promoteTile(3, 4, DungeonLayer.Dungeon, false, ctx);
        // No power should have been set
        expect(ctx.pmap[3][4].flags & TileFlag.IS_POWERED).toBeFalsy();
    });
});

// =============================================================================
// exposeTileToElectricity
// =============================================================================

describe("exposeTileToElectricity", () => {
    it("returns false when tile has no TM_PROMOTES_ON_ELECTRICITY", () => {
        const ctx = makeCtx();
        expect(exposeTileToElectricity(3, 4, ctx)).toBe(false);
    });

    it("promotes layers with TM_PROMOTES_ON_ELECTRICITY", () => {
        const ctx = makeCtx();
        (ctx.cellHasTMFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainMechFlag.TM_PROMOTES_ON_ELECTRICITY);
        });
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_PROMOTES_ON_ELECTRICITY,
            promoteType: 5 as any,
        };
        const result = exposeTileToElectricity(3, 4, ctx);
        expect(result).toBe(true);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalled();
    });
});

// =============================================================================
// exposeTileToFire
// =============================================================================

describe("exposeTileToFire", () => {
    it("returns false when tile is not flammable", () => {
        const ctx = makeCtx();
        expect(exposeTileToFire(3, 4, false, ctx)).toBe(false);
    });

    it("returns false when exposedToFire >= 12", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].exposedToFire = 12;
        (ctx.cellHasTerrainFlag as any).mockReturnValue(true);
        expect(exposeTileToFire(3, 4, false, ctx)).toBe(false);
    });

    it("increments exposedToFire", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_FLAMMABLE);
        });
        // No ignition chance, so fire won't ignite
        exposeTileToFire(3, 4, false, ctx);
        expect(ctx.pmap[3][4].exposedToFire).toBe(1);
    });

    it("ignites when alwaysIgnite is true", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_FLAMMABLE);
        });
        // Make the tile flammable with a fire type
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            flags: TerrainFlag.T_IS_FLAMMABLE,
            chanceToIgnite: 50,
            mechFlags: 0,
        };
        const result = exposeTileToFire(3, 4, true, ctx);
        expect(result).toBe(true);
        expect(ctx.refreshDungeonCell).toHaveBeenCalled();
    });

    it("clears gas volume when gas layer is flammable and ignites", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainFlag.T_IS_FLAMMABLE);
        });
        ctx.pmap[3][4].layers[DungeonLayer.Gas] = 10; // some gas
        ctx.pmap[3][4].volume = 20;
        ctx.tileCatalog[10] = {
            ...ctx.tileCatalog[10],
            flags: TerrainFlag.T_IS_FLAMMABLE,
            chanceToIgnite: 100,
            mechFlags: 0,
            drawPriority: 1,
        };
        // Also set ground tile as non-flammable for clarity
        const groundIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[groundIdx] = {
            ...ctx.tileCatalog[groundIdx],
            flags: 0,
            chanceToIgnite: 0,
            mechFlags: 0,
        };
        const result = exposeTileToFire(3, 4, true, ctx);
        expect(result).toBe(true);
        expect(ctx.pmap[3][4].volume).toBe(0);
    });
});

// =============================================================================
// updateVolumetricMedia
// =============================================================================

describe("updateVolumetricMedia", () => {
    it("diffuses gas to neighbors", () => {
        const ctx = makeCtx();
        // Put gas in center cell
        ctx.pmap[5][5].layers[DungeonLayer.Gas] = 3; // some gas type
        ctx.pmap[5][5].volume = 90;
        // rand_range returns lo, which distributes evenly
        (ctx.rand_range as any).mockReturnValue(0);
        updateVolumetricMedia(ctx);
        // Volume should be reduced in center (distributed to neighbors)
        expect(ctx.pmap[5][5].volume).toBeLessThan(90);
    });

    it("clears gas layer when volume drops to 0", () => {
        const ctx = makeCtx();
        ctx.pmap[5][5].layers[DungeonLayer.Gas] = 3;
        ctx.pmap[5][5].volume = 1;
        // With 9 spaces (self + 8 neighbors), 1/9 = 0.
        // rand_range(0, 8) returns >= (1 % 9)=1 so no rounding up -> volume = 0
        (ctx.rand_range as any).mockReturnValue(9); // >= remainder, so no stochastic rounding
        updateVolumetricMedia(ctx);
        // Gas should be cleared
        expect(ctx.pmap[5][5].layers[DungeonLayer.Gas]).toBe(TileType.NOTHING);
    });

    it("disperses gas from obstructing cells", () => {
        const ctx = makeCtx();
        // Mark (5,5) as obstructing gas
        (ctx.cellHasTerrainFlag as any).mockImplementation((pos: Pos, flag: number) => {
            if (pos.x === 5 && pos.y === 5 && (flag & TerrainFlag.T_OBSTRUCTS_GAS)) return true;
            return false;
        });
        ctx.pmap[5][5].layers[DungeonLayer.Gas] = 3;
        ctx.pmap[5][5].volume = 80;
        updateVolumetricMedia(ctx);
        // Gas in obstructing cell should be cleared
        expect(ctx.pmap[5][5].volume).toBe(0);
        expect(ctx.pmap[5][5].layers[DungeonLayer.Gas]).toBe(TileType.NOTHING);
    });

    it("refreshes cells whose volume changed", () => {
        const ctx = makeCtx();
        ctx.pmap[5][5].layers[DungeonLayer.Gas] = 3;
        ctx.pmap[5][5].volume = 90;
        updateVolumetricMedia(ctx);
        expect(ctx.refreshDungeonCell).toHaveBeenCalled();
    });
});

// =============================================================================
// updateYendorWardenTracking
// =============================================================================

describe("updateYendorWardenTracking", () => {
    it("does nothing when no yendor warden exists", () => {
        const ctx = makeCtx();
        updateYendorWardenTracking(ctx);
        expect(ctx.removeCreature).not.toHaveBeenCalled();
    });

    it("does nothing when warden is on player's level", () => {
        const ctx = makeCtx();
        const warden = makeCreature({ depth: 1 });
        ctx.rogue.yendorWarden = warden;
        ctx.rogue.depthLevel = 1;
        updateYendorWardenTracking(ctx);
        expect(ctx.removeCreature).not.toHaveBeenCalled();
    });

    it("moves warden closer to player when deeper", () => {
        const ctx = makeCtx();
        const warden = makeCreature({ depth: 5, bookkeepingFlags: MonsterBookkeepingFlag.MB_PREPLACED });
        ctx.rogue.yendorWarden = warden;
        ctx.rogue.depthLevel = 2;
        ctx.levels = [];
        for (let i = 0; i < 10; i++) ctx.levels.push(makeLevelData());
        updateYendorWardenTracking(ctx);
        expect(warden.depth).toBe(3); // depthLevel + 1
        expect(warden.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS).toBeTruthy();
        expect(warden.status[StatusEffect.EntersLevelIn]).toBe(50);
    });

    it("moves warden closer to player when shallower", () => {
        const ctx = makeCtx();
        const warden = makeCreature({ depth: 1, bookkeepingFlags: MonsterBookkeepingFlag.MB_PREPLACED });
        ctx.rogue.yendorWarden = warden;
        ctx.rogue.depthLevel = 5;
        ctx.levels = [];
        for (let i = 0; i < 10; i++) ctx.levels.push(makeLevelData());
        updateYendorWardenTracking(ctx);
        expect(warden.depth).toBe(4); // depthLevel - 1
        expect(warden.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS).toBeTruthy();
    });
});

// =============================================================================
// activateMachine
// =============================================================================

describe("activateMachine", () => {
    it("powers wired tiles in the machine", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].flags |= IS_IN_MACHINE;
        ctx.pmap[3][4].machineNumber = 1;
        (ctx.cellHasTMFlag as any).mockImplementation((pos: Pos, flag: number) => {
            return pos.x === 3 && pos.y === 4 && !!(flag & TerrainMechFlag.TM_IS_WIRED);
        });
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_IS_WIRED,
            promoteType: 5 as any,
        };
        activateMachine(1, ctx);
        // Should have spawned a DF
        expect(ctx.spawnDungeonFeature).toHaveBeenCalled();
    });

    it("gives turns to MONST_GETS_TURN_ON_ACTIVATION monsters", () => {
        const ctx = makeCtx();
        const monst = makeCreature({
            machineHome: 1,
            spawnDepth: 1,
        });
        monst.info.flags = MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION;
        ctx.monsters.push(monst);
        activateMachine(1, ctx);
        expect(ctx.monstersTurn).toHaveBeenCalledWith(monst);
    });

    it("does not give turns to dying monsters", () => {
        const ctx = makeCtx();
        const monst = makeCreature({
            machineHome: 1,
            spawnDepth: 1,
            bookkeepingFlags: MonsterBookkeepingFlag.MB_IS_DYING,
        });
        monst.info.flags = MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION;
        ctx.monsters.push(monst);
        activateMachine(1, ctx);
        expect(ctx.monstersTurn).not.toHaveBeenCalled();
    });
});

// =============================================================================
// updateEnvironment
// =============================================================================

describe("updateEnvironment", () => {
    it("calls monstersFall", () => {
        const ctx = makeCtx();
        updateEnvironment(ctx);
        expect(ctx.monstersFall).toHaveBeenCalled();
    });

    it("resets exposedToFire for all cells", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].exposedToFire = 5;
        ctx.pmap[7][2].exposedToFire = 10;
        updateEnvironment(ctx);
        expect(ctx.pmap[3][4].exposedToFire).toBe(0);
        expect(ctx.pmap[7][2].exposedToFire).toBe(0);
    });

    it("clears CAUGHT_FIRE_THIS_TURN flag", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].flags |= TileFlag.CAUGHT_FIRE_THIS_TURN;
        updateEnvironment(ctx);
        expect(ctx.pmap[3][4].flags & TileFlag.CAUGHT_FIRE_THIS_TURN).toBeFalsy();
    });

    it("releases pressure plates when no creature/item on them", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].flags |= TileFlag.PRESSURE_PLATE_DEPRESSED;
        updateEnvironment(ctx);
        expect(ctx.pmap[3][4].flags & TileFlag.PRESSURE_PLATE_DEPRESSED).toBeFalsy();
    });

    it("keeps pressure plates depressed when creature is on them", () => {
        const ctx = makeCtx();
        ctx.pmap[3][4].flags |= TileFlag.PRESSURE_PLATE_DEPRESSED | TileFlag.HAS_MONSTER;
        updateEnvironment(ctx);
        expect(ctx.pmap[3][4].flags & TileFlag.PRESSURE_PLATE_DEPRESSED).toBeTruthy();
    });

    it("calls updateFloorItems", () => {
        const ctx = makeCtx();
        updateEnvironment(ctx);
        expect(ctx.updateFloorItems).toHaveBeenCalled();
    });

    it("spreads fire to cardinal neighbors", () => {
        const ctx = makeCtx();
        (ctx.cellHasTerrainFlag as any).mockImplementation((pos: Pos, flag: number) => {
            if (pos.x === 5 && pos.y === 5 && (flag & TerrainFlag.T_IS_FIRE)) return true;
            return false;
        });
        updateEnvironment(ctx);
        // Should have called exposeTileToFire for the fire cell and its 4 cardinal neighbors
        expect(ctx.exposeTileToFire).toHaveBeenCalledWith(5, 5, false);
        // Cardinal neighbors
        expect(ctx.exposeTileToFire).toHaveBeenCalledWith(5, 4, false); // up
        expect(ctx.exposeTileToFire).toHaveBeenCalledWith(6, 5, false); // right
        expect(ctx.exposeTileToFire).toHaveBeenCalledWith(5, 6, false); // down
        expect(ctx.exposeTileToFire).toHaveBeenCalledWith(4, 5, false); // left
    });

    it("updates volumetric gas when gas exists", () => {
        const ctx = makeCtx();
        ctx.pmap[5][5].layers[DungeonLayer.Gas] = 3; // non-NOTHING gas
        ctx.pmap[5][5].volume = 50;
        updateEnvironment(ctx);
        // Gas should have been diffused
        expect(ctx.pmap[5][5].volume).not.toBe(50);
    });

    it("promotes tiles without keys when no key is present", () => {
        const ctx = makeCtx();
        (ctx.cellHasTMFlag as any).mockImplementation((_pos: Pos, flag: number) => {
            return !!(flag & TerrainMechFlag.TM_PROMOTES_WITHOUT_KEY);
        });
        const tileIdx = ctx.pmap[3][4].layers[DungeonLayer.Dungeon];
        ctx.tileCatalog[tileIdx] = {
            ...ctx.tileCatalog[tileIdx],
            mechFlags: TerrainMechFlag.TM_PROMOTES_WITHOUT_KEY,
            promoteType: 5 as any,
        };
        updateEnvironment(ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalled();
    });
});
