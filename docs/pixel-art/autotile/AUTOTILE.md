# Autotile System

Reference for the 47-variant blob autotile system. Covers bitmask encoding,
connection groups, spritesheet formats, data pipeline integration, and
variant lookup.

**Source of truth for code:** `rogue-ts/src/platform/autotile.ts`

---

## Overview

Each connectable terrain type computes an 8-bit adjacency bitmask from its
8 neighbors at draw time. The bitmask is reduced from 256 possible values
to 47 visually distinct variants via corner-clearing rules. The renderer
selects the matching variant sprite from a per-group autotile spritesheet.

Three components:

1. **Connection groups + bitmask algorithm** (`autotile.ts`) — which
   TileTypes belong to which group, the bitmask computation function,
   and the 256→47 reduction table. Pure functions, no state.
2. **Data pipeline** (`sprite-appearance.ts`) — `getCellSpriteData`
   computes the bitmask for TERRAIN and LIQUID layers and stores it as
   `LayerEntry.adjacencyMask`.
3. **Variant sprite lookup** (`sprite-renderer.ts`) — when
   `adjacencyMask` is present, reduce to variant index (0–46) and
   look up the sprite from the autotile variant map.

---

## Bitmask Encoding

### Bit layout

Bits are assigned clockwise from North, matching screen coordinates (y-down):

```
Bit 7: NW (-1,-1)   Bit 0: N (0,-1)    Bit 1: NE (1,-1)
Bit 6: W  (-1, 0)   [self]              Bit 2: E  (1, 0)
Bit 5: SW (-1, 1)   Bit 4: S (0, 1)    Bit 3: SE (1, 1)
```

Cardinal bits: N=0, E=2, S=4, W=6. Diagonal bits: NE=1, SE=3, SW=5, NW=7.

The offset array `AUTOTILE_OFFSETS` is clockwise from N. This is independent
of the codebase's `nbDirs` or `cDirs` arrays — the autotile system uses
its own constant.

### Corner-clearing rules (256→47 reduction)

Diagonal corners only matter when both adjacent cardinal neighbors are
connected. When either cardinal is missing, the diagonal bit is cleared:

- NE (bit 1): requires N (bit 0) AND E (bit 2)
- SE (bit 3): requires S (bit 4) AND E (bit 2)
- SW (bit 5): requires S (bit 4) AND W (bit 6)
- NW (bit 7): requires N (bit 0) AND W (bit 6)

This reduces 256 raw bitmasks to 47 canonical shapes.

### Lookup tables

`VARIANT_CANONICAL_MASKS` — hardcoded `readonly number[]` (length 47)
listing canonical bitmask values sorted ascending. This is the contract
with the art pipeline: variant index N in a spritesheet corresponds to
canonical mask N. **Never reorder or remove entries.**

`BITMASK_TO_VARIANT` — `Uint8Array(256)` built at module load time.
Maps every raw bitmask to its variant index (0–46) via corner-clearing
then lookup in the canonical table. O(1) per cell.

A verification test independently recomputes the 47 canonical masks and
asserts they match the hardcoded constant, catching any divergence.

---

## Connection Groups

Each connectable TileType maps to exactly one connection group. Two tiles
connect if they share the same group. The bitmask computation checks each
neighbor's TileType against the group's member set.

