# Port Parity Audit — Plan

## Approach

Three phases: classify, wire, verify.

### Phase 1: Classify

Use the analysis tools (not manual reading) to categorize every stub:

- **Mechanical wire-up** — the function is already implemented in some
  TS context builder(s) but stubbed in others. Fix: replicate the real
  wiring. This is the majority of stubs.
- **Needs porting** — the function has no real TS implementation
  anywhere. Fix: port from C source.
- **Recording/persistence** — skip. Documented in `docs/BACKLOG.md`.
- **Intentional gap** — documented acceptable divergence. Skip.

The classification method for each unique stub name:

1. Grep for `FUNCNAME:` or `FUNCNAME(` across `rogue-ts/src/` excluding
   the known stub patterns. If a non-stub assignment exists, it's a
   mechanical wire-up.
2. If no non-stub assignment exists, check the C manifest
   (`c-manifest.json`) for the function's system and callers. If it's
   on a critical path, it needs porting. If not, it may be an
   acceptable gap.

Output: a classification table appended to this file or stored in
`.context/analysis/stub-classification.json`.

### Phase 2: Wire stubs

Work builder-by-builder through context builders, ordered by stub count
(most-stubbed first). For each builder:

1. Read the builder's stub list from `stub-report.json`
2. Skip recording/persistence and intentional-gap stubs
3. For mechanical wire-ups: find the real implementation, replicate it
4. For needs-porting: read the C source via the manifest, implement,
   wire
5. Run `npx vitest run` — no regressions
6. Re-run the scanner: `cd tools/analysis && npx tsx scan-stubs.ts`
7. Commit

**Priority builders** (from `PORT_HEALTH.md`):

| Builder | File | Stubs |
|---------|------|------:|
| `buildApplyInstantTileEffectsFn` | `tile-effects-wiring.ts` | 44 |
| `buildTurnProcessingContext` | `turn.ts` | 34 |
| `buildInputContext` | `io/input-context.ts` | 33 |
| `buildMonsterZapFn` | `turn-monster-zap-wiring.ts` | 28 |
| `buildThrowCommandFn` | `items/item-commands.ts` | 27 |
| `buildStaffZapFn` | `items/staff-wiring.ts` | 27 |

After the top 6, continue with remaining builders in descending stub
count order.

### Phase 3: Verify and close

- Re-run the full analysis pipeline
- Review `PORT_HEALTH.md` — critical stub count should be near zero
  (only recording/persistence and documented gaps remaining)
- Playtest on a known seed to validate feel and behavior
- Update `docs/BACKLOG.md` with final status

---

## Technical Notes

### Why stubs exist

The DI/context-builder pattern requires each domain module to provide
all the functions a code path might call. When function X is ported and
wired into context builder A, the other 7 builders that also need X
aren't automatically updated. Playtesting found and fixed stubs on the
main paths but left secondary paths (staff effects, monster zap, tile
effects, etc.) still stubbed.

### Wiring pattern

Most stubs look like:
```typescript
refreshDungeonCell: () => {},
```

The real implementation (in another builder) looks like:
```typescript
refreshDungeonCell: (x, y) => {
    refreshDungeonCellFn(x, y, pmap, tmap, ...);
},
```

The fix is to ensure the stubbed builder has access to the same
dependencies (pmap, tmap, etc.) and replicate the call. If dependencies
aren't available in scope, they may need to be threaded in from the
builder's parent function parameters.

### File size constraint

Several wiring files are already close to 600 lines. Wiring 20-40 stubs
in one file may push it over. Be prepared to split context builders
into focused sub-builders (e.g., `tile-effects-wiring.ts` →
`tile-effects-wiring.ts` + `tile-effects-combat-ctx.ts`).

---

## Phase 1 Classification Results

### Classification Summary

| Category | Count | % |
|---|---:|---:|
| wire-up | 132 | 60% |
| needs-porting | 79 | 36% |
| recording | 6 | 3% |
| intentional-gap | 3 | 1% |
| **Total unique stubs** | **220** | |

**wire-up** — real implementation exists in at least one builder; fix is mechanical replication.
**needs-porting** — no real TS implementation anywhere; requires reading C source and writing new code.
**recording** — `recordKeystroke`, `recordMouseClick`, `flushBufferToFile`, `RNGCheck`, `assureCosmeticRNG`, `restoreRNG` — deferred to port-v2-persistence initiative.
**intentional-gap** — `takeScreenshot`, `isApplicationActive`, `initializeLaunchArguments` — platform-specific, documented in `docs/BACKLOG.md`.

### Needs-Porting Breakdown by Effort

| Tier | Count | Functions |
|---|---:|---|
| high | 2 | `fillGrid` (30 callers), `becomeAllyWith` (7 callers) |
| medium | 52 | critical-path functions, ≤5 callers each (see JSON) |
| low | 0 | — |
| defer | 18 | recording/persistence overlap — skip until port-v2-persistence |
| unknown | 7 | helper flags/setters; needs C source review |

Notable medium-tier functions spanning multiple systems: `splitMonster`, `handlePaladinFeat`, `monstersFall`, `killCreature`, `specialHit`, `refreshWaypoint`, `analyzeMap`, `deleteMessages`, `vomit`, `weaken`, `polymorph`.

### Revised Effort Estimate for Phase 2

**Key insight from classification:** the 132 wire-up stubs are mechanically parallelizable — each builder is independent. The 79 needs-porting stubs are the harder work and are prerequisites for wiring (builders can't reference a function that doesn't exist yet).

