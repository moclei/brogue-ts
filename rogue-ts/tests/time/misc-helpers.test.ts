/**
 *  misc-helpers.test.ts — Tests for miscellaneous time helpers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    staffChargeDuration,
    rechargeItemsIncrementally,
    processIncrementalAutoID,
    dangerChanged,
    autoRest,
    manualSearch,
    updateYendorWardenTracking,
    monsterEntersLevel,
    monstersApproachStairs,
    type MiscHelpersContext,
} from "../../src/time/misc-helpers.js";
import { StatusEffect, StaffKind, ItemCategory } from "../../src/types/enums.js";
import { ItemFlag, MonsterBookkeepingFlag, TileFlag, TerrainFlag } from "../../src/types/flags.js";
import type { Creature, Pos, Pcell, Item, LevelData } from "../../src/types/types.js";

// =============================================================================
// Helpers
// =============================================================================

function makePos(x = 0, y = 0): Pos {
    return { x, y };
}

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: 0,
        kind: 0,
        charges: 0,
        enchant1: 1,
        enchant2: 0,
        flags: 0,
        quantity: 1,
        loc: makePos(),
        ...overrides,
    } as unknown as Item;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: makePos(),
        status: new Array(60).fill(0),
        maxStatus: new Array(60).fill(0),
        info: { flags: 0, abilityFlags: 0, maxHP: 100, movementSpeed: 100, attackSpeed: 100 },
        currentHP: 100,
        bookkeepingFlags: 0,
        depth: 1,
        targetCorpseLoc: makePos(),
        ticksUntilTurn: 0,
        movementSpeed: 100,
        ...overrides,
    } as unknown as Creature;
}

function makePcell(overrides: Partial<Pcell> = {}): Pcell {
    return {
        layers: [0, 0, 0],
        flags: 0,
        volume: 0,
        machineNumber: 0,
        ...overrides,
    } as unknown as Pcell;
}

function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
    return {
        visited: false,
        monsters: [],
        mapStorage: null,
        downStairsLoc: makePos(5, 5),
        upStairsLoc: makePos(1, 1),
        playerExitedVia: makePos(3, 3),
        ...overrides,
    } as unknown as LevelData;
}

function makeCtx(overrides: Partial<MiscHelpersContext> = {}): MiscHelpersContext {
    return {
        player: makeCreature({ loc: makePos(5, 5) }),
        rogue: {
            depthLevel: 2,
            wisdomBonus: 0,
            awarenessBonus: 0,
            justRested: false,
            justSearched: false,
            automationActive: false,
            disturbed: false,
            yendorWarden: null,
            weapon: null,
            armor: null,
            ringLeft: null,
            ringRight: null,
            upLoc: makePos(1, 1),
            downLoc: makePos(9, 9),
            monsterSpawnFuse: 100,
        },
        monsters: [],
        levels: [makeLevel(), makeLevel(), makeLevel(), makeLevel(), makeLevel()],
        pmap: [],
        packItems: [],
        DCOLS: 10,
        DROWS: 10,
        FP_FACTOR: 1000,
        TURNS_FOR_FULL_REGEN: 300,
        deepestLevel: 5,
        INVALID_POS: makePos(-1, -1),
        randClumpedRange: vi.fn(() => 100),
        rand_percent: vi.fn(() => false),
        max: Math.max,
        clamp: (val: number, min: number, max: number) => Math.max(min, Math.min(max, val)),
        ringWisdomMultiplier: vi.fn((val: number) => val),
        charmRechargeDelay: vi.fn(() => 100),
        itemName: vi.fn(() => "item"),
        identify: vi.fn(),
        updateIdentifiableItems: vi.fn(),
        numberOfMatchingPackItems: vi.fn(() => 0),
        message: vi.fn(),
        messageWithColor: vi.fn(),
        monsterAvoids: vi.fn(() => false),
        canSeeMonster: vi.fn(() => true),
        monsterName: vi.fn(() => "the monster"),
        messageColorFromVictim: vi.fn(() => "red"),
        inflictDamage: vi.fn(() => false),
        killCreature: vi.fn(),
        demoteMonsterFromLeadership: vi.fn(),
        restoreMonster: vi.fn(),
        removeCreature: vi.fn(),
        prependCreature: vi.fn(),
        avoidedFlagsForMonster: vi.fn(() => 0),
        getQualifyingPathLocNear: vi.fn((loc: Pos) => loc),
        posNeighborInDirection: vi.fn((loc: Pos, dir: number) => {
            const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            return makePos(loc.x + offsets[dir][0], loc.y + offsets[dir][1]);
        }),
        cellHasTerrainFlag: vi.fn(() => false),
        pmapAt: vi.fn(() => makePcell()),
        terrainFlags: vi.fn(() => 0),
        refreshDungeonCell: vi.fn(),
        search: vi.fn(),
        recordKeystroke: vi.fn(),
        playerTurnEnded: vi.fn(),
        pauseAnimation: vi.fn(() => false),
        ringTable: [],
        displayLevel: vi.fn(),
        updateMinersLightRadius: vi.fn(),
        itemMessageColor: "yellow",
        red: "red",
        REST_KEY: "z",
        SEARCH_KEY: "s",
        PAUSE_BEHAVIOR_DEFAULT: 0,
        ...overrides,
    };
}

// =============================================================================
// Tests
// =============================================================================

describe("staffChargeDuration", () => {
    it("returns 5000/enchant for normal staffs", () => {
        const item = makeItem({ kind: StaffKind.Fire, enchant1: 2 });
        expect(staffChargeDuration(item)).toBe(2500);
    });

    it("returns 10000/enchant for blinking staffs", () => {
        const item = makeItem({ kind: StaffKind.Blinking, enchant1: 4 });
        expect(staffChargeDuration(item)).toBe(2500);
    });

    it("returns 10000/enchant for obstruction staffs", () => {
        const item = makeItem({ kind: StaffKind.Obstruction, enchant1: 5 });
        expect(staffChargeDuration(item)).toBe(2000);
    });

    it("uses floor division", () => {
        const item = makeItem({ kind: StaffKind.Lightning, enchant1: 3 });
        expect(staffChargeDuration(item)).toBe(Math.floor(5000 / 3));
    });
});

describe("rechargeItemsIncrementally", () => {
    it("recharges staff when charges < enchant1", () => {
        const staff = makeItem({
            category: ItemCategory.STAFF,
            kind: StaffKind.Fire,
            charges: 2,
            enchant1: 5,
            enchant2: 15, // high enough to need decrementing
        });
        const ctx = makeCtx({ packItems: [staff] });
        rechargeItemsIncrementally(1, ctx);
        // enchant2 should have decreased by rechargeIncrement (10)
        expect(staff.enchant2).toBe(5);
    });

    it("does not recharge staff when charges >= enchant1 and multiplier > 0", () => {
        const staff = makeItem({
            category: ItemCategory.STAFF,
            kind: StaffKind.Fire,
            charges: 5,
            enchant1: 5,
            enchant2: 100,
        });
        const ctx = makeCtx({ packItems: [staff] });
        rechargeItemsIncrementally(1, ctx);
        // enchant2 should not change from the rechargeIncrement deduction
        expect(staff.enchant2).toBe(100);
    });

    it("recharges charms by decrementing charges", () => {
        const charm = makeItem({
            category: ItemCategory.CHARM,
            kind: 0,
            charges: 50,
            enchant1: 3,
        });
        const ctx = makeCtx({ packItems: [charm] });
        rechargeItemsIncrementally(1, ctx);
        expect(charm.charges).toBe(49);
    });

    it("sends message when charm fully recharges", () => {
        const charm = makeItem({
            category: ItemCategory.CHARM,
            kind: 0,
            charges: 1,
            enchant1: 3,
        });
        const ctx = makeCtx({ packItems: [charm] });
        rechargeItemsIncrementally(1, ctx);
        expect(charm.charges).toBe(0);
        expect(ctx.message).toHaveBeenCalledWith("your item has recharged.", 0);
    });

    it("uses wisdom bonus for recharge increment", () => {
        const staff = makeItem({
            category: ItemCategory.STAFF,
            kind: StaffKind.Fire,
            charges: 2,
            enchant1: 5,
            enchant2: 200,
        });
        const ctx = makeCtx({ packItems: [staff] });
        ctx.rogue.wisdomBonus = 5;
        (ctx.ringWisdomMultiplier as ReturnType<typeof vi.fn>).mockReturnValue(10000);
        // rechargeIncrement = floor(10 * 10000 / 1000) = 100
        rechargeItemsIncrementally(1, ctx);
        expect(ctx.ringWisdomMultiplier).toHaveBeenCalledWith(5000);
        // enchant2 should decrease by 100 (from 200 to 100)
        expect(staff.enchant2).toBe(100);
    });
});

describe("processIncrementalAutoID", () => {
    it("decrements charges on unidentified armor", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            charges: 5,
            flags: 0,
            kind: 0,
        });
        const ctx = makeCtx();
        ctx.rogue.armor = armor;
        processIncrementalAutoID(ctx);
        expect(armor.charges).toBe(4);
    });

    it("identifies armor when charges reach 0", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            charges: 1,
            flags: 0,
            kind: 0,
        });
        const ctx = makeCtx();
        ctx.rogue.armor = armor;
        processIncrementalAutoID(ctx);
        expect(armor.charges).toBe(0);
        expect(armor.flags & ItemFlag.ITEM_IDENTIFIED).not.toBe(0);
        expect(ctx.message).toHaveBeenCalled();
    });

    it("calls identify for rings when charges reach 0", () => {
        const ring = makeItem({
            category: ItemCategory.RING,
            charges: 1,
            flags: 0,
            kind: 0,
        });
        const ctx = makeCtx();
        ctx.rogue.ringLeft = ring;
        ctx.ringTable = [{ identified: false }];
        processIncrementalAutoID(ctx);
        expect(ctx.identify).toHaveBeenCalledWith(ring);
    });

    it("skips already identified items", () => {
        const armor = makeItem({
            category: ItemCategory.ARMOR,
            charges: 5,
            flags: ItemFlag.ITEM_IDENTIFIED,
            kind: 0,
        });
        const ctx = makeCtx();
        ctx.rogue.armor = armor;
        processIncrementalAutoID(ctx);
        expect(armor.charges).toBe(5); // unchanged
    });

    it("skips null equipment slots", () => {
        const ctx = makeCtx();
        ctx.rogue.armor = null;
        ctx.rogue.ringLeft = null;
        ctx.rogue.ringRight = null;
        // Should not throw
        processIncrementalAutoID(ctx);
    });
});

describe("dangerChanged", () => {
    it("returns false when danger has not changed", () => {
        const ctx = makeCtx();
        (ctx.monsterAvoids as ReturnType<typeof vi.fn>).mockReturnValue(false);
        const danger = [false, false, false, false];
        expect(dangerChanged(danger, ctx)).toBe(false);
    });

    it("returns true when danger has changed in any direction", () => {
        const ctx = makeCtx();
        (ctx.monsterAvoids as ReturnType<typeof vi.fn>).mockReturnValue(true);
        const danger = [false, false, false, false];
        expect(dangerChanged(danger, ctx)).toBe(true);
    });

    it("returns true when only one direction changed", () => {
        const ctx = makeCtx();
        let callCount = 0;
        (ctx.monsterAvoids as ReturnType<typeof vi.fn>).mockImplementation(() => {
            return callCount++ === 2; // only direction 2 is dangerous
        });
        const danger = [false, false, false, false];
        expect(dangerChanged(danger, ctx)).toBe(true);
    });
});

describe("autoRest", () => {
    it("clears MB_ALREADY_SEEN from all monsters", () => {
        const monst = makeCreature({
            bookkeepingFlags: MonsterBookkeepingFlag.MB_ALREADY_SEEN,
        });
        const ctx = makeCtx({ monsters: [monst] });
        // Make player full HP so it goes to the else branch
        ctx.player.currentHP = 100;
        ctx.player.info.maxHP = 100;
        // Disturb after first turn
        (ctx.playerTurnEnded as ReturnType<typeof vi.fn>).mockImplementation(() => {
            ctx.rogue.disturbed = true;
        });
        autoRest(ctx);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_ALREADY_SEEN).toBe(0);
    });

    it("sets automationActive during rest and clears it after", () => {
        const ctx = makeCtx();
        ctx.player.currentHP = 100;
        ctx.player.info.maxHP = 100;
        (ctx.playerTurnEnded as ReturnType<typeof vi.fn>).mockImplementation(() => {
            ctx.rogue.disturbed = true;
        });
        autoRest(ctx);
        expect(ctx.rogue.automationActive).toBe(false);
    });

    it("rests while HP is below max", () => {
        const ctx = makeCtx();
        ctx.player.currentHP = 50;
        ctx.player.info.maxHP = 100;
        let turnCount = 0;
        (ctx.playerTurnEnded as ReturnType<typeof vi.fn>).mockImplementation(() => {
            turnCount++;
            if (turnCount >= 3) {
                ctx.player.currentHP = 100; // healed
            }
        });
        autoRest(ctx);
        expect(turnCount).toBeGreaterThanOrEqual(3);
        expect(ctx.recordKeystroke).toHaveBeenCalled();
    });

    it("stops when disturbed", () => {
        const ctx = makeCtx();
        ctx.player.currentHP = 50;
        ctx.player.info.maxHP = 100;
        (ctx.pauseAnimation as ReturnType<typeof vi.fn>).mockReturnValue(true);
        autoRest(ctx);
        // Should only call playerTurnEnded once since pauseAnimation returns true
        expect(ctx.playerTurnEnded).toHaveBeenCalledTimes(1);
    });

    it("rests for 100 turns when player is already at full HP with no statuses", () => {
        const ctx = makeCtx();
        ctx.player.currentHP = 100;
        ctx.player.info.maxHP = 100;
        autoRest(ctx);
        expect(ctx.playerTurnEnded).toHaveBeenCalledTimes(100);
    });
});

describe("manualSearch", () => {
    it("records SEARCH_KEY keystroke", () => {
        const ctx = makeCtx();
        // Stop playerTurnEnded from doing anything complex
        manualSearch(ctx);
        expect(ctx.recordKeystroke).toHaveBeenCalledWith("s", false, false);
    });

    it("increments search status", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Searching] = 2;
        manualSearch(ctx);
        expect(ctx.player.status[StatusEffect.Searching]).toBe(3);
    });

    it("initializes search status if <= 0", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Searching] = 0;
        manualSearch(ctx);
        expect(ctx.player.maxStatus[StatusEffect.Searching]).toBe(5);
        expect(ctx.player.status[StatusEffect.Searching]).toBe(1);
    });

    it("performs final large search on 5th search in a row", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Searching] = 4;
        manualSearch(ctx);
        expect(ctx.search).toHaveBeenCalledWith(expect.any(Number));
        // strength should be max(160, awarenessBonus + 30)
        const callArgs = (ctx.search as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(callArgs[0]).toBeGreaterThanOrEqual(160);
        expect(ctx.message).toHaveBeenCalledWith("you finish your detailed search of the area.", 0);
        expect(ctx.player.status[StatusEffect.Searching]).toBe(0);
    });

    it("calls playerTurnEnded and sets justSearched", () => {
        const ctx = makeCtx();
        manualSearch(ctx);
        expect(ctx.rogue.justSearched).toBe(true);
        expect(ctx.playerTurnEnded).toHaveBeenCalled();
    });
});

describe("updateYendorWardenTracking", () => {
    it("returns immediately if no yendor warden", () => {
        const ctx = makeCtx();
        ctx.rogue.yendorWarden = null;
        updateYendorWardenTracking(ctx);
        expect(ctx.removeCreature).not.toHaveBeenCalled();
    });

    it("returns immediately if warden is on same level", () => {
        const warden = makeCreature({ depth: 2 });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.rogue.yendorWarden = warden;
        updateYendorWardenTracking(ctx);
        expect(ctx.removeCreature).not.toHaveBeenCalled();
    });

    it("moves warden closer when warden is deeper", () => {
        const warden = makeCreature({ depth: 5 });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.rogue.yendorWarden = warden;
        updateYendorWardenTracking(ctx);
        expect(warden.depth).toBe(3); // depthLevel + 1
        expect(warden.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS).not.toBe(0);
        expect(ctx.removeCreature).toHaveBeenCalled();
        expect(ctx.prependCreature).toHaveBeenCalled();
    });

    it("moves warden closer when warden is shallower", () => {
        const warden = makeCreature({ depth: 1 });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 4;
        ctx.rogue.yendorWarden = warden;
        updateYendorWardenTracking(ctx);
        expect(warden.depth).toBe(3); // depthLevel - 1
        expect(warden.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS).not.toBe(0);
    });

    it("sets STATUS_ENTERS_LEVEL_IN to 50", () => {
        const warden = makeCreature({ depth: 5 });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.rogue.yendorWarden = warden;
        updateYendorWardenTracking(ctx);
        expect(warden.status[StatusEffect.EntersLevelIn]).toBe(50);
    });
});

describe("monsterEntersLevel", () => {
    it("clears HAS_MONSTER from source level", () => {
        const storage: any[][] = [];
        for (let i = 0; i < 10; i++) {
            storage[i] = [];
            for (let j = 0; j < 10; j++) {
                storage[i][j] = { flags: TileFlag.HAS_MONSTER };
            }
        }
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS,
        });
        const ctx = makeCtx();
        ctx.levels[1] = makeLevel({ mapStorage: storage });
        monsterEntersLevel(monst, 1, ctx);
        expect(storage[3][3].flags & TileFlag.HAS_MONSTER).toBe(0);
    });

    it("places monster at upLoc when approaching downstairs", () => {
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS,
        });
        const ctx = makeCtx();
        ctx.rogue.upLoc = makePos(1, 1);
        monsterEntersLevel(monst, 0, ctx);
        // getQualifyingPathLocNear returns the same loc in our mock
        expect(monst.loc.x).toBe(1);
        expect(monst.loc.y).toBe(1);
    });

    it("places monster at downLoc when approaching upstairs", () => {
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS,
        });
        const ctx = makeCtx();
        ctx.rogue.downLoc = makePos(9, 9);
        monsterEntersLevel(monst, 0, ctx);
        expect(monst.loc.x).toBe(9);
        expect(monst.loc.y).toBe(9);
    });

    it("sets depth to current level and clears/sets bookkeeping flags", () => {
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS | MonsterBookkeepingFlag.MB_IS_FALLING,
        });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 3;
        monsterEntersLevel(monst, 0, ctx);
        expect(monst.depth).toBe(3);
        expect(monst.status[StatusEffect.EntersLevelIn]).toBe(0);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_PREPLACED).not.toBe(0);
        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING).toBe(0);
    });

    it("inflicts damage when monster falls from pit", () => {
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_PIT,
        });
        const ctx = makeCtx();
        ctx.levels[0] = makeLevel({ playerExitedVia: makePos(4, 4) });
        monsterEntersLevel(monst, 0, ctx);
        expect(ctx.inflictDamage).toHaveBeenCalled();
    });

    it("does not inflict pit damage if monster is levitating", () => {
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_PIT,
        });
        monst.status[StatusEffect.Levitating] = 10;
        const ctx = makeCtx();
        ctx.levels[0] = makeLevel({ playerExitedVia: makePos(4, 4) });
        monsterEntersLevel(monst, 0, ctx);
        expect(ctx.inflictDamage).not.toHaveBeenCalled();
    });
});

describe("monstersApproachStairs", () => {
    it("decrements EntersLevelIn for monsters on adjacent levels", () => {
        const monst = makeCreature();
        monst.status[StatusEffect.EntersLevelIn] = 5;
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.levels[0] = makeLevel({ visited: true, monsters: [monst] });
        monstersApproachStairs(ctx);
        expect(monst.status[StatusEffect.EntersLevelIn]).toBe(4);
    });

    it("calls monsterEntersLevel when EntersLevelIn reaches 1", () => {
        const monst = makeCreature({
            loc: makePos(3, 3),
            bookkeepingFlags: MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS,
        });
        monst.status[StatusEffect.EntersLevelIn] = 1;
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.levels[0] = makeLevel({ visited: true, monsters: [monst] });
        monstersApproachStairs(ctx);
        expect(ctx.restoreMonster).toHaveBeenCalled(); // called by monsterEntersLevel
    });

    it("calls updateYendorWardenTracking when warden is far away", () => {
        const warden = makeCreature({ depth: 5 });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.rogue.yendorWarden = warden;
        monstersApproachStairs(ctx);
        // abs(2-5) = 3 > 1, so tracking should be called
        expect(ctx.removeCreature).toHaveBeenCalled();
    });

    it("does not call updateYendorWardenTracking when warden is nearby", () => {
        const warden = makeCreature({ depth: 3 });
        const ctx = makeCtx();
        ctx.rogue.depthLevel = 2;
        ctx.rogue.yendorWarden = warden;
        monstersApproachStairs(ctx);
        // abs(2-3) = 1, not > 1
        expect(ctx.removeCreature).not.toHaveBeenCalled();
    });
});
