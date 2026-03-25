# Dungeon Cake — Layer Debug Tool

> **Status:** Exploration complete — ready for initiative creation
> **Date:** 2026-03-25
> **Parent:** `docs/pixel-art/pixel-art-exploration.md` (Initiative 10: Developer Tools Expansion)
> **Key references:**
> - `docs/pixel-art/sprite-layer-pipeline.md` — authoritative rendering pipeline spec
> - `tools/sprite-assigner-v2/CONTEXT.md` — the companion dev tool
> - `docs/game-camera/game-camera-exploration.md` — the planned camera system

---

## Problem Statement

The F2 sprite layer debug panel lives inside the game, rendered on the same
canvas that draws the dungeon. This creates three compounding usability problems:

1. **Scale problem.** The game renders a 100×34 grid to fit the browser window.
   At 1920px width, each cell gets ~19 CSS pixels — a 16×16 sprite is drawn
   into a ~19×19 box. The art is too small to evaluate. Browser zoom (Ctrl+)
   scales the sprites up but introduces bilinear interpolation blur (the
   browser scales already-rendered pixels, not the source sprites).

2. **Panel occlusion.** When zoomed in via browser zoom, the F2 debug panel
   (absolutely positioned in the viewport) gets zoomed too. To see both the
   dungeon art and the panel, you have to pan back and forth between the
   dungeon area and the panel location. The panel often overlaps the area
   you're trying to inspect.

3. **Iteration overhead.** To see changes to sprite assignments, layer
   parameters, or autotile configurations in the context of a real dungeon,
   you have to: play the game until interesting terrain appears (deep water
   next to lava, a machine room, foliage over a bridge). This can take
   minutes per iteration. There's no way to summon a specific combination
   of features on demand.

A dedicated, standalone tool — **Dungeon Cake** — solves all three: render
sprites at proper scale, keep debug controls in a non-overlapping UI, and
generate dungeon layouts on demand with controllable feature density.

---

## Approach: Standalone Vite App (Option A)

A new Vite + React app at `tools/dungeon-cake/`. It imports the game's dungeon
generation, sprite pipeline, and rendering modules directly (not via the game's
bootstrap). It renders a dungeon into its own canvas at a controllable zoom
level, with debug panels as React components in the page layout.

**Why this approach:**

1. The game's DI architecture (`ArchitectContext`, `CellQueryContext`) is
   designed for construction outside the bootstrap. Both generation and
   rendering pipelines are free of `core.ts` imports — no global state
   entanglement.
