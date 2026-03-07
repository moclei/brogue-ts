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

- [x] `Math.c` (~17 functions) → `docs/audit/gaps-Math.md`
  - TS counterparts live in: `rogue-ts/src/math/`
  - Highest confidence; all have tests
  - Result: 16 IMPLEMENTED (15 unique C functions; rand_range has a conditional-compile duplicate), 0 gaps
  - c-inventory.md missed all 10 public functions (static-only capture); supplemented with grep
  - Only file in audit with 100% IMPLEMENTED and zero gaps — rng.ts and fixpt.ts are complete with C cross-validated tests

- [x] `Dijkstra.c` (~8 functions) → `docs/audit/gaps-Dijkstra.md`
  - TS counterparts live in: `rogue-ts/src/dijkstra/`
  - Highest confidence; all have tests
  - Result: 8 IMPLEMENTED, 0 gaps — second file in audit with 100% IMPLEMENTED
  - c-inventory.md missed 3 public functions (static-only capture); supplemented with grep
  - Wiring stub: dijkstraScan: () => {} in input-context.ts:240 — domain function is IMPLEMENTED; needs test.skip in Phase 3

- [x] `PowerTables.c` (~34 functions) → `docs/audit/gaps-PowerTables.md`
  - TASKS.md note "Likely DATA-ONLY" was incorrect — file is entirely computation functions
  - Result: 12 IMPLEMENTED, 22 NEEDS-VERIFICATION, 0 gaps (no MISSING or STUBBED)
  - c-inventory.md captured zero functions (all public); supplemented with two grep passes
  - 15 domain functions tested but never imported in production code — items using them are unwired
  - staffBlinkDistance context stub in items.ts:242 returns 0 instead of calling real function
  - 7 charm/ring functions wired but lack direct tests in power-tables.test.ts

- [x] `SeedCatalog.c` (~10 functions) → `docs/audit/gaps-SeedCatalog.md`
  - Prediction correct: 100% OUT-OF-SCOPE — CLI seed-scanning tool (printf to stdout, --seed-catalog flag)
  - No gameplay logic; no TS equivalents; no fix work needed

- [x] `Globals.c` / `GlobalsBase.c` / `Utilities.c` → `docs/audit/gaps-Globals.md`
  - Globals.c: 1819 lines of DATA-ONLY catalog data + 2 IMPLEMENTED functions (terrainFlags, terrainMechFlags) at end of file
  - GlobalsBase.c: 100% DATA-ONLY (global state struct initializations); no functions
  - Utilities.c: 2 OUT-OF-SCOPE C string helpers (endswith, append) superseded by native JS
  - Untracked wiring stubs for terrainFlags/terrainMechFlags in io/input-context.ts:247–248 — needs test.skip in Phase 3

---

## Phase 3: Synthesis (four sessions)

### Phase 3a — Summary (one session)

- [ ] Use grep to extract Summary Counts tables from all `docs/audit/gaps-*.md` files
      (do NOT read each file in full — too large for one context window)
- [ ] Aggregate counts per category across all 20 files
- [ ] Write `docs/audit/summary.md` using the template in PLAN.md
- [ ] Check off this task in TASKS.md
- [ ] Commit: `"chore: port-v2-audit — Phase 3a synthesis summary complete"`
- [ ] Stop. Do not start Phase 3b in the same session.

### Phase 3b — High-impact domain stubs: IO.c + Items.c (one session)

Covers the two files with the most STUBBED-UNTRACKED entries (~25 combined).
- [ ] Re-read `docs/audit/gaps-IO.md` and `docs/audit/gaps-Items.md` — STUBBED-UNTRACKED rows only
- [ ] For each entry: find the relevant test file in `rogue-ts/tests/`, add a `test.skip` entry
      documenting the stub name, C source reference, and expected behavior
- [ ] Check off this task in TASKS.md
- [ ] Commit: `"chore: port-v2-audit — Phase 3b test.skip entries for IO.c + Items.c stubs"`
- [ ] Stop. Do not start Phase 3c in the same session.

### Phase 3c — Remaining domain stubs: Monsters.c + Recordings.c + Architect.c + Time.c (one session)

Covers ~23 STUBBED-UNTRACKED entries across four files.
- [ ] Re-read STUBBED-UNTRACKED rows from `gaps-Monsters.md`, `gaps-Recordings.md`,
      `gaps-Architect.md`, `gaps-Time.md`
- [ ] For each entry: find the relevant test file, add a `test.skip` entry
- [ ] Check off this task in TASKS.md
- [ ] Commit: `"chore: port-v2-audit — Phase 3c test.skip entries for Monsters/Recordings/Architect/Time stubs"`
- [ ] Stop. Do not start Phase 3d in the same session.

### Phase 3d — Wiring stubs, stale cleanup, and PROJECT.md (one session)

- [ ] Add `test.skip` entries for all untracked wiring stubs identified in gaps files:
      - Time.c notes: `autoRest`, `manualSearch` in input-context.ts
      - RogueMain.c notes: `enableEasyMode` (input-context.ts:203), `executeEvent` (menus.ts:256)
      - MainMenu.c notes: `listFiles`, `loadRunHistory`, `saveResetRun`
      - Buttons.c notes: 3 wiring stubs in input-context.ts and ui.ts
      - Globals.c notes: `terrainFlags`, `terrainMechFlags` in io/input-context.ts:247–248
- [ ] Remove stale `test.skip` entries where function is now IMPLEMENTED:
      - Known: `movement.test.ts:241` (useStairs)
      - Known: `combat.test.ts:228,255,261,267,272` (5 entries — see gaps-Combat.md notes)
      - Scan all gaps files' notes sections for any others flagged
- [ ] Update `PROJECT.md` to point to the follow-on fix initiative as the new active initiative
- [ ] Commit: `"chore: port-v2-audit — Phase 3d wiring stubs recorded, stale skips removed, audit complete"`

---

## Completion Criteria

- All Phase 2 gap files exist and are committed ✓
- `docs/audit/summary.md` exists with full counts and prioritized gap list (Phase 3a)
- All STUBBED-UNTRACKED domain functions have test.skip entries (Phase 3b + 3c)
- All untracked wiring stubs have test.skip entries (Phase 3d)
- All stale test.skip entries are removed (Phase 3d)
- A follow-on initiative is documented and PROJECT.md updated (Phase 3d)
