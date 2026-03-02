# Wire Gameplay Systems — Plan

## Approach

The ~148 remaining stubs in `runtime.ts` are organized into 6 phases, ordered by gameplay impact. Each phase targets a functional area and leaves the game in a more playable state than before. Phases are designed so that earlier phases unlock visible improvements the player can immediately test.

```
Phase 1: Messages         → Player gets text feedback for everything
Phase 2: Item Interaction  → Pick up, equip, use, drop, throw items
Phase 3: Monster Lifecycle → Monsters die, drop loot, terrain reacts
Phase 4: Combat Effects    → Weapon/armor runics, special hits, feats
Phase 5: UI Panels         → Sidebar, inventory screen, flavor text
Phase 6: Polish            → Save/load, search, encumbrance, misc helpers
```

Each phase follows the same pattern:
1. Identify all stubs in the target area
2. Check that the real functions are ported and exported
3. Build or extend the relevant DI context in `runtime.ts`
4. Replace stubs with real calls
5. Verify compilation + tests + manual play

---

## Phase 1: Messages

The single biggest UX gap. Without messages, the player has zero feedback on combat, movement, or item actions. The message system was fully ported in Phase 3 Step 2a (`io-messages.ts`, 64 tests).

**Stubs to wire (~47):**
- `message(msg, flags)` — appears in ~12 contexts
- `messageWithColor(msg, color, flags)` — appears in ~8 contexts
- `combatMessage(text, color)` — appears in ~3 contexts
- `confirmMessages()` — appears in ~6 contexts
- `temporaryMessage(msg, flags)` — 1 context
- `updateMessageDisplay()` — 1 context
- `deleteMessages()` — 1 context
- `displayMoreSign()` / `displayMoreSignWithoutWaitingForAcknowledgment()` — 2 contexts
- `flashTemporaryAlert(msg, time)` — 2 contexts
- `flashMessage(msg, x, y, duration, fg, bg)` — 1 context
- `flavorMessage(msg)` — 1 context
- `encodeMessageColor(buf, pos, color)` — 1 context

**Key dependencies:**
- `io-messages.ts`: `messageFn`, `messageWithColorFn`, `displayCombatTextFn`, `confirmMessagesFn`, `deleteMessagesFn`, `displayMoreSignFn`, `updateMessageDisplayFn`
- `io-effects.ts`: `flashTemporaryAlertFn`, `flashMessageFn`
- Message state: `messageArchive`, `messageConfirmed`, `messageCount` on `RuntimeRogueState`
- Display buffer: messages render to the top rows of the display buffer

**Approach:** Build a shared `messageCtx` helper that can be spread into any context needing message functions. Most stubs will point to the same underlying implementations.

---

## Phase 2: Item Interaction

Without item interaction, the player walks over items but can't collect them. The item system was fully ported in Phase 2 (`items/` module, 8K lines) and interactive handlers in Phase 3 Step 6a.

**Stubs to wire (~20):**
- `pickUpItemAt(loc)` — picking up floor items
- `equip(item)` / `unequip(item)` — gear management
- `drop(item)` — dropping items
- `apply(item)` — using scrolls, potions, wands, staves, charms
- `throwCommand(item, confirmed)` — throwing items
- `relabel(item)` / `call(item)` — renaming items
- `swapLastEquipment()` — quick-swap
- `itemName(item, ...)` — rendering item names (currently returns "item")
- `printCarriedItemDetails()` — item detail display
- `numberOfItemsInPack()` — pack size query
- `itemMagicPolarity()` — magic detection
- `useKeyAt(loc)` — using keys on doors
- `deleteItem(item)` — removing consumed items
- `makeMonsterDropItem(monst)` — monster loot drops
- `updateIdentifiableItems()` — auto-ID system
- `updateEncumbrance()` — weight tracking
- `checkForMissingKeys()` — key tracking

**Key dependencies:**
- `items/item-usage.ts`, `items/item-helpers.ts`, `items/item-generation.ts`
- `items/item-handlers.ts` (interactive handlers)
- `ItemGenContext`, `ItemUsageContext`, `PackContext`

---

## Phase 3: Monster Lifecycle

Currently, monsters track and attack the player, but when they "die" they don't get properly removed, don't drop items, and terrain doesn't react to their death.

**Stubs to wire (~15):**
- `killCreature(monst)` — full death sequence (drop items, spawn features, remove from list)
- `removeCreature(monst)` / `prependCreature(monst)` — linked list management
- `moveMonster(monst, dx, dy)` — the full move function (tile effects, stepping on items, etc.)
- `splitMonster(monst)` — for splitting monsters (bloats, etc.)
- `freeCaptive(monst)` — releasing allies
- `demoteMonsterFromLeadership()` / `checkForContinuedLeadership()` — pack leadership
- `fadeInMonster(monst)` — visual effect for appearing monsters
- `restoreMonster(monst)` / `restoreMonsterFn()` — for save/load
- `spawnDungeonFeature(x, y, feat)` — dungeon feature spawning on death/events
- `promoteTile(x, y)` — terrain promotion (e.g., doors opening)
- `applyInstantTileEffectsToCreature(creature)` — stepping on fire, gas, etc.

