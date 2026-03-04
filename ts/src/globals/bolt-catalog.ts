/*
 *  bolt-catalog.ts — boltCatalog, ported from GlobalsBrogue.c
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Bolt, Color } from "../types/types.js";
import { DisplayGlyph, BoltEffect, BoltType, DungeonFeatureType } from "../types/enums.js";
import { BoltFlag, MonsterBehaviorFlag } from "../types/flags.js";
import * as Colors from "./colors.js";

// =============================================================================
// Bolt-specific colors not in colors.ts (from GlobalsBrogue.c)
// =============================================================================

const dominationColor: Color = Object.freeze({
    red: 0, green: 0, blue: 100,
    redRand: 80, greenRand: 25, blueRand: 0,
    rand: 0, colorDances: true,
});

const empowermentColor: Color = Object.freeze({
    red: 30, green: 100, blue: 40,
    redRand: 25, greenRand: 80, blueRand: 25,
    rand: 0, colorDances: true,
});

const shieldingColor: Color = Object.freeze({
    red: 150, green: 75, blue: 0,
    redRand: 0, greenRand: 50, blueRand: 175,
    rand: 0, colorDances: true,
});

const dragonFireColor: Color = Object.freeze({
    red: 500, green: 150, blue: 0,
    redRand: 45, greenRand: 30, blueRand: 45,
    rand: 0, colorDances: true,
});

// =============================================================================
// Bolt catalog — indexed by BoltType enum
// Ported from boltCatalog_Brogue[] in GlobalsBrogue.c
// =============================================================================

/**
 * The master bolt catalog. Indexed by the BoltType enum.
 * BoltType.NONE (0) is a zero-entry placeholder.
 */
export const boltCatalog: Bolt[] = [];

// BOLT_NONE (index 0) — placeholder
boltCatalog[BoltType.NONE] = {
    name: "",
    description: "",
    abilityDescription: "",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: null,
    boltEffect: BoltEffect.None,
    magnitude: 0,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: 0,
};

