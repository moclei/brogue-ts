/*
 *  combat-runics.test.ts — Tests for weapon/armor runic effects and special hits
 *  brogue-ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    specialHit,
    magicWeaponHit,
    applyArmorRunicEffect,
} from "../../src/combat/combat-runics.js";
import type { RunicContext } from "../../src/combat/combat-runics.js";
import { createCreature } from "../../src/monsters/monster-creation.js";
import { monsterCatalog } from "../../src/globals/monster-catalog.js";
import { monsterClassCatalog } from "../../src/globals/monster-class-catalog.js";
import { MonsterType, StatusEffect, CreatureState, WeaponEnchant, ArmorEnchant, ItemCategory } from "../../src/types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    ItemFlag,
    SPECIAL_HIT,
} from "../../src/types/flags.js";
import { FP_FACTOR } from "../../src/math/fixpt.js";
import type { Creature, Color, Item } from "../../src/types/types.js";

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

function makeWeapon(enchant2: WeaponEnchant, enchant1 = 3, vorpalEnemy = 0): Item {
    return {
        category: ItemCategory.WEAPON,
        kind: 0,
        flags: ItemFlag.ITEM_RUNIC,
        damage: { lowerBound: 3, upperBound: 7, clumpFactor: 1 },
        armor: 0,
        charges: 0,
        enchant1,
        enchant2,
        timesEnchanted: 0,
        vorpalEnemy: vorpalEnemy as MonsterType,
        strengthRequired: 12,
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
}

function makeArmor(enchant2: ArmorEnchant, enchant1 = 3, vorpalEnemy = 0): Item {
    return {
        category: ItemCategory.ARMOR,
        kind: 0,
        flags: ItemFlag.ITEM_RUNIC,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 10,
        charges: 0,
        enchant1,
        enchant2,
        timesEnchanted: 0,
        vorpalEnemy: vorpalEnemy as MonsterType,
        strengthRequired: 12,
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
}

function makeRunicCtx(player: Creature, overrides?: Partial<RunicContext>): RunicContext {
    return {
        player,
        weapon: null,
        armor: null,
        playerStrength: 12,
        monsterClassCatalog,
        randPercent: () => true,
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
        monsterName: () => "the monster",
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
        armorRunicIdentified: () => false,
        autoIdentify: vi.fn(),
        createFlare: vi.fn(),
        cloneMonster: vi.fn(() => null),
        playerImmuneToMonster: () => false,
        slow: vi.fn(),
        weaken: vi.fn(),
        exposeCreatureToFire: vi.fn(),
        monsterStealsFromPlayer: vi.fn(),
        monstersAreEnemies: () => true,
        onHitHallucinateDuration: 10,
        onHitWeakenDuration: 10,
        onHitMercyHealPercent: 50,
        forceWeaponHit: vi.fn(() => true),
        ...overrides,
    };
}

// =============================================================================
// specialHit
// =============================================================================

describe("specialHit", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: RunicContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        ctx = makeRunicCtx(player);
    });

    it("does nothing without SPECIAL_HIT abilities", () => {
        goblin.info.abilityFlags = 0;
        specialHit(goblin, player, 5, ctx);
        expect(ctx.weaken).not.toHaveBeenCalled();
    });

    it("applies poison on poisonous attack", () => {
        const poisoner = makeCreature(MonsterType.MK_GOBLIN);
        poisoner.info.abilityFlags |= MonsterAbilityFlag.MA_POISONS;
        const target = makeCreature(MonsterType.MK_GOBLIN);
        target.currentHP = 20;
        target.info.maxHP = 20;
        specialHit(poisoner, target, 5, ctx);
        expect(target.status[StatusEffect.Poisoned]).toBe(5);
        expect(target.poisonAmount).toBe(1);
    });

    it("does not poison inanimate defenders", () => {
        const poisoner = makeCreature(MonsterType.MK_GOBLIN);
        poisoner.info.abilityFlags |= MonsterAbilityFlag.MA_POISONS;
        const target = makeCreature(MonsterType.MK_GOBLIN);
        target.info.flags |= MonsterBehaviorFlag.MONST_INANIMATE;
        specialHit(poisoner, target, 5, ctx);
        expect(target.status[StatusEffect.Poisoned]).toBe(0);
    });

    it("applies weakness on weakness-causing attack", () => {
        const weakener = makeCreature(MonsterType.MK_GOBLIN);
        weakener.info.abilityFlags |= MonsterAbilityFlag.MA_CAUSES_WEAKNESS;
        specialHit(weakener, goblin, 5, ctx);
        expect(ctx.weaken).toHaveBeenCalledWith(goblin, 10);
    });

    it("does not apply weakness for 0 damage", () => {
        const weakener = makeCreature(MonsterType.MK_GOBLIN);
        weakener.info.abilityFlags |= MonsterAbilityFlag.MA_CAUSES_WEAKNESS;
        specialHit(weakener, goblin, 0, ctx);
        expect(ctx.weaken).not.toHaveBeenCalled();
    });

    it("applies stagger on stagger attack", () => {
        const staggerer = makeCreature(MonsterType.MK_GOBLIN);
        staggerer.loc = { x: 4, y: 5 };
        staggerer.info.abilityFlags |= MonsterAbilityFlag.MA_ATTACKS_STAGGER;
        specialHit(staggerer, goblin, 5, ctx);
        expect(ctx.setMonsterLocation).toHaveBeenCalled();
    });

    it("returns early if player is immune", () => {
        const attacker = makeCreature(MonsterType.MK_GOBLIN);
        attacker.info.abilityFlags |= MonsterAbilityFlag.MA_HIT_HALLUCINATE;
        ctx = makeRunicCtx(player, { playerImmuneToMonster: () => true });
        specialHit(attacker, player, 5, ctx);
        expect(player.status[StatusEffect.Hallucinating]).toBe(0);
    });

    it("applies hallucination to player", () => {
        const attacker = makeCreature(MonsterType.MK_GOBLIN);
        attacker.info.abilityFlags |= MonsterAbilityFlag.MA_HIT_HALLUCINATE;
        specialHit(attacker, player, 5, ctx);
        expect(player.status[StatusEffect.Hallucinating]).toBe(10);
    });

    it("applies fire to player", () => {
        const burner = makeCreature(MonsterType.MK_GOBLIN);
        burner.info.abilityFlags |= MonsterAbilityFlag.MA_HIT_BURN;
        specialHit(burner, player, 5, ctx);
        expect(ctx.exposeCreatureToFire).toHaveBeenCalledWith(player);
    });

    it("does not burn fire-immune player", () => {
        const burner = makeCreature(MonsterType.MK_GOBLIN);
        burner.info.abilityFlags |= MonsterAbilityFlag.MA_HIT_BURN;
        player.status[StatusEffect.ImmuneToFire] = 10;
        specialHit(burner, player, 5, ctx);
        expect(ctx.exposeCreatureToFire).not.toHaveBeenCalled();
    });
});

// =============================================================================
// magicWeaponHit
// =============================================================================

describe("magicWeaponHit", () => {
    let player: Creature;
    let goblin: Creature;
    let ctx: RunicContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        goblin = makeCreature(MonsterType.MK_GOBLIN);
        goblin.loc = { x: 6, y: 5 };
        goblin.currentHP = 20;
        goblin.info.maxHP = 20;
        ctx = makeRunicCtx(player);
    });

    it("returns early if defender is dying and not speed/multiplicity", () => {
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        const weapon = makeWeapon(WeaponEnchant.Paralysis);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.status[StatusEffect.Paralyzed]).toBe(0);
    });

    it("proceeds for speed even if defender is dying", () => {
        goblin.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_DYING;
        const weapon = makeWeapon(WeaponEnchant.Speed);
        player.ticksUntilTurn = 100;
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(player.ticksUntilTurn).toBe(-1);
    });

    it("quietus/slaying kills the defender", () => {
        const weapon = makeWeapon(WeaponEnchant.Quietus);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.currentHP).toBe(0);
        expect(goblin.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING).toBeTruthy();
    });

    it("paralysis freezes the defender", () => {
        const weapon = makeWeapon(WeaponEnchant.Paralysis);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.status[StatusEffect.Paralyzed]).toBeGreaterThan(0);
    });

    it("slowing slows the defender", () => {
        const weapon = makeWeapon(WeaponEnchant.Slowing);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(ctx.slow).toHaveBeenCalled();
    });

    it("confusion confuses the defender", () => {
        const weapon = makeWeapon(WeaponEnchant.Confusion);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.status[StatusEffect.Confused]).toBeGreaterThan(0);
    });

    it("speed grants a free turn", () => {
        const weapon = makeWeapon(WeaponEnchant.Speed);
        player.ticksUntilTurn = 100;
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(player.ticksUntilTurn).toBe(-1);
    });

    it("speed does not grant extra free turn if already free", () => {
        const weapon = makeWeapon(WeaponEnchant.Speed);
        player.ticksUntilTurn = -1;
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(player.ticksUntilTurn).toBe(-1);
    });

    it("mercy heals the defender", () => {
        goblin.currentHP = 5;
        goblin.info.maxHP = 20;
        const weapon = makeWeapon(WeaponEnchant.Mercy);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.currentHP).toBeGreaterThan(5);
    });

    it("force calls forceWeaponHit", () => {
        const weapon = makeWeapon(WeaponEnchant.Force);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(ctx.forceWeaponHit).toHaveBeenCalled();
    });

    it("plenty calls cloneMonster", () => {
        const weapon = makeWeapon(WeaponEnchant.Plenty);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(ctx.cloneMonster).toHaveBeenCalledWith(goblin, true, true);
    });

    it("auto-identifies the weapon on activation", () => {
        const weapon = makeWeapon(WeaponEnchant.Paralysis);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(ctx.autoIdentify).toHaveBeenCalledWith(weapon);
    });

    it("does not activate against inanimate/invulnerable (non-slaying)", () => {
        goblin.info.flags |= MonsterBehaviorFlag.MONST_INANIMATE;
        const weapon = makeWeapon(WeaponEnchant.Paralysis);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.status[StatusEffect.Paralyzed]).toBe(0);
    });

    it("backstab increases chance", () => {
        // When randPercent is always true, backstab doesn't change outcome,
        // but we can verify it enters the activation branch
        const weapon = makeWeapon(WeaponEnchant.Confusion);
        magicWeaponHit(goblin, weapon, true, ctx);
        expect(goblin.status[StatusEffect.Confused]).toBeGreaterThan(0);
    });

    it("does not activate when randPercent fails", () => {
        ctx = makeRunicCtx(player, { randPercent: () => false });
        const weapon = makeWeapon(WeaponEnchant.Confusion);
        magicWeaponHit(goblin, weapon, false, ctx);
        expect(goblin.status[StatusEffect.Confused]).toBe(0);
    });
});

// =============================================================================
// applyArmorRunicEffect
// =============================================================================

describe("applyArmorRunicEffect", () => {
    let player: Creature;
    let attacker: Creature;
    let ctx: RunicContext;

    beforeEach(() => {
        player = makeCreature(MonsterType.MK_YOU);
        player.loc = { x: 5, y: 5 };
        attacker = makeCreature(MonsterType.MK_GOBLIN);
        attacker.loc = { x: 6, y: 5 };
        attacker.currentHP = 20;
        ctx = makeRunicCtx(player);
    });

    it("returns empty string if no armor", () => {
        ctx = makeRunicCtx(player, { armor: null });
        const result = applyArmorRunicEffect(attacker, { value: 10 }, true, ctx);
        expect(result).toBe("");
    });

    it("absorption reduces damage", () => {
        const armor = makeArmor(ArmorEnchant.Absorption);
        ctx = makeRunicCtx(player, { armor, randRange: () => 5 });
        const damage = { value: 10 };
        applyArmorRunicEffect(attacker, damage, true, ctx);
        expect(damage.value).toBe(5);
    });

    it("absorption can reduce damage to 0", () => {
        const armor = makeArmor(ArmorEnchant.Absorption);
        ctx = makeRunicCtx(player, { armor, randRange: () => 15 });
        const damage = { value: 10 };
        const result = applyArmorRunicEffect(attacker, damage, true, ctx);
        expect(damage.value).toBe(0);
        expect(result).toContain("absorbs the blow");
    });

    it("reprisal damages the attacker", () => {
        const armor = makeArmor(ArmorEnchant.Reprisal);
        ctx = makeRunicCtx(player, { armor });
        const startHP = attacker.currentHP;
        applyArmorRunicEffect(attacker, { value: 10 }, true, ctx);
        expect(attacker.currentHP).toBeLessThan(startHP);
    });

    it("reprisal does nothing for ranged attacks", () => {
        const armor = makeArmor(ArmorEnchant.Reprisal);
        ctx = makeRunicCtx(player, { armor });
        const startHP = attacker.currentHP;
        applyArmorRunicEffect(attacker, { value: 10 }, false, ctx);
        expect(attacker.currentHP).toBe(startHP);
    });

    it("immunity negates damage from matching monster class", () => {
        const dragonClassIndex = monsterClassCatalog.findIndex(c => c.name === "dragon");
        const armor = makeArmor(ArmorEnchant.Immunity, 3, dragonClassIndex);
        ctx = makeRunicCtx(player, {
            armor,
            monsterIsInClass: () => true,
        });
        const damage = { value: 50 };
        applyArmorRunicEffect(attacker, damage, true, ctx);
        expect(damage.value).toBe(0);
    });

    it("immunity does not affect non-matching enemies", () => {
        const armor = makeArmor(ArmorEnchant.Immunity, 3, 0);
        ctx = makeRunicCtx(player, { armor, monsterIsInClass: () => false });
        const damage = { value: 50 };
        applyArmorRunicEffect(attacker, damage, true, ctx);
        expect(damage.value).toBe(50);
    });

    it("vulnerability doubles damage", () => {
        const armor = makeArmor(ArmorEnchant.Vulnerability);
        ctx = makeRunicCtx(player, { armor });
        const damage = { value: 10 };
        applyArmorRunicEffect(attacker, damage, true, ctx);
        expect(damage.value).toBe(20);
    });

    it("burden increases strength requirement", () => {
        const armor = makeArmor(ArmorEnchant.Burden);
        const origStrength = armor.strengthRequired;
        ctx = makeRunicCtx(player, { armor, randPercent: () => true });
        applyArmorRunicEffect(attacker, { value: 10 }, true, ctx);
        expect(armor.strengthRequired).toBe(origStrength + 1);
        expect(ctx.equipItem).toHaveBeenCalledWith(armor, true);
    });

    it("burden does not trigger every time (10% chance)", () => {
        const armor = makeArmor(ArmorEnchant.Burden);
        const origStrength = armor.strengthRequired;
        ctx = makeRunicCtx(player, { armor, randPercent: () => false });
        applyArmorRunicEffect(attacker, { value: 10 }, true, ctx);
        expect(armor.strengthRequired).toBe(origStrength);
    });

    it("multiplicity does not trigger on ranged attacks", () => {
        const armor = makeArmor(ArmorEnchant.Multiplicity);
        ctx = makeRunicCtx(player, { armor });
        applyArmorRunicEffect(attacker, { value: 10 }, false, ctx);
        expect(ctx.cloneMonster).not.toHaveBeenCalled();
    });

    it("auto-identifies armor when runic is discovered and not known", () => {
        const armor = makeArmor(ArmorEnchant.Vulnerability);
        ctx = makeRunicCtx(player, { armor });
        applyArmorRunicEffect(attacker, { value: 10 }, true, ctx);
        expect(ctx.autoIdentify).toHaveBeenCalledWith(armor);
    });

    it("does not auto-identify if already known", () => {
        const armor = makeArmor(ArmorEnchant.Vulnerability);
        armor.flags |= ItemFlag.ITEM_RUNIC_IDENTIFIED;
        ctx = makeRunicCtx(player, { armor });
        applyArmorRunicEffect(attacker, { value: 10 }, true, ctx);
        expect(ctx.autoIdentify).not.toHaveBeenCalled();
    });
});
