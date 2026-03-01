/*
 *  turn-processing.ts — Turn processing core functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/Time.c
 *  Functions: playerRecoversFromAttacking, synchronizePlayerTimeState,
 *             scentDistance, updateScent, resetScentTurnNumber,
 *             addXPXPToAlly, handleXPXP, recordCurrentCreatureHealths,
 *             playerTurnEnded
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
    GameConstants,
    Color,
    DungeonFeature,
    FloorTileType,
    Fixpt,
} from "../types/types.js";
import { StatusEffect, CreatureState } from "../types/enums.js";
import { TileFlag, TerrainFlag, TerrainMechFlag, ItemFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import { XPXP_NEEDED_FOR_TELEPATHIC_BOND } from "../types/constants.js";

// =============================================================================
// Context
// =============================================================================

export interface TurnProcessingContext {
    player: Creature;
    rogue: {
        weapon: Item | null;
        armor: Item | null;
        ringLeft: Item | null;
        ringRight: Item | null;
        scentTurnNumber: number;
        playerTurnNumber: number;
        absoluteTurnNumber: number;
        ticksTillUpdateEnvironment: number;
        monsterSpawnFuse: number;
        gameHasEnded: boolean;
        playbackFastForward: boolean;
        playbackMode: boolean;
        disturbed: boolean;
        automationActive: boolean;
        cautiousMode: boolean;
        justRested: boolean;
        justSearched: boolean;
        staleLoopMap: boolean;
        stealthRange: number;
        displayStealthRangeMode: boolean;
        heardCombatThisTurn: boolean;
        receivedLevitationWarning: boolean;
        updatedSafetyMapThisTurn: boolean;
        updatedAllySafetyMapThisTurn: boolean;
        updatedMapToSafeTerrainThisTurn: boolean;
        updatedMapToShoreThisTurn: boolean;
        xpxpThisTurn: number;
        depthLevel: number;
        deepestLevel: number;
        mapToShore: number[][];
        RNG: number;
        previousPoisonPercent: number;
        flares: any[];
        flareCount: number;
        awarenessBonus: number;
        stealthBonus: number;
        wisdomBonus: number;
        wpRefreshTicker: number;
        wpCount: number;
        playbackBetweenTurns: boolean;
        featRecord: boolean[];
        inWater: boolean;
        clairvoyance: number;
        minersLight: { lightColor: Color | null };
    };

    monsters: Creature[];
    dormantMonsters: Creature[];
    pmap: Pcell[][];
    levels: LevelData[];
    gameConst: GameConstants;
    scentMap: number[][];
    safetyMap: number[][];
    allySafetyMap: number[][];
    packItems: Item[];
    floorItems: Item[];
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];

    DCOLS: number;
    DROWS: number;
    FP_FACTOR: Fixpt;

    // Map helpers
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    terrainFlags(pos: Pos): number;
    discoveredTerrainFlagsAtLoc(pos: Pos): number;
    coordinatesAreInMap(x: number, y: number): boolean;
    pmapAt(loc: Pos): Pcell;

    // Monster helpers
    canSeeMonster(monst: Creature): boolean;
    canDirectlySeeMonster(monst: Creature): boolean;
    monsterRevealed(monst: Creature): boolean;
    monsterName(buf: string[], monst: Creature, includeArticle: boolean): void;
    monsterAtLoc(loc: Pos): Creature | null;
    monstersAreEnemies(monst1: Creature, monst2: Creature): boolean;
    monsterAvoids(monst: Creature, p: Pos): boolean;
    monsterIsInClass(monst: Creature, monsterClass: number): boolean;
    isVowelish(word: string): boolean;
    monstersTurn(monst: Creature): void;
    decrementMonsterStatus(monst: Creature): boolean;
    removeCreature(list: Creature[], monst: Creature): boolean;
    prependCreature(list: Creature[], monst: Creature): void;

    // Item helpers
    itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: number | null): void;
    numberOfMatchingPackItems(category: number, kind: number, flags: number, checkCarried: boolean): number;

    // Combat helpers
    inflictDamage(attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean): boolean;
    killCreature(monst: Creature, administrativeDeath: boolean): void;
    combatMessage(msg: string, color: Color | null): void;
    displayCombatText(): void;
    messageColorFromVictim(monst: Creature): Color;
    addPoison(monst: Creature, totalDamage: number, concentrationIncrement: number): void;
    flashMonster(monst: Creature, color: Color, strength: number): void;

    // UI
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Color, flags: number): void;
    flavorMessage(msg: string): void;
    refreshDungeonCell(loc: Pos): void;
    displayLevel(): void;
    displayAnnotation(): void;
    refreshSideBar(x: number, y: number, forceFullUpdate: boolean): void;
    gameOver(message: string, showScore: boolean): void;
    confirm(message: string, isDangerous: boolean): boolean;
    flashMessage(msg: string, x: number, y: number, duration: number, foreColor: Color, backColor: Color): void;
    recordKeystroke(key: number, shift: boolean, alt: boolean): void;
    confirmMessages(): void;
    pauseAnimation(duration: number, behavior: any): boolean;

    // Colors
    goodMessageColor: Color;
    badMessageColor: Color;
    advancementMessageColor: Color;
    itemMessageColor: Color;
    orange: Color;
    green: Color;
    red: Color;
    yellow: Color;
    darkRed: Color;
    darkGreen: Color;

    // Environment
    updateEnvironment(): void;
    updateVision(refreshDisplay: boolean): void;
    updateMapToShore(): void;
    updateSafetyMap(): void;
    refreshWaypoint(index: number): void;
    analyzeMap(updateChokemap: boolean): void;
    removeDeadMonsters(): void;
    shuffleTerrainColors(duration: number, b: boolean): void;
    resetDFMessageEligibility(): void;
    RNGCheck(): void;
    animateFlares(flares: any[], count: number): void;

    // Scent/FOV
    addScentToCell(x: number, y: number, distance: number): void;
    getFOVMask(grid: number[][], cx: number, cy: number, radius: Fixpt, blockFlags: number, blockTMFlags: number, ignoreWalls: boolean): void;
    zeroOutGrid(grid: number[][]): void;
    discoverCell(x: number, y: number): void;
    discover(x: number, y: number): void;
    storeMemories(x: number, y: number): void;

    // Items/recharging
    rechargeItemsIncrementally(multiplier: number): void;
    processIncrementalAutoID(): void;

    // Tile effects
    applyInstantTileEffectsToCreature(monst: Creature): void;
    applyGradualTileEffectsToCreature(monst: Creature, ticks: number): void;
    monsterShouldFall(monst: Creature): boolean;
    monstersFall(): void;
    decrementPlayerStatus(): void;
    playerFalls(): void;
    handleHealthAlerts(): void;
    updateScent(): void;
    currentStealthRange(): number;

    // Movement/search
    search(searchStrength: number): boolean;
    playerCanDirectlySee(x: number, y: number): boolean;
    playerCanSee(x: number, y: number): boolean;

    // Spawn
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;

    // Dungeon feature flags
    nbDirs: readonly [number, number][];

    // Math
    rand_range(lower: number, upper: number): number;
    rand_percent(chance: number): boolean;
    max(a: number, b: number): number;
    min(a: number, b: number): number;
}

// =============================================================================
// playerRecoversFromAttacking — from Time.c:2191
// =============================================================================

/**
 * Adjusts the player's ticksUntilTurn after an attack, based on weapon properties.
 *
 * C: void playerRecoversFromAttacking(boolean anAttackHit)
 */
