/*
 *  items/item-effects.ts — negationBlast
 *  Port V2 — rogue-ts
 *
 *  Ported from Items.c:4073 — negationBlast().
 *  Strips magic from all creatures and items in field of view within radius.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { Item, Creature, Pcell, Pos, Color } from "../types/types.js";
import { ItemFlag, TileFlag } from "../types/flags.js";
import { ItemCategory } from "../types/enums.js";
import { pink } from "../globals/colors.js";

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
