/*
 *  items/throw-item.ts — throwItem + hitMonsterWithProjectileWeapon
 *  Port V2 — rogue-ts
 *
 *  Ported from Items.c:
 *    hitMonsterWithProjectileWeapon (5999, ~80 lines)
 *    throwItem (6080, ~197 lines)
 *
 *  throwItem is async because the in-flight animation calls pauseAnimation,
 *  which awaits the event bridge.  All rendering callbacks are stubs until
 *  port-v2-platform wires them in.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Creature, Item, Pos, Color, Pcell, Fixpt, Bolt } from "../types/types.js";
import {
    ItemCategory, PotionKind, WeaponKind,
    CreatureState, CreatureMode, StatusEffect, DungeonFeatureType,
} from "../types/enums.js";
import {
    ItemFlag, MonsterBehaviorFlag, MonsterBookkeepingFlag,
    TileFlag, TerrainFlag, TerrainMechFlag,
} from "../types/flags.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { getLineCoordinates } from "./bolt-geometry.js";

// =============================================================================
// HitMonsterContext — Items.c:5999
// =============================================================================

/**
 * Dependencies for hitMonsterWithProjectileWeapon.
 */
export interface HitMonsterContext {
    player: Creature;

    // ── Attack resolution ──
    /**
     * Determine if the attack hits. When thrower is the player, overrideWeapon
     * temporarily replaces the equipped weapon for accuracy calculation
     * (mirrors the C pattern: equipItem(theItem) → attackHit → re-equip).
     */
    attackHit(attacker: Creature, defender: Creature, overrideWeapon?: Item | null): boolean;
    inflictDamage(
        attacker: Creature,
        defender: Creature,
        damage: number,
        flashColor: Color | null,
        ignoresProtection: boolean,
    ): boolean;
    killCreature(monst: Creature, admin: boolean): void;
    magicWeaponHit(monst: Creature, weapon: Item, wasSneakOrSleep: boolean): void;
    moralAttack(attacker: Creature, defender: Creature): void;
    splitMonster(monst: Creature, attacker: Creature): void;
    handlePaladinFeat(monst: Creature): void;
    /**
     * Apply armor runic for a projectile hit (melee=false).
     * Modifies damage.value in place. Returns effect description (empty if none).
     */
    applyArmorRunicEffect(attacker: Creature, damage: { value: number }): string;

    // ── Naming ──
    itemName(theItem: Item): string;
    monsterName(monst: Creature, includeArticle: boolean): string;
    messageColorFromVictim(monst: Creature): Color | null;

    // ── UI ──
    message(text: string, flags: number): void;
    messageWithColor(text: string, color: Color | null, flags: number): void;

    // ── Combat math ──
    netEnchant(item: Item): Fixpt;
    damageFraction(enchant: Fixpt): Fixpt;
    randClump(damage: { lowerBound: number; upperBound: number; clumpFactor: number }): number;

    red: Color;
}

// =============================================================================
// ThrowItemRenderContext + ThrowItemContext — Items.c:6080
// =============================================================================

/** Rendering callbacks for throwItem — all no-ops until port-v2-platform. */
export interface ThrowItemRenderContext {
    playerCanSee(x: number, y: number): boolean;
    playerCanDirectlySee(x: number, y: number): boolean;
    /**
     * Render theItem's glyph at map position (x, y) during flight.
     * Handles getCellAppearance, foreColor blending, and plotCharWithColor.
     */
    plotItemAt(theItem: Item, x: number, y: number): void;
    /** Pause animation for delay ms. Returns true if fast-forward is now active. */
    pauseAnimation(delay: number, behavior: number): Promise<boolean>;
    refreshDungeonCell(loc: Pos): void;
    playbackFastForward: boolean;
}

export interface ThrowItemContext extends HitMonsterContext {
    render: ThrowItemRenderContext;

    pmap: Pcell[][];
    boltCatalog: readonly Bolt[];

    // ── Creature / map queries ──
    monsterAtLoc(loc: Pos): Creature | null;
    cellHasTerrainFlag(loc: Pos, flags: number): boolean;
    cellHasTMFlag(loc: Pos, flags: number): boolean;

    // ── Item management ──
    deleteItem(item: Item): void;
    placeItemAt(theItem: Item, dest: Pos): void;
    getQualifyingLocNear(target: Pos, forbidTerrain: number, forbidFlags: number): Pos | null;

