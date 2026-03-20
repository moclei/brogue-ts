# Pixel Art Renderer Refactor — Plan

## Approach

The refactor extracts rendering logic from `browser-renderer.ts` into a
`Renderer` interface with two implementations (`TextRenderer`,
`SpriteRenderer`), leaving the console as shared infrastructure. The work is
sequenced so that rendering stays functional after every phase — each phase
can be committed and tested independently.

### Current architecture

```
bootstrap.ts
  └── createBrowserConsole(options)   ← 689 lines, all-in-one
        ├── cell sizing (recalcCellSize)
        ├── event queue + DOM listeners
        ├── pixelToCell coordinate mapping
        ├── plotChar()
        │     ├── text path: fillText()
        │     └── tile/hybrid path:
        │           ├── sprite lookup (tileTypeSpriteMap → spriteMap)
        │           ├── drawSpriteTinted (closure, tintCanvas + multiply + destination-in)
        │           ├── underlyingTerrain: terrain sprite then creature sprite
        │           ├── foreground tile: background sprite then foreground sprite
        │           └── unmapped glyph: fillText() fallback
        └── setGraphicsMode()
```

### Target architecture

```
bootstrap.ts
  ├── loadTilesetImages() → tiles
  ├── new TextRenderer(ctx2d, fontFamily)
  ├── new SpriteRenderer(ctx2d, tiles, spriteMap, tileTypeSpriteMap, textRenderer)
  └── createBrowserConsole(canvas, textRenderer, spriteRenderer?)
        ├── cell sizing (progressive integer-division)
        ├── event queue + DOM listeners
        ├── pixelToCell coordinate mapping
        └── plotChar()
              └── delegates to activeRenderer.drawCell(...)

platform/
  renderer.ts           — Renderer interface, CellRect type         (~40 lines)
  text-renderer.ts      — TextRenderer implements Renderer           (~80 lines)
  sprite-renderer.ts    — SpriteRenderer implements Renderer         (~200 lines)
  browser-renderer.ts   — console: events, sizing, plotChar delegate (~350 lines)
  glyph-sprite-map.ts   — sprite map data (unchanged, consumed by SpriteRenderer)
  tileset-loader.ts     — tileset loading (unchanged)
  glyph-map.ts          — glyph-to-unicode + isEnvironmentGlyph (unchanged)
```

### Renderer interface

```typescript
interface CellRect {
  x: number;      // pixel X of cell left edge
  y: number;      // pixel Y of cell top edge
  width: number;  // pixel width (may vary by column with progressive sizing)
  height: number; // pixel height (may vary by row with progressive sizing)
}

interface Renderer {
  drawCell(
    cellRect: CellRect,
    glyph: DisplayGlyph,
    fgR: number, fgG: number, fgB: number,  // 0-255
    bgR: number, bgG: number, bgB: number,  // 0-255
    tileType?: TileType,
    underlyingTerrain?: TileType,
  ): void;
}
```

Passing `CellRect` instead of `(x, y, cellWidth, cellHeight)` makes each
renderer agnostic to cell sizing — the console computes the rect per cell
(using progressive integer-division) and hands it off.

The fg/bg colors are 0-255 (already converted from 0-100 by the console).
This matches the current conversion in `plotChar` and avoids each renderer
repeating the scale.

### What moves where

| From | To | What |
|------|----|------|
| `plotChar` text path | `TextRenderer.drawCell` | `fillText`, font setup, baseline calc |
| `plotChar` tile path | `SpriteRenderer.drawCell` | Sprite lookup, drawSpriteTinted, layer logic |
| `drawSpriteTinted` closure | `SpriteRenderer` private method | tintCanvas, multiply, destination-in |
| `tintCanvas` creation | `SpriteRenderer` constructor | 16×16 offscreen canvas |
| `isInDungeonViewport` | stays in console | Used by plotChar to choose renderer |
| `isEnvironmentGlyph` check | stays in console (plotChar) | Hybrid mode glyph routing |
| `recalcCellSize` | stays in console, refactored | Progressive integer-division |
| `pixelToCell` | stays in console, updated | Uses progressive cell edges |
| Event queue, DOM handlers | stay in console | Unchanged |
| Debug flags | `SpriteRenderer` | `DEBUG_LAYERED_DRAW`, `DEBUG_SHOW_TERRAIN_UNDER_CREATURE`, `DEBUG_SKIP_TILE_CELL_BACK_FILL` |
| `TILE_SIZE`, tileset loading | stay in `tileset-loader.ts` | Unchanged |
| Sprite map builders | stay in `glyph-sprite-map.ts` | Unchanged |
| `getBackgroundTileType` | stays in `glyph-sprite-map.ts` | Consumed by SpriteRenderer |

### plotChar delegation logic

After refactor, `plotChar` in browser-renderer.ts is a thin dispatcher:

```typescript
plotChar(glyph, x, y, fr, fg, fb, br, bg, bb, tileType?, underlyingTerrain?) {
  const cellRect = getCellRect(x, y);

  // Background fill — always done by the console (both renderers need it)
  const useTiles = spriteRenderer
    && isInDungeonViewport(x, y)
    && (mode === Tiles || (mode === Hybrid && isEnvironmentGlyph(glyph)));

  if (useTiles) {
    spriteRenderer.drawCell(cellRect, glyph, fr, fg, fb, br, bg, bb, tileType, underlyingTerrain);
  } else {
    textRenderer.drawCell(cellRect, glyph, fr, fg, fb, br, bg, bb);
  }
}
```

