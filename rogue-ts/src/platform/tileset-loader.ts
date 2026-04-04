/*
 *  tileset-loader.ts — Load tileset images for pixel-art rendering
 *  brogue-ts
 *
 *  Loads the master spritesheet + autotile sheets as HTMLImageElements.
 *  Sheet URLs are derived from assignments.json via buildSheetUrls() —
 *  no hardcoded image paths. Glyph-to-sprite mapping is in glyph-sprite-map.ts.
 */

/** Default stride for standard tiles and for glyphs without explicit dimensions. */
export const TILE_SIZE = 16;

/** Maximum sprite dimension (px) supported by the tint offscreen canvas. */
export const MAX_SPRITE_SIZE = 64;

/**
 * Load tileset images from a URL map. Resolves when every image has loaded.
 * Keys are sheet names ("master" for the packed spritesheet, plus
 * connection group names like "WALL", "CHASM"). Fails if any image fails.
 */
export function loadTilesetImages(
  urls: Record<string, string>,
): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const entries = Object.entries(urls);

  return Promise.all(
    entries.map(([name, url]) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          map.set(name, img);
          resolve();
        };
        img.onerror = () =>
          reject(new Error(`Failed to load tileset: ${name} (${url})`));
        img.src = url;
      });
    }),
  ).then(() => map);
}
