/*
 *  stairs-wiring.ts — Context builder for monstersApproachStairs
 *  Port V2 — rogue-ts
 *
 *  Provides buildMonstersApproachStairsCtx() for use in buildTurnProcessingContext().
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "../core.js";
import { cellHasTerrainFlag as cellHasTerrainFlagFn, cellHasTMFlag as cellHasTMFlagFn, terrainFlags as terrainFlagsFn } from "../state/helpers.js";
import { monstersApproachStairs, type MiscHelpersContext } from "./misc-helpers.js";
import { buildMessageFns, buildRefreshDungeonCellFn } from "../io-wiring.js";
import { avoidedFlagsForMonster as avoidedFlagsForMonsterFn } from "../monsters/monster-spawning.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "../movement/path-qualifying.js";
import { restoreMonster as restoreMonsterFn, getQualifyingLocNear as getQualifyingLocNearFn } from "../architect/architect.js";
import { INVALID_POS } from "../types/types.js";
import { badMessageColor, red } from "../globals/colors.js";
import { randClumpedRange, randRange } from "../math/rng.js";
import { CreatureState, DungeonLayer } from "../types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, IS_IN_MACHINE } from "../types/flags.js";
import { canSeeMonster as canSeeMonsterFn } from "../monsters/monster-queries.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";
import type { Creature, Pos, Pcell } from "../types/types.js";

export { monstersApproachStairs };

export function buildMonstersApproachStairsCtx(): MiscHelpersContext {
    const { rogue, player, pmap, monsters, levels } = getGameState();
    const io = buildMessageFns();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const _ctf = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
    const _pmapAt = (loc: Pos): Pcell => pmap[loc.x][loc.y];
    const mqCtx = {
        player,
        cellHasTerrainFlag: _ctf,
        cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    return {
        player,
        rogue: {
            depthLevel: rogue.depthLevel,
            yendorWarden: rogue.yendorWarden ?? null,
            upLoc: rogue.upLoc,
            downLoc: rogue.downLoc,
        } as unknown as MiscHelpersContext["rogue"],
        deepestLevel: rogue.deepestLevel,
        monsters,
        levels,
        pmap,
        INVALID_POS: { ...INVALID_POS },
        avoidedFlagsForMonster: (info: Creature["info"]) => avoidedFlagsForMonsterFn(info),
        getQualifyingPathLocNear(loc: Pos, diags: boolean, bTerrain: number, bMap: number, fTerrain: number, fMap: number, forbid: boolean) {
            return getQualifyingPathLocNearFn(loc, diags, bTerrain, bMap, fTerrain, fMap, forbid, {
                pmap,
                cellHasTerrainFlag: _ctf,
                cellFlags: (pos: Pos) => pmap[pos.x]?.[pos.y]?.flags ?? 0,
                getQualifyingLocNear: () => null,
                rng: { randRange },
            });
        },
        restoreMonster: (monst: Creature) => restoreMonsterFn(monst, null, null, {
            pmap, monsters, nbDirs, coordinatesAreInMap,
            cellHasTMFlag: (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags),
            cellHasTerrainFlag: _ctf,
            avoidedFlagsForMonster: (info: Creature["info"]) => avoidedFlagsForMonsterFn(info),
            knownToPlayerAsPassableOrSecretDoor: (pos: Pos) => {
                const cell = pmap[pos.x]?.[pos.y];
                if (!cell) return false;
                const discovered = !!(cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED));
                const visible = !!(cell.flags & TileFlag.VISIBLE);
                const obstructs = (discovered && !visible)
                    ? !!(cell.rememberedTerrainFlags & TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    : _ctf(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY);
                return !obstructs || cellHasTMFlagFn(pmap, pos, TerrainMechFlag.TM_IS_SECRET);
            },
            getQualifyingPathLocNear: (loc, diags, bTerrain, bMap, fTerrain, fMap, forbid) =>
                getQualifyingPathLocNearFn(loc, diags, bTerrain, bMap, fTerrain, fMap, forbid, {
                    pmap,
                    cellHasTerrainFlag: _ctf,
                    cellFlags: (pos: Pos) => pmap[pos.x]?.[pos.y]?.flags ?? 0,
                    getQualifyingLocNear: (t, _ha, forbTerrF, forbMapF, _det) =>
                        getQualifyingLocNearFn(pmap, t, forbTerrF, forbMapF),
                    rng: { randRange },
                }),
            HAS_PLAYER: TileFlag.HAS_PLAYER,
            HAS_MONSTER: TileFlag.HAS_MONSTER,
            HAS_STAIRS: TileFlag.HAS_STAIRS,
            IS_IN_MACHINE,
        }),
        monsterName: (m: Creature, article: boolean) =>
            m === player ? "you" : `${article ? "the " : ""}${m.info.monsterName}`,
        canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
        message: io.message,
        messageWithColor: (msg: string, c: unknown, f: number) => io.messageWithColor(msg, c as never, f),
        messageColorFromVictim: (m: Creature) =>
            m === player || m.creatureState === CreatureState.Ally ? badMessageColor : badMessageColor,
        inflictDamage: () => false,  // pit falls only — stub
        killCreature: () => {},      // pit falls only — stub
        red,
        randClumpedRange,
        terrainFlags: (pos: Pos) => terrainFlagsFn(pmap, pos),
        pmapAt: _pmapAt,
        refreshDungeonCell,
        removeCreature(list: Creature[], m: Creature) {
            const i = list.indexOf(m); if (i >= 0) list.splice(i, 1); return true;
        },
        prependCreature(list: Creature[], m: Creature) { list.unshift(m); },
    } as unknown as MiscHelpersContext;
}
