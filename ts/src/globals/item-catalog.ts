/*
 *  item-catalog.ts — Item table catalog data (Brogue variant)
 *  brogue-ts
 *
 *  Ported from: src/brogue/Globals.c (keyTable, foodTable, weaponTable,
 *  armorTable, staffTable, ringTable) and src/variants/GlobalsBrogue.c
 *  (potionTable, scrollTable, wandTable, charmTable, charmEffectTable,
 *  itemGenerationProbabilities, meteredItemsGenerationTable,
 *  lumenstoneDistribution).
 *
 *  NOTE: staffTable and ringTable use runtime-shuffled flavor arrays
 *  (itemWoods, itemGems). In the C code, these are mutable string arrays
 *  that get shuffled each game by shuffleFlavors(). Here, we store the
 *  initial (pre-shuffle) flavor values. The item system's shuffleFlavors()
 *  function will create mutable copies at runtime.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { ItemTable, MeteredItemGenerationTable, CharmEffectTableEntry } from "../types/types.js";
import type { Fixpt } from "../types/types.js";
import { BoltType, CharmKind, PotionKind, ScrollKind } from "../types/enums.js";
import { ItemCategory } from "../types/enums.js";
import { FP_FACTOR } from "../math/fixpt.js";

// =============================================================================
// Flavor reference arrays — these are the initial values that get shuffled
// per game by shuffleFlavors(). Imported from string-tables.ts at runtime.
// For the catalog definitions here, we use the un-shuffled index.
// =============================================================================

import {
    itemColorsRef, itemWoodsRef, itemMetalsRef, itemGemsRef,
} from "./string-tables.js";

// =============================================================================
// Pre-computed charm effect duration increment tables (from GlobalsBrogue.c)
// These are the POW_*_CHARM_INCREMENT arrays used by charmEffectTable.
// =============================================================================

/** No increment (constant duration). 51 entries, all 1.0 in fixed-point. */
const POW_0_CHARM_INCREMENT: readonly Fixpt[] = Object.freeze(
    Array.from({ length: 51 }, () => 65536n),
);

/** 1.20^x for x=1..51 in fixed-point. Verbatim from GlobalsBase.c. */
const POW_120_CHARM_INCREMENT: readonly Fixpt[] = Object.freeze([
    78643n, 94371n, 113246n, 135895n, 163074n, 195689n, 234827n, 281792n,
    338151n, 405781n, 486937n, 584325n, 701190n, 841428n, 1009714n, 1211657n,
    1453988n, 1744786n, 2093744n, 2512492n, 3014991n, 3617989n, 4341587n,
    5209905n, 6251886n, 7502263n, 9002716n, 10803259n, 12963911n, 15556694n,
    18668032n, 22401639n, 26881967n, 32258360n, 38710033n, 46452039n,
    55742447n, 66890937n, 80269124n, 96322949n, 115587539n, 138705047n,
    166446056n, 199735268n, 239682321n, 287618785n, 345142543n, 414171051n,
    497005262n, 596406314n, 715687577n,
]);

/** 1.25^x for x=1..51 in fixed-point. Verbatim from GlobalsBase.c. */
const POW_125_CHARM_INCREMENT: readonly Fixpt[] = Object.freeze([
    81920n, 102400n, 128000n, 160000n, 200000n, 250000n, 312500n, 390625n,
    488281n, 610351n, 762939n, 953674n, 1192092n, 1490116n, 1862645n,
    2328306n, 2910383n, 3637978n, 4547473n, 5684341n, 7105427n, 8881784n,
    11102230n, 13877787n, 17347234n, 21684043n, 27105054n, 33881317n,
    42351647n, 52939559n, 66174449n, 82718061n, 103397576n, 129246970n,
    161558713n, 201948391n, 252435489n, 315544362n, 394430452n, 493038065n,
    616297582n, 770371977n, 962964972n, 1203706215n, 1504632769n,
    1880790961n, 2350988701n, 2938735877n, 3673419846n, 4591774807n,
    5739718509n,
]);

// =============================================================================
// Key table (from Globals.c) — base game, not variant-specific
// =============================================================================

export const keyTable: readonly ItemTable[] = Object.freeze([
    {
        name: "door key", flavor: "", callTitle: "",
        frequency: 1, marketValue: 0, strengthRequired: 0, power: 0,
        range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false,
        description: "The notches on this ancient iron key are well worn; its leather lanyard is battered by age. What door might it open?",
    },
    {
        name: "cage key", flavor: "", callTitle: "",
        frequency: 1, marketValue: 0, strengthRequired: 0, power: 0,
        range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false,
        description: "The rust accreted on this iron key has been stained with flecks of blood; it must have been used recently. What cage might it open?",
    },
    {
        name: "crystal orb", flavor: "", callTitle: "",
        frequency: 1, marketValue: 0, strengthRequired: 0, power: 0,
        range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false,
        description: "A faceted orb, seemingly cut from a single crystal, sparkling and perpetually warm to the touch. What manner of device might such an object activate?",
    },
]);

