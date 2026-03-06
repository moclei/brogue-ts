# Audit: Architect.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** c-inventory.md captured only 50 static functions. Supplemented with two grep
passes to find 22 additional public functions (non-static). Total: 72 functions.
Architect.c is the best-covered file audited so far — 51 of 72 (71%) are fully IMPLEMENTED
with passing tests. The TS port split the C file across six modules:
`architect/analysis.ts`, `architect/helpers.ts`, `architect/lakes.ts`, `architect/machines.ts`,
`architect/rooms.ts`, and `architect/architect.ts`. The primary gaps are:
(1) `evacuateCreatures` is completely absent — creature displacement before dungeon-feature
spawning is never called;
(2) `restoreMonster`/`restoreItems` are stubs without test.skip entries (rule violations);
(3) 18 NEEDS-VERIFICATION functions have real implementations but no direct test coverage
(mostly top-level orchestration: `digDungeon`, `buildAMachine`, `addMachines`,
`runAutogenerators`, and several post-processing passes).

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| cellHasTerrainFlag | 30 | state/helpers.ts:66 | NEEDS-VERIFICATION | Real implementation; no direct test — used as mock in other tests |
| cellHasTMFlag | 35 | state/helpers.ts:75 | NEEDS-VERIFICATION | Real implementation; no direct test |
| cellHasTerrainType | 39 | state/helpers.ts:84 | NEEDS-VERIFICATION | Real implementation; no direct test |
| cellIsPassableOrDoor | 48 | architect/helpers.ts:108 | IMPLEMENTED | Tested in architect-helpers.test.ts:167 |
| checkLoopiness | 57 | architect/analysis.ts:43 | IMPLEMENTED | Tested in architect-analysis.test.ts:96 |
| passableArcCount | 171 | architect/helpers.ts:138 | IMPLEMENTED | Tested in architect-helpers.test.ts:198 |
| analyzeMap | 192 | architect/analysis.ts:210 | IMPLEMENTED | Tested in architect-analysis.test.ts:289 |
| auditLoop | 121 | architect/analysis.ts:129 | IMPLEMENTED | Tested in architect-analysis.test.ts:151 |
| floodFillCount | 140 | architect/analysis.ts:163 | IMPLEMENTED | Tested in architect-analysis.test.ts:203 |
| addLoops | 340 | architect/analysis.ts:383 | IMPLEMENTED | Tested in architect-analysis.test.ts:407 |
| addTileToMachineInteriorAndIterate | 400 | architect/machines.ts:406 | IMPLEMENTED | Tested in architect-machines.test.ts:370 |
| copyMap | 431 | architect/helpers.ts:50 | IMPLEMENTED | Tested in architect-helpers.test.ts:140 |
| itemIsADuplicate | 441 | architect/machines.ts:212 | IMPLEMENTED | Tested in architect-machines.test.ts:168 |
| blueprintQualifies | 455 | architect/machines.ts:185 | IMPLEMENTED | Tested in architect-machines.test.ts:115 |
| abortItemsAndMonsters | 470 | architect/machines.ts:1819 | NEEDS-VERIFICATION | Private (non-exported) function; called on machine-build failure; no direct test |
| addLocationToKey | 591 | architect/machines.ts:238 | IMPLEMENTED | Tested in architect-machines.test.ts:183 |
| addMachineNumberToKey | 599 | architect/machines.ts:259 | IMPLEMENTED | Tested in architect-machines.test.ts:200 |
| expandMachineInterior | 607 | architect/machines.ts:448 | IMPLEMENTED | Tested in architect-machines.test.ts:447 |
| fillInteriorForVestibuleMachine | 674 | architect/machines.ts:534 | IMPLEMENTED | Tested in architect-machines.test.ts:758 |
| redesignInterior | 734 | architect/machines.ts:612 | NEEDS-VERIFICATION | Real implementation; no direct test block |
| prepareInteriorWithMachineFlags | 856 | architect/machines.ts:733 | IMPLEMENTED | Tested in architect-machines.test.ts:478 |
| buildAMachine | 984 | architect/machines.ts:1162 | NEEDS-VERIFICATION | Real implementation; no direct test; top-level machine builder |
| addMachines | 1732 | architect/machines.ts:1852 | NEEDS-VERIFICATION | Real implementation; no direct test; orchestrates all machine placement |
| runAutogenerators | 1780 | architect/machines.ts:1902 | NEEDS-VERIFICATION | Real implementation; no direct test; runs DF autogenerators |
| cleanUpLakeBoundaries | 1856 | architect/lakes.ts:45 | NEEDS-VERIFICATION | Real implementation; imported in test file but no describe block |
| removeDiagonalOpenings | 1913 | architect/lakes.ts:122 | NEEDS-VERIFICATION | Real implementation; imported in test file but no describe block |
| insertRoomAt | 1951 | architect/rooms.ts:44 | IMPLEMENTED | Tested in architect-rooms.test.ts:64 |
| designCavern | 1971 | architect/rooms.ts:78 | IMPLEMENTED | Tested in architect-rooms.test.ts:195 |
| designEntranceRoom | 2005 | architect/rooms.ts:128 | IMPLEMENTED | Tested in architect-rooms.test.ts:95 |
| designCrossRoom | 2023 | architect/rooms.ts:149 | IMPLEMENTED | Tested in architect-rooms.test.ts:165 |
| designSymmetricalCrossRoom | 2043 | architect/rooms.ts:176 | IMPLEMENTED | Tested in architect-rooms.test.ts:144 |
| designSmallRoom | 2064 | architect/rooms.ts:206 | IMPLEMENTED | Tested in architect-rooms.test.ts:113 |
| designCircularRoom | 2073 | architect/rooms.ts:221 | IMPLEMENTED | Tested in architect-rooms.test.ts:175 |
| designChunkyRoom | 2091 | architect/rooms.ts:244 | IMPLEMENTED | Tested in architect-rooms.test.ts:185 |
| directionOfDoorSite | 2126 | architect/rooms.ts:280 | IMPLEMENTED | Tested in architect-rooms.test.ts:219 |
| chooseRandomDoorSites | 2155 | architect/rooms.ts:320 | IMPLEMENTED | Tested in architect-rooms.test.ts:261 |
| attachHallwayTo | 2205 | architect/rooms.ts:372 | NEEDS-VERIFICATION | Real implementation; imported in test file but no direct describe block |
| roomFitsAt | 2344 | architect/rooms.ts:541 | IMPLEMENTED | Tested in architect-rooms.test.ts:341 |
| attachRooms | 2367 | architect/rooms.ts:579 | IMPLEMENTED | Tested in architect-rooms.test.ts:391 |
| adjustDungeonProfileForDepth | 2425 | architect/architect.ts:144 | IMPLEMENTED | Tested in architect-orchestration.test.ts:142 |
| adjustDungeonFirstRoomProfileForDepth | 2436 | architect/architect.ts:165 | IMPLEMENTED | Tested in architect-orchestration.test.ts:178 |
| carveDungeon | 2456 | architect/architect.ts:193 | IMPLEMENTED | Tested in architect-orchestration.test.ts:211 |
| finishWalls | 2480 | architect/lakes.ts:177 | IMPLEMENTED | Tested in architect-lakes.test.ts:114 |
| liquidType | 2518 | architect/lakes.ts:237 | IMPLEMENTED | Tested in architect-lakes.test.ts:159 |
| fillLake | 2554 | architect/lakes.ts:274 | IMPLEMENTED | Tested in architect-lakes.test.ts:197 |
| lakeFloodFill | 2569 | architect/lakes.ts:300 | NEEDS-VERIFICATION | Real implementation; exercised via lakeDisruptsPassability but no direct test |
| lakeDisruptsPassability | 2588 | architect/lakes.ts:339 | IMPLEMENTED | Tested in architect-lakes.test.ts:231 |
| designLakes | 2638 | architect/lakes.ts:407 | IMPLEMENTED | Tested in architect-lakes.test.ts:271 |
| createWreath | 2689 | architect/lakes.ts:445 | IMPLEMENTED | Tested in architect-lakes.test.ts:317 |
| fillLakes | 2710 | architect/lakes.ts:478 | IMPLEMENTED | Tested in architect-lakes.test.ts:390 |
| finishDoors | 2733 | architect/lakes.ts:508 | IMPLEMENTED | Tested in architect-lakes.test.ts:343 |
| clearLevel | 2760 | architect/architect.ts:114 | IMPLEMENTED | Tested in architect-orchestration.test.ts:112 |
| buildABridge | 2786 | architect/lakes.ts:569 | NEEDS-VERIFICATION | Real implementation; imported in test file but no describe block |
| digDungeon | 2877 | architect/architect.ts:230 | NEEDS-VERIFICATION | Real implementation; wired in lifecycle.ts; no direct test |
| updateMapToShore | 2982 | architect/architect.ts:564 | IMPLEMENTED | Tested in architect-orchestration.test.ts:493 |
| refreshWaypoint | 3014 | architect/architect.ts:601 | NEEDS-VERIFICATION | Real implementation; wired in lifecycle.ts; no direct test |
| setUpWaypoints | 3033 | architect/architect.ts:626 | NEEDS-VERIFICATION | Real implementation; wired in lifecycle.ts; no direct test |
| zeroOutGrid | 3073 | architect/helpers.ts:38 | IMPLEMENTED | Tested in architect-helpers.test.ts:92 |
| oppositeDirection | 3082 | architect/helpers.ts:78 | IMPLEMENTED | Tested in architect-helpers.test.ts:110 |
| connectCell | 3109 | architect/helpers.ts:174 | IMPLEMENTED | Tested in architect-helpers.test.ts:246 |
| levelIsDisconnectedWithBlockingMap | 3137 | architect/helpers.ts:221 | IMPLEMENTED | Tested in architect-helpers.test.ts:300 |
| resetDFMessageEligibility | 3200 | architect/architect.ts:681 | IMPLEMENTED | Tested in architect-orchestration.test.ts:517 |
| fillSpawnMap | 3208 | architect/machines.ts:921 | IMPLEMENTED | Tested in architect-machines.test.ts:617 |
| spawnDungeonFeature | 3359 | architect/machines.ts:979 | IMPLEMENTED | Tested in architect-machines.test.ts:664 |
| evacuateCreatures | 3332 | — | MISSING | Creature displacement before DF spawning; no TS equivalent |
| restoreMonster | 3501 | architect/architect.ts:758 | STUBBED-UNTRACKED | Empty stub; comment explains dependency; no test.skip entry |
| restoreItems | 3573 | architect/architect.ts:770 | STUBBED-UNTRACKED | Empty stub; comment explains dependency; no test.skip entry |
| validStairLoc | 3604 | architect/architect.ts:308 | IMPLEMENTED | Tested in architect-orchestration.test.ts:282 |
| prepareForStairs | 3656 | architect/architect.ts:363 | IMPLEMENTED | Tested in architect-orchestration.test.ts:343 |
| placeStairs | 3690 | architect/architect.ts:465 | NEEDS-VERIFICATION | Real implementation; wired in lifecycle.ts; no direct test |
| initializeLevel | 3764 | architect/architect.ts:699 | NEEDS-VERIFICATION | Real implementation; wired in lifecycle.ts; no direct test |
| randomMatchingLocation | 3822 | architect/helpers.ts:310 | IMPLEMENTED | Tested in architect-helpers.test.ts:366 |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 51 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 2 |
| MISSING | 1 |
| NEEDS-VERIFICATION | 18 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **72** |

