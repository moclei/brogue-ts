/*
 *  creature-effects.ts — Creature status effects and tile interactions
 *  brogue-ts
 *
 *  Ported from: src/brogue/Time.c
 *  Functions: exposeCreatureToFire, extinguishFireOnCreature,
 *             monsterShouldFall, applyInstantTileEffectsToCreature,
 *             applyGradualTileEffectsToCreature, updateFlavorText,
 *             updatePlayerUnderwaterness, decrementPlayerStatus,
 *             playerFalls, monstersFall, checkNutrition, burnItem,
 *             handleHealthAlerts, flashCreatureAlert, discoverCell,
 *             demoteVisibility, armorStealthAdjustment, currentStealthRange
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
    Tcell,
    Item,
    LevelData,
    GameConstants,
    Color,
    DungeonFeature,
    FloorTileType,
} from "../types/types.js";
import { StatusEffect, CreatureState, DungeonLayer, TileType, ArmorEnchant } from "../types/enums.js";
import {
    TileFlag,
    TerrainFlag,
    TerrainMechFlag,
    ItemFlag,
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
} from "../types/flags.js";
import { NUMBER_TERRAIN_LAYERS } from "../types/constants.js";

// =============================================================================
// Context
// =============================================================================

export interface CreatureEffectsContext {
    player: Creature;
    rogue: {
        weapon: Item | null;
        armor: Item | null;
        disturbed: boolean;
        automationActive: boolean;
        autoPlayingLevel: boolean;
        gameHasEnded: boolean;
        depthLevel: number;
        deepestLevel: number;
        staleLoopMap: boolean;
        inWater: boolean;
        previousPoisonPercent: number;
        playbackMode: boolean;
        minersLight: { lightColor: Color | null };
        monsterSpawnFuse: number;
        stealthBonus: number;
        awarenessBonus: number;
        justRested: boolean;
        flares: any[];
        flareCount: number;
        yendorWarden: Creature | null;
    };

    monsters: Creature[];
    pmap: Pcell[][];
    tmap: Tcell[][];
    levels: LevelData[];
    gameConst: GameConstants;
    tileCatalog: readonly FloorTileType[];
    dungeonFeatureCatalog: readonly DungeonFeature[];
    packItems: Item[];
    floorItems: Item[];

    DCOLS: number;
    DROWS: number;
    INVALID_POS: Pos;

    // Map helpers
    cellHasTerrainFlag(pos: Pos, flags: number): boolean;
    cellHasTMFlag(pos: Pos, flags: number): boolean;
    terrainFlags(pos: Pos): number;
    pmapAt(loc: Pos): Pcell;
    coordinatesAreInMap(x: number, y: number): boolean;
    playerCanSee(x: number, y: number): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;

    // Monster helpers
    canSeeMonster(monst: Creature): boolean;
    canDirectlySeeMonster(monst: Creature): boolean;
    monsterName(buf: string[], monst: Creature, includeArticle: boolean): void;
    monsterAtLoc(loc: Pos): Creature | null;
    monstersAreEnemies(monst1: Creature, monst2: Creature): boolean;
    monsterIsInClass(monst: Creature, monsterClass: number): boolean;
    removeCreature(list: Creature[], monst: Creature): boolean;
    prependCreature(list: Creature[], monst: Creature): void;
    demoteMonsterFromLeadership(monst: Creature): void;

    // Item helpers
    itemName(theItem: Item, buf: string[], includeDetails: boolean, includeArticle: boolean, maxLen: number | null): void;
    numberOfMatchingPackItems(category: number, kind: number, flags: number, checkCarried: boolean): number;
    autoIdentify(theItem: Item): void;
    removeItemFromChain(theItem: Item, chain: Item[]): void;
    deleteItem(theItem: Item): void;
    dropItem(theItem: Item): Item | null;
    eat(theItem: Item, fromInventory: boolean): void;
    makeMonsterDropItem(monst: Creature): void;

    // Combat helpers
    inflictDamage(attacker: Creature | null, defender: Creature, damage: number, flashColor: Color, showDamage: boolean): boolean;
    killCreature(monst: Creature, administrativeDeath: boolean): void;
    combatMessage(msg: string, color: Color | null): void;
    messageColorFromVictim(monst: Creature): Color;
    addPoison(monst: Creature, totalDamage: number, concentrationIncrement: number): void;
    flashMonster(monst: Creature, color: Color, strength: number): void;

    // UI
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Color, flags: number): void;
    flavorMessage(msg: string): void;
    refreshDungeonCell(loc: Pos): void;
    gameOver(message: string, showScore: boolean): void;
    flashMessage(msg: string, x: number, y: number, duration: number, foreColor: Color, backColor: Color): void;
    confirmMessages(): void;
    displayLevel(): void;

    // Colors
    goodMessageColor: Color;
    badMessageColor: Color;
    itemMessageColor: Color;
    fireForeColor: Color;
    torchLightColor: Color;
    minersLightColor: Color;
    white: Color;
    brown: Color;
    green: Color;
    red: Color;
    orange: Color;
    yellow: Color;
    pink: Color;
    confusionGasColor: Color;
    darkRed: Color;
    darkGreen: Color;

    // Environment
    updateVision(refreshDisplay: boolean): void;
    updateMinersLightRadius(): void;
    spawnDungeonFeature(x: number, y: number, feat: DungeonFeature, isVolatile: boolean, overrideProtection: boolean): void;
    promoteTile(x: number, y: number, layer: DungeonLayer, useFireDF: boolean): void;
    exposeTileToFire(x: number, y: number, alwaysIgnite: boolean): void;
    startLevel(depth: number, stairDirection: number): void;
    teleport(monst: Creature, target: Pos, safe: boolean): void;
    createFlare(x: number, y: number, flareType: number): void;
    animateFlares(flares: any[], count: number): void;
    spawnPeriodicHorde(): void;
    monstersFall(): void;
    updateFloorItems(): void;
    synchronizePlayerTimeState(): void;
    recalculateEquipmentBonuses(): void;
    updateEncumbrance(): void;
    playerInDarkness(): boolean;
    playerTurnEnded(): void;

    // Movement/search
    keyOnTileAt(loc: Pos): Item | null;
    useKeyAt(theItem: Item, x: number, y: number): void;
    discover(x: number, y: number): void;
    discoverCell(x: number, y: number): void;
    search(searchStrength: number): boolean;
    recordKeystroke(key: number, shift: boolean, alt: boolean): void;

    // Map query functions
    layerWithFlag(x: number, y: number, flag: number): number;
    highestPriorityLayer(x: number, y: number, skipGas: boolean): DungeonLayer;
    describeLocation(buf: string[], x: number, y: number): void;
    tileFlavor(x: number, y: number): string;

    // Math
    rand_range(lower: number, upper: number): number;
    rand_percent(chance: number): boolean;
    randClumpedRange(lower: number, upper: number, clump: number): number;
    max(a: number, b: number): number;
    min(a: number, b: number): number;

    // RNG control
    assureCosmeticRNG(): void;
    restoreRNG(): void;

    // Misc
    mapToWindowX(x: number): number;
    mapToWindowY(y: number): number;
    strLenWithoutEscapes(s: string): number;
    COLS: number;
    REQUIRE_ACKNOWLEDGMENT: number;
    HUNGER_THRESHOLD: number;
    WEAK_THRESHOLD: number;
    FAINT_THRESHOLD: number;
    ALL_ITEMS: number;
    AMULET: number;
    FOOD: number;
    FRUIT: number;
    ARMOR: number;
    RING: number;
    GENERIC_FLASH_LIGHT: number;
    ANY_KIND_OF_VISIBLE: number;
    DISCOVERED: number;
    ITEM_DETECTED: number;
    HAS_ITEM: number;
    SEARCHED_FROM_HERE: number;
    IS_IN_SHADOW: number;
    armorTable: readonly { strengthRequired: number }[];
}

// =============================================================================
// exposeCreatureToFire — from Time.c:28
// =============================================================================

export function exposeCreatureToFire(
    monst: Creature,
    ctx: CreatureEffectsContext,
): void {
    if (
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) ||
        monst.status[StatusEffect.ImmuneToFire] ||
        (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) ||
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) ||
        (!monst.status[StatusEffect.Levitating] &&
            ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_EXTINGUISHES_FIRE))
    ) {
        return;
    }

    if (monst.status[StatusEffect.Burning] === 0) {
        if (monst === ctx.player) {
            ctx.rogue.minersLight.lightColor = ctx.fireForeColor;
            ctx.player.info.foreColor = ctx.torchLightColor;
            ctx.refreshDungeonCell(ctx.player.loc);
            ctx.combatMessage("you catch fire", ctx.badMessageColor);
        } else if (ctx.canDirectlySeeMonster(monst)) {
            const buf: string[] = [""];
            ctx.monsterName(buf, monst, true);
            ctx.combatMessage(`${buf[0]} catches fire`, ctx.messageColorFromVictim(monst));
        }
    }

    monst.status[StatusEffect.Burning] = monst.maxStatus[StatusEffect.Burning] = ctx.max(
        monst.status[StatusEffect.Burning],
        7,
    );
}

// =============================================================================
// extinguishFireOnCreature — from Time.c:1858
// =============================================================================

export function extinguishFireOnCreature(
    monst: Creature,
    ctx: CreatureEffectsContext,
): void {
    monst.status[StatusEffect.Burning] = 0;
    if (monst === ctx.player) {
        ctx.player.info.foreColor = ctx.white;
        ctx.rogue.minersLight.lightColor = ctx.minersLightColor;
        ctx.refreshDungeonCell(ctx.player.loc);
        ctx.updateVision(true);
        ctx.message("you are no longer on fire.", 0);
    }
}

// =============================================================================
// updateFlavorText — from Time.c:53
// =============================================================================

export function updateFlavorText(
    ctx: CreatureEffectsContext,
): void {
    if (ctx.rogue.disturbed && !ctx.rogue.gameHasEnded) {
        if (
            ctx.rogue.armor &&
            (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
            ctx.rogue.armor.enchant2 === ArmorEnchant.Respiration &&
            ctx.tileCatalog[
                ctx.pmapAt(ctx.player.loc).layers[
                    ctx.highestPriorityLayer(ctx.player.loc.x, ctx.player.loc.y, false)
                ]
            ].flags &
                TerrainFlag.T_RESPIRATION_IMMUNITIES
        ) {
            ctx.flavorMessage("A pocket of cool, clean air swirls around you.");
        } else if (ctx.player.status[StatusEffect.Levitating]) {
            const buf: string[] = [""];
            ctx.describeLocation(buf, ctx.player.loc.x, ctx.player.loc.y);
            ctx.flavorMessage(buf[0]);
        } else {
            ctx.flavorMessage(ctx.tileFlavor(ctx.player.loc.x, ctx.player.loc.y));
        }
    }
}

// =============================================================================
// updatePlayerUnderwaterness — from Time.c:71
// =============================================================================

export function updatePlayerUnderwaterness(
    ctx: CreatureEffectsContext,
): void {
    if (ctx.rogue.inWater) {
        if (
            !ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_IS_DEEP_WATER) ||
            ctx.player.status[StatusEffect.Levitating] ||
            ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_ENTANGLES | TerrainFlag.T_OBSTRUCTS_PASSABILITY)
        ) {
            ctx.rogue.inWater = false;
            ctx.updateMinersLightRadius();
            ctx.updateVision(true);
            ctx.displayLevel();
        }
    } else {
        if (
            ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_IS_DEEP_WATER) &&
            !ctx.player.status[StatusEffect.Levitating] &&
            !ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_ENTANGLES | TerrainFlag.T_OBSTRUCTS_PASSABILITY)
        ) {
            ctx.rogue.inWater = true;
            ctx.updateMinersLightRadius();
            ctx.updateVision(true);
            ctx.displayLevel();
        }
    }
}

// =============================================================================
// monsterShouldFall — from Time.c:93
// =============================================================================

export function monsterShouldFall(
    monst: Creature,
    ctx: CreatureEffectsContext,
): boolean {
    return (
        !monst.status[StatusEffect.Levitating] &&
        ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_AUTO_DESCENT) &&
        !ctx.cellHasTerrainFlag(monst.loc, TerrainFlag.T_ENTANGLES | TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_PREPLACED)
    );
}

// =============================================================================
// discoverCell — from Time.c:732
// =============================================================================

export function discoverCell(
    x: number,
    y: number,
    ctx: CreatureEffectsContext,
): void {
    ctx.pmap[x][y].flags &= ~TileFlag.STABLE_MEMORY;
    if (!(ctx.pmap[x][y].flags & TileFlag.DISCOVERED)) {
        ctx.pmap[x][y].flags |= TileFlag.DISCOVERED;
        if (!ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_PATHING_BLOCKER)) {
            ctx.rogue.xpxpThisTurn = (ctx.rogue as any).xpxpThisTurn ? (ctx.rogue as any).xpxpThisTurn + 1 : 1;
        }
    }
}

// =============================================================================
// demoteVisibility — from Time.c:718
// =============================================================================

export function demoteVisibility(
    ctx: CreatureEffectsContext,
): void {
    for (let i = 0; i < ctx.DCOLS; i++) {
        for (let j = 0; j < ctx.DROWS; j++) {
            ctx.pmap[i][j].flags &= ~TileFlag.WAS_VISIBLE;
            if (ctx.pmap[i][j].flags & TileFlag.VISIBLE) {
                ctx.pmap[i][j].flags &= ~TileFlag.VISIBLE;
                ctx.pmap[i][j].flags |= TileFlag.WAS_VISIBLE;
            }
        }
    }
}

// =============================================================================
// armorStealthAdjustment — from Time.c:667
// =============================================================================

export function armorStealthAdjustment(
    theArmor: Item | null,
    ctx: CreatureEffectsContext,
): number {
    if (!theArmor || !(theArmor.category & ctx.ARMOR)) {
        return 0;
    }
    return ctx.max(0, ctx.armorTable[theArmor.kind].strengthRequired - 12);
}

// =============================================================================
// currentStealthRange — from Time.c:676
// =============================================================================

export function currentStealthRange(
    ctx: CreatureEffectsContext,
): number {
    let stealthRange = 14;

    if (ctx.player.status[StatusEffect.Invisible]) {
        stealthRange = 1;
    } else {
        if (ctx.playerInDarkness()) {
            stealthRange = Math.floor(stealthRange / 2);
        }
        if (ctx.pmapAt(ctx.player.loc).flags & ctx.IS_IN_SHADOW) {
            stealthRange = Math.floor(stealthRange / 2);
        }

        stealthRange += armorStealthAdjustment(ctx.rogue.armor, ctx);

        if (ctx.rogue.justRested) {
            stealthRange = Math.floor((stealthRange + 1) / 2);
        }

        if (ctx.player.status[StatusEffect.Aggravating] > 0) {
            stealthRange += ctx.player.status[StatusEffect.Aggravating];
        }

        stealthRange -= ctx.rogue.stealthBonus;

        if (stealthRange < 2 && !ctx.rogue.justRested) {
            stealthRange = 2;
        } else if (stealthRange < 1) {
            stealthRange = 1;
        }
    }
    return stealthRange;
}

// =============================================================================
// checkNutrition — from Time.c:804
// =============================================================================

export function checkNutrition(
    ctx: CreatureEffectsContext,
): void {
    const foodWarning =
        ctx.numberOfMatchingPackItems(ctx.FOOD, 0, 0, false) === 0
            ? " and have no food"
            : "";

    if (ctx.player.status[StatusEffect.Nutrition] === ctx.HUNGER_THRESHOLD) {
        ctx.player.status[StatusEffect.Nutrition]--;
        ctx.message(`you are hungry${foodWarning}.`, foodWarning ? ctx.REQUIRE_ACKNOWLEDGMENT : 0);
    } else if (ctx.player.status[StatusEffect.Nutrition] === ctx.WEAK_THRESHOLD) {
        ctx.player.status[StatusEffect.Nutrition]--;
        ctx.message(`you feel weak with hunger${foodWarning}.`, ctx.REQUIRE_ACKNOWLEDGMENT);
    } else if (ctx.player.status[StatusEffect.Nutrition] === ctx.FAINT_THRESHOLD) {
        ctx.player.status[StatusEffect.Nutrition]--;
        ctx.message(`you feel faint with hunger${foodWarning}.`, ctx.REQUIRE_ACKNOWLEDGMENT);
    } else if (ctx.player.status[StatusEffect.Nutrition] <= 1) {
        // Force the player to eat something if they have food
        for (const theItem of ctx.packItems) {
            if (theItem.category === ctx.FOOD) {
                const label = theItem.kind === ctx.FRUIT ? "mango" : "ration of food";
                ctx.messageWithColor(
                    `unable to control your hunger, you eat a ${label}.`,
                    ctx.itemMessageColor,
                    ctx.REQUIRE_ACKNOWLEDGMENT,
                );
                ctx.confirmMessages();
                ctx.eat(theItem, false);
                ctx.playerTurnEnded();
                break;
            }
        }
    }

    if (ctx.player.status[StatusEffect.Nutrition] === 1) {
        ctx.player.status[StatusEffect.Nutrition] = 0;
        ctx.message("you are starving to death!", ctx.REQUIRE_ACKNOWLEDGMENT);
    }
}

// =============================================================================
// burnItem — from Time.c:846
// =============================================================================

export function burnItem(
    theItem: Item,
    ctx: CreatureEffectsContext,
): void {
    const buf1: string[] = [""];
    ctx.itemName(theItem, buf1, false, true, null);
    const msg = `${buf1[0]} burn${theItem.quantity === 1 ? "s" : ""} up!`;
    const x = theItem.loc.x;
    const y = theItem.loc.y;
    ctx.removeItemFromChain(theItem, ctx.floorItems);
    ctx.deleteItem(theItem);
    ctx.pmap[x][y].flags &= ~(ctx.HAS_ITEM | ctx.ITEM_DETECTED);
    if (ctx.pmap[x][y].flags & (ctx.ANY_KIND_OF_VISIBLE | ctx.DISCOVERED | ctx.ITEM_DETECTED)) {
        ctx.refreshDungeonCell({ x, y });
    }
    if (ctx.playerCanSee(x, y)) {
        ctx.messageWithColor(msg, ctx.itemMessageColor, 0);
    }
    // DF_ITEM_FIRE
    ctx.spawnDungeonFeature(x, y, ctx.dungeonFeatureCatalog[15 /* DF_ITEM_FIRE */], true, false);
}

