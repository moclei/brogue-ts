/*
 *  turn-monster-zap-ctx.ts — buildMonsterZapCtx helper
 *  Port V2 — rogue-ts
 *
 *  Exports:
 *    buildMonsterZapCtx() — constructs the ZapContext for monster bolt/zap calls.
 *
 *  Extracted from turn-monster-zap-wiring.ts to keep that file under the
 *  600-line cap. Called by buildMonsterZapFn() in turn-monster-zap-wiring.ts.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver as gameOverFn } from "./core.js";
import { buildApplyInstantTileEffectsFn, buildExposeTileToFireFn, buildExposeTileToElectricityFn } from "./tile-effects-wiring.js";
import { buildSetUpWaypointsFn } from "./waypoint-wiring.js";
import { buildCombatAttackContext, buildCombatDamageContext, buildFadeInMonsterFn } from "./combat.js";
import { attack as attackFn, moralAttack as moralAttackFn } from "./combat/combat-attack.js";
import {
    inflictDamage as inflictDamageFn,
    inflictLethalDamage as inflictLethalDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    heal as healFn,
    flashMonster as flashMonsterFn,
} from "./combat/combat-damage.js";
import { haste as hasteFn, slow as slowFn, imbueInvisibility as imbueInvisibilityFn } from "./items/item-effects.js";
import { tunnelize as tunnelizeFn } from "./items/bolt-helpers.js";
import { negateCreature as negateCreatureFn } from "./monsters/monster-negate.js";
import { monsterClassCatalog } from "./globals/monster-class-catalog.js";
import {
    teleport as teleportFn,
    disentangle as disentangleFn,
} from "./monsters/monster-teleport.js";
import { calculateDistances } from "./dijkstra/dijkstra.js";
import { getFOVMask as getFOVMaskFn } from "./light/fov.js";
import {
    forbiddenFlagsForMonster as forbiddenFlagsForMonsterFn,
    avoidedFlagsForMonster as avoidedFlagsForMonsterFn,
} from "./monsters/monster-spawning.js";
import {
    canSeeMonster as canSeeMonsterFn,
} from "./monsters/monster-queries.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "./io/color.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
} from "./state/helpers.js";
import {
    buildMessageFns,
    buildExposeCreatureToFireFn,
    buildWakeUpFn,
    buildRefreshDungeonCellFn,
    buildGetCellAppearanceFn,
    buildHiliteCellFn,
    buildRefreshSideBarFn,
} from "./io-wiring.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { statusEffectCatalog } from "./globals/status-effects.js";
import { black } from "./globals/colors.js";
import { wandDominate as wandDominateFn } from "./power/power-tables.js";
import { freeCaptivesEmbeddedAt as freeCaptivesEmbeddedAtFn } from "./movement/ally-management.js";
import { becomeAllyWith as becomeAllyWithFn } from "./monsters/monster-lifecycle.js";
import { cloneMonster as cloneMonsterFn } from "./monsters/monster-lifecycle.js";
import type { CloneMonsterContext } from "./monsters/monster-lifecycle.js";
import { demoteMonsterFromLeadership as demoteMonsterFromLeadershipFn } from "./monsters/monster-ally-ops.js";
import { unAlly as unAllyFn } from "./monsters/monster-ally-ops.js";
import { freeCreature as freeCreatureFn } from "./game/game-cleanup.js";
import { initializeStatus as initializeStatusFn } from "./monsters/monster-creation.js";
import { doMakeMonsterDropItem } from "./monsters/monster-drop.js";
import { buildResolvePronounEscapesFn } from "./io/text.js";
import { buildEquipState } from "./items/equip-helpers.js";
import { buildBoltLightingFns } from "./vision-wiring.js";
import { plotCharWithColor as plotCharWithColorFn, mapToWindow } from "./io/display.js";
import { commitDraws, pauseAndCheckForEvent } from "./platform.js";
import { updateEncumbrance as updateEncumbranceFn } from "./items/item-usage.js";
import { generateMonster as generateMonsterFn } from "./monsters/monster-creation.js";
import { randPercent, randRange } from "./math/rng.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { empowerMonster as empowerMonsterFn } from "./monsters/monster-state.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import {
    TileFlag, TerrainMechFlag, MonsterBookkeepingFlag, IS_IN_MACHINE,
} from "./types/flags.js";
import { CreatureState } from "./types/enums.js";
import { spawnDungeonFeature as spawnDungeonFeatureFn } from "./architect/machines.js";
import { beckonMonster as beckonMonsterFn } from "./items/item-utils.js";
import { polymorph as polymorphFn } from "./items/monster-spell-effects.js";
import {
    getQualifyingPathLocNear as getQualifyingPathLocNearFn,
} from "./movement/path-qualifying.js";
import { FeatType } from "./types/enums.js";
import type { Color, Creature, Pos } from "./types/types.js";
import type { ZapContext, ZapRenderContext } from "./items/zap-context.js";
import { displayCombatText as displayCombatTextFn } from "./io/messages.js";
import { buildMessageContext } from "./ui.js";
import type { MessageContext as SyncMessageContext } from "./io/messages-state.js";

// =============================================================================
// ZapRenderContext — real rendering wired (mirrors buildStaffZapRenderContext)
// =============================================================================

export function buildZapRenderContext(): ZapRenderContext {
    const { displayBuffer } = getGameState();
    const getCellAppFn = buildGetCellAppearanceFn();
    const hiliteFn = buildHiliteCellFn();
    const lighting = buildBoltLightingFns();
    const refreshSideBar = buildRefreshSideBarFn();
    const refreshDungeonCell = buildRefreshDungeonCellFn();
    return {
        refreshSideBar: () => refreshSideBar(),
        displayCombatText: () => { void displayCombatTextFn(buildMessageContext() as unknown as SyncMessageContext); },
        refreshDungeonCell: (loc) => refreshDungeonCell(loc),
        backUpLighting: () => lighting.backUpLighting(),
        restoreLighting: () => lighting.restoreLighting(),
        demoteVisibility: () => lighting.demoteVisibility(),
        updateFieldOfViewDisplay: (dancing, refresh) => lighting.updateFieldOfViewDisplay(dancing, refresh),
        paintLight: (theLight, x, y) => lighting.paintLight(theLight, x, y),
        updateVision: (full) => lighting.updateVision(full),
        updateLighting: () => lighting.updateLighting(),
        hiliteCell: (x, y, color, strength, _saveBuf) => hiliteFn(x, y, color, strength, false),
        pauseAnimation: async (delay) => {
            commitDraws();
            return pauseAndCheckForEvent(delay);
        },
        getCellAppearance: (loc) => {
            const { glyph, foreColor, backColor } = getCellAppFn(loc);
            return { char: glyph, foreColor, backColor };
        },
        plotCharWithColor: (theChar, loc, foreColor, backColor) =>
            plotCharWithColorFn(theChar, mapToWindow(loc), foreColor, backColor, displayBuffer),
        colorMultiplierFromDungeonLight: () => ({ ...black, colorDances: false }),
    };
}

export function buildMonsterAtLocFn(player: Creature, monsters: Creature[]) {
    return (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

// =============================================================================
// buildMonsterZapCtx — constructs the wired ZapContext for monster turns
// =============================================================================

/**
 * Builds a fully-wired ZapContext for use in monster bolt/zap calls.
 * Called once per invocation of buildMonsterZapFn's returned async function.
 */