| Group | DungeonLayer | oobConnects | Member TileTypes |
|-------|-------------|-------------|------------------|
| WALL  | Dungeon | true  | GRANITE, WALL, SECRET_DOOR, TORCH_WALL, CRYSTAL_WALL, WALL_LEVER_HIDDEN, WALL_LEVER_HIDDEN_DORMANT, WALL_MONSTER_DORMANT, RAT_TRAP_WALL_DORMANT, RAT_TRAP_WALL_CRACKING, WORM_TUNNEL_OUTER_WALL, MUD_WALL, DOOR, OPEN_DOOR, LOCKED_DOOR, PORTCULLIS_CLOSED, PORTCULLIS_DORMANT, WOODEN_BARRICADE, MUD_DOORWAY, TURRET_DORMANT, OPEN_IRON_DOOR_INERT |
| WATER | Liquid  | false | DEEP_WATER, SHALLOW_WATER, FLOOD_WATER_DEEP, FLOOD_WATER_SHALLOW, MACHINE_FLOOD_WATER_DORMANT, MACHINE_FLOOD_WATER_SPREADING, DEEP_WATER_ALGAE_WELL, DEEP_WATER_ALGAE_1, DEEP_WATER_ALGAE_2 |
| LAVA  | Liquid  | false | LAVA, LAVA_RETRACTABLE, LAVA_RETRACTING, ACTIVE_BRIMSTONE, SACRIFICE_LAVA |
| CHASM | Liquid  | false | CHASM, MACHINE_COLLAPSE_EDGE_DORMANT, MACHINE_COLLAPSE_EDGE_SPREADING, CHASM_WITH_HIDDEN_BRIDGE, CHASM_WITH_HIDDEN_BRIDGE_ACTIVE, HOLE, HOLE_GLOW |
| FLOOR | Dungeon | false | FLOOR, FLOOR_FLOODABLE, CARPET, MARBLE_FLOOR, DARK_FLOOR_DORMANT, DARK_FLOOR_DARKENING, DARK_FLOOR, MACHINE_TRIGGER_FLOOR, MACHINE_TRIGGER_FLOOR_REPEATING, MUD_FLOOR, CHASM_EDGE, MACHINE_CHASM_EDGE, HOLE_EDGE |
| ICE   | Liquid  | false | ICE_DEEP, ICE_DEEP_MELT, ICE_SHALLOW, ICE_SHALLOW_MELT |
| MUD   | Liquid  | false | MUD, MACHINE_MUD_DORMANT |

### Design notes

**OPEN_DOOR in WALL group.** The door frame is structurally part of the
wall — wall autotile variants shouldn't change when a door swings open.
CDDA uses the same approach. Data-only change if playtesting disagrees.

**oobConnects.** WALL uses `true` because Brogue's map is surrounded by
granite — wall tiles at the edge should show "connected" toward the
boundary. All other groups use `false`.

**Group membership via `Uint8Array`.** Each group's member set is a
`Uint8Array(TILE_TYPE_COUNT)` where `array[tileType] = 1` for members.
Faster than `Set.has()` for integer keys (~18,400 checks per frame).

### Autotile skip list

Some TileTypes participate in a connection group (so neighbors see them as
connected) but keep their own distinct sprite instead of using the autotile
sheet. Defined in `AUTOTILE_SKIP` in `glyph-sprite-map.ts`:

DOOR, OPEN_DOOR, LOCKED_DOOR, PORTCULLIS_CLOSED, PORTCULLIS_DORMANT,
WOODEN_BARRICADE, MUD_DOORWAY, TURRET_DORMANT, OPEN_IRON_DOOR_INERT

### Chasm-override in adjacency computation

Chasms are placed on `DungeonLayer.Liquid` by lake generation but visually
override `DungeonLayer.Dungeon` (the rendering pipeline routes them to the
TERRAIN RenderLayer). Lake wreath cells (CHASM_EDGE) may retain stale
GRANITE/WALL on `DungeonLayer.Dungeon`.

When computing adjacency for Dungeon-layer groups (WALL, FLOOR), the
neighbor accessor checks `DungeonLayer.Liquid` for chasm-type tiles. If a
neighbor has a chasm tile on its liquid layer, that tile is returned instead
of the dungeon-layer tile, ensuring the adjacency reflects the visual
output. This override is applied in three places in `sprite-appearance.ts`:

1. **TERRAIN path** (live cells) — the Dungeon-layer adjacency accessor
2. **Liquid/chasm path** (live cells) — for chasm-type tiles in the FLOOR
   group (CHASM_EDGE, HOLE_EDGE) that compute Dungeon-layer adjacency
   despite living on the Liquid layer
3. **Remembered path** — `rememberedNeighborTile()` applies the override
   for any Dungeon-layer read, covering both TERRAIN and chasm branches

---

## Spritesheet Formats

### 8×6 grid (standard)

