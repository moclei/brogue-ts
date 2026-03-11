/*
 *  items/staff-wiring.ts — Context builders for staff/wand use (useStaffOrWand)
 *  Port V2 — rogue-ts
 *
 *  Exports three pre-bound factory functions wired into buildItemHandlerContext():
 *    buildStaffChooseTargetFn       — real chooseTarget (targeting cursor)
 *    buildStaffPlayerCancelsBlinkingFn — real playerCancelsBlinking
 *    buildStaffZapFn                — real zap() with ZapContext
 *
 *  Render context: all no-ops (animation wired separately in a later phase).
 *  Domain context: common effects wired; complex/rare ones stubbed.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, gameOver as gameOverFn } from "../core.js";
import { buildApplyInstantTileEffectsFn } from "../tile-effects-wiring.js";
import { waitForEvent, commitDraws } from "../platform.js";
import { moveCursor as moveCursorFn } from "../io/cursor-move.js";
import type { MoveCursorContext } from "../io/cursor-move.js";
import {
    chooseTarget as chooseTargetFn,
    playerCancelsBlinking as playerCancelsBlinkingFn,
} from "./targeting.js";
import { zap as zapFn } from "./zap.js";
import { buildCombatAttackContext, buildCombatDamageContext, buildFadeInMonsterFn } from "../combat.js";
import { attack as attackFn } from "../combat/combat-attack.js";
import {
    inflictDamage as inflictDamageFn,
    killCreature as killCreatureFn,
    addPoison as addPoisonFn,
    heal as healFn,
} from "../combat/combat-damage.js";
import { haste as hasteFn } from "./item-effects.js";
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
    monstersAreTeammates as monstersAreTeammatesFn,
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
    buildConfirmFn,
} from "../io-wiring.js";
import { boltCatalog } from "../globals/bolt-catalog.js";
import { mutationCatalog } from "../globals/mutation-catalog.js";
import { statusEffectCatalog } from "../globals/status-effects.js";
import { staffBlinkDistance as staffBlinkDistanceFn } from "../power/power-tables.js";
import { wandDominate as wandDominateFn } from "../power/power-tables.js";
import { freeCaptivesEmbeddedAt as freeCaptivesEmbeddedAtFn } from "../movement/ally-management.js";
import { negationWillAffectMonster as negationWillAffectMonsterFn } from "./bolt-helpers.js";
import { openPathBetween } from "./bolt-geometry.js";
import { buildResolvePronounEscapesFn } from "../io/text.js";
import { buildEquipState } from "./equip-helpers.js";
import { updateEncumbrance as updateEncumbranceFn } from "./item-usage.js";
import { generateMonster as generateMonsterFn } from "../monsters/monster-creation.js";
import { randPercent, randRange } from "../math/rng.js";
import {
    coordinatesAreInMap, mapToWindowX, windowToMapX, windowToMapY,
} from "../globals/tables.js";
import { distanceBetween } from "../monsters/monster-state.js";
import {
    TileFlag, TerrainFlag, MonsterBookkeepingFlag, IS_IN_MACHINE,
    TerrainMechFlag,
} from "../types/flags.js";
import { AutoTargetMode, BoltType } from "../types/enums.js";
import { black } from "../globals/colors.js";
import type { Item, Pos, RogueEvent, Bolt, Creature, Color } from "../types/types.js";
import type { ChooseTargetContext } from "./targeting.js";
import type { ZapContext, ZapRenderContext } from "./zap-context.js";

// =============================================================================
// Helpers
// =============================================================================

function buildMonsterAtLocFn(player: Creature, monsters: Creature[]) {
    return (loc: Pos): Creature | null => {
        if (loc.x === player.loc.x && loc.y === player.loc.y) return player;
        for (const m of monsters) {
            if (m.loc.x === loc.x && m.loc.y === loc.y) return m;
        }
        return null;
    };
}

/** Stub ZapRenderContext — all visual effects are no-ops. */
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

// =============================================================================
// buildStaffChooseTargetFn — real chooseTarget wired for staff/wand use
// =============================================================================

/**
 * Returns a pre-bound chooseTarget for use in ItemHandlerContext.
 * Awaits waitForEvent() on each cursor move, driving the targeting loop.
 * Mirrors the wiring in buildThrowCommandFn (item-commands.ts).
 */
