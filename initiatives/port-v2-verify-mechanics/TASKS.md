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

## Phase 1b: Targeting UI — pure helpers

*Implement the four smaller/independent targeting functions.*

- [ ] Implement `itemCanBeCalled` (Items.c:1314, ~20 lines) — pure predicate; no context needed
- [ ] Implement `inscribeItem` (Items.c:1292, ~30 lines) — async dialog; needs message + input context
- [ ] Implement `moveCursor` (Items.c:5372) — moves targeting reticle one step on the map;
      wire into io/input-context.ts
- [ ] Implement `nextTargetAfter` (Items.c:5281) — advances cursor to next visible hostile
- [ ] Add unit tests for all four; export from relevant index
- [ ] Remove any test.skip entries now unblocked
- [ ] All files under 600 lines
- [ ] Commit; generate handoff

## Phase 1c: Targeting UI — display helpers

- [ ] Implement `hiliteTrajectory` (Items.c:~5550) — draw bolt path highlight on dungeon map;
      uses `getLineCoordinates` (already in bolt-geometry.ts); wire into targeting context
- [ ] Implement `playerCancelsBlinking` (Items.c:6470) — async blink targeting cursor loop;
      returns true if player cancels; uses waitForEvent pattern
- [ ] Add unit tests for both; export from relevant index
- [ ] Remove any test.skip entries now unblocked
- [ ] All files under 600 lines
- [ ] Commit; generate handoff

## Phase 1d: Targeting UI — chooseTarget

*The full targeting UI loop. Depends on Phase 1b + 1c functions being in place.*

- [ ] Implement `chooseTarget` (Items.c:5607, ~200 lines) — full bolt targeting UI loop;
      player moves cursor, cycles targets, confirms or cancels; returns target Pos or null;
      async (uses waitForEvent); needs moveCursor, nextTargetAfter, hiliteTrajectory
- [ ] Add integration tests (mock IO; confirm target selection + cancel paths)
- [ ] Wire into zap context (ZapContext currently has targeting stubbed for port-v2-platform)
- [ ] Remove test.skip entries now unblocked
- [ ] All files under 600 lines
- [ ] Commit; generate handoff

---

## Phase 2: charmRechargeDelay — C cross-check + fix

*Flagged in port-v2-fix-rendering Phase 5a notes as likely buggy.*

- [ ] Read `src/brogue/PowerTables.c` — find the `charmRechargeDelay` formula
- [ ] Compare to `rogue-ts/src/power/power-tables.ts` implementation
- [ ] Suspected bug: extra `* FP_FACTOR / 100n` in decay term produces astronomically large
      values at enchant > 1; confirm or refute against C source
- [ ] If bug confirmed: fix the formula, update the flagged test comment in power-tables.test.ts,
      add a cross-validation test against known C output values
- [ ] If no bug: remove the uncertainty comment and add a confirming test
- [ ] Commit; generate handoff

---

## Phase 3a: NEEDS-VERIFICATION — Monsters.c query helpers + spawning

*Reference: `docs/audit/gaps-Monsters.md`. For each function: read C, read TS, verify or fix.*

Functions in scope (10):
`isValidWanderDestination`, `successorTerrainFlags`, `isLocalScentMaximum`, `scentDirection`,
`canDirectlySeeMonster`, `discoveredTerrainFlagsAtLoc`, `monsterAtLoc`,
`populateMonsters`, `getRandomMonsterSpawnLocation`, `spawnPeriodicHorde`

- [ ] For each function: confirm TS matches C, add direct test, or fix divergence + add test.skip
- [ ] Note: `successorTerrainFlags` is a callback param, not standalone — verify the callback
      shape matches C's `discoveredTerrainFlagsAtLoc` behavior
- [ ] Note: `monsterAtLoc` uses a builder pattern (`buildMonsterAtLoc`) — verify the closure
      matches C's direct global lookup
