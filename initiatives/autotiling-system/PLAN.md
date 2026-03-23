# Autotiling System — Plan

## Approach

Compute 8-bit adjacency bitmasks in `getCellSpriteData` (the sprite data
path) and store them on `LayerEntry`. The renderer uses the bitmask to
select from 47 variant sprites per connectable terrain type. Connection
groups enable cross-type neighbor matching.

Three components:

1. **Connection groups + bitmask algorithm** — A configuration module
   (`autotile.ts`) defining which TileTypes belong to which connection
   groups, the 8-bit bitmask computation function, and the 256→47 variant
   reduction table. Pure functions, no state.

2. **Data pipeline integration** — `getCellSpriteData` computes the bitmask
   for TERRAIN and SURFACE (liquid) layers and stores it as
   `LayerEntry.adjacencyMask`. Computed for all non-shroud visibility
   states: live-pmap cells use `layers`, remembered/magic-mapped cells
   use a visibility-aware accessor that reads effective neighbor data.

3. **Variant sprite lookup** — The renderer's `resolveSprite` gains an
   autotile path: when `adjacencyMask` is present, reduce it to a variant
   index (0–46) and look up the variant sprite from an autotile variant map.
   Placeholder: all 47 entries use the existing single sprite per TileType.

### Key design decisions

**Bitmask computed in getCellSpriteData (Option A).** The three options
were: (a) compute in `getCellSpriteData`, (b) compute in the renderer's
`resolveSprite`, (c) new middleware. Option A is chosen because
`getCellSpriteData` already reads `pmap` and knows `(x, y)` — no
architectural change needed. The renderer stays stateless, receiving all
data via `CellSpriteData`. Computing the bitmask is a data-derivation
concern ("what are the neighbors?"), not a rendering concern ("how to
draw?"). This avoids passing `pmap` to the renderer, which would break the
clean data/render separation established by the layer compositing
initiative. The decision aligns with the exploration doc's "Option B — in
the sprite renderer, at draw time" — `getCellSpriteData` IS part of the
draw-time rendering pipeline, called from `plotChar` during the draw cycle.

**Single connectionGroup per TileType (simplified CDDA model).** CDDA uses
two orthogonal fields: `connect_groups` (what group a tile belongs to) and
`connects_to` (what groups it connects to visually). For Brogue, a simpler
model suffices: each connectable TileType maps to one connection group
string. Two tiles connect if they share the same connectionGroup. This
handles all Brogue cases (walls→doors, deep→shallow water) without the
bidirectional complexity. If future terrain types need asymmetric
connections, the model can be upgraded to two-field.

**Raw bitmask on LayerEntry, reduced at lookup time.** `adjacencyMask`
stores the raw 8-bit bitmask (0–255), not the reduced variant index
(0–46). The raw bitmask is more informative for debugging (the F2 panel
can show exactly which neighbors are connected). The 256→47 reduction is a
simple array lookup — `BITMASK_TO_VARIANT[mask]` — performed when
resolving the sprite. O(1) with a precomputed 256-entry table.

**Autotiling for remembered cells.** Remembered cells compute their
bitmask from effective neighbor data: for each neighbor, check its
visibility state — use live `layers` for visible neighbors,
`rememberedLayers` for remembered/magic-mapped neighbors, treat
shroud and out-of-bounds per the group's `oobConnects` flag (WALL →
connecting, others → not connecting). This avoids a visible "pop"
when a cell transitions from visible (autotiled variant) to remembered
(generic sprite). The "information leak" concern is minimal — the
remembered data already reflects what the player last saw. If a door
opens while the player is away, the neighbor's `rememberedLayers` still
shows the old state. No new fields on `Pcell` are needed; the
computation is purely in the rendering pipeline via
`populateRememberedLayers`.

**Out-of-bounds behavior is per-group.** Each connection group declares an
`oobConnects` flag. WALL sets `oobConnects: true` — Brogue's map is always
surrounded by granite, so wall tiles at the edge should show "connected"
toward the boundary. All other groups set `oobConnects: false` — water,
lava, chasm, floor, ice, and mud never appear at the map edge in practice,
and treating OOB as connecting would incorrectly imply continuation of the
terrain into the void. The bitmask computation checks:
`if (tile === undefined) return groupInfo.oobConnects`. This is correct by
construction rather than relying on the map-edge-is-always-granite
invariant.

