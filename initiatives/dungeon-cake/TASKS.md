# Dungeon Cake — Tasks

## Phase 1a: Generation PoC

- [x] Scaffold Vite project at `tools/dungeon-cake/` — package.json, vite.config.ts (resolve.alias `@game` → `rogue-ts/src`), tsconfig.json, index.html, main.tsx, App.tsx, styles.css. Runs on port 5175+.
- [x] Build `src/generation/stubs.ts` — createPmap(), no-op ItemOps/MonsterOps, callback context factories (FOV, CostMap, CalcDist), makeArchitectCallbacks(), makeBridgeContext().
- [x] Build `src/generation/generate-level.ts` — constructs ArchitectContext + MachineContext, wires all catalogs (static imports, not initTileCatalog) and callbacks, calls seedRandomGenerator + digDungeon. Note: catalogs are static exports, not init functions.
- [x] Build `src/state/dungeon-state.ts` — React contexts for state (pmap/depth/seed) and actions (generate/reroll).
- [x] Build `src/components/Toolbar.tsx` — depth (1–40), seed, Generate, Re-roll, zoom selector (1x–4x).
- [x] Build `src/rendering/dungeon-canvas.tsx` + `tile-colors.ts` — canvas renders pmap as colored rectangles (TileType → color lookup, ~70 tile types mapped). Configurable zoom via toolbar.
- [x] Integration test — verified at depths 5, 20, 30. Rooms, corridors, doors, torches, deep water, carpet, crystal walls, machine features all visible. Re-roll increments seed correctly. No console errors.

# --- handoff point ---

## Phase 1b: Sprite Rendering

- [x] Audit `getCellSpriteData` in `rogue-ts/src/io/cell-queries.ts` — list every field access on `rogue` (PlayerCharacter) and `player` (Creature). Document the required stub shape in `stubs.ts` with a comment block.
- [x] Extend `src/generation/stubs.ts` — build `PlayerCharacter` and `Creature` stubs satisfying the audit. Player position at staircase location from `pmap`. Status array initialized to zeros. Boolean flags defaulted to false.
- [x] Build `src/generation/query-context.ts` — construct `CellQueryContext` with generated `pmap`, initialized `tmap` (all cells DISCOVERED | VISIBLE), empty creatures/items, stubbed rogue/player, allocated `terrainRandomValues`/`displayDetail`/`scentMap` grids.
- [x] Build `src/shared/tileset-bridge.ts` — load tileset images from `rogue-ts/assets/tilesets/` (master spritesheet, autotile sheets). Build sprite maps, `tileTypeSpriteMap`, `autotileVariantMap`. Construct `TextRenderer` and `SpriteRenderer`.
- [x] Build `src/rendering/cell-renderer.ts` — bridge function: takes a cell coordinate, calls `getCellSpriteData` on the `CellQueryContext`, then calls `SpriteRenderer.drawCellLayers` at the current zoom. Export a `renderDungeon(ctx, spriteRenderer, queryContext, zoom)` function that iterates all 79×29 cells.
- [x] Replace colored-rectangle canvas with sprite rendering in `dungeon-canvas.tsx` — use `tileset-bridge` and `cell-renderer`. Add zoom selector to toolbar (1x, 2x, 3x, 4x). Canvas backing store at 1:1 pixel ratio with `image-rendering: pixelated`.
- [x] Build `src/state/debug-state.ts` — React `useReducer` managing per-layer overrides (visibility, tint, alpha, blend mode). On state change, write to `spriteDebug` singleton and trigger canvas redraw.
- [x] Build `src/components/DebugPanel.tsx` shell + `src/components/LayerColumn.tsx` — bottom panel with 11 `RenderLayer` columns. Wire visibility checkboxes only (tint/alpha/blend deferred to Phase 2).
- [x] Trace `updateLighting()` dependency surface — follow transitive imports, identify required game state beyond `pmap`/`tmap`. If stubbable, wire lighting toggle (on = call `updateLighting`, off = set all `lightMultiplierColor` to white). If too heavy, document in PLAN.md Open Questions and default to lighting-off.
  - Result: stubbable. LightingContext needs lightCatalog (static), mutationCatalog (static), FOVContext (already in stubs), monsterRevealed (stub → false). Additional rogue fields: minersLight (LightSource), minersLightRadius (Fixpt), lightMultiplier (number). Wiring deferred to Phase 2 integration — default to lighting-off for Phase 1b.
