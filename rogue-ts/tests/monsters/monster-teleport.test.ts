/*
 *  monsters/monster-teleport.test.ts — Unit tests for Phase 2c teleport functions
 *  brogue-ts
 *
 *  Covers:
 *    disentangle  (Monsters.c:1138)
 *    teleport     (Monsters.c:1146)
 */

import { describe, it, expect, vi } from "vitest";
import { disentangle, teleport } from "../../src/monsters/monster-teleport.js";
import type { DisentangleContext, TeleportContext } from "../../src/monsters/monster-teleport.js";
import type { Creature, Pos } from "../../src/types/types.js";
import { StatusEffect, MonsterType } from "../../src/types/enums.js";
import { MonsterBehaviorFlag, TerrainMechFlag } from "../../src/types/flags.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";

// =============================================================================
// Shared helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        maxStatus: new Array(StatusEffect.NumberOfStatusEffects).fill(0),
        info: {
            monsterID: 1 as MonsterType,
            monsterName: "test monster",
            displayChar: 64,
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 20,
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
        currentHP: 20,
        previousHealthPoints: 20,
        turnsUntilRegen: 0,
        poisonAmount: 0,
        weaknessAmount: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        mutationIndex: -1,
        bookkeepingFlags: 0,
        creatureState: 0,
        creatureMode: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        ticksUntilTurn: 100,
        turnsSpentStationary: 0,
        lastSeenPlayerAt: { x: 0, y: 0 },
        targetWaypointIndex: -1,
        waypointAlreadyVisited: new Array(40).fill(false),
        leader: null,
        carriedItem: null,
        carriedMonster: null,
        wasNegated: false,
        ...overrides,
    } as unknown as Creature;
}

function makeDisentangleCtx(player: Creature): DisentangleContext {
    return {
        player,
        message: vi.fn(),
    };
}

function makeTeleportCtx(player: Creature, overrides: Partial<TeleportContext> = {}): TeleportContext {
    return {
        player,
        disentangle: vi.fn(),
        calculateDistancesFrom: vi.fn(),
        getFOVMaskAt: vi.fn(),
        forbiddenFlagsForMonster: vi.fn().mockReturnValue(0),
        avoidedFlagsForMonster: vi.fn().mockReturnValue(0),
        cellHasTerrainFlag: vi.fn().mockReturnValue(false),
        cellHasTMFlag: vi.fn().mockReturnValue(false),
        getCellFlags: vi.fn().mockReturnValue(0),
        isPosInMap: (loc: Pos) => loc.x >= 0 && loc.x < DCOLS && loc.y >= 0 && loc.y < DROWS,
        setMonsterLocation: vi.fn(),
        chooseNewWanderDestination: vi.fn(),
        IS_IN_MACHINE: 0x800,
        HAS_PLAYER: 0x4,
        HAS_MONSTER: 0x8,
        HAS_STAIRS: 0x100,
        ...overrides,
    };
}

// =============================================================================
// disentangle
// =============================================================================

describe("disentangle", () => {
    it("clears STATUS_STUCK on any creature", () => {
        const player = makeCreature();
        const ctx = makeDisentangleCtx(player);
        const monst = makeCreature();
        monst.status[StatusEffect.Stuck] = 5;

        disentangle(monst, ctx);

        expect(monst.status[StatusEffect.Stuck]).toBe(0);
    });

    it("prints 'you break free!' when player was stuck", () => {
        const player = makeCreature();
        player.status[StatusEffect.Stuck] = 3;
        const ctx = makeDisentangleCtx(player);

        disentangle(player, ctx);

        expect(ctx.message).toHaveBeenCalledWith("you break free!", 0);
        expect(player.status[StatusEffect.Stuck]).toBe(0);
    });

    it("does not print message when player was not stuck", () => {
        const player = makeCreature();
        player.status[StatusEffect.Stuck] = 0;
        const ctx = makeDisentangleCtx(player);

        disentangle(player, ctx);

        expect(ctx.message).not.toHaveBeenCalled();
    });

    it("does not print message when a non-player creature is stuck", () => {
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        const ctx = makeDisentangleCtx(player);
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        monst.status[StatusEffect.Stuck] = 4;

        disentangle(monst, ctx);

        expect(ctx.message).not.toHaveBeenCalled();
        expect(monst.status[StatusEffect.Stuck]).toBe(0);
    });
});

// =============================================================================
// teleport — known destination
// =============================================================================

