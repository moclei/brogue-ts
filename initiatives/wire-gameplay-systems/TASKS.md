# Wire Gameplay Systems — Tasks

## Phase 1: Messages (~47 stubs) ✅
- [x] Build shared `buildMessageOps()` helper in `runtime.ts` (wraps `messageFn`, `messageWithColorFn`, `confirmMessagesFn`, `deleteMessagesFn`, `updateMessageDisplayFn`, `displayMoreSignFn`, `displayCombatTextFn`, `temporaryMessageFn`, `flavorMessageFn`, `flashTemporaryAlertFn`, `flashMessageFn`, `displayMessageArchiveFn`, `encodeMessageColor`)
- [x] Build `buildMessageContext()` — full MessageContext from shared runtime state (reactive getters for rogue fields, display buffer, waitForAcknowledgment commit-draws fallback)
- [x] Build `buildEffectsContext()` — EffectsContext for flash functions used by message system
- [x] Wire `message()` across all 12 contexts (InventoryCtx, GameInitCtx, InputCtx, AttackCtx, PlayerMoveCtx, MiscHelpersCtx, LifecycleCtx, TurnProcessingCtx, MenuCtx, 2× CostMapFovCtx)
- [x] Wire `messageWithColor()` across all 10 contexts (same set + LevelCtx, CombatDamageCtx with 2-arg adapter)
- [x] Wire `combatMessage()` across 4 contexts (CombatDamageCtx, PlayerMoveCtx, TurnProcessingCtx)
- [x] Wire `confirmMessages()` across 5 contexts
- [x] Wire `temporaryMessage()`, `flavorMessage()` (InputCtx, TurnProcessingCtx, GameInitCtx)
- [x] Wire `displayMoreSign()` / `displayMoreSignWithoutWaitingForAcknowledgment()` (LifecycleCtx)
- [x] Wire `flashTemporaryAlert()`, `flashMessage()` (LifecycleCtx, InputCtx, TurnProcessingCtx)
- [x] Wire `encodeMessageColor()` (LifecycleCtx, GameInitCtx)
- [x] Wire `deleteMessages()`, `updateMessageDisplay()`, `displayMessageArchive()`, `displayCombatText()` (InputCtx, LifecycleCtx, TurnProcessingCtx)
- [x] Wire `displayedMessage` to real `messageState.displayedMessage` in LifecycleCtx
- [x] Verify: 0 compilation errors, 2263/2263 tests passing
- [ ] Manual verify: combat produces visible text, movement messages appear

## Phase 2: Item Interaction (~20 stubs) ✅
- [x] Wire `itemName()` — real `itemNameFn` + `buildItemNamingContext()` across all ~12 DI contexts (EquipContext, CostMapFovContext ×2, CombatDamageContext, MiscHelpersContext, LifecycleContext, TurnProcessingContext, ArchitectContext, InputContext, PlayerMoveContext, ItemHelperContext)
- [x] Wire `pickUpItemAt()` — full floor item collection with auto-ID, gold, amulet guardian logic
- [x] Wire `equip()` / `unequip()` — gear management via `buildFullEquipContext()` + `syncFullEquipState()`
- [x] Wire `drop()` — dropping items with cursed check, unequip, floor placement
- [x] Wire `apply()` — stub with message (needs targeting system, deferred to Phase 5)
- [x] Wire `throwCommand()` — stub with message (needs targeting system, deferred to Phase 5)
- [x] Wire `relabel()` / `call()` — stubs with messages (need inventory prompt, deferred to Phase 5)
- [x] Wire `swapLastEquipment()` — stub (needs lastEquippedWeapon/Armor tracking, deferred to Phase 5)
- [x] Wire `useKeyAt()` — real `useKeyAtFn` + `buildItemHelperContext()` with all required map/item helpers
- [x] Wire `deleteItem()` — GC-based cleanup (no explicit free needed in TS)
- [x] Wire `numberOfMatchingPackItems()` — real `numberOfMatchingPackItemsFn` across 5 contexts
- [x] Wire `itemAtLoc()` — real `itemAtLocFn` across CostMapFovContext ×2 and ArchitectContext
- [x] Wire `updateIdentifiableItems()` — wired with simplified handler context
- [x] Wire `updateEncumbrance()` — real `updateEncumbranceFn` via full equip context in CombatDamageContext
- [x] Wire `makeMonsterDropItem()` — real implementation using `removeItemFromArray` + floor placement + `addItemToPack`
- [x] Wire `checkForMissingKeys()` — terrain promotion when key no longer at location
- [x] Wire `keyInPackFor()` — real key lookup by location/machine in PlayerMoveContext
- [x] Wire `buildItemHelperContext()` — full ItemHelperContext for useKeyAt and related helpers
- [x] Wire `getItemName()` convenience helper — wraps `itemNameFn` + `buildItemNamingContext()`
- [x] Wire `describedItemName()` — real item naming in ArchitectContext
- [x] Wire `itemValue()`, `isVowelish()` — real functions from item-naming.ts
- [x] Verify: 0 compilation errors, 2263/2263 tests passing

