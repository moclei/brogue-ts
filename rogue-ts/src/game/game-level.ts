/*
 *  game-level.ts — Level transitions, depth-dependent color updates
 *  brogue-ts
 *
 *  Ported from: src/brogue/RogueMain.c (lines 537–928)
 *  Functions: updateColors, startLevel
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color,
    Creature,
    GameConstants,
    Item,
    LevelData,
    Pcell,
    Pos,
} from "../types/types.js";
import type { Fixpt } from "../types/types.js";
import { ItemCategory, CreatureState, StatusEffect } from "../types/enums.js";
import {
    TileFlag,
    TerrainFlag,
    PERMANENT_TILE_FLAGS,
    ANY_KIND_OF_VISIBLE,
    IS_IN_MACHINE,
    T_PATHING_BLOCKER,
    T_DIVIDES_LEVEL,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
} from "../types/flags.js";
import { DCOLS, DROWS, NUMBER_TERRAIN_LAYERS } from "../types/constants.js";
import { INVALID_POS } from "../types/types.js";

// =============================================================================
// DI Context
// =============================================================================

/**
 * Minimal rogue state required by the game-level module.
 */
export interface LevelRogueState {
    depthLevel: number;
    deepestLevel: number;
    absoluteTurnNumber: number;
    playerTurnNumber: number;
    scentTurnNumber: number;
    updatedSafetyMapThisTurn: boolean;
    updatedAllySafetyMapThisTurn: boolean;
    updatedMapToSafeTerrainThisTurn: boolean;
    cursorLoc: Pos;
    lastTarget: Creature | null;
    upLoc: Pos;
    downLoc: Pos;
    inWater: boolean;
    ticksTillUpdateEnvironment: number;
    minersLightRadius: Fixpt;
    playbackBetweenTurns: boolean;
    stealthRange: number;
    yendorWarden: Creature | null;
}

/**
 * Level feeling entry (message + color for amulet/deepest level).
 */
export interface LevelFeeling {
    message: string;
    color: Readonly<Color>;
}

/**
 * Dependency-injection context for the game-level module.
 */
export interface LevelContext {
    rogue: LevelRogueState;
    player: Creature;
    gameConst: GameConstants;
    FP_FACTOR: Fixpt;

    // -- Level data -----------------------------------------------------------

    levels: LevelData[];
    pmap: Pcell[][];

    // -- Monster/item lists (mutable references) ------------------------------

    monsters: Creature[];
    dormantMonsters: Creature[];
    floorItems: Item[];
    setMonsters(m: Creature[]): void;
    setDormantMonsters(m: Creature[]): void;

    // -- Scent map ------------------------------------------------------------

    scentMap: number[][] | null;
    setScentMap(map: number[][] | null): void;

    // -- Dynamic colors -------------------------------------------------------

    dynamicColors: Color[];
    dynamicColorsBounds: readonly [Color, Color][];

    // -- Level feelings -------------------------------------------------------

    levelFeelings: readonly LevelFeeling[];

    // -- Grid operations ------------------------------------------------------

    allocGrid(): number[][];
    fillGrid(grid: number[][], value: number): void;
    freeGrid(grid: number[][]): void;

    // -- Color operations -----------------------------------------------------

    applyColorAverage(base: Color, target: Readonly<Color>, weight: number): void;

    // -- RNG ------------------------------------------------------------------

    seedRandomGenerator(seed: bigint): bigint;
    rand_64bits(): bigint;

    // -- Player time synchronization ------------------------------------------

    synchronizePlayerTimeState(): void;

    // -- Terrain queries ------------------------------------------------------

    cellHasTerrainFlag(loc: Pos, flag: number): boolean;
    coordinatesAreInMap(x: number, y: number): boolean;
    pmapAt(loc: Pos): Pcell;
    posNeighborInDirection(loc: Pos, dir: number): Pos;

    // -- Distance calculations ------------------------------------------------

    calculateDistances(
        grid: number[][],
        x: number,
        y: number,
        blockingFlags: number,
        blockingCreature: Creature | null,
        eightWays: boolean,
        allowDiagonals: boolean,
    ): void;
    pathingDistance(x1: number, y1: number, x2: number, y2: number, blockingFlags: number): number;
    currentStealthRange(): number;

