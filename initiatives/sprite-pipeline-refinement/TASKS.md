# Sprite Pipeline Refinement — Tasks

## Phase 1: Disable Multiply Tinting

- [x] In `sprite-renderer.ts`, extend the `skipTint` condition in
  `drawCellLayers()` from `i === RenderLayer.TERRAIN` to
  `i !== RenderLayer.VISIBILITY`. All layers 0–5 now draw with blend mode
  `"none"` by default (no offscreen multiply pass). Preserve the existing
  `lo?.tintOverride || lo?.blendMode` check so F2 panel overrides still work.
  Renamed `TERRAIN_NO_TINT` → `NO_TINT` (now applies to all non-VISIBILITY
  layers). Updated file header comment.
- [x] Verify that `bakeTerrainColors` calls in `sprite-appearance.ts` are
  retained (for `colorDances` flag propagation) but their visual output is
  now invisible (tint values computed but not drawn).
- [x] Update `docs/pixel-art/sprite-layer-pipeline.md`:
  - Change all layer tint descriptions from "Multiply by foreColor" to
    "Disabled (original PNG colors)"
  - Update the Summary table ⚠️ markers
  - Update the Shared ASCII Infrastructure section to reflect that tinting
    is now disabled (shared data still computed but not rendered)
- [x] Browser smoke test: load a dungeon, confirm sprites show original
  PNG colors. Confirm VISIBILITY lighting overlay still darkens cells.
  Confirm F2 per-layer tint override still works when manually enabled.
  Verified: sprites render with original PNG colors, VISIBILITY lighting
  darkens distant cells, F2 panel opens with all layer controls, no
  console errors.
- [x] Run full test suite — all tests pass (2705 pass, 55 skip, 0 fail).
  Two tests updated: non-terrain layers now also skip tint canvas.

## Phase 2: LIQUID Layer

- [x] In `render-layers.ts`:
  - Add `LIQUID = 1` to `RenderLayer` enum
  - Shift SURFACE to 2, ITEM to 3, ENTITY to 4, GAS to 5, FIRE to 6,
    VISIBILITY to 7, STATUS to 8, BOLT to 9, UI to 10
  - Bump `RENDER_LAYER_COUNT` from 10 to 11
  - `LAYER_NAMES` is in `sprite-debug.ts` (not this file)
  - Updated `isShallowLiquid` JSDoc to reference LIQUID layer
- [x] In `sprite-debug.ts`:
  - Add "LIQUID" to `LAYER_NAMES` at index 1
  - Panel UI auto-scales via `RENDER_LAYER_COUNT` — works with 11 layers
- [x] In `sprite-appearance.ts`:
  - Route `DungeonLayer.Liquid` tiles to `RenderLayer.LIQUID` instead of
    `RenderLayer.SURFACE` (both live pmap and remembered paths)
  - Remove the `drawPriority` contest logic — surface decorations always
    go to SURFACE, no guard needed
  - `isShallowLiquid` alpha (0.55) now on the LIQUID layer entry
  - Autotile `computeAdjacencyMask` for liquid tiles now on the LIQUID
    layer entry
  - Added `bakeTerrainColors` call for LIQUID layer
  - Added LIQUID to `colorDances` flag propagation
- [x] In `sprite-renderer.ts`:
  - Generic layer loop already uses `RENDER_LAYER_COUNT` — handles 11 layers
  - `skipTint` uses `i !== RenderLayer.VISIBILITY` — auto-adjusted to 7
  - Updated header comment: "layers 0–6" (was "layers 0–5")
- [x] Update all test files with hardcoded layer indices:
  - `render-layers.test.ts`: Updated enum value assertions (LIQUID=1, all
    shifted), RENDER_LAYER_COUNT=11
  - `sprite-appearance.test.ts`: Changed liquid routing from SURFACE to
    LIQUID in 5 tests; added liquid+surface coexistence test; added LIQUID
    undefined checks in empty-layer tests
  - `sprite-renderer.test.ts`: All references are symbolic — no changes needed
- [x] Update `docs/pixel-art/sprite-layer-pipeline.md`:
  - Added Layer 1: LIQUID section with tile types, parameters, autotile info
  - Renumbered Layer 2: SURFACE through Layer 7: VISIBILITY
  - Removed the "Future: LIQUID Layer" section (now implemented)
  - Updated Summary table, overview diagram, Shared ASCII Infrastructure
  - Updated Layers 8–10: Not Yet Implemented section
