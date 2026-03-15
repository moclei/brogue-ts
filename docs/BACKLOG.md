# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-15 (B74 fixed; B75–B76 filed from playtest of B63 flee fix)
**Tests at last update:** 88 files · 2309 pass · 55 skip

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

- [x] **B32 — Whip weapon — cannot attack after equipping** — After switching weapon to a
  whip, the player appeared unable to attack monsters (attacks did not resolve). Whip is a
  reach weapon (attacks 2 squares away) in C; if reach-weapon attack logic is not ported,
  neither adjacent nor distant attacks work.
  Investigated 2026-03-12: `handleWhipAttacks` IS wired in `movement-weapon-context.ts` and
  `movement.ts`. Root cause: `zap: () => {}` stub in `movement-weapon-context.ts`. When
  the player moves toward a monster with a whip equipped, `handleWhipAttacks` fires and
  returns true (consuming the turn), but `zap()` is a no-op so no damage or animation occurs.
  Fix: wire `zap` in `movement-weapon-context.ts` to `buildStaffZapFn()` from
  `items/staff-wiring.ts` — that implementation already exists and handles the bolt domain.
  C: `Movement.c` (playerMoves — reach weapon check). TS: `movement-weapon-context.ts`. **S**

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

- [x] **B37 — Hover ghost trail on undiscovered cells** — When moving the mouse over
  undiscovered (black) cells, a white hover indicator appears under the cursor. When
  the mouse moves to a new cell, the previously-hovered cell retains the white color
  instead of returning to black — leaving a ghost trail wherever the mouse has been.
  Only affects undiscovered cells; discovered cells restore correctly.
  Root cause: `clearCursorPath` only restores cells with `IS_IN_PATH`. The cursor cell
  gets IS_IN_PATH only when a path exists to it (via `hilitePath`). Undiscovered cells
  are unreachable (cost=0 in Dijkstra), so no path is drawn and IS_IN_PATH is never set.
  `hiliteCell` still tints the cursor cell white, leaving a permanent ghost.
  Fix: C explicitly calls `refreshDungeonCell(oldTargetLoc)` before `clearCursorPath`.
  Mirrored in TS: `buildHoverHandlerFn` now tracks `prevCursorLoc` and calls
  `refreshDungeonCell(prevCursorLoc)` at the start of each hover event.
  TS: `io/hover-wiring.ts`. **S**

- [x] **B38 — `colorFlash` stub — no color-flash feedback** — `colorFlash` is a no-op
  (`() => {}`) in all item, bolt, and creature-effects contexts. It is used throughout C
  for visual confirmation of spell and item effects: the magic-mapping screen flash,
  scroll-of-identify flash, scroll-of-enchanting flash, potion effects, combat status
  events, and more. Without it, many actions appear to have no effect — the player
  cannot tell if a scroll or potion did anything.
  C: `IO.c` (colorFlash). TS: `items.ts`, `items/staff-wiring.ts`, `items/zap-context.ts`,
  `time/creature-effects.ts` (all stub it). **M**
  Fix (part 1): `buildColorFlashFn()` in `io-wiring.ts` — async single-frame hilite + commitDraws
  + 50ms pause + restore. Wired all 5 stub sites in `items.ts`.
  Fix (part 2): Added `await` to both `ctx.colorFlash(...)` call sites in `item-handlers.ts`
  (magic mapping + potion of descent) so the flash completes before turn processing overwrites it.
  Also fixed seeded game freeze: `getInputTextString` was sync, spinning on `nextKeyPress`
  → fake event → infinite loop. Made async using `ctx.nextBrogueEvent` (added to `InputContext`,
  wired in `input-context.ts`). Filed as **B47** below.
  Fix (part 3): Replaced single-frame implementation with proper multi-frame expanding-radius
  animation matching C IO.c:2086–2104: pre-computes qualifying cells + distances, loops k=1..frames
  computing `curR = max(1, maxRadius*k/frames)`, `fadeOut = min(100, (frames-k)*500/frames)`,
  intensity per-cell, commits+pauses 50ms per frame. Fast-forward on input interrupt. Respects
  `tileFlags` filter (e.g. MAGIC_MAPPED) via `pmap[i][j].flags`. Last frame fadeOut=0 restores
  cells naturally (hiliteCell intensity=0 = original appearance).
  Fix (part 4): `displayInventory` in `input-context.ts` calls `restoreDisplayBuffer` at the end,
  wiping magic-mapped (or any other item-effect) dungeon changes from the display buffer. Next
  `commitDraws()` then pushes the old undiscovered state back to canvas. Fixed by calling
  `displayLevelFn()` after `displayInventoryFn` returns, so the buffer reflects current pmap flags
  before the next commit.

