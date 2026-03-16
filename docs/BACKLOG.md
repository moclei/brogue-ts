# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-15 (B58 fixed; B66 fixed; B71 fixed; B81 fixed; B50 fixed)
**Tests at last update:** 88 files · 2317 pass · 55 skip

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

- [ ] **B49 — Pressure plate → steam vent → crash ~2 moves later** — Stepping on a pressure
  plate triggered steam from two vents. The game crashed approximately two moves after the
  event, not immediately. The delayed crash suggests a corrupt/dangling reference introduced
  during the terrain-effect chain rather than a direct throw. Possible causes: monster or
  item list mutation during `applyInstantTileEffectsToCreature` (gas spawn kills/moves a
  creature mid-iteration), or a `spawnDungeonFeature` stub silently producing inconsistent
  pmap state that a subsequent turn-pass then trips over.
  ⚠️ **Confirm before coding:** hard to reproduce; need to isolate seed + sequence. The
  crash may have been incidental — confirm it is still present and stems from the pressure-plate
  event rather than unrelated monster-turn processing.
  C: `Time.c` (applyInstantTileEffectsToCreature), `Architect.c` (triggerMachinesOfKind).
  TS: `tile-effects-wiring.ts`, `time/creature-effects.ts`. **M**

- [ ] **B51 — Depth transition: first-turn monsters not drawn until player moves** — On
  entering a new dungeon level, monsters that should be immediately visible in the player's
  field of view are not rendered. After the player takes one move they appear correctly.
  Likely cause: `displayLevel` or `commitDraws` is called before monster positions are
  stamped onto the display buffer in the level-entry sequence, so the first frame shows an
  empty dungeon and monsters only appear after the next full turn redraw.
  C: `RogueMain.c:547` (startLevel), `IO.c` (displayLevel, displayMonster).
  TS: `lifecycle.ts` (buildLevelContext / startLevel sequence), `turn-processing.ts`. **S**

- [ ] **B52 — Teleport scroll / teleport bolt: player symbol missing until next move** —
  After the player teleports (via scroll or bolt), the `@` glyph at the destination is not
  drawn until the player takes another action. The old position is correctly cleared. Likely
  cause: `refreshDungeonCell` is called for the old location but not the new one, or
  `commitDraws` is not called after the teleport resolves, leaving the canvas stale for one
  frame.
  C: `Items.c` (teleport → refreshDungeonCell), `IO.c` (displayLevel / commitDraws).
  TS: `monsters/monster-teleport.ts`, `items.ts`, `vision-wiring.ts`. **S**

- [ ] **B56 — Ascending stairs shows fog-of-war artifacts from the lower level** — When
  transitioning back up to a previously explored level, cells that should show fog-of-war
  (remembered but currently unseen) instead display stale glyph/color data from the level
  below. The player must re-explore those cells for them to render correctly. B28 addressed
  a similar artifact when descending; this is the ascending direction, likely a missing
  `displayLevel` / buffer reset before the restored level is drawn.
  C: `RogueMain.c:643` (startLevel → storeMemories), `IO.c` (displayLevel).
  TS: `lifecycle.ts` (level transition sequence), `movement/travel-explore.ts` (stair
  traversal → startLevel call). **S**

- [ ] **B57 — Scroll of negation crashes the game** — Using a scroll of negation caused a
  crash. `negateCreature` is wired (B44/earlier), but `negationBlast` (the scroll handler)
  iterates all monsters in FOV and calls `negate` on each. The crash may come from list
  mutation during that iteration (a negated monster can die via `MONST_DIES_IF_NEGATED`),
  or from a missing callback in the `NegateContext` (e.g. `extinguishFireOnCreature` or
  `applyInstantTileEffectsToCreature` is `() => {}` and the negation chain tries to use
  the return value).
  ⚠️ **Confirm before coding:** reproduce with a scroll of negation. Check whether the
  crash is in `negationBlast` itself or in a `killCreature` / `removeCreature` callback
  triggered mid-loop.
  C: `Items.c` (negationBlast, readScroll SCROLL_NEGATION:4080).
  TS: `items/item-handlers.ts` (negationBlast), `items.ts` (NegateContext). **M**

