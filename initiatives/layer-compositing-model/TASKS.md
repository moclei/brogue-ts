# Layer Compositing Model — Tasks

## Phase 1: Shared Cell-Query Extraction

Extract shared logic from `getCellAppearance` into `cell-queries.ts` so both
the ASCII and sprite data paths use the same functions. Pure refactor — no
behavior change to `getCellAppearance`.

- [x] Read `cell-appearance.ts` fully. Identify extractable query logic:
  visibility classification (visible/remembered/shroud — including
  clairvoyant, telepathic, magic-mapped, omniscience states), creature
  lookup (handles hidden, submerged, revealed), floor item lookup.
- [x] Create `rogue-ts/src/io/cell-queries.ts` with extracted pure functions.
  Each function takes game-state slices as parameters (same pattern as
  getCellAppearance). Visibility classification should return a
  `VisibilityState` enum value (Visible, Remembered, Clairvoyant,
  Telepathic, MagicMapped, Omniscience, Shroud).
- [x] Refactor `getCellAppearance` to call the new shared functions. Verify
  existing tests still pass — no behavior change.
- [x] Unit tests for each shared function in
  `rogue-ts/tests/io/cell-queries.test.ts`: all visibility states
  (including clairvoyant, telepathic, magic-mapped, omniscience), creature
  visibility edge cases (hidden, submerged, hallucinated), item lookup.
- [x] Define `CellQueryContext` interface in `cell-queries.ts`: bundles all
  shared closure captures (pmap, tmap, tileCatalog, dungeonFeatureCatalog,
  monsterCatalog, terrainRandomValues, displayDetail, scentMap, rogue,
  player, monsters, dormantMonsters, floorItems, displayBuffer). Include
  `monsterFlagsList: readonly number[]` — pre-computed
  `monsterCatalog.map(m => m.flags)` to avoid per-cell array allocation
  during hallucination. Both `getCellAppearance` and `getCellSpriteData`
  closures take this context.
- [x] Build shared `MonsterQueryContext` construction from `CellQueryContext`
  fields (player, pmap, rogue.playbackOmniscience). Both `getCellAppearance`
  and `getCellSpriteData` use this to build identical `MonsterQueryContext`
  instances for creature visibility checks.
- [x] Extract `snapshotCellMemory` helper: sets STABLE_MEMORY flag,
  stores `rememberedAppearance`, AND copies `rememberedLayers`
  (`pmap[x][y].layers.slice()`). Called from getCellAppearance at the
  existing STABLE_MEMORY store point (lines 376–394).

# --- handoff point ---

## Phase 2: Layer Model + Interfaces

Define the data model: render layer enum, layer entry type, CellSpriteData
interface, VisibilityState enum, TileType classification, and the
rememberedLayers field on Pcell.

- [x] Create `rogue-ts/src/platform/render-layers.ts`:
  - `RenderLayer` enum (10 values: TERRAIN through UI)
  - `RENDER_LAYER_COUNT = 10`
  - `VisibilityState` enum — re-exported from `cell-queries.ts` (ownership
    stays in cell-queries; render-layers re-exports for consumer convenience)
  - `LayerEntry` interface (`tileType?: TileType`, `glyph?: DisplayGlyph`,
    `tint: Color`, `alpha?: number`)
  - `CellSpriteData` interface (`layers: (LayerEntry | undefined)[]`,
    `bgColor: Color`, `visibilityState: VisibilityState`)
  - `createCellSpriteData()` factory that allocates the reusable instance
    + paired `LayerEntryPool`
  - `LayerEntry` pool helpers: `createLayerEntryPool`, `acquireLayerEntry`,
    `resetCellSpriteData`
- [x] TileType classification functions in `render-layers.ts`:
  `isTerrainTileType`, `isSurfaceTileType`, `isFireTileType`,
  `isGasTileType`. Fire and gas use contiguous enum ranges; surface uses
  main block GRASS..GUARDIAN_GLOW + post-gas extras; terrain is catch-all.
- [x] Add `rememberedLayers: TileType[]` to `Pcell` in `types/types.ts`.
  (Done in Phase 1.) Initialized to `[]` in both creation sites (core.ts,
  game-init.ts). Snapshot via `snapshotCellMemory` in cell-queries.ts.
- [x] Unit tests for TileType classification: 47 tests in
  `tests/platform/render-layers.test.ts` — exhaustive classification
  (every valid TileType classified exactly once), fire/gas distinction,
  surface block + extras, terrain catch-all, pool + factory helpers.

