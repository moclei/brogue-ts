# Wire Gameplay Systems — Tasks

## Phase 1: Messages (~47 stubs)
- [ ] Build shared `buildMessageOps()` helper in `runtime.ts` (wraps `messageFn`, `messageWithColorFn`, `confirmMessagesFn`, `deleteMessagesFn`, `updateMessageDisplayFn`, `displayMoreSignFn`)
- [ ] Add message state to `RuntimeRogueState` (`messageArchive`, `messageConfirmed`, `messageCount`, `messageBuffer`)
- [ ] Wire `message()` across all 12+ contexts
- [ ] Wire `messageWithColor()` across all 8+ contexts
- [ ] Wire `combatMessage()` across all 3 contexts
- [ ] Wire `confirmMessages()` across all 6 contexts
- [ ] Wire `temporaryMessage()`, `flavorMessage()`
- [ ] Wire `displayMoreSign()` / `displayMoreSignWithoutWaitingForAcknowledgment()`
- [ ] Wire `flashTemporaryAlert()`, `flashMessage()`
- [ ] Wire `encodeMessageColor()`
- [ ] Verify: combat produces visible text, movement messages appear

## Phase 2: Item Interaction (~20 stubs)
- [ ] Wire `itemName()` — replace "item" stub with real `itemNameFn`
- [ ] Wire `pickUpItemAt()` — floor item collection
- [ ] Wire `equip()` / `unequip()` — gear management
- [ ] Wire `drop()` — dropping items
- [ ] Wire `apply()` — using scrolls, potions, wands, staves, charms
- [ ] Wire `throwCommand()` — throwing items
- [ ] Wire `relabel()` / `call()` — renaming items
- [ ] Wire `swapLastEquipment()` — quick-swap
- [ ] Wire `useKeyAt()` — using keys on doors
- [ ] Wire `deleteItem()` — consuming/removing items
- [ ] Wire `numberOfItemsInPack()`, `printCarriedItemDetails()`, `itemMagicPolarity()`
- [ ] Wire `updateIdentifiableItems()` — auto-ID tracking
- [ ] Wire `updateEncumbrance()` — weight effects
- [ ] Verify: items can be picked up, equipped, used, and dropped

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
