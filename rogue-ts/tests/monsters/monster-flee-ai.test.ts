/*
 *  monster-flee-ai.test.ts — Tests for monster flee AI helpers
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    fleeingMonsterAwareOfPlayer,
    getSafetyMap,
    allyFlees,
    type FleeingMonsterAwarenessContext,
    type GetSafetyMapContext,
    type AllyFleesContext,
} from "../../src/monsters/monster-flee-ai.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, CreatureState } from "../../src/types/enums.js";
import { MonsterBehaviorFlag, MonsterBookkeepingFlag, MonsterAbilityFlag } from "../../src/types/flags.js";
import { DCOLS, DROWS } from "../../src/types/constants.js";
import type { Creature } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makeCreature(monsterID: MonsterType): Creature {
    const c = createCreature();
    const cat = monsterCatalog[monsterID];
    c.info = {
        ...cat,
        damage: { ...cat.damage },
        foreColor: { ...cat.foreColor },
        bolts: [...cat.bolts],
    };
    c.loc = { x: 5, y: 5 };
    c.currentHP = c.info.maxHP;
    c.movementSpeed = c.info.movementSpeed;
    c.attackSpeed = c.info.attackSpeed;
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

function makePlayer(): Creature {
    return makeCreature(MonsterType.MK_YOU);
}

function makeAllocGrid(): number[][] {
    return Array.from({ length: DCOLS }, () => new Array(DROWS).fill(0));
}

// =============================================================================
// fleeingMonsterAwareOfPlayer
// =============================================================================

describe("fleeingMonsterAwareOfPlayer", () => {
    it("returns true when monster cell is in FOV (player not invisible)", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 3, y: 3 };
        const ctx: FleeingMonsterAwarenessContext = {
            player,
            inFieldOfView: (loc) => loc.x === 3 && loc.y === 3,
        };
        expect(fleeingMonsterAwareOfPlayer(monst, ctx)).toBe(true);
    });

    it("returns false when monster cell is not in FOV (player not invisible)", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 3, y: 3 };
        const ctx: FleeingMonsterAwarenessContext = {
            player,
            inFieldOfView: () => false,
        };
        expect(fleeingMonsterAwareOfPlayer(monst, ctx)).toBe(false);
    });

    it("returns true when player is invisible and monster is adjacent (distance=1)", () => {
        const player = makePlayer();
        player.loc = { x: 4, y: 5 };
        player.status[StatusEffect.Invisible] = 5;
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 5, y: 5 };
        const ctx: FleeingMonsterAwarenessContext = {
            player,
            inFieldOfView: () => false,  // not called when player invisible
        };
        expect(fleeingMonsterAwareOfPlayer(monst, ctx)).toBe(true);
    });

    it("returns false when player is invisible and monster is not adjacent (distance>1)", () => {
        const player = makePlayer();
        player.loc = { x: 1, y: 1 };
        player.status[StatusEffect.Invisible] = 5;
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 5, y: 5 };
        const ctx: FleeingMonsterAwarenessContext = {
            player,
            inFieldOfView: () => true,  // not called when player invisible
        };
        expect(fleeingMonsterAwareOfPlayer(monst, ctx)).toBe(false);
    });

    it("returns true when player is invisible and monster is at same cell (distance=0)", () => {
        const player = makePlayer();
        player.loc = { x: 5, y: 5 };
        player.status[StatusEffect.Invisible] = 1;
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 5, y: 5 };
        const ctx: FleeingMonsterAwarenessContext = {
            player,
            inFieldOfView: () => false,
        };
        expect(fleeingMonsterAwareOfPlayer(monst, ctx)).toBe(true);
    });
});

// =============================================================================
// getSafetyMap
// =============================================================================

describe("getSafetyMap", () => {
    function makeGetSafetyMapCtx(
        player: Creature,
        inFOV: boolean,
        overrides: Partial<GetSafetyMapContext> = {},
    ): GetSafetyMapContext & { updateCalled: boolean } {
        let updateCalled = false;
        const globalSafetyMap = makeAllocGrid();
        globalSafetyMap[5][5] = 42;   // sentinel value
        return {
            player,
            safetyMap: globalSafetyMap,
            rogue: { updatedSafetyMapThisTurn: false },
            inFieldOfView: () => inFOV,
            allocGrid: makeAllocGrid,
            copyGrid: (dest, src) => {
                for (let i = 0; i < DCOLS; i++) {
                    for (let j = 0; j < DROWS; j++) {
                        dest[i][j] = src[i][j];
                    }
                }
            },
            updateSafetyMap: () => { updateCalled = true; },
            get updateCalled() { return updateCalled; },
            ...overrides,
        };
    }

    it("returns global safetyMap when monster is aware (cell in FOV)", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_RAT);
        const ctx = makeGetSafetyMapCtx(player, true);

        const result = getSafetyMap(monst, ctx);
        expect(result).toBe(ctx.safetyMap);   // same reference
    });

    it("calls updateSafetyMap when aware and not yet updated this turn", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_RAT);
        let updateCalled = false;
        const ctx: GetSafetyMapContext = {
            player,
            safetyMap: makeAllocGrid(),
            rogue: { updatedSafetyMapThisTurn: false },
            inFieldOfView: () => true,
            allocGrid: makeAllocGrid,
            copyGrid: () => {},
            updateSafetyMap: () => { updateCalled = true; },
        };

        getSafetyMap(monst, ctx);
        expect(updateCalled).toBe(true);
    });

    it("does not call updateSafetyMap when already updated this turn", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_RAT);
        let updateCalled = false;
        const ctx: GetSafetyMapContext = {
            player,
            safetyMap: makeAllocGrid(),
            rogue: { updatedSafetyMapThisTurn: true },
            inFieldOfView: () => true,
            allocGrid: makeAllocGrid,
            copyGrid: () => {},
            updateSafetyMap: () => { updateCalled = true; },
        };

        getSafetyMap(monst, ctx);
        expect(updateCalled).toBe(false);
    });

    it("discards per-monster safetyMap when monster becomes aware", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_RAT);
        const staleMap = makeAllocGrid();
        monst.safetyMap = staleMap;

        const ctx: GetSafetyMapContext = {
            player,
            safetyMap: makeAllocGrid(),
            rogue: { updatedSafetyMapThisTurn: true },
            inFieldOfView: () => true,
            allocGrid: makeAllocGrid,
            copyGrid: () => {},
            updateSafetyMap: () => {},
        };

        getSafetyMap(monst, ctx);
        expect(monst.safetyMap).toBeNull();
    });

    it("creates a per-monster copy when monster is unaware", () => {
        const player = makePlayer();
        player.status[StatusEffect.Invisible] = 5;
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 8, y: 8 };  // far from player, not adjacent

        const globalSafetyMap = makeAllocGrid();
        globalSafetyMap[3][3] = 99;   // sentinel
        const ctx: GetSafetyMapContext = {
            player,
            safetyMap: globalSafetyMap,
            rogue: { updatedSafetyMapThisTurn: true },
            inFieldOfView: () => false,
            allocGrid: makeAllocGrid,
            copyGrid: (dest, src) => {
                for (let i = 0; i < DCOLS; i++) {
                    for (let j = 0; j < DROWS; j++) dest[i][j] = src[i][j];
                }
            },
            updateSafetyMap: () => {},
        };

        const result = getSafetyMap(monst, ctx);
        expect(result).not.toBe(globalSafetyMap);   // distinct copy
        expect(result[3][3]).toBe(99);               // values copied
        expect(monst.safetyMap).toBe(result);        // cached on monster
    });

    it("reuses per-monster safetyMap on second call when still unaware", () => {
        const player = makePlayer();
        player.status[StatusEffect.Invisible] = 5;
        player.loc = { x: 0, y: 0 };
        const monst = makeCreature(MonsterType.MK_RAT);
        monst.loc = { x: 8, y: 8 };

        const ctx: GetSafetyMapContext = {
            player,
            safetyMap: makeAllocGrid(),
            rogue: { updatedSafetyMapThisTurn: true },
            inFieldOfView: () => false,
            allocGrid: makeAllocGrid,
            copyGrid: () => {},
            updateSafetyMap: () => {},
        };

        const first = getSafetyMap(monst, ctx);
        const second = getSafetyMap(monst, ctx);
        expect(first).toBe(second);  // same reference — no re-allocation
    });
});

// =============================================================================
// allyFlees
// =============================================================================

describe("allyFlees", () => {
    function makeAllyCtx(player: Creature, flees = false): AllyFleesContext {
        return {
            player,
            monsterFleesFrom: () => flees,
        };
    }

    it("returns false when closestEnemy is null", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        expect(allyFlees(ally, null, makeAllyCtx(player))).toBe(false);
    });

    it("returns false for spectral blade (maxHP=1)", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_SPECTRAL_BLADE);
        ally.creatureState = CreatureState.Ally;
        const enemy = makeCreature(MonsterType.MK_RAT);
        enemy.loc = { x: 6, y: 5 };
        // Spectral blades have maxHP 1
        expect(ally.info.maxHP).toBe(1);
        expect(allyFlees(ally, enemy, makeAllyCtx(player))).toBe(false);
    });

    it("returns false for timed ally (STATUS_LIFESPAN_REMAINING > 0)", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.status[StatusEffect.LifespanRemaining] = 10;
        const enemy = makeCreature(MonsterType.MK_REVENANT);
        enemy.loc = { x: 6, y: 5 };
        expect(allyFlees(ally, enemy, makeAllyCtx(player))).toBe(false);
    });

    it("returns true when HP is low, enemy nearby, and ally has MONST_FLEES_NEAR_DEATH", () => {
        const player = makePlayer();
        player.currentHP = player.info.maxHP;

        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.currentHP = Math.floor(ally.info.maxHP * 0.2);  // 20% HP — under 33%
        ally.info = { ...ally.info, flags: ally.info.flags | MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH };

        const enemy = makeCreature(MonsterType.MK_TROLL);
        enemy.loc = { x: 6, y: 5 };  // distance 1, well within 10

        expect(allyFlees(ally, enemy, makeAllyCtx(player))).toBe(true);
    });

    it("returns false when HP is low but enemy is far away (distance >= 10)", () => {
        const player = makePlayer();
        player.currentHP = player.info.maxHP;

        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.currentHP = Math.floor(ally.info.maxHP * 0.2);
        ally.info = { ...ally.info, flags: ally.info.flags | MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH };

        const enemy = makeCreature(MonsterType.MK_TROLL);
        enemy.loc = { x: 5 + 15, y: 5 };  // distance 15, beyond 10

        expect(allyFlees(ally, enemy, makeAllyCtx(player))).toBe(false);
    });

    it("returns true when ally HP fraction is less than half the player's", () => {
        const player = makePlayer();
        player.currentHP = player.info.maxHP;    // player at 100%

        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.currentHP = Math.floor(ally.info.maxHP * 0.15);  // ally at 15%, < 50%/2 = 25%

        const enemy = makeCreature(MonsterType.MK_TROLL);
        enemy.loc = { x: 6, y: 5 };

        expect(allyFlees(ally, enemy, makeAllyCtx(player))).toBe(true);
    });

    it("returns false when ally HP is above 33%", () => {
        const player = makePlayer();
        player.currentHP = player.info.maxHP;

        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.currentHP = Math.floor(ally.info.maxHP * 0.5);  // 50% HP
        ally.info = { ...ally.info, flags: ally.info.flags | MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH };

        const enemy = makeCreature(MonsterType.MK_TROLL);
        enemy.loc = { x: 6, y: 5 };

        expect(allyFlees(ally, enemy, makeAllyCtx(player))).toBe(false);
    });

    it("returns true when monsterFleesFrom returns true (damage-immune/kamikaze/etc.)", () => {
        const player = makePlayer();
        player.currentHP = player.info.maxHP;

        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.currentHP = ally.info.maxHP;  // full health — won't trigger HP branch

        const enemy = makeCreature(MonsterType.MK_REVENANT);
        enemy.loc = { x: 6, y: 5 };

        // monsterFleesFrom returns true (e.g. revenant is damage-immune)
        const ctx: AllyFleesContext = {
            player,
            monsterFleesFrom: () => true,
        };
        expect(allyFlees(ally, enemy, ctx)).toBe(true);
    });

    it("returns false when HP is fine and monsterFleesFrom is false", () => {
        const player = makePlayer();
        player.currentHP = player.info.maxHP;

        const ally = makeCreature(MonsterType.MK_RAT);
        ally.creatureState = CreatureState.Ally;
        ally.currentHP = ally.info.maxHP;

        const enemy = makeCreature(MonsterType.MK_RAT);
        enemy.loc = { x: 6, y: 5 };

        expect(allyFlees(ally, enemy, makeAllyCtx(player, false))).toBe(false);
    });
});
