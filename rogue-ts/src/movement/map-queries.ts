/*
 *  map-queries.ts — Map query helpers for the movement system
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: layerWithTMFlag, layerWithFlag, tileFlavor, tileText,
 *             storeMemories, discover, isDisturbed, addScentToCell,
 *             describeLocation, printLocationDescription,
 *             getLocationFlags
 *
 *  highestPriorityLayer is already in ts/src/state/helpers.ts and
 *  is re-exported from here for convenience.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, DungeonFeature, Pos, Item } from "../types/types.js";
import { DungeonLayer, CreatureState, StatusEffect, ItemCategory } from "../types/enums.js";
import { NUMBER_TERRAIN_LAYERS, DCOLS } from "../types/constants.js";
import {
    TerrainFlag, TerrainMechFlag, TileFlag, T_OBSTRUCTS_SCENT,
    MonsterBehaviorFlag, MonsterBookkeepingFlag, ItemFlag,
    T_MOVES_ITEMS,
} from "../types/flags.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { highestPriorityLayer } from "../state/helpers.js";

// Re-export highestPriorityLayer for convenience
export { highestPriorityLayer } from "../state/helpers.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Context for map query operations that need game state access.
 */
export interface MapQueryContext {
    /** Permanent map cells. */
    pmap: Pcell[][];
    /** The player creature. */
    player: Creature;
    /** The player character state (rogue). */
    rogue: {
        scentTurnNumber: number;
        disturbed: boolean;
        automationActive: boolean;
    };
    /** Scent map grid. */
    scentMap: number[][];
    /** Get terrain flags at a position (combined from all layers). */
    terrainFlags(pos: Pos): number;
    /** Get terrain mech flags at a position (combined from all layers). */
    terrainMechFlags(pos: Pos): number;
    /** Check if cell has terrain flags. */
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    /** Check if cell has terrain mech flags. */
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    /** Check if coordinates are within the map. */
    coordinatesAreInMap(x: number, y: number): boolean;
    /** Check if the player can see a location. */
    playerCanSee(x: number, y: number): boolean;
    /** Find the creature at a given location. */
    monsterAtLoc(loc: Pos): Creature | null;
    /** Find the creature at a given location (dormant monsters). */
    dormantMonsterAtLoc?(loc: Pos): Creature | null;
    /** Can the monster see another monster. */
    canSeeMonster(monst: Creature): boolean;
    /** Is the monster revealed by telepathy or other means. */
    monsterRevealed(monst: Creature): boolean;
    /** Spawn a dungeon feature at a location. */
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;
    /** Refresh dungeon cell display. */
    refreshDungeonCell(loc: Pos): void;
    /** Get the dungeon feature catalog. */
    dungeonFeatureCatalog: readonly DungeonFeature[];
    /** Find item at a location. */
    itemAtLoc?(loc: Pos): Item | null;
    /** Direction deltas [dx, dy] for each direction index. */
    nbDirs: readonly [number, number][];
}

/**
 * Extended context for describeLocation — adds dependencies for the
 * complex location description logic.
 */
export interface DescribeLocationContext extends MapQueryContext {
    /** Check if the player can see or sense a location. */
    playerCanSeeOrSense(x: number, y: number): boolean;
    /** Check if the player can directly see (no telepathy/detection). */
    playerCanDirectlySee(x: number, y: number): boolean;
    /** Required (non-optional) item lookup. */
    itemAtLoc(loc: Pos): Item | null;
    /** Get the dormant monster at a location. */
    dormantMonsterAtLoc(loc: Pos): Creature | null;
    /** Determine an item's magic polarity (-1, 0, or 1). */
    itemMagicPolarity(item: Item): number;
    /** Get a monster's display name (with or without article). */
    monsterName(monst: Creature, includeArticle: boolean): string;
    /** Check if a monster can submerge right now. */
    monsterCanSubmergeNow(monst: Creature): boolean;
    /** Get a described item name, truncated to maxLength. */
    describedItemName(item: Item, maxLength: number): string;
    /** Describe an item based on remembered parameters. */
    describedItemBasedOnParameters(category: number, kind: number, quantity: number, originDepth: number): string;
    /** Get a hallucinated item description. */
    describeHallucinatedItem(): string;
    /** Cosmetic RNG — rand_range for display choices. */
    cosmeticRandRange(lower: number, upper: number): number;
    /** Whether playback omniscience is active. */
    playbackOmniscience: boolean;
    /** Send a flavor message to the UI. */
    flavorMessage(msg: string): void;
}

