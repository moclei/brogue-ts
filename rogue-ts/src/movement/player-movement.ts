/*
 *  player-movement.ts — Player movement and related helpers
 *  brogue-ts
 *
 *  Ported from: src/brogue/Movement.c
 *  Functions: randValidDirectionFrom, vomit, moveEntrancedMonsters,
 *             playerMoves, playerRuns
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Pcell, Pos, Item, DungeonFeature } from "../types/types.js";
import { Direction, CreatureState, StatusEffect, TileType, DungeonFeatureType, ArmorEnchant } from "../types/enums.js";
import {
    TerrainFlag, TerrainMechFlag, TileFlag,
    MonsterBehaviorFlag, MonsterBookkeepingFlag, ItemFlag,
    ANY_KIND_OF_VISIBLE,
} from "../types/flags.js";
import { tileCatalog } from "../globals/tile-catalog.js";

// =============================================================================
// Contexts
// =============================================================================

/**
 * Context for randValidDirectionFrom.
 */
export interface RandValidDirContext {
    pmap: Pcell[][];
    nbDirs: readonly [number, number][];
    coordinatesAreInMap(x: number, y: number): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;
    monsterAvoids(monst: Creature, pos: Pos): boolean;
    randRange(lower: number, upper: number): number;
}

/**
 * Context for vomit.
 */
export interface VomitContext {
    player: Creature;
    dungeonFeatureCatalog: readonly DungeonFeature[];
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;
    canDirectlySeeMonster(monst: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    combatMessage(msg: string, color: unknown): void;
    automationActive: boolean;
}

/**
 * Context for moveEntrancedMonsters.
 */
export interface MoveEntrancedContext {
    /** All active (non-dormant) monsters on the level. */
    monsters: Creature[];
    nbDirs: readonly [number, number][];
    moveMonster(monst: Creature, dx: number, dy: number): void;
}

/**
 * Context for playerRuns.
 */
export interface PlayerRunContext extends PlayerMoveContext {
    /** Check if a monster would avoid a position. */
    monsterAvoids(monst: Creature, pos: Pos): boolean;
    /** Get the position in a direction from a given position. */
    isPosInMap(pos: Pos): boolean;
    /** Check if position equals. */
    posEq(a: Pos, b: Pos): boolean;
    /** Update the flavor text display. */
    updateFlavorText(): void;
}

/**
 * Context for the main playerMoves function — the big one.
 * This pulls together most game systems.
 */
export interface PlayerMoveContext {
    // ── Map state ──
    pmap: Pcell[][];
    player: Creature;
    rogue: {
        disturbed: boolean;
        automationActive: boolean;
        weapon: Item | null;
        armor: Item | null;
        downLoc: Pos;
        upLoc: Pos;
        gameHasEnded: boolean;
    };
    nbDirs: readonly [number, number][];

    // ── Map queries ──
    coordinatesAreInMap(x: number, y: number): boolean;
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    cellHasTerrainType(pos: Pos, tileType: TileType): boolean;
    playerCanSee(x: number, y: number): boolean;
    diagonalBlocked(x1: number, y1: number, x2: number, y2: number, isPlayer: boolean): boolean;

