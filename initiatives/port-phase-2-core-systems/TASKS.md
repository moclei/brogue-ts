# Phase 2: Core Systems — Tasks

## Step 0: Game State Foundation
- [x] Define `GameState` interface and sub-interfaces (`MapState`, `EntityState`, etc.) — `ts/src/state/game-state.ts`
- [x] Port shared helper functions (`terrainFlags`, `terrainMechFlags`, `cellHasTerrainFlag`, `cellHasTMFlag`, `cellHasTerrainType`, `discoveredTerrainFlagsAtLoc`) — `ts/src/state/helpers.ts`
- [x] Port deferred item tables from Phase 1 (key, food, weapon, armor, staff, ring) — `ts/src/globals/item-catalog.ts`

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
- [x] Port `zeroOutGrid`, `oppositeDirection`, `cellIsPassableOrDoor`, `copyMap`
- [x] Port `passableArcCount`, `randomMatchingLocation`
- [x] Port `connectCell`, `levelIsDisconnectedWithBlockingMap` (connectivity checking)
- [x] Tests for helpers — 28 tests passing

### Sub-step 3b: Rooms — `ts/src/architect/rooms.ts`
- [x] Port room shape functions: `designCavern`, `designEntranceRoom`, `designCrossRoom`, `designSymmetricalCrossRoom`, `designSmallRoom`, `designCircularRoom`, `designChunkyRoom`
- [x] Port door site logic: `directionOfDoorSite`, `chooseRandomDoorSites`
- [x] Port hallway: `attachHallwayTo`
- [x] Port random room dispatcher: `designRandomRoom`
- [x] Port room fitting: `roomFitsAt`, `insertRoomAt`, `attachRooms`
- [x] Tests for room design — 25 tests passing

### Sub-step 3c: Lakes & Bridges — `ts/src/architect/lakes.ts`
- [x] Port `liquidType`, `designLakes`, `fillLake`, `lakeFloodFill`, `lakeDisruptsPassability`, `fillLakes`, `createWreath`
- [x] Port `cleanUpLakeBoundaries`, `removeDiagonalOpenings`
- [x] Port `buildABridge`
- [x] Port `finishWalls`, `finishDoors`
- [x] Tests for lakes — 16 tests passing

### Sub-step 3d: Map Analysis — `ts/src/architect/analysis.ts`
- [x] Port `checkLoopiness`, `auditLoop`, `floodFillCount`
- [x] Port `analyzeMap` (loop & chokepoint detection)
- [x] Port `addLoops` (secondary connections via Dijkstra)
- [x] Tests for analysis — 21 tests passing

### Sub-step 3e: Machines — `ts/src/architect/machines.ts`
- [x] Port blueprint catalog data from `src/variants/GlobalsBrogue.c` (~900 lines)
- [x] Port autogenerator catalog data
- [x] Port machine helpers: `blueprintQualifies`, `cellIsFeatureCandidate`, `addTileToMachineInteriorAndIterate`, `expandMachineInterior`, `fillInteriorForVestibuleMachine`, `redesignInterior`, `prepareInteriorWithMachineFlags`
- [x] Port `buildAMachine` (~750 lines) with callback interfaces for item/monster ops
- [x] Port `addMachines`, `runAutogenerators`
- [x] Port `fillSpawnMap`, `spawnDungeonFeature`, `spawnMapDF`
- [x] Tests for machines — 31 tests passing

### Sub-step 3f: Orchestration — `ts/src/architect/architect.ts`
- [x] Port `clearLevel`, `carveDungeon`, `digDungeon`
- [x] Port `adjustDungeonProfileForDepth`, `adjustDungeonFirstRoomProfileForDepth`
- [x] Port `updateMapToShore`, `setUpWaypoints`, `refreshWaypoint`
- [x] Port `validStairLoc`, `prepareForStairs`, `placeStairs`
- [x] Port `initializeLevel`, `restoreMonster`, `restoreItems` (stubs — need Items/Monsters modules)
- [x] Seed-based regression tests — 28 tests passing (determinism, depth variance)

## Step 4: Items (8,040 lines)

### Sub-step 4a: Item tables & catalog data — `ts/src/globals/item-catalog.ts`
- [x] Port `potionTable`, `scrollTable`, `wandTable`, `charmTable` (from GlobalsBrogue.c)
- [x] Port `keyTable`, `foodTable`, `weaponTable`, `armorTable`, `staffTable`, `ringTable` (from Globals.c)
- [x] Port `meteredItemsGenerationTable`, `charmEffectTable`, `lumenstoneDistribution`
- [x] Port `itemGenerationProbabilities`

### Sub-step 4b: Item creation & generation core — `ts/src/items/item-generation.ts`
- [x] Port `initializeItem`, `generateItem`, `makeItemInto`, `pickItemCategory`, `chooseKind`
- [x] Port classification helpers: `itemIsThrowingWeapon`, `itemIsHeavyWeapon`, `itemIsPositivelyEnchanted`, `itemMagicPolarity`
- [x] Port lookup helpers: `getTableForCategory`, `getKindCountForCategory`, `getItemCategoryGlyph`, `getHallucinatedItemCategory`
- [x] Tests for item-generation — 43 tests passing

### Sub-step 4c: Level item population — `ts/src/items/item-population.ts`
- [x] Port `fillItemSpawnHeatMap`, `coolHeatMapAt`, `getItemSpawnLoc` (heat map helpers)
- [x] Port `populateItems` with `PopulateItemsContext` DI pattern
- [x] Tests for item-population — 20 tests passing

### Sub-step 4d: Item chain management & inventory helpers — `ts/src/items/item-inventory.ts`
- [x] Port `removeItemFromChain` → `removeItemFromArray`, `addItemToChain` → `addItemToArray` (array-based)
- [x] Port `itemAtLoc`, `itemOfPackLetter`
- [x] Port `numberOfItemsInPack`, `numberOfMatchingPackItems`
- [x] Port `inventoryLetterAvailable`, `nextAvailableInventoryCharacter`
- [x] Port `conflateItemCharacteristics`, `stackItems`
- [x] Port `itemWillStackWithPack`, `addItemToPack` (with stacking logic)
- [x] Port `itemIsSwappable`, `checkForDisenchantment`, `canPickUpItem`
- [x] Tests for item-inventory — 60 tests passing

### Sub-step 4e: Item naming, identification & flavors — `ts/src/items/item-naming.ts`
- [x] Port `isVowelish`, `itemKindName`, `itemRunicName`, `itemName` (full name generation)
- [x] Port `identify`, `identifyItemKind`, `tryIdentifyLastItemKinds`, `tryIdentifyLastItemKind`
- [x] Port `tryGetLastUnidentifiedItemKind`, `magicPolarityRevealedItemKindCount`, `itemKindCount`
- [x] Port `shuffleFlavors`, `resetItemTableEntry`, mutable flavor arrays
- [x] Port `itemValue`, `itemIsCarried`
- [x] Tests for item-naming — 51 tests passing

### Sub-step 4f: Item usage
- [ ] Port `apply`, `throw`, `drop`, `equip`, `unequip`, `call`
- [ ] Port `recalculateEquipmentBonuses`

### Sub-step 4g: Bolt mechanics
- [ ] Port bolt path resolution and bolt effects

### Sub-step 4h: Wire up ItemOps
- [ ] Wire up `ItemOps` callbacks in `machines.ts` with real item functions

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