47 sprites in an 8×6 grid (48 slots, last unused). Indexed left-to-right
then top-to-bottom by variant index (0–46). Sprite size matches the base
tile size (16×16). Total sheet size: 128×96.

Used by: **WALL**, **FLOOR**

### 7×7 Wang Blob (spatial)

47 sprites in a 7×7 grid (49 cells, 2 empty corners). Connected tiles are
visually adjacent in the grid, making the layout natural to draw on. Variant
indices map to spatial positions via `buildVariantToWangBlob()` in
`autotile.ts`.

Used by: **CHASM** (`chasm-autotile-v3.png`)

Empty corners: (col=6, row=0) and (col=0, row=6). Cell (col=0, row=0)
is variant 0 (no connections).

### Autotile sheet registry

Defined in `AUTOTILE_SHEETS` in `glyph-sprite-map.ts`:

| Group | Sheet key | Format |
|-------|-----------|--------|
| WALL  | `WallAutotile`  | grid |
| FLOOR | `FloorAutotile` | grid |
| CHASM | `ChasmAutotileV3` | wang-blob |

Groups without a sheet entry (WATER, LAVA, ICE, MUD) use placeholder
fills — all 47 variant slots point to the same single sprite.

### Variant resolution

`resolveGroupVariants()` in `glyph-sprite-map.ts` resolves variants in
priority order:

1. Explicit per-variant assignments from `assignments.json` (if present)
2. Sheet format layout (wang-blob → `wangBlobVariants()`, grid → `autotileVariants()`)

The `buildAutotileVariantMap()` function builds
`Map<TileType, SpriteRef[]>` at init time. TileTypes in `AUTOTILE_SKIP`
get placeholder fills. TileTypes without a sheet also get placeholders.

---

## Data Pipeline

### Live cells (Visible / Clairvoyant / Telepathic / Omniscience)

In `getCellSpriteData()` (`sprite-appearance.ts`):

1. Read `cell.layers[DungeonLayer.Dungeon]` → look up connection group
2. If group found → `computeAdjacencyMask()` with live-pmap accessor
3. Store raw bitmask as `entry.adjacencyMask`
4. Same for `cell.layers[DungeonLayer.Liquid]` (liquids and chasms)

The `computeAdjacencyMask` callback:
- Returns `undefined` for out-of-bounds → resolved per `oobConnects`
- For Dungeon-layer groups, checks liquid layer for chasm override
- Otherwise returns `pmap[nx][ny].layers[dungeonLayer]`

### Remembered / MagicMapped cells

`populateRememberedLayers()` uses the same `computeAdjacencyMask` with a
visibility-aware accessor (`rememberedNeighborTile`):

- Visible/Clairvoyant/Omniscience neighbor → `nCell.layers[dungeonLayer]`
- Remembered/MagicMapped neighbor → `nCell.rememberedLayers[dungeonLayer]`
- Shroud/OOB → `undefined` (per `oobConnects`)
- Dungeon-layer groups also check liquid layer for chasm override

This ensures remembered walls retain their autotiled shape under fog-of-war.

### Renderer (variant selection)

In `drawCellLayers()` (`sprite-renderer.ts`):

1. If `entry.adjacencyMask` is set and `autotileVariantMap` exists:
   - `variantIndex = BITMASK_TO_VARIANT[adjacencyMask]`
   - `ref = autotileVariantMap.get(tileType)?.[variantIndex]`
   - Use ref if found, else fall through to `resolveSprite()`
2. If no adjacencyMask → existing `resolveSprite(tileType, glyph)` path

### Performance

8 neighbor lookups × 2291 viewport cells = ~18,400 array accesses per full
redraw. Combined overhead per cell: ~10 additional property accesses on top
of existing `getCellSpriteData` work. Well under 1ms.

If needed, upgrade paths:
1. Cache bitmask grid (79×29 `Uint8Array`) with dirty-flag invalidation
2. Skip recomputation for unchanged cells via dirty-rect diffing

---

## Debug Tooling

The F2 sprite debug panel shows autotile data for inspected cells:

