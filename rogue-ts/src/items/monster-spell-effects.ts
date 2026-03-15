/*
 *  items/monster-spell-effects.ts — monster-targeting spell effects
 *  Port V2 — rogue-ts
 *
 *  Ported from Items.c:
 *    polymorph (3841), aggravateMonsters (3358),
 *    crystalize (4150), summonGuardian (6651)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, CreatureType, Pcell, Pos, Color, Bolt, Item, Fixpt } from "../types/types.js";
import {
    MonsterBehaviorFlag,
    MonsterAbilityFlag,
    MonsterBookkeepingFlag,
    TileFlag,
    TerrainFlag,
    T_DIVIDES_LEVEL,
} from "../types/flags.js";
import {
    StatusEffect,
    CreatureState,
    CreatureMode,
    MonsterType,
    TileType,
    DungeonLayer,
    DungeonFeatureType,
    BoltType,
} from "../types/enums.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { avoidedFlagsForMonster } from "../monsters/monster-spawning.js";

// =============================================================================
// polymorph — Items.c:3841
// =============================================================================

export interface PolymorphContext {
    /** The player creature (polymorph is blocked on the player). */
    player: Creature;
    /** Monster catalog for picking a new type. */
    monsterCatalog: readonly CreatureType[];
    /** Bolt catalog for BOLT_POLYMORPH back-color. */
    boltCatalog: readonly Bolt[];
    /** Integer random range [lo, hi] inclusive. */
    randRange(low: number, high: number): number;
    /** Disassociate monster from the player. */
    unAlly(monst: Creature): void;
    /** Free a creature (remove from world and clean up). */
    freeCreature(monst: Creature): void;
    /** Re-initialise all status arrays on the creature after type-swap. */
    initializeStatus(monst: Creature): void;
    /** Remove the monster's leadership role. */
    demoteMonsterFromLeadership(monst: Creature): void;
    /** Refresh the dungeon cell rendering (render stub). */
    refreshDungeonCell(loc: Pos): void;
    /** Flash a color on the monster (render stub). */
    flashMonster(monst: Creature, color: Color, strength: number): void;
}

/**
 * Randomly re-type a monster as a different creature kind.
 * Health fraction is preserved, mutation cleared, ally status removed,
 * and captive/seizing state cleaned up.
 * Returns true if the polymorph happened, false if the target is immune.
 *
 * Ported from Items.c:3841 — static boolean polymorph(creature *monst).
 */
