/*
 *  items/item-utils.ts — Miscellaneous item and monster utility functions
 *  brogue-ts
 *
 *  Functions: lotteryDraw, describeMonsterClass, keyMatchesLocation,
 *             monsterClassHasAcidicMonster, beckonMonster, itemCanBeCalled
 *
 *  Ported from Items.c:
 *    lotteryDraw              (6857)
 *    describeMonsterClass     (6890)
 *    keyMatchesLocation       (3305)
 *    monsterClassHasAcidicMonster (1869)
 *    beckonMonster            (4322)
 *    itemCanBeCalled          (1314)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, MonsterClass, Pos, Bolt, Pcell } from "../types/types.js";
import type { CreatureType } from "../types/types.js";
import { BoltType, ItemCategory } from "../types/enums.js";
import {
    MonsterBookkeepingFlag, MonsterBehaviorFlag, TileFlag, TerrainFlag, ItemFlag,
} from "../types/flags.js";
import { KEY_ID_MAXIMUM } from "../types/constants.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { distanceBetween } from "../monsters/monster-state.js";
import { staffBlinkDistance } from "../power/power-tables.js";
import { getImpactLoc } from "./bolt-geometry.js";

// =============================================================================
// keyOnTileAt — from Items.c:3331
// =============================================================================

/**
 * Returns the first key item that can open the given map location, or null.
 *
 * Checks three sources in order (matching C keyOnTileAt):
 *   1. Player's pack: player is on loc and pack contains an ITEM_IS_KEY that
 *      matches loc.
 *   2. Floor item at loc: HAS_ITEM flag set and floor item is ITEM_IS_KEY
 *      matching loc.
 *   3. Monster's carried item at loc: HAS_MONSTER set, monster has carriedItem
 *      that is ITEM_IS_KEY matching loc.
 *
 * C: item *keyOnTileAt(pos loc)  — Items.c:3331
 *
 * @param loc        Map position to check.
 * @param pmap       Column-major dungeon map.
 * @param player     The player creature.
 * @param packItems  Items in the player's pack.
 * @param floorItems Items on the floor.
 * @param monsters   All live monsters.
 * @param depthLevel Current dungeon depth (rogue.depthLevel).
 * @param itemAtLoc  Function to retrieve the floor item at a position.
 * @returns          Matching key item, or null.
 */
export function keyOnTileAt(
    loc: Pos,
    pmap: Pcell[][],
    player: Creature,
    packItems: readonly Item[],
    floorItems: Item[],
    monsters: readonly Creature[],
    depthLevel: number,
    itemAtLoc: (loc: Pos, items: Item[]) => Item | null,
): Item | null {
    const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;

    // 1. Player's pack
    if (player.loc.x === loc.x && player.loc.y === loc.y) {
        const k = packItems.find(it =>
            (it.flags & ItemFlag.ITEM_IS_KEY) &&
            keyMatchesLocation(it, loc, depthLevel, machineNum));
        if (k) return k;
    }

    // 2. Floor item
    if (pmap[loc.x]?.[loc.y]?.flags & TileFlag.HAS_ITEM) {
        const fi = itemAtLoc(loc, floorItems);
        if (fi && (fi.flags & ItemFlag.ITEM_IS_KEY) &&
            keyMatchesLocation(fi, loc, depthLevel, machineNum)) return fi;
    }

    // 3. Monster's carried item
    const monst = monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y);
    if (monst?.carriedItem &&
        (monst.carriedItem.flags & ItemFlag.ITEM_IS_KEY) &&
        keyMatchesLocation(monst.carriedItem, loc, depthLevel, machineNum))
        return monst.carriedItem;

    return null;
}

// =============================================================================
// lotteryDraw — from Items.c:6857
// =============================================================================

