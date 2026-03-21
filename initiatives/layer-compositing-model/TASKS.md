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

- [ ] Update entity layer tint: creature's display color × lighting
  multiplier. Player uses player display color. No `bakeTerrainColors`
  (entity colors are not terrain-randomized in getCellAppearance).
- [ ] Update item layer tint: item's display foreColor × lighting.
- [ ] Gas and fire layers: tileCatalog foreColor without lighting (these
  are emissive — verify against getCellAppearance that gas foreColor is
  not light-multiplied).
- [ ] Hallucination color randomization: when player is hallucinating,
  apply `randomizeColor` to each layer's tint with weight
  `40 * halLevel / 300 + 20` (matching getCellAppearance line 468–470).
  Use `monsterFlagsList` from `CellQueryContext` (not per-cell
  `monsterCatalog.map`).
- [ ] Deep-water tint: when `rogue.inWater` is true, multiply each
  layer's tint by `deepWaterLightColor` (matching getCellAppearance
  line 473–474).
- [ ] Visibility-state light augmentation: for clairvoyant, telepathic,
  and omniscience states, apply `applyColorAugment(lm, basicLightColor,
  100)` to the light multiplier before applying to layer tints (matching
  getCellAppearance lines 419–420, 428–429, 458–459).
- [ ] Unit tests for entity/item lighting, hallucination color
  randomization, deep-water tint, visibility augmentation.

# --- handoff point ---

## Phase 4b: Visibility-State Overlays

Add visibility-state-aware tinting/overlays for all non-visible states.
These are post-compositing effects driven by `CellSpriteData.visibilityState`.

- [ ] Define visibility overlay colors in `render-layers.ts` or
  `sprite-appearance.ts`: remembered (`memoryColor` — multiply fill for
  blue-tinted dimming; when `rogue.inWater`, heavy dark fill matching
  `applyColorAverage(black, 80)`), clairvoyant (clairvoyanceColor),
  telepathic (telepathyMultiplier), magic-mapped (magicMapColor),
  omniscience (omniscienceColor). Import color constants from
  `globals/colors.ts`.
- [ ] Update `getCellSpriteData` to apply appropriate pre-tint adjustments
  for each visibility state where needed (e.g., remembered cells use
  base tileCatalog colors rather than lit colors).
- [ ] Update unit tests: verify each visibility state produces correct
  `visibilityState` enum value and that tint colors are adjusted
  appropriately for the state.
- [ ] Add documentation note: all visibility overlays use multiply
  composite fill matching getCellAppearance's per-component multiply.
  Remembered uses `memoryColor` for faithful blue-tinted dimming;
  underwater remembered uses heavy dark fill.

# --- handoff point ---

## Phase 5: Compositing Pipeline

Add `drawCellLayers` to `SpriteRenderer` that iterates the layer array and
draws each sprite with per-layer multiply tinting.

- [ ] Add `SpriteRenderer.drawCellLayers(cellRect, spriteData)`: fills cell
  with `spriteData.bgColor`, iterates `spriteData.layers[]` by index,
  skips `undefined` entries, calls `drawSpriteTinted` per defined layer
  with `entry.tint` as the tint color.
- [ ] Gas layer: set `globalAlpha` from `entry.alpha` before drawing,
  restore after.
- [ ] Visibility overlay: after all sprite layers, apply overlay based on
  `spriteData.visibilityState`:
  - Remembered: multiply fill — `globalCompositeOperation='multiply'`
    + `fillRect(memoryColor)`, then restore `source-over`. When
    `rogue.inWater`, use heavy dark fill instead.
  - Clairvoyant: multiply fill — `globalCompositeOperation='multiply'`
    + `fillRect(clairvoyanceColor)`, then restore `source-over`
  - Telepathic: multiply fill — same pattern with telepathyMultiplier
  - MagicMapped: multiply fill — same pattern with magicMapColor
  - Omniscience: multiply fill — same pattern with omniscienceColor
  - Visible/Shroud: no overlay
- [ ] `drawSpriteTinted`: update to accept `Color` tint (currently takes
  raw r/g/b numbers). Keep the offscreen canvas multiply + destination-in
  approach.
- [ ] Skip-tinting fast path: in `drawSpriteTinted`, if all tint
  components are ≈ 100, skip the offscreen canvas multiply and drawImage
  directly. Saves 4 of 5 ops per layer for cells in bright light.
- [ ] `resolveSprite`: update to accept separate optional `tileType` and
  `glyph` fields (matching `LayerEntry`). Try tileTypeSpriteMap for
  `tileType` if defined, then spriteMap for `glyph` if defined.
