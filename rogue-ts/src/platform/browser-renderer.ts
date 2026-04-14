/*
 *  browser-renderer.ts — Canvas2D-based BrogueConsole for the browser
 *  brogue-ts
 *
 *  Renders the 100×34 character grid onto an HTML <canvas>, translating
 *  keyboard and mouse DOM events into RogueEvent objects.
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Affero General Public License as
 *  published by the Free Software Foundation, either version 3 of the
 *  License, or (at your option) any later version.
 */

import type { BrogueConsole } from "../types/platform.js";
import { isSidebarCanvasSuppressed } from "./ui-sidebar.js";
import type { RogueEvent, PauseBehavior } from "../types/types.js";
import { EventType, GraphicsMode, DisplayGlyph } from "../types/enums.js";
import type { TileType } from "../types/enums.js";
import type { CellSpriteData } from "./render-layers.js";
import { spriteDebug } from "./sprite-debug.js";
import {
  COLS,
  ROWS,
  STAT_BAR_WIDTH,
  MESSAGE_LINES,
  DCOLS,
  DROWS,
  ESCAPE_KEY,
  RETURN_KEY,
  DELETE_KEY,
  TAB_KEY,
  UP_ARROW,
  DOWN_ARROW,
  LEFT_ARROW,
  RIGHT_ARROW,
  NUMPAD_0,
  NUMPAD_1,
  NUMPAD_2,
  NUMPAD_3,
  NUMPAD_4,
  NUMPAD_5,
  NUMPAD_6,
  NUMPAD_7,
  NUMPAD_8,
  NUMPAD_9,
  PRINTSCREEN_KEY,
} from "../types/constants.js";
import { TextRenderer } from "./text-renderer.js";
import { SpriteRenderer } from "./sprite-renderer.js";
import type { CellRect } from "./renderer.js";

/** Produces per-layer sprite data for a dungeon cell at (dungeonX, dungeonY). */
export type CellSpriteDataProvider = (dungeonX: number, dungeonY: number) => CellSpriteData;

// =============================================================================
// Constants
// =============================================================================

/** Polling interval (ms) while waiting for input with color dance. */
export const PAUSE_BETWEEN_EVENT_POLLING = 36;

// =============================================================================
// Progressive cell sizing — pure functions (exported for testing)
// =============================================================================

/** Left pixel edge of column `col` for a canvas of `canvasWidth` CSS pixels. */
export function cellLeftEdge(col: number, canvasWidth: number, cols: number): number {
  return Math.floor(col * canvasWidth / cols);
}

/** Top pixel edge of row `row` for a canvas of `canvasHeight` CSS pixels. */
export function cellTopEdge(row: number, canvasHeight: number, rows: number): number {
  return Math.floor(row * canvasHeight / rows);
}

/** Full CellRect for grid position (col, row). */
export function cellRect(
  col: number, row: number,
  canvasWidth: number, canvasHeight: number,
  cols: number, rows: number,
): CellRect {
  const left = cellLeftEdge(col, canvasWidth, cols);
  const top = cellTopEdge(row, canvasHeight, rows);
  return {
    x: left,
    y: top,
    width: cellLeftEdge(col + 1, canvasWidth, cols) - left,
    height: cellTopEdge(row + 1, canvasHeight, rows) - top,
  };
}

/**
 * Map a CSS-pixel coordinate to a grid cell using linear scan.
 * Returns clamped column and row indices.
 */
export function pixelToCellCoord(
  px: number, py: number,
  canvasWidth: number, canvasHeight: number,
  cols: number, rows: number,
): { x: number; y: number } {
  let col = cols - 1;
  for (let c = 1; c <= cols; c++) {
    if (px < cellLeftEdge(c, canvasWidth, cols)) { col = c - 1; break; }
  }

  let row = rows - 1;
  for (let r = 1; r <= rows; r++) {
    if (py < cellTopEdge(r, canvasHeight, rows)) { row = r - 1; break; }
  }

  return { x: Math.max(0, col), y: Math.max(0, row) };
}

// =============================================================================
// Internal state
// =============================================================================

/** Queued DOM events waiting to be consumed by the game loop. */
interface QueuedEvent {
  event: RogueEvent;
}

// =============================================================================
// BrowserRendererOptions
// =============================================================================

export interface BrowserRendererOptions {
  /** The <canvas> element to render to. */
  canvas: HTMLCanvasElement;

  /** Font size in CSS pixels (auto-calculated from canvas size if omitted). */
  fontSize?: number;

  /**
   * Device pixel ratio for HiDPI rendering. When set, the 2D context is
   * scaled so that all drawing operations use CSS-pixel coordinates while
   * the backing store renders at native resolution for crisp text.
   * Defaults to 1 (no scaling).
   */
  devicePixelRatio?: number;

