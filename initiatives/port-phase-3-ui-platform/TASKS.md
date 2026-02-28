# Phase 3: UI & Platform — Tasks

## Step 1: IO Core (~750 lines from IO.c)

### Sub-step 1a: Color manipulation — `ts/src/io/io-color.ts` ✅
- [x] Port `applyColorMultiplier`, `applyColorAverage`, `applyColorAugment`, `applyColorScalar`
- [x] Port `applyColorBounds`, `desaturate`, `randomizeColor`, `swapColors`
- [x] Port `bakeColor`, `normColor`, `separateColors`
- [x] Port `storeColorComponents`, `colorFromComponents`
- [x] Port `shuffleTerrainColors`, `colorMultiplierFromDungeonLight`
- [x] Port `encodeMessageColor`, `decodeMessageColor` (color escapes in strings)
- [x] DI via `ColorContext`
- [x] Tests for io-color (52 tests)

### Sub-step 1b: Display buffer & cell rendering — `ts/src/io/io-display.ts` ✅
- [x] Define `ScreenDisplayBuffer` factory (`createScreenDisplayBuffer`)
- [x] Port `clearDisplayBuffer`, `copyDisplayBuffer`
- [x] Port `saveDisplayBuffer`, `restoreDisplayBuffer`, `overlayDisplayBuffer`
- [x] Port `plotCharToBuffer`
- [x] Port coordinate mapping: `mapToWindow`, `windowToMap`, `locIsInWindow`, etc.
- [x] Tests for io-display (21 tests)

### Sub-step 1c: Cell appearance — `ts/src/io/io-appearance.ts` ✅
- [x] Port `glyphIsWallish`, `bakeTerrainColors`, `terrainColorsDancing`
- [x] Port `plotCharWithColor` (bakes random colors into display buffer)
- [x] Port `highlightScreenCell`, `blackOutScreen`, `colorOverDungeon`
- [x] Port `randomAnimateMonster`
- [x] Tests for io-appearance (19 tests)
- Note: `getCellAppearance` & `refreshDungeonCell` deferred to Step 2 (depends on full game state)

### Sub-step 1d: Text rendering — `ts/src/io/io-text.ts` ✅
- [x] Port `strLenWithoutEscapes` (from Combat.c)
- [x] Port `upperCase`, `breakUpLongWordsIn`, `wrapText`
- [x] Port `printString`, `printStringWithWrapping`
- [x] Port `capitalizeAndPunctuateSentences`
- [x] Tests for io-text (33 tests)

### Sub-step 1e: Wire-up — `ts/src/io/index.ts` ✅
- [x] Barrel exports for io-color, io-display, io-appearance, io-text

## Step 2: IO Game UI (~1,850 lines from IO.c)

### Sub-step 2a: Message system — `ts/src/io/io-messages.ts` ✅
- [x] Port `message`, `messageWithColor`, `flavorMessage`, `temporaryMessage`
- [x] Port `displayRecentMessages`, `formatRecentMessages`
- [x] Port `displayMessageArchive`, `animateMessageArchive`, `scrollMessageArchive`
- [x] Port `displayMoreSign`, `displayMoreSignWithoutWaitingForAcknowledgment`
- [x] Port `confirmMessages`, `deleteMessages`, `updateMessageDisplay`, `clearMessageArchive`
- [x] Port `ArchivedMessage` type and ring buffer logic (`addMessageToArchive`, `getArchivedMessage`, `foldMessages`, `formatCountedMessage`)
- [x] Port `combatMessage`, `displayCombatText` (from Combat.c)
- [x] Port `splitLines` into io-text.ts (used by formatRecentMessages)
- [x] DI via `MessageContext`
- [x] Tests for io-messages (64 tests)