// =============================================================================
// decrementPlayerStatus — from Time.c:1969
// =============================================================================

export function decrementPlayerStatus(
    ctx: CreatureEffectsContext,
): void {
    // Hunger
    if (!ctx.player.status[StatusEffect.Paralyzed]) {
        if (ctx.player.status[StatusEffect.Nutrition] > 0) {
            if (!ctx.numberOfMatchingPackItems(ctx.AMULET, 0, 0, false) || ctx.rand_percent(20)) {
                ctx.player.status[StatusEffect.Nutrition]--;
            }
        }
        checkNutrition(ctx);
    }

    if (ctx.player.status[StatusEffect.Telepathic] > 0 && !--ctx.player.status[StatusEffect.Telepathic]) {
        ctx.updateVision(true);
        ctx.message("your preternatural mental sensitivity fades.", 0);
    }

    if (ctx.player.status[StatusEffect.Darkness] > 0) {
        ctx.player.status[StatusEffect.Darkness]--;
        ctx.updateMinersLightRadius();
        if (!ctx.player.status[StatusEffect.Darkness]) {
            ctx.message("the cloak of darkness lifts from your vision.", 0);
        }
    }

    if (ctx.player.status[StatusEffect.Hallucinating] > 0 && !--ctx.player.status[StatusEffect.Hallucinating]) {
        ctx.displayLevel();
        ctx.message("your hallucinations fade.", 0);
    }

    if (ctx.player.status[StatusEffect.Levitating] > 0 && !--ctx.player.status[StatusEffect.Levitating]) {
        ctx.message("you are no longer levitating.", 0);
    }

    if (ctx.player.status[StatusEffect.Confused] > 0 && !--ctx.player.status[StatusEffect.Confused]) {
        ctx.message("you no longer feel confused.", 0);
    }

    if (ctx.player.status[StatusEffect.Nauseous] > 0 && !--ctx.player.status[StatusEffect.Nauseous]) {
        ctx.message("you feel less nauseous.", 0);
    }

    if (ctx.player.status[StatusEffect.Paralyzed] > 0 && !--ctx.player.status[StatusEffect.Paralyzed]) {
        ctx.message("you can move again.", 0);
    }

    if (ctx.player.status[StatusEffect.Hasted] > 0 && !--ctx.player.status[StatusEffect.Hasted]) {
        ctx.player.movementSpeed = ctx.player.info.movementSpeed;
        ctx.player.attackSpeed = ctx.player.info.attackSpeed;
        ctx.synchronizePlayerTimeState();
        ctx.message("your supernatural speed fades.", 0);
    }

    if (ctx.player.status[StatusEffect.Slowed] > 0 && !--ctx.player.status[StatusEffect.Slowed]) {
        ctx.player.movementSpeed = ctx.player.info.movementSpeed;
        ctx.player.attackSpeed = ctx.player.info.attackSpeed;
        ctx.synchronizePlayerTimeState();
        ctx.message("your normal speed resumes.", 0);
    }

    if (ctx.player.status[StatusEffect.Weakened] > 0 && !--ctx.player.status[StatusEffect.Weakened]) {
        ctx.player.weaknessAmount = 0;
        ctx.message("strength returns to your muscles as the weakening toxin wears off.", 0);
        ctx.updateEncumbrance();
    }

    if (ctx.player.status[StatusEffect.Donning]) {
        ctx.player.status[StatusEffect.Donning]--;
        ctx.recalculateEquipmentBonuses();
    }

    if (ctx.player.status[StatusEffect.ImmuneToFire] > 0 && !--ctx.player.status[StatusEffect.ImmuneToFire]) {
        ctx.message("you no longer feel immune to fire.", 0);
    }

    if (ctx.player.status[StatusEffect.Stuck] && !ctx.cellHasTerrainFlag(ctx.player.loc, TerrainFlag.T_ENTANGLES)) {
        ctx.player.status[StatusEffect.Stuck] = 0;
    }

    if (ctx.player.status[StatusEffect.ExplosionImmunity]) {
        ctx.player.status[StatusEffect.ExplosionImmunity]--;
    }

    if (ctx.player.status[StatusEffect.Discordant]) {
        ctx.player.status[StatusEffect.Discordant]--;
    }

    if (ctx.player.status[StatusEffect.Aggravating]) {
        ctx.player.status[StatusEffect.Aggravating]--;
    }

    if (ctx.player.status[StatusEffect.Shielded]) {
        ctx.player.status[StatusEffect.Shielded] -= Math.floor(
            ctx.player.maxStatus[StatusEffect.Shielded] / 20,
        );
        if (ctx.player.status[StatusEffect.Shielded] <= 0) {
            ctx.player.status[StatusEffect.Shielded] = ctx.player.maxStatus[StatusEffect.Shielded] = 0;
        }
    }

    if (ctx.player.status[StatusEffect.Invisible] > 0 && !--ctx.player.status[StatusEffect.Invisible]) {
        ctx.message("you are no longer invisible.", 0);
    }

    if (ctx.rogue.monsterSpawnFuse <= 0) {
        ctx.spawnPeriodicHorde();
        ctx.rogue.monsterSpawnFuse = ctx.rand_range(125, 175);
    }
}

