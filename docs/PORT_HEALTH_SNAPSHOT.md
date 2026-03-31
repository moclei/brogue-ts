# Port Health Snapshot — Port Parity Audit Complete
*Captured: 2026-03-31 after port-parity-audit initiative*
*Regenerate: `cd tools/analysis && npx tsx scan-stubs.ts && npx tsx port-health.ts`*

---

# Port Health Report

Generated: 2026-03-31T14:19:39.535Z

## Summary

| Metric | Count |
| --- | ---: |
| C functions (total) | 818 |
| Unique stub names in TS | 129 |
| Stubs matching a C function | 110 |
| Critical stubs (game-loop reachable) | 109 |
| Total stub occurrences | 250 |
| Context builders with stubs | 42 |

## System Breakdown

| System | C Functions | Stubbed | Critical | % Stubbed |
| --- | ---: | ---: | ---: | ---: |
| io | 128 | 24 | 24 | 19% |
| monsters | 114 | 16 | 16 | 14% |
| recording | 46 | 16 | 15 | 35% |
| items | 142 | 14 | 14 | 10% |
| turn | 50 | 10 | 10 | 20% |
| combat | 32 | 9 | 9 | 28% |
| movement | 49 | 7 | 7 | 14% |
| dungeon-gen | 75 | 4 | 4 | 5% |
| lighting | 16 | 3 | 3 | 19% |
| lifecycle | 31 | 3 | 3 | 10% |
| ui | 8 | 2 | 2 | 25% |
| grid | 20 | 1 | 1 | 5% |
| debug | 11 | 1 | 1 | 9% |

## Critical Stubs

Functions that are stubbed in TS and reachable from the game loop in C.

| Function | System | Stub Locations | Reason |
| --- | --- | ---: | --- |
| discoveredTerrainFlagsAtLoc | monsters | 9 | Reachable from game loop via call chain |
| refreshDungeonCell | io | 9 | Direct callee of playerMoves |
| updateVision | turn | 8 | Direct callee of startLevel |
| recordKeystroke | recording | 7 | Direct callee of playerMoves |
| promoteTile | turn | 7 | Direct callee of playerMoves, updateEnvironment |
| discover | movement | 6 | Reachable from game loop via call chain |
| pickUpItemAt | items | 6 | Direct callee of playerMoves |
| refreshSideBar | io | 5 | Direct callee of startLevel |
| freeGrid | grid | 5 | Direct callee of initializeLevel, startLevel |
| spawnDungeonFeature | dungeon-gen | 5 | Direct callee of monstersTurn |
| keyOnTileAt | items | 5 | Direct callee of updateEnvironment |
| monstersTurn | monsters | 5 | Reachable from game loop via call chain |
| monstersFall | turn | 5 | Direct callee of updateEnvironment |
| updateFloorItems | items | 5 | Direct callee of updateEnvironment |
| prependCreature | monsters | 5 | Reachable from game loop via call chain |
| message | io | 4 | Direct callee of playerMoves |
| removeCreature | monsters | 4 | Reachable from game loop via call chain |
| describeHallucinatedItem | io | 3 | Reachable from game loop via call chain |
| createFlare | lighting | 3 | Reachable from game loop via call chain |
| chooseNewWanderDestination | monsters | 3 | Direct callee of monstersTurn |
| confirm | io | 3 | Direct callee of playerMoves |
| flushBufferToFile | recording | 3 | Direct callee of startLevel |
| flashMessage | io | 3 | Reachable from game loop via call chain |
| getFOVMask | movement | 3 | Direct callee of initializeLevel |
| updateLighting | lighting | 3 | Reachable from game loop via call chain |
| updateFieldOfViewDisplay | movement | 3 | Reachable from game loop via call chain |
| demoteMonsterFromLeadership | monsters | 3 | Reachable from game loop via call chain |
| printProgressBar | io | 2 | Reachable from game loop via call chain |
| messageWithColor | io | 2 | Direct callee of playerMoves, startLevel |
| pauseAnimation | io | 2 | Reachable from game loop via call chain |
| recordMouseClick | recording | 2 | Reachable from game loop via call chain |
| monsterAvoids | monsters | 2 | Direct callee of monstersTurn, playerMoves |
| extinguishFireOnCreature | turn | 2 | Reachable from game loop via call chain |
| printHighScores | io | 2 | Direct callee of mainBrogueJunction |
| saveRecordingNoPrompt | recording | 2 | Reachable from game loop via call chain |
| RNGCheck | recording | 2 | Direct callee of startLevel |
| displayAnnotation | recording | 2 | Direct callee of mainBrogueJunction |
| displayLevel | io | 2 | Direct callee of startLevel |
| playerTurnEnded | turn | 2 | Direct callee of playerMoves |
| search | movement | 2 | Reachable from game loop via call chain |
| ... | ... | ... | 69 more |

## Most-Stubbed Context Builders

| Context Builder | Stub Count | Unique Stubs |
| --- | ---: | ---: |
| buildApplyInstantTileEffectsFn | 28 | 27 |
| buildStaffZapCtx | 21 | 18 |
| buildTurnProcessingContext | 20 | 19 |
| buildMonsterZapCtx | 19 | 13 |
| buildMenuContext | 15 | 15 |
| buildInputContext | 14 | 14 |
| buildLifecycleContext | 13 | 13 |
| buildMonsterBoltBlinkContexts | 11 | 10 |
| buildCombatAttackContext | 9 | 9 |
| buildMiscHelpersContext | 9 | 9 |
| buildMovementContext | 8 | 8 |
| buildItemHandlerContext | 7 | 5 |
| buildTravelContext | 7 | 7 |
| buildExposeTileToFireFn | 6 | 6 |
| buildExposeTileToElectricityFn | 6 | 6 |

## Most-Repeated Stubs

Functions stubbed in the most context builders.

| Function | Occurrences |
| --- | ---: |
| discoveredTerrainFlagsAtLoc | 9 |
| refreshDungeonCell | 9 |
| updateVision | 8 |
| recordKeystroke | 7 |
| promoteTile | 7 |
| discover | 6 |
| pickUpItemAt | 6 |
| refreshSideBar | 5 |
| freeGrid | 5 |
| spawnDungeonFeature | 5 |
| keyOnTileAt | 5 |
| monstersTurn | 5 |
| monstersFall | 5 |
| updateFloorItems | 5 |
| prependCreature | 5 |
| message | 4 |
| removeCreature | 4 |
| describeHallucinatedItem | 3 |
| cellHasGas | 3 |
| createFlare | 3 |

---

*Regenerate: `cd tools/analysis && npx tsx port-health.ts`*