### Sub-step 2b: Sidebar — `ts/src/io/io-sidebar.ts` ✅
- [x] Port `refreshSideBar` (~220 lines — entity collection, sorting, rendering)
- [x] Port `printMonsterInfo`, `printItemInfo`, `printTerrainInfo`
- [x] Port `printMonsterDetails`, `printFloorItemDetails`, `printCarriedItemDetails`
- [x] Port `printProgressBar`, `smoothHiliteGradient`, `creatureHealthChangePercent`, `estimatedArmorValue`
- [x] Port `collectSidebarEntities`, `describeHallucinatedItem`
- [x] DI via `SidebarContext`
- [x] Tests for io-sidebar (72 tests)
- [x] Fix: Added missing `Aggravating` entry to `statusEffectCatalog`

### Sub-step 2c: Inventory display — `ts/src/io/io-inventory.ts` ✅
- [x] Port `displayInventory` (~360 lines — button-based inventory screen from Items.c)
- [x] Port `displayMagicCharForItem` helper
- [x] Port `rectangularShading` (IO.c) — shaded rectangle with distance falloff
- [x] Port `printTextBox` (IO.c) — text box with auto-positioning, wrapping, optional buttons
- [x] ~~Port `describeHallucinatedItem`~~ (already in io-sidebar.ts)
- [x] DI via `InventoryContext`
- [x] Tests for io-inventory (30 tests)

### Sub-step 2d: Targeting & cursor — `ts/src/io/io-targeting.ts` ✅
- [x] Port `showCursor`, `hideCursor`, `clearCursorPath`
- [x] Port `getPlayerPathOnMap`, `reversePath`, `hilitePath`
- [x] Port `getClosestValidLocationOnMap`, `processSnapMap`
- [x] Port `hiliteCell`
- [x] Add `posNeighborInDirection` utility to `globals/tables.ts`
- [x] DI via `TargetingContext`
- [x] Tests for io-targeting (38 tests)

### Sub-step 2e: Input dispatch — `ts/src/io/io-input.ts` ✅
- [x] Port `mainInputLoop` (~300 lines — cursor movement, map snapping, travel)
- [x] Port `nextBrogueEvent` (with playback support)
- [x] Port `executeKeystroke` (~270 lines — all key commands)
- [x] Port `executeMouseClick`, `executeEvent`
- [x] Port `actionMenu` (~160 lines — in-game command menu)
- [x] Port `initializeMenuButtons`
- [x] Port `pauseBrogue`, `pauseAnimation`
- [x] Port `waitForAcknowledgment`, `waitForKeystrokeOrMouseClick`, `confirm`
- [x] Port `getInputTextString` (~120 lines — text entry dialog)
- [x] Port `nextKeyPress`
- [x] Port `considerCautiousMode`, `stripShiftFromMovementKeystroke`
- [x] ~~Port `displayMonsterFlashes`~~ (already in io-effects.ts in Step 2f)
- [x] DI via `InputContext`
- [x] Tests for io-input (95 tests)

### Sub-step 2f: Visual effects — `ts/src/io/io-effects.ts` ✅
- [x] Port `flashForeground`, `flashCell`, `colorFlash`
- [x] Port `funkyFade`, `irisFadeBetweenBuffers`
- [x] ~~Port `printProgressBar`~~ (moved to io-sidebar.ts in Step 2b)
- [x] Port `flashMessage`, `flashTemporaryAlert`, `displayCenteredAlert`
- [x] Port `blendAppearances`, `colorBlendCell`, `displayMonsterFlashes`
- [x] DI via `EffectsContext`
- [x] Tests for io-effects (35 tests)

### Sub-step 2g: Info screens — `ts/src/io/io-screens.ts` ✅
- [x] Port `printHelpScreen`
- [x] Port `printHighScores`
- [x] Port `displayFeatsScreen`, `printDiscoveriesScreen`, `printDiscoveries` (helper)
- [x] Port `printSeed`, `displayGrid`
- [x] DI via `ScreenContext`
- [x] Tests for io-screens (57 tests)

## Step 3: Menus & Wizard (~2,176 lines)

