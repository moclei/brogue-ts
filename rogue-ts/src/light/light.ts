/*
 *  light.ts — Lighting system: light painting, FOV, and display updates
 *  brogue-ts
 *
 *  Ported from: src/brogue/Light.c (412 lines)
 *
 *  The lighting system computes per-cell RGB light values by painting light
 *  sources onto the tmap grid. Each light source casts a field-of-view mask,
 *  then contributes color weighted by distance.
 *
 *  Functions that access game state receive it via dependency injection.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Pos, LightSource, Color, Tcell, Pcell, Creature, PlayerCharacter, FloorTileType, Mutation } from "../types/types.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../types/constants.js";
import { DisplayDetailValue, LightType, StatusEffect } from "../types/enums.js";
import { TileFlag, TerrainFlag, MonsterBehaviorFlag } from "../types/flags.js";
import { FP_FACTOR, fpSqrt, fpRound } from "../math/fixpt.js";
import { randClump, randRange, clamp } from "../math/rng.js";
import { getFOVMask, type FOVContext } from "./fov.js";
import {
    playerInvisibleColor, playerInDarknessColor,
    playerInShadowColor, playerInLightColor,
    minersLightColor,
} from "../globals/colors.js";

// =============================================================================
// Context interface for lighting
// =============================================================================

/**
 * Dependency injection context for the lighting system.
 * Provides access to all game state needed by paintLight and updateLighting.
 */
export interface LightingContext extends FOVContext {
    /** Transient cell grid (lighting). DCOLS×DROWS column-major. */
    tmap: Tcell[][];
    /** Permanent cell grid (flags, layers). DCOLS×DROWS column-major. */
    pmap: Pcell[][];
    /** Display detail grid (DV_UNLIT, DV_LIT, DV_DARK). DCOLS×DROWS. */
    displayDetail: number[][];

    // Entities
    player: Creature;
    rogue: PlayerCharacter;
    monsters: Creature[];
    dormantMonsters: Creature[];

    // Catalogs
    lightCatalog: readonly LightSource[];
    tileCatalog: readonly FloorTileType[];
    mutationCatalog: readonly Mutation[];

    // Helper functions
    /** Check if a monster is revealed by telepathy/entrancement/etc. */
    monsterRevealed: (monst: Creature) => boolean;
}

// =============================================================================
// Lighting grid backup / restore
// =============================================================================

/** Type for backed-up lighting data: RGB per cell. */
export type LightBackup = [number, number, number][][];

/**
 * Create an empty DCOLS×DROWS lighting backup grid.
 */
export function createLightBackup(): LightBackup {
    const backup: LightBackup = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        backup[i] = new Array(DROWS);
        for (let j = 0; j < DROWS; j++) {
            backup[i][j] = [0, 0, 0];
        }
    }
    return backup;
}

/**
 * Copy the current lighting state (tmap.light) into a backup grid.
 *
 * C equivalent: `backUpLighting` in Light.c
 */
export function backUpLighting(tmap: Tcell[][], lights: LightBackup): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            lights[i][j][0] = tmap[i][j].light[0];
            lights[i][j][1] = tmap[i][j].light[1];
            lights[i][j][2] = tmap[i][j].light[2];
        }
    }
}

/**
 * Restore the lighting state from a backup grid into tmap.light.
 *
 * C equivalent: `restoreLighting` in Light.c
 */
export function restoreLighting(tmap: Tcell[][], lights: LightBackup): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            tmap[i][j].light[0] = lights[i][j][0];
            tmap[i][j].light[1] = lights[i][j][1];
            tmap[i][j].light[2] = lights[i][j][2];
        }
    }
}

/**
 * Copy tmap.light into tmap.oldLight for animation frame comparison.
 *
 * C equivalent: `recordOldLights` (static) in Light.c
 */
export function recordOldLights(tmap: Tcell[][]): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            tmap[i][j].oldLight[0] = tmap[i][j].light[0];
            tmap[i][j].oldLight[1] = tmap[i][j].light[1];
            tmap[i][j].oldLight[2] = tmap[i][j].light[2];
        }
    }
}

// =============================================================================
// Color helpers (ported from IO.c)
// =============================================================================

