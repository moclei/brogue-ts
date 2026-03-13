# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-12 (B34 fixed; B35 B36 filed; B13 B30 updated; B36 fixed 2026-03-12; B35 fixed 2026-03-12; B27 fixed 2026-03-12; B28 fixed 2026-03-12; B32 deferred; B30 fixed 2026-03-12; B23 fixed 2026-03-12; B17 fixed 2026-03-12; B14 fixed 2026-03-12; B25/B15 closed WAI 2026-03-12; B31 fixed 2026-03-12)
**Tests at last update:** 88 files · 2284 pass · 55 skip

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

- [x] **`applyInstantTileEffectsToCreature`** — applies terrain effects to a creature
  that steps onto or is on a cell: tall grass trampling (`T_PROMOTES_ON_STEP`), fire
  damage, web entanglement, etc. Previously "permanently deferred" due to async cascade
  concerns; now in scope. Required by B13 (tall grass).
  C: `Time.c`. TS: `tile-effects-wiring.ts` — `buildApplyInstantTileEffectsFn()` wired
  into `turn.ts`, `turn-monster-ai.ts`, `combat.ts`, `items.ts`, `items/item-commands.ts`,
  `items/staff-wiring.ts`. **M**

- [x] **`drawManacles`** — draws manacle terrain decorations adjacent to a chained
  monster on level entry. Visual, but present in C.
  C: `Monsters.c`. TS: `monsters.ts` or `lifecycle.ts`.
  test.skip: `tests/monsters.test.ts:322`. **S**

- [x] **`fadeInMonster`** — animation for a monster appearing on-screen (used when
  summoned or revealed). Implemented as `buildFadeInMonsterFn()` in `combat.ts`:
  calls `getCellAppearance(monst.loc)` then `flashMonster(monst, backColor, 100)`.
  Wired into `combat.ts`, `turn.ts`, `turn-monster-ai.ts`, `items.ts`,
  `items/item-commands.ts`, `items/staff-wiring.ts`, and `tile-effects-wiring.ts`
  (inline, no circular dep). Test: `tests/items.test.ts:349` (converted from skip).
  C: `Monsters.c:904`. **S**

---

## Priority 5 — Debug overlays

Were in the C game. Port from `IO.c`. Each is a grid-visualization helper that
renders a number grid or flag map over the dungeon for debugging. They share the
same pattern: iterate the dungeon grid, call `plotCharWithColor` for each cell.

- [x] **`displayGrid`** — renders a numeric grid over the dungeon.
  C: `IO.c`. test: `tests/ui.test.ts:485`. **S**

- [x] **`displayWaypoints`** — renders waypoint indices.
  C: `IO.c`. test: `tests/ui.test.ts:494`. **S**

- [x] **`displayMachines`** — renders machine room numbers.
  C: `IO.c`. test: `tests/ui.test.ts:502`. **S**

- [x] **`displayChokeMap`** — renders choke-point distances.
  C: `IO.c`. test: `tests/ui.test.ts:510`. **S**

- [x] **`displayLoops`** — renders loop detection data.
  C: `IO.c`. test: `tests/ui.test.ts:518`. **S**

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

- [x] **B29 — Crash at depth 3 — `buildAMachine` undefined.flags** — Game crashed on
  descending to depth 3 with: `TypeError: Cannot read properties of undefined (reading 'flags')`
  at `machines.ts:1419`. Stack: `buildAMachine` (recursive) → `addMachines` →
  `digDungeon` → `startLevel`.
  Root cause: blueprints 36 (MT_KEY_LEVITATION_ROOM) and 37 (MT_KEY_WEB_CLIMBING_ROOM) have
  `featureCount` (9 and 7) exceeding their feature array lengths (7 and 5). C uses a fixed-size
  `feature[20]` array — extra entries are zero-initialized (no-ops). TS arrays are dynamic,
  so `blueprint.feature[i]` is undefined for `i >= feature.length`, causing the crash.
  Fix: guard `blueprint.feature[i]?.flags ?? 0` in the MF_ALTERNATIVE selection loop; add
  `if (!feature) continue;` in the feature processing loop. Blueprint catalog test documents
  the known featureCount mismatches. TS: `architect/machines.ts`. **M**

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