// BOLT_TELEPORT (index 1)
boltCatalog[BoltType.TELEPORT] = {
    name: "teleportation spell",
    description: "casts a teleport spell",
    abilityDescription: "can teleport other creatures",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.blue,
    boltEffect: BoltEffect.Teleport,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMOBILE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_SLOW (index 2)
boltCatalog[BoltType.SLOW] = {
    name: "slowing spell",
    description: "casts a slowing spell",
    abilityDescription: "can slow $HISHER enemies",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.green,
    boltEffect: BoltEffect.Slow,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_POLYMORPH (index 3)
boltCatalog[BoltType.POLYMORPH] = {
    name: "polymorph spell",
    description: "casts a polymorphism spell",
    abilityDescription: "can polymorph other creatures",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.purple,
    boltEffect: BoltEffect.Polymorph,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_NEGATION (index 4)
boltCatalog[BoltType.NEGATION] = {
    name: "negation magic",
    description: "casts a negation spell",
    abilityDescription: "can cast negation",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.pink,
    boltEffect: BoltEffect.Negation,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_DOMINATION (index 5)
boltCatalog[BoltType.DOMINATION] = {
    name: "domination spell",
    description: "casts a domination spell",
    abilityDescription: "can dominate other creatures",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: dominationColor,
    boltEffect: BoltEffect.Domination,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_BECKONING (index 6)
boltCatalog[BoltType.BECKONING] = {
    name: "beckoning spell",
    description: "casts a beckoning spell",
    abilityDescription: "can cast beckoning",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.beckonColor,
    boltEffect: BoltEffect.Beckoning,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMOBILE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_PLENTY (index 7)
boltCatalog[BoltType.PLENTY] = {
    name: "spell of plenty",
    description: "casts a spell of plenty",
    abilityDescription: "can duplicate other creatures",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.rainbow,
    boltEffect: BoltEffect.Plenty,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ALLIES | BoltFlag.BF_NOT_LEARNABLE,
};

// BOLT_INVISIBILITY (index 8)
boltCatalog[BoltType.INVISIBILITY] = {
    name: "invisibility magic",
    description: "casts invisibility magic",
    abilityDescription: "can turn creatures invisible",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.darkBlue,
    boltEffect: BoltEffect.Invisibility,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ALLIES,
};

// BOLT_EMPOWERMENT (index 9)
boltCatalog[BoltType.EMPOWERMENT] = {
    name: "empowerment sorcery",
    description: "casts empowerment",
    abilityDescription: "can cast empowerment",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: empowermentColor,
    boltEffect: BoltEffect.Empowerment,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ALLIES | BoltFlag.BF_NOT_LEARNABLE,
};

// BOLT_LIGHTNING (index 10)
boltCatalog[BoltType.LIGHTNING] = {
    name: "lightning",
    description: "casts lightning",
    abilityDescription: "can hurl lightning bolts",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.lightningColor,
    boltEffect: BoltEffect.Damage,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_PASSES_THRU_CREATURES | BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_ELECTRIC,
};

// BOLT_FIRE (index 11)
boltCatalog[BoltType.FIRE] = {
    name: "flame",
    description: "casts a gout of flame",
    abilityDescription: "can hurl gouts of flame",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.fireBoltColor,
    boltEffect: BoltEffect.Damage,
    magnitude: 4,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_FIERY,
};

// BOLT_POISON (index 12)
boltCatalog[BoltType.POISON] = {
    name: "poison ray",
    description: "casts a poison ray",
    abilityDescription: "can cast poisonous bolts",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.poisonColor,
    boltEffect: BoltEffect.Poison,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_TUNNELING (index 13)
boltCatalog[BoltType.TUNNELING] = {
    name: "tunneling magic",
    description: "casts tunneling",
    abilityDescription: "can tunnel",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.brown,
    boltEffect: BoltEffect.Tunneling,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_PASSES_THRU_CREATURES,
};

// BOLT_BLINKING (index 14)
boltCatalog[BoltType.BLINKING] = {
    name: "blink trajectory",
    description: "blinks",
    abilityDescription: "can blink",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.white,
    boltEffect: BoltEffect.Blinking,
    magnitude: 5,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_HALTS_BEFORE_OBSTRUCTION,
};

// BOLT_ENTRANCEMENT (index 15)
boltCatalog[BoltType.ENTRANCEMENT] = {
    name: "entrancement ray",
    description: "casts entrancement",
    abilityDescription: "can cast entrancement",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.yellow,
    boltEffect: BoltEffect.Entrancement,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_OBSTRUCTION (index 16)
boltCatalog[BoltType.OBSTRUCTION] = {
    name: "obstruction magic",
    description: "casts obstruction",
    abilityDescription: "can cast obstruction",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.forceFieldColor,
    boltEffect: BoltEffect.Obstruction,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_HALTS_BEFORE_OBSTRUCTION,
};

// BOLT_DISCORD (index 17)
boltCatalog[BoltType.DISCORD] = {
    name: "spell of discord",
    description: "casts a spell of discord",
    abilityDescription: "can cast discord",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.discordColor,
    boltEffect: BoltEffect.Discord,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_CONJURATION (index 18)
boltCatalog[BoltType.CONJURATION] = {
    name: "conjuration magic",
    description: "casts a conjuration bolt",
    abilityDescription: "can cast conjuration",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.spectralBladeColor,
    boltEffect: BoltEffect.Conjuration,
    magnitude: 10,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS,
    flags: BoltFlag.BF_HALTS_BEFORE_OBSTRUCTION | BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_HEALING (index 19)
boltCatalog[BoltType.HEALING] = {
    name: "healing magic",
    description: "casts healing",
    abilityDescription: "can heal $HISHER allies",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.darkRed,
    boltEffect: BoltEffect.Healing,
    magnitude: 5,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_TARGET_ALLIES,
};

// BOLT_HASTE (index 20)
boltCatalog[BoltType.HASTE] = {
    name: "haste spell",
    description: "casts a haste spell",
    abilityDescription: "can haste $HISHER allies",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.orange,
    boltEffect: BoltEffect.Haste,
    magnitude: 2,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ALLIES,
};

// BOLT_SLOW_2 (index 21)
boltCatalog[BoltType.SLOW_2] = {
    name: "slowing spell",
    description: "casts a slowing spell",
    abilityDescription: "can slow $HISHER enemies",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.green,
    boltEffect: BoltEffect.Slow,
    magnitude: 2,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ENEMIES,
};

// BOLT_SHIELDING (index 22)
boltCatalog[BoltType.SHIELDING] = {
    name: "protection magic",
    description: "casts protection",
    abilityDescription: "can cast protection",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: shieldingColor,
    boltEffect: BoltEffect.Shielding,
    magnitude: 5,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE,
    flags: BoltFlag.BF_TARGET_ALLIES,
};

// BOLT_SPIDERWEB (index 23)
boltCatalog[BoltType.SPIDERWEB] = {
    name: "spiderweb",
    description: "launches a sticky web",
    abilityDescription: "can launch sticky webs",
    theChar: "*".charCodeAt(0) as DisplayGlyph,
    foreColor: Colors.white,
    backColor: null,
    boltEffect: BoltEffect.None,
    magnitude: 10,
    pathDF: DungeonFeatureType.DF_WEB_SMALL,
    targetDF: DungeonFeatureType.DF_WEB_LARGE,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMOBILE | MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_NEVER_REFLECTS | BoltFlag.BF_NOT_LEARNABLE,
};

// BOLT_SPARK (index 24)
boltCatalog[BoltType.SPARK] = {
    name: "spark",
    description: "shoots a spark",
    abilityDescription: "can throw sparks of lightning",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: Colors.lightningColor,
    boltEffect: BoltEffect.Damage,
    magnitude: 1,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_PASSES_THRU_CREATURES | BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_ELECTRIC,
};

// BOLT_DRAGONFIRE (index 25)
boltCatalog[BoltType.DRAGONFIRE] = {
    name: "dragonfire",
    description: "breathes a gout of white-hot flame",
    abilityDescription: "can breathe gouts of white-hot flame",
    theChar: 0 as DisplayGlyph,
    foreColor: null,
    backColor: dragonFireColor,
    boltEffect: BoltEffect.Damage,
    magnitude: 18,
    pathDF: DungeonFeatureType.DF_OBSIDIAN,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_FIERY | BoltFlag.BF_NOT_LEARNABLE,
};

// BOLT_DISTANCE_ATTACK (index 26) — arrow
boltCatalog[BoltType.DISTANCE_ATTACK] = {
    name: "arrow",
    description: "shoots an arrow",
    abilityDescription: "attacks from a distance",
    theChar: DisplayGlyph.G_WEAPON,
    foreColor: Colors.gray,
    backColor: null,
    boltEffect: BoltEffect.Attack,
    magnitude: 1,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_NEVER_REFLECTS | BoltFlag.BF_NOT_LEARNABLE,
};

// BOLT_POISON_DART (index 27)
boltCatalog[BoltType.POISON_DART] = {
    name: "poisoned dart",
    description: "fires a dart",
    abilityDescription: "fires strength-sapping darts",
    theChar: DisplayGlyph.G_WEAPON,
    foreColor: Colors.centipedeColor,
    backColor: null,
    boltEffect: BoltEffect.Attack,
    magnitude: 1,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: 0,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_NEVER_REFLECTS | BoltFlag.BF_NOT_LEARNABLE,
};

// BOLT_ANCIENT_SPIRIT_VINES (index 28) — growing vines
boltCatalog[BoltType.ANCIENT_SPIRIT_VINES] = {
    name: "growing vines",
    description: "releases carnivorous vines into the ground",
    abilityDescription: "conjures carnivorous vines",
    theChar: DisplayGlyph.G_GRASS,
    foreColor: Colors.tanColor,
    backColor: null,
    boltEffect: BoltEffect.None,
    magnitude: 5,
    pathDF: DungeonFeatureType.DF_ANCIENT_SPIRIT_GRASS,
    targetDF: DungeonFeatureType.DF_ANCIENT_SPIRIT_VINES,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_NEVER_REFLECTS,
};

// BOLT_WHIP (index 29)
boltCatalog[BoltType.WHIP] = {
    name: "whip",
    description: "whips",
    abilityDescription: "wields a whip",
    theChar: "*".charCodeAt(0) as DisplayGlyph,
    foreColor: Colors.tanColor,
    backColor: null,
    boltEffect: BoltEffect.Attack,
    magnitude: 1,
    pathDF: 0,
    targetDF: 0,
    forbiddenMonsterFlags: MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS,
    flags: BoltFlag.BF_TARGET_ENEMIES | BoltFlag.BF_NEVER_REFLECTS | BoltFlag.BF_NOT_LEARNABLE | BoltFlag.BF_DISPLAY_CHAR_ALONG_LENGTH,
};
