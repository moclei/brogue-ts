# Audit: Recordings.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured 17 static functions for Recordings.c but missed all 24
public functions (multi-line or standard signatures). Supplemented with the public-function grep
pass. Total: 46 functions (22 static + 24 public).

Recordings.c is the file-based recording and playback system. It buffers game events (keystrokes,
mouse clicks) into an in-memory array, flushes them to disk as `.broguerec` files, and can replay
them for playback mode. It also manages save/load of `.broguesave` files and includes RNG
verification (OOSCheck, RNGCheck) used during playback to detect out-of-sync states.

In the browser port there is no filesystem. All 22 static internal helpers are OUT-OF-SCOPE: they
implement the low-level buffer encoding (compressKeystroke, numberToString, recordChar, etc.) and
file read/write ops (writeHeaderInfo, copyFile, fillBufferFromFile internals, etc.) that cannot
exist in a browser context.

Of the 24 public functions, 13 are stubs wired into context objects (STUBBED-UNTRACKED — no
test.skip entries), 3 have test.skip entries (STUBBED-TRACKED), 2 are missing from TS source
entirely, and 6 have no TS equivalent at all (OUT-OF-SCOPE).

Notable: `loadSavedGame` is MISSING from TS source but a test.skip exists for it in
menus.test.ts:117 — the test.skip was added preemptively without a corresponding stub,
which is atypical but still serves the documentation purpose.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| recordChar | 43 | — | OUT-OF-SCOPE | Static; low-level buffer byte writer; file I/O internals |
| considerFlushingBufferToFile | 52 | — | OUT-OF-SCOPE | Static; auto-flush heuristic; file I/O internals |
| compressKeystroke | 59 | — | OUT-OF-SCOPE | Static; keystroke encoding for compact recording format |
| numberToString | 73 | — | OUT-OF-SCOPE | Static; fixed-width binary number encoder |
| recordNumber | 86 | — | OUT-OF-SCOPE | Static; calls recordChar; file I/O internals |
| recordEvent | 100 | — | OUT-OF-SCOPE | Public; dispatches to recordChar/compressKeystroke; no browser recording needed |
| recordKeystroke | 133 | movement.ts:321, items.ts:193, turn.ts:223, io/input-context.ts:251 | STUBBED-TRACKED | `() => {}` stubs in 4 context builders; test.skip at movement.test.ts:211 |
| cancelKeystroke | 147 | movement.ts:322 | STUBBED-UNTRACKED | `() => {}` stub; no test.skip |
| recordKeystrokeSequence | 154 | items.ts:194 | STUBBED-UNTRACKED | `() => {}` stub; no test.skip |
| recordMouseClick | 162 | items.ts:195, movement.ts:457 | STUBBED-UNTRACKED | `() => {}` stubs; no test.skip |
| writeHeaderInfo | 177 | — | OUT-OF-SCOPE | Static; writes recording file header to disk |
| flushBufferToFile | 223 | menus.ts:250, lifecycle.ts:483 | STUBBED-UNTRACKED | `() => {}` stubs; no test.skip |
| fillBufferFromFile | 251 | — | OUT-OF-SCOPE | Reads recording buffer from file; no browser equivalent |
| recallChar | 266 | — | OUT-OF-SCOPE | Static; reads byte from in-memory replay buffer |
| uncompressKeystroke | 279 | — | OUT-OF-SCOPE | Static; decodes compressed keystroke byte |
| recallNumber | 286 | — | OUT-OF-SCOPE | Static; reads N-byte number from replay buffer |
| playbackPanic | 305 | — | OUT-OF-SCOPE | Static; playback error handler; halts on OOS mismatch |
| recallEvent | 340 | io/input-context.ts:252 | STUBBED-UNTRACKED | `recallEvent: fakeEvent` — returns a fake event; no test.skip |
| loadNextAnnotation | 385 | — | OUT-OF-SCOPE | Static; reads next annotation string from recording file |
| displayAnnotation | 435 | turn.ts:218, menus.ts:257 | STUBBED-UNTRACKED | `() => {}` stubs; no test.skip |
| getPatchVersion | 459 | — | OUT-OF-SCOPE | Static; extracts patch version from recording file header |
| initRecording | 465 | lifecycle.ts:238 | STUBBED-UNTRACKED | `() => {}` stub; called in game-init.ts:500; no test.skip |
| OOSCheck | 558 | — | OUT-OF-SCOPE | Out-of-sync check during playback; no TS equivalent |
| RNGCheck | 582 | turn.ts:259, lifecycle.ts:482 | STUBBED-UNTRACKED | `() => {}` stubs; no test.skip |
| unpause | 599 | — | OUT-OF-SCOPE | Static; playback unpause logic; playback not ported |
| printPlaybackHelpScreen | 611 | — | OUT-OF-SCOPE | Static; renders playback help overlay; playback not ported |
| resetPlayback | 667 | — | OUT-OF-SCOPE | Static; resets replay state machine |
| seek | 689 | — | OUT-OF-SCOPE | Static; seeks to turn N in recording; playback not ported |
| promptToAdvanceToLocation | 783 | — | OUT-OF-SCOPE | Static; playback UI for location seek |
| pausePlayback | 813 | menus.ts:258 | STUBBED-UNTRACKED | `() => {}` stub; no test.skip |
| executePlaybackInput | 832 | io/input-context.ts:253 | STUBBED-UNTRACKED | `() => false` stub; no test.skip |
| getAvailableFilePath | 1109 | menus.ts:253 | STUBBED-UNTRACKED | `() => ""` stub; no test.skip |
| characterForbiddenInFilename | 1122 | io/input-context.ts:256 | STUBBED-UNTRACKED | `() => false` stub; no test.skip |
| getDefaultFilePath | 1130 | — | OUT-OF-SCOPE | Static; computes default save/rec filename from player name |
| saveGameNoPrompt | 1164 | menus.ts:251 | STUBBED-TRACKED | `() => {}` stub; test.skip at menus.test.ts:111 |
| saveGame | 1181 | io/input-context.ts:204 | STUBBED-UNTRACKED | `() => {}` stub (comment: "save system not yet ported"); no test.skip |
| saveRecordingNoPrompt | 1214 | menus.ts:252 | STUBBED-TRACKED | `() => ""` stub; test.skip at menus.test.ts:123 |
| saveRecording | 1227 | game-lifecycle.ts:158 (interface only) | MISSING | Declared in SaveRecordingContext interface; called at game-lifecycle.ts:378,596; no stub wiring found |
| copyFile | 1263 | — | OUT-OF-SCOPE | Static; copies file bytes; filesystem operation |
| switchToPlaying | 1284 | — | OUT-OF-SCOPE | Switches game mode to playback; opens .broguerec file |
| loadSavedGame | 1311 | — | MISSING | No TS equivalent in src/; test.skip at menus.test.ts:117 documents absence |
| describeKeystroke | 1373 | — | OUT-OF-SCOPE | Static; converts keystroke byte to human-readable string |
| appendModifierKeyDescription | 1405 | — | OUT-OF-SCOPE | Static; appends Ctrl/Shift modifier to description string |
| selectFile | 1417 | — | OUT-OF-SCOPE | Static; file selection dialog; filesystem + terminal UI |
| parseFile | 1435 | — | OUT-OF-SCOPE | Parses a .broguerec file for annotation display |
| RNGLog | 1515 | — | OUT-OF-SCOPE | Logs RNG state to RNGLog.txt; debug file output |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 0 |
| STUBBED-TRACKED | 3 |
| STUBBED-UNTRACKED | 13 |
| MISSING | 2 |
| NEEDS-VERIFICATION | 0 |
| OUT-OF-SCOPE | 28 |
| DATA-ONLY | 0 |
| **Total** | **46** |

