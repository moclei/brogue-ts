/*
 *  items/targeting.test.ts — Tests for hiliteTrajectory and playerCancelsBlinking
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    hiliteTrajectory,
    playerCancelsBlinking,
    type HiliteTrajectoryContext,
    type PlayerCancelsBlinkingContext,
} from "../../src/items/targeting.js";
import { BoltEffect, StatusEffect, DisplayGlyph } from "../../src/types/enums.js";
import {
    BoltFlag, TileFlag, TerrainFlag, TerrainMechFlag,
    MonsterBookkeepingFlag,
} from "../../src/types/flags.js";
import type { Bolt, Color, Creature, Pcell, Pos } from "../../src/types/types.js";

// =============================================================================
// Minimal helpers
// =============================================================================

function pos(x: number, y: number): Pos { return { x, y }; }
const color: Readonly<Color> = { red: 100, green: 100, blue: 0, rand: 0, colorDances: false };

function makeCreature(x = 5, y = 5): Creature {
    return {
        loc: { x, y },
        info: {
            monsterName: "goblin", flags: 0, abilityFlags: 0,
            maxHP: 10, movementSpeed: 100, attackSpeed: 100,
            bolts: [], damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            defense: 0, accuracy: 100, turnsBetweenRegen: 20,
            bloodType: 0, intrinsicLightType: 0, DFChance: 0, DFType: 0,
            displayChar: "g" as DisplayGlyph,
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
        },
        currentHP: 10,
        movementSpeed: 100, attackSpeed: 100,
        turnsUntilRegen: 20, regenPerTurn: 0, ticksUntilTurn: 0,
        previousHealthPoints: 10, creatureState: 0, creatureMode: 0,
        mutationIndex: -1, bookkeepingFlags: 0, spawnDepth: 1,
        status: new Array(30).fill(0), maxStatus: new Array(30).fill(0),
        turnsSpentStationary: 0, flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
        targetCorpseLoc: { x: -1, y: -1 }, corpseAbsorptionCounter: -1,
        targetWaypointIndex: -1, waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: -1, y: -1 }, depth: 1,
        carriedItem: null, carriedMonster: null, leader: null,
        mapToMe: null, safetyMap: null,
        weaknessAmount: 0, poisonAmount: 0, wasNegated: false,
        absorptionFlags: 0, absorbBehavior: false, absorptionBolt: 0,
        xpxp: 0, newPowerCount: 0, totalPowerCount: 0, machineHome: 0,
        targetCorpseName: "",
    } as Creature;
}

function makeCell(flags = 0): Pcell {
    return {
        flags,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        rememberedCellFlags: flags,
        rememberedTerrainType: 0,
        rememberedTileType: 0,
        rememberedBkgnd: 0,
        rememberedDisplayChar: 0 as DisplayGlyph,
        currentTerrain: 0,
        currentBkgnd: 0,
        layers: [0, 0, 0],
        volume: 0,
        machineNumber: 0,
        dpHPlusOne: 0,
        rogue: 0,
    } as unknown as Pcell;
}

/** Create a pmap (default 20×20) with all cells having the given flags. */
function makePmap(width = 20, height = 20, defaultFlags = TileFlag.DISCOVERED): Pcell[][] {
    return Array.from({ length: width }, () =>
        Array.from({ length: height }, () => makeCell(defaultFlags)),
    );
}

/**
 * Create a full-size DCOLS×DROWS pmap for tests that call getImpactLoc
 * with unlimited range (bolt traces to the map edge).
 */
function makeFullPmap(defaultFlags = TileFlag.DISCOVERED): Pcell[][] {
    return makePmap(79, 29, defaultFlags);
}

function makeBolt(overrides: Partial<Bolt> = {}): Bolt {
    return {
        name: "test bolt", description: "test", abilityDescription: "test",
        theChar: 0 as DisplayGlyph, foreColor: null, backColor: null,
        boltEffect: BoltEffect.Damage, magnitude: 5,
        pathDF: 0, targetDF: 0, forbiddenMonsterFlags: 0, flags: 0,
        ...overrides,
    } as Bolt;
}

// =============================================================================
// HiliteTrajectoryContext factory
// =============================================================================

function makeHiliteCtx(
    pmap: Pcell[][],
    player: Creature,
    overrides: Partial<HiliteTrajectoryContext> = {},
): HiliteTrajectoryContext {
    return {
        pmap,
        player,
        hiliteCell: vi.fn(),
        refreshDungeonCell: vi.fn(),
        playerCanSee: () => true,
        monsterAtLoc: () => null,
        monsterIsHidden: () => false,
        cellHasTerrainFlag: () => false,
        ...overrides,
    };
}

