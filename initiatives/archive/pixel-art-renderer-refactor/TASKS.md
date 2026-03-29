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

- [x] Create `SpriteRenderer` in `platform/sprite-renderer.ts` — 195 lines.
  Extracts resolveSprite, drawSpriteTinted, drawCell with two-layer logic,
  debug flags. Constructor: ctx, tiles, spriteMap, tileTypeSpriteMap, textRenderer.
- [x] Test: `sprite-renderer.test.ts` — 11 tests: resolveSprite lookup chain
  (tileType → spriteMap → undefined), drawCell fallback, background fill,
  tint compositing, two-layer draw, foreground overlay.
- [x] Wire SpriteRenderer into `browser-renderer.ts` — plotChar is now a thin
  dispatcher (viewport + mode check → spriteRenderer.drawCell or
  textRenderer.drawCell). Removed 140 lines of inline tile code. File: 545 lines.

# --- handoff point ---

## Phase 3: Console Cleanup

- [x] Slim `browser-renderer.ts`: plotChar is now a thin dispatcher (viewport
  check + mode check → delegate to renderer). Remove all inline drawing code
  (fillText, drawImage, drawSpriteTinted, tintCanvas creation). The file
  should contain only: event queue, DOM handlers, cell sizing, pixelToCell,
  plotChar dispatcher, setGraphicsMode, and the console object. Verify file
  is under 600 lines. _(Audit 2025-03-20: no inline drawing in file; ~546 lines;
  no dead imports/helpers to remove.)_
- [x] Update `bootstrap.ts`: simplify init — canvas 2d context created first,
  then TextRenderer, then SpriteRenderer (if tiles loaded), then
  createBrowserConsole receives the renderers. Remove `tiles`, `spriteMap`,
  `tileTypeSpriteMap` from BrowserRendererOptions (they go to SpriteRenderer).
- [x] Update `BrowserRendererOptions` type: remove tile-related fields
  (`tiles`, `spriteMap`, `tileTypeSpriteMap`). Add `textRenderer` and optional
  `spriteRenderer`. This is a breaking change to the options type but the only
  caller is bootstrap.ts.
- [x] Test: mode switching — verify setGraphicsMode(Tiles) uses SpriteRenderer,
  setGraphicsMode(Text) uses TextRenderer, setGraphicsMode(Hybrid) uses
  SpriteRenderer for environment glyphs and TextRenderer for items/creatures.
  _(8 tests in browser-renderer-mode.test.ts)_
- [x] Verify: all existing tests pass. Manual check: G-key cycling works,
  all three modes render correctly. _(91 files, 2351 pass, 55 skip — 0 failures)_

# --- handoff point ---

## Phase 4: Progressive Cell Sizing

- [x] Implement progressive integer-division cell sizing in
  `browser-renderer.ts`. Replace uniform `cellWidth`/`cellHeight` with
  exported pure functions `cellLeftEdge()`, `cellTopEdge()`, `cellRect()`,
  `pixelToCellCoord()`. Console closures delegate to these. Formula:
  `cellLeft(x) = floor(x * cssWidth / COLS)`,
  `cellWidth(x) = cellLeft(x+1) - cellLeft(x)`.
- [x] Update `pixelToCell` to work with variable-width cells. Linear scan
  over `cellLeftEdge(0..COLS)` to find which column a pixel lands in (100 cols
  is negligible cost). Delegates to exported `pixelToCellCoord()`.
- [x] Update font size computation: base on `floor(cssWidth / COLS)` (minimum
  cell width) instead of exact cellWidth, so text doesn't overflow narrower
  cells.
- [x] Test: `cell-sizing.test.ts` — 25 tests covering:
  (a) `cellLeftEdge(0) == 0` and `cellLeftEdge(COLS) == cssWidth` (full coverage);
  (b) all cell widths are `floor(cssWidth/COLS)` or `floor(cssWidth/COLS)+1`;
  (c) `pixelToCellCoord` maps first/last pixel of each cell correctly;
  (d) non-divisible canvas widths (1593, 1001, 800, 1920, etc.);
  (e) gap-free tiling, edge clamping, negative coords.
- [x] Verify: rendering has no visible gaps between cells. Manual check in
  all three modes (text, tiles, hybrid) — no gaps observed. Gap-free tiling
  proven by unit tests for arbitrary canvas dimensions.

# --- handoff point ---

## Phase 5: Final Verification

- [x] Run full test suite. All existing tests pass, no regressions.
  _(158 files, 4640 pass, 55 skip — 0 failures)_
- [x] Manual playtest: text mode, tile mode, hybrid mode. G-key cycling.
  Sidebar and messages always render as text. No visual regressions.
- [x] Verify file line counts: `browser-renderer.ts` 566, `text-renderer.ts`
  68, `sprite-renderer.ts` 195, `renderer.ts` 47 — all under 600.
- [x] Update `docs/pixel-art/pixel-art-exploration.md` Section 6 roadmap
  table: mark Initiative 1 as complete.

## Deferred

_(nothing yet)_