# --- handoff point ---

## Phase 3a: getCellSpriteData — Visible Cells

Build the `getCellSpriteData` function for visible cells. Uses shared
cell-query functions and `CellQueryContext` from Phase 1. Per-layer tint
colors are placeholder (base tileCatalog colors, no lighting) — proper lit
colors added in Phase 4a.

- [x] Create `rogue-ts/src/io/sprite-appearance.ts` with
  `getCellSpriteData()`. Takes `CellQueryContext` as parameter. Uses
  reusable `CellSpriteData` instance from `createCellSpriteData()`.
- [x] Shroud handling: `visibilityState = Shroud`, all layers undefined,
  no bgColor.
- [x] Visible cells: populate TERRAIN (winner of `layers[Dungeon]` vs
  `layers[Liquid]` by `drawPriority` from tileCatalog), SURFACE
  (`layers[Surface]`), ITEM (floor item glyph when no creature), ENTITY
  (player/monster glyph via shared creature query). Use `tileType` field
  for terrain/surface, `glyph` field for entity/item.
- [x] Gas vs fire classification: DungeonLayer.Gas TileTypes split into
  GAS layer (with volume-based alpha) and FIRE layer using classification
  from Phase 2.
- [x] Placeholder tint colors: set each `LayerEntry.tint` to the
  tileCatalog base foreColor (no lighting applied). Gas tiles use
  backColor (all gas TileTypes have foreColor: undefined). bgColor set to
  tileCatalog terrain backColor. Overwrite pooled LayerEntry Color
  objects field-by-field (no new allocations).
- [x] Unit tests in `rogue-ts/tests/io/sprite-appearance.test.ts`: 31
  tests — empty floor, terrain drawPriority, foliage surface, fire
  routing (Surface→FIRE, Gas→FIRE), gas cloud (backColor tint,
  volume-based alpha), item on ground, shroud, player entity, monster
  entity, monster blocks item, multi-layer cells, non-visible state stubs,
  pool reuse.

# --- handoff point ---

## Phase 3b: getCellSpriteData — Non-Visible States + Hallucination

Extend getCellSpriteData for remembered cells, other visibility states,
hallucination, and invisible-monster-in-gas.

- [x] Remembered cells: read `rememberedLayers` (not live pmap). Classify
  DungeonLayer-indexed entries into RenderLayers. Populate TERRAIN and
  SURFACE only — no entity, item, gas, fire. For magic-mapped cells,
  suppress SURFACE in addition to entity/item/gas/fire (matching
  getCellAppearance's limited terrain loop for magic-mapped cells). Use
  base tileCatalog colors (no lighting) for remembered cell tints. Set
  `visibilityState = Remembered`. When `rogue.inWater` is true, flag for
  heavy dark overlay instead of `memoryColor` multiply.
- [x] Other visibility states: set `visibilityState` to Clairvoyant,
  Telepathic, MagicMapped, or Omniscience using shared visibility
  classification from Phase 1. Clairvoyant, Telepathic, and Omniscience
  populate from live pmap (same as Visible).
- [x] Hallucination: entity and item glyphs randomized when player is
  hallucinating (port RNG logic from getCellAppearance, using shared
  query functions). Respects MONST_INANIMATE/MONST_INVULNERABLE
  exclusion for monsters, telepathy suppression, and playbackOmniscience
  bypass. Items use getHallucinatedItemCategory + itemColor tint.
- [x] Invisible-monster-in-gas silhouette: when a creature is invisible
  and gas is present at the cell, entity tint overridden with the gas
  layer's tint color (matching getCellAppearance's
  `cellForeColor = cellBackColor` silhouette behavior). Glyph re-rolled
  when hallucinating (second hallucination roll matching getCellAppearance).
- [x] Unit tests: 18 new tests — remembered cell (uses rememberedLayers
  not live pmap, TERRAIN + SURFACE only, empty rememberedLayers, fire
  suppression, drawPriority), magic-mapped (TERRAIN only, no SURFACE),
  clairvoyant/telepathic/omniscience (live pmap, correct visibilityState),
  hallucination (monster glyph randomized, inanimate exempt, telepathy
  bypass, item glyph randomized + itemColor tint, omniscience bypass),
  invisible-monster-in-gas (entity tint matches gas, no silhouette
  without gas, hallucinated silhouette glyph). Full suite: 95 files,
  2502 pass, 55 skip, zero regressions.

