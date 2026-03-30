# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-29 (orchestrator batch — B75, B89, B92, B94, B96, B99, B107 fixed)
**Tests at last update:** 98 files · 2720 pass · 55 skip

---

## Session Protocol

Every session working from this backlog follows the same pattern:

1. **Read this file.** Find the handoff prompt's specified item, or pick the next
   unchecked item in priority order.
2. **Read the C source** for that item (`src/brogue/`). Read the TS port. Understand
   the gap before writing a line.
3. **Do that item only.** Stop at ~70% context window. Partial fixes are not OK —
   revert incomplete changes before committing.
4. **Run `npx vitest run`** — no regressions allowed. Fix any before committing.
5. **Check the item off** in this file (change `- [ ]` to `- [x]`).
6. **Commit.** Message format: `fix: [item name] — [one-line description]`
7. **Generate handoff prompt:**
   ```
   Continue port-v2 backlog. Branch: feat/port-v2-playtest.
   Read: .context/PROJECT.md, docs/BACKLOG.md, initiatives/port-v2-close-out/TASKS.md.
   Next item: [exact item name from BACKLOG.md, or "pick next unchecked by priority"]
   Last commit: [hash]
   ```

### Stub rules

**Do not assume a code path is "rare" without checking.** Before stubbing a context
function, check the C source to see what effect cases call it. If a bolt type or
item effect triggers it in normal play, wire it — don't stub it. A `throw` stub
is fine and preferred over silent failure — it gives an exact stack trace — but
only if the path is genuinely not reachable in normal play.

---

## Bug reports from playtesting

Resolved items: see `docs/BACKLOG-DONE.md`.

- [x] **B109 — Hover highlight flashes but doesn't stay** — The white highlight on the
      currently hovered square flashes briefly but does not remain visible while the mouse
      is stationary over the cell.

- [x] **B110 — Chasm fall requires player move + confirmation instead of "more" prompt** —
      When the floor collapses or the player drinks a potion of descent, the game should
      force a "more" prompt before falling. Instead the player must manually move, which
      triggers an "are you sure?" confirmation screen requiring Yes/No before the fall occurs.

- [x] **B111 — No way to open the top messages overlay to scroll history** — Cannot find
      a mechanism to open/scroll the top message log overlay. The C game allows scrolling
      through past messages; the TS port appears to have no working entry point for this.

- [x] **B112 — Monster disappear-on-kill recurring** — After killing a monster in a group,
      the monster behind moves into the vacated square and disappears visually, though it
      can still attack and be attacked. This has been "fixed" multiple times (B97 etc.) —
      need to audit all prior fixes and understand why the root cause keeps reasserting.

- [ ] **B113 — Monsters don't spawn mid-level** — No new monsters appear on levels during
      play. The C game periodically spawns monsters as the player lingers; the TS port does
      not appear to trigger mid-level monster spawning.

- [ ] **B114 — Hallucination duration shorter than C game?** — Hallucination seems to wear
      off faster than in the base game. Needs comparison of status-tick logic against C source.

- [ ] **B115 — Staff of obstruction** — obstructions created by the staff of obstruction behave differently than the C game - shorter life, strange spread pattern, not sure exactly. Needs comparison with C game for parity.

- [ ] **B116 — Goblin mystic's spell behavior** — Goblin mystics don't cast spells. Maybe other spell-casting monsters and allies too, not sure.

---

## Persistence layer (implement as a group)

These are all save/load/recording/playback related. Do not implement individually —
they are interdependent and should be planned as a single coordinated effort.
Referenced from `initiatives/port-v2-close-out/TASKS.md` "Deferred to port-v2-persistence".

- [ ] saveGame, saveGameNoPrompt, loadSavedGame
- [ ] saveRecording, saveRecordingNoPrompt, flushBufferToFile, initRecording
- [ ] pausePlayback, executeEvent, recallEvent, executePlaybackInput
- [ ] RNGCheck, displayAnnotation
- [ ] restoreItems, restoreMonster
- [ ] listFiles, loadRunHistory, saveResetRun, getAvailableFilePath
- [ ] characterForbiddenInFilename, openFile
- [ ] recordKeystroke, recordKeystrokeSequence, recordMouseClick, cancelKeystroke

---

## Acceptable gaps (no action needed)

These are documented divergences that are either intentional or have negligible gameplay
impact. Do not implement.

- `initializeButtonState` in InputContext — permanent signature mismatch; slot unused
- `initializeRogue`, `freeEverything`, `gameOver`, `victory` — real code exists;
  complex orchestrator tests deferred; indirect coverage via seed-determinism tests
- `refreshDungeonCell`, `refreshSideBar`, `plotCharWithColor` etc. in `ui.test.ts` —
  IO integration tests; wired in browser, can't be unit tested
- `SeedCatalog.c` functions — CLI seed-scanning tool, no gameplay logic
- POSIX/SDL entry points, platform-specific terminal code — browser has no equivalent

---

## Stub audit

Full list of context-property stubs (CodeQL-generated, 2026-03-16) lives in
[`docs/STUBS.md`](./STUBS.md). Do not fix any stub without a corresponding backlog item.
