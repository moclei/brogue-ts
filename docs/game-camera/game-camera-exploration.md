# Game Camera & Viewport Exploration

> **Status:** Research complete — initiatives created  
> **Date:** 2026-03-23  
> **Initiatives:** `initiatives/ui-extraction/` (prerequisite) →
> `initiatives/dungeon-camera/`

---

## Problem Statement

The game renders a fixed **100×34 character grid** (20-column sidebar, 79×29 dungeon viewport, 3-row message area) into an HTML canvas that scales to fill the browser viewport. The canvas maintains its aspect ratio and uses full width; as the viewport narrows, every cell shrinks uniformly.

This creates two readability problems:

1. **At small viewport widths**, text in the sidebar and message area becomes hard to read, and the dungeon becomes difficult to parse — in both ASCII and pixel-art mode.
2. **In pixel-art mode even at full screen**, the 16×16 sprites rendered into cells sized to fit 100 columns across the screen are too small to appreciate. Each sprite might only get ~14–19 CSS pixels depending on monitor resolution.

Browser zoom (Ctrl +/−) doesn't help because it scales the entire page uniformly, pushing UI elements off-screen and breaking the game experience.

---

## Current Architecture

### Canvas Sizing (`bootstrap.ts`)

```typescript
function sizeCanvas(canvas: HTMLCanvasElement): { cellSize: number; dpr: number } {
    const dpr = window.devicePixelRatio || 1;
    const cellWidth = Math.floor(window.innerWidth / COLS);   // COLS = 100
    const cellHeight = Math.floor(window.innerHeight / ROWS); // ROWS = 34
    const cellSize = Math.min(cellWidth, cellHeight);
    // ... sets canvas CSS and backing-store dimensions
}
```

Every cell in the 100×34 grid gets the same size. On resize, `sizeCanvas` recomputes and the console's `handleResize()` recalculates font sizes.

### Grid Layout (constants)

| Region | Columns | Rows | Purpose |
|--------|---------|------|---------|
| Sidebar | 0–19 (STAT_BAR_WIDTH = 20) | 0–33 | Player stats, entity list |
| Separator | 20 | 0–33 | Vertical divider |
| Dungeon viewport | 21–99 (DCOLS = 79) | 3–31 (DROWS = 29) | Map area |
| Message area | 21–99 | 0–2 (MESSAGE_LINES = 3) | Game messages |
| Bottom bar | 21–99 | 32–33 | Depth display, buttons |

### Rendering Modes

- **ASCII (TextRenderer):** Draws Unicode glyphs with `ctx.fillText()`. Font size is derived from cell size.
- **Pixel Art (SpriteRenderer):** Draws 16×16 sprite tiles from tileset sheets, scaled to fit each cell. Uses layer compositing with per-layer multiply tinting.

### Key Constraint

The game logic writes into a flat `ScreenDisplayBuffer[100][34]`. All IO code (sidebar, messages, menus, targeting overlays) addresses cells by `(col, row)` in this grid. The rendering pipeline reads from this buffer and draws to canvas.

**Any camera system must preserve this contract.** The game logic must continue to think in 100×34 coordinates. The camera is a rendering-layer concern only.

---

## Research: How Other Games Solve This

### DCSS (Dungeon Crawl Stone Soup) — Tiles Mode

The closest analogue. DCSS has a dungeon viewport that shows a subset of the map centered on the player, with independently-scaled UI panels (inventory, messages, minimap). The dungeon tiles are rendered at a fixed pixel size; the viewport shows as many tiles as fit. A minimap in the corner shows the full explored level.

### Caves of Qud

Player-centered camera with edge clamping. The viewport scrolls tile-by-tile as the player moves. UI panels are fixed-size. Zoom level is adjustable in settings.

### Cogmind

Fixed viewport centered on player. Multiple UI scaling options in settings. The game picks a default based on monitor resolution. The dungeon viewport size adapts to the chosen scale.

### Diablo / Baldur's Gate

Isometric, but the camera concepts apply: player-centered with edge clamping, free map panning (click-drag or edge-scroll), snap-back-to-player on action.

### Common Patterns

1. **Separate scale for UI vs. game area** — UI panels are always readable; only the game viewport zooms.
2. **Player-centered camera with edge clamping** — camera follows the player but stops at map edges so no void is shown.
3. **Tile-snapping** — in turn-based games, the camera moves in discrete cell increments, not smooth sub-pixel scrolling. This feels natural for turn-based movement.
4. **Minimap** — when zoomed in, a small overview shows the full level with a viewport indicator rectangle.
5. **Configurable zoom** — a settings slider or keyboard shortcuts to adjust zoom level.

---

## Proposed Solution

