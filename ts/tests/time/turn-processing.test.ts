/*
 *  turn-processing.test.ts — Tests for turn processing core
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    playerRecoversFromAttacking,
    synchronizePlayerTimeState,
    scentDistance,
    resetScentTurnNumber,
    addXPXPToAlly,
    handleXPXP,
    recordCurrentCreatureHealths,
    playerTurnEnded,
} from "../../src/time/turn-processing.js";
import type { TurnProcessingContext } from "../../src/time/turn-processing.js";
import { StatusEffect, CreatureState } from "../../src/types/enums.js";
import { TileFlag, TerrainFlag, ItemFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag } from "../../src/types/flags.js";
import type { Creature, Pcell, Pos, Item, Color, LevelData } from "../../src/types/types.js";
import { XPXP_NEEDED_FOR_TELEPATHIC_BOND } from "../../src/types/constants.js";

// =============================================================================
// Helpers
// =============================================================================

const dummyColor: Color = { red: 0, green: 0, blue: 0, rand: 0, colorDances: false };

function makeItem(overrides: Partial<Item> = {}): Item {
    return {
        category: 0,
        kind: 0,
        flags: 0,
        damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        armor: 0,
        charges: 0,
        enchant1: 0,
        enchant2: 0,
        timesEnchanted: 0,
        vorpalEnemy: 0,
        strengthRequired: 0,
        quantity: 1,
        inventoryLetter: "a",
        inventoryColor: dummyColor,
        inscription: "",
        originDepth: 1,
        keyLoc: [],
        loc: { x: 0, y: 0 },
        ...overrides,
    } as Item;
}

function makeCreature(overrides: Partial<Creature> = {}): Creature {
    return {
        loc: { x: 5, y: 5 },
        status: new Array(40).fill(0),
        maxStatus: new Array(40).fill(0),
        info: { flags: 0, abilityFlags: 0, maxHP: 20, movementSpeed: 100, attackSpeed: 100, turnsBetweenRegen: 300, DFChance: 0, DFType: 0 },
        currentHP: 10,
        previousHealthPoints: 10,
        bookkeepingFlags: 0,
        creatureState: CreatureState.Ally,
        carriedItem: null,
        carriedMonster: null,
        leader: null,
        ticksUntilTurn: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        turnsUntilRegen: 300,
        regenPerTurn: 0,
        xpxp: 0,
        poisonAmount: 0,
        machineHome: 0,
        spawnDepth: 1,
        turnsSpentStationary: 0,
        weaknessAmount: 0,
        ...overrides,
    } as Creature;
}

function makeCell(overrides: Partial<Pcell> = {}): Pcell {
    return {
        layers: [1, 0, 0, 0],
        flags: 0,
        volume: 0,
        machineNumber: 0,
        rememberedAppearance: { char: 0, foreColorComponents: [0, 0, 0], backColorComponents: [0, 0, 0] },
        rememberedItemCategory: 0,
        rememberedItemKind: 0,
        rememberedItemQuantity: 0,
        rememberedItemOriginDepth: 0,
        rememberedTerrain: 0,
        rememberedCellFlags: 0,
        rememberedTerrainFlags: 0,
        rememberedTMFlags: 0,
        exposedToFire: 0,
        ...overrides,
    };
}

function makeCtx(overrides: Partial<TurnProcessingContext> = {}): TurnProcessingContext {
    const player = makeCreature({ loc: { x: 5, y: 5 } });
    const pmap: Pcell[][] = [];
    for (let x = 0; x < 10; x++) {
        pmap[x] = [];
        for (let y = 0; y < 10; y++) {
            pmap[x][y] = makeCell();
        }
    }

    return {
        player,
        rogue: {
            weapon: null,
            armor: null,
            ringLeft: null,
            ringRight: null,
            scentTurnNumber: 100,
            playerTurnNumber: 0,
            absoluteTurnNumber: 0,
            ticksTillUpdateEnvironment: 50,
            monsterSpawnFuse: 100,
            gameHasEnded: false,
            playbackFastForward: false,
            playbackMode: false,
            disturbed: false,
            automationActive: false,
            cautiousMode: false,
            justRested: false,
            justSearched: false,
            staleLoopMap: false,
            stealthRange: 14,
            displayStealthRangeMode: false,
            heardCombatThisTurn: false,
            receivedLevitationWarning: false,
            updatedSafetyMapThisTurn: false,
            updatedAllySafetyMapThisTurn: false,
            updatedMapToSafeTerrainThisTurn: false,
            updatedMapToShoreThisTurn: false,
            xpxpThisTurn: 5,
            depthLevel: 1,
            deepestLevel: 1,
            mapToShore: [],
            RNG: 0,
            previousPoisonPercent: 0,
            flares: [],
            flareCount: 0,
            awarenessBonus: 0,
            stealthBonus: 0,
            wisdomBonus: 0,
            wpRefreshTicker: 0,
            wpCount: 10,
            playbackBetweenTurns: false,
            featRecord: [false],
            inWater: false,
            clairvoyance: 0,
            minersLight: { lightColor: null },
        },
        monsters: [],
        dormantMonsters: [],
        pmap,
        levels: [{ visited: true, scentMap: [[0]], monsters: [], dormantMonsters: [] }] as any,
        gameConst: { deepestLevel: 1, companionFeatRequiredXP: 5000, fallDamageMin: 8, fallDamageMax: 18 } as any,
        scentMap: [],
        safetyMap: [],
        allySafetyMap: [],
        packItems: [],
        floorItems: [],
        tileCatalog: [],
        dungeonFeatureCatalog: [],
        DCOLS: 10,
        DROWS: 10,
        FP_FACTOR: 65536n,
        cellHasTerrainFlag: () => false,
        cellHasTMFlag: () => false,
        terrainFlags: () => 0,
        discoveredTerrainFlagsAtLoc: () => 0,
        coordinatesAreInMap: (x, y) => x >= 0 && x < 10 && y >= 0 && y < 10,
        pmapAt: (loc) => pmap[loc.x]?.[loc.y] ?? makeCell(),
        canSeeMonster: () => false,
        canDirectlySeeMonster: () => false,
        monsterRevealed: () => false,
        monsterName: (_buf, _m, _b) => { _buf[0] = "a monster"; },
        monsterAtLoc: () => null,
        monstersAreEnemies: () => false,
        monsterAvoids: () => false,
        monsterIsInClass: () => false,
        isVowelish: () => false,
        monstersTurn: () => {},
        decrementMonsterStatus: () => false,
        removeCreature: () => false,
        prependCreature: () => {},
        itemName: (_item, buf) => { buf[0] = "an item"; },
        numberOfMatchingPackItems: () => 0,
        inflictDamage: () => false,
        killCreature: () => {},
        combatMessage: () => {},
        displayCombatText: () => {},
        messageColorFromVictim: () => dummyColor,
        addPoison: () => {},
        flashMonster: () => {},
        message: () => {},
        messageWithColor: () => {},
        flavorMessage: () => {},
        refreshDungeonCell: () => {},
        displayLevel: () => {},
        displayAnnotation: () => {},
        refreshSideBar: () => {},
        gameOver: () => { /* set gameHasEnded to break loops */ },
        confirm: () => true,
        flashMessage: () => {},
        recordKeystroke: () => {},
        confirmMessages: () => {},
        pauseAnimation: () => false,
        goodMessageColor: dummyColor,
        badMessageColor: dummyColor,
        advancementMessageColor: dummyColor,
        itemMessageColor: dummyColor,
        orange: dummyColor,
        green: dummyColor,
        red: dummyColor,
        yellow: dummyColor,
        darkRed: dummyColor,
        darkGreen: dummyColor,
        updateEnvironment: () => {},
        updateVision: () => {},
        updateMapToShore: () => {},
        updateSafetyMap: () => {},
        refreshWaypoint: () => {},
        analyzeMap: () => {},
        removeDeadMonsters: () => {},
        shuffleTerrainColors: () => {},
        resetDFMessageEligibility: () => {},
        RNGCheck: () => {},
        animateFlares: () => {},
        addScentToCell: () => {},
        getFOVMask: () => {},
        zeroOutGrid: () => {},
        discoverCell: () => {},
        discover: () => {},
        storeMemories: () => {},
        rechargeItemsIncrementally: () => {},
        processIncrementalAutoID: () => {},
        applyInstantTileEffectsToCreature: () => {},
        applyGradualTileEffectsToCreature: () => {},
        monsterShouldFall: () => false,
        monstersFall: () => {},
        decrementPlayerStatus: () => {},
        playerFalls: () => {},
        handleHealthAlerts: () => {},
        updateScent: () => {},
        currentStealthRange: () => 14,
        search: () => false,
        playerCanDirectlySee: () => true,
        playerCanSee: () => true,
        spawnDungeonFeature: () => {},
        nbDirs: [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
        rand_range: (a, b) => a,
        rand_percent: () => false,
        max: Math.max,
        min: Math.min,
        ...overrides,
    };
}