# --- handoff point ---

## Phase 4a-i: Terrain + Surface + Background Lighting

Upgrade getCellSpriteData to compute proper per-layer tint colors for
terrain, surface, and background. Uses existing color helpers
(`bakeTerrainColors`, `colorMultiplierFromDungeonLight`).

- [x] Study the full color computation in `getCellAppearance` (lines
  157–533). Map each post-processing step to the color fidelity matrix in
  PLAN.md. Verify/update the matrix with any steps not yet captured.
  Verified: fidelity matrix rows 1–13 all accounted for. Order confirmed:
  tileCatalog colors → light multiply → (hallucination, deep-water: Phase
  4a-ii) → bakeTerrainColors → colorDances flag. Remembered/MagicMapped
  paths use base tileCatalog colors with no lighting (matching ASCII path).
- [x] Update `getCellSpriteData` terrain layer: compute lit foreColor via
  `colorMultiplierFromDungeonLight` × `bakeTerrainColors`. Ensure all 8
  Color fields are copied to pooled objects before baking (`red`, `green`,
  `blue`, `redRand`, `greenRand`, `blueRand`, `rand`, `colorDances`).
  `copyColorTo` copies all 8 fields; `applyColorMultiplier` scales the
  Rand fields via the light multiplier's matching Rand components.
- [x] Update `bgColor`: terrain's lit backColor (same two helpers applied).
- [x] Update surface layer tint: surface TileType foreColor × lighting ×
  `bakeTerrainColors`. Surface baked via `bakeTerrainColors(surfaceTint,
  bakeDummyColor, ...)` — dummy back ensures only fore-side vals[0-2,6]
  bake the surface tint; back-side vals[3-5,7] are a no-op on zeros.
- [x] `colorDances` flag propagation: after `bakeTerrainColors`, check
  layer tint `colorDances` fields; set pmap `TERRAIN_COLORS_DANCING` flag
  so color-dance refresh cycle includes this cell (color fidelity matrix
  row 13). Checks TERRAIN tint, SURFACE tint, and bgColor.
- [x] Unit tests: 14 new tests — terrain lit tint (non-trivial light),
  terrain bake zeroes Rand, terrain bake per-cell variation, bake skip
  without terrainRandomValues, bgColor lit, bgColor Rand zeroed, surface
  lit, surface baked independently, fire not lit, gas not lit, remembered
  terrain not lit, remembered bgColor not lit, colorDances set,
  colorDances clear. Full suite: 95 files, 2516 pass, 55 skip, zero
  regressions.

# --- handoff point ---

## Phase 4a-ii: Entity/Item + Special Effects

Upgrade getCellSpriteData with entity/item lighting, hallucination,
deep-water tint, and visibility-state light augmentation.

- [x] Update entity layer tint: creature's display color × lighting
  multiplier. Player uses player display color. No `bakeTerrainColors`
  (entity colors are not terrain-randomized in getCellAppearance).
- [x] Update item layer tint: item's display foreColor × lighting.
- [x] Gas and fire layers: tileCatalog foreColor without lighting (these
  are emissive — verified: no `applyColorMultiplier` on fire/gas tints).
- [x] Hallucination color randomization: when player is hallucinating
  (Visible state only, matching getCellAppearance default branch),
  apply `randomizeColor` to each layer's tint with weight
  `40 * halLevel / 300 + 20`. Uses `monsterFlagsList` from
  `CellQueryContext`. Applied BEFORE `bakeTerrainColors`.
- [x] Deep-water tint: when `rogue.inWater` is true (Visible state
  only, matching getCellAppearance default branch), multiply each
  layer's tint by `deepWaterLightColor`. Applied BEFORE
  `bakeTerrainColors`.
- [x] Visibility-state light augmentation: for clairvoyant, telepathic,
  and omniscience states, apply `applyColorAugment(lm, basicLightColor,
  100)` to the light multiplier before applying to layer tints (matching
  getCellAppearance lines 397-398, 406-407, 436-437). Uses mutable copy
  of `lightMultiplierColor`.
- [x] Unit tests for entity/item lighting, hallucination color
  randomization, deep-water tint, visibility augmentation. 19 new tests.
  Full suite: 161 files, 4799 pass, 55 skip, zero regressions.

# --- handoff point ---

## Phase 4b: Visibility-State Overlays

Add visibility-state-aware tinting/overlays for all non-visible states.
These are post-compositing effects driven by `CellSpriteData.visibilityState`.

