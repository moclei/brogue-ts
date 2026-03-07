/*
 *  items.ts — Item context builders
 *  Port V2 — rogue-ts
 *
 *  Provides buildItemHandlerContext() and buildItemHelperContext(),
 *  the context factories that wire the items module's DI interfaces.
 *
 *  UI functions (message, confirm, display), platform recording, and
 *  complex environment effects (spawnDungeonFeature, crystalize,
 *  negationBlast, haste, teleport, etc.) are stubbed here; they will
 *  be wired in port-v2-platform.  Charm/enchant calculations, heal,
 *  removeItemFromChain, and inventory queries are real implementations.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { buildCombatDamageContext } from "./combat.js";
import { buildTurnProcessingContext } from "./turn.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import {
    foodTable, wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "./globals/item-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import {
    itemName as itemNameFn,
    identify as identifyFn,
} from "./items/item-naming.js";
import {
    removeItemFromArray,
    numberOfMatchingPackItems as numberOfMatchingPackItemsFn,
} from "./items/item-inventory.js";
import { enchantMagnitude } from "./items/item-usage.js";
import {
    itemMagicPolarity as itemMagicPolarityFn,
    initializeItem,
} from "./items/item-generation.js";
import {
    heal as healFn,
    killCreature as killCreatureFn,
} from "./combat/combat-damage.js";
import { distanceBetween } from "./monsters/monster-state.js";
import { spawnHorde as spawnHordeFn } from "./monsters/monster-spawning.js";
import {
    monsterName as monsterNameFn,
    monstersAreEnemies as monstersAreEnemiesFn,
    canSeeMonster as canSeeMonsterFn,
    monsterRevealed as monsterRevealedFn,
} from "./monsters/monster-queries.js";
import { negateCreature } from "./monsters/monster-negate.js";
import {
    negationBlast as negationBlastFn,
    haste as hasteFn,
    makePlayerTelepathic as makePlayerTelepathicFn,
    imbueInvisibility as imbueInvisibilityFn,
    discordBlast as discordBlastFn,
    rechargeItems as rechargeItemsFn,
    updateIdentifiableItem as updateIdentifiableItemFn,
    updatePlayerRegenerationDelay as updatePlayerRegenerationDelayFn,
} from "./items/item-effects.js";
import { updateIdentifiableItems as updateIdentifiableItemsFn } from "./items/item-handlers.js";
import { statusEffectCatalog } from "./globals/status-effects.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "./io/color.js";
import {
    charmHealing as charmHealingFn,
    charmProtection as charmProtectionFn,
    charmEffectDuration as charmEffectDurationFn,
    charmShattering as charmShatteringFn,
    charmNegationRadius as charmNegationRadiusFn,
    charmRechargeDelay as charmRechargeDelayFn,
    staffBlinkDistance as staffBlinkDistanceFn,
} from "./power/power-tables.js";
import { randRange, randPercent, randClump } from "./math/rng.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "./state/helpers.js";
import {
    coordinatesAreInMap, mapToWindowX, mapToWindowY, nbDirs,
} from "./globals/tables.js";
import { playerTurnEnded as playerTurnEndedFn } from "./time/turn-processing.js";
import {
    itemMessageColor, advancementMessageColor, magicMapFlashColor,
    darkBlue, gray, black,
} from "./globals/colors.js";
import { DungeonFeatureType, LightType, BoltType, CharmKind, StatusEffect } from "./types/enums.js";
import { TileFlag, MessageFlag, HordeFlag, HORDE_MACHINE_ONLY } from "./types/flags.js";
import { INVALID_POS } from "./types/types.js";
import { KEYBOARD_LABELS } from "./types/constants.js";
import type { ItemHandlerContext } from "./items/item-handlers.js";
import type { ItemHelperContext } from "./movement/item-helpers.js";
import type { ItemTable, Creature, Pos } from "./types/types.js";

// =============================================================================
// Private helpers
// =============================================================================

function buildMonsterAtLoc(player: Creature, monsters: Creature[]) {
    return function monsterAtLoc(loc: Pos): Creature | null {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

function buildNamingCtx(state: ReturnType<typeof getGameState>) {
    const { rogue, mutableScrollTable, mutablePotionTable, monsterCatalog, gameConst } = state;
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
        monsterClassName: (classId: number) =>
            monsterCatalog[classId]?.monsterName ?? "creature",
    };
}

// =============================================================================
// buildItemHandlerContext
// =============================================================================

/**
 * Build an ItemHandlerContext backed by the current game state.
 *
 * Wires real implementations for item tables, catalogs, RNG, heal,
 * charm calculations, inventory management, and turn advancement.
 * Platform/display, recording, environment effects, and movement-based
 * operations (haste, teleport, targeting) are stubbed — wired in
 * port-v2-platform.
 */