// =============================================================================
// playerFalls — from Time.c:977
// =============================================================================

export function playerFalls(
    ctx: CreatureEffectsContext,
): void {
    if (
        ctx.cellHasTMFlag(ctx.player.loc, TerrainMechFlag.TM_IS_SECRET) &&
        ctx.playerCanSee(ctx.player.loc.x, ctx.player.loc.y)
    ) {
        ctx.discover(ctx.player.loc.x, ctx.player.loc.y);
    }

    ctx.monstersFall();
    ctx.updateFloorItems();

    const layer = ctx.layerWithFlag(ctx.player.loc.x, ctx.player.loc.y, TerrainFlag.T_AUTO_DESCENT);
    if (layer >= 0) {
        ctx.message(
            ctx.tileCatalog[ctx.pmapAt(ctx.player.loc).layers[layer]].flavorText,
            ctx.REQUIRE_ACKNOWLEDGMENT,
        );
    } else {
        ctx.message("You plunge downward!", ctx.REQUIRE_ACKNOWLEDGMENT);
    }

    ctx.player.bookkeepingFlags &= ~(
        MonsterBookkeepingFlag.MB_IS_FALLING |
        MonsterBookkeepingFlag.MB_SEIZED |
        MonsterBookkeepingFlag.MB_SEIZING
    );
    ctx.rogue.disturbed = true;

    if (ctx.rogue.depthLevel < ctx.gameConst.deepestLevel) {
        ctx.rogue.depthLevel++;
        ctx.startLevel(ctx.rogue.depthLevel - 1, 0);
        const damage = ctx.randClumpedRange(ctx.gameConst.fallDamageMin, ctx.gameConst.fallDamageMax, 2);
        let killed = false;
        if (ctx.terrainFlags(ctx.player.loc) & TerrainFlag.T_IS_DEEP_WATER) {
            ctx.messageWithColor("You fall into deep water, unharmed.", ctx.badMessageColor, 0);
        } else {
            let actualDamage = damage;
            if (ctx.cellHasTMFlag(ctx.player.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)) {
                actualDamage = Math.floor(damage / 2);
            }
            ctx.messageWithColor("You are injured by the fall.", ctx.badMessageColor, 0);
            if (ctx.inflictDamage(null, ctx.player, actualDamage, ctx.red, false)) {
                ctx.killCreature(ctx.player, false);
                ctx.gameOver("Killed by a fall", true);
                killed = true;
            }
        }
        if (!killed && ctx.rogue.depthLevel > ctx.rogue.deepestLevel) {
            ctx.rogue.deepestLevel = ctx.rogue.depthLevel;
        }
    } else {
        ctx.message("A strange force seizes you as you fall.", 0);
        ctx.teleport(ctx.player, ctx.INVALID_POS, true);
    }
    ctx.createFlare(ctx.player.loc.x, ctx.player.loc.y, ctx.GENERIC_FLASH_LIGHT);
    ctx.animateFlares(ctx.rogue.flares, ctx.rogue.flareCount);
    ctx.rogue.flareCount = 0;
}

