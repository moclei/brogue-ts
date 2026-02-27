# Port Phase 1: Data Layer — Brief

## Intent

Port the static data catalogs, direction tables, color definitions, power/enchantment lookup tables, and grid operations from C to TypeScript. These are the foundational data structures that virtually every game system depends on.

## Goals

1. Port all color constants from `GlobalsBase.c` and `Globals.c` (~200 named colors)
2. Port direction tables (`nbDirs`, `cDirs`) and related global definitions from `GlobalsBase.c`
3. Port all static catalogs from `Globals.c`: tileCatalog, dungeonFeatureCatalog, dungeonProfileCatalog, lightCatalog, monsterText, mutationCatalog, monsterClassCatalog, string tables (item names, phonemes, runic names), statusEffectCatalog, behavior/ability catalogs
4. Port power/enchantment lookup tables and calculation functions from `PowerTables.c`
5. Port grid operations from `Grid.c`: allocGrid, freeGrid, fillGrid, copyGrid, floodFillGrid, cellularAutomata, createBlobOnGrid
6. Port charm increment tables from `GlobalsBase.c`

## Scope

**In scope:**
- `GlobalsBase.c` (123 lines): direction tables, base colors, charm increment tables, global variable type definitions
- `Globals.c` (1,821 lines): all color constants, all static catalogs, string tables
- `PowerTables.c` (345 lines): power lookup tables and enchantment calculation functions
- `Grid.c` (547 lines): grid allocation and manipulation functions

**Out of scope:**
- Variant-specific catalog data (`GlobalsBrogue.c`, etc.) — those are Phase 2+
- Functions that depend on game state (e.g., `hiliteGrid` depends on display buffer, `getTerrainGrid` depends on pmap) — stubs or deferred
- The global mutable state variables declared in `GlobalsBase.c` (player, rogue, pmap, etc.) — those belong to a GameState module

## Constraints

- All data must match the C source exactly — values are load-bearing for deterministic gameplay
- Color constants must use the `Color` interface from Phase 0
- Catalog arrays must use the interfaces from Phase 0's type system
- Grid functions must use `DCOLS`/`DROWS` constants from Phase 0
- Power table functions depend on Phase 0's fixed-point math (`FP_FACTOR`, `fpPow`, `fpSqrt`)
