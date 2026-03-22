/*
 *  glyph-sprite-map.test.ts — Sprite mapping coverage for surface/gas/fire TileTypes
 *  Port V2 — rogue-ts
 *
 *  Phase 7: verify every surface, gas, and fire TileType has a sprite mapping
 *  in the tileTypeSpriteMap. Unmapped types produce invisible layers in the
 *  layer compositing pipeline.
 */

import { describe, it, expect } from "vitest";
import { TileType } from "../../src/types/enums.js";
import { TileType as TT } from "../../src/types/enums.js";
import { buildTileTypeSpriteMap } from "../../src/platform/glyph-sprite-map.js";
import { isSurfaceTileType, isFireTileType, isGasTileType } from "../../src/platform/render-layers.js";

const spriteMap = buildTileTypeSpriteMap();

function allTileTypesMatching(predicate: (t: TileType) => boolean): TileType[] {
    const result: TileType[] = [];
    for (let t = TT.NOTHING + 1; t < TT.NUMBER_TILETYPES; t++) {
        if (predicate(t)) result.push(t);
    }
    return result;
}

describe("TileType sprite mapping coverage", () => {
    const surfaceTypes = allTileTypesMatching(isSurfaceTileType);
    const gasTypes = allTileTypesMatching(isGasTileType);
    const fireTypes = allTileTypesMatching(isFireTileType);

    it("identifies a non-trivial number of surface types", () => {
        expect(surfaceTypes.length).toBeGreaterThan(30);
    });

    it("identifies all 9 gas types", () => {
        expect(gasTypes.length).toBe(9);
    });

    it("identifies all 8 fire types", () => {
        expect(fireTypes.length).toBe(8);
    });

    describe("every surface TileType has a sprite mapping", () => {
        for (const t of allTileTypesMatching(isSurfaceTileType)) {
            it(`TileType ${TT[t]} (${t})`, () => {
                const ref = spriteMap.get(t);
                expect(ref).toBeDefined();
                expect(ref!.sheetKey).toBeTruthy();
            });
        }
    });

    describe("every gas TileType has a sprite mapping", () => {
        for (const t of allTileTypesMatching(isGasTileType)) {
            it(`TileType ${TT[t]} (${t})`, () => {
                const ref = spriteMap.get(t);
                expect(ref).toBeDefined();
                expect(ref!.sheetKey).toBeTruthy();
            });
        }
    });

    describe("every fire TileType has a sprite mapping", () => {
        for (const t of allTileTypesMatching(isFireTileType)) {
            it(`TileType ${TT[t]} (${t})`, () => {
                const ref = spriteMap.get(t);
                expect(ref).toBeDefined();
                expect(ref!.sheetKey).toBeTruthy();
            });
        }
    });
});