// =============================================================================
// scentDistance
// =============================================================================

describe("scentDistance", () => {
    it("doubles the longer axis (x > y)", () => {
        expect(scentDistance(0, 0, 5, 2)).toBe(2 * 5 + 2); // 12
    });

    it("doubles the longer axis (y > x)", () => {
        expect(scentDistance(0, 0, 2, 5)).toBe(2 + 2 * 5); // 12
    });

    it("returns zero for same point", () => {
        expect(scentDistance(3, 3, 3, 3)).toBe(0);
    });

    it("handles equal axes", () => {
        // When equal, we go to else branch: x + 2*y
        expect(scentDistance(0, 0, 3, 3)).toBe(3 + 2 * 3); // 9
    });
});

// =============================================================================
// playerRecoversFromAttacking
// =============================================================================

describe("playerRecoversFromAttacking", () => {
    it("adds attackSpeed when no special weapon", () => {
        const ctx = makeCtx();
        ctx.player.ticksUntilTurn = 0;
        ctx.player.attackSpeed = 100;

        playerRecoversFromAttacking(true, ctx);

        expect(ctx.player.ticksUntilTurn).toBe(100);
    });

    it("adds 2x attackSpeed for stagger weapon on hit", () => {
        const weapon = makeItem({ flags: ItemFlag.ITEM_ATTACKS_STAGGER });
        const ctx = makeCtx();
        ctx.rogue.weapon = weapon;
        ctx.player.ticksUntilTurn = 0;
        ctx.player.attackSpeed = 100;

        playerRecoversFromAttacking(true, ctx);

        expect(ctx.player.ticksUntilTurn).toBe(200);
    });

    it("adds half attackSpeed for quick weapon", () => {
        const weapon = makeItem({ flags: ItemFlag.ITEM_ATTACKS_QUICKLY });
        const ctx = makeCtx();
        ctx.rogue.weapon = weapon;
        ctx.player.ticksUntilTurn = 0;
        ctx.player.attackSpeed = 100;

        playerRecoversFromAttacking(false, ctx);

        expect(ctx.player.ticksUntilTurn).toBe(50);
    });

    it("does nothing when ticksUntilTurn is negative", () => {
        const ctx = makeCtx();
        ctx.player.ticksUntilTurn = -1;
        ctx.player.attackSpeed = 100;

        playerRecoversFromAttacking(true, ctx);

        expect(ctx.player.ticksUntilTurn).toBe(-1);
    });
});

