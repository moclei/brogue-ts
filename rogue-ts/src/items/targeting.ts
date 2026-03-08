/*
 *  items/targeting.ts — Bolt trajectory highlighting and blink safety check
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/Items.c
 *  Functions: hiliteTrajectory (Items.c:5328, private),
 *             playerCancelsBlinking (Items.c:6470, private)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, Bolt, Creature, Pcell, Color } from "../types/types.js";
import { StatusEffect, BoltEffect } from "../types/enums.js";
import {
    BoltFlag, TileFlag, TerrainFlag, TerrainMechFlag,
    MonsterBookkeepingFlag,
} from "../types/flags.js";
import { DCOLS } from "../types/constants.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { getImpactLoc, getLineCoordinates } from "./bolt-geometry.js";

// =============================================================================
// HiliteTrajectoryContext
// =============================================================================

/**
 * Dependencies for hiliteTrajectory.
 */
export interface HiliteTrajectoryContext {
    pmap: Pcell[][];
    player: Creature;
    /** Highlight a dungeon cell with a color tint. Matches C: hiliteCell(x, y, color, 20, true). */
    hiliteCell(x: number, y: number, color: Readonly<Color>, strength: number, saveBuf: boolean): void;
    /** Repaint a single dungeon cell (used to erase hiliting). */
    refreshDungeonCell(loc: Pos): void;
    /** Returns true if the player can directly see the given cell. */
    playerCanSee(x: number, y: number): boolean;
    /** Returns the creature at the given location, or null. */
    monsterAtLoc(loc: Pos): Creature | null;
    /** Returns true if monst is hidden from observer. */
    monsterIsHidden(monst: Creature, observer: Creature): boolean;
    /** Returns true if the cell has any of the given terrain flags. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
}

// =============================================================================
// hiliteTrajectory — Items.c:5328
// =============================================================================

/**
 * Highlight or erase the bolt path on the dungeon map.
 * Returns how far the bolt would travel (cells traversed before blocking).
 *
 * C: static short hiliteTrajectory(const pos coordinateList[DCOLS], short numCells,
 *        boolean eraseHiliting, const bolt *theBolt, const color *hiliteColor)
 *    — Items.c:5328
 *
 * @param coordinateList Precomputed bolt path (from getLineCoordinates).
 * @param numCells       Number of cells to process (≤ coordinateList.length).
 * @param eraseHiliting  If true, refreshDungeonCell (erase); otherwise hiliteCell.
 * @param theBolt        The bolt (flags: BF_FIERY, BF_PASSES_THRU_CREATURES; effect: Tunneling).
 *                       May be null (treated as no special flags).
 * @param hiliteColor    Color for highlighting (ignored when eraseHiliting is true).
 * @param ctx            DI context.
 * @returns              Index at which the bolt stops (0–numCells).
 */
export function hiliteTrajectory(
    coordinateList: readonly Pos[],
    numCells: number,
    eraseHiliting: boolean,
    theBolt: Bolt | null,
    hiliteColor: Readonly<Color> | null,
    ctx: HiliteTrajectoryContext,
): number {
    const isFiery           = !!(theBolt && (theBolt.flags & BoltFlag.BF_FIERY));
    const isTunneling       = !!(theBolt && theBolt.boltEffect === BoltEffect.Tunneling);
    const passThroughMonsters = !!(theBolt && (theBolt.flags & BoltFlag.BF_PASSES_THRU_CREATURES));

    let i = 0;
    for (; i < numCells; i++) {
        const { x, y } = coordinateList[i];

        if (eraseHiliting) {
            ctx.refreshDungeonCell({ x, y });
        } else {
            ctx.hiliteCell(x, y, hiliteColor!, 20, true);
        }

        if (!(ctx.pmap[x][y].flags & TileFlag.DISCOVERED)) {
            if (isTunneling) continue;
            else break;
        } else if (
            !passThroughMonsters &&
            (ctx.pmap[x][y].flags & TileFlag.HAS_MONSTER) &&
            (ctx.playerCanSee(x, y) || !!(ctx.player.status[StatusEffect.Telepathic]))
        ) {
            const monst = ctx.monsterAtLoc({ x, y });
            if (
                monst &&
                !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
                !ctx.monsterIsHidden(monst, ctx.player)
            ) {
                i++;
                break;
            }
        } else if (ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_IS_FLAMMABLE) && isFiery) {
            continue;
        } else if (
            (isTunneling &&
                ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                !!(ctx.pmap[x][y].flags & TileFlag.IMPREGNABLE)) ||
            (!isTunneling &&
                ctx.cellHasTerrainFlag(
                    { x, y },
                    (TerrainFlag.T_OBSTRUCTS_VISION | TerrainFlag.T_OBSTRUCTS_PASSABILITY) >>> 0,
                ))
        ) {
            i++;
            break;
        }
    }
    return i;
}

// =============================================================================
// PlayerCancelsBlinkingContext
// =============================================================================

/**
 * Dependencies for playerCancelsBlinking.
 */
