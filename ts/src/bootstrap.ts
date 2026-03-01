/*
 *  bootstrap.ts — Browser entry point for brogue-ts
 *
 *  Creates the browser console, initializes the game runtime, and launches
 *  mainBrogueJunction. This file is the bridge between the platform layer
 *  and the game logic.
 *
 *  The game lifecycle flows as:
 *    bootstrap → createRuntime(console) → mainBrogueJunction(ctx, displayBuffer)
 *      → titleMenu (flame animation + button menu)
 *      → initializeRogue(seed)
 *      → startLevel(depthLevel, 1)
 *      → mainInputLoop()
 *      → gameOver() / victory()
 *      → back to mainBrogueJunction
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import { createBrowserConsole, type BrowserRendererOptions } from "./platform/browser-renderer.js";
import { createRuntime } from "./runtime.js";
import { mainBrogueJunction } from "./menus/main-menu.js";
import { COLS, ROWS } from "./types/constants.js";

// =============================================================================
// Browser Console Setup
// =============================================================================

/**
 * Initialize the browser console renderer.
 * Attaches to the #brogue-canvas element and sizes the canvas to fill
 * the viewport while maintaining the COLS×ROWS grid aspect ratio.
 */
function initBrowserConsole(): ReturnType<typeof createBrowserConsole> {
    const canvas = document.getElementById("brogue-canvas") as HTMLCanvasElement | null;
    if (!canvas) {
        throw new Error("Could not find #brogue-canvas element");
    }

    // Size the canvas to fill the viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate cell size to fit the grid in the viewport
    const cellWidth = Math.floor(viewportWidth / COLS);
    const cellHeight = Math.floor(viewportHeight / ROWS);
    const cellSize = Math.min(cellWidth, cellHeight);

    canvas.width = cellSize * COLS;
    canvas.height = cellSize * ROWS;

    const options: BrowserRendererOptions = {
        canvas,
        fontSize: Math.max(8, cellSize - 2),
    };

    const browserConsole = createBrowserConsole(options);

    // Handle window resize
    window.addEventListener("resize", () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const cw = Math.floor(w / COLS);
        const ch = Math.floor(h / ROWS);
        const cs = Math.min(cw, ch);
        canvas.width = cs * COLS;
        canvas.height = cs * ROWS;
        browserConsole.handleResize();
    });

    return browserConsole;
}

// =============================================================================
// Game Launch
// =============================================================================

/**
 * Entry point: set up the browser console, create the game runtime,
 * and launch the main menu junction.
 */
async function main(): Promise<void> {
    // 1. Initialize the browser console (Canvas2D renderer + event handling)
    const browserConsole = initBrowserConsole();

    // 2. Create the game runtime (DI container that wires all modules)
    const runtime = createRuntime(browserConsole);

    // eslint-disable-next-line no-console
    console.log(
        "[brogue-ts] Runtime initialized.",
        `Grid: ${COLS}×${ROWS}`,
    );

    // 3. Launch the main menu junction — this is the top-level game loop
    //    that shows the title screen, handles menu choices, and dispatches
    //    to new games, saved games, recordings, etc.
    await mainBrogueJunction(runtime.menuCtx, runtime.displayBuffer);
}

// =============================================================================
// Launch
// =============================================================================

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[brogue-ts] Fatal error during bootstrap:", err);
});
