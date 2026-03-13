/*
 *  monster-lifecycle.ts — Monster ally conversion, cloning, and resurrection
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c, src/brogue/Movement.c
 *  Functions: becomeAllyWith (Movement.c:513), cloneMonster (Monsters.c:559),
 *             resurrectAlly (Monsters.c:2889)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos, CreatureType } from "../types/types.js";
import { CreatureState, StatusEffect } from "../types/enums.js";
import {
    MonsterAbilityFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    TileFlag,
    T_DIVIDES_LEVEL,
    T_PATHING_BLOCKER,
    T_HARMFUL_TERRAIN,
} from "../types/flags.js";
import { gray } from "../globals/colors.js";
import { initializeGender, initializeStatus } from "./monster-creation.js";
import { avoidedFlagsForMonster } from "./monster-spawning.js";
import type { MonsterRNG } from "./monster-creation.js";

// =============================================================================
// BecomeAllyContext
// =============================================================================

/**
 * Context for becomeAllyWith — DI for side-effectful callbacks.
 */
export interface BecomeAllyContext {
    /** The player creature (used to set the new leader). */
    player: Creature;
    /** Remove leader status from monst and reassign its followers. */
    demoteMonsterFromLeadership(monst: Creature): void;
    /** Drop monst's carried item onto the floor (if any). */
    makeMonsterDropItem(monst: Creature): void;
    /** Refresh the visual display of a dungeon cell (stub-safe). */
    refreshDungeonCell(loc: Pos): void;
}

// =============================================================================
// becomeAllyWith — Movement.c:513
// =============================================================================

/**
 * Converts a monster into an ally of the player.
 *
 * Removes leader status, drops any carried item, recursively converts any
 * carried monster (e.g. a phoenix inside its egg), then sets ally state and
 * bookkeeping flags.
 *
 * C: void becomeAllyWith(creature *monst)
 *
 * @param monst The creature to convert.
 * @param ctx   Ally conversion context.
 */
export function becomeAllyWith(monst: Creature, ctx: BecomeAllyContext): void {
    ctx.demoteMonsterFromLeadership(monst);

    if (monst.carriedItem) {
        ctx.makeMonsterDropItem(monst);
    }

    if (monst.carriedMonster) {
        becomeAllyWith(monst.carriedMonster, ctx);
    }

    monst.creatureState = CreatureState.Ally;
    monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
    monst.leader = ctx.player;
    monst.bookkeepingFlags &= ~(
        MonsterBookkeepingFlag.MB_CAPTIVE |
        MonsterBookkeepingFlag.MB_SEIZED
    );

    ctx.refreshDungeonCell(monst.loc);
}

// =============================================================================
// CloneMonsterContext
// =============================================================================

/**
 * Context for cloneMonster — map operations, IO, and creature list management.
 */
export interface CloneMonsterContext {
    /** RNG for initializeGender. */
    rng: MonsterRNG;
    /** The player creature. */
    player: Creature;
    /** Active monsters list (for jellymancer count). */
    monsters: Creature[];
    /** Dormant monsters list (for carriedMonster clone cleanup). */
    dormantMonsters: Creature[];

    // ── Creature list ops ────────────────────────────────────────────────────
    /** Add a creature to the front of the active monsters list. */
    prependCreature(monst: Creature): void;
    /** Remove a creature from the active monsters list. Returns true if found. */
    removeFromMonsters(monst: Creature): boolean;
    /** Remove a creature from the dormant monsters list. Returns true if found. */
    removeFromDormant(monst: Creature): boolean;

    // ── Ally conversion ──────────────────────────────────────────────────────
    /** Convert monst into a player ally (full becomeAllyWith semantics). */
    becomeAllyWith(monst: Creature): void;

