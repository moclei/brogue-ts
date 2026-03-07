# PLAN: port-v2-domain-gaps

## Session Protocol

**One sub-phase per session. No more.**

1. Read BRIEF.md, PLAN.md, TASKS.md. Find the first unchecked task.
2. Complete that task only. Do not continue into the next task.
3. Commit. Update TASKS.md (check off completed tasks).
4. Generate a handoff prompt and stop. Format:
   ```
   Continue port-v2-domain-gaps. Read: .context/PROJECT.md, initiatives/port-v2-domain-gaps/BRIEF.md, PLAN.md, TASKS.md
   Resume at: [exact task name from TASKS.md]
   Branch: feat/port-v2-domain-gaps
   ```
   Add a `## Session Notes [date]` to PLAN.md only if there are decisions worth preserving.

Stop at 60% context. Do not start a new task to fill remaining context.

---

## Approach

Work through missing functions in dependency order. For each function or group:

1. Read the C source implementation in `src/brogue/` (ground truth)
2. Implement the TS equivalent — new file or extension of an existing file (600-line limit)
3. Add unit tests
4. Wire into the relevant context builder
5. Remove any `test.skip` entries now unblocked

Where a function is large or has unclear dependencies, do a **read-through phase first**
(document inputs, branches, dependencies in Session Notes) before implementing.

The gap files in `docs/audit/gaps-*.md` are the reference for what is missing and where the
C line numbers are. The C source is ground truth for correctness.

---

## Known dependency relationships

- `teleport` requires `disentangle` (implement disentangle first)
- `summonMinions` requires `perimeterCoords` + `calculateDistances` (already IMPLEMENTED)
- `allyFlees` requires `getSafetyMap`
- `monsterBlinkToSafety` requires `getSafetyMap`
- `zap` requires `detonateBolt`, `boltEffectForItem`, `boltForItem`,
  `impermissibleKinkBetween`, `tunnelize`
- `spawnDungeonFeature` source location needs investigation (Movement.c audit attributes it
  to Items.c but it does not appear in gaps-Items.md — may be in Architect.c)
