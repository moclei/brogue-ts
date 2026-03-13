/*
 *  io/cell-appearance.ts — getCellAppearance standalone function
 *  Port V2 — rogue-ts
 *
 *  Ported from: src/brogue/IO.c getCellAppearance()
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type {
    Color, Pos, Pcell, Tcell, Creature, Item, PlayerCharacter,
    FloorTileType, DungeonFeature, CreatureType, ScreenDisplayBuffer,
} from "../types/types.js";
import {
    DisplayGlyph, DungeonLayer, StatusEffect, CreatureState,
    ItemCategory, TileType, DisplayDetailValue,
} from "../types/enums.js";
import {
    TileFlag, ANY_KIND_OF_VISIBLE,
    MonsterBehaviorFlag, MonsterBookkeepingFlag,
    TerrainMechFlag, TerrainFlag, ItemFlag, T_MOVES_ITEMS,
} from "../types/flags.js";
import { DROWS } from "../types/constants.js";
import {
    applyColorMultiplier, applyColorAverage, applyColorAugment,
    normColor, separateColors, randomizeColor, swapColors,
    storeColorComponents, colorFromComponents, colorMultiplierFromDungeonLight,
} from "./color.js";
import {
    glyphIsWallish, bakeTerrainColors, mapToWindowX, mapToWindowY,
    mapToWindow, plotCharWithColor, randomAnimateMonster,
} from "./display.js";
import {
    black, white, basicLightColor, undiscoveredColor,
    clairvoyanceColor, telepathyMultiplier, magicMapColor,
    memoryColor, memoryOverlay, omniscienceColor, deepWaterLightColor,
    inDarknessMultiplierColor, itemColor, orange, yellow, pink, purple,
    badMessageColor, goodMessageColor,
} from "../globals/colors.js";
import {
    monsterRevealed, monsterIsHidden, monsterHiddenBySubmersion, canSeeMonster,
} from "../monsters/monster-queries.js";
import type { MonsterQueryContext } from "../monsters/monster-queries.js";
import { itemAtLoc } from "../items/item-inventory.js";
import {
    itemMagicPolarity, getItemCategoryGlyph, getHallucinatedItemCategory,
} from "../items/item-generation.js";
import type { ItemRNG } from "../items/item-generation.js";
import { scentDistance } from "../time/turn-processing.js";
import { cellHasTerrainFlag, cellHasTMFlag } from "../state/helpers.js";
import { randRange, randClump } from "../math/rng.js";

// =============================================================================
// getCellAppearance
// =============================================================================

/**
 * Compute the visual appearance (glyph, foreground color, background color) of
 * the dungeon cell at `loc`. Faithful port of getCellAppearance() in IO.c.
 *
 * The standalone function takes all required game-state slices as parameters;
 * callers wrap it in a closure and expose it via context as:
 *   getCellAppearance(loc: Pos): { glyph: DisplayGlyph; foreColor: Color; backColor: Color }
 */
