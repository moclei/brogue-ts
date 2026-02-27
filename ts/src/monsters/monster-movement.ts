/*
 *  monster-movement.ts — Monster movement helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Monsters.c, src/brogue/Grid.c
 *  Functions: canPass, isPassableOrSecretDoor, setMonsterLocation,
 *             moveMonster, findAlternativeHomeFor, getQualifyingLocNear,
 *             getQualifyingGridLocNear
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pos } from "../types/types.js";
import { StatusEffect } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    TerrainFlag,
    TerrainMechFlag,
    T_PATHING_BLOCKER,
} from "../types/flags.js";
import {
    monstersAreTeammates,
    monstersAreEnemies,
    monsterWillAttackTarget,
} from "./monster-queries.js";

// ============================================================================
// Movement context — DI for map/combat-dependent operations
// ============================================================================

/**
 * Context for monster movement operations that need map, combat, or game data.
 */
export interface MonsterMovementContext {
    /** The player creature. */
    player: Creature;
    /** All active monsters. */
    monsters: Creature[];
    /** Random number generator. */
    rng: {
        randRange(lo: number, hi: number): number;
        randPercent(pct: number): boolean;
    };

    // ── Map access ──
    /** Check if coordinates are within the map. */
    coordinatesAreInMap(x: number, y: number): boolean;
    /** Check if cell has terrain flags. */
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    /** Check if cell has terrain mechanics flags. */
    cellHasTMFlag(loc: Pos, flags: number): boolean;
    /** Get cell flags at a position (HAS_MONSTER, HAS_PLAYER, etc.). */
    cellFlags(loc: Pos): number;
    /** Set cell flags at a position. */
    setCellFlag(loc: Pos, flag: number): void;
    /** Clear cell flags at a position. */
    clearCellFlag(loc: Pos, flag: number): void;
    /** Get terrain flags revealed by discovering secrets at a location. */
    discoveredTerrainFlagsAtLoc(loc: Pos): number;
    /** Count passable arcs around a position. */
    passableArcCount(x: number, y: number): number;
    /** Check if the liquid layer at a position is empty (NOTHING). */
    liquidLayerIsEmpty(loc: Pos): boolean;
    /** Whether the player can see a location. */
    playerCanSee(x: number, y: number): boolean;
    /** Find the creature at a given location. */
    monsterAtLoc(loc: Pos): Creature | null;

    // ── Side effects ──
    /** Refresh a dungeon cell display. */
    refreshDungeonCell(loc: Pos): void;
    /** Discover a secret door/lever at a location. */
    discover(x: number, y: number): void;
    /** Apply instant tile effects (lava, traps, etc.) to creature. */
    applyInstantTileEffectsToCreature(monst: Creature): void;
    /** Update player vision after movement. */
    updateVision(refreshDisplay: boolean): void;
    /** Pick up items at the player's location. */
    pickUpItemAt(loc: Pos): void;
    /** Shuffle an array of numbers in place. */
    shuffleList(list: number[]): void;
    /** Check if a monster avoids a given position (delegation). */
    monsterAvoids(monst: Creature, p: Pos): boolean;

    // ── Cell flags ──
    HAS_MONSTER: number;
    HAS_PLAYER: number;
    HAS_ITEM: number;
    HAS_STAIRS: number;
    /** Map dimensions */
    DCOLS: number;
    DROWS: number;
}

// ============================================================================
// canPass — Can a mover swap places with a blocker?
// ============================================================================

/**
 * Determines if one creature can swap places with another (e.g., push past an ally).
 *
 * Ported from canPass() in Monsters.c.
 */
