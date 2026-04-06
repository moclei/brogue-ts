# Machine System

> Last verified: 2026-04-05 | Commit: f9fc105 (Phase 1 Tasks 1–7 complete)

## Summary

Machines are procedurally generated special rooms and areas in Brogue. Each machine
is built from a `blueprint` record that specifies what terrain, items, and monsters to
place and under what conditions. They are the primary source of interesting gameplay
set-pieces: reward rooms, key-guard vestibules, trap rooms, and thematic flavour areas.

## Key Files

| File (C) | File (TS) | Responsibility |
|----------|-----------|----------------|
| `src/brogue/Architect.c` | `rogue-ts/src/architect/` | All machine generation logic |
| `src/brogue/Rogue.h` | `rogue-ts/src/types/` | `blueprint`, `machineFeature`, `machineTypes`, flag enums |
| `src/variants/GlobalsBrogue.c` | — | `blueprintCatalog_Brogue[]` (the actual table, 71 entries + slot 0) |
| `src/brogue/Globals.c` | — | `blueprintCatalog` extern pointer (set at init time) |

## Key Functions

| Function | File | Line | Purpose |
|----------|------|------|---------|
| `addMachines` | Architect.c | 1732 | Top-level: called once per level to spawn all reward machines |
| `buildAMachine` | Architect.c | 984 | Build one machine: choose blueprint, find location, place all features |
| `blueprintQualifies` | Architect.c | 455 | Filter: depth range, required flags, BP_ADOPT_ITEM/BP_VESTIBULE guards |
| `prepareInteriorWithMachineFlags` | Architect.c | 856 | Apply BP_* flags to the interior grid (purge, expand, redesign, impregnable) |
| `expandMachineInterior` | Architect.c | 607 | Iteratively absorb wall tiles into the interior (convex expansion) |
| `fillInteriorForVestibuleMachine` | Architect.c | 674 | Dijkstra-flood fill from origin to build a BP_VESTIBULE interior |
| `redesignInterior` | Architect.c | 734 | Nuke interior to granite and cut fresh rooms (BP_REDESIGN_INTERIOR) |
| `fillSpawnMap` | Architect.c | 3208 | Write a tile type into the dungeon layer for every cell marked in a spawn map |
| `spawnDungeonFeature` | Architect.c | 3359 | Fully spawn one `dungeonFeature`: propagate terrain, call fillSpawnMap, fire effects, toggle dormancy |
| `addTileToMachineInteriorAndIterate` | Architect.c | 400 | Flood-fill helper that marks rooms reachable from an origin as interior |
| `abortItemsAndMonsters` | Architect.c | 470 | Roll back items and monsters if a machine attempt fails |
| `runAutogenerators` | Architect.c | 1780 | Separately called: spawns terrain DFs and flavour machines from `autoGeneratorCatalog` |

## Data Structures

### `blueprint` struct (`Rogue.h:2657`)

```c
typedef struct blueprint {
    const char *name;           // human-readable machine name (debug/logging)
    short depthRange[2];        // [minDepth, maxDepth] — machine only spawns in this range
    short roomSize[2];          // [minSize, maxSize] — room tile count (or chokepoint size for BP_ROOM)
    short frequency;            // raffle tickets: higher = more common (0 = never in raffle)
    short featureCount;         // number of active entries in feature[] (max 20)
    short dungeonProfileType;   // which dungeon profile to use when BP_REDESIGN_INTERIOR is set
    unsigned long flags;        // blueprint-level BP_* flags
    machineFeature feature[20]; // the feature table for this blueprint
} blueprint;
```

### `machineFeature` struct (`Rogue.h:2618`)

```c
typedef struct machineFeature {
    enum dungeonFeatureTypes featureDF;  // DF to spawn at each feature location (0 = none)
    enum tileType terrain;               // terrain tile to place (0 = none)
    enum dungeonLayers layer;            // which terrain layer to write to

    short instanceCountRange[2];         // [min, max] instances to place
    short minimumInstanceCount;          // abort this feature if fewer placed

    short itemCategory;                  // item category to generate (-1 = random)
    short itemKind;                      // item kind to generate (-1 = random)
    short monsterID;                     // monster kind to generate
    short personalSpace;                 // subsequent features stay this far away

    unsigned long hordeFlags;            // horde selection flags
    unsigned long itemFlags;             // flags applied to any generated item
    unsigned long flags;                 // MF_* feature flags
} machineFeature;
```

### `machineData` struct (local to Architect.c, line 961)

Internal state struct, stack-allocated via `malloc` inside `buildAMachine`:

```c
typedef struct machineData {
    char interior[DCOLS][DROWS];    // master interior grid
    char occupied[DCOLS][DROWS];    // personal-space exclusion zones
    char candidates[DCOLS][DROWS];  // eligible placement cells for current feature
    char blockingMap[DCOLS][DROWS]; // temporary blocking-check grid
    char viewMap[DCOLS][DROWS];     // FOV from origin (MF_IN_VIEW_OF_ORIGIN)
    pcell levelBackup[DCOLS][DROWS]; // copy of level state for rollback

    item    *spawnedItems[MACHINES_BUFFER_LENGTH];
    item    *spawnedItemsSub[MACHINES_BUFFER_LENGTH];
    creature *spawnedMonsters[MACHINES_BUFFER_LENGTH];
    creature *spawnedMonstersSub[MACHINES_BUFFER_LENGTH];

    pos   gateCandidates[50];
    short distances[100];
    short sRows[DROWS];
    short sCols[DCOLS];
} machineData;
```

### `BP_*` Blueprint Flags (`Rogue.h:2639`)