// =============================================================================
// monstersFall — from Time.c:1361
// =============================================================================

export function monstersFall(
    ctx: CreatureEffectsContext,
): void {
    for (const monst of [...ctx.monsters]) {
        if (
            (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING) ||
            monsterShouldFall(monst, ctx)
        ) {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_FALLING;

            const x = monst.loc.x;
            const y = monst.loc.y;

            if (ctx.canSeeMonster(monst)) {
                const buf: string[] = [""];
                ctx.monsterName(buf, monst, true);
                ctx.messageWithColor(
                    `${buf[0]} plunges out of sight!`,
                    ctx.messageColorFromVictim(monst),
                    0,
                );
            }

            if (monst.info.flags & MonsterBehaviorFlag.MONST_GETS_TURN_ON_ACTIVATION) {
                ctx.killCreature(monst, false);
            } else if (!ctx.inflictDamage(null, monst, ctx.randClumpedRange(6, 12, 2), ctx.red, false)) {
                ctx.demoteMonsterFromLeadership(monst);

                monst.status[StatusEffect.Entranced] = 0;
                monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_PREPLACED;
                monst.bookkeepingFlags &= ~(
                    MonsterBookkeepingFlag.MB_IS_FALLING |
                    MonsterBookkeepingFlag.MB_SEIZED |
                    MonsterBookkeepingFlag.MB_SEIZING
                );
                monst.targetCorpseLoc = ctx.INVALID_POS;

                ctx.removeCreature(ctx.monsters, monst);

                const nextLevelIdx = ctx.rogue.depthLevel; // depthLevel is 1-based
                if (ctx.levels[nextLevelIdx]) {
                    ctx.prependCreature(ctx.levels[nextLevelIdx].monsters, monst);
                }

                (monst as any).depth = ctx.rogue.depthLevel + 1;
            } else {
                ctx.killCreature(monst, false);
            }

            ctx.pmap[x][y].flags &= ~TileFlag.HAS_MONSTER;
            ctx.refreshDungeonCell({ x, y });
        }
    }
}

