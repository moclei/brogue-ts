# Port Parity Audit — Tasks

## Phase 1: Classify

- [x] Run fresh analysis: `cd tools/analysis && npx tsx scan-stubs.ts && npx tsx port-health.ts`
- [x] For each of the 220 unique stub names, determine if a real (non-stub) implementation
      exists anywhere in the TS codebase. Method: for each name, grep for non-trivial
      assignments (not `() => {}` / `() => false` / `() => 0` / `() => null`). Record
      results in `docs/analysis/stub-classification.json` with categories:
      `wire-up`, `needs-porting`, `recording`, `intentional-gap`.
- [x] Review the `needs-porting` list against the C manifest. For each, note the C system,
      caller count, and whether it's on a critical path. Estimate effort.
- [x] Review the `intentional-gap` candidates against `docs/BACKLOG.md` "Acceptable gaps".
      Add any new gaps with justification, or reclassify as `needs-porting`.
- [x] Update `PLAN.md` with classification results and revised effort estimate.

# --- handoff point ---

## Phase 2: Wire top builders

### sub-phase 2a: port needs-porting functions

Port all high/medium needs-porting functions before touching any builder. Builders can't
reference a function that doesn't exist yet. Skip all 18 defer-tier functions
(`recordKeystrokeSequence`, `getAvailableFilePath`, `saveRecordingNoPrompt`,
`executePlaybackInput`, `saveRecording`, `displayAnnotation`, `openFile`, `saveGame`,
`characterForbiddenInFilename`, `initRecording`, `saveGameNoPrompt`, `pausePlayback`,
`cancelKeystroke`, `saveHighScore`, `saveRunHistory`, `listFiles`, `loadRunHistory`,
`saveResetRun`) — these are persistence/recording, deferred to port-v2-persistence.

- [x] Port `fillGrid` (grid system, 30 callers — blocks `freeGrid`, `initializeLevel`,
      `startLevel` and 27 other callers) and `becomeAllyWith` (movement system, 7 callers —
      called from `cloneMonster`, `freeCaptive`, `spawnHorde`, `spawnMinions`, `updateBolt`).
      Read C source for each, implement in `rogue-ts/src/`, wire into all relevant context
      builders. Run tests after each function. Commit.

- [x] Port combat system needs-porting functions: `splitMonster` (4 callers),
      `moralAttack` (4 callers), `handlePaladinFeat` (3 callers), `magicWeaponHit` (2 callers),
      `applyArmorRunicEffect` (2 callers), `specialHit` (1 caller),
      `decrementWeaponAutoIDTimer` (1 caller), `playerImmuneToMonster` (1 caller),
      `forceWeaponHit` (1 caller — called from `magicWeaponHit`).
      Read C source for each, implement in `rogue-ts/src/`, wire into all relevant context
      builders (primarily `buildCombatAttackContext`, `buildMonsterZapFn`,
      `buildThrowCommandFn`). Run tests. Commit.

- [x] Port io system needs-porting functions: `displayMoreSign` (5 callers),
      `printProgressBar` (4 callers), `hideCursor` (4 callers),
      `flashMessage` (2 callers), `funkyFade` (2 callers), `deleteMessages` (2 callers),
      `executeMouseClick` (2 callers), `getPlayerPathOnMap` (2 callers),
      `estimatedArmorValue` (1 caller), `displayMonsterFlashes` (1 caller),
      `showCursor` (1 caller), `printFloorItemDetails` (1 caller),
      `processSnapMap` (1 caller),
      `displayMoreSignWithoutWaitingForAcknowledgment` (1 caller).
      Read C source for each, implement in `rogue-ts/src/`, wire into relevant builders
      (primarily `buildInputContext`, `buildTurnProcessingContext`). Run tests. Commit.

- [x] Port items system needs-porting functions: `checkForDisenchantment` (3 callers),
      `strengthCheck` (3 callers), `itemDetails` (2 callers), `updateIdentifiableItem` (1 caller),
      `swapItemEnchants` (1 caller), `beckonMonster` (1 caller), `polymorph` (1 caller),
      `itemValue` (1 caller), `itemIsHeavyWeapon` (1 caller),
      `itemIsPositivelyEnchanted` (1 caller), `weaken` (1 caller).
      Read C source for each, implement in `rogue-ts/src/`, wire into relevant builders
      (primarily `buildApplyInstantTileEffectsFn`, `buildThrowCommandFn`,
      `buildStaffZapFn`). Run tests. Commit.

- [x] Port turn + dungeon-gen + movement + lifecycle needs-porting functions.
      Turn: `monstersFall` (3 callers), `updateSafeTerrainMap` (2 callers),
      `updateAllySafetyMap` (2 callers), `exposeTileToElectricity` (1 caller),
      `processIncrementalAutoID` (1 caller), `handleHealthAlerts` (1 caller).
      Dungeon-gen: `restoreMonster` (3 callers), `analyzeMap` (3 callers),
      `refreshWaypoint` (3 callers), `setUpWaypoints` (2 callers), `restoreItems` (2 callers),
      `updateMapToShore` (2 callers).
      Movement: `vomit` (2 callers).
      Lifecycle: `executeEvent` (5 callers).
      Read C source for each, implement in `rogue-ts/src/`, wire into relevant builders.
      Run tests. Commit.