    // ── Monster queries ──
    monsterAtLoc(loc: Pos): Creature | null;
    canSeeMonster(monst: Creature): boolean;
    monsterRevealed(monst: Creature): boolean;
    monstersAreEnemies(a: Creature, b: Creature): boolean;
    monsterWillAttackTarget(attacker: Creature, target: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    monsterAvoids(monst: Creature, pos: Pos): boolean;
    monsterShouldFall(monst: Creature): boolean;
    forbiddenFlagsForMonster(info: Creature["info"]): number;
    distanceBetween(a: Pos, b: Pos): number;
    /** All active (non-dormant) monsters on the level. */
    allMonsters(): Creature[];

    // ── Layer queries ──
    layerWithTMFlag(x: number, y: number, flag: number): number;
    layerWithFlag(x: number, y: number, flag: number): number;

    // ── Combat ──
    handleWhipAttacks(monst: Creature, direction: number, specialAttackAborted: { value: boolean }): boolean;
    handleSpearAttacks(monst: Creature, direction: number, specialAttackAborted: { value: boolean }): boolean;
    buildFlailHitList(x1: number, y1: number, x2: number, y2: number, hitList: (Creature | null)[]): void;
    buildHitList(hitList: (Creature | null)[], attacker: Creature, defender: Creature, allAdjacent: boolean): void;
    abortAttack(hitList: (Creature | null)[]): boolean;
    attack(attacker: Creature, defender: Creature, lungeAttack: boolean): boolean;
    playerRecoversFromAttacking(anyHit: boolean): void;

    // ── Movement ──
    randValidDirectionFrom(monst: Creature, x: number, y: number, respectAvoidance: boolean): number;
    moveMonster(monst: Creature, dx: number, dy: number): void;
    getQualifyingPathLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        blockingFlags: number,
        blockingMapFlags: number,
        forbiddenFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
    ): Pos;

    // ── Items ──
    keyInPackFor(loc: Pos): Item | null;
    useKeyAt(item: Item, x: number, y: number): void;
    pickUpItemAt(loc: Pos): void;
    checkForMissingKeys(x: number, y: number): void;

    // ── Ally/captive ──
    freeCaptive(monst: Creature): void;

    // ── Map manipulation ──
    promoteTile(x: number, y: number, layer: number, useStairs: boolean): void;
    refreshDungeonCell(loc: Pos): void;
    discoverCell(x: number, y: number): void;
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;
    dungeonFeatureCatalog: readonly DungeonFeature[];

    // ── Stairs ──
    useStairs(direction: number): void;

    // ── Game flow ──
    playerTurnEnded(): void;
    recordKeystroke(key: number, shift: boolean, ctrl: boolean): void;
    cancelKeystroke(): void;
    confirm(prompt: string, defaultYes: boolean): boolean;

    // ── Messages ──
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: unknown, flags: number): void;
    combatMessage(msg: string, color: unknown): void;
    backgroundMessageColor: unknown;

    // ── RNG ──
    randPercent(percent: number): boolean;
    randRange(lower: number, upper: number): number;

    // ── Vomit ──
    vomit(monst: Creature): void;

    // ── isDisturbed ──
    isDisturbed(x: number, y: number): boolean;
}

// =============================================================================
// Direction keys (for recordKeystroke)
// =============================================================================

/** Keyboard key constants matching the C directionKeys array ordering. */
const DIRECTION_KEYS = [
    0x1001, // UP_KEY
    0x1002, // DOWN_KEY
    0x1003, // LEFT_KEY
    0x1004, // RIGHT_KEY
    0x1005, // UPLEFT_KEY
    0x1006, // DOWNLEFT_KEY
    0x1007, // UPRIGHT_KEY
    0x1008, // DOWNRIGHT_KEY
];

// =============================================================================
// randValidDirectionFrom — from Movement.c:462
// =============================================================================

/**
 * Returns a random valid direction from (x, y) for the given creature,
 * or Direction.NoDirection if no valid direction exists.
 *
 * C: short randValidDirectionFrom(creature *monst, short x, short y, boolean respectAvoidancePreferences)
 */
export function randValidDirectionFrom(
    monst: Creature,
    x: number,
    y: number,
    respectAvoidancePreferences: boolean,
    ctx: RandValidDirContext,
): number {
    const validDirections: number[] = [];

    for (let i = 0; i < 8; i++) {
        const newX = x + ctx.nbDirs[i][0];
        const newY = y + ctx.nbDirs[i][1];
        if (
            ctx.coordinatesAreInMap(newX, newY) &&
            !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
            !ctx.diagonalBlocked(x, y, newX, newY, false) &&
            (
                !respectAvoidancePreferences ||
                !ctx.monsterAvoids(monst, { x: newX, y: newY }) ||
                (
                    (ctx.pmap[newX][newY].flags & TileFlag.HAS_PLAYER) &&
                    monst.creatureState !== CreatureState.Ally
                )
            )
        ) {
            validDirections.push(i);
        }
    }

    if (validDirections.length === 0) {
        return Direction.NoDirection;
    }
    return validDirections[ctx.randRange(0, validDirections.length - 1)];
}

