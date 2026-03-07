/*
 *  turn.ts — Turn processing context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildTurnProcessingContext() and buildMonstersTurnContext(),
 *  the two context factories that wire playerTurnEnded() and monstersTurn().
 *
 *  UI/rendering callbacks are stubbed here; they will be wired in port-v2-platform.
 *  Combat callbacks delegate to the minimal combat context (Phase 3: combat.ts
 *  will promote these to full implementations).
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver } from "./core.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    flashMonster as flashMonsterFn,
} from "./combat/combat-damage.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
} from "./state/helpers.js";
import { allocGrid } from "./grid/grid.js";
import { zeroOutGrid } from "./architect/helpers.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { randRange, randPercent } from "./math/rng.js";
import { nbDirs, coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { monsterCatalog } from "./globals/monster-catalog.js";
import {
    goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
    orange, green, red, yellow, darkRed, darkGreen, poisonColor,
} from "./globals/colors.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { TileFlag, MonsterBookkeepingFlag, MonsterBehaviorFlag, TerrainFlag } from "./types/flags.js";
import { BoltEffect, CreatureState, DungeonLayer, GameMode } from "./types/enums.js";
import { openPathBetween as openPathBetweenFn } from "./items/bolt-geometry.js";
import {
    monsterIsHidden as monsterIsHiddenFn,
    monstersAreTeammates as monstersAreTeammatesFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
} from "./monsters/monster-queries.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import { distanceBetween } from "./monsters/monster-state.js";
import { avoidedFlagsForMonster } from "./monsters/monster-spawning.js";
import {
    monstUseMagic as monstUseMagicFn,
    monsterHasBoltEffect as monsterHasBoltEffectFn,
    monsterCanShootWebs as monsterCanShootWebsFn,
} from "./monsters/monster-bolt-ai.js";
import type { BoltAIContext } from "./monsters/monster-bolt-ai.js";
import { monsterSummons as monsterSummonsFn } from "./monsters/monster-actions.js";
import type { MonsterSummonsContext } from "./monsters/monster-actions.js";
import type { TurnProcessingContext } from "./time/turn-processing.js";
import type { MonstersTurnContext } from "./monsters/monster-actions.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { Creature, Pcell, Pos, PlayerCharacter } from "./types/types.js";

// =============================================================================
// Minimal combat context — used by inflictDamage/killCreature/addPoison calls
// in the turn-processing pipeline. Full context in Phase 3: combat.ts.
// =============================================================================

function buildMinimalCombatContext(
    player: Creature,
    rogue: PlayerCharacter,
    pmap: Pcell[][],
): CombatDamageContext {
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);

    return {
        player,
        easyMode: rogue.mode === GameMode.Easy,
        transference: rogue.transference,
        playerTransferenceRatio: 20,
        canSeeMonster,
        canDirectlySeeMonster: canSeeMonster,
        wakeUp: () => {},                           // stub — wired in combat.ts
        spawnDungeonFeature: () => {},              // stub
        refreshSideBar: () => {},                   // stub
        combatMessage: () => {},                    // stub
        messageWithColor: () => {},                 // stub
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            return `${pfx}${m.info.monsterName}`;
        },
        gameOver: (msg) => gameOver(msg),
        setCreaturesWillFlash: () => { rogue.creaturesWillFlashThisTurn = true; },
        deleteItem: () => {},                       // stub
        makeMonsterDropItem: () => {},              // stub
        clearLastTarget: () => {},                  // stub
        clearYendorWarden: () => {},                // stub
        clearCellMonsterFlag: () => {},             // stub
        prependCreature: () => {},                  // stub
        applyInstantTileEffectsToCreature: () => {},// stub
        fadeInMonster: () => {},                    // stub
        refreshDungeonCell: () => {},               // stub
        anyoneWantABite: () => false,               // stub
        demoteMonsterFromLeadership: () => {},      // stub
        checkForContinuedLeadership: () => {},      // stub
        getMonsterDFMessage: () => "",              // stub
        resolvePronounEscapes: (text) => text,      // stub
        message: () => {},                          // stub
        monsterCatalog: [],                         // stub — real catalog via core.ts
        updateEncumbrance: () => {},                // stub
        updateMinersLightRadius: () => {},          // stub
        updateVision: () => {},                     // stub
        badMessageColor,
        poisonColor,
    };
}

// =============================================================================
// buildTurnProcessingContext
// =============================================================================

/**
 * Build the TurnProcessingContext for playerTurnEnded().
 *
 * Called each time the player ends a turn. Pulls live state from core.ts
 * and provides real implementations for scheduler-critical operations;
 * stubs for UI/rendering (wired in port-v2-platform).
 */
