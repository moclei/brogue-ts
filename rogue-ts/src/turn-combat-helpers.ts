/*
 *  turn-combat-helpers.ts — Shared helpers extracted from turn.ts
 *  Port V2 — rogue-ts
 *
 *  Extracted from turn.ts to keep that file under 600 lines.
 *  Provides:
 *    - buildGetRandomMonsterSpawnLocationFn  (Monsters.c:1086)
 *    - buildMinimalCombatContext             (minimal CombatDamageContext for turn pipeline)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { gameOver, getGameState } from "./core.js";
import { deleteItem as deleteItemFn } from "./items/item-inventory.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
} from "./combat/combat-damage.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "./state/helpers.js";
import { anyoneWantABite as anyoneWantABiteFn } from "./combat/combat-helpers.js";
import type { CombatHelperContext } from "./combat/combat-helpers.js";
import { allocGrid, fillGrid, findReplaceGrid, randomLocationInGrid } from "./grid/grid.js";
import { randRange, randPercent } from "./math/rng.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { badMessageColor, poisonColor } from "./globals/colors.js";
import { DCOLS, DROWS } from "./types/constants.js";
import {
    TileFlag, T_PATHING_BLOCKER, T_HARMFUL_TERRAIN, IS_IN_MACHINE, T_DIVIDES_LEVEL, ItemFlag,
} from "./types/flags.js";
import { ArmorEnchant } from "./types/enums.js";
import { CreatureState, GameMode } from "./types/enums.js";
import type { Creature, Pcell, Pos, PlayerCharacter, Item } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn } from "./io-wiring.js";
import { buildFadeInMonsterFn } from "./combat.js";
import { checkForContinuedLeadership as checkForContinuedLeadershipFn, demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { buildResolvePronounEscapesFn, getMonsterDFMessage as getMonsterDFMessageFn } from "./io/text.js";
import { doMakeMonsterDropItem } from "./monsters/monster-drop.js";
import { updateEncumbrance as updateEncumbranceFn } from "./items/item-usage.js";
import { buildEquipState } from "./items/equip-helpers.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import { calculateDistances } from "./dijkstra/dijkstra.js";
import { monsterAvoids as monsterAvoidsFn } from "./monsters/monster-state.js";
import { buildUpdateVisionFn } from "./vision-wiring.js";
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";

// =============================================================================
// buildGetRandomMonsterSpawnLocationFn
// Ported from getRandomMonsterSpawnLocation() in Monsters.c:1086
// Returns a closure that finds a spawn position far from the player.
// =============================================================================

export function buildGetRandomMonsterSpawnLocationFn(
    player: Creature,
    pmap: Pcell[][],
): () => Pos | null {
    const ctf = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
    const ctmf = (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags);
    const calcDistCtx = {
        cellHasTerrainFlag: ctf,
        cellHasTMFlag: ctmf,
        monsterAtLoc: (loc: Pos): Creature | null => {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            return null; // conservative: only block player tile
        },
        monsterAvoids: () => false as const,  // permanent-defer — spawn location search only needs terrain; monsterAvoids is conservative
        discoveredTerrainFlagsAtLoc: () => 0, // permanent-defer — spawn location search doesn't need secret terrain
        isPlayer: (m: Creature) => m === player,
        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
    };

    return function getRandomMonsterSpawnLocation(): Pos | null {
        const grid = allocGrid();
        fillGrid(grid, 0);
        calculateDistances(grid, player.loc.x, player.loc.y, T_DIVIDES_LEVEL, null, true, true, calcDistCtx);
        // Zero out tiles that are blocked, occupied, or visible
        const blockMapFlags = TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS | TileFlag.IN_FIELD_OF_VIEW;
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (ctf({ x: i, y: j }, T_PATHING_BLOCKER | T_HARMFUL_TERRAIN) ||
                    (pmap[i]?.[j]?.flags & blockMapFlags)) {
                    grid[i][j] = 0;
                }
            }
        }
        // Only keep cells at distance >= DCOLS/2
        findReplaceGrid(grid, -30000, Math.floor(DCOLS / 2) - 1, 0);
        findReplaceGrid(grid, 30000, 30000, 0);
        findReplaceGrid(grid, Math.floor(DCOLS / 2), 30000 - 1, 1);
        let loc = randomLocationInGrid(grid, 1);
        if (loc.x < 0 || loc.y < 0) {
            // Fallback: any open, unoccupied tile not in a machine
            fillGrid(grid, 1);
            const blockMapFlagsFallback = TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS | TileFlag.IN_FIELD_OF_VIEW | IS_IN_MACHINE;
            for (let i = 0; i < DCOLS; i++) {
                for (let j = 0; j < DROWS; j++) {
                    if (ctf({ x: i, y: j }, T_PATHING_BLOCKER | T_HARMFUL_TERRAIN) ||
                        (pmap[i]?.[j]?.flags & blockMapFlagsFallback)) {
                        grid[i][j] = 0;
                    }
                }
            }
            loc = randomLocationInGrid(grid, 1);
        }
        if (loc.x < 0 || loc.y < 0) {
            return null;
        }
        return loc;
    };
}

// =============================================================================
// buildMinimalCombatContext
// Minimal CombatDamageContext for inflictDamage/killCreature/addPoison calls
// in the turn-processing pipeline. Full context in combat.ts.
// =============================================================================

export function buildMinimalCombatContext(
    player: Creature,
    rogue: PlayerCharacter,
    pmap: Pcell[][],
    monsters: Creature[],
    floorItems: Item[],
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
        spawnDungeonFeature(x, y, featureIndex, probability, _isGas) {
            const feat = dungeonFeatureCatalog[featureIndex];
            if (!feat) return;
            const scaled = probability === 100
                ? feat
                : { ...feat, startProbability: Math.floor(feat.startProbability * probability / 100) };
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, scaled as never, true, false);
        },
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
        makeMonsterDropItem: (monst: Creature) =>
            doMakeMonsterDropItem(monst, pmap, floorItems, (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags), refreshDungeonCell),
        clearLastTarget(monst) { if (rogue.lastTarget === monst) rogue.lastTarget = null; },
        clearYendorWarden(monst) { if (rogue.yendorWarden === monst) rogue.yendorWarden = null; },
        clearCellMonsterFlag(loc, isDormant) {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags &= ~(isDormant ? TileFlag.HAS_DORMANT_MONSTER : TileFlag.HAS_MONSTER);
            }
        },
        prependCreature: (monst) => { monsters.unshift(monst); },
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        fadeInMonster: buildFadeInMonsterFn(),
        refreshDungeonCell,
        anyoneWantABite: (decedent) => {
            const avoidsCtx = buildMonsterAvoidsCtx(player, monsters, pmap, rogue);
            return anyoneWantABiteFn(decedent, {
                player,
                iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
                randRange: (lo: number, hi: number) => randRange(lo, hi),
                isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                monsterAvoids: (m: Creature, loc: Pos) => monsterAvoidsFn(m, loc, avoidsCtx),
            } as unknown as CombatHelperContext);
        },
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes,
        message: io.message,
        monsterCatalog: getGameState().monsterCatalog,
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: () => buildUpdateVisionFn()(true),
        badMessageColor,
        poisonColor,
    };
}

// Re-export inflictDamage/killCreature for convenience (used alongside these helpers)
export { inflictDamageFn, killCreatureFn };

// Additional imports for buildMonsterAvoidsCtx
import {
    burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn,
    terrainFlags as terrainFlagsFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { passableArcCount } from "./architect/helpers.js";
import { closestWaypointIndex as closestWaypointIndexFn, closestWaypointIndexTo as closestWaypointIndexToFn } from "./monsters/monster-awareness.js";
import { monsterCanSubmergeNow as monsterCanSubmergeNowFn } from "./monsters/monster-spawning.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";

// =============================================================================
// buildMonsterAvoidsCtx
// Returns a minimal MonsterStateContext suitable for monsterAvoids() calls
// from TurnProcessingContext. Only the fields actually accessed by monsterAvoids
// are provided; others are no-ops or stubs.
// =============================================================================

export function buildMonsterAvoidsCtx(
    player: Creature,
    monsters: Creature[],
    pmap: Pcell[][],
    rogue: PlayerCharacter,
): MonsterStateContext {
    return {
        player, monsters,
        rng: { randRange: (lo: number, hi: number) => randRange(lo, hi), randPercent: (pct: number) => randPercent(pct) },
        queryCtx: {} as never,
        cellHasTerrainFlag: (loc: Pos, f: number) => cellHasTerrainFlagFn(pmap, loc, f),
        cellHasTMFlag: (loc: Pos, f: number) => cellHasTMFlagFn(pmap, loc, f),
        terrainFlags: (loc: Pos) => terrainFlagsFn(pmap, loc),
        cellFlags: (loc: Pos) => pmap[loc.x][loc.y].flags,
        isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
        downLoc: rogue.downLoc,
        upLoc: rogue.upLoc,
        monsterAtLoc: (loc: Pos): Creature | null => {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            for (const m of monsters) {
                if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
            }
            return null;
        },
        waypointCount: rogue.wpCount, maxWaypointCount: rogue.wpCount,
        closestWaypointIndex: (m: Creature) =>
            closestWaypointIndexFn(m, rogue.wpCount, rogue.wpDistance, DCOLS),
        closestWaypointIndexTo: (pos: Pos) =>
            closestWaypointIndexToFn(pos, rogue.wpCount, rogue.wpDistance),
        burnedTerrainFlagsAtLoc: (loc: Pos) => burnedTerrainFlagsAtLocFn(pmap, loc),
        discoveredTerrainFlagsAtLoc: (p: Pos) => discoveredTerrainFlagsAtLocFn(
            pmap, p, tileCatalog,
            (tileType: number) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
        passableArcCount: (x: number, y: number) => passableArcCount(pmap, x, y),
        playerHasRespirationArmor: () =>
            !!(rogue.armor &&
               (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
               (rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) &&
               rogue.armor.enchant2 === ArmorEnchant.Respiration),
        mapToShore: rogue.mapToShore,
        PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
        HAS_MONSTER: TileFlag.HAS_MONSTER, HAS_PLAYER: TileFlag.HAS_PLAYER,
        HAS_STAIRS: TileFlag.HAS_STAIRS, IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
        monsterCanSubmergeNow: (m: Creature) => monsterCanSubmergeNowFn(
            m, (loc: Pos, f: number) => cellHasTMFlagFn(pmap, loc, f),
               (loc: Pos, f: number) => cellHasTerrainFlagFn(pmap, loc, f)),
        DCOLS, DROWS,
    } as unknown as MonsterStateContext;
}
