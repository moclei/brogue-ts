# Port V2 Backlog

**Purpose:** Single living checklist of everything remaining in the port besides the
persistence layer. No more initiatives — just pick the next item, do it, check it off.

**Ground truth:** C source in `src/brogue/`. Every item here maps to a C function.
Read the C source before touching any TS code.

**Status:** updated 2026-03-16 (B82 fixed)
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

- [x] **B64 — Staff of obstruction does nothing** — Zapping a staff of obstruction has no
  visible effect. In C, `BOLT_OBSTRUCTION` spawns crystal terrain features along the bolt
  path via `spawnDungeonFeature`. The effect stub or the bolt-detonation handler for
  `BoltEffect.Obstruction` may be missing.
  C: `Items.c` (BOLT_OBSTRUCTION bolt effect).
  TS: `items/bolt-detonation.ts` or `items/zap-context.ts` (Obstruction case). **S**

- [x] **B65 — Creatures can occupy the same square as the player** — Monsters can move
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

- [x] **B69 — Ring items rendered as filled circles, not 'o' character** — Ring items appear
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

- [x] **B71 — Staffs/charms/wands/rings not identified on entering a vault (B25 revisit)** —
  B25 was marked WAI, but playtest suggests C does auto-identify non-weapon/non-armor vault
  items (staffs, charms, wands, rings) when the player first steps into the vault. Weapons
  and armor are not auto-identified. Requires C source verification before coding.
  C: `Items.c` (vault entry / `checkForMissingKeys` / `identifyItemKind`).
  TS: `turn.ts` or `items/item-handlers.ts` (vault-entry scan). **M**
  Fix: `updateFloorItems` in `items/floor-items.ts` already had the auto-ID logic (checking
  `ITEM_KIND_AUTO_ID` + same machine number), but `EnvironmentContext.updateFloorItems` was
  stubbed as `() => {}` in `turn.ts`. Created `items/floor-items-wiring.ts` with
  `buildUpdateFloorItemsFn()` that wires the real `updateFloorItems` with closures for
  `identifyItemKind`, `promoteTile`, `activateMachine`, `circuitBreakersPreventActivation`,
  `burnItem`, and `getQualifyingLocNear`. Also wires the full item burning, drift, and
  tile-promotion paths. `swapItemEnchants` remains stubbed (`() => false`) — filed as a
  separate mechanic. Verified: `identifyItemKind` no-ops for WEAPON/ARMOR (no tableCount),
  identifies kind for STAFF/WAND/RING (tableCount > 0 in switch).

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

- [x] **B77 — Player health regenerates faster than C game** — HP recovers noticeably
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

- [x] **B79 — No bolt animation when zapping a staff** — Zapping a staff of firebolt
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

- [x] **B81 — Burning status doesn't deal damage each turn; fire doesn't spread to foliage**
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

- [x] **B83 — Bolt lighting: cells near bolt trail don't glow as it travels** — Firing a
  staff or wand shows the glyph trail (wired in B79) but cells near the bolt are not
  illuminated: `backUpLighting`, `restoreLighting`, `demoteVisibility`, `paintLight`,
  `updateFieldOfViewDisplay`, `updateVision`, `updateLighting` in `buildZapRenderContext`
  were all no-ops. Fixed by wiring real implementations via `buildBoltLightingFns()`
  in `vision-wiring.ts`; `ZapRenderContext.paintLight` now takes a `LightSource` and
  `zap.ts` pre-computes `boltLights[]` (one per step, matching Items.c:4896-4906).
  C: `Items.c:4912-4974` (bolt lighting loop). TS: `staff-wiring.ts`, `vision-wiring.ts`,
  `items/zap.ts`, `items/zap-context.ts`. **M**

- [x] **B82 — Vault items always the same type regardless of seed** — Items found in
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

---

## Stub audit (informational — do not action without backlog item)

Generated by `codeql/queries/ts/find-ts-stubs.ql` — 2026-03-16.
These are property slots in context builder objects that return constant/empty values and
may never have been properly wired. No C source checked — some may be intentional permanent
stubs. Do not fix without a corresponding backlog item.

