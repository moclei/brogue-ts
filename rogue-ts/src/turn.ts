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
import { deleteItem as deleteItemFn } from "./items/item-inventory.js";
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
import {
    goodMessageColor, badMessageColor, advancementMessageColor, itemMessageColor,
    orange, green, red, yellow, darkRed, darkGreen, poisonColor,
} from "./globals/colors.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { TileFlag, MonsterBookkeepingFlag, TerrainFlag, T_OBSTRUCTS_SCENT } from "./types/flags.js";
import { CreatureState, GameMode } from "./types/enums.js";
import type { TurnProcessingContext } from "./time/turn-processing.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { Creature, Pcell, Pos, PlayerCharacter } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn } from "./io-wiring.js";
import { unAlly as unAllyFn, checkForContinuedLeadership as checkForContinuedLeadershipFn, demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { buildResolvePronounEscapesFn, getMonsterDFMessage as getMonsterDFMessageFn } from "./io/text.js";
import { buildMonstersTurnContext } from "./turn-monster-ai.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import { scentDistance } from "./time/turn-processing.js";

// =============================================================================
// Minimal combat context — used by inflictDamage/killCreature/addPoison calls
// in the turn-processing pipeline. Full context in Phase 3: combat.ts.
// =============================================================================

function buildMinimalCombatContext(
    player: Creature,
    rogue: PlayerCharacter,
    pmap: Pcell[][],
    monsters: Creature[],
): CombatDamageContext {
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();
    const resolvePronounEscapes = buildResolvePronounEscapesFn(player, pmap, rogue);

    return {
        player,
        easyMode: rogue.mode === GameMode.Easy,
        transference: rogue.transference,
        playerTransferenceRatio: 20,
        canSeeMonster,
        canDirectlySeeMonster: canSeeMonster,
        wakeUp: buildWakeUpFn(player, monsters),
        spawnDungeonFeature: () => {},              // stub
        refreshSideBar,
        combatMessage: io.combatMessage,
        messageWithColor: (text, color) => io.messageWithColor(text, color, 0),
        monsterName: (m, includeArticle) => {
            if (m === player) return "you";
            const pfx = includeArticle
                ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                : "";
            return `${pfx}${m.info.monsterName}`;
        },
        gameOver: (msg) => gameOver(msg),
        setCreaturesWillFlash: () => { rogue.creaturesWillFlashThisTurn = true; },
        deleteItem: deleteItemFn,
        makeMonsterDropItem: () => {},              // stub
        clearLastTarget: () => {},                  // stub
        clearYendorWarden: () => {},                // stub
        clearCellMonsterFlag: () => {},             // stub
        prependCreature: () => {},                  // stub
        applyInstantTileEffectsToCreature: () => {},// stub
        fadeInMonster: () => {},                    // stub
        refreshDungeonCell,
        anyoneWantABite: () => false,               // stub — depends on canAbsorb (Phase 6)
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes,
        message: io.message,
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
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();

    const combatCtx = buildMinimalCombatContext(player, rogue, pmap, monsters);

    function pmapAt(loc: Pos): Pcell { return pmap[loc.x][loc.y]; }

    function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    }

    // Scent map — shared with monster AI via rogue.scentMap.
    if (!rogue.scentMap) rogue.scentMap = allocGrid();
    const scentMap = rogue.scentMap;

    // Safety grids — transient per-level state (wired in port-v2-platform).
    const safetyMap = allocGrid();
    const allySafetyMap = allocGrid();

    // FOV context for updateScent
    const fovCtxForScent = {
        cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
    };

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
        combatMessage: io.combatMessage,
        displayCombatText: () => {},                        // stub
        messageColorFromVictim: () => badMessageColor,
        addPoison: (monst, total, conc) => addPoisonFn(monst, total, conc, combatCtx),
        flashMonster: (monst, color, strength) => flashMonsterFn(monst, color, strength, combatCtx),

        // ── UI (stubs — wired in port-v2-platform) ────────────────────────────
        message: io.message,
        messageWithColor: io.messageWithColor,
        flavorMessage: () => {},
        refreshDungeonCell,
        displayLevel: () => {},
        displayAnnotation: () => {},
        refreshSideBar,
        gameOver: (msg) => gameOver(msg),
        confirm: () => true,
        flashMessage: () => {},
        recordKeystroke: () => {},
        confirmMessages: io.confirmMessages,
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

        // ── Scent / FOV ───────────────────────────────────────────────────────
        addScentToCell: (x, y, distance) => {
            // Inline addScentToCell logic (from movement/map-queries.ts)
            if (!cellHasTerrainFlagFn(pmap, {x, y}, T_OBSTRUCTS_SCENT) ||
                !cellHasTerrainFlagFn(pmap, {x, y}, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                const value = (rogue.scentTurnNumber - distance) & 0xFFFF;
                scentMap[x][y] = Math.max(value, scentMap[x][y] & 0xFFFF);
            }
        },
        getFOVMask: (grid, cx, cy, radius, blockFlags, blockTMFlags, ignoreWalls) =>
            getFOVMaskFn(grid, cx, cy, radius, blockFlags, blockTMFlags, ignoreWalls, fovCtxForScent),
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
        updateScent() {
            if (!rogue.scentMap) rogue.scentMap = allocGrid();
            const sm = rogue.scentMap;
            const grid = allocGrid();
            zeroOutGrid(grid);
            getFOVMaskFn(grid, player.loc.x, player.loc.y,
                BigInt(DCOLS) * FP_FACTOR, T_OBSTRUCTS_SCENT, 0, false, fovCtxForScent);
            const px = player.loc.x, py = player.loc.y;
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (grid[i][j]) {
                        const dist = scentDistance(px, py, i, j);
                        const value = (rogue.scentTurnNumber - dist) & 0xFFFF;
                        if (!cellHasTerrainFlagFn(pmap, {x:i,y:j}, T_OBSTRUCTS_SCENT) ||
                            !cellHasTerrainFlagFn(pmap, {x:i,y:j}, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                            sm[i][j] = Math.max(value, sm[i][j] & 0xFFFF);
                        }
                    }
                }
            }
            const val0 = rogue.scentTurnNumber & 0xFFFF;
            sm[px][py] = Math.max(val0, sm[px][py] & 0xFFFF);
        },
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

// buildMonstersTurnContext is in turn-monster-ai.ts (re-exported below)
export { buildMonstersTurnContext } from "./turn-monster-ai.js";

// Re-export for use by other domain files
export { buildTurnProcessingContext as buildTurnCtx };

// Convenience: import and call playerTurnEnded with the built context
import { playerTurnEnded as playerTurnEndedFn } from "./time/turn-processing.js";
import { monstersTurn as monstersTurnFn } from "./monsters/monster-actions.js";

/** Run one full player turn. Called by the main game loop. */
export function playerTurnEnded(): void {
    playerTurnEndedFn(buildTurnProcessingContext());
}
