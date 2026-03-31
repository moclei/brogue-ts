/*
 *  io-wiring.ts — Shared IO closure factories for context builders
 *  Port V2 — rogue-ts
 *
 *  Exports factory functions that build ready-to-call closures for the IO
 *  stubs that appear in many context builders.  All factories read live
 *  game state at call time via getGameState() and render-state.ts.
 *
 *  Phase 1 wiring: message, refreshDungeonCell, refreshSideBar, combatMessage.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "./core.js";
import { alertMonster as alertMonsterFn } from "./monsters/monster-state.js";
import { monstersAreTeammates, monstersAreEnemies as monstersAreEnemiesFn } from "./monsters/monster-queries.js";
import { CreatureState, CreatureMode, StatusEffect } from "./types/enums.js";
import {
    exposeCreatureToFire as exposeCreatureToFireFn,
    updateFlavorText as updateFlavorTextFn,
} from "./time/creature-effects.js";
import type { CreatureEffectsContext } from "./time/creature-effects.js";
import { fireForeColor, torchLightColor, badMessageColor, white, yellow, interfaceBoxColor } from "./globals/colors.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "./io/color.js";
import type { Creature } from "./types/types.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { statusEffectCatalog } from "./globals/status-effects.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { monsterText } from "./globals/monster-text.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import {
    getCellAppearance,
    refreshDungeonCell as refreshDungeonCellFn,
    displayLevel as displayLevelFn,
} from "./io/cell-appearance.js";
import { refreshSideBar as refreshSideBarFn } from "./io/sidebar-monsters.js";
import {
    message as messageFn,
    messageWithColor as messageWithColorFn,
    confirmMessages as confirmMessagesFn,
    temporaryMessage as temporaryMessageFn,
    combatMessage as combatMessageFn,
    updateMessageDisplay as updateMessageDisplayFn,
    flavorMessage as flavorMessageFn,
} from "./io/messages.js";
import { buildMessageContext, buildInventoryContext } from "./ui.js";
import {
    getHallucinatedItemCategory,
    getItemCategoryGlyph,
} from "./items/item-generation.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import {
    monsterName as monsterNameFn,
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
    monsterIsInClass as monsterIsInClassFn,
} from "./monsters/monster-queries.js";
import { monsterDetails as monsterDetailsFn } from "./monsters/monster-details.js";
import type { MonsterDetailsContext } from "./monsters/monster-details.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "./state/helpers.js";
import {
    layerWithTMFlag as layerWithTMFlagFn,
    layerWithFlag as layerWithFlagFn,
    highestPriorityLayer as highestPriorityLayerFn,
    tileFlavor as tileFlavorFn,
    describeLocation as describeLocationFn,
    type DescribeLocationContext,
} from "./movement/map-queries.js";
import {
    printProgressBar,
    describeHallucinatedItem as describeHallucinatedItemFn,
} from "./io/sidebar-player.js";
import { displayedArmorValue, estimatedArmorValue } from "./items/item-usage.js";
import { itemAtLoc as itemAtLocFn, numberOfMatchingPackItems as numberOfMatchingPackItemsFn } from "./items/item-inventory.js";
import {
    wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "./globals/item-catalog.js";
import { charmRechargeDelay as charmRechargeDelayFn } from "./power/power-tables.js";
import type { MessageContext as SyncMessageContext } from "./io/messages-state.js";
import { TileFlag, ButtonFlag, MonsterBookkeepingFlag } from "./types/flags.js";
import { hitProbability, monsterDamageAdjustmentAmount } from "./combat/combat-math.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { randPercent } from "./math/rng.js";
import { encodeMessageColor, applyColorAugment, separateColors } from "./io/color.js";
import { buildResolvePronounEscapesFn } from "./io/text.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import type { Color, Pos, ItemTable, Item, BrogueButton } from "./types/types.js";
import { COLS, ROWS, KEYBOARD_LABELS, RETURN_KEY, ACKNOWLEDGE_KEY, ESCAPE_KEY, DCOLS, DROWS } from "./types/constants.js";
import { printTextBox as printTextBoxFn } from "./io/inventory.js";
import { initializeButton as initializeButtonFn } from "./io/buttons.js";
import {
    plotCharWithColor as plotCharWithColorFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    mapToWindow,
} from "./io/display.js";
import type { DisplayGlyph } from "./types/enums.js";
import type { SidebarContext } from "./io/sidebar-player.js";
import {
    promptForItemOfType as promptForItemOfTypeFn,
    type PromptItemContext,
} from "./io/inventory-display.js";
import { commitDraws as commitDrawsFn, pauseAndCheckForEvent } from "./platform.js";

/** Returns a getCellAppearance closure using the full pipeline. */
export function buildGetCellAppearanceFn(): (loc: Pos) => { glyph: DisplayGlyph; foreColor: Color; backColor: Color } {
    const {
        pmap, tmap, rogue, player, monsters, dormantMonsters,
        floorItems, monsterCatalog, displayBuffer,
    } = getGameState();
    const scentMap = getScentMap() ?? [];
    return (loc: Pos) => getCellAppearance(
        loc, pmap, tmap, displayBuffer, rogue, player,
        monsters, dormantMonsters, floorItems,
        tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        terrainRandomValues, displayDetail, scentMap,
    );
}

