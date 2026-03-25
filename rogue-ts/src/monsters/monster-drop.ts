/*
 *  monsters/monster-drop.ts — doMakeMonsterDropItem
 *  Port V2 — rogue-ts
 *
 *  Extracted from monsters.ts to break the circular dependency between
 *  monsters.ts and combat.ts.  Both files need doMakeMonsterDropItem, but
 *  monsters.ts imports buildCombatDamageContext from combat.ts, so combat.ts
 *  cannot import from monsters.ts.
 *
 *  C: Monsters.c:4065 — makeMonsterDropItem().
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "../movement/path-qualifying.js";
import type { QualifyingPathContext } from "../movement/path-qualifying.js";
import { randRange } from "../math/rng.js";
import { coordinatesAreInMap } from "../globals/tables.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { TileFlag, TerrainFlag, T_DIVIDES_LEVEL } from "../types/flags.js";
import type { Creature, Pos, Item, Pcell } from "../types/types.js";

/**
 * Builds a minimal QualifyingPathContext for item drop location searches.
 */
export function buildQualifyingPathCtx(
    pmap: Pcell[][],
    cellHasTerrainFlagFn: (loc: Pos, flags: number) => boolean,
): QualifyingPathContext {
    return {
        pmap,
        cellHasTerrainFlag: cellHasTerrainFlagFn,
        cellFlags: (pos) => pmap[pos.x]?.[pos.y]?.flags ?? 0,
        getQualifyingLocNear(target, _hallwaysAllowed, forbiddenTerrainFlags, forbiddenMapFlags, deterministic) {
            // Fallback ring-search used when dijkstra finds no path-reachable cell.
            // Mirrors C getQualifyingLocNear() (Grid.c) with blockingMap=null, forbidLiquid=false.
            const maxK = Math.max(DCOLS, DROWS);
            let candidateLocs = 0;
            for (let k = 0; k < maxK && !candidateLocs; k++) {
                for (let i = target.x - k; i <= target.x + k; i++) {
                    for (let j = target.y - k; j <= target.y + k; j++) {
                        if (
                            coordinatesAreInMap(i, j) &&
                            (i === target.x - k || i === target.x + k || j === target.y - k || j === target.y + k) &&
                            !cellHasTerrainFlagFn({ x: i, y: j }, forbiddenTerrainFlags) &&
                            !(pmap[i][j].flags & forbiddenMapFlags)
                        ) {
                            candidateLocs++;
                        }
                    }
                }
            }
            if (!candidateLocs) return null;
            let idx = deterministic ? 1 + Math.floor(candidateLocs / 2) : randRange(1, candidateLocs);
            for (let k = 0; k < maxK; k++) {
                for (let i = target.x - k; i <= target.x + k; i++) {
                    for (let j = target.y - k; j <= target.y + k; j++) {
                        if (
                            coordinatesAreInMap(i, j) &&
                            (i === target.x - k || i === target.x + k || j === target.y - k || j === target.y + k) &&
                            !cellHasTerrainFlagFn({ x: i, y: j }, forbiddenTerrainFlags) &&
                            !(pmap[i][j].flags & forbiddenMapFlags)
                        ) {
                            if (--idx === 0) return { x: i, y: j };
                        }
                    }
                }
            }
            return null;
        },
        rng: { randRange },
    };
}

/**
 * Drops monst's carried item at the nearest valid floor location.
 * Mirrors C Monsters.c:4065 — makeMonsterDropItem().
 */
export function doMakeMonsterDropItem(
    monst: Creature,
    pmap: Pcell[][],
    floorItems: Item[],
    cellHasTerrainFlagFn: (loc: Pos, flags: number) => boolean,
    refreshDungeonCell: (loc: Pos) => void,
): void {
    if (!monst.carriedItem) return;
    const item = monst.carriedItem;
    const dropLoc = getQualifyingPathLocNearFn(
        monst.loc, true,
        T_DIVIDES_LEVEL, 0,
        TerrainFlag.T_OBSTRUCTS_ITEMS, TileFlag.HAS_PLAYER | TileFlag.HAS_STAIRS | TileFlag.HAS_ITEM,
        false,
        buildQualifyingPathCtx(pmap, cellHasTerrainFlagFn),
    );
    item.loc = { ...dropLoc };
    const idx = floorItems.indexOf(item);
    if (idx !== -1) floorItems.splice(idx, 1);
    floorItems.push(item);
    pmap[dropLoc.x][dropLoc.y].flags |= TileFlag.HAS_ITEM;
    monst.carriedItem = null;
    refreshDungeonCell(dropLoc);
}
