# Layer Compositing Model — Plan

## Approach

Build a parallel sprite data path that reads game world state (`pmap`,
creatures, items, visibility) and produces per-layer sprite data with
per-layer tint colors for the renderer. This replaces the ad-hoc two-layer
logic in `SpriteRenderer.drawCell()` with a general compositing pipeline.

The work has three pillars:

1. **Shared cell-query functions** — extract visibility, creature, and item
   lookup logic from `getCellAppearance` into reusable pure functions. Both
   `getCellAppearance` (ASCII path) and `getCellSpriteData` (sprite path)
   call these, eliminating duplicated logic and maintenance drift.

2. **Parallel sprite data path** — `getCellSpriteData()` reads `pmap`
   directly and returns a `CellSpriteData` containing a sparse
   `(LayerEntry | undefined)[]` array indexed by `RenderLayer`, where each
   `LayerEntry` carries separate optional `tileType` / `glyph` fields, a
   tint color, and optional alpha. This is closest to how DCSS works
   (separate tile-specific data path).

3. **Per-layer tinting** — each layer's sprite is multiply-tinted with its
   own color derived from the game state, using the existing offscreen canvas
   approach. This preserves Brogue's per-cell lighting variation in sprite
   mode.

### Key design decisions

**Parallel sprite data path (Option B).** Brogue has abstract game world
data (`pmap` with 4 DungeonLayer slots per cell, creature/item lists). The
existing `getCellAppearance()` flattens this into one glyph + two colors
for the ASCII renderer. Rather than enriching that pipeline, we build a
parallel one for sprite mode. The two paths share query functions but
produce different output formats (flat vs. layered).

**Per-layer tinting (not single-fg).** The ASCII pipeline produces one fg/bg
color pair per cell — the "winning" element's colors. For multi-layer sprite
cells, this single fg color is wrong (e.g., creature's red tints the terrain
sprite). Instead, `getCellSpriteData` computes per-layer tint colors from
the game state: terrain gets terrain's lit color, entity gets entity's lit
color. Existing color helpers (`bakeTerrainColors`,
`colorMultiplierFromDungeonLight`) are reused.

**Sparse-array CellSpriteData.** Layers are stored in a
`(LayerEntry | undefined)[]` of length `RENDER_LAYER_COUNT` (10), indexed
by `RenderLayer` enum values, rather than a flat struct with named fields
or a `Map`. This gives the same extensibility as a Map (adding STATUS, BOLT,
UI = filling higher indices) with far less allocation overhead — a fixed-
length array vs. `new Map()` + `.set()` calls per cell per frame. The
renderer iterates with a simple `for` loop; `undefined` entries (missing
layers) are skipped. For 2291 viewport cells, this avoids ~2291 Map
allocations + iterator objects per redraw.

**LayerEntry uses two optional fields, not a union.** `tileType?: TileType`
and `glyph?: DisplayGlyph` are separate optional fields on `LayerEntry`.
Both `TileType` and `DisplayGlyph` are `number` enums that share numeric
ranges — a single `tile: TileType | DisplayGlyph` field would be ambiguous
at runtime. The existing `resolveSprite(tileType, glyph)` already takes
them as separate parameters; `LayerEntry` mirrors this. Terrain, surface,
gas, and fire layers use `tileType`; entity and item layers use `glyph`;
both may be set when a TileType sprite map has the entity (future).

**Remembered cells use snapshot data.** A new `rememberedLayers: TileType[]`
field on `Pcell` stores a snapshot of `layers[]` when a cell transitions from
visible to remembered. Indexed by `DungeonLayer` (4 entries: Dungeon,
Liquid, Surface, Gas), matching the source `pmap.layers[]` layout.
`getCellSpriteData` reads `rememberedLayers` for remembered cells, not live
`pmap`, then classifies the TileTypes into RenderLayers. This prevents
gameplay information leaks (e.g., a door opening while the player is away).

**No tinting was NOT chosen.** Research confirmed no other roguelike does
runtime per-pixel tinting (DCSS and CDDA pre-bake colors). But Brogue's
continuous per-cell lighting is gameplay-critical. Removing tinting creates
a visual regression where sprite mode looks flatter than text mode. We keep
the offscreen canvas multiply tinting and apply it per-layer.

**CellQueryContext bundles shared closure captures.** Both
`getCellAppearance` and `getCellSpriteData` closures need the same ~15
game-state references (pmap, tmap, tileCatalog, dungeonFeatureCatalog,
monsterCatalog, terrainRandomValues, displayDetail, scentMap, rogue,
player, monsters, dormantMonsters, floorItems, displayBuffer). A
`CellQueryContext` interface makes this coupling explicit — both closures
take the same context object rather than independently listing 15
parameters. If a new parameter is added for a future game mechanic, the
compiler enforces that both paths receive it.

