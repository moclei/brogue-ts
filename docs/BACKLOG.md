# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-25 (added B106/B107 from playtesting)
**Tests at last update:** 88 files · 2324 pass · 55 skip

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

- [ ] **B68 — Hallucination visual slightly different from C game (needs investigation)** —
      Hallucination mode looks roughly correct but differs subtly from C. Likely candidates:
      wrong color range, wrong randomized-glyph set, or color randomization applied at wrong
      layer. Requires side-by-side comparison with C.
      C: `IO.c` (hallucination rendering in `getCellAppearance` / `displayLevel`).
      TS: `io/display.ts` or render pipeline. **S**

- [ ] **B70 — While hallucinating, monster names show their real name on hit** — When
      hallucinating, the combat message should use a random fake monster name (as in C). The TS
      `monsterName` helper likely does not check `player.status[STATUS_HALLUCINATING]` before
      deciding which name to return.
      C: `IO.c:monsterName` (hallucination branch).
      TS: wherever `monsterName` is built in item or combat contexts. **S**

- [ ] **B72 — Vault cage-closing animation fires immediately on item pickup** — After picking
      up an item from a vault, the remaining items immediately change color to show they are
      caged. In C the cage-close effect is deferred: it fires on the turn after the player steps
      off the pickup square, with a brief per-item animation. Fix requires the cage-close
      trigger to be deferred by one turn and the animated effect to be wired.
      C: `Architect.c` (machine done-check / cage promotion).
      TS: `turn.ts` (`updateEnvironment` / machine state). **M**

