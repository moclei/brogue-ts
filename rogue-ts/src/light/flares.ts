/*
 *  flares.ts — Flare animation system
 *  brogue-ts
 *
 *  Ported from: src/brogue/Light.c (flare-related functions)
 *
 *  Flares are temporary expanding/contracting light effects used for visual
 *  feedback (e.g., scroll protection glow, explosion flash). They animate
 *  over multiple frames, modifying lighting each frame.
 *
 *  The animation loop (animateFlares) depends on UI functions
 *  (demoteVisibility, updateFieldOfViewDisplay, pauseAnimation) which are
 *  injected via callbacks.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { LightSource, Flare, Color, PlayerCharacter } from "../types/types.js";
import { DCOLS, DROWS } from "../types/constants.js";
import type { LightingContext, LightBackup } from "./light.js";
import { paintLight, backUpLighting, restoreLighting, recordOldLights, applyColorScalar } from "./light.js";
import { LightType } from "../types/enums.js";

// =============================================================================
// Constants
// =============================================================================

/** Precision multiplier for flare coefficient animation. */
const FLARE_PRECISION = 1000;

// =============================================================================
// Flare creation
// =============================================================================

/**
 * Create a new flare object.
 *
 * C equivalent: `newFlare` in Light.c
 *
 * @param light - The light source template for the flare.
 * @param x - X coordinate.
 * @param y - Y coordinate.
 * @param changePerFrame - How much the coefficient changes each frame.
 *   Positive = expanding, negative = fading.
 * @param limit - The coefficient value at which the flare expires.
 * @param turnNumber - The turn on which the flare was created.
 * @returns A new Flare object.
 */
export function newFlare(
    light: LightSource,
    x: number,
    y: number,
    changePerFrame: number,
    limit: number,
    turnNumber: number,
): Flare {
    const coeffChangeAmount = changePerFrame === 0 ? 1 : changePerFrame;
    return {
        light: { ...light, lightColor: { ...light.lightColor } },
        loc: { x, y },
        coeffChangeAmount,
        coeffLimit: limit,
        coeff: 100 * FLARE_PRECISION,
        turnNumber,
    };
}

/**
 * Create a standard fading flare and add it to the rogue's flare list.
 *
 * C equivalent: `createFlare` in Light.c
 *
 * @param x - X coordinate.
 * @param y - Y coordinate.
 * @param lightIndex - Index into the light catalog.
 * @param rogue - The player character state (owns the flare list).
 * @param lightCatalog - The light catalog to look up the light source.
 */
export function createFlare(
    x: number,
    y: number,
    lightIndex: LightType,
    rogue: PlayerCharacter,
    lightCatalog: readonly LightSource[],
): void {
    const theFlare = newFlare(lightCatalog[lightIndex], x, y, -15, 0, rogue.absoluteTurnNumber);
    rogue.flares.push(theFlare);
}

// =============================================================================
// Flare lifecycle
// =============================================================================

/**
 * Check if a flare is still active (hasn't expired).
 *
 * C equivalent: `flareIsActive` (static) in Light.c
 */
export function flareIsActive(theFlare: Flare, absoluteTurnNumber: number): boolean {
    const increasing = theFlare.coeffChangeAmount > 0;

    if (theFlare.turnNumber > 0 && theFlare.turnNumber < absoluteTurnNumber - 1) {
        return false;
    }

    const coeffValue = Math.floor(theFlare.coeff / FLARE_PRECISION);

    if (increasing) {
        if (coeffValue > theFlare.coeffLimit) {
            return false;
        }
    } else {
        if (coeffValue < theFlare.coeffLimit) {
            return false;
        }
    }

    return true;
}

/**
 * Advance a flare's animation state by one frame.
 * Returns true if the flare is still active after the update.
 *
 * C equivalent: `updateFlare` (static) in Light.c
 */
export function updateFlare(theFlare: Flare, absoluteTurnNumber: number): boolean {
    if (!flareIsActive(theFlare, absoluteTurnNumber)) {
        return false;
    }
    theFlare.coeff += Math.floor(theFlare.coeffChangeAmount * FLARE_PRECISION / 10);
    theFlare.coeffChangeAmount = Math.floor(theFlare.coeffChangeAmount * 12 / 10);
    return flareIsActive(theFlare, absoluteTurnNumber);
}

