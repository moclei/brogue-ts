/*
 *  items/staff-zap-ctx.ts — buildStaffZapCtx helper (Port V2 — rogue-ts)
 *  Extracted from staff-wiring.ts to keep files under the 600-line cap.
 *  Called by buildStaffZapFn() in staff-wiring.ts.
 *  Render context: buildStaffZapRenderContext() in staff-targeting-wiring.ts.
 *  Domain stubs wired: cloneMonster, polymorph, beckonMonster, imbueInvisibility,
 *  autoIdentify, pickUpItemAt, checkForMissingKeys, findAlternativeHomeFor,
 *  getQualifyingPathLocNear.
 *  This program is free software: AGPL-3.0 or later.
 */

import { getGameState, gameOver as gameOverFn } from "../core.js";
import { buildApplyInstantTileEffectsFn, buildExposeTileToFireFn, buildExposeTileToElectricityFn } from "../tile-effects-wiring.js";
import { buildSetUpWaypointsFn } from "../waypoint-wiring.js";
import { buildCombatAttackContext, buildCombatDamageContext, buildFadeInMonsterFn } from "../combat.js";
import { attack as attackFn, moralAttack as moralAttackFn } from "../combat/combat-attack.js";
import {
    inflictDamage as inflictDamageFn,
    inflictLethalDamage as inflictLethalDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    heal as healFn,
    flashMonster as flashMonsterFn,
} from "../combat/combat-damage.js";
import { haste as hasteFn, slow as slowFn, imbueInvisibility as imbueInvisibilityFn } from "./item-effects.js";
import { tunnelize as tunnelizeFn } from "./bolt-helpers.js";
import { tileCatalog } from "../globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "../globals/dungeon-feature-catalog.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "../architect/machines.js";
import { negateCreature as negateCreatureFn } from "../monsters/monster-negate.js";
import { monsterClassCatalog } from "../globals/monster-class-catalog.js";
import {
    teleport as teleportFn,
    disentangle as disentangleFn,
} from "../monsters/monster-teleport.js";
import { calculateDistances } from "../dijkstra/dijkstra.js";
import { getFOVMask as getFOVMaskFn } from "../light/fov.js";
import {
    forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn,
    avoidedFlagsForMonster as avoidedFlagsForMonsterFn,
} from "../monsters/monster-spawning.js";
import {
    monsterName as monsterNameFn,
    canSeeMonster as canSeeMonsterFn,
} from "../monsters/monster-queries.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "../io/color.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "../state/helpers.js";
import {
    buildMessageFns,
    buildExposeCreatureToFireFn,
    buildWakeUpFn,
    buildRefreshDungeonCellFn,
    buildRefreshSideBarFn,
} from "../io-wiring.js";
// buildRefreshSideBarWithFocusFn used in staff-targeting-wiring.ts (imbueInvisibility still needs no-arg variant)
import { boltCatalog } from "../globals/bolt-catalog.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { statusEffectCatalog } from "../globals/status-effects.js";
import { wandDominate as wandDominateFn } from "../power/power-tables.js";
import { freeCaptivesEmbeddedAt as freeCaptivesEmbeddedAtFn } from "../movement/ally-management.js";
import { becomeAllyWith as becomeAllyWithFn, cloneMonster as cloneMonsterFn } from "../monsters/monster-lifecycle.js";
import type { CloneMonsterContext } from "../monsters/monster-lifecycle.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn, unAlly as unAllyFn } from "../monsters/monster-ally-ops.js";
import { freeCreature as freeCreatureFn } from "../game/game-cleanup.js";
import { initializeStatus as initializeStatusFn, generateMonster as generateMonsterFn } from "../monsters/monster-creation.js";
import { doMakeMonsterDropItem } from "../monsters/monster-drop.js";
import { buildResolvePronounEscapesFn } from "../io/text.js";
import { buildEquipState } from "./equip-helpers.js";
import { updateEncumbrance as updateEncumbranceFn } from "./item-usage.js";
import { randPercent, randRange } from "../math/rng.js";
import { coordinatesAreInMap } from "../globals/tables.js";
import { distanceBetween, empowerMonster as empowerMonsterFn } from "../monsters/monster-state.js";
import type { MonsterStateContext } from "../monsters/monster-state.js";
import { beckonMonster as beckonMonsterFn } from "./item-utils.js";
import { polymorph as polymorphFn } from "./monster-spell-effects.js";
import { getQualifyingPathLocNear as getQualifyingPathLocNearFn } from "../movement/path-qualifying.js";
import { autoIdentify as autoIdentifyFn } from "./item-handlers.js";
import { checkForMissingKeys as checkForMissingKeysFn } from "../movement/item-helpers.js";
import { findAlternativeHomeFor as findAlternativeHomeForFn } from "../monsters/monster-movement.js";
import { pickUpItemAt as pickUpItemAtFn } from "./pickup.js";
import { itemName as itemNameFn } from "./item-naming.js";
import {
    itemAtLoc as itemAtLocFn,
    removeItemFromArray as removeItemFromArrayFn,
    deleteItem as deleteItemFn,
    numberOfItemsInPack as numberOfItemsInPackFn,
    itemWillStackWithPack as itemWillStackWithPackFn,
    addItemToPack as addItemToPackFn,
    numberOfMatchingPackItems as numberOfMatchingPackItemsFn,
} from "./item-inventory.js";
import {
    wandTable, staffTable, ringTable, charmTable, charmEffectTable,
} from "../globals/item-catalog.js";
import type { ItemTable } from "../types/types.js";
import { charmRechargeDelay as charmRechargeDelayFn } from "../power/power-tables.js";
import { itemMessageColor } from "../globals/colors.js";
import {
    TileFlag, TerrainMechFlag, MonsterBookkeepingFlag, IS_IN_MACHINE,
} from "../types/flags.js";
import { CreatureState, FeatType } from "../types/enums.js";
import type { Item, Pos, Color, Creature } from "../types/types.js";
import type { ZapContext } from "./zap-context.js";
import { buildMonsterAtLocFn, buildStaffZapRenderContext } from "./staff-targeting-wiring.js";