- [ ] Note: `discoveredTerrainFlagsAtLoc` is sometimes wired as a stub; confirm domain fn is correct
- [ ] Commit; generate handoff

## Phase 3b: NEEDS-VERIFICATION — Monsters.c movement AI

*Highest-risk subset: these could have silent behavioral simplifications vs C.*

Functions in scope (10):
`moveMonsterPassivelyTowards`, `wanderToward`, `pathTowardCreature`, `traversiblePathBetween`,
`moveMonster`, `monsterMillAbout`, `moveAlly`, `knownToPlayerAsPassableOrSecretDoor`,
`setPlayerDisplayChar`, `makeMonsterDropItem`

- [ ] For each function: confirm TS matches C, add direct test, or fix divergence + add test.skip
- [ ] Note: `moveMonster` wiring is stubbed in turn.test.ts:171 — verify the domain function
      itself is correct even if wiring is pending
- [ ] Note: `makeMonsterDropItem` is implemented as a simplified inline in monsters.ts:231 —
      verify the simplification is faithful (only drops carriedItem; check if C does more)
- [ ] Note: `moveAlly` has no direct test — verify or add test.skip describing gap
- [ ] Commit; generate handoff

---

## Phase 4a: NEEDS-VERIFICATION — RogueMain.c lifecycle core

*Reference: `docs/audit/gaps-RogueMain.md`. All 20 have real implementations — this is a
testing gap, not a porting gap. Prioritize by gameplay impact.*

Functions in scope (~10):
`rogueMain`, `initializeRogue`, `startLevel`, `freeEverything`, `gameOver`, `victory`,
`freeCreature`, `removeDeadMonsters`, `removeDeadMonstersFromList`, `updateColors`

- [ ] For each: read C, confirm TS is faithful, add a direct unit or integration test
- [ ] Note: `gameOver` is split (core.ts sync state + game-lifecycle.ts death screen) — verify
      both halves; death screen path in game-lifecycle.ts is currently untested
- [ ] Note: `victory` is used as a mock in travel-explore tests but the domain fn is untested
- [ ] Note: `freeCreature` includes recursive carriedMonster cleanup — add a test with a
      monster carrying another monster
- [ ] Commit; generate handoff

## Phase 4b: NEEDS-VERIFICATION — RogueMain.c init helpers + wiring gaps

Functions in scope (~10):
`initializeGameVariant`, `enableEasyMode`, `executeEvent`, `fileExists`, `chooseFile`,
`openFile`, `getOrdinalSuffix`, `welcome`, `printBrogueVersion`, `unflag`

- [ ] For each: read C, confirm TS is faithful, add a direct unit test
- [ ] Note: `initializeGameVariant` context stub in menus.ts:253 is a no-op with no test.skip —
      add the test.skip; verify the domain fn in lifecycle.ts:253
- [ ] Note: `enableEasyMode` context stub in io/input-context.ts:203 is untracked (no test.skip)
      — add the test.skip
- [ ] Note: `executeEvent` context stub in menus.ts:256 is untracked — add the test.skip;
      verify the domain fn in io/input-dispatch.ts:485
- [ ] Commit; generate handoff

---

## Phase 5a: NEEDS-VERIFICATION — Architect.c terrain helpers + lake/room functions

*Reference: `docs/audit/gaps-Architect.md`. All 18 have real implementations.*
*Note: seed regression tests in tests/seed-determinism.test.ts provide indirect coverage
for most of these — use them as confidence signal, but still add direct tests where feasible.*

Functions in scope (~8):
`cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType`,
`cleanUpLakeBoundaries`, `removeDiagonalOpenings`, `attachHallwayTo`,
`lakeFloodFill`, `buildABridge`

- [ ] For each: read C, confirm TS is faithful; add a direct test (or confirm seed regression
      tests provide adequate coverage and document why)
- [ ] Note: `cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType` live in state/helpers.ts —
      these are used as mocks everywhere but have no direct tests of their own
- [ ] Commit; generate handoff

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
