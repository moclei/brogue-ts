/*
 *  io/sidebar-wiring.ts — Shared sidebar and location-description context builders
 *  Port V2 — rogue-ts
 *
 *  Exports:
 *    buildSidebarContext()            — fresh SidebarContext (reads live state at call time)
 *    buildRefreshSideBarWithFocusFn() — (x, y, justClearing) => void
 *    buildPrintLocationDescriptionFn() — (x, y) => void
 *
 *  Used by item-commands.ts and staff-wiring.ts to wire refreshSideBar and
 *  printLocationDescription in the chooseTarget context (B11 fix), and by
 *  input-context.ts for printMonsterDetails in the general cursor mode.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "../core.js";
import { getCellAppearance } from "./cell-appearance.js";
import { refreshSideBar as refreshSideBarFn } from "./sidebar-monsters.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { statusEffectCatalog } from "../globals/status-effects.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { monsterText } from "../globals/monster-text.js";
import { terrainRandomValues, displayDetail } from "../render-state.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import {
    layerWithTMFlag as layerWithTMFlagFn,
    layerWithFlag as layerWithFlagFn,
    printLocationDescription as printLocationDescriptionFn,
    type DescribeLocationContext,
} from "../movement/map-queries.js";
import {
    printProgressBar,
    describeHallucinatedItem as describeHallucinatedItemFn,
    type SidebarContext,
} from "./sidebar-player.js";
import { displayedArmorValue } from "../items/item-usage.js";
import { itemAtLoc as itemAtLocFn } from "../items/item-inventory.js";
import { itemName as itemNameFn } from "../items/item-naming.js";
import {
    getHallucinatedItemCategory,
    getItemCategoryGlyph,
} from "../items/item-generation.js";
import { wandTable, staffTable, ringTable, charmTable, charmEffectTable } from "../globals/item-catalog.js";
import { charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import {
    monsterName as monsterNameFn,
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
    monsterIsInClass as monsterIsInClassFn,
    monsterRevealed as monsterRevealedFn,
} from "../monsters/monster-queries.js";
import { monsterDetails as monsterDetailsFn, type MonsterDetailsContext } from "../monsters/monster-details.js";
import { monsterCanSubmergeNow as monsterCanSubmergeNowFn } from "../monsters/monster-spawning.js";
import { hitProbability, monsterDamageAdjustmentAmount } from "../combat/combat-math.js";
import { monsterClassCatalog } from "../globals/monster-class-catalog.js";
import { randPercent } from "../math/rng.js";
import { encodeMessageColor, storeColorComponents as storeColorComponentsFn } from "./color.js";
import { buildResolvePronounEscapesFn } from "./text.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import {
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    applyOverlay as applyOverlayFn,
    mapToWindowX,
    mapToWindowY,
    plotCharWithColor as plotCharWithColorFn,
} from "./display.js";
import {
    strLenWithoutEscapes as strLenWithoutEscapesFn,
    wrapText as wrapTextFn,
    printStringWithWrapping as printStringWithWrappingFn,
} from "./text.js";
import { printTextBox as printTextBoxFn } from "./inventory.js";
import { flavorMessage as flavorMessageFn } from "./messages.js";
import type { MessageContext as SyncMessageContext } from "./messages-state.js";
import type { InventoryContext } from "./inventory.js";
import { TileFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import type { Color, Pos, ItemTable, Creature, ScreenDisplayBuffer } from "../types/types.js";
import { DungeonLayer } from "../types/enums.js";
import type { DisplayGlyph } from "../types/enums.js";

// =============================================================================
// buildSidebarContext — build a fresh SidebarContext from live game state
// =============================================================================

/**
 * Reads live game state and returns a fully-wired SidebarContext.
 * Called at invocation time (not at factory time) so always has fresh state.
 * Used by buildRefreshSideBarWithFocusFn and for printMonsterDetails in
 * the general cursor mode.
 */