## Phase 3: Monster Lifecycle (~15 stubs) ✅
- [x] Wire `killCreature()` — full death sequence across SpawnContext, MonsterOpsContext, MiscHelpersContext, TurnProcessingContext, AttackContext, CombatDamageContext via killCreatureImpl → killCreatureFn + buildCombatDamageContext
- [x] Wire `removeCreature()` / `prependCreature()` — inline list ops in MiscHelpers, TurnProcessing, Environment, CreatureEffects contexts
- [x] Wire `moveMonster()` in PlayerMoveContext — simplified inline for ally swapping; full AI version deferred
- [x] Wire `splitMonster()` — in AttackContext via CombatHelperContext
- [x] Wire `freeCaptive()` — in PlayerMoveContext via AllyManagementContext
- [x] Wire `demoteMonsterFromLeadership()` / `checkForContinuedLeadership()` — in Attack, CombatDamage, MiscHelpers, TurnProcessing contexts
- [x] Wire `fadeInMonster()` — in Attack, CombatDamage, CombatHelper contexts
- [x] Wire `spawnDungeonFeature()` — in Attack, CombatDamage, TurnProcessing, Environment, CreatureEffects, PlayerMove contexts (both index-based and object-based variants)
- [x] Wire `promoteTile()` — in Lifecycle, PlayerMove, TurnProcessing, CreatureEffects, removeItemAt, checkForMissingKeys via promoteTileImpl
- [x] Wire `applyInstantTileEffectsToCreature()` / `applyGradualTileEffectsToCreature()` — in CombatDamage and TurnProcessing via real functions + buildCreatureEffectsContext
- [x] Wire `monsterShouldFall()` / `monstersFall()` / `playerFalls()` — in TurnProcessing and Environment via real functions
- [x] Wire `decrementPlayerStatus()` — upgraded from minimal counter stub to real decrementPlayerStatusFn
- [x] Build `buildCreatureEffectsContext()` — full ~200-field DI context for all creature-effect functions
- [x] Fix `removeDeadMonsters` wrong bitmask (0x4000 → MB_IS_DYING), soonestTurn safety floor, dead monster guard, decrementMonsterStatus stub
- [x] Verify: compile clean, 2261/2263 tests pass (2 timeout-only in full suite)

## Phase 4: Combat Effects (~10 stubs) ✅
- [x] Wire `magicWeaponHit()` — weapon runic effects via buildRunicContext → magicWeaponHitFn
- [x] Wire `specialHit()` — monster special attacks via buildRunicContext → specialHitFn
- [x] Wire `applyArmorRunicEffect()` — armor defensive runics via buildRunicContext → applyArmorRunicEffectFn
- [x] Build `buildRunicContext()` — extends AttackContext with runic-specific callbacks (armorRunicIdentified, autoIdentify, playerImmuneToMonster, slow, weaken, exposeCreatureToFire, monstersAreEnemies, etc.)
- [x] Wire `handlePaladinFeat()` — via handlePaladinFeatFn + buildCombatHelperContext
- [x] Wire `setPureMageFeatFailed()` — sets rogue.featRecord[FeatType.PureMage] = false
- [x] Wire `setDragonslayerFeatAchieved()` — feat tracking
- [x] Wire `decrementWeaponAutoIDTimer()` — via decrementWeaponAutoIDTimerFn + buildCombatHelperContext
- [x] Wire `rechargeItemsIncrementally()` — via rechargeItemsIncrementallyFn + buildMiscHelpersContext in both AttackContext and TurnProcessingContext
- [x] Wire `processIncrementalAutoID()` — via processIncrementalAutoIDFn + buildMiscHelpersContext in TurnProcessingContext
- [x] Wire `equipItem()` in AttackContext — for re-equipping degraded armor, via buildFullEquipContext
- [x] Wire `checkForDisenchantment()` — via checkForDisenchantmentFn with NUMBER_GOOD_WEAPON_ENCHANT_KINDS + ArmorEnchant.NumberGoodArmorEnchantKinds
- [x] Wire `strengthCheck()` — via strengthCheck from item-usage.ts + buildFullEquipContext
- [x] Wire `ringWisdomMultiplier` / `charmRechargeDelay` — real implementations from power-tables.ts via FP adapter
- [x] Wire `reaping` — from rogue.reaping (set by equipment bonuses) instead of hardcoded 0
- [x] Wire `monstersAreEnemies` — real monstersAreEnemiesFn in RunicContext
- [x] Verify: compile clean, 2263/2263 tests pass

