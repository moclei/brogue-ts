/*
 *  items/item-commands.ts — throwCommand and call command wiring factories
 *  Port V2 — rogue-ts
 *
 *  Exports buildThrowCommandFn() and buildCallCommandFn().
 *  Both accept an ItemCommandDeps object for messaging (avoiding the
 *  ui.ts ↔ io-wiring.ts circular import chain) and read game state via
 *  getGameState().
 *
 *  throwCommand: chooseTarget (targeting cursor) → throwItem (flight + land)
 *  call:         inscribeItem (name-entry) → playerTurnEnded
 *
 *  NOTE — Interactive targeting requires Phase 2 (async event bridge).
 *  In the browser the moveCursor wrapper awaits waitForEvent() per call so
 *  the targeting loop receives real keypresses.  getInputTextString is
 *  stubbed to return null until Phase 2 wires synchronous event delivery.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver } from "../core.js";
import { buildApplyInstantTileEffectsFn } from "../tile-effects-wiring.js";
import { waitForEvent, commitDraws, pauseAndCheckForEvent } from "../platform.js";
import { moveCursor as moveCursorFn, type MoveCursorContext } from "../io/cursor-move.js";
import { chooseTarget } from "./targeting.js";
import { throwItem } from "./throw-item.js";
import type { ThrowItemContext, HitMonsterContext } from "./throw-item.js";
import { inscribeItem } from "./item-call.js";
import { itemCanBeCalled } from "./item-utils.js";
import { attackHit as attackHitFn } from "../combat/combat-math.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
} from "../combat/combat-damage.js";
import type { CombatDamageContext } from "../combat/combat-damage.js";
import { buildFadeInMonsterFn } from "../combat.js";
import { damageFraction } from "../power/power-tables.js";
import { wandDominate } from "../power/power-tables.js";
import { netEnchant as netEnchantFn } from "./item-usage.js";
import { autoIdentify as autoIdentifyFn } from "./item-handlers.js";
import { getQualifyingLocNear as getQualifyingLocNearFn } from "../architect/architect.js";
import { placeItemAt as placeItemAtFn } from "./floor-items.js";
import type { PlaceItemAtContext } from "./floor-items.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "../architect/machines.js";
import { promoteTile as promoteTileFn } from "../time/environment.js";
import type { EnvironmentContext } from "../time/environment.js";
import {
    highestPriorityLayer as highestPriorityLayerFn,
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import { removeItemFromArray } from "./item-inventory.js";
import { layerWithTMFlag as layerWithTMFlagFn } from "../movement/map-queries.js";
import {
    monstersAreTeammates as monstersAreTeammatesFn,
    monstersAreEnemies as monstersAreEnemiesFn,
} from "../monsters/monster-queries.js";
import { distanceBetween } from "../monsters/monster-state.js";
import { openPathBetween } from "./bolt-geometry.js";
import { negationWillAffectMonster as negationWillAffectMonsterFn } from "./bolt-helpers.js";
import {
    messageColorFromVictim as messageColorFromVictimFn,
    applyColorMultiplier,
    colorMultiplierFromDungeonLight,
} from "../io/color.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { monsterClassCatalog } from "../globals/monster-class-catalog.js";
import {
    wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "../globals/item-catalog.js";
import { itemName as itemNameFn } from "./item-naming.js";
import { charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import { itemMagicPolarity as itemMagicPolarityFn } from "./item-generation.js";
import { coordinatesAreInMap, mapToWindowX, windowToMapX, windowToMapY } from "../globals/tables.js";
import { randClump, randPercent, randRange, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "../math/rng.js";
import { playerTurnEnded as playerTurnEndedFn } from "../turn.js";
import { badMessageColor, black, clairvoyanceColor, gray, red, white, itemMessageColor } from "../globals/colors.js";
import { anyoneWantABite as anyoneWantABiteFn } from "../combat/combat-helpers.js";
import type { CombatHelperContext } from "../combat/combat-helpers.js";
import { AutoTargetMode, CreatureState, DisplayGlyph, DungeonLayer, EventType, GameMode, StatusEffect } from "../types/enums.js";
import { TerrainFlag, TileFlag } from "../types/flags.js";
import { COLS, DCOLS, DROWS, DELETE_KEY, ESCAPE_KEY, MESSAGE_LINES, RETURN_KEY } from "../types/constants.js";
import type { Color, Creature, Item, ItemTable, Pos, RogueEvent } from "../types/types.js";
import { printString } from "../io/text.js";
import { plotCharToBuffer, plotCharWithColor as plotCharWithColorFn, mapToWindow } from "../io/display.js";
import { buildRefreshDungeonCellFn, buildHiliteCellFn, buildGetCellAppearanceFn } from "../io-wiring.js";
import { buildRefreshSideBarWithFocusFn, buildPrintLocationDescriptionFn } from "../io/sidebar-wiring.js";

// =============================================================================
// ItemCommandDeps — caller-supplied messaging (avoids circular imports)
// =============================================================================

/** Messaging callbacks injected by the caller (ui.ts or input-context.ts). */
export interface ItemCommandDeps {
    message(msg: string, flags: number): void;
    messageWithColor(msg: string, color: Readonly<Color> | null, flags: number): void;
    confirmMessages(): void;
}

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterAtLoc(player: Creature, monsters: Creature[]) {
    return (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

function buildNamingCtx() {
    const { rogue, gameConst, mutablePotionTable, mutableScrollTable } = getGameState();
    return {
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
        monsterClassName: (_classId: number) => "creature",
    };
}

function buildMinCombatDamageCtx(deps: ItemCommandDeps): CombatDamageContext {
    const { player, rogue, pmap, monsters, floorItems, monsterCatalog } = getGameState();
    const canSee = (m: Creature) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
    return {
        player,
        easyMode: rogue.mode === GameMode.Easy,
        transference: rogue.transference,
        playerTransferenceRatio: 20,
        canSeeMonster: canSee,
        canDirectlySeeMonster: canSee,
        wakeUp: () => {},
        spawnDungeonFeature(x, y, featureIndex, _probability, _isGas) {
            const feat = dungeonFeatureCatalog[featureIndex];
            if (feat) spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, true, false);
        },
        refreshSideBar: () => {},
        combatMessage: (msg, color) => deps.messageWithColor(msg, color as Readonly<Color> ?? null, 0),
        messageWithColor: (msg, color) => deps.messageWithColor(msg, color as Readonly<Color> ?? null, 0),
        message: deps.message,
        refreshDungeonCell: () => {},
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        fadeInMonster: buildFadeInMonsterFn(),
        monsterName: (m) => (m === player ? "you" : m.info.monsterName),
        gameOver(msg) { gameOver(msg); },
        setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },
        deleteItem(item) {
            const idx = floorItems.indexOf(item as never);
            if (idx >= 0) floorItems.splice(idx, 1);
        },
        makeMonsterDropItem(monst) {
            if (monst.carriedItem) { floorItems.push(monst.carriedItem); monst.carriedItem = null; }
        },
        clearLastTarget(monst) { if (rogue.lastTarget === monst) rogue.lastTarget = null; },
        clearYendorWarden(monst) { if (rogue.yendorWarden === monst) rogue.yendorWarden = null; },
        clearCellMonsterFlag(loc, isDormant) {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags &= ~(isDormant ? TileFlag.HAS_DORMANT_MONSTER : TileFlag.HAS_MONSTER);
            }
        },
        prependCreature(monst) { monsters.unshift(monst); },
        anyoneWantABite: (decedent) => anyoneWantABiteFn(decedent, {
            player,
            iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
            randRange: (lo: number, hi: number) => randRange(lo, hi),
            isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
            monsterAvoids: () => false,
        } as unknown as CombatHelperContext),
        demoteMonsterFromLeadership: () => {},
        checkForContinuedLeadership: () => {},
        getMonsterDFMessage: () => "",
        resolvePronounEscapes: (s) => s,
        monsterCatalog,
        updateEncumbrance: () => {},
        updateMinersLightRadius: () => {},
        updateVision: () => {},
        badMessageColor,
        poisonColor: badMessageColor,
    };
}

