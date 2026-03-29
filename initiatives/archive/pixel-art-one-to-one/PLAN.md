# Pixel Art One-to-One — Plan

## Approach

Two options exist (see smoke-test PLAN § "One-to-one TileType → sprite"):

- **Option A: Enlarge DisplayGlyph** — Add a new DisplayGlyph per TileType that needs a
  unique sprite; point the tile catalog and glyph/sprite maps at it. No pipeline change.
  **Use for:** a small batch of one-off unique sprites with minimal code churn.

- **Option B: Pass TileType through the pipeline** — Thread optional TileType from
  display buffer → getCellAppearance → plotChar → renderer. Renderer looks up by
  TileType when present, else by DisplayGlyph. **Use for:** full one-to-one coverage
  without enum explosion; recommended for this initiative.

We recommend **Option B** as the default so we can scale to all terrain/features without
growing the DisplayGlyph enum. Option A remains available for quick, localized fixes
(e.g. one or two new glyphs).

## Main components

1. **Display buffer**  
   Extend `CellDisplayBuffer` (in `types/types.ts`) with optional `tileType?: TileType`.
   Only set for cells whose drawn appearance comes from terrain (so the renderer can
   look up by TileType when present). `commitDraws` in `platform.ts` must include
   `tileType` in the diff and pass it to `plotChar`; the platform’s previous-frame
   buffer must also store `tileType` for correct change detection.

2. **getCellAppearance**  
   In `io/cell-appearance.ts`: return the dominant terrain TileType for the cell (the
   one that supplied `displayChar` in the tile loop). Callers that write to the display
   buffer (e.g. `refreshDungeonCell`, or any path that calls `plotCharToBuffer` /
   `plotCharWithColor` with terrain appearance) must store that TileType in the cell
   alongside the glyph.

3. **plotChar / BrogueConsole**  
   Extend the platform interface (`types/platform.ts`) and implementations so `plotChar`
   accepts an optional TileType (e.g. `plotChar(glyph, x, y, fg, bg, tileType?)`).
   Browser renderer and null platform must accept the new parameter (null platform can
   ignore it). `commitDraws` passes the stored `tileType` through when calling
   `plotChar`.

4. **plotCharToBuffer / plotCharWithColor**  
   In `io/display.ts`: extend these to accept and write optional `tileType` into the
   display buffer. All call sites that supply terrain-derived appearance need to pass
   the TileType from getCellAppearance (or equivalent).

5. **Sprite lookup**  
   In the browser renderer: for tile/hybrid mode, if `tileType` is provided, look up
   sprite by **TileType** first (e.g. `tileTypeSpriteMap.get(tileType)`); if missing or
   not terrain, fall back to **DisplayGlyph** as today. Add a second map:
   `buildTileTypeSpriteMap(): Map<TileType, SpriteRef>` (or equivalent), loaded alongside
   the glyph map. Implement in `platform/glyph-sprite-map.ts` or a sibling
   `tile-type-sprite-map.ts`.

6. **TileType → sprite map**  
   Define one sprite (e.g. `tile("Sheet", col, row)`) per TileType we want drawn
   uniquely. No new DisplayGlyph values; the catalog can keep sharing `G_LIQUID` etc.,
   and the renderer differentiates by TileType when available.

Reference: step-by-step instructions for both options are in
`initiatives/pixel-art-smoke-test/PLAN.md` under "One-to-one TileType → sprite (future work)".

## Open Questions

- None at kickoff. Resolve as implementation proceeds (e.g. whether to put TileType map
  in `glyph-sprite-map.ts` or a new file).
