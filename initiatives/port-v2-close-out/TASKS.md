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
- [ ] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 2 — waitForAcknowledgment + confirm async cascade
  Branch: feat/port-v2-playtest
  Last commit: [hash]
  ```

---

## Phase 2: waitForAcknowledgment + confirm async cascade

**Before writing any code:** read the full call chain for each. Map every function
that must become async. If both cascades together would exceed 60% context, complete
`waitForAcknowledgment` only and move `confirm` to Phase 3.

### 2a: waitForAcknowledgment

- [ ] Trace: which context builder(s) have `waitForAcknowledgment: () => {}`?
      Check `src/ui.ts buildMessageContext()` and `src/io/input-context.ts`
- [ ] Confirm the real implementation: likely `src/io/input-keystrokes.ts` —
      it should be async, waiting for a keypress or mouse click
- [ ] Map the async cascade: which callers of the context need to become async?
      Write down the full chain before touching any code
- [ ] Wire `waitForAcknowledgment` into the message context; update intermediate
      callers as needed to propagate async correctly
- [ ] Remove or activate the paired test.skip entry
- [ ] All files under 600 lines

### 2b: confirm in movement contexts

- [ ] Locate `confirm: () => true` stubs — check `src/movement.ts` (PlayerMoveContext)
      and any other context builders with the same stub
- [ ] Confirm the real implementation in `src/io/input-dispatch.ts` (async confirm)
- [ ] Map the async cascade: `PlayerMoveContext.confirm` is sync today; the calling
      function likely needs to become async, which may cascade to `processEvent` and
      `mainGameLoop` (mainGameLoop is already async — cascade may stop there)
- [ ] Wire real `confirmFn` into the movement context; update intermediate callers
- [ ] Remove or activate the paired test.skip entry
- [ ] All files under 600 lines

### Phase 2 closing tasks

- [ ] Run `npx vitest run` — confirm no regressions; record pass/skip counts
- [ ] Commit all changes
- [ ] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 3 — remaining wireable stubs
  Branch: feat/port-v2-playtest
  Last commit: [hash]
  ```

---

## Phase 3: Remaining wireable stubs

**Wiring only. Do not port any new functions.**

For each candidate: search `src/` for the real implementation first. If it exists,
wire it and activate/update the test.skip. If it does not exist, update the comment
to explain the gap clearly and move on — do not spend time porting in this phase.

- [ ] `discoveredTerrainFlagsAtLoc` in `turn.ts`
      Domain fn `discoveredTerrainFlagsAtLocFn` in `src/state/helpers.ts` confirmed correct
      (verify-mechanics Phase 3a). Replace `() => 0` stub; update or remove paired test.skip.

- [ ] `discoveredTerrainFlagsAtLoc` in `monsters.ts`
      Same fn. Replace stub; update paired test.skip.

- [ ] `discoveredTerrainFlagsAtLoc` in `lifecycle.ts`
      Same fn. Replace stub; update paired test.skip.

- [ ] `attackVerb` in `combat.ts` (currently `() => "hits"`)
      Check if a monsterText lookup is feasible with available context; wire if straightforward.
      If attacker context is insufficient, retag as `// permanent-defer — attacker text
      lookup needs full MonsterTextContext` and leave as-is.

- [ ] `anyoneWantABite` in `combat.ts` + `turn.ts` (currently `() => false`)
      Check if `canAbsorb` is now implemented and if `CombatHelperContext` has enough
      context to wire it. Wire if feasible; document as permanent-defer if not.

- [ ] Grep `src/` for remaining `// stub — wired in port-v2-platform` entries.
      For each: check if the implementation exists and wire it. If not, retag:
      `// permanent-defer — [reason]` (remove the stale port-v2-platform reference).

- [ ] Run `npx vitest run` — confirm no regressions; record pass/skip counts
- [ ] Commit all changes
- [ ] Generate handoff prompt:
  ```
  Continue port-v2-close-out. Read: .context/PROJECT.md, initiatives/port-v2-close-out/BRIEF.md, PLAN.md, TASKS.md
  Resume at: Phase 4 — Light.c audit
  Branch: feat/port-v2-playtest
  Last commit: [hash]
  ```

---

## Phase 4: Light.c audit

- [ ] Read `docs/audit/gaps-Light.md` — identify the 5 NEEDS-VERIFICATION functions
      (if the file does not exist, search `docs/audit/` for the correct gap file)
- [ ] For each of the 5 functions:
  - [ ] Read C source in `src/brogue/Light.c`
  - [ ] Read the TS port in `rogue-ts/src/`
  - [ ] Confirm match; OR document divergence and fix it
  - [ ] Add a direct unit test if none exists
        OR add a test.skip with a description if the divergence is acceptable
- [ ] Run `npx vitest run` — confirm no regressions; record pass/skip counts
- [ ] Commit all changes
- [ ] Generate handoff prompt:
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
- [ ] Review all remaining test.skip entries; for each confirm its classification:
      - **ACTIVE** — remove skip; test passes
      - **PERMANENT-DEFER** — comment explains the acceptable simplification
      - **PERSISTENCE-DEFER** — tagged `// DEFER: port-v2-persistence`
- [ ] Grep `src/` for any `// stub` comments not covered by a test.skip — add or confirm
- [ ] Update `MEMORY.md` — mark initiative complete; record final test counts;
      note what remains for port-v2-persistence
- [ ] Update `PROJECT.md` — mark port-v2-close-out complete; set next as port-v2-persistence
- [ ] Commit: `"docs: port-v2-close-out complete — port ready for persistence layer"`
- [ ] Generate closing handoff:
  ```
  port-v2-close-out is complete. The port is mechanically complete (persistence aside).
  Next initiative: port-v2-persistence.
  Read: .context/PROJECT.md for current state.
  Branch: feat/port-v2-playtest (or create feat/port-v2-persistence for new work)
  ```

---

## Permanently deferred (no further action needed)

- `applyInstantTileEffectsToCreature` — chasms freeze vision (B5); gameplay impact is
  low, fix requires significant async cascade; permanent defer this initiative
- `displayLevel` stubs in `items.ts` + `input-context.ts` — only `lifecycle.ts` impl
  is complete; the other two are internal context callbacks rarely reached
- `flashTemporaryAlert` — needs full EffectsContext (getCellAppearance, hiliteCell,
  pauseAnimation); too complex to wire without more scaffolding
- `updateFlavorText` — needs CreatureEffectsContext; deferred
- `itemDetails()` — full item stat description; stub shows name only; cosmetic
- Debug overlays (`displayGrid`, `displayWaypoints`, `displayMachines`, etc.) — debug only
- `drawManacles` — visual-only rendering call; no gameplay effect
- `updateMonsterCorpseAbsorption` — stub is a functional no-op in all exercised cases
- `initializeButtonState` in InputContext — domain fn called directly; slot unused

## Deferred to port-v2-persistence (do not touch)

- saveGame, saveGameNoPrompt, loadSavedGame
- saveRecording, saveRecordingNoPrompt, flushBufferToFile, initRecording
- pausePlayback, executeEvent, recallEvent, executePlaybackInput
- RNGCheck, displayAnnotation
- restoreItems, restoreMonster
- listFiles, loadRunHistory, saveResetRun, getAvailableFilePath
- characterForbiddenInFilename, openFile
- recordKeystroke, recordKeystrokeSequence, recordMouseClick, cancelKeystroke