- [x] **B58 — Eels don't re-submerge in water after surfacing** — Electric eels (and
  similar aquatic monsters) surface once to attack or become visible, but do not go back
  underwater. In C, `updateMonsterState` checks `monsterCanSubmergeNow` each turn and sets
  `MB_SUBMERGED` when the monster is on a submerging tile and no combat is occurring. The
  correct C behavior is: once out of attack range the eel retreats back to the water tile and
  the `MB_SUBMERGED` flag hides it again (so the player can no longer see it). In TS, eels
  stay visible and keep fighting without retreating. Either `monsterCanSubmergeNow` is a
  stub, it returns false when it should return true, or `MB_SUBMERGED` is cleared but never
  re-set because the relevant branch in `updateMonsterState` / `monsterAvoids` is not reached.
  C: `Monsters.c:1977` (updateMonsterState submerge branch).
  TS: `monsters/monster-state.ts` (monsterAvoids, updateMonsterState). **S**

- [ ] **B62 — Pit bloat fall: no message or keypress before showing lower level** — When a
  pit bloat explodes beneath the player, the game jumps immediately to the lower level with
  no feedback. In C, a "you fell" message (e.g. "you tumble into the depths!") is displayed
  with `REQUIRE_ACKNOWLEDGMENT` before the level transition is rendered.
  C: `Time.c` / `RogueMain.c` (player-fall code path triggered by `DF_PIT_BLOAT_HOLE` /
  `changeLevelIfAppropriate`).
  TS: `lifecycle.ts` (level-transition sequence), `movement/travel-explore.ts`. **S**

- [ ] **B64 — Staff of obstruction does nothing** — Zapping a staff of obstruction has no
  visible effect. In C, `BOLT_OBSTRUCTION` spawns crystal terrain features along the bolt
  path via `spawnDungeonFeature`. The effect stub or the bolt-detonation handler for
  `BoltEffect.Obstruction` may be missing.
  C: `Items.c` (BOLT_OBSTRUCTION bolt effect).
  TS: `items/bolt-detonation.ts` or `items/zap-context.ts` (Obstruction case). **S**

- [ ] **B65 — Creatures can occupy the same square as the player** — Monsters can move
  onto the player's tile without triggering combat or being blocked. Likely a missing
  `HAS_MONSTER` / `HAS_PLAYER` flag check in the TS monster movement code, or
  `monsterAvoids` not correctly returning true for the player's tile.
  C: `Monsters.c` (moveMonsterPassively, monsterAvoids, `HAS_PLAYER` flag checks).
  TS: `monsters/monster-movement.ts`. **M**

- [ ] **B67 — Potion of paralysis: status appears instant (no tick-down)** — After drinking
  a paralysis potion the paralysis status seems to appear and vanish without visibly counting
  down. Either `decrementPlayerStatus` for `STATUS_PARALYZED` is not firing each turn, the
  sidebar is not refreshing to show intermediate values, or `haste` / `paralysis` duration is
  being set to 1.
  C: `Time.c:decrementPlayerStatus`, `Items.c:drinkPotion` (paralysis case).
  TS: `time/turn-processing.ts` (decrementPlayerStatus call), `items/item-handlers.ts`
  (paralysis case). **S**

- [ ] **B68 — Hallucination visual slightly different from C game (needs investigation)** —
  Hallucination mode looks roughly correct but differs subtly from C. Likely candidates:
  wrong color range, wrong randomized-glyph set, or color randomization applied at wrong
  layer. Requires side-by-side comparison with C.
  C: `IO.c` (hallucination rendering in `getCellAppearance` / `displayLevel`).
  TS: `io/display.ts` or render pipeline. **S**