**Placeholder sprites: same sprite for all 47 variants.** The system is
built for correctness and extensibility without requiring new art. All 47
variant slots for each connectable TileType point to the existing single
sprite. When an artist provides real 47-variant spritesheets, each
TileType's autotile variant array gets populated with distinct sprites —
no code changes needed, only data. A debug overlay (bitmask value on each
cell) lets developers verify the algorithm works correctly before art
exists.

**Reference projects informing the design:**
- Excalibur.js (Section 3.5): TypeScript bitmask algorithm, neighbor offset
  pattern, 256→47 reduction concept
- CDDA (Section 3.3): connection groups concept, draw-time computation
  pattern, single-group simplification
- Godot (Section 3.4): "Match Corners and Sides" = 47-tile blob; algorithm
  documentation
- BrogueCE Issue #332 (Section 3.10): validates this direction for Brogue

## Technical Notes

### Bit ordering

Bits assigned clockwise from North, matching screen coordinates (y-down):

```
Bit 7: NW (-1,-1)   Bit 0: N (0,-1)    Bit 1: NE (1,-1)
Bit 6: W  (-1, 0)   [self]              Bit 2: E  (1, 0)
Bit 5: SW (-1, 1)   Bit 4: S (0, 1)    Bit 3: SE (1, 1)
```

Cardinal bits: N=0, E=2, S=4, W=6.
Diagonal bits: NE=1, SE=3, SW=5, NW=7.

Neighbor offset array (clockwise from N):
```typescript
const AUTOTILE_OFFSETS: readonly [number, number][] = [
  [0, -1],   // N   bit 0
  [1, -1],   // NE  bit 1
  [1, 0],    // E   bit 2
  [1, 1],    // SE  bit 3
  [0, 1],    // S   bit 4
  [-1, 1],   // SW  bit 5
  [-1, 0],   // W   bit 6
  [-1, -1],  // NW  bit 7
];
```

This is clockwise from N, not related to the codebase's `nbDirs` (N, S,
W, E, NW, SW, NE, SE) or `cDirs` (S, SE, E, NE, N, NW, W, SW) — the
autotile system uses its own constant for clarity.

### 256→47 reduction

The 8-bit bitmask has 256 possible values, but only 47 produce visually
distinct tile shapes. The reduction rule: **diagonal corners only matter
when both adjacent cardinal neighbors are connected.** For example, the NE
diagonal (bit 1) is irrelevant unless both N (bit 0) and E (bit 2) are
set. When N or E is clear, NE is cleared regardless of the actual neighbor.

Corner-clearing rules:
- NE (bit 1): requires N (bit 0) AND E (bit 2)
- SE (bit 3): requires S (bit 4) AND E (bit 2)
- SW (bit 5): requires S (bit 4) AND W (bit 6)
- NW (bit 7): requires N (bit 0) AND W (bit 6)

`VARIANT_CANONICAL_MASKS` is a **hardcoded** `readonly number[]` literal
(length 47) in `autotile.ts`, listing the 47 canonical bitmask values in
sorted ascending order. This is the contract with the art pipeline — the
sprite at position N in a spritesheet corresponds to canonical mask N.

`BITMASK_TO_VARIANT` is a `Uint8Array(256)` built at module load time
FROM the hardcoded `VARIANT_CANONICAL_MASKS`: for each raw bitmask 0–255,
apply corner-clearing to get the canonical form, then look up its index
in `VARIANT_CANONICAL_MASKS`. This is a one-time computation, not
repeated per frame.

A verification test independently computes the 47 canonical masks via the
corner-clearing algorithm (enumerate 256 → apply rules → collect unique →
sort) and asserts they match the hardcoded constant exactly. This catches
any accidental divergence between the hardcoded table and the algorithm.

The 47 variant indices correspond to a standard autotile spritesheet
layout (e.g., 8 columns × 6 rows, 48 slots with one unused).

### Connection groups

Each connectable TileType maps to exactly one connection group. The bitmask
computation checks each neighbor's TileType against the same group.

