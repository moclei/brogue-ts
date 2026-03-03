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
- [x] Keyboard navigation works (up/down arrows, enter) — wired in Step 3c
- [x] "New Game" button triggers game initialization flow — wired in Step 3a

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
- [ ] Wire `refreshDungeonCell` → display system — deferred to `wire-gameplay-systems`
- [x] Wire `updateScentMap` — real implementation wired (FOV + addScentToCell + scentDistance)
- [ ] Wire full `updateEnvironment` — deferred to `wire-gameplay-systems`
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
- [x] Wire sidebar `refreshSideBar` with full entity collection — done in `wire-gameplay-systems` Phase 5
- [x] Wire `displayInventory` with full button-based UI — done in `wire-gameplay-systems` Phase 5
- [x] Zero compilation errors, all 2232 tests pass, Vite build succeeds

### 3g: Playtest-driven fixes
> Bugs found during manual playtesting that reveal integration issues in the
> existing wiring. Root causes are primarily: (1) DI contexts that value-copy
> primitive `rogue` state instead of sharing the real object, so mutations are
> lost; (2) simplified stand-in implementations that omit critical behavior
> paths; (3) missing `promptForItemOfType` flow preventing item action commands.

#### Bug 1 — Stairs broken (player teleports to start of same level + overspawning) ✅
- [x] **Root cause:** `buildTravelExploreContext()` copies `rogue.depthLevel` by value (line ~3191). When `useStairs()` increments `ctx.rogue.depthLevel`, the real `rogue.depthLevel` is unchanged. `startLevel()` then reads the stale real value and regenerates the current level instead of generating the next one.
- [x] **Fix:** Pass real `rogue` object by reference in `buildTravelExploreContext()` instead of spreading primitive fields into a new object. TypeScript structural typing accepts the wider `RuntimeRogueState` for the narrower context interface.
- [x] **Audit:** Systematically audited all 18 `rogue: {` constructions across 34 `buildXContext()` functions. Found and fixed 4 additional contexts with the same value-copy-on-mutation-path pattern:
  - `buildPlayerMoveContext()` — `playerMoves()` mutates `rogue.disturbed` in 10+ places
  - `buildMiscHelpersContext()` — `autoRest()`/`manualSearch()` mutate `disturbed`, `automationActive`, `justRested`, `justSearched`
  - `buildCreatureEffectsContext()` — `creature-effects.ts` mutates `inWater`, `monsterSpawnFuse`, `disturbed`, `deepestLevel`, `flareCount` (also fixed incorrect `deepestLevel: gameConst.deepestLevel` → now uses real `rogue.deepestLevel`)
  - `buildEnvironmentContext()` — `updateEnvironment()` mutates `staleLoopMap`
  - Remaining value-copy contexts (cost maps, describe location, item helpers, search, scent) are read-only for rogue fields — safe as-is.
- [x] Verified: compile clean (0 errors), all 2263 tests passing

#### Bug 2 — Monsters walk on water / no terrain avoidance ✅
- [x] **Root cause:** Simplified `monstersTurn` (line ~5720) only checks `T_OBSTRUCTS_PASSABILITY` for movement, but water is passable — the real AI calls `monsterAvoids()` which checks water/lava/trap flags.
- [x] **Fix:** Add `monsterAvoidsWrapped(monst, {x: nx, y: ny})` check to all three movement paths in simplified `monstersTurn` (scent-following, direct-approach, wandering).

#### Bug 3 — Player doesn't take damage from monster attacks ✅
- [x] **Root cause:** Simplified `monstersTurn` (line ~5737) has an empty branch `else if (dist <= 1) { // Adjacent to player — just tick (combat is stubbed) }`. Monsters walk up to the player but never call `attack()`.
- [x] **Fix:** When adjacent and tracking/hunting, call `attackFn(monst, player, false, buildAttackContext())`.

#### Bug 4 — Item actions show "Inventory display not yet available"
- [ ] **Root cause:** `equip(null)`, `unequip(null)`, `drop(null)` (lines ~6199-6221) short-circuit because `promptForItemOfType()` is not wired. The keyboard handlers call these with `null` (meaning "prompt the user to pick an item"), but without the prompt they can't proceed.
- [ ] **Fix:** Implement `promptForItemOfType()` — calls `displayInventory()` with the appropriate category filter and returns the selected item. Then update `equip`/`unequip`/`drop`/`apply`/`throw`/`relabel`/`call` to use it.

