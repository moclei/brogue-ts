/*
 *  monster-queries.test.ts — Tests for monster queries & visibility
 *  brogue-ts
 */

import { describe, it, expect } from "vitest";
import {
    monsterRevealed,
    monsterHiddenBySubmersion,
    monsterIsHidden,
    canSeeMonster,
    canDirectlySeeMonster,
    monsterName,
    monsterIsInClass,
    attackWouldBeFutile,
    monsterWillAttackTarget,
    monstersAreTeammates,
    monstersAreEnemies,
} from "../../src/monsters/monster-queries.js";
import type { MonsterQueryContext } from "../../src/monsters/monster-queries.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { monsterClassCatalog } from "../../src/globals/monster-class-catalog.js";
import { MonsterType, StatusEffect, CreatureState } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    TerrainFlag,
} from "../../src/types/flags.js";
import type { Creature, MonsterClass } from "../../src/types/types.js";

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
    c.status = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    c.maxStatus = new Array(StatusEffect.NumberOfStatusEffects).fill(0);
    return c;
}

function makePlayer(): Creature {
    return makeCreature(MonsterType.MK_YOU);
}

function makeQueryContext(
    player: Creature,
    overrides?: Partial<MonsterQueryContext>,
): MonsterQueryContext {
    return {
        player,
        cellHasTerrainFlag: () => false,
        cellHasGas: () => false,
        playerCanSee: () => true,
        playerCanDirectlySee: () => true,
        playbackOmniscience: false,
        ...overrides,
    };
}

// =============================================================================
// monsterRevealed
// =============================================================================

describe("monsterRevealed", () => {
    it("returns false for the player", () => {
        const player = makePlayer();
        expect(monsterRevealed(player, player)).toBe(false);
    });

    it("returns true for telepathically revealed monsters", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED;
        expect(monsterRevealed(goblin, player)).toBe(true);
    });

    it("returns true for entranced monsters", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.status[StatusEffect.Entranced] = 5;
        expect(monsterRevealed(goblin, player)).toBe(true);
    });

    it("returns true when player is telepathic and monster is animate", () => {
        const player = makePlayer();
        player.status[StatusEffect.Telepathic] = 100;
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        expect(monsterRevealed(goblin, player)).toBe(true);
    });

    it("returns false when player is telepathic but monster is inanimate", () => {
        const player = makePlayer();
        player.status[StatusEffect.Telepathic] = 100;
        const totem = makeCreature(MonsterType.MK_GOBLIN_TOTEM); // inanimate
        expect(monsterRevealed(totem, player)).toBe(false);
    });
});

// =============================================================================
// monsterHiddenBySubmersion
// =============================================================================

describe("monsterHiddenBySubmersion", () => {
    it("returns false when monster is not submerged", () => {
        const eel = makeCreature(MonsterType.MK_EEL);
        expect(monsterHiddenBySubmersion(eel, null, () => false)).toBe(false);
    });

    it("returns true when monster is submerged and observer is not in deep water", () => {
        const eel = makeCreature(MonsterType.MK_EEL);
        eel.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
        const observer = makePlayer();
        expect(monsterHiddenBySubmersion(eel, observer, () => false)).toBe(true);
    });

    it("returns false when both are in deep water", () => {
        const eel = makeCreature(MonsterType.MK_EEL);
        eel.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
        const observer = makePlayer();
        const cellHasTerrainFlag = (_loc: any, flag: number) =>
            flag === TerrainFlag.T_IS_DEEP_WATER;
        expect(monsterHiddenBySubmersion(eel, observer, cellHasTerrainFlag)).toBe(false);
    });

    it("returns true when observer is levitating over deep water", () => {
        const eel = makeCreature(MonsterType.MK_EEL);
        eel.bookkeepingFlags |= MonsterBookkeepingFlag.MB_SUBMERGED;
        const observer = makePlayer();
        observer.status[StatusEffect.Levitating] = 100;
        const cellHasTerrainFlag = (_loc: any, flag: number) =>
            flag === TerrainFlag.T_IS_DEEP_WATER;
        expect(monsterHiddenBySubmersion(eel, observer, cellHasTerrainFlag)).toBe(true);
    });
});

// =============================================================================
// monstersAreTeammates
// =============================================================================

describe("monstersAreTeammates", () => {
    it("leader-follower pair are teammates", () => {
        const player = makePlayer();
        const leader = makeCreature(MonsterType.MK_OGRE);
        const follower = makeCreature(MonsterType.MK_GOBLIN);
        follower.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
        follower.leader = leader;
        expect(monstersAreTeammates(follower, leader, player)).toBe(true);
        expect(monstersAreTeammates(leader, follower, player)).toBe(true);
    });

    it("two allies of the player are teammates", () => {
        const player = makePlayer();
        const ally1 = makeCreature(MonsterType.MK_OGRE);
        ally1.creatureState = CreatureState.Ally;
        const ally2 = makeCreature(MonsterType.MK_GOBLIN);
        ally2.creatureState = CreatureState.Ally;
        expect(monstersAreTeammates(ally1, ally2, player)).toBe(true);
    });

    it("player and ally are teammates", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_OGRE);
        ally.creatureState = CreatureState.Ally;
        expect(monstersAreTeammates(player, ally, player)).toBe(true);
        expect(monstersAreTeammates(ally, player, player)).toBe(true);
    });

    it("unrelated enemies are not teammates", () => {
        const player = makePlayer();
        const enemy1 = makeCreature(MonsterType.MK_OGRE);
        const enemy2 = makeCreature(MonsterType.MK_GOBLIN);
        expect(monstersAreTeammates(enemy1, enemy2, player)).toBe(false);
    });
});

