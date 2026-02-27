/*
 *  colors.ts — All named color constants from GlobalsBase.c and Globals.c
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color } from "../types/types.js";

/** Helper to create a frozen Color literal. */
function c(
    red: number, green: number, blue: number,
    redRand: number, greenRand: number, blueRand: number,
    rand: number, colorDances: boolean,
): Color {
    return Object.freeze({ red, green, blue, redRand, greenRand, blueRand, rand, colorDances });
}

// =============================================================================
// Basic colors  (from GlobalsBase.c)
// =============================================================================

export const white                  = c(100,  100,   100,   0,    0,     0,     0,   false);
export const gray                   = c(50,   50,    50,    0,    0,     0,     0,   false);
export const darkGray               = c(30,   30,    30,    0,    0,     0,     0,   false);
export const veryDarkGray           = c(15,   15,    15,    0,    0,     0,     0,   false);
export const black                  = c(0,    0,     0,     0,    0,     0,     0,   false);
export const yellow                 = c(100,  100,   0,     0,    0,     0,     0,   false);
export const darkYellow             = c(50,   50,    0,     0,    0,     0,     0,   false);
export const teal                   = c(30,   100,   100,   0,    0,     0,     0,   false);
export const purple                 = c(100,  0,     100,   0,    0,     0,     0,   false);
export const darkPurple             = c(50,   0,     50,    0,    0,     0,     0,   false);
export const brown                  = c(60,   40,    0,     0,    0,     0,     0,   false);
export const green                  = c(0,    100,   0,     0,    0,     0,     0,   false);
export const darkGreen              = c(0,    50,    0,     0,    0,     0,     0,   false);
export const orange                 = c(100,  50,    0,     0,    0,     0,     0,   false);
export const darkOrange             = c(50,   25,    0,     0,    0,     0,     0,   false);
export const blue                   = c(0,    0,     100,   0,    0,     0,     0,   false);
export const darkBlue               = c(0,    0,     50,    0,    0,     0,     0,   false);
export const darkTurquoise          = c(0,    40,    65,    0,    0,     0,     0,   false);
export const lightBlue              = c(40,   40,    100,   0,    0,     0,     0,   false);
export const pink                   = c(100,  60,    66,    0,    0,     0,     0,   false);
export const darkPink               = c(50,   30,    33,    0,    0,     0,     0,   false);
export const red                    = c(100,  0,     0,     0,    0,     0,     0,   false);
export const darkRed                = c(50,   0,     0,     0,    0,     0,     0,   false);
export const tanColor               = c(80,   67,    15,    0,    0,     0,     0,   false);

// tile colors (GlobalsBase.c)
export const rainbow                = c(-70,  -70,   -70,   170,  170,   170,   0,   true);

// =============================================================================
// Bolt colors  (from Globals.c)
// =============================================================================

export const descentBoltColor       = c(-40,  -40,   -40,   0,    0,     80,    80,  true);
export const discordColor           = c(25,   0,     25,    66,   0,     0,     0,   true);
export const poisonColor            = c(0,    0,     0,     10,   50,    10,    0,   true);
export const beckonColor            = c(10,   10,    10,    5,    5,     5,     50,  true);
export const invulnerabilityColor   = c(25,   0,     25,    0,    0,     66,    0,   true);
export const fireBoltColor          = c(500,  150,   0,     45,   30,    0,     0,   true);
export const yendorLightColor       = c(50,   -100,  30,    0,    0,     0,     0,   true);
export const flamedancerCoronaColor = c(500,  150,   100,   45,   30,    0,     0,   true);

// =============================================================================
// Tile colors  (from Globals.c)
// =============================================================================

export const undiscoveredColor      = c(0,    0,     0,     0,    0,     0,     0,   false);

export const wallForeColor          = c(7,    7,     7,     3,    3,     3,     0,   false);
export const wallBackColorStart     = c(45,   40,    40,    15,   0,     5,     20,  false);
export const wallBackColorEnd       = c(40,   30,    35,    0,    20,    30,    20,  false);

export const mudWallForeColor       = c(55,   45,    0,     5,    5,     5,     1,   false);
export const mudWallBackColor       = c(20,   12,    3,     8,    4,     3,     0,   false);

export const graniteBackColor       = c(10,   10,    10,    0,    0,     0,     0,   false);

export const floorForeColor         = c(30,   30,    30,    0,    0,     0,     35,  false);

