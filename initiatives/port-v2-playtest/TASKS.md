# TASKS: port-v2-playtest

Each sub-phase is one session's work. Stop, commit, and generate a handoff prompt after each.

Starting state: 87 files, 2171 pass, 141 skip
Branch: feat/port-v2-playtest

---

## Phase 1: IO + Message wiring ✓ DONE (ffe0476)

*Wire message system and core display callbacks into all context builders.*
*After this phase: player sees messages, cells redraw on change, sidebar updates.*

- [x] Audit `src/io/messages.ts` — confirm exports: `message`, `messageWithColor`,
      `temporaryMessage`, `confirmMessages`, `updateMessageDisplay`
- [x] Audit `src/io/cell-appearance.ts` — confirm `refreshDungeonCellFn` export shape
- [x] Audit `src/io/` for `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText`
- [x] Wire message functions into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `lifecycle.ts`
- [x] Wire `refreshDungeonCell` into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `monsters.ts`
- [x] Wire `refreshSideBar` into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `lifecycle.ts`
- [ ] Wire `confirm` (async) into: `movement.ts`, `items.ts` non-targeting contexts — DEFER to Phase 3b
- [ ] Wire `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText` — DEFER (needs InputContext)
- [x] All files under 600 lines; tests pass (2171 pass / 141 skip)
- [x] Commit; generate handoff

---

## Phase 2a: Monster AI audit + wiring ✓ DONE

*Audit and wire monster movement AI, state updates, and scent into turn.ts.*
*After this sub-phase: monsters move, use scent, path toward player.*

- [x] Audit `src/monsters/monster-actions.ts` — confirmed exports:
      `scentDirection`, `pathTowardCreature`, `wanderToward`, `moveAlly`, `monsterMillAbout`,
      `isLocalScentMaximum`, `monsterWillAttackTarget`, `chooseNewWanderDestination`, `isValidWanderDestination`
- [x] Audit `src/monsters/monster-movement.ts` — confirmed `moveMonster` export
      (file is `monster-movement.ts`, not `monster-ai-movement.ts` as TASKS.md said)
- [x] Audit `src/monsters/monster-state.ts` — confirmed `updateMonsterState`, `wakeUp` exports
- [x] Audit `src/time/` for `updateScent`; implemented inline in `buildTurnProcessingContext`
      using `getFOVMask` from `light/fov.ts` + `scentDistance` from `time/turn-processing.ts`
- [x] Wire all monster AI functions into `buildMonstersTurnContext` — extracted to `turn-monster-ai.ts`
      (turn.ts would have exceeded 600 lines; context builder is 586 lines in new file)
      Note: `nextStep` kept as stub (`() => -1`) — requires full TravelExploreContext (40+ fields)
- [x] All files under 600 lines: `turn.ts` = 359 lines, `turn-monster-ai.ts` = 586 lines
- [x] Tests pass: 87 files, 2171 pass, 141 skip

---

## Phase 2b: Input context + test cleanup ✓ DONE

*Wire autoRest/manualSearch/dijkstraScan; activate unblocked skipped tests.*
*After this sub-phase: player can auto-rest, search, pathfinding infrastructure live.*

- [x] Wire `autoRest`, `manualSearch` → built `buildMiscHelpersContext()` in `io/input-context.ts`;
      wired real `autoRestFn`/`manualSearchFn` from `time/misc-helpers.ts`
- [x] Wire `dijkstraScan` → imported `dijkstraScanFn` from `dijkstra/dijkstra.ts`; replaced stub
- [x] Remove or activate test.skip entries now unblocked:
      removed 7 stale stubs from turn.test.ts (Phase 2a wired: updateMonsterState, moveMonster,
      scentDirection, pathTowardCreature, updateScent; Phase 2b wired: autoRest, manualSearch)
- [x] All files under 600 lines (input-context.ts = 530 lines); tests pass
- [x] Commit; generate handoff

---

## Phase 3a: Domain functions + movement restructure ✓ DONE

*Port and wire movement-adjacent domain functions; restructure oversized files.*
*After this sub-phase: pickUpItemAt, promoteTile, useKeyAt, getQualifyingPathLocNear ported.*

