# BRIEF: port-v2-fix-rendering

## Intent

Implement the missing and stubbed functions identified in `port-v2-audit` so that the game is
playable end-to-end in the browser. The audit is complete; this initiative acts on it.

## Goals

- The dungeon renders visibly after "New Game" (Phase 1 complete)
- Game end does not crash (Phase 2 complete)
- The item system is functional — inventory, use, drop, effects (Phase 3 complete)
- Monster AI spell/bolt pipeline is functional (Phase 4 complete)
- All NEEDS-VERIFICATION functions have been reviewed; regressions documented (Phase 5 complete)

## Scope

In:
- `getCellAppearance`, `refreshDungeonCell`, `displayLevel` — io/display.ts (Phase 1)
- `saveRecording` wiring in game-lifecycle context builder (Phase 2)
- All 28 MISSING + 12 STUBBED-UNTRACKED functions in Items.c (Phase 3)
- All 27 MISSING functions in Monsters.c spell/bolt pipeline (Phase 4)
- Human review of 139 NEEDS-VERIFICATION functions (Phase 5)

Out:
- Recordings.c file I/O (persistence layer — deferred indefinitely)
- SeedCatalog.c CLI tool (no browser equivalent needed)
- `loadSavedGame` (blocked on persistence layer)
- New gameplay features or rule changes

## Constraints

- 600-line max per file (hard rule — split before continuing)
- No stub without a `test.skip` (hard rule)
- Async bridge: any input-waiting function must use `async/await waitForEvent()`
- Audit reference: `docs/audit/summary.md` — full gap lists and per-file gap files in `docs/audit/gaps-*.md`