| Flag | Bit | Meaning |
|------|-----|---------|
| `BP_ADOPT_ITEM` | Fl(0) | Machine must receive an adopted item (e.g. a door key from a parent machine) |
| `BP_VESTIBULE` | Fl(1) | Spawns at a doorway and expands outward; requires an origin location |
| `BP_PURGE_PATHING_BLOCKERS` | Fl(2) | Remove traps and other T_PATHING_BLOCKERs from interior before building |
| `BP_PURGE_INTERIOR` | Fl(3) | Clear all terrain layers in interior to bare floor before building |
| `BP_PURGE_LIQUIDS` | Fl(4) | Clear the LIQUID layer from the interior before building |
| `BP_SURROUND_WITH_WALLS` | Fl(5) | Fill impassable perimeter gaps (water, lava, traps) with wall |
| `BP_IMPREGNABLE` | Fl(6) | Mark interior and surrounding tiles IMPREGNABLE (immune to tunneling) |
| `BP_REWARD` | Fl(7) | Metered reward machine — counted against `rogue.rewardRoomsGenerated` |
| `BP_OPEN_INTERIOR` | Fl(8) | Expand interior until convex or bounded by other rooms (≥4 open neighbours) |
| `BP_MAXIMIZE_INTERIOR` | Fl(9) | Expand as aggressively as possible (≥1 open neighbour), can engulf whole level |
| `BP_ROOM` | Fl(10) | Spawn in a dead-end room dominated by a chokepoint; `roomSize` is chokepoint size |
| `BP_TREAT_AS_BLOCKING` | Fl(11) | Abort if placing the interior (as walls) would disconnect the level |
| `BP_REQUIRE_BLOCKING` | Fl(12) | Abort UNLESS placing the interior (as walls) disconnects the level by ≥100 tiles |
| `BP_NO_INTERIOR_FLAG` | Fl(13) | Do not mark tiles with IS_IN_MACHINE; used for flavour machines |
| `BP_REDESIGN_INTERIOR` | Fl(14) | Nuke interior to granite; carve entirely new rooms using `dungeonProfileType` |

### `MF_*` Machine Feature Flags (selected — `Rogue.h:2584`)

| Flag | Bit | Meaning |
|------|-----|---------|
| `MF_GENERATE_ITEM` | Fl(0) | Generate an item at this feature location |
| `MF_OUTSOURCE_ITEM_TO_MACHINE` | Fl(1) | Generated item must be adopted by another machine (vestibule key) |
| `MF_BUILD_VESTIBULE` | Fl(2) | Call `buildAMachine` at the doorway origin to create a door-guard machine |
| `MF_ADOPT_ITEM` | Fl(3) | This feature takes the adopted item from parent or prior feature |
| `MF_NO_THROWING_WEAPONS` | Fl(4) | Generated item may not be a throwing weapon |
| `MF_GENERATE_HORDE` | Fl(5) | Generate a monster horde matching `hordeFlags` |
| `MF_BUILD_AT_ORIGIN` | Fl(6) | Place this feature at the room entrance/origin tile |
| `MF_PERMIT_BLOCKING` | Fl(8) | Allow this feature to block map passability |
| `MF_TREAT_AS_BLOCKING` | Fl(9) | Treat this terrain as blocking for placement eligibility checks |
| `MF_NEAR_ORIGIN` | Fl(10) | Feature must be in closest ~quarter of interior tiles to origin |
| `MF_FAR_FROM_ORIGIN` | Fl(11) | Feature must be in farthest ~quarter of interior tiles from origin |
| `MF_MONSTER_TAKE_ITEM` | Fl(12) | The horde leader spawned by this feature carries the associated item |
| `MF_MONSTER_SLEEPING` | Fl(13) | Spawned monsters start asleep |
| `MF_MONSTER_FLEEING` | Fl(14) | Spawned monsters permanently flee |
| `MF_EVERYWHERE` | Fl(15) | Place this feature on every interior tile (e.g. carpeting) |
| `MF_ALTERNATIVE` | Fl(16) | Only one feature with this flag per machine is built (random selection) |
| `MF_ALTERNATIVE_2` | Fl(17) | Same as MF_ALTERNATIVE but an independent group |
| `MF_REQUIRE_GOOD_RUNIC` | Fl(18) | Generated item must be an uncursed runic |
| `MF_MONSTERS_DORMANT` | Fl(19) | Monsters placed dormant; awakened when a DF with DFF_ACTIVATE_DORMANT_MONSTER lands on their tile |
| `MF_REQUIRE_HEAVY_WEAPON` | Fl(20) | Requires a positively-enchanted heavy weapon |
| `MF_BUILD_IN_WALLS` | Fl(21) | Place in an impassable tile adjacent to the interior |
| `MF_BUILD_ANYWHERE_ON_LEVEL` | Fl(22) | Place anywhere on level outside the machine |
| `MF_REPEAT_UNTIL_NO_PROGRESS` | Fl(23) | Keep rebuilding this feature set until no progress is made |
| `MF_IMPREGNABLE` | Fl(24) | Feature location becomes immune to tunneling |
| `MF_IN_VIEW_OF_ORIGIN` | Fl(25) | Feature must be visible from origin (optical FOV) |
| `MF_IN_PASSABLE_VIEW_OF_ORIGIN` | Fl(26) | Feature must be visible from origin (pathing-blocker FOV) |
| `MF_NOT_IN_HALLWAY` | Fl(27) | Location must have passableArcCount ≤ 1 (not a corridor) |
| `MF_NOT_ON_LEVEL_PERIMETER` | Fl(28) | Do not place in outermost wall ring |
| `MF_SKELETON_KEY` | Fl(29) | A generated/adopted key opens all locks in this machine |
| `MF_KEY_DISPOSABLE` | Fl(30) | Key self-destructs after use at current location |

### Blueprint Catalog

The `blueprintCatalog` extern pointer is set at game init to variant-specific tables:
- Brogue: `blueprintCatalog_Brogue` (in `src/variants/GlobalsBrogue.c`)
- Rapid Brogue: `blueprintCatalog_RapidBrogue`
- Bullet Brogue: `blueprintCatalog_BulletBrogue`

**Total entries in `blueprintCatalog_Brogue`: 71 named blueprints** (index 0 is a dummy `{0}` placeholder; indices 1–71 are real blueprints).

Machine types are defined in `enum machineTypes` (`Rogue.h:2668`):

| Category | Enum range | Count | Notes |
|----------|-----------|-------|-------|
| Reward rooms | MT_REWARD_MULTI_LIBRARY … MT_REWARD_SENTINEL_SANCTUARY | 14 | BP_REWARD set; metered by `rewardRoomsGenerated` |
| Amulet holder | MT_AMULET_AREA | 1 | Depth 26 only |
| Door guard vestibules | MT_LOCKED_DOOR_VESTIBULE … MT_GUARDIAN_VESTIBULE | 10 | BP_VESTIBULE set; spawned by MF_BUILD_VESTIBULE |
| Key guard machines | MT_KEY_REWARD_LIBRARY … MT_KEY_BOSS_ROOM | 32 | Trap/puzzle rooms with key on altar |
| Thematic machines | MT_BLOODFLOWER_AREA … MT_SENTINEL_AREA | 14 | Flavour; frequency = 0 (spawned via autoGenerators) |
| Variant-specific | MT_REWARD_HEAVY_OR_RUNIC_WEAPON | 1 | Bullet Brogue depth-1 weapon vault |

