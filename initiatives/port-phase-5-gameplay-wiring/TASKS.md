# Phase 5: Gameplay Wiring — Tasks

> This initiative unifies work originally tracked under `wire-gameplay-systems` (Phases 1–6) and `complete-gameplay-wiring` (Phases 7–9). All phases are complete.

## Phase 1: Messages (~47 stubs) ✅
- [x] Build shared `buildMessageOps()` helper in `runtime.ts`
- [x] Build `buildMessageContext()` — full MessageContext from shared runtime state
- [x] Build `buildEffectsContext()` — EffectsContext for flash functions
- [x] Wire `message()` across all 12 contexts
- [x] Wire `messageWithColor()` across all 10 contexts
- [x] Wire `combatMessage()`, `confirmMessages()`, `temporaryMessage()`, `flavorMessage()`
- [x] Wire `displayMoreSign()`, `flashTemporaryAlert()`, `flashMessage()`, `encodeMessageColor()`
- [x] Wire `deleteMessages()`, `updateMessageDisplay()`, `displayMessageArchive()`, `displayCombatText()`
- [x] Verify: 0 compilation errors, 2263/2263 tests passing

## Phase 2: Item Interaction (~20 stubs) ✅
- [x] Wire `itemName()` — real `itemNameFn` + `buildItemNamingContext()` across ~12 DI contexts
- [x] Wire `pickUpItemAt()`, `equip()`, `unequip()`, `drop()`, `useKeyAt()`, `deleteItem()`
- [x] Wire `numberOfMatchingPackItems()`, `itemAtLoc()`, `updateIdentifiableItems()`, `updateEncumbrance()`
- [x] Wire `makeMonsterDropItem()`, `checkForMissingKeys()`, `keyInPackFor()`
- [x] Build `buildItemHelperContext()` for useKeyAt and related helpers
- [x] Verify: 0 compilation errors, 2263/2263 tests passing

## Phase 3: Monster Lifecycle (~15 stubs) ✅
- [x] Wire `killCreature()` across 6 DI contexts
- [x] Wire `removeCreature()` / `prependCreature()` — inline list ops in 4 contexts
- [x] Wire `splitMonster()`, `freeCaptive()`, `fadeInMonster()`
- [x] Wire `demoteMonsterFromLeadership()` / `checkForContinuedLeadership()`
- [x] Wire `spawnDungeonFeature()` in 6 contexts, `promoteTile()` in 5 contexts
- [x] Wire `applyInstantTileEffectsToCreature()` / `applyGradualTileEffectsToCreature()`
- [x] Wire `monsterShouldFall()` / `monstersFall()` / `playerFalls()`
- [x] Wire `decrementPlayerStatus()` — upgraded from minimal stub to real function
- [x] Build `buildCreatureEffectsContext()` — full ~200-field DI context
- [x] Verify: compile clean, 2263 tests passing

## Phase 4: Combat Effects (~10 stubs) ✅
- [x] Wire `magicWeaponHit()`, `specialHit()`, `applyArmorRunicEffect()` via `buildRunicContext()`
- [x] Wire feat tracking (paladin, dragonslayer, pureMage)
- [x] Wire `decrementWeaponAutoIDTimer()`, `rechargeItemsIncrementally()`, `processIncrementalAutoID()`
- [x] Wire `equipItem()` in AttackContext, `checkForDisenchantment()`, `strengthCheck()`
- [x] Verify: compile clean, 2263/2263 tests passing

## Phase 5: UI Panels (~10 stubs) ✅
- [x] Wire `refreshSideBar()` across 8 DI contexts (3-arg and 0-arg variants)
- [x] Wire `updateFlavorText()`, `displayInventory()` (async), `displayMessageArchive()`
- [x] Wire `printHelpScreen()`, `displayFeatsScreen()`, `printDiscoveriesScreen()` via `buildScreenContext()`
- [x] Wire `printMonsterDetails()`, `printFloorItemDetails()`, `printLocationDescription()`
- [x] Verify: compile clean, 2263/2263 tests passing

## Phase 6: Polish (~15 stubs) ✅
- [x] Wire `search()` (3 contexts), `updateMinersLightRadius()` (4 contexts)
- [x] Wire `updatePlayerUnderwaterness()`, `vomit()`, `addPoison()`, `flashMonster()`
- [x] Wire `exposeTileToFire()`, `createFlare()` / `animateFlares()` + `buildLightingContext()`
- [x] Wire `recordKeystroke()` / `cancelKeystroke()` / `recordMouseClick()` (6+ contexts)
- [x] Wire `printHighScores()`, `playerInDarkness()`, `synchronizePlayerTimeState()`
- [x] Keep save/load/recording-save as stubs (need file I/O backend)
- [x] Verify: compile clean, 2263/2263 tests passing

## Phase 7: Core Playability ✅
- [x] Wire `monsterAvoids` across 8 DI contexts with `monsterAvoidsWrapped` helper
- [x] Wire `startLevel` in CreatureEffectsContext
- [x] Wire `eat` in CreatureEffectsContext
- [x] Wire `recalculateEquipmentBonuses` in 2 contexts
- [x] Port + wire `updatePlayerRegenerationDelay` from Items.c:7903
- [x] Port + wire `moveCursor` (~150 lines from Items.c:5372)
- [x] Verify: compile clean, 2263/2263 tests passing

## Phase 8: Combat & Monster Completeness ✅
- [x] Wire `handleWhipAttacks` / `handleSpearAttacks` / `abortAttack` via `buildWeaponAttackContext()`
- [x] Port + wire `cloneMonster` (~120 lines from Monsters.c:559)
- [x] Port + wire `forceWeaponHit` (~90 lines from Combat.c:498)
- [x] Port + wire `monsterStealsFromPlayer` (~60 lines from Combat.c:426)
- [x] Port + wire `teleport` (~80 lines from Monsters.c:1146)
- [x] Verify: compile clean, 2263/2263 tests passing

## Phase 9: World Simulation ✅
- [x] Port + wire `spawnPeriodicHorde` (ported `getRandomMonsterSpawnLocation` + `getTerrainGrid`)
- [x] Wire `updateSafetyMap` via `buildSafetyMapsContext()`
- [x] Wire `updateClairvoyance` via `buildSafetyMapsContext()`
- [x] Port + wire `updateFloorItems` (~75 lines from Items.c:1192)
- [x] Implement + wire `assureCosmeticRNG` / `restoreRNG` (RNG stream switching)
- [x] Verify: compile clean, 2263/2263 tests passing

## Remaining Stubs — Intentionally Deferred

The following stubs were not addressed (carried forward to future initiatives):

- `saveGame()` / `loadSavedGame()` / `saveRecording()` / `saveRecordingNoPrompt()` — need IndexedDB/localStorage backend
- `restoreMonster()` — only needed for save/load
- `displayGrid()` / `displayLoops()` / `displayChokeMap()` / `displayMachines()` / `displayWaypoints()` — debug/wizard display
- `dialogCreateItemOrMonster()` — wizard mode creation dialog
- `RNGCheck()` / `displayAnnotation()` / `executeEvent()` / `pausePlayback()` — recording playback
- `notifyEvent()` / `saveRunHistory()` / `saveResetRun()` — event notification / run history
- Main menu flame animation performance — separate optimization initiative