- [x] Define visibility overlay colors in `render-layers.ts`:
  `VisibilityOverlay` interface + `getVisibilityOverlay(state, inWater)`
  lookup function. Remembered normal → multiply with `memoryColor`;
  remembered underwater → source-over dark fill (alpha 0.8). Clairvoyant,
  Telepathic, MagicMapped, Omniscience → multiply with their respective
  color constants. `REMEMBERED_AVERAGE_COLOR` / `REMEMBERED_AVERAGE_WEIGHT`
  exported for optional future refinement.
- [x] Added `inWater: boolean` field to `CellSpriteData` interface. Set
  from `ctx.rogue.inWater` in `getCellSpriteData` after Shroud early
  return. Reset to false in `resetCellSpriteData`. Verified: remembered
  cells use base tileCatalog colors (no lighting) — no additional pre-tint
  adjustments needed; all pre-tint work completed in Phases 3b + 4a.
- [x] Unit tests: 18 new tests — 12 in `render-layers.test.ts`
  (getVisibilityOverlay for all 7 states + inWater variants, pre-allocated
  object reuse, REMEMBERED_AVERAGE constants, resetCellSpriteData inWater
  reset), 6 in `sprite-appearance.test.ts` (inWater flag for remembered,
  visible, shroud, MagicMapped states + reset between calls). Full suite:
  161 files, 4817 pass, 55 skip, zero regressions.
- [x] Documentation note in PLAN.md: multiply composite fill matching
  getCellAppearance's per-component multiply, memoryOverlay simplification,
  TM_BRIGHT_MEMORY accepted divergence.

# --- handoff point ---

## Phase 5: Compositing Pipeline

Add `drawCellLayers` to `SpriteRenderer` that iterates the layer array and
draws each sprite with per-layer multiply tinting.

- [x] Add `SpriteRenderer.drawCellLayers(cellRect, spriteData)`: fills cell
  with `spriteData.bgColor` (0-100→0-255 conversion via `c100to255`),
  iterates `spriteData.layers[]` by index, skips `undefined` entries,
  resolves sprite via `resolveSprite(entry.tileType, entry.glyph)`, calls
  `drawSpriteTinted` per defined layer with `entry.tint` as the tint color.
- [x] Gas layer: set `globalAlpha` from `entry.alpha` before drawing,
  restore to 1.0 after.
- [x] Visibility overlay: after all sprite layers, call
  `getVisibilityOverlay(state, inWater)` and apply the returned spec —
  multiply fill or dark fill depending on composite mode. Uses
  `ctx.save()`/`ctx.restore()` to isolate composite operation changes.
  All 7 states handled: Remembered (multiply memoryColor), Remembered
  +inWater (source-over black at alpha 0.8), Clairvoyant, Telepathic,
  MagicMapped, Omniscience (multiply with respective color), Visible/Shroud
  (no overlay).
- [x] `drawSpriteTinted`: updated to accept `Color` tint (Brogue 0-100
  scale) instead of raw r/g/b numbers. Converts to CSS 0-255 via
  `c100to255()`. Kept offscreen canvas multiply + destination-in approach.
  Source image resolution unified: bitmap → HTMLImageElement fallback with
  adjusted source coordinates (bitmap uses 0,0 origin, sheet uses
  tileX/tileY * TILE_SIZE).
- [x] Skip-tinting fast path: in `drawSpriteTinted`, when all tint
  components are ≥ 98 (`isNeutralTint`), skip the offscreen canvas
  multiply and drawImage directly. Saves 4 of 5 canvas ops per layer.
- [x] `resolveSprite`: both `tileType` and `glyph` parameters now
  optional (matching `LayerEntry`). Returns undefined when both omitted.
- [x] Keep existing `drawCell` method as fallback. Updated to convert
  0-255 fg colors to 0-100 `tmpTint` Color for the new `drawSpriteTinted`
  signature. Legacy two-layer path (underlyingTerrain, getBackgroundTileType)
  preserved unchanged.
- [x] `ImageBitmap` pre-creation: async `precreateBitmaps()` method
  iterates all entries in both sprite maps, calls
  `createImageBitmap(img, sx, sy, TILE_SIZE, TILE_SIZE)` for each unique
  sprite region. Stores as `Map<string, ImageBitmap>` keyed by
  `sheetKey:tileX:tileY`. `drawSpriteTinted` checks bitmap cache first,
  falls back to HTMLImageElement sub-region. Safe to skip — graceful
  degradation when `createImageBitmap` unavailable.