describe("teleport — known destination", () => {
    it("calls disentangle and setMonsterLocation when destination is valid", () => {
        const player = makeCreature();
        const ctx = makeTeleportCtx(player);
        const dest = { x: 20, y: 15 };

        teleport(player, dest, false, ctx);

        expect(ctx.disentangle).toHaveBeenCalledWith(player);
        expect(ctx.setMonsterLocation).toHaveBeenCalledWith(player, dest);
    });

    it("does not call chooseNewWanderDestination for the player", () => {
        const player = makeCreature();
        const ctx = makeTeleportCtx(player);

        teleport(player, { x: 20, y: 15 }, false, ctx);

        expect(ctx.chooseNewWanderDestination).not.toHaveBeenCalled();
    });

    it("calls chooseNewWanderDestination for a non-player monster", () => {
        const player = makeCreature({ loc: { x: 1, y: 1 } });
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        const ctx = makeTeleportCtx(player);

        teleport(monst, { x: 20, y: 15 }, false, ctx);

        expect(ctx.chooseNewWanderDestination).toHaveBeenCalledWith(monst);
    });

    it("does not call calculateDistancesFrom when destination is given", () => {
        const player = makeCreature();
        const ctx = makeTeleportCtx(player);

        teleport(player, { x: 20, y: 15 }, false, ctx);

        expect(ctx.calculateDistancesFrom).not.toHaveBeenCalled();
        expect(ctx.getFOVMaskAt).not.toHaveBeenCalled();
    });
});

// =============================================================================
// teleport — random destination (INVALID_POS)
// =============================================================================

describe("teleport — random destination", () => {
    function makeCtxWithValidCell(player: Creature, cellX: number, cellY: number): TeleportContext {
        // calculateDistancesFrom sets one cell to distance 60 (> DCOLS/2)
        return makeTeleportCtx(player, {
            calculateDistancesFrom: vi.fn().mockImplementation((grid: number[][]) => {
                grid[cellX][cellY] = 60;
            }),
        });
    }

    it("calls calculateDistancesFrom and getFOVMaskAt when destination is out of map", () => {
        const player = makeCreature();
        const ctx = makeCtxWithValidCell(player, 60, 20);

        teleport(player, { x: -1, y: -1 }, false, ctx);

        expect(ctx.calculateDistancesFrom).toHaveBeenCalled();
        expect(ctx.getFOVMaskAt).toHaveBeenCalled();
    });

    it("moves creature to the found destination", () => {
        const player = makeCreature();
        const ctx = makeCtxWithValidCell(player, 60, 20);

        teleport(player, { x: -1, y: -1 }, false, ctx);

        expect(ctx.setMonsterLocation).toHaveBeenCalledWith(player, { x: 60, y: 20 });
        expect(ctx.disentangle).toHaveBeenCalledWith(player);
    });

    it("calls forbiddenFlagsForMonster to build the distance block flags", () => {
        const player = makeCreature();
        const ctx = makeCtxWithValidCell(player, 60, 20);

        teleport(player, { x: -1, y: -1 }, false, ctx);

        expect(ctx.forbiddenFlagsForMonster).toHaveBeenCalledWith(player.info);
    });

    it("does not move creature when all candidate cells are visible to the monster", () => {
        const player = makeCreature();
        // FOV mask marks every cell as visible → all candidates get cleared to 0
        const ctx = makeTeleportCtx(player, {
            getFOVMaskAt: vi.fn().mockImplementation((grid: number[][]) => {
                for (let i = 0; i < DCOLS; i++) {
                    for (let j = 0; j < DROWS; j++) {
                        grid[i][j] = 1;
                    }
                }
            }),
        });

        teleport(player, { x: -1, y: -1 }, false, ctx);

        expect(ctx.setMonsterLocation).not.toHaveBeenCalled();
        expect(ctx.disentangle).not.toHaveBeenCalled();
    });

    it("uses avoidedFlagsForMonster when safe=true", () => {
        const player = makeCreature();
        const ctx = makeCtxWithValidCell(player, 60, 20);

        teleport(player, { x: -1, y: -1 }, true, ctx);

        expect(ctx.avoidedFlagsForMonster).toHaveBeenCalledWith(player.info);
    });

    it("uses forbiddenFlagsForMonster (not avoided) when safe=false", () => {
        const player = makeCreature();
        const ctx = makeCtxWithValidCell(player, 60, 20);

        teleport(player, { x: -1, y: -1 }, false, ctx);

        // avoidedFlagsForMonster is called for forbiddenFlags computation only
        // (not for terrain filtering — that uses forbiddenFlagsForMonster)
        expect(ctx.avoidedFlagsForMonster).not.toHaveBeenCalled();
    });

    it("uses submerging terrain filter for MONST_RESTRICTED_TO_LIQUID when safe=true", () => {
        const player = makeCreature();
        player.info.flags |= MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID;
        let liquidCellQueried = false;
        const ctx = makeTeleportCtx(player, {
            calculateDistancesFrom: vi.fn().mockImplementation((grid: number[][]) => {
                grid[60][20] = 60;
            }),
            cellHasTMFlag: vi.fn().mockImplementation(
                (loc: Pos, flags: number) => {
                    if (flags & TerrainMechFlag.TM_ALLOWS_SUBMERGING) {
                        liquidCellQueried = true;
                        return loc.x === 60 && loc.y === 20;
                    }
                    return false;
                },
            ),
        });

        teleport(player, { x: -1, y: -1 }, true, ctx);

        expect(liquidCellQueried).toBe(true);
    });
});
