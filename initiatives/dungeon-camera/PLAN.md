# Dungeon Camera — Plan

## Approach

Five phases, building on the completed `ui-extraction` initiative
(canvas is dungeon-only):

1. **Core camera** — `DungeonCamera` state, coordinate transforms,
   modified draw path, mouse remapping.
2. **Interaction** — zoom controls, map panning, snap-to-player.
3. **Targeting integration** — auto-zoom-to-fit during targeting mode.
4. **Minimap** — small overview overlay showing the full explored level.
5. **Off-screen indicators** — sidebar hover → pan, directional arrows.

---

## Architecture

### DungeonCamera

A lightweight state object, not a class — kept in the platform layer.

```typescript
interface DungeonCamera {
  centerX: number;      // camera center in dungeon cell coords (0–78)
  centerY: number;      // camera center in dungeon cell coords (0–28)
  zoom: number;         // zoom multiplier: 1, 2, or 3
  viewportCols: number; // computed: how many dungeon cols visible at this zoom
  viewportRows: number; // computed: how many dungeon rows visible at this zoom
}
```

**Coordinate transforms:**
- `visibleRect(camera)` → `{ left, top, right, bottom }` — which
  dungeon cells are visible, after edge clamping.
- `dungeonToScreen(camera, cellX, cellY)` → `{ px, py, size }` —
  where to draw a dungeon cell on the canvas.
- `screenToDungeon(camera, px, py)` → `{ cellX, cellY }` — reverse
  map a canvas pixel to a dungeon cell (for mouse events).

**Edge clamping algorithm:**
1. Compute ideal viewport rectangle centered on `(centerX, centerY)`.
2. If the rectangle extends past dungeon bounds (0,0)→(DCOLS,DROWS),
   shift it inward so all visible cells are valid.
3. This means the player appears off-center when near edges, and the
   viewport always shows valid map.

### Modified Draw Path

Currently, `plotChar(col, row, ...)` in `browser-renderer.ts` draws
every cell in the 100×34 grid. After `ui-extraction`, the canvas only
has dungeon cells.

With the camera:
1. On each frame / `commitDraws`, determine `visibleRect(camera)`.
2. For each dungeon cell in the visible rect, compute its screen
   position via `dungeonToScreen`.
3. Draw the cell at the zoomed size.
4. Cells outside the visible rect are not drawn (performance win at
   high zoom).

### Dirty Checking

The existing `commitDraws` in `platform.ts` compares each cell against
`_prevBuffer` and only redraws dirty cells. When the camera pans, every
visible cell changes screen position even if content didn't change.

Solution: add a `_forceDungeonRedraw` flag (distinct from the existing
`_forceFullRedraw`). Set it whenever the camera position or zoom
changes. When set, all visible dungeon cells are redrawn. This avoids
unnecessarily redrawing non-dungeon elements (relevant if any buffer
cells still exist post-extraction).

### Mouse Coordinate Mapping

Canvas mouse events currently use `pixelToCell(px, py)` to get a grid
cell. With the camera, this becomes:
1. `pixelToCell(px, py)` → canvas cell position.
2. `screenToDungeon(camera, px, py)` → dungeon cell position.
3. If the dungeon cell is outside valid bounds, ignore the event.

The game logic receives dungeon coordinates, not screen coordinates.

---

## Technical Notes

### Integer Scaling

At zoom level Z, each dungeon cell is drawn at `baseSize * Z` pixels.
For pixel art with 16×16 native sprites, the effective rendering sizes
are:
- 1x: baseSize pixels (whatever fits 79 cols in the canvas width)
- 2x: 2 × baseSize
- 3x: 3 × baseSize

The canvas should be sized so `baseSize` itself is an integer. The
`image-rendering: pixelated` CSS property on the canvas ensures
nearest-neighbor scaling.

### Targeting Mode

`chooseTarget` / `moveCursor` draws a targeting trajectory
(`hiliteTrajectory`) from the player to the cursor. At high zoom, the
target or trajectory cells may be off-screen.

Proposed solution: **auto-zoom-to-fit** during targeting. When
targeting mode activates, temporarily adjust the camera zoom to the
minimum level that shows both the player and the farthest reachable
cell in the targeting range. When targeting ends, restore the previous
zoom level.

If the targeting range is very short (adjacent cells), the camera can
stay at the player's zoom level.

### Map Panning

When the player pans the camera away from the player (to look around):
- The camera center moves independently of the player position.
- Any player action (movement, attack, wait) snaps the camera back to
  the player.
- A dedicated key (Home or Space) also snaps back.
- Panning can be done via: mouse near dungeon viewport edge (edge-
  scroll), or click-drag on the dungeon canvas.

### Minimap

A small canvas or DOM element overlaid on the dungeon canvas corner.
Renders the full explored map at ~2–3 pixels per cell. Shows:
- Explored tiles (dimmed), visible tiles (bright)
- Player position (white dot)
- Entities in line of sight (colored dots)
- Camera viewport rectangle (outlined box)

Click-on-minimap pans the camera to that location. Toggle visibility
with a key (M) or settings.

---

## Open Questions

- **Zoom level persistence:** Store per-mode zoom preference in
  localStorage. Reset camera position per level (always re-center on
  player at level start).
- **Auto-explore + camera:** During auto-explore, the camera should
  follow the player each step. Verify this works naturally (each
  movement triggers a re-center).
- **Level transition:** When descending stairs, the camera resets to
  center on the new player position. The level-gen + full redraw should
  handle this naturally.
- **Exact zoom steps:** Start with 1x, 2x, 3x. If playtesting shows
  intermediate levels are needed (1.5x), consider adding them for
  ASCII mode only (where integer pixel scaling is less critical).