// =============================================================================
// monstersAreEnemies
// =============================================================================

describe("monstersAreEnemies", () => {
    it("captive is never an enemy", () => {
        const player = makePlayer();
        const captive = makeCreature(MonsterType.MK_OGRE);
        captive.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        expect(monstersAreEnemies(captive, player, player, () => false)).toBe(false);
    });

    it("same creature is not its own enemy", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_OGRE);
        expect(monstersAreEnemies(monst, monst, player, () => false)).toBe(false);
    });

    it("discordant creatures are enemies of everyone", () => {
        const player = makePlayer();
        const monst1 = makeCreature(MonsterType.MK_OGRE);
        const monst2 = makeCreature(MonsterType.MK_GOBLIN);
        monst1.status[StatusEffect.Discordant] = 100;
        expect(monstersAreEnemies(monst1, monst2, player, () => false)).toBe(true);
    });

    it("hostile monster and player are enemies", () => {
        const player = makePlayer();
        const hostile = makeCreature(MonsterType.MK_OGRE);
        hostile.creatureState = CreatureState.TrackingScent;
        expect(monstersAreEnemies(hostile, player, player, () => false)).toBe(true);
    });

    it("ally and hostile are enemies", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_OGRE);
        ally.creatureState = CreatureState.Ally;
        const hostile = makeCreature(MonsterType.MK_GOBLIN);
        hostile.creatureState = CreatureState.TrackingScent;
        expect(monstersAreEnemies(ally, hostile, player, () => false)).toBe(true);
    });

    it("two hostile monsters are not enemies of each other", () => {
        const player = makePlayer();
        const m1 = makeCreature(MonsterType.MK_OGRE);
        m1.creatureState = CreatureState.TrackingScent;
        const m2 = makeCreature(MonsterType.MK_GOBLIN);
        m2.creatureState = CreatureState.TrackingScent;
        expect(monstersAreEnemies(m1, m2, player, () => false)).toBe(false);
    });
});

// =============================================================================
// monsterIsHidden
// =============================================================================

describe("monsterIsHidden", () => {
    it("dormant monsters are always hidden", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_GOBLIN);
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DORMANT;
        const ctx = makeQueryContext(player);
        expect(monsterIsHidden(monst, player, ctx)).toBe(true);
    });

    it("invisible monsters are hidden when not in gas", () => {
        const player = makePlayer();
        const phantom = makeCreature(MonsterType.MK_PHANTOM);
        phantom.status[StatusEffect.Invisible] = 1000;
        const ctx = makeQueryContext(player, { cellHasGas: () => false });
        expect(monsterIsHidden(phantom, player, ctx)).toBe(true);
    });

    it("invisible monsters are visible when in gas", () => {
        const player = makePlayer();
        const phantom = makeCreature(MonsterType.MK_PHANTOM);
        phantom.status[StatusEffect.Invisible] = 1000;
        const ctx = makeQueryContext(player, { cellHasGas: () => true });
        expect(monsterIsHidden(phantom, player, ctx)).toBe(false);
    });

    it("teammates are never hidden from each other", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_PHANTOM);
        ally.creatureState = CreatureState.Ally;
        ally.status[StatusEffect.Invisible] = 1000;
        const ctx = makeQueryContext(player);
        expect(monsterIsHidden(ally, player, ctx)).toBe(false);
    });
});

// =============================================================================
// canSeeMonster
// =============================================================================

describe("canSeeMonster", () => {
    it("player can always see itself", () => {
        const player = makePlayer();
        const ctx = makeQueryContext(player);
        expect(canSeeMonster(player, ctx)).toBe(true);
    });

    it("visible monster on lit cell is seen", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeQueryContext(player, { playerCanSee: () => true });
        expect(canSeeMonster(goblin, ctx)).toBe(true);
    });

    it("hidden monster on lit cell is not seen", () => {
        const player = makePlayer();
        const phantom = makeCreature(MonsterType.MK_PHANTOM);
        phantom.status[StatusEffect.Invisible] = 1000;
        const ctx = makeQueryContext(player, { playerCanSee: () => true, cellHasGas: () => false });
        expect(canSeeMonster(phantom, ctx)).toBe(false);
    });

    it("revealed monster on dark cell is seen", () => {
        const player = makePlayer();
        player.status[StatusEffect.Telepathic] = 100;
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeQueryContext(player, { playerCanSee: () => false });
        expect(canSeeMonster(goblin, ctx)).toBe(true);
    });
});

// =============================================================================
// monsterName
// =============================================================================

