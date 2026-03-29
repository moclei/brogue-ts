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
   DawnLike ships as multiple PNGs organized by category. **Catalog:** see `initiatives/pixel-art-smoke-test/CATALOG.md` for the list of sheets and mapping to Brogue glyph categories.

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

3. **Document findings.** Update `docs/pixel-art/pixel-art-exploration.md`:
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

## What to report (early playtest)

At this stage the goal is to learn what works and what doesn’t, not to file a full bug list. Useful to report:

**Worth reporting now**
- **Crashes or freezes** — anything that stops the game or makes it unplayable.
- **Wrong behaviour** — e.g. ‘G’ not switching modes, tile mode not showing sprites, hybrid mode drawing sprites for creatures/items (or text for terrain).
- **Obvious rendering bugs** — severe flicker, cells in the wrong place, canvas not updating.
- **One-line impressions** — e.g. “tiles look good but X is confusing” or “magenta placeholders are fine for now.”

**Optional / save for Phase 3**
- **Missing glyphs** — expected; we’ll expand the mapping over time. Only note if something critical (e.g. stairs, player) is missing or wrong.
- **Tinting** — Phase 3 will test lighting/tint; a quick “tinting looks OK / muddy / wrong” is enough for now.
- **Polish** — scaling crispness, performance, exact tile choices. Note if something really bothers you; otherwise we’ll do a structured pass in Phase 3.

**Where to put it**
- Quick notes: add a “Session notes” or “Playtest” subsection under this heading, or drop a short paragraph into `docs/pixel-art/pixel-art-exploration.md` when you’re ready to close the smoke test.

### Playtest feedback (2025-03)

- **Pink at top/bottom and sidebar:** Tile mode was drawing for the whole 100×34 grid. Message area and stat bar have glyphs we don’t map → magenta. **Fix:** Only use tile rendering for the dungeon viewport (window cells where `STAT_BAR_WIDTH+1 <= x < STAT_BAR_WIDTH+1+DCOLS` and `MESSAGE_LINES <= y < MESSAGE_LINES+DROWS`). Message area and sidebar now stay text.
- **Mouse hover turning cells pink:** Unmapped glyphs (e.g. path/highlight) in the viewport were drawn as magenta. **Fix:** For unmapped glyphs inside the viewport, draw the text character instead of a pink square so monsters, items, and hover path stay readable.
- **Doors/foliage/chasm/corners:** Mapping/art choices — same or similar tiles for different glyphs. To improve later by picking better (tileX, tileY) per glyph in `glyph-sprite-map.ts`.
- **G key not re-rendering until move:** After pressing G, the screen only redrew when something changed (diff-based). **Fix:** When `setGraphicsMode()` is called, set `_forceFullRedraw = true` in platform; the next `commitDraws()` redraws every cell so the new mode is visible immediately (matches C).

### Before closing the smoke test (optional checklist)

- [x] G switches mode and **entire screen** updates immediately (no need to move).
- [x] Text / Tiles / Hybrid all work; message area and sidebar stay text in every mode.
- [x] No crashes or freezes during normal play in tile or hybrid mode.
- [x] Phase 3 (tinting experiment + findings in pixel-art-exploration.md) done.

**Smoke test complete.** Tinting: `source-atop` gave flat color; `multiply` retained sprite detail and lighting; kept multiply. No blockers for Initiative 2 (one-to-one TileType). Expand glyph mapping as needed in follow-up work.

---

## One-to-one TileType → sprite (future work)

Right now many TileTypes share one DisplayGlyph (e.g. DEEP_WATER and lava both use `G_LIQUID`). To get one unique sprite per TileType you can do either of the following.

### Option A: Enlarge DisplayGlyph (simplest, no pipeline change)

1. **Add a new DisplayGlyph** in `src/types/enums.ts` for each TileType that should have a unique sprite (e.g. `G_DEEP_WATER`, `G_SHALLOW_WATER`).
2. **Map it for text/fallback** in `src/platform/glyph-map.ts`: add a `glyphToUnicode()` case (pick a character or reuse one) and ensure `isEnvironmentGlyph()` / item/creature sets still make sense.
3. **Point the tile catalog** at the new glyph: in `src/globals/tile-catalog.ts`, set that TileType’s `displayChar` to the new DisplayGlyph.
4. **Add a sprite mapping** in `src/platform/glyph-sprite-map.ts`: `tile("SheetName", col, row)` for the new DisplayGlyph.

Repeat for each TileType. Downside: DisplayGlyph grows (100+ terrain types), and any switch/lookup on DisplayGlyph must stay in sync.

### Option B: Pass TileType through the pipeline (true one-to-one, no enum explosion)

1. **Display buffer**  
   Add an optional `tileType?: TileType` (or a separate terrain buffer) to each cell. Only needed for cells where the drawn appearance comes from terrain (so the renderer can look up by TileType when present).

2. **getCellAppearance**  
   Return the dominant terrain TileType for the cell (the one that supplied `displayChar` in the tile loop). Callers that write to the display buffer (e.g. `refreshDungeonCell`) store that TileType in the cell as well as the glyph.

3. **plotChar / BrogueConsole**  
   Extend the signature to accept an optional TileType (e.g. `plotChar(glyph, x, y, fg, bg, tileType?)`). Platform’s `commitDraws()` passes the stored `tileType` through when calling `plotChar`.

4. **Sprite lookup**  
   In the browser renderer, for tile/hybrid mode: if `tileType` is provided, look up sprite by **TileType** first (e.g. `tileTypeSpriteMap.get(tileType)`); if missing or not terrain, fall back to **DisplayGlyph** as today. Add a second map: `buildTileTypeSpriteMap(): Map<TileType, SpriteRef>` and load it alongside the glyph map.

5. **TileType → sprite map**  
   In `glyph-sprite-map.ts` (or a sibling `tile-type-sprite-map.ts`), define one `tile("Sheet", col, row)` per TileType you want drawn uniquely. No need to add new DisplayGlyph values; the catalog can keep sharing `G_LIQUID` etc., and the renderer differentiates by TileType when available.

Option B is the right long-term approach for a full one-to-one TileType → sprite set without blowing up the DisplayGlyph enum. Option A is useful for a small number of one-off unique sprites with minimal code changes.

---

## Open Questions

- Does the browser renderer's `setGraphicsMode` currently do anything, or is it a stub?
- How many of the ~120 DisplayGlyphs can we reasonably map to DawnLike sprites in a
  single session? (The fallback placeholder handles the rest.)
- Does Canvas2D `drawImage` scaling from 16x16 source to arbitrary cell size produce
  acceptable pixel-art rendering, or do we need `image-rendering: pixelated` on the
  canvas?
