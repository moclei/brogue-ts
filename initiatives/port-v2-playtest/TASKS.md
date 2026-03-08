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

## Phase 7a: Pure display wiring

*Wire text utilities, button infrastructure, shuffleTerrainColors, and printSeed.*
*After this sub-phase: button rendering works, terrain colors animate, seed displayable.*

- [ ] Wire `message`, `confirmMessages` into `buildInventoryContext()` in `ui.ts` —
      currently `() => {}` stubs; use `buildMessageFns()` from `io-wiring.ts`
      (needed so "Your pack is empty!" and error messages display through the inventory context)
- [ ] Wire `strLenWithoutEscapes` → `src/io/text.ts` → ButtonContext in `ui.ts`
- [ ] Wire button gradient color ops → `src/io/color.ts` → ButtonContext in `ui.ts`
- [ ] Wire `buttonInputLoop`, `initializeButtonState` → `src/io/buttons.ts` → `ui.ts`, `io/input-context.ts`
- [ ] Wire `shuffleTerrainColors` → `src/time/` or `src/light/`
- [ ] Implement `printSeed` — display rogue.seed on screen (trivial)
- [ ] Wire `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText` →
      check `src/io/`; deferred from Phase 3b due to circular dep via `ui.ts`; resolve circular
      dep first, then wire into display/lifecycle contexts
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 7b: Screen ports

*Port help, feats, and discoveries overlay screens.*
*After this sub-phase: `?` key shows help, feats screen accessible, discoveries list works.*

- [ ] Port `printHelpScreen` from `IO.c` — help overlay text display
- [ ] Port `displayFeatsScreen` from `IO.c/MainMenu.c` — feats/achievement list
- [ ] Port `printDiscoveriesScreen` from `IO.c` — item discoveries list
- [ ] Remove or activate test.skip entries now unblocked
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 7c: Inventory dialogs + test cleanup

*Wire all inventory action dialogs (equip, unequip, drop, throw, relabel, call).*
*After this sub-phase: full inventory interaction works.*

- [ ] Wire inventory dialogs (equip, unequip, drop, throw, relabel, call) —
      port each from `Items.c`; these are in `io/input-context.ts:202-207` and `ui.ts:315-321`
- [ ] Remove or activate test.skip entries now unblocked
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 8: Browser smoke test + bug fixes

*Full interactive playtest in the browser. Fix everything that breaks.*

This phase is inherently multi-session. Each session = build + playtest + fix 1–3 bugs.
Stop and commit after each bug-fix batch; generate a handoff listing what was fixed and what is next.

- [ ] Wire `dropItem`/`playerFalls` — deferred from Phase 5b; requires `startLevel()` in
      `buildTurnProcessingContext()`; implement after stair descent is verified in playtest
- [ ] Fix `nextBrogueEvent` in travel context — sync/async mismatch deferred from Phase 3b;
      requires async refactor of travel confirm dialog in `movement.ts`
- [ ] Fix `confirm` in `PlayerMoveContext` — currently sync stub; needs cascading async
      change in movement context; deferred from Phase 3b
- [ ] Build the TS bundle: `npm run build` (or equivalent)
- [ ] Serve locally: navigate to the game in a browser
- [ ] New game: verify dungeon renders, player visible, sidebar shows stats
- [ ] Movement: walk around; verify cell updates, flavor text, messages
- [ ] Combat: fight a monster; verify combat messages, death, item drop
- [ ] Items: pick up, equip, unequip, use a scroll/potion; verify effects + messages
- [ ] Stairs: descend; verify new level generates and renders
- [ ] Help screen: press `?`; verify overlay shows
- [ ] Win/die: complete the game loop; verify game-over or victory screen
- [ ] For each failure: fix, add regression test, commit; generate handoff with remaining failures

---

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