### Core Concept: Dungeon Camera

Add a **camera system** that applies only to the dungeon viewport portion of the grid. The sidebar, message area, and other UI regions continue to render at a fixed, readable scale. The dungeon area renders a *subset* of the 79×29 map at a larger cell size.

### Camera Behavior

- **Player-centered:** The camera is centered on the player's position. When the player moves, the camera snaps to re-center (tile-snapping, not smooth scrolling).
- **Edge-clamped:** When the player is near a map edge, the camera stops scrolling so that no cells outside the map are shown. The player appears off-center near edges, but the full viewport is always filled with valid map.
- **Zoom level:** Determines how many dungeon cells are visible. At zoom 1x, all 79×29 cells are shown (current behavior). At 2x, approximately 40×15 cells are visible, each rendered at double size. At 3x, approximately 26×10 cells, and so on.

### Integer Scaling for Pixel Art

Pixel art must be rendered at integer multiples of its native sprite size (16×16) to stay crisp. The zoom levels should snap to values that produce integer cell sizes. Combined with `image-rendering: pixelated` on the canvas, this keeps sprites sharp.

For ASCII mode, integer scaling is less critical (font rendering handles sub-pixel anti-aliasing), but consistent cell sizes still look better.

### Interaction: Panning and Navigation

- **Edge-scroll or drag-pan:** The player can scroll the dungeon view away from the player to explore already-seen map, by moving the mouse to the dungeon viewport edge or by click-dragging.
- **Snap-to-player key:** A single keypress (e.g., Space or Home) re-centers the camera on the player immediately. Any player action (movement, attack) also re-centers automatically.
- **Zoom controls:** Keyboard shortcuts (+/−) or a settings slider to adjust zoom level. Could also support Ctrl+scroll-wheel in the dungeon area.

### Off-Screen Entities (Line of Sight)

Brogue's line-of-sight can reveal items and monsters far across the map. When zoomed in, these may be outside the visible camera area. Two complementary solutions:

1. **Sidebar hover → pan-to-entity:** When the player hovers over an entity in the sidebar panel, the camera temporarily pans to show that entity (or pans to a midpoint showing both player and entity). When the hover ends, the camera snaps back to the player. This is low-cost to implement and high-value for UX.

2. **Off-screen indicators:** Small directional arrows or pips at the edge of the dungeon viewport pointing toward off-screen entities that are in the player's line of sight. Subtle but informative — the player knows *something* is out there in that direction.

3. **Minimap (Phase 3):** A small overlay in the corner of the dungeon viewport showing the full explored level. The current camera viewport is indicated by a rectangle. Entities in line of sight are shown as colored dots. Clicking the minimap could pan the camera to that location.

### Mode-Specific Defaults

| Mode | Default Zoom | Rationale |
|------|-------------|-----------|
| ASCII | 1x (no zoom) | ASCII is readable at small sizes; full map visibility is more valuable |
| Pixel Art | 2x–3x | Sprites need more pixels to be legible; fewer visible cells is acceptable |

The user can override these in a settings screen. The game remembers the preference per mode.

### Minimum Canvas Size

As a baseline safety net regardless of camera system: enforce a minimum canvas size (e.g., 1200×500 CSS pixels). If the viewport is smaller, the canvas does not shrink further — the browser scrolls or the game letterboxes. This prevents the pathological case of extremely tiny cells.

---

## Architecture

### What Changes

The camera system lives entirely in the **platform/renderer layer**. No changes to game logic, IO, sidebar, or the display buffer.

```
Game Logic → writes to ScreenDisplayBuffer[100][34]
                          ↓
              ┌───────────────────────────┐
              │   Browser Renderer        │
              │                           │
              │   Sidebar (cols 0-20)     │ ← rendered at fixed scale
              │   Messages (rows 0-2)     │ ← rendered at fixed scale
              │   Dungeon (cols 21-99,    │ ← CAMERA TRANSFORM applied
              │            rows 3-31)     │   (zoom + offset)
              └───────────────────────────┘
                          ↓
                     HTML Canvas
```

### Key Components

1. **`DungeonCamera`** — state object holding:
   - `centerX`, `centerY` — camera center in dungeon cell coordinates
   - `zoom` — zoom multiplier (1x, 2x, 3x, or continuous)
   - `viewportCols`, `viewportRows` — computed from zoom and available pixel area
   - Methods: `centerOnPlayer()`, `clampToMapEdges()`, `cellToScreenPixel()`, `screenPixelToCell()`

2. **Modified `plotChar` / dungeon draw path** — when drawing a cell in the dungeon viewport region, consult the camera to determine:
   - Is this cell currently visible in the camera viewport? If not, skip drawing.
   - What screen rectangle should this cell occupy? (Larger than the default cell size when zoomed.)

