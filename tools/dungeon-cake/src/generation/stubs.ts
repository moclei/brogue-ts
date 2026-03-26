/*
 *  stubs.ts — No-op stubs for game subsystems not needed by the tool
 *  dungeon-cake
 *
 *  Machine generation calls ItemOps and MonsterOps, but all call sites are
 *  null-safe or failsafe-protected (verified: 20 call sites in machines.ts).
 *  Terrain layout is structurally complete with these stubs.
 *
 *  Phase 1b: PlayerCharacter and Creature stubs for CellQueryContext.
 *
 *  getCellSpriteData (io/sprite-appearance.ts) field access audit:
 *
 *  rogue (PlayerCharacter) — 3 fields accessed:
 *    .playbackOmniscience  → classifyVisibility, TM_IS_SECRET masking, hallucination suppression
 *    .inWater              → spriteData.inWater propagation, deep-water tint (Visible only)
 *    .trueColorMode        → light multiplier source, hallucination/bake bypass
 *
 *  player (Creature) — fields accessed directly + transitively:
 *    .info.displayChar     → ENTITY layer glyph (HAS_PLAYER)
 *    .info.foreColor       → ENTITY layer tint (HAS_PLAYER)
 *    .status[Hallucinating]→ hallucination check (two sites)
 *    .status[Telepathic]   → hallucination exclusion, monsterRevealed
 *    .status[Levitating]   → monsterHiddenBySubmersion (observer in deep water check)
 *    .loc                  → monsterHiddenBySubmersion (observer.loc terrain check)
 *    .bookkeepingFlags     → monstersAreTeammates (MB_FOLLOWER check)
 *    .creatureState        → monstersAreTeammates (Ally check)
 *    .leader               → monstersAreTeammates (leader identity comparison)
 *
 *  Stub strategy: all booleans false, all status effects 0, player position at
 *  staircase location (upLoc from generated pmap). No creatures/items exist in
 *  terrain-only mode, so the monster query paths are never reached — but stubs
 *  must be structurally valid to satisfy the type system.
 */

import type { Pcell, FloorTileType, PlayerCharacter, Creature, Pos } from "@game/types/types.js";
import type { ItemOps, MonsterOps, MachineItem } from "@game/architect/machines.js";
import type { BuildBridgeContext } from "@game/architect/lakes.js";
import type { CalculateDistancesContext } from "@game/dijkstra/dijkstra.js";
import type { FOVContext } from "@game/light/fov.js";
import type { CostMapFovContext } from "@game/movement/cost-maps-fov.js";
import { TileType, DisplayGlyph, StatusEffect, CreatureState } from "@game/types/enums.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "@game/types/constants.js";
import { cellHasTerrainFlag, cellHasTMFlag, discoveredTerrainFlagsAtLoc } from "@game/state/helpers.js";
import { calculateDistances, pathingDistance } from "@game/dijkstra/dijkstra.js";
import { getFOVMask } from "@game/light/fov.js";
import { populateGenericCostMap } from "@game/movement/cost-maps-fov.js";
import { analyzeMap } from "@game/architect/analysis.js";
import { allocGrid } from "@game/grid/grid.js";

// ── Pmap allocation ──────────────────────────────────────────────────────────

export function createPmap(): Pcell[][] {
    const map: Pcell[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        map[x] = [];
        for (let y = 0; y < DROWS; y++) {
            map[x]![y] = {
                layers: new Array(NUMBER_TERRAIN_LAYERS).fill(TileType.GRANITE) as TileType[],
                flags: 0,
                volume: 0,
                machineNumber: 0,
                rememberedAppearance: {
                    character: 0 as DisplayGlyph,
                    foreColorComponents: [0, 0, 0],
                    backColorComponents: [0, 0, 0],
                    opacity: 0,
                },
                rememberedLayers: [],
                rememberedItemCategory: 0,
                rememberedItemKind: 0,
                rememberedItemQuantity: 0,
                rememberedItemOriginDepth: 0,
                rememberedTerrain: TileType.NOTHING,
                rememberedCellFlags: 0,
                rememberedTerrainFlags: 0,
                rememberedTMFlags: 0,
                exposedToFire: 0,
            };
        }
    }
    return map;
}

