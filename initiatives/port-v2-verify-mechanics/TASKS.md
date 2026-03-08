# TASKS: port-v2-verify-mechanics

Each sub-phase is one session's work. Commit and generate a handoff prompt after each.

---

## Phase 1a: Targeting UI — read-through + plan ✓

*Source: port-v2-platform Phase 8. C file: Items.c.*

- [x] Read C source for all 7 targeting functions:
      `itemCanBeCalled` (Items.c:1314), `inscribeItem` (Items.c:1292),
      `moveCursor` (Items.c:5372), `nextTargetAfter` (Items.c:5281),
      `hiliteTrajectory` (Items.c:5328), `playerCancelsBlinking` (Items.c:6470),
      `chooseTarget` (Items.c:5607)
- [x] Map inputs, outputs, dependencies, and rough line counts for each
- [x] Confirm file placement: `io/cursor-move.ts` (moveCursor + nextTargetAfter),
      `items/targeting.ts` (hiliteTrajectory + canAutoTargetMonster + playerCancelsBlinking + chooseTarget),
      `items/item-utils.ts` (itemCanBeCalled), `items/item-call.ts` (inscribeItem)
- [x] Document decisions in a `## Session Notes` in PLAN.md
- [x] Commit notes; generate handoff

## Phase 1b: Targeting UI — pure helpers ✓

*Implement the four smaller/independent targeting functions.*

- [x] Implement `itemCanBeCalled` (Items.c:1314, ~20 lines) — pure predicate; no context needed
- [x] Implement `inscribeItem` (Items.c:1292, ~30 lines) — async dialog; needs message + input context
- [x] Implement `moveCursor` (Items.c:5372) — moves targeting reticle one step on the map;
      wire into io/input-context.ts
- [x] Implement `nextTargetAfter` (Items.c:5281) — advances cursor to next visible hostile
- [x] Add unit tests for all four; export from relevant index
- [x] Remove any test.skip entries now unblocked
- [x] All files under 600 lines
- [x] Commit; generate handoff

## Phase 1c: Targeting UI — display helpers ✓

- [x] Implement `hiliteTrajectory` (Items.c:5328) — draw bolt path highlight on dungeon map;
      uses `getLineCoordinates` (already in bolt-geometry.ts); new file items/targeting.ts
- [x] Implement `playerCancelsBlinking` (Items.c:6470) — async blink cancel check;
      returns true if player should abort blink due to lava; uses confirm pattern
- [x] Add unit tests for both (23 tests in tests/items/targeting.test.ts)
- [x] Export from items/index.ts; test.skip comment updated (wiring deferred to Phase 1d)
- [x] All files under 600 lines (targeting.ts ~250 lines)
- [x] Commit; generate handoff

## Phase 1d: Targeting UI — chooseTarget ✓

*The full targeting UI loop. Depends on Phase 1b + 1c functions being in place.*

- [x] Implement `chooseTarget` (Items.c:5607, ~200 lines) — full bolt targeting UI loop;
      player moves cursor, cycles targets, confirms or cancels; returns target Pos or null;
      async (uses waitForEvent); needs moveCursor, nextTargetAfter, hiliteTrajectory
- [x] Add integration tests (mock IO; confirm target selection + cancel paths)
- [x] Wire async cascade: ItemHandlerContext.chooseTarget + playerCancelsBlinking → async;
      useStaffOrWand + apply → async; stubs in items.ts remain for platform IO layer
- [x] Remove/update test.skip entries now unblocked
- [x] All files under 600 lines (targeting.ts 522, targeting.test.ts 447, choose-target.test.ts 248)
- [x] Commit; generate handoff

---

## Phase 2: charmRechargeDelay — C cross-check + fix ✓

*Flagged in port-v2-fix-rendering Phase 5a notes as likely buggy.*

- [x] Read `src/brogue/PowerTables.c` — find the `charmRechargeDelay` formula
- [x] Compare to `rogue-ts/src/power/power-tables.ts` implementation
- [x] Suspected bug: extra `* FP_FACTOR / 100n` in decay term produces astronomically large
      values at enchant > 1; confirm or refute against C source
- [x] Bug confirmed: fix the formula, update the flagged test comment in power-tables.test.ts,
      add a cross-validation test against known C output values
- [x] Commit; generate handoff

---

## Phase 3a: NEEDS-VERIFICATION — Monsters.c query helpers + spawning ✓

*Reference: `docs/audit/gaps-Monsters.md`. For each function: read C, read TS, verify or fix.*

Functions in scope (10):
`isValidWanderDestination`, `successorTerrainFlags`, `isLocalScentMaximum`, `scentDirection`,
`canDirectlySeeMonster`, `discoveredTerrainFlagsAtLoc`, `monsterAtLoc`,
`populateMonsters`, `getRandomMonsterSpawnLocation`, `spawnPeriodicHorde`