export function canPass(
    mover: Creature,
    blocker: Creature,
    player: Creature,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
): boolean {
    if (blocker === player) {
        return false;
    }

    if (
        blocker.status[StatusEffect.Confused] ||
        blocker.status[StatusEffect.Stuck] ||
        blocker.status[StatusEffect.Paralyzed] ||
        blocker.status[StatusEffect.Entranced] ||
        mover.status[StatusEffect.Entranced]
    ) {
        return false;
    }

    if (
        (blocker.bookkeepingFlags & (MonsterBookkeepingFlag.MB_CAPTIVE | MonsterBookkeepingFlag.MB_ABSORBING)) ||
        (blocker.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)
    ) {
        return false;
    }

    if (monstersAreEnemies(mover, blocker, player, cellHasTerrainFlag)) {
        return false;
    }

    if (blocker.leader === mover) {
        return true;
    }

    if (mover.leader === blocker) {
        return false;
    }

    return (
        monstersAreTeammates(mover, blocker, player) &&
        blocker.currentHP < mover.currentHP
    );
}

// ============================================================================
// isPassableOrSecretDoor
// ============================================================================

/**
 * Checks if a location is passable, or is a secret door/passage that monsters
 * can traverse. Used to determine if a movement path is valid.
 *
 * Ported from isPassableOrSecretDoor() in Monsters.c.
 */
