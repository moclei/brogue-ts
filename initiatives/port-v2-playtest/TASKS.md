# TASKS: port-v2-playtest

Each sub-phase is one session's work. Commit and generate a handoff prompt after each.

Starting state: 87 files, 2171 pass, 141 skip
Branch: feat/port-v2-playtest

---

## Phase 1: IO + Message wiring

*Wire message system and core display callbacks into all context builders.*
*After this phase: player sees messages, cells redraw on change, sidebar updates.*

- [ ] Audit `src/io/messages.ts` — confirm exports: `message`, `messageWithColor`,
      `temporaryMessage`, `confirmMessages`, `updateMessageDisplay`
- [ ] Audit `src/io/cell-appearance.ts` — confirm `refreshDungeonCellFn` export shape
- [ ] Audit `src/io/` for `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText`
- [ ] Wire message functions into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `lifecycle.ts`
- [ ] Wire `refreshDungeonCell` into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `monsters.ts`
- [ ] Wire `refreshSideBar` into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `lifecycle.ts`
- [ ] Wire `confirm` (async) into: `movement.ts`, `items.ts` non-targeting contexts
- [ ] Wire `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText` into `ui.ts`, `lifecycle.ts`
- [ ] Remove or activate test.skip entries now unblocked
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 2: Turn AI wiring

*Wire monster movement AI and turn helpers into turn.ts context builders.*
*After this phase: monsters move, use scent, path toward player.*

- [ ] Audit `src/monsters/monster-actions.ts` — confirm exports:
      `scentDirection`, `pathTowardCreature`, `wanderToward`, `moveAlly`, `monsterMillAbout`,
      `isLocalScentMaximum`, `monsterWillAttackTarget`, `chooseNewWanderDestination`, `isValidWanderDestination`
- [ ] Audit `src/monsters/monster-ai-movement.ts` — confirm `moveMonster` export
- [ ] Audit `src/monsters/monster-state.ts` — confirm `updateMonsterState`, `wakeUp` exports
- [ ] Audit `src/time/` for `updateScent`; port if missing
- [ ] Wire all monster AI functions into `turn.ts` `buildMonstersTurnContext`
- [ ] Wire `autoRest`, `manualSearch` → audit `src/time/misc-helpers.ts`; wire into `io/input-context.ts`
- [ ] Wire `dijkstraScan` → `src/dijkstra/dijkstra.ts` → `io/input-context.ts`
- [ ] Remove or activate test.skip entries now unblocked (turn.test.ts, monsters.test.ts)
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 3: Player action wiring

*Wire player movement helpers — item pickup, tile promotion, path display.*
*After this phase: player can pick up items, keys work, cursor path shows.*

- [ ] Audit `src/movement/` for `pickUpItemAt`, `checkForMissingKeys`, `useKeyAt` — port from
      `Items.c`/`Movement.c` if missing
