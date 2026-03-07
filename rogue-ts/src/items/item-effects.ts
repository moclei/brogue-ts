/*
 *  items/item-effects.ts — item effect functions
 *  Port V2 — rogue-ts
 *
 *  Ported from Items.c:
 *    negationBlast (4073), haste (3919), makePlayerTelepathic (3976),
 *    imbueInvisibility (4187), discordBlast (4129), rechargeItems (3989),
 *    updateIdentifiableItem (6908), updatePlayerRegenerationDelay (7903)
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, Creature, Pcell, Pos, Color, Bolt, ItemTable } from "../types/types.js";
import { ItemFlag, TileFlag, MonsterBehaviorFlag } from "../types/flags.js";
import {
    ItemCategory, StatusEffect, BoltType, StaffKind, CreatureState,
    NEVER_IDENTIFIABLE,
} from "../types/enums.js";
import { pink, discordColor } from "../globals/colors.js";
import { FP_FACTOR } from "../math/fixpt.js";
import { turnsForFullRegenInThousandths } from "../power/power-tables.js";
import { getTableForCategory } from "./item-generation.js";

// =============================================================================
// Context
// =============================================================================

export interface NegationBlastContext {
    player: Creature;
    monsters: Creature[];
    floorItems: Item[];
    pmap: Pcell[][];
    itemMessageColor: Color;

    /** Strips a creature of magical traits/abilities. Returns true if any effect. */
    negate(monst: Creature): boolean;
    colorFlash(
        color: Color,
        tableRow: number,
        flags: number,
        duration: number,
        maxRadius: number,
        x: number,
        y: number,
    ): void;
    flashMonster(monst: Creature, color: Color, strength: number): void;
    canSeeMonster(monst: Creature): boolean;
    messageWithColor(msg: string, color: Color, flags: number): void;
    identify(item: Item): void;
    refreshDungeonCell(loc: Pos): void;
    updateIdentifiableItems(): void;
    charmRechargeDelay(kind: number, enchant: number): number;

    IN_FIELD_OF_VIEW: number;
}

// =============================================================================
// negationBlast — Items.c:4073
// =============================================================================

/**
 * Emits anti-magic from the player's position in a radius of `distance` cells.
 * All creatures and floor items in field-of-view within range are negated.
 *
 * Ported from Items.c:4073 — negationBlast() (static).
 */
export function negationBlast(
    emitterName: string,
    distance: number,
    ctx: NegationBlastContext,
): void {
    const { player, monsters, floorItems, pmap } = ctx;
    const px = player.loc.x;
    const py = player.loc.y;
    const dist2 = distance * distance;

    ctx.messageWithColor(
        `${emitterName} emits a numbing torrent of anti-magic!`,
        ctx.itemMessageColor,
        0,
    );
    ctx.colorFlash(pink, 0, ctx.IN_FIELD_OF_VIEW, 3 + Math.floor(distance / 5), distance, px, py);
    ctx.negate(player);
    ctx.flashMonster(player, pink, 100);

    // Snapshot to avoid mutation during iteration (negate can kill monsters)
    for (const monst of [...monsters]) {
        const mx = monst.loc.x;
        const my = monst.loc.y;
        if (
            (pmap[mx]?.[my]?.flags & ctx.IN_FIELD_OF_VIEW) &&
            (px - mx) * (px - mx) + (py - my) * (py - my) <= dist2
        ) {
            if (ctx.canSeeMonster(monst)) {
                ctx.flashMonster(monst, pink, 100);
            }
            ctx.negate(monst);
        }
    }

    for (const theItem of [...floorItems]) {
        const ix = theItem.loc.x;
        const iy = theItem.loc.y;
        if (
            !(pmap[ix]?.[iy]?.flags & ctx.IN_FIELD_OF_VIEW) ||
            (px - ix) * (px - ix) + (py - iy) * (py - iy) > dist2
        ) {
            continue;
        }

        theItem.flags &= ~(ItemFlag.ITEM_MAGIC_DETECTED | ItemFlag.ITEM_CURSED);

        switch (theItem.category) {
            case ItemCategory.WEAPON:
            case ItemCategory.ARMOR:
                theItem.enchant1 = 0;
                theItem.enchant2 = 0;
                theItem.charges = 0;
                theItem.flags &= ~(
                    ItemFlag.ITEM_RUNIC |
                    ItemFlag.ITEM_RUNIC_HINTED |
                    ItemFlag.ITEM_RUNIC_IDENTIFIED |
                    ItemFlag.ITEM_PROTECTED
                );
                ctx.identify(theItem);
                pmap[ix][iy].flags &= ~TileFlag.ITEM_DETECTED;
                ctx.refreshDungeonCell(theItem.loc);
                break;
            case ItemCategory.STAFF:
                theItem.charges = 0;
                break;
            case ItemCategory.WAND:
                theItem.charges = 0;
                theItem.flags |= ItemFlag.ITEM_MAX_CHARGES_KNOWN;
                break;
            case ItemCategory.RING:
                theItem.enchant1 = 0;
                theItem.flags |= ItemFlag.ITEM_IDENTIFIED;
                ctx.updateIdentifiableItems();
                break;
            case ItemCategory.CHARM:
                theItem.charges = ctx.charmRechargeDelay(theItem.kind, theItem.enchant1);
                break;
        }
    }
}

