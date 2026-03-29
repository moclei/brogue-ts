/*
 *  turn-monster-zap-wiring.ts — ZapContext + bolt/blink context builders for monster turns
 *  Port V2 — rogue-ts
 *
 *  Exports:
 *    buildMonsterZapFn()             — returns a wired async zap() for monster contexts
 *    buildMonsterBoltBlinkContexts() — builds boltAICtx, blinkCtx, blinkToSafetyCtx,
 *                                      summonsCtx, and updateMonsterCorpseAbsorption
 *
 *  The ZapContext mirrors buildStaffZapFn() in items/staff-wiring.ts.
 *  Extracted from turn-monster-ai.ts to keep that file under the 600-line cap.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver as gameOverFn } from "./core.js";
import { buildApplyInstantTileEffectsFn } from "./tile-effects-wiring.js";
import { zap as zapFn } from "./items/zap.js";
import { buildCombatAttackContext, buildCombatDamageContext, buildFadeInMonsterFn } from "./combat.js";
import { attack as attackFn } from "./combat/combat-attack.js";
import {
    inflictDamage as inflictDamageFn,
    inflictLethalDamage as inflictLethalDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    heal as healFn,
    flashMonster as flashMonsterFn,
} from "./combat/combat-damage.js";
import { haste as hasteFn, slow as slowFn } from "./items/item-effects.js";
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
    avoidedFlagsForMonster,
    spawnMinions as spawnMinionsFn,
} from "./monsters/monster-spawning.js";
import {
    canSeeMonster as canSeeMonsterFn,
    canDirectlySeeMonster as canDirectlySeeMonsterFn,
    monsterIsHidden as monsterIsHiddenFn,
    monstersAreTeammates as monstersAreTeammatesFn,
    monstersAreEnemies as monstersAreEnemiesFn,
} from "./monsters/monster-queries.js";
import type { MonsterQueryContext } from "./monsters/monster-queries.js";
import { messageColorFromVictim as messageColorFromVictimFn } from "./io/color.js";
import {
    cellHasTerrainFlag as cellHasTerrainFlagFn,
    cellHasTMFlag as cellHasTMFlagFn,
    burnedTerrainFlagsAtLoc as burnedTerrainFlagsAtLocFn,
    discoveredTerrainFlagsAtLoc as discoveredTerrainFlagsAtLocFn,
} from "./state/helpers.js";
import { updateSafetyMap as updateSafetyMapFn } from "./time/safety-maps.js";
import type { SafetyMapsContext } from "./time/safety-maps.js";
import { dijkstraScan as dijkstraScanFn } from "./dijkstra/dijkstra.js";
import { DCOLS, DROWS } from "./types/constants.js";
import {
    buildMessageFns,
    buildExposeCreatureToFireFn,
    buildWakeUpFn,
    buildRefreshDungeonCellFn,
} from "./io-wiring.js";
import { boltCatalog } from "./globals/bolt-catalog.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { monsterCatalog } from "./globals/monster-catalog.js";
import { hordeCatalog } from "./globals/horde-catalog.js";
import { monsterText } from "./globals/monster-text.js";
import { mutationCatalog } from "./globals/mutation-catalog.js";
import { statusEffectCatalog } from "./globals/status-effects.js";
import { monsterBehaviorCatalog, monsterAbilityCatalog } from "./globals/status-effects.js";
import { goodMessageColor, advancementMessageColor, black } from "./globals/colors.js";
import { wandDominate as wandDominateFn } from "./power/power-tables.js";
import { freeCaptivesEmbeddedAt as freeCaptivesEmbeddedAtFn } from "./movement/ally-management.js";
import { buildResolvePronounEscapesFn } from "./io/text.js";
import { buildEquipState } from "./items/equip-helpers.js";
import { updateEncumbrance as updateEncumbranceFn } from "./items/item-usage.js";
import { generateMonster as generateMonsterFn } from "./monsters/monster-creation.js";
import { randPercent, randRange } from "./math/rng.js";
import { coordinatesAreInMap } from "./globals/tables.js";
import { distanceBetween, empowerMonster as empowerMonsterFn } from "./monsters/monster-state.js";
import type { MonsterStateContext } from "./monsters/monster-state.js";
import {
    TileFlag, TerrainFlag, MonsterBookkeepingFlag, IS_IN_MACHINE,
    TerrainMechFlag, MonsterAbilityFlag,
} from "./types/flags.js";
import {
    BoltEffect, BoltType, CreatureState, LightType, StatusEffect,
} from "./types/enums.js";
import { MonsterBehaviorFlag } from "./types/flags.js";
import { monsterHasBoltEffect as monsterHasBoltEffectFn } from "./monsters/monster-bolt-ai.js";
import type { BoltAIContext } from "./monsters/monster-bolt-ai.js";
import type { MonsterBlinkContext, MonsterBlinkToSafetyContext } from "./monsters/monster-blink-ai.js";
import { monsterSummons as monsterSummonsFn } from "./monsters/monster-actions.js";
import type { MonsterSummonsContext } from "./monsters/monster-actions.js";
import { summonMinions as summonMinionsFn } from "./monsters/monster-summoning.js";
import type { SummonMinionsContext } from "./monsters/monster-summoning.js";
import { buildMonsterSpawningContext } from "./monsters.js";
import {
    updateMonsterCorpseAbsorption as updateMonsterCorpseAbsorptionFn,
} from "./monsters/monster-corpse-absorption.js";
import type { CorpseAbsorptionContext } from "./monsters/monster-corpse-absorption.js";
import { openPathBetween as openPathBetweenFn } from "./items/bolt-geometry.js";
import { unflag } from "./game/game-cleanup.js";
import { allocGrid } from "./grid/grid.js";
import type { Bolt, Color, Creature, Pcell, Pos } from "./types/types.js";
import type { PlayerCharacter } from "./types/types.js";
import type { ZapContext, ZapRenderContext } from "./items/zap-context.js";

// =============================================================================
// ZapRenderContext — all visual effects are no-ops (mirrors staff-wiring.ts)
// =============================================================================

function buildZapRenderContext(): ZapRenderContext {
    return {
        refreshSideBar: () => {},
        displayCombatText: () => {},
        refreshDungeonCell: () => {},
        backUpLighting: () => {},
        restoreLighting: () => {},
        demoteVisibility: () => {},
        updateFieldOfViewDisplay: () => {},
        paintLight: () => {},
        updateVision: () => {},
        updateLighting: () => {},
        hiliteCell: () => {},
        pauseAnimation: async () => false,
        getCellAppearance: () => ({ char: 0x2e as never, foreColor: black, backColor: black }),
        plotCharWithColor: () => {},
        colorMultiplierFromDungeonLight: () => ({ ...black, colorDances: false }),
    };
}

function buildMonsterAtLocFn(player: Creature, monsters: Creature[]) {
    return (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

// =============================================================================
// buildMonsterZapFn — wired async zap() for monster bolt/blink contexts
// =============================================================================

/**
 * Returns a pre-bound async zap() for use in monster bolt/blink contexts.
 * Mirrors buildStaffZapFn() in items/staff-wiring.ts; called once per
 * buildMonsterBoltBlinkContexts() invocation.
 */