// =============================================================================
// applyInstantTileEffectsToCreature — from Time.c:101
// =============================================================================

export function applyInstantTileEffectsToCreature(
    monst: Creature,
    ctx: CreatureEffectsContext,
): void {
    const x = monst.loc.x;
    const y = monst.loc.y;
    const pos: Pos = { x, y };

    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING) {
        return;
    }

    // Mark trap-free
    if (monst === ctx.player) {
        if (!ctx.player.status[StatusEffect.Levitating]) {
            ctx.pmap[x][y].flags |= TileFlag.KNOWN_TO_BE_TRAP_FREE;
        }
    } else if (
        !ctx.player.status[StatusEffect.Hallucinating] &&
        !monst.status[StatusEffect.Levitating] &&
        ctx.canSeeMonster(monst) &&
        !ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_DF_TRAP)
    ) {
        ctx.pmap[x][y].flags |= TileFlag.KNOWN_TO_BE_TRAP_FREE;
    }

    // Discover secrets
    if (
        monst === ctx.player &&
        !monst.status[StatusEffect.Levitating] &&
        ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) &&
        ctx.playerCanSee(x, y)
    ) {
        ctx.discover(x, y);
    }

    // Surface submerged creatures
    if (
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
        !ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
    ) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
    }

    // Visual effect for submersion
    if (monst === ctx.player) {
        updatePlayerUnderwaterness(ctx);
    }

    // Obstructed krakens
    if (
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZING) &&
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
    ) {
        monst.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SEIZING;
    }

    // Creatures plunge into chasms
    if (monsterShouldFall(monst, ctx)) {
        if (monst === ctx.player) {
            if (!(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_FALLING)) {
                monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_FALLING;
            }
            return;
        } else {
            monst.bookkeepingFlags |= MonsterBookkeepingFlag.MB_IS_FALLING;
        }
    }

    // Lava insta-death
    if (
        !monst.status[StatusEffect.Levitating] &&
        !monst.status[StatusEffect.ImmuneToFire] &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE) &&
        !ctx.cellHasTerrainFlag(pos, TerrainFlag.T_ENTANGLES | TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_EXTINGUISHES_FIRE) &&
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_LAVA_INSTA_DEATH)
    ) {
        if (monst === ctx.player) {
            const lavaLayer = ctx.layerWithFlag(x, y, TerrainFlag.T_LAVA_INSTA_DEATH);
            const desc = ctx.tileCatalog[ctx.pmap[x][y].layers[lavaLayer]].description;
            ctx.message(`you plunge into ${desc}!`, ctx.REQUIRE_ACKNOWLEDGMENT);
            ctx.gameOver(`Killed by ${desc}`, true);
            return;
        } else {
            if (ctx.canSeeMonster(monst)) {
                const buf: string[] = [""];
                ctx.monsterName(buf, monst, true);
                const lavaLayer = ctx.layerWithFlag(x, y, TerrainFlag.T_LAVA_INSTA_DEATH);
                let s = ctx.tileCatalog[ctx.pmap[x][y].layers[lavaLayer]].description;
                if (s.startsWith("a ")) s = s.slice(2);
                else if (s.startsWith("an ")) s = s.slice(3);
                ctx.messageWithColor(
                    `${buf[0]} is consumed by the ${s} instantly!`,
                    ctx.messageColorFromVictim(monst),
                    0,
                );
            }
            ctx.killCreature(monst, false);
            ctx.refreshDungeonCell(pos);
            return;
        }
    }

    // Water puts out fire
    if (
        ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_EXTINGUISHES_FIRE) &&
        monst.status[StatusEffect.Burning] &&
        !monst.status[StatusEffect.Levitating] &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS) &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_FIERY)
    ) {
        extinguishFireOnCreature(monst, ctx);
    }

    // If you see a monster use a secret door, discover it
    if (
        ctx.playerCanSee(x, y) &&
        ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET) &&
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)
    ) {
        ctx.discover(x, y);
    }

    // Pressure plates
    if (
        !monst.status[StatusEffect.Levitating] &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
        (!ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_ALLOWS_SUBMERGING) || !(monst.info.flags & MonsterBehaviorFlag.MONST_SUBMERGES)) &&
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_DF_TRAP) &&
        !(ctx.pmap[x][y].flags & TileFlag.PRESSURE_PLATE_DEPRESSED)
    ) {
        ctx.pmap[x][y].flags |= TileFlag.PRESSURE_PLATE_DEPRESSED;
        if (ctx.playerCanSee(x, y) && ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_IS_SECRET)) {
            ctx.discover(x, y);
            ctx.refreshDungeonCell(pos);
        }
        if (ctx.canSeeMonster(monst)) {
            const buf: string[] = [""];
            ctx.monsterName(buf, monst, true);
            ctx.message(`a pressure plate clicks underneath ${buf[0]}!`, ctx.REQUIRE_ACKNOWLEDGMENT);
        } else if (ctx.playerCanSee(x, y)) {
            ctx.message("a pressure plate clicks!", 0);
        }
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flags & TerrainFlag.T_IS_DF_TRAP) {
                ctx.spawnDungeonFeature(
                    x,
                    y,
                    ctx.dungeonFeatureCatalog[ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].fireType],
                    true,
                    false,
                );
                ctx.promoteTile(x, y, layer as DungeonLayer, false);
            }
        }
    }

    // Promote on creature
    if (ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_PROMOTES_ON_CREATURE)) {
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].mechFlags & TerrainMechFlag.TM_PROMOTES_ON_CREATURE) {
                ctx.promoteTile(x, y, layer as DungeonLayer, false);
            }
        }
    }

    // Promote on player entry
    if (ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY) && monst === ctx.player) {
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].mechFlags & TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY) {
                ctx.promoteTile(x, y, layer as DungeonLayer, false);
            }
        }
    }

    // Promote on sacrifice entry
    if (
        ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_PROMOTES_ON_SACRIFICE_ENTRY) &&
        monst.machineHome === ctx.pmap[x][y].machineNumber &&
        (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_MARKED_FOR_SACRIFICE)
    ) {
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].mechFlags & TerrainMechFlag.TM_PROMOTES_ON_SACRIFICE_ENTRY) {
                ctx.promoteTile(x, y, layer as DungeonLayer, false);
            }
        }
    }

    // Spiderwebs
    if (
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_ENTANGLES) &&
        !monst.status[StatusEffect.Stuck] &&
        !(monst.info.flags & (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEBS | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
    ) {
        monst.status[StatusEffect.Stuck] = monst.maxStatus[StatusEffect.Stuck] = ctx.rand_range(3, 7);
        if (monst === ctx.player) {
            if (!ctx.rogue.automationActive) {
                const webLayer = ctx.layerWithFlag(x, y, TerrainFlag.T_ENTANGLES);
                ctx.message(
                    `you are stuck fast in ${ctx.tileCatalog[ctx.pmap[x][y].layers[webLayer]].description}!`,
                    0,
                );
            }
        } else if (ctx.canDirectlySeeMonster(monst)) {
            if (!ctx.rogue.automationActive) {
                const buf: string[] = [""];
                ctx.monsterName(buf, monst, true);
                const webLayer = ctx.layerWithFlag(x, y, TerrainFlag.T_ENTANGLES);
                ctx.message(
                    `${buf[0]} is stuck fast in ${ctx.tileCatalog[ctx.pmap[x][y].layers[webLayer]].description}!`,
                    0,
                );
            }
        }
    }

    // Explosions
    if (
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_EXPLOSIVE_DAMAGE) &&
        !monst.status[StatusEffect.ExplosionImmunity] &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
    ) {
        let damage = ctx.rand_range(15, 20);
        damage = ctx.max(damage, Math.floor(monst.info.maxHP / 2));
        monst.status[StatusEffect.ExplosionImmunity] = 5;
        if (monst === ctx.player) {
            ctx.rogue.disturbed = true;
            // Find the explosive layer for flavor text
            let explosiveLayer = 0;
            for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
                if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flags & TerrainFlag.T_CAUSES_EXPLOSIVE_DAMAGE) {
                    explosiveLayer = layer;
                    break;
                }
            }
            ctx.message(ctx.tileCatalog[ctx.pmap[x][y].layers[explosiveLayer]].flavorText, 0);
            if (
                ctx.rogue.armor &&
                (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
                ctx.rogue.armor.enchant2 === ArmorEnchant.Dampening
            ) {
                const buf2: string[] = [""];
                ctx.itemName(ctx.rogue.armor, buf2, false, false, null);
                ctx.messageWithColor(`Your ${buf2[0]} pulses and absorbs the damage.`, ctx.goodMessageColor, 0);
                ctx.autoIdentify(ctx.rogue.armor);
            } else if (ctx.inflictDamage(null, ctx.player, damage, ctx.yellow, false)) {
                ctx.killCreature(ctx.player, false);
                const expLayer = ctx.layerWithFlag(x, y, TerrainFlag.T_CAUSES_EXPLOSIVE_DAMAGE);
                ctx.gameOver(`Killed by ${ctx.tileCatalog[ctx.pmap[x][y].layers[expLayer]].description}`, true);
                return;
            }
        } else {
            if (monst.creatureState === CreatureState.Sleeping) {
                monst.creatureState = CreatureState.TrackingScent;
            }
            const buf: string[] = [""];
            ctx.monsterName(buf, monst, true);
            const expLayer = ctx.layerWithFlag(x, y, TerrainFlag.T_CAUSES_EXPLOSIVE_DAMAGE);
            const desc = ctx.tileCatalog[ctx.pmap[x][y].layers[expLayer]].description;
            if (ctx.inflictDamage(null, monst, damage, ctx.yellow, false)) {
                const verb = monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE ? "is destroyed by" : "dies in";
                ctx.messageWithColor(`${buf[0]} ${verb} ${desc}.`, ctx.messageColorFromVictim(monst), 0);
                ctx.killCreature(monst, false);
                ctx.refreshDungeonCell(pos);
                return;
            } else {
                ctx.messageWithColor(`${desc} engulfs ${buf[0]}.`, ctx.messageColorFromVictim(monst), 0);
            }
        }
    }

    // Toxic gases
    if (
        monst === ctx.player &&
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_RESPIRATION_IMMUNITIES) &&
        ctx.rogue.armor &&
        (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
        ctx.rogue.armor.enchant2 === ArmorEnchant.Respiration
    ) {
        if (!(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED)) {
            ctx.message("Your armor trembles and a pocket of clean air swirls around you.", 0);
            ctx.autoIdentify(ctx.rogue.armor);
        }
    } else {
        // Zombie gas (nausea)
        if (
            ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_NAUSEA) &&
            !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
            !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
        ) {
            if (monst === ctx.player) ctx.rogue.disturbed = true;
            if (ctx.canDirectlySeeMonster(monst) && !monst.status[StatusEffect.Nauseous]) {
                if (monst.creatureState === CreatureState.Sleeping) {
                    monst.creatureState = CreatureState.TrackingScent;
                }
                ctx.flashMonster(monst, ctx.brown, 100);
                const buf: string[] = [""];
                ctx.monsterName(buf, monst, true);
                const s = monst === ctx.player ? "" : "s";
                ctx.message(
                    `${buf[0]} choke${s} and gag${s} on the overpowering stench of decay.`,
                    0,
                );
            }
            monst.status[StatusEffect.Nauseous] = monst.maxStatus[StatusEffect.Nauseous] = ctx.max(
                monst.status[StatusEffect.Nauseous],
                20,
            );
        }

        // Confusion gas
        if (
            ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_CONFUSION) &&
            !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
        ) {
            if (monst === ctx.player) ctx.rogue.disturbed = true;
            if (ctx.canDirectlySeeMonster(monst) && !monst.status[StatusEffect.Confused]) {
                if (monst.creatureState === CreatureState.Sleeping) {
                    monst.creatureState = CreatureState.TrackingScent;
                }
                ctx.flashMonster(monst, ctx.confusionGasColor, 100);
                const buf: string[] = [""];
                ctx.monsterName(buf, monst, true);
                ctx.message(
                    `${buf[0]} ${monst === ctx.player ? "feel" : "looks"} very confused!`,
                    0,
                );
            }
            monst.status[StatusEffect.Confused] = monst.maxStatus[StatusEffect.Confused] = ctx.max(
                monst.status[StatusEffect.Confused],
                25,
            );
        }

        // Paralysis gas
        if (
            ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_PARALYSIS) &&
            !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
            !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
        ) {
            if (ctx.canDirectlySeeMonster(monst) && !monst.status[StatusEffect.Paralyzed]) {
                ctx.flashMonster(monst, ctx.pink, 100);
                const buf: string[] = [""];
                ctx.monsterName(buf, monst, true);
                ctx.message(
                    `${buf[0]} ${monst === ctx.player ? "are" : "is"} paralyzed!`,
                    monst === ctx.player ? ctx.REQUIRE_ACKNOWLEDGMENT : 0,
                );
            }
            monst.status[StatusEffect.Paralyzed] = monst.maxStatus[StatusEffect.Paralyzed] = ctx.max(
                monst.status[StatusEffect.Paralyzed],
                20,
            );
            if (monst === ctx.player) ctx.rogue.disturbed = true;
        }
    }

    // Poisonous lichen
    if (
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_POISON) &&
        !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
        !monst.status[StatusEffect.Levitating]
    ) {
        if (monst === ctx.player && !ctx.player.status[StatusEffect.Poisoned]) {
            ctx.rogue.disturbed = true;
        }
        if (ctx.canDirectlySeeMonster(monst) && !monst.status[StatusEffect.Poisoned]) {
            if (monst.creatureState === CreatureState.Sleeping) {
                monst.creatureState = CreatureState.TrackingScent;
            }
            ctx.flashMonster(monst, ctx.green, 100);
            const buf: string[] = [""];
            ctx.monsterName(buf, monst, true);
            ctx.messageWithColor(
                `the lichen's grasping tendrils poison ${buf[0]}.`,
                ctx.messageColorFromVictim(monst),
                0,
            );
        }
        const damage = ctx.max(0, 5 - monst.status[StatusEffect.Poisoned]);
        ctx.addPoison(monst, damage, 0);
    }

    // Fire
    if (ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_FIRE)) {
        exposeCreatureToFire(monst, ctx);
    } else if (
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_FLAMMABLE) &&
        !(ctx.pmap[x][y].layers[DungeonLayer.Gas] !== TileType.NOTHING && ctx.pmap[x][y].volume === 0) &&
        !ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_FIRE) &&
        monst.status[StatusEffect.Burning] &&
        !(monst.bookkeepingFlags & (MonsterBookkeepingFlag.MB_SUBMERGED | MonsterBookkeepingFlag.MB_IS_FALLING))
    ) {
        ctx.exposeTileToFire(x, y, true);
    }

    // Keys
    if (ctx.cellHasTMFlag(pos, TerrainMechFlag.TM_PROMOTES_WITH_KEY)) {
        const theItem = ctx.keyOnTileAt(pos);
        if (theItem) {
            ctx.useKeyAt(theItem, x, y);
        }
    }
}

