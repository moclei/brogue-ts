/*
 *  turn-monster-zap-wiring.ts — ZapContext + bolt/blink context builders for monster turns
 *  Port V2 — rogue-ts
 *
 *  Exports:
 *    buildMonsterZapFn()             — returns a wired async zap() for monster contexts
 *    buildMonsterBoltBlinkContexts() — builds boltAICtx, blinkCtx, blinkToSafetyCtx,
 *                                      summonsCtx, and updateMonsterCorpseAbsorption
 *
 *  The ZapContext is built in turn-monster-zap-ctx.ts (extracted to keep this
 *  file under the 600-line cap).
 *  Extracted from turn-monster-ai.ts to keep that file under the 600-line cap.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { gameOver as gameOverFn } from "./core.js";
import { zap as zapFn } from "./items/zap.js";
import { buildFadeInMonsterFn } from "./combat.js";
import {
    avoidedFlagsForMonster,
    spawnMinions as spawnMinionsFn,
} from "./monsters/monster-spawning.js";
import {
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
    monsterIsHidden as monsterIsHiddenFn,
    monstersAreTeammates as monstersAreTeammatesFn,
    monstersAreEnemies as monstersAreEnemiesFn,
} from "./monsters/monster-queries.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import {
    cellHasTMFlag as cellHasTMFlagFn,
    burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { updateSafetyMap as updateSafetyMapFn, updateAllySafetyMap as updateAllySafetyMapFn } from "./time/safety-maps.js";
import type { SafetyMapsContext } from "./time/safety-maps.js";
import { dijkstraScan as dijkstraScanFn } from "./dijkstra/dijkstra.js";
import { DCOLS, DROWS } from "./types/constants.js";
import {
    buildMessageFns,
    buildRefreshDungeonCellFn,
} from "./io-wiring.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { monsterCatalog } from "./globals/monster-catalog.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { monsterText } from "./globals/monster-text.js";
import { monsterBehaviorCatalog, monsterAbilityCatalog } from "./globals/status-effects.js";
import { goodMessageColor, advancementMessageColor } from "./globals/colors.js";
import { distanceBetween } from "./monsters/monster-state.js";
import {
    TileFlag, TerrainFlag, MonsterBookkeepingFlag,
    MonsterAbilityFlag,
} from "./types/flags.js";
import {
    BoltEffect, BoltType, CreatureState, LightType, StatusEffect,
} from "./types/enums.js";
import { MonsterBehaviorFlag } from "./types/flags.js";
import { monsterHasBoltEffect as monsterHasBoltEffectFn } from "./monsters/monster-bolt-ai.js";
import type { BoltAIContext } from "./monsters/monster-bolt-ai.js";
import type { MonsterBlinkContext, MonsterBlinkToSafetyContext } from "./monsters/monster-blink-ai.js";
import { monsterSummons as monsterSummonsFn } from "./monsters/monster-actions.js";
import type { MonsterSummonsContext } from "./monsters/monster-actions.js";
import { summonMinions as summonMinionsFn } from "./monsters/monster-summoning.js";
import type { SummonMinionsContext } from "./monsters/monster-summoning.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import {
    updateMonsterCorpseAbsorption as updateMonsterCorpseAbsorptionFn,
} from "./monsters/monster-corpse-absorption.js";
import type { CorpseAbsorptionContext } from "./monsters/monster-corpse-absorption.js";
import { openPathBetween as openPathBetweenFn } from "./items/bolt-geometry.js";
import { unflag } from "./game/game-cleanup.js";
import { allocGrid } from "./grid/grid.js";
import { randPercent, randRange } from "./math/rng.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { buildMonsterZapCtx, buildMonsterAtLocFn } from "./turn-monster-zap-ctx.js";
import type { Bolt, Creature, Pcell, Pos } from "./types/types.js";
import type { PlayerCharacter } from "./types/types.js";

// =============================================================================
// buildMonsterZapFn — wired async zap() for monster bolt/blink contexts
// =============================================================================

/**
 * Returns a pre-bound async zap() for use in monster bolt/blink contexts.
 * Mirrors buildStaffZapFn() in items/staff-wiring.ts; called once per
 * buildMonsterBoltBlinkContexts() invocation.
 */
export function buildMonsterZapFn() {
    return async (
        originLoc: Pos,
        targetLoc: Pos,
        theBolt: Bolt,
        hideDetails: boolean,
        reverseBoltDir: boolean,
    ): Promise<boolean> => {
        const zapCtx = buildMonsterZapCtx();
        return zapFn(originLoc, targetLoc, theBolt, hideDetails, reverseBoltDir, zapCtx);
    };
}

