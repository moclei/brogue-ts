# Dungeon Camera — Tasks

> **Prerequisite:** `ui-extraction` initiative must be complete (at
> minimum through Phase 4: canvas is dungeon-only).

## Phase 1: Core Camera

- [ ] Define `DungeonCamera` interface and factory function in
  `platform/dungeon-camera.ts`. Include `centerX`, `centerY`, `zoom`,
  computed `viewportCols`/`viewportRows`.
- [ ] Implement coordinate transform functions: `visibleRect(camera)`,
  `dungeonToScreen(camera, cellX, cellY)`,
  `screenToDungeon(camera, px, py)`.
- [ ] Implement edge-clamping logic: shift viewport rectangle inward
  when it would extend past dungeon bounds (0,0)→(DCOLS,DROWS).
- [ ] Add `_forceDungeonRedraw` flag to `platform.ts`, distinct from
  `_forceFullRedraw`. Set it on camera position or zoom change.
- [ ] Modify the dungeon draw path in `browser-renderer.ts` (or the
  new dungeon-only renderer): consult camera to determine visible
  cells, compute screen rectangles via `dungeonToScreen`, draw at
  zoomed cell size.
- [ ] Skip drawing cells outside the camera's visible rect.
- [ ] Update mouse coordinate mapping: reverse camera transform so
  game logic receives dungeon cell coordinates, not screen coordinates.
- [ ] Set `image-rendering: pixelated` on the dungeon canvas for crisp
  pixel art scaling.
- [ ] Wire camera to player position: re-center camera on player after
  every player move. Use tile-snapping (instant, no animation).
- [ ] Set mode-specific default zoom: 1x for ASCII, 2x for pixel art.
- [ ] Verify: game plays correctly at 1x (no visible change), at 2x
  (zoomed view, fewer cells, player centered), and at 3x. Mouse clicks
  target the correct dungeon cell at all zoom levels.
- [ ] Commit Phase 1

# --- handoff point ---

## Phase 2: Interaction

- [ ] Zoom keyboard shortcuts: `+`/`-` (or `=`/`-`) to cycle zoom
  levels. Update camera and trigger `_forceDungeonRedraw`.
- [ ] Ctrl+scroll-wheel zoom: intercept wheel events on the dungeon
  canvas, zoom in/out. `preventDefault` to avoid page scroll.
- [ ] Map panning: detect mouse near dungeon canvas edges, scroll
  camera in that direction at a fixed rate (e.g., 1 cell per 200ms).
- [ ] Map panning: click-drag on dungeon canvas to pan camera freely.
- [ ] Snap-to-player key: Home (or Space when not in input mode)
  re-centers camera on player immediately.
- [ ] Auto-recenter on player action: any movement, attack, or wait
  action snaps camera back to player position.
- [ ] Persist zoom preference per graphics mode to localStorage.
  Restore on page load.
- [ ] Verify: zoom controls, panning, and snap-back all work smoothly
  in gameplay.
- [ ] Commit Phase 2

# --- handoff point ---

## Phase 3: Targeting Integration

- [ ] Detect targeting mode activation (`chooseTarget` / `moveCursor`).
- [ ] On targeting start: compute auto-zoom-to-fit — the minimum zoom
  level that shows both the player and the farthest reachable cell in
  the bolt/ability range. Temporarily set camera to that zoom.
- [ ] As the targeting cursor moves, keep both player and cursor
  visible. If the cursor moves beyond the current view, adjust camera
  (pan or zoom) to keep both in frame.
- [ ] On targeting end (confirm or cancel): restore the player's
  previous zoom level and re-center on player.
- [ ] Verify: targeting bolts, wands, and thrown items at various
  distances. Trajectory highlighting (`hiliteTrajectory`) visible for
  the full path.
- [ ] Commit Phase 3

# --- handoff point ---

## Phase 4: Minimap

- [ ] Create `platform/minimap.ts`: minimap rendering module.
- [ ] Render explored tiles at ~2–3 pixels per cell into a small
  overlay element (canvas or DOM) in the dungeon viewport corner.
- [ ] Show player position as a bright dot.
- [ ] Show entities in line of sight as colored dots (monsters red,
  items yellow, etc.).
- [ ] Draw camera viewport rectangle (outlined box showing which
  portion of the map is currently visible).
- [ ] Click-on-minimap: pan camera to the clicked location.
- [ ] Toggle minimap visibility with M key.
- [ ] Persist minimap visibility preference to localStorage.
- [ ] Verify: minimap updates correctly on player movement, level
  change, and entity visibility changes.
- [ ] Commit Phase 4

# --- handoff point ---

## Phase 5: Off-Screen Entity Indicators

- [ ] Sidebar hover → pan: when the player hovers over an entity in
  the sidebar, temporarily pan the camera to show that entity (or a
  midpoint showing both player and entity). On hover-end, snap back.
- [ ] Off-screen directional indicators: draw small arrows or pips at
  the dungeon canvas edges pointing toward off-screen entities that
  are in the player's line of sight.
- [ ] Indicators should show entity type (color-coded: red for monster,
  yellow for item, etc.) and approximate direction.
- [ ] Verify: indicators appear and disappear correctly as entities
  enter/leave line of sight or camera viewport.
- [ ] Commit Phase 5
