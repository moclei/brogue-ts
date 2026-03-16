/*
 *  items/zap.ts — zap (fire a bolt through the dungeon)
 *  brogue-ts
 *
 *  Ported from Items.c: zap (4814–5175).
 *
 *  Drives bolt travel: path computation, cell-by-cell updateBolt calls,
 *  creature/terrain reflection, tunneling, blinking, and the impact
 *  animation. Returns true if the bolt effect should auto-ID its source.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Bolt, Pos, LightSource } from "../types/types.js";
import type { ZapContext } from "./zap-context.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { BoltEffect } from "../types/enums.js";
import {
    BoltFlag,
    MonsterBookkeepingFlag,
    TileFlag,
    TerrainFlag,
    TerrainMechFlag,
} from "../types/flags.js";
import { MAX_BOLT_LENGTH, DCOLS, DROWS } from "../types/constants.js";
import { getLineCoordinates, reflectBolt } from "./bolt-geometry.js";
import { projectileReflects } from "./bolt-helpers.js";
import { updateBolt } from "./bolt-update.js";
import { detonateBolt } from "./bolt-detonation.js";

// Terrain flags that stop a bolt (passability + vision blockers).
const T_BLOCKS_BOLT = (TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION) >>> 0;

// =============================================================================
// zap — from Items.c:4814
// =============================================================================

/**
 * Fire a bolt from originLoc toward targetLoc.
 *
 * Computes the bolt path, drives cell-by-cell updateBolt/reflection/terrain
 * interactions, renders the travel animation, then calls detonateBolt at the
 * terminal cell.
 *
 * C: boolean zap(pos originLoc, pos targetLoc, bolt *theBolt,
 *                boolean hideDetails, boolean reverseBoltDir)
 *    — Items.c:4814
 *
 * @param originLoc      Cell the bolt originates from.
 * @param targetLoc      Cell the bolt is aimed at.
 * @param theBolt        The bolt definition (a copy is made; caller's original unchanged).
 * @param hideDetails    Show a generic grey bolt instead of the real one.
 * @param reverseBoltDir Reverse path (beckoning wand/totem workaround).
 * @param ctx            Domain context.
 * @returns              True if the effect warrants auto-ID of the source item.
 */