// =============================================================================
// synchronizePlayerTimeState
// =============================================================================

describe("synchronizePlayerTimeState", () => {
    it("sets ticksTillUpdateEnvironment to player.ticksUntilTurn", () => {
        const ctx = makeCtx();
        ctx.player.ticksUntilTurn = 150;

        synchronizePlayerTimeState(ctx);

        expect(ctx.rogue.ticksTillUpdateEnvironment).toBe(150);
    });
});

// =============================================================================
// resetScentTurnNumber
// =============================================================================

describe("resetScentTurnNumber", () => {
    it("subtracts 15000 from scentTurnNumber", () => {
        const ctx = makeCtx();
        ctx.rogue.scentTurnNumber = 20000;
        ctx.levels = [{ visited: false, scentMap: null } as any];

        resetScentTurnNumber(ctx);

        expect(ctx.rogue.scentTurnNumber).toBe(5000);
    });

    it("subtracts 15000 from scent map values above threshold", () => {
        // Build a properly-sized scent map
        const scentMap: number[][] = [];
        for (let i = 0; i < 10; i++) {
            scentMap[i] = [];
            for (let j = 0; j < 10; j++) {
                scentMap[i][j] = 0;
            }
        }
        scentMap[0][0] = 18000;
        scentMap[0][1] = 12000;

        const ctx = makeCtx();
        ctx.rogue.scentTurnNumber = 20000;
        ctx.levels = [{ visited: true, scentMap } as any];

        resetScentTurnNumber(ctx);

        expect(scentMap[0][0]).toBe(3000);
        expect(scentMap[0][1]).toBe(0);
    });
});