export function playerRecoversFromAttacking(
    anAttackHit: boolean,
    ctx: TurnProcessingContext,
): void {
    if (ctx.player.ticksUntilTurn >= 0) {
        // Don't do this if the player's weapon of speed just fired.
        if (ctx.rogue.weapon && (ctx.rogue.weapon.flags & ItemFlag.ITEM_ATTACKS_STAGGER) && anAttackHit) {
            ctx.player.ticksUntilTurn += 2 * ctx.player.attackSpeed;
        } else if (ctx.rogue.weapon && (ctx.rogue.weapon.flags & ItemFlag.ITEM_ATTACKS_QUICKLY)) {
            ctx.player.ticksUntilTurn += Math.floor(ctx.player.attackSpeed / 2);
        } else {
            ctx.player.ticksUntilTurn += ctx.player.attackSpeed;
        }
    }
}

// =============================================================================
// synchronizePlayerTimeState — from Time.c:2187
// =============================================================================

/**
 * Called periodically (when haste/slow wears off and when moving between depths)
 * to keep environmental updates in sync with player turns.
 *
 * C: void synchronizePlayerTimeState()
 */
export function synchronizePlayerTimeState(
    ctx: TurnProcessingContext,
): void {
    ctx.rogue.ticksTillUpdateEnvironment = ctx.player.ticksUntilTurn;
}

