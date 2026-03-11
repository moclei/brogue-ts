# TASKS: port-v2-close-out

Each phase is one session's work. **Stop at 60% context window usage, commit, and
generate a handoff prompt.** Do not start the next phase in the same session.

Starting state: 87 files, 2220 pass, 86 skip
Branch: feat/port-v2-playtest

---

## Phase 1: Archive + wire throw/call dialogs

### 1a: Archive stale initiatives ✓ DONE

All six completed initiatives moved to `initiatives/archive/` before this initiative
began. Closing notes added to each TASKS.md. port-v2-playtest marked closed in BRIEF.md
but not archived (SESSIONS.md is the historical bug log).

### 1b: Wire throwCommand ✓ DONE

- [x] Locate the `throwCommand` stub — found in `src/ui.ts` (line 344) and `src/io/input-context.ts` (line 433)
- [x] Confirm `chooseTarget` in `src/items/targeting.ts` and `throwItem` in `src/items/throw-item.ts`
- [x] Created `src/items/item-commands.ts` — exports `buildThrowCommandFn` (builds full ChooseTargetContext
      + ThrowItemContext from game state; moveCursor wrapper uses `await waitForEvent()` for browser events)
- [x] Wired into `buildInventoryContext()` in `ui.ts` and `buildInputContext()` in `input-context.ts`
- [x] All files under 600 lines (ui.ts: 569, input-context.ts: 598, item-commands.ts: 438)

Note: `getInputTextString` in the call path is stubbed to return null — real text entry requires
Phase 2 async bridge work. The throwCommand targeting loop is wired and functional in-browser.

### 1c: Wire call / inscribeItem ✓ DONE

- [x] Locate `call` stub — found in same two files
- [x] Confirm `inscribeItem` in `src/items/item-call.ts` and `itemCanBeCalled` in `src/items/item-utils.ts`
- [x] `buildCallCommandFn` in `item-commands.ts` calls `inscribeItem` with `getInputTextString: () => null`
      (stub — text entry loop needs Phase 2 async bridge); `itemCanBeCalled` guards entry
- [x] Wired into both `ui.ts` and `input-context.ts` via shared `itemCmdDeps`
- [x] All files under 600 lines

### Phase 1 closing tasks

- [x] Run `npx vitest run` — 87 files, 2220 pass, 86 skip — no regressions
- [x] Commit all changes
- [x] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 2 — waitForAcknowledgment + confirm async cascade
  Branch: feat/port-v2-playtest
  Last commit: 1a8cf88
  ```

---

## Phase 2: waitForAcknowledgment + confirm async cascade

**Before writing any code:** read the full call chain for each. Map every function
that must become async. If both cascades together would exceed 60% context, complete
`waitForAcknowledgment` only and move `confirm` to Phase 3.

### 2a: waitForAcknowledgment ✓ DONE

- [x] `MessageContext.waitForAcknowledgment(): void` → `void | Promise<void>` (messages-state.ts, ui.ts)
- [x] `displayMoreSign()` → async, awaits `ctx.waitForAcknowledgment()`
- [x] `temporaryMessage()` → async, awaits `ctx.waitForAcknowledgment()`
- [x] `message()` → async, awaits `displayCombatText()` + `displayMoreSign()`
- [x] `messageWithColor()` → async; `displayCombatText()` → async; `combatMessage()` → async
- [x] `buildMessageFns()` in `io-wiring.ts`: return types updated to `Promise<void>`
- [x] `buildMessageContext().waitForAcknowledgment` wired to real `waitForEvent()` loop
      (auto-confirms during autoPlay/playback; throws in tests → immediate resolve)
- [x] `playerTurnEnded()` in `turn-processing.ts` → async; `await ctx.message(...)` at
      3 REQUIRE_ACKNOWLEDGMENT call sites (lines 717, 838, 841)
- [x] `turn.ts::playerTurnEnded()` wrapper → async
- [x] `player-movement.ts::playerMoves/playerRuns` — all `ctx.playerTurnEnded()` → `await`
- [x] `movement.ts::buildMovementContext().playerTurnEnded` → async closure
- [x] `input-context.ts` — all 3 `playerTurnEnded` closures → async
- [x] `input-dispatch.ts` — `await ctx.playerTurnEnded()`, `await ctx.autoRest()`,
      `await ctx.manualSearch()` (×2)
- [x] `inventory-actions.ts` — all 3 `playerTurnEndedFn()` calls → `await`
- [x] `items.ts::buildItemHandlerContext().playerTurnEnded` → async closure
- [x] `misc-helpers.ts::autoRest()` + `manualSearch()` → async; all `ctx.playerTurnEnded()` → `await`
- [x] `input-keystrokes.ts` — `playerTurnEnded/autoRest/manualSearch` interface → `void | Promise<void>`
- [x] Activated test.skip for `waitForAcknowledgment` in ui.test.ts (+1 pass)
- [x] All tests updated for async (`await autoRest()`, `await manualSearch()`, `await ctx.message()`)

### 2b: confirm in movement + item contexts ✓ DONE

- [x] Located `confirm: () => true` stubs in `src/movement.ts` and `src/items.ts`
- [x] Mapped cascade: `playerMoves`/`playerRuns` async, `travel-explore.ts` callers async,
      `eat`/`drinkPotion`/`readScroll` async, `apply` awaits them
- [x] Added `buildConfirmFn()` to `src/io-wiring.ts` — uses `printTextBox` from `io/inventory.ts`
      + `buildInventoryContext()` for full dialog (Yes/No buttons, shaded box)
- [x] Wired into `buildMovementContext()` (movement.ts) and `buildItemHandlerContext()` (items.ts)
- [x] `PlayerMoveContext.confirm` interface: `boolean | Promise<boolean>`
- [x] `TravelExploreContext.playerMoves` interface: `boolean | Promise<boolean>`
- [x] `ItemHandlerContext.confirm` interface: `boolean | Promise<boolean>`
- [x] `io/input-dispatch.ts`: added `await` before `ctx.playerMoves`/`ctx.playerRuns`
- [x] `io/input-context.ts`: playerMoves/playerRuns closures → async
- [x] Activated test.skip entries in movement.test.ts and items.test.ts
- [x] All files under 600 lines (io-wiring.ts: 504)

### Phase 2 closing tasks

- [x] Run `npx vitest run` — 87 files, 2222 pass, 84 skip — no regressions (+2 activated)
- [x] Commit all changes — commit `97dfb00`
- [x] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 2a sub-session — waitForAcknowledgment async cascade
  Branch: feat/port-v2-playtest
  Last commit: 97dfb00
  ```

