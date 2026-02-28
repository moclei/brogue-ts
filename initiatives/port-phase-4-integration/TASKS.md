# Phase 4: Integration — Tasks

## Step 1: Compile Clean (51 errors → 0)

### 1a: Add missing flag constants
- [ ] Add `T_DIVIDES_LEVEL` to `TerrainFlag` in `types/flags.ts` (used by `time/misc-helpers.ts`)
- [ ] Add `T_RESPIRATION_IMMUNITIES` composite flag to `types/flags.ts` (used by `time/creature-effects.ts`)
- [ ] Add `T_PATHING_BLOCKER` composite flag to `types/flags.ts` (used by `time/creature-effects.ts`)
- [ ] Add `xpxpThisTurn` to creature effects context interface (used by `time/creature-effects.ts`)

### 1b: Fix barrel export issues
- [ ] Fix `io/index.ts` — resolve `blendAppearances` name collision between io-effects and io-appearance
- [ ] Fix `recordings/index.ts` — remove non-existent `playbackPanic`, `RecordingEventsContext` exports; rename `RecordingInitContext` → `InitRecordingContext`
- [ ] Fix `time/index.ts` — remove non-existent `handleHealthAlerts`, `flashCreatureAlert` exports

### 1c: Fix type mismatches
- [ ] Fix `io/io-screens.ts` — `WindowPos` object literals use `{x,y}` instead of correct field names
- [ ] Fix `io/io-screens.ts` — `colorDance` → `colorDances` typo
- [ ] Fix `io/io-inventory.ts` — `string` where `number` expected (line 444)
- [ ] Fix `items/item-generation.ts` — `DisplayGlyph` enum vs `0` literal
- [ ] Fix `monsters/monster-actions.ts` — impossible `CreatureState` comparison

### 1d: Remove unused imports (32 errors)
- [ ] Clean unused imports across io, items, menus, recordings, time modules

### 1e: Verify
- [ ] `npx tsc --noEmit` produces zero errors
- [ ] All existing tests still pass

## Step 2: Build & Launch

### 2a: Bundler setup
- [ ] Add Vite as dev dependency
- [ ] Create `vite.config.ts` pointing at `index.html`
- [ ] Add `npm run dev` script to `package.json`
- [ ] Verify `npm run dev` serves the page and loads `bootstrap.js`

### 2b: Async boundary
- [ ] Audit call chain from `mainBrogueJunction` → `titleMenu` → `pauseBrogue`/`nextKeyOrMouseEvent`
- [ ] Make `mainBrogueJunction`, `titleMenu`, and the flame animation loop async
- [ ] Make `mainInputLoop`, `pauseBrogue`, `waitForAcknowledgment`, `nextBrogueEvent` async
- [ ] Update all DI context method signatures that wrap async platform calls
- [ ] Verify title screen renders with animated flames in browser

### 2c: Title screen validation
- [ ] Flame animation plays smoothly
- [ ] Menu buttons render and highlight on hover
- [ ] Keyboard navigation works (up/down arrows, enter)
- [ ] "New Game" button triggers game initialization flow

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