**Representative depth ranges and frequencies (Brogue variant):**

| Blueprint name | Depths | Freq |
|----------------|--------|------|
| Mixed item library | 1–12 | 30 |
| Single item category library | 1–12 | 15 |
| Treasure room (potions/scrolls) | 8–26 | 20 |
| Good permanent item pedestals | 5–16 | 30 |
| Good consumable pedestals | 10–26 | 30 |
| Commutation altars | 13–26 | 50 |
| Resurrection altar | 13–26 | 30 |
| Goblin warren | 5–17 | 10 |
| Sentinel sanctuary | 1–12 | 5 |
| Rat trap room | — (key guard) | — |
| Gauntlet (turret trap) | — (key guard) | — |
| Flavour machines (idyll, swamp…) | 1–deepest | 0 |

Flavour machines (`frequency = 0`) are never selected by `buildAMachine`'s raffle; they are
spawned exclusively via `runAutogenerators` / `autoGeneratorCatalog`.

## Flow

### Level generation entry point

```
buildLevel()
  ├── runAutogenerators(false)   // terrain DFs and flavour machines (non-machine autogenerators)
  ├── addMachines()              // reward machines
  └── runAutogenerators(true)    // autogenerators that include a machine field
```

### `addMachines` (Architect.c:1732)

1. `analyzeMap(true)` — compute chokepoint map for the whole level.
2. If Bullet Brogue and depth 1: guarantee one `MT_REWARD_HEAVY_OR_RUNIC_WEAPON` (up to 50 tries).
3. If depth == `gameConst->amuletLevel` (26): guarantee `MT_AMULET_AREA` (up to 50 tries).
4. Compute `machineCount` using the reward-room suppression formula based on
   `rogue.rewardRoomsGenerated`, `machinesPerLevelSuppressionMultiplier`,
   `machinesPerLevelSuppressionOffset`, and `machinesPerLevelIncreaseFactor`.
5. Add random bonus machines (`rand_percent` loop, capped at 100).
6. Loop up to 50 attempts per machine: call `buildAMachine(-1, -1, -1, BP_REWARD, …)`.
   On success increment `rogue.rewardRoomsGenerated`.

### `buildAMachine` (Architect.c:984) — up to 10 retries

**Signature:** `buildAMachine(bp, originX, originY, requiredMachineFlags, adoptiveItem, parentSpawnedItems[], parentSpawnedMonsters[])`

- `bp <= 0` → choose blueprint from raffle.
- `originX/Y <= 0` → choose location.

**Retry loop (up to 10):**

1. **Blueprint selection** (if `chooseBP`):
   - Call `blueprintQualifies(i, requiredMachineFlags)` for each blueprint.
   - `blueprintQualifies` checks: depth range, required flags present, BP_ADOPT_ITEM/BP_VESTIBULE absent unless required.
   - Weighted raffle by `frequency`; pick blueprint index → `bp`.

2. **Location selection:**
   - If `BP_ROOM`: use chokeMap from `analyzeMap`; scan for tiles where `chokeMap[i][j]` is within `roomSize` range; build list of `gateCandidates`; shuffle; iterate.
   - If `BP_VESTIBULE`: origin is the doorway; call `fillInteriorForVestibuleMachine`.
   - Otherwise: call `randomMatchingLocation` to pick a floor tile meeting criteria; flood-fill from origin with `addTileToMachineInteriorAndIterate` to build interior; check size against `roomSize`; check connectivity with `levelIsDisconnectedWithBlockingMap`.

3. **`copyMap`** — save level state for potential rollback.

4. **`prepareInteriorWithMachineFlags`** — apply BP_* cleanup/expansion flags to `interior` grid:
   - `BP_MAXIMIZE_INTERIOR` → `expandMachineInterior(interior, 1)`
   - `BP_OPEN_INTERIOR` → `expandMachineInterior(interior, 4)`
   - `BP_PURGE_INTERIOR` → clear all terrain in interior to bare floor
   - `BP_PURGE_PATHING_BLOCKERS` → remove traps
   - `BP_PURGE_LIQUIDS` → clear liquid layer
   - `BP_SURROUND_WITH_WALLS` → fill impassable perimeter with walls
   - `BP_REDESIGN_INTERIOR` → call `redesignInterior` (nuke + recut rooms)
   - `BP_IMPREGNABLE` → mark interior + border tiles IMPREGNABLE

5. **Mark interior tiles** with `IS_IN_ROOM_MACHINE` or `IS_IN_AREA_MACHINE` (unless `BP_NO_INTERIOR_FLAG`). Set `pmap[i][j].machineNumber`.

6. **Alternative feature selection:** For each of two alternative groups (`MF_ALTERNATIVE`, `MF_ALTERNATIVE_2`), pick one feature at random from those tagged; mark others to be skipped (`skipFeature[]`).

7. **Feature loop** — for each feature in `blueprintCatalog[bp].feature[0..featureCount-1]`:
   - Skip if in `skipFeature[]`.
   - Build `candidates[]` grid: filter interior cells by distance, personal space, hallway rules, wall flags, view flags.
   - If `MF_EVERYWHERE`: place on all interior cells.
   - Otherwise: shuffle candidate coordinates; place `instanceCount` instances.
   - For each placed instance:
     - Place terrain tile if `feature->terrain`.
     - Spawn DF if `feature->featureDF` via `spawnDungeonFeature`.
     - Generate item if `MF_GENERATE_ITEM` via `generateItem` + `placeItemAt`.
     - Generate monsters if `MF_GENERATE_HORDE` via `spawnHorde`.
     - Generate single monster if `monsterID` via `generateMonster`.
     - If `MF_MONSTERS_DORMANT`: call `toggleMonsterDormancy`.
     - If `MF_BUILD_VESTIBULE`: recurse into `buildAMachine` with `BP_VESTIBULE | BP_ADOPT_ITEM`.
     - Record spawned items/monsters in `spawnedItems[]` / `spawnedMonsters[]`.
   - Connectivity check after blocking terrain: `levelIsDisconnectedWithBlockingMap`.
   - If feature fails minimum instance count: set `tryAgain = true`, `copyMap` restore, break.

8. On success: `free(p)`, return `true`.
9. On retry: `abortItemsAndMonsters`, restore from `copyMap`, decrement failsafe, loop.
10. On final failure: `free(p)`, return `false`.

### `expandMachineInterior` (Architect.c:607)

