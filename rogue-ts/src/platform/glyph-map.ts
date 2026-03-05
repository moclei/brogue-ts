/*
 *  glyph-map.ts — Glyph-to-Unicode mapping and environment glyph classification
 *  brogue-ts
 *
 *  Ported from: src/platform/platformdependent.c (lines 44–222)
 *  Functions: glyphToUnicode, isEnvironmentGlyph
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { DisplayGlyph } from "../types/enums.js";

// =============================================================================
// Unicode code-point constants (from platform.h)
// =============================================================================

const U_MIDDLE_DOT          = 0x00B7;
const U_FOUR_DOTS           = 0x2237;
const U_DIAMOND             = 0x25C7;
const U_FLIPPED_V           = 0x22CF;
const U_ARIES               = 0x2648;
const U_ESZETT              = 0x00DF;
const U_ANKH                = 0x2640;
const U_MUSIC_NOTE          = 0x266A;
const U_CIRCLE              = 0x26AA;
const U_LIGHTNING_BOLT      = 0x03DF;
const U_FILLED_CIRCLE       = 0x25CF;
const U_NEUTER              = 0x26B2;
const U_U_ACUTE             = 0x00DA;
const U_CURRENCY            = 0x00A4;
const U_UP_ARROW            = 0x2191;
const U_DOWN_ARROW          = 0x2193;
const U_OMEGA               = 0x03A9;
const U_CIRCLE_BARS         = 0x29F2;
const U_FILLED_CIRCLE_BARS  = 0x29F3;
const U_LEFT_TRIANGLE       = 0x1F780;

// =============================================================================
// glyphToUnicode — map DisplayGlyph enum to Unicode code point
// =============================================================================

/**
 * Port of C `glyphToUnicode()`.
 *
 * Converts a DisplayGlyph value to its Unicode code point for text rendering.
 * Glyphs below 128 are returned as-is (ASCII).
 */
