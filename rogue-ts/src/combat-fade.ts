/*
 *  combat-fade.ts — buildFadeInMonsterFn
 *  Port V2 — rogue-ts
 *
 *  Extracted from combat.ts to keep that file under the 600-line limit.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState } from "./core.js";
import { getCellAppearance } from "./io/cell-appearance.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { flashMonster } from "./combat/combat-damage.js";
import type { CombatDamageContext } from "./combat/combat-damage.js";
import type { Creature } from "./types/types.js";

// =============================================================================
// buildFadeInMonsterFn — Monsters.c:904
// =============================================================================

/**
 * Returns a `fadeInMonster(monst)` closure that flashes the monster with the
 * background colour of its current cell — the visual cue for a monster
 * appearing (summoned, revealed, etc.).
 *
 * C: void fadeInMonster(creature *monst) — calls getCellAppearance then
 *    flashMonster(monst, &bColor, 100).
 */
export function buildFadeInMonsterFn(): (monst: Creature) => void {
    return (monst) => {
        const { rogue, pmap, tmap, displayBuffer, player, monsters,
            dormantMonsters, floorItems, monsterCatalog, scentMap } = getGameState();
        const { backColor } = getCellAppearance(
            monst.loc, pmap, tmap, displayBuffer, rogue, player,
            monsters, dormantMonsters, floorItems,
            tileCatalog, dungeonFeatureCatalog, monsterCatalog,
            terrainRandomValues, displayDetail, scentMap ?? [],
        );
        flashMonster(monst, backColor, 100, {
            setCreaturesWillFlash() { rogue.creaturesWillFlashThisTurn = true; },
        } as unknown as CombatDamageContext);
    };
}