    // ── Environment effects ──
    spawnDungeonFeature(
        x: number, y: number,
        dfType: DungeonFeatureType,
        refreshCell: boolean,
        abortIfBlocking: boolean,
    ): void;
    promoteTile(x: number, y: number, layer: number, isForced: boolean): void;
    exposeCreatureToFire(monst: Creature): void;
    autoIdentify(theItem: Item): void;

    // ── Terrain data ──
    tileCatalog: readonly { flags: number; mechFlags: number; description: string; flavorText: string }[];
    highestPriorityLayer(x: number, y: number, skipGas: boolean): number;
    layerWithTMFlag(x: number, y: number, flag: number): number;

    // ── Potion flavor text ──
    potionTable: readonly { flavor: string }[];
}

// =============================================================================
// hitMonsterWithProjectileWeapon — Items.c:5999
// =============================================================================

/**
 * Resolve a projectile weapon striking a creature.
 *
 * Checks hit, applies runic effects and damage, sends messages.
 * Returns true if the weapon hit (caller should consume/delete the item);
 * false if the weapon missed (ITEM_PLAYER_AVOIDS cleared so player can pick it up).
 *
 * C: static boolean hitMonsterWithProjectileWeapon(creature *thrower, creature *monst, item *theItem)
 */
export function hitMonsterWithProjectileWeapon(
    thrower: Creature,
    monst: Creature,
    theItem: Item,
    ctx: HitMonsterContext,
): boolean {
    if (!(theItem.category & ItemCategory.WEAPON)) {
        return false;
    }

    // Check paladin feat before creatureState is changed
    if (thrower === ctx.player && !(monst.info.flags & MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS)) {
        ctx.handlePaladinFeat(monst);
    }

    const theItemName = ctx.itemName(theItem);
    const targetName = ctx.monsterName(monst, true);

    monst.status[StatusEffect.Entranced] = 0;

    if (
        monst !== ctx.player &&
        monst.creatureMode !== CreatureMode.PermFleeing &&
        (monst.creatureState !== CreatureState.Fleeing || monst.status[StatusEffect.MagicalFear]) &&
        !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_CAPTIVE) &&
        monst.creatureState !== CreatureState.Ally
    ) {
        monst.creatureState = CreatureState.TrackingScent;
        if (monst.status[StatusEffect.MagicalFear]) {
            monst.status[StatusEffect.MagicalFear] = 1;
        }
    }

    // Temporarily use theItem as the weapon for hit calculation when the player throws
    // (mirrors C: equipItem(theItem) → attackHit → re-equip original)
    const thrownWeaponHit = ctx.attackHit(
        thrower, monst,
        thrower === ctx.player ? theItem : null,
    );

    if (thrownWeaponHit) {
        const isImmune = !!(monst.info.flags &
            (MonsterBehaviorFlag.MONST_IMMUNE_TO_WEAPONS | MonsterBehaviorFlag.MONST_INVULNERABLE));
        let damage = isImmune ? 0 :
            Number(BigInt(ctx.randClump(theItem.damage)) *
                ctx.damageFraction(ctx.netEnchant(theItem)) / FP_FACTOR);

        let armorRunicString = "";
        if (monst === ctx.player) {
            const damageRef = { value: damage };
            armorRunicString = ctx.applyArmorRunicEffect(thrower, damageRef);
            damage = damageRef.value;
        }

        if (ctx.inflictDamage(thrower, monst, damage, ctx.red, false)) {
            // Monster killed
            const verb = (monst.info.flags & MonsterBehaviorFlag.MONST_INANIMATE)
                ? "destroyed" : "killed";
            ctx.messageWithColor(
                `the ${theItemName} ${verb} ${targetName}.`,
                ctx.messageColorFromVictim(monst),
                0,
            );
            ctx.killCreature(monst, false);
        } else {
            ctx.messageWithColor(
                `the ${theItemName} hit ${targetName}.`,
                ctx.messageColorFromVictim(monst),
                0,
            );
            if (theItem.flags & ItemFlag.ITEM_RUNIC) {
                ctx.magicWeaponHit(monst, theItem, false);
            }
        }

        ctx.moralAttack(thrower, monst);
        ctx.splitMonster(monst, thrower);
        if (armorRunicString) {
            ctx.message(armorRunicString, 0);
        }
        return true;
    } else {
        theItem.flags &= ~ItemFlag.ITEM_PLAYER_AVOIDS;
        ctx.message(`the ${theItemName} missed ${targetName}.`, 0);
        return false;
    }
}

// =============================================================================
// Helpers
// =============================================================================

