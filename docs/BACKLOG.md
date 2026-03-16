# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-15 (B58 fixed; B66 fixed; B71 fixed; B81 fixed; B50 fixed; B77–B82 filed)
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

- [ ] **B77 — Player health regenerates faster than C game** — HP recovers noticeably
  faster than in Brogue v1.15.1. The regen logic in `time/turn-processing.ts:481` looks
  structurally correct (decrement `turnsUntilRegen` by 1000, regen when ≤ 0). The most
  likely causes: (1) `updatePlayerRegenerationDelay` (`items/item-effects.ts:524`) is
  called at game start before `turnsBetweenRegen` is set, leaving it at 0 — meaning
  `turnsUntilRegen += 0` each regen tick, causing regen every single turn; (2) the
  `while (maxHP > turnsPerHP)` loop in `updatePlayerRegenerationDelay` diverges from C
  when `turnsPerHP` rounds differently; (3) `regenPerTurn` is non-zero when it shouldn't
  be. Start: add a console.log of `turnsUntilRegen` and `turnsBetweenRegen` immediately
  after game init and compare to C.
  C: `Items.c:7907` (`updatePlayerRegenerationDelay`), `Time.c:2275` (regen tick).
  TS: `items/item-effects.ts:524`, `time/turn-processing.ts:481`. **S**

- [ ] **B78 — Items don't drift on water tiles (`T_MOVES_ITEMS`)** — Items on deep water
  stay put; in C they drift to an adjacent open cell each turn via `updateFloorItems`.
  Root cause confirmed: `lifecycle.ts:521` has `updateFloorItems: () => {}` stub with the
  comment "stub — separate backlog item". The real function `items/floor-items.ts:95` is
  fully implemented (including the `T_MOVES_ITEMS` branch at line 162) but is never
  called from the main turn loop. Fix: wire `buildUpdateFloorItemsFn` in the
  `TurnProcessingContext` in `lifecycle.ts` the same way B71 wired it for vault entry.
  C: `Items.c:1192` (`updateFloorItems`, `T_MOVES_ITEMS` branch at line 1240).
  TS: `lifecycle.ts:521`, `items/floor-items.ts:162`. **S**

- [ ] **B79 — No bolt animation when zapping a staff** — Zapping a staff of firebolt
  hits the target and applies all combat effects correctly, but no bolt glyph or color
  trail travels across the map from the player to the target. The `zap.ts` animation loop
  (lines 214–251) calls `ctx.render.hiliteCell`, `plotCharWithColor`, `pauseAnimation`,
  etc. — but in `buildStaffZapFn` (`items/staff-wiring.ts:118`), the entire `render`
  sub-context is stubbed: `hiliteCell: () => {}`, `plotCharWithColor: () => {}`,
  `pauseAnimation: async () => false`. Fix: replace those stubs with real implementations
  using `buildHiliteCellFn` / `buildRefreshDungeonCellFn` from `io-wiring.ts` and the
  platform `commitDraws` / `waitForEvent` for `pauseAnimation`.
  C: `Items.c:4964` (bolt animation loop with `hiliteCell`).
  TS: `items/staff-wiring.ts:118`, `items/zap.ts:214`. **M**

- [ ] **B80 — Goblin conjurer's spectral blades don't disappear when the conjurer dies**
  — Spectral blades (which have `MB_BOUND_TO_LEADER`) should die on the first
  `playerTurnEnded` after their leader is killed. In C (`Monsters.c:4110`), when a leader
  dies its `MB_BOUND_TO_LEADER` followers have their `leader` nulled and `MB_FOLLOWER`
  cleared; `playerTurnEnded` then kills them. The TS logic (leader cleanup in
  `combat-damage.ts:519` → `demoteMonsterFromLeadership` in `monster-ally-ops.ts:84`;
  bound-follower kill in `turn-processing.ts:514`) looks structurally correct. Possible
  root causes: (a) the conjurer is not flagged `MB_LEADER` at spawn (check
  `monster-spawning.ts:spawnMinions` sets `MB_LEADER` on the horde leader), so
  `demoteMonsterFromLeadership` iterates nothing; (b) the `creatureState !== Ally` guard
  in `turn-processing.ts:519` fails because blades are initialized as `Ally` when their
  leader is an enemy. Reproduce, add a console.log in `demoteMonsterFromLeadership` to
  confirm followers are found, and trace the flag state.
  C: `Monsters.c:4110` (leader death follower loop), `Monsters.c:1602` (`MB_BOUND_TO_LEADER` spawn).
  TS: `monsters/monster-ally-ops.ts:84`, `time/turn-processing.ts:514`. **S**

- [ ] **B81 — Burning status doesn't deal damage each turn; fire doesn't spread to foliage**
  — Two related defects after a firebolt hit:
  **Defect 1 — Burning doesn't tick damage.** A monster hit by a firebolt shows
  `STATUS_BURNING` but its HP doesn't decrease each turn. `decrementMonsterStatus`
  (`monster-state.ts:774`) handles this: it decrements `status[Burning]` and calls
  `ctx.inflictDamage(null, monst, damage)`. But in the `MonsterStateContext` built by
  `turn-monster-ai.ts:196`, `inflictDamage: () => false` is a stub. Any monster that
  catches fire via bolt or terrain will lose the burn effect with no damage.
  Fix: wire real `inflictDamage` in the monster-state context the same way the combat
  context wires it (using `inflictDamageFn` from `combat-damage.ts`).
  **Defect 2 — Fire doesn't spread to adjacent flammable terrain.** In C, when a cell
  is on fire, `applyInstantTileEffects` and the dungeon feature promotion chain spread
  fire to adjacent `T_IS_FLAMMABLE` cells. In TS, check whether
  `buildApplyInstantTileEffectsFn` (`tile-effects-wiring.ts`) is wired with a real
  `spreadFire` / tile-promote callback, or whether those are stubs.
  C: `Monsters.c:1851` (burning damage in `decrementMonsterStatus`),
  `Time.c` / `Architect.c` (fire spread via dungeon feature promotion).
  TS: `turn-monster-ai.ts:197` (`inflictDamage` stub), `tile-effects-wiring.ts`. **M**

- [ ] **B82 — Vault items always the same type regardless of seed** — Items found in
  vaults are predictably the same type (e.g., bronze wands, health charms) across
  different seeds, suggesting `chooseKind` always selects index 0. In C (`Items.c:409`),
  `chooseKind` uses `rand_range(1, totalFrequencies)` to pick an item type weighted by
  frequency. The TS port of `chooseKind` (`items/item-generation.ts`) should be the same.
  Likely causes: (1) the item catalog frequencies are not initialized before vault item
  generation — if all `frequency` values are 0, `rand_range(1, 0)` has undefined behavior
  and the loop exits at index 0 immediately; (2) the `rand_range` call is consuming the
  wrong RNG (e.g., a shared RNG that has not been seeded), so it always returns a
  deterministic value early in the range; (3) `meteredItems` frequency adjustments
  (applied for scrolls/potions) are not applied to wand/charm tables, leaving them at
  their default (possibly uniform) frequencies. Check `chooseKind` output by logging
  the `randomFrequency` and `totalFrequencies` on vault item generation.
  C: `Items.c:409` (`chooseKind`), `Items.c:342` (wand generation), `Items.c:366` (charm generation).
  TS: `items/item-generation.ts` (`chooseKind`), `globals/item-catalog.ts` (frequency fields). **M**

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