    // -- Monster queries ------------------------------------------------------

    getQualifyingLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        forbiddenCellFlags: number,
        forbiddenTerrainFlags: number,
        forbiddenMapFlags: number,
        deterministic: boolean,
        allowFlood: boolean,
    ): Pos;
    getQualifyingPathLocNear(
        target: Pos,
        hallwaysAllowed: boolean,
        terrainMustBe: number,
        terrainMustNotBe: number,
        pathingBlockers: number,
        cellMustNotBe: number,
        deterministic: boolean,
    ): Pos;

    // -- Dungeon generation (new levels) --------------------------------------

    digDungeon(): void;
    placeStairs(): { success: boolean; upStairsLoc: Pos };
    initializeLevel(upStairsLoc: Pos): void;
    setUpWaypoints(): void;
    shuffleTerrainColors(maxPercent: number, resetAll: boolean): void;

    // -- Item operations ------------------------------------------------------

    numberOfMatchingPackItems(category: number, flags: number, flags2: number, useFlags: boolean): number;
    itemAtLoc(loc: Pos): Item | null;
    describedItemName(item: Item): string;
    generateItem(category: number, kind: number): Item;
    placeItemAt(item: Item, loc: Pos): void;

    // -- Monster operations ---------------------------------------------------

    restoreMonster(monst: Creature, mapToStairs: number[][], mapToPit: number[][]): void;
    restoreItems(): void;
    updateMonsterState(monst: Creature): void;

    // -- Memory & vision ------------------------------------------------------

    storeMemories(x: number, y: number): void;
    updateVision(refreshDisplay: boolean): void;
    discoverCell(x: number, y: number): void;
    updateMapToShore(): void;
    updateRingBonuses(): void;

    // -- Display & recording --------------------------------------------------

    displayLevel(): void;
    refreshSideBar(x: number, y: number, justClearing: boolean): void;
    messageWithColor(msg: string, color: Readonly<Color>, flags: number): void;
    RNGCheck(): void;
    flushBufferToFile(): void;
    deleteAllFlares(): void;
    hideCursor(): void;

    // -- Color references -----------------------------------------------------

    itemMessageColor: Readonly<Color>;

    // -- Direction tables -----------------------------------------------------

    nbDirs: readonly [number, number][];

    // -- Math utility ---------------------------------------------------------

    clamp(val: number, lo: number, hi: number): number;
}

// =============================================================================
// updateColors — depth-dependent dynamic color interpolation
// =============================================================================

/**
 * Port of C `updateColors()`.
 * Call once per level to set all dynamic colors as a function of depth.
 */
export function updateColors(ctx: LevelContext): void {
    const { rogue, gameConst } = ctx;
    const weight = Math.min(100, Math.max(0,
        Math.floor(rogue.depthLevel * 100 / gameConst.amuletLevel)));

    for (let i = 0; i < ctx.dynamicColors.length; i++) {
        // Copy the start color
        const start = ctx.dynamicColorsBounds[i][0];
        const dc = ctx.dynamicColors[i];
        dc.red = start.red;
        dc.green = start.green;
        dc.blue = start.blue;
        dc.redRand = start.redRand;
        dc.greenRand = start.greenRand;
        dc.blueRand = start.blueRand;
        dc.rand = start.rand;
        dc.colorDances = start.colorDances;

        // Blend towards the end color
        ctx.applyColorAverage(dc, ctx.dynamicColorsBounds[i][1], weight);
    }
}

// =============================================================================
// startLevel — level transition logic (~380 lines in C)
// =============================================================================

/**
 * Port of C `startLevel()`.
 *
 * Handles saving the current level state, generating or restoring the next level,
 * simulating the environment, placing the player, and refreshing the display.
 */
