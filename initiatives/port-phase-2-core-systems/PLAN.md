# Phase 2: Core Systems — Plan

## Dependency Graph

The 9 modules have significant cross-dependencies. The porting order is designed to minimize forward references:

```
Layer 0 (no game-logic deps):
  Dijkstra.c  — pure algorithm, only needs grid + constants

Layer 1 (minimal deps):
  Light.c     — needs grid, colors, creatures (read-only)
  Architect.c — needs grid, dijkstra, catalogs, RNG

Layer 2 (moderate deps):
  Items.c     — needs catalogs, RNG, grid, dijkstra, power tables
  Monsters.c  — needs catalogs, RNG, grid, dijkstra, items
  Combat.c    — needs items, monsters, movement, power tables
  Movement.c  — needs dijkstra, combat, items, monsters

Layer 3 (depends on everything):
  Time.c      — orchestrates all systems per turn
  Recordings.c — event capture/replay, depends on game loop
```

## Game State Architecture

The C codebase uses extensive global mutable state. In TypeScript we'll introduce a `GameState` container:

```typescript
interface GameState {
  // Map grids
  tmap: Tcell[][];        // terrain cell grid
  pmap: Pcell[][];        // player cell grid (flags, visibility)
  scentMap: Grid;
  safetyMap: Grid;
  allySafetyMap: Grid;
  chokeMap: Grid;

  // Entities
  player: Creature;
  rogue: PlayerCharacter;
  monsters: CreatureList;
  dormantMonsters: CreatureList;
  floorItems: Item[];
  packItems: Item[];

  // Level data
  levels: LevelData[];
  depth: number;

  // RNG state (already implemented)
  rng: RNGState;
}
```

Functions that currently access globals will instead receive `GameState` (or relevant slices) as a parameter. This enables:
- Unit testing with mock state
- Multiple game instances
- Clear data flow

## Module Plans

### 1. Dijkstra (259 lines) — `ts/src/dijkstra/`

**Approach:** Port directly. The core `dijkstraScan` function is pure (takes grids, returns grids). The `calculateDistances` function needs game state helpers.

Split into:
- `dijkstra.ts` — `dijkstraScan`, `pathingDistance` (pure pathfinding)
- Game-state-dependent helpers (`calculateDistances`) will accept callbacks for `cellHasTerrainFlag`, `monsterAtLoc`, etc.

**Internal types:** `PdsLink`, `PdsMap` (private to module)

### 2. Light (412 lines) — `ts/src/light/`

**Approach:** Port lighting calculations, FOV mask generation, and flare animation logic.

- `light.ts` — `paintLight`, `updateLighting`, `getFOVMask`, `backUpLighting`, `restoreLighting`
- `flares.ts` — `createFlare`, `animateFlares`, `deleteAllFlares`

### 3. Architect (3,837 lines) — `ts/src/architect/`

**Approach:** This is the key validation target (same seed → same dungeon). Consider splitting into sub-modules:
- `rooms.ts` — room generation and attachment
- `machines.ts` — machine placement (blueprints)
- `architect.ts` — top-level `digDungeon`, level generation orchestration

### 4. Items (8,040 lines) — `ts/src/items/`

**Approach:** Largest file. Split into sub-modules:
- `item-generation.ts` — `makeItemInto`, `generateItems`, `populateItems`
- `item-identification.ts` — identify, auto-identify, naming
- `item-usage.ts` — apply, throw, drop, equip, unequip
- `item-tables.ts` — deferred item tables from Phase 1

### 5. Monsters (4,826 lines) — `ts/src/monsters/`

**Approach:** Split into:
- `monster-spawning.ts` — `spawnHorde`, `populateMonsters`
- `monster-ai.ts` — decision-making, targeting, pathfinding
- `monster-actions.ts` — abilities, summoning, special behavior

### 6. Combat (1,784 lines) — `ts/src/combat/`

**Approach:** Attack resolution is relatively contained.
- `combat.ts` — `attack`, `buildHitList`, `attackHit`, runic effects
- `bolts.ts` — bolt mechanics (may be here or in its own module)

### 7. Movement (2,487 lines) — `ts/src/movement/`

**Approach:**
- `movement.ts` — `moveCreature`, `playerMoves`, travel system
- `scent.ts` — scent trail management

### 8. Time (2,640 lines) — `ts/src/time/`

**Approach:** Turn processing orchestration.
- `time.ts` — `playerTurnEnded`, `processCreatureTurn`, status ticking
- `environment.ts` — tile effects, gas/fire spread, water flow

### 9. Recordings (1,519 lines) — `ts/src/recordings/`

**Approach:** Event capture and replay.
- `recordings.ts` — recording/playback state machine, file I/O abstraction

## Shared Helpers

Several helper functions are used across all modules but currently live in various C files. These need a home:

- `cellHasTerrainFlag(pos, flags)` — check terrain flags at a position
- `cellHasTMFlag(pos, flags)` — check terrain mechanic flags
- `monsterAtLoc(pos)` — find creature at position
- `monsterAvoids(creature, pos)` — check if creature avoids position
- `discoveredTerrainFlagsAtLoc(pos)` — get discovered terrain flags
- `applyInstantTileEffectsToCreature(creature)` — apply tile effects

These will go in `ts/src/state/` or `ts/src/helpers/` and accept `GameState` as a parameter.

## Testing Strategy

- **Dijkstra:** Unit test with hand-crafted cost maps, verify shortest paths
- **Architect:** Seed-based regression — generate dungeons with known seeds, compare tile layouts
- **Light:** Test FOV masks against known configurations
- **Combat/Items/Monsters:** Test individual functions with mock game state
- **Integration:** Full turn sequences with known seeds (Phase 4)

## Recommended Porting Sequence

1. Game state types + shared helpers (foundation for everything)
2. Dijkstra (pure algorithm, immediate value)
3. Light (relatively isolated)
4. Architect (key validation target, uses dijkstra + grid heavily)
5. Items (large but needed by combat/monsters)
6. Monsters (depends on items)
7. Combat (depends on items + monsters)
8. Movement (depends on combat)
9. Time (depends on everything)
10. Recordings (depends on game loop, may defer to Phase 4)
