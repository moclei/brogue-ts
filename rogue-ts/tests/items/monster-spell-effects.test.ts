/*
 *  monster-spell-effects.test.ts — Unit tests for Phase 2b spell effects
 *  brogue-ts
 *
 *  Covers:
 *    polymorph      (Items.c:3841)
 *    aggravateMonsters (Items.c:3358)
 *    crystalize     (Items.c:4150)
 *    summonGuardian (Items.c:6651)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    polymorph,
    aggravateMonsters,
    crystalize,
    summonGuardian,
} from "../../src/items/monster-spell-effects.js";
import type {
    PolymorphContext,
    AggravateContext,
    CrystalizeContext,
    SummonGuardianContext,
} from "../../src/items/monster-spell-effects.js";
import type { Creature, CreatureType, Pcell, Pos } from "../../src/types/types.js";
import { StatusEffect, CreatureState, CreatureMode, MonsterType, DungeonLayer, TileType } from "../../src/types/enums.js";
import { MonsterBehaviorFlag, MonsterAbilityFlag, MonsterBookkeepingFlag, TileFlag } from "../../src/types/flags.js";
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
        turnsSpentStationary: 0,
        creatureState: CreatureState.TrackingScent,
        creatureMode: CreatureMode.Normal,
        bookkeepingFlags: 0,
        ticksUntilTurn: 50,
        spawnDepth: 1,
        movementSpeed: 100,
        attackSpeed: 100,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        mutationIndex: -1,
        wasNegated: false,
        weaknessAmount: 0,
        ...overrides,
    } as Creature;
}

function makeCreatureType(id: number, flags = 0): CreatureType {
    return {
        monsterID: id as MonsterType,
        monsterName: `monster-${id}`,
        displayChar: 64 + id,
        foreColor: { red: 50, green: 50, blue: 50, rand: 0, colorDances: false },
        maxHP: 15,
        turnsBetweenRegen: 40,
        movementSpeed: 100,
        attackSpeed: 100,
        damage: { lowerBound: 1, upperBound: 2, clumpFactor: 1 },
        accuracy: 80,
        defense: 0,
        DFChance: 0,
        DFType: 0,
        bloodType: 0,
        lightType: 0,
        intrinsicLightType: 0,
        flags,
        abilityFlags: 0,
        bolts: [],
        isLarge: false,
    } as CreatureType;
}

function makeEmptyPmap(): Pcell[][] {
    const pmap: Pcell[][] = [];
    for (let i = 0; i < DCOLS; i++) {
        pmap[i] = [];
        for (let j = 0; j < DROWS; j++) {
            pmap[i][j] = {
                layers: [TileType.FLOOR, 0, 0, 0],
                flags: 0,
                volume: 0,
                machineNumber: 0,
            } as unknown as Pcell;
        }
    }
    return pmap;
}

// =============================================================================
// polymorph — Items.c:3841
// =============================================================================

describe("polymorph", () => {
    function makeCtx(overrides: Partial<PolymorphContext> = {}): PolymorphContext {
        const catalog: CreatureType[] = [
            makeCreatureType(0), // slot 0 — unused
            makeCreatureType(1), // current monst kind — will be skipped by loop
            makeCreatureType(2), // new kind — what randRange picks
        ];

        return {
            player: makeCreature({ loc: { x: 0, y: 0 } }),
            monsterCatalog: catalog,
            boltCatalog: [],
            randRange: vi.fn().mockReturnValue(2),
            unAlly: vi.fn(),
            freeCreature: vi.fn(),
            initializeStatus: vi.fn(),
            demoteMonsterFromLeadership: vi.fn(),
            refreshDungeonCell: vi.fn(),
            flashMonster: vi.fn(),
            ...overrides,
        };
    }

    it("returns false for the player", () => {
        const player = makeCreature({ loc: { x: 3, y: 3 } });
        const ctx = makeCtx({ player });
        expect(polymorph(player, ctx)).toBe(false);
    });

    it("returns false for inanimate monsters", () => {
        const monst = makeCreature();
        monst.info.flags = MonsterBehaviorFlag.MONST_INANIMATE;
        const ctx = makeCtx();
        expect(polymorph(monst, ctx)).toBe(false);
    });

    it("returns false for invulnerable monsters", () => {
        const monst = makeCreature();
        monst.info.flags = MonsterBehaviorFlag.MONST_INVULNERABLE;
        const ctx = makeCtx();
        expect(polymorph(monst, ctx)).toBe(false);
    });

    it("changes monst.info to the new catalog entry", () => {
        const monst = makeCreature();
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        const result = polymorph(monst, ctx);
        expect(result).toBe(true);
        expect(monst.info.monsterID).toBe(2);
    });

    it("clears mutationIndex to -1", () => {
        const monst = makeCreature({ mutationIndex: 3 });
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(monst.mutationIndex).toBe(-1);
    });

    it("calls unAlly and initializeStatus", () => {
        const monst = makeCreature();
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(ctx.unAlly).toHaveBeenCalledWith(monst);
        expect(ctx.initializeStatus).toHaveBeenCalledWith(monst);
    });

    it("frees carriedMonster and clears it", () => {
        const carried = makeCreature({ loc: { x: 6, y: 6 } });
        const monst = makeCreature({ carriedMonster: carried });
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(ctx.freeCreature).toHaveBeenCalledWith(carried);
        expect(monst.carriedMonster).toBeNull();
    });

    it("clears MB_CAPTIVE and calls demoteMonsterFromLeadership", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_CAPTIVE,
            creatureState: CreatureState.Sleeping,
        });
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(ctx.demoteMonsterFromLeadership).toHaveBeenCalledWith(monst);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE).toBe(0);
    });

    it("clears MB_SEIZING and MB_SEIZED flags", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_SEIZING | MonsterBookkeepingFlag.MB_SEIZED,
        });
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING).toBe(0);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED).toBe(0);
    });

    it("preserves health fraction (50% hp → 50% of new maxHP)", () => {
        const monst = makeCreature({ currentHP: 10 }); // 10/20 = 50%
        monst.info.monsterID = 1 as MonsterType;
        monst.info.maxHP = 20;
        // new type has maxHP 15 → 50% = 7 (floor)
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(monst.currentHP).toBeGreaterThanOrEqual(1);
        expect(monst.currentHP).toBeLessThanOrEqual(15);
    });

    it("calls refreshDungeonCell and flashMonster", () => {
        const monst = makeCreature();
        monst.info.monsterID = 1 as MonsterType;
        const backColor = { red: 200, green: 50, blue: 100, rand: 0, colorDances: false };
        const ctx = makeCtx({
            boltCatalog: Array(50).fill(null).map(() => ({
                backColor,
                foreColor: backColor,
            })) as never,
        });
        polymorph(monst, ctx);
        expect(ctx.refreshDungeonCell).toHaveBeenCalledWith(monst.loc);
    });

    it("resets fleeing state for MAINTAINS_DISTANCE monsters", () => {
        const monst = makeCreature({
            creatureState: CreatureState.Fleeing,
            creatureMode: CreatureMode.Normal,
        });
        monst.info.flags = MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE;
        monst.info.monsterID = 1 as MonsterType;
        const ctx = makeCtx();
        polymorph(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });
});

// =============================================================================
// aggravateMonsters — Items.c:3358
// =============================================================================

describe("aggravateMonsters", () => {
    const red = { red: 255, green: 0, blue: 0, rand: 0, colorDances: false };

    function makeCtx(
        player: Creature,
        monsters: Creature[],
        distanceGrid?: number[][],
        overrides: Partial<AggravateContext> = {},
    ): AggravateContext {
        // Default: all cells at distance 0 (qualify for any range).
        const grid: number[][] = distanceGrid ?? (() => {
            const g: number[][] = [];
            for (let i = 0; i < DCOLS; i++) {
                g[i] = new Array(DROWS).fill(0);
            }
            return g;
        })();

        return {
            player,
            monsters,
            scentMap: (() => {
                const s: number[][] = [];
                for (let i = 0; i < DCOLS; i++) s[i] = new Array(DROWS).fill(5);
                return s;
            })(),
            getPathDistances: vi.fn().mockReturnValue(grid),
            refreshWaypoint: vi.fn(),
            wakeUp: vi.fn(),
            alertMonster: vi.fn(),
            addScentToCell: vi.fn(),
            setStealthRange: vi.fn(),
            currentStealthRange: vi.fn().mockReturnValue(14),
            discover: vi.fn(),
            discoverCell: vi.fn(),
            colorFlash: vi.fn(),
            playerCanSee: vi.fn().mockReturnValue(true),
            message: vi.fn(),
            ...overrides,
        };
    }

    it("calls refreshWaypoint at (x, y)", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const ctx = makeCtx(player, []);
        aggravateMonsters(20, 3, 4, red, ctx);
        expect(ctx.refreshWaypoint).toHaveBeenCalledWith(3, 4);
    });

    it("wakes sleeping monsters within range", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const monst = makeCreature({
            loc: { x: 3, y: 3 },
            creatureState: CreatureState.Sleeping,
        });
        const ctx = makeCtx(player, [monst]);
        aggravateMonsters(20, 2, 2, red, ctx);
        expect(ctx.wakeUp).toHaveBeenCalledWith(monst);
    });

    it("alerts non-ally monsters within range", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        const ctx = makeCtx(player, [monst]);
        aggravateMonsters(20, 2, 2, red, ctx);
        expect(ctx.alertMonster).toHaveBeenCalledWith(monst);
    });

    it("does NOT alert an ally monster", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const monst = makeCreature({
            loc: { x: 3, y: 3 },
            creatureState: CreatureState.Ally,
        });
        const ctx = makeCtx(player, [monst]);
        aggravateMonsters(20, 2, 2, red, ctx);
        expect(ctx.alertMonster).not.toHaveBeenCalled();
    });

    it("does NOT wake monsters beyond range", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const monst = makeCreature({
            loc: { x: 3, y: 3 },
            creatureState: CreatureState.Sleeping,
        });
        // Put monst at distance 999 > range 5.
        const grid: number[][] = [];
        for (let i = 0; i < DCOLS; i++) grid[i] = new Array(DROWS).fill(0);
        grid[3][3] = 999;
        const ctx = makeCtx(player, [monst], grid);
        aggravateMonsters(5, 2, 2, red, ctx);
        expect(ctx.wakeUp).not.toHaveBeenCalled();
    });

    it("sets STATUS_Aggravating on the player when they stand at (x, y)", () => {
        const player = makeCreature({ loc: { x: 3, y: 4 } });
        const ctx = makeCtx(player, []);
        aggravateMonsters(10, 3, 4, red, ctx);
        expect(player.status[StatusEffect.Aggravating]).toBe(10);
        expect(player.maxStatus[StatusEffect.Aggravating]).toBe(10);
        expect(ctx.setStealthRange).toHaveBeenCalled();
    });

    it("calls colorFlash when player is within range", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const ctx = makeCtx(player, []);
        aggravateMonsters(20, 2, 2, red, ctx);
        expect(ctx.colorFlash).toHaveBeenCalled();
    });

    it("clears MONST_MAINTAINS_DISTANCE from woken monsters", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const monst = makeCreature({ loc: { x: 3, y: 3 } });
        monst.info.flags = MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE;
        const ctx = makeCtx(player, [monst]);
        aggravateMonsters(20, 2, 2, red, ctx);
        expect(monst.info.flags & MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE).toBe(0);
    });

    it("zeroes scentMap cells within range", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        // All cells at distance 0 → within any range.
        const ctx = makeCtx(player, []);
        aggravateMonsters(20, 0, 0, red, ctx);
        // addScentToCell should have been called for many cells.
        expect(ctx.addScentToCell).toHaveBeenCalled();
    });

    it("posts an audio message when player cannot see origin", () => {
        const player = makeCreature({ loc: { x: 2, y: 2 } });
        const ctx = makeCtx(player, [], undefined, {
            playerCanSee: vi.fn().mockReturnValue(false),
        });
        aggravateMonsters(20, 5, 5, red, ctx);
        expect(ctx.message).toHaveBeenCalledWith(
            expect.stringContaining("piercing shriek"),
            0,
        );
    });
});

// =============================================================================
// crystalize — Items.c:4150
// =============================================================================

describe("crystalize", () => {
    function makeCtx(pmap: Pcell[][], player: Creature, overrides: Partial<CrystalizeContext> = {}): CrystalizeContext {
        return {
            player,
            pmap,
            spawnDungeonFeature: vi.fn(),
            monsterAtLoc: vi.fn().mockReturnValue(null),
            inflictLethalDamage: vi.fn(),
            killCreature: vi.fn(),
            freeCaptivesEmbeddedAt: vi.fn(),
            updateVision: vi.fn(),
            colorFlash: vi.fn(),
            displayLevel: vi.fn(),
            refreshSideBar: vi.fn(),
            forceFieldColor: { red: 0, green: 200, blue: 255, rand: 0, colorDances: false },
            ...overrides,
        };
    }

    function setWall(pmap: Pcell[][], x: number, y: number): void {
        // tileCatalog[WALL] has T_OBSTRUCTS_PASSABILITY; use TileType.WALL (1).
        pmap[x][y].layers[DungeonLayer.Dungeon] = TileType.WALL;
    }

    it("converts wall tiles within radius to FORCEFIELD", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 10, y: 10 } });
        setWall(pmap, 10, 11); // distance 1 from player
        const ctx = makeCtx(pmap, player);
        crystalize(5, ctx);
        expect(ctx.spawnDungeonFeature).toHaveBeenCalled();
    });

    it("does not convert cells outside radius", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        setWall(pmap, 20, 20); // far away
        const ctx = makeCtx(pmap, player);
        crystalize(3, ctx);
        // spawnDungeonFeature should NOT have been called for (20,20).
        const calls = (ctx.spawnDungeonFeature as ReturnType<typeof vi.fn>).mock.calls;
        for (const [cx, cy] of calls) {
            const dx = 5 - cx;
            const dy = 5 - cy;
            expect(dx * dx + dy * dy).toBeLessThanOrEqual(9); // 3*3
        }
    });

    it("skips IMPREGNABLE cells", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        pmap[5][6].layers[DungeonLayer.Dungeon] = TileType.WALL;
        pmap[5][6].flags = TileFlag.IMPREGNABLE;
        const ctx = makeCtx(pmap, player);
        crystalize(5, ctx);
        // No call for (5,6).
        const calls = (ctx.spawnDungeonFeature as ReturnType<typeof vi.fn>).mock.calls;
        for (const [cx, cy] of calls) {
            expect(!(cx === 5 && cy === 6)).toBe(true);
        }
    });

    it("kills ATTACKABLE_THRU_WALLS monsters embedded in new crystal", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        setWall(pmap, 5, 6);
        pmap[5][6].flags = TileFlag.HAS_MONSTER;
        const embeddedMonst = makeCreature({ loc: { x: 5, y: 6 } });
        embeddedMonst.info.flags = MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS;
        const ctx = makeCtx(pmap, player, {
            monsterAtLoc: vi.fn().mockReturnValue(embeddedMonst),
        });
        crystalize(5, ctx);
        expect(ctx.inflictLethalDamage).toHaveBeenCalledWith(null, embeddedMonst);
        expect(ctx.killCreature).toHaveBeenCalledWith(embeddedMonst, false);
    });

    it("frees non-attackable-thru-walls monsters", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        setWall(pmap, 5, 6);
        pmap[5][6].flags = TileFlag.HAS_MONSTER;
        const embeddedMonst = makeCreature({ loc: { x: 5, y: 6 } });
        embeddedMonst.info.flags = 0; // not ATTACKABLE_THRU_WALLS
        const ctx = makeCtx(pmap, player, {
            monsterAtLoc: vi.fn().mockReturnValue(embeddedMonst),
        });
        crystalize(5, ctx);
        expect(ctx.freeCaptivesEmbeddedAt).toHaveBeenCalledWith(5, 6);
    });

    it("calls updateVision, colorFlash, displayLevel, refreshSideBar", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        const ctx = makeCtx(pmap, player);
        crystalize(1, ctx);
        expect(ctx.updateVision).toHaveBeenCalledWith(false);
        expect(ctx.colorFlash).toHaveBeenCalled();
        expect(ctx.displayLevel).toHaveBeenCalled();
        expect(ctx.refreshSideBar).toHaveBeenCalled();
    });

    it("converts boundary walls within radius to CRYSTAL_WALL", () => {
        const pmap = makeEmptyPmap();
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        // Place a wall at the top boundary row within a large radius.
        setWall(pmap, 5, 0);
        const ctx = makeCtx(pmap, player);
        crystalize(10, ctx);
        // Boundary cells (row 0) should become CRYSTAL_WALL.
        expect(pmap[5][0].layers[DungeonLayer.Dungeon]).toBe(TileType.CRYSTAL_WALL);
    });
});

// =============================================================================
// summonGuardian — Items.c:6651
// =============================================================================

describe("summonGuardian", () => {
    const fp1 = 1n << 16n; // a nominal Fixpt value (1.0)

    function makeCtx(overrides: Partial<SummonGuardianContext> = {}): SummonGuardianContext {
        const guardian = makeCreature({ loc: { x: 6, y: 6 } });
        guardian.info.attackSpeed = 100;
        return {
            player: makeCreature({ loc: { x: 5, y: 5 } }),
            pmap: makeEmptyPmap(),
            generateMonster: vi.fn().mockReturnValue(guardian),
            getQualifyingPathLocNear: vi.fn().mockReturnValue({ x: 6, y: 6 }),
            charmGuardianLifespan: vi.fn().mockReturnValue(150),
            netEnchant: vi.fn().mockReturnValue(fp1),
            fadeInMonster: vi.fn(),
            ...overrides,
        };
    }

    it("generates MK_CHARM_GUARDIAN", () => {
        const item = { enchant1: fp1 } as never;
        const ctx = makeCtx();
        summonGuardian(item, ctx);
        expect(ctx.generateMonster).toHaveBeenCalledWith(MonsterType.MK_CHARM_GUARDIAN, false, false);
    });

    it("sets guardian as an ally of the player", () => {
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        const guardian = makeCreature({ loc: { x: 6, y: 6 } });
        guardian.info.attackSpeed = 100;
        const item = {} as never;
        const ctx = makeCtx({
            player,
            generateMonster: vi.fn().mockReturnValue(guardian),
        });
        summonGuardian(item, ctx);
        expect(guardian.creatureState).toBe(CreatureState.Ally);
        expect(guardian.leader).toBe(player);
    });

    it("sets MB_FOLLOWER | MB_BOUND_TO_LEADER | MB_DOES_NOT_TRACK_LEADER flags", () => {
        const guardian = makeCreature({ loc: { x: 6, y: 6 } });
        guardian.info.attackSpeed = 100;
        const item = {} as never;
        const ctx = makeCtx({ generateMonster: vi.fn().mockReturnValue(guardian) });
        summonGuardian(item, ctx);
        expect(guardian.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER).toBeTruthy();
        expect(guardian.bookkeepingFlags & MonsterBookkeepingFlag.MB_BOUND_TO_LEADER).toBeTruthy();
        expect(guardian.bookkeepingFlags & MonsterBookkeepingFlag.MB_DOES_NOT_TRACK_LEADER).toBeTruthy();
    });

    it("sets lifespan via charmGuardianLifespan(netEnchant(item))", () => {
        const guardian = makeCreature({ loc: { x: 6, y: 6 } });
        guardian.info.attackSpeed = 100;
        const item = {} as never;
        const ctx = makeCtx({ generateMonster: vi.fn().mockReturnValue(guardian) });
        summonGuardian(item, ctx);
        expect(ctx.netEnchant).toHaveBeenCalledWith(item);
        expect(ctx.charmGuardianLifespan).toHaveBeenCalledWith(fp1);
        expect(guardian.status[StatusEffect.LifespanRemaining]).toBe(150);
        expect(guardian.maxStatus[StatusEffect.LifespanRemaining]).toBe(150);
    });

    it("marks guardian cell with HAS_MONSTER flag", () => {
        const pmap = makeEmptyPmap();
        const guardian = makeCreature({ loc: { x: 6, y: 6 } });
        guardian.info.attackSpeed = 100;
        const item = {} as never;
        const ctx = makeCtx({
            pmap,
            generateMonster: vi.fn().mockReturnValue(guardian),
            getQualifyingPathLocNear: vi.fn().mockReturnValue({ x: 6, y: 6 }),
        });
        summonGuardian(item, ctx);
        expect(pmap[6][6].flags & TileFlag.HAS_MONSTER).toBeTruthy();
    });

    it("calls fadeInMonster on the guardian", () => {
        const guardian = makeCreature({ loc: { x: 6, y: 6 } });
        guardian.info.attackSpeed = 100;
        const item = {} as never;
        const ctx = makeCtx({ generateMonster: vi.fn().mockReturnValue(guardian) });
        summonGuardian(item, ctx);
        expect(ctx.fadeInMonster).toHaveBeenCalledWith(guardian);
    });

    it("clears MB_JUST_SUMMONED from bookkeepingFlags", () => {
        const guardian = makeCreature({
            loc: { x: 6, y: 6 },
            bookkeepingFlags: MonsterBookkeepingFlag.MB_JUST_SUMMONED,
        });
        guardian.info.attackSpeed = 100;
        const item = {} as never;
        const ctx = makeCtx({ generateMonster: vi.fn().mockReturnValue(guardian) });
        summonGuardian(item, ctx);
        expect(guardian.bookkeepingFlags & MonsterBookkeepingFlag.MB_JUST_SUMMONED).toBe(0);
    });
});
