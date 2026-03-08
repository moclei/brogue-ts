/*
 *  combat.ts — Combat context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildCombatDamageContext() and buildCombatAttackContext(),
 *  the two context factories that wire the combat module's DI interfaces.
 *
 *  Platform / display callbacks are stubbed here; they will be wired in
 *  port-v2-platform.  Complex leadership and runic operations are also
 *  stubbed — see test.skip items at the bottom of combat.test.ts.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver } from "./core.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    terrainFlags as terrainFlagsFn,
} from "./state/helpers.js";
import { randRange, randPercent, randClump } from "./math/rng.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { alertMonster as alertMonsterFn } from "./monsters/monster-state.js";
import { monsterWillAttackTarget as monsterWillAttackTargetFn } from "./monsters/monster-queries.js";
import { monsterIsInClass as monsterIsInClassFn } from "./monsters/monster-queries.js";
import { unAlly as unAllyFn, checkForContinuedLeadership as checkForContinuedLeadershipFn, demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { buildResolvePronounEscapesFn, getMonsterDFMessage as getMonsterDFMessageFn } from "./io/text.js";
import {
    white, red, poisonColor,
    goodMessageColor, badMessageColor, itemMessageColor,
} from "./globals/colors.js";
import { TileFlag } from "./types/flags.js";
import { CreatureState, GameMode } from "./types/enums.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { AttackContext } from "./combat/combat-attack.js";
import type { Creature, Pos } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn } from "./io-wiring.js";
import { updateEncumbrance as updateEncumbranceFn, updateRingBonuses as updateRingBonusesFn, equipItem as equipItemFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses } from "./items/equip-helpers.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterName(player: Creature) {
    return function (monst: Creature, includeArticle: boolean): string {
        if (monst === player) return "you";
        const pfx = includeArticle
            ? (monst.creatureState === CreatureState.Ally ? "your " : "the ")
            : "";
        return `${pfx}${monst.info.monsterName}`;
    };
}

// =============================================================================
// buildCombatDamageContext
// =============================================================================

/**
 * Build a CombatDamageContext backed by the current game state.
 *
 * Wires all straightforward operations (HP mutation, item drops, flag clears)
 * with real implementations.  Platform/display and complex leadership ops
 * remain stubs pending port-v2-platform and monsters.ts.
 */
export function buildCombatDamageContext(): CombatDamageContext {
    const { player, rogue, pmap, monsters, floorItems, monsterCatalog } = getGameState();
    const io = buildMessageFns(), refreshDungeonCell = buildRefreshDungeonCellFn(), refreshSideBar = buildRefreshSideBarFn();
    const resolvePronounEscapes = buildResolvePronounEscapesFn(player, pmap, rogue);

    const canSeeMonster = (m: Creature): boolean =>
        !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE);

    return {
        player,
        easyMode: rogue.mode === GameMode.Easy,
        transference: rogue.transference,
        playerTransferenceRatio: 20,

        canSeeMonster,
        canDirectlySeeMonster: canSeeMonster,

        wakeUp: buildWakeUpFn(player, monsters),

        // ── Platform stubs (wired in port-v2-platform) ────────────────────────
        spawnDungeonFeature: () => {},
        refreshSideBar,
        combatMessage: io.combatMessage,
        messageWithColor: (text, color) => io.messageWithColor(text, color, 0),
        message: io.message,
        refreshDungeonCell,
        applyInstantTileEffectsToCreature: () => {},
        fadeInMonster: () => {},

        monsterName: buildMonsterName(player),

        gameOver(msg) { gameOver(msg); },
        setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },

        // ── Item management ───────────────────────────────────────────────────
        deleteItem(item) {
            const idx = floorItems.indexOf(item as never);
            if (idx >= 0) floorItems.splice(idx, 1);
        },
        makeMonsterDropItem(monst) {
            if (monst.carriedItem) {
                floorItems.push(monst.carriedItem);
                monst.carriedItem = null;
            }
        },

        // ── Reference clearing ────────────────────────────────────────────────
        clearLastTarget(monst) {
            if (rogue.lastTarget === monst) rogue.lastTarget = null;
        },
        clearYendorWarden(monst) {
            if (rogue.yendorWarden === monst) rogue.yendorWarden = null;
        },
        clearCellMonsterFlag(loc, isDormant) {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                const flag = isDormant
                    ? TileFlag.HAS_DORMANT_MONSTER
                    : TileFlag.HAS_MONSTER;
                pmap[loc.x][loc.y].flags &= ~flag;
            }
        },
        prependCreature(monst) { monsters.unshift(monst); },

        // ── Leadership ────────────────────────────────────────────────────────
        anyoneWantABite: () => false,   // stub — depends on canAbsorb (Phase 6)
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),

        // ── Message ───────────────────────────────────────────────────────────
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes,

        monsterCatalog,

        // ── Equipment updates ─────────────────────────────────────────────────
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateMinersLightRadius: () => {},
        updateVision: () => {},

        badMessageColor,
        poisonColor,
    };
}

