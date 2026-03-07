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
 */
function initBrowserConsole(): ReturnType<typeof createBrowserConsole> {
    const canvasEl = document.getElementById("brogue-canvas");
    if (!canvasEl) throw new Error("Could not find #brogue-canvas element");
    const canvas = canvasEl as HTMLCanvasElement;

    const { cellSize, dpr } = sizeCanvas(canvas);

    const options: BrowserRendererOptions = {
        canvas,
        fontSize: Math.max(8, cellSize - 2),
        devicePixelRatio: dpr,
    };

    const browserConsole = createBrowserConsole(options);

    window.addEventListener("resize", () => {
        const { cellSize: cs, dpr: newDpr } = sizeCanvas(canvas);
        options.fontSize = Math.max(8, cs - 2);
        options.devicePixelRatio = newDpr;
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
    // 1. Set up the browser canvas renderer and event bridge
    const browserConsole = initBrowserConsole();

    // 2. Wire the platform module (event queue + plotChar for commitDraws)
    initPlatform(browserConsole);

    // 3. Build the menu DI context
    const menuCtx = buildMenuContext();

    // 4. Get the display buffer from core state
    const { displayBuffer } = getGameState();

    // eslint-disable-next-line no-console
    console.log(`[rogue-ts] Bootstrap complete. Grid: ${COLS}×${ROWS}`);

    // 5. Launch the main menu loop — runs until the game quits
    await mainBrogueJunction(menuCtx, displayBuffer);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[rogue-ts] Fatal bootstrap error:", err);
});