- [ ] Wire `promoteTile` → `src/time/environment.ts` → `movement.ts`
- [ ] Wire `useKeyAt` → `src/movement/item-helpers.ts` → `movement.ts`
- [ ] Wire `getQualifyingPathLocNear` → `src/dijkstra/` or `src/architect/` → `movement.ts`
- [ ] Wire `nextBrogueEvent`, `pauseAnimation` → `src/io/input-keystrokes.ts` → `movement.ts` travel context
- [ ] Wire `hilitePath`, `clearCursorPath`, `hiliteCell` → `src/io/` → `movement.ts`, `io/input-context.ts`
- [ ] Wire `plotForegroundChar` → `src/io/display.ts` → `movement.ts` (trivial if it's just plotCharWithColor)
- [ ] Wire `updatePlayerUnderwaterness` → check `src/movement/` or `src/time/`
- [ ] Mark `recordKeystroke`, `cancelKeystroke` as permanent DEFER no-ops (recordings layer); add note
- [ ] Remove or activate test.skip entries now unblocked
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 4: Combat domain stubs

*Implement pronoun resolution and wire remaining combat helpers.*
*After this phase: correct combat messages, full combat resolution including leadership.*

- [ ] Port `resolvePronounEscapes` from `Combat.c` — substitute $HESHE/$OBJHE/etc. from
      `monsterText` table; wire into `combat.ts`, `turn.ts`, `items.ts`
- [ ] Port `getMonsterDFMessage` — DF catalog lookup for monster death message;
      wire into `combat.ts`, `turn.ts`
- [ ] Audit `src/monsters/` for `demoteMonsterFromLeadership`, `checkForContinuedLeadership`,
      `unAlly`, `anyoneWantABite`; wire into `combat.ts`, `turn.ts`
- [ ] Wire `wakeUp` fully into `combat.ts`, `items.ts` (not just turn.ts)
- [ ] Remove or activate test.skip entries now unblocked (combat.test.ts)
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 5: Items and equipment stubs

*Wire equipment lifecycle functions and port missing item operations.*
*After this phase: equip/unequip/drop fully works, rings apply bonuses, encumbrance correct.*

- [ ] Wire `updateEncumbrance` → `src/items/item-usage.ts` → `movement.ts`, `items.ts`, `combat.ts`
- [ ] Wire `updateRingBonuses` → `src/items/item-usage.ts` → `lifecycle.ts`, `items.ts`
- [ ] Wire `equipItem` → `src/items/item-usage.ts` → `combat.ts`, `items.ts`
- [ ] Wire `exposeCreatureToFire` → `src/time/creature-effects.ts` → `items.ts`
- [ ] Port `swapLastEquipment` from `Items.c`; wire into `items.ts`, `io/input-context.ts`
- [ ] Wire `dropItem` full path → `src/items/floor-items.ts` → `turn.ts` `playerFalls` context
- [ ] Wire `placeItemAt` in machine context → `lifecycle.ts:362`; wire `src/items/floor-items.ts`
- [ ] Complete `updateFloorItems` subtasks: auto-descent, fire/lava burn, drift, terrain promote
      (check which branches are missing in `src/items/floor-items.ts`)
- [ ] Port `promptForItemOfType` from `Items.c` — modal inventory chooser dialog
      (may block on Phase 7 UI being in place; note dependency)
- [ ] Remove or activate test.skip entries now unblocked (items.test.ts, floor-items.test.ts)
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 6: Monster capability stubs

*Wire waypoints, awareness, and remaining monster state into context builders.*
*After this phase: monsters use waypoints, can absorb corpses, awareness is accurate.*

- [ ] Port `closestWaypointIndex`, `closestWaypointIndexTo` from `Architect.c`;
      wire into `monsters.ts` buildMonsterStateContext
- [ ] Port `burnedTerrainFlagsAtLoc` from `Time.c`; wire into `monsters.ts`, `turn.ts`
- [ ] Wire `cellHasGas` → check `src/state/helpers.ts` for terrain flag check; wire into `monsters.ts`
- [ ] Wire `awareOfTarget` → implement creature awareness check (scent + sight);
      wire into `monsters.ts` buildMonsterStateContext
- [ ] Wire `openPathBetween` → `src/items/bolt-geometry.ts` → `monsters.ts`
- [ ] Wire `updateMonsterCorpseAbsorption` → `src/monsters/monster-actions.ts`
- [ ] Wire `monsterDetails` → `src/io/sidebar-monsters.ts` → SidebarContext
- [ ] Port `drawManacles` from `IO.c` (manacle decoration) or no-op with note
- [ ] Remove or activate test.skip entries now unblocked
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 7: Display screens + UI polish

*Port remaining display screens and wire inventory dialogs.*
*After this phase: help screen, discoveries, feats screen accessible; inventory dialogs work.*

- [ ] Wire `strLenWithoutEscapes` → `src/io/text.ts` → ButtonContext in `ui.ts`
- [ ] Wire button gradient color ops → `src/io/color.ts` → ButtonContext in `ui.ts`
- [ ] Wire `buttonInputLoop`, `initializeButtonState` → `src/io/buttons.ts` → `ui.ts`, `io/input-context.ts`
- [ ] Wire `shuffleTerrainColors` → `src/time/` or `src/light/`
- [ ] Port `printHelpScreen` from `IO.c` — help overlay text display
- [ ] Port `displayFeatsScreen` from `IO.c/MainMenu.c` — feats/achievement list
- [ ] Port `printDiscoveriesScreen` from `IO.c` — item discoveries list
- [ ] Implement `printSeed` — display rogue.seed on screen (trivial)
- [ ] Wire inventory dialogs (equip, unequip, drop, throw, relabel, call) —
      port each from `Items.c`; these are in `io/input-context.ts:202-207` and `ui.ts:315-321`
- [ ] Remove or activate test.skip entries now unblocked
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 8: Browser smoke test + bug fixes

*Full interactive playtest in the browser. Fix everything that breaks.*

- [ ] Build the TS bundle: `npm run build` (or equivalent)
- [ ] Serve locally: navigate to the game in a browser
- [ ] New game: verify dungeon renders, player visible, sidebar shows stats
- [ ] Movement: walk around; verify cell updates, flavor text, messages
- [ ] Combat: fight a monster; verify combat messages, death, item drop
- [ ] Items: pick up, equip, unequip, use a scroll/potion; verify effects + messages
- [ ] Stairs: descend; verify new level generates and renders
- [ ] Help screen: press `?`; verify overlay shows
- [ ] Win/die: complete the game loop; verify game-over or victory screen
- [ ] For each failure: fix, add regression test, continue
- [ ] Commit all bug fixes; generate handoff

---

## Phase 9: Final stub cleanup

*Convert or close all remaining test.skip entries.*

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
