/*
 *  turn-env-wiring.ts — buildUpdateEnvironmentFn
 *  Port V2 — rogue-ts
 *
 *  Extracted from turn.ts to keep that file under 600 lines.
 *  Builds and returns the updateEnvironment() closure used in TurnProcessingContext.
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
} from "./state/helpers.js";
import {
    canSeeMonster as canSeeMonsterFn,
} from "./monsters/monster-queries.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
} from "./combat/combat-damage.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import { monstersFall as monstersFallFn } from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { updateEnvironment as updateEnvironmentFn, promoteTile as promoteTileFn, activateMachine as activateMachineFn, circuitBreakersPreventActivation as circuitBreakersPreventActivationFn, exposeTileToFire as exposeTileToFireFn } from "./time/environment.js";
import type { EnvironmentContext } from "./time/environment.js";
import { buildMessageFns, buildRefreshDungeonCellFn } from "./io-wiring.js";
import { buildUpdateFloorItemsFn } from "./items/floor-items-wiring.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { itemMessageColor, badMessageColor, goodMessageColor, red } from "./globals/colors.js";
import { DCOLS, DROWS } from "./types/constants.js";
import { TileFlag, ItemFlag } from "./types/flags.js";
import { CreatureState, DungeonLayer } from "./types/enums.js";
import type { Creature, Pos, Color } from "./types/types.js";
import { LightType } from "./types/enums.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { randRange, randPercent, randClumpedRange, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "./math/rng.js";
import { itemAtLoc as itemAtLocFn } from "./items/item-inventory.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./items/item-utils.js";
import { createFlare as createFlareFn } from "./light/flares.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import type { ItemTable } from "./types/types.js";
import { playerFalls as playerFallsFn } from "./time/creature-effects.js";
import { terrainFlags as terrainFlagsFn } from "./state/helpers.js";
import { layerWithFlag as layerWithFlagFn } from "./movement/map-queries.js";
import { teleport as teleportFn, disentangle as disentangleFn } from "./monsters/monster-teleport.js";
import { calculateDistances } from "./dijkstra/dijkstra.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import { forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn, avoidedFlagsForMonster as avoidedFlagsForMonsterFn } from "./monsters/monster-spawning.js";
import { startLevel as startLevelFn } from "./lifecycle.js";
import { INVALID_POS } from "./types/types.js";
import { IS_IN_MACHINE, MonsterBookkeepingFlag, TerrainMechFlag } from "./types/flags.js";

// =============================================================================
// buildUpdateEnvironmentFn
// Builds the updateEnvironment() closure for TurnProcessingContext.
// Extracted from buildTurnProcessingContext in turn.ts.
// =============================================================================

export function buildUpdateEnvironmentFn(combatCtx: CombatDamageContext): () => void {
    return function updateEnvironment() {
        const {
            player, rogue, monsters, pmap, levels, floorItems, packItems,
            gameConst, mutableScrollTable, mutablePotionTable,
        } = getGameState();

        const io = buildMessageFns();
        const refreshDungeonCell = buildRefreshDungeonCellFn();

        const namingCtx = {
            gameConstants: gameConst,
            depthLevel: rogue.depthLevel,
            potionTable: mutablePotionTable,
            scrollTable: mutableScrollTable,
            wandTable: wandTable as unknown as ItemTable[],
            staffTable: staffTable as unknown as ItemTable[],
            ringTable: ringTable as unknown as ItemTable[],
            charmTable: charmTable as unknown as ItemTable[],
            playbackOmniscience: rogue.playbackOmniscience,
            monsterClassName: (_classId: number) => "creature",
        };

        const mqCtx = {
            player,
            cellHasTerrainFlag: (pos: Pos, f: number) => cellHasTerrainFlagFn(pmap, pos, f),
            cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: rogue.playbackOmniscience,
        };

        const monsterNameFn = (buf: string[], m: Creature, includeArticle: boolean) => {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        };

        let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
        const envCtx: EnvironmentContext = {
            player, rogue, monsters, pmap, levels, tileCatalog, DCOLS, DROWS,
            dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as EnvironmentContext["dungeonFeatureCatalog"],
            cellHasTerrainFlag: (pos, flags) => cellHasTerrainFlagFn(pmap, pos, flags),
            cellHasTMFlag: (pos, flags) => cellHasTMFlagFn(pmap, pos, flags),
            coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
            refreshDungeonCell,
            spawnDungeonFeature: (x, y, feat, v, o) => {
                const spawned = spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, v, o, refreshDungeonCell);
                if (spawned) {
                    if (v && feat.lightFlare) {
                        createFlareFn(x, y, feat.lightFlare as LightType, rogue, lightCatalog);
                    }
                    if (feat.description && !feat.messageDisplayed && (pmap[x]?.[y]?.flags & TileFlag.VISIBLE)) {
                        void io.message(feat.description, 0);
                        feat.messageDisplayed = true;
                    }
                }
                return spawned;
            },
            monstersFall: () => monstersFallFn({
                monsters, pmap, levels,
                cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
                rogue: { depthLevel: rogue.depthLevel } as unknown as CreatureEffectsContext["rogue"],
                canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
                monsterName: monsterNameFn,
                messageWithColor: (msg: string, color: Color, flags: number) => io.messageWithColor(msg, color, flags),
                messageColorFromVictim: (monst: Creature): Color =>
                    (monst === player || monst.creatureState === CreatureState.Ally) ? badMessageColor : goodMessageColor,
                killCreature: (monst: Creature, adminDeath: boolean) => killCreatureFn(monst, adminDeath, combatCtx),
                inflictDamage: (attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean) =>
                    inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
                randClumpedRange,
                red,
                demoteMonsterFromLeadership: (monst: Creature) => demoteMonsterFromLeadershipFn(monst, monsters),
                removeCreature: (list: Creature[], monst: Creature) => {
                    const i = list.indexOf(monst); if (i >= 0) { list.splice(i, 1); return true; } return false;
                },
                prependCreature: (list: Creature[], monst: Creature) => { list.unshift(monst); },
                refreshDungeonCell,
            } as unknown as CreatureEffectsContext),
            monstersTurn: () => {},
            updateFloorItems: buildUpdateFloorItemsFn({
                floorItems, pmap,
                rogue: { absoluteTurnNumber: rogue.absoluteTurnNumber, depthLevel: rogue.depthLevel },
                gameConst, levels, player,
                tileCatalog: tileCatalog as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["tileCatalog"],
                dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["dungeonFeatureCatalog"],
                mutableScrollTable: mutableScrollTable as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["mutableScrollTable"],
                mutablePotionTable: mutablePotionTable as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["mutablePotionTable"],
                itemMessageColor,
                messageWithColor: (msg, color, flags) => io.messageWithColor(msg, color, flags),
                itemName: (item, buf, details, article) => { buf[0] = itemNameFn(item, details, article, namingCtx); },
                refreshDungeonCell,
                promoteTile: (x, y, layer, forced) => promoteTileFn(x, y, layer as DungeonLayer, forced, envCtx),
                activateMachine: (mn) => activateMachineFn(mn, envCtx),
                circuitBreakersPreventActivation: (mn) => circuitBreakersPreventActivationFn(mn, envCtx),
            }),
            keyOnTileAt: (loc: Pos) => {
                const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;
                if (player.loc.x === loc.x && player.loc.y === loc.y) {
                    const k = packItems.find(it => (it.flags & ItemFlag.ITEM_IS_KEY) && keyMatchesLocationFn(it, loc, rogue.depthLevel, machineNum));
                    if (k) return k;
                }
                if (pmap[loc.x][loc.y].flags & TileFlag.HAS_ITEM) {
                    const fi = itemAtLocFn(loc, floorItems);
                    if (fi && (fi.flags & ItemFlag.ITEM_IS_KEY) && keyMatchesLocationFn(fi, loc, rogue.depthLevel, machineNum)) return fi;
                }
                const monst = monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y);
                if (monst?.carriedItem && (monst.carriedItem.flags & ItemFlag.ITEM_IS_KEY) && keyMatchesLocationFn(monst.carriedItem, loc, rogue.depthLevel, machineNum)) return monst.carriedItem;
                return null;
            },
            removeCreature: (list, m) => { const i = list.indexOf(m); if (i >= 0) { list.splice(i, 1); return true; } return false; },
            prependCreature: (list, m) => { list.unshift(m); },
            rand_range: randRange, rand_percent: randPercent, max: Math.max, min: Math.min,
            fillSequentialList: (list) => fillSequentialListFn(list), shuffleList: (list) => shuffleListFn(list),
            exposeTileToFire: (x, y, a) => exposeToFire(x, y, a),
        };
        exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);
        updateEnvironmentFn(envCtx);
    };
}

// =============================================================================
// buildPlayerFallsFn
// Builds the playerFalls() async closure for TurnProcessingContext.
// Extracted from buildTurnProcessingContext in turn.ts.
// =============================================================================

export function buildPlayerFallsFn(combatCtx: CombatDamageContext): () => Promise<void> {
    return async function playerFalls() {
        const { player, rogue, pmap, gameConst } = getGameState();
        const io = buildMessageFns();

        const _ctf = (pos: Pos, f: number) => cellHasTerrainFlagFn(pmap, pos, f);
        const fovCtx = {
            cellHasTerrainFlag: _ctf,
            getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
        };

        const monsterAtLoc = (loc: Pos): Creature | null => {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            const { monsters } = getGameState();
            for (const m of monsters) {
                if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
            }
            return null;
        };

        const fallCtx = {
            player, rogue, pmap, gameConst,
            cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            discover: (x: number, y: number) => { if (coordinatesAreInMap(x, y)) { pmap[x][y].flags |= TileFlag.DISCOVERED; } },
            monstersFall: () => {},     // stub — separate backlog item
            updateFloorItems: () => {}, // stub — separate backlog item
            layerWithFlag: (x: number, y: number, flag: number) => layerWithFlagFn(pmap, x, y, flag),
            tileCatalog,
            pmapAt: (pos: Pos) => pmap[pos.x][pos.y],
            REQUIRE_ACKNOWLEDGMENT: 1,
            message: io.message,
            terrainFlags: (pos: Pos) => terrainFlagsFn(pmap, pos),
            messageWithColor: (msg: string, color: Color, f: number) => io.messageWithColor(msg, color, f),
            badMessageColor, red,
            inflictDamage: (attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean) =>
                inflictDamageFn(attacker, defender, damage, flashColor, showDamage, combatCtx),
            killCreature: (monst: Creature, adminDeath: boolean) => killCreatureFn(monst, adminDeath, combatCtx),
            gameOver: (msg: string) => gameOver(msg),
            startLevel: (depth: number, dir: number) => startLevelFn(depth, dir),
            randClumpedRange,
            teleport: (monst: Creature, destination: Pos, voluntary: boolean) => {
                teleportFn(monst, destination, voluntary, {
                    player,
                    disentangle: (m: Creature) => disentangleFn(m, { player, message: () => {} }),
                    calculateDistancesFrom: (grid: number[][], x: number, y: number, flags: number) =>
                        calculateDistances(grid, x, y, flags, null, true, false, {
                            cellHasTerrainFlag: _ctf,
                            cellHasTMFlag: (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
                            monsterAtLoc,
                            monsterAvoids: () => false as const,
                            discoveredTerrainFlagsAtLoc: () => 0,
                            isPlayer: (m: Creature) => m === player,
                            getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
                        }),
                    getFOVMaskAt: (grid: number[][], x: number, y: number, radius: bigint, terrain: number, f: number, cautious: boolean) =>
                        getFOVMaskFn(grid, x, y, radius, terrain, f, cautious, fovCtx),
                    forbiddenFlagsForMonster: (info) => forbiddenFlagsForMonsterFn(info),
                    avoidedFlagsForMonster: (info) => avoidedFlagsForMonsterFn(info),
                    cellHasTerrainFlag: _ctf,
                    cellHasTMFlag: (pos: Pos, f: number) => cellHasTMFlagFn(pmap, pos, f),
                    getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
                    isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                    setMonsterLocation(m: Creature, loc: Pos) {
                        const flag = m === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER;
                        if (pmap[m.loc.x]?.[m.loc.y]) pmap[m.loc.x][m.loc.y].flags &= ~flag;
                        m.loc = { ...loc };
                        if (pmap[loc.x]?.[loc.y]) pmap[loc.x][loc.y].flags |= flag;
                        if ((m.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
                            !cellHasTMFlagFn(pmap, loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)) {
                            m.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                        }
                    },
                    chooseNewWanderDestination: () => {},
                    IS_IN_MACHINE,
                    HAS_PLAYER: TileFlag.HAS_PLAYER,
                    HAS_MONSTER: TileFlag.HAS_MONSTER,
                    HAS_STAIRS: TileFlag.HAS_STAIRS,
                });
            },
            INVALID_POS: { ...INVALID_POS },
            createFlare: (x: number, y: number, lightType: number) => createFlareFn(x, y, lightType as LightType, rogue, lightCatalog),
            animateFlares: () => {},    // stub — flare animation is visual
            GENERIC_FLASH_LIGHT: LightType.GENERIC_FLASH_LIGHT,
        };
        await playerFallsFn(fallCtx as unknown as CreatureEffectsContext);
    };
}
