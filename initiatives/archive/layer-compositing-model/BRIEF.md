# Layer Compositing Model

## Intent

Replace the ad-hoc two-layer rendering logic in `SpriteRenderer.drawCell()`
with a general layer compositing pipeline. Build a parallel sprite data path
(`getCellSpriteData`) that reads game world state directly from `pmap`,
producing per-layer sprite data with per-layer tint colors. Extract shared
cell-query functions from `getCellAppearance` so both the ASCII and sprite
paths use identical logic for visibility, creature lookup, and color
computation — preventing maintenance drift between the two rendering
pipelines.

## Goals

- Shared cell-query functions extracted from `getCellAppearance` — visibility
  classification, creature/item lookup — reused by both rendering paths
- A `CellQueryContext` interface bundling all shared closure captures
  (pmap, tmap, tileCatalog, etc.) so both `getCellAppearance` and
  `getCellSpriteData` take the same context object — making the coupling
  explicit and testable
- A `RenderLayer` enum and `LayerEntry` interface defining the compositing
  stack, with each entry carrying separate optional `tileType` and `glyph`
  fields (not a union — avoids runtime ambiguity between number enums)
- A `CellSpriteData` interface using a sparse `(LayerEntry | undefined)[]`
  array indexed by `RenderLayer` for extensible per-layer data with minimal
  allocation overhead
- A `getCellSpriteData()` function that reads pmap, creatures, items, and
  visibility to produce layered sprite data with per-layer tint colors —
  parallel to `getCellAppearance()`
- A compositing pipeline in `SpriteRenderer` that draws layers in order with
  per-layer multiply tinting via the existing offscreen canvas approach
- `Pcell.rememberedLayers` field (indexed by `DungeonLayer`, 4 entries) so
  remembered cells use stale terrain data (not live pmap), preventing
  gameplay information leaks
- Per-layer tint colors faithful to `getCellAppearance`'s color pipeline:
  base tileCatalog colors × lighting × terrain randomization
  (`bakeTerrainColors`), with a documented color fidelity matrix listing
  each post-processing effect's sprite-mode treatment
- Visibility-state tinting for all states: remembered (multiply composite
  with `memoryColor` for faithful blue-tinted dimming),
  clairvoyant/telepathic/magic-mapped/omniscience (multiply composite) —
  using Canvas2D `multiply` blend mode per state for visual fidelity
- Hallucination support (randomized glyphs AND per-layer color
  randomization), gas volume-based alpha, fire as a dedicated layer,
  deep-water whole-screen tint, invisible-monster-in-gas silhouette
- All surface, gas, and fire TileTypes with sprite mappings
- Removal of prototype code, `underlyingTerrain`, and hybrid graphics mode
  from the display pipeline
- Text mode completely unchanged — zero risk to ASCII rendering

## Scope

What's in:
- Shared cell-query extraction from `getCellAppearance` (refactor, no
  behavior change)
- `CellQueryContext` interface bundling shared closure captures for both
  rendering paths
- `snapshotCellMemory` function: stores rememberedAppearance AND
  rememberedLayers at the STABLE_MEMORY transition point
- `RenderLayer` enum, `LayerEntry` + `CellSpriteData` interfaces, TileType
  classification functions
- `Pcell.rememberedLayers` field for sprite-mode remembered cells
- `getCellSpriteData()` — parallel data path reading pmap directly
- Per-layer tint colors computed from game state (tileCatalog × lighting ×
  terrain randomization), with color fidelity matrix documenting how each
  `getCellAppearance` post-processing step is handled in sprite mode
- Hallucination: randomized entity/item glyphs + per-layer color
  randomization (matching getCellAppearance's randomizeColor)
- Deep-water (inWater) whole-screen tint: multiply per-layer tints by
  `deepWaterLightColor` when `rogue.inWater` is true
- Invisible-monster-in-gas silhouette: entity layer with gas-tint color
  when creature is invisible and gas is present
- Visibility-state overlays: remembered (multiply composite with
  `memoryColor`), clairvoyant/telepathic/magic-mapped/omniscience
  (multiply composite fill)
- Compositing pipeline in SpriteRenderer (layer-based draw loop, per-layer
  multiply tint via offscreen canvas, skip-tinting fast path for neutral
  colors)
- `ImageBitmap` pre-creation at tileset init time and `OffscreenCanvas` for
  the tint canvas — baseline performance optimizations built into Phase 5
- Gas volume-based alpha, fire as dedicated layer, all surface TileTypes
- Wiring: `setCellSpriteDataProvider` on browser console, plotChar dispatch
- Removal of `getBackgroundTileType`, `buildForegroundBackgroundMap`,
  `underlyingTerrain` from display pipeline
- Removal of hybrid graphics mode (`GraphicsMode.Hybrid`,
  `isEnvironmentGlyph` gating in plotChar) — Text ↔ Tiles only

What's out:
- Status effect overlays (Initiative 5)
- Bolt/projectile sprites (Initiative 7)
- UI overlay sprites (cursor, path preview, targeting)
- Autotiling (Initiative 3)
- Creature facing (Initiative 4)
- New sprite art or tileset changes
- WebGL migration
- Animation framework
- Flash effects (`creature.flashStrength` / `hiliteCell`) — handled
  outside `getCellAppearance`, deferred to a future initiative
- Sidebar, message area, and menu rendering — these are text-mode cells
  outside the dungeon viewport and never go through `getCellSpriteData`
- Pre-baked memory tileset (blue-tinted sprite copies at init time) —
  future optimization for remembered-cell performance
- Sprite tint cache (cache tinted sprite results by spriteRef + tint) —
  future optimization if Phase 5 measurement exceeds budget
- Debug overlay system (visibility state borders, layer count display) —
  future developer tooling

## Constraints

- **Text mode must not break.** The `getCellAppearance()` pipeline,
  `CellDisplayBuffer`, `plotCharWithColor`, `plotCharToBuffer`, and
  `commitDraws` are all untouched. ASCII rendering is fully preserved.
- **Shared queries, not duplicated logic.** `getCellAppearance` and
  `getCellSpriteData` must call the same extracted functions for visibility,
  creature/item lookup. No copy-paste divergence between paths.
- **Per-layer tinting.** Each layer gets its own tint color. The existing
  offscreen canvas multiply + destination-in approach is retained and
  applied per-layer.
- **Performance awareness.** Color dance redraws every 36 ms. Per-layer
  tinting multiplies canvas operations by layer count. Track frame time
  during Phase 5; if a full 79×29 redraw with multi-layer cells exceeds
  16 ms, document the bottleneck and consider a single-pass tint fallback
  before the WebGL migration (Initiative future).
- **Viewport boundary invariant.** `getCellSpriteData` is only called for
  cells where `isInDungeonViewport(x, y)` is true. Sidebar, messages, and
  menus always use text rendering via the existing `plotChar` path.
- **600 lines max per file.**
- **Session size.** No phase may exceed what a single session can handle
  at ~60% context window. If context pressure builds mid-phase, commit WIP
  and generate a handoff prompt with full context for the next session.
- Parent: `docs/pixel-art/pixel-art-exploration.md` Section 3.S, Section 4c,
  Section 6 (Initiative 2).
