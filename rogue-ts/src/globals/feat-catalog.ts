/*
 *  globals/feat-catalog.ts — Feat (achievement) catalog for Brogue variant
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/variants/GlobalsBrogue.c (featTable_Brogue)
 *
 *  Each entry describes a feat the player can earn (or fail) during a run.
 *  initialValue = true  means the player starts with the feat and can lose it.
 *  initialValue = false means the player starts without it and can earn it.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

export interface FeatEntry {
    name: string;
    description: string;
    initialValue: boolean;
}

export const featCatalog: readonly FeatEntry[] = Object.freeze([
    { name: "Pure Mage",    description: "Ascend without using a weapon.",                           initialValue: true  },
    { name: "Pure Warrior", description: "Ascend without using a staff, wand or charm.",             initialValue: true  },
    { name: "Companion",    description: "Explore 13 new depths with an ally.",                      initialValue: false },
    { name: "Specialist",   description: "Enchant an item to +16.",                                  initialValue: false },
    { name: "Jellymancer",  description: "Obtain 90 jelly allies simultaneously.",                   initialValue: false },
    { name: "Dragonslayer", description: "Slay a dragon with a melee attack.",                       initialValue: false },
    { name: "Paladin",      description: "Ascend without attacking an unaware or fleeing creature.", initialValue: true  },
    { name: "Untempted",    description: "Ascend without picking up gold.",                          initialValue: true  },
]);