export function polymorph(monst: Creature, ctx: PolymorphContext): boolean {
    if (
        monst === ctx.player ||
        (monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
    ) {
        return false; // Sorry, this is not Nethack.
    }

    // Reset fleeing state for flee-prone monsters so they don't run away polymorphed.
    if (
        monst.creatureState === CreatureState.Fleeing &&
        (
            (monst.info.flags & (MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE | MonsterBehaviorFlag.MONST_FLEES_NEAR_DEATH)) ||
            (monst.info.abilityFlags & MonsterAbilityFlag.MA_HIT_STEAL_FLEE)
        )
    ) {
        monst.creatureState = CreatureState.TrackingScent;
        monst.creatureMode = CreatureMode.Normal;
    }

    ctx.unAlly(monst); // Sorry, no cheap dragon allies.
    monst.mutationIndex = -1; // Polymorph cures mutation -- basic science.

    // After polymorphing, don't "drop" any creature on death (e.g. phylactery, phoenix egg).
    if (monst.carriedMonster) {
        ctx.freeCreature(monst.carriedMonster);
        monst.carriedMonster = null;
    }

    const healthFraction = Math.trunc(monst.currentHP * 1000 / monst.info.maxHP);
    const previousDamageTaken = monst.info.maxHP - monst.currentHP;

    // Pick a random monster type that is not inanimate, not NO_POLYMORPH, and not the same kind.
    let newMonsterIndex: number;
    do {
        newMonsterIndex = ctx.randRange(1, MonsterType.NUMBER_MONSTER_KINDS - 1);
    } while (
        (ctx.monsterCatalog[newMonsterIndex]?.flags &
            (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_NO_POLYMORPH)) ||
        newMonsterIndex === monst.info.monsterID
    );

    // Deep-copy the new type so subsequent mutations don't touch the catalog.
    const newType = ctx.monsterCatalog[newMonsterIndex];
    monst.info = {
        ...newType,
        damage: { ...newType.damage },
        foreColor: { ...newType.foreColor },
        bolts: [...newType.bolts],
    };
    monst.info.turnsBetweenRegen = Math.trunc(monst.info.turnsBetweenRegen * 1000);

    monst.currentHP = Math.max(
        1,
        Math.max(
            Math.trunc(healthFraction * monst.info.maxHP / 1000),
            monst.info.maxHP - previousDamageTaken,
        ),
    );

    monst.movementSpeed = monst.info.movementSpeed;
    monst.attackSpeed = monst.info.attackSpeed;
    if (monst.status[StatusEffect.Hasted]) {
        monst.movementSpeed = Math.trunc(monst.movementSpeed / 2);
        monst.attackSpeed = Math.trunc(monst.attackSpeed / 2);
    }
    if (monst.status[StatusEffect.Slowed]) {
        monst.movementSpeed *= 2;
        monst.attackSpeed *= 2;
    }

    monst.wasNegated = false;
    ctx.initializeStatus(monst);

    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
        ctx.demoteMonsterFromLeadership(monst);
        monst.creatureState = CreatureState.TrackingScent;
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_CAPTIVE;
    }
    monst.bookkeepingFlags &= ~(MonsterBookkeepingFlag.MB_SEIZING | MonsterBookkeepingFlag.MB_SEIZED);

    monst.ticksUntilTurn = Math.max(monst.ticksUntilTurn, 101);

    ctx.refreshDungeonCell(monst.loc);
    const polymorphBolt = ctx.boltCatalog[BoltType.POLYMORPH];
    if (polymorphBolt?.backColor) {
        ctx.flashMonster(monst, polymorphBolt.backColor, 100);
    }
    return true;
}

// =============================================================================
// aggravateMonsters — Items.c:3358
// =============================================================================

export interface AggravateContext {
    /** The player. */
    player: Creature;
    /** All active monsters. */
    monsters: Creature[];
    /** The scent map grid for zeroing and scent deposit. */
    scentMap: number[][];
    /**
     * Compute path distances from (x, y) via T_PATHING_BLOCKER.
     * Returned grid values: distance for reachable cells, large sentinel for
     * impassable cells (same semantics as C fillGrid(0) + calculateDistances).
     */
    getPathDistances(x: number, y: number): number[][];
    /** Refresh waypoint 0 to position (x, y) for monster pathfinding. */
    refreshWaypoint(x: number, y: number): void;
    /** Wake a sleeping monster (and teammates). */
    wakeUp(monst: Creature): void;
    /** Alert a non-ally monster to start hunting the player. */
    alertMonster(monst: Creature): void;
    /** Add scent to a cell with a distance-based value. */
    addScentToCell(x: number, y: number, distance: number): void;
    /** Set rogue.stealthRange to the given value. */
    setStealthRange(range: number): void;
    /** Compute the current stealth range. */
    currentStealthRange(): number;
    /** Reveal a cell's secret doors. */
    discover(x: number, y: number): void;
    /** Mark a cell as discovered in pmap flags. */
    discoverCell(x: number, y: number): void;
    /** Flash a color at the given dungeon position (render). */
    colorFlash(
        color: Color,
        tableRow: number,
        flags: number,
        duration: number,
        maxRadius: number,
        x: number,
        y: number,
    ): Promise<void>;
    /** True if the player can see (x, y). */
    playerCanSee(x: number, y: number): boolean;
    /** Display a message. */
    message(msg: string, flags: number): void | Promise<void>;
}

/**
 * Wake all monsters within `distance` cells of (x, y) and set them hunting.
 * Clears MAINTAINS_DISTANCE and MA_AVOID_CORRIDORS for non-allies.
 * Fills the scent map toward the alarm origin so monsters can pathfind there.
 * Applies STATUS_AGGRAVATING to the player if standing at (x, y).
 *
 * Ported from Items.c:3358 — void aggravateMonsters(distance, x, y, flashColor).
 */