// ── Item/Monster operation stubs ─────────────────────────────────────────────

export const itemOps: ItemOps = {
    generateItem: (category: number, kind: number): MachineItem => ({
        category,
        kind,
        quantity: 1,
        flags: 0,
        keyLoc: [],
        originDepth: 0,
    }),
    deleteItem: () => {},
    placeItemAt: () => {},
    removeItemFromArray: () => {},
    itemIsHeavyWeapon: () => false,
    itemIsPositivelyEnchanted: () => false,
};

export const monsterOps: MonsterOps = {
    spawnHorde: () => null,
    monsterAtLoc: () => null,
    killCreature: () => {},
    generateMonster: () => null,
    toggleMonsterDormancy: () => {},
    iterateMachineMonsters: () => [],
};

// ── Callback context factories ───────────────────────────────────────────────

function successorTerrainFlags(
    tileCatalog: readonly FloorTileType[],
    dfCatalog: readonly { tile?: number }[],
    tileType: number,
): number {
    const df = tileCatalog[tileType]?.discoverType ?? 0;
    return df ? (tileCatalog[dfCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
}

export function makeFovCtx(pmap: Pcell[][]): FOVContext {
    return {
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlag(pmap, pos, flags),
        getCellFlags: (x, y) => pmap[x]![y]!.flags,
    };
}

export function makeCalcDistCtx(
    pmap: Pcell[][],
    tileCatalog: readonly FloorTileType[],
    dfCatalog: readonly { tile?: number }[],
): CalculateDistancesContext {
    return {
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlag(pmap, pos, flags),
        cellHasTMFlag: (pos, flags) => cellHasTMFlag(pmap, pos, flags),
        monsterAtLoc: () => null,
        monsterAvoids: () => false,
        discoveredTerrainFlagsAtLoc: (pos) =>
            discoveredTerrainFlagsAtLoc(pmap, pos, tileCatalog,
                (tt) => successorTerrainFlags(tileCatalog, dfCatalog, tt)),
    };
}

export function makeCostMapCtx(
    pmap: Pcell[][],
    tileCatalog: readonly FloorTileType[],
    dfCatalog: readonly { tile?: number }[],
): CostMapFovContext {
    return {
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlag(pmap, pos, flags),
        cellHasTMFlag: (pos, flags) => cellHasTMFlag(pmap, pos, flags),
        discoveredTerrainFlagsAtLoc: (pos) =>
            discoveredTerrainFlagsAtLoc(pmap, pos, tileCatalog,
                (tt) => successorTerrainFlags(tileCatalog, dfCatalog, tt)),
    } as unknown as CostMapFovContext;
}

// ── Architect callback wrapper builder ───────────────────────────────────────

export interface ArchitectCallbacks {
    analyzeMapWrap: (calcChoke: boolean) => void;
    calcDistWrap: (
        grid: number[][], x: number, y: number, blockFlags: number,
        traveler: null, canUseSecretDoors: boolean, eightWays: boolean,
    ) => void;
    getFOVMaskWrap: (
        grid: number[][], x: number, y: number, r: bigint,
        ft: number, ff: number, c: boolean,
    ) => void;
    costMapWrap: (costMap: number[][]) => void;
    pathDistWrap: (x1: number, y1: number, x2: number, y2: number, blockFlags: number) => number;
    chokeMap: number[][];
}

export function makeArchitectCallbacks(
    pmap: Pcell[][],
    tileCatalog: readonly FloorTileType[],
    dfCatalog: readonly { tile?: number }[],
): ArchitectCallbacks {
    const chokeMap = allocGrid();
    const fovCtx = makeFovCtx(pmap);
    const costCtx = makeCostMapCtx(pmap, tileCatalog, dfCatalog);

    return {
        chokeMap,
        analyzeMapWrap: (calcChoke) =>
            analyzeMap(pmap, chokeMap, calcChoke),
        calcDistWrap: (grid, x, y, blockFlags, _traveler, canUseSecretDoors, eightWays) =>
            calculateDistances(grid, x, y, blockFlags, null, canUseSecretDoors, eightWays,
                makeCalcDistCtx(pmap, tileCatalog, dfCatalog)),
        getFOVMaskWrap: (grid, x, y, r, ft, ff, c) =>
            getFOVMask(grid, x, y, r, ft, ff, c, fovCtx),
        costMapWrap: (costMap) =>
            populateGenericCostMap(costMap, costCtx),
        pathDistWrap: (x1, y1, x2, y2, blockFlags) =>
            pathingDistance(x1, y1, x2, y2, blockFlags, makeCalcDistCtx(pmap, tileCatalog, dfCatalog)),
    };
}

// ── Bridge context factory ───────────────────────────────────────────────────

export function makeBridgeContext(
    depthLevel: number,
    callbacks: ArchitectCallbacks,
): BuildBridgeContext {
    return {
        depthLevel,
        depthAccelerator: 0,
        pathingDistance: callbacks.pathDistWrap,
    };
}

// ── PlayerCharacter / Creature stubs (Phase 1b — CellQueryContext) ───────────

function zeroStatusArray(): number[] {
    return new Array(StatusEffect.NumberOfStatusEffects).fill(0);
}

const stubColor = { red: 100, green: 100, blue: 100, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };

/**
 * Minimal Creature stub for the player. Position defaults to (0,0); callers
 * should set `.loc` to the staircase position from the generated pmap.
 */
export function createPlayerCreatureStub(loc: Pos = { x: 0, y: 0 }): Creature {
    return {
        info: {
            monsterID: 0,
            monsterName: "player",
            displayChar: DisplayGlyph.G_PLAYER,
            foreColor: { ...stubColor },
            maxHP: 1,
            defense: 0,
            accuracy: 0,
            damage: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
            turnsBetweenRegen: 0,
            movementSpeed: 100,
            attackSpeed: 100,
            bloodType: 0,
            intrinsicLightType: 0,
            isLarge: false,
            DFChance: 0,
            DFType: 0,
            bolts: [],
            flags: 0,
            abilityFlags: 0,
        },
        loc,
        depth: 0,
        currentHP: 1,
        turnsUntilRegen: 0,
        regenPerTurn: 0,
        weaknessAmount: 0,
        poisonAmount: 0,
        creatureState: CreatureState.Sleeping,
        creatureMode: 0,
        mutationIndex: -1,
        wasNegated: false,
        targetWaypointIndex: 0,
        waypointAlreadyVisited: [],
        lastSeenPlayerAt: { x: 0, y: 0 },
        targetCorpseLoc: { x: 0, y: 0 },
        targetCorpseName: "",
        absorptionFlags: 0,
        absorbBehavior: false,
        absorptionBolt: 0,
        corpseAbsorptionCounter: 0,
        mapToMe: null,
        safetyMap: null,
        ticksUntilTurn: 0,
        movementSpeed: 100,
        attackSpeed: 100,
        previousHealthPoints: 1,
        turnsSpentStationary: 0,
        flashStrength: 0,
        flashColor: { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
        status: zeroStatusArray(),
        maxStatus: zeroStatusArray(),
        bookkeepingFlags: 0,
        spawnDepth: 0,
        machineHome: 0,
        xpxp: 0,
        newPowerCount: 0,
        totalPowerCount: 0,
        leader: null,
        carriedMonster: null,
        carriedItem: null,
    };
}

/**
 * Minimal PlayerCharacter stub. Fields accessed by getCellSpriteData
 * (playbackOmniscience, inWater, trueColorMode) plus lighting fields
 * (minersLight, minersLightRadius, lightMultiplier) for updateLighting.
 */
export function createRogueStub(): PlayerCharacter {
    return {
        playbackOmniscience: false,
        inWater: false,
        trueColorMode: false,
        minersLight: {
            lightColor: { red: 180, green: 180, blue: 180, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
            lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
            radialFadeToPercent: 35,
            passThroughCreatures: true,
        },
        minersLightRadius: BigInt(78) * 65536n,
        lightMultiplier: 7,
    } as PlayerCharacter;
}
