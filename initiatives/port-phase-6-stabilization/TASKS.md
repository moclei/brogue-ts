# Phase 6: Stabilization — Tasks

## Playtest Round 1

### Bug 1: Dying returns to title screen with no death notice
**Symptom:** When the player dies, the game immediately returns to the title screen without showing the "You die…" message, death animation, or score summary.

**Root Cause:** `buildLifecycleContext()` in `runtime.ts:5578` stubs `nextBrogueEvent` to immediately return `ESCAPE_KEY`:
```ts
nextBrogueEvent(_event, ...) {
    _event.eventType = EventType.Keystroke;
    _event.param1 = ESCAPE_KEY;
}
```
The `gameOver()` function in `game-lifecycle.ts:245` loops waiting for the player to press space/escape to acknowledge the death message. Because the stub instantly returns ESCAPE, the loop exits on its first iteration — the player never sees the death screen. Additionally:
- `funkyFade` is stubbed (line 5559) — no death animation
- `displayInventory` is stubbed (line 5598) — can't view final inventory
- `displayMoreSign` may also be affected

**Proposed Fix:** Wire `nextBrogueEvent` in lifecycle context to `await browserConsole.waitForEvent()`. This requires making `gameOver` async (and propagating that through `doGameOver` and its callers). Also wire `funkyFade` to at least do a `commitDraws()` + short delay.

**Files:** `ts/src/runtime.ts` (buildLifecycleContext)

---

### Bug 2: "X plunges out of sight!" spam on game start
**Symptom:** On game start, the player sometimes sees multiple messages like "The monkey plunges out of sight!" before taking any action.

**Root Cause:** `monstersFall()` in `creature-effects.ts:697` is called during the first `playerTurnEnded()`. Any monsters placed on `T_AUTO_DESCENT` terrain (chasms, trapdoors) during dungeon generation will fall if they don't have `MB_PREPLACED` set. In the C code, `Architect.c` sets `MB_PREPLACED` on monsters during level generation, which is cleared when the monster is "finalized" — but the C code also takes care that monsters aren't placed on auto-descent terrain during initial generation. The TS dungeon generation may not be enforcing this constraint correctly, or `MB_PREPLACED` may not be set during the initial monster placement phase.

Additionally, `monsterShouldFall()` (creature-effects.ts:346) checks `!(monst.bookkeepingFlags & MB_PREPLACED)` — monsters without this flag will fall. If the dungeon generator doesn't set `MB_PREPLACED` during placement, all monsters on chasm/pit terrain fall on the first turn.

**Proposed Fix:** Audit the TS dungeon generation (architect/room placement) to ensure monsters are not placed on `T_AUTO_DESCENT` terrain. Alternatively, ensure `MB_PREPLACED` is set on all pre-placed monsters during `startLevel` and cleared after the first `playerTurnEnded`. Compare against C `Architect.c:3530` and `Architect.c:3548`.

**Files:** `ts/src/dungeon/` (architect), `ts/src/time/creature-effects.ts`, `ts/src/runtime.ts` (startLevel wiring)

---

### Bug 3: No underwater visual effect when walking in water
**Symptom:** When the player walks into deep water, the screen should show a blue-tinted underwater effect, but no visual change occurs.

**Root Cause:** `updatePlayerUnderwaterness()` in `creature-effects.ts:314` correctly sets `rogue.inWater = true` when the player enters deep water. However, `getCellAppearance()` in `runtime.ts:1164` **never applies the underwater color multiplier**. In the C code (`IO.c:1299`), after computing cell colors, it checks `rogue.inWater` and applies `deepWaterForeColor` / `deepWaterBackColor` multipliers to every cell. The TS `getCellAppearance` is missing this step entirely.

**Proposed Fix:** Add underwater color tinting to `getCellAppearance()` in `runtime.ts`. After computing `cellForeColor` and `cellBackColor`, if `rogue.inWater` is true, apply color multipliers matching the C code's `deepWaterForeColor` (20, 20, 40) and `deepWaterBackColor` (20, 20, 40).