- [x] **B10 — Aiming: no path shown** — When targeting with the mouse (throw/zap),
  the bolt/throw path from player to cursor is not drawn. In C, `chooseTarget` draws
  the path using `drawBoltLine` or similar each cursor move.
  C: `IO.c` (chooseTarget, drawBoltLine). TS: `io/input-cursor.ts`, `items/targeting.ts`. **M**
  Fix: `hiliteCell` and `refreshDungeonCell` were `() => {}` stubs in `buildStaffChooseTargetFn`
  (staff-wiring.ts) and `buildThrowCommandFn` (item-commands.ts). Added `buildHiliteCellFn()`
  to `io-wiring.ts` (reuses `buildGetCellAppearanceFn`). Both contexts now call real cell
  highlight/refresh. `hiliteTrajectory` correctly draws/erases the bolt path.

- [x] **B11 — Aiming: no target details shown** — When hovering over a cell during
  targeting, no description of the target appears (monster name, item, terrain).
  In C, this updates the sidebar/message area via `printMonsterDetails` or `updateFlavorText`.
  C: `IO.c`. TS: `io/input-cursor.ts`. Note: relates to `updateFlavorText` (Priority 4). **M**
  Fix: extracted `buildSidebarContext()`, `buildRefreshSideBarWithFocusFn()`, and
  `buildPrintLocationDescriptionFn()` into new `io/sidebar-wiring.ts`. Wired
  `refreshSideBar` and `printLocationDescription` in `item-commands.ts` (throw) and
  `staff-wiring.ts` (staff). Also wired `printMonsterDetails` and `printLocationDescription`
  in `input-context.ts` (general cursor mode). `printTextBox` now wired in SidebarContext
  (no-buttons fire-and-forget). `printFloorItemDetails` remains no-op pending `itemDetails` port.

- [x] **B12 — Gas (bloodwort) does not spread** — Gas from a bloodwort plant stays at
  its origin as a single red cloud spot and never dissipates or spreads to adjacent
  cells. In C, gas diffuses and dissipates each turn via `updateEnvironment`.
  Likely cause: `updateEnvironment` not called per turn, OR gas volume not being
  decremented. Relates to Priority 2 item `startLevel updateEnvironment` — but that
  is the level-entry simulation; per-turn gas spreading is a separate call site.
  C: `Time.c` (updateEnvironment → gas diffusion). TS: `time/` or `turn.ts`. **M**
  Fix: wired real `updateEnvironment` in `buildTurnProcessingContext()` in `turn.ts`,
  building an `EnvironmentContext` with real cell/map helpers and real
  `spawnDungeonFeature`. `monstersFall`/`updateFloorItems`/`monstersTurn` stubbed
  (handled by TurnProcessingContext). Gas now spreads and dissipates each turn.

- [x] **B20 — Key not consumed after opening locked room** — After using a key to open a
  locked vault/item room door, the key remains in the player's inventory. In C, the key
  is removed on use. Likely `removeItemFromPack` or the key-use handler not called.
  C: `Items.c` (key use, removeItemFromPack). TS: `items/item-handlers.ts`. **S**
  Fix: Already working — `applyInstantTileEffectsToCreature` calls `keyOnTileAt` then
  `useKeyAt` which removes the key via `removeItemFromChain`. Was fixed as part of the
  Priority 4 `applyInstantTileEffectsToCreature` port. Added B20 regression test in
  `tests/time/creature-effects.test.ts`.

- [x] **B21 — Captive monster cannot be freed** — Attempting to free a captive monster
  (e.g. caged monkey) always fails; the monster remains captive on every attempt.
  Root cause: `freeCaptive` stub in `movement.ts` set `creatureState=Ally` and `leader=player`
  but never cleared `MB_CAPTIVE`. On the next bump, the flag was still set → confirm dialog
  fired again → infinite loop of "freeing" with no visible change.
  Fix: wired real `freeCaptiveFn` from `ally-management.ts` via inline `AllyManagementContext`
  in `buildMovementContext()`. Now calls `becomeAllyWith` (demotes from leadership, drops item,
  clears `MB_CAPTIVE | MB_SEIZED`, sets `MB_FOLLOWER`) and prints the gratitude message.
  Also trimmed two verbose JSDoc blocks to keep `movement.ts` under 600 lines (596 lines).
  C: `Movement.c` (freeCaptive, becomeAllyWith). TS: `movement.ts`. test: `player-movement.test.ts`. **S**

