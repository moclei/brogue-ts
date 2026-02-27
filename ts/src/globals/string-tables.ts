/*
 *  string-tables.ts — String tables, ported from Globals.c
 *  brogue-ts
 */

export const itemCategoryNames: readonly string[] = [
    "food",
    "weapon",
    "armor",
    "potion",
    "scroll",
    "staff",
    "wand",
    "ring",
    "charm",
    "gold",
    "amulet",
    "lumenstone",
    "key",
];

export const titlePhonemes: readonly string[] = [
    "glorp",
    "snarg",
    "gana",
    "flin",
    "herba",
    "pora",
    "nuglo",
    "greep",
    "nur",
    "lofa",
    "poder",
    "nidge",
    "pus",
    "wooz",
    "flem",
    "bloto",
    "porta",
    "ermah",
    "gerd",
    "nurt",
    "flurx",
];

export const itemColorsRef: readonly string[] = [
    "crimson",
    "scarlet",
    "orange",
    "yellow",
    "green",
    "blue",
    "indigo",
    "violet",
    "puce",
    "mauve",
    "burgundy",
    "turquoise",
    "aquamarine",
    "gray",
    "pink",
    "white",
    "lavender",
    "tan",
    "brown",
    "cyan",
    "black",
];

export const itemWoodsRef: readonly string[] = [
    "teak",
    "oak",
    "redwood",
    "rowan",
    "willow",
    "mahogany",
    "pinewood",
    "maple",
    "bamboo",
    "ironwood",
    "pearwood",
    "birch",
    "cherry",
    "eucalyptus",
    "walnut",
    "cedar",
    "rosewood",
    "yew",
    "sandalwood",
    "hickory",
    "hemlock",
];

export const itemMetalsRef: readonly string[] = [
    "bronze",
    "steel",
    "brass",
    "pewter",
    "nickel",
    "copper",
    "aluminum",
    "tungsten",
    "titanium",
    "cobalt",
    "chromium",
    "silver",
];

export const itemGemsRef: readonly string[] = [
    "diamond",
    "opal",
    "garnet",
    "ruby",
    "amethyst",
    "topaz",
    "onyx",
    "tourmaline",
    "sapphire",
    "obsidian",
    "malachite",
    "aquamarine",
    "emerald",
    "jade",
    "alexandrite",
    "agate",
    "bloodstone",
    "jasper",
];

export const weaponRunicNames: readonly string[] = [
    "speed",
    "quietus",
    "paralysis",
    "multiplicity",
    "slowing",
    "confusion",
    "force",
    "slaying",
    "mercy",
    "plenty",
];

export const armorRunicNames: readonly string[] = [
    "multiplicity",
    "mutuality",
    "absorption",
    "reprisal",
    "immunity",
    "reflection",
    "respiration",
    "dampening",
    "burden",
    "vulnerability",
    "immolation",
];

export const monsterBehaviorFlagDescriptions: readonly string[] = [
    "is invisible",                             // MONST_INVISIBLE
    "is an inanimate object",                   // MONST_INANIMATE
    "cannot move",                              // MONST_IMMOBILE
    "",                                         // MONST_CARRY_ITEM_100
    "",                                         // MONST_CARRY_ITEM_25
    "",                                         // MONST_ALWAYS_HUNTING
    "flees at low health",                      // MONST_FLEES_NEAR_DEATH
    "",                                         // MONST_ATTACKABLE_THRU_WALLS
    "corrodes weapons when hit",                // MONST_DEFEND_DEGRADE_WEAPON
    "is immune to weapon damage",               // MONST_IMMUNE_TO_WEAPONS
    "flies",                                    // MONST_FLIES
    "moves erratically",                        // MONST_FLITS
    "is immune to fire",                        // MONST_IMMUNE_TO_FIRE
    "",                                         // MONST_CAST_SPELLS_SLOWLY
    "cannot be entangled",                      // MONST_IMMUNE_TO_WEBS
    "can reflect magic spells",                 // MONST_REFLECT_50
    "never sleeps",                             // MONST_NEVER_SLEEPS
    "burns unceasingly",                        // MONST_FIERY
    "is invulnerable",                          // MONST_INVULNERABLE
    "is at home in water",                      // MONST_IMMUNE_TO_WATER
    "cannot venture onto dry land",             // MONST_RESTRICTED_TO_LIQUID
    "submerges",                                // MONST_SUBMERGES
    "keeps $HISHER distance",                   // MONST_MAINTAINS_DISTANCE
    "",                                         // MONST_WILL_NOT_USE_STAIRS
    "is animated purely by magic",              // MONST_DIES_IF_NEGATED
    "",                                         // MONST_MALE
    "",                                         // MONST_FEMALE
    "",                                         // MONST_NOT_LISTED_IN_SIDEBAR
    "moves only when activated",                // MONST_GETS_TURN_ON_ACTIVATION
];

export const monsterAbilityFlagDescriptions: readonly string[] = [
    "can induce hallucinations",                // MA_HIT_HALLUCINATE
    "can steal items",                          // MA_HIT_STEAL_FLEE
    "lights enemies on fire when $HESHE hits",  // MA_HIT_BURN
    "can possess $HISHER summoned allies",      // MA_ENTER_SUMMONS
    "corrodes armor when $HESHE hits",          // MA_HIT_DEGRADE_ARMOR
    "can summon allies",                        // MA_CAST_SUMMON
    "immobilizes $HISHER prey",                 // MA_SEIZES
    "injects poison when $HESHE hits",          // MA_POISONS
    "",                                         // MA_DF_ON_DEATH
    "divides in two when struck",               // MA_CLONE_SELF_ON_DEFEND
    "dies when $HESHE attacks",                 // MA_KAMIKAZE
    "recovers health when $HESHE inflicts damage", // MA_TRANSFERENCE
    "saps strength when $HESHE inflicts damage",// MA_CAUSE_WEAKNESS
    "attacks up to two opponents in a line",    // MA_ATTACKS_PENETRATE
    "attacks all adjacent opponents at once",   // MA_ATTACKS_ALL_ADJACENT
    "attacks with a whip",                      // MA_ATTACKS_EXTEND
    "pushes opponents backward when $HESHE hits", // MA_ATTACKS_STAGGER
    "avoids attacking in corridors in a group", // MA_AVOID_CORRIDORS
    "reflects magic spells back at the caster", // MA_REFLECT_100
];

export const monsterBookkeepingFlagDescriptions: readonly string[] = [
    "",                                         // MB_WAS_VISIBLE
    "is telepathically bonded with you",        // MB_TELEPATHICALLY_REVEALED
    "",                                         // MB_PREPLACED
    "",                                         // MB_APPROACHING_UPSTAIRS
    "",                                         // MB_APPROACHING_DOWNSTAIRS
    "",                                         // MB_APPROACHING_PIT
    "",                                         // MB_LEADER
    "",                                         // MB_FOLLOWER
    "",                                         // MB_CAPTIVE
    "has been immobilized",                     // MB_SEIZED
    "is currently holding $HISHER prey immobile", // MB_SEIZING
    "is submerged",                             // MB_SUBMERGED
    "",                                         // MB_JUST_SUMMONED
    "",                                         // MB_WILL_FLASH
    "is anchored to reality by $HISHER summoner", // MB_BOUND_TO_LEADER
    "is marked for demonic sacrifice",          // MB_MARKED_FOR_SACRIFICE
];

// NOTE: keyTable, foodTable, weaponTable, armorTable, staffTable, ringTable
// are deferred to Phase 2/3 as they reference mutable runtime arrays (itemWoods,
// itemGems, etc.) and require the full item system to be in place.
