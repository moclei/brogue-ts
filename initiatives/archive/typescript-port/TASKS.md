# TypeScript Port — Tasks

This is the master task list for the full TypeScript port of BrogueCE. Each task corresponds to a child initiative that is created when work on that phase/module begins. Update this file whenever a child initiative's status changes.

## Phase 0: Foundation
- [x] `port-phase-0-foundation` — Project scaffolding, type system (Rogue.h), RNG + fixed-point math (Math.c), validation harness

## Phase 1: Data Layer
- [x] `port-phase-1-data-layer` — Static catalogs (Globals.c, GlobalsBase.c), power tables, grid operations

## Phase 2: Core Systems
- [x] `port-phase-2-core-systems` — Umbrella initiative for all core game logic (~27K lines across 9 modules)
  - [x] Game state foundation + shared helpers
  - [x] Dijkstra.c (259 lines) — pathfinding
  - [x] Light.c (412 lines) — lighting, FOV, flares
  - [x] Architect.c (3,837 lines) — dungeon generation, machines
  - [x] Items.c (8,040 lines) — item generation, inventory, naming, usage, bolt geometry, ItemOps bridge
  - [x] Monsters.c (4,826 lines) — monster AI, spawning, behavior (214 tests)
  - [x] Combat.c (1,784 lines) — attack resolution, runic effects, damage helpers (207 tests)
  - [x] Movement.c (2,487 lines) — player/monster movement, travel/explore, weapon attacks (153 tests)
  - [x] Time.c (2,640 lines) — turn processing, environment updates, safety maps, vision (223 tests)
  - [x] Recordings.c (1,519 lines) — recording buffer, event codec, save/load, init (134 tests)

## Phase 3: UI & Platform
- [x] `port-phase-3-ui-platform` — Umbrella initiative for UI, menus, game loop, and platform (~8,700 lines across 5 C files)
  - [x] Step 1: IO Core — color, display buffers, cell appearance, text rendering (125 tests)
  - [x] Step 2: IO Game UI — messages, sidebar, inventory, targeting, input dispatch, visual effects, info screens
  - [x] Step 3: Menus & Wizard — buttons, title screen, main menu, debug mode
  - [x] Step 4: Game Loop — initializeRogue, startLevel, gameOver, victory, cleanup
  - [x] Step 5: Platform — BrogueConsole interface, Canvas2D browser renderer, null platform
  - [x] Step 6: Wire-up — deferred Phase 2 stubs, interactive handlers, playable browser build

## Phase 4: Integration
- [x] `port-phase-4-integration` — Compile clean, build tooling, runtime DI wiring, seed regression, first playtest fixes
  - [x] Step 1: Compile Clean — fix 51 pre-existing TS errors
  - [x] Step 2: Build & Launch — Vite bundler, async boundary, title screen in browser
  - [x] Step 3: Runtime Wiring — DI stubs filled, full game loop connected (3a–3f), 12 playtest bugs fixed (3g)
  - [x] Step 4: Verification — seed determinism (26 tests, bit-identical with C), basic manual testing

## Phase 5: Gameplay Wiring
- [x] `port-phase-5-gameplay-wiring` — Wire ~160+ runtime stubs to real implementations + port ~7 missing functions for full playability
  - [x] Phases 1–6: Messages, item interaction, monster lifecycle, combat effects, UI panels, polish (~148 stubs)
  - [x] Phases 7–9: Core playability (monsterAvoids, startLevel, eat, moveCursor), combat/monster completeness (cloneMonster, teleport, forceWeaponHit), world simulation (spawnPeriodicHorde, safetyMaps, clairvoyance, floorItems)

## Phase 6: Stabilization
- [ ] `port-phase-6-stabilization` — Iterative playtesting and bug fixing until feature-complete playable quality
  - [ ] Playtest Round 1 — (pending)

## Future
- [ ] Recording playback verification (`.broguerec` files from C version)
- [ ] Save/load via IndexedDB or localStorage backend
- [ ] Node.js terminal platform (ANSI renderer, CLI entry point)
- [ ] Main menu flame animation performance optimization
- [ ] Debug/wizard-mode displays