**Hybrid mode removed.** `GraphicsMode.Hybrid` (environment glyphs as
sprites, creatures/items as text) adds dispatch complexity without clear
user value. The initiative removes it, simplifying `plotChar` to a clean
Text ↔ Tiles toggle. The `isEnvironmentGlyph` gating is removed; `useTiles`
becomes `graphicsMode === Tiles && isInDungeonViewport(x, y)`.

**What's research-confirmed vs. first-principles:**
- Research-confirmed: Layer count (~9-11), layer ordering (terrain → surface →
  item → entity → gas → UI), layer-based draw loop (CDDA pattern), gas as
  dedicated layer (DCSS), items/entities mutually exclusive per cell.
- First-principles / Brogue-specific: Parallel sprite data path (driven by
  Brogue's plotChar abstraction), layer decomposition from DungeonLayer slots,
  gas volume → alpha mapping, fire as dedicated layer, per-layer tint colors.

### Layer stack (10 layers)

> **Note:** The exploration doc (Section 3.S, 4d) references 11 layers. This
> plan defines 10 — the VISIBILITY layer was removed from the array (it's a
> renderer behavior driven by `visibilityState`, not a `LayerEntry`). The
> exploration doc is updated in Phase 7 to reflect this.

| #   | Layer      | Content                                                  | Blend                      | Data Source                                          |
| --- | ---------- | -------------------------------------------------------- | -------------------------- | ---------------------------------------------------- |
| 0   | TERRAIN    | Floor, wall, liquid, chasm, ice, bridge                  | Opaque (full-cell sprite)  | Winner of `layers[Dungeon]` vs `layers[Liquid]` by `drawPriority` |
| 1   | SURFACE    | Foliage, fungus, blood, debris, web, netting (~30 types) | Alpha + multiply tint      | `pmap[x][y].layers[Surface]`                         |
| 2   | ITEM       | Item on ground (potion, weapon, scroll)                  | Alpha + multiply tint      | Floor item at (x,y) when no creature                 |
| 3   | ENTITY     | Player, monster (hallucination-aware)                    | Alpha + multiply tint      | Creature at (x,y)                                    |
| 4   | GAS        | Poison gas, steam, confusion gas, healing cloud          | Alpha (volume-based) + tint | `pmap[x][y].layers[Gas]` + `volume` (non-fire only) |
| 5   | FIRE       | Plain fire, brimstone fire, gas fire, embers             | Alpha + multiply tint      | Fire TileTypes from DungeonLayer.Gas                 |
| 6   | VISIBILITY | Visibility-state overlay (remembered, clairvoyant, etc.) | Semi-transparent colored fill | `visibilityState` enum on CellSpriteData            |
| 7   | STATUS     | On-fire, entranced, paralyzed overlays                   | Future (Initiative 5)      | —                                                    |
| 8   | BOLT       | Bolt trail, thrown item arc                               | Future (Initiative 7)      | —                                                    |
| 9   | UI         | Cursor, path preview, targeting                          | Future                     | —                                                    |

Layers 0–6 are implemented in this initiative. Layers 7–9 exist in the enum
as placeholders for future initiatives.

The VISIBILITY layer is not a `LayerEntry` in the array — it's a renderer
behavior triggered by the `visibilityState` field on `CellSpriteData`.
After all sprite layers are drawn, the renderer draws a semi-transparent
colored overlay matching the visibility state (dark for remembered, green
for clairvoyant, blue for telepathic, etc.).

### Interfaces

```typescript
enum RenderLayer {
  TERRAIN = 0,
  SURFACE = 1,
  ITEM = 2,
  ENTITY = 3,
  GAS = 4,
  FIRE = 5,
  VISIBILITY = 6,
  STATUS = 7,
  BOLT = 8,
  UI = 9,
}
const RENDER_LAYER_COUNT = 10;

enum VisibilityState {
  Visible = 0,
  Remembered = 1,
  Clairvoyant = 2,
  Telepathic = 3,
  MagicMapped = 4,
  Omniscience = 5,
  Shroud = 6,       // undiscovered — empty cell, no layers
}

interface LayerEntry {
  tileType?: TileType;      // terrain, surface, gas, fire layers
  glyph?: DisplayGlyph;     // entity, item layers (creature/item displayChar)
  tint: Color;
  alpha?: number;            // volume-based transparency (gas layer)
}

interface CellSpriteData {
  layers: (LayerEntry | undefined)[];  // length RENDER_LAYER_COUNT, indexed by RenderLayer
  bgColor: Color;                      // cell background fill (terrain bg under lighting)
  visibilityState: VisibilityState;
}

interface CellQueryContext {
  pmap: Pcell[][];
  tmap: readonly (readonly Tcell[])[];
  displayBuffer: ScreenDisplayBuffer;
  rogue: PlayerCharacter;
  player: Creature;
  monsters: readonly Creature[];
  dormantMonsters: readonly Creature[];
  floorItems: readonly Item[];
  tileCatalog: readonly FloorTileType[];
  dungeonFeatureCatalog: readonly DungeonFeature[];
  monsterCatalog: readonly CreatureType[];
  terrainRandomValues: readonly (readonly (readonly number[])[])[];
  displayDetail: readonly (readonly number[])[];
  scentMap: readonly (readonly number[])[];
  monsterFlagsList: readonly number[];  // pre-computed monsterCatalog.map(m => m.flags)
}
```

`monsterFlagsList` is pre-computed once per context build (not per cell) to
avoid per-cell array allocation during hallucination randomization. Both
`getCellAppearance` and `getCellSpriteData` use it instead of inline
`monsterCatalog.map(m => m.flags)`.

The renderer iterates `layers` by index from 0 to `RENDER_LAYER_COUNT - 1`,
skipping `undefined` entries. `getCellSpriteData` fills entries at their
`RenderLayer` index. Only layers with data are non-undefined — an empty
cell has all-undefined entries.

**Object reuse.** To avoid allocating ~2291 `CellSpriteData` objects per
frame (one per viewport cell), `getCellSpriteData` reuses a single mutable
`CellSpriteData` instance. The caller (spriteRenderer.drawCellLayers) reads
it synchronously before the next cell overwrites it. `LayerEntry` objects
within the array are similarly reused from a small pool.

**Color object ownership:** Each pooled `LayerEntry` owns a persistent
`Color` object. `getCellSpriteData` overwrites all 8 Color fields in place:
`red`, `green`, `blue`, `redRand`, `greenRand`, `blueRand`, `rand`,
`colorDances`. Omitting the rand fields breaks `bakeTerrainColors` (which
consumes and zeroes them); omitting `colorDances` breaks color-dance
detection. Same for `CellSpriteData.bgColor`. This avoids ~4 Color
allocations per cell per frame (~9K/frame). `drawCellLayers` must not hold
references to LayerEntry or Color objects past its return — the pool
reclaims them for the next cell.

### Data flow (sprite mode)

```
Game logic modifies pmap, creatures, items
  │
  ├── getCellAppearance() → flat display buffer (for ASCII + dirty-rect diffing)
  │     uses shared cell-query functions
  │     (unchanged — still drives text mode and change detection)
  │
  └── commitDraws() diffs display buffer → plotChar() for changed cells
        │
        ├── Text mode: textRenderer.drawCell(cellRect, glyph, fg, bg)
        │
        └── Sprite mode: getCellSpriteData(dungeonX, dungeonY) → CellSpriteData
              uses shared cell-query functions + color helpers
              └── spriteRenderer.drawCellLayers(cellRect, spriteData)
                    ├── Fill cell with spriteData.bgColor
                    ├── For each defined entry in spriteData.layers[]:
                    │     resolveSprite(entry.tileType, entry.glyph)
                    │     drawSpriteTinted(sprite, entry.tint, entry.alpha)
                    └── Apply visibility overlay per spriteData.visibilityState
```

In sprite mode, the fg/bg colors from `plotChar` are NOT used for sprite
rendering — `CellSpriteData` carries its own per-layer tint colors and
bgColor. The `plotChar` fg/bg are still used for change detection and for
text-mode cells (sidebar, messages).

### Wiring

`getCellSpriteData` is built as a closure (capturing pmap, creatures, items,
tileCatalog, tmap, terrainRandomValues, displayDetail, scentMap, etc.) —
same pattern as `getCellAppearance`, built at the same call site (likely
`buildInputContext` or wherever `getCellAppearance`'s closure is
constructed). Registered on the browser console via a setter:

```typescript
browserConsole.setCellSpriteDataProvider = (fn) => { getCellSpriteDataFn = fn; };

// In plotChar, when sprite mode (Hybrid removed — clean Text/Tiles toggle):
// useTiles = graphicsMode === Tiles && isInDungeonViewport(x, y)
if (useTiles && getCellSpriteDataFn) {
  const dx = x - (STAT_BAR_WIDTH + 1);
  const dy = y - MESSAGE_LINES;
  const spriteData = getCellSpriteDataFn(dx, dy);
  spriteRenderer.drawCellLayers(cellRect, spriteData);
}
```

### Key files

| File                                              | Change                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `rogue-ts/src/io/cell-queries.ts`                 | NEW: shared cell-query functions extracted from getCellAppearance                       |
| `rogue-ts/src/platform/render-layers.ts`          | NEW: RenderLayer enum, LayerEntry, CellSpriteData, TileType classification             |
| `rogue-ts/src/io/sprite-appearance.ts`            | NEW: getCellSpriteData() — parallel data path, per-layer data + tint colors            |
| `rogue-ts/src/platform/sprite-renderer.ts`        | Add drawCellLayers(); keep drawSpriteTinted for per-layer tinting                      |
| `rogue-ts/src/platform/browser-renderer.ts`       | Add setCellSpriteDataProvider; plotChar calls it for sprite-mode cells; remove Hybrid mode gating |
| `rogue-ts/src/platform/glyph-sprite-map.ts`       | Remove getBackgroundTileType + buildForegroundBackgroundMap; add surface/gas/fire maps  |
| `rogue-ts/src/types/types.ts`                     | Add rememberedLayers to Pcell                                                          |
| `rogue-ts/src/io/cell-appearance.ts`              | Refactor to use shared cell-query functions (no behavior change)                       |
| `rogue-ts/tests/io/cell-queries.test.ts`          | NEW: tests for shared query functions                                                  |
| `rogue-ts/tests/io/sprite-appearance.test.ts`     | NEW: tests for getCellSpriteData                                                       |
| `rogue-ts/tests/platform/sprite-renderer.test.ts` | Rewrite/extend for drawCellLayers; layer compositing + per-layer tinting tests         |

Files NOT touched (ASCII path preserved):
- `renderer.ts` — Renderer interface unchanged
- `text-renderer.ts` — unchanged
- `display.ts` — plotCharWithColor/plotCharToBuffer unchanged
- `platform.ts` — commitDraws unchanged

### Per-layer tint color sources

Each layer's tint color comes from the game state, using existing color
helper functions:

| Layer   | Tint color source                                                         |
| ------- | ------------------------------------------------------------------------- |
| TERRAIN | `tileCatalog[terrainType].foreColor` × lighting × `bakeTerrainColors`     |
| SURFACE | `tileCatalog[surfaceType].foreColor` × lighting × `bakeTerrainColors`     |
| ITEM    | Item's display foreColor × lighting                                       |
| ENTITY  | Creature's display foreColor × lighting                                   |
| GAS     | `tileCatalog[gasType].foreColor` (emissive — no lighting)                 |
| FIRE    | `tileCatalog[fireType].foreColor` (emissive — no lighting)                |

Background fill (`bgColor`) comes from the terrain's background color under
current lighting × `bakeTerrainColors` — same computation as
`getCellAppearance` uses for the bg.

The color helpers `bakeTerrainColors` (in `display.ts`) and
`colorMultiplierFromDungeonLight` (in `color.ts`) already exist as standalone
functions. `getCellSpriteData` calls them per-layer rather than once for the
flattened result. The closure captures `terrainRandomValues` so
`bakeTerrainColors` can apply per-cell color variation.

### Color fidelity matrix

`getCellAppearance` applies ~10 post-processing steps to colors.
`getCellSpriteData` must consciously handle each. This matrix documents the
treatment of every step — replicate, reinterpret, or intentionally skip.
**Built during Phase 4a; referenced thereafter.**

| # | getCellAppearance step               | Sprite-mode treatment                           | Rationale                                                               |
|---|--------------------------------------|-------------------------------------------------|-------------------------------------------------------------------------|
| 1 | drawPriority-based fore/back/char    | **Replicate per-layer**: each layer's TileType determines its own tint from tileCatalog | Layers are separate; each has its own tile, no priority flattening needed |
| 2 | lightMultiplierColor × foreColor     | **Replicate per-layer**: apply `colorMultiplierFromDungeonLight` to each layer's tint   | Preserves per-cell lighting variation — gameplay-critical                |
| 3 | lightMultiplierColor × backColor     | **Replicate**: bgColor gets same lighting                                                | Background fill must match                                              |
| 4 | Gas augment (applyColorAverage)      | **Reinterpret**: gas is a separate translucent layer, not a color blend. Gas layer alpha replaces gas augment weight | Separate layer is visually clearer than color blending                   |
| 5 | bakeTerrainColors (terrain randomize)| **Replicate per-layer**: apply to each layer's tint using cell's `terrainRandomValues`   | Preserves per-cell color variation; without it, sprite mode looks flat   |
| 6 | Visibility tinting (6 branches)      | **Replicate as post-compositing overlay**: `VisibilityState` enum drives colored overlay | See visibility-state tinting section below                              |
| 7 | Path highlighting (yellow average)   | **Skip**: path highlighting is a UI overlay (future Initiative)                          | Path preview renders through existing text overlay path                  |
| 8 | Hallucination color randomization    | **Replicate per-layer**: apply `randomizeColor` to each layer's tint when hallucinating, with weight `40 * halLevel / 300 + 20` | Color chaos is the hallucination visual identity; without it sprite mode lacks the psychedelic effect |
| 9 | separateColors                       | **Skip**: separate sprites are inherently visually distinct                               | No need for color separation when shapes differ                         |
| 10| Stealth range (orange tint)          | **Defer**: niche mode, add as post-compositing overlay if needed                         | Low priority; stealth range is a debug/advanced feature                 |
| 11| True-color displayDetail refinements | **Defer**: niche mode, capture `displayDetail` in closure for future                     | Low priority; true-color mode is optional                               |
| 12| Deep water (inWater) tint            | **Replicate per-layer**: multiply each layer's tint by `deepWaterLightColor` when `rogue.inWater` is true | Whole-screen tint during gameplay-critical drowning state — not niche   |
| 13| TERRAIN_COLORS_DANCING flag          | **Replicate**: after `bakeTerrainColors`, check layer tint `colorDances` fields; set pmap `TERRAIN_COLORS_DANCING` flag so color-dance refresh cycle includes this cell | Without it, sprite-mode cells with dancing colors (torches, luminescent caves) won't animate |

Steps marked **Defer** may be revisited if visual results are
unsatisfactory. The matrix is the decision record — updates go here, not
in ad-hoc code comments.

**Sub-step note for row 2:** Several visibility branches (clairvoyant,
telepathic, omniscience) augment the light multiplier with
`applyColorAugment(lm, basicLightColor, 100)` before applying to colors.
`getCellSpriteData` must replicate this augmentation for those specific
visibility states.

### Visibility-state tinting

`getCellAppearance` has six mutually exclusive visibility branches that
apply different colored tints to the flattened cell. The sprite path
replicates these as post-compositing overlays driven by
`CellSpriteData.visibilityState`:

| VisibilityState | Overlay behavior                                         | Matches getCellAppearance branch          |
|-----------------|----------------------------------------------------------|-------------------------------------------|
| Visible         | No overlay                                               | Fully visible path (light multiply only)  |
| Remembered      | Multiply fill: `globalCompositeOperation='multiply'` + `fillRect(memoryColor)` | memoryColor multiply path                 |
| Remembered (inWater) | Heavy dark fill: `applyColorAverage(black, 80)` equivalent | Underwater remembered path               |
| Clairvoyant     | Multiply fill: `globalCompositeOperation='multiply'` + `fillRect(clairvoyanceColor)` | clairvoyanceColor multiply path |
| Telepathic      | Multiply fill: `globalCompositeOperation='multiply'` + `fillRect(telepathyMultiplier)` | telepathyMultiplier multiply path |
| MagicMapped     | Multiply fill: `globalCompositeOperation='multiply'` + `fillRect(magicMapColor)` | magicMapColor multiply path |
| Omniscience     | Multiply fill: `globalCompositeOperation='multiply'` + `fillRect(omniscienceColor)` | omniscienceColor multiply path |
| Shroud          | No layers drawn; cell left as canvas background          | Early return with undiscoveredColor        |

All non-visible states use Canvas2D `multiply` composite mode — the same
`globalCompositeOperation` already used for sprite tinting. Remembered
cells use `memoryColor` multiply (matching ASCII mode's blue-tinted
dimming), not a neutral dark alpha fill. When `rogue.inWater` is true,
remembered cells use a heavy dark fill instead (matching getCellAppearance's
`applyColorAverage(black, 80)` branch). This faithfully replicates
getCellAppearance's per-component multiply behavior: e.g., clairvoyance
green is subtractive (removes non-green channels), not additive (painting
green on top). Restore `globalCompositeOperation = 'source-over'` after
each multiply fill.

## Technical Notes

### Shared cell-query extraction

The following logic is extracted from `getCellAppearance` into
`cell-queries.ts` as pure functions:

- **Visibility classification**: visible / remembered / shroud — reads pmap
  flags and tmap
- **Creature lookup**: which monster (if any) is visible at this cell —
  handles hidden, submerged, revealed states using existing monster-query
  functions
- **Item lookup**: floor item at this cell — checks floor items list
- **MonsterQueryContext construction**: build from `CellQueryContext` fields
  (player, pmap, rogue.playbackOmniscience) so both `getCellAppearance`
  and `getCellSpriteData` use identically-constructed contexts

`getCellAppearance` is refactored to call these functions (behavior
unchanged, verified by existing tests). `getCellSpriteData` also calls them.

### Remembered cell data model

`Pcell` gets a new field:

```typescript
rememberedLayers: TileType[];  // indexed by DungeonLayer (4 entries)
```

Indexed by `DungeonLayer` (Dungeon=0, Liquid=1, Surface=2, Gas=3) — same
layout as the source `pmap[x][y].layers[]`. Snapshot via
`snapshotCellMemory` (extracted in Phase 1), which stores both
`rememberedAppearance` AND `rememberedLayers` at the STABLE_MEMORY
transition point in `getCellAppearance` (lines 376–394). Since
`getCellAppearance` runs before `getCellSpriteData` (via refreshDungeonCell
→ commitDraws → plotChar chain), the snapshot is always populated when
`getCellSpriteData` reads it.

`getCellSpriteData` reads `rememberedLayers` for remembered cells,
classifies the TileTypes into RenderLayers (Dungeon/Liquid → TERRAIN by
drawPriority, Surface → SURFACE), and suppresses entity, item, gas, and
fire layers. For magic-mapped cells (`VisibilityState.MagicMapped`),
SURFACE is also suppressed — matching getCellAppearance's limited terrain
loop that scans only Dungeon and Liquid layers for magic-mapped cells.
The VISIBILITY overlay is drawn on top.

**Remembered-cell lighting:** Remembered cells use base tileCatalog colors
with no lighting applied (not current `tmap` lighting, which may have
changed since the player last saw the cell). The Remembered visibility
overlay (`memoryColor` multiply fill) provides the blue-tinted dimming,
faithfully matching ASCII mode's iconic fog-of-war appearance. The
remaining divergence from ASCII mode (which stores fully-processed colors
including lighting at snapshot time) is that remembered sprite cells lose
the lighting tint they had when last seen. This is acceptable — the
`memoryColor` multiply dominates the visual result in both paths.

**Save/load implication:** `rememberedLayers` must be serialized alongside
existing Pcell fields. If the persistence initiative (`port-v2-persistence`)
has already defined the save format, `rememberedLayers` needs to be added
to the serialization schema. Until serialization is implemented, loaded
levels will have empty `rememberedLayers` — remembered cells in sprite mode
will show no terrain after a save/load cycle. Coordinate with the
persistence initiative.

### CellSpriteData extensibility

The sparse-array design (`(LayerEntry | undefined)[]` indexed by
`RenderLayer`) is chosen over a flat struct so that future initiatives
(STATUS, BOLT, UI layers) can fill higher indices without changing the
`CellSpriteData` interface or iteration logic. If the `LayerEntry` type
itself needs per-layer-type fields (e.g., animation frame for BOLT, icon
set for STATUS), consider evolving `LayerEntry` into a discriminated union:

```typescript
type LayerEntry = TerrainEntry | SurfaceEntry | EntityEntry | GasEntry | ...;
```

This is not needed now — all active layers share the same shape
(tileType/glyph + tint + optional alpha). Document this as the upgrade
path.

### Change detection coupling

Sprite-mode redraws are triggered by ASCII-mode dirty-rect diffing in
`commitDraws`. `getCellSpriteData` is called when `plotChar` fires for a
changed cell, so the sprite data is always fresh when queried. The risk is
cells NOT being redrawn: if sprite-relevant state changes without affecting
the flattened ASCII appearance, the cell won't be redrawn.

**Concrete risk scenario:** gas volume decreases from 50→30. In ASCII mode,
this changes the gas augment weight, shifting fg/bg colors. If the color
shift is below the threshold of the 3-component diff in `commitDraws`, the
cell won't redraw — and the sprite gas layer's alpha (which would change
from ~0.5 to ~0.3) won't update.

In practice, Brogue's `getCellAppearance` is comprehensive — gas volume,
lighting, creature visibility changes all affect the flattened fg/bg colors,
triggering redraws. But edge cases are possible. Remediation options (in
order of preference):

1. **Per-cell spriteDirty flag** — set by game logic when sprite-relevant
   state changes, checked alongside `commitDraws` color diff. Low overhead.
2. **Include layer-relevant state in dirty hash** — e.g., gas volume,
   creature presence — stored in prev buffer alongside color components.
3. **Forced full redraw in sprite mode** — brute force, expensive (~7
   drawSpriteTinted calls × 2291 cells), last resort.

Option 1 is preferred but deferred until bugs actually emerge.

**Phase 5 diagnostic:** During testing, add a debug-mode check: when sprite
mode is active, compare the previous `CellSpriteData` layers with the
current one for cells that `commitDraws` didn't mark as changed. If layer
data differs, log a warning. This catches the edge case early without
building the full `spriteDirty` infrastructure.

### Animation state (future consideration)

`getCellSpriteData` is stateless — recomputed from live game state each time
`plotChar` fires. Initiative 7 (Animation) will need per-cell animation state
that persists across renders (current frame index, animation progress timer).
This is additive: a separate `CellAnimationState` map alongside
`CellSpriteData`, not a replacement. Worth designing when Initiative 7 is
planned — no structural changes needed in this initiative to accommodate it.

### TERRAIN layer: Dungeon vs Liquid priority

When both `layers[Dungeon]` and `layers[Liquid]` are non-zero (e.g., bridge
over lava), `getCellSpriteData` picks the winner by `drawPriority` from
`tileCatalog` — same logic as `getCellAppearance`'s terrain loop. The
winner's TileType goes into the TERRAIN `LayerEntry.tileType`. The loser is
not drawn as a separate sprite — it contributes only to `bgColor` (via its
`backColor` × lighting). This matches the ASCII path, which also picks a
single winning glyph.

If visual quality demands showing both (e.g., bridge sprite over visible
lava sprite), a future enhancement could split TERRAIN into TERRAIN_BASE
and TERRAIN_FEATURE sub-layers. Not needed now — the bgColor fill provides
the visual cue.

### Invisible-monster-in-gas silhouette

`getCellAppearance` (lines 350–366) handles a special case: when a creature
is invisible and standing in gas, the creature's glyph is drawn but with
`cellForeColor = cellBackColor`, creating a subtle silhouette visible only
because it displaces the gas cloud. `getCellSpriteData` replicates this:
when a creature is invisible, gas is present, and the creature isn't
revealed or hidden by submersion, the ENTITY layer is populated with the
creature's glyph but tinted with the gas layer's color (making a ghost
silhouette against the gas). This preserves the gameplay-relevant visual
cue from ASCII mode.

### Progressive cell sizing (already implemented)

`cellLeftEdge` and `cellTopEdge` in `browser-renderer.ts` already implement
tiles.c-style progressive integer-division cell sizing:
`cellX = Math.floor(col * canvasWidth / cols)`. No additional work needed.

### Performance budget

Color dance redraws the entire viewport every 36 ms (`PAUSE_BETWEEN_EVENT_
POLLING`). Per-layer tinting via the offscreen canvas requires 5 canvas
operations per layer per cell (clearRect, drawImage source, fillRect
multiply, drawImage destination-in, drawImage blit). Worst case for a
4-layer cell: 20 canvas ops. For 2291 viewport cells: ~46K canvas ops in
36 ms.

**Mitigations already built into the plan:**
- Object reuse (single mutable CellSpriteData, LayerEntry pool)
- Sparse array (no Map allocation/iteration overhead)
- Most cells have 1-2 layers, not 4
- Skip-tinting fast path: when a layer's tint is near-white (all
  components ≈ 100), skip the offscreen canvas multiply and drawImage
  directly — saves 4 of 5 ops for that layer