/** Gas-effect potion kinds that shatter with a cloud on impact. */
const GAS_POTION_KINDS: ReadonlySet<PotionKind> = new Set([
    PotionKind.Confusion, PotionKind.Poison, PotionKind.Paralysis,
    PotionKind.Incineration, PotionKind.Darkness, PotionKind.Lichen,
    PotionKind.Descent,
]);

// =============================================================================
// throwItem — Items.c:6080
// =============================================================================

/**
 * Throw theItem from thrower toward targetLoc, up to maxDistance cells.
 *
 * Animates the item in flight, handles weapon hits, potion shattering,
 * incendiary dart explosions, and final item placement.
 *
 * Async because in-flight animation calls ctx.render.pauseAnimation.
 *
 * C: static void throwItem(item *theItem, creature *thrower, pos targetLoc, short maxDistance)
 */
export async function throwItem(
    theItem: Item,
    thrower: Creature,
    targetLoc: Pos,
    maxDistance: number,
    ctx: ThrowItemContext,
): Promise<void> {
    // Avoid thrown items unless a weapon misses (flag cleared in hitMonsterWithProjectileWeapon)
    theItem.flags |= ItemFlag.ITEM_PLAYER_AVOIDS;

    const originLoc = { ...thrower.loc };
    // BOLT_NONE (index 0): all flags off → tries to avoid all obstacles in front of the target
    const path = getLineCoordinates(originLoc, targetLoc, ctx.boltCatalog[0]);

    thrower.ticksUntilTurn = thrower.attackSpeed;

    // Announce throw if a monster hurls something the player can see
    if (
        thrower !== ctx.player &&
        (ctx.pmap[originLoc.x]?.[originLoc.y]?.flags & TileFlag.IN_FIELD_OF_VIEW)
    ) {
        ctx.message(`${ctx.monsterName(thrower, true)} hurls ${ctx.itemName(theItem)}.`, 0);
    }

    let hitSomethingSolid = false;
    let fastForward = false;
    let x = originLoc.x;
    let y = originLoc.y;

    for (let i = 0; i < path.length && i < maxDistance; i++) {
        x = path[i].x;
        y = path[i].y;

        // Creature in cell — attempt weapon hit
        if (ctx.pmap[x]?.[y]?.flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
            const monst = ctx.monsterAtLoc({ x, y });
            if (monst && !(monst.bookkeepingFlags & MonsterBookkeepingFlag.MB_SUBMERGED)) {
                if (
                    (theItem.category & ItemCategory.WEAPON) &&
                    theItem.kind !== WeaponKind.IncendiaryDart &&
                    hitMonsterWithProjectileWeapon(thrower, monst, theItem, ctx)
                ) {
                    ctx.deleteItem(theItem);
                    return;
                }
                break;
            }
        }

        // Solid terrain
        if (ctx.cellHasTerrainFlag(
            { x, y },
            TerrainFlag.T_OBSTRUCTS_PASSABILITY | TerrainFlag.T_OBSTRUCTS_VISION,
        )) {
            if (
                (theItem.category & ItemCategory.WEAPON) &&
                theItem.kind === WeaponKind.IncendiaryDart &&
                (ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_IS_FLAMMABLE) ||
                 !!(ctx.pmap[x]?.[y]?.flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)))
            ) {
                // Incendiary dart hitting flammable obstruction — fall through to explosion below
            } else if (
                ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY) &&
                ctx.cellHasTMFlag({ x, y }, TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY)
            ) {
                // Door-like: item strikes door, door promotes (opens)
                const layer = ctx.layerWithTMFlag(x, y, TerrainMechFlag.TM_PROMOTES_ON_PLAYER_ENTRY);
                if (layer >= 0 &&
                    (ctx.tileCatalog[ctx.pmap[x][y].layers[layer]]?.flags &
                     TerrainFlag.T_OBSTRUCTS_PASSABILITY)
                ) {
                    ctx.message(ctx.tileCatalog[ctx.pmap[x][y].layers[layer]].flavorText, 0);
                    ctx.promoteTile(x, y, layer, false);
                }
            } else {
                // Step back one cell — item stops before the wall
                i--;
                if (i >= 0) {
                    x = path[i].x;
                    y = path[i].y;
                } else {
                    x = thrower.loc.x;
                    y = thrower.loc.y;
                }
            }
            hitSomethingSolid = true;
            break;
        }

        // In-flight animation
        if (ctx.render.playerCanSee(x, y)) {
            ctx.render.plotItemAt(theItem, x, y);
            if (!fastForward) {
                fastForward = ctx.render.playbackFastForward ||
                    await ctx.render.pauseAnimation(25, 0);
            }
            ctx.render.refreshDungeonCell({ x, y });
        }

        if (x === targetLoc.x && y === targetLoc.y) {
            break;
        }
    }

    // ── Potion shattering ────────────────────────────────────────────────────
    if (
        (theItem.category & ItemCategory.POTION) &&
        (hitSomethingSolid || !ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_AUTO_DESCENT))
    ) {
        const kind = theItem.kind as PotionKind;

        if (GAS_POTION_KINDS.has(kind)) {
            // Gas-effect potion: spawn cloud, then message (or message then spawn for some)
            switch (kind) {
                case PotionKind.Poison:
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_POISON_GAS_CLOUD_POTION, true, false);
                    ctx.message("the flask shatters and a deadly purple cloud billows out!", 0);
                    break;
                case PotionKind.Confusion:
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_CONFUSION_GAS_CLOUD_POTION, true, false);
                    ctx.message("the flask shatters and a multi-hued cloud billows out!", 0);
                    break;
                case PotionKind.Paralysis:
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_PARALYSIS_GAS_CLOUD_POTION, true, false);
                    ctx.message("the flask shatters and a cloud of pink gas billows out!", 0);
                    break;
                case PotionKind.Incineration:
                    ctx.message("the flask shatters and its contents burst violently into flame!", 0);
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_INCINERATION_POTION, true, false);
                    break;
                case PotionKind.Darkness:
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_DARKNESS_POTION, true, false);
                    ctx.message("the flask shatters and the lights in the area start fading.", 0);
                    break;
                case PotionKind.Descent:
                    ctx.message("as the flask shatters, the ground vanishes!", 0);
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_HOLE_POTION, true, false);
                    break;
                case PotionKind.Lichen:
                    ctx.message("the flask shatters and deadly spores spill out!", 0);
                    ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_LICHEN_PLANTED, true, false);
                    break;
            }
            ctx.autoIdentify(theItem);
            ctx.render.refreshDungeonCell({ x, y });
        } else {
            // Harmless splash: just a message; only POTION_HALLUCINATION gets auto-ID
            let prep: string;
            if (ctx.cellHasTerrainFlag({ x, y }, TerrainFlag.T_OBSTRUCTS_PASSABILITY)) {
                prep = "against";
            } else {
                const topLayer = ctx.highestPriorityLayer(x, y, false);
                prep = (ctx.tileCatalog[ctx.pmap[x][y].layers[topLayer]]?.mechFlags &
                        TerrainMechFlag.TM_STAND_IN_TILE) ? "into" : "on";
            }
            const tileLayer = ctx.highestPriorityLayer(x, y, false);
            const tileDesc = ctx.tileCatalog[ctx.pmap[x][y].layers[tileLayer]]?.description ?? "the floor";
            const flavor = ctx.potionTable[theItem.kind]?.flavor ?? "colored";
            ctx.message(
                `the flask shatters and ${flavor} liquid splashes harmlessly ${prep} ${tileDesc}.`,
                0,
            );
            // C: hallucination auto-IDs only if magic-detected or all good potions known;
            // stub defers that condition to autoIdentify's internal logic
            if (kind === PotionKind.Hallucination) {
                ctx.autoIdentify(theItem);
            }
        }

        ctx.deleteItem(theItem);
        return;
    }

    // ── Incendiary dart explosion ────────────────────────────────────────────
    if ((theItem.category & ItemCategory.WEAPON) && theItem.kind === WeaponKind.IncendiaryDart) {
        ctx.spawnDungeonFeature(x, y, DungeonFeatureType.DF_DART_EXPLOSION, true, false);
        if (ctx.pmap[x]?.[y]?.flags & (TileFlag.HAS_MONSTER | TileFlag.HAS_PLAYER)) {
            const target = ctx.monsterAtLoc({ x, y });
            if (target) ctx.exposeCreatureToFire(target);
        }
        ctx.deleteItem(theItem);
        return;
    }

    // ── Item lands on floor ──────────────────────────────────────────────────
    const dropLoc = ctx.getQualifyingLocNear(
        { x, y },
        TerrainFlag.T_OBSTRUCTS_ITEMS | TerrainFlag.T_OBSTRUCTS_PASSABILITY,
        TileFlag.HAS_ITEM,
    );
    if (dropLoc) {
        ctx.placeItemAt(theItem, dropLoc);
        ctx.render.refreshDungeonCell(dropLoc);
    }
}
