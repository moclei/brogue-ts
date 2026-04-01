# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-31 (playtest batch — B117–B126 added)
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

---

## Playtest batch — B117–B126

- [x] **B117 — Shift+H crash: `isPosInMap is not a function`** — Pressing Shift+H during
      a game causes a fatal crash. Stack trace: `playerRuns (player-movement.ts:890)` →
      `Object.playerRuns (input-context.ts:460)` → `executeKeystroke`. `ctx.isPosInMap` is
      not wired into the input context used by `playerRuns`.
      C: `Movement.c` (`playerRuns`). TS: `io/input-context.ts`, `player-movement.ts:890`.

- [ ] **B118 — Second vault blocks item pickup after key collected from first vault** —
      When two vault rooms share a floor, picking up a key from the first machine room and
      then opening the second vault causes all items in the second vault to be locked with
      "The missing item must be replaced before you can access the remaining items". The
      second vault's state is incorrectly inheriting the first vault's picked-up item.
      Intermittent: on one test run the second vault worked correctly; reproduce conditions
      unclear.
      C: `Architect.c` (machine room / vault item selection logic). TS: machine-room handling.

- [ ] **B119 — Picked-up vault item pedestal cage shuts, preventing item return** — After
      selecting an item from a vault pedestal the cage for that pedestal closes, locking it
      permanently. In the C game the player can return the item to its pedestal to reopen
      all cages and choose again. The TS port does not reopen cages on item return.
      C: `Architect.c` (vault pedestal / cage trigger). TS: architect / machine-room context.

- [ ] **B120 — Pixel-art mode missing pathfinding path highlight** — In ASCII mode hovering
      over a cell highlights each cell on the path the player would take, in a distinct
      colour. In pixel-art mode only the white hover highlight on the target cell is shown;
      the path cells are not highlighted.
      C: `IO.c` (path display). TS: display / pixel-art rendering path.

- [ ] **B121 — Potion of descent: no "more" prompt; player stuck on same depth** — Drinking
      a potion of descent shows "You plunge downward into the hole!" but does not advance to
      the next depth. The player can still act on the current depth, and any movement
      triggers the "Dive into the depths? Yes/No" chasm confirmation instead of descending.
      The C game shows a "more" prompt and then transitions to the lower depth.
      C: `RogueMain.c` (`usePotion` / descent handling). TS: items / potion effect code.
      Note: B110 fixed the chasm-fall path; this is specifically the potion-of-descent path.

- [ ] **B122 — Starvation auto-eat loop: hunger bar never refills** — When the player
      reaches "starving" status the game shows "Unable to control your hunger, you eat a
      ration of food" every turn, but the hunger bar does not refill. The message repeats
      indefinitely until the player manually eats. The auto-eat action is not actually
      consuming a food item or updating the satiation counter.
      C: `RogueMain.c` / `Items.c` (hunger / auto-eat logic). TS: player status / items.

- [ ] **B123 — Item panel shows stale items from previous floors** — As the player
      descends, the item panel begins displaying items that were on earlier floors and are
      no longer present. Hovering over a stale entry causes the item highlight and
      pathfinding visual to flicker/oscillate, sometimes pointing toward the stairs up.
      C: `IO.c` (sidebar item list refresh). TS: sidebar / item panel update logic.

- [ ] **B124 — Staff of lightning bolt animation missing on first shot** — Firing an
      unidentified staff of lightning at a monster occasionally shows no bolt animation on
      the first shot; the bolt fires silently. Subsequent shots display the animation
      correctly. May be a race condition or first-use initialisation issue.
      C: `Items.c` (`zap` / bolt animation). TS: bolt/lightning animation path.

- [x] **B125 — Combat sidebar info panel missing when aiming** — When targeting a monster
      with a staff (e.g. staff of lightning) the C game displays a left-panel overlay showing
      the player's chance-to-hit percentage and the expected damage range (min–max % of
      monster health). This overlay is absent in the TS port.
      C: `IO.c` (targeting UI / `displayMonsterInfo` or equivalent). TS: sidebar / aim context.

- [ ] **B126 — Crash in `flashCreatureAlert`: `mapToWindowY is not a function`** — Fatal
      crash during combat. Stack trace: `flashCreatureAlert (creature-effects.ts:463)` →
      `handleHealthAlerts (creature-effects.ts:487)` → `Object.handleHealthAlerts (turn.ts:524)`
      → `playerTurnEnded (turn-processing.ts:15)` → `playerMoves (player-movement.ts:561)`.
      `ctx.mapToWindowY` is not wired in the context passed to `flashCreatureAlert`.
      C: `IO.c` (creature flash / health alert). TS: `creature-effects.ts:463`, `turn.ts:524`.

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
- `takeScreenshot` — SDL2-only platform function; no browser equivalent; not wired
- `isApplicationActive` — platform function; browser tab is always active; wired as
  `() => true` in `menus.ts`; no real implementation needed
- `initializeLaunchArguments` — native CLI launch arguments (seed, path, command);
  no browser equivalent; wired as `() => {}` in `menus.ts`

---

## Port Parity Audit — Final Status

**Completed:** 2026-03-31
**Initiative:** `initiatives/port-parity-audit/`

### Summary

| Metric                           | Value |
| -------------------------------- | ----- |
| C functions total                | 818   |
| Unique stub names at start       | 220   |
| Unique stub names remaining      | 129   |
| Total stub occurrences at start  | 482   |
| Total stub occurrences remaining | 250   |
| Critical stubs remaining         | 109   |

All 109 remaining critical stubs are accounted for:

- **Recording/persistence deferred** (~40): tagged `DEFER: port-v2-persistence` — addressed by port-v2-persistence initiative
- **Intentional gaps** (16): platform-specific or architectural, tagged `permanent-defer`
- **Two-phase construction stubs** (remaining): wire-up pattern where context is patched after construction

### Behavioral fixes found during audit (Phase 4)

| Bug                                     | Impact                                                  | Fixed |
| --------------------------------------- | ------------------------------------------------------- | ----- |
| `monsterCatalog: []` in combat contexts | Runtime crash when ally dies out of sight               | ✓     |
| Armor runic damage not applied to melee | Absorption/Vulnerability/Mutuality runics had no effect | ✓     |
| Dragonslayer feat never set             | `MK_YOU` (0) instead of `MK_DRAGON` enum value          | ✓     |
| A_BURDEN strengthCheck wrong condition  | `enchant2 === 0` instead of `ArmorEnchant.Burden`       | ✓     |
| W_SLAYING degradation bypass inactive   | `enchant2 === 0` instead of `WeaponEnchant.Slaying`     | ✓     |
| Missing fire spawn on lava kill         | `spawnDungeonFeature(DF_CREATURE_FIRE)` not called      | ✓     |

### Remaining gaps

See `Acceptable gaps` section above for platform-specific intentional gaps.
Recording/persistence system: fully deferred to port-v2-persistence initiative.

---

## Stub audit

Full list of context-property stubs (CodeQL-generated, 2026-03-16) lives in
[`docs/STUBS.md`](./STUBS.md). Do not fix any stub without a corresponding backlog item.
