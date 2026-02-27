# TypeScript Port — Tasks

This is the master task list for the full TypeScript port of BrogueCE. Each task corresponds to a child initiative that is created when work on that phase/module begins. Update this file whenever a child initiative's status changes.

## Phase 0: Foundation
- [x] `port-phase-0-foundation` — Project scaffolding, type system (Rogue.h), RNG + fixed-point math (Math.c), validation harness

## Phase 1: Data Layer
- [x] `port-phase-1-data-layer` — Static catalogs (Globals.c, GlobalsBase.c), power tables, grid operations

## Phase 2: Core Systems
- [ ] `port-core-dijkstra` — Pathfinding (Dijkstra.c, 259 lines)
- [ ] `port-core-light` — Lighting, FOV, flares (Light.c, 412 lines)
- [ ] `port-core-combat` — Attack resolution, bolts, damage (Combat.c, 1,784 lines)
- [ ] `port-core-movement` — Player/monster movement, pathfinding (Movement.c, 2,487 lines)
- [ ] `port-core-items` — Item generation, identification, usage (Items.c, 8,040 lines)
- [ ] `port-core-monsters` — Monster AI, spawning, behavior (Monsters.c, 4,826 lines)
- [ ] `port-core-architect` — Dungeon generation, machines (Architect.c, 3,837 lines)
- [ ] `port-core-time` — Turn processing, environment updates (Time.c, 2,640 lines)
- [ ] `port-core-recordings` — Game recording and playback (Recordings.c, 1,519 lines)

## Phase 3: UI & Platform
- [ ] `port-ui-io` — In-game UI: messages, sidebar, inventory, targeting (IO.c, 5,128 lines)
- [ ] `port-ui-menus` — Buttons, MainMenu, Wizard (Buttons.c + MainMenu.c + Wizard.c, 2,176 lines)
- [ ] `port-platform-browser` — Canvas2D renderer for the 100x34 grid
- [ ] `port-game-loop` — Game initialization, save/load, game loop (RogueMain.c, 1,414 lines)

## Phase 4: Integration
- [ ] `port-integration` — Full game loop, seed catalog regression tests, Node.js terminal platform
