# Grid System

> Last verified: 2026-03-24 | Commit: 381476f

## Summary

The grid system is the spatial backbone of Brogue. Every dungeon level is a fixed 79×29 grid of cells (`pmap`) that store terrain layers, cell flags, and remembered appearance data. A parallel transient grid (`tmap`) stores per-cell lighting. On top of these two permanent data structures, several dynamically-allocated `short**` grids (`scentMap`, `safetyMap`, `allySafetyMap`, `chokeMap`) provide pathfinding and AI data that is recomputed as the game state changes. Grid.c provides a suite of utility functions for allocating and manipulating these auxiliary grids.

## Key Files

| File (C) | File (TS) | Responsibility |
|----------|-----------|----------------|
| `src/brogue/Rogue.h` (lines 1314–1334) | `rogue-ts/src/types/types.ts` (lines 111–132) | `pcell` / `tcell` struct definitions |
| `src/brogue/Rogue.h` (lines 1293–1300) | `rogue-ts/src/types/enums.ts` | `dungeonLayers` enum (DUNGEON, LIQUID, GAS, SURFACE) |
| `src/brogue/Rogue.h` (lines 439–600+) | `rogue-ts/src/types/enums.ts` | `tileType` enum (~120 terrain types) |
| `src/brogue/Rogue.h` (lines 1080–1121) | `rogue-ts/src/types/flags.ts` | `tileFlags` (cell-level flags: VISIBLE, DISCOVERED, etc.) |
| `src/brogue/Rogue.h` (lines 1923–1957) | `rogue-ts/src/types/flags.ts` | `terrainFlagCatalog` (terrain property flags) |
| `src/brogue/Rogue.h` (lines 1959–1988) | `rogue-ts/src/types/flags.ts` | `terrainMechanicalFlagCatalog` (TM flags) |
| `src/brogue/Rogue.h` (lines 1905–1921) | `rogue-ts/src/types/types.ts` | `floorTileType` struct (tile properties catalog) |
| `src/brogue/Grid.c` | `rogue-ts/src/grid/grid.ts` | Grid allocation, manipulation, blob generation |
| `src/brogue/GlobalsBase.c` | `rogue-ts/src/core.ts` | Global pmap/tmap/scentMap/safetyMap declarations |
| `src/brogue/GlobalsBase.h` (lines 29–37) | — | `pmapAt()` / `tmapAt()` inline accessors |
| — | `rogue-ts/src/state/helpers.ts` | `terrainFlags()`, `cellHasTerrainFlag()`, `cellHasTMFlag()`, etc. |

## Key Functions

### Grid.c / grid.ts — Auxiliary Grid Operations

These operate on `short**` grids (TS: `number[][]`), not on `pmap`/`tmap` directly.

| Function | File | Purpose |
|----------|------|---------|
| `allocGrid` | Grid.c:30 / grid.ts:24 | Allocate a DCOLS×DROWS grid of shorts, initialized to 0 |
| `freeGrid` | Grid.c:41 / grid.ts:36 | Free grid memory (no-op in TS, GC handles it) |
| `copyGrid` | Grid.c:46 / grid.ts:45 | Copy all values from one grid to another |
| `fillGrid` | Grid.c:56 / grid.ts:54 | Set every cell to a constant value |
| `findReplaceGrid` | Grid.c:104 / grid.ts:66 | Replace cells in a value range with a new value |
| `floodFillGrid` | Grid.c:118 / grid.ts:89 | Recursive 4-directional flood fill within a value range |
| `drawRectangleOnGrid` | Grid.c:137 / grid.ts:120 | Fill a rectangular region |
| `drawCircleOnGrid` | Grid.c:147 / grid.ts:136 | Fill a circular region |
| `getTerrainGrid` | Grid.c:161 / — | Mark cells matching terrain flags (not yet in TS grid.ts; used inline) |
| `getTMGrid` | Grid.c:172 / — | Mark cells matching TM flags |
| `getPassableArcGrid` | Grid.c:183 / path-qualifying.ts:81 | Mark cells by passable arc count |
| `validLocationCount` | Grid.c:197 / grid.ts:157 | Count cells matching a value |
| `randomLocationInGrid` | Grid.c:224 / grid.ts:186 | Pick a random cell with a specific value |
| `randomLeastPositiveLocationInGrid` | Grid.c:249 / grid.ts:211 | Pick from cells with the lowest positive value |
| `getQualifyingPathLocNear` | Grid.c:287 / path-qualifying.ts | Find nearest pathing-reachable location matching criteria |
| `cellularAutomataRound` | Grid.c:362 / grid.ts:257 | One round of cellular automata (blob generation) |
| `fillContiguousRegion` | Grid.c:396 / grid.ts:292 | Label a contiguous region (blob measurement) |
| `createBlobOnGrid` | Grid.c:417 / grid.ts:331 | Generate a random blob via CA and return its bounding box |