// =============================================================================
// addXPXPToAlly
// =============================================================================

describe("addXPXPToAlly", () => {
    it("adds xpxpThisTurn to ally's xpxp", () => {
        const monst = makeCreature({ creatureState: CreatureState.Ally, xpxp: 100 });
        const ctx = makeCtx();
        ctx.rogue.xpxpThisTurn = 50;

        addXPXPToAlly(monst, ctx);

        expect(monst.xpxp).toBe(150);
    });

    it("ignores non-ally monsters", () => {
        const monst = makeCreature({ creatureState: CreatureState.TrackingScent, xpxp: 100 });
        const ctx = makeCtx();
        ctx.rogue.xpxpThisTurn = 50;

        addXPXPToAlly(monst, ctx);

        expect(monst.xpxp).toBe(100);
    });

    it("ignores inanimate monsters", () => {
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            xpxp: 100,
            info: { flags: MonsterBehaviorFlag.MONST_INANIMATE } as any,
        });
        const ctx = makeCtx();
        ctx.rogue.xpxpThisTurn = 50;

        addXPXPToAlly(monst, ctx);

        expect(monst.xpxp).toBe(100);
    });

    it("grants telepathic bond at threshold", () => {
        const msgSpy = vi.fn();
        const visionSpy = vi.fn();
        const monst = makeCreature({
            creatureState: CreatureState.Ally,
            xpxp: XPXP_NEEDED_FOR_TELEPATHIC_BOND - 10,
        });
        const ctx = makeCtx({
            messageWithColor: msgSpy,
            updateVision: visionSpy,
        });
        ctx.rogue.xpxpThisTurn = 20;

        addXPXPToAlly(monst, ctx);

        expect(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED).toBeTruthy();
        expect(visionSpy).toHaveBeenCalled();
        expect(msgSpy).toHaveBeenCalled();
    });
});

// =============================================================================
// handleXPXP
// =============================================================================

describe("handleXPXP", () => {
    it("distributes xpxp to all allies and resets", () => {
        const ally = makeCreature({ creatureState: CreatureState.Ally, xpxp: 0 });
        const ctx = makeCtx();
        ctx.monsters = [ally];
        ctx.rogue.xpxpThisTurn = 10;

        handleXPXP(ctx);

        expect(ally.xpxp).toBe(10);
        expect(ctx.rogue.xpxpThisTurn).toBe(0);
    });
});

// =============================================================================
// recordCurrentCreatureHealths
// =============================================================================