/**
 * Scale all color components by scalar/100.
 *
 * C equivalent: `applyColorScalar` in IO.c
 */
export function applyColorScalar(baseColor: Color, scalar: number): void {
    baseColor.red = Math.floor(baseColor.red * scalar / 100);
    baseColor.redRand = Math.floor(baseColor.redRand * scalar / 100);
    baseColor.green = Math.floor(baseColor.green * scalar / 100);
    baseColor.greenRand = Math.floor(baseColor.greenRand * scalar / 100);
    baseColor.blue = Math.floor(baseColor.blue * scalar / 100);
    baseColor.blueRand = Math.floor(baseColor.blueRand * scalar / 100);
    baseColor.rand = Math.floor(baseColor.rand * scalar / 100);
}

// =============================================================================
// Core light painting
// =============================================================================

/**
 * Paint a light source at position (x, y) onto the tmap lighting grid.
 * Uses FOV computation to determine which cells are lit, then applies
 * color with distance-based falloff.
 *
 * Returns true if any lit cells are within the player's field of view.
 *
 * @param theLight - The light source definition.
 * @param x - X coordinate of the light source.
 * @param y - Y coordinate of the light source.
 * @param isMinersLight - If true, does not dispel IS_IN_SHADOW.
 * @param maintainShadows - If true, does not dispel IS_IN_SHADOW regardless of light strength.
 * @param ctx - Lighting context for game state access.
 *
 * C equivalent: `paintLight` in Light.c
 */
export function paintLight(
    theLight: LightSource,
    x: number,
    y: number,
    isMinersLight: boolean,
    maintainShadows: boolean,
    ctx: LightingContext,
): boolean {
    // Compute radius in fixed-point
    const radius = BigInt(randClump(theLight.lightRadius)) * FP_FACTOR / 100n;
    const radiusRounded = Number(fpRound(radius));

    // Compute random color components
    const randComponent = randRange(0, theLight.lightColor.rand);
    const colorComponents: [number, number, number] = [
        randComponent + theLight.lightColor.red + randRange(0, theLight.lightColor.redRand),
        randComponent + theLight.lightColor.green + randRange(0, theLight.lightColor.greenRand),
        randComponent + theLight.lightColor.blue + randRange(0, theLight.lightColor.blueRand),
    ];

    // The miner's light does not dispel IS_IN_SHADOW,
    // so the player can be in shadow despite casting his own light.
    const dispelShadows = !maintainShadows
        && (colorComponents[0] + colorComponents[1] + colorComponents[2]) > 0;

    const fadeToPercent = theLight.radialFadeToPercent;

    // Zero out the relevant rectangle of the grid
    const grid: number[][] = new Array(DCOLS);
    for (let i = 0; i < DCOLS; i++) {
        grid[i] = new Array(DROWS).fill(0);
    }

    // Compute FOV mask
    getFOVMask(
        grid, x, y, radius,
        TerrainFlag.T_OBSTRUCTS_VISION,
        theLight.passThroughCreatures ? 0 : (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER),
        !isMinersLight,
        ctx,
    );

    let overlappedFieldOfView = false;

    const xMin = Math.max(0, x - radiusRounded);
    const xMax = Math.min(DCOLS, x + radiusRounded);
    const yMin = Math.max(0, y - radiusRounded);
    const yMax = Math.min(DROWS, y + radiusRounded);

    for (let i = xMin; i < xMax; i++) {
        for (let j = yMin; j < yMax; j++) {
            if (grid[i][j]) {
                // Compute light falloff based on distance
                const distSq = (i - x) * (i - x) + (j - y) * (j - y);
                const fpDist = fpSqrt(BigInt(distSq) * FP_FACTOR);
                const lightMultiplier = Number(
                    100n - BigInt(100 - fadeToPercent) * fpDist / radius,
                );

                for (let k = 0; k < 3; k++) {
                    ctx.tmap[i][j].light[k] += Math.floor(
                        colorComponents[k] * lightMultiplier / 100,
                    );
                }

                if (dispelShadows) {
                    ctx.pmap[i][j].flags &= ~TileFlag.IS_IN_SHADOW;
                }

                if (ctx.pmap[i][j].flags & (TileFlag.IN_FIELD_OF_VIEW | ANY_KIND_OF_VISIBLE)) {
                    overlappedFieldOfView = true;
                }
            }
        }
    }

    // Always add light at the source cell
    ctx.tmap[x][y].light[0] += colorComponents[0];
    ctx.tmap[x][y].light[1] += colorComponents[1];
    ctx.tmap[x][y].light[2] += colorComponents[2];

    if (dispelShadows) {
        ctx.pmap[x][y].flags &= ~TileFlag.IS_IN_SHADOW;
    }

    return overlappedFieldOfView;
}

