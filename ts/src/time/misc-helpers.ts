/*
 *  misc-helpers.ts — Miscellaneous time-related helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Time.c
 *  Functions: staffChargeDuration, rechargeItemsIncrementally,
 *             processIncrementalAutoID, dangerChanged, autoRest,
 *             manualSearch, monsterEntersLevel, monstersApproachStairs,
 *             updateYendorWardenTracking
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Creature,
    Pos,
    Pcell,
    Item,
    LevelData,
} from "../types/types.js";
import { StatusEffect, StaffKind, ItemCategory } from "../types/enums.js";
import {
    ItemFlag,
    MonsterBookkeepingFlag,
    TileFlag,
    TerrainFlag,
    T_DIVIDES_LEVEL,
} from "../types/flags.js";

// =============================================================================
// Context
// =============================================================================

export interface MiscHelpersContext {
    player: Creature;
    rogue: {
        depthLevel: number;
        wisdomBonus: number;
        awarenessBonus: number;
        justRested: boolean;
        justSearched: boolean;
        automationActive: boolean;
        disturbed: boolean;
        yendorWarden: Creature | null;
        weapon: Item | null;
        armor: Item | null;
        ringLeft: Item | null;
        ringRight: Item | null;
        upLoc: Pos;
        downLoc: Pos;
        monsterSpawnFuse: number;
    };
    monsters: Creature[];
    levels: LevelData[];
    pmap: Pcell[][];
    packItems: Item[];

    DCOLS: number;
    DROWS: number;
    FP_FACTOR: number;
    TURNS_FOR_FULL_REGEN: number;
    deepestLevel: number;
    INVALID_POS: Pos;

    // Random
    randClumpedRange(minVal: number, maxVal: number, clumps: number): number;
    rand_percent(percent: number): boolean;

    // Math
    max(a: number, b: number): number;
    clamp(val: number, min: number, max: number): number;
    ringWisdomMultiplier(val: number): number;
    charmRechargeDelay(kind: number, enchant: number): number;

    // Item helpers
    itemName(theItem: Item, includeArticle: boolean, includeRunic: boolean): string;
    identify(theItem: Item): void;
    updateIdentifiableItems(): void;
    numberOfMatchingPackItems(category: number, requiredFlags: number, forbiddenFlags: number, is498: boolean): number;

    // Messaging
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: unknown, flags: number): void;

    // Creature helpers
    monsterAvoids(monst: Creature, loc: Pos): boolean;
    canSeeMonster(monst: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    messageColorFromVictim(monst: Creature): unknown;
    inflictDamage(attacker: Creature | null, defender: Creature, damage: number, color: unknown, ignoreArmor: boolean): boolean;
    killCreature(monst: Creature, maintainCorpse: boolean): void;
    demoteMonsterFromLeadership(monst: Creature): void;
    restoreMonster(monst: Creature, a: null, b: null): void;
    removeCreature(chain: Creature[], monst: Creature): void;
    prependCreature(chain: Creature[], monst: Creature): void;
    avoidedFlagsForMonster(info: unknown): number;
    getQualifyingPathLocNear(loc: Pos, useDiags: boolean, terrainFlags: number, tmFlags: number, avoidFlags: number, tileFlags: number, forbid: boolean): Pos;

    // Map
    posNeighborInDirection(loc: Pos, dir: number): Pos;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    pmapAt(loc: Pos): Pcell;
    terrainFlags(loc: Pos): number;
    refreshDungeonCell(loc: Pos): void;
    search(strength: number): void;

    // Turn
    recordKeystroke(key: string, shifted: boolean, ctrled: boolean): void;
    playerTurnEnded(): void;
    pauseAnimation(frames: number, behavior: number): boolean;

    // Items info tables
    ringTable: Array<{ identified: boolean }>;

    // Display
    displayLevel(): void;
    updateMinersLightRadius(): void;

    // Item color
    itemMessageColor: unknown;
    red: unknown;

    // Keys
    REST_KEY: string;
    SEARCH_KEY: string;
    PAUSE_BEHAVIOR_DEFAULT: number;
}

// =============================================================================
// staffChargeDuration — from Time.c:1805
// =============================================================================

export function staffChargeDuration(
    theItem: Item,
): number {
    // staffs of blinking and obstruction recharge half as fast so they're less powerful
    return Math.floor(
        (theItem.kind === StaffKind.Blinking || theItem.kind === StaffKind.Obstruction
            ? 10000
            : 5000) / theItem.enchant1,
    );
}

// =============================================================================
// rechargeItemsIncrementally — from Time.c:1811
// =============================================================================

export function rechargeItemsIncrementally(
    multiplier: number,
    ctx: MiscHelpersContext,
): void {
    let rechargeIncrement: number;

    if (ctx.rogue.wisdomBonus) {
        rechargeIncrement = Math.floor(
            (10 * ctx.ringWisdomMultiplier(ctx.rogue.wisdomBonus * ctx.FP_FACTOR)) / ctx.FP_FACTOR,
        );
    } else {
        rechargeIncrement = 10;
    }

    rechargeIncrement *= multiplier;

    for (const theItem of ctx.packItems) {
        if (theItem.category & ItemCategory.STAFF) {
            if (
                (theItem.charges < theItem.enchant1 && rechargeIncrement > 0) ||
                (theItem.charges > 0 && rechargeIncrement < 0)
            ) {
                theItem.enchant2 -= rechargeIncrement;
            }
            const staffRechargeDuration = staffChargeDuration(theItem);
            while (theItem.enchant2 <= 0) {
                if (theItem.charges < theItem.enchant1) {
                    theItem.charges++;
                }
                theItem.enchant2 += ctx.randClumpedRange(
                    ctx.max(Math.floor(staffRechargeDuration / 3), 1),
                    Math.floor((staffRechargeDuration * 5) / 3),
                    3,
                );
            }
            while (theItem.enchant2 > Math.floor((staffRechargeDuration * 5) / 3)) {
                if (theItem.charges > 0) {
                    theItem.charges--;
                }
                theItem.enchant2 -= staffRechargeDuration;
            }
        } else if ((theItem.category & ItemCategory.CHARM) && theItem.charges > 0) {
            theItem.charges = ctx.clamp(
                theItem.charges - multiplier,
                0,
                ctx.charmRechargeDelay(theItem.kind, theItem.enchant1),
            );
            if (theItem.charges === 0) {
                const theItemName = ctx.itemName(theItem, false, false);
                ctx.message(`your ${theItemName} has recharged.`, 0);
            }
        }
    }
}

// =============================================================================
// processIncrementalAutoID — from Time.c:1772
// =============================================================================

export function processIncrementalAutoID(
    ctx: MiscHelpersContext,
): void {
    const autoIdentifyItems: (Item | null)[] = [
        ctx.rogue.armor,
        ctx.rogue.ringLeft,
        ctx.rogue.ringRight,
    ];

    for (const theItem of autoIdentifyItems) {
        if (
            theItem &&
            theItem.charges > 0 &&
            (!(theItem.flags & ItemFlag.ITEM_IDENTIFIED) ||
                ((theItem.category & ItemCategory.RING) && !ctx.ringTable[theItem.kind]?.identified))
        ) {
            theItem.charges--;
            if (theItem.charges <= 0) {
                const theItemName = ctx.itemName(theItem, false, false);
                ctx.message(
                    `you are now familiar enough with your ${theItemName} to identify it.`,
                    0,
                );

                if (theItem.category & ItemCategory.ARMOR) {
                    theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
                } else if (theItem.category & ItemCategory.RING) {
                    ctx.identify(theItem);
                }
                ctx.updateIdentifiableItems();

                const fullName = ctx.itemName(theItem, true, true);
                ctx.message(
                    `${theItem.quantity > 1 ? "they are" : "it is"} ${fullName}.`,
                    0,
                );
            }
        }
    }
}

// =============================================================================
// dangerChanged — from Time.c:2077
// =============================================================================

export function dangerChanged(
    danger: boolean[],
    ctx: MiscHelpersContext,
): boolean {
    for (let dir = 0; dir < 4; dir++) {
        const newLoc = ctx.posNeighborInDirection(ctx.player.loc, dir);
        if (danger[dir] !== ctx.monsterAvoids(ctx.player, newLoc)) {
            return true;
        }
    }
    return false;
}

// =============================================================================
// autoRest — from Time.c:2087
// =============================================================================

export function autoRest(
    ctx: MiscHelpersContext,
): void {
    const danger: boolean[] = [];
    for (let dir = 0; dir < 4; dir++) {
        const newLoc = ctx.posNeighborInDirection(ctx.player.loc, dir);
        danger[dir] = ctx.monsterAvoids(ctx.player, newLoc);
    }

    // Clear already-seen flag from all monsters
    for (const monst of ctx.monsters) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_ALREADY_SEEN;
    }

    ctx.rogue.disturbed = false;
    ctx.rogue.automationActive = true;
    const initiallyEmbedded = ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY);

    if (
        (ctx.player.currentHP < ctx.player.info.maxHP ||
            ctx.player.status[StatusEffect.Hallucinating] ||
            ctx.player.status[StatusEffect.Confused] ||
            ctx.player.status[StatusEffect.Nauseous] ||
            ctx.player.status[StatusEffect.Poisoned] ||
            ctx.player.status[StatusEffect.Darkness] ||
            initiallyEmbedded) &&
        !ctx.rogue.disturbed
    ) {
        let i = 0;
        while (
            i++ < ctx.TURNS_FOR_FULL_REGEN &&
            (ctx.player.currentHP < ctx.player.info.maxHP ||
                ctx.player.status[StatusEffect.Hallucinating] ||
                ctx.player.status[StatusEffect.Confused] ||
                ctx.player.status[StatusEffect.Nauseous] ||
                ctx.player.status[StatusEffect.Poisoned] ||
                ctx.player.status[StatusEffect.Darkness] ||
                ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) &&
            !ctx.rogue.disturbed &&
            (!initiallyEmbedded ||
                ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY))
        ) {
            ctx.recordKeystroke(ctx.REST_KEY, false, false);
            ctx.rogue.justRested = true;
            ctx.playerTurnEnded();
            if (dangerChanged(danger, ctx) || ctx.pauseAnimation(1, ctx.PAUSE_BEHAVIOR_DEFAULT)) {
                ctx.rogue.disturbed = true;
            }
        }
    } else {
        for (let i = 0; i < 100 && !ctx.rogue.disturbed; i++) {
            ctx.recordKeystroke(ctx.REST_KEY, false, false);
            ctx.rogue.justRested = true;
            ctx.playerTurnEnded();
            if (dangerChanged(danger, ctx) || ctx.pauseAnimation(1, ctx.PAUSE_BEHAVIOR_DEFAULT)) {
                ctx.rogue.disturbed = true;
            }
        }
    }
    ctx.rogue.automationActive = false;
}

// =============================================================================
// manualSearch — from Time.c:2146
// =============================================================================

export function manualSearch(
    ctx: MiscHelpersContext,
): void {
    ctx.recordKeystroke(ctx.SEARCH_KEY, false, false);

    if (ctx.player.status[StatusEffect.Searching] <= 0) {
        ctx.player.status[StatusEffect.Searching] = 0;
        ctx.player.maxStatus[StatusEffect.Searching] = 5;
    }

    ctx.player.status[StatusEffect.Searching] += 1;

    let searchStrength: number;
    if (ctx.player.status[StatusEffect.Searching] < 5) {
        searchStrength = ctx.rogue.awarenessBonus >= 0 ? 60 : 30;
    } else {
        searchStrength = 160;
        ctx.message("you finish your detailed search of the area.", 0);
        ctx.player.status[StatusEffect.Searching] = 0;
    }

    ctx.search(ctx.max(searchStrength, ctx.rogue.awarenessBonus + 30));

    ctx.rogue.justSearched = true;
    ctx.playerTurnEnded();
}

// =============================================================================
// updateYendorWardenTracking — from Time.c:1324
// =============================================================================

export function updateYendorWardenTracking(
    ctx: MiscHelpersContext,
): void {
    if (!ctx.rogue.yendorWarden) {
        return;
    }
    if (ctx.rogue.yendorWarden.depth === ctx.rogue.depthLevel) {
        return;
    }
    if (!(ctx.rogue.yendorWarden.bookkeepingFlags & MonsterBookkeepingFlag.MB_PREPLACED)) {
        const n = ctx.rogue.yendorWarden.depth - 1;
        const storage = ctx.levels[n].mapStorage;
        if (storage) {
            const { x, y } = ctx.rogue.yendorWarden.loc;
            storage[x][y].flags &= ~TileFlag.HAS_MONSTER;
        }
    }
    let n = ctx.rogue.yendorWarden.depth - 1;

    ctx.removeCreature(ctx.levels[n].monsters, ctx.rogue.yendorWarden);

    if (ctx.rogue.yendorWarden.depth > ctx.rogue.depthLevel) {
        ctx.rogue.yendorWarden.depth = ctx.rogue.depthLevel + 1;
        n = ctx.rogue.yendorWarden.depth - 1;
        ctx.rogue.yendorWarden.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS;
        ctx.rogue.yendorWarden.loc = { ...ctx.levels[n].downStairsLoc };
    } else {
        ctx.rogue.yendorWarden.depth = ctx.rogue.depthLevel - 1;
        n = ctx.rogue.yendorWarden.depth - 1;
        ctx.rogue.yendorWarden.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS;
        ctx.rogue.yendorWarden.loc = { ...ctx.levels[n].upStairsLoc };
    }
    ctx.prependCreature(ctx.levels[ctx.rogue.yendorWarden.depth - 1].monsters, ctx.rogue.yendorWarden);
    ctx.rogue.yendorWarden.bookkeepingFlags |= MonsterBookkeepingFlag.MB_PREPLACED;
    ctx.rogue.yendorWarden.status[StatusEffect.EntersLevelIn] = 50;
}

// =============================================================================
// monsterEntersLevel — from Time.c:1871
// =============================================================================

export function monsterEntersLevel(
    monst: Creature,
    n: number,
    ctx: MiscHelpersContext,
): void {
    const storage = ctx.levels[n].mapStorage;
    if (storage) {
        storage[monst.loc.x][monst.loc.y].flags &= ~TileFlag.HAS_MONSTER;
    }

    // place traversing monster near the stairs on this level
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS) {
        monst.loc = { ...ctx.rogue.upLoc };
    } else if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS) {
        monst.loc = { ...ctx.rogue.downLoc };
    } else if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_PIT) {
        monst.loc = { ...ctx.levels[n].playerExitedVia };
    } else {
        throw new Error("monsterEntersLevel: unexpected bookkeeping flags");
    }
    const pit = !!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_APPROACHING_PIT);
    monst.depth = ctx.rogue.depthLevel;
    monst.targetCorpseLoc = { ...ctx.INVALID_POS };

    if (!pit) {
        monst.loc = ctx.getQualifyingPathLocNear(
            monst.loc,
            true,
            T_DIVIDES_LEVEL & ctx.avoidedFlagsForMonster(monst.info),
            0,
            ctx.avoidedFlagsForMonster(monst.info),
            TileFlag.HAS_STAIRS,
            false,
        );
    }
    if (
        !pit &&
        (ctx.pmapAt(monst.loc).flags & (TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER)) &&
        !(ctx.terrainFlags(monst.loc) & ctx.avoidedFlagsForMonster(monst.info))
    ) {
        const prevMonst = ctx.monsters.find(
            (m) => m.loc.x === monst.loc.x && m.loc.y === monst.loc.y,
        );
        if (prevMonst) {
            prevMonst.loc = ctx.getQualifyingPathLocNear(
                monst.loc,
                true,
                T_DIVIDES_LEVEL & ctx.avoidedFlagsForMonster(prevMonst.info),
                0,
                ctx.avoidedFlagsForMonster(prevMonst.info),
                TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER | TileFlag.HAS_STAIRS,
                false,
            );
            ctx.pmapAt(monst.loc).flags &= ~(TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER);
            ctx.pmapAt(prevMonst.loc).flags |= prevMonst === ctx.player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER;
            ctx.refreshDungeonCell(prevMonst.loc);
        }
    }

    // remove traversing monster from other level monster chain
    ctx.removeCreature(ctx.levels[n].monsters, monst);
    // prepend traversing monster to current level monster chain
    ctx.prependCreature(ctx.monsters, monst);

    monst.status[StatusEffect.EntersLevelIn] = 0;
    monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_PREPLACED;
    monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_IS_FALLING;
    ctx.restoreMonster(monst, null, null);
    monst.ticksUntilTurn = monst.movementSpeed;
    ctx.refreshDungeonCell(monst.loc);

    if (pit) {
        const monstNameStr = ctx.monsterName(monst, true);
        if (!monst.status[StatusEffect.Levitating]) {
            if (ctx.inflictDamage(null, monst, ctx.randClumpedRange(6, 12, 2), ctx.red, false)) {
                if (ctx.canSeeMonster(monst)) {
                    ctx.messageWithColor(
                        `${monstNameStr} plummets from above and splatters against the ground!`,
                        ctx.messageColorFromVictim(monst),
                        0,
                    );
                }
                ctx.killCreature(monst, false);
            } else {
                if (ctx.canSeeMonster(monst)) {
                    ctx.message(`${monstNameStr} falls from above and crashes to the ground!`, 0);
                }
            }
        } else if (ctx.canSeeMonster(monst)) {
            ctx.message(`${monstNameStr} swoops into the cavern from above.`, 0);
        }
    }
}

// =============================================================================
// monstersApproachStairs — from Time.c:1946
// =============================================================================

export function monstersApproachStairs(
    ctx: MiscHelpersContext,
): void {
    for (
        let n = ctx.rogue.depthLevel - 2;
        n <= ctx.rogue.depthLevel;
        n += 2
    ) {
        if (n >= 0 && n < ctx.deepestLevel && ctx.levels[n].visited) {
            const levelMonsters = [...ctx.levels[n].monsters]; // copy to avoid mutation issues
            for (const monst of levelMonsters) {
                if (monst.status[StatusEffect.EntersLevelIn] > 1) {
                    monst.status[StatusEffect.EntersLevelIn]--;
                } else if (monst.status[StatusEffect.EntersLevelIn] === 1) {
                    monsterEntersLevel(monst, n, ctx);
                }
            }
        }
    }

    if (
        ctx.rogue.yendorWarden &&
        Math.abs(ctx.rogue.depthLevel - ctx.rogue.yendorWarden.depth) > 1
    ) {
        updateYendorWardenTracking(ctx);
    }
}
