# Port V2 — C Source Audit — Tasks

## Phase 1: Generate inventories (one session)

- [x] Run the C inventory script from PLAN.md → `docs/audit/c-inventory.md`
- [x] Run the TS inventory script from PLAN.md → `docs/audit/ts-inventory.md`
- [x] Verify both files exist and are non-empty
- [x] Commit: `"chore: port-v2-audit — generate C and TS function inventories"`

**Stop after committing. Do not begin Phase 2 in the same session.**

---

## Phase 2: Per-file cross-reference (one session per file)

Files are ordered by risk: known-gap areas first, high-confidence areas last.
Each task = one session. Read PLAN.md section "Cross-reference session" before starting.

- [x] `IO.c` (~119 functions) → `docs/audit/gaps-IO.md`
  - Known gaps: `getCellAppearance`, `refreshDungeonCell`, `displayLevel`, `colorMultiplierFromDungeonLight`
  - TS counterparts live in: `rogue-ts/src/io/display.ts`, `rogue-ts/src/io/color.ts`
  - Result: 94 IMPLEMENTED, 2 STUBBED-TRACKED, 13 STUBBED-UNTRACKED, 5 MISSING, 4 NEEDS-VERIFICATION, 1 OUT-OF-SCOPE
  - c-inventory.md missed ~92 public functions (multi-line signatures); supplemented with grep

- [x] `Items.c` (~134 functions) → `docs/audit/gaps-Items.md`
  - Many item callbacks are stubbed in `rogue-ts/src/items.ts`
  - TS counterparts live in: `rogue-ts/src/items/`
  - Result: 73 IMPLEMENTED, 11 STUBBED-TRACKED, 12 STUBBED-UNTRACKED, 28 MISSING, 5 NEEDS-VERIFICATION, 1 OUT-OF-SCOPE
  - c-inventory.md missed ~78 public functions (multi-line signatures); supplemented with grep

- [x] `Monsters.c` (~111 functions) → `docs/audit/gaps-Monsters.md`
  - TS counterparts live in: `rogue-ts/src/monsters/`
  - Result: 43 IMPLEMENTED, 11 STUBBED-TRACKED, 7 STUBBED-UNTRACKED, 27 MISSING, 20 NEEDS-VERIFICATION, 6 OUT-OF-SCOPE
  - c-inventory.md missed ~76 public functions (multi-line signatures); supplemented with grep
  - Critical gap: entire spell/bolt-casting pipeline absent (monsterCastSpell, monstUseBolt, etc.)
  - Critical gap: monsterDetails MISSING — sidebar monster description non-functional

- [x] `Architect.c` (~70 functions) → `docs/audit/gaps-Architect.md`
  - TS counterparts live in: `rogue-ts/src/architect/`
  - Result: 51 IMPLEMENTED, 0 STUBBED-TRACKED, 2 STUBBED-UNTRACKED, 1 MISSING, 18 NEEDS-VERIFICATION, 0 OUT-OF-SCOPE
  - c-inventory.md missed 22 public functions (multi-line signatures); supplemented with grep
  - Best-covered file so far (71% IMPLEMENTED). Single MISSING: evacuateCreatures (creature displacement before DF spawning)
  - NEEDS-VERIFICATION backlog: top-level orchestration (digDungeon, buildAMachine, addMachines, runAutogenerators, placeStairs, initializeLevel, setUpWaypoints) has no direct tests

- [x] `Movement.c` (~52 functions) → `docs/audit/gaps-Movement.md`
  - TS counterparts live in: `rogue-ts/src/movement/`
  - Result: 45 IMPLEMENTED, 0 STUBBED-TRACKED, 0 STUBBED-UNTRACKED, 3 MISSING, 3 NEEDS-VERIFICATION, 0 OUT-OF-SCOPE
  - c-inventory.md missed 44 public functions (multi-line signatures); supplemented with grep
  - Best-covered file in audit (88% IMPLEMENTED). Zero game-logic gaps.
  - 3 MISSING are dijkstra algorithmic internals absorbed into dijkstraScan — not gameplay gaps
  - Stale test.skip in movement.test.ts:241 (useStairs now IMPLEMENTED) — cleanup needed in synthesis

