# Isometric Rendering Feasibility

> Last verified: 2026-03-24 | Commit: 3a5e011

## Summary

An analysis of what it would take to add an isometric rendering mode to the
BrogueCE TypeScript port. Isometric projection transforms the top-down grid
into a diamond-shaped view where tiles appear at a ~30° angle, giving a
pseudo-3D appearance. The core finding is that the game logic and data
structures are completely projection-agnostic — isometric rendering is a
renderer-level concern — but it introduces meaningful complexity in draw
ordering, input mapping, and viewport management, plus a total art asset redo.

## Key Files

| File | Responsibility | Impact |
|------|----------------|--------|
| `rogue-ts/src/platform/sprite-renderer.ts` | `SpriteRenderer` — draws sprites to canvas | Primary modification target: coordinate projection, draw order |
| `rogue-ts/src/platform/browser-renderer.ts` | `BrowserConsole` — plotChar dispatch, input handling | Mouse-to-grid reverse projection |
| `rogue-ts/src/platform/cell-sprite-data.ts` | `getCellSpriteData()` — layer compositing pipeline | Unaffected — cell data is projection-independent |
| `rogue-ts/src/platform/autotile.ts` | `computeAdjacencyMask()` — 8-bit blob bitmask | Algorithm unchanged; iso tile art has different shapes |
| `rogue-ts/src/platform/glyph-sprite-map.ts` | Sprite lookup tables | New iso sprite mappings needed |
| `rogue-ts/src/platform/tileset-loader.ts` | Tileset loading | Load iso-format spritesheets |
| `rogue-ts/src/core.ts` | Game state globals (pmap, tmap, etc.) | Unaffected |
| `rogue-ts/src/grid/grid.ts` | Grid allocation and manipulation | Unaffected |

## Coordinate Projection

### Top-down (current)

```
screenX = gridX * cellWidth
screenY = gridY * cellHeight
```

Each cell occupies a rectangle. No overlap between cells.

### Isometric

```
screenX = (gridX - gridY) * (tileWidth / 2) + offsetX
screenY = (gridX + gridY) * (tileHeight / 2) + offsetY
```

Each cell occupies a diamond (rhombus). Adjacent cells overlap vertically,
requiring back-to-front draw ordering.

### Reverse projection (screen → grid, for mouse input)

```
gridX = floor((screenX / halfWidth + screenY / halfHeight) / 2)
gridY = floor((screenY / halfHeight - screenX / halfWidth) / 2)
```

Sub-cell precision requires checking which half of the bounding rectangle the
point falls in (diamond hit-test).

## Impact Analysis

### Zero impact — game logic is projection-agnostic

These systems operate entirely in grid coordinates and have no knowledge of how
cells are rendered on screen:

- **Grid system** — `pmap[x][y]`, `tmap[x][y]`, auxiliary `number[][]` grids
- **Dungeon generation** — `Architect`, room/corridor/lake carving
- **Pathfinding** — Dijkstra scanning, safety maps, scent maps
- **AI** — monster movement, targeting, fleeing
- **Combat** — hit resolution, damage, status effects
- **Lighting** — `paintLight()`, `updateLighting()`, `tmap.light` accumulation
- **Field of view** — `VISIBLE`/`IN_FIELD_OF_VIEW` flag computation
- **Environment** — gas dissipation, fire spread, terrain promotion
- **Layer compositing** — `getCellSpriteData()` produces per-cell layer data
  independent of projection
- **Autotile algorithm** — `computeAdjacencyMask()` reads neighbor terrain from
  `pmap`; the bitmask computation is the same regardless of projection

### Moderate impact — renderer modifications

These require changes but are bounded and well-isolated:

| Component | What changes | Complexity |
|-----------|-------------|------------|
| Cell placement | Iso projection formula replaces `x * cellW` | Low — formula swap |
| Draw order | Back-to-front diagonal iteration instead of row-major | Low — loop rewrite |
| Canvas sizing | Diamond-shaped viewport is wider/taller than rectangular | Low — geometry math |
| Mouse hit-testing | Reverse iso projection + diamond sub-cell check | Moderate — new math |
| Sidebar/message layout | Can't share the grid; must be a separate overlay panel | Moderate — layout rework |

