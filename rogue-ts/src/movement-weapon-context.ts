/*
 *  movement-weapon-context.ts — buildWeaponAttackContext
 *  Port V2 — rogue-ts
 *
 *  Builds a WeaponAttackContext from the current game state.
 *  Extracted from movement.ts to keep that file under 600 lines.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { buildCombatAttackContext } from "./combat.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    terrainFlags as terrainFlagsFn,
} from "./state/helpers.js";
import { coordinatesAreInMap, nbDirs, mapToWindowX, mapToWindowY } from "./globals/tables.js";
import { diagonalBlocked as diagonalBlockedFn } from "./combat/combat-math.js";
import { distanceBetween } from "./monsters/monster-state.js";
import {
    monstersAreEnemies as monstersAreEnemiesFn,
    monsterWillAttackTarget as monsterWillAttackTargetFn,
    monsterIsHidden as monsterIsHiddenFn,
    monsterIsInClass as monsterIsInClassFn,
} from "./monsters/monster-queries.js";
import { attack as attackFn } from "./combat/combat-attack.js";
import { plotCharWithColor as plotCharWithColorFn } from "./io/display.js";
import { buildRefreshDungeonCellFn } from "./io-wiring.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { lightBlue } from "./globals/colors.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { TileFlag, TerrainFlag, MonsterBookkeepingFlag } from "./types/flags.js";
import { CreatureState, DisplayGlyph } from "./types/enums.js";
import type { WeaponAttackContext, BoltInfo } from "./movement/weapon-attacks.js";
import type { Creature, Pos, Color, Bolt } from "./types/types.js";
import { getImpactLoc as getImpactLocFn } from "./items/bolt-geometry.js";
import { buildStaffZapFn } from "./items/staff-wiring.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterAtLocHelper(player: Creature, monsters: Creature[]) {
    return function monsterAtLoc(loc: Pos): Creature | null {
        if (player.loc.x === loc.x && player.loc.y === loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

function buildMonsterNameHelper(player: Creature) {
    return function monsterName(monst: Creature, includeArticle: boolean): string {
        if (monst === player) return "you";
        const pfx = includeArticle
            ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
            : "";
        return `${pfx}${monst.info.monsterName}`;
    };
}

// =============================================================================
// buildWeaponAttackContext
// =============================================================================

/** Build a WeaponAttackContext for whip/spear/flail attacks. */
export function buildWeaponAttackContext(): WeaponAttackContext {
    const { player, rogue, pmap, monsters, displayBuffer } = getGameState();
    const attackCtx = buildCombatAttackContext();
    const refreshDungeonCell = buildRefreshDungeonCellFn();

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const monsterAtLoc = buildMonsterAtLocHelper(player, monsters);
    const canSeeMonster = (m: Creature) =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    const monsterIsHiddenHelper = (m: Creature, observer: Creature | null) =>
        monsterIsHiddenFn(m, observer, {
            player, cellHasTerrainFlag,
            cellHasGas: () => false,
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: false,
        });

    return {
        pmap,
        player,
        rogue: { weapon: rogue.weapon, playbackFastForward: rogue.playbackFastForward },
        nbDirs,
        coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
        isPosInMap: (pos) => coordinatesAreInMap(pos.x, pos.y),
        cellHasTerrainFlag,
        diagonalBlocked: (x1, y1, x2, y2, _isPlayer) =>
            diagonalBlockedFn(x1, y1, x2, y2, (pos) => terrainFlagsFn(pmap, pos)),
        monsterAtLoc,
        canSeeMonster,
        monsterIsHidden: (m, observer) => monsterIsHiddenHelper(m, observer),
        monsterWillAttackTarget: (a, d) =>
            monsterWillAttackTargetFn(a, d, player, cellHasTerrainFlag),
        monsterIsInClass: (m, cls) => monsterIsInClassFn(m, monsterClassCatalog[cls]),
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        monsterName: buildMonsterNameHelper(player),
        distanceBetween: (a, b) => distanceBetween(a, b),

        itemName: () => "item",             // stub — real name in port-v2-platform

        attack: (attacker, defender, lunge) =>
            attackFn(attacker, defender, lunge, attackCtx),

        boltCatalog: boltCatalog as unknown as readonly BoltInfo[],
        getImpactLoc: (origin, target, maxDistance, returnLastEmpty, bolt) => {
            // creatureBlocks: visible non-submerged monster at loc blocks the bolt
            const creatureBlocks = (loc: Pos, originLoc: Pos): boolean => {
                const monst = monsterAtLoc(loc);
                if (!monst) return false;
                if (monsterIsHiddenHelper(monst, monsterAtLoc(originLoc))) return false;
                if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) return false;
                return true;
            };
            const cellBlocks = (loc: Pos): boolean =>
                cellHasTerrainFlagFn(pmap, loc,
                    TerrainFlag.T_OBSTRUCTS_VISION | TerrainFlag.T_OBSTRUCTS_PASSABILITY);
            return getImpactLocFn(
                origin, target, maxDistance, returnLastEmpty,
                bolt as unknown as Bolt | null,
                creatureBlocks, cellBlocks,
            );
        },
        zap: (origin, target, bolt, hideDetails, boltInView) =>
            buildStaffZapFn()(origin, target, bolt as never, hideDetails, boltInView).then(() => {}),

        confirm: () => true,                 // stub — sync context; no async confirm available
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
        plotForegroundChar: (ch, x, y, color, _isOverlay) => {
            // C: plotForegroundChar(ch, x, y, foreColor, isOverlay) — draws using
            // existing background color of the cell.  IO.c:1836
            const wx = mapToWindowX(x);
            const wy = mapToWindowY(y);
            const cell = displayBuffer.cells[wx]?.[wy];
            if (!cell) return;
            const bgColor: Color = {
                red: cell.backColorComponents[0], green: cell.backColorComponents[1],
                blue: cell.backColorComponents[2],
                redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false,
            };
            plotCharWithColorFn(
                ch as DisplayGlyph,
                { windowX: wx, windowY: wy },
                color as Color,
                bgColor,
                displayBuffer,
            );
        },
        pauseAnimation: () => {},             // stub — bolt visual delay; no-op is acceptable
        refreshDungeonCell,
        lightBlue,
        allMonsters: () => monsters,
    };
}
