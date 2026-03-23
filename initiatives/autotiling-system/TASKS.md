# Autotiling System — Tasks

## Phase 1a: Autotile Core Module

Create the autotile configuration module with connection groups, bitmask
computation, and the 256→47 reduction table. Pure module with no
integration into the rendering pipeline. Self-contained commit.

- [x] Create `rogue-ts/src/platform/autotile.ts`:
  - `AUTOTILE_OFFSETS` constant: 8 neighbor offsets clockwise from N
    (`[0,-1], [1,-1], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1]`)
  - `ConnectionGroupInfo` type: `{ group: string; dungeonLayer:
    DungeonLayer; members: Uint8Array; oobConnects: boolean }`.
  - Connection group configuration: a `Map<TileType, ConnectionGroupInfo>`
    mapping each connectable TileType to its group info. Built from a
    declarative group definition object. Each group declares `oobConnects`
    (true for WALL, false for all others). Member sets are `Uint8Array`
    indexed by TileType (non-zero = member). Enumerate all 7 groups (WALL,
    WATER, LAVA, CHASM, FLOOR, ICE, MUD) with their member TileTypes per
    PLAN.md table. Add a comment on OPEN_DOOR explaining why it's in the
    WALL group (structural connectivity, not passability).
  - `computeAdjacencyMask(x, y, groupMembers, oobConnects,
    getNeighborTile)` — loops 8 neighbors via accessor function, checks
    group membership via `groupMembers[tile]`, returns raw 8-bit bitmask
    (0–255). When `getNeighborTile` returns `undefined`, use `oobConnects`
    to determine bit value.
  - `VARIANT_CANONICAL_MASKS` — **hardcoded** `readonly number[]` literal
    (length 47) listing the 47 canonical bitmask values sorted ascending.
    This is the contract with the art pipeline.
  - `BITMASK_TO_VARIANT` — `Uint8Array(256)` built at module load time
    FROM `VARIANT_CANONICAL_MASKS`: for each raw bitmask 0–255, apply
    corner-clearing to get canonical form, look up its index in the
    hardcoded constant.
  - `AUTOTILE_VARIANT_COUNT = 47` constant.
  - Export `getConnectionGroupInfo(tileType)` for use by getCellSpriteData.

- [x] Add `adjacencyMask?: number` to `LayerEntry` in
  `rogue-ts/src/platform/render-layers.ts`. Reset it to `undefined` in
  `resetLayerEntry`.

- [x] Unit tests in `rogue-ts/tests/platform/autotile.test.ts`:
  - `computeAdjacencyMask`: isolated cell (mask=0 when no neighbors
    match and oobConnects=false), surrounded wall (mask=255), L-shaped
    wall pattern, single edge, corner cases
  - OOB behavior: oobConnects=true → bit set for undefined neighbors;
    oobConnects=false → bit clear for undefined neighbors. Test both
    via mock accessors.
  - Connection group membership: WALL group includes doors (including
    OPEN_DOOR), WATER group includes deep and shallow, FLOOR group
    does not include WALL types
  - `BITMASK_TO_VARIANT`: exactly 47 unique variant indices, all values
    in 0–46, specific known bitmask→variant mappings (e.g., 0→isolated,
    255→fully surrounded)
  - **Variant index stability (verification test):** independently
    compute the 47 canonical masks via the corner-clearing algorithm
    (enumerate 256 → apply rules → collect unique → sort) and assert
    they match the hardcoded `VARIANT_CANONICAL_MASKS` exactly
  - Corner clearing: diagonal bit cleared when adjacent cardinal missing
  - `getConnectionGroupInfo`: returns correct group for connectable
    types, undefined for non-connectable types (stairs, traps, items)
  - `VARIANT_CANONICAL_MASKS`: length is 47, values are sorted ascending
  - Dynamic terrain: same cell with different neighbor states produces
    different bitmasks (e.g., add a wall neighbor → bitmask changes)

- [x] Generate variant reference document:
  `docs/pixel-art/autotile-variant-reference.md` — maps each variant
  index (0–46) to its canonical bitmask and a 3×3 neighbor diagram
  showing which edges/corners are connected. This is the primary
  deliverable enabling artists to begin 47-variant spritesheets. Uses
  filled/empty squares for visual clarity. Generated from the hardcoded
  `VARIANT_CANONICAL_MASKS` constant.

# --- handoff point ---