// =============================================================================
// haste — Items.c:3919
// =============================================================================

export interface HasteContext {
    player: Creature;
    updateEncumbrance(): void;
    message(msg: string, flags: number): void;
}

/**
 * Apply haste status to a creature for the given number of turns.
 * Clears slow, halves movement/attack speed for non-player creatures,
 * and calls updateEncumbrance + shows a message for the player.
 *
 * Ported from Items.c:3919 — haste().
 */
export function haste(monst: Creature, turns: number, ctx: HasteContext): void {
    if (
        !monst ||
        (monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))
    ) {
        return;
    }
    monst.status[StatusEffect.Slowed] = 0;
    monst.status[StatusEffect.Hasted] = monst.maxStatus[StatusEffect.Hasted] = turns;
    if (monst === ctx.player) {
        ctx.updateEncumbrance();
        ctx.message("you feel yourself speed up.", 0);
    } else {
        monst.movementSpeed = Math.trunc(monst.info.movementSpeed / 2);
        monst.attackSpeed = Math.trunc(monst.info.attackSpeed / 2);
    }
}

// =============================================================================
// makePlayerTelepathic — Items.c:3976
// =============================================================================

export interface MakePlayerTelepathicContext {
    player: Creature;
    monsters: Creature[];
    refreshDungeonCell(loc: Pos): void;
    message(msg: string, flags: number): void;
}

/**
 * Grant temporary telepathy to the player.
 * Refreshes all monster cells so they appear through walls while active.
 *
 * Ported from Items.c:3976 — makePlayerTelepathic() (static).
 */
export function makePlayerTelepathic(duration: number, ctx: MakePlayerTelepathicContext): void {
    ctx.player.status[StatusEffect.Telepathic] = ctx.player.maxStatus[StatusEffect.Telepathic] = duration;
    for (const monst of ctx.monsters) {
        ctx.refreshDungeonCell(monst.loc);
    }
    if (ctx.monsters.length === 0) {
        ctx.message("you can somehow tell that you are alone on this depth at the moment.", 0);
    } else {
        ctx.message("you can somehow feel the presence of other creatures' minds!", 0);
    }
}

// =============================================================================
// imbueInvisibility — Items.c:4187
// =============================================================================

