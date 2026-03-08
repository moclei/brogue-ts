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

## Phase 2b: Input context + test cleanup

*Wire autoRest/manualSearch/dijkstraScan; activate unblocked skipped tests.*
*After this sub-phase: player can auto-rest, search, pathfinding infrastructure live.*

- [ ] Wire `autoRest`, `manualSearch` → audit `src/time/misc-helpers.ts`; wire into `io/input-context.ts`
- [ ] Wire `dijkstraScan` → `src/dijkstra/dijkstra.ts` → `io/input-context.ts`
- [ ] Remove or activate test.skip entries now unblocked (turn.test.ts, monsters.test.ts)
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 3a: Domain functions + movement restructure

*Port and wire movement-adjacent domain functions; restructure oversized files.*
*After this sub-phase: pickUpItemAt, promoteTile, useKeyAt, getQualifyingPathLocNear ported.*

Note: `time/environment.ts` is 609 lines — split it when first touched here.

- [ ] Audit `src/movement/` for `pickUpItemAt`, `checkForMissingKeys`, `useKeyAt` — port from
      `Items.c`/`Movement.c` if missing
- [ ] Wire `promoteTile` → `src/time/environment.ts` → `movement.ts`
      (split `environment.ts` to stay under 600 lines if it is touched)
- [ ] Wire `useKeyAt` → `src/movement/item-helpers.ts` → `movement.ts`
- [ ] Wire `getQualifyingPathLocNear` → `src/dijkstra/` or `src/architect/` → `movement.ts`
- [ ] Wire `updatePlayerUnderwaterness` → check `src/movement/` or `src/time/`
- [ ] Mark `recordKeystroke`, `cancelKeystroke` as permanent DEFER no-ops (recordings layer); add note
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 3b: Platform wiring + test cleanup

*Wire async travel helpers, cursor/path display, and input keystrokes into movement.ts.*
*After this sub-phase: cursor path shows, travel mode responds to input events.*

- [ ] Wire `nextBrogueEvent`, `pauseAnimation` → `src/io/input-keystrokes.ts` → `movement.ts` travel context
- [ ] Wire `confirm` (async) → `src/io/input-dispatch.ts` → `movement.ts`, `items.ts` non-targeting contexts
- [ ] Wire `hilitePath`, `clearCursorPath`, `hiliteCell` → `src/io/` → `movement.ts`, `io/input-context.ts`
- [ ] Wire `plotForegroundChar` → `src/io/display.ts` → `movement.ts` (trivial if plotCharWithColor)
- [ ] Wire `waitForAcknowledgment`, `flashTemporaryAlert`, `updateFlavorText` → `src/io/` → relevant contexts
- [ ] Remove or activate test.skip entries now unblocked (movement.test.ts)
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

## Phase 5a: Equipment lifecycle wiring

*Wire updateEncumbrance, updateRingBonuses, and equipItem into context builders.*
*After this sub-phase: encumbrance correct, ring bonuses applied, equip/unequip wired.*

Note: `items/item-usage.ts` is 608 lines — split it when first touched here.

- [ ] Wire `updateEncumbrance` → `src/items/item-usage.ts` → `movement.ts`, `items.ts`, `combat.ts`
      (split `item-usage.ts` to stay under 600 lines when touched)
- [ ] Wire `updateRingBonuses` → `src/items/item-usage.ts` → `lifecycle.ts`, `items.ts`
- [ ] Wire `equipItem` → `src/items/item-usage.ts` → `combat.ts`, `items.ts`
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 5b: Item floor effects + creature fire

*Wire floor-item lifecycle, drop path, and fire exposure.*
*After this sub-phase: item auto-descent, fire/lava burn, drift, and terrain promote work.*

- [ ] Wire `exposeCreatureToFire` → `src/time/creature-effects.ts` → `items.ts`
- [ ] Wire `dropItem` full path → `src/items/floor-items.ts` → `turn.ts` `playerFalls` context
- [ ] Wire `placeItemAt` in machine context → `lifecycle.ts:362`; wire `src/items/floor-items.ts`
- [ ] Complete `updateFloorItems` subtasks: auto-descent, fire/lava burn, drift, terrain promote
      (check which branches are missing in `src/items/floor-items.ts`)
- [ ] Port `swapLastEquipment` from `Items.c`; wire into `items.ts`, `io/input-context.ts`
- [ ] Remove or activate test.skip entries now unblocked (items.test.ts, floor-items.test.ts)
- [ ] All files under 600 lines; tests pass
- [ ] Commit; generate handoff

---

## Phase 5c: Inventory dialog port

*Port promptForItemOfType — modal inventory chooser dialog.*
*After this sub-phase: inventory selection dialogs functional.*

Note: depends on Phase 7a button infrastructure; if buttons are not yet wired, defer to after 7a.

- [ ] Port `promptForItemOfType` from `Items.c` — modal inventory chooser dialog;
      check if `buttonInputLoop` (Phase 7a) is required; note dependency
- [ ] Remove or activate test.skip entries now unblocked
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

## Phase 7a: Pure display wiring

*Wire text utilities, button infrastructure, shuffleTerrainColors, and printSeed.*
*After this sub-phase: button rendering works, terrain colors animate, seed displayable.*

- [ ] Wire `strLenWithoutEscapes` → `src/io/text.ts` → ButtonContext in `ui.ts`
- [ ] Wire button gradient color ops → `src/io/color.ts` → ButtonContext in `ui.ts`
- [ ] Wire `buttonInputLoop`, `initializeButtonState` → `src/io/buttons.ts` → `ui.ts`, `io/input-context.ts`
- [ ] Wire `shuffleTerrainColors` → `src/time/` or `src/light/`
- [ ] Implement `printSeed` — display rogue.seed on screen (trivial)
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
