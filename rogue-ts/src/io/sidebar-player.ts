/*
 *  sidebar-player.ts — Sidebar shared types, progress bars, item/terrain info
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c + src/brogue/Buttons.c
 *  Functions: smoothHiliteGradient, creatureHealthChangePercent, printProgressBar,
 *             printItemInfo, printTerrainInfo,
 *             printFloorItemDetails, printCarriedItemDetails, describeHallucinatedItem
 *
 *  Exports: SidebarEntity, SidebarContext, EntityDisplayType, SIDEBAR_WIDTH
 *           and the above functions. Imported by sidebar-monsters.ts.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Color, ScreenDisplayBuffer, Pos, Creature, Item, Pcell, FloorTileType } from "../types/types.js";
import type { DisplayGlyph } from "../types/enums.js";
import { ItemCategory, StatusEffect, DungeonLayer } from "../types/enums.js";
import { ROWS } from "../types/constants.js";
import { TileFlag } from "../types/flags.js";
import { clamp } from "../math/rng.js";
import {
    black, white, gray, darkGray,
    itemColor,
    flavorTextColor,
} from "../globals/colors.js";
import { wrapText, printString, printStringWithWrapping } from "./text.js";
import { applyColorAverage, applyColorBounds, applyColorScalar } from "./color.js";
import { plotCharWithColor, highlightScreenCell } from "./display.js";

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
// Detail panel functions — from IO.c:5035-5128
// =============================================================================

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

/** Category-to-article-name pairs for hallucination descriptions. */
const HALLUCINATION_CATEGORY_NAMES: Partial<Record<number, string>> = {
    [ItemCategory.FOOD]:   "some food",
    [ItemCategory.WEAPON]: "a weapon",
    [ItemCategory.ARMOR]:  "some armor",
    [ItemCategory.POTION]: "a potion",
    [ItemCategory.SCROLL]: "a scroll",
    [ItemCategory.STAFF]:  "a staff",
    [ItemCategory.WAND]:   "a wand",
    [ItemCategory.RING]:   "a ring",
    [ItemCategory.CHARM]:  "a charm",
    [ItemCategory.GOLD]:   "some gold",
};

/**
 * Describe a hallucinated item (random category and kind).
 *
 * C: `describeHallucinatedItem` in IO.c
 */
export function describeHallucinatedItem(ctx: SidebarContext): string {
    const cat = ctx.getHallucinatedItemCategory();
    return HALLUCINATION_CATEGORY_NAMES[cat] ?? "something strange";
}
