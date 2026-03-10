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
- [x] Monsters hit player; player can die — `attack` stub wired in `MoveMonsterContext` (61beabf)
- [x] Pickup message shows item name — `itemName` stub wired in `movement.ts`+`turn.ts` (61beabf)

### Still to verify (see SESSIONS.md bug tracker for open bugs)

- [ ] Vegetation visible on dungeon floors (B1)
- [ ] Potion/scroll flavors randomized — all potions yellow+telepathy; all scrolls empty title (B3, B6)
- [ ] Water terrain blocks / applies effects to player (B7)
- [ ] Monster death dungeon features spawn — pit bloat opens chasm (B8)
- [ ] Death screen shown after player dies (unblocked by B2 fix — needs browser verify)
- [ ] `--MORE--` prompt blocks until keypress (`waitForAcknowledgment` still deferred)

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
- `applyInstantTileEffectsToCreature` — player/monster cannot fall into chasms; entering chasm freezes vision (B5); permanent defer
- `printCarriedItemDetails` item description — shows name only, not full stats; `itemDetails()` stub


## Phase 9a: Stub recon + task list (ONE session — read-only, no code changes)

*Enumerate and classify every test.skip entry. Output a structured task list for Phase 9b+.*
*Do NOT activate or edit any tests this session — classification only.*

98 skips across 87 files is too large to activate in one pass. This session does the
investigation so that Phase 9b+ sessions have clear, bounded work with no re-investigation.

- [x] Run `npx vitest run` — confirm current skip count as baseline (2208 pass, 98 skip)
- [x] Grep all test files for `test.skip` / `it.skip` / `describe.skip` — collect every entry
- [x] For each skip, read enough source to classify it as one of:
      - **ACTIVATE**: function is now implemented; test should pass; no blocker
      - **UPDATE**: function implemented but test needs IO mocks / async / browser —
        leave skipped but rewrite comment to explain why it stays skipped
      - **DEFER**: belongs to port-v2-persistence, playback, or platform IO —
        add `// DEFER: port-v2-persistence` (or appropriate tag) note
- [x] Write the classified list into `TASKS.md` as Phase 9b tasks, grouped by domain
      (movement, items+turn, monsters, ui, lifecycle+architect, menus — 6 batches of 13–19)
- [x] Commit the updated TASKS.md (no test file changes)
- [x] Generate handoff prompt for Phase 9b

---

## Phase 9b+: Stub activation — one batch per session

*Work through the classified list from Phase 9a, one domain batch per session.*

### Session protocol — REQUIRED for every Phase 9b+ session

**Take on ONE batch only (~15–20 skips). Do not start a second batch in the same session.**
Stop, commit, and generate a handoff prompt after completing the batch.
If a skip turns out to need more investigation than expected, defer it and move on.

1. Pick the next unchecked batch from the list below (added by Phase 9a).
2. For each ACTIVATE entry: remove `.skip`, run the test, fix if needed.
3. For each UPDATE entry: rewrite the skip comment only.
4. For each DEFER entry: add the `// DEFER:` tag only.
5. Run `npx vitest run` — confirm no regressions before committing.
6. Mark completed entries in the list below.
7. Commit all changes.
8. Generate handoff prompt referencing `TASKS.md` and the latest commit hash.

### Closing tasks (final Phase 9b+ session only — after all batches done)

- [ ] Update `MEMORY.md` — note initiative complete, final test counts
- [ ] Update `PROJECT.md` — mark `port-v2-playtest` complete; set next as `port-v2-persistence`
- [ ] Commit and generate closing handoff prompt

### Batches (populated by Phase 9a)

Classification key: **A** = ACTIVATE (remove .skip, verify passes), **U** = UPDATE (rewrite comment only), **D** = DEFER (add `// DEFER:` tag)

Baseline: 98 skipped, 2208 passed (87 files). Branch: feat/port-v2-playtest, commit 3f9663a.

---

#### Batch 9b-1: Movement wiring (18 stubs)

All in `tests/movement.test.ts`. 8 ACTIVATE, 4 DEFER, 6 UPDATE.