/** Returns a refreshDungeonCell closure. */
export function buildRefreshDungeonCellFn(): (loc: Pos) => void {
    const getCellApp = buildGetCellAppearanceFn();
    const { displayBuffer } = getGameState();
    return (loc: Pos) => refreshDungeonCellFn(loc, getCellApp, displayBuffer);
}

/** Returns a hiliteCell closure for targeting contexts. C: hiliteCell() in IO.c. */
export function buildHiliteCellFn(): (x: number, y: number, color: Readonly<Color>, strength: number, distinctColors: boolean) => void {
    const getCellApp = buildGetCellAppearanceFn();
    const { displayBuffer } = getGameState();
    return (x, y, color, strength, distinctColors) => {
        const { glyph, foreColor, backColor } = getCellApp({ x, y });
        applyColorAugment(foreColor, color, strength);
        applyColorAugment(backColor, color, strength);
        if (distinctColors) separateColors(foreColor, backColor);
        plotCharWithColorFn(glyph, mapToWindow({ x, y }), foreColor, backColor, displayBuffer);
    };
}

// =============================================================================
// buildRefreshSideBarFn
// =============================================================================

/**
 * Returns a `() => void` closure that redraws the sidebar at the player's
 * current position using the full SidebarContext.
 */
export function buildRefreshSideBarFn(): () => void {
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
        cellHasGas: () => false as const,
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

    // Build the partial context first (without self-referential methods), then patch in.
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
        playerInDarkness: () => false,          // stub — light state not wired yet
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
            } as unknown as import("./items/item-usage.js").EquipmentState),
        estimatedArmorValue: () =>
            estimatedArmorValue({
                player,
                armor: rogue.armor,
                weapon: rogue.weapon,
                strength: rogue.strength,
            } as unknown as import("./items/item-usage.js").EquipmentState),

        cellHasTMFlag,
        layerWithTMFlag: (x, y, flag) => layerWithTMFlagFn(pmap, x, y, flag),

        monsterDetails: (monst) => {
            const resolvePronounEscapes = buildResolvePronounEscapesFn(player, pmap, rogue);
            const mqCtxLocal = {
                player, cellHasTerrainFlag: (pos: Pos, flags: number) => cellHasTerrainFlagFn(pmap, pos, flags),
                cellHasGas: () => false as const,
                playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                playbackOmniscience: rogue.playbackOmniscience,
            };
            const detailsCtx: MonsterDetailsContext = {
                player,
                rogue: { weapon: rogue.weapon, armor: rogue.armor, strength: rogue.strength },
                packItems,
                boltCatalog,
                staffTable: staffTable as unknown as import("./types/types.js").ItemTable[],
                wandTable: wandTable as unknown as import("./types/types.js").ItemTable[],
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
        itemDetails: () => "",                  // stub — Phase 7
        printTextBox: () => 0,                  // stub — Phase 7
        printProgressBar: () => {},             // patched below
    };

    // Patch self-referential methods
    (partialCtx as SidebarContext).describeHallucinatedItem = () =>
        describeHallucinatedItemFn(partialCtx as SidebarContext);
    (partialCtx as SidebarContext).printProgressBar = (x, y, label, amtFilled, amtMax, fillColor, dim) =>
        printProgressBar(x, y, label, amtFilled, amtMax, fillColor, dim, displayBuffer);

    const sidebarCtx = partialCtx as SidebarContext;
    return () => {
        const { player: p } = getGameState();
        refreshSideBarFn(p.loc.x, p.loc.y, false, sidebarCtx);
    };
}