// =============================================================================
// buildStaffZapCtx — full ZapContext for player staff/wand zap
// =============================================================================

/**
 * Builds a fully-wired ZapContext for player staff/wand use.
 * All game-logic stubs wired; persistence-deferred stubs remain.
 */
export function buildStaffZapCtx(): ZapContext {
    const {
        rogue, player, pmap, monsters, dormantMonsters, floorItems, packItems,
        monsterCatalog, monsterItemsHopper, gameConst, mutablePotionTable, mutableScrollTable,
    } = getGameState();
    const io = buildMessageFns();
    const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
    const cellHasTerrainFlag = (loc: Pos, flags: number) =>
        cellHasTerrainFlagFn(pmap, loc, flags);
    const cellHasTMFlag = (loc: Pos, flag: number) =>
        cellHasTMFlagFn(pmap, loc, flag);
    const mqCtx = {
        player,
        cellHasTerrainFlag,
        cellHasGas: (loc: Pos) => !!(pmap[loc.x]?.[loc.y]?.layers?.[3]),
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) =>
            !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    const damageCtx = buildCombatDamageContext();
    const attackCtx = buildCombatAttackContext();
    const refreshDungeonCellFn = buildRefreshDungeonCellFn();
    const applyInstantFn = buildApplyInstantTileEffectsFn();

    // ── namingCtx for autoIdentify ────────────────────────────────────────────
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
        monsterClassName: (_classId: number) => "creature",
    };

    // ── TeleportContext (for blinking staff) ──────────────────────────────────
    const calcDistCtx = {
        cellHasTerrainFlag,
        cellHasTMFlag,
        monsterAtLoc,
        monsterAvoids: () => false as const,
        discoveredTerrainFlagsAtLoc: () => 0,
        isPlayer: (m: Creature) => m === player,
        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
    };
    const fovCtx = {
        cellHasTerrainFlag,
        getCellFlags: (x: number, y: number) => pmap[x]?.[y]?.flags ?? 0,
    };

    // ── QualifyingPathContext ─────────────────────────────────────────────────
    const pathCtx = {
        pmap,
        cellHasTerrainFlag,
        cellFlags: (p: Pos) => pmap[p.x]?.[p.y]?.flags ?? 0,
        getQualifyingLocNear: (q: Pos) => q,
        rng: { randRange: (lo: number, hi: number) => randRange(lo, hi) },
    };

    // ── CloneMonsterContext ───────────────────────────────────────────────────
    const cloneCtx: CloneMonsterContext = {
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
                m, pmap, floorItems, cellHasTerrainFlag, buildRefreshDungeonCellFn(),
            ),
            refreshDungeonCell: buildRefreshDungeonCellFn(),
        }),
        getQualifyingPathLocNear: (loc, hw, blockTF, blockMF, forbidTF, forbidMF, det) =>
            getQualifyingPathLocNearFn(loc, hw, blockTF, blockMF, forbidTF, forbidMF, det, pathCtx),
        setPmapFlag: (loc, flag) => {
            if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag;
        },
        refreshDungeonCell: buildRefreshDungeonCellFn(),
        canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName: (m, inc) => monsterNameFn(m, inc, mqCtx),
        message: (text, flags) => { void io.message(text, flags); },
        featRecord: rogue.featRecord,
        FEAT_JELLYMANCER: FeatType.Jellymancer,
    };

    // ── ItemHelperContext (minimal) for checkForMissingKeys ───────────────────
    const itemHelperCtx = {
        pmap,
        player,
        tileCatalog,
        rogue: { playbackOmniscience: rogue.playbackOmniscience },
        packItems,
        floorItems,
        cellHasTerrainFlag,
        cellHasTMFlag,
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        promoteTile: () => {}, // permanent-defer — envCtx not available in zap wiring
        messageWithColor: io.messageWithColor,
        itemMessageColor,
        removeItemFromChain: (item: Item, chain: Item[]) => removeItemFromArrayFn(item, chain),
        deleteItem: deleteItemFn,
        monsterAtLoc,
        playerCanDirectlySee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        distanceBetween,
        discover: (x: number, y: number) => {
            if (coordinatesAreInMap(x, y)) pmap[x][y].flags |= TileFlag.DISCOVERED;
        },
        randPercent,
        posEq: (a: Pos, b: Pos) => a.x === b.x && a.y === b.y,
        keyOnTileAt: (_loc: Pos) => null as Item | null,
        initializeItem: () => ({}) as Item,
        itemName: (item: Item, buf: string[], inclDetails: boolean, inclArticle: boolean) => {
            buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx);
        },
        describeHallucinatedItem: (buf: string[]) => { buf[0] = "something"; },
    } as unknown as import("../movement/item-helpers.js").ItemHelperContext;

    // ── MonsterMovementContext (minimal) for findAlternativeHomeFor ───────────
    const monsterMoveCtx = {
        player,
        monsters,
        rng: { randRange: (lo: number, hi: number) => randRange(lo, hi), randPercent },
        coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
        cellHasTerrainFlag,
        cellHasTMFlag,
        cellFlags: (loc: Pos) => pmap[loc.x]?.[loc.y]?.flags ?? 0,
        setCellFlag: () => {},
        clearCellFlag: () => {},
        discoveredTerrainFlagsAtLoc: () => 0,
        passableArcCount: () => 0,
        liquidLayerIsEmpty: () => true,
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        monsterAtLoc,
        refreshDungeonCell: () => {},
        discover: () => {},
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
        updateVision: () => {},
        pickUpItemAt: () => {},
        shuffleList: (list: number[]) => {
            for (let i = list.length - 1; i > 0; i--) {
                const j = randRange(0, i);
                [list[i], list[j]] = [list[j], list[i]];
            }
        },
        monsterAvoids: () => false,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        HAS_PLAYER: TileFlag.HAS_PLAYER,
        HAS_ITEM: TileFlag.HAS_ITEM,
        HAS_STAIRS: TileFlag.HAS_STAIRS,
        DCOLS: pmap.length,
        DROWS: pmap[0]?.length ?? 0,
    } as unknown as import("../monsters/monster-movement.js").MonsterMovementContext;

    // ── PickUpItemAtContext ───────────────────────────────────────────────────
    const pickupCtx = {
        player,
        rogue,
        pmap,
        monsters,
        packItems,
        floorItems,
        gameConst,
        tileCatalog,
        itemAtLoc: (loc: Pos) => itemAtLocFn(loc, floorItems),
        identifyItemKind: () => {},          // permanent-defer — zap context: identification happens at use-site, not during zap resolution
        wandKindData: () => null,
        numberOfItemsInPack: () => numberOfItemsInPackFn(packItems),
        itemWillStackWithPack: (item: Item) => itemWillStackWithPackFn(item, packItems),
        removeItemFromFloor: (item: Item) => removeItemFromArrayFn(item, floorItems),
        addItemToPack: (item: Item) => addItemToPackFn(item, packItems),
        deleteItem: deleteItemFn,
        removeItemAt: () => {},              // permanent-defer — zap context: item removal (e.g. telekinesis) wired at movement layer
        numberOfMatchingPackItems: (cat: number, req: number, forb: number) =>
            numberOfMatchingPackItemsFn(packItems, cat, req, forb),
        getRandomMonsterSpawnLocation: (): Pos => ({ x: 0, y: 0 }), // DEFER: port-v2-persistence
        generateMonster: () => ({}) as Creature,                     // DEFER: port-v2-persistence
        itemName: (item: Item, buf: string[], inclDetails: boolean, inclArticle: boolean) => {
            buf[0] = itemNameFn(item, inclDetails, inclArticle, namingCtx);
        },
        messageWithColor: io.messageWithColor,
        message: (msg: string, flags: number) => { void io.message(msg, flags); },
        itemMessageColor,
        badMessageColor: { red: 100, green: 0, blue: 0, redRand: 0, greenRand: 0, blueRand: 0, rand: 0, colorDances: false },
    } as unknown as import("./pickup.js").PickUpItemAtContext;

    return {
        render: buildStaffZapRenderContext(),

        pmap,
        player,
        rogue: {
            armor: rogue.armor ?? null,
            strength: rogue.strength,
            weaknessAmount: player.weaknessAmount,
            scentTurnNumber: rogue.scentTurnNumber,
            playbackFastForward: rogue.playbackFastForward,
            playbackOmniscience: rogue.playbackOmniscience,
        },
        boltCatalog,
        monsterClassCatalog,

        monsterAtLoc,
        canSeeMonster: (m) => m === player ? true : canSeeMonsterFn(m, mqCtx),
        playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        cellHasTerrainFlag,
        cellHasTMFlag,

        monsterName: (m, inc) => monsterNameFn(m, inc, mqCtx),
        message: (text, flags) => { void io.message(text, flags); },
        combatMessage: (text, color) => {
            void io.combatMessage(text, color as Color | null);
        },
        messageColorFromVictim: (m) =>
            messageColorFromVictimFn(
                m, player,
                player.status[3 /* STATUS_HALLUCINATING */] > 0,
                rogue.playbackOmniscience,
                (a, b) => a === player
                    ? b.creatureState !== CreatureState.Ally
                    : b !== player,
            ) as Color,
        tileText: (_x, _y) => "here",

        attack: (attacker, defender, defenderInSight) =>
            attackFn(attacker, defender, defenderInSight, attackCtx),
        inflictDamage: (attacker, defender, damage, flashColor, ignoresProtection) =>
            inflictDamageFn(
                attacker, defender, damage, flashColor as Color | null,
                ignoresProtection, damageCtx,
            ),
        killCreature: (monst, admin) => killCreatureFn(monst, admin, damageCtx),
        moralAttack: (attacker, defender) => moralAttackFn(attacker, defender, attackCtx),
        splitMonster: (monst, attacker) => attackCtx.splitMonster(monst, attacker),
        handlePaladinFeat: (monst) => attackCtx.handlePaladinFeat(monst),
        gameOver: (msg) => { void gameOverFn(msg); },

        haste: (monst, turns) => hasteFn(monst, turns, {
            player,
            updateEncumbrance: () => {
                const s = buildEquipState();
                updateEncumbranceFn(s);
            },
            message: (msg, flags) => { void io.message(msg, flags); },
        }),
        slow: (monst, duration) => slowFn(monst, duration, {
            player,
            updateEncumbrance: () => {
                const s = buildEquipState();
                updateEncumbranceFn(s);
            },
            message: (msg, flags) => { void io.message(msg, flags); },
        }),
        imbueInvisibility: (monst, turns) => imbueInvisibilityFn(monst, turns, {
            player,
            boltCatalog,
            canSeeMonster: (m) => canSeeMonsterFn(m, mqCtx),
            monsterRevealed: (m) =>
                !!(m.bookkeepingFlags & MonsterBookkeepingFlag.MB_TELEPATHICALLY_REVEALED),
            refreshDungeonCell: buildRefreshDungeonCellFn(),
            refreshSideBar: buildRefreshSideBarFn(),
            flashMonster: (m, c, s) => flashMonsterFn(m, c, s, damageCtx),
        }),
        wandDominate: (monst) => wandDominateFn(monst.currentHP, monst.info.maxHP),
        becomeAllyWith: (monst) => becomeAllyWithFn(monst, {
            player,
            demoteMonsterFromLeadership: (m) => demoteMonsterFromLeadershipFn(m, monsters),
            makeMonsterDropItem: (m) => doMakeMonsterDropItem(m, pmap, floorItems, cellHasTerrainFlag, buildRefreshDungeonCellFn()),
            refreshDungeonCell: buildRefreshDungeonCellFn(),
        }),
        negate: (monst) => negateCreatureFn(monst, {
            player,
            boltCatalog,
            mutationCatalog,
            statusEffectCatalog,
            monsterName: (m, inc) => monsterNameFn(m, inc, mqCtx),
            killCreature: (m) => killCreatureFn(m, false, damageCtx),
            combatMessage: (text, color) => {
                void io.combatMessage(text, color as Color | null);
            },
            messageColorFromVictim: (m) =>
                messageColorFromVictimFn(m, player, false, false, () => false) as Color,
            extinguishFireOnCreature: () => {},  // permanent-defer
            refreshDungeonCell: () => {},
            refreshSideBar: () => {},
            applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
            resolvePronounEscapes: buildResolvePronounEscapesFn(player, pmap, rogue),
        }),
        empowerMonster: (monst) => empowerMonsterFn(monst, {
            queryCtx: mqCtx,
            heal: (m: Creature, pct: number, pan: boolean) => healFn(m, pct, pan, damageCtx),
            combatMessage: (text: string) => { void io.combatMessage(text, null); },
        } as unknown as MonsterStateContext),
        addPoison: (monst, tpp, amount) => addPoisonFn(monst, tpp, amount, damageCtx),
        heal: (monst, amount, healsAboveMax) => healFn(monst, amount, healsAboveMax, damageCtx),
        cloneMonster: (monst, announce, placeClone) => cloneMonsterFn(monst, announce, placeClone, cloneCtx),
        flashMonster: (m, c, s) => flashMonsterFn(m, c, s, damageCtx),
        wakeUp: buildWakeUpFn(player, monsters),
        exposeCreatureToFire: buildExposeCreatureToFireFn(),
        exposeTileToFire: buildExposeTileToFireFn(),
        exposeTileToElectricity: buildExposeTileToElectricityFn(),
        createFlare: () => {},  // visual only — deferred to port-v2-platform

        tunnelize: (x, y) => tunnelizeFn(x, y, {
            pmap,
            tileCatalog,
            cellHasTerrainFlag,
            spawnDungeonFeature: (x2, y2, feat, v, o) =>
                spawnDungeonFeatureFn(pmap, tileCatalog, dungeonFeatureCatalog, x2, y2, feat as never, v, o),
            monsterAtLoc,
            inflictLethalDamage: (attacker, defender) =>
                inflictLethalDamageFn(attacker, defender, damageCtx),
            killCreature: (m, admin) => killCreatureFn(m, admin, damageCtx),
            freeCaptivesEmbeddedAt: (x2, y2) => freeCaptivesEmbeddedAtFn(x2, y2, {
                player, pmap,
                demoteMonsterFromLeadership: (m) => demoteMonsterFromLeadershipFn(m, monsters),
                makeMonsterDropItem: (m) => doMakeMonsterDropItem(m, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCellFn),
                refreshDungeonCell: refreshDungeonCellFn,
                monsterName: (m, inc) => monsterNameFn(m, inc, mqCtx),
                message: (msg, flags) => { void io.message(msg, flags); },
                monsterAtLoc,
                cellHasTerrainFlag,
            }),
            randPercent,
        }),
        freeCaptivesEmbeddedAt: (x, y) => freeCaptivesEmbeddedAtFn(x, y, {
            player,
            pmap,
            demoteMonsterFromLeadership: (m) => demoteMonsterFromLeadershipFn(m, monsters),
            makeMonsterDropItem: (m) => doMakeMonsterDropItem(m, pmap, floorItems, cellHasTerrainFlag, refreshDungeonCellFn),
            refreshDungeonCell: refreshDungeonCellFn,
            monsterName: (m, inc) => monsterNameFn(m, inc, mqCtx),
            message: (msg, flags) => { void io.message(msg, flags); },
            monsterAtLoc,
            cellHasTerrainFlag,
        }),
        spawnDungeonFeature(x2, y2, dfType, refreshCell, abortIfBlocking, probabilityDecrement) {
            const feat = dungeonFeatureCatalog[dfType];
            if (!feat) return;
            const f = probabilityDecrement !== undefined
                ? { ...feat, probabilityDecrement }
                : feat;
            spawnDungeonFeatureFn(
                pmap, tileCatalog, dungeonFeatureCatalog,
                x2, y2, f as never, refreshCell, abortIfBlocking,
                refreshCell ? refreshDungeonCellFn : undefined,
            );
            if (refreshCell) {
                for (const monst of [player, ...monsters]) {
                    if (cellHasTMFlagFn(pmap, monst.loc, TerrainMechFlag.TM_PROMOTES_ON_CREATURE)) {
                        applyInstantFn(monst);
                    }
                }
            }
        },

        teleport: (monst, targetPos, safe) => teleportFn(monst, targetPos, safe, {
            player,
            disentangle: (m) => disentangleFn(m, {
                player,
                message: (msg, flags) => { void io.message(msg, flags); },
            }),
            calculateDistancesFrom: (grid, x, y, flags) =>
                calculateDistances(grid, x, y, flags, null, true, false, calcDistCtx),
            getFOVMaskAt: (grid, x, y, radius, terrain, flags, cautious) =>
                getFOVMaskFn(grid, x, y, radius, terrain, flags, cautious, fovCtx),
            forbiddenFlagsForMonster: (info) => forbiddenFlagsForMonsterFn(info),
            avoidedFlagsForMonster: (info) => avoidedFlagsForMonsterFn(info),
            cellHasTerrainFlag,
            cellHasTMFlag,
            getCellFlags: (x, y) => pmap[x]?.[y]?.flags ?? 0,
            isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
            setMonsterLocation(monst2, loc) {
                const flag = monst2 === player ? TileFlag.HAS_PLAYER : TileFlag.HAS_MONSTER;
                if (pmap[monst2.loc.x]?.[monst2.loc.y]) {
                    pmap[monst2.loc.x][monst2.loc.y].flags &= ~flag;
                }
                monst2.loc = { ...loc };
                if (pmap[loc.x]?.[loc.y]) {
                    pmap[loc.x][loc.y].flags |= flag;
                }
                if (
                    (monst2.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED) &&
                    !cellHasTMFlagFn(pmap, loc, TerrainMechFlag.TM_ALLOWS_SUBMERGING)
                ) {
                    monst2.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_SUBMERGED;
                }
            },
            chooseNewWanderDestination: (_monst: Creature) => {},
            IS_IN_MACHINE,
            HAS_PLAYER: TileFlag.HAS_PLAYER,
            HAS_MONSTER: TileFlag.HAS_MONSTER,
            HAS_STAIRS: TileFlag.HAS_STAIRS,
        }),
        disentangle: (m) => disentangleFn(m, {
            player,
            message: (msg, flags) => { void io.message(msg, flags); },
        }),
        applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),

        pickUpItemAt: (loc) => pickUpItemAtFn(loc, pickupCtx),
        checkForMissingKeys: (x, y) => checkForMissingKeysFn(x, y, itemHelperCtx),
        findAlternativeHomeFor: (monst) => {
            const result = findAlternativeHomeForFn(monst, true, monsterMoveCtx);
            return result.x >= 0 ? result : null;
        },
        autoIdentify: (theItem) => autoIdentifyFn(theItem, {
            gc: gameConst,
            messageWithColor: io.messageWithColor,
            itemMessageColor,
            namingCtx,
        }),

        beckonMonster: (monst, x, y) => beckonMonsterFn(monst, x, y, {
            pmap,
            player,
            boltCatalog,
            freeCaptive: (m) => {
                m.bookkeepingFlags &= ~MonsterBookkeepingFlag.MB_CAPTIVE;
                m.creatureState = CreatureState.Ally;
            },
            cellHasTerrainFlag,
            monsterAtLoc,
        }),

        polymorph: (monst) => polymorphFn(monst, {
            player,
            monsterCatalog,
            boltCatalog,
            randRange: (lo, hi) => randRange(lo, hi),
            unAlly: (m) => unAllyFn(m),
            freeCreature: (m) => freeCreatureFn(m),
            initializeStatus: (m) => initializeStatusFn(m),
            demoteMonsterFromLeadership: (m) => demoteMonsterFromLeadershipFn(m, monsters),
            refreshDungeonCell: () => {},
            flashMonster: (m, c, s) => flashMonsterFn(m, c, s, damageCtx),
        }),

        setUpWaypoints: buildSetUpWaypointsFn(),
        generateMonster: (kind, itemPossible, mutationPossible) => {
            const monst = generateMonsterFn(kind, itemPossible, mutationPossible, {
                rng: { randPercent, randRange },
                gameConstants: gameConst,
                depthLevel: rogue.depthLevel,
                monsterCatalog,
                mutationCatalog,
                monsterItemsHopper,
                itemsEnabled: true,
            });
            monsters.push(monst);
            return monst;
        },
        getQualifyingPathLocNear: (loc, avoidTerrain, avoidFlags) =>
            getQualifyingPathLocNearFn(
                loc, true, avoidTerrain, avoidFlags, 0, 0, false, pathCtx,
            ),
        fadeInMonster: buildFadeInMonsterFn(),

        randPercent,
        randRange,
    };
}