Iterative expansion of the interior grid:
- For each wall tile (`T_PATHING_BLOCKER`) with `machineNumber == 0`:
  - Count open interior neighbours (8-directional).
  - If ≥ `minimumInteriorNeighbors` AND no exterior open/machine neighbours → absorb tile into interior, convert pathing-blocking layers to FLOOR/NOTHING, convert adjacent GRANITE to WALL.
- Repeat until no change.
- Post-pass: clear DOOR and SECRET_DOOR tiles from interior.

### `fillInteriorForVestibuleMachine` (Architect.c:674)

For `BP_VESTIBULE` blueprints (door guard machines):
1. Zero the interior grid.
2. `allocGrid` + `fillGrid(30000)` for distance map; set origin to 0.
3. `populateGenericCostMap`; mark existing machine tiles as `PDS_FORBIDDEN`.
4. `dijkstraScan` from origin.
5. Flood-fill outward from origin in distance order until `roomSize` tiles reached.
6. Abort if any engulfed tile already has an item (`HAS_ITEM`).
7. Check `BP_TREAT_AS_BLOCKING` / `BP_REQUIRE_BLOCKING` via `levelIsDisconnectedWithBlockingMap`.

### `redesignInterior` (Architect.c:734)

For `BP_REDESIGN_INTERIOR` blueprints:
1. `allocGrid` × 3; copy and widen interior, fill with granite.
2. `attachRooms` using `dungeonProfileType` to cut new rooms.
3. `copyGrid` / `findReplaceGrid` to reconcile.
4. `addLoops` for extra connectivity.
5. Zero out any interior tiles still walled after room cutting.

### `spawnDungeonFeature` (Architect.c:3359)

1. If `DFF_RESURRECT_ALLY`: call `resurrectAlly`; fail if returns false.
2. Print description message if player can see location and not yet displayed.
3. Determine `blocking` flag (abort if terrain is pathing-blocker and level would disconnect).
4. If `feat->tile`:
   - GAS layer: directly increment `pmap[x][y].volume` and set tile.
   - Other layers: call `spawnMapDF(x, y, propagationTerrain, …, blockingMap)`.
     - If not blocking or connectivity check passes:
       - If `DFF_EVACUATE_CREATURES_FIRST`: `evacuateCreatures(blockingMap)`.
       - `fillSpawnMap(layer, tile, blockingMap, …)` — write tile to all marked cells.
5. Post-success effects:
   - Clear lower-priority terrain if `DFF_CLEAR_LOWER_PRIORITY_TERRAIN` / `DFF_CLEAR_OTHER_TERRAIN`.
   - `aggravateMonsters` if `DFF_AGGRAVATES_MONSTERS`.
   - `colorFlash` / `createFlare` if refresh and effects set.
   - `applyInstantTileEffectsToCreature` if tile is fire or auto-descent and player is on it.
   - **Dormant monster activation**: if `DFF_ACTIVATE_DORMANT_MONSTER`, iterate `dormantMonsters`; call `toggleMonsterDormancy` for any monster whose location is in `blockingMap`.
   - Recurse into `spawnDungeonFeature` for `feat->subsequentDF` (optionally `DFF_SUBSEQ_EVERYWHERE`).
6. Return `succeeded`.

### `fillSpawnMap` (Architect.c:3208)

For each cell `(i,j)` where `spawnMap[i][j]` is set:
- Skip if already the target tile type.
- Skip if new tile has lower draw priority than existing (unless `superpriority`).
- Skip if SURFACE layer and cell has `T_OBSTRUCTS_SURFACE_EFFECTS`.
- Skip if `blockedByOtherLayers` and highest-priority layer has higher draw priority than new tile.
- Write tile: `pmap[i][j].layers[layer] = surfaceTileType`.
- Set `CAUGHT_FIRE_THIS_TURN` if tile is fire.
- Set `rogue.staleLoopMap` if pathing-blocker status changed.
- If `refresh`: `refreshDungeonCell`, `flavorMessage` for player tile, `applyInstantTileEffectsToCreature` for any monster, `burnItem` for flammable items on fire tiles.

## Integration Points

- **Level generation**: `buildLevel` in `RogueMain.c` calls `addMachines` and `runAutogenerators`.
- **Autogenerators**: `runAutogenerators` (Architect.c:1780) reads `autoGeneratorCatalog`; entries with `machine > 0` call `buildAMachine` directly for area machines.
- **Dungeon feature system**: `spawnDungeonFeature` is called both from `buildAMachine` (during generation) and from runtime trigger code (when terrain DFs fire mid-game).
- **Dormant monsters**: `toggleMonsterDormancy` (Monsters.c) moves monsters between `monsters` and `dormantMonsters` lists. `DFF_ACTIVATE_DORMANT_MONSTER` in `spawnDungeonFeature` is the sole activation mechanism.
- **Key-pickup trigger path**: not documented here — see trigger/activation path task.
- **Vestibule recursion**: `MF_BUILD_VESTIBULE` in a feature causes `buildAMachine` to call itself recursively with `BP_VESTIBULE | BP_ADOPT_ITEM`, passing the current feature's item as the adopted item.

## Constraints & Invariants

- Blueprint index 0 is always a dummy `{0}` entry; the raffle starts at index 1.
- `blueprintQualifies` prevents BP_ADOPT_ITEM and BP_VESTIBULE blueprints from appearing in the random raffle unless those flags are explicitly required.
- `buildAMachine` has a hard outer retry limit of 10; `addMachines` wraps each call in up to 50 tries.
- Features must meet their `minimumInstanceCount`; failure triggers a full retry (copyMap restore + `abortItemsAndMonsters`).
- `MF_ALTERNATIVE` / `MF_ALTERNATIVE_2` selections are made once per machine attempt (before the feature loop), not per-feature.
- Dormant monsters are placed at generation time via `toggleMonsterDormancy`; they live on the `dormantMonsters` list and only move to `monsters` when `DFF_ACTIVATE_DORMANT_MONSTER` fires.
- `frequency = 0` blueprints are never entered in the raffle and can only be spawned by autogenerators.

## Modification Notes

- The `blueprintCatalog` pointer is variant-specific; code must never assume a fixed table.
- `buildAMachine` allocates a large `machineData` struct on the heap (`malloc`); always `free(p)` on all exit paths.
- `copyMap` + `abortItemsAndMonsters` is the rollback mechanism; any new spawning paths inside the feature loop must register spawned items/monsters in `spawnedItems[]`/`spawnedMonsters[]` for rollback.
- `spawnDungeonFeature` is called at both generation-time and runtime; `refreshCell` controls whether visual updates happen — always `false` during level generation.
- `expandMachineInterior` modifies `pmap` in place (converts granite to wall, removes doors); this is permanent even if the machine is later rolled back.
- The `analyzeMap(true)` call at the top of `addMachines` is required before any `BP_ROOM` machine can be placed; it populates the chokeMap used for room-size selection.