- [x] `Time.c` (~49 functions) → `docs/audit/gaps-Time.md`
  - TS counterparts live in: `rogue-ts/src/time/`
  - Result: 46 IMPLEMENTED, 0 STUBBED-TRACKED, 1 STUBBED-UNTRACKED, 0 MISSING, 2 NEEDS-VERIFICATION, 0 OUT-OF-SCOPE
  - c-inventory.md missed 31 public functions (multi-line signatures); supplemented with grep
  - Best-covered file in audit (94% IMPLEMENTED). Single STUBBED-UNTRACKED: updateScent (scent-trail system)
  - Untracked wiring stubs: autoRest and manualSearch in input-context.ts (need test.skip in turn.test.ts or movement.test.ts)
  - Duplicate export: updateYendorWardenTracking in both environment.ts and misc-helpers.ts — refactor artifact

- [x] `Combat.c` (~31 functions) → `docs/audit/gaps-Combat.md`
  - TS counterparts live in: `rogue-ts/src/combat/`
  - Result: 30 IMPLEMENTED, 0 STUBBED, 0 MISSING, 2 NEEDS-VERIFICATION, 0 OUT-OF-SCOPE
  - c-inventory.md missed 23 public functions (multi-line signatures); supplemented with grep
  - Best-covered file in audit: 94% IMPLEMENTED. No domain-function gaps.
  - 6 wiring stubs in combat.ts pending port-v2-platform (magicWeaponHit, applyArmorRunicEffect, specialHit, splitMonster, attackVerb, anyoneWantABite)
  - 5 stale test.skip in combat.test.ts:228,255,261,267,272 — must be removed in synthesis cleanup

- [x] `Light.c` (~16 functions) → `docs/audit/gaps-Light.md`
  - TS counterparts live in: `rogue-ts/src/light/`
  - Note: `colorMultiplierFromDungeonLight` is likely here — dependency of IO rendering
  - Result: 9 IMPLEMENTED, 5 NEEDS-VERIFICATION, 1 OUT-OF-SCOPE, 0 MISSING
  - c-inventory.md missed 10 public functions (multi-line signatures); supplemented with grep
  - colorMultiplierFromDungeonLight is in IO.c (io/color.ts:336), not Light.c — TASKS.md note was speculative
  - All 5 NEEDS-VERIFICATION have real implementations; gap is direct test coverage only
  - updateLighting (the per-turn lighting tick) most important to add a direct test for

- [x] `RogueMain.c` (~22 functions) → `docs/audit/gaps-RogueMain.md`
  - TS counterparts live in: `rogue-ts/src/lifecycle.ts`, `rogue-ts/src/bootstrap.ts`
  - Result: 0 IMPLEMENTED, 0 MISSING, 20 NEEDS-VERIFICATION, 2 OUT-OF-SCOPE
  - c-inventory.md missed 16 public functions (multi-line signatures); supplemented with grep
  - Zero MISSING: every C function has a TS equivalent with real code — all gaps are test coverage
  - `gameOver` is split: core.ts:289 (state, TESTED) + game-lifecycle.ts:201 (full sequence, UNTESTED)
  - Untracked wiring stubs: enableEasyMode (input-context.ts:203), executeEvent (menus.ts:256) — need test.skip in Phase 3

- [x] `MainMenu.c` (~22 functions) → `docs/audit/gaps-MainMenu.md`
  - TS counterparts live in: `rogue-ts/src/menus/`
  - Largely ported in port-v2-platform; expected high coverage
  - Result: 2 IMPLEMENTED, 20 NEEDS-VERIFICATION, 2 MISSING, 0 STUBBED, 0 OUT-OF-SCOPE
  - c-inventory.md missed 4 public functions (multi-line/single-line signatures); supplemented with grep
  - 2 MISSING are internal C static helpers absorbed inline into dialogChooseFile (not gameplay gaps)
  - 3 untracked wiring stubs affect menus at runtime: listFiles/loadRunHistory/saveResetRun all `() => []` / `() => {}`
  - Load Game, View Recording, Game Stats are platform-blocked (not porting gaps)

- [x] `Buttons.c` (~6 functions) → `docs/audit/gaps-Buttons.md`
  - TS counterparts live in: `rogue-ts/src/io/buttons.ts`
  - Largely ported; expected high coverage
  - Result: 0 IMPLEMENTED, 0 STUBBED, 0 MISSING, 8 NEEDS-VERIFICATION, 0 OUT-OF-SCOPE
  - c-inventory.md captured zero functions (all public, no statics); supplemented with grep
  - smoothHiliteGradient relocated to sidebar-player.ts (correctly annotated)
  - 3 untracked wiring stubs in input-context.ts and ui.ts need test.skip in Phase 3