// =============================================================================
// buildMonsterBoltBlinkContexts — bolt/blink/summon/corpse context builder
// =============================================================================

/**
 * Dependencies passed from buildMonstersTurnContext() to avoid re-extracting
 * game state. All catalog constants are imported directly at module level.
 */
export interface MonsterBoltBlinkDeps {
    player: Creature;
    monsters: Creature[];
    rogue: PlayerCharacter;
    pmap: Pcell[][];
    queryCtx: MonsterQueryContext;
    io: ReturnType<typeof buildMessageFns>;
    chTF: (loc: Pos, flags: number) => boolean;
    inFOV: (loc: Pos) => boolean;
    monsterAvoids: (monst: Creature, p: Pos) => boolean;
    localSafetyMap: number[][];
    resolvePronounEscapes: (text: string, monst: Creature) => string;
    copyGrid: (src: number[][], dst: number[][]) => void;
}

/**
 * Builds and returns the bolt/blink/summon/corpse contexts for monstersTurn.
 * Extracted from turn-monster-ai.ts to keep that file under the 600-line cap.
 */
export function buildMonsterBoltBlinkContexts(deps: MonsterBoltBlinkDeps): {
    boltAICtx: BoltAIContext;
    blinkCtx: MonsterBlinkContext;
    blinkToSafetyCtx: MonsterBlinkToSafetyContext;
    summonsCtx: MonsterSummonsContext;
    updateMonsterCorpseAbsorption: (monst: Creature) => boolean;
} {
    const {
        player, monsters, rogue, pmap,
        queryCtx, io, chTF, inFOV,
        monsterAvoids, localSafetyMap, resolvePronounEscapes, copyGrid,
    } = deps;

    const monsterNameFn = (m: Creature, includeArticle: boolean): string => {
        if (m === player) return "you";
        const pfx = includeArticle
            ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
            : "";
        return `${pfx}${m.info.monsterName}`;
    };

    // ── summonMinionsCtx ──────────────────────────────────────────────────────
    const summonMinionsCtx: SummonMinionsContext = {
        hordeCatalog, monsters, player,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        spawnMinions: (hordeID, leader) =>
            spawnMinionsFn(hordeID, leader, true, false, buildMonsterSpawningContext()),
        clearCellFlag: (loc, flag) => {
            if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags &= ~flag;
        },
        setCellFlag: (loc, flag) => {
            if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag;
        },
        removeCreature: (monst) => {
            const idx = monsters.indexOf(monst);
            if (idx !== -1) { monsters.splice(idx, 1); return true; }
            return false;
        },
        prependCreature: (monst) => monsters.unshift(monst),
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        monsterName: monsterNameFn,
        getSummonMessage: (id) => monsterText[id]?.summonMessage ?? "",
        message: io.message,
        fadeInMonster: buildFadeInMonsterFn(),
        refreshDungeonCell: buildRefreshDungeonCellFn(),
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

    // ── blinkCtx + blinkToSafetyCtx ───────────────────────────────────────────
    const blinkCtx: MonsterBlinkContext = {
        boltCatalog,
        monsterHasBoltEffect: (monst, effectType) =>
            monsterHasBoltEffectFn(monst, effectType, boltCatalog),
        monsterAvoids: (monst, p) => monsterAvoids(monst, p),
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, queryCtx),
        monsterName: monsterNameFn,
        combatMessage: io.combatMessage,
        cellHasTerrainFlag: chTF,
        zap: buildMonsterZapFn(),
        BE_BLINKING: BoltEffect.Blinking,
        BOLT_BLINKING: BoltType.BLINKING,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
    };

    const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
    const chTMF = (loc: Pos, flag: number) => cellHasTMFlagFn(pmap, loc, flag);

    const blinkToSafetyCtx: MonsterBlinkToSafetyContext = {
        ...blinkCtx,
        allySafetyMap: allocGrid(),
        rogue,  // real object so updatedSafetyMapThisTurn writes persist
        player,
        safetyMap: localSafetyMap,
        inFieldOfView: inFOV,
        allocGrid,
        copyGrid,
        updateSafetyMap: () => updateSafetyMapFn({
            rogue,
            player,
            pmap,
            safetyMap: localSafetyMap,
            allySafetyMap: localSafetyMap,  // unused by updateSafetyMap
            DCOLS, DROWS,
            FP_FACTOR: 1,                   // unused by updateSafetyMap
            cellHasTerrainFlag: chTF,
            cellHasTMFlag: chTMF,
            coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
            discoveredTerrainFlagsAtLoc: (pos: Pos) => discoveredTerrainFlagsAtLocFn(
                pmap, pos, tileCatalog,
                (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            monsterAtLoc,
            allocGrid,
            freeGrid: () => {},
            dijkstraScan: dijkstraScanFn,
        } as unknown as SafetyMapsContext),
        updateAllySafetyMap: () => updateAllySafetyMapFn({
            rogue,
            player,
            pmap,
            monsters,
            dormantMonsters: [],
            safetyMap: localSafetyMap,
            allySafetyMap: blinkToSafetyCtx.allySafetyMap,
            DCOLS, DROWS,
            FP_FACTOR: 1,
            floorItems: [],
            cellHasTerrainFlag: chTF,
            cellHasTMFlag: chTMF,
            coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
            discoveredTerrainFlagsAtLoc: (pos: Pos) => discoveredTerrainFlagsAtLocFn(
                pmap, pos, tileCatalog,
                (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            monsterAtLoc,
            monstersAreEnemies: (a: Creature, b: Creature) => monstersAreEnemiesFn(a, b, player, chTF),
            monsterRevealed: () => false,
            zeroOutGrid: () => {},            // permanent-defer — safety-map ctx does not rebuild vision grids
            getFOVMask: () => {},             // permanent-defer — safety-map ctx does not trace FOV
            updateLighting: () => {},         // permanent-defer — display ops not needed in safety-map pass
            updateFieldOfViewDisplay: () => {}, // permanent-defer — display ops not needed in safety-map pass
            discoverCell: () => {},           // permanent-defer — safety-map pass does not mark cells discovered
            refreshDungeonCell: () => {},     // permanent-defer — display ops not needed in safety-map pass
            allocGrid,
            freeGrid: () => {},
            dijkstraScan: dijkstraScanFn,
            max: Math.max, min: Math.min,
            pmapAt: (loc: Pos) => pmap[loc.x][loc.y],
        } as unknown as SafetyMapsContext),
    };

    // ── boltAICtx ─────────────────────────────────────────────────────────────
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
        monsterName: monsterNameFn,
        resolvePronounEscapes,
        combatMessage: io.combatMessage,
        zap: buildMonsterZapFn(),
        gameOver: (msg) => gameOverFn(msg),
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
    };

    // ── corpseAbsorptionCtx ───────────────────────────────────────────────────
    const corpseAbsorptionCtx: CorpseAbsorptionContext = {
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        monsterName: monsterNameFn,
        getAbsorbingText: (id) => monsterText[id]?.absorbing ?? "",
        boltAbilityDescription: (boltIndex) => boltCatalog[boltIndex]?.abilityDescription ?? "",
        behaviorDescription: (flagIndex) => monsterBehaviorCatalog[flagIndex]?.description ?? "",
        abilityDescription: (flagIndex) => monsterAbilityCatalog[flagIndex]?.description ?? "",
        resolvePronounEscapes,
        messageWithColor: io.messageWithColor,
        goodMessageColor,
        advancementMessageColor,
        MB_ABSORBING: MonsterBookkeepingFlag.MB_ABSORBING,
        MB_SUBMERGED: MonsterBookkeepingFlag.MB_SUBMERGED,
        MONST_FIERY: MonsterBehaviorFlag.MONST_FIERY,
        MONST_FLIES: MonsterBehaviorFlag.MONST_FLIES,
        MONST_IMMUNE_TO_FIRE: MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE,
        MONST_INVISIBLE: MonsterBehaviorFlag.MONST_INVISIBLE,
        MONST_RESTRICTED_TO_LIQUID: MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID,
        MONST_SUBMERGES: MonsterBehaviorFlag.MONST_SUBMERGES,
        STATUS_BURNING: StatusEffect.Burning,
        STATUS_LEVITATING: StatusEffect.Levitating,
        STATUS_IMMUNE_TO_FIRE: StatusEffect.ImmuneToFire,
        STATUS_INVISIBLE: StatusEffect.Invisible,
        BOLT_NONE: BoltType.NONE,
        unflag,
    };

    return {
        boltAICtx,
        blinkCtx,
        blinkToSafetyCtx,
        summonsCtx,
        updateMonsterCorpseAbsorption: (monst: Creature): boolean =>
            updateMonsterCorpseAbsorptionFn(monst, corpseAbsorptionCtx),
    };
}
