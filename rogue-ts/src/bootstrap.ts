/*
 *  bootstrap.ts — Browser entry point for rogue-ts
 *  Port V2 — rogue-ts
 *
 *  Creates the browser console renderer, initializes the platform event
 *  bridge, and launches mainBrogueJunction (the top-level menu loop).
 *
 *  Game lifecycle:
 *    bootstrap → initPlatform(console) → buildMenuContext()
 *      → mainBrogueJunction(ctx, displayBuffer)
 *        → titleMenu (flame animation + button menu)
 *        → initializeRogue(seed) → startLevel(1, 1) → mainGameLoop()
 *        → back to mainBrogueJunction on game end
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import {
    createBrowserConsole,
    type BrowserRendererOptions,
} from "./platform/browser-renderer.js";
import { initPlatform } from "./platform.js";
import { getGameState } from "./core.js";
import { buildMenuContext } from "./menus.js";
import { mainBrogueJunction } from "./menus/main-menu.js";
import { COLS, ROWS } from "./types/constants.js";
import { loadTilesetImages } from "./platform/tileset-loader.js";
import { buildGlyphSpriteMap, buildTileTypeSpriteMap } from "./platform/glyph-sprite-map.js";
import { TextRenderer } from "./platform/text-renderer.js";
import { SpriteRenderer } from "./platform/sprite-renderer.js";

// =============================================================================
// Canvas setup
// =============================================================================

/**
 * Find the canvas element and size it for the current viewport and DPR.
 * Returns { cellSize, dpr } so the renderer can set the correct font size.
 */
function sizeCanvas(canvas: HTMLCanvasElement): { cellSize: number; dpr: number } {
    const dpr = window.devicePixelRatio || 1;
    const cellWidth = Math.floor(window.innerWidth / COLS);
    const cellHeight = Math.floor(window.innerHeight / ROWS);
    const cellSize = Math.min(cellWidth, cellHeight);

    const cssWidth = cellSize * COLS;
    const cssHeight = cellSize * ROWS;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    return { cellSize, dpr };
}

/**
 * Initialize the browser console renderer attached to #brogue-canvas.
 * Receives pre-loaded tiles and sprite map when provided (pixel-art mode).
 */
function initBrowserConsole(options: BrowserRendererOptions): ReturnType<typeof createBrowserConsole> {
    const canvasEl = document.getElementById("brogue-canvas");
    if (!canvasEl) throw new Error("Could not find #brogue-canvas element");
    const canvas = canvasEl as HTMLCanvasElement;

    const { cellSize, dpr } = sizeCanvas(canvas);

    const rendererOptions: BrowserRendererOptions = {
        ...options,
        canvas,
        fontSize: options.fontSize ?? Math.max(8, cellSize - 2),
        devicePixelRatio: options.devicePixelRatio ?? dpr,
    };

    const browserConsole = createBrowserConsole(rendererOptions);

    window.addEventListener("resize", () => {
        const { cellSize: cs, dpr: newDpr } = sizeCanvas(canvas);
        rendererOptions.fontSize = Math.max(8, cs - 2);
        rendererOptions.devicePixelRatio = newDpr;
        browserConsole.handleResize();
    });

    // Give the canvas keyboard focus immediately so keystrokes work without
    // requiring the user to click first.
    canvas.focus();

    return browserConsole;
}

// =============================================================================
// Entry point
// =============================================================================

async function main(): Promise<void> {
    // 1. Load tileset for pixel-art mode (optional; continues without tiles on failure)
    let tiles: Awaited<ReturnType<typeof loadTilesetImages>> | undefined;
    try {
        tiles = await loadTilesetImages();
    } catch (e) {
        console.warn("[rogue-ts] Tileset failed to load; tile mode will show placeholders.", e);
    }
    const spriteMap = buildGlyphSpriteMap();
    const tileTypeSpriteMap = buildTileTypeSpriteMap();

    // 2. Set up canvas, renderers, and the browser console event bridge
    const canvasEl = document.getElementById("brogue-canvas");
    if (!canvasEl) throw new Error("Could not find #brogue-canvas element");
    const canvas = canvasEl as HTMLCanvasElement;
    const { cellSize, dpr } = sizeCanvas(canvas);

    const ctx2d = canvas.getContext("2d")!;
    const initialFontSize = Math.max(8, cellSize - 2);
    const textRenderer = new TextRenderer(ctx2d, "monospace", initialFontSize);
    const spriteRenderer = tiles
        ? new SpriteRenderer(ctx2d, tiles, spriteMap, tileTypeSpriteMap, textRenderer)
        : undefined;

    const browserConsole = initBrowserConsole({
        canvas,
        fontSize: initialFontSize,
        devicePixelRatio: dpr,
        textRenderer,
        spriteRenderer,
    });

    // 3. Wire the platform module (event queue + plotChar for commitDraws)
    initPlatform(browserConsole);

    // 4. Build the menu DI context
    const menuCtx = buildMenuContext();

    // 5. Get the display buffer from core state
    const { displayBuffer } = getGameState();

    // eslint-disable-next-line no-console
    console.log(`[rogue-ts] Bootstrap complete. Grid: ${COLS}×${ROWS}`);

    // 6. Launch the main menu loop — runs until the game quits
    await mainBrogueJunction(menuCtx, displayBuffer);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[rogue-ts] Fatal bootstrap error:", err);
});
