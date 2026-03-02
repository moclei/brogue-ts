# Complete Gameplay Wiring — Tasks

## Phase 1: Core Playability ✅
> *After this phase: stairs work, monsters respect terrain, food works, mouse hover shows paths*

- [x] **1a: monsterAvoids** — wired `monsterAvoidsFn` from `monster-state.ts` across 8 DI contexts with `monsterAvoidsWrapped` helper + `burnedTerrainFlagsAtLoc` / `successorTerrainFlags` helpers
- [x] **1b: startLevel** — wired `startLevel(depth, stairDirection)` via `buildLevelContext()` in CreatureEffectsContext
- [x] **1c: eat** — wired `eat()` from `item-handlers.ts` in CreatureEffectsContext with inline `ItemHandlerContext` wrapper
- [x] **1d: recalculateEquipmentBonuses** — wired from `item-usage.ts` in 2 contexts via `EquipmentState` + sync-back pattern
- [x] **1e: updatePlayerRegenerationDelay** — ported from Items.c:7903 using `turnsForFullRegenInThousandths` + wired in EquipContext
- [x] **1f: moveCursor** — ported ~150 lines from Items.c:5372, full cursor movement, mouse/keyboard handling, sidebar highlight, coordinate clamping; button overlay deferred
- [x] Verify: compile clean (0 errors), 2263/2263 tests passing

## Phase 2: Combat & Monster Completeness ✅
> *After this phase: weapon types are distinct, monsters clone/steal/teleport properly*

- [x] **2a: handleWhipAttacks / handleSpearAttacks / abortAttack** — wired from `weapon-attacks.ts` in PlayerMoveContext via `buildWeaponAttackContext()` + `buildFlailHitList`
- [x] **2b: cloneMonster** — ported ~120 lines from Monsters.c:559 as `cloneMonsterImpl`: deep copy, bookkeeping flags, leadership chain, placement, jellymancer feat; wired in RunicContext + CombatHelperContext
- [x] **2c: forceWeaponHit** — ported ~90 lines from Combat.c:498 as `forceWeaponHitImpl`: simulated blinking bolt push, impact damage, collateral damage, moralAttack + splitMonster; wired in RunicContext. Also added `messageColorFromVictimImpl` helper.
- [x] **2d: monsterStealsFromPlayer** — ported ~60 lines from Combat.c:426 as `monsterStealsFromPlayerImpl`: random non-equipped item selection, partial stack splitting, flee behavior; wired in RunicContext
- [x] **2e: teleport** — ported ~80 lines from Monsters.c:1146 as `teleportImpl`: FOV-masked grid search, distance filtering, terrain avoidance, disentangle; wired in CreatureEffectsContext
- [x] Verify: compile clean (0 errors), 2263/2263 tests passing

## Phase 3: World Simulation ⬜
> *After this phase: reinforcement spawning, AI retreat, clairvoyance, floor item decay all work*

- [ ] **3a: spawnPeriodicHorde** — wire from `monster-spawning.ts` in CreatureEffectsContext via `buildSpawnContext()`
- [ ] **3b: updateSafetyMap** — wire from `safety-maps.ts` via `buildSafetyMapsContext()`
- [ ] **3c: updateClairvoyance** — wire from `safety-maps.ts` in TurnProcessingContext
- [ ] **3d: updateFloorItems** — port ~50 lines from Items.c:1192 + wire in TurnProcessingContext (floor item decay, fire damage)
- [ ] **3e: assureCosmeticRNG / restoreRNG** — implement RNG stream switching (~10 lines) + wire in 3 contexts (CostMapFovContext ×2, CreatureEffectsContext)
- [ ] Verify: compile clean, tests passing, manual test: periodic spawns, clairvoyance ring

## Intentionally Deferred

The following stubs are not addressed in this initiative:

- `saveGame()` / `loadSavedGame()` / `saveRecording()` / `saveRecordingNoPrompt()` — need IndexedDB/localStorage backend (separate initiative)
- `restoreMonster()` — only needed for save/load
- `displayGrid()` / `displayLoops()` / `displayChokeMap()` / `displayMachines()` / `displayWaypoints()` — debug/wizard display (cosmetic)
- `dialogCreateItemOrMonster()` — wizard mode creation dialog
- `RNGCheck()` / `displayAnnotation()` / `executeEvent()` / `pausePlayback()` — recording playback system
- `notifyEvent()` / `saveRunHistory()` / `saveResetRun()` — event notification / run history
- Main menu flame animation performance — separate optimization initiative