- Raw bitmask as 8-bit binary (e.g., `mask: 01101011`)
- Variant index (e.g., `var: 23`)
- Connection group name (e.g., `group: WALL`)
- 3×3 mini-grid showing which neighbors are connected

Toggle "Show Variant Indices" to overlay variant numbers on all autotiled
cells. Useful for verifying correctness before art exists.

---

## 47 Variant Reference

Art handoff reference. Each variant shows a 3×3 grid: `■` = connected
neighbor (same group), `·` = not connected, `X` = the tile itself.

```
NW  N  NE        bit 7  bit 0  bit 1
 W  X   E        bit 6  self   bit 2
SW  S  SE        bit 5  bit 4  bit 3
```

Diagonal corners only appear as `■` when both adjacent cardinals are
connected (corner-clearing rule).

### Quick reference table

| Idx | Mask | Binary     | Cardinals | Corners         |
|-----|------|------------|-----------|-----------------|
|   0 |    0 | `00000000` | —         | —               |
|   1 |    1 | `00000001` | N         | —               |
|   2 |    4 | `00000100` | E         | —               |
|   3 |    5 | `00000101` | N E       | —               |
|   4 |    7 | `00000111` | N E       | NE              |
|   5 |   16 | `00010000` | S         | —               |
|   6 |   17 | `00010001` | N S       | —               |
|   7 |   20 | `00010100` | E S       | —               |
|   8 |   21 | `00010101` | N E S     | —               |
|   9 |   23 | `00010111` | N E S     | NE              |
|  10 |   28 | `00011100` | E S       | SE              |
|  11 |   29 | `00011101` | N E S     | SE              |
|  12 |   31 | `00011111` | N E S     | NE SE           |
|  13 |   64 | `01000000` | W         | —               |
|  14 |   65 | `01000001` | N W       | —               |
|  15 |   68 | `01000100` | E W       | —               |
|  16 |   69 | `01000101` | N E W     | —               |
|  17 |   71 | `01000111` | N E W     | NE              |
|  18 |   80 | `01010000` | S W       | —               |
|  19 |   81 | `01010001` | N S W     | —               |
|  20 |   84 | `01010100` | E S W     | —               |
|  21 |   85 | `01010101` | N E S W   | —               |
|  22 |   87 | `01010111` | N E S W   | NE              |
|  23 |   92 | `01011100` | E S W     | SE              |
|  24 |   93 | `01011101` | N E S W   | SE              |
|  25 |   95 | `01011111` | N E S W   | NE SE           |
|  26 |  112 | `01110000` | S W       | SW              |
|  27 |  113 | `01110001` | N S W     | SW              |
|  28 |  116 | `01110100` | E S W     | SW              |
|  29 |  117 | `01110101` | N E S W   | SW              |
|  30 |  119 | `01110111` | N E S W   | NE SW           |
|  31 |  124 | `01111100` | E S W     | SE SW           |
|  32 |  125 | `01111101` | N E S W   | SE SW           |
|  33 |  127 | `01111111` | N E S W   | NE SE SW        |
|  34 |  193 | `11000001` | N W       | NW              |
|  35 |  197 | `11000101` | N E W     | NW              |
|  36 |  199 | `11000111` | N E W     | NE NW           |
|  37 |  209 | `11010001` | N S W     | NW              |
|  38 |  213 | `11010101` | N E S W   | NW              |
|  39 |  215 | `11010111` | N E S W   | NE NW           |
|  40 |  221 | `11011101` | N E S W   | SE NW           |
|  41 |  223 | `11011111` | N E S W   | NE SE NW        |
|  42 |  241 | `11110001` | N S W     | SW NW           |
|  43 |  245 | `11110101` | N E S W   | SW NW           |
|  44 |  247 | `11110111` | N E S W   | NE SW NW        |
|  45 |  253 | `11111101` | N E S W   | SE SW NW        |
|  46 |  255 | `11111111` | N E S W   | NE SE SW NW     |

### Variant diagrams

#### No cardinals connected (1 variant)

**Variant 0** — mask 0
```
·  ·  ·
·  X  ·
·  ·  ·
```

#### One cardinal connected (4 variants)