import { ANY_KIND_OF_VISIBLE } from "../types/flags.js";

// =============================================================================
// Miner's light radius update
// =============================================================================

/**
 * Update the miner's light radius and fade based on rings of illumination,
 * scrolls of darkness, and water submersion.
 *
 * C equivalent: `updateMinersLightRadius` in Light.c
 */
export function updateMinersLightRadius(rogue: PlayerCharacter, player: Creature): void {
    let lightRadius = BigInt(100) * rogue.minersLightRadius;

    if (rogue.lightMultiplier < 0) {
        lightRadius = lightRadius / BigInt(-1 * rogue.lightMultiplier + 1);
    } else {
        lightRadius *= BigInt(rogue.lightMultiplier);
        const minLight = BigInt(rogue.lightMultiplier * 2 + 2) * FP_FACTOR;
        if (lightRadius < minLight) lightRadius = minLight;
    }

    let fraction: bigint;

    if (player.status[StatusEffect.Darkness]) {
        const baseFraction =
            FP_FACTOR
            - BigInt(player.status[StatusEffect.Darkness]) * FP_FACTOR
            / BigInt(player.maxStatus[StatusEffect.Darkness]);
        fraction = baseFraction * baseFraction / FP_FACTOR * baseFraction / FP_FACTOR;
        const minFraction = FP_FACTOR / 20n;
        if (fraction < minFraction) {
            fraction = minFraction;
        }
        lightRadius = lightRadius * fraction / FP_FACTOR;
    } else {
        fraction = FP_FACTOR;
    }

    if (lightRadius < 2n * FP_FACTOR) {
        lightRadius = 2n * FP_FACTOR;
    }

    if (rogue.inWater && lightRadius > 3n * FP_FACTOR) {
        const half = lightRadius / 2n;
        lightRadius = half > 3n * FP_FACTOR ? half : 3n * FP_FACTOR;
    }

    rogue.minersLight.radialFadeToPercent =
        35 + Number(
            BigInt(Math.max(0, Math.min(65, rogue.lightMultiplier * 5))) * fraction / FP_FACTOR,
        );

    const clampedRadius = Number(
        clamp(Number(lightRadius / FP_FACTOR), -30000, 30000),
    );
    rogue.minersLight.lightRadius.upperBound = clampedRadius;
    rogue.minersLight.lightRadius.lowerBound = clampedRadius;
}

// =============================================================================
// Display detail update
// =============================================================================

/**
 * Update the displayDetail grid based on current lighting state.
 * Cells with very negative light are DV_DARK; cells in shadow are DV_UNLIT;
 * otherwise DV_LIT.
 *
 * C equivalent: `updateDisplayDetail` (static) in Light.c
 */
export function updateDisplayDetail(ctx: LightingContext): void {
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (
                ctx.tmap[i][j].light[0] < -10
                && ctx.tmap[i][j].light[1] < -10
                && ctx.tmap[i][j].light[2] < -10
            ) {
                ctx.displayDetail[i][j] = DisplayDetailValue.Dark;
            } else if (ctx.pmap[i][j].flags & TileFlag.IS_IN_SHADOW) {
                ctx.displayDetail[i][j] = DisplayDetailValue.Unlit;
            } else {
                ctx.displayDetail[i][j] = DisplayDetailValue.Lit;
            }
        }
    }
}

// =============================================================================
// Check if player is in darkness
// =============================================================================

/**
 * Returns true if the player's cell is darker than the miner's light color.
 *
 * C equivalent: `playerInDarkness` in Light.c
 */