#### Bug 5 — Mouse hover doesn't show path or inspect terrain/monsters
- [ ] **Root cause:** `mainInputLoop` (line ~6781) only handles `Keystroke` and `MouseUp`/`RightMouseUp` events. It doesn't track `MouseEnteredCell` for hover-based sidebar updates or path preview. In the original C game, `moveCursor` is called continuously during the main loop to process mouse movement.
- [ ] **Fix:** Handle `MouseEnteredCell` events in the main input loop to update sidebar, flavor text, and cursor path highlighting.

#### Bug 6 — Blood doesn't appear when monsters die (cell goes dark instead of red)
- [ ] **Root cause:** Blood probability calculation in `combat-damage.ts` (line ~244) divides by 100 inside `Math.floor()`, making `startProb` always 0 for typical damage values. The C code passes the raw percentage and `spawnDungeonFeature` handles the scaling internally.
- [ ] **Fix:** Remove the `/100` from the probability calculation so blood spawns at the correct rate.

#### Bug 7 — Water effects missing for player (items don't float away, no visual change)
- [ ] **Root cause:** `applyGradualTileEffectsToCreature` (line ~1195 in creature-effects.ts) has an empty code block where the "pick random non-equipped item and drop it in water" logic should be.
- [ ] **Fix:** Implement the item-loss-in-water logic: select a random non-equipped pack item, split from stack if needed, place on the floor tile, message the player.

- [ ] Verify: compile clean (0 errors), all tests passing

## Step 4: Verification

### 4a: Seed determinism ✅
- [x] Create seed regression test harness (`tests/seed-determinism.test.ts`, 26 tests)
- [x] Lock in RNG raw output for seeds 1, 42, 12345 (inline snapshots)
- [x] Cross-validate TS RNG against C reference values (compiled `generate_reference.c`)
  - seed 12345 randRange(0,999) x20: bit-identical match ✅
  - seed 42 randRange(0,999) x20: bit-identical match ✅
  - seed 1 randRange(0,99) x20: bit-identical match ✅
  - seed 1 randRange(0,999) x20: bit-identical match ✅
  - seed 1 level seeds (lo + hi*10000) x10: bit-identical match ✅
- [x] Verify RNG determinism over 10K calls (same seed → same sequence)
- [x] Lock in carveDungeon grid hashes for 10 seed/depth combos
  - Self-consistency: same seed → same hash (10 test cases)
  - Locked-in hashes as regression guards
- [x] Lock in level seed generation for seeds 1 and 12345 (27 depths each)
- [x] Updated C reference generator (`tests/fixtures/generate_reference.c`) with level seeds
- [ ] Item/monster placement (deferred — requires full runtime; validated by recording playback)

### 4b: Recording playback
- [ ] Generate test recordings from C version
- [ ] Load `.broguerec` files in TS version
- [ ] Play back and verify no OOS errors
- [ ] Test at least 3 recordings of varying length

### 4c: Manual testing
- [x] Title screen renders correctly
- [x] New game starts, dungeon visible
- [x] Player movement works
- [ ] Combat works (attack wired, damage dealt) — player attacks work; monster attacks wired (Bug 3 fixed), needs retest
- [ ] Items work (pick up, use, equip) — pick up works; equip/apply/drop blocked on `promptForItemOfType` (Bug 4)
- [ ] Level transitions work — Bug 1 fixed; needs retest
- [ ] Monsters respect terrain — `monsterAvoids` wired (Bug 2 fixed), needs retest
- [ ] Blood/death effects render correctly — blocked on probability bug (Bug 6)
- [ ] Mouse hover shows path preview and entity info — blocked on missing hover event handling (Bug 5)
- [ ] Save/load works — deferred (needs IndexedDB backend)
- [ ] Game over → high scores → back to menu

## Step 5: Terminal Platform

- [ ] Implement `NodeTerminalConsole` implementing `BrogueConsole`
- [ ] `plotChar` via ANSI 24-bit color escape codes + cursor positioning
- [ ] `nextKeyOrMouseEvent` via raw stdin reader
- [ ] `pauseForMilliseconds` via `setTimeout`
- [ ] CLI entry point (`bin/brogue-ts`)
- [ ] Verify game plays in terminal
