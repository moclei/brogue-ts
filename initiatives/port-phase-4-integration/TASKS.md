# Phase 4: Integration — Tasks

## Step 1: Compile Clean (51 errors → 0) ✅

### 1a: Add missing flag constants ✅
- [x] Import standalone `T_DIVIDES_LEVEL`, `T_RESPIRATION_IMMUNITIES`, `T_PATHING_BLOCKER` in consumer files
- [x] Add `xpxpThisTurn` to creature effects context interface

### 1b: Fix barrel export issues ✅
- [x] Resolve `blendAppearances` name collision (standalone in io-color, context version renamed to `blendAppearancesCtx` in io-effects)
- [x] Fix `recordings/index.ts` — remove non-existent exports; rename `RecordingInitContext` → `InitRecordingContext`
- [x] Fix `time/index.ts` — remove non-existent `handleHealthAlerts`, `flashCreatureAlert` exports

### 1c: Fix type mismatches ✅
- [x] Fix `io/io-screens.ts` — `{x,y}` → `{windowX, windowY}` for `WindowPos`
- [x] Fix `io/io-screens.ts` — `colorDance` → `colorDances` typo
- [x] Fix `io/io-inventory.ts` — `String.fromCharCode(string)` → use string directly
- [x] Fix `items/item-generation.ts` — `?? 0` → `?? (0 as DisplayGlyph)`
- [x] Fix `monsters/monster-actions.ts` — cast to avoid impossible narrowing

### 1d: Remove unused imports (32 errors) ✅
- [x] Cleaned unused imports across io, items, menus, recordings, time modules

### 1e: Verify ✅
- [x] `npx tsc --noEmit` produces zero errors
- [x] All 2232 tests pass (64 test files)

## Step 2: Build & Launch ✅

### 2a: Bundler setup ✅
- [x] Add Vite as dev dependency
- [x] Create `vite.config.ts` pointing at `index.html`
- [x] Add `npm run dev` script to `package.json`
- [x] Verify `npm run dev` serves the page and loads `bootstrap.ts`

### 2b: Async boundary ✅
- [x] Audit call chain from `mainBrogueJunction` → `titleMenu` → `pauseBrogue`/`nextKeyOrMouseEvent`
- [x] Make `mainBrogueJunction`, `titleMenu`, and the flame animation loop async
- [x] Introduce `AsyncBrogueConsole` interface with `waitForEvent(): Promise<RogueEvent>`
- [x] Update all DI context method signatures that wrap async platform calls
- [x] Fix `overlayDisplayBuffer` to apply blended results back to display buffer
- [x] Update all Vitest mocks and test callbacks for async/await
- [x] Verify title screen renders with animated flames in browser

### 2c: Title screen validation ✅
- [x] Flame animation plays smoothly (continuous)
- [x] Menu buttons render and are visible
- [x] Title ASCII art renders fully ("BROGUE")
- [x] Version string visible
- [ ] Keyboard navigation works (up/down arrows, enter) — deferred to Step 3
- [ ] "New Game" button triggers game initialization flow — deferred to Step 3

## Step 3: Runtime Wiring

### 3a: Menu → Game Init ✅
- [x] Expand `createRogueState()` to `RuntimeRogueState` (superset of `MenuRogueState` + `GameInitRogueState` + `CleanupRogueState` + `InitRecordingRogue`)
- [x] Create shared game data structures (player creature, monster/item lists, safety grids, display grids, dynamic colors, message state, recording buffer)
- [x] Wire `GameInitContext` with all real catalog data (monsterCatalog, lightCatalog, meteredItemsGenerationTable, scrollTable, potionTable, dungeonFeatureCatalog)
- [x] Wire `initializeRogue(seed)` → calls real `initializeRogueFn` with full context
- [x] Wire `initializeGameVariant()` → calls real `initializeGameVariantFn` (dispatches to Brogue/Rapid/Bullet variant init)
- [x] Wire `freeEverything()` → calls real `freeEverythingFn` with `CleanupContext`
- [x] Wire equipment operations (`equipItem`, `recalculateEquipmentBonuses`, `identify`) for starting gear
- [x] Wire item generation (`generateItem`, `addItemToPack`) with proper `ItemGenContext` and `ItemRNG`
- [x] Wire creature operations (`initializeGender`, `initializeStatus`, `createCreature`)
- [x] Wire recording init (`initRecording` via `RecordingBuffer` + no-op `RecordingFileIO`)
- [x] Wire `shuffleFlavors`, `resetDFMessageEligibility`, `deleteMessages`, `clearMessageArchive`
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