- [x] **B22 — Floor-trap terrain promotion stops after one turn** — After picking up a key
  that triggers a floor-removal trap (floor promotes to chasm), only the first turn of
  promotion runs; subsequent turns leave the room unchanged. The promotion chain should
  continue each turn until complete. Likely root: `applyInstantTileEffectsToCreature`
  (Priority 4 / B13 root) not firing per-turn, OR `updateEnvironment` promotion chain
  halting. C: `Time.c` (terrain promotion, T_PROMOTES_ON_STEP). TS: `time/`. **M**

- [x] **B23 — Magic mapping scroll has no effect** — Fixed 2026-03-12.
  Two bugs: (1) GRANITE check was `!== 0` (TileType.NOTHING) instead of
  `!== TileType.GRANITE` — caused solid-rock cells to be incorrectly magic-mapped.
  (2) `ctx.displayLevel()` not called after mapping — `colorFlash` is stubbed, so
  the display never refreshed to show the newly mapped cells. Fix: corrected GRANITE
  check, added `ctx.displayLevel()` before `colorFlash`. `discover()` for secret
  tiles remains stub (permanent-defer). Also removed leftover debug console.log from
  vision-wiring.ts.
  C: `Items.c` (scrollMagicMapping). TS: `items/item-handlers.ts`, `vision-wiring.ts`. **M**

- [x] **B24 — Creeping death / gas clouds do not expand** — Potion of creeping death places
  initial spores but they do not spread over subsequent turns. Same root cause as B12
  (`updateEnvironment` not called per turn — gas diffusion and terrain promotion both live
  there). Fixed together with B12.
  C: `Time.c` (updateEnvironment). TS: `turn.ts` (per-turn environment update call site). **M**

- [x] **B13 — Tall grass not trampled on walkover** — Walking over tall grass does not
  convert it to short grass (or bare floor). In C this is driven by
  `applyInstantTileEffectsToCreature` checking `T_PROMOTES_ON_STEP` terrain flags.
  This function was previously "permanently deferred" but is now in scope.
  C: `Time.c` (applyInstantTileEffectsToCreature). TS: likely needs porting + wiring
  into `movement.ts` player move context. **M**
  Fix: resolved as a side-effect of the `applyInstantTileEffectsToCreature` port
  (Priority 4). Confirmed working in playtest.

- [x] **B27 — Teleportation scroll — delayed effect + ghost `@`** — Using a scroll of
  teleportation teleported the player, but required a move action before the teleport
  visually resolved. The `@` glyph remained at the original position until that next move.
  Root cause: `teleport()` updates `player.loc` and `pmap` flags in state but
  `refreshDungeonCell` is not called for the old location immediately — the old cell still
  has the player glyph in the display buffer until the next full refresh.
  C: `Items.c` (teleportation scroll → `teleport()`). TS: `items/item-handlers.ts`,
  `monsters/monster-teleport.ts` (teleport fn). **S**

- [x] **B28 — Level transition display — fog of war shows wrong level** — Two related
  symptoms: (a) after using a potion of descent the new (unvisited) level appeared fully
  explored, showing the previous level's fog state; (b) generally, moving between levels
  causes the display to show the explored areas of the other level until the game is forced
  to refresh. Returning to the level and coming back corrects it.
  Root cause: `displayLevel()` (or equivalent full refresh) is not called after the level
  transition swaps `pmap`. The display buffer retains the previous level's cell data.
  C: `RogueMain.c` (startLevel — calls `displayLevel()` after level load).
  TS: `game/game-level.ts` (startLevel, level swap). **M**

- [x] **B30 — Ally does not follow player up or down stairs** — Fixed 2026-03-12.
  `startLevel()` already marks allies with `MB_APPROACHING_DOWNSTAIRS/UPSTAIRS` and sets
  `EntersLevelIn`. `monstersApproachStairs()` existed in `time/misc-helpers.ts` but was
  never called. Wired: new `time/stairs-wiring.ts` builds `MiscHelpersContext`; added
  `monstersApproachStairs(): void` to `TurnProcessingContext`; called in
  `turn-processing.ts` after `applyInstantTileEffectsToCreature`.
  C: `Time.c:2425`. TS: `time/turn-processing.ts`, `turn.ts`, `time/stairs-wiring.ts`. **M**