| Group | DungeonLayer | oobConnects | Member TileTypes |
|-------|-------------|-------------|------------------|
| WALL | Dungeon | true | GRANITE, WALL, SECRET_DOOR, TORCH_WALL, CRYSTAL_WALL, WALL_LEVER_HIDDEN, WALL_LEVER_HIDDEN_DORMANT, WALL_MONSTER_DORMANT, RAT_TRAP_WALL_DORMANT, RAT_TRAP_WALL_CRACKING, WORM_TUNNEL_OUTER_WALL, MUD_WALL, DOOR, OPEN_DOOR†, LOCKED_DOOR, PORTCULLIS_CLOSED, PORTCULLIS_DORMANT, WOODEN_BARRICADE, MUD_DOORWAY, TURRET_DORMANT, OPEN_IRON_DOOR_INERT |
| WATER | Liquid | false | DEEP_WATER, SHALLOW_WATER, FLOOD_WATER_DEEP, FLOOD_WATER_SHALLOW, MACHINE_FLOOD_WATER_DORMANT, MACHINE_FLOOD_WATER_SPREADING, DEEP_WATER_ALGAE_WELL, DEEP_WATER_ALGAE_1, DEEP_WATER_ALGAE_2 |
| LAVA | Liquid | false | LAVA, LAVA_RETRACTABLE, LAVA_RETRACTING, ACTIVE_BRIMSTONE, SACRIFICE_LAVA |
| CHASM | Dungeon | false | CHASM, CHASM_EDGE‡, MACHINE_COLLAPSE_EDGE_DORMANT, MACHINE_COLLAPSE_EDGE_SPREADING, MACHINE_CHASM_EDGE, CHASM_WITH_HIDDEN_BRIDGE, CHASM_WITH_HIDDEN_BRIDGE_ACTIVE, HOLE, HOLE_GLOW, HOLE_EDGE‡ |
| FLOOR | Dungeon | false | FLOOR, FLOOR_FLOODABLE, CARPET, MARBLE_FLOOR, DARK_FLOOR_DORMANT, DARK_FLOOR_DARKENING, DARK_FLOOR, MACHINE_TRIGGER_FLOOR, MACHINE_TRIGGER_FLOOR_REPEATING, MUD_FLOOR |
| ICE | Liquid | false | ICE_DEEP, ICE_DEEP_MELT, ICE_SHALLOW, ICE_SHALLOW_MELT |
| MUD | Liquid | false | MUD, MACHINE_MUD_DORMANT |

**†OPEN_DOOR in WALL group:** Open doors connect to walls because the door
frame is structurally part of the wall — the wall shape doesn't change when
a door swings open. CDDA uses the same approach. The door sprite itself
changes (closed → open), but adjacent wall autotile variants should remain
stable. If playtesting reveals this looks wrong, moving OPEN_DOOR to its
own group is a data-only change.

**‡CHASM_EDGE / HOLE_EDGE:** These are transition tiles whose sprite is
already visually edge-specific. Including them in the CHASM group means
they will compute a "connected interior" bitmask when surrounded by other
CHASM tiles, which could conflict with their inherent edge appearance once
real autotile art is applied. This is fine with placeholder sprites; when
CHASM autotile art is produced, the artist should know these types are in
the group and may need special treatment (their own sub-group, or
exclusion from autotiling). See Deferred section in TASKS.md.

**DungeonLayer per group:** The bitmask computation needs to check the
correct pmap layer for each neighbor. WALL/FLOOR/CHASM groups check
`pmap[nx][ny].layers[DungeonLayer.Dungeon]`. WATER/LAVA/ICE/MUD groups
check `pmap[nx][ny].layers[DungeonLayer.Liquid]`.

**Priority for autotile art (Initiative 8):** WALL (most visually
impactful — walls are everywhere), WATER, LAVA, CHASM. FLOOR, ICE, MUD
are lower priority — wall autotiling handles the wall-floor transition,
and ICE/MUD bodies are small. All groups get connection group assignments
now; autotile art is a separate concern.

### Bitmask computation

```typescript
function computeAdjacencyMask(
  x: number,
  y: number,
  groupMembers: Uint8Array,
  oobConnects: boolean,
  getNeighborTile: (nx: number, ny: number) => TileType | undefined,
): number
```

For each of 8 neighbor offsets, call `getNeighborTile(x + dx, y + dy)`.
If the result is `undefined` (out-of-bounds or shroud), use the group's
`oobConnects` value (true → bit set, false → bit clear). Otherwise check
group membership via `groupMembers[tile]`. Return the raw 8-bit bitmask
(0–255).

The accessor pattern (`getNeighborTile`) decouples bitmask computation
from data source. For live-pmap cells the caller provides
`(nx, ny) => coordinatesAreInMap(nx, ny) ? pmap[nx][ny].layers[dungeonLayer] : undefined`.
For remembered cells the caller provides a function that checks the
neighbor's visibility state and returns live `layers` for visible
neighbors, `rememberedLayers` for remembered neighbors, or `undefined`
for shroud. This avoids duplicating the bitmask loop.

