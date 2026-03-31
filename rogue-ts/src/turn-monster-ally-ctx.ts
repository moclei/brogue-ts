/*
 *  turn-monster-ally-ctx.ts — buildMoveAllyContext factory
 *  Port V2 — rogue-ts
 *
 *  Builds MoveAllyContext for monstersTurn().
 *  Extracted from turn-monster-ai.ts (Phase 7 close-out) to keep both files
 *  under the 600-line limit.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos } from "./types/types.js";
import type { MoveAllyContext } from "./monsters/monster-actions.js";
import type { PathTowardCreatureContext } from "./monsters/monster-actions.js";
import type { ScentDirectionContext } from "./monsters/monster-actions.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import type { TravelExploreContext } from "./movement/travel-explore.js";
import type { SafetyMapsContext } from "./time/safety-maps.js";
import {
    TerrainFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag,
    T_HARMFUL_TERRAIN,
} from "./types/flags.js";
import { BoltEffect, CreatureState, StatusEffect } from "./types/enums.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { randPercent } from "./math/rng.js";
import { nbDirs, coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { monsterText } from "./globals/monster-text.js";
import { goodMessageColor } from "./globals/colors.js";
import { allocGrid } from "./grid/grid.js";
import { distanceBetween } from "./monsters/monster-state.js";
import { updateSafeTerrainMap as updateSafeTerrainMapFn } from "./time/safety-maps.js";
import { dijkstraScan as dijkstraScanFn } from "./dijkstra/dijkstra.js";
import {
    monsterWillAttackTarget as monsterWillAttackTargetFn,
    canSeeMonster as canSeeMonsterFn,
    attackWouldBeFutile as attackWouldBeFutileFn,
} from "./monsters/monster-queries.js";
import {
    pathTowardCreature as pathTowardCreatureFn,
    scentDirection as scentDirectionFn,
    monsterSummons as monsterSummonsFn,
} from "./monsters/monster-actions.js";
import { allyFlees as allyFleesFn } from "./monsters/monster-flee-ai.js";
import { monsterFleesFrom } from "./monsters/monster-state.js";
import { monstUseMagic as monstUseMagicFn, monsterHasBoltEffect as monsterHasBoltEffectFn } from "./monsters/monster-bolt-ai.js";
import {
    monsterBlinkToPreferenceMap as monsterBlinkToPreferenceMapFn,
    monsterBlinkToSafety as monsterBlinkToSafetyFn,
} from "./monsters/monster-blink-ai.js";
import { nextStep as nextStepFn } from "./movement/travel-explore.js";
import { discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn } from "./state/helpers.js";

// =============================================================================
// MoveAllyCtxDeps — dependencies injected from buildMonstersTurnContext
// =============================================================================

/** Raw closure-captured state passed into buildMoveAllyContext(). */
export interface MoveAllyCtxDeps {
    player: Creature;
    monsters: Creature[];
    rogue: {
        mapToSafeTerrain: number[][] | null;
        updatedMapToSafeTerrainThisTurn: boolean;
        justRested: boolean;
        justSearched: boolean;
        playbackOmniscience: boolean;
    };
    pmap: Pcell[][];
    monsterCatalog: ReturnType<typeof import("./core.js").getGameState>["monsterCatalog"];
    sharedSafetyMap: number[][];
    scentMap: number[][];
    io: { messageWithColor: MoveAllyContext["messageWithColor"] };
    chTF: (loc: Pos, flags: number) => boolean;
    chTMF: (loc: Pos, flags: number) => boolean;
    inFOV: (loc: Pos) => boolean;
    monsterAtLoc: (loc: Pos) => Creature | null;

    // Forward-declared impls (assigned by the time context functions are called)
    traversibleImpl: (monst: Creature, x: number, y: number) => boolean;
    moveMonsterImpl: (monst: Creature, dx: number, dy: number) => boolean;
    mmptImpl: (monst: Creature, t: Pos, w: boolean) => boolean;
    monsterMillAboutImpl: (monst: Creature, chance: number) => void;

