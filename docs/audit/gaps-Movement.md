# Audit: Movement.c

**Status:** Complete
**Audited:** 2026-03-05
**Auditor note:** c-inventory.md captured only 7 static functions. Supplemented with two grep
passes to find 44 additional public functions (non-static). Total: 51 functions (dijkstraScan
counted once — it appears at lines 1269 and 1402 in the C source, two algorithmic variants
selected by preprocessor conditional; the TS port implements one approach in dijkstra/dijkstra.ts).

Movement.c is the best-covered file audited so far — 45 of 51 (88%) are fully IMPLEMENTED
with passing tests. The TS port split the file across eight modules:
`movement/player-movement.ts`, `movement/weapon-attacks.ts`, `movement/ally-management.ts`,
`movement/map-queries.ts`, `movement/item-helpers.ts`, `movement/cost-maps-fov.ts`,
`movement/travel-explore.ts`, and `light/fov.ts` (FOV helpers).

Three MISSING functions are dijkstra algorithmic internals (`updateDistanceCell`,
`updateQueueMinCache`, `dequeue`) whose behavior is absorbed into the TS `dijkstraScan`
implementation — low gameplay risk. There are zero MISSING game-logic functions.

One stale test.skip exists: `movement.test.ts:241` marks `useStairs` as a stub, but the
function is now fully IMPLEMENTED in `travel-explore.ts` with passing tests in
`travel-explore.test.ts:535`. This stale entry should be removed in the synthesis cleanup pass.

Several functions (vomit, useKeyAt, printLocationDescription) have context-level stubs in
`movement.ts` (the wiring file), but the underlying domain functions are IMPLEMENTED and tested.
The stubs reflect upstream dependencies on `spawnDungeonFeature` and UI hooks — not gaps in
the functions themselves.

## Function Coverage