2. `MachineContext` requires `ItemOps` and `MonsterOps` callbacks, but these
   are fully stubbable with no-ops. All monster-op call sites guard on null
   returns; item generation has a hard failsafe loop. Terrain layout
   (rooms, corridors, lakes, machines, chasms, bridges) is structurally
   complete with stub implementations — items and creatures are simply absent.
   See [Dependency Analysis: MachineContext Stubbing](#machinecontext-stubbing).
3. Keeps the sprite assigner focused and avoids monolith risk.
4. The standalone tool reacts to sprite assigner changes via the same
   file-watcher mechanism the game uses (the assigner writes to
   `rogue-ts/assets/tilesets/`, the tool watches those files).
5. Follows the same project structure as `tools/sprite-assigner-v2/` —
   independent `package.json`, Vite path aliases for `rogue-ts/src/` imports.

**Rejected alternatives** are archived in [Appendix: Design Space](#appendix-design-space).

---

## V1 Features

The first usable version. Everything needed for day-to-day sprite evaluation.

### Generation Controls (toolbar)

- **Depth input (1–40).** Controls `depthLevel` in `ArchitectContext`, which
  affects dungeon profiles, machine types, and lava/water frequency.
- **Seed input.** Seeds the RNG via `seedRandomGenerator(BigInt(seed))`.
  Same depth + seed always produces the same level.
- **Generate button.** Runs `digDungeon` and redraws the canvas.
- **Re-roll button.** Increments the seed by 1 and regenerates.

### Dungeon Canvas (center)

- 79×29 dungeon grid rendered with actual sprites at configurable integer
  zoom: 1x (16px), 2x (32px, default), 3x (48px), 4x (64px).
- Canvas backing store at 1:1 pixel ratio with `image-rendering: pixelated`
  for crisp integer scaling.
- Scrollable within the center panel when the canvas exceeds the viewport.
- Uses `SpriteRenderer.drawCellLayers()` fed by `getCellSpriteData()`.
- **Zoom selector** in the toolbar.

### Layer Debug Panel (bottom, resizable)

Horizontal strip with one compact column per `RenderLayer` (11 columns:
TERRAIN through UI). All layers visible at once.

Per-layer controls:
- **Visibility checkbox.** Toggle layer on/off.
- **Tint enable/disable checkbox + color picker + alpha slider.** Override
  the game's per-layer tint with a fixed color at configurable strength.
- **Alpha slider (0.0–1.0).** Override `globalAlpha` for the layer.
- **Blend mode dropdown.** Override the composite operation (`multiply`,
  `source-over`, `screen`, `overlay`, `color-dodge`, `color-burn`).

Global controls in the panel:
- **Lighting toggle (on/off).** On = run `updateLighting()`, VISIBILITY
  layer active. Off = skip lighting, all cells fully lit (set all
  `lightMultiplierColor` to white `(100, 100, 100)`).
- **Background color override.** Replace the dark background
  (`rgb(10,10,18)`) with a custom color.
- **Reset All button.** Restore all overrides to defaults.

### Fog-of-War Toggle (toolbar)

Cycle through visibility states for the entire grid:
- **All visible** (default) — `DISCOVERED | VISIBLE` flags on all cells.
- **Remembered** — `DISCOVERED` only (no `VISIBLE`). Tests fog overlay.
- **Clairvoyant / Telepathic / Magic Mapped / Omniscience** — sets the
  corresponding `TileFlag` on all cells for previewing each overlay color.

### Debug State Bridge

The game's `spriteDebug` singleton is read by `SpriteRenderer` at draw time.
The tool manages the same state shape in React (`useReducer`). On every state
change, the React layer writes updated values to the `spriteDebug` singleton,
then triggers a canvas redraw. This avoids modifying `SpriteRenderer`.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Toolbar                                                            │
│  Depth: [5]  Seed: [42]  [Generate] [Re-roll]   Zoom: [2x▾]       │
│  Fog: [All Visible ▾]                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                     Dungeon Canvas                                  │
│                     79×29 grid at 2x zoom                           │
│                     (1264×464 → 2528×928 at 2x)                     │
│                                                                     │
│                     Scrollable within this region                    │
│                     image-rendering: pixelated                      │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  Debug Panel (resizable divider)                                    │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┐          │
│  │TERR│LIQD│SURF│ITEM│ENTY│ GAS│FIRE│ VIS│STAT│BOLT│ UI │          │
│  │ [✓]│ [✓]│ [✓]│ [✓]│ [✓]│ [✓]│ [✓]│ [✓]│ [ ]│ [ ]│ [ ]│          │
│  │tint│tint│tint│tint│tint│tint│tint│tint│    │    │    │          │
│  │  α │  α │  α │  α │  α │  α │  α │  α │    │    │    │          │
│  │blnd│blnd│blnd│blnd│blnd│blnd│blnd│blnd│    │    │    │          │
│  └────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┘          │
│  [Lighting: On/Off]  [Override bgColor: ■]  [Reset All]            │
└─────────────────────────────────────────────────────────────────────┘
```

Dark monospace theme matching the sprite assigner.

---

## Module Architecture

```
tools/dungeon-cake/
├── package.json
├── vite.config.ts
├── index.html
├── tsconfig.json
└── src/
    ├── main.tsx                    — React entry point
    ├── App.tsx                     — Toolbar / canvas / debug panel layout
    ├── state/
    │   ├── dungeon-state.ts        — Generated pmap/tmap, depth, seed
    │   └── debug-state.ts          — Layer overrides, bridges React → spriteDebug singleton
    ├── generation/
    │   ├── generate-level.ts       — Constructs ArchitectContext, calls digDungeon
    │   ├── query-context.ts        — Constructs CellQueryContext for terrain-only rendering
    │   └── stubs.ts                — No-op ItemOps, MonsterOps, minimal PlayerCharacter/Creature
    ├── rendering/
    │   ├── dungeon-canvas.tsx       — Canvas component, draws cells at zoom
    │   └── cell-renderer.ts        — Uses SpriteRenderer.drawCellLayers + getCellSpriteData
    ├── components/
    │   ├── Toolbar.tsx             — Depth, seed, generate, re-roll, zoom, fog toggle
    │   ├── DebugPanel.tsx          — Resizable bottom panel with 11 layer columns
    │   ├── LayerColumn.tsx         — Per-layer visibility/tint/alpha/blend
    │   └── GlobalControls.tsx      — Lighting toggle, bgColor override, reset
    └── shared/
        └── tileset-bridge.ts       — Load tileset images + sprite maps from game assets
```

---

## Dependency Analysis

### `ArchitectContext` (for `digDungeon`)

Source: `rogue-ts/src/architect/architect.ts`

| Field | Type | How to Provide | Difficulty |
|---|---|---|---|
| `pmap` | `Pcell[][]` | Allocate fresh 2D array (DCOLS × DROWS) | Easy |
| `depthLevel` | `number` | User input (1–40) | Trivial |
| `gameConstants` | `GameConstants` | Import from `types/constants.js` | Easy |
| `dungeonProfileCatalog` | `readonly DungeonProfile[]` | Import from game init | Easy |
| `dungeonFeatureCatalog` | `DungeonFeature[]` | Import from game init | Easy (large catalog) |
| `blueprintCatalog` | `readonly Blueprint[]` | Import from game init | Easy (large catalog) |
| `autoGeneratorCatalog` | `readonly AutoGenerator[]` | Import from game init | Easy |
| `tileCatalog` | `readonly FloorTileType[]` | Import `initTileCatalog()` | Easy |
| `machineNumber` | `number` | Initialize to 0, mutated by generation | Trivial |
| `rewardRoomsGenerated` | `number` | Initialize to 0, mutated by generation | Trivial |
| `staleLoopMap` | `boolean` | Initialize to true | Trivial |
| `machineContext` | `MachineContext` | Construct — see [MachineContext Stubbing](#machinecontext-stubbing) | Medium |
| `bridgeContext` | `BuildBridgeContext` | Construct — `depthLevel`, `depthAccelerator: 0`, and a `pathingDistance` callback from dijkstra | Medium |
| `analyzeMap()` | callback | Import from `analysis.ts` — depends on grid utils, dijkstra | Medium |
| `getFOVMask()` | callback | Import from FOV module | Medium |
| `populateGenericCostMap()` | callback | Import from movement/pathing module | Medium |
| `calculateDistances()` | callback | Import from dijkstra module | Medium |

The data fields (catalogs, constants) are static imports — no risk.
The callbacks (`analyzeMap`, `getFOVMask`, `populateGenericCostMap`,
`calculateDistances`) are pure functions that operate on `pmap` and `Grid`
data. Their transitive imports (`state/helpers.ts`, `grid/grid.ts`,
`math/rng.ts`, `dijkstra/dijkstra.ts`) are verified clean of `core.ts`
imports.

**RNG seeding:** Call `seedRandomGenerator(BigInt(seed))` from `math/rng.ts`
before `digDungeon`. This sets module-level RNG state. No `core.ts`
dependency.

### MachineContext Stubbing

`MachineContext` extends the shared `ArchitectContext` fields with:

| Field | Type | Stub Strategy | Notes |
|---|---|---|---|
| `chokeMap` | `Grid` | `allocGrid()` — filled by `analyzeMap` | Easy |
| `itemOps` | `ItemOps` | No-op stubs (see below) | Easy |
| `monsterOps` | `MonsterOps` | Null-returning stubs (see below) | Easy |
| `floorItems` | `MachineItem[]` | Empty array | Trivial |
| `packItems` | `MachineItem[]` | Empty array | Trivial |
| `pathingDistance` | optional callback | Import from dijkstra | Medium |

**Verified safe.** All 20 `itemOps`/`monsterOps` call sites in
`machines.ts` were traced:

- **Monster ops are null-safe.** `spawnHorde()`, `generateMonster()`, and
  `monsterAtLoc()` return values are checked with `if (monst)` before use.
  `iterateMachineMonsters()` returning `[]` means zero loop iterations.
  `toggleMonsterDormancy()` and `killCreature()` are only reached through
  these guards.

- **Item ops have a hard failsafe.** `generateItem()` returns are used
  immediately (no null check), but the retry loop that checks item
  properties has `if (itemFailsafe-- <= 0) break` after 1000 iterations.
  A stub returning `{ category, kind, quantity: 1, flags: 0, keyLoc: [],
  originDepth: 0 }` exits the loop safely. `placeItemAt`, `deleteItem`,
  `removeItemFromArray` can be no-ops.

**Result:** Machine generation runs to completion and places all terrain
features (machine cells, trap tiles, altars, cages, levers, pressure plates,
wiring flags). Items and creatures are absent. Terrain layout is structurally
complete — exactly what the tool needs for terrain-only mode.

```typescript
const itemOps: ItemOps = {
  generateItem: (cat, kind) => ({
    category: cat, kind, quantity: 1, flags: 0,
    keyLoc: [], originDepth: 0,
  }),
  deleteItem: () => {},
  placeItemAt: () => {},
  removeItemFromArray: () => {},
  itemIsHeavyWeapon: () => false,
  itemIsPositivelyEnchanted: () => false,
};

const monsterOps: MonsterOps = {
  spawnHorde: () => null,
  monsterAtLoc: () => null,
  killCreature: () => {},
  generateMonster: () => null,
  toggleMonsterDormancy: () => {},
  iterateMachineMonsters: () => [],
};
```

### `CellQueryContext` (for `getCellSpriteData`)

Source: `rogue-ts/src/io/cell-queries.ts`

| Field | Type | How to Provide (terrain-only) | Difficulty |
|---|---|---|---|
| `pmap` | `Pcell[][]` | Same array from generation | Free |
| `tmap` | `readonly Tcell[][]` | Allocate and initialize with visibility flags per fog toggle | Medium |
| `displayBuffer` | `ScreenDisplayBuffer` | Allocate empty 100×34 buffer | Easy |
| `rogue` | `PlayerCharacter` | Stub with minimal fields (see note) | Medium-High |
| `player` | `Creature` | Stub with position at staircase location | Medium-High |
| `monsters` | `readonly Creature[]` | Empty array (terrain-only mode) | Trivial |
| `dormantMonsters` | `readonly Creature[]` | Empty array | Trivial |
| `floorItems` | `readonly Item[]` | Empty array | Trivial |
| `tileCatalog` | `readonly FloorTileType[]` | Same as ArchitectContext | Free |
| `dungeonFeatureCatalog` | `readonly DungeonFeature[]` | Same as ArchitectContext | Free |
| `monsterCatalog` | `readonly CreatureType[]` | Import from game (can stub for terrain-only) | Easy |
| `terrainRandomValues` | `readonly number[][][]` | Allocate and fill with random values | Easy |
| `displayDetail` | `readonly number[][]` | Allocate zero-filled grid | Easy |
| `scentMap` | `readonly number[][]` | Allocate zero-filled grid | Easy |
| `monsterFlagsList` | `readonly number[]` | Empty array or derived from monsterCatalog | Easy |

The `rogue`/`player` stubs are the hardest part. `getCellSpriteData` (500+
lines) checks many `PlayerCharacter` fields: `playbackOmniscience`,
`clairvoyance`, `player.status[StatusEffect.Hallucinating]`, player position,
and various `TileFlag` comparisons. The stub must be built by auditing every
field access path in `getCellSpriteData` — not by guessing.

### `SpriteRenderer` Dependencies

`SpriteRenderer` constructor takes 6 arguments:

```typescript
new SpriteRenderer(ctx, tiles, spriteMap, tileTypeSpriteMap, textRenderer, autotileVariantMap?)
```

The tool must construct both a `TextRenderer` (for glyph fallback on unmapped
sprites) and a `SpriteRenderer`. `TextRenderer` needs a
`CanvasRenderingContext2D`, font name, and font size.

`SpriteRenderer.drawCellLayers()` reads the `spriteDebug` singleton directly
(line 278). The tool controls `spriteDebug` exclusively via the React →
singleton bridge — no conflict since no game is running.

### `updateLighting` Dependencies

When the lighting toggle is on, the tool calls `updateLighting()` after
generation. The dependency surface of `updateLighting` has not been fully
traced. If it requires game state beyond `pmap`/`tmap`, it may need stubbing
or the "lighting off" mode becomes the default until traced. This will be
resolved during implementation.

---

## Relationship to Existing Tools

### vs. F2 Debug Panel (in-game)

The F2 panel remains in the game during the transition period. Once Dungeon
Cake reaches feature parity with the F2 panel's controls (layer toggles,
tint overrides, alpha sliders, blend modes, cell inspection, deep-dive
Canvas2D controls), **the in-game F2 panel will be removed.** The React-based
debug panel is the long-term replacement, not a supplement.

The removal milestone is after the roadmap items "Cell inspection" and
"Deep-dive Canvas2D controls" are implemented.

### vs. Sprite Assigner V2

The sprite assigner manages *which* sprite maps to *which* enum value.
Dungeon Cake shows *how* those sprites look when rendered through the full
layer pipeline with lighting, tinting, and compositing. They are
complementary:

```
Sprite Assigner: "wall tile #7 → this DawnLike sprite"
      ↓ (writes master-spritesheet.png + sprite-manifest.json)
Dungeon Cake:    "here's what wall tile #7 looks like next to water,
                  under torchlight, with foliage on top"
```

In v1, the two tools connect via the filesystem: assign a sprite in the
assigner, save, manually refresh Dungeon Cake. Tileset hot-reload (HMR) is
on the roadmap to eliminate the manual refresh.

### vs. Game Camera (Initiative 6)

The game camera will eventually solve the "sprites too small" problem for
gameplay. Dungeon Cake solves it for development. Once the camera system
exists, Dungeon Cake remains useful for generation controls, isolated
rendering, and debug controls.

### vs. UI Extraction (active initiative)

The `initiatives/ui-extraction/` initiative may change `SpriteRenderer`'s
constructor signature or `CellRect` type. These are the two specific
interfaces to monitor. The tool's rendering bridge should be validated
after UI extraction completes.

---

## Roadmap (Post-V1)

In rough priority order:

| Feature | Description |
|---|---|
| **Cell inspection** | Click a cell to see per-layer breakdown (active layers, tileType, autotile bitmask/variant/group, tint values, 3×3 neighbor grid). |
| **Tileset hot-reload** | Vite plugin watches `rogue-ts/assets/tilesets/`. Sprite assigner saves → Dungeon Cake re-fetches images, rebuilds sprite maps, redraws. Same pattern as `bootstrap.ts` HMR. |
| **Deep-dive Canvas2D controls** | Per-layer CSS filter, shadow (blur/color/offset), image smoothing, flip horizontal, rotation, scale. Ported from the F2 deep-dive panel. |
| **colorDances animation** | `requestAnimationFrame` loop re-calling `bakeTerrainColors` for shimmer effects. Controls: animation speed, and exposure of any tunable parameters. |
| **Minimap** | Small overview showing viewport position on the full dungeon when zoomed in. |
| **Creature & item placement** | Expand `query-context.ts` with real creature/item generation. Render ENTITY and ITEM layers. |
| **Pre-baked showcase seeds** | Curated depth+seed pairs that produce visually interesting layouts. |
| **Live sprite assigner link** | WebSocket or shared-state channel — assigner changes appear in Dungeon Cake without saving to disk. |
| **F2 panel removal** | Remove `sprite-debug.ts` and `sprite-debug-detail.ts` from the game. Dungeon Cake is the sole debug tool. |

---

## Phasing

### Phase 1a: Generation Proof of Concept

**Goal:** Validate that `digDungeon` can run outside the game bootstrap.
Go/no-go gate — though the dependency analysis makes this very likely to
succeed.

**Scope:**
- Vite project skeleton at `tools/dungeon-cake/` (package.json,
  vite.config.ts with path aliases for `rogue-ts/src/` imports).
- Build `generate-level.ts`: construct `ArchitectContext` with catalog
  imports, callback wiring, and `MachineContext` no-op stubs. Call
  `seedRandomGenerator()` then `digDungeon()`.
- Build `stubs.ts`: no-op `ItemOps`/`MonsterOps`, minimal `BuildBridgeContext`.
- Render `pmap` as **colored rectangles** (TileType → color lookup, no
  sprites). Validates generation without depending on the rendering pipeline.
- Depth input + seed input + Generate button.

**Success criteria:** A web page showing a color-coded dungeon map that
changes when depth/seed are adjusted. Rooms, corridors, lakes, chasms,
machine rooms visible at appropriate depths.

**Estimated effort:** 2–3 sessions.

### Phase 1b: Sprite Rendering

**Goal:** Render with actual sprites at proper scale, with basic layer
visibility toggles.

**Scope:**
- Build `query-context.ts`: construct `CellQueryContext` with terrain-only
  stubs (empty creatures/items, stubbed player/rogue, all cells VISIBLE).
  Requires auditing `getCellSpriteData` field access paths.
- Construct `TextRenderer` + `SpriteRenderer` with tileset loading from
  `rogue-ts/assets/tilesets/`.
- Wire `getCellSpriteData()` → `SpriteRenderer.drawCellLayers()`.
- Canvas component rendering 79×29 grid at configurable integer zoom
  (1x–4x, default 2x).
- React → `spriteDebug` singleton bridge for debug state.
- Per-layer visibility toggles (11 `RenderLayer` checkboxes).
- Lighting toggle: on = run `updateLighting()` (trace dependencies during
  this phase); off = set `lightMultiplierColor` to white on all cells.

**Estimated effort:** 2–3 sessions.

### Phase 2: Full V1

**Goal:** Complete the v1 feature set — all layer controls, fog toggle,
polished layout.

**Scope:**
- Per-layer tint controls (enable/disable, color picker, alpha slider).
- Per-layer alpha slider and blend mode dropdown.
- Background color override.
- Fog-of-war visibility state toggle (toolbar dropdown).
- `tmap` initialization per fog state selection.
- Resizable bottom panel divider.
- Reset All button.
- Dark monospace theme polish.

**Estimated effort:** 2–3 sessions.

---

## Open Questions

1. **`updateLighting()` dependency surface.** When the lighting toggle is
   on, the tool needs to call `updateLighting()`. Its transitive dependencies
   have not been fully traced — it may require game state beyond `pmap`/`tmap`.
   Phase 1b will resolve this. If the dependencies are too heavy, the tool
   defaults to lighting-off mode and lighting support moves to the roadmap.

### Resolved

- **Can `digDungeon` run outside the bootstrap?** Yes. The generation
  modules (`architect/*.ts`, `math/rng.ts`, `dijkstra/*.ts`) do not import
  `core.ts`. The `ArchitectContext` DI interface provides all dependencies
  explicitly.
- **Can `MachineContext` be stubbed?** Yes. All 20 `itemOps`/`monsterOps`
  call sites are null-safe or failsafe-protected. See
  [MachineContext Stubbing](#machinecontext-stubbing).
- **Can `getCellSpriteData` work without the full IO system?** Yes.
  It takes a `CellQueryContext` parameter. Imports from
  `monster-queries.ts`, `item-inventory.ts`, etc. are resolved by the
  bundler but only called when creatures/items exist.
- **How does RNG seeding work?** Call
  `seedRandomGenerator(BigInt(seed))` from `math/rng.ts` before generation.
  Sets module-level state, no `core.ts` dependency.
- **Monorepo tooling?** Follow the sprite assigner pattern: independent
  `package.json` with Vite `resolve.alias` pointing to `rogue-ts/src/`.
  No workspace configuration needed.
- **Import-time side effects?** Verified: generation and rendering modules
  are clean of `core.ts` imports. Runtime callback behavior is the
  remaining risk, addressed by the DI architecture.
- **Where does `depthAccelerator` come from?** In the game it lives on
  `PlayerCharacter`. For the tool, initialize to 0 in `BuildBridgeContext`.
- **Canvas vs. OffscreenCanvas?** Main-thread `Canvas2D`. The tool renders
  one static frame per generation (no animation loop except future
  `colorDances`).

---

## Risks

- **`rogue`/`player` stub complexity (MEDIUM).** `getCellSpriteData`
  checks many `PlayerCharacter` fields across 500+ lines. The stub must be
  built by auditing every access path — not guessing. This is Phase 1b's
  primary risk. Mitigation: systematic line-by-line audit of
  `getCellSpriteData`, building the stub incrementally with tests.

- **Build complexity (MEDIUM).** The tool resolves imports from
  `rogue-ts/src/` (TypeScript files with `.js` extension specifiers,
  Vite-specific `?url` imports for assets). The Vite config needs aliases
  and possibly custom resolution rules. The sprite assigner solved a
  simpler version of this.

- **UI extraction breakage (LOW).** The active `ui-extraction` initiative
  may change `SpriteRenderer`'s constructor signature or `CellRect` type.
  Monitor these two interfaces and validate after the initiative completes.

- **Maintenance burden (LOW).** Two tools plus the game, all importing from
  `rogue-ts/src/`. The tool's import surface is wider than the assigner's
  (generation + full rendering pipeline). Changes to game rendering or
  generation code affect the tool. Manageable with narrow, well-defined
  factory modules (`generate-level.ts`, `query-context.ts`).

---

## Appendix: Design Space

These alternatives were evaluated and rejected. Kept for reference.

### Option B: Addon to Sprite Assigner V2

Extend `tools/sprite-assigner-v2/` with a dungeon preview tab.

**Rejected because:** Grafting dungeon generation and a full rendering
pipeline onto the sprite assigner adds significant complexity to a tool
with a clear, focused purpose. The assigner would become a monolith.
The assigner's server middleware would need to host generation logic,
and the dependency surface (tile catalog, RNG, grid utils, architect,
machines, lakes, lighting) is too large for a tool built around
assignment state and sheet management.

### Option C: Shared Library, Two Entry Points

Extract shared infrastructure (tileset loading, sprite maps, renderer
construction) into `tools/shared/`. Both tools import from it.

**Rejected because:** Premature abstraction. The "shared" code is small
(tileset loading, sprite maps). The real complexity is in game modules
(generation, lighting, appearance) which the assigner doesn't use.
One consumer for the shared package doesn't justify the overhead.

### Option D: Headless Game in Hidden Iframe

Run the full game in a hidden `<iframe>` with its own bootstrap and canvas.
Use `postMessage` to command generation. The iframe serializes `pmap`/`tmap`
to the parent tool for rendering.

**Rejected because:** Option A is confirmed viable, making the iframe's
isolation unnecessary. The iframe approach is a legitimate pattern
(serialization overhead is trivial at ~50KB per level, and the iframe
only needs to generate — rendering and debug controls stay in the parent),
but it adds protocol complexity that isn't needed.

**Would reconsider if:** Option A had required refactoring more than ~3
game source files. It didn't.

### Option E: Web Worker Isolation (not formally evaluated)

A lighter variant of Option D: run `digDungeon` in a Web Worker whose
module scope naturally isolates global state. Worker posts serialized
`pmap`/`tmap` back to the main thread.

**Not pursued because:** Option A's import isolation is sufficient —
no `core.ts` entanglement in the generation path.