// =============================================================================
// asyncGetInputTextString — async text-entry loop for browser
// =============================================================================

/**
 * Show a text-entry prompt in the message area and read keystrokes via
 * waitForEvent(). Returns the entered string or null if cancelled (Escape).
 *
 * Replicates getInputTextString() (IO.c:2720) in non-dialog mode with
 * TEXT_INPUT_NORMAL bounds (printable ASCII 32–126).
 *
 * C: getInputTextString in IO.c
 */
async function asyncGetInputTextString(
    prompt: string,
    maxLength: number,
    defaultEntry: string,
    promptSuffix: string,
): Promise<string | null> {
    const { displayBuffer } = getGameState();
    const SPACE = 32;
    const TILDE = 126;
    const BACKSPACE = 8;

    // Capitalize and show prompt in the message area (mirrors temporaryMessage)
    const text = prompt.charAt(0).toUpperCase() + prompt.slice(1);
    for (let row = 0; row < MESSAGE_LINES; row++) {
        for (let col = 0; col < DCOLS; col++) {
            plotCharToBuffer(SPACE as DisplayGlyph, mapToWindowX(col), row, black, black, displayBuffer);
        }
    }
    printString(text, mapToWindowX(0), MESSAGE_LINES - 1, white, black, displayBuffer);

    // Cursor position is immediately after the visible prompt text
    const promptVisLen = text.replace(/\x19[\s\S]{3}/g, "").length;
    const baseX = mapToWindowX(promptVisLen);
    const y = MESSAGE_LINES - 1;
    const actualMaxLength = Math.min(maxLength, COLS - baseX);
    const promptSuffixLen = promptSuffix.length;

    // Initialise input buffer from defaultEntry
    const inputChars: number[] = new Array(actualMaxLength).fill(SPACE);
    let charNum = 0;
    if (defaultEntry) {
        const take = Math.min(defaultEntry.length, actualMaxLength);
        for (let i = 0; i < take; i++) { inputChars[i] = defaultEntry.charCodeAt(i); }
        printString(defaultEntry.substring(0, take), baseX, y, white, black, displayBuffer);
        charNum = take;
    }

    const suffix = promptSuffix || " ";

    for (;;) {
        // Render cursor: suffix in gray, first char inverted (black on white)
        printString(suffix, baseX + charNum, y, gray, black, displayBuffer);
        plotCharToBuffer(
            (suffix.charCodeAt(0) || SPACE) as DisplayGlyph,
            baseX + charNum, y, black, white, displayBuffer,
        );
        commitDraws();

        let event: RogueEvent;
        try { event = await waitForEvent(); } catch { return null; }
        if (event.eventType !== EventType.Keystroke) continue;
        const keystroke = event.param1;

        if ((keystroke === DELETE_KEY || keystroke === BACKSPACE) && charNum > 0) {
            printString(suffix, baseX + charNum - 1, y, gray, black, displayBuffer);
            plotCharToBuffer(
                SPACE as DisplayGlyph,
                baseX + charNum + suffix.length - 1, y, black, black, displayBuffer,
            );
            charNum--;
            inputChars[charNum] = SPACE;
        } else if (keystroke >= SPACE && keystroke <= TILDE) {
            inputChars[charNum] = keystroke;
            plotCharToBuffer(keystroke as DisplayGlyph, baseX + charNum, y, white, black, displayBuffer);
            if (charNum < actualMaxLength - promptSuffixLen) {
                printString(suffix, baseX + charNum + 1, y, gray, black, displayBuffer);
                charNum++;
            }
        } else if (keystroke === RETURN_KEY) {
            return String.fromCharCode(...inputChars.slice(0, charNum));
        } else if (keystroke === ESCAPE_KEY) {
            return null;
        }
    }
}