- [x] Audit `src/movement/` for `pickUpItemAt`, `checkForMissingKeys`, `useKeyAt` — ported:
      `checkForMissingKeys` added to `movement/item-helpers.ts`;
      `pickUpItemAt` ported to new `items/pickup.ts`;
      `getQualifyingPathLocNear` ported to new `movement/path-qualifying.ts`
- [x] Wire `promoteTile` → `src/time/environment.ts` → `movement.ts`
      (environment.ts shrunk from 609 → 570 lines by removing dead duplicate `updateYendorWardenTracking`;
       re-exported from misc-helpers.ts instead)
- [x] Wire `useKeyAt` → `src/movement/item-helpers.ts` → `movement.ts`
- [x] Wire `getQualifyingPathLocNear` → `src/movement/path-qualifying.ts` → `movement.ts`
      (ported `getTerrainGrid` + `getPassableArcGrid` helpers from Grid.c as local statics)
- [x] Wire `updatePlayerUnderwaterness` → `src/time/creature-effects.ts` → `movement.ts`
- [x] Wire `checkForMissingKeys` → `movement/item-helpers.ts` → `movement.ts`
- [x] Wire `pickUpItemAt` → `items/pickup.ts` → `movement.ts`
- [x] Split `buildCostMapFovContext` out of `movement.ts` → new `movement-cost-map.ts` (re-exported)
- [x] Mark `recordKeystroke`, `cancelKeystroke` as permanent DEFER no-ops (recordings layer); add note
- [x] All files under 600 lines; tests pass (87 files, 2171 pass, 134 skip)
- [x] Commit; generate handoff

---

## Phase 3b: Platform wiring + test cleanup ✓ DONE (54ac6ff)

*Wire async travel helpers, cursor/path display, and input keystrokes into movement.ts.*
*After this sub-phase: cursor path shows, travel mode responds to input events.*

- [x] Wire `pauseAnimation` → `platform-bridge.ts` → `movement.ts` travel context
      (platform-bridge.ts breaks circular dep; platformPauseAndCheckForEvent registered at initPlatform)
- [x] Wire `hilitePath`, `clearCursorPath`, `hiliteCell` → `io/targeting.ts` → `movement.ts`
- [x] Wire `plotForegroundChar` → `io/display.ts` → `movement-weapon-context.ts` (uses displayBuffer bg)
- [x] Extract `buildWeaponAttackContext()` to `movement-weapon-context.ts` (movement.ts was at 600 lines)
- [x] Add `buildGetCellAppearanceFn()` factory to `io-wiring.ts` for hiliteCell context
- [x] Activate `pauseAnimation` + `hilitePath/clearCursorPath` tests in movement.test.ts (2 skip → pass)
- [x] All files under 600 lines; tests pass (87 files, 2173 pass, 132 skip)
- [x] Commit; generate handoff
- DEFER: `nextBrogueEvent` — sync/async mismatch; requires travel confirm dialog async refactor
- DEFER: `confirm` (async) — PlayerMoveContext.confirm is sync; cascading async change required
- DEFER: `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText` — circular dep via ui.ts

---

## Phase 4: Combat domain stubs ✓ DONE

*Implement pronoun resolution and wire remaining combat helpers.*
*After this phase: correct combat messages, full combat resolution including leadership.*

- [x] Port `resolvePronounEscapes` from `Combat.c` — ported to `io/text.ts` as
      `buildResolvePronounEscapesFn`; wired into `combat.ts`, `turn.ts`, `items.ts`, `turn-monster-ai.ts`
- [x] Port `getMonsterDFMessage` — `monsterText[id].DFMessage` lookup in `io/text.ts`;
      wired into `combat.ts`, `turn.ts`
- [x] Port `unAlly`, `checkForContinuedLeadership`, `demoteMonsterFromLeadership` →
      new `src/monsters/monster-ally-ops.ts`; wired into `combat.ts`, `turn.ts`
      Note: `anyoneWantABite` kept as `() => false` stub — depends on `canAbsorb` (Phase 6)
