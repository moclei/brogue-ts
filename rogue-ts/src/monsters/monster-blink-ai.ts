/*
 *  monster-blink-ai.ts — Monster blink (teleport) AI helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c
 *  Functions: perimeterCoords (2260), monsterBlinkToPreferenceMap (2290),
 *             monsterBlinkToSafety (2394)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, Bolt } from "../types/types.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { CreatureState } from "../types/enums.js";
import { MonsterBehaviorFlag, TerrainFlag } from "../types/flags.js";
import { posNeighborInDirection } from "../globals/tables.js";
import { staffBlinkDistance } from "../power/power-tables.js";
import { getImpactLoc } from "../items/bolt-geometry.js";
import { getSafetyMap } from "./monster-flee-ai.js";
import type { GetSafetyMapContext } from "./monster-flee-ai.js";

// =============================================================================
// perimeterCoords — Monsters.c:2260
// =============================================================================

/**
 * Maps an index n in [0, 39] to a coordinate offset along the square
 * perimeter of radius 5 centred on (0, 0).
 *
 * The 40 points cover: top edge (11), bottom edge (11), left side (9),
 * right side (9).  Used as the sample space when monsters choose a blink
 * destination.
 *
 * Ported from perimeterCoords() in Monsters.c.
 */
export function perimeterCoords(n: number): Pos {
    if (n <= 10) {          // top edge, left to right
        return { x: n - 5, y: -5 };
    } else if (n <= 21) {   // bottom edge, left to right
        return { x: (n - 11) - 5, y: 5 };
    } else if (n <= 30) {   // left edge, top to bottom
        return { x: -5, y: (n - 22) - 4 };
    } else if (n <= 39) {   // right edge, top to bottom
        return { x: 5, y: (n - 31) - 4 };
    } else {
        return { x: 0, y: 0 }; // garbage in, garbage out
    }
}

// =============================================================================
// monsterBlinkToPreferenceMap — Monsters.c:2290
// =============================================================================

/**
 * Domain dependencies for monsterBlinkToPreferenceMap.
 */
export interface MonsterBlinkContext {
    /** Full bolt catalog; index BOLT_BLINKING gives the blink bolt definition. */
    boltCatalog: Bolt[];
    /** Returns the bolt type index if the monster has the given bolt effect, 0 otherwise. */
    monsterHasBoltEffect(monst: Creature, effectType: number): number;
    /** Returns true if the monster will avoid moving to the given location. */
    monsterAvoids(monst: Creature, loc: Pos): boolean;
    /** Returns true if the player can directly see the monster's cell. */
    canDirectlySeeMonster(monst: Creature): boolean;
    /** Returns a display name for the monster, optionally with "the"/"your" prefix. */
    monsterName(monst: Creature, includeArticle: boolean): string;
    combatMessage(msg: string, color: null): void;
    /** Returns true if the cell has any of the given terrain flags set. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Fire a zap from origin toward target using the given bolt. */
    zap(origin: Pos, target: Pos, bolt: Bolt, hideDetails: boolean, reverseBoltDir: boolean): void;
    /** BoltEffect.Blinking — used to look up the monster's blink ability. */
    BE_BLINKING: number;
    /** BoltType.BLINKING — index into boltCatalog for the blink bolt path geometry. */
    BOLT_BLINKING: number;
    /** MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY */
    MONST_CAST_SPELLS_SLOWLY: number;
}

/**
 * Tries to make the monster blink to the most desirable cell according to
 * preferenceMap.  blinkUphill=true targets higher values; false targets lower.
 * Returns true if the monster blinked (turn consumed); false if it did not.
 *
 * Algorithm:
 * 1. Confirm the monster has a blinking bolt ability.
 * 2. Establish a baseline preference from the four cardinal neighbours.
 * 3. Sample 40 perimeter-of-radius-5 offsets; for each, trace a bolt path to
 *    find the actual landing cell and update the best target if it beats the
 *    baseline and is not a cell the monster avoids.
 * 4. If a valid destination exists (and the landing is meaningfully different
 *    from the current cell), fire the bolt and return true.
 *
 * Ported from monsterBlinkToPreferenceMap() in Monsters.c.
 */