## Machine Triggers

> Source files: `src/brogue/Time.c`, `src/brogue/Movement.c`, `src/brogue/Items.c`, `src/brogue/Architect.c`

### Key-pickup → machine-effect call chain

The primary runtime trigger for machine effects is the player (or a monster) arriving at a tile that has the terrain mechanic flag `TM_PROMOTES_WITH_KEY` (`Rogue.h:1961`). The system checks whether a qualifying key is present on that tile and, if so, fires the tile's promotion DF.

```
playerTurnEnded()                              Time.c:~2390–2565
  └── applyInstantTileEffectsToCreature(&player)   Time.c:2399, 2421
        └── if TM_PROMOTES_WITH_KEY && keyOnTileAt(loc)   Time.c:452
              └── useKeyAt(theItem, x, y)             Movement.c:407
                    └── promoteTile(x, y, layer, false)   Movement.c:427 / Time.c:1101
                          └── spawnDungeonFeature(x, y, feat, refresh, ...)   Time.c:1121
```

`applyInstantTileEffectsToCreature` is also called from `fillSpawnMap` (`Architect.c:3256`), monster movement (`setMonsterLocation` / `monstersTurn`), and other combat paths, so the same key-check fires whenever any creature lands on a keyed tile — not just the player.

### `keyOnTileAt` (`Items.c:3331–3355`)

Checks three sources in order for a matching key at the given location:
1. Player's pack — calls `keyInPackFor(loc)` if `HAS_PLAYER` flag is set and `posEq(player.loc, loc)`.
2. Item on the floor — calls `itemAtLoc(loc)` then `keyMatchesLocation(theItem, loc)` if `HAS_ITEM` flag set.
3. Monster's carried item — checks `monst->carriedItem` via `monsterAtLoc(loc)` if `HAS_MONSTER` set.

Returns the matching `item*` if found, or `NULL`. Callers:

| Caller | File | Line | Purpose |
|--------|------|------|---------|
| `applyInstantTileEffectsToCreature` | `Time.c` | 452 | Key-trigger on creature step |
| `updateEnvironment` | `Time.c` | 1492 | Per-turn scan for missing-key reversal |
| `checkForMissingKeys` | `Items.c` | 4313 | Post-blink/movement anti-exploit check |

### `useKeyAt` (`Movement.c:407–460`)

Called when a key-activated tile is triggered. It:
1. Iterates terrain layers; for any layer with `TM_PROMOTES_WITH_KEY`, calls `promoteTile(x, y, layer, false)`.
2. Checks whether the key has `disposableHere` set for this location or machine number.
3. If disposable: removes the item from the pack, floor, or monster; calls `deleteItem`.

`promoteTile` (`Time.c:1101`) then:
- Optionally clears the tile if `TM_VANISHES_UPON_PROMOTION`.
- Calls `spawnDungeonFeature(x, y, &dungeonFeatureCatalog[DFType], true, false)` if the tile has a `promoteType` DF.
- If the tile has `TM_IS_WIRED` and no circuit breaker, calls `activateMachine(machineNumber)` (`Time.c:1032`).

### `updateEnvironment` (`Time.c:1412–1520`)

Called every turn from `playerTurnEnded` (`Time.c:2419`) and on level start from `startLevel` (`RogueMain.c:796`). Its key-related work (at `Time.c:1492–1498`):

- Scans all `(i, j)` cells.
- If a cell has `TM_PROMOTES_WITHOUT_KEY` AND `keyOnTileAt` returns `NULL`, calls `promoteTile` on that layer.

This implements the reverse: **tiles that hold open while a key is present collapse/reset when the key is removed** (e.g., a door that only stays open while a skeleton key is on the altar). This is how altars and cages that require a key to stay deactivated work.

### `activateMachine` (`Time.c:1032–1085`)

When a wired tile promotes, `promoteTile` calls `activateMachine(machineNumber)`. This function:
1. Scans every tile with `IS_IN_MACHINE` and matching `machineNumber` that has `TM_IS_WIRED` and is not yet `IS_POWERED`.
2. For each such tile, sets `IS_POWERED` and calls `promoteTile` on every wired terrain layer — propagating activation through the machine's wired network.
3. Gathers all monsters in that machine with `MONST_GETS_TURN_ON_ACTIVATION` and grants each an immediate turn via `monstersTurn`.
4. Clears all `IS_POWERED` flags at the end.

### DF activation flow (`spawnDungeonFeature`, `Architect.c:3359–3498`)

When `promoteTile` fires a dungeon feature (`DFType`), `spawnDungeonFeature` handles the following DF flags relevant to machine effects:

| Flag | Bit | Effect |
|------|-----|--------|
| `DFF_ACTIVATE_DORMANT_MONSTER` | `Fl(4)` | Iterates `dormantMonsters`; calls `toggleMonsterDormancy` for every dormant monster whose tile is in the spawn `blockingMap` (see Dormant Monster Mechanics below) |
| `DFF_EVACUATE_CREATURES_FIRST` | — | Moves creatures off blocking tiles before writing terrain |
| `DFF_AGGRAVATES_MONSTERS` | — | Calls `aggravateMonsters` |
| `DFF_SUBSEQ_EVERYWHERE` | — | Recursively calls `spawnDungeonFeature` for `feat->subsequentDF` on every cell of the spawn map |

The `blockingMap` passed to `DFF_ACTIVATE_DORMANT_MONSTER` is the propagation map computed by `spawnMapDF`; dormant monsters anywhere within the spawned area are awakened.

### Other activation triggers

Besides key pickup, machines can be triggered by:

| Trigger | Mechanic | Where |
|---------|----------|-------|
| **Player/creature steps on tile** | `TM_PROMOTES_ON_PLAYER_ENTRY` or `TM_PROMOTES_ON_CREATURE` in `applyInstantTileEffectsToCreature` | `Time.c:257–254` |
| **Pressure plate** | `T_IS_DF_TRAP` — depressed by any non-levitating creature; fires `fireType` DF + `promoteTile` | `Time.c:216–240` |
| **Time-based tile promotion** | `promoteChance > 0` in `tileCatalog`; `updateEnvironment` rolls per-cell each turn and calls `promoteTile` | `Time.c:1441–1481` |
| **Fire/electricity** | `exposeTileToFire` / `exposeTileToElectricity` call `promoteTile` with fire DF or electricity flag | `Time.c:1158`, `Time.c:1142` |
| **Key-missing reversal** | `TM_PROMOTES_WITHOUT_KEY` + absent key each turn in `updateEnvironment` | `Time.c:1492` |
| **Anti-exploit check** | `checkForMissingKeys` called from `playerMoves` (`Movement.c:1210`) and `zap` (`Items.c:4893`) | `Items.c:4313` |