// =============================================================================
// buildMessageFns
// =============================================================================

/**
 * Returns a wakeUp closure that alerts a monster and its teammates.
 *
 * Covers the essential alert + ticksUntilTurn logic from wakeUp() in Monsters.c.
 * The full updateMonsterState(teammate) call is deferred until MonsterStateContext
 * is fully wired.
 *
 * @param player   The player creature (for ally checks).
 * @param monsters Active monsters list.
 */
export function buildWakeUpFn(player: Creature, monsters: Creature[]): (monst: Creature) => void {
    return function wakeUp(monst: Creature): void {
        if (monst.creatureState !== CreatureState.Ally) {
            alertMonsterFn(monst, player);
        }
        monst.ticksUntilTurn = 100;
        for (const teammate of monsters) {
            if (
                monst !== teammate &&
                monstersAreTeammates(monst, teammate, player) &&
                teammate.creatureMode === CreatureMode.Normal
            ) {
                if (
                    teammate.creatureState === CreatureState.Sleeping ||
                    teammate.creatureState === CreatureState.Wandering
                ) {
                    teammate.ticksUntilTurn = Math.max(100, teammate.ticksUntilTurn);
                }
                if (monst.creatureState !== CreatureState.Ally) {
                    alertMonsterFn(teammate, player);
                }
            }
        }
    };
}

/**
 * Returns message function closures wired to a MessageContext built from
 * the current game state.
 *
 * Build once per context-builder invocation; the MessageContext holds live
 * references so it stays current for the lifetime of the turn.
 */
export function buildMessageFns(): {
    message: (msg: string, flags: number) => Promise<void>;
    messageWithColor: (msg: string, color: Readonly<Color>, flags: number) => Promise<void>;
    confirmMessages: () => void;
    temporaryMessage: (msg: string, flags: number) => Promise<void>;
    combatMessage: (msg: string, color: Readonly<Color> | null) => Promise<void>;
    updateMessageDisplay: () => void;
} {
    const ctx = buildMessageContext() as unknown as SyncMessageContext;
    return {
        message: (msg, flags) => messageFn(ctx, msg, flags),
        messageWithColor: (msg, color, flags) => messageWithColorFn(ctx, msg, color, flags),
        confirmMessages: () => confirmMessagesFn(ctx),
        temporaryMessage: (msg, flags) => temporaryMessageFn(ctx, msg, flags),
        combatMessage: (msg, color) => combatMessageFn(ctx, msg, color),
        updateMessageDisplay: () => updateMessageDisplayFn(ctx),
    };
}

// =============================================================================
// buildExposeCreatureToFireFn
// =============================================================================

/**
 * Returns an `exposeCreatureToFire(monst)` closure wired to the current game
 * state.
 *
 * Supplies the minimal fields of CreatureEffectsContext needed by the function:
 * cellHasTMFlag, combatMessage, canDirectlySeeMonster, monsterName,
 * messageColorFromVictim, refreshDungeonCell, and colour constants.
 */
export function buildExposeCreatureToFireFn(): (monst: Creature) => void {
    const { player, rogue, pmap } = getGameState();
    const cellHasTMFlag = (pos: import("./types/types.js").Pos, flags: number) =>
        cellHasTMFlagFn(pmap, pos, flags);
    const cellHasTerrainFlag = (pos: import("./types/types.js").Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, pos, flags);
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    const io = buildMessageFns();
    const mqCtxFire = {
        player,
        cellHasTerrainFlag,
        cellHasGas: () => false as const,
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };
    return (monst: Creature): void => {
        exposeCreatureToFireFn(monst, {
            player,
            rogue: { minersLight: rogue.minersLight },
            cellHasTMFlag,
            canDirectlySeeMonster: (m: Creature) => canDirectlySeeMonsterFn(m, mqCtxFire),
            monsterName(buf: string[], m: Creature, includeArticle: boolean): void {
                if (m === player) { buf[0] = "you"; return; }
                const pfx = includeArticle
                    ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                buf[0] = `${pfx}${m.info.monsterName}`;
            },
            combatMessage: io.combatMessage,
            messageColorFromVictim: (m: Creature) => messageColorFromVictimFn(
                m, player,
                player.status[StatusEffect.Hallucinating] > 0,
                rogue.playbackOmniscience,
                (a: Creature, b: Creature) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
            ),
            refreshDungeonCell,
            badMessageColor,
            fireForeColor,
            torchLightColor,
            max: Math.max,
        } as unknown as CreatureEffectsContext);
    };
}