| C Function | C Line | TS Location | Category | Notes |
|---|---|---|---|---|
| playerRuns | 28 | movement/player-movement.ts:859 | IMPLEMENTED | Tested in player-movement.test.ts |
| highestPriorityLayer | 63 | state/helpers.ts:103 | NEEDS-VERIFICATION | Real impl; TS annotation misattributes to "Globals.c"; no dedicated test — used only as mock in other test files |
| layerWithTMFlag | 79 | movement/map-queries.ts:129 | IMPLEMENTED | Tested in map-queries.test.ts:209 |
| layerWithFlag | 90 | movement/map-queries.ts:153 | IMPLEMENTED | Tested in map-queries.test.ts:229 |
| describedItemBasedOnParameters | 111 | movement/item-helpers.ts:85 | IMPLEMENTED | Tested in item-helpers.test.ts:133 |
| describedItemName | 130 | movement/item-helpers.ts:112 | IMPLEMENTED | Tested in item-helpers.test.ts:171 |
| describeLocation | 141 | movement/map-queries.ts:378 | IMPLEMENTED | Tested in map-queries.test.ts:497 |
| printLocationDescription | 401 | movement/map-queries.ts:680 | IMPLEMENTED | Tested in map-queries.test.ts:642; note: context stub in input-context.ts:226 |
| useKeyAt | 407 | movement/item-helpers.ts:138 | IMPLEMENTED | Tested in item-helpers.test.ts:230; note: context stub in movement.ts:290 |
| randValidDirectionFrom | 462 | movement/player-movement.ts | IMPLEMENTED | Tested in player-movement.test.ts:118 |
| vomit | 485 | movement/player-movement.ts:258 | IMPLEMENTED | Tested in player-movement.test.ts:180; note: context stub in movement.ts:336 (spawnDungeonFeature dependency) |
| moveEntrancedMonsters | 498 | movement/player-movement.ts:286 | IMPLEMENTED | Tested in player-movement.test.ts:253 |
| becomeAllyWith | 513 | movement/ally-management.ts:60 | IMPLEMENTED | Tested in ally-management.test.ts:107 |
| freeCaptive | 530 | movement/ally-management.ts:92 | IMPLEMENTED | Tested in ally-management.test.ts:196 |
| freeCaptivesEmbeddedAt | 539 | movement/ally-management.ts:112 | IMPLEMENTED | Tested in ally-management.test.ts:220 |
| abortAttackAgainstAcidicTarget | 558 | movement/weapon-attacks.ts:111 | IMPLEMENTED | Tested in weapon-attacks.test.ts:137 |
| abortAttackAgainstDiscordantAlly | 591 | movement/weapon-attacks.ts:154 | IMPLEMENTED | Tested in weapon-attacks.test.ts:183 |
| abortAttack | 617 | movement/weapon-attacks.ts:188 | IMPLEMENTED | Tested in weapon-attacks.test.ts:213 |
| handleWhipAttacks | 638 | movement/weapon-attacks.ts:219 | IMPLEMENTED | Tested in weapon-attacks.test.ts:251 |
| handleSpearAttacks | 695 | movement/weapon-attacks.ts:276 | NEEDS-VERIFICATION | Real impl; imported in weapon-attacks.test.ts but no describe block |
| buildFlailHitList | 801 | movement/weapon-attacks.ts | IMPLEMENTED | Tested in weapon-attacks.test.ts:302 |
| diagonalBlocked | 825 | combat/combat-math.ts:244 | IMPLEMENTED | Tested in combat-math.test.ts:364 |
| playerMoves | 843 | movement/player-movement.ts | IMPLEMENTED | Tested in player-movement.test.ts:411 |
| updateDistanceCell | 1250 | — | MISSING | Internal dijkstra helper; no TS equivalent — behavior absorbed into dijkstraScan |
| dijkstraScan | 1269 | dijkstra/dijkstra.ts:350 | IMPLEMENTED | Tested in dijkstra tests; two C variants (lines 1269 and 1402) map to one TS function |
| updateQueueMinCache | 1354 | — | MISSING | Internal dijkstra helper; no TS equivalent — behavior absorbed into dijkstraScan |
| dequeue | 1369 | — | MISSING | Internal dijkstra helper; no TS equivalent — behavior absorbed into dijkstraScan |
| calculateDistances | 1449 | dijkstra/dijkstra.ts:422 | IMPLEMENTED | Tested in dijkstra tests |
| nextStep | 1490 | movement/travel-explore.ts | IMPLEMENTED | Tested in travel-explore.test.ts:204 |
| displayRoute | 1536 | movement/travel-explore.ts:230 | IMPLEMENTED | Tested in travel-explore.test.ts:260 |
| travelRoute | 1566 | movement/travel-explore.ts | IMPLEMENTED | Tested in travel-explore.test.ts:306 |
| travelMap | 1611 | movement/travel-explore.ts:336 | IMPLEMENTED | Tested in travel-explore.test.ts:351 |
| travel | 1649 | movement/travel-explore.ts | IMPLEMENTED | Tested in travel-explore.test.ts:635 |
| populateGenericCostMap | 1733 | movement/cost-maps-fov.ts | IMPLEMENTED | Tested in cost-maps-fov.test.ts:167 |
| getLocationFlags | 1751 | movement/map-queries.ts:339 | IMPLEMENTED | Tested in map-queries.test.ts:371 |
| populateCreatureCostMap | 1780 | movement/cost-maps-fov.ts | IMPLEMENTED | Tested in cost-maps-fov.test.ts:227 |
| adjacentFightingDir | 1872 | movement/travel-explore.ts:571 | IMPLEMENTED | Tested in travel-explore.test.ts:389 |
| explore | 1939 | movement/travel-explore.ts:659 | IMPLEMENTED | Tested in travel-explore.test.ts:733 |
| autoPlayLevel | 2041 | movement/travel-explore.ts:769 | IMPLEMENTED | Tested in travel-explore.test.ts:774 |
| startFighting | 2065 | movement/travel-explore.ts:605 | IMPLEMENTED | Tested in travel-explore.test.ts:447 |
| isDisturbed | 2091 | movement/map-queries.ts:272 | IMPLEMENTED | Tested in map-queries.test.ts:292 |
| discover | 2110 | movement/map-queries.ts:239 | IMPLEMENTED | Tested in map-queries.test.ts:416 |
| search | 2131 | movement/item-helpers.ts:211 | IMPLEMENTED | Tested in item-helpers.test.ts:323 |
| proposeOrConfirmLocation | 2164 | movement/travel-explore.ts | IMPLEMENTED | Tested in travel-explore.test.ts:489 |
| useStairs | 2180 | movement/travel-explore.ts:843 | IMPLEMENTED | Tested in travel-explore.test.ts:535; stale test.skip at movement.test.ts:241 must be removed |
| storeMemories | 2229 | movement/map-queries.ts:213 | IMPLEMENTED | Tested in map-queries.test.ts:269 |
| updateFieldOfViewDisplay | 2236 | movement/cost-maps-fov.ts:270 | IMPLEMENTED | Tested in cost-maps-fov.test.ts:323 |
| betweenOctant1andN | 2344 | light/fov.ts:49 | IMPLEMENTED | Tested in light.test.ts:127 |
| getFOVMask | 2385 | light/fov.ts:279 | IMPLEMENTED | Tested in light.test.ts:185 |
| scanOctantFOV | 2396 | light/fov.ts:97 | NEEDS-VERIFICATION | Real impl; imported in light.test.ts but no direct describe block; exercised only via getFOVMask |
| addScentToCell | 2481 | movement/map-queries.ts:309 | IMPLEMENTED | Tested in map-queries.test.ts:339 |

