# Port Parity Audit — Tasks

## Phase 1: Classify

- [x] Run fresh analysis: `cd tools/analysis && npx tsx scan-stubs.ts && npx tsx port-health.ts`
- [x] For each of the 220 unique stub names, determine if a real (non-stub) implementation
      exists anywhere in the TS codebase. Method: for each name, grep for non-trivial
      assignments (not `() => {}` / `() => false` / `() => 0` / `() => null`). Record
      results in `.context/analysis/stub-classification.json` with categories:
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

- [ ] Port remaining medium-effort needs-porting functions.
      Monsters: `dormantMonsterAtLoc` (2 callers), `findAlternativeHomeFor` (1 caller).
      UI: `initializeButtonState` (3 callers — `buttonInputLoop`, `initializeMenu`,
      `initializeMenuButtons`).
      Debug: `dialogCreateItemOrMonster` (1 caller — `executeKeystroke`).
      Unknown (resolve via C source review): `playerHasRespirationArmor`,
      `setPureMageFeatFailed`, `setDragonslayerFeatAchieved`, `armorRunicIdentified`,
      `clearLastTarget`, `clearYendorWarden`, `clearCellMonsterFlag`.
      Read C source for each, implement, wire. Run tests. Commit.

- [ ] Re-run analysis pipeline after all 2a porting is complete.
      Update `PORT_HEALTH.md`. Commit progress summary.

# --- sub-phase 2a complete ---

### sub-phase 2b: wire builders (was Phase 2)

Each task is one context builder. Skip recording/persistence stubs within each builder.
All needs-porting functions from sub-phase 2a must exist before starting this sub-phase.

- [ ] Wire `buildApplyInstantTileEffectsFn` (tile-effects-wiring.ts) — 44 stubs.
      Check file length; split if approaching 600 lines.
- [ ] Wire `buildTurnProcessingContext` (turn.ts) — 34 stubs
- [ ] Wire `buildInputContext` (io/input-context.ts) — 33 stubs
- [ ] Wire `buildMonsterZapFn` (turn-monster-zap-wiring.ts) — 28 stubs
- [ ] Wire `buildThrowCommandFn` (items/item-commands.ts) — 27 stubs
- [ ] Wire `buildStaffZapFn` (items/staff-wiring.ts) — 27 stubs
- [ ] Re-run analysis pipeline. Update `PORT_HEALTH.md`. Commit progress summary.

# --- handoff point ---

## Phase 3: Wire remaining builders

- [ ] Wire `buildCombatAttackContext` (combat.ts) — 23 stubs
- [ ] Wire `buildMiscHelpersContext` — 23 stubs
- [ ] Wire `buildMonstersTurnContext` — 22 stubs
- [ ] Wire `buildLifecycleContext` (lifecycle.ts) — 20 stubs
- [ ] Wire `buildMenuContext` (menus.ts) — 17 stubs
- [ ] Wire `buildZapRenderContext` — 16 stubs
- [ ] Wire `buildLevelContext` — 14 stubs
- [ ] Wire `buildUpdateVisionFn` — 12 stubs
- [ ] Wire `buildItemHandlerContext` — 10 stubs
- [ ] Wire all remaining builders with <10 stubs each (batch by file)
- [ ] Re-run analysis pipeline. Update `PORT_HEALTH.md`. Commit progress summary.

# --- handoff point ---

## Phase 4: Drift investigation

- [ ] Review the `needs-porting` list from Phase 1. For each function that was
      identified as needing a new implementation: port from C source, wire into
      all relevant contexts, add tests.
- [ ] Scan for simplified implementations: search for comments like `// simplified`,
      `// TODO`, `// stub`, `// placeholder` across `rogue-ts/src/`. Cross-reference
      with C source to check if the simplification affects gameplay.
- [ ] For the most critical game systems (combat, monster AI, items, turn processing),
      spot-check 3-5 complex functions against their C equivalents to verify behavioral
      parity. Document any discrepancies found.

# --- handoff point ---

## Phase 5: Verify and close

- [ ] Re-run full analysis pipeline. Critical stub count should be near zero
      (only recording/persistence and documented gaps remaining).
- [ ] Run full test suite: `npx vitest run` — all passing, no new skips.
- [ ] Playtest: complete game on a known seed. Note any behavioral anomalies.
- [ ] Update `docs/BACKLOG.md` with final port status and any remaining gaps.
- [ ] Update `.context/analysis/PORT_HEALTH.md` as the final health snapshot.

## Deferred

_(out-of-scope discoveries go here)_