## Phase 1b: Data Pipeline Integration

Integrate bitmask computation into `getCellSpriteData` for both live-pmap
and remembered/magic-mapped cells. Integration tests for the full data
path.

- [x] Integrate bitmask computation into `getCellSpriteData` in
  `rogue-ts/src/io/sprite-appearance.ts`:
  - **Live-pmap path (Visible/Clairvoyant/Telepathic/Omniscience):**
    After populating the TERRAIN `LayerEntry`, look up `dungeonTile` via
    `getConnectionGroupInfo`. If a group is found, call
    `computeAdjacencyMask` with a live-pmap accessor and the group's
    `oobConnects` flag, and set `entry.adjacencyMask`. Same for SURFACE
    `LayerEntry` from `liquidTile` — call with `DungeonLayer.Liquid`
    accessor.
  - Add a comment noting Initiative 9 migration: when liquids promote
    to LIQUID layer, this bitmask computation moves with the LayerEntry.

- [x] Integrate bitmask computation into `populateRememberedLayers` in
  `rogue-ts/src/io/sprite-appearance.ts`:
  - After populating TERRAIN and SURFACE entries from `rememberedLayers`,
    compute the bitmask using a remembered-aware accessor that checks
    each neighbor's visibility state (live `layers` for visible
    neighbors, `rememberedLayers` for remembered neighbors, uses
    `oobConnects` for out-of-bounds, treats shroud per `oobConnects`).
  - Set `entry.adjacencyMask` on both TERRAIN and SURFACE entries where
    applicable.
  - Explicit test case: remembered cell next to shroud neighbor should
    use `oobConnects` (WALL → connecting, FLOOR → not connecting).

- [x] Integration tests in `rogue-ts/tests/io/sprite-appearance.test.ts`:
  - `getCellSpriteData` sets `adjacencyMask` on TERRAIN entry for a wall
    cell with wall neighbors
  - `getCellSpriteData` sets `adjacencyMask` on SURFACE entry for a water
    cell with water neighbors
  - `getCellSpriteData` does NOT set `adjacencyMask` for non-connectable
    terrain (e.g., stairs, traps)
  - Non-liquid SURFACE entries (e.g., GRASS) do NOT get `adjacencyMask`
  - `TileType.NOTHING` on DungeonLayer.Dungeon → no bitmask computed
  - Remembered cells: `adjacencyMask` IS set on TERRAIN entry using
    effective neighbor data (remembered neighbors → rememberedLayers,
    visible neighbors → live layers, shroud → per oobConnects)
  - Remembered cells: bitmask changes when neighbor's remembered state
    differs from live state (verifies accessor reads correct source)

# --- handoff point ---

## Phase 2: Renderer Variant Lookup + Wiring

Extend the renderer to resolve autotile variant sprites. Wire the variant
map through from tileset initialization to the renderer.

- [ ] Add `buildAutotileVariantMap()` to
  `rogue-ts/src/platform/glyph-sprite-map.ts`:
  - Returns `Map<TileType, SpriteRef[]>` where each array has 47 entries.
  - For each connectable TileType that has an entry in `tileTypeSpriteMap`,
    create a 47-element array where every entry is the same `SpriteRef` as
    the existing single sprite (placeholder). This uses the connection
    group config to enumerate connectable types.
  - TileTypes without a tileTypeSpriteMap entry get no autotile variants
    (they already fall through to glyph-based lookup).

- [ ] Extend `SpriteRenderer` in
  `rogue-ts/src/platform/sprite-renderer.ts`:
  - Accept `autotileVariantMap: Map<TileType, SpriteRef[]>` in the
    constructor. Store as a private field.
  - Import `BITMASK_TO_VARIANT` from `autotile.ts`.
  - In `drawCellLayers`, before calling `resolveSprite` for a layer entry:
    if `entry.adjacencyMask !== undefined`, compute
    `variantIndex = BITMASK_TO_VARIANT[entry.adjacencyMask]`, look up
    `autotileVariantMap.get(entry.tileType)?.[variantIndex]`. If found, use
    that `SpriteRef` instead of calling `resolveSprite`. Else fall through
    to existing path.
  - Pre-create `ImageBitmap`s for autotile variant sprites in
    `precreateBitmaps()` (iterate `autotileVariantMap` values alongside
    existing maps).