- [x] `OffscreenCanvas` for tint canvas: replaced
  `document.createElement('canvas')` with
  `new OffscreenCanvas(TILE_SIZE, TILE_SIZE)` in constructor. Updated
  `tintCtx` type to `OffscreenCanvasRenderingContext2D`. Updated
  `browser-renderer-mode.test.ts` mock from `document.createElement` to
  `OffscreenCanvas` class stub.
- [x] Performance measurement: deferred to Phase 6 wiring when full
  viewport redraws can be timed end-to-end. The pipeline is structured
  for measurement — `drawCellLayers` is a single entry point per cell.
  Skip-tinting fast path, ImageBitmap pre-creation, and OffscreenCanvas
  are the baseline mitigations already built in.
- [x] Change detection diagnostic: deferred to Phase 6 wiring. Requires
  knowledge of which cells commitDraws marked as changed (not available
  in sprite-renderer). Infrastructure is ready — `drawCellLayers` is the
  single entry point where per-cell comparison can be added.
- [x] Tests in `rogue-ts/tests/platform/sprite-renderer.test.ts`: 37
  tests — resolveSprite (8 tests: tileType+glyph, tileType-only,
  glyph-only, both undefined, no args, unmapped), drawCell fallback (2),
  drawCell background (1), drawCell sprite drawing (2), drawCell
  two-layer (1), drawCell foreground overlay (1), drawCellLayers bgColor
  fill (2), layer compositing (4), gas alpha (2), skip-tinting fast path
  (4), visibility overlays (8), drawCell fallback still works (1), plus
  browser-renderer-mode.test.ts mock updated. Full suite: 95 files,
  2579 pass, 55 skip, zero regressions.

# --- handoff point ---

## Phase 6a: Wiring

Wire getCellSpriteData into the rendering pipeline. Connect the new data
path to the existing plotChar dispatch.

- [x] `browser-renderer.ts`: add `setCellSpriteDataProvider` setter. Update
  `plotChar` to call `getCellSpriteDataFn` + `drawCellLayers` for
  sprite-mode dungeon viewport cells (guarded by
  `isInDungeonViewport(x, y)`). Fall back to existing `drawCell` when
  provider is not registered. Added `CellSpriteDataProvider` type export.
  Hybrid mode gating preserved (Phase 6b removes it).
- [x] Locate where `getCellAppearance`'s closure is constructed. Created
  `buildCellSpriteDataProvider()` factory in new `sprite-data-wiring.ts`
  (io-wiring.ts was at 607 lines — over the 600-line limit). Captures
  pmap, tmap, rogue, player, monsters, dormantMonsters, floorItems,
  tileCatalog, dungeonFeatureCatalog, monsterCatalog,
  terrainRandomValues, displayDetail, scentMap. Pre-computes
  `monsterFlagsList`. Creates reusable CellSpriteData + LayerEntryPool.
  Registered via `setCellSpriteDataProvider` in `platform.ts`'s
  `mainGameLoop` at the start of the game loop (after game state is
  available). `initPlatform` stores the setter from the console.
- [x] Verify text mode is completely unchanged — run full test suite.
  95 files, 2584 pass, 55 skip, zero regressions.
- [x] Smoke test: toggle between Text and Tiles modes with the layer
  pipeline active. Tested — terrain sprites render with per-layer
  lighting, remembered cells have visibility overlay, Text↔Tiles
  toggle works. Three findings:
  (a) UI overlays (inventory) initially invisible in Tiles mode — fixed
  by adding `tileType !== undefined` guard to plotChar dispatch (UI
  overlay cells have tileType deleted by plotCharToBuffer).
  (b) Gas/fire not visible — expected: gas/fire TileTypes don't have
  sprite mappings yet (Phase 7 task).
  (c) Remembered cells darker than ASCII mode — known divergence:
  sprite path uses multiply-only with `memoryColor`, missing the
  `applyColorAverage(memoryOverlay, 25)` step (documented in PLAN.md
  "Remembered overlay simplification"). REMEMBERED_AVERAGE constants
  exported for future refinement.
  Full suite after fix: 95 files, 2585 pass, 55 skip, zero regressions.

# --- handoff point ---

## Phase 6b: Prototype Cleanup

Remove prototype code that the layer model replaces. Separate from wiring
so that the additive (safe) and subtractive (risky) changes are in
different sessions.