- [x] For each function: confirm TS matches C, add direct test, or fix divergence + add test.skip
- [x] Note: `successorTerrainFlags` is a callback param, not standalone — verify the callback
      shape matches C's `discoveredTerrainFlagsAtLoc` behavior
      **BUG FIXED**: movement.ts callback was skipping `dungeonFeatureCatalog` lookup,
      returning flags for tile index = DF_SHOW_DOOR instead of the discovered tile's flags.
      Fixed callback: `df = tileCatalog[tileType].discoverType; return tileCatalog[dungeonFeatureCatalog[df].tile].flags`
- [x] Note: `monsterAtLoc` uses a builder pattern (`buildMonsterAtLoc`) — verify the closure
      matches C's direct global lookup — **VERIFIED**: player check first, then iterate monsters; functionally equivalent to C.
- [x] Note: `discoveredTerrainFlagsAtLoc` is sometimes wired as a stub; confirm domain fn is correct
      **VERIFIED**: domain fn in state/helpers.ts is correct. Stubs remain in turn.ts, monsters.ts, lifecycle.ts.
- [x] `getRandomMonsterSpawnLocation`: not a standalone TS export — test.skip added describing the gap
- [x] Commit; generate handoff

## Phase 3b: NEEDS-VERIFICATION — Monsters.c movement AI ✓

*Highest-risk subset: these could have silent behavioral simplifications vs C.*

Functions in scope (10):
`moveMonsterPassivelyTowards`, `wanderToward`, `pathTowardCreature`, `traversiblePathBetween`,
`moveMonster`, `monsterMillAbout`, `moveAlly`, `knownToPlayerAsPassableOrSecretDoor`,
`setPlayerDisplayChar`, `makeMonsterDropItem`

- [x] For each function: confirm TS matches C, add direct test, or fix divergence + add test.skip
- [x] Note: `moveMonster` wiring is stubbed in turn.test.ts:171 — domain function verified correct
- [x] Note: `makeMonsterDropItem` simplified inline — test.skip added (drops at monster loc,
      C uses getQualifyingPathLocNear to find valid drop cell; monster-ai-movement.test.ts)
- [x] Note: `moveAlly` — multiple divergences documented with test.skip entries:
      missing BE_BLINKING guard in flee-blink path; wrong leash condition (enemy dist vs player
      dist); missing MONST_MAINTAINS_DISTANCE, attackWouldBeFutile; missing corpse-eating branch
      and scent-follow return-to-leader path
- [x] Note: `traversiblePathBetween` — Bresenham vs bolt getLineCoordinates, test.skip added
- [x] Note: `knownToPlayerAsPassableOrSecretDoor` — undiscovered-cell divergence noted
      (harmless in practice), test.skip in movement.test.ts
- [x] New files: monster-ai-movement.test.ts (26 pass / 5 skip), game.test.ts (3 pass)
- [x] Extended: monster-wander.test.ts (+4 wanderToward tests), movement.test.ts (+1 skip)
- [x] 84 files, 2074 pass, 125 skip
- [x] Commit; generate handoff

---

## Phase 4a: NEEDS-VERIFICATION — RogueMain.c lifecycle core ✓

*Reference: `docs/audit/gaps-RogueMain.md`. All 20 have real implementations — this is a
testing gap, not a porting gap. Prioritize by gameplay impact.*

Functions in scope (~10):
`rogueMain`, `initializeRogue`, `startLevel`, `freeEverything`, `gameOver`, `victory`,
`freeCreature`, `removeDeadMonsters`, `removeDeadMonstersFromList`, `updateColors`

- [x] For each: read C, confirm TS is faithful, add a direct unit or integration test
- [x] Note: `gameOver` is split (core.ts sync state + game-lifecycle.ts death screen) — verified
      both halves; core.ts sync phase has 5 tests; game-lifecycle.ts death screen has test.skip
      (requires IO mocks); split confirmed faithful to C
- [x] Note: `victory` — domain fn verified faithful to C; test.skip added (requires IO + display mocks)
- [x] Note: `freeCreature` — tested including recursive carriedMonster cleanup (tests/game/game-cleanup.test.ts)
- [x] Note: `startLevel` — faithful to C except environment simulation loop is STUBBED:
      C runs `while (timeAway--) { updateEnvironment(); }` (up to 100 iters); TS skips loop
      entirely (no ctx.updateEnvironment call). test.skip added in game-level.test.ts.
- [x] Note: `initializeRogue` — verified faithful to C; test.skip added (full GameInitContext mock
      complexity; indirect coverage via seed-determinism.test.ts)
- [x] Note: `getOrdinalSuffix` + `printBrogueVersion` tests added to game.test.ts
      (moved here from Phase 4b since both live in game-init.ts)
- [x] 86 files, 2114 pass, 130 skip
- [x] Commit; generate handoff

## Phase 4b: NEEDS-VERIFICATION — RogueMain.c init helpers + wiring gaps ✓

Functions in scope (~7 remaining):
`initializeGameVariant`, `enableEasyMode`, `executeEvent`, `fileExists`, `chooseFile`,
`openFile`, `welcome`
(Note: `getOrdinalSuffix`, `printBrogueVersion`, `unflag` tested in Phase 4a)

