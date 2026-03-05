/*
 *  ally-management.test.ts — Tests for ally and captive management
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    becomeAllyWith,
    freeCaptive,
    freeCaptivesEmbeddedAt,
} from "../../src/movement/ally-management.js";
import type { AllyManagementContext } from "../../src/movement/ally-management.js";
import { CreatureState, StatusEffect, TileType } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag, MonsterBookkeepingFlag, TileFlag, TerrainFlag,
} from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item } from "../../src/types/types.js";
import { tileCatalog } from "../../src/globals/tile-catalog.js";
import { NUMBER_TERRAIN_LAYERS } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
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
        creatureState: CreatureState.Wandering,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        movementSpeed: 100,
        attackSpeed: 100,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        ...overrides,
    } as Creature;
}

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

function makeCtx(overrides: Partial<AllyManagementContext> = {}): AllyManagementContext {
    const player = makeCreature({ loc: { x: 1, y: 1 } });
    return {
        player,
        pmap: [],
        demoteMonsterFromLeadership: () => {},
        makeMonsterDropItem: () => {},
        refreshDungeonCell: () => {},
        monsterName: () => "goblin",
        message: () => {},
        monsterAtLoc: () => null,
        cellHasTerrainFlag: (pos, flag) => false,
        ...overrides,
    };
}

// =============================================================================
// becomeAllyWith
// =============================================================================

describe("becomeAllyWith", () => {
    it("sets creature state to Ally", () => {
        const monst = makeCreature({ creatureState: CreatureState.Wandering });
        const ctx = makeCtx();

        becomeAllyWith(monst, ctx);

        expect(monst.creatureState).toBe(CreatureState.Ally);
    });

    it("sets MB_FOLLOWER flag", () => {
        const monst = makeCreature();
        const ctx = makeCtx();

        becomeAllyWith(monst, ctx);

        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER).toBeTruthy();
    });

    it("sets leader to player", () => {
        const monst = makeCreature();
        const ctx = makeCtx();

        becomeAllyWith(monst, ctx);

        expect(monst.leader).toBe(ctx.player);
    });

    it("clears MB_CAPTIVE and MB_SEIZED flags", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE | MonsterBookkeepingFlag.MB_SEIZED,
        });
        const ctx = makeCtx();

        becomeAllyWith(monst, ctx);

        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE).toBe(0);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED).toBe(0);
    });

    it("demotes from leadership", () => {
        const monst = makeCreature();
        const demoteSpy = vi.fn();
        const ctx = makeCtx({ demoteMonsterFromLeadership: demoteSpy });

        becomeAllyWith(monst, ctx);

        expect(demoteSpy).toHaveBeenCalledWith(monst);
    });

    it("drops carried item", () => {
        const monst = makeCreature({ carriedItem: {} as Item });
        const dropSpy = vi.fn();
        const ctx = makeCtx({ makeMonsterDropItem: dropSpy });

        becomeAllyWith(monst, ctx);

        expect(dropSpy).toHaveBeenCalledWith(monst);
    });

    it("recursively allies carried monster", () => {
        const inner = makeCreature({ creatureState: CreatureState.Fleeing });
        const outer = makeCreature({
            creatureState: CreatureState.Wandering,
            carriedMonster: inner,
        });
        const ctx = makeCtx();

        becomeAllyWith(outer, ctx);

        expect(outer.creatureState).toBe(CreatureState.Ally);
        expect(inner.creatureState).toBe(CreatureState.Ally);
    });

    it("refreshes dungeon cell", () => {
        const monst = makeCreature({ loc: { x: 3, y: 4 } });
        const refreshSpy = vi.fn();
        const ctx = makeCtx({ refreshDungeonCell: refreshSpy });

        becomeAllyWith(monst, ctx);

        expect(refreshSpy).toHaveBeenCalledWith({ x: 3, y: 4 });
    });
});

// =============================================================================
// freeCaptive
// =============================================================================

describe("freeCaptive", () => {
    it("becomes ally and sends message", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
        });
        const msgSpy = vi.fn();
        const ctx = makeCtx({
            message: msgSpy,
            monsterName: () => "kobold",
        });

        freeCaptive(monst, ctx);

        expect(monst.creatureState).toBe(CreatureState.Ally);
        expect(msgSpy).toHaveBeenCalledTimes(1);
        expect(msgSpy.mock.calls[0][0]).toContain("kobold");
        expect(msgSpy.mock.calls[0][0]).toContain("faithful ally");
    });
});

// =============================================================================
// freeCaptivesEmbeddedAt
// =============================================================================

describe("freeCaptivesEmbeddedAt", () => {
    it("returns false when no monster at location", () => {
        const pmap = [[makeCell()]];
        const ctx = makeCtx({ pmap });

        expect(freeCaptivesEmbeddedAt(0, 0, ctx)).toBe(false);
    });

    it("frees captive in obstructing terrain and returns true", () => {
        const captive = makeCreature({
            loc: { x: 0, y: 0 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
        });
        const cell = makeCell(
            [TileType.WALL, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
            TileFlag.HAS_MONSTER,
        );
        const pmap = [[cell]];
        const msgSpy = vi.fn();
        const ctx = makeCtx({
            pmap,
            monsterAtLoc: () => captive,
            cellHasTerrainFlag: (_pos, flag) =>
                !!(flag & TerrainFlag.T_OBSTRUCTS_PASSABILITY),
            message: msgSpy,
        });

        const result = freeCaptivesEmbeddedAt(0, 0, ctx);

        expect(result).toBe(true);
        expect(captive.creatureState).toBe(CreatureState.Ally);
    });

    it("does not free non-captive monsters", () => {
        const monst = makeCreature({
            loc: { x: 0, y: 0 },
            bookkeepingFlags: 0, // not captive
        });
        const cell = makeCell(
            [TileType.WALL, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
            TileFlag.HAS_MONSTER,
        );
        const pmap = [[cell]];
        const ctx = makeCtx({
            pmap,
            monsterAtLoc: () => monst,
            cellHasTerrainFlag: () => true,
        });

        expect(freeCaptivesEmbeddedAt(0, 0, ctx)).toBe(false);
    });

    it("does not free MONST_ATTACKABLE_THRU_WALLS monsters", () => {
        const monst = makeCreature({
            loc: { x: 0, y: 0 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
        });
        monst.info.flags |= MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS;

        const cell = makeCell(
            [TileType.WALL, TileType.NOTHING, TileType.NOTHING, TileType.NOTHING],
            TileFlag.HAS_MONSTER,
        );
        const pmap = [[cell]];
        const ctx = makeCtx({
            pmap,
            monsterAtLoc: () => monst,
            cellHasTerrainFlag: () => true,
        });

        expect(freeCaptivesEmbeddedAt(0, 0, ctx)).toBe(false);
    });
});
