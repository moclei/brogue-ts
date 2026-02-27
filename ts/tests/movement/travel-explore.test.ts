/*
 *  travel-explore.test.ts — Tests for travel, exploration, and pathfinding
 *  brogue-ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    nextStep,
    displayRoute,
    travelRoute,
    travelMap,
    travel,
    getExploreMap,
    adjacentFightingDir,
    startFighting,
    explore,
    autoPlayLevel,
    proposeOrConfirmLocation,
    useStairs,
} from "../../src/movement/travel-explore.js";
import type { TravelExploreContext } from "../../src/movement/travel-explore.js";
import { Direction, StatusEffect, GameMode } from "../../src/types/enums.js";
import {
    TileFlag, TerrainFlag,
    MonsterBehaviorFlag, MonsterBookkeepingFlag, ItemFlag,
} from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item, Color } from "../../src/types/types.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import { nbDirs } from "../../src/globals/tables.js";

// =============================================================================
// Helpers
// =============================================================================

/** Grid size used for small tests. Must be consistent everywhere. */
const GW = 10;
const GH = 10;

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 1, y: 1 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
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
        creatureState: 0,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        movementSpeed: 100,
        attackSpeed: 100,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
    } as Creature;
}

const dummyColor: Color = { red: 0, green: 0, blue: 0, rand: 0, colorDances: false };

function makeGrid(w = GW, h = GH, fill = 0): number[][] {
    const g: number[][] = [];
    for (let x = 0; x < w; x++) {
        g[x] = new Array(h).fill(fill);
    }
    return g;
}

function makePmap(w = GW, h = GH): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let x = 0; x < w; x++) {
        pmap[x] = [];
        for (let y = 0; y < h; y++) {
            pmap[x][y] = {
                layers: [1, 0, 0, 0],
                flags: TileFlag.DISCOVERED,
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
            };
        }
    }
    return pmap;
}

function makeCtx(overrides: Partial<TravelExploreContext> = {}): TravelExploreContext {
    const player = makeCreature();
    const pmap = makePmap();

    return {
        pmap,
        player,
        rogue: {
            disturbed: false,
            automationActive: false,
            autoPlayingLevel: false,
            gameHasEnded: false,
            blockCombatText: false,
            playbackMode: false,
            cursorLoc: { x: -1, y: -1 },
            upLoc: { x: 0, y: 0 },
            downLoc: { x: 4, y: 4 },
            depthLevel: 1,
            deepestLevel: 1,
            mode: GameMode.Normal,
        },
        monsters: [],
        nbDirs,
        gameConst: { deepestLevel: 26 },
        tileCatalog: Array.from({ length: 50 }, () => ({ flags: 0, mechFlags: 0, discoverType: 0 })),
        coordinatesAreInMap: (x, y) => x >= 0 && x < GW && y >= 0 && y < GH,
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        diagonalBlocked: () => false,
        monsterAvoids: () => false,
        monsterAtLoc: () => null,
        canSeeMonster: () => true,
        canPass: () => true,
        monstersAreTeammates: () => false,
        monstersAreEnemies: () => false,
        monsterDamageAdjustmentAmount: () => 1,
        playerMoves: () => true,
        allocGrid: () => makeGrid(),
        freeGrid: () => {},
        calculateDistances: () => {},
        dijkstraScan: () => {},
        populateCreatureCostMap: () => {},
        knownToPlayerAsPassableOrSecretDoor: () => true,
        itemAtLoc: () => null,
        numberOfMatchingPackItems: () => 0,
        message: () => {},
        messageWithColor: () => {},
        confirmMessages: () => {},
        hiliteCell: () => {},
        refreshDungeonCell: () => {},
        refreshSideBar: () => {},
        updateFlavorText: () => {},
        clearCursorPath: () => {},
        hilitePath: () => {},
        getPlayerPathOnMap: () => 0,
        commitDraws: () => {},
        pauseAnimation: () => false,
        recordMouseClick: () => {},
        mapToWindowX: (x) => x,
        mapToWindowY: (y) => y,
        windowToMapX: (wx) => wx,
        windowToMapY: (wy) => wy,
        updatePlayerUnderwaterness: () => {},
        updateVision: () => {},
        nextBrogueEvent: (event) => { event.eventType = 0; event.param1 = 121; /* 'y' */ },
        executeMouseClick: () => {},
        printString: () => {},
        hiliteColor: dummyColor,
        white: dummyColor,
        black: dummyColor,
        lightBlue: dummyColor,
        backgroundMessageColor: dummyColor,
        startLevel: () => {},
        victory: () => {},
        fpFactor: 1,
        AMULET: 0x2000,
        D_WORMHOLING: false,
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        INVALID_POS: { x: -1, y: -1 },
        ASCEND_KEY: "<".charCodeAt(0),
        DESCEND_KEY: ">".charCodeAt(0),
        RETURN_KEY: 0x0a,
        ...overrides,
    };
}