/**
 * Weighted random selection from an array of non-negative frequencies.
 * Returns the index of the selected item.
 *
 * C: static short lotteryDraw(short *frequencies, short itemCount)
 *    — Items.c:6857
 *
 * @param frequencies Array of non-negative weights (must sum > 0).
 * @param randRange   RNG function — rand_range(lo, hi) inclusive.
 * @returns           Index of the selected item.
 */
export function lotteryDraw(
    frequencies: readonly number[],
    randRange: (lo: number, hi: number) => number,
): number {
    let maxFreq = 0;
    for (let i = 0; i < frequencies.length; i++) {
        maxFreq += frequencies[i];
    }
    let randIndex = randRange(0, maxFreq - 1);
    for (let i = 0; i < frequencies.length; i++) {
        if (frequencies[i] > randIndex) {
            return i;
        }
        randIndex -= frequencies[i];
    }
    // Should never reach here if frequencies sum > 0.
    return 0;
}

// =============================================================================
// describeMonsterClass — from Items.c:6890
// =============================================================================

/**
 * Build a human-readable list of monster names for the given class.
 * Entries are separated by ", " with an "and"/"or" conjunction before the last.
 *
 * C: void describeMonsterClass(char *buf, const short classID,
 *                               boolean conjunctionAnd)
 *    — Items.c:6890
 *
 * @param classID        Index into monsterClassCatalog.
 * @param conjunctionAnd Use "and" before the last entry; otherwise "or".
 * @param classes        The monster class catalog.
 * @param monsters       The monster type catalog (for monsterName strings).
 * @returns              Constructed description string.
 */
export function describeMonsterClass(
    classID: number,
    conjunctionAnd: boolean,
    classes: readonly MonsterClass[],
    monsters: readonly Pick<CreatureType, "monsterName">[],
): string {
    const members = classes[classID].memberList;
    let buf = "";
    for (let i = 0; i < members.length; i++) {
        let piece = monsters[members[i]].monsterName;
        if (i + 1 < members.length) {
            // More entries follow
            if (i + 2 === members.length) {
                // Next entry is the last
                piece += conjunctionAnd ? " and " : " or ";
            } else {
                piece += ", ";
            }
        }
        buf += piece;
    }
    return buf;
}

// =============================================================================
// keyMatchesLocation — from Items.c:3305
// =============================================================================

/**
 * Check whether a key item unlocks the given map position.
 * The item must have the ITEM_IS_KEY flag, originate from the current depth,
 * and have at least one keyLoc entry matching loc or its machine number.
 *
 * C: static boolean keyMatchesLocation(item *theItem, pos loc)
 *    — Items.c:3305
 *
 * @param theItem         The item to test.
 * @param loc             The map position to check.
 * @param depthLevel      Current dungeon depth (rogue.depthLevel).
 * @param machineNumber   Machine number at loc (pmap[loc.x][loc.y].machineNumber).
 * @returns               true if the key opens loc.
 */
export function keyMatchesLocation(
    theItem: Item,
    loc: Pos,
    depthLevel: number,
    machineNumber: number,
): boolean {
    if (!(theItem.flags & ItemFlag.ITEM_IS_KEY)) return false;
    if (theItem.originDepth !== depthLevel) return false;

    for (let i = 0; i < KEY_ID_MAXIMUM; i++) {
        const kl = theItem.keyLoc[i];
        // Terminator: both loc.x and machine are 0
        if (!kl.loc.x && !kl.machine) break;
        if (kl.loc.x === loc.x && kl.loc.y === loc.y) return true;
        if (kl.machine === machineNumber) return true;
    }
    return false;
}

// =============================================================================
// monsterClassHasAcidicMonster — from Items.c:1869
// =============================================================================

/**
 * Returns true if any member of the given monster class has the
 * MONST_DEFEND_DEGRADE_WEAPON flag (i.e. is acidic / corrodes weapons).
 *
 * C: static boolean monsterClassHasAcidicMonster(const short classID)
 *    — Items.c:1869
 *
 * @param classID  Index into monsterClassCatalog.
 * @param classes  The monster class catalog.
 * @param monsters The monster type catalog.
 * @returns        true if any member is acidic.
 */
