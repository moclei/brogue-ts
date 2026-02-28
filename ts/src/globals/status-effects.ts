/*
 *  status-effects.ts — Status effect catalog and behavior/ability catalogs
 *  Ported from Globals.c
 *  brogue-ts
 */

import type { StatusEffectInfo, MonsterBehaviorInfo, MonsterAbilityInfo } from "../types/types.js";

/**
 * Monster behavior catalog. Each entry describes a monster behavior flag.
 */
export const monsterBehaviorCatalog: readonly MonsterBehaviorInfo[] = [
    { description: "is invisible",                    isNegatable: true },   // MONST_INVISIBLE
    { description: "is an inanimate object",          isNegatable: false },  // MONST_INANIMATE
    { description: "cannot move",                     isNegatable: false },  // MONST_IMMOBILE
    { description: "",                                isNegatable: false },  // MONST_CARRY_ITEM_100
    { description: "",                                isNegatable: false },  // MONST_CARRY_ITEM_25
    { description: "",                                isNegatable: false },  // MONST_ALWAYS_HUNTING
    { description: "flees at low health",             isNegatable: false },  // MONST_FLEES_NEAR_DEATH
    { description: "",                                isNegatable: false },  // MONST_ATTACKABLE_THRU_WALLS
    { description: "corrodes weapons when hit",       isNegatable: true },   // MONST_DEFEND_DEGRADE_WEAPON
    { description: "is immune to weapon damage",      isNegatable: true },   // MONST_IMMUNE_TO_WEAPONS
    { description: "flies",                           isNegatable: true },   // MONST_FLIES
    { description: "moves erratically",               isNegatable: true },   // MONST_FLITS
    { description: "is immune to fire",               isNegatable: true },   // MONST_IMMUNE_TO_FIRE
    { description: "",                                isNegatable: false },  // MONST_CAST_SPELLS_SLOWLY
    { description: "cannot be entangled",             isNegatable: false },  // MONST_IMMUNE_TO_WEBS
    { description: "can reflect magic spells",        isNegatable: true },   // MONST_REFLECT_50
    { description: "never sleeps",                    isNegatable: false },  // MONST_NEVER_SLEEPS
    { description: "burns unceasingly",               isNegatable: true },   // MONST_FIERY
    { description: "is invulnerable",                 isNegatable: false },  // MONST_INVULNERABLE
    { description: "is at home in water",             isNegatable: false },  // MONST_IMMUNE_TO_WATER
    { description: "cannot venture onto dry land",    isNegatable: false },  // MONST_RESTRICTED_TO_LIQUID
    { description: "submerges",                       isNegatable: false },  // MONST_SUBMERGES
    { description: "keeps $HISHER distance",          isNegatable: true },   // MONST_MAINTAINS_DISTANCE
    { description: "",                                isNegatable: false },  // MONST_WILL_NOT_USE_STAIRS
    { description: "is animated purely by magic",     isNegatable: false },  // MONST_DIES_IF_NEGATED
    { description: "",                                isNegatable: false },  // MONST_MALE
    { description: "",                                isNegatable: false },  // MONST_FEMALE
    { description: "",                                isNegatable: false },  // MONST_NOT_LISTED_IN_SIDEBAR
    { description: "moves only when activated",       isNegatable: false },  // MONST_GETS_TURN_ON_ACTIVATION
];

/**
 * Monster ability catalog. Each entry describes a monster ability flag.
 */
export const monsterAbilityCatalog: readonly MonsterAbilityInfo[] = [
    { description: "can induce hallucinations",                   isNegatable: true },  // MA_HIT_HALLUCINATE
    { description: "can steal items",                             isNegatable: true },  // MA_HIT_STEAL_FLEE
    { description: "lights enemies on fire when $HESHE hits",     isNegatable: true },  // MA_HIT_BURN
    { description: "can possess $HISHER summoned allies",         isNegatable: true },  // MA_ENTER_SUMMONS
    { description: "corrodes armor when $HESHE hits",             isNegatable: true },  // MA_HIT_DEGRADE_ARMOR
    { description: "can summon allies",                           isNegatable: true },  // MA_CAST_SUMMON
    { description: "immobilizes $HISHER prey",                    isNegatable: true },  // MA_SEIZES
    { description: "injects poison when $HESHE hits",             isNegatable: true },  // MA_POISONS
    { description: "",                                            isNegatable: true },  // MA_DF_ON_DEATH
    { description: "divides in two when struck",                  isNegatable: true },  // MA_CLONE_SELF_ON_DEFEND
    { description: "dies when $HESHE attacks",                    isNegatable: true },  // MA_KAMIKAZE
    { description: "recovers health when $HESHE inflicts damage", isNegatable: true },  // MA_TRANSFERENCE
    { description: "saps strength when $HESHE inflicts damage",   isNegatable: true },  // MA_CAUSE_WEAKNESS
    { description: "attacks up to two opponents in a line",       isNegatable: false }, // MA_ATTACKS_PENETRATE
    { description: "attacks all adjacent opponents at once",      isNegatable: false }, // MA_ATTACKS_ALL_ADJACENT
    { description: "attacks with a whip",                         isNegatable: false }, // MA_ATTACKS_EXTEND
    { description: "pushes opponents backward when $HESHE hits",  isNegatable: false }, // MA_ATTACKS_STAGGER
    { description: "avoids attacking in corridors in a group",    isNegatable: true },  // MA_AVOID_CORRIDORS
];