- [x] **B39 — `flashMonster` stub — no creature flash on hit or status** — `flashMonster`
  is a no-op in all contexts. It briefly changes a creature's display color to give visual
  feedback on attacks, healing, status application, and ability use. Without it, combat
  and spell effects are silent — the player cannot see when a monster is hit, healed,
  slowed, confused, etc.
  C: `IO.c` (flashMonster). TS: `items.ts`, `items/staff-wiring.ts`, `items/zap-context.ts`
  (all stub it). **M**
  Fix: imported `flashMonster` from `combat/combat-damage.ts` in `items.ts` (4 stubs) and
  `staff-wiring.ts` (1 stub). All replaced with `flashMonsterFn(m, c, s, combatCtx/damageCtx)`.
  `flashMonster` sets `MB_WILL_FLASH` and `creaturesWillFlashThisTurn`; `displayMonsterFlashes`
  (already wired in `input-keystrokes.ts`) handles the actual rendering before next input.
  ⚠ Awaits playtest confirmation — could not find a seed with a staff/scroll handy to verify.

- [x] **B40 — `createFlare` stub — no light-flare effect** — Fixed 2026-03-13.
  `createFlare` wired in `items.ts` and `tile-effects-wiring.ts` to real `createFlareFn`
  (pushes to `rogue.flares`). `animateFlares` made async in `light/flares.ts`; wired in
  `turn.ts` via `buildAnimateFlaresFn()` in `vision-wiring.ts` (full `LightingContext` +
  `demoteVisibility` + `updateVision` callbacks with `commitDraws`/`pauseAndCheckForEvent`
  per frame). `turn-processing.ts` fixed to check `rogue.flares.length` instead of missing
  `rogue.flareCount` field. Flares now animate at turn-end for all item/bolt/fall effects.
  C: `Light.c` (createFlare, animateFlares). TS: `light/flares.ts`, `items.ts`,
  `tile-effects-wiring.ts`, `vision-wiring.ts`, `turn.ts`, `time/turn-processing.ts`. **S**

- [x] **B41 — `updateClairvoyance` stub — clairvoyance ring non-functional** —
  Fixed 2026-03-13. Added `buildUpdateClairvoyanceFn()` to `vision-wiring.ts`: builds
  a minimal `SafetyMapsContext` cast (pmap, rogue.clairvoyance, player.loc, max/min,
  discoverCell) and calls `updateClairvoyance`. Wired in `items.ts` (ItemHandlerContext —
  enchanting a clairvoyance ring) and `io/inventory-actions.ts` (buildEquipCtx —
  equipping/unequipping; also wired `displayLevel`).
  C: `Time.c` (updateClairvoyance). TS: `vision-wiring.ts`, `items.ts`, `io/inventory-actions.ts`. **M**

- [x] **B42 — `extinguishFireOnCreature` stub in item/bolt contexts** — `extinguishFireOnCreature`
  is a no-op in the item-handler and bolt contexts (`items.ts` wiring). It is called when
  a water-based bolt or effect hits a burning creature. Without it, fire on a creature
  struck by a water bolt is never extinguished.
  C: `Time.c` (extinguishFireOnCreature). TS: `items.ts` context (two stub sites). **S**

- [x] **B43 — `discover`/`discoverCell` stubs in item/bolt contexts** — Both are no-ops
  in the item-handler and bolt/zap contexts. `discover` reveals a cell (removes fog of war);
  `discoverCell` reveals a specific cell including secret doors. Called when a bolt hits a
  wall (may reveal secrets) and on certain scroll/potion effects. Without them, bolts that
  should reveal secrets do not, and items that uncover the map behave incorrectly.
  C: `Items.c`, `Monsters.c`. TS: `items.ts` context, `items/zap-context.ts` (stub). **S**
  Fix: Added `buildItemDiscoverFn()` helper in `items.ts` that builds a minimal `MapQueryContext`
  from live game state and calls the real `discover` free function (Movement.c:2110).
  Wired in two places: `ItemHandlerContext.discover` (used by scroll of magic mapping) and
  `aggravateMonsters` context (alarm reveals). `discoverCell` in aggravate context wired inline
  via `discoverCellFn` cast. Tests in `items.test.ts:390`. 2286 pass / 55 skip.

