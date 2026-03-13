/*
 *  items/bolt-update.ts — Per-cell bolt effects (updateBolt)
 *  brogue-ts
 *
 *  Ported from Items.c: updateBolt (4362–4713).
 *
 *  updateBolt is called once per cell as a bolt travels through the dungeon.
 *  It handles all creature interactions (hits, effects, messages) and terrain
 *  effects (fire, electricity, pathDF spawn). Returns true if the bolt should stop.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Bolt, Creature } from "../types/types.js";
import type { ZapContext } from "./zap-context.js";
import { BoltEffect, BoltType, StatusEffect, LightType, CreatureState } from "../types/enums.js";
import { BoltFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag } from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import {
    staffDamage,
    staffHasteDuration,
    staffPoison,
    staffEntrancementDuration,
    staffProtection,
    staffDiscordDuration,
} from "../power/power-tables.js";

// =============================================================================
// updateBolt — from Items.c:4362
// =============================================================================

/**
 * Process one bolt-travel cell at (x, y).
 *
 * Handles creature interactions (damage, effects, messages) and terrain effects.
 * Returns true if the bolt should stop traveling.
 *
 * C: static boolean updateBolt(bolt *theBolt, creature *caster, short x, short y,
 *                               boolean boltInView, boolean alreadyReflected,
 *                               boolean *autoID, boolean *lightingChanged)
 *    — Items.c:4362
 *
 * @param theBolt          The bolt traveling through the dungeon.
 * @param caster           The creature that fired the bolt (may be null for environmental).
 * @param x                Current cell X.
 * @param y                Current cell Y.
 * @param boltInView       Whether the bolt position is visible to the player.
 * @param alreadyReflected Whether the bolt has already bounced at least once.
 * @param autoID           Accumulator: set to true if the effect was visible enough to ID.
 * @param lightingChanged  Accumulator: set to true if terrain lighting was altered.
 * @param ctx              Domain context.
 * @returns                True to stop the bolt at this cell.
 */