export const floorBackColorStart    = c(2,    2,     10,    2,    2,     0,     0,   false);
export const floorBackColorEnd      = c(5,    5,     5,     2,    2,     0,     0,   false);

export const stairsBackColor        = c(15,   15,    5,     0,    0,     0,     0,   false);
export const firstStairsBackColor   = c(10,   10,    25,    0,    0,     0,     0,   false);

export const refuseBackColor        = c(6,    5,     3,     2,    2,     0,     0,   false);
export const rubbleBackColor        = c(7,    7,     8,     2,    2,     1,     0,   false);
export const bloodflowerForeColor   = c(30,   5,     40,    5,    1,     3,     0,   false);
export const bloodflowerPodForeColor = c(50,  5,     25,    5,    1,     3,     0,   false);
export const bloodflowerBackColor   = c(15,   3,     10,    3,    1,     3,     0,   false);
export const bedrollBackColor       = c(10,   8,     5,     1,    1,     0,     0,   false);

export const obsidianBackColor      = c(6,    0,     8,     2,    0,     3,     0,   false);
export const carpetForeColor        = c(23,   30,    38,    0,    0,     0,     0,   false);
export const carpetBackColor        = c(15,   8,     5,     0,    0,     0,     0,   false);
export const marbleForeColor        = c(30,   23,    38,    0,    0,     0,     0,   false);
export const marbleBackColor        = c(6,    5,     13,    1,    0,     1,     0,   false);
export const doorForeColor          = c(70,   35,    15,    0,    0,     0,     0,   false);
export const doorBackColor          = c(30,   10,    5,     0,    0,     0,     0,   false);
export const ironDoorForeColor      = c(500,  500,   500,   0,    0,     0,     0,   false);
export const ironDoorBackColor      = c(15,   15,    30,    0,    0,     0,     0,   false);
export const bridgeFrontColor       = c(33,   12,    12,    12,   7,     2,     0,   false);
export const bridgeBackColor        = c(12,   3,     2,     3,    2,     1,     0,   false);
export const statueBackColor        = c(20,   20,    20,    0,    0,     0,     0,   false);
export const glyphColor             = c(20,   5,     5,     50,   0,     0,     0,   true);
export const glyphLightColor        = c(150,  0,     0,     150,  0,     0,     0,   true);
export const sacredGlyphColor       = c(5,    20,    5,     0,    50,    0,     0,   true);
export const sacredGlyphLightColor  = c(45,   150,   60,    25,   80,    25,    0,   true);

export const minersLightStartColor  = c(180,  180,   180,   0,    0,     0,     0,   false);
export const minersLightEndColor    = c(90,   90,    120,   0,    0,     0,     0,   false);
export const torchColor             = c(150,  75,    30,    0,    30,    20,    0,   true);

export const deepWaterForeColor     = c(5,    8,     20,    0,    4,     15,    10,  true);
export const deepWaterBackColorStart = c(5,   10,    31,    5,    5,     5,     6,   true);
export const deepWaterBackColorEnd  = c(5,    8,     20,    2,    3,     5,     5,   true);
export const shallowWaterForeColor  = c(28,   28,    60,    0,    0,     10,    10,  true);
export const shallowWaterBackColorStart = c(20, 20,  60,    0,    0,     10,    10,  true);
export const shallowWaterBackColorEnd = c(12,  15,   40,    0,    0,     5,     5,   true);

export const mudForeColor           = c(18,   14,    5,     5,    5,     0,     0,   false);
export const mudBackColor           = c(23,   17,    7,     5,    5,     0,     0,   false);
export const chasmForeColor         = c(7,    7,     15,    4,    4,     8,     0,   false);
export const chasmEdgeBackColorStart = c(5,   5,     25,    2,    2,     2,     0,   false);
export const chasmEdgeBackColorEnd  = c(8,    8,     20,    2,    2,     2,     0,   false);
export const fireForeColor          = c(70,   20,    0,     15,   10,    0,     0,   true);
export const lavaForeColor          = c(20,   20,    20,    100,  10,    0,     0,   true);
export const brimstoneForeColor     = c(100,  50,    10,    0,    50,    40,    0,   true);
export const brimstoneBackColor     = c(18,   12,    9,     0,    0,     5,     0,   false);

export const lavaBackColor          = c(70,   20,    0,     15,   10,    0,     0,   true);
export const acidBackColor          = c(15,   80,    25,    5,    15,    10,    0,   true);