// =============================================================================
// scentDistance — from Time.c:641
// =============================================================================

/**
 * Computes the "scent distance" between two points, using weighted Manhattan distance.
 * The longer axis is doubled.
 *
 * C: short scentDistance(short x1, short y1, short x2, short y2)
 */
export function scentDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
): number {
    if (Math.abs(x1 - x2) > Math.abs(y1 - y2)) {
        return 2 * Math.abs(x1 - x2) + Math.abs(y1 - y2);
    } else {
        return Math.abs(x1 - x2) + 2 * Math.abs(y1 - y2);
    }
}

// =============================================================================
// resetScentTurnNumber — from Time.c:2624
// =============================================================================

/**
 * Prevents scentTurnNumber from rolling over by subtracting 15000 from
 * the turn number and all scent map values.
 *
 * C: void resetScentTurnNumber()
 */
export function resetScentTurnNumber(
    ctx: TurnProcessingContext,
): void {
    ctx.rogue.scentTurnNumber -= 15000;
    for (let d = 0; d < ctx.gameConst.deepestLevel; d++) {
        if (ctx.levels[d].visited && ctx.levels[d].scentMap) {
            const sm = ctx.levels[d].scentMap!;
            for (let i = 0; i < ctx.DCOLS; i++) {
                for (let j = 0; j < ctx.DROWS; j++) {
                    if (sm[i][j] > 15000) {
                        sm[i][j] -= 15000;
                    } else {
                        sm[i][j] = 0;
                    }
                }
            }
        }
    }
}

// =============================================================================
// addXPXPToAlly — from Time.c:931
// =============================================================================

/**
 * Adds discovery experience to an ally. At certain thresholds, grants
 * telepathic bond or companion feat.
 *
 * C: static void addXPXPToAlly(creature *monst)
 */
export function addXPXPToAlly(
    monst: Creature,
    ctx: TurnProcessingContext,
): void {
    if (
        monst.creatureState !== CreatureState.Ally ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)
    ) {
        return;
    }

    monst.xpxp += ctx.rogue.xpxpThisTurn;

    // Telepathic bond
    if (
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED) &&
        monst.xpxp >= XPXP_NEEDED_FOR_TELEPATHIC_BOND
    ) {
        monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED;
        ctx.updateVision(true);
        const buf: string[] = [""];
        ctx.monsterName(buf, monst, false);
        ctx.messageWithColor(
            `you have developed a telepathic bond with your ${buf[0]}.`,
            ctx.advancementMessageColor,
            0,
        );
    }

    // Companion feat
    if (
        !(ctx.rogue.featRecord[0] /* FEAT_COMPANION index — placeholder */) &&
        monst.xpxp >= ctx.gameConst.companionFeatRequiredXP
    ) {
        ctx.rogue.featRecord[0] = true;
    }
}

// =============================================================================
// handleXPXP — from Time.c:956
// =============================================================================

/**
 * Distributes discovery experience to all allies, including those on adjacent levels.
 *
 * C: static void handleXPXP()
 */
export function handleXPXP(
    ctx: TurnProcessingContext,
): void {
    for (const monst of ctx.monsters) {
        addXPXPToAlly(monst, ctx);
    }
    if (ctx.rogue.depthLevel > 1) {
        const prevLevel = ctx.levels[ctx.rogue.depthLevel - 2];
        if (prevLevel && prevLevel.monsters) {
            for (const monst of prevLevel.monsters) {
                addXPXPToAlly(monst, ctx);
            }
        }
    }
    if (ctx.rogue.depthLevel < ctx.gameConst.deepestLevel) {
        const nextLevel = ctx.levels[ctx.rogue.depthLevel];
        if (nextLevel && nextLevel.monsters) {
            for (const monst of nextLevel.monsters) {
                addXPXPToAlly(monst, ctx);
            }
        }
    }
    ctx.rogue.xpxpThisTurn = 0;
}