// =============================================================================
// nextStep
// =============================================================================

describe("nextStep", () => {
    it("returns the direction that descends the gradient most steeply", () => {
        const ctx = makeCtx();
        const distMap = makeGrid(GW, GH, 30000);
        distMap[1][1] = 3;
        distMap[2][1] = 2; // Right (dir 3: [1, 0])
        distMap[1][2] = 1; // Down (dir 1: [0, 1])
        distMap[0][1] = 5; // Left (higher, won't be chosen)

        const dir = nextStep(distMap, { x: 1, y: 1 }, null, false, ctx);
        // Down has score of 2 (3-1), right has score of 1 (3-2)
        expect(dir).toBe(1); // dir 1 = Down = [0,1]
    });

    it("returns NO_DIRECTION when no improvement possible", () => {
        const ctx = makeCtx();
        const distMap = makeGrid(GW, GH, 30000);
        distMap[2][2] = 0; // already at goal

        const dir = nextStep(distMap, { x: 2, y: 2 }, null, false, ctx);
        expect(dir).toBe(-1); // NO_DIRECTION
    });

    it("respects diagonal preference order", () => {
        const ctx = makeCtx();
        const distMap = makeGrid(GW, GH, 30000);
        distMap[2][2] = 4;
        distMap[3][2] = 1; // Right (dir 3)
        distMap[2][3] = 1; // Down (dir 1)

        const dirNormal = nextStep(distMap, { x: 2, y: 2 }, null, false, ctx);
        const dirDiag = nextStep(distMap, { x: 2, y: 2 }, null, true, ctx);

        expect(dirNormal).not.toBe(-1);
        expect(dirDiag).not.toBe(-1);
    });

    it("avoids blocked cells when monster is provided", () => {
        const monst = makeCreature({ loc: { x: 2, y: 2 } });
        const ctx = makeCtx({
            monsterAvoids: (_m, p) => p.x === 3 && p.y === 2,
        });
        const distMap = makeGrid(GW, GH, 30000);
        distMap[2][2] = 3;
        distMap[3][2] = 0; // avoided
        distMap[2][3] = 1; // ok

        const dir = nextStep(distMap, { x: 2, y: 2 }, monst, false, ctx);
        expect(dir).toBe(1); // Down
    });
});

// =============================================================================
// displayRoute
// =============================================================================

