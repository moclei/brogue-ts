/*
 *  items/choose-target.test.ts — Tests for chooseTarget
 *  brogue-ts
 */

import { describe, it, expect, vi } from "vitest";
import {
    chooseTarget,
    type ChooseTargetContext,
} from "../../src/items/targeting.js";
import { AutoTargetMode, EventType, RNG, BoltEffect, DisplayGlyph } from "../../src/types/enums.js";
import { BoltFlag, TileFlag } from "../../src/types/flags.js";
import type { Bolt, Creature, Pcell, Pos, RogueEvent } from "../../src/types/types.js";

// =============================================================================
// Minimal helpers (duplicated from targeting.test.ts for file independence)
// =============================================================================

function pos(x: number, y: number): Pos { return { x, y }; }

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

function makePmap(width = 20, height = 20, defaultFlags = TileFlag.DISCOVERED): Pcell[][] {
    return Array.from({ length: width }, () =>
        Array.from({ length: height }, () => makeCell(defaultFlags)),
    );
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
// moveCursor stubs
// =============================================================================

type MoveCursorFn = ChooseTargetContext["moveCursor"];

/** Immediately cancels the targeting loop. */
function cancelMoveCursor(): MoveCursorFn {
    return async (_tc, ca) => { ca.value = true; return true; };
}

/** Confirms with the current targetLoc unchanged. */
function confirmMoveCursor(): MoveCursorFn {
    return async (tc) => { tc.value = true; return true; };
}

/** Confirms and moves targetLoc to the given position. */
function confirmAtMoveCursor(newPos: Pos): MoveCursorFn {
    return async (tc, _ca, _tk, tl) => { tc.value = true; tl.value = { ...newPos }; return true; };
}

/** Fires a right-mouse-up event without setting any output flags. */
function rightMouseMoveCursor(): MoveCursorFn {
    return async (_tc, _ca, _tk, _tl, ev) => {
        ev.value = {
            eventType: EventType.RightMouseUp, param1: 0, param2: 0,
            controlKey: false, shiftKey: false,
        };
        return false;
    };
}

// =============================================================================
// ChooseTargetContext factory
// =============================================================================

function makeChooseCtx(
    player: Creature,
    pmap: Pcell[][],
    moveCursor: MoveCursorFn,
    overrides: Partial<ChooseTargetContext> = {},
): ChooseTargetContext {
    return {
        rogue: {
            lastTarget: null,
            cursorLoc: pos(0, 0),
            RNG: RNG.Cosmetic,
            playbackMode: false,
            sidebarLocationList: Array.from({ length: 34 }, () => pos(-1, -1)),
            depthLevel: 1,
        },
        player,
        pmap,
        boltCatalog: [makeBolt()],  // index 0 = BOLT_NONE

        // AutoTargetContext
        monstersAreTeammates: () => false,
        canSeeMonster: () => false,
        openPathBetween: () => true,
        distanceBetween: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
        wandDominate: () => 50,
        negationWillAffectMonster: () => false,

        // NextTargetContext
        isPosInMap: (l) => l.x >= 0 && l.x < 20 && l.y >= 0 && l.y < 20,
        posEq: (a, b) => a.x === b.x && a.y === b.y,
        monsterAtLoc: () => null,
        itemAtLoc: () => null,

        // HiliteTrajectoryContext
        hiliteCell: vi.fn(),
        refreshDungeonCell: vi.fn(),
        playerCanSee: () => false,
        monsterIsHidden: () => false,
        cellHasTerrainFlag: () => false,

        // chooseTarget-specific
        playerCanSeeOrSense: () => false,
        cellHasTMFlag: () => false,
        refreshSideBar: vi.fn(),
        printLocationDescription: vi.fn(),
        confirmMessages: vi.fn(),

        moveCursor,
        ...overrides,
    };
}

// =============================================================================
// chooseTarget
// =============================================================================

describe("chooseTarget", () => {
    it("cancel path: moveCursor sets canceled → returns confirmed=false", async () => {
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), cancelMoveCursor());
        const result = await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(result.confirmed).toBe(false);
    });

    it("confirm path: moveCursor confirms at a new loc → returns confirmed=true with target", async () => {
        const player = makeCreature(5, 5);
        const targetPos = pos(10, 5);
        const ctx = makeChooseCtx(player, makePmap(), confirmAtMoveCursor(targetPos));
        const result = await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(result.confirmed).toBe(true);
        expect(result.target).toEqual(targetPos);
    });

    it("right-mouse-up event → loop sets canceled, next iteration exits → confirmed=false", async () => {
        // rightMouseMoveCursor fires RightMouseUp; chooseTarget sets canceled=true.
        // The next loop iteration hits `if (canceled)` at the top and returns CANCEL
        // without calling moveCursor a second time.
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), rightMouseMoveCursor());
        const result = await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(result.confirmed).toBe(false);
    });

    it("aim at origin: confirms but target == player loc → returns confirmed=false", async () => {
        // moveCursor confirms but leaves targetLoc at player.loc (the initial value)
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), confirmMoveCursor());
        const result = await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(result.confirmed).toBe(false);
    });

    it("playback mode: returns confirmed=false immediately without calling moveCursor", async () => {
        const player = makeCreature(5, 5);
        const moveCursorSpy = vi.fn() as unknown as MoveCursorFn;
        const ctx = makeChooseCtx(player, makePmap(), moveCursorSpy, {
            rogue: {
                lastTarget: null, cursorLoc: pos(0, 0), RNG: RNG.Cosmetic,
                playbackMode: true,
                sidebarLocationList: Array.from({ length: 34 }, () => pos(-1, -1)),
                depthLevel: 1,
            },
        });
        const result = await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(result.confirmed).toBe(false);
        expect(moveCursorSpy).not.toHaveBeenCalled();
    });

    it("updates rogue.lastTarget when a visible monster is at the confirmed target", async () => {
        const player = makeCreature(5, 5);
        const enemy = makeCreature(8, 5);
        const ctx = makeChooseCtx(player, makePmap(), confirmAtMoveCursor(pos(8, 5)), {
            monsterAtLoc: (loc) => (loc.x === 8 && loc.y === 5) ? enemy : null,
            canSeeMonster: () => true,
        });
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(ctx.rogue.lastTarget).toBe(enemy);
    });

    it("does not update lastTarget when target is the player", async () => {
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), confirmAtMoveCursor(pos(8, 5)), {
            monsterAtLoc: (loc) => (loc.x === 8 && loc.y === 5) ? player : null,
            canSeeMonster: () => true,
        });
        ctx.rogue.lastTarget = null;
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(ctx.rogue.lastTarget).toBeNull();
    });

    it("restores RNG to old value after cancel", async () => {
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), cancelMoveCursor());
        ctx.rogue.RNG = 0;
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(ctx.rogue.RNG).toBe(0);
    });

    it("restores RNG to old value after confirm", async () => {
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), confirmAtMoveCursor(pos(10, 5)));
        ctx.rogue.RNG = 0;
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(ctx.rogue.RNG).toBe(0);
    });

    it("refreshDungeonCell is called on cancel (erase trajectory)", async () => {
        const player = makeCreature(5, 5);
        const refreshSpy = vi.fn();
        const ctx = makeChooseCtx(player, makePmap(), cancelMoveCursor(), {
            refreshDungeonCell: refreshSpy,
        });
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(refreshSpy).toHaveBeenCalled();
    });

    it("cursorLoc is set to INVALID_POS after successful confirm", async () => {
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), confirmAtMoveCursor(pos(10, 5)));
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(ctx.rogue.cursorLoc).toEqual({ x: -1, y: -1 });
    });

    it("cursorLoc is set to INVALID_POS after cancel", async () => {
        const player = makeCreature(5, 5);
        const ctx = makeChooseCtx(player, makePmap(), cancelMoveCursor());
        ctx.rogue.cursorLoc = pos(5, 5);
        await chooseTarget(-1, AutoTargetMode.None, null, ctx);
        expect(ctx.rogue.cursorLoc).toEqual({ x: -1, y: -1 });
    });
});