export function buildSidebarContext(): SidebarContext {
    const {
        rogue, player, pmap, tmap, monsters,
        floorItems, monsterCatalog, displayBuffer,
        mutableScrollTable, mutablePotionTable, gameConst, packItems,
    } = getGameState();
    const scentMap = getScentMap() ?? [];

    const getCellApp = (loc: Pos) => getCellAppearance(
        loc, pmap, tmap, displayBuffer, rogue, player,
        monsters, [], floorItems,
        tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        terrainRandomValues, displayDetail, scentMap,
    );

    const cellHasTerrainFlag = (pos: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const cellHasTMFlag = (pos: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);
    const mqCtx = {
        player,
        cellHasTerrainFlag,
        cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    const namingCtx = {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],
        charmRechargeDelay: (kind: number, enchant: number) =>
            charmRechargeDelayFn(charmEffectTable[kind], enchant),
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: (classId: number) =>
            monsterCatalog[classId]?.monsterName ?? "creature",
    };

    // Minimal InventoryContext for no-buttons printTextBox calls
    const invCtx = {
        createScreenDisplayBuffer: createScreenDisplayBufferFn,
        clearDisplayBuffer: clearDisplayBufferFn,
        overlayDisplayBuffer: (dbuf: Readonly<ScreenDisplayBuffer>) => applyOverlayFn(displayBuffer, dbuf),
        printStringWithWrapping: printStringWithWrappingFn,
        wrapText: wrapTextFn,
        mapToWindowX,
        mapToWindowY,
        strLenWithoutEscapes: strLenWithoutEscapesFn,
        storeColorComponents: storeColorComponentsFn,
        buttonInputLoop: () => Promise.resolve({ chosenButton: -1, event: {} as never }),
    } as unknown as InventoryContext;

    const partialCtx: Omit<SidebarContext, "describeHallucinatedItem" | "printProgressBar"> & {
        describeHallucinatedItem: () => string;
        printProgressBar: SidebarContext["printProgressBar"];
    } = {
        rogue,
        player,
        pmap,
        tileCatalog: tileCatalog as SidebarContext["tileCatalog"],
        displayBuffer,
        statusEffectCatalog: statusEffectCatalog as SidebarContext["statusEffectCatalog"],
        mutationCatalog: mutationCatalog as SidebarContext["mutationCatalog"],
        monsterText: monsterText as SidebarContext["monsterText"],

        monsterAtLoc(loc) {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
            return monsters.find(
                m => m.loc.x === loc.x && m.loc.y === loc.y &&
                    !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
            ) ?? null;
        },
        itemAtLoc: (loc) => itemAtLocFn(loc, floorItems),
        canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, mqCtx),
        playerCanSeeOrSense: (x, y) =>
            !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
        playerCanDirectlySee: (x, y) =>
            !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerInDarkness: () => false,
        iterateMonsters: () => monsters,
        floorItems: () => floorItems,

        monsterName: (monst, includeArticle) =>
            monsterNameFn(monst, includeArticle, mqCtx),
        itemName: (theItem, includeDetails, includeArticle) =>
            itemNameFn(theItem, includeDetails, includeArticle, namingCtx),

        getHallucinatedItemCategory: () => getHallucinatedItemCategory({
            randRange: (lo: number) => lo,
            randPercent: () => false,
            randClump: (r: { lowerBound: number }) => r.lowerBound,
        }),
        getItemCategoryGlyph: (cat) => getItemCategoryGlyph(cat),
        describeHallucinatedItem: () => "",     // patched below

        getCellAppearance: getCellApp,

        displayedArmorValue: () =>
            displayedArmorValue({
                player,
                armor: rogue.armor,
                weapon: rogue.weapon,
                strength: rogue.strength,
            } as unknown as import("../items/item-usage.js").EquipmentState),
        estimatedArmorValue: () => 0,

        cellHasTMFlag,
        layerWithTMFlag: (x, y, flag) => layerWithTMFlagFn(pmap, x, y, flag),

        monsterDetails: (monst) => {
            const resolvePronounEscapes = buildResolvePronounEscapesFn(player, pmap, rogue);
            const mqCtxLocal = {
                player, cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
                cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
                playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                playbackOmniscience: rogue.playbackOmniscience,
            };
            const detailsCtx: MonsterDetailsContext = {
                player,
                rogue: { weapon: rogue.weapon, armor: rogue.armor, strength: rogue.strength },
                packItems,
                boltCatalog,
                staffTable: staffTable as unknown as import("../types/types.js").ItemTable[],
                wandTable: wandTable as unknown as import("../types/types.js").ItemTable[],
                monsterText,
                mutationCatalog,
                tileCatalog,
                monsterName: (m, inc) => monsterNameFn(m, inc, mqCtxLocal),
                monsterIsInClass: (m, cls) => monsterIsInClassFn(m, monsterClassCatalog[cls] ?? { memberList: [] } as never),
                resolvePronounEscapes: (text, m) => resolvePronounEscapes(text, m),
                hitProbability: (att, def) => hitProbability(att, def, {
                    player, weapon: rogue.weapon, armor: rogue.armor,
                    playerStrength: rogue.strength, monsterClassCatalog, randPercent,
                }),
                monsterDamageAdjustment: (m) => monsterDamageAdjustmentAmount(m, player),
                itemName: (item, incDet, incArt) => itemNameFn(item, incDet, incArt, namingCtx),
                encodeMessageColor: (color) => encodeMessageColor(color),
                cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
                cellHasTMFlag: (loc, flag) => cellHasTMFlagFn(pmap, loc, flag),
                layerWithFlag: (x, y, flag) => layerWithFlagFn(pmap, x, y, flag),
            };
            return monsterDetailsFn(monst, detailsCtx);
        },
        itemDetails: () => "",                  // stub — itemDetails not yet ported

        printTextBox: (text, x, y, width, fg, bg) => {
            // No-buttons variant: fire-and-forget (async body is sync with no buttons).
            void printTextBoxFn(text, x, y, width, fg, bg, invCtx);
            return -1;
        },
        printProgressBar: () => {},             // patched below
    };

    (partialCtx as SidebarContext).describeHallucinatedItem = () =>
        describeHallucinatedItemFn(partialCtx as SidebarContext);
    (partialCtx as SidebarContext).printProgressBar = (x, y, label, amtFilled, amtMax, fillColor, dim) =>
        printProgressBar(x, y, label, amtFilled, amtMax, fillColor, dim, displayBuffer);

    return partialCtx as SidebarContext;
}