export function buildTurnProcessingContext(): TurnProcessingContext {
    const {
        player, rogue, pmap, monsters, dormantMonsters,
        packItems, floorItems, levels, gameConst,
    } = getGameState();

    const combatCtx = buildMinimalCombatContext(player, rogue, pmap);

    function pmapAt(loc: Pos): Pcell { return pmap[loc.x][loc.y]; }

    function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    }

    // Scent/safety grids — transient per-level state.
    // Stubs: Phase 3 (movement.ts) will wire the persisted level maps.
    const scentMap = allocGrid();
    const safetyMap = allocGrid();
    const allySafetyMap = allocGrid();

    return {
        player,
        rogue: rogue as unknown as TurnProcessingContext["rogue"],
        monsters,
        dormantMonsters,
        pmap,
        levels,
        gameConst,
        scentMap,
        safetyMap,
        allySafetyMap,
        packItems,
        floorItems,
        tileCatalog,
        dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as TurnProcessingContext["dungeonFeatureCatalog"],

        DCOLS, DROWS, FP_FACTOR,

        // ── Map helpers ───────────────────────────────────────────────────────
        cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
        cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
        terrainFlags: (pos) => terrainFlagsFn(pmap, pos),
        discoveredTerrainFlagsAtLoc: () => 0,               // stub
        coordinatesAreInMap,
        pmapAt,

        // ── Monster helpers ───────────────────────────────────────────────────
        canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        canDirectlySeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterRevealed: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName(buf, m, includeArticle) {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        },
        monsterAtLoc,
        monstersAreEnemies: (m1, m2) => m1.creatureState !== CreatureState.Ally && m2 === player,
        monsterAvoids: () => false,                         // stub
        monsterIsInClass: () => false,                      // stub
        isVowelish: (w) => "aeiouAEIOU".includes(w[0] ?? ""),
        monstersTurn: (monst) => monstersTurnFn(monst, buildMonstersTurnContext()),
        decrementMonsterStatus(monst) {
            for (let i = 0; i < monst.status.length; i++) {
                if (monst.status[i] > 0) monst.status[i]--;
            }
            return false;
        },
        removeCreature(list, monst) {
            const idx = list.indexOf(monst);
            if (idx >= 0) { list.splice(idx, 1); return true; }
            return false;
        },
        prependCreature(list, monst) { list.unshift(monst); },

        // ── Item helpers ──────────────────────────────────────────────────────
        itemName(_, buf) { buf[0] = "item"; },              // stub
        numberOfMatchingPackItems: () => 0,                 // stub

        // ── Combat helpers ────────────────────────────────────────────────────
        inflictDamage: (attacker, defender, damage, flashColor, showDamage) =>
            inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
        killCreature: (monst, adminDeath) => killCreatureFn(monst, adminDeath, combatCtx),
        combatMessage: () => {},                            // stub
        displayCombatText: () => {},                        // stub
        messageColorFromVictim: () => badMessageColor,
        addPoison: (monst, total, conc) => addPoisonFn(monst, total, conc, combatCtx),
        flashMonster: (monst, color, strength) => flashMonsterFn(monst, color, strength, combatCtx),

        // ── UI (stubs — wired in port-v2-platform) ────────────────────────────
        message: () => {},
        messageWithColor: () => {},
        flavorMessage: () => {},
        refreshDungeonCell: () => {},
        displayLevel: () => {},
        displayAnnotation: () => {},
        refreshSideBar: () => {},
        gameOver: (msg) => gameOver(msg),
        confirm: () => true,
        flashMessage: () => {},
        recordKeystroke: () => {},
        confirmMessages: () => {},
        pauseAnimation: () => false,

        // ── Colors ───────────────────────────────────────────────────────────
        goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
        orange, green, red, yellow, darkRed, darkGreen,

        // ── Environment / vision (stubs) ──────────────────────────────────────
        updateEnvironment: () => {},
        updateVision: () => {},
        updateMapToShore: () => {},
        updateSafetyMap: () => {},
        refreshWaypoint: () => {},
        analyzeMap: () => {},
        removeDeadMonsters() {
            for (let i = monsters.length - 1; i >= 0; i--) {
                const m = monsters[i];
                if (
                    (m.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) ||
                    (m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED) ||
                    m.currentHP <= 0
                ) {
                    if (coordinatesAreInMap(m.loc.x, m.loc.y)) {
                        pmap[m.loc.x][m.loc.y].flags &= ~TileFlag.HAS_MONSTER;
                    }
                    monsters.splice(i, 1);
                }
            }
        },
        shuffleTerrainColors: () => {},
        resetDFMessageEligibility() {
            for (const df of dungeonFeatureCatalog) {
                df.messageDisplayed = false;
            }
        },
        RNGCheck: () => {},
        animateFlares: () => {},

        // ── Scent / FOV (stubs) ───────────────────────────────────────────────
        addScentToCell: () => {},
        getFOVMask: () => {},
        zeroOutGrid,
        discoverCell: (x, y) => { if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED; },
        discover: (x, y) => { if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED; },
        storeMemories: () => {},

        // ── Items / recharging (stubs) ────────────────────────────────────────
        rechargeItemsIncrementally: () => {},
        processIncrementalAutoID: () => {},

        // ── Tile effects (stubs — wired in port-v2-platform) ─────────────────
        applyInstantTileEffectsToCreature: () => {},
        applyGradualTileEffectsToCreature: () => {},
        monsterShouldFall: () => false,
        monstersFall: () => {},
        decrementPlayerStatus: () => {},
        playerFalls: () => {},
        handleHealthAlerts: () => {},
        updateScent: () => {},
        currentStealthRange: () => 0,

        // ── Movement / search (stubs) ─────────────────────────────────────────
        search: () => false,
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),

        // ── Spawn (stub) ──────────────────────────────────────────────────────
        spawnDungeonFeature: () => {},

        // ── Constants ─────────────────────────────────────────────────────────
        nbDirs,
        rand_range: randRange,
        rand_percent: randPercent,
        max: Math.max,
        min: Math.min,
    };
}