export function monsterBlinkToPreferenceMap(
    monst: Creature,
    preferenceMap: number[][],
    blinkUphill: boolean,
    ctx: MonsterBlinkContext,
): boolean {
    const theBoltType = ctx.monsterHasBoltEffect(monst, ctx.BE_BLINKING);
    if (!theBoltType) {
        return false;
    }

    const maxDistance = staffBlinkDistance(5n * FP_FACTOR);
    let gotOne = false;

    const origin: Pos = { x: monst.loc.x, y: monst.loc.y };
    let bestTarget: Pos = { x: 0, y: 0 };
    let bestPreference: number = preferenceMap[monst.loc.x]?.[monst.loc.y] ?? 0;

    // Establish baseline: the blink destination must be strictly better than
    // any reachable cardinal neighbour.
    for (let i = 0; i < 4; i++) {
        const neighborLoc = posNeighborInDirection(monst.loc, i);
        const nowPreference = preferenceMap[neighborLoc.x]?.[neighborLoc.y] ?? bestPreference;

        if (
            ((blinkUphill && nowPreference > bestPreference) ||
             (!blinkUphill && nowPreference < bestPreference)) &&
            !ctx.monsterAvoids(monst, neighborLoc)
        ) {
            bestPreference = nowPreference;
        }
    }

    // Blink bolt — used for path tracing geometry only.
    const blinkBolt = ctx.boltCatalog[ctx.BOLT_BLINKING];
    // For blink, terrain obstructs but creatures do not block the bolt path.
    const creatureBlocks = (_loc: Pos, _origin: Pos): boolean => false;
    const cellBlocks = (loc: Pos): boolean =>
        ctx.cellHasTerrainFlag(loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY);

    // Sample 40 perimeter points; find the best reachable landing cell.
    for (let i = 0; i < 40; i++) {
        const offset = perimeterCoords(i);
        const target: Pos = {
            x: monst.loc.x + offset.x,
            y: monst.loc.y + offset.y,
        };

        const impact = getImpactLoc(
            origin, target, maxDistance,
            true,       // returnLastEmptySpace
            blinkBolt,
            creatureBlocks,
            cellBlocks,
        );
        const nowPreference = preferenceMap[impact.x]?.[impact.y] ?? bestPreference;

        if (
            ((blinkUphill && nowPreference > bestPreference) ||
             (!blinkUphill && nowPreference < bestPreference)) &&
            !ctx.monsterAvoids(monst, impact)
        ) {
            bestTarget = { x: target.x, y: target.y };
            bestPreference = nowPreference;

            // The landing cell must be meaningfully different from the current
            // position (not just a diagonal-adjacent swap that walking can achieve).
            // Note: the two cellHasTerrainFlag checks below are deliberately
            // cross-axis (impact.x with origin.y; origin.x with impact.y),
            // matching the C source exactly.
            if (
                (Math.abs(impact.x - origin.x) > 1 || Math.abs(impact.y - origin.y) > 1) ||
                ctx.cellHasTerrainFlag({ x: impact.x, y: origin.y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                ctx.cellHasTerrainFlag({ x: origin.x, y: impact.y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
            ) {
                gotOne = true;
            } else {
                gotOne = false;
            }
        }
    }

    if (gotOne) {
        if (ctx.canDirectlySeeMonster(monst)) {
            const name = ctx.monsterName(monst, true);
            ctx.combatMessage(`${name} blinks`, null);
        }
        monst.ticksUntilTurn = monst.attackSpeed *
            ((monst.info.flags & MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY) ? 2 : 1);
        const theBolt = { ...ctx.boltCatalog[theBoltType] };
        ctx.zap(origin, bestTarget, theBolt, false, false);
        return true;
    }
    return false;
}

// =============================================================================
// monsterBlinkToSafety — Monsters.c:2394
// =============================================================================

/**
 * Domain dependencies for monsterBlinkToSafety.
 * Extends MonsterBlinkContext with the safety-map machinery.
 */
export interface MonsterBlinkToSafetyContext extends MonsterBlinkContext, GetSafetyMapContext {
    allySafetyMap: number[][];
    rogue: {
        updatedAllySafetyMapThisTurn: boolean;
        updatedSafetyMapThisTurn: boolean;
    };
    updateAllySafetyMap(): void;
}

/**
 * Picks the appropriate safety map and delegates to monsterBlinkToPreferenceMap
 * with blinkUphill=false (flee toward lower-danger values).
 *
 * Allied monsters use the shared allySafetyMap; enemies use getSafetyMap()
 * which handles the per-monster copy-on-unawareness logic.
 *
 * Ported from monsterBlinkToSafety() in Monsters.c.
 */
export function monsterBlinkToSafety(
    monst: Creature,
    ctx: MonsterBlinkToSafetyContext,
): boolean {
    let blinkSafetyMap: number[][];

    if (monst.creatureState === CreatureState.Ally) {
        if (!ctx.rogue.updatedAllySafetyMapThisTurn) {
            ctx.updateAllySafetyMap();
        }
        blinkSafetyMap = ctx.allySafetyMap;
    } else {
        blinkSafetyMap = getSafetyMap(monst, ctx);
    }

    return monsterBlinkToPreferenceMap(monst, blinkSafetyMap, false, ctx);
}