**Files:** `ts/src/runtime.ts` (getCellAppearance)

---

### Bug 4: Can't open in-game menu
**Symptom:** There is no way to open the in-game action menu (Save, Quit, etc.) during gameplay.

**Root Cause:** The simplified `mainInputLoop` in `runtime.ts:6956` dispatches keystrokes and mouse clicks directly to `executeKeystrokeFn` and `executeMouseClickFn`, but it **never initializes or renders the bottom-bar buttons** (Explore, Rest, Search, Menu, Inventory). The fully ported `mainInputLoop` in `io-input.ts:1490` calls `initializeMenuButtons()` (line 1513) and uses `buttonInputLoop` to process button clicks — including the Menu button (index 3) which triggers `actionMenu()`.

The simplified loop has no button rendering, no button state, and no Menu button click handler. Since the Menu button has no hotkey (unlike Explore/Rest/Search which have keyboard shortcuts), there is no keyboard shortcut to open the menu either.

**Proposed Fix:** Either:
1. Wire the simplified `mainInputLoop` to initialize and render the bottom-bar buttons and handle button clicks (including Menu → `actionMenu()`), OR
2. Replace the simplified `mainInputLoop` with the fully ported version from `io-input.ts`, providing the required `InputContext` dependencies, OR
3. Add a keyboard shortcut for the menu (e.g., Escape key) to `executeKeystroke` as a temporary workaround.

**Files:** `ts/src/runtime.ts` (mainInputLoop), `ts/src/io/io-input.ts` (initializeMenuButtons, actionMenu)

---

### Bug 5: Picked up scroll has no name
**Symptom:** When the player picks up an unidentified scroll, it displays as `scroll entitled ""` instead of showing a generated title like `scroll entitled "FLEZBAR DUNE"`.

**Root Cause:** `shuffleFlavors()` in `item-naming.ts:668` generates random scroll titles into the `itemTitles[]` array, but **never assigns them to `scrollTable[i].flavor`**. The `scrollTable` entries in `item-catalog.ts:241` have `flavor: ""` initially, and nothing ever fills them in. In the C code (`Items.c:shuffleFlavors`), after generating titles it does:
```c
for (i=0; i<NUMBER_SCROLL_KINDS; i++) {
    scrollTable[i].flavor = itemTitles[i];
}
```
The TS code is missing this assignment loop. When `itemName()` (item-naming.ts:260) renders an unidentified scroll, it reads `ctx.scrollTable[theItem.kind].flavor` which is still `""`.

Note: `scrollTable` is declared with `Object.freeze([...])` which freezes the array but NOT the individual objects — so `scrollTable[i].flavor = "..."` would work fine. But the assignment is simply missing.

**Proposed Fix:** Add the scroll title assignment loop at the end of `shuffleFlavors()`:
```ts
for (let i = 0; i < gc.numberScrollKinds; i++) {
    scrollTable[i].flavor = itemTitles[i];
}
```
Also check if potion/staff/wand/ring flavor assignments are similarly missing.

**Files:** `ts/src/items/item-naming.ts` (shuffleFlavors)

---

### Bug 6: Can't rescue captive goblin
**Symptom:** Walking into a captive monster doesn't trigger the rescue dialog or free them.

**Root Cause:** The captive rescue code in `playerMoves()` (player-movement.ts:488) is gated behind `moveNotBlocked` (line 463). The `moveNotBlocked` check (line 443) requires either:
- The cell doesn't have `T_OBSTRUCTS_PASSABILITY`, OR
- The cell has `TM_PROMOTES_WITH_KEY` AND `keyInPackFor()` returns a key

Captive monsters are typically inside cage cells with `T_OBSTRUCTS_PASSABILITY`. If the player doesn't have the matching key, `moveNotBlocked` is false and the code never reaches the captive check. The C code handles this the same way — you need the key. However, there may be additional issues:
1. `keyInPackFor()` might not be wired correctly in `buildPlayerMoveContext()`
2. The `useKeyAt()` function might not properly promote the cage terrain
3. The cage terrain tiles might not have `TM_PROMOTES_WITH_KEY` set correctly in the tile catalog