export interface ImbueInvisibilityContext {
    player: Creature;
    boltCatalog: readonly Bolt[];
    canSeeMonster(monst: Creature): boolean;
    monsterRevealed(monst: Creature): boolean;
    refreshDungeonCell(loc: Pos): void;
    refreshSideBar(): void;
    flashMonster(monst: Creature, color: Color, strength: number): void;
}

/**
 * Apply invisibility status to a creature.
 * Returns true if the action should auto-identify the item (player/ally/visible).
 * Note: C checks boltCatalog[BOLT_POLYMORPH].backColor as a guard before
 * flashing with boltCatalog[BOLT_INVISIBILITY].backColor — replicated faithfully.
 *
 * Ported from Items.c:4187 — imbueInvisibility() (static).
 */
export function imbueInvisibility(
    monst: Creature,
    duration: number,
    ctx: ImbueInvisibilityContext,
): boolean {
    let autoID = false;
    if (
        monst &&
        !(monst.info.flags & (
            MonsterBehaviorFlag.MONST_INANIMATE |
            MonsterBehaviorFlag.MONST_INVISIBLE |
            MonsterBehaviorFlag.MONST_INVULNERABLE
        ))
    ) {
        if (monst === ctx.player || monst.creatureState === CreatureState.Ally) {
            autoID = true;
        } else if (ctx.canSeeMonster(monst) && ctx.monsterRevealed(monst)) {
            autoID = true;
        }
        monst.status[StatusEffect.Invisible] = monst.maxStatus[StatusEffect.Invisible] = duration;
        ctx.refreshDungeonCell(monst.loc);
        ctx.refreshSideBar();
        if (ctx.boltCatalog[BoltType.POLYMORPH]?.backColor) {
            const invisColor = ctx.boltCatalog[BoltType.INVISIBILITY]?.backColor;
            if (invisColor) {
                ctx.flashMonster(monst, invisColor, 100);
            }
        }
    }
    return autoID;
}

// =============================================================================
// discordBlast — Items.c:4129
// =============================================================================

export interface DiscordBlastContext {
    player: Creature;
    monsters: Creature[];
    pmap: Pcell[][];
    itemMessageColor: Color;
    messageWithColor(msg: string, color: Color, flags: number): void;
    colorFlash(
        color: Color,
        tableRow: number,
        flags: number,
        duration: number,
        maxRadius: number,
        x: number,
        y: number,
    ): void;
    flashMonster(monst: Creature, color: Color, strength: number): void;
    canSeeMonster(monst: Creature): boolean;
    IN_FIELD_OF_VIEW: number;
}

/**
 * Emit a discord wave from the player's position, applying STATUS_DISCORDANT
 * to all non-inanimate/invulnerable monsters in FOV within range.
 *
 * Ported from Items.c:4129 — discordBlast() (static).
 */
export function discordBlast(
    emitterName: string,
    distance: number,
    ctx: DiscordBlastContext,
): void {
    const { player, monsters, pmap } = ctx;
    const px = player.loc.x;
    const py = player.loc.y;
    const dist2 = distance * distance;

    ctx.messageWithColor(
        `${emitterName} emits a wave of unsettling purple radiation!`,
        ctx.itemMessageColor,
        0,
    );
    ctx.colorFlash(discordColor, 0, ctx.IN_FIELD_OF_VIEW, 3 + Math.floor(distance / 5), distance, px, py);

    for (const monst of [...monsters]) {
        const mx = monst.loc.x;
        const my = monst.loc.y;
        if (
            (pmap[mx]?.[my]?.flags & ctx.IN_FIELD_OF_VIEW) &&
            (px - mx) * (px - mx) + (py - my) * (py - my) <= dist2
        ) {
            if (!(monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE))) {
                if (ctx.canSeeMonster(monst)) {
                    ctx.flashMonster(monst, discordColor, 100);
                }
                monst.status[StatusEffect.Discordant] = monst.maxStatus[StatusEffect.Discordant] = 30;
            }
        }
    }
}

// =============================================================================
// rechargeItems — Items.c:3989
// =============================================================================