### State helpers — Terrain Flag Queries

| Function | C File | TS File | Purpose |
|----------|--------|---------|---------|
| `terrainFlags(pos)` | Globals.c | state/helpers.ts:36 | OR all terrain layer flags for a cell |
| `terrainMechFlags(pos)` | Globals.c | state/helpers.ts:51 | OR all terrain layer mech flags for a cell |
| `cellHasTerrainFlag(pos, mask)` | Architect.c:32 | state/helpers.ts:66 | Check if any terrain layer has given flags |
| `cellHasTMFlag(pos, mask)` | Architect.c:36 | state/helpers.ts:75 | Check if any terrain layer has given TM flags |
| `cellHasTerrainType(pos, terrain)` | Architect.c:41 | state/helpers.ts:84 | Check if terrain type exists on any layer |
| `highestPriorityLayer(x, y, skipGas)` | Globals.c | state/helpers.ts:103 | Find the layer with highest draw priority |
| `discoveredTerrainFlagsAtLoc(pos)` | Monsters.c | state/helpers.ts:139 | What flags would be revealed if secrets were discovered |
| `coordinatesAreInMap(x, y)` | Rogue.h:1241 | globals/tables.ts | Bounds check: `0 ≤ x < DCOLS && 0 ≤ y < DROWS` |
| `pmapAt(pos)` / `tmapAt(pos)` | GlobalsBase.h:34/29 | inline in TS: `pmap[loc.x][loc.y]` | Accessor with bounds assertion |

## Data Structures

### pcell / Pcell — Permanent Cell

Persisted across level saves. One per grid cell in `pmap[DCOLS][DROWS]`.

| Field (C) | Field (TS) | Type | Description |
|-----------|------------|------|-------------|
| `layers[NUMBER_TERRAIN_LAYERS]` | `layers: TileType[]` | `tileType[4]` | Terrain on each of the 4 layers (Dungeon, Liquid, Gas, Surface) |
| `flags` | `flags: number` | `unsigned long` | Cell-level flags bitmask (`tileFlags`: VISIBLE, DISCOVERED, etc.) |
| `volume` | `volume: number` | `unsigned short` | Quantity of gas in cell |
| `machineNumber` | `machineNumber: number` | `unsigned char` | Which machine this cell belongs to (0 = none) |
| `rememberedAppearance` | `rememberedAppearance: CellDisplayBuffer` | `cellDisplayBuffer` | How the player last saw this cell (glyph + colors) |
| — | `rememberedLayers: TileType[]` | — | TS-only: live terrain layers at time of last visibility (for sprite renderer) |
| `rememberedItemCategory` | `rememberedItemCategory: number` | `enum itemCategory` | Item category player remembers here |
| `rememberedItemKind` | `rememberedItemKind: number` | `short` | Item kind player remembers |
| `rememberedItemQuantity` | `rememberedItemQuantity: number` | `short` | How many items player remembers |
| `rememberedItemOriginDepth` | `rememberedItemOriginDepth: number` | `short` | Origin depth of remembered item |
| `rememberedTerrain` | `rememberedTerrain: TileType` | `enum tileType` | Highest-priority terrain when last seen |
| `rememberedCellFlags` | `rememberedCellFlags: number` | `unsigned long` | Cell flags when last seen |
| `rememberedTerrainFlags` | `rememberedTerrainFlags: number` | `unsigned long` | Terrain flags when last seen |
| `rememberedTMFlags` | `rememberedTMFlags: number` | `unsigned long` | TM flags when last seen |
| `exposedToFire` | `exposedToFire: number` | `short` | Fire exposure count since last environment update |

### tcell / Tcell — Transient Cell

Not saved between levels. One per grid cell in `tmap[DCOLS][DROWS]`.

