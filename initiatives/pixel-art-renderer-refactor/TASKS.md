# Pixel Art Renderer Refactor — Tasks

## Phase 1: Renderer Interface and TextRenderer

- [x] Define `Renderer` interface and `CellRect` type in `platform/renderer.ts`.
  The interface has a single `drawCell` method matching the signature in PLAN.md.
- [x] Create `TextRenderer` in `platform/text-renderer.ts`. Extract the text
  drawing logic from `plotChar`'s text path: `fillStyle`, `font`, `textBaseline`,
  `textAlign`, `fillText` centered in cell. TextRenderer also fills the cell
  background (`fillRect`) before drawing text. Receives `CanvasRenderingContext2D`,
  font family, and a `fontSize` accessor (font size changes on resize).
- [x] Test: `text-renderer.test.ts` — verify drawCell calls fillRect for
  background and fillText for visible glyphs (glyph > 0x20). Use a mock or
  spy on CanvasRenderingContext2D methods. Verify space glyph (0x20) skips
  fillText but still fills background.
- [x] Wire TextRenderer into `browser-renderer.ts`: create it after getting
  the 2d context, delegate text-mode plotChar calls to it. Verify text mode
  renders identically (manual check or existing tests).

# --- handoff point ---

## Phase 2: SpriteRenderer Extraction

- [ ] Create `SpriteRenderer` in `platform/sprite-renderer.ts`. Extract from
  `plotChar`'s tile path:
  - `resolveSprite(tileType, glyph)`: tries tileTypeSpriteMap, then spriteMap
  - `drawSpriteTinted(img, spriteRef, alpha?)`: offscreen tintCanvas, multiply
    composite, destination-in alpha restore, blit to main canvas
  - `drawCell(...)`: background fill, underlyingTerrain layer, foreground tile
    layer (getBackgroundTileType), main sprite, unmapped fallback to textRenderer
  - Debug flags: `DEBUG_LAYERED_DRAW`, `DEBUG_SHOW_TERRAIN_UNDER_CREATURE`,
    `DEBUG_SKIP_TILE_CELL_BACK_FILL`
  Constructor receives: `CanvasRenderingContext2D`, `tiles` map, `spriteMap`,
  `tileTypeSpriteMap`, `TextRenderer` (for unmapped-glyph fallback).
- [ ] Test: `sprite-renderer.test.ts` — verify resolveSprite lookup chain:
  (a) tileType found in tileTypeSpriteMap; (b) falls back to spriteMap when
  tileType not mapped; (c) returns undefined when neither maps the glyph.
  Test drawCell with underlyingTerrain (verifies two-layer draw order).
- [ ] Wire SpriteRenderer into `browser-renderer.ts`: create it after
  TextRenderer (only when `tiles` option is provided), delegate tile-mode
  plotChar calls to it. Hybrid mode: use isEnvironmentGlyph + viewport check
  to pick renderer.

# --- handoff point ---

## Phase 3: Console Cleanup

- [ ] Slim `browser-renderer.ts`: plotChar is now a thin dispatcher (viewport
  check + mode check → delegate to renderer). Remove all inline drawing code
  (fillText, drawImage, drawSpriteTinted, tintCanvas creation). The file
  should contain only: event queue, DOM handlers, cell sizing, pixelToCell,
  plotChar dispatcher, setGraphicsMode, and the console object. Verify file
  is under 600 lines.
- [ ] Update `bootstrap.ts`: simplify init — canvas 2d context created first,
  then TextRenderer, then SpriteRenderer (if tiles loaded), then
  createBrowserConsole receives the renderers. Remove `tiles`, `spriteMap`,
  `tileTypeSpriteMap` from BrowserRendererOptions (they go to SpriteRenderer).
- [ ] Update `BrowserRendererOptions` type: remove tile-related fields
  (`tiles`, `spriteMap`, `tileTypeSpriteMap`). Add `textRenderer` and optional
  `spriteRenderer`. This is a breaking change to the options type but the only
  caller is bootstrap.ts.
- [ ] Test: mode switching — verify setGraphicsMode(Tiles) uses SpriteRenderer,
  setGraphicsMode(Text) uses TextRenderer, setGraphicsMode(Hybrid) uses
  SpriteRenderer for environment glyphs and TextRenderer for items/creatures.
- [ ] Verify: all existing tests pass. Manual check: G-key cycling works,
  all three modes render correctly.

# --- handoff point ---

## Phase 4: Progressive Cell Sizing

- [ ] Implement progressive integer-division cell sizing in
  `browser-renderer.ts`. Replace uniform `cellWidth`/`cellHeight` with
  `cellLeft(col)` / `cellTop(row)` / `getCellRect(x, y)` functions.
  Formula: `cellLeft(x) = floor(x * cssWidth / COLS)`,
  `cellWidth(x) = cellLeft(x+1) - cellLeft(x)`.
- [ ] Update `pixelToCell` to work with variable-width cells. Linear scan
  over `cellLeft(0..COLS)` to find which column a pixel lands in (100 cols
  is negligible cost).
- [ ] Update font size computation: base on `floor(cssWidth / COLS)` (minimum
  cell width) instead of exact cellWidth, so text doesn't overflow narrower
  cells.
- [ ] Test: `cell-sizing.test.ts` — verify:
  (a) `cellLeft(0) == 0` and `cellLeft(COLS) == cssWidth` (full coverage);
  (b) all cell widths are `floor(cssWidth/COLS)` or `floor(cssWidth/COLS)+1`;
  (c) `pixelToCell` maps the first pixel of each cell to that cell;
  (d) test with non-divisible canvas widths (e.g. 1593px for 100 cols).
- [ ] Verify: rendering has no visible gaps between cells. Manual check at
  several browser window sizes.

# --- handoff point ---

## Phase 5: Final Verification

- [ ] Run full test suite. All existing tests pass, no regressions.
- [ ] Manual playtest: text mode, tile mode, hybrid mode. G-key cycling.
  Resize window. Sidebar and messages always render as text.
- [ ] Verify file line counts: `browser-renderer.ts`, `text-renderer.ts`,
  `sprite-renderer.ts`, `renderer.ts` all under 600 lines.
- [ ] Update `docs/pixel-art/pixel-art-exploration.md` Section 6 roadmap
  table: mark Initiative 1 as complete.

## Deferred

_(nothing yet)_