export interface PlayerCancelsBlinkingContext {
    rogue: { playbackMode: boolean };
    player: Creature;
    pmap: Pcell[][];
    /** The full bolt catalog. */
    boltCatalog: readonly Bolt[];
    /** Index of the blink bolt in boltCatalog (BoltType.BLINKING). */
    BOLT_BLINKING: number;
    /**
     * Returns terrain flags for the given cell, limited to player knowledge
     * (uses remembered flags for undiscovered/not-currently-visible cells).
     */
    getLocationFlags(x: number, y: number): { tFlags: number; tmFlags: number };
    /** Returns true if the cell has any of the given terrain flags. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Returns the creature at the given location, or null. */
    monsterAtLoc(loc: Pos): Creature | null;
    /**
     * Returns the blink staff travel distance (in cells) at the given
     * fixed-point enchant level.
     */
    staffBlinkDistance(enchant: bigint): number;
    /** Display a game message. */
    message(msg: string, flags: number): void;
    /** Async yes/no confirmation prompt. Returns true if confirmed. */
    confirm(prompt: string, defaultConfirm: boolean): Promise<boolean>;
}

// =============================================================================
// playerCancelsBlinking — Items.c:6470
// =============================================================================

/**
 * Returns true if the player should abort blinking to targetLoc due to known
 * or possible lava danger.
 *
 * If the landing spot is certain death, shows a message and returns true.
 * If lava is possible but death is not certain, prompts for confirmation
 * and returns true if the player declines.
 *
 * C: static boolean playerCancelsBlinking(const pos originLoc, const pos targetLoc,
 *        const short maxDistance)
 *    — Items.c:6470
 *
 * @param originLoc   The player's current position.
 * @param targetLoc   The intended blink destination.
 * @param maxDistance The blink range in cells (≤ 0 means staff range is unknown).
 * @param ctx         DI context.
 * @returns           Promise resolving to true if the blink should be cancelled.
 */
export async function playerCancelsBlinking(
    originLoc: Pos,
    targetLoc: Pos,
    maxDistance: number,
    ctx: PlayerCancelsBlinkingContext,
): Promise<boolean> {
    if (ctx.rogue.playbackMode) {
        return false;
    }
    if (
        ctx.player.status[StatusEffect.ImmuneToFire] ||
        ctx.player.status[StatusEffect.Levitating]
    ) {
        return false;
    }

    const blinkBolt = ctx.boltCatalog[ctx.BOLT_BLINKING];
    const dist = maxDistance > 0 ? maxDistance : DCOLS;

    // Blink bolt (BF_HALTS_BEFORE_OBSTRUCTION): stops before creatures and walls.
    const creatureBlocks = (loc: Pos): boolean =>
        !!(ctx.pmap[loc.x][loc.y].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER));
    const cellBlocks = (loc: Pos): boolean =>
        ctx.cellHasTerrainFlag(loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY);

    const impactLoc = getImpactLoc(
        originLoc, targetLoc, dist, true, blinkBolt, creatureBlocks, cellBlocks,
    );
    // Get flags for impact cell (tmFlags is reused for all path cells below — faithful to C).
    const impactFlags = ctx.getLocationFlags(impactLoc.x, impactLoc.y);

    let certainDeath = false;
    let possibleDeath = false;

    if (maxDistance > 0) {
        // Known range: check if the impact cell itself is lethal lava.
        if (
            (ctx.pmap[impactLoc.x][impactLoc.y].flags & TileFlag.DISCOVERED) &&
            (impactFlags.tFlags & TerrainFlag.T_LAVA_INSTA_DEATH) &&
            !(impactFlags.tFlags & (TerrainFlag.T_ENTANGLES | TerrainFlag.T_AUTO_DESCENT)) &&
            !(impactFlags.tmFlags & TerrainMechFlag.TM_EXTINGUISHES_FIRE)
        ) {
            certainDeath = true;
            possibleDeath = true;
        }
    } else {
        // Unknown range: scan path cells for possible lava landing spots.
        certainDeath = true;
        const coords = getLineCoordinates(originLoc, targetLoc, blinkBolt);
        const tmFlagsImpact = impactFlags.tmFlags; // held constant across path — see C source
        const minSafeIdx = ctx.staffBlinkDistance(2n * FP_FACTOR) - 1;

        for (let i = 0; i < coords.length; i++) {
            const { x, y } = coords[i];
            if (ctx.pmap[x][y].flags & TileFlag.DISCOVERED) {
                const { tFlags } = ctx.getLocationFlags(x, y);
                if (
                    (tFlags & TerrainFlag.T_LAVA_INSTA_DEATH) &&
                    !(tFlags & (TerrainFlag.T_ENTANGLES | TerrainFlag.T_AUTO_DESCENT)) &&
                    !(tmFlagsImpact & TerrainMechFlag.TM_EXTINGUISHES_FIRE)
                ) {
                    possibleDeath = true;
                } else if (i >= minSafeIdx) {
                    // Found at least one possible safe landing spot.
                    certainDeath = false;
                }
            }
            if (x === impactLoc.x && y === impactLoc.y) break;
        }
    }

    if (possibleDeath && certainDeath) {
        ctx.message("that would be certain death!", 0);
        return true;
    }
    if (possibleDeath && !(await ctx.confirm("Blink across lava with unknown range?", false))) {
        return true;
    }
    return false;
}
