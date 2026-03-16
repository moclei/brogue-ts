# Pixel Art Smoke Test — Plan

## Approach

Three phases: verify the existing infrastructure, build a spritesheet renderer, then
evaluate tinting and overall viability.

The intervention point is `plotChar()` in `browser-renderer.ts`. Currently it always
draws Unicode text via `ctx2d.fillText()`. We add a branch: when `graphicsMode` is
`TILES_GRAPHICS` or `HYBRID_GRAPHICS`, draw a sprite from the DawnLike tileset instead.

### Phase 1: Verify infrastructure

Before writing rendering code, confirm the plumbing works:

1. **'G' key handler.** The C version handles `GRAPHICS_KEY` in both `IO.c` and
   `Recordings.c` to cycle `graphicsMode`. Verify the TS port's equivalent handles the
   keystroke and calls `setGraphicsMode`. If it's broken or stubbed, wire it up.
2. **`setGraphicsMode` on browser renderer.** The `BrogueConsole` interface includes
   `setGraphicsMode`. Verify the browser renderer implements it (even as a trivial
   setter). If it's a no-op, add the minimal implementation.
3. **DawnLike tileset placement.** The tileset goes in `rogue-ts/assets/tilesets/dawnlike/`.
   DawnLike ships as multiple PNGs organized by category — the key sheets are:
   - `Characters/` — player, monsters (multiple sheets by size/type)
   - `Objects/` — items, furniture, doors, stairs
   - `GUI/` — UI elements
   - `Floor.png` / `Wall.png` — terrain tiles
   Catalog what's available and identify which sheets map to Brogue's glyph categories.

### Phase 2: Spritesheet renderer

Build the rendering path:

1. **Spritesheet loader.** Load the DawnLike PNGs as `HTMLImageElement` objects at
   startup. Store them in a map keyed by sheet name. Loading is async (`new Image()`,
   `onload` promise) but happens once at init.

2. **Glyph-to-sprite mapping.** A lookup table: `DisplayGlyph → { sheet, srcX, srcY }`.
   Each entry identifies which PNG and which 16x16 region within it. Build incrementally:
   - Start with the most common glyphs: floor, wall, player, stairs, doors, a few
     monsters and items
   - Unmapped glyphs fall back to a bright placeholder (magenta square or similar) so
     they're obviously visible during playtesting
   - Expand coverage as time permits

3. **Tile-mode branch in `plotChar`.** When `graphicsMode` is `TILES_GRAPHICS`:
   - Fill the cell rectangle with the background RGB color (same as current)
   - Look up the sprite for the `DisplayGlyph`
   - If mapped: `ctx2d.drawImage(sheet, srcX, srcY, 16, 16, destX, destY, cellW, cellH)`
   - If unmapped: draw the fallback placeholder
   - No foreground color tinting in this phase — sprites render with their native colors

4. **HYBRID_GRAPHICS mode.** Use `isEnvironmentGlyph()` from `glyph-map.ts`:
   - Environment glyphs → draw sprite (same as TILES_GRAPHICS)
   - Creature / item glyphs → draw text (same as TEXT_GRAPHICS)

5. **Verify text mode.** Ensure `TEXT_GRAPHICS` still works exactly as before.

### Phase 3: Tinting and evaluation

1. **Canvas2D color tinting experiment.** Try applying Brogue's per-cell foreground RGB
   to sprites using the offscreen canvas technique:
   - Create a small offscreen canvas (16x16 or cell-sized)
   - Draw the sprite onto it
   - Set `globalCompositeOperation = 'source-atop'`
   - Fill with the foreground RGB color
   - Draw the offscreen canvas onto the main canvas at the cell position
   This effectively tints the sprite's opaque pixels with the foreground color. Evaluate
   whether the result looks acceptable for Brogue's lighting model.

2. **Playtest.** Navigate several dungeon levels in tile mode. Evaluate:
   - Is the dungeon navigable? Can you read the terrain?
   - Does the color tinting communicate lighting and darkness?
   - Are creatures and items visually distinct?
   - Are there rendering artifacts (gaps between cells, flickering, alignment issues)?
   - How does the 'G' toggle feel switching between modes?
   - Performance: any noticeable lag on full redraws?

3. **Document findings.** Update `docs/pixel-art/exploration.md`:
   - Set Initiative 1 status to `complete`
   - Add a findings paragraph covering what worked, what didn't, and what Initiative 2
     should address

## Technical Notes

- **DawnLike is multiple PNGs, not one combined sheet.** The loader needs to handle
  multiple images. Each image is a grid of 16x16 tiles. The glyph mapping references
  `{ sheet: "Floor", row: 2, col: 5 }` style coordinates.
- **`commitDraws()` is unchanged.** It diffs by `DisplayGlyph` + RGB values, agnostic
  to how cells are rendered.
- **`sizeCanvas()` is unchanged.** The sprite renderer uses the same cell dimensions as
  the text renderer. Sprites scale to fit the cell via `drawImage` destination parameters.
- **No new files in the game logic.** All changes are in the platform/renderer layer.

## Open Questions

- Does the browser renderer's `setGraphicsMode` currently do anything, or is it a stub?
- How many of the ~120 DisplayGlyphs can we reasonably map to DawnLike sprites in a
  single session? (The fallback placeholder handles the rest.)
- Does Canvas2D `drawImage` scaling from 16x16 source to arbitrary cell size produce
  acceptable pixel-art rendering, or do we need `image-rendering: pixelated` on the
  canvas?
