/*
 *  enums.ts — Port of all enums from Rogue.h
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { Fl } from "./flags.js";

// ===== gameVariant =====

export enum GameVariant {
    Brogue,
    RapidBrogue,
    BulletBrogue,
    NumberVariants,
}

// ===== displayGlyph =====

export enum DisplayGlyph {
    G_UP_ARROW = 128,
    G_DOWN_ARROW, G_POTION, G_GRASS, G_WALL, G_DEMON, G_OPEN_DOOR, G_GOLD,
    G_CLOSED_DOOR, G_RUBBLE, G_KEY, G_BOG,
    G_CHAIN_TOP_LEFT, G_CHAIN_BOTTOM_RIGHT, G_CHAIN_TOP_RIGHT, G_CHAIN_BOTTOM_LEFT,
    G_CHAIN_TOP, G_CHAIN_BOTTOM, G_CHAIN_LEFT, G_CHAIN_RIGHT,
    G_FOOD, G_UP_STAIRS, G_VENT, G_DOWN_STAIRS, G_PLAYER,
    G_BOG_MONSTER, G_CENTAUR, G_DRAGON, G_FLAMEDANCER, G_GOLEM,
    G_TENTACLE_HORROR, G_IFRIT, G_JELLY, G_KRAKEN, G_LICH, G_NAGA,
    G_OGRE, G_PHANTOM, G_REVENANT, G_SALAMANDER, G_TROLL, G_UNDERWORM,
    G_VAMPIRE, G_WRAITH, G_ZOMBIE,
    G_ARMOR, G_STAFF, G_WEB, G_MOUND, G_BLOAT, G_CENTIPEDE,
    G_DAR_BLADEMASTER, G_EEL, G_FURY, G_GOBLIN, G_IMP, G_JACKAL,
    G_KOBOLD, G_MONKEY, G_PIXIE, G_RAT, G_SPIDER, G_TOAD, G_BAT,
    G_WISP, G_PHOENIX,
    G_ALTAR, G_LIQUID, G_FLOOR, G_CHASM, G_TRAP, G_FIRE, G_FOLIAGE,
    G_AMULET, G_SCROLL, G_RING, G_WEAPON, G_TURRET, G_TOTEM,
    G_GOOD_MAGIC, G_BAD_MAGIC, G_DOORWAY, G_CHARM,
    G_WALL_TOP,
    G_DAR_PRIESTESS, G_DAR_BATTLEMAGE, G_GOBLIN_MAGIC, G_GOBLIN_CHIEFTAN,
    G_OGRE_MAGIC, G_GUARDIAN, G_WINGED_GUARDIAN, G_EGG, G_WARDEN,
    G_DEWAR, G_ANCIENT_SPIRIT, G_LEVER, G_LEVER_PULLED,
    G_BLOODWORT_STALK, G_FLOOR_ALT, G_UNICORN, G_GEM, G_WAND,
    G_GRANITE, G_CARPET, G_CLOSED_IRON_DOOR, G_OPEN_IRON_DOOR,
    G_TORCH, G_CRYSTAL, G_PORTCULLIS, G_BARRICADE, G_STATUE,
    G_CRACKED_STATUE, G_CLOSED_CAGE, G_OPEN_CAGE, G_PEDESTAL,
    G_CLOSED_COFFIN, G_OPEN_COFFIN, G_MAGIC_GLYPH, G_BRIDGE, G_BONES,
    G_ELECTRIC_CRYSTAL, G_ASHES, G_BEDROLL, G_BLOODWORT_POD, G_VINE,
    G_NET, G_LICHEN, G_PIPES, G_SAC_ALTAR, G_ORB_ALTAR, G_LEFT_TRIANGLE,
}

// ===== graphicsModes =====

export enum GraphicsMode {
    Text,
    Tiles,
    Hybrid, // text for items and creatures, tiles for environment
}

// ===== eventTypes =====

export enum EventType {
    Keystroke,
    MouseUp,
    MouseDown,
    RightMouseDown,
    RightMouseUp,
    MouseEnteredCell,
    RNGCheck,
    SavedGameLoaded,
    EndOfRecording,
    EventError,
    NumberOfEventTypes,
}

// ===== notificationEventTypes =====

export enum NotificationEventType {
    GameOverQuit,
    GameOverDeath,
    GameOverVictory,
    GameOverSuperVictory,
    GameOverRecording,
}

// ===== RNGs =====

export enum RNG {
    Substantive,
    Cosmetic,
    NumberOfRNGs,
}

// ===== displayDetailValues =====

export enum DisplayDetailValue {
    Unlit = 0,
    Lit,
    Dark,
}

// ===== directions =====

export enum Direction {
    NoDirection = -1,
    Up = 0,
    Down = 1,
    Left = 2,
    Right = 3,
    UpLeft = 4,
    DownLeft = 5,
    UpRight = 6,
    DownRight = 7,
    DirectionCount = 8,
}

// ===== textEntryTypes =====

export enum TextEntryType {
    Normal = 0,
    Filename,
    Numbers,
    Types,
}

// ===== tileType =====

export enum TileType {
    NOTHING = 0,
    GRANITE, FLOOR, FLOOR_FLOODABLE, CARPET, MARBLE_FLOOR, WALL, DOOR,
    OPEN_DOOR, SECRET_DOOR, LOCKED_DOOR, OPEN_IRON_DOOR_INERT,
    DOWN_STAIRS, UP_STAIRS, DUNGEON_EXIT, DUNGEON_PORTAL,
    TORCH_WALL, CRYSTAL_WALL,
    PORTCULLIS_CLOSED, PORTCULLIS_DORMANT, WOODEN_BARRICADE,
    PILOT_LIGHT_DORMANT, PILOT_LIGHT,
    HAUNTED_TORCH_DORMANT, HAUNTED_TORCH_TRANSITIONING, HAUNTED_TORCH,
    WALL_LEVER_HIDDEN, WALL_LEVER, WALL_LEVER_PULLED, WALL_LEVER_HIDDEN_DORMANT,
    STATUE_INERT, STATUE_DORMANT, STATUE_CRACKING, STATUE_INSTACRACK,
    PORTAL, TURRET_DORMANT, WALL_MONSTER_DORMANT,
    DARK_FLOOR_DORMANT, DARK_FLOOR_DARKENING, DARK_FLOOR,
    MACHINE_TRIGGER_FLOOR,
    ALTAR_INERT, ALTAR_KEYHOLE, ALTAR_CAGE_OPEN, ALTAR_CAGE_CLOSED,
    ALTAR_SWITCH, ALTAR_SWITCH_RETRACTING, ALTAR_CAGE_RETRACTABLE,
    PEDESTAL, MONSTER_CAGE_OPEN, MONSTER_CAGE_CLOSED,
    COFFIN_CLOSED, COFFIN_OPEN,
    GAS_TRAP_POISON_HIDDEN, GAS_TRAP_POISON,
    TRAP_DOOR_HIDDEN, TRAP_DOOR,
    GAS_TRAP_PARALYSIS_HIDDEN, GAS_TRAP_PARALYSIS,
    MACHINE_PARALYSIS_VENT_HIDDEN, MACHINE_PARALYSIS_VENT,
    GAS_TRAP_CONFUSION_HIDDEN, GAS_TRAP_CONFUSION,
    FLAMETHROWER_HIDDEN, FLAMETHROWER,
    FLOOD_TRAP_HIDDEN, FLOOD_TRAP,
    NET_TRAP_HIDDEN, NET_TRAP,
    ALARM_TRAP_HIDDEN, ALARM_TRAP,
    MACHINE_POISON_GAS_VENT_HIDDEN, MACHINE_POISON_GAS_VENT_DORMANT, MACHINE_POISON_GAS_VENT,
    MACHINE_METHANE_VENT_HIDDEN, MACHINE_METHANE_VENT_DORMANT, MACHINE_METHANE_VENT,
    STEAM_VENT,
    MACHINE_PRESSURE_PLATE, MACHINE_PRESSURE_PLATE_USED,
    MACHINE_GLYPH, MACHINE_GLYPH_INACTIVE,
    DEWAR_CAUSTIC_GAS, DEWAR_CONFUSION_GAS, DEWAR_PARALYSIS_GAS, DEWAR_METHANE_GAS,
    DEEP_WATER, SHALLOW_WATER, MUD, CHASM, CHASM_EDGE,
    MACHINE_COLLAPSE_EDGE_DORMANT, MACHINE_COLLAPSE_EDGE_SPREADING,
    LAVA, LAVA_RETRACTABLE, LAVA_RETRACTING,
    SUNLIGHT_POOL, DARKNESS_PATCH, ACTIVE_BRIMSTONE, INERT_BRIMSTONE, OBSIDIAN,
    BRIDGE, BRIDGE_FALLING, BRIDGE_EDGE, STONE_BRIDGE,
    MACHINE_FLOOD_WATER_DORMANT, MACHINE_FLOOD_WATER_SPREADING,
    MACHINE_MUD_DORMANT,
    ICE_DEEP, ICE_DEEP_MELT, ICE_SHALLOW, ICE_SHALLOW_MELT,
    HOLE, HOLE_GLOW, HOLE_EDGE,
    FLOOD_WATER_DEEP, FLOOD_WATER_SHALLOW,
    GRASS, DEAD_GRASS, GRAY_FUNGUS, LUMINESCENT_FUNGUS, LICHEN, HAY,
    RED_BLOOD, GREEN_BLOOD, PURPLE_BLOOD, ACID_SPLATTER, VOMIT, URINE,
    UNICORN_POOP, WORM_BLOOD, ASH, BURNED_CARPET, PUDDLE, BONES, RUBBLE,
    JUNK, BROKEN_GLASS, ECTOPLASM, EMBERS, SPIDERWEB, NETTING,
    FOLIAGE, DEAD_FOLIAGE, TRAMPLED_FOLIAGE,
    FUNGUS_FOREST, TRAMPLED_FUNGUS_FOREST,
    FORCEFIELD, FORCEFIELD_MELT, SACRED_GLYPH,
    MANACLE_TL, MANACLE_BR, MANACLE_TR, MANACLE_BL,
    MANACLE_T, MANACLE_B, MANACLE_L, MANACLE_R,
    PORTAL_LIGHT, GUARDIAN_GLOW,
    PLAIN_FIRE, BRIMSTONE_FIRE, FLAMEDANCER_FIRE, GAS_FIRE, GAS_EXPLOSION,
    DART_EXPLOSION, ITEM_FIRE, CREATURE_FIRE,
    POISON_GAS, CONFUSION_GAS, ROT_GAS, STENCH_SMOKE_GAS,
    PARALYSIS_GAS, METHANE_GAS, STEAM, DARKNESS_CLOUD, HEALING_CLOUD,
    BLOODFLOWER_STALK, BLOODFLOWER_POD, HAVEN_BEDROLL,
    DEEP_WATER_ALGAE_WELL, DEEP_WATER_ALGAE_1, DEEP_WATER_ALGAE_2,
    ANCIENT_SPIRIT_VINES, ANCIENT_SPIRIT_GRASS,
    AMULET_SWITCH,
    COMMUTATION_ALTAR, COMMUTATION_ALTAR_INERT,
    PIPE_GLOWING, PIPE_INERT,
    RESURRECTION_ALTAR, RESURRECTION_ALTAR_INERT,
    MACHINE_TRIGGER_FLOOR_REPEATING,
    SACRIFICE_ALTAR_DORMANT, SACRIFICE_ALTAR, SACRIFICE_LAVA,
    SACRIFICE_CAGE_DORMANT, DEMONIC_STATUE,
    STATUE_INERT_DOORWAY, STATUE_DORMANT_DOORWAY,
    CHASM_WITH_HIDDEN_BRIDGE, CHASM_WITH_HIDDEN_BRIDGE_ACTIVE, MACHINE_CHASM_EDGE,
    RAT_TRAP_WALL_DORMANT, RAT_TRAP_WALL_CRACKING,
    ELECTRIC_CRYSTAL_OFF, ELECTRIC_CRYSTAL_ON, TURRET_LEVER,
    WORM_TUNNEL_MARKER_DORMANT, WORM_TUNNEL_MARKER_ACTIVE, WORM_TUNNEL_OUTER_WALL,
    BRAZIER,
    MUD_FLOOR, MUD_WALL, MUD_DOORWAY,
    NUMBER_TILETYPES,
}

// ===== lightType =====

export enum LightType {
    NO_LIGHT,
    MINERS_LIGHT, BURNING_CREATURE_LIGHT, WISP_LIGHT, SALAMANDER_LIGHT,
    IMP_LIGHT, PIXIE_LIGHT, LICH_LIGHT, FLAMEDANCER_LIGHT, SENTINEL_LIGHT,
    UNICORN_LIGHT, IFRIT_LIGHT, PHOENIX_LIGHT, PHOENIX_EGG_LIGHT,
    YENDOR_LIGHT, SPECTRAL_BLADE_LIGHT, SPECTRAL_IMAGE_LIGHT,
    SPARK_TURRET_LIGHT, EXPLOSIVE_BLOAT_LIGHT, BOLT_LIGHT_SOURCE,
    TELEPATHY_LIGHT, SACRIFICE_MARK_LIGHT,
    SCROLL_PROTECTION_LIGHT, SCROLL_ENCHANTMENT_LIGHT, POTION_STRENGTH_LIGHT,
    EMPOWERMENT_LIGHT, GENERIC_FLASH_LIGHT, FALLEN_TORCH_FLASH_LIGHT,
    SUMMONING_FLASH_LIGHT, EXPLOSION_FLARE_LIGHT, QUIETUS_FLARE_LIGHT,
    SLAYING_FLARE_LIGHT, CHARGE_FLASH_LIGHT,
    TORCH_LIGHT, LAVA_LIGHT, SUN_LIGHT, DARKNESS_PATCH_LIGHT,
    FUNGUS_LIGHT, FUNGUS_FOREST_LIGHT,
    LUMINESCENT_ALGAE_BLUE_LIGHT, LUMINESCENT_ALGAE_GREEN_LIGHT,
    ECTOPLASM_LIGHT, UNICORN_POOP_LIGHT, EMBER_LIGHT,
    FIRE_LIGHT, BRIMSTONE_FIRE_LIGHT, EXPLOSION_LIGHT, INCENDIARY_DART_LIGHT,
    PORTAL_ACTIVATE_LIGHT, CONFUSION_GAS_LIGHT, DARKNESS_CLOUD_LIGHT,
    FORCEFIELD_LIGHT, CRYSTAL_WALL_LIGHT, CANDLE_LIGHT, HAUNTED_TORCH_LIGHT,
    GLYPH_LIGHT_DIM, GLYPH_LIGHT_BRIGHT, SACRED_GLYPH_LIGHT,
    DESCENT_LIGHT, DEMONIC_STATUE_LIGHT,
    NUMBER_LIGHT_KINDS,
}

// ===== itemCategory =====
// Uses Fl() for bitfield categories

export const ItemCategory = {
    FOOD:       Fl(0),
    WEAPON:     Fl(1),
    ARMOR:      Fl(2),
    POTION:     Fl(3),
    SCROLL:     Fl(4),
    STAFF:      Fl(5),
    WAND:       Fl(6),
    RING:       Fl(7),
    CHARM:      Fl(8),
    GOLD:       Fl(9),
    AMULET:     Fl(10),
    GEM:        Fl(11),
    KEY:        Fl(12),
} as const;

// Composite item categories
export const HAS_INTRINSIC_POLARITY = (ItemCategory.POTION | ItemCategory.SCROLL | ItemCategory.RING | ItemCategory.WAND | ItemCategory.STAFF) >>> 0;
export const CAN_BE_DETECTED = (ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.POTION | ItemCategory.SCROLL | ItemCategory.RING | ItemCategory.CHARM | ItemCategory.WAND | ItemCategory.STAFF | ItemCategory.AMULET) >>> 0;
export const CAN_BE_ENCHANTED = (ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.RING | ItemCategory.CHARM | ItemCategory.WAND | ItemCategory.STAFF) >>> 0;
export const PRENAMED_CATEGORY = (ItemCategory.FOOD | ItemCategory.GOLD | ItemCategory.AMULET | ItemCategory.GEM | ItemCategory.KEY) >>> 0;
export const NEVER_IDENTIFIABLE = (ItemCategory.FOOD | ItemCategory.CHARM | ItemCategory.GOLD | ItemCategory.AMULET | ItemCategory.GEM | ItemCategory.KEY) >>> 0;
export const CAN_BE_SWAPPED = (ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.STAFF | ItemCategory.CHARM | ItemCategory.RING) >>> 0;
export const ALL_ITEMS = (ItemCategory.FOOD | ItemCategory.POTION | ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.STAFF | ItemCategory.WAND | ItemCategory.SCROLL | ItemCategory.RING | ItemCategory.CHARM | ItemCategory.GOLD | ItemCategory.AMULET | ItemCategory.GEM | ItemCategory.KEY) >>> 0;

// ===== keyKind =====

export enum KeyKind {
    Door,
    Cage,
    Portal,
    NumberKeyTypes,
}

// ===== foodKind =====

export enum FoodKind {
    Ration,
    Fruit,
    NumberFoodKinds,
}

// ===== potionKind =====

export enum PotionKind {
    Life, Strength, Telepathy, Levitation, DetectMagic, HasteSelf,
    FireImmunity, Invisibility, Poison, Paralysis, Hallucination,
    Confusion, Incineration, Darkness, Descent, Lichen,
}

// ===== weaponKind =====

export enum WeaponKind {
    Dagger, Sword, Broadsword,
    Whip, Rapier, Flail,
    Mace, Hammer,
    Spear, Pike,
    Axe, WarAxe,
    Dart, IncendiaryDart, Javelin,
    NumberWeaponKinds,
}

// ===== weaponEnchants =====

export enum WeaponEnchant {
    Speed,
    Quietus,
    Paralysis,
    Multiplicity,
    Slowing,
    Confusion,
    Force,
    Slaying,
    Mercy,
    NumberGoodWeaponEnchantKinds = Mercy,
    Plenty,
    NumberWeaponRunicKinds,
}

// ===== armorKind =====

export enum ArmorKind {
    LeatherArmor,
    ScaleMail,
    ChainMail,
    BandedMail,
    SplintMail,
    PlateMail,
    NumberArmorKinds,
}

// ===== armorEnchants =====

export enum ArmorEnchant {
    Multiplicity,
    Mutuality,
    Absorption,
    Reprisal,
    Immunity,
    Reflection,
    Respiration,
    Dampening,
    Burden,
    NumberGoodArmorEnchantKinds = Burden,
    Vulnerability,
    Immolation,
    NumberArmorEnchantKinds,
}

// ===== wandKind =====

export enum WandKind {
    Teleport, Slow, Polymorph, Negation, Domination,
    Beckoning, Plenty, Invisibility, Empowerment,
}

// ===== staffKind =====

export enum StaffKind {
    Lightning, Fire, Poison, Tunneling, Blinking,
    Entrancement, Obstruction, Discord, Conjuration,
    Healing,
    NumberGoodStaffKinds = Healing,
    Haste,
    Protection,
    NumberStaffKinds,
}

// ===== boltType =====

export enum BoltType {
    NONE = 0,
    TELEPORT, SLOW, POLYMORPH, NEGATION, DOMINATION, BECKONING,
    PLENTY, INVISIBILITY, EMPOWERMENT,
    LIGHTNING, FIRE, POISON, TUNNELING, BLINKING, ENTRANCEMENT,
    OBSTRUCTION, DISCORD, CONJURATION, HEALING, HASTE,
    SLOW_2, SHIELDING, SPIDERWEB, SPARK, DRAGONFIRE,
    DISTANCE_ATTACK, POISON_DART, ANCIENT_SPIRIT_VINES, WHIP,
}

// ===== ringKind =====

export enum RingKind {
    Clairvoyance, Stealth, Regeneration, Transference,
    Light, Awareness, Wisdom, Reaping,
    NumberRingKinds,
}

// ===== charmKind =====

export enum CharmKind {
    Health, Protection, Haste, FireImmunity, Invisibility,
    Telepathy, Levitation, Shattering, Guardian,
    Teleportation, Recharging, Negation,
}

// ===== scrollKind =====

export enum ScrollKind {
    Enchanting, Identify, Teleport, RemoveCurse, Recharging,
    ProtectArmor, ProtectWeapon, Sanctuary, MagicMapping,
    Negation, Shattering, Discord, AggravateMonster, SummonMonster,
}

// ===== monsterTypes =====

export enum MonsterType {
    MK_YOU,
    MK_RAT, MK_KOBOLD, MK_JACKAL, MK_EEL, MK_MONKEY,
    MK_BLOAT, MK_PIT_BLOAT, MK_GOBLIN, MK_GOBLIN_CONJURER,
    MK_GOBLIN_MYSTIC, MK_GOBLIN_TOTEM, MK_PINK_JELLY, MK_TOAD,
    MK_VAMPIRE_BAT, MK_ARROW_TURRET, MK_ACID_MOUND, MK_CENTIPEDE,
    MK_OGRE, MK_BOG_MONSTER, MK_OGRE_TOTEM, MK_SPIDER,
    MK_SPARK_TURRET, MK_WILL_O_THE_WISP, MK_WRAITH, MK_ZOMBIE,
    MK_TROLL, MK_OGRE_SHAMAN, MK_NAGA, MK_SALAMANDER,
    MK_EXPLOSIVE_BLOAT, MK_DAR_BLADEMASTER, MK_DAR_PRIESTESS,
    MK_DAR_BATTLEMAGE, MK_ACID_JELLY, MK_CENTAUR, MK_UNDERWORM,
    MK_SENTINEL, MK_DART_TURRET, MK_KRAKEN, MK_LICH, MK_PHYLACTERY,
    MK_PIXIE, MK_PHANTOM, MK_FLAME_TURRET, MK_IMP, MK_FURY,
    MK_REVENANT, MK_TENTACLE_HORROR, MK_GOLEM, MK_DRAGON,
    MK_GOBLIN_CHIEFTAN, MK_BLACK_JELLY, MK_VAMPIRE, MK_FLAMEDANCER,
    MK_SPECTRAL_BLADE, MK_SPECTRAL_IMAGE, MK_GUARDIAN, MK_WINGED_GUARDIAN,
    MK_CHARM_GUARDIAN, MK_WARDEN_OF_YENDOR, MK_ELDRITCH_TOTEM,
    MK_MIRRORED_TOTEM,
    MK_UNICORN, MK_IFRIT, MK_PHOENIX, MK_PHOENIX_EGG, MK_ANCIENT_SPIRIT,
    NUMBER_MONSTER_KINDS,
}

// ===== dungeonFeatureTypes =====

export enum DungeonFeatureType {
    DF_GRANITE_COLUMN = 1,
    DF_CRYSTAL_WALL, DF_LUMINESCENT_FUNGUS, DF_GRASS, DF_DEAD_GRASS,
    DF_BONES, DF_RUBBLE, DF_FOLIAGE, DF_FUNGUS_FOREST, DF_DEAD_FOLIAGE,
    DF_SUNLIGHT, DF_DARKNESS,
    DF_SHOW_DOOR, DF_SHOW_POISON_GAS_TRAP, DF_SHOW_PARALYSIS_GAS_TRAP,
    DF_SHOW_TRAPDOOR_HALO, DF_SHOW_TRAPDOOR, DF_SHOW_CONFUSION_GAS_TRAP,
    DF_SHOW_FLAMETHROWER_TRAP, DF_SHOW_FLOOD_TRAP, DF_SHOW_NET_TRAP,
    DF_SHOW_ALARM_TRAP,
    DF_RED_BLOOD, DF_GREEN_BLOOD, DF_PURPLE_BLOOD, DF_WORM_BLOOD,
    DF_ACID_BLOOD, DF_ASH_BLOOD, DF_EMBER_BLOOD, DF_ECTOPLASM_BLOOD,
    DF_RUBBLE_BLOOD, DF_ROT_GAS_BLOOD,
    DF_VOMIT, DF_BLOAT_DEATH, DF_BLOAT_EXPLOSION, DF_BLOOD_EXPLOSION,
    DF_FLAMEDANCER_CORONA,
    DF_MUTATION_EXPLOSION, DF_MUTATION_LICHEN,
    DF_REPEL_CREATURES, DF_ROT_GAS_PUFF, DF_STEAM_PUFF, DF_STEAM_ACCUMULATION,
    DF_METHANE_GAS_PUFF, DF_SALAMANDER_FLAME, DF_URINE, DF_UNICORN_POOP,
    DF_PUDDLE, DF_ASH, DF_ECTOPLASM_DROPLET,
    DF_FORCEFIELD, DF_FORCEFIELD_MELT, DF_SACRED_GLYPHS,
    DF_LICHEN_GROW, DF_TUNNELIZE, DF_SHATTERING_SPELL,
    DF_WEB_SMALL, DF_WEB_LARGE,
    DF_ANCIENT_SPIRIT_VINES, DF_ANCIENT_SPIRIT_GRASS,
    DF_TRAMPLED_FOLIAGE, DF_SMALL_DEAD_GRASS, DF_FOLIAGE_REGROW,
    DF_TRAMPLED_FUNGUS_FOREST, DF_FUNGUS_FOREST_REGROW,
    DF_ACTIVE_BRIMSTONE, DF_INERT_BRIMSTONE,
    DF_BLOODFLOWER_PODS_GROW_INITIAL, DF_BLOODFLOWER_PODS_GROW, DF_BLOODFLOWER_POD_BURST,
    DF_DEWAR_CAUSTIC, DF_DEWAR_CONFUSION, DF_DEWAR_PARALYSIS, DF_DEWAR_METHANE,
    DF_DEWAR_GLASS, DF_CARPET_AREA,
    DF_BUILD_ALGAE_WELL, DF_ALGAE_1, DF_ALGAE_2, DF_ALGAE_REVERT,
    DF_OPEN_DOOR, DF_CLOSED_DOOR, DF_OPEN_IRON_DOOR_INERT,
    DF_ITEM_CAGE_OPEN, DF_ITEM_CAGE_CLOSE,
    DF_ALTAR_INERT, DF_ALTAR_RETRACT, DF_PORTAL_ACTIVATE,
    DF_INACTIVE_GLYPH, DF_ACTIVE_GLYPH, DF_SILENT_GLYPH_GLOW,
    DF_GUARDIAN_STEP, DF_MIRROR_TOTEM_STEP, DF_GLYPH_CIRCLE,
    DF_REVEAL_LEVER, DF_PULL_LEVER, DF_CREATE_LEVER,
    DF_BRIDGE_FALL_PREP, DF_BRIDGE_FALL,
    DF_PLAIN_FIRE, DF_GAS_FIRE, DF_EXPLOSION_FIRE, DF_DART_EXPLOSION,
    DF_BRIMSTONE_FIRE, DF_BRIDGE_FIRE, DF_FLAMETHROWER, DF_EMBERS,
    DF_EMBERS_PATCH, DF_OBSIDIAN, DF_ITEM_FIRE, DF_CREATURE_FIRE,
    DF_FLOOD, DF_FLOOD_2, DF_FLOOD_DRAIN, DF_HOLE_2, DF_HOLE_DRAIN,
    DF_DEEP_WATER_FREEZE, DF_ALGAE_1_FREEZE, DF_ALGAE_2_FREEZE,
    DF_DEEP_WATER_MELTING, DF_DEEP_WATER_THAW,
    DF_SHALLOW_WATER_FREEZE, DF_SHALLOW_WATER_MELTING, DF_SHALLOW_WATER_THAW,
    DF_POISON_GAS_CLOUD, DF_CONFUSION_GAS_TRAP_CLOUD, DF_NET,
    DF_AGGRAVATE_TRAP, DF_METHANE_GAS_ARMAGEDDON,
    DF_POISON_GAS_CLOUD_POTION, DF_PARALYSIS_GAS_CLOUD_POTION,
    DF_CONFUSION_GAS_CLOUD_POTION, DF_INCINERATION_POTION,
    DF_DARKNESS_POTION, DF_HOLE_POTION, DF_LICHEN_PLANTED,
    DF_ARMOR_IMMOLATION, DF_STAFF_HOLE, DF_STAFF_HOLE_EDGE,
    DF_ALTAR_COMMUTE, DF_MAGIC_PIPING, DF_INERT_PIPE,
    DF_ALTAR_RESURRECT, DF_MACHINE_FLOOR_TRIGGER_REPEATING,
    DF_SACRIFICE_ALTAR, DF_SACRIFICE_COMPLETE, DF_SACRIFICE_CAGE_ACTIVE,
    DF_COFFIN_BURSTS, DF_COFFIN_BURNS, DF_TRIGGER_AREA,
    DF_CAGE_DISAPPEARS, DF_MEDIUM_HOLE, DF_MEDIUM_LAVA_POND,
    DF_MACHINE_PRESSURE_PLATE_USED,
    DF_WALL_CRACK, DF_WOODEN_BARRICADE_BURN,
    DF_SURROUND_WOODEN_BARRICADE,
    DF_SPREADABLE_WATER, DF_SHALLOW_WATER, DF_WATER_SPREADS,
    DF_SPREADABLE_WATER_POOL, DF_SPREADABLE_DEEP_WATER_POOL,
    DF_SPREADABLE_COLLAPSE, DF_COLLAPSE, DF_COLLAPSE_SPREADS,
    DF_ADD_MACHINE_COLLAPSE_EDGE_DORMANT,
    DF_BRIDGE_ACTIVATE, DF_BRIDGE_ACTIVATE_ANNOUNCE, DF_BRIDGE_APPEARS,
    DF_ADD_DORMANT_CHASM_HALO,
    DF_LAVA_RETRACTABLE, DF_RETRACTING_LAVA, DF_OBSIDIAN_WITH_STEAM,
    DF_SHOW_POISON_GAS_VENT, DF_POISON_GAS_VENT_OPEN,
    DF_ACTIVATE_PORTCULLIS, DF_OPEN_PORTCULLIS, DF_VENT_SPEW_POISON_GAS,
    DF_SHOW_METHANE_VENT, DF_METHANE_VENT_OPEN, DF_VENT_SPEW_METHANE,
    DF_PILOT_LIGHT,
    DF_DISCOVER_PARALYSIS_VENT, DF_PARALYSIS_VENT_SPEW,
    DF_REVEAL_PARALYSIS_VENT_SILENTLY,
    DF_AMBIENT_BLOOD,
    DF_CRACKING_STATUE, DF_STATUE_SHATTER,
    DF_TURRET_EMERGE,
    DF_WORM_TUNNEL_MARKER_DORMANT, DF_WORM_TUNNEL_MARKER_ACTIVE,
    DF_GRANITE_CRUMBLES, DF_WALL_OPEN,
    DF_DARKENING_FLOOR, DF_DARK_FLOOR, DF_HAUNTED_TORCH_TRANSITION, DF_HAUNTED_TORCH,
    DF_MUD_DORMANT, DF_MUD_ACTIVATE,
    DF_ELECTRIC_CRYSTAL_ON, DF_TURRET_LEVER,
    DF_SHALLOW_WATER_POOL, DF_DEEP_WATER_POOL,
    DF_SWAMP_WATER, DF_SWAMP, DF_SWAMP_MUD,
    DF_HAY, DF_JUNK,
    DF_REMNANT, DF_REMNANT_ASH,
    DF_CHASM_HOLE, DF_CATWALK_BRIDGE,
    DF_LAKE_CELL, DF_LAKE_HALO,
    DF_WALL_SHATTER,
    DF_MONSTER_CAGE_OPENS,
    DF_STENCH_BURN, DF_STENCH_SMOLDER,
    NUMBER_DUNGEON_FEATURES,
}

// ===== dungeonProfileTypes =====

export enum DungeonProfileType {
    Basic,
    BasicFirstRoom,
    GoblinWarren,
    SentinelSanctuary,
    NumberDungeonProfiles,
}

// ===== boltEffects =====

export enum BoltEffect {
    None, Attack, Teleport, Slow, Polymorph, Negation,
    Domination, Beckoning, Plenty, Invisibility, Empowerment,
    Damage, Poison, Tunneling, Blinking, Entrancement,
    Obstruction, Discord, Conjuration, Healing, Haste, Shielding,
}

// ===== statusEffects =====

export enum StatusEffect {
    Searching = 0,
    Donning, Weakened, Telepathic, Hallucinating, Levitating,
    Slowed, Hasted, Confused, Burning, Paralyzed, Poisoned,
    Stuck, Nauseous, Discordant, ImmuneToFire, ExplosionImmunity,
    Nutrition, EntersLevelIn, Enraged, MagicalFear, Entranced,
    Darkness, LifespanRemaining, Shielded, Invisible, Aggravating,
    NumberOfStatusEffects,
}

// ===== dungeonLayers =====

export enum DungeonLayer {
    NoLayer = -1,
    Dungeon = 0,
    Liquid,
    Gas,
    Surface,
    NumberTerrainLayers,
}

// ===== creatureStates =====

export enum CreatureState {
    Sleeping,
    TrackingScent,
    Wandering,
    Fleeing,
    Ally,
}

// ===== creatureModes =====

export enum CreatureMode {
    Normal,
    PermFleeing,
}

// ===== NGCommands =====

export enum NGCommand {
    Nothing = 0,
    FlyoutPlay, FlyoutView, FlyoutOptions,
    GameVariant, GameMode,
    NewGame, NewGameWithSeed, OpenGame, ViewRecording,
    HighScores, GameStats, Quit,
}

// ===== featTypes =====

export enum FeatType {
    PureMage = 0,
    PureWarrior, Companion, Specialist, Jellymancer,
    DragonSlayer, Paladin, Tone,
}

// ===== exitStatus =====

export enum ExitStatus {
    Success,
    FailureRecordingWrongVersion,
    FailureRecordingOOS,
    FailurePlatformError,
}

// ===== gameMode =====

export enum GameMode {
    Normal,
    Wizard,
    Easy,
}

// ===== machineTypes =====

export enum MachineType {
    // Reward rooms
    RewardMultiLibrary = 1,
    RewardMonoLibrary, RewardConsumables,
    RewardPedestalsPermanent, RewardPedestalsConsumable,
    RewardCommutationAltars, RewardResurrectionAltar,
    RewardAdoptedItem, RewardDungeon, RewardKennel,
    RewardVampireLair, RewardAstralPortal, RewardGoblinWarren,
    RewardSentinelSanctuary,
    // Amulet
    AmuletArea,
    // Door guards
    LockedDoorVestibule, SecretDoorVestibule, SecretLeverVestibule,
    FlammableBarricadeVestibule, StatueShatteringVestibule,
    StatueMonsterVestibule, ThrowingTutorialVestibule,
    PitTrapsVestibule, BeckoningObstacleVestibule, GuardianVestibule,
    // Key guards
    KeyRewardLibrary, KeySecretRoom, KeyThrowingTutorialArea,
    KeyRatTrapRoom, KeyFireTransportationRoom, KeyFloodTrapRoom,
    KeyFireTrapRoom, KeyThiefArea, KeyCollapsingFloorArea,
    KeyPitTrapRoom, KeyLevitationRoom, KeyWebClimbingRoom,
    KeyLavaMoatRoom, KeyLavaMoatArea, KeyPoisonGasTrapRoom,
    KeyExplosiveTrapRoom, KeyBurningTrapRoom, KeyStatuaryTrapArea,
    KeyGuardianWaterPuzzleRoom, KeyGuardianGauntletRoom,
    KeyGuardianCorridorRoom, KeySacrificeRoom,
    KeySummoningCircleRoom, KeyBeckoningObstacleRoom,
    KeyWormTrapArea, KeyMudTrapRoom, KeyElectricCrystalsRoom,
    KeyZombieTrapRoom, KeyPhantomTrapRoom, KeyWormTunnelRoom,
    KeyTurretTrapRoom, KeyBossRoom,
    // Thematic
    BloodflowerArea, ShrineArea, IdyllArea, SwampArea, CampArea,
    RemnantArea, DismalArea, BridgeTurretArea, LakePathTurretArea,
    ParalysisTrapArea, ParalysisTrapHiddenArea, TrickStatueArea,
    WormArea, SentinelArea,
    // Variant-specific
    RewardHeavyOrRunicWeapon,
}

// ===== buttonDrawStates =====

export enum ButtonDrawState {
    Normal = 0,
    Hover,
    Pressed,
}

// ===== autoTargetMode =====

export enum AutoTargetMode {
    None,
    UseStaffOrWand,
    Throw,
    Explore,
}
