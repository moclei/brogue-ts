# Pixel Art Variable Resolution

## Intent

Enable sprite sheets at multiple resolutions (16×16, 32×32, 48×48, 64×64) to be
registered in the sprite assigner tool, have sprites selected from them at their
native size or as multi-cell rect selections, and have the game render those
sprites correctly inside a single dungeon cell — with no changes to dungeon layout
or the logical grid.

## Goals

- A sprite sheet with a declared stride (e.g. 64px) can be registered in the
  assigner and its tiles selected individually as 64×64 source sprites.
- A sheet with 16px stride supports multi-cell rectangular selection (e.g. 2×2
  tiles → 32px output) for DisplayGlyph assignments.
- Assigned hires glyphs are composited into per-stride output atlases
  (`master-32.png`, `master-64.png`, etc.) separate from the 16px master.
- The game loads all output atlases at startup, renders each glyph from its
  correct atlas at its native source dimensions, and scales to the screen cell.
- Standard 16×16 assignments are unaffected — backward compatibility is complete.
- The HMR assigner→game live-reload path works for all atlases.

## Scope

In:
- `SpriteRef`, `SpriteManifest`, `AssignmentsData` type extensions (game side)
- `buildGlyphSpriteMap`, `buildSheetUrls` logic updates (game side)
- `SpriteRenderer` tint canvas, `drawSpriteTinted`, `precreateBitmaps` (game side)
- `tileset-manifest.json` per-sheet `stride` field (assigner registry)
- Glyph assignment type extension (`w`, `h` in tile units) (assigner state)
- `generate.ts` per-stride atlas compositing (assigner backend)
- `GridCanvas` stride-aware grid + rect selection for glyph mode (assigner UI)
- `SelectionBar` / `EnumEntry` dimension display + hires thumbnail (assigner UI)
- `ExportModal` import/export round-trip for `w`/`h` fields (assigner UI)
- Manual testing phase with user sign-off per feature

Out:
- TileType assignments at variable resolution (terrain stays 16×16 only)
- Multi-tile occupancy — creatures still occupy one dungeon cell
- Animation authoring
- Any changes to game logic, ASCII renderer, or dungeon generation
- Producing new sprite art

## Constraints

- Backward compat: existing `assignments.json` and `sprite-manifest.json` without
  `w`/`h`/`sheet` fields must parse correctly with 16×16 defaults.
- 600 lines max per file (hard rule from PROJECT.md).
- `MAX_SPRITE_SIZE = 64` is the maximum source sprite dimension for now; tint
  canvas is allocated at this size at construction, not per draw.
- Output atlas key naming convention: `master-{stride}` (e.g. `master-32`, `master-64`).
- The global `tileSize: 16` in `tileset-manifest.json` and `sprite-manifest.json`
  remains the default stride; per-sheet and per-glyph overrides layer on top.