| Field (C) | Field (TS) | Type | Description |
|-----------|------------|------|-------------|
| `light[3]` | `light: [number, number, number]` | `short[3]` | Current RGB lighting components |
| `oldLight[3]` | `oldLight: [number, number, number]` | `short[3]` | Previous frame RGB (used to detect if refresh needed) |

### Dungeon Layers

Each cell has 4 terrain layers, indexed by `enum dungeonLayers` / `DungeonLayer`:

| Index | Name | C Enum | Purpose | Examples |
|-------|------|--------|---------|----------|
| 0 | Dungeon | `DUNGEON` | Structural terrain | Walls, floors, doors, stairs |
| 1 | Liquid | `LIQUID` | Liquid terrain | Lava, deep water, shallow water, chasms |
| 2 | Gas | `GAS` | Gas-level terrain | Fire, smoke, swamp gas |
| 3 | Surface | `SURFACE` | Surface objects | Grass, webs, blood, lichen |

Each layer holds a `tileType` enum value. The `tileType` indexes into the `tileCatalog` (array of `floorTileType`) to look up the tile's visual appearance, terrain flags, TM flags, draw priority, and behavior (ignite chance, promotion, light glow, etc.).

### floorTileType — Tile Property Catalog

Defined in Rogue.h:1905. Each entry describes one terrain type's properties:

- `displayChar` — glyph to render
- `foreColor` / `backColor` — base colors
- `drawPriority` — lower number = higher visual priority (governs layer visibility)
- `flags` — terrain flags bitmask (`terrainFlagCatalog`)
- `mechFlags` — terrain mechanical flags bitmask (`terrainMechanicalFlagCatalog`)
- `chanceToIgnite`, `fireType`, `discoverType`, `promoteType`, `promoteChance`, `glowLight` — behavioral properties

### Grid (auxiliary) — short** / number[][]

Column-major 2D arrays of size DCOLS×DROWS used for pathfinding, distance computation, and dungeon generation. Allocated with `allocGrid()`, freed with `freeGrid()`. The TS type is `Grid = number[][]`.

## Flow

### How terrain flags are resolved

Terrain flags are not stored directly on `pcell` — they are computed on the fly from the tile catalog:

1. Read `cell.layers[0..3]` — four `tileType` enum values
2. Look up `tileCatalog[tileType].flags` for each layer
3. OR them together → combined terrain flags for the cell
4. Same process for `mechFlags` → combined TM flags

This is the `terrainFlags(pmap, pos)` function. The indirection through the catalog means that changing a cell's terrain is done by changing `cell.layers[layer]` to a different `tileType` value — the flags are always derived, never stored separately.

### Grid lifecycle during a level

1. **clearLevel()** (Architect.c:2765) — zero out all `pmap` cells: all layers set to `NOTHING`, flags cleared
2. **digDungeon()** — carve rooms and corridors by setting `layers[DUNGEON]` to `FLOOR`/`GRANITE`/`DOOR`
3. **designLakes()** — add liquid layer terrain (DEEP_WATER, LAVA, etc.)
4. **buildAMachine()** — place machines, set `machineNumber`, modify layers
5. **analyzeMap()** — compute IN_LOOP, IS_CHOKEPOINT, IS_GATE_SITE flags
6. **finishWalls() / finishDoors()** — clean up dungeon edges and door states
7. **updateLighting()** — fill `tmap` with lighting values
8. **Game loop** — per-turn updates via `updateEnvironment()` (fire spread, gas dissipation, terrain promotion), `updateSafetyMap()`, scent updates

### Level save/restore cycle

When the player descends/ascends, the current level's `pmap` is deep-copied into `levels[depth].mapStorage`, and the new level's `mapStorage` is copied back into the active `pmap`. The `tmap` is not saved — lighting is recomputed on level entry. The `scentMap` is saved per-level in `levels[depth].scentMap`.

## Integration Points

### Dungeon Generation (Architect.c)

The heaviest user of the grid system. Reads and writes `pmap.layers`, `pmap.flags`, and `pmap.machineNumber` extensively. Uses auxiliary `short**` grids for room/blob generation, passability analysis, and machine interior calculation. Key functions: `clearLevel`, `digDungeon`, `designLakes`, `buildAMachine`, `fillLake`, `createWreath`, `spawnDungeonFeature`, `fillSpawnMap`, `analyzeMap`.

### Pathfinding (Dijkstra/Movement)