export function buildItemHandlerContext(): ItemHandlerContext {
    const state = getGameState();
    const {
        player, rogue, pmap, monsters, packItems, floorItems,
        mutableScrollTable, mutablePotionTable, gameConst,
    } = state;

    const combatCtx = buildCombatDamageContext();
    const namingCtx = buildNamingCtx(state);

    const cellHasTerrainFlag = (loc: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, loc, flags);
    const cellHasTMFlag = (loc: Pos, flags: number) =>
        cellHasTMFlagFn(pmap, loc, flags);
    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    // ── MonsterQueryContext — used by negationBlast creature checks ──────────
    const mqCtx = {
        player,
        cellHasTerrainFlag,
        cellHasGas: () => false,
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    // ── NegateContext — wires negateCreature for negationBlast ───────────────
    const negateCtx = {
        player,
        boltCatalog,
        mutationCatalog,
        statusEffectCatalog,
        monsterName: (m: Creature, includeArticle: boolean) =>
            monsterNameFn(m, includeArticle, mqCtx),
        killCreature: (m: Creature) => killCreatureFn(m, false, combatCtx),
        combatMessage: () => {},  // stub — messages wired in port-v2-platform
        messageColorFromVictim: (m: Creature) => messageColorFromVictimFn(
            m, player,
            player.status[StatusEffect.Hallucinating] > 0,
            rogue.playbackOmniscience,
            (a, b) => monstersAreEnemiesFn(a, b, player, cellHasTerrainFlag),
        ),
        extinguishFireOnCreature: () => {},  // stub — wired in port-v2-platform
        refreshDungeonCell: () => {},        // stub — wired in port-v2-platform
        applyInstantTileEffectsToCreature: () => {},  // stub — wired in port-v2-platform
        resolvePronounEscapes: (text: string) => text,  // stub — pronouns not yet resolved
    };

    return {
        // ── Game state ──────────────────────────────────────────────────────
        gc: gameConst,
        rogue,
        player,
        pmap,
        packItems,
        floorItems,
        monsters,

        // ── Item tables ─────────────────────────────────────────────────────
        scrollTable: mutableScrollTable,
        potionTable: mutablePotionTable,
        foodTable: foodTable as unknown as ItemTable[],
        wandTable: wandTable as unknown as ItemTable[],
        staffTable: staffTable as unknown as ItemTable[],
        ringTable: ringTable as unknown as ItemTable[],
        charmTable: charmTable as unknown as ItemTable[],

        // ── Catalogs ────────────────────────────────────────────────────────
        tileCatalog: tileCatalog as unknown as Array<{ flags: number; mechFlags: number; drawPriority: number }>,
        boltCatalog,
        dungeonFeatureCatalog: dungeonFeatureCatalog as unknown as Array<object>,

        // ── Colors ──────────────────────────────────────────────────────────
        itemMessageColor,
        advancementMessageColor,

        // ── Naming context ──────────────────────────────────────────────────
        namingCtx,

        // ── RNG ─────────────────────────────────────────────────────────────
        randRange: (lo, hi) => randRange(lo, hi),
        randPercent: (pct) => randPercent(pct),
        randClump: (range) => randClump(range),

        // ── UI stubs (wired in port-v2-platform) ────────────────────────────
        message: () => {},
        messageWithColor: () => {},
        confirmMessages: () => {},
        confirm: () => true,
        temporaryMessage: () => {},
        printString: () => {},

        // ── Inventory / item management ─────────────────────────────────────
        promptForItemOfType: () => null,     // stub — needs UI
        numberOfMatchingPackItems: (cat, req, forbidden, _err) =>
            numberOfMatchingPackItemsFn(packItems, cat, req, forbidden),
        removeItemFromChain(item, chain) { removeItemFromArray(item, chain); },
        deleteItem(item) {
            const idx = floorItems.indexOf(item);
            if (idx >= 0) floorItems.splice(idx, 1);
        },
        updateIdentifiableItem(item) {
            updateIdentifiableItemFn(item, {
                scrollTable: mutableScrollTable,
                potionTable: mutablePotionTable,
            });
        },
        updateEncumbrance: () => {},         // stub — wired in port-v2-platform
        updateRingBonuses: () => {},         // stub — wired in port-v2-platform
        equipItem: () => {},                 // stub — wired in port-v2-platform
        recalculateEquipmentBonuses: () => {},
        itemMagicPolarity: (item) => itemMagicPolarityFn(item),

        // ── Recording stubs (wired in port-v2-platform) ─────────────────────
        recordKeystroke: () => {},
        recordKeystrokeSequence: () => {},
        recordMouseClick: () => {},

        // ── Creature / combat helpers ────────────────────────────────────────
        heal: (target, percent, increaseMax) => healFn(target, percent, increaseMax, combatCtx),
        haste(target, duration) {
            hasteFn(target, duration, {
                player,
                updateEncumbrance: () => {},  // stub — wired in port-v2-platform
                message: () => {},            // stub — wired in port-v2-platform
            });
        },
        teleport: () => {},                  // stub — wired in port-v2-platform
        exposeCreatureToFire: () => {},      // stub — wired in port-v2-platform
        extinguishFireOnCreature: () => {},  // stub — wired in port-v2-platform
        makePlayerTelepathic(duration) {
            makePlayerTelepathicFn(duration, {
                player,
                monsters,
                refreshDungeonCell: () => {},  // stub — wired in port-v2-platform
                message: () => {},             // stub — wired in port-v2-platform
            });
        },
        imbueInvisibility(target, duration) {
            imbueInvisibilityFn(target, duration, {
                player,
                boltCatalog,
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                monsterRevealed: (m) => monsterRevealedFn(m, player),
                refreshDungeonCell: () => {},  // stub — wired in port-v2-platform
                refreshSideBar: () => {},      // stub — wired in port-v2-platform
                flashMonster: () => {},        // stub — wired in port-v2-platform
            });
        },
        wakeUp: () => {},                    // stub — wired in port-v2-platform
        fadeInMonster: () => {},             // stub — wired in port-v2-platform
        flashMonster: () => {},              // stub — wired in port-v2-platform
        aggravateMonsters: () => {},         // stub — wired in port-v2-platform
        monsterAtLoc,
        monsterName: (monst, _includeArticle) =>
            monst === player ? "you" : monst.info.monsterName,
        spawnHorde: (hordeID, pos, forbiddenHordeFlags, requiredHordeFlags) => {
            const spawnCtx = buildMonsterSpawningContext();
            return spawnHordeFn(hordeID, pos, forbiddenHordeFlags, requiredHordeFlags, spawnCtx);
        },
        summonGuardian: () => {},            // stub — wired in port-v2-platform

        // ── Dungeon feature / environment stubs ─────────────────────────────
        spawnDungeonFeature: () => {},       // stub — wired in port-v2-platform
        cellHasTMFlag,
        cellHasTerrainFlag,
        discover: () => {},                  // stub — wired in port-v2-platform
        refreshDungeonCell: () => {},        // stub — wired in port-v2-platform
        crystalize: () => {},                // stub — wired in port-v2-platform
        rechargeItems(categories) {
            rechargeItemsFn(categories, {
                packItems,
                message: () => {},           // stub — wired in port-v2-platform
            });
        },
        negationBlast(source, radius) {
            negationBlastFn(source, radius, {
                player,
                monsters,
                floorItems,
                pmap,
                itemMessageColor,
                negate: (m) => negateCreature(m, negateCtx),
                colorFlash: () => {},        // stub — wired in port-v2-platform
                flashMonster: () => {},      // stub — wired in port-v2-platform
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                messageWithColor: () => {},  // stub — wired in port-v2-platform
                identify: (item) => identifyFn(item, gameConst),
                refreshDungeonCell: () => {},  // stub — wired in port-v2-platform
                updateIdentifiableItems: () => updateIdentifiableItemsFn({
                    packItems,
                    floorItems,
                    updateIdentifiableItem: () => {},
                }),
                charmRechargeDelay: (kind, enchant) =>
                    charmRechargeDelayFn(charmEffectTable[kind], enchant),
                IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
            });
        },
        discordBlast(source, radius) {
            discordBlastFn(source, radius, {
                player,
                monsters,
                pmap,
                itemMessageColor,
                canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
                colorFlash: () => {},        // stub — wired in port-v2-platform
                flashMonster: () => {},      // stub — wired in port-v2-platform
                messageWithColor: () => {},  // stub — wired in port-v2-platform
                IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,
            });
        },

        // ── Visual effects stubs ────────────────────────────────────────────
        colorFlash: () => {},                // stub — wired in port-v2-platform
        createFlare: () => {},               // stub — wired in port-v2-platform
        displayLevel: () => {},              // stub — wired in port-v2-platform

        // ── Vision / light stubs ────────────────────────────────────────────
        updateMinersLightRadius: () => {},   // stub — wired in port-v2-platform
        updateVision: () => {},              // stub — wired in port-v2-platform
        updateClairvoyance: () => {},        // stub — wired in port-v2-platform
        updatePlayerRegenerationDelay() {
            updatePlayerRegenerationDelayFn({
                player,
                regenerationBonus: rogue.regenerationBonus,
            });
        },

        // ── Targeting stubs ─────────────────────────────────────────────────
        chooseTarget: () => ({ confirmed: false, target: { ...INVALID_POS } }),
        staffBlinkDistance: (enchant) => staffBlinkDistanceFn(enchant),
        playerCancelsBlinking: () => true,   // stub — wired in port-v2-platform

        // ── Turn management ─────────────────────────────────────────────────
        playerTurnEnded() {
            const turnCtx = buildTurnProcessingContext();
            playerTurnEndedFn(turnCtx);
        },

        // ── Map helpers ─────────────────────────────────────────────────────
        mapToWindowX: (x) => mapToWindowX(x),
        mapToWindowY: (y) => mapToWindowY(y),

        // ── Charm calculation helpers ────────────────────────────────────────
        charmHealing: (enchant) =>
            charmHealingFn(enchant, charmEffectTable[CharmKind.Health].effectMagnitudeMultiplier),
        charmProtection: (enchant) =>
            charmProtectionFn(enchant, charmEffectTable[CharmKind.Protection].effectMagnitudeMultiplier),
        charmEffectDuration: (kind, enchant) =>
            charmEffectDurationFn(charmEffectTable[kind], enchant),
        charmShattering: (enchant) =>
            charmShatteringFn(enchant, charmEffectTable[CharmKind.Shattering].effectMagnitudeConstant),
        charmNegationRadius: (enchant) =>
            charmNegationRadiusFn(
                enchant,
                charmEffectTable[CharmKind.Negation].effectMagnitudeConstant,
                charmEffectTable[CharmKind.Negation].effectMagnitudeMultiplier,
            ),
        charmRechargeDelay: (kind, enchant) =>
            charmRechargeDelayFn(charmEffectTable[kind], enchant),
        enchantMagnitude: () => enchantMagnitude(),

        // ── Dungeon feature indices ──────────────────────────────────────────
        DF_INCINERATION_POTION: DungeonFeatureType.DF_INCINERATION_POTION,
        DF_HOLE_POTION: DungeonFeatureType.DF_HOLE_POTION,
        DF_POISON_GAS_CLOUD_POTION: DungeonFeatureType.DF_POISON_GAS_CLOUD_POTION,
        DF_PARALYSIS_GAS_CLOUD_POTION: DungeonFeatureType.DF_PARALYSIS_GAS_CLOUD_POTION,
        DF_CONFUSION_GAS_CLOUD_POTION: DungeonFeatureType.DF_CONFUSION_GAS_CLOUD_POTION,
        DF_LICHEN_PLANTED: DungeonFeatureType.DF_LICHEN_PLANTED,
        DF_SACRED_GLYPHS: DungeonFeatureType.DF_SACRED_GLYPHS,

        // ── Light type indices ───────────────────────────────────────────────
        SCROLL_ENCHANTMENT_LIGHT: LightType.SCROLL_ENCHANTMENT_LIGHT,
        SCROLL_PROTECTION_LIGHT: LightType.SCROLL_PROTECTION_LIGHT,
        POTION_STRENGTH_LIGHT: LightType.POTION_STRENGTH_LIGHT,

        // ── Message flags ────────────────────────────────────────────────────
        REQUIRE_ACKNOWLEDGMENT: MessageFlag.REQUIRE_ACKNOWLEDGMENT,
        REFRESH_SIDEBAR: MessageFlag.REFRESH_SIDEBAR,

        // ── Misc constants ───────────────────────────────────────────────────
        KEYBOARD_LABELS,
        INVALID_POS: { ...INVALID_POS },
        BOLT_SHIELDING: BoltType.SHIELDING,

        // ── Horde flags ──────────────────────────────────────────────────────
        HORDE_LEADER_CAPTIVE: HordeFlag.HORDE_LEADER_CAPTIVE,
        HORDE_NO_PERIODIC_SPAWN: HordeFlag.HORDE_NO_PERIODIC_SPAWN,
        HORDE_IS_SUMMONED: HordeFlag.HORDE_IS_SUMMONED,
        HORDE_MACHINE_ONLY,

        // ── Magic mapping colors ─────────────────────────────────────────────
        magicMapFlashColor,
        darkBlue,
        gray,
        black,

        // ── Tile flag constants ──────────────────────────────────────────────
        MAGIC_MAPPED: TileFlag.MAGIC_MAPPED,
        IN_FIELD_OF_VIEW: TileFlag.IN_FIELD_OF_VIEW,

        // ── Directional offsets ──────────────────────────────────────────────
        nbDirs,
    };
}

// =============================================================================
// buildItemHelperContext
// =============================================================================

/**
 * Build an ItemHelperContext backed by the current game state.
 *
 * Wires real implementations for item description, key use, map queries,
 * and pack/floor item management.  promoteTile and discover are stubbed —
 * they require terrain mutation wired in port-v2-platform.
 */
export function buildItemHelperContext(): ItemHelperContext {
    const state = getGameState();
    const { player, rogue, pmap, monsters, packItems, floorItems } = state;

    const namingCtx = buildNamingCtx(state);
    const monsterAtLoc = buildMonsterAtLoc(player, monsters);

    return {
        pmap,
        player,
        rogue: { playbackOmniscience: rogue.playbackOmniscience },
        tileCatalog: tileCatalog as unknown as readonly {
            flags: number; mechFlags: number; discoverType: number; description: string;
        }[],
        packItems,
        floorItems,
        itemMessageColor,

        initializeItem: () => initializeItem(),

        itemName(theItem, buf, includeDetails, includeArticle, _maxLen) {
            buf[0] = itemNameFn(theItem, includeDetails, includeArticle, namingCtx);
        },

        describeHallucinatedItem(buf) {
            buf[0] = "something strange";  // stub — wired in port-v2-platform
        },

        removeItemFromChain: (item, chain) => removeItemFromArray(item, chain),

        deleteItem(item) {
            removeItemFromArray(item, floorItems);
            removeItemFromArray(item, packItems);
        },

        monsterAtLoc,

        promoteTile: () => {},              // stub — wired in port-v2-platform

        messageWithColor: () => {},         // stub — wired in port-v2-platform

        cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
        cellHasTMFlag: (loc, flags) => cellHasTMFlagFn(pmap, loc, flags),
        coordinatesAreInMap: (x, y) => coordinatesAreInMap(x, y),
        playerCanDirectlySee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        distanceBetween: (p1, p2) => distanceBetween(p1, p2),
        discover: () => {},                 // stub — wired in port-v2-platform
        randPercent: (pct) => randPercent(pct),
        posEq: (a, b) => a.x === b.x && a.y === b.y,
    };
}
