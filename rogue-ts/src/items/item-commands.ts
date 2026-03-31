/*
 *  items/item-commands.ts — throwCommand wiring factory
 *  Port V2 — rogue-ts
 *
 *  Exports buildThrowCommandFn() and re-exports buildCallCommandFn().
 *  Both accept an ItemCommandDeps object for messaging (avoiding the
 *  ui.ts ↔ io-wiring.ts circular import chain) and read game state via
 *  getGameState().
 *
 *  throwCommand: chooseTarget (targeting cursor) → throwItem (flight + land)
 *  call:         inscribeItem (name-entry) → playerTurnEnded
 *                (implemented in item-call-command.ts, re-exported here)
 *
 *  NOTE — Interactive targeting requires Phase 2 (async event bridge).
 *  In the browser the moveCursor wrapper awaits waitForEvent() per call so
 *  the targeting loop receives real keypresses.
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
import { throwItem, type ThrowItemContext, type HitMonsterContext } from "./throw-item.js";
import { attackHit as attackHitFn } from "../combat/combat-math.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
} from "../combat/combat-damage.js";
import type { CombatDamageContext } from "../combat/combat-damage.js";
import { buildFadeInMonsterFn, buildCombatAttackContext } from "../combat.js";
import { moralAttack as moralAttackFn } from "../combat/combat-attack.js";
import {
    magicWeaponHit as magicWeaponHitFn,
    applyArmorRunicEffect as applyArmorRunicEffectFn,
} from "../combat/combat-runics.js";
import { damageFraction, wandDominate, charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import { netEnchant as netEnchantFn, updateEncumbrance as updateEncumbranceFn } from "./item-usage.js";
import { autoIdentify as autoIdentifyFn } from "./item-handlers.js";
import { getQualifyingLocNear as getQualifyingLocNearFn } from "../architect/architect.js";
import { placeItemAt as placeItemAtFn, type PlaceItemAtContext } from "./floor-items.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "../architect/machines.js";
import { promoteTile as promoteTileFn, activateMachine as activateMachineFn, circuitBreakersPreventActivation as circuitBreakersPreventActivationFn, exposeTileToFire as exposeTileToFireFn, type EnvironmentContext } from "../time/environment.js";
import {
    highestPriorityLayer as highestPriorityLayerFn,
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    terrainFlags as terrainFlagsFn,
    burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn,
} from "../state/helpers.js";
import { removeItemFromArray, itemAtLoc as itemAtLocFn } from "./item-inventory.js";
import { layerWithTMFlag as layerWithTMFlagFn } from "../movement/map-queries.js";
import {
    monstersAreTeammates as monstersAreTeammatesFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    monsterIsHidden as monsterIsHiddenFn,
    canSeeMonster as canSeeMonsterFn,
} from "../monsters/monster-queries.js";
import { distanceBetween, monsterAvoids as monsterAvoidsFn, type MonsterStateContext } from "../monsters/monster-state.js";
import { removeCreature as removeCreatureFn } from "../monsters/monster-actions.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn, checkForContinuedLeadership as checkForContinuedLeadershipFn } from "../monsters/monster-ally-ops.js";
import { monstersFall as monstersFallFn, type CreatureEffectsContext } from "../time/creature-effects.js";
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
import { itemMagicPolarity as itemMagicPolarityFn } from "./item-generation.js";
import { keyMatchesLocation as keyMatchesLocationFn } from "./item-utils.js";
import { coordinatesAreInMap, mapToWindowX, windowToMapX, windowToMapY } from "../globals/tables.js";
import { randClump, randPercent, randRange, randClumpedRange, fillSequentialList as fillSequentialListFn, shuffleList as shuffleListFn } from "../math/rng.js";
import { playerTurnEnded as playerTurnEndedFn } from "../turn.js";
import { badMessageColor, goodMessageColor, clairvoyanceColor, red, white, itemMessageColor } from "../globals/colors.js";
import { anyoneWantABite as anyoneWantABiteFn, type CombatHelperContext } from "../combat/combat-helpers.js";
import { AutoTargetMode, CreatureState, DungeonLayer, GameMode, StatusEffect } from "../types/enums.js";
import { TerrainFlag, TileFlag, ItemFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import { DCOLS, DROWS } from "../types/constants.js";
import { INVALID_POS, type Color, type Creature, type Item, type ItemTable, type Pos, type RogueEvent } from "../types/types.js";
import {
    plotCharWithColor as plotCharWithColorFn,
    mapToWindow,
    createScreenDisplayBuffer as createScreenDisplayBufferFn,
    clearDisplayBuffer as clearDisplayBufferFn,
    saveDisplayBuffer as saveDisplayBufferFn,
    restoreDisplayBuffer as restoreDisplayBufferFn,
    applyOverlay as applyOverlayFn,
} from "../io/display.js";
import {
    drawButtonsInState as drawButtonsInStateFn,
    processButtonInput as processButtonInputFn,
} from "../io/buttons.js";
import { buildButtonContext } from "../ui.js";
import { buildRefreshDungeonCellFn, buildHiliteCellFn, buildGetCellAppearanceFn, buildExposeCreatureToFireFn, buildRefreshSideBarFn, buildWakeUpFn } from "../io-wiring.js";
import { buildRefreshSideBarWithFocusFn, buildPrintLocationDescriptionFn } from "../io/sidebar-wiring.js";
import { buildUpdateFloorItemsFn } from "./floor-items-wiring.js";
import { getMonsterDFMessage as getMonsterDFMessageFn } from "../io/text.js";
import { buildEquipState } from "./equip-helpers.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "../light/light.js";
import { buildUpdateVisionFn } from "../vision-wiring.js";
export { buildCallCommandFn } from "./item-call-command.js";

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
        wakeUp: buildWakeUpFn(player, monsters),
        spawnDungeonFeature(x, y, featureIndex, _probability, _isGas) {
            const feat = dungeonFeatureCatalog[featureIndex];
            if (feat) spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, feat as never, true, false);
        },
        refreshSideBar: buildRefreshSideBarFn(),
        combatMessage: (msg, color) => deps.messageWithColor(msg, color as Readonly<Color> ?? null, 0),
        messageWithColor: (msg, color) => deps.messageWithColor(msg, color as Readonly<Color> ?? null, 0),
        message: deps.message,
        refreshDungeonCell: buildRefreshDungeonCellFn(),
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
            if (monst.carriedItem) {
                const item = monst.carriedItem;
                item.loc = { ...monst.loc };
                floorItems.push(item);
                pmap[monst.loc.x][monst.loc.y].flags |= TileFlag.HAS_ITEM;
                monst.carriedItem = null;
            }
        },
        clearLastTarget(monst) { if (rogue.lastTarget === monst) rogue.lastTarget = null; },
        clearYendorWarden(monst) { if (rogue.yendorWarden === monst) rogue.yendorWarden = null; },
        clearCellMonsterFlag(loc, isDormant) {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags &= ~(isDormant ? TileFlag.HAS_DORMANT_MONSTER : TileFlag.HAS_MONSTER);
            }
        },
        prependCreature(monst) { monsters.unshift(monst); },
        anyoneWantABite: (decedent) => {
            const monsterAtLocC = (loc: Pos): Creature | null => {
                if (player.loc.x === loc.x && player.loc.y === loc.y) return player;
                return monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
            };
            const cellHasTFlagC = (loc: Pos, flags: number): boolean => cellHasTerrainFlagFn(pmap, loc, flags);
            const avoidsCtxC = {
                player,
                terrainFlags: (p: Pos) => terrainFlagsFn(pmap, p),
                cellFlags: (p: Pos) => pmap[p.x]?.[p.y]?.flags ?? 0,
                downLoc: rogue.downLoc, upLoc: rogue.upLoc,
                cellHasTMFlag: (p: Pos, flags: number) => cellHasTMFlagFn(pmap, p, flags),
                discoveredTerrainFlagsAtLoc: () => 0, // permanent-defer — throw path doesn't need secret terrain discovery
                monsterAtLoc: monsterAtLocC,
                cellHasTerrainFlag: cellHasTFlagC,
                HAS_MONSTER: TileFlag.HAS_MONSTER, HAS_PLAYER: TileFlag.HAS_PLAYER,
                PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
                mapToShore: rogue.mapToShore,
                playerHasRespirationArmor: () => false, // permanent-defer — respiration armor doesn't affect monsterAvoids during throw
                burnedTerrainFlagsAtLoc: (p: Pos) => burnedTerrainFlagsAtLocFn(pmap, p),
            } as unknown as MonsterStateContext;
            return anyoneWantABiteFn(decedent, {
                player,
                iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
                randRange: (lo: number, hi: number) => randRange(lo, hi),
                isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                monsterAvoids: (m: Creature, loc: Pos) => monsterAvoidsFn(m, loc, avoidsCtxC),
            } as unknown as CombatHelperContext);
        },
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes: (s) => s,
        monsterCatalog,
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: () => buildUpdateVisionFn()(true),
        badMessageColor,
        poisonColor: badMessageColor,
    };
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

        const { rogue, player, pmap, tmap, displayBuffer, monsters, levels, floorItems, packItems, mutablePotionTable, mutableScrollTable, gameConst } = getGameState();

        const cellHasTerrainFlag = (loc: Pos, flags: number) => cellHasTerrainFlagFn(pmap, loc, flags);
        const cellHasTMFlag = (loc: Pos, flag: number) => cellHasTMFlagFn(pmap, loc, flag);
        const monsterAtLoc = buildMonsterAtLoc(player, monsters);
        const namingCtx = buildNamingCtx();
        const refreshSideBarFn = buildRefreshSideBarWithFocusFn();
        const printLocDescFn = buildPrintLocationDescriptionFn();
        const throwRefreshCell = buildRefreshDungeonCellFn();

        // Shared MonsterQueryContext for visibility checks
        const mqCtx = {
            player,
            cellHasTerrainFlag,
            cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers[DungeonLayer.Gas]),
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: rogue.playbackOmniscience,
        };

        // ── ChooseTargetContext ──────────────────────────────────────────────
        const chooseCtx = {
            rogue,
            player,
            pmap,
            boltCatalog,
            monstersAreTeammates: (a: Creature, b: Creature) => monstersAreTeammatesFn(a, b, player),
            canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
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
            refreshDungeonCell: throwRefreshCell,
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            monsterIsHidden: (m: Creature, observer: Creature) =>
                monsterIsHiddenFn(m, observer, mqCtx),
            cellHasTerrainFlag,
            playerCanSeeOrSense: (x: number, y: number) =>
                !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
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
                const btnCtx = buildButtonContext();
                const movCtx: MoveCursorContext = {
                    rogue,
                    nextKeyOrMouseEvent: () => event,
                    createScreenDisplayBuffer: () => createScreenDisplayBufferFn(),
                    clearDisplayBuffer: (dbuf) => clearDisplayBufferFn(dbuf),
                    saveDisplayBuffer: () => saveDisplayBufferFn(displayBuffer),
                    overlayDisplayBuffer: (dbuf) => { applyOverlayFn(displayBuffer, dbuf); },
                    restoreDisplayBuffer: (rbuf) => restoreDisplayBufferFn(displayBuffer, rbuf),
                    drawButtonsInState: (st, dbuf) => drawButtonsInStateFn(st, dbuf, btnCtx),
                    processButtonInput: async (st, ev) => {
                        const r = await processButtonInputFn(st, ev, btnCtx);
                        return r.chosenButton;
                    },
                    refreshSideBar: refreshSideBarFn,
                    pmapFlagsAt: (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
                    canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
                    monsterAtLoc,
                    playerCanSeeOrSense: (x: number, y: number) =>
                        !!(pmap[x]?.[y]?.flags & (TileFlag.VISIBLE | TileFlag.WAS_VISIBLE)),
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
        const attackCtx = buildCombatAttackContext();

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
            magicWeaponHit: (monst, weapon, wasSneakOrSleep) =>
                magicWeaponHitFn(monst, weapon, wasSneakOrSleep, attackCtx),
            moralAttack: (attacker, defender) => moralAttackFn(attacker, defender, attackCtx),
            splitMonster: (monst, attacker) => attackCtx.splitMonster(monst, attacker),
            handlePaladinFeat: (monst) => attackCtx.handlePaladinFeat(monst),
            applyArmorRunicEffect: (attacker, damage) =>
                applyArmorRunicEffectFn(attacker, damage, false /* projectile hit = not melee */, attackCtx),
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
        // and pmap[undefined] crashes.
        const monsterNameBuf = (buf: string[], m: Creature, includeArticle: boolean) => {
            if (m === player) { buf[0] = "you"; return; }
            const pfx = includeArticle ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
            buf[0] = `${pfx}${m.info.monsterName}`;
        };

        let exposeToFire = (_x: number, _y: number, _a: boolean): boolean => false;
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
            refreshDungeonCell: throwRefreshCell,
            spawnDungeonFeature: (x: number, y: number, feat: number, isV: boolean, oP: boolean) =>
                spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y,
                    feat as never, isV, oP),
            monstersFall: () => monstersFallFn({
                monsters, pmap, levels,
                cellHasTerrainFlag,
                rogue: { depthLevel: rogue.depthLevel } as unknown as CreatureEffectsContext["rogue"],
                canSeeMonster: (m: Creature) => canSeeMonsterFn(m, mqCtx),
                monsterName: monsterNameBuf,
                messageWithColor: (msg: string, color: Color, flags: number) =>
                    deps.messageWithColor(msg, color as Readonly<Color>, flags),
                messageColorFromVictim: (monst: Creature): Color =>
                    (monst === player || monst.creatureState === CreatureState.Ally)
                        ? badMessageColor : goodMessageColor,
                killCreature: (monst: Creature, adminDeath: boolean) =>
                    killCreatureFn(monst, adminDeath, damageCtx),
                inflictDamage: (
                    attacker: Creature | null, defender: Creature,
                    damage: number, flashColor: Color, showDamage: boolean,
                ) => inflictDamageFn(attacker, defender, damage, flashColor as never, showDamage, damageCtx),
                randClumpedRange,
                red,
                demoteMonsterFromLeadership: (monst: Creature) =>
                    demoteMonsterFromLeadershipFn(monst, monsters),
                removeCreature: (list: Creature[], monst: Creature) =>
                    removeCreatureFn(list, monst),
                prependCreature: (list: Creature[], monst: Creature) => { list.unshift(monst); },
                INVALID_POS,
                refreshDungeonCell: throwRefreshCell,
            } as unknown as CreatureEffectsContext),
            updateFloorItems: buildUpdateFloorItemsFn({
                floorItems, pmap,
                rogue: { absoluteTurnNumber: rogue.absoluteTurnNumber, depthLevel: rogue.depthLevel },
                gameConst, levels, player,
                tileCatalog: tileCatalog as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["tileCatalog"],
                dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["dungeonFeatureCatalog"],
                mutableScrollTable: mutableScrollTable as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["mutableScrollTable"],
                mutablePotionTable: mutablePotionTable as unknown as Parameters<typeof buildUpdateFloorItemsFn>[0]["mutablePotionTable"],
                itemMessageColor,
                messageWithColor: (msg, color, flags) =>
                    deps.messageWithColor(msg, color as Readonly<Color>, flags),
                itemName: (item, buf, details, article) => { buf[0] = itemNameFn(item, details, article, namingCtx); },
                refreshDungeonCell: throwRefreshCell,
                promoteTile: (x, y, layer, forced) => promoteTileFn(x, y, layer as DungeonLayer, forced, envCtx),
                activateMachine: (mn) => activateMachineFn(mn, envCtx),
                circuitBreakersPreventActivation: (mn) => circuitBreakersPreventActivationFn(mn, envCtx),
            }),
            monstersTurn: () => {},         // permanent-defer — throw item env ctx; cage monster turn not needed on item hit
            keyOnTileAt: (loc: Pos) => {
                const machineNum = pmap[loc.x]?.[loc.y]?.machineNumber ?? 0;
                if (player.loc.x === loc.x && player.loc.y === loc.y) {
                    const k = packItems.find(it =>
                        (it.flags & ItemFlag.ITEM_IS_KEY) &&
                        keyMatchesLocationFn(it, loc, rogue.depthLevel, machineNum));
                    if (k) return k;
                }
                if (pmap[loc.x]?.[loc.y]?.flags & TileFlag.HAS_ITEM) {
                    const fi = itemAtLocFn(loc, floorItems);
                    if (fi && (fi.flags & ItemFlag.ITEM_IS_KEY) &&
                        keyMatchesLocationFn(fi, loc, rogue.depthLevel, machineNum)) return fi;
                }
                const monst = monsters.find(m =>
                    m.loc.x === loc.x && m.loc.y === loc.y &&
                    !(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_HAS_DIED));
                if (monst?.carriedItem && (monst.carriedItem.flags & ItemFlag.ITEM_IS_KEY) &&
                    keyMatchesLocationFn(monst.carriedItem, loc, rogue.depthLevel, machineNum))
                    return monst.carriedItem;
                return null;
            },
            removeCreature: (list: Creature[], m: Creature) => removeCreatureFn(list, m),
            prependCreature: (list: Creature[], m: Creature) => { list.unshift(m); },
            rand_range: (a: number, b: number) => randRange(a, b),
            rand_percent: (p: number) => randPercent(p),
            max: Math.max,
            min: Math.min,
            fillSequentialList: (list: number[], _len: number) => fillSequentialListFn(list),
            shuffleList: (list: number[], _len: number) => shuffleListFn(list),
            exposeTileToFire: (x: number, y: number, a: boolean) => exposeToFire(x, y, a),
        } as unknown as EnvironmentContext;
        exposeToFire = (x, y, a) => exposeTileToFireFn(x, y, a, envCtx);

        const placeCtx: PlaceItemAtContext = {
            pmap,
            floorItems,
            tileCatalog: tileCatalog as never,
            dungeonFeatureCatalog: dungeonFeatureCatalog as never,
            itemMagicPolarity: (i) => itemMagicPolarityFn(i),
            cellHasTerrainFlag,
            cellHasTMFlag,
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            itemName: (i, buf, details, article) => { buf[0] = itemNameFn(i, details, article, namingCtx); },
            message: deps.message,
            discover: (x, y) => { if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED; },
            refreshDungeonCell: throwRefreshCell,
            REQUIRE_ACKNOWLEDGMENT: 1,
            spawnDungeonFeature: (x, y, feat, isV, oP) =>
                spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y,
                    feat as never, isV, oP),
            promoteTile: (x, y, layer, isForced) =>
                promoteTileFn(x, y, layer as DungeonLayer, isForced, envCtx),
        };

        const throwCellApp = buildGetCellAppearanceFn();

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
            promoteTile: (x, y, layer, isForced) =>
                promoteTileFn(x, y, layer as DungeonLayer, isForced, envCtx),
            exposeCreatureToFire: buildExposeCreatureToFireFn(),
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
