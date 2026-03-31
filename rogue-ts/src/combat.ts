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
import { buildFadeInMonsterFn } from "./combat-fade.js";
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    terrainFlags as terrainFlagsFn,
    cellHasTMFlag as cellHasTMFlagFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
    burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { randRange, randPercent, randClump, randClumpedRange, clamp, cosmeticRandRange } from "./math/rng.js";
import { FP_FACTOR } from "./math/fixpt.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import { alertMonster as alertMonsterFn, monsterAvoids as monsterAvoidsFn } from "./monsters/monster-state.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import { monsterWillAttackTarget as monsterWillAttackTargetFn, monsterIsInClass as monsterIsInClassFn, monstersAreTeammates as monstersAreTeammatesFn, monstersAreEnemies as monstersAreEnemiesFn } from "./monsters/monster-queries.js";
import { unAlly as unAllyFn, checkForContinuedLeadership as checkForContinuedLeadershipFn, demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { buildResolvePronounEscapesFn, getMonsterDFMessage as getMonsterDFMessageFn } from "./io/text.js";
import {
    white, red, poisonColor,
    goodMessageColor, badMessageColor, itemMessageColor,
} from "./globals/colors.js";
import { TileFlag, ItemFlag } from "./types/flags.js";
import { CreatureState, CreatureMode, GameMode, ItemCategory, FeatType, StatusEffect, MonsterType, LightType } from "./types/enums.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { Creature, CreatureType, Item, ItemTable, Pos } from "./types/types.js";
import { buildRefreshDungeonCellFn, buildRefreshSideBarFn, buildMessageFns, buildWakeUpFn, buildExposeCreatureToFireFn } from "./io-wiring.js";
import { updateEncumbrance as updateEncumbranceFn, updateRingBonuses as updateRingBonusesFn, equipItem as equipItemFn, strengthCheck as strengthCheckFn } from "./items/item-usage.js";
import { buildEquipState, syncEquipBonuses, syncEquipState } from "./items/equip-helpers.js";
import { updateMinersLightRadius as updateMinersLightRadiusFn } from "./light/light.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import {
    attackVerb as attackVerbFn,
    anyoneWantABite as anyoneWantABiteFn,
    splitMonster as splitMonsterFn,
    handlePaladinFeat as handlePaladinFeatFn,
    playerImmuneToMonster as playerImmuneToMonsterFn,
    decrementWeaponAutoIDTimer as decrementWeaponAutoIDTimerFn,
} from "./combat/combat-helpers.js";
import type { CombatHelperContext } from "./combat/combat-helpers.js";
import { monsterText } from "./globals/monster-text.js";
import {
    specialHit as specialHitFn,
    magicWeaponHit as magicWeaponHitFn,
    applyArmorRunicEffect as applyArmorRunicEffectFn,
} from "./combat/combat-runics.js";
import type { RunicContext } from "./combat/combat-runics.js";
import { itemName as itemNameFn } from "./items/item-naming.js";
import { cloneMonster as cloneMonsterFn, becomeAllyWith as becomeAllyWithFn } from "./monsters/monster-lifecycle.js";
import { checkForDisenchantment as checkForDisenchantmentFn } from "./items/item-inventory.js";
import { weaken as weakenFn, slow as slowFn, updateIdentifiableItem as updateIdentifiableItemFn } from "./items/item-effects.js";
import { autoIdentify as autoIdentifyFn, updateIdentifiableItems as updateIdentifiableItemsFn } from "./items/item-handlers.js";
import { createFlare as createFlareFn } from "./light/flares.js";
import { lightCatalog } from "./globals/light-catalog.js";
import { NUMBER_GOOD_WEAPON_ENCHANT_KINDS } from "./types/constants.js";
import { ArmorEnchant } from "./types/enums.js";
import { doMakeMonsterDropItem } from "./monsters/monster-drop.js";
import type { CloneMonsterContext } from "./monsters/monster-lifecycle.js";
import { wandTable, staffTable, ringTable, charmTable, charmEffectTable } from "./globals/item-catalog.js";
import { ringWisdomMultiplier as ringWisdomMultiplierFn, charmRechargeDelay as charmRechargeDelayFn } from "./power/power-tables.js";
import { rechargeItemsIncrementally as rechargeItemsIncrementallyFn } from "./time/misc-helpers.js";
import type { MiscHelpersContext } from "./time/misc-helpers.js";
import { buildUpdateVisionFn } from "./vision-wiring.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterName(
    player: Creature,
    pmap?: ReturnType<typeof getGameState>["pmap"],
    playerStatus?: number[],
    playbackOmniscience?: boolean,
    monsterCatalogArg?: CreatureType[],
) {
    return function (monst: Creature, includeArticle: boolean): string {
        // C: Monsters.c:monsterName
        if (monst === player) return "you";
        const canSee = pmap
            ? !!(pmap[monst.loc.x]?.[monst.loc.y]?.flags & TileFlag.VISIBLE)
            : true;
        if (!canSee && !playbackOmniscience) return "something";
        // Hallucination branch: C Monsters.c:263
        if (
            playerStatus &&
            playerStatus[StatusEffect.Hallucinating] > 0 &&
            !playbackOmniscience &&
            !playerStatus[StatusEffect.Telepathic]
        ) {
            const catalog = monsterCatalogArg;
            if (catalog && catalog.length > 1) {
                const idx = cosmeticRandRange(1, MonsterType.NUMBER_MONSTER_KINDS - 1);
                const fakeName = catalog[idx]?.monsterName ?? monst.info.monsterName;
                return `${includeArticle ? "the " : ""}${fakeName}`;
            }
        }
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

        monsterName: buildMonsterName(player, pmap, player.status, rogue.playbackOmniscience, monsterCatalog),

        gameOver(msg) { gameOver(msg); },
        setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },

        deleteItem(item) {
            const idx = floorItems.indexOf(item as never);
            if (idx >= 0) floorItems.splice(idx, 1);
        },
        makeMonsterDropItem(monst) {
            doMakeMonsterDropItem(monst, pmap, floorItems,
                (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags), refreshDungeonCell);
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
            // Minimal MonsterStateContext for monsterAvoids (same pattern as buildCombatAttackContext)
            const monsterAtLocD = (loc: Pos): Creature | null => {
                if (player.loc.x === loc.x && player.loc.y === loc.y) return player;
                return monsters.find(m => m.loc.x === loc.x && m.loc.y === loc.y) ?? null;
            };
            const cellHasTerrainFlagD = (loc: Pos, flags: number): boolean =>
                cellHasTerrainFlagFn(pmap, loc, flags);
            const monsterAvoidsCtxD = {
                player,
                terrainFlags: (p: Pos) => terrainFlagsFn(pmap, p),
                cellFlags: (p: Pos) => pmap[p.x]?.[p.y]?.flags ?? 0,
                downLoc: rogue.downLoc,
                upLoc: rogue.upLoc,
                cellHasTMFlag: (p: Pos, flags: number) => cellHasTMFlagFn(pmap, p, flags),
                discoveredTerrainFlagsAtLoc: (p: Pos) => discoveredTerrainFlagsAtLocFn(
                    pmap, p, tileCatalog,
                    (tileType: number) => {
                        const df = tileCatalog[tileType]?.discoverType ?? 0;
                        return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                    },
                ),
                monsterAtLoc: monsterAtLocD,
                cellHasTerrainFlag: cellHasTerrainFlagD,
                HAS_MONSTER: TileFlag.HAS_MONSTER,
                HAS_PLAYER: TileFlag.HAS_PLAYER,
                PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
                mapToShore: rogue.mapToShore,
                playerHasRespirationArmor: () =>
                    !!(rogue.armor &&
                       (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
                       (rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) &&
                       rogue.armor.enchant2 === ArmorEnchant.Respiration),
                burnedTerrainFlagsAtLoc: (p: Pos) => burnedTerrainFlagsAtLocFn(pmap, p),
            } as unknown as MonsterStateContext;
            return anyoneWantABiteFn(decedent, {
                player,
                iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
                randRange: (lo: number, hi: number) => randRange(lo, hi),
                isPosInMap: (loc: Pos) => coordinatesAreInMap(loc.x, loc.y),
                monsterAvoids: (m: Creature, loc: Pos) => monsterAvoidsFn(m, loc, monsterAvoidsCtxD),
            } as unknown as CombatHelperContext);
        },
        demoteMonsterFromLeadership: (monst) => demoteMonsterFromLeadershipFn(monst, monsters),
        checkForContinuedLeadership: (monst) => checkForContinuedLeadershipFn(monst, monsters),
        getMonsterDFMessage: (id) => getMonsterDFMessageFn(id),
        resolvePronounEscapes,
        monsterCatalog,
        updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
        updateMinersLightRadius: () => { updateMinersLightRadiusFn(rogue, player); },
        updateVision: () => buildUpdateVisionFn()(true),
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
export function buildCombatAttackContext(): RunicContext {
    const {
        player, rogue, pmap, monsters, dormantMonsters, floorItems,
        packItems, gameConst, mutablePotionTable, mutableScrollTable, monsterCatalog,
    } = getGameState();
    const damageCtx = buildCombatDamageContext();
    const monsterNameFn = buildMonsterName(player, pmap, player.status, rogue.playbackOmniscience, monsterCatalog);

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

    // ── Clone / split helpers (B66) ──────────────────────────────────────────

    // Minimal context for monsterAvoids — only the fields accessed for non-player monsters
    const monsterAvoidsCtx = {
        player,
        terrainFlags: (p: Pos) => terrainFlagsFn(pmap, p),
        cellFlags: (p: Pos) => pmap[p.x]?.[p.y]?.flags ?? 0,
        downLoc: rogue.downLoc,
        upLoc: rogue.upLoc,
        cellHasTMFlag: (p: Pos, flags: number) => cellHasTMFlagFn(pmap, p, flags),
        discoveredTerrainFlagsAtLoc: (p: Pos) => discoveredTerrainFlagsAtLocFn(
            pmap, p, tileCatalog,
            (tileType: number) => {
                const df = tileCatalog[tileType]?.discoverType ?? 0;
                return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
            },
        ),
        monsterAtLoc,
        cellHasTerrainFlag,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
        PRESSURE_PLATE_DEPRESSED: TileFlag.PRESSURE_PLATE_DEPRESSED,
        mapToShore: rogue.mapToShore,
        playerHasRespirationArmor: () =>
            !!(rogue.armor &&
               (rogue.armor.flags & ItemFlag.ITEM_RUNIC) &&
               (rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED) &&
               rogue.armor.enchant2 === ArmorEnchant.Respiration),
        burnedTerrainFlagsAtLoc: (p: Pos) => burnedTerrainFlagsAtLocFn(pmap, p),
    } as unknown as MonsterStateContext;

    const cloneMonsterCtx: CloneMonsterContext = {
        rng: { randRange: (lo, hi) => randRange(lo, hi), randPercent: (pct) => randPercent(pct) },
        player,
        monsters,
        dormantMonsters,
        prependCreature: (monst) => { monsters.unshift(monst); },
        removeFromMonsters: (monst) => {
            const idx = monsters.indexOf(monst);
            if (idx >= 0) { monsters.splice(idx, 1); return true; }
            return false;
        },
        removeFromDormant: (monst) => {
            const idx = dormantMonsters.indexOf(monst);
            if (idx >= 0) { dormantMonsters.splice(idx, 1); return true; }
            return false;
        },
        becomeAllyWith: (monst) => becomeAllyWithFn(monst, {
            player,
            demoteMonsterFromLeadership: (m) => demoteMonsterFromLeadershipFn(m, monsters),
            makeMonsterDropItem: (m) => doMakeMonsterDropItem(
                m, pmap, floorItems,
                (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
                buildRefreshDungeonCellFn(),
            ),
            refreshDungeonCell: buildRefreshDungeonCellFn(),
        }),
        getQualifyingPathLocNear: (loc) => loc, // not reached when placeClone=false
        setPmapFlag: (loc, flag) => { if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag; },
        refreshDungeonCell: buildRefreshDungeonCellFn(),
        canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName: monsterNameFn,
        message: (text, flags) => { void damageCtx.message(text, flags); },
        featRecord: rogue.featRecord,
        FEAT_JELLYMANCER: FeatType.Jellymancer,
    };

    // Helper: build the strengthCheck closure once, reused for attack ctx and weaken.
    const doStrengthCheck = (item: Item | null, force: boolean): void => {
        if (!item) return;
        const s = buildEquipState();
        strengthCheckFn(item, !force, {
            state: s,
            message: (msg) => { void damageCtx.messageWithColor(msg, badMessageColor); },
            itemName: (i, incDet, incArt) => itemNameFn(i, incDet, incArt, namingCtx),
            updateRingBonuses: () => { updateRingBonusesFn(s); syncEquipBonuses(s); },
            updateEncumbrance: () => updateEncumbranceFn(s),
        });
    };

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
            const refreshCell = buildRefreshDungeonCellFn();
            const creatureFlag = monst === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER;
            if (coordinatesAreInMap(monst.loc.x, monst.loc.y)) {
                pmap[monst.loc.x][monst.loc.y].flags &= ~creatureFlag;
                refreshCell(monst.loc);
            }
            monst.loc = { x: loc.x, y: loc.y };
            if (coordinatesAreInMap(loc.x, loc.y)) {
                pmap[loc.x][loc.y].flags |= creatureFlag;
            }
            refreshCell(monst.loc);
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
        magicWeaponHit: () => {}, // wired below — needs runicCtx self-reference
        applyArmorRunicEffect: () => "", // wired below — needs runicCtx self-reference
        specialHit: () => {}, // wired below to allow self-reference
        splitMonster: () => {}, // wired below to allow self-reference via splitHelperCtx

        // ── Display ───────────────────────────────────────────────────────────
        attackVerb: (attacker, damagePercent) => attackVerbFn(attacker, damagePercent, monsterText, {
            player,
            weapon: rogue.weapon,
            canSeeMonster: (m: Creature) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        } as unknown as CombatHelperContext),
        messageColorFromVictim: (defender) =>
            defender === player ? badMessageColor : goodMessageColor,

        // ── Item / weapon ops ─────────────────────────────────────────────────
        decrementWeaponAutoIDTimer: () => {}, // wired below — needs splitHelperCtx
        rechargeItemsIncrementally: (multiplier: number) => rechargeItemsIncrementallyFn(multiplier, {
            rogue: { wisdomBonus: rogue.wisdomBonus },
            FP_FACTOR: Number(FP_FACTOR),
            ringWisdomMultiplier: (val: number) => Number(ringWisdomMultiplierFn(BigInt(val))),
            packItems,
            randClumpedRange,
            max: Math.max,
            clamp,
            charmRechargeDelay: (kind: number, enchant: number) =>
                charmRechargeDelayFn(charmEffectTable[kind], enchant),
            itemName: (item: Item, includeDetails: boolean, includeArticle: boolean) =>
                itemNameFn(item, includeDetails, includeArticle, namingCtx),
            message: (msg: string, flags: number) => { void damageCtx.message(msg, flags); },
        } as unknown as MiscHelpersContext),
        equipItem: (item, force) => {
            const s = buildEquipState();
            equipItemFn(item, force, null, { state: s, message: () => {}, itemName: () => "item",
                updateRingBonuses: () => { updateRingBonusesFn(s); syncEquipBonuses(s); },
                updateEncumbrance: () => updateEncumbranceFn(s) });
            syncEquipState(s);
        },
        itemName: (item) => itemNameFn(item, false, true, namingCtx),
        checkForDisenchantment: (item) => {
            checkForDisenchantmentFn(item, NUMBER_GOOD_WEAPON_ENCHANT_KINDS, ArmorEnchant.NumberGoodArmorEnchantKinds);
        },
        strengthCheck: doStrengthCheck,
        itemMessageColor,

        // ── Feat tracking ─────────────────────────────────────────────────────
        handlePaladinFeat: () => {}, // wired below — needs splitHelperCtx
        setPureMageFeatFailed() { rogue.featRecord[FeatType.PureMage] = false; },
        setDragonslayerFeatAchieved() { rogue.featRecord[FeatType.DragonSlayer] = true; },
        reportHeardCombat() {
            const already = rogue.heardCombatThisTurn;
            rogue.heardCombatThisTurn = true;
            return already;
        },

        // ── Colors ───────────────────────────────────────────────────────────
        whiteColor: white,
        redColor: red,

        gameOverFromMonster(monName) { gameOver(`Killed by a ${monName}`); },
        unAlly: (monst) => unAllyFn(monst),
        alertMonster: (monst) => alertMonsterFn(monst, player),
        armorRunicIdentified: () => !!(rogue.armor && (rogue.armor.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED)),
        autoIdentify: (item) => autoIdentifyFn(item, {
            gc: gameConst,
            messageWithColor: (msg, color, _flags) => { void damageCtx.messageWithColor(msg, color); },
            itemMessageColor, namingCtx,
        }),
        createFlare: (x, y, lightType) => createFlareFn(x, y, lightType as LightType, rogue, lightCatalog),
        cloneMonster: (monst, selfClone, maintainCorpse) => cloneMonsterFn(monst, selfClone, maintainCorpse, cloneMonsterCtx),
        playerImmuneToMonster: () => false, // wired below — needs splitHelperCtx
        slow: (monst, duration) => slowFn(monst, duration, {
            player,
            updateEncumbrance: () => updateEncumbranceFn(buildEquipState()),
            message: (msg, flags) => { void damageCtx.message(msg, flags); },
        }),
        weaken: (monst, duration) => {
            weakenFn(monst, duration, {
                player,
                rogue: { weapon: rogue.weapon, armor: rogue.armor },
                messageWithColor: (msg, color) => { void damageCtx.messageWithColor(msg, color); },
                badMessageColor,
                strengthCheck: doStrengthCheck,
            });
        },
        exposeCreatureToFire: buildExposeCreatureToFireFn(),
        monsterStealsFromPlayer: monsterStealsFromPlayerImpl,
        monstersAreEnemies: (m1, m2) => monstersAreEnemiesFn(m1, m2, player, cellHasTerrainFlag),
        onHitHallucinateDuration: gameConst.onHitHallucinateDuration,
        onHitWeakenDuration: gameConst.onHitWeakenDuration,
        onHitMercyHealPercent: gameConst.onHitMercyHealPercent,
        forceWeaponHit: () => false, // permanent-defer — needs zap() (bolt system not yet ported)
    };

    // Wire specialHit after construction so the closure can reference runicCtx
    runicCtx.specialHit = (attacker, defender, damage) => {
        specialHitFn(attacker, defender, damage, runicCtx);
    };

    // Wire splitMonster after construction — the helper context references
    // runicCtx for canSeeMonster/message/etc. and cloneMonsterCtx for cloning.
    const splitHelperCtx: CombatHelperContext = {
        player,
        weapon: rogue.weapon,
        armor: rogue.armor,
        playerStrength: rogue.strength,
        canSeeMonster: runicCtx.canSeeMonster,
        canDirectlySeeMonster: runicCtx.canDirectlySeeMonster,
        monsterName: monsterNameFn,
        monstersAreTeammates: (m1, m2) => monstersAreTeammatesFn(m1, m2, player),
        monsterAvoids: (monst, loc) => monsterAvoidsFn(monst, loc, monsterAvoidsCtx),
        monsterIsInClass: (monst, cls) => monsterIsInClassFn(monst, cls),
        monsterAtLoc,
        cellHasMonsterOrPlayer: (loc) => {
            const flags = pmap[loc.x]?.[loc.y]?.flags ?? 0;
            return !!(flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER));
        },
        isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
        message: (text, flags) => { void runicCtx.message(text, flags); },
        combatMessage: (text, color) => { void runicCtx.combatMessage(text, color); },
        cloneMonster: (monst, selfClone, maintainCorpse) => cloneMonsterFn(monst, selfClone, maintainCorpse, cloneMonsterCtx),
        fadeInMonster: runicCtx.fadeInMonster,
        refreshSideBar: runicCtx.refreshSideBar,
        setCellMonsterFlag: (loc, hasMonster) => {
            if (coordinatesAreInMap(loc.x, loc.y)) {
                if (hasMonster) pmap[loc.x][loc.y].flags |= TileFlag.HAS_MONSTER;
                else pmap[loc.x][loc.y].flags &= ~TileFlag.HAS_MONSTER;
            }
        },
        randRange: (lo, hi) => randRange(lo, hi),
        monsterCatalog,
        monsterClassCatalog,
        cautiousMode: rogue.cautiousMode,
        setCautiousMode: (val) => { rogue.cautiousMode = val; },
        updateIdentifiableItems: () => updateIdentifiableItemsFn({
            packItems, floorItems,
            updateIdentifiableItem: (item) => updateIdentifiableItemFn(item, { scrollTable: mutableScrollTable, potionTable: mutablePotionTable }),
        }),
        messageWithColor: (text, color) => { void runicCtx.messageWithColor(text, color); },
        itemName: (item) => itemNameFn(item, false, true, namingCtx),
        itemMessageColor,
        featRecord: rogue.featRecord,
        FEAT_PALADIN: FeatType.Paladin,
        iterateAllies: () => monsters.filter(m => m.creatureState === CreatureState.Ally),
        iterateAllMonsters: () => monsters,
        depthLevel: rogue.depthLevel,
        deepestLevel: rogue.deepestLevel,
    };
    runicCtx.splitMonster = (defender, attacker) => {
        splitMonsterFn(defender, attacker, splitHelperCtx);
    };

    // Wire helpers that need splitHelperCtx or runicCtx self-reference
    runicCtx.handlePaladinFeat = (defender) => handlePaladinFeatFn(defender, splitHelperCtx);
    runicCtx.playerImmuneToMonster = (monst) => playerImmuneToMonsterFn(monst, splitHelperCtx);
    runicCtx.decrementWeaponAutoIDTimer = () => decrementWeaponAutoIDTimerFn(splitHelperCtx);
    runicCtx.magicWeaponHit = (defender, weapon, wasSneakOrSleep) =>
        magicWeaponHitFn(defender, weapon, wasSneakOrSleep, runicCtx);
    runicCtx.applyArmorRunicEffect = (attacker, damage, melee) =>
        applyArmorRunicEffectFn(attacker, damage, melee, runicCtx);

    return runicCtx;
}

// buildFadeInMonsterFn is defined in combat-fade.ts (extracted to stay under
// the 600-line limit) and re-exported here for backward compatibility.
export { buildFadeInMonsterFn } from "./combat-fade.js";