- [x] Wire `wakeUp` fully into `combat.ts`, `turn.ts`, `items.ts` via `buildWakeUpFn` in `io-wiring.ts`
      (covers alertMonster + ticksUntilTurn + teammate alert; updateMonsterState on teammates deferred)
- [x] Activated 6 test.skip entries in combat.test.ts
- [x] All files under 600 lines; tests pass (87 files, 2179 pass, 126 skip)
- [x] Commit; generate handoff

---

## Phase 5a: Equipment lifecycle wiring ✓ DONE

*Wire updateEncumbrance, updateRingBonuses, and equipItem into context builders.*
*After this sub-phase: encumbrance correct, ring bonuses applied, equip/unequip wired.*

- [x] Split `item-usage.ts` (608→556 lines): extracted `enchantItem` to `items/item-enchant.ts`
- [x] Created `items/equip-helpers.ts` with `buildEquipState()` + `syncEquipBonuses()` shared helpers
- [x] Wire `updateEncumbrance` → `combat.ts`, `items.ts`, `turn.ts` (movement.ts had no stub)
- [x] Wire `updateRingBonuses` → `lifecycle.ts` (equipItem closure + buildLevelContext), `items.ts`
- [x] Wire `equipItem` → `combat.ts`, `items.ts`
- [x] Removed stub test.skip for updateEncumbrance from items.test.ts
- [x] All files under 600 lines; tests pass (87 files, 2179 pass, 125 skip)
- [x] Commit; generate handoff

---

## Phase 5b: Item floor effects + creature fire ✓ DONE (5afa6f7)

*Wire floor-item lifecycle, drop path, and fire exposure.*
*After this sub-phase: item auto-descent, fire/lava burn, drift, and terrain promote work.*

- [x] Wire `exposeCreatureToFire` → `buildExposeCreatureToFireFn()` in `io-wiring.ts` → `items.ts`
- [ ] Wire `dropItem` full path → `src/items/floor-items.ts` → `turn.ts` `playerFalls` context
      DEFER: `playerFalls` needs `startLevel()` (level-transition context); deferred to Phase 8
- [x] Wire `placeItemAt` in machine context → `lifecycle.ts machineContext.itemOps` now wired to
      real `placeItemAtFn` from `items/floor-items.ts` (handles ITEM_DETECTED + pressure plates)
- [x] Complete `updateFloorItems` subtasks: all branches fully implemented in `floor-items.ts`;
      activated 7 test.skip entries (auto-descent, burn, drift, promote, potion-fall, etc.)
- [x] Port `swapLastEquipment` from `Items.c:6441`; wired inline into `io/input-context.ts`
- [x] Remove or activate test.skip entries now unblocked (items.test.ts, floor-items.test.ts, turn.test.ts)
- [x] All files under 600 lines; tests pass (87 files, 2188 pass, 115 skip)
- [x] Commit; generate handoff

---

## Phase 5c: Inventory dialog port ✓ DONE (2ba9f23)

*Port promptForItemOfType — modal inventory chooser dialog.*
*After this sub-phase: inventory selection dialogs functional.*

- [x] Port `promptForItemOfType` from `Items.c` — added to `io/inventory-display.ts` as async fn;
      `PromptItemContext` extends `InventoryContext` with `temporaryMessage` + `numberOfMatchingPackItems`
- [x] Async cascade: `readScroll` now async; 3 `await ctx.promptForItemOfType` call sites updated;
      `ItemHandlerContext.promptForItemOfType` return type updated to `Promise<Item | null>`
- [x] Wired via `buildPromptForItemOfTypeFn()` factory in `io-wiring.ts`; replaces stub in `items.ts`
- [x] Activated `items.test.ts` stub (empty-pack case returns null immediately)
- [x] `buttonInputLoop` still stubbed → displayInventory always cancels until Phase 7a
- [x] All files under 600 lines; tests pass (87 files, 2189 pass, 114 skip)
- [x] Commit; generate handoff

---

## Phase 6: Monster capability stubs ✓ DONE

*Wire waypoints, awareness, and remaining monster state into context builders.*
*After this phase: monsters use waypoints, can absorb corpses, awareness is accurate.*

