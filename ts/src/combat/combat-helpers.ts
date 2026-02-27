/*
 *  combat-helpers.ts — Remaining combat utility functions
 *  brogue-ts
 *
 *  Ported from: src/brogue/Combat.c
 *  Functions: splitMonster, forceWeaponHit, combatMessage, displayCombatText,
 *             strLenWithoutEscapes, attackVerb, handlePaladinFeat,
 *             playerImmuneToMonster, decrementWeaponAutoIDTimer,
 *             anyoneWantABite, canAbsorb
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, Color, Pos, MonsterClass, CreatureType } from "../types/types.js";
import { StatusEffect, CreatureState, ArmorEnchant } from "../types/enums.js";
import {
    MonsterBehaviorFlag,
    MonsterBookkeepingFlag,
    MonsterAbilityFlag,
    ItemFlag,
    Fl,
    LEARNABLE_ABILITIES,
    LEARNABLE_BEHAVIORS,
} from "../types/flags.js";
import { nbDirs, coordinatesAreInMap } from "../globals/tables.js";

// =============================================================================
// Context for combat helper operations
// =============================================================================

/**
 * Context for combat helper operations.
 */
export interface CombatHelperContext {
    /** The player creature. */
    player: Creature;
    /** Currently equipped weapon. */
    weapon: Item | null;
    /** Currently equipped armor. */
    armor: Item | null;
    /** Player strength. */
    playerStrength: number;

    // ── Creature queries ──
    canSeeMonster(monst: Creature): boolean;
    canDirectlySeeMonster(monst: Creature): boolean;
    monsterName(monst: Creature, includeArticle: boolean): string;
    monstersAreTeammates(monst1: Creature, monst2: Creature): boolean;
    monsterAvoids(monst: Creature, loc: Pos): boolean;
    monsterIsInClass(monst: Creature, monsterClass: MonsterClass): boolean;
    monsterAtLoc(loc: Pos): Creature | null;

    // ── Map queries ──
    /** Check if a cell has a monster or player. */
    cellHasMonsterOrPlayer(loc: Pos): boolean;
    /** Check if position is in map bounds. */
    isPosInMap(loc: Pos): boolean;

    // ── Side effects ──
    message(text: string, flags: number): void;
    combatMessage(text: string, color?: Color | null): void;
    cloneMonster(monst: Creature, selfClone: boolean, maintainCorpse: boolean): Creature | null;
    fadeInMonster(monst: Creature): void;
    refreshSideBar(): void;
    setCellMonsterFlag(loc: Pos, hasMonster: boolean): void;

    // ── RNG ──
    randRange(lo: number, hi: number): number;

    // ── Catalogs ──
    monsterCatalog: readonly CreatureType[];
    monsterClassCatalog: readonly MonsterClass[];

    // ── Rogue state ──
    cautiousMode: boolean;
    setCautiousMode(val: boolean): void;

    // ── Item identification ──
    updateIdentifiableItems(): void;
    messageWithColor(text: string, color: Color): void;
    itemName(item: Item): string;
    itemMessageColor: Color;

    // ── Feat tracking ──
    featRecord: boolean[];
    FEAT_PALADIN: number;

    // ── Ally monster list ──
    iterateAllies(): Creature[];
    /** Iterate all monsters for clone counting. */
    iterateAllMonsters(): Creature[];
    /** Get depth level for clone counting across levels. */
    depthLevel: number;
    deepestLevel: number;
}

// =============================================================================
// strLenWithoutEscapes — from Combat.c:1276
// =============================================================================

/**
 * Calculate string length without color escape sequences.
 * Color escapes are 4 chars: the escape char followed by 3 color values.
 *
 * C: short strLenWithoutEscapes(const char *str)
 *
 * @param str The string to measure.
 * @param colorEscape The escape character (default "\x1b").
 * @returns The visible length of the string.
 */
export function strLenWithoutEscapes(str: string, colorEscape = "\x1b"): number {
    let count = 0;
    let i = 0;
    while (i < str.length) {
        if (str[i] === colorEscape) {
            i += 4; // Skip the escape and 3 color bytes
            continue;
        }
        count++;
        i++;
    }
    return count;
}

// =============================================================================
// Combat message buffering — from Combat.c:1293
// =============================================================================

/**
 * A combat message buffer that accumulates messages during a turn and
 * flushes them at the end. This replaces the global `combatText` buffer
 * from the C code.
 */
export class CombatMessageBuffer {
    private messages: Array<{ text: string; color: Color | null }> = [];