## Dormant Monster Mechanics

> Source files: `src/brogue/Monsters.c`, `src/brogue/Architect.c`, `src/variants/GlobalsBrogue.c`, `src/brogue/Rogue.h`

### Relevant flags

**On `machineFeature` (`Rogue.h:2604`):**

| Flag | Bit | Meaning |
|------|-----|---------|
| `MF_MONSTERS_DORMANT` | `Fl(19)` | Monsters placed by this feature are immediately made dormant after spawning |

**On `dungeonFeature` flags (`Rogue.h:1815`):**

| Flag | Bit | Meaning |
|------|-----|---------|
| `DFF_ACTIVATE_DORMANT_MONSTER` | `Fl(4)` | When this DF fires, dormant monsters whose tile is in the spawn map are awakened |

**On creature `bookkeepingFlags` (`Rogue.h:2163`):**

| Flag | Bit | Meaning |
|------|-----|---------|
| `MB_IS_DORMANT` | `Fl(21)` | Monster is on the `dormantMonsters` list; excluded from normal turn processing |

**On cell flags (`Rogue.h:1085`):**

| Flag | Bit | Meaning |
|------|-----|---------|
| `HAS_DORMANT_MONSTER` | `Fl(4)` | Cell has a dormant monster (used for map persistence / save-restore) |

### Dormant placement call chain (`buildAMachine`)

During level generation, after a monster horde or single monster is spawned for a feature with `MF_MONSTERS_DORMANT`, `buildAMachine` calls `toggleMonsterDormancy` immediately:

```
buildAMachine()                              Architect.c:984
  └── (feature loop, per instance)
        ├── spawnHorde(...)                  — generates horde, monsters on monsters list
        │   or generateMonster(...)
        └── if (feature->flags & MF_MONSTERS_DORMANT)   Architect.c:1655
              └── toggleMonsterDormancy(monst)           Monsters.c:4147
                    ├── removeCreature(monsters, monst)
                    ├── prependCreature(dormantMonsters, monst)
                    ├── pmap[loc].flags &= ~HAS_MONSTER
                    ├── pmap[loc].flags |= HAS_DORMANT_MONSTER
                    └── monst->bookkeepingFlags |= MB_IS_DORMANT
```