- [x] `Recordings.c` (~46 functions) → `docs/audit/gaps-Recordings.md`
  - Browser port has no file system; most functions are legitimately OUT-OF-SCOPE
  - Result: 0 IMPLEMENTED, 3 STUBBED-TRACKED, 13 STUBBED-UNTRACKED, 2 MISSING, 0 NEEDS-VERIFICATION, 28 OUT-OF-SCOPE
  - c-inventory.md missed all 24 public functions (static-only capture); supplemented with grep
  - 61% OUT-OF-SCOPE (file I/O, playback pipeline, RNG verification — all deferred to persistence layer)
  - saveRecording MISSING from context builder despite being declared in interface and called at game-lifecycle.ts:378,596 — runtime crash risk
  - loadSavedGame MISSING but preemptive test.skip exists at menus.test.ts:117

- [x] `Wizard.c` (~10 functions) → `docs/audit/gaps-Wizard.md`
  - TS counterparts live in: `rogue-ts/src/menus/wizard.ts` and `rogue-ts/src/menus/wizard-items.ts`
  - c-inventory.md missed 2 public functions; supplemented with grep (actual: 11 functions)
  - All 10 game-logic functions are NEEDS-VERIFICATION; 1 OUT-OF-SCOPE (qsort comparator inlined as JS sort)
  - No MISSING or STUBBED-UNTRACKED — wizard mode is fully ported, testing gap only
  - dialogCreateItemOrMonster wiring type mismatch: ctx type declares (): void vs async (): Promise<void>

- [x] `Grid.c` (~18 functions) → `docs/audit/gaps-Grid.md`
  - TS counterparts live in: `rogue-ts/src/grid/`
  - Highest confidence; all have tests
  - Result: 14 IMPLEMENTED, 1 STUBBED-TRACKED, 0 STUBBED-UNTRACKED, 4 MISSING, 0 NEEDS-VERIFICATION, 0 OUT-OF-SCOPE
  - c-inventory.md missed 14 public functions (static-only capture); supplemented with grep
  - Best primitive coverage in audit: grid.ts is complete with direct tests for all 11 public domain functions
  - 4 MISSING: hiliteGrid (rendering utility), getTerrainGrid, getTMGrid, getPassableArcGrid (static helper for getQualifyingPathLocNear)
  - getQualifyingPathLocNear STUBBED-TRACKED: stubs in movement.ts/lifecycle.ts/monsters.ts; tracked by test.skip at monsters.test.ts:208, movement.test.ts:258

- [ ] `Math.c` (~17 functions) → `docs/audit/gaps-Math.md`
  - TS counterparts live in: `rogue-ts/src/math/`
  - Highest confidence; all have tests

- [ ] `Dijkstra.c` (~7 functions) → `docs/audit/gaps-Dijkstra.md`
  - TS counterparts live in: `rogue-ts/src/dijkstra/`
  - Highest confidence; all have tests

- [ ] `PowerTables.c` (~34 functions) → `docs/audit/gaps-PowerTables.md`
  - Likely DATA-ONLY; verify against `rogue-ts/src/globals/`

- [ ] `SeedCatalog.c` (~8 functions) → `docs/audit/gaps-SeedCatalog.md`
  - Likely DATA-ONLY or OUT-OF-SCOPE

- [ ] `Globals.c` / `GlobalsBase.c` / `Utilities.c` → `docs/audit/gaps-Globals.md`
  - Likely DATA-ONLY; global variable initialization

---

## Phase 3: Synthesis (one session)

- [ ] Read all `docs/audit/gaps-*.md` files
- [ ] Write `docs/audit/summary.md` using the template in PLAN.md
- [ ] Identify all STUBBED-UNTRACKED items — add corresponding `test.skip` entries to the
      relevant test files in `rogue-ts/tests/` (this is the one code change permitted in this initiative)
- [ ] Identify all stale `test.skip` entries — remove entries where the function is now IMPLEMENTED
      (known: `movement.test.ts:241` for `useStairs`; scan all gaps files' notes sections for others)
- [ ] Commit: `"chore: port-v2-audit — synthesis complete, untracked stubs recorded"`
- [ ] Update `PROJECT.md` to point to the follow-on fix initiative as the new active initiative

---

## Completion Criteria

- All Phase 2 gap files exist and are committed
- `docs/audit/summary.md` exists with full counts and prioritized gap list
- All STUBBED-UNTRACKED items now have test.skip entries
- A follow-on initiative is documented or planned
