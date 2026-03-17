# Pixel Art One-to-One — Tasks

## Phase 1: Display buffer and types

- [ ] Add optional `tileType?: TileType` to `CellDisplayBuffer` in `types/types.ts`
- [ ] Update `commitDraws` in `platform.ts`: extend diff to include `tileType`, pass it to `plotChar`, and mirror it in the previous-frame buffer

## Phase 2: getCellAppearance and callers

- [ ] Extend `getCellAppearance` return value (or callers’ usage) so the dominant terrain TileType for the cell is available where the display buffer is written
- [ ] Identify and update call sites that write terrain-derived appearance to the display buffer so they store the TileType in the cell (e.g. `plotCharToBuffer` / `plotCharWithColor` call paths from refreshDungeonCell / cell-appearance flow)

# --- handoff point ---

## Phase 3: plotChar signature and platform

- [ ] Extend `BrogueConsole.plotChar` in `types/platform.ts` with optional `tileType?: TileType` (or equivalent)
- [ ] Update `plotCharToBuffer` and `plotCharWithColor` in `io/display.ts` to accept and write optional `tileType` to the display buffer
- [ ] Update `commitDraws` to pass stored `tileType` into `plotChar`
- [ ] Update null platform and browser renderer `plotChar` implementations to accept (and, for browser, use) optional `tileType`

## Phase 4: TileType → sprite map and renderer lookup

- [ ] Add TileType → sprite map: `buildTileTypeSpriteMap()` (or equivalent) and load it alongside the glyph map; define in `glyph-sprite-map.ts` or `tile-type-sprite-map.ts`
- [ ] In browser renderer tile/hybrid branch: if `tileType` is provided, look up sprite by TileType first; if missing or not terrain, fall back to DisplayGlyph
- [ ] Add fallback for unmapped TileTypes (e.g. use DisplayGlyph-based sprite or placeholder)

## Phase 5: Populate and verify

- [ ] Populate TileType → sprite map for a representative set of terrain/features (e.g. water variants, lava, doors, key terrain)
- [ ] Playtest in tile/hybrid mode: confirm one-to-one sprites where mapped, fallback elsewhere, no regressions in text mode
