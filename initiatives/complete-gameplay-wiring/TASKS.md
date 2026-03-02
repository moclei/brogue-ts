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

## Phase 2: Combat & Monster Completeness ⬜
> *After this phase: weapon types are distinct, monsters clone/steal/teleport properly*

- [ ] **2a: handleWhipAttacks / handleSpearAttacks / abortAttack** — wire from `weapon-attacks.ts` in PlayerMoveContext via `buildWeaponAttackContext()`
- [ ] **2b: cloneMonster** — port ~60 lines from Monsters.c:559 + wire in RunicContext and CombatHelperContext (jelly splits, plenty runic, multiplicity armor)
- [ ] **2c: forceWeaponHit** — port ~30 lines from Combat.c:498 + wire in RunicContext (force weapon blink effect)
- [ ] **2d: monsterStealsFromPlayer** — port ~50 lines from Monsters.c + wire in RunicContext (monkey/thief behavior)
- [ ] **2e: teleport** — port ~80 lines from Monsters.c:1146 + wire in CreatureEffectsContext (pixies, teleport scrolls, bolts)
- [ ] Verify: compile clean, tests passing, manual test: whip/spear attacks, jelly splitting

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
