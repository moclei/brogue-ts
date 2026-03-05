/*
 *  dungeon-profile-catalog.ts — dungeonProfileCatalog, ported from Globals.c
 *  brogue-ts
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { DungeonProfile } from "../types/types.js";

/**
 * Dungeon profile catalog. Each entry defines room frequency distributions
 * and corridor generation probability for a dungeon generation style.
 * Indexed by DungeonProfileType.
 *
 * Room frequencies (by index):
 *   0. Cross room
 *   1. Small symmetrical cross room
 *   2. Small room
 *   3. Circular room
 *   4. Chunky room
 *   5. Cave
 *   6. Cavern (the kind that fills a level)
 *   7. Entrance room (the big upside-down T room at the start of depth 1)
 */
export const dungeonProfileCatalog: readonly DungeonProfile[] = [
    // Room frequencies
    //  0    1   2   3   4   5   6   7   Corridor chance
    { roomFrequencies: [2,  1,  1,  1,  7,  1,  0,  0], corridorChance: 10 },  // Basic dungeon generation (further adjusted by depth)
    { roomFrequencies: [10, 0,  0,  3,  7,  10, 10, 0], corridorChance: 0 },   // First room for basic dungeon generation (further adjusted by depth)
    { roomFrequencies: [0,  0,  1,  0,  0,  0,  0,  0], corridorChance: 0 },   // Goblin warrens
    { roomFrequencies: [0,  5,  0,  1,  0,  0,  0,  0], corridorChance: 0 },   // Sentinel sanctuaries
];
