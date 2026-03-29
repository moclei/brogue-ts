# Handover: Phase 3a — Audit Synthesis (summary.md)

## Context

The `port-v2-audit` initiative has completed Phase 2. All 20 C source files have been
cross-referenced against the TypeScript port. Gap files exist in `docs/audit/gaps-*.md`
for every file. Phase 3 is split into four sessions; this is Phase 3a.

**Branch:** `feat/port-v2-audit-phase3`
**Your only deliverable:** `docs/audit/summary.md`

---

## What to do

1. Read `initiatives/port-v2-audit/PLAN.md` (Phase 3a session protocol).
2. Read `initiatives/port-v2-audit/TASKS.md` (find the Phase 3a checklist).
3. Extract summary counts from all gap files using grep — do NOT read each file in full:

   ```
   grep -A 12 "## Summary Counts" docs/audit/gaps-*.md
   ```

4. Aggregate counts per category across all 20 files.
5. Identify critical gaps: MISSING or STUBBED-UNTRACKED functions in rendering, movement,
   combat, or level generation.
6. Write `docs/audit/summary.md` using the template in PLAN.md.
7. Check off Phase 3a in TASKS.md.
8. Commit: `"chore: port-v2-audit — Phase 3a synthesis summary complete"`
9. Stop. Do not begin Phase 3b.

---

## Key facts to include in summary.md

These are pre-compiled so you don't need to re-derive them:

### Files with zero gaps (100% clean)
- `Math.c` — 100% IMPLEMENTED
- `Dijkstra.c` — 100% IMPLEMENTED

### Primary gameplay blockers (MISSING in critical systems)
- `getCellAppearance` (IO.c) — level rendering completely absent
- `refreshDungeonCell` (IO.c) — cell refresh absent
- `displayLevel` (IO.c) — STUBBED-UNTRACKED, no test.skip (rule violation)
- `saveRecording` (Recordings.c) — MISSING from context builder; runtime crash risk at game-lifecycle.ts:378,596
- Entire spell/bolt-casting pipeline in Monsters.c — `monsterCastSpell`, `monstUseBolt`, etc. — all MISSING
- `monsterDetails` (Monsters.c) — sidebar monster description non-functional
- 28 MISSING functions in Items.c — significant item system gaps

### Approximate total counts (verify via grep)
These are estimates — use the grep output as the source of truth for exact numbers:
- IMPLEMENTED: ~310
- NEEDS-VERIFICATION: ~80
- OUT-OF-SCOPE: ~50
- MISSING: ~70
- STUBBED-UNTRACKED: ~50
- STUBBED-TRACKED: ~15
- DATA-ONLY: 0 (tracked in auditor notes, not as function rows)

### Files with notable NEEDS-VERIFICATION backlogs
- `RogueMain.c` — 20 NEEDS-VERIFICATION, 0 MISSING (all gaps are test coverage only)
- `Wizard.c` — 10 NEEDS-VERIFICATION, 0 MISSING
- `PowerTables.c` — 22 NEEDS-VERIFICATION, 0 MISSING
- `Light.c` — 5 NEEDS-VERIFICATION, 0 MISSING

### Rule violations (STUBBED-UNTRACKED requiring test.skip in Phase 3b/3c)
IO.c: 13, Items.c: 12, Recordings.c: 13, Monsters.c: 7, Architect.c: 2, Time.c: 1
Plus ~12 wiring stubs across multiple files (handled in Phase 3d).

---

## What NOT to do

- Do not read raw C source files
- Do not read full gap files — use grep for counts only
- Do not start adding test.skip entries — that is Phase 3b and 3c
- Do not modify any `rogue-ts/src/` files
- Do not start Phase 3b after committing