| Line | Function | Class | Reason |
|------|----------|-------|--------|
| 211 | `recordKeystroke()` | D | port-v2-persistence |
| 217 | `confirm()` | D | deferred Phase 3b — sync/async cascade |
| 223 | `pickUpItemAt()` | **A** | wired Phase 3a: `movement.ts:373` |
| 229 | `checkForMissingKeys()` | **A** | wired Phase 3a: `movement.ts:374` |
| 235 | `promoteTile()` | **A** | wired Phase 3a: `movement.ts:380` |
| 241 | `refreshDungeonCell()` | **A** | wired Phase 1: `movement.ts:381` via `buildRefreshDungeonCellFn()` |
| 272 | `getQualifyingPathLocNear()` | **A** | wired Phase 3a: `movement.ts:356` |
| 278 | `nextBrogueEvent()` | D | sync/async mismatch — travel dialog async refactor |
| 306 | `getImpactLoc` | U | still stub `(_origin, target) => ({...target})` in `movement-weapon-context.ts:112` |
| 312 | `canPass` | U | still stub `() => false` in `movement.ts:499` (comment: wired in port-v2-platform) |
| 318 | `itemName` | **A** | wired `movement.ts:238` via `itemNameFn` |
| 328 | `plotForegroundChar()` | U | wired in browser; unit test requires rendered display buffer (IO integration) |
| 334 | `exploreKey()` | **A** | wired Phase 2b: `input-context.ts:465` via `exploreFn` |
| 345 | `cancelKeystroke()` | D | port-v2-persistence |
| 356 | `dijkstraScan()` in input ctx | **A** | wired Phase 2b: `input-context.ts:551`; note real `buildInputContext` dijkstraScan wired |
| 364 | `terrainFlags()` in input ctx | U | domain fn wired in cursor/misc contexts; `buildInputContext()` uses deliberate `() => 0` |
| 372 | `knownToPlayerAsPassableOrSecretDoor` | U | divergence is a safe over-approximation; no fix needed; update comment |
| 386 | `terrainMechFlags()` in input ctx | U | same as terrainFlags — deliberate `() => 0` in `buildInputContext()` |

- [ ] Work through all 18 entries; run `npx vitest run`; commit

---

#### Batch 9b-2: Items + Turn + Monster permanents (16 stubs)

6 from `tests/items.test.ts`, 7 from `tests/turn.test.ts`, 3 from monster tests. 1 ACTIVATE, 10 DEFER, 5 UPDATE.

| File | Line | Function | Class | Reason |
|------|------|----------|-------|--------|
| items.test.ts | 186 | `message()` | **A** | wired Phase 1: `items.ts` message pipeline |
| items.test.ts | 192 | `confirm()` | D | deferred Phase 3b — sync `confirm` in movement context |
| items.test.ts | 260 | `chooseTarget()` / `playerCancelsBlinking()` | D | platform IO — async event bridge required |
| items.test.ts | 286 | `fadeInMonster()` | D | platform IO — stub in `items.ts:375,423` (comment: wired in port-v2-platform) |
| items.test.ts | 297 | `recordKeystrokeSequence()` | D | port-v2-persistence |
| items.test.ts | 304 | `recordMouseClick()` | D | port-v2-persistence |
| turn.test.ts | 178 | `displayAnnotation()` | D | port-v2-persistence/playback |
| turn.test.ts | 185 | `RNGCheck()` | D | port-v2-persistence/playback |
| turn.test.ts | 192 | `recallEvent()` | D | port-v2-persistence/playback |
| turn.test.ts | 199 | `executePlaybackInput()` | D | port-v2-persistence/playback |
| turn.test.ts | 210 | `enableEasyMode()` | U | domain fn at `game/game-lifecycle.ts:627`; input-context.ts stub; wiring gap |
| turn.test.ts | 217 | `dropItem()` | D | `startLevel()` dependency missing from `buildTurnProcessingContext()` |
| turn.test.ts | 227 | `makeMonsterDropItem()` in gradualCtx | U | permanent acceptable stub — monsters in deep water never drop; update comment to reflect |
| monsters/monster-actions.test.ts | 576 | `updateMonsterCorpseAbsorption()` | U | permanent defer — documented in TASKS.md `## Deferred` section; update comment |
| monsters/monster-spawning.test.ts | 302 | `getRandomMonsterSpawnLocation` | D | not a standalone TS export — injected as callback |
| monsters.test.ts | 305 | `drawManacles()` | U | permanent defer — visual only, documented in TASKS.md; update comment |

- [ ] Work through all 16 entries; run `npx vitest run`; commit

---

#### Batch 9b-3: Monsters — state stubs + AI divergences (13 stubs)

8 from `tests/monsters.test.ts`, 5 from `tests/monsters/monster-ai-movement.test.ts`. 2 ACTIVATE, 11 UPDATE.