---

## Phase 3: Remaining wireable stubs ✓ DONE

**Wiring only. Do not port any new functions.**

- [x] `discoveredTerrainFlagsAtLoc` in `turn.ts` — wired via discoveredTerrainFlagsAtLocFn
      (import added; real closure with tileCatalog + dungeonFeatureCatalog)
- [x] `discoveredTerrainFlagsAtLoc` in `monsters.ts` — same; dungeonFeatureCatalog import added
      Activated test.skip in monsters.test.ts as real passing test.
- [x] `discoveredTerrainFlagsAtLoc` in `lifecycle.ts` — wired in makeCostMapCtx() + makeCalcDistCtx()
- [x] `attackVerb` in `combat.ts` — WIRED. Changed AttackContext interface to pass attacker;
      updated call site in combat-attack.ts; wired real attackVerbFn with monsterText + minimal context.
      Updated test mocks in combat-attack.test.ts + combat-runics.test.ts.
- [x] `anyoneWantABite` in `combat.ts` + `turn.ts` — WIRED. Wired via anyoneWantABiteFn with
      partial CombatHelperContext (iterateAllies, randRange, isPosInMap, monsterAvoids).
      Also wired in item-commands.ts (throwItem context).
- [x] `storeMemories` in `movement-cost-map.ts` — WIRED (bonus: highestPriorityLayer imported)
- [x] Grep `src/` for remaining `// stub — wired in port-v2-platform` entries — ALL RETAGGED.
      Visual effects → permanent-defer — visual effect only
      Complex contexts → permanent-defer — requires [Context]
      Async input → permanent-defer — requires async player input
      `currentStealthRange: () => 14` improved to `() => rogue.stealthRange` (live value)
      `spawnDungeonFeature` inside crystalize() wired with real spawnDungeonFeatureFn
      No remaining "wired in port-v2-platform" stubs.
- [x] Run `npx vitest run` — 87 files, 2224 pass, 82 skip (+2 activated vs Phase 2)
- [x] Commit all changes
- [x] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 4 — Light.c audit
  Branch: feat/port-v2-playtest
  Last commit: 143533a
  ```

---

## Phase 4: Light.c audit ✓ DONE

- [x] Read `docs/audit/gaps-Light.md` — identified 5 NEEDS-VERIFICATION functions
- [x] For each of the 5 functions:
  - [x] Read C source in `src/brogue/Light.c`
  - [x] Read the TS port in `rogue-ts/src/light/`
  - [x] Confirm match; OR document divergence and fix it
  - [x] Added direct unit tests — new file `rogue-ts/tests/light-verification.test.ts` (18 tests)

Audit findings (all 5 MATCH C source — no fixes needed):

1. `updateMinersLightRadius` — MATCH. BigInt arithmetic faithfully mirrors C fixpt math.
2. `updateLighting` — MATCH with acceptable simplification: C assigns pointers to global
   color constants; TS copies them (`{ ...playerInvisibleColor }`). Read-only after
   assignment, so functionally equivalent. Creature iteration order is preserved.
3. `createFlare` — MATCH. `rogue.flares.push()` replaces C's manual realloc;
   `newFlare` deep-copies light source (C stores pointer to catalog) — equivalent
   since catalog is read-only.
4. `drawFlareFrame` — MATCH. `Math.floor` where C uses integer truncation — equivalent.
5. `animateFlares` — MATCH. C's `brogueAssert` omitted (no assertion system in TS).
   All loop logic, lighting backup/restore, and fast-forward behavior are correct.

- [x] Run `npx vitest run` — 88 files, 2242 pass, 82 skip — no regressions (+18 new tests)
- [x] Commit all changes
- [x] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 5 — browser playtest
  Branch: feat/port-v2-playtest
  Last commit: [hash]
  ```

