# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-11 (after updateMonsterCorpseAbsorption — corpse absorption now fully wired)
**Tests at last update:** 88 files · 2269 pass · 62 skip

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

## Priority 1 — Divergences (behavior wrong vs C)

These produce incorrect gameplay. Fix before anything cosmetic.

Complexity key: **S** = small/self-contained · **M** = medium, needs context work ·
**L** = large, multi-file

- [x] **`canPass` stub** — `() => false` in movement context; monster traversal rules
  not wired. Affects monster pathfinding through each other and obstacles.
  C: `Movement.c` (`canPass` / passability checks in movement cost maps).
  TS: `movement.ts` context builder. test.skip: `movement.test.ts:331`. **M**

- [x] **`getImpactLoc` stub** — returns target as-is; no bolt path trace. Affects
  targeting accuracy for thrown items and bolt-firing staves/wands.
  C: `Items.c` (bolt geometry). TS: `items/bolt-geometry.ts` or movement context.
  test.skip: `movement.test.ts:324`. **M**

- [x] **`traversiblePathBetween` uses Bresenham** — should use bolt `getLineCoordinates`.
  Affects monster line-of-sight checks for ranged attacks.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:310`. **S**

- [x] **`moveAlly` — wrong attack leash metric** — uses distance-to-enemy instead of
  distance-to-player. Ally monsters disengage at wrong range.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:455`. **S**

- [x] **`moveAlly` — missing `monsterHasBoltEffect` guard** — blink-to-safety fires
  when the ally doesn't have a blink bolt.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:443`. **S**