    constructor(_maxCols = 80) {
        // maxCols reserved for future truncation logic
    }

    /**
     * Buffer a combat message.
     * C: void combatMessage(char *theMsg, const color *theColor)
     */
    addMessage(text: string, color: Color | null = null): void {
        this.messages.push({ text, color });
    }

    /**
     * Flush all buffered combat messages.
     * C: void displayCombatText()
     *
     * @param messageFn Function to call for each message.
     * @param cautiousMode Whether to require acknowledgment.
     */
    flush(
        messageFn: (text: string, flags: number) => void,
        cautiousMode: boolean,
    ): void {
        if (this.messages.length === 0) {
            return;
        }

        // Copy and clear before calling message (to avoid recursion)
        const msgs = [...this.messages];
        this.messages = [];

        const FOLDABLE = 1; // Message flag for foldable messages
        const REQUIRE_ACKNOWLEDGMENT = 2;

        for (const msg of msgs) {
            const flags = FOLDABLE | (cautiousMode ? REQUIRE_ACKNOWLEDGMENT : 0);
            messageFn(msg.text, flags);
        }
    }

    /** Check if the buffer has any messages. */
    hasMessages(): boolean {
        return this.messages.length > 0;
    }

    /** Clear the buffer without flushing. */
    clear(): void {
        this.messages = [];
    }
}

// =============================================================================
// handlePaladinFeat — from Combat.c:357
// =============================================================================

/**
 * Check if the player has broken the paladin feat by attacking a creature
 * that wasn't tracking them.
 *
 * C: void handlePaladinFeat(creature *defender)
 *
 * @param defender The creature being attacked.
 * @param ctx Combat helper context.
 */
export function handlePaladinFeat(defender: Creature, ctx: CombatHelperContext): void {
    if (
        ctx.featRecord[ctx.FEAT_PALADIN] &&
        defender.creatureState !== CreatureState.TrackingScent &&
        (ctx.player.status[StatusEffect.Telepathic] || ctx.canSeeMonster(defender)) &&
        !(defender.info.flags & (
            MonsterBehaviorFlag.MONST_INANIMATE |
            MonsterBehaviorFlag.MONST_ALWAYS_USE_ABILITY | // MONST_TURRET
            MonsterBehaviorFlag.MONST_IMMOBILE |
            MonsterBehaviorFlag.MONST_INVULNERABLE
        )) &&
        !(ctx.player.bookkeepingFlags & MonsterBookkeepingFlag.MB_SEIZED) &&
        defender !== ctx.player
    ) {
        ctx.featRecord[ctx.FEAT_PALADIN] = false;
    }
}

// =============================================================================
// playerImmuneToMonster — from Combat.c:369
// =============================================================================

/**
 * Check if the player is immune to a monster due to armor of immunity.
 *
 * C: static boolean playerImmuneToMonster(creature *monst)
 *
 * @param monst The monster to check.
 * @param ctx Combat helper context.
 * @returns True if player is immune to this monster.
 */
export function playerImmuneToMonster(monst: Creature, ctx: CombatHelperContext): boolean {
    if (
        monst !== ctx.player &&
        ctx.armor &&
        (ctx.armor.flags & ItemFlag.ITEM_RUNIC) &&
        ctx.armor.enchant2 === ArmorEnchant.Immunity &&
        ctx.monsterIsInClass(monst, ctx.monsterClassCatalog[ctx.armor.vorpalEnemy])
    ) {
        return true;
    }
    return false;
}

// =============================================================================
// decrementWeaponAutoIDTimer — from Combat.c:983
// =============================================================================

/**
 * Decrement the weapon auto-identification timer. When it reaches 0,
 * the weapon is automatically identified.
 *
 * C: static void decrementWeaponAutoIDTimer()
 *
 * @param ctx Combat helper context.
 */
export function decrementWeaponAutoIDTimer(ctx: CombatHelperContext): void {
    if (
        ctx.weapon &&
        !(ctx.weapon.flags & ItemFlag.ITEM_IDENTIFIED) &&
        !--ctx.weapon.charges
    ) {
        ctx.weapon.flags |= ItemFlag.ITEM_IDENTIFIED;
        ctx.updateIdentifiableItems();
        ctx.messageWithColor(
            "you are now familiar enough with your weapon to identify it.",
            ctx.itemMessageColor,
        );
        const weaponName = ctx.itemName(ctx.weapon);
        const verb = ctx.weapon.quantity > 1 ? "they are" : "it is";
        ctx.messageWithColor(`${verb} ${weaponName}.`, ctx.itemMessageColor);
    }
}

