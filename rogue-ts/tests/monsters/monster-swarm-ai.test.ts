/*
 *  monster-swarm-ai.test.ts — Tests for monster swarming AI helpers
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    creatureEligibleForSwarming,
    monsterSwarmDirection,
    type MonsterSwarmContext,
} from "../../src/monsters/monster-swarm-ai.js";
import { CreatureState, StatusEffect } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TileFlag,
} from "../../src/types/flags.js";
import type { Creature, Pos } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    const statusLen = Object.keys(StatusEffect).length / 2;
    return {
        loc: { x: 5, y: 5 },
        info: {
            monsterID: 1,
            monsterName: "goblin",
            displayChar: "g",
            foreColor: { red: 100, green: 100, blue: 100, rand: 0, colorDances: false },
            maxHP: 10,
            defense: 0,
            accuracy: 100,
            damage: { lowerBound: 1, upperBound: 3, clumpFactor: 1 },
            turnsBetweenRegen: 20,
            movementSpeed: 100,
            attackSpeed: 100,
            bloodType: 0,
            intrinsicLightType: 0,
            DFChance: 0,
            DFType: 0,
            bolts: [],
            flags: 0,
            abilityFlags: 0,
        },
        currentHP: 10,
        movementSpeed: 100,
        attackSpeed: 100,
        turnsUntilRegen: 20,
        regenPerTurn: 0,
        ticksUntilTurn: 0,
        previousHealthPoints: 10,
        creatureState: CreatureState.Ally,
        creatureMode: 0,
        mutationIndex: -1,
        bookkeepingFlags: 0,
        spawnDepth: 1,
        status: new Array(statusLen).fill(0),
        maxStatus: new Array(statusLen).fill(0),
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, rand: 0, colorDances: false },
        targetCorpseLoc: { x: -1, y: -1 },
        corpseAbsorptionCounter: -1,
        targetWaypointIndex: -1,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: -1, y: -1 },
        depth: 1,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        followers: [],
        mapToMe: null,
        safetyMap: null,
        ...overrides,
    } as Creature;
}

// 8-directional neighbour deltas: cardinals first, then diagonals.
const nbDirs: [number, number][] = [
    [0, -1], [0, 1], [-1, 0], [1, 0],  // cardinals
    [-1, -1], [-1, 1], [1, -1], [1, 1], // diagonals
];
const DIRECTION_COUNT = 8;
const NO_DIRECTION = -1;
const HAS_PLAYER = TileFlag.HAS_PLAYER;
const HAS_MONSTER = TileFlag.HAS_MONSTER;
const MONST_ATTACKABLE_THRU_WALLS = MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS;

function distanceBetween(a: Pos, b: Pos): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** No-op shuffle (keeps order deterministic in tests). */
function noShuffle(_list: number[]): void { /* noop */ }

/** Default context: no terrain blocking, nothing to avoid, creatures are enemies/not teammates. */
function makeCtx(
    player: Creature,
    monsters: Creature[],
    overrides: Partial<MonsterSwarmContext> = {},
): MonsterSwarmContext {
    return {
        player,
        monsters,
        distanceBetween,
        diagonalBlocked: () => false,
        isPosInMap: (loc) => loc.x >= 0 && loc.x < 20 && loc.y >= 0 && loc.y < 20,
        cellFlags: () => 0,
        monsterAvoids: () => false,
        monstersAreTeammates: () => false,
        monstersAreEnemies: () => true,
        shuffleList: noShuffle,
        nbDirs,
        DIRECTION_COUNT,
        NO_DIRECTION,
        HAS_PLAYER,
        HAS_MONSTER,
        MONST_ATTACKABLE_THRU_WALLS,
        ...overrides,
    };
}

// =============================================================================
// creatureEligibleForSwarming
// =============================================================================

