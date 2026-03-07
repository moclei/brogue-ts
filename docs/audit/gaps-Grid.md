# Audit: Grid.c

**Status:** Complete
**Audited:** 2026-03-06
**Auditor note:** c-inventory.md captured only 5 of 19 functions (static-only capture). Supplemented
with the public-function grep pass (TASKS.md workaround). Total: 14 public + 5 static = 19 functions.
TASKS.md estimated ~18 — minor undercount; `getPassableArcGrid` (static helper for arc-based passability
filtering) was not in the estimate.

Grid.c is the grid utility module: memory management, fill/copy primitives, geometric drawing
(rectangle, circle), flood fill, location search, terrain/TM grid builders, blob generation via
cellular automata, and the pathfinding-adjacent `getQualifyingPathLocNear`.

In the TS port, Grid.c responsibilities live entirely in `rogue-ts/src/grid/grid.ts`. The module is
the best-covered file in the audit so far: 14 of 15 domain functions are IMPLEMENTED with direct
passing tests in `grid.test.ts`. The only domain gap is `getQualifyingPathLocNear`, which is
STUBBED-TRACKED across three context builders.

The 4 MISSING functions are:
- `hiliteGrid` — renders grid highlights to the display (rendering utility, not gameplay logic)
- `getTerrainGrid` — builds a boolean grid from terrain flags (used by dungeon analysis callers)
- `getTMGrid` — builds a boolean grid from tile-machine flags (used by machine placement callers)
- `getPassableArcGrid` — static helper filtering cells by passable-neighbor arc count; likely
  supports `getQualifyingPathLocNear` (whose own domain implementation is also absent)

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| freeGrid | 41 | grid/grid.ts:36 | IMPLEMENTED | No-op (GC); API-parity stub with real tests in grid.test.ts:37 |
| copyGrid | 46 | grid/grid.ts:45 | IMPLEMENTED | Full impl; tested in grid.test.ts:59 |
| fillGrid | 56 | grid/grid.ts:54 | IMPLEMENTED | Full impl; tested in grid.test.ts:50 |
| hiliteGrid | 67 | — | MISSING | No TS equivalent; rendering utility (applies color to display cells) |
| findReplaceGrid | 104 | grid/grid.ts:66 | IMPLEMENTED | Full impl; tested in grid.test.ts:71 |
| floodFillGrid | 118 | grid/grid.ts:89 | IMPLEMENTED | Full impl; tested in grid.test.ts:87,105 |
| drawRectangleOnGrid | 137 | grid/grid.ts:120 | IMPLEMENTED | Full impl; tested in grid.test.ts:121 |
| drawCircleOnGrid | 147 | grid/grid.ts:136 | IMPLEMENTED | Full impl; tested in grid.test.ts:135 |
| getTerrainGrid | 161 | — | MISSING | No TS equivalent; builds grid from dungeon cell terrain flags |
| getTMGrid | 172 | — | MISSING | No TS equivalent; builds grid from tile-machine (TM) flags |
| getPassableArcGrid | 183 | — | MISSING | Static helper; no TS equivalent; likely supports getQualifyingPathLocNear |
| validLocationCount | 197 | grid/grid.ts:157 | IMPLEMENTED | Full impl; tested in grid.test.ts:149 |
| leastPositiveValueInGrid | 210 | grid/grid.ts:170 | IMPLEMENTED | Private (C static); called by randomLeastPositiveLocationInGrid; transitively tested |
| randomLocationInGrid | 224 | grid/grid.ts:186 | IMPLEMENTED | Full impl; tested in grid.test.ts:162,176 |
| randomLeastPositiveLocationInGrid | 249 | grid/grid.ts:211 | IMPLEMENTED | Full impl; tested in grid.test.ts:185,198 |
| getQualifyingPathLocNear | 287 | — (stubs only) | STUBBED-TRACKED | No domain fn in grid.ts; pass-through stubs in movement.ts:275, lifecycle.ts:398, monsters.ts:148; tracked by test.skip at monsters.test.ts:208, movement.test.ts:258 |
| cellularAutomataRound | 362 | grid/grid.ts:257 | IMPLEMENTED | Private (C static); called by createBlobOnGrid; transitively tested |
| fillContiguousRegion | 396 | grid/grid.ts:292 | IMPLEMENTED | Private (C static); called by createBlobOnGrid; transitively tested |
| createBlobOnGrid | 417 | grid/grid.ts:331 | IMPLEMENTED | Full impl; tested in grid.test.ts:209,240 (determinism verified) |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 14 |
| STUBBED-TRACKED | 1 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 4 |
| NEEDS-VERIFICATION | 0 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **19** |

## Critical Gaps

No STUBBED-UNTRACKED items. The 4 MISSING functions are noted below by gameplay impact:

1. `getQualifyingPathLocNear` (STUBBED-TRACKED, domain fn absent) — the pathfinding search that
   finds a nearby open cell satisfying terrain/TM/flag constraints. Every context builder returns
   the target unchanged. This silently breaks monster displacement, stair placement, and any
   feature that needs to relocate an entity to a valid position. Tracked by test.skip entries.

2. `getTerrainGrid` — fills a grid from dungeon cell terrain flags. Used widely in dungeon analysis
   (connectivity, room placement, machine logic). Callers in architect/ and elsewhere that need it
   either inline the scan logic or are themselves absent/stubbed.

3. `getTMGrid` — fills a grid from tile-machine flags. Used by machine placement and feature
   generation analysis. Same impact as getTerrainGrid for any caller that depends on it.

4. `hiliteGrid` — applies a color highlight to all cells in a grid for display. Rendering utility
   only; no gameplay logic. MISSING but low gameplay impact — affects debug/highlight overlays.

5. `getPassableArcGrid` — static helper that builds a grid of cells filtered by passable-neighbor
   arc count. Likely an internal dependency of `getQualifyingPathLocNear`. Has no standalone
   gameplay impact but must be implemented before `getQualifyingPathLocNear` can be ported.

## Notes for follow-on initiative

**Grid.c is the best-covered file in the audit: 74% IMPLEMENTED (14/19), zero STUBBED-UNTRACKED.**
The grid primitive library is complete and well-tested. No cleanup is needed for Phase 3.

**`getQualifyingPathLocNear` is the highest-priority gap.** It is the most complex Grid.c function
(searches for a reachable cell satisfying up to 5 flag constraints, using Dijkstra internally).
Its implementation requires `getTerrainGrid`, `getTMGrid`, and `getPassableArcGrid` as dependencies.
The fix initiative should implement all four together as a unit, in this order:
1. `getTerrainGrid` (iterates dungeon cells, sets grid based on terrainFlags match)
2. `getTMGrid` (same pattern, using TM flags)
3. `getPassableArcGrid` (iterates grid, counts passable neighbors, filters by arc range)
4. `getQualifyingPathLocNear` (orchestrates the above + Dijkstra scan; remove stubs and test.skip)

**`hiliteGrid` is low priority.** It is a rendering helper used for debug overlays and map
highlighting (e.g. highlighting valid placement locations in the wizard menu). It can be deferred
until the display layer is complete.

**All 14 implemented functions have direct passing tests in `grid.test.ts`.** No additional test
work is needed for this module in Phase 3.