**Group membership via `Uint8Array`.** TileType is a numeric enum with
max value ~200. Each connection group's member set is a
`Uint8Array(TILE_TYPE_COUNT)` where `array[tileType] = 1` for members
and `0` for non-members. This is simpler and faster than `Set.has()` for
integer keys — direct array index vs. hash lookup, ~18,400 checks per
frame. Built once at module load time from the declarative group
definitions.

### Data pipeline integration

`getCellSpriteData` computes the bitmask after populating TERRAIN and
SURFACE layer entries:

```
TERRAIN layer:
  1. dungeonTile = cell.layers[DungeonLayer.Dungeon]
  2. Look up dungeonTile in connection group config → get group + member set
  3. If group found: computeAdjacencyMask(x, y, DungeonLayer.Dungeon, members, pmap)
  4. Set entry.adjacencyMask = bitmask

SURFACE layer (liquid):
  1. liquidTile = cell.layers[DungeonLayer.Liquid]
  2. Look up liquidTile in connection group config → get group + member set
  3. If group found: computeAdjacencyMask(x, y, DungeonLayer.Liquid, members, pmap)
  4. Set entry.adjacencyMask = bitmask
```

The connection group lookup is a `Map<TileType, { group: string;
dungeonLayer: DungeonLayer; members: Uint8Array; oobConnects: boolean }>`
— O(1) per TileType. Pre-built at module load time from the group
configuration.

**Remembered / MagicMapped cells:** `populateRememberedLayers` computes
the bitmask using the same `computeAdjacencyMask` function with a
remembered-aware accessor:

```
For each neighbor (nx, ny):
  - Out of bounds → undefined (bit set/clear per oobConnects)
  - Visible/Clairvoyant/Omniscience → pmap[nx][ny].layers[dungeonLayer]
  - Remembered/MagicMapped → pmap[nx][ny].rememberedLayers[dungeonLayer]
  - Shroud → undefined (bit set/clear per oobConnects)
```

This ensures remembered walls retain their autotiled shape under the
fog-of-war overlay. The bitmask reflects what the player last saw — no
information leaks because `rememberedLayers` is snapshot data. The
`populateRememberedLayers` function already receives the full
`CellQueryContext` (which contains `pmap`), so no new dependencies are
needed.

**Initiative 9 migration note:** When liquids are promoted from SURFACE
to a dedicated LIQUID RenderLayer, the bitmask computation for liquid
tiles should move with them — it's attached to the `LayerEntry`, not
the `RenderLayer` index. The code in `getCellSpriteData` that computes
the liquid bitmask just needs its `acquireLayerEntry` call re-routed
from `RenderLayer.SURFACE` to `RenderLayer.LIQUID`.

### Variant sprite lookup

The autotile variant map extends the existing sprite lookup:

```typescript
autotileVariantMap: Map<TileType, SpriteRef[]>
```

Each entry is an array of 47 `SpriteRef` values indexed by variant index
(0–46). For placeholder sprites, all 47 entries point to the same
`SpriteRef` as the current `tileTypeSpriteMap` entry.

The renderer's variant resolution path:

```
1. entry has adjacencyMask?
   → variantIndex = BITMASK_TO_VARIANT[adjacencyMask]
   → ref = autotileVariantMap.get(tileType)?.[variantIndex]
   → if ref: use it
   → else: fall through to existing resolveSprite
2. entry has no adjacencyMask?
   → existing resolveSprite(tileType, glyph) path unchanged
```

`SpriteRenderer` receives the autotile variant map via its constructor
(alongside `tileTypeSpriteMap` and `spriteMap`). No other renderer changes
beyond the variant resolution in `drawCellLayers`.

### Key files

| File | Change |
|------|--------|
| `rogue-ts/src/platform/autotile.ts` | NEW: connection groups, bitmask computation, 256→47 table, autotile variant map builder |
| `rogue-ts/src/platform/render-layers.ts` | Add `adjacencyMask?: number` to `LayerEntry` |
| `rogue-ts/src/io/sprite-appearance.ts` | Compute adjacencyMask in getCellSpriteData for TERRAIN and SURFACE layers (live AND remembered paths) |
| `rogue-ts/src/platform/sprite-renderer.ts` | Extend drawCellLayers to resolve autotile variants; accept autotileVariantMap |
| `rogue-ts/src/platform/glyph-sprite-map.ts` | Add `buildAutotileVariantMap()` returning placeholder variants |
| `rogue-ts/src/platform/browser-renderer.ts` | Wire autotileVariantMap through to SpriteRenderer |
| `rogue-ts/src/platform/sprite-debug.ts` | Add adjacencyMask to debug panel inspect output |
| `rogue-ts/tests/platform/autotile.test.ts` | NEW: tests for bitmask, connection groups, reduction table |
| `rogue-ts/tests/io/sprite-appearance.test.ts` | Add tests for adjacencyMask population |

