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

### 3a: Menu → Game Init
- [ ] Wire `initializeRogue(seed)` with full `GameInitContext` (variant catalogs, RNG, player creation)
- [ ] Wire `initializeGameVariant()` with catalog switching per variant
- [ ] Wire `welcome()` to display opening messages

### 3b: Level generation + display
- [ ] Wire `startLevel(depth, stairDirection)` with full `LevelContext`
- [ ] Wire `digDungeon` → architect module
- [ ] Wire `displayLevel` → full cell appearance pipeline (getCellAppearance → plotCharWithColor)
- [ ] Wire `refreshDungeonCell` → display system
- [ ] Wire `updateVision`, `updateScentMap`, `updateEnvironment`

### 3c: Input → Game actions
- [ ] Wire `mainInputLoop` with full `InputContext`
- [ ] Wire movement handlers (`playerMoves`, `playerRuns`)
- [ ] Wire stair usage (`useStairs`)
- [ ] Wire inventory actions (equip, unequip, drop, apply, throw)
- [ ] Wire exploration (`travel`, `travelRoute`, `exploreKey`, `autoPlayLevel`)
- [ ] Wire rest/search (`autoRest`, `manualSearch`)

### 3d: Turn processing
- [ ] Wire `playerTurnEnded` → full turn processing pipeline
- [ ] Wire monster AI actions
- [ ] Wire environment updates (gas, fire, terrain promotion)
- [ ] Wire status effect ticking

### 3e: Game lifecycle
- [ ] Wire `gameOver` with score display, recording save
- [ ] Wire `victory` with treasure tally, achievement check
- [ ] Wire save/load game flow
- [ ] Wire `freeEverything` → full cleanup + return to menu

### 3f: Remaining DI stubs
- [ ] Wire variant-specific catalog switching in runtime
- [ ] Wire sidebar `refreshSideBar` with full entity collection
- [ ] Wire `displayInventory` with full button-based UI
- [ ] Wire `getCellAppearance` with terrain layers, items, monsters, lighting, memory

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