export async function zap(
    originLoc: Pos,
    targetLoc: Pos,
    theBolt: Bolt,
    hideDetails: boolean,
    reverseBoltDir: boolean,
    ctx: ZapContext,
): Promise<boolean> {
    if (originLoc.x === targetLoc.x && originLoc.y === targetLoc.y) {
        return false;
    }

    // Work with a local copy so foreColor/theChar mutations (for blinking) don't
    // escape to the caller's (catalog) bolt.
    const bolt: Bolt = { ...theBolt };

    // ── Compute path ─────────────────────────────────────────────────────────

    // listOfCoordinates is mutated in place by reflectBolt.
    const listOfCoordinates: Pos[] = [];
    let numCells: number;

    if (reverseBoltDir) {
        // Beckoning workaround (Items.c:4843): compute B→A, find where originLoc
        // appears, then reverse that prefix so both legs share coordinates.
        const tmp = getLineCoordinates(targetLoc, originLoc, hideDetails ? null : bolt);
        let revLen = -1;
        for (let i = 0; i < tmp.length; i++) {
            if (tmp[i].x === originLoc.x && tmp[i].y === originLoc.y) {
                revLen = i + 1;
                break;
            }
        }
        if (revLen < 0) revLen = tmp.length;
        for (let i = 0; i < revLen - 1; i++) {
            listOfCoordinates.push({ ...tmp[revLen - 2 - i] });
        }
        listOfCoordinates.push({ ...targetLoc });
        numCells = listOfCoordinates.length;
    } else {
        const path = getLineCoordinates(originLoc, targetLoc, hideDetails ? null : bolt);
        for (const p of path) listOfCoordinates.push({ ...p });
        numCells = listOfCoordinates.length;
    }

    const shootingMonst = ctx.monsterAtLoc(originLoc);

    // ── Bolt length / color ───────────────────────────────────────────────────

    let initialBoltLength = bolt.magnitude * 5;
    let boltLength = initialBoltLength;
    let blinkDistance = 0;

    const boltColor = hideDetails ? null : bolt.backColor;

    // ── Pre-compute bolt light sources ────────────────────────────────────────
    // Mirrors Items.c:4896-4906: each step gets a synthesized LightSource based
    // on BOLT_LIGHT_SOURCE template (radialFadeToPercent=0, passThroughCreatures=false)
    // with boltColor as the light color and a magnitude/distance-scaled radius.
    const boltLights: LightSource[] = [];
    if (boltColor) {
        for (let li = 0; li < initialBoltLength; li++) {
            const boltLightRadius = Number(
                50n * (3n * FP_FACTOR + BigInt(bolt.magnitude) * FP_FACTOR * 4n / 3n)
                * BigInt(initialBoltLength - li) / BigInt(initialBoltLength) / FP_FACTOR,
            );
            boltLights.push({
                lightColor: { ...boltColor },
                lightRadius: { lowerBound: boltLightRadius, upperBound: boltLightRadius, clumpFactor: 1 },
                radialFadeToPercent: 0,
                passThroughCreatures: false,
            });
        }
    }

    // ── Blinking pre-flight ───────────────────────────────────────────────────

    if (bolt.boltEffect === BoltEffect.Blinking) {
        if (
            numCells > 0 &&
            (ctx.cellHasTerrainFlag(listOfCoordinates[0], T_BLOCKS_BOLT) ||
                ((ctx.pmap[listOfCoordinates[0].x][listOfCoordinates[0].y].flags &
                    (TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER)) &&
                    shootingMonst &&
                    !(shootingMonst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)))
        ) {
            return false;
        }
        if (shootingMonst) {
            bolt.theChar = shootingMonst.info.displayChar;
        }
        ctx.pmap[originLoc.x][originLoc.y].flags &= ~(TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER);
        ctx.render.refreshDungeonCell(originLoc);
        blinkDistance = bolt.magnitude * 2 + 1;
        ctx.checkForMissingKeys(originLoc.x, originLoc.y);
    }

    // ── Tunneling: bore through origin cell ───────────────────────────────────

    if (bolt.boltEffect === BoltEffect.Tunneling) {
        ctx.tunnelize(originLoc.x, originLoc.y);
    }

    // ── Render init ──────────────────────────────────────────────────────────

    ctx.render.refreshSideBar();
    ctx.render.displayCombatText();
    ctx.render.backUpLighting();

    // ── State ─────────────────────────────────────────────────────────────────

    const autoID = { value: false };
    const lightingChanged = { value: false };
    let fastForward = false;
    let alreadyReflected = false;
    let boltInView = true;

    let i = 0;
    let x = originLoc.x;
    let y = originLoc.y;

    // ── Main bolt-travel loop ────────────────────────────────────────────────

    for (i = 0; i < numCells; i++) {
        x = listOfCoordinates[i].x;
        y = listOfCoordinates[i].y;

        const monst = ctx.monsterAtLoc(listOfCoordinates[i]);

        // ── Creature reflection ───────────────────────────────────────────────
        if (
            monst &&
            shootingMonst &&
            !(bolt.flags & BoltFlag.BF_NEVER_REFLECTS) &&
            projectileReflects(shootingMonst, monst, ctx) &&
            i < MAX_BOLT_LENGTH - Math.max(DCOLS, DROWS)
        ) {
            if (projectileReflects(shootingMonst, monst, ctx)) {
                // Double roll: retrace toward caster.
                numCells = reflectBolt(
                    originLoc.x, originLoc.y, listOfCoordinates, i, !alreadyReflected,
                    (lo, hi) => ctx.randRange(lo, hi),
                );
            } else {
                // Single roll: random deflection.
                numCells = reflectBolt(-1, -1, listOfCoordinates, i, false,
                    (lo, hi) => ctx.randRange(lo, hi),
                );
            }
            alreadyReflected = true;
            if (boltInView) {
                const monstName = ctx.monsterName(monst, true);
                const verb = monst === ctx.player ? "deflect" : "deflects";
                ctx.combatMessage(
                    `${monstName} ${verb} the ${hideDetails ? "bolt" : bolt.name}`,
                    null,
                );
            }
            if (monst === ctx.player && ctx.rogue.armor) {
                ctx.autoIdentify(ctx.rogue.armor);
            }
            continue;
        }

        // ── Per-cell bolt effect ──────────────────────────────────────────────
        if (updateBolt(bolt, shootingMonst, x, y, boltInView, alreadyReflected, autoID, lightingChanged, ctx)) {
            break;
        }

        if (lightingChanged.value) {
            ctx.render.updateVision(true);
            ctx.render.backUpLighting();
        }

        // ── Render: lighting pass ─────────────────────────────────────────────
        if (boltInView && boltColor) {
            ctx.render.demoteVisibility();
            ctx.render.restoreLighting();
            for (let k = Math.min(i, boltLength + 2); k >= 0; k--) {
                if (k < initialBoltLength && boltLights[k]) {
                    ctx.render.paintLight(boltLights[k], listOfCoordinates[i - k].x, listOfCoordinates[i - k].y);
                }
            }
        }
        boltInView = false;
        ctx.render.updateFieldOfViewDisplay(false, true);

        // ── Render: bolt glyph pass ───────────────────────────────────────────
        for (let k = Math.min(i, boltLength + 2); k >= 0; k--) {
            const x2 = listOfCoordinates[i - k].x;
            const y2 = listOfCoordinates[i - k].y;
            if (ctx.playerCanSeeOrSense(x2, y2)) {
                if (!fastForward) {
                    const cell = ctx.render.getCellAppearance({ x: x2, y: y2 });
                    const displayChar = k === 0 || !!(bolt.flags & BoltFlag.BF_DISPLAY_CHAR_ALONG_LENGTH);
                    if (displayChar && bolt.foreColor && bolt.theChar) {
                        // Platform layer applies color augment and lighting multiplier.
                        ctx.render.plotCharWithColor(bolt.theChar, { x: x2, y: y2 }, bolt.foreColor, cell.backColor);
                    } else if (boltColor) {
                        ctx.render.plotCharWithColor(cell.char, { x: x2, y: y2 }, cell.foreColor, cell.backColor);
                    } else if (k === 1 && bolt.foreColor && bolt.theChar) {
                        ctx.render.refreshDungeonCell({ x: x2, y: y2 });
                    }
                }
                if (ctx.playerCanSee(x2, y2)) {
                    boltInView = true;
                }
            }
        }

        if (!fastForward && (boltInView || ctx.rogue.playbackOmniscience)) {
            fastForward = ctx.rogue.playbackFastForward || await ctx.render.pauseAnimation(16, 0);
        }

        // ── Blinking: shrink magnitude and refresh trail ──────────────────────
        if (bolt.boltEffect === BoltEffect.Blinking) {
            bolt.magnitude = Math.floor((blinkDistance - i) / 2) + 1;
            boltLength = bolt.magnitude * 5;
            for (let j = 0; j < i; j++) {
                ctx.render.refreshDungeonCell(listOfCoordinates[j]);
            }
            if (i >= blinkDistance) {
                break;
            }
        }

        // ── BF_HALTS_BEFORE_OBSTRUCTION ───────────────────────────────────────
        if ((bolt.flags & BoltFlag.BF_HALTS_BEFORE_OBSTRUCTION) && i + 1 < numCells) {
            const next = listOfCoordinates[i + 1];
            if (ctx.cellHasTerrainFlag(next, T_BLOCKS_BOLT)) {
                break;
            }
            if (!(bolt.flags & BoltFlag.BF_PASSES_THRU_CREATURES)) {
                const nextMonst = ctx.monsterAtLoc(next);
                if (nextMonst && !(nextMonst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) {
                    break;
                }
            }
        }

        // ── Tunneling: bore through wall cells ────────────────────────────────
        if (
            ctx.cellHasTerrainFlag({ x, y }, T_BLOCKS_BOLT) &&
            bolt.boltEffect === BoltEffect.Tunneling &&
            ctx.tunnelize(x, y)
        ) {
            ctx.render.updateVision(true);
            ctx.render.backUpLighting();
            autoID.value = true;
            bolt.magnitude--;
            boltLength = bolt.magnitude * 5;
            for (let j = 0; j < i; j++) {
                ctx.render.refreshDungeonCell(listOfCoordinates[j]);
            }
            if (bolt.magnitude <= 0) {
                if (i > 0) ctx.render.refreshDungeonCell(listOfCoordinates[i - 1]);
                ctx.render.refreshDungeonCell({ x, y });
                break;
            }
        }

        // ── Stop at walls ─────────────────────────────────────────────────────
        if (ctx.cellHasTerrainFlag({ x, y }, T_BLOCKS_BOLT)) {
            break;
        }

        // ── Terrain reflection ────────────────────────────────────────────────
        if (i + 1 < numCells && !(bolt.flags & BoltFlag.BF_NEVER_REFLECTS)) {
            const nx = listOfCoordinates[i + 1].x;
            const ny = listOfCoordinates[i + 1].y;
            if (
                ctx.cellHasTerrainFlag({ x: nx, y: ny }, T_BLOCKS_BOLT) &&
                ((shootingMonst && projectileReflects(shootingMonst, null, ctx)) ||
                    ctx.cellHasTMFlag({ x: nx, y: ny }, TerrainMechFlag.TM_REFLECTS_BOLTS) ||
                    (bolt.boltEffect === BoltEffect.Tunneling &&
                        (ctx.pmap[nx][ny].flags & TileFlag.IMPREGNABLE))) &&
                i < MAX_BOLT_LENGTH - Math.max(DCOLS, DROWS)
            ) {
                if (boltInView) {
                    ctx.combatMessage(`the bolt reflects off of ${ctx.tileText(nx, ny)}`, null);
                }
                if (shootingMonst && projectileReflects(shootingMonst, null, ctx)) {
                    numCells = reflectBolt(
                        originLoc.x, originLoc.y, listOfCoordinates, i, !alreadyReflected,
                        (lo, hi) => ctx.randRange(lo, hi),
                    );
                } else {
                    numCells = reflectBolt(-1, -1, listOfCoordinates, i, false,
                        (lo, hi) => ctx.randRange(lo, hi),
                    );
                }
                alreadyReflected = true;
            }
        }
    }

    // ── Post-loop: refresh terminal cells ─────────────────────────────────────
    if (!fastForward) {
        ctx.render.refreshDungeonCell({ x, y });
        if (i > 0) {
            ctx.render.refreshDungeonCell(listOfCoordinates[i - 1]);
        }
    }

    // ── Detonate at terminal cell ─────────────────────────────────────────────
    detonateBolt(bolt, shootingMonst, x, y, autoID, ctx);

    // ── Post-detonate lighting update ─────────────────────────────────────────
    ctx.render.updateLighting();
    ctx.render.backUpLighting();
    ctx.render.refreshSideBar();

    // ── Impact animation ──────────────────────────────────────────────────────
    boltInView = true;
    if (boltLength > 0) {
        if (boltColor) {
            for (let j = i; j < i + boltLength + 2; j++) {
                // Lighting pass.
                if (boltInView) {
                    ctx.render.demoteVisibility();
                    ctx.render.restoreLighting();
                    for (let k = Math.min(j, boltLength + 2); k >= j - i; k--) {
                        if (k < initialBoltLength && boltLights[k]) {
                            ctx.render.paintLight(boltLights[k], listOfCoordinates[j - k].x, listOfCoordinates[j - k].y);
                        }
                    }
                    ctx.render.updateFieldOfViewDisplay(false, true);
                }
                boltInView = false;

                // Hilite pass — bolt dissipates away from impact.
                for (let k = Math.min(j, boltLength + 2); k >= j - i; k--) {
                    const cx = listOfCoordinates[j - k].x;
                    const cy = listOfCoordinates[j - k].y;
                    if (ctx.playerCanSee(cx, cy)) {
                        ctx.render.hiliteCell(cx, cy, boltColor, Math.max(0, 100 - k * 100 / boltLength), false);
                        boltInView = true;
                    }
                }

                if (!fastForward && boltInView) {
                    fastForward = ctx.rogue.playbackFastForward || await ctx.render.pauseAnimation(16, 0);
                }
            }
        } else if (bolt.flags & BoltFlag.BF_DISPLAY_CHAR_ALONG_LENGTH) {
            for (let j = 0; j < i; j++) {
                const cx = listOfCoordinates[j].x;
                const cy = listOfCoordinates[j].y;
                if (ctx.playerCanSeeOrSense(cx, cy)) {
                    ctx.render.refreshDungeonCell({ x: cx, y: cy });
                }
            }
        }
    }

    return autoID.value;
}