## Critical Gaps

No functions in this file are required for basic gameplay — the recording system is peripheral
(playback, save/load) and all functions are expected to remain stubs or OUT-OF-SCOPE in the
browser port until a persistence layer is built.

The 13 STUBBED-UNTRACKED entries are rule violations (missing test.skip) but not gameplay
blockers. Ordered by visibility:

1. `saveGame` (io/input-context.ts:204) — save-on-quit path silently does nothing; player loses
   run data. Highest player-visible gap when save system is eventually wired.

2. `flushBufferToFile` (menus.ts:250, lifecycle.ts:483) — recording buffer is never written;
   any future recording system will have no data. Called at level transitions and game-over.

3. `initRecording` (lifecycle.ts:238) — recording state never initialized; all record calls
   silently operate on uninitialized state. Called once at game start.

4. `RNGCheck` (turn.ts:259, lifecycle.ts:482) — playback OOS detection silently disabled;
   harmless until playback is ported.

5. `pausePlayback` (menus.ts:258) — playback pause does nothing; harmless until playback ported.

6. `executePlaybackInput` (io/input-context.ts:253) — always returns false; harmless until
   playback ported.

7. `recallEvent` (io/input-context.ts:252) — returns a fake event instead of recorded event;
   harmless until playback ported.

8. `getAvailableFilePath` (menus.ts:253) — always returns ""; used in character-select.ts:161
   for save path; silently produces wrong file path.