// =============================================================================
// layerWithTMFlag — from Movement.c:79
// =============================================================================

/**
 * Returns the dungeon layer at (x, y) that has the given terrain mechanic flag,
 * or DungeonLayer.NoLayer if no layer matches.
 *
 * C: enum dungeonLayers layerWithTMFlag(short x, short y, unsigned long flag)
 */
export function layerWithTMFlag(
    pmap: Pcell[][],
    x: number,
    y: number,
    flag: number,
): DungeonLayer {
    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        if (tileCatalog[pmap[x][y].layers[layer]].mechFlags & flag) {
            return layer as DungeonLayer;
        }
    }
    return DungeonLayer.NoLayer;
}

// =============================================================================
// layerWithFlag — from Movement.c:90
// =============================================================================

/**
 * Returns the dungeon layer at (x, y) that has the given terrain flag,
 * or DungeonLayer.NoLayer if no layer matches.
 *
 * C: enum dungeonLayers layerWithFlag(short x, short y, unsigned long flag)
 */
export function layerWithFlag(
    pmap: Pcell[][],
    x: number,
    y: number,
    flag: number,
): DungeonLayer {
    for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
        if (tileCatalog[pmap[x][y].layers[layer]].flags & flag) {
            return layer as DungeonLayer;
        }
    }
    return DungeonLayer.NoLayer;
}

// =============================================================================
// tileFlavor — from Movement.c:102
// =============================================================================

/**
 * Retrieves the flavor text of the highest-priority terrain at the given location.
 *
 * C: const char *tileFlavor(short x, short y)
 */
export function tileFlavor(
    pmap: Pcell[][],
    x: number,
    y: number,
    highestPriorityLayerFn: (pmap: Pcell[][], x: number, y: number, skipGas: boolean) => DungeonLayer,
): string {
    return tileCatalog[pmap[x][y].layers[highestPriorityLayerFn(pmap, x, y, false)]].flavorText;
}

// =============================================================================
// tileText — from Movement.c:107
// =============================================================================

/**
 * Retrieves the description text of the highest-priority terrain at the given location.
 *
 * C: const char *tileText(short x, short y)
 */
export function tileText(
    pmap: Pcell[][],
    x: number,
    y: number,
    highestPriorityLayerFn: (pmap: Pcell[][], x: number, y: number, skipGas: boolean) => DungeonLayer,
): string {
    return tileCatalog[pmap[x][y].layers[highestPriorityLayerFn(pmap, x, y, false)]].description;
}

// =============================================================================
// storeMemories — from Movement.c:2229
// =============================================================================

/**
 * Stores the current state of a cell into its "remembered" fields,
 * so the player remembers what they've seen.
 *
 * C: void storeMemories(const short x, const short y)
 */
export function storeMemories(
    pmap: Pcell[][],
    x: number,
    y: number,
    terrainFlagsFn: (pos: Pos) => number,
    terrainMechFlagsFn: (pos: Pos) => number,
    highestPriorityLayerFn: (pmap: Pcell[][], x: number, y: number, skipGas: boolean) => DungeonLayer,
): void {
    const cell = pmap[x][y];
    cell.rememberedTerrainFlags = terrainFlagsFn({ x, y });
    cell.rememberedTMFlags = terrainMechFlagsFn({ x, y });
    cell.rememberedCellFlags = cell.flags;
    cell.rememberedTerrain = cell.layers[highestPriorityLayerFn(pmap, x, y, false)];
}