Recommended ordering:

1. **Port first (new sub-phase 2a):** implement the high/medium needs-porting functions before touching any builder. Start with `fillGrid` (blocks `freeGrid`, which appears in 4 builders) and `becomeAllyWith` (movement system). Then work through medium-tier in system order: combat → monsters → items → turn → io → dungeon-gen.
2. **Wire builders (sub-phase 2b):** once ported functions exist, work builder-by-builder in descending stub-count order. The top 6 builders account for 193 stub occurrences (~40% of all 482 total occurrences).
3. **Defer 18 recording/persistence stubs** throughout — mark clearly, do not implement.

The original Phase 4 (drift investigation) is still needed; Phase 1 classification found no evidence of intentional simplification but did not check for behavioral drift — that requires C-vs-TS comparison.

### Open Questions Resolved

| Question | Answer |
|---|---|
| How many stubs are mechanical wire-ups vs needs-porting? | 132 wire-up (60%), 79 needs-porting (36%), 9 deferred/gap (4%) |
| Are there drifted implementations? | Not answered by Phase 1 — Phase 4 (drift investigation) still required |

---

## Rejected Approaches

_(append-only — do not clean up)_

---

## Session Notes [2026-03-31]

### Phase 4 — Simplified Implementation Scan

Total markers found: 21 (after excluding DEFER/permanent-defer/port-v2-persistence comments).

#### Summary table

| Finding | File | Category | Status |
|---|---|---|---|
| `monsterCatalog: []` stub in `buildMinimalCombatContext` | `turn-combat-helpers.ts:196` | Gameplay-critical | **Fixed** |
| `monsterCatalog: []` stub in `buildApplyInstantTileEffectsFn` combat ctx | `tile-effects-wiring.ts:305` | Gameplay-critical | **Fixed** |
| `burnedTerrainFlagsAtLoc` approximation (hardcoded flags instead of catalog lookup) | `state/helpers.ts:165` | Monster AI (fire avoidance) | **Deferred** |
| `traversiblePathBetween` docstring said "Bresenham-style" (stale comment) | `monsters/monster-actions.ts:291` | Stale comment only | **Fixed** (comment corrected) |
| `executeMouseClick` — left-click always travels, C version shows cursor mode loop without controlKey | `io/input-mouse.ts:48` | Visual/UX | **Documented** |
| `monsterName` — hallucination random names use `cosmeticRandRange` but catalog deferred | `monsters/monster-queries.ts:267` | Visual-only | Already handled (cosmetic RNG deferred) |
| `pauseAnimation: () => false` | `io/misc-helpers-context.ts:341` | Visual-only | Pre-existing stub |
| Various `animateFlares: () => {}` stubs | `turn-env-wiring.ts:279` | Visual-only | Pre-existing stub |
| `confirmMessages: () => {}` in turn ctx | `turn.ts:215` | UI sequencing | Pre-existing stub |
| Other stubs (eat, playerTurnEnded re-entry guard, etc.) | various | Pre-existing documented stubs | No change |

#### Gameplay-critical fixes

**`monsterCatalog: []` (2 locations)**
- Impact: `combat-damage.ts:469` accesses `ctx.monsterCatalog[decedent.info.monsterID].abilityFlags` without null guard. With empty array, this throws a runtime error when an ally dies out of sight (checking `MA_ENTER_SUMMONS` flag for "sense of loss" message). Also affects `splitMonster` in `combat-helpers.ts` (has null guard, so safe but returns wrong flags).
- Fix: `turn-combat-helpers.ts` — added `getGameState` import, replaced `[]` with `getGameState().monsterCatalog`. `tile-effects-wiring.ts` — `monsterCatalog` was already destructured from `getGameState()` at line 122; removed duplicate `[]` stub.

#### Deferred

**`burnedTerrainFlagsAtLoc` approximation**
- C uses `successorTerrainFlags(tile, SUBSEQ_BURN)` → looks up `tileCatalog[tile].fireType`, then returns `tileCatalog[dungeonFeatureCatalog[DF].tile].flags`.
- TS approximates: `T_IS_FIRE | T_CAUSES_DAMAGE` (+ `T_CAUSES_EXPLOSIVE_DAMAGE` for explosive promoters).
- Impact: practically zero — all flammable tiles in the catalog use `DF_PLAIN_FIRE` or `DF_EMBERS`, both of which produce fire terrain with exactly those flags. The approximation is correct for all current tile types.
- Fix path if ever needed: add `dungeonFeatureCatalog` parameter to `burnedTerrainFlagsAtLoc` and all 4 call sites.

**`executeMouseClick` cursor mode**
- C: left-click without `controlKey` sets `rogue.cursorLoc` and calls `mainInputLoop()` (cursor mode).
- TS: always calls `travel()` directly (architectural decision documented in file header — Port V2 outer loop lives in `platform.ts`).
- Impact: UX only — cursor mode is a display feature. Travel behavior is the same.
- Status: intentional architectural deviation, not a bug.

#### Visual-only / already-handled (count only): 7 items

#### Test results
- Pre-existing failures: 2 (sprite-renderer tests, unrelated to these changes)
- Tests passing: 2730 | skipped: 54

## Open Questions

- How many stubs are truly "mechanical wire-ups" vs "needs porting"?
  Phase 1 classification will answer this.
- Are there functions that are implemented but subtly wrong (behavioral
  drift)? The stub scanner can't detect this — it only finds missing
  implementations. Drift detection may require seed-based comparison or
  targeted C-vs-TS behavioral tests.