Additionally, `confirm()` in the player move context is stubbed to `return true` — so if `moveNotBlocked` passes, the rescue should auto-confirm. The most likely issue is that `keyInPackFor()` or the cage terrain promotion is broken.

**Proposed Fix:** Debug the specific scenario: check if keys are being generated for captive cages, verify `keyInPackFor()` correctly matches keys to cage locations, and verify `useKeyAt()` promotes cage terrain. Compare against C `Movement.c` playerMoves captive handling.

**Files:** `ts/src/runtime.ts` (buildPlayerMoveContext, keyInPackFor wiring), `ts/src/movement/player-movement.ts`

---

### Bug 7: Bloats don't do their effect (any type)
**Symptom:** When bloats die (poison bloats, explosive bloats, etc.), they don't produce their expected area effect (gas cloud, explosion, etc.).

**Root Cause:** `killCreature()` in `combat-damage.ts:436` correctly checks `MA_DF_ON_DEATH` and calls `ctx.spawnDungeonFeature(x, y, decedent.info.DFType, 100, false)`. The combat context wires this to `spawnDungeonFeatureRuntime` (runtime.ts:3964), which is a **simplified single-tile implementation**. It only:
1. Sets the tile type on the single cell at (x,y)
2. Adds gas volume to that single cell

The C `spawnDungeonFeature` (Architect.c) handles:
- **Area propagation** via `startProbability`/`propagationTerrainFlags`
- **Subsequent DFs** via `DFF_SUBSEQ_EVERYWHERE`
- **Explosion effects** that spread to surrounding tiles
- **Damage to creatures** caught in the area

Bloat explosions (`DF_BLOAT_EXPLOSION`, `DF_BLOAT_DEATH`) require area propagation to fill neighboring tiles with gas/fire. The simplified version places the effect on only one cell, making it nearly imperceptible.

**Proposed Fix:** Enhance `spawnDungeonFeatureRuntime` to handle area propagation: iterate over neighboring cells up to the DF's propagation range, placing tiles based on `startProbability` and respecting `propagationTerrainFlags`. For immediate impact, at minimum add a BFS/flood-fill from (x,y) that places the DF's tile on neighboring cells. The fully ported `spawnDungeonFeature` in `dungeon/dungeon-generation.ts` (if it exists) could be wired in instead.

**Files:** `ts/src/runtime.ts` (spawnDungeonFeatureRuntime), `ts/src/globals/dungeon-feature-catalog.ts`

---

### Bug 8: Monkeys don't run away after stealing
**Symptom:** After a monkey steals an item from the player, it stays in place instead of fleeing.

**Root Cause:** The stealing code in `monsterStealsFromPlayerImpl` (runtime.ts:3846) correctly sets:
```ts
attacker.creatureMode = CreatureMode.PermFleeing;
attacker.creatureState = CreatureState.Fleeing;
```
However, the **simplified `monstersTurn`** in `runtime.ts:5740` only handles three states: `Sleeping` (line 5763), `TrackingScent` (line 5772), and `Wandering` (line 5833). It has **no handler for `CreatureState.Fleeing`**. When a monkey is set to `Fleeing`, the simplified code falls through all state checks and hits `monst.ticksUntilTurn = monst.movementSpeed` at line 5857, doing nothing — the monkey just sits there.

The fully ported `monstersTurn` in `monster-actions.ts:285` handles all states including fleeing (via `moveMonster` with flee-from-player pathfinding). But the `buildTurnProcessingContext` at runtime.ts:5740 uses the simplified version.

**Proposed Fix:** Add a `Fleeing` handler to the simplified `monstersTurn` that moves the monster away from the player: pick the adjacent cell that maximizes distance from the player (inverse of the tracking scent logic). Alternatively, wire the fully ported `monstersTurn` from `monster-actions.ts` if its `MonstersTurnContext` dependencies can be satisfied.

**Files:** `ts/src/runtime.ts` (simplified monstersTurn in buildTurnProcessingContext)