// =============================================================================
// attackVerb — from Combat.c:788
// =============================================================================

/** Placeholder monster text type. */
interface MonsterText {
    attack: string[];
}

/**
 * Get the attack verb for a given hit percentile.
 * Uses the monster's attack text array to select verb based on damage.
 *
 * C: static void attackVerb(char returnString[DCOLS], creature *attacker, short hitPercentile)
 *
 * @param attacker The attacking creature.
 * @param hitPercentile The damage percentile (0-100).
 * @param monsterTextTable The monster text table.
 * @param ctx Combat helper context.
 * @returns The attack verb string.
 */
export function attackVerb(
    attacker: Creature,
    hitPercentile: number,
    monsterTextTable: readonly MonsterText[],
    ctx: CombatHelperContext,
): string {
    // If the player can't see or is hallucinating, use generic
    if (
        attacker !== ctx.player &&
        (ctx.player.status[StatusEffect.Hallucinating] || !ctx.canSeeMonster(attacker))
    ) {
        return "hits";
    }

    // Unarmed player
    if (attacker === ctx.player && !ctx.weapon) {
        return "punch";
    }

    const monsterText = monsterTextTable[attacker.info.monsterID];
    if (!monsterText || !monsterText.attack || monsterText.attack.length === 0) {
        return "hits";
    }

    // Count non-empty attack verbs
    let verbCount = 0;
    for (let i = 0; i < 4 && i + 1 < monsterText.attack.length && monsterText.attack[i + 1]; i++) {
        verbCount++;
    }

    const increment = Math.floor(100 / (verbCount + 1));
    const clampedPercentile = Math.max(0, Math.min(hitPercentile, increment * (verbCount + 1) - 1));
    const verbIndex = Math.floor(clampedPercentile / increment);

    return monsterText.attack[verbIndex] || "hits";
}

// =============================================================================
// alliedCloneCount (private helper) — from Combat.c:167
// =============================================================================

/**
 * Count the number of allied clones of a monster across all levels.
 *
 * C: static short alliedCloneCount(creature *monst)
 */
function alliedCloneCount(monst: Creature, ctx: CombatHelperContext): number {
    let count = 0;
    for (const temp of ctx.iterateAllMonsters()) {
        if (
            temp !== monst &&
            temp.info.monsterID === monst.info.monsterID &&
            ctx.monstersAreTeammates(temp, monst)
        ) {
            count++;
        }
    }
    return count;
}

// =============================================================================
// addMonsterToContiguousMonsterGrid (private helper) — from Combat.c:148
// =============================================================================

/**
 * Recursively add all contiguous teammates to a grid.
 *
 * C: static void addMonsterToContiguousMonsterGrid(...)
 */
function addMonsterToContiguousMonsterGrid(
    x: number,
    y: number,
    monst: Creature,
    grid: boolean[][],
    ctx: CombatHelperContext,
): void {
    grid[x][y] = true;
    for (let dir = 0; dir < 4; dir++) {
        const newX = x + nbDirs[dir][0];
        const newY = y + nbDirs[dir][1];
        if (coordinatesAreInMap(newX, newY) && !grid[newX][newY]) {
            const tempMonst = ctx.monsterAtLoc({ x: newX, y: newY });
            if (tempMonst && ctx.monstersAreTeammates(monst, tempMonst)) {
                addMonsterToContiguousMonsterGrid(newX, newY, monst, grid, ctx);
            }
        }
    }
}

// =============================================================================
// splitMonster — from Combat.c:208
// =============================================================================

/** Grid dimensions. */
const DCOLS = 79; // Default, will be parameterized via context if needed
const DROWS = 29;

/**
 * Split a monster (jelly) into two when attacked.
 * The split only occurs if there's an eligible adjacent location.
 *
 * C: void splitMonster(creature *monst, creature *attacker)
 *
 * @param monst The monster being split.
 * @param attacker The attacker.
 * @param ctx Combat helper context.
 */