describe("monsterName", () => {
    it("returns 'you' for the player", () => {
        const player = makePlayer();
        const ctx = makeQueryContext(player);
        expect(monsterName(player, true, ctx)).toBe("you");
    });

    it("returns monster name with article for visible monsters", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeQueryContext(player);
        expect(monsterName(goblin, true, ctx)).toBe("the goblin");
    });

    it("returns 'your' article for allies", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_OGRE);
        ally.creatureState = CreatureState.Ally;
        const ctx = makeQueryContext(player);
        expect(monsterName(ally, true, ctx)).toBe("your ogre");
    });

    it("returns 'something' for hidden monsters", () => {
        const player = makePlayer();
        const phantom = makeCreature(MonsterType.MK_PHANTOM);
        phantom.status[StatusEffect.Invisible] = 1000;
        const ctx = makeQueryContext(player, {
            playerCanSee: () => true,
            cellHasGas: () => false,
        });
        expect(monsterName(phantom, true, ctx)).toBe("something");
    });

    it("returns name without article when includeArticle is false", () => {
        const player = makePlayer();
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        const ctx = makeQueryContext(player);
        expect(monsterName(goblin, false, ctx)).toBe("goblin");
    });
});

// =============================================================================
// monsterIsInClass
// =============================================================================

describe("monsterIsInClass", () => {
    it("correctly identifies a monster in its class", () => {
        const ogre = makeCreature(MonsterType.MK_OGRE);
        // Find a class that contains ogres
        const ogreClass = monsterClassCatalog.find(mc =>
            mc.memberList.includes(MonsterType.MK_OGRE),
        );
        if (ogreClass) {
            expect(monsterIsInClass(ogre, ogreClass)).toBe(true);
        }
    });

    it("returns false for a monster not in the class", () => {
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        // Create a custom class with no goblin
        const testClass: MonsterClass = {
            name: "test",
            frequency: 1,
            maxDepth: 40,
            memberList: [MonsterType.MK_DRAGON, MonsterType.MK_OGRE],
        };
        expect(monsterIsInClass(goblin, testClass)).toBe(false);
    });
});

// =============================================================================
// attackWouldBeFutile
// =============================================================================

describe("attackWouldBeFutile", () => {
    it("returns true for invulnerable defenders (non-player attacker)", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        const defender = makeCreature(MonsterType.MK_WARDEN_OF_YENDOR); // invulnerable
        expect(attackWouldBeFutile(attacker, defender, player, () => false)).toBe(true);
    });

    it("player can attack invulnerable targets (let player decide)", () => {
        const player = makePlayer();
        const defender = makeCreature(MonsterType.MK_WARDEN_OF_YENDOR);
        expect(attackWouldBeFutile(player, defender, player, () => false)).toBe(false);
    });

    it("returns true for weapon-immune defenders without MA_POISONS attacker", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        const defender = makeCreature(MonsterType.MK_REVENANT); // immune to weapons
        expect(attackWouldBeFutile(attacker, defender, player, () => false)).toBe(true);
    });
});

// =============================================================================
// monsterWillAttackTarget
// =============================================================================

describe("monsterWillAttackTarget", () => {
    it("returns false when attacker is the defender", () => {
        const player = makePlayer();
        const monst = makeCreature(MonsterType.MK_OGRE);
        expect(monsterWillAttackTarget(monst, monst, player, () => false)).toBe(false);
    });

    it("returns false for dying defenders", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        expect(monsterWillAttackTarget(attacker, defender, player, () => false)).toBe(false);
    });

    it("player attacks discordant ally", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_OGRE);
        ally.creatureState = CreatureState.Ally;
        ally.status[StatusEffect.Discordant] = 100;
        expect(monsterWillAttackTarget(player, ally, player, () => false)).toBe(true);
    });

    it("player does not attack non-discordant ally", () => {
        const player = makePlayer();
        const ally = makeCreature(MonsterType.MK_OGRE);
        ally.creatureState = CreatureState.Ally;
        expect(monsterWillAttackTarget(player, ally, player, () => false)).toBe(false);
    });

    it("entranced attacker attacks non-allies", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        attacker.status[StatusEffect.Entranced] = 100;
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        expect(monsterWillAttackTarget(attacker, defender, player, () => false)).toBe(true);
    });

    it("does not attack captives", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        defender.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        expect(monsterWillAttackTarget(attacker, defender, player, () => false)).toBe(false);
    });

    it("confused monsters attack anything", () => {
        const player = makePlayer();
        const attacker = makeCreature(MonsterType.MK_OGRE);
        attacker.status[StatusEffect.Confused] = 100;
        const defender = makeCreature(MonsterType.MK_GOBLIN);
        expect(monsterWillAttackTarget(attacker, defender, player, () => false)).toBe(true);
    });

    it("hostile monster attacks player", () => {
        const player = makePlayer();
        const hostile = makeCreature(MonsterType.MK_OGRE);
        hostile.creatureState = CreatureState.TrackingScent;
        expect(monsterWillAttackTarget(hostile, player, player, () => false)).toBe(true);
    });
});