describe("creatureEligibleForSwarming", () => {
    it("returns true for an ally with no adverse status", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ creatureState: CreatureState.Ally });
        expect(creatureEligibleForSwarming(monst, player)).toBe(true);
    });

    it("returns true for TRACKING_SCENT non-player creature", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ creatureState: CreatureState.TrackingScent });
        expect(creatureEligibleForSwarming(monst, player)).toBe(true);
    });

    it("returns false for WANDERING non-player creature", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ creatureState: CreatureState.Wandering });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns true for player regardless of state", () => {
        const player = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Wandering });
        expect(creatureEligibleForSwarming(player, player)).toBe(true);
    });

    it("returns false if MONST_IMMOBILE", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            info: { ...makeCreature().info, flags: MonsterBehaviorFlag.MONST_IMMOBILE },
        });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns false if MONST_MAINTAINS_DISTANCE", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            info: { ...makeCreature().info, flags: MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE },
        });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns false if STATUS_CONFUSED", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const status = new Array(Object.keys(StatusEffect).length / 2).fill(0);
        status[StatusEffect.Confused] = 3;
        const monst = makeCreature({ creatureState: CreatureState.Ally, status });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns false if STATUS_PARALYZED", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const status = new Array(Object.keys(StatusEffect).length / 2).fill(0);
        status[StatusEffect.Paralyzed] = 2;
        const monst = makeCreature({ creatureState: CreatureState.Ally, status });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns false if STATUS_MAGICAL_FEAR", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const status = new Array(Object.keys(StatusEffect).length / 2).fill(0);
        status[StatusEffect.MagicalFear] = 5;
        const monst = makeCreature({ creatureState: CreatureState.Ally, status });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns false if STATUS_LIFESPAN_REMAINING === 1", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const status = new Array(Object.keys(StatusEffect).length / 2).fill(0);
        status[StatusEffect.LifespanRemaining] = 1;
        const monst = makeCreature({ creatureState: CreatureState.Ally, status });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns true if STATUS_LIFESPAN_REMAINING === 2 (not dying yet)", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const status = new Array(Object.keys(StatusEffect).length / 2).fill(0);
        status[StatusEffect.LifespanRemaining] = 2;
        const monst = makeCreature({ creatureState: CreatureState.Ally, status });
        expect(creatureEligibleForSwarming(monst, player)).toBe(true);
    });

    it("returns false if MB_SEIZED", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            bookkeepingFlags: MonsterBookkeepingFlag.MB_SEIZED,
        });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });

    it("returns false if MB_SEIZING", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            bookkeepingFlags: MonsterBookkeepingFlag.MB_SEIZING,
        });
        expect(creatureEligibleForSwarming(monst, player)).toBe(false);
    });
});

// =============================================================================
// monsterSwarmDirection
// =============================================================================

