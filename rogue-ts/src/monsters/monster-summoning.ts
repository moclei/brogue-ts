/*
 *  monster-summoning.ts — Monster summoning (summonMinions)
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c:976
 *  Function: summonMinions
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, HordeType } from "../types/types.js";
import type { MonsterType } from "../types/enums.js";
import type { MonsterRNG } from "./monster-creation.js";
import { pickHordeType } from "./monster-spawning.js";

// =============================================================================
// summonMinions — Monsters.c:976
// =============================================================================

/**
 * Context for summonMinions.
 */
export interface SummonMinionsContext {
    /** Horde catalog, used by pickHordeType. */
    hordeCatalog: readonly HordeType[];
    /** Active monsters list. */
    monsters: Creature[];
    /** The player creature, used for teammate checks. */
    player: Creature;
    /** RNG for pickHordeType. */
    rng: MonsterRNG;
    /** Spawn horde minions around a leader. Returns true if any were spawned. */
    spawnMinions(hordeID: number, leader: Creature): boolean;

    /** Set a cell flag (e.g. HAS_MONSTER). */
    setCellFlag(loc: Pos, flag: number): void;
    /** Clear a cell flag (e.g. HAS_MONSTER for MA_ENTER_SUMMONS). */
    clearCellFlag(loc: Pos, flag: number): void;
    /** Remove a creature from the monsters list. Returns true if found. */
    removeCreature(monst: Creature): boolean;
    /** Prepend a creature to the front of the monsters list. */
    prependCreature(monst: Creature): void;

    /** Returns true if the player can see the monster. */
    canSeeMonster(monst: Creature): boolean;
    /** Returns the display name of a monster, optionally with article. */
    monsterName(monst: Creature, includeArticle: boolean): string;
    /** Returns the summon-flavour text for a monster type, or "". */
    getSummonMessage(monsterId: MonsterType): string;
    /** Display a game message. Stub-safe. */
    message(text: string, flags: number): void;
    /** Visual fade-in for a newly spawned monster. Stub-safe. */
    fadeInMonster(monst: Creature): void;
    /** Refresh the dungeon cell display. Stub-safe. */
    refreshDungeonCell(loc: Pos): void;
    /** Demote a monster from group leadership. Stub-safe. */
    demoteMonsterFromLeadership(monst: Creature): void;
    /** Create a flare animation at a cell. Stub-safe. */
    createFlare(x: number, y: number, flareType: number): void;
    /** Returns true if the two creatures are on the same team. */
    monstersAreTeammates(a: Creature, b: Creature): boolean;

    // Flag constants
    MA_ENTER_SUMMONS: number;
    MB_JUST_SUMMONED: number;
    MB_LEADER: number;
    HAS_MONSTER: number;
    SUMMONING_FLASH_LIGHT: number;
}

/**
 * Summons a horde of minions around the given summoner creature.
 *
 * Picks a summoned horde type for the summoner, spawns minions nearby, then
 * performs post-spawn bookkeeping:
 *   - Sets ticksUntilTurn = 101 and leader on each newly summoned minion.
 *   - If MA_ENTER_SUMMONS: places the summoner inside the first minion
 *     (carriedMonster) and demotes its leadership, or re-adds it to the
 *     monsters list if no minion was found.
 *   - Otherwise, marks the summoner as MB_LEADER.
 *   - Creates a summoning flare animation.
 *
 * NOTE: The HORDE_SUMMONED_AT_DISTANCE path (teleporting minions away from the
 * player's field of view) is intentionally deferred — it requires
 * calculateDistances, which belongs to port-v2-platform.
 *
 * Returns true if at least one minion was spawned.
 *
 * Ported from summonMinions() in Monsters.c.
 */
export function summonMinions(
    summoner: Creature,
    ctx: SummonMinionsContext,
): boolean {
    const hordeID = pickHordeType(
        0,
        summoner.info.monsterID,
        0,
        0,
        ctx.hordeCatalog,
        ctx.rng,
    );
    if (hordeID < 0) {
        return false;
    }

    // MA_ENTER_SUMMONS: remove summoner from the map before spawning minions
    // so it doesn't block placement.
    if (summoner.info.abilityFlags & ctx.MA_ENTER_SUMMONS) {
        ctx.clearCellFlag(summoner.loc, ctx.HAS_MONSTER);
        ctx.removeCreature(summoner);
    }

    const atLeastOneMinion = ctx.spawnMinions(hordeID, summoner);

    // NOTE: HORDE_SUMMONED_AT_DISTANCE teleport path deferred (needs calculateDistances).

    // Post-spawn bookkeeping for newly summoned minions.
    let host: Creature | null = null;
    for (const monst of ctx.monsters) {
        if (
            monst !== summoner &&
            ctx.monstersAreTeammates(monst, summoner) &&
            (monst.bookkeepingFlags & ctx.MB_JUST_SUMMONED)
        ) {
            monst.bookkeepingFlags &= ~ctx.MB_JUST_SUMMONED;
            if (ctx.canSeeMonster(monst)) {
                ctx.refreshDungeonCell(monst.loc);
            }
            monst.ticksUntilTurn = 101;
            monst.leader = summoner;
            ctx.fadeInMonster(monst);
            host = monst;
        }
    }

    // Display summon message if summoner is visible.
    if (ctx.canSeeMonster(summoner)) {
        const monstName = ctx.monsterName(summoner, true);
        const summonMsg = ctx.getSummonMessage(summoner.info.monsterID);
        const buf = summonMsg
            ? `${monstName} ${summonMsg}`
            : `${monstName} incants darkly!`;
        ctx.message(buf, 0);
    }

    // MA_ENTER_SUMMONS post-processing: place summoner inside a minion.
    if (summoner.info.abilityFlags & ctx.MA_ENTER_SUMMONS) {
        ctx.removeCreature(summoner); // defensive no-op if already removed
        if (atLeastOneMinion && host !== null) {
            host.carriedMonster = summoner;
            ctx.demoteMonsterFromLeadership(summoner);
            ctx.refreshDungeonCell(summoner.loc);
        } else {
            ctx.setCellFlag(summoner.loc, ctx.HAS_MONSTER);
            ctx.prependCreature(summoner);
        }
    } else if (atLeastOneMinion) {
        summoner.bookkeepingFlags |= ctx.MB_LEADER;
    }

    ctx.createFlare(summoner.loc.x, summoner.loc.y, ctx.SUMMONING_FLASH_LIGHT);

    return atLeastOneMinion;
}