- [x] **B44 — Monster spell-casting system absent** — Wired end-to-end: `monsterCastSpell`,
  `monstUseBolt`, `monstUseMagic` are async and fully connected. `buildMonsterZapFn()` provides
  the real zap closure; `buildMonsterBoltBlinkContexts()` wires bolt/blink/summon/corpse contexts.
  `monstersTurn` is async and properly awaited in `turn-processing.ts`. Phase 2–4 complete.
  Tests: `monster-bolt-ai.test.ts` (19 tests). 2296 pass / 55 skip.
  ⚠️ Browser smoke-test pending — monsters firing bolts in-game not yet manually verified.

- [x] **B45 — Item effect stubs — wired remaining bolt/zap effect stubs** — Most effects
  (`teleport`, `haste`, `aggravateMonsters`, `negate`, `summonMinions`, `swapItemEnchants`)
  were already wired in a previous session. This pass wired the remaining stubs in
  `staff-wiring.ts` and `turn-monster-zap-wiring.ts`:
  `slow` → `slowFn` (SlowContext with updateEncumbrance + message);
  `empowerMonster` → real `empowerMonsterFn` from `monster-state.ts`;
  `tunnelize` → real `tunnelizeFn` from `bolt-helpers.ts` (TunnelizeContext built inline);
  `disentangle` (ZapContext top-level + teleport inner) → real `disentangleFn` with message.
  All 2296 tests pass / 55 skip.
  C: `Items.c:3905` (slow), `Monsters.c:538` (empowerMonster), `Items.c:3631` (tunnelize).
  TS: `items/staff-wiring.ts`, `turn-monster-zap-wiring.ts`. **L→done**

- [x] **B46 — Click-to-travel stops after one step** — Clicking on a visible cell more
  than one step away should pathfind the player there step-by-step, stopping if a
  monster comes into view, the player bumps something unexpected, or the player presses
  a key. Instead, the port moves only one step and stops.
  Root cause (stop-after-one-step): `pauseAnimation(500)` resolved early on any
  `MouseEnteredCell` (hover) event. Fixed: `pauseAndCheckForEventIgnoringHover` discards
  hover events so only keystrokes and mouse-button events interrupt travel.
  Root cause (500ms/step timing): TS used `travelMap` (500ms/step nominal) for all clicks.
  C's regular click path is `mainInputLoop()` → `travelRoute(path, steps)` (25ms/step
  nominal). The `_delayUpTo` mechanism further reduces this via time-accounting, giving
  ~40ms/step observed. Fixed: changed `travelMap`'s pause from `500 - elapsed` to
  `25 - elapsed`, matching `travelRoute`'s budget.
  C: `Movement.c` (travelMap, travelRoute, pauseAnimation), `sdl2-platform.c` (_delayUpTo).
  TS: `movement/travel-explore.ts` (travelMap pause), `platform.ts` (pauseAndCheckForEventIgnoringHover). **M**

- [x] **B48 — Hover over floor item crashes: `itemName` receives empty item tables** —
  Hovering the mouse over a scroll (or other unidentified item) on the floor crashes with
  `TypeError: Cannot read properties of undefined (reading 'identified')` at
  `itemName (item-naming.ts:255)`.
  Root cause: `describedItemName` closure in `buildPrintLocationDescriptionFn()`
  (`io/sidebar-wiring.ts:333`) builds the naming context with empty arrays
  (`scrollTable: []`, `potionTable: []`, etc.). When `itemName` indexes into
  `scrollTable[item.kind]`, the entry is `undefined` → crash.
  Fix: destructure real `mutableScrollTable`, `mutablePotionTable` from `getGameState()`;
  import read-only `wandTable`, `staffTable`, `ringTable`, `charmTable`, `charmEffectTable`
  from item-catalog; pass them to the `itemNameFn` context inside `describedItemName`.
  Stack: `hover-wiring.ts:222` → `sidebar-wiring.ts:306` → `map-queries.ts:685` →
  `map-queries.ts:661` → `sidebar-wiring.ts:334` → `item-naming.ts:255`.
  C: `IO.c` (printLocationDescription, itemName). TS: `io/sidebar-wiring.ts`. **S**

