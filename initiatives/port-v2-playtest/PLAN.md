# PLAN: port-v2-playtest

## Session Protocol

**One sub-phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked task.
2. Complete that task only. Do not continue into the next task.
3. Commit. Update TASKS.md (check off completed tasks).
4. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-playtest. Read: .context/PROJECT.md, initiatives/port-v2-playtest/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact task name from TASKS.md]
   Branch: feat/port-v2-playtest
   ```
   Add a `## Session Notes [date]` to PLAN.md only if there are decisions worth preserving.

Stop at 60% context. Do not start a new task to fill remaining context.

---

## Stub categories

All 141 test.skip entries fall into four categories (from pre-initiative audit):

| Category | Count | Approach |
|---|---|---|
| **WIRE** | 48 | Real impl exists in src/ — just add import + replace `() => {}` |
| **PORT** | 31 | Port from C source; add tests |
| **DEFER** | 35 | Persistence/recordings — do not touch in this initiative |
| **TRIVIAL** | 27 | One-liners; wire or make permanent no-ops with notes |

Persistence stubs (DEFER) must not be touched — they are tracked and intentionally deferred.

---

## Phase 1: IO + Message wiring

**Goal:** Player sees text. After this phase, messages display, cells redraw, sidebar updates.

All are WIRE (implementations exist):
- `message`, `messageWithColor`, `temporaryMessage`, `confirmMessages` → `src/io/messages.ts`
  Wire into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `lifecycle.ts`
- `refreshDungeonCell` → `src/io/cell-appearance.ts` (calls `refreshDungeonCellFn`)
  Wire into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `monsters.ts`
- `refreshSideBar` → `src/io/sidebar-monsters.ts`
  Wire into: `movement.ts`, `items.ts`, `combat.ts`, `turn.ts`, `lifecycle.ts`
- `confirm` → `src/io/input-dispatch.ts` (async)
  Wire into: `movement.ts`, `items.ts` (already async in targeting context)
- `waitForAcknowledgment` → `src/io/input-keystrokes.ts`
  Wire into: `ui.ts` (BuildDisplayContext)
- `flashTemporaryAlert` → `src/io/effects.ts` or IO layer
  Wire into: `ui.ts`, `lifecycle.ts`
- `updateFlavorText` → check `src/io/` for existing impl
  Wire into: `movement.ts`, `ui.ts`

**Approach:** Go context builder by context builder. For each: import the real function,
replace the `() => {}` stub, remove the paired test.skip if the test can now be activated.

---

## Phase 2: Turn AI wiring

**Goal:** Monsters move. After this phase, every monster runs its AI each turn.

All are WIRE:
- `updateMonsterState` → `src/monsters/monster-state.ts` → `turn.ts`
- `moveMonster` → `src/monsters/monster-ai-movement.ts` → `turn.ts`
- `scentDirection` → `src/monsters/monster-actions.ts` → `turn.ts`
- `pathTowardCreature` → `src/monsters/monster-actions.ts` → `turn.ts`
- `wanderToward`, `moveAlly`, `monsterMillAbout` → `src/monsters/monster-actions.ts` → `turn.ts`
- `updateScent` → `src/time/scent.ts` (check if exists) → `turn.ts`
- `isLocalScentMaximum` → monsters module → `turn.ts`
- `monsterWillAttackTarget` → check monsters module → `turn.ts`
- `chooseNewWanderDestination` → check monsters module → `turn.ts`
- `isValidWanderDestination` → check monsters module → `turn.ts`
- `autoRest`, `manualSearch` → `src/time/misc-helpers.ts` (check) → `io/input-context.ts`
- `dijkstraScan` → `src/dijkstra/dijkstra.ts` → `io/input-context.ts`

**Note:** Some of these context builder slots currently have stubs with test.skip entries
in turn.test.ts. After wiring, check whether the test.skip can be activated or should
remain (if wiring is confirmed correct but test is too complex to activate immediately).

---

## Phase 3: Player action wiring

**Goal:** Player can pick up items, open doors, use keys, walk into terrain.

Mix of WIRE and PORT:
- `pickUpItemAt` → check `src/items/` for impl; if missing, port from `Items.c`
- `checkForMissingKeys` → check `src/movement/`; port if missing
- `promoteTile` → `src/time/environment.ts` → `movement.ts`
- `useKeyAt` → `src/movement/item-helpers.ts` → `movement.ts`
- `getQualifyingPathLocNear` → `src/dijkstra/` or `src/monsters/` → `movement.ts`
- `nextBrogueEvent` → `src/io/input-keystrokes.ts` → `movement.ts` travel context
- `pauseAnimation` → `src/io/input-keystrokes.ts` → `movement.ts`
- `hilitePath`, `clearCursorPath`, `hiliteCell` → `src/io/` → `movement.ts`, `input-context.ts`
- `recordKeystroke` → wire as no-op (persistence layer; acceptable for now)
- `cancelKeystroke` → wire as no-op (persistence layer)
- `plotForegroundChar` → check `src/io/display.ts`; wire or trivial no-op
- `updatePlayerUnderwaterness` → check `src/movement/` or `src/time/`

---

## Phase 4: Combat domain stubs

**Goal:** Correct combat text, full combat resolution.

Mix of PORT and WIRE:
- `resolvePronounEscapes` (PORT) — `Combat.c`; replaces $HESHE/$OBJHE/etc. in message text
  Wire into: `combat.ts`, `turn.ts`, `items.ts`
- `getMonsterDFMessage` (PORT) — look up dungeon feature death message from DF catalog
  Wire into: `combat.ts`, `turn.ts`