- `ImageBitmap` pre-creation from tileset sub-regions at init time via
  `createImageBitmap(img, sx, sy, TILE_SIZE, TILE_SIZE)`. Replaces
  `HTMLImageElement` source in `drawSpriteTinted`, eliminating per-frame
  sub-region extraction overhead. Implemented in Phase 5.
- `OffscreenCanvas` for the tint canvas: `new OffscreenCanvas(TILE_SIZE,
  TILE_SIZE)` instead of `document.createElement('canvas')` to avoid DOM
  overhead. Drop-in replacement in `SpriteRenderer` constructor.

**Measurement:** Phase 5 includes a performance measurement task. If a full
79×29 redraw with multi-layer cells exceeds 16 ms, document the bottleneck
and evaluate:
1. Skip tinting for layers that are already pre-tinted (gas/fire emissive)
2. Reduce color dance to dungeon-viewport-only redraws (sidebar/message
   cells don't need color dance refresh)
3. Single-pass tint fallback (composite all layers untinted, then one
   multiply pass over the whole cell)
4. Viewport-sized offscreen canvas (composite all cells, blit once)
5. Batch offscreen canvas (wider canvas to amortize composite-mode switches)
6. WebGL migration (future initiative)

### Pre-baked memory tileset (future optimization)

At tileset load time, generate a second copy of every sprite with
`memoryColor` applied as a multiply filter (using the same tint canvas
approach). Remembered cells would draw from the memory tileset directly,
skipping the per-cell multiply overlay entirely. This is additive — the
multiply overlay approach works first and is correct; the pre-baked approach
is a performance optimization that can be layered on later. Not implemented
in this initiative.

### Sprite tint cache (future optimization)

Cache tinted sprite results keyed by `spriteRef + quantized tint color`
(8-bit per channel). Most cells don't change between frames (~85-95%
during color dance). Cached cells skip the 5-operation tint pipeline and
draw the cached `ImageBitmap` directly. Estimated memory: ~3.5MB for a
full viewport cache (2291 cells × 1.5 layers × 16×16×4 bytes). Implement
if the Phase 5 performance measurement shows the 16ms budget is blown
after the planned mitigations (ImageBitmap, OffscreenCanvas, skip-tinting
fast path) are applied. Not built in this initiative.