// =============================================================================
// discover — from Movement.c:2110
// =============================================================================

/**
 * Reveals a secret at the given location by spawning its discover dungeon feature.
 * Any layer with TM_IS_SECRET is replaced with FLOOR (dungeon layer) or NOTHING (other layers),
 * and the corresponding discover feature is spawned.
 *
 * C: void discover(short x, short y)
 */
export function discover(
    x: number,
    y: number,
    ctx: MapQueryContext,
): void {
    if (ctx.cellHasTMFlag({ x, y }, TerrainMechFlag.TM_IS_SECRET)) {
        const cell = ctx.pmap[x][y];
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (tileCatalog[cell.layers[layer]].mechFlags & TerrainMechFlag.TM_IS_SECRET) {
                const feat = ctx.dungeonFeatureCatalog[tileCatalog[cell.layers[layer]].discoverType as number];
                cell.layers[layer] = (layer === DungeonLayer.Dungeon ? 2 : 0) as any; // FLOOR = 2, NOTHING = 0
                ctx.spawnDungeonFeature(x, y, feat, true, false);
            }
        }
        ctx.refreshDungeonCell({ x, y });

        if (ctx.playerCanSee(x, y)) {
            ctx.rogue.disturbed = true;
        }
    }
}

// =============================================================================
// isDisturbed — from Movement.c:2091
// =============================================================================

/**
 * Checks if there's something nearby that should interrupt automation
 * (running, exploring, auto-travel). Returns true if a visible enemy or
 * item is in an adjacent cell.
 *
 * C: boolean isDisturbed(short x, short y)
 */
export function isDisturbed(
    x: number,
    y: number,
    ctx: MapQueryContext,
): boolean {
    for (let i = 0; i < 8; i++) {
        const nx = x + ctx.nbDirs[i][0];
        const ny = y + ctx.nbDirs[i][1];

        if (!ctx.coordinatesAreInMap(nx, ny)) continue;

        if (ctx.pmap[nx][ny].flags & TileFlag.HAS_ITEM) {
            return true;
        }

        const monst = ctx.monsterAtLoc({ x: nx, y: ny });
        if (
            monst &&
            monst.creatureState !== CreatureState.Ally &&
            (ctx.canSeeMonster(monst) || ctx.monsterRevealed(monst))
        ) {
            return true;
        }
    }
    return false;
}

// =============================================================================
// addScentToCell — from Movement.c:2481
// =============================================================================

/**
 * Adds scent to a cell based on the current scent turn number and the distance
 * from the player. Scent is not added to cells that block both scent and passability.
 *
 * C: void addScentToCell(short x, short y, short distance)
 */
export function addScentToCell(
    x: number,
    y: number,
    distance: number,
    ctx: MapQueryContext,
): void {
    if (
        !ctx.cellHasTerrainFlag({ x, y }, T_OBSTRUCTS_SCENT) ||
        !ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    ) {
        const value = (ctx.rogue.scentTurnNumber - distance) & 0xFFFF;
        ctx.scentMap[x][y] = Math.max(value, ctx.scentMap[x][y] & 0xFFFF);
    }
}

// =============================================================================
// getLocationFlags — from Movement.c:1751
// =============================================================================

/**
 * Gets the terrain flags, terrain mech flags, and cell flags at a location.
 * If limitToPlayerKnowledge is true and the cell has been discovered/magic-mapped
 * but is not currently visible, returns remembered flags instead.
 *
 * C: void getLocationFlags(const short x, const short y,
 *      unsigned long *tFlags, unsigned long *TMFlags, unsigned long *cellFlags,
 *      const boolean limitToPlayerKnowledge)
 *
 * @returns An object with tFlags, tmFlags, and cellFlags.
 */
