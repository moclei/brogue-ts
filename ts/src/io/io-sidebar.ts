/*
 *  io-sidebar.ts — Sidebar rendering (entity list, progress bars, detail panels)
 *  brogue-ts
 *
 *  Ported from: src/brogue/IO.c
 *  Functions: refreshSideBar, printMonsterInfo, printItemInfo, printTerrainInfo,
 *             printProgressBar, printMonsterDetails, printFloorItemDetails,
 *             printCarriedItemDetails, creatureHealthChangePercent,
 *             smoothHiliteGradient
 *
 *  The sidebar lists visible creatures, items, and terrain features sorted by
 *  distance from the player, with health bars and status effects for monsters.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, ScreenDisplayBuffer, WindowPos, Pos, Creature, Item, Pcell, FloorTileType } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { StatusEffect, CreatureState, DungeonLayer } from "../types/enums.js";
import {
    COLS, ROWS, DCOLS, DROWS,
    STOMACH_SIZE, HUNGER_THRESHOLD, WEAK_THRESHOLD, FAINT_THRESHOLD,
} from "../types/constants.js";
import { TileFlag, ItemFlag } from "../types/flags.js";
import { MonsterBehaviorFlag, MonsterBookkeepingFlag, TerrainMechFlag } from "../types/flags.js";
import { clamp } from "../math/rng.js";
import {
    black, white, gray, darkGray, red,
    blueBar, redBar, darkPurple, badMessageColor, pink, darkPink,
    itemColor, playerInShadowColor, playerInLightColor,
    flavorTextColor,
} from "../globals/colors.js";
import { strLenWithoutEscapes, wrapText, printString, printStringWithWrapping } from "./io-text.js";
import { encodeMessageColor } from "./io-color.js";
import {
    applyColorAverage, applyColorAugment, applyColorBounds, applyColorScalar,
} from "./io-color.js";
import { plotCharWithColor, highlightScreenCell } from "./io-appearance.js";
import { coordinatesAreInMap } from "../globals/tables.js";

// =============================================================================
// Types
// =============================================================================

/** Entity types that can appear in the sidebar. C: `enum entityDisplayTypes` */
export enum EntityDisplayType {
    Nothing = 0,
    Creature,
    Item,
    Terrain,
}

/** An entry in the sidebar's entity list (used internally during rendering). */
export interface SidebarEntity {
    type: EntityDisplayType;
    creature?: Creature;
    item?: Item;
    terrainDescription?: string;
    x: number;
    y: number;
}

// =============================================================================
// DI Context
// =============================================================================

/**
 * DI context for sidebar rendering.
 * Pure sidebar logic operates on this context — no global state.
 */
export interface SidebarContext {
    rogue: {
        gameHasEnded: boolean;
        playbackFastForward: boolean;
        playbackMode: boolean;
        playbackOmniscience: boolean;
        playbackOOS: boolean;
        playbackPaused: boolean;
        playerTurnNumber: number;
        howManyTurns: number;
        depthLevel: number;
        strength: number;
        gold: number;
        stealthRange: number;
        sidebarLocationList: Pos[];
        armor: Item | null;
        trueColorMode: boolean;
    };
    player: Creature;
    pmap: Pcell[][];
    tileCatalog: readonly FloorTileType[];
    displayBuffer: ScreenDisplayBuffer;

    // Status effect catalog
    statusEffectCatalog: readonly { name: string }[];
    // Mutation catalog
    mutationCatalog: readonly { title: string; textColor: Color }[];
    // Monster text (for absorbStatus)
    monsterText: readonly { absorbStatus: string }[];

    // Entity lookup
    monsterAtLoc(loc: Pos): Creature | null;
    itemAtLoc(loc: Pos): Item | null;
    canSeeMonster(monst: Creature): boolean;
    canDirectlySeeMonster(monst: Creature): boolean;
    playerCanSeeOrSense(x: number, y: number): boolean;
    playerCanDirectlySee(x: number, y: number): boolean;
    playerInDarkness(): boolean;

    // Monster iteration
    iterateMonsters(): Creature[];

    // Floor items list
    floorItems(): Item[];

    // Naming
    monsterName(monst: Creature, includeArticle: boolean): string;
    itemName(theItem: Item, includeDetails: boolean, includeArticle: boolean, titleColor?: Readonly<Color>): string;

    // Item helpers
    getHallucinatedItemCategory(): number;
    getItemCategoryGlyph(category: number): DisplayGlyph;
    describeHallucinatedItem(): string;

    // Cell appearance
    getCellAppearance(loc: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color };

    // Armor
    displayedArmorValue(): number;
    estimatedArmorValue(): number;

    // Layer queries
    cellHasTMFlag(loc: Pos, flag: number): boolean;
    layerWithTMFlag(x: number, y: number, flag: number): DungeonLayer;

    // Text detail functions (may be stubs until ported)
    monsterDetails(monst: Creature): string;
    itemDetails(theItem: Item): string;

    // Rendering helpers
    printTextBox(text: string, x: number, y: number, width: number,
                 foreColor: Readonly<Color>, backColor: Readonly<Color>): number;
    printProgressBar(x: number, y: number, label: string,
                     amtFilled: number, amtMax: number,
                     fillColor: Readonly<Color>, dim: boolean): void;
}