// =============================================================================
// buildMonstersTurnContext
// =============================================================================

/**
 * Build a MonstersTurnContext for monstersTurn().
 *
 * Most fields are stubs — full monster AI wiring is Phase 4 (monsters.ts).
 * The integration test for turn.ts is designed so monsters don't actually
 * take turns (high ticksUntilTurn), so these stubs don't run.
 */
export function buildMonstersTurnContext(): MonstersTurnContext {
    const { player, rogue, pmap, monsters } = getGameState();

    // ── Monster query context (for canSeeMonster, monsterIsHidden, etc.) ────
    const queryCtx: MonsterQueryContext = {
        player,
        cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
        cellHasGas: (loc) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // ── Monster summons context — wires monsterSummons ───────────────────────
    const summonsCtx: MonsterSummonsContext = {
        player,
        monsters,
        rng: { randRange },
        adjacentLevelAllyCount: 0,   // adjacent levels not tracked in TS port
        deepestLevel: rogue.deepestLevel,
        depthLevel: rogue.depthLevel,
        summonMinions: () => {},     // stub — summonMinions not yet ported (see test.skip)
    };

    // ── Bolt AI context — wires monstUseMagic / monstUseBolt ────────────────
    const boltAICtx: BoltAIContext = {
        player,
        monsters,
        rogue,
        boltCatalog,
        tileCatalog,
        dungeonFeatureCatalog,
        monsterCatalog,
        rng: { randPercent },
        openPathBetween: (loc1, loc2) =>
            openPathBetweenFn(
                loc1, loc2,
                (loc) => cellHasTerrainFlagFn(pmap, loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY),
            ),
        cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
        inFieldOfView: (loc) => !!(pmap[loc.x]?.[loc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW),
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, queryCtx),
        monsterIsHidden: (target, viewer) => monsterIsHiddenFn(target, viewer, queryCtx),
        monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
        monstersAreEnemies: (a, b) =>
            monstersAreEnemiesFn(a, b, player, (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags)),
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        burnedTerrainFlagsAtLoc: () => 0,   // stub — burnedTerrainFlagsAtLoc not yet ported
        avoidedFlagsForMonster,
        distanceBetween,
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            return `${pfx}${m.info.monsterName}`;
        },
        resolvePronounEscapes: (text) => text,  // stub — wired in combat.ts
        combatMessage: () => {},                // stub — wired in port-v2-platform
        zap: () => {},                          // stub — wired in port-v2-platform
        gameOver: (msg) => gameOver(msg),
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
    };

    return {
        player,
        monsters,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },

        // ── Map access ────────────────────────────────────────────────────────
        cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
        cellHasTMFlag: (loc, flags) => cellHasTMFlagFn(pmap, loc, flags),
        cellFlags: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
        inFieldOfView: (loc) => !!(pmap[loc.x]?.[loc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW),

        // ── Monster state (stubs — wired in monsters.ts) ──────────────────────
        updateMonsterState: () => {},
        moveMonster: () => false,
        moveMonsterPassivelyTowards: () => false,
        monsterAvoids: () => false,
        monstUseMagic: (monst) => monstUseMagicFn(monst, boltAICtx),
        monsterHasBoltEffect: (monst, effectType) => monsterHasBoltEffectFn(monst, effectType, boltCatalog),
        monsterBlinkToPreferenceMap: () => false,
        monsterBlinkToSafety: () => false,
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
        monsterCanShootWebs: (monst) => monsterCanShootWebsFn(monst, boltCatalog, tileCatalog, dungeonFeatureCatalog),
        updateMonsterCorpseAbsorption: () => false,
        spawnDungeonFeature: () => {},
        applyInstantTileEffectsToCreature: () => {},
        makeMonsterDropItem: () => {},

        // ── Pathfinding (stubs) ───────────────────────────────────────────────
        scentDirection: () => -1,
        isLocalScentMaximum: () => false,
        pathTowardCreature: () => {},
        nextStep: () => -1,
        getSafetyMap: () => allocGrid(),
        traversiblePathBetween: () => false,
        monsterWillAttackTarget: () => false,

        // ── Wandering (stubs) ─────────────────────────────────────────────────
        chooseNewWanderDestination: () => {},
        isValidWanderDestination: () => false,
        waypointDistanceMap: () => allocGrid(),
        wanderToward: () => {},
        randValidDirectionFrom: () => -1,
        monsterMillAbout: () => {},
        moveAlly: () => {},

        // ── Direction data ────────────────────────────────────────────────────
        nbDirs,
        NO_DIRECTION: -1,

        // ── Map dimensions ────────────────────────────────────────────────────
        DCOLS, DROWS,

        // ── Misc (stubs) ──────────────────────────────────────────────────────
        diagonalBlocked: () => false,
        mapToSafeTerrain: rogue.mapToSafeTerrain,
        updateSafeTerrainMap: () => {},
        scentMap: allocGrid(),

        // ── Flags ─────────────────────────────────────────────────────────────
        IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
        MB_GIVEN_UP_ON_SCENT: MonsterBookkeepingFlag.MB_GIVEN_UP_ON_SCENT,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
        BE_BLINKING: BoltEffect.Blinking,
    };
}

// Re-export for use by other domain files
export { buildTurnProcessingContext as buildTurnCtx };

// Convenience: import and call playerTurnEnded with the built context
import { playerTurnEnded as playerTurnEndedFn } from "./time/turn-processing.js";
import { monstersTurn as monstersTurnFn } from "./monsters/monster-actions.js";

/** Run one full player turn. Called by the main game loop. */
export function playerTurnEnded(): void {
    playerTurnEndedFn(buildTurnProcessingContext());
}
