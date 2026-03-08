# PLAN: port-v2-verify-mechanics

## Session Protocol

**One sub-phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked task.
2. Complete that task only. Do not continue into the next task.
3. Commit. Update TASKS.md (check off completed tasks).
4. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-verify-mechanics. Read: .context/PROJECT.md, initiatives/port-v2-verify-mechanics/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact task name from TASKS.md]
   Branch: feat/port-v2-verify-mechanics
   ```
   Add a `## Session Notes [date]` to PLAN.md only if there are decisions worth preserving.

Stop at 60% context. Do not start a new task to fill remaining context.

---

## Approach: Targeting UI (Phases 1a–1d)

Same approach as `port-v2-domain-gaps`: read C source (ground truth), implement TypeScript
equivalent, add unit tests, wire into relevant context builder, remove any test.skip entries.

Phase 1a is a read-through only — no implementation. Use it to map dependencies and decide
the exact file placement. `chooseTarget` is the largest function (~200 lines in C) and depends
on `moveCursor`, `nextTargetAfter`, and `hiliteTrajectory` — implement those first.

Key C file: `src/brogue/Items.c`. Line numbers for each function are in TASKS.md.

---

## Approach: charmRechargeDelay (Phase 2)

The bug: `charmRechargeDelay` in `rogue-ts/src/power/power-tables.ts` uses
`fpPow(BigInt(rechargeDelayBase) * FP_FACTOR / 100n, e)`.
Since `rechargeDelayBase` is already stored as a fixed-point value, the extra
`* FP_FACTOR / 100n` is likely wrong — it should just be `fpPow(BigInt(rechargeDelayBase), e)`.

**Action:** Read `src/brogue/PowerTables.c`, find `charmRechargeDelay` (or the inline logic
in `charmRechargeDelay`-equivalent C code), verify the correct formula, cross-validate with
known values, fix if needed. Update the test comment noting the potential bug.

---

## Approach: NEEDS-VERIFICATION review (Phases 3–5)

For each function:
1. Read the C implementation in `src/brogue/` (ground truth)
2. Read the TypeScript port in `rogue-ts/src/`
3. One of three outcomes:
   - **Match confirmed** — add a direct test (or note existing coverage is sufficient)
   - **Divergence found** — fix the TS code to match C; add a test
   - **Not immediately fixable** — add/update a `test.skip` with a clear description

NEEDS-VERIFICATION is a testing/correctness gap, not a porting gap. Most functions already
have real implementations — the work is verification and test coverage, not writing new code.

**Wiring stubs encountered during review:** if a function is correctly implemented but its
wiring in a context builder is still stubbed, note the stub with a `test.skip` if one does
not already exist. Do not fix wiring stubs in this initiative unless trivial.

**Divergence priority:** fix behavioral divergences (wrong output, missing branches) immediately.
Minor style differences (API shape, naming) are acceptable as noted divergences.

---

## Approach: Stubs audit (Phase 6)

1. Grep `rogue-ts/tests/` for all `it.skip`, `test.skip`, `describe.skip` entries
2. For each: confirm the implementation status. If the function is now implemented and
   working, the test.skip should be updated or removed.
3. Grep `rogue-ts/src/` for `// stub` or `() => {}` patterns in context builders to find
   any untracked stubs (rule: every stub must have a paired test.skip)
4. Specifically check the known untracked stubs from the audit:
   - `enableEasyMode` — io/input-context.ts:203
   - `executeEvent` stub — menus.ts:256
   - `initializeGameVariant` — lifecycle.ts:253 (menus.ts context is no-op, untracked)
   - `monsterDetails` sidebar wiring — SidebarContext builder not yet created

---

### 2026-03-07 — Phase 5a: Architect.c terrain helpers + lake/room functions

All 8 functions verified faithful to C. No divergences requiring fixes.

Key notes:
- `buildABridge` uses `Math.floor` where C uses `(short)` cast — at most ±1 difference in
  bridgeRatio thresholds due to float vs integer intermediate arithmetic. Not behavioral.
- `removeDiagonalOpenings` TS computes x2Src via ternary (`y1===j ? i+k : i+(1-k)`) rather
  than C's explicit x2 variable — logically identical.
- `buildABridge` test uses two independent bridge setups (cols 20 and 50) to guard against
  the shuffled iteration skipping a single anchor column (probability both skipped ≈ 0.06%).
- All three `cellHas*` helper functions: trivially correct bitwise/equality checks.

---

## Known dependency relationships

- `chooseTarget` requires `moveCursor`, `nextTargetAfter`, `hiliteTrajectory` — implement
  those first (Phase 1b/1c before 1d)
- `hiliteTrajectory` uses the bolt path (`getLineCoordinates` — already implemented in
  `items/bolt-geometry.ts`)
- `playerCancelsBlinking` is an async UI loop — needs `waitForEvent` pattern
- `chooseTarget` is also async — it's the outermost targeting loop

---

## Session Notes

### 2026-03-07 — Phase 1a read-through

#### Function inventory

| Function | C lines | Async? | Status in TS |
|---|---|---|---|
| `itemCanBeCalled` | ~10 | No | Missing |
| `inscribeItem` | ~20 | Yes (`getInputTextString`) | Missing |
| `itemMagicPolarityIsKnown` | ~10 | No | Missing (helper for `canAutoTargetMonster`) |
| `canAutoTargetMonster` | ~80 | No | Missing (needed by `nextTargetAfter` + `chooseTarget`) |
| `moveCursor` | ~215 | Yes (event loop) | Stubbed sync → must become async |
| `nextTargetAfter` | ~45 | No | Stubbed `() => false` |
| `hiliteTrajectory` | ~40 | No | Missing |
| `playerCancelsBlinking` | ~60 | Yes (calls `confirm`) | Stubbed `() => true` |
| `chooseTarget` | ~160 | Yes (calls moveCursor loop) | Stubbed sync → must become async |

#### File placement

- `itemCanBeCalled` → `items/item-utils.ts` (pure predicate, no context)
- `inscribeItem` → `items/item-call.ts` (new file; only called from `call()`)
- `itemMagicPolarityIsKnown` + `canAutoTargetMonster` → `items/targeting.ts` (new file, private helpers)
- `moveCursor` + `nextTargetAfter` → `io/cursor-move.ts` (new file; both in `InputContext`)
- `hiliteTrajectory` + `playerCancelsBlinking` + `chooseTarget` → `items/targeting.ts` (new file)

#### Async changes required (Phase 1b–1d)

- `InputContext.moveCursor` → must become `async`; update `mainInputLoop` to `await ctx.moveCursor(...)`
- `ItemHandlerContext.playerCancelsBlinking` → `Promise<boolean>`
- `ItemHandlerContext.chooseTarget` → `Promise<{ confirmed: boolean; target: Pos }>`
- `useStaffOrWand` → must become `async` once `chooseTarget` is real

#### Missing sub-dependencies

- `itemMagicPolarityIsKnown` (~10 lines) — not in TS yet; implement in Phase 1b alongside `canAutoTargetMonster`
- `canAutoTargetMonster` (~80 lines, `Items.c:5197`) — not in TS; implement in Phase 1b
  - All its sub-deps exist: `monstersAreTeammates`, `itemMagicPolarity`, `wandDominate`,
    `negationWillAffectMonster`, `itemIsThrowingWeapon`, `tableForItemCategory`
