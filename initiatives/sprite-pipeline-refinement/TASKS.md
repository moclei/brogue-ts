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

- [ ] In `render-layers.ts`:
  - Add `LIQUID = 1` to `RenderLayer` enum
  - Shift SURFACE to 2, ITEM to 3, ENTITY to 4, GAS to 5, FIRE to 6,
    VISIBILITY to 7, STATUS to 8, BOLT to 9, UI to 10
  - Bump `RENDER_LAYER_COUNT` from 10 to 11
  - Update `LAYER_NAMES` if it exists in this file (check — it may be in
    `sprite-debug.ts`)
- [ ] In `sprite-debug.ts`:
  - Add "LIQUID" to `LAYER_NAMES` at index 1
  - Verify all panel UI works with 11 layers
- [ ] In `sprite-appearance.ts`:
  - Route `DungeonLayer.Liquid` tiles to `RenderLayer.LIQUID` instead of
    `RenderLayer.SURFACE`
  - Remove the `drawPriority` contest logic (liquids and decorations no
    longer compete for the same layer)
  - Move `isShallowLiquid` alpha (0.55) to the LIQUID layer entry
  - Move autotile `computeAdjacencyMask` for liquid tiles to the LIQUID
    layer entry
- [ ] In `sprite-renderer.ts`:
  - Verify the generic layer loop handles 11 layers (it should — it uses
    `RENDER_LAYER_COUNT`)
  - Update the `skipTint` range if needed (now `i !== RenderLayer.VISIBILITY`
    where VISIBILITY is 7, not 6)
- [ ] Update all test files with hardcoded layer indices:
  - Search for `RenderLayer.` references and numeric layer indices
  - Update assertions for the new numbering
- [ ] Update `docs/pixel-art/sprite-layer-pipeline.md`:
  - Add Layer 1: LIQUID section
  - Renumber Layer 2: SURFACE through Layer 7: VISIBILITY
  - Remove the "Future: LIQUID Layer" section (now implemented)
  - Update the Summary table
- [ ] Browser smoke test: find a cell with both shallow water and foliage
  (or place one via debug). Confirm both render — water underneath, foliage
  on top.
- [ ] Run full test suite — all tests pass

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
