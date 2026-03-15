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
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";
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
import { TileFlag, ItemFlag } from "./types/flags.js";
import { CreatureState, CreatureMode, GameMode, ItemCategory } from "./types/enums.js";
import { flashMonster } from "./combat/combat-damage.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { AttackContext } from "./combat/combat-attack.js";
import type { Creature, Item, ItemTable, Pos } from "./types/types.js";
import { getCellAppearance } from "./io/cell-appearance.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn } from "./io-wiring.js";
import { updateEncumbrance as updateEncumbranceFn, updateRingBonuses as updateRingBonusesFn, equipItem as equipItemFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses, syncEquipState } from "./items/equip-helpers.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import {
    attackVerb as attackVerbFn,
    anyoneWantABite as anyoneWantABiteFn,
} from "./combat/combat-helpers.js";
import type { CombatHelperContext } from "./combat/combat-helpers.js";
import { monsterText } from "./globals/monster-text.js";
import { specialHit as specialHitFn } from "./combat/combat-runics.js";
import type { RunicContext } from "./combat/combat-runics.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { wandTable, staffTable, ringTable, charmTable } from "./globals/item-catalog.js";

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

        spawnDungeonFeature(x, y, featureIndex, probability, _isGas) {
            const feat = dungeonFeatureCatalog[featureIndex];
            if (!feat) return;
            const scaled = probability === 100
                ? feat
                : { ...feat, startProbability: Math.floor(feat.startProbability * probability / 100) };
            spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x, y, scaled as never, true, false);
        },
        refreshSideBar,
        combatMessage: io.combatMessage,
        messageWithColor: (text, color) => io.messageWithColor(text, color, 0),
        message: io.message,
        refreshDungeonCell,
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        fadeInMonster: buildFadeInMonsterFn(),

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
        anyoneWantABite: (decedent) => anyoneWantABiteFn(decedent, {
            player,
            iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
            randRange: (lo: number, hi: number) => randRange(lo, hi),
            isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
            monsterAvoids: () => false,
        } as unknown as CombatHelperContext),
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),

        // ── Message ───────────────────────────────────────────────────────────
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes,

        monsterCatalog,

        // ── Equipment updates ─────────────────────────────────────────────────
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
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
    const {
        player, rogue, pmap, monsters,
        packItems, gameConst, mutablePotionTable, mutableScrollTable, monsterCatalog,
    } = getGameState();
    const damageCtx = buildCombatDamageContext();
    const monsterNameFn = buildMonsterName(player);

    const cellHasTerrainFlag = (loc: Pos, flags: number): boolean =>
        cellHasTerrainFlagFn(pmap, loc, flags);

    function monsterAtLoc(loc: Pos): Creature | null {
        if (player.loc.x === loc.x && player.loc.y === loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    }

    // Naming context for item messages (e.g., steal message)
    const namingCtx = {
        gameConstants: gameConst,
        depthLevel: rogue.depthLevel,
        potionTable: mutablePotionTable,
        scrollTable: mutableScrollTable,
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],
        playbackOmniscience: rogue.playbackOmniscience,
        monsterClassName: (classId: number) => monsterCatalog[classId]?.monsterName ?? "creature",
    };

    // MA_HIT_STEAL_FLEE — pick a random unequipped item from pack, steal it,
    // set attacker to permanently flee. Mirrors Combat.c:426-479.
    function monsterStealsFromPlayerImpl(attacker: Creature): void {
        const candidates = packItems.filter(item => !(item.flags & ItemFlag.ITEM_EQUIPPED));
        if (candidates.length === 0) return;

        const idx = randRange(0, candidates.length - 1);
        const theItem = candidates[idx];

        let stolenQuantity: number;
        if (theItem.category & ItemCategory.WEAPON) {
            stolenQuantity = theItem.quantity > 3
                ? Math.floor((theItem.quantity + 1) / 2)
                : theItem.quantity;
        } else {
            stolenQuantity = 1;
        }

        let stolenItem: Item;
        if (stolenQuantity < theItem.quantity) {
            // Peel off stolen quantity from the stack
            stolenItem = { ...theItem, quantity: stolenQuantity };
            theItem.quantity -= stolenQuantity;
        } else {
            // Take the entire item
            if (rogue.swappedIn === theItem) rogue.swappedIn = null;
            if (rogue.swappedOut === theItem) rogue.swappedOut = null;
            const packIdx = packItems.indexOf(theItem);
            if (packIdx >= 0) packItems.splice(packIdx, 1);
            stolenItem = theItem;
        }

        stolenItem.flags &= ~ItemFlag.ITEM_PLAYER_AVOIDS;
        attacker.carriedItem = stolenItem;
        attacker.creatureMode = CreatureMode.PermFleeing;
        attacker.creatureState = CreatureState.Fleeing;

        const mName = monsterNameFn(attacker, true);
        const iName = itemNameFn(stolenItem, false, true, namingCtx);
        void damageCtx.messageWithColor(`${mName} stole ${iName}!`, badMessageColor);
        rogue.autoPlayingLevel = false;
    }

    const runicCtx: RunicContext = {
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

        // ── Runic / special hit ───────────────────────────────────────────────
        magicWeaponHit: () => {},
        applyArmorRunicEffect: () => "",
        specialHit: () => {}, // wired below to allow self-reference
        splitMonster: () => {},

        // ── Display ───────────────────────────────────────────────────────────
        attackVerb: (attacker, damagePercent) => attackVerbFn(attacker, damagePercent, monsterText, {
            player,
            weapon: rogue.weapon,
            canSeeMonster: (m: Creature) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        } as unknown as CombatHelperContext),
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
            syncEquipState(s);
        },
        itemName: (item) => itemNameFn(item, false, true, namingCtx),
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
        gameOverFromMonster(monName) {
            gameOver(`Killed by a ${monName}`);
        },

        // ── Ally ops ─────────────────────────────────────────────────────────
        unAlly: (monst) => unAllyFn(monst),
        alertMonster: (monst) => alertMonsterFn(monst, player),

        // ── RunicContext additional fields (stubs except steal) ───────────────
        armorRunicIdentified: () => false,
        autoIdentify: () => {},
        createFlare: () => {},
        cloneMonster: () => null,
        playerImmuneToMonster: () => false,
        slow: () => {},
        weaken: () => {},
        exposeCreatureToFire: () => {},
        monsterStealsFromPlayer: monsterStealsFromPlayerImpl,
        monstersAreEnemies: () => true,
        onHitHallucinateDuration: gameConst.onHitHallucinateDuration,
        onHitWeakenDuration: gameConst.onHitWeakenDuration,
        onHitMercyHealPercent: gameConst.onHitMercyHealPercent,
        forceWeaponHit: () => false,
    };

    // Wire specialHit after construction so the closure can reference runicCtx
    runicCtx.specialHit = (attacker, defender, damage) => {
        specialHitFn(attacker, defender, damage, runicCtx);
    };

    return runicCtx;
}

// =============================================================================
// buildFadeInMonsterFn — Monsters.c:904
// =============================================================================

/**
 * Returns a `fadeInMonster(monst)` closure that flashes the monster with the
 * background colour of its current cell — the visual cue for a monster
 * appearing (summoned, revealed, etc.).
 *
 * C: void fadeInMonster(creature *monst) — calls getCellAppearance then
 *    flashMonster(monst, &bColor, 100).
 */
export function buildFadeInMonsterFn(): (monst: Creature) => void {
    return (monst) => {
        const { rogue, pmap, tmap, displayBuffer, player, monsters,
            dormantMonsters, floorItems, monsterCatalog, scentMap } = getGameState();
        const { backColor } = getCellAppearance(
            monst.loc, pmap, tmap, displayBuffer, rogue, player,
            monsters, dormantMonsters, floorItems,
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            terrainRandomValues, displayDetail, scentMap ?? [],
        );
        flashMonster(monst, backColor, 100, {
            setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },
        } as unknown as CombatDamageContext);
    };
}