Files NOT touched:
- Game logic (`pmap`, `Pcell`, `architect/*.ts`, `movement/*.ts`) — untouched
- `text-renderer.ts` — ASCII path unmodified
- `cell-appearance.ts` — ASCII data path unmodified

### Variant index stability

Variant indices 0–46 are defined by the hardcoded
`VARIANT_CANONICAL_MASKS` constant and must never change. Art production
depends on this: the sprite at position N in a spritesheet corresponds
to variant index N. The constant IS the stability guarantee — unlike a
computed table, a hardcoded literal cannot be silently altered by a
refactor to the corner-clearing logic. A verification test independently
recomputes the 47 canonical masks and asserts they match the hardcoded
values, catching any divergence between the algorithm and the contract.

### Performance

8 neighbor lookups × 2291 viewport cells = ~18,400 array accesses per full
redraw. Each lookup is `pmap[x + dx][y + dy].layers[dungeonLayer]` followed
by a `Uint8Array` index check (`members[tile]`). This is well within
budget — CDDA validates this approach in production with a much larger
map and more complex connection logic.

The 256→47 reduction is a single `Uint8Array` index. The variant sprite
lookup is a `Map.get()` + array index. Combined overhead per cell: ~10
additional property accesses on top of the existing `getCellSpriteData`
work. Negligible.

If performance is ever an issue, the upgrade path is clear:
1. Cache the bitmask grid (79×29 `Uint8Array`) and invalidate on terrain
   change via a dirty flag on `Pcell`
2. Skip bitmask recomputation for cells where the dirty-rect diffing shows
   no change

### Debug panel integration

The F2 debug panel (`sprite-debug.ts`) currently shows per-layer tint and
alpha for the inspected cell. Extend `inspectedLayers[i]` to include
`adjacencyMask?: number` when present. The panel display shows the raw
bitmask as a binary string (e.g., `mask: 01101011`) and the reduced
variant index (e.g., `variant: 23`), plus the connection group name.

### Variant reference table

`VARIANT_CANONICAL_MASKS` is the hardcoded `readonly number[]` constant
(length 47) in `autotile.ts`. It is the single source of truth for the
variant-index-to-bitmask mapping. Art production depends on each index
corresponding to a fixed visual pattern.

**Art handoff document:** A generated markdown file
(`docs/pixel-art/autotile-variant-reference.md`) maps each variant
index to its canonical bitmask and a 3×3 neighbor diagram showing which
edges/corners are connected. This is the primary deliverable enabling
artists to begin producing 47-variant spritesheets. Generated once
during Phase 1a from the hardcoded constant; regenerated only if the
constant changes (which should never happen after initial commit).

### Spritesheet specification

For art production (Initiative 8), each connectable TileType needs a
47-variant spritesheet. The specification:
- Layout: 47 sprites in a single row, or an 8×6 grid (48 slots, last
  unused), indexed left-to-right top-to-bottom by variant index.
- Sprite size: same as base tile size (currently 16×16).
- Variant ordering: matches `VARIANT_CANONICAL_MASKS` — the sprite at
  position N is the variant for canonical mask N.
- This specification is defined during this initiative so artists can
  begin work immediately. The art pipeline tooling (slicing, packing) is
  deferred to Initiative 8.

### File size considerations

Two files approach the 600-line limit:
- **`sprite-appearance.ts` (469 lines):** Adding remembered-cell
  autotiling and live-cell autotiling adds ~30–40 lines. Safe for this
  initiative (~500–510 lines), but future initiatives (creature facing,
  status overlays) will push it further. Note for future splitting.
- **`sprite-debug.ts` (414 lines):** Adding autotile debug display
  (bitmask, variant index, connection group, neighbor visualization)
  adds ~60–80 lines. If it exceeds 550, extract the panel DOM builder
  to `sprite-debug-panel.ts`.

## Open Questions

None — all design decisions resolved by research (Section 3.S) and the
analysis above.
