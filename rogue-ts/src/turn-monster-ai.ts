/*
 *  turn-monster-ai.ts — buildMonstersTurnContext: wired monster AI context
 *  Port V2 — rogue-ts
 *
 *  Extracted from turn.ts (Phase 2a) so that turn.ts stays under 600 lines.
 *  Provides the fully-wired MonstersTurnContext for monstersTurn().
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver } from "./core.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
} from "./state/helpers.js";
import { allocGrid, copyGrid } from "./grid/grid.js";
import { randRange, randPercent } from "./math/rng.js";
import { nbDirs, coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { monsterCatalog } from "./globals/monster-catalog.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { monsterText } from "./globals/monster-text.js";
import { DCOLS, DROWS } from "./types/constants.js";
import {
    TileFlag, MonsterBookkeepingFlag, MonsterBehaviorFlag, TerrainFlag,
    MonsterAbilityFlag, T_HARMFUL_TERRAIN,
} from "./types/flags.js";
import { BoltEffect, BoltType, CreatureState, DungeonLayer, LightType, StatusEffect } from "./types/enums.js";
import { openPathBetween as openPathBetweenFn } from "./items/bolt-geometry.js";
import {
    monsterIsHidden as monsterIsHiddenFn,
    monstersAreTeammates as monstersAreTeammatesFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
    monsterWillAttackTarget as monsterWillAttackTargetFn,
} from "./monsters/monster-queries.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import { distanceBetween, updateMonsterState as updateMonsterStateFn, monsterAvoids as monsterAvoidsFn, chooseNewWanderDestination as chooseNewWanderDestFn } from "./monsters/monster-state.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import { avoidedFlagsForMonster } from "./monsters/monster-spawning.js";
import {
    monstUseMagic as monstUseMagicFn,
    monsterHasBoltEffect as monsterHasBoltEffectFn,
    monsterCanShootWebs as monsterCanShootWebsFn,
} from "./monsters/monster-bolt-ai.js";
import type { BoltAIContext } from "./monsters/monster-bolt-ai.js";
import { monsterSummons as monsterSummonsFn } from "./monsters/monster-actions.js";
import type { MonsterSummonsContext, MonstersTurnContext } from "./monsters/monster-actions.js";
import {
    scentDirection as scentDirectionFn,
    isLocalScentMaximum as isLocalScentMaximumFn,
    pathTowardCreature as pathTowardCreatureFn,
    traversiblePathBetween as traversiblePathBetweenFn,
    isValidWanderDestination as isValidWanderDestinationFn,
    wanderToward as wanderTowardFn,
    monsterMillAbout as monsterMillAboutFn,
    moveAlly as moveAllyFn,
} from "./monsters/monster-actions.js";
import type {
    ScentDirectionContext, LocalScentContext, PathTowardCreatureContext,
    TraversiblePathContext, WanderContext, WanderTowardContext,
    MonsterMillAboutContext, MoveAllyContext,
} from "./monsters/monster-actions.js";
import {
    moveMonster as moveMonsterFn,
    moveMonsterPassivelyTowards as mmptFn,
    randValidDirectionFrom as randValidDirectionFromFn,
    canPass as canPassFn,
} from "./monsters/monster-movement.js";
import type { MoveMonsterContext } from "./monsters/monster-movement.js";
import { monsterSwarmDirection as monsterSwarmDirectionFn } from "./monsters/monster-swarm-ai.js";
import { allyFlees as allyFleesFn } from "./monsters/monster-flee-ai.js";
import { monsterFleesFrom } from "./monsters/monster-state.js";
import { summonMinions as summonMinionsFn } from "./monsters/monster-summoning.js";
import type { SummonMinionsContext } from "./monsters/monster-summoning.js";
import { spawnMinions as spawnMinionsFn } from "./monsters/monster-spawning.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import { getSafetyMap as getSafetyMapFn } from "./monsters/monster-flee-ai.js";
import {
    monsterBlinkToPreferenceMap as monsterBlinkToPreferenceMapFn,
    monsterBlinkToSafety as monsterBlinkToSafetyFn,
} from "./monsters/monster-blink-ai.js";
import type { MonsterBlinkContext, MonsterBlinkToSafetyContext } from "./monsters/monster-blink-ai.js";
import { diagonalBlocked as diagonalBlockedFn } from "./combat/combat-math.js";
import {
    attack as attackFn,
    buildHitList as buildHitListFn,
} from "./combat/combat-attack.js";
import { buildCombatAttackContext } from "./combat.js";
import { passableArcCount } from "./architect/helpers.js";
import { buildRefreshDungeonCellFn, buildMessageFns } from "./io-wiring.js";
import { buildResolvePronounEscapesFn } from "./io/text.js";
import {
    awareOfTarget as awareOfTargetFn,
    closestWaypointIndex as closestWaypointIndexFn,
    closestWaypointIndexTo as closestWaypointIndexToFn,
} from "./monsters/monster-awareness.js";
import { burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn } from "./state/helpers.js";
import type { Creature, Pos } from "./types/types.js";

// =============================================================================
// buildMonstersTurnContext
// =============================================================================

/**
 * Builds the fully-wired MonstersTurnContext for monstersTurn().
 * Extracted from turn.ts so that turn.ts stays under 600 lines.
 */