describe("displayRoute", () => {
    it("hilites cells along the route", () => {
        const hiliteSpy = vi.fn();
        const ctx = makeCtx({ hiliteCell: hiliteSpy });
        ctx.player.loc = { x: 1, y: 1 };
        const distMap = makeGrid(GW, GH, 30000);
        distMap[1][1] = 2;
        distMap[2][1] = 1;
        distMap[3][1] = 0;

        displayRoute(distMap, false, ctx);

        expect(hiliteSpy).toHaveBeenCalled();
        expect(hiliteSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it("refreshes cells when removing the route", () => {
        const refreshSpy = vi.fn();
        const ctx = makeCtx({ refreshDungeonCell: refreshSpy });
        ctx.player.loc = { x: 1, y: 1 };
        const distMap = makeGrid(GW, GH, 30000);
        distMap[1][1] = 1;
        distMap[2][1] = 0;

        displayRoute(distMap, true, ctx);

        expect(refreshSpy).toHaveBeenCalled();
    });

    it("returns early if player is at an unreachable location", () => {
        const hiliteSpy = vi.fn();
        const ctx = makeCtx({ hiliteCell: hiliteSpy });
        ctx.player.loc = { x: 1, y: 1 };
        const distMap = makeGrid(GW, GH, 30000);
        // player location stays 30000 = unreachable

        displayRoute(distMap, false, ctx);

        expect(hiliteSpy).not.toHaveBeenCalled();
    });
});

// =============================================================================
// travelRoute
// =============================================================================

describe("travelRoute", () => {
    it("moves player along the path", () => {
        const movesSpy = vi.fn().mockReturnValue(true);
        const ctx = makeCtx({ playerMoves: movesSpy });
        ctx.player.loc = { x: 1, y: 1 };

        // Path: player at (1,1), path goes to (2,1) which is Right (+1,0)
        const path: Pos[] = [{ x: 2, y: 1 }];

        travelRoute(path, 1, ctx);

        expect(movesSpy).toHaveBeenCalled();
        expect(ctx.rogue.disturbed).toBe(true); // always true after
        expect(ctx.rogue.automationActive).toBe(false);
    });

    it("stops if player can't move", () => {
        const movesSpy = vi.fn().mockReturnValue(false);
        const ctx = makeCtx({ playerMoves: movesSpy });
        ctx.player.loc = { x: 1, y: 1 };

        const path: Pos[] = [{ x: 2, y: 1 }];
        travelRoute(path, 1, ctx);

        expect(ctx.rogue.disturbed).toBe(true);
    });

    it("marks already-seen monsters", () => {
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        const ctx = makeCtx({
            monsters: [monst],
            canSeeMonster: () => true,
            playerMoves: () => true,
        });

        travelRoute([], 0, ctx);

        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_ALREADY_SEEN).toBeTruthy();
    });
});

// =============================================================================
// travelMap
// =============================================================================

describe("travelMap", () => {
    it("follows the gradient downhill", () => {
        let moved = false;
        const ctx = makeCtx({
            playerMoves: () => {
                moved = true;
                ctx.player.loc = { x: 2, y: 1 };
                return true;
            },
        });
        ctx.player.loc = { x: 1, y: 1 };
        const distMap = makeGrid(GW, GH, 30000);
        distMap[1][1] = 2;
        distMap[2][1] = 1;
        distMap[3][1] = 0;

        travelMap(distMap, ctx);

        expect(moved).toBe(true);
    });

    it("doesn't move if player location is unreachable", () => {
        const movesSpy = vi.fn();
        const ctx = makeCtx({ playerMoves: movesSpy });
        ctx.player.loc = { x: 1, y: 1 };
        const distMap = makeGrid(GW, GH, 30000);
        // player at (1,1) = 30000, unreachable

        travelMap(distMap, ctx);

        expect(movesSpy).not.toHaveBeenCalled();
    });
});

// =============================================================================
// adjacentFightingDir
// =============================================================================

describe("adjacentFightingDir", () => {
    it("returns NO_DIRECTION when no enemies adjacent", () => {
        const ctx = makeCtx();
        expect(adjacentFightingDir(ctx)).toBe(-1);
    });

    it("returns NO_DIRECTION when player is trapped", () => {
        const ctx = makeCtx({
            cellHasTerrainFlag: (_p, f) => !!(f & TerrainFlag.T_OBSTRUCTS_PASSABILITY),
        });
        expect(adjacentFightingDir(ctx)).toBe(-1);
    });

    it("returns direction of adjacent visible enemy", () => {
        const enemy = makeCreature({ loc: { x: 2, y: 1 } });
        const ctx = makeCtx({
            monsterAtLoc: (loc) => {
                if (loc.x === 2 && loc.y === 1) return enemy;
                return null;
            },
            canSeeMonster: () => true,
            monstersAreEnemies: () => true,
        });
        ctx.player.loc = { x: 1, y: 1 };

        const dir = adjacentFightingDir(ctx);
        // Direction Right = 3, nbDirs[3] = [1,0], (1,1) + (1,0) = (2,1) = enemy
        expect(dir).toBe(3);
    });

    it("ignores immune-to-weapons monsters", () => {
        const enemy = makeCreature({ loc: { x: 2, y: 1 } });
        enemy.info.flags = MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS;
        const ctx = makeCtx({
            monsterAtLoc: (loc) => (loc.x === 2 && loc.y === 1) ? enemy : null,
            canSeeMonster: () => true,
            monstersAreEnemies: () => true,
        });

        expect(adjacentFightingDir(ctx)).toBe(-1);
    });

    it("ignores invisible enemies", () => {
        const enemy = makeCreature({ loc: { x: 2, y: 1 } });
        const ctx = makeCtx({
            monsterAtLoc: (loc) => (loc.x === 2 && loc.y === 1) ? enemy : null,
            canSeeMonster: () => false,
            monstersAreEnemies: () => true,
        });

        expect(adjacentFightingDir(ctx)).toBe(-1);
    });
});

// =============================================================================
// startFighting
// =============================================================================

describe("startFighting", () => {
    it("fights the monster until disturbed", () => {
        const enemy = makeCreature({ loc: { x: 2, y: 1 } });
        let moveCount = 0;
        const pmap = makePmap();
        pmap[2][1].flags |= TileFlag.HAS_MONSTER;
        const ctx = makeCtx({
            pmap,
            monsterAtLoc: () => enemy,
            playerMoves: () => {
                moveCount++;
                if (moveCount >= 3) ctx.rogue.disturbed = true;
                return true;
            },
        });
        ctx.player.loc = { x: 1, y: 1 };

        const result = startFighting(3 as Direction, false, ctx);

        expect(moveCount).toBe(3);
        expect(result).toBe(true);
        expect(ctx.rogue.blockCombatText).toBe(false);
    });

    it("returns false for immune-to-weapons monsters", () => {
        const enemy = makeCreature({ loc: { x: 2, y: 1 } });
        enemy.info.flags = MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS;
        const ctx = makeCtx({ monsterAtLoc: () => enemy });

        expect(startFighting(3 as Direction, false, ctx)).toBe(false);
    });

    it("returns false if no monster at location", () => {
        const ctx = makeCtx();
        expect(startFighting(3 as Direction, false, ctx)).toBe(false);
    });
});

// =============================================================================
// proposeOrConfirmLocation
// =============================================================================

describe("proposeOrConfirmLocation", () => {
    it("returns false and messages if player is already at target", () => {
        const msgSpy = vi.fn();
        const ctx = makeCtx({ message: msgSpy });
        ctx.player.loc = { x: 3, y: 3 };

        const result = proposeOrConfirmLocation({ x: 3, y: 3 }, "fail", ctx);

        expect(result).toBe(false);
        expect(msgSpy).toHaveBeenCalledWith("you are already there.", 0);
    });

    it("returns true if cursor is already at target", () => {
        const ctx = makeCtx();
        ctx.rogue.cursorLoc = { x: 3, y: 3 };
        ctx.pmap[3][3].flags |= TileFlag.DISCOVERED;

        expect(proposeOrConfirmLocation({ x: 3, y: 3 }, "fail", ctx)).toBe(true);
    });

    it("sets cursor and returns false on first proposal", () => {
        const ctx = makeCtx();
        ctx.rogue.cursorLoc = { x: -1, y: -1 };
        ctx.pmap[3][3].flags |= TileFlag.DISCOVERED;

        const result = proposeOrConfirmLocation({ x: 3, y: 3 }, "fail", ctx);

        expect(result).toBe(false);
        expect(ctx.rogue.cursorLoc).toEqual({ x: 3, y: 3 });
    });

    it("shows failure message for undiscovered locations", () => {
        const msgSpy = vi.fn();
        const ctx = makeCtx({ message: msgSpy });
        ctx.pmap[3][3].flags = 0; // not discovered

        proposeOrConfirmLocation({ x: 3, y: 3 }, "Can't see there!", ctx);

        expect(msgSpy).toHaveBeenCalledWith("Can't see there!", 0);
    });
});

// =============================================================================
// useStairs
// =============================================================================

describe("useStairs", () => {
    it("descends when stairDirection is 1", () => {
        const startLevelSpy = vi.fn();
        const msgSpy = vi.fn();
        const ctx = makeCtx({ startLevel: startLevelSpy, message: msgSpy });
        ctx.rogue.depthLevel = 3;

        const result = useStairs(1, ctx);

        expect(result).toBe(true);
        expect(ctx.rogue.depthLevel).toBe(4);
        expect(startLevelSpy).toHaveBeenCalledWith(3, 1);
        expect(msgSpy).toHaveBeenCalledWith("You descend.", 0);
    });

    it("updates deepest level when descending to new depth", () => {
        const ctx = makeCtx({ startLevel: () => {} });
        ctx.rogue.depthLevel = 3;
        ctx.rogue.deepestLevel = 3;

        useStairs(1, ctx);

        expect(ctx.rogue.deepestLevel).toBe(4);
    });

    it("ascends when stairDirection is -1 from depth > 1", () => {
        const startLevelSpy = vi.fn();
        const ctx = makeCtx({ startLevel: startLevelSpy });
        ctx.rogue.depthLevel = 3;

        const result = useStairs(-1, ctx);

        expect(result).toBe(true);
        expect(ctx.rogue.depthLevel).toBe(2);
        expect(startLevelSpy).toHaveBeenCalledWith(3, -1);
    });

    it("triggers victory when ascending from depth 1 with amulet", () => {
        const victorySpy = vi.fn();
        const ctx = makeCtx({
            victory: victorySpy,
            numberOfMatchingPackItems: () => 1,
        });
        ctx.rogue.depthLevel = 1;

        useStairs(-1, ctx);

        expect(ctx.rogue.depthLevel).toBe(0);
        expect(victorySpy).toHaveBeenCalledWith(false);
    });

    it("blocks ascent from depth 1 without amulet", () => {
        const msgColorSpy = vi.fn();
        const ctx = makeCtx({
            messageWithColor: msgColorSpy,
            numberOfMatchingPackItems: () => 0,
        });
        ctx.rogue.depthLevel = 1;

        const result = useStairs(-1, ctx);

        expect(result).toBe(false);
        expect(ctx.rogue.depthLevel).toBe(1);
        expect(msgColorSpy).toHaveBeenCalledTimes(2);
    });

    it("triggers victory when descending at deepest level with amulet", () => {
        const victorySpy = vi.fn();
        const ctx = makeCtx({
            victory: victorySpy,
            numberOfMatchingPackItems: () => 1,
        });
        ctx.rogue.depthLevel = 26;
        ctx.gameConst.deepestLevel = 26;

        useStairs(1, ctx);

        expect(victorySpy).toHaveBeenCalledWith(true);
    });

    it("blocks descent at deepest level without amulet", () => {
        const msgColorSpy = vi.fn();
        const ctx = makeCtx({
            messageWithColor: msgColorSpy,
            numberOfMatchingPackItems: () => 0,
        });
        ctx.rogue.depthLevel = 26;
        ctx.gameConst.deepestLevel = 26;

        useStairs(1, ctx);

        expect(ctx.rogue.depthLevel).toBe(26);
        expect(msgColorSpy).toHaveBeenCalled();
    });
});

// =============================================================================
// travel
// =============================================================================

describe("travel", () => {
    it("directly moves to cardinal neighbor", () => {
        const movesSpy = vi.fn().mockReturnValue(true);
        const ctx = makeCtx({ playerMoves: movesSpy });
        ctx.player.loc = { x: 2, y: 2 };

        travel({ x: 3, y: 2 }, false, ctx); // one step right

        expect(movesSpy).toHaveBeenCalled();
    });

    it("shows message for unexplored location", () => {
        const msgSpy = vi.fn();
        const ctx = makeCtx({ message: msgSpy });
        ctx.player.loc = { x: 0, y: 0 };
        ctx.pmap[3][3].flags = 0; // not discovered

        travel({ x: 3, y: 3 }, false, ctx);

        expect(msgSpy).toHaveBeenCalledWith("You have not explored that location.", 0);
    });

    it("auto-confirms when autoConfirm is true and path exists", () => {
        const ctx = makeCtx({
            allocGrid: () => makeGrid(),
            calculateDistances: (dm: number[][]) => {
                dm[1][1] = 5;
                dm[3][3] = 0;
            },
        });
        ctx.player.loc = { x: 1, y: 1 };
        ctx.pmap[3][3].flags |= TileFlag.DISCOVERED;

        // Should not throw
        travel({ x: 3, y: 3 }, true, ctx);
    });

    it("shows no-path message when target is unreachable", () => {
        const msgSpy = vi.fn();
        const ctx = makeCtx({
            message: msgSpy,
            allocGrid: () => makeGrid(GW, GH, 30000),
            calculateDistances: () => {},
        });
        ctx.player.loc = { x: 1, y: 1 };
        ctx.pmap[3][3].flags |= TileFlag.DISCOVERED;

        travel({ x: 3, y: 3 }, true, ctx);

        expect(msgSpy).toHaveBeenCalledWith("No path is available.", 0);
    });
});

// =============================================================================
// getExploreMap
// =============================================================================

describe("getExploreMap", () => {
    it("sets undiscovered cells as goal values", () => {
        const fullPmap = makePmap(DCOLS, DROWS);
        // Mark cell (10,10) as undiscovered
        fullPmap[10][10].flags = 0;
        const ctx = makeCtx({
            pmap: fullPmap,
            coordinatesAreInMap: (x, y) => x >= 0 && x < DCOLS && y >= 0 && y < DROWS,
            allocGrid: () => makeGrid(DCOLS, DROWS),
        });
        ctx.rogue.downLoc = { x: DCOLS - 1, y: DROWS - 1 };
        ctx.rogue.upLoc = { x: 0, y: 0 };

        const map = makeGrid(DCOLS, DROWS, 30000);
        getExploreMap(map, false, ctx);

        // Undiscovered cell should have a goal value (not 30000)
        expect(map[10][10]).not.toBe(30000);
    });

    it("sets stair location as goal when headingToStairs", () => {
        const fullPmap = makePmap(DCOLS, DROWS);
        const ctx = makeCtx({
            pmap: fullPmap,
            coordinatesAreInMap: (x, y) => x >= 0 && x < DCOLS && y >= 0 && y < DROWS,
            allocGrid: () => makeGrid(DCOLS, DROWS),
        });
        ctx.rogue.downLoc = { x: 4, y: 4 };
        ctx.rogue.upLoc = { x: 0, y: 0 };

        const map = makeGrid(DCOLS, DROWS, 30000);
        getExploreMap(map, true, ctx);

        expect(map[4][4]).toBe(0); // stairs = goal
    });
});

// =============================================================================
// explore
// =============================================================================

describe("explore", () => {
    it("returns false when player is confused", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Confused] = 1;

        expect(explore(50, ctx)).toBe(false);
    });

    it("returns false when player is trapped", () => {
        const ctx = makeCtx({
            cellHasTerrainFlag: (_p, f) => !!(f & TerrainFlag.T_OBSTRUCTS_PASSABILITY),
        });

        expect(explore(50, ctx)).toBe(false);
    });

    it("fights adjacent enemy and returns true", () => {
        const enemy = makeCreature({ loc: { x: 2, y: 1 } });
        const pmap = makePmap();
        pmap[2][1].flags |= TileFlag.HAS_MONSTER;
        const ctx = makeCtx({
            pmap,
            monsterAtLoc: (loc) => (loc.x === 2 && loc.y === 1) ? enemy : null,
            canSeeMonster: () => true,
            monstersAreEnemies: () => true,
            playerMoves: () => {
                ctx.rogue.disturbed = true;
                return true;
            },
        });
        ctx.player.loc = { x: 1, y: 1 };

        const result = explore(50, ctx);
        expect(result).toBe(true);
    });
});

// =============================================================================
// autoPlayLevel
// =============================================================================

describe("autoPlayLevel", () => {
    it("sets autoPlayingLevel and explores until no progress", () => {
        // Make explore return false immediately (player confused)
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Confused] = 1;

        autoPlayLevel(false, ctx);

        // After autoPlayLevel finishes, autoPlayingLevel should be false
        expect(ctx.rogue.autoPlayingLevel).toBe(false);
    });

    it("descends stairs when no more explore progress and at stairs", () => {
        const startLevelSpy = vi.fn().mockImplementation(() => {
            // Stop the loop after descending once
            ctx.rogue.autoPlayingLevel = false;
        });
        const ctx = makeCtx({ startLevel: startLevelSpy });
        ctx.player.status[StatusEffect.Confused] = 1;
        // Put player at the down stairs
        ctx.player.loc = { x: 4, y: 4 };
        ctx.rogue.downLoc = { x: 4, y: 4 };
        ctx.rogue.depthLevel = 1;

        autoPlayLevel(false, ctx);

        // Should have tried to descend stairs
        expect(startLevelSpy).toHaveBeenCalled();
    });
});