3. **Modified mouse coordinate mapping** — when a click/hover lands in the dungeon viewport pixel area, reverse the camera transform to get the correct dungeon cell `(x, y)`. The game logic receives the *dungeon* coordinate, not the screen coordinate.

4. **Minimap renderer (Phase 3)** — a small secondary rendering pass that draws the full explored map at a very small scale into a corner overlay.

### What Does NOT Change

- `ScreenDisplayBuffer` dimensions (100×34)
- All game logic addressing cells by `(col, row)`
- Sidebar rendering, message rendering, menu rendering
- The `Renderer` interface (`drawCell`, `drawCellLayers`)
- The `BrogueConsole` interface

---

## Implementation Phases

### Phase 0: Minimum Canvas Size — DONE

Implemented: `MIN_CELL_SIZE = 12` enforced in `sizeCanvas()` (`bootstrap.ts`).
When the viewport is too small, the canvas stays at minimum size and the page
becomes scrollable (`overflow: auto` on `<body>` in `index.html`).

### Phase 1: Camera System

**Scope:** Core camera with player-centered tracking, edge clamping, and configurable zoom.

Tasks:
- Define `DungeonCamera` type/class with state and coordinate transforms
- Modify the dungeon portion of `plotChar` / draw path to use camera viewport
- Reverse-map mouse coordinates through camera for dungeon clicks/hovers
- Wire camera to player position updates (re-center on every player move)
- Apply integer scaling for pixel art mode (`image-rendering: pixelated`)
- Set mode-specific default zoom levels (1x ASCII, 2x–3x pixel art)

**Effort:** Medium — 3–5 sessions. The coordinate mapping and draw-path changes require careful testing.

### Phase 2: User Interaction

**Scope:** Controls for the player to interact with the camera.

Tasks:
- Zoom in/out keyboard shortcuts (+/−, or Ctrl+scroll-wheel)
- Map panning: edge-scroll when mouse is near dungeon viewport edge, or click-drag
- Snap-to-player key (Space or Home)
- Auto-recenter on player action (movement, attack, etc.)
- Settings UI for zoom level preference (could be a simple in-game menu)
- Persist zoom preference per graphics mode (localStorage)

**Effort:** Medium — 2–3 sessions.

### Phase 3: Minimap

**Scope:** Small overview map overlay in the dungeon viewport corner.

Tasks:
- Render explored tiles at ~2–3 pixels per cell into a small overlay canvas or region
- Show viewport rectangle indicating current camera position
- Show colored dots for entities in line of sight
- Click-on-minimap to pan camera
- Toggle minimap visibility (key or setting)

**Effort:** Medium — 2–3 sessions. Rendering is simple but the overlay positioning and click handling need care.

### Phase 4: Off-Screen Entity Indicators

**Scope:** UX for entities visible via line-of-sight but outside the camera viewport.

Tasks:
- Sidebar hover → temporary camera pan to entity (with smooth or snapped transition)
- Off-screen directional indicators (arrows at dungeon viewport edges)
- Return-to-player on hover-end or player action

**Effort:** Small-medium — 1–2 sessions.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Camera movement style | Tile-snapping | Turn-based game; smooth scrolling would feel disconnected from the discrete movement model |
| Camera scope | Dungeon viewport only | Sidebar and messages must remain readable at all times; game logic must not change |
| Default zoom (ASCII) | 1x | ASCII is readable at small sizes; full visibility more valuable |
| Default zoom (Pixel Art) | 2x–3x (TBD during implementation) | Sprites need more pixels; exact default depends on common monitor sizes |
| Pixel art scaling | Integer multiples only | Prevents blurry/aliased sprites; standard practice for pixel art |
| Architecture boundary | Rendering layer only | Game logic, IO, and display buffer are untouched; camera is a platform concern |

## Open Questions

- **Exact zoom levels:** Should zoom be discrete steps (1x, 2x, 3x) or continuous (1.0–4.0 slider)? Discrete is simpler and guarantees integer scaling for pixel art; continuous gives more control but risks non-integer sizes.
- **Targeting mode interaction:** When the player enters targeting mode (selecting a bolt/spell target), should the camera zoom out to show the full range, or let the player pan? Zooming out temporarily might be more intuitive.
- **Menu/popup rendering:** Some game menus (inventory, identify) render into the dungeon viewport area. These presumably should render at the non-zoomed scale (or their own fixed scale) rather than being affected by the camera. Needs verification during implementation.
- **Performance:** At high zoom, fewer cells are drawn per frame, so performance should improve. But the minimap adds a second render pass. Likely not a concern but worth monitoring.