/**
 * Draw one frame of a flare's light effect.
 * Returns true if it overlaps the player's field of view.
 *
 * C equivalent: `drawFlareFrame` (static) in Light.c
 */
export function drawFlareFrame(theFlare: Flare, absoluteTurnNumber: number, ctx: LightingContext): boolean {
    if (!flareIsActive(theFlare, absoluteTurnNumber)) {
        return false;
    }

    // Create temporary copies of the light source and color
    const tempColor: Color = { ...theFlare.light.lightColor };
    const tempLight: LightSource = {
        ...theFlare.light,
        lightColor: tempColor,
        lightRadius: { ...theFlare.light.lightRadius },
    };

    const coeffRatio = theFlare.coeff / (FLARE_PRECISION * 100);

    tempLight.lightRadius.lowerBound = Math.floor(tempLight.lightRadius.lowerBound * coeffRatio);
    tempLight.lightRadius.upperBound = Math.floor(tempLight.lightRadius.upperBound * coeffRatio);
    applyColorScalar(tempColor, Math.floor(theFlare.coeff / FLARE_PRECISION));

    return paintLight(tempLight, theFlare.loc.x, theFlare.loc.y, false, true, ctx);
}

// =============================================================================
// Flare animation loop
// =============================================================================

/**
 * Callbacks for UI-dependent operations during flare animation.
 * These are injected because they depend on IO/rendering systems
 * not yet ported.
 */
export interface FlareAnimationCallbacks {
    /** Demote visibility flags (WAS_VISIBLE, etc.). */
    demoteVisibility: () => void;
    /** Refresh the field of view display. */
    updateFieldOfViewDisplay: (updateDancingTerrain: boolean, refreshDisplay: boolean) => void;
    /** Pause animation for the given number of milliseconds. Returns true if fast-forward requested. */
    pauseAnimation: (milliseconds: number) => boolean;
}

/**
 * Animate a list of flares, updating lighting and display each frame
 * until all flares have expired.
 *
 * C equivalent: `animateFlares` in Light.c
 *
 * @param flares - Array of flares to animate (entries set to null as they expire).
 * @param ctx - Lighting context for game state access.
 * @param callbacks - UI callbacks for display updates.
 */
export function animateFlares(
    flares: (Flare | null)[],
    ctx: LightingContext,
    callbacks: FlareAnimationCallbacks,
): void {
    const lights: LightBackup = [];
    for (let i = 0; i < DCOLS; i++) {
        lights[i] = [];
        for (let j = 0; j < DROWS; j++) {
            lights[i][j] = [0, 0, 0];
        }
    }

    backUpLighting(ctx.tmap, lights);
    let fastForward = ctx.rogue.trueColorMode || ctx.rogue.playbackFastForward;

    let atLeastOneFlareStillActive: boolean;
    do {
        let inView = false;
        atLeastOneFlareStillActive = false;

        for (let i = 0; i < flares.length; i++) {
            const flare = flares[i];
            if (flare !== null) {
                if (updateFlare(flare, ctx.rogue.absoluteTurnNumber)) {
                    atLeastOneFlareStillActive = true;
                    if (drawFlareFrame(flare, ctx.rogue.absoluteTurnNumber, ctx)) {
                        inView = true;
                    }
                } else {
                    flares[i] = null;
                }
            }
        }

        callbacks.demoteVisibility();
        callbacks.updateFieldOfViewDisplay(false, true);

        if (!fastForward && (inView || ctx.rogue.playbackOmniscience) && atLeastOneFlareStillActive) {
            fastForward = callbacks.pauseAnimation(10);
        }

        recordOldLights(ctx.tmap);
        restoreLighting(ctx.tmap, lights);
    } while (atLeastOneFlareStillActive);

    callbacks.updateFieldOfViewDisplay(false, true);
}

/**
 * Delete all flares from the rogue's flare list.
 *
 * C equivalent: `deleteAllFlares` in Light.c
 */
export function deleteAllFlares(rogue: PlayerCharacter): void {
    rogue.flares.length = 0;
}
