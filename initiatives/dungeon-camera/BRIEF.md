# Dungeon Camera

## Intent

Add a camera system to the dungeon viewport so the player can zoom in
on the map — essential for pixel-art mode where sprites are too small
to read at the default 79×29 full-map view. The camera centers on the
player, clamps at map edges, and supports configurable zoom levels.

## Goals

- The dungeon viewport renders a zoomed subset of the 79×29 map,
  centered on the player, with each cell drawn larger.
- Camera movement is tile-snapping (discrete cell increments), matching
  the turn-based movement model.
- Edge clamping: when the player is near a map edge, the camera stops
  panning so no void is shown. The player appears off-center near edges.
- Configurable zoom level with mode-specific defaults (1x for ASCII,
  2x–3x for pixel art). Zoom is discrete steps (1x, 2x, 3x) initially.
- Pixel art sprites render at integer multiples of 16×16 for crisp
  scaling.
- The player can pan the camera away from the player to explore the
  map, and snap back with a keypress.
- Off-screen entities in line of sight have indicators (sidebar hover
  pans to entity, directional arrows at viewport edges).
- Optional minimap overlay showing the full explored level.

## Scope

What's in:
- `DungeonCamera` state and coordinate transforms
- Modified dungeon draw path for zoomed rendering
- Mouse coordinate reverse-mapping through camera
- Zoom controls (keyboard shortcuts, settings)
- Map panning (edge-scroll or drag, snap-to-player key)
- Targeting mode integration (auto-zoom-to-fit during targeting)
- Off-screen entity indicators
- Minimap overlay
- `image-rendering: pixelated` for crisp pixel art scaling

What's out:
- UI extraction (prerequisite initiative, must be done first)
- Changes to game logic, sidebar, or message rendering
- Smooth scrolling or sub-pixel camera interpolation
- Mobile/touch controls

## Constraints

- **Prerequisite:** The `ui-extraction` initiative must be complete (or
  at minimum Phase 4: canvas resized to dungeon-only). The camera only
  applies to the dungeon canvas.
- **600 lines max per file.**
- **No game logic changes.** The camera is a rendering-layer concern.
  Game logic continues to address the 79×29 dungeon grid as always.
- **Integer scaling only** for pixel art mode. Zoom levels must produce
  whole-pixel cell sizes.
