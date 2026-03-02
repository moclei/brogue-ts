# Complete Gameplay Wiring — Tasks

## Phase 1: Core Playability ⬜
> *After this phase: stairs work, monsters respect terrain, food works, mouse hover shows paths*

- [ ] **1a: monsterAvoids** — wire `monsterAvoidsFn` from `monster-state.ts` + `buildMonsterStateContext()` across 8 DI contexts (CostMapFovContext ×2, MonsterMovementContext, MonsterOpsContext, SpawnContext, MiscHelpersContext, TurnProcessingContext, PlayerMoveContext)
- [ ] **1b: startLevel** — wire `startLevel(depth, stairDirection)` from `game-level.ts` in CreatureEffectsContext via `buildLevelContext()`
- [ ] **1c: eat** — wire `eat()` from `item-handlers.ts` in CreatureEffectsContext via `buildItemHandlerContext()`
- [ ] **1d: recalculateEquipmentBonuses** — wire from `item-usage.ts` in 2 contexts via `EquipmentState`
- [ ] **1e: updatePlayerRegenerationDelay** — port ~15 lines from Items.c:7903 + wire in CreatureEffectsContext and item handler contexts
- [ ] **1f: moveCursor** — port ~150 lines from Items.c:5372 + wire in InputContext (mouse hover, path preview, cursor targeting, sidebar highlight)
- [ ] Verify: compile clean (0 errors), 2263/2263 tests passing, manual test: stairs + food + mouse hover

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