export function isPassableOrSecretDoor(
    loc: Pos,
    cellHasTerrainFlag: (loc: Pos, flags: number) => boolean,
    cellHasTMFlag: (loc: Pos, flags: number) => boolean,
    discoveredTerrainFlagsAtLoc: (loc: Pos) => number,
): boolean {
    return (
        !cellHasTerrainFlag(loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
        (cellHasTMFlag(loc, TerrainMechFlag.TM_IS_SECRET) &&
            !(discoveredTerrainFlagsAtLoc(loc) & TerrainFlag.T_OBSTRUCTS_PASSABILITY))
    );
}

// ============================================================================
// setMonsterLocation
// ============================================================================

/**
 * Moves a monster to a new location, updating cell flags, clearing submerged
 * status if needed, revealing secret doors, and applying tile effects.
 *
 * Ported from setMonsterLocation() in Monsters.c.
 */
export function setMonsterLocation(
    monst: Creature,
    newLoc: Pos,
    ctx: MonsterMovementContext,
): void {
    const creatureFlag = monst === ctx.player ? ctx.HAS_PLAYER : ctx.HAS_MONSTER;

    ctx.clearCellFlag(monst.loc, creatureFlag);
    ctx.refreshDungeonCell(monst.loc);

    monst.turnsSpentStationary = 0;
    monst.loc = { x: newLoc.x, y: newLoc.y };

    ctx.setCellFlag(newLoc, creatureFlag);

    // Surface from submersion if terrain doesn't support it
    if (
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
        !ctx.cellHasTMFlag(newLoc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
    ) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
    }

    // Reveal secret doors used by monsters
    if (
        ctx.playerCanSee(newLoc.x, newLoc.y) &&
        ctx.cellHasTMFlag(newLoc, TerrainMechFlag.TM_IS_SECRET) &&
        ctx.cellHasTerrainFlag(newLoc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    ) {
        ctx.discover(newLoc.x, newLoc.y);
    }

    ctx.refreshDungeonCell(newLoc);
    ctx.applyInstantTileEffectsToCreature(monst);

    if (monst === ctx.player) {
        ctx.updateVision(true);
        if (ctx.cellFlags(ctx.player.loc) & ctx.HAS_ITEM) {
            ctx.pickUpItemAt(ctx.player.loc);
        }
    }
}

// ============================================================================
// findAlternativeHomeFor
// ============================================================================

/**
 * Bumps a creature to a random nearby hospitable cell.
 * Searches in expanding rings around the monster's current position.
 * Returns the new position, or {x: -1, y: -1} if no location found.
 *
 * Ported from findAlternativeHomeFor() in Monsters.c.
 */
export function findAlternativeHomeFor(
    monst: Creature,
    chooseRandomly: boolean,
    ctx: MonsterMovementContext,
): Pos {
    // Create sequential index lists
    const sCols: number[] = Array.from({ length: ctx.DCOLS }, (_, i) => i);
    const sRows: number[] = Array.from({ length: ctx.DROWS }, (_, i) => i);

    if (chooseRandomly) {
        ctx.shuffleList(sCols);
        ctx.shuffleList(sRows);
    }

    for (
        let maxDiff = 1;
        maxDiff < Math.max(ctx.DCOLS, ctx.DROWS);
        maxDiff++
    ) {
        for (let i = 0; i < ctx.DCOLS; i++) {
            for (let j = 0; j < ctx.DROWS; j++) {
                const dist = Math.abs(sCols[i] - monst.loc.x) + Math.abs(sRows[j] - monst.loc.y);
                if (
                    dist <= maxDiff &&
                    dist > 0 &&
                    !(ctx.cellFlags({ x: sCols[i], y: sRows[j] }) & (ctx.HAS_PLAYER | ctx.HAS_MONSTER)) &&
                    !ctx.monsterAvoids(monst, { x: sCols[i], y: sRows[j] }) &&
                    !(monst === ctx.player &&
                        ctx.cellHasTerrainFlag({ x: sCols[i], y: sRows[j] }, T_PATHING_BLOCKER))
                ) {
                    return { x: sCols[i], y: sRows[j] };
                }
            }
        }
    }

    return { x: -1, y: -1 };
}

// ============================================================================
// getQualifyingLocNear
// ============================================================================

/**
 * Finds a qualifying location near a target position by searching outward
 * in expanding square rings. Considers terrain flags, cell flags, liquid,
 * and hallway restrictions.
 *
 * @returns The qualifying position, or null if not found.
 *
 * Ported from getQualifyingLocNear() in Monsters.c.
 */
export function getQualifyingLocNear(
    target: Pos,
    hallwaysAllowed: boolean,
    blockingMap: number[][] | null,
    forbiddenTerrainFlags: number,
    forbiddenMapFlags: number,
    forbidLiquid: boolean,
    deterministic: boolean,
    ctx: MonsterMovementContext,
): Pos | null {
    const maxK = Math.max(ctx.DROWS, ctx.DCOLS);
    let candidateLocs = 0;

    // Count up candidate locations
    for (let k = 0; k < maxK && !candidateLocs; k++) {
        for (let i = target.x - k; i <= target.x + k; i++) {
            for (let j = target.y - k; j <= target.y + k; j++) {
                if (
                    ctx.coordinatesAreInMap(i, j) &&
                    (i === target.x - k || i === target.x + k || j === target.y - k || j === target.y + k) &&
                    (!blockingMap || !blockingMap[i][j]) &&
                    !ctx.cellHasTerrainFlag({ x: i, y: j }, forbiddenTerrainFlags) &&
                    !(ctx.cellFlags({ x: i, y: j }) & forbiddenMapFlags) &&
                    (!forbidLiquid || ctx.liquidLayerIsEmpty({ x: i, y: j })) &&
                    (hallwaysAllowed || ctx.passableArcCount(i, j) < 2)
                ) {
                    candidateLocs++;
                }
            }
        }
    }

    if (candidateLocs === 0) {
        return null;
    }

    // Pick one
    let randIndex: number;
    if (deterministic) {
        randIndex = 1 + Math.floor(candidateLocs / 2);
    } else {
        randIndex = ctx.rng.randRange(1, candidateLocs);
    }

    for (let k = 0; k < maxK; k++) {
        for (let i = target.x - k; i <= target.x + k; i++) {
            for (let j = target.y - k; j <= target.y + k; j++) {
                if (
                    ctx.coordinatesAreInMap(i, j) &&
                    (i === target.x - k || i === target.x + k || j === target.y - k || j === target.y + k) &&
                    (!blockingMap || !blockingMap[i][j]) &&
                    !ctx.cellHasTerrainFlag({ x: i, y: j }, forbiddenTerrainFlags) &&
                    !(ctx.cellFlags({ x: i, y: j }) & forbiddenMapFlags) &&
                    (!forbidLiquid || ctx.liquidLayerIsEmpty({ x: i, y: j })) &&
                    (hallwaysAllowed || ctx.passableArcCount(i, j) < 2)
                ) {
                    if (--randIndex === 0) {
                        return { x: i, y: j };
                    }
                }
            }
        }
    }

    return null; // should never reach
}

// ============================================================================
// getQualifyingGridLocNear
// ============================================================================

/**
 * Finds a qualifying location near a target position where a boolean grid
 * cell is true. Searches outward in expanding rings.
 *
 * @returns The qualifying position, or null if not found.
 *
 * Ported from getQualifyingGridLocNear() in Monsters.c.
 */
export function getQualifyingGridLocNear(
    target: Pos,
    grid: boolean[][],
    deterministic: boolean,
    ctx: MonsterMovementContext,
): Pos | null {
    const maxK = Math.max(ctx.DROWS, ctx.DCOLS);
    let candidateLocs = 0;

    // Count candidates
    for (let k = 0; k < maxK && !candidateLocs; k++) {
        for (let i = target.x - k; i <= target.x + k; i++) {
            for (let j = target.y - k; j <= target.y + k; j++) {
                if (
                    ctx.coordinatesAreInMap(i, j) &&
                    (i === target.x - k || i === target.x + k || j === target.y - k || j === target.y + k) &&
                    grid[i]?.[j]
                ) {
                    candidateLocs++;
                }
            }
        }
    }

    if (candidateLocs === 0) {
        return null;
    }

    let randIndex: number;
    if (deterministic) {
        randIndex = 1 + Math.floor(candidateLocs / 2);
    } else {
        randIndex = ctx.rng.randRange(1, candidateLocs);
    }

    for (let k = 0; k < maxK; k++) {
        for (let i = target.x - k; i <= target.x + k; i++) {
            for (let j = target.y - k; j <= target.y + k; j++) {
                if (
                    ctx.coordinatesAreInMap(i, j) &&
                    (i === target.x - k || i === target.x + k || j === target.y - k || j === target.y + k) &&
                    grid[i]?.[j]
                ) {
                    if (--randIndex === 0) {
                        return { x: i, y: j };
                    }
                }
            }
        }
    }

    return null; // should never reach
}

// ============================================================================
// moveMonster — skeleton with combat delegation
// ============================================================================

/**
 * Extended movement context adding combat operations needed by moveMonster.
 */
export interface MoveMonsterContext extends MonsterMovementContext {
    /** Perform vomit action. */
    vomit(monst: Creature): void;
    /** Get a random valid direction from a position. */
    randValidDirectionFrom(monst: Creature, x: number, y: number, includeOppositeDir: boolean): number;
    /** Direction deltas [dx, dy] for each direction index. */
    nbDirs: readonly [number, number][];
    /** Check if diagonal movement is blocked. */
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;
    /** Handle whip-style attacks. Returns true if attack was performed. */
    handleWhipAttacks(monst: Creature, dir: number, hitList: null): boolean;
    /** Handle spear-style attacks. Returns true if attack was performed. */
    handleSpearAttacks(monst: Creature, dir: number, hitList: null): boolean;
    /** Determine swarming direction. Returns -1 (NO_DIRECTION) if no swarming. */
    monsterSwarmDirection(monst: Creature, target: Creature): number;
    /** Build list of targets for area attacks. */
    buildHitList(hitList: (Creature | null)[], monst: Creature, target: Creature, allAdj: boolean): void;
    /** Perform a melee attack. */
    attack(attacker: Creature, defender: Creature, lungeAttack: boolean): void;
    /** Get qualifying path location near target. */
    getQualifyingPathLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        blockingFlags: number,
        blockingMapFlags: number,
        forbiddenFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;
    /** Get surface layer tile type at a position (for web clearing). */
    surfaceLayerAt(loc: Pos): number;
    /** Set surface layer to NOTHING at a position. */
    clearSurfaceLayer(loc: Pos): void;
    /** Terrain flag check for surface layer. */
    surfaceLayerHasFlag(loc: Pos, flags: number): boolean;
    /** Whether the game has ended. */
    gameHasEnded: boolean;
    /** NO_DIRECTION sentinel value. */
    NO_DIRECTION: number;
    /** forbiddenFlagsForMonster function. */
    forbiddenFlagsForMonster(info: Creature["info"]): number;
}

/**
 * Tries to move a monster one space or perform a melee attack in the given direction.
 * Handles confused/flitting movement, vomiting, web entanglement, swapping,
 * whip/spear attacks, swarming, and area attacks.
 *
 * Ported from moveMonster() in Monsters.c.
 */
export function moveMonster(
    monst: Creature,
    dx: number,
    dy: number,
    ctx: MoveMonsterContext,
): boolean {
    const x = monst.loc.x;
    const y = monst.loc.y;

    if (dx === 0 && dy === 0) {
        return false;
    }

    let newX = x + dx;
    let newY = y + dy;

    if (!ctx.coordinatesAreInMap(newX, newY)) {
        return false;
    }

    // Vomiting
    if (monst.status[StatusEffect.Nauseous] && ctx.rng.randPercent(25)) {
        ctx.vomit(monst);
        monst.ticksUntilTurn = monst.movementSpeed;
        return true;
    }

    // Move randomly?
    if (!monst.status[StatusEffect.Entranced]) {
        if (monst.status[StatusEffect.Confused]) {
            const confDir = ctx.randValidDirectionFrom(monst, x, y, false);
            if (confDir !== -1) {
                dx = ctx.nbDirs[confDir][0];
                dy = ctx.nbDirs[confDir][1];
            }
        } else if (
            (monst.info.flags & MonsterBehaviorFlag.MONST_FLITS) &&
            !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) &&
            ctx.rng.randPercent(33)
        ) {
            const confDir = ctx.randValidDirectionFrom(monst, x, y, true);
            if (confDir !== -1) {
                dx = ctx.nbDirs[confDir][0];
                dy = ctx.nbDirs[confDir][1];
            }
        }
    }

    newX = x + dx;
    newY = y + dy;

    // Liquid-based monsters can't move outside liquid
    if (
        (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
        !ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
    ) {
        return false;
    }

    // Caught in spiderweb?
    if (
        monst.status[StatusEffect.Stuck] &&
        !(ctx.cellFlags({ x: newX, y: newY }) & (ctx.HAS_PLAYER | ctx.HAS_MONSTER)) &&
        ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_ENTANGLES) &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS)
    ) {
        if (
            !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) &&
            --monst.status[StatusEffect.Stuck]
        ) {
            monst.ticksUntilTurn = monst.movementSpeed;
            return true;
        } else if (ctx.surfaceLayerHasFlag({ x, y }, TerrainFlag.T_ENTANGLES)) {
            ctx.clearSurfaceLayer({ x, y });
        }
    }

    let defender: Creature | null = null;

    if (ctx.cellFlags({ x: newX, y: newY }) & (ctx.HAS_MONSTER | ctx.HAS_PLAYER)) {
        defender = ctx.monsterAtLoc({ x: newX, y: newY });
    } else {
        // Check if seized
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED) {
            for (const other of ctx.monsters) {
                if (
                    (other.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) &&
                    monstersAreEnemies(monst, other, ctx.player, ctx.cellHasTerrainFlag) &&
                    Math.max(Math.abs(monst.loc.x - other.loc.x), Math.abs(monst.loc.y - other.loc.y)) === 1 &&
                    !ctx.diagonalBlocked(monst.loc.x, monst.loc.y, other.loc.x, other.loc.y, false)
                ) {
                    monst.ticksUntilTurn = monst.movementSpeed;
                    return true;
                }
            }
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SEIZED;
        }
        if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) {
            monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SEIZING;
        }
    }

    // Find direction index
    let dir = -1;
    for (let d = 0; d < ctx.nbDirs.length; d++) {
        if (dx === ctx.nbDirs[d][0] && dy === ctx.nbDirs[d][1]) {
            dir = d;
            break;
        }
    }

    // Handle whip/spear attacks
    if (dir !== -1) {
        if (ctx.handleWhipAttacks(monst, dir, null) || ctx.handleSpearAttacks(monst, dir, null)) {
            monst.ticksUntilTurn = monst.attackSpeed;
            return true;
        }
    }

    const curPassable = isPassableOrSecretDoor(
        { x, y }, ctx.cellHasTerrainFlag, ctx.cellHasTMFlag, ctx.discoveredTerrainFlagsAtLoc);
    const newPassable = isPassableOrSecretDoor(
        { x: newX, y: newY }, ctx.cellHasTerrainFlag, ctx.cellHasTMFlag, ctx.discoveredTerrainFlagsAtLoc);

    if (
        (defender && (defender.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)) ||
        (newPassable &&
            !ctx.diagonalBlocked(x, y, newX, newY, false) &&
            curPassable)
    ) {
        if (
            !defender ||
            canPass(monst, defender, ctx.player, ctx.cellHasTerrainFlag) ||
            monsterWillAttackTarget(monst, defender, ctx.player, ctx.cellHasTerrainFlag)
        ) {
            if (defender) {
                if (canPass(monst, defender, ctx.player, ctx.cellHasTerrainFlag)) {
                    // Swap places
                    ctx.clearCellFlag(defender.loc, ctx.HAS_MONSTER);
                    ctx.refreshDungeonCell(defender.loc);
                    ctx.clearCellFlag(monst.loc, ctx.HAS_MONSTER);
                    ctx.refreshDungeonCell(monst.loc);

                    monst.loc = { x: newX, y: newY };
                    ctx.setCellFlag(monst.loc, ctx.HAS_MONSTER);

                    if (ctx.monsterAvoids(defender, { x, y })) {
                        defender.loc = ctx.getQualifyingPathLocNear(
                            { x, y }, true,
                            ctx.forbiddenFlagsForMonster(defender.info), ctx.HAS_PLAYER,
                            ctx.forbiddenFlagsForMonster(defender.info),
                            ctx.HAS_PLAYER | ctx.HAS_MONSTER | ctx.HAS_STAIRS, false,
                        );
                    } else {
                        defender.loc = { x, y };
                    }
                    ctx.setCellFlag(defender.loc, ctx.HAS_MONSTER);
                    ctx.refreshDungeonCell(monst.loc);
                    ctx.refreshDungeonCell(defender.loc);
                    monst.ticksUntilTurn = monst.movementSpeed;
                    return true;
                }

                // Swarming check
                const swarmDir = ctx.monsterSwarmDirection(monst, defender);
                if (swarmDir !== ctx.NO_DIRECTION) {
                    const swarmDx = ctx.nbDirs[swarmDir][0];
                    const swarmDy = ctx.nbDirs[swarmDir][1];
                    setMonsterLocation(monst, { x: monst.loc.x + swarmDx, y: monst.loc.y + swarmDy }, ctx);
                    monst.ticksUntilTurn = monst.movementSpeed;
                    return true;
                } else {
                    // Attack!
                    monst.ticksUntilTurn = monst.attackSpeed;
                    if (
                        !((monst.info.abilityFlags & MonsterAbilityFlag.MA_SEIZES) &&
                            !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING))
                    ) {
                        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                    }
                    ctx.refreshDungeonCell({ x, y });

                    const hitList: (Creature | null)[] = new Array(16).fill(null);
                    ctx.buildHitList(
                        hitList, monst, defender,
                        !!(monst.info.abilityFlags & MonsterAbilityFlag.MA_ATTACKS_ALL_ADJACENT),
                    );

                    for (let i = 0; i < 16; i++) {
                        const target = hitList[i];
                        if (
                            target &&
                            monsterWillAttackTarget(monst, target, ctx.player, ctx.cellHasTerrainFlag) &&
                            !(target.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
                            !ctx.gameHasEnded
                        ) {
                            ctx.attack(monst, target, false);
                        }
                    }
                }
                return true;
            } else {
                // Just moving
                setMonsterLocation(monst, { x: newX, y: newY }, ctx);
                monst.ticksUntilTurn = monst.movementSpeed;
                return true;
            }
        }
    }

    return false;
}