### SpriteRenderer internals

SpriteRenderer receives a TextRenderer reference for unmapped-glyph fallback
(currently: `plotChar`'s else branch inside the tile path draws `fillText`
for glyphs with no sprite mapping).

```
SpriteRenderer.drawCell(cellRect, glyph, fg, bg, tileType, underlyingTerrain)
  1. resolveSprite(tileType, glyph) → SpriteRef | undefined
  2. if no sprite: textRenderer.drawCell(cellRect, glyph, fg, bg) — fallback
  3. background fill (bgR, bgG, bgB)
  4. if underlyingTerrain: drawSpriteTinted(terrainSprite, fg) — terrain under mob
  5. if foreground tile (getBackgroundTileType): drawSpriteTinted(bgSprite, fg)
  6. drawSpriteTinted(sprite, fg) — main/foreground sprite
```

### Progressive integer-division cell sizing

From tiles.c Section 3.1C. Eliminates sub-pixel gaps without requiring all
cells to be the same size.

```typescript
function cellLeft(col: number, canvasWidth: number, cols: number): number {
  return Math.floor(col * canvasWidth / cols);
}
function cellTop(row: number, canvasHeight: number, rows: number): number {
  return Math.floor(row * canvasHeight / rows);
}
function getCellRect(x: number, y: number): CellRect {
  const left = cellLeft(x, cssWidth, COLS);
  const top = cellTop(y, cssHeight, ROWS);
  return {
    x: left,
    y: top,
    width: cellLeft(x + 1, cssWidth, COLS) - left,
    height: cellTop(y + 1, cssHeight, ROWS) - top,
  };
}
```

`pixelToCell` is updated to use the inverse: binary search or linear scan
on cell edges. With only 100 columns, a linear scan is fine.

### Background fill ownership

Currently `plotChar` fills the background before drawing text or sprites.
After refactor, each renderer handles its own background fill:

- **TextRenderer:** fills cell rect with bg color, then draws text
- **SpriteRenderer:** fills cell rect with bg color (unless
  `DEBUG_SKIP_TILE_CELL_BACK_FILL`), then draws sprites

This keeps each renderer self-contained and avoids the console needing to
know about debug flags. The console's plotChar does no drawing itself — it
only dispatches.

## Technical Notes

### bootstrap.ts changes

Currently bootstrap creates the console with `tiles`, `spriteMap`, and
`tileTypeSpriteMap` in the options bag. After refactor:

1. Load tileset images (unchanged)
2. Build sprite maps (unchanged)
3. Create `TextRenderer` (needs canvas 2d context + font config)
4. Create `SpriteRenderer` (needs canvas 2d context + tiles + sprite maps + TextRenderer)
5. Create browser console (needs canvas + TextRenderer + SpriteRenderer)

The canvas 2d context is created by the console (since it owns the canvas).
This creates a dependency: renderers need the context, but the console creates
it. Resolution: the console creates the context and passes it to the renderers,
or the renderers accept the context in their constructor.

Chosen approach: renderers accept `CanvasRenderingContext2D` in their
constructor. The console creates the context, then creates the renderers,
then wires them in. This avoids circular dependencies and is easy to test
(pass a mock context).

Alternative: extract context creation into a helper, pass to both console
and renderers. Not needed — the console can pass its context to the renderers.

### BrogueConsole interface

The `BrogueConsole` interface in `types/platform.ts` defines `plotChar`.
This interface is unchanged — `plotChar` still exists on the console, it
just delegates internally. External callers (commitDraws in platform.ts)
see no change.

### DPR scaling

Currently `recalcCellSize` applies DPR scaling via
`ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)`. After refactor, the
progressive cell sizing computes cell rects in CSS-pixel coordinates
(matching the current approach). The DPR transform on the context means all
drawing operations use CSS-pixel coordinates — this is transparent to both
renderers.

### Font sizing

Currently `fontSize` is computed from `cellWidth`/`cellHeight` (uniform).
With progressive sizing, cells may be 1px wider or taller in some columns/rows.
Font size should be based on the base cell size (minimum cell dimension), not
on a specific cell. This ensures text doesn't overflow narrower cells.

```typescript
const baseCellWidth = Math.floor(cssWidth / COLS);
const baseCellHeight = Math.floor(cssHeight / ROWS);
fontSize = Math.max(1, Math.floor(Math.min(baseCellWidth, baseCellHeight)));
```

### Testing strategy

- **Cell sizing math**: pure functions, easy to unit test. Verify that
  `cellLeft(0) + cellLeft(1) + ... + cellLeft(COLS-1)` covers the full width
  with no gaps.
- **Renderer interface contract**: test that TextRenderer and SpriteRenderer
  both implement the interface (TypeScript enforces this at compile time).
- **Sprite lookup**: test `resolveSprite` chain: tileType → spriteMap →
  undefined (fallback to text).
- **Mode switching**: test that setGraphicsMode changes the active renderer.
- **Integration**: the existing game tests exercise commitDraws → plotChar.
  If all tests pass, rendering is correct.
- **Manual**: playtest text/tile/hybrid modes with G-key cycling.

Canvas2D drawing (fillText, drawImage, fillRect) can't be easily unit-tested
without a DOM. Tests focus on the logic (lookup, sizing, delegation) rather
than pixel output. Browser-based integration tests (manual) verify visual
correctness.

## Open Questions

_(none — all design decisions resolved in pixel-art-exploration.md Section 3.S
and this PLAN)_

## Rejected Approaches

_(none yet)_