export function glyphToUnicode(glyph: DisplayGlyph): number {
    // ASCII range — pass through
    if ((glyph as number) < 128) return glyph as number;

    switch (glyph) {
        case DisplayGlyph.G_UP_ARROW:           return U_UP_ARROW;
        case DisplayGlyph.G_DOWN_ARROW:         return U_DOWN_ARROW;
        case DisplayGlyph.G_POTION:             return 0x21; // '!'
        case DisplayGlyph.G_GRASS:              return 0x22; // '"'
        case DisplayGlyph.G_WALL:               return 0x23; // '#'
        case DisplayGlyph.G_DEMON:              return 0x26; // '&'
        case DisplayGlyph.G_OPEN_DOOR:          return 0x27; // '\''
        case DisplayGlyph.G_GOLD:               return 0x2A; // '*'
        case DisplayGlyph.G_CLOSED_DOOR:        return 0x2B; // '+'
        case DisplayGlyph.G_RUBBLE:             return 0x2C; // ','
        case DisplayGlyph.G_KEY:                return 0x2D; // '-'
        case DisplayGlyph.G_BOG:                return 0x7E; // '~'
        case DisplayGlyph.G_CHAIN_TOP_LEFT:     return 0x5C; // '\\'
        case DisplayGlyph.G_CHAIN_BOTTOM_RIGHT: return 0x5C; // '\\'
        case DisplayGlyph.G_CHAIN_TOP_RIGHT:    return 0x2F; // '/'
        case DisplayGlyph.G_CHAIN_BOTTOM_LEFT:  return 0x2F; // '/'
        case DisplayGlyph.G_CHAIN_TOP:          return 0x7C; // '|'
        case DisplayGlyph.G_CHAIN_BOTTOM:       return 0x7C; // '|'
        case DisplayGlyph.G_CHAIN_LEFT:         return 0x2D; // '-'
        case DisplayGlyph.G_CHAIN_RIGHT:        return 0x2D; // '-'
        case DisplayGlyph.G_FOOD:               return 0x3B; // ';'
        case DisplayGlyph.G_UP_STAIRS:          return 0x3C; // '<'
        case DisplayGlyph.G_VENT:               return 0x3D; // '='
        case DisplayGlyph.G_DOWN_STAIRS:        return 0x3E; // '>'
        case DisplayGlyph.G_PLAYER:             return 0x40; // '@'
        case DisplayGlyph.G_BOG_MONSTER:        return 0x42; // 'B'
        case DisplayGlyph.G_CENTAUR:            return 0x43; // 'C'
        case DisplayGlyph.G_DRAGON:             return 0x44; // 'D'
        case DisplayGlyph.G_FLAMEDANCER:        return 0x46; // 'F'
        case DisplayGlyph.G_GOLEM:              return 0x47; // 'G'
        case DisplayGlyph.G_TENTACLE_HORROR:    return 0x48; // 'H'
        case DisplayGlyph.G_IFRIT:              return 0x49; // 'I'
        case DisplayGlyph.G_JELLY:              return 0x4A; // 'J'
        case DisplayGlyph.G_KRAKEN:             return 0x4B; // 'K'
        case DisplayGlyph.G_LICH:               return 0x4C; // 'L'
        case DisplayGlyph.G_NAGA:               return 0x4E; // 'N'
        case DisplayGlyph.G_OGRE:               return 0x4F; // 'O'
        case DisplayGlyph.G_PHANTOM:            return 0x50; // 'P'
        case DisplayGlyph.G_REVENANT:           return 0x52; // 'R'
        case DisplayGlyph.G_SALAMANDER:         return 0x53; // 'S'
        case DisplayGlyph.G_TROLL:              return 0x54; // 'T'
        case DisplayGlyph.G_UNDERWORM:          return 0x55; // 'U'
        case DisplayGlyph.G_VAMPIRE:            return 0x56; // 'V'
        case DisplayGlyph.G_WRAITH:             return 0x57; // 'W'
        case DisplayGlyph.G_ZOMBIE:             return 0x5A; // 'Z'
        case DisplayGlyph.G_ARMOR:              return 0x5B; // '['
        case DisplayGlyph.G_STAFF:              return 0x2F; // '/'
        case DisplayGlyph.G_WEB:                return 0x3A; // ':'
        case DisplayGlyph.G_MOUND:              return 0x61; // 'a'
        case DisplayGlyph.G_BLOAT:              return 0x62; // 'b'
        case DisplayGlyph.G_CENTIPEDE:          return 0x63; // 'c'
        case DisplayGlyph.G_DAR_BLADEMASTER:    return 0x64; // 'd'
        case DisplayGlyph.G_EEL:                return 0x65; // 'e'
        case DisplayGlyph.G_FURY:               return 0x66; // 'f'
        case DisplayGlyph.G_GOBLIN:             return 0x67; // 'g'
        case DisplayGlyph.G_IMP:                return 0x69; // 'i'
        case DisplayGlyph.G_JACKAL:             return 0x6A; // 'j'
        case DisplayGlyph.G_KOBOLD:             return 0x6B; // 'k'
        case DisplayGlyph.G_MONKEY:             return 0x6D; // 'm'
        case DisplayGlyph.G_PIXIE:              return 0x70; // 'p'
        case DisplayGlyph.G_RAT:                return 0x72; // 'r'
        case DisplayGlyph.G_SPIDER:             return 0x73; // 's'
        case DisplayGlyph.G_TOAD:               return 0x74; // 't'
        case DisplayGlyph.G_BAT:                return 0x76; // 'v'
        case DisplayGlyph.G_WISP:               return 0x77; // 'w'
        case DisplayGlyph.G_PHOENIX:            return 0x50; // 'P'
        case DisplayGlyph.G_ALTAR:              return 0x7C; // '|'
        case DisplayGlyph.G_LIQUID:             return 0x7E; // '~'
        case DisplayGlyph.G_FLOOR:              return U_MIDDLE_DOT;
        case DisplayGlyph.G_CHASM:              return U_FOUR_DOTS;
        case DisplayGlyph.G_TRAP:               return U_DIAMOND;
        case DisplayGlyph.G_FIRE:               return U_FLIPPED_V;
        case DisplayGlyph.G_FOLIAGE:            return U_ARIES;
        case DisplayGlyph.G_AMULET:             return U_ANKH;
        case DisplayGlyph.G_SCROLL:             return U_MUSIC_NOTE;
        case DisplayGlyph.G_RING:               return U_CIRCLE;
        case DisplayGlyph.G_WEAPON:             return U_UP_ARROW;
        case DisplayGlyph.G_GEM:                return U_FILLED_CIRCLE;
        case DisplayGlyph.G_TOTEM:              return U_NEUTER;
        case DisplayGlyph.G_GOOD_MAGIC:         return U_FILLED_CIRCLE_BARS;
        case DisplayGlyph.G_BAD_MAGIC:          return U_CIRCLE_BARS;
        case DisplayGlyph.G_DOORWAY:            return U_OMEGA;
        case DisplayGlyph.G_CHARM:              return U_LIGHTNING_BOLT;
        case DisplayGlyph.G_WALL_TOP:           return 0x23; // '#'
        case DisplayGlyph.G_DAR_PRIESTESS:      return 0x64; // 'd'
        case DisplayGlyph.G_DAR_BATTLEMAGE:     return 0x64; // 'd'
        case DisplayGlyph.G_GOBLIN_MAGIC:       return 0x67; // 'g'
        case DisplayGlyph.G_GOBLIN_CHIEFTAN:    return 0x67; // 'g'
        case DisplayGlyph.G_OGRE_MAGIC:         return 0x4F; // 'O'
        case DisplayGlyph.G_GUARDIAN:            return U_ESZETT;
        case DisplayGlyph.G_WINGED_GUARDIAN:     return U_ESZETT;
        case DisplayGlyph.G_EGG:                return U_FILLED_CIRCLE;
        case DisplayGlyph.G_WARDEN:             return 0x59; // 'Y'
        case DisplayGlyph.G_DEWAR:              return 0x26; // '&'
        case DisplayGlyph.G_ANCIENT_SPIRIT:     return 0x4D; // 'M'
        case DisplayGlyph.G_LEVER:              return 0x2F; // '/'
        case DisplayGlyph.G_LEVER_PULLED:       return 0x5C; // '\\'
        case DisplayGlyph.G_BLOODWORT_STALK:    return U_ARIES;
        case DisplayGlyph.G_FLOOR_ALT:          return U_MIDDLE_DOT;
        case DisplayGlyph.G_UNICORN:            return U_U_ACUTE;
        case DisplayGlyph.G_TURRET:             return U_FILLED_CIRCLE;
        case DisplayGlyph.G_WAND:               return 0x7E; // '~'
        case DisplayGlyph.G_GRANITE:            return 0x23; // '#'
        case DisplayGlyph.G_CARPET:             return U_MIDDLE_DOT;
        case DisplayGlyph.G_CLOSED_IRON_DOOR:   return 0x2B; // '+'
        case DisplayGlyph.G_OPEN_IRON_DOOR:     return 0x27; // '\''
        case DisplayGlyph.G_TORCH:              return 0x23; // '#'
        case DisplayGlyph.G_CRYSTAL:            return 0x23; // '#'
        case DisplayGlyph.G_PORTCULLIS:         return 0x23; // '#'
        case DisplayGlyph.G_BARRICADE:          return 0x23; // '#'
        case DisplayGlyph.G_STATUE:             return U_ESZETT;
        case DisplayGlyph.G_CRACKED_STATUE:     return U_ESZETT;
        case DisplayGlyph.G_CLOSED_CAGE:        return 0x23; // '#'
        case DisplayGlyph.G_OPEN_CAGE:          return 0x7C; // '|'
        case DisplayGlyph.G_PEDESTAL:           return 0x7C; // '|'
        case DisplayGlyph.G_CLOSED_COFFIN:      return 0x2D; // '-'
        case DisplayGlyph.G_OPEN_COFFIN:        return 0x2D; // '-'
        case DisplayGlyph.G_MAGIC_GLYPH:        return U_FOUR_DOTS;
        case DisplayGlyph.G_BRIDGE:             return 0x3D; // '='
        case DisplayGlyph.G_BONES:              return 0x2C; // ','
        case DisplayGlyph.G_ELECTRIC_CRYSTAL:   return U_CURRENCY;
        case DisplayGlyph.G_ASHES:              return 0x27; // '\''
        case DisplayGlyph.G_BEDROLL:            return 0x3D; // '='
        case DisplayGlyph.G_BLOODWORT_POD:      return 0x2A; // '*'
        case DisplayGlyph.G_VINE:               return 0x3A; // ':'
        case DisplayGlyph.G_NET:                return 0x3A; // ':'
        case DisplayGlyph.G_LICHEN:             return 0x22; // '"'
        case DisplayGlyph.G_PIPES:              return 0x2B; // '+'
        case DisplayGlyph.G_SAC_ALTAR:          return 0x7C; // '|'
        case DisplayGlyph.G_ORB_ALTAR:          return 0x7C; // '|'
        case DisplayGlyph.G_LEFT_TRIANGLE:      return U_LEFT_TRIANGLE;

        default:
            return 0x3F; // '?'
    }
}