## Summary Counts

| Category | Count |
|---|---|
| IMPLEMENTED | 45 |
| STUBBED-TRACKED | 0 |
| STUBBED-UNTRACKED | 0 |
| MISSING | 3 |
| NEEDS-VERIFICATION | 3 |
| OUT-OF-SCOPE | 0 |
| DATA-ONLY | 0 |
| **Total** | **51** |

## Critical Gaps

No game-logic functions are MISSING or STUBBED. The three MISSING entries are all internal
algorithmic helpers for the dijkstra pathfinding algorithm (updateDistanceCell,
updateQueueMinCache, dequeue) — their behavior is entirely subsumed by the TS `dijkstraScan`
implementation in dijkstra/dijkstra.ts. These are not gameplay gaps.

There are **no critical gaps** in Movement.c.

## Notes for follow-on initiative

**Movement.c is the healthiest file in the audit.** 45 of 51 functions (88%) are fully
IMPLEMENTED with passing tests, split cleanly across eight TS modules. This is the reference
standard for what a well-ported C file looks like.

**NEEDS-VERIFICATION backlog is minor:**
- `highestPriorityLayer` (state/helpers.ts:103) — simple bitwise layer-scan loop; real
  implementation exists but no dedicated test. The TS annotation misattributes it to "Globals.c"
  when the actual C origin is Movement.c. Low risk (simple loop) but annotation should be
  corrected in a follow-on pass.
- `handleSpearAttacks` (weapon-attacks.ts:276) — imported in weapon-attacks.test.ts but has no
  describe block. The function exists and is syntactically correct; needs a test block added.
- `scanOctantFOV` (light/fov.ts:97) — exercised transitively through every getFOVMask call and
  light.test.ts:185, but no dedicated describe block. Low risk since FOV tests are comprehensive.

**Three MISSING entries are non-issues:** `updateDistanceCell` (C:1250),
`updateQueueMinCache` (C:1354), and `dequeue` (C:1369) are C-internal pathfinding helpers with
no TS equivalents. The TS `dijkstraScan` (dijkstra/dijkstra.ts:350) is self-contained and
fully tested. These are not gameplay gaps.

**Stale test.skip cleanup needed:** `movement.test.ts:241` has `it.skip("stub: useStairs() is
a no-op...")` but `useStairs` has been fully implemented in `travel-explore.ts:843` with
passing tests since at least the previous audit phase. This stale entry should be deleted in
the synthesis phase cleanup.

**Context-wiring stubs are not function gaps:** `vomit`, `useKeyAt`, and
`printLocationDescription` appear as context stubs (`() => {}`) in the higher-level wiring
(`movement.ts` and `input-context.ts`). The underlying domain functions are all IMPLEMENTED
and tested. The context stubs exist because `spawnDungeonFeature` (Items.c's biggest gap)
hasn't been wired yet — resolving that gap will automatically restore these context wirings.

**dijkstraScan appears twice in Movement.c** (lines 1269 and 1402) — two variants of the
pathfinding algorithm selected by preprocessor conditional
(`USE_PRIORITY_QUEUE_DIJKSTRA` or similar). The TS port chose one approach and implemented it
cleanly in dijkstra/dijkstra.ts. No action needed.