### Debug overlay system (future opportunity)

`CellQueryContext` + `VisibilityState` + the layer model naturally support
a debug overlay mode: show visibility states as colored borders, show
layer counts per cell, show tint colors as a tooltip. Not implemented in
this initiative but the data model supports it without structural changes.
Worth building as part of a future developer tooling effort.

### underlyingTerrain cleanup

The `underlyingTerrain` field was added to the display pipeline for the
foreground-tiles prototype. With the new layer model, TERRAIN + ENTITY
layers handle this naturally. This initiative removes `underlyingTerrain`
from: `CellDisplayBuffer`, `plotCharToBuffer` parameters, `commitDraws`
diff logic, and `plotChar` parameters. The existing `SpriteRenderer.drawCell`
fallback retains it during the transition period.

## Open Questions

1. ~~**Remembered overlay opacity.**~~ Resolved: use multiply fill with
   `memoryColor` (matching ASCII mode), not alpha fill. When `rogue.inWater`,
   use heavy dark fill instead. No opacity tuning needed — `memoryColor`
   values drive the result directly.
2. **Remembered gas/fire.** Should remembered cells show gas and fire sprites
   (with fog overlay on top), or suppress those layers? Starting with
   terrain+surface only for remembered cells.
3. **Shroud edge rendering.** Unexplored cells adjacent to explored cells —
   border/transition effect? Deferred to polish or future initiative.
