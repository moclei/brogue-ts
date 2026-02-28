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
  - [x] Items.c (8,040 lines) — item generation, inventory, naming, usage, bolt geometry, ItemOps bridge (interactive scroll/potion/wand handlers deferred to UI phase)
  - [x] Monsters.c (4,826 lines) — monster AI, spawning, behavior (214 tests across 7 modules)
  - [x] Combat.c (1,784 lines) — attack resolution, runic effects, damage helpers (207 tests across 5 modules)
  - [x] Movement.c (2,487 lines) — player/monster movement, travel/explore, weapon attacks, ally management, cost maps, item helpers (153 tests across 7 modules)
  - [x] Time.c (2,640 lines) — turn processing, environment updates, safety maps, vision, misc helpers (223 tests across 5 modules)
  - [x] Recordings.c (1,519 lines) — recording buffer, event codec, save/load, init (134 tests across 4 modules; playback UI deferred to Phase 3)

## Phase 3: UI & Platform
- [ ] `port-phase-3-ui-platform` — Umbrella initiative for UI, menus, game loop, and platform (~8,700 lines across 5 C files)
  - [x] Step 1: IO Core — color manipulation (52 tests), display buffers (21 tests), cell appearance (19 tests), text rendering (33 tests) = 125 new tests
  - [ ] Step 2: IO Game UI — messages, sidebar, inventory, targeting, input dispatch, visual effects
    - [x] 2a: Message system — io-messages.ts (64 tests: archive ring buffer, fold/format, display, combat text)
    - [x] 2b: Sidebar — io-sidebar.ts (72 tests: refreshSideBar, entity info panels, progress bars, entity collection/sorting)
    - [x] 2d: Targeting & cursor — io-targeting.ts (38 tests: path following, hilite, snap map, cursor show/hide)
    - [x] 2f: Visual effects — io-effects.ts (35 tests: flashes, fades, alerts, blend, monster flashes)
  - [ ] Step 3: Menus & Wizard — buttons, title screen, main menu, debug mode
    - [x] 3a: Button system — io-buttons.ts (44 tests: init, draw, state, input processing, input loop)
  - [ ] Step 4: Game Loop — initializeRogue, startLevel, gameOver, victory, cleanup (RogueMain.c)
  - [ ] Step 5: Platform — BrogueConsole interface, Canvas2D browser renderer, null platform
  - [ ] Step 6: Wire-up — deferred Phase 2 stubs, interactive handlers, playable browser build

## Phase 4: Integration
- [ ] `port-integration` — Full game loop, seed catalog regression tests, Node.js terminal platform
