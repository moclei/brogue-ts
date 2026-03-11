# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-10 (after port-v2-close-out Phases 1–5)
**Tests at last update:** 88 files · 2242 pass · 82 skip

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

---

## Priority 1 — Divergences (behavior wrong vs C)

These produce incorrect gameplay. Fix before anything cosmetic.

Complexity key: **S** = small/self-contained · **M** = medium, needs context work ·
**L** = large, multi-file

- [ ] **`canPass` stub** — `() => false` in movement context; monster traversal rules
  not wired. Affects monster pathfinding through each other and obstacles.
  C: `Movement.c` (`canPass` / passability checks in movement cost maps).
  TS: `movement.ts` context builder. test.skip: `movement.test.ts:331`. **M**

- [ ] **`getImpactLoc` stub** — returns target as-is; no bolt path trace. Affects
  targeting accuracy for thrown items and bolt-firing staves/wands.
  C: `Items.c` (bolt geometry). TS: `items/bolt-geometry.ts` or movement context.
  test.skip: `movement.test.ts:324`. **M**

- [ ] **`traversiblePathBetween` uses Bresenham** — should use bolt `getLineCoordinates`.
  Affects monster line-of-sight checks for ranged attacks.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:310`. **S**

- [ ] **`moveAlly` — wrong attack leash metric** — uses distance-to-enemy instead of
  distance-to-player. Ally monsters disengage at wrong range.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:455`. **S**

- [ ] **`moveAlly` — missing `monsterHasBoltEffect` guard** — blink-to-safety fires
  when the ally doesn't have a blink bolt.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:443`. **S**

- [ ] **`makeMonsterDropItem` — not using `getQualifyingPathLocNear`** — drops items
  in-place unconditionally instead of finding a nearby valid cell.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:477`. **S**

- [ ] **`refreshWaypoint` — missing PDS_FORBIDDEN marking** — sleeping, immobile, and
  captive monsters should be marked forbidden in waypoint cost maps but aren't.
  Affects monster pathfinding around stunned/sleeping enemies.
  C: `Movement.c`. TS: `movement/` waypoint code.
  test.skip: `tests/architect-level-setup.test.ts:500`. **S**

- [ ] **`welcome()` — amulet not colorized** — opening message doesn't call
  `encodeMessageColor` on the Amulet of Yendor name. Visual divergence.
  C: `RogueMain.c`. TS: `game/game-init.ts`.
  test.skip: `tests/game.test.ts:264`. **S**

---

## Priority 2 — Incomplete implementations (missing branches)

Code exists but is missing chunks present in C.

- [ ] **`moveAlly` — missing corpse-eating and scent-follow branches** — allied monsters
  don't eat corpses to gain abilities, and don't use scent to return to leader.
  C: `Monsters.c` (moveAlly). TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:466`. **M**

- [ ] **`startLevel` — missing updateEnvironment simulation loop** — on level entry,
  C runs `while (timeAway--) { updateEnvironment(); }` (up to 100 iterations).
  TS skips this entirely. Fire spread, swamp gas, brimstone don't evolve during
  level transitions.
  C: `RogueMain.c` (startLevel). TS: `game/game-level.ts`.
  test.skip: `tests/game/game-level.test.ts:186`. Fix note in test comment. **S**

---

## Priority 3 — Unwired (implementations exist, not connected)

The domain function exists in TS; it's just not passed into the context that calls it.
These are wiring tasks — read the existing implementation, find the context builder,
replace the stub closure.

- [ ] **`enableEasyMode`** — no-op in input context; should delegate to lifecycle.
  C: `RogueMain.c`. TS: `io/input-context.ts` or `turn.ts`.
  test.skip: `tests/turn.test.ts:210`. **S**

- [ ] **`dropItem()` in `playerFalls` context** — stub in `turn.ts`; `startLevel`
  dependency not wired.
  C: `Items.c` (dropItem). TS: `turn.ts` (playerFalls context).
  test.skip: `tests/turn.test.ts:217`. **S**

- [ ] **`makeMonsterDropItem` in `gradualCtx`** — `() => {}` stub in `turn.ts`;
  monsters in deep water don't drop carried items.
  C: `Monsters.c`. TS: `turn.ts`.
  test.skip: `tests/turn.test.ts:227`. **S**

- [ ] **`displayLevel` in `items.ts` and `input-context.ts`** — two context builders
  have no-op `displayLevel`; only `lifecycle.ts` is wired.
  C: `IO.c`. TS: `items.ts`, `io/input-context.ts`.
  test.skip: `tests/ui.test.ts:418`. **S**