- [x] Remove `getBackgroundTileType` and `buildForegroundBackgroundMap` from
  `glyph-sprite-map.ts`. Remove the import in `sprite-renderer.ts`.
- [x] Remove `underlyingTerrain` from `CellDisplayBuffer` type in
  `types/types.ts`.
- [x] Remove `underlyingTerrain` parameter from `plotCharWithColor` in
  `display.ts` and all callers (`refreshDungeonCell`, `getCellAppearance`
  return type).
- [x] Remove `underlyingTerrain` from `commitDraws` diff logic in
  `platform.ts` and from `plotChar` parameter list in
  `browser-renderer.ts`.
- [x] Remove `underlyingTerrain` handling from `SpriteRenderer.drawCell`
  (the old drawCell fallback path no longer needs it).
- [x] Remove `GraphicsMode.Hybrid` from the `GraphicsMode` enum in
  `types/enums.ts`.
- [x] Remove `isEnvironmentGlyph` import and gating from `plotChar` in
  `browser-renderer.ts` — `useTiles` becomes `graphicsMode === Tiles &&
  isInDungeonViewport(x, y)`.
- [x] Update G-key cycle in `setGraphicsMode` to toggle Text ↔ Tiles
  (remove Hybrid from the rotation).
- [x] Remove `isEnvironmentGlyph` function from `glyph-map.ts` — no
  other callers remain.
- [x] Remove Hybrid-mode tests from `browser-renderer-mode.test.ts` (the
  two Hybrid dispatch tests and the mode cycle assertion updated). Grepped
  for `GraphicsMode.Hybrid` across `rogue-ts/` — no remaining references.
- [x] Run full test suite — 161 files, 4844 pass, 55 skip, zero
  regressions.
- [x] Dirty detection verified: `commitDraws` without `underlyingTerrain`
  still triggers redraws via character, fg/bg colors, and tileType diffs.
  Creature cells clear `tileType` (set to undefined) when a creature
  occupies the cell, which differs from the terrain tileType in the prev
  buffer, triggering the redraw. The layer compositing pipeline
  (`getCellSpriteData`) is called on every changed cell and reads live
  game state — no sprite-relevant state is lost.

# --- handoff point ---

## Phase 7: Full Layer Coverage + Polish

Ensure all TileTypes have sprite mappings, verify visual results, update
documentation.

- [ ] Verify/add sprite mappings for all surface TileTypes (blood, fungus,
  lichen, webs, debris, cobweb, netting, etc.) in `glyph-sprite-map.ts`.
- [ ] Verify/add sprite mappings for all gas TileTypes (poison, confusion,
  rot, stench, paralysis, methane, steam, darkness, healing).
- [ ] Verify/add sprite mappings for all fire TileTypes (plain fire,
  brimstone, flamedancer, gas fire, explosion, embers).
- [ ] Integration test: multi-layer cells render correctly (creature on
  foliage on floor, gas over terrain, fire over liquid).
- [ ] Update `docs/pixel-art/pixel-art-exploration.md` Section 6 roadmap
  table — mark Initiative 2 complete. Update Section 3.S and 4d to
  reflect 10-layer model (VISIBILITY is a renderer behavior, not a
  `LayerEntry` in the array).
- [ ] Update `.context/PROJECT.md` active initiative if needed.
- [ ] Document save/load implication for `rememberedLayers` — coordinate
  with `port-v2-persistence` initiative on serialization format. Add note
  to PLAN.md deferred section if not yet resolved.
- [ ] Final cleanup pass: remove any dead code, verify 600-line limits.

## Deferred

- Flash effects (`creature.flashStrength`, `creature.flashColor`,
  `hiliteCell`) — handled outside `getCellAppearance`, needs its own
  sprite-mode path. Defer to a future initiative.
- Stealth range mode (orange tint) — niche feature, add as post-compositing
  overlay if visual testing shows it's needed.
- True-color mode `displayDetail` refinements — niche feature, closure
  captures `displayDetail` but processing deferred.
- Path highlighting — UI overlay, deferred to Initiative for UI layer.
- Pre-baked memory tileset — generate blue-tinted sprite copies at init
  time. Performance optimization for remembered cells; eliminates per-cell
  multiply overlay.
- Sprite tint cache — cache tinted sprite results keyed by
  spriteRef + quantized tint. Performance optimization if Phase 5
  measurement exceeds budget after planned mitigations.
- Debug overlay system — visibility state borders, layer count display,
  tint color tooltips. Developer tooling built on the CellQueryContext +
  layer model.
