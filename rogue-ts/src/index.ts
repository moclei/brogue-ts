/*
 *  index.ts — Module barrel for rogue-ts
 *  Port V2 — rogue-ts
 *
 *  Re-exports the primary entry points for external consumers (tests, tooling).
 *  The browser entry point is bootstrap.ts — import that directly from HTML.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

// Platform
export { initPlatform, waitForEvent, peekEvent, commitDraws, mainGameLoop } from "./platform.js";

// Core state
export { getGameState } from "./core.js";

// Game lifecycle (Phase 7 entry points)
export { initializeRogue, startLevel, freeEverything, getPreviousGameSeed } from "./lifecycle.js";
export { buildMenuContext } from "./menus.js";

// Types
export type { RogueEvent, ScreenDisplayBuffer, Creature, Item } from "./types/types.js";
export { EventType, GameVariant, GameMode, NGCommand } from "./types/enums.js";