export const lightningColor         = c(100,  150,   500,   50,   50,    0,     50,  true);
export const fungusLightColor       = c(2,    11,    11,    4,    3,     3,     0,   true);
export const lavaLightColor         = c(47,   13,    0,     10,   7,     0,     0,   true);
export const deepWaterLightColor    = c(10,   30,    100,   0,    30,    100,   0,   true);

export const grassColor             = c(15,   40,    15,    15,   50,    15,    10,  false);
export const deadGrassColor         = c(20,   13,    0,     20,   10,    5,     10,  false);
export const fungusColor            = c(15,   50,    50,    0,    25,    0,     30,  true);
export const grayFungusColor        = c(30,   30,    30,    5,    5,     5,     10,  false);
export const foliageColor           = c(25,   100,   25,    15,   0,     15,    0,   false);
export const deadFoliageColor       = c(20,   13,    0,     30,   15,    0,     20,  false);
export const lichenColor            = c(50,   5,     25,    10,   0,     5,     0,   true);
export const hayColor               = c(70,   55,    5,     0,    20,    20,    0,   false);
export const ashForeColor           = c(20,   20,    20,    0,    0,     0,     20,  false);
export const bonesForeColor         = c(80,   80,    30,    5,    5,     35,    5,   false);
export const ectoplasmColor         = c(45,   20,    55,    25,   0,     25,    5,   false);
export const forceFieldColor        = c(0,    25,    25,    0,    25,    25,    0,   true);
export const wallCrystalColor       = c(40,   40,    60,    20,   20,    40,    0,   true);
export const altarForeColor         = c(5,    7,     9,     0,    0,     0,     0,   false);
export const altarBackColor         = c(35,   18,    18,    0,    0,     0,     0,   false);
export const greenAltarBackColor    = c(18,   25,    18,    0,    0,     0,     0,   false);
export const goldAltarBackColor     = c(25,   24,    12,    0,    0,     0,     0,   false);
export const pedestalBackColor      = c(10,   5,     20,    0,    0,     0,     0,   false);

// =============================================================================
// Monster colors  (from Globals.c)
// =============================================================================

export const goblinColor            = c(44,   33,    22,    0,    0,     0,     0,   false);
export const jackalColor            = c(60,   42,    27,    0,    0,     0,     0,   false);
export const ogreColor              = c(60,   25,    25,    0,    0,     0,     0,   false);
export const eelColor               = c(30,   12,    12,    0,    0,     0,     0,   false);
export const goblinConjurerColor    = c(67,   10,    100,   0,    0,     0,     0,   false);
export const spectralBladeColor     = c(15,   15,    60,    0,    0,     70,    50,  true);
export const spectralImageColor     = c(13,   0,     0,     25,   0,     0,     0,   true);
export const toadColor              = c(40,   65,    30,    0,    0,     0,     0,   false);
export const trollColor             = c(40,   60,    15,    0,    0,     0,     0,   false);
export const centipedeColor         = c(75,   25,    85,    0,    0,     0,     0,   false);
export const dragonColor            = c(20,   80,    15,    0,    0,     0,     0,   false);
export const krakenColor            = c(100,  55,    55,    0,    0,     0,     0,   false);
export const salamanderColor        = c(40,   10,    0,     8,    5,     0,     0,   true);
export const pixieColor             = c(60,   60,    60,    40,   40,    40,    0,   true);
export const darPriestessColor      = c(0,    50,    50,    0,    0,     0,     0,   false);
export const darMageColor           = c(50,   50,    0,     0,    0,     0,     0,   false);
export const wraithColor            = c(66,   66,    25,    0,    0,     0,     0,   false);
export const pinkJellyColor         = c(100,  40,    40,    5,    5,     5,     20,  true);
export const wormColor              = c(80,   60,    40,    0,    0,     0,     0,   false);
export const sentinelColor          = c(3,    3,     30,    0,    0,     10,    0,   true);
export const goblinMysticColor      = c(10,   67,    100,   0,    0,     0,     0,   false);
export const ifritColor             = c(50,   10,    100,   75,   0,     20,    0,   true);
export const phoenixColor           = c(100,  0,     0,     0,    100,   0,     0,   true);

// =============================================================================
// Light colors  (from Globals.c)
// =============================================================================