export function getLocationFlags(
    x: number,
    y: number,
    limitToPlayerKnowledge: boolean,
    ctx: MapQueryContext,
): { tFlags: number; tmFlags: number; cellFlags: number } {
    const cell = ctx.pmap[x][y];

    if (
        limitToPlayerKnowledge &&
        (cell.flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) &&
        !ctx.playerCanSee(x, y)
    ) {
        return {
            tFlags: cell.rememberedTerrainFlags,
            tmFlags: cell.rememberedTMFlags,
            cellFlags: cell.rememberedCellFlags,
        };
    }

    return {
        tFlags: ctx.terrainFlags({ x, y }),
        tmFlags: ctx.terrainMechFlags({ x, y }),
        cellFlags: cell.flags,
    };
}

// =============================================================================
// describeLocation — from Movement.c:141
// =============================================================================

/**
 * Builds a human-readable description of the dungeon cell at (x, y),
 * incorporating monsters, items, terrain, telepathy, and memory.
 *
 * C: void describeLocation(char *buf, short x, short y)
 *
 * @returns The description string (empty string if nothing to describe).
 */
export function describeLocation(
    x: number,
    y: number,
    ctx: DescribeLocationContext,
): string {
    const { pmap, player } = ctx;
    const cell = pmap[x][y];

    let subject = "";
    let verb = "";
    let preposition = "";
    let object = "";
    let itemLocation = "";
    let subjectMoving = false;
    let prepositionLocked = false;
    let monsterDormant = false;
    let monsterIsPlayer = false;

    const theItem = ctx.itemAtLoc({ x, y });

    // ── Player's location with no item ──
    if (x === player.loc.x && y === player.loc.y && !theItem) {
        if (player.status[StatusEffect.Levitating]) {
            return `you are hovering above ${tileText(pmap, x, y, highestPriorityLayer)}.`;
        }
        return tileFlavor(pmap, x, y, highestPriorityLayer);
    }

    // ── Monster detection ──
    let monst: Creature | null = null;
    const standsInTerrain = !!(
        tileCatalog[cell.layers[highestPriorityLayer(pmap, x, y, false)]].mechFlags &
        TerrainMechFlag.TM_STAND_IN_TILE
    );

    if (cell.flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
        monst = ctx.monsterAtLoc({ x, y });
        monsterIsPlayer = monst === player;
    } else if (cell.flags & TileFlag.HAS_DORMANT_MONSTER) {
        monst = ctx.dormantMonsterAtLoc({ x, y });
        monsterDormant = true;
    }

    // ── Magic-detected items ──
    let magicItem: Item | null = null;
    if (
        theItem &&
        !ctx.playerCanSeeOrSense(x, y) &&
        (theItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) &&
        ctx.itemMagicPolarity(theItem)
    ) {
        magicItem = theItem;
    } else if (
        monst &&
        !ctx.canSeeMonster(monst) &&
        monst.carriedItem &&
        (monst.carriedItem.flags & ItemFlag.ITEM_MAGIC_DETECTED) &&
        ctx.itemMagicPolarity(monst.carriedItem)
    ) {
        magicItem = monst.carriedItem;
    }

    if (magicItem && !(cell.flags & TileFlag.DISCOVERED)) {
        const polarity = ctx.itemMagicPolarity(magicItem);
        let aura: string;
        if (polarity === 1) {
            aura = magicItem.category === ItemCategory.AMULET
                ? "the Amulet of Yendor"
                : "benevolent magic";
        } else if (polarity === -1) {
            aura = "malevolent magic";
        } else {
            aura = "mysterious magic";
        }
        return `you can detect the aura of ${aura} here.`;
    }

    // ── Telepathy ──
    if (
        monst &&
        !monsterIsPlayer &&
        !ctx.canSeeMonster(monst) &&
        ctx.monsterRevealed(monst)
    ) {
        const adjective =
            ((!player.status[StatusEffect.Hallucinating] || ctx.playbackOmniscience) && !monst.info.isLarge) ||
            (player.status[StatusEffect.Hallucinating] && !ctx.playbackOmniscience && ctx.cosmeticRandRange(0, 1))
                ? "small"
                : "large";

        if (cell.flags & TileFlag.DISCOVERED) {
            object = tileText(pmap, x, y, highestPriorityLayer);
            if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) {
                preposition = "under ";
            } else if (monsterDormant) {
                preposition = "coming from within ";
            } else if (standsInTerrain) {
                preposition = "in ";
            } else {
                preposition = "over ";
            }
        } else {
            object = "here";
            preposition = "";
        }
        return `you can sense a ${adjective} psychic emanation ${preposition}${object}.`;
    }

    // ── Monster not visible → treat as absent ──
    if (monst && !ctx.canSeeMonster(monst) && !ctx.playbackOmniscience) {
        monst = null;
    }

    // ── Player can't see or sense ──
    if (!ctx.playerCanSeeOrSense(x, y)) {
        if (cell.flags & TileFlag.DISCOVERED) {
            // Memory
            if (cell.rememberedItemCategory) {
                if (player.status[StatusEffect.Hallucinating] && !ctx.playbackOmniscience) {
                    object = ctx.describeHallucinatedItem();
                } else {
                    object = ctx.describedItemBasedOnParameters(
                        cell.rememberedItemCategory,
                        cell.rememberedItemKind,
                        cell.rememberedItemQuantity,
                        cell.rememberedItemOriginDepth,
                    );
                }
            } else {
                object = tileCatalog[cell.rememberedTerrain].description;
            }
            return `you remember seeing ${object} here.`;
        }
        if (cell.flags & TileFlag.MAGIC_MAPPED) {
            return `you expect ${tileCatalog[cell.rememberedTerrain].description} to be here.`;
        }
        return "";
    }

    // ── Visible monster ──
    if (monst) {
        subject = ctx.monsterName(monst, true);
        verb = monsterIsPlayer ? "are" : "is";

        // Phantoms in gas
        if (
            cell.layers[DungeonLayer.Gas] &&
            monst.status[StatusEffect.Invisible] &&
            !monsterIsPlayer
        ) {
            return `you can perceive the faint outline of ${subject} in ${tileCatalog[cell.layers[DungeonLayer.Gas]].description}.`;
        }

        subjectMoving =
            monst.turnsSpentStationary === 0 &&
            !(monst.info.flags & (MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION | MonsterBehaviorFlag.MONST_IMMOBILE)) &&
            monst.creatureState !== CreatureState.Sleeping &&
            !(monst.bookkeepingFlags & (MonsterBookkeepingFlag.MB_SEIZED | MonsterBookkeepingFlag.MB_CAPTIVE));

        // ── Verb modifiers based on creature/terrain state ──
        if (
            (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS) &&
            ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
        ) {
            verb += " embedded";
        } else if (ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
            verb += " trapped";
            subjectMoving = false;
        } else if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
            verb += " shackled in place";
            subjectMoving = false;
        } else if (monst.status[StatusEffect.Paralyzed]) {
            verb += " frozen in place";
            subjectMoving = false;
        } else if (monst.status[StatusEffect.Stuck]) {
            verb += " entangled";
            subjectMoving = false;
        } else if (monst.status[StatusEffect.Levitating]) {
            verb += monsterIsPlayer ? " hovering" : (subjectMoving ? " flying" : " hovering");
            preposition = "over";
            prepositionLocked = true;
        } else if (ctx.monsterCanSubmergeNow(monst)) {
            verb += subjectMoving ? " gliding" : " drifting";
        } else if (
            ctx.cellHasTerrainFlag({ x, y }, T_MOVES_ITEMS) &&
            !(monst.info.flags & MonsterBehaviorFlag.MONST_SUBMERGES)
        ) {
            verb += subjectMoving ? " swimming" : " struggling";
        } else if (ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_AUTO_DESCENT)) {
            verb += " suspended in mid-air";
            preposition = "over";
            prepositionLocked = true;
            subjectMoving = false;
        } else if (monst.status[StatusEffect.Confused]) {
            verb += " staggering";
        } else if (
            (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
            !ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
        ) {
            verb += " lying";
            subjectMoving = false;
        } else if (monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE) {
            verb += " resting";
        } else {
            switch (monst.creatureState) {
                case CreatureState.Sleeping:
                    verb += " sleeping";
                    subjectMoving = false;
                    break;
                case CreatureState.Wandering:
                    verb += subjectMoving ? " wandering" : " standing";
                    break;
                case CreatureState.Fleeing:
                    verb += subjectMoving ? " fleeing" : " standing";
                    break;
                case CreatureState.TrackingScent:
                    verb += subjectMoving ? " charging" : " standing";
                    break;
                case CreatureState.Ally:
                    verb += monsterIsPlayer
                        ? " standing"
                        : (subjectMoving ? " following you" : " standing");
                    break;
                default:
                    verb += " standing";
                    break;
            }
        }

        // Burning (and not naturally fiery)
        if (monst.status[StatusEffect.Burning] && !(monst.info.flags & MonsterBehaviorFlag.MONST_FIERY)) {
            verb += ", burning,";
        }

        if (theItem) {
            // Monster standing over an item
            if (!verb.endsWith(" ")) {
                verb += " ";
            }
            preposition = "over";
            if (monsterIsPlayer) {
                itemLocation = (standsInTerrain ? " in " : " on ") +
                    tileText(pmap, x, y, highestPriorityLayer);
            }
            // Calculate remaining width, then get truncated item name
            const tempLen = `${subject} ${verb} ${preposition} ${object}${itemLocation}.`.length;
            object = ctx.describedItemName(theItem, DCOLS - tempLen);
        } else {
            // Monster with no item underneath
            if (!prepositionLocked) {
                preposition = subjectMoving
                    ? (standsInTerrain ? "through" : "across")
                    : (standsInTerrain ? "in" : "on");
            }
            object = tileText(pmap, x, y, highestPriorityLayer);
        }
    } else {
        // ── No visible monster ──
        object = tileText(pmap, x, y, highestPriorityLayer);

        if (theItem) {
            subjectMoving = ctx.cellHasTerrainFlag({ x, y }, T_MOVES_ITEMS);

            if (player.status[StatusEffect.Hallucinating] && !ctx.playbackOmniscience) {
                verb = "is";
            } else {
                verb = (theItem.quantity > 1 || (theItem.category & ItemCategory.GOLD))
                    ? "are"
                    : "is";
            }

            if (ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                verb += " enclosed";
            } else {
                verb += subjectMoving ? " drifting" : " lying";
            }

            preposition = standsInTerrain
                ? (subjectMoving ? "through" : "in")
                : (subjectMoving ? "across" : "on");

            // Calculate remaining width, then get truncated item name
            const tempLen = `${subject} ${verb} ${preposition} ${object}${itemLocation}.`.length;
            subject = ctx.describedItemName(theItem, DCOLS - tempLen);
        } else {
            // No item, no monster — just terrain
            return `you ${ctx.playerCanDirectlySee(x, y) ? "see" : "sense"} ${object}.`;
        }
    }

    return `${subject} ${verb} ${preposition} ${object}${itemLocation}.`;
}

// =============================================================================
// printLocationDescription — from Movement.c:401
// =============================================================================

/**
 * Describes the location at (x, y) and sends it as a flavor message.
 *
 * C: void printLocationDescription(short x, short y)
 */
export function printLocationDescription(
    x: number,
    y: number,
    ctx: DescribeLocationContext,
): void {
    const buf = describeLocation(x, y, ctx);
    ctx.flavorMessage(buf);
}