// =============================================================================
// SIDEBAR_WIDTH — the sidebar is 20 columns wide
// =============================================================================

export const SIDEBAR_WIDTH = 20;

// =============================================================================
// smoothHiliteGradient — from Buttons.c:32
// =============================================================================

/**
 * Compute a smooth (sinusoidal) highlight gradient value at position `current`
 * within a range of `max`. Returns 0–100.
 *
 * C: `smoothHiliteGradient` in Buttons.c
 */
export function smoothHiliteGradient(current: number, max: number): number {
    if (max <= 0) return 0;
    return Math.trunc(100 * Math.sin(Math.PI * current / max));
}

// =============================================================================
// creatureHealthChangePercent — from IO.c:4480
// =============================================================================

/**
 * Returns the percentage change in a creature's health since last turn.
 * Ignores over-healing from transference.
 *
 * C: `creatureHealthChangePercent` (static) in IO.c
 */
export function creatureHealthChangePercent(monst: Creature): number {
    if (monst.previousHealthPoints <= 0) {
        return 0;
    }
    // Ignore overhealing from transference
    return Math.trunc(
        100 * (monst.currentHP - Math.min(monst.previousHealthPoints, monst.info.maxHP)) / monst.info.maxHP
    );
}

// =============================================================================
// printProgressBar — from IO.c:4409
// =============================================================================

/**
 * Render a 20-column progress bar at (x, y) directly into the display buffer.
 * The bar displays `label` centered on alternating-shade cells, filled from
 * left to right proportional to amtFilled / amtMax.
 *
 * C: `printProgressBar` in IO.c
 */
export function printProgressBar(
    x: number,
    y: number,
    label: string,
    amtFilled: number,
    amtMax: number,
    fillColor: Readonly<Color>,
    dim: boolean,
    displayBuffer: ScreenDisplayBuffer,
): void {
    if (y >= ROWS - 1) return; // don't write over the depth number

    let filled = amtFilled;
    let max = amtMax;

    if (filled > max) filled = max;
    if (max <= 0) max = 1;

    // Compute progress bar color with alternating row shading
    let progressBarColor: Color = { ...fillColor };
    if (!(y % 2)) {
        applyColorAverage(progressBarColor, black, 25);
    }
    if (dim) {
        applyColorAverage(progressBarColor, black, 50);
    }
    const darkenedBarColor: Color = { ...progressBarColor };
    applyColorAverage(darkenedBarColor, black, 75);

    // Build the bar label text, centered in 20 chars
    const barText = "                    ".split(""); // 20 spaces
    const labelOffset = Math.trunc((SIDEBAR_WIDTH - label.length) / 2);
    for (let i = 0; i < label.length; i++) {
        if (i + labelOffset >= 0 && i + labelOffset < SIDEBAR_WIDTH) {
            barText[i + labelOffset] = label[i];
        }
    }

    filled = clamp(filled, 0, max);

    // Scale up to avoid integer division issues
    if (max < 10000000) {
        filled *= 100;
        max *= 100;
    }

    for (let i = 0; i < SIDEBAR_WIDTH; i++) {
        const fillThreshold = Math.trunc(SIDEBAR_WIDTH * filled / max);
        let currentFillColor: Color;
        if (i <= fillThreshold) {
            currentFillColor = { ...progressBarColor };
        } else {
            currentFillColor = { ...darkenedBarColor };
        }
        if (i === fillThreshold && max > 0) {
            const remainder = (filled % Math.trunc(max / SIDEBAR_WIDTH));
            const divisor = Math.trunc(max / SIDEBAR_WIDTH);
            if (divisor > 0) {
                applyColorAverage(currentFillColor, black, 75 - Math.trunc(75 * remainder / divisor));
            }
        }

        const textColor: Color = dim ? { ...gray } : { ...white };
        applyColorAverage(textColor, currentFillColor, dim ? 50 : 33);

        plotCharWithColor(
            barText[i].charCodeAt(0) as DisplayGlyph,
            { windowX: x + i, windowY: y },
            textColor,
            currentFillColor,
            displayBuffer,
        );
    }
}

// =============================================================================
// Hallucination strings for monster sidebar
// =============================================================================

const HALLUCINATION_STRINGS: readonly string[] = [
    "     (Dancing)      ",
    "     (Singing)      ",
    "  (Pontificating)   ",
    "     (Skipping)     ",
    "     (Spinning)     ",
    "      (Crying)      ",
    "     (Laughing)     ",
    "     (Humming)      ",
    "    (Whistling)     ",
    "    (Quivering)     ",
    "    (Muttering)     ",
    "    (Gibbering)     ",
    "     (Giggling)     ",
    "     (Moaning)      ",
    "    (Shrieking)     ",
    "   (Caterwauling)   ",
];

// =============================================================================
// printMonsterInfo — from IO.c:4489
// =============================================================================

/**
 * Render sidebar info for a single creature. Returns the y-coordinate
 * after the last line printed.
 *
 * C: `printMonsterInfo` in IO.c
 */