- [x] Integration test: generate levels, verify sprites render correctly at all zoom levels. Toggle layers on/off. Test lighting toggle if wired. Fix visual bugs (misaligned sprites, missing tilesets, wrong layer ordering).
  - Verified: depth 5 and depth 20 render correctly at 2x zoom. Wall autotile variants, floor tiles, surface plants/grass, doors all rendering. Layer debug toggles work (TERRAIN off hides terrain, leaves surface/liquid visible). No console errors. Lighting toggle deferred to Phase 2.

# --- handoff point ---

## Phase 2: Full V1

- [x] Extend `LayerColumn.tsx` — add tint controls (enable/disable checkbox, color picker, alpha slider), alpha slider (0.0–1.0), blend mode dropdown (source-over, multiply, screen, overlay, color-dodge, color-burn). Wire all controls through `debug-state.ts` → `spriteDebug` bridge.
  - DebugState restructured: flat `layerVisible[]` replaced with `LayerState[]` containing `visible`, `tint` (enabled/color/alpha), `alpha`, `blendMode`. Five new action types added. `syncToSingleton` writes `tintOverride`, `alphaOverride`, `blendMode` to spriteDebug. Deleted unused `tile-colors.ts` (Phase 1a artifact).
- [x] Build `src/components/GlobalControls.tsx` — lighting toggle, background color override (color picker replacing `rgb(10,10,18)`), Reset All button. Wire to `debug-state.ts`.
  - Lighting toggle wired: extended rogue stub with `minersLight`/`minersLightRadius`/`lightMultiplier`, built `LightingContext` in `query-context.ts` with `lightCatalog`/`mutationCatalog` (static imports) and `monsterRevealed` stub. `createQueryContext` accepts `lightingEnabled` flag; when true, calls `updateLighting()`. BG color override managed via `debug-state.ts` `setBgColor` → `spriteDebug.bgColorOverride`. Reset All resets debug state + lighting + fog mode.
- [x] Build fog-of-war toggle in `Toolbar.tsx` — dropdown cycling through visibility states (all visible, remembered, clairvoyant, telepathic, magic mapped, omniscience). On change, reinitialize `tmap` with appropriate flags on all cells and trigger redraw.
  - Six fog modes defined in `query-context.ts` with `FogMode` type and `FOG_MODES` constant. `applyFogMode()` clears/sets `DISCOVERED|VISIBLE|CLAIRVOYANT_VISIBLE|TELEPATHIC_VISIBLE|MAGIC_MAPPED` flags. Omniscience mode sets `rogue.playbackOmniscience = true`.
- [x] Make debug panel resizable — add a drag divider between the canvas region and the bottom panel. Persist panel height in localStorage.
  - Pointer-event-based drag handle at top of panel. Min 48px, max 600px, default 180px. Height persisted under `dungeon-cake:panel-height` key.
- [x] Dark monospace theme polish — match sprite assigner aesthetic. Consistent spacing, font, color palette. Toolbar, canvas container, debug panel all styled.
  - Unified dark palette (#0a0a12 bg, #12121c panels, #252535 borders). Custom scrollbar styling. Transition effects on buttons and handles. Resize handle indicator with hover highlight.
- [x] End-to-end validation: test all v1 features together. Generate at edge depths, cycle fog states, adjust all layer controls, verify visual output matches expectations. Fix any remaining issues.
  - Verified at depth 5 on port 5183. Dungeon renders with sprites at 2x zoom. All 11 layer columns show full controls (visibility checkbox, tint T checkbox + color picker + alpha slider, layer alpha slider, blend mode dropdown with 8 modes). Fog dropdown in toolbar shows all 6 modes. GlobalControls section (Lighting checkbox, BG override, Reset All) visible below layer grid. Resize handle works. No console errors on clean load. Build passes (546KB → 565KB from lighting imports).

## Deferred
