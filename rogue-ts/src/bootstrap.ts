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
import { initPlatform, forceFullRedraw, commitDraws } from "./platform.js";
import { getGameState } from "./core.js";
import { buildMenuContext } from "./menus.js";
import { mainBrogueJunction } from "./menus/main-menu.js";
import { COLS, ROWS, STAT_BAR_WIDTH, MESSAGE_LINES, DCOLS, DROWS } from "./types/constants.js";
import { loadTilesetImages } from "./platform/tileset-loader.js";
import {
    buildGlyphSpriteMap,
    buildTileTypeSpriteMap,
    buildAutotileVariantMap,
    buildSheetUrls,
    fetchSpriteManifest,
    fetchAssignments,
} from "./platform/glyph-sprite-map.js";
import { TextRenderer } from "./platform/text-renderer.js";
import { SpriteRenderer } from "./platform/sprite-renderer.js";
import { spriteDebug } from "./platform/sprite-debug.js";
import { toggleCheatPanel } from "./platform/game-debug-panel.js";

// =============================================================================
// Canvas setup
// =============================================================================

const MIN_CELL_SIZE = 12;

/**
 * Find the canvas element and size it for the current viewport and DPR.
 * Returns { cellSize, dpr } so the renderer can set the correct font size.
 *
 * Enforces MIN_CELL_SIZE so the game never becomes unreadably small.
 * When the viewport is too narrow, the canvas exceeds the viewport and
 * the page becomes scrollable (see overflow: auto on <body>).
 */
function sizeCanvas(canvas: HTMLCanvasElement): { cellSize: number; dpr: number } {
    const dpr = window.devicePixelRatio || 1;
    const cellWidth = Math.floor(window.innerWidth / COLS);
    const cellHeight = Math.floor(window.innerHeight / ROWS);
    const cellSize = Math.max(MIN_CELL_SIZE, Math.min(cellWidth, cellHeight));

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
    const sheetUrls = buildSheetUrls();
    let tiles: Map<string, HTMLImageElement> | undefined;
    try {
        tiles = await loadTilesetImages(sheetUrls);
    } catch (e) {
        console.warn("[rogue-ts] Tileset failed to load; tile mode will show placeholders.", e);
    }
    const spriteMap = buildGlyphSpriteMap();
    const tileTypeSpriteMap = buildTileTypeSpriteMap();
    const autotileVariantMap = buildAutotileVariantMap(tileTypeSpriteMap);

    // 2. Set up canvas, renderers, and the browser console event bridge
    const canvasEl = document.getElementById("brogue-canvas");
    if (!canvasEl) throw new Error("Could not find #brogue-canvas element");
    const canvas = canvasEl as HTMLCanvasElement;
    const { cellSize, dpr } = sizeCanvas(canvas);

    const ctx2d = canvas.getContext("2d")!;
    const initialFontSize = Math.max(8, cellSize - 2);
    const textRenderer = new TextRenderer(ctx2d, "monospace", initialFontSize);
    const spriteRenderer = tiles
        ? new SpriteRenderer(ctx2d, tiles, spriteMap, tileTypeSpriteMap, textRenderer, autotileVariantMap)
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

    // 5b. F2 debug panel — intercept before canvas keydown reaches the game
    const canvasParent = canvas.parentElement ?? document.body;
    document.addEventListener("keydown", (e) => {
        if (e.key === "F2") {
            e.preventDefault();
            e.stopPropagation();
            toggleCheatPanel(canvasParent);
        }
    }, true);

    // Click-to-inspect: when the debug panel is open, clicking a dungeon cell
    // snapshots that cell's per-layer tint values into the panel.
    canvas.addEventListener("click", (e) => {
        if (!spriteDebug.enabled || !spriteDebug.onInspect) return;
        const rect = canvas.getBoundingClientRect();
        const cellX = Math.floor((e.clientX - rect.left) / (rect.width / COLS));
        const cellY = Math.floor((e.clientY - rect.top) / (rect.height / ROWS));
        const dx = cellX - (STAT_BAR_WIDTH + 1);
        const dy = cellY - MESSAGE_LINES;
        if (dx >= 0 && dx < DCOLS && dy >= 0 && dy < DROWS) {
            spriteDebug.inspectTarget = { x: dx, y: dy };
            spriteDebug.dirty = true;
        }
    });

    // Poll the spriteDebug dirty flag to trigger redraws when panel controls change.
    function checkDebugDirty(): void {
        if (spriteDebug.dirty) {
            spriteDebug.dirty = false;
            forceFullRedraw();
        }
        requestAnimationFrame(checkDebugDirty);
    }
    requestAnimationFrame(checkDebugDirty);

    // Benchmark: expose a function for timing full viewport redraws from dev console.
    // Usage: window.benchmarkRedraw(100) — runs 100 forced redraws and logs average ms.
    (window as unknown as Record<string, unknown>).benchmarkRedraw = (iterations = 50) => {
        const times: number[] = [];
        for (let n = 0; n < iterations; n++) {
            forceFullRedraw();
            const t0 = performance.now();
            commitDraws();
            times.push(performance.now() - t0);
        }
        times.sort((a, b) => a - b);
        const avg = times.reduce((s, t) => s + t, 0) / times.length;
        const p50 = times[Math.floor(times.length * 0.5)];
        const p95 = times[Math.floor(times.length * 0.95)];
        // eslint-disable-next-line no-console
        console.log(
            `[benchmark] ${iterations} redraws: avg=${avg.toFixed(2)}ms p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms`,
        );
        return { avg, p50, p95, times };
    };

    // 5c. HMR: hot-reload sprites when the sprite assigner writes new assets
    if (import.meta.hot) {
        import.meta.hot.on("tileset-update", async (data: { file: string }) => {
            if (!spriteRenderer) return;
            // eslint-disable-next-line no-console
            console.log(`[rogue-ts] Tileset changed: ${data.file}, reloading sprites…`);
            try {
                const [newAssignments, newManifest] = await Promise.all([
                    fetchAssignments(),
                    fetchSpriteManifest(),
                ]);
                const newUrls = buildSheetUrls(newAssignments, `?t=${Date.now()}`);
                const newTiles = await loadTilesetImages(newUrls);
                const newSpriteMap = buildGlyphSpriteMap(newManifest);
                const newTileTypeSpriteMap = buildTileTypeSpriteMap(newManifest);
                const newAutotileVariantMap = buildAutotileVariantMap(
                    newTileTypeSpriteMap, newAssignments,
                );
                await spriteRenderer.reloadTiles(
                    newTiles, newSpriteMap, newTileTypeSpriteMap, newAutotileVariantMap,
                );
                forceFullRedraw();
                commitDraws();
                // eslint-disable-next-line no-console
                console.log("[rogue-ts] Sprites hot-reloaded successfully.");
            } catch (e) {
                console.warn("[rogue-ts] Sprite hot-reload failed:", e);
            }
        });
    }

    // eslint-disable-next-line no-console
    console.log(`[rogue-ts] Bootstrap complete. Grid: ${COLS}×${ROWS}`);

    // 6. Launch the main menu loop — runs until the game quits
    await mainBrogueJunction(menuCtx, displayBuffer);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[rogue-ts] Fatal bootstrap error:", err);
});