| File | Line | Property | Stub |
|------|------|----------|------|
| src/combat.ts | 158 | monsterAvoids | `() => false` |
| src/combat.ts | 172 | updateVision | `() => {}` |
| src/combat.ts | 247 | magicWeaponHit | `() => {}` |
| src/combat.ts | 249 | specialHit | `() => {}` |
| src/combat.ts | 250 | splitMonster | `() => {}` |
| src/combat.ts | 262 | decrementWeaponAutoIDTimer | `() => {}` |
| src/combat.ts | 263 | rechargeItemsIncrementally | `() => {}` |
| src/combat.ts | 266 | message | `() => {}` |
| src/combat.ts | 272 | checkForDisenchantment | `() => {}` |
| src/combat.ts | 273 | strengthCheck | `() => {}` |
| src/combat.ts | 277 | handlePaladinFeat | `() => {}` |
| src/combat.ts | 278 | setPureMageFeatFailed | `() => {}` |
| src/combat.ts | 279 | setDragonslayerFeatAchieved | `() => {}` |
| src/io-wiring.ts | 223 | playerInDarkness | `() => false` |
| src/io-wiring.ts | 234 | randPercent | `() => false` |
| src/io-wiring.ts | 249 | estimatedArmorValue | `() => 0` |
| src/io-wiring.ts | 290 | printTextBox | `() => 0` |
| src/io-wiring.ts | 291 | printProgressBar | `() => {}` |
| src/io/input-context.ts | 158 | itemName | `() => {}` |
| src/io/input-context.ts | 159 | describeHallucinatedItem | `() => {}` |
| src/io/input-context.ts | 160 | removeItemFromChain | `() => false` |
| src/io/input-context.ts | 161 | deleteItem | `() => {}` |
| src/io/input-context.ts | 163 | promoteTile | `() => {}` |
| src/io/input-context.ts | 164 | messageWithColor | `() => {}` |
| src/io/input-context.ts | 191 | monsterRevealed | `() => false` |
| src/io/input-context.ts | 200 | keyOnTileAt | `() => null` |
| src/io/input-context.ts | 239 | charmRechargeDelay | `() => 0` |
| src/io/input-context.ts | 242 | identify | `() => {}` |
| src/io/input-context.ts | 243 | updateIdentifiableItems | `() => {}` |
| src/io/input-context.ts | 244 | numberOfMatchingPackItems | `() => 0` |
| src/io/input-context.ts | 254 | messageColorFromVictim | `() => null` |
| src/io/input-context.ts | 255 | inflictDamage | `() => false` |
| src/io/input-context.ts | 256 | killCreature | `() => {}` |
| src/io/input-context.ts | 257 | demoteMonsterFromLeadership | `() => {}` |
| src/io/input-context.ts | 258 | restoreMonster | `() => {}` |
| src/io/input-context.ts | 259 | removeCreature | `() => {}` |
| src/io/input-context.ts | 260 | prependCreature | `() => {}` |
| src/io/input-context.ts | 261 | avoidedFlagsForMonster | `() => 0` |
| src/io/input-context.ts | 270 | recordKeystroke | `() => {}` |
| src/io/input-context.ts | 272 | pauseAnimation | `() => false` |
| src/io/input-context.ts | 372 | printString | `() => {}` |
| src/io/input-context.ts | 392 | initializeButtonState | `() => {}` |
| src/io/input-context.ts | 400 | rectangularShading | `() => {}` |
| src/io/input-context.ts | 406 | pauseForMilliseconds | `() => false` |
| src/io/input-context.ts | 407 | locIsInWindow | `() => false` |
| src/io/input-context.ts | 425 | flashTemporaryAlert | `() => {}` |
| src/io/input-context.ts | 426 | displayMonsterFlashes | `() => {}` |
| src/io/input-context.ts | 471 | saveGame | `() => {}` |
| src/io/input-context.ts | 472 | gameOver | `() => {}` |
| src/io/input-context.ts | 474 | showCursor | `() => {}` |
| src/io/input-context.ts | 475 | hideCursor | `() => {}` |
| src/io/input-context.ts | 478 | takeScreenshot | `() => false` |
| src/io/input-context.ts | 479 | dialogCreateItemOrMonster | `() => {}` |
| src/io/input-context.ts | 488 | playerCanSeeOrSense | `() => false` |
| src/io/input-context.ts | 491 | printFloorItemDetails | `() => {}` |
| src/io/input-context.ts | 503 | clearDisplayBuffer | `() => {}` |
| src/io/input-context.ts | 505 | overlayDisplayBuffer | `() => {}` |
| src/io/input-context.ts | 506 | restoreDisplayBuffer | `() => {}` |
| src/io/input-context.ts | 507 | drawButtonsInState | `() => {}` |
| src/io/input-context.ts | 509 | refreshSideBar | `() => {}` |
| src/io/input-context.ts | 519 | playerCanSeeOrSense | `() => false` |
| src/io/input-context.ts | 552 | hilitePath | `() => {}` |
| src/io/input-context.ts | 553 | clearCursorPath | `() => {}` |
| src/io/input-context.ts | 554 | hiliteCell | `() => {}` |
| src/io/input-context.ts | 555 | refreshDungeonCell | `() => {}` |
| src/io/input-context.ts | 558 | allocGrid | `() => []` |
| src/io/input-context.ts | 559 | freeGrid | `() => {}` |
| src/io/input-context.ts | 560 | fillGrid | `() => {}` |
| src/io/input-context.ts | 563 | populateCreatureCostMap | `() => {}` |
| src/io/input-context.ts | 564 | getPlayerPathOnMap | `() => 0` |
| src/io/input-context.ts | 565 | processSnapMap | `() => {}` |
| src/io/input-context.ts | 567 | diagonalBlocked | `() => false` |
| src/io/input-context.ts | 569 | terrainFlags | `() => 0` |
| src/io/input-context.ts | 570 | terrainMechFlags | `() => 0` |
| src/io/input-context.ts | 573 | recordKeystroke | `() => {}` |
| src/io/input-context.ts | 575 | executePlaybackInput | `() => false` |
| src/io/input-context.ts | 578 | characterForbiddenInFilename | `() => false` |
| src/io/inventory-actions.ts | 270 | spawnDungeonFeature | `() => {}` |
| src/io/inventory-actions.ts | 271 | promoteTile | `() => {}` |
| src/io/inventory-actions.ts | 272 | discover | `() => {}` |
| src/io/inventory-actions.ts | 276 | pickUpItemAt | `() => {}` |
| src/io/sidebar-wiring.ts | 178 | playerInDarkness | `() => false` |
| src/io/sidebar-wiring.ts | 189 | randPercent | `() => false` |
| src/io/sidebar-wiring.ts | 204 | estimatedArmorValue | `() => 0` |
| src/io/sidebar-wiring.ts | 251 | printProgressBar | `() => {}` |
| src/io/sidebar-wiring.ts | 311 | terrainFlags | `() => 0` |
| src/io/sidebar-wiring.ts | 312 | terrainMechFlags | `() => 0` |
| src/io/sidebar-wiring.ts | 318 | dormantMonsterAtLoc | `() => null` |
| src/io/sidebar-wiring.ts | 320 | monsterRevealed | `() => false` |
| src/io/sidebar-wiring.ts | 321 | refreshDungeonCell | `() => {}` |
| src/io/sidebar-wiring.ts | 325 | spawnDungeonFeature | `() => {}` |
| src/io/sidebar-wiring.ts | 330 | itemMagicPolarity | `() => 0` |
| src/io/sidebar-wiring.ts | 332 | monsterCanSubmergeNow | `() => false` |
| src/items.ts | 198 | cellHasGas | `() => false` |
| src/items.ts | 220 | extinguishFireOnCreature | `() => {}` |
| src/items.ts | 267 | temporaryMessage | `() => {}` |
| src/items.ts | 268 | printString | `() => {}` |
| src/items.ts | 293 | recalculateEquipmentBonuses | `() => {}` |
| src/items.ts | 297 | recordKeystroke | `() => {}` |
| src/items.ts | 298 | recordKeystrokeSequence | `() => {}` |
| src/items.ts | 299 | recordMouseClick | `() => {}` |
| src/items.ts | 316 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/items.ts | 326 | message | `() => {}` |
| src/items.ts | 354 | chooseNewWanderDestination | `() => {}` |
| src/items.ts | 362 | extinguishFireOnCreature | `() => {}` |
| src/items.ts | 395 | refreshWaypoint | `() => {}` |
| src/items.ts | 398 | addScentToCell | `() => {}` |
| src/items.ts | 401 | discover | `() => {}` |
| src/items.ts | 402 | discoverCell | `() => {}` |
| src/items.ts | 441 | discover | `() => {}` |
| src/items.ts | 447 | demoteMonsterFromLeadership | `() => {}` |
| src/items.ts | 448 | makeMonsterDropItem | `() => {}` |
| src/items.ts | 465 | updateVision | `() => {}` |
| src/items.ts | 495 | updateIdentifiableItem | `() => {}` |
| src/items.ts | 518 | createFlare | `() => {}` |
| src/items.ts | 523 | updateVision | `() => {}` |
| src/items.ts | 524 | updateClairvoyance | `() => {}` |
| src/items/item-commands.ts | 148 | wakeUp | `() => {}` |
| src/items/item-commands.ts | 153 | refreshSideBar | `() => {}` |
| src/items/item-commands.ts | 157 | refreshDungeonCell | `() => {}` |
| src/items/item-commands.ts | 183 | monsterAvoids | `() => false` |
| src/items/item-commands.ts | 185 | demoteMonsterFromLeadership | `() => {}` |
| src/items/item-commands.ts | 186 | checkForContinuedLeadership | `() => {}` |
| src/items/item-commands.ts | 190 | updateEncumbrance | `() => {}` |
| src/items/item-commands.ts | 191 | updateMinersLightRadius | `() => {}` |
| src/items/item-commands.ts | 192 | updateVision | `() => {}` |
| src/items/item-commands.ts | 344 | monsterIsHidden | `() => false` |
| src/items/item-commands.ts | 346 | playerCanSeeOrSense | `() => false` |
| src/items/item-commands.ts | 370 | clearDisplayBuffer | `() => {}` |
| src/items/item-commands.ts | 372 | overlayDisplayBuffer | `() => {}` |
| src/items/item-commands.ts | 373 | restoreDisplayBuffer | `() => {}` |
| src/items/item-commands.ts | 374 | drawButtonsInState | `() => {}` |
| src/items/item-commands.ts | 376 | refreshSideBar | `() => {}` |
| src/items/item-commands.ts | 381 | playerCanSeeOrSense | `() => false` |
| src/items/item-commands.ts | 418 | magicWeaponHit | `() => {}` |
| src/items/item-commands.ts | 419 | moralAttack | `() => {}` |
| src/items/item-commands.ts | 420 | splitMonster | `() => {}` |
| src/items/item-commands.ts | 421 | handlePaladinFeat | `() => {}` |
| src/items/item-commands.ts | 463 | refreshDungeonCell | `() => {}` |
| src/items/item-commands.ts | 467 | monstersFall | `() => {}` |
| src/items/item-commands.ts | 468 | updateFloorItems | `() => {}` |
| src/items/item-commands.ts | 469 | monstersTurn | `() => {}` |
| src/items/item-commands.ts | 470 | keyOnTileAt | `() => null` |
| src/items/item-commands.ts | 471 | removeCreature | `() => false` |
| src/items/item-commands.ts | 472 | prependCreature | `() => {}` |
| src/items/item-commands.ts | 479 | exposeTileToFire | `() => false` |
| src/items/item-commands.ts | 491 | itemName | `() => {}` |
| src/items/item-commands.ts | 493 | discover | `() => {}` |
| src/items/item-commands.ts | 494 | refreshDungeonCell | `() => {}` |
| src/items/item-commands.ts | 540 | promoteTile | `() => {}` |
| src/items/item-commands.ts | 541 | exposeCreatureToFire | `() => {}` |
| src/items/item-helper-context.ts | 117 | promoteTile | `() => {}` |
| src/items/item-helper-context.ts | 119 | messageWithColor | `() => {}` |
| src/items/item-helper-context.ts | 126 | discover | `() => {}` |
| src/items/staff-wiring.ts | — | refreshSideBar | `() => {}` |
| src/items/staff-wiring.ts | — | displayCombatText | `() => {}` |
| src/items/staff-wiring.ts | — | refreshDungeonCell | `() => {}` |
| src/items/staff-wiring.ts | 152 | cellHasGas | `() => false` |
| src/items/staff-wiring.ts | 183 | monsterIsHidden | `() => false` |
| src/items/staff-wiring.ts | 185 | playerCanSeeOrSense | `() => false` |
| src/items/staff-wiring.ts | 208 | clearDisplayBuffer | `() => {}` |
| src/items/staff-wiring.ts | 210 | overlayDisplayBuffer | `() => {}` |
| src/items/staff-wiring.ts | 211 | restoreDisplayBuffer | `() => {}` |
| src/items/staff-wiring.ts | 212 | drawButtonsInState | `() => {}` |
| src/items/staff-wiring.ts | 214 | refreshSideBar | `() => {}` |
| src/items/staff-wiring.ts | 219 | playerCanSeeOrSense | `() => false` |
| src/items/staff-wiring.ts | 296 | cellHasGas | `() => false` |
| src/items/staff-wiring.ts | 312 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/items/staff-wiring.ts | 372 | moralAttack | `() => {}` |
| src/items/staff-wiring.ts | 373 | splitMonster | `() => {}` |
| src/items/staff-wiring.ts | 374 | handlePaladinFeat | `() => {}` |
| src/items/staff-wiring.ts | 396 | becomeAllyWith | `() => {}` |
| src/items/staff-wiring.ts | 409 | extinguishFireOnCreature | `() => {}` |
| src/items/staff-wiring.ts | 410 | refreshDungeonCell | `() => {}` |
| src/items/staff-wiring.ts | 414 | empowerMonster | `() => {}` |
| src/items/staff-wiring.ts | 417 | cloneMonster | `() => null` |
| src/items/staff-wiring.ts | 421 | exposeTileToFire | `() => false` |
| src/items/staff-wiring.ts | 422 | exposeTileToElectricity | `() => false` |
| src/items/staff-wiring.ts | 423 | createFlare | `() => {}` |
| src/items/staff-wiring.ts | 426 | tunnelize | `() => false` |
| src/items/staff-wiring.ts | 430 | demoteMonsterFromLeadership | `() => {}` |
| src/items/staff-wiring.ts | 431 | makeMonsterDropItem | `() => {}` |
| src/items/staff-wiring.ts | 432 | refreshDungeonCell | `() => {}` |
| src/items/staff-wiring.ts | 438 | spawnDungeonFeature | `() => {}` |
| src/items/staff-wiring.ts | 443 | message | `() => {}` |
| src/items/staff-wiring.ts | 470 | chooseNewWanderDestination | `() => {}` |
| src/items/staff-wiring.ts | 476 | disentangle | `() => {}` |
| src/items/staff-wiring.ts | 478 | pickUpItemAt | `() => {}` |
| src/items/staff-wiring.ts | 479 | checkForMissingKeys | `() => {}` |
| src/items/staff-wiring.ts | 480 | findAlternativeHomeFor | `() => null` |
| src/items/staff-wiring.ts | 481 | autoIdentify | `() => {}` |
| src/items/staff-wiring.ts | 484 | beckonMonster | `() => {}` |
| src/items/staff-wiring.ts | 487 | polymorph | `() => false` |
| src/items/staff-wiring.ts | 490 | setUpWaypoints | `() => {}` |
| src/lifecycle-gameover.ts | 64 | printString | `() => {}` |
| src/lifecycle-gameover.ts | 66 | funkyFade | `() => {}` |
| src/lifecycle-gameover.ts | 66 | strLenWithoutEscapes | `() => 0` |
| src/lifecycle-gameover.ts | 69 | deleteMessages | `() => {}` |
| src/lifecycle-gameover.ts | 69 | displayMoreSign | `() => {}` |
| src/lifecycle-gameover.ts | 70 | displayMoreSignWithoutWaitingForAcknowledgment | `() => {}` |
| src/lifecycle-gameover.ts | 71 | confirm | `() => false` |
| src/lifecycle-gameover.ts | 71 | flashTemporaryAlert | `() => {}` |
| src/lifecycle-gameover.ts | 74 | itemValue | `() => 0` |
| src/lifecycle-gameover.ts | 76 | displayInventory | `() => 0` |
| src/lifecycle-gameover.ts | 76 | isVowelish | `() => false` |
| src/lifecycle-gameover.ts | 77 | printHighScores | `() => {}` |
| src/lifecycle-gameover.ts | 77 | flushBufferToFile | `() => {}` |
| src/lifecycle-gameover.ts | 77 | saveHighScore | `() => false` |
| src/lifecycle-gameover.ts | 78 | saveRecording | `() => {}` |
| src/lifecycle-gameover.ts | 79 | saveRecordingNoPrompt | `() => {}` |
| src/lifecycle-gameover.ts | 80 | notifyEvent | `() => {}` |
| src/lifecycle-gameover.ts | 80 | recordKeystroke | `() => {}` |
| src/lifecycle-gameover.ts | 80 | saveRunHistory | `() => {}` |
| src/lifecycle.ts | 161 | monsterAvoids | `() => false` |
| src/lifecycle.ts | 237 | initRecording | `() => {}` |
| src/lifecycle.ts | 255 | flavorMessage | `() => {}` |
| src/lifecycle.ts | 326 | spawnHorde | `() => null` |
| src/lifecycle.ts | 331 | killCreature | `() => {}` |
| src/lifecycle.ts | 363 | deleteItem | `() => {}` |
| src/lifecycle.ts | 372 | playerCanSee | `() => false` |
| src/lifecycle.ts | 374 | message | `() => {}` |
| src/lifecycle.ts | 375 | spawnDungeonFeature | `() => {}` |
| src/lifecycle.ts | 376 | promoteTile | `() => {}` |
| src/lifecycle.ts | 377 | discover | `() => {}` |
| src/lifecycle.ts | 378 | refreshDungeonCell | `() => {}` |
| src/lifecycle.ts | 382 | removeItemFromArray | `() => {}` |
| src/lifecycle.ts | 383 | itemIsPositivelyEnchanted | `() => false` |
| src/lifecycle.ts | 383 | itemIsHeavyWeapon | `() => false` |
| src/lifecycle.ts | 516 | updateEnvironment | `() => {}` |
| src/lifecycle.ts | 517 | restoreMonster | `() => {}` |
| src/lifecycle.ts | 518 | restoreItems | `() => {}` |
| src/lifecycle.ts | 519 | updateMonsterState | `() => {}` |
| src/lifecycle.ts | 540 | refreshSideBar | `() => {}` |
| src/lifecycle.ts | 541 | messageWithColor | `() => {}` |
| src/lifecycle.ts | 542 | RNGCheck | `() => {}` |
| src/lifecycle.ts | 543 | flushBufferToFile | `() => {}` |
| src/lifecycle.ts | 545 | hideCursor | `() => {}` |
| src/menus.ts | 168 | isApplicationActive | `() => true` |
| src/menus.ts | 181 | setGameVariant | `() => {}` |
| src/menus.ts | 272 | printHighScores | `() => {}` |
| src/menus.ts | 284 | message | `() => {}` |
| src/menus.ts | 297 | initializeGameVariant | `() => {}` |
| src/menus.ts | 300 | initializeLaunchArguments | `() => {}` |
| src/menus.ts | 303 | flushBufferToFile | `() => {}` |
| src/menus.ts | 304 | saveGameNoPrompt | `() => {}` |
| src/menus.ts | 309 | executeEvent | `() => {}` |
| src/menus.ts | 310 | displayAnnotation | `() => {}` |
| src/menus.ts | 311 | pausePlayback | `() => {}` |
| src/menus.ts | 314 | listFiles | `() => []` |
| src/menus.ts | 315 | loadRunHistory | `() => []` |
| src/menus.ts | 316 | saveResetRun | `() => {}` |
| src/menus.ts | 317 | openFile | `() => false` |
| src/monsters.ts | 422 | updateVision | `() => {}` |
| src/monsters.ts | 436 | playerHasRespirationArmor | `() => false` |
| src/movement-cost-map.ts | 142 | assureCosmeticRNG | `() => {}` |
| src/movement-cost-map.ts | 143 | restoreRNG | `() => {}` |
| src/movement-weapon-context.ts | 83 | cellHasGas | `() => false` |
| src/movement-weapon-context.ts | 133 | zap | `() => {}` |
| src/movement-weapon-context.ts | 135 | confirm | `() => true` |
| src/movement-weapon-context.ts | 158 | pauseAnimation | `() => {}` |
| src/movement.ts | 197 | monstersFall | `() => {}` |
| src/movement.ts | 197 | monstersTurn | `() => {}` |
| src/movement.ts | 197 | updateFloorItems | `() => {}` |
| src/movement.ts | 197 | keyOnTileAt | `() => null` |
| src/movement.ts | 198 | removeCreature | `() => false` |
| src/movement.ts | 198 | prependCreature | `() => {}` |
| src/movement.ts | 203 | exposeTileToFire | `() => false` |
| src/movement.ts | 394 | recordKeystroke | `() => {}` |
| src/movement.ts | 395 | cancelKeystroke | `() => {}` |
| src/movement.ts | 511 | monsterAvoids | `() => false` |
| src/movement.ts | 512 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/movement.ts | 547 | getPlayerPathOnMap | `() => 0` |
| src/movement.ts | 550 | recordMouseClick | `() => {}` |
| src/movement.ts | 558 | displayLevel | `() => {}` |
| src/movement.ts | 561 | nextBrogueEvent | `() => {}` |
| src/movement.ts | 562 | executeMouseClick | `() => {}` |
| src/movement.ts | 563 | printString | `() => {}` |
| src/tile-effects-wiring.ts | 122 | monstersFall | `() => {}` |
| src/tile-effects-wiring.ts | 122 | monstersTurn | `() => {}` |
| src/tile-effects-wiring.ts | 122 | keyOnTileAt | `() => null` |
| src/tile-effects-wiring.ts | 122 | updateFloorItems | `() => {}` |
| src/tile-effects-wiring.ts | 123 | removeCreature | `() => false` |
| src/tile-effects-wiring.ts | 123 | prependCreature | `() => {}` |
| src/tile-effects-wiring.ts | 128 | exposeTileToFire | `() => false` |
| src/tile-effects-wiring.ts | 191 | wakeUp | `() => {}` |
| src/tile-effects-wiring.ts | 197 | refreshSideBar | `() => {}` |
| src/tile-effects-wiring.ts | 208 | makeMonsterDropItem | `() => {}` |
| src/tile-effects-wiring.ts | 209 | clearLastTarget | `() => {}` |
| src/tile-effects-wiring.ts | 210 | clearYendorWarden | `() => {}` |
| src/tile-effects-wiring.ts | 211 | clearCellMonsterFlag | `() => {}` |
| src/tile-effects-wiring.ts | 212 | prependCreature | `() => {}` |
| src/tile-effects-wiring.ts | 213 | applyInstantTileEffectsToCreature | `() => {}` |
| src/tile-effects-wiring.ts | 224 | anyoneWantABite | `() => {}` |
| src/tile-effects-wiring.ts | 225 | demoteMonsterFromLeadership | `() => {}` |
| src/tile-effects-wiring.ts | 226 | checkForContinuedLeadership | `() => {}` |
| src/tile-effects-wiring.ts | 231 | updateEncumbrance | `() => {}` |
| src/tile-effects-wiring.ts | 233 | updateVision | `() => {}` |
| src/tile-effects-wiring.ts | 267 | monsterIsInClass | `() => false` |
| src/tile-effects-wiring.ts | 274 | demoteMonsterFromLeadership | `() => {}` |
| src/tile-effects-wiring.ts | 280 | numberOfMatchingPackItems | `() => 0` |
| src/tile-effects-wiring.ts | 288 | dropItem | `() => null` |
| src/tile-effects-wiring.ts | 289 | eat | `() => {}` |
| src/tile-effects-wiring.ts | 290 | makeMonsterDropItem | `() => {}` |
| src/tile-effects-wiring.ts | 305 | flavorMessage | `() => {}` |
| src/tile-effects-wiring.ts | 308 | flashMessage | `() => {}` |
| src/tile-effects-wiring.ts | 310 | displayLevel | `() => {}` |
| src/tile-effects-wiring.ts | 326 | startLevel | `() => {}` |
| src/tile-effects-wiring.ts | 327 | teleport | `() => {}` |
| src/tile-effects-wiring.ts | 328 | createFlare | `() => {}` |
| src/tile-effects-wiring.ts | 329 | animateFlares | `() => {}` |
| src/tile-effects-wiring.ts | 330 | spawnPeriodicHorde | `() => {}` |
| src/tile-effects-wiring.ts | 331 | monstersFall | `() => {}` |
| src/tile-effects-wiring.ts | 332 | updateFloorItems | `() => {}` |
| src/tile-effects-wiring.ts | 333 | synchronizePlayerTimeState | `() => {}` |
| src/tile-effects-wiring.ts | 334 | recalculateEquipmentBonuses | `() => {}` |
| src/tile-effects-wiring.ts | 335 | updateEncumbrance | `() => {}` |
| src/tile-effects-wiring.ts | 336 | playerInDarkness | `() => false` |
| src/tile-effects-wiring.ts | 337 | playerTurnEnded | `() => {}` |
| src/tile-effects-wiring.ts | 351 | search | `() => false` |
| src/tile-effects-wiring.ts | 352 | recordKeystroke | `() => {}` |
| src/tile-effects-wiring.ts | 356 | highestPriorityLayer | `() => 0` |
| src/tile-effects-wiring.ts | 364 | assureCosmeticRNG | `() => {}` |
| src/tile-effects-wiring.ts | 365 | restoreRNG | `() => {}` |
| src/time/stairs-wiring.ts | 54 | getQualifyingLocNear | `() => null` |
| src/time/stairs-wiring.ts | 58 | restoreMonster | `() => {}` |
| src/time/stairs-wiring.ts | 66 | inflictDamage | `() => false` |
| src/time/stairs-wiring.ts | 67 | killCreature | `() => {}` |
| src/turn-monster-ai.ts | 189 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/turn-monster-ai.ts | 202 | heal | `() => {}` |
| src/turn-monster-ai.ts | 203 | inflictDamage | `() => false` |
| src/turn-monster-ai.ts | 204 | killCreature | `() => {}` |
| src/turn-monster-ai.ts | 205 | extinguishFireOnCreature | `() => {}` |
| src/turn-monster-ai.ts | 206 | makeMonsterDropItem | `() => {}` |
| src/turn-monster-ai.ts | 212 | playerHasRespirationArmor | `() => false` |
| src/turn-monster-ai.ts | 219 | monsterCanSubmergeNow | `() => false` |
| src/turn-monster-ai.ts | 267 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/turn-monster-ai.ts | 275 | updateVision | `() => {}` |
| src/turn-monster-ai.ts | 276 | pickUpItemAt | `() => {}` |
| src/turn-monster-ai.ts | 290 | vomit | `() => {}` |
| src/turn-monster-ai.ts | 300 | handleWhipAttacks | `() => false` |
| src/turn-monster-ai.ts | 301 | handleSpearAttacks | `() => false` |
| src/turn-monster-ai.ts | 349 | waypointDistanceMap | `() => null` |
| src/turn-monster-ai.ts | 357 | waypointDistanceMap | `() => null` |
| src/turn-monster-ai.ts | 380 | calculateDistances | `() => {}` |
| src/turn-monster-ai.ts | 408 | demoteMonsterFromLeadership | `() => {}` |
| src/turn-monster-ai.ts | 409 | createFlare | `() => {}` |
| src/turn-monster-ai.ts | 440 | zap | `() => {}` |
| src/turn-monster-ai.ts | 458 | updateSafetyMap | `() => {}` |
| src/turn-monster-ai.ts | 459 | updateAllySafetyMap | `() => {}` |
| src/turn-monster-ai.ts | 485 | zap | `() => {}` |
| src/turn-monster-ai.ts | 507 | updateSafeTerrainMap | `() => {}` |
| src/turn-monster-ai.ts | 650 | makeMonsterDropItem | `() => {}` |
| src/turn-monster-ai.ts | 660 | updateSafetyMap | `() => {}` |
| src/turn-monster-ai.ts | 677 | updateSafeTerrainMap | `() => {}` |
| src/turn.ts | 138 | clearLastTarget | `() => {}` |
| src/turn.ts | 139 | clearYendorWarden | `() => {}` |
| src/turn.ts | 140 | clearCellMonsterFlag | `() => {}` |
| src/turn.ts | 141 | prependCreature | `() => {}` |
| src/turn.ts | 142 | applyInstantTileEffectsToCreature | `() => {}` |
| src/turn.ts | 150 | monsterAvoids | `() => false` |
| src/turn.ts | 160 | updateVision | `() => {}` |
| src/turn.ts | 224 | discover | `() => {}` |
| src/turn.ts | 224 | spawnDungeonFeature | `() => {}` |
| src/turn.ts | 224 | promoteTile | `() => {}` |
| src/turn.ts | 228 | pickUpItemAt | `() => {}` |
| src/turn.ts | 330 | monsterAvoids | `() => false` |
| src/turn.ts | 331 | monsterIsInClass | `() => false` |
| src/turn.ts | 349 | numberOfMatchingPackItems | `() => 0` |
| src/turn.ts | 364 | flavorMessage | `() => {}` |
| src/turn.ts | 366 | displayLevel | `() => {}` |
| src/turn.ts | 367 | displayAnnotation | `() => {}` |
| src/turn.ts | 370 | confirm | `() => true` |
| src/turn.ts | 371 | flashMessage | `() => {}` |
| src/turn.ts | 372 | recordKeystroke | `() => {}` |
| src/turn.ts | 374 | pauseAnimation | `() => false` |
| src/turn.ts | 390 | monstersFall | `() => {}` |
| src/turn.ts | 390 | monstersTurn | `() => {}` |
| src/turn.ts | 390 | updateFloorItems | `() => {}` |
| src/turn.ts | 390 | keyOnTileAt | `() => null` |
| src/turn.ts | 395 | exposeTileToFire | `() => false` |
| src/turn.ts | 400 | updateMapToShore | `() => {}` |
| src/turn.ts | 401 | updateSafetyMap | `() => {}` |
| src/turn.ts | 419 | analyzeMap | `() => {}` |
| src/turn.ts | 441 | RNGCheck | `() => {}` |
| src/turn.ts | 442 | animateFlares | `() => {}` |
| src/turn.ts | 458 | storeMemories | `() => {}` |
| src/turn.ts | 461 | rechargeItemsIncrementally | `() => {}` |
| src/turn.ts | 462 | processIncrementalAutoID | `() => {}` |
| src/turn.ts | 467 | monsterShouldFall | `() => false` |
| src/turn.ts | 468 | monstersFall | `() => {}` |
| src/turn.ts | 469 | decrementPlayerStatus | `() => {}` |
| src/turn.ts | 476 | monstersFall | `() => {}` |
| src/turn.ts | 477 | updateFloorItems | `() => {}` |
| src/turn.ts | 499 | message | `() => {}` |
| src/turn.ts | 506 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/turn.ts | 528 | chooseNewWanderDestination | `() => {}` |
| src/turn.ts | 537 | animateFlares | `() => {}` |
| src/turn.ts | 542 | handleHealthAlerts | `() => {}` |
| src/turn.ts | 569 | search | `() => false` |
| src/ui.ts | 249 | refreshDungeonCell | `() => {}` |
| src/ui.ts | 250 | refreshSideBar | `() => {}` |
| src/ui.ts | 285 | refreshSideBar | `() => {}` |
| src/ui.ts | 286 | refreshDungeonCell | `() => {}` |
| src/ui.ts | 305 | pauseBrogue | `() => false` |
| src/ui.ts | 604 | pauseBrogue | `() => false` |
| src/ui.ts | 605 | pauseAnimation | `() => false` |
| src/vision-wiring.ts | 138 | randPercent | `() => false` |
| src/vision-wiring.ts | 138 | randRange | `() => 0` |
| src/vision-wiring.ts | 150 | burnedTerrainFlagsAtLoc | `() => 0` |
| src/vision-wiring.ts | 150 | discoveredTerrainFlagsAtLoc | `() => 0` |
| src/vision-wiring.ts | 151 | passableArcCount | `() => 0` |
| src/vision-wiring.ts | 167 | messageWithColor | `() => {}` |
| src/vision-wiring.ts | 186 | assureCosmeticRNG | `() => {}` |
| src/vision-wiring.ts | 187 | restoreRNG | `() => {}` |
| src/vision-wiring.ts | 261 | freeGrid | `() => {}` |
| src/vision-wiring.ts | 262 | dijkstraScan | `() => {}` |
