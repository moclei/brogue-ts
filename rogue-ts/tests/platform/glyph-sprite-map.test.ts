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
import { DisplayGlyph } from "../../src/types/enums.js";
import {
  buildTileTypeSpriteMap,
  buildGlyphSpriteMap,
  buildSheetUrls,
  MASTER_SHEET_KEY,
  type SpriteManifest,
  type AssignmentsData,
} from "../../src/platform/glyph-sprite-map.js";
import { isSurfaceTileType, isFireTileType, isGasTileType } from "../../src/platform/render-layers.js";
import { TILE_SIZE } from "../../src/platform/tileset-loader.js";

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

describe("buildGlyphSpriteMap — SpriteRef srcW/srcH", () => {
    it("backward compat: manifest entry with no w/h/sheet gets TILE_SIZE defaults and MASTER_SHEET_KEY", () => {
        const manifest: SpriteManifest = {
            tiles: {},
            glyphs: {
                G_PLAYER: { x: 3, y: 5 },
            },
        };
        const m = buildGlyphSpriteMap(manifest);
        const ref = m.get(DisplayGlyph.G_PLAYER);
        expect(ref).toBeDefined();
        expect(ref!.sheetKey).toBe(MASTER_SHEET_KEY);
        expect(ref!.tileX).toBe(3);
        expect(ref!.tileY).toBe(5);
        expect(ref!.srcW).toBe(TILE_SIZE);
        expect(ref!.srcH).toBe(TILE_SIZE);
    });

    it("extended entry round-trip: w/h/sheet are preserved on SpriteRef", () => {
        const manifest: SpriteManifest = {
            tiles: {},
            glyphs: {
                G_PLAYER: { x: 1, y: 2, w: 32, h: 32, sheet: "master-32" },
            },
        };
        const m = buildGlyphSpriteMap(manifest);
        const ref = m.get(DisplayGlyph.G_PLAYER);
        expect(ref).toBeDefined();
        expect(ref!.sheetKey).toBe("master-32");
        expect(ref!.tileX).toBe(1);
        expect(ref!.tileY).toBe(2);
        expect(ref!.srcW).toBe(32);
        expect(ref!.srcH).toBe(32);
    });
});

describe("buildSheetUrls — multi-sheet URL map", () => {
    it("returns URLs for all entries in assignments.sheets", () => {
        const assignments: AssignmentsData = {
            sheets: {
                master: "master.png",
                "master-32": "master-32.png",
            },
        };
        const urls = buildSheetUrls(assignments);
        expect(urls["master"]).toContain("master.png");
        expect(urls["master-32"]).toContain("master-32.png");
        expect(Object.keys(urls)).toHaveLength(2);
    });

    it("single master sheet assignment still works (backward compat)", () => {
        const assignments: AssignmentsData = {
            sheets: { master: "master-spritesheet.png" },
        };
        const urls = buildSheetUrls(assignments);
        expect(urls[MASTER_SHEET_KEY]).toContain("master-spritesheet.png");
    });

    it("no sheets declaration falls back to default master URL", () => {
        const assignments: AssignmentsData = {};
        const urls = buildSheetUrls(assignments);
        expect(urls[MASTER_SHEET_KEY]).toContain("master-spritesheet.png");
    });
});