- [ ] **`extinguishFireOnCreature`** — no-op in monster state context; needs
  `CreatureEffectsContext` wired in.
  C: `Time.c`. TS: `monsters.ts` context builder.
  test.skip: `tests/monsters.test.ts:271`. **S**

- [ ] **`buildMachine` in monster spawning context** — no-op; needs the machine
  builder wired in (it's called when monsters spawn guardians).
  C: `Architect.c`. TS: `monsters.ts` spawning context.
  test.skip: `tests/monsters.test.ts:242`. **M**

- [ ] **`getQualifyingPathLocNear`** — returns provided loc unconditionally; real
  pathfinding (find nearest passable cell near a pos) not wired.
  C: `Grid.c`. TS: stubs in `monsters.ts`, `movement.ts`.
  test.skip: `tests/monsters.test.ts:208`. **M**

---

## Priority 4 — Missing ports (need porting from C source)

These don't exist in TS yet. Port the C function, add context plumbing, wire it in.

- [ ] **`updateFlavorText`** — creature description text shown in sidebar when hovering
  over a monster. Currently no-op.
  C: `IO.c` (updateFlavorText). TS: `ui.ts` sidebar context.
  test.skip: `tests/ui.test.ts:304`. **M**

- [ ] **`flashTemporaryAlert`** — brief screen flash on notable events (level up, potion
  identifies, etc.). Currently no-op.
  C: `IO.c` (flashTemporaryAlert). TS: `ui.ts` display context.
  test.skip: `tests/ui.test.ts:318`. **M**

- [ ] **`updateMonsterCorpseAbsorption`** — advances corpse-absorption state for
  monsters that eat corpses to gain abilities (e.g. wraiths, vampires).
  Actual gameplay mechanic, not cosmetic.
  C: `Monsters.c`. TS: `monsters/monster-actions.ts` or similar.
  test.skip: `tests/monsters/monster-actions.test.ts:576`. **M**

- [ ] **`applyInstantTileEffectsToCreature`** — applies terrain effects to a creature
  that steps onto or is on a cell: tall grass trampling (`T_PROMOTES_ON_STEP`), fire
  damage, web entanglement, etc. Previously "permanently deferred" due to async cascade
  concerns; now in scope. Required by B13 (tall grass).
  C: `Time.c`. TS: needs porting + wiring into `movement.ts` player-move context.
  Note: the async cascade risk is real — stepping onto fire must `await` the burn
  message. Map the cascade before writing code. **M**

- [ ] **`drawManacles`** — draws manacle terrain decorations adjacent to a chained
  monster on level entry. Visual, but present in C.
  C: `Monsters.c`. TS: `monsters.ts` or `lifecycle.ts`.
  test.skip: `tests/monsters.test.ts:322`. **S**

- [ ] **`fadeInMonster`** — animation for a monster appearing on-screen (used when
  summoned or revealed). Currently no-op.
  C: `IO.c`. TS: `monsters.ts` or `items/monster-spell-effects.ts`.
  test.skip: `tests/items.test.ts:292`. **S**

---

## Priority 5 — Debug overlays

Were in the C game. Port from `IO.c`. Each is a grid-visualization helper that
renders a number grid or flag map over the dungeon for debugging. They share the
same pattern: iterate the dungeon grid, call `plotCharWithColor` for each cell.

- [ ] **`displayGrid`** — renders a numeric grid over the dungeon.
  C: `IO.c`. test.skip: `tests/ui.test.ts:477`. **S**

- [ ] **`displayWaypoints`** — renders waypoint indices.
  C: `IO.c`. test.skip: `tests/ui.test.ts:483`. **S**

- [ ] **`displayMachines`** — renders machine room numbers.
  C: `IO.c`. test.skip: `tests/ui.test.ts:489`. **S**

- [ ] **`displayChokeMap`** — renders choke-point distances.
  C: `IO.c`. test.skip: `tests/ui.test.ts:495`. **S**

- [ ] **`displayLoops`** — renders loop detection data.
  C: `IO.c`. test.skip: `tests/ui.test.ts:501`. **S**

---

## Bug reports from playtesting

Add bugs here as they are found. Fix highest-priority bugs first (P1 before P2, etc.).
After fixing, move the entry to SESSIONS.md with a brief explanation of the fix.

### P1 — Blocking / crashes

- [ ] **B6 — Crash on throw + pressure plate** — Threw a dart onto a pressure plate
  that should open a cage; game crashed after throw resolved. Throw itself worked;
  crash is downstream — likely in the machine trigger that fires when the pressure
  plate is activated (dungeon feature spawning, cage-open mechanic, monster release).
  Investigate: `spawnDungeonFeature`, terrain promotion chain, `applyTileEffectsToCreature`.
  C: `Items.c` (throwItem → removeItemAt → T_PROMOTES_ON_ITEM_PICKUP chain),
  `Architect.c` (machine trigger). Start by reading the crash stack trace in the console. **L**

- [ ] **B7 — Die → New Game does nothing** — After dying, selecting New Game from the
  death screen has no effect. The game does not restart.
  C: `RogueMain.c` (gameOver → mainInputLoop → NEW_GAME_KEY handling).
  TS: `game/game-lifecycle.ts` gameOver, `menus.ts` post-death menu. **M**

- [ ] **B8 — Items in treasure rooms show as `?`** — All items in treasure/item rooms
  display as `?` instead of their actual glyphs. Likely `displayChar` not set on
  generated items, or the item rendering branch in `getCellAppearance` is falling
  through to a fallback. Check `item-generation.ts` and `getCellAppearance` item path.
  C: `Items.c` (item generation sets displayChar per category). **M**

- [ ] **B9 — Key shows as "unknown item" on pickup** — On picking up a key, the message
  reads "you now have an unknown item (k)". `itemName` is returning the fallback string
  for KEY category items.
  C: `Items.c` (itemName, key category naming). TS: `items/item-naming.ts`. **S**

### P2 — Visible gameplay divergences

- [ ] **B10 — Aiming: no path shown** — When targeting with the mouse (throw/zap),
  the bolt/throw path from player to cursor is not drawn. In C, `chooseTarget` draws
  the path using `drawBoltLine` or similar each cursor move.
  C: `IO.c` (chooseTarget, drawBoltLine). TS: `io/input-cursor.ts`, `items/targeting.ts`. **M**

- [ ] **B11 — Aiming: no target details shown** — When hovering over a cell during
  targeting, no description of the target appears (monster name, item, terrain).
  In C, this updates the sidebar/message area via `printMonsterDetails` or `updateFlavorText`.
  C: `IO.c`. TS: `io/input-cursor.ts`. Note: relates to `updateFlavorText` (Priority 4). **M**

- [ ] **B12 — Gas (bloodwort) does not spread** — Gas from a bloodwort plant stays at
  its origin as a single red cloud spot and never dissipates or spreads to adjacent
  cells. In C, gas diffuses and dissipates each turn via `updateEnvironment`.
  Likely cause: `updateEnvironment` not called per turn, OR gas volume not being
  decremented. Relates to Priority 2 item `startLevel updateEnvironment` — but that
  is the level-entry simulation; per-turn gas spreading is a separate call site.
  C: `Time.c` (updateEnvironment → gas diffusion). TS: `time/` or `turn.ts`. **M**

- [ ] **B13 — Tall grass not trampled on walkover** — Walking over tall grass does not
  convert it to short grass (or bare floor). In C this is driven by
  `applyInstantTileEffectsToCreature` checking `T_PROMOTES_ON_STEP` terrain flags.
  This function was previously "permanently deferred" but is now in scope.
  C: `Time.c` (applyInstantTileEffectsToCreature). TS: likely needs porting + wiring
  into `movement.ts` player move context. **M**

### P3 — Minor / cosmetic

- [ ] **B14 — No message when exploration complete** — When auto-explore has nowhere
  left to go (whole map explored, or path unreachable), no message appears. In C a
  message like "Nowhere left to explore." or "Exploration interrupted." is shown.
  C: `Movement.c` or `RogueMain.c` (autoTravel / explore path). TS: `movement/travel-explore.ts`. **S**

### Needs investigation (not yet classified)

- [ ] **B15 — Item/treasure rooms appearing on depth 1** — Treasure rooms and item
  vaults were observed on the first floor. Unclear if this is intended (some machines
  have no minimum depth in C) or a level-generation depth-guard bug. Investigate:
  read machine catalog minimum-depth conditions in C; compare to TS machine catalog
  and `buildAMachine` depth checks before classifying as bug or acceptable behavior.
  C: `Architect.c` (buildAMachine, machine catalog depth guards). **investigate first**

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
