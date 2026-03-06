# Audit: Dijkstra.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured only 5 of 8 functions (static-only capture). Supplemented
with the public-function grep pass (TASKS.md workaround). Total: 3 public + 5 static = 8 functions.

Dijkstra.c is the pathfinding module: a priority-queue Dijkstra implementation (PDS = Priority Dijkstra
Scan) with static internal helpers (`pdsUpdate`, `pdsClear`, `pdsSetDistance`, `pdsBatchInput`,
`pdsBatchOutput`) and three public API functions (`dijkstraScan`, `calculateDistances`,
`pathingDistance`).

In the TS port, all responsibilities live in `rogue-ts/src/dijkstra/dijkstra.ts`. The private static
helpers are retained as module-private functions with direct C-equivalent annotations. All three
public functions are exported and wired into multiple context builders (lifecycle.ts, movement.ts,
architect/*, game/game-level.ts, etc.).

Tests in `rogue-ts/tests/dijkstra.test.ts` cover all three public functions directly with
multi-scenario suites (cardinal/diagonal movement, full walls, PDS_FORBIDDEN/PDS_OBSTRUCTION
semantics, variable costs, multiple sources, secret doors, undiscovered cells, pathingDistance
detour). Private static helpers are tested transitively through their public callers.

**One wiring stub to note:** `dijkstraScan: () => {}` in `io/input-context.ts:240`. This is a
no-op slot in the keyboard input context, where pathfinding is not needed. The domain function
itself is IMPLEMENTED. This stub should receive a `test.skip` annotation per the rule.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| pdsUpdate | 42 | dijkstra/dijkstra.ts:101 | IMPLEMENTED | Private; PDS priority update loop; transitively tested via all dijkstraScan calls |
| pdsClear | 92 | dijkstra/dijkstra.ts:163 | IMPLEMENTED | Private; clears map to maxDistance; transitively tested via calculateDistances |
| pdsSetDistance | 102 | dijkstra/dijkstra.ts:179 | IMPLEMENTED | Private; sets a source cell distance; transitively tested via calculateDistances |
| pdsBatchInput | 127 | dijkstra/dijkstra.ts:221 | IMPLEMENTED | Private; builds PDS cost map from distanceMap + costMap; transitively tested via dijkstraScan |
| pdsBatchOutput | 192 | dijkstra/dijkstra.ts:309 | IMPLEMENTED | Private; runs pdsUpdate and writes results back; transitively tested via dijkstraScan |
| dijkstraScan | 202 | dijkstra/dijkstra.ts:350 | IMPLEMENTED | Exported; wired in movement.ts, lifecycle.ts, architect, etc.; direct tests in dijkstra.test.ts |
| calculateDistances | 209 | dijkstra/dijkstra.ts:422 | IMPLEMENTED | Exported; wired in lifecycle.ts, movement.ts, game-level.ts, machines.ts; direct tests in dijkstra.test.ts |
| pathingDistance | 252 | dijkstra/dijkstra.ts:502 | IMPLEMENTED | Exported; wired in lifecycle.ts, game-level.ts, lakes.ts; direct tests in dijkstra.test.ts |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 8 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 0 |
| NEEDS-VERIFICATION | 0 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **8** |

## Critical Gaps

None. Dijkstra.c has zero gaps.

## Notes for follow-on initiative

**Dijkstra.c requires no fix work.** `dijkstra/dijkstra.ts` is a complete port with real
implementations of all 8 C functions and direct passing tests for all three public API functions.

**Wiring stub — not a domain gap:** `dijkstraScan: () => {}` at `io/input-context.ts:240` is a
no-op slot in the keyboard/input context builder, where pathfinding is not exercised. The domain
function itself has a real implementation and tests. The Phase 3 synthesis task should add a
`test.skip` entry for this stub to satisfy the tracking rule.

**Test quality is high.** `dijkstra.test.ts` covers PDS_FORBIDDEN vs PDS_OBSTRUCTION semantics,
diagonal vs cardinal modes, variable movement costs, multiple sources, full walls, secret doors,
undiscovered cell avoidance, and determinism. The `calculateDistances` suite exercises the
dependency-injection context interface with mock helpers, validating that terrain blocking, monster
avoidance, and discovery checks all interact correctly.
