# Machine Room Parity

## Intent

Machine rooms are the most visibly broken area of the TypeScript port. Multiple machine
types exhibit wrong behavior — monsters not spawning, triggers firing at the wrong time,
dungeon features placing on wrong tiles. The goal is to understand the C machine pipeline
fully, identify all divergences, fix them, and verify behavior across all machine types.

## Goals

- A research doc that accurately describes the C machine pipeline (generation, triggering,
  monster/item interaction) — verified against current code, not assumed from prior audits.
- A debug menu tool that makes specific machine types reliably testable without requiring
  deep dungeon runs.
- All machine-room behavioral gaps identified and documented.
- All machine types behaviorally indistinguishable from the C game, verified by code
  comparison and playtesting.

## Scope

In:
- All machine blueprint types (all blueprints in the C blueprint tables)
- Machine generation pipeline: `addMachines`, `buildAMachine`, interior building, feature
  spawning, monster and item placement
- Machine trigger/activation mechanics: key pickup, dormant states, dungeon feature effects
- Debug tooling: title screen menu with per-type blueprint frequency boost + depth collapse
- Fixes to all identified behavioral gaps

Out:
- Persistence layer (save/load/recording) — separate initiative
- Non-machine dungeon generation (rooms, lakes, corridors)
- The `restoreMonster` / `restoreItems` stubs — these are level re-entry concerns, not
  machine generation

## Constraints

- **C source is ground truth.** Every fix must be traceable to C behavior.
- **Prior audit docs are starting points only.** `gaps-Architect.md` and related files may
  be stale. Verify all claims against current code before acting on them.
- **600-line file limit.** Split any file that reaches this during fix work.
- **No silent stubs.** Any stub touched during this initiative must have a `test.skip`
  entry or be fully implemented.
- **Debug tool must not bypass blueprint qualification.** Frequency boost and depth
  collapse only — do not force-spawn blueprints. Room geometry and connectivity checks
  must still run normally.