export function buildMonsterZapCtx(): ZapContext {
    const {
        rogue, player, pmap, monsters, floorItems, dormantMonsters,
        monsterCatalog: mCatalog, monsterItemsHopper, gameConst,
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
        cellHasGas: () => false,
        playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playerCanDirectlySee: (x: number, y: number) =>
            !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
        playbackOmniscience: rogue.playbackOmniscience,
    };

    const damageCtx = buildCombatDamageContext();
    const attackCtx = buildCombatAttackContext();

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

    const monsterNameFn = (m: Creature, inc: boolean): string => {
        if (m === player) return "you";
        const pfx = inc ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
        return `${pfx}${m.info.monsterName}`;
    };

    // ── cloneMonsterCtx ───────────────────────────────────────────────────────
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
        getQualifyingPathLocNear: (loc, hallwaysAllowed, blockTF, blockMF, forbidTF, forbidMF, det) =>
            getQualifyingPathLocNearFn(loc, hallwaysAllowed, blockTF, blockMF, forbidTF, forbidMF, det, {
                pmap,
                cellHasTerrainFlag,
                cellFlags: (p) => pmap[p.x]?.[p.y]?.flags ?? 0,
                getQualifyingLocNear: (q) => q,
                rng: { randRange: (lo, hi) => randRange(lo, hi) },
            }),
        setPmapFlag: (loc, flag) => {
            if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag;
        },
        refreshDungeonCell: buildRefreshDungeonCellFn(),
        canSeeMonster: (m) => !!(pmap[m.loc.x]?.[m.loc.y]?.flags & TileFlag.VISIBLE),
        monsterName: monsterNameFn,
        message: (text, flags) => { void io.message(text, flags); },
        featRecord: rogue.featRecord,
        FEAT_JELLYMANCER: FeatType.Jellymancer,
    };

    return {
        render: buildZapRenderContext(),

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

        monsterName: monsterNameFn,
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
            refreshSideBar: () => {},
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
            monsterName: monsterNameFn,
            killCreature: (m) => killCreatureFn(m, false, damageCtx),
            combatMessage: (text, color) => {
                void io.combatMessage(text, color as Color | null);
            },
            messageColorFromVictim: (m) =>
                messageColorFromVictimFn(m, player, false, false, () => false) as Color,
            extinguishFireOnCreature: () => {},
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
        createFlare: () => {},          // visual only — deferred to port-v2-platform

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
                demoteMonsterFromLeadership: () => {},
                makeMonsterDropItem: () => {},
                refreshDungeonCell: () => {},
                monsterName: monsterNameFn,
                message: (msg, flags) => { void io.message(msg, flags); },
                monsterAtLoc,
                cellHasTerrainFlag,
            }),
            randPercent,
        }),
        freeCaptivesEmbeddedAt: (x, y) => freeCaptivesEmbeddedAtFn(x, y, {
            player, pmap,
            demoteMonsterFromLeadership: () => {},
            makeMonsterDropItem: () => {},
            refreshDungeonCell: () => {},
            monsterName: monsterNameFn,
            message: (msg, flags) => { void io.message(msg, flags); },
            monsterAtLoc,
            cellHasTerrainFlag,
        }),
        spawnDungeonFeature(x, y, dfType, refreshCell, abortIfBlocking, probabilityDecrement) {
            const feat = dungeonFeatureCatalog[dfType];
            if (!feat) return;
            const f = probabilityDecrement !== undefined
                ? { ...feat, probabilityDecrement }
                : feat;
            spawnDungeonFeatureFn(
                pmap, tileCatalog, dungeonFeatureCatalog,
                x, y, f as never, refreshCell, abortIfBlocking,
            );
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
            chooseNewWanderDestination: () => {},
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
        pickUpItemAt: () => {},         // stub — deferred
        checkForMissingKeys: () => {},  // stub — deferred
        findAlternativeHomeFor: () => null,  // permanent-defer — zap ctx; full home-finding requires map traversal not needed here
        autoIdentify: () => {},         // stub — deferred

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
            monsterCatalog: mCatalog,
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
                monsterCatalog: mCatalog,
                mutationCatalog,
                monsterItemsHopper,
                itemsEnabled: true,
            });
            monsters.push(monst);
            return monst;
        },
        getQualifyingPathLocNear: (loc, avoidTerrain, avoidFlags) =>
            getQualifyingPathLocNearFn(
                loc, true, avoidTerrain, avoidFlags, 0, 0, false,
                {
                    pmap,
                    cellHasTerrainFlag,
                    cellFlags: (p) => pmap[p.x]?.[p.y]?.flags ?? 0,
                    getQualifyingLocNear: (q) => q,
                    rng: { randRange: (lo, hi) => randRange(lo, hi) },
                },
            ),
        fadeInMonster: buildFadeInMonsterFn(),

        randPercent,
        randRange,
    };
}