export const torchLightColor        = c(75,   38,    15,    0,    15,    7,     0,   true);
export const hauntedTorchColor      = c(75,   20,    40,    30,   10,    0,     0,   true);
export const hauntedTorchLightColor = c(67,   10,    10,    20,   4,     0,     0,   true);
export const ifritLightColor        = c(0,    10,    150,   100,  0,     100,   0,   true);
export const unicornLightColor      = c(-50,  -50,   -50,   250,  250,   250,   0,   true);
export const wispLightColor         = c(75,   100,   250,   33,   10,    0,     0,   true);
export const summonedImageLightColor = c(200, 0,     75,    0,    0,     0,     0,   true);
export const spectralBladeLightColor = c(40,  0,     230,   0,    0,     0,     0,   true);
export const ectoplasmLightColor    = c(23,   10,    28,    13,   0,     13,    3,   false);
export const explosionColor         = c(10,   8,     2,     0,    2,     2,     0,   true);
export const explosiveAuraColor     = c(2000, 0,     -1000, 200,  200,   0,     0,   true);
export const sacrificeTargetColor   = c(100,  -100,  -300,  0,    100,   100,   0,   true);
export const dartFlashColor         = c(500,  500,   500,   0,    2,     2,     0,   true);
export const lichLightColor         = c(-50,  80,    30,    0,    0,     20,    0,   true);
export const forceFieldLightColor   = c(10,   10,    10,    0,    50,    50,    0,   true);
export const crystalWallLightColor  = c(10,   10,    10,    0,    0,     50,    0,   true);
export const sunLightColor          = c(100,  100,   75,    0,    0,     0,     0,   false);
export const fungusForestLightColor = c(30,   40,    60,    0,    0,     0,     40,  true);
export const fungusTrampledLightColor = c(10, 10,    10,    0,    50,    50,    0,   true);
export const redFlashColor          = c(100,  10,    10,    0,    0,     0,     0,   false);
export const darknessPatchColor     = c(-10,  -10,   -10,   0,    0,     0,     0,   false);
export const darknessCloudColor     = c(-20,  -20,   -20,   0,    0,     0,     0,   false);
export const magicMapFlashColor     = c(60,   20,    60,    0,    0,     0,     0,   false);
export const sentinelLightColor     = c(20,   20,    120,   10,   10,    60,    0,   true);
export const telepathyColor         = c(30,   30,    130,   0,    0,     0,     0,   false);
export const confusionLightColor    = c(10,   10,    10,    10,   10,    10,    0,   true);
export const portalActivateLightColor = c(300, 400,  500,   0,    0,     0,     0,   true);
export const descentLightColor      = c(20,   20,    70,    0,    0,     0,     0,   false);
export const algaeBlueLightColor    = c(20,   15,    50,    0,    0,     0,     0,   false);
export const algaeGreenLightColor   = c(15,   50,    20,    0,    0,     0,     0,   false);

// =============================================================================
// Flare colors  (from Globals.c)
// =============================================================================

export const scrollProtectionColor  = c(375,  750,   0,     0,    0,     0,     0,   true);
export const scrollEnchantmentColor = c(250,  225,   300,   0,    0,     450,   0,   true);
export const potionStrengthColor    = c(1000, 0,     400,   600,  0,     0,     0,   true);
export const empowermentFlashColor  = c(500,  1000,  600,   0,    500,   0,     0,   true);
export const genericFlashColor      = c(800,  800,   800,   0,    0,     0,     0,   false);
export const summoningFlashColor    = c(0,    0,     0,     600,  0,     1200,  0,   true);
export const fireFlashColor         = c(750,  225,   0,     100,  50,    0,     0,   true);
export const explosionFlareColor    = c(10000, 6000, 1000,  0,    0,     0,     0,   false);
export const quietusFlashColor      = c(0,    -1000, -200,  0,    0,     0,     0,   true);
export const slayingFlashColor      = c(-1000, -200, 0,     0,    0,     0,     0,   true);

// =============================================================================
// Color multipliers  (from Globals.c)
// =============================================================================