// =============================================================================
// recordCurrentCreatureHealths — from Time.c:2205
// =============================================================================

/**
 * Snapshots the current HP of all creatures (player + monsters).
 * Used by health alert thresholds to detect damage taken this turn.
 *
 * C: static void recordCurrentCreatureHealths()
 */
export function recordCurrentCreatureHealths(
    ctx: TurnProcessingContext,
): void {
    ctx.player.previousHealthPoints = ctx.player.currentHP;
    for (const monst of ctx.monsters) {
        monst.previousHealthPoints = monst.currentHP;
    }
}

// =============================================================================
// playerTurnEnded — from Time.c:2219
// =============================================================================

/**
 * The dungeon schedule manager, called every time the player's turn comes to an end.
 * It hands control over to monsters until they've all expended their accumulated ticks,
 * updating the environment (gas spreading, flames spreading and burning out, etc.)
 * every 100 ticks.
 *
 * C: void playerTurnEnded()
 */
export function playerTurnEnded(
    ctx: TurnProcessingContext,
): void {
    let fastForward = false;

    handleXPXP(ctx);
    ctx.resetDFMessageEligibility();
    recordCurrentCreatureHealths(ctx);

    if (ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING) {
        ctx.playerFalls();
        if (!ctx.rogue.gameHasEnded) {
            ctx.handleHealthAlerts();
        }
        return;
    }

    // Monsters must fall at start of turn (they may move faster than environment updates)
    ctx.monstersFall();

    do {
        if (ctx.rogue.gameHasEnded) {
            return;
        }

        if (!ctx.player.status[StatusEffect.Paralyzed]) {
            ctx.rogue.playerTurnNumber++;
        }
        ctx.rogue.absoluteTurnNumber++;

        if (ctx.player.status[StatusEffect.Invisible]) {
            ctx.rogue.scentTurnNumber += 10; // Scent fades faster while invisible
        } else {
            ctx.rogue.scentTurnNumber += 3;
        }
        if (ctx.rogue.scentTurnNumber > 20000) {
            resetScentTurnNumber(ctx);
        }

        // Regeneration/starvation
        if (ctx.player.status[StatusEffect.Nutrition] <= 0) {
            ctx.player.currentHP--;
            if (ctx.player.currentHP <= 0) {
                ctx.gameOver("Starved to death", true);
                return;
            }
        } else if (
            ctx.player.currentHP < ctx.player.info.maxHP &&
            !ctx.player.status[StatusEffect.Poisoned]
        ) {
            ctx.player.turnsUntilRegen -= 1000;
            if (ctx.player.turnsUntilRegen <= 0) {
                ctx.player.currentHP++;
                if (ctx.player.previousHealthPoints < ctx.player.currentHP) {
                    ctx.player.previousHealthPoints++;
                }
                ctx.player.turnsUntilRegen += ctx.player.info.turnsBetweenRegen;
            }
            if (ctx.player.regenPerTurn) {
                ctx.player.currentHP += ctx.player.regenPerTurn;
                if (ctx.player.previousHealthPoints < ctx.player.currentHP) {
                    ctx.player.previousHealthPoints = ctx.min(
                        ctx.player.currentHP,
                        ctx.player.previousHealthPoints + ctx.player.regenPerTurn,
                    );
                }
            }
        }

        if (
            ctx.rogue.awarenessBonus > -30 &&
            !(ctx.pmapAt(ctx.player.loc).flags & TileFlag.SEARCHED_FROM_HERE)
        ) {
            ctx.search(ctx.rogue.awarenessBonus + 30);
            ctx.pmapAt(ctx.player.loc).flags |= TileFlag.SEARCHED_FROM_HERE;
        }
        if (!ctx.rogue.justSearched && ctx.player.status[StatusEffect.Searching] > 0) {
            ctx.player.status[StatusEffect.Searching] = 0;
        }
        if (ctx.rogue.staleLoopMap) {
            ctx.analyzeMap(false);
        }

        // Bound-to-leader monsters whose leaders are gone dissipate
        for (const monst of [...ctx.monsters]) {
            if (
                (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_BOUND_TO_LEADER) &&
                (!monst.leader || !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER)) &&
                monst.creatureState !== CreatureState.Ally
            ) {
                ctx.killCreature(monst, false);
                if (ctx.canSeeMonster(monst)) {
                    const buf2: string[] = [""];
                    ctx.monsterName(buf2, monst, true);
                    ctx.combatMessage(`${buf2[0]} dissipates into thin air`, ctx.messageColorFromVictim(monst));
                }
            }
        }

        // Burning damage
        if (ctx.player.status[StatusEffect.Burning] > 0) {
            const damage = ctx.rand_range(1, 3);
            if (
                !ctx.player.status[StatusEffect.ImmuneToFire] &&
                ctx.inflictDamage(null, ctx.player, damage, ctx.orange, true)
            ) {
                ctx.killCreature(ctx.player, false);
                ctx.gameOver("Burned to death", true);
            }
            if (!--ctx.player.status[StatusEffect.Burning]) {
                // extinguishFireOnCreature inline for player
                ctx.player.status[StatusEffect.Burning] = 0;
                ctx.message("you are no longer on fire.", 0);
            }
        }

        // Poison damage
        if (ctx.player.status[StatusEffect.Poisoned] > 0) {
            ctx.player.status[StatusEffect.Poisoned]--;
            if (ctx.inflictDamage(null, ctx.player, ctx.player.poisonAmount, ctx.green, true)) {
                ctx.killCreature(ctx.player, false);
                ctx.gameOver("Died from poison", true);
            }
            if (!ctx.player.status[StatusEffect.Poisoned]) {
                ctx.player.poisonAmount = 0;
            }
        }

        // Tick management
        if (ctx.player.ticksUntilTurn === 0) {
            ctx.player.ticksUntilTurn += ctx.player.movementSpeed;
        } else if (ctx.player.ticksUntilTurn < 0) {
            ctx.player.ticksUntilTurn = 0;
        }

        ctx.updateScent();

        ctx.rogue.updatedSafetyMapThisTurn = false;
        ctx.rogue.updatedAllySafetyMapThisTurn = false;
        ctx.rogue.updatedMapToSafeTerrainThisTurn = false;

        // Check for fleeing visible monsters → update safety map
        for (const monst of ctx.monsters) {
            if (
                monst.creatureState === CreatureState.Fleeing &&
                ctx.pmapAt(monst.loc).flags & TileFlag.IN_FIELD_OF_VIEW
            ) {
                ctx.updateSafetyMap();
                break;
            }
        }

        ctx.applyGradualTileEffectsToCreature(ctx.player, ctx.player.ticksUntilTurn);

        if (ctx.rogue.gameHasEnded) {
            return;
        }

        ctx.rogue.heardCombatThisTurn = false;

        // Monster turns loop
        while (ctx.player.ticksUntilTurn > 0) {
            let soonestTurn = 10000;
            for (const monst of ctx.monsters) {
                soonestTurn = ctx.min(soonestTurn, monst.ticksUntilTurn);
            }
            soonestTurn = ctx.min(soonestTurn, ctx.player.ticksUntilTurn);
            soonestTurn = ctx.min(soonestTurn, ctx.rogue.ticksTillUpdateEnvironment);

            for (const monst of ctx.monsters) {
                monst.ticksUntilTurn -= soonestTurn;
            }
            ctx.rogue.ticksTillUpdateEnvironment -= soonestTurn;

            if (ctx.rogue.ticksTillUpdateEnvironment <= 0) {
                ctx.rogue.ticksTillUpdateEnvironment += 100;

                ctx.rechargeItemsIncrementally(1);
                ctx.processIncrementalAutoID();
                ctx.rogue.monsterSpawnFuse--;

                for (const monst of [...ctx.monsters]) {
                    ctx.applyInstantTileEffectsToCreature(monst);
                }

                for (const monst of [...ctx.monsters]) {
                    ctx.decrementMonsterStatus(monst);
                }

                // Monsters with dungeon features spawn them periodically
                for (const monst of ctx.monsters) {
                    if (
                        monst.info.DFChance &&
                        !(monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION) &&
                        ctx.rand_percent(monst.info.DFChance)
                    ) {
                        ctx.spawnDungeonFeature(
                            monst.loc.x,
                            monst.loc.y,
                            ctx.dungeonFeatureCatalog[monst.info.DFType],
                            true,
                            false,
                        );
                    }
                }

                ctx.updateEnvironment();
                ctx.decrementPlayerStatus();
                ctx.applyInstantTileEffectsToCreature(ctx.player);
                if (ctx.rogue.gameHasEnded) {
                    return;
                }

                if (ctx.player.ticksUntilTurn > 100 && !fastForward) {
                    fastForward = ctx.rogue.playbackFastForward || ctx.pauseAnimation(25, null);
                }

                // Rolling waypoint refresh
                ctx.rogue.wpRefreshTicker++;
                if (ctx.rogue.wpRefreshTicker >= ctx.rogue.wpCount) {
                    ctx.rogue.wpRefreshTicker = 0;
                }
                ctx.refreshWaypoint(ctx.rogue.wpRefreshTicker);
            }

            // Give each monster its turn
            for (const monst of [...ctx.monsters]) {
                if (ctx.rogue.gameHasEnded) break;

                if (monst.ticksUntilTurn <= 0) {
                    if (monst.currentHP > monst.info.maxHP) {
                        monst.currentHP = monst.info.maxHP;
                    }

                    if (
                        (monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION) ||
                        monst.status[StatusEffect.Paralyzed] ||
                        monst.status[StatusEffect.Entranced] ||
                        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
                    ) {
                        monst.ticksUntilTurn = monst.movementSpeed;
                    } else {
                        ctx.monstersTurn(monst);
                    }

                    // Check if monster survived to apply gradual effects
                    if (ctx.monsters.includes(monst)) {
                        ctx.applyGradualTileEffectsToCreature(monst, monst.ticksUntilTurn);
                    }
                }
            }

            ctx.player.ticksUntilTurn -= soonestTurn;

            if (ctx.rogue.gameHasEnded) {
                return;
            }
        }

        ctx.updateVision(true);
        ctx.rogue.stealthRange = ctx.currentStealthRange();
        if (ctx.rogue.displayStealthRangeMode) {
            ctx.displayLevel();
        }

        // Monster visibility updates
        for (const monst of ctx.monsters) {
            if (
                ctx.canSeeMonster(monst) &&
                !(monst.bookkeepingFlags & (MonsterBookkeepingFlag.MB_WAS_VISIBLE | MonsterBookkeepingFlag.MB_ALREADY_SEEN))
            ) {
                if (monst.creatureState !== CreatureState.Ally) {
                    ctx.rogue.disturbed = true;
                    if (ctx.rogue.cautiousMode || ctx.rogue.automationActive) {
                        const buf2: string[] = [""];
                        ctx.monsterName(buf2, monst, false);
                        const senseVerb = ctx.playerCanDirectlySee(monst.loc.x, monst.loc.y) ? "see" : "sense";
                        const article = ctx.isVowelish(buf2[0]) ? "n" : "";
                        const buf = `you ${senseVerb} a${article} ${buf2[0]}`;
                        if (ctx.rogue.cautiousMode) {
                            ctx.message(buf + ".", 1); // REQUIRE_ACKNOWLEDGMENT
                        } else {
                            ctx.combatMessage(buf, null);
                        }
                    }
                }
            }

            if (ctx.canSeeMonster(monst)) {
                monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_WAS_VISIBLE;
                if (
                    ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                    ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_IS_SECRET)
                ) {
                    ctx.discover(monst.loc.x, monst.loc.y);
                }
                if (ctx.canDirectlySeeMonster(monst)) {
                    // Runic weapon/armor hints
                    if (
                        ctx.rogue.weapon &&
                        (ctx.rogue.weapon.flags & ItemFlag.ITEM_RUNIC) &&
                        ctx.rogue.weapon.enchant2 === 7 /* W_SLAYING */ &&
                        !(ctx.rogue.weapon.flags & ItemFlag.ITEM_RUNIC_HINTED) &&
                        ctx.monsterIsInClass(monst, ctx.rogue.weapon.vorpalEnemy)
                    ) {
                        ctx.rogue.weapon.flags |= ItemFlag.ITEM_RUNIC_HINTED;
                        const buf2: string[] = [""];
                        ctx.itemName(ctx.rogue.weapon, buf2, false, false, null);
                        ctx.messageWithColor(
                            `the runes on your ${buf2[0]} gleam balefully.`,
                            ctx.itemMessageColor,
                            1, // REQUIRE_ACKNOWLEDGMENT
                        );
                    }
                    if (
                        ctx.rogue.armor &&
                        (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
                        ctx.rogue.armor.enchant2 === 10 /* A_IMMUNITY */ &&
                        !(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC_HINTED) &&
                        ctx.monsterIsInClass(monst, ctx.rogue.armor.vorpalEnemy)
                    ) {
                        ctx.rogue.armor.flags |= ItemFlag.ITEM_RUNIC_HINTED;
                        const buf2: string[] = [""];
                        ctx.itemName(ctx.rogue.armor, buf2, false, false, null);
                        ctx.messageWithColor(
                            `the runes on your ${buf2[0]} glow protectively.`,
                            ctx.itemMessageColor,
                            1, // REQUIRE_ACKNOWLEDGMENT
                        );
                    }
                }
            }

            if (
                !ctx.canSeeMonster(monst) &&
                (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_WAS_VISIBLE) &&
                !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
            ) {
                monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_WAS_VISIBLE;
            }
        }

        ctx.displayCombatText();

        if (ctx.player.status[StatusEffect.Paralyzed]) {
            if (!fastForward) {
                fastForward = ctx.rogue.playbackFastForward || ctx.pauseAnimation(25, null);
            }
        }

        if (!ctx.rogue.playbackFastForward) {
            ctx.shuffleTerrainColors(100, false);
        }

        ctx.displayAnnotation();
        ctx.refreshSideBar(-1, -1, false);

        ctx.applyInstantTileEffectsToCreature(ctx.player);
        if (ctx.rogue.gameHasEnded) {
            return;
        }

        if (ctx.player.currentHP > ctx.player.info.maxHP) {
            ctx.player.currentHP = ctx.player.info.maxHP;
        }

        if (ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING) {
            ctx.playerFalls();
            ctx.handleHealthAlerts();
            return;
        }
    } while (ctx.player.status[StatusEffect.Paralyzed]);

    ctx.rogue.justRested = false;
    ctx.rogue.justSearched = false;

    if (!ctx.rogue.updatedMapToShoreThisTurn) {
        ctx.updateMapToShore();
    }

    // "Point of no return" check
    if (
        (ctx.player.status[StatusEffect.Levitating] &&
            ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_LAVA_INSTA_DEATH | TerrainFlag.T_IS_DEEP_WATER | TerrainFlag.T_AUTO_DESCENT)) ||
        (ctx.player.status[StatusEffect.ImmuneToFire] &&
            ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_LAVA_INSTA_DEATH))
    ) {
        if (!ctx.rogue.receivedLevitationWarning) {
            const turnsRequiredToShore =
                Math.floor(ctx.rogue.mapToShore[ctx.player.loc.x][ctx.player.loc.y] * ctx.player.movementSpeed / 100);
            let turnsToShore: number;
            if (ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_LAVA_INSTA_DEATH)) {
                turnsToShore = Math.floor(
                    ctx.max(ctx.player.status[StatusEffect.Levitating], ctx.player.status[StatusEffect.ImmuneToFire]) *
                        100 /
                        ctx.player.movementSpeed,
                );
            } else {
                turnsToShore = Math.floor(ctx.player.status[StatusEffect.Levitating] * 100 / ctx.player.movementSpeed);
            }
            if (turnsRequiredToShore === turnsToShore || turnsRequiredToShore + 1 === turnsToShore) {
                ctx.message("better head back to solid ground!", 1); // REQUIRE_ACKNOWLEDGMENT
                ctx.rogue.receivedLevitationWarning = true;
            } else if (turnsRequiredToShore > turnsToShore && turnsRequiredToShore < 10000) {
                ctx.message("you're past the point of no return!", 1); // REQUIRE_ACKNOWLEDGMENT
                ctx.rogue.receivedLevitationWarning = true;
            }
        }
    } else {
        ctx.rogue.receivedLevitationWarning = false;
    }

    ctx.removeDeadMonsters();
    ctx.rogue.playbackBetweenTurns = true;
    ctx.RNGCheck();
    ctx.handleHealthAlerts();

    if (ctx.rogue.flareCount > 0) {
        ctx.animateFlares(ctx.rogue.flares, ctx.rogue.flareCount);
        ctx.rogue.flareCount = 0;
    }
}