### Sub-step 3a: Button system — `ts/src/io/io-buttons.ts` ✅
- [x] Types already exist: `BrogueButton`, `ButtonState`, `ButtonDrawState`, `ButtonFlag`
- [x] Port `initializeButton`, `setButtonText`
- [x] Port `drawButton`, `drawButtonsInState`
- [x] Port `initializeButtonState`, `processButtonInput`, `buttonInputLoop`
- [x] ~~Port `smoothHiliteGradient`~~ (moved to io-sidebar.ts in Step 2b)
- [x] DI via `ButtonContext`
- [x] Tests for buttons (44 tests)

### Sub-step 3b: Main menu & title screen — `ts/src/menus/main-menu.ts` ✅
- [x] Port flame constants and types (`FlameGrid`, `ColorSource`, `FlameColorGrid`, `FlameMask`, `FileEntry`, `RogueRun`, `GameStats`)
- [x] Port `initializeMenuFlames`, `updateMenuFlames`, `drawMenuFlames`, `antiAlias`
- [x] Port `initializeMainMenuButton`, `initializeMainMenuButtons`, `stackButtons`
- [x] Port `initializeMenu`, `initializeMainMenu`, `initializeFlyoutMenu`
- [x] Port `isFlyoutActive`, `getNextGameButtonPos`, `redrawMainMenuButtons`
- [x] Port `titleMenu` (animated title with button selection)
- [x] Port `mainBrogueJunction` (top-level menu dispatcher)
- [x] Port `dialogChooseFile`, `dialogAlert`, `quitImmediately`
- [x] Port `chooseGameVariant`, `chooseGameMode`
- [x] Port `viewGameStats`, `addRunToGameStats`, `createGameStats`
- [x] DI via `MenuContext`
- [x] Tests for main-menu (62 tests)

### Sub-step 3c: Wizard / debug mode — `ts/src/menus/wizard.ts` ✅
- [x] Port `dialogCreateItemOrMonster` (main wizard dialog)
- [x] Port `dialogSelectEntryFromList` (generic list picker)
- [x] Port item creation sub-dialogs (vorpal enemy, runic, category, kind, enchantment)
- [x] Port monster creation dialog
- [x] Port `unflag` helper (from RogueMain.c)
- [x] DI via `WizardContext`
- [x] Tests for wizard (45 tests)

### Sub-step 3d: Wire-up — `ts/src/menus/index.ts` ✅
- [x] Barrel exports for main-menu, wizard

## Step 4: Game Loop (RogueMain.c, 1,414 lines)

### Sub-step 4a: Game initialization — `ts/src/game/game-init.ts` ✅
- [x] Port `initializeRogue` (~350 lines — seed setup, player creation, starting equipment, level seeding, map init, waypoints, terrain colors, flavors, message init)
- [x] Port `initializeGameVariant` (variant selection dispatcher)
- [x] Port `welcome` (opening messages)
- [x] Port `setPlayerDisplayChar`
- [x] Port `printBrogueVersion`, `getOrdinalSuffix`, `fileExists`, `chooseFile`, `openFile`
- [x] DI via `GameInitContext`
- [ ] Tests for game-init (verify starting state for known seeds)

### Sub-step 4b: Level transitions — `ts/src/game/game-level.ts` ✅
- [x] Port `startLevel` (~380 lines — save current level, generate/restore new level, position player, simulate environment, update vision, restore monsters)
- [x] Port `updateColors` (depth-dependent dynamic colors)
- [x] DI via `LevelContext`
- [ ] Tests for game-level
- Note: Real `restoreMonster`, `restoreItems`, full `initializeLevel` are delegated via DI context

### Sub-step 4c: Game lifecycle — `ts/src/game/game-lifecycle.ts` ✅
- [x] Port `gameOver` (~170 lines — death handling, score, save recording)
- [x] Port `victory` (~165 lines — victory screens, treasure tally, achievements)
- [x] Port `enableEasyMode`
- [x] DI via `LifecycleContext`
- [ ] Tests for game-lifecycle

### Sub-step 4d: Cleanup & utilities — `ts/src/game/game-cleanup.ts` ✅
- [x] Port `freeEverything` (~60 lines — resource cleanup)
- [x] Port `freeCreature` (recursive creature cleanup)
- [x] Port `removeDeadMonsters` (purge from creature lists)
- [x] Port `unflag`
- [x] DI via `CleanupContext`
- [ ] Tests for game-cleanup
- Note: `fileExists`, `chooseFile`, `openFile` are in game-init.ts