---

## Session Grouping

### Session A — Scroll naming + Underwater rendering + Monkey flee ✅
**Bugs:** #5, #3, #8  
**Branch:** `fix/playtest-round1-session-a`  
**Status:** Complete — all 2,263 tests pass, zero compilation errors.

### Session B — Death notice + Menu + Bottom bar + Inventory ✅
**Bugs:** #1, #4, plus follow-up fixes  
**Branch:** `fix/playtest-round1-session-b`  
**Status:** Complete — all 2,263 tests pass, zero compilation errors.  
**Notes:**
- Bug #1 used a "deferred death screen" pattern: `doGameOver` runs Phase 1 (state changes) synchronously, then `mainInputLoop` runs Phase 2 (interactive death screen) asynchronously after the while-loop exits.
- Bug #4 mapped ESCAPE key to `actionMenu()` in `executeKeystroke`. Added `gameHasEnded` guard after `waitForEvent` to prevent processing events when game ended.
- Follow-up: Death screen was auto-dismissing from leftover mouse events — added event-type filter loop.
- Follow-up: Bottom bar (Explore, Rest, Search, Menu, Inventory) now renders via `initializeMenuButtons` + `drawButtonsInState` in mainInputLoop.
- Follow-up: Inventory (`i` key) was not awaited — added `await` and changed interface to `void | Promise<void>`.

### Session C — Bloat effects + Plunge messages + Captive rescue
**Bugs:** #7, #2, #6  
**Surface area:** `runtime.ts` (spawnDungeonFeature), dungeon generation, player-movement wiring  
**Rationale:** These require deeper investigation into dungeon generation and terrain mechanics. May need to wire the full spawnDungeonFeature and audit dungeon placement.

### Session D — Inventory actions + Explore animation
**Bugs:** #9, #10  
**Surface area:** `io-inventory.ts` (buildInventoryContext wiring), `travel-explore.ts` (async pauseAnimation)  
**Rationale:** Inventory actions are a new finding from playtest round 1.5. Explore animation is a deeper architectural issue (sync→async).

---

## Playtest Round 1.5 (follow-up bugs found during verification)

### Bug 9: Inventory item actions don't work
**Symptom:** The inventory screen opens when pressing `i`, but selecting an item does nothing — no action menu appears (use, throw, call, equip, etc.).

**Root Cause (suspected):** The `buildInventoryContext()` in `runtime.ts` likely has stubs or incomplete wiring for the item action callbacks (`equip`, `unequip`, `apply`, `throw`, `call`, `relabel`). The inventory display may also not be rendering action buttons if `includeButtons` isn't propagated correctly, or the `buttonInputLoop` inside the inventory is not properly async-compatible.

**Proposed Fix:** Trace through `displayInventoryFn` → `buildInventoryContext()` to identify which callbacks are stubbed vs. wired. Ensure the item action menu (shown when selecting an item) has working button rendering and input handling.

**Files:** `ts/src/runtime.ts` (buildInventoryContext), `ts/src/io/io-inventory.ts`

---

### Bug 10: Explore animation jumps instead of walking
**Symptom:** Pressing `x` to explore causes the player to teleport to the destination instead of visibly walking step by step.

**Root Cause:** `explore()` in `travel-explore.ts` runs a synchronous `do-while` loop calling `playerMoves()` for each step. `pauseAnimation()` in `buildTravelExploreContext` (runtime.ts:3371) is stubbed to `browserConsole.pauseForMilliseconds(0, ...)` — it passes duration `0` and returns immediately. The browser never gets a chance to repaint between steps because JS blocks the rendering thread in a synchronous loop.

**Proposed Fix:** Make `pauseAnimation` async with a real delay (`await new Promise(r => setTimeout(r, duration))`). This requires making `explore()` and its callers async, propagating through `exploreKey` → `executeKeystroke`. A significant but contained refactor.

**Files:** `ts/src/runtime.ts` (buildTravelExploreContext.pauseAnimation), `ts/src/movement/travel-explore.ts`