export function buildMonstersTurnContext(): MonstersTurnContext {
    const { player, rogue, pmap, monsters } = getGameState();
    const io = buildMessageFns();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const resolvePronounEscapes = buildResolvePronounEscapesFn(player, pmap, rogue);
    const attackCtx = buildCombatAttackContext();

    // Ensure scentMap is allocated — shared between turn and monster AI
    if (!rogue.scentMap) rogue.scentMap = allocGrid();
    const scentMap = rogue.scentMap;

    // ── Shared helpers ────────────────────────────────────────────────────────
    function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    }

    const chTF = (loc: Pos, flags: number) => cellHasTerrainFlagFn(pmap, loc, flags);
    const chTMF = (loc: Pos, flags: number) => cellHasTMFlagFn(pmap, loc, flags);
    const cellFlags = (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0;
    const inFOV = (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW);
    const diagBlocked = (x1: number, y1: number, x2: number, y2: number, _ip: boolean) =>
        diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos));

    // ── Forward declarations (broken circular dependency) ─────────────────────
    let monsterAvoidsImpl: (monst: Creature, p: Pos) => boolean = () => false;
    let moveMonsterImpl: (monst: Creature, dx: number, dy: number) => boolean = () => false;
    let mmptImpl: (monst: Creature, t: Pos, w: boolean) => boolean = () => false;
    let traversibleImpl: (monst: Creature, x: number, y: number) => boolean = () => false;

    // ── Query context ─────────────────────────────────────────────────────────
    const queryCtx: MonsterQueryContext = {
        player,
        cellHasTerrainFlag: chTF,
        cellHasGas: (loc) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // ── MonsterStateContext ───────────────────────────────────────────────────
    const monsterStateCtx: MonsterStateContext = {
        player, monsters,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        queryCtx,
        cellHasTerrainFlag: chTF,
        cellHasTMFlag: chTMF,
        terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
        cellFlags,
        isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
        downLoc: rogue.downLoc,
        upLoc: rogue.upLoc,
        monsterAtLoc,
        waypointCount: rogue.wpCount,
        maxWaypointCount: rogue.wpCount,
        closestWaypointIndex: (m) => closestWaypointIndexFn(m, rogue.wpCount, rogue.wpDistance, DCOLS),
        closestWaypointIndexTo: (l) => closestWaypointIndexToFn(l, rogue.wpCount, rogue.wpDistance),
        burnedTerrainFlagsAtLoc: (loc) => burnedTerrainFlagsAtLocFn(pmap, loc),
        discoveredTerrainFlagsAtLoc: () => 0,
        passableArcCount: (x, y) => passableArcCount(pmap, x, y),
        awareOfTarget: (observer, target) => awareOfTargetFn(observer, target, {
            player, scentMap: scentMap as number[][], scentTurnNumber: rogue.scentTurnNumber,
            stealthRange: rogue.stealthRange,
            openPathBetween: (l1, l2) => openPathBetweenFn(l1, l2, (pos) => chTF(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
            inFieldOfView: inFOV, randPercent,
        }),
        openPathBetween: (loc1, loc2) =>
            openPathBetweenFn(loc1, loc2, (pos) => chTF(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
        traversiblePathBetween: (monst, x, y) => traversibleImpl(monst, x, y),
        inFieldOfView: inFOV,
        // Side effects
        heal: () => {},
        inflictDamage: () => false,
        killCreature: () => {},
        extinguishFireOnCreature: () => {},
        makeMonsterDropItem: () => {},
        refreshDungeonCell,
        message: io.message,
        messageWithColor: (text, flags) => io.message(text, flags),
        combatMessage: (text) => io.combatMessage(text, null),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerHasRespirationArmor: () => false,
        mapToShore: rogue.mapToShore,
        PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
        HAS_STAIRS: TileFlag.HAS_STAIRS,
        IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
        monsterCanSubmergeNow: () => false,
        DCOLS, DROWS,
    };

    // Now that monsterStateCtx is built, assign real implementations
    monsterAvoidsImpl = (monst, p) => monsterAvoidsFn(monst, p, monsterStateCtx);
    const traversibleCtx: TraversiblePathContext = {
        monsterAvoids: (monst, p) => monsterAvoidsImpl(monst, p),
        DCOLS, DROWS,
    };
    traversibleImpl = (monst, x, y) => traversiblePathBetweenFn(monst, x, y, traversibleCtx);

    // ── Swarm context ─────────────────────────────────────────────────────────
    const swarmCtx = {
        player, monsters, distanceBetween,
        diagonalBlocked: (x1: number, y1: number, x2: number, y2: number) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos)),
        isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
        cellFlags,
        monsterAvoids: (monst: Creature, p: Pos) => monsterAvoidsImpl(monst, p),
        monstersAreTeammates: (a: Creature, b: Creature) => monstersAreTeammatesFn(a, b, player),
        monstersAreEnemies: (a: Creature, b: Creature) =>
            monstersAreEnemiesFn(a, b, player, chTF),
        shuffleList: (list: number[]) => {
            for (let i = list.length - 1; i > 0; i--) {
                const j = randRange(0, i);
                [list[i], list[j]] = [list[j], list[i]];
            }
        },
        nbDirs,
        DIRECTION_COUNT: 8,
        NO_DIRECTION: -1,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        MONST_ATTACKABLE_THRU_WALLS: MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS,
    };

    // ── MoveMonsterContext ────────────────────────────────────────────────────
    const localSafetyMap = allocGrid();
    const moveMonsterCtx: MoveMonsterContext = {
        player, monsters,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        coordinatesAreInMap,
        cellHasTerrainFlag: chTF,
        cellHasTMFlag: chTMF,
        cellFlags,
        setCellFlag: (loc, flag) => { if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag; },
        clearCellFlag: (loc, flag) => { if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags &= ~flag; },
        discoveredTerrainFlagsAtLoc: () => 0,
        passableArcCount: (x, y) => passableArcCount(pmap, x, y),
        liquidLayerIsEmpty: (loc) => !pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Liquid],
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        monsterAtLoc,
        refreshDungeonCell,
        discover: (x, y) => { if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED; },
        applyInstantTileEffectsToCreature: () => {},    // permanent-defer — chasms/tile effects (see TASKS.md)
        updateVision: () => {},                         // permanent-defer — visual update (wired in turn/lifecycle)
        pickUpItemAt: () => {},                         // stub — Phase 3a
        shuffleList: (list) => {
            for (let i = list.length - 1; i > 0; i--) {
                const j = randRange(0, i);
                [list[i], list[j]] = [list[j], list[i]];
            }
        },
        monsterAvoids: (monst, p) => monsterAvoidsImpl(monst, p),
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
        HAS_ITEM: TileFlag.HAS_ITEM,
        HAS_STAIRS: TileFlag.HAS_STAIRS,
        DCOLS, DROWS,
        // Extended MoveMonsterContext fields
        vomit: () => {},                                // stub
        randValidDirectionFrom: (monst, x, y, allowDiag) =>
            randValidDirectionFromFn(monst, x, y, allowDiag, {
                coordinatesAreInMap, cellHasTerrainFlag: chTF, cellFlags,
                diagonalBlocked: diagBlocked, monsterAvoids: (m, p) => monsterAvoidsImpl(m, p),
                nbDirs, HAS_PLAYER: TileFlag.HAS_PLAYER, NO_DIRECTION: -1,
                rng: { randRange },
            }),
        nbDirs,
        diagonalBlocked: diagBlocked,
        handleWhipAttacks: () => false,                 // stub — Phase 3b weapon-attacks
        handleSpearAttacks: () => false,                // stub — Phase 3b weapon-attacks
        monsterSwarmDirection: (monst, target) => monsterSwarmDirectionFn(monst, target, swarmCtx),
        buildHitList: (hitList, attacker, defender, allAdj) => {
            const result = buildHitListFn(attacker, defender, allAdj, attackCtx);
            for (let i = 0; i < result.length; i++) hitList[i] = result[i];
        },
        attack: (attacker, defender, lunge) =>
            attackFn(attacker, defender, lunge, attackCtx),
        getQualifyingPathLocNear: (target) => target,   // stub — Phase 3a
        surfaceLayerAt: (loc) => pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Surface] ?? 0,
        clearSurfaceLayer: (loc) => { if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].layers[DungeonLayer.Surface] = 0; },
        surfaceLayerHasFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
        gameHasEnded: rogue.gameHasEnded,
        NO_DIRECTION: -1,
        forbiddenFlagsForMonster: (info) => avoidedFlagsForMonster(info),
    };
    moveMonsterImpl = (monst, dx, dy) => moveMonsterFn(monst, dx, dy, moveMonsterCtx);
    mmptImpl = (monst, t, w) => mmptFn(monst, t, w, moveMonsterCtx);

    // ── Scent contexts ────────────────────────────────────────────────────────
    const scentDirCtx: ScentDirectionContext = {
        scentMap,
        coordinatesAreInMap,
        cellHasTerrainFlag: chTF,
        cellFlags,
        diagonalBlocked: diagBlocked,
        monsterAvoids: (monst, p) => monsterAvoidsImpl(monst, p),
        monsterAtLoc,
        canPass: (mover, blocker) => canPassFn(mover, blocker, player, chTF),
        nbDirs,
        NO_DIRECTION: -1,
        DIRECTION_COUNT: 8,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
    };

    const localScentCtx: LocalScentContext = {
        scentMap,
        cellHasTerrainFlag: chTF,
        diagonalBlocked: diagBlocked,
        coordinatesAreInMap,
        nbDirs,
        DIRECTION_COUNT: 8,
    };

    // ── Wander contexts ───────────────────────────────────────────────────────
    const wanderCtx: WanderContext = {
        waypointCount: rogue.wpCount,
        waypointDistanceMap: () => null,                // stub — Phase 6
        nextStep: () => -1,                             // stub — Phase 2b/3
        NO_DIRECTION: -1,
    };

    const wanderTowardCtx: WanderTowardContext = {
        DCOLS, DROWS,
        waypointCount: rogue.wpCount,
        waypointDistanceMap: () => null,                // stub — Phase 6
        closestWaypointIndexTo: () => -1,               // stub — Phase 6
    };

    // ── Path toward creature context ──────────────────────────────────────────
    const pathCtx: PathTowardCreatureContext = {
        traversiblePathBetween: (monst, x, y) => traversibleImpl(monst, x, y),
        distanceBetween,
        moveMonsterPassivelyTowards: (monst, t, w) => mmptImpl(monst, t, w),
        monsterBlinkToPreferenceMap: (monst, map, uphill) =>
            monsterBlinkToPreferenceMapFn(monst, map, uphill, blinkCtx),
        nextStep: () => -1,                             // stub — Phase 2b/3
        randValidDirectionFrom: (monst, x, y, allowDiag) =>
            randValidDirectionFromFn(monst, x, y, allowDiag, {
                coordinatesAreInMap, cellHasTerrainFlag: chTF, cellFlags,
                diagonalBlocked: diagBlocked, monsterAvoids: (m, p) => monsterAvoidsImpl(m, p),
                nbDirs, HAS_PLAYER: TileFlag.HAS_PLAYER, NO_DIRECTION: -1,
                rng: { randRange },
            }),
        nbDirs, NO_DIRECTION: -1,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, chTF),
        allocGrid,
        calculateDistances: () => {},                   // stub — needs full CalculateDistancesContext
        MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
    };

    // ── Summon minions context ────────────────────────────────────────────────
    const summonMinionsCtx: SummonMinionsContext = {
        hordeCatalog, monsters, player,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        spawnMinions: (hordeID, leader) =>
            spawnMinionsFn(hordeID, leader, true, false, buildMonsterSpawningContext()),
        clearCellFlag: (loc, flag) => { if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags &= ~flag; },
        setCellFlag: (loc, flag) => { if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag; },
        removeCreature: (monst) => {
            const idx = monsters.indexOf(monst);
            if (idx !== -1) { monsters.splice(idx, 1); return true; }
            return false;
        },
        prependCreature: (monst) => monsters.unshift(monst),
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            return `${pfx}${m.info.monsterName}`;
        },
        getSummonMessage: (id) => monsterText[id]?.summonMessage ?? "",
        message: io.message,
        fadeInMonster: () => {},
        refreshDungeonCell,
        demoteMonsterFromLeadership: () => {},
        createFlare: () => {},
        monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
        MA_ENTER_SUMMONS: MonsterAbilityFlag.MA_ENTER_SUMMONS,
        MB_JUST_SUMMONED: MonsterBookkeepingFlag.MB_JUST_SUMMONED,
        MB_LEADER: MonsterBookkeepingFlag.MB_LEADER,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        SUMMONING_FLASH_LIGHT: LightType.SUMMONING_FLASH_LIGHT,
    };

    const summonsCtx: MonsterSummonsContext = {
        player, monsters,
        rng: { randRange },
        adjacentLevelAllyCount: 0,
        deepestLevel: rogue.deepestLevel,
        depthLevel: rogue.depthLevel,
        summonMinions: (monst) => { summonMinionsFn(monst, summonMinionsCtx); },
    };

    // ── Blink context ─────────────────────────────────────────────────────────
    const blinkCtx: MonsterBlinkContext = {
        boltCatalog,
        monsterHasBoltEffect: (monst, effectType) => monsterHasBoltEffectFn(monst, effectType, boltCatalog),
        monsterAvoids: (monst, p) => monsterAvoidsImpl(monst, p),
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, queryCtx),
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            return `${pfx}${m.info.monsterName}`;
        },
        combatMessage: io.combatMessage,
        cellHasTerrainFlag: chTF,
        zap: () => {},
        BE_BLINKING: BoltEffect.Blinking,
        BOLT_BLINKING: BoltType.BLINKING,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
    };

    const blinkToSafetyCtx: MonsterBlinkToSafetyContext = {
        ...blinkCtx,
        allySafetyMap: allocGrid(),
        rogue: {
            updatedAllySafetyMapThisTurn: rogue.updatedAllySafetyMapThisTurn,
            updatedSafetyMapThisTurn: rogue.updatedSafetyMapThisTurn,
        },
        player,
        safetyMap: localSafetyMap,
        inFieldOfView: inFOV,
        allocGrid,
        copyGrid,
        updateSafetyMap: () => {},
        updateAllySafetyMap: () => {},
    };

    // ── Bolt AI context ────────────────────────────────────────────────────────
    const boltAICtx: BoltAIContext = {
        player, monsters, rogue, boltCatalog, tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        rng: { randPercent },
        openPathBetween: (loc1, loc2) =>
            openPathBetweenFn(loc1, loc2, (pos) => chTF(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
        cellHasTerrainFlag: chTF,
        inFieldOfView: inFOV,
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, queryCtx),
        monsterIsHidden: (target, viewer) => monsterIsHiddenFn(target, viewer, queryCtx),
        monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, chTF),
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        burnedTerrainFlagsAtLoc: (loc) => burnedTerrainFlagsAtLocFn(pmap, loc),
        avoidedFlagsForMonster,
        distanceBetween,
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            return `${pfx}${m.info.monsterName}`;
        },
        resolvePronounEscapes,
        combatMessage: io.combatMessage,
        zap: () => {},
        gameOver: (msg) => gameOver(msg),
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
    };

    // ── moveAlly context ──────────────────────────────────────────────────────
    const moveAllyCtx: MoveAllyContext = {
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
        updateSafeTerrainMap: () => {},
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
        nextStep: () => -1,
        randValidDirectionFrom: (monst, x, y, allowDiag) =>
            randValidDirectionFromFn(monst, x, y, allowDiag, {
                coordinatesAreInMap, cellHasTerrainFlag: chTF, cellFlags,
                diagonalBlocked: diagBlocked, monsterAvoids: (m, p) => monsterAvoidsImpl(m, p),
                nbDirs, HAS_PLAYER: TileFlag.HAS_PLAYER, NO_DIRECTION: -1,
                rng: { randRange },
            }),
        pathTowardCreature: (monst, target) => pathTowardCreatureFn(monst, target, pathCtx),
        nbDirs, NO_DIRECTION: -1, DCOLS, DROWS,
        allyFlees: (ally, closestEnemy) => allyFleesFn(ally, closestEnemy, {
            player,
            monsterFleesFrom: (m, d) => monsterFleesFrom(m, d, player, chTF),
        }),
        justRested: rogue.justRested,
        justSearched: rogue.justSearched,
        MB_SEIZED: MonsterBookkeepingFlag.MB_SEIZED,
        MB_FOLLOWER: MonsterBookkeepingFlag.MB_FOLLOWER,
        MB_SUBMERGED: MonsterBookkeepingFlag.MB_SUBMERGED,
        STATUS_INVISIBLE: StatusEffect.Invisible,
        STATUS_IMMUNE_TO_FIRE: StatusEffect.ImmuneToFire,
        allySafetyMap: allocGrid(),
        distanceBetween,
    };

    // ── randValidDirectionFrom shared closure ─────────────────────────────────
    const randValidDirShared = (monst: Creature, x: number, y: number, allowDiag: boolean) =>
        randValidDirectionFromFn(monst, x, y, allowDiag, {
            coordinatesAreInMap, cellHasTerrainFlag: chTF, cellFlags,
            diagonalBlocked: diagBlocked, monsterAvoids: (m, p) => monsterAvoidsImpl(m, p),
            nbDirs, HAS_PLAYER: TileFlag.HAS_PLAYER, NO_DIRECTION: -1,
            rng: { randRange },
        });

    const millAboutCtx: MonsterMillAboutContext = {
        rng: { randPercent: (pct) => randPercent(pct) },
        randValidDirectionFrom: randValidDirShared,
        moveMonsterPassivelyTowards: (monst, t, w) => mmptImpl(monst, t, w),
        nbDirs, NO_DIRECTION: -1,
    };

    // ── Return the fully-wired MonstersTurnContext ─────────────────────────────
    return {
        player, monsters,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },

        cellHasTerrainFlag: chTF,
        cellHasTMFlag: chTMF,
        cellFlags,
        inFieldOfView: inFOV,

        updateMonsterState: (monst) => updateMonsterStateFn(monst, monsterStateCtx),
        moveMonster: (monst, dx, dy) => moveMonsterImpl(monst, dx, dy),
        moveMonsterPassivelyTowards: (monst, t, w) => mmptImpl(monst, t, w),
        monsterAvoids: (monst, p) => monsterAvoidsImpl(monst, p),
        monstUseMagic: (monst) => monstUseMagicFn(monst, boltAICtx),
        monsterHasBoltEffect: (monst, effectType) => monsterHasBoltEffectFn(monst, effectType, boltCatalog),
        monsterBlinkToPreferenceMap: (monst, map, uphill) =>
            monsterBlinkToPreferenceMapFn(monst, map, uphill, blinkCtx),
        monsterBlinkToSafety: (monst) => monsterBlinkToSafetyFn(monst, blinkToSafetyCtx),
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
        monsterCanShootWebs: (monst) => monsterCanShootWebsFn(monst, boltCatalog, tileCatalog, dungeonFeatureCatalog),
        updateMonsterCorpseAbsorption: () => false,
        spawnDungeonFeature(x, y, dfType, isVolatile, ignoreBlocking) {
            const feat = dungeonFeatureCatalog[dfType];
            if (feat) spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, isVolatile, ignoreBlocking);
        },
        applyInstantTileEffectsToCreature: () => {},
        makeMonsterDropItem: () => {},

        scentDirection: (monst) => scentDirectionFn(monst, scentDirCtx),
        isLocalScentMaximum: (loc) => isLocalScentMaximumFn(loc, localScentCtx),
        pathTowardCreature: (monst, target) => pathTowardCreatureFn(monst, target, pathCtx),
        nextStep: () => -1,                             // stub — Phase 2b/3
        getSafetyMap: (monst) => getSafetyMapFn(monst, {
            player, safetyMap: localSafetyMap,
            rogue: { updatedSafetyMapThisTurn: rogue.updatedSafetyMapThisTurn },
            inFieldOfView: inFOV, allocGrid, copyGrid,
            updateSafetyMap: () => {},
        }),
        traversiblePathBetween: (monst, x, y) => traversibleImpl(monst, x, y),
        monsterWillAttackTarget: (monst, target) =>
            monsterWillAttackTargetFn(monst, target, player, chTF),

        chooseNewWanderDestination: (monst) => chooseNewWanderDestFn(monst, monsterStateCtx),
        isValidWanderDestination: (monst, wpIndex) => isValidWanderDestinationFn(monst, wpIndex, wanderCtx),
        waypointDistanceMap: (i) => rogue.wpDistance[i] ?? [],
        wanderToward: (monst, loc) => wanderTowardFn(monst, loc, wanderTowardCtx),
        randValidDirectionFrom: randValidDirShared,
        monsterMillAbout: (monst, chance) => monsterMillAboutFn(monst, chance, millAboutCtx),
        moveAlly: (monst) => moveAllyFn(monst, moveAllyCtx),

        nbDirs, NO_DIRECTION: -1, DCOLS, DROWS,
        diagonalBlocked: diagBlocked,
        mapToSafeTerrain: rogue.mapToSafeTerrain,
        updateSafeTerrainMap: () => {},
        scentMap,

        IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
        MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        BE_BLINKING: BoltEffect.Blinking,
    };
}