- [x] Port `closestWaypointIndex`, `closestWaypointIndexTo` from `Monsters.c` →
      new `monsters/monster-awareness.ts`; wire into `monsters.ts` + `turn-monster-ai.ts`
      Note: `closestWaypointIndex` simplified — no `nextStep` check (stub); `closestWaypointIndexTo` fully functional
- [x] Port `burnedTerrainFlagsAtLoc` from `Monsters.c` → `state/helpers.ts` (approximation:
      flammable → T_IS_FIRE|T_CAUSES_DAMAGE, explosive-promote → also T_CAUSES_EXPLOSIVE_DAMAGE);
      wire into `monsters.ts` + `turn-monster-ai.ts` (2 occurrences)
- [x] Wire `cellHasGas` → `pmap[loc].layers[DungeonLayer.Gas] !== 0` in `monsters.ts`
- [x] Port `awareOfTarget` + `awarenessDistance` from `Monsters.c` → `monsters/monster-awareness.ts`;
      wire into `monsters.ts` + `turn-monster-ai.ts`
- [x] Wire `openPathBetween` → `openPathBetweenFn` from `bolt-geometry.ts` → `monsters.ts`
- [x] Wire `waypointDistanceMap` in `turn-monster-ai.ts` → `rogue.wpDistance[i]`
- [x] Wire `monsterDetails` → `monsters/monster-details.ts` `monsterDetailsFn` → `io-wiring.ts` SidebarContext
- [ ] Wire `updateMonsterCorpseAbsorption` → `src/monsters/monster-actions.ts` — DEFER: stub is equivalent no-op
- [ ] Port `anyoneWantABite` → needs full `CombatHelperContext` with `monsterAvoids`; DEFER to Phase 8
- [ ] Upgrade `wakeUp` in `buildWakeUpFn` (`io-wiring.ts`) — DEFER to Phase 8 (needs full MonsterStateContext)
- [ ] Port `drawManacles` — no-op with note (visual only; permanent defer acceptable)
- [x] Remove or activate test.skip entries now unblocked (7 activated: monsters.test.ts×6, monster-details.test.ts×1)
- [x] All files under 600 lines; tests pass (87 files, 2196 pass, 107 skip)
- [x] Commit; generate handoff

---

## Phase 7a: Pure display wiring ✓ DONE

*Wire text utilities, button infrastructure, shuffleTerrainColors, and printSeed.*
*After this sub-phase: terrain colors animate, seed displayable, inventory messages work.*

- [x] Wire `message`, `confirmMessages` into `buildInventoryContext()` in `ui.ts` —
      imported from `io/messages.ts` directly; IIFE captures fresh `buildMessageContext()`;
      activated 2 test.skip entries (message queues archive, confirmMessages clears unconfirmed)
- [x] Wire `strLenWithoutEscapes` → already wired in `buildButtonContext()` (pre-existing)
- [x] Wire button gradient color ops → already wired in `buildButtonContext()` (pre-existing)
- [ ] Wire `buttonInputLoop`, `initializeButtonState` → DEFER to Phase 7c — real event loop hangs
      with stub nextBrogueEvent (fake EventError never exits loop; requires real async event bridge)
- [x] Port `shuffleTerrainColors` → `src/render-state.ts` (ported from IO.c:966);
      wire into `turn.ts` + `lifecycle.ts`; activated 1 test.skip entry
- [x] Implement `printSeed` → `io/input-context.ts:424` calls `buildMessageFns().message(...)`;
      activated 1 test.skip entry
- [ ] Wire `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText` —
      DEFER: complex contexts; waitForAcknowledgment loops on nextBrogueEvent (would hang with stub)
- [x] All files under 600 lines; tests pass (87 files, 2200 pass, 103 skip)
- [x] Commit; generate handoff

---

## Phase 7b: Screen ports ✓ DONE

*Port help, feats, and discoveries overlay screens.*
*After this sub-phase: `?` key shows help, feats screen accessible, discoveries list works.*

- [x] Port `printHelpScreen` from `IO.c` — implemented in `io/overlay-screens.ts`;
      builds 33-line help text with encodeMessageColor escapes; overlays on displayBuffer;
      waitForAcknowledgment is stub (Phase 7c)