4. ~~**rememberedLayers snapshot point.**~~ Resolved: snapshot via
   `snapshotCellMemory` at the STABLE_MEMORY transition point in
   `getCellAppearance` (lines 376–394), alongside `rememberedAppearance`.
   Extracted as a shared helper in Phase 1.

### Resolved questions

- ~~**Per-layer color accuracy.**~~ Resolved via the color fidelity matrix
  (see above). Each getCellAppearance post-processing step has a documented
  treatment. Start with the matrix; adjust if visual results are
  unsatisfactory.
- ~~**rememberedLayers indexing.**~~ Resolved: indexed by DungeonLayer (4
  entries), matching `pmap.layers[]` layout. Classified into RenderLayers
  at read time.
- ~~**LayerEntry tile type.**~~ Resolved: two optional fields (`tileType?`,
  `glyph?`) instead of a union. Avoids runtime ambiguity between number
  enums.
- ~~**Map vs array for layer storage.**~~ Resolved: sparse array indexed
  by RenderLayer for lower allocation overhead. Same extensibility.

## Rejected Approaches

- **No-tinting approach.** Defers tinting to a future initiative. Results in
  sprite mode looking visually flatter than text mode (no lighting variation).
  Players would perceive it as a regression. Rejected in favor of per-layer
  tinting from the start.