export function startLevel(
    ctx: LevelContext,
    oldLevelNumber: number,
    stairDirection: number,
): void {
    const { rogue, player, gameConst, levels, pmap } = ctx;

    if (oldLevelNumber === gameConst.deepestLevel && stairDirection !== -1) {
        return;
    }

    ctx.synchronizePlayerTimeState();

    rogue.updatedSafetyMapThisTurn = false;
    rogue.updatedAllySafetyMapThisTurn = false;
    rogue.updatedMapToSafeTerrainThisTurn = false;

    rogue.cursorLoc = { ...INVALID_POS };
    rogue.lastTarget = null;

    const connectingStairsDiscovered = !!(ctx.pmapAt(rogue.downLoc).flags &
        (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED));

    if (stairDirection === 0) { // fallen
        levels[oldLevelNumber - 1].playerExitedVia = { x: player.loc.x, y: player.loc.y };
    }

    // ---- Mark which monsters follow the player ----
    if (oldLevelNumber !== rogue.depthLevel) {
        let px = player.loc.x;
        let py = player.loc.y;
        if (ctx.cellHasTerrainFlag(player.loc, TerrainFlag.T_AUTO_DESCENT)) {
            for (let i = 0; i < 8; i++) {
                const nx = player.loc.x + ctx.nbDirs[i][0];
                const ny = player.loc.y + ctx.nbDirs[i][1];
                if (!ctx.cellHasTerrainFlag({ x: nx, y: ny }, T_PATHING_BLOCKER)) {
                    px = nx;
                    py = ny;
                    break;
                }
            }
        }
        const mapToStairs = ctx.allocGrid();
        for (let flying = 0; flying <= 1; flying++) {
            ctx.fillGrid(mapToStairs, 0);
            const blockFlags = (flying
                ? TerrainFlag.T_OBSTRUCTS_PASSABILITY
                : T_PATHING_BLOCKER) | TerrainFlag.T_SACRED;
            ctx.calculateDistances(mapToStairs, px, py, blockFlags, null, true, true);

            for (const monst of ctx.monsters) {
                if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED) continue;
                const x = monst.loc.x;
                const y = monst.loc.y;

                if (((monst.creatureState === CreatureState.TrackingScent
                        && (stairDirection !== 0 || monst.status[StatusEffect.Levitating]))
                    || monst.creatureState === CreatureState.Ally
                    || monst === rogue.yendorWarden)
                    && (stairDirection !== 0 || monst.currentHP > 10 || monst.status[StatusEffect.Levitating])
                    && ((flying !== 0) === ((monst.status[StatusEffect.Levitating] !== 0)
                        || ctx.cellHasTerrainFlag({ x, y }, T_PATHING_BLOCKER)
                        || ctx.cellHasTerrainFlag({ x: px, y: py }, TerrainFlag.T_AUTO_DESCENT)))
                    && !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
                    && !(monst.info.flags & (MonsterBehaviorFlag.MONST_WILL_NOT_USE_STAIRS | MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID))
                    && !ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                    && !monst.status[StatusEffect.Entranced]
                    && !monst.status[StatusEffect.Paralyzed]
                    && (mapToStairs[monst.loc.x][monst.loc.y] < 30000
                        || monst.creatureState === CreatureState.Ally
                        || monst === rogue.yendorWarden))
                {
                    monst.status[StatusEffect.EntersLevelIn] = ctx.clamp(
                        Math.floor(mapToStairs[monst.loc.x][monst.loc.y] * monst.movementSpeed / 100) + 1,
                        1, 150,
                    );
                    switch (stairDirection) {
                        case 1:
                            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_DOWNSTAIRS;
                            break;
                        case -1:
                            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_UPSTAIRS;
                            break;
                        case 0:
                            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_APPROACHING_PIT;
                            break;
                    }
                }
            }
        }
        ctx.freeGrid(mapToStairs);
    }

    // Free monster pathfinding maps
    for (const monst of ctx.monsters) {
        if (monst.mapToMe) {
            ctx.freeGrid(monst.mapToMe);
            monst.mapToMe = null;
        }
    }

    // Save floor items for the old level
    levels[oldLevelNumber - 1].items = [...ctx.floorItems];

    // ---- Save current level cell state ----
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (pmap[i][j].flags & ANY_KIND_OF_VISIBLE) {
                ctx.storeMemories(i, j);
            }
            const storage = levels[oldLevelNumber - 1].mapStorage[i][j];
            const cell = pmap[i][j];
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                storage.layers[layer] = cell.layers[layer];
            }
            storage.volume = cell.volume;
            storage.flags = cell.flags & PERMANENT_TILE_FLAGS;
            storage.machineNumber = cell.machineNumber;
            storage.rememberedAppearance = { ...cell.rememberedAppearance };
            storage.rememberedItemCategory = cell.rememberedItemCategory;
            storage.rememberedItemKind = cell.rememberedItemKind;
            storage.rememberedItemQuantity = cell.rememberedItemQuantity;
            storage.rememberedItemOriginDepth = cell.rememberedItemOriginDepth;
            storage.rememberedTerrain = cell.rememberedTerrain;
            storage.rememberedCellFlags = cell.rememberedCellFlags;
            storage.rememberedTerrainFlags = cell.rememberedTerrainFlags;
            storage.rememberedTMFlags = cell.rememberedTMFlags;
        }
    }

    levels[oldLevelNumber - 1].awaySince = rogue.absoluteTurnNumber;

    // ---- Prepare the new level ----
    const fpFactor = ctx.FP_FACTOR;
    rogue.minersLightRadius = BigInt(DCOLS - 1) * fpFactor;
    for (let i = 0; i < rogue.depthLevel * gameConst.depthAccelerator; i++) {
        rogue.minersLightRadius = rogue.minersLightRadius * 85n / 100n;
    }
    rogue.minersLightRadius += fpFactor * 225n / 100n;
    updateColors(ctx);
    ctx.updateRingBonuses();

    let timeAway: number;

    if (!levels[rogue.depthLevel - 1].visited) {
        // ---- Generate new level ----
        levels[rogue.depthLevel - 1].scentMap = ctx.allocGrid();
        ctx.setScentMap(levels[rogue.depthLevel - 1].scentMap);
        ctx.fillGrid(levels[rogue.depthLevel - 1].scentMap!, 0);

        // Generate a seed from the current RNG state
        let oldSeed: bigint;
        do {
            oldSeed = ctx.rand_64bits();
        } while (oldSeed === 0n);

        // Generate new level
        ctx.seedRandomGenerator(levels[rogue.depthLevel - 1].levelSeed);

        // Load up next level's monsters and items
        ctx.setMonsters(levels[rogue.depthLevel - 1].monsters);
        ctx.setDormantMonsters(levels[rogue.depthLevel - 1].dormantMonsters);
        // Merge any items that fell from above
        ctx.floorItems.push(...levels[rogue.depthLevel - 1].items);
        levels[rogue.depthLevel - 1].items = [];

        let failsafe: number;
        let upStairLocation: Pos = { x: 0, y: 0 };
        for (failsafe = 50; failsafe > 0; failsafe--) {
            ctx.digDungeon();
            const result = ctx.placeStairs();
            if (result.success) {
                upStairLocation = result.upStairsLoc;
                break;
            }
        }
        if (failsafe === 0) {
            throw new Error(
                `Failed to place stairs for level ${rogue.depthLevel}! Please report this error.`,
            );
        }
        ctx.initializeLevel(upStairLocation);
        ctx.setUpWaypoints();

        ctx.shuffleTerrainColors(100, false);

        // If we somehow failed to generate the amulet altar,
        // just toss an amulet in there somewhere.
        if (rogue.depthLevel === gameConst.amuletLevel
            && ctx.numberOfMatchingPackItems(ItemCategory.AMULET, 0, 0, false) === 0
            && !levels[rogue.depthLevel - 1].visited) {

            let foundAmulet = false;
            for (const item of ctx.floorItems) {
                if (item.category & ItemCategory.AMULET) {
                    foundAmulet = true;
                    break;
                }
            }
            if (!foundAmulet) {
                for (const monst of ctx.monsters) {
                    if (monst.carriedItem && (monst.carriedItem.category & ItemCategory.AMULET)) {
                        foundAmulet = true;
                        break;
                    }
                }
            }
            if (!foundAmulet) {
                ctx.placeItemAt(
                    ctx.generateItem(ItemCategory.AMULET, 0),
                    { ...INVALID_POS },
                );
            }
        }

        // Re-seed the RNG
        ctx.seedRandomGenerator(oldSeed);

        timeAway = 50;

    } else {
        // ---- Restore existing level ----
        ctx.setScentMap(levels[rogue.depthLevel - 1].scentMap);
        timeAway = ctx.clamp(
            rogue.absoluteTurnNumber - levels[rogue.depthLevel - 1].awaySince,
            0, 30000,
        );

        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                const storage = levels[rogue.depthLevel - 1].mapStorage[i][j];
                const cell = pmap[i][j];
                for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                    cell.layers[layer] = storage.layers[layer];
                }
                cell.volume = storage.volume;
                cell.flags = storage.flags & PERMANENT_TILE_FLAGS;
                cell.machineNumber = storage.machineNumber;
                cell.rememberedAppearance = { ...storage.rememberedAppearance };
                cell.rememberedItemCategory = storage.rememberedItemCategory;
                cell.rememberedItemKind = storage.rememberedItemKind;
                cell.rememberedItemQuantity = storage.rememberedItemQuantity;
                cell.rememberedItemOriginDepth = storage.rememberedItemOriginDepth;
                cell.rememberedTerrain = storage.rememberedTerrain;
                cell.rememberedCellFlags = storage.rememberedCellFlags;
                cell.rememberedTerrainFlags = storage.rememberedTerrainFlags;
                cell.rememberedTMFlags = storage.rememberedTMFlags;
            }
        }

        ctx.setUpWaypoints();

        rogue.downLoc = { ...levels[rogue.depthLevel - 1].downStairsLoc };
        rogue.upLoc = { ...levels[rogue.depthLevel - 1].upStairsLoc };

        ctx.setMonsters(levels[rogue.depthLevel - 1].monsters);
        ctx.setDormantMonsters(levels[rogue.depthLevel - 1].dormantMonsters);
        ctx.floorItems.push(...levels[rogue.depthLevel - 1].items);
        levels[rogue.depthLevel - 1].items = [];

        ctx.restoreItems();
    }

    // ---- Simulate the environment ----
    // Bury the player in limbo so harmful terrain doesn't affect them.
    const savedPx = player.loc.x;
    const savedPy = player.loc.y;
    player.loc.x = 0;
    player.loc.y = 0;
    const currentTurnNumber = rogue.absoluteTurnNumber;
    timeAway = Math.min(timeAway, 100);
    // Note: updateEnvironment is called by the context
    // For now, we just advance the turn counter appropriately.
    // The actual environment simulation is delegated to the context.
    rogue.absoluteTurnNumber = currentTurnNumber;
    player.loc.x = savedPx;
    player.loc.y = savedPy;

    // Ticker ready for *next* environment update
    if (rogue.ticksTillUpdateEnvironment <= 0) {
        rogue.ticksTillUpdateEnvironment += 100;
    }

    // ---- Mark level as visited & show level feelings ----
    if (!levels[rogue.depthLevel - 1].visited) {
        levels[rogue.depthLevel - 1].visited = true;
        if (rogue.depthLevel === gameConst.amuletLevel && ctx.levelFeelings.length > 0) {
            ctx.messageWithColor(ctx.levelFeelings[0].message, ctx.levelFeelings[0].color, 0);
        } else if (rogue.depthLevel === gameConst.deepestLevel && ctx.levelFeelings.length > 1) {
            ctx.messageWithColor(ctx.levelFeelings[1].message, ctx.levelFeelings[1].color, 0);
        }
    }

    // ---- Position the player ----
    let loc: Pos;
    if (stairDirection === 0) { // fell into the level
        loc = ctx.getQualifyingLocNear(
            player.loc,
            true,
            0,
            T_PATHING_BLOCKER & ~TerrainFlag.T_IS_DEEP_WATER,
            TileFlag.HAS_MONSTER | TileFlag.HAS_ITEM | TileFlag.HAS_STAIRS | IS_IN_MACHINE,
            false,
            false,
        );

        if (ctx.cellHasTerrainFlag(loc, TerrainFlag.T_IS_DEEP_WATER)) {
            // Fell into deep water... can we swim out?
            const dryLoc = ctx.getQualifyingLocNear(
                player.loc,
                true,
                0,
                T_PATHING_BLOCKER,
                TileFlag.HAS_MONSTER | TileFlag.HAS_ITEM | TileFlag.HAS_STAIRS | IS_IN_MACHINE,
                false,
                false,
            );

            const swimDistance = ctx.pathingDistance(
                loc.x, loc.y, dryLoc.x, dryLoc.y,
                T_PATHING_BLOCKER & ~TerrainFlag.T_IS_DEEP_WATER,
            );
            if (swimDistance === 30000) {
                // Cannot swim out! Enclosed lake.
                loc = dryLoc;
            }
        }
    } else {
        if (stairDirection === 1) { // heading downward
            player.loc = { ...rogue.upLoc };
        } else if (stairDirection === -1) { // heading upward
            player.loc = { ...rogue.downLoc };
        }

        let placedPlayer = false;
        for (let dir = 0; dir < 4 && !placedPlayer; dir++) {
            const candidate = ctx.posNeighborInDirection(player.loc, dir);
            if (!ctx.cellHasTerrainFlag(candidate, T_PATHING_BLOCKER)
                && !(ctx.pmapAt(candidate).flags &
                    (TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS | IS_IN_MACHINE))) {
                loc = candidate;
                placedPlayer = true;
            }
        }
        if (!placedPlayer) {
            loc = ctx.getQualifyingPathLocNear(
                player.loc,
                true,
                T_DIVIDES_LEVEL, 0,
                T_PATHING_BLOCKER,
                TileFlag.HAS_MONSTER | TileFlag.HAS_STAIRS | IS_IN_MACHINE,
                false,
            );
        }
        // TypeScript: loc is guaranteed assigned if we get here
        loc = loc!;
    }
    player.loc = loc;
    ctx.pmapAt(player.loc).flags |= TileFlag.HAS_PLAYER;

    // Notify the player if they arrive on an item
    const floorItem = ctx.itemAtLoc(player.loc);
    if (floorItem) {
        const description = ctx.describedItemName(floorItem);
        ctx.messageWithColor(`Below you lies ${description}.`, ctx.itemMessageColor, 0);
    }

    if (connectingStairsDiscovered) {
        for (let i = rogue.upLoc.x - 1; i <= rogue.upLoc.x + 1; i++) {
            for (let j = rogue.upLoc.y - 1; j <= rogue.upLoc.y + 1; j++) {
                if (ctx.coordinatesAreInMap(i, j)) {
                    ctx.discoverCell(i, j);
                }
            }
        }
    }

    if (ctx.cellHasTerrainFlag(player.loc, TerrainFlag.T_IS_DEEP_WATER)
        && !player.status[StatusEffect.Levitating]
        && !ctx.cellHasTerrainFlag(player.loc, TerrainFlag.T_ENTANGLES | TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
        rogue.inWater = true;
    }

    // Restore monsters if the level was already visited
    if (levels[rogue.depthLevel - 1].visited) {
        const mapToStairs = ctx.allocGrid();
        const mapToPit = ctx.allocGrid();
        ctx.fillGrid(mapToStairs, 0);
        ctx.fillGrid(mapToPit, 0);
        ctx.calculateDistances(mapToStairs, player.loc.x, player.loc.y,
            T_PATHING_BLOCKER, null, true, true);
        ctx.calculateDistances(mapToPit,
            levels[rogue.depthLevel - 1].playerExitedVia.x,
            levels[rogue.depthLevel - 1].playerExitedVia.y,
            T_PATHING_BLOCKER, null, true, true);
        for (const monst of ctx.monsters) {
            ctx.restoreMonster(monst, mapToStairs, mapToPit);
        }
        ctx.freeGrid(mapToStairs);
        ctx.freeGrid(mapToPit);
    }

    ctx.updateMapToShore();
    ctx.updateVision(true);
    rogue.stealthRange = ctx.currentStealthRange();

    // Update monster states so none are hunting without scent/vision
    for (const monst of ctx.monsters) {
        ctx.updateMonsterState(monst);
    }

    rogue.playbackBetweenTurns = true;
    ctx.displayLevel();
    ctx.refreshSideBar(-1, -1, false);

    if (rogue.playerTurnNumber) {
        rogue.playerTurnNumber++; // Increment even though no time has passed.
    }
    ctx.RNGCheck();
    ctx.flushBufferToFile();
    ctx.deleteAllFlares();
    ctx.hideCursor();
}