// =============================================================================
// isEnvironmentGlyph — classify glyphs as environment vs. item/creature
// =============================================================================

/** Set of item glyphs. */
const ITEM_GLYPHS: ReadonlySet<DisplayGlyph> = new Set([
    DisplayGlyph.G_AMULET,
    DisplayGlyph.G_ARMOR,
    DisplayGlyph.G_BEDROLL,
    DisplayGlyph.G_CHARM,
    DisplayGlyph.G_DEWAR,
    DisplayGlyph.G_EGG,
    DisplayGlyph.G_FOOD,
    DisplayGlyph.G_GEM,
    DisplayGlyph.G_BLOODWORT_POD,
    DisplayGlyph.G_GOLD,
    DisplayGlyph.G_KEY,
    DisplayGlyph.G_POTION,
    DisplayGlyph.G_RING,
    DisplayGlyph.G_SCROLL,
    DisplayGlyph.G_STAFF,
    DisplayGlyph.G_WAND,
    DisplayGlyph.G_WEAPON,
    DisplayGlyph.G_LEFT_TRIANGLE,
]);

/** Set of creature glyphs. */
const CREATURE_GLYPHS: ReadonlySet<DisplayGlyph> = new Set([
    DisplayGlyph.G_ANCIENT_SPIRIT,
    DisplayGlyph.G_BAT,
    DisplayGlyph.G_BLOAT,
    DisplayGlyph.G_BOG_MONSTER,
    DisplayGlyph.G_CENTAUR,
    DisplayGlyph.G_CENTIPEDE,
    DisplayGlyph.G_DAR_BATTLEMAGE,
    DisplayGlyph.G_DAR_BLADEMASTER,
    DisplayGlyph.G_DAR_PRIESTESS,
    DisplayGlyph.G_DEMON,
    DisplayGlyph.G_DRAGON,
    DisplayGlyph.G_EEL,
    DisplayGlyph.G_FLAMEDANCER,
    DisplayGlyph.G_FURY,
    DisplayGlyph.G_GOBLIN,
    DisplayGlyph.G_GOBLIN_CHIEFTAN,
    DisplayGlyph.G_GOBLIN_MAGIC,
    DisplayGlyph.G_GOLEM,
    DisplayGlyph.G_GUARDIAN,
    DisplayGlyph.G_IFRIT,
    DisplayGlyph.G_IMP,
    DisplayGlyph.G_JACKAL,
    DisplayGlyph.G_JELLY,
    DisplayGlyph.G_KOBOLD,
    DisplayGlyph.G_KRAKEN,
    DisplayGlyph.G_LICH,
    DisplayGlyph.G_MONKEY,
    DisplayGlyph.G_MOUND,
    DisplayGlyph.G_NAGA,
    DisplayGlyph.G_OGRE,
    DisplayGlyph.G_OGRE_MAGIC,
    DisplayGlyph.G_PHANTOM,
    DisplayGlyph.G_PHOENIX,
    DisplayGlyph.G_PIXIE,
    DisplayGlyph.G_PLAYER,
    DisplayGlyph.G_RAT,
    DisplayGlyph.G_REVENANT,
    DisplayGlyph.G_SALAMANDER,
    DisplayGlyph.G_SPIDER,
    DisplayGlyph.G_TENTACLE_HORROR,
    DisplayGlyph.G_TOAD,
    DisplayGlyph.G_TROLL,
    DisplayGlyph.G_UNDERWORM,
    DisplayGlyph.G_UNICORN,
    DisplayGlyph.G_VAMPIRE,
    DisplayGlyph.G_WARDEN,
    DisplayGlyph.G_WINGED_GUARDIAN,
    DisplayGlyph.G_WISP,
    DisplayGlyph.G_WRAITH,
    DisplayGlyph.G_ZOMBIE,
]);

/**
 * Port of C `isEnvironmentGlyph()`.
 *
 * Returns `true` if the glyph represents part of the environment (floor,
 * wall, door, etc.), `false` if it represents an item or creature.
 */
export function isEnvironmentGlyph(glyph: DisplayGlyph): boolean {
    if (ITEM_GLYPHS.has(glyph)) return false;
    if (CREATURE_GLYPHS.has(glyph)) return false;
    return true;
}