// =============================================================================
// buildThrowCommandFn
// =============================================================================

/**
 * Returns an async function implementing the throw command.
 * Wire into buildInputContext().throwCommand and buildInventoryContext().throwCommand.
 *
 * If item is null returns immediately (silent no-op).
 * C behaviour: pressing 't' with no lastItemThrown opens the inventory to
 * pick an item — that picker is not yet wired; the THROW_KEY → null path
 * is currently a silent no-op.  Wire displayInventory call in input-dispatch.ts
 * to restore the C behaviour when needed.
 *
 * NOTE: Interactive targeting cursor requires Phase 2 async bridge.
 * In the browser, waitForEvent() drives the targeting loop event-by-event.
 */
export function buildThrowCommandFn(
    deps: ItemCommandDeps,
): (item: Item | null, confirmed: boolean) => Promise<void> {
    return async (item, _confirmed) => {
        if (!item) return;

        const { rogue, player, pmap, tmap, displayBuffer, monsters, levels, floorItems, packItems, mutablePotionTable, gameConst } = getGameState();

        const cellHasTerrainFlag = (loc: Pos, flags: number) => cellHasTerrainFlagFn(pmap, loc, flags);
        const cellHasTMFlag = (loc: Pos, flag: number) => cellHasTMFlagFn(pmap, loc, flag);
        const monsterAtLoc = buildMonsterAtLoc(player, monsters);
        const namingCtx = buildNamingCtx();
        const refreshSideBarFn = buildRefreshSideBarWithFocusFn();
        const printLocDescFn = buildPrintLocationDescriptionFn();

        // ── ChooseTargetContext ──────────────────────────────────────────────
        const chooseCtx = {
            rogue,
            player,
            pmap,
            boltCatalog,
            monstersAreTeammates: (a: Creature, b: Creature) => monstersAreTeammatesFn(a, b, player),
            canSeeMonster: (m: Creature) => {
                if (m === player) return true;
                return !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);
            },
            openPathBetween: (from: Pos, to: Pos) => openPathBetween(from, to,
                (loc: Pos) => cellHasTerrainFlagFn(pmap, loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
            distanceBetween,
            wandDominate: (hp: number, max: number) => wandDominate(hp, max),
            negationWillAffectMonster: (m: Creature, isBolt: boolean) =>
                negationWillAffectMonsterFn(m, isBolt, boltCatalog, mutationCatalog),
            isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
            posEq: (a: Pos, b: Pos) => a.x === b.x && a.y === b.y,
            monsterAtLoc,
            itemAtLoc: (loc: Pos) =>
                floorItems.find(i => i.loc.x === loc.x && i.loc.y === loc.y) ?? null,
            hiliteCell: buildHiliteCellFn(),
            refreshDungeonCell: buildRefreshDungeonCellFn(),
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            monsterIsHidden: () => false,       // stub — visibility detail
            cellHasTerrainFlag,
            playerCanSeeOrSense: () => false,   // stub — sensory detail
            cellHasTMFlag,
            refreshSideBar: refreshSideBarFn,
            printLocationDescription: printLocDescFn,
            confirmMessages: deps.confirmMessages,
            // moveCursor: awaits waitForEvent() for browser event delivery.
            moveCursor: async (
                tc: { value: boolean }, ca: { value: boolean }, tk: { value: boolean },
                tl: { value: Pos }, ev: { value: RogueEvent },
                state: unknown, colorsDance: boolean, keysMoveCursor: boolean,
                targetCanLeaveMap: boolean,
            ) => {
                let event: RogueEvent;
                try {
                    commitDraws();
                    event = await waitForEvent();
                } catch {
                    ca.value = true; // Platform not initialised → cancel
                    return true;
                }
                const movCtx: MoveCursorContext = {
                    rogue,
                    nextKeyOrMouseEvent: () => event,
                    createScreenDisplayBuffer: () => ({ cells: [] } as never),
                    clearDisplayBuffer: () => {},
                    saveDisplayBuffer: () => ({ savedScreen: {} } as never),
                    overlayDisplayBuffer: () => {},
                    restoreDisplayBuffer: () => {},
                    drawButtonsInState: () => {},
                    processButtonInput: async () => -1,
                    refreshSideBar: () => {},
                    pmapFlagsAt: (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
                    canSeeMonster: (m: Creature) =>
                        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
                    monsterAtLoc,
                    playerCanSeeOrSense: () => false,
                    cellHasTMFlag,
                    coordinatesAreInMap,
                    isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                    mapToWindowX,
                    windowToMapX,
                    windowToMapY,
                };
                return moveCursorFn(
                    tc, ca, tk, tl, ev, state as never,
                    colorsDance, keysMoveCursor, targetCanLeaveMap, movCtx,
                );
            },
        };

        const { confirmed: targetConfirmed, target } = await chooseTarget(
            0, AutoTargetMode.Throw, item, chooseCtx,
        );
        if (!targetConfirmed) return;

        // ── ThrowItemContext — combat + item management ───────────────────────
        const damageCtx = buildMinCombatDamageCtx(deps);

        const hitCtx: HitMonsterContext = {
            player,
            attackHit: (attacker, defender, overrideWeapon) =>
                attackHitFn(attacker, defender, {
                    player,
                    weapon: overrideWeapon !== undefined ? overrideWeapon : (rogue.weapon ?? null),
                    armor: rogue.armor ?? null,
                    playerStrength: rogue.strength,
                    monsterClassCatalog,
                    randPercent,
                }),
            inflictDamage: (attacker, defender, damage, flashColor, ignoresProtection) =>
                inflictDamageFn(attacker, defender, damage, flashColor as never, ignoresProtection, damageCtx),
            killCreature: (monst, admin) => killCreatureFn(monst, admin, damageCtx),
            magicWeaponHit: () => {},        // stub — runic weapons
            moralAttack: () => {},           // stub — morale effects
            splitMonster: () => {},          // stub — splitting monsters
            handlePaladinFeat: () => {},     // stub — paladin feat
            applyArmorRunicEffect: () => "", // stub — armor runics
            itemName: (i) => itemNameFn(i, false, false, namingCtx),
            monsterName: (m, includeArticle) => {
                if (m === player) return "you";
                const pfx = includeArticle
                    ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
                    : "";
                return `${pfx}${m.info.monsterName}`;
            },
            messageColorFromVictim: (m) => messageColorFromVictimFn(
                m, player,
                player.status[StatusEffect.Hallucinating] > 0,
                rogue.playbackOmniscience,
                (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
            ),
            message: deps.message,
            messageWithColor: (msg, color, flags) => deps.messageWithColor(msg, color, flags),
            netEnchant: (i) => netEnchantFn(i, rogue.strength, player.weaknessAmount),
            damageFraction,
            randClump,
            red,
        };

        // EnvironmentContext for promoteTile — needed so pressure plates properly
        // activate cage machines when a thrown item lands on them.
        // fillSequentialList/shuffleList must be real: activateMachine fills and
        // shuffles sCols/sRows before iterating pmap; stubs leave them undefined
        // and pmap[undefined] crashes.  monstersTurn remains stubbed (complex wiring).
        const envCtx: EnvironmentContext = {
            player,
            rogue,
            monsters,
            pmap,
            levels,
            tileCatalog: tileCatalog as never,
            dungeonFeatureCatalog: dungeonFeatureCatalog as never,
            DCOLS,
            DROWS,
            cellHasTerrainFlag,
            cellHasTMFlag,
            coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
            refreshDungeonCell: () => {},
            spawnDungeonFeature: (x: number, y: number, feat: number, isV: boolean, oP: boolean) =>
                spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y,
                    feat as never, isV, oP),
            monstersFall: () => {},
            updateFloorItems: () => {},
            monstersTurn: () => {},         // stub — cage monsters get a turn on release
            keyOnTileAt: () => null,
            removeCreature: () => false,
            prependCreature: () => {},
            rand_range: (a: number, b: number) => randRange(a, b),
            rand_percent: (p: number) => randPercent(p),
            max: Math.max,
            min: Math.min,
            fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
            shuffleList: (list: number[], _len: number) => shuffleListFn(list),
            exposeTileToFire: () => false,
        } as unknown as EnvironmentContext;

        const placeCtx: PlaceItemAtContext = {
            pmap,
            floorItems,
            tileCatalog: tileCatalog as never,
            dungeonFeatureCatalog: dungeonFeatureCatalog as never,
            itemMagicPolarity: (i) => itemMagicPolarityFn(i),
            cellHasTerrainFlag,
            cellHasTMFlag,
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            itemName: () => {},
            message: deps.message,
            discover: () => {},             // stub — discovery display
            refreshDungeonCell: () => {},   // stub — cell rendering
            REQUIRE_ACKNOWLEDGMENT: 1,
            spawnDungeonFeature: (x, y, feat, isV, oP) =>
                spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y,
                    feat as never, isV, oP),
            promoteTile: (x, y, layer, isForced) =>
                promoteTileFn(x, y, layer as DungeonLayer, isForced, envCtx),
        };

        const throwCellApp = buildGetCellAppearanceFn();
        const throwRefreshCell = buildRefreshDungeonCellFn();

        const throwCtx: ThrowItemContext = {
            ...hitCtx,
            render: {
                playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
                plotItemAt(theItem: Item, x: number, y: number): void {
                    const { backColor } = throwCellApp({ x, y });
                    const foreColor = { ...(theItem.foreColor ?? white) };
                    if (pmap[x]?.[y]?.flags & TileFlag.VISIBLE) {
                        applyColorMultiplier(foreColor, colorMultiplierFromDungeonLight(x, y, tmap));
                    } else {
                        applyColorMultiplier(foreColor, clairvoyanceColor);
                    }
                    plotCharWithColorFn(theItem.displayChar, mapToWindow({ x, y }), foreColor, backColor, displayBuffer);
                },
                pauseAnimation: async (delay: number) => { commitDraws(); return pauseAndCheckForEvent(delay); },
                refreshDungeonCell: throwRefreshCell,
                playbackFastForward: rogue.playbackFastForward,
            },
            pmap,
            boltCatalog,
            monsterAtLoc,
            cellHasTerrainFlag,
            cellHasTMFlag,
            deleteItem(i) {
                const idx = floorItems.indexOf(i as never);
                if (idx >= 0) floorItems.splice(idx, 1);
            },
            placeItemAt: (i, dest) => { placeItemAtFn(i, dest, placeCtx); },
            getQualifyingLocNear: (t, forbidTerrain, forbidFlags) =>
                getQualifyingLocNearFn(pmap, t, forbidTerrain, forbidFlags),
            spawnDungeonFeature: (x, y, dfType, refreshCell, abortIfBlocking) =>
                spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y,
                    dungeonFeatureCatalog[dfType] as never, refreshCell, abortIfBlocking),
            promoteTile: () => {},          // stub — tile promotion
            exposeCreatureToFire: () => {}, // stub — fire exposure
            autoIdentify: (i) => autoIdentifyFn(i, {
                gc: gameConst,
                messageWithColor: deps.messageWithColor,
                itemMessageColor,
                namingCtx,
            }),
            tileCatalog: tileCatalog as never,
            highestPriorityLayer: (x, y, skipGas) => highestPriorityLayerFn(pmap, x, y, skipGas),
            layerWithTMFlag: (x, y, flag) => layerWithTMFlagFn(pmap, x, y, flag),
            potionTable: mutablePotionTable,
        };

        rogue.lastItemThrown = item;
        await throwItem(item, player, target, DCOLS, throwCtx);
        // Remove or decrement from pack (C: throwCommand:6379 — done after throwItem returns)
        if (item.quantity > 1) {
            item.quantity--;
        } else {
            removeItemFromArray(item, packItems);
        }
        playerTurnEndedFn();
    };
}

// =============================================================================
// buildCallCommandFn
// =============================================================================

/**
 * Returns an async function implementing the 'call' (inscribe) command.
 * Wire into buildInputContext().call and buildInventoryContext().call.
 *
 * NOTE: getInputTextString is stubbed to return null (no inscription applied)
 * until Phase 2 wires synchronous event delivery into the text-entry loop.
 */
export function buildCallCommandFn(
    deps: ItemCommandDeps,
): (item: Item | null) => Promise<void> {
    return async (item) => {
        if (!item) return;
        if (!itemCanBeCalled(item)) return;

        const namingCtx = buildNamingCtx();

        const confirmed = await inscribeItem(item, {
            itemName: (i, details, article) => itemNameFn(i, details, article, namingCtx),
            getInputTextString: asyncGetInputTextString,
            confirmMessages: deps.confirmMessages,
            messageWithColor: (msg, color, flags) => deps.messageWithColor(msg, color, flags),
            strLenWithoutEscapes: (s) => s.replace(/\x19[\s\S]{3}/g, "").length,
            itemMessageColor,
        });

        if (confirmed) {
            await playerTurnEndedFn();
        }
    };
}