### 3b: Level generation + display ✅
- [x] Allocate `pmap` + `tmap` grids in `runtime.ts` (column-major DCOLS×DROWS)
- [x] Add missing `RuntimeRogueState` fields (`lastTarget`, `upLoc`, `downLoc`, `staleLoopMap`, `rewardRoomsGenerated`)
- [x] Create shared helper functions (`cellHasTerrainFlagAt`, `getFOVMaskWrapped`, `calculateDistancesWrapped`, `pathingDistanceWrapped`, `populateGenericCostMapWrapped`, `analyzeMapWrapped`)
- [x] Implement `getCellAppearance` (terrain layers, lighting, player glyph) in `runtime.ts`
- [x] Implement `displayLevel` (iterate DCOLS×DROWS → `plotCharWithColor` to display buffer)
- [x] Implement `shuffleTerrainColors` (fill `terrainRandomValues` from RNG)
- [x] Implement simplified `updateVision` (FOV → mark VISIBLE/DISCOVERED flags)
- [x] Build `ArchitectContext` (bundles `MachineContext`, `BuildBridgeContext`, catalogs, helpers)
- [x] Build `LevelContext` (all 40+ methods — digDungeon, placeStairs, initializeLevel, setUpWaypoints, vision, display, simplified stubs for items/monsters/sidebar)
- [x] Wire `startLevel` in `menuCtx` → calls real `startLevelFn` with full `LevelContext`
- [x] Make `mainInputLoop` async (`Promise<void>`) for browser event waiting
- [x] Implement minimal async input loop (wait for events, 'q'/Escape to quit)
- [x] Update `MenuContext.mainInputLoop` signature to `Promise<void>`
- [x] Add `await` at both call sites in `mainBrogueJunction`
- [ ] Wire `refreshDungeonCell` → display system (deferred to 3f)
- [ ] Wire full `updateScentMap`, `updateEnvironment` (deferred to 3d)
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

### 3c: Input → Game actions ✅
- [x] Build `buildInputContext()` function in `runtime.ts` wiring ~150 dependencies
- [x] Wire `mainInputLoop` with full `InputContext` (replaced minimal q/Escape stub)
- [x] Wire movement handlers (`playerMoves`, `playerRuns`) via `PlayerMoveContext` + `PlayerRunContext`
- [x] Wire stair usage (`useStairs`) via `TravelExploreContext`
- [x] Wire inventory actions (equip, unequip, drop, apply, throw, relabel, call, swap)
- [x] Wire exploration (`travel`, `travelRoute`, `exploreKey`, `autoPlayLevel`) via `TravelExploreContext`
- [x] Wire rest/search (`autoRest`, `manualSearch`) via `MiscHelpersContext`
- [x] Wire targeting/cursor stubs (`moveCursor`, `nextTargetAfter`) — full implementation deferred
- [x] Wire screen displays (`displayMessageArchive`, `printHelpScreen`, `displayFeatsScreen`, `printDiscoveriesScreen`)
- [x] Wire visual effects (`flashTemporaryAlert`, `displayMonsterFlashes`)
- [x] Make `executeKeystroke`, `executeMouseClick`, `executeEvent`, `confirm`, `actionMenu` async for browser compatibility
- [x] Update `InputContext` interface: `buttonInputLoop` and `printTextBox` return `number | Promise<number>`
- [x] Update all 11 affected tests to use async/await
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