// =============================================================================
// hiliteTrajectory
// =============================================================================

describe("hiliteTrajectory", () => {
    it("returns 0 for empty path", () => {
        const pmap = makePmap();
        const player = makeCreature();
        const ctx = makeHiliteCtx(pmap, player);
        expect(hiliteTrajectory([], 0, false, null, color, ctx)).toBe(0);
    });

    it("highlight mode calls hiliteCell for each traversed cell", () => {
        const pmap = makePmap(); // all DISCOVERED, no obstacles
        const player = makeCreature();
        const hiliteCell = vi.fn();
        const ctx = makeHiliteCtx(pmap, player, { hiliteCell });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        hiliteTrajectory(path, 3, false, null, color, ctx);
        expect(hiliteCell).toHaveBeenCalledTimes(3);
        expect(hiliteCell).toHaveBeenCalledWith(1, 1, color, 20, true);
    });

    it("erase mode calls refreshDungeonCell (not hiliteCell)", () => {
        const pmap = makePmap();
        const player = makeCreature();
        const hiliteCell = vi.fn();
        const refreshDungeonCell = vi.fn();
        const ctx = makeHiliteCtx(pmap, player, { hiliteCell, refreshDungeonCell });
        const path = [pos(1, 1), pos(2, 1)];
        hiliteTrajectory(path, 2, true, null, color, ctx);
        expect(hiliteCell).not.toHaveBeenCalled();
        expect(refreshDungeonCell).toHaveBeenCalledTimes(2);
    });

    it("stops at undiscovered cell (non-tunneling) — returns 0", () => {
        const pmap = makePmap(20, 20, 0); // flags=0, not DISCOVERED
        const player = makeCreature();
        const ctx = makeHiliteCtx(pmap, player);
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Undiscovered, non-tunneling: break on first cell (no i++ before break) → i=0
        expect(hiliteTrajectory(path, 3, false, null, color, ctx)).toBe(0);
    });

    it("tunneling bolt continues past undiscovered cells", () => {
        // First cell undiscovered, rest discovered, no obstacles
        const pmap = makePmap();
        pmap[1][1].flags = 0; // undiscovered
        const player = makeCreature();
        const bolt = makeBolt({ boltEffect: BoltEffect.Tunneling });
        const ctx = makeHiliteCtx(pmap, player);
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Tunneling: continue past undiscovered → all 3 cells traversed
        expect(hiliteTrajectory(path, 3, false, bolt, color, ctx)).toBe(3);
    });

    it("stops at visible non-submerged monster and returns i+1", () => {
        const pmap = makePmap();
        pmap[3][1].flags |= TileFlag.HAS_MONSTER;
        const player = makeCreature(0, 0);
        const monst = makeCreature(3, 1);
        const ctx = makeHiliteCtx(pmap, player, {
            monsterAtLoc: (loc) => (loc.x === 3 && loc.y === 1 ? monst : null),
            playerCanSee: () => true,
            monsterIsHidden: () => false,
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1), pos(4, 1)];
        // Monster at i=2 (index 2): i++ → returns 3
        expect(hiliteTrajectory(path, 4, false, null, color, ctx)).toBe(3);
    });

    it("does not stop at submerged monster", () => {
        const pmap = makePmap();
        pmap[2][1].flags |= TileFlag.HAS_MONSTER;
        const player = makeCreature(0, 0);
        const monst = makeCreature(2, 1);
        monst.bookkeepingFlags = MonsterBookkeepingFlag.MB_SUBMERGED;
        const ctx = makeHiliteCtx(pmap, player, {
            monsterAtLoc: (loc) => (loc.x === 2 && loc.y === 1 ? monst : null),
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Submerged → does not block → all 3 cells
        expect(hiliteTrajectory(path, 3, false, null, color, ctx)).toBe(3);
    });

    it("does not stop at hidden monster", () => {
        const pmap = makePmap();
        pmap[2][1].flags |= TileFlag.HAS_MONSTER;
        const player = makeCreature(0, 0);
        const monst = makeCreature(2, 1);
        const ctx = makeHiliteCtx(pmap, player, {
            monsterAtLoc: (loc) => (loc.x === 2 && loc.y === 1 ? monst : null),
            monsterIsHidden: () => true,
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        expect(hiliteTrajectory(path, 3, false, null, color, ctx)).toBe(3);
    });

    it("passesThroughCreatures bolt ignores visible monsters", () => {
        const pmap = makePmap();
        pmap[2][1].flags |= TileFlag.HAS_MONSTER;
        const player = makeCreature(0, 0);
        const monst = makeCreature(2, 1);
        const bolt = makeBolt({ flags: BoltFlag.BF_PASSES_THRU_CREATURES });
        const ctx = makeHiliteCtx(pmap, player, {
            monsterAtLoc: (loc) => (loc.x === 2 ? monst : null),
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        expect(hiliteTrajectory(path, 3, false, bolt, color, ctx)).toBe(3);
    });

    it("continues past flammable terrain with fiery bolt", () => {
        const pmap = makePmap();
        const player = makeCreature();
        const bolt = makeBolt({ flags: BoltFlag.BF_FIERY });
        const ctx = makeHiliteCtx(pmap, player, {
            // cell (2,1) is flammable, no vision/passability obstruction
            cellHasTerrainFlag: (loc, flags) =>
                loc.x === 2 && (flags & TerrainFlag.T_IS_FLAMMABLE) !== 0,
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Flammable + fiery → continue → all 3 cells
        expect(hiliteTrajectory(path, 3, false, bolt, color, ctx)).toBe(3);
    });

    it("stops at wall (T_OBSTRUCTS_PASSABILITY) for non-tunneling bolt", () => {
        const pmap = makePmap();
        const player = makeCreature();
        const ctx = makeHiliteCtx(pmap, player, {
            cellHasTerrainFlag: (loc, flags) =>
                loc.x === 2 && (flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Wall at i=1 → i++ → returns 2
        expect(hiliteTrajectory(path, 3, false, null, color, ctx)).toBe(2);
    });

    it("tunneling bolt passes through non-impregnable wall", () => {
        const pmap = makePmap(); // IMPREGNABLE not set on any cell
        const player = makeCreature();
        const bolt = makeBolt({ boltEffect: BoltEffect.Tunneling });
        const ctx = makeHiliteCtx(pmap, player, {
            cellHasTerrainFlag: (loc, flags) =>
                loc.x === 2 && (flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Tunneling + not impregnable → passes through → all 3 cells
        expect(hiliteTrajectory(path, 3, false, bolt, color, ctx)).toBe(3);
    });

    it("tunneling bolt stops at impregnable wall", () => {
        const pmap = makePmap();
        pmap[2][1].flags |= TileFlag.IMPREGNABLE;
        const player = makeCreature();
        const bolt = makeBolt({ boltEffect: BoltEffect.Tunneling });
        const ctx = makeHiliteCtx(pmap, player, {
            cellHasTerrainFlag: (loc, flags) =>
                loc.x === 2 && (flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) !== 0,
        });
        const path = [pos(1, 1), pos(2, 1), pos(3, 1)];
        // Tunneling + impregnable → i++ → returns 2
        expect(hiliteTrajectory(path, 3, false, bolt, color, ctx)).toBe(2);
    });

    it("numCells limits traversal even if path is longer", () => {
        const pmap = makePmap();
        const player = makeCreature();
        const ctx = makeHiliteCtx(pmap, player);
        const path = [pos(1, 1), pos(2, 1), pos(3, 1), pos(4, 1)];
        // numCells=2 → only traverse first 2
        expect(hiliteTrajectory(path, 2, false, null, color, ctx)).toBe(2);
    });
});

// =============================================================================
// PlayerCancelsBlinkingContext factory
// =============================================================================

function makeBlinkCtx(
    pmap: Pcell[][],
    player: Creature,
    overrides: Partial<PlayerCancelsBlinkingContext> = {},
): PlayerCancelsBlinkingContext {
    const blinkBolt = makeBolt({ boltEffect: BoltEffect.Blinking });
    return {
        rogue: { playbackMode: false },
        player,
        pmap,
        boltCatalog: [blinkBolt],
        BOLT_BLINKING: 0,
        getLocationFlags: () => ({ tFlags: 0, tmFlags: 0 }),
        cellHasTerrainFlag: () => false,
        monsterAtLoc: () => null,
        staffBlinkDistance: () => 3,
        message: vi.fn(),
        confirm: vi.fn(async () => true),
        ...overrides,
    };
}

// =============================================================================
// playerCancelsBlinking
// =============================================================================

describe("playerCancelsBlinking", () => {
    it("returns false in playback mode", async () => {
        const pmap = makePmap();
        const player = makeCreature();
        const ctx = makeBlinkCtx(pmap, player, { rogue: { playbackMode: true } });
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 10, ctx)).toBe(false);
    });

    it("returns false if player is immune to fire", async () => {
        const pmap = makePmap();
        const player = makeCreature();
        player.status[StatusEffect.ImmuneToFire] = 5;
        const ctx = makeBlinkCtx(pmap, player);
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 10, ctx)).toBe(false);
    });

    it("returns false if player is levitating", async () => {
        const pmap = makePmap();
        const player = makeCreature();
        player.status[StatusEffect.Levitating] = 5;
        const ctx = makeBlinkCtx(pmap, player);
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 10, ctx)).toBe(false);
    });

    it("returns false if impact cell has no lava (known range)", async () => {
        const pmap = makePmap();
        const player = makeCreature();
        // getLocationFlags returns 0 (no lava flags)
        const ctx = makeBlinkCtx(pmap, player, {
            getLocationFlags: () => ({ tFlags: 0, tmFlags: 0 }),
        });
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 10, ctx)).toBe(false);
    });

    it("returns true and shows message when impact cell is certain death (known range)", async () => {
        // With maxDistance=10, getImpactLoc travels 10 cells from (5,5) → impact=(15,5).
        // (The bolt traces beyond the target until it hits a creature/wall or maxDistance.)
        const pmap = makePmap();
        const player = makeCreature();
        const message = vi.fn();
        const ctx = makeBlinkCtx(pmap, player, {
            getLocationFlags: (x, y) => {
                if (x === 15 && y === 5) {
                    return { tFlags: TerrainFlag.T_LAVA_INSTA_DEATH, tmFlags: 0 };
                }
                return { tFlags: 0, tmFlags: 0 };
            },
            message,
        });
        const result = await playerCancelsBlinking(pos(5, 5), pos(10, 5), 10, ctx);
        expect(result).toBe(true);
        expect(message).toHaveBeenCalledWith("that would be certain death!", 0);
    });

    it("does not cancel when lava is quenched at impact (tmFlags has TM_EXTINGUISHES_FIRE)", async () => {
        const pmap = makePmap();
        const player = makeCreature();
        const ctx = makeBlinkCtx(pmap, player, {
            getLocationFlags: (x, y) => {
                if (x === 10 && y === 5) {
                    return {
                        tFlags: TerrainFlag.T_LAVA_INSTA_DEATH,
                        tmFlags: TerrainMechFlag.TM_EXTINGUISHES_FIRE,
                    };
                }
                return { tFlags: 0, tmFlags: 0 };
            },
        });
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 10, ctx)).toBe(false);
    });

    it("prompts confirm when possible lava but safe spot exists (unknown range)", async () => {
        // maxDistance=0 → unlimited (dist=DCOLS=79). Path from (5,5) toward (10,5)
        // traces all the way to map edge. Use full-size pmap to avoid OOB access.
        // Cell (7,5) is lava (i=1 in path); cell (8,5) is safe at i=2 >= minSafeIdx=2.
        const pmap = makeFullPmap();
        const player = makeCreature();
        const confirm = vi.fn(async () => true);
        const ctx = makeBlinkCtx(pmap, player, {
            getLocationFlags: (x, y) => {
                if (x === 7 && y === 5) return { tFlags: TerrainFlag.T_LAVA_INSTA_DEATH, tmFlags: 0 };
                return { tFlags: 0, tmFlags: 0 };
            },
            staffBlinkDistance: () => 3, // minSafeIdx = 2
            confirm,
        });
        await playerCancelsBlinking(pos(5, 5), pos(10, 5), 0, ctx);
        expect(confirm).toHaveBeenCalledWith("Blink across lava with unknown range?", false);
    });

    it("returns true when player declines confirmation", async () => {
        const pmap = makeFullPmap();
        const player = makeCreature();
        const ctx = makeBlinkCtx(pmap, player, {
            getLocationFlags: (x, y) => {
                if (x === 7 && y === 5) return { tFlags: TerrainFlag.T_LAVA_INSTA_DEATH, tmFlags: 0 };
                return { tFlags: 0, tmFlags: 0 };
            },
            staffBlinkDistance: () => 3,
            confirm: async () => false,
        });
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 0, ctx)).toBe(true);
    });

    it("returns false when player confirms despite possible lava", async () => {
        const pmap = makeFullPmap();
        const player = makeCreature();
        const ctx = makeBlinkCtx(pmap, player, {
            getLocationFlags: (x, y) => {
                if (x === 7 && y === 5) return { tFlags: TerrainFlag.T_LAVA_INSTA_DEATH, tmFlags: 0 };
                return { tFlags: 0, tmFlags: 0 };
            },
            staffBlinkDistance: () => 3,
            confirm: async () => true,
        });
        expect(await playerCancelsBlinking(pos(5, 5), pos(10, 5), 0, ctx)).toBe(false);
    });
});

