/*
 *  light-catalog.ts — lightCatalog, ported from Globals.c
 *  brogue-ts
 */

import type { LightSource } from "../types/types.js";
import type { Color } from "../types/types.js";
import { DCOLS } from "../types/constants.js";
import * as C from "./colors.js";

const NO_COLOR: Color = { red: 0, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false };

/**
 * Light source catalog. Each entry defines a light source's color, radius,
 * fade percentage, and creature pass-through behavior.
 * Indexed by LightType enum.
 */
export const lightCatalog: readonly LightSource[] = [
    // NO_LIGHT
    { lightColor: NO_COLOR, lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // miners light
    { lightColor: C.minersLightColor, lightRadius: { lowerBound: 0, upperBound: 0, clumpFactor: 1 }, radialFadeToPercent: 35, passThroughCreatures: true },
    // burning creature light
    { lightColor: C.fireBoltColor, lightRadius: { lowerBound: 300, upperBound: 400, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // will-o'-the-wisp light
    { lightColor: C.wispLightColor, lightRadius: { lowerBound: 400, upperBound: 800, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // salamander glow
    { lightColor: C.fireBoltColor, lightRadius: { lowerBound: 300, upperBound: 400, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // imp light
    { lightColor: C.pink, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // pixie light
    { lightColor: C.pixieColor, lightRadius: { lowerBound: 400, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // lich light
    { lightColor: C.lichLightColor, lightRadius: { lowerBound: 1500, upperBound: 1500, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // flamedancer light
    { lightColor: C.flamedancerCoronaColor, lightRadius: { lowerBound: 1000, upperBound: 2000, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // sentinel light
    { lightColor: C.sentinelLightColor, lightRadius: { lowerBound: 300, upperBound: 500, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // unicorn light
    { lightColor: C.unicornLightColor, lightRadius: { lowerBound: 300, upperBound: 400, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // ifrit light
    { lightColor: C.ifritLightColor, lightRadius: { lowerBound: 300, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // phoenix light
    { lightColor: C.fireBoltColor, lightRadius: { lowerBound: 400, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // phoenix egg light
    { lightColor: C.fireBoltColor, lightRadius: { lowerBound: 150, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // Yendorian light
    { lightColor: C.yendorLightColor, lightRadius: { lowerBound: 1500, upperBound: 1500, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // spectral blades
    { lightColor: C.spectralBladeLightColor, lightRadius: { lowerBound: 350, upperBound: 350, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // weapon images
    { lightColor: C.summonedImageLightColor, lightRadius: { lowerBound: 350, upperBound: 350, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // lightning turret light
    { lightColor: C.lightningColor, lightRadius: { lowerBound: 250, upperBound: 250, clumpFactor: 1 }, radialFadeToPercent: 35, passThroughCreatures: false },
    // explosive bloat light
    { lightColor: C.explosiveAuraColor, lightRadius: { lowerBound: 150, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // bolt glow
    { lightColor: C.lightningColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // telepathy light
    { lightColor: C.telepathyColor, lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // sacrifice doom light
    { lightColor: C.sacrificeTargetColor, lightRadius: { lowerBound: 250, upperBound: 250, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // flares:
    // scroll of protection flare
    { lightColor: C.scrollProtectionColor, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // scroll of enchantment flare
    { lightColor: C.scrollEnchantmentColor, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // potion of strength flare
    { lightColor: C.potionStrengthColor, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // empowerment flare
    { lightColor: C.empowermentFlashColor, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // generic flash flare
    { lightColor: C.genericFlashColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // fallen torch flare
    { lightColor: C.fireFlashColor, lightRadius: { lowerBound: 800, upperBound: 800, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // summoning flare
    { lightColor: C.summoningFlashColor, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // explosion (explosive bloat or incineration potion)
    { lightColor: C.explosionFlareColor, lightRadius: { lowerBound: 5000, upperBound: 5000, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // quietus activation flare
    { lightColor: C.quietusFlashColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // slaying activation flare
    { lightColor: C.slayingFlashColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // electric crystal activates
    { lightColor: C.lightningColor, lightRadius: { lowerBound: 800, upperBound: 800, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // glowing terrain:
    // torch
    { lightColor: C.torchLightColor, lightRadius: { lowerBound: 1000, upperBound: 1000, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // lava
    { lightColor: C.lavaLightColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // sunlight
    { lightColor: C.sunLightColor, lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 25, passThroughCreatures: true },
    // darkness patch
    { lightColor: C.darknessPatchColor, lightRadius: { lowerBound: 400, upperBound: 400, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // luminescent fungus
    { lightColor: C.fungusLightColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // luminescent forest
    { lightColor: C.fungusForestLightColor, lightRadius: { lowerBound: 500, upperBound: 500, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // luminescent algae blue
    { lightColor: C.algaeBlueLightColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // luminescent algae green
    { lightColor: C.algaeGreenLightColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // ectoplasm
    { lightColor: C.ectoplasmColor, lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // unicorn poop light
    { lightColor: C.unicornLightColor, lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // embers
    { lightColor: C.lavaLightColor, lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // fire
    { lightColor: C.lavaLightColor, lightRadius: { lowerBound: 500, upperBound: 1000, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // brimstone fire
    { lightColor: C.lavaLightColor, lightRadius: { lowerBound: 200, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // explosions
    { lightColor: C.explosionColor, lightRadius: { lowerBound: DCOLS*100, upperBound: DCOLS*100, clumpFactor: 1 }, radialFadeToPercent: 100, passThroughCreatures: false },
    // incendiary darts
    { lightColor: C.dartFlashColor, lightRadius: { lowerBound: 15*100, upperBound: 15*100, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // portal activation
    { lightColor: C.portalActivateLightColor, lightRadius: { lowerBound: DCOLS*100, upperBound: DCOLS*100, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // confusion gas
    { lightColor: C.confusionLightColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 100, passThroughCreatures: false },
    // darkness cloud
    { lightColor: C.darknessCloudColor, lightRadius: { lowerBound: 500, upperBound: 500, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // forcefield
    { lightColor: C.forceFieldLightColor, lightRadius: { lowerBound: 200, upperBound: 200, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // crystal wall
    { lightColor: C.crystalWallLightColor, lightRadius: { lowerBound: 300, upperBound: 500, clumpFactor: 1 }, radialFadeToPercent: 50, passThroughCreatures: false },
    // candle light
    { lightColor: C.torchLightColor, lightRadius: { lowerBound: 200, upperBound: 400, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // haunted torch
    { lightColor: C.hauntedTorchColor, lightRadius: { lowerBound: 400, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // glyph dim light
    { lightColor: C.glyphLightColor, lightRadius: { lowerBound: 100, upperBound: 100, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // glyph bright light
    { lightColor: C.glyphLightColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // sacred glyph light
    { lightColor: C.sacredGlyphColor, lightRadius: { lowerBound: 300, upperBound: 300, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // magical pit light
    { lightColor: C.descentLightColor, lightRadius: { lowerBound: 600, upperBound: 600, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: false },
    // demonic statue light
    { lightColor: C.sacrificeTargetColor, lightRadius: { lowerBound: 800, upperBound: 1200, clumpFactor: 1 }, radialFadeToPercent: 0, passThroughCreatures: true },
    // UNPARSED: };
];

