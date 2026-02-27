# Port Phase 1: Data Layer — Plan

## Approach

Port the data layer bottom-up: start with primitive data (colors, direction tables), then catalogs that reference them, then computational tables, then grid operations.

## File Structure

All files go in `ts/src/`:

```
ts/src/
  globals/
    colors.ts          — All named color constants (~200)
    tables.ts          — Direction tables, charm increment tables, dynamic color bounds
    tile-catalog.ts    — tileCatalog (floorTileType[])
    dungeon-feature-catalog.ts — dungeonFeatureCatalog
    dungeon-profile-catalog.ts — dungeonProfileCatalog
    light-catalog.ts   — lightCatalog
    monster-text.ts    — monsterText (monsterWords[])
    mutation-catalog.ts — mutationCatalog
    monster-class-catalog.ts — monsterClassCatalog
    string-tables.ts   — itemCategoryNames, titlePhonemes, item colors/woods/metals/gems, runic names
    status-effects.ts  — statusEffectCatalog, behavior/ability catalogs & descriptions
    index.ts           — barrel export
  power/
    power-tables.ts    — All power lookup tables and enchantment calculation functions
    index.ts           — barrel export
  grid/
    grid.ts            — Grid operations (allocGrid, fillGrid, floodFill, blob generation, etc.)
    index.ts           — barrel export
```

## Implementation Order

### Step 1: Colors & Direction Tables
- Port all `const color` definitions from `GlobalsBase.c` and `Globals.c`
- Port `nbDirs`, `cDirs` direction tables
- Port charm increment power tables (`POW_0_CHARM_INCREMENT`, etc.)

### Step 2: Static Catalogs
- Port `tileCatalog` — references colors and enums
- Port `dungeonFeatureCatalog` — references tile types and dungeon feature types
- Port `dungeonProfileCatalog`
- Port `lightCatalog` — references colors
- Port `monsterText` — string data for monster descriptions
- Port `mutationCatalog` — references colors and enums
- Port `monsterClassCatalog` — references monster type enums
- Port string tables (item names, phonemes, material descriptions)
- Port `statusEffectCatalog`, behavior/ability catalogs

### Step 3: Power Tables
- Port all power lookup table arrays from `PowerTables.c`
- Port calculation functions: `staffDamage*`, `weaponParalysisDuration`, `reflectionChance`, `damageFraction`, `accuracyFraction`, `defenseFraction`, etc.
- Port `runicWeaponChance` (complex function with multiple lookup tables)

### Step 4: Grid Operations
- Port `allocGrid`, `freeGrid` → TypeScript grid factory
- Port `fillGrid`, `copyGrid`, `findReplaceGrid`
- Port `floodFillGrid` (recursive flood fill)
- Port `drawRectangleOnGrid`, `drawCircleOnGrid`
- Port `validLocationCount`, `randomLocationInGrid`
- Port `cellularAutomataRound`, `fillContiguousRegion`, `createBlobOnGrid`
- Skip/stub functions that depend on game state (`hiliteGrid`, `getTerrainGrid`, etc.)

### Step 5: Tests
- Unit tests for color constants (spot-check values)
- Unit tests for grid operations (fill, copy, flood fill, blob generation)
- Unit tests for power table functions (cross-validate with C reference values)

## Technical Decisions

- **Grid representation:** `number[][]` with `[x][y]` indexing (matching C's `short**` column-major layout)
- **Color constants:** Plain `Color` objects, frozen with `as const` where possible
- **Catalog arrays:** `readonly` typed arrays, matching C `const` arrays
- **Power table bigints:** Functions use `bigint` for fixed-point values consistent with Phase 0
- **Functions depending on game state:** Stub or parameterize (pass dependencies explicitly instead of reading globals)
