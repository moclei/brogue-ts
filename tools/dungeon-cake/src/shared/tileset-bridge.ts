/*
 *  tileset-bridge.ts — Load tilesets and construct renderers for dungeon-cake
 *  dungeon-cake
 *
 *  Wraps game-source tileset loading functions. Vite resolves the ?url asset
 *  imports from the game source file locations via the @game alias.
 */

import { loadTilesetImages, TILE_SIZE } from "@game/platform/tileset-loader.js";
import {
    buildGlyphSpriteMap,
    buildTileTypeSpriteMap,
    buildAutotileVariantMap,
    buildSheetUrls,
} from "@game/platform/glyph-sprite-map.js";
import { TextRenderer } from "@game/platform/text-renderer.js";
import { SpriteRenderer } from "@game/platform/sprite-renderer.js";

export { TILE_SIZE };
export type { SpriteRenderer };

export interface TilesetBundle {
    spriteRenderer: SpriteRenderer;
    textRenderer: TextRenderer;
    tileSize: number;
}

/**
 * Load all tileset assets and construct TextRenderer + SpriteRenderer.
 * The canvas context must be provided by the caller (from the dungeon canvas).
 */
export async function loadTilesets(ctx: CanvasRenderingContext2D): Promise<TilesetBundle> {
    const tiles = await loadTilesetImages(buildSheetUrls());

    const glyphMap = buildGlyphSpriteMap();
    const tileTypeMap = buildTileTypeSpriteMap();
    const autotileMap = buildAutotileVariantMap(tileTypeMap);

    const textRenderer = new TextRenderer(ctx, "monospace", TILE_SIZE);
    const spriteRenderer = new SpriteRenderer(
        ctx, tiles, glyphMap, tileTypeMap, textRenderer, autotileMap,
    );

    await spriteRenderer.precreateBitmaps();

    return { spriteRenderer, textRenderer, tileSize: TILE_SIZE };
}