**Variant 1** — mask 1 (N)
```
·  ■  ·
·  X  ·
·  ·  ·
```

**Variant 2** — mask 4 (E)
```
·  ·  ·
·  X  ■
·  ·  ·
```

**Variant 5** — mask 16 (S)
```
·  ·  ·
·  X  ·
·  ■  ·
```

**Variant 13** — mask 64 (W)
```
·  ·  ·
■  X  ·
·  ·  ·
```

#### Two cardinals connected (10 variants)

**Variant 3** — mask 5 (N+E, no corner)
```
·  ■  ·
·  X  ■
·  ·  ·
```

**Variant 4** — mask 7 (N+E, NE corner)
```
·  ■  ■
·  X  ■
·  ·  ·
```

**Variant 6** — mask 17 (N+S)
```
·  ■  ·
·  X  ·
·  ■  ·
```

**Variant 7** — mask 20 (E+S, no corner)
```
·  ·  ·
·  X  ■
·  ■  ·
```

**Variant 10** — mask 28 (E+S, SE corner)
```
·  ·  ·
·  X  ■
·  ■  ■
```

**Variant 14** — mask 65 (N+W, no corner)
```
·  ■  ·
■  X  ·
·  ·  ·
```

**Variant 15** — mask 68 (E+W)
```
·  ·  ·
■  X  ■
·  ·  ·
```

**Variant 18** — mask 80 (S+W, no corner)
```
·  ·  ·
■  X  ·
·  ■  ·
```

**Variant 26** — mask 112 (S+W, SW corner)
```
·  ·  ·
■  X  ·
■  ■  ·
```

**Variant 34** — mask 193 (N+W, NW corner)
```
■  ■  ·
■  X  ·
·  ·  ·
```

#### Three cardinals connected (12 variants)

**Variant 8** — mask 21 (N+E+S, no corners)
```
·  ■  ·
·  X  ■
·  ■  ·
```

**Variant 9** — mask 23 (N+E+S, NE)
```
·  ■  ■
·  X  ■
·  ■  ·
```

**Variant 11** — mask 29 (N+E+S, SE)
```
·  ■  ·
·  X  ■
·  ■  ■
```

**Variant 12** — mask 31 (N+E+S, NE+SE)
```
·  ■  ■
·  X  ■
·  ■  ■
```

**Variant 16** — mask 69 (N+E+W, no corners)
```
·  ■  ·
■  X  ■
·  ·  ·
```

**Variant 17** — mask 71 (N+E+W, NE)
```
·  ■  ■
■  X  ■
·  ·  ·
```

**Variant 35** — mask 197 (N+E+W, NW)
```
■  ■  ·
■  X  ■
·  ·  ·
```

**Variant 36** — mask 199 (N+E+W, NE+NW)
```
■  ■  ■
■  X  ■
·  ·  ·
```

**Variant 19** — mask 81 (N+S+W, no corners)
```
·  ■  ·
■  X  ·
·  ■  ·
```

**Variant 27** — mask 113 (N+S+W, SW)
```
·  ■  ·
■  X  ·
■  ■  ·
```

**Variant 37** — mask 209 (N+S+W, NW)
```
■  ■  ·
■  X  ·
·  ■  ·
```

**Variant 42** — mask 241 (N+S+W, SW+NW)
```
■  ■  ·
■  X  ·
■  ■  ·
```

**Variant 20** — mask 84 (E+S+W, no corners)
```
·  ·  ·
■  X  ■
·  ■  ·
```

**Variant 23** — mask 92 (E+S+W, SE)
```
·  ·  ·
■  X  ■
·  ■  ■
```

**Variant 28** — mask 116 (E+S+W, SW)
```
·  ·  ·
■  X  ■
■  ■  ·
```

**Variant 31** — mask 124 (E+S+W, SE+SW)
```
·  ·  ·
■  X  ■
■  ■  ■
```

#### Four cardinals connected (16 variants)

**Variant 21** — mask 85 (no corners)
```
·  ■  ·
■  X  ■
·  ■  ·
```

