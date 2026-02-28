/*
 *  platform/index.ts — Barrel exports for the platform module
 *  brogue-ts
 */

// Re-export the BrogueConsole interface from types
export type { BrogueConsole } from "../types/platform.js";

// Glyph mapping
export { glyphToUnicode, isEnvironmentGlyph } from "./glyph-map.js";

// Null (headless) platform
export { nullConsole } from "./null-platform.js";

// Browser Canvas2D renderer
export {
    createBrowserConsole,
    asyncPause,
    PAUSE_BETWEEN_EVENT_POLLING,
    type BrowserRendererOptions,
} from "./browser-renderer.js";
