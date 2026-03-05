/*
 *  monster-state.test.ts — Tests for monster state & status
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    distanceBetween,
    alertMonster,
    wakeUp,
    empowerMonster,
    chooseNewWanderDestination,
    monsterFleesFrom,
    monsterAvoids,
    updateMonsterState,
    decrementMonsterStatus,
} from "../../src/monsters/monster-state.js";
import type { MonsterStateContext } from "../../src/monsters/monster-state.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { MonsterType, StatusEffect, CreatureState, CreatureMode } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    TerrainFlag,
    TerrainMechFlag,
} from "../../src/types/flags.js";
import type { Creature, Pos } from "../../src/types/types.js";

// =============================================================================
// Test helpers
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

function makeStateContext(
    player: Creature,
    monsters: Creature[] = [],
    overrides?: Partial<MonsterStateContext>,
): MonsterStateContext {
    return {
        player,
        monsters,
        rng: {
            randRange: (lo, hi) => lo,
            randPercent: () => false,
        },
        queryCtx: {
            player,
            cellHasTerrainFlag: () => false,
            cellHasGas: () => false,
            playerCanSee: () => true,
            playerCanDirectlySee: () => true,
            playbackOmniscience: false,
        },
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        terrainFlags: () => 0,
        cellFlags: () => 0,
        isPosInMap: () => true,
        downLoc: { x: 80, y: 30 },
        upLoc: { x: 0, y: 0 },
        monsterAtLoc: () => null,
        waypointCount: 5,
        maxWaypointCount: 20,
        closestWaypointIndex: () => 0,
        closestWaypointIndexTo: () => 0,
        burnedTerrainFlagsAtLoc: () => 0,
        discoveredTerrainFlagsAtLoc: () => 0,
        passableArcCount: () => 0,
        awareOfTarget: () => false,
        openPathBetween: () => false,
        traversiblePathBetween: () => false,
        inFieldOfView: () => false,
        heal: () => {},
        inflictDamage: () => false,
        killCreature: () => {},
        extinguishFireOnCreature: () => {},
        makeMonsterDropItem: () => {},
        refreshDungeonCell: () => {},
        message: () => {},
        messageWithColor: () => {},
        combatMessage: () => {},
        playerCanSee: () => true,
        playerHasRespirationArmor: () => false,
        mapToShore: null,
        PRESSURE_PLATE_DEPRESSED: 0x0100,
        HAS_MONSTER: 0x0001,
        HAS_PLAYER: 0x0002,
        HAS_STAIRS: 0x0004,
        IN_FIELD_OF_VIEW: 0x0008,
        monsterCanSubmergeNow: () => false,
        DCOLS: 79,
        DROWS: 29,
        ...overrides,
    };
}

// =============================================================================
// distanceBetween
// =============================================================================

describe("distanceBetween", () => {
    it("returns 0 for same position", () => {
        expect(distanceBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    it("returns 1 for adjacent positions (cardinal)", () => {
        expect(distanceBetween({ x: 5, y: 5 }, { x: 6, y: 5 })).toBe(1);
    });

    it("returns 1 for adjacent positions (diagonal)", () => {
        expect(distanceBetween({ x: 5, y: 5 }, { x: 6, y: 6 })).toBe(1);
    });

    it("returns Chebyshev distance", () => {
        expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 7 })).toBe(7);
        expect(distanceBetween({ x: 10, y: 5 }, { x: 2, y: 5 })).toBe(8);
    });
});

// =============================================================================
// alertMonster
// =============================================================================

describe("alertMonster", () => {
    it("sets state to TrackingScent for normal mode", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.creatureMode = CreatureMode.Normal;
        alertMonster(monst, player);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
        expect(monst.lastSeenPlayerAt).toEqual(player.loc);
    });

    it("sets state to Fleeing for perm-fleeing mode", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_MONKEY);
        monst.creatureMode = CreatureMode.PermFleeing;
        alertMonster(monst, player);
        expect(monst.creatureState).toBe(CreatureState.Fleeing);
    });
});

// =============================================================================
// wakeUp
// =============================================================================

describe("wakeUp", () => {
    it("alerts a non-ally monster and sets ticks to 100", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.creatureState = CreatureState.Sleeping;
        monst.ticksUntilTurn = 50;
        const ctx = makeStateContext(player, []);
        wakeUp(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
        expect(monst.ticksUntilTurn).toBe(100);
    });

    it("doesn't change ally state", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_GOBLIN);
        ally.creatureState = CreatureState.Ally;
        const ctx = makeStateContext(player, []);
        wakeUp(ally, ctx);
        expect(ally.creatureState).toBe(CreatureState.Ally);
        expect(ally.ticksUntilTurn).toBe(100);
    });

    it("wakes teammates too", () => {
        const player = makePlayer();
        const leader = makeCreature(MonsterType.MK_OGRE);
        leader.creatureState = CreatureState.Sleeping;
        leader.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;

        const follower = makeCreature(MonsterType.MK_GOBLIN);
        follower.creatureState = CreatureState.Sleeping;
        follower.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        follower.leader = leader;
        follower.creatureMode = CreatureMode.Normal;
        follower.ticksUntilTurn = 50;

        const ctx = makeStateContext(player, [leader, follower]);
        wakeUp(leader, ctx);

        // follower should be woken up
        expect(follower.ticksUntilTurn).toBe(100);
    });
});

// =============================================================================
// empowerMonster
// =============================================================================

describe("empowerMonster", () => {
    it("increases stats and increments power counts", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_OGRE);
        const origMaxHP = monst.info.maxHP;
        const origDefense = monst.info.defense;
        const origAccuracy = monst.info.accuracy;
        const origNewPower = monst.newPowerCount;
        const origTotalPower = monst.totalPowerCount;

        const ctx = makeStateContext(player, [], {
            heal: vi.fn(),
            combatMessage: vi.fn(),
        });
        empowerMonster(monst, ctx);

        expect(monst.info.maxHP).toBe(origMaxHP + 12);
        expect(monst.info.defense).toBe(origDefense + 10);
        expect(monst.info.accuracy).toBe(origAccuracy + 10);
        expect(monst.newPowerCount).toBe(origNewPower + 1);
        expect(monst.totalPowerCount).toBe(origTotalPower + 1);
        expect(ctx.heal).toHaveBeenCalledWith(monst, 100, true);
    });
});

// =============================================================================
// chooseNewWanderDestination
// =============================================================================

describe("chooseNewWanderDestination", () => {
    it("marks current waypoint as visited and picks new one", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.waypointAlreadyVisited = [false, false, false, false, false];
        monst.targetWaypointIndex = 2;

        const closestWaypointIndex = vi.fn().mockReturnValue(3);
        const ctx = makeStateContext(player, [], {
            waypointCount: 5,
            closestWaypointIndex,
        });
        chooseNewWanderDestination(monst, ctx);

        expect(monst.waypointAlreadyVisited[2]).toBe(true);
        expect(monst.targetWaypointIndex).toBe(3);
    });

    it("resets all visited if no waypoint found", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.waypointAlreadyVisited = [true, true, true, true, true];
        monst.targetWaypointIndex = 1;

        let callCount = 0;
        const closestWaypointIndex = vi.fn().mockImplementation(() => {
            callCount++;
            return callCount === 1 ? -1 : 2; // First: no match, second: found
        });
        const ctx = makeStateContext(player, [], {
            waypointCount: 5,
            closestWaypointIndex,
        });
        chooseNewWanderDestination(monst, ctx);

        expect(monst.targetWaypointIndex).toBe(2);
        expect(closestWaypointIndex).toHaveBeenCalledTimes(2);
    });
});

// =============================================================================
// monsterFleesFrom
// =============================================================================

describe("monsterFleesFrom", () => {
    it("does not flee if defender won't attack", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const defender = makeCreature(MonsterType.MK_OGRE);
        // Defender won't attack monst because they're on the same team
        defender.creatureState = CreatureState.Sleeping;
        monst.creatureState = CreatureState.Sleeping;
        expect(monsterFleesFrom(monst, defender, player, () => false)).toBe(false);
    });

    it("does not flee if defender is >= 4 away", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };
        const defender = makeCreature(MonsterType.MK_OGRE);
        defender.loc = { x: 10, y: 10 };
        defender.creatureState = CreatureState.TrackingScent;
        expect(monsterFleesFrom(monst, defender, player, () => false)).toBe(false);
    });

    it("flees from immune-to-weapons non-immobile monster", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };
        monst.creatureState = CreatureState.Ally;
        const revenant = makeCreature(MonsterType.MK_REVENANT);
        revenant.loc = { x: 6, y: 6 };
        revenant.creatureState = CreatureState.TrackingScent;
        expect(monsterFleesFrom(monst, revenant, player, () => false)).toBe(true);
    });

    it("flees from kamikaze monsters", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };
        monst.creatureState = CreatureState.Ally;

        // Create a mock kamikaze monster
        const bloat = makeCreature(MonsterType.MK_BLOAT);
        bloat.loc = { x: 6, y: 6 };
        bloat.creatureState = CreatureState.TrackingScent;
        expect(monsterFleesFrom(monst, bloat, player, () => false)).toBe(true);
    });
});

// =============================================================================
// monsterAvoids
// =============================================================================

describe("monsterAvoids", () => {
    it("non-player avoids stairs", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeStateContext(player, [], {
            downLoc: { x: 10, y: 10 },
        });
        expect(monsterAvoids(monst, { x: 10, y: 10 }, ctx)).toBe(true);
    });

    it("player does not avoid stairs", () => {
        const player = makePlayer();
        const ctx = makeStateContext(player, [], {
            downLoc: { x: 10, y: 10 },
        });
        expect(monsterAvoids(player, { x: 10, y: 10 }, ctx)).toBe(false);
    });

    it("restricted-to-liquid monster avoids dry land", () => {
        const player = makePlayer();
        const eel = makeCreature(MonsterType.MK_EEL);
        const ctx = makeStateContext(player, [], {
            cellHasTMFlag: () => false, // no TM_ALLOWS_SUBMERGING
        });
        expect(monsterAvoids(eel, { x: 7, y: 7 }, ctx)).toBe(true);
    });

    it("wall blocks passage", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeStateContext(player, [], {
            terrainFlags: () => TerrainFlag.T_OBSTRUCTS_PASSABILITY,
        });
        expect(monsterAvoids(monst, { x: 7, y: 7 }, ctx)).toBe(true);
    });

    it("avoids fire when not immune", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.loc = { x: 5, y: 5 };
        const ctx = makeStateContext(player, [], {
            terrainFlags: (p: Pos) =>
                p.x === 7 ? TerrainFlag.T_IS_FIRE : 0,
            cellHasTerrainFlag: (p: Pos, _f: number) =>
                p.x === 7 ? true : false,
        });
        expect(monsterAvoids(monst, { x: 7, y: 7 }, ctx)).toBe(true);
    });

    it("does not avoid fire when immune", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.ImmuneToFire] = 100;
        monst.loc = { x: 5, y: 5 };
        const ctx = makeStateContext(player, [], {
            terrainFlags: () => TerrainFlag.T_IS_FIRE,
        });
        expect(monsterAvoids(monst, { x: 7, y: 7 }, ctx)).toBe(false);
    });

    it("hostile monster does not avoid cell with player", () => {
        const player = makePlayer();
        player.loc = { x: 7, y: 7 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.creatureState = CreatureState.TrackingScent;
        const ctx = makeStateContext(player);
        expect(monsterAvoids(monst, { x: 7, y: 7 }, ctx)).toBe(false);
    });
});

// =============================================================================
// updateMonsterState
// =============================================================================

describe("updateMonsterState", () => {
    it("always-hunting monster stays tracking", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.flags |= MonsterBehaviorFlag.MONST_ALWAYS_HUNTING;
        monst.creatureState = CreatureState.Wandering;
        const ctx = makeStateContext(player, [monst]);
        updateMonsterState(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("always-hunting ally stays ally", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.flags |= MonsterBehaviorFlag.MONST_ALWAYS_HUNTING;
        monst.creatureState = CreatureState.Ally;
        const ctx = makeStateContext(player, [monst]);
        updateMonsterState(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.Ally);
    });

    it("immobile non-ally sleeps when unaware of player", () => {
        const player = makePlayer();
        const totem = makeCreature(MonsterType.MK_GOBLIN_TOTEM);
        totem.creatureState = CreatureState.TrackingScent;
        const ctx = makeStateContext(player, [totem], {
            awareOfTarget: () => false,
        });
        updateMonsterState(totem, ctx);
        expect(totem.creatureState).toBe(CreatureState.Sleeping);
    });

    it("immobile non-ally tracks when aware of player", () => {
        const player = makePlayer();
        const totem = makeCreature(MonsterType.MK_GOBLIN_TOTEM);
        totem.creatureState = CreatureState.Sleeping;
        const ctx = makeStateContext(player, [totem], {
            awareOfTarget: () => true,
        });
        updateMonsterState(totem, ctx);
        expect(totem.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("wandering monster that notices player starts tracking", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.creatureState = CreatureState.Wandering;
        const ctx = makeStateContext(player, [monst], {
            awareOfTarget: () => true,
            inFieldOfView: () => true,
        });
        updateMonsterState(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("sleeping monster wakes up when aware", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.creatureState = CreatureState.Sleeping;
        monst.ticksUntilTurn = 50;
        const ctx = makeStateContext(player, [monst], {
            awareOfTarget: () => true,
        });
        updateMonsterState(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
        expect(monst.ticksUntilTurn).toBe(100);
    });

    it("tracking monster that loses awareness starts wandering", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.creatureState = CreatureState.TrackingScent;
        monst.lastSeenPlayerAt = { x: 10, y: 10 };
        const ctx = makeStateContext(player, [monst], {
            awareOfTarget: () => false,
        });
        updateMonsterState(monst, ctx);
        expect(monst.creatureState).toBe(CreatureState.Wandering);
    });

    it("updates lastSeenPlayerAt when aware", () => {
        const player = makePlayer();
        player.loc = { x: 15, y: 20 };
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.flags |= MonsterBehaviorFlag.MONST_ALWAYS_HUNTING;
        monst.creatureState = CreatureState.TrackingScent;
        monst.lastSeenPlayerAt = { x: 0, y: 0 };
        const ctx = makeStateContext(player, [monst], {
            awareOfTarget: () => true,
        });
        // always-hunting returns early, but awareOfPlayer would be true via awareOfTarget
        // For this test, let's use a normal monster and set it up so it stays tracking
        monst.info.flags &= ~MonsterBehaviorFlag.MONST_ALWAYS_HUNTING;
        monst.creatureState = CreatureState.TrackingScent;
        const ctx2 = makeStateContext(player, [monst], {
            awareOfTarget: () => true,
            inFieldOfView: () => true,
        });
        updateMonsterState(monst, ctx2);
        expect(monst.lastSeenPlayerAt).toEqual({ x: 15, y: 20 });
    });
});

// =============================================================================
// decrementMonsterStatus
// =============================================================================

describe("decrementMonsterStatus", () => {
    it("clears MB_JUST_SUMMONED flag", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_JUST_SUMMONED;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_JUST_SUMMONED).toBe(0);
    });

    it("regenerates HP when not poisoned", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.turnsBetweenRegen = 1;
        monst.currentHP = monst.info.maxHP - 5;
        monst.turnsUntilRegen = 500; // will go to -500 then add 1000, net positive
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.currentHP).toBe(monst.info.maxHP - 4); // healed 1 HP
    });

    it("does not regen when poisoned", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.turnsBetweenRegen = 1;
        monst.currentHP = monst.info.maxHP - 5;
        monst.turnsUntilRegen = 500;
        monst.status[StatusEffect.Poisoned] = 3;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.currentHP).toBe(monst.info.maxHP - 5); // no heal
    });

    it("decrements levitating for non-flying monsters", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Levitating] = 10;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Levitating]).toBe(9);
    });

    it("does not decrement levitating for flying monsters", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.info.flags |= MonsterBehaviorFlag.MONST_FLIES;
        monst.status[StatusEffect.Levitating] = 10;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Levitating]).toBe(10);
    });

    it("resets speed when slow wears off", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Slowed] = 1;
        monst.movementSpeed = 200; // doubled
        monst.attackSpeed = 200;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Slowed]).toBe(0);
        expect(monst.movementSpeed).toBe(monst.info.movementSpeed);
        expect(monst.attackSpeed).toBe(monst.info.attackSpeed);
    });

    it("resets speed when haste wears off", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Hasted] = 1;
        monst.movementSpeed = 50; // halved
        monst.attackSpeed = 50;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Hasted]).toBe(0);
        expect(monst.movementSpeed).toBe(monst.info.movementSpeed);
        expect(monst.attackSpeed).toBe(monst.info.attackSpeed);
    });

    it("resets weakness amount when weakened wears off", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Weakened] = 1;
        monst.weaknessAmount = 5;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Weakened]).toBe(0);
        expect(monst.weaknessAmount).toBe(0);
    });

    it("burning monster takes damage", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Burning] = 5;
        const inflictDamage = vi.fn().mockReturnValue(false);
        const ctx = makeStateContext(player, [monst], {
            inflictDamage,
            rng: { randRange: () => 2, randPercent: () => false },
        });
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Burning]).toBe(4);
        expect(inflictDamage).toHaveBeenCalledWith(null, monst, 2);
    });

    it("fire immune monster does not take burn damage", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Burning] = 5;
        monst.status[StatusEffect.ImmuneToFire] = 100;
        const inflictDamage = vi.fn().mockReturnValue(false);
        const ctx = makeStateContext(player, [monst], {
            inflictDamage,
        });
        decrementMonsterStatus(monst, ctx);
        expect(inflictDamage).not.toHaveBeenCalled();
    });

    it("killing a burning monster returns true", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Burning] = 5;
        const killCreature = vi.fn();
        const ctx = makeStateContext(player, [monst], {
            inflictDamage: () => true,
            killCreature,
        });
        const died = decrementMonsterStatus(monst, ctx);
        expect(died).toBe(true);
        expect(killCreature).toHaveBeenCalledWith(monst, false);
    });

    it("lifespan expiry kills creature", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.LifespanRemaining] = 1;
        const killCreature = vi.fn();
        const ctx = makeStateContext(player, [monst], {
            killCreature,
        });
        const died = decrementMonsterStatus(monst, ctx);
        expect(died).toBe(true);
        expect(killCreature).toHaveBeenCalledWith(monst, false);
    });

    it("poison decrements and deals damage", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Poisoned] = 3;
        monst.poisonAmount = 2;
        const inflictDamage = vi.fn().mockReturnValue(false);
        const ctx = makeStateContext(player, [monst], { inflictDamage });
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Poisoned]).toBe(2);
        expect(inflictDamage).toHaveBeenCalledWith(null, monst, 2);
    });

    it("poison cleared resets poisonAmount", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Poisoned] = 1;
        monst.poisonAmount = 2;
        const inflictDamage = vi.fn().mockReturnValue(false);
        const ctx = makeStateContext(player, [monst], { inflictDamage });
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Poisoned]).toBe(0);
        expect(monst.poisonAmount).toBe(0);
    });

    it("stuck clears when terrain does not entangle", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Stuck] = 10;
        const ctx = makeStateContext(player, [monst], {
            cellHasTerrainFlag: () => false, // no T_ENTANGLES
        });
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Stuck]).toBe(0);
    });

    it("discord expiry restores ally state for player-led monster", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Discordant] = 1;
        monst.creatureState = CreatureState.Fleeing;
        monst.leader = player;
        const makeMonsterDropItem = vi.fn();
        const ctx = makeStateContext(player, [monst], { makeMonsterDropItem });
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Discordant]).toBe(0);
        expect(monst.creatureState).toBe(CreatureState.Ally);
    });

    it("magical fear expiry sets tracking for non-player-led", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.MagicalFear] = 1;
        monst.leader = null;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.MagicalFear]).toBe(0);
        expect(monst.creatureState).toBe(CreatureState.TrackingScent);
    });

    it("shield decays over time", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Shielded] = 100;
        monst.maxStatus[StatusEffect.Shielded] = 100;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Shielded]).toBe(95); // 100 - floor(100/20)
    });

    it("shield clears fully when depleted", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Shielded] = 3;
        monst.maxStatus[StatusEffect.Shielded] = 100;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Shielded]).toBe(0);
        expect(monst.maxStatus[StatusEffect.Shielded]).toBe(0);
    });

    it("default statuses decrement normally", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.status[StatusEffect.Confused] = 5;
        const ctx = makeStateContext(player, [monst]);
        decrementMonsterStatus(monst, ctx);
        expect(monst.status[StatusEffect.Confused]).toBe(4);
    });

    it("monster survives returns false", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeStateContext(player, [monst]);
        const died = decrementMonsterStatus(monst, ctx);
        expect(died).toBe(false);
    });
});