export const colorDim25             = c(25,   25,    25,    25,   25,    25,    25,  false);
export const colorMultiplier100     = c(100,  100,   100,   100,  100,   100,   100, false);
export const memoryColor            = c(25,   25,    50,    20,   20,    20,    0,   false);
export const memoryOverlay          = c(25,   25,    50,    0,    0,     0,     0,   false);
export const magicMapColor          = c(60,   20,    60,    60,   20,    60,    0,   false);
export const clairvoyanceColor      = c(50,   90,    50,    50,   90,    50,    66,  false);
export const telepathyMultiplier    = c(30,   30,    130,   30,   30,    130,   66,  false);
export const omniscienceColor       = c(140,  100,   60,    140,  100,   60,    90,  false);
export const basicLightColor        = c(180,  180,   180,   180,  180,   180,   180, false);

// =============================================================================
// Blood colors  (from Globals.c)
// =============================================================================

export const humanBloodColor        = c(60,   20,    10,    15,   0,     0,     15,  false);
export const insectBloodColor       = c(10,   60,    20,    0,    15,    0,     15,  false);
export const vomitColor             = c(60,   50,    5,     0,    15,    15,    0,   false);
export const urineColor             = c(70,   70,    40,    0,    0,     0,     10,  false);
export const methaneColor           = c(45,   60,    15,    0,    0,     0,     0,   false);

// =============================================================================
// Gas colors  (from Globals.c)
// =============================================================================

export const poisonGasColor         = c(75,   25,    85,    0,    0,     0,     0,   false);
export const confusionGasColor      = c(60,   60,    60,    40,   40,    40,    0,   true);

// =============================================================================
// Interface colors  (from Globals.c)
// =============================================================================

export const itemColor              = c(100,  95,    -30,   0,    0,     0,     0,   false);
export const blueBar                = c(15,   10,    50,    0,    0,     0,     0,   false);
export const redBar                 = c(45,   10,    15,    0,    0,     0,     0,   false);
export const hiliteColor            = c(100,  100,   0,     0,    0,     0,     0,   false);
export const interfaceBoxColor      = c(7,    6,     15,    0,    0,     0,     0,   false);
export const interfaceButtonColor   = c(18,   15,    38,    0,    0,     0,     0,   false);
export const buttonHoverColor       = c(100,  70,    40,    0,    0,     0,     0,   false);
export const titleButtonColor       = c(23,   15,    30,    0,    0,     0,     0,   false);

export const playerInvisibleColor   = c(30,   30,    40,    0,    0,     80,    0,   true);
export const playerInLightColor     = c(100,  90,    30,    0,    0,     0,     0,   false);
export const playerInShadowColor    = c(60,   60,    100,   0,    0,     0,     0,   false);
export const playerInDarknessColor  = c(40,   40,    65,    0,    0,     0,     0,   false);

export const inLightMultiplierColor = c(150,  150,   75,    150,  150,   75,    100, true);
export const inDarknessMultiplierColor = c(66, 66,   120,   66,   66,    120,   66,  true);

// =============================================================================
// Message colors  (from Globals.c)
// =============================================================================

export const goodMessageColor       = c(60,   50,    100,   0,    0,     0,     0,   false);
export const badMessageColor        = c(100,  50,    60,    0,    0,     0,     0,   false);
export const advancementMessageColor = c(50,  100,   60,    0,    0,     0,     0,   false);
export const itemMessageColor       = c(100,  100,   50,    0,    0,     0,     0,   false);
export const flavorTextColor        = c(50,   40,    90,    0,    0,     0,     0,   false);
export const backgroundMessageColor = c(60,   20,    70,    0,    0,     0,     0,   false);

export const superVictoryColor      = c(150,  100,   300,   0,    0,     0,     0,   false);

// =============================================================================
// Flame colors  (from Globals.c)
// =============================================================================

export const flameSourceColor       = c(20,   7,     7,     60,   40,    40,    0,   true);
export const flameSourceColorSecondary = c(7,  2,    0,     10,   0,     0,     0,   true);
export const flameTitleColor        = c(0,    0,     0,     9,    9,     15,    0,   true);

// =============================================================================
// Dynamic colors — mutable globals that are computed at runtime by interpolating
// between *Start and *End color bounds. Initialized to the "start" values; the
// game loop will update them each turn. The tile catalog references these.
// =============================================================================

export let minersLightColor: Color  = { ...minersLightStartColor };
export let wallBackColor: Color     = { ...wallBackColorStart };
export let deepWaterBackColor: Color = { ...deepWaterBackColorStart };
export let shallowWaterBackColor: Color = { ...shallowWaterBackColorStart };
export let floorBackColor: Color    = { ...floorBackColorStart };
export let chasmEdgeBackColor: Color = { ...chasmEdgeBackColorStart };