- [x] **B47 — Seeded game entry freezes** — Clicking "New Seeded Game" on the title menu
  showed nothing and froze the game. Root cause: `getInputTextString` (IO.c:2720) was a
  synchronous function calling `nextKeyPress` → sync `nextBrogueEvent` → `nextKeyOrMouseEvent`
  which returns a fake event (EventError) in the browser — causing an infinite sync loop.
  Fix: added `nextBrogueEvent(...)` to `InputContext` (wired in `input-context.ts` as
  `commitDraws + waitForEvent`); made `getInputTextString` async using
  `await ctx.nextBrogueEvent(true, false, false)` to filter for keystroke events.
  C: `IO.c` (getInputTextString:2720). TS: `io/input-dispatch.ts`, `io/input-keystrokes.ts`,
  `io/input-context.ts`. **S**

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

- [ ] **B50 — Potion of incineration → permanent darkness (0 light, +14 stealth)** — After
  drinking a potion of incineration the player was permanently stuck at light level 0, giving
  a permanent 14 stealth range bonus as though always in darkness. The effect persisted for
  the rest of the session. Likely cause: `updateVision` / `updateLighting` is not called (or
  is no-op'd) after the incineration effect burns cells around the player, so the lighting
  state is never recomputed from the changed tile set; or the incineration feature sets
  `lights` to zero and the zero-light state is committed to the display buffer without a
  subsequent recompute.
  C: `Items.c:7279` (drinkPotion POTION_INCINERATION), `Light.c` (updateVision, updateLighting).
  TS: `items/item-handlers.ts`, `vision-wiring.ts`, `lifecycle.ts`. **M**

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

- [x] **B53 — Confusion status never wears off** — Fixed in `turn.ts`: `decrementPlayerStatus`
  in `buildTurnProcessingContext` was a complete stub `() => {}`. The real function in
  `time/creature-effects.ts:decrementPlayerStatus` correctly decrements all status timers
  (confused, hallucinating, levitating, hasted, slowed, weakened, etc.). Wired it with a
  `decrementStatusCtx` that extends `gradualCtx` with the extra fields needed (nutrition
  constants, vision/light/display callbacks, equipment recalc, synchronizePlayerTimeState).
  `spawnPeriodicHorde`, `eat`, `playerTurnEnded`, and `confirmMessages` remain stubbed.
  C: `Time.c:2003` (inline decrements in playerTurnEnded).
  TS: `turn.ts` (`decrementPlayerStatus` / `decrementStatusCtx`). **S**

- [x] **B54 — Scroll of aggravate monster crashes the game** — Root cause: `aggravateMonsters`
  called `ctx.colorFlash()` without `await`. The `buildColorFlashFn()` wiring returns
  `Promise<void>`, so the dropped Promise raced with the game loop's `_console.waitForEvent()`
  — the animation's `.then()` callback overwrote `resolveWait`, permanently abandoning the
  game loop's pending promise → game deadlocked on the next player input.
  Fix: made `aggravateMonsters` async; changed `AggravateContext.colorFlash` to return
  `Promise<void>`; propagated `await` through `items.ts` wrapper and `item-handlers.ts` call
  site. Tests updated to use `async`/`await` and `mockResolvedValue`.
  C: `Items.c` (readScroll SCROLL_AGGRAVATE_MONSTER, aggravateMonsters:3358).
  TS: `items/monster-spell-effects.ts`, `items.ts`, `items/item-handlers.ts`. **M**

- [x] **B55 — Many vaults still trigger "missing item" message (B31 partial)** — Fixed in
  `turn.ts`: the `EnvironmentContext` passed to `updateEnvironmentFn` had `keyOnTileAt: () => null`,
  so every turn `ALTAR_CAGE_OPEN` tiles (which have `TM_PROMOTES_WITHOUT_KEY`) immediately promoted
  to `ALTAR_CAGE_CLOSED` because the environment scan thought no key was present. Replaced the stub
  with the real `keyOnTileAt` implementation (checks pack, floor item, and monster carried item).
  The `io/input-context.ts:200` stub is in the `search()` context and never calls `checkForMissingKeys`.
  C: `Items.c` (checkForMissingKeys), `Architect.c` (machine definitions).
  TS: `turn.ts` (`updateEnvironment` / `EnvironmentContext`). **M**

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

- [ ] **B58 — Eels don't re-submerge in water after surfacing** — Electric eels (and
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

- [x] **B59 — Click-to-travel uses line-of-sight path, not the hovered path** — When hovering
  over a distant cell the highlighted path correctly shows the pathfound route (avoiding walls,
  going around obstacles). But when the player clicks to travel that route, the character
  moves in a straight line (or attempts line-of-sight) rather than following the displayed
  path. Root cause is likely that hover uses `getLineCoordinates` / Dijkstra distance map for
  the preview, while `travelMap` / `travelRoute` starts a separate distance computation from
  scratch and does not reuse the hover result — or that `travelRoute` uses the bolt-path
  `getLineCoordinates` instead of a passability-aware path.
  C: `Movement.c:1566` (travelRoute), `Movement.c:1611` (travelMap), `Movement.c` (getLineCoordinates).
  TS: `movement/travel-explore.ts`, `io/hover-wiring.ts`. **M**

- [x] **B60 — All terrain flashes/glows on every player move; water animation is input-driven not continuous** — Two related defects in `shuffleTerrainColors`:

  **Defect 1 — No `TERRAIN_COLORS_DANCING` guard (primary visual symptom).**
  In C (`IO.c:966`), `shuffleTerrainColors` only processes cells where
  `pmap[i][j].flags & TERRAIN_COLORS_DANCING`. That flag is set during `bakeTerrainColors`
  (`IO.c:950`) only when the cell's fore/back color has `colorDances: true` — which is
  true for water, fire, lava shimmer, etc., but NOT for plain walls or floor. In the TS port
  (`render-state.ts:45`), there is no `TERRAIN_COLORS_DANCING` check — the loop re-rolls
  every cell in the map unconditionally, causing all terrain to shimmer on every player turn.
  The `TERRAIN_COLORS_DANCING` flag is defined in `types/flags.ts:50` and is set by
  `bakeTerrainColors` in `io/display.ts` (see the `colorDances` branch there), but
  `shuffleTerrainColors` never reads it.

  **Defect 2 — Full reset instead of delta (jarring vs smooth).**
  In C, each update is a delta: `terrainRandomValues[i][j][dir] += rand_range(-600, 600)`
  clamped to [0, 1000] — the values drift gradually, producing smooth shimmer. In TS the
  update is a full reset: `terrainRandomValues[i][j][k] = randRange(0, 1000)` — values
  jump randomly every turn, producing a harsh strobe instead of a smooth glow.

  **Defect 3 — Animation is input-driven, not continuous.**
  In C, color animation between player inputs is driven by `mainInputLoop` calling
  `displayLevel` / `refreshDungeonCell` on a ~25 ms timer (via `pauseAnimation`), which
  re-renders dancing cells using their current `terrainRandomValues`. The TS port's
  `mainGameLoop` (`platform.ts`) just awaits `waitForEvent()` and never redraws while idle,
  so animated terrain only updates when the player acts. Fix requires a periodic idle repaint
  in `mainGameLoop` (e.g., `pauseAndCheckForEvent(25)` → `commitDraws()` loop while
  waiting for input) and calling `shuffleTerrainColors` on that tick, NOT only in
  `turn-processing.ts:791`.

  Fix order: 1 and 2 are independent one-liners in `render-state.ts`. 3 requires changes
  to `platform.ts`. Fixing 1+2 will eliminate the visual glitch entirely; 3 adds the
  continuous idle animation. RNG isolation is tracked separately in B61.

  C: `IO.c:940` (bakeTerrainColors / colorDances → TERRAIN_COLORS_DANCING),
  `IO.c:966` (shuffleTerrainColors — guard + delta logic),
  `Time.c:2558` (called during playerTurn), `RogueMain.c:709` (level-init reset).
  TS: `render-state.ts:45` (shuffleTerrainColors), `io/display.ts` (bakeTerrainColors /
  TERRAIN_COLORS_DANCING), `time/turn-processing.ts:791` (caller), `platform.ts` (mainGameLoop). **M**

- [x] **B61 — Cosmetic RNG isolation: color animation consumes gameplay seed** — In C,
  `shuffleTerrainColors` (and other visual-only effects) wraps its RNG calls with
  `assureCosmeticRNG` / `restoreRNG` — macros that save the gameplay RNG state, switch to
  a separate `cosmeticRNG` instance, do the visual work, then restore the gameplay state.
  The cosmetic RNG is seeded independently (not from the gameplay seed) and its draws are
  never recorded. In the TS port, `shuffleTerrainColors` calls the main game `randRange`
  directly. Once B60 defect 3 is fixed (idle animation fires on a ~25 ms timer), each
  session will consume a different number of gameplay RNG draws depending on how long the
  player sits idle — causing recording/playback to desync.

  **Fix:** Add a second independent PRNG instance for cosmetic use. The cosmetic RNG does
  not need to be deterministic or seeded from the gameplay seed — `Math.random()` or a
  fixed cosmetic seed is fine, since visual effects do not affect game state. Implement as
  a `cosmeticRandRange` function (or a swappable RNG context) and use it in
  `shuffleTerrainColors`. Then audit all C `assureCosmeticRNG` call sites and wire their
  TS equivalents to the cosmetic RNG.

  **Audit starting point:** `grep -n assureCosmeticRNG src/brogue/*.c` — find every C
  call site and confirm whether the TS equivalent uses `randRange` (bad) or no RNG at all
  (safe). `shuffleTerrainColors` is the only confirmed offender so far.

  **Dependency:** Should be done after B60 (defect 3), since the RNG divergence only
  manifests at scale once idle animation is running. Fixes 1+2 of B60 are safe to ship
  before B61.

  C: `IO.c:966` (`assureCosmeticRNG` / `restoreRNG` usage), `Rogue.h` (cosmeticRNG
  declaration). TS: `render-state.ts:45` (shuffleTerrainColors), RNG module. **M**

- [ ] **B62 — Pit bloat fall: no message or keypress before showing lower level** — When a
  pit bloat explodes beneath the player, the game jumps immediately to the lower level with
  no feedback. In C, a "you fell" message (e.g. "you tumble into the depths!") is displayed
  with `REQUIRE_ACKNOWLEDGMENT` before the level transition is rendered.
  C: `Time.c` / `RogueMain.c` (player-fall code path triggered by `DF_PIT_BLOAT_HOLE` /
  `changeLevelIfAppropriate`).
  TS: `lifecycle.ts` (level-transition sequence), `movement/travel-explore.ts`. **S**

- [x] **B63 — Monkeys don't steal items — they fight to the death** — Fixed: `specialHit`
  was stubbed to `() => {}` in `buildCombatAttackContext`; wired to real `specialHitFn` with
  a full `RunicContext` including `monsterStealsFromPlayerImpl`. Monkey now steals an
  unequipped item, enters `MODE_PERM_FLEEING`, and shows a message. 7 new tests added.
  C: `Monsters.c` (steal-item behavior, `MA_STEAL_ITEMS`).
  TS: `monsters/monster-behavior.ts` or `monsters/monster-state.ts`. **M**

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

- [ ] **B66 — Pink Jelly doesn't split when hit** — Pink jellies (and any monster with
  `MA_CLONE_SELF_ON_DEFEND`) should spawn a clone when struck. The `MA_CLONE_SELF_ON_DEFEND`
  branch in the TS combat handler may be a stub or missing entirely.
  C: `Combat.c` (`MA_CLONE_SELF_ON_DEFEND` in inflictDamage / defend logic).
  TS: `combat.ts` (defend path / ability flag handling). **M**

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

