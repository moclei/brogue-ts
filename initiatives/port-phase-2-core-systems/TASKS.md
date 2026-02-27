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

### Sub-step 4f: Item usage — `ts/src/items/item-usage.ts`
- [x] Port `strengthModifier`, `netEnchant` (from Combat.c, pure calculations)
- [x] Port `effectiveRingEnchant`, `apparentRingBonus`, `enchantIncrement`, `enchantMagnitude`
- [x] Port `armorValueIfUnenchanted`, `displayedArmorValue`
- [x] Port `recalculateEquipmentBonuses`, `updateRingBonuses`, `updateEncumbrance`
- [x] Port `strengthCheck` (strength warning messages)
- [x] Port `equipItem`, `unequipItem` (weapon/armor/ring slot management)
- [x] Port `enchantItem` (scroll of enchanting effect)
- [x] Tests for item-usage — 64 tests passing
- [ ] Port interactive scroll/potion/wand handlers (deferred — needs UI/player turn system)

### Sub-step 4g: Bolt mechanics — `ts/src/items/bolt-geometry.ts`
- [x] Port `getLineCoordinates` (fixed-point line tracing with waypoint offsets)
- [x] Port `getImpactLoc` (bolt impact resolution with creature/terrain callbacks)
- [x] Port `reflectBolt` (retrace and random-target reflection)
- [x] Port `openPathBetween` (line-of-sight check)
- [x] Tests for bolt-geometry — 24 tests passing

### Sub-step 4h: Wire up ItemOps — `ts/src/items/item-ops.ts`
- [x] Refactor `MachineItem` to drop `nextItem` (array-based, no linked lists)
- [x] Refactor `MachineContext.floorItems`/`packItems` from `MachineItem | null` to `MachineItem[]`
- [x] Rename `ItemOps.removeItemFromChain` to `removeItemFromArray`
- [x] Implement `createItemOps()` factory bridging real item functions to `ItemOps` interface
- [x] Tests for item-ops — 13 tests passing

## Step 5: Monsters (4,826 lines)

### Sub-step 5a: Monster catalogs — `ts/src/globals/monster-catalog.ts`, `ts/src/globals/horde-catalog.ts`
- [x] Port `monsterCatalog` (68 entries from Globals.c)
- [x] Port `hordeCatalog` (175 entries from GlobalsBrogue.c)
- [x] Tests for catalogs — 14 tests passing

### Sub-step 5b: Monster creation & initialization — `ts/src/monsters/monster-creation.ts`
- [x] Port `mutateMonster`, `initializeStatus`, `initializeGender`, `createCreature` (= generateMonster)
- [x] DI via `MonsterGenContext` and `MonsterRNG`
- [x] Tests for monster-creation — 23 tests passing

### Sub-step 5c: Monster spawning — `ts/src/monsters/monster-spawning.ts`
- [x] Port `pickHordeType`, `spawnMinions`, `spawnHorde`, `populateMonsters`, `spawnPeriodicHorde`
- [x] Port `forbiddenFlagsForMonster`, `avoidedFlagsForMonster`, `monsterCanSubmergeNow`
- [x] DI via `SpawnContext`
- [x] Tests for monster-spawning — 20 tests passing

### Sub-step 5d: Monster queries & visibility — `ts/src/monsters/monster-queries.ts`
- [x] Port `monsterRevealed`, `monsterHiddenBySubmersion`, `monsterIsHidden`, `canSeeMonster`, `canDirectlySeeMonster`
- [x] Port `monsterName`, `monsterIsInClass`, `attackWouldBeFutile`, `monsterWillAttackTarget`
- [x] Port `monstersAreTeammates`, `monstersAreEnemies`
- [x] DI via `MonsterQueryContext`
- [x] Tests for monster-queries — 45 tests passing

### Sub-step 5e: Monster state & status — `ts/src/monsters/monster-state.ts`
- [x] Port `empowerMonster`, `chooseNewWanderDestination`, `monsterAvoids`, `alertMonster`, `wakeUp`
- [x] Port `updateMonsterState`, `decrementMonsterStatus`, `monsterFleesFrom`, `distanceBetween`
- [x] DI via `MonsterStateContext`
- [x] Tests for monster-state — 52 tests passing