/**
 * Status effect catalog. Each entry defines a status effect's display name,
 * whether it's negatable, and the player's negated value.
 */
export const statusEffectCatalog: readonly StatusEffectInfo[] = [
    { name: "Searching",       isNegatable: false, playerNegatedValue: 0 }, // STATUS_SEARCHING
    { name: "Donning Armor",   isNegatable: false, playerNegatedValue: 0 }, // STATUS_DONNING
    { name: "Weakened: -",     isNegatable: false, playerNegatedValue: 0 }, // STATUS_WEAKENED
    { name: "Telepathic",      isNegatable: true,  playerNegatedValue: 1 }, // STATUS_TELEPATHIC
    { name: "Hallucinating",   isNegatable: true,  playerNegatedValue: 0 }, // STATUS_HALLUCINATING
    { name: "Levitating",      isNegatable: true,  playerNegatedValue: 1 }, // STATUS_LEVITATING
    { name: "Slowed",          isNegatable: true,  playerNegatedValue: 0 }, // STATUS_SLOWED
    { name: "Hasted",          isNegatable: true,  playerNegatedValue: 0 }, // STATUS_HASTED
    { name: "Confused",        isNegatable: true,  playerNegatedValue: 0 }, // STATUS_CONFUSED
    { name: "Burning",         isNegatable: false, playerNegatedValue: 0 }, // STATUS_BURNING
    { name: "Paralyzed",       isNegatable: false, playerNegatedValue: 0 }, // STATUS_PARALYZED
    { name: "Poisoned",        isNegatable: false, playerNegatedValue: 0 }, // STATUS_POISONED
    { name: "Stuck",           isNegatable: false, playerNegatedValue: 0 }, // STATUS_STUCK
    { name: "Nauseous",        isNegatable: false, playerNegatedValue: 0 }, // STATUS_NAUSEOUS
    { name: "Discordant",      isNegatable: true,  playerNegatedValue: 0 }, // STATUS_DISCORDANT
    { name: "Immune to Fire",  isNegatable: true,  playerNegatedValue: 1 }, // STATUS_IMMUNE_TO_FIRE
    { name: "",                isNegatable: false, playerNegatedValue: 0 }, // STATUS_EXPLOSION_IMMUNITY
    { name: "",                isNegatable: false, playerNegatedValue: 0 }, // STATUS_NUTRITION
    { name: "",                isNegatable: false, playerNegatedValue: 0 }, // STATUS_ENTERS_LEVEL_IN
    { name: "",                isNegatable: false, playerNegatedValue: 0 }, // STATUS_ENRAGED
    { name: "Frightened",      isNegatable: true,  playerNegatedValue: 0 }, // STATUS_MAGICAL_FEAR
    { name: "Entranced",       isNegatable: true,  playerNegatedValue: 0 }, // STATUS_ENTRANCED
    { name: "Darkened",        isNegatable: true,  playerNegatedValue: 0 }, // STATUS_DARKNESS
    { name: "Lifespan",        isNegatable: false, playerNegatedValue: 0 }, // STATUS_LIFESPAN_REMAINING
    { name: "Shielded",        isNegatable: true,  playerNegatedValue: 0 }, // STATUS_SHIELDED
    { name: "Invisible",       isNegatable: true,  playerNegatedValue: 0 }, // STATUS_INVISIBLE
    { name: "Aggravating",    isNegatable: true,  playerNegatedValue: 0 }, // STATUS_AGGRAVATING
];