describe("monsterSwarmDirection", () => {
    it("returns NO_DIRECTION if monst is player", () => {
        const player = makeCreature({ loc: { x: 5, y: 5 } });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        const ctx = makeCtx(player, []);
        expect(monsterSwarmDirection(player, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if monst is not eligible for swarming (WANDERING)", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Wandering });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        const ctx = makeCtx(player, [monst]);
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if monst is not adjacent to enemy (distance > 1)", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 8, y: 5 } }); // distance 3
        const ctx = makeCtx(player, [monst]);
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if diagonal between monst and enemy is blocked", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        const ctx = makeCtx(player, [monst], {
            diagonalBlocked: (x1, y1, x2, y2) => x1 === 5 && y1 === 5 && x2 === 6 && y2 === 5,
        });
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if MONST_ATTACKABLE_THRU_WALLS (walls irrelevant)", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({
            loc: { x: 6, y: 5 },
            info: { ...makeCreature().info, flags: MONST_ATTACKABLE_THRU_WALLS },
        });
        const ctx = makeCtx(player, [monst]);
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if monst and enemy are not enemies", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        const ctx = makeCtx(player, [monst], { monstersAreEnemies: () => false });
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if no flanking space exists (all cells occupied)", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        // All cells are occupied
        const ctx = makeCtx(player, [monst], {
            cellFlags: () => HAS_MONSTER,
        });
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if no ally would benefit (no nearby teammates)", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } }); // far away
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        // There's an open flanking cell at (5, 4) — adjacent to both monst(5,5) and enemy(6,5)
        // But no ally is adjacent to monst to take advantage.
        const ctx = makeCtx(player, [monst], {
            monstersAreTeammates: () => false, // player not a teammate
        });
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns a direction when ally can benefit from opened flanking space", () => {
        // Layout: ally(4,5), monst(5,5), enemy(6,5) in a row.
        // Cells (5,4) and (5,6) — the other flanking cells around enemy accessible from ally —
        // are blocked, so the ONLY path for ally to reach enemy goes via monst's current cell (5,5).
        // monst steps diagonally to (6,4) or (6,6), opening (5,5) for ally.
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const ally = makeCreature({ loc: { x: 4, y: 5 }, creatureState: CreatureState.Ally });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });

        const ctx = makeCtx(player, [ally, monst, enemy], {
            monstersAreTeammates: (a, b) => (a === ally && b === monst) || (a === monst && b === ally),
            monstersAreEnemies: (a, b) =>
                (a === monst && b === enemy) ||
                (a === ally && b === enemy) ||
                (a === enemy && b === monst) ||
                (a === enemy && b === ally),
            // Block (5,4) and (5,6) so ally has no alternate flanking cell except (5,5) where monst stands.
            // Also mark monst's cell (5,5) as occupied so the alternate-direction check won't count it.
            cellFlags: (loc) => {
                if (loc.x === 5 && (loc.y === 4 || loc.y === 5 || loc.y === 6)) return HAS_MONSTER;
                return 0;
            },
        });

        const dir = monsterSwarmDirection(monst, enemy, ctx);
        expect(dir).not.toBe(NO_DIRECTION);
        // The destination must be adjacent to enemy
        const newLoc: Pos = {
            x: monst.loc.x + nbDirs[dir][0],
            y: monst.loc.y + nbDirs[dir][1],
        };
        expect(distanceBetween(enemy.loc, newLoc)).toBe(1);
    });

    it("returns NO_DIRECTION if ally already has an alternate attack position", () => {
        // Same layout as above, but there's another open cell adjacent to ally AND enemy
        // → alternateDirectionExists → no need to swarm
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const ally = makeCreature({ loc: { x: 4, y: 5 }, creatureState: CreatureState.Ally });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });

        // Cell (5,4) is both adjacent to ally (distance=2, actually won't qualify)...
        // Let's place ally closer: ally at (5,6), enemy at (6,5), open cell at (6,6)
        ally.loc = { x: 5, y: 6 };
        // (6,6) is adjacent to both ally(5,6) and enemy(6,5), and also adjacent to monst(5,5)
        // Since (6,6) is accessible from ally directly, alternateDirectionExists = true

        const ctx = makeCtx(player, [ally, monst, enemy], {
            monstersAreTeammates: (a, b) => (a === ally && b === monst) || (a === monst && b === ally),
            monstersAreEnemies: (a, b) =>
                (a === monst && b === enemy) ||
                (a === ally && b === enemy) ||
                (a === enemy && b === monst) ||
                (a === enemy && b === ally),
            cellFlags: (loc) => {
                // (6,6) is open — alternate exists for ally at (5,6) to reach enemy at (6,5)
                // distance(enemy, (6,6)) = max(|6-6|,|5-6|) = 1 ✓
                // distance(ally, (6,6)) = max(|5-6|,|6-6|) = 1 ✓
                // So alternateDirectionExists = true → return NO_DIRECTION
                return 0;
            },
        });

        // Since (6,6) is an open cell adjacent to both ally and enemy,
        // alternateDirectionExists = true → monst doesn't need to swarm
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });

    it("returns NO_DIRECTION if ally is already occupied with another enemy", () => {
        const player = makeCreature({ loc: { x: 0, y: 0 } });
        const ally = makeCreature({ loc: { x: 4, y: 5 }, creatureState: CreatureState.Ally });
        const monst = makeCreature({ loc: { x: 5, y: 5 }, creatureState: CreatureState.Ally });
        const enemy = makeCreature({ loc: { x: 6, y: 5 } });
        // A separate enemy adjacent to ally
        const otherEnemy = makeCreature({ loc: { x: 4, y: 6 } });

        const ctx = makeCtx(player, [ally, monst, enemy, otherEnemy], {
            monstersAreTeammates: (a, b) => (a === ally && b === monst) || (a === monst && b === ally),
            monstersAreEnemies: (a, b) => {
                const enemies = new Set([
                    `${ally.loc.x},${ally.loc.y}-${enemy.loc.x},${enemy.loc.y}`,
                    `${enemy.loc.x},${enemy.loc.y}-${ally.loc.x},${ally.loc.y}`,
                    `${monst.loc.x},${monst.loc.y}-${enemy.loc.x},${enemy.loc.y}`,
                    `${enemy.loc.x},${enemy.loc.y}-${monst.loc.x},${monst.loc.y}`,
                    `${ally.loc.x},${ally.loc.y}-${otherEnemy.loc.x},${otherEnemy.loc.y}`,
                    `${otherEnemy.loc.x},${otherEnemy.loc.y}-${ally.loc.x},${ally.loc.y}`,
                ]);
                return enemies.has(`${a.loc.x},${a.loc.y}-${b.loc.x},${b.loc.y}`);
            },
            // Ally has no alternate space (all occupied except monst's current position)
            cellFlags: (loc) => {
                // All cells occupied except monst's target
                if (loc.x === 5 && loc.y === 4) return 0; // target flanking cell open
                return HAS_MONSTER; // everything else occupied
            },
        });

        // Ally is engaged with otherEnemy (adjacent, not diagonally blocked) → foundConflict = true
        expect(monsterSwarmDirection(monst, enemy, ctx)).toBe(NO_DIRECTION);
    });
});
