/*
 *  player-movement.test.ts — Tests for player movement helpers
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    randValidDirectionFrom,
    vomit,
    moveEntrancedMonsters,
    playerMoves,
} from "../../src/movement/player-movement.js";
import type {
    RandValidDirContext,
    VomitContext,
    MoveEntrancedContext,
    PlayerMoveContext,
} from "../../src/movement/player-movement.js";
import { Direction, CreatureState, StatusEffect, TileType, DungeonFeatureType } from "../../src/types/enums.js";
import {
    TerrainFlag,
    TerrainMechFlag,
    TileFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    ItemFlag,
} from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item, DungeonFeature } from "../../src/types/types.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import { NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

// Must match ts/src/globals/tables.ts — indexed by Direction enum.
const nbDirs: readonly [number, number][] = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function makeCell(
    layers: TileType[] = [TileType.FLOOR, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
    flags = 0,
): Pcell {
    return {
        layers: [...layers],
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

function makePmap(width = 10, height = 10): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < width; x++) {
        pmap[x] = [];
        for (let y = 0; y < height; y++) {
            pmap[x][y] = makeCell();
        }
    }
    return pmap;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 0,
            monsterName: "test creature",
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
        ticksUntilTurn: 0,
        carriedItem: null,
        ...overrides,
    } as Creature;
}

// =============================================================================
// randValidDirectionFrom
// =============================================================================

describe("randValidDirectionFrom", () => {
    it("returns a valid direction when surrounded by passable terrain", () => {
        const pmap = makePmap();
        const monst = makeCreature({ loc: { x: 5, y: 5 } });

        const ctx: RandValidDirContext = {
            pmap,
            nbDirs,
            coordinatesAreInMap: (x, y) => x >= 0 && x < 10 && y >= 0 && y < 10,
            cellHasTerrainFlag: () => false,
            diagonalBlocked: () => false,
            monsterAvoids: () => false,
            randRange: (lo, hi) => lo, // always pick first valid
        };

        const dir = randValidDirectionFrom(monst, 5, 5, false, ctx);
        expect(dir).toBeGreaterThanOrEqual(0);
        expect(dir).toBeLessThan(8);
    });

    it("returns NoDirection when completely boxed in", () => {
        const pmap = makePmap();
        const monst = makeCreature({ loc: { x: 5, y: 5 } });

        const ctx: RandValidDirContext = {
            pmap,
            nbDirs,
            coordinatesAreInMap: () => true,
            cellHasTerrainFlag: () => true, // all cells obstruct
            diagonalBlocked: () => false,
            monsterAvoids: () => false,
            randRange: () => 0,
        };

        const dir = randValidDirectionFrom(monst, 5, 5, false, ctx);
        expect(dir).toBe(Direction.NoDirection);
    });

    it("respects avoidance preferences when flag is set", () => {
        const pmap = makePmap();
        const monst = makeCreature({ loc: { x: 5, y: 5 } });

        // Monster avoids all directions except direction 3 (Right: dx=1, dy=0)
        const ctx: RandValidDirContext = {
            pmap,
            nbDirs,
            coordinatesAreInMap: () => true,
            cellHasTerrainFlag: () => false,
            diagonalBlocked: () => false,
            monsterAvoids: (_m, pos) => !(pos.x === 6 && pos.y === 5), // only Right is OK
            randRange: () => 0,
        };

        const dir = randValidDirectionFrom(monst, 5, 5, true, ctx);
        expect(dir).toBe(Direction.Right); // Direction.Right = 3
    });
});

// =============================================================================
// vomit
// =============================================================================

describe("vomit", () => {
    it("spawns vomit dungeon feature at monster location", () => {
        const monst = makeCreature({ loc: { x: 3, y: 4 } });
        const spawnSpy = vi.fn();
        const dummyFeat = {} as DungeonFeature;
        const catalog: DungeonFeature[] = [];
        catalog[DungeonFeatureType.DF_VOMIT] = dummyFeat;

        const ctx: VomitContext = {
            player: makeCreature(),
            dungeonFeatureCatalog: catalog,
            spawnDungeonFeature: spawnSpy,
            canDirectlySeeMonster: () => false,
            monsterName: () => "a goblin",
            combatMessage: () => {},
            automationActive: false,
        };

        vomit(monst, ctx);

        expect(spawnSpy).toHaveBeenCalledWith(3, 4, dummyFeat, true, false);
    });

    it("displays message when player can see the vomiting creature", () => {
        const monst = makeCreature({ loc: { x: 3, y: 4 } });
        const msgSpy = vi.fn();
        const dummyFeat = {} as DungeonFeature;
        const catalog: DungeonFeature[] = [];
        catalog[DungeonFeatureType.DF_VOMIT] = dummyFeat;

        const ctx: VomitContext = {
            player: makeCreature(),
            dungeonFeatureCatalog: catalog,
            spawnDungeonFeature: () => {},
            canDirectlySeeMonster: () => true,
            monsterName: () => "a goblin",
            combatMessage: msgSpy,
            automationActive: false,
        };

        vomit(monst, ctx);

        expect(msgSpy).toHaveBeenCalledTimes(1);
        expect(msgSpy.mock.calls[0][0]).toContain("vomits profusely");
    });

    it("uses first person for player vomiting", () => {
        const player = makeCreature({ loc: { x: 3, y: 4 } });
        const msgSpy = vi.fn();
        const dummyFeat = {} as DungeonFeature;
        const catalog: DungeonFeature[] = [];
        catalog[DungeonFeatureType.DF_VOMIT] = dummyFeat;

        const ctx: VomitContext = {
            player,
            dungeonFeatureCatalog: catalog,
            spawnDungeonFeature: () => {},
            canDirectlySeeMonster: () => true,
            monsterName: () => "you",
            combatMessage: msgSpy,
            automationActive: false,
        };

        vomit(player, ctx); // monst === player

        expect(msgSpy.mock.calls[0][0]).toContain("vomit profusely"); // no 's'
    });
});

// =============================================================================
// moveEntrancedMonsters
// =============================================================================

describe("moveEntrancedMonsters", () => {
    it("moves entranced monsters in the opposite direction", () => {
        const entranced = makeCreature({
            loc: { x: 3, y: 3 },
        });
        entranced.status[StatusEffect.Entranced] = 5;

        const moveSpy = vi.fn();
        const ctx: MoveEntrancedContext = {
            monsters: [entranced],
            nbDirs,
            moveMonster: moveSpy,
        };

        // Player moves Up (direction 0), so entranced moves Down (direction 1)
        moveEntrancedMonsters(Direction.Up, ctx);

        expect(moveSpy).toHaveBeenCalledTimes(1);
        // oppositeDir(Up=0) → Down=1, nbDirs[1] = [0, 1]
        expect(moveSpy).toHaveBeenCalledWith(entranced, 0, 1);
    });

    it("does not move stuck monsters", () => {
        const stuck = makeCreature({ loc: { x: 3, y: 3 } });
        stuck.status[StatusEffect.Entranced] = 5;
        stuck.status[StatusEffect.Stuck] = 3;

        const moveSpy = vi.fn();
        const ctx: MoveEntrancedContext = {
            monsters: [stuck],
            nbDirs,
            moveMonster: moveSpy,
        };

        moveEntrancedMonsters(Direction.Up, ctx);
        expect(moveSpy).not.toHaveBeenCalled();
    });

    it("does not move paralyzed monsters", () => {
        const paralyzed = makeCreature({ loc: { x: 3, y: 3 } });
        paralyzed.status[StatusEffect.Entranced] = 5;
        paralyzed.status[StatusEffect.Paralyzed] = 3;

        const moveSpy = vi.fn();
        const ctx: MoveEntrancedContext = {
            monsters: [paralyzed],
            nbDirs,
            moveMonster: moveSpy,
        };

        moveEntrancedMonsters(Direction.Up, ctx);
        expect(moveSpy).not.toHaveBeenCalled();
    });

    it("does not move captive monsters", () => {
        const captive = makeCreature({ loc: { x: 3, y: 3 } });
        captive.status[StatusEffect.Entranced] = 5;
        captive.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;

        const moveSpy = vi.fn();
        const ctx: MoveEntrancedContext = {
            monsters: [captive],
            nbDirs,
            moveMonster: moveSpy,
        };

        moveEntrancedMonsters(Direction.Up, ctx);
        expect(moveSpy).not.toHaveBeenCalled();
    });
});

// =============================================================================
// playerMoves — basic tests
// =============================================================================

function makePlayerMoveContext(pmap: Pcell[][], overrides: Partial<PlayerMoveContext> = {}): PlayerMoveContext {
    const player = makeCreature({ loc: { x: 5, y: 5 } });
    pmap[5][5].flags |= TileFlag.HAS_PLAYER;

    return {
        pmap,
        player,
        rogue: {
            disturbed: false,
            automationActive: false,
            weapon: null,
            armor: null,
            downLoc: { x: -1, y: -1 },
            upLoc: { x: -1, y: -1 },
            gameHasEnded: false,
        },
        nbDirs,
        coordinatesAreInMap: (x, y) => x >= 0 && x < pmap.length && y >= 0 && y < pmap[0].length,
        cellHasTerrainFlag: (pos, flag) => {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                if (tileCatalog[pmap[pos.x][pos.y].layers[layer]].flags & flag) return true;
            }
            return false;
        },
        cellHasTMFlag: (pos, flag) => {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                if (tileCatalog[pmap[pos.x][pos.y].layers[layer]].mechFlags & flag) return true;
            }
            return false;
        },
        cellHasTerrainType: () => false,
        playerCanSee: () => true,
        diagonalBlocked: () => false,
        monsterAtLoc: () => null,
        canSeeMonster: () => true,
        monsterRevealed: () => false,
        monstersAreEnemies: () => false,
        monsterWillAttackTarget: () => true,
        monsterName: () => "a goblin",
        monsterAvoids: () => false,
        monsterShouldFall: () => false,
        forbiddenFlagsForMonster: () => 0,
        distanceBetween: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
        allMonsters: () => [],
        layerWithTMFlag: () => -1,
        layerWithFlag: () => 0,
        handleWhipAttacks: () => false,
        handleSpearAttacks: () => false,
        buildFlailHitList: () => {},
        buildHitList: () => {},
        abortAttack: () => false,
        attack: () => false,
        playerRecoversFromAttacking: () => {},
        randValidDirectionFrom: () => Direction.NoDirection,
        moveMonster: () => {},
        getQualifyingPathLocNear: () => ({ x: 5, y: 5 }),
        keyInPackFor: () => null,
        useKeyAt: () => {},
        pickUpItemAt: () => {},
        checkForMissingKeys: () => {},
        freeCaptive: () => {},
        promoteTile: () => {},
        refreshDungeonCell: () => {},
        discoverCell: () => {},
        spawnDungeonFeature: () => {},
        dungeonFeatureCatalog: [],
        useStairs: () => {},
        playerTurnEnded: () => {},
        recordKeystroke: () => {},
        cancelKeystroke: () => {},
        confirm: () => true,
        message: () => {},
        messageWithColor: () => {},
        combatMessage: () => {},
        backgroundMessageColor: null,
        randPercent: () => false,
        randRange: () => 0,
        vomit: () => {},
        isDisturbed: () => false,
        ...overrides,
    };
}

describe("playerMoves", () => {
    it("returns false when moving out of map bounds", () => {
        const pmap = makePmap();
        const ctx = makePlayerMoveContext(pmap);
        ctx.player.loc = { x: 0, y: 0 };

        // Direction Up (0) → [0, -1] → y = -1, out of bounds
        const result = playerMoves(Direction.Up, ctx);
        expect(result).toBe(false);
    });

    it("moves the player to an open adjacent cell", () => {
        const pmap = makePmap();
        const ctx = makePlayerMoveContext(pmap);

        const result = playerMoves(Direction.Right, ctx);
        expect(result).toBe(true);
        expect(ctx.player.loc.x).toBe(6);
        expect(ctx.player.loc.y).toBe(5);
    });

    it("sets HAS_PLAYER flag on new cell and clears old cell", () => {
        const pmap = makePmap();
        const ctx = makePlayerMoveContext(pmap);

        playerMoves(Direction.Right, ctx);

        expect(pmap[5][5].flags & TileFlag.HAS_PLAYER).toBe(0);
        expect(pmap[6][5].flags & TileFlag.HAS_PLAYER).toBeTruthy();
    });

    it("records and does not cancel keystroke on successful move", () => {
        const pmap = makePmap();
        const recordSpy = vi.fn();
        const cancelSpy = vi.fn();
        const ctx = makePlayerMoveContext(pmap, {
            recordKeystroke: recordSpy,
            cancelKeystroke: cancelSpy,
        });

        playerMoves(Direction.Right, ctx);

        expect(recordSpy).toHaveBeenCalledTimes(1);
        expect(cancelSpy).not.toHaveBeenCalled();
    });

    it("picks up items when moving to a cell with HAS_ITEM", () => {
        const pmap = makePmap();
        pmap[6][5].flags |= TileFlag.HAS_ITEM;
        const pickupSpy = vi.fn();
        const ctx = makePlayerMoveContext(pmap, {
            pickUpItemAt: pickupSpy,
        });

        playerMoves(Direction.Right, ctx);

        expect(pickupSpy).toHaveBeenCalledWith({ x: 6, y: 5 });
        expect(ctx.rogue.disturbed).toBe(true);
    });

    it("returns false when moving into a wall", () => {
        const pmap = makePmap();
        pmap[6][5] = makeCell([TileType.WALL, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING], TileFlag.DISCOVERED);
        const ctx = makePlayerMoveContext(pmap);

        const result = playerMoves(Direction.Right, ctx);
        expect(result).toBe(false);
        expect(ctx.player.loc.x).toBe(5); // didn't move
    });

    it("uses stairs when moving to down staircase location", () => {
        const pmap = makePmap();
        const stairsSpy = vi.fn();
        const ctx = makePlayerMoveContext(pmap, {
            useStairs: stairsSpy,
        });
        ctx.rogue.downLoc = { x: 6, y: 5 };

        playerMoves(Direction.Right, ctx);

        expect(stairsSpy).toHaveBeenCalledWith(1);
    });

    it("calls playerTurnEnded on successful movement", () => {
        const pmap = makePmap();
        const turnEndedSpy = vi.fn();
        const ctx = makePlayerMoveContext(pmap, {
            playerTurnEnded: turnEndedSpy,
        });

        playerMoves(Direction.Right, ctx);

        expect(turnEndedSpy).toHaveBeenCalledTimes(1);
    });
});
