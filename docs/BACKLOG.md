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

- [x] **B49 — Pressure plate → steam vent → crash ~2 moves later** — Stepping on a pressure
      plate triggered steam from two vents. The game crashed approximately two moves after the
      event, not immediately. The delayed crash suggests a corrupt/dangling reference introduced
      during the terrain-effect chain rather than a direct throw. Possible causes: monster or
      item list mutation during `applyInstantTileEffectsToCreature` (gas spawn kills/moves a
      creature mid-iteration), or a `spawnDungeonFeature` stub silently producing inconsistent
      pmap state that a subsequent turn-pass then trips over.
      ⚠️ **Confirm before coding:** hard to reproduce; need to isolate seed + sequence. The
      crash may have been incidental — confirm it is still present and stems from the pressure-plate
      event rather than unrelated monster-turn processing.
      Don't fix it right away! instead, let the user know what you think the bug is, and ask for permission to fix.
      C: `Time.c` (applyInstantTileEffectsToCreature), `Architect.c` (triggerMachinesOfKind).
      TS: `tile-effects-wiring.ts`, `time/creature-effects.ts`. **M**

- [x] **B51 — Depth transition: first-turn monsters not drawn until player moves** — On
      entering a new dungeon level, monsters that should be immediately visible in the player's
      field of view are not rendered. After the player takes one move they appear correctly.
      Likely cause: `displayLevel` or `commitDraws` is called before monster positions are
      stamped onto the display buffer in the level-entry sequence, so the first frame shows an
      empty dungeon and monsters only appear after the next full turn redraw.
      C: `RogueMain.c:547` (startLevel), `IO.c` (displayLevel, displayMonster).
      TS: `lifecycle.ts` (buildLevelContext / startLevel sequence), `turn-processing.ts`. **S**

- [x] **B57 — Scroll of negation crashes the game** — Cannot reproduce. Static analysis
      shows both crash candidates are already handled: `[...monsters]` snapshot at
      `item-effects.ts:90` prevents list mutation; all `NegateContext` callbacks in
      `items.ts:negateCtx` are wired to real functions (not `() => {}` stubs). Crash was
      likely coincidental or fixed as part of B44 wiring. Fixed gap: `refreshSideBar` was
      not called after NEGATABLE_TRAITS strip (C: `Monsters.c:3797`); added to
      `NegateContext` and wired in `negateCtx`.
      C: `Items.c` (negationBlast, readScroll SCROLL_NEGATION:4080).
      TS: `items/item-handlers.ts` (negationBlast), `items.ts` (NegateContext). **M**

- [x] **B67 — Potion of paralysis: status appears instant (no tick-down)** — After drinking
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

- [x] **B70 — While hallucinating, monster names show their real name on hit** — When
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

- [x] **B85 — Trapped key rooms: machine effects don't fire on key pickup** — Several
      vault key room traps fail to trigger:
  1. A room full of vegetation does not catch fire when the key is picked up.
  2. A vault door key room trap fires no effect at all.
  3. A paralysis-gas + rat-swarm room: "paralyzed" message shows and the false walls
     immediately snap to their broken state, but no rats emerge. In C the false walls
     should shatter one-by-one over several turns (each with an animation), spawning a
     rat per wall; the player is trapped inside the swarm for the duration. The paralyze
     gas behaviour is tracked separately (B67).
     All three point to machine trigger logic not firing `spawnDungeonFeature`,
     `exposeTileToFire`, or `spawnHorde` on the key-pickup event. Related stubs:
     `spawnDungeonFeature: () => {}` in `tile-effects-wiring.ts:438`, `items.ts:375`,
     `items/staff-wiring.ts:438`; `exposeTileToFire: () => false` in
     `tile-effects-wiring.ts:128`; `spawnHorde: () => null` in `lifecycle.ts:326`.
     C: `Architect.c` (`triggerMachinesOfKind`, machine effect dispatch),
     `RogueMain.c` (machine-key pickup handler).
     TS: `tile-effects-wiring.ts`, `lifecycle.ts`, `items/item-commands.ts`. **M**
     ⚠️ **Needs playtest confirmation** — stubs wired in PR #72, but these rooms are
     rare so the fix hasn't been verified in-game yet.

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

- [x] **B90 — Auto-eat loop: hunger message repeats but satiety does not restore** — When
      the player reaches "starving" hunger the game shows "Unable to control your hunger, you
      eat a ration of food" on every turn, but the hunger/satiety level never increases. The
      loop continues until the player manually eats. Additionally, eating a ration manually
      does not update the hunger bar until the next move.
      Root cause: `eat: () => {}` is stubbed in `tile-effects-wiring.ts:289`, so auto-eat
      fires the message but never calls the real eat logic. Sidebar refresh on manual eat may
      also be missing a `refreshSideBar` call.
      C: `Time.c` (`applyInstantTileEffectsToCreature` hunger branch), `Items.c` (`eat`).
      TS: `tile-effects-wiring.ts:289`, `items/item-commands.ts`. **S**