## Critical Gaps

List only MISSING and STUBBED-UNTRACKED items here, ordered by gameplay impact:

1. `evacuateCreatures` — moves creatures off cells about to be filled by a dungeon feature; absent means machines that spawn blocking terrain into occupied cells may strand or clip creatures
2. `restoreMonster` — monsters from a previously visited level are never restored on re-entry; revisited levels will be empty of monsters (stub untracked)
3. `restoreItems` — items that fell from an upper level are never restored on re-entry; revisited levels will be missing dropped items (stub untracked)

## Notes for follow-on initiative

**Architect.c is the healthiest C file audited so far.** 51 of 72 functions (71%) are fully
IMPLEMENTED with passing tests, split cleanly across six TS modules with well-named test files.
The porting approach (one test file per source file) made coverage obvious.

**NEEDS-VERIFICATION backlog is large but low-risk.** 18 functions have real implementations but
no direct test. The most important ones to verify:
- `buildAMachine` (machines.ts:1162) — the core machine-builder; tested only transitively
  through seed-determinism and cross-validation tests. Any logic divergence from C would not
  be caught.
- `digDungeon` (architect.ts:230), `placeStairs` (architect.ts:465), `initializeLevel`
  (architect.ts:699), `setUpWaypoints` (architect.ts:626) — the entire level-setup pipeline
  runs untested directly; failures would only surface in end-to-end game runs.