- [x] Port remaining medium-effort needs-porting functions.
      Monsters: `dormantMonsterAtLoc` (2 callers), `findAlternativeHomeFor` (1 caller).
      UI: `initializeButtonState` (3 callers — `buttonInputLoop`, `initializeMenu`,
      `initializeMenuButtons`).
      Debug: `dialogCreateItemOrMonster` (1 caller — `executeKeystroke`).
      Unknown (resolve via C source review): `playerHasRespirationArmor`,
      `setPureMageFeatFailed`, `setDragonslayerFeatAchieved`, `armorRunicIdentified`,
      `clearLastTarget`, `clearYendorWarden`, `clearCellMonsterFlag`.
      Read C source for each, implement, wire. Run tests. Commit.

- [x] Re-run analysis pipeline after all 2a porting is complete.
      Update `PORT_HEALTH.md`. Commit progress summary.

# --- sub-phase 2a complete ---

### sub-phase 2b: wire builders (was Phase 2)

Each task is one context builder. Skip recording/persistence stubs within each builder.
All needs-porting functions from sub-phase 2a must exist before starting this sub-phase.

- [x] Wire `buildApplyInstantTileEffectsFn` (tile-effects-wiring.ts) — 44 stubs.
      Check file length; split if approaching 600 lines.
      Split: extracted buildExposeTileToFireFn/buildExposeTileToElectricityFn to tile-effects-env-wiring.ts.
      Wired: demoteMonsterFromLeadership (×2), makeMonsterDropItem (×2), updateEncumbrance (×2),
      updateVision (combatCtx), numberOfMatchingPackItems, dropItem, flavorMessage, displayLevel,
      highestPriorityLayer, tileFlavor, describeLocation, monstersFall, updateFloorItems,
      animateFlares, spawnPeriodicHorde, synchronizePlayerTimeState, recalculateEquipmentBonuses,
      playerInDarkness, randClumpedRange, pmapAt, terrainFlags, armorTable, constants.
      Remaining stubs: teleport (complex FOV ctx), startLevel (circular dep with lifecycle.ts),
      playerTurnEnded (re-entry guard), search/recordKeystroke (record-cmd path),
      assureCosmeticRNG/restoreRNG/flashMessage (cosmetic-only, safe no-ops).
- [x] Wire `buildTurnProcessingContext` (turn.ts) — 34 stubs
- [x] Wire `buildInputContext` (io/input-context.ts) — 33 stubs
- [x] Wire `buildMonsterZapFn` (turn-monster-zap-wiring.ts) — 28 stubs
- [x] Wire `buildThrowCommandFn` (items/item-commands.ts) — 27 stubs
- [x] Wire `buildStaffZapFn` (items/staff-wiring.ts) — 27 stubs
- [x] Re-run analysis pipeline. Update `PORT_HEALTH.md`. Commit progress summary.

# --- handoff point ---

## Phase 3: Wire remaining builders

- [x] Wire `buildCombatAttackContext` (combat.ts) — 23 stubs
- [x] Wire `buildMiscHelpersContext` — 23 stubs
- [x] Wire `buildMonstersTurnContext` — 22 stubs
- [x] Wire `buildLifecycleContext` (lifecycle-gameover.ts) — wired isVowelish, itemName; remaining stubs are persistence/scoring defers
- [x] Wire `buildMenuContext` (menus.ts) — 17 stubs (2 wired: setGameVariant, initializeGameVariant; 13 are persistence/recording/playback/file-ops defers; message/initializeLaunchArguments/isApplicationActive correct as no-ops)
- [x] Wire `buildZapRenderContext` — 13 stubs wired (lighting, hilite, getCellAppearance, plotCharWithColor, refreshSideBar, refreshDungeonCell, pauseAnimation); displayCombatText intentional no-op
- [x] Wire `buildLevelContext` — wired currentStealthRange, updateEnvironment, updateMonsterState, refreshSideBar, messageWithColor, hideCursor; RNGCheck+flushBufferToFile deferred (persistence); extracted to lifecycle-level.ts (600-line split)
- [x] Wire `buildUpdateVisionFn` — 12 stubs wired (monsterAvoids via buildMonsterStateContext, messageWithColor, assureCosmeticRNG/restoreRNG; dijkstraScan/freeGrid intentional no-ops in updateVision path)
- [x] Wire `buildItemHandlerContext` — temporaryMessage, printString, recalculateEquipmentBonuses, chooseNewWanderDestination, demoteMonsterFromLeadership, makeMonsterDropItem wired; permanent-defer stubs unchanged
- [x] Wire all remaining builders with <10 stubs each (batch by file)
- [x] Re-run analysis pipeline. Update `PORT_HEALTH.md`. Commit progress summary.

# --- handoff point ---

## Phase 4: Drift investigation

- [x] Review the `needs-porting` list from Phase 1. For each function that was
      identified as needing a new implementation: port from C source, wire into
      all relevant contexts, add tests.
- [x] Scan for simplified implementations: search for comments like `// simplified`,
      `// TODO`, `// stub`, `// placeholder` across `rogue-ts/src/`. Cross-reference
      with C source to check if the simplification affects gameplay.
- [x] For the most critical game systems (combat, monster AI, items, turn processing),
      spot-check 3-5 complex functions against their C equivalents to verify behavioral
      parity. Document any discrepancies found.

# --- handoff point ---

## Phase 5: Verify and close

- [x] Re-run full analysis pipeline. Critical stub count should be near zero
      (only recording/persistence and documented gaps remaining).
- [x] Run full test suite: `npx vitest run` — all passing, no new skips.
- [ ] Playtest: complete game on a known seed. Note any behavioral anomalies. **[USER ACTION REQUIRED]**
- [x] Update `docs/BACKLOG.md` with final port status and any remaining gaps.
- [x] Update `docs/analysis/PORT_HEALTH.md` as the final health snapshot.

## Deferred

_(out-of-scope discoveries go here)_