export function splitMonster(monst: Creature, attacker: Creature, ctx: CombatHelperContext): void {
    if (
        (monst.info.abilityFlags & MonsterAbilityFlag.MA_CLONE_SELF_ON_DEFEND) &&
        alliedCloneCount(monst, ctx) < 100 &&
        monst.currentHP > 0 &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_IS_DYING)
    ) {
        // OK, proceed
    } else {
        return;
    }

    // If the attacker is adjacent, include their position in the contiguous group
    let attackerLoc: Pos | null = null;
    const dx = monst.loc.x - attacker.loc.x;
    const dy = monst.loc.y - attacker.loc.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        attackerLoc = attacker.loc;
    }

    // Create the grids
    const monsterGrid: boolean[][] = Array.from({ length: DCOLS }, () => Array(DROWS).fill(false));
    const eligibleGrid: boolean[][] = Array.from({ length: DCOLS }, () => Array(DROWS).fill(false));

    // Add the attacker location to the contiguous group
    if (attackerLoc && ctx.isPosInMap(attackerLoc)) {
        monsterGrid[attackerLoc.x][attackerLoc.y] = true;
    }

    // Find the contiguous group of monsters
    addMonsterToContiguousMonsterGrid(monst.loc.x, monst.loc.y, monst, monsterGrid, ctx);

    // Find eligible edges around the group
    let eligibleLocationCount = 0;
    for (let i = 0; i < DCOLS; i++) {
        for (let j = 0; j < DROWS; j++) {
            if (monsterGrid[i][j]) {
                for (let dir = 0; dir < 4; dir++) {
                    const newX = i + nbDirs[dir][0];
                    const newY = j + nbDirs[dir][1];
                    if (
                        coordinatesAreInMap(newX, newY) &&
                        !eligibleGrid[newX][newY] &&
                        !monsterGrid[newX][newY] &&
                        !ctx.cellHasMonsterOrPlayer({ x: newX, y: newY }) &&
                        !ctx.monsterAvoids(monst, { x: newX, y: newY })
                    ) {
                        eligibleGrid[newX][newY] = true;
                        eligibleLocationCount++;
                    }
                }
            }
        }
    }

    // Pick a random location on the eligible grid and add the clone there
    if (eligibleLocationCount > 0) {
        let randIndex = ctx.randRange(1, eligibleLocationCount);
        for (let i = 0; i < DCOLS; i++) {
            for (let j = 0; j < DROWS; j++) {
                if (eligibleGrid[i][j] && --randIndex === 0) {
                    const monstName = ctx.monsterName(monst, true);
                    monst.currentHP = Math.floor((monst.currentHP + 1) / 2);

                    const clone = ctx.cloneMonster(monst, false, false);
                    if (!clone) return;

                    // Split monsters don't inherit learned abilities
                    const catalogEntry = ctx.monsterCatalog[clone.info.monsterID];
                    if (catalogEntry) {
                        clone.info.flags &= catalogEntry.flags;
                        clone.info.abilityFlags &= catalogEntry.abilityFlags;
                        // Reset bolts to catalog defaults
                        for (let b = 0; b < clone.info.bolts.length; b++) {
                            clone.info.bolts[b] = catalogEntry.bolts[b] ?? 0;
                        }
                    }

                    // Non-flying clones don't maintain levitation
                    if (
                        !(clone.info.flags & MonsterBehaviorFlag.MONST_FLIES) &&
                        clone.status[StatusEffect.Levitating] === 1000
                    ) {
                        clone.status[StatusEffect.Levitating] = 0;
                    }

                    clone.loc = { x: i, y: j };
                    ctx.setCellMonsterFlag({ x: i, y: j }, true);
                    clone.ticksUntilTurn = Math.max(clone.ticksUntilTurn, 101);
                    ctx.fadeInMonster(clone);
                    ctx.refreshSideBar();

                    if (ctx.canDirectlySeeMonster(monst)) {
                        ctx.message(`${monstName} splits in two!`, 0);
                    }

                    return;
                }
            }
        }
    }
}

// =============================================================================
// anyoneWantABite — from Combat.c:1401
// =============================================================================

/**
 * Check if any ally wants to absorb the abilities of the decedent.
 * This is the absorption mechanic for allied monsters.
 *
 * C: static boolean anyoneWantABite(creature *decedent)
 *
 * @param decedent The creature that just died.
 * @param ctx Combat helper context.
 * @returns True if an ally has been assigned to absorb the decedent.
 */