// =============================================================================
// Food table (from Globals.c)
// =============================================================================

export const foodTable: readonly ItemTable[] = Object.freeze([
    {
        name: "ration of food", flavor: "", callTitle: "",
        frequency: 3, marketValue: 25, strengthRequired: 0, power: 1800,
        range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false,
        description: "A ration of food. Was it left by former adventurers? Is it a curious byproduct of the subterranean ecosystem?",
    },
    {
        name: "mango", flavor: "", callTitle: "",
        frequency: 1, marketValue: 15, strengthRequired: 0, power: 1550,
        range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 },
        identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false,
        description: "An odd fruit to be found so deep beneath the surface of the earth, but only slightly less filling than a ration of food.",
    },
]);

// =============================================================================
// Weapon table (from Globals.c)
// =============================================================================

export const weaponTable: readonly ItemTable[] = Object.freeze([
    // Dagger
    { name: "dagger", flavor: "", callTitle: "", frequency: 10, marketValue: 190, strengthRequired: 12, power: 0, range: { lowerBound: 3, upperBound: 4, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "A simple iron dagger with a well-worn wooden handle. Daggers will deal quintuple damage upon a successful sneak attack instead of triple damage." },
    // Sword
    { name: "sword", flavor: "", callTitle: "", frequency: 10, marketValue: 440, strengthRequired: 14, power: 0, range: { lowerBound: 7, upperBound: 9, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "The razor-sharp length of steel blade shines reassuringly." },
    // Broadsword
    { name: "broadsword", flavor: "", callTitle: "", frequency: 10, marketValue: 990, strengthRequired: 19, power: 0, range: { lowerBound: 14, upperBound: 22, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "This towering blade inflicts heavy damage by investing its heft into every cut." },
    // Whip
    { name: "whip", flavor: "", callTitle: "", frequency: 10, marketValue: 440, strengthRequired: 14, power: 0, range: { lowerBound: 3, upperBound: 5, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "The lash from this coil of braided leather can tear bark from trees, and it will reach opponents up to five spaces away." },
    // Rapier
    { name: "rapier", flavor: "", callTitle: "", frequency: 10, marketValue: 440, strengthRequired: 15, power: 0, range: { lowerBound: 3, upperBound: 5, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "This blade is thin and flexible, designed for deft and rapid maneuvers. It inflicts less damage than comparable weapons, but permits you to attack twice as quickly. If there is one space between you and an enemy and you step directly toward it, you will perform a devastating lunge attack, which deals triple damage and never misses." },
    // Flail
    { name: "flail", flavor: "", callTitle: "", frequency: 10, marketValue: 440, strengthRequired: 17, power: 0, range: { lowerBound: 9, upperBound: 15, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "This spiked iron ball can be whirled at the end of its chain in synchronicity with your movement, allowing you a free attack whenever moving between two spaces that are adjacent to an enemy." },
    // Mace
    { name: "mace", flavor: "", callTitle: "", frequency: 10, marketValue: 660, strengthRequired: 16, power: 0, range: { lowerBound: 16, upperBound: 20, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "The iron flanges at the head of this weapon inflict substantial damage with every weighty blow. Because of its heft, it takes an extra turn to recover when it hits, and will push your opponent backward if there is room." },
    // War hammer
    { name: "war hammer", flavor: "", callTitle: "", frequency: 10, marketValue: 1100, strengthRequired: 20, power: 0, range: { lowerBound: 25, upperBound: 35, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "Few creatures can withstand the crushing blow of this towering mass of lead and steel, but only the strongest of adventurers can effectively wield it. Because of its heft, it takes an extra turn to recover when it hits, and will push your opponent backward if there is room." },
    // Spear
    { name: "spear", flavor: "", callTitle: "", frequency: 10, marketValue: 330, strengthRequired: 13, power: 0, range: { lowerBound: 4, upperBound: 5, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "A slender wooden rod tipped with sharpened iron. The reach of the spear permits you to simultaneously attack an adjacent enemy and the enemy directly behind it." },
    // War pike
    { name: "war pike", flavor: "", callTitle: "", frequency: 10, marketValue: 880, strengthRequired: 18, power: 0, range: { lowerBound: 11, upperBound: 15, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "A long steel pole ending in a razor-sharp point. The reach of the pike permits you to simultaneously attack an adjacent enemy and the enemy directly behind it." },
    // Axe
    { name: "axe", flavor: "", callTitle: "", frequency: 10, marketValue: 550, strengthRequired: 15, power: 0, range: { lowerBound: 7, upperBound: 9, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "The blunt iron edge on this axe glints in the darkness. The arc of its swing permits you to attack all adjacent enemies simultaneously." },
    // War axe
    { name: "war axe", flavor: "", callTitle: "", frequency: 10, marketValue: 990, strengthRequired: 19, power: 0, range: { lowerBound: 12, upperBound: 17, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "The enormous steel head of this war axe puts considerable heft behind each stroke. The arc of its swing permits you to attack all adjacent enemies simultaneously." },
    // Dart
    { name: "dart", flavor: "", callTitle: "", frequency: 0, marketValue: 15, strengthRequired: 10, power: 0, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "These simple metal spikes are weighted to fly true and sting their prey with a flick of the wrist." },
    // Incendiary dart
    { name: "incendiary dart", flavor: "", callTitle: "", frequency: 10, marketValue: 25, strengthRequired: 12, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "The barbed spike on each of these darts is designed to stick to its target while the compounds strapped to its length explode into flame." },
    // Javelin
    { name: "javelin", flavor: "", callTitle: "", frequency: 10, marketValue: 40, strengthRequired: 15, power: 0, range: { lowerBound: 3, upperBound: 11, clumpFactor: 3 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "This length of metal is weighted to keep the spike at its tip foremost as it sails through the air." },
]);

// =============================================================================
// Armor table (from Globals.c)
// =============================================================================

export const armorTable: readonly ItemTable[] = Object.freeze([
    { name: "leather armor", flavor: "", callTitle: "", frequency: 10, marketValue: 250, strengthRequired: 10, power: 0, range: { lowerBound: 30, upperBound: 30, clumpFactor: 0 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "This lightweight armor offers basic protection." },
    { name: "scale mail", flavor: "", callTitle: "", frequency: 10, marketValue: 350, strengthRequired: 12, power: 0, range: { lowerBound: 40, upperBound: 40, clumpFactor: 0 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "Bronze scales cover the surface of treated leather, offering greater protection than plain leather with minimal additional weight." },
    { name: "chain mail", flavor: "", callTitle: "", frequency: 10, marketValue: 500, strengthRequired: 13, power: 0, range: { lowerBound: 50, upperBound: 50, clumpFactor: 0 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "Interlocking metal links make for a tough but flexible suit of armor." },
    { name: "banded mail", flavor: "", callTitle: "", frequency: 10, marketValue: 800, strengthRequired: 15, power: 0, range: { lowerBound: 70, upperBound: 70, clumpFactor: 0 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "Overlapping strips of metal horizontally encircle a chain mail base, offering an additional layer of protection at the cost of greater weight." },
    { name: "splint mail", flavor: "", callTitle: "", frequency: 10, marketValue: 1000, strengthRequired: 17, power: 0, range: { lowerBound: 90, upperBound: 90, clumpFactor: 0 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "Thick plates of metal are embedded into a chain mail base, providing the wearer with substantial protection." },
    { name: "plate armor", flavor: "", callTitle: "", frequency: 10, marketValue: 1300, strengthRequired: 19, power: 0, range: { lowerBound: 110, upperBound: 110, clumpFactor: 0 }, identified: true, called: false, magicPolarity: 0, magicPolarityRevealed: false, description: "Enormous plates of metal are joined together into a suit that provides unmatched protection to any adventurer strong enough to bear its staggering weight." },
]);

// =============================================================================
// Staff table (from Globals.c)
// Note: flavor fields use itemWoods indices. In C these are mutable arrays
// that get shuffled. We store the initial (pre-shuffle) reference string.
// At runtime, shuffleFlavors() creates shuffled copies.
// =============================================================================

export const staffTable: readonly ItemTable[] = Object.freeze([
    { name: "lightning", flavor: itemWoodsRef[0], callTitle: "", frequency: 15, marketValue: 1300, strengthRequired: 0, power: BoltType.LIGHTNING, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This staff conjures forth deadly arcs of electricity to damage to any number of creatures in a straight line." },
    { name: "firebolt", flavor: itemWoodsRef[1], callTitle: "", frequency: 15, marketValue: 1300, strengthRequired: 0, power: BoltType.FIRE, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This staff unleashes bursts of magical fire. It will ignite flammable terrain and burn any creature that it hits. Creatures with an immunity to fire will be unaffected by the bolt." },
    { name: "poison", flavor: itemWoodsRef[3], callTitle: "", frequency: 10, marketValue: 1200, strengthRequired: 0, power: BoltType.POISON, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "The vile blast of this twisted staff will imbue its target with a deadly venom. Each turn, a creature that is poisoned will suffer one point of damage per dose of poison it has received, and poisoned creatures will not regenerate lost health until the poison clears." },
    { name: "tunneling", flavor: itemWoodsRef[4], callTitle: "", frequency: 10, marketValue: 1000, strengthRequired: 0, power: BoltType.TUNNELING, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Bursts of magic from this staff will pass harmlessly through creatures but will reduce most obstructions to rubble." },
    { name: "blinking", flavor: itemWoodsRef[5], callTitle: "", frequency: 11, marketValue: 1200, strengthRequired: 0, power: BoltType.BLINKING, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This staff will allow you to teleport in the chosen direction. Creatures and inanimate obstructions will block the teleportation." },
    { name: "entrancement", flavor: itemWoodsRef[6], callTitle: "", frequency: 6, marketValue: 1000, strengthRequired: 0, power: BoltType.ENTRANCEMENT, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This staff will send creatures into a temporary trance, causing them to mindlessly mirror your movements. You can use the effect to cause one creature to attack another or to step into hazardous terrain, but the spell will be broken if you attack the creature under the effect." },
    { name: "obstruction", flavor: itemWoodsRef[7], callTitle: "", frequency: 10, marketValue: 1000, strengthRequired: 0, power: BoltType.OBSTRUCTION, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This staff will conjure a mass of impenetrable green crystal, preventing anything from moving through the affected area and temporarily entombing anything that is already there. The crystal will dissolve into the air as time passes. Higher level staffs will create larger obstructions." },
    { name: "discord", flavor: itemWoodsRef[8], callTitle: "", frequency: 10, marketValue: 1000, strengthRequired: 0, power: BoltType.DISCORD, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This staff will alter the perception of a creature and cause it to lash out indiscriminately. Strangers and allies alike will turn on the victim." },
    { name: "conjuration", flavor: itemWoodsRef[9], callTitle: "", frequency: 8, marketValue: 1000, strengthRequired: 0, power: BoltType.CONJURATION, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "A flick of this staff will summon a number of phantom blades to fight on your behalf." },
    { name: "healing", flavor: itemWoodsRef[10], callTitle: "", frequency: 5, marketValue: 1100, strengthRequired: 0, power: BoltType.HEALING, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This staff will heal any creature, friend or foe. Unfortunately, you cannot use this or any staff on yourself except by reflecting the bolt." },
    { name: "haste", flavor: itemWoodsRef[11], callTitle: "", frequency: 5, marketValue: 900, strengthRequired: 0, power: BoltType.HASTE, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This staff will temporarily double the speed of any creature, friend or foe. Unfortunately, you cannot use this or any staff on yourself except by reflecting the bolt." },
    { name: "protection", flavor: itemWoodsRef[12], callTitle: "", frequency: 5, marketValue: 900, strengthRequired: 0, power: BoltType.SHIELDING, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This staff will bathe a creature in a protective light that will absorb all damage until it is depleted. Unfortunately, you cannot use this or any staff on yourself except by reflecting the bolt." },
]);

// =============================================================================
// Ring table (from Globals.c)
// Note: flavor fields use itemGems indices (shuffled at runtime).
// =============================================================================

export const ringTable: readonly ItemTable[] = Object.freeze([
    { name: "clairvoyance", flavor: itemGemsRef[0], callTitle: "", frequency: 1, marketValue: 900, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of eldritch scrying will permit you to see through nearby walls and doors, within a radius determined by the level of the ring. A cursed ring of clairvoyance will blind you to your immediate surroundings." },
    { name: "stealth", flavor: itemGemsRef[1], callTitle: "", frequency: 1, marketValue: 800, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of silent passage will reduce your stealth range, making enemies less likely to notice you and more likely to lose your trail. Staying motionless and lurking in the shadows will make you even harder to spot. Cursed rings of stealth will increase your stealth range, making you easier to spot and to track." },
    { name: "regeneration", flavor: itemGemsRef[2], callTitle: "", frequency: 1, marketValue: 750, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of sacred life will allow you to recover lost health at an accelerated rate. Cursed rings will decrease or even halt your natural regeneration." },
    { name: "transference", flavor: itemGemsRef[3], callTitle: "", frequency: 1, marketValue: 750, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of blood magic will heal you in proportion to the damage you inflict on others. Cursed rings will cause you to lose health when inflicting damage." },
    { name: "light", flavor: itemGemsRef[4], callTitle: "", frequency: 1, marketValue: 600, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of preternatural vision will allow you to see farther in the dimming light of the deeper dungeon levels. It will not make you more noticeable to enemies." },
    { name: "awareness", flavor: itemGemsRef[5], callTitle: "", frequency: 1, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of effortless vigilance will enable you to notice traps, secret doors and hidden levers more often and from a greater distance. Cursed rings of awareness will dull your senses, making it harder to notice secrets without actively searching for them." },
    { name: "wisdom", flavor: itemGemsRef[6], callTitle: "", frequency: 1, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of arcane power will cause your staffs to recharge at an accelerated rate. Cursed rings of wisdom will cause your staffs to recharge more slowly." },
    { name: "reaping", flavor: itemGemsRef[7], callTitle: "", frequency: 1, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 3, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ring of blood magic will recharge your staffs and charms every time you hit an enemy. Cursed rings of reaping will drain your staffs and charms with every hit." },
]);

// =============================================================================
// Potion table (from GlobalsBrogue.c) — variant-specific
// Note: flavor fields use itemColors indices (shuffled at runtime).
// =============================================================================

export const potionTable: readonly ItemTable[] = Object.freeze([
    { name: "life", flavor: itemColorsRef[1], callTitle: "", frequency: 0, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 10, upperBound: 10, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "A swirling elixir that will instantly heal you, cure you of ailments, and permanently increase your maximum health." },
    { name: "strength", flavor: itemColorsRef[2], callTitle: "", frequency: 0, marketValue: 400, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 1, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This powerful medicine will course through your muscles, permanently increasing your strength by one point." },
    { name: "telepathy", flavor: itemColorsRef[3], callTitle: "", frequency: 20, marketValue: 350, strengthRequired: 0, power: 0, range: { lowerBound: 300, upperBound: 300, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This mysterious liquid will attune your mind to the psychic signature of distant creatures. Its effects will not reveal inanimate objects, such as totems, turrets and traps." },
    { name: "levitation", flavor: itemColorsRef[4], callTitle: "", frequency: 15, marketValue: 250, strengthRequired: 0, power: 0, range: { lowerBound: 100, upperBound: 100, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This curious liquid will cause you to hover in the air, able to drift effortlessly over lava, water, chasms and traps. Flames, gases and spiderwebs fill the air, and cannot be bypassed while airborne. Creatures that dwell in water or mud will be unable to attack you while you levitate." },
    { name: "detect magic", flavor: itemColorsRef[5], callTitle: "", frequency: 20, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This mysterious brew will sensitize your mind to the radiance of magic. Items imbued with helpful enchantments will be marked with a full sigil; items corrupted by curses or designed to bring misfortune upon the bearer will be marked with a hollow sigil. The Amulet of Yendor will be revealed by its unique aura." },
    { name: "speed", flavor: itemColorsRef[6], callTitle: "", frequency: 10, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 25, upperBound: 25, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Quaffing the contents of this flask will enable you to move at blinding speed for several minutes." },
    { name: "fire immunity", flavor: itemColorsRef[7], callTitle: "", frequency: 15, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 150, upperBound: 150, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This potion will render you impervious to heat and permit you to wander through fire and lava and ignore otherwise deadly bolts of flame. It will not guard against the concussive impact of an explosion, however." },
    { name: "invisibility", flavor: itemColorsRef[8], callTitle: "", frequency: 15, marketValue: 400, strengthRequired: 0, power: 0, range: { lowerBound: 75, upperBound: 75, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Drinking this potion will render you temporarily invisible. Enemies more than two spaces away will be unable to track you." },
    { name: "caustic gas", flavor: itemColorsRef[9], callTitle: "", frequency: 15, marketValue: 200, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "Uncorking or shattering this pressurized glass will cause its contents to explode into a deadly cloud of caustic purple gas. You might choose to fling this potion at distant enemies instead of uncorking it by hand." },
    { name: "paralysis", flavor: itemColorsRef[10], callTitle: "", frequency: 10, marketValue: 250, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "Upon exposure to open air, the liquid in this flask will vaporize into a numbing pink haze. Anyone who inhales the cloud will be paralyzed instantly, unable to move for some time after the cloud dissipates. This item can be thrown at distant enemies to catch them within the effect of the gas." },
    { name: "hallucination", flavor: itemColorsRef[11], callTitle: "", frequency: 10, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 300, upperBound: 300, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This flask contains a vicious and long-lasting hallucinogen. Under its dazzling effect, you will wander through a rainbow wonderland, unable to discern the form of any creatures or items you see." },
    { name: "confusion", flavor: itemColorsRef[12], callTitle: "", frequency: 15, marketValue: 450, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This unstable chemical will quickly vaporize into a glittering cloud upon contact with open air, causing any creature that inhales it to lose control of the direction of its movements until the effect wears off (although its ability to aim projectile attacks will not be affected). Its vertiginous intoxication can cause creatures and adventurers to careen into one another or into chasms or lava pits, so extreme care should be taken when under its effect. Its contents can be weaponized by throwing the flask at distant enemies." },
    { name: "incineration", flavor: itemColorsRef[13], callTitle: "", frequency: 15, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This flask contains an unstable compound which will burst violently into flame upon exposure to open air. You might throw the flask at distant enemies -- or into a deep lake, to cleanse the cavern with scalding steam." },
    { name: "darkness", flavor: itemColorsRef[14], callTitle: "", frequency: 7, marketValue: 150, strengthRequired: 0, power: 0, range: { lowerBound: 400, upperBound: 400, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "Drinking this potion will plunge you into darkness. At first, you will be completely blind to anything not illuminated by an independent light source, but over time your vision will regain its former strength. Throwing the potion will create a cloud of supernatural darkness, and enemies will have difficulty seeing or following you if you take refuge under its cover." },
    { name: "descent", flavor: itemColorsRef[15], callTitle: "", frequency: 15, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "When this flask is uncorked by hand or shattered by being thrown, the fog that seeps out will temporarily cause the ground in the vicinity to vanish." },
    { name: "creeping death", flavor: itemColorsRef[16], callTitle: "", frequency: 7, marketValue: 450, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "When the cork is popped or the flask is thrown, tiny spores will spill across the ground and begin to grow a deadly lichen. Anything that touches the lichen will be poisoned by its clinging tendrils, and the lichen will slowly grow to fill the area. Fire will purge the infestation." },
]);

// =============================================================================
// Scroll table (from GlobalsBrogue.c) — variant-specific
// Note: flavor fields use itemTitles (generated at runtime by shuffleFlavors).
// We store empty strings here; they get filled by shuffleFlavors().
// =============================================================================

export const scrollTable: readonly ItemTable[] = Object.freeze([
    { name: "enchanting", flavor: "", callTitle: "", frequency: 0, marketValue: 550, strengthRequired: 0, power: 1, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ancient enchanting sorcery will imbue a single item with a powerful and permanent magical charge. A staff will increase in power and in number of charges; a weapon will inflict more damage and find its mark more easily; a suit of armor will deflect attacks more often; the magic of a ring will intensify; and a wand will gain expendable charges in the least amount that such a wand can be found with. Weapons and armor will also require less strength to use, and any curses on the item will be lifted." },
    { name: "identify", flavor: "", callTitle: "", frequency: 30, marketValue: 300, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This scrying magic will permanently reveal all of the secrets of a single item." },
    { name: "teleportation", flavor: "", callTitle: "", frequency: 10, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This escape spell will instantly relocate you to a random location on the dungeon level. It can be used to escape a dangerous situation with luck. The unlucky reader might find himself in an even more dangerous place." },
    { name: "remove curse", flavor: "", callTitle: "", frequency: 15, marketValue: 150, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This redemption spell will instantly strip from the reader's weapon, armor, rings and carried items any evil enchantments that might prevent the wearer from removing them." },
    { name: "recharging", flavor: "", callTitle: "", frequency: 12, marketValue: 375, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "The power bound up in this parchment will instantly recharge all of your staffs and charms." },
    { name: "protect armor", flavor: "", callTitle: "", frequency: 10, marketValue: 400, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ceremonial shielding magic will permanently proof your armor against degradation by acid." },
    { name: "protect weapon", flavor: "", callTitle: "", frequency: 10, marketValue: 400, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This ceremonial shielding magic will permanently proof your weapon against degradation by acid." },
    { name: "sanctuary", flavor: "", callTitle: "", frequency: 10, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This protection rite will imbue the area with powerful warding glyphs, when released over plain ground. Monsters will not willingly set foot on the affected area." },
    { name: "magic mapping", flavor: "", callTitle: "", frequency: 12, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This powerful scouting magic will etch a purple-hued image of crystal clarity into your memory, alerting you to the precise layout of the level and revealing all traps, secret doors and hidden levers." },
    { name: "negation", flavor: "", callTitle: "", frequency: 8, marketValue: 400, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "When this powerful anti-magic is released, all creatures (including yourself) and all items lying on the ground within your field of view will be exposed to its blast and stripped of magic. Creatures animated purely by magic will die. Potions, scrolls, items being held by other creatures and items in your inventory will not be affected." },
    { name: "shattering", flavor: "", callTitle: "", frequency: 8, marketValue: 500, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This strange incantation will alter the physical structure of nearby stone, causing it to evaporate into the air over the ensuing minutes." },
    { name: "discord", flavor: "", callTitle: "", frequency: 8, marketValue: 400, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This scroll will unleash a powerful blast of mind magic. Any creatures within line of sight will turn against their companions and attack indiscriminately for 30 turns." },
    { name: "aggravate monsters", flavor: "", callTitle: "", frequency: 15, marketValue: 50, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This scroll will unleash a piercing shriek that will awaken all monsters and alert them to the reader's location." },
    { name: "summon monsters", flavor: "", callTitle: "", frequency: 10, marketValue: 50, strengthRequired: 0, power: 0, range: { lowerBound: 0, upperBound: 0, clumpFactor: 0 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This summoning incantation will call out to creatures in other planes of existence, drawing them through the fabric of reality to confront the reader." },
]);

// =============================================================================
// Wand table (from GlobalsBrogue.c) — variant-specific
// Note: flavor fields use itemMetals indices (shuffled at runtime).
// =============================================================================

export const wandTable: readonly ItemTable[] = Object.freeze([
    { name: "teleportation", flavor: itemMetalsRef[0], callTitle: "", frequency: 3, marketValue: 800, strengthRequired: 0, power: BoltType.TELEPORT, range: { lowerBound: 3, upperBound: 5, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This wand will teleport a creature to a random place on the level. Aquatic or mud-bound creatures will be rendered helpless on dry land." },
    { name: "slowness", flavor: itemMetalsRef[1], callTitle: "", frequency: 3, marketValue: 800, strengthRequired: 0, power: BoltType.SLOW, range: { lowerBound: 2, upperBound: 5, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This wand will cause a creature to move at half its ordinary speed for 30 turns." },
    { name: "polymorphism", flavor: itemMetalsRef[2], callTitle: "", frequency: 3, marketValue: 700, strengthRequired: 0, power: BoltType.POLYMORPH, range: { lowerBound: 3, upperBound: 5, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This mischievous magic will transform a creature into another creature at random. Beware: the tamest of creatures might turn into the most fearsome. The horror of the transformation will turn an allied victim against you." },
    { name: "negation", flavor: itemMetalsRef[3], callTitle: "", frequency: 3, marketValue: 550, strengthRequired: 0, power: BoltType.NEGATION, range: { lowerBound: 4, upperBound: 6, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This powerful anti-magic will strip a creature of a host of magical traits, including flight, invisibility, acidic corrosiveness, telepathy, magical speed or slowness, hypnosis, magical fear, immunity to physical attack, fire resistance and the ability to blink. Spellcasters will lose their magical abilities and magical totems will be rendered inert. Creatures animated purely by magic will die." },
    { name: "domination", flavor: itemMetalsRef[4], callTitle: "", frequency: 1, marketValue: 1000, strengthRequired: 0, power: BoltType.DOMINATION, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This wand can forever bind an enemy to the caster's will, turning it into a steadfast ally. However, the magic only works effectively against enemies that are near death." },
    { name: "beckoning", flavor: itemMetalsRef[5], callTitle: "", frequency: 3, marketValue: 500, strengthRequired: 0, power: BoltType.BECKONING, range: { lowerBound: 2, upperBound: 4, clumpFactor: 1 }, identified: false, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "The force of this wand will draw the targeted creature into direct proximity." },
    { name: "plenty", flavor: itemMetalsRef[6], callTitle: "", frequency: 2, marketValue: 700, strengthRequired: 0, power: BoltType.PLENTY, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "The creature at the other end of this mischievous bit of cloning magic, friend or foe, will be beside itself -- literally!" },
    { name: "invisibility", flavor: itemMetalsRef[7], callTitle: "", frequency: 3, marketValue: 100, strengthRequired: 0, power: BoltType.INVISIBILITY, range: { lowerBound: 3, upperBound: 5, clumpFactor: 1 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This wand will render a creature temporarily invisible to the naked eye. Only with telepathy or in the silhouette of a thick gas will an observer discern the creature's hazy outline." },
    { name: "empowerment", flavor: itemMetalsRef[8], callTitle: "", frequency: 1, marketValue: 100, strengthRequired: 0, power: BoltType.EMPOWERMENT, range: { lowerBound: 1, upperBound: 1, clumpFactor: 1 }, identified: false, called: false, magicPolarity: -1, magicPolarityRevealed: false, description: "This sacred magic will permanently improve the mind and body of any monster it hits. A wise adventurer will use it on allies, making them stronger in combat and able to learn a new talent from a fallen foe. If the bolt is reflected back at you, it will have no effect." },
]);

// =============================================================================
// Charm table (from GlobalsBrogue.c) — variant-specific
// =============================================================================

export const charmTable: readonly ItemTable[] = Object.freeze([
    { name: "health", flavor: "", callTitle: "", frequency: 5, marketValue: 900, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "A handful of dried bloodwort and mandrake root has been bound together with leather cord and imbued with a powerful healing magic." },
    { name: "protection", flavor: "", callTitle: "", frequency: 5, marketValue: 800, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Four copper rings have been joined into a tetrahedron. The construct is oddly warm to the touch." },
    { name: "haste", flavor: "", callTitle: "", frequency: 5, marketValue: 750, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Various animals have been etched into the surface of this brass bangle. It emits a barely audible hum." },
    { name: "fire immunity", flavor: "", callTitle: "", frequency: 3, marketValue: 750, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Eldritch flames flicker within this polished crystal bauble." },
    { name: "invisibility", flavor: "", callTitle: "", frequency: 5, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "A jade figurine depicts a strange humanoid creature. It has a face on both sides of its head, but all four eyes are closed." },
    { name: "telepathy", flavor: "", callTitle: "", frequency: 3, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Seven tiny glass eyes roll freely within this glass sphere. Somehow, they always come to rest facing outward." },
    { name: "levitation", flavor: "", callTitle: "", frequency: 1, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "Sparkling dust and fragments of feather waft and swirl endlessly inside this small glass sphere." },
    { name: "shattering", flavor: "", callTitle: "", frequency: 1, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "This turquoise crystal, fixed to a leather lanyard, hums with an arcane energy that sets your teeth on edge." },
    { name: "guardian", flavor: "", callTitle: "", frequency: 5, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "When you touch this tiny granite statue, a rhythmic booming echoes in your mind." },
    { name: "teleportation", flavor: "", callTitle: "", frequency: 4, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "The surface of this nickel sphere has been etched with a perfect grid pattern. Somehow, the squares of the grid are all exactly the same size." },
    { name: "recharging", flavor: "", callTitle: "", frequency: 5, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "A strip of bronze has been wound around a rough wooden sphere. Each time you touch it, you feel a tiny electric shock." },
    { name: "negation", flavor: "", callTitle: "", frequency: 5, marketValue: 700, strengthRequired: 0, power: 0, range: { lowerBound: 1, upperBound: 2, clumpFactor: 1 }, identified: true, called: false, magicPolarity: 1, magicPolarityRevealed: false, description: "A featureless gray disc hangs from a lanyard. When you touch it, your hand and arm go numb." },
]);

// =============================================================================
// Charm effect table (from GlobalsBrogue.c)
// =============================================================================

export const charmEffectTable: readonly CharmEffectTableEntry[] = Object.freeze([
    { kind: CharmKind.Health, effectDurationBase: 3, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 2500, rechargeDelayBase: Number(FP_FACTOR * 55n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 20 },
    { kind: CharmKind.Protection, effectDurationBase: 20, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 1000, rechargeDelayBase: Number(FP_FACTOR * 60n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 150 },
    { kind: CharmKind.Haste, effectDurationBase: 7, effectDurationIncrement: POW_120_CHARM_INCREMENT, rechargeDelayDuration: 800, rechargeDelayBase: Number(FP_FACTOR * 65n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.FireImmunity, effectDurationBase: 10, effectDurationIncrement: POW_125_CHARM_INCREMENT, rechargeDelayDuration: 800, rechargeDelayBase: Number(FP_FACTOR * 60n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Invisibility, effectDurationBase: 5, effectDurationIncrement: POW_120_CHARM_INCREMENT, rechargeDelayDuration: 800, rechargeDelayBase: Number(FP_FACTOR * 65n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Telepathy, effectDurationBase: 25, effectDurationIncrement: POW_125_CHARM_INCREMENT, rechargeDelayDuration: 800, rechargeDelayBase: Number(FP_FACTOR * 65n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Levitation, effectDurationBase: 10, effectDurationIncrement: POW_125_CHARM_INCREMENT, rechargeDelayDuration: 800, rechargeDelayBase: Number(FP_FACTOR * 65n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Shattering, effectDurationBase: 0, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 2500, rechargeDelayBase: Number(FP_FACTOR * 60n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 4, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Guardian, effectDurationBase: 18, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 700, rechargeDelayBase: Number(FP_FACTOR * 70n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 4, effectMagnitudeMultiplier: 2 },
    { kind: CharmKind.Teleportation, effectDurationBase: 0, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 920, rechargeDelayBase: Number(FP_FACTOR * 60n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Recharging, effectDurationBase: 0, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 10000, rechargeDelayBase: Number(FP_FACTOR * 55n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 0, effectMagnitudeMultiplier: 0 },
    { kind: CharmKind.Negation, effectDurationBase: 0, effectDurationIncrement: POW_0_CHARM_INCREMENT, rechargeDelayDuration: 2500, rechargeDelayBase: Number(FP_FACTOR * 60n / 100n), rechargeDelayMinTurns: 1, effectMagnitudeConstant: 1, effectMagnitudeMultiplier: 3 },
]);

// =============================================================================
// Item generation probabilities (from GlobalsBrogue.c)
// Order: GOLD, SCROLL, POTION, STAFF, WAND, WEAPON, ARMOR, FOOD, RING, CHARM, AMULET, GEM, KEY
// =============================================================================

export const itemGenerationProbabilities: readonly number[] = Object.freeze([
    50, 42, 52, 3, 3, 10, 8, 2, 3, 2, 0, 0, 0,
]);

// =============================================================================
// Lumenstone distribution (from GlobalsBrogue.c)
// Number of lumenstones on each level past amulet (levels 27–40)
// =============================================================================

export const lumenstoneDistribution: readonly number[] = Object.freeze([
    3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1,
]);

// =============================================================================
// Metered items generation table (from GlobalsBrogue.c)
// Controls dynamic item frequency adjustment during level generation.
// =============================================================================

export const meteredItemsGenerationTable: readonly MeteredItemGenerationTable[] = Object.freeze([
    { category: ItemCategory.SCROLL, kind: ScrollKind.Enchanting, initialFrequency: 60, incrementFrequency: 30, decrementFrequency: 50, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Identify, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Teleport, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.RemoveCurse, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Recharging, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.ProtectArmor, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.ProtectWeapon, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Sanctuary, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.MagicMapping, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Negation, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Shattering, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.Discord, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.AggravateMonster, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.SCROLL, kind: ScrollKind.SummonMonster, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Life, initialFrequency: 0, incrementFrequency: 34, decrementFrequency: 150, genMultiplier: 4, genIncrement: 3, levelScaling: 1, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Strength, initialFrequency: 40, incrementFrequency: 17, decrementFrequency: 50, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Telepathy, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Levitation, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.DetectMagic, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.HasteSelf, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.FireImmunity, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Invisibility, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Poison, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Paralysis, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Hallucination, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Confusion, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Incineration, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Darkness, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Descent, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
    { category: ItemCategory.POTION, kind: PotionKind.Lichen, initialFrequency: 0, incrementFrequency: 0, decrementFrequency: 0, genMultiplier: 0, genIncrement: 0, levelScaling: 0, levelGuarantee: 0, itemNumberGuarantee: 0 },
]);