9. `characterForbiddenInFilename` (io/input-context.ts:256) — always returns false; allows any
   character in filenames; harmless while save system unimplemented.

10. `displayAnnotation` (turn.ts:218, menus.ts:257) — annotations silently skipped during
    playback; harmless until playback ported.

11. `cancelKeystroke` (movement.ts:322) — recording cancel is a no-op; harmless while recording
    system unimplemented.

12. `recordKeystrokeSequence` (items.ts:194) — recording is a no-op; harmless while recording
    system unimplemented.

13. `recordMouseClick` (items.ts:195, movement.ts:457) — recording is a no-op; harmless while
    recording system unimplemented.

## Notes for follow-on initiative

**Recordings.c is almost entirely deferred** — 28 of 46 functions (61%) are legitimately
OUT-OF-SCOPE for a browser port. The recording/playback system, file I/O, and OOS checking all
require a persistence layer that does not exist yet.

**13 STUBBED-UNTRACKED entries need test.skip in Phase 3:**
- `cancelKeystroke: () => {}` at movement.ts:322
- `recordKeystrokeSequence: () => {}` at items.ts:194
- `recordMouseClick: () => {}` at items.ts:195 and movement.ts:457
- `flushBufferToFile: () => {}` at menus.ts:250 and lifecycle.ts:483
- `recallEvent: fakeEvent` at io/input-context.ts:252
- `displayAnnotation: () => {}` at turn.ts:218 and menus.ts:257
- `initRecording: () => {}` at lifecycle.ts:238
- `RNGCheck: () => {}` at turn.ts:259 and lifecycle.ts:482
- `pausePlayback: () => {}` at menus.ts:258
- `executePlaybackInput: () => false` at io/input-context.ts:253
- `getAvailableFilePath: () => ""` at menus.ts:253
- `characterForbiddenInFilename: () => false` at io/input-context.ts:256
- `saveGame: () => {}` at io/input-context.ts:204

**2 MISSING functions need investigation in follow-on:**
- `saveRecording` — declared in SaveRecordingContext interface (game-lifecycle.ts:158) and called
  at game-lifecycle.ts:378 and 596, but no stub wiring was found in any context builder. This
  means `gameOver` and the game-end sequence will throw at runtime when `saveRecording` is invoked
  unless the context builder silently provides it. Investigate lifecycle.ts context wiring.
- `loadSavedGame` — preemptive test.skip at menus.test.ts:117 documents the absence. Load Game
  menu option is already noted in TASKS.md as platform-blocked; no action until persistence layer.

**When a persistence layer is built (IndexedDB, server-side, etc.) the recommended porting order:**
1. `initRecording` + `flushBufferToFile` + `recordKeystroke` → minimal recording pipeline
2. `saveGameNoPrompt` / `saveGame` → save-on-quit (highest player value)
3. `loadSavedGame` → load game (completes save/load loop)
4. `saveRecording` / `saveRecordingNoPrompt` → recording export
5. Playback pipeline (`fillBufferFromFile`, `recallEvent`, `executePlaybackInput`, etc.) — lowest priority
