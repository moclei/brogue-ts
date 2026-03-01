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

## Phase 3: Monster Lifecycle (~15 stubs)
- [ ] Wire `killCreature()` — full death sequence (drop items, spawn features, remove)
- [ ] Wire `removeCreature()` / `prependCreature()` — creature list management
- [ ] Wire `moveMonster()` in PlayerMoveContext — full movement with tile effects
- [ ] Wire `splitMonster()` — blob splitting
- [ ] Wire `freeCaptive()` — ally release
- [ ] Wire `demoteMonsterFromLeadership()` / `checkForContinuedLeadership()`
- [ ] Wire `fadeInMonster()` — visual effect
- [ ] Wire `spawnDungeonFeature()` — feature spawning on events/death
- [ ] Wire `promoteTile()` — terrain promotion (doors, pressure plates)
- [ ] Wire `applyInstantTileEffectsToCreature()` — fire, gas, water effects
- [ ] Wire `makeMonsterDropItem()` — loot drops
- [ ] Verify: killing monsters properly removes them and drops loot

## Phase 4: Combat Effects (~10 stubs)
- [ ] Wire `magicWeaponHit()` — weapon runic effects
- [ ] Wire `specialHit()` — monster special attacks
- [ ] Wire `handlePaladinFeat()` / `setPureMageFeatFailed()` / `setDragonslayerFeatAchieved()`
- [ ] Wire `decrementWeaponAutoIDTimer()` — weapon auto-ID
- [ ] Wire `rechargeItemsIncrementally()` — staff/charm recharging
- [ ] Wire `checkForDisenchantment()` / `strengthCheck()`
- [ ] Verify: weapon runics fire, staves recharge between uses

## Phase 5: UI Panels (~10 stubs)
- [ ] Wire `refreshSideBar()` — HP, stats, nearby entities
- [ ] Wire `updateFlavorText()` — cell description under cursor
- [ ] Wire `displayInventory()` — full button-based inventory screen
- [ ] Wire `displayMessageArchive()` — scrollable message history
- [ ] Wire `printHelpScreen()`, `displayFeatsScreen()`, `printDiscoveriesScreen()`
- [ ] Wire `printMonsterDetails()` / `printFloorItemDetails()` / `printLocationDescription()`
- [ ] Verify: sidebar updates, inventory screen opens, help screen displays

## Phase 6: Polish (~15 stubs)
- [ ] Wire `saveGame()` / `loadSavedGame()` with IndexedDB or localStorage backend
- [ ] Wire `search()` — manual search for secrets
- [ ] Wire `updateMinersLightRadius()` — dynamic light radius
- [ ] Wire `updatePlayerUnderwaterness()` — water visual effects
- [ ] Wire `recordKeystroke()` / `cancelKeystroke()` — recording system
- [ ] Wire `saveRecording()` / `saveRecordingNoPrompt()`
- [ ] Wire `printHighScores()` — high score display
- [ ] Wire `animateFlares()` — visual flare effects
- [ ] Wire `vomit()`, `alertMonster()`, `monsterAvoids()` — miscellaneous creature functions
- [ ] Verify: save/load works, search reveals secrets, all visual effects functional