- [ ] Keep existing `drawCell` method as fallback for cells where the
  sprite data provider is not yet registered (transition period).
- [ ] `ImageBitmap` pre-creation: at tileset init time, call
  `createImageBitmap(img, sx, sy, TILE_SIZE, TILE_SIZE)` for each sprite
  region. Store as `Map<string, ImageBitmap>` keyed by
  `sheetKey:tileX:tileY`. Update `drawSpriteTinted` to use `ImageBitmap`
  source instead of `HTMLImageElement` sub-region.
- [ ] `OffscreenCanvas` for tint canvas: replace
  `document.createElement('canvas')` with
  `new OffscreenCanvas(TILE_SIZE, TILE_SIZE)` in `SpriteRenderer`
  constructor.
- [ ] Performance measurement: time a full 79×29 redraw with multi-layer
  cells and per-layer tinting. If >16 ms, document bottleneck and evaluate
  mitigations from PLAN.md performance budget section.
- [ ] Change detection diagnostic (debug mode only): after
  `drawCellLayers`, compare previous `CellSpriteData` layers with current.
  If layers differ for a cell `commitDraws` didn't mark as changed, log a
  warning. Remove or gate behind a debug flag before shipping.
- [ ] Tests in `rogue-ts/tests/platform/sprite-renderer.test.ts`:
  compositing order, per-layer tinting calls, gas alpha, all visibility
  overlay variants, fallback behavior.

# --- handoff point ---

## Phase 6a: Wiring

Wire getCellSpriteData into the rendering pipeline. Connect the new data
path to the existing plotChar dispatch.

- [ ] `browser-renderer.ts`: add `setCellSpriteDataProvider` setter. Update
  `plotChar` to call `getCellSpriteDataFn` + `drawCellLayers` for
  sprite-mode dungeon viewport cells (guarded by
  `isInDungeonViewport(x, y)`). Fall back to existing `drawCell` when
  provider is not registered.
- [ ] Locate where `getCellAppearance`'s closure is constructed (likely
  `buildInputContext` or equivalent). Create the `getCellSpriteData`
  closure at the same site, capturing the same game-state slices plus
  `terrainRandomValues`, `displayDetail`, `scentMap`. Register it via
  `setCellSpriteDataProvider`.
- [ ] Verify text mode is completely unchanged — run full test suite.
- [ ] Smoke test: toggle between Text and Tiles modes with the layer
  pipeline active.

# --- handoff point ---

## Phase 6b: Prototype Cleanup

Remove prototype code that the layer model replaces. Separate from wiring
so that the additive (safe) and subtractive (risky) changes are in
different sessions.

- [ ] Remove `getBackgroundTileType` and `buildForegroundBackgroundMap` from
  `glyph-sprite-map.ts`. Remove the import in `sprite-renderer.ts`.
- [ ] Remove `underlyingTerrain` from `CellDisplayBuffer` type in
  `types/types.ts`.
- [ ] Remove `underlyingTerrain` parameter from `plotCharWithColor` in
  `display.ts` and all callers (`refreshDungeonCell`, `getCellAppearance`
  return type).
- [ ] Remove `underlyingTerrain` from `commitDraws` diff logic in
  `platform.ts` and from `plotChar` parameter list in
  `browser-renderer.ts`.
- [ ] Remove `underlyingTerrain` handling from `SpriteRenderer.drawCell`
  (the old drawCell fallback path no longer needs it).
- [ ] Remove `GraphicsMode.Hybrid` from the `GraphicsMode` enum in
  `types/enums.ts`.
- [ ] Remove `isEnvironmentGlyph` import and gating from `plotChar` in
  `browser-renderer.ts` — `useTiles` becomes `graphicsMode === Tiles &&
  isInDungeonViewport(x, y)`.
- [ ] Update G-key cycle in `setGraphicsMode` to toggle Text ↔ Tiles
  (remove Hybrid from the rotation).
- [ ] Remove `isEnvironmentGlyph` function from `glyph-map.ts` if no
  other callers remain.
- [ ] Remove Hybrid-mode tests from `browser-renderer-mode.test.ts` (the
  two Hybrid dispatch tests and update the mode cycle assertion). Grep for
  `GraphicsMode.Hybrid` across `rogue-ts/` to catch any remaining
  references.
- [ ] Run full test suite — verify no regressions from removal.
- [ ] Verify dirty detection still works: `commitDraws` without
  `underlyingTerrain` in the diff must still trigger redraws for cells
  that previously changed due to underlyingTerrain differences. Confirm
  that sprite-mode redraws are triggered by other cell changes (character,
  fg/bg colors, tileType).

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