- `addMachines` / `runAutogenerators` — machine placement orchestration; exercised only by
  full `digDungeon` calls (e.g. seed-determinism regression), not in isolation.
- `cleanUpLakeBoundaries`, `removeDiagonalOpenings`, `buildABridge` — post-processing passes
  that are imported in the lake test file but have no describe blocks; likely correct but not
  verified.

**`evacuateCreatures` is the sole MISSING function** (C line 3332). In C, it scans a blocking
map and teleports any creature sitting in a cell that is about to be filled in — preventing
terrain from spawning inside a creature. Without it, `spawnDungeonFeature` (which does call
into TS with real logic) can silently place blocking terrain on occupied cells. Impact is most
visible during machine building (redesignInterior calls fillSpawnMap which calls spawnDungeonFeature).

**`restoreMonster` and `restoreItems` are rule violations** (STUBBED-UNTRACKED). Both have
comment blocks in architect.ts explaining what they need, but neither has a test.skip entry.
These should be added as part of the synthesis phase test.skip cleanup.

**`cellHasTerrainFlag`/`cellHasTMFlag`/`cellHasTerrainType`** live in `state/helpers.ts` (not
`architect/`), yet they originate from Architect.c. They are used throughout combat, items,
monsters, and movement as context-builder injections but are only ever passed as mocks in
those tests — the real functions in state/helpers.ts have no dedicated test coverage. Low
actual risk (simple flag-mask bitwise checks), but a gap worth noting.