export function printMonsterInfo(
    monst: Creature,
    y: number,
    dim: boolean,
    highlight: boolean,
    ctx: SidebarContext,
): number {
    if (y >= ROWS - 1) return ROWS - 1;

    const initialY = y;

    if (y < ROWS - 1) {
        // Blank line
        printString("                    ", 0, y, white, black, ctx.displayBuffer);

        // Get the cell appearance, temporarily removing IS_IN_PATH flag
        const inPath = !!(ctx.pmap[monst.loc.x][monst.loc.y].flags & TileFlag.IS_IN_PATH);
        ctx.pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.IS_IN_PATH;
        const appearance = ctx.getCellAppearance(monst.loc);
        let monstForeColor: Color = { ...appearance.foreColor };
        let monstBackColor: Color = { ...appearance.backColor };
        applyColorBounds(monstForeColor, 0, 100);
        applyColorBounds(monstBackColor, 0, 100);
        if (inPath) {
            ctx.pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.IS_IN_PATH;
        }

        if (dim) {
            applyColorAverage(monstForeColor, black, 50);
            applyColorAverage(monstBackColor, black, 50);
        } else if (highlight) {
            applyColorAugment(monstForeColor, black, 100);
            applyColorAugment(monstBackColor, black, 100);
        }

        plotCharWithColor(appearance.glyph, { windowX: 0, windowY: y }, monstForeColor, monstBackColor, ctx.displayBuffer);

        if (monst.carriedItem) {
            plotCharWithColor(monst.carriedItem.displayChar, { windowX: 1, windowY: y }, itemColor, black, ctx.displayBuffer);
        }

        let monstName = ctx.monsterName(monst, false);
        monstName = monstName.charAt(0).toUpperCase() + monstName.slice(1);

        if (monst === ctx.player) {
            const colorEsc = encodeMessageColor(monstForeColor);
            monstName += colorEsc;
            if (ctx.player.status[StatusEffect.Invisible]) {
                monstName += "(invisible)";
            } else if (ctx.playerInDarkness()) {
                monstName += "(dark)";
            } else if (!(ctx.pmap[ctx.player.loc.x][ctx.player.loc.y].flags & TileFlag.IS_IN_SHADOW)) {
                monstName += "(lit)";
            }
        }

        const buf = `: ${monstName}`;
        printString(buf, monst.carriedItem ? 2 : 1, y++, dim ? gray : white, black, ctx.displayBuffer);
    }

    // Mutation, if any
    if (
        y < ROWS - 1 &&
        monst.mutationIndex >= 0 &&
        (!ctx.player.status[StatusEffect.Hallucinating] || ctx.rogue.playbackOmniscience)
    ) {
        let buf = "                    "; // 20 spaces
        const mutation = ctx.mutationCatalog[monst.mutationIndex];
        const tempColor: Color = { ...mutation.textColor };
        if (dim) {
            applyColorAverage(tempColor, black, 50);
        }
        const colorEsc = encodeMessageColor(tempColor);
        let buf2 = `${colorEsc}(${mutation.title})`;

        const visLen = strLenWithoutEscapes(buf);
        const mutLen = strLenWithoutEscapes(buf2);
        const offset = Math.trunc((visLen - mutLen) / 2);

        // Center the mutation text within the 20-char field
        buf = buf.substring(0, offset) + buf2;
        // Pad to 20+4 chars (4 for color escape)
        while (buf.length < 24) {
            buf += " ";
        }
        buf = buf.substring(0, 24);

        printString(buf, 0, y++, dim ? gray : white, black, ctx.displayBuffer);
    }

    // Health bar
    if (monst.info.maxHP > 1 && !(monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        let healthBarColor: Color;
        if (monst === ctx.player) {
            healthBarColor = { ...redBar };
            applyColorAverage(healthBarColor, blueBar, Math.min(100, Math.trunc(100 * ctx.player.currentHP / ctx.player.info.maxHP)));
        } else {
            healthBarColor = { ...blueBar };
        }

        const percent = creatureHealthChangePercent(monst);
        let healthLabel: string;
        if (monst.currentHP <= 0) {
            healthLabel = "Dead";
        } else if (percent !== 0) {
            const percentStr = `(${percent > 0 ? "+" : ""}${percent}%)`;
            healthLabel = "       Health       ";
            healthLabel = healthLabel.substring(0, SIDEBAR_WIDTH - percentStr.length) + percentStr;
        } else {
            healthLabel = "Health";
        }

        printProgressBar(0, y++, healthLabel, monst.currentHP, monst.info.maxHP, healthBarColor, dim, ctx.displayBuffer);
    }

    // Player-specific bars
    if (monst === ctx.player) {
        // Nutrition
        if (ctx.player.status[StatusEffect.Nutrition] > HUNGER_THRESHOLD) {
            printProgressBar(0, y++, "Nutrition", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (ctx.player.status[StatusEffect.Nutrition] > WEAK_THRESHOLD) {
            printProgressBar(0, y++, "Nutrition (Hungry)", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (ctx.player.status[StatusEffect.Nutrition] > FAINT_THRESHOLD) {
            printProgressBar(0, y++, "Nutrition (Weak)", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (ctx.player.status[StatusEffect.Nutrition] > 0) {
            printProgressBar(0, y++, "Nutrition (Faint)", ctx.player.status[StatusEffect.Nutrition], STOMACH_SIZE, blueBar, dim, ctx.displayBuffer);
        } else if (y < ROWS - 1) {
            printString("      STARVING      ", 0, y++, badMessageColor, black, ctx.displayBuffer);
        }
    }

    // Status effects
    if (!ctx.player.status[StatusEffect.Hallucinating] || ctx.rogue.playbackOmniscience || monst === ctx.player) {
        for (let i = 0; i < StatusEffect.NumberOfStatusEffects; i++) {
            if (y >= ROWS - 1) break;

            if (i === StatusEffect.Weakened && monst.status[i] > 0) {
                const label = `${ctx.statusEffectCatalog[StatusEffect.Weakened].name}${monst.weaknessAmount}`;
                printProgressBar(0, y++, label, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            } else if (i === StatusEffect.Levitating && monst.status[i] > 0) {
                const label = monst === ctx.player ? "Levitating" : "Flying";
                printProgressBar(0, y++, label, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            } else if (i === StatusEffect.Poisoned && monst.status[i] > 0) {
                let poisonLabel: string;
                if (monst.status[i] * monst.poisonAmount >= monst.currentHP) {
                    poisonLabel = "Fatal Poison";
                } else {
                    poisonLabel = "Poisoned";
                }
                if (monst.poisonAmount === 1) {
                    printProgressBar(0, y++, poisonLabel, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
                } else {
                    printProgressBar(0, y++, `${poisonLabel} (x${monst.poisonAmount})`, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
                }
            } else if (ctx.statusEffectCatalog[i].name.length > 0 && monst.status[i] > 0) {
                printProgressBar(0, y++, ctx.statusEffectCatalog[i].name, monst.status[i], monst.maxStatus[i], redBar, dim, ctx.displayBuffer);
            }
        }

        // Corpse absorption
        if (
            monst.targetCorpseLoc.x === monst.loc.x &&
            monst.targetCorpseLoc.y === monst.loc.y
        ) {
            printProgressBar(
                0, y++,
                ctx.monsterText[monst.info.monsterID].absorbStatus,
                monst.corpseAbsorptionCounter, 20, redBar, dim, ctx.displayBuffer,
            );
        }
    }

    // Player stats line (str/armor, gold, stealth)
    if (monst === ctx.player) {
        if (y < ROWS - 1) {
            let tempColorEsc = "";
            let grayColorEsc = "";
            if (ctx.player.status[StatusEffect.Weakened]) {
                const tempColor: Color = { ...red };
                if (dim) {
                    applyColorAverage(tempColor, black, 50);
                }
                tempColorEsc = encodeMessageColor(tempColor);
                grayColorEsc = encodeMessageColor(dim ? darkGray : gray);
            }

            let armorBuf: string;
            if (!ctx.rogue.armor || (ctx.rogue.armor.flags & ItemFlag.ITEM_IDENTIFIED) || ctx.rogue.playbackOmniscience) {
                armorBuf = `Str: ${tempColorEsc}${ctx.rogue.strength - ctx.player.weaknessAmount}${grayColorEsc}  Armor: ${ctx.displayedArmorValue()}`;
            } else {
                armorBuf = `Str: ${tempColorEsc}${ctx.rogue.strength - ctx.player.weaknessAmount}${grayColorEsc}  Armor: ${ctx.estimatedArmorValue()}?`;
            }

            printString("                    ", 0, y, white, black, ctx.displayBuffer);
            printString(armorBuf, Math.trunc((SIDEBAR_WIDTH - strLenWithoutEscapes(armorBuf)) / 2), y++, dim ? darkGray : gray, black, ctx.displayBuffer);
        }

        if (y < ROWS - 1 && ctx.rogue.gold) {
            const goldBuf = `Gold: ${ctx.rogue.gold}`;
            printString("                    ", 0, y, white, black, ctx.displayBuffer);
            printString(goldBuf, Math.trunc((SIDEBAR_WIDTH - goldBuf.length) / 2), y++, dim ? darkGray : gray, black, ctx.displayBuffer);
        }

        if (y < ROWS - 1) {
            const percent = Math.trunc((ctx.rogue.stealthRange - 2) * 100 / 28);
            const tempColor: Color = { ...playerInShadowColor };
            applyColorAverage(tempColor, black, percent);
            applyColorAugment(tempColor, playerInLightColor, percent);
            if (dim) {
                applyColorAverage(tempColor, black, 50);
            }
            const stealthColorEsc = encodeMessageColor(tempColor);
            const grayEsc = encodeMessageColor(dim ? darkGray : gray);
            const stealthBuf = `${stealthColorEsc}Stealth range: ${ctx.rogue.stealthRange}${grayEsc}`;
            printString("                    ", 0, y, white, black, ctx.displayBuffer);
            printString(stealthBuf, 1, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
        }
    } else if (y < ROWS - 1) {
        // Monster behavior line
        if (
            monst.wasNegated &&
            monst.newPowerCount === monst.totalPowerCount &&
            (!ctx.player.status[StatusEffect.Hallucinating] || ctx.rogue.playbackOmniscience)
        ) {
            printString("      Negated       ", 0, y++, dim ? darkPink : pink, black, ctx.displayBuffer);
        }

        if (!(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE) && y < ROWS - 1) {
            if (ctx.player.status[StatusEffect.Hallucinating] && !ctx.rogue.playbackOmniscience) {
                const randIdx = Math.trunc(Math.random() * 10) % HALLUCINATION_STRINGS.length;
                printString(HALLUCINATION_STRINGS[randIdx], 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
                printString("     (Captive)      ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (
                (monst.info.flags & MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID) &&
                !ctx.cellHasTMFlag(monst.loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
            ) {
                printString("     (Helpless)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Sleeping) {
                printString("     (Sleeping)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Ally) {
                printString("       (Ally)       ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Fleeing) {
                printString("     (Fleeing)      ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.Wandering) {
                if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
                    monst.leader &&
                    (monst.leader.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)
                ) {
                    printString("    (Worshiping)    ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
                } else if (
                    (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_FOLLOWER) &&
                    monst.leader &&
                    (monst.leader.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE)
                ) {
                    printString("     (Guarding)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
                } else {
                    printString("    (Wandering)     ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
                }
            } else if (monst.ticksUntilTurn > Math.max(0, ctx.player.ticksUntilTurn) + ctx.player.movementSpeed) {
                printString("   (Off balance)    ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            } else if (monst.creatureState === CreatureState.TrackingScent) {
                printString("     (Hunting)      ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
            }
        }
    }

    // Trailing blank line
    if (y < ROWS - 1) {
        printString("                    ", 0, y++, dim ? darkGray : gray, black, ctx.displayBuffer);
    }

    // Highlight gradient
    if (highlight) {
        for (let i = 0; i < SIDEBAR_WIDTH; i++) {
            const highlightStrength = Math.trunc(smoothHiliteGradient(i, SIDEBAR_WIDTH - 1) / 10);
            for (let j = initialY; j < (y === ROWS - 1 ? y : Math.min(y - 1, ROWS - 1)); j++) {
                highlightScreenCell(i, j, white, highlightStrength, ctx.displayBuffer);
            }
        }
    }

    return y;
}

// =============================================================================
// printItemInfo — from IO.c:4784
// =============================================================================

/**
 * Render sidebar info for a floor item. Returns the y-coordinate after the
 * last line printed.
 *
 * C: `printItemInfo` in IO.c
 */
export function printItemInfo(
    theItem: Item,
    y: number,
    dim: boolean,
    highlight: boolean,
    ctx: SidebarContext,
): number {
    if (y >= ROWS - 1) return ROWS - 1;

    const initialY = y;

    if (y < ROWS - 1) {
        // Unhighlight if it's highlighted as part of the path
        const inPath = !!(ctx.pmap[theItem.loc.x][theItem.loc.y].flags & TileFlag.IS_IN_PATH);
        ctx.pmap[theItem.loc.x][theItem.loc.y].flags &= ~TileFlag.IS_IN_PATH;
        const appearance = ctx.getCellAppearance(theItem.loc);
        let itemForeColor: Color = { ...appearance.foreColor };
        let itemBackColor: Color = { ...appearance.backColor };

        // Override glyph if item is at the player's location (getCellAppearance returns player glyph)
        let itemChar = appearance.glyph;
        if (theItem.loc.x === ctx.player.loc.x && theItem.loc.y === ctx.player.loc.y) {
            if (ctx.player.status[StatusEffect.Hallucinating] && !ctx.rogue.playbackOmniscience) {
                itemChar = ctx.getItemCategoryGlyph(ctx.getHallucinatedItemCategory());
                itemForeColor = { ...itemColor };
            } else {
                itemChar = theItem.displayChar;
                if (theItem.foreColor) {
                    itemForeColor = { ...theItem.foreColor };
                }
            }
        }

        applyColorBounds(itemForeColor, 0, 100);
        applyColorBounds(itemBackColor, 0, 100);
        if (inPath) {
            ctx.pmap[theItem.loc.x][theItem.loc.y].flags |= TileFlag.IS_IN_PATH;
        }

        if (dim) {
            applyColorAverage(itemForeColor, black, 50);
            applyColorAverage(itemBackColor, black, 50);
        }

        plotCharWithColor(itemChar, { windowX: 0, windowY: y }, itemForeColor, itemBackColor, ctx.displayBuffer);
        printString(":                  ", 1, y, dim ? gray : white, black, ctx.displayBuffer);

        let name: string;
        if (ctx.rogue.playbackOmniscience || !ctx.player.status[StatusEffect.Hallucinating]) {
            name = ctx.itemName(theItem, true, true, dim ? gray : white);
        } else {
            name = ctx.describeHallucinatedItem();
        }
        name = name.charAt(0).toUpperCase() + name.slice(1);

        const { lineCount } = wrapText(name, SIDEBAR_WIDTH - 3);
        for (let i = initialY + 1; i <= initialY + lineCount + 1 && i < ROWS - 1; i++) {
            printString("                    ", 0, i, dim ? darkGray : gray, black, ctx.displayBuffer);
        }
        y = printStringWithWrapping(name, 3, y, SIDEBAR_WIDTH - 3, dim ? gray : white, black, ctx.displayBuffer);
    }

    // Highlight gradient
    if (highlight) {
        for (let i = 0; i < SIDEBAR_WIDTH; i++) {
            const highlightStrength = Math.trunc(smoothHiliteGradient(i, SIDEBAR_WIDTH - 1) / 10);
            for (let j = initialY; j <= y && j < ROWS - 1; j++) {
                highlightScreenCell(i, j, white, highlightStrength, ctx.displayBuffer);
            }
        }
    }
    y += 2;

    return y;
}

// =============================================================================
// printTerrainInfo — from IO.c:4857
// =============================================================================

/**
 * Render sidebar info for a terrain feature. Returns the y-coordinate after
 * the last line printed.
 *
 * C: `printTerrainInfo` in IO.c
 */
export function printTerrainInfo(
    x: number,
    y: number,
    py: number,
    description: string,
    dim: boolean,
    highlight: boolean,
    ctx: SidebarContext,
): number {
    if (py >= ROWS - 1) return ROWS - 1;

    const initialY = py;

    if (py < ROWS - 1) {
        // Unhighlight if it's highlighted as part of the path
        const inPath = !!(ctx.pmap[x][y].flags & TileFlag.IS_IN_PATH);
        ctx.pmap[x][y].flags &= ~TileFlag.IS_IN_PATH;
        const appearance = ctx.getCellAppearance({ x, y });
        let foreColor: Color = { ...appearance.foreColor };
        let backColor: Color = { ...appearance.backColor };
        applyColorBounds(foreColor, 0, 100);
        applyColorBounds(backColor, 0, 100);
        if (inPath) {
            ctx.pmap[x][y].flags |= TileFlag.IS_IN_PATH;
        }

        if (dim) {
            applyColorAverage(foreColor, black, 50);
            applyColorAverage(backColor, black, 50);
        }

        plotCharWithColor(appearance.glyph, { windowX: 0, windowY: py }, foreColor, backColor, ctx.displayBuffer);
        printString(":                  ", 1, py, dim ? gray : white, black, ctx.displayBuffer);

        let name = description.charAt(0).toUpperCase() + description.slice(1);
        const { lineCount } = wrapText(name, SIDEBAR_WIDTH - 3);
        for (let i = initialY + 1; i <= initialY + lineCount + 1 && i < ROWS - 1; i++) {
            printString("                    ", 0, i, dim ? darkGray : gray, black, ctx.displayBuffer);
        }

        const textColor: Color = { ...flavorTextColor };
        if (dim) {
            applyColorScalar(textColor, 50);
        }
        py = printStringWithWrapping(name, 3, py, SIDEBAR_WIDTH - 3, textColor, black, ctx.displayBuffer);
    }

    // Highlight gradient
    if (highlight) {
        for (let i = 0; i < SIDEBAR_WIDTH; i++) {
            const highlightStrength = Math.trunc(smoothHiliteGradient(i, SIDEBAR_WIDTH - 1) / 10);
            for (let j = initialY; j <= py && j < ROWS - 1; j++) {
                highlightScreenCell(i, j, white, highlightStrength, ctx.displayBuffer);
            }
        }
    }
    py += 2;

    return py;
}

// =============================================================================
// collectSidebarEntities — entity list builder (extracted from refreshSideBar)
// =============================================================================

/**
 * Build the ordered list of entities to display in the sidebar.
 * The list is sorted by proximity to the player, with the player always first,
 * followed by directly visible entities, then indirectly visible ones.
 *
 * This is a pure function extracted from the entity-collection part of
 * `refreshSideBar` for testability.
 */
export function collectSidebarEntities(
    focusX: number,
    focusY: number,
    focusedEntityMustGoFirst: boolean,
    ctx: SidebarContext,
): SidebarEntity[] {
    const entities: SidebarEntity[] = [];
    const addedEntity: boolean[][] = Array.from({ length: DCOLS }, () => Array(DROWS).fill(false));

    const px = ctx.player.loc.x;
    const py = ctx.player.loc.y;

    // Player always goes first
    entities.push({ type: EntityDisplayType.Creature, creature: ctx.player, x: px, y: py });
    addedEntity[px][py] = true;

    // Item at the player's location
    const playerItem = ctx.itemAtLoc(ctx.player.loc);
    if (playerItem) {
        entities.push({ type: EntityDisplayType.Item, item: playerItem, x: playerItem.loc.x, y: playerItem.loc.y });
    }

    // Focused entity (if it must go first)
    if (focusedEntityMustGoFirst && focusX >= 0 && focusY >= 0 && !addedEntity[focusX][focusY]) {
        addedEntity[focusX][focusY] = true;

        if (ctx.pmap[focusX][focusY].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
            const monst = ctx.monsterAtLoc({ x: focusX, y: focusY });
            if (monst && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience)) {
                entities.push({ type: EntityDisplayType.Creature, creature: monst, x: focusX, y: focusY });
            }
        } else if (ctx.pmap[focusX][focusY].flags & TileFlag.HAS_ITEM) {
            const item = ctx.itemAtLoc({ x: focusX, y: focusY });
            if (item && ctx.playerCanSeeOrSense(focusX, focusY)) {
                entities.push({ type: EntityDisplayType.Item, item, x: focusX, y: focusY });
            }
        } else if (
            ctx.cellHasTMFlag({ x: focusX, y: focusY }, TerrainMechFlag.TM_LIST_IN_SIDEBAR) &&
            ctx.playerCanSeeOrSense(focusX, focusY)
        ) {
            const layer = ctx.layerWithTMFlag(focusX, focusY, TerrainMechFlag.TM_LIST_IN_SIDEBAR);
            if (layer !== DungeonLayer.NoLayer) {
                const desc = ctx.tileCatalog[ctx.pmap[focusX][focusY].layers[layer]].description;
                entities.push({
                    type: EntityDisplayType.Terrain,
                    terrainDescription: desc,
                    x: focusX,
                    y: focusY,
                });
            }
        }
    }

    // Two passes: direct vision first, then indirect vision
    for (let indirectVision = 0; indirectVision < 2; indirectVision++) {
        // Monsters, sorted by proximity
        let found = true;
        while (found && entities.length * 2 < ROWS) {
            found = false;
            let shortestDist = 10000;
            let closestMonst: Creature | null = null;

            for (const monst of ctx.iterateMonsters()) {
                if (
                    (ctx.canDirectlySeeMonster(monst) || (indirectVision && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience))) &&
                    !addedEntity[monst.loc.x][monst.loc.y] &&
                    !(monst.info.flags & MonsterBehaviorFlag.MONST_NOT_LISTED_IN_SIDEBAR)
                ) {
                    const dist = (px - monst.loc.x) ** 2 + (py - monst.loc.y) ** 2;
                    if (dist < shortestDist) {
                        shortestDist = dist;
                        closestMonst = monst;
                    }
                }
            }
            if (closestMonst) {
                found = true;
                addedEntity[closestMonst.loc.x][closestMonst.loc.y] = true;
                entities.push({
                    type: EntityDisplayType.Creature,
                    creature: closestMonst,
                    x: closestMonst.loc.x,
                    y: closestMonst.loc.y,
                });
            }
        }

        // Items, sorted by proximity
        found = true;
        while (found && entities.length * 2 < ROWS) {
            found = false;
            let shortestDist = 10000;
            let closestItem: Item | null = null;

            for (const item of ctx.floorItems()) {
                if (
                    (ctx.playerCanDirectlySee(item.loc.x, item.loc.y) || (indirectVision && (ctx.playerCanSeeOrSense(item.loc.x, item.loc.y) || ctx.rogue.playbackOmniscience))) &&
                    !addedEntity[item.loc.x][item.loc.y]
                ) {
                    const dist = (px - item.loc.x) ** 2 + (py - item.loc.y) ** 2;
                    if (dist < shortestDist) {
                        shortestDist = dist;
                        closestItem = item;
                    }
                }
            }
            if (closestItem) {
                found = true;
                addedEntity[closestItem.loc.x][closestItem.loc.y] = true;
                entities.push({
                    type: EntityDisplayType.Item,
                    item: closestItem,
                    x: closestItem.loc.x,
                    y: closestItem.loc.y,
                });
            }
        }

        // Terrain, scanning concentric squares from player
        const maxRadius = Math.max(DROWS, DCOLS);
        for (let k = 0; k < maxRadius; k++) {
            if (entities.length >= ROWS - 1) break;

            for (let i = px - k; i <= px + k; i++) {
                // First and last columns need full stepping; middle columns only scan edges
                const step = (i === px - k || i === px + k) ? 1 : 2 * k;
                for (let j = py - k; j <= py + k; j += (step || 1)) {
                    if (entities.length >= ROWS - 1) break;

                    if (
                        coordinatesAreInMap(i, j) &&
                        !addedEntity[i][j] &&
                        ctx.cellHasTMFlag({ x: i, y: j }, TerrainMechFlag.TM_LIST_IN_SIDEBAR) &&
                        (ctx.playerCanDirectlySee(i, j) || (indirectVision && (ctx.playerCanSeeOrSense(i, j) || ctx.rogue.playbackOmniscience)))
                    ) {
                        addedEntity[i][j] = true;
                        const layer = ctx.layerWithTMFlag(i, j, TerrainMechFlag.TM_LIST_IN_SIDEBAR);
                        if (layer !== DungeonLayer.NoLayer) {
                            const desc = ctx.tileCatalog[ctx.pmap[i][j].layers[layer]].description;
                            entities.push({
                                type: EntityDisplayType.Terrain,
                                terrainDescription: desc,
                                x: i,
                                y: j,
                            });
                        }
                    }
                }
            }
        }
    }

    return entities;
}

// =============================================================================
// refreshSideBar — from IO.c:3695
// =============================================================================

/**
 * Refresh the sidebar. Lists visible entities sorted by proximity to the player.
 * If a specific entity is focused (focusX >= 0), highlights it.
 *
 * Also updates `rogue.sidebarLocationList` so each sidebar row maps to the
 * corresponding entity location.
 *
 * C: `refreshSideBar` in IO.c
 */
export function refreshSideBar(
    focusX: number,
    focusY: number,
    focusedEntityMustGoFirst: boolean,
    ctx: SidebarContext,
): void {
    if (ctx.rogue.gameHasEnded || ctx.rogue.playbackFastForward) {
        return;
    }

    if (focusX < 0) {
        focusedEntityMustGoFirst = false;
    }

    // Determine focus entity
    let focusEntity: { x: number; y: number } | null = null;
    if (focusX >= 0) {
        if (ctx.pmap[focusX][focusY].flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
            const monst = ctx.monsterAtLoc({ x: focusX, y: focusY });
            if (monst && (ctx.canSeeMonster(monst) || ctx.rogue.playbackOmniscience)) {
                focusEntity = { x: focusX, y: focusY };
            }
        }
        if (!focusEntity && (ctx.pmap[focusX][focusY].flags & TileFlag.HAS_ITEM)) {
            const item = ctx.itemAtLoc({ x: focusX, y: focusY });
            if (item && ctx.playerCanSeeOrSense(focusX, focusY)) {
                focusEntity = { x: focusX, y: focusY };
            }
        }
        if (
            !focusEntity &&
            ctx.cellHasTMFlag({ x: focusX, y: focusY }, TerrainMechFlag.TM_LIST_IN_SIDEBAR) &&
            ctx.playerCanSeeOrSense(focusX, focusY)
        ) {
            focusEntity = { x: focusX, y: focusY };
        }
    }

    let printY = 0;

    // Initialize sidebar location list
    for (let i = 0; i < ROWS * 2; i++) {
        ctx.rogue.sidebarLocationList[i] = { x: -1, y: -1 };
    }

    // Playback header
    if (ctx.rogue.playbackMode) {
        printString("   -- PLAYBACK --   ", 0, printY++, white, black, ctx.displayBuffer);
        if (ctx.rogue.howManyTurns > 0) {
            const turnLabel = `Turn ${ctx.rogue.playerTurnNumber}/${ctx.rogue.howManyTurns}`;
            printProgressBar(0, printY++, turnLabel, ctx.rogue.playerTurnNumber, ctx.rogue.howManyTurns, darkPurple, false, ctx.displayBuffer);
        }
        if (ctx.rogue.playbackOOS) {
            printString("    [OUT OF SYNC]   ", 0, printY++, badMessageColor, black, ctx.displayBuffer);
        } else if (ctx.rogue.playbackPaused) {
            printString("      [PAUSED]      ", 0, printY++, gray, black, ctx.displayBuffer);
        }
        printString("                    ", 0, printY++, white, black, ctx.displayBuffer);
    }

    // Collect entities
    const entities = collectSidebarEntities(focusX, focusY, focusedEntityMustGoFirst, ctx);

    // Render entities
    let gotFocusedEntityOnScreen = focusX < 0;

    for (let i = 0; i < entities.length && printY < ROWS - 1; i++) {
        const entity = entities[i];
        const oldPrintY = printY;
        const isFocused = focusEntity !== null && entity.x === focusX && entity.y === focusY;
        const isDimmed = focusEntity !== null && !isFocused;

        if (entity.type === EntityDisplayType.Creature && entity.creature) {
            printY = printMonsterInfo(entity.creature, printY, isDimmed, isFocused, ctx);
        } else if (entity.type === EntityDisplayType.Item && entity.item) {
            printY = printItemInfo(entity.item, printY, isDimmed, isFocused, ctx);
        } else if (entity.type === EntityDisplayType.Terrain && entity.terrainDescription) {
            printY = printTerrainInfo(entity.x, entity.y, printY, entity.terrainDescription, isDimmed, isFocused, ctx);
        }

        if (isFocused && printY < ROWS) {
            gotFocusedEntityOnScreen = true;
        }

        // Map sidebar rows to entity location
        for (let j = oldPrintY; j < printY; j++) {
            ctx.rogue.sidebarLocationList[j] = { x: entity.x, y: entity.y };
        }
    }

    if (gotFocusedEntityOnScreen) {
        // Clear remaining rows
        for (let i = printY; i < ROWS - 1; i++) {
            printString("                    ", 0, i, white, black, ctx.displayBuffer);
        }
        // Depth footer
        const depthPadding = ctx.rogue.depthLevel < 10 ? " " : "";
        const depthBuf = `  -- Depth: ${ctx.rogue.depthLevel} --${depthPadding}   `;
        printString(depthBuf, 0, ROWS - 1, white, black, ctx.displayBuffer);
    } else if (!focusedEntityMustGoFirst) {
        // Failed to get the focused entity on screen. Retry with focus first.
        refreshSideBar(focusX, focusY, true, ctx);
    }
}

// =============================================================================
// Detail panel functions — from IO.c:5035-5128
// =============================================================================

/**
 * Display a detailed text panel for a monster.
 *
 * C: `printMonsterDetails` in IO.c
 */
export function printMonsterDetails(monst: Creature, ctx: SidebarContext): void {
    const textBuf = ctx.monsterDetails(monst);
    ctx.printTextBox(textBuf, monst.loc.x, 0, 0, white, black);
}

/**
 * Display a detailed text panel for a floor item.
 *
 * C: `printFloorItemDetails` in IO.c
 */
export function printFloorItemDetails(theItem: Item, ctx: SidebarContext): void {
    const textBuf = ctx.itemDetails(theItem);
    ctx.printTextBox(textBuf, theItem.loc.x, 0, 0, white, black);
}

/**
 * Display a detailed text panel for a carried item, optionally with action buttons.
 * Returns the key code of a button action, or -1 if cancelled.
 *
 * C: `printCarriedItemDetails` in IO.c
 *
 * Note: Full button integration is deferred to Step 3 (buttons.ts). This version
 * displays the info text only.
 */
export function printCarriedItemDetails(
    theItem: Item,
    x: number,
    y: number,
    width: number,
    _includeButtons: boolean,
    ctx: SidebarContext,
): number {
    const textBuf = ctx.itemDetails(theItem);
    // TODO: Button integration will be added in Step 3 (buttons.ts)
    return ctx.printTextBox(textBuf, x, y, width, white, { ...black, red: 5, green: 5, blue: 20 });
}

/**
 * Describe a hallucinated item (random category and kind).
 *
 * C: `describeHallucinatedItem` in IO.c
 */
export function describeHallucinatedItem(ctx: SidebarContext): string {
    return ctx.describeHallucinatedItem();
}