- [ ] **B92 — "Quit and abandon run" menu option does nothing** — Opening the in-game
      menu and selecting "Quit and abandon" has no effect; the game continues. The quit path
      does not depend on persistence/recordings so it should be wireable now.
      C: `RogueMain.c` (`gameOver` / quit-without-save branch).
      TS: `menus.ts`, `lifecycle-gameover.ts`. **S**
      ⚠️ **Re-opened** — a fix was applied in PR #70 but playtesting re-confirmed the issue
      is still present. The menu option still has no effect after the fix.

- [ ] **B93 — “You see an eel” message fires when the eel is submerged** — The message area
      says “you see an eel” when no eel is visible on the map (they are submerged). This spoils
      the intended mechanic of eels submerging and surprising the player. Additionally, the side
      panel shows “Something” with health bars and status for submerged eels, which should also
      be hidden. Root cause: `monsterCanSubmergeNow: () => false` is stubbed in
      `io/sidebar-wiring.ts:332` and `turn-monster-ai.ts:219`, causing submerged monsters to
      always appear visible.
      C: `IO.c` (`canSeeMonster` / submerge visibility gate).
      TS: `io/sidebar-wiring.ts:332`, `turn-monster-ai.ts:219`. **S**
      ⚠️ **Re-opened** — a fix was attempted but playtesting re-confirmed the issue is still
      present. Submerged eels continue to trigger “you see an eel” messages and sidebar entries.

- [ ] **B94 — Wands always show the same unidentified appearance ("bronze")** — All
      unidentified wands display the same descriptor ("bronze") rather than drawing from the
      randomized appearance table generated at game start. Likely cause: the per-run item
      appearance shuffle (wand color/material table) is either not called or not stored, so
      all wands fall back to the same default entry.
      C: `Items.c` (`initializeItemTable` — appearance randomization for wands/staffs/potions/
      scrolls/rings).
      TS: item initialization in `lifecycle.ts` or `items.ts`. **M**

