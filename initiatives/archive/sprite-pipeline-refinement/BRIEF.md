# Sprite Pipeline Refinement

## Intent

Clean up the sprite rendering pipeline by removing inherited ASCII color
behavior that doesn't serve pixel art, adding a dedicated LIQUID render
layer, expanding the debug tooling for art exploration, and consolidating
sprite assets into a single master spritesheet. These changes make the
pipeline simpler to reason about, more capable for art development, and
properly separated from the ASCII renderer.

## Goals

- Per-layer multiply tinting (inherited from ASCII `foreColor`/`backColor`)
  is disabled for all layers except VISIBILITY (lighting). Sprites draw with
  their original PNG colors.
- Liquids have their own render layer (LIQUID), separate from surface
  decorations. Shallow water + foliage can coexist on the same cell.
- The F2 debug panel supports per-layer "deep dive" with Canvas2D parameters
  (filter, shadow, transform) for visual experimentation.
- All sprites are packed into a single master spritesheet. The sprite-assigner
  tool writes the sheet and a manifest; the game loads one image and reads
  coordinates from the manifest. `glyph-sprite-map.ts` and
  `tileset-loader.ts` are simplified accordingly.
- Shared ASCII infrastructure is documented and the sprite pipeline's
  remaining dependencies on ASCII data sources are explicitly catalogued.

## Scope

What's in:
- Disabling per-layer multiply tinting on layers 0–5 (TERRAIN through FIRE)
- Keeping VISIBILITY layer (lighting overlay) and colorDances unchanged
- Stopping `bakeTerrainColors` calls in the sprite pipeline (no visual
  effect once tinting is disabled; colorDances flag detection preserved)
- Adding `RenderLayer.LIQUID` between TERRAIN and SURFACE, routing
  `DungeonLayer.Liquid` tiles to it, updating all layer index consumers
- Debug panel "deep dive" screen: per-layer Canvas2D filter, shadow,
  imageSmoothingEnabled, and transform controls
- Master spritesheet pipeline: sprite-assigner outputs packed PNG + JSON
  manifest, `tileset-loader.ts` loads one sheet, `glyph-sprite-map.ts`
  reads manifest coordinates
- Documenting all remaining shared ASCII dependencies in
  `docs/pixel-art/sprite-layer-pipeline.md`

What's out:
- Changes to the ASCII text renderer (must remain untouched)
- New art assets or sprite authoring
- Autotile spritesheet changes (separate per-connection-group sheets stay
  as-is; the master sheet covers base sprites only)
- Animation framework (Initiative 7)
- Viewport/camera system (Initiative 6)
- Any game logic changes — all work is in the rendering pipeline

## Constraints

- **600 lines max per file.** If any modified file approaches this limit,
  split before continuing.
- **ASCII renderer untouched.** `cell-appearance.ts` and the text renderer
  must not be modified. Shared data sources (`tileCatalog`, `colors.ts`) are
  read-only from this initiative's perspective.
- **All existing tests pass.** Layer index renumbering in Phase 2 will
  require updating test assertions, but no test should be deleted.
- **Autotiling preserved.** The autotile variant map and
  `computeAdjacencyMask` must continue working after LIQUID layer insertion.
- Subsumes roadmap initiatives 9 (Liquid Layer Promotion) and 10 (Developer
  Tools Expansion) from `pixel-art-exploration.md` Section 6.