    // Sub-contexts
    boltAICtx: Parameters<typeof monstUseMagicFn>[1];
    blinkCtx: Parameters<typeof monsterBlinkToPreferenceMapFn>[3];
    blinkToSafetyCtx: Parameters<typeof monsterBlinkToSafetyFn>[1];
    summonsCtx: Parameters<typeof monsterSummonsFn>[2];
    queryCtx: MonsterQueryContext;
    pathCtx: PathTowardCreatureContext;
    scentDirCtx: ScentDirectionContext;
    nextStepCtx: TravelExploreContext;
    randValidDirShared: (monst: Creature, x: number, y: number, allowDiag: boolean) => number;

    buildMonsterName: (monst: Creature, includeArticle: boolean) => string;
}

// =============================================================================
// buildMoveAllyContext
// =============================================================================

/**
 * Builds the MoveAllyContext for moveAlly().
 * All closure variables are injected via the deps parameter.
 */
export function buildMoveAllyContext(deps: MoveAllyCtxDeps): MoveAllyContext {
    const {
        player, monsters, rogue, pmap, sharedSafetyMap, scentMap, io,
        chTF, chTMF, inFOV, monsterAtLoc,
        traversibleImpl, moveMonsterImpl, mmptImpl, monsterMillAboutImpl,
        boltAICtx, blinkCtx, blinkToSafetyCtx, summonsCtx,
        queryCtx, pathCtx, scentDirCtx, nextStepCtx, randValidDirShared,
        buildMonsterName,
    } = deps;

    function makeUpdateSafeTerrainCtx() {
        return {
            rogue, player, pmap, monsters, dormantMonsters: [],
            safetyMap: sharedSafetyMap, allySafetyMap: sharedSafetyMap,
            DCOLS, DROWS, FP_FACTOR: 1, floorItems: [],
            cellHasTerrainFlag: chTF, cellHasTMFlag: chTMF,
            coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
            discoveredTerrainFlagsAtLoc: (pos: Pos) => discoveredTerrainFlagsAtLocFn(
                pmap, pos, tileCatalog, (t) => {
                    const df = tileCatalog[t]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            monsterAtLoc, allocGrid, freeGrid: () => {},
            dijkstraScan: dijkstraScanFn,
            max: Math.max, min: Math.min,
            pmapAt: (loc: Pos) => pmap[loc.x][loc.y],
            monstersAreEnemies: () => false,
            monsterRevealed: () => false,
            zeroOutGrid: () => {},
            getFOVMask: () => {},
            updateLighting: () => {},
            updateFieldOfViewDisplay: () => {},
            discoverCell: () => {},
            refreshDungeonCell: () => {},
        } as unknown as SafetyMapsContext;
    }

    return {
        player, monsters,
        rng: { randPercent: (pct) => randPercent(pct) },
        cellHasTerrainFlag: chTF,
        T_HARMFUL_TERRAIN,
        T_IS_FIRE: TerrainFlag.T_IS_FIRE,
        T_CAUSES_DAMAGE: TerrainFlag.T_CAUSES_DAMAGE,
        T_CAUSES_PARALYSIS: TerrainFlag.T_CAUSES_PARALYSIS,
        T_CAUSES_CONFUSION: TerrainFlag.T_CAUSES_CONFUSION,
        MONST_INANIMATE: MonsterBehaviorFlag.MONST_INANIMATE,
        MONST_INVULNERABLE: MonsterBehaviorFlag.MONST_INVULNERABLE,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        MONST_ALWAYS_USE_ABILITY: MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY,
        MONST_ALWAYS_HUNTING: MonsterBehaviorFlag.MONST_ALWAYS_HUNTING,
        mapToSafeTerrain: rogue.mapToSafeTerrain,
        updatedMapToSafeTerrainThisTurn: rogue.updatedMapToSafeTerrainThisTurn,
        updateSafeTerrainMap: () => updateSafeTerrainMapFn(makeUpdateSafeTerrainCtx()),
        monsterWillAttackTarget: (monst, target) =>
            monsterWillAttackTargetFn(monst, target, player, chTF),
        traversiblePathBetween: (monst, x, y) => traversibleImpl(monst, x, y),
        moveMonster: (monst, dx, dy) => moveMonsterImpl(monst, dx, dy),
        moveMonsterPassivelyTowards: (monst, t, w) => mmptImpl(monst, t, w),
        monsterBlinkToPreferenceMap: (monst, map, uphill) =>
            monsterBlinkToPreferenceMapFn(monst, map, uphill, blinkCtx),
        monsterBlinkToSafety: (monst) => monsterBlinkToSafetyFn(monst, blinkToSafetyCtx),
        monstUseMagic: (monst) => monstUseMagicFn(monst, boltAICtx),
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
        nextStep: (map, loc, monst, inc) => nextStepFn(map, loc, monst, inc, nextStepCtx),
        randValidDirectionFrom: (m, x, y, a) => randValidDirShared(m, x, y, a),
        pathTowardCreature: (monst, target) => pathTowardCreatureFn(monst, target, pathCtx),
        nbDirs, NO_DIRECTION: -1, DCOLS, DROWS,
        allyFlees: (ally, closestEnemy) => allyFleesFn(ally, closestEnemy, {
            player,
            monsterFleesFrom: (m: Creature, d: Creature) => monsterFleesFrom(m, d, player, chTF),
        }),
        justRested: rogue.justRested,
        justSearched: rogue.justSearched,
        MB_SEIZED: MonsterBookkeepingFlag.MB_SEIZED,
        MB_FOLLOWER: MonsterBookkeepingFlag.MB_FOLLOWER,
        MB_SUBMERGED: MonsterBookkeepingFlag.MB_SUBMERGED,
        MB_DOES_NOT_TRACK_LEADER: MonsterBookkeepingFlag.MB_DOES_NOT_TRACK_LEADER,
        STATUS_INVISIBLE: StatusEffect.Invisible,
        STATUS_IMMUNE_TO_FIRE: StatusEffect.ImmuneToFire,
        MONST_MAINTAINS_DISTANCE: MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE,
        MONST_FLITS: MonsterBehaviorFlag.MONST_FLITS,
        MONST_IMMOBILE: MonsterBehaviorFlag.MONST_IMMOBILE,
        MONSTER_TRACKING_SCENT: CreatureState.TrackingScent,
        attackWouldBeFutile: (monst, target) => attackWouldBeFutileFn(monst, target, player, chTF),
        monsterHasBoltEffect: (monst, effectType) => monsterHasBoltEffectFn(monst, effectType, boltCatalog),
        BE_BLINKING: BoltEffect.Blinking,
        allySafetyMap: allocGrid(),
        distanceBetween,

        // Corpse-eating branch
        isPosInMap: (pos) => coordinatesAreInMap(pos.x, pos.y),
        STATUS_POISONED: StatusEffect.Poisoned,
        STATUS_BURNING: StatusEffect.Burning,
        canSeeMonster: (monst) => canSeeMonsterFn(monst, queryCtx),
        monsterName: buildMonsterName,
        getMonsterAbsorbingText: (monst) => monsterText[monst.info.monsterID]?.absorbing ?? "",
        goodMessageColor,
        messageWithColor: io.messageWithColor,
        MB_ABSORBING: MonsterBookkeepingFlag.MB_ABSORBING,

        // Mill-about / scent-follow
        inFieldOfView: inFOV,
        monsterMillAbout: (monst, chance) => monsterMillAboutImpl(monst, chance),
        MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
        scentMap,
        scentDirection: (monst) => scentDirectionFn(monst, scentDirCtx),
    };
}