### Sub-step 5f: Monster movement helpers — `ts/src/monsters/monster-movement.ts`
- [x] Port `canPass`, `isPassableOrSecretDoor`, `setMonsterLocation`, `moveMonster`
- [x] Port `findAlternativeHomeFor`, `getQualifyingLocNear`, `getQualifyingGridLocNear`
- [x] DI via `MonsterMovementContext` and `MoveMonsterContext`
- [x] Tests for monster-movement — 27 tests passing

### Sub-step 5g: Monster actions — `ts/src/monsters/monster-actions.ts`
- [x] Port `prependCreature`, `removeCreature` (array-based creature list management)
- [x] Port `canNegateCreatureStatusEffects`, `negateCreatureStatusEffects`
- [x] Port `monsterSummons`, `monstersTurn` (main AI loop with full DI)
- [x] DI via `MonsterSummonsContext` and `MonstersTurnContext`
- [x] Tests for monster-actions — 34 tests passing

### Sub-step 5h: MonsterOps bridge — `ts/src/monsters/monster-ops.ts`
- [x] Implement `createMonsterOps()` factory (matching `createItemOps` pattern)
- [x] Port `toggleMonsterDormancy`
- [x] Tests for monster-ops — 13 tests passing

**Total: 214 tests across 7 monster modules**

## Step 6: Combat (1,784 lines)

### Sub-step 6a: Combat math — `ts/src/combat/combat-math.ts`
- [x] Port `monsterDamageAdjustmentAmount`, `monsterDefenseAdjusted`, `monsterAccuracyAdjusted`
- [x] Port `hitProbability`, `attackHit`, `diagonalBlocked`
- [x] DI via `CombatMathContext`
- [x] Tests for combat-math — 37 tests passing

### Sub-step 6e: Damage & status helpers — `ts/src/combat/combat-damage.ts`
- [x] Port `flashMonster`, `inflictLethalDamage`, `inflictDamage`
- [x] Port `addPoison`, `killCreature`, `heal`, `unAlly`
- [x] DI via `CombatDamageContext`
- [x] Tests for combat-damage — 58 tests passing

### Sub-step 6b: Attack resolution — `ts/src/combat/combat-attack.ts`
- [x] Port `buildHitList`, `processStaggerHit`, `moralAttack`, `attack`
- [x] DI via `AttackContext`
- [x] Tests for combat-attack — 37 tests passing

### Sub-step 6d: Runic weapon/armor effects — `ts/src/combat/combat-runics.ts`
- [x] Port `specialHit`, `magicWeaponHit`, `applyArmorRunicEffect`
- [x] DI via `RunicContext`
- [x] Tests for combat-runics — 38 tests passing

### Sub-step 6c: Combat helpers — `ts/src/combat/combat-helpers.ts`
- [x] Port `splitMonster` (jelly splitting with contiguous grid logic)
- [x] Port `anyoneWantABite`, `canAbsorb` (ally absorption targeting)
- [x] Port `CombatMessageBuffer` (`combatMessage`, `displayCombatText`)
- [x] Port `handlePaladinFeat`, `playerImmuneToMonster`, `decrementWeaponAutoIDTimer`
- [x] Port `strLenWithoutEscapes`
- [x] DI via `CombatHelperContext`
- [x] Tests for combat-helpers — 37 tests passing

### Sub-step 6f: Wire-up — `ts/src/combat/index.ts`
- [x] Barrel exports for all combat functions and context types
- [x] Verified integration with `MonsterStateContext.inflictDamage` and `killCreature` stubs

**Total: 207 tests across 5 combat modules**

## Step 7: Movement (2,487 lines)

### Sub-step 7a: Map query helpers — `ts/src/movement/map-queries.ts`
- [x] Port `highestPriorityLayer`, `layerWithTMFlag`, `layerWithFlag`
- [x] Port `tileFlavor`, `tileText`, `storeMemories`, `discover`
- [x] Port `isDisturbed`, `addScentToCell`, `getLocationFlags`
- [x] Port `describeLocation`, `printLocationDescription`
- [x] DI via `MapQueryContext`
- [x] Tests for map-queries — 29 tests passing