- [ ] **B69 — Ring items rendered as filled circles, not 'o' character** — Ring items appear
  as filled Unicode circle glyphs instead of the ASCII `'o'` (0x6F) the C game uses. The
  ring glyph in `Rogue.h` is `RING_CHAR` = `'o'`. Check the TS item-glyph table or the
  glyph-map entry for `ItemCategory.RING`.
  C: `Rogue.h` (`RING_CHAR` constant).
  TS: `platform/glyph-map.ts` or item-glyph constants in `types/`. **S**

- [ ] **B70 — While hallucinating, monster names show their real name on hit** — When
  hallucinating, the combat message should use a random fake monster name (as in C). The TS
  `monsterName` helper likely does not check `player.status[STATUS_HALLUCINATING]` before
  deciding which name to return.
  C: `IO.c:monsterName` (hallucination branch).
  TS: wherever `monsterName` is built in item or combat contexts. **S**

- [ ] **B71 — Staffs/charms/wands/rings not identified on entering a vault (B25 revisit)** —
  B25 was marked WAI, but playtest suggests C does auto-identify non-weapon/non-armor vault
  items (staffs, charms, wands, rings) when the player first steps into the vault. Weapons
  and armor are not auto-identified. Requires C source verification before coding.
  C: `Items.c` (vault entry / `checkForMissingKeys` / `identifyItemKind`).
  TS: `turn.ts` or `items/item-handlers.ts` (vault-entry scan). **M**

- [ ] **B72 — Vault cage-closing animation fires immediately on item pickup** — After picking
  up an item from a vault, the remaining items immediately change color to show they are
  caged. In C the cage-close effect is deferred: it fires on the turn after the player steps
  off the pickup square, with a brief per-item animation. Fix requires the cage-close
  trigger to be deferred by one turn and the animated effect to be wired.
  C: `Architect.c` (machine done-check / cage promotion).
  TS: `turn.ts` (`updateEnvironment` / machine state). **M**

- [ ] **B73 — "Discovered items" menu closes immediately on mouse move** — Opening the
  discovered-items screen (via the menu) and then moving the mouse dismisses it. The screen
  should wait for an explicit keypress. The event loop for this screen is likely calling
  `pauseAndCheckForEvent` or `nextBrogueEvent` and treating `MouseEnteredCell` as a dismiss
  event.
  C: `IO.c` (displayInventory / item-screen event loop).
  TS: `menus.ts` or the discovered-items display handler. **S**

- [ ] **B75 — `monsterBlinkToSafety` uses stubbed `updateSafetyMap`** — Monsters with a
  blink-to-safety bolt (e.g. will-o-wisps) blink to a random/suboptimal destination
  instead of the genuinely safest reachable cell, because the `blinkToSafetyCtx` in
  `turn-monster-zap-wiring.ts:549` has `updateSafetyMap: () => {}`.
  C: `Monsters.c:monsterBlinkToSafety` uses the global safety map.
  TS: `turn-monster-zap-wiring.ts` — wire `updateSafetyMap` the same way it was done
  in `turn-monster-ai.ts` for `getSafetyMap` (PR #38). **S**

- [ ] **B76 — Fleeing monsters can path through deep water** ⚠️ RESEARCH ONLY — do not fix
  without explicit instruction. Observed: monkey fleeing through deep water when land/shallow
  routes were available. Root cause is confirmed C-faithful: `nextStep` is called with
  `null` in the flee path (C does the same), so `monsterAvoids` is skipped. Safety map
  assigns deep water cost 5 (not forbidden), so water is a valid escape path when its
  gradient is better. The proposed fix (pass `monst` instead of `null` in
  `monster-actions.ts:1149`) would enforce terrain avoidance on flee paths as a deliberate
  deviation from C. **Needs more playtesting before deciding whether to fix.**
  C: `Monsters.c:3494` — `nextStep(getSafetyMap(monst), monst->loc, NULL, true)`.
  TS: `monster-actions.ts:1149`. **S** (one-liner if approved)

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