## Phase 5: UI Panels (~10 stubs) ✅
- [x] Wire `refreshSideBar()` — HP, stats, nearby entities via `refreshSideBarRuntime` wrapper → `refreshSideBarFn` + `buildSidebarContext()` across MessageContext, LevelContext, TravelExploreContext, CombatDamageContext, CombatHelperContext, AttackContext, TurnProcessingContext, InputContext (3-arg variant with focusX/focusY/forceFullUpdate, and 0-arg wrapper passing -1,-1,false for combat contexts)
- [x] Wire `updateFlavorText()` — cell description under cursor via `updateFlavorTextFn` + `buildCreatureEffectsContext()` in PlayerMoveContext (PlayerRunContext) and TravelExploreContext
- [x] Wire `displayInventory()` — full button-based inventory screen via `displayInventoryFn` + `buildInventoryContext()` in InputContext (async wrapper)
- [x] Wire `displayMessageArchive()` — already wired in Phase 1 (verified: no remaining stubs)
- [x] Wire `printHelpScreen()`, `displayFeatsScreen()`, `printDiscoveriesScreen()` — via ported functions + `buildScreenContext()` in InputContext
- [x] Wire `printMonsterDetails()` / `printFloorItemDetails()` / `printLocationDescription()` — via `printMonsterDetailsFn` + `buildSidebarContext()`, `printFloorItemDetailsFn` + `buildSidebarContext()`, `printLocationDescriptionFn` + `buildDescribeLocationContext()` in InputContext
- [x] Fix `sidebarLocationList` initialization on RuntimeRogueState interface and `createRogueState()`
- [x] Fix pre-existing context builder type errors: `randClump` wrapper, `EquipmentState` completeness, `rectangularShadingFn` ctx arg, `spawnDungeonFeature` object variant, `buttonInputLoop` signature
- [x] Fix test: `findPlayerInBuffer` skips sidebar columns to avoid false positive from sidebar `@` glyph
- [x] Verify: compile clean, 2263/2263 tests pass

## Phase 6: Polish (~15 stubs) ✅
- [x] Wire `search()` — manual search via `searchRuntime()` helper in CreatureEffectsContext, MiscHelpersContext, TurnProcessingContext + full ItemHelperContext builder
- [x] Wire `updateMinersLightRadius()` — dynamic light radius via `updateMinersLightRadiusFn` in 4 contexts (CombatDamageContext, CreatureEffectsContext, AttackContext, MiscHelpersContext)
- [x] Wire `updatePlayerUnderwaterness()` — water effects via `updatePlayerUnderwaternessFn` in TravelExploreContext
- [x] Wire `vomit()` — nausea effect with full VomitContext (dungeonFeatures, monster naming, combatMessage) in PlayerMoveContext
- [x] Wire `addPoison()`, `flashMonster()` — via `addPoisonFn`/`flashMonsterFn` + `buildCombatDamageContext()` in CombatDamageContext and TurnProcessingContext
- [x] Wire `exposeTileToFire()` — via `exposeTileToFireFn` + `buildEnvironmentContext()` in EnvironmentContext
- [x] Wire `createFlare()` / `animateFlares()` — via `createFlareFn`/`animateFlaresFn` + `buildLightingContext()` in CreatureEffectsContext, RunicContext, TurnProcessingContext
- [x] Wire `recordKeystroke()` / `cancelKeystroke()` / `recordMouseClick()` — via recording-events functions in 6+ contexts (CreatureEffectsContext, PlayerMoveContext, MiscHelpersContext, LifecycleContext, TurnProcessingContext, InputContext)
- [x] Wire `printHighScores()` — via `printHighScoresFn` + `buildScreenContext()` in LifecycleContext and top-level runtime
- [x] Wire `playerInDarkness()` — via `playerInDarknessFn` in CreatureEffectsContext
- [x] Wire `synchronizePlayerTimeState()` — via `synchronizePlayerTimeStateFn` in LevelContext and CreatureEffectsContext
- [x] Keep `saveGame` / `loadSavedGame` / `saveRecording` / `saveRecordingNoPrompt` as stubs (need file I/O backend — IndexedDB or localStorage)
- [x] Fix compilation errors: unused imports (`monsterAvoidsFn`, `MonsterStateContext`), `lightCatalog` → `lightCatalogData` (3 locations), `charCodeAt` on `never` type
- [x] Verify: compile clean (0 errors), 2263/2263 tests passing

