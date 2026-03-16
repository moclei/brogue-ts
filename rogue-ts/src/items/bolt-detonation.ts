/*
 *  items/bolt-detonation.ts — detonateBolt (bolt terminal effects)
 *  brogue-ts
 *
 *  Ported from Items.c: detonateBolt (4720–4811).
 *
 *  Called once a bolt reaches its terminal cell. Handles: forcefield spawn
 *  (BE_OBSTRUCTION), spectral-blade conjuration (BE_CONJURATION), blink
 *  teleport (BE_BLINKING), waypoint recompute (BE_TUNNELING), and targetDF
 *  terrain spawn.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Bolt, Creature } from "../types/types.js";
import type { ZapContext } from "./zap-context.js";
import { BoltEffect, DungeonFeatureType, MonsterType, CreatureState } from "../types/enums.js";
import { MonsterBookkeepingFlag, TileFlag } from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { staffBladeCount } from "../power/power-tables.js";
import { INVALID_POS } from "./bolt-geometry.js";

// =============================================================================
// detonateBolt — from Items.c:4720
// =============================================================================

/**
 * Apply bolt terminal effects at the cell (x, y) after the bolt stops.
 *
 * Handles: forcefield (BE_OBSTRUCTION), spectral blades (BE_CONJURATION),
 * blink landing (BE_BLINKING), waypoint recompute (BE_TUNNELING), and
 * targetDF terrain spawn.
 *
 * C: static void detonateBolt(bolt *theBolt, creature *caster,
 *                              short x, short y, boolean *autoID)
 *    — Items.c:4720
 *
 * @param theBolt  The bolt that terminated.
 * @param caster   The creature that fired the bolt (null for environmental).
 * @param x        Terminal cell X.
 * @param y        Terminal cell Y.
 * @param autoID   Accumulator: set to true if the effect warrants auto-ID.
 * @param ctx      Domain context.
 */
export function detonateBolt(
    theBolt: Bolt,
    caster: Creature | null,
    x: number,
    y: number,
    autoID: { value: boolean },
    ctx: ZapContext,
): void {
    switch (theBolt.boltEffect) {
        case BoltEffect.Obstruction: {
            // C: feat.probabilityDecrement = max(1, 75 * POW_OBSTRUCTION[min(40, magnitude)-2] / FP_FACTOR)
            // POW_OBSTRUCTION = 0.8^x for x in 2..40 (scaled by FP_FACTOR = 65536)
            const POW_OBSTRUCTION = [
                41943, 33554, 26843, 21474, 17179, 13743, 10995, 8796, 7036, 5629,
                4503, 3602, 2882, 2305, 1844, 1475, 1180, 944, 755, 604, 483, 386,
                309, 247, 198, 158, 126, 101, 81, 64, 51, 41, 33, 26, 21, 17, 13, 10, 8, 6,
            ];
            const idx = Math.max(0, Math.min(40, theBolt.magnitude) - 2);
            const probDecrement = Math.max(1, Math.floor(75 * POW_OBSTRUCTION[idx] / 65536));
            ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_FORCEFIELD, true, false, probDecrement);
            autoID.value = true;
            break;
        }

        case BoltEffect.Conjuration: {
            const bladeCount = staffBladeCount(BigInt(theBolt.magnitude) * FP_FACTOR);
            for (let i = 0; i < bladeCount; i++) {
                const monst = ctx.generateMonster(MonsterType.MK_SPECTRAL_BLADE, true, false);
                monst.loc = ctx.getQualifyingPathLocNear({ x, y }, 0, 0);
                monst.bookkeepingFlags |=
                    MonsterBookkeepingFlag.MB_FOLLOWER |
                    MonsterBookkeepingFlag.MB_BOUND_TO_LEADER |
                    MonsterBookkeepingFlag.MB_DOES_NOT_TRACK_LEADER;
                monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_JUST_SUMMONED;
                monst.leader = ctx.player;
                monst.creatureState = CreatureState.Ally;
                monst.ticksUntilTurn = monst.info.attackSpeed + 1;
                ctx.pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.HAS_MONSTER;
                ctx.fadeInMonster(monst);
            }
            ctx.render.updateVision(true);
            autoID.value = true;
            break;
        }

        case BoltEffect.Blinking: {
            if (ctx.pmap[x][y].flags & TileFlag.HAS_MONSTER) {
                // Destination occupied by a (submerged) monster — relocate it before landing.
                // Temporarily clear caster's position so monsterAtLoc returns the occupant.
                if (caster) caster.loc = { ...INVALID_POS };
                const occupant = ctx.monsterAtLoc({ x, y });
                if (occupant) {
                    const altPos = ctx.findAlternativeHomeFor(occupant);
                    if (altPos) {
                        ctx.pmap[occupant.loc.x][occupant.loc.y].flags &= ~TileFlag.HAS_MONSTER;
                        occupant.loc = { ...altPos };
                        ctx.pmap[altPos.x][altPos.y].flags |= TileFlag.HAS_MONSTER;
                    } else {
                        ctx.killCreature(occupant, true);
                        ctx.pmap[x][y].flags &= ~TileFlag.HAS_MONSTER;
                    }
                }
            }
            if (caster) {
                caster.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                ctx.pmap[x][y].flags |= (caster === ctx.player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER);
                caster.loc = { x, y };
                ctx.disentangle(caster);
                ctx.applyInstantTileEffectsToCreature(caster);
                if (caster === ctx.player) {
                    ctx.rogue.scentTurnNumber += 30;
                    if (ctx.pmap[ctx.player.loc.x][ctx.player.loc.y].flags & TileFlag.HAS_ITEM) {
                        ctx.pickUpItemAt(ctx.player.loc);
                    }
                    ctx.render.updateVision(true);
                }
            }
            autoID.value = true;
            break;
        }

        case BoltEffect.Tunneling:
            ctx.setUpWaypoints();
            break;
    }

    if (theBolt.targetDF) {
        ctx.spawnDungeonFeature(x, y, theBolt.targetDF, true, false);
    }
}
