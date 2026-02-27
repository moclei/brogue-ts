# Phase 2: Core Systems — Brief

## Intent
Port the 9 core game logic modules from BrogueCE's C source (`src/brogue/`) into TypeScript, building on the foundation (Phase 0) and data layer (Phase 1).

## Goals
- Faithfully port all game logic functions from C to TypeScript
- Maintain determinism: same seed must produce identical behavior
- Establish a game state management pattern (replacing C's global mutable state)
- Enable unit testing of individual systems in isolation via dependency injection
- Prepare the codebase for Phase 3 (UI & Platform) integration

## Scope

### In Scope
- 9 C source files totaling ~27K lines:
  1. Dijkstra.c (259 lines) — pathfinding
  2. Light.c (412 lines) — lighting, FOV, flares
  3. Combat.c (1,784 lines) — attack resolution, bolts, damage
  4. Movement.c (2,487 lines) — player/monster movement
  5. Items.c (8,040 lines) — item generation, identification, usage
  6. Monsters.c (4,826 lines) — monster AI, spawning, behavior
  7. Architect.c (3,837 lines) — dungeon generation, machines
  8. Time.c (2,640 lines) — turn processing, environment updates
  9. Recordings.c (1,519 lines) — game recording and playback
- Game state container to replace C globals (`rogue`, `player`, `pmap`, `tmap`, etc.)
- Helper functions currently spread across files (`cellHasTerrainFlag`, `monsterAtLoc`, etc.)
- Item tables deferred from Phase 1 (key, food, weapon, armor, staff, ring)

### Out of Scope
- UI rendering and input handling (Phase 3)
- Platform-specific code (Phase 3)
- Full game loop orchestration (Phase 3/4)
- Browser renderer (Phase 3)

## Constraints
- This is a hybrid initiative: tracked here as an umbrella, but larger modules (Items, Monsters, Architect, Time) may spawn sub-initiatives if needed
- Port order follows dependency graph — simpler/smaller modules first
- Functions requiring game state should accept it via parameter injection, not global access
- All ported functions must have unit tests
- TypeScript strict mode throughout