- **Single-fg tinting.** All layers tinted with the single fg color from
  `plotChar`. Simple but incorrect for multi-layer cells — terrain under a
  creature gets tinted with the creature's color, not the terrain's lit color.
- **Flat CellSpriteData struct.** One field per layer (terrainTileType,
  surfaceTileType, etc.). Simpler for 6 layers but requires interface changes
  when future initiatives add layers. Array-based approach is equally
  extensible with less allocation.
- **Map-based CellSpriteData.** `Map<RenderLayer, LayerEntry>` was the
  original design. Replaced by sparse array (`(LayerEntry | undefined)[]`)
  to avoid ~2291 Map allocations per frame. Same extensibility and
  iteration semantics (index loop vs insertion-order iteration), less GC
  pressure. The Map guarantee of insertion-order iteration is replaced by
  the natural ordering of array indices.
- **Union tile type (`tile: TileType | DisplayGlyph`).** Both are `number`
  enums with overlapping ranges. At runtime the resolver can't distinguish
  them. Replaced with two optional fields (`tileType?`, `glyph?`) matching
  the resolver's existing dual-parameter pattern.
- **Enriching getCellAppearance (Option A).** Adding layer data to the
  existing flat pipeline. Conflates two rendering concerns and risks breaking
  ASCII mode.