- [ ] **B75 — `monsterBlinkToSafety` uses stubbed `updateSafetyMap`** — Monsters with a
      blink-to-safety bolt (e.g. will-o-wisps) blink to a random/suboptimal destination
      instead of the genuinely safest reachable cell, because the `blinkToSafetyCtx` in
      `turn-monster-zap-wiring.ts:549` has `updateSafetyMap: () => {}`.
      C: `Monsters.c:monsterBlinkToSafety` uses the global safety map.
      TS: `turn-monster-zap-wiring.ts` — wire `updateSafetyMap` the same way it was done
      in `turn-monster-ai.ts` for `getSafetyMap` (PR #38). **S**

- [ ] **B88 — Arrow turret can spawn inside an unreachable interior corner** — An arrow
      turret spawned at a diagonal interior corner where neither the player nor the turret
      could draw line-of-sight through the adjacent walls. Neither party could attack the
      other, making it an unblockable obstacle with no gameplay effect.
      ⚠️ **Confirm against C game first:** this may be a known edge-case in the base C game
      rather than a TS regression. Reproduce in BrogueCE C build with the same seed; if the
      C game places the turret identically, this is WAI and should be closed.
      C: `Architect.c` (turret placement validation).
      TS: dungeon generation wiring. **S**

- [ ] **B89 — Magical glyphs do nothing** — Rooms containing "magical glyphs" surrounding
      candle-lit altars with staffs produce no effect when the player walks over the glyphs or
      picks up the staffs. In C the glyphs are a machine trigger; stepping on them or removing
      the item should fire an effect (alarm, teleport, or similar). Root cause: likely the
      glyph terrain-flag trigger is not wired or `spawnDungeonFeature` is stubbed for this
      machine type.
      C: `Architect.c` (glyph machine type and trigger dispatch).
      TS: `tile-effects-wiring.ts`, `turn.ts`. **S**

- [ ] **B92 — "Quit and abandon run" menu option does nothing** — Opening the in-game
      menu and selecting "Quit and abandon" has no effect; the game continues. The quit path
      does not depend on persistence/recordings so it should be wireable now.
      C: `RogueMain.c` (`gameOver` / quit-without-save branch).
      TS: `menus.ts`, `lifecycle-gameover.ts`. **S**
      ⚠️ **Re-opened** — a fix was applied in PR #70 but playtesting re-confirmed the issue
      is still present. The menu option still has no effect after the fix.

- [x] **B96 — Explore oscillation after item pickup; item shown on floor despite being in inventory** —
      After picking up a scroll (observed on Depth 2), pressing 'x' to auto-explore causes the
      character to oscillate indefinitely between the item's former square and an adjacent square.
      The sidebar shows the item as visible on the floor even though it is in inventory. Using the
      item from inventory stops the oscillation. Picking up a second item and pressing 'x' again
      triggers the same loop.
      Hypothesis: `pickUpItemAt` adds the item to `packItems` but leaves `HAS_ITEM` set in pmap
      OR leaves the item in `floorItems`; `getExploreMap` uses `ctx.itemAtLoc()` which finds the
      stale entry and makes the former cell an explore goal. Because the B86 fix excludes the
      player's _current_ cell, the goal is only active when the player moves away, causing
      perpetual oscillation. Using the item may clear the stale state via the use-item path.
      C: `Items.c` (`pickUpItemAt`, sidebar render), `IO.c` (`printSideBar`).
      TS: `items/pickup.ts` (`pickUpItemAt`), `movement/travel-explore.ts` (`getExploreMap`),
      `movement.ts` (pickup context wiring). **P1**

- [ ] **B99 — Play/View buttons show rectangle icon instead of left-arrow** — The "Play"
      and "View" buttons on the main menu show a box/rectangle icon instead of the expected
      left-facing arrow (▶). Likely a font or glyph mapping issue in the button renderer.
      C: `IO.c` (button glyph rendering).
      TS: `io/buttons.ts` or the main-menu UI. **S**

- [ ] **B103 — Potion of invisibility: monsters didn't disengage** — After drinking a potion
      of invisibility monsters that were tracking the player continued to pursue as if the
      player were visible. In C drinking invisibility should cause tracking monsters to lose
      the scent trail and return to wandering.
      C: `Items.c` (`drinkPotion` invisibility branch), `Monsters.c` (scent/tracking reset).
      TS: `items/item-handlers.ts`, `monsters/monster-ai.ts`. **S**

- [ ] **B104 — Messages panel should expand on click to show scroll history** — Clicking the
      message area should open a scrollable message history overlay. Currently clicking does
      nothing. In C pressing `M` (or clicking the message panel) opens the full log.
      C: `IO.c` (message history display).
      TS: `menus.ts` or the message-panel click handler in `platform.ts` / `io-wiring.ts`. **S**

- [ ] **B107 — Staff of firebolt does not ignite dry wooden barricades** — Zapping a dry
      wooden barricade with a staff of firebolt has no fire effect; the barricade is not
      ignited. In C a firebolt hitting a flammable terrain feature calls `exposeTileToFire`
      which sets the tile on fire and propagates to adjacent flammable cells.
      Likely cause: `exposeTileToFire` is stubbed (`() => false`) in `tile-effects-wiring.ts`.
      C: `Items.c` (bolt impact → `exposeTileToFire`), `Time.c` (`exposeTileToFire`).
      TS: `tile-effects-wiring.ts` (`exposeTileToFire` stub), `items/staff-wiring.ts`. **S**

- [ ] **B108 — Autotiled sprites show wrong on first dungeon render (pixel art mode)** —
      When loading a new game with pixel art (Tiles) mode enabled, autotiled sprites (walls,
      floors — the only two currently using autotile sheets) display incorrectly on the
      initial frame. They appear to show only the background/tint color rather than the
      actual sprite. Cells render correctly once the player moves (triggering FOV-based
      redraw) or on mouse hover. Non-autotiled sprites render correctly on the first frame.
      Likely cause: either a missing `forceFullRedraw()` at game start, or `tileType` being
      `undefined` on initial cells so they hit the legacy `drawCell` path instead of the
      layer pipeline (`getCellSpriteDataFn`), or the `getCellSpriteDataFn` callback not
      being wired at the time of the first `commitDraws()`.
      TS: `platform.ts` (`commitDraws`, `forceFullRedraw`), `browser-renderer.ts`
      (`plotChar` tile/layer branching), `bootstrap.ts` (renderer initialization timing). **S**

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