// =============================================================================
// vomit — from Movement.c:485
// =============================================================================

/**
 * Makes a creature vomit, spawning a vomit dungeon feature at their location
 * and displaying a message if the player can see it.
 *
 * C: void vomit(creature *monst)
 */
export function vomit(
    monst: Creature,
    ctx: VomitContext,
): void {
    ctx.spawnDungeonFeature(
        monst.loc.x,
        monst.loc.y,
        ctx.dungeonFeatureCatalog[DungeonFeatureType.DF_VOMIT],
        true,
        false,
    );

    if (ctx.canDirectlySeeMonster(monst) && !ctx.automationActive) {
        const monstName = ctx.monsterName(monst, true);
        const verb = monst === ctx.player ? "" : "s";
        ctx.combatMessage(`${monstName} vomit${verb} profusely`, null);
    }
}

// =============================================================================
// moveEntrancedMonsters — from Movement.c:498
// =============================================================================

/**
 * Moves all entranced monsters in the opposite of the given direction.
 *
 * C: static void moveEntrancedMonsters(enum directions dir)
 */
export function moveEntrancedMonsters(
    dir: number,
    ctx: MoveEntrancedContext,
): void {
    // Opposite direction: 0↔1, 2↔3, 4↔5, 6↔7 (Up↔Down, Left↔Right, etc.)
    const oppDir = oppositeDir(dir);

    for (const monst of ctx.monsters) {
        if (
            monst.status[StatusEffect.Entranced] &&
            !monst.status[StatusEffect.Stuck] &&
            !monst.status[StatusEffect.Paralyzed] &&
            !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
        ) {
            ctx.moveMonster(monst, ctx.nbDirs[oppDir][0], ctx.nbDirs[oppDir][1]);
        }
    }
}

/**
 * Returns the opposite direction index.
 * C: oppositeDirection()
 */
function oppositeDir(dir: number): number {
    switch (dir) {
        case Direction.Up: return Direction.Down;
        case Direction.Down: return Direction.Up;
        case Direction.Left: return Direction.Right;
        case Direction.Right: return Direction.Left;
        case Direction.UpLeft: return Direction.DownRight;
        case Direction.DownLeft: return Direction.UpRight;
        case Direction.UpRight: return Direction.DownLeft;
        case Direction.DownRight: return Direction.UpLeft;
        default: return dir;
    }
}

// =============================================================================
// playerMoves — from Movement.c:843
// =============================================================================

/**
 * Attempts to move the player in the given direction. Handles:
 * - Confused movement (random valid direction)
 * - Attacking enemies (melee, whip, spear, flail, lunge)
 * - Freeing captives
 * - Terrain promotions (opening doors, etc.)
 * - Safety confirmations (lava, traps, fire, gas)
 * - Seized-by-monster logic
 * - Stuck/entangled status
 * - Nausea vomiting
 * - Stair usage
 * - Ally swap-places
 * - Item pickup
 *
 * Returns true if the player actually moved (or attacked), false otherwise.
 *
 * C: boolean playerMoves(short direction)
 */