export function getCellAppearance(
    loc: Pos,
    pmap: Pcell[][],
    tmap: readonly (readonly Tcell[])[],
    displayBuffer: ScreenDisplayBuffer,
    rogue: PlayerCharacter,
    player: Creature,
    monsters: readonly Creature[],
    dormantMonsters: readonly Creature[],
    floorItems: readonly Item[],
    tileCatalog: readonly FloorTileType[],
    dungeonFeatureCatalog: readonly DungeonFeature[],
    monsterCatalog: readonly CreatureType[],
    terrainRandomValues: readonly (readonly (readonly number[])[])[],
    displayDetail: readonly (readonly number[])[],
    scentMap: readonly (readonly number[])[],
): { glyph: DisplayGlyph; foreColor: Color; backColor: Color } {
    const x = loc.x;
    const y = loc.y;
    const cellFlags = pmap[x][y].flags;

    // playerCanSeeOrSense: cell is lit and visible in any sense
    const playerCanSeeOrSense = (cx: number, cy: number): boolean =>
        (pmap[cx][cy].flags & ANY_KIND_OF_VISIBLE) !== 0;

    // Find monster at loc (from either live or dormant list)
    let monst: Creature | null = null;
    if (cellFlags & TileFlag.HAS_MONSTER) {
        monst = monsters.find(m => m.loc.x === x && m.loc.y === y) ?? null;
    } else if (cellFlags & TileFlag.HAS_DORMANT_MONSTER) {
        monst = dormantMonsters.find(m => m.loc.x === x && m.loc.y === y) ?? null;
    }

    // Build MonsterQueryContext for monster visibility checks
    const mqCtx: MonsterQueryContext = {
        player,
        cellHasTerrainFlag: (p: Pos, flags: number) => cellHasTerrainFlag(pmap, p, flags),
        cellHasGas: (p: Pos) => pmap[p.x][p.y].layers[DungeonLayer.Gas] !== 0,
        playerCanSee: (cx: number, cy: number) => !!(pmap[cx][cy].flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (cx: number, cy: number) => !!(pmap[cx][cy].flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // monsterWithDetectedItem: monster carries a magic-detected item the player can't see
    let monsterWithDetectedItem = false;
    if (monst?.carriedItem) {
        monsterWithDetectedItem = (
            !!(monst.carriedItem.flags & ItemFlag.ITEM_MAGIC_DETECTED)
            && itemMagicPolarity(monst.carriedItem) !== 0
            && !canSeeMonster(monst, mqCtx)
        );
    }

    // theItem: detected carried item takes priority over floor item
    let theItem: Item | null = monsterWithDetectedItem
        ? monst!.carriedItem
        : itemAtLoc(loc, floorItems as Item[]);

    // Working color state
    let cellChar: DisplayGlyph = 0 as DisplayGlyph;
    let cellForeColor: Color = { ...black };
    let cellBackColor: Color = { ...black };
    let lightMultiplierColor: Color = { ...black };
    let gasAugmentColor: Color = { ...black };
    let gasAugmentWeight = 0;
    let needDistinctness = false;

    // =========================================================================
    // STABLE MEMORY PATH: restore stored appearance, skip full computation
    // =========================================================================
    if (
        !playerCanSeeOrSense(x, y)
        && !(cellFlags & (TileFlag.ITEM_DETECTED | TileFlag.HAS_PLAYER))
        && (!monst || !monsterRevealed(monst, player))
        && !monsterWithDetectedItem
        && (cellFlags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))
        && (cellFlags & TileFlag.STABLE_MEMORY)
    ) {
        const rem = pmap[x][y].rememberedAppearance;
        cellChar = rem.character;
        cellForeColor = colorFromComponents(rem.foreColorComponents);
        cellBackColor = colorFromComponents(rem.backColorComponents);

    } else {
        // =====================================================================
        // FULL COMPUTATION PATH
        // =====================================================================
        let bestFCPriority = 10000;
        let bestBCPriority = 10000;
        let bestCharPriority = 10000;

        // Default: floor appearance
        const floorTile = tileCatalog[TileType.FLOOR];
        cellForeColor = { ...(floorTile.foreColor ?? black) };
        cellBackColor = { ...(floorTile.backColor ?? black) };
        cellChar = floorTile.displayChar as DisplayGlyph;

        // Determine how many terrain layers to scan
        let maxLayer: number;
        if (!(cellFlags & TileFlag.DISCOVERED) && !rogue.playbackOmniscience) {
            maxLayer = (cellFlags & TileFlag.MAGIC_MAPPED) ? DungeonLayer.Liquid + 1 : 0;
        } else {
            maxLayer = DungeonLayer.NumberTerrainLayers;
        }

        // Tile appearance loop: find best fore/back/char by draw priority
        const cell = pmap[x][y];
        for (let layer = 0; layer < maxLayer; layer++) {
            if (cell.layers[layer] && layer !== DungeonLayer.Gas) {
                let tile = cell.layers[layer];
                if (rogue.playbackOmniscience && (tileCatalog[tile].mechFlags & TerrainMechFlag.TM_IS_SECRET)) {
                    tile = dungeonFeatureCatalog[tileCatalog[tile].discoverType].tile ?? tile;
                }
                const te = tileCatalog[tile];
                if (te.drawPriority < bestFCPriority && te.foreColor) {
                    cellForeColor = { ...te.foreColor };
                    bestFCPriority = te.drawPriority;
                }
                if (te.drawPriority < bestBCPriority && te.backColor) {
                    cellBackColor = { ...te.backColor };
                    bestBCPriority = te.drawPriority;
                }
                if (te.drawPriority < bestCharPriority && te.displayChar) {
                    cellChar = te.displayChar as DisplayGlyph;
                    bestCharPriority = te.drawPriority;
                    needDistinctness = !!(te.mechFlags & TerrainMechFlag.TM_VISUALLY_DISTINCT);
                }
            }
        }

        // Light multiplier for this cell
        lightMultiplierColor = rogue.trueColorMode
            ? { ...basicLightColor }
            : colorMultiplierFromDungeonLight(x, y, tmap);

        // Gas augment: GAS layer blends into back color
        if (cell.layers[DungeonLayer.Gas] && tileCatalog[cell.layers[DungeonLayer.Gas]].backColor) {
            gasAugmentColor = { ...tileCatalog[cell.layers[DungeonLayer.Gas]].backColor! };
            gasAugmentWeight = rogue.trueColorMode ? 30 : Math.min(90, 30 + cell.volume);
        }

        // ----- Entity overlay (in priority order) ----------------------------

        if (cellFlags & TileFlag.HAS_PLAYER) {
            // Player
            cellChar = player.info.displayChar;
            cellForeColor = { ...player.info.foreColor };
            needDistinctness = true;

        } else if (
            (
                (cellFlags & TileFlag.HAS_ITEM)
                && (cellFlags & TileFlag.ITEM_DETECTED)
                && theItem !== null
                && itemMagicPolarity(theItem) !== 0
                && !playerCanSeeOrSense(x, y)
            ) || monsterWithDetectedItem
        ) {
            // Detected magic item
            const polarity = itemMagicPolarity(theItem!);
            if (theItem!.category & ItemCategory.AMULET) {
                cellChar = DisplayGlyph.G_AMULET;
                cellForeColor = { ...white };
            } else if (polarity === -1) {
                cellChar = DisplayGlyph.G_BAD_MAGIC;
                cellForeColor = { ...badMessageColor };
            } else if (polarity === 1) {
                cellChar = DisplayGlyph.G_GOOD_MAGIC;
                cellForeColor = { ...goodMessageColor };
            } else {
                cellChar = 0 as DisplayGlyph;
                cellForeColor = { ...white };
            }
            needDistinctness = true;

        } else if (
            monst !== null
            && (cellFlags & TileFlag.HAS_MONSTER)
            && (
                playerCanSeeOrSense(x, y)
                || ((monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE) && (cellFlags & TileFlag.DISCOVERED))
            )
            && (!monsterIsHidden(monst, player, mqCtx) || rogue.playbackOmniscience)
        ) {
            // Visible monster
            needDistinctness = true;
            const mflags = monsterCatalog.map(m => m.flags);
            if (
                player.status[StatusEffect.Hallucinating] > 0
                && !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                && !rogue.playbackOmniscience
                && !player.status[StatusEffect.Telepathic]
            ) {
                const i1 = randomAnimateMonster(mflags, MonsterBehaviorFlag.MONST_INANIMATE, MonsterBehaviorFlag.MONST_INVULNERABLE);
                cellChar = monsterCatalog[i1].displayChar;
                const i2 = randomAnimateMonster(mflags, MonsterBehaviorFlag.MONST_INANIMATE, MonsterBehaviorFlag.MONST_INVULNERABLE);
                cellForeColor = { ...monsterCatalog[i2].foreColor };
            } else {
                cellChar = monst.info.displayChar;
                cellForeColor = { ...monst.info.foreColor };
                if (monst.status[StatusEffect.Invisible] || (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) {
                    applyColorAverage(cellForeColor, cellBackColor, 75);
                } else if (monst.creatureState === CreatureState.Ally && !(monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)) {
                    cellForeColor = rogue.trueColorMode ? { ...white } : (applyColorAverage(cellForeColor, pink, 50), cellForeColor);
                }
            }

        } else if (monst !== null && monsterRevealed(monst, player) && !canSeeMonster(monst, mqCtx)) {
            // Revealed (telepathic) but not directly visible
            if (player.status[StatusEffect.Hallucinating] && !rogue.playbackOmniscience && !player.status[StatusEffect.Telepathic]) {
                cellChar = (randRange(0, 1) ? 88 : 120) as DisplayGlyph; // 'X' : 'x'
            } else {
                cellChar = (monst.info.isLarge ? 88 : 120) as DisplayGlyph; // 'X' : 'x'
            }
            cellForeColor = { ...white };
            lightMultiplierColor = { ...white };
            if (!(cellFlags & TileFlag.DISCOVERED)) {
                cellBackColor = { ...black };
                gasAugmentColor = { ...black };
            }

        } else if (
            (cellFlags & TileFlag.HAS_ITEM)
            && !cellHasTerrainFlag(pmap, loc, TerrainFlag.T_OBSTRUCTS_ITEMS)
            && (
                playerCanSeeOrSense(x, y)
                || ((cellFlags & TileFlag.DISCOVERED) && !cellHasTerrainFlag(pmap, loc, T_MOVES_ITEMS))
            )
        ) {
            // Visible or discovered non-moving item
            needDistinctness = true;
            if (player.status[StatusEffect.Hallucinating] && !rogue.playbackOmniscience) {
                const rng: ItemRNG = { randRange, randPercent: (pct: number) => randRange(0, 99) < pct, randClump };
                cellChar = getItemCategoryGlyph(getHallucinatedItemCategory(rng));
                cellForeColor = { ...itemColor };
            } else {
                const fi = itemAtLoc(loc, floorItems as Item[]);
                if (fi) {
                    cellChar = fi.displayChar;
                    cellForeColor = fi.foreColor ? { ...fi.foreColor } : { ...white };
                    pmap[x][y].rememberedItemCategory = fi.category;
                    pmap[x][y].rememberedItemKind = fi.kind;
                    pmap[x][y].rememberedItemQuantity = fi.quantity;
                    pmap[x][y].rememberedItemOriginDepth = fi.originDepth;
                }
            }

        } else if (playerCanSeeOrSense(x, y) || (cellFlags & (TileFlag.DISCOVERED | TileFlag.MAGIC_MAPPED))) {
            // Terrain only — clear remembered item
            pmap[x][y].rememberedItemCategory = 0;
            pmap[x][y].rememberedItemKind = 0;
            pmap[x][y].rememberedItemQuantity = 0;
            pmap[x][y].rememberedItemOriginDepth = 0;

        } else {
            // Undiscovered cell — early return
            return {
                glyph: 32 as DisplayGlyph,
                foreColor: { ...black },
                backColor: { ...undiscoveredColor },
            };
        }

        // Gas augment (blend gas color into fore/back; phantom silhouette)
        if (gasAugmentWeight && (cellFlags & TileFlag.DISCOVERED || rogue.playbackOmniscience)) {
            if (!rogue.trueColorMode || !needDistinctness) {
                applyColorAverage(cellForeColor, gasAugmentColor, gasAugmentWeight);
            }
            // Invisible monster in gas: show silhouette in back color
            if (
                (cellFlags & TileFlag.HAS_MONSTER)
                && monst !== null
                && monst.status[StatusEffect.Invisible]
                && playerCanSeeOrSense(x, y)
                && !monsterRevealed(monst, player)
                && !monsterHiddenBySubmersion(monst, player, (p, f) => cellHasTerrainFlag(pmap, p, f))
            ) {
                const mflags = monsterCatalog.map(m => m.flags);
                if (player.status[StatusEffect.Hallucinating] && !rogue.playbackOmniscience && !player.status[StatusEffect.Telepathic]) {
                    const idx = randomAnimateMonster(mflags, MonsterBehaviorFlag.MONST_INANIMATE, MonsterBehaviorFlag.MONST_INVULNERABLE);
                    cellChar = monsterCatalog[idx].displayChar;
                } else {
                    cellChar = monst.info.displayChar;
                }
                cellForeColor = { ...cellBackColor };
            }
            applyColorAverage(cellBackColor, gasAugmentColor, gasAugmentWeight);
        }

        // Stable memory store: flag cell and save appearance for future frames
        if (
            !(cellFlags & (ANY_KIND_OF_VISIBLE | TileFlag.ITEM_DETECTED | TileFlag.HAS_PLAYER))
            && !playerCanSeeOrSense(x, y)
            && (!monst || !monsterRevealed(monst, player))
            && !monsterWithDetectedItem
        ) {
            pmap[x][y].flags |= TileFlag.STABLE_MEMORY;
            pmap[x][y].rememberedAppearance.character = cellChar;
            const fc = storeColorComponents(cellForeColor);
            pmap[x][y].rememberedAppearance.foreColorComponents[0] = fc[0];
            pmap[x][y].rememberedAppearance.foreColorComponents[1] = fc[1];
            pmap[x][y].rememberedAppearance.foreColorComponents[2] = fc[2];
            const bc = storeColorComponents(cellBackColor);
            pmap[x][y].rememberedAppearance.backColorComponents[0] = bc[0];
            pmap[x][y].rememberedAppearance.backColorComponents[1] = bc[1];
            pmap[x][y].rememberedAppearance.backColorComponents[2] = bc[2];
            // Apply light+bake then restore (ensures this frame matches future stable-memory frames)
            applyColorAugment(lightMultiplierColor, basicLightColor, 100);
            applyColorMultiplier(cellForeColor, lightMultiplierColor);
            applyColorMultiplier(cellBackColor, lightMultiplierColor);
            bakeTerrainColors(cellForeColor, cellBackColor, terrainRandomValues[x][y], rogue.trueColorMode);
            cellForeColor = colorFromComponents(pmap[x][y].rememberedAppearance.foreColorComponents);
            cellBackColor = colorFromComponents(pmap[x][y].rememberedAppearance.backColorComponents);
        }
    } // end full computation path

    // =========================================================================
    // POST-PROCESSING (both paths)
    // =========================================================================

    // Wall smoothing: G_WALL / G_GRANITE above a wallish tile → G_WALL_TOP
    if (
        (cellChar === DisplayGlyph.G_WALL || cellChar === DisplayGlyph.G_GRANITE)
        && y + 1 < DROWS
        && glyphIsWallish(displayBuffer.cells[mapToWindowX(x)][mapToWindowY(y + 1)].character)
    ) {
        cellChar = DisplayGlyph.G_WALL_TOP;
    }

    // Visibility tinting
    if (
        ((cellFlags & TileFlag.ITEM_DETECTED) || monsterWithDetectedItem
            || (monst !== null && monsterRevealed(monst, player)))
        && !playerCanSeeOrSense(x, y)
    ) {
        // Detected / revealed — leave colors as-is

    } else if (!(cellFlags & TileFlag.VISIBLE) && (cellFlags & TileFlag.CLAIRVOYANT_VISIBLE)) {
        const lm = { ...lightMultiplierColor };
        applyColorAugment(lm, basicLightColor, 100);
        applyColorMultiplier(cellForeColor, lm);
        if (!rogue.trueColorMode || !needDistinctness) applyColorMultiplier(cellForeColor, clairvoyanceColor);
        applyColorMultiplier(cellBackColor, lm);
        applyColorMultiplier(cellBackColor, clairvoyanceColor);

    } else if (!(cellFlags & TileFlag.VISIBLE) && (cellFlags & TileFlag.TELEPATHIC_VISIBLE)) {
        const lm = { ...lightMultiplierColor };
        applyColorAugment(lm, basicLightColor, 100);
        applyColorMultiplier(cellForeColor, lm);
        if (!rogue.trueColorMode || !needDistinctness) applyColorMultiplier(cellForeColor, telepathyMultiplier);
        applyColorMultiplier(cellBackColor, lm);
        applyColorMultiplier(cellBackColor, telepathyMultiplier);

    } else if (!(cellFlags & TileFlag.DISCOVERED) && (cellFlags & TileFlag.MAGIC_MAPPED)) {
        if (!rogue.playbackOmniscience) {
            needDistinctness = false;
            if (!rogue.trueColorMode || !needDistinctness) applyColorMultiplier(cellForeColor, magicMapColor);
            applyColorMultiplier(cellBackColor, magicMapColor);
        }

    } else if (!(cellFlags & TileFlag.VISIBLE) && !rogue.playbackOmniscience) {
        needDistinctness = false;
        if (rogue.inWater) {
            applyColorAverage(cellForeColor, black, 80);
            applyColorAverage(cellBackColor, black, 80);
        } else {
            if (!cellHasTMFlag(pmap, loc, TerrainMechFlag.TM_BRIGHT_MEMORY) && (!rogue.trueColorMode || !needDistinctness)) {
                applyColorMultiplier(cellForeColor, memoryColor);
                applyColorAverage(cellForeColor, memoryOverlay, 25);
            }
            applyColorMultiplier(cellBackColor, memoryColor);
            applyColorAverage(cellBackColor, memoryOverlay, 25);
        }

    } else if (playerCanSeeOrSense(x, y) && rogue.playbackOmniscience && !(cellFlags & ANY_KIND_OF_VISIBLE)) {
        const lm = { ...lightMultiplierColor };
        applyColorAugment(lm, basicLightColor, 100);
        applyColorMultiplier(cellForeColor, lm);
        if (!rogue.trueColorMode || !needDistinctness) applyColorMultiplier(cellForeColor, omniscienceColor);
        applyColorMultiplier(cellBackColor, lm);
        applyColorMultiplier(cellBackColor, omniscienceColor);

    } else {
        // Fully visible
        applyColorMultiplier(cellForeColor, lightMultiplierColor);
        applyColorMultiplier(cellBackColor, lightMultiplierColor);
        if (player.status[StatusEffect.Hallucinating] && !rogue.trueColorMode) {
            const hallAmt = Math.trunc(40 * player.status[StatusEffect.Hallucinating] / 300) + 20;
            randomizeColor(cellForeColor, hallAmt);
            randomizeColor(cellBackColor, hallAmt);
        }
        if (rogue.inWater) {
            applyColorMultiplier(cellForeColor, deepWaterLightColor);
            applyColorMultiplier(cellBackColor, deepWaterLightColor);
        }
    }

    // Path highlight
    if (cellFlags & TileFlag.IS_IN_PATH) {
        if (cellHasTMFlag(pmap, loc, TerrainMechFlag.TM_INVERT_WHEN_HIGHLIGHTED)) {
            swapColors(cellForeColor, cellBackColor);
        } else {
            if (!rogue.trueColorMode || !needDistinctness) {
                applyColorAverage(cellForeColor, yellow, rogue.cursorPathIntensity);
            }
            applyColorAverage(cellBackColor, yellow, rogue.cursorPathIntensity);
        }
        needDistinctness = true;
    }

    bakeTerrainColors(cellForeColor, cellBackColor, terrainRandomValues[x][y], rogue.trueColorMode);

    // Stealth range mode: cells beyond 2× stealthRange get orange tint
    if (rogue.displayStealthRangeMode && (cellFlags & TileFlag.IN_FIELD_OF_VIEW)) {
        const dist = Math.min(
            rogue.scentTurnNumber - scentMap[x][y],
            scentDistance(x, y, player.loc.x, player.loc.y),
        );
        if (dist > rogue.stealthRange * 2) {
            applyColorAverage(cellForeColor, orange, 12);
            applyColorAverage(cellBackColor, orange, 12);
            applyColorAugment(cellForeColor, orange, 12);
            applyColorAugment(cellBackColor, orange, 12);
        }
    }

    // True color / stealth detail mode: per-cell lighting refinement
    if ((rogue.trueColorMode || rogue.displayStealthRangeMode) && playerCanSeeOrSense(x, y)) {
        if (displayDetail[x][y] === DisplayDetailValue.Dark) {
            applyColorMultiplier(cellForeColor, inDarknessMultiplierColor);
            applyColorMultiplier(cellBackColor, inDarknessMultiplierColor);
            applyColorAugment(cellForeColor, purple, 7);
            applyColorAugment(cellBackColor, white, -10);
            applyColorAverage(cellBackColor, purple, 17);
        } else if (displayDetail[x][y] === DisplayDetailValue.Lit) {
            const lm = colorMultiplierFromDungeonLight(x, y, tmap);
            normColor(lm, 175, 50);
            applyColorAugment(cellForeColor, lm, 5);
            applyColorAugment(cellBackColor, lm, 5);
        }
    }

    if (needDistinctness) {
        separateColors(cellForeColor, cellBackColor);
    }

    return { glyph: cellChar, foreColor: cellForeColor, backColor: cellBackColor };
}

// =============================================================================
// refreshDungeonCell
// =============================================================================

/**
 * Recompute the appearance of one dungeon cell and write it to the display
 * buffer. Faithful port of refreshDungeonCell() in IO.c.
 *
 * Takes a pre-built getCellAppearance closure so callers can share the same
 * closure context without repeating all parameters.
 */
export function refreshDungeonCell(
    loc: Pos,
    getCellAppearanceFn: (loc: Pos) => { glyph: DisplayGlyph; foreColor: Color; backColor: Color },
    displayBuffer: ScreenDisplayBuffer,
): void {
    const { glyph, foreColor, backColor } = getCellAppearanceFn(loc);
    plotCharWithColor(glyph, mapToWindow(loc), foreColor, backColor, displayBuffer);
}

// =============================================================================
// displayLevel
// =============================================================================

/**
 * Refresh every dungeon cell. Faithful port of displayLevel() in IO.c.
 *
 * Iterates all dcols×drows cells (bottom row first, so wall-top smoothing in
 * getCellAppearance sees the row below before the row above is drawn).
 */
export function displayLevel(
    dcols: number,
    drows: number,
    refreshCell: (loc: Pos) => void,
): void {
    for (let i = 0; i < dcols; i++) {
        for (let j = drows - 1; j >= 0; j--) {
            refreshCell({ x: i, y: j });
        }
    }
}
