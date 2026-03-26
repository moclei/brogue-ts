# Dungeon Cake — Plan

## Approach

A standalone Vite + React app at `tools/dungeon-cake/` that imports game modules directly via path aliases — no iframe, no worker, no shared library. The game's DI architecture (`ArchitectContext`, `CellQueryContext`) makes this viable: generation and rendering pipelines are free of `core.ts` imports, and all dependencies are provided explicitly through context interfaces.

The tool has three layers:

1. **Generation layer** — constructs `ArchitectContext` with catalog imports, callback wiring, and `MachineContext` with no-op `ItemOps`/`MonsterOps` stubs. Calls `seedRandomGenerator()` then `digDungeon()`. Produces terrain-complete levels (rooms, corridors, lakes, chasms, machines) without items or creatures.

2. **Query layer** — constructs `CellQueryContext` with the generated `pmap`, an initialized `tmap` (visibility flags per fog toggle), and stubbed `rogue`/`player`. Feeds `getCellSpriteData()` which produces per-cell sprite data for all 11 render layers.

3. **Rendering layer** — constructs `TextRenderer` + `SpriteRenderer` with tileset images loaded from `rogue-ts/assets/tilesets/`. Calls `SpriteRenderer.drawCellLayers()` per cell onto a canvas at integer zoom. Debug overrides flow through the `spriteDebug` singleton, bridged from React state.

### Key Components

| Module | Responsibility |
|---|---|
| `generate-level.ts` | Construct `ArchitectContext`, wire callbacks, call `digDungeon` |
| `stubs.ts` | No-op `ItemOps`/`MonsterOps`, minimal `BuildBridgeContext`, stub `PlayerCharacter`/`Creature` |
| `query-context.ts` | Construct `CellQueryContext` for terrain-only rendering |
| `debug-state.ts` | React `useReducer` for layer overrides, syncs to `spriteDebug` singleton |
| `dungeon-state.ts` | Holds generated `pmap`/`tmap`, depth, seed |
| `dungeon-canvas.tsx` | Canvas component, iterates cells, calls `drawCellLayers` at zoom |
| `cell-renderer.ts` | Bridges `getCellSpriteData` → `SpriteRenderer.drawCellLayers` |
| `tileset-bridge.ts` | Loads tileset images + sprite maps from game assets |
| `Toolbar.tsx` | Depth, seed, generate, re-roll, zoom, fog toggle |
| `DebugPanel.tsx` | Resizable bottom panel with 11 layer columns |
| `LayerColumn.tsx` | Per-layer visibility/tint/alpha/blend controls |
| `GlobalControls.tsx` | Lighting toggle, background color override, reset all |

### Debug State Bridge

The game's `spriteDebug` singleton is read by `SpriteRenderer` at draw time. The tool manages the same state shape in React (`useReducer`). On every state change, the React layer writes updated values to the `spriteDebug` singleton, then triggers a canvas redraw. This avoids modifying `SpriteRenderer`.

### MachineContext Stubbing

All 20 `itemOps`/`monsterOps` call sites in `machines.ts` were traced during exploration:
- Monster ops are null-safe: `spawnHorde()`, `generateMonster()`, `monsterAtLoc()` returns are checked with `if (monst)` before use.
- Item ops have a hard failsafe: the retry loop has `if (itemFailsafe-- <= 0) break` after 1000 iterations. A minimal stub item exits safely.

Result: machine generation runs to completion and places all terrain features. Items and creatures are absent.

## Phasing

### Phase 1a: Generation PoC (2–3 sessions)

Validate that `digDungeon` runs outside the game bootstrap. Render `pmap` as colored rectangles (TileType → color lookup, no sprites). Depth/seed controls + Generate button.

**Success criteria:** A web page showing a color-coded dungeon map that changes when depth/seed are adjusted. Rooms, corridors, lakes, chasms, machine rooms visible at appropriate depths.

### Phase 1b: Sprite Rendering (2–3 sessions)

Replace colored rectangles with actual sprite rendering. Build `CellQueryContext` with terrain-only stubs (requires auditing `getCellSpriteData` field access paths). Construct `TextRenderer` + `SpriteRenderer`. Per-layer visibility toggles. Lighting toggle (trace `updateLighting` dependencies during this phase).

**Success criteria:** Dungeon rendered with real sprites at 2x zoom. Layer visibility toggles work. Lighting can be toggled on/off (or deferred if dependencies are too heavy).

### Phase 2: Full V1 (2–3 sessions)

Complete the v1 feature set: per-layer tint/alpha/blend controls, fog-of-war toggle, resizable debug panel, background color override, reset all, dark theme polish.

**Success criteria:** All v1 features from BRIEF.md are functional. The tool is usable for day-to-day sprite evaluation.

## Technical Notes

### Vite Configuration

Follow `tools/sprite-assigner-v2/vite.config.ts` pattern. Key requirements:
- `resolve.alias` mapping `@game/` → `../../rogue-ts/src/`
- Handle `.js` extension specifiers in TypeScript imports (Vite resolves these to `.ts`)
- Handle `?url` imports for tileset assets

### RNG Seeding

Call `seedRandomGenerator(BigInt(seed))` from `math/rng.ts` before `digDungeon`. This sets module-level RNG state with no `core.ts` dependency. Same depth + seed always produces the same level.

### Catalog Initialization

All catalogs (`tileCatalog`, `dungeonProfileCatalog`, `dungeonFeatureCatalog`, `blueprintCatalog`, `autoGeneratorCatalog`) are static `export const` from `rogue-ts/src/globals/`. There is no `initTileCatalog()` — the exploration doc was incorrect about this. The `GameConstants` object needs `numberBlueprints` and `numberAutogenerators` set to the catalog lengths (they default to 0 in `BROGUE_GAME_CONSTANTS`).

### `rogue`/`player` Stub Complexity

`getCellSpriteData` (500+ lines) checks many `PlayerCharacter` fields: `playbackOmniscience`, `clairvoyance`, `player.status[StatusEffect.Hallucinating]`, player position, and various `TileFlag` comparisons. The stub must be built by auditing every field access path — not guessing. This is Phase 1b's primary risk.

## Open Questions

*None — all resolved.*

### Resolved

1. **`updateLighting()` dependency surface.** Traced in Phase 1b. The `LightingContext` interface requires: `tmap`, `pmap`, `displayDetail` (all already available), `player`/`rogue` (stub extensions needed: `rogue.minersLight`, `rogue.minersLightRadius`, `rogue.lightMultiplier`), `lightCatalog` (static import), `mutationCatalog` (static import), `monsterRevealed` (stub → `() => false`), plus `FOVContext` (already in stubs.ts). **Verdict: stubbable.** The tool can call `updateLighting()` to populate tmap.light, then the existing `colorMultiplierFromDungeonLight()` in getCellSpriteData reads those values. Wiring deferred to Phase 2 — Phase 1b defaults to lighting-off (tmap.light all set to [100,100,100] = white, no darkening).

## Rejected Approaches

- **Addon to Sprite Assigner V2** — rejected because it would turn a focused tool into a monolith. The dependency surface (generation, lighting, appearance) is too large for a tool built around assignment state.
- **Shared library with two entry points** — premature abstraction. One consumer doesn't justify the overhead.
- **Hidden iframe running full game** — unnecessary complexity when direct imports are confirmed viable.
- **Web Worker isolation** — `core.ts` entanglement doesn't exist in the generation path, so worker isolation is unneeded.