export function playerMoves(
    direction: number,
    ctx: PlayerMoveContext,
): boolean {
    const initialDirection = direction;
    const { pmap, player } = ctx;
    const x = player.loc.x;
    const y = player.loc.y;
    let newX = x + ctx.nbDirs[direction][0];
    let newY = y + ctx.nbDirs[direction][1];
    let playerMoved = false;
    let anyAttackHit = false;
    const hitList: (Creature | null)[] = new Array(16).fill(null);
    let committed = false;

    if (!ctx.coordinatesAreInMap(newX, newY)) {
        return false;
    }

    // Save the keystroke up-front; we'll revert if the player cancels.
    ctx.recordKeystroke(DIRECTION_KEYS[initialDirection], false, false);

    // ── Confused movement ──
    if (player.status[StatusEffect.Confused]) {
        // Confirmation near lava when confused, not levitating, not fire-immune.
        if (
            player.status[StatusEffect.Levitating] <= 1 &&
            player.status[StatusEffect.ImmuneToFire] <= 1
        ) {
            let nearLava = false;
            for (let i = 0; i < 8; i++) {
                const cx = x + ctx.nbDirs[i][0];
                const cy = y + ctx.nbDirs[i][1];
                if (
                    ctx.coordinatesAreInMap(cx, cy) &&
                    (pmap[cx][cy].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) &&
                    !ctx.diagonalBlocked(x, y, cx, cy, false) &&
                    ctx.cellHasTerrainFlag({ x: cx, y: cy }, TerrainFlag.T_LAVA_INSTA_DEATH) &&
                    !ctx.cellHasTerrainFlag({ x: cx, y: cy }, TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_ENTANGLES) &&
                    !(
                        (pmap[cx][cy].flags & TileFlag.HAS_MONSTER) &&
                        ctx.canSeeMonster(ctx.monsterAtLoc({ x: cx, y: cy })!) &&
                        ctx.monsterAtLoc({ x: cx, y: cy })!.creatureState !== CreatureState.Ally
                    )
                ) {
                    nearLava = true;
                    break;
                }
            }

            if (nearLava && !ctx.confirm("Risk stumbling into lava?", false)) {
                ctx.cancelKeystroke();
                return false;
            }
        }

        direction = ctx.randValidDirectionFrom(player, x, y, false);
        if (direction === Direction.NoDirection) {
            ctx.cancelKeystroke();
            return false;
        }
        newX = x + ctx.nbDirs[direction][0];
        newY = y + ctx.nbDirs[direction][1];
        if (!ctx.coordinatesAreInMap(newX, newY)) {
            ctx.cancelKeystroke();
            return false;
        }
        committed = true;
    }

    // ── Check for defender ──
    let defender: Creature | null = null;
    if (pmap[newX][newY].flags & TileFlag.HAS_MONSTER) {
        defender = ctx.monsterAtLoc({ x: newX, y: newY });
    }

    // ── Terrain promotions (opening doors, etc.) ──
    if (
        !defender ||
        (!ctx.canSeeMonster(defender) && !ctx.monsterRevealed(defender)) ||
        !ctx.monstersAreEnemies(player, defender)
    ) {
        if (
            ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
            ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY)
        ) {
            const layer = ctx.layerWithTMFlag(newX, newY, TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY);
            if (tileCatalog[pmap[newX][newY].layers[layer]].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) {
                committed = true;
                ctx.message(tileCatalog[pmap[newX][newY].layers[layer]].flavorText, 0);
                ctx.promoteTile(newX, newY, layer, false);
                ctx.playerTurnEnded();
                return true;
            }
        }
    }

    // ── Check if move is not blocked ──
    const moveNotBlocked =
        (
            (
                !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                (
                    ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_PROMOTES_WITH_KEY) &&
                    ctx.keyInPackFor({ x: newX, y: newY })
                )
            ) &&
            !ctx.diagonalBlocked(x, y, newX, newY, false) &&
            (
                !ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                (
                    ctx.cellHasTMFlag({ x, y }, TerrainMechFlag.TM_PROMOTES_WITH_KEY) &&
                    ctx.keyInPackFor({ x, y })
                )
            )
        ) ||
        (defender && (defender.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS));

    if (moveNotBlocked) {
        // ── Whip / Spear attacks ──
        const specialAttackAborted = { value: false };
        if (
            ctx.handleWhipAttacks(player, direction, specialAttackAborted) ||
            ctx.handleSpearAttacks(player, direction, specialAttackAborted)
        ) {
            committed = true;
            ctx.playerRecoversFromAttacking(true);
            moveEntrancedMonsters(direction, {
                monsters: ctx.allMonsters(),
                nbDirs: ctx.nbDirs,
                moveMonster: ctx.moveMonster,
            });
            ctx.playerTurnEnded();
            return true;
        }
        if (specialAttackAborted.value) {
            ctx.cancelKeystroke();
            ctx.rogue.disturbed = true;
            return false;
        }

        if (defender) {
            // ── Free captive? ──
            if (defender.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
                const monstName = ctx.monsterName(defender, false);
                if (committed || ctx.confirm(`Free the captive ${monstName}?`, false)) {
                    committed = true;
                    if (
                        ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_PROMOTES_WITH_KEY) &&
                        ctx.keyInPackFor({ x: newX, y: newY })
                    ) {
                        ctx.useKeyAt(ctx.keyInPackFor({ x: newX, y: newY })!, newX, newY);
                    }
                    ctx.freeCaptive(defender);
                    player.ticksUntilTurn += player.attackSpeed;
                    ctx.playerTurnEnded();
                    return true;
                } else {
                    ctx.cancelKeystroke();
                    return false;
                }
            }

            // ── Attack enemy or discordant ally ──
            if (
                defender.creatureState !== CreatureState.Ally ||
                defender.status[StatusEffect.Discordant]
            ) {
                ctx.buildHitList(
                    hitList,
                    player,
                    defender,
                    !!(ctx.rogue.weapon && (ctx.rogue.weapon.flags & ItemFlag.ITEM_ATTACKS_ALL_ADJACENT)),
                );

                if (ctx.abortAttack(hitList)) {
                    ctx.cancelKeystroke();
                    ctx.rogue.disturbed = true;
                    return false;
                }

                if (player.status[StatusEffect.Nauseous]) {
                    committed = true;
                    if (ctx.randPercent(25)) {
                        ctx.vomit(player);
                        ctx.playerTurnEnded();
                        return false;
                    }
                }

                committed = true;

                // Attack!
                for (let i = 0; i < 16; i++) {
                    if (
                        hitList[i] &&
                        ctx.monsterWillAttackTarget(player, hitList[i]!) &&
                        !(hitList[i]!.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
                        !ctx.rogue.gameHasEnded
                    ) {
                        if (ctx.attack(player, hitList[i]!, false)) {
                            anyAttackHit = true;
                        }
                    }
                }

                ctx.playerRecoversFromAttacking(anyAttackHit);
                moveEntrancedMonsters(direction, {
                    monsters: ctx.allMonsters(),
                    nbDirs: ctx.nbDirs,
                    moveMonster: ctx.moveMonster,
                });
                ctx.playerTurnEnded();
                return true;
            }
        }

        // ── Seized by monster ──
        if (player.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED) {
            for (const tempMonst of ctx.allMonsters()) {
                if (
                    (tempMonst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) &&
                    ctx.monstersAreEnemies(player, tempMonst) &&
                    ctx.distanceBetween(player.loc, tempMonst.loc) === 1 &&
                    !ctx.diagonalBlocked(player.loc.x, player.loc.y, tempMonst.loc.x, tempMonst.loc.y, false) &&
                    !tempMonst.status[StatusEffect.Entranced]
                ) {
                    const monstName = ctx.monsterName(tempMonst, true);
                    if (committed || !ctx.canSeeMonster(tempMonst)) {
                        committed = true;
                        moveEntrancedMonsters(direction, {
                            monsters: ctx.allMonsters(),
                            nbDirs: ctx.nbDirs,
                            moveMonster: ctx.moveMonster,
                        });
                        ctx.message(`you struggle but ${monstName} is holding your legs!`, 0);
                        ctx.playerTurnEnded();
                        return true;
                    } else {
                        ctx.message(`you cannot move; ${monstName} is holding your legs!`, 0);
                        ctx.cancelKeystroke();
                        return false;
                    }
                }
            }
            player.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SEIZED; // failsafe
        }

        // ── Safety confirmations ──
        // Lava
        if (
            (pmap[newX][newY].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) &&
            player.status[StatusEffect.Levitating] <= 1 &&
            !player.status[StatusEffect.Confused] &&
            ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_LAVA_INSTA_DEATH) &&
            player.status[StatusEffect.ImmuneToFire] <= 1 &&
            !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_ENTANGLES) &&
            !ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_IS_SECRET)
        ) {
            ctx.message("that would be certain death!", 0);
            ctx.cancelKeystroke();
            return false;
        }

        // Chasm
        if (
            (pmap[newX][newY].flags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED)) &&
            player.status[StatusEffect.Levitating] <= 1 &&
            !player.status[StatusEffect.Confused] &&
            ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_AUTO_DESCENT) &&
            (
                !ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_ENTANGLES) ||
                ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY)
            ) &&
            !ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_IS_SECRET) &&
            !ctx.confirm("Dive into the depths?", false)
        ) {
            ctx.cancelKeystroke();
            return false;
        }

        // Fire
        if (
            ctx.playerCanSee(newX, newY) &&
            !player.status[StatusEffect.Confused] &&
            !player.status[StatusEffect.Burning] &&
            player.status[StatusEffect.ImmuneToFire] <= 1 &&
            ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_IS_FIRE) &&
            !ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_EXTINGUISHES_FIRE) &&
            !ctx.confirm("Venture into flame?", false)
        ) {
            ctx.cancelKeystroke();
            return false;
        }

        // Dangerous gas
        if (
            ctx.playerCanSee(newX, newY) &&
            !player.status[StatusEffect.Confused] &&
            !player.status[StatusEffect.Burning] &&
            ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_CAUSES_CONFUSION | TerrainFlag.T_CAUSES_PARALYSIS) &&
            (
                !ctx.rogue.armor ||
                !(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) ||
                !(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) ||
                ctx.rogue.armor.enchant2 !== ArmorEnchant.Respiration
            ) &&
            !ctx.confirm("Venture into dangerous gas?", false)
        ) {
            ctx.cancelKeystroke();
            return false;
        }

        // Pressure plate trap
        if (
            (pmap[newX][newY].flags & (ANY_KIND_OF_VISIBLE | TileFlag.MAGIC_MAPPED)) &&
            player.status[StatusEffect.Levitating] <= 1 &&
            !player.status[StatusEffect.Confused] &&
            ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_IS_DF_TRAP) &&
            !(pmap[newX][newY].flags & TileFlag.PRESSURE_PLATE_DEPRESSED) &&
            !ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_IS_SECRET) &&
            (
                !ctx.rogue.armor ||
                !(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) ||
                !(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) ||
                ctx.rogue.armor.enchant2 !== ArmorEnchant.Respiration ||
                (
                    !ctx.cellHasTerrainType({ x: newX, y: newY }, TileType.GAS_TRAP_POISON) &&
                    !ctx.cellHasTerrainType({ x: newX, y: newY }, TileType.GAS_TRAP_PARALYSIS) &&
                    !ctx.cellHasTerrainType({ x: newX, y: newY }, TileType.GAS_TRAP_CONFUSION)
                )
            ) &&
            !ctx.confirm("Step onto the pressure plate?", false)
        ) {
            ctx.cancelKeystroke();
            return false;
        }

        // ── Lunge weapon check ──
        if (ctx.rogue.weapon && (ctx.rogue.weapon.flags & ItemFlag.ITEM_LUNGE_ATTACKS)) {
            const lungeX = player.loc.x + 2 * ctx.nbDirs[direction][0];
            const lungeY = player.loc.y + 2 * ctx.nbDirs[direction][1];
            if (
                ctx.coordinatesAreInMap(lungeX, lungeY) &&
                (pmap[lungeX][lungeY].flags & TileFlag.HAS_MONSTER)
            ) {
                const tempMonst = ctx.monsterAtLoc({ x: lungeX, y: lungeY });
                if (
                    tempMonst &&
                    (ctx.canSeeMonster(tempMonst) || ctx.monsterRevealed(tempMonst)) &&
                    ctx.monstersAreEnemies(player, tempMonst) &&
                    tempMonst.creatureState !== CreatureState.Ally &&
                    !(tempMonst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) &&
                    (
                        !ctx.cellHasTerrainFlag(tempMonst.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) ||
                        (tempMonst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
                    )
                ) {
                    hitList[0] = tempMonst;
                    if (ctx.abortAttack(hitList)) {
                        ctx.cancelKeystroke();
                        ctx.rogue.disturbed = true;
                        return false;
                    }
                }
            }
        }

        // ── Flail weapon check ──
        if (ctx.rogue.weapon && (ctx.rogue.weapon.flags & ItemFlag.ITEM_PASS_ATTACKS)) {
            ctx.buildFlailHitList(x, y, newX, newY, hitList);
            if (ctx.abortAttack(hitList)) {
                ctx.cancelKeystroke();
                ctx.rogue.disturbed = true;
                return false;
            }
        }

        // ── Stuck / entangled ──
        if (player.status[StatusEffect.Stuck] && ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_ENTANGLES)) {
            player.status[StatusEffect.Stuck]--;
            if (player.status[StatusEffect.Stuck]) {
                if (!ctx.rogue.automationActive) {
                    ctx.message("you struggle but cannot free yourself.", 0);
                }
                moveEntrancedMonsters(direction, {
                    monsters: ctx.allMonsters(),
                    nbDirs: ctx.nbDirs,
                    moveMonster: ctx.moveMonster,
                });
                committed = true;
                ctx.playerTurnEnded();
                return true;
            } else {
                if (!ctx.rogue.automationActive) {
                    ctx.message("you break free!", 0);
                }
                if (tileCatalog[pmap[x][y].layers[3 /* Surface */]].flags & TerrainFlag.T_ENTANGLES) {
                    pmap[x][y].layers[3 /* Surface */] = TileType.NOTHING;
                }
            }
        }

        // ── Nausea (non-combat movement) ──
        if (player.status[StatusEffect.Nauseous]) {
            committed = true;
            if (ctx.randPercent(25)) {
                ctx.vomit(player);
                ctx.playerTurnEnded();
                return true;
            }
        }

        // ── Stairs ──
        if (ctx.rogue.downLoc.x === newX && ctx.rogue.downLoc.y === newY) {
            committed = true;
            ctx.useStairs(1);
        } else if (ctx.rogue.upLoc.x === newX && ctx.rogue.upLoc.y === newY) {
            committed = true;
            ctx.useStairs(-1);
        } else {
            // ── Finally: actually move! ──
            committed = true;

            player.loc.x += ctx.nbDirs[direction][0];
            player.loc.y += ctx.nbDirs[direction][1];
            pmap[x][y].flags &= ~TileFlag.HAS_PLAYER;
            pmap[player.loc.x][player.loc.y].flags |= TileFlag.HAS_PLAYER;
            pmap[player.loc.x][player.loc.y].flags &= ~TileFlag.IS_IN_PATH;

            // Swap places with ally
            if (defender && defender.creatureState === CreatureState.Ally) {
                pmap[defender.loc.x][defender.loc.y].flags &= ~TileFlag.HAS_MONSTER;
                defender.loc.x = x;
                defender.loc.y = y;
                if (ctx.monsterAvoids(defender, { x, y })) {
                    const newPos = ctx.getQualifyingPathLocNear(
                        player.loc,
                        true,
                        ctx.forbiddenFlagsForMonster(defender.info),
                        0,
                        0,
                        TileFlag.HAS_PLAYER | TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS,
                        false,
                    );
                    defender.loc = newPos;
                }
                pmap[defender.loc.x][defender.loc.y].flags |= TileFlag.HAS_MONSTER;
            }

            // Pick up item
            if (pmap[player.loc.x][player.loc.y].flags & TileFlag.HAS_ITEM) {
                ctx.pickUpItemAt(player.loc);
                ctx.rogue.disturbed = true;
            }

            ctx.refreshDungeonCell({ x, y });
            ctx.refreshDungeonCell(player.loc);
            playerMoved = true;

            ctx.checkForMissingKeys(x, y);
            if (ctx.monsterShouldFall(player)) {
                player.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_FALLING;
            }
            moveEntrancedMonsters(direction, {
                monsters: ctx.allMonsters(),
                nbDirs: ctx.nbDirs,
                moveMonster: ctx.moveMonster,
            });

            // Lunge or flail attacks after moving
            for (let i = 0; i < 16; i++) {
                if (hitList[i]) {
                    if (ctx.attack(player, hitList[i]!, !!(ctx.rogue.weapon && (ctx.rogue.weapon.flags & ItemFlag.ITEM_LUNGE_ATTACKS)))) {
                        anyAttackHit = true;
                    }
                }
            }
            if (hitList[0]) {
                ctx.playerRecoversFromAttacking(anyAttackHit);
            }

            ctx.playerTurnEnded();
        }
    } else if (ctx.cellHasTerrainFlag({ x: newX, y: newY }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        // ── Bumped into a wall or closed door ──
        const blockingLayer = ctx.layerWithFlag(newX, newY, TerrainFlag.T_OBSTRUCTS_PASSABILITY);
        const blockingTile = pmap[newX][newY].layers[blockingLayer];
        if (
            (tileCatalog[blockingTile].flags & TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
            (!ctx.diagonalBlocked(x, y, newX, newY, false) || !ctx.cellHasTMFlag({ x: newX, y: newY }, TerrainMechFlag.TM_PROMOTES_WITH_KEY))
        ) {
            if (!(pmap[newX][newY].flags & TileFlag.DISCOVERED)) {
                committed = true;
                ctx.discoverCell(newX, newY);
                ctx.refreshDungeonCell({ x: newX, y: newY });
            }
            ctx.messageWithColor(tileCatalog[blockingTile].flavorText, ctx.backgroundMessageColor, 0);
        }
    }

    return playerMoved;
}

// =============================================================================
// playerRuns — from Movement.c:28
// =============================================================================

/**
 * Makes the player run in a direction, continuing until disturbed
 * or the path changes.
 *
 * C: void playerRuns(short direction)
 */
export function playerRuns(
    direction: number,
    ctx: PlayerRunContext,
): void {
    ctx.rogue.disturbed = !!ctx.player.status[StatusEffect.Confused];

    // Record initial cardinal passability around the player.
    const cardinalPassability: boolean[] = [];
    for (let dir = 0; dir < 4; dir++) {
        const neighborPos: Pos = {
            x: ctx.player.loc.x + ctx.nbDirs[dir][0],
            y: ctx.player.loc.y + ctx.nbDirs[dir][1],
        };
        cardinalPassability[dir] = ctx.monsterAvoids(ctx.player, neighborPos);
    }

    while (!ctx.rogue.disturbed) {
        if (!playerMoves(direction, ctx)) {
            ctx.rogue.disturbed = true;
            break;
        }

        const nextPos: Pos = {
            x: ctx.player.loc.x + ctx.nbDirs[direction][0],
            y: ctx.player.loc.y + ctx.nbDirs[direction][1],
        };

        if (!ctx.isPosInMap(nextPos) || ctx.monsterAvoids(ctx.player, nextPos)) {
            ctx.rogue.disturbed = true;
        }

        if (ctx.isDisturbed(ctx.player.loc.x, ctx.player.loc.y)) {
            ctx.rogue.disturbed = true;
        } else if (direction < 4) {
            // For cardinal directions, check if the path shape has changed.
            for (let dir = 0; dir < 4; dir++) {
                const neighborPos: Pos = {
                    x: ctx.player.loc.x + ctx.nbDirs[dir][0],
                    y: ctx.player.loc.y + ctx.nbDirs[dir][1],
                };
                const aheadOfNeighbor: Pos = {
                    x: neighborPos.x + ctx.nbDirs[direction][0],
                    y: neighborPos.y + ctx.nbDirs[direction][1],
                };
                if (
                    cardinalPassability[dir] !== ctx.monsterAvoids(ctx.player, neighborPos) &&
                    !ctx.posEq(ctx.player.loc, aheadOfNeighbor)
                ) {
                    ctx.rogue.disturbed = true;
                }
            }
        }
    }
    ctx.updateFlavorText();
}