### 3d: Turn processing ✅
- [x] Build `buildTurnProcessingContext()` function in `runtime.ts` implementing full `TurnProcessingContext` interface
- [x] Wire `playerTurnEnded` → real `playerTurnEndedFn` from `time/turn-processing.ts` via `doPlayerTurnEnded()`
- [x] Replace all 3 `playerTurnEnded` stubs (in `levelCtx`, `miscCtx`, `inputCtx`) with `doPlayerTurnEnded()` calls
- [x] Wire monster AI actions (stub — `monstersTurn` ticks movement speed; full AI deferred to 3f)
- [x] Wire environment updates (stub — `updateEnvironment` no-op; full environment deferred to 3f)
- [x] Wire status effect ticking (stub — `decrementPlayerStatus`, `decrementMonsterStatus` no-ops; full effects deferred to 3f)
- [x] Wire scent/FOV updates (`getFOVMask` via `FOVContext`, `discoverCell`/`discover` via pmap flags)
- [x] Wire `removeDeadMonsters` (inline filter on `MB_IS_DYING` bookkeeping flag)
- [x] Wire `resetDFMessageEligibility` via existing `architect.ts` function
- [x] Fix `TurnProcessingContext.getFOVMask`/`zeroOutGrid` types: `boolean[][]` → `number[][]` to match real `fov.ts`
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

### 3e: Game lifecycle ✅
- [x] Build `buildLifecycleContext()` function in `runtime.ts` implementing full `LifecycleContext` interface
- [x] Wire `gameOver` → real `gameOverFn` from `game-lifecycle.ts` via `doGameOver()`
- [x] Wire `victory` → real `victoryFn` via `doVictory()` (treasure tally, achievements, recording save)
- [x] Wire `enableEasyMode` → real `enableEasyModeFn` with `LifecycleContext`
- [x] Replace both `gameOver` stubs (in `buildTurnProcessingContext`, `buildInputContext`) with `doGameOver()` calls
- [x] Wire display primitives (printString, plotCharToBuffer, clearDisplayBuffer, blackOutScreen)
- [x] Stub message/dialog/recording functions (to be completed in 3f)
- [x] Wire save/load game flow (stub — save/load deferred to full recording wiring)
- [x] Wire `freeEverything` → full cleanup + return to menu (done in 3a)
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

### 3f: Remaining DI stubs ✅
- [x] Wire variant-specific catalog switching in runtime (done in 3a — sets gameConst counts from catalog sizes)
- [x] Enhanced `getCellAppearance` with items, monsters, fog-of-war, unexplored cells
  - Visible cells show player > monsters > items > terrain (priority order)
  - Discovered-but-not-visible cells render at 40% brightness (fog of war)
  - Unexplored cells render as black
  - Monsters filtered by MB_IS_DYING flag
- [ ] Wire sidebar `refreshSideBar` with full entity collection (deferred — functional without sidebar)
- [ ] Wire `displayInventory` with full button-based UI (deferred — basic inventory via input dispatch)
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

## Step 4: Verification

### 4a: Seed determinism
- [ ] Create seed regression test harness
- [ ] Verify RNG output matches C for 10K calls after seeding
- [ ] Verify dungeon grid matches C for 10+ seeds
- [ ] Verify item placement matches C
- [ ] Verify monster placement matches C

### 4b: Recording playback
- [ ] Generate test recordings from C version
- [ ] Load `.broguerec` files in TS version
- [ ] Play back and verify no OOS errors
- [ ] Test at least 3 recordings of varying length

### 4c: Manual testing
- [ ] Title screen renders correctly
- [ ] New game starts, dungeon visible
- [ ] Player movement works
- [ ] Combat works
- [ ] Items work (pick up, use, equip)
- [ ] Level transitions work
- [ ] Save/load works
- [ ] Game over → high scores → back to menu

## Step 5: Terminal Platform

- [ ] Implement `NodeTerminalConsole` implementing `BrogueConsole`
- [ ] `plotChar` via ANSI 24-bit color escape codes + cursor positioning
- [ ] `nextKeyOrMouseEvent` via raw stdin reader
- [ ] `pauseForMilliseconds` via `setTimeout`
- [ ] CLI entry point (`bin/brogue-ts`)
- [ ] Verify game plays in terminal