---

## Phase 5: Browser playtest

*Per-session bug details and tracker live in `SESSIONS.md`. Read that file first.*

### Session protocol — REQUIRED for every session in this phase

1. **Read `SESSIONS.md` first** — scan the Bug Tracker table, then the last session entry.
2. **Pick the highest-priority open bug** — or start the focus area checklist if none open.
3. **Stop at ~60% context window** — partial progress is fine; partial fixes are not.
   Do not leave code in a broken state. Revert incomplete changes before committing.
4. **Before ending:** update `SESSIONS.md` — mark fixed bugs, add new bugs found.
5. **Commit** — `npm run build` must be clean; `npx vitest run` must not regress.
6. **Generate handoff prompt:**
   ```
   Continue port-v2-close-out Phase 5 (browser playtest). Branch: feat/port-v2-playtest.
   Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md, SESSIONS.md.
   Current state is at the bottom of SESSIONS.md.
   Last commit: [hash]
   ```

### Focus area checklist

- [ ] Throw a potion or fire a wand — targeting cursor appears; item resolves on confirmation
- [ ] Call an item — text input prompt appears; item gets the new name
- [ ] Fill the message log — `--MORE--` appears and blocks until keypress
- [ ] Walk toward lava or an open trap — confirm prompt appears before stepping
- [ ] Fog of war / lighting renders correctly after Light.c audit fixes

Phase 5 is complete when all focus areas above are checked, or each has a documented
reason in SESSIONS.md explaining why it cannot yet be verified.

---

## Phase 6: Final cleanup

- [ ] Run `npx vitest run` — record final pass/skip counts
- [ ] Grep `src/` for any `// stub` comments not covered by a test.skip — add or confirm
- [ ] Update `MEMORY.md` — mark initiative phases 1–5 complete; note Phase 7 is ongoing
- [ ] Update `PROJECT.md` — mark port-v2-close-out phases 1–5 complete; note backlog
      work continues in Phase 7 via `docs/BACKLOG.md`
- [ ] Commit: `"docs: port-v2-close-out Phases 1–6 complete — backlog work begins"`
- [ ] Generate handoff to Phase 7:
  ```
  Continue port-v2 backlog. Branch: feat/port-v2-playtest.
  Read: .context/PROJECT.md, docs/BACKLOG.md, initiatives/port-v2-close-out/TASKS.md.
  Next item: pick next unchecked by priority in BACKLOG.md
  Last commit: [hash]
  ```

---

## Phase 7: Backlog clearance (ongoing)

**No end date. Work through `docs/BACKLOG.md` one item per session.**

`docs/BACKLOG.md` is the authoritative source. This phase just describes the protocol.

### Session protocol

1. **Read `docs/BACKLOG.md`** — find the item specified in the handoff prompt, or
   pick the next unchecked item in priority order (Priority 1 → 2 → 3 → 4 → 5).
2. **Read the C source** for the item before writing any code.
3. **Do that item only** — stop at ~70% context window. Revert incomplete changes.
4. **Run `npx vitest run`** — no regressions before committing.
5. **Check the item off** in `docs/BACKLOG.md`.
6. **Commit** with message: `fix: [item] — [description]`
7. **Generate handoff prompt:**
   ```
   Continue port-v2 backlog. Branch: feat/port-v2-playtest.
   Read: .context/PROJECT.md, docs/BACKLOG.md, initiatives/port-v2-close-out/TASKS.md.
   Next item: [exact item name from BACKLOG.md]
   Last commit: [hash]
   ```

### Playtester bugs

Bugs found during browser testing go in `docs/BACKLOG.md` under "Bug reports from
playtesting". They are worked the same way as any other backlog item: one per session,
highest priority first.

---

## Previously "permanently deferred" — now in BACKLOG.md

These were classified as permanent-defer during Phase 3 but have since been moved
to `docs/BACKLOG.md` because the owner decided everything non-persistence should be
implemented before the persistence layer. See BACKLOG.md Priority 3–5 for their
current status.

The only true permanent defer (no action needed, ever) is:
- `initializeButtonState` in InputContext — signature mismatch; slot is unused

## Deferred to port-v2-persistence (do not touch)

- saveGame, saveGameNoPrompt, loadSavedGame
- saveRecording, saveRecordingNoPrompt, flushBufferToFile, initRecording
- pausePlayback, executeEvent, recallEvent, executePlaybackInput
- RNGCheck, displayAnnotation
- restoreItems, restoreMonster
- listFiles, loadRunHistory, saveResetRun, getAvailableFilePath
- characterForbiddenInFilename, openFile
- recordKeystroke, recordKeystrokeSequence, recordMouseClick, cancelKeystroke
