/*
 *  sprite-data-wiring.ts — Factory for the layer compositing data provider
 *  Port V2 — rogue-ts
 *
 *  Builds a getCellSpriteData closure matching the pattern of
 *  buildGetCellAppearanceFn in io-wiring.ts. Called once per game session
 *  — the captured game-state references are mutable and stay valid.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { getGameState, getScentMap } from "./core.js";
import { tileCatalog } from "./globals/tile-catalog.js";
import { dungeonFeatureCatalog } from "./globals/dungeon-feature-catalog.js";
import { terrainRandomValues, displayDetail } from "./render-state.js";
import { getCellSpriteData } from "./io/sprite-appearance.js";
import { createCellSpriteData } from "./platform/render-layers.js";
import type { CellQueryContext } from "./io/cell-queries.js";
import type { CellSpriteDataProvider } from "./platform/browser-renderer.js";

/**
 * Build a CellSpriteDataProvider closure capturing current game state.
 *
 * Mirrors `buildGetCellAppearanceFn` in io-wiring.ts: captures pmap,
 * tmap, rogue, player, monsters, etc. by reference (mutable objects —
 * always reflect the latest game state).
 *
 * The reusable CellSpriteData + LayerEntryPool are allocated once and
 * reused for every cell. The caller (plotChar → drawCellLayers) must
 * consume the result synchronously before the next call overwrites it.
 */
export function buildCellSpriteDataProvider(): CellSpriteDataProvider {
    const {
        pmap, tmap, rogue, player, monsters, dormantMonsters,
        floorItems, monsterCatalog, displayBuffer,
    } = getGameState();
    const scentMap = getScentMap() ?? [];
    const ctx: CellQueryContext = {
        pmap, tmap, displayBuffer, rogue, player,
        monsters, dormantMonsters, floorItems,
        tileCatalog, dungeonFeatureCatalog, monsterCatalog,
        terrainRandomValues, displayDetail, scentMap,
        monsterFlagsList: monsterCatalog.map(m => m.flags),
    };
    const { spriteData, pool } = createCellSpriteData();
    return (dx: number, dy: number) => getCellSpriteData(dx, dy, ctx, spriteData, pool);
}
