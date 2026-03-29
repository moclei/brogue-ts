# Autotiling System

## Intent

Implement 8-bit blob bitmask autotiling (47 tile variants per terrain type)
with CDDA-style connection groups for cross-type neighbor matching. This
gives walls, water, lava, and chasms smooth, context-aware edges that respond
to their spatial surroundings — the single biggest visual quality improvement
for sprite mode.

## Goals

- Every connectable terrain type computes an 8-bit adjacency bitmask from
  its 8 neighbors at draw time
- Connection groups enable cross-type neighbor matching (walls connect to
  doors, shallow water connects to deep water, lava connects to brimstone)
- The renderer selects from 47 variant sprites per terrain type based on
  the reduced bitmask
- Remembered and magic-mapped cells retain autotile bitmasks computed
  from effective neighbor data (live for visible neighbors, remembered
  for remembered neighbors, connecting for shroud/out-of-bounds)
- Placeholder sprites (reusing the existing single sprite per TileType)
  make the system functional without new art — ready for an artist to plug
  in 47-variant spritesheets per terrain type
- The F2 debug panel shows the computed adjacency bitmask per cell
- The bitmask computation adds negligible overhead to the draw cycle
  (~18,400 neighbor lookups per full viewport redraw)

## Scope

What's in:
- Connection group configuration mapping TileTypes to groups (WALL, WATER,
  LAVA, CHASM, FLOOR, ICE, MUD)
- `computeAdjacencyMask()` — 8-bit bitmask from 8 neighbor checks
- 256→47 variant reduction lookup table (hardcoded canonical masks,
  verified by the diagonal-requires-both-cardinals rule)
- `adjacencyMask` field on `LayerEntry`, computed in `getCellSpriteData`
  for TERRAIN and SURFACE (liquid) layers
- Autotile variant map data structure (`Map<TileType, SpriteRef[]>`)
- Extension of `resolveSprite` to handle variant lookup when `adjacencyMask`
  is present
- Placeholder sprites for all 47 variants (same sprite as current)
- Adjacency bitmask display in the F2 debug panel
- Variant reference document (`docs/pixel-art/autotile-variant-reference.md`)
  mapping each variant index to a 3×3 neighbor diagram — art handoff doc
- Unit tests for bitmask computation, connection groups, variant lookup,
  and data pipeline integration

What's out:
- Authored 47-tile spritesheets (art pipeline — Initiative 8)
- Cached autotile grid with dirty-flag invalidation (future optimization
  if needed)
- Wang tile procedural generation
- CDDA's two-field `connect_groups`/`connects_to` asymmetric model (single
  connectionGroup per TileType is sufficient for Brogue)
- Creature facing (Initiative 4)
- Connection group configuration UI or editor

## Constraints

- **600 lines max per file.** New autotile module must stay under limit.
- **No game logic changes.** Autotiling is purely a rendering-pipeline
  concern. `pmap`, `Pcell`, game state are untouched.
- **Performance budget.** 8 neighbor lookups × 2291 viewport cells =
  ~18,400 lookups per frame. Must not push full-viewport redraw beyond
  16 ms. Measured in Phase 3.
- **Existing sprite lookup preserved.** Non-connectable TileTypes continue
  to use the existing single-sprite lookup path unchanged.
- **Text mode unaffected.** ASCII rendering path is not modified.
- Parent: `docs/pixel-art/pixel-art-exploration.md` Section 3.S
  (Autotiling), Section 4a, Section 6 (Initiative 3).