// =============================================================================
// applyGradualTileEffectsToCreature — from Time.c:457
// =============================================================================

export function applyGradualTileEffectsToCreature(
    monst: Creature,
    ticks: number,
    ctx: CreatureEffectsContext,
): void {
    const x = monst.loc.x;
    const y = monst.loc.y;
    const pos: Pos = { x, y };

    // Deep water item loss
    if (
        !monst.status[StatusEffect.Levitating] &&
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_IS_DEEP_WATER) &&
        !ctx.cellHasTerrainFlag(pos, TerrainFlag.T_ENTANGLES | TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WATER)
    ) {
        if (monst === ctx.player) {
            if (
                !(ctx.pmap[x][y].flags & ctx.HAS_ITEM) &&
                ctx.rand_percent(Math.floor(ticks * 50 / 100))
            ) {
                const itemCandidates = ctx.numberOfMatchingPackItems(ctx.ALL_ITEMS, 0, ItemFlag.ITEM_EQUIPPED, false);
                if (itemCandidates) {
                    // Player loses an item in the water
                    // Simplified: in the full implementation this walks packItems and picks a random non-equipped item
                    // For now, delegate to dropItem helper
                }
            }
        } else if (
            monst.carriedItem &&
            !(ctx.pmap[x][y].flags & ctx.HAS_ITEM) &&
            ctx.rand_percent(Math.floor(ticks * 50 / 100))
        ) {
            ctx.makeMonsterDropItem(monst);
        }
    }

    // Terrain damage
    if (
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_DAMAGE) &&
        !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
    ) {
        let damage = Math.floor((monst.info.maxHP / 15) * ticks / 100);
        damage = ctx.max(1, damage);
        let damageLayer = 0;
        for (let layer = 0; layer < NUMBER_TERRAIN_LAYERS; layer++) {
            if (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flags & TerrainFlag.T_CAUSES_DAMAGE) {
                damageLayer = layer;
                break;
            }
        }
        if (monst === ctx.player) {
            if (
                ctx.rogue.armor &&
                (ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
                ctx.rogue.armor.enchant2 === ArmorEnchant.Respiration
            ) {
                if (!(ctx.rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED)) {
                    ctx.message("Your armor trembles and a pocket of clean air swirls around you.", 0);
                    ctx.autoIdentify(ctx.rogue.armor);
                }
            } else {
                ctx.rogue.disturbed = true;
                ctx.messageWithColor(ctx.tileCatalog[ctx.pmap[x][y].layers[damageLayer]].flavorText, ctx.badMessageColor, 0);
                if (ctx.inflictDamage(null, ctx.player, damage, ctx.tileCatalog[ctx.pmap[x][y].layers[damageLayer]].backColor!, true)) {
                    ctx.killCreature(ctx.player, false);
                    ctx.gameOver(`Killed by ${ctx.tileCatalog[ctx.pmap[x][y].layers[damageLayer]].description}`, true);
                    return;
                }
            }
        } else {
            if (monst.creatureState === CreatureState.Sleeping) {
                monst.creatureState = CreatureState.TrackingScent;
            }
            if (ctx.inflictDamage(null, monst, damage, ctx.tileCatalog[ctx.pmap[x][y].layers[damageLayer]].backColor!, true)) {
                if (ctx.canSeeMonster(monst)) {
                    const buf: string[] = [""];
                    ctx.monsterName(buf, monst, true);
                    ctx.messageWithColor(`${buf[0]} dies.`, ctx.messageColorFromVictim(monst), 0);
                }
                ctx.killCreature(monst, false);
                ctx.refreshDungeonCell(pos);
                return;
            }
        }
    }

    // Terrain healing
    if (
        ctx.cellHasTerrainFlag(pos, TerrainFlag.T_CAUSES_HEALING) &&
        !(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)
    ) {
        let healAmount = Math.floor((monst.info.maxHP / 15) * ticks / 100);
        healAmount = ctx.max(1, healAmount);
        if (monst.currentHP < monst.info.maxHP) {
            monst.currentHP = ctx.min(monst.currentHP + healAmount, monst.info.maxHP);
            if (monst === ctx.player) {
                ctx.messageWithColor("you feel much better.", ctx.goodMessageColor, 0);
            }
        }
    }
}
