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

All items resolved. See `docs/BACKLOG-DONE.md`.

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