- [x] **B74 — Eating food doesn't restore the satiety (nutrition) meter** — After eating a
  ration or mango the sidebar satiety bar does not update. `eat()` in `item-handlers.ts`
  correctly sets `player.status[StatusEffect.Nutrition]`, but no `refreshSideBar` call
  follows, so the sidebar never repaints with the new value. Fix: call `refreshSideBar` (or
  the equivalent sidebar-update fn) after updating nutrition, the same way other status
  changes do.
  C: `Items.c:eat` (calls `printSideBar` after updating nutrition).
  TS: `items/item-handlers.ts:eat` (line ~421 — add refreshSideBar after setting
  Nutrition). **S**

- [ ] **B75 — `monsterBlinkToSafety` uses stubbed `updateSafetyMap`** — Monsters with a
  blink-to-safety bolt (e.g. will-o-wisps) blink to a random/suboptimal destination
  instead of the genuinely safest reachable cell, because the `blinkToSafetyCtx` in
  `turn-monster-zap-wiring.ts:549` has `updateSafetyMap: () => {}`.
  C: `Monsters.c:monsterBlinkToSafety` uses the global safety map.
  TS: `turn-monster-zap-wiring.ts` — wire `updateSafetyMap` the same way it was done
  in `turn-monster-ai.ts` for `getSafetyMap` (PR #38). **S**

- [ ] **B76 — Fleeing monsters can path through deep water** — When a non-aquatic monster
  (e.g. monkey) flees, `nextStep` is called with `null` as the monster argument, so
  `monsterAvoids` is never checked. The safety map makes deep water cost 5 (not forbidden),
  so water becomes a valid escape path when cornered.
  C: same `null` pattern — this is technically C-faithful but the user considers it a bug.
  Fix: pass `monst` instead of `null` in `monster-actions.ts:1149`.
  `nextStep` already calls `monsterAvoids(monst, neighbor)` when monst is non-null. **S**

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