`dijkstraScan()` operates on auxiliary `short**` grids (cost maps and distance maps), not on `pmap` directly. Cost maps are built by reading `pmap.layers` to determine passability, then running the scan to produce distance values. `getQualifyingPathLocNear()` in Grid.c combines grid allocation, cost map setup, Dijkstra scan, and random location selection.

### Lighting (Light.c)

Writes to `tmap.light[3]` and `tmap.oldLight[3]`. `paintLight()` accumulates RGB values into `tmap.light`. `updateDisplayDetail()` reads `tmap` light values to determine DV_UNLIT/DV_LIT/DV_DARK status. `backUpLighting()` / `restoreLighting()` snapshot and restore `tmap.light` for transient visual effects.

### Field of View (Movement.c)

`updateFieldOfViewDisplay()` sets `IN_FIELD_OF_VIEW` and `VISIBLE` flags on `pmap.flags` based on line-of-sight calculations. Reads `tmap.light` to determine if there's enough illumination for visibility. Also reads/writes `tmap.oldLight` for change detection.

### Environment Updates (Time.c)

`updateEnvironment()` processes terrain changes: gas dissipation (GAS layer), fire spread, terrain promotion. Reads and writes `pmap.layers`, `pmap.volume`, `pmap.exposedToFire`, and `pmap.flags`. `updateSafetyMap()` and `updateAllySafetyMap()` build auxiliary grids by reading `pmap` passability data and running Dijkstra scans.

### Scent System (Movement.c / Time.c)

`scentMap` is a dynamically-allocated `short**` grid (same dimensions as `pmap`). It records how recently the player visited each cell, using `rogue.scentTurnNumber` as a monotonic clock. `addScentToCell()` writes to it; monsters read it to track the player. Scent decays implicitly (old values become stale as `scentTurnNumber` advances). The scent map is saved per-level in `levels[depth].scentMap`.

### Rendering (IO.c)

`getCellAppearance()` reads `pmap.layers`, `pmap.flags`, `pmap.rememberedAppearance`, and `tmap.light` to determine what glyph and colors to draw. The sprite renderer also reads `pmap.layers` directly for tile-based rendering.

## Key Globals

| Global (C) | TS Location | Type | Lifetime | Description |
|------------|-------------|------|----------|-------------|
| `pmap[DCOLS][DROWS]` | `core.ts:231` | `pcell[][]` / `Pcell[][]` | Per-level (saved to `levels[].mapStorage`) | Permanent cell data — terrain, flags, remembered state |
| `tmap[DCOLS][DROWS]` | `core.ts:232` | `tcell[][]` / `Tcell[][]` | Per-level (not saved, recomputed) | Transient lighting data |
| `scentMap` | `core.ts:246` | `short**` / `number[][] \| null` | Per-level (saved to `levels[].scentMap`) | Player scent trail for monster tracking |
| `safetyMap` | allocated in `initializeRogue()` | `short**` / `number[][]` | Global (recomputed per turn) | Dijkstra map guiding fleeing monsters away from player |
| `allySafetyMap` | allocated in `initializeRogue()` | `short**` / `number[][]` | Global (recomputed per turn) | Like safetyMap but for ally fleeing behavior |
| `chokeMap` | allocated in `initializeRogue()` | `short**` / `number[][]` | Global (recomputed per level) | Importance scores for map chokepoints |
| `terrainRandomValues[DCOLS][DROWS][8]` | `core.ts` | `short[][][8]` | Per-level | Random values for terrain color variation |
| `displayDetail[DCOLS][DROWS]` | `core.ts` | `short[][]` | Per frame | DV_UNLIT / DV_LIT / DV_DARK status per cell |

**Who reads/writes:**

- **pmap**: Read by nearly everything (rendering, pathfinding, AI, items, combat, FOV). Written by dungeon generation (Architect), environment updates (Time), dungeon features (spawnDungeonFeature), creature effects, and the tile effects system.
- **tmap**: Written by Light.c (`paintLight`, `updateLighting`). Read by rendering (IO.c), FOV (Movement.c), and playerInDarkness().
- **scentMap**: Written by `addScentToCell()` (Movement.c) and `resetScentTurnNumber()` (Time.c). Read by monster AI for player tracking (`scentDirection`, `isLocalScentMaximum`), and by rendering for stealth range display.
- **safetyMap**: Written by `updateSafetyMap()` (Time.c). Read by monster fleeing AI (`getSafetyMap()` in Monsters.c). Monsters outside FOV copy it to their personal `monst->safetyMap` to avoid omniscient fleeing.

