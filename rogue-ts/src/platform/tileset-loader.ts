/*
 *  tileset-loader.ts — Load DawnLike 16×16 tileset PNGs for pixel-art rendering
 *  Pixel-art smoke test — Initiative: initiatives/pixel-art-smoke-test
 *
 *  Uses static imports so Vite resolves and serves the assets. Glyph-to-sprite
 *  mapping is in glyph-sprite-map.ts.
 */

import FloorUrl from "../../assets/tilesets/dawnlike/Objects/Floor.png?url";
import WallUrl from "../../assets/tilesets/dawnlike/Objects/Wall.png?url";
import Door0Url from "../../assets/tilesets/dawnlike/Objects/Door0.png?url";
import Door1Url from "../../assets/tilesets/dawnlike/Objects/Door1.png?url";
import Ground0Url from "../../assets/tilesets/dawnlike/Objects/Ground0.png?url";
import Player0Url from "../../assets/tilesets/dawnlike/Characters/Player0.png?url";

const SHEET_URLS: Record<string, string> = {
    Floor: FloorUrl,
    Wall: WallUrl,
    Door0: Door0Url,
    Door1: Door1Url,
    Ground0: Ground0Url,
    Player0: Player0Url,
};

export const TILE_SIZE = 16;

/**
 * Load all tileset images. Resolves when every image has loaded.
 * Keys are sheet names (e.g. "Floor", "Wall"). Fails if any image fails to load.
 */
export function loadTilesetImages(): Promise<Map<string, HTMLImageElement>> {
    const map = new Map<string, HTMLImageElement>();
    const entries = Object.entries(SHEET_URLS);

    return Promise.all(
        entries.map(([name, url]) => {
            return new Promise<void>((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    map.set(name, img);
                    resolve();
                };
                img.onerror = () => reject(new Error(`Failed to load tileset: ${name} (${url})`));
                img.src = url;
            });
        }),
    ).then(() => map);
}