**Key dependencies:**
- `game/game-cleanup.ts`: `freeCreatureFn`, `removeDeadMonstersFn`
- `monsters/monster-actions.ts`: movement, ally management
- `architect/architect.ts`: `spawnDungeonFeatureFn`
- `CombatDamageContext` (partially built in combat wiring)

---

## Phase 4: Combat Effects

Basic attack/damage works, but weapon/armor runic effects, special monster attacks, and feat tracking are all stubbed.

**Stubs to wire (~10):**
- `magicWeaponHit()` — weapon runic effects (fire, slowing, confusion, etc.)
- `specialHit()` — monster special attacks
- `handlePaladinFeat()` / `setPureMageFeatFailed()` / `setDragonslayerFeatAchieved()` — feat tracking
- `decrementWeaponAutoIDTimer()` — weapon identification
- `rechargeItemsIncrementally()` — staff/charm recharging
- `equipItem()` (in combat context) — auto-equip effects
- `checkForDisenchantment()` — disenchant traps
- `strengthCheck()` — strength-based weapon effects

**Key dependencies:**
- `combat/combat-runic.ts`: runic effect handlers
- `items/item-usage.ts`: recharge, equip
- `game/game-feats.ts`: feat tracking (if ported)

---

## Phase 5: UI Panels

The sidebar, inventory screen, and flavor text give the player critical game information.

**Stubs to wire (~10):**
- `refreshSideBar(x, y, focus)` — HP bar, stats, monster list, item list
- `updateFlavorText()` — description of cell under cursor
- `displayInventory(mask, titleFlags, focusFlags, details, buttons)` — full inventory UI
- `displayMessageArchive()` — scrollable message history
- `printHelpScreen()` — key bindings reference
- `displayFeatsScreen()` — achievement tracking
- `printDiscoveriesScreen()` — item identification status
- `printMonsterDetails()` / `printFloorItemDetails()` / `printLocationDescription()` — detail panels

**Key dependencies:**
- `io-sidebar.ts`: `refreshSideBarFn` (72 tests)
- `io-inventory.ts`: `displayInventoryFn` (30 tests)
- `io-screens.ts`: screen display functions (57 tests)
- `SideBarContext`, `InventoryDisplayContext`

---

## Phase 6: Polish

Remaining stubs that affect completeness but not core gameplay.

**Stubs to wire (~15):**
- `saveGame()` / `loadSavedGame()` — save/load via IndexedDB or localStorage
- `search(strength)` — manual search for secrets
- `updateMinersLightRadius()` — dynamic light radius
- `updatePlayerUnderwaterness()` — water visual effects
- `recordKeystroke()` / `cancelKeystroke()` — recording system
- `saveRecording()` / `saveRecordingNoPrompt()` — recording save
- `printHighScores()` — high score display
- `animateFlares()` — visual flare effects
- `vomit()` — nausea effect
- `alertMonster()` — monster alert state changes
- `RNGCheck()` — recording determinism check

---

## Technical Notes

### Shared Message Helper Pattern

Many DI contexts need `message`, `messageWithColor`, `confirmMessages`. Rather than wiring these individually in 12+ places, build a `buildMessageOps()` helper that returns an object with all message methods. Then spread it into each context:

```typescript
const msgOps = buildMessageOps();
// In any context:
return { ...msgOps, /* other methods */ };
```

### Incremental Testability

Each phase should be manually testable. After Phase 1, the player sees combat text. After Phase 2, items can be picked up. This allows validation at each step before moving to the next.

### Stub Replacement Strategy

When replacing a stub, the approach is:
1. Find the real function export (e.g., `messageFn` from `io-messages.ts`)
2. Check what DI context it needs (e.g., `MessageContext`)
3. Build that context from shared runtime state
4. Replace the stub with a call to the real function with the built context

Some functions need contexts that themselves contain stubs from later phases. In those cases, provide the stub for the forward dependency and note it for replacement when that phase arrives.

---

## Open Questions

- **Message rendering target:** Messages write to the top rows of the display buffer. Need to verify the display buffer dimensions account for the message area, or if messages need a separate rendering pass.
- **Inventory button UI:** `displayInventory` uses the button system extensively. Need to verify button input works in async context.
- **Save format:** What storage backend for save/load? IndexedDB for durability, or localStorage for simplicity? Decision can wait until Phase 6.
