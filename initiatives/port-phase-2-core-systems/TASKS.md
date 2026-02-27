# Phase 2: Core Systems — Tasks

## Step 0: Game State Foundation
- [x] Define `GameState` interface and sub-interfaces (`MapState`, `EntityState`, etc.) — `ts/src/state/game-state.ts`
- [x] Port shared helper functions (`terrainFlags`, `terrainMechFlags`, `cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType`, `discoveredTerrainFlagsAtLoc`) — `ts/src/state/helpers.ts`
- [ ] Port deferred item tables from Phase 1 (key, food, weapon, armor, staff, ring)

## Step 1: Dijkstra (259 lines)
- [x] Port `PdsLink`, `PdsMap` internal types
- [x] Port pure functions: `pdsUpdate`, `pdsClear`, `pdsSetDistance`, `pdsBatchInput`, `pdsBatchOutput`
- [x] Port `dijkstraScan` (pure grid-based pathfinding)
- [x] Port `calculateDistances` (with game state injection via `CalculateDistancesContext`)
- [x] Port `pathingDistance`
- [x] Tests for dijkstra module — 22 tests passing

## Step 2: Light (412 lines)
- [x] Port FOV system (`betweenOctant1andN`, `scanOctantFOV`, `getFOVMask`) with `FOVContext` — `ts/src/light/fov.ts`
- [x] Port `paintLight`, `updateLighting`, `updateMinersLightRadius`, `playerInDarkness` with `LightingContext` — `ts/src/light/light.ts`
- [x] Port `backUpLighting`, `restoreLighting`, `recordOldLights`, `updateDisplayDetail`, `applyColorScalar`
- [x] Port flare system (`newFlare`, `createFlare`, `flareIsActive`, `updateFlare`, `drawFlareFrame`, `animateFlares`, `deleteAllFlares`) — `ts/src/light/flares.ts`
- [x] Tests for light module — 36 tests passing

## Step 3: Architect (3,837 lines)

### Sub-step 3a: Helpers — `ts/src/architect/helpers.ts`
- [ ] Port `zeroOutGrid`, `oppositeDirection`, `cellIsPassableOrDoor`, `copyMap`
- [ ] Port `passableArcCount`, `randomMatchingLocation`
- [ ] Port `connectCell`, `levelIsDisconnectedWithBlockingMap` (connectivity checking)
- [ ] Tests for helpers

### Sub-step 3b: Rooms — `ts/src/architect/rooms.ts`
- [ ] Port room shape functions: `designCavern`, `designEntranceRoom`, `designCrossRoom`, `designSymmetricalCrossRoom`, `designSmallRoom`, `designCircularRoom`, `designChunkyRoom`
- [ ] Port door site logic: `directionOfDoorSite`, `chooseRandomDoorSites`
- [ ] Port hallway: `attachHallwayTo`
- [ ] Port random room dispatcher: `designRandomRoom`
- [ ] Port room fitting: `roomFitsAt`, `insertRoomAt`, `attachRooms`
- [ ] Tests for room design

### Sub-step 3c: Lakes & Bridges — `ts/src/architect/lakes.ts`
- [ ] Port `liquidType`, `designLakes`, `fillLake`, `lakeFloodFill`, `lakeDisruptsPassability`, `fillLakes`, `createWreath`
- [ ] Port `cleanUpLakeBoundaries`, `removeDiagonalOpenings`
- [ ] Port `buildABridge`
- [ ] Port `finishWalls`, `finishDoors`
- [ ] Tests for lakes

### Sub-step 3d: Map Analysis — `ts/src/architect/analysis.ts`
- [ ] Port `checkLoopiness`, `auditLoop`, `floodFillCount`
- [ ] Port `analyzeMap` (loop & chokepoint detection)
- [ ] Port `addLoops` (secondary connections via Dijkstra)
- [ ] Tests for analysis

### Sub-step 3e: Machines — `ts/src/architect/machines.ts`
- [ ] Port blueprint catalog data from `src/variants/GlobalsBrogue.c` (~900 lines)
- [ ] Port autogenerator catalog data
- [ ] Port machine helpers: `blueprintQualifies`, `cellIsFeatureCandidate`, `addTileToMachineInteriorAndIterate`, `expandMachineInterior`, `fillInteriorForVestibuleMachine`, `redesignInterior`, `prepareInteriorWithMachineFlags`
- [ ] Port `buildAMachine` (~750 lines) with callback interfaces for item/monster ops
- [ ] Port `addMachines`, `runAutogenerators`
- [ ] Port `fillSpawnMap`, `spawnDungeonFeature`, `spawnMapDF`
- [ ] Tests for machines

### Sub-step 3f: Orchestration — `ts/src/architect/architect.ts`
- [ ] Port `clearLevel`, `carveDungeon`, `digDungeon`
- [ ] Port `adjustDungeonProfileForDepth`, `adjustDungeonFirstRoomProfileForDepth`
- [ ] Port `updateMapToShore`, `setUpWaypoints`, `refreshWaypoint`
- [ ] Port `validStairLoc`, `prepareForStairs`, `placeStairs`
- [ ] Port `initializeLevel`, `restoreMonster`, `restoreItems`
- [ ] Seed-based regression tests (same seed → same dungeon layout)

## Step 4: Items (8,040 lines)
- [ ] Port item generation (`makeItemInto`, `generateItems`, `populateItems`)
- [ ] Port item identification and naming
- [ ] Port item usage (apply, throw, drop, equip, unequip)
- [ ] Port bolt mechanics
- [ ] Tests for items module

## Step 5: Monsters (4,826 lines)
- [ ] Port monster spawning (`spawnHorde`, `populateMonsters`)
- [ ] Port monster AI (decision-making, targeting)
- [ ] Port monster actions (abilities, summoning)
- [ ] Tests for monsters module

## Step 6: Combat (1,784 lines)
- [ ] Port attack resolution (`attack`, `buildHitList`, `attackHit`)
- [ ] Port runic/enchantment effects
- [ ] Tests for combat module

## Step 7: Movement (2,487 lines)
- [ ] Port creature movement (`moveCreature`, `playerMoves`)
- [ ] Port travel system
- [ ] Port scent trail management
- [ ] Tests for movement module

## Step 8: Time (2,640 lines)
- [ ] Port turn processing (`playerTurnEnded`, `processCreatureTurn`)
- [ ] Port status effect ticking
- [ ] Port environment updates (tile effects, gas/fire, water)
- [ ] Tests for time module

## Step 9: Recordings (1,519 lines)
- [ ] Port recording/playback state machine
- [ ] Port event serialization
- [ ] Tests for recordings module