export async function aggravateMonsters(
    distance: number,
    x: number,
    y: number,
    flashColor: Color,
    ctx: AggravateContext,
): Promise<void> {
    const { player, monsters, scentMap } = ctx;

    ctx.refreshWaypoint(x, y);

    const grid = ctx.getPathDistances(x, y);

    for (const monst of monsters) {
        const dist = grid[monst.loc.x]?.[monst.loc.y] ?? Infinity;
        if (dist <= distance) {
            if (monst.creatureState === CreatureState.Sleeping) {
                ctx.wakeUp(monst);
            }
            if (monst.creatureState !== CreatureState.Ally && monst.leader !== player) {
                ctx.alertMonster(monst);
                monst.info.flags &= ~MonsterBehaviorFlag.MONST_MAINTAINS_DISTANCE;
                monst.info.abilityFlags &= ~MonsterAbilityFlag.MA_AVOID_CORRIDORS;
            }
        }
    }

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const dist = grid[i]?.[j] ?? -1;
            if (dist >= 0 && dist <= distance) {
                scentMap[i][j] = 0;
                ctx.addScentToCell(i, j, 2 * dist);
            }
        }
    }

    if (player.loc.x === x && player.loc.y === y) {
        player.status[StatusEffect.Aggravating] = player.maxStatus[StatusEffect.Aggravating] = distance;
        ctx.setStealthRange(ctx.currentStealthRange());
    }

    const playerDist = grid[player.loc.x]?.[player.loc.y] ?? -1;
    if (playerDist >= 0 && playerDist <= distance) {
        ctx.discover(x, y);
        ctx.discoverCell(x, y);
        await ctx.colorFlash(
            flashColor, 0,
            TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED,
            10, distance, x, y,
        );
        if (!ctx.playerCanSee(x, y)) {
            await ctx.message(
                "You hear a piercing shriek; something must have triggered a nearby alarm.",
                0,
            );
        }
    }
}

// =============================================================================
// crystalize — Items.c:4150
// =============================================================================

export interface CrystalizeContext {
    /** The player (crystal radius is centered on the player). */
    player: Creature;
    /** The terrain map. */
    pmap: Pcell[][];
    /** Spawn a dungeon feature at a cell. */
    spawnDungeonFeature(
        x: number,
        y: number,
        dfType: DungeonFeatureType,
        refreshCell: boolean,
        abortIfBlocking: boolean,
    ): void;
    /** Return the creature at the given cell, or null. */
    monsterAtLoc(pos: Pos): Creature | null;
    /** Inflict lethal damage on a creature. */
    inflictLethalDamage(attacker: Creature | null, defender: Creature): void;
    /** Kill a creature. */
    killCreature(monst: Creature, administrativeDeath: boolean): void;
    /** Free any captive monster embedded in terrain at (x, y). */
    freeCaptivesEmbeddedAt(x: number, y: number): void;
    /** Update the player's field of vision (render). */
    updateVision(full: boolean): void;
    /** Flash a color over the dungeon (render). */
    colorFlash(
        color: Color,
        tableRow: number,
        flags: number,
        duration: number,
        maxRadius: number,
        x: number,
        y: number,
    ): void;
    /** Re-render the dungeon (render). */
    displayLevel(): void;
    /** Refresh the sidebar (render). */
    refreshSideBar(): void;
    /** Force-field flash color. */
    forceFieldColor: Color;
}

/**
 * Convert all wall tiles within `radius` cells of the player into force-field
 * crystal. Monsters embedded in new crystal walls are freed or killed depending
 * on their flags. Boundary walls become permanent crystal walls.
 *
 * Ported from Items.c:4150 — static void crystalize(short radius).
 */