- [x] Port `displayFeatsScreen` from `IO.c` — implemented in `io/overlay-screens.ts`;
      uses `featCatalog` (new `globals/feat-catalog.ts`); `featTable: []` → `featCatalog` in lifecycle.ts
- [x] Port `printDiscoveriesScreen` from `IO.c` — implemented in `io/overlay-screens.ts`;
      includes `printDiscoveries()` helper for each item category; uses mutable scroll/potion tables
      and readonly ring/staff/wand tables; waitForKeystrokeOrMouseClick is stub (Phase 7c)
- [x] Activated 3 test.skip entries in ui.test.ts (lines 410–429)
- [x] All files under 600 lines; tests pass (87 files, 2203 pass, 100 skip)
- [x] Commit; generate handoff

---

## Phase 7c: Inventory dialogs + test cleanup ✓ DONE (e509782)

*Wire all inventory action dialogs (equip, unequip, drop, throw, relabel, call).*
*After this sub-phase: full inventory interaction works.*

- [x] Wire `buttonInputLoop` in `buildInventoryContext()` (`ui.ts`) and `buildInputContext()`
      (`io/input-context.ts`) to real `buttonInputLoopFn`; `buildButtonContext().nextBrogueEvent`
      now calls `waitForEvent()` with escape-key fallback so loops terminate cleanly in tests
- [ ] Wire `waitForAcknowledgment` into `buildMessageContext()` — DEFER to Phase 8;
      requires async cascade through `messages.ts`
- [x] Wire `waitForKeystrokeOrMouseClick` in `overlay-screens.ts` — implemented as optional
      `waitFn?: () => Promise<void>` parameter on all three overlay functions; callers pass
      `overlayWaitFn` (tries `waitForEvent()`, no-op fallback in tests)
- [ ] Wire `flashTemporaryAlert` into `buildMessageContext()` — DEFER to Phase 8;
      requires `EffectsContext` (getCellAppearance, hiliteCell, pauseAnimation, etc.)
- [ ] Wire `updateFlavorText` — DEFER to Phase 8; needs `CreatureEffectsContext`
- [x] Wire inventory dialogs — `equip`, `unequip`, `drop`, `relabel` ported in new
      `io/inventory-actions.ts` (Items.c:3232/7500/7548/6385); `throw` and `call` DEFER
      to Phase 8 (need `chooseTarget` and `getInputTextString` respectively);
      also fixed pre-existing bug: `syncEquipState()` added to `items/equip-helpers.ts`
      to sync weapon/armor/ring refs back to rogue (previously only ring bonuses synced)
- [x] Remove or activate test.skip entries now unblocked (3 activated)
- [x] All files under 600 lines; tests pass (87 files, 2206 pass, 97 skip)
- [x] Commit; generate handoff

---

## Phase 8: Browser smoke test + bug fixes (iterating — in progress)

*Bug tracker and per-session details live in `SESSIONS.md`. Read that first.*

---

### Session protocol — REQUIRED for every session in this phase

1. **Read `SESSIONS.md` first** — scan the Bug Tracker table, then read the last session entry.
2. **Pick the highest-priority open bug** — work on at most 1–2 bugs per session.
3. **Stop at ~60% context window usage** — do not push on; partial progress is fine.
4. **Before ending:** update `SESSIONS.md` (mark fixed bugs, add any new bugs found from playtest).
5. **Commit all changes** — `npm run build` must be clean; tests must not regress.
6. **Generate a handoff prompt** referencing `TASKS.md`, `SESSIONS.md`, and the latest commit hash.

---

### Verified working