- [x] Browser smoke test: find a cell with both shallow water and foliage
  (or place one via debug). Confirm both render — water underneath, foliage
  on top. Verified: LIQUID layer renders beneath SURFACE, F2 panel shows
  11 layers, animated tint values visible on TERRAIN/LIQUID from
  colorDances + bakeTerrainColors (computed but not rendered — tinting
  disabled). VISIBILITY override path noted for Phase 3.
- [x] Run full test suite — all tests pass (2706 pass, 55 skip, 0 fail)

## Phase 3: Debug Panel Expansion

- [ ] Design the deep-dive panel layout (DOM structure, CSS). Clicking a
  layer name in the overview opens the deep-dive; "Back" returns.
- [ ] Add new optional fields to `LayerOverride` in `sprite-debug.ts`:
  `filterOverride`, `shadowBlur`, `shadowColor`, `shadowOffsetX`,
  `shadowOffsetY`, `imageSmoothingOverride`, `flipH`, `rotation`, `scale`
- [ ] Build the deep-dive DOM panel:
  - Filter: text input for CSS filter string (e.g. `blur(1px)`)
  - Shadow: blur slider (0–20), color picker, offset X/Y sliders (-10..10)
  - Image smoothing: checkbox
  - Flip H: checkbox
  - Rotation: slider 0–360°
  - Scale: slider 0.5–2.0
  - Reset button (clears all overrides for that layer)
- [ ] Check file size of `sprite-debug.ts`. If approaching 550 lines,
  extract the deep-dive panel builder into `sprite-debug-detail.ts`.
- [ ] In `sprite-renderer.ts`, update `drawSpriteTinted()` to apply
  deep-dive overrides:
  - `ctx.filter` before draw
  - `ctx.shadowBlur/Color/OffsetX/Y` before draw
  - `ctx.imageSmoothingEnabled` before draw
  - `ctx.translate + rotate + scale` for transform overrides
  - All wrapped in `ctx.save()` / `ctx.restore()`
- [ ] Performance check: apply `blur(1px)` to TERRAIN layer via deep-dive.
  Run `window.benchmarkRedraw(50)`. If per-cell filter adds >2ms avg
  overhead, add a warning label in the UI ("debug only — may affect
  performance").
- [ ] Update `docs/pixel-art/sprite-layer-pipeline.md` Parameters tables
  to list the new deep-dive parameters
- [ ] Browser verification: exercise each deep-dive control, confirm visual
  effect and that the game remains playable

## Phase 4: Master Spritesheet Pipeline

- [ ] Define the master spritesheet grid layout:
  - Assign a fixed grid position to every TileType (0–216) and DisplayGlyph
    (128–258)
  - Document the layout in a manifest schema
- [ ] Update the sprite-assigner tool:
  - Add "master sheet" mode: when assigning a sprite, copy the 16×16 region
    into the master sheet at the assigned grid position
  - Add "Export" button that saves the packed PNG and JSON manifest
  - Handle empty slots gracefully (transparent cell in the PNG, absent key
    in the manifest)
- [ ] Create the initial master spritesheet from current sprite assignments:
  - Run the sprite-assigner in export mode to generate the first
    `master-spritesheet.png` and `sprite-manifest.json`
  - Place them in `rogue-ts/assets/tilesets/`
- [ ] Update `tileset-loader.ts`:
  - Import single `master-spritesheet.png` instead of individual sheets
  - Keep autotile sheets as separate imports (they are per-connection-group)
  - Remove unused individual sheet imports
- [ ] Update `glyph-sprite-map.ts`:
  - Read `sprite-manifest.json` at build time (Vite JSON import)
  - Replace hardcoded coordinate mappings in `buildSpriteMap()` and
    `buildTileTypeSpriteMap()` with manifest-driven loops
  - `buildAutotileVariantMap()` unchanged (still references autotile sheets)
- [ ] Update `sprite-renderer.ts` `precreateBitmaps()`: iterate the single
  master sheet instead of multiple sheets
- [ ] Run full test suite — all tests pass
- [ ] Browser smoke test: all sprites render correctly from the master sheet
- [ ] Update `docs/pixel-art/sprite-layer-pipeline.md` Key Files section