### Sub-step 7b: Player movement — `ts/src/movement/player-movement.ts`
- [x] Port `randValidDirectionFrom`, `vomit`, `moveEntrancedMonsters`
- [x] Port `playerRuns`, `playerMoves` (~400 lines)
- [x] DI via `PlayerMoveContext`
- [x] Tests for player-movement — 18 tests passing

### Sub-step 7c: Extended weapon attacks — `ts/src/movement/weapon-attacks.ts`
- [x] Port `abortAttackAgainstAcidicTarget`, `abortAttackAgainstDiscordantAlly`, `abortAttack`
- [x] Port `handleWhipAttacks`, `handleSpearAttacks`, `buildFlailHitList`
- [x] DI via `WeaponAttackContext`
- [x] Tests for weapon-attacks — 17 tests passing

### Sub-step 7d: Ally/captive management — `ts/src/movement/ally-management.ts`
- [x] Port `becomeAllyWith`, `freeCaptive`, `freeCaptivesEmbeddedAt`
- [x] DI via `AllyManagementContext`
- [x] Tests for ally-management — 13 tests passing

### Sub-step 7e: Travel & explore — `ts/src/movement/travel-explore.ts`
- [x] Port `nextStep`, `displayRoute`, `travelRoute`, `travelMap`, `travel`
- [x] Port `adjacentFightingDir`, `startFighting`, `proposeOrConfirmLocation`, `useStairs`
- [x] Port `getExploreMap`, `explore`, `autoPlayLevel`
- [x] DI via `TravelExploreContext`
- [x] Tests for travel-explore — 42 tests passing

### Sub-step 7f: Cost maps & FOV display — `ts/src/movement/cost-maps-fov.ts`
- [x] Port `populateGenericCostMap`, `populateCreatureCostMap`
- [x] Port `updateFieldOfViewDisplay`
- [x] DI via `CostMapFovContext`
- [x] Tests for cost-maps-fov — 19 tests passing

### Sub-step 7g: Item description helpers — `ts/src/movement/item-helpers.ts`
- [x] Port `describedItemBasedOnParameters`, `describedItemName`
- [x] Port `useKeyAt`, `search`
- [x] DI via `ItemHelperContext`
- [x] Tests for item-helpers — 15 tests passing

### Sub-step 7h: Wire-up — `ts/src/movement/index.ts`
- [x] Barrel exports for all movement functions and context types

**Total: 153 tests across 7 movement modules**

## Step 8: Time (2,640 lines)

### Sub-step 8a: Turn processing core — `ts/src/time/turn-processing.ts`
- [x] Port `scentDistance`, `recordCurrentCreatureHealths`, `addXPXPToAlly`, `handleXPXP`
- [x] Port `playerRecoversFromAttacking`, `synchronizePlayerTimeState`, `resetScentTurnNumber`
- [x] Port `playerTurnEnded` (main orchestrator)
- [x] DI via `TurnProcessingContext`
- [x] Tests for turn-processing — 23 tests passing

### Sub-step 8b: Status / creature effects — `ts/src/time/creature-effects.ts`
- [x] Port `exposeCreatureToFire`, `extinguishFireOnCreature`, `burnItem`
- [x] Port `applyInstantTileEffectsToCreature`, `applyGradualTileEffectsToCreature`
- [x] Port `monsterShouldFall`, `monstersFall`, `decrementPlayerStatus`, `playerFalls`
- [x] Port `checkNutrition`, `handleHealthAlerts`, `flashCreatureAlert`
- [x] Port `updatePlayerUnderwaterness`, `updateFlavorText`
- [x] DI via `CreatureEffectsContext`
- [x] Tests for creature-effects — 83 tests passing

### Sub-step 8c: Environment updates — `ts/src/time/environment.ts`
- [x] Port `updateEnvironment`, `promoteTile`, `activateMachine`
- [x] Port `circuitBreakersPreventActivation`, `exposeTileToFire`, `exposeTileToElectricity`
- [x] Port `updateVolumetricMedia`
- [x] DI via `EnvironmentContext`
- [x] Tests for environment — 39 tests passing