export function playerInDarkness(tmap: Tcell[][], playerLoc: Pos): boolean {
    return (
        tmap[playerLoc.x][playerLoc.y].light[0] + 10 < minersLightColor.red
        && tmap[playerLoc.x][playerLoc.y].light[1] + 10 < minersLightColor.green
        && tmap[playerLoc.x][playerLoc.y].light[2] + 10 < minersLightColor.blue
    );
}

// =============================================================================
// Main lighting update
// =============================================================================

/**
 * Recompute all lighting for the current level.
 *
 * This is the main lighting orchestrator. It:
 * 1. Records old light values for animation comparison
 * 2. Zeroes all light and sets IS_IN_SHADOW
 * 3. Paints glowing terrain tiles
 * 4. Paints creature intrinsic lights
 * 5. Paints telepathy lights for revealed/dormant monsters
 * 6. Updates display detail
 * 7. Paints the miner's light
 * 8. Updates the player's foreground color based on lighting
 *
 * C equivalent: `updateLighting` in Light.c
 */
export function updateLighting(ctx: LightingContext): void {
    // 1. Copy light to oldLight
    recordOldLights(ctx.tmap);

    // 2. Zero out light and set IS_IN_SHADOW
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            ctx.tmap[i][j].light[0] = 0;
            ctx.tmap[i][j].light[1] = 0;
            ctx.tmap[i][j].light[2] = 0;
            ctx.pmap[i][j].flags |= TileFlag.IS_IN_SHADOW;
        }
    }

    // 3. Paint all glowing tiles
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                const tile = ctx.pmap[i][j].layers[layer];
                if (ctx.tileCatalog[tile].glowLight) {
                    paintLight(
                        ctx.lightCatalog[ctx.tileCatalog[tile].glowLight],
                        i, j, false, false, ctx,
                    );
                }
            }
        }
    }

    // 4. Paint creature lights (player first, then monsters)
    const creaturesToLight: Creature[] = [ctx.player, ...ctx.monsters];
    for (const monst of creaturesToLight) {
        if (monst.info.intrinsicLightType) {
            paintLight(
                ctx.lightCatalog[monst.info.intrinsicLightType],
                monst.loc.x, monst.loc.y, false, false, ctx,
            );
        }
        if (
            monst.mutationIndex >= 0
            && ctx.mutationCatalog[monst.mutationIndex].light !== LightType.NO_LIGHT
        ) {
            paintLight(
                ctx.lightCatalog[ctx.mutationCatalog[monst.mutationIndex].light],
                monst.loc.x, monst.loc.y, false, false, ctx,
            );
        }
        if (
            monst.status[StatusEffect.Burning]
            && !(monst.info.flags & MonsterBehaviorFlag.MONST_FIERY)
        ) {
            paintLight(
                ctx.lightCatalog[LightType.BURNING_CREATURE_LIGHT],
                monst.loc.x, monst.loc.y, false, false, ctx,
            );
        }
        if (ctx.monsterRevealed(monst)) {
            paintLight(
                ctx.lightCatalog[LightType.TELEPATHY_LIGHT],
                monst.loc.x, monst.loc.y, false, true, ctx,
            );
        }
    }

    // 5. Paint telepathy lights for dormant monsters
    for (const monst of ctx.dormantMonsters) {
        if (ctx.monsterRevealed(monst)) {
            paintLight(
                ctx.lightCatalog[LightType.TELEPATHY_LIGHT],
                monst.loc.x, monst.loc.y, false, true, ctx,
            );
        }
    }

    // 6. Update display detail
    updateDisplayDetail(ctx);

    // 7. Paint miner's light
    paintLight(
        ctx.rogue.minersLight,
        ctx.player.loc.x, ctx.player.loc.y,
        true, true, ctx,
    );

    // 8. Update player foreground color
    if (ctx.player.status[StatusEffect.Invisible]) {
        ctx.player.info.foreColor = { ...playerInvisibleColor };
    } else if (playerInDarkness(ctx.tmap, ctx.player.loc)) {
        ctx.player.info.foreColor = { ...playerInDarknessColor };
    } else if (ctx.pmap[ctx.player.loc.x][ctx.player.loc.y].flags & TileFlag.IS_IN_SHADOW) {
        ctx.player.info.foreColor = { ...playerInShadowColor };
    } else {
        ctx.player.info.foreColor = { ...playerInLightColor };
    }
}