### Sub-step 4e: Wire-up — `ts/src/game/index.ts` ✅
- [x] Barrel exports for all game functions and types

## Step 5: Platform Interface & Browser Renderer ✅

### Sub-step 5a: Platform interface — `ts/src/types/platform.ts` (pre-existing)
- [x] `BrogueConsole` interface already defined (all 9 methods from C's `brogueConsole` struct)
- [x] `RogueEvent` type defined in `ts/src/types/types.ts`
- [x] `PauseBehavior` interface defined in `ts/src/types/types.ts`
- [x] `GraphicsMode`, `DisplayGlyph` enums in `ts/src/types/enums.ts`

### Sub-step 5b: Glyph mapping — `ts/src/platform/glyph-map.ts`
- [x] Port `glyphToUnicode` — full mapping table from platformdependent.c (all DisplayGlyph → Unicode code points)
- [x] Port `isEnvironmentGlyph` — using Set-based classification of item/creature glyphs
- [ ] Tests for glyph mapping (deferred to integration phase)

### Sub-step 5c: Null platform — `ts/src/platform/null-platform.ts`
- [x] Implement no-op `BrogueConsole` (`nullConsole` object) for testing/headless use
- [ ] Tests for null platform (deferred to integration phase)

### Sub-step 5d: Canvas2D browser renderer — `ts/src/platform/browser-renderer.ts`
- [x] Canvas setup (COLS×ROWS grid, auto font sizing, cell sizing)
- [x] `plotChar` implementation (glyphToUnicode → fillText with color conversion 0–100% → 0–255)
- [x] Keyboard event → `RogueEvent` translation (arrows, escape, return, numpad, printable chars)
- [x] Mouse event → `RogueEvent` translation (mousedown/up/move with grid coordinate mapping)
- [x] `pauseForMilliseconds` — event queue check (actual async via `asyncPause` helper)
- [x] `nextKeyOrMouseEvent` — synchronous queue pop + async `waitForEvent()` extension
- [x] `handleResize()` method for recalculating cell sizes
- [x] `takeScreenshot()` — canvas toDataURL + download link
- [x] Added `"DOM"` to tsconfig lib array for browser type support
- [ ] Tests for browser renderer (deferred to integration phase)

### Sub-step 5e: Wire-up — `ts/src/platform/index.ts`
- [x] Barrel exports for all platform types and implementations

## Step 6: Wire-up & Deferred Phase 2 Items

### Sub-step 6a: Interactive item handlers
- [ ] Port scroll handlers (enchanting, identify, teleportation, etc.) — wiring UI prompts into `ts/src/items/`
- [ ] Port potion handlers (detect magic, telepathy, etc.)
- [ ] Port wand/staff interactive effects (targeting, bolt animation)
- [ ] Tests for interactive handlers

### Sub-step 6b: Playback UI
- [ ] Port `executePlaybackInput` (playback keyboard controls)
- [ ] Port `seek` (fast-forward to turn)
- [ ] Port `pausePlayback`
- [ ] Port annotation system: `displayAnnotation`, `loadNextAnnotation`, `parseFile`
- [ ] Tests for playback UI

### Sub-step 6c: Interactive save/load
- [ ] Port `saveGame` (with text input dialog for filename)
- [ ] Port `saveRecording` (with text input dialog)
- [ ] Port `loadSavedGame` (requires `initializeRogue` + `startLevel` + progress bar)
- [ ] Tests for interactive save/load

### Sub-step 6d: Full integration
- [ ] Create browser entry point (`index.html` + bootstrap)
- [ ] Wire `BrogueConsole` into all DI contexts
- [ ] Connect `mainBrogueJunction` → `initializeRogue` → `startLevel` → `mainInputLoop` loop
- [ ] Verify playable browser game
- [ ] Update top-level `ts/src/index.ts` barrel exports