- `demoteMonsterFromLeadership` (WIRE) — check `src/monsters/monster-lifecycle.ts`
- `checkForContinuedLeadership` (WIRE) — check `src/monsters/`
- `unAlly` (WIRE) — check `src/monsters/`; should be in monster-lifecycle.ts
- `wakeUp` full wiring — `src/monsters/monster-state.ts` → `combat.ts`, `turn.ts`
- `anyoneWantABite` — check `src/monsters/`; wire into `combat.ts`

**Note:** `resolvePronounEscapes` is called on every combat message — must be correct.
C source: `Combat.c`. All `$HESHE`, `$HESHECAP`, `$HIMHER`, `$HISHERSELF`, `$HISHER`,
`$OBJHE`, `$ITSHIS` patterns need substitution from `monsterText` table.

---

## Phase 5: Items and equipment stubs

**Goal:** Full item economy — pick up, equip, use, swap.

Mix of WIRE and PORT:
- `updateEncumbrance` → `src/items/item-usage.ts` → `movement.ts`, `items.ts`, `combat.ts`
- `updateRingBonuses` → `src/items/item-usage.ts` → `lifecycle.ts`, `items.ts`
- `equipItem` → `src/items/item-usage.ts` → `combat.ts`, `items.ts`
- `exposeCreatureToFire` → `src/time/creature-effects.ts` → `items.ts`
- `swapLastEquipment` (PORT) — `Items.c`; swap weapon/armor with previously equipped
- `dropItem` full wiring — `src/items/floor-items.ts` → `turn.ts` (playerFalls path)
- `placeItemAt` in machine context — `lifecycle.ts:362`; wire `src/items/floor-items.ts`
- `promptForItemOfType` — full inventory chooser UI; port from `Items.c`
  This is the largest item in this phase (~100 lines in C) — may need a new file
- `updateFloorItems` subtasks (auto-descent, fire/lava, drift, promote) — check
  `src/items/floor-items.ts`; each subtask is a branch in the existing function

---

## Phase 6: Monster capability stubs

**Goal:** Full monster behavior — abilities, awareness, corpse absorption, waypoints.

Mix of WIRE and PORT:
- `awareOfTarget` — `src/monsters/`; check `monsterScentRange`, `monsterVisionRange`
  Wire into `monsters.ts` buildMonsterStateContext
- `closestWaypointIndex`, `closestWaypointIndexTo` (PORT) — `Architect.c`; requires
  `wpDistance` grid to be populated; wire into `monsters.ts` buildMonsterStateContext
- `burnedTerrainFlagsAtLoc` (PORT) — `Time.c`; check burned terrain state
- `cellHasGas` — check `src/state/helpers.ts`; likely a trivial terrain flag check
- `updateMonsterCorpseAbsorption` — check `src/monsters/monster-actions.ts`
- `openPathBetween` — `src/items/bolt-geometry.ts` → wire into `monsters.ts`
- `drawManacles` — port from `IO.c` or wire as no-op (visual only)
- `monsterDetails` SidebarContext — `src/io/sidebar-monsters.ts`; wire into SidebarContext

---

## Phase 7: Display screens + UI polish

**Goal:** Full UI — help screen, discoveries, feats, inventory dialogs, sidebar complete.

All PORT (or significant wiring):
- `printHelpScreen` → port from `IO.c` (help overlay text)
- `displayFeatsScreen` → port from `IO.c` / `MainMenu.c`
- `printDiscoveriesScreen` → port from `IO.c`
- `printSeed` → trivial; display `rogue.seed` value on screen
- `shuffleTerrainColors` → `src/time/` or `src/light/`; terrain color animation
- Inventory dialogs (equip, unequip, drop, throw, relabel, call) — these are in
  `io/input-context.ts:202-207` and `ui.ts:315-321`; port each dialog from `Items.c`
- `strLenWithoutEscapes` in ButtonContext → wire `src/io/text.ts`
- Button gradient color ops in ButtonContext → wire `src/io/color.ts`

---

## Phase 8: Browser smoke test + bug fixes

**Goal:** A complete run of the game in the browser, from title screen to win or death.

1. Build the TS project (`npm run build` or equivalent)
2. Serve the browser bundle
3. Start a new game — verify: dungeon renders, sidebar shows player stats
4. Walk around — verify: cells update, flavor text, messages for terrain events
5. Fight a monster — verify: combat messages, monster death, item drops
6. Pick up and use an item — verify: correct effect, messages, encumbrance
7. Descend a level — verify: level transition, new dungeon generates
8. Win or die — verify: game-over/victory screen

For each failure: fix the bug, add a regression test if possible, continue.

---

## Phase 9: Final stub cleanup

**Goal:** All test.skip entries either activated, updated to reflect permanent deferrals,
or removed if the underlying function is now correctly implemented.

1. Run full test suite; review remaining test.skip count
2. For each test.skip: is it still valid? Activate or note as permanent
3. Update MEMORY.md and PROJECT.md to reflect initiative completion
4. Tag the commit as the pre-playtest milestone

---

## Known dependencies

- Phase 2 depends on Phase 1 (messages must work before monster turn feedback matters)
- Phase 5 depends on Phase 3 (items need player action wiring first)
- Phase 8 depends on Phases 1–7 (smoke test comes last)
- `closestWaypointIndex` (Phase 6) depends on `setUpWaypoints` being called correctly
  (already wired in lifecycle.ts:458)
- `promptForItemOfType` (Phase 5) depends on the button/inventory UI (Phase 7) being
  at least partially in place — may need to be moved after Phase 7