- [ ] **B32 — Whip weapon — cannot attack after equipping** — After switching weapon to a
  whip, the player appeared unable to attack monsters (attacks did not resolve). Whip is a
  reach weapon (attacks 2 squares away) in C; if reach-weapon attack logic is not ported,
  neither adjacent nor distant attacks work.
  Investigated 2026-03-12: `handleWhipAttacks` IS wired in `movement-weapon-context.ts` and
  `movement.ts`. Root cause: `zap` is permanently stubbed (`() => {}`). When the player moves
  toward a monster with a whip equipped, `handleWhipAttacks` fires, returns true (consuming
  the turn), but `zap()` is a no-op so no damage or animation occurs. Fix requires `zap`
  (port-v2-persistence scope). **DEFERRED — blocked by zap stub**
  C: `Movement.c` (playerMoves — reach weapon check). TS: `movement-weapon-context.ts`.

- [x] **B35 — Mouse hover: no path highlight or location description** — In normal
  gameplay (outside targeting mode), moving the mouse over the dungeon should:
  (a) Draw a highlighted path from the player to the cursor cell (the route the player
  would walk if they clicked) using the same cell-highlight technique as throw/zap aiming.
  (b) Print a text description in the message area: "You see [terrain/creature/item]"
  for directly visible cells, or "You remember seeing [X] here" for fog-of-war cells.
  Neither effect is present in the port. Note: B10/B11 fixed aiming-cursor highlights
  and descriptions — this is the separate normal-play hover path, which is wired
  independently via the `handleHover` handler in `platform.ts`.
  C: `IO.c` (printLocationDescription, travel-path highlighting during hover),
  `Movement.c` (travel-path drawing). TS: `platform.ts` (handleHover),
  `io/input-context.ts`. **M**

- [x] **B36 — Bottom action buttons not displayed** — The C game renders a row of
  clickable shortcut buttons at the bottom of the screen: Explore, Rest, Search,
  Menu, Inventory. These are absent in the port; the bottom area is blank.
  Fix: new `io/menu-bar.ts` — `buildGameMenuButtonState`, `drawGameMenuButtons`,
  `findClickedMenuButton`. `platform.ts::mainGameLoop` initializes the state once
  and overlays buttons before every `commitDraws`. Click dispatch: non-Menu buttons
  dispatch hotkey via `executeKeystroke`; Menu (index 3) calls `actionMenu`.
  `initializeMenuButtons` in `input-mouse.ts` fixed to use real `initializeButtonState`
  instead of the stub `ctx.initializeButtonState`.
  C: `IO.c` (bottom-button rendering, `drawMenuButton` / button state updates).
  TS: `io/menu-bar.ts`, `platform.ts`, `io/input-mouse.ts`. **M**

### P3 — Minor / cosmetic

- [x] **B16 — Title-screen flames speed up on mouse movement** — On the title screen,
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
  ⚠ Prioritised up to P2 by user request — fix soon.

- [x] **B17 — `flashMessage` animation non-functional** — Fixed 2026-03-12.
  `EffectsContext.pauseBrogue` was synchronous (`boolean`); animation loop ran instantly
  with no per-frame `commitDraws`, leaving only the restored state visible.
  Fix: made `EffectsContext.pauseBrogue` return `boolean | Promise<boolean>`; made
  `flashMessage`/`flashTemporaryAlert` async with `ctx.commitDraws()` + `await pauseBrogue`
  per frame. Cascading async through `flashCreatureAlert`/`handleHealthAlerts` in
  `creature-effects.ts`, updated interfaces in TurnProcessingContext and 4 other contexts.
  `ui.ts` now uses `pauseAndCheckForEvent` for real async delay in flash animations.
  C: `IO.c` (flashMessage). TS: `io/effects-alerts.ts`, `io/effects.ts`, `ui.ts`,
  `time/creature-effects.ts`, `time/turn-processing.ts`, + 5 interface files. **M**

- [x] **B14 — No message when exploration complete** — When auto-explore has nowhere
  left to go (whole map explored, or path unreachable), no message appears. In C a
  message like "Nowhere left to explore." or "Exploration interrupted." is shown.
  C: `Movement.c` or `RogueMain.c` (autoTravel / explore path). TS: `movement/travel-explore.ts`. **S**
  Fix: extracted `exploreKey()` to `io/explore-wiring.ts`; after `explore()` returns, runs
  `getExploreMap` + `nextStep` — shows "I see no path for further exploration." if no direction found.

### Needs investigation (not yet classified)