// =============================================================================
// buildPromptForItemOfTypeFn
// =============================================================================

/**
 * Returns a `promptForItemOfType(cat, req, forbidden, prompt, allowInventory)`
 * closure wired to the current game state.
 *
 * Builds a PromptItemContext by extending the InventoryContext from
 * buildInventoryContext() with temporaryMessage and numberOfMatchingPackItems.
 *
 * Note: until buttonInputLoop is fully wired (Phase 7a), displayInventory
 * immediately cancels and promptForItemOfType always returns null.
 */
export function buildPromptForItemOfTypeFn(): (
    category: number,
    requiredFlags: number,
    forbiddenFlags: number,
    prompt: string,
    allowInventoryActions: boolean,
) => Promise<Item | null> {
    const io = buildMessageFns();
    return (category, requiredFlags, forbiddenFlags, prompt, allowInventoryActions) => {
        const invCtx = buildInventoryContext();
        const { packItems } = invCtx;
        const ctx = {
            ...invCtx,
            temporaryMessage: io.temporaryMessage,
            numberOfMatchingPackItems: (cat: number, req: number, forbidden: number) =>
                numberOfMatchingPackItemsFn(packItems, cat, req, forbidden),
        } as unknown as PromptItemContext;
        return promptForItemOfTypeFn(category, requiredFlags, forbiddenFlags, prompt, allowInventoryActions, ctx);
    };
}

// =============================================================================
// buildConfirmFn
// =============================================================================

/**
 * Returns an async `(prompt, defaultYes) => Promise<boolean>` closure that
 * shows a Yes/No dialog box and waits for the player's response.
 *
 * Mirrors the C `confirm()` in IO.c:2933. Uses `printTextBox` from
 * io/inventory.ts with the full InventoryContext for button rendering and
 * input loop.
 *
 * Returns true immediately (auto-confirm) during autoplay or playback.
 */
export function buildConfirmFn(): (prompt: string, defaultYes: boolean) => Promise<boolean> {
    return async (prompt: string, _defaultYes: boolean): Promise<boolean> => {
        const { rogue, displayBuffer } = getGameState();
        if (rogue.autoPlayingLevel || rogue.playbackMode) return true;

        const whiteEsc = encodeMessageColor(white);
        const yellowEsc = KEYBOARD_LABELS ? encodeMessageColor(yellow) : encodeMessageColor(white);

        const btn0: BrogueButton = initializeButtonFn();
        btn0.text = `     ${yellowEsc}Y${whiteEsc}es     `;
        btn0.hotkey = ["y".charCodeAt(0), "Y".charCodeAt(0), RETURN_KEY];
        btn0.flags |= ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_KEYPRESS_HIGHLIGHT;

        const btn1: BrogueButton = initializeButtonFn();
        btn1.text = `     ${yellowEsc}N${whiteEsc}o      `;
        btn1.hotkey = ["n".charCodeAt(0), "N".charCodeAt(0), ACKNOWLEDGE_KEY, ESCAPE_KEY];
        btn1.flags |= ButtonFlag.B_WIDE_CLICK_AREA | ButtonFlag.B_KEYPRESS_HIGHLIGHT;

        const invCtx = buildInventoryContext();
        const rbuf = saveDisplayBufferFn(displayBuffer);
        const retVal = await printTextBoxFn(
            prompt,
            Math.floor(COLS / 3),
            Math.floor(ROWS / 3),
            Math.floor(COLS / 3),
            white,
            interfaceBoxColor,
            invCtx,
            [btn0, btn1],
            2,
        );
        restoreDisplayBufferFn(displayBuffer, rbuf);
        return retVal !== -1 && retVal !== 1;
    };
}

// =============================================================================
// buildDisplayLevelFn
// =============================================================================