// =============================================================================
// buildRefreshSideBarWithFocusFn — sidebar refresh with dynamic focus position
// =============================================================================

/**
 * Returns a closure `(x, y, justClearing) => void` that refreshes the sidebar
 * focused on the given map position. Used in the chooseTarget context so
 * hovering over a monster/item updates the sidebar display.
 */
export function buildRefreshSideBarWithFocusFn(): (x: number, y: number, justClearing: boolean) => void {
    return (x, y, justClearing) => {
        refreshSideBarFn(x, y, justClearing, buildSidebarContext());
    };
}

// =============================================================================
// buildPrintLocationDescriptionFn — flavor text for cursor location
// =============================================================================

/**
 * Returns a closure `(x, y) => void` that prints a terrain/entity description
 * for the cell at (x, y) into the flavor-text area. Used in the chooseTarget
 * context and the general cursor mode.
 */
export function buildPrintLocationDescriptionFn(): (x: number, y: number) => void {
    return (x: number, y: number) => {
        const { pmap, player, rogue, floorItems, monsters, displayBuffer,
            mutableScrollTable, mutablePotionTable } = getGameState();
        const plotChar = (ch: number, pos: { windowX: number; windowY: number }, fg: Readonly<Color>, bg: Readonly<Color>) =>
            plotCharWithColorFn(ch as DisplayGlyph, pos, fg, bg, displayBuffer);
        const msgCtx = { displayBuffer, plotCharWithColor: plotChar } as unknown as SyncMessageContext;
        // Skip MB_HAS_DIED — matches C iterateCreatures() (B112)
        const monsterAtLoc = (loc: Pos): Creature | null => {
            if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
            return monsters.find(
                m => m.loc.x === loc.x && m.loc.y === loc.y &&
                    !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED),
            ) ?? null;
        };
        const cellHasTerrainFlag = (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags);
        const cellHasTMFlag = (pos: Pos, flags: number) => cellHasTMFlagFn(pmap, pos, flags);
        const mqCtx = {
            player,
            cellHasTerrainFlag,
            cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
            playerCanSee: (px: number, py: number) => !!(pmap[px]?.[py]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (px: number, py: number) => !!(pmap[px]?.[py]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: rogue.playbackOmniscience,
        };
        printLocationDescriptionFn(x, y, {
            pmap,
            player,
            rogue: { scentTurnNumber: rogue.scentTurnNumber, disturbed: rogue.disturbed, automationActive: rogue.automationActive },
            scentMap: getScentMap() ?? [],
            terrainFlags: () => 0,
            terrainMechFlags: () => 0,
            cellHasTerrainFlag,
            cellHasTMFlag,
            coordinatesAreInMap: (cx: number, cy: number) => !!(pmap[cx]?.[cy]),
            playerCanSee: (px: number, py: number) => !!(pmap[px]?.[py]?.flags & TileFlag.VISIBLE),
            monsterAtLoc,
            dormantMonsterAtLoc: () => null,
            canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
            monsterRevealed: (m: Creature) => monsterRevealedFn(m, player),
            refreshDungeonCell: () => {},
            dungeonFeatureCatalog,
            itemAtLoc: (loc: Pos) => floorItems.find(i => i.loc.x === loc.x && i.loc.y === loc.y) ?? null,
            nbDirs: [],
            spawnDungeonFeature: () => {},
            // DescribeLocationContext extensions:
            playerCanSeeOrSense: (px: number, py: number) =>
                !!(pmap[px]?.[py]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
            playerCanDirectlySee: (px: number, py: number) => !!(pmap[px]?.[py]?.flags & TileFlag.VISIBLE),
            itemMagicPolarity: () => 0,
            monsterName: (m: Creature, incArt: boolean) => monsterNameFn(m, incArt, mqCtx),
            monsterCanSubmergeNow: (m: Creature) => monsterCanSubmergeNowFn(m, cellHasTMFlag, cellHasTerrainFlag),
            describedItemName: (item: import("../types/types.js").Item, maxLen: number) =>
                itemNameFn(item, false, false,
                { gameConstants: {}, depthLevel: rogue.depthLevel, potionTable: mutablePotionTable, scrollTable: mutableScrollTable,
                  wandTable, staffTable, ringTable, charmTable, charmEffectTable,
                  playbackOmniscience: rogue.playbackOmniscience,
                  monsterClassName: () => "creature" } as never).slice(0, maxLen),
            describedItemBasedOnParameters: () => "an item",
            describeHallucinatedItem: () => "something strange",
            cosmeticRandRange: (lo: number) => lo,
            playbackOmniscience: rogue.playbackOmniscience,
            flavorMessage: (msg: string) => flavorMessageFn(msgCtx, msg),
        } as unknown as DescribeLocationContext);
    };
}
