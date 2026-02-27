# Port Phase 1: Data Layer — Tasks

## Step 1: Colors & Direction Tables
- [x] Port all color constants from GlobalsBase.c and Globals.c → `globals/colors.ts`
- [x] Port direction tables, charm increment tables, dynamic color bounds → `globals/tables.ts`

## Step 2: Static Catalogs
- [x] Port tileCatalog → `globals/tile-catalog.ts`
- [x] Port dungeonFeatureCatalog → `globals/dungeon-feature-catalog.ts`
- [x] Port dungeonProfileCatalog → `globals/dungeon-profile-catalog.ts`
- [x] Port lightCatalog → `globals/light-catalog.ts`
- [x] Port monsterText → `globals/monster-text.ts`
- [x] Port mutationCatalog → `globals/mutation-catalog.ts`
- [x] Port monsterClassCatalog → `globals/monster-class-catalog.ts`
- [x] Port string tables → `globals/string-tables.ts`
- [x] Port statusEffectCatalog, behavior/ability catalogs → `globals/status-effects.ts`
- [x] Create barrel export → `globals/index.ts`

## Step 3: Power Tables
- [x] Port power lookup tables (POW_POISON, POW_WISDOM, POW_REFLECT, POW_REGEN, POW_DAMAGE_FRACTION, POW_DEFENSE_FRACTION, POW_CHARM_PROTECTION, runic decrement tables)
- [x] Port calculation functions (staffDamage*, staffPoison, ringWisdomMultiplier, weapon/armor enchant functions, reflectionChance, turnsForFullRegenInThousandths, damageFraction, accuracyFraction, defenseFraction, charmProtection, charmEffectDuration, charmRechargeDelay, wandDominate, runicWeaponChance)
- [x] Create barrel export → `power/index.ts`

## Step 4: Grid Operations
- [x] Port pure grid operations (allocGrid, freeGrid, copyGrid, fillGrid, findReplaceGrid, floodFillGrid, drawRectangleOnGrid, drawCircleOnGrid, validLocationCount, randomLocationInGrid, randomLeastPositiveLocationInGrid, cellularAutomataRound, fillContiguousRegion, createBlobOnGrid)
- [x] Create barrel export → `grid/index.ts`
- [ ] Deferred to Phase 2/3: hiliteGrid, getTerrainGrid, getTMGrid, getPassableArcGrid, getQualifyingPathLocNear (depend on game state)

## Step 5: Tests
- [x] Tests for grid operations (16 tests)
- [x] Tests for power table functions (39 tests)
- [x] Tests for globals/colors and tables (14 tests)

## Notes
- Item tables (keyTable, foodTable, weaponTable, armorTable, staffTable, ringTable) are deferred to Phase 2/3 as they reference mutable runtime arrays (itemWoods, itemGems, etc.) and require the full item system.
- All 135 tests pass. All TypeScript compiles cleanly with `--strict`.