- [x] Build clean — `npm run build` exits clean (a54ed43)
- [x] Launch — title screen loads; new game starts
- [x] Stair descent — `startLevel` + `useStairs` wired (cfdbde1); no confirm prompt (`() => true`) but descent works
- [x] Travel / auto-explore — `exploreKey` + `autoPlayLevel` wired (9081a89); per-step animation works (a54151a)
- [x] Help screen (`?`) — overlay visible, no ghost-after-dismiss (51e1631, 6ab58e4)
- [x] Discoveries screen (`D`) — overlay works
- [x] Inventory dialog — `i`/`e` opens inventory; item detail panel with action buttons (ea7467e)
- [x] Death/victory screen — shows text + waits for keypress on game end (4caf6aa); untested in browser (blocked by B2)
- [x] Monsters spawn — `randomMatchingLocation` + `passableArcCount` wired (eee9a74); spawn locations correct (a80213f)
- [x] Monsters move and hunt player — `currentStealthRange` fixed (a80213f)
- [x] Combat messages — `displayCombatText` wired (a80213f)

### Still to verify (see SESSIONS.md bug tracker for open bugs)

- [ ] Vegetation visible on dungeon floors (B1)
- [ ] Monsters hit player back; player can die; death screen shown (B2 — HIGH)
- [ ] Potion/scroll appearances randomized; pickup message shows item name (B3, B4)
- [ ] `--MORE--` prompt blocks until keypress (`waitForAcknowledgment` still deferred)
- [ ] Win/die full loop — death screen added but untested (blocked by B2)

### Known deferred (acceptable stubs for this initiative — do not fix)

- `waitForAcknowledgment` — `--MORE--` never blocks; needs async cascade through `messages.ts`
- `flashTemporaryAlert` — no temporary overlays; needs EffectsContext
- `updateFlavorText` — flavor text line blank; needs CreatureEffectsContext
- `throwCommand` / throw dialog — shows "Throwing not yet implemented."; needs `chooseTarget`
- `call` / inscribe dialog — needs `getInputTextString`
- `confirm: () => true` — stair descent has no prompt
- `attackVerb: () => "hits"` — all attacks say "hits"; cosmetic
- `anyoneWantABite` — stub `() => false`; needs full CombatHelperContext
- `wakeUp` upgrade in `buildWakeUpFn` — partial impl; needs full MonsterStateContext
- `applyInstantTileEffectsToCreature` — player/monster cannot fall into chasms (B5)
- `printCarriedItemDetails` item description — shows name only, not full stats; `itemDetails()` stub


## Phase 9: Final stub cleanup

*Convert or close all remaining test.skip entries.*

May spill to a second session if skip count is high.

- [ ] Run `npx vitest run` — record final skip count
- [ ] For each test.skip: is the function now implemented?
      - If yes and testable: activate the test
      - If yes but requires IO mocks: update description to reflect current state
      - If deliberately deferred (persistence): add "DEFER: port-v2-persistence" note
- [ ] Update `MEMORY.md` — note initiative complete, final test counts
- [ ] Update `PROJECT.md` — mark `port-v2-playtest` complete; set next as `port-v2-persistence`
- [ ] Commit final cleanup
- [ ] Generate closing handoff prompt

---

## Deferred (permanent — no further action needed)

- `updateMonsterCorpseAbsorption` — stub in `monster-actions.ts` is a functional no-op; the C
  implementation is equivalent in all cases exercised during normal play; no port needed
- `drawManacles` — visual-only rendering call; has no gameplay effect; stub is permanently acceptable
- `initializeButtonState` in `InputContext` — the C signature mutates a passed-in state struct;
  the TS domain function (`io/buttons.ts:269`) returns a new `ButtonState` instead;
  `buttonInputLoop` calls the domain function directly so this context slot is never needed;
  stub `() => {}` is permanently acceptable

---

## Deferred (port-v2-persistence initiative)

Do not touch in this initiative:
- saveGame, saveGameNoPrompt, loadSavedGame — `.broguesave` files
- saveRecording, saveRecordingNoPrompt, flushBufferToFile, initRecording — `.broguerec`
- pausePlayback, executeEvent, recallEvent, executePlaybackInput — playback system
- RNGCheck, displayAnnotation — playback verification
- restoreItems, restoreMonster — level revisit
- listFiles, loadRunHistory, saveResetRun, getAvailableFilePath — file browser UI
- characterForbiddenInFilename, openFile — file system ops
- recordKeystroke, recordKeystrokeSequence, recordMouseClick, cancelKeystroke — input recording