export function buildStaffChooseTargetFn() {
    return async (maxDistance: number, autoTargetMode: number, theItem: Item) => {
        const { rogue, player, pmap, monsters, floorItems } = getGameState();
        const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
        const cellHasTerrainFlag = (loc: Pos, flags: number) =>
            cellHasTerrainFlagFn(pmap, loc, flags);
        const cellHasTMFlag = (loc: Pos, flags: number) =>
            cellHasTMFlagFn(pmap, loc, flags);
        const mqCtx = {
            player,
            cellHasTerrainFlag,
            cellHasGas: () => false,
            playerCanSee: (x: number, y: number) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanDirectlySee: (x: number, y: number) =>
                !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playbackOmniscience: rogue.playbackOmniscience,
        };
        const io = buildMessageFns();

        const chooseCtx: ChooseTargetContext = {
            rogue,
            player,
            pmap,
            boltCatalog,
            monstersAreTeammates: (a, b) => monstersAreTeammatesFn(a, b, player),
            canSeeMonster: (m) => m === player ? true : canSeeMonsterFn(m, mqCtx),
            openPathBetween: (from, to) => openPathBetween(from, to,
                (loc) => cellHasTerrainFlagFn(pmap, loc, TerrainFlag.T_OBSTRUCTS_PASSABILITY)),
            distanceBetween,
            wandDominate: (hp, max) => wandDominateFn(hp, max),
            negationWillAffectMonster: (m, isBolt) =>
                negationWillAffectMonsterFn(m, isBolt, boltCatalog, mutationCatalog),
            isPosInMap: (loc) => coordinatesAreInMap(loc.x, loc.y),
            posEq: (a, b) => a.x === b.x && a.y === b.y,
            monsterAtLoc,
            itemAtLoc: (loc) =>
                floorItems.find(i => i.loc.x === loc.x && i.loc.y === loc.y) ?? null,
            hiliteCell: () => {},
            refreshDungeonCell: () => {},
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            monsterIsHidden: () => false,
            cellHasTerrainFlag,
            playerCanSeeOrSense: () => false,
            cellHasTMFlag,
            refreshSideBar: () => {},
            printLocationDescription: () => {},
            confirmMessages: io.confirmMessages,
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
                    ca.value = true;
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

        return chooseTargetFn(maxDistance, autoTargetMode as AutoTargetMode, theItem, chooseCtx);
    };
}

// =============================================================================
// buildStaffPlayerCancelsBlinkingFn
// =============================================================================

/**
 * Returns a pre-bound playerCancelsBlinking for use in ItemHandlerContext.
 */
export function buildStaffPlayerCancelsBlinkingFn() {
    return async (origin: Pos, target: Pos, maxDistance: number): Promise<boolean> => {
        const { rogue, player, pmap, monsters } = getGameState();
        const monsterAtLoc = buildMonsterAtLocFn(player, monsters);
        const io = buildMessageFns();
        return playerCancelsBlinkingFn(origin, target, maxDistance, {
            rogue,
            player,
            pmap,
            boltCatalog,
            BOLT_BLINKING: BoltType.BLINKING,
            getLocationFlags: (x, y) => ({
                tFlags: pmap[x]?.[y]?.rememberedTerrainFlags ?? 0,
                tmFlags: pmap[x]?.[y]?.rememberedTMFlags ?? 0,
            }),
            cellHasTerrainFlag: (loc, flags) => cellHasTerrainFlagFn(pmap, loc, flags),
            monsterAtLoc,
            staffBlinkDistance: staffBlinkDistanceFn,
            message: (msg, flags) => { void io.message(msg, flags); },
            confirm: buildConfirmFn(),
        });
    };
}

// =============================================================================
// buildStaffZapFn — zap() with a real ZapContext
// =============================================================================

/**
 * Returns a pre-bound zap function for use in ItemHandlerContext.
 * Render context is all no-ops (animation phase).
 * Domain: combat, heal, haste, teleport wired; rare/complex effects stubbed.
 */
export function buildStaffZapFn() {
    return async (
        originLoc: Pos,
        targetLoc: Pos,
        theBolt: Bolt,
        hideDetails: boolean,
        reverseBoltDir: boolean,
    ): Promise<boolean> => {
        const { rogue, player, pmap, monsters, monsterCatalog, monsterItemsHopper, gameConst } = getGameState();
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

        // ── TeleportContext (for blinking staff) ────────────────────────────
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

            // ── State ──
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

            // ── Creature queries ──
            monsterAtLoc,
            canSeeMonster: (m) => m === player ? true : canSeeMonsterFn(m, mqCtx),
            playerCanSee: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            playerCanSeeOrSense: (x, y) => !!(pmap[x]?.[y]?.flags & TileFlag.VISIBLE),
            cellHasTerrainFlag,
            cellHasTMFlag,

            // ── Display helpers ──
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
                        ? b.creatureState !== 2 /* Ally */
                        : b !== player,
                ) as Color,
            tileText: (_x, _y) => "here", // stub — tile flavor text not critical

            // ── Combat ──
            attack: (attacker, defender, defenderInSight) =>
                attackFn(attacker, defender, defenderInSight, attackCtx),
            inflictDamage: (attacker, defender, damage, flashColor, ignoresProtection) =>
                inflictDamageFn(
                    attacker, defender, damage, flashColor as Color | null,
                    ignoresProtection, damageCtx,
                ),
            killCreature: (monst, admin) => killCreatureFn(monst, admin, damageCtx),
            moralAttack: () => {},          // stub
            splitMonster: () => {},         // stub — jelly splitting
            handlePaladinFeat: () => {},    // stub
            gameOver: (msg) => { void gameOverFn(msg); },

            // ── Effects ──
            haste: (monst, turns) => hasteFn(monst, turns, {
                player,
                updateEncumbrance: () => {
                    const s = buildEquipState();
                    updateEncumbranceFn(s);
                },
                message: (msg, flags) => { void io.message(msg, flags); },
            }),
            slow: (monst, _duration) => {
                // stub — slow wand is rare; avoid SlowContext complexity
                void monst;
            },
            imbueInvisibility: (monst, turns) => {
                // stub — invisibility bolt auto-ID not critical for gameplay
                void monst; void turns;
                return false;
            },
            wandDominate: (monst) => wandDominateFn(monst.currentHP, monst.info.maxHP),
            becomeAllyWith: () => {},       // stub — domination ally conversion
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
                applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
                resolvePronounEscapes: buildResolvePronounEscapesFn(player, pmap, rogue),
            }),
            empowerMonster: () => {},       // stub
            addPoison: (monst, tpp, amount) => addPoisonFn(monst, tpp, amount, damageCtx),
            heal: (monst, amount, healsAboveMax) => healFn(monst, amount, healsAboveMax, damageCtx),
            cloneMonster: () => null,       // stub
            flashMonster: () => {},         // stub — visual only
            wakeUp: buildWakeUpFn(player, monsters),
            exposeCreatureToFire: buildExposeCreatureToFireFn(),
            exposeTileToFire: () => false,  // stub — terrain fire
            exposeTileToElectricity: () => false,  // stub
            createFlare: () => {},          // stub — visual only

            // ── Bolt-travel effects ──
            tunnelize: () => false,         // stub — tunneling wand
            freeCaptivesEmbeddedAt: (x, y) => freeCaptivesEmbeddedAtFn(x, y, {
                player,
                pmap,
                demoteMonsterFromLeadership: () => {},  // stub
                makeMonsterDropItem: () => {},           // stub
                refreshDungeonCell: () => {},
                monsterName: (m, inc) => monsterNameFn(m, inc, mqCtx),
                message: (msg, flags) => { void io.message(msg, flags); },
                monsterAtLoc,
                cellHasTerrainFlag,
            }),
            spawnDungeonFeature: () => {},  // stub — forcefield / terrain spawning

            // ── Teleport / blink ──
            teleport: (monst, targetPos, safe) => teleportFn(monst, targetPos, safe, {
                player,
                disentangle: (m) => disentangleFn(m, { player, message: () => {} }),
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
            disentangle: () => {},          // stub
            applyInstantTileEffectsToCreature: buildApplyInstantTileEffectsFn(),
            pickUpItemAt: () => {},         // stub
            checkForMissingKeys: () => {},  // stub
            findAlternativeHomeFor: () => null,  // stub
            autoIdentify: () => {},         // stub — auto-ID from bolt handled in useStaffOrWand

            // ── Beckoning ──
            beckonMonster: () => {},        // stub

            // ── Polymorph ──
            polymorph: () => false,         // stub

            // ── Conjuration ──
            setUpWaypoints: () => {},       // stub — complex dijkstra recompute
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
            getQualifyingPathLocNear: (loc) => loc,  // stub — returns loc
            fadeInMonster: buildFadeInMonsterFn(),

            // ── RNG ──
            randPercent,
            randRange,
        };

        return zapFn(originLoc, targetLoc, theBolt, hideDetails, reverseBoltDir, zapCtx);
    };
}