- [x] **`makeMonsterDropItem` — not using `getQualifyingPathLocNear`** — drops items
  in-place unconditionally instead of finding a nearby valid cell.
  C: `Monsters.c`. TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:477`. **S**

- [x] **`refreshWaypoint` — missing PDS_FORBIDDEN marking** — sleeping, immobile, and
  captive monsters should be marked forbidden in waypoint cost maps but aren't.
  Affects monster pathfinding around stunned/sleeping enemies.
  C: `Movement.c`. TS: `movement/` waypoint code.
  test.skip: `tests/architect-level-setup.test.ts:500`. **S**

- [x] **`welcome()` — amulet not colorized** — opening message doesn't call
  `encodeMessageColor` on the Amulet of Yendor name. Visual divergence.
  C: `RogueMain.c`. TS: `game/game-init.ts`.
  test.skip: `tests/game.test.ts:264`. **S**

---

## Priority 2 — Incomplete implementations (missing branches)

Code exists but is missing chunks present in C.

- [x] **`moveAlly` — missing corpse-eating and scent-follow branches** — allied monsters
  don't eat corpses to gain abilities, and don't use scent to return to leader.
  C: `Monsters.c` (moveAlly). TS: `monsters/monster-ai-movement.ts`.
  test.skip: `monsters/monster-ai-movement.test.ts:466`. **M**

- [x] **`startLevel` — missing updateEnvironment simulation loop** — on level entry,
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

- [x] **`enableEasyMode`** — no-op in input context; should delegate to lifecycle.
  C: `RogueMain.c`. TS: `io/input-context.ts` or `turn.ts`.
  test.skip: `tests/turn.test.ts:210`. **S**

- [x] **`dropItem()` in `playerFalls` context** — stub in `turn.ts`; `startLevel`
  dependency not wired.
  C: `Items.c` (dropItem). TS: `turn.ts` (playerFalls context).
  test.skip: `tests/turn.test.ts:217`. **S**

- [x] **`makeMonsterDropItem` in `gradualCtx`** — `() => {}` stub in `turn.ts`;
  monsters in deep water don't drop carried items.
  C: `Monsters.c`. TS: `turn.ts`.
  test.skip: `tests/turn.test.ts:227`. **S**

- [x] **`displayLevel` in `items.ts` and `input-context.ts`** — two context builders
  have no-op `displayLevel`; only `lifecycle.ts` is wired.
  C: `IO.c`. TS: `items.ts`, `io/input-context.ts`.
  test.skip: `tests/ui.test.ts:418`. **S**

- [x] **`extinguishFireOnCreature`** — no-op in monster state context; needs
  `CreatureEffectsContext` wired in.
  C: `Time.c`. TS: `monsters.ts` context builder.
  test.skip: `tests/monsters.test.ts:271`. **S**

- [x] **`buildMachine` in monster spawning context** — no-op; needs the machine
  builder wired in (it's called when monsters spawn guardians).
  C: `Architect.c`. TS: `monsters.ts` spawning context.
  test.skip: `tests/monsters.test.ts:242`. **M**

- [x] **`getQualifyingPathLocNear`** — returns provided loc unconditionally; real
  pathfinding (find nearest passable cell near a pos) not wired.
  C: `Grid.c`. TS: stub in `movement.ts` (`monsters.ts` wired as part of makeMonsterDropItem fix).
  test.skip: `tests/monsters.test.ts:208`. **M**

---

## Priority 4 — Missing ports (need porting from C source)

These don't exist in TS yet. Port the C function, add context plumbing, wire it in.

- [x] **`updateFlavorText`** — tile flavor text shown at the bottom of the screen
  when the player moves (rogue.disturbed = true). Wired via `buildUpdateFlavorTextFn()`
  in `io-wiring.ts`; wired into `movement.ts`, `ui.ts` (buildDisplayContext +
  buildMessageContext). Handles respiration armor, levitating, and normal terrain cases.
  C: `Time.c` (updateFlavorText). TS: `io-wiring.ts`, `movement.ts`, `ui.ts`.
  test: `tests/ui.test.ts:304`. **M**

- [x] **`flashTemporaryAlert`** — brief screen flash on notable events (level up, potion
  identifies, etc.). Wired via minimal EffectsContext in `buildMessageContext()` in `ui.ts`.
  pauseBrogue returns false synchronously; animation runs without delay in tests/browser
  (visual timing deferred until commitDraws is integrated into flash loop).
  C: `IO.c` (flashTemporaryAlert). TS: `ui.ts` display context.
  test: `tests/ui.test.ts:322`. **M**
  ⚠ Known gap: `flashMessage` animation non-functional — `EffectsContext.pauseBrogue` is
  synchronous but `MessageContext.pauseBrogue` is async; no real frame delay or commitDraws
  between steps. Fix: make `flashMessage`/`EffectsContext.pauseBrogue` async throughout.
  Filed as **B17** in bug reports below.

- [x] **`updateMonsterCorpseAbsorption`** — advances corpse-absorption state for
  monsters that eat corpses to gain abilities (e.g. wraiths, vampires).
  Actual gameplay mechanic, not cosmetic.
  C: `Monsters.c`. TS: `monsters/monster-corpse-absorption.ts`; wired in
  `turn-monster-ai.ts` via `CorpseAbsorptionContext`.
  test: `tests/monsters/monster-actions.test.ts` (stub replaced). **M**

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

- [x] **B6 — Crash on throw + pressure plate** — Threw a dart onto a pressure plate
  that should open a cage; game crashed after throw resolved. Throw itself worked;
  crash is downstream — likely in the machine trigger that fires when the pressure
  plate is activated (dungeon feature spawning, cage-open mechanic, monster release).
  Investigate: `spawnDungeonFeature`, terrain promotion chain, `applyTileEffectsToCreature`.
  C: `Items.c` (throwItem → removeItemAt → T_PROMOTES_ON_ITEM_PICKUP chain),
  `Architect.c` (machine trigger). Start by reading the crash stack trace in the console. **L**

- [x] **B7 — Die → New Game does nothing** — After dying, selecting New Game from the
  death screen has no effect. The game does not restart.
  C: `RogueMain.c` (gameOver → mainInputLoop → NEW_GAME_KEY handling).
  TS: `game/game-lifecycle.ts` gameOver, `menus.ts` post-death menu. **M**
  Fix: `freeEverything()` freed `safetyMap`, `allySafetyMap`, `chokeMap` (set to null)
  but `initializeRogue()` in `lifecycle.ts` did not re-allocate them. Second call to
  `buildLevelContext()` → `analyzeMap(pmap, null, …)` → crash. Fixed by re-allocating
  in `lifecycle.ts::initializeRogue()` when null (matches C `initializeRogue` behavior).
  Also extracted `buildLifecycleContext()` to `lifecycle-gameover.ts` to keep
  `lifecycle.ts` under 600 lines.

- [x] **B8 — Items in treasure rooms show as `?`** — All items in treasure/item rooms
  display as `?` instead of their actual glyphs. Likely `displayChar` not set on
  generated items, or the item rendering branch in `getCellAppearance` is falling
  through to a fallback. Check `item-generation.ts` and `getCellAppearance` item path.
  C: `Items.c` (item generation sets displayChar per category). **M**
  Fix: `archCtx.machineContext.itemOps.generateItem` was a stub returning `{category:0}`;
  wired to real `generateItem` in `lifecycle.ts:359`. Items now have correct `displayChar`.

- [x] **B9 — Key shows as "unknown item" on pickup** — On picking up a key, the message
  reads "you now have an unknown item (k)". `itemName` is returning the fallback string
  for KEY category items.
  C: `Items.c` (itemName, key category naming). TS: `items/item-naming.ts`. **S**
  Fix: same root cause as B8 — `generateItem` stub in machine context set `category=0`;
  `itemName` hit the `default` case. Fixed by wiring real `generateItem`.

### P1 — Blocking / crashes (continued)

- [x] **B18 — Staff use stalls or silently fails** — Two observed behaviours depending on staff type:
  (a) Game stalls (async hang) — likely bolt-firing or targeting staves that open the targeting
  cursor via `chooseTarget`; cursor opens but keypresses/clicks never resolve the await.
  Relates to B10/B11 (targeting input not forwarded). (b) Game does nothing — non-bolt staves
  whose effect function is a stub (e.g. staff of healing, blinking). Both cases need separate fixes.
  C: `Items.c` (useStaffOrWand, zap, individual staff handlers). TS: `items/item-handlers.ts`,
  `items/targeting.ts`, `io/input-cursor.ts`. **M**

- [x] **B26 — Hallucination crash: stack overflow after drinking hallucination potion** —
  After drinking a potion of hallucination and moving for ~10 turns, the game crashed with
  `RangeError: Maximum call stack size exceeded` at `partialCtx.describeHallucinatedItem` ↔
  `describeHallucinatedItem (sidebar-player.ts)`.
  Root cause: mutual recursion. The free function `describeHallucinatedItem(ctx)` in
  `sidebar-player.ts` delegated to `ctx.describeHallucinatedItem()`, while the `io-wiring.ts`
  context patch wired `ctx.describeHallucinatedItem` back to call that same free function.
  Fix: replaced the delegating free function body with a real implementation — calls
  `ctx.getHallucinatedItemCategory()` and maps the result to a category name string
  ("a potion", "a scroll", etc.) via a lookup table. The `io-wiring.ts` patch unchanged.
  TS: `io/sidebar-player.ts`. **S**

- [x] **B19 — Scroll of identify / enchanting stalls in item selection** — Both scrolls open
  the inventory/button UI to select an item, but clicks and keypresses are not accepted;
  game hangs indefinitely.
  Root cause: `ctx.messageWithColor(..., REQUIRE_ACKNOWLEDGMENT)` was not awaited before
  `ctx.promptForItemOfType(...)` in `readScroll`. Both paths called `waitForEvent()`, which
  has a single-slot resolver; the acknowledgment waiter overwrote the inventory's slot and
  consumed every subsequent keypress/click, leaving `buttonInputLoop` permanently blocked.
  Fix: added `await` to the three `messageWithColor(REQUIRE_ACKNOWLEDGMENT)` calls that
  precede `promptForItemOfType` in `readScroll` (ScrollKind.Identify, ScrollKind.Enchanting,
  and the "Can't enchant that" retry). Also widened `ItemHandlerContext.message` /
  `messageWithColor` return type to `void | Promise<void>` to match the async wire.
  TS: `items/item-handlers.ts`. test: `tests/items.test.ts` (B19 fix test). **M**

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

- [ ] **B20 — Key not consumed after opening locked room** — After using a key to open a
  locked vault/item room door, the key remains in the player's inventory. In C, the key
  is removed on use. Likely `removeItemFromPack` or the key-use handler not called.
  C: `Items.c` (key use, removeItemFromPack). TS: `items/item-handlers.ts`. **S**

- [ ] **B21 — Captive monster cannot be freed** — Attempting to free a captive monster
  (e.g. caged monkey) always fails; the monster remains captive on every attempt. In C,
  success/failure depends on a dice roll and the monster's captive flags are cleared on
  success. Either the roll always fails or the captive-clearing logic is stubbed/missing.
  C: `Monsters.c` (free captive logic). TS: `monsters/monster-actions.ts` or `turn.ts`. **S**

- [ ] **B22 — Floor-trap terrain promotion stops after one turn** — After picking up a key
  that triggers a floor-removal trap (floor promotes to chasm), only the first turn of
  promotion runs; subsequent turns leave the room unchanged. The promotion chain should
  continue each turn until complete. Likely root: `applyInstantTileEffectsToCreature`
  (Priority 4 / B13 root) not firing per-turn, OR `updateEnvironment` promotion chain
  halting. C: `Time.c` (terrain promotion, T_PROMOTES_ON_STEP). TS: `time/`. **M**

- [ ] **B23 — Magic mapping scroll has no effect** — Using a scroll of magic mapping
  neither reveals the level map nor plays the radial reveal animation (expanding ring
  centred on player). The map should be fully revealed with a visual sweep effect.
  Likely the map-reveal function is a stub or not wired.
  C: `Items.c` (scrollMagicMapping), `IO.c` (animation). TS: `items/item-handlers.ts`. **M**

- [ ] **B24 — Creeping death / gas clouds do not expand** — Potion of creeping death places
  initial spores but they do not spread over subsequent turns. Same root cause as B12
  (`updateEnvironment` not called per turn — gas diffusion and terrain promotion both live
  there). Fix B12 and B24 together.
  C: `Time.c` (updateEnvironment). TS: `turn.ts` (per-turn environment update call site). **M**

- [ ] **B13 — Tall grass not trampled on walkover** — Walking over tall grass does not
  convert it to short grass (or bare floor). In C this is driven by
  `applyInstantTileEffectsToCreature` checking `T_PROMOTES_ON_STEP` terrain flags.
  This function was previously "permanently deferred" but is now in scope.
  C: `Time.c` (applyInstantTileEffectsToCreature). TS: likely needs porting + wiring
  into `movement.ts` player move context. **M**

### P3 — Minor / cosmetic

- [ ] **B16 — Title-screen flames speed up on mouse movement** — On the title screen,
  moving the mouse over the game area causes the flame animation to run faster than
  normal; the more mouse events arrive, the faster the flames animate. Stopping the
  mouse or moving it off the canvas restores normal speed.
  Cause: the `titleMenu` inner loop calls `updateMenuFlames` on every iteration.
  `pauseBrogue(MENU_FLAME_UPDATE_DELAY, { interruptForMouseMove: true })` returns
  early on each mouse-move event, so flames are advanced once per mouse event instead
  of once per `MENU_FLAME_UPDATE_DELAY` ms. Fix: track `Date.now()` and only call
  `updateMenuFlames` when at least `MENU_FLAME_UPDATE_DELAY` ms have elapsed since
  the last flame update, regardless of how many mouse events arrived.
  C: flame update rate is implicitly correct because C's `pauseBrogue` counts wall-clock
  time; the TS async equivalent short-circuits the delay without compensating.
  TS: `menus/main-menu.ts` (`titleMenu` inner loop). **S**

- [ ] **B17 — `flashMessage` animation non-functional** — `flashTemporaryAlert` is wired
  but produces no visible flash because `EffectsContext.pauseBrogue` is synchronous while
  the browser platform only has `async pauseBrogue`. The animation loop runs instantly with
  no per-frame `commitDraws`, so only the final restored state is ever displayed.
  Fix: make `flashMessage` and `EffectsContext.pauseBrogue` async; call `commitDraws()`
  between animation frames. C: `IO.c` (flashMessage). TS: `io/effects-alerts.ts`, `ui.ts`. **M**

- [ ] **B14 — No message when exploration complete** — When auto-explore has nowhere
  left to go (whole map explored, or path unreachable), no message appears. In C a
  message like "Nowhere left to explore." or "Exploration interrupted." is shown.
  C: `Movement.c` or `RogueMain.c` (autoTravel / explore path). TS: `movement/travel-explore.ts`. **S**

### Needs investigation (not yet classified)

- [ ] **B25 — Items in locked vault appear unidentified** — Two unidentified rings were
  observed in a locked item vault. Verify C behaviour first: in C, vault items are
  standard unidentified items — the vault room type determines *category* but identification
  still requires scrolls/use. If that is correct C behaviour, close as WAI. If C auto-
  identifies vault items on entry, trace the identification call site.
  C: `Architect.c` (vault machine setup, item generation). **investigate first**

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