## Constraints & Invariants

1. **Grid dimensions are compile-time constants**: `DCOLS = 79`, `DROWS = 29`. Derived from `COLS = 100`, `ROWS = 34`, `STAT_BAR_WIDTH = 20`, `MESSAGE_LINES = 3`. These cannot be changed without affecting rendering, save format, and the tile catalog layout.

2. **Column-major indexing**: All grids are indexed `[x][y]` where x is column (0..DCOLS-1) and y is row (0..DROWS-1). This matches the C layout `short array[DCOLS][DROWS]`.

3. **Bounds checking**: `coordinatesAreInMap(x, y)` returns `x >= 0 && x < DCOLS && y >= 0 && y < DROWS`. Must be checked before any grid access. `pmapAt()`/`tmapAt()` include assertions.

4. **Terrain flags are derived, never stored**: A cell's terrain flags come from OR-ing `tileCatalog[cell.layers[i]].flags` across all 4 layers. You never write flags directly — you change the layer's `tileType` value.

5. **Cell flags (pmap.flags) vs terrain flags**: These are distinct bitmask types. Cell flags (`tileFlags`: VISIBLE, HAS_MONSTER, IN_LOOP, etc.) are stored directly on `pcell.flags`. Terrain flags (`terrainFlagCatalog`: T_OBSTRUCTS_PASSABILITY, T_IS_FIRE, etc.) are derived from the tile catalog per layer. Don't confuse them.

6. **PERMANENT_TILE_FLAGS**: The subset of cell flags that persist across save/load: DISCOVERED, MAGIC_MAPPED, ITEM_DETECTED, HAS_ITEM, HAS_DORMANT_MONSTER, HAS_MONSTER, HAS_STAIRS, SEARCHED_FROM_HERE, PRESSURE_PLATE_DEPRESSED, STABLE_MEMORY, KNOWN_TO_BE_TRAP_FREE, IN_LOOP, IS_CHOKEPOINT, IS_GATE_SITE, IS_IN_MACHINE, IMPREGNABLE.

7. **Layer priority**: When multiple layers have terrain, `drawPriority` in `floorTileType` determines which is visually dominant. Lower number = higher visual priority.

8. **NUMBER_TERRAIN_LAYERS = 4**: Always exactly 4 layers. The enum has a sentinel `NUMBER_TERRAIN_LAYERS` at position 4.

9. **Auxiliary grids are always DCOLS×DROWS shorts**: `allocGrid()` returns a grid of this exact size. All grid utility functions iterate `0..DCOLS-1` and `0..DROWS-1`.

10. **scentMap uses unsigned short semantics**: Values represent `scentTurnNumber` at time of visit. Monster distance = `rogue.scentTurnNumber - scentMap[x][y]`. Rollover protection: `resetScentTurnNumber()` is called when `scentTurnNumber > 20000`.

## Modification Notes

- **Changing grid dimensions** would require updating `COLS`, `ROWS`, `STAT_BAR_WIDTH`, `MESSAGE_LINES` and all derived constants. The entire rendering pipeline, save format, and many hardcoded grid-iteration loops assume the current sizes.

- **Adding a terrain layer** would require changing `NUMBER_TERRAIN_LAYERS`, expanding `pcell.layers`, and updating every function that iterates layers (especially `terrainFlags()`, `terrainMechFlags()`, and all the `cellHas*` functions).

- **Modifying pmap/tmap outside the proper lifecycle** (e.g., setting `layers` without going through `spawnDungeonFeature`) may break invariants. The dungeon feature system is the intended way to modify terrain after level generation.

- **Grid functions in Grid.c operate on auxiliary grids, not on pmap/tmap**. If you need to filter pmap cells into an auxiliary grid, use `getTerrainGrid()` or `getTMGrid()`.

- **TS port difference — `rememberedLayers`**: The TS `Pcell` has an extra field `rememberedLayers: TileType[]` not present in the C `pcell`. This supports the sprite renderer's need to recall per-layer terrain types from memory (the C version only stores `rememberedAppearance` as a glyph+colors, not per-layer terrain).

- **TS port difference — dependency injection**: The C code accesses `pmap`, `tmap`, etc. as globals. The TS port passes them as explicit parameters or via context objects. Nearly every function that touches the grid takes `pmap: Pcell[][]` as a parameter.