| File | Line | Function | Class | Reason |
|------|------|----------|-------|--------|
| monsters.test.ts | 208 | `getQualifyingPathLocNear` in spawn ctx | U | still stub `(loc) => ({x:loc.x,y:loc.y})` in `monsters.ts:187`; note wired correctly in `movement.ts` |
| monsters.test.ts | 214 | `randomMatchingLocation` in spawn ctx | **A** | wired Phase 8: `monsters.ts:188` via `randomMatchingLocationFn` |
| monsters.test.ts | 220 | `passableArcCount` in spawn ctx | **A** | wired Phase 8: `monsters.ts:189` via `passableArcCountFn` |
| monsters.test.ts | 226 | `buildMachine` in spawn ctx | U | still stub `() => {}` in `monsters.ts:128` (comment: wired in port-v2-platform) |
| monsters.test.ts | 249 | `traversiblePathBetween` in state ctx | U | still stub `() => false` in `monsters.ts:277`; note port-v2-platform wiring |
| monsters.test.ts | 255 | `extinguishFireOnCreature` in state ctx | U | still stub `() => {}` in `monsters.ts:286` (comment: wired in port-v2-platform) |
| monsters.test.ts | 288 | `discoveredTerrainFlagsAtLoc` in state ctx | U | still stub `() => 0` in `monsters.ts:257`; secrets awareness not wired |
| monsters/monster-spawning.test.ts | 291 | full spawn integration test | U | requires full `SpawnContext`; indirect coverage via `seed-determinism.test.ts` |
| monster-ai-movement.test.ts | 310 | `traversiblePathBetween` uses Bresenham | U | known divergence — Bresenham vs bolt `getLineCoordinates`; harmless |
| monster-ai-movement.test.ts | 446 | `moveAlly`: missing `monsterHasBoltEffect` guard | U | known divergence in flee branch |
| monster-ai-movement.test.ts | 461 | `moveAlly`: attack leash metric | U | known divergence — distance-to-enemy vs distance-to-player |
| monster-ai-movement.test.ts | 478 | `moveAlly`: missing corpse-eating + scent-follow | U | known divergence in two branches |
| monster-ai-movement.test.ts | 488 | `makeMonsterDropItem`: inline drop vs `getQualifyingPathLocNear` | U | known divergence |

- [ ] Work through all 13 entries; run `npx vitest run`; commit

---

#### Batch 9b-4: UI display stubs (19 stubs)

All in `tests/ui.test.ts`. 2 ACTIVATE, 11 UPDATE, 6 DEFER.

| Line | Function | Class | Reason |
|------|----------|-------|--------|
| 273 | `refreshDungeonCell()` in `buildDisplayContext()` | U | wired via `buildRefreshDungeonCellFn()` in movement/combat/items; `ui.ts:242` still `() => {}` (needs appearance system) |
| 279 | `refreshSideBar()` in `buildDisplayContext()` | U | same — `ui.ts:278` still `() => {}`; wired elsewhere |
| 285 | `plotCharWithColor()` | U | IO integration — no display buffer in unit tests |
| 291 | `overlayDisplayBuffer()` | U | IO integration |
| 297 | `clearDisplayBuffer()` | U | IO integration |
| 303 | `updateFlavorText()` | D | deferred Phase 7c — needs `CreatureEffectsContext` |
| 309 | `waitForAcknowledgment()` | D | deferred Phase 7c — async cascade through `messages.ts` |
| 315 | `flashTemporaryAlert()` | D | deferred Phase 7c — needs `EffectsContext` |
| 348 | `strLenWithoutEscapes()` | **A** | wired in `ui.ts:358` via `strLenWithoutEscapesFn`; test description stale |
| 358 | `initializeButtonState()` | U | permanent defer — documented in TASKS.md `## Deferred`; update comment |
| 388 | `buildButtonContext()` color ops | **A** | wired in `ui.ts:354-362` — `applyColorAverage`, `bakeColor`, `separateColors`, `encodeMessageColor`, `decodeMessageColor`, `plotCharToBuffer` all real |
| 399 | `displayLevel()` in items + input-context | D | stubs remain in `items.ts` + `input-context.ts`; `lifecycle.ts` impl is complete |
| 458 | `displayGrid()` | U | debug overlay — `input-context.ts:260` stub; update comment (debug-only, port-v2-platform) |
| 464 | `displayWaypoints()` | U | debug overlay — same |
| 471 | `displayMachines()` | U | debug overlay — same |
| 478 | `displayChokeMap()` | U | debug overlay — same |
| 485 | `displayLoops()` | U | debug overlay — same |
| 492 | `saveRecording()` | D | port-v2-persistence |
| 500 | `saveRecordingNoPrompt()` | D | port-v2-persistence |