/**
 * Returns a `() => void` closure that redraws every dungeon cell.
 * Faithful port of displayLevel() in IO.c — iterates all DCOLS×DROWS cells.
 *
 * Used by context builders in items.ts and input-context.ts that previously
 * stubbed displayLevel as a no-op.
 */
export function buildDisplayLevelFn(): () => void {
    const {
        pmap, tmap, rogue, player, monsters, dormantMonsters,
        floorItems, monsterCatalog, displayBuffer,
    } = getGameState();
    const scentMap = getScentMap() ?? [];
    const getCellApp = (loc: Pos) => getCellAppearance(
        loc, pmap, tmap, displayBuffer, rogue, player,
        monsters, dormantMonsters, floorItems,
        tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        terrainRandomValues, displayDetail, scentMap,
    );
    return () => displayLevelFn(DCOLS, DROWS, (loc) => refreshDungeonCellFn(loc, getCellApp, displayBuffer));
}

/** C: updateFlavorText() in Time.c */
export function buildUpdateFlavorTextFn(): () => void {
    return () => {
        const { pmap, player, rogue, displayBuffer, floorItems } = getGameState();
        const plotChar = (ch: number, pos: { windowX: number; windowY: number }, fg: Readonly<Color>, bg: Readonly<Color>) =>
            plotCharWithColorFn(ch as import("./types/enums.js").DisplayGlyph, pos, fg, bg, displayBuffer);
        const msgCtx = { displayBuffer, plotCharWithColor: plotChar } as unknown as SyncMessageContext;
        updateFlavorTextFn({
            rogue: rogue as unknown as CreatureEffectsContext["rogue"],
            player,
            pmapAt: (pos: Pos) => pmap[pos.x][pos.y],
            tileCatalog: tileCatalog as unknown as CreatureEffectsContext["tileCatalog"],
            highestPriorityLayer: (x: number, y: number, skipGas: boolean) =>
                highestPriorityLayerFn(pmap, x, y, skipGas),
            flavorMessage: (msg: string) => flavorMessageFn(msgCtx, msg),
            describeLocation: (buf: string[], x: number, y: number) => {
                buf[0] = describeLocationFn(x, y, {
                    pmap,
                    player,
                    itemAtLoc: (loc: Pos) => {
                        for (const item of floorItems) {
                            if (item.loc.x === loc.x && item.loc.y === loc.y) return item;
                        }
                        return null;
                    },
                } as unknown as DescribeLocationContext);
            },
            tileFlavor: (x: number, y: number) =>
                tileFlavorFn(pmap, x, y, (pm, px, py, sg) => highestPriorityLayerFn(pm, px, py, sg)),
        } as unknown as CreatureEffectsContext);
    };
}

/** Returns colorFlash closure — expanding radius animation. C: IO.c:2058. */
export function buildColorFlashFn(): (
    color: Color, flags: number, tileFlags: number,
    frames: number, maxRadius: number, x: number, y: number,
) => Promise<void> {
    const hiliteFn = buildHiliteCellFn();
    return async (color, _flags, tileFlags, frames, maxRadius, x, y) => {
        const { pmap } = getGameState();
        type Cell = { i: number; j: number; r: number };
        const cells: Cell[] = [];
        for (let i = Math.max(x - maxRadius, 0); i <= Math.min(x + maxRadius, DCOLS - 1); i++) {
            for (let j = Math.max(y - maxRadius, 0); j <= Math.min(y + maxRadius, DROWS - 1); j++) {
                const d2 = (i - x) * (i - x) + (j - y) * (j - y);
                if (d2 <= maxRadius * maxRadius && (!tileFlags || (pmap[i][j].flags & tileFlags)))
                    cells.push({ i, j, r: Math.sqrt(d2) });
            }
        }
        if (!cells.length) return;
        let ff = false;
        for (let k = 1; k <= frames; k++) {
            const curR = Math.max(1, Math.trunc(maxRadius * k / frames));
            const fadeOut = Math.min(100, Math.trunc((frames - k) * 500 / frames));
            for (const { i, j, r } of cells) {
                if (r <= curR) {
                    const raw = 100 - Math.trunc(100 * (curR - r - 2) / curR);
                    hiliteFn(i, j, color, Math.trunc(fadeOut * raw / 100), false);
                }
            }
            commitDrawsFn();
            if (!ff && await pauseAndCheckForEvent(50)) { k = frames - 1; ff = true; }
        }
    };
}