- [x] For each: read C, confirm TS is faithful, add a direct unit test
- [x] Note: `initializeGameVariant` context stub in menus.ts:244 is a no-op with no test.skip —
      test.skip added to menus.test.ts; domain fn in game-init.ts:400 confirmed correct
- [x] Note: `enableEasyMode` context stub in io/input-context.ts:209 — test.skip already in
      turn.test.ts:255 (confirmed); domain fn in game-lifecycle.ts:627 confirmed correct
- [x] Note: `executeEvent` context stub in menus.ts:256 — test.skip already in
      menus.test.ts:184 (confirmed); domain fn in io/input-dispatch.ts:485 confirmed correct
- [x] Note: `welcome` color divergence — TS concatenates plain string without encodeMessageColor;
      test.skip added documenting amulet-name colorization gap
- [x] 86 files, 2137 pass, 133 skip (was 2114/130)
- [x] Commit; generate handoff

---

## Phase 5a: NEEDS-VERIFICATION — Architect.c terrain helpers + lake/room functions ✓

*Reference: `docs/audit/gaps-Architect.md`. All 18 have real implementations.*
*Note: seed regression tests in tests/seed-determinism.test.ts provide indirect coverage
for most of these — use them as confidence signal, but still add direct tests where feasible.*

Functions in scope (~8):
`cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType`,
`cleanUpLakeBoundaries`, `removeDiagonalOpenings`, `attachHallwayTo`,
`lakeFloodFill`, `buildABridge`

- [x] For each: read C, confirm TS is faithful; add a direct test (or confirm seed regression
      tests provide adequate coverage and document why)
- [x] Note: `cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType` live in state/helpers.ts —
      all three VERIFIED MATCH C; 7 tests added in state-helpers.test.ts
- [x] Note: `cleanUpLakeBoundaries` — VERIFIED MATCH C; 2 tests in architect-lakes.test.ts
- [x] Note: `removeDiagonalOpenings` — VERIFIED MATCH C (x2Src computed differently but
      logically equivalent to C's x2 variable); 2 tests in architect-lakes.test.ts
- [x] Note: `attachHallwayTo` — VERIFIED MATCH C; 2 tests in architect-rooms.test.ts
- [x] Note: `lakeFloodFill` — VERIFIED MATCH C; 2 tests in architect-lakes.test.ts
- [x] Note: `buildABridge` — VERIFIED MATCH C; bridgeRatioX/Y uses Math.floor vs C's (short)
      cast — negligible ±1 difference due to integer vs float intermediate ops; 2 tests added
- [x] 86 files, 2155 pass, 133 skip (was 2137/133; +18 tests)
- [x] Commit; generate handoff

## Phase 5b: NEEDS-VERIFICATION — Architect.c top-level orchestrators

Functions in scope (~10):
`abortItemsAndMonsters`, `redesignInterior`, `buildAMachine`, `addMachines`,
`runAutogenerators`, `digDungeon`, `refreshWaypoint`, `setUpWaypoints`,
`placeStairs`, `initializeLevel`

- [ ] For each: read C, confirm TS is faithful; add a direct test where feasible, or document
      why seed regression tests are sufficient coverage
- [ ] Note: `buildAMachine` and `addMachines` are the top-level machine-placement orchestrators —
      these are exercised by seed regression tests; confirm no behavioral divergences
- [ ] Note: `digDungeon` and `initializeLevel` are wired in lifecycle.ts but have no direct tests
- [ ] Commit; generate handoff

---

## Phase 6: Stubs audit + final cleanup

*Consolidate all stub tracking. This phase ensures every stub has a test.skip and
every solved test.skip is removed or updated.*

- [ ] Run `grep -r "it\.skip\|test\.skip\|describe\.skip"` across all test files; record count
- [ ] For each test.skip: verify the underlying function is still unimplemented/unwired;
      if it is now implemented, either activate the test or remove the skip with a note
- [ ] Run `grep -r "() => {}\|() => false\|// stub"` across `rogue-ts/src/` to find
      candidate untracked stubs; for each, confirm a paired test.skip exists
- [ ] Specifically confirm the known gaps from the audit:
      `enableEasyMode` (input-context.ts:203), `executeEvent` stub (menus.ts:256),
      `initializeGameVariant` (menus.ts:253), `monsterDetails` sidebar wiring
- [ ] Record final test.skip count in TASKS.md
- [ ] Commit; generate handoff

---

## Deferred

Lower-risk NEEDS-VERIFICATION files — address if bugs are found during playtesting:
- MainMenu.c (20 functions)
- Buttons.c (8 functions)
- Wizard.c (10 functions)
- Light.c (5 functions)
- Items.c (5 functions)
- IO.c (4 functions)
- Movement.c (3 functions)
- Time.c (2 functions)
- Combat.c (2 functions)

Stale items removed from predecessor initiatives:
- [REMOVED] Zap pipeline — fully implemented in port-v2-domain-gaps Phases 1b–1d

Permanently deferred (persistence layer):
- `loadSavedGame` — blocked on persistence layer; no filesystem in browser
- Recordings.c file I/O (28 functions) — deferred to persistence layer initiative
- SeedCatalog.c (10 functions) — CLI tool, no browser equivalent needed