describe("recordCurrentCreatureHealths", () => {
    it("snapshots player and monster HP", () => {
        const monst = makeCreature({ currentHP: 15, previousHealthPoints: 0 });
        const ctx = makeCtx();
        ctx.player.currentHP = 20;
        ctx.player.previousHealthPoints = 0;
        ctx.monsters = [monst];

        recordCurrentCreatureHealths(ctx);

        expect(ctx.player.previousHealthPoints).toBe(20);
        expect(monst.previousHealthPoints).toBe(15);
    });
});

// =============================================================================
// playerTurnEnded — basic flow
// =============================================================================

describe("playerTurnEnded", () => {
    it("calls handleXPXP and resetDFMessageEligibility", () => {
        const resetDFSpy = vi.fn();
        const ctx = makeCtx({
            resetDFMessageEligibility: resetDFSpy,
        });
        // Set gameHasEnded to true immediately to prevent infinite loops
        ctx.rogue.gameHasEnded = true;

        playerTurnEnded(ctx);

        expect(resetDFSpy).toHaveBeenCalled();
    });

    it("handles player falling", () => {
        const fallSpy = vi.fn();
        const healthSpy = vi.fn();
        const ctx = makeCtx({
            playerFalls: fallSpy,
            handleHealthAlerts: healthSpy,
        });
        ctx.player.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_FALLING;

        playerTurnEnded(ctx);

        expect(fallSpy).toHaveBeenCalled();
        expect(healthSpy).toHaveBeenCalled();
    });

    it("increments turn counters", () => {
        const ctx = makeCtx();
        ctx.rogue.playerTurnNumber = 0;
        ctx.rogue.absoluteTurnNumber = 0;
        ctx.player.ticksUntilTurn = 0;
        ctx.player.movementSpeed = 100;
        // Make environment update happen immediately
        ctx.rogue.ticksTillUpdateEnvironment = 1;
        // End game after one loop iteration
        let callCount = 0;
        const origUpdateEnv = ctx.updateEnvironment;
        ctx.updateEnvironment = () => {
            callCount++;
            if (callCount >= 1) {
                ctx.rogue.gameHasEnded = true;
            }
        };

        playerTurnEnded(ctx);

        expect(ctx.rogue.playerTurnNumber).toBe(1);
        expect(ctx.rogue.absoluteTurnNumber).toBe(1);
    });

    it("handles starvation death", () => {
        const gameOverSpy = vi.fn(() => { ctx.rogue.gameHasEnded = true; });
        const ctx = makeCtx({ gameOver: gameOverSpy });
        ctx.player.status[StatusEffect.Nutrition] = 0;
        ctx.player.currentHP = 1;

        playerTurnEnded(ctx);

        // After one iteration, HP goes to 0 and gameOver is called
        expect(gameOverSpy).toHaveBeenCalledWith("Starved to death", true);
    });

    it("handles burning damage", () => {
        const ctx = makeCtx();
        ctx.player.status[StatusEffect.Burning] = 2;
        // End game immediately after first loop
        ctx.rogue.gameHasEnded = false;
        let loopCount = 0;
        ctx.updateEnvironment = () => { loopCount++; ctx.rogue.gameHasEnded = true; };
        ctx.rogue.ticksTillUpdateEnvironment = 1;
        ctx.player.ticksUntilTurn = 0;
        ctx.player.movementSpeed = 100;

        playerTurnEnded(ctx);

        // Burning status should have been decremented
        expect(ctx.player.status[StatusEffect.Burning]).toBeLessThan(2);
    });

    it("completes cleanly with no monsters", () => {
        const removeDeadSpy = vi.fn();
        const ctx = makeCtx({ removeDeadMonsters: removeDeadSpy });
        // No monsters, no paralysis, environment updates fast
        ctx.player.ticksUntilTurn = 0;
        ctx.player.movementSpeed = 50;
        ctx.rogue.ticksTillUpdateEnvironment = 30;

        playerTurnEnded(ctx);

        expect(removeDeadSpy).toHaveBeenCalled();
        expect(ctx.rogue.justRested).toBe(false);
        expect(ctx.rogue.justSearched).toBe(false);
    });
});