    // ── Map ops ──────────────────────────────────────────────────────────────
    /**
     * Find a qualifying cell near loc using path-based search.
     * Stub returns loc as-is; real impl uses Dijkstra pathfinding.
     */
    getQualifyingPathLocNear(
        loc: Pos,
        hallwaysAllowed: boolean,
        blockingTerrainFlags: number,
        blockingMapFlags: number,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;
    /** Set a flag on the pmap cell at loc (e.g. HAS_MONSTER). */
    setPmapFlag(loc: Pos, flag: number): void;
    /** Refresh the visual display of a dungeon cell (stub-safe). */
    refreshDungeonCell(loc: Pos): void;

    // ── Visibility / messaging ───────────────────────────────────────────────
    /** Whether the player can see monst. */
    canSeeMonster(monst: Creature): boolean;
    /** The display name of monst (with optional article). */
    monsterName(monst: Creature, includeArticle: boolean): string;
    /** Display a game message (stub-safe). */
    message(text: string, flags: number): void;

    // ── Feat tracking ────────────────────────────────────────────────────────
    /** Array of feat completion flags (indexed by feat enum value). */
    featRecord: boolean[];
    /** Index of FEAT_JELLYMANCER in featRecord. */
    FEAT_JELLYMANCER: number;
}

// =============================================================================
// cloneMonster — Monsters.c:559
// =============================================================================

/**
 * Create a copy of a monster and optionally place it near the original.
 *
 * Deep-copies monst's state (mutated info, status, current HP, etc.),
 * clears transient bookkeeping (mapToMe, safetyMap, carriedItem, carried-
 * monster), and adjusts leadership/follower flags. If the original was
 * captive, the clone becomes an ally. If placeClone is true, a nearby cell
 * is chosen, the pmap flag is set, and an announcement message may be shown.
 * A player clone gets adjusted stats and becomes an ally.
 *
 * C: creature *cloneMonster(creature *monst, boolean announce, boolean placeClone)
 *
 * @param monst      The creature to clone.
 * @param announce   If true and the clone can be seen, display a message.
 * @param placeClone If true, place the clone on the map near monst.
 * @param ctx        Clone context.
 * @returns          The newly created clone (already in ctx.monsters).
 */
export function cloneMonster(
    monst: Creature,
    announce: boolean,
    placeClone: boolean,
    ctx: CloneMonsterContext,
): Creature {
    // Deep copy monst — replicate C's `*newMonst = *monst`
    const newMonst: Creature = {
        ...monst,
        info: {
            ...monst.info,
            damage: { ...monst.info.damage },
            foreColor: { ...monst.info.foreColor },
            bolts: [...monst.info.bolts],
        },
        status: [...monst.status],
        maxStatus: [...monst.maxStatus],
        waypointAlreadyVisited: [...monst.waypointAlreadyVisited],
        loc: { ...monst.loc },
        flashColor: { ...monst.flashColor },
    };

    // Clear transient state that must not be shared
    newMonst.carriedMonster = null;
    initializeGender(newMonst, ctx.rng);
    newMonst.bookkeepingFlags &= ~(
        MonsterBookkeepingFlag.MB_LEADER |
        MonsterBookkeepingFlag.MB_CAPTIVE |
        MonsterBookkeepingFlag.MB_WEAPON_AUTO_ID
    );
    newMonst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_FOLLOWER;
    newMonst.mapToMe = null;
    newMonst.safetyMap = null;
    newMonst.carriedItem = null;

    // The clone is added to the active monsters list (mirrors C generateMonster
    // which always calls prependCreature).
    ctx.prependCreature(newMonst);

    // If the original carried a monster (phoenix egg / vampire / phylactery),
    // also clone it — then immediately remove from the active list.
    // C comment: "The cloned creature will be added to the world, which we immediately undo."
    if (monst.carriedMonster) {
        const parentClone = cloneMonster(monst.carriedMonster, false, false, ctx);
        ctx.removeFromMonsters(parentClone);
        ctx.removeFromDormant(parentClone);
    }

    newMonst.ticksUntilTurn = 101;

    // Non-ally clones lose telepathic revelation
    if (monst.creatureState !== CreatureState.Ally) {
        newMonst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED;
    }

    // Inherit or assign leader
    if (monst.leader) {
        newMonst.leader = monst.leader;
    } else {
        newMonst.leader = monst;
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_LEADER;
    }

    // Cloning a captive makes the clone an ally
    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
        ctx.becomeAllyWith(newMonst);
    }

    // Place the clone on the map
    if (placeClone) {
        const avoided = avoidedFlagsForMonster(newMonst.info);
        newMonst.loc = ctx.getQualifyingPathLocNear(
            monst.loc,
            true,
            T_DIVIDES_LEVEL & avoided,
            TileFlag.HAS_PLAYER,
            avoided,
            TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS,
            false,
        );
        ctx.setPmapFlag(newMonst.loc, TileFlag.HAS_MONSTER);
        ctx.refreshDungeonCell(newMonst.loc);

        if (announce && ctx.canSeeMonster(newMonst)) {
            const monstName = ctx.monsterName(newMonst, false);
            ctx.message(`another ${monstName} appears!`, 0);
        }
    }

    // Player-clone special case: weaker copy that becomes an ally
    if (monst === ctx.player) {
        newMonst.info.foreColor = { ...gray };
        newMonst.info.damage.lowerBound = 1;
        newMonst.info.damage.upperBound = 2;
        newMonst.info.damage.clumpFactor = 1;
        newMonst.info.defense = 0;
        newMonst.info.monsterName = "clone";
        newMonst.creatureState = CreatureState.Ally;
    }

    // Jellymancer feat: if 90+ allied cloning monsters exist
    if (
        monst.creatureState === CreatureState.Ally &&
        (monst.info.abilityFlags & MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND) &&
        !ctx.featRecord[ctx.FEAT_JELLYMANCER]
    ) {
        let jellyCount = 0;
        for (const m of ctx.monsters) {
            if (
                m.creatureState === CreatureState.Ally &&
                (m.info.abilityFlags & MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND)
            ) {
                jellyCount++;
            }
        }
        if (jellyCount >= 90) {
            ctx.featRecord[ctx.FEAT_JELLYMANCER] = true;
        }
    }

