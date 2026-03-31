# Port Parity Audit — Tasks

## Phase 1: Classify

- [x] Run fresh analysis: `cd tools/analysis && npx tsx scan-stubs.ts && npx tsx port-health.ts`
- [x] For each of the 220 unique stub names, determine if a real (non-stub) implementation
      exists anywhere in the TS codebase. Method: for each name, grep for non-trivial
      assignments (not `() => {}` / `() => false` / `() => 0` / `() => null`). Record
      results in `.context/analysis/stub-classification.json` with categories:
      `wire-up`, `needs-porting`, `recording`, `intentional-gap`.
- [x] Review the `needs-porting` list against the C manifest. For each, note the C system,
      caller count, and whether it's on a critical path. Estimate effort.
- [x] Review the `intentional-gap` candidates against `docs/BACKLOG.md` "Acceptable gaps".
      Add any new gaps with justification, or reclassify as `needs-porting`.
- [x] Update `PLAN.md` with classification results and revised effort estimate.

# --- handoff point ---

## Phase 2: Wire top builders

Each task is one context builder. Skip recording/persistence stubs within each builder.

- [ ] Wire `buildApplyInstantTileEffectsFn` (tile-effects-wiring.ts) — 44 stubs.
      Check file length; split if approaching 600 lines.
- [ ] Wire `buildTurnProcessingContext` (turn.ts) — 34 stubs
- [ ] Wire `buildInputContext` (io/input-context.ts) — 33 stubs
- [ ] Wire `buildMonsterZapFn` (turn-monster-zap-wiring.ts) — 28 stubs
- [ ] Wire `buildThrowCommandFn` (items/item-commands.ts) — 27 stubs
- [ ] Wire `buildStaffZapFn` (items/staff-wiring.ts) — 27 stubs
- [ ] Re-run analysis pipeline. Update `PORT_HEALTH.md`. Commit progress summary.

# --- handoff point ---

## Phase 3: Wire remaining builders

- [ ] Wire `buildCombatAttackContext` (combat.ts) — 23 stubs
- [ ] Wire `buildMiscHelpersContext` — 23 stubs
- [ ] Wire `buildMonstersTurnContext` — 22 stubs
- [ ] Wire `buildLifecycleContext` (lifecycle.ts) — 20 stubs
- [ ] Wire `buildMenuContext` (menus.ts) — 17 stubs
- [ ] Wire `buildZapRenderContext` — 16 stubs
- [ ] Wire `buildLevelContext` — 14 stubs
- [ ] Wire `buildUpdateVisionFn` — 12 stubs
- [ ] Wire `buildItemHandlerContext` — 10 stubs
- [ ] Wire all remaining builders with <10 stubs each (batch by file)
- [ ] Re-run analysis pipeline. Update `PORT_HEALTH.md`. Commit progress summary.

# --- handoff point ---

## Phase 4: Drift investigation

- [ ] Review the `needs-porting` list from Phase 1. For each function that was
      identified as needing a new implementation: port from C source, wire into
      all relevant contexts, add tests.
- [ ] Scan for simplified implementations: search for comments like `// simplified`,
      `// TODO`, `// stub`, `// placeholder` across `rogue-ts/src/`. Cross-reference
      with C source to check if the simplification affects gameplay.
- [ ] For the most critical game systems (combat, monster AI, items, turn processing),
      spot-check 3-5 complex functions against their C equivalents to verify behavioral
      parity. Document any discrepancies found.

# --- handoff point ---

## Phase 5: Verify and close

- [ ] Re-run full analysis pipeline. Critical stub count should be near zero
      (only recording/persistence and documented gaps remaining).
- [ ] Run full test suite: `npx vitest run` — all passing, no new skips.
- [ ] Playtest: complete game on a known seed. Note any behavioral anomalies.
- [ ] Update `docs/BACKLOG.md` with final port status and any remaining gaps.
- [ ] Update `.context/analysis/PORT_HEALTH.md` as the final health snapshot.

## Deferred

_(out-of-scope discoveries go here)_