- [x] **B97 — Monsters disappear during multi-monster combat and reappear on player move** —
      When fighting a group of monsters, one or more monsters visually vanish mid-combat
      and reappear after the player moves. Root cause: `runicCtx.setMonsterLocation` in
      `combat.ts` used `HAS_MONSTER` for all creatures (including the player) and never
      called `refreshDungeonCell`. When a monster with `MA_ATTACKS_STAGGER` hit the player,
      the stagger push left a stale `HAS_PLAYER` flag at the player's old tile; a second monster
      could then "move into" that tile (monsterAtLoc returned null), stacking `HAS_MONSTER` with
      the stale `HAS_PLAYER`; getCellAppearance shows the player glyph, hiding the monster.
      C: `Combat.c:processStaggerHit`, `Monsters.c:setMonsterLocation`.
      TS: `combat.ts` (`runicCtx.setMonsterLocation`). **S**
      ⚠️ **Needs playtest confirmation** — fix was applied (PR #66) but the original symptom
      could not be reliably reproduced afterward. If the bug resurfaces, re-add these two
      diagnostic logs and reproduce: 1. In `combat-attack.ts:attack()` entry: log attacker/defender names, locs, and
      `ctx.cellFlags(loc).toString(16)` for both. 2. In `turn-processing.ts:playerTurnEnded()` just before `removeDeadMonsters()`: call
      a consistency checker that warns on (a) `HAS_PLAYER` set at any cell other than
      `player.loc`, (b) `HAS_MONSTER` set at a cell with no live monster, (c) a live
      monster whose cell has no `HAS_MONSTER`. The warning type tells you which hypothesis
      (stale flag vs. missing refresh) is the real cause.

- [ ] **B96 — Explore oscillation after item pickup; item shown on floor despite being in inventory** —
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

- [x] **B98 — No death animation** — When the player dies, there is no death animation.
      In C the screen flashes and the player glyph animates before the game-over screen.
      C: `RogueMain.c` / `IO.c` (death animation sequence).
      TS: `lifecycle-gameover.ts` or `menus.ts`. **S**

- [ ] **B99 — Play/View buttons show rectangle icon instead of left-arrow** — The "Play"
      and "View" buttons on the main menu show a box/rectangle icon instead of the expected
      left-facing arrow (▶). Likely a font or glyph mapping issue in the button renderer.
      C: `IO.c` (button glyph rendering).
      TS: `io/buttons.ts` or the main-menu UI. **S**

- [x] **B100 — All traps visible by default** — All trap tiles on the dungeon floor are
      visible to the player from the start, with no fog-of-war hiding them. In C traps are
      hidden unless the player is adjacent or has detected them. Likely cause: the
      `DISCOVERED` flag or the trap visibility check is not set correctly during dungeon
      generation or the FOV render.
      C: `IO.c` (`getCellAppearance` trap visibility), `Architect.c` (trap placement).
      TS: `io/display.ts` or `vision-wiring.ts`. **M**
      — **Sprite path fixed (PR #93):** `getCellSpriteData` now masks `TM_IS_SECRET` tiles
      as `TileType.FLOOR` so hidden traps no longer render as dark voids.
      — **ASCII path WAI (confirmed PR #94):** `getCellAppearance` already returns
      `{glyph:32, black, black}` for undiscovered cells via early return (line 318), before
      any layer loop or TM_IS_SECRET processing. Hidden traps use `displayChar: G_FLOOR`
      anyway, so even discovered-but-unseen memory shows them as a floor dot (correct).
      Regression test added to `tests/io/cell-appearance.test.ts`.

- [x] **B101 — Monkey steals item; item is lost when monkey killed** — When a monkey steals
      an item from the player and is then killed, the item disappears instead of being dropped
      on the floor. Or maybe it was never actually removed from the player inventory? In C a monkey steals an item, flees, and killing it causes the item to be dropped.
      C: `Monsters.c` (`killCreature` / item-drop on death).
      TS: `monsters/monster-death.ts` or combat kill path. **S**

- [x] **B102 — Fire status visual effect never clears after player stops burning** — After the
      player stops being on fire, the fire visual effect (animated flames) persists on-screen
      indefinitely. The burning status clears correctly in the sidebar but the tile/display
      overlay is not removed.
      C: `IO.c` (fire overlay rendering, status-based display).
      TS: `io/display.ts` or status rendering in the turn loop. **S**

- [x] **B103 — Potion of invisibility: monsters didn't disengage** — After drinking a potion
      of invisibility monsters that were tracking the player continued to pursue as if the
      player were visible. In C drinking invisibility should cause tracking monsters to lose
      the scent trail and return to wandering.
      C: `Items.c` (`drinkPotion` invisibility branch), `Monsters.c` (scent/tracking reset).
      TS: `items/item-handlers.ts`, `monsters/monster-ai.ts`. **S**
      **WAI** — TS matches C ground truth. stealthRange=1 (invisible) reduces awareness to 2;
      monsters beyond ~3 tiles (scentDistance > 6) immediately disengage. Nearby monsters
      within range use randPercent(97) which is the same slow-disengage C behaviour.
      stealthRange is updated after monster turns (1-turn delay) in both C and TS.
      Tests added: `rogue-ts/tests/monsters/monster-awareness.test.ts`.

- [x] **B104 — Messages panel should expand on click to show scroll history** — Clicking the
      message area should open a scrollable message history overlay. Currently clicking does
      nothing. In C pressing `M` (or clicking the message panel) opens the full log.
      C: `IO.c` (message history display).
      TS: `menus.ts` or the message-panel click handler in `platform.ts` / `io-wiring.ts`. **S**

- [x] **B105 — `updateSafetyMap` crash: `ctx.coordinatesAreInMap is not a function`** —
      Confirmed in two separate playtesting sessions (confusion potion use; fighting a monkey):
      the game crashes with `TypeError: ctx.coordinatesAreInMap is not a function` at
      `safety-maps.ts:300` → `updateSafetyMap` → `turn-monster-ai.ts:550` → `getSafetyMap`
      → `monster-flee-ai.ts:81` → `monstersTurn` → `turn.ts`. The `coordinatesAreInMap`
      function is missing from whichever context is passed to `updateSafetyMap` when called
      from `getSafetyMap` in the monster-AI path.
      C: `Monsters.c` (`updateSafetyMap` / safety-map context).
      TS: `turn-monster-ai.ts:550` (getSafetyMap call site), `safety-maps.ts:300`. **P1**

- [x] **B106 — BigInt/Number type error in `rechargeItemsIncrementally` when equipping ring of wisdom** —
      Fatal bootstrap error on equipping a ring of wisdom: `TypeError: Cannot mix BigInt and
      other types, use explicit conversions` at `misc-helpers.ts:159:54`. Stack:
      `rechargeItemsIncrementally` → `turn.ts:567` → `playerTurnEnded` (turn-processing.ts:616)
      → `equip` (inventory-actions.ts:164) → `displayInventory` → `executeKeystroke`.
      Root cause: `rechargeItemsIncrementally` context wiring in `turn.ts` and `combat.ts`
      passed the raw BigInt `FP_FACTOR` and `ringWisdomMultiplierFn` (which takes/returns `Fixpt`)
      directly into a context typed as `number`. The multiplication `wisdomBonus * FP_FACTOR`
      mixed `number × BigInt`, crashing at runtime. Fixed by wrapping both in number↔BigInt
      converters at the wiring site.
      C: `Time.c` (`rechargeItemsIncrementally`), `Rogue.h` (`fixpt` type).
      TS: `turn.ts:571`, `combat.ts:400`. **S**

- [ ] **B107 — Staff of firebolt does not ignite dry wooden barricades** — Zapping a dry
      wooden barricade with a staff of firebolt has no fire effect; the barricade is not
      ignited. In C a firebolt hitting a flammable terrain feature calls `exposeTileToFire`
      which sets the tile on fire and propagates to adjacent flammable cells.
      Likely cause: `exposeTileToFire` is stubbed (`() => false`) in `tile-effects-wiring.ts`.
      C: `Items.c` (bolt impact → `exposeTileToFire`), `Time.c` (`exposeTileToFire`).
      TS: `tile-effects-wiring.ts` (`exposeTileToFire` stub), `items/staff-wiring.ts`. **S**

- [x] **B108 — Autotiled sprites show wrong on first dungeon render (pixel art mode)** —
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
