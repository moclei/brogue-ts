# Phase 2: Core Systems — Tasks

## Step 0: Game State Foundation
- [x] Define `GameState` interface and sub-interfaces (`MapState`, `EntityState`, etc.) — `ts/src/state/game-state.ts`
- [x] Port shared helper functions (`terrainFlags`, `terrainMechFlags`, `cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType`, `discoveredTerrainFlagsAtLoc`) — `ts/src/state/helpers.ts`
- [ ] Port deferred item tables from Phase 1 (key, food, weapon, armor, staff, ring)

## Step 1: Dijkstra (259 lines)
- [x] Port `PdsLink`, `PdsMap` internal types
- [x] Port pure functions: `pdsUpdate`, `pdsClear`, `pdsSetDistance`, `pdsBatchInput`, `pdsBatchOutput`
- [x] Port `dijkstraScan` (pure grid-based pathfinding)
- [x] Port `calculateDistances` (with game state injection via `CalculateDistancesContext`)
- [x] Port `pathingDistance`
- [x] Tests for dijkstra module — 22 tests passing

## Step 2: Light (412 lines)
- [ ] Port `paintLight`, `updateLighting`
- [ ] Port `getFOVMask`
- [ ] Port `backUpLighting`, `restoreLighting`
- [ ] Port flare system (`createFlare`, `animateFlares`, `deleteAllFlares`)
- [ ] Tests for light module

## Step 3: Architect (3,837 lines)
- [ ] Port room generation functions
- [ ] Port room attachment and corridor logic
- [ ] Port machine/blueprint placement
- [ ] Port `digDungeon` orchestration
- [ ] Seed-based regression tests (same seed → same dungeon layout)

## Step 4: Items (8,040 lines)
- [ ] Port item generation (`makeItemInto`, `generateItems`, `populateItems`)
- [ ] Port item identification and naming
- [ ] Port item usage (apply, throw, drop, equip, unequip)
- [ ] Port bolt mechanics
- [ ] Tests for items module

## Step 5: Monsters (4,826 lines)
- [ ] Port monster spawning (`spawnHorde`, `populateMonsters`)
- [ ] Port monster AI (decision-making, targeting)
- [ ] Port monster actions (abilities, summoning)
- [ ] Tests for monsters module

## Step 6: Combat (1,784 lines)
- [ ] Port attack resolution (`attack`, `buildHitList`, `attackHit`)
- [ ] Port runic/enchantment effects
- [ ] Tests for combat module

## Step 7: Movement (2,487 lines)
- [ ] Port creature movement (`moveCreature`, `playerMoves`)
- [ ] Port travel system
- [ ] Port scent trail management
- [ ] Tests for movement module

## Step 8: Time (2,640 lines)
- [ ] Port turn processing (`playerTurnEnded`, `processCreatureTurn`)
- [ ] Port status effect ticking
- [ ] Port environment updates (tile effects, gas/fire, water)
- [ ] Tests for time module

## Step 9: Recordings (1,519 lines)
- [ ] Port recording/playback state machine
- [ ] Port event serialization
- [ ] Tests for recordings module