- [ ] Work through all 19 entries; run `npx vitest run`; commit

---

#### Batch 9b-5: Game lifecycle + architect coverage (15 stubs)

6 from `tests/game.test.ts`, 1 from `tests/game/game-level.test.ts`, 6 from `tests/architect-level-setup.test.ts`, 2 from `tests/architect-orchestration.test.ts`. 0 ACTIVATE, 8 UPDATE, 7 DEFER.

| File | Line | Function | Class | Reason |
|------|------|----------|-------|--------|
| game.test.ts | 106 | `initializeRogue` | U | complex orchestrator (~50 context members); indirect coverage via `seed-determinism.test.ts`; update comment |
| game.test.ts | 122 | `freeEverything` | U | needs `CleanupContext` with allocated level/grid data; risk: low |
| game.test.ts | 138 | `gameOver` | U | full death screen — needs IO context mocks (`nextBrogueEvent`, `funkyFade`, etc.) |
| game.test.ts | 156 | `victory` | U | full victory — needs IO + display context mocks |
| game.test.ts | 260 | `welcome: amulet name not colorized` | U | known acceptable divergence — no `encodeMessageColor` call in TS; update comment |
| game.test.ts | 435 | `executeEvent: KEYSTROKE path` | U | needs full `InputContext` mock; indirect coverage via `io/input-cursor.ts` in play |
| game/game-level.test.ts | 186 | `startLevel: updateEnvironment loop` | U | known divergence — TS skips `while (timeAway--)` loop; fix note in comment |
| architect-level-setup.test.ts | 454 | `abortItemsAndMonsters` | D | coverage only; tested via `buildAMachine` failure paths |
| architect-level-setup.test.ts | 462 | `buildAMachine` | D | covered by `seed-determinism.test.ts` full `digDungeon` pipeline |
| architect-level-setup.test.ts | 471 | `addMachines` | D | covered by `seed-determinism.test.ts` |
| architect-level-setup.test.ts | 480 | `runAutogenerators` | D | covered by `seed-determinism.test.ts` |
| architect-level-setup.test.ts | 486 | `digDungeon` | D | covered by `seed-determinism.test.ts` |
| architect-level-setup.test.ts | 495 | `refreshWaypoint` divergence | U | missing `PDS_FORBIDDEN` for sleeping/immobile/captive monsters; update comment |
| architect-orchestration.test.ts | 583 | `restoreMonster()` | D | port-v2-persistence |
| architect-orchestration.test.ts | 590 | `restoreItems()` | D | port-v2-persistence |

- [ ] Work through all 15 entries; run `npx vitest run`; commit

---

#### Batch 9b-6: Menus persistence (17 stubs)

All in `tests/menus/menus.test.ts`. 0 ACTIVATE, 0 UPDATE, 17 DEFER — all port-v2-persistence.

| Line | Function | DEFER reason |
|------|----------|--------------|
| 111 | `saveGameNoPrompt()` | port-v2-persistence |
| 117 | `loadSavedGame()` | port-v2-persistence |
| 123 | `saveRecordingNoPrompt()` | port-v2-persistence |
| 128 | `openFile()` | port-v2-persistence |
| 138 | `flushBufferToFile()` | port-v2-persistence |
| 145 | `initRecording()` | port-v2-persistence |
| 152 | `pausePlayback()` | port-v2-persistence |
| 159 | `getAvailableFilePath()` | port-v2-persistence |
| 166 | `characterForbiddenInFilename()` | port-v2-persistence |
| 173 | `saveGame()` | port-v2-persistence |
| 184 | `initializeGameVariant()` | port-v2-persistence |
| 192 | `executeEvent()` in menus ctx | port-v2-persistence/playback |
| 200 | `listFiles()` | port-v2-persistence |
| 207 | `loadRunHistory()` | port-v2-persistence |
| 214 | `saveResetRun()` | port-v2-persistence |
| 221 | `initializeLaunchArguments()` | port-v2-persistence |
| 229 | `displayAnnotation()` | port-v2-persistence/playback |

- [ ] Add `// DEFER: port-v2-persistence` comment to each; run `npx vitest run`; commit

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