## Remaining Stubs — Ported but Not Wired

Functions where the real TS implementation exists but runtime.ts still uses a stub. These are candidates for immediate wiring work.

- [ ] `monsterAvoids()` — 8 contexts (`() => false`). Real: `monster-state.ts`. Needs `MonsterStateContext`. **High impact**: monsters currently ignore lava, chasms, dangerous terrain.
- [ ] `handleWhipAttacks()` / `handleSpearAttacks()` / `abortAttack()` — PlayerMoveContext. Real: `weapon-attacks.ts`. Need `WeaponAttackContext` with bolt system. **Medium**: whip/spear range attacks non-functional.
- [ ] `updateSafetyMap()` — 1 context. Real: `safety-maps.ts`. Needs `SafetyMapsContext`. **Medium**: monsters don't plan safe retreat paths.
- [ ] `updateClairvoyance()` — 1 context. Real: `safety-maps.ts`. **Medium**: clairvoyance ring has no effect.
- [ ] `recalculateEquipmentBonuses()` — 2 contexts. Real: `item-usage.ts`. Needs `EquipmentState`. **Medium**: equipment bonuses may not refresh properly.
- [ ] `eat()` — 1 context (CreatureEffectsContext). Real: `item-handlers.ts`. Needs `ItemHandlerContext`. **Medium**: food items do nothing.
- [ ] `startLevel()` — 1 context (CreatureEffectsContext). Real: `game-level.ts`. Needs `LevelContext`. **High impact**: cannot descend/ascend via stairs.
- [ ] `spawnPeriodicHorde()` — 1 context (CreatureEffectsContext). Real: `monster-spawning.ts`. Needs `SpawnContext`. **Medium**: no new monsters spawn over time.
- [ ] `restoreMonster()` — 1 context (MiscHelpersContext). Real: `architect.ts`. **Low**: only needed for save/load.

## Remaining Stubs — Not Yet Ported

Functions where no TS implementation exists yet. These require new porting work before wiring.

- [ ] `cloneMonster()` — monster duplication (plenty runic, armor multiplicity, jelly splitting). Source: Monsters.c
- [ ] `monsterStealsFromPlayer()` — thief monster item-stealing AI. Source: Monsters.c
- [ ] `forceWeaponHit()` — force weapon blinking bolt effect. Source: Combat.c
- [ ] `teleport()` — creature teleportation. Source: Monsters.c / Movement.c
- [ ] `updateFloorItems()` — floor item decay over time. Source: Time.c
- [ ] `assureCosmeticRNG()` / `restoreRNG()` — cosmetic RNG isolation. Source: Rogue.h / platform
- [ ] `updatePlayerRegenerationDelay()` — regeneration bonus effect. Source: Time.c

## Remaining Stubs — Intentionally Deferred

Low-priority or infrastructure-dependent stubs that don't affect core gameplay.

- [ ] `saveGame()` / `loadSavedGame()` / `saveRecording()` / `saveRecordingNoPrompt()` — need file I/O backend (IndexedDB or localStorage)
- [ ] `displayGrid()` / `displayLoops()` / `displayChokeMap()` / `displayMachines()` / `displayWaypoints()` — debug/wizard display (cosmetic)
- [ ] `dialogCreateItemOrMonster()` — wizard mode item/monster creation
- [ ] `RNGCheck()` / `displayAnnotation()` / `executeEvent()` / `pausePlayback()` — recording playback system
- [ ] `notifyEvent()` / `saveRunHistory()` / `saveResetRun()` — event notification / run history