### Sub-step 8d: Safety maps & vision — `ts/src/time/safety-maps.ts`
- [x] Port `updateClairvoyance`, `updateTelepathy`, `updateVision`
- [x] Port `resetDistanceCellInGrid`, `updateAllySafetyMap`, `updateSafetyMap`, `updateSafeTerrainMap`
- [x] DI via `SafetyMapsContext`
- [x] Tests for safety-maps — 36 tests passing

### Sub-step 8e: Misc helpers — `ts/src/time/misc-helpers.ts`
- [x] Port `staffChargeDuration`, `rechargeItemsIncrementally`, `processIncrementalAutoID`
- [x] Port `dangerChanged`, `autoRest`, `manualSearch`
- [x] Port `updateYendorWardenTracking`, `monsterEntersLevel`, `monstersApproachStairs`
- [x] DI via `MiscHelpersContext`
- [x] Tests for misc-helpers — 42 tests passing

### Sub-step 8f: Wire-up — `ts/src/time/index.ts`
- [x] Barrel exports for all time functions and context types

**Total: 223 tests across 5 time modules**

## Step 9: Recordings (1,519 lines)

### Sub-step 9a: Recording state, codec, buffer — `ts/src/recordings/recording-state.ts`
- [x] Port `RecordingBuffer` interface and `RecordingBufferContext`
- [x] Port `keystrokeTable`, `compressKeystroke`, `uncompressKeystroke`
- [x] Port `numberToBytes`, `bytesToNumber` (variable-width number serialization)
- [x] Port `createRecordingBuffer`, `recordChar`, `recallChar`
- [x] Port `considerFlushingBufferToFile`, `flushBufferToFile`, `fillBufferFromFile`
- [x] Port `writeHeaderInfo`, `parseHeaderInfo` (header encoding/decoding)
- [x] Tests for recording-state — 44 tests passing

### Sub-step 9b: Event recording & recall — `ts/src/recordings/recording-events.ts`
- [x] Port `recordEvent`, `recordKeystroke`, `cancelKeystroke`, `recordKeystrokeSequence`, `recordMouseClick`
- [x] Port `recallEvent` (event deserialization with compression)
- [x] Port `playbackPanic`, `OOSCheck`, `RNGCheck`
- [x] DI via `RecordingEventsContext`
- [x] Tests for recording-events — 34 tests passing

### Sub-step 9c: Recording init — `ts/src/recordings/recording-init.ts`
- [x] Port `getPatchVersion` (version string parsing)
- [x] Port `initRecording` (recording/playback state initialization)
- [x] DI via `RecordingInitContext`
- [x] Tests for recording-init — 25 tests passing

### Sub-step 9d: Save/load & file path helpers — `ts/src/recordings/recording-save-load.ts`
- [x] Port `characterForbiddenInFilename`, `getAvailableFilePath`, `getDefaultFilePath`, `formatSeedString`
- [x] Port `saveGameNoPrompt`, `saveRecordingNoPrompt` (non-interactive save)
- [x] Port `switchToPlaying` (playback → active play transition)
- [x] DI via `SaveContext`, `SwitchToPlayingContext`
- [x] Tests for recording-save-load — 31 tests passing
- [ ] `saveGame`, `saveRecording` (interactive — deferred to Phase 3, needs UI dialogs)
- [ ] `loadSavedGame` (deferred to Phase 3, needs initializeRogue/startLevel)

### Sub-step 9e: Wire-up — `ts/src/recordings/index.ts`
- [x] Barrel exports for all recording functions and context types
- [x] Added to top-level `ts/src/index.ts`

### Deferred to Phase 3:
- [ ] `executePlaybackInput`, `seek`, `pausePlayback` (playback UI — heavily UI-dependent)
- [ ] `displayAnnotation`, `loadNextAnnotation`, `parseFile` (annotation system)
- [ ] `mainInputLoop` integration

**Total: 134 tests across 4 recording modules**