- [x] **B31 — "The missing item must be replaced" — cannot pick up items in locked room** —
  After entering a locked room with a key, attempting to pick up items produced a message
  like "The missing item must be replaced" and no items could be taken. No items had been
  picked up yet. The level had two locked rooms; this first room contained a key to the
  second room.
  In C, vault/machine items are sometimes protected until a condition is met (e.g. the
  machine considers the item a "required" part of the layout). Investigate whether the
  machine item-protection logic is incorrectly flagging all items in the room, or whether
  the key-to-second-room being present triggered an unexpected condition.
  C: `Items.c` (item pickup, `ITEM_IS_KEY` / machine item protection flags).
  TS: `items/item-handlers.ts`, `items/item-commands.ts`. **investigate first**
  Fix: `keyOnTileAt()` in `movement.ts` and `tile-effects-wiring.ts` was checking
  `item.category & ItemCategory.KEY` (item is a golden key type) instead of
  `item.flags & ItemFlag.ITEM_IS_KEY` (item has been designated as a key by the machine
  architect). Vault items (weapons/armor/wands) have `ITEM_IS_KEY` flag but are not
  category KEY — so cages closed immediately after level generation.

- [x] **B25 — Items in locked vault appear unidentified** — Two unidentified rings were
  observed in a locked item vault. Verify C behaviour first: in C, vault items are
  standard unidentified items — the vault room type determines *category* but identification
  still requires scrolls/use. If that is correct C behaviour, close as WAI. If C auto-
  identifies vault items on entry, trace the identification call site.
  C: `Architect.c` (vault machine setup, item generation). **investigate first**
  Resolution: WAI. `generateItem()` produces unidentified items; `Architect.c` never calls
  `ITEM_IDENTIFIED` on vault items. C behaves identically.

- [x] **B15 — Item/treasure rooms appearing on depth 1** — Treasure rooms and item
  vaults were observed on the first floor. Unclear if this is intended (some machines
  have no minimum depth in C) or a level-generation depth-guard bug. Investigate:
  read machine catalog minimum-depth conditions in C; compare to TS machine catalog
  and `buildAMachine` depth checks before classifying as bug or acceptable behavior.
  C: `Architect.c` (buildAMachine, machine catalog depth guards). **investigate first**
  Resolution: WAI. `GlobalsBrogue.c` sets `depthRange [1, 12]` for the Mixed/Single
  item libraries; both C and TS blueprint-catalog agree. Depth-1 vaults are intended.

- [x] **B33 — Crash when throwing a dart** — Game froze (infinite synchronous loop)
  when the mouse hovered over a cell just below the map boundary during throw targeting.
  Root cause: `moveCursor` contains a `do { ... } while (again && !cursorMovementCommand)`
  loop. In C, each iteration calls `nextKeyOrMouseEvent()` which blocks for a real new
  event. In the TS wrapper, `nextKeyOrMouseEvent` is a closure returning the *same*
  pre-fetched event. When a `MouseEnteredCell` event arrived for an off-map cell,
  `again = true` caused the loop to re-process the same event indefinitely. The
  tables.ts fix (B11 root cause) shifted the map/off-map boundary by 1 window row,
  making the freeze reproducible at a commonly-hovered position.
  Fix: when `state === null` (no button panel), set `again = false` unconditionally;
  the TS wrapper always calls `waitForEvent()` for a fresh event on the next outer-loop
  iteration anyway. Also removed diagnostic console.log lines from targeting.ts,
  io-wiring.ts, item-commands.ts, staff-wiring.ts.
  C: `Items.c` (chooseTarget, moveCursor). TS: `io/cursor-move.ts`. **M**

- [x] **B34 — No throw animation — projectile teleports to destination** — When throwing
  an item (dart, javelin, etc.) the projectile does not animate along its path; it
  instantly appears at the target cell. In C, `throwItem` calls `tileGame` or a bolt
  animation to draw the projectile moving cell-by-cell with brief pauses. The TS port
  skips this animation step.
  C: `Items.c` (throwItem → animation loop). TS: `items/item-handlers.ts`. **S**
  Fix: wired `render.plotItemAt`, `render.pauseAnimation`, and `render.refreshDungeonCell`
  in `buildThrowCommandFn()` in `item-commands.ts`. `plotItemAt` reads backColor from
  `getCellAppearance`, copies item foreColor, applies `colorMultiplierFromDungeonLight`
  (or `clairvoyanceColor` for non-direct cells), then `plotCharWithColor`. `pauseAnimation`
  calls `commitDraws()` then `pauseAndCheckForEvent(25ms)` so each frame is flushed before
  the delay. `refreshDungeonCell` uses `buildRefreshDungeonCellFn()` to restore the cell.

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