export function anyoneWantABite(decedent: Creature, ctx: CombatHelperContext): boolean {
    // Skip if there's nothing learnable
    if (
        (!(decedent.info.abilityFlags & LEARNABLE_ABILITIES) &&
         !(decedent.info.flags & LEARNABLE_BEHAVIORS) &&
         (!decedent.info.bolts || decedent.info.bolts[0] === 0)) ||
        (decedent.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_IMMOBILE))
    ) {
        return false;
    }

    const allies = ctx.iterateAllies();
    let candidates = 0;

    // First pass: count eligible allies
    for (const ally of allies) {
        if (canAbsorb(ally, decedent, ctx)) {
            candidates++;
        }
    }

    if (candidates <= 0) {
        return false;
    }

    // Second pass: pick a random ally
    let randIndex = ctx.randRange(1, candidates);
    let firstAlly: Creature | null = null;
    for (const ally of allies) {
        if (canAbsorb(ally, decedent, ctx) && --randIndex === 0) {
            firstAlly = ally;
            break;
        }
    }

    if (!firstAlly) {
        return false;
    }

    // Assign the ally to absorb the corpse
    firstAlly.targetCorpseLoc = { ...decedent.loc };
    firstAlly.targetCorpseName = decedent.info.monsterName;
    firstAlly.corpseAbsorptionCounter = 20;

    // Choose a superpower
    let success = false;

    // First try learnable ability or behavior flags
    candidates = 0;
    for (let i = 0; i < 32; i++) {
        if (Fl(i) & ~firstAlly.info.abilityFlags & decedent.info.abilityFlags & LEARNABLE_ABILITIES) {
            candidates++;
        }
    }
    for (let i = 0; i < 32; i++) {
        if (Fl(i) & ~firstAlly.info.flags & decedent.info.flags & LEARNABLE_BEHAVIORS) {
            candidates++;
        }
    }

    if (candidates > 0) {
        randIndex = ctx.randRange(1, candidates);
        for (let i = 0; i < 32; i++) {
            if (
                (Fl(i) & ~firstAlly.info.abilityFlags & decedent.info.abilityFlags & LEARNABLE_ABILITIES) &&
                --randIndex === 0
            ) {
                firstAlly.absorptionFlags = Fl(i);
                firstAlly.absorbBehavior = false;
                success = true;
                break;
            }
        }
        if (!success) {
            for (let i = 0; i < 32; i++) {
                if (
                    (Fl(i) & ~firstAlly.info.flags & decedent.info.flags & LEARNABLE_BEHAVIORS) &&
                    --randIndex === 0
                ) {
                    firstAlly.absorptionFlags = Fl(i);
                    firstAlly.absorbBehavior = true;
                    success = true;
                    break;
                }
            }
        }
    } else if (decedent.info.bolts && decedent.info.bolts[0] !== 0) {
        // Try learnable bolts
        const ourBolts = new Set<number>();
        for (const b of firstAlly.info.bolts) {
            if (b !== 0) ourBolts.add(b);
        }

        candidates = 0;
        for (const b of decedent.info.bolts) {
            if (b !== 0 && !ourBolts.has(b)) {
                candidates++;
            }
        }

        if (candidates > 0) {
            randIndex = ctx.randRange(1, candidates);
            for (const b of decedent.info.bolts) {
                if (b !== 0 && !ourBolts.has(b) && --randIndex === 0) {
                    firstAlly.absorptionBolt = b;
                    success = true;
                    break;
                }
            }
        }
    }

    return success;
}

/**
 * Check if an ally can absorb abilities from a prey creature.
 *
 * C: static boolean canAbsorb(creature *ally, boolean ourBolts[], creature *prey, short **grid)
 *
 * @param ally The ally creature.
 * @param prey The dead creature to absorb from.
 * @param ctx Combat helper context.
 * @returns True if the ally can absorb from prey.
 */
function canAbsorb(ally: Creature, prey: Creature, ctx: CombatHelperContext): boolean {
    if (
        ally.creatureState !== CreatureState.Ally ||
        ally.newPowerCount <= 0 ||
        ctx.isPosInMap(ally.targetCorpseLoc) ||
        (ally.info.flags | prey.info.flags) & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_IMMOBILE) ||
        ctx.monsterAvoids(ally, prey.loc)
    ) {
        return false;
    }

    // Check for learnable abilities
    if (~ally.info.abilityFlags & prey.info.abilityFlags & LEARNABLE_ABILITIES) {
        return true;
    }

    // Check for learnable behaviors
    if (~ally.info.flags & prey.info.flags & LEARNABLE_BEHAVIORS) {
        return true;
    }

    // Check for learnable bolts
    if (prey.info.bolts) {
        const ourBolts = new Set<number>();
        for (const b of ally.info.bolts) {
            if (b !== 0) ourBolts.add(b);
        }
        for (const b of prey.info.bolts) {
            if (b !== 0 && !ourBolts.has(b)) {
                return true;
            }
        }
    }

    return false;
}