export function monsterClassHasAcidicMonster(
    classID: number,
    classes: readonly MonsterClass[],
    monsters: readonly Pick<CreatureType, "flags">[],
): boolean {
    const members = classes[classID].memberList;
    for (let i = 0; i < members.length; i++) {
        if (monsters[members[i]].flags & MonsterBehaviorFlag.MONST_DEFEND_DEGRADE_WEAPON) {
            return true;
        }
    }
    return false;
}

// =============================================================================
// beckonMonster — from Items.c:4322
// =============================================================================

/**
 * Minimal context for beckonMonster.
 * All fields are available in ZapContext.
 */
export interface BeckonMonsterContext {
    pmap: Pcell[][];
    player: Creature;
    boltCatalog: readonly Bolt[];
    freeCaptive(monst: Creature): void;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    monsterAtLoc(loc: Pos): Creature | null;
}

/**
 * Draw a monster toward (x, y) using a blink bolt.
 * Frees the monster if captive, then blinks it along the path from its
 * current location toward the target, stopping at the last passable cell
 * within bolt range. Sets ticksUntilTurn to at least player.attackSpeed+1.
 *
 * C: static void beckonMonster(creature *monst, short x, short y)
 *    — Items.c:4322
 *
 * Implementation note: the C version fires a full async zap; this
 * synchronous version computes the blink destination with getImpactLoc
 * and moves the monster directly, deferring visual effects to port-v2-platform.
 */
export function beckonMonster(
    monst: Creature,
    x: number,
    y: number,
    ctx: BeckonMonsterContext,
): void {
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
        ctx.freeCaptive(monst);
    }

    const from = monst.loc;
    const to = { x, y };
    const magnitude = Math.max(1, Math.floor((distanceBetween(to, from) - 2) / 2));
    const maxDistance = staffBlinkDistance(BigInt(magnitude) * FP_FACTOR);

    const theBolt = { ...ctx.boltCatalog[BoltType.BLINKING] };

    // Creatures block the blink path (so the monster stops before the player).
    // The beckoning monster does not block itself.
    const creatureBlocks = (pos: Pos): boolean => {
        if (pos.x === from.x && pos.y === from.y) return false;
        return ctx.monsterAtLoc(pos) !== null;
    };
    const cellBlocks = (pos: Pos): boolean =>
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY);

    const landing = getImpactLoc(from, to, maxDistance, true, theBolt, creatureBlocks, cellBlocks);

    // No movement if bolt doesn't reach a different cell.
    if (landing.x === from.x && landing.y === from.y) return;

    // Move the monster.
    ctx.pmap[from.x][from.y].flags &= ~TileFlag.HAS_MONSTER;
    monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
    monst.loc = { ...landing };
    ctx.pmap[landing.x][landing.y].flags |= TileFlag.HAS_MONSTER;

    if (monst.ticksUntilTurn < ctx.player.attackSpeed + 1) {
        monst.ticksUntilTurn = ctx.player.attackSpeed + 1;
    }
}

// =============================================================================
// itemCanBeCalled — from Items.c:1314
// =============================================================================

/**
 * Returns true if an item can be given a custom name via the 'call' command.
 * Equippable/consumable items (weapon, armor, scroll, ring, potion, staff, wand,
 * charm) all qualify; food, gold, amulet, gem, and key do not.
 *
 * C: boolean itemCanBeCalled(item *theItem)
 *    — Items.c:1314
 *
 * @param theItem The item to test.
 * @returns       true if the item category supports custom naming.
 */
export function itemCanBeCalled(theItem: Item): boolean {
    return !!(theItem.category & (
        ItemCategory.WEAPON | ItemCategory.ARMOR | ItemCategory.SCROLL |
        ItemCategory.RING   | ItemCategory.POTION | ItemCategory.STAFF  |
        ItemCategory.WAND   | ItemCategory.CHARM
    ));
}