export interface RechargeItemsContext {
    packItems: Item[];
    message(msg: string, flags: number): void;
}

/**
 * Instantly recharge all staffs, wands, and/or charms in the player's pack
 * that match the given category bitmask. Displays a message describing what
 * was recharged.
 *
 * Ported from Items.c:3989 — rechargeItems() (static).
 */
export function rechargeItems(categories: number, ctx: RechargeItemsContext): void {
    let staffCount = 0, wandCount = 0, charmCount = 0;

    for (const item of ctx.packItems) {
        if (item.category & categories & ItemCategory.STAFF) {
            staffCount++;
            item.charges = item.enchant1;
            if (item.enchant1 > 0) {
                item.enchant2 = Math.trunc(
                    (item.kind === StaffKind.Blinking || item.kind === StaffKind.Obstruction
                        ? 10000
                        : 5000) / item.enchant1,
                );
            }
        }
        if (item.category & categories & ItemCategory.WAND) {
            wandCount++;
            item.charges++;
        }
        if (item.category & categories & ItemCategory.CHARM) {
            charmCount++;
            item.charges = 0;
        }
    }

    const categoryCount = (staffCount ? 1 : 0) + (wandCount ? 1 : 0) + (charmCount ? 1 : 0);

    if (categoryCount === 0) {
        ctx.message("a surge of energy courses through your pack, but nothing happens.", 0);
        return;
    }

    let buf = "a surge of energy courses through your pack, recharging your ";
    let i = 0;
    if (staffCount) {
        i++;
        buf += staffCount === 1 ? "staff" : "staffs";
        if (i === categoryCount - 1) buf += " and ";
        else if (i <= categoryCount - 2) buf += ", ";
    }
    if (wandCount) {
        i++;
        buf += wandCount === 1 ? "wand" : "wands";
        if (i === categoryCount - 1) buf += " and ";
        else if (i <= categoryCount - 2) buf += ", ";
    }
    if (charmCount) {
        buf += charmCount === 1 ? "charm" : "charms";
    }
    buf += ".";
    ctx.message(buf, 0);
}

// =============================================================================
// updateIdentifiableItem — Items.c:6908
// =============================================================================

export interface UpdateIdentifiableItemContext {
    scrollTable: ItemTable[];
    potionTable: ItemTable[];
}

/**
 * Clear the ITEM_CAN_BE_IDENTIFIED flag from an item whose kind is now fully
 * identified, so it no longer appears as "identifiable" in the UI.
 *
 * Ported from Items.c:6908 — updateIdentifiableItem().
 */
export function updateIdentifiableItem(item: Item, ctx: UpdateIdentifiableItemContext): void {
    if ((item.category & ItemCategory.SCROLL) && ctx.scrollTable[item.kind]?.identified) {
        item.flags &= ~ItemFlag.ITEM_CAN_BE_IDENTIFIED;
    } else if ((item.category & ItemCategory.POTION) && ctx.potionTable[item.kind]?.identified) {
        item.flags &= ~ItemFlag.ITEM_CAN_BE_IDENTIFIED;
    } else if (
        (item.category & (ItemCategory.RING | ItemCategory.STAFF | ItemCategory.WAND)) &&
        (item.flags & ItemFlag.ITEM_IDENTIFIED)
    ) {
        const table = getTableForCategory(item.category);
        if (table?.[item.kind]?.identified) {
            item.flags &= ~ItemFlag.ITEM_CAN_BE_IDENTIFIED;
        }
    } else if (
        (item.category & (ItemCategory.WEAPON | ItemCategory.ARMOR)) &&
        (item.flags & ItemFlag.ITEM_IDENTIFIED) &&
        (!(item.flags & ItemFlag.ITEM_RUNIC) || (item.flags & ItemFlag.ITEM_RUNIC_IDENTIFIED))
    ) {
        item.flags &= ~ItemFlag.ITEM_CAN_BE_IDENTIFIED;
    } else if (item.category & NEVER_IDENTIFIABLE) {
        item.flags &= ~ItemFlag.ITEM_CAN_BE_IDENTIFIED;
    }
}