- [ ] Wire `autotileVariantMap` through the initialization path in
  `rogue-ts/src/platform/browser-renderer.ts`:
  - Call `buildAutotileVariantMap()` at tileset init time (alongside
    existing `buildTileTypeSpriteMap` and `buildGlyphSpriteMap` calls).
  - Pass the resulting map to the `SpriteRenderer` constructor.

- [ ] Unit tests in `rogue-ts/tests/platform/sprite-renderer.test.ts`:
  - Variant resolution: when `adjacencyMask` is set and variant map has
    the TileType, the correct variant sprite is used
  - Fallback: when `adjacencyMask` is set but no variant map entry, falls
    through to regular `resolveSprite`
  - No adjacencyMask: existing behavior unchanged

# --- handoff point ---

## Phase 3: Debug Tooling + Verification

Add debug display, verify in browser, measure performance, update docs.

- [ ] Extend the F2 debug panel in `rogue-ts/src/platform/sprite-debug.ts`:
  - Add `adjacencyMask?: number`, `variantIndex?: number`, and
    `connectionGroup?: string` to the inspected layer data.
  - In `drawCellLayers`, when `isInspectTarget` and entry has
    `adjacencyMask`, record adjacencyMask, computed variant index, and
    connection group name.
  - Panel display for inspected cell:
    - Bitmask as 8-bit binary (e.g., `mask: 01101011`)
    - Variant index (e.g., `var: 23`)
    - Connection group name (e.g., `group: WALL`)
    - 3×3 mini-grid showing which neighbors are connected (e.g.,
      `[·] [N] [·] / [W] [X] [E] / [·] [S] [·]` with connected
      ones highlighted). Makes bitmask verification instant.
  - Only shown for layers that have autotile data.
  - If `sprite-debug.ts` exceeds 550 lines, extract the panel DOM
    builder to `sprite-debug-panel.ts`.

- [ ] Browser visual testing (focus on WALL, WATER, LAVA first):
  - Run the game in sprite mode, verify no visual regressions (placeholder
    sprites = same appearance as before)
  - Use F2 panel to inspect cells: confirm bitmask values change correctly
    as you move to different wall configurations (isolated wall, straight
    wall, corner, T-junction, fully surrounded)
  - Verify water, lava cells get bitmask values; spot-check chasm, floor,
    ice, mud if encountered
  - Verify non-connectable cells (stairs, traps, items) have no bitmask
  - Verify remembered cells DO have bitmask values (check that walls
    retain their autotile pattern under fog-of-war overlay)
  - Walk away from a wall configuration and verify the remembered wall
    appearance doesn't "pop" to a different shape

- [ ] Performance measurement:
  - Full viewport redraw timing with autotile computation enabled vs. a
    control measurement without (comment out the bitmask calls temporarily)
  - Target: overhead under 1 ms for the full 79×29 viewport
  - Document results in PLAN.md under a new `## Performance Results` section

- [ ] Define spritesheet specification for art production:
  - Document the variant layout (47 sprites in 8×6 grid, indexed by
    variant index left-to-right top-to-bottom, last slot unused)
  - Cross-reference the variant reference document
    (`docs/pixel-art/autotile-variant-reference.md`) generated in Phase 1a
  - Add to PLAN.md under "Spritesheet specification" and cross-reference
    in `docs/pixel-art/pixel-art-exploration.md` Section 7

- [ ] Update `docs/pixel-art/pixel-art-exploration.md`:
  - Section 6 roadmap: change Initiative 3 status from "not started" to
    "complete"
  - Section 7 Open Questions: mark "Connection group granularity" as
    resolved with the 7-group enumeration
  - Section 7: mark "Autotile template format for 47 tiles" as partially
    resolved (spritesheet layout = 47-variant array, art pipeline details
    deferred to Initiative 8)

## Deferred

- Connection group completeness audit: verify all 61 enumerated
  TileTypes against the full TileType enum. Specific types to playtest:
  HOLE_EDGE and CHASM_EDGE (their inherent edge sprites may conflict
  with autotile variants when real art is applied — may need their own
  sub-group or exclusion from autotiling), MUD_DOORWAY (should doorways
  connect to walls?), MACHINE_TRIGGER_FLOOR_REPEATING (is it visually
  floor-like?). These are data changes, not architectural — adjust
  group membership based on playtesting results.
- `sprite-appearance.ts` approaching 600-line limit (~500 after this
  initiative). Future initiatives (creature facing, status overlays)
  will need to split this file.