export function updateBolt(
    theBolt: Bolt,
    caster: Creature | null,
    x: number,
    y: number,
    boltInView: boolean,
    alreadyReflected: boolean,
    autoID: { value: boolean },
    lightingChanged: { value: boolean },
    ctx: ZapContext,
): boolean {
    lightingChanged.value = false;

    let terminateBolt = false;
    let negated = false;

    const monst = ctx.monsterAtLoc({ x, y });
    if (monst && !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) {
        const monstName = ctx.monsterName(monst, true);

        switch (theBolt.boltEffect) {
            case BoltEffect.Attack:
                if (
                    !ctx.cellHasTerrainFlag({ x, y }, 0x1 /* T_OBSTRUCTS_PASSABILITY */) ||
                    (monst.info.flags & MonsterBehaviorFlag.MONST_ATTACKABLE_THRU_WALLS)
                ) {
                    if (caster) ctx.attack(caster, monst, false);
                    autoID.value = true;
                }
                break;

            case BoltEffect.Damage: {
                autoID.value = true;
                // Check paladin feat before creatureState changes.
                if (monst && caster === ctx.player) {
                    if (
                        ((theBolt.flags & BoltFlag.BF_FIERY) &&
                            monst.status[StatusEffect.ImmuneToFire] <= 0) ||
                        (theBolt.flags & BoltFlag.BF_ELECTRIC)
                    ) {
                        ctx.handlePaladinFeat(monst);
                    }
                }
                if (
                    ((theBolt.flags & BoltFlag.BF_FIERY) &&
                        monst.status[StatusEffect.ImmuneToFire] > 0) ||
                    (monst.info.flags & MonsterBehaviorFlag.MONST_INVULNERABLE)
                ) {
                    if (ctx.canSeeMonster(monst)) {
                        const casterSeen = caster ? ctx.canSeeMonster(caster) : false;
                        ctx.combatMessage(
                            `${monstName} ignore${monst === ctx.player ? "" : "s"} ` +
                            `${casterSeen ? "the" : "a"} ${theBolt.name}`,
                            null,
                        );
                    }
                } else if (
                    ctx.inflictDamage(
                        caster, monst,
                        staffDamage(BigInt(theBolt.magnitude) * FP_FACTOR),
                        theBolt.backColor ?? null,
                        false,
                    )
                ) {
                    // Monster killed.
                    if (ctx.player.currentHP <= 0) {
                        ctx.killCreature(monst, false);
                        if (caster === ctx.player) {
                            ctx.gameOver(`Killed by a reflected ${theBolt.name}`, true);
                        }
                        return true;
                    }
                    if (boltInView || ctx.canSeeMonster(monst)) {
                        const casterSeen = caster ? ctx.canSeeMonster(caster) : false;
                        const verb = (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)
                            ? "destroys" : "kills";
                        ctx.combatMessage(
                            `${casterSeen ? "the" : "a"} ${theBolt.name} ${verb} ${monstName}`,
                            ctx.messageColorFromVictim(monst),
                        );
                    } else {
                        const verb = (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)
                            ? "get destroyed" : "die";
                        ctx.combatMessage(`you hear ${monstName} ${verb}`, null);
                    }
                    ctx.killCreature(monst, false);
                } else {
                    // Monster lives.
                    if (
                        monst.creatureState !== CreatureState.Ally &&
                        monst.creatureState !== CreatureState.Fleeing &&
                        monst.status[StatusEffect.MagicalFear] === 0
                    ) {
                        monst.creatureState = CreatureState.TrackingScent;
                        monst.status[StatusEffect.MagicalFear] = 0;
                    }
                    if (boltInView) {
                        const casterSeen = caster ? ctx.canSeeMonster(caster) : false;
                        ctx.combatMessage(
                            `${casterSeen ? "the" : "a"} ${theBolt.name} hits ${monstName}`,
                            ctx.messageColorFromVictim(monst),
                        );
                    }
                    if (theBolt.flags & BoltFlag.BF_FIERY) {
                        ctx.exposeCreatureToFire(monst);
                    }
                    if (!alreadyReflected || caster !== ctx.player) {
                        if (caster) ctx.moralAttack(caster, monst);
                        if (caster) ctx.splitMonster(monst, caster);
                    }
                }
                if (theBolt.flags & BoltFlag.BF_FIERY) {
                    ctx.exposeTileToFire(x, y, true);
                }
                break;
            }

            case BoltEffect.Teleport:
                if (!(monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE)) {
                    if (monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) {
                        // freeCaptive is wired via ally-management; inject if needed
                    }
                    ctx.teleport(monst, { x: -1, y: -1 }, false); // INVALID_POS
                }
                break;

            case BoltEffect.Beckoning:
                if (
                    !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMOBILE) &&
                    caster &&
                    Math.abs(caster.loc.x - monst.loc.x) + Math.abs(caster.loc.y - monst.loc.y) > 1
                ) {
                    if (ctx.canSeeMonster(monst)) autoID.value = true;
                    ctx.beckonMonster(monst, caster.loc.x, caster.loc.y);
                    if (ctx.canSeeMonster(monst)) autoID.value = true;
                }
                break;

            case BoltEffect.Slow:
                ctx.slow(monst, theBolt.magnitude * 5);
                if (ctx.boltCatalog[BoltType.SLOW]?.backColor) {
                    ctx.flashMonster(monst, ctx.boltCatalog[BoltType.SLOW].backColor!, 100);
                }
                autoID.value = true;
                break;

            case BoltEffect.Haste:
                ctx.haste(monst, staffHasteDuration(BigInt(theBolt.magnitude) * FP_FACTOR));
                if (ctx.boltCatalog[BoltType.HASTE]?.backColor) {
                    ctx.flashMonster(monst, ctx.boltCatalog[BoltType.HASTE].backColor!, 100);
                }
                autoID.value = true;
                break;

            case BoltEffect.Polymorph:
                if (ctx.polymorph(monst)) {
                    if (!monst.status[StatusEffect.Invisible]) {
                        autoID.value = true;
                    }
                }
                break;

            case BoltEffect.Invisibility:
                if (ctx.imbueInvisibility(monst, theBolt.magnitude * 15)) {
                    autoID.value = true;
                }
                break;

            case BoltEffect.Domination:
                if (
                    monst !== ctx.player &&
                    !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                ) {
                    if (ctx.randPercent(ctx.wandDominate(monst))) {
                        monst.status[StatusEffect.Discordant] = 0;
                        ctx.becomeAllyWith(monst);
                        ctx.render.refreshDungeonCell(monst.loc);
                        if (ctx.canSeeMonster(monst)) {
                            autoID.value = true;
                            ctx.message(`${monstName} is bound to your will!`, 0);
                            if (ctx.boltCatalog[BoltType.DOMINATION]?.backColor) {
                                ctx.flashMonster(monst, ctx.boltCatalog[BoltType.DOMINATION].backColor!, 100);
                            }
                        }
                    } else if (ctx.canSeeMonster(monst)) {
                        autoID.value = true;
                        ctx.message(`${monstName} resists the bolt of domination.`, 0);
                    }
                }
                break;

            case BoltEffect.Negation:
                negated = ctx.negate(monst);
                if (ctx.boltCatalog[BoltType.NEGATION]?.backColor) {
                    ctx.flashMonster(monst, ctx.boltCatalog[BoltType.NEGATION].backColor!, 100);
                }
                if (negated && ctx.canSeeMonster(monst)) {
                    autoID.value = true;
                }
                break;

            case BoltEffect.Empowerment:
                if (
                    monst !== ctx.player &&
                    !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                ) {
                    ctx.empowerMonster(monst);
                    ctx.createFlare(monst.loc.x, monst.loc.y, LightType.EMPOWERMENT_LIGHT);
                    if (ctx.canSeeMonster(monst)) autoID.value = true;
                }
                break;

            case BoltEffect.Poison:
                if (
                    !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                ) {
                    ctx.addPoison(
                        monst,
                        staffPoison(BigInt(theBolt.magnitude) * FP_FACTOR),
                        1,
                    );
                    if (ctx.canSeeMonster(monst)) {
                        if (ctx.boltCatalog[BoltType.POISON]?.backColor) {
                            ctx.flashMonster(monst, ctx.boltCatalog[BoltType.POISON].backColor!, 100);
                        }
                        autoID.value = true;
                        if (monst !== ctx.player) {
                            const fatalOrVery =
                                monst.status[StatusEffect.Poisoned] * (monst as any).poisonAmount >=
                                monst.currentHP && !ctx.player.status[StatusEffect.Hallucinating]
                                    ? "fatally" : "very";
                            ctx.combatMessage(
                                `${monstName} ${monst === ctx.player ? "feel" : "looks"} ${fatalOrVery} sick`,
                                ctx.messageColorFromVictim(monst),
                            );
                        }
                    }
                }
                break;

            case BoltEffect.Entrancement:
                if (monst === ctx.player) {
                    ctx.flashMonster(monst, null, 100); // confusionGasColor
                    monst.status[StatusEffect.Confused] =
                        staffEntrancementDuration(BigInt(theBolt.magnitude) * FP_FACTOR);
                    monst.maxStatus[StatusEffect.Confused] = Math.max(
                        monst.status[StatusEffect.Confused],
                        monst.maxStatus[StatusEffect.Confused],
                    );
                    ctx.message("the bolt hits you and you suddenly feel disoriented.", 1 /* REQUIRE_ACKNOWLEDGMENT */);
                    autoID.value = true;
                } else if (
                    !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                ) {
                    const dur = staffEntrancementDuration(BigInt(theBolt.magnitude) * FP_FACTOR);
                    monst.status[StatusEffect.Entranced] = monst.maxStatus[StatusEffect.Entranced] =
                        Math.max(dur, monst.maxStatus[StatusEffect.Entranced]);
                    ctx.wakeUp(monst);
                    if (ctx.canSeeMonster(monst)) {
                        if (ctx.boltCatalog[BoltType.ENTRANCEMENT]?.backColor) {
                            ctx.flashMonster(monst, ctx.boltCatalog[BoltType.ENTRANCEMENT].backColor!, 100);
                        }
                        autoID.value = true;
                        ctx.message(`${monstName} is entranced!`, 0);
                    }
                }
                break;

            case BoltEffect.Healing:
                ctx.heal(monst, theBolt.magnitude * 10, false);
                if (ctx.canSeeMonster(monst)) autoID.value = true;
                break;

            case BoltEffect.Plenty:
                if (
                    !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                ) {
                    const newMonst = ctx.cloneMonster(monst, true, true);
                    if (newMonst) {
                        monst.currentHP = Math.floor((monst.currentHP + 1) / 2);
                        newMonst.currentHP = Math.floor((newMonst.currentHP + 1) / 2);
                        if (ctx.boltCatalog[BoltType.PLENTY]?.backColor) {
                            ctx.flashMonster(monst, ctx.boltCatalog[BoltType.PLENTY].backColor!, 100);
                            ctx.flashMonster(newMonst, ctx.boltCatalog[BoltType.PLENTY].backColor!, 100);
                        }
                        autoID.value = true;
                    }
                }
                break;

            case BoltEffect.Discord:
                if (
                    !(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
                ) {
                    const dur = staffDiscordDuration(BigInt(theBolt.magnitude) * FP_FACTOR);
                    monst.status[StatusEffect.Discordant] = monst.maxStatus[StatusEffect.Discordant] =
                        Math.max(dur, monst.status[StatusEffect.Discordant]);
                    if (ctx.canSeeMonster(monst)) {
                        if (ctx.boltCatalog[BoltType.DISCORD]?.backColor) {
                            ctx.flashMonster(monst, ctx.boltCatalog[BoltType.DISCORD].backColor!, 100);
                        }
                        autoID.value = true;
                    }
                }
                break;

            case BoltEffect.Shielding: {
                const protection = staffProtection(BigInt(theBolt.magnitude) * FP_FACTOR);
                if (protection > monst.status[StatusEffect.Shielded]) {
                    monst.status[StatusEffect.Shielded] = protection;
                }
                monst.maxStatus[StatusEffect.Shielded] = monst.status[StatusEffect.Shielded];
                if (ctx.boltCatalog[BoltType.SHIELDING]?.backColor) {
                    ctx.flashMonster(monst, ctx.boltCatalog[BoltType.SHIELDING].backColor!, 100);
                }
                autoID.value = true;
                break;
            }

            default:
                break;
        }

        if (!(theBolt.flags & BoltFlag.BF_PASSES_THRU_CREATURES)) {
            terminateBolt = true;
        }
    }

    // Per-cell effects not tied to a creature.
    switch (theBolt.boltEffect) {
        case BoltEffect.Blinking:
            if (caster === ctx.player) {
                ctx.player.loc.x = x;
                ctx.player.loc.y = y;
                lightingChanged.value = true;
            }
            break;
        default:
            break;
    }

    if (theBolt.pathDF) {
        ctx.spawnDungeonFeature(x, y, theBolt.pathDF, true, false);
    }

    if (
        (theBolt.flags & BoltFlag.BF_FIERY) &&
        ctx.exposeTileToFire(x, y, true)
    ) {
        lightingChanged.value = true;
        autoID.value = true;
    }

    if (
        (theBolt.flags & BoltFlag.BF_ELECTRIC) &&
        ctx.exposeTileToElectricity(x, y)
    ) {
        lightingChanged.value = true;
        autoID.value = true;
    }

    return terminateBolt;
}