export function crystalize(radius: number, ctx: CrystalizeContext): void {
    const { player, pmap } = ctx;
    const px = player.loc.x;
    const py = player.loc.y;
    const rSq = radius * radius;

    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            const dx = px - i;
            const dy = py - j;
            if (dx * dx + dy * dy > rSq) continue;
            if (pmap[i][j].flags & TileFlag.IMPREGNABLE) continue;

            const dungeonTile = pmap[i][j].layers[DungeonLayer.Dungeon];
            const tileFlags = tileCatalog[dungeonTile]?.flags ?? 0;
            if (!(tileFlags & (TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION))) {
                continue;
            }

            pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.FORCEFIELD;
            ctx.spawnDungeonFeature(i, j, DungeonFeatureType.DF_SHATTERING_SPELL, true, false);

            if (pmap[i][j].flags & TileFlag.HAS_MONSTER) {
                const monst = ctx.monsterAtLoc({ x: i, y: j });
                if (monst) {
                    if (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS) {
                        ctx.inflictLethalDamage(null, monst);
                        ctx.killCreature(monst, false);
                    } else {
                        ctx.freeCaptivesEmbeddedAt(i, j);
                    }
                }
            }

            if (i === 0 || i === DCOLS - 1 || j === 0 || j === DROWS - 1) {
                pmap[i][j].layers[DungeonLayer.Dungeon] = TileType.CRYSTAL_WALL; // boundary walls turn to crystal
            }
        }
    }

    ctx.updateVision(false);
    ctx.colorFlash(ctx.forceFieldColor, 0, 0, radius, radius, px, py);
    ctx.displayLevel();
    ctx.refreshSideBar();
}

// =============================================================================
// summonGuardian — Items.c:6651
// =============================================================================

export interface SummonGuardianContext {
    /** The player. */
    player: Creature;
    /** The pmap for setting HAS_MONSTER flag. */
    pmap: Pcell[][];
    /** Generate a fresh monster of the given kind. */
    generateMonster(kind: MonsterType, itemPossible: boolean, mutationPossible: boolean): Creature;
    /**
     * Find a valid spawn position near `loc`.
     * Matches C getQualifyingPathLocNear signature.
     */
    getQualifyingPathLocNear(
        loc: Pos,
        useDiags: boolean,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        adjacentTerrainFlags: number,
        adjacentMapFlags: number,
        forbidLitTiles: boolean,
    ): Pos;
    /** Compute the guardian's lifespan from the charm enchant level. */
    charmGuardianLifespan(enchant: Fixpt): number;
    /** Compute net enchant for the given item. */
    netEnchant(item: Item): Fixpt;
    /** Animate the guardian fading in (render stub). */
    fadeInMonster(monst: Creature): void;
}

/**
 * Summon a charm guardian near the player.
 * The guardian is bound to the player as a temporary ally with a
 * lifespan based on the charm's enchant level.
 *
 * Ported from Items.c:6651 — static void summonGuardian(item *theItem).
 */
export function summonGuardian(theItem: Item, ctx: SummonGuardianContext): void {
    const { player, pmap } = ctx;

    const monst = ctx.generateMonster(MonsterType.MK_CHARM_GUARDIAN, false, false);

    const avoidFlags = avoidedFlagsForMonster(monst.info) & ~TerrainFlag.T_SPONTANEOUSLY_IGNITES;
    monst.loc = ctx.getQualifyingPathLocNear(
        { x: player.loc.x, y: player.loc.y },
        true,
        T_DIVIDES_LEVEL & avoidFlags,
        TileFlag.HAS_PLAYER,
        avoidFlags,
        TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS,
        false,
    );

    monst.bookkeepingFlags |= (
        MonsterBookkeepingFlag.MB_FOLLOWER |
        MonsterBookkeepingFlag.MB_BOUND_TO_LEADER |
        MonsterBookkeepingFlag.MB_DOES_NOT_TRACK_LEADER
    );
    monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_JUST_SUMMONED;
    monst.leader = player;
    monst.creatureState = CreatureState.Ally;
    monst.ticksUntilTurn = monst.info.attackSpeed + 1;

    const lifespan = ctx.charmGuardianLifespan(ctx.netEnchant(theItem));
    monst.status[StatusEffect.LifespanRemaining] = monst.maxStatus[StatusEffect.LifespanRemaining] = lifespan;

    pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.HAS_MONSTER;
    ctx.fadeInMonster(monst);
}