**Variant 22** — mask 87 (NE)
```
·  ■  ■
■  X  ■
·  ■  ·
```

**Variant 24** — mask 93 (SE)
```
·  ■  ·
■  X  ■
·  ■  ■
```

**Variant 25** — mask 95 (NE+SE)
```
·  ■  ■
■  X  ■
·  ■  ■
```

**Variant 29** — mask 117 (SW)
```
·  ■  ·
■  X  ■
■  ■  ·
```

**Variant 30** — mask 119 (NE+SW)
```
·  ■  ■
■  X  ■
■  ■  ·
```

**Variant 32** — mask 125 (SE+SW)
```
·  ■  ·
■  X  ■
■  ■  ■
```

**Variant 33** — mask 127 (NE+SE+SW)
```
·  ■  ■
■  X  ■
■  ■  ■
```

**Variant 38** — mask 213 (NW)
```
■  ■  ·
■  X  ■
·  ■  ·
```

**Variant 39** — mask 215 (NE+NW)
```
■  ■  ■
■  X  ■
·  ■  ·
```

**Variant 40** — mask 221 (SE+NW)
```
■  ■  ·
■  X  ■
·  ■  ■
```

**Variant 41** — mask 223 (NE+SE+NW)
```
■  ■  ■
■  X  ■
·  ■  ■
```

**Variant 43** — mask 245 (SW+NW)
```
■  ■  ·
■  X  ■
■  ■  ·
```

**Variant 44** — mask 247 (NE+SW+NW)
```
■  ■  ■
■  X  ■
■  ■  ·
```

**Variant 45** — mask 253 (SE+SW+NW)
```
■  ■  ·
■  X  ■
■  ■  ■
```

**Variant 46** — mask 255 (all corners)
```
■  ■  ■
■  X  ■
■  ■  ■
```

---

## Key Files

| File | Role |
|------|------|
| `rogue-ts/src/platform/autotile.ts` | Connection groups, bitmask computation, 256→47 table, Wang Blob grid |
| `rogue-ts/src/io/sprite-appearance.ts` | Computes adjacencyMask in getCellSpriteData (live + remembered paths) |
| `rogue-ts/src/platform/sprite-renderer.ts` | Resolves autotile variants in drawCellLayers |
| `rogue-ts/src/platform/glyph-sprite-map.ts` | Builds autotile variant map, sheet registry, skip list |
| `rogue-ts/src/platform/render-layers.ts` | `adjacencyMask` on LayerEntry, `isChasmTileType` classifier |
| `rogue-ts/src/platform/sprite-debug.ts` | F2 panel autotile inspection |
| `rogue-ts/tests/platform/autotile.test.ts` | Bitmask, connection group, reduction table tests |
| `rogue-ts/tests/io/sprite-appearance.test.ts` | adjacencyMask population tests |
| `rogue-ts/assets/tilesets/autotile/` | Autotile spritesheet PNGs |

---

## Known Issues

- **CHASM_EDGE / HOLE_EDGE moved to FLOOR group.** These walkable edge
  tiles (flags: 0) were previously in the CHASM group, which made them
  render with chasm autotile sprites (looking impassable) and caused
  adjacent deep-chasm tiles to compute interior variants instead of cliff
  edges. Now in FLOOR group: they autotile as floor (seamless walkable
  surface), and CHASM tiles correctly show edges at the precipice. The
  liquid-path adjacency accessor applies the same chasm-override as the
  TERRAIN path so edge tiles on DungeonLayer.Liquid see each other
  correctly despite FLOOR's Dungeon-layer read.
- **B108 — First-frame rendering.** Autotiled sprites may show incorrectly
  on the initial dungeon render. Cells correct after first FOV redraw or
  mouse hover. See `docs/BACKLOG.md`.

---

## History

Implemented as `initiatives/autotiling-system/` (Phases 1a–3, all complete).
Design informed by Excalibur.js (TypeScript bitmask algorithm), CDDA
(connection groups), Godot ("Match Corners and Sides" = 47-tile blob), and
BrogueCE Issue #332. Wang Blob support for CHASM added on the
`sprite-pipeline/wang-blob-support` branch.
