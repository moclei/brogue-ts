/*
 *  combat-attack.test.ts — Tests for attack resolution functions
 *  brogue-ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    buildHitList,
    processStaggerHit,
    moralAttack,
    attack,
} from "../../src/combat/combat-attack.js";
import type { AttackContext } from "../../src/combat/combat-attack.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { monsterClassCatalog } from "../../src/globals/monster-class-catalog.js";
import { MonsterType, StatusEffect, CreatureState, Direction } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    ItemFlag,
    TerrainFlag,
} from "../../src/types/flags.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";
import type { Creature, Color, Pos, Item } from "../../src/types/types.js";

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
    c.currentHP = cat.maxHP;
    c.movementSpeed = cat.movementSpeed;
    c.attackSpeed = cat.attackSpeed;
    return c;
}

const white: Color = { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };
const red: Color = { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };
const green: Color = { red: 0, green: 100, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, colorDances: false, rand: 0 };

function makeAttackCtx(player: Creature, overrides?: Partial<AttackContext>): AttackContext {
    return {
        // CombatMathContext
        player,
        weapon: null,
        armor: null,
        playerStrength: 12,
        monsterClassCatalog,
        randPercent: () => true, // always hit by default

        // CombatDamageContext
        easyMode: false,
        transference: 0,
        playerTransferenceRatio: 100,
        canSeeMonster: () => true,
        canDirectlySeeMonster: () => true,
        wakeUp: vi.fn(),
        spawnDungeonFeature: vi.fn(),
        refreshSideBar: vi.fn(),
        combatMessage: vi.fn(),
        messageWithColor: vi.fn(),
        monsterName: (monst: Creature) => monst === player ? "you" : "the monster",
        gameOver: vi.fn(),
        setCreaturesWillFlash: vi.fn(),
        deleteItem: vi.fn(),
        makeMonsterDropItem: vi.fn(),
        clearLastTarget: vi.fn(),
        clearYendorWarden: vi.fn(),
        clearCellMonsterFlag: vi.fn(),
        prependCreature: vi.fn(),
        applyInstantTileEffectsToCreature: vi.fn(),
        fadeInMonster: vi.fn(),
        refreshDungeonCell: vi.fn(),
        anyoneWantABite: vi.fn(() => false),
        demoteMonsterFromLeadership: vi.fn(),
        checkForContinuedLeadership: vi.fn(),
        getMonsterDFMessage: () => "",
        resolvePronounEscapes: (text: string) => text,
        message: vi.fn(),
        monsterCatalog,
        updateEncumbrance: vi.fn(),
        updateMinersLightRadius: vi.fn(),
        updateVision: vi.fn(),
        badMessageColor: red,
        poisonColor: green,

        // AttackContext
        cellFlags: () => 0,
        cellHasTerrainFlag: () => false,
        getTerrainFlags: () => 0,
        monsterAtLoc: () => null,
        setMonsterLocation: vi.fn(),
        monsterWillAttackTarget: () => true,
        monsterIsInClass: () => false,
        randRange: (lo: number, hi: number) => lo,
        randClump: (d) => Math.floor((d.lowerBound + d.upperBound) / 2),
        blockCombatText: false,
        setDisturbed: vi.fn(),
        reaping: 0,
        magicWeaponHit: vi.fn(),
        applyArmorRunicEffect: () => "",
        specialHit: vi.fn(),
        splitMonster: vi.fn(),
        attackVerb: () => "hit",
        messageColorFromVictim: () => red,
        decrementWeaponAutoIDTimer: vi.fn(),
        rechargeItemsIncrementally: vi.fn(),
        equipItem: vi.fn(),
        itemName: () => "weapon",
        checkForDisenchantment: vi.fn(),
        strengthCheck: vi.fn(),
        itemMessageColor: white,
        handlePaladinFeat: vi.fn(),
        setPureMageFeatFailed: vi.fn(),
        setDragonslayerFeatAchieved: vi.fn(),
        reportHeardCombat: vi.fn(() => false),
        whiteColor: white,
        redColor: red,
        gameOverFromMonster: vi.fn(),
        unAlly: vi.fn(),
        alertMonster: vi.fn(),

        ...overrides,
    };
}

// =============================================================================
// buildHitList
// =============================================================================

describe("buildHitList", () => {
    it("returns single target for non-sweep attacks", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        const ctx = makeAttackCtx(player);

        const hitList = buildHitList(player, goblin, false, ctx);
        expect(hitList[0]).toBe(goblin);
        // All other slots are null
        for (let i = 1; i < 8; i++) {
            expect(hitList[i]).toBeNull();
        }
    });

    it("returns 8-element array for sweep attacks", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        const ctx = makeAttackCtx(player);

        const hitList = buildHitList(player, goblin, true, ctx);
        expect(hitList).toHaveLength(8);
    });

    it("includes adjacent enemies in sweep", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin1 = makeCreature(MonsterType.MK_GOBLIN);
        goblin1.loc = { x: 6, y: 5 };
        const goblin2 = makeCreature(MonsterType.MK_GOBLIN);
        goblin2.loc = { x: 5, y: 6 };

        const ctx = makeAttackCtx(player, {
            cellFlags: (loc: Pos) => {
                if ((loc.x === 6 && loc.y === 5) || (loc.x === 5 && loc.y === 6)) return 0x1;
                return 0;
            },
            monsterAtLoc: (loc: Pos) => {
                if (loc.x === 6 && loc.y === 5) return goblin1;
                if (loc.x === 5 && loc.y === 6) return goblin2;
                return null;
            },
        });

        const hitList = buildHitList(player, goblin1, true, ctx);
        const hits = hitList.filter((h) => h !== null);
        expect(hits.length).toBeGreaterThanOrEqual(1);
        expect(hits).toContain(goblin1);
    });
});

// =============================================================================
// processStaggerHit
// =============================================================================

describe("processStaggerHit", () => {
    it("pushes defender away from attacker", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        const ctx = makeAttackCtx(player);

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).toHaveBeenCalledWith(goblin, { x: 7, y: 5 });
    });

    it("does nothing for invulnerable defenders", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        goblin.info.flags |= MonsterBehaviorFlag.MONST_INVULNERABLE;
        const ctx = makeAttackCtx(player);

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).not.toHaveBeenCalled();
    });

    it("does nothing for immobile defenders", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        goblin.info.flags |= MonsterBehaviorFlag.MONST_IMMOBILE;
        const ctx = makeAttackCtx(player);

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).not.toHaveBeenCalled();
    });

    it("does nothing for captive defenders", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_CAPTIVE;
        const ctx = makeAttackCtx(player);

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).not.toHaveBeenCalled();
    });

    it("does nothing if destination is blocked", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        const ctx = makeAttackCtx(player, {
            cellHasTerrainFlag: (loc: Pos, flags: number) => {
                if (loc.x === 7 && loc.y === 5) return true; // blocked
                return false;
            },
        });

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).not.toHaveBeenCalled();
    });

    it("does nothing if destination has another creature", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        const ctx = makeAttackCtx(player, {
            cellFlags: (loc: Pos) => {
                if (loc.x === 7 && loc.y === 5) return 0x1; // HAS_MONSTER
                return 0;
            },
        });

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).not.toHaveBeenCalled();
    });

    it("pushes diagonally when attacker is diagonal", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 6 };
        const ctx = makeAttackCtx(player);

        processStaggerHit(player, goblin, ctx);
        expect(ctx.setMonsterLocation).toHaveBeenCalledWith(goblin, { x: 7, y: 7 });
    });
});

// =============================================================================
// moralAttack
// =============================================================================

describe("moralAttack", () => {
    it("breaks paralysis on defender", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 10;
        goblin.status[StatusEffect.Paralyzed] = 5;
        const ctx = makeAttackCtx(player);

        moralAttack(player, goblin, ctx);
        expect(goblin.status[StatusEffect.Paralyzed]).toBe(0);
    });

    it("gives paralyzed defender a reaction tick", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.attackSpeed = 100;
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 10;
        goblin.status[StatusEffect.Paralyzed] = 5;
        goblin.ticksUntilTurn = 500;
        const ctx = makeAttackCtx(player);

        moralAttack(player, goblin, ctx);
        // ticksUntilTurn = min(attackSpeed, 100) - 1
        expect(goblin.ticksUntilTurn).toBe(Math.min(player.attackSpeed, 100) - 1);
    });

    it("reduces magical fear to 1", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 10;
        goblin.status[StatusEffect.MagicalFear] = 10;
        const ctx = makeAttackCtx(player);

        moralAttack(player, goblin, ctx);
        expect(goblin.status[StatusEffect.MagicalFear]).toBe(1);
    });

    it("clears entrancement", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 10;
        goblin.status[StatusEffect.Entranced] = 5;
        const ctx = makeAttackCtx(player);

        moralAttack(player, goblin, ctx);
        expect(goblin.status[StatusEffect.Entranced]).toBe(0);
    });

    it("enrages corridor-avoiding monsters", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const monster = makeCreature(MonsterType.MK_GOBLIN);
        monster.currentHP = 10;
        monster.info.abilityFlags |= MonsterAbilityFlag.MA_AVOID_CORRIDORS;
        const ctx = makeAttackCtx(player);

        moralAttack(player, monster, ctx);
        expect(monster.status[StatusEffect.Enraged]).toBe(4);
        expect(monster.maxStatus[StatusEffect.Enraged]).toBe(4);
    });

    it("un-allies ally when attacked by non-confused player", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const ally = makeCreature(MonsterType.MK_GOBLIN);
        ally.currentHP = 10;
        ally.creatureState = CreatureState.Ally;
        const ctx = makeAttackCtx(player);

        moralAttack(player, ally, ctx);
        expect(ctx.unAlly).toHaveBeenCalledWith(ally);
    });

    it("does not un-ally if defender is discordant", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const ally = makeCreature(MonsterType.MK_GOBLIN);
        ally.currentHP = 10;
        ally.creatureState = CreatureState.Ally;
        ally.status[StatusEffect.Discordant] = 5;
        const ctx = makeAttackCtx(player);

        moralAttack(player, ally, ctx);
        expect(ctx.unAlly).not.toHaveBeenCalled();
    });

    it("does not un-ally if attacker is confused", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        player.status[StatusEffect.Confused] = 5;
        const ally = makeCreature(MonsterType.MK_GOBLIN);
        ally.currentHP = 10;
        ally.creatureState = CreatureState.Ally;
        const ctx = makeAttackCtx(player);

        moralAttack(player, ally, ctx);
        expect(ctx.unAlly).not.toHaveBeenCalled();
    });

    it("alerts enemy when attacked by player", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const enemy = makeCreature(MonsterType.MK_GOBLIN);
        enemy.currentHP = 10;
        enemy.creatureState = CreatureState.Wandering;
        const ctx = makeAttackCtx(player);

        moralAttack(player, enemy, ctx);
        expect(ctx.alertMonster).toHaveBeenCalledWith(enemy);
    });

    it("does nothing if defender is dead", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 0;
        goblin.status[StatusEffect.Paralyzed] = 5;
        const ctx = makeAttackCtx(player);

        moralAttack(player, goblin, ctx);
        expect(goblin.status[StatusEffect.Paralyzed]).toBe(5); // unchanged
    });

    it("does nothing if defender is dying", () => {
        const player = makeCreature(MonsterType.MK_YOU);
        const goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.currentHP = 10;
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        goblin.status[StatusEffect.Paralyzed] = 5;
        const ctx = makeAttackCtx(player);

        moralAttack(player, goblin, ctx);
        expect(goblin.status[StatusEffect.Paralyzed]).toBe(5); // unchanged
    });
});

// =============================================================================
// attack
// =============================================================================

describe("attack", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: AttackContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        player.info.accuracy = 100;
        player.info.damage = { lowerBound: 3, upperBound: 7, clumpFactor: 1 };

        goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        goblin.currentHP = 20;
        goblin.info.maxHP = 20;
        goblin.info.defense = 0;

        ctx = makeAttackCtx(player);
    });

    it("returns true when attack hits", () => {
        expect(attack(player, goblin, false, ctx)).toBe(true);
    });

    it("returns false when attack misses", () => {
        goblin.creatureState = CreatureState.TrackingScent; // Not sleeping/wandering
        ctx = makeAttackCtx(player, { randPercent: () => false });
        expect(attack(player, goblin, false, ctx)).toBe(false);
    });

    it("kamikaze attacker kills itself and returns true", () => {
        const kamikaze = makeCreature(MonsterType.MK_GOBLIN);
        kamikaze.loc = { x: 4, y: 5 };
        kamikaze.info.abilityFlags |= MonsterAbilityFlag.MA_KAMIKAZE;
        kamikaze.currentHP = 10;
        const result = attack(kamikaze, goblin, false, ctx);
        expect(result).toBe(true);
        expect(kamikaze.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
    });

    it("aquatic attackers cannot hit levitating defenders", () => {
        const aquatic = makeCreature(MonsterType.MK_GOBLIN);
        aquatic.loc = { x: 4, y: 5 };
        aquatic.info.flags |= MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID;
        goblin.status[StatusEffect.Levitating] = 10;
        expect(attack(aquatic, goblin, false, ctx)).toBe(false);
    });

    it("seizes defender instead of attacking when conditions are met", () => {
        const seizer = makeCreature(MonsterType.MK_GOBLIN);
        seizer.loc = { x: 5, y: 4 };
        seizer.info.abilityFlags |= MonsterAbilityFlag.MA_SEIZES;
        goblin.loc = { x: 5, y: 5 };
        const result = attack(seizer, goblin, false, ctx);
        expect(result).toBe(false);
        expect(seizer.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING).toBeTruthy();
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED).toBeTruthy();
    });

    it("sneak attacks deal triple damage", () => {
        goblin.creatureState = CreatureState.Wandering;
        // randClump returns average of 5
        let inflictedDamage = 0;
        ctx = makeAttackCtx(player, {
            randClump: () => 5,
            randPercent: () => true,
        });
        // Capture the damage by spying on the inflictDamage path
        const origCombatMsg = ctx.combatMessage;
        attack(player, goblin, false, ctx);
        // Goblin was wandering, player attacking = sneak attack = 3x damage
        // Base 5 * 3 = 15 damage, goblin had 20 HP -> should survive
        expect(goblin.currentHP).toBe(5);
    });

    it("lunge attacks deal triple damage", () => {
        ctx = makeAttackCtx(player, { randClump: () => 5 });
        attack(player, goblin, true, ctx);
        // 5 * 3 = 15 damage
        expect(goblin.currentHP).toBe(5);
    });

    it("dagger sneak attacks deal 5x damage", () => {
        goblin.creatureState = CreatureState.Wandering;
        const dagger: Item = {
            category: 0,
            kind: 0,
            flags: ItemFlag.ITEM_SNEAK_ATTACK_BONUS,
            damage: { lowerBound: 3, upperBound: 5, clumpFactor: 1 },
            armor: 0,
            charges: 0,
            enchant1: 0,
            enchant2: 0,
            timesEnchanted: 0,
            vorpalEnemy: 0 as MonsterType,
            strengthRequired: 10,
            quiverNumber: 0,
            displayChar: 0,
            foreColor: null,
            inventoryColor: null,
            quantity: 1,
            inventoryLetter: "a",
            inscription: "",
            loc: { x: -1, y: -1 },
            keyLoc: [],
            originDepth: 0,
            spawnTurnNumber: 0,
            lastUsed: [0, 0, 0],
        };
        ctx = makeAttackCtx(player, {
            weapon: dagger,
            randClump: () => 4,
        });
        attack(player, goblin, false, ctx);
        // 4 * 5 = 20, goblin has 20 HP -> dead
        expect(goblin.currentHP).toBe(0);
    });

    it("calls moralAttack on hit", () => {
        // Just verify alertMonster is called (a side effect of moralAttack for non-ally enemies)
        goblin.creatureState = CreatureState.TrackingScent;
        attack(player, goblin, false, ctx);
        expect(ctx.alertMonster).toHaveBeenCalled();
    });

    it("calls splitMonster on hit", () => {
        attack(player, goblin, false, ctx);
        expect(ctx.splitMonster).toHaveBeenCalledWith(goblin, player);
    });

    it("calls magicWeaponHit with runic weapon", () => {
        const runicWeapon: Item = {
            category: 0,
            kind: 0,
            flags: ItemFlag.ITEM_RUNIC,
            damage: { lowerBound: 3, upperBound: 7, clumpFactor: 1 },
            armor: 0,
            charges: 0,
            enchant1: 3,
            enchant2: 0,
            timesEnchanted: 0,
            vorpalEnemy: 0 as MonsterType,
            strengthRequired: 10,
            quiverNumber: 0,
            displayChar: 0,
            foreColor: null,
            inventoryColor: null,
            quantity: 1,
            inventoryLetter: "a",
            inscription: "",
            loc: { x: -1, y: -1 },
            keyLoc: [],
            originDepth: 0,
            spawnTurnNumber: 0,
            lastUsed: [0, 0, 0],
        };
        ctx = makeAttackCtx(player, { weapon: runicWeapon, randClump: () => 3 });
        attack(player, goblin, false, ctx);
        expect(ctx.magicWeaponHit).toHaveBeenCalled();
    });

    it("immune to weapons takes 0 damage", () => {
        goblin.info.flags |= MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS;
        const origHP = goblin.currentHP;
        attack(player, goblin, false, ctx);
        expect(goblin.currentHP).toBe(origHP);
    });

    it("handles paladin feat check", () => {
        attack(player, goblin, false, ctx);
        expect(ctx.handlePaladinFeat).toHaveBeenCalledWith(goblin);
    });

    it("shows miss message when attack misses", () => {
        ctx = makeAttackCtx(player, { randPercent: () => false });
        attack(player, goblin, false, ctx);
        expect(ctx.combatMessage).toHaveBeenCalled();
    });

    it("poison attack converts damage", () => {
        const poisoner = makeCreature(MonsterType.MK_GOBLIN);
        poisoner.loc = { x: 4, y: 5 };
        poisoner.info.abilityFlags |= MonsterAbilityFlag.MA_POISONS;
        poisoner.info.accuracy = 100;
        poisoner.info.damage = { lowerBound: 5, upperBound: 5, clumpFactor: 1 };
        ctx = makeAttackCtx(player, { randClump: () => 5 });
        const origHP = goblin.currentHP;
        attack(poisoner, goblin, false, ctx);
        // Poison: damage becomes 1, rest becomes poisonDamage passed to specialHit
        expect(goblin.currentHP).toBe(origHP - 1);
    });

    it("wandering monster starts tracking when attacking player", () => {
        const monster = makeCreature(MonsterType.MK_OGRE);
        monster.loc = { x: 4, y: 5 };
        monster.creatureState = CreatureState.Wandering;
        monster.info.accuracy = 100;
        monster.info.damage = { lowerBound: 1, upperBound: 3, clumpFactor: 1 };
        ctx = makeAttackCtx(player, { randClump: () => 1 });
        player.currentHP = 100;
        player.info.maxHP = 100;
        attack(monster, player, false, ctx);
        expect(monster.creatureState).toBe(CreatureState.TrackingScent);
    });
});