  /**
   * Callback invoked from `gameLoop` to start the actual game.
   * Typically calls `rogueMain()`.
   */
  onGameLoop?: () => void;

  /**
   * Optional callback invoked when the game shuffles terrain colors.
   * Used for color-dance animation during input waits.
   */
  onColorsDance?: () => void;

  /** Pre-constructed text renderer for glyph drawing. */
  textRenderer: TextRenderer;

  /** Pre-constructed sprite renderer for tile drawing (optional; omit for text-only). */
  spriteRenderer?: SpriteRenderer;
}

// =============================================================================
// createBrowserConsole — factory function
// =============================================================================

/**
 * Creates a `BrogueConsole` implementation backed by an HTML Canvas2D context.
 *
 * The renderer:
 * - Divides the canvas into a COLS×ROWS grid of uniformly-sized cells.
 * - Implements `plotChar` by drawing Unicode glyphs (via `glyphToUnicode`) with
 *   foreground/background colors into each cell.
 * - Translates DOM keyboard and mouse events into `RogueEvent` objects.
 * - Provides async-compatible `pauseForMilliseconds` and `nextKeyOrMouseEvent`
 *   using a shared event queue.
 */
export function createBrowserConsole(
  options: BrowserRendererOptions,
): BrogueConsole & {
  /** Async wait for the next event — browser-specific extension. */
  waitForEvent(): Promise<RogueEvent>;
  /** Recalculate cell sizes after canvas resize. */
  handleResize(): void;
  /** Register the sprite data provider for layer compositing. */
  setCellSpriteDataProvider(provider: CellSpriteDataProvider): void;
} {
  const { canvas, onGameLoop, textRenderer, spriteRenderer } = options;
  const ctx2d = canvas.getContext("2d")!;

  /** Current graphics mode; used by plotChar to choose text vs. tiles. */
  let currentGraphicsMode: GraphicsMode = GraphicsMode.Tiles;

  /** Layer compositing data provider, set via setCellSpriteDataProvider. */
  let getCellSpriteDataFn: CellSpriteDataProvider | null = null;

  /** True if (x,y) is a cell in the dungeon viewport (not message area or sidebar). */
  function isInDungeonViewport(cellX: number, cellY: number): boolean {
    return (
      cellX >= STAT_BAR_WIDTH + 1 &&
      cellX < STAT_BAR_WIDTH + 1 + DCOLS &&
      cellY >= MESSAGE_LINES &&
      cellY < MESSAGE_LINES + DROWS
    );
  }

  // ---- Cell sizing state (delegates to exported pure functions) ----

  let cssWidth = 0;
  let cssHeight = 0;
  let fontSize = options.fontSize ?? 0;
  let dpr = options.devicePixelRatio ?? 1;

  function getCellRect(col: number, row: number): CellRect {
    return cellRect(col, row, cssWidth, cssHeight, COLS, ROWS);
  }

  function recalcCellSize(): void {
    dpr = options.devicePixelRatio ?? 1;

    cssWidth = canvas.width / dpr;
    cssHeight = canvas.height / dpr;

    if (options.fontSize) {
      fontSize = options.fontSize;
    } else {
      const baseCellWidth = Math.floor(cssWidth / COLS);
      const baseCellHeight = Math.floor(cssHeight / ROWS);
      fontSize = Math.max(1, Math.floor(Math.min(baseCellWidth, baseCellHeight)));
    }

    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

    textRenderer.fontSize = fontSize;
  }

  recalcCellSize();

  // ---- Event queue ----
  const eventQueue: QueuedEvent[] = [];
  let lastMouseCellX = -1;
  let lastMouseCellY = -1;

  /** Resolve function for the current `waitForEvent` promise, if any. */
  let resolveWait: ((ev: RogueEvent) => void) | null = null;

  function enqueueEvent(ev: RogueEvent): void {
    if (resolveWait) {
      const resolve = resolveWait;
      resolveWait = null;
      resolve(ev);
    } else {
      eventQueue.push({ event: ev });
    }
  }

  /**
   * Async wait for the next event — use this from async game loop code.
   * Exposed on the returned console as `waitForEvent`.
   */
  function _waitForEvent(): Promise<RogueEvent> {
    if (eventQueue.length > 0) {
      return Promise.resolve(eventQueue.shift()!.event);
    }
    return new Promise<RogueEvent>((resolve) => {
      resolveWait = resolve;
    });
  }

  function dequeueEventIfAvailable(): RogueEvent | null {
    if (eventQueue.length > 0) {
      return eventQueue.shift()!.event;
    }
    return null;
  }

  // ---- Coordinate mapping (delegates to exported pixelToCellCoord) --------
  function pixelToCell(px: number, py: number): { x: number; y: number } {
    return pixelToCellCoord(px, py, cssWidth, cssHeight, COLS, ROWS);
  }

  // ---- DOM event handlers ----

  function translateKey(domEvent: KeyboardEvent): number | null {
    switch (domEvent.key) {
      case "Escape":
        return ESCAPE_KEY;
      case "ArrowUp":
        return UP_ARROW;
      case "ArrowDown":
        return DOWN_ARROW;
      case "ArrowLeft":
        return LEFT_ARROW;
      case "ArrowRight":
        return RIGHT_ARROW;
      case "Enter":
        return RETURN_KEY;
      case "Backspace":
        return DELETE_KEY;
      case "Tab":
        return TAB_KEY;
      case "PrintScreen":
        return PRINTSCREEN_KEY;
      default:
        break;
    }

    // Numpad digits
    if (
      domEvent.code.startsWith("Numpad") &&
      domEvent.key.length === 1 &&
      domEvent.key >= "0" &&
      domEvent.key <= "9"
    ) {
      const numpadKeys = [
        NUMPAD_0,
        NUMPAD_1,
        NUMPAD_2,
        NUMPAD_3,
        NUMPAD_4,
        NUMPAD_5,
        NUMPAD_6,
        NUMPAD_7,
        NUMPAD_8,
        NUMPAD_9,
      ];
      return numpadKeys[parseInt(domEvent.key, 10)];
    }

    // Printable single characters
    if (domEvent.key.length === 1) {
      return domEvent.key.charCodeAt(0);
    }

    return null;
  }

  function onKeyDown(domEvent: KeyboardEvent): void {
    const keyCode = translateKey(domEvent);
    if (keyCode === null) return;

    domEvent.preventDefault();

    enqueueEvent({
      eventType: EventType.Keystroke,
      param1: keyCode,
      param2: 0,
      controlKey: domEvent.ctrlKey || domEvent.metaKey,
      shiftKey: domEvent.shiftKey,
    });
  }

  function onMouseDown(domEvent: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const { x, y } = pixelToCell(
      domEvent.clientX - rect.left,
      domEvent.clientY - rect.top,
    );
    const eventType =
      domEvent.button === 2 ? EventType.RightMouseDown : EventType.MouseDown;

    enqueueEvent({
      eventType,
      param1: x,
      param2: y,
      controlKey: domEvent.ctrlKey || domEvent.metaKey,
      shiftKey: domEvent.shiftKey,
    });
  }

  function onMouseUp(domEvent: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const { x, y } = pixelToCell(
      domEvent.clientX - rect.left,
      domEvent.clientY - rect.top,
    );
    const eventType =
      domEvent.button === 2 ? EventType.RightMouseUp : EventType.MouseUp;

    enqueueEvent({
      eventType,
      param1: x,
      param2: y,
      controlKey: domEvent.ctrlKey || domEvent.metaKey,
      shiftKey: domEvent.shiftKey,
    });
  }

  function onMouseMove(domEvent: MouseEvent): void {
    const rect = canvas.getBoundingClientRect();
    const { x, y } = pixelToCell(
      domEvent.clientX - rect.left,
      domEvent.clientY - rect.top,
    );
    if (x !== lastMouseCellX || y !== lastMouseCellY) {
      lastMouseCellX = x;
      lastMouseCellY = y;
      enqueueEvent({
        eventType: EventType.MouseEnteredCell,
        param1: x,
        param2: y,
        controlKey: domEvent.ctrlKey || domEvent.metaKey,
        shiftKey: domEvent.shiftKey,
      });
    }
  }

  // ---- Attach DOM listeners ----

  canvas.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // Make the canvas focusable so it can receive keyboard events
  if (!canvas.hasAttribute("tabindex")) {
    canvas.setAttribute("tabindex", "0");
  }

  // ---- Modifier state ----
  let shiftHeld = false;
  let ctrlHeld = false;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Shift") shiftHeld = true;
    if (e.key === "Control" || e.key === "Meta") ctrlHeld = true;
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "Shift") shiftHeld = false;
    if (e.key === "Control" || e.key === "Meta") ctrlHeld = false;
  });

  // ---- Build the console ----
  const browserConsole: BrogueConsole & {
    waitForEvent(): Promise<RogueEvent>;
    handleResize(): void;
    setCellSpriteDataProvider(provider: CellSpriteDataProvider): void;
  } = {
    waitForEvent: _waitForEvent,
    handleResize: recalcCellSize,

    gameLoop(): void {
      if (onGameLoop) onGameLoop();
    },

    pauseForMilliseconds(
      _milliseconds: number,
      behavior: PauseBehavior,
    ): boolean {
      // In a synchronous C port, this blocks. In the browser, we check the
      // event queue and return immediately. The actual delay is handled by
      // the caller via async scheduling.
      const ev = dequeueEventIfAvailable();
      if (ev) {
        if (
          ev.eventType !== EventType.MouseEnteredCell ||
          behavior.interruptForMouseMove
        ) {
          // Put it back — the caller will consume it via nextKeyOrMouseEvent
          eventQueue.unshift({ event: ev });
          return true;
        }
      }
      return false;
    },

    nextKeyOrMouseEvent(
      _textInput: boolean,
      _colorsDance: boolean,
    ): RogueEvent {
      // For the synchronous API shape, pop from queue if available.
      // The actual async waiting version is `waitForEvent()`.
      const ev = dequeueEventIfAvailable();
      if (ev) return ev;

      // Fallback: return a no-op event. In practice, callers should use
      // the async adapter that calls `waitForEvent()`.
      return {
        eventType: EventType.Keystroke,
        param1: 0,
        param2: 0,
        controlKey: false,
        shiftKey: false,
      };
    },

    plotChar(
      inputChar: DisplayGlyph,
      x: number,
      y: number,
      foreRed: number,
      foreGreen: number,
      foreBlue: number,
      backRed: number,
      backGreen: number,
      backBlue: number,
      tileType?: TileType,
    ): void {
      // Suppress sidebar columns during gameplay when DOM sidebar is active
      if (isSidebarCanvasSuppressed() && x < STAT_BAR_WIDTH) {
        const cr = getCellRect(x, y);
        ctx2d.fillStyle = "#000000";
        ctx2d.fillRect(cr.x, cr.y, cr.width, cr.height);
        return;
      }

      const cr = getCellRect(x, y);

      const useTiles =
        spriteRenderer &&
        currentGraphicsMode === GraphicsMode.Tiles &&
        isInDungeonViewport(x, y);

      if (useTiles) {
        if (getCellSpriteDataFn && tileType !== undefined) {
          const dx = x - (STAT_BAR_WIDTH + 1);
          const dy = y - MESSAGE_LINES;
          if (spriteDebug.enabled) {
            spriteDebug._renderingX = dx;
            spriteDebug._renderingY = dy;
          }
          const spriteData = getCellSpriteDataFn(dx, dy);
          spriteRenderer.drawCellLayers(cr, spriteData);
        } else {
          const fr = Math.round((foreRed * 255) / 100);
          const fg = Math.round((foreGreen * 255) / 100);
          const fb = Math.round((foreBlue * 255) / 100);
          const br = Math.round((backRed * 255) / 100);
          const bg = Math.round((backGreen * 255) / 100);
          const bb = Math.round((backBlue * 255) / 100);
          spriteRenderer.drawCell(
            cr, inputChar, fr, fg, fb, br, bg, bb,
            tileType,
          );
        }
      } else {
        const fr = Math.round((foreRed * 255) / 100);
        const fg = Math.round((foreGreen * 255) / 100);
        const fb = Math.round((foreBlue * 255) / 100);
        const br = Math.round((backRed * 255) / 100);
        const bg = Math.round((backGreen * 255) / 100);
        const bb = Math.round((backBlue * 255) / 100);
        textRenderer.drawCell(cr, inputChar, fr, fg, fb, br, bg, bb);
      }
    },

    remap(_from: string, _to: string): void {
      // Key remapping is not used in the browser build
    },

    modifierHeld(modifier: number): boolean {
      if (modifier === 0) return shiftHeld;
      if (modifier === 1) return ctrlHeld;
      return false;
    },

    notifyEvent(
      _eventId: number,
      _data1: number,
      _data2: number,
      _str1: string,
      _str2: string,
    ): void {
      // Optional: could dispatch a CustomEvent on the canvas
    },

    takeScreenshot(): boolean {
      // Trigger a download of the canvas as a PNG
      try {
        const link = document.createElement("a");
        link.download = "brogue-screenshot.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
        return true;
      } catch {
        return false;
      }
    },

    setGraphicsMode(mode: GraphicsMode): GraphicsMode {
      currentGraphicsMode = mode;
      return currentGraphicsMode;
    },

    setCellSpriteDataProvider(provider: CellSpriteDataProvider): void {
      getCellSpriteDataFn = provider;
    },
  };

  return browserConsole;
}

// =============================================================================
// Async helpers for browser integration
// =============================================================================

/**
 * Async-compatible pause that resolves after `ms` milliseconds, or earlier
 * if an input event arrives and `behavior.interruptForMouseMove` is set.
 */
export function asyncPause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