    return newMonst;
}

// =============================================================================
// ResurrectAllyContext
// =============================================================================

/**
 * Context for resurrectAlly — purgatory access and creature lifecycle ops.
 */
export interface ResurrectAllyContext {
    /** Dead allies awaiting potential resurrection. */
    purgatory: Creature[];
    /** Active monsters list (clone is prepended here). */
    monsters: Creature[];
    /** Monster catalog (for MA_ENTER_SUMMONS info reset). */
    monsterCatalog: readonly CreatureType[];

    // ── Creature list ops ────────────────────────────────────────────────────
    /** Remove a creature from the purgatory list. */
    removeFromPurgatory(monst: Creature): void;
    /** Add a creature to the front of the active monsters list. */
    prependCreature(monst: Creature): void;

    // ── Map ops ──────────────────────────────────────────────────────────────
    /**
     * Find a qualifying cell near loc using path-based search.
     * Stub returns loc as-is; real impl uses Dijkstra pathfinding.
     */
    getQualifyingPathLocNear(
        loc: Pos,
        hallwaysAllowed: boolean,
        blockingTerrainFlags: number,
        blockingMapFlags: number,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;
    /** Set a flag on the pmap cell at loc (e.g. HAS_MONSTER). */
    setPmapFlag(loc: Pos, flag: number): void;

    // ── Creature restoration ─────────────────────────────────────────────────
    /** Heal monst by percent of max HP; panacea also clears negative statuses. */
    heal(monst: Creature, percent: number, panacea: boolean): void;
}

// =============================================================================
// resurrectAlly — Monsters.c:2889
// =============================================================================

/**
 * Revive the most powerful dead ally from purgatory near the given location.
 *
 * Selects the ally with the highest totalPowerCount (break ties by monsterID),
 * moves it from purgatory to the active monsters list, places it near loc,
 * clears dying bookkeeping flags, removes burning/discordant status, and heals
 * it to full. Monsters with MA_ENTER_SUMMONS (phoenix, phylactery, vampire)
 * have their info reset from the catalog and their status reinitialized.
 *
 * C: boolean resurrectAlly(const pos loc)
 *
 * @param loc Location near which to place the resurrected ally.
 * @param ctx Resurrection context.
 * @returns   true if an ally was resurrected, false if purgatory was empty.
 */
export function resurrectAlly(loc: Pos, ctx: ResurrectAllyContext): boolean {
    // Find the most empowered ally in purgatory
    let monToRaise: Creature | null = null;
    for (const monst of ctx.purgatory) {
        if (
            monToRaise === null ||
            monst.totalPowerCount > monToRaise.totalPowerCount ||
            (
                monst.totalPowerCount === monToRaise.totalPowerCount &&
                monst.info.monsterID > monToRaise.info.monsterID
            )
        ) {
            monToRaise = monst;
        }
    }

    if (!monToRaise) {
        return false;
    }

    // Move from purgatory to the active world
    ctx.removeFromPurgatory(monToRaise);
    ctx.prependCreature(monToRaise);

    monToRaise.loc = ctx.getQualifyingPathLocNear(
        loc,
        true,
        T_PATHING_BLOCKER | T_HARMFUL_TERRAIN,
        0,
        0,
        TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER,
        false,
    );
    ctx.setPmapFlag(monToRaise.loc, TileFlag.HAS_MONSTER);

    // Clear dying-state bookkeeping flags
    monToRaise.bookkeepingFlags &= ~(
        MonsterBookkeepingFlag.MB_IS_DYING |
        MonsterBookkeepingFlag.MB_ADMINISTRATIVE_DEATH |
        MonsterBookkeepingFlag.MB_HAS_DIED |
        MonsterBookkeepingFlag.MB_IS_FALLING
    );

    // Remove burning unless the monster is intrinsically fiery
    if (
        !(monToRaise.info.flags & MonsterBehaviorFlag.MONST_FIERY) &&
        monToRaise.status[StatusEffect.Burning]
    ) {
        monToRaise.status[StatusEffect.Burning] = 0;
    }
    monToRaise.status[StatusEffect.Discordant] = 0;

    ctx.heal(monToRaise, 100, true);

    // Special handling for MA_ENTER_SUMMONS creatures (phoenix egg, phylactery, vampire)
    const catalogInfo = ctx.monsterCatalog[monToRaise.info.monsterID];
    if (catalogInfo && (catalogInfo.abilityFlags & MonsterAbilityFlag.MA_ENTER_SUMMONS)) {
        monToRaise.info = {
            ...catalogInfo,
            damage: { ...catalogInfo.damage },
            foreColor: { ...catalogInfo.foreColor },
            bolts: [...catalogInfo.bolts],
        };
        initializeStatus(monToRaise);
        monToRaise.wasNegated = false;
    }

    return true;
}