export function buildMonsterZapFn() {
    return async (
        originLoc: Pos,
        targetLoc: Pos,
        theBolt: Bolt,
        hideDetails: boolean,
        reverseBoltDir: boolean,
    ): Promise<boolean> => {
        const {
            rogue, player, pmap, monsters,
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

        const zapCtx: ZapContext = {
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

            monsterName: (m, inc) => {
                if (m === player) return "you";
                const pfx = inc ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
                return `${pfx}${m.info.monsterName}`;
            },
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
            moralAttack: () => {},
            splitMonster: () => {},
            handlePaladinFeat: () => {},
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
            imbueInvisibility: (monst, turns) => { void monst; void turns; return false; },
            wandDominate: (monst) => wandDominateFn(monst.currentHP, monst.info.maxHP),
            becomeAllyWith: () => {},
            negate: (monst) => negateCreatureFn(monst, {
                player,
                boltCatalog,
                mutationCatalog,
                statusEffectCatalog,
                monsterName: (m, inc) => {
                    if (m === player) return "you";
                    const pfx = inc ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
                    return `${pfx}${m.info.monsterName}`;
                },
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
            cloneMonster: () => null,
            flashMonster: (m, c, s) => flashMonsterFn(m, c, s, damageCtx),
            wakeUp: buildWakeUpFn(player, monsters),
            exposeCreatureToFire: buildExposeCreatureToFireFn(),
            exposeTileToFire: () => false,
            exposeTileToElectricity: () => false,
            createFlare: () => {},

            tunnelize: (x, y) => tunnelizeFn(x, y, {
                pmap,
                tileCatalog,
                cellHasTerrainFlag,
                spawnDungeonFeature: () => {},
                monsterAtLoc,
                inflictLethalDamage: (attacker, defender) =>
                    inflictLethalDamageFn(attacker, defender, damageCtx),
                killCreature: (m, admin) => killCreatureFn(m, admin, damageCtx),
                freeCaptivesEmbeddedAt: (x2, y2) => freeCaptivesEmbeddedAtFn(x2, y2, {
                    player, pmap,
                    demoteMonsterFromLeadership: () => {},
                    makeMonsterDropItem: () => {},
                    refreshDungeonCell: () => {},
                    monsterName: (m, inc) => {
                        if (m === player) return "you";
                        const pfx = inc ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
                        return `${pfx}${m.info.monsterName}`;
                    },
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
                monsterName: (m, inc) => {
                    if (m === player) return "you";
                    const pfx = inc ? (m.creatureState === CreatureState.Ally ? "your " : "the ") : "";
                    return `${pfx}${m.info.monsterName}`;
                },
                message: (msg, flags) => { void io.message(msg, flags); },
                monsterAtLoc,
                cellHasTerrainFlag,
            }),
            spawnDungeonFeature: () => {},

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
            pickUpItemAt: () => {},
            checkForMissingKeys: () => {},
            findAlternativeHomeFor: () => null,
            autoIdentify: () => {},

            beckonMonster: () => {},
            polymorph: () => false,
            setUpWaypoints: () => {},
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
            getQualifyingPathLocNear: (loc) => loc,
            fadeInMonster: buildFadeInMonsterFn(),

            randPercent,
            randRange,
        };

        return zapFn(originLoc, targetLoc, theBolt, hideDetails, reverseBoltDir, zapCtx);
    };
}

// =============================================================================
// buildMonsterBoltBlinkContexts — bolt/blink/summon/corpse context builder
// =============================================================================

/**
 * Dependencies passed from buildMonstersTurnContext() to avoid re-extracting
 * game state. All catalog constants are imported directly at module level.
 */
export interface MonsterBoltBlinkDeps {
    player: Creature;
    monsters: Creature[];
    rogue: PlayerCharacter;
    pmap: Pcell[][];
    queryCtx: MonsterQueryContext;
    io: ReturnType<typeof buildMessageFns>;
    chTF: (loc: Pos, flags: number) => boolean;
    inFOV: (loc: Pos) => boolean;
    monsterAvoids: (monst: Creature, p: Pos) => boolean;
    localSafetyMap: number[][];
    resolvePronounEscapes: (text: string, monst: Creature) => string;
    copyGrid: (src: number[][], dst: number[][]) => void;
}

/**
 * Builds and returns the bolt/blink/summon/corpse contexts for monstersTurn.
 * Extracted from turn-monster-ai.ts to keep that file under the 600-line cap.
 */
export function buildMonsterBoltBlinkContexts(deps: MonsterBoltBlinkDeps): {
    boltAICtx: BoltAIContext;
    blinkCtx: MonsterBlinkContext;
    blinkToSafetyCtx: MonsterBlinkToSafetyContext;
    summonsCtx: MonsterSummonsContext;
    updateMonsterCorpseAbsorption: (monst: Creature) => boolean;
} {
    const {
        player, monsters, rogue, pmap,
        queryCtx, io, chTF, inFOV,
        monsterAvoids, localSafetyMap, resolvePronounEscapes, copyGrid,
    } = deps;

    const monsterNameFn = (m: Creature, includeArticle: boolean): string => {
        if (m === player) return "you";
        const pfx = includeArticle
            ? (m.creatureState === CreatureState.Ally ? "your " : "the ")
            : "";
        return `${pfx}${m.info.monsterName}`;
    };

    // ── summonMinionsCtx ──────────────────────────────────────────────────────
    const summonMinionsCtx: SummonMinionsContext = {
        hordeCatalog, monsters, player,
        rng: { randRange, randPercent: (pct) => randPercent(pct) },
        spawnMinions: (hordeID, leader) =>
            spawnMinionsFn(hordeID, leader, true, false, buildMonsterSpawningContext()),
        clearCellFlag: (loc, flag) => {
            if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags &= ~flag;
        },
        setCellFlag: (loc, flag) => {
            if (coordinatesAreInMap(loc.x, loc.y)) pmap[loc.x][loc.y].flags |= flag;
        },
        removeCreature: (monst) => {
            const idx = monsters.indexOf(monst);
            if (idx !== -1) { monsters.splice(idx, 1); return true; }
            return false;
        },
        prependCreature: (monst) => monsters.unshift(monst),
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        monsterName: monsterNameFn,
        getSummonMessage: (id) => monsterText[id]?.summonMessage ?? "",
        message: io.message,
        fadeInMonster: buildFadeInMonsterFn(),
        refreshDungeonCell: buildRefreshDungeonCellFn(),
        demoteMonsterFromLeadership: () => {},
        createFlare: () => {},
        monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
        MA_ENTER_SUMMONS: MonsterAbilityFlag.MA_ENTER_SUMMONS,
        MB_JUST_SUMMONED: MonsterBookkeepingFlag.MB_JUST_SUMMONED,
        MB_LEADER: MonsterBookkeepingFlag.MB_LEADER,
        HAS_MONSTER: TileFlag.HAS_MONSTER,
        SUMMONING_FLASH_LIGHT: LightType.SUMMONING_FLASH_LIGHT,
    };

    const summonsCtx: MonsterSummonsContext = {
        player, monsters,
        rng: { randRange },
        adjacentLevelAllyCount: 0,
        deepestLevel: rogue.deepestLevel,
        depthLevel: rogue.depthLevel,
        summonMinions: (monst) => { summonMinionsFn(monst, summonMinionsCtx); },
    };

    // ── blinkCtx + blinkToSafetyCtx ───────────────────────────────────────────
    const blinkCtx: MonsterBlinkContext = {
        boltCatalog,
        monsterHasBoltEffect: (monst, effectType) =>
            monsterHasBoltEffectFn(monst, effectType, boltCatalog),
        monsterAvoids: (monst, p) => monsterAvoids(monst, p),
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, queryCtx),
        monsterName: monsterNameFn,
        combatMessage: io.combatMessage,
        cellHasTerrainFlag: chTF,
        zap: buildMonsterZapFn(),
        BE_BLINKING: BoltEffect.Blinking,
        BOLT_BLINKING: BoltType.BLINKING,
        MONST_CAST_SPELLS_SLOWLY: MonsterBehaviorFlag.MONST_CAST_SPELLS_SLOWLY,
    };

    const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
    const chTMF = (loc: Pos, flag: number) => cellHasTMFlagFn(pmap, loc, flag);

    const blinkToSafetyCtx: MonsterBlinkToSafetyContext = {
        ...blinkCtx,
        allySafetyMap: allocGrid(),
        rogue,  // real object so updatedSafetyMapThisTurn writes persist
        player,
        safetyMap: localSafetyMap,
        inFieldOfView: inFOV,
        allocGrid,
        copyGrid,
        updateSafetyMap: () => updateSafetyMapFn({
            rogue,
            player,
            pmap,
            safetyMap: localSafetyMap,
            allySafetyMap: localSafetyMap,  // unused by updateSafetyMap
            DCOLS, DROWS,
            FP_FACTOR: 1,                   // unused by updateSafetyMap
            cellHasTerrainFlag: chTF,
            cellHasTMFlag: chTMF,
            coordinatesAreInMap: (x: number, y: number) => coordinatesAreInMap(x, y),
            discoveredTerrainFlagsAtLoc: (pos: Pos) => discoveredTerrainFlagsAtLocFn(
                pmap, pos, tileCatalog,
                (tileType) => {
                    const df = tileCatalog[tileType]?.discoverType ?? 0;
                    return df ? (tileCatalog[dungeonFeatureCatalog[df]?.tile ?? 0]?.flags ?? 0) : 0;
                },
            ),
            monsterAtLoc,
            allocGrid,
            freeGrid: () => {},
            dijkstraScan: dijkstraScanFn,
        } as unknown as SafetyMapsContext),
        updateAllySafetyMap: () => {},
    };

    // ── boltAICtx ─────────────────────────────────────────────────────────────
    const boltAICtx: BoltAIContext = {
        player, monsters, rogue, boltCatalog, tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        rng: { randPercent },
        openPathBetween: (loc1, loc2) =>
            openPathBetweenFn(loc1, loc2, (pos) => chTF(pos, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
        cellHasTerrainFlag: chTF,
        inFieldOfView: inFOV,
        canDirectlySeeMonster: (m) => canDirectlySeeMonsterFn(m, queryCtx),
        monsterIsHidden: (target, viewer) => monsterIsHiddenFn(target, viewer, queryCtx),
        monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
        monstersAreEnemies: (a, b) => monstersAreEnemiesFn(a, b, player, chTF),
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        burnedTerrainFlagsAtLoc: (loc) => burnedTerrainFlagsAtLocFn(pmap, loc),
        avoidedFlagsForMonster,
        distanceBetween,
        monsterName: monsterNameFn,
        resolvePronounEscapes,
        combatMessage: io.combatMessage,
        zap: buildMonsterZapFn(),
        gameOver: (msg) => gameOverFn(msg),
        monsterSummons: (monst, alwaysUse) => monsterSummonsFn(monst, alwaysUse, summonsCtx),
    };

    // ── corpseAbsorptionCtx ───────────────────────────────────────────────────
    const corpseAbsorptionCtx: CorpseAbsorptionContext = {
        canSeeMonster: (m) => canSeeMonsterFn(m, queryCtx),
        monsterName: monsterNameFn,
        getAbsorbingText: (id) => monsterText[id]?.absorbing ?? "",
        boltAbilityDescription: (boltIndex) => boltCatalog[boltIndex]?.abilityDescription ?? "",
        behaviorDescription: (flagIndex) => monsterBehaviorCatalog[flagIndex]?.description ?? "",
        abilityDescription: (flagIndex) => monsterAbilityCatalog[flagIndex]?.description ?? "",
        resolvePronounEscapes,
        messageWithColor: io.messageWithColor,
        goodMessageColor,
        advancementMessageColor,
        MB_ABSORBING: MonsterBookkeepingFlag.MB_ABSORBING,
        MB_SUBMERGED: MonsterBookkeepingFlag.MB_SUBMERGED,
        MONST_FIERY: MonsterBehaviorFlag.MONST_FIERY,
        MONST_FLIES: MonsterBehaviorFlag.MONST_FLIES,
        MONST_IMMUNE_TO_FIRE: MonsterBehaviorFlag.MONST_IMMUNE_TO_FIRE,
        MONST_INVISIBLE: MonsterBehaviorFlag.MONST_INVISIBLE,
        MONST_RESTRICTED_TO_LIQUID: MonsterBehaviorFlag.MONST_RESTRICTED_TO_LIQUID,
        MONST_SUBMERGES: MonsterBehaviorFlag.MONST_SUBMERGES,
        STATUS_BURNING: StatusEffect.Burning,
        STATUS_LEVITATING: StatusEffect.Levitating,
        STATUS_IMMUNE_TO_FIRE: StatusEffect.ImmuneToFire,
        STATUS_INVISIBLE: StatusEffect.Invisible,
        BOLT_NONE: BoltType.NONE,
        unflag,
    };

    return {
        boltAICtx,
        blinkCtx,
        blinkToSafetyCtx,
        summonsCtx,
        updateMonsterCorpseAbsorption: (monst: Creature): boolean =>
            updateMonsterCorpseAbsorptionFn(monst, corpseAbsorptionCtx),
    };
}