### High impact — prerequisites and art

| Component | What changes | Complexity |
|-----------|-------------|------------|
| Viewport/camera | Iso grids don't fit on screen without scrolling; camera must follow player | High — Initiative 6 is prerequisite |
| Art assets | Every sprite redrawn in iso perspective; walls need side faces | Very high — total art redo |
| Wall autotile art | Iso walls show top face + side faces; more edge cases than top-down | High — art and template complexity |

## Draw Order

In top-down rendering, cells are drawn in simple row-major order (left-to-right,
top-to-bottom) with no visual overlap. In isometric, cells at higher grid-Y
values are visually "in front of" cells at lower grid-Y values, and cells must
be drawn back-to-front to layer correctly.

For a flat grid (no elevation — which is Brogue's case), the correct draw order
iterates by diagonal sum:

```typescript
for (let sum = 0; sum < DCOLS + DROWS - 1; sum++) {
  for (let x = Math.max(0, sum - DROWS + 1); x < Math.min(DCOLS, sum + 1); x++) {
    const y = sum - x;
    drawCell(x, y);
  }
}
```

This ensures that cells further from the camera draw first. The existing
10-layer compositing model (TERRAIN → SURFACE → ITEM → ENTITY → GAS → FIRE →
VISIBILITY → STATUS → BOLT → UI) still applies *within* each cell — layers
are drawn in the same order. The diagonal iteration only governs the order in
which *cells* are visited.

If elevation were ever added (Brogue doesn't have it), cells would need explicit
depth sorting, which is significantly more complex. For a flat grid, the
diagonal iteration is sufficient and deterministic.

## Viewport / Screen Space

### Top-down screen space

The 79×29 dungeon viewport at 16px tiles occupies 1264×464 pixels — a compact
rectangle that fits on most screens.

### Isometric screen space

The same 79×29 grid in isometric projection forms a diamond:

| Tile size | Viewport width | Viewport height | Notes |
|-----------|---------------|-----------------|-------|
| 32×16 (2:1 standard iso) | (79+29) × 16 = 1728px | (79+29) × 8 = 864px | Minimum viable iso tile |
| 64×32 | 3456px | 1728px | Typical iso game size |
| 48×24 | 2592px | 1296px | Compromise size |

At any reasonable tile size, the isometric viewport exceeds typical screen
dimensions. A scrolling camera centered on the player is **required**, not
optional. This is equivalent to Initiative 6 (Viewport / Camera System) in the
pixel art roadmap.

The sidebar (columns 80–99 in the current grid) cannot exist as part of the
isometric grid — it must be rendered as a floating panel or fixed frame outside
the scrolling viewport.

## Autotiling Differences

The 8-bit blob algorithm (47 variants) works identically in isometric — the
bitmask computation reads grid neighbors, not screen neighbors. However, the
*art* for each variant changes significantly:

- **Top-down wall tiles** show a 2D outline (edges, corners, T-junctions)
- **Isometric wall tiles** show a 3D form: top face + visible side faces. A
  wall with a south-facing edge needs a front-face surface drawn. Corner tiles
  show two side faces meeting.
- **Floor tiles** change from squares to diamonds
- **Liquid tiles** change shape and may need surface reflection effects at the
  isometric angle

The variant count (47) stays the same, but each variant requires more artistic
detail due to the visible vertical dimension.

## Architecture Approach

The cleanest implementation path leverages the existing `Renderer` interface:

```
TextRenderer      — ASCII glyphs (current)
SpriteRenderer    — top-down pixel art sprites (current)
IsoSpriteRenderer — isometric pixel art sprites (new)
```

`IsoSpriteRenderer` would share the layer compositing pipeline
(`getCellSpriteData()`) and tinting model with `SpriteRenderer`. The
differences are:

1. **Cell-to-screen projection** — iso formula instead of rectilinear
2. **Draw iteration order** — diagonal back-to-front instead of row-major
3. **Tile dimensions** — iso tiles are typically 2:1 ratio (e.g., 64×32)
4. **Sprite lookup tables** — point to iso-format spritesheet regions
5. **Canvas sizing** — diamond-shaped viewport geometry

The G-key mode switcher would cycle Text → Tiles → Iso (or offer a settings
menu).

### Prerequisite: Initiative 6 (Viewport / Camera)

A scrolling viewport with camera-follow is effectively required for isometric
mode but is also independently useful for top-down pixel art (the
"looks-too-small" problem). Solving Initiative 6 first provides the foundation
for both.

## Feasibility Verdict

| Dimension | Feasibility | Notes |
|-----------|-------------|-------|
| Game logic changes | **None required** | Grid system is projection-agnostic |
| Data structure changes | **None required** | pmap, tmap, layers, flags all unchanged |
| Renderer code | **New implementation, bounded scope** | ~500–800 lines for IsoSpriteRenderer |
| Input handling | **Moderate rework** | Reverse iso projection for mouse, ~100 lines |
| Viewport/camera | **Required prerequisite** | Initiative 6 — significant but independently useful |
| Layer compositing | **Reusable as-is** | getCellSpriteData() is projection-independent |
| Autotile algorithm | **Reusable as-is** | Same bitmask math, different tile art |
| Art assets | **Total redo** | Every sprite redrawn in iso; walls much more complex |
| Sidebar/messages | **Layout rework** | Separate panel instead of grid columns |
| Estimated code effort | **Moderate** | ~1500–2500 lines net new code (excluding viewport) |
| Estimated art effort | **Very high** | 200+ sprites × iso perspective, wall autotiles with side faces |

**Bottom line:** Isometric rendering is feasible without engine changes. The
game logic layer is completely unaffected. The rendering layer needs a new
`Renderer` implementation with iso projection, Z-sorted draw order, and reverse
projection for input — all bounded, well-understood problems. The viewport/
camera system (Initiative 6) is a prerequisite. The dominant cost is art — every
sprite must be redrawn in isometric perspective, and wall tiles become
significantly more complex due to visible side faces. The code changes are
an initiative-sized effort; the art is a project-sized effort.

## Constraints & Invariants

1. **No elevation in Brogue.** The dungeon is a flat 2D grid. This simplifies
   isometric rendering enormously — no need for depth sorting beyond the simple
   diagonal iteration order, no multi-level tile stacking, no height-based
   occlusion.

2. **Grid dimensions are fixed.** DCOLS=79, DROWS=29. The iso projection of
   this grid has a fixed diamond shape. No dynamic grid resizing needed.

3. **Turn-based rendering.** No frame-rate pressure. The iso projection math
   and Z-sorted draw order add negligible cost per frame.

4. **Sidebar is text.** The sidebar and message area remain text regardless of
   dungeon projection. They must be laid out independently of the iso viewport.

5. **Autotile bitmasks are projection-independent.** The 8-bit blob algorithm
   reads grid neighbors via `coordinatesAreInMap()` and `pmap` lookups. Screen
   projection doesn't affect neighbor adjacency.

## Modification Notes

- **Start with Initiative 6 (Viewport/Camera).** Isometric without scrolling
  is unusable. The viewport system benefits top-down mode too, so it's not
  wasted work even if isometric is never pursued.

- **Prototype with colored rectangles first.** Before investing in iso art,
  validate the projection math, draw order, and input handling by drawing
  colored diamonds at iso-projected coordinates. This proves the renderer works
  before any art exists.

- **Wall rendering is the hardest art problem.** Top-down walls are 2D shapes
  with edge variants. Iso walls are 3D forms with top faces, side faces, and
  complex corner geometry. The 47-variant autotile template for iso walls is
  significantly harder to author than the top-down equivalent.

- **Consider "3/4 view" as an alternative to true isometric.** Many pixel art
  games (Stardew Valley, Pokémon, Zelda: Link to the Past) use an oblique
  top-down view that keeps square tiles but draws walls/objects with visible
  front faces. This is visually richer than flat top-down but avoids the
  diamond-tile complications of true isometric. It works with the existing
  rectilinear renderer — no projection changes needed, only art style changes.

- **The `commitDraws()` diff system still works.** It diffs a flat 100×34 cell
  array. The cells haven't changed — only where they're drawn on screen. The
  dirty-cell tracking remains valid.
