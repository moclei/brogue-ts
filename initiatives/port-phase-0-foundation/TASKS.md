# Phase 0: Foundation — Tasks

## Project Setup
- [x] Create `ts/` directory with `package.json` (ESM, TypeScript 5.x, Vitest)
- [x] Create `tsconfig.json` with `strict: true`, ESM module settings
- [x] Create `vitest.config.ts`
- [x] Verify build and test commands work (`tsc --noEmit`, `vitest run`)

## Codebase Manifest
- [ ] Create `.context/manifest.yaml` mapping all 24 C source files in `src/brogue/`

## Type System (Rogue.h → `ts/src/types/`)
- [x] Port constants — `COLS`, `ROWS`, `DCOLS`, `DROWS`, `STAT_BAR_WIDTH`, `FP_BASE`, key constants, keyboard constants
- [x] Port `Fl()` helper and bitfield flag constants — `tileFlags`, `terrainFlagCatalog`, `terrainMechanicalFlagCatalog`, `DFFlags`, `boltFlags`, `itemFlags`, `hordeFlags`, `monsterBehaviorFlags`, `monsterAbilityFlags`, `monsterBookkeepingFlags`, `machineFeatureFlags`, `blueprintFlags`, `BUTTON_FLAGS`, `messageFlags`
- [x] Port simple enums — `gameVariant`, `displayGlyph`, `graphicsModes`, `eventTypes`, `notificationEventTypes`, `RNGs`, `displayDetailValues`, `directions`, `textEntryTypes`, `tileType`, `lightType`, `itemCategory`, `keyKind`, `foodKind`, `potionKind`, `weaponKind`, `weaponEnchants`, `armorKind`, `armorEnchants`, `wandKind`, `staffKind`, `boltType`, `ringKind`, `charmKind`, `scrollKind`, `monsterTypes`, `dungeonFeatureTypes`, `dungeonProfileTypes`, `boltEffects`, `statusEffects`, `creatureStates`, `creatureModes`, `dungeonLayers`, `NGCommands`, `featTypes`, `exitStatus`, `gameMode`, `machineTypes`, `buttonDrawStates`, `autoTargetMode`
- [x] Port struct interfaces — `Pos`, `WindowPos`, `RogueEvent`, `RogueHighScoresEntry`, `Color`, `RandomRange`, `CellDisplayBuffer`, `ScreenDisplayBuffer`
- [x] Port struct interfaces — `Pcell`, `Tcell`, `Item`, `ItemTable`, `CharmEffectTableEntry`, `MeteredItemGenerationTable`, `LevelFeeling`
- [x] Port struct interfaces — `LightSource`, `Flare`, `Bolt`, `DungeonProfile`, `DungeonFeature`, `FloorTileType`
- [x] Port struct interfaces — `CreatureType`, `MonsterWords`, `Mutation`, `HordeType`, `MonsterClass`, `Creature`, `CreatureList`
- [x] Port struct interfaces — `GameConstants`, `PlayerCharacter`, `LevelData`, `MachineFeature`, `Blueprint`, `AutoGenerator`, `Feat`
- [x] Port struct interfaces — `BrogueButton`, `ButtonState`, `ArchivedMessage`
- [ ] Port inline utility functions — `signum`, `clamp`, `min`, `max`, `posEq`, `coordinatesAreInMap`, `isPosInMap`, `mapToWindow`, `windowToMap`
- [x] Create barrel export `index.ts`
- [x] Port `BrogueConsole` platform interface

## Math / RNG (Math.c → `ts/src/math/`)
- [x] Port Jenkins PRNG — `ranctx`, `ranval`, `raninit`, `rot` macro
- [x] Port `seedRandomGenerator` — seed both RNG streams from a 64-bit seed
- [x] Port `range` (unbiased rejection sampling) and `rand_range`
- [x] Port `rand_64bits`
- [x] Port `rand_percent`, `randClumpedRange`, `randClump`
- [x] Port `shuffleList`, `fillSequentialList`
- [x] Port fixed-point — `FP_FACTOR`, `FP_MUL`, `FP_DIV`, `fp_round`, `fp_sqrt` (including `SQUARE_ROOTS` lookup table), `fp_pow`

## Validation
- [x] Write unit tests for all RNG functions (seeded, deterministic assertions)
- [x] Write unit tests for fixed-point functions (`fp_round`, `fp_pow`, `fp_sqrt`)
- [x] Generate C RNG reference fixtures (seed → sequence of rand_range outputs)
- [x] Write cross-validation test: TypeScript RNG output matches C fixtures exactly
- [x] Generate C fixed-point reference fixtures and cross-validate