After making the monster dormant, `buildAMachine` also sets its `creatureState` to `MONSTER_TRACKING_SCENT` (unless it's an ally or `MF_MONSTER_SLEEPING` is set) so it is alert when awakened (`Architect.c:1657–1659`).

### Activation call chain (runtime)

When a dungeon feature fires at runtime (e.g., a statue cracks, a coffin opens), if the DF record has `DFF_ACTIVATE_DORMANT_MONSTER`, `spawnDungeonFeature` iterates the `dormantMonsters` list and awakens any monster whose tile is covered by the spawn map:

```
spawnDungeonFeature(x, y, feat, ...)         Architect.c:3359
  └── (after terrain is placed)
        └── if (feat->flags & DFF_ACTIVATE_DORMANT_MONSTER)   Architect.c:3488
              └── for each monst in dormantMonsters:
                    if monst->loc in blockingMap:
                      └── toggleMonsterDormancy(monst)        Monsters.c:4147
                            ├── removeCreature(dormantMonsters, monst)
                            ├── prependCreature(monsters, monst)
                            ├── pmap[loc].flags &= ~HAS_DORMANT_MONSTER
                            ├── pmap[loc].flags |= HAS_MONSTER
                            ├── monst->ticksUntilTurn = 200   (delay before first turn)
                            ├── monst->bookkeepingFlags &= ~MB_IS_DORMANT
                            └── fadeInMonster(monst)
```

If the awakened monster's tile is occupied (`HAS_MONSTER | HAS_PLAYER`), `toggleMonsterDormancy` calls `getQualifyingPathLocNear` to find a nearby free tile before placing the monster (`Monsters.c:4160–4171`).

If the monster has `MB_MARKED_FOR_SACRIFICE` (sacrifice altar machines), it is also made telepathically revealed and drops its carried item on activation (`Monsters.c:4174–4178`).

### `dormantMonsters` list

`dormantMonsters` is a global linked list of `creature` structs (same type as `monsters`). Dormant monsters receive no turns, do not block passability for pathfinding, and are invisible to the player. The `HAS_DORMANT_MONSTER` cell flag is included in `PERMANENT_TILE_FLAGS` (`Rogue.h:1115`), so it is saved and restored on level transitions.

### Which machines use dormant monsters

All three variant catalogs (`GlobalsBrogue.c`, `GlobalsRapidBrogue.c`, `GlobalsBulletBrogue.c`) share the same dormant-monster blueprints:

| Blueprint / machine | Monster type | Dormant terrain | Notes |
|---------------------|--------------|-----------------|-------|
| **Vampire lord cage** (key-guard) | `MK_VAMPIRE` | `COFFIN_CLOSED` | Vampire holds skeleton key; `MF_MONSTER_TAKE_ITEM | MF_SKELETON_KEY | MF_KEY_DISPOSABLE`; `GlobalsBrogue.c:258` |
| **Legendary ally shrine** | Horde (`HORDE_MACHINE_LEGENDARY_ALLY`) | `PORTAL` | Ally dormant at portal; `GlobalsBrogue.c:263` |
| **Warden of Yendor room** | `MK_WARDEN_OF_YENDOR` | `STATUE_INSTACRACK` | `GlobalsBrogue.c:293` |
| **Doorway guardian** (vestibule alt.) | Horde (`HORDE_MACHINE_STATUE`) | `STATUE_DORMANT_DOORWAY` | `MF_BUILD_AT_ORIGIN | MF_ALTERNATIVE`; `GlobalsBrogue.c:320` |
| **Rat trap room** (key-guard) | `MK_RAT` | `RAT_TRAP_WALL_DORMANT` | 10–20 rats in walls; `GlobalsBrogue.c:368` |
| **Statue garden / guardian** | Horde (`HORDE_MACHINE_STATUE`) | `STATUE_DORMANT` | 3–5 statues; `GlobalsBrogue.c:463` |
| **Sacrifice altar** | Horde (`HORDE_SACRIFICE_TARGET`) | `STATUE_INSTACRACK` | `MF_BUILD_ANYWHERE_ON_LEVEL`; `GlobalsBrogue.c:494` |
| **Worm den** | `MK_UNDERWORM` | `WALL_MONSTER_DORMANT` | 5–8 underworms in walls; `GlobalsBrogue.c:508` |
| **Mud pit** | Horde (`HORDE_MACHINE_MUD`) | `DF_MUD_DORMANT` | `GlobalsBrogue.c:513` |
| **Gauntlet / turret trap rooms** | `MK_SPARK_TURRET` / horde (`HORDE_MACHINE_TURRET`) | `TURRET_LEVER` / `TURRET_DORMANT` | Multiple key-guard variants; `GlobalsBrogue.c:520, 548, 594, 599` |
| **Zombie coffin room** (key-guard) | `MK_ZOMBIE` | `COFFIN_CLOSED` | 6–8 coffins; `GlobalsBrogue.c:530` |
| **Phantom shadow room** | `MK_PHANTOM` | `DARK_FLOOR_DORMANT` | `GlobalsBrogue.c:535` |
| **Mirrored totem vestibule alts** | Horde (`HORDE_MACHINE_STATUE`) + `MK_UNDERWORM` | `STATUE_DORMANT` / `WALL_MONSTER_DORMANT` | `GlobalsBrogue.c:610–615` |

The `TURRET_LEVER` terrain tile (used in the spark-turret gauntlet) has `TM_IS_WIRED` set, so activating the lever sends power through the machine, promoting all `TURRET_DORMANT` tiles and firing `DFF_ACTIVATE_DORMANT_MONSTER` to wake the turrets simultaneously.

## TS Verification

> Method: CodeQL callee queries on `brogue-c` database + direct read of TS function bodies.
> All six functions verified at `rogue-ts/src/architect/machines.ts`.

### `buildAMachine` (TS line 1192)

**Status: PARTIAL**

Key C callees present in TS:
- `blueprintQualifies` — present
- `analyzeMap` — present (via ctx)
- `addTileToMachineInteriorAndIterate` — present
- `fillInteriorForVestibuleMachine` — present
- `randomMatchingLocation` — present
- `calculateDistances` — present (via ctx)
- `copyMap` — present (rollback)
- `prepareInteriorWithMachineFlags` — present
- `cellIsFeatureCandidate` — present
- `spawnDungeonFeature` — present
- `generateItem`, `placeItemAt` — present (via ctx.itemOps)
- `spawnHorde`, `generateMonster` — present (via ctx.monsterOps)
- `toggleMonsterDormancy` — present (via ctx.monsterOps); called for `MF_MONSTERS_DORMANT`
- `abortItemsAndMonsters` — present; called on feature failure
- `addLocationToKey`, `addMachineNumberToKey` — present
- `levelIsDisconnectedWithBlockingMap` — present
- `buildAMachine` (recursive) — present for MF_OUTSOURCE_ITEM_TO_MACHINE and MF_BUILD_VESTIBULE
- Retry limit of 10 — present (`failsafe = 10`)

Key divergences:
- C uses `removeItemFromChain` (linked-list removal); TS uses `removeItemFromArray` — different data structure, same semantic
- C iterates `monsters` list with `iterateCreatures`/`hasNextCreature`/`nextCreature`; TS uses `ctx.monsterOps.iterateMachineMonsters()` — wrapped equivalent
- **No `evacuateCreatures` call** — C does not call `evacuateCreatures` directly from `buildAMachine`; it is called inside `spawnDungeonFeature` (see below). Absence here is correct.
- C calls `pmapAt(foundationLoc)` accessor; TS accesses `ctx.pmap[x][y]` directly — equivalent
- C has debug-only calls (`dumpLevelToScreen`, `hiliteCharGrid`, `temporaryMessage`) — correctly absent from TS

Missing C calls not present in TS:
- None at the `buildAMachine` level itself — gaps are inside `spawnDungeonFeature` (see below)

### `addMachines` (TS line 1886)

**Status: PARTIAL**

Key C callees present in TS:
- `analyzeMap(true)` — present (first call)
- `buildAMachine` with `MT_AMULET_AREA` — present, 50-try loop
- `buildAMachine` with `BP_REWARD` — present, 50-try outer loop
- `rand_percent` — present (bonus machine loop)
- Reward-room suppression formula — present and matches C exactly

Key divergences:
- **Bullet Brogue variant check absent**: C calls `buildAMachine(MT_REWARD_HEAVY_OR_RUNIC_WEAPON, ...)` when `gameVariant == VARIANT_BULLET_BROGUE && depthLevel == 1`. TS has no variant-gating logic at this point. This is a known gap — the TS does not implement the Bullet Brogue variant.

Missing C calls not present in TS:
- `buildAMachine(MT_REWARD_HEAVY_OR_RUNIC_WEAPON, ...)` — Bullet Brogue variant only; out of scope for Brogue variant

### `runAutogenerators` (TS line 1936)

**Status: MATCHES**

Key C callees present in TS:
- `randomMatchingLocation` — present
- `spawnDungeonFeature` — present
- `zeroOutGrid` / `allocGrid` / `freeGrid` — present
- `levelIsDisconnectedWithBlockingMap` — present (connectivity check for terrain)
- `buildAMachine` — present (for `gen->machine > 0` entries)
- `rand_percent` — present (bonus count loop)

Frequency-0 handling: C uses `while (rand_percent(gen->frequency) && count < gen->maxNumber)`. If `frequency = 0`, `rand_percent(0)` always returns false; count stays at the computed minimum (which is also 0 for flavour machines). TS uses identical logic. Flavour machines (frequency=0) can only enter via an autogenerator that has `machine > 0` set — the frequency field governs only bonus-count increments, not whether the entry runs at all. Both C and TS handle this correctly.

Key divergences:
- Debug calls (`dumpLevelToScreen`, `hiliteCell`, `temporaryMessage`) — correctly absent in TS

Missing C calls not present in TS:
- None

### `redesignInterior` (TS line 612)

**Status: MATCHES**

Key C callees present in TS:
- `allocGrid` — present
- `cellIsPassableOrDoor` — present
- `coordinatesAreInMap` — present
- `attachRooms` — present
- `dijkstraScan` — present (orphan connection path)
- `addLoops` — present
- `freeGrid` — present

Key divergences:
- C calls `copyGrid` and `findReplaceGrid` inside `D_INSPECT_MACHINES` debug block only. TS correctly omits these debug-only calls.
- C uses `brogueAssert(dir < 4)` inside orphan traversal loop; TS uses a `break` guard instead — minor divergence with no gameplay impact.

Missing C calls not present in TS:
- None (all non-debug callees present)

### `fillSpawnMap` (TS line 921)

**Status: PARTIAL**

Key C callees present in TS:
- `cellHasTerrainFlag` — present (T_OBSTRUCTS_SURFACE_EFFECTS check)
- `highestPriorityLayer` — present (blocked-by-other-layers check)
- `refreshDungeonCell` — present (via optional callback, refresh=true path)

Key divergences:
- **`staleLoopMap` not set**: C sets `rogue.staleLoopMap = true` when pathing-blocker status changes. TS has a stub comment instead of actual flag mutation. This means path-loop recalculation is not triggered after terrain changes.
- **`flavorMessage` / `tileFlavor` absent**: C calls `flavorMessage` for player tile in the refresh path. TS omits. Runtime display gap (refresh=false during generation, so no generation-time impact).
- **`applyInstantTileEffectsToCreature` absent in fillSpawnMap**: C calls this for every monster on a newly written tile (runtime path). TS omits. `applyInstantTileEffectsToCreature` is a context-level call not available in the stateless `fillSpawnMap` signature.
- **`burnItem` absent**: C calls `burnItem` for flammable items on fire tiles (runtime path). TS omits.

Missing C calls not present in TS (runtime-refresh path only):
- `flavorMessage` / `tileFlavor`
- `applyInstantTileEffectsToCreature`
- `burnItem`
- `staleLoopMap` flag mutation

Note: all missing items are inside the `refresh=true` branch. During level generation, `refresh=false` is always passed, so these gaps have no impact on generation. They become relevant for runtime terrain-change spawning (e.g., fire spreading).

### `spawnDungeonFeature` (TS line 980)

**Status: DIVERGES**

Key C callees present in TS:
- `spawnMapDF` — present
- `levelIsDisconnectedWithBlockingMap` — present
- `fillSpawnMap` — present
- `spawnDungeonFeature` (recursive, for `subsequentDF`) — present
- `DFF_CLEAR_LOWER_PRIORITY_TERRAIN` / `DFF_CLEAR_OTHER_TERRAIN` clearing loop — present
- `DFF_BLOCKED_BY_OTHER_LAYERS`, `DFF_SUPERPRIORITY` flags — present
- `DFF_SUBSEQ_EVERYWHERE` — present (recursive per-cell spawning)
- `onFeatureApplied` hook — present (TS extension; not in C)

Key divergences and missing C calls:

| Missing C call | C location | TS status | Impact |
|----------------|-----------|-----------|--------|
| `resurrectAlly` / `DFF_RESURRECT_ALLY` | line 3366 | **ABSENT** | Ally resurrection DF fires blind |
| `message` (description message) | line 3372 | **ABSENT** | No in-game description shown when feature fires |
| `refreshDungeonCell` (pre-spawn) | line 3388 | **ABSENT** | No visual update before terrain placed |
| `evacuateCreatures` (tile path) | line 3400 | **ABSENT — confirmed gap** | Creatures not moved off blocking tiles before terrain writes |
| `evacuateCreatures` (no-tile path) | line 3419 | **ABSENT — confirmed gap** | Same gap for no-tile DFs |
| `aggravateMonsters` / `DFF_AGGRAVATES_MONSTERS` | line 3444 | **ABSENT** | Monsters not alerted on feature fire |
| `colorFlash` / `DFF_FLASH_COLOR` | line 3447 | **ABSENT** | No color flash effect |
| `createFlare` | line 3450 | **ABSENT** | No flare effect |
| `applyInstantTileEffectsToCreature` | line 3458 | **ABSENT** | No fire/auto-descent check on feature fire |
| `DFF_ACTIVATE_DORMANT_MONSTER` + `toggleMonsterDormancy` | line 3489–3493 | **ABSENT — confirmed gap** | Dormant monsters never wake when DF fires |

`promoteTile` is not called from `spawnDungeonFeature` in C either — it is called by `useKeyAt` and `updateEnvironment`, not from here. Its absence in TS `spawnDungeonFeature` is correct.

The `onFeatureApplied` hook in TS provides an extension point that callers can use to implement some of these effects (e.g., dormant monster activation), but as of this verification no caller wires `DFF_ACTIVATE_DORMANT_MONSTER` logic through it.

## Known TS Gaps

Confirmed gaps from Task 6 verification, plus previously known gaps:

| Gap | Affected function(s) | Severity | Notes |
|-----|---------------------|----------|-------|
| `evacuateCreatures` entirely absent | `spawnDungeonFeature` (both terrain and no-tile paths) | **High** | Blocking terrain can spawn into occupied cells; confirmed MISSING |
| `DFF_ACTIVATE_DORMANT_MONSTER` not handled | `spawnDungeonFeature` | **High** | Dormant monsters never wake when a DF fires on their tile; all dormant-monster machines broken at runtime |
| `DFF_RESURRECT_ALLY` not handled | `spawnDungeonFeature` | **High** | Legendary ally shrine machine non-functional |
| `aggravateMonsters` / `DFF_AGGRAVATES_MONSTERS` absent | `spawnDungeonFeature` | Medium | Monsters not alerted when e.g. a shrine fires |
| `staleLoopMap` not set in `fillSpawnMap` | `fillSpawnMap` | Medium | Loop-map stale after terrain changes; pathfinding may use outdated loop data |
| `applyInstantTileEffectsToCreature` absent in `fillSpawnMap` | `fillSpawnMap` | Medium | Creatures on newly spawned fire/descent tiles not immediately affected |
| `burnItem` absent in `fillSpawnMap` | `fillSpawnMap` | Low | Flammable items on fire tiles not consumed |
| `flavorMessage` absent in `fillSpawnMap` | `fillSpawnMap` | Low | No flavor text when player's tile changes terrain |
| `colorFlash` / `createFlare` absent | `spawnDungeonFeature` | Low | Visual effects not shown when DFs fire |
| `message` (description) absent | `spawnDungeonFeature` | Low | No in-game text description of feature activation |
| Bullet Brogue variant check absent | `addMachines` | N/A | Bullet Brogue not a current target variant |

All gaps in `fillSpawnMap` and most in `spawnDungeonFeature` are in the `refresh=true` (runtime) path. They have no effect during level generation (`refresh=false`). Gaps `evacuateCreatures` and `DFF_ACTIVATE_DORMANT_MONSTER` affect runtime machine interaction and are the highest-priority fixes.