// =============================================================================
// slow — Items.c:3905
// =============================================================================

export interface SlowContext {
    player: Creature;
    updateEncumbrance(): void;
    message(msg: string, flags: number): void;
}

/**
 * Apply slow status to a creature for the given number of turns.
 * Clears haste, doubles movement/attack speed for non-player creatures,
 * and calls updateEncumbrance + shows a message for the player.
 *
 * Ported from Items.c:3905 — slow().
 */
export function slow(monst: Creature, turns: number, ctx: SlowContext): void {
    if (monst.info.flags & (MonsterBehaviorFlag.MONST_INANIMATE | MonsterBehaviorFlag.MONST_INVULNERABLE)) {
        return;
    }
    monst.status[StatusEffect.Slowed] = monst.maxStatus[StatusEffect.Slowed] = turns;
    monst.status[StatusEffect.Hasted] = 0;
    if (monst === ctx.player) {
        ctx.updateEncumbrance();
        ctx.message("you feel yourself slow down.", 0);
    } else {
        monst.movementSpeed = monst.info.movementSpeed * 2;
        monst.attackSpeed = monst.info.attackSpeed * 2;
    }
}

// =============================================================================
// weaken — Items.c:3827
// =============================================================================

export interface WeakenContext {
    player: Creature;
    rogue: { weapon: Item | null; armor: Item | null };
    messageWithColor(msg: string, color: Color, flags: number): void;
    badMessageColor: Color;
    strengthCheck(item: Item | null, force: boolean): void;
}

/**
 * Increment the creature's weakness amount (up to 10) and set/extend
 * the weakness status duration. Shows a message and checks equipment
 * encumbrance when applied to the player.
 *
 * Ported from Items.c:3827 — weaken().
 */
export function weaken(monst: Creature, maxDuration: number, ctx: WeakenContext): void {
    if (monst.weaknessAmount < 10) {
        monst.weaknessAmount++;
    }
    monst.status[StatusEffect.Weakened] = Math.max(monst.status[StatusEffect.Weakened], maxDuration);
    monst.maxStatus[StatusEffect.Weakened] = Math.max(monst.maxStatus[StatusEffect.Weakened], maxDuration);
    if (monst === ctx.player) {
        ctx.messageWithColor(
            "your muscles weaken as an enervating toxin fills your veins.",
            ctx.badMessageColor,
            0,
        );
        ctx.strengthCheck(ctx.rogue.weapon, true);
        ctx.strengthCheck(ctx.rogue.armor, true);
    }
}

// =============================================================================
// updatePlayerRegenerationDelay — Items.c:7903
// =============================================================================

export interface UpdatePlayerRegenerationDelayContext {
    player: Creature;
    regenerationBonus: number;
}

/**
 * Recompute the player's HP regeneration rate based on their regeneration bonus
 * (from rings of regeneration and similar effects).
 *
 * Ported from Items.c:7903 — updatePlayerRegenerationDelay().
 */
export function updatePlayerRegenerationDelay(
    ctx: UpdatePlayerRegenerationDelayContext,
): void {
    const { player } = ctx;
    let maxHP = player.info.maxHP;
    const turnsForFull = turnsForFullRegenInThousandths(BigInt(ctx.regenerationBonus) * FP_FACTOR);
    const turnsPerHP = Math.trunc(turnsForFull / 1000);

    player.regenPerTurn = 0;
    while (maxHP > turnsPerHP) {
        player.regenPerTurn++;
        maxHP -= turnsPerHP;
    }
    if (maxHP > 0) {
        player.info.turnsBetweenRegen = Math.trunc(turnsForFull / maxHP);
    }
}