// =============================================================================
// buildCombatAttackContext
// =============================================================================

/**
 * Build an AttackContext backed by the current game state.
 *
 * Extends buildCombatDamageContext() with the additional map queries,
 * RNG, and attack-specific callbacks required by attack() and friends.
 *
 * Runic effects (magicWeaponHit, specialHit, applyArmorRunicEffect) and
 * item enchantment ops are stubbed — they require deeper platform wiring.
 */
export function buildCombatAttackContext(): AttackContext {
    const { player, rogue, pmap, monsters } = getGameState();
    const damageCtx = buildCombatDamageContext();

    const cellHasTerrainFlag = (loc: Pos, flags: number): boolean =>
        cellHasTerrainFlagFn(pmap, loc, flags);

    function monsterAtLoc(loc: Pos): Creature | null {
        if (player.loc.x === loc.x && player.loc.y === loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    }

    return {
        ...damageCtx,

        // ── CombatMathContext ──────────────────────────────────────────────────
        weapon: rogue.weapon,
        armor: rogue.armor,
        playerStrength: rogue.strength,
        monsterClassCatalog,
        randPercent: (pct) => randPercent(pct),

        // ── Map ops ───────────────────────────────────────────────────────────
        cellFlags: (loc) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
        cellHasTerrainFlag,
        getTerrainFlags: (loc) => terrainFlagsFn(pmap, loc),
        monsterAtLoc,
        setMonsterLocation(monst, loc) {
            if (coordinatesAreInMap(monst.loc.x, monst.loc.y)) {
                pmap[monst.loc.x][monst.loc.y].flags &= ~TileFlag.HAS_MONSTER;
            }
            monst.loc = { x: loc.x, y: loc.y };
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags |= TileFlag.HAS_MONSTER;
            }
        },

        // ── Monster queries ───────────────────────────────────────────────────
        monsterWillAttackTarget: (attacker, defender) =>
            monsterWillAttackTargetFn(attacker, defender, player, cellHasTerrainFlag),
        monsterIsInClass: (monst, cls) => monsterIsInClassFn(monst, cls),

        // ── RNG ───────────────────────────────────────────────────────────────
        randRange: (lo, hi) => randRange(lo, hi),
        randClump: (range) => randClump(range),

        // ── Rogue state ───────────────────────────────────────────────────────
        blockCombatText: rogue.blockCombatText,
        setDisturbed() { rogue.disturbed = true; },
        reaping: rogue.reaping,

        // ── Runic / special hit stubs (wired in port-v2-platform) ────────────
        magicWeaponHit: () => {},
        applyArmorRunicEffect: () => "",
        specialHit: () => {},
        splitMonster: () => {},

        // ── Display ───────────────────────────────────────────────────────────
        attackVerb: () => "hits",   // stub — needs attacker + monster text table
        messageColorFromVictim: (defender) =>
            defender === player ? badMessageColor : goodMessageColor,

        // ── Item / weapon ops ─────────────────────────────────────────────────
        decrementWeaponAutoIDTimer: () => {},
        rechargeItemsIncrementally: () => {},
        equipItem: (item, force) => {
            const s = buildEquipState();
            equipItemFn(item, force, null, { state: s, message: () => {}, itemName: () => "item",
                updateRingBonuses: () => { updateRingBonusesFn(s); syncEquipBonuses(s); },
                updateEncumbrance: () => updateEncumbranceFn(s) });
            syncEquipBonuses(s);
        },
        itemName: () => "item",
        checkForDisenchantment: () => {},
        strengthCheck: () => {},
        itemMessageColor,

        // ── Feat tracking stubs ───────────────────────────────────────────────
        handlePaladinFeat: () => {},
        setPureMageFeatFailed: () => {},
        setDragonslayerFeatAchieved: () => {},
        reportHeardCombat() {
            const already = rogue.heardCombatThisTurn;
            rogue.heardCombatThisTurn = true;
            return already;
        },

        // ── Colors ───────────────────────────────────────────────────────────
        whiteColor: white,
        redColor: red,

        // ── Game over ────────────────────────────────────────────────────────
        gameOverFromMonster(monsterName) {
            gameOver(`Killed by a ${monsterName}`);
        },

        // ── Ally ops ─────────────────────────────────────────────────────────
        unAlly: (monst) => unAllyFn(monst),
        alertMonster: (monst) => alertMonsterFn(monst, player),
    };
}
